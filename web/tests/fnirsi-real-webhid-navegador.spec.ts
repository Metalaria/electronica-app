// 2.2 (owner, 26-11): through the browser's own WebHID transport (not the tests' fake link), a link without the status
// stream (patch 2) in the oscilloscope and in the generator gets only the identification and the subscription: no
// memory read (order 0x02) at all, where 2.1 read 0x20000F50, 0x200000F8 and 0x20000208 a couple of times a second.
// The page's navigator.hid is replaced by a device that answers those two requests as the link does and records
// every report sent to it.
//   npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-webhid-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { limpio } from './accesibilidad10-comun';

const BANCO = '/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'escritorio'));

async function hidFalso(page: Page, modo: number) {
  await page.addInitScript((m) => {
    const enviados: number[][] = [];
    const oyentes = new Set<(e: { data: DataView }) => void>();
    const d = {
      opened: false,
      productName: '2C53T stock-link',
      vendorId: 0x1209,
      productId: 0x0001,
      async open() {
        d.opened = true;
      },
      async close() {
        d.opened = false;
      },
      async sendReport(_id: number, datos: Uint8Array) {
        const b = Array.from(datos);
        enviados.push(b);
        const r = new Uint8Array(64);
        r[0] = (b[0] ?? 0) | 0x80;
        r[1] = b[1] ?? 0;
        if (b[0] === 0x01) {
          // identification: protocol 1, patch 2 (no status stream), the instrument's mode
          r[3] = 36;
          r.set(Array.from('2C53LINK', (c) => c.charCodeAt(0)), 8);
          r[16] = 1;
          r[17] = 2;
          r[18] = m;
        } else if (b[0] !== 0x03) r[2] = 1;
        setTimeout(() => {
          for (const f of oyentes) f({ data: new DataView(r.buffer) });
        }, 5);
      },
      addEventListener(_t: string, f: (e: { data: DataView }) => void) {
        oyentes.add(f);
      },
      removeEventListener(_t: string, f: (e: { data: DataView }) => void) {
        oyentes.delete(f);
      },
    };
    const hid = { getDevices: async () => [d], requestDevice: async () => [d], addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(navigator, 'hid', { value: hid, configurable: true });
    (window as unknown as { __hidEnviados: number[][] }).__hidEnviados = enviados;
  }, modo);
}

for (const [modo, nombre] of [[2, 'osciloscopio'], [3, 'generador']] as const) {
  test(`WebHID, parche 2, ${nombre}: solo la identificación y la suscripción; ninguna lectura de la memoria`, async ({ page }) => {
    await limpio(page);
    await hidFalso(page, modo);
    await page.goto(BANCO);
    await expect(page.locator('.banco h1')).toBeVisible({ timeout: 60_000 });
    if (await page.locator('[data-usar-aparato-real]').count()) {
      await page.locator('[data-usar-aparato-real]').click();
      await expect(page.locator('.elegir h2')).toBeVisible({ timeout: 60_000 });
    }
    const panel = page.locator('.elegir [data-fnirsi-real]');
    await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado', { timeout: 15_000 });
    await expect(page.locator('[data-falta-parche-fnirsi]')).toContainText('solo llegan con el flujo de estado del enlace (parche 3)');
    // (2.1 asked every 0.4 s: four seconds is ten rounds)
    await page.waitForTimeout(4000);
    await panel.locator('details.fr-diag > summary').click();
    await expect(page.locator('[data-enlace-fnirsi]')).toContainText('hace falta el parche 3 del enlace');
    await expect(panel).toContainText('WebHID del navegador');
    const enviados = await page.evaluate(() => (window as unknown as { __hidEnviados: number[][] }).__hidEnviados);
    expect(enviados.map((r) => r[0])).toEqual([0x01, 0x03]);
    expect(enviados.filter((r) => r[0] === 0x02)).toEqual([]);
  });
}
