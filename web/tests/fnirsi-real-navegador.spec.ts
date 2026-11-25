// The real FNIRSI 2C53T through its «stock-link» USB link, in the browser, with a fake link
// (window.__epaFnirsiFalso, lib/fnirsi-real/transporte.ts) that answers the link's two requests and hands out real
// captured reports (fnirsi-real-datos.ts). On the free bench: without any transport nothing is shown; the multimeter's
// reading appears as the instrument's screen shows it; the oscilloscope's trace with its measurements; a link that
// leaves the bus for a moment (the instrument changes mode) is taken up again by itself, and one that does not come
// back is said so. Axe on the panel.
//   npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { axe, limpio, sinHallazgos } from './accesibilidad10-comun';
import { MEMORIA, MULTIMETRO, REGISTRO_CH1 } from './fnirsi-real-datos.ts';

const BANCO = '/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm';
const deHex = (h: string) => h.match(/../g)!.map((x) => parseInt(x, 16));

/** A record (56 settings bytes + 1024 samples, base64) as the link sends it: a header event and its data events. */
function informesDe(registro: string, canal: number, secuencia: number): number[][] {
  const b = Array.from(Buffer.from(registro, 'base64'));
  const v: number[][] = [];
  const informe = (cab: number[], datos: number[]) => {
    const r = new Array<number>(64).fill(0);
    cab.forEach((x, k) => (r[k] = x));
    datos.forEach((x, k) => (r[8 + k] = x));
    return r;
  };
  v.push(informe([0xa0, secuencia, canal, 56, 0, 0, 0, 0], b.slice(0, 56)));
  for (let d = 0; d < 1024; d += 56) {
    const n = Math.min(56, 1024 - d);
    v.push(informe([0xa1, secuencia, canal, n, d & 0xff, d >> 8, 0, 0], b.slice(56 + d, 56 + d + n)));
  }
  return v;
}

interface Falso {
  modo?: number;
  parche?: number;
  estadoMudo?: boolean;
  eventos?: number[][];
  repetir?: boolean;
  desenchufado?: string;
  errorAbrir?: string;
  aperturas?: number;
  suscripciones?: number[];
  memoria?: Record<string, number[]>;
  lecturas?: number[];
  comoNativo?: boolean;
}

/** The fake link, installed before the page loads (the transport is chosen once, at start). */
async function conEnlace(page: Page, f: Falso) {
  await page.addInitScript((x) => {
    (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = x;
  }, f);
}
async function cambiar(page: Page, f: Partial<Falso>) {
  await page.evaluate((x) => {
    const c = (window as unknown as { __epaFnirsiFalso: Record<string, unknown> }).__epaFnirsiFalso;
    for (const [k, v] of Object.entries(x)) {
      if (v === null) delete c[k];
      else c[k] = v;
    }
  }, f as Record<string, unknown>);
}
const falso = (page: Page) => page.evaluate(() => (window as unknown as { __epaFnirsiFalso: Falso }).__epaFnirsiFalso);

async function banco(page: Page) {
  await page.goto(BANCO);
  await expect(page.locator('.elegir h2')).toBeVisible({ timeout: 60_000 });
}

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'escritorio'));

test('sin enlace ni WebHID no aparece nada del FNIRSI real', async ({ page }) => {
  await limpio(page);
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'hid', { get: () => undefined, configurable: true }));
  await banco(page);
  await expect(page.locator('[data-fnirsi-real]')).toHaveCount(0);
});

