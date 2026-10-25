// The 3D board: FR-4 core with its real thickness and holes, the two faces as textures painted from the
// board vectors (solder mask, copper under the mask, tinned/gold pads, silkscreen; a second map makes the
// exposed pads metallic), plated barrels in every plated hole (one instanced mesh), and the component bodies
// of the model library merged per material (a few draw calls whatever the part count). Layers can be
// exploded apart or seen through (X-ray: both copper layers through a translucent laminate).
// Rendered on demand only; everything created here is disposed by liberar().

import {
  BufferAttribute,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LinearMipmapLinearFilter,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  Path,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  Box3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  Box3Helper,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DatosPlaca, Huella } from './datos';
import { crearEstudio, type Estudio } from '../tres/motor/estudio';
import { Orbita, type EstadoOrbita } from '../tres/motor/orbita';
import type { Geometria, Lado } from './geometria';
import { coloresTension, pintarLado, pintarRed, type Acabado } from './pintar';
import { cargarBiblioteca, claveBiblioteca, CON_MARCADO_FIJO, cuerpoSimple, liberarMateriales, marcadoCoincide } from './modelos3d';

export interface Estadisticas {
  ms: number[];
  llamadas: number;
  triangulos: number;
  textura: number;
  piezas: { biblioteca: number; propias: number };
}

export interface CapasEscena {
  F: boolean;
  B: boolean;
  mascara: boolean;
  serigrafia: boolean;
  componentes: boolean;
}

type Vista = 'iso' | 'arriba' | 'abajo' | 'lado';

const EPS = 0.035;

export class Escena3D {
  readonly renderer: WebGLRenderer;
  private estudio: Estudio;
  private camara = new PerspectiveCamera(32, 1, 0.1, 4000);
  private orbita: Orbita;
  private placa = new Group();
  private nucleo: Mesh;
  private matNucleo: MeshStandardMaterial;
  private caras: Record<Lado, Mesh>;
  private matCaras: Record<Lado, MeshStandardMaterial>;
  private texCaras: Partial<Record<Lado, { color: CanvasTexture; pbr: CanvasTexture }>> = {};
  private realce: Record<Lado, Mesh>;
  private texRealce: Record<Lado, CanvasTexture | null> = { F: null, B: null };
  private barriles: InstancedMesh | null = null;
  private piezas = new Group();
  private cajas: { h: number; caja: Box3 }[] = [];
  private seleccion: Box3Helper | null = null;
  private capasX: Mesh[] = [];
  private liberables: { dispose(): void }[] = [];
  private W: number;
  private H: number;
  private t: number;
  private raf = 0;
  private sucio = true;
  private vivo = true;
  private ladoArriba: Lado = 'F';
  private giro = { de: 0, a: 0, t0: 0 };
  private explosion = 0;
  private explosionObjetivo = 0;
  private opc: { capas: CapasEscena; acabado: Acabado; rayosX: boolean; tensiones: boolean; red: number | null } = {
    capas: { F: true, B: true, mascara: true, serigrafia: true, componentes: true },
    acabado: 'hasl',
    rayosX: false,
    tensiones: false,
    red: null,
  };
  readonly stats: Estadisticas = { ms: [], llamadas: 0, triangulos: 0, textura: 0, piezas: { biblioteca: 0, propias: 0 } };
  private ladoTextura: number;
  private recursos: { liberar(): void } | null = null;
  private ajustada = false;
  /** Height of the tallest part (mm), for framing. */
  private altoMax = 6;
  /** Set by the view on the first pointer or wheel interaction: then the camera is the user's. */
  tocada = false;
  private blindajes: { o: Object3D; caja: Box3; mat: MeshStandardMaterial }[] = [];
  alCambiar: () => void = () => {};

