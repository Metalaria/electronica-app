// 1.2.1 (motor121) in the browser: the instrument on circuits the page cannot solve by itself, and every schematic
// measurable and pickable (contenido/lecciones11/GUIA.md §13.1, §13.4, §13.10).
//   - On a phone (360 px, touch), the catalogue lesson tests/lecciones12-catalogo/cap05/sec-5.3.yaml: the multimeter on
//     a LED and on a transistor reads the app's ngspice (it says «midiendo…» while it runs), the oscilloscope shows a
//     node's waveform from the simulator, the meter on a rectifier gives its average; no horizontal scroll.
//   - On a desktop, the widget catalogue (tests/lecciones11-catalogo/cap01/sec-1.5.yaml, one card per schematic, and
//     cap01/sec-1.4 for divisor and paralelo) with the schematic's own instrument put on every circuit card: each
//     named point and branch has its target on the drawing (44 px, inside the drawing) and the meter put on each point
//     against ground, and in each branch, shows what the generator's ngspice gives (formatted as the page does).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones121-motor-navegador.spec.ts
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import { compilarModelo, valoresDeTarjeta } from '../src/lib/leccion11/modelo.ts';
import { valoresSueltos } from '../src/lib/leccion11/motor.ts';
import { contextoNetlist, montarNetlist, type GraficaSim } from '../src/lib/leccion11/spice.ts';
import { esquemaDe } from '../src/lib/leccion11/esquemas/registro.ts';
import type { Leccion11, WidgetCircuito } from '../src/lib/leccion11/tipos.ts';
import { resolverCC, type SolucionCC } from '../src/lib/leccion12/cc.ts';
import { formatoLectura } from '../src/lib/leccion12/hacer/motor-hacer.ts';
import { peticionMedida, solucionDeGraficas } from '../src/lib/leccion12/hacer/punto-trabajo.ts';
import { compilar } from '../src/simulador/motor/nucleo.ts';
import { simular } from '../src/simulador/motor/simular.ts';
import { rutaFuenteCongelada } from './lecciones11-congeladas';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
};
const modulo = await compilar(fs.readFileSync(path.join(web, 'public', 'ngspice', 'ngspice-xspice.wasm')));
const ngspice = async (t: string) => (await simular(modulo, t, undefined, 'xspice')).ejecucion.graficas as unknown as GraficaSim[];

async function servir(ctx: BrowserContext, lecciones: Leccion11[]) {
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.route('**/libro/lecciones11/indice.json', async (x) => {
    const real = await x.fetch().then((y) => y.json()).catch(() => ({ version: 1, total: 0, lecciones: {} }));
    const extra = Object.fromEntries(lecciones.map((l) => [l.id, { tarjetas: l.tarjetas.length }]));
    const todas = { ...(real.lecciones ?? {}), ...extra };
    await x.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, total: Object.keys(todas).length, lecciones: todas }) });
  });
  for (const l of lecciones) await ctx.route(`**/libro/lecciones11/${l.id}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(l) }));
}
async function ir(page: Page, l: Leccion11, id: string) {
  await page.goto(`#/leccion/${l.id}/${l.tarjetas.findIndex((t) => t.id === id) + 1}`);
  const d = page.getByRole('alertdialog');
  if (await d.isVisible({ timeout: 300 }).catch(() => false)) await d.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator(`[data-tarjeta="${id}"]`)).toBeVisible();
}

// ------------------------------------------------------------------ the non-linear catalogue, on a phone

const NL = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap05', 'sec-5.3.yaml'), 'utf8')), contexto, 'catalogo-motor121').leccion as Leccion11;

