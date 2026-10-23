// The values a plot kind reads through its roles (graficos.ts), from a formula and its current values.

import { compilar as compilarExpr, type Entorno } from '../expresion';
import type { Formula, Huecos } from '../tipos';
import { variable } from '../motor';
import { exprLinea } from '../mates';
import { ROLES_G, type Contexto } from './graficos';

export function contextoGrafico(f: Formula, hs: Huecos, valores: Entorno, objetivo: string): Contexto {
  const simVar = (id: string): string => f.vars.find((v) => v.id === id)?.sim ?? id;
  const res = variable(f, f.resultado);
  const unidadExpr = (rol: string): string => {
    if (['a', 'b', 'c', 'd', 'r'].includes(rol)) {
      const r = hs.r && f.vars.find((v) => v.id === hs.r);
      return r ? r.unidad : (res?.unidad ?? '');
    }
    return ROLES_G[rol]?.[1] ?? '';
  };
  return {
    v: (rol) => {
      const s = hs[rol];
      if (s === undefined || s.startsWith('#')) return undefined;
      try {
        const x = compilarExpr(s)(valores);
        return Number.isFinite(x) ? x : undefined;
      } catch {
        return undefined;
      }
    },
    sim: (rol) => {
      const s = hs[rol];
      if (s && f.vars.some((v) => v.id === s)) return simVar(s);
      // an expression: written out in the diagrams of terms, the role's own symbol elsewhere
      if (s && ['a', 'b', 'c', 'd', 'r', 'Vf', 'V0'].includes(rol) && !/^[-\d.]+$/.test(s) && !s.startsWith('#')) {
        const h = exprLinea(s, simVar);
        if (h.replace(/<[^>]+>/g, '').length <= 22) return h;
      }
      return ROLES_G[rol]?.[0] ?? rol;
    },
    unidad: (rol) => {
      const s = hs[rol];
      const v = s ? f.vars.find((x) => x.id === s) : undefined;
      return v ? v.unidad : unidadExpr(rol);
    },
    obj: (rol) => hs[rol] === objetivo,
  };
}
