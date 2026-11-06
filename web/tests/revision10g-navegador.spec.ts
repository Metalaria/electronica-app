// Review 10g (second review of the 1.0 «Brilliant» and exercises blocks): failing proofs in the browser. Each test
// states the scenario; they fail on the reviewed tree and must pass once fixed.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10g.config.ts tests/revision10g-navegador.spec.ts --workers=1
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { unirEjercicios, type EjercicioUnible } from '../src/lib/union-ejercicios.ts';

async function preparar(ctx: BrowserContext, datos: Record<string, unknown> = {}): Promise<void> {
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript((d) => {
    if (sessionStorage.getItem('r10g-preparado')) return;
    sessionStorage.setItem('r10g-preparado', '1');
    localStorage.clear();
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'claro', tam: 18 }));
    for (const [k, v] of Object.entries(d)) localStorage.setItem(`epa:${k}`, JSON.stringify(v));
  }, datos);
}
async function dispositivo(browser: Browser, datos: Record<string, unknown> = {}): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES' });
  await preparar(ctx, datos);
  return { ctx, page: await ctx.newPage() };
}
const panel = (page: Page, label: string) => page.locator(`.comprobador[data-label="${label}"]`);
const campo = (page: Page, label: string, r: string) => page.locator(`#cmp-${label.replace(/[^\w-]/g, '_')}-${r}`);
const guardado = (page: Page, label: string) =>
  page.evaluate((l) => {
    const t = localStorage.getItem('epa:ejercicios');
    const d = t ? JSON.parse(t) : {};
    return (d.items ?? d)[l] ?? null;
  }, label) as Promise<(EjercicioUnible & Record<string, unknown>) | null>;

test('r10g·7 (medio, pérdida) un borrador en un dispositivo que aún no tenía el ejercicio no deshace «resuelto» del otro al sincronizar', async ({ browser }) => {
  // Device A solves ej-1.9. Device B, not synchronised yet, opens the same exercise and only types in the field (a
  // draft, review 10e): guardarRespuestaEscrita → asegurarEj creates the item with t = now, resuelto false, 0 attempts.
  // The merge (lib/union-ejercicios.ts) takes `resuelto` from the version with the newer `t`: B's draft wins and the
  // exercise solved on A becomes unsolved on both devices (progress, mastery, «Hecho» in own courses, problem of the
  // day). A draft is «not an attempt: it neither counts nor changes t» (aprendizaje.svelte.ts) — except when it
  // creates the item.
  const a = await dispositivo(browser);
  await a.page.goto('#/cap01/ej-1.9');
  await campo(a.page, 'ej-1.9', 'r1').fill('0,3');
  await panel(a.page, 'ej-1.9').getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(panel(a.page, 'ej-1.9').locator('[data-r="r1"] .fb-bien')).toBeVisible();
  await expect.poll(async () => (await guardado(a.page, 'ej-1.9'))?.resuelto ?? false, { timeout: 10_000 }).toBe(true);
  const resuelto = (await guardado(a.page, 'ej-1.9'))!;

  const b = await dispositivo(browser);
  await b.page.goto('#/cap01/ej-1.9');
  await campo(b.page, 'ej-1.9', 'r1').fill('0,3');
  await b.page.goto('#/cap02');
  await expect.poll(async () => (await guardado(b.page, 'ej-1.9'))?.valores?.r1 ?? null, { timeout: 10_000 }).toBe('0,3');
  const borrador = (await guardado(b.page, 'ej-1.9'))!;
  expect(borrador.intentos).toBe(0);

  for (const u of [unirEjercicios(resuelto, borrador), unirEjercicios(borrador, resuelto)]) {
    expect(u.resuelto, JSON.stringify(u)).toBe(true);
    expect(u.intentos).toBe(1);
  }
  await a.ctx.close();
  await b.ctx.close();
});

test('r10g·8 (bajo-medio) lo escrito sin haber comprobado nunca vuelve sin veredicto', async ({ browser }) => {
  // valorComprobado() treats every value as checked when `_c` is missing («data of 0.12»), but a draft typed in an
  // exercise that was never checked (or right after «Reiniciar», which clears `_c`) has no `_c` either: back on the
  // page it shows «✗ No es correcto» (or «✓ Correcto» and, for a structured question, its development) for an answer
  // the reader never submitted.
  const { ctx, page } = await dispositivo(browser);
  await page.goto('#/cap01/ej-1.9');
  await campo(page, 'ej-1.9', 'r1').fill('5');
  await page.goto('#/cap02');
  await expect.poll(async () => (await guardado(page, 'ej-1.9'))?.valores?.r1 ?? null, { timeout: 10_000 }).toBe('5');
  await page.goto('#/cap01/ej-1.9');
  await expect(campo(page, 'ej-1.9', 'r1')).toHaveValue('5');
  await expect(panel(page, 'ej-1.9').locator('[data-r="r1"] .fb')).toHaveCount(0);
  await ctx.close();
});

test('r10g·9 (bajo-medio) un problema del día guardado que ya no existe (cap06-num-prob-6.C, retirado en 10e) no deja el día roto', async ({ browser }) => {
  // 0.12 offered every numeric practice item as a problem of the day, cap06-num-prob-6.C included; review 10e removed it
  // (wrong link). A device that stored it for today (or got it by synchronisation) opens «Problema del día» to «No se
  // pudo abrir el problema: No se encuentra el problema en los datos del libro.», and «Reintentar» repeats it all day:
  // the day cannot be solved and the streak breaks. (Still unanswered: it should be chosen again; answered: shown as
  // answered without the item.)
  const { ctx, page } = await dispositivo(browser, {
    'problema-dia': {
      version: 1,
      dias: { '2026-11-06': { id: 'cap06-num-prob-6.C', k: 'practica', parte: 'cap06', semilla: 3, curso: 'completo', t: Date.parse('2026-11-06T08:00:00') } },
    },
  });
  await page.clock.setFixedTime(new Date(2026, 10, 6, 10, 0, 0));
  await page.goto('#/problema');
  await expect(page.locator('[data-problema-dia="2026-11-06"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-problema-dia="2026-11-06"]')).not.toHaveAttribute('data-estado', 'cargando', { timeout: 30_000 });
  await expect(page.locator('[data-problema-dia="2026-11-06"]')).toHaveAttribute('data-estado', 'listo');
  await ctx.close();
});
