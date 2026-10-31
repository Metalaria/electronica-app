// Phase 2 · 1 — memory and GPU leaks (the owner's Android crashes were GPU/memory): one long session in the tablet
// profile that opens and leaves, three rounds in a row, every 3D view (console boards, KiCad boards, 3D models, the
// glossary's 3D pictures) and the heavy pages (simulator, editor, instruments bench, breadboard, FM7303). After each
// round it goes back to the start page, collects garbage (window.gc and CDP) and counts what is still alive: WebGL
// contexts in the page and orphaned ones, canvases, AudioContexts, Workers, intervals, requestAnimationFrame loops
// and the JS heap. Whatever grows from round to round is a leak.
import { test, type Page } from '@playwright/test';
import { Registro, esperarCalma, prepararPagina } from './arnes.ts';
import { instalarSondaRecursos, type RecursosVivos } from './sonda.ts';
import { IDS_MAQUINA } from '../../src/componentes/consolas/datos.ts';
import { PLACAS_DE } from '../../src/componentes/consolas/placa/datos.ts';
import { MODELOS_3D } from '../../src/componentes/tres/catalogo3d.ts';
import { leerJson } from './rutas.ts';
import { MODO } from './perfiles.ts';

function rutasPesadas(): string[] {
  const r: string[] = [];
  for (const m of IDS_MAQUINA) if (PLACAS_DE[m]?.length) r.push(`#/consolas/${m}/placa3d`, `#/consolas/${m}/placa2d`);
  for (const p of leerJson<{ proyectos: { placas: { id: string }[] }[] }>('proyectos/indice.json').proyectos) for (const pl of p.placas) r.push(`#/proyectos/${pl.id}/3d`);
  const modelos = MODO === 'rapido' ? MODELOS_3D.slice(0, 6) : MODELOS_3D;
  for (const m of modelos) r.push(`#/componentes/3d/${m.tipo}`);
  r.push('#/componentes/3d', '#/glosario', '#/glosario/glos-diodo', '#/simulador/cap05/sec-5.3_led_150ohm', '#/simulador/cap42/fig-42.5_filtro_rc', '#/simulador/cap50/disipacion');
  r.push('#/editor/libro/cap42/fig-42.3_op_emisor_comun', '#/editor', '#/instrumentos/practica/1', '#/instrumentos/practica/7', '#/instrumentos/libre', '#/protoboard', '#/fm7303/senal', '#/fm7303/esquema', '#/conceptos/fasores', '#/componentes/led');
  return r;
}

/** Collects garbage on the start page and counts what is alive (WebGL, canvases, audio, workers, timers, heap). */
async function medidor(page: Page): Promise<() => Promise<RecursosVivos & { heapMB: number }>> {
  const cdp = await page.context().newCDPSession(page);
  return async () => {
    await page.evaluate((h) => (location.hash = h), '#/');
    await esperarCalma(page, 15_000);
    for (let k = 0; k < 3; k++) {
      await page.evaluate(() => (window as unknown as { gc?: () => void }).gc?.());
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
      await page.waitForTimeout(300);
    }
    const r = await page.evaluate(() => (window as unknown as { __qaRecursos: () => Promise<RecursosVivos> }).__qaRecursos());
    const h = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
    return { ...r, heapMB: Math.round(h.usedSize / 1e5) / 10 };
  };
}

type Vuelta = RecursosVivos & { heapMB: number };