test('multímetro: la lectura del FNIRSI tal como la muestra su pantalla', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 1, eventos: [deHex(MULTIMETRO.pila9V!)], repetir: true });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveClass(/compacto/);
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'desconectado');
  await expect(page.locator('[data-estado-fnirsi]')).toContainText('Sin conectar');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,201 V ⎓');
  await expect(panel).toContainText('Tensión continua');
  await expect(page.locator('[data-aviso-fnirsi]')).toHaveCount(0);
  // both streams are asked for, once
  expect((await falso(page)).suscripciones).toEqual([3]);
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (multímetro)');
  // another reading, not reliable (the display and the firmware do not name the same unit): shown with its warning
  await cambiar(page, { eventos: [deHex(MULTIMETRO.capacidadTransicion!)] });
  await expect(page.locator('[data-aviso-fnirsi]')).toContainText('no dan la misma unidad');
  await expect(page.locator('[data-hold-fnirsi]')).toHaveCount(0);
  // HOLD on the instrument: the panel shows its frozen screen (the frame goes on with 0,0003 V) and says so
  await cambiar(page, { eventos: [deHex(MULTIMETRO.holdActivo!)] });
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('−0,0005 V ⎓');
  await expect(page.locator('[data-hold-fnirsi]')).toHaveText('HOLD: la pantalla del FNIRSI está congelada, y esta lectura con ella.');
  await expect(page.locator('[data-aviso-fnirsi]')).toHaveCount(0);
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (HOLD)');
  // alternating voltage: with the frequency the instrument shows above the reading
  await cambiar(page, { eventos: [deHex(MULTIMETRO.acvMano!)] });
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('2,349 V ∿');
  await expect(page.locator('[data-funcion-fnirsi]')).toHaveText('Multímetro · Tensión alterna · 49 Hz');
  await expect(page.locator('[data-hold-fnirsi]')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Desconectar' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'desconectado');
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveCount(0);
});

test('1.4.2: un cambio de escala de un par de tramas no hace parpadear el aviso; uno que dura, sí lo da', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 1, eventos: [deHex(MULTIMETRO.pila9V!)], repetir: true });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,201 V ⎓');
  // count every time the warning enters the page (before 1.4.2 it showed at once, for as long as the frames lasted)
  await page.evaluate(() => {
    const w = window as unknown as { __avisos: number };
    w.__avisos = 0;
    new MutationObserver((ms) => {
      for (const m of ms)
        for (const n of m.addedNodes)
          if (n instanceof Element && (n.matches('[data-aviso-fnirsi]') || n.querySelector('[data-aviso-fnirsi]'))) w.__avisos++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  // a range change: unreliable frames for a quarter of a second, then the reading again
  await cambiar(page, { eventos: [deHex(MULTIMETRO.capacidadTransicion!)] });
  await page.waitForTimeout(250);
  await cambiar(page, { eventos: [deHex(MULTIMETRO.pila9V!)] });
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,201 V ⎓');
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as unknown as { __avisos: number }).__avisos)).toBe(0);
  await expect(page.locator('[data-aviso-fnirsi]')).toHaveCount(0);
  // the same frames for longer: the warning shows, with its reason
  await cambiar(page, { eventos: [deHex(MULTIMETRO.capacidadTransicion!)] });
  await expect(page.locator('[data-aviso-fnirsi]')).toContainText('no dan la misma unidad');
  // and goes with them
  await cambiar(page, { eventos: [deHex(MULTIMETRO.pila9V!)] });
  await expect(page.locator('[data-aviso-fnirsi]')).toHaveCount(0);
});

test('osciloscopio: la traza de CH1 con sus medidas', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 2, eventos: informesDe(REGISTRO_CH1, 0, 1), repetir: true });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  await expect(page.locator('[data-trazas-fnirsi]')).toHaveAttribute('data-trazas-fnirsi', '1');
  const canal = page.locator('[data-canal-fnirsi="1"]');
  // the instrument's own screen for this capture: 500 mV per division (X10), Vp-p 3.01 V, 1.00 kHz, H = 200 µs
  await expect(canal).toContainText('500 mV/div');
  await expect(canal).toContainText('X10');
  await expect(canal).toContainText(/Vpp 3,0\d V/);
  await expect(canal).toContainText(/1,00 kHz/);
  await expect(panel).toContainText('200 µs/div');
  await expect(page.locator('[data-trazas-fnirsi] polyline')).toHaveCount(1);
  // the multimeter's reading is not shown in oscilloscope mode
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveCount(0);
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (osciloscopio)');
});

