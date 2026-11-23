// 1.3.1 (qa131-interaccion): the real Brymen's panel against a misbehaving cable (the fake one of transporte.ts), on
// the free bench (#/instrumentos/circuito/…): «Desconectar» pressed while the cable is still opening (the system's
// permission dialog open) really disconnects — before, the opening finished and the polling started anyway —; a packet
// split over two reads is put together; malformed bytes, a packet that is all blanks, OL and a negative reading
// neither break the page nor show NaN; quick Conectar / Desconectar cycles leave a single polling loop; the cable
// unplugged and plugged again reconnects; two pages showing the panel (the bench and a lesson's card) show one meter.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with a server> tests/qa131-brymen-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { construirPaquete, type Simulacion } from '../src/lib/brymen-real/protocolo.ts';

const paquete = (s: Simulacion) => Array.from(construirPaquete(s));
type Cable = { respuesta: number[] | null; fija: boolean; retrasoAbrir?: number; cola?: number[][]; desenchufado?: string; peticiones?: number };
const cable = (page: Page, f: (c: Cable) => void) => page.evaluate(`(${f.toString()})(window.__epaBrymenFalso)`);
const peticiones = (page: Page) => page.evaluate(() => (window as unknown as { __epaBrymenFalso: Cable }).__epaBrymenFalso.peticiones ?? 0);

async function banco(page: Page, ajuste: Partial<Cable> = {}) {
  await page.context().route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript((a) => {
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    (window as unknown as { __epaBrymenFalso: unknown }).__epaBrymenFalso = { respuesta: null, fija: true, ...a };
  }, ajuste);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm');
  const panel = page.locator('.elegir [data-brymen-real]');
  await expect(panel).toBeVisible({ timeout: 60_000 });
  return { panel, errores };
}

