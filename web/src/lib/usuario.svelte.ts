// The reader's personal data: preferences, last position per part, bookmarks and notes.
// Reactive (Svelte runes) and persisted through the storage layer, with debounced writes.

import { obtenerAlmacen, registrarVolcado, type Almacen } from './almacen';
import { anotarBorrado } from './sincronizacion/marcas';
import { guardadoDeRegistro } from './sincronizacion/guardado';

export type Tema = 'auto' | 'claro' | 'sepia' | 'oscuro';

export interface Preferencias {
  tema: Tema;
  /** Text size of the reading pane in px. */
  tam: number;
  /** Book index panel hidden (desktop), by view: «libro» for the reader, else the tool's view. */
  indiceOculto?: Record<string, boolean>;
  /** «Tu nombre» for the start page's greeting (0.9; this device only, like the rest of `prefs`). */
  nombre?: string;
  /** Feedback sounds (0.11, lib/aprendizaje/retroalimentacion.ts); undefined = on. */
  sonido?: boolean;
  /** Feedback vibration (0.11); undefined = on. */
  vibracion?: boolean;
  /** Daily study reminder (0.11, Android only: lib/aprendizaje/recordatorio.ts); undefined = off at 20:00. */
  recordatorio?: { activo: boolean; hora: string };
}

export interface Posicion {
  /** Index of the top-level block at the top of the screen. */
  b: number;
  /** Section (label) being read, for display. */
  sec?: string;
  /** Fraction of the part already read (0–1). */
  f?: number;
  t: number;
}

export interface Marcador {
  parte: string;
  label: string;
  num: string;
  titulo: string;
  t: number;
}

export interface Nota extends Marcador {
  texto: string;
}

export const TAM_MIN = 14;
export const TAM_MAX = 26;
export const TAM_DEFECTO = 18;
export const LARGO_NOTA = 2000;

export const usuario = $state({
  listo: false,
  prefs: { tema: 'auto', tam: TAM_DEFECTO } as Preferencias,
  posiciones: {} as Record<string, Posicion>,
  marcadores: {} as Record<string, Marcador>,
  notas: {} as Record<string, Nota>,
  almacen: '' as string,
});

type Clave = 'prefs' | 'posiciones' | 'marcadores' | 'notas';

let almacen: Almacen | null = null;
const pendientes = new Map<Clave, ReturnType<typeof setTimeout>>();
/** The preference writes started and not finished yet (awaited before an update is installed: `volcarPrefs`). */
const enVuelo = new Set<Promise<unknown>>();
function escribirPrefs(clave: Clave): void {
  if (!almacen) return;
  const p = almacen.escribir(clave, $state.snapshot(usuario[clave])).catch(() => undefined);
  enVuelo.add(p);
  void p.finally(() => enVuelo.delete(p));
}

const tiempoPropio = (v: { t?: unknown }) => (typeof v?.t === 'number' ? v.t : undefined);
// The synchronised ones (positions, bookmarks, notes) are written with read-merge-write (sincronizacion/guardado.ts):
// what the synchronisation or another tab stored meanwhile is never overwritten with this tab's older copy.
export const guardadosUsuario = {
  posiciones: guardadoDeRegistro<Posicion>({ claveAlmacen: 'posiciones', claveSinc: 'posiciones', obtener: () => usuario.posiciones, tiempo: tiempoPropio }),
  marcadores: guardadoDeRegistro<Marcador>({ claveAlmacen: 'marcadores', claveSinc: 'marcadores', obtener: () => usuario.marcadores, tiempo: tiempoPropio }),
  notas: guardadoDeRegistro<Nota>({ claveAlmacen: 'notas', claveSinc: 'notas', obtener: () => usuario.notas, tiempo: tiempoPropio }),
};

function guardar(clave: Clave, espera = 300): void {
  if (clave !== 'prefs') {
    guardadosUsuario[clave].guardar(espera);
    return;
  }
  const t = pendientes.get(clave);
  if (t) clearTimeout(t);
  pendientes.set(
    clave,
    setTimeout(() => {
      pendientes.delete(clave);
      escribirPrefs(clave);
    }, espera),
  );
}

/** Writes everything still pending (on page hide / app close). */
export function volcar(): void {
  for (const [clave, t] of pendientes) {
    clearTimeout(t);
    escribirPrefs(clave);
  }
  pendientes.clear();
  for (const g of Object.values(guardadosUsuario)) void g.volcar().catch(() => undefined);
}

/**
 * Writes the preferences still pending and waits for every preference write started (review 0.12b, finding 6: the
 * save before installing an update waits for them, as for every other store — `registrarVolcado`).
 */
