// Review 10i (third and last review of the 1.0 «Brilliant» and exercises blocks): failing proofs that need neither a
// browser nor a server. Each test states the scenario; they fail on the reviewed tree and must pass once fixed.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10i.config.ts tests/revision10i-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unirEjercicios } from '../src/lib/union-ejercicios.ts';
import { estadoDeBorrador, ponerValores, valorComprobado } from '../src/lib/valores-ejercicio.ts';
import type { EstadoEjercicio } from '../src/lib/aprendizaje.svelte.ts';
import { MIGRACIONES } from '../src/lib/esquemas.ts';
import { comprobar } from '../src/lib/magnitudes.ts';
import { calcular } from '../src/componentes/calculadoras/motor.ts';
import { enunciadoDe, valorTexto, variantes } from '../src/componentes/practica/variantes.ts';
import type { ItemNumerico, ItemPractica } from '../src/componentes/practica/tipos.ts';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libro = path.join(web, 'public', 'libro');
const J = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(libro, p), 'utf8')) as T;
const numerico = (parte: string, id: string): ItemNumerico => {
  const it = J<{ items: ItemPractica[] }>(`practica/${parte}.json`).items.find((x) => x.id === id);
  expect(it?.tipo, id).toBe('numerico');
  return it as ItemNumerico;
};

const M = 60_000;
const T0 = new Date(2026, 10, 6, 12).getTime();
const base = (): EstadoEjercicio => ({ intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: 0 });

/** What aprendizaje.svelte.ts registrarIntento writes for one «Comprobar» at `ahora`. */
function comprobado(previo: EstadoEjercicio | undefined, valores: Record<string, string>, bien: string[], completo: boolean, ahora: number): EstadoEjercicio {
  const e: EstadoEjercicio = structuredClone(previo ?? estadoDeBorrador());
  e.intentos++;
  if (!completo) e.fallos++;
  if (completo) e.resuelto = true;
  ponerValores(e, { ...valores, _c: String(ahora) }, ahora, true);
  e.bien = bien;
  e.t = ahora;
  return e;
}

// ---------------------------------------------------------------------------------------------- exercises' data

