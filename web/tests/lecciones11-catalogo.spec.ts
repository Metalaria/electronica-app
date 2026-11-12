// 1.1 widget catalogue in the browser: the test lesson tests/lecciones11-catalogo/cap01/sec-1.5.yaml (one card per
// circuit schematic and graph of contenido/lecciones11/GUIA.md §5) is generated here, in Node, and served in place
// of the published one, so this runs against any build. Every card: its drawing and graph render (labels inside the
// drawing), it is operated with the keyboard alone and «Continuar» opens, no page error; axe (contrast included) in
// the three themes; at 360 px no horizontal scroll and 44 px targets; reduced motion stops the moving current.
//   EPA_DIST=… EPA_PUERTO=… PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones11-catalogo.spec.ts
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
};
const ID = 'cap01/sec-1.5';
const r = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones11-catalogo', `${ID}.yaml`), 'utf8')), contexto, 'catalogo');
const leccion = r.leccion as Leccion11;
type Tema = 'claro' | 'sepia' | 'oscuro';

/** Serves the catalogue lesson (and its index entry) instead of the build's own files. */
async function servir(ctx: BrowserContext) {
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.route('**/libro/lecciones11/indice.json', async (x) => {
    const real = await x.fetch().then((y) => y.json()).catch(() => ({ version: 1, total: 0, lecciones: {} }));
    const lecciones = { ...(real.lecciones ?? {}), [ID]: { tarjetas: leccion.tarjetas.length } };
    await x.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, total: Object.keys(lecciones).length, lecciones }) });
  });
  await ctx.route(`**/libro/lecciones11/${ID}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(leccion) }));
}
async function preparar(page: Page, tema: Tema = 'claro') {
  await page.addInitScript((t) => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18, sonido: false, vibracion: false }));
    }
  }, tema);
}
async function irA(page: Page, k: number) {
  await page.goto(`#/leccion/${ID}/${k + 1}`);
  const d = page.getByRole('alertdialog');
  if (await d.isVisible({ timeout: 300 }).catch(() => false)) await d.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator('[data-leccion11]')).toHaveAttribute('data-tarjeta-n', String(k));
}

test('la lección del catálogo se genera: cada esquema del registro tiene su tarjeta', () => {
  expect(r.errores).toEqual([]);
  const usados = new Set(leccion.tarjetas.flatMap((t) => (t.widget?.tipo === 'circuito' ? [t.widget.esquema] : [])));
  const carpetas = fs.readdirSync(path.join(web, 'src', 'lib', 'leccion11', 'esquemas')).filter((f) => fs.existsSync(path.join(web, 'src', 'lib', 'leccion11', 'esquemas', f, 'esquema.ts')));
  // (divisor and paralelo have theirs in the reference lesson cap01/sec-1.4)
  expect(carpetas.filter((c) => !usados.has(c) && c !== 'divisor' && c !== 'paralelo')).toEqual([]);
});

test('cada tarjeta: dibujo y gráfica sin salirse, mandos con el teclado, «Continuar» y sin errores', async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await servir(ctx);
  const page = await ctx.newPage();
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await preparar(page);
  for (const [k, t] of leccion.tarjetas.entries()) {
    if (t.tipo === 'resumen' || !t.widget) continue;
    await irA(page, k);
    const w = t.widget;
    const tarjeta = page.locator(`[data-tarjeta="${t.id}"]`);
    if (w.tipo === 'circuito') {
      await expect(tarjeta.locator(`[data-circuito="${w.esquema}"]`)).toBeVisible();
      if (w.dibujo !== false) {
        const svg = tarjeta.locator('svg.e11');
        await expect(svg).toHaveAttribute('aria-label', /\w{3}/);
        // every label inside the drawing (none cut by its edges)
        const fuera = await svg.evaluate((s: SVGSVGElement) => {
          const vb = s.viewBox.baseVal;
          return [...s.querySelectorAll('text')]
            .map((x) => ({ b: (x as SVGTextElement).getBBox(), t: x.textContent }))
            .filter(({ b }) => b.x < vb.x - 1 || b.y < vb.y - 1 || b.x + b.width > vb.x + vb.width + 1 || b.y + b.height > vb.y + vb.height + 1)
            .map(({ b, t }) => `${t} (${Math.round(b.x)}…${Math.round(b.x + b.width)}, ${Math.round(b.y)}…${Math.round(b.y + b.height)})`);
        });
        expect(fuera, t.id).toEqual([]);
      } else await expect(tarjeta.locator('svg.e11')).toHaveCount(0);
    }
    const grafica = w.tipo === 'grafica' ? w : w.grafica;
    if (grafica) {
      const curvas = tarjeta.locator('[data-grafica] path.curva');
      await expect(curvas).toHaveCount(grafica.curvas.length);
      for (let j = 0; j < grafica.curvas.length; j++) expect((await curvas.nth(j).getAttribute('d'))?.length ?? 0, `${t.id} curva ${j + 1}`).toBeGreaterThan(100);
      if (grafica.marcas?.length) await expect(tarjeta.locator('[data-marca]').first()).toBeVisible();
      await expect(tarjeta.locator('[data-grafica] svg')).toHaveAttribute('aria-label', /Gráfica de/);
    }
    // the keyboard alone: the first control of the card
    const m = w.mandos[0]!;
    const antes = await tarjeta.locator('[data-descripcion]').first().getAttribute('aria-label');
    if (m.tipo === 'deslizador') {
      // to one end (the other if it is already there)
      const s = tarjeta.locator(`[data-mando11="${m.valor}"] [role="slider"]`);
      const v0 = await s.getAttribute('aria-valuenow');
      await s.focus();
      await page.keyboard.press('End');
      if ((await s.getAttribute('aria-valuenow')) === v0) await page.keyboard.press('Home');
      expect(await s.getAttribute('aria-valuenow'), t.id).not.toBe(v0);
    } else {
      const b = tarjeta.locator(m.tipo === 'conectar' ? `[data-conectar="${m.valor}"]` : `[data-interruptor="${m.valor}"]`);
      await b.focus();
      await page.keyboard.press('Enter');
    }
    await expect(page.locator('[data-continuar]'), t.id).toBeEnabled();
    if (w.tipo === 'circuito' && w.dibujo !== false) await expect.poll(() => tarjeta.locator('[data-descripcion]').first().getAttribute('aria-label'), { message: t.id }).not.toBe(antes);
  }
  expect(errores).toEqual([]);
  await ctx.close();
});

