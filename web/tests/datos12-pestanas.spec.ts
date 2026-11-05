// 0.12, review finding 3: two REAL browser tabs (two pages of one Chromium context, the same localStorage) write the
// same key at the same instant. Chromium gives each tab its own cached view of localStorage and delivers the other
// tab's changes as later tasks, so a write may overwrite the other tab's (the compare-and-set cannot see it): the
// Guardado must not take its own write, missing from the storage afterwards, for a deletion by the other tab, nor an
// older copy of it for the other tab's change — it keeps it and writes it again. The single-threaded storage of the
// Node harness cannot show this; this test does.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.datos12.config.ts tests/datos12-pestanas.spec.ts
import { expect, test, type Page } from '@playwright/test';


interface Diario {
  registrarActividad(tipo: string, n: number): void;
  leerDias(): Promise<Record<string, { pasos: number }>>;
  itemsDias(): Record<string, { pasos: number }>;
  escribir(): Promise<void>;
  cargar(): Promise<void>;
}

async function abrir(page: Page): Promise<void> {
  await page.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await page.addInitScript(() => ((window as unknown as { __epaPruebasDiario: object }).__epaPruebasDiario = {}));
  await page.goto('/#/');
  await page.waitForFunction(() => typeof (window as unknown as { __epaPruebasDiario: Partial<Diario> }).__epaPruebasDiario.cargar === 'function');
  await page.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.cargar());
}

test('dos pestañas reales escriben a la vez: ningún paso se pierde (ni en memoria ni guardado)', async ({ context }) => {
  test.setTimeout(240_000);
  const p1 = await context.newPage();
  await abrir(p1);
  await p1.evaluate(() => localStorage.removeItem('epa:progreso-diario'));
  const p2 = await context.newPage();
  await abrir(p2);
  await abrir(p1);
  const N = 20;
  for (let i = 0; i < N; i++) {
    // (the fixed clock does not advance: the pages busy-wait on the real time)
    const T = (await p1.evaluate(() => performance.timeOrigin + performance.now())) + 120;
    await Promise.all([
      p1.evaluate(async (T) => {
        const d = (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario;
        while (performance.timeOrigin + performance.now() < T);
        d.registrarActividad('paso', 1);
        await d.escribir();
      }, T),
      p2.evaluate(async (T) => {
        const d = (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario;
        while (performance.timeOrigin + performance.now() < T);
        d.registrarActividad('paso', 1);
        await d.escribir();
      }, T),
    ]);
    await p1.waitForTimeout(40);
  }
  // the storage events arrive, each tab merges (and writes again what it must)
  await p1.waitForTimeout(1500);
  // (the real clock: every step of this test falls on one review day unless it crosses 04:00 — then on two)
  const total = async (p: Page) =>
    Object.values(await p.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.leerDias())).reduce((n, d) => n + d.pasos, 0);
  const guardado = () =>
    p1.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, { pasos: number }>;
      return Object.entries(v)
        .filter(([k]) => k.includes('@'))
        .reduce((n, [, r]) => n + r.pasos, 0);
    });
  await expect.poll(() => total(p1), { timeout: 10_000 }).toBe(2 * N);
  await expect.poll(() => total(p2), { timeout: 10_000 }).toBe(2 * N);
  await expect.poll(guardado, { timeout: 10_000 }).toBe(2 * N);
});
