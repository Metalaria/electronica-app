// Adaptive resolution of the 3D views while they move (0.8). The MacBook Pro 2017 (Iris Plus 640, DPR 2) turned
// the SDR board at 44–46 frames per second with 2 ms of CPU per frame: the GPU's fill rate is the limit, so
// while the camera moves the drawing buffer gets fewer pixels until the frames come at 60 per second again, and
// when it stops the full resolution comes back with one final full-quality frame. A device that already keeps
// up (the Android phones: 107–143 frames per second) never changes its resolution.
//
// Measure: the interval between animation frames drawn one after another while the view moves (rAF follows
// the GPU: when it is behind, the next frame comes later), as a time-weighted median of the last frames. Fill-rate bound, the time goes with the pixel
// count, i.e. with the square of the pixel ratio, so the new ratio is ratio · √(target / interval) with some
// margin, never below `minimo`. Hysteresis: at most one change per AJUSTE ms, and back up only when there is
// clearly time to spare. localStorage «epa-resolucion» = «fija» turns it off (tests, comparisons).

/** Frame interval aimed at while moving (ms): 60 per second. */
export const OBJETIVO = 1000 / 60;
/** Lower the resolution above this interval (≈ 54 frames per second); raise it below SUBIR · OBJETIVO. */
const BAJAR = 1.1;
const SUBIR = 0.7;
/** Minimum ms between two changes, samples needed for a decision, a frame interval that is a pause instead. */
const AJUSTE = 250;
const MUESTRAS = 4;
/** Longest interval taken as a frame. A pause of the camera never counts (the views call enReposo() when it
 *  stops); a long interval inside one movement is a frame the GPU took that long for (a software GPU queues
 *  frames and then stalls for seconds). */
const PAUSA = 60_000;
/** Without a camera change for this long the view is at rest. */
export const REPOSO = 180;

export interface EstadoResolucion {
  /** Full pixel ratio (the view's own: device pixels, capped by its pixel budget). */
  base: number;
  /** Ratio in use now. */
  actual: number;
  /** Lowest ratio used while moving since the view opened (= base if it never had to lower it). */
  minima: number;
  /** Changes of ratio while moving (and back at rest) since the view opened. */
  cambios: number;
  /** Median interval (ms) of the last frames drawn while moving. */
  intervalo: number;
}

export function resolucionFija(): boolean {
  try {
    return globalThis.localStorage?.getItem('epa-resolucion') === 'fija';
  } catch {
    return false;
  }
}

export class ResolucionAdaptable {
  readonly estado: EstadoResolucion = { base: 1, actual: 1, minima: 1, cambios: 0, intervalo: 0 };
  /** Lowest ratio allowed, as a fraction of `base` (and never below 0.5 device pixels per CSS pixel). */
  fraccionMinima = 0.5;
  private muestras: number[] = [];
  private anterior = 0;
  private ultimoAjuste = 0;
  private readonly fija = resolucionFija();

  /** `aplicar(k)` sets the renderer's pixel ratio (and so the drawing buffer's size). */
  constructor(private aplicar: (k: number) => void) {}

  get reducida(): boolean {
    return this.estado.actual < this.estado.base - 1e-3;
  }

  /** New full ratio (view resized, other screen). At rest it is applied at once. */
  ponerBase(k: number, moviendo = false): void {
    const e = this.estado;
    const reducida = this.reducida;
    e.base = k;
    if (e.cambios === 0) e.minima = k;
    // While moving with a lowered ratio it stays lowered (at most the new base); otherwise the base, at once.
    if (moviendo && reducida && e.actual <= k) return;
    e.actual = k;
    this.aplicar(k);
  }

  /**
   * A frame is about to be drawn at `ts` (rAF time) while the view moves: measures the interval since the
   * previous frame and, when needed, changes the ratio for this frame. Returns true when it changed. A pause
   * of the camera never counts: the views call enReposo() when it has been still for REPOSO ms (checked in an
   * animation frame, so a GPU stall is not taken for a pause), which starts the measure again.
   */
  enMovimiento(ts: number): boolean {
    const dt = ts - this.anterior;
    const continuo = this.anterior > 0;
    this.anterior = ts;
    if (this.fija || !continuo || dt <= 0 || dt > PAUSA) return false;
    const m = this.muestras;
    m.push(dt);
    if (m.length > 8) m.shift();
    // Enough frames to judge: MUESTRAS, or fewer very slow ones (half a second of them).
    const suma = m.reduce((a, b) => a + b, 0);
    if ((m.length < MUESTRAS && (m.length < 2 || suma < 500)) || ts - this.ultimoAjuste < AJUSTE) return false;
    // Time-weighted median: the interval the reader sees for half of the time. One hitch (a collection, a
    // decoded image) among smooth frames does not count; a GPU that queues frames and then stalls does.
    const orden = [...m].sort((a, b) => a - b);
    const total = orden.reduce((a, b) => a + b, 0);
    let med = orden[orden.length - 1]!;
    for (let i = 0, acum = 0; i < orden.length; i++) {
      acum += orden[i]!;
      if (acum >= total / 2) {
        med = orden[i]!;
        break;
      }
    }
    this.estado.intervalo = med;
    const e = this.estado;
    let k = e.actual;
    if (med > OBJETIVO * BAJAR) k = Math.max(this.minimo(), e.actual * Math.sqrt(OBJETIVO / med) * 0.92);
    else if (med < OBJETIVO * SUBIR && this.reducida) k = Math.min(e.base, e.actual * 1.2);
    if (Math.abs(k - e.actual) < 0.02) return false;
    this.cambiar(k);
    this.ultimoAjuste = ts;
    this.muestras = [];
    return true;
  }

  /** The view is at rest: full resolution again. Returns true when a final frame must be drawn. */
  enReposo(): boolean {
    this.anterior = 0;
    this.muestras = [];
    if (!this.reducida) return false;
    this.cambiar(this.estado.base);
    return true;
  }

  private minimo(): number {
    return Math.min(this.estado.base, Math.max(0.5, this.estado.base * this.fraccionMinima));
  }

  private cambiar(k: number): void {
    const e = this.estado;
    if (Math.abs(k - e.actual) > 1e-3) e.cambios++;
    e.actual = k;
    e.minima = Math.min(e.minima, k);
    this.aplicar(k);
  }
}
