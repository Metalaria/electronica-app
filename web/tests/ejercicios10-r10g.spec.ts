// Fix round of review 10g (1.0 exercises): regression tests beyond the reviewer's (tests/revision10g-*.spec.ts).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejercicios10.config.ts tests/ejercicios10-r10g.spec.ts
// (the tests without «navegador» need no server: EPA_SIN_SERVIDOR=1 … -g "unidad|borrador|motor|otros")
import { execFile } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { comprobar, type Esperado } from '../src/lib/magnitudes';
import { valorComprobado } from '../src/lib/valores-ejercicio';
import { enunciadoDe, variantes } from '../src/componentes/practica/variantes';
import type { ItemNumerico } from '../src/componentes/practica/tipos';
import type { EstadoEjercicio } from '../src/lib/aprendizaje.svelte';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRACTICA = join(WEB, 'public', 'libro', 'practica');
const items = (): ItemNumerico[] =>
  readdirSync(PRACTICA)
    .filter((f) => /^(cap|ap)\w+\.json$/.test(f))
    .flatMap((f) => JSON.parse(readFileSync(join(PRACTICA, f), 'utf-8')).items ?? [])
    .filter((x: ItemNumerico) => x?.tipo === 'numerico');
const e = (valor: number, unidad: string): Esperado => ({ valor, unidad, texto: '', tol: 0.02 });

test('unidad: potencias de diez con superíndice, con ^ o sin mantisa', () => {
  expect(comprobar('10⁴ rad/s', e(1e4, 'rad/s')).tipo).toBe('bien');
  expect(comprobar('10^4 rad/s', e(1e4, 'rad/s')).tipo).toBe('bien');
  expect(comprobar('10^(4)', e(1e4, 'rad/s')).tipo).toBe('bien');
  expect(comprobar('10⁻³ A', e(1e-3, 'A')).tipo).toBe('bien');
  expect(comprobar('−10⁻³', e(-1e-3, 'A')).tipo).toBe('bien');
  expect(comprobar('1e4', e(1e4, 'rad/s')).tipo).toBe('bien');
  expect(comprobar('4,7 × 10³ Ω', e(4700, 'Ω')).tipo).toBe('bien');
  expect(comprobar('2,5 mm²', e(2.5, 'mm²')).tipo).toBe('bien');
  // a plain 10 or 104 is still a number
  expect(comprobar('104', e(104, '')).tipo).toBe('bien');
  expect(comprobar('10 V', e(10, 'V')).tipo).toBe('bien');
});

test('unidad: horas, minutos y segundos, y áreas, se convierten; otra magnitud se rechaza con un mensaje cierto', () => {
  expect(comprobar('2 h', e(7200, 's')).tipo).toBe('bien');
  expect(comprobar('120 min', e(2, 'h')).tipo).toBe('bien');
  expect(comprobar('7200 s', e(2, 'h')).tipo).toBe('bien');
  expect(comprobar('0,5 min', e(30, 's')).tipo).toBe('bien');
  expect(comprobar('2,5 × 10⁻⁶ m²', e(2.5, 'mm²')).tipo).toBe('bien');
  expect(comprobar('0,025 cm²', e(2.5, 'mm²')).tipo).toBe('bien');
  expect(comprobar('2,5 mm²', e(2.5e-6, 'm²')).tipo).toBe('bien');
  const v = comprobar('2 H', e(2, 'h'));
  expect(v.tipo).toBe('unidad');
  expect(v.tipo === 'unidad' && v.mensaje).toContain('se pide en h');
});

