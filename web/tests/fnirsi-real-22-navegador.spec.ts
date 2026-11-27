// 2.2 (owner's answers, 26-11 15:23, checked on his unit): the real FNIRSI 2C53T's card on the bench, with the fake link
// (lib/fnirsi-real/transporte.ts) and single frames built from the values he gave. A channel's own measurements come
// only with the status stream (patch 3; the app no longer reads the instrument's memory: a link without it gets a
// line saying so) and go by its bit in byte 20 of the newest record's header, and none of its twelve words shows when
// the bit is 0; Amp, Vrms and Avg (words 9 to 11) in the line, the X10 factor not applied twice,
// the negative duty not shown; while byte 47 (the AUTO key's step) is not 0, only «El FNIRSI está ajustándose (AUTO)»;
// the trigger channel and mode next to the edge; CH2's coupling where CH1's is told; the generator's added entries only
// as many as the identification says.
//   npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-22-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { axe, limpio, sinHallazgos } from './accesibilidad10-comun';
import { MEMORIA, REGISTRO_CH1, REGISTRO_PAR_CH1, REGISTRO_PAR_CH2 } from './fnirsi-real-datos.ts';

const BANCO = '/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm';
const deHex = (h: string) => h.match(/../g)!.map((x) => parseInt(x, 16));

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'escritorio'));

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

/** One real record with some of its 56 settings bytes changed (`cambios`: byte → value), as base64. */
function registroCon(registro: string, cambios: Record<number, number>): string {
  const b = Buffer.from(registro, 'base64');
  for (const [k, v] of Object.entries(cambios)) b[Number(k)] = v;
  return b.toString('base64');
}

/** The oscilloscope's 56 state bytes read from the unit, with some changed. */
function estadoCon(cambios: Record<number, number>): number[] {
  const b = deHex(MEMORIA.osciloscopioEnMarcha);
  for (const [k, v] of Object.entries(cambios)) b[Number(k)] = v;
  return b;
}

/** One channel's twelve words (48 bytes, little-endian, signed). */
function palabras(w: Record<number, number>): number[] {
  const v = new DataView(new ArrayBuffer(48));
  for (const [k, x] of Object.entries(w)) v.setInt32(4 * Number(k), x, true);
  return Array.from(new Uint8Array(v.buffer));
}
// 1 kHz, duty 50.40 % / 49.60 %; Vmax, Vmin, Vpp; then Amp, Vrms, Avg as the owner gave them, at X1 and at X10
const X1 = palabras({ 0: 1000, 1: 1_000_000, 2: 5040, 3: 4960, 4: 504_000, 5: 496_000, 6: 324_000, 7: -8_000, 8: 332_000, 9: 316_000, 10: 208_000, 11: 148_000 });
const X10 = palabras({ 0: 1000, 1: 1_000_000, 2: 5040, 3: 4960, 4: 504_000, 5: 496_000, 6: 3_120_000, 7: -80_000, 8: 3_200_000, 9: 3_040_000, 10: 2_108_800, 11: 1_490_400 });

