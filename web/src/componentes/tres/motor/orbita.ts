// Camera controller for a Z-up scene, written for render-on-demand: it never runs its own loop, it only reports
// `cambio()` when the camera moved and whether it still needs frames (inertia, animated transitions).
//
// Two ways of navigating, chosen by the kind of scene that creates it:
//
// · Orbit-first (the default: one object in the middle that one turns round — the 3D component gallery,
//   motor/visor.ts, also for a part mounted on a piece of board).
//     Mouse/trackpad: drag rotates; right button, Shift + drag or middle button pans; wheel zooms when the
//     viewer has the focus, or with Ctrl/⌘ (a trackpad pinch arrives as Ctrl + wheel, or in Safari/WebKit as
//     gesture events).
//     Touch: one finger rotates, two fingers pinch-zoom and pan.
//     Keyboard (focused canvas): arrows rotate, Shift + arrows pan, + / − zoom, 0 or Inicio resets.
//     The camera never enters `solido` (the model at rest).
//
// · Map (1.3: a large flat thing one moves over and zooms into, like a street map — the boards: console boards and
//   KiCad PCBs, proyectos/escena3d.ts, which turns it on by setting `mapa`). The pivot always lies on the board's
//   top face, inside the board.
//     One finger, left drag or middle drag pans on the board plane: the grabbed point stays under the finger.
//     Two fingers: pinching zooms toward the fingers and moving them pans; a twist of more than 15° rotates
//     (azimuth); both fingers dragged up or down together, side by side, tilts. Which of the two is decided after
//     10 px of movement and kept until the fingers lift, so a pinch or a pan never tilts and a pinch only rotates
//     with a clear twist. Lifting one finger starts nothing: the other one pans only once it moves again, from
//     where it is then (no jump).
//     Mouse: right button or Ctrl/⌘ + drag rotates (horizontally) and tilts (vertically). Wheel (with the focus or
//     Ctrl/⌘), trackpad pinch (Ctrl + wheel, or Safari's gesturestart/gesturechange, which also rotate) zoom
//     toward the point under the cursor.
//     Keyboard: arrows pan, Shift + arrows rotate / tilt, + / − zoom, 0 or Inicio resets.
//     Seen from straight above by default; tilt at most 60° from the vertical (a preset may start lower, the edge
//     view: from there gestures only raise the camera). Instead of a sphere round the whole board the camera
//     keeps a clearance above the board and the parts under it (`mapa.altura`, a height field whose parts have
//     sloped sides), so one gets close to a chip without entering it or any part beside it; the clearance raises
//     the camera only while it is needed (panning past a tall part does not keep the camera up).
//     A fling (one finger or the mouse) goes on with some inertia, as rotation does in orbit mode.

import { Matrix4, PerspectiveCamera, Spherical, Vector3 } from 'three';

export interface EstadoOrbita {
  azimut: number;
  elevacion: number;
  distancia: number;
  objetivo: Vector3;
}

/** What map mode knows of the board (given by the board scene). */
export interface SuperficieMapa {
  /** World height of the board's top face: the pivot always lies on it. */
  z(): number;
  /** The pivot stays within |x| ≤ x and |y| ≤ y (the board, centred on the origin). */
  limites(): { x: number; y: number };
  /** Highest world z of what is drawn at (x, y): the board's face, or a part (with sloped sides round it). */
  altura(x: number, y: number): number;
}

/** Thresholds and limits of map mode (exported for the tests). */
export const MAPA = {
  /** px of movement before a two-finger gesture is told apart (pinch/pan or tilt). */
  umbralDos: 10,
  /** rad of twist from the start of a two-finger gesture before it rotates. */
  umbralGiro: 0.26,
  /** px the remaining finger moves, after the other one lifts, before it pans. */
  umbralReanclar: 8,
  /** Lowest elevation reached by gestures (rad): 30° over the board, a tilt of 60°. */
  elMin: Math.PI / 6,
  elMax: Math.PI / 2,
  /** Clearance (mm, world units) kept between the camera and whatever is under it. */
  holgura: 1.5,
};

export type Punto = { x: number; y: number };
type Modo = 'rotar' | 'desplazar' | 'pellizco' | 'girar' | 'dos' | 'inclinar' | null;

