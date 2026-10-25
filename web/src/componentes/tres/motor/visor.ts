// 3D viewer of one component model, rendered on demand: a frame is drawn only when the camera moves, an
// animation runs (inertia, view reset, explosion) or something changes (parameters, cut, theme, size).
// Device pixels capped at 2× and about 2 Mpx; paused when hidden or off screen; everything it creates is
// disposed by liberar(). WebGL2 only (three.js r186): soporteWebGL2() lets the page fall back to 2D.

import {
  Box3,
  BackSide,
  Color,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PerspectiveCamera,
  Plane,
  Sphere,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  LineSegments,
  EdgesGeometry,
  PlaneGeometry,
  LineBasicMaterial,
  type Group,
} from 'three';
import { crearEstudio, type Estudio } from './estudio';
import { crearPlaca, type Placa } from './placa';
import { Orbita, type EstadoOrbita } from './orbita';
import { liberarModelo } from '../modelos';
import type { Corte, DatosModelo, DatosParte } from '../modelos/tipos';

export { soporteWebGL2 } from './soporte';

export interface Enlace {
  href: string;
  num: string;
}

export interface OpcionesVisor {
  /** Book reference → link (number and route), or null. */
  enlace?: (ref: string) => Enlace | null;
  /** Called when a label link is followed (to prepare the «Volver» jump). */
  alSeguir?: () => void;
  /** Called if the WebGL context is lost and cannot be restored. */
  alFallar?: (motivo: string) => void;
  /** List under the canvas: on narrow viewers labels become numbered markers explained there. */
  leyenda?: HTMLElement;
}

interface EtiquetaViva {
  obj: Object3D;
  punto: Vector3;
  interior: boolean;
  /** Shown last frame, and its measured size (measured once while shown, reset on resize). */
  visible: boolean;
  ancho: number;
  alto: number;
  el: HTMLElement;
  item: HTMLLIElement | null;
  linea: SVGLineElement;
  punto2: SVGCircleElement;
}

type Stats = { n: number; total: number; max: number; cuadro: number; marcas: number[]; triangulos: number; llamadas: number };

export class Visor {
  readonly renderer: WebGLRenderer;
  private estudio: Estudio;
  private camara = new PerspectiveCamera(30, 1, 0.1, 2000);
  private orbita: Orbita;
  private modelo: Group | null = null;
  private plano = new Plane(new Vector3(0, 1, 0), 1e6);
  private corte: Corte | null = null;
  private iCorte = 0;
  private corteActivo = false;
  private posCorte = 0;
  private contorno: LineSegments | null = null;
  private tapas: Mesh[] = [];
  private matTapas = new Map<string, MeshBasicMaterial>();
  private clonados: Material[] = [];
  private explosion = 0;
  private explosionObjetivo = 0;
  private bases = new Map<Object3D, Vector3>();
  private etiquetas: EtiquetaViva[] = [];
  private mostrarEtiquetas = true;
  private vistaInicialEstado: EstadoOrbita | null = null;
  private raf = 0;
  private sucio = true;
  private visible = true;
  private paginaVisible = true;
  private ancho = 0;
  private alto = 0;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private svg: SVGSVGElement;
  private quieto: boolean;
  private liberado = false;
  private fondoOscuro = false;
  private placa: Placa | null = null;
  private compacto = false;

  constructor(
    private lienzo: HTMLCanvasElement,
    private capa: HTMLElement,
    private opc: OpcionesVisor = {},
  ) {
    this.quieto = matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const dpr = window.devicePixelRatio || 1;
    this.renderer = new WebGLRenderer({ canvas: lienzo, antialias: dpr < 1.5, alpha: false, powerPreference: 'default', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.localClippingEnabled = true;
    this.estudio = crearEstudio(this.renderer);
    this.orbita = new Orbita(this.camara, lienzo, () => this.pedir(), () => this.quieto);
    this.orbita.alReiniciar = () => this.vistaInicial(true);
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'lineas');
    this.svg.setAttribute('aria-hidden', 'true');
    capa.appendChild(this.svg);

    lienzo.addEventListener('webglcontextlost', this.perdido);
    lienzo.addEventListener('webglcontextrestored', this.restaurado);
    this.io = new IntersectionObserver((e) => {
      for (const x of e) this.visible = x.isIntersecting;
      if (this.visible) this.pedir();
    });
    this.io.observe(lienzo);
    this.ro = new ResizeObserver(() => this.redimensionar());
    this.ro.observe(lienzo.parentElement ?? lienzo);
    document.addEventListener('visibilitychange', this.vis);
    this.redimensionar();
  }

  private perdido = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    setTimeout(() => {
      if (!this.liberado && this.renderer.getContext().isContextLost()) this.opc.alFallar?.('Se perdió el contexto WebGL');
    }, 2500);
  };

