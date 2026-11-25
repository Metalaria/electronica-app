// 2.0 (cierre20): the machine selector of «Consolas» names every board as «<board> [<region>] · <year>», and no name
// nor board line is cut short (ellipsis) on the phone, the tablet or the desktop. The Sega Saturn's read «IC BD SATURN
// MAIN VA0.5 · 1994», cut at 1366 px; it is now «VA0.5 NTSC-J · 1994» (the Japanese HST-3200 board of Sega's
// schematic, dated 1994 in its title block).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test tests/consolas20-selector.spec.ts
import { expect, test } from '@playwright/test';

const PANTALLAS = [
  { nombre: 'teléfono', viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, hasTouch: true, isMobile: true },
  { nombre: 'tableta', viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true },
  { nombre: 'escritorio', viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 },
];

for (const { nombre, ...uso } of PANTALLAS)
  test(`selector de consolas (${nombre}): «placa · año» en todas, sin textos cortados`, async ({ browser }) => {
    const ctx = await browser.newContext(uso);
    const page = await ctx.newPage();
    await page.goto('#/consolas');
    const enlaces = page.getByRole('navigation', { name: 'Consola' }).locator('a');
    await expect(enlaces).toHaveCount(11);
    const filas = await enlaces.evaluateAll((as) =>
      as.map((a) => {
        const s = a.querySelector('small')!;
        const t = a.querySelector('strong')!;
        return { titulo: t.textContent, placa: s.textContent ?? '', cortada: s.scrollWidth > s.clientWidth + 1 || t.scrollWidth > t.clientWidth + 1 };
      }),
    );
    for (const f of filas) expect(f.placa, f.titulo ?? '').toMatch(/^\S.* · (19|20)\d\d$/);
    expect(filas.filter((f) => f.cortada).map((f) => `${f.titulo}: ${f.placa}`)).toEqual([]);
    expect(filas.find((f) => f.titulo === 'Sega Saturn')?.placa).toBe('VA0.5 NTSC-J · 1994');
    await ctx.close();
  });