test('osciloscopio: más medidas y el espectro de la traza, calculados en la aplicación', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 2, eventos: informesDe(REGISTRO_CH1, 0, 1), repetir: true });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(page.locator('[data-trazas-fnirsi]')).toHaveAttribute('data-trazas-fnirsi', '1');
  const analisis = panel.locator('[data-analisis-fnirsi]');
  // closed until asked for: nothing of it on the page
  await expect(analisis.locator('[data-analisis-canal]')).toHaveCount(0);
  await analisis.locator('summary').click();
  const ch1 = analisis.locator('[data-analisis-canal="1"]');
  await expect(ch1).toBeVisible();
  // the capture: the generator's 1 kHz square wave, 3,01 V peak to peak, from 0 V up (500 mV per division at X10)
  const medidas = ch1.locator('[data-medidas-ampliadas]');
  await expect(medidas).toContainText(/Media1,[45]\d V/);
  await expect(medidas).toContainText(/Valor eficaz sin la continua1,[45]\d V/);
  await expect(medidas).toContainText(/Periodo1,00\d ms|Periodo999,\d µs/);
  await expect(medidas).toContainText(/Ciclo de trabajo(49|50),\d %/);
  await expect(ch1).toContainText('periodos enteros');
  await expect(ch1.locator('[data-espectro-fnirsi] polyline')).toHaveAttribute('points', /\d/);
  const tonos = ch1.locator('[data-tonos-fnirsi]');
  await expect(tonos).toContainText(/Fundamental: 1,00\d kHz|Fundamental: 999,\d Hz/);
  // a square wave: the third harmonic a third of the fundamental (−9,5 dB), the second far below
  await expect(tonos).toContainText(/3\.º −(9|10),\d dB/);
  await expect(tonos).toContainText(/Distorsión armónica \(hasta el 10\.º armónico\): 4\d,\d %/);
  await expect(ch1.getByRole('button', { name: 'Guardar la traza de CH1 (CSV)' })).toBeVisible();
  await expect(ch1.locator('[data-acoplamiento-fnirsi]')).toHaveCount(0);
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (más medidas y espectro)');
  // the file: handed to the browser's downloads, and said
  const descarga = page.waitForEvent('download');
  await ch1.getByRole('button', { name: 'Guardar la traza de CH1 (CSV)' }).click();
  expect((await descarga).suggestedFilename()).toMatch(/^traza-fnirsi-ch1-\d{4}-\d\d-\d\d-\d{6}\.csv$/);
  await expect(analisis.locator('[data-aviso-traza]')).toHaveText('Fichero descargado: está en las descargas del navegador.');
});

test('el FNIRSI cambia de modo: el enlace se va un momento y la conexión lo retoma sola', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 1, eventos: [deHex(MULTIMETRO.pila9V!)], repetir: true });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,201 V ⎓');
  // the link leaves the bus: the reading goes away at once and the reader is told why
  await cambiar(page, { desenchufado: 'Se ha perdido la conexión con el FNIRSI.', errorAbrir: 'No se encuentra el FNIRSI 2C53T.' });
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'reconectando');
  await expect(page.locator('[data-estado-fnirsi]')).toContainText('cada vez que cambia de modo');
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveCount(0);
  // …and comes back in oscilloscope mode
  await cambiar(page, { desenchufado: null, errorAbrir: null, modo: 2, eventos: informesDe(REGISTRO_CH1, 0, 2) } as Partial<Falso>);
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado', { timeout: 10_000 });
  await expect(page.locator('[data-trazas-fnirsi]')).toBeVisible();
  const f = await falso(page);
  expect(f.aperturas).toBe(2);
  expect(f.suscripciones).toEqual([3, 3]);
});