test('«Desconectar» mientras el cable se abre: se queda desconectado y no pregunta al Brymen', async ({ page }) => {
  const { panel, errores } = await banco(page, { retrasoAbrir: 900 });
  await panel.getByRole('button', { name: 'Conectar el Brymen real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-real', 'conectando');
  await panel.getByRole('button', { name: 'Desconectar' }).click();
  await expect(panel).toHaveAttribute('data-conexion-real', 'desconectado');
  // the opening finishes after the click: nothing starts
  await page.waitForTimeout(1600);
  await expect(panel).toHaveAttribute('data-conexion-real', 'desconectado');
  expect(await peticiones(page), 'peticiones al Brymen tras desconectar').toBe(0);
  await expect(panel.getByRole('button', { name: 'Conectar el Brymen real' })).toBeVisible();
  // and connecting again works
  await cable(page, (c) => {
    c.retrasoAbrir = 0;
  });
  await panel.getByRole('button', { name: 'Conectar el Brymen real' }).click();
  await cable(page, (c) => {
    c.respuesta = [0x00, 0x01, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x86, 0x86, 0x86, 0x86, 0, 0, 0, 0];
  });
  await expect(panel).toHaveAttribute('data-conexion-real', 'conectado');
  expect(errores).toEqual([]);
});

test('paquetes partidos, basura, en blanco, OL y negativos: se leen o se ignoran sin romper nada', async ({ page }) => {
  const { panel, errores } = await banco(page);
  await panel.getByRole('button', { name: 'Conectar el Brymen real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-real', 'sin-respuesta');
  // a packet split over two reads, after some garbage
  const p = paquete({ principal: '1.2345', unidad: 'V', dc: true });
  await cable(page, new Function('c', `c.fija = false; c.cola = [[0x12, 0x86, 0x86], ${JSON.stringify(p.slice(0, 13))}, ${JSON.stringify(p.slice(13))}];`) as (c: Cable) => void);
  await expect(page.locator('[data-lectura-real]')).toHaveText('1,2345 V ⎓');
  // OL
  await cable(page, new Function('c', `c.fija = true; c.respuesta = ${JSON.stringify(paquete({ principal: '0L', unidad: 'MΩ' }))};`) as (c: Cable) => void);
  await expect(page.locator('[data-lectura-real]')).toHaveText('OL');
  // negative
  await cable(page, new Function('c', `c.respuesta = ${JSON.stringify(paquete({ principal: '-4.8712', unidad: 'mV', dc: true }))};`) as (c: Cable) => void);
  await expect(page.locator('[data-lectura-real]')).toHaveText('−4,8712 mV ⎓');
  // all blanks (the meter switching function): no NaN, no «undefined»
  await cable(page, new Function('c', `c.respuesta = ${JSON.stringify(paquete({ principal: '' }))};`) as (c: Cable) => void);
  await page.waitForTimeout(800);
  await expect(panel).not.toContainText(/NaN|undefined|Infinity/);
  // random garbage for a while: the meter «does not answer», then a good packet brings it back
  await cable(page, (c) => {
    c.respuesta = Array.from({ length: 24 }, (_, k) => (k * 37 + 11) & 0xff);
  });
  await expect(panel).toHaveAttribute('data-conexion-real', 'sin-respuesta', { timeout: 6000 });
  await expect(page.locator('[data-lectura-real]')).toHaveCount(0);
  await cable(page, new Function('c', `c.respuesta = ${JSON.stringify(paquete({ principal: '2.0000', unidad: 'V', dc: true }))};`) as (c: Cable) => void);
  await expect(page.locator('[data-lectura-real]')).toHaveText('2,0000 V ⎓');
  await expect(panel).not.toContainText(/NaN|undefined|Infinity/);
  expect(errores).toEqual([]);
});

test('conectar y desconectar muchas veces seguidas deja un solo bucle de lectura; desenchufar y volver a enchufar', async ({ page }) => {
  const { panel, errores } = await banco(page);
  await cable(page, new Function('c', `c.respuesta = ${JSON.stringify(paquete({ principal: '3.3000', unidad: 'V', dc: true }))};`) as (c: Cable) => void);
  for (let k = 0; k < 8; k++) {
    await panel.locator('[data-conectar-real], [data-desconectar-real]').first().click();
    await page.waitForTimeout(k % 3 === 0 ? 0 : 40);
  }
  // an even number of clicks: disconnected; connect once more
  await expect(panel).toHaveAttribute('data-conexion-real', 'desconectado');
  await panel.getByRole('button', { name: 'Conectar el Brymen real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-real', 'conectado');
  // one loop asks about every 280 ms (30 ms read + 250 ms pause): about 7 in two seconds, never twice that
  const n0 = await peticiones(page);
  await page.waitForTimeout(2000);
  const n = (await peticiones(page)) - n0;
  expect(n, 'peticiones en 2 s').toBeGreaterThanOrEqual(4);
  expect(n, 'peticiones en 2 s (más de un bucle a la vez)').toBeLessThanOrEqual(9);
  // unplugged, then plugged in and connected again
  await cable(page, (c) => {
    c.desenchufado = 'Se ha perdido la conexión con el cable del Brymen: ¿se ha desenchufado?';
  });
  await expect(panel).toHaveAttribute('data-conexion-real', 'error');
  const n1 = await peticiones(page);
  await page.waitForTimeout(800);
  expect(await peticiones(page), 'tras desenchufar no sigue preguntando').toBe(n1);
  await cable(page, (c) => {
    delete c.desenchufado;
  });
  await panel.getByRole('button', { name: 'Conectar el Brymen real' }).click();
  await expect(page.locator('[data-lectura-real]')).toHaveText('3,3000 V ⎓');
  await panel.getByRole('button', { name: 'Desconectar' }).click();
  await expect(panel).toHaveAttribute('data-conexion-real', 'desconectado');
  const n2 = await peticiones(page);
  await page.waitForTimeout(800);
  expect(await peticiones(page), 'tras desconectar no sigue preguntando').toBeLessThanOrEqual(n2 + 1);
  expect(errores).toEqual([]);
});

// (WebHID, desktop Chrome/Edge: a stand-in navigator.hid whose device fails as Chrome's does, with English DOMExceptions)
test('WebHID: si el cable no se abre o no acepta la petición, el mensaje está en español', async ({ page }) => {
  await page.context().route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    const w = window as unknown as { __hidFallo: string };
    w.__hidFallo = 'abrir';
    const dispositivo = {
      opened: false,
      productName: 'BU-86X',
      async open() {
        if (w.__hidFallo === 'abrir') throw new DOMException('Failed to open the device.', 'NotAllowedError');
        this.opened = true;
      },
      async close() {},
      async sendReport() {
        throw new DOMException('Failed to write the report.', 'NotAllowedError');
      },
      async sendFeatureReport() {
        throw new DOMException('Failed to write the feature report.', 'NotAllowedError');
      },
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(Navigator.prototype, 'hid', {
      configurable: true,
      get: () => ({ requestDevice: async () => [dispositivo], addEventListener() {}, removeEventListener() {} }),
    });
  });
  await page.goto('/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm');
  const panel = page.locator('.elegir [data-brymen-real]');
  await expect(panel).toBeVisible({ timeout: 60_000 });
  await panel.getByRole('button', { name: 'Conectar el Brymen real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-real', 'error');
  await expect(page.locator('[data-estado-real]')).toContainText('cable BU-86X');
  await expect(page.locator('[data-estado-real]')).not.toContainText(/Failed|device|report/);
  // opened, but neither report is accepted
  await page.evaluate(() => ((window as unknown as { __hidFallo: string }).__hidFallo = ''));
  await panel.getByRole('button', { name: 'Conectar el Brymen real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-real', 'error');
  await expect(page.locator('[data-estado-real]')).toContainText('no acepta la petición de lectura');
  await expect(page.locator('[data-estado-real]')).not.toContainText(/Failed|device|report/);
});
