// «Repaso de hoy» on the start page: the flashcards due today in the deck chosen on the «Repaso» page.
// Imported lazily (it needs the glossary and the review state), after the start page is on screen.

import { cargarBaraja, tarjetasDe } from '../repaso/datos';
import { recuento } from '../repaso/cola';
import { cargarRepaso, nuevasHoy, racha, repaso } from '../repaso/estado.svelte';

export interface ResumenRepaso {
  nuevas: number;
  aprendiendo: number;
  repaso: number;
  total: number;
  mazo: string;
  racha: number;
  /** Quiz questions answered wrong, waiting in «Repasar fallos». */
  fallos: number;
}

export async function resumenRepaso(ahora = Date.now()): Promise<ResumenRepaso> {
  const [baraja] = await Promise.all([cargarBaraja(), cargarRepaso()]);
  const mazo = baraja.mazos.find((m) => m.id === repaso.ajustes.mazo) ?? baraja.mazos[0]!;
  const tarjetas = tarjetasDe(baraja, mazo.id, repaso.ajustes.inversas);
  const cuota = Math.max(0, repaso.ajustes.nuevasDia - nuevasHoy(ahora));
  const r = recuento(tarjetas, repaso.tarjetas, ahora, cuota);
  return {
    nuevas: r.nuevas,
    aprendiendo: r.aprendiendo,
    repaso: r.repaso,
    total: r.nuevas + r.aprendiendo + r.repaso,
    mazo: mazo.nombre,
    racha: racha(ahora),
    fallos: Object.keys(repaso.fallos).length,
  };
}