test('el FNIRSI no está: se dice, y se puede volver a intentar', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 1, errorAbrir: 'No se encuentra el FNIRSI 2C53T: compruebe que está enchufado.' });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'error');
  await expect(page.locator('[data-estado-fnirsi]')).toContainText('No se encuentra el FNIRSI');
  await cambiar(page, { errorAbrir: null, eventos: [deHex(MULTIMETRO.resistenciaAuto!)], repetir: true } as Partial<Falso>);
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,824 kΩ');
});

test('lo que no va en el flujo: el generador, las medidas propias del osciloscopio y RUN/STOP', async ({ page }) => {
  const bytes = (h: string) => Array.from(deHex(h));
  await limpio(page);
  // the generator: its settings, read from the instrument's memory
  await conEnlace(page, { modo: 3, memoria: { '20000f50': bytes(MEMORIA.generadorCuadrada) } });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  await expect(page.locator('[data-generador-fnirsi]')).toHaveText('Generador del FNIRSI: Cuadrada (Square Wave) · 15,00 kHz · ciclo 50 % · 3,0 V');
  await expect(page.locator('[data-medidas-fnirsi]')).toHaveCount(0);
  // a waveform whose name has not been seen: its place in the menu
  const otra = bytes(MEMORIA.generadorOndaCompleta);
  otra[1] = 0;
  await cambiar(page, { memoria: { '20000f50': otra } });
  await expect(page.locator('[data-generador-fnirsi]')).toHaveText('Generador del FNIRSI: forma n.º 1 de su menú · 35,00 kHz · ciclo 50 % · 2,0 V');
  // one of the last six, named on the unit on 2026-11-25
  otra[1] = 9;
  await cambiar(page, { memoria: { '20000f50': otra } });
  await expect(page.locator('[data-generador-fnirsi]')).toHaveText('Generador del FNIRSI: Continua (Direct Current) · 35,00 kHz · ciclo 50 % · 2,0 V');
  // the instrument goes to the oscilloscope, running: its own measurements next to the trace
  await cambiar(page, { desenchufado: 'Se ha perdido la conexión con el FNIRSI.', errorAbrir: 'No se encuentra el FNIRSI 2C53T.' });
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'reconectando');
  await expect(page.locator('[data-generador-fnirsi]')).toHaveCount(0);
  const memoria = { '20000f50': bytes(MEMORIA.generadorSierra), '200000f8': bytes(MEMORIA.osciloscopioEnMarcha), '20000208': bytes(MEMORIA.medidasTriangulo) };
  await cambiar(page, { desenchufado: null, errorAbrir: null, modo: 2, eventos: informesDe(REGISTRO_CH1, 0, 1), repetir: true, memoria } as Partial<Falso>);
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado', { timeout: 10_000 });
  await expect(page.locator('[data-medidas-fnirsi]')).toHaveText(
    'Medidas del propio FNIRSI en CH1: 50,18 kHz · ciclo 50,50 % · Vpp 220,0 mV · Vmáx 210,0 mV · Vmín −10,00 mV',
  );
  await expect(page.locator('[data-generador-fnirsi]')).toContainText('Diente de sierra (Sawtooth wave) · 50,00 kHz');
  await expect(page.locator('[data-marcha-fnirsi]')).toHaveCount(0);
  await expect(page.locator('[data-trazas-fnirsi]')).toBeVisible();
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (medidas propias y generador)');
  // STOP: no more records; the panel says so instead of asking whether it is in RUN
  await cambiar(page, { eventos: [], memoria: { ...memoria, '200000f8': bytes(MEMORIA.osciloscopioParado), '20000208': bytes(MEMORIA.medidasParado) } });
  await expect(page.locator('[data-marcha-fnirsi]')).toContainText('Osciloscopio en STOP');
  await expect(page.locator('[data-medidas-fnirsi]')).toContainText('40,23 kHz · ciclo 64,51 % · Vpp 114,0 mV');
  await expect(page.locator('[data-estado-fnirsi]')).toContainText('está en STOP', { timeout: 10_000 });
  const f = await falso(page);
  expect(new Set(f.lecturas)).toEqual(new Set([0x20000f50, 0x200000f8, 0x20000208]));
});

