// Independent review 12g: real Chromium.
//   g12·1  the daily progress's `rehacerEspejos` (progreso-diario.svelte.ts), run synchronously on every
//          `epa:sincronizado` that names `progreso-diario` (any run that received another device's day, any import):
//          it remakes every day's mirror and `rehacerDia` → `grupoDe` scans the whole map for each day — O(days × items).
//          Measured with two years of three devices' records, with the CPU slowed ×4 (the owner's Xiaomi tablet).
//   EPA_DIST=/tmp/claude-0/epa-revision12g EPA_PUERTO=4561 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb \
//     npx playwright test -c playwright.revision12b.config.ts tests/revision12g-pestanas.spec.ts
import { expect, test } from '@playwright/test';

function historia(dias: number, ahora: number): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  for (let k = 3; k < dias + 3; k++) {
    const t = ahora - k * 86_400_000;
    const d = new Date(t);
    const c = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const dev of ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']) m[`${c}@${dev}`] = { pasos: 2, preguntas: 5, secciones: 1, cumplido: false, t };
    m[c] = { pasos: 6, preguntas: 15, secciones: 3, cumplido: true, t };
  }
  return m;
}

for (const [dias, cpu] of [
  [730, 1],
  [730, 4],
  [365, 4],
] as const)
  test(`g12·1 rehacerEspejos con ${dias} días de tres dispositivos, CPU ×${cpu}: bloque síncrono < 200 ms`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
    await page.addInitScript(() => ((window as unknown as { __epaPruebasDiario: object }).__epaPruebasDiario = {}));
    await page.goto('/');
    const datos = historia(dias, Date.now());
    await page.evaluate((d) => localStorage.setItem('epa:progreso-diario', JSON.stringify(d)), datos);
    await page.reload();
    await page.waitForFunction(() => !!(window as unknown as { __epaPruebasDiario?: { leerDias?: unknown } }).__epaPruebasDiario?.leerDias);
    await page.evaluate(() => (window as unknown as { __epaPruebasDiario: { cargar(): Promise<void> } }).__epaPruebasDiario.cargar());
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const ms = await page.evaluate(() => {
      const t0 = performance.now();
      window.dispatchEvent(new CustomEvent('epa:sincronizado', { detail: { claves: ['progreso-diario'] } }));
      return performance.now() - t0;
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`g12·1: ${Object.keys(datos).length} elementos, CPU ×${cpu}: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(200);
  });