export async function volcarPrefs(): Promise<void> {
  for (const [clave, t] of pendientes) {
    clearTimeout(t);
    escribirPrefs(clave);
  }
  pendientes.clear();
  await Promise.all([...enVuelo]);
}
registrarVolcado(volcarPrefs);

let carga: Promise<void> | null = null;
/** Loads the reader's data (once; the synchronisation's stores call it too). */
export function cargarUsuario(): Promise<void> {
  carga ??= (async () => {
    almacen = await obtenerAlmacen();
    usuario.almacen = almacen.tipo;
    // each key adopted in its own load step (a write queued meanwhile runs after it, never from the memory before the
    // load — fifth review); what was changed before the load stays
    const [prefs] = await Promise.all([
      almacen.leer<Partial<Preferencias>>('prefs'),
      guardadosUsuario.posiciones.cargar((m) => (usuario.posiciones = { ...m, ...usuario.posiciones })),
      guardadosUsuario.marcadores.cargar((m) => (usuario.marcadores = { ...m, ...usuario.marcadores })),
      guardadosUsuario.notas.cargar((m) => (usuario.notas = { ...m, ...usuario.notas })),
    ]);
    if (prefs) usuario.prefs = { ...usuario.prefs, ...prefs };
    usuario.prefs.tam = Math.min(TAM_MAX, Math.max(TAM_MIN, Number(usuario.prefs.tam) || TAM_DEFECTO));
    usuario.listo = true;
  })().catch((e: unknown) => {
    // a load that failed (the storage could not be read) is tried again by the next call, not memoised for the
    // session (sixth review); nothing was taken as stored meanwhile (sincronizacion/guardado.ts)
    carga = null;
    throw e;
  });
  return carga;
}

export function ponerTema(tema: Tema): void {
  usuario.prefs.tema = tema;
  guardar('prefs', 50);
}

export function ponerTam(tam: number): void {
  usuario.prefs.tam = Math.min(TAM_MAX, Math.max(TAM_MIN, tam));
  guardar('prefs', 200);
}

export const LARGO_NOMBRE = 40;

/** Stored as typed (trimmed where it is shown, so a space can be typed between two names). */
export function ponerNombre(nombre: string): void {
  usuario.prefs.nombre = nombre.slice(0, LARGO_NOMBRE);
  guardar('prefs', 400);
}

/** «Sonidos» and «Vibración» in «Aa» (0.11, device-only). */
export function ponerSonido(activo: boolean): void {
  usuario.prefs.sonido = activo;
  guardar('prefs', 50);
}

export function ponerVibracion(activo: boolean): void {
  usuario.prefs.vibracion = activo;
  guardar('prefs', 50);
}

/** «Recordatorio diario» (0.11): on/off and the time «HH:MM» (the scheduling is recordatorio.ts's). */
export function ponerRecordatorio(r: { activo: boolean; hora: string }): void {
  usuario.prefs.recordatorio = { activo: r.activo, hora: r.hora };
  guardar('prefs', 50);
}

export function ponerIndiceOculto(clave: string, oculto: boolean): void {
  usuario.prefs.indiceOculto = { ...(usuario.prefs.indiceOculto ?? {}), [clave]: oculto };
  guardar('prefs', 50);
}

export function guardarPosicion(parte: string, p: Omit<Posicion, 't'>): void {
  const prev = usuario.posiciones[parte];
  if (prev && prev.b === p.b && prev.sec === p.sec) return;
  usuario.posiciones[parte] = { ...p, t: Date.now() };
  guardar('posiciones', 1200);
}

export function esMarcador(label: string): boolean {
  return label in usuario.marcadores;
}

export function alternarMarcador(m: Omit<Marcador, 't'>): void {
  if (m.label in usuario.marcadores) {
    delete usuario.marcadores[m.label];
    anotarBorrado('marcadores', m.label);
  } else usuario.marcadores[m.label] = { ...m, t: Date.now() };
  guardar('marcadores', 50);
}

export function quitarMarcador(label: string): void {
  delete usuario.marcadores[label];
  anotarBorrado('marcadores', label);
  guardar('marcadores', 50);
}

export function guardarNota(m: Omit<Marcador, 't'>, texto: string): void {
  const limpio = texto.trim().slice(0, LARGO_NOTA);
  if (!limpio) {
    if (m.label in usuario.notas) anotarBorrado('notas', m.label);
    delete usuario.notas[m.label];
  } else usuario.notas[m.label] = { ...m, texto: limpio, t: Date.now() };
  guardar('notas', 50);
}

export function quitarNota(label: string): void {
  delete usuario.notas[label];
  anotarBorrado('notas', label);
  guardar('notas', 50);
}