/** What grows from the first round to the third is a leak. */
async function compararVueltas(reg: Registro, vueltas: Vuelta[], prefijo = ''): Promise<void> {
  const t = (k: keyof Vuelta) => vueltas.map((x) => x[k]).join(' → ');
  const [inicio, v1, , v3] = vueltas as [Vuelta, Vuelta, unknown, Vuelta];
  const anotar = (tipo: string, msg: string) => reg.anotar({ sev: 'rendimiento', tipo: 'fuga', firma: prefijo + tipo, msg });
  if (v3.webgl > inicio.webgl) await anotar('webgl vivos', `Quedan ${v3.webgl} contextos WebGL en la página de inicio tras dejar las vistas 3D (por vuelta: ${t('webgl')}).`);
  if (v3.webglHuerfanos > v1.webglHuerfanos) await anotar('webgl huérfanos', `Contextos WebGL sin liberar fuera del documento que crecen con cada vuelta: ${t('webglHuerfanos')}.`);
  if (v3.lienzos > v1.lienzos) await anotar('lienzos', `Lienzos (canvas) en el documento que crecen con cada vuelta: ${t('lienzos')}.`);
  if (v3.audio > v1.audio) await anotar('audio', `AudioContext sin cerrar que crecen con cada vuelta: ${t('audio')}.`);
  if (v3.trabajadores > v1.trabajadores) await anotar('workers', `Workers sin terminar que crecen con cada vuelta: ${t('trabajadores')}.`);
  if (v3.intervalos > v1.intervalos) await anotar('intervalos', `setInterval sin borrar que crecen con cada vuelta: ${t('intervalos')}.`);
  if (v3.rafPorSegundo > Math.max(5, inicio.rafPorSegundo)) await anotar('raf', `Bucles de requestAnimationFrame que siguen en la página de inicio (${t('rafPorSegundo')} por segundo).`);
  if (v3.heapMB - v1.heapMB > 15) await anotar('heap', `El montón de JavaScript crece ${Math.round(v3.heapMB - v1.heapMB)} MB entre la primera y la tercera vuelta (${t('heapMB')} MB).`);
  console.log(`${prefijo}fugas: webgl ${t('webgl')} · huérfanos ${t('webglHuerfanos')} · lienzos ${t('lienzos')} · audio ${t('audio')} · workers ${t('trabajadores')} · intervalos ${t('intervalos')} · rAF/s ${t('rafPorSegundo')} · heap ${t('heapMB')} MB`);
}

// 0.11 group B: the explorable rows of the lessons simulate on every slider move; the smart practice, the problem of
// the day and the mastery page. Three rounds: each lesson's explorable figure with its slider moved 12 times, a
// practice session started and skipped to the end, the problem and the mastery page.
test('fugas: figuras explorables, práctica inteligente y problema del día', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'en la tableta');
  test.setTimeout(30 * 60_000);
  await page.addInitScript(instalarSondaRecursos);
  await prepararPagina(page, reg);
  const medir = await medidor(page);
  await page.goto('/#/');
  await esperarCalma(page, 20_000);
  const vueltas: Vuelta[] = [await medir()];
  let movidas = 0;
  for (let v = 1; v <= 3; v++) {
    for (const h of ['#/leccion/cap01/sec-1.4/5', '#/leccion/cap22/sec-22.1']) {
      reg.ruta = `fugas:${h} (vuelta ${v})`;
      await page.evaluate((x) => (location.hash = x), h);
      await esperarCalma(page, 20_000);
      // the explorable row may be a few screens on
      for (let i = 0; i < 12 && !(await page.locator('[data-explora]').count()); i++) {
        const c = page.locator('[data-continuar]');
        if (!(await c.count())) break;
        if (await c.isEnabled()) await c.click();
        else if (await page.locator('[data-saltar]').count()) await page.locator('[data-saltar]').click();
        else break;
        await page.waitForTimeout(400);
      }
      const r = page.locator('[data-explora] input[type=range]').first();
      if (!(await r.count())) {
        await reg.anotar({ sev: 'funcional', tipo: 'fuga-recorrido', firma: h, msg: `${h}: no se encontró la fila explorable.` });
        continue;
      }
      await r.scrollIntoViewIfNeeded();
      await r.focus();
      for (let k = 0; k < 12; k++) {
        await page.keyboard.press(k % 4 < 2 ? 'ArrowRight' : 'ArrowLeft');
        await page.waitForTimeout(250);
        movidas++;
      }
      await esperarCalma(page, 15_000);
    }
    reg.ruta = `fugas:#/practicar (vuelta ${v})`;
    await page.evaluate((x) => (location.hash = x), '#/practicar');
    await page.locator('[data-empezar-sesion]').click({ timeout: 30_000 }).catch(() => {});
    for (let i = 0; i < 15 && !(await page.locator('[data-fin-sesion]').count()); i++) {
      const s = page.locator('[data-saltar]');
      if (await s.count()) await s.click({ timeout: 10_000 }).catch(() => {});
      else await page.locator('[data-continuar]').click({ timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(150);
    }
    for (const h of ['#/problema', '#/progreso/dominio']) {
      reg.ruta = `fugas:${h} (vuelta ${v})`;
      await page.evaluate((x) => (location.hash = x), h);
      await esperarCalma(page, 15_000);
    }
    vueltas.push(await medir());
  }
  reg.ruta = 'fugas: explorables';
  reg.cobertura({ 'fugas: movimientos de deslizador en figuras explorables': movidas });
  await compararVueltas(reg, vueltas, 'explorables: ');
});