async function conEnlace(page: Page, f: Record<string, unknown>) {
  await page.addInitScript((x) => {
    (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = x;
  }, f);
}
async function cambiar(page: Page, f: Record<string, unknown>) {
  await page.evaluate((x) => {
    const c = (window as unknown as { __epaFnirsiFalso: Record<string, unknown> }).__epaFnirsiFalso;
    for (const [k, v] of Object.entries(x)) c[k] = v;
  }, f);
}
async function conectar(page: Page) {
  await page.goto(BANCO);
  await expect(page.locator('.banco h1')).toBeVisible({ timeout: 60_000 });
  if (await page.locator('[data-usar-aparato-real]').count()) {
    await page.locator('[data-usar-aparato-real]').click();
    await expect(page.locator('.elegir h2')).toBeVisible({ timeout: 60_000 });
  }
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado', { timeout: 15_000 });
  return panel;
}

test('con el flujo de estado: las doce medidas con los rótulos y el orden de la pantalla, y con X10 nada se multiplica otra vez', async ({ page }) => {
  await limpio(page);
  // (2.2: the measurements come only with the status stream, patch 3: the app no longer reads the instrument's memory)
  const memoria = { '20000f50': deHex(MEMORIA.generadorSierra), '200000f8': estadoCon({ 20: 1 }), '20000208': X1 };
  await conEnlace(page, { modo: 2, parche: 3, eventos: informesDe(REGISTRO_CH1, 0, 1), repetir: true, memoria });
  const panel = await conectar(page);
  const ch1 = page.locator('[data-medidas-fnirsi="CH1"]');
  // X1: the twelve words after the screen's own labels, in its order (owner, 27-11)
  await expect(ch1).toHaveText(
    'Medidas del propio FNIRSI en CH1: Frec: 1,000 kHz · Per: 1,000 ms · Ciclo+: 50,40 % · Ciclo-: 49,60 % · Anc+: 504,0 µs · Anc-: 496,0 µs · Vmáx: 324,0 mV · Vmín: −8,000 mV · Vp-p: 332,0 mV · Amp: 316,0 mV · Vef: 208,0 mV · Med: 148,0 mV',
    { timeout: 10_000 },
  );
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (medidas propias 2.2)');
  // X10: the words already carry the factor; nothing is multiplied again
  await cambiar(page, { memoria: { ...memoria, '20000208': X10 } });
  await expect(ch1).toContainText('Vmáx: 3,120 V · Vmín: −80,00 mV · Vp-p: 3,200 V · Amp: 3,040 V · Vef: 2,109 V · Med: 1,490 V', { timeout: 10_000 });
  await expect(panel).not.toContainText('30,40 V');
  // CH1 off in the newest record's header: none of its words
  await cambiar(page, { eventos: informesDe(registroCon(REGISTRO_CH1, { 20: 2 }), 0, 2) });
  await expect(ch1).toHaveCount(0, { timeout: 10_000 });
  await expect(panel).not.toContainText('en CH1:');
  const f = await page.evaluate(() => (window as unknown as { __epaFnirsiFalso: { lecturas?: number[] } }).__epaFnirsiFalso);
  expect(f.lecturas ?? []).toEqual([]);
});

test('sin el flujo de estado (parche 2): no se lee la memoria del FNIRSI y cada dato dice que hace falta el parche 3', async ({ page }) => {
  await limpio(page);
  const memoria = { '20000f50': deHex(MEMORIA.generadorSierra), '200000f8': estadoCon({ 20: 1 }), '20000208': X1 };
  await conEnlace(page, { modo: 2, eventos: informesDe(REGISTRO_CH1, 0, 1), repetir: true, memoria });
  const panel = await conectar(page);
  await expect(page.locator('[data-trazas-fnirsi]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-medidas-fnirsi="CH1"]')).toHaveText('Las medidas propias de CH1 solo llegan con el flujo de estado del enlace (parche 3).');
  await expect(page.locator('[data-falta-parche-fnirsi]')).toHaveText(
    'El RUN/STOP del osciloscopio y los ajustes del generador del FNIRSI solo llegan con el flujo de estado del enlace (parche 3).',
  );
  await expect(page.locator('[data-generador-fnirsi]')).toHaveCount(0);
  await expect(panel).not.toContainText('Medidas del propio FNIRSI');
  await page.waitForTimeout(2000);
  const f = await page.evaluate(() => (window as unknown as { __epaFnirsiFalso: { lecturas?: number[] } }).__epaFnirsiFalso);
  expect(f.lecturas ?? []).toEqual([]);
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real sin el flujo de estado');
});

test('con el flujo de estado: la cabecera del registro dice los canales y la tecla AUTO (el flujo solo trae RUN/STOP con las palabras)', async ({ page }) => {
  await limpio(page);
  const memoria = { '20000f50': deHex(MEMORIA.generadorSierra), '200000f8': estadoCon({ 20: 1 }), '20000208': X1, '20000238': X10 };
  await conEnlace(page, { modo: 2, parche: 3, eventos: informesDe(REGISTRO_CH1, 0, 1), repetir: true, memoria });
  const panel = await conectar(page);
  await expect(page.locator('[data-medidas-fnirsi="CH1"]')).toContainText('Amp: 316,0 mV · Vef: 208,0 mV · Med: 148,0 mV', { timeout: 10_000 });
  // CH2 is off in the header: none of its words, though its block arrives
  await expect(page.locator('[data-medidas-fnirsi="CH2"]')).toHaveCount(0);
  await expect(panel).not.toContainText('3,040 V');
  // both on: CH2's line too, with its own words
  await cambiar(page, { eventos: [...informesDe(registroCon(REGISTRO_CH1, { 20: 3 }), 0, 2), ...informesDe(registroCon(REGISTRO_CH1, { 20: 3 }), 1, 2)] });
  await expect(page.locator('[data-medidas-fnirsi="CH2"]')).toContainText(/Medidas del propio FNIRSI en CH2: Frec: 1,000 kHz · .*Ciclo\+: 50,40 % · .*Vp-p: 3,200 V/, { timeout: 10_000 });
  await expect(page.locator('[data-medidas-fnirsi="CH2"]')).toContainText('Amp: 3,040 V · Vef: 2,109 V · Med: 1,490 V');
  // the AUTO key pressed: the header's byte 47 is not 0
  await cambiar(page, { eventos: informesDe(registroCon(REGISTRO_CH1, { 47: 1 }), 0, 3) });
  await expect(page.locator('[data-medidas-fnirsi]')).toHaveText(['El FNIRSI está ajustándose (AUTO)'], { timeout: 10_000 });
  await cambiar(page, { eventos: informesDe(REGISTRO_CH1, 0, 4) });
  await expect(page.locator('[data-medidas-fnirsi="CH1"]')).toContainText('Amp: 316,0 mV', { timeout: 10_000 });
});

test('el disparo con su canal y su modo junto al flanco; el acoplamiento de CH2 donde se dice el de CH1', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 2, eventos: informesDe(registroCon(REGISTRO_CH1, { 22: 1, 23: 2 }), 0, 1), repetir: true });
  const panel = await conectar(page);
  const disparo = panel.locator('[data-disparo-fnirsi]');
  await expect(disparo).toHaveText('Flanco de disparo: subida · canal: CH2 · modo: Único');
  await cambiar(page, { eventos: informesDe(registroCon(REGISTRO_CH1, { 22: 0, 23: 0, 24: 1 }), 0, 2) });
  await expect(disparo).toHaveText('Flanco de disparo: bajada · canal: CH1 · modo: Normal');
  await cambiar(page, { eventos: informesDe(registroCon(REGISTRO_CH1, { 22: 9, 23: 9 }), 0, 3) });
  await expect(disparo).toHaveText('Flanco de disparo: subida · canal: desconocido · modo: desconocido');
  // both channels: CH2 in alternating (byte 1 = 0) is told in its analysis, as CH1's is; CH1 stays direct
  const par = (b1: number, s: number) => [...informesDe(registroCon(REGISTRO_PAR_CH1, { 1: b1 }), 0, s), ...informesDe(registroCon(REGISTRO_PAR_CH2, { 1: b1 }), 1, s)];
  await cambiar(page, { eventos: par(0, 4) });
  await expect(page.locator('[data-trazas-fnirsi]')).toHaveAttribute('data-trazas-fnirsi', '2', { timeout: 10_000 });
  const analisis = panel.locator('[data-analisis-fnirsi]');
  await analisis.locator('summary').click();
  const ch2 = analisis.locator('[data-analisis-canal="2"]');
  await expect(ch2.locator('[data-acoplamiento-fnirsi]')).toHaveText('CH2 está en CA: la media y los valores máximo y mínimo no incluyen la componente continua de la señal.', { timeout: 10_000 });
  await expect(analisis.locator('[data-analisis-canal="1"] [data-acoplamiento-fnirsi]')).toHaveCount(0);
  sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'panel del FNIRSI real (disparo y acoplamiento de CH2)');
  // byte 1 = 1: CH2 direct, nothing to tell
  await cambiar(page, { eventos: par(1, 5) });
  await expect(ch2.locator('[data-acoplamiento-fnirsi]')).toHaveCount(0, { timeout: 10_000 });
});

test('el generador: solo las entradas añadidas que dice la identificación (cinco en la unidad del dueño)', async ({ page }) => {
  await limpio(page);
  const con = (forma: number) => {
    const b = deHex(MEMORIA.generadorCuadrada);
    b[1] = forma;
    return b;
  };
  await conEnlace(page, { modo: 3, parche: 6, entradaUsb: 17, memoria: { '20000f50': con(17) } });
  await conectar(page);
  const generador = page.locator('[data-generador-fnirsi]');
  await expect(generador).toContainText('Generador del FNIRSI: Onda USB (entrada n.º 18 de su menú, añadida por el enlace, la que reproduce la onda que se le envía) ·');
  // one past the five the identification announces: not an added entry
  await cambiar(page, { memoria: { '20000f50': con(18) } });
  await expect(generador).toContainText('Generador del FNIRSI: la forma n.º 19 de su menú ·', { timeout: 10_000 });
  await expect(generador).not.toContainText('añadida');
});