  constructor(
    lienzo: HTMLCanvasElement,
    private d: DatosPlaca,
    private g: Geometria,
    oscuro: boolean,
  ) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new WebGLRenderer({ canvas: lienzo, antialias: dpr < 2, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.estudio = crearEstudio(this.renderer);
    this.estudio.ponerFondo(oscuro ? '#15191e' : '#e9e6de', oscuro);
    this.W = d.placa.ancho / 100;
    this.H = d.placa.alto / 100;
    this.t = d.placa.grosor;
    const max = this.renderer.capabilities.maxTextureSize;
    // texture resolution: up to 4096 px on the long side (about 21–37 px/mm on these boards)
    this.ladoTextura = Math.min(4096, max);
    this.estudio.raiz.add(this.placa);
    this.estudio.ajustarSombra(this.W * 1.05, this.H * 1.05, -this.t - 0.6);

    // core: the outline extruded with every hole
    const forma = this.formaContorno(true);
    const geoN = new ExtrudeGeometry(forma, { depth: this.t - 2 * EPS, bevelEnabled: false, curveSegments: 8 });
    geoN.translate(0, 0, -this.t + EPS);
    this.matNucleo = new MeshStandardMaterial({ color: '#cdbb84', roughness: 0.75, metalness: 0, transparent: false });
    this.nucleo = new Mesh(geoN, this.matNucleo);
    this.placa.add(this.nucleo);
    this.liberables.push(geoN, this.matNucleo);

    // faces: flat outline with UVs over the board, holes from the texture's alpha
    const geoC = new ShapeGeometry(this.formaContorno(false), 1);
    this.uvPlaca(geoC);
    this.liberables.push(geoC);
    const cara = (lado: Lado): [Mesh, MeshStandardMaterial] => {
      const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 1, alphaTest: 0.5, side: lado === 'F' ? 0 : 1 });
      const me = new Mesh(geoC, m);
      me.position.z = lado === 'F' ? 0 : -this.t;
      this.placa.add(me);
      this.liberables.push(m);
      return [me, m];
    };
    const [mf, matf] = cara('F');
    const [mb, matb] = cara('B');
    this.caras = { F: mf, B: mb };
    this.matCaras = { F: matf, B: matb };
    // highlight overlays (selected net, voltages), just above each face
    const overlay = (lado: Lado): Mesh => {
      const m = new MeshBasicMaterial({ transparent: true, depthWrite: false, side: lado === 'F' ? 0 : 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const me = new Mesh(geoC, m);
      me.position.z = lado === 'F' ? 0.01 : -this.t - 0.01;
      me.visible = false;
      me.renderOrder = 2;
      this.placa.add(me);
      this.liberables.push(m);
      return me;
    };
    this.realce = { F: overlay('F'), B: overlay('B') };
    this.construirBarriles();
    this.placa.add(this.piezas);

    this.orbita = new Orbita(this.camara, lienzo, () => this.pedir(), () => matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.orbita.maxDist = Math.max(this.W, this.H) * 6;
    this.orbita.minDist = 6;
    this.orbita.alReiniciar = () => this.vista('iso');
    this.vista('iso', false);
    this.pintarCaras();
  }

  // ---------------------------------------------------------------- geometry

  /** Board point (u) → model coordinates (mm, y up, origin at the board centre). */
  private p(x: number, y: number): [number, number] {
    return [x / 100 - this.W / 2, this.H / 2 - y / 100];
  }

  private formaContorno(conTaladros: boolean): Shape {
    const pts = this.g.contornoPts;
    const s = new Shape();
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = this.p(pts[i]!, pts[i + 1]!);
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    if (conTaladros) {
      const hueco = (x: number, y: number, r: number) => {
        const h = new Path();
        const n = r > 1 ? 20 : 10;
        for (let k = 0; k < n; k++) {
          const a = (-2 * Math.PI * k) / n;
          const px = x + r * Math.cos(a);
          const py = y + r * Math.sin(a);
          if (k === 0) h.moveTo(px, py);
          else h.lineTo(px, py);
        }
        s.holes.push(h);
      };
      for (const [x, y, w, h] of this.g.barriles) {
        const [X, Y] = this.p(x, y);
        hueco(X, Y, Math.max(w, h) / 200);
      }
      for (const p of this.d.pads) {
        if (p[11] & 8 && p[9] > 0) {
          const [X, Y] = this.p(p[3], p[4]);
          hueco(X, Y, p[9] / 200);
        }
      }
    }
    return s;
  }

  private uvPlaca(geo: BufferGeometry): void {
    const pos = geo.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[2 * i] = (pos.getX(i) + this.W / 2) / this.W;
      uv[2 * i + 1] = (pos.getY(i) + this.H / 2) / this.H;
    }
    geo.setAttribute('uv', new BufferAttribute(uv, 2));
  }

  private construirBarriles(): void {
    const n = this.g.barriles.length;
    if (!n) return;
    const geo = new CylinderGeometry(1, 1, 1, 14, 1, true);
    geo.rotateX(Math.PI / 2);
    const mat = new MeshStandardMaterial({ color: '#cfd3d6', roughness: 0.3, metalness: 1, side: DoubleSide });
    const im = new InstancedMesh(geo, mat, n);
    const m = new Matrix4();
    this.g.barriles.forEach(([x, y, w, h], i) => {
      const [X, Y] = this.p(x, y);
      const r = Math.max(w, h) / 200;
      m.makeScale(r, r, this.t);
      m.setPosition(X, Y, -this.t / 2);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
    this.barriles = im;
    this.placa.add(im);
    this.liberables.push(geo, mat);
  }

  // ---------------------------------------------------------------- textures

  private lienzoTextura(escala = 1): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; s: number } {
    const lado = Math.round(this.ladoTextura * escala);
    const s = lado / Math.max(this.d.placa.ancho, this.d.placa.alto);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.d.placa.ancho * s));
    c.height = Math.max(1, Math.round(this.d.placa.alto * s));
    const ctx = c.getContext('2d')!;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    return { c, ctx, s };
  }

