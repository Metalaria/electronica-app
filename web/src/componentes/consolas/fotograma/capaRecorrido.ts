// Overlay of the signal journey shared by the schematic, the board and the photo of «Un fotograma»: every live net
// of the player drawn with its group colour and its pulses, and a frame around the parts that answer the current
// accesses. Each view gives the geometry of a net (`FuenteTramos`) in its own units.

import { dibujarPulsos, type Tramos } from './pulsos';
import type { Reproductor } from './reproductor';
import { ultimoHasta } from './traza';
import type { GrupoSenal } from './tipos';

export interface FuenteTramos {
  /** Oriented segments of a net (schematic net name) from its driver, or null when the view does not show it. */
  tramos(red: string, desde: string | undefined): { t: Tramos; p: Path2D } | null;
  /** Boxes of parts (references) in view units. */
  cajas(refs: string[]): [number, number, number, number][];
}

const ORDEN: GrupoSenal[] = ['reloj', 'video', 'interrupcion', 'seleccion', 'control', 'dma', 'direccion', 'datos'];

/** Parts that answer the accesses in progress (the chip of every non-internal access). */
export function chipsActivos(rep: Reproductor): string[] {
  const out = new Set<string>();
  const tr = rep.traza;
  for (let bi = 0; bi < tr.buses.length; bi++) {
    const b = tr.buses[bi]!;
    const i = ultimoHasta(b.t, rep.t);
    if (i < 0) continue;
    if (rep.t - b.t[i]! >= rep.duracion(bi, i) || b.f[i]! & 32) continue;
    for (const r of rep.ad.chips[b.def.chips[b.c[i]!]?.id ?? ''] ?? []) out.add(r);
  }
  return [...out];
}

/**
 * Draws the journey. The context must already map view units to device pixels; `k` = CSS px per unit,
 * `ancho` = line width in CSS px. Returns the number of nets drawn.
 */
export function dibujarRecorrido(
  ctx: CanvasRenderingContext2D,
  f: FuenteTramos,
  rep: Reproductor,
  k: number,
  color: (g: GrupoSenal) => string,
  ancho: number,
  dpr: number,
): number {
  let n = 0;
  const dibujadas: string[] = [];
  const vivas = [...rep.redes.values()].sort((a, b) => ORDEN.indexOf(a.grupo) - ORDEN.indexOf(b.grupo));
  for (const r of vivas) {
    const g = f.tramos(r.red, r.desde);
    if (!g) continue;
    dibujarPulsos(ctx, g.t, g.p, {
      color: color(r.grupo),
      energia: r.grupo === 'reloj' ? 0.35 : r.energia,
      nivel: r.nivel,
      k,
      avance: rep.avance,
      ancho: r.grupo === 'reloj' ? ancho * 0.7 : ancho,
      dpr,
    });
    if (r.grupo !== 'reloj') dibujadas.push(r.red);
    n++;
  }
  // the parts that answer
  const cajas = f.cajas(chipsActivos(rep));
  if (cajas.length) {
    ctx.save();
    ctx.strokeStyle = color('seleccion');
    ctx.lineWidth = (2.5 / k);
    ctx.setLineDash([8 / k, 5 / k]);
    for (const [x0, y0, x1, y1] of cajas) {
      const m = 6 / k;
      ctx.strokeRect(x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m);
    }
    ctx.restore();
  }
  (globalThis as unknown as { __epaFotogramaRedes?: unknown }).__epaFotogramaRedes = {
    n,
    redes: vivas.filter((r) => r.grupo !== 'reloj').map((r) => r.red),
    dibujadas,
    chips: chipsActivos(rep),
  };
  return n;
}
