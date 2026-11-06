// Review 10j (exceptional 4th review, exercises' merge lib/union-ejercicios.ts). Node only:
//   npx playwright test -c playwright.revision10j.config.ts
// Findings (each test FAILS while it is open; the property test passes):
//   r10j·1/1b  one device: «Ocultar solución» / «Ver solución» of an already synchronised problem undone by the next run
//              (tests/motor-real/revision10j.ts, real engine)
//   r10j·2     solved on A; B, stale, checks one part of two later: no longer solved on either device (real engine)
//   r10j·3     A resets; B, which had not seen it, fails a check after it: merged it is «pendiente» (intentos 1, fallos 0),
//              not «fallado» — the attempt's verdict is lost and it leaves «Repasar los fallados»
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { canonico } from '../src/lib/sincronizacion/fusion';
import { unirEjercicios as U, type EjercicioUnible } from '../src/lib/union-ejercicios';
import { estadoEjercicio, marcarResuelto, ponerValores } from '../src/lib/valores-ejercicio';
import type { EstadoEjercicio } from '../src/lib/aprendizaje.svelte';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------------ own generator (independent of 10b / datos10)
let s = 10_010;
const rnd = (n: number) => {
  s = (s * 1103515245 + 12345) % 2147483648;
  return Math.floor((s / 2147483648) * n);
};
const KEYS = ['r1', 'r2', 'p1', 'texto', 'c1', '_c'];
function gen(): EjercicioUnible {
  const e = { intentos: rnd(4), fallos: rnd(3), resuelto: !!rnd(2), pistas: rnd(3), solucion: !rnd(3) } as EjercicioUnible & Record<string, unknown>;
  const ts = rnd(10);
  // (no t at all, t 0, or 1…9)
  if (ts > 0) e.t = ts === 1 ? 0 : 1 + rnd(9);
  if (rnd(3)) {
    const valores: Record<string, string> = {};
    const vt: Record<string, number> = {};
    // 0: no vt (0.12 shape), 1: partial, 2: full, 3: with explicit zeros
    const modo = rnd(4);
    for (const k of KEYS)
      if (rnd(2)) {
        valores[k] = k === '_c' ? String(1 + rnd(9)) : `v${rnd(3)}`;
        if (modo === 2 || (modo === 1 && rnd(2))) vt[k] = 1 + rnd(9);
        if (modo === 3) vt[k] = rnd(3) ? 1 + rnd(9) : 0;
      }
    e.valores = valores;
    if (modo) e.vt = vt;
  }
  if (rnd(2)) e.bien = KEYS.filter(() => !rnd(2));
  if (!rnd(3)) e.tapada = !!rnd(2);
  if (!rnd(5)) e.otro = rnd(2);
  const rs = rnd(4);
  // r absent, r 0, r 1…8, or r with no t
  if (rs === 1) e.r = 1 + rnd(8);
  else if (rs === 2) e.r = 0;
  else if (rs === 3) {
    e.r = 1 + rnd(8);
    if (rnd(2)) delete (e as Partial<EjercicioUnible>).t;
  }
  return e;
}
const C = canonico;

test('r10j · propiedades: conmutativa, asociativa, idempotente y absorbente (20 000 tríos; sin t, t 0, vt 0, r sin t, _c)', () => {
  const malos: string[] = [];
  for (let i = 0; i < 20_000 && malos.length < 3; i++) {
    const a = gen();
    const b = gen();
    const c = gen();
    const ab = U(a, b);
    if (C(ab) !== C(U(b, a))) malos.push(`conmutativa ${C([a, b])}`);
    if (C(U(ab, c)) !== C(U(a, U(b, c)))) malos.push(`asociativa ${C([a, b, c])}`);
    if (C(U(a, a)) !== C(a) || C(U(ab, ab)) !== C(ab)) malos.push(`idempotente ${C([a, b])}`);
    if (C(U(ab, b)) !== C(ab) || C(U(a, ab)) !== C(ab)) malos.push(`absorbente ${C([a, b])}`);
  }
  expect(malos).toEqual([]);
});

test('r10j · todo orden de plegado de 4 versiones da lo mismo (300 cuartetos)', () => {
  const perms = (xs: number[]): number[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
  const P = perms([0, 1, 2, 3]);
  const malos: string[] = [];
  for (let i = 0; i < 300 && malos.length < 3; i++) {
    const v = [gen(), gen(), gen(), gen()];
    const ref = C(v.reduce((x, y) => U(x, y)));
    for (const p of P) {
      const izq = C(p.map((k) => v[k]!).reduce((x, y) => U(x, y)));
      const der = C(p.map((k) => v[k]!).reduceRight((x, y) => U(y, x)));
      if (izq !== ref || der !== ref) malos.push(C(v));
    }
  }
  expect(malos).toEqual([]);
});

// ------------------------------------------------------------------ r10j·3
/** A check as lib/aprendizaje.svelte.ts registrarIntento writes it. */
function comprobado(previo: EstadoEjercicio | undefined, valores: Record<string, string>, bien: string[], completo: boolean, ahora: number): EstadoEjercicio {
  const e: EstadoEjercicio = structuredClone(previo) ?? { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: 0 };
  e.intentos++;
  if (!completo) e.fallos++;
  ponerValores(e, { ...valores, _c: String(ahora) }, ahora, true);
  // (since the fix of review 10j: only the solving check writes «resuelto», with its own time)
  if (completo) marcarResuelto(e, true, ahora);
  e.bien = bien;
  e.t = ahora;
  return e;
}
/** lib/aprendizaje.svelte.ts estadoDe on one item (since the fix: the function it calls, «fallado» with intentos > 0). */
const estado = (e: EstadoEjercicio) => estadoEjercicio(e);

test('r10j·3 · A reinicia; B, que no lo había visto, falla una comprobación después: queda «fallado» (como en B), no «pendiente» con un intento', () => {
  const T = 1_000_000;
  const comun = comprobado(comprobado(undefined, { r1: '3' }, [], false, T), { r1: '4' }, [], false, T + 1000);
  const reinicio = T + 10_000;
  const A: EstadoEjercicio = { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: reinicio, r: reinicio };
  const B = comprobado(comun, { r1: '7' }, [], false, T + 20_000);
  expect(estado(B)).toBe('fallado');
  for (const m of [U(A, B), U(B, A)]) {
    // (locally an attempt that is not «resuelto» always counts a failure: registrarIntento, autoevaluar)
    expect(m.intentos).toBe(1);
    expect(m.valores?.r1).toBe('7');
    expect(estado(m), `fallos ${m.fallos}`).toBe('fallado');
  }
});

// ------------------------------------------------------------------ r10j·1, 1b, 2: real engine
test('r10j·1/1b/2 · motor real: tapada en un dispositivo y «resuelto» frente a una comprobación parcial posterior', async () => {
  const salida = await new Promise<string>((ok) =>
    execFile(
      process.execPath,
      ['--experimental-transform-types', '--no-warnings', '--import', './tests/motor-real/registrar.mjs', 'tests/motor-real/revision10j.ts'],
      { cwd: WEB, maxBuffer: 64 << 20 },
      // (the runner exits with 1 when a case fails: its last line is still the result)
      (_err, out) => ok(out),
    ),
  );
  const r = JSON.parse(salida.trim().split('\n').pop()!) as { nombre: string; ok: boolean; error?: string }[];
  expect(r.length).toBe(3);
  expect(r.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
});