  /** Texture uploaded to the GPU at once, then the canvas is released (its memory is not kept twice). */
  private textura(c: HTMLCanvasElement, srgb: boolean): CanvasTexture {
    const t = new CanvasTexture(c);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    this.renderer.initTexture(t);
    c.width = c.height = 0;
    return t;
  }

  /** Paints both faces (colour and metal/roughness maps). */
  pintarCaras(): void {
    const t0 = performance.now();
    const cap = this.opc.capas;
    for (const lado of ['F', 'B'] as const) {
      const { c, ctx, s } = this.lienzoTextura();
      pintarLado(ctx, this.d, this.g, {
        lado,
        aspecto: 'real',
        acabado: this.opc.acabado,
        visibles: { F: cap.F, B: cap.B, mascara: cap.mascara, serigrafia: cap.serigrafia, fab: false, areas: false },
        mascara: this.d.placa.mascara,
        escala: s,
        textura: true,
      });
      // metal (blue) and roughness (green): glossy mask, matt silkscreen, metallic exposed pads
      const pb = this.lienzoTextura(0.5);
      const k = pb.ctx;
      k.save();
      k.clip(this.g.contorno);
      k.fillStyle = cap.mascara ? 'rgb(0,92,0)' : 'rgb(0,200,0)';
      k.fill(this.g.contorno);
      if (cap[lado]) {
        k.save();
        if (cap.mascara) k.clip(this.g.aberturas[lado], 'nonzero');
        k.fillStyle = 'rgb(0,80,255)';
        for (const m of [this.g.cobre[lado].pads, this.g.cobre[lado].vias, this.g.cobre[lado].zonas]) for (const p of m.values()) k.fill(p, 'evenodd');
        k.strokeStyle = 'rgb(0,80,255)';
        for (const [w, porRed] of this.g.cobre[lado].pistas) {
          k.lineWidth = w;
          for (const p of porRed.values()) k.stroke(p);
        }
        k.restore();
      }
      if (cap.serigrafia && this.g.serigrafia[lado]) {
        k.strokeStyle = 'rgb(0,225,0)';
        k.fillStyle = 'rgb(0,225,0)';
        for (const [w, p] of this.g.serigrafia[lado]!.trazos) {
          k.lineWidth = w;
          k.stroke(p);
        }
        k.fill(this.g.serigrafia[lado]!.rellenos);
      }
      k.restore();
      const viejo = this.texCaras[lado];
      viejo?.color.dispose();
      viejo?.pbr.dispose();
      const tc = this.textura(c, true);
      const tp = this.textura(pb.c, false);
      this.texCaras[lado] = { color: tc, pbr: tp };
      const m = this.matCaras[lado];
      m.map = tc;
      m.roughnessMap = tp;
      m.metalnessMap = tp;
      m.needsUpdate = true;
    }
    this.stats.textura = performance.now() - t0;
    this.pintarRealce();
    this.pedir();
  }

  /** Selected net (orange) and DC voltages (colours) over each face. */
  pintarRealce(): void {
    const colores = this.opc.tensiones ? coloresTension(this.d) : null;
    for (const lado of ['F', 'B'] as const) {
      const red = this.opc.red;
      const me = this.realce[lado];
      this.texRealce[lado]?.dispose();
      this.texRealce[lado] = null;
      if ((red === null || red < 0) && !colores) {
        me.visible = false;
        continue;
      }
      const { c, ctx } = this.lienzoTextura(0.5);
      const vis = { F: lado === 'F', B: lado === 'B', mascara: true, serigrafia: false, fab: false, areas: false };
      if (colores) for (const [r, col] of colores) pintarRed(ctx, this.g, r, { lado, aspecto: 'real', visibles: vis }, col);
      if (red !== null && red >= 0) pintarRed(ctx, this.g, red, { lado, aspecto: 'real', visibles: vis }, '#ffb02e');
      const t = this.textura(c, true);
      this.texRealce[lado] = t;
      const m = me.material as MeshBasicMaterial;
      m.map = t;
      m.opacity = 0.92;
      m.needsUpdate = true;
      me.visible = true;
    }
    this.pedir();
  }

