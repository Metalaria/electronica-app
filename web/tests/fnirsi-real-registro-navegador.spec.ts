// The recorder of the real instruments and the FNIRSI–Brymen comparison on the free bench, in the browser, with the
// two fake transports (window.__epaFnirsiFalso with real captured reports, window.__epaBrymenFalso with packets built
// from the documented layout): nothing is shown where neither instrument can be read; a record of the FNIRSI with its
// trend, its figures and the CSV file it saves; the comparison with both on volts (inside and outside the makers'
// accuracy), written down in the table and saved; resistance, where the two must not measure at once, with a held
// reading; and the panel on a phone. Axe on the panel in the three themes.
//   npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-registro-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { construirPaquete, type Simulacion } from '../src/lib/brymen-real/protocolo.ts';
import { TEMAS, axe, limpio, sinHallazgos, type Tema } from './accesibilidad10-comun';
import { MULTIMETRO } from './fnirsi-real-datos.ts';

const BANCO = '/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm';
const deHex = (h: string) => h.match(/../g)!.map((x) => parseInt(x, 16));
const paquete = (s: Simulacion) => Array.from(construirPaquete(s));

/** The two fake transports, installed before the page loads (each is chosen once, at start). */
async function conInstrumentos(page: Page, casoFnirsi: string | null, brymen: Simulacion | null) {
  await page.addInitScript(
    ([eventos, respuesta]) => {
      const w = window as unknown as { __epaFnirsiFalso?: unknown; __epaBrymenFalso?: unknown };
      if (eventos) w.__epaFnirsiFalso = { modo: 1, eventos: [eventos], repetir: true };
      if (respuesta) w.__epaBrymenFalso = { respuesta, fija: true };
    },
    [casoFnirsi ? deHex(MULTIMETRO[casoFnirsi]!) : null, brymen ? paquete(brymen) : null] as const,
  );
}
async function fnirsiMarca(page: Page, caso: string) {
  await page.evaluate((e) => {
    (window as unknown as { __epaFnirsiFalso: { eventos: number[][] } }).__epaFnirsiFalso.eventos = [e];
  }, deHex(MULTIMETRO[caso]!));
}
async function brymenMarca(page: Page, s: Simulacion) {
  await page.evaluate((p) => {
    (window as unknown as { __epaBrymenFalso: { respuesta: number[] } }).__epaBrymenFalso.respuesta = p;
  }, paquete(s));
}

async function banco(page: Page) {
  await page.goto(BANCO);
  // (2.1: the real instruments' panel opens from «Usar un aparato real», shown only where a transport exists)
  await expect(page.locator('.banco h1')).toBeVisible({ timeout: 60_000 });
  if (await page.locator('[data-usar-aparato-real]').count()) {
    await page.locator('[data-usar-aparato-real]').click();
    await expect(page.locator('.elegir h2')).toBeVisible({ timeout: 60_000 });
  }
}
async function conectarFnirsi(page: Page) {
  await page.locator('.elegir [data-fnirsi-real]').getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await expect(page.locator('.elegir [data-fnirsi-real]')).toHaveAttribute('data-conexion-fnirsi', 'conectado');
}
async function conectarBrymen(page: Page) {
  await page.locator('.elegir [data-brymen-real]').getByRole('button', { name: 'Conectar el Brymen real' }).click();
  await expect(page.locator('.elegir [data-brymen-real]')).toHaveAttribute('data-conexion-real', 'conectado');
}
async function abrir(page: Page) {
  const panel = page.locator('[data-registro-real]');
  await panel.locator('summary').click();
  await expect(panel).toHaveAttribute('open', '');
  return panel;
}
async function descarga(page: Page, pulsar: () => Promise<void>): Promise<{ nombre: string; lineas: string[]; marca: boolean }> {
  const [d] = await Promise.all([page.waitForEvent('download'), pulsar()]);
  const texto = fs.readFileSync((await d.path())!, 'utf8');
  return { nombre: d.suggestedFilename(), lineas: texto.replace(/^﻿/, '').trimEnd().split('\r\n'), marca: texto.startsWith('﻿') };
}