test('fugas: tres vueltas por todas las vistas 3D y páginas pesadas', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'en la tableta');
  const rutas = rutasPesadas();
  test.setTimeout(rutas.length * 3 * 90_000 + 300_000);
  await page.addInitScript(instalarSondaRecursos);
  await prepararPagina(page, reg);
  const cdp = await page.context().newCDPSession(page);
  const medir = async (): Promise<RecursosVivos & { heapMB: number }> => {
    await page.evaluate((h) => (location.hash = h), '#/');
    await esperarCalma(page, 15_000);
    for (let k = 0; k < 3; k++) {
      await page.evaluate(() => (window as unknown as { gc?: () => void }).gc?.());
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
      await page.waitForTimeout(300);
    }
    const r = await page.evaluate(() => (window as unknown as { __qaRecursos: () => Promise<RecursosVivos> }).__qaRecursos());
    const h = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
    return { ...r, heapMB: Math.round(h.usedSize / 1e5) / 10 };
  };
  await page.goto('/#/');
  await esperarCalma(page, 20_000);
  const vueltas: (RecursosVivos & { heapMB: number })[] = [await medir()];
  for (let v = 1; v <= 3; v++) {
    for (const h of rutas) {
      reg.ruta = `fugas:${h} (vuelta ${v})`;
      reg.traza(reg.ruta);
      await page.evaluate((x) => (location.hash = x), h);
      // the 3D boards report when they are drawn; the rest, when quiet
      await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo !== false, null, { timeout: 5000, polling: 100 }).catch(() => {});
      await esperarCalma(page, /placa3d|\/3d/.test(h) ? 60_000 : 15_000);
      if (page.isClosed()) break;
    }
    vueltas.push(await medir());
  }
  reg.ruta = 'fugas';
  const t = (k: keyof (RecursosVivos & { heapMB: number })) => vueltas.map((x) => x[k]).join(' → ');
  reg.cobertura({ 'fugas: vistas abiertas y dejadas': rutas.length * 3 });
  const [inicio, v1, , v3] = vueltas as [RecursosVivos & { heapMB: number }, RecursosVivos & { heapMB: number }, unknown, RecursosVivos & { heapMB: number }];
  const anotar = (tipo: string, msg: string) => reg.anotar({ sev: 'rendimiento', tipo: 'fuga', firma: tipo, msg });
  // after the first round (lazy chunks, caches, the engine's worker) nothing may keep growing
  if (v3.webgl > inicio.webgl) await anotar('webgl vivos', `Quedan ${v3.webgl} contextos WebGL en la página de inicio tras dejar las vistas 3D (por vuelta: ${t('webgl')}).`);
  if (v3.webglHuerfanos > v1.webglHuerfanos) await anotar('webgl huérfanos', `Contextos WebGL sin liberar fuera del documento que crecen con cada vuelta: ${t('webglHuerfanos')}.`);
  if (v3.lienzos > v1.lienzos) await anotar('lienzos', `Lienzos (canvas) en el documento que crecen con cada vuelta: ${t('lienzos')}.`);
  if (v3.audio > v1.audio) await anotar('audio', `AudioContext sin cerrar que crecen con cada vuelta: ${t('audio')}.`);
  if (v3.trabajadores > v1.trabajadores) await anotar('workers', `Workers sin terminar que crecen con cada vuelta: ${t('trabajadores')}.`);
  if (v3.intervalos > v1.intervalos) await anotar('intervalos', `setInterval sin borrar que crecen con cada vuelta: ${t('intervalos')}.`);
  if (v3.rafPorSegundo > Math.max(5, inicio.rafPorSegundo)) await anotar('raf', `Bucles de requestAnimationFrame que siguen en la página de inicio (${t('rafPorSegundo')} por segundo).`);
  if (v3.heapMB - v1.heapMB > 15) await anotar('heap', `El montón de JavaScript crece ${Math.round(v3.heapMB - v1.heapMB)} MB entre la primera y la tercera vuelta (${t('heapMB')} MB).`);
  console.log(`fugas: webgl ${t('webgl')} · huérfanos ${t('webglHuerfanos')} · lienzos ${t('lienzos')} · audio ${t('audio')} · workers ${t('trabajadores')} · intervalos ${t('intervalos')} · rAF/s ${t('rafPorSegundo')} · heap ${t('heapMB')} MB`);
  vueltas.forEach((x, k) => reg.cobertura({ [`fugas: MB de montón tras la vuelta ${k}`]: x.heapMB, [`fugas: contextos WebGL tras la vuelta ${k}`]: x.webgl + x.webglHuerfanos }));
});
