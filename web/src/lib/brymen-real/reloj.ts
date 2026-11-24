// 1.4.1: waits that the browser does not stretch when the window is hidden. The real Brymen is asked for a reading
// about three times a second, with a short pause between one request and the next; with that pause on the page's own
// timer, a window behind another one got one reading a second (measured on a real record: 0.39 s became 1 s). The
// pause now runs on a worker's timer (reloj.worker.ts). Where there is no worker (unit tests in Node, a browser that
// refuses it) or it stops answering, the page's own timer does the wait, as before: a stuck worker can slow the loop
// down, never stop it.

/** What the clock needs of a worker (a fake one in the tests). */
export interface Mensajero {
  postMessage(m: { id: number; ms: number }): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  terminate(): void;
}

/** Extra time the page's own timer gives the worker before it does the wait itself. */
export const MARGEN_MS = 1500;

function workerDelNavegador(): Mensajero | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./reloj.worker.ts', import.meta.url), { type: 'module' }) as unknown as Mensajero;
  } catch {
    return null;
  }
}

export class Reloj {
  /** undefined: not opened yet; null: no worker (the page's timer does every wait). */
  private w: Mensajero | null | undefined;
  private n = 0;
  private pendientes = new Map<number, () => void>();

  constructor(private readonly fabricar: () => Mensajero | null = workerDelNavegador) {}

  /** Which timer is doing the waits (diagnostics and tests). */
  get tipo(): 'worker' | 'pagina' | 'sin-abrir' {
    return this.w === undefined ? 'sin-abrir' : this.w ? 'worker' : 'pagina';
  }

  esperar(ms: number): Promise<void> {
    if (this.w === undefined) this.w = this.abrir();
    const w = this.w;
    if (!w) return new Promise((r) => setTimeout(r, ms));
    const id = ++this.n;
    return new Promise((r) => {
      // whichever comes first: the worker's answer, or the page's timer a good while later (a worker that never
      // answers would otherwise stop the loop for good)
      const respaldo = setTimeout(() => {
        this.pendientes.delete(id);
        r();
      }, ms + MARGEN_MS);
      this.pendientes.set(id, () => {
        clearTimeout(respaldo);
        r();
      });
      try {
        w.postMessage({ id, ms });
      } catch {
        this.caer();
      }
    });
  }

  private abrir(): Mensajero | null {
    const w = this.fabricar();
    if (!w) return null;
    w.onmessage = (e) => {
      const fin = this.pendientes.get(e.data as number);
      if (!fin) return;
      this.pendientes.delete(e.data as number);
      fin();
    };
    // (a worker the page is not allowed to load fails here, after it was created)
    w.onerror = () => this.caer();
    return w;
  }

  /** The worker failed: what was waiting ends now, and from now on the page's timer does the waits. */
  private caer(): void {
    const w = this.w;
    this.w = null;
    try {
      w?.terminate();
    } catch {
      // (already gone)
    }
    const fines = [...this.pendientes.values()];
    this.pendientes.clear();
    for (const fin of fines) fin();
  }
}