  private restaurado = (): void => this.pedir();

  private vis = (): void => {
    this.paginaVisible = document.visibilityState !== 'hidden';
    if (this.paginaVisible) this.pedir();
  };

  // ------------------------------------------------------------------ model

  ponerModelo(g: Group, conservarVista = false): void {
    const anterior = this.modelo;
    const datos = g.userData as DatosModelo;
    this.quitarTapas();
    if (anterior) {
      this.estudio.raiz.remove(anterior);
      liberarModelo(anterior);
    }
    for (const m of this.clonados) m.dispose();
    this.clonados = [];
    this.modelo = g;
    this.estudio.raiz.add(g);
    this.bases.clear();
    g.traverse((o) => {
      const d = o.userData as DatosParte;
      if (d.explosion) this.bases.set(o, o.position.clone());
    });
    this.prepararCorte();
    this.aplicarExplosion();
    // Bounding box at rest (no explosion) for the camera and the shadow; mounted parts sit on a piece of board.
    const caja = new Box3().setFromObject(g);
    const tam = caja.getSize(new Vector3());
    if (this.placa) {
      this.placa.grupo.removeFromParent();
      this.placa.liberar();
      this.placa = null;
    }
    const enPlaca = datos.montaje === 'placa' && (datos.huella?.pads.length ?? 0) > 0;
    if (enPlaca) {
      this.placa = crearPlaca(datos.huella, tam.x, tam.y);
      this.estudio.raiz.add(this.placa.grupo);
      this.estudio.ajustarSombra(tam.x * 0.85, tam.y * 0.85, 0.02);
    } else this.estudio.ajustarSombra(Math.max(tam.x, datos.huella?.ancho ?? 0) * 0.92, Math.max(tam.y, datos.huella?.fondo ?? 0) * 0.92, caja.min.z);
    const esfera = caja.getBoundingSphere(new Sphere());
    const dist = esfera.radius / Math.sin((this.camara.fov * Math.PI) / 360) * 1.08;
    this.orbita.minDist = esfera.radius * 0.5;
    this.orbita.maxDist = dist * 5;
    const ini: EstadoOrbita = { azimut: 0.5, elevacion: 0.55, distancia: dist, objetivo: esfera.center.clone() };
    this.vistaInicialEstado = ini;
    if (!conservarVista) this.orbita.ir(ini, false);
    this.crearEtiquetas();
    this.corte = null;
    this.ponerCorteDatos(Math.min(this.iCorte, Math.max(0, (datos.cortes?.length ?? 1) - 1)), this.posCorte);
    this.pedir();
  }

  datos(): DatosModelo | null {
    return (this.modelo?.userData as DatosModelo) ?? null;
  }

  vistaInicial(animar = true): void {
    if (this.vistaInicialEstado) this.orbita.ir(this.vistaInicialEstado, animar);
  }

  ponerFondo(color: string, oscuro: boolean): void {
    this.fondoOscuro = oscuro;
    this.estudio.ponerFondo(color, oscuro);
    if (this.contorno) (this.contorno.material as LineBasicMaterial).color.set(oscuro ? '#7fb3e6' : '#2e6ea6');
    this.pedir();
  }

  // ------------------------------------------------------------------ cutaway