test('borrador: sin hora de comprobación y sin intentos no tiene veredicto; una comprobación sella sus valores', () => {
  const base: EstadoEjercicio = { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: 0, valores: { r1: '5' }, vt: { r1: 10 } };
  expect(valorComprobado(base, 'r1')).toBe(false);
  // data of 0.12: values only came from checks
  expect(valorComprobado({ ...base, intentos: 1, t: 5, vt: undefined }, 'r1')).toBe(true);
  // after a check at 20 that stamped r1, a draft in r2 at 30
  const c: EstadoEjercicio = { ...base, intentos: 1, t: 20, valores: { r1: '5', r2: '7', _c: '20' }, vt: { r1: 20, r2: 30, _c: 20 } };
  expect(valorComprobado(c, 'r1')).toBe(true);
  expect(valorComprobado(c, 'r2')).toBe(false);
  // a draft older than the (other device's) check is not taken for checked either
  expect(valorComprobado({ ...c, vt: { r1: 20, r2: 15, _c: 20 } }, 'r2')).toBe(false);
});

test('motor real: borradores frente al estado resuelto de otro dispositivo (escenarios e10)', async () => {
  test.setTimeout(300_000);
  const salida = await new Promise<string>((ok, mal) =>
    execFile(
      process.execPath,
      ['--experimental-transform-types', '--no-warnings', '--import', './tests/motor-real/registrar.mjs', 'tests/motor-real/correr.ts', 'casos', 'e10'],
      { cwd: WEB, maxBuffer: 64 << 20 },
      (err, out) => (err ? mal(err) : ok(out)),
    ),
  );
  const r = JSON.parse(salida.trim().split('\n').pop()!) as { nombre: string; ok: boolean; error?: string }[];
  expect(r.length).toBe(3);
  expect(r.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
});

test('otros valores: prob-8.A cabe en un TO-220 (≤ 20 W, ≤ 1,5 A) y ej-8.4 deja al LM317 su corriente mínima', () => {
  const p8 = items().find((x) => x.id === 'cap08-num-prob-8.A')!;
  for (const v of variantes(p8)) {
    const x = v.valores as Record<string, number>;
    expect(v.resultado, JSON.stringify(x)).toBeLessThanOrEqual(20);
    expect(x.I!).toBeLessThanOrEqual(1.5);
  }
  const p84 = items().find((x) => x.id === 'cap08-num-ej-8.4')!;
  for (const v of variantes(p84)) expect((v.valores as Record<string, number>).R_1!).toBeLessThanOrEqual(240);
  expect(variantes(p84).length).toBeGreaterThanOrEqual(8);
});

test('otros valores: los enunciados que escribe la aplicación tratan de usted («Calcule…»)', () => {
  for (const it of items().filter((x) => !x.ejercicio)) {
    const v = variantes(it)[0];
    if (v) expect(enunciadoDe(it, v), it.id).not.toMatch(/^Calcula\b/);
  }
  const pagina = readFileSync(join(WEB, 'src', 'componentes', 'problema', 'PaginaProblema.svelte'), 'utf-8');
  expect(pagina).not.toMatch(/Problema del día · Calcula"/);
});

// ---------------------------------------------------------------------------------------------------- browser

async function preparar(page: Page, datos: Record<string, unknown>): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript((d) => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'claro', tam: 18 }));
      for (const [k, v] of Object.entries(d)) localStorage.setItem(`epa:${k}`, JSON.stringify(v));
    }
  }, datos);
}

test('navegador: un problema del día ya respondido cuyo ítem se retiró se ve con su resultado, sin error', async ({ page }) => {
  await preparar(page, {
    'problema-dia': {
      version: 1,
      dias: { '2026-11-06': { id: 'cap06-num-prob-6.C', k: 'practica', parte: 'cap06', semilla: 3, curso: 'completo', t: Date.parse('2026-11-06T08:00:00'), r: { bien: true, intentos: 1, t: Date.parse('2026-11-06T08:05:00') } } },
    },
  });
  await page.clock.setFixedTime(new Date(2026, 10, 6, 10, 0, 0));
  await page.goto('#/problema');
  const d = page.locator('[data-problema-dia="2026-11-06"]');
  await expect(d).toHaveAttribute('data-estado', 'listo', { timeout: 30_000 });
  await expect(d.locator('[data-retirado]')).toContainText('su resultado se conserva');
  await expect(d.locator('[data-veredicto-dia]')).toContainText('Resuelto hoy a la primera');
});
