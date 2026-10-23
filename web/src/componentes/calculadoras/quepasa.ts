// «¿Qué pasa si…?»: how the result moves when each input grows, computed from the formula itself. For an
// input on a logarithmic scale the reader doubles it; when the result is a power law of that input (the
// local elasticity d ln y / d ln x is the same at ×1, ×2 and ×4) the effect is stated as a proportionality
// («f_c ∝ 1/R: doblar R divide f_c entre 2»). Linear inputs (temperatures, decibels, ratios) step by a tenth
// of their typical range. Plain TypeScript.

import type { Entorno } from './expresion';
import type { Formula, VarFormula } from './tipos';
import { calcular, entradas } from './motor';
import { formatoValor, MENOS } from './unidades';

export interface Efecto {
  v: VarFormula;
  /** The result goes up (true), down (false) or does not move (null). */
  sube: boolean | null;
  /** Exponent when the result is a power law of this input (1, −1, 2, ½…). */
  exponente: number | null;
  /** «∝ 1/R» (HTML, with the symbols). */
  ley: string;
  /** What the change does, in words (HTML). */
  texto: string;
  /** The change applied by «Probar». */
  cambio: string;
  nuevo: number;
  antes: number;
  despues: number;
  /** |elasticity| on a 0–1 scale for the strength bar. */
  fuerza: number;
}

/** Units where a negative value is a level, not a sign: no «|x|» for them. */
const LINEALES = new Set(['dB', 'dBm', 'dBi', 'dBc', 'dBV', '°C', '°', '%', 'K']);

const BONITOS: [number, string][] = [
  [1, '1'], [-1, '−1'], [2, '2'], [-2, '−2'], [0.5, '½'], [-0.5, '−½'], [3, '3'], [-3, '−3'], [1 / 3, '⅓'],
  [-1 / 3, '−⅓'], [1.5, '3/2'], [-1.5, '−3/2'], [0.25, '¼'], [-0.25, '−¼'], [4, '4'], [-4, '−4'],
];

function bonito(e: number): number | null {
  for (const [b] of BONITOS) if (Math.abs(e - b) < 2e-3) return b;
  return null;
}

/** «R», «R²», «√R», «1/R», «1/√L»… */
function potenciaHtml(sim: string, e: number): string {
  const s = `<span class="m-v">${sim}</span>`;
  const a = Math.abs(e);
  let base: string;
  if (a === 1) base = s;
  else if (a === 0.5) base = `√${s}`;
  else if (a === 1 / 3) base = `∛${s}`;
  else if (a === 0.25) base = `∜${s}`;
  else base = `${s}<sup>${a === 1.5 ? '3/2' : String(a)}</sup>`;
  return e < 0 ? `1/${base}` : base;
}

function factorTexto(k: number): string {
  const r = Number(k.toPrecision(3));
  const s = String(r).replace('.', ',');
  if (Math.abs(k - Math.SQRT2) < 1e-3) return `${s} (√2)`;
  return s;
}