test.describe('escritorio', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'escritorio'));

  test('sin ningún instrumento real legible no aparece el registrador', async ({ page }) => {
    await limpio(page);
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'hid', { get: () => undefined, configurable: true }));
    await banco(page);
    await expect(page.locator('[data-registro-real]')).toHaveCount(0);
  });

  test('registro del FNIRSI: tendencia, cifras, pausa, fichero CSV y borrado con confirmación', async ({ page }) => {
    await limpio(page);
    await conInstrumentos(page, 'pila9V', null);
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'hid', { get: () => undefined, configurable: true }));
    await banco(page);
    // only the FNIRSI can be read here: the recorder is offered, the comparison is not
    const cerrado = page.locator('[data-registro-real]');
    await expect(cerrado.locator('summary')).toHaveText('Registrador');
    const panel = await abrir(page);
    await expect(panel.locator('[data-comparacion-real]')).toHaveCount(0);
    const iniciar = panel.locator('[data-iniciar-registro]');
    await expect(iniciar).toBeDisabled();
    await expect(panel.locator('[data-estado-registro]')).toContainText('Conecte el Brymen real o el FNIRSI real');

    await conectarFnirsi(page);
    await expect(panel.locator('[data-estado-registro]')).toHaveText('Listo para registrar.');
    await expect(iniciar).toBeEnabled();
    await iniciar.click();
    await expect(panel).toHaveAttribute('data-registrando', 'si');
    await expect(panel.locator('summary')).toHaveText('Registrador · registrando');
    await expect(panel.locator('[data-estado-registro]')).toHaveText('Registrando lo que marcan los instrumentos conectados.');
    const serie = panel.locator('[data-serie-registro="fnirsi"]');
    await expect(serie).toContainText('FNIRSI 2C53T · V ⎓');
    await expect(serie.locator('[data-minimo]')).toHaveText('9,201 V');
    await expect(serie.locator('[data-maximo]')).toHaveText('9,201 V');
    await expect(serie.locator('[data-media]')).toHaveText('9,2010 V');
    await expect(serie.locator('polyline')).toHaveCount(1, { timeout: 10_000 });
    await expect(panel.locator('[data-serie-registro="brymen"]')).toHaveCount(0);

    // the reading moves: the figures follow; «Reiniciar cifras» makes them count from now on, and says so
    await fnirsiMarca(page, 'autoPila');
    await expect(serie.locator('[data-minimo]')).toHaveText('9,175 V');
    await expect(serie.locator('[data-maximo]')).toHaveText('9,201 V');
    await panel.locator('[data-reiniciar-cifras]').click();
    await expect(panel.locator('[data-aviso-registro]')).toContainText('cuentan desde ahora');
    await expect(serie.locator('[data-maximo]')).toHaveText('9,175 V');
    await expect(serie.locator('[data-minimo]')).toHaveText('9,175 V');
    await expect(panel).toHaveAttribute('data-registrando', 'si');

    // the instrument changes to ohms: a new stretch with its own figures; the volts stay in the record
    await fnirsiMarca(page, 'ohm10k');
    await expect(serie).toContainText('FNIRSI 2C53T · Ω');
    await expect(serie.locator('[data-media]')).toHaveText('9,8310 kΩ');

    // the FNIRSI leaves (a change of mode): the record goes on and says that nothing is arriving
    await page.locator('.elegir [data-fnirsi-real]').getByRole('button', { name: 'Desconectar' }).click();
    await expect(panel.locator('[data-estado-registro]')).toContainText('no llega ninguna lectura', { timeout: 10_000 });
    await conectarFnirsi(page);
    await expect(panel.locator('[data-estado-registro]')).toHaveText('Registrando lo que marcan los instrumentos conectados.');

    await panel.locator('[data-detener-registro]').click();
    await expect(panel).toHaveAttribute('data-registrando', 'no');
    await expect(panel.locator('[data-estado-registro]')).toHaveText('Registro detenido.');
    const cuenta = await panel.locator('[data-cuenta-registro]').innerText();
    await page.waitForTimeout(600);
    // stopped: nothing more is taken
    expect(await panel.locator('[data-cuenta-registro]').innerText()).toBe(cuenta);
    await expect(panel.locator('[data-iniciar-registro]')).toHaveText('Seguir registrando');
    sinHallazgos(await axe(page, '[data-registro-real]'), 'registrador (con un registro)');

    const f = await descarga(page, () => panel.locator('[data-guardar-registro]').click());
    expect(f.nombre).toMatch(/^registro-instrumentos-\d{4}-\d{2}-\d{2}-\d{6}\.csv$/);
    expect(f.marca).toBe(true);
    expect(f.lineas[0]).toBe('instrumento;hora;segundos;valor;unidad;tipo;lectura;usable');
    expect(f.lineas.length - 1).toBe(Number(cuenta.split(' ')[0]!.replace(/\./g, '')));
    expect(f.lineas[1]).toMatch(/^FNIRSI 2C53T;\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2};\d+(,\d+)?;9,201;V;CC;9,201 V ⎓;sí$/);
    expect(f.lineas.at(-1)).toMatch(/^FNIRSI 2C53T;[^;]+;\d+(,\d+)?;9831;Ω;;9,831 kΩ;sí$/);
    // (the volts taken before the change of function are still in the file)
    expect(f.lineas.filter((l) => l.includes(';V;CC;')).length).toBeGreaterThanOrEqual(2);
    await expect(panel.locator('[data-aviso-registro]')).toContainText('Fichero descargado');

    // erasing asks first
    await panel.locator('[data-borrar-registro]').click();
    await expect(panel).toContainText(/¿Borrar el registro \(\d+ lecturas\)\?/);
    await panel.getByRole('button', { name: 'No', exact: true }).click();
    await expect(serie).toBeVisible();
    await panel.locator('[data-borrar-registro]').click();
    await panel.locator('[data-confirmar-borrar]').click();
    await expect(panel.locator('[data-serie-registro]')).toHaveCount(0);
    await expect(panel.locator('[data-estado-registro]')).toHaveText('Listo para registrar.');
    await expect(panel.locator('[data-iniciar-registro]')).toHaveText('Iniciar registro');
  });

  test('comparación en tensión: dentro y fuera de la exactitud, anotada en la tabla y guardada', async ({ page }) => {
    await limpio(page);
    await conInstrumentos(page, 'pila9V', { principal: '9.213', unidad: 'V', dc: true });
    await banco(page);
    const panel = await abrir(page);
    await expect(panel.locator('summary')).toContainText('Registrador y comparación');
    const comp = panel.locator('[data-comparacion-real]');
    const brymen = comp.locator('[data-lado-comparacion="brymen"]');
    const fnirsi = comp.locator('[data-lado-comparacion="fnirsi"]');
    await expect(brymen.locator('[data-motivo-comparacion]')).toContainText('Sin lectura');
    await expect(comp.locator('[data-anotar-comparacion]')).toBeDisabled();
    await expect(comp.locator('[data-retener="brymen"]')).toBeDisabled();

    await conectarFnirsi(page);
    await conectarBrymen(page);
    await expect(fnirsi.locator('[data-valor-comparacion]')).toHaveText('9,201 V ⎓');
    await expect(brymen.locator('[data-valor-comparacion]')).toHaveText('9,213 V ⎓');
    const resultado = comp.locator('[data-resultado-comparacion]');
    await expect(resultado).toHaveAttribute('data-resultado-comparacion', 'dentro', { timeout: 10_000 });
    await expect(resultado).toContainText('El FNIRSI marca 9,201 V ⎓ y el Brymen, 9,213 V ⎓: 12,00 mV menos (−0,13 %).');
    await expect(resultado).toContainText('Cabe en lo que los dos pueden equivocarse en estas escalas según sus fabricantes (FNIRSI ± 49 mV; Brymen ± 4,8 mV).');
    await expect(comp.locator('[data-aviso-juntos]')).toHaveCount(0);
    sinHallazgos(await axe(page, '[data-registro-real]'), 'registrador (comparación)');
    await comp.locator('[data-anotar-comparacion]').click();
    const filas = comp.locator('[data-filas-comparacion]');
    await expect(filas).toHaveAttribute('data-filas-comparacion', '1');
    await expect(filas.locator('li').first()).toContainText('V ⎓ · escala de 20 V');
    await expect(filas.locator('li').first()).toContainText(/−12,00 mV \(−0,13 %\) · margen ± 54 mV · Dentro del margen/);
    await expect(filas.locator('li').first()).toContainText('FNIRSI 9,201 V ⎓ · Brymen 9,213 V ⎓');

    // the Brymen now reads 9,500 V: outside what the two may be off
    await brymenMarca(page, { principal: '9.500', unidad: 'V', dc: true });
    await expect(resultado).toHaveAttribute('data-resultado-comparacion', 'fuera', { timeout: 10_000 });
    await expect(resultado).toContainText('299,0 mV menos');
    await expect(resultado).toContainText('el FNIRSI se desvía en esta escala');
    await comp.locator('[data-anotar-comparacion]').click();
    await expect(filas).toHaveAttribute('data-filas-comparacion', '2');
    await expect(filas.locator('li').nth(1)).toContainText('Fuera del margen');

    // different functions: said, and nothing to write down
    await fnirsiMarca(page, 'ohm10k');
    await expect(resultado).toHaveAttribute('data-resultado-comparacion', 'no-comparable', { timeout: 10_000 });
    await expect(resultado).toContainText('ponga los dos en la misma función');
    await expect(comp.locator('[data-anotar-comparacion]')).toBeDisabled();

    const f = await descarga(page, () => comp.locator('[data-guardar-tabla]').click());
    expect(f.nombre).toMatch(/^comparacion-fnirsi-brymen-\d{4}-\d{2}-\d{2}-\d{6}\.csv$/);
    expect(f.lineas[0]).toBe('hora;magnitud;escala del FNIRSI;FNIRSI;Brymen;unidad;diferencia;diferencia %;margen ±;resultado');
    expect(f.lineas.length).toBe(3);
    expect(f.lineas[1]).toMatch(/;V ⎓;20 V;9,201;9,213;V;-0,012;-0,130250733;0,0\d+;Dentro$/);
    expect(f.lineas[2]).toMatch(/;V ⎓;20 V;9,201;9,5;V;-0,299;-3,14736842;0,0\d+;Fuera$/);
    await comp.locator('[data-vaciar-tabla]').click();
    await expect(comp.locator('[data-filas-comparacion]')).toHaveCount(0);
  });

  test('resistencia: no a la vez; se retiene la lectura de uno y se mide con el otro', async ({ page }) => {
    await limpio(page);
    await conInstrumentos(page, 'ohm10k', { principal: '9.8312', unidad: 'kΩ' });
    await banco(page);
    const panel = await abrir(page);
    const comp = panel.locator('[data-comparacion-real]');
    await conectarFnirsi(page);
    await conectarBrymen(page);
    // both on ohms and live: the warning
    await expect(comp.locator('[data-aviso-juntos]')).toContainText('no pueden medir resistencia o capacidad a la vez');
    // the Brymen's reading is held; its probes come off (its display goes to OL)
    await expect(comp.locator('[data-retener="brymen"]')).toBeEnabled({ timeout: 10_000 });
    await comp.locator('[data-retener="brymen"]').click();
    await expect(comp.locator('[data-lado-comparacion="brymen"]')).toContainText('Brymen (referencia) · retenida');
    await expect(comp.locator('[data-aviso-juntos]')).toHaveCount(0);
    await brymenMarca(page, { principal: '0L', unidad: 'MΩ' });
    await expect(page.locator('.elegir [data-lectura-real]')).toHaveText('OL');
    // the comparison still uses the held reading
    await expect(comp.locator('[data-lado-comparacion="brymen"] [data-valor-comparacion]')).toHaveText('9,8312 kΩ');
    const resultado = comp.locator('[data-resultado-comparacion]');
    await expect(resultado).toHaveAttribute('data-resultado-comparacion', 'dentro');
    await expect(resultado).toContainText('200,0 mΩ menos');
    await comp.locator('[data-anotar-comparacion]').click();
    await expect(comp.locator('[data-filas-comparacion] li')).toContainText('Ω · escala de 20 kΩ');
    // written down: the held reading is let go, and the Brymen has no number now
    await expect(comp.locator('[data-lado-comparacion="brymen"]')).not.toContainText('retenida');
    await expect(comp.locator('[data-lado-comparacion="brymen"] [data-motivo-comparacion]')).toContainText('no muestra un número');
    await expect(comp.locator('[data-anotar-comparacion]')).toBeDisabled();
    // the FNIRSI loses its link: its side says so
    await page.locator('.elegir [data-fnirsi-real]').getByRole('button', { name: 'Desconectar' }).click();
    await expect(comp.locator('[data-lado-comparacion="fnirsi"] [data-motivo-comparacion]')).toContainText('Sin lectura', { timeout: 10_000 });
  });

  for (const tema of TEMAS.filter((t) => t !== 'claro') as Tema[])
    test(`accesibilidad del registrador en el tema ${tema}`, async ({ page }) => {
      await limpio(page, tema);
      await conInstrumentos(page, 'pila9V', { principal: '9.500', unidad: 'V', dc: true });
      await banco(page);
      const panel = await abrir(page);
      await conectarFnirsi(page);
      await conectarBrymen(page);
      await panel.locator('[data-iniciar-registro]').click();
      const comp = panel.locator('[data-comparacion-real]');
      await expect(comp.locator('[data-resultado-comparacion]')).toHaveAttribute('data-resultado-comparacion', 'fuera', { timeout: 10_000 });
      await comp.locator('[data-anotar-comparacion]').click();
      await expect(panel.locator('[data-serie-registro]')).toHaveCount(2);
      await panel.locator('[data-detener-registro]').click();
      sinHallazgos(await axe(page, '[data-registro-real]'), `registrador (${tema})`);
    });
});

