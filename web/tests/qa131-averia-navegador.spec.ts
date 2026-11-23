// 1.3.1 (qa131-interaccion): «Busque la avería» (componentes/consolas/averia/) on the owner's phone (Pixel 8 Pro:
// 412 × 915, DPR 3.5, touch). The controls the page offers for a finger — views, power, the leads in hand, the
// meter's two functions, the parts to name — are at least 44 × 44 CSS px («Ω» alone was 42 px wide); the simulated
// meter's own drawing (its dial and keys, drawn to scale as in the rest of the app) is not counted: these buttons are
// its finger-sized alternative.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with a server> tests/qa131-averia-navegador.spec.ts
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });

test('«Busque la avería» en el teléfono: los botones para el dedo miden al menos 44 × 44', async ({ page }) => {
  await page.context().route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await page.goto('/#/consolas/snes/averia/fusible-abierto');
  await expect(page.locator('[data-funcion="Ω"]')).toBeVisible({ timeout: 60_000 });
  const pequenos = await page.locator('.averia-placa').evaluate((raiz) =>
    [...raiz.querySelectorAll('button')]
      .filter((b) => !b.closest('.brymen') && b.offsetParent !== null)
      .map((b) => ({ t: (b.textContent ?? '').trim().slice(0, 30), r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 - 0.5 || r.height < 44 - 0.5)
      .map(({ t, r }) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  expect(pequenos).toEqual([]);
});