test.describe('r10i·1 (medio) «Reiniciar» en un dispositivo borra lo resuelto DESPUÉS en otro que no lo había visto (union-ejercicios.ts, rama del reinicio)', () => {
  test('A reinicia; B, sin sincronizar, lo resuelve 20 min después: tras sincronizar sigue resuelto y el veredicto restaurado cuadra', () => {
    // both devices know a failed attempt
    const comun = comprobado(undefined, { r1: '4' }, [], false, T0);
    // A: «Reiniciar» (aprendizaje.svelte.ts reiniciarEjercicio) at T0 + 10 min
    const a: EstadoEjercicio = { ...base(), t: T0 + 10 * M, r: T0 + 10 * M };
    // B, offline since before the reset, checks the right answer at T0 + 30 min: a real attempt, AFTER the reset
    // (since review 10g only an attempt moves `t`, so b.t > a.r says exactly that)
    const b = comprobado(comun, { r1: '5' }, ['r1'], true, T0 + 30 * M);
    for (const m of [unirEjercicios(a, b), unirEjercicios(b, a)]) {
      // today: the reset wins whole — intentos 0, resuelto false — but B's values and its check time `_c` are kept
      // (typed after the reset), so the panel shows r1 = 5 with its ✓ on an exercise that counts as never tried
      expect(m.valores?.r1).toBe('5');
      expect(valorComprobado(m, 'r1') && !m.resuelto, 'veredicto ✓ restaurado en un ejercicio «pendiente»').toBe(false);
      expect(m.resuelto, 'el ejercicio resuelto después del reinicio ha dejado de estarlo').toBe(true);
      expect(m.intentos).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe('r10i·2 (bajo-medio) un borrador sobre datos de la 0.12 vuelve con veredicto (valores-ejercicio.ts valorComprobado sin _c)', () => {
  test('ejercicio comprobado en la 0.12 (migrado: vt = t, sin _c); en la 1.0 se escribe otro valor sin comprobar', () => {
    const de012 = { e: { intentos: 2, fallos: 2, resuelto: false, pistas: 0, solucion: false, valores: { r1: '4' }, t: T0 } };
    const mig = MIGRACIONES.find((x) => x.clave === 'ejercicios')!;
    const e = (mig.local(de012) as typeof de012).e as EstadoEjercicio;
    expect(valorComprobado(e, 'r1'), 'el valor comprobado en la 0.12 conserva su veredicto').toBe(true);
    // the reader types 5 in the field and leaves without «Comprobar» (guardarRespuestaEscrita → ponerValores)
    ponerValores(e, { r1: '5' }, T0 + 60 * M);
    // without `_c`, valorComprobado answers «some attempt» → true: the draft comes back with ✓/✗, a free check
    // that never counted as an attempt (review 10g fixed this only for items without attempts)
    expect(valorComprobado(e, 'r1'), 'un borrador escrito después de la última comprobación se restaura sin veredicto').toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------- answers checked

test.describe('r10i·3 (medio) femto: «744 fF», la respuesta tal como la escribe la app, se rechaza (magnitudes.ts PREFIJOS sin f)', () => {
  test('cap27-num-cf-transimpedancia: cada variante cuya solución sale en fF acepta su propia solución', () => {
    const it = numerico('cap27', 'cap27-num-cf-transimpedancia');
    const vo = it.formula.vars.find((v) => v.id === it.objetivo)!;
    const malas: string[] = [];
    for (const v of variantes(it)) {
      const txt = valorTexto(v.resultado, vo.unidad);
      const r = comprobar(txt, { valor: v.resultado, unidad: vo.unidad, tol: it.tol, texto: txt });
      if (r.tipo !== 'bien') malas.push(`${txt} → ${r.tipo}: ${'mensaje' in r ? r.mensaje : ''}`);
    }
    expect(malas, 'la solución mostrada por la app no se acepta al escribirla').toEqual([]);
  });
  test('y en general: 2,2 fF, 470 fA, 500 fs', () => {
    expect(comprobar('2,2 fF', { valor: 2.2e-15, unidad: 'F', tol: 0.02, texto: '' }).tipo).toBe('bien');
    expect(comprobar('470 fA', { valor: 4.7e-13, unidad: 'A', tol: 0.02, texto: '' }).tipo).toBe('bien');
    expect(comprobar('500 fs', { valor: 5e-13, unidad: 's', tol: 0.02, texto: '' }).tipo).toBe('bien');
  });
});

test.describe('r10i·4 (medio) «otros valores»: el resultado calculado con los datos tal como se muestran se rechaza (variantes.ts, 3 cifras)', () => {
  test('cap26-num-shockley: el enunciado da V_T con tres cifras y la exponencial amplifica el redondeo por encima del 2 %', () => {
    const it = numerico('cap26', 'cap26-num-shockley');
    const vo = it.formula.vars.find((v) => v.id === it.objetivo)!;
    // the inputs as the statement writes them (enunciadoDe → valorTexto, 3 significant figures), read back
    const PRE: Record<string, number> = { f: 1e-15, p: 1e-12, n: 1e-9, µ: 1e-6, m: 1e-3, '': 1, k: 1e3, M: 1e6 };
    const leido = (t: string, u: string) => {
      const m = new RegExp(`^(-?[\\d,]+)\\s*([fpnµmkM]?)${u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).exec(t.replace(/ | /g, ' ').trim());
      expect(m, `«${t}»`).not.toBeNull();
      return Number(m![1]!.replace(',', '.')) * PRE[m![2]!]!;
    };
    const malas: string[] = [];
    for (const v of variantes(it)) {
      const mostrado: Record<string, number> = {};
      for (const x of it.formula.vars) if (x.id !== it.objetivo) mostrado[x.id] = x.unidad ? leido(valorTexto(v.valores[x.id]!, x.unidad), x.unidad) : v.valores[x.id]!;
      const r = calcular(it.formula, it.objetivo, mostrado).valor;
      const txt = valorTexto(r, vo.unidad);
      const c = comprobar(txt, { valor: v.resultado, unidad: vo.unidad, tol: it.tol, texto: valorTexto(v.resultado, vo.unidad) });
      if (c.tipo !== 'bien') malas.push(`${enunciadoDe(it, v).replace(/<[^>]+>/g, '')} → ${txt}: ${'mensaje' in c ? c.mensaje : c.tipo}`);
    }
    expect(malas, 'el cálculo correcto con los datos del enunciado no se acepta').toEqual([]);
  });
});
