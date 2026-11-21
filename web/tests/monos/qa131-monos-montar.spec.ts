// 1.3.1 (qa131-interaccion): seeded monkeys on the «Monte este circuito» card (componentes/leccion12/Montar.svelte)
// on the owner's phone (Pixel 8 Pro: 412 × 915, DPR 3.5, touch; real touches through CDP), on the catalogue lesson
// tests/lecciones12-catalogo/cap02/sec-2.7.yaml generated here (as tests/lecciones13b-montar-navegador.spec.ts): parts
// dragged from the tray anywhere (reversed, extra, off the board), legs and wire ends dragged, wires to the rails,
// «Voltear» and «Girar», «Comprobar» / «Volver a intentarlo», «Empezar de nuevo», the solution when it is offered, and
// moving between the cards and back. Oracles: no error, no NaN / undefined on screen, a diagnosis always in a known
// state, every leg and wire end on a whole hole, no loupe without a finger, and «Empezar de nuevo» always back to the
// supply alone.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with a server> tests/monos/qa131-monos-montar.spec.ts
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../../src/lib/leccion11/tipos.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../../scripts/esquemas11.mjs';
import { ACCIONES, azar, Dedos, errores, instrumentar, Rastro, registro, semillas, sinBasura, type P } from './comun-interaccion';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
};
const ID = 'cap02/sec-2.7';
const leccion = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${ID}.yaml`), 'utf8')), contexto, 'catalogo-qa131').leccion as Leccion11;
const tarjetas = leccion.tarjetas.map((t, k) => ({ id: t.id, n: k + 1 })).filter((t) => t.id.startsWith('monte-'));

type Ventana = { __epaProtoboard?: { pb: { doc: { piezas: { comp: { nombre: string }; pos: P[]; enc: string }[]; cables: { a: P; b: P }[] }; sel: string[] }; pantalla: (x: number, y: number) => P } };

async function abrir(page: Page, n: number) {
  await page.goto(`#/leccion/${ID}/${n}`);
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 30_000 });
  await page.waitForTimeout(300);
}