  // ---------------------------------------------------------------- components

  async cargarPiezas(): Promise<void> {
    const lib = await cargarBiblioteca();
    if (!this.vivo) return;
    const rec = lib ? new lib.Recursos() : null;
    const disponibles = new Set(lib?.tiposDisponibles?.() ?? []);
    const grupos: Object3D[] = [];
    this.d.huellas.forEach((h, i) => {
      if (h.t === 'mec' || h.dnp) return;
      const o = this.pieza(h, lib, rec, disponibles);
      if (!o) return;
      o.updateMatrixWorld(true);
      const b = new Box3().setFromObject(o);
      if (!b.isEmpty()) this.cajas.push({ h: i, caja: b });
      if (h.m.tipo === 'blindaje') {
        // shielding cans stay apart: they turn translucent when the selected part is under them
        const mat = new MeshStandardMaterial({ color: '#c9cdd1', roughness: 0.32, metalness: 0.9, transparent: true, opacity: 1 });
        o.traverse((x) => {
          if ((x as Mesh).isMesh) (x as Mesh).material = mat;
        });
        this.liberables.push(mat);
        this.blindajes.push({ o, caja: b, mat });
        this.piezas.add(o);
        return;
      }
      grupos.push(o);
    });
    this.fusionar(grupos);
    for (const c of this.cajas) this.altoMax = Math.max(this.altoMax, c.caja.max.z);
    if (!this.tocada) this.vista('iso', false);
    // the library's shared resources (materials, label textures) stay in use by the merged meshes
    this.recursos = rec;
    this.pedir();
  }

  private pieza(h: Huella, lib: Awaited<ReturnType<typeof cargarBiblioteca>>, rec: unknown, disp: Set<string>): Object3D | null {
    const raiz = new Group();
    const [X, Y] = this.p(h.x, h.y);
    raiz.position.set(X, Y, h.lado === 'F' ? 0 : -this.t);
    raiz.rotation.z = (h.a * Math.PI) / 180;
    if (h.lado === 'B') raiz.rotation.x = Math.PI;
    let cuerpo: Object3D | null = null;
    const clave = lib ? claveBiblioteca(h) : null;
    if (lib && clave && (!disp.size || disp.has(clave.tipo))) {
      try {
        const m = lib.crearModelo(clave.tipo, clave.p, { recursos: rec, detalle: 'bajo', grosorPlaca: this.t });
        // never show someone else's marking (the library knows a fixed set of discrete parts)
        if (CON_MARCADO_FIJO.has(clave.tipo) && !marcadoCoincide(m.userData.marcado, h.v)) throw new Error('marcado');
        const hu = m.userData.huella as { ancho: number; fondo: number; origenKicad: [number, number]; pads?: { n: string; x: number; y: number }[] } | undefined;
        if (hu) {
          // put the model's pad 1 on the footprint's pad 1 (or use its KiCad origin)
          let ox = hu.origenKicad?.[0] ?? 0;
          let oy = hu.origenKicad?.[1] ?? 0;
          const [a] = h.pads;
          const p1 = this.d.pads[a];
          const m1 = hu.pads?.find((p) => p.n === '1');
          if (p1 && m1 && h.pads[1] > 0) {
            // footprint-local position of pad 1 (u, KiCad axes) from its board position
            const an = (-h.a * Math.PI) / 180;
            const dx = p1[3] - h.x;
            const dy = p1[4] - h.y;
            const lx = (dx * Math.cos(an) + dy * Math.sin(an)) / 100;
            const ly = (-dx * Math.sin(an) + dy * Math.cos(an)) / 100;
            ox = m1.x - lx;
            oy = m1.y + ly;
          }
          m.position.set(-ox, -oy, 0);
          // a model much smaller or larger than the footprint body (other package size): scale it to fit
          const [x0, y0, x1, y1] = h.m.caja;
          const fw = x1 - x0;
          const fd = y1 - y0;
          if (hu.ancho > 0 && hu.fondo > 0 && fw > 0 && fd > 0) {
            const f = Math.sqrt((fw * fd) / (hu.ancho * hu.fondo));
            if (f > 1.35 || f < 0.7) m.scale.setScalar(f);
          }
        }
        cuerpo = m;
        this.stats.piezas.biblioteca++;
      } catch {
        cuerpo = null;
      }
    }
    if (!cuerpo) {
      cuerpo = cuerpoSimple(h);
      this.stats.piezas.propias++;
    }
    raiz.add(cuerpo);
    raiz.userData.ref = h.r;
    return raiz;
  }

