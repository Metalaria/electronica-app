// Labels of the 2D animations (componentes and conceptos) never overlap each other: every scene, every option of
// its selectors (tabs such as «SMD capa gruesa»), at phone, tablet-portrait and desktop widths, with the app's
// font and with a wider fallback of Arial/Roboto metrics (FreeSans: what an Android WebView draws with if the
// bundled font has not loaded yet). The boxes come from the test hook of nucleo/dibujo.ts
// (globalThis.__epaTextos: every text drawn by txt()/txtRico() per canvas, device pixels). Single signs
// (the «+» and «−» of charges, drawn close together on purpose) are not labels and are left out.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.flecos.config.ts tests/escenas-textos.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ids = (f: string) => [...readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/^\s+'?([a-z0-9-]+)'?: \(\) => import/gm)].map((m) => m[1]!);
const ESCENAS = [
  ...ids('../src/componentes/animaciones/cargadores.ts').map((id) => `componentes/${id}`),
  ...ids('../src/componentes/animaciones/conceptos/cargadores.ts').map((id) => `conceptos/${id}`),
];
const TAMANOS = [
  { nombre: 'móvil', width: 390, height: 844 },
  { nombre: 'tableta vertical', width: 800, height: 1280 },
  { nombre: 'escritorio', width: 1366, height: 900 },
];

type Caja = { s: string; x0: number; y0: number; x1: number; y1: number };

/** Texts of the scene's canvas in the last frame that overlap (beyond a 1,5 CSS px tolerance). */
async function solapes(page: Page): Promise<string[]> {
  // Two frames: the one that starts after the change, and a complete one.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  return page.evaluate(() => {
    const reg = (globalThis as unknown as { __epaTextos: Map<HTMLCanvasElement, Caja[]> }).__epaTextos;
    const res: string[] = [];
    const dpr = window.devicePixelRatio || 1;
    for (const c of document.querySelectorAll<HTMLCanvasElement>('.escena canvas')) {
      const k = c.width / Math.max(1, c.clientWidth) || dpr;
      const t = 1.5 * k;
      const l = (reg.get(c) ?? []).map((b) => ({ ...b, x0: b.x0 + t, x1: b.x1 - t, y0: b.y0 + t, y1: b.y1 - t }));
      for (let i = 0; i < l.length; i++)
        for (let j = i + 1; j < l.length; j++) {
          const a = l[i]!;
          const b = l[j]!;
          const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          // Boxes are the font's em box: a sliver of 2 CSS px or less is not a visible overlap.
          if (w <= 2 * k || h <= 2 * k) continue;
          // The same text drawn twice in the same place (a halo, a redraw) is not an overlap.
          if (a.s === b.s && Math.abs(a.x0 - b.x0) < 2 && Math.abs(a.y0 - b.y0) < 2) continue;
          if (/^[+−\-±·•]$/.test(a.s.trim()) || /^[+−\-±·•]$/.test(b.s.trim())) continue;
          res.push(`«${a.s}» ↔ «${b.s}» (${Math.round(w / k)}×${Math.round(h / k)} px)`);
        }
    }
    return [...new Set(res)];
  });
}

for (const fuente of ['propia', 'de reserva'] as const) {
  test(`las etiquetas de las animaciones no se solapan (fuente ${fuente})`, async ({ page }) => {
    test.setTimeout(900_000);
    if (fuente === 'de reserva') await page.route(/\.woff2?(\?.*)?$/, (r) => r.abort());
    await page.addInitScript((reserva) => {
      (globalThis as unknown as { __epaTextos: Map<unknown, unknown> }).__epaTextos = new Map();
      if (!reserva) return;
      const css = '@font-face { font-family: "Source Sans 3"; src: local("FreeSans"); font-weight: 100 900; }';
      const poner = () => document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
      if (document.head) poner();
      else document.addEventListener('DOMContentLoaded', poner);
    }, fuente === 'de reserva');
    const fallos: string[] = [];
    for (const tam of TAMANOS) {
      await page.setViewportSize({ width: tam.width, height: tam.height });
      await page.goto('/#/conceptos');
      for (const ruta of ESCENAS) {
        await page.evaluate((r) => (location.hash = `#/${r}`), ruta);
        const lienzo = page.locator('.escena canvas').first();
        await expect(lienzo, ruta).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(250);
        for (const x of await solapes(page)) fallos.push(`${tam.nombre} · ${ruta}: ${x}`);
        // Every option of every selector of the scene (tabs, modes), one selector at a time.
        const grupos = page.locator('.opciones[role="radiogroup"]');
        const n = await grupos.count();
        for (let g = 0; g < n; g++) {
          const radios = grupos.nth(g).locator('[role="radio"]');
          const m = await radios.count();
          for (let r = 0; r < m; r++) {
            const radio = radios.nth(r);
            if (!(await radio.isVisible()) || (await radio.getAttribute('aria-checked')) === 'true') continue;
            const nombre = (await radio.textContent())?.trim();
            await radio.click();
            await page.waitForTimeout(150);
            for (const x of await solapes(page)) fallos.push(`${tam.nombre} · ${ruta} [${nombre}]: ${x}`);
          }
          if (m) await radios.first().click();
        }
      }
    }
    const unicos = [...new Set(fallos)];
    if (unicos.length) console.log(unicos.join('\n'));
    if (process.env.EPA_SOLAPES) (await import('node:fs')).writeFileSync(`${process.env.EPA_SOLAPES}-${fuente === 'propia' ? 'propia' : 'reserva'}.txt`, unicos.join('\n'));
    expect(unicos, unicos.join('\n')).toEqual([]);
  });
}
