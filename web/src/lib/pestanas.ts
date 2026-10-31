// Several tabs of the web app share localStorage (lib/almacen.ts, keys `epa:*`) but each keeps its data in memory
// and writes the whole object: without this, the last tab to write wins and the other tab's progress is lost. The
// 0.11 learning stores (XP and achievements, mastery, problem of the day, courses) merge what another tab wrote into
// memory with a three-way merge per item, the base being what this tab last read or wrote:
//   - before every write, synchronously (localStorage is synchronous): if the key's text is not the one this tab last
//     read or wrote, another tab wrote it — merged first, then written (read-merge-write). So nothing depends on
//     having received every event (a tab still loading, a page restored from the back-forward cache);
//   - on the browser's `storage` event (fired in every OTHER tab when one writes) and on `pageshow` from the cache,
//     so what is on screen follows.
// In Tauri the data live in one plugin-store file of one window: nothing here runs.
//
//   const enlace = new EnlacePestanas('dominio', (v, escribirSiFalta) => { … fusionarPestanas(base, …) … });
//   enlace.activar(almacen.tipo);       right after reading the key
//   enlace.antesDeEscribir(); almacen.escribir(…); enlace.despuesDeEscribir();

import { huella } from './sincronizacion/fusion';

/** Item id → hash of the item as last read from or written to the storage by this tab. */
export type BasePestanas = Map<string, string>;

export function huellasDe(m: Record<string, unknown> | null | undefined): BasePestanas {
  return new Map(Object.entries(m ?? {}).map(([id, v]) => [id, huella(v)]));
}

export interface FusionPestanas<T> {
  mapa: Record<string, T>;
  /** The result differs from this tab's memory (refresh what is derived from it). */
  cambiado: boolean;
  /** The result differs from what the other tab wrote (write it back, or this tab's items would be lost). */
  reescribir: boolean;
}

/**
 * Three-way merge of one map: an item only one side changed since the base takes that side; changed on both, `unir`
 * decides (it must be deterministic and symmetric, so both tabs keep the same); deleted on one side and unchanged on
 * the other, it stays deleted; new on one side, it is kept.
 */
export function fusionarPestanas<T>(base: BasePestanas, local: Record<string, T>, entrante: Record<string, T>, unir: (local: T, entrante: T) => T): FusionPestanas<T> {
  const mapa: Record<string, T> = {};
  let cambiado = false;
  let reescribir = false;
  const ids = new Set([...Object.keys(local), ...Object.keys(entrante)]);
  for (const id of ids) {
    const hb = base.get(id);
    const enLocal = Object.prototype.hasOwnProperty.call(local, id);
    const enEntrante = Object.prototype.hasOwnProperty.call(entrante, id);
    if (enLocal && enEntrante) {
      const l = local[id] as T;
      const e = entrante[id] as T;
      const hl = huella(l);
      const he = huella(e);
      let r: T;
      if (hl === he) r = l;
      else if (hl === hb) r = e;
      else if (he === hb) r = l;
      else r = unir(l, e);
      const hr = r === l ? hl : r === e ? he : huella(r);
      if (hr !== hl) cambiado = true;
      if (hr !== he) reescribir = true;
      mapa[id] = r;
    } else if (enLocal) {
      const l = local[id] as T;
      // unchanged here and gone there: deleted in the other tab
      if (hb !== undefined && huella(l) === hb) {
        cambiado = true;
        continue;
      }
      mapa[id] = l;
      reescribir = true;
    } else {
      const e = entrante[id] as T;
      // deleted here (not yet written) and unchanged there: stays deleted
      if (hb !== undefined && huella(e) === hb) {
        reescribir = true;
        continue;
      }
      mapa[id] = e;
      cambiado = true;
    }
  }
  return { mapa, cambiado, reescribir };
}

/** Calls `fn` with the new value of `epa:<clave>` each time another tab writes it (never for this tab's writes). */
export function alCambiarEnOtraPestana(clave: string, fn: (valor: unknown) => void): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', (ev) => {
    if (ev.key !== `epa:${clave}` || ev.newValue == null) return;
    let v: unknown;
    try {
      v = JSON.parse(ev.newValue);
    } catch {
      return;
    }
    try {
      fn(v);
    } catch (e) {
      console.warn(`No se pudo fusionar «${clave}» escrito en otra pestaña`, e);
    }
  });
}

/** The read-merge-write of one key between tabs (see the header). */
export class EnlacePestanas {
  private activo = false;
  /** The key's text as this tab last read or wrote it. */
  private texto: string | null = null;
  constructor(
    private readonly clave: string,
    /** Merges another tab's value into memory; `escribirSiFalta`: write back when that tab lacked something of ours. */
    private readonly fusionar: (valor: unknown, escribirSiFalta: boolean) => void,
  ) {}

  private leer(): string | null {
    try {
      return localStorage.getItem(`epa:${this.clave}`);
    } catch {
      return null;
    }
  }

  /** Right after reading the key at load: from now on another tab's writes are merged. Only for localStorage. */
  activar(tipoAlmacen: string): void {
    if (this.activo || tipoAlmacen !== 'navegador' || typeof window === 'undefined') return;
    this.activo = true;
    this.texto = this.leer();
    alCambiarEnOtraPestana(this.clave, (v) => {
      this.texto = this.leer();
      this.fusionar(v, true);
    });
    window.addEventListener('pageshow', (ev) => {
      if (!ev.persisted) return;
      const v = this.ajeno();
      if (v !== undefined) this.fusionar(v, true);
    });
  }

  /** What another tab wrote since this tab last read or wrote the key (parsed), or undefined. */
  private ajeno(): unknown {
    if (!this.activo) return undefined;
    const t = this.leer();
    if (t == null || t === this.texto) return undefined;
    this.texto = t;
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return undefined;
    }
  }

  /** Before writing the whole object: merges what another tab wrote meanwhile (no write: the caller writes). */
  antesDeEscribir(): void {
    const v = this.ajeno();
    if (v === undefined) return;
    try {
      this.fusionar(v, false);
    } catch (e) {
      console.warn(`No se pudo fusionar «${this.clave}» escrito en otra pestaña`, e);
    }
  }

  /** Right after writing (localStorage writes synchronously when the almacen's call starts). */
  despuesDeEscribir(): void {
    if (this.activo) this.texto = this.leer();
  }
}