// Motor fixes 1.1: aria-valuenow went back to «2.2e-7» as soon as a control moved (an action corrected it on the
// first render only); the estimate's slider and the graph handles too. Every slider of every card, moved with
// every key: min / max / now are plain decimals, and the value text is in words (no «nF», no exponent).
test('cada mando, al moverse: aria-valuenow decimal y aria-valuetext en palabras', async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await servir(ctx);
  const page = await ctx.newPage();
  await preparar(page);
  const decimal = /^-?\d+(\.\d+)?$/;
  let vistos = 0;
  for (const [k, t] of leccion.tarjetas.entries()) {
    if (t.tipo === 'resumen') continue;
    await irA(page, k);
    const deslizadores = page.locator(`[data-tarjeta="${t.id}"] [role="slider"]`);
    const n = await deslizadores.count();
    for (let j = 0; j < n; j++) {
      const s = deslizadores.nth(j);
      await s.focus();
      for (const tecla of ['', 'ArrowRight', 'ArrowLeft', 'Home', 'ArrowRight', 'End', 'ArrowLeft', 'Home']) {
        if (tecla) await page.keyboard.press(tecla);
        const a = await s.evaluate((x) => ({ ahora: x.getAttribute('aria-valuenow'), min: x.getAttribute('aria-valuemin'), max: x.getAttribute('aria-valuemax'), texto: x.getAttribute('aria-valuetext') ?? '' }));
        const donde = `${t.id} mando ${j + 1} tras «${tecla || 'entrar'}»: ${JSON.stringify(a)}`;
        expect(a.ahora, donde).toMatch(decimal);
        expect(a.min, donde).toMatch(decimal);
        expect(a.max, donde).toMatch(decimal);
        expect(Number(a.min) <= Number(a.ahora) && Number(a.ahora) <= Number(a.max), donde).toBe(true);
        expect(a.texto, donde).not.toMatch(/\de[-+]?\d/);
        // a unit symbol after a number is said in words («220 nanofaradios», «1 microsegundo»)
        expect(a.texto, donde).not.toMatch(/\d\s?[pnµmkMG]?(F|H|Ω|V|A|s|Hz)(?![\p{L}])/u);
      }
      vistos++;
    }
  }
  // the small ones that broke: a capacitance list, a handle in µs and the estimate in nF
  expect(vistos).toBeGreaterThan(20);
  await irA(page, leccion.tarjetas.findIndex((t) => t.id === 'grafica-log'));
  const c = page.locator('[data-mando11="C_f"] [role="slider"]');
  await c.focus();
  await page.keyboard.press('Home');
  await expect(c).toHaveAttribute('aria-valuenow', '0.0000000159');
  await expect(c).toHaveAttribute('aria-valuetext', '15,9 nanofaradios');
  await irA(page, leccion.tarjetas.findIndex((t) => t.id === 'grafica-asa-pequena'));
  const asa = page.locator('[data-asa="tau_a"]');
  await asa.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await expect(asa).toHaveAttribute('aria-valuenow', '0.00000047');
  await expect(asa).toHaveAttribute('aria-valuetext', '470 nanosegundos');
  await irA(page, leccion.tarjetas.findIndex((t) => t.id === 'estime-pequena'));
  const est = page.locator('[data-estimar] [role="slider"]');
  await est.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(est).toHaveAttribute('aria-valuenow', '0.000000001');
  await expect(est).toHaveAttribute('aria-valuetext', '1 nanofaradio');
  for (let j = 0; j < 20; j++) await page.keyboard.press('ArrowRight');
  await expect(est).toHaveAttribute('aria-valuenow', '0.000000021');
  await expect(est).toHaveAttribute('aria-valuetext', '21 nanofaradios');
  await ctx.close();
});

