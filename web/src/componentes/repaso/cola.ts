// Daily queue of a flashcard deck: which card comes next and how many are left.
//
// Order: learning cards that are due now, then the cards due today in review mixed with the new
// ones (one new card after every three reviews, while today's quota of new cards lasts), then
// learning cards due in the next 20 minutes. A card whose sibling (the reversed card of the same
// term) was answered today waits until tomorrow, unless it is in learning.

import type { Tarjeta } from './datos';
import { ADELANTO, diaMas, inicioDia, type EstadoTarjeta } from './srs';

export interface Recuento {
  nuevas: number;
  aprendiendo: number;
  repaso: number;
  /** Learning cards due later than the look-ahead window (the session can resume then). */
  proxima: number | null;
}

function hermano(id: string): string {
  return id.endsWith('~i') ? id.slice(0, -2) : `${id}~i`;
}

function enfriado(id: string, estados: Record<string, EstadoTarjeta>, hoy: number): boolean {
  const h = estados[hermano(id)];
  return !!h && h.u >= hoy;
}

interface Clasificadas {
  aprendiendo: Tarjeta[];
  repaso: Tarjeta[];
  nuevas: Tarjeta[];
  proxima: number | null;
}

function clasificar(tarjetas: Tarjeta[], estados: Record<string, EstadoTarjeta>, ahora: number, cuota: number): Clasificadas {
  const hoy = inicioDia(ahora);
  const manana = diaMas(ahora, 1);
  const aprendiendo: Tarjeta[] = [];
  const repaso: Tarjeta[] = [];
  const nuevas: Tarjeta[] = [];
  let proxima: number | null = null;
  for (const t of tarjetas) {
    const s = estados[t.id];
    if (!s) {
      if (nuevas.length < cuota && !enfriado(t.id, estados, hoy)) nuevas.push(t);
    } else if (s.e === 'r') {
      if (s.v < manana && !enfriado(t.id, estados, hoy)) repaso.push(t);
    } else if (s.v < manana) {
      aprendiendo.push(t);
      if (s.v > ahora + ADELANTO) proxima = proxima == null ? s.v : Math.min(proxima, s.v);
    }
  }
  const v = (t: Tarjeta) => estados[t.id]!.v;
  aprendiendo.sort((a, b) => v(a) - v(b));
  repaso.sort((a, b) => v(a) - v(b) || a.orden - b.orden);
  return { aprendiendo, repaso, nuevas, proxima };
}

export function recuento(tarjetas: Tarjeta[], estados: Record<string, EstadoTarjeta>, ahora: number, cuota: number): Recuento {
  const c = clasificar(tarjetas, estados, ahora, cuota);
  return { nuevas: c.nuevas.length, aprendiendo: c.aprendiendo.length, repaso: c.repaso.length, proxima: c.proxima };
}

/**
 * The next card, or null when the session is over for now.
 * `respondidas` counts the answers of this session (to interleave new cards); `evitar` is the card
 * just answered, so a learning card is not shown twice in a row when there is something else.
 */
export function siguiente(
  tarjetas: Tarjeta[],
  estados: Record<string, EstadoTarjeta>,
  ahora: number,
  cuota: number,
  respondidas: number,
  evitar: string | null = null,
): Tarjeta | null {
  const c = clasificar(tarjetas, estados, ahora, cuota);
  const vencida = c.aprendiendo.find((t) => estados[t.id]!.v <= ahora && t.id !== evitar);
  if (vencida) return vencida;
  const toca = (respondidas + 1) % 4 === 0;
  const r = c.repaso.find((t) => t.id !== evitar);
  const n = c.nuevas.find((t) => t.id !== evitar);
  if (r && n) return toca ? n : r;
  if (r || n) return (r ?? n)!;
  const pronto = c.aprendiendo.find((t) => estados[t.id]!.v <= ahora + ADELANTO && t.id !== evitar);
  if (pronto) return pronto;
  // Only the card just answered is left: show it again rather than stopping.
  return c.aprendiendo.find((t) => estados[t.id]!.v <= ahora + ADELANTO) ?? null;
}
