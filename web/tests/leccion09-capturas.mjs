// Screenshots of the 0.9 lessons «Estudiar por pasos» and the shared question component on the owner's devices
// (Mac 1280 × 800, tablet portrait 800 × 1280, phone 412 × 915), light, dark and sepia:
// tests/capturas/lavado09/leccion/ (git-ignored). Needs a server with the build:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/leccion09-capturas.mjs [--url http://localhost:4311/]
// Screens: a step of 5.2 with its equation and table (the mockup's «el equilibrio»), the first question of the
// lesson answered wrong (the mockup's question cap05-04), the summary, and a question of Repaso's chapter test
// answered wrong.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const i = process.argv.indexOf('--url');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:4311/';
const out = new URL('./capturas/lavado09/leccion/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const EQUIPOS = [
  { id: 'mac', w: 1280, h: 800, dpr: 2, tactil: false },
  { id: 'tableta', w: 800, h: 1280, dpr: 2, tactil: true },
  { id: 'movil', w: 412, h: 915, dpr: 2, tactil: true },
];

/** Answers the question on screen wrongly (an option that is not the right one, or an absurd number). */
async function fallar(page) {
  const opciones = page.locator('[data-pregunta] button.opcion');
  await page.locator('[data-pregunta]').waitFor();
  if (await opciones.count()) {
    const n = await opciones.count();
    for (let k = n - 1; k >= 0; k--) {
      await opciones.nth(k).click();
      if (await page.locator('[data-feedback="mal"]').count()) return;
      await page.locator('[data-reintentar]').click();
    }
  } else {
    await page.locator('[data-numero]').fill('98765');
    await page.locator('[data-numero]').press('Enter');
  }
}

const browser = await chromium.launch();
for (const e of EQUIPOS) {
  for (const tema of ['claro', 'oscuro', 'sepia']) {
    const ctx = await browser.newContext({ viewport: { width: e.w, height: e.h }, deviceScaleFactor: e.dpr, hasTouch: e.tactil, isMobile: e.tactil });
    await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
    const page = await ctx.newPage();
    const n = `${e.id}-${tema}`;

    // a step (5.2, step 4: «El equilibrio y el potencial de contacto»)
    await page.goto(base + '#/leccion/cap05/sec-5.2/4');
    await page.locator('[data-leccion] h1').waitFor();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}${n}-paso.png` });

    // the lesson's first question, answered wrong
    await page.goto(base + '#/leccion/cap05/sec-5.2/pregunta-1');
    await page.reload();
    await fallar(page);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}${n}-pregunta.png` });

    // the summary
    await page.goto(base + '#/leccion/cap05/sec-5.2/fin');
    await page.reload();
    await page.locator('[data-resumen]').waitFor();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}${n}-resumen.png` });

    // Repaso: a question of the chapter test, answered wrong
    await page.goto(base + '#/repaso/test/cap05');
    await fallar(page);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}${n}-repaso.png` });

    await ctx.close();
    console.log(n);
  }
}
await browser.close();
