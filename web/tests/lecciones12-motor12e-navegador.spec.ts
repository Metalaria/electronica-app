// 1.2 engine requests done by motor12e, in the browser: the catalogue lesson tests/lecciones12-catalogo/cap01/
// sec-1.12.yaml is generated here, in Node, and served in place of the published one, so this runs against any build.
// What the walker (tests/lecciones11-recorrido.spec.ts with EPA_RECORRER_CATALOGO=1) does not look at: the parametric
// curves drawn as paths and the equal-aspect plot, the stems (one per sample), the hidden curves of a prediction and
// their coming out once answered, the open band on the meter, the «simular» wording without a circuit and the
// timing diagram's cycle names, and a code listing (a book «codigo» block) as a figure with line zones. axe runs on each of these cards in the dark theme at 360 px.
//   EPA_DIST=… EPA_PUERTO=… PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones12-motor12e-navegador.spec.ts
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
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { recursosLibro } from '../scripts/recursos11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
  recursos: recursosLibro(path.join(web, 'public', 'libro'), path.join(web, 'public')),
};
const ID = 'cap01/sec-1.12';
const leccion = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${ID}.yaml`), 'utf8')), contexto, 'catalogo-motor12e').leccion as Leccion11;

async function servir(ctx: BrowserContext, tema = 'claro') {
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.route('**/libro/lecciones11/indice.json', async (x) => {
    const real = await x.fetch().then((y) => y.json()).catch(() => ({ version: 1, total: 0, lecciones: {} }));
    const lecciones = { ...(real.lecciones ?? {}), [ID]: { tarjetas: leccion.tarjetas.length } };
    await x.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, total: Object.keys(lecciones).length, lecciones }) });
  });
  await ctx.route(`**/libro/lecciones11/${ID}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(leccion) }));
  await ctx.addInitScript((t) => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18, sonido: false, vibracion: false }));
    }
  }, tema);
}
const k = (id: string) => leccion.tarjetas.findIndex((t) => t.id === id);
async function irA(page: Page, id: string) {
  await page.goto(`#/leccion/${ID}/${k(id) + 1}`);
  const d = page.getByRole('alertdialog');
  if (await d.isVisible({ timeout: 300 }).catch(() => false)) await d.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator(`[data-tarjeta="${id}"]`)).toBeVisible();
}
async function axe(page: Page, donde: string) {
  await page.addScriptTag({ path: AXE });
  const v = await page.evaluate(async () => {
    const a = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const r = await a.run({ include: [['[data-leccion11]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  });
  expect(v, donde).toEqual([]);
}

test('gráficas nuevas, curvas ocultas, banda abierta, «simular» sin circuito y ciclos con nombre', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await servir(ctx);
  const page = await ctx.newPage();
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));

  // parametric curves on an equal-aspect plot: the unit circle is as wide as it is tall on screen
  await irA(page, 'explore-lissajous');
  const caja = await page.locator('[data-parametrica="1"]').boundingBox();
  expect(caja).not.toBeNull();
  expect(Math.abs(caja!.width / caja!.height - 1)).toBeLessThan(0.03);
  await expect(page.locator('[data-grafica] svg')).toHaveAttribute('aria-label', /curva paramétrica.*misma escala en los dos ejes/);

  // stems: 21 per sequence (n = 0…20), each a line and a dot
  await irA(page, 'explore-palitos');
  await expect(page.locator('[data-palitos="0"] circle')).toHaveCount(21);
  await expect(page.locator('[data-palitos="1"] line')).toHaveCount(21);

  // a prediction with hidden curves: nothing drawn but the note, «¿?» in the legend; drawn once answered
  await irA(page, 'prediga-curva');
  await expect(page.locator('[data-curva-oculta]')).toBeVisible();
  await expect(page.locator('[data-tarjeta="prediga-curva"] path.curva')).toHaveCount(0);
  await expect(page.locator('[data-tarjeta="prediga-curva"] [data-marca]')).toHaveCount(0);
  await expect(page.locator('[data-tarjeta="prediga-curva"] .leyenda')).toContainText('¿?');
  await page.locator('[data-opcion="0"]').click();
  await page.locator('[data-continuar]').click();
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'bien');
  await expect(page.locator('[data-curva-oculta]')).toHaveCount(0);
  await expect(page.locator('[data-tarjeta="prediga-curva"] path.curva')).toHaveCount(1);
  await expect(page.locator('[data-tarjeta="prediga-curva"] [data-marca]')).toHaveCount(1);

  // «simular» computed by the model: the hint does not promise a simulation
  await irA(page, 'simule-modelo');
  await expect(page.locator('[data-tarjeta="simule-modelo"]')).toContainText('se calcula con el modelo');
  await expect(page.locator('[data-tarjeta="simule-modelo"]')).not.toContainText('y se simula');

  // an open band: the meter's band reaches its end, said to a screen reader as «hasta …»
  await irA(page, 'ajuste-consumo');
  await expect(page.locator('[data-ajuste] [data-banda-abierta="abajo"]')).toHaveAttribute('aria-label', /banda: hasta 2,00\smA/);
  await expect(page.locator('[data-ajuste]')).toHaveAttribute('data-lado', 'alto');
  await irA(page, 'ajuste-minimo');
  await expect(page.locator('[data-ajuste] [data-banda-abierta="arriba"]')).toHaveAttribute('aria-label', /banda: desde 3,300\sV hacia arriba/);
  await expect(page.locator('[data-ajuste]')).toHaveAttribute('data-lado', 'bajo');

  // the timing diagram's cycles by name, also in the cursor's text
  await irA(page, 'explore-ciclos');
  await expect(page.locator('[data-cronograma] [data-ciclo]')).toHaveText(['reposo', 'inicio', 'dato', 'fin']);
  await page.locator('[data-tramo]').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-tramo]')).toHaveAttribute('aria-valuetext', /^Ciclo 2 \(inicio\), reloj bajo/);

  // a code listing as the visual (a book «codigo» block): its 13 lines, 5 highlighted, its comment dimmed, and the
  // whole listing for a screen reader; as zones, whole lines that can be touched
  await irA(page, 'pregunta-relleno');
  await expect(page.locator('[data-codigo="c"] text')).toHaveCount(13);
  await expect(page.locator('[data-codigo="c"] [data-resaltada]')).toHaveCount(5);
  await expect(page.locator('[data-codigo="c"] text').nth(2).locator('.comentario')).toHaveText(/^\/\* 1 \+ 4 \+ 1 bytes/);
  await expect(page.locator('[data-listado]')).toContainText('5 (resaltada):     uint32_t instante;');
  await irA(page, 'toque-campo');
  await expect(page.locator('[data-lista-zonas]')).toHaveAttribute('aria-label', 'Zonas del listado: elija una');
  const z = await page.locator('[data-zona="instante"] rect').last().boundingBox();
  await page.mouse.click(z!.x + z!.width / 2, z!.y + z!.height / 2);
  await expect(page.locator('[data-boton-zona="instante"]')).toHaveAttribute('aria-pressed', 'true');
  expect(errores).toEqual([]);
  await ctx.close();

  // dark theme at 360 px: no horizontal scroll and axe on these cards
  const movil = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  await servir(movil, 'oscuro');
  const p = await movil.newPage();
  for (const id of ['explore-lissajous', 'explore-palitos', 'explore-erfc', 'prediga-curva', 'ajuste-consumo', 'ajuste-minimo', 'ajuste-dos', 'explore-ciclos', 'pregunta-relleno', 'toque-campo']) {
    await irA(p, id);
    await p.waitForTimeout(150);
    expect(await p.evaluate(() => document.documentElement.scrollWidth), id).toBeLessThanOrEqual(360);
    await axe(p, `${id} (360 px, oscuro)`);
  }
  await movil.close();
});