test('1.4.3: en la aplicación instalada, sin el flujo de estado, no se lee la memoria y la conexión sigue sin reconectar', async ({ page }) => {
  const bytes = (h: string) => Array.from(deHex(h));
  await limpio(page);
  // the plugin of the installed app refuses the memory read: before 1.4.3 that was taken for a lost link
  const memoria = { '20000f50': bytes(MEMORIA.generadorSierra), '200000f8': bytes(MEMORIA.osciloscopioEnMarcha), '20000208': bytes(MEMORIA.medidasTriangulo) };
  await conEnlace(page, { modo: 2, parche: 2, comoNativo: true, eventos: informesDe(REGISTRO_CH1, 0, 1), repetir: true, memoria });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  await expect(page.locator('[data-trazas-fnirsi]')).toHaveAttribute('data-trazas-fnirsi', '1');
  await page.waitForTimeout(3000);
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  const f = await falso(page);
  expect(f.aperturas).toBe(1);
  expect(f.lecturas ?? []).toEqual([]);
  await expect(page.locator('[data-generador-fnirsi]')).toHaveCount(0);
  await expect(page.locator('[data-enlace-fnirsi]')).toContainText('no llegan por esta vía: hace falta el parche 3 del enlace');
});

test('1.4.3: en la aplicación instalada, con el flujo de estado (parche 3), el generador llega igual', async ({ page }) => {
  const bytes = (h: string) => Array.from(deHex(h));
  await limpio(page);
  await conEnlace(page, { modo: 3, parche: 3, comoNativo: true, memoria: { '20000f50': bytes(MEMORIA.generadorCuadrada) } });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  await expect(page.locator('[data-generador-fnirsi]')).toHaveText('Generador del FNIRSI: Cuadrada (Square Wave) · 15,00 kHz · ciclo 50 % · 3,0 V');
  expect((await falso(page)).lecturas ?? []).toEqual([]);
});

