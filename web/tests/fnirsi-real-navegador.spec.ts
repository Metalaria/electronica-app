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
  tabla?: number[];
  ondas?: [number, number][];
  ondaEstropeada?: boolean;
  entradaUsb?: number;
  tablaUsb?: number[];
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
  // (2.1: the real instruments' panel opens from «Usar un aparato real», shown only where a transport exists)
  await expect(page.locator('.banco h1')).toBeVisible({ timeout: 60_000 });
  if (await page.locator('[data-usar-aparato-real]').count()) {
    await page.locator('[data-usar-aparato-real]').click();
    await expect(page.locator('.elegir h2')).toBeVisible({ timeout: 60_000 });
  }
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

test('osciloscopio: el promedio de varias adquisiciones y los cursores sobre la traza, de la aplicación', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 2, eventos: informesDe(REGISTRO_CH1, 0, 1), repetir: true });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(page.locator('[data-trazas-fnirsi]')).toHaveAttribute('data-trazas-fnirsi', '1');
  // not averaging until asked: nothing said about it
  await expect(panel.locator('[data-promedio-estado]')).toHaveCount(0);
  await panel.locator('[data-promedio-fnirsi]').selectOption('4');
  await expect(panel.locator('[data-promedio-estado]')).toContainText('CH1: promedio de 4 adquisiciones.');
  await expect(panel.locator('[data-promedio-estado]')).toContainText('Lo hace la aplicación');
  // the trace is still drawn, and the line of the channel is still the last acquisition's
  await expect(page.locator('[data-trazas-fnirsi] polyline')).toHaveAttribute('points', /\d/);
  await expect(page.locator('[data-canal-fnirsi="1"]')).toContainText(/Vpp 3,0\d V/);
  // the analysis works on the average, and says so
  await panel.locator('[data-analisis-fnirsi] summary').click();
  const ch1 = panel.locator('[data-analisis-canal="1"]');
  await expect(ch1.locator('[data-analisis-promedio]')).toHaveText('Sobre el promedio de 4 adquisiciones: 24 divisiones alrededor del disparo.');
  await expect(ch1.locator('[data-medidas-ampliadas]')).toContainText(/Ciclo de trabajo(49|50),\d %/);
  await expect(ch1.locator('[data-tonos-fnirsi]')).toContainText(/Fundamental: 1,00\d kHz|Fundamental: 999,\d Hz/);
  await expect(ch1.getByRole('button', { name: 'Guardar el promedio de CH1 (CSV)' })).toBeVisible();
  // the cursors: off until asked for
  const cursores = panel.locator('[data-cursores-fnirsi]');
  await expect(page.locator('[data-linea-cursor]')).toHaveCount(0);
  await cursores.getByLabel('Cursores').check();
  await expect(page.locator('[data-linea-cursor]')).toHaveCount(4);
  // 125 samples of 8 µs apart: one period of the 1 kHz wave; and 50 counts, two divisions of 500 mV
  await cursores.locator('[data-cursor="t1"]').fill('25');
  await cursores.locator('[data-cursor="t2"]').fill('150');
  await cursores.locator('[data-cursor="v1"]').fill('103');
  await cursores.locator('[data-cursor="v2"]').fill('153');
  await expect(cursores.locator('[data-cursores-tiempo]')).toHaveText('De T1 a T2: 1,000 ms · su inverso: 1,000 kHz');
  await expect(cursores.locator('[data-cursores-canal="1"]')).toContainText('CH1: de V1 a V2, 1,00 V');
  await expect(cursores.locator('[data-cursores-canal="1"]')).toContainText(/la traza vale .+ V en T1 y .+ V en T2/);
  await expect(page.locator('[data-linea-cursor="T2"]')).toHaveAttribute('x1', '150');
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (promedio y cursores)');
  // the two cursors on the same sample: no inverse to give
  await cursores.locator('[data-cursor="t2"]').fill('25');
  await expect(cursores.locator('[data-cursores-tiempo]')).toHaveText('De T1 a T2: 0 s · su inverso: —');
  // and back to each record as it arrives
  await panel.locator('[data-promedio-fnirsi]').selectOption('1');
  await expect(panel.locator('[data-promedio-estado]')).toHaveCount(0);
  await expect(ch1.locator('[data-analisis-promedio]')).toHaveCount(0);
  await expect(ch1.getByRole('button', { name: 'Guardar la traza de CH1 (CSV)' })).toBeVisible();
});

