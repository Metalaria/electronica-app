// «Aprender con el libro»: the reader's progress, stored on the device with the same storage layer as
// bookmarks and notes (Tauri plugin-store file `lector.json`, or localStorage `epa:*` in a browser):
//   ejercicios   label → attempts, solved, hints used, solution seen, last typed values
//   leidas       part → section label → time it was marked as read
//   deducciones  "<part>:<block index>" → steps revealed in that derivation
// Reactive (Svelte runes), loaded once on first use, debounced writes, flushed when the page hides.

import { obtenerAlmacen, type Almacen } from './almacen';

export interface EstadoEjercicio {
  /** Checks with at least one readable answer (or self-assessments). */
  intentos: number;
  /** Checks that were not all correct. */
  fallos: number;
  resuelto: boolean;
  /** Hints revealed (0, 1, 2). */
  pistas: number;
  /** The solution was opened before solving it. */
  solucion: boolean;
  /** Last values typed, by answer id. */
  valores?: Record<string, string>;
  /** Answer ids already right. */
  bien?: string[];
  /** Problems: the reader hides the analysis in the book while trying. */
  tapada?: boolean;
  t: number;
}

export type Estado = 'pendiente' | 'fallado' | 'resuelto';

export const aprendizaje = $state({
  listo: false,
  ejercicios: {} as Record<string, EstadoEjercicio>,
  leidas: {} as Record<string, Record<string, number>>,
  deducciones: {} as Record<string, number>,
});

type Clave = 'ejercicios' | 'leidas' | 'deducciones';

let almacen: Almacen | null = null;
let carga: Promise<void> | null = null;
const pendientes = new Map<Clave, ReturnType<typeof setTimeout>>();

function escribir(clave: Clave): void {
  void almacen?.escribir(clave, $state.snapshot(aprendizaje[clave]));
}

function guardar(clave: Clave, espera = 400): void {
  const t = pendientes.get(clave);
  if (t) clearTimeout(t);
  pendientes.set(
    clave,
    setTimeout(() => {
      pendientes.delete(clave);
      escribir(clave);
    }, espera),
  );
}

function volcar(): void {
  for (const [clave, t] of pendientes) {
    clearTimeout(t);
    escribir(clave);
  }
  pendientes.clear();
}

/** Loads the stored progress (once); every component that shows progress calls it. */
export function cargarAprendizaje(): Promise<void> {
  carga ??= (async () => {
    almacen = await obtenerAlmacen();
    const [ej, le, de] = await Promise.all([
      almacen.leer<Record<string, EstadoEjercicio>>('ejercicios'),
      almacen.leer<Record<string, Record<string, number>>>('leidas'),
      almacen.leer<Record<string, number>>('deducciones'),
    ]);
    if (ej && typeof ej === 'object') aprendizaje.ejercicios = ej;
    if (le && typeof le === 'object') aprendizaje.leidas = le;
    if (de && typeof de === 'object') aprendizaje.deducciones = de;
    aprendizaje.listo = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', volcar);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') volcar();
      });
    }
  })();
  return carga;
}

// ------------------------------------------------------------------ exercises

export function estadoDe(label: string): Estado {
  const e = aprendizaje.ejercicios[label];
  if (!e) return 'pendiente';
  if (e.resuelto) return 'resuelto';
  return e.fallos > 0 ? 'fallado' : 'pendiente';
}

function asegurarEj(label: string): EstadoEjercicio {
  let e = aprendizaje.ejercicios[label];
  if (!e) {
    aprendizaje.ejercicios[label] = { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: Date.now() };
    e = aprendizaje.ejercicios[label]!;
  }
  return e;
}

/** One «Comprobar»: the values typed, which answers are right, and whether everything is solved. */
export function registrarIntento(label: string, valores: Record<string, string>, bien: string[], completo: boolean): void {
  const e = asegurarEj(label);
  e.intentos++;
  if (!completo) e.fallos++;
  if (completo) e.resuelto = true;
  e.valores = valores;
  e.bien = bien;
  e.t = Date.now();
  guardar('ejercicios');
}

/** Self-assessment after comparing with the solution (answers that are not checked automatically). */
export function autoevaluar(label: string, bien: boolean): void {
  const e = asegurarEj(label);
  e.intentos++;
  if (bien) e.resuelto = true;
  else {
    e.fallos++;
    e.resuelto = false;
  }
  e.t = Date.now();
  guardar('ejercicios');
}

export function usarPista(label: string, n: number): void {
  const e = asegurarEj(label);
  if (n > e.pistas) {
    e.pistas = n;
    e.t = Date.now();
    guardar('ejercicios');
  }
}

export function verSolucion(label: string): void {
  const e = asegurarEj(label);
  if (!e.resuelto && !e.solucion) {
    e.solucion = true;
    e.t = Date.now();
    guardar('ejercicios');
  }
}

export function taparProblema(label: string, tapada: boolean): void {
  const e = asegurarEj(label);
  e.tapada = tapada;
  guardar('ejercicios', 100);
}

export function reiniciarEjercicio(label: string): void {
  delete aprendizaje.ejercicios[label];
  guardar('ejercicios', 100);
}

// ------------------------------------------------------------------ sections read

export function esLeida(parte: string, label: string): boolean {
  return !!aprendizaje.leidas[parte]?.[label];
}

export function marcarLeida(parte: string, label: string, leida: boolean): void {
  if (leida) {
    if (aprendizaje.leidas[parte]?.[label]) return;
    aprendizaje.leidas[parte] ??= {};
    aprendizaje.leidas[parte]![label] = Date.now();
  } else {
    if (!aprendizaje.leidas[parte]?.[label]) return;
    delete aprendizaje.leidas[parte]![label];
  }
  guardar('leidas', 800);
}

// ------------------------------------------------------------------ derivations

export function pasosDeduccion(clave: string): number | undefined {
  return aprendizaje.deducciones[clave];
}

export function guardarPasos(clave: string, n: number): void {
  if (aprendizaje.deducciones[clave] === n) return;
  aprendizaje.deducciones[clave] = n;
  guardar('deducciones', 600);
}
