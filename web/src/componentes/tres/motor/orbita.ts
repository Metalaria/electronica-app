// Orbit camera for a Z-up scene, written for render-on-demand: it never runs its own loop, it only reports
// `cambio()` when the camera moved and whether it still needs frames (inertia, animated reset).
//   Mouse/trackpad: drag rotates; right button, Shift + drag or middle button pans; wheel zooms when the
//   viewer has the focus, or with Ctrl/⌘ (trackpad pinch arrives as Ctrl + wheel).
//   Touch: one finger rotates, two fingers pinch-zoom and pan.
//   Keyboard (focused canvas): arrows rotate, Shift + arrows pan, + / − zoom, 0 or Inicio resets.

import { PerspectiveCamera, Spherical, Vector3 } from 'three';

export interface EstadoOrbita {
  azimut: number;
  elevacion: number;
  distancia: number;
  objetivo: Vector3;
}

export class Orbita {
  azimut = -1.1;
  elevacion = 0.55;
  distancia = 40;
  objetivo = new Vector3();
  minDist = 2;
  maxDist = 400;
  private vAz = 0;
  private vEl = 0;
  private punteros = new Map<number, { x: number; y: number }>();
  private modo: 'rotar' | 'desplazar' | 'pellizco' | null = null;
  private pellizco = { d: 0, cx: 0, cy: 0 };
  private ultimoMov = 0;
  private transicion: { de: EstadoOrbita; a: EstadoOrbita; t0: number; dur: number } | null = null;
  private quitar: (() => void)[] = [];
  /** Set by the viewer: focused element gets plain-wheel zoom. */
  enfocado = false;
  /**
   * Set by the viewer: the sphere holding everything drawn (model at full explosion, board, shadow), for a
   * near/far range as tight as it can be (depth precision: mobile GPUs may have 16-bit depth buffers), and
   * the sphere the camera never enters (the model at rest). Without them, a generic range is used.
   */
  escena: { centro: Vector3; radio: number } | null = null;
  solido: { centro: Vector3; radio: number } | null = null;

  /** True from a pointer move of more than a few pixels until the next press (labels ignore that click). */
  arrastrado = false;
  /** performance.now() of the last camera change (0.8: the views lower their resolution while it moves). */
  ultimoCambio = 0;
  private inicio = { x: 0, y: 0 };