  /** Materials of clipped meshes get the plane; meshes that stay whole get their own copy without it. */
  private prepararCorte(): void {
    const g = this.modelo;
    if (!g) return;
    const cortables = new Set<Material>();
    const enteros: Mesh[] = [];
    const recorrer = (o: Object3D, entero: boolean) => {
      const e = entero || !!(o.userData as DatosParte).entero;
      const m = o as Mesh;
      if (m.isMesh) {
        if (e) enteros.push(m);
        else for (const mat of Array.isArray(m.material) ? m.material : [m.material]) cortables.add(mat);
      }
      for (const h of o.children) recorrer(h, e);
    };
    recorrer(g, false);
    const copias = new Map<Material, Material>();
    for (const m of enteros) {
      const mat = m.material as Material;
      if (!cortables.has(mat)) continue;
      let c = copias.get(mat);
      if (!c) {
        c = mat.clone();
        copias.set(mat, c);
        this.clonados.push(c);
      }
      m.material = c;
    }
    for (const mat of cortables) mat.clippingPlanes = [this.plano];
    // Cut faces: back faces of every clipped closed solid drawn flat in its cut colour.
    const recorrerTapas = (o: Object3D, entero: boolean, color: string | undefined) => {
      const d = o.userData as DatosParte;
      const e = entero || !!d.entero;
      const c = d.colorCorte ?? color;
      const m = o as Mesh;
      if (m.isMesh && !e && !m.userData.decal) {
        const mat = m.material as MeshStandardMaterial;
        if (!mat.transparent && mat.side !== 2 && !mat.alphaTest) {
          const col = (mat.userData.corte as string | undefined) ?? c ?? '#' + new Color(mat.color ?? 0x888888).multiplyScalar(0.72).getHexString();
          let mt = this.matTapas.get(col);
          if (!mt) {
            mt = new MeshBasicMaterial({ color: new Color(col), side: BackSide, clippingPlanes: [this.plano] });
            this.matTapas.set(col, mt);
          }
          let tapa: Mesh;
          if ((m as InstancedMesh).isInstancedMesh) {
            const im = m as InstancedMesh;
            const t = new InstancedMesh(im.geometry, mt, im.count);
            t.instanceMatrix = im.instanceMatrix;
            tapa = t;
          } else tapa = new Mesh(m.geometry, mt);
          tapa.userData.tapa = true;
          tapa.visible = false;
          tapa.renderOrder = -0.5;
          m.add(tapa);
          this.tapas.push(tapa);
        }
      }
      for (const h of [...o.children]) if (!h.userData.tapa) recorrerTapas(h, e, c);
    };
    recorrerTapas(g, false, undefined);
  }

  private quitarTapas(): void {
    for (const t of this.tapas) t.removeFromParent();
    this.tapas = [];
    if (this.contorno) {
      this.contorno.removeFromParent();
      this.contorno.geometry.dispose();
      (this.contorno.material as Material).dispose();
      this.contorno = null;
    }
  }

  /** Choose one of the model's cuts (index in DatosModelo.cortes). */
  ponerCorteDatos(i: number, pos?: number): void {
    const c = this.datos()?.cortes?.[i] ?? null;
    const otro = i !== this.iCorte;
    this.iCorte = i;
    this.corte = c;
    if (c) this.posCorte = pos != null && !otro ? Math.max(c.min, Math.min(c.max, pos)) : c.inicial;
    this.aplicarCorte();
  }

  posicionCorte(): number {
    return this.posCorte;
  }

  /** Turns the camera so that the cut face (on the removed side of the plane) is in view. */
  mirarCorte(): void {
    const c = this.corte;
    if (!c || !this.vistaInicialEstado) return;
    const n = new Vector3(...c.normal).normalize();
    const e = this.orbita.estado();
    const h = Math.hypot(n.x, n.y);
    if (h > 0.5) {
      const az = Math.atan2(-n.x, n.y) + 0.38;
      e.azimut = az;
      e.elevacion = Math.max(0.35, Math.min(e.elevacion, 0.75));
    } else if (n.z < 0) e.elevacion = Math.max(e.elevacion, 0.95);
    else e.elevacion = Math.min(e.elevacion, -0.2);
    this.orbita.ir(e, true);
  }

  ponerCorte(activo: boolean, pos?: number): void {
    this.corteActivo = activo && !!this.corte;
    if (pos != null && this.corte) this.posCorte = Math.max(this.corte.min, Math.min(this.corte.max, pos));
    this.aplicarCorte();
  }

  rangoCorte(): Corte | null {
    return this.corte;
  }

