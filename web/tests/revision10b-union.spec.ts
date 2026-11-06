// Review 10b: an independent property test of the exercises' merge (lib/union-ejercicios.ts) against a reference model,
// with its own generator (several resets, 0.12-shaped items without vt, partial vt, equal times, extra fields), folds
// of four versions in every order, and the migration ejercicios 1 → 2 before the merge. Node only (no page); run it with
// any config whose server is up, e.g.
//   EPA_DIST=/tmp/claude-0/epa-revision10b/dist EPA_PUERTO=4661 npx playwright test -c playwright.datos10.config.ts tests/revision10b-union.spec.ts
import { expect, test } from '@playwright/test';
import { canonico } from '../src/lib/sincronizacion/fusion';
import { migrarValor } from '../src/lib/esquemas';
import { unirEjercicios, type EjercicioUnible } from '../src/lib/union-ejercicios';
import { migrarAlmacen, restaurarAntesDeMigrar } from '../src/lib/migrar';
import type { Almacen } from '../src/lib/almacen';

let s = 70001;
const rnd = (n: number) => {
  s = (s * 1103515245 + 12345) % 2147483648;
  return Math.floor((s / 2147483648) * n);
};
const KEYS = ['texto', 'c1', 'c2', 'e1'];

function gen(conVt0 = false): EjercicioUnible {
  const t = 1 + rnd(8);
  const e: EjercicioUnible & Record<string, unknown> = { intentos: rnd(5), fallos: rnd(3), resuelto: !!rnd(2), pistas: rnd(3), solucion: !rnd(3), t };
  if (rnd(4)) {
    e.valores = {};
    const vt: Record<string, number> = {};
    const sinVt = !rnd(3); // a 0.12-shaped item
    for (const k of KEYS)
      if (rnd(2)) {
        e.valores[k] = `v${rnd(3)}`;
        if (!sinVt && rnd(4)) vt[k] = conVt0 && !rnd(6) ? 0 : 1 + rnd(t);
      }
    if (!sinVt) e.vt = vt;
  }
  // (sorted and never empty: the reset branch keeps the winner's `bien` as it is, the other branch sorts it — a textual difference only)
  if (rnd(2)) e.bien = KEYS.filter(() => !rnd(3)).sort();
  if (e.bien && !e.bien.length) delete e.bien;
  if (rnd(2)) e.tapada = !!rnd(2);
  if (!rnd(3)) e.otro = rnd(2);
  if (rnd(2)) e.r = 1 + rnd(6);
  return e;
}

const tk = (e: EjercicioUnible, k: string) => (typeof e.vt?.[k] === 'number' ? e.vt[k]! : e.t);

/** The reference: the newest reset's versions decide everything but the answers typed after it anywhere. */
function modelo(xs: EjercicioUnible[]) {
  const R = Math.max(...xs.map((e) => e.r ?? 0));
  const G = xs.filter((e) => (e.r ?? 0) === R);
  const valores: Record<string, { x: number; v: string }> = {};
  // (review 10j, data agent: `resuelto`/`tapada` are the keys `_r`/`_o` of `valores`; an item without them has them at
  // its own t when solved / when `tapada` is set)
  const marcas = (e: EjercicioUnible): Record<string, string> => ({
    ...(e.resuelto ? { _r: '1' } : {}),
    ...(typeof e.tapada === 'boolean' ? { _o: e.tapada ? '1' : '' } : {}),
    ...(e.valores ?? {}),
  });
  for (const e of xs)
    for (const [k, v] of Object.entries(marcas(e))) {
      const x = tk(e, k);
      if (!G.includes(e) && !(x > R)) continue;
      const m = valores[k];
      if (!m || x > m.x || (x === m.x && v > m.v)) valores[k] = { x, v };
    }
  return {
    // (review 10i, data agent: a version that had not seen the newest reset and whose `t` is after it — a real attempt
    // after the reset — counts as one attempt; its counters before the reset stay out)
    intentos: Math.max(...G.map((e) => e.intentos), ...xs.filter((e) => !G.includes(e) && e.t > R).map(() => 1)),
    fallos: Math.max(...G.map((e) => e.fallos)),
    pistas: Math.max(...G.map((e) => e.pistas)),
    solucion: G.some((e) => e.solucion),
    valores: Object.fromEntries(Object.entries(valores).map(([k, m]) => [k, m.v])),
    resuelto: !!valores._r?.v.startsWith('1'),
    tapada: valores._o ? valores._o.v === '1' : undefined,
  };
}