test('multímetro: lectura relativa y límites con aviso, de la aplicación', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 1, eventos: [deHex(MULTIMETRO.pila9V!)], repetir: true });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,201 V ⎓');
  const extras = panel.locator('[data-extras-multimetro]');
  await extras.locator('summary').click();
  await expect(extras.locator('[data-relativo-fnirsi]')).toHaveCount(0);
  // the 9,201 V of the battery as zero
  await extras.getByRole('button', { name: 'Tomar esta lectura como cero' }).click();
  await expect(extras.locator('[data-relativo-fnirsi]')).toHaveText(/^Relativo: 0[,0]* V \(0 %\) respecto a 9,201 V$/);
  await cambiar(page, { eventos: [deHex(MULTIMETRO.vdcCero!)] });
  await expect(extras.locator('[data-relativo-fnirsi]')).toHaveText('Relativo: −9,201 V (−100 %) respecto a 9,201 V');
  // the instrument goes to another unit: nothing to subtract, and it says why
  await cambiar(page, { eventos: [deHex(MULTIMETRO.ohm10k!)] });
  await expect(extras.locator('[data-relativo-fnirsi]')).toHaveText('El cero se tomó en V y ahora el aparato mide Ω: no hay diferencia que dar.');
  await extras.getByRole('button', { name: 'Quitar el cero' }).click();
  await expect(extras.locator('[data-relativo-fnirsi]')).toHaveCount(0);
  // limits: the battery inside them, the shorted probes under the minimum
  await cambiar(page, { eventos: [deHex(MULTIMETRO.pila9V!)] });
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,201 V ⎓');
  await extras.locator('[data-limite="minimo"]').fill('9');
  await extras.locator('[data-limite="maximo"]').fill('9,5');
  await extras.getByRole('button', { name: 'Vigilar' }).click();
  const alarma = extras.locator('[data-alarma-fnirsi]');
  await expect(alarma).toHaveText('Dentro de los límites (de 9,000 V a 9,500 V).');
  await expect(alarma).toHaveAttribute('data-alarma-fnirsi', 'dentro');
  await cambiar(page, { eventos: [deHex(MULTIMETRO.vdcCero!)] });
  await expect(alarma).toHaveText('Por debajo del mínimo (9,000 V). Ha salido de los límites 1 vez.');
  await expect(alarma).toHaveAttribute('data-alarma-fnirsi', 'bajo');
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (relativo y límites)');
  await cambiar(page, { eventos: [deHex(MULTIMETRO.pila9V!)] });
  await expect(alarma).toHaveText('Dentro de los límites (de 9,000 V a 9,500 V). Ha salido de los límites 1 vez.');
  // another unit: in suspense, not an alarm
  await cambiar(page, { eventos: [deHex(MULTIMETRO.ohm10k!)] });
  await expect(alarma).toHaveText('Los límites se fijaron en V y ahora el aparato mide Ω: en suspenso. Ha salido de los límites 1 vez.');
  await cambiar(page, { eventos: [deHex(MULTIMETRO.pila9V!)] });
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,201 V ⎓');
  // what cannot be a limit is said, and the limits in force stay
  await extras.locator('[data-limite="minimo"]').fill('abc');
  await extras.getByRole('button', { name: 'Vigilar' }).click();
  await expect(extras.locator('[data-error-limites]')).toContainText('No se entiende «abc»');
  await extras.locator('[data-limite="minimo"]').fill('10');
  await extras.locator('[data-limite="maximo"]').fill('9');
  await extras.getByRole('button', { name: 'Vigilar' }).click();
  await expect(extras.locator('[data-error-limites]')).toHaveText('El mínimo es mayor que el máximo.');
  await expect(alarma).toContainText('de 9,000 V a 9,500 V');
  // one side only, written with a prefix: 9500 mV, over the battery's 9,201 V
  await extras.locator('[data-limite="minimo"]').fill('9500 mV');
  await extras.locator('[data-limite="maximo"]').fill('');
  await extras.getByRole('button', { name: 'Vigilar' }).click();
  await expect(extras.locator('[data-error-limites]')).toHaveCount(0);
  await expect(alarma).toHaveText('Por debajo del mínimo (9,500 V). Ha salido de los límites 1 vez.');
  await extras.getByRole('button', { name: 'Quitar los límites' }).click();
  await expect(alarma).toHaveCount(0);
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
  await expect(page.locator('[data-generador-fnirsi]')).toHaveText('Generador del FNIRSI: Senoidal (Sine Wave) · 35,00 kHz · ciclo 50 % · 2,0 V');
  // one of the last six, named on the unit on 2026-11-25
  otra[1] = 9;
  await cambiar(page, { memoria: { '20000f50': otra } });
  await expect(page.locator('[data-generador-fnirsi]')).toHaveText('Generador del FNIRSI: Continua (Direct current) · 35,00 kHz · ciclo 50 % · 2,0 V');
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
  await panel.locator('details.fr-diag > summary').click();
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

