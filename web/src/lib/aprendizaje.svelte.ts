// «Aprender con el libro»: the reader's progress, stored on the device with the same storage layer as
// bookmarks and notes (Tauri plugin-store file `lector.json`, or localStorage `epa:*` in a browser):
//   ejercicios   label → attempts, solved, hints used, solution seen, last typed values
//   leidas       part → section label → time it was marked as read
//   deducciones  "<part>:<block index>" → steps revealed in that derivation
// Reactive (Svelte runes), loaded once on first use, debounced writes, flushed when the page hides.

import { anotarBorrado, anotarCambio } from './sincronizacion/marcas';
import { Guardado, guardadoDeRegistro } from './sincronizacion/guardado';
import { registrarActividad } from './progreso-diario.svelte';
import { claveDia } from '../componentes/repaso/srs';
import { emitir } from './aprendizaje/eventos';
import { unirEjercicios } from './union-ejercicios';
import {
  ayudaAlResolver,
  estadoDeBorrador,
  estadoEjercicio,
  limpiarValorEjercicio,
  marcarResuelto,
  marcarTapada,
  MAX_TEXTO_EJERCICIO,
  normalizarTextoEjercicio,
  ponerValores,
  valorComprobado,
} from './valores-ejercicio';

export { ayudaAlResolver, estadoEjercicio, MAX_TEXTO_EJERCICIO, normalizarTextoEjercicio, ponerValores, valorComprobado };

export interface EstadoEjercicio {
  /** Checks with at least one readable answer (or self-assessments). */
  intentos: number;
  /** Checks that were not all correct. */
  fallos: number;
  /** Review 10j: decided only by the solving check and the self-assessment, merged by the key `_r` of `valores`. */
  resuelto: boolean;
  /** Hints revealed (0, 1, 2). */
  pistas: number;
  /** The solution was opened before solving it. */
  solucion: boolean;
  /** Last values typed, by answer id. */
  valores?: Record<string, string>;
  /** Answer ids already right. */
  bien?: string[];
  /** Problems: the reader hides the analysis in the book while trying (review 10j: merged by the key `_o` of `valores`). */
  tapada?: boolean;
  /**
   * 1.0: per key of `valores`, when it was last typed (ms) — two devices' answers in different fields both survive the
   * synchronisation (lib/union-ejercicios.ts); absent: 0.
   */
  vt?: Record<string, number>;
  /** 1.0: reset epoch — the time of the last «Reiniciar» (lib/union-ejercicios.ts: the newer reset wins whole). */
  r?: number;
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

let carga: Promise<void> | null = null;

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** «part/label» (a part never contains «/»). */
const partir = (id: string): [string, string] => {
  const i = id.indexOf('/');
  return [id.slice(0, i), id.slice(i + 1)];
};
/** part → label → time, flattened to «part/label» → time (the synchronised store's items). */
export function aplanarLeidas(le: unknown): Record<string, number> {
  const r: Record<string, number> = {};
  if (!esObjeto(le)) return r;
  for (const [parte, secs] of Object.entries(le)) {
    if (!esObjeto(secs)) continue;
    for (const [label, t] of Object.entries(secs)) if (typeof t === 'number') r[`${parte}/${label}`] = t;
  }
  return r;
}
function anidarLeidas(m: Record<string, number>): Record<string, Record<string, number>> {
  const r: Record<string, Record<string, number>> = {};
  for (const [id, t] of Object.entries(m)) {
    const [parte, label] = partir(id);
    if (parte && label) (r[parte] ??= {})[label] = t;
  }
  return r;
}

// Written with read-merge-write (sincronizacion/guardado.ts): what the synchronisation or another tab stored meanwhile
// is never overwritten with this tab's older copy; the synchronisation's results are applied atomically.
export const guardadosAprendizaje = {
  ejercicios: guardadoDeRegistro<EstadoEjercicio>({
    claveAlmacen: 'ejercicios',
    claveSinc: 'ejercicios',
    obtener: () => aprendizaje.ejercicios,
    tiempo: (v) => (typeof v?.t === 'number' ? v.t : undefined),
    // (1.0: two writers' versions merged field by field, as the synchronisation does in the file)
    unir: (a, b) => unirEjercicios(a, b),
  }),
  deducciones: guardadoDeRegistro<number>({ claveAlmacen: 'deducciones', claveSinc: 'deducciones', obtener: () => aprendizaje.deducciones }),
  leidas: new Guardado<number>({
    claveAlmacen: 'leidas',
    claveSinc: 'leidas',
    deAlmacen: aplanarLeidas,
    aAlmacen: anidarLeidas,
    leerMemoria: () => aplanarLeidas(aprendizaje.leidas),
    cambiarMemoria: (poner, quitar) => {
      for (const [id, t] of Object.entries(poner)) {
        const [parte, label] = partir(id);
        if (!parte || !label) continue;
        aprendizaje.leidas[parte] ??= {};
        aprendizaje.leidas[parte]![label] = t;
      }
      for (const id of quitar) {
        const [parte, label] = partir(id);
        const secs = aprendizaje.leidas[parte];
        if (!secs) continue;
        delete secs[label];
        if (!Object.keys(secs).length) delete aprendizaje.leidas[parte];
      }
    },
    tiempo: (t) => t,
  }),
};

function guardar(clave: Clave, espera = 400): void {
  guardadosAprendizaje[clave].guardar(espera);
}

function volcar(): void {
  for (const g of Object.values(guardadosAprendizaje)) void g.volcar().catch(() => undefined);
}

/** Loads the stored progress (once); every component that shows progress calls it. */
export function cargarAprendizaje(): Promise<void> {
  carga ??= (async () => {
    // each key adopted in its own load step (a write queued meanwhile — the «Leída» button does not wait for the
    // load — runs after it, never from the memory before the load: fifth review); what was changed before it stays
    const g = guardadosAprendizaje;
    await Promise.all([
      g.ejercicios.cargar((m) => (aprendizaje.ejercicios = { ...m, ...aprendizaje.ejercicios })),
      g.leidas.cargar((m) => (aprendizaje.leidas = anidarLeidas({ ...m, ...aplanarLeidas(aprendizaje.leidas) }))),
      g.deducciones.cargar((m) => (aprendizaje.deducciones = { ...m, ...aprendizaje.deducciones })),
    ]);
    aprendizaje.listo = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', volcar);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') volcar();
      });
    }
  })().catch((e: unknown) => {
    // a load that failed (the storage could not be read) is tried again by the next call, not memoised for the
    // session (sixth review); nothing was taken as stored meanwhile (sincronizacion/guardado.ts)
    carga = null;
    throw e;
  });
  return carga;
}