  /** Merges every component mesh by material: a few draw calls for the whole board. */
  private fusionar(grupos: Object3D[]): void {
    const porMat = new Map<Material, BufferGeometry[]>();
    const tmp = new Matrix4();
    for (const gr of grupos) {
      gr.updateMatrixWorld(true);
      gr.traverse((o) => {
        const me = o as Mesh;
        if (!me.isMesh || !me.visible) return;
        const base = me.geometry.index ? me.geometry.toNonIndexed() : me.geometry.clone();
        for (const k of Object.keys(base.attributes)) if (!['position', 'normal', 'uv'].includes(k)) base.deleteAttribute(k);
        if (!base.getAttribute('normal')) base.computeVertexNormals();
        if (!base.getAttribute('uv')) base.setAttribute('uv', new BufferAttribute(new Float32Array(base.getAttribute('position').count * 2), 2));
        // one piece per material (multi-material meshes are split by their groups)
        const piezas: [Material, BufferGeometry][] = [];
        if (Array.isArray(me.material)) {
          for (const gr2 of base.groups) {
            const m2 = me.material[gr2.materialIndex ?? 0];
            if (m2) piezas.push([m2, subGeometria(base, gr2.start, gr2.count)]);
          }
          base.dispose();
        } else {
          base.clearGroups();
          piezas.push([me.material, base]);
        }
        const im = (me as InstancedMesh).isInstancedMesh ? (me as InstancedMesh) : null;
        for (const [mat, geo] of piezas) {
          const lista = porMat.get(mat) ?? [];
          if (im) {
            for (let i = 0; i < im.count; i++) {
              im.getMatrixAt(i, tmp);
              const g2 = geo.clone();
              g2.applyMatrix4(new Matrix4().multiplyMatrices(im.matrixWorld, tmp));
              lista.push(g2);
            }
            geo.dispose();
          } else {
            geo.applyMatrix4(me.matrixWorld);
            lista.push(geo);
          }
          porMat.set(mat, lista);
        }
      });
    }
    // the merged meshes live in the board group: undo its world transform (identity at build time)
    for (const [mat, geos] of porMat) {
      const g = mergeGeometries(geos, false);
      for (const x of geos) x.dispose();
      if (!g) continue;
      const me = new Mesh(g, mat);
      me.matrixAutoUpdate = false;
      this.piezas.add(me);
      this.liberables.push(g);
    }
  }

  // ---------------------------------------------------------------- explode and X-ray

