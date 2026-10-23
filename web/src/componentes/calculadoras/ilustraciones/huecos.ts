// Roles of a template → values of the formula, and the small HTML→SVG conversion of symbols. Plain TypeScript.

import { compilar as compilarExpr, type Entorno } from '../expresion';
import type { Formula, Huecos, VarFormula } from '../tipos';

export interface Hueco {
  /** The variable behind the role, when the slot is a plain variable id. */
  v?: VarFormula;
  valor?: number;
  /** Fixed text of a «#text» slot. */
  texto?: string;
  mapeado: boolean;
}

export function resolver(f: Formula, huecos: Huecos, rol: string, valores: Entorno): Hueco {
  const s = huecos[rol];
  if (s === undefined) return { mapeado: false };
  if (s.startsWith('#')) return { texto: s.slice(1), mapeado: true };
  const v = f.vars.find((x) => x.id === s);
  if (v) return { v, valor: valores[v.id], mapeado: true };
  try {
    return { valor: compilarExpr(s)(valores), mapeado: true };
  } catch {
    return { mapeado: true };
  }
}

/** Symbols of the catalogue (HTML with sub/sup/i) as SVG tspans for a <text>. */
export function svgTexto(html: string): string {
  return html
    .replace(/<sub>(.*?)<\/sub>/g, '<tspan dy="0.32em" font-size="0.72em" font-style="normal">$1</tspan><tspan dy="-0.23em">​</tspan>')
    .replace(/<sup>(.*?)<\/sup>/g, '<tspan dy="-0.62em" font-size="0.72em" font-style="normal">$1</tspan><tspan dy="0.45em">​</tspan>')
    .replace(/<i>(.*?)<\/i>/g, '<tspan font-style="italic">$1</tspan>')
    .replace(/<(?!\/?tspan)[^>]+>/g, '');
}

/** Rough width of a label in em (for hit areas), from its plain text. */
export function anchoEm(html: string): number {
  const t = html.replace(/<[^>]+>/g, '').replace(/​/g, '');
  return t.length * 0.56;
}
