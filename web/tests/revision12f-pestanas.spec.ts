// Independent review 12f: two REAL Chromium tabs of one context (one localStorage).
//   12f·3  «Reiniciar tarjetas» in one tab while the other tab is in a flashcard session with «Deshacer» available:
//          that undo, after the reset arrived, raises the undo counter of today above the answers (dr = r + 1), so the
//          next answer counts 0 for the day (and the next new card is not counted against the daily limit).
//   EPA_DIST=/tmp/claude-0/epa-revision12f EPA_PUERTO=4559 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb \
//     npx playwright test -c playwright.revision12b.config.ts tests/revision12f-pestanas.spec.ts
import { expect, test, type Page } from '@playwright/test';

const diario = (p: Page) =>
  p.evaluate(() => JSON.parse(localStorage.getItem('epa:repaso-diario') ?? '{}') as Record<string, { r: number; n: number; b: number; dr?: number; dn?: number; db?: number }>);
const efectivo = (d: { r: number; n: number; b: number; dr?: number; dn?: number; db?: number } | undefined) =>
  d ? { r: Math.max(0, d.r - (d.dr ?? 0)), n: Math.max(0, d.n - (d.dn ?? 0)) } : { r: 0, n: 0 };

async function responder(p: Page, tecla = '3'): Promise<void> {
  const carta = p.locator('[data-tarjeta]');
  const id = await carta.getAttribute('data-tarjeta');
  // (after «Deshacer» the card comes back already turned)
  if (!(await carta.locator('[data-reverso]').isVisible())) await p.keyboard.press(' ');
  await expect(carta.locator('[data-reverso]')).toBeVisible();
  await p.keyboard.press(tecla);
  await expect(carta).not.toHaveAttribute('data-tarjeta', id!);
}

test('12f·3 deshacer en una pestaña después de «Reiniciar tarjetas» en otra: la respuesta siguiente cuenta', async ({ context }) => {
  test.setTimeout(180_000);
  const p1 = await context.newPage();
  await p1.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await p1.goto('/#/repaso');
  await p1.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('epa:repaso') || k.startsWith('epa:sinc')) localStorage.removeItem(k);
  });
  await p1.reload();
  await p1.locator('[data-empezar]').click();
  await expect(p1.locator('[data-tarjeta]')).toBeVisible();
  for (let i = 0; i < 3; i++) await responder(p1);
  await expect.poll(async () => Object.values(await diario(p1))[0]?.r ?? 0).toBe(3);

  // tab 2 resets the cards
  const p2 = await context.newPage();
  await p2.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await p2.goto('/#/repaso');
  await p2.getByRole('button', { name: 'Reiniciar las tarjetas…' }).click();
  await p2.getByRole('button', { name: 'Sí, empezar de cero' }).click();
  await expect.poll(async () => JSON.stringify(Object.values(await diario(p2))[0])).toContain('"dr":3');
  // the reset reaches tab 1 (storage event → refresh of its memory)
  await p1.waitForTimeout(1500);

  // tab 1: «Deshacer» (its last answer, made before the reset), then one answer
  await p1.locator('[data-deshacer]').click();
  await p1.waitForTimeout(800);
  await responder(p1);
  await p1.waitForTimeout(1500);
  const d = Object.values(await diario(p1))[0];
  console.log('día tras reiniciar, deshacer y responder una', JSON.stringify(d));
  // after the reset nothing counted; the undo takes back an answer of before the reset (already undone by the reset);
  // the answer after it is the only one of the day
  expect(efectivo(d).r, `cuentas del día ${JSON.stringify(d)}`).toBe(1);
});