  private capasExplosion(): void {
    if (this.capasX.length) return;
    const geo = this.caras.F.geometry;
    const plano = (pintar: (ctx: CanvasRenderingContext2D, s: number) => void, z: number, lado: Lado, opacidad = 1): Mesh => {
      const { c, ctx, s } = this.lienzoTextura(0.4);
      pintar(ctx, s);
      const t = this.textura(c, true);
      const m = new MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.05, side: DoubleSide, roughness: 0.6, metalness: 0, opacity: opacidad, depthWrite: false });
      const me = new Mesh(geo, m);
      me.userData.z = z;
      me.userData.lado = lado;
      me.visible = false;
      this.placa.add(me);
      this.liberables.push(t, m);
      this.capasX.push(me);
      return me;
    };
    const cobre = (lado: Lado) => (ctx: CanvasRenderingContext2D, s: number) =>
      pintarLado(ctx, this.d, this.g, { lado, aspecto: 'real', acabado: 'hasl', visibles: { F: true, B: true, mascara: false, serigrafia: false, fab: false, areas: false }, mascara: 'verde', escala: s, soloCobre: true });
    const mascara = (lado: Lado) => (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = 'rgba(29,110,55,0.72)';
      ctx.fill(this.g.contorno);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill(this.g.aberturas[lado], 'nonzero');
      ctx.fill(this.g.taladros, 'nonzero');
    };
    const seri = (lado: Lado) => (ctx: CanvasRenderingContext2D) => {
      const s = this.g.serigrafia[lado];
      if (!s) return;
      ctx.strokeStyle = '#f5f5ef';
      ctx.fillStyle = '#f5f5ef';
      ctx.lineCap = 'round';
      for (const [w, p] of s.trazos) {
        ctx.lineWidth = w;
        ctx.stroke(p);
      }
      ctx.fill(s.rellenos);
    };
    // X-ray: tracks, pads and vias solid, copper pours faint, so the other face shows through
    const xray = (lado: Lado) => (ctx: CanvasRenderingContext2D) => {
      const c = this.g.cobre[lado];
      const col = lado === 'F' ? '255,90,74' : '90,150,255';
      ctx.save();
      ctx.clip(this.g.contorno);
      ctx.fillStyle = `rgba(${col},0.16)`;
      for (const z of c.zonas.values()) ctx.fill(z, 'evenodd');
      ctx.strokeStyle = `rgb(${col})`;
      ctx.fillStyle = `rgb(${col})`;
      ctx.lineCap = 'round';
      for (const [w, porRed] of c.pistas) {
        ctx.lineWidth = w;
        for (const p of porRed.values()) ctx.stroke(p);
      }
      for (const m of [c.pads, c.vias]) for (const p of m.values()) ctx.fill(p);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill(this.g.taladros, 'nonzero');
      ctx.restore();
    };
    plano(xray('F'), 1, 'F').userData.tipo = 'xray';
    plano(xray('B'), -1, 'B').userData.tipo = 'xray';
    plano(cobre('F'), 1, 'F').userData.tipo = 'cobre';
    plano(cobre('B'), -1, 'B').userData.tipo = 'cobre';
    plano(mascara('F'), 2, 'F').userData.tipo = 'mascara';
    plano(mascara('B'), -2, 'B').userData.tipo = 'mascara';
    plano(seri('F'), 3, 'F').userData.tipo = 'serigrafia';
    plano(seri('B'), -3, 'B').userData.tipo = 'serigrafia';
  }

  /** Applies explosion (0–1), X-ray and layer toggles to the visible objects. */
  private aplicarCapas(): void {
    const e = this.explosion;
    const rx = this.opc.rayosX;
    const cap = this.opc.capas;
    const separado = e > 0.001 || rx;
    if (separado) this.capasExplosion();
    this.caras.F.visible = !separado;
    this.caras.B.visible = !separado;
    this.realce.F.visible = !separado && !!this.texRealce.F;
    this.realce.B.visible = !separado && !!this.texRealce.B;
    const paso = Math.max(10, Math.max(this.W, this.H) * 0.1) * e;
    for (const me of this.capasX) {
      const tipo = me.userData.tipo as string;
      const lado = me.userData.lado as Lado;
      const z = me.userData.z as number;
      let vis = separado && !rx && cap[lado];
      if (tipo === 'xray') vis = rx && cap[lado];
      if (tipo === 'mascara') vis = separado && !rx && cap.mascara;
      if (tipo === 'serigrafia') vis = separado && !rx && cap.serigrafia;
      me.visible = vis;
      me.position.z = (lado === 'F' ? 0.02 : -this.t - 0.02) + Math.sign(z) * (Math.abs(z) - 1) * paso * 0.9 + Math.sign(z) * paso * 0.4;
      const m = me.material as MeshStandardMaterial;
      if (tipo === 'xray') m.alphaTest = 0.01;
    }
    this.matNucleo.transparent = rx;
    this.matNucleo.opacity = rx ? 0.18 : 1;
    this.matNucleo.depthWrite = !rx;
    this.matNucleo.needsUpdate = true;
    this.piezas.visible = cap.componentes && !rx;
    this.piezas.position.z = paso * 3.2;
    if (this.seleccion) this.seleccion.visible = !rx;
    this.pedir();
  }

  // ---------------------------------------------------------------- public controls

  opciones(o: Partial<typeof this.opc>): void {
    const antes = { ...this.opc, capas: { ...this.opc.capas } };
    Object.assign(this.opc, o);
    if (o.capas) this.opc.capas = { ...o.capas };
    const c0 = antes.capas;
    const c1 = this.opc.capas;
    if (c0.F !== c1.F || c0.B !== c1.B || c0.mascara !== c1.mascara || c0.serigrafia !== c1.serigrafia || antes.acabado !== this.opc.acabado) this.pintarCaras();
    else if (antes.red !== this.opc.red || antes.tensiones !== this.opc.tensiones) this.pintarRealce();
    this.aplicarCapas();
  }

  explotar(f: number): void {
    this.explosionObjetivo = f;
    this.pedir();
  }

  seleccionar(h: number | null): void {
    if (this.seleccion) {
      this.placa.remove(this.seleccion);
      this.seleccion.geometry.dispose();
      (this.seleccion.material as Material).dispose();
      this.seleccion = null;
    }
    const c = h === null ? null : this.cajas.find((x) => x.h === h);
    for (const b of this.blindajes) {
      const debajo = !!c && c.h !== this.cajas.find((x) => x.caja === b.caja)?.h && b.caja.intersectsBox(c.caja);
      b.mat.opacity = debajo ? 0.22 : 1;
      b.mat.depthWrite = !debajo;
    }
    if (c) {
      const b = c.caja.clone().expandByScalar(0.4);
      this.seleccion = new Box3Helper(b, new Color('#ffb02e'));
      (this.seleccion.material as Material).depthTest = false;
      this.seleccion.renderOrder = 5;
      this.placa.add(this.seleccion);
    }
    this.pedir();
  }

  /** Camera presets; «abajo» turns the board over (as one does with a real board). */
  vista(v: Vista, animar = true): void {
    const lado: Lado = v === 'abajo' ? 'B' : 'F';
    if (lado !== this.ladoArriba) {
      this.ladoArriba = lado;
      this.giro = { de: this.placa.rotation.y, a: lado === 'B' ? Math.PI : 0, t0: performance.now() };
    }
    // fit the board in the window (aspect-aware), a little margin
    const r = Math.max(this.W / Math.max(0.3, this.camara.aspect), this.H) * (v === 'iso' ? 1.15 : 1.08) + (v === 'iso' ? this.altoMax * 0.8 : 0);
    const d = r / (2 * Math.tan((this.camara.fov * Math.PI) / 360)) + 6;
    const e: EstadoOrbita = {
      azimut: v === 'iso' ? -0.5 : 0,
      elevacion: v === 'iso' ? 0.72 : v === 'lado' ? 0.06 : 1.52,
      distancia: v === 'lado' ? d * 0.75 : d,
      objetivo: new Vector3(0, v === 'iso' ? -this.H * 0.06 : 0, v === 'lado' ? 2 : v === 'iso' ? this.altoMax * 0.3 : 0),
    };
    this.orbita.ir(e, animar);
    this.pedir();
  }

  /** Frames a part or a net (board box in u). */
  enfocar(b: [number, number, number, number]): void {
    const [x0, y0] = this.p(b[0], b[1]);
    const [x1, y1] = this.p(b[2], b[3]);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const r = Math.max(8, Math.abs(x1 - x0), Math.abs(y1 - y0));
    const s = this.orbita.estado();
    const flip = this.ladoArriba === 'B' ? -1 : 1;
    // the part and its surroundings fill about a third of the window, whatever its shape
    const vis = Math.max(r, r / Math.max(0.3, this.camara.aspect)) * 3.2;
    const dist = vis / (2 * Math.tan((this.camara.fov * Math.PI) / 360));
    this.orbita.ir({ ...s, distancia: Math.max(this.orbita.minDist, dist), objetivo: new Vector3(cx * flip, cy, 2 * flip) }, true);
  }

  tamano(w: number, h: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // at most about 2.4 Mpx drawn (Iris Plus 640 at 1280 × 800, DPR 2)
    const k = Math.min(dpr, Math.sqrt(2.4e6 / Math.max(1, w * h)));
    this.renderer.setPixelRatio(k);
    this.renderer.setSize(w, h, false);
    const primera = this.camara.aspect === 1 && !this.ajustada;
    this.camara.aspect = w / Math.max(1, h);
    this.camara.updateProjectionMatrix();
    if (primera) {
      this.ajustada = true;
      this.vista('iso', false);
    }
    this.pedir();
  }

  // ---------------------------------------------------------------- picking

  private ray = new Raycaster();

  /**
   * What is under the pointer: a part (its body box) or a point of a face (board coordinates in u and the
   * face), whichever is nearest.
   */
  tocar(px: number, py: number, w: number, h: number): { huella: number } | { x: number; y: number; lado: Lado } | null {
    this.ray.setFromCamera(new Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1), this.camara);
    this.placa.updateMatrixWorld(true);
    const inv = new Matrix4().copy(this.placa.matrixWorld).invert();
    const r = this.ray.ray.clone().applyMatrix4(inv);
    let mejor: { d: number; res: { huella: number } | { x: number; y: number; lado: Lado } } | null = null;
    if (this.piezas.visible) {
      const desp = new Vector3(0, 0, this.piezas.position.z);
      let area = Infinity;
      for (const c of this.cajas) {
        const b = c.caja.clone().translate(desp);
        const p = r.intersectBox(b, new Vector3());
        if (!p) continue;
        const dd = p.distanceTo(r.origin);
        const sz = b.getSize(new Vector3());
        const a = sz.x * sz.y;
        // nearest box; among overlapping ones, the smallest
        if (!mejor || dd < mejor.d - 0.5 || (Math.abs(dd - mejor.d) <= 0.5 && a < area)) {
          mejor = { d: dd, res: { huella: c.h } };
          area = a;
        }
      }
    }
    for (const lado of ['F', 'B'] as const) {
      const z = lado === 'F' ? 0 : -this.t;
      if (Math.abs(r.direction.z) < 1e-6) continue;
      const t = (z - r.origin.z) / r.direction.z;
      if (t <= 0) continue;
      const q = r.origin.clone().addScaledVector(r.direction, t);
      // only the face turned towards the camera
      if ((lado === 'F') !== r.direction.z < 0) continue;
      const x = (q.x + this.W / 2) * 100;
      const y = (this.H / 2 - q.y) * 100;
      if (x < 0 || y < 0 || x > this.d.placa.ancho || y > this.d.placa.alto) continue;
      if (!mejor || t < mejor.d) mejor = { d: t, res: { x, y, lado } };
    }
    return mejor?.res ?? null;
  }

  /** Screen position (CSS px) of a part's top, for the label. */
  proyectar(h: number, w: number, hh: number): [number, number] | null {
    const c = this.cajas.find((x) => x.h === h);
    if (!c || !this.piezas.visible) return null;
    const p = c.caja.getCenter(new Vector3());
    p.z = c.caja.max.z + this.piezas.position.z;
    this.placa.updateMatrixWorld(true);
    p.applyMatrix4(this.placa.matrixWorld).project(this.camara);
    if (p.z > 1) return null;
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * hh];
  }

  // ---------------------------------------------------------------- rendering on demand

  pedir(): void {
    this.sucio = true;
    if (!this.raf && this.vivo) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private frame(ahora: number): void {
    this.raf = 0;
    if (!this.vivo) return;
    let mas = this.orbita.paso(ahora);
    // board turn-over
    if (this.placa.rotation.y !== this.giro.a) {
      const u = Math.min(1, (ahora - this.giro.t0) / 520);
      const e = 1 - (1 - u) ** 3;
      this.placa.rotation.y = this.giro.de + (this.giro.a - this.giro.de) * e;
      this.placa.position.z = this.giro.a ? this.t * e : this.t * (1 - e);
      if (u >= 1) this.placa.rotation.y = this.giro.a;
      mas = true;
    }
    if (Math.abs(this.explosion - this.explosionObjetivo) > 1e-3) {
      const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.explosion = quieto ? this.explosionObjetivo : this.explosion + (this.explosionObjetivo - this.explosion) * 0.2;
      if (Math.abs(this.explosion - this.explosionObjetivo) <= 1e-3) this.explosion = this.explosionObjetivo;
      this.aplicarCapas();
      mas = true;
    }
    if (this.sucio || mas) {
      const t0 = performance.now();
      this.renderer.render(this.estudio.escena, this.camara);
      const ms = performance.now() - t0;
      this.stats.ms.push(ms);
      if (this.stats.ms.length > 300) this.stats.ms.splice(0, 150);
      this.stats.llamadas = this.renderer.info.render.calls;
      this.stats.triangulos = this.renderer.info.render.triangles;
      this.sucio = false;
      this.alCambiar();
    }
    if (mas) this.pedir();
  }

  liberar(): void {
    this.vivo = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.orbita.liberar();
    for (const x of this.liberables) x.dispose();
    for (const l of ['F', 'B'] as const) {
      this.texCaras[l]?.color.dispose();
      this.texCaras[l]?.pbr.dispose();
      this.texRealce[l]?.dispose();
    }
    this.barriles?.dispose();
    this.seleccion?.geometry.dispose();
    this.estudio.liberar();
    this.recursos?.liberar();
    liberarMateriales();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** Vertices [start, start + count) of a non-indexed geometry. */
function subGeometria(g: BufferGeometry, start: number, count: number): BufferGeometry {
  const out = g.clone();
  for (const k of Object.keys(g.attributes)) {
    const a = g.getAttribute(k);
    const arr = (a.array as Float32Array).slice(start * a.itemSize, (start + count) * a.itemSize);
    out.setAttribute(k, new BufferAttribute(arr, a.itemSize));
  }
  out.clearGroups();
  return out;
}
