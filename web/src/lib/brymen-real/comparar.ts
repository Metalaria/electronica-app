// 1.3: the real Brymen's reading next to the simulated one or the expected one. Only what can be computed is said:
// the difference, and whether it fits in what the meter itself can be off on that range (its accuracy, ± (% of
// reading + digits), from the same manual tables the simulated meter uses: componentes/instrumentos/motor/dmm.ts).
// What is left is the circuit's (its parts' real values within their tolerance, the supply), never guessed in detail.

import { BM_FUNCIONES, rangosCorriente, type Rango } from '../../componentes/instrumentos/motor/dmm.ts';
import { formatoSI } from '../../componentes/grafica/formato.ts';
import type { LecturaReal, PantallaReal } from './protocolo.ts';

export { pantallaPara, porQueNo, textoPantalla, textoCampo } from './lectura.ts';

const ESCALA: Record<PantallaReal['prefijo'], number> = { '': 1, n: 1e-9, µ: 1e-6, m: 1e-3, k: 1e3, M: 1e6 };

/** The ranges of the function the real meter is on, by its display (null: not one this app knows). */
function rangosDe(p: PantallaReal, l: LecturaReal): Rango[] {
  const f = BM_FUNCIONES;
  switch (p.unidad) {
    case 'V':
      if (l.diodo) return f.diodo!.rangos;
      if (p.ac && p.dc) return [...f.vacdc!.rangos, ...f.mvacdc!.rangos];
      if (p.ac) return [...f.vac!.rangos, ...f.mvac!.rangos];
      return [...f.vdc!.rangos, ...f.mvdc!.rangos];
    case 'A':
      return [...rangosCorriente('ua', 'mA', p.ac), ...rangosCorriente('amA', 'mA', p.ac), ...rangosCorriente('amA', 'A', p.ac)];
    case 'Ω':
      return l.continuidad ? f.cont!.rangos : f.ohm!.rangos;
    case 'F':
      return f.cap!.rangos;
    case 'Hz':
      return f.hz!.rangos;
    case '°C':
      return f.temp!.rangos;
    default:
      return [];
  }
}

/**
 * How far the meter itself may be off for this display (SI), from the manual's accuracy for the range whose
 * resolution is the display's last digit; null when the manual gives none or the range is not recognised (the
 * 500 000-count mode, whose accuracy the app does not have).
 */
export function incertidumbre(p: PantallaReal, l: LecturaReal): number | null {
  if (p.valor === null) return null;
  const res = 10 ** -p.decimales * ESCALA[p.prefijo];
  const r = rangosDe(p, l).find((x) => Math.abs(x.res - res) <= res * 1e-6 && Math.abs(p.valor!) <= x.max * 1.0001);
  if (!r) return null;
  const f = p.ac && l.secundaria?.unidad === 'Hz' && l.secundaria.valor !== null ? l.secundaria.valor : null;
  const ex = r.exactitud(f);
  if (!ex) return null;
  return (ex[0] / 100) * Math.abs(p.valor) + ex[1] * res;
}

const pc = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;

/**
 * The comparison in words: «Su circuito da 4,871 V; el simulado, 5,000 V: …». `referencia` names what it is compared
 * with («el simulado», «lo esperado»).
 */
export function explicarDiferencia(real: number, incert: number | null, ref: number, referencia: string, unidad: string): string {
  const d = real - ref;
  const f = (v: number) => formatoSI(v, unidad, 4);
  const rel = ref !== 0 ? Math.abs(d / ref) : null;
  let t = `Su circuito da ${f(real)}; ${referencia}, ${f(ref)}: `;
  t += d === 0 ? 'coinciden.' : `una diferencia de ${f(Math.abs(d))}${rel !== null ? ` (${pc(rel)})` : ''}.`;
  if (d === 0) return t;
  if (incert === null) return `${t} El fabricante no da la exactitud de esta escala (o el Brymen está en el modo de 500 000 cuentas): no se puede decir cuánto de ella es del instrumento.`;
  if (Math.abs(d) <= incert) return `${t} Cabe en lo que el propio Brymen puede equivocarse en esta escala (± ${f(incert)}): las dos medidas son la misma.`;
  return `${t} Es mayor que lo que el Brymen puede equivocarse en esta escala (± ${f(incert)}): la diferencia es del circuito real —los valores de sus piezas dentro de su tolerancia, la fuente—, no del instrumento.`;
}