/** Effect of each input of the formula on the value solved for. */
export function efectos(f: Formula, objetivo: string, valores: Entorno, sim: (id: string) => string): Efecto[] {
  const vObj = f.vars.find((v) => v.id === objetivo) as VarFormula;
  const y0 = calcular(f, objetivo, valores, valores[objetivo]).valor;
  const out: Efecto[] = [];
  if (!Number.isFinite(y0)) return out;
  const ys = sim(objetivo);
  const yHtml = `<span class="m-v">${ys}</span>`;
  const fmt = (y: number) => formatoValor(y, vObj.unidad, 4, true).replace(/^-/, MENOS);
  const en = (v: VarFormula, x: number): number => calcular(f, objetivo, { ...valores, [v.id]: x }, y0).valor;
  for (const v of entradas(f, objetivo)) {
    const x0 = valores[v.id];
    if (x0 === undefined || !Number.isFinite(x0)) continue;
    const xs = `<span class="m-v">${sim(v.id)}</span>`;
    let nuevo: number;
    let cambio: string;
    const multiplicativo = v.escala === 'log' && x0 > 0;
    if (multiplicativo) {
      nuevo = v.entero ? Math.max(x0 + 1, Math.round(2 * x0)) : 2 * x0;
      cambio = `doblar ${xs}`;
    } else {
      let paso = (v.max - v.min) / 10;
      const p10 = 10 ** Math.floor(Math.log10(Math.abs(paso) || 1));
      paso = Math.max(p10, Math.round(paso / p10) * p10);
      if (v.entero) paso = Math.max(1, Math.round(paso));
      nuevo = Number((x0 + paso).toPrecision(8));
      cambio = `subir ${xs} ${formatoValor(paso, v.unidad, 3, true)}`;
    }
    const y1 = en(v, nuevo);
    const e: Efecto = { v, sube: null, exponente: null, ley: '', texto: '', cambio, nuevo, antes: y0, despues: y1, fuerza: 0 };
    if (!Number.isFinite(y1)) {
      e.texto = `Al ${cambio} la fórmula deja de tener solución.`;
      out.push(e);
      continue;
    }
    const rel = Math.abs(y1 - y0) / Math.max(Math.abs(y0), 1e-300);
    if (rel < 1e-6) {
      e.texto = `${cambio[0]!.toUpperCase()}${cambio.slice(1)} no cambia ${yHtml} con estos valores.`;
      out.push(e);
      continue;
    }
    const mismoSigno = y0 !== 0 && y1 !== 0 && Math.sign(y0) === Math.sign(y1);
    // negative results (inverting gains): what grows is the magnitude
    const magnitud = y0 < 0 && mismoSigno && !LINEALES.has(vObj.unidad);
    e.sube = magnitud ? Math.abs(y1) > Math.abs(y0) : y1 > y0;
    const yRot = magnitud ? `|${yHtml}|` : yHtml;
    if (multiplicativo && mismoSigno && !v.entero) {
      const h = 1.01;
      const yp = en(v, x0 * h);
      const ym = en(v, x0 / h);
      const y4 = en(v, x0 * 4);
      const El = Math.log(Math.abs(yp / ym)) / (2 * Math.log(h));
      const E2 = Math.log(Math.abs(y1 / y0)) / Math.log(2);
      const E4 = Math.log(Math.abs(y4 / y0)) / Math.log(4);
      e.fuerza = Math.min(1, Math.abs(El) / 2);
      const b = bonito(El);
      if (b !== null && Math.abs(E2 - El) < 2e-3 && Math.abs(E4 - El) < 2e-3) {
        e.exponente = b;
        const k = 2 ** Math.abs(b);
        const abs = y0 < 0 ? `|${yHtml}|` : yHtml;
        e.ley = `${abs} ∝ ${potenciaHtml(sim(v.id), b)}`;
        e.texto = `${cambio[0]!.toUpperCase()}${cambio.slice(1)} ${b > 0 ? 'multiplica' : 'divide'} ${abs} ${b > 0 ? 'por' : 'entre'} ${factorTexto(k)}: de ${fmt(y0)} a ${fmt(y1)}.`;
        out.push(e);
        continue;
      }
    } else {
      e.fuerza = Math.min(1, rel * 4);
    }
    // relative change for quantities on a ratio scale, the difference for dB, °C, % and other linear ones
    let pctTxt: string;
    if (vObj.escala === 'log' && mismoSigno) {
      const pct = (y1 / y0 - 1) * 100;
      pctTxt = ` (${pct > 0 ? '+' : MENOS}${formatoValor(Math.abs(pct), '', 2, true)} %)`;
    } else {
      const d = y1 - y0;
      pctTxt = ` (${d > 0 ? '+' : MENOS}${formatoValor(Math.abs(d), vObj.unidad, 3, true)})`;
    }
    e.ley = `${yRot} ${e.sube ? 'sube' : 'baja'} con ${xs}`;
    e.texto = `Al ${cambio}, ${yHtml} pasa de ${fmt(y0)} a ${fmt(y1)}${pctTxt}.`;
    out.push(e);
  }
  return out;
}