test.describe('monos de «Monte este circuito»', () => {
  test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });

  for (const semilla of semillas([6131, 61313])) {
    test(`semilla ${semilla}: piezas al azar, al revés y de más, cables a los raíles, comprobar, reiniciar, solución y cambiar de tarjeta`, async ({ page }) => {
      test.setTimeout(600_000);
      const ctx = page.context();
      await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
      await ctx.route('**/libro/lecciones11/indice.json', async (x) => {
        const real = await x.fetch().then((y) => y.json()).catch(() => ({ version: 1, total: 0, lecciones: {} }));
        const lecciones = { ...(real.lecciones ?? {}), [ID]: { tarjetas: leccion.tarjetas.length } };
        await x.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, total: Object.keys(lecciones).length, lecciones }) });
      });
      await ctx.route(`**/libro/lecciones11/${ID}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(leccion) }));
      await instrumentar(ctx);
      await page.addInitScript(() => localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false })));
      const fallos = errores(page);
      const dedos = new Dedos(await ctx.newCDPSession(page), page);
      const a = azar(semilla);
      const rastro = new Rastro(semilla);
      let tarjeta = a.uno(tarjetas);
      await abrir(page, tarjeta.n);
      const mesa = async () => (await page.locator('.mesa').first().boundingBox({ timeout: 5000 }).catch(() => null))!;
      const punto = async (): Promise<P> => {
        const b = await mesa();
        return [a.entre(b.x - 4, b.x + b.width + 4), a.entre(b.y, b.y + b.height)];
      };
      for (let i = 0; i < ACCIONES; i++) {
        const acc = a.pesos({ bandeja: 10, toque: 8, arrastrar: 8, voltear: 4, comprobar: 5, reiniciar: 3, solucion: 2, tarjeta: 2, pellizco: 2 });
        switch (acc) {
          case 'bandeja': {
            const n = await page.locator('.a12-montar-bandeja [data-carta]').count();
            if (!n) break;
            const c = page.locator('.a12-montar-bandeja [data-carta]').nth(a.entero(0, n - 1));
            await c.scrollIntoViewIfNeeded().catch(() => {});
            const b = await c.boundingBox().catch(() => null);
            if (!b) break;
            const de: P = [b.x + b.width / 2, b.y + b.height / 2];
            const hacia = await punto();
            rastro.apuntar(`bandeja → ${hacia.map(Math.round)}`);
            await dedos.bajar([de]);
            await page.waitForTimeout(40);
            await dedos.deslizar([de], [hacia], a.entero(6, 14));
            if (a.r() < 0.1) await dedos.cancelar();
            else await dedos.soltar();
            break;
          }
          case 'toque': {
            const p = await punto();
            rastro.apuntar(`toque ${p.map(Math.round)}`);
            await dedos.toque(p, a.uno([30, 450]));
            break;
          }
          case 'arrastrar': {
            const de = await page.evaluate((k) => {
              const e = (window as unknown as Ventana).__epaProtoboard!;
              const xs: P[] = [];
              for (const p of e.pb.doc.piezas) for (const q of p.pos) xs.push(e.pantalla(q[0], q[1]));
              for (const c of e.pb.doc.cables) xs.push(e.pantalla(c.a[0], c.a[1]), e.pantalla(c.b[0], c.b[1]));
              return xs.length ? xs[Math.floor(k * xs.length)]! : null;
            }, a.r());
            if (!de) break;
            const hacia = await punto();
            rastro.apuntar(`arrastrar ${de.map(Math.round)} → ${hacia.map(Math.round)}`);
            await dedos.bajar([de]);
            await dedos.deslizar([de], [[de[0], de[1] + 14]], 3);
            await page.waitForTimeout(150);
            await dedos.deslizar([[de[0], de[1] + 14]], [[hacia[0], hacia[1] + 56]], 8);
            await dedos.soltar();
            break;
          }
          case 'voltear': {
            const b = page.getByRole('button', { name: a.uno(['Voltear', 'Girar']) });
            if (!(await b.count())) break;
            rastro.apuntar('voltear/girar');
            await b.first().click({ timeout: 3000 }).catch(() => {});
            break;
          }
          case 'comprobar': {
            const b = page.locator('[data-continuar]');
            if (!(await b.count())) break;
            rastro.apuntar(`continuar (${await b.getAttribute('data-accion')})`);
            await b.click({ timeout: 4000 }).catch(() => {});
            // («Continuar» after a right answer goes to the next card: back to a «Monte» card)
            await page.waitForTimeout(400);
            if (!(await page.locator('[data-montar]').count())) {
              tarjeta = a.uno(tarjetas);
              rastro.apuntar(`(otra tarjeta ${tarjeta.id})`);
              await abrir(page, tarjeta.n);
            }
            break;
          }
          case 'reiniciar': {
            rastro.apuntar('empezar de nuevo');
            await page.locator('[data-montar-reiniciar]').click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(300);
            const n = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.pb.doc.piezas.filter((p) => !['fuente', 'pila', 'generador'].includes(p.enc)).length);
            expect(n, `«Empezar de nuevo» deja piezas (${rastro})`).toBeLessThanOrEqual(1);
            break;
          }
          case 'solucion': {
            const b = page.locator('[data-montar-solucion]');
            if (await b.count()) {
              rastro.apuntar('solución');
              await b.click({ timeout: 4000 }).catch(() => {});
              await expect(page.locator('[data-montar]'), String(rastro)).toHaveAttribute('data-diagnostico', /bien|simulando/, { timeout: 60_000 });
            } else {
              rastro.apuntar('pista');
              await page.locator('[data-escalera] button, [data-pista]').first().click({ timeout: 3000 }).catch(() => {});
            }
            break;
          }
          case 'tarjeta': {
            tarjeta = a.uno(tarjetas);
            rastro.apuntar(`ir a ${tarjeta.id}`);
            await abrir(page, tarjeta.n);
            break;
          }
          case 'pellizco': {
            const c = await punto();
            rastro.apuntar('pellizco');
            await dedos.bajar([[c[0] - 30, c[1]], [c[0] + 30, c[1]]]);
            await dedos.deslizar([[c[0] - 30, c[1]], [c[0] + 30, c[1]]], [[c[0] - 80, c[1]], [c[0] + 80, c[1]]], 5);
            await dedos.soltar();
            break;
          }
        }
        await page.waitForTimeout(a.uno([50, 250]));
        if (i % 6 === 5 || i === ACCIONES - 1) {
          await page.waitForTimeout(400);
          expect(fallos, String(rastro)).toEqual([]);
          expect((await registro(page)).errores, String(rastro)).toEqual([]);
          const r = await page.evaluate(() => {
            const e = (window as unknown as Ventana).__epaProtoboard;
            if (!e) return ['sin banco'];
            const entero = (q: unknown) => Array.isArray(q) && q.every((x) => Number.isInteger(x));
            const mal = [
              ...e.pb.doc.piezas.filter((p) => !p.pos.every(entero)).map((p) => `${p.comp.nombre} ${JSON.stringify(p.pos)}`),
              ...e.pb.doc.cables.filter((c) => !entero(c.a) || !entero(c.b)).map((c) => `cable ${JSON.stringify(c)}`),
            ];
            if (document.querySelector('[data-lupa]')) mal.push('lupa sin dedo');
            const d = document.querySelector('[data-montar]')?.getAttribute('data-diagnostico') ?? '';
            if (!/^(nada|vacia|simulando|bien|problemas-\d+)$/.test(d)) mal.push(`diagnóstico «${d}»`);
            return mal;
          });
          expect(r, String(rastro)).toEqual([]);
          await sinBasura(page, rastro, '.a12-montar');
        }
      }
    });
  }
});