test.describe('en el móvil', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });
  test.beforeEach(async ({ page }) => {
    await servir(page.context(), [NL]);
    await page.addInitScript(() => localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false })));
  });
  const sinScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  test('el multímetro sobre un LED y un transistor lee el simulador de la app', async ({ page }) => {
    await ir(page, NL, 'mida-led');
    const pantalla = page.locator('[data-display-instrumento]');
    await page.locator('[data-diana="an"]').tap();
    await expect(pantalla).toHaveText('2,00 V');
    await expect(page.locator('[data-instrumento]')).not.toContainText('media');
    // the drawing's wires coloured with the simulated voltages too
    await expect(page.locator('[data-red="an"][data-tension]').first()).toBeAttached();
    await page.locator('[data-modo="A"]').tap();
    await page.locator('[data-diana="vmed"]').tap();
    await expect(pantalla).toHaveText('20,0 mA');
    await sinScroll(page);
    await ir(page, NL, 'mida-colector');
    await page.locator('[data-diana="vcm"]').tap();
    await expect(pantalla).toHaveText(/^1,3\d\smA$/);
    await page.locator('[data-diana="vbm"]').tap();
    await expect(pantalla).toHaveText(/µA$/);
    await sinScroll(page);
  });

  // (cierre131: «Comprobar» pressed before the simulator had answered gave «Así se mide: …» without the reading)
  test('comprobar antes de que el simulador conteste: el veredicto espera y dice la lectura', async ({ page }) => {
    let soltar = () => {};
    const espera = new Promise<void>((r) => (soltar = r));
    await page.route('**/ngspice/**', async (x) => {
      await espera;
      await x.continue();
    });
    await ir(page, NL, 'mida-led');
    await page.locator('[data-diana="an"]').tap();
    await expect(page.locator('[data-display-instrumento]')).not.toHaveText('2,00 V');
    await page.locator('[data-continuar][data-accion="comprobar"]').tap();
    await page.waitForTimeout(300);
    soltar();
    const v = page.locator('[data-veredicto]');
    await expect(v).toHaveAttribute('data-veredicto', 'bien');
    await expect(v).toContainText(/Así se mide: .+: 2,00\sV\./);
    await sinScroll(page);
  });

  test('el osciloscopio enseña la onda del nodo desde el simulador; el multímetro, la media', async ({ page }) => {
    await ir(page, NL, 'mida-onda');
    await expect(page.locator('[data-osciloscopio-vacio]')).toBeVisible();
    await page.locator('[data-diana="s"]').tap();
    await expect(page.locator('[data-grafica] path.curva')).toHaveCount(1);
    const d = (await page.locator('[data-grafica] path.curva').getAttribute('d')) ?? '';
    expect(d.split('L').length).toBeGreaterThan(100);
    await expect(page.locator('[data-sonda-en]')).toContainText('Salida, tras el diodo');
    await sinScroll(page);
    await ir(page, NL, 'mida-media');
    await page.locator('[data-diana="s"]').tap();
    await expect(page.locator('[data-display-instrumento]')).toHaveText(/^5,\d\d\sV$/);
    await expect(page.locator('[data-instrumento]')).toContainText('media');
    await sinScroll(page);
  });

  test('elegir con las zonas del esquema: el transistor y sus resistencias se tocan en el dibujo', async ({ page }) => {
    await ir(page, NL, 'elija-estabilidad');
    for (const z of ['r1', 'r2', 'rc', 're']) {
      const b = (await page.locator(`[data-diana="${z}"]`).boundingBox())!;
      expect(Math.min(b.width, b.height), z).toBeGreaterThanOrEqual(44);
    }
    await page.locator('[data-diana="re"]').tap();
    await page.locator('[data-continuar]').tap();
    await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'bien');
  });
});

// ------------------------------------------------------------------ every schematic, on a desktop

/** The widget catalogue with the schematic's own instrument on each circuit card that does not hide its readings. */
function conInstrumento(fichero: string, id: string): Leccion11 {
  const f = parse(fs.readFileSync(fichero, 'utf8')) as { tarjetas: { widget?: Record<string, unknown> }[] };
  for (const t of f.tarjetas) if (t.widget?.tipo === 'circuito' && !t.widget.ocultar) t.widget.instrumento = { tipo: 'multimetro' };
  const r = generarLeccion(f, contexto, `catalogo-${id}`);
  expect(r.errores, fichero).toEqual([]);
  return r.leccion as Leccion11;
}
const CATALOGOS = [conInstrumento(path.join(web, 'tests', 'lecciones11-catalogo', 'cap01', 'sec-1.5.yaml'), 'widgets'), conInstrumento(rutaFuenteCongelada('cap01/sec-1.4'), 'divisor')];

// cierre121: a goal on a logic circuit that also has a timing diagram keeps the clock-pulse button (the diagram is a
// reference drawing without a cursor); before, the diagram took the circuit over and the goal could not be reached.
test('objetivo con cronograma: el botón de pulso sigue y el objetivo se consigue con cinco pulsos', async ({ page }) => {
  const f = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap09', 'sec-9.6.yaml'), 'utf8')) as { tarjetas: Record<string, any>[] };
  f.tarjetas.find((t) => t.id === 'explore-contador')!.widget.cronograma = { ciclos: 4, senales: ['CLK', 'Q0'] };
  const r = generarLeccion(f, contexto, 'catalogo-cierre121-digital');
  expect(r.errores).toEqual([]);
  const l = r.leccion as Leccion11;
  await servir(page.context(), [l]);
  await page.addInitScript(() => localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false })));
  await ir(page, l, 'explore-contador');
  const tarjeta = page.locator('[data-tarjeta="explore-contador"]');
  await expect(tarjeta.locator('[data-cronograma]')).toBeVisible();
  await expect(tarjeta.locator('[data-cronograma-referencia]')).toBeVisible();
  await expect(tarjeta.locator('[data-tramo]')).toHaveCount(0);
  const boton = tarjeta.locator('[data-pulso]');
  await expect(boton).toBeVisible();
  await expect(page.locator('[data-objetivo]')).not.toHaveAttribute('data-objetivo', 'logrado');
  for (let k = 0; k < 5; k++) await boton.click();
  await expect(boton).toContainText('(5)');
  await expect(page.locator('[data-led="Q2"]')).toHaveAttribute('data-encendido', 'si');
  await expect(page.locator('[data-led="Q1"]')).toHaveAttribute('data-encendido', 'no');
  await expect(page.locator('[data-objetivo]')).toHaveAttribute('data-objetivo', 'logrado');
});

