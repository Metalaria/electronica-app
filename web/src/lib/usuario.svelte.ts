// The reader's personal data: preferences, last position per part, bookmarks and notes.
// Reactive (Svelte runes) and persisted through the storage layer, with debounced writes.

import { obtenerAlmacen, type Almacen } from './almacen';
import { anotarBorrado } from './sincronizacion/marcas';

export type Tema = 'auto' | 'claro' | 'sepia' | 'oscuro';

export interface Preferencias {
  tema: Tema;
  /** Text size of the reading pane in px. */
  tam: number;
  /** Book index panel hidden (desktop), by view: «libro» for the reader, else the tool's view. */
  indiceOculto?: Record<string, boolean>;
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

function guardar(clave: Clave, espera = 300): void {
  const t = pendientes.get(clave);
  if (t) clearTimeout(t);
  pendientes.set(
    clave,
    setTimeout(() => {
      pendientes.delete(clave);
      void almacen?.escribir(clave, $state.snapshot(usuario[clave]));
    }, espera),
  );
}

/** Writes everything still pending (on page hide / app close). */
export function volcar(): void {
  for (const [clave, t] of pendientes) {
    clearTimeout(t);
    void almacen?.escribir(clave, $state.snapshot(usuario[clave]));
  }
  pendientes.clear();
}

export async function cargarUsuario(): Promise<void> {
  almacen = await obtenerAlmacen();
  usuario.almacen = almacen.tipo;
  const [prefs, posiciones, marcadores, notas] = await Promise.all([
    almacen.leer<Partial<Preferencias>>('prefs'),
    almacen.leer<Record<string, Posicion>>('posiciones'),
    almacen.leer<Record<string, Marcador>>('marcadores'),
    almacen.leer<Record<string, Nota>>('notas'),
  ]);
  if (prefs) usuario.prefs = { ...usuario.prefs, ...prefs };
  usuario.prefs.tam = Math.min(TAM_MAX, Math.max(TAM_MIN, Number(usuario.prefs.tam) || TAM_DEFECTO));
  if (posiciones) usuario.posiciones = posiciones;
  if (marcadores) usuario.marcadores = marcadores;
  if (notas) usuario.notas = notas;
  usuario.listo = true;
}

export function ponerTema(tema: Tema): void {
  usuario.prefs.tema = tema;
  guardar('prefs', 50);
}

export function ponerTam(tam: number): void {
  usuario.prefs.tam = Math.min(TAM_MAX, Math.max(TAM_MIN, tam));
  guardar('prefs', 200);
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