  /**
   * `zona`: the element around the canvas whose overlays (labels, hints) must also turn, pinch and wheel the
   * model instead of the page (a pinch that starts on a label zoomed the whole page on Android).
   */
  constructor(
    private camara: PerspectiveCamera,
    private elemento: HTMLElement,
    private cambio: () => void,
    private quieto: () => boolean,
    private zona: HTMLElement = elemento,
  ) {
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, t: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
      el.addEventListener(t, f as EventListener, o);
      this.quitar.push(() => el.removeEventListener(t, f as EventListener, o));
    };
    on(zona, 'pointerdown', (e) => this.abajo(e));
    on(zona, 'pointermove', (e) => this.mover(e));
    on(zona, 'pointerup', (e) => this.arriba(e));
    on(zona, 'pointercancel', (e) => this.arriba(e));
    on(elemento, 'lostpointercapture', (e) => this.arriba(e));
    on(zona, 'wheel', (e) => this.rueda(e), { passive: false });
    // Two fingers anywhere on the viewer never zoom the page (touch-action alone is not enough on every
    // Android WebView when the gesture starts on an overlay).
    const sinZoom = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
    };
    on(zona, 'touchstart', sinZoom, { passive: false });
    on(zona, 'touchmove', sinZoom, { passive: false });
    on(elemento, 'keydown', (e) => this.tecla(e));
    on(elemento, 'contextmenu', (e) => e.preventDefault());
    on(elemento, 'focus', () => (this.enfocado = true));
    on(elemento, 'blur', () => (this.enfocado = false));
    this.aplicar();
    this.ultimoCambio = 0;
  }

  liberar(): void {
    for (const q of this.quitar) q();
    this.quitar = [];
  }

  estado(): EstadoOrbita {
    return { azimut: this.azimut, elevacion: this.elevacion, distancia: this.distancia, objetivo: this.objetivo.clone() };
  }

  ir(a: EstadoOrbita, animar: boolean): void {
    this.vAz = this.vEl = 0;
    if (!animar || this.quieto()) {
      this.transicion = null;
      this.azimut = a.azimut;
      this.elevacion = a.elevacion;
      this.distancia = a.distancia;
      this.objetivo.copy(a.objetivo);
      // A jump is not a movement (no lower resolution for it).
      const antes = this.ultimoCambio;
      this.aplicar();
      this.ultimoCambio = antes;
      this.cambio();
      return;
    }
    // Shortest way round in azimuth.
    const de = this.estado();
    let d = a.azimut - de.azimut;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.transicion = { de, a: { ...a, azimut: de.azimut + d, objetivo: a.objetivo.clone() }, t0: performance.now(), dur: 450 };
    this.cambio();
  }

  /** Advances inertia and transitions; true while more frames are needed. */
  paso(ahora: number): boolean {
    if (this.transicion) {
      const { de, a, t0, dur } = this.transicion;
      const u = Math.min(1, (ahora - t0) / dur);
      const e = 1 - (1 - u) ** 3;
      this.azimut = de.azimut + (a.azimut - de.azimut) * e;
      this.elevacion = de.elevacion + (a.elevacion - de.elevacion) * e;
      this.distancia = de.distancia * (a.distancia / de.distancia) ** e;
      this.objetivo.lerpVectors(de.objetivo, a.objetivo, e);
      this.aplicar();
      if (u >= 1) this.transicion = null;
      return true;
    }
    if (this.modo || (Math.abs(this.vAz) < 1e-4 && Math.abs(this.vEl) < 1e-4)) return false;
    this.azimut += this.vAz;
    this.elevacion = this.limitarEl(this.elevacion + this.vEl);
    this.vAz *= 0.9;
    this.vEl *= 0.9;
    this.aplicar();
    return true;
  }

  private limitarEl(e: number): number {
    return Math.max(-0.35, Math.min(1.52, e));
  }

  /** The camera changed less than `reposo` ms ago (a drag, a pinch, the wheel, inertia, an animated reset). */
  moviendo(ahora = performance.now(), reposo = 180): boolean {
    return ahora - this.ultimoCambio < reposo;
  }

  aplicar(): void {
    this.ultimoCambio = performance.now();
    const s = new Spherical(this.distancia, Math.PI / 2 - this.elevacion, this.azimut);
    // Spherical is Y-up: map (x, y, z)_Yup → (x, −z, y)_Zup.
    const v = new Vector3().setFromSpherical(s);
    // Never inside the model: lengthen the distance along the view direction until the camera is out of
    // its sphere (zooming in stops at its surface; panning keeps working).
    if (this.solido) {
      const u = new Vector3(v.x, -v.z, v.y).normalize();
      const o = this.objetivo.clone().sub(this.solido.centro);
      const r = this.solido.radio;
      if (o.clone().addScaledVector(u, this.distancia).length() < r) {
        const b = o.dot(u);
        this.distancia = Math.min(this.maxDist, -b + Math.sqrt(Math.max(0, b * b - o.lengthSq() + r * r)));
        v.setLength(this.distancia);
      }
    }
    this.camara.position.set(this.objetivo.x + v.x, this.objetivo.y - v.z, this.objetivo.z + v.y);
    this.camara.up.set(0, 0, 1);
    this.camara.lookAt(this.objetivo);
    if (this.escena) {
      const dc = this.camara.position.distanceTo(this.escena.centro);
      const r = this.escena.radio * 1.05;
      this.camara.far = dc + r;
      this.camara.near = Math.max(dc - r, this.camara.far / 2000, 1e-3);
    } else {
      this.camara.near = Math.max(0.05, this.distancia / 200);
      this.camara.far = this.distancia * 20 + 200;
    }
    this.camara.updateProjectionMatrix();
  }

  private rotar(dx: number, dy: number): void {
    const k = 0.0085;
    this.azimut -= dx * k;
    this.elevacion = this.limitarEl(this.elevacion + dy * k);
    this.vAz = -dx * k;
    this.vEl = dy * k;
  }

  private desplazar(dx: number, dy: number): void {
    const h = this.elemento.clientHeight || 1;
    const mmPorPx = (2 * this.distancia * Math.tan((this.camara.fov * Math.PI) / 360)) / h;
    const derecha = new Vector3().setFromMatrixColumn(this.camara.matrix, 0);
    const arriba = new Vector3().setFromMatrixColumn(this.camara.matrix, 1);
    this.objetivo.addScaledVector(derecha, -dx * mmPorPx).addScaledVector(arriba, dy * mmPorPx);
  }

  private zoom(f: number): void {
    this.distancia = Math.max(this.minDist, Math.min(this.maxDist, this.distancia * f));
  }

  private abajo(e: PointerEvent): void {
    const propio = e.target === this.elemento;
    // On an overlay (a label): no capture and no preventDefault, so a tap still follows its link.
    if (!propio && !(e.target instanceof Node && this.zona.contains(e.target))) return;
    this.transicion = null;
    if (this.punteros.size === 0) {
      this.arrastrado = false;
      this.inicio = { x: e.clientX, y: e.clientY };
    }
    if (propio)
      try {
        this.elemento.setPointerCapture?.(e.pointerId);
      } catch {
        /* synthetic pointers (tests) cannot be captured */
      }
    this.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.punteros.size === 2) {
      const [a, b] = [...this.punteros.values()] as [{ x: number; y: number }, { x: number; y: number }];
      this.modo = 'pellizco';
      this.pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    } else if (this.punteros.size === 1) {
      this.modo = e.button === 2 || e.button === 1 || e.shiftKey ? 'desplazar' : 'rotar';
    }
    this.vAz = this.vEl = 0;
    if (propio) e.preventDefault();
  }

  private mover(e: PointerEvent): void {
    const prev = this.punteros.get(e.pointerId);
    if (!prev || !this.modo) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(e.clientX - this.inicio.x, e.clientY - this.inicio.y) > 6) this.arrastrado = true;
    if (this.modo === 'pellizco') {
      if (this.punteros.size < 2) return;
      const [a, b] = [...this.punteros.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (this.pellizco.d > 0 && d > 0) this.zoom(this.pellizco.d / d);
      this.desplazar(cx - this.pellizco.cx, cy - this.pellizco.cy);
      this.pellizco = { d, cx, cy };
    } else if (this.modo === 'desplazar') this.desplazar(dx, dy);
    else this.rotar(dx, dy);
    this.ultimoMov = performance.now();
    this.aplicar();
    this.cambio();
  }

  private arriba(e: PointerEvent): void {
    if (!this.punteros.delete(e.pointerId)) return;
    if (this.punteros.size === 1 && this.modo === 'pellizco') {
      this.modo = 'rotar';
      return;
    }
    if (this.punteros.size === 0) {
      // Inertia only after a moving release, never with reduced motion.
      if (this.quieto() || performance.now() - this.ultimoMov > 80 || this.modo !== 'rotar') this.vAz = this.vEl = 0;
      this.modo = null;
      this.cambio();
    }
  }

  private rueda(e: WheelEvent): void {
    if (!(this.enfocado || e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.zoom(Math.exp(Math.max(-0.5, Math.min(0.5, d * (e.ctrlKey ? 0.01 : 0.0018)))));
    this.aplicar();
    this.cambio();
  }

  /** Reset is handled by the viewer (it knows the initial view). */
  alReiniciar: () => void = () => {};

  private tecla(e: KeyboardEvent): void {
    const paso = 0.2;
    let hecho = true;
    if (e.key === 'ArrowLeft') e.shiftKey ? this.desplazar(40, 0) : (this.azimut += paso);
    else if (e.key === 'ArrowRight') e.shiftKey ? this.desplazar(-40, 0) : (this.azimut -= paso);
    else if (e.key === 'ArrowUp') e.shiftKey ? this.desplazar(0, 40) : (this.elevacion = this.limitarEl(this.elevacion + paso));
    else if (e.key === 'ArrowDown') e.shiftKey ? this.desplazar(0, -40) : (this.elevacion = this.limitarEl(this.elevacion - paso));
    else if (e.key === '+' || e.key === '=') this.zoom(0.85);
    else if (e.key === '-' || e.key === '_') this.zoom(1 / 0.85);
    else if (e.key === '0' || e.key === 'Home') this.alReiniciar();
    else hecho = false;
    if (!hecho) return;
    e.preventDefault();
    this.aplicar();
    this.cambio();
  }
}