/** WebKit's GestureEvent (Safari, the Mac app's WKWebView): not in TypeScript's DOM library. */
interface EventoGesto extends UIEvent {
  scale: number;
  rotation: number;
  clientX: number;
  clientY: number;
}

const angulo = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export class Orbita {
  azimut = -1.1;
  elevacion = 0.55;
  /** Distance asked for (zoom); in map mode the camera may stand farther to keep its clearance: `distanciaReal`. */
  distancia = 40;
  /** Distance from the pivot at which the camera actually is (map mode: never closer than the clearance allows). */
  distanciaReal = 40;
  objetivo = new Vector3();
  minDist = 2;
  maxDist = 400;
  private vAz = 0;
  private vEl = 0;
  private punteros = new Map<number, Punto>();
  /** Map mode: the (at most two) pointers of the gesture, in order of arrival. */
  private ids: number[] = [];
  private modo: Modo = null;
  private pellizco = { d: 0, cx: 0, cy: 0 };
  private ultimoMov = 0;
  private transicion: { de: EstadoOrbita; a: EstadoOrbita; t0: number; dur: number } | null = null;
  private quitar: (() => void)[] = [];
  /** Set by the viewer: focused element gets plain-wheel zoom. */
  enfocado = false;
  /**
   * Set by the viewer: the sphere holding everything drawn (model at full explosion, board, shadow), for a
   * near/far range as tight as it can be (depth precision: mobile GPUs may have 16-bit depth buffers), and
   * the sphere the camera never enters (the model at rest; orbit mode). Without them, a generic range is used.
   */
  escena: { centro: Vector3; radio: number } | null = null;
  solido: { centro: Vector3; radio: number } | null = null;
  /** Set by a board scene: map mode (see the header). */
  mapa: SuperficieMapa | null = null;

  /** True from a pointer move of more than a few pixels until the next press (labels ignore that click). */
  arrastrado = false;
  /** performance.now() of the last camera change (0.8: the views lower their resolution while it moves). */
  ultimoCambio = 0;
  private inicio = { x: 0, y: 0 };

  // map mode
  /** Board point grabbed by the finger (or the two fingers' midpoint). */
  private ancla: Vector3 | null = null;
  /** After a lift: where the remaining finger was; it pans once it is `umbralReanclar` px away. */
  private reanclar: Punto | null = null;
  private dos = { a0: { x: 0, y: 0 }, b0: { x: 0, y: 0 }, d0: 0, ang0: 0, d: 0, ang: 0, girando: false };
  /** Pan velocity (world units per ms) for the inertia, and when it was measured. */
  private vPan = new Vector3();
  private tPan = 0;
  private tInercia = 0;
  /** A Safari trackpad gesture in progress (its pinch must not also be taken from the Ctrl + wheel events). */
  private gesto: { escala: number; giro: number; girando: boolean } | null = null;
  private base = new Matrix4();

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
    // Safari and WKWebView (the Mac app) report a trackpad pinch as gesture events: without preventDefault they
    // zoom the page. On iPhone and iPad they also come with the touches, which the pointer events already handle.
    const g = (t: string, f: (e: EventoGesto) => void) => {
      const h = (e: Event) => f(e as EventoGesto);
      zona.addEventListener(t, h, { passive: false });
      this.quitar.push(() => zona.removeEventListener(t, h));
    };
    g('gesturestart', (e) => this.gestoInicio(e));
    g('gesturechange', (e) => this.gestoCambio(e));
    g('gestureend', (e) => {
      e.preventDefault();
      this.gesto = null;
    });
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
    this.vPan.set(0, 0, 0);
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
      if (this.mapa) this.distancia = this.distanciaReal;
      this.cambio();
      return;
    }
    // Shortest way round in azimuth.
    const de = { ...this.estado(), distancia: this.mapa ? this.distanciaReal : this.distancia };
    let d = a.azimut - de.azimut;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.transicion = { de, a: { ...a, azimut: de.azimut + d, objetivo: a.objetivo.clone() }, t0: performance.now(), dur: 450 };
    this.cambio();
  }

  /** Map mode: brings `punto` (on the board) to the middle of the view at `distancia`, keeping the angles. */
  centrar(punto: Vector3, distancia: number, animar = true): void {
    this.ir({ ...this.estado(), objetivo: punto.clone(), distancia: Math.max(this.minDist, Math.min(this.maxDist, distancia)) }, animar);
  }

  /** Map mode: straight down with the board upright (azimuth 0), keeping the pivot and the zoom. */
  enderezar(animar = true): void {
    this.ir({ azimut: 0, elevacion: MAPA.elMax, distancia: this.mapa ? this.distanciaReal : this.distancia, objetivo: this.objetivo.clone() }, animar);
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
      if (u >= 1) {
        this.transicion = null;
        if (this.mapa) this.distancia = this.distanciaReal;
      }
      return true;
    }
    if (this.mapa) {
      if (this.modo || this.vPan.lengthSq() === 0) return false;
      const dt = Math.max(0, Math.min(50, ahora - this.tInercia));
      this.tInercia = Math.max(ahora, this.tInercia);
      this.objetivo.addScaledVector(this.vPan, dt);
      this.vPan.multiplyScalar(Math.exp(-dt / 200));
      if (this.vPan.length() * 16 < this.distanciaReal * 2e-4) this.vPan.set(0, 0, 0);
      this.aplicar();
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
    // Map: a preset below the lowest elevation (the edge view) may only go up from there.
    if (this.mapa) return Math.max(Math.min(MAPA.elMin, this.elevacion), Math.min(MAPA.elMax, e));
    return Math.max(-0.35, Math.min(1.52, e));
  }

  /** The camera changed less than `reposo` ms ago (a drag, a pinch, the wheel, inertia, an animated reset). */
  moviendo(ahora = performance.now(), reposo = 180): boolean {
    return ahora - this.ultimoCambio < reposo;
  }

  /** Unit vector from the pivot towards the camera. */
  private direccion(v = new Vector3()): Vector3 {
    const c = Math.cos(this.elevacion);
    return v.set(c * Math.sin(this.azimut), -c * Math.cos(this.azimut), Math.sin(this.elevacion));
  }

  /** Map mode: the nearest distance ≥ `d` at which the camera keeps its clearance over what is under it. */
  private distanciaLibre(d: number, objetivo = this.objetivo): number {
    const m = this.mapa!;
    const zp = m.z();
    const u = this.direccion();
    const s = Math.max(1e-3, u.z);
    for (let i = 0; i < 6; i++) {
      const h = Math.max(zp, m.altura(objetivo.x + u.x * d, objetivo.y + u.y * d)) + MAPA.holgura - zp;
      const necesaria = h / s;
      if (d >= necesaria - 1e-9) break;
      d = necesaria;
    }
    return d;
  }

  private limitarObjetivo(): void {
    const l = this.mapa!.limites();
    this.objetivo.x = Math.max(-l.x, Math.min(l.x, this.objetivo.x));
    this.objetivo.y = Math.max(-l.y, Math.min(l.y, this.objetivo.y));
    this.objetivo.z = this.mapa!.z();
  }

  aplicar(): void {
    this.ultimoCambio = performance.now();
    if (this.mapa) {
      this.limitarObjetivo();
      this.distanciaReal = this.distanciaLibre(this.distancia);
      const u = this.direccion();
      this.camara.position.copy(this.objetivo).addScaledVector(u, this.distanciaReal);
      // Orientation from the angles (no lookAt: straight down, its up vector would be undefined): screen right is
      // horizontal, across the azimuth.
      const x = new Vector3(Math.cos(this.azimut), Math.sin(this.azimut), 0);
      const y = new Vector3().crossVectors(u, x);
      this.camara.quaternion.setFromRotationMatrix(this.base.makeBasis(x, y, u));
      this.camara.up.set(0, 0, 1);
    } else {
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
      this.distanciaReal = this.distancia;
      this.camara.position.set(this.objetivo.x + v.x, this.objetivo.y - v.z, this.objetivo.z + v.y);
      this.camara.up.set(0, 0, 1);
      this.camara.lookAt(this.objetivo);
    }
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
    this.camara.updateMatrixWorld();
  }

  // ------------------------------------------------------------------ map geometry

  /** Point of the board plane under a canvas point (CSS px from the canvas's top left), or null (above the horizon). */
  puntoEnPlano(px: number, py: number): Vector3 | null {
    const w = this.elemento.clientWidth || 1;
    const h = this.elemento.clientHeight || 1;
    const p = new Vector3((px / w) * 2 - 1, -(py / h) * 2 + 1, 0.5).unproject(this.camara);
    const o = this.camara.position;
    const d = p.sub(o).normalize();
    const zp = this.mapa ? this.mapa.z() : this.objetivo.z;
    if (d.z > -1e-4) return null;
    const t = (zp - o.z) / d.z;
    if (t <= 0 || t > this.maxDist * 4) return null;
    return o.clone().addScaledVector(d, t);
  }

  /** Canvas point of a client (viewport) point. */
  private enLienzo(x: number, y: number): Punto {
    const r = this.elemento.getBoundingClientRect();
    return { x: x - r.left, y: y - r.top };
  }

  /** Map: zoom by `f` (new distance / old) toward the board point `p`, which keeps its place on screen. */
  zoomHacia(p: Vector3, f: number): void {
    const d0 = this.distanciaReal;
    if (!(d0 > 0)) return;
    let d = Math.max(this.minDist, Math.min(this.maxDist, d0 * f));
    const o = new Vector3();
    // The clearance may stop the camera before `d`: the pivot moves with the distance it really gets, so that
    // the point stays under the cursor even then.
    for (let i = 0; i < 4; i++) {
      const k = d / d0;
      o.set(p.x + (this.objetivo.x - p.x) * k, p.y + (this.objetivo.y - p.y) * k, this.objetivo.z);
      const libre = this.distanciaLibre(d, o);
      if (libre <= d + 1e-9) break;
      d = libre;
    }
    if (d >= d0 - 1e-9 && f < 1) return;
    this.objetivo.copy(o);
    this.distancia = d;
    this.aplicar();
    this.distancia = this.distanciaReal;
  }

  /** Map: turn the camera about the vertical through `p` by `a` rad (the board turns the other way on screen). */
  girarAlrededor(p: Vector3, a: number): void {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = this.objetivo.x - p.x;
    const y = this.objetivo.y - p.y;
    this.objetivo.x = p.x + x * c - y * s;
    this.objetivo.y = p.y + x * s + y * c;
    this.azimut += a;
    this.aplicar();
  }

  /** Map: moves the board so that `ancla` comes under the canvas point `s`. */
  private arrastrarA(s: Punto): void {
    if (!this.ancla) return;
    const q = this.puntoEnPlano(s.x, s.y);
    if (!q) return;
    const antes = this.objetivo.clone();
    this.objetivo.x += this.ancla.x - q.x;
    this.objetivo.y += this.ancla.y - q.y;
    this.aplicar();
    const ahora = performance.now();
    const dt = ahora - this.tPan;
    if (dt > 0 && dt < 100) {
      const v = this.objetivo.clone().sub(antes).divideScalar(Math.max(8, dt));
      const max = this.distanciaReal * 0.01;
      if (v.length() > max) v.setLength(max);
      this.vPan.multiplyScalar(0.3).addScaledVector(v, 0.7);
    } else this.vPan.set(0, 0, 0);
    this.tPan = ahora;
  }

  /** Map: pans as a drag of (dx, dy) px from the middle of the canvas would (keyboard). */
  private desplazarMapa(dx: number, dy: number): void {
    const w = this.elemento.clientWidth || 1;
    const h = this.elemento.clientHeight || 1;
    const c = { x: w / 2, y: h / 2 };
    // (the point now at c − (dx, dy) comes to the middle)
    const a = this.puntoEnPlano(c.x - dx, c.y - dy);
    if (a && this.puntoEnPlano(c.x, c.y)) {
      this.ancla = a;
      this.arrastrarA(c);
    } else {
      // Nearly level (the edge view): along the board, by the scale at the pivot.
      const mm = (2 * this.distanciaReal * Math.tan((this.camara.fov * Math.PI) / 360)) / h;
      this.objetivo.x += (-Math.cos(this.azimut) * dx - Math.sin(this.azimut) * dy) * mm;
      this.objetivo.y += (-Math.sin(this.azimut) * dx + Math.cos(this.azimut) * dy) * mm;
      this.aplicar();
    }
    this.ancla = null;
    this.vPan.set(0, 0, 0);
  }

  // ------------------------------------------------------------------ orbit mode

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

  // ------------------------------------------------------------------ pointers

  private abajo(e: PointerEvent): void {
    const propio = e.target === this.elemento;
    // On an overlay (a label): no capture and no preventDefault, so a tap still follows its link.
    if (!propio && !(e.target instanceof Node && this.zona.contains(e.target))) return;
    // 1.3.1: a pointer still held down by its id lost its release (a mouse pressed on an overlay, which takes no
    // capture, and released outside the window): it is let go first, or it would count as a second finger forever.
    if (this.punteros.has(e.pointerId)) this.arriba(e);
    // Map: a third finger is ignored.
    if (this.mapa && this.ids.length >= 2) return;
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
    this.vAz = this.vEl = 0;
    this.vPan.set(0, 0, 0);
    if (this.mapa) this.abajoMapa(e);
    else if (this.punteros.size === 2) {
      const [a, b] = [...this.punteros.values()] as [Punto, Punto];
      this.modo = 'pellizco';
      this.pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    } else if (this.punteros.size === 1) {
      this.modo = e.button === 2 || e.button === 1 || e.shiftKey ? 'desplazar' : 'rotar';
    }
    if (propio) e.preventDefault();
  }

  private abajoMapa(e: PointerEvent): void {
    this.ids.push(e.pointerId);
    if (this.ids.length === 1) {
      // (with the mouse the canvas takes the focus, so that the wheel zooms it)
      if (e.pointerType === 'mouse' && e.target === this.elemento) this.elemento.focus?.({ preventScroll: true });
      const girar = e.pointerType === 'mouse' && (e.button === 2 || ((e.ctrlKey || e.metaKey) && e.button === 0));
      this.modo = girar ? 'girar' : 'desplazar';
      this.reanclar = null;
      const p = this.enLienzo(e.clientX, e.clientY);
      this.ancla = girar ? null : this.puntoEnPlano(p.x, p.y);
      this.tPan = performance.now();
      return;
    }
    // A second finger: a two-finger gesture, not told apart yet (nothing moves until it is).
    const a = this.punteros.get(this.ids[0]!)!;
    const b = this.punteros.get(this.ids[1]!)!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    this.dos = { a0: { ...a }, b0: { ...b }, d0: d, ang0: ang, d, ang, girando: false };
    this.modo = 'dos';
    this.ancla = null;
    this.reanclar = null;
  }

  private mover(e: PointerEvent): void {
    const prev = this.punteros.get(e.pointerId);
    if (!prev || !this.modo) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(e.clientX - this.inicio.x, e.clientY - this.inicio.y) > 6) this.arrastrado = true;
    if (this.mapa) {
      if (!this.moverMapa(e, dx, dy)) return;
    } else if (this.modo === 'pellizco') {
      if (this.punteros.size < 2) return;
      const [a, b] = [...this.punteros.values()] as [Punto, Punto];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (this.pellizco.d > 0 && d > 0) this.zoom(this.pellizco.d / d);
      this.desplazar(cx - this.pellizco.cx, cy - this.pellizco.cy);
      this.pellizco = { d, cx, cy };
      this.aplicar();
    } else {
      if (this.modo === 'desplazar') this.desplazar(dx, dy);
      else this.rotar(dx, dy);
      this.aplicar();
    }
    this.ultimoMov = performance.now();
    this.cambio();
  }

  /** Map mode move; false when the camera did not change. */
  private moverMapa(e: PointerEvent, dx: number, dy: number): boolean {
    const p = this.enLienzo(e.clientX, e.clientY);
    if (this.modo === 'desplazar') {
      if (this.reanclar) {
        // After a lift: the finger has to move again first; then it grabs the point under it now.
        if (Math.hypot(e.clientX - this.reanclar.x, e.clientY - this.reanclar.y) < MAPA.umbralReanclar) return false;
        this.reanclar = null;
        this.ancla = this.puntoEnPlano(p.x, p.y);
        this.tPan = performance.now();
        return false;
      }
      if (!this.ancla) {
        this.ancla = this.puntoEnPlano(p.x, p.y);
        return false;
      }
      this.arrastrarA(p);
      return true;
    }
    if (this.modo === 'girar') {
      const h = this.elemento.clientHeight || 1;
      this.azimut -= dx * 0.0085;
      this.elevacion = this.limitarEl(this.elevacion + dy * this.kInclinar(h));
      this.aplicar();
      return true;
    }
    if (this.ids.length < 2) return false;
    const a = this.punteros.get(this.ids[0]!)!;
    const b = this.punteros.get(this.ids[1]!)!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const m = this.enLienzo((a.x + b.x) / 2, (a.y + b.y) / 2);
    const g = this.dos;
    if (this.modo === 'dos') {
      const modo = clasificarDos(g.a0, g.b0, a, b);
      if (!modo) return false;
      this.modo = modo;
      // From here on, from where the fingers are now (the movement that told the gesture apart moves nothing).
      g.d = d;
      g.ang = ang;
      if (modo === 'pellizco') this.ancla = this.puntoEnPlano(m.x, m.y);
      return false;
    }
    if (this.modo === 'inclinar') {
      // Each finger's move counts half: the two fingers' mean.
      this.elevacion = this.limitarEl(this.elevacion + (dy / 2) * this.kInclinar(this.elemento.clientHeight || 1));
      this.aplicar();
      return true;
    }
    // Pinch: zoom about the grabbed point, rotate about it once the twist is clear, then the point under the
    // fingers' midpoint.
    if (!this.ancla) {
      this.ancla = this.puntoEnPlano(m.x, m.y);
      g.d = d;
      g.ang = ang;
      return false;
    }
    if (g.d > 0 && d > 0) this.zoomHacia(this.ancla, g.d / d);
    if (!g.girando && Math.abs(angulo(ang - g.ang0)) > MAPA.umbralGiro) g.girando = true;
    else if (g.girando) this.girarAlrededor(this.ancla, angulo(ang - g.ang));
    g.d = d;
    g.ang = ang;
    this.arrastrarA(m);
    this.vPan.set(0, 0, 0);
    return true;
  }

  /** rad of elevation per px of a tilting drag: the whole range in about half the view's height. */
  private kInclinar(h: number): number {
    return (MAPA.elMax - MAPA.elMin) / Math.max(240, 0.6 * h);
  }

  private arriba(e: PointerEvent): void {
    if (!this.punteros.delete(e.pointerId)) return;
    if (this.mapa) {
      const i = this.ids.indexOf(e.pointerId);
      if (i >= 0) this.ids.splice(i, 1);
      if (this.ids.length === 1) {
        // One finger left after a two-finger gesture: nothing until it moves again, from where it is.
        this.modo = 'desplazar';
        this.ancla = null;
        this.reanclar = { ...this.punteros.get(this.ids[0]!)! };
        this.vPan.set(0, 0, 0);
        return;
      }
      if (this.ids.length === 0) {
        // Inertia only after a moving release (a pan), never with reduced motion.
        if (this.quieto() || performance.now() - this.ultimoMov > 80 || this.modo !== 'desplazar' || this.reanclar) this.vPan.set(0, 0, 0);
        this.tInercia = performance.now();
        this.modo = null;
        this.ancla = null;
        this.reanclar = null;
        this.punteros.clear();
        this.cambio();
      }
      return;
    }
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
    // A Safari trackpad pinch already comes as gesture events.
    if (this.gesto && e.ctrlKey) return;
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const f = Math.exp(Math.max(-0.5, Math.min(0.5, d * (e.ctrlKey ? 0.01 : 0.0018))));
    this.transicion = null;
    if (this.mapa) {
      const p = this.enLienzo(e.clientX, e.clientY);
      this.vPan.set(0, 0, 0);
      this.zoomHacia(this.puntoEnPlano(p.x, p.y) ?? this.objetivo.clone(), f);
    } else {
      this.zoom(f);
      this.aplicar();
    }
    this.cambio();
  }

  private gestoInicio(e: EventoGesto): void {
    e.preventDefault();
    // With touches (iPhone, iPad) the pointer events do it.
    this.gesto = this.punteros.size ? null : { escala: 1, giro: 0, girando: false };
  }

  private gestoCambio(e: EventoGesto): void {
    e.preventDefault();
    const g = this.gesto;
    if (!g || this.punteros.size || !(e.scale > 0)) return;
    const f = g.escala / e.scale;
    g.escala = e.scale;
    this.transicion = null;
    if (this.mapa) {
      const c = this.enLienzo(e.clientX, e.clientY);
      const p = this.puntoEnPlano(c.x, c.y) ?? this.objetivo.clone();
      this.zoomHacia(p, f);
      // (degrees, clockwise)
      const giro = (e.rotation * Math.PI) / 180;
      if (!g.girando && Math.abs(giro) > MAPA.umbralGiro) g.girando = true;
      else if (g.girando) this.girarAlrededor(p, angulo(giro - g.giro));
      if (g.girando) g.giro = giro;
    } else {
      this.zoom(f);
      this.aplicar();
    }
    this.cambio();
  }

  /** Reset is handled by the viewer (it knows the initial view). */
  alReiniciar: () => void = () => {};

  private tecla(e: KeyboardEvent): void {
    const paso = 0.2;
    let hecho = true;
    if (this.mapa) {
      const p = 60;
      if (e.key === 'ArrowLeft') e.shiftKey ? (this.azimut += paso) : this.desplazarMapa(p, 0);
      else if (e.key === 'ArrowRight') e.shiftKey ? (this.azimut -= paso) : this.desplazarMapa(-p, 0);
      // (Shift + ↑ raises the camera toward the view from above, as ↑ does in orbit mode; Shift + ↓ tilts)
      else if (e.key === 'ArrowUp') e.shiftKey ? (this.elevacion = this.limitarEl(this.elevacion + paso)) : this.desplazarMapa(0, p);
      else if (e.key === 'ArrowDown') e.shiftKey ? (this.elevacion = this.limitarEl(this.elevacion - paso)) : this.desplazarMapa(0, -p);
      else if (e.key === '+' || e.key === '=') this.zoomHacia(this.objetivo.clone(), 0.8);
      else if (e.key === '-' || e.key === '_') this.zoomHacia(this.objetivo.clone(), 1 / 0.8);
      else if (e.key === '0' || e.key === 'Home') this.alReiniciar();
      else hecho = false;
    } else if (e.key === 'ArrowLeft') e.shiftKey ? this.desplazar(40, 0) : (this.azimut += paso);
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

/**
 * Map mode: what a two-finger gesture is, from where the fingers started (a0, b0) and where they are (a, b):
 * null while they have moved less than `MAPA.umbralDos` (or only one has, by less than three times that: the
 * pointer events of the two fingers come one after the other); 'inclinar' when both went up or both went down by
 * similar amounts, mostly vertically, side by side and without pinching; else 'pellizco' (zoom, pan, twist).
 */
export function clasificarDos(a0: Punto, b0: Punto, a: Punto, b: Punto): 'pellizco' | 'inclinar' | null {
  const da = { x: a.x - a0.x, y: a.y - a0.y };
  const db = { x: b.x - b0.x, y: b.y - b0.y };
  const ma = Math.hypot(da.x, da.y);
  const mb = Math.hypot(db.x, db.y);
  if (Math.max(ma, mb) < MAPA.umbralDos) return null;
  if (Math.min(ma, mb) < MAPA.umbralDos / 2 && Math.max(ma, mb) < 3 * MAPA.umbralDos) return null;
  const vertical = (v: Punto) => Math.abs(v.y) > 1.5 * Math.abs(v.x);
  const ya = Math.abs(da.y);
  const yb = Math.abs(db.y);
  const juntos = Math.sign(da.y) === Math.sign(db.y) && vertical(da) && vertical(db) && Math.min(ya, yb) > 0.4 * Math.max(ya, yb);
  const lado = Math.abs(b0.x - a0.x) > Math.abs(b0.y - a0.y);
  const pellizco = Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - Math.hypot(b0.x - a0.x, b0.y - a0.y));
  return juntos && lado && pellizco < 0.5 * Math.max(ya, yb) ? 'inclinar' : 'pellizco';
}