test('un enlace con el flujo de estado (parche 3) lo envía él: lo mismo en pantalla sin preguntarle nada', async ({ page }) => {
  const bytes = (h: string) => Array.from(deHex(h));
  await limpio(page);
  await conEnlace(page, { modo: 3, parche: 3, memoria: { '20000f50': bytes(MEMORIA.generadorCuadrada) } });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  await expect(page.locator('[data-generador-fnirsi]')).toHaveText('Generador del FNIRSI: Cuadrada (Square Wave) · 15,00 kHz · ciclo 50 % · 3,0 V');
  // the oscilloscope, running and then stopped
  await cambiar(page, { desenchufado: 'Se ha perdido la conexión con el FNIRSI.', errorAbrir: 'No se encuentra el FNIRSI 2C53T.' });
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'reconectando');
  const memoria = { '20000f50': bytes(MEMORIA.generadorSierra), '200000f8': bytes(MEMORIA.osciloscopioEnMarcha), '20000208': bytes(MEMORIA.medidasTriangulo) };
  await cambiar(page, { desenchufado: null, errorAbrir: null, modo: 2, eventos: informesDe(REGISTRO_CH1, 0, 1), repetir: true, memoria } as Partial<Falso>);
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado', { timeout: 10_000 });
  await expect(page.locator('[data-medidas-fnirsi]')).toContainText('Medidas del propio FNIRSI en CH1: 50,18 kHz · ciclo 50,50 % · Vpp 220,0 mV · Vmáx 210,0 mV · Vmín −10,00 mV');
  await expect(page.locator('[data-generador-fnirsi]')).toContainText('Diente de sierra (Sawtooth wave) · 50,00 kHz');
  await expect(page.locator('[data-marcha-fnirsi]')).toHaveCount(0);
  await expect(page.locator('[data-trazas-fnirsi]')).toBeVisible();
  await cambiar(page, { eventos: [], memoria: { ...memoria, '200000f8': bytes(MEMORIA.osciloscopioParado), '20000208': bytes(MEMORIA.medidasParado) } });
  await expect(page.locator('[data-marcha-fnirsi]')).toContainText('Osciloscopio en STOP');
  await expect(page.locator('[data-medidas-fnirsi]')).toContainText('40,23 kHz · ciclo 64,51 % · Vpp 114,0 mV');
  await expect(page.locator('[data-estado-fnirsi]')).toContainText('está en STOP', { timeout: 10_000 });
  // the multimeter with this link: its readings as always (its status block is not used yet)
  await cambiar(page, { desenchufado: 'Se ha perdido la conexión con el FNIRSI.', errorAbrir: 'No se encuentra el FNIRSI 2C53T.' });
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'reconectando');
  await cambiar(page, { desenchufado: null, errorAbrir: null, modo: 1, eventos: [deHex(MULTIMETRO.pila9V!)], repetir: true } as Partial<Falso>);
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,201 V ⎓', { timeout: 10_000 });
  await panel.locator('summary').click();
  await expect(page.locator('[data-enlace-fnirsi]')).toHaveText('Enlace: protocolo 1, parche 3 · envía por sí mismo el generador, las medidas del osciloscopio y RUN/STOP');
  const f = await falso(page);
  expect(f.suscripciones).toEqual([7, 7, 7]);
  expect(f.lecturas ?? []).toEqual([]);
});

test('un enlace que anuncia el flujo de estado y no lo envía: la aplicación le pregunta como a uno sin él', async ({ page }) => {
  const bytes = (h: string) => Array.from(deHex(h));
  await limpio(page);
  await conEnlace(page, { modo: 3, parche: 3, estadoMudo: true, memoria: { '20000f50': bytes(MEMORIA.generadorOndaCompleta) } });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  await expect(page.locator('[data-generador-fnirsi]')).toHaveText('Generador del FNIRSI: Onda completa (Full Wave) · 35,00 kHz · ciclo 50 % · 2,0 V', { timeout: 10_000 });
  const f = await falso(page);
  expect(f.suscripciones).toEqual([7]);
  expect(new Set(f.lecturas)).toEqual(new Set([0x20000f50]));
});

test('el multímetro no pregunta nada, y un enlace que rechaza las lecturas no se vuelve a preguntar', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 1, eventos: [deHex(MULTIMETRO.pila9V!)], repetir: true });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,201 V ⎓');
  await page.waitForTimeout(1500);
  expect((await falso(page)).lecturas ?? []).toEqual([]);
  // the generator, with a link that has no such memory: asked once, and everything else goes on as before
  await cambiar(page, { desenchufado: 'Se ha perdido la conexión con el FNIRSI.', errorAbrir: 'No se encuentra el FNIRSI 2C53T.' });
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'reconectando');
  await cambiar(page, { desenchufado: null, errorAbrir: null, modo: 3, eventos: [] } as Partial<Falso>);
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado', { timeout: 10_000 });
  await page.waitForTimeout(1500);
  expect((await falso(page)).lecturas).toEqual([0x20000f50]);
  await expect(page.locator('[data-generador-fnirsi]')).toHaveCount(0);
  await expect(page.locator('[data-estado-fnirsi]')).toContainText('generador de señales', { timeout: 10_000 });
});

test('en el generador no hay medidas: se explica', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 3 });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  await expect(page.locator('[data-estado-fnirsi]')).toContainText('generador de señales', { timeout: 10_000 });
});