test('generador: una onda a medida se envía, se comprueba releyéndola y se dice lo que dura (parche 4)', async ({ page }) => {
  const bytes = (h: string) => Array.from(deHex(h));
  await limpio(page);
  await conEnlace(page, { modo: 3, parche: 4, memoria: { '20000f50': bytes(MEMORIA.generadorCuadrada) } });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  const onda = panel.locator('[data-onda-fnirsi]');
  await expect(onda).toBeVisible();
  // closed: nothing prepared, nothing sent
  await expect(onda.locator('[data-onda-vista]')).toHaveCount(0);
  await onda.locator('summary').click();
  await expect(onda).toContainText('Esto sí escribe en el FNIRSI: la tabla de 100 muestras que reproduce su generador, y nada más.');
  await expect(onda).toContainText('3,0 V, la que tiene puesta ahora');
  await expect(onda.locator('[data-onda-vista] polyline')).toHaveAttribute('points', /^0\.0,/);
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (onda a medida)');
  expect((await falso(page)).ondas ?? []).toEqual([]);
  // a sum of harmonics with a mistake in it, then right
  await onda.locator('[data-onda-forma]').selectOption('armonicos');
  await onda.locator('[data-onda-armonicos]').fill('1:1; 40:1');
  await expect(onda.locator('[data-onda-error-forma]')).toContainText('va de 1 a 25');
  await expect(onda.locator('[data-onda-enviar]')).toBeDisabled();
  await onda.locator('[data-onda-armonicos]').fill('1:1; 3:0,33; 5:0,2');
  await expect(onda.locator('[data-onda-error-forma]')).toHaveCount(0);
  await onda.locator('[data-onda-enviar]').click();
  const estado = onda.locator('[data-onda-estado]');
  await expect(estado).toHaveAttribute('data-onda-estado', 'enviada');
  await expect(estado).toContainText(/Enviada y comprobada a las \d+:\d+:\d+: suma de armónicos, 100 muestras con una amplitud de 3,0 V\. El aparato sigue mostrando Cuadrada \(Square Wave\)\./);
  let f = await falso(page);
  expect(f.ondas).toEqual([[0, 28], [28, 28], [56, 28], [84, 16]]);
  expect(f.tabla!.length).toBe(100);
  expect(Math.min(...f.tabla!)).toBe(20);
  expect(Math.max(...f.tabla!)).toBe(3741);
  // a pulse with a quarter high, upside down: three quarters of the table at the top
  await onda.locator('[data-onda-forma]').selectOption('pulso');
  await onda.locator('[data-onda-ciclo]').fill('25');
  await onda.locator('[data-onda-invertir]').check();
  await onda.locator('[data-onda-enviar]').click();
  await expect(estado).toContainText('pulso, invertida');
  f = await falso(page);
  expect(f.tabla!.filter((x) => x === 3741).length).toBe(75);
  expect(f.tabla!.filter((x) => x === 20).length).toBe(25);
  // one period from a file with four points
  await onda.locator('[data-onda-elegir-fichero]').setInputFiles({ name: 'periodo.csv', mimeType: 'text/csv', buffer: Buffer.from('# un periodo\nvoltios\n0\n1\n0\n-1\n') });
  await expect(onda.locator('[data-onda-fichero]')).toHaveText('Un periodo tomado de «periodo.csv» (4 puntos, llevados a 100).');
  await expect(onda.locator('[data-onda-forma]')).toBeDisabled();
  await onda.locator('[data-onda-invertir]').uncheck();
  await onda.locator('[data-onda-enviar]').click();
  await expect(estado).toContainText('«periodo.csv»');
  f = await falso(page);
  expect([f.tabla![0], f.tabla![25], f.tabla![75]]).toEqual([1880, 3741, 20]);
  await onda.locator('[data-onda-quitar-fichero]').click();
  await expect(onda.locator('[data-onda-forma]')).toBeEnabled();
  await onda.locator('[data-onda-elegir-fichero]').setInputFiles({ name: 'mal.txt', mimeType: 'text/plain', buffer: Buffer.from('1\n2\ntres\n4 x\n') });
  await expect(onda.locator('[data-onda-error-fichero]')).toContainText('no es un número: «x»');
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (onda enviada)');
  // a setting of the generator changed on the instrument: its own waveform is back, and it is said
  await cambiar(page, { memoria: { '20000f50': bytes(MEMORIA.generadorSierra) } });
  await expect(estado).toHaveAttribute('data-onda-estado', 'deshecha', { timeout: 10_000 });
  await expect(estado).toContainText('El FNIRSI ha vuelto a su propia onda (Diente de sierra (Sawtooth wave))');
  // a link that stores something else than what it was sent: the read-back catches it
  await cambiar(page, { ondaEstropeada: true });
  await onda.locator('[data-onda-enviar]').click();
  await expect(onda.locator('[data-onda-error]')).toContainText('no coincide con la onda enviada en 1 de 100 muestras');
  await expect(estado).toHaveCount(0);
  await panel.locator('details.fr-diag > summary').click();
  await expect(page.locator('[data-enlace-fnirsi]')).toContainText('parche 4 · envía por sí mismo el generador, las medidas del osciloscopio y RUN/STOP · admite ondas a medida en el generador');
});