// ------------------------------------------------------------------ exercises

export function estadoDe(label: string): Estado {
  // (review 10j, r10j·3: tried and not solved is «fallado», also with `fallos` 0 — valores-ejercicio.ts)
  return estadoEjercicio(aprendizaje.ejercicios[label]);
}

function asegurarEj(label: string): EstadoEjercicio {
  let e = aprendizaje.ejercicios[label];
  if (!e) {
    // t = 0 until a real attempt sets it (registrarIntento, autoevaluar): what only a hint, the solution opened or a draft
    // created must not decide the whole-item fields of the merge (review 10g: `resuelto` solved on another device)
    aprendizaje.ejercicios[label] = estadoDeBorrador();
    e = aprendizaje.ejercicios[label]!;
  }
  return e;
}

/** One «Comprobar»: the values typed, which answers are right, and whether everything is solved. */
export function registrarIntento(label: string, valores: Record<string, string>, bien: string[], completo: boolean): void {
  const e = asegurarEj(label);
  const antes = e.resuelto;
  e.intentos++;
  if (!completo) e.fallos++;
  // 1.0: merged key by key (the written answer and the checklist marks live in the same map); `_c` = when this check
  // happened, so a draft typed later is restored without a verdict (review 10e)
  const ahora = Date.now();
  ponerValores(e, { ...valores, _c: String(ahora) }, ahora, true);
  // review 10j: only the check that solves it writes «resuelto» (with its own time, key `_r`): a failed one never
  // undoes it, here or — merged — on another device that had not received the solve (r10j·2)
  if (completo) marcarResuelto(e, true, ahora);
  e.bien = bien;
  e.t = ahora;
  guardar('ejercicios');
  avisarEjercicio(label, e, completo, antes);
}

/** 0.11: the check as a learning event (sound, vibration, XP when it becomes solved). */
function avisarEjercicio(label: string, e: EstadoEjercicio, bien: boolean, antes: boolean): void {
  emitir({ tipo: 'respuesta', id: label, clase: 'ejercicio', origen: 'ejercicio', correcta: bien, intento: e.intentos, pistas: e.pistas, final: bien });
  if (bien && !antes) emitir({ tipo: 'ejercicio-resuelto', id: label, intentos: e.intentos, fallos: e.fallos, pistas: e.pistas, conSolucion: e.solucion });
}