test('en el teléfono el registrador cabe sin desplazamiento horizontal', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil', 'móvil');
  await limpio(page);
  await conInstrumentos(page, 'pila9V', { principal: '9.213', unidad: 'V', dc: true });
  await banco(page);
  // (2.1: on the phone the folded rows are under the bench's «Circuito» segment)
  await page.getByRole('tab', { name: 'Circuito', exact: true }).click();
  const panel = page.locator('[data-registro-real]').first();
  await panel.scrollIntoViewIfNeeded();
  await panel.locator('summary').click();
  await page.locator('[data-fnirsi-real]').first().getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
  await page.locator('[data-brymen-real]').first().getByRole('button', { name: 'Conectar el Brymen real' }).click();
  await panel.locator('[data-iniciar-registro]').click();
  await expect(panel.locator('[data-resultado-comparacion]')).toHaveAttribute('data-resultado-comparacion', 'dentro', { timeout: 15_000 });
  await panel.locator('[data-anotar-comparacion]').click();
  await expect(panel.locator('[data-serie-registro]')).toHaveCount(2);
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }));
  expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana);
  // nothing of the panel sticks out of it
  const fuera = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [...el.querySelectorAll('*')].filter((x) => x.getBoundingClientRect().right > r.right + 1).length;
  });
  expect(fuera).toBe(0);
  // the buttons are a finger's size
  const bajos = await panel.evaluate((el) => [...el.querySelectorAll('button, summary')].filter((b) => (b as HTMLElement).offsetParent && b.getBoundingClientRect().height < 47.5).length);
  expect(bajos).toBe(0);
  sinHallazgos(await axe(page, '[data-registro-real]'), 'registrador (teléfono)');
});