test('generador con una entrada propia en su menú (parche 6): la onda se guarda sin tocar la que suena, y suena al elegir la entrada', async ({ page }) => {
  const cuadrada = Array.from(deHex(MEMORIA.generadorCuadrada));
  await limpio(page);
  await conEnlace(page, { modo: 3, parche: 6, entradaUsb: 17, memoria: { '20000f50': cuadrada } });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  const onda = panel.locator('[data-onda-fnirsi]');
  await onda.locator('summary').click();
  await expect(onda).toContainText('tiene en su lista de formas una entrada para lo que se le envía (la n.º 18)');
  await expect(onda).toContainText('solo suena mientras esa entrada esté elegida');
  await onda.locator('[data-onda-forma]').selectOption('gaussiana');
  await onda.locator('[data-onda-enviar]').click();
  const estado = onda.locator('[data-onda-estado]');
  await expect(estado).toHaveAttribute('data-onda-estado', 'guardada');
  await expect(estado).toContainText('en la entrada n.º 18 de la lista de formas del aparato, hasta que lo apague. No está sonando: el FNIRSI sigue con Cuadrada (Square Wave), que no se ha tocado.');
  let f = await falso(page);
  expect(f.tabla).toEqual(Array(100).fill(20));
  expect(Math.max(...f.tablaUsb!)).toBe(4094);
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (onda guardada en su entrada)');
  // the entry is selected on the instrument: the card says the waveform is the one playing now
  const elegida = [...cuadrada];
  elegida[1] = 17;
  await cambiar(page, { memoria: { '20000f50': elegida } });
  await expect(estado).toContainText('elegida ahora en el FNIRSI', { timeout: 10_000 });
  await expect(page.locator('[data-generador-fnirsi]')).toContainText('la entrada n.º 18 de su menú, añadida por el enlace (la que reproduce la onda que se le envía)');
  // sent with the entry selected: played at once, read back, and it lasts through a change of amplitude
  await onda.locator('[data-onda-forma]').selectOption('escalera');
  await onda.locator('[data-onda-enviar]').click();
  await expect(estado).toHaveAttribute('data-onda-estado', 'enviada');
  await expect(estado).toContainText('Es la entrada n.º 18 de la lista de formas del aparato, la que está elegida: dura hasta que lo apague o envíe otra, aunque cambie la amplitud.');
  f = await falso(page);
  expect(Math.max(...f.tabla!)).toBe(3741);
  const otraAmplitud = [...elegida];
  otraAmplitud[9] = 20;
  await cambiar(page, { memoria: { '20000f50': otraAmplitud } });
  await expect(page.locator('[data-generador-fnirsi]')).toContainText('2,0 V', { timeout: 10_000 });
  await expect(estado).toHaveAttribute('data-onda-estado', 'enviada');
  // another waveform chosen on the instrument: the sent one is no longer what plays
  await cambiar(page, { memoria: { '20000f50': cuadrada } });
  await expect(estado).toHaveAttribute('data-onda-estado', 'deshecha', { timeout: 10_000 });
});

/** One real record with some of its 56 settings bytes changed (`cambios`: byte → value), as base64. */
function registroCon(cambios: Record<number, number>): string {
  const b = Buffer.from(REGISTRO_CH1, 'base64');
  for (const [k, v] of Object.entries(cambios)) b[Number(k)] = v;
  return b.toString('base64');
}