// Motor fixes 1.1 (request cap02 n.º 2): a «lista» control whose positions have names — the bands of the colour code.
test('mando de lista con nombres: se lee «rojo (2)», con el teclado y el lector de pantalla', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await servir(ctx);
  const page = await ctx.newPage();
  await preparar(page);
  await irA(page, leccion.tarjetas.findIndex((t) => t.id === 'codigo-colores'));
  const b1 = page.locator('[data-mando11="c_1"]');
  const s = b1.locator('[role="slider"]');
  await expect(s).toHaveAttribute('aria-valuetext', 'rojo (2)');
  await expect(s).toHaveAttribute('aria-valuenow', '2');
  await expect(b1.locator('.val')).toHaveText('rojo (2)');
  await expect(s).toHaveAccessibleName(/Primera banda/);
  await s.focus();
  await page.keyboard.press('ArrowRight');
  await expect(s).toHaveAttribute('aria-valuetext', 'naranja (3)');
  await page.keyboard.press('Home');
  await expect(s).toHaveAttribute('aria-valuetext', 'marrón (1)');
  await page.keyboard.press('End');
  await expect(s).toHaveAttribute('aria-valuetext', 'blanco (9)');
  // the reading follows: 92 × 10 Ω
  await expect(page.locator('[data-tarjeta="codigo-colores"]')).toContainText('920 Ω');
  const m = page.locator('[data-mando11="c_m"] [role="slider"]');
  await m.focus();
  await page.keyboard.press('End');
  await expect(m).toHaveAttribute('aria-valuetext', 'verde (5)');
  await expect(page.locator('[data-continuar]')).toBeEnabled();
  await ctx.close();
});

test('tres temas: axe (contraste incluido) en cada tarjeta del catálogo', async ({ browser }) => {
  test.setTimeout(400_000);
  for (const tema of ['claro', 'sepia', 'oscuro'] as Tema[]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await servir(ctx);
    const page = await ctx.newPage();
    await preparar(page, tema);
    for (const [k, t] of leccion.tarjetas.entries()) {
      if (!t.widget) continue;
      await irA(page, k);
      await page.waitForTimeout(150);
      await page.addScriptTag({ path: AXE });
      const fallos = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const x = await axe.run({ include: [['[data-leccion11]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
        return x.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      });
      expect(fallos, `${t.id} ${tema}`).toEqual([]);
    }
    await ctx.close();
  }
});

test('360 px: sin desplazamiento horizontal, objetivos de 44 px; reducir movimiento para la corriente', async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  await servir(ctx);
  const page = await ctx.newPage();
  await preparar(page);
  for (const [k, t] of leccion.tarjetas.entries()) {
    await irA(page, k);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), t.id).toBeLessThanOrEqual(360);
    const pequenos = await page.locator('[data-leccion11] button, [data-leccion11] a, [data-leccion11] [role="slider"]').evaluateAll((xs) =>
      xs
        .filter((x) => (x as HTMLElement).offsetParent !== null || x instanceof SVGElement)
        .map((x) => ({ r: x.getBoundingClientRect(), d: (x as HTMLElement).outerHTML.slice(0, 80) }))
        .filter(({ r: b }) => b.width > 0 && (b.width < 43.5 || b.height < 43.5))
        .map(({ r: b, d }) => `${Math.round(b.width)}×${Math.round(b.height)} ${d}`),
    );
    expect(pequenos, t.id).toEqual([]);
  }
  const k = leccion.tarjetas.findIndex((t) => t.widget?.tipo === 'circuito' && !!t.widget.corriente && t.widget.dibujo !== false);
  await irA(page, k);
  // 1.2: the current moves as the living circuit's particles (componentes/leccion12/CircuitoVivo.svelte), still arrows
  // with «reducir movimiento»
  const vivo = page.locator('[data-vivo]').first();
  await expect(vivo).toHaveAttribute('data-vivo', 'animado');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(vivo).toHaveAttribute('data-vivo', 'quieto');
  await ctx.close();
});
