// The real FNIRSI 2C53T through its «stock-link» USB link, in the browser, with a fake link
// (window.__epaFnirsiFalso, lib/fnirsi-real/transporte.ts) that answers the link's two requests and hands out real
// captured reports (fnirsi-real-datos.ts). On the free bench: without any transport nothing is shown; the multimeter's
// reading appears as the instrument's screen shows it; the oscilloscope's trace with its measurements; a link that
// leaves the bus for a moment (the instrument changes mode) is taken up again by itself, and one that does not come
// back is said so. Axe on the panel.
//   npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { axe, limpio, sinHallazgos } from './accesibilidad10-comun';
import { MULTIMETRO, REGISTRO_CH1 } from './fnirsi-real-datos.ts';

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
  eventos?: number[][];
  repetir?: boolean;
  desenchufado?: string;
  errorAbrir?: string;
  aperturas?: number;
  suscripciones?: number[];
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
  // HOLD on the instrument: its screen is frozen, the panel says so and goes on with the live reading
  await cambiar(page, { eventos: [deHex(MULTIMETRO.holdActivo!)] });
  await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('0,0003 V ⎓');
  await expect(page.locator('[data-hold-fnirsi]')).toHaveText('HOLD activo en el FNIRSI: su pantalla está congelada en −0,0005 V ⎓. Aquí sigue la lectura en vivo.');
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

test('en el generador no hay medidas: se explica', async ({ page }) => {
  await limpio(page);
  await conEnlace(page, { modo: 3 });
  await banco(page);
  const panel = page.locator('.elegir [data-fnirsi-real]');
  await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
  await expect(page.locator('[data-estado-fnirsi]')).toContainText('generador de señales', { timeout: 10_000 });
});