const perms = <T>(a: T[]): T[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
const plegar = (xs: EjercicioUnible[]) => xs.reduce((a, b) => unirEjercicios(a, b));

test('r10b · unión de ejercicios: el modelo, todo orden de 4 versiones, idempotencia y migración previa (1500 cuartetos)', () => {
  for (let i = 0; i < 1500; i++) {
    const xs = [gen(), gen(), gen(), gen()];
    const m = modelo(xs);
    let ref: string | null = null;
    for (const p of perms(xs)) {
      const u = plegar(p);
      const c = canonico(u);
      ref ??= c;
      expect(c, `orden ${i}`).toBe(ref);
    }
    const u = plegar(xs);
    // a different tree shape too: (a∪b)∪(c∪d)
    expect(canonico(unirEjercicios(unirEjercicios(xs[0]!, xs[1]!), unirEjercicios(xs[2]!, xs[3]!))), `árbol ${i}`).toBe(ref);
    expect(canonico(unirEjercicios(u, xs[2]!)), `idempotente ${i}`).toBe(ref);
    expect(canonico(unirEjercicios(u, u)), `idempotente consigo ${i}`).toBe(ref);
    const distintos = new Set(xs.map((x) => canonico(x))).size;
    if (distintos > 1) {
      expect({ intentos: u.intentos, fallos: u.fallos, pistas: u.pistas, solucion: u.solucion }, `contadores ${i}`).toEqual({ intentos: m.intentos, fallos: m.fallos, pistas: m.pistas, solucion: m.solucion });
      expect(u.valores ?? {}, `valores ${i}`).toEqual(m.valores);
      expect({ resuelto: u.resuelto, tapada: u.tapada }, `resuelto/tapada ${i}`).toEqual({ resuelto: m.resuelto, tapada: m.tapada });
      // every key of a merge carries its time
      for (const k of Object.keys(u.valores ?? {})) expect(typeof u.vt?.[k], `vt ${k} ${i}`).toBe('number');
    }
    // the migration 1 → 2 changes no result of the merge (it writes what the merge would assume)
    const mig = xs.map((x) => migrarValor('ejercicios', 1, { e: x }) as { e: EjercicioUnible }).map((o) => o.e);
    expect(migrarValor('ejercicios', 1, { e: mig[0] })).toEqual({ e: mig[0] });
    expect(canonico(plegar(mig).valores ?? {}), `migrado ${i}`).toBe(canonico(u.valores ?? {}));
  }
});

test('r10b · con vt = 0 explícito (dato raro): sigue asociativa', () => {
  const malos: number[] = [];
  for (let i = 0; i < 3000; i++) {
    const xs = [gen(true), gen(true), gen(true)];
    const a = canonico(unirEjercicios(unirEjercicios(xs[0]!, xs[1]!), xs[2]!));
    const b = canonico(unirEjercicios(xs[0]!, unirEjercicios(xs[1]!, xs[2]!)));
    if (a !== b) malos.push(i);
  }
  expect(malos.length, `no asociativa en ${malos.length} de 3000 (p. ej. ${malos.slice(0, 3)})`).toBe(0);
});

// r10b·3: the pre-migration backup when the first start migrated SOME keys only (a write of the second failed, or the
// start was cut between them): the next start migrates the rest — and its backup (other targets) replaces the first,
// so the original of the key migrated first is no longer in it, and «Restaurarlos…» brings back only part of 0.12's data.
test('r10b·3 · copia previa: una migración a medias no pierde el original de la clave ya migrada', async () => {
  const ej012 = { 'cap01/e1': { intentos: 1, fallos: 0, resuelto: false, pistas: 0, solucion: false, valores: { texto: 'a' }, t: 1000 } };
  const dias012 = { '2026-10-20': { pasos: 4, preguntas: 2, secciones: 1, cumplido: true, t: 1000 } };
  const datos = new Map<string, string>([['ejercicios', JSON.stringify(ej012)], ['progreso-diario', JSON.stringify(dias012)]]);
  let fallar = true;
  const a: Almacen = {
    tipo: 'memoria',
    async leer<T>(k: string) {
      const v = datos.get(k);
      return v === undefined ? undefined : (JSON.parse(v) as T);
    },
    async escribir(k: string, v: unknown) {
      if (fallar && k === 'progreso-diario') throw new Error('cuota');
      datos.set(k, JSON.stringify(v));
    },
  };
  const r1 = await migrarAlmacen(a);
  expect(r1.migradas).toEqual(['ejercicios']);
  fallar = false;
  const r2 = await migrarAlmacen(a);
  expect(r2.migradas).toEqual(['progreso-diario']);
  await restaurarAntesDeMigrar(a);
  expect(JSON.parse(datos.get('progreso-diario')!)).toEqual(dias012);
  expect(JSON.parse(datos.get('ejercicios')!), 'el original de «ejercicios» ya no está en la copia').toEqual(ej012);
});