/** Self-assessment after comparing with the solution (answers that are not checked automatically). */
export function autoevaluar(label: string, bien: boolean): void {
  const e = asegurarEj(label);
  const antes = e.resuelto;
  e.intentos++;
  if (!bien) e.fallos++;
  // 1.1 («razonar»): a self-assessment is a comparison with the solution, so it always counts as having seen it —
  // the owner's rule, self-assessed exercises give no XP, without exceptions. A problem shows its solution in the page
  // unless hidden, so «¿Lo tenía bien?» could be answered without `verSolucion` and was worth 15 XP (merged by OR)
  e.solucion = true;
  const ahora = Date.now();
  // review 10j: the self-assessment decides «resuelto» either way, with its own time (key `_r`)
  marcarResuelto(e, bien, ahora);
  e.t = ahora;
  guardar('ejercicios');
  avisarEjercicio(label, e, bien, antes);
}

/**
 * 1.0: the reader's written answer (key «texto»), the marks of the «lo que se pide» checklist (keys «c1»…) or, since
 * review 10e, what is being typed in a numeric field (r1…) or chosen in a structured question (p1…) of an exercise.
 * Not an attempt: it neither counts nor changes `t` (whose newest version decides resuelto in the merge);
 * saved through the debounced store, flushed by volcarEjercicios() when the panel goes away and when the page hides.
 */
export function guardarRespuestaEscrita(label: string, cambios: Record<string, string>): void {
  const limpios: Record<string, string> = {};
  for (const [k, x] of Object.entries(cambios)) limpios[k] = limpiarValorEjercicio(k, x);
  const e = aprendizaje.ejercicios[label];
  // nothing to store for an untouched exercise and an empty answer
  if (!e && Object.values(limpios).every((x) => !x)) return;
  // a draft never decides the item's whole-item fields: an item it creates gets t = 0, so on another device's solved
  // version (any t) `resuelto` is not undone by the merge (review 10g, r10g·7); its keys keep their own times in `vt`
  if (!ponerValores(asegurarEj(label), limpios)) return;
  anotarCambio('ejercicios', label);
  guardar('ejercicios', 800);
}

/** Writes now what is waiting in the exercises store (a panel with a written answer being closed). */
export function volcarEjercicios(): Promise<void> {
  return guardadosAprendizaje.ejercicios.volcar().catch(() => undefined);
}

export function usarPista(label: string, n: number): void {
  const e = asegurarEj(label);
  if (n > e.pistas) {
    // (merged by max: it needs no newer `t`, which would make this version's `resuelto` win — review 10g)
    e.pistas = n;
    anotarCambio('ejercicios', label);
    guardar('ejercicios');
  }
}

export function verSolucion(label: string): void {
  const e = asegurarEj(label);
  if (!e.resuelto && !e.solucion) {
    // (merged by OR: no newer `t`, as for the hints)
    e.solucion = true;
    anotarCambio('ejercicios', label);
    guardar('ejercicios');
  }
}

export function taparProblema(label: string, tapada: boolean): void {
  const e = asegurarEj(label);
  // review 10j, r10j·1: with its own time (key `_o`) — it does not move `t`, so as a whole-item field it lost to this
  // device's own older copy in the synchronised file
  marcarTapada(e, tapada);
  anotarCambio('ejercicios', label);
  guardar('ejercicios', 100);
}

/**
 * «Reiniciar»: 1.0 writes an empty state with a reset epoch `r` instead of deleting the item — the merge of two
 * versions (lib/union-ejercicios.ts) keeps the larger counters and the union of answers, so a deletion followed by a
 * new attempt would merge with another device's older version and bring its attempts back; the newer `r` wins whole.
 */
export function reiniciarEjercicio(label: string): void {
  const t = Math.max(Date.now(), (aprendizaje.ejercicios[label]?.t ?? 0) + 1);
  aprendizaje.ejercicios[label] = { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t, r: t };
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
    registrarActividad('seccion');
  } else {
    const t = aprendizaje.leidas[parte]?.[label];
    if (!t) return;
    // unmarking a section marked today takes it off today's activity
    if (claveDia(t) === claveDia(Date.now())) registrarActividad('seccion', -1);
    delete aprendizaje.leidas[parte]![label];
    anotarBorrado('leidas', `${parte}/${label}`);
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
  anotarCambio('deducciones', clave);
  guardar('deducciones', 600);
}