  private aplicarCorte(): void {
    const c = this.corte;
    if (!c || !this.corteActivo) {
      this.plano.set(new Vector3(0, 0, 1), 1e6);
      for (const t of this.tapas) t.visible = false;
      if (this.contorno) this.contorno.visible = false;
    } else {
      const n = new Vector3(...c.normal).normalize();
      this.plano.set(n, -this.posCorte);
      for (const t of this.tapas) t.visible = true;
      this.dibujarContorno(n);
    }
    this.pedir();
  }

  /** Thin outline of the cut plane across the model's box (shows where the cut is). */
  private dibujarContorno(n: Vector3): void {
    if (!this.modelo) return;
    if (!this.contorno) {
      const geo = new EdgesGeometry(new PlaneGeometry(1, 1));
      this.contorno = new LineSegments(geo, new LineBasicMaterial({ color: this.fondoOscuro ? '#7fb3e6' : '#2e6ea6', transparent: true, opacity: 0.7, depthTest: true }));
      this.contorno.userData.tapa = true;
      this.estudio.escena.add(this.contorno);
    }
    const caja = new Box3();
    // Box of the model without the explosion offsets would be nicer; the current box is good enough.
    caja.setFromObject(this.modelo);
    const tam = caja.getSize(new Vector3());
    const centro = caja.getCenter(new Vector3());
    const o = this.contorno;
    o.visible = true;
    o.position.copy(centro).addScaledVector(n, this.posCorte - n.dot(centro));
    o.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), n);
    const ax = Math.abs(n.x) > 0.5 ? [tam.y, tam.z] : Math.abs(n.y) > 0.5 ? [tam.x, tam.z] : [tam.x, tam.y];
    o.scale.set(ax[0]! * 1.08 + 0.4, ax[1]! * 1.08 + 0.4, 1);
    if (Math.abs(n.y) > 0.5) o.rotateZ(0);
  }

  // ------------------------------------------------------------------ explosion

  ponerExplosion(f: number, animar = true): void {
    this.explosionObjetivo = Math.max(0, Math.min(1, f));
    if (!animar || this.quieto) this.explosion = this.explosionObjetivo;
    this.aplicarExplosion();
    this.pedir();
  }

  private aplicarExplosion(): void {
    const e = this.explosion;
    // Ease so that small values separate the parts a little and 1 is the full offset.
    for (const [o, base] of this.bases) {
      const d = (o.userData as DatosParte).explosion!;
      o.position.set(base.x + d[0] * e, base.y + d[1] * e, base.z + d[2] * e);
    }
  }

  // ------------------------------------------------------------------ labels

  ponerEtiquetas(si: boolean): void {
    this.mostrarEtiquetas = si;
    this.pedir();
  }

  private crearEtiquetas(): void {
    for (const e of this.etiquetas) {
      e.el.remove();
      e.item?.remove();
      e.linea.remove();
      e.punto2.remove();
    }
    this.etiquetas = [];
    if (this.opc.leyenda) this.opc.leyenda.textContent = '';
    const g = this.modelo;
    if (!g) return;
    const ns = 'http://www.w3.org/2000/svg';
    g.traverse((o) => {
      const d = o.userData as DatosParte;
      if (!d.etiqueta) return;
      let interior = !!d.interior;
      for (let p = o.parent; p && p !== g; p = p.parent) if ((p.userData as DatosParte).interior) interior = true;
      const enl = d.etiqueta.ref ? this.opc.enlace?.(d.etiqueta.ref) : null;
      const n = String(this.etiquetas.length + 1);
      const contenido = (destino: HTMLElement) => {
        const t = document.createElement('span');
        t.className = 'texto';
        t.textContent = d.etiqueta!.texto;
        destino.append(t);
        if (enl) {
          const b = document.createElement('b');
          b.textContent = enl.num;
          destino.append(' ', b);
        }
      };
      const el = document.createElement(enl ? 'a' : 'span');
      el.className = 'etiqueta3d';
      el.dataset.parte = d.parte ?? o.name;
      if (interior) el.classList.add('interior');
      const num = document.createElement('i');
      num.className = 'n';
      num.textContent = n;
      el.append(num);
      contenido(el);
      if (enl) {
        (el as HTMLAnchorElement).href = enl.href;
        el.addEventListener('click', () => this.opc.alSeguir?.());
      }
      this.capa.appendChild(el);
      let item: HTMLLIElement | null = null;
      if (this.opc.leyenda) {
        item = document.createElement('li');
        item.value = Number(n);
        const a = document.createElement(enl ? 'a' : 'span');
        if (enl) {
          (a as HTMLAnchorElement).href = enl.href;
          a.addEventListener('click', () => this.opc.alSeguir?.());
        }
        contenido(a);
        item.append(a);
        this.opc.leyenda.append(item);
      }
      const linea = document.createElementNS(ns, 'line');
      const punto2 = document.createElementNS(ns, 'circle');
      punto2.setAttribute('r', '3.2');
      this.svg.append(linea, punto2);
      this.etiquetas.push({ obj: o, punto: new Vector3(...(d.etiqueta.punto ?? [0, 0, 0])), interior, visible: true, ancho: 0, alto: 0, el, item, linea, punto2 });
    });
  }

  private colocarEtiquetas(): void {
    const w = this.ancho;
    const h = this.alto;
    const dentro = this.corteActivo || this.explosion > 0.04;
    const compacto = w < 560;
    if (compacto !== this.compacto) {
      this.compacto = compacto;
      this.capa.classList.toggle('compacta', compacto);
      this.opc.leyenda?.classList.toggle('activa', compacto);
      for (const e of this.etiquetas) {
        e.ancho = e.alto = 0;
        e.linea.style.display = e.punto2.style.display = e.visible && !compacto ? '' : 'none';
      }
    }
    const v = new Vector3();
    const centro = new Vector3();
    if (this.modelo) new Box3().setFromObject(this.modelo).getCenter(centro).project(this.camara);
    const cx = (centro.x * 0.5 + 0.5) * w;
    const cy = (-centro.y * 0.5 + 0.5) * h;
    type Pos = { e: EtiquetaViva; ax: number; ay: number; x: number; y: number; lado: number; ancho: number; alto: number };
    const lista: Pos[] = [];
    // Visibility first (class changes only when they change), then one batch of size reads for the labels
    // that have not been measured yet: no layout thrashing per label and frame.
    const vivas: { e: EtiquetaViva; ax: number; ay: number }[] = [];
    for (const e of this.etiquetas) {
      let ver = this.mostrarEtiquetas && (!e.interior || dentro);
      let ax = 0;
      let ay = 0;
      if (ver) {
        v.copy(e.punto);
        e.obj.localToWorld(v);
        v.project(this.camara);
        ver = v.z <= 1;
        ax = (v.x * 0.5 + 0.5) * w;
        ay = (-v.y * 0.5 + 0.5) * h;
      }
      if (ver !== e.visible) {
        e.visible = ver;
        e.el.classList.toggle('oculta', !ver);
        e.linea.style.display = e.punto2.style.display = ver && !compacto ? '' : 'none';
        if (e.item) e.item.hidden = !ver;
      }
      if (ver) vivas.push({ e, ax, ay });
    }
    if (compacto) {
      // Narrow viewer: a numbered marker on each point, the text in the list under the canvas.
      for (const { e, ax, ay } of vivas) e.el.style.transform = `translate(${(ax - 11).toFixed(1)}px, ${(ay - 11).toFixed(1)}px)`;
      return;
    }
    for (const { e } of vivas)
      if (!e.ancho) {
        e.ancho = e.el.offsetWidth;
        e.alto = e.el.offsetHeight;
      }
    for (const { e, ax, ay } of vivas) lista.push({ e, ax, ay, x: 0, y: ay + (ay - cy) * 0.25, lado: ax >= cx ? 1 : -1, ancho: e.ancho, alto: e.alto });
    // Two columns (left and right of the model): sort by height, push apart downwards, then pull back up
    // from the bottom edge if needed, so that pills never overlap (unless there is no room at all).
    const margen = 8;
    for (const lado of [-1, 1]) {
      const col = lista.filter((p) => p.lado === lado).sort((a, b) => a.y - b.y);
      let borde = margen;
      for (const p of col) {
        p.y = Math.max(p.y, borde + p.alto / 2);
        borde = p.y + p.alto / 2 + 4;
      }
      borde = h - margen;
      for (let i = col.length - 1; i >= 0; i--) {
        const p = col[i]!;
        p.y = Math.min(p.y, borde - p.alto / 2);
        borde = p.y - p.alto / 2 - 4;
      }
      for (const p of col) {
        const fuera = Math.max(40, Math.abs(p.ax - cx) * 0.35 + 28);
        p.x = lado > 0 ? Math.min(w - margen - p.ancho, p.ax + fuera) : Math.max(margen, p.ax - fuera - p.ancho);
      }
    }
    for (const p of lista) {
      p.e.el.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y - p.alto / 2).toFixed(1)}px)`;
      const bx = p.lado > 0 ? p.x : p.x + p.ancho;
      p.e.linea.setAttribute('x1', p.ax.toFixed(1));
      p.e.linea.setAttribute('y1', p.ay.toFixed(1));
      p.e.linea.setAttribute('x2', bx.toFixed(1));
      p.e.linea.setAttribute('y2', p.y.toFixed(1));
      p.e.punto2.setAttribute('cx', p.ax.toFixed(1));
      p.e.punto2.setAttribute('cy', p.ay.toFixed(1));
    }
  }

  // ------------------------------------------------------------------ frames

  redimensionar(): void {
    const caja = this.lienzo.parentElement ?? this.lienzo;
    const w = Math.max(1, Math.round(caja.clientWidth));
    const h = Math.max(1, Math.round(caja.clientHeight));
    if (w === this.ancho && h === this.alto) return;
    this.ancho = w;
    this.alto = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.0e6 / (w * h)));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    for (const e of this.etiquetas) e.ancho = e.alto = 0;
    this.pedir();
  }

  /** Ask for a frame (coalesced; none while hidden or off screen). */
  pedir(): void {
    this.sucio = true;
    if (this.raf || this.liberado || !this.visible || !this.paginaVisible) return;
    this.raf = requestAnimationFrame(this.cuadro);
  }

  private cuadro = (ts: number): void => {
    this.raf = 0;
    if (this.liberado || !this.visible || !this.paginaVisible) return;
    let seguir = this.orbita.paso(ts);
    if (Math.abs(this.explosion - this.explosionObjetivo) > 1e-3) {
      this.explosion += (this.explosionObjetivo - this.explosion) * 0.22;
      if (Math.abs(this.explosion - this.explosionObjetivo) < 2e-3) this.explosion = this.explosionObjetivo;
      this.aplicarExplosion();
      if (this.corteActivo && this.corte) this.dibujarContorno(new Vector3(...this.corte.normal).normalize());
      seguir = true;
    }
    if (this.sucio || seguir) {
      this.sucio = false;
      const t0 = performance.now();
      this.renderer.render(this.estudio.escena, this.camara);
      const coste = performance.now() - t0;
      this.colocarEtiquetas();
      const g = globalThis as unknown as { __epa3d?: Stats };
      const st = (g.__epa3d ??= { n: 0, total: 0, max: 0, cuadro: 0, marcas: [], triangulos: 0, llamadas: 0 });
      st.n++;
      st.total += coste;
      st.cuadro += performance.now() - t0;
      st.max = Math.max(st.max, coste);
      st.marcas.push(ts);
      if (st.marcas.length > 600) st.marcas.splice(0, 300);
      st.triangulos = this.renderer.info.render.triangles;
      st.llamadas = this.renderer.info.render.calls;
    }
    if (seguir) this.raf = requestAnimationFrame(this.cuadro);
  };

  /** Current canvas as a PNG data URL (renders once into the drawing buffer first). */
  captura(): string {
    this.renderer.render(this.estudio.escena, this.camara);
    return this.lienzo.toDataURL('image/png');
  }

  liberar(): void {
    this.liberado = true;
    cancelAnimationFrame(this.raf);
    this.io.disconnect();
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.vis);
    this.lienzo.removeEventListener('webglcontextlost', this.perdido);
    this.lienzo.removeEventListener('webglcontextrestored', this.restaurado);
    this.orbita.liberar();
    this.quitarTapas();
    for (const m of this.matTapas.values()) m.dispose();
    for (const m of this.clonados) m.dispose();
    if (this.modelo) {
      this.estudio.raiz.remove(this.modelo);
      liberarModelo(this.modelo);
      this.modelo = null;
    }
    for (const e of this.etiquetas) {
      e.el.remove();
      e.item?.remove();
    }
    this.svg.remove();
    this.placa?.liberar();
    this.estudio.liberar();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