test('cada esquema: sus puntos y ramas en el dibujo, y el multímetro marca lo que da ngspice', async ({ browser }) => {
  test.setTimeout(900_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await servir(ctx, CATALOGOS);
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false })));
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const vistos = new Set<string>();
  for (const L of CATALOGOS) {
    const mc = compilarModelo(L.modelo);
    for (const [k, t] of L.tarjetas.entries()) {
      const w = t.widget?.tipo === 'circuito' ? (t.widget as WidgetCircuito) : null;
      if (!w?.instrumento || vistos.has(w.esquema)) continue;
      vistos.add(w.esquema);
      const donde = `${w.esquema} (${t.id})`;
      const def = esquemaDe(w.esquema)!;
      const r = mc.evaluar(valoresDeTarjeta(t, valoresSueltos(L, k)));
      // what the generator's ngspice (or the page's own linear solution) gives
      const p = peticionMedida(w, r, def);
      const s: SolucionCC = p ? solucionDeGraficas(p, await ngspice(p.netlist))! : (resolverCC(def.netlist(contextoNetlist(w, r), 'op')) ?? solucionDeGraficas({ netlist: '', analisis: 'op' }, await ngspice(montarNetlist(def, contextoNetlist(w, r), 'op', '.op')))!);
      await ir(page, L, t.id);
      const tarjeta = page.locator(`[data-tarjeta="${t.id}"]`);
      const i = w.instrumento;
      // V: every point has its target, inside the drawing, 44 px (once the card has settled: it slides in)
      if (i.modos.includes('A') && i.modos.includes('V')) await page.locator('[data-modo="V"]').click();
      for (const q of i.puntos) {
        await expect
          .poll(
            async () => {
              const dibujo = (await tarjeta.locator('[data-circuito] .panel').first().boundingBox())!;
              const b = await tarjeta.locator(`[data-diana="${q.id}"]`).boundingBox();
              if (!b) return 'sin diana';
              if (Math.min(b.width, b.height) < 44) return 'pequeña';
              const cx = b.x + b.width / 2;
              const cy = b.y + b.height / 2;
              return cx >= dibujo.x - 2 && cx <= dibujo.x + dibujo.width + 2 && cy >= dibujo.y - 2 && cy <= dibujo.y + dibujo.height + 2 ? 'bien' : 'fuera del dibujo';
            },
            { message: `${donde}: diana del punto «${q.id}»`, timeout: 5000 },
          )
          .toBe('bien');
      }
      // each point against ground: the first one tapped on the drawing, the rest from the panel (the same state)
      const pantalla = tarjeta.locator('[data-display-instrumento]');
      await page.locator('[data-punta-negra]').selectOption('0');
      for (const [n, q] of i.puntos.filter((x) => x.id !== '0').entries()) {
        if (n === 0) await tarjeta.locator(`[data-diana="${q.id}"]`).click();
        else await page.locator('[data-punta-roja]').selectOption(q.id);
        await expect(pantalla, `${donde}: v(${q.id})`).toHaveText(formatoLectura('V', s.nodos[q.id]!), { timeout: 15_000 });
      }
      // A: every branch has its target; the ammeter in each reads the meter's current
      if (i.ramas.length) {
        await page.locator('[data-modo="A"]').click();
        for (const [n, b] of i.ramas.entries()) {
          const caja = await tarjeta.locator(`[data-diana="${b.id}"]`).boundingBox();
          expect(caja, `${donde}: diana de la rama «${b.id}»`).not.toBeNull();
          if (n === 0) await tarjeta.locator(`[data-diana="${b.id}"]`).click();
          else await page.locator('[data-rama-amperimetro]').selectOption(b.id);
          await expect(pantalla, `${donde}: i(${b.id})`).toHaveText(formatoLectura('A', s.corrientes[b.id]!), { timeout: 15_000 });
        }
      }
    }
  }
  expect(vistos.size).toBeGreaterThanOrEqual(60);
  expect(errores).toEqual([]);
  await ctx.close();
});