test('2.1.1: el flanco de disparo, y las bases de 5 ms y 20 ms sin el aviso de escala sin comprobar', async ({ page }) => {
  await limpio(page);
  // (the capture was taken with the rising edge: byte 24 is 0; byte 45 is the time base, 13 = 200 µs)
  await conEnlace(page, { modo: 2, eventos: informesDe(REGISTRO_CH1, 0, 1), repetir: true });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  const disparo = panel.locator('[data-disparo-fnirsi]');
  await expect(disparo).toHaveText('Flanco de disparo: subida');
  await cambiar(page, { eventos: informesDe(registroCon({ 24: 1 }), 0, 2) });
  await expect(disparo).toHaveText('Flanco de disparo: bajada');
  await expect(panel).toContainText('200 µs/div');
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (flanco de bajada)');
  await cambiar(page, { eventos: informesDe(registroCon({ 24: 7 }), 0, 3) });
  await expect(disparo).toHaveText('Flanco de disparo: desconocido');
  // the time bases: 5 ms and 20 ms checked on the unit, 10 ms not
  for (const [indice, texto, aviso, secuencia] of [[17, '5,00 ms/div', false, 4], [19, '20,0 ms/div', false, 5], [18, '10,0 ms/div', true, 6]] as const) {
    await cambiar(page, { eventos: informesDe(registroCon({ 45: indice }), 0, secuencia) });
    await expect(panel).toContainText(texto);
    await expect(panel.getByText('escala de tiempo sin comprobar en esta base')).toHaveCount(aviso ? 1 : 0);
  }
});

for (const nativo of [false, true])
  test(`2.1.1: una onda enviada mientras suena una entrada añadida por el enlace (${nativo ? 'aplicación instalada' : 'navegador'}): se nombra por su posición, sin etiqueta`, async ({ page }) => {
    const anadida = Array.from(deHex(MEMORIA.generadorCuadrada));
    anadida[1] = 13;
    await limpio(page);
    await conEnlace(page, { modo: 3, parche: 6, entradaUsb: 17, comoNativo: nativo, memoria: { '20000f50': anadida } });
    await banco(page);
    const panel = page.locator('.elegir [data-fnirsi-real]');
    await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
    await expect(page.locator('[data-generador-fnirsi]')).toContainText('Generador del FNIRSI: la entrada n.º 14 de su menú, añadida por el enlace ·');
    const onda = panel.locator('[data-onda-fnirsi]');
    await onda.locator('summary').click();
    await onda.locator('[data-onda-enviar]').click();
    const estado = onda.locator('[data-onda-estado]');
    // patch 6 with another entry selected: kept for the USB entry, the added entry that plays is left alone
    await expect(estado).toHaveAttribute('data-onda-estado', 'guardada');
    await expect(estado).toContainText('No está sonando: el FNIRSI sigue con la entrada n.º 14 de su menú, añadida por el enlace, que no se ha tocado.');
    await expect(estado).toHaveClass(/aviso21/);
    await expect(estado).not.toHaveClass(/mal|bien/);
    const f = await falso(page);
    expect(f.tabla).toEqual(Array(100).fill(20));
    expect(Math.max(...f.tablaUsb!)).toBe(4094);
    expect(f.lecturas ?? []).toEqual([]);
    // no label of the link is shown as the name the screen gives it
    await expect(panel).not.toContainText(/Triangle|Gauss Pulse|Burst|AM 80|USB Wave/);
    sinHallazgos(await axe(page, '[data-fnirsi-real]'), `onda guardada con una entrada añadida sonando (${nativo ? 'instalada' : 'navegador'})`);
  });

test('2.1.1: con el parche 5 la onda enviada suena aunque esté elegida una entrada añadida, y se dice cuál sigue mostrando', async ({ page }) => {
  const anadida = Array.from(deHex(MEMORIA.generadorCuadrada));
  anadida[1] = 14;
  await limpio(page);
  await conEnlace(page, { modo: 3, parche: 5, entradaUsb: 17, memoria: { '20000f50': anadida } });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  const onda = panel.locator('[data-onda-fnirsi]');
  await onda.locator('summary').click();
  await onda.locator('[data-onda-enviar]').click();
  const estado = onda.locator('[data-onda-estado]');
  await expect(estado).toHaveAttribute('data-onda-estado', 'enviada');
  await expect(estado).toContainText('El aparato sigue mostrando la entrada n.º 15 de su menú, añadida por el enlace.');
  await expect(estado).toContainText('Queda además en la entrada n.º 18 de la lista de formas del aparato');
});

test('un enlace sin el parche 4 no ofrece la onda a medida', async ({ page }) => {
  const bytes = (h: string) => Array.from(deHex(h));
  await limpio(page);
  await conEnlace(page, { modo: 3, parche: 3, memoria: { '20000f50': bytes(MEMORIA.generadorCuadrada) } });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  await expect(page.locator('[data-generador-fnirsi]')).toContainText('Cuadrada (Square Wave)');
  await expect(panel.locator('[data-onda-fnirsi]')).toHaveCount(0);
  expect((await falso(page)).ondas ?? []).toEqual([]);
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
