// 2.1 «lavado de cara», Taller and Proyectos, in the browser:
//   - the bench as the approved mock-ups (Banco.png, BancoMovil.png): the title block, «Puntas puestas» with only the
//     leads placed (the twelve node buttons gone: nodes from the schematic, or from the list in a lead's editor, with
//     the keyboard), «Poner otra punta», folded rows closed by default; the phone's Circuito / Brymen / FNIRSI segments
//     with the one-line summary of the leads that opens their editor; no sideways scroll at 360 px; axe;
//   - the owner's request of 25-11: with the real Brymen connected (fake cable, lib/brymen-real/transporte.ts) the
//     drawn Brymen's selector follows the real one's function, says when the frame cannot tell VFD V∿ from V∿, and
//     stays where it is with no reading; with the real FNIRSI's status stream (fake link, patch 3) the drawn 2C53T
//     follows its mode, and without the stream (patch 2) says why in one line;
//   - Consolas (Consola.png): the machine menu in the title, no paragraph under it, «otra placa» said once.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.taller21.config.ts tests/taller21-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { construirPaquete, type Simulacion } from '../src/lib/brymen-real/protocolo.ts';
import { axe, limpio, sinHallazgos } from './accesibilidad10-comun';
import { MEMORIA, MULTIMETRO, REGISTRO_CH1, REGISTRO_PAR_CH1, REGISTRO_PAR_CH2 } from './fnirsi-real-datos.ts';

const BANCO = '/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm';
const paquete = (s: Simulacion, extra: Record<number, number> = {}) => {
  const p = construirPaquete(s);
  for (const [k, v] of Object.entries(extra)) p[Number(k)]! |= v;
  return Array.from(p);
};
const deHex = (h: string) => h.match(/../g)!.map((x) => parseInt(x, 16));

/** A captured oscilloscope record as the link sends it: a header event and its data events (as fnirsi-real-navegador). */
function informesDe(registro: string, canal: number, secuencia: number): number[][] {
  const b = Array.from(Buffer.from(registro, 'base64'));
  const informe = (cab: number[], datos: number[]) => {
    const r = new Array<number>(64).fill(0);
    cab.forEach((x, k) => (r[k] = x));
    datos.forEach((x, k) => (r[8 + k] = x));
    return r;
  };
  const v = [informe([0xa0, secuencia, canal, 56, 0, 0, 0, 0], b.slice(0, 56))];
  for (let d = 0; d < 1024; d += 56) {
    const n = Math.min(56, 1024 - d);
    v.push(informe([0xa1, secuencia, canal, n, d & 0xff, d >> 8, 0, 0], b.slice(56 + d, 56 + d + n)));
  }
  return v;
}

async function banco(page: Page) {
  await page.goto(BANCO);
  await expect(page.locator('.banco .estado')).toContainText('simulado en', { timeout: 90_000 });
}
const soloEn = (nombre: string) => ({}, info: { project: { name: string } }) => test.skip(info.project.name !== nombre, nombre);

test.describe('escritorio', () => {
  test.beforeEach(soloEn('escritorio'));

  test('banco: título, «Puntas puestas» solo con las puestas, nodos desde el esquema o desde la lista, filas plegadas', async ({ page }) => {
    await limpio(page, 'oscuro');
    await banco(page);
    // the title block: «Banco · simulado en N ms» over the circuit's name
    await expect(page.locator('.banco .antetitulo21')).toHaveText(/^Banco · simulado en \d+ ms$/);
    await expect(page.locator('.banco h1')).toHaveText('LED 150 Ω');
    await expect(page.getByRole('button', { name: 'Cambiar de circuito' })).toBeVisible();
    await expect(page.locator('.banco .etiqueta21', { hasText: 'Circuito' })).toBeVisible();
    // 2.0's eight chips and twelve node buttons are gone; the rows are only the leads placed
    await expect(page.locator('.nodo-chip')).toHaveCount(0);
    const zona = page.locator('[data-puntas-puestas]');
    await expect(zona.getByRole('radio')).toHaveCount(4);
    await expect(zona.getByRole('radio', { name: /^Brymen, punta roja a\d/ })).toHaveAttribute('aria-checked', 'true');
    await expect(zona.getByRole('radio', { name: /^Brymen, COM 0/ })).toBeVisible();
    await expect(zona.getByRole('button', { name: 'Poner otra punta (4 libres)' })).toBeVisible();
    await expect(zona.locator('.pista')).toHaveText('Toque un nodo para mover');
    // a tap on a node of the schematic moves the lead picked (the red one)
    await page.locator('[data-nodo-plano="a3"]').click();
    await expect(zona.locator('button[data-punta="bmRojo"] .nodo')).toHaveText('a3');
    await expect(page.locator('[data-nodo-plano="a3"] [data-punta-plano="bmRojo"]')).toHaveCount(1);
    // the keyboard way: the row opens its editor, the list of nodes places the lead, «Quitar» takes it off
    await zona.locator('button[data-punta="bmNegro"]').focus();
    await page.keyboard.press('Enter');
    const lista = zona.locator('[data-editor-punta="bmNegro"] select');
    await expect(lista).toBeVisible();
    await lista.focus();
    await lista.selectOption('a5');
    await expect(zona.locator('button[data-punta="bmNegro"] .nodo')).toHaveText('a5');
    await zona.locator('[data-editor-punta="bmNegro"]').getByRole('button', { name: /^Quitar/ }).click();
    await expect(zona.locator('button[data-punta="bmNegro"]')).toHaveCount(0);
    await expect(zona.getByRole('button', { name: 'Poner otra punta (5 libres)' })).toBeVisible();
    // «Poner otra punta»: CH2 waits in the list for a node
    await zona.getByRole('button', { name: /Poner otra punta/ }).click();
    await zona.locator('[data-poner-punta="ch2"]').click();
    await expect(zona.locator('button[data-punta="ch2"] .nodo')).toHaveText('sin poner');
    await expect(zona.locator('.pista')).toHaveText('Toque un nodo para ponerla');
    await expect(zona.locator('[data-editor-punta="ch2"] select')).toBeFocused();
    await page.locator('[data-nodo-plano="v12"]').click();
    await expect(zona.locator('button[data-punta="ch2"] .nodo')).toHaveText('v12');
    // the folded rows, all closed
    for (const id of ['serie', 'valores', 'escuchar', 'diagnostico']) {
      const d = page.locator(`details[data-plegable="${id}"]`);
      if (await d.count()) await expect(d).not.toHaveAttribute('open', '');
    }
    await expect(page.locator('details[data-plegable="diagnostico"] summary')).toHaveText('Diagnóstico');
    // «Cambiar de circuito» opens the chooser under the title
    await page.getByRole('button', { name: 'Cambiar de circuito' }).click();
    await expect(page.locator('#banco-elegir')).toContainText('Capítulo');
    sinHallazgos(await axe(page, '.banco'), 'banco 2.1, escritorio, oscuro');
  });

  test('el Brymen dibujado gira su selector a la función del Brymen real (solo lectura)', async ({ page }) => {
    await limpio(page, 'sepia');
    await page.addInitScript(() => {
      (window as unknown as { __epaBrymenFalso: unknown }).__epaBrymenFalso = { respuesta: null, fija: true };
    });
    await banco(page);
    const dial = page.getByRole('slider', { name: 'Selector giratorio' }).first();
    const figura = page.locator('figure[data-posicion-brymen]');
    await expect(dial).toHaveAttribute('aria-valuetext', 'V⎓');
    const responder = (p: number[] | null) =>
      page.evaluate((x) => {
        (window as unknown as { __epaBrymenFalso: { respuesta: number[] | null } }).__epaBrymenFalso.respuesta = x;
      }, p);
    await page.getByRole('button', { name: 'Usar un aparato real' }).click();
    await page.locator('[data-brymen-real]').getByRole('button', { name: 'Conectar el Brymen real' }).click();
    // resistance
    await responder(paquete({ principal: '150.02', unidad: 'Ω', auto: true }));
    await expect(dial).toHaveAttribute('aria-valuetext', 'Ω ·)))', { timeout: 10_000 });
    await expect(figura).toHaveAttribute('data-sub-brymen', '0');
    await expect(page.locator('[data-sigue-real]')).toHaveText('Selector como el de su Brymen.');
    // continuity: the same position, SELECT's second function
    await responder(paquete({ principal: '12.30', unidad: 'Ω' }, { 10: 0x01 }));
    await expect(figura).toHaveAttribute('data-sub-brymen', '1');
    await expect(dial).toHaveAttribute('aria-valuetext', 'Ω ·)))');
    // alternating volts with Hz: V∿, and the line says the frame cannot tell it from VFD V∿
    await responder(paquete({ principal: '230.00', unidad: 'V', ac: true, secundaria: '50.0', unidadSecundaria: 'Hz' }));
    await expect(dial).toHaveAttribute('aria-valuetext', 'V∿');
    await expect(page.locator('[data-sigue-real]')).toContainText('VFD V∿ y V∿ envían lo mismo');
    // microamps, DC with AC under it
    await responder(paquete({ principal: '123.45', unidad: 'µA', dc: true, secundaria: '1.2', unidadSecundaria: 'µA', acSecundaria: true }));
    await expect(dial).toHaveAttribute('aria-valuetext', 'µA');
    await expect(figura).toHaveAttribute('data-sub-brymen', '1');
    // a hand on the drawn dial is not fought while the real function stays the same
    await dial.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(dial).toHaveAttribute('aria-valuetext', 'A mA');
    await page.waitForTimeout(1500);
    await expect(dial).toHaveAttribute('aria-valuetext', 'A mA');
    // the meter stops answering (OFF, or no reading): the drawn selector stays where it was
    await responder(null);
    await expect(page.locator('[data-brymen-real]')).toHaveAttribute('data-conexion-real', 'sin-respuesta', { timeout: 10_000 });
    await expect(dial).toHaveAttribute('aria-valuetext', 'A mA');
    await expect(page.locator('[data-sigue-real]')).toHaveCount(0);
    // back with DC volts: it follows again
    await responder(paquete({ principal: '4.8712', unidad: 'V', dc: true }));
    await expect(dial).toHaveAttribute('aria-valuetext', 'V⎓', { timeout: 10_000 });
    // read-only: the cable got only the poll requests the decoder needs (transporte.ts sends PETICION and nothing else)
    expect(await page.evaluate(() => (window as unknown as { __epaBrymenFalso: { peticiones?: number } }).__epaBrymenFalso.peticiones ?? 0)).toBeGreaterThan(0);
  });

  test('el FNIRSI dibujado toma el modo del FNIRSI real con el flujo de estado, y sin él dice por qué', async ({ page }) => {
    await limpio(page, 'oscuro');
    await page.addInitScript((m) => {
      (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = { modo: 1, parche: 3, eventos: [m], repetir: true };
    }, deHex(MULTIMETRO.pila9V!));
    await banco(page);
    const figura = page.locator('figure[data-modo-fnirsi]');
    await expect(figura).toHaveAttribute('data-modo-fnirsi', 'osc');
    await page.getByRole('button', { name: 'Usar un aparato real' }).click();
    await page.locator('[data-fnirsi-real]').getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    await expect(figura).toHaveAttribute('data-modo-fnirsi', 'dmm', { timeout: 15_000 });
    await expect(page.locator('[data-sigue-real-fnirsi]')).toHaveText('Modo como el de su FNIRSI.');
    // the instrument goes to the generator: the link leaves the bus and comes back in the new mode
    await page.evaluate(() => {
      const c = (window as unknown as { __epaFnirsiFalso: Record<string, unknown> }).__epaFnirsiFalso;
      c.desenchufado = 'Se ha perdido la conexión con el FNIRSI.';
      c.errorAbrir = 'No se encuentra el FNIRSI 2C53T.';
    });
    await expect(page.locator('[data-fnirsi-real]')).toHaveAttribute('data-conexion-fnirsi', 'reconectando');
    await page.evaluate(() => {
      const c = (window as unknown as { __epaFnirsiFalso: Record<string, unknown> }).__epaFnirsiFalso;
      delete c.desenchufado;
      delete c.errorAbrir;
      c.modo = 3;
      c.eventos = [];
    });
    await expect(figura).toHaveAttribute('data-modo-fnirsi', 'gen', { timeout: 20_000 });
  });

  test('en multímetro, el FNIRSI dibujado toma también la función del real (estado del multímetro); la temperatura no la tiene y lo dice', async ({ page }) => {
    await limpio(page, 'sepia');
    await page.addInitScript((m) => {
      (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = { modo: 1, parche: 3, eventos: [m], repetir: true };
    }, deHex(MULTIMETRO.acvCero!));
    await banco(page);
    const figura = page.locator('figure[data-modo-fnirsi]');
    await expect(figura).toHaveAttribute('data-funcion-dibujada', 'auto');
    await page.getByRole('button', { name: 'Usar un aparato real' }).click();
    await page.locator('[data-fnirsi-real]').getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    // alternating volts (entry 1, function 2, variant 2)
    await expect(figura).toHaveAttribute('data-modo-fnirsi', 'dmm', { timeout: 15_000 });
    await expect(figura).toHaveAttribute('data-funcion-dibujada', 'vac');
    const poner = (h: string) =>
      page.evaluate((e) => {
        (window as unknown as { __epaFnirsiFalso: { eventos: number[][] } }).__epaFnirsiFalso.eventos = [e];
      }, deHex(h));
    // continuity, then the large current
    await poner(MULTIMETRO.continuidadOL!);
    await expect(figura).toHaveAttribute('data-funcion-dibujada', 'cont', { timeout: 10_000 });
    await poner(MULTIMETRO.aNegativo!);
    await expect(figura).toHaveAttribute('data-funcion-dibujada', 'idc', { timeout: 10_000 });
    // temperature (2.2): the drawing goes to its temperature entry, which has no probe
    await poner(MULTIMETRO.temperatura23!);
    await expect(figura).toHaveAttribute('data-funcion-dibujada', 'temp', { timeout: 10_000 });
    await expect(page.locator('[data-sigue-funcion-fnirsi]')).toHaveCount(0);
    // Auto follows Auto
    await poner(MULTIMETRO.resistenciaAuto!);
    await expect(figura).toHaveAttribute('data-funcion-dibujada', 'auto', { timeout: 10_000 });
    await expect(page.locator('[data-sigue-funcion-fnirsi]')).toHaveCount(0);
    // read-only: following the function took no read of the instrument's memory (only what the link streams)
    const lecturas = await page.evaluate(() => (window as unknown as { __epaFnirsiFalso: { lecturas?: number[] } }).__epaFnirsiFalso.lecturas ?? []);
    expect(lecturas).toEqual([]);
  });

  test('osciloscopio: «si las flechas no cambian la base de tiempos, pulse SELECT» en la ayuda del dibujado y bajo el real', async ({ page }) => {
    await limpio(page, 'oscuro');
    await page.addInitScript((e) => {
      (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = { modo: 2, parche: 3, eventos: e, repetir: true };
    }, informesDe(REGISTRO_CH1, 0, 1));
    await banco(page);
    await page.getByRole('button', { name: 'Ayuda del FNIRSI' }).click();
    await expect(page.locator('[data-ayuda-select]')).toHaveText('En su FNIRSI real: si las flechas no cambian la base de tiempos, pulse SELECT.');
    await page.getByRole('button', { name: 'Usar un aparato real' }).click();
    await page.locator('[data-fnirsi-real]').getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    await expect(page.locator('[data-ayuda-select-real]')).toHaveText('Si las flechas no cambian la base de tiempos, pulse SELECT.', { timeout: 15_000 });
  });

  test('osciloscopio real: las medidas propias son las de los canales encendidos, cada una con su canal (CH1 apagado no da ruido)', async ({ page }) => {
    // a captured record with its header's «channels on» byte ([20]: bit 0 CH1, bit 1 CH2) set as wanted (frames only)
    const conCanales = (registro: string, mascara: number) => {
      const b = Buffer.from(registro, 'base64');
      b[20] = mascara;
      return b.toString('base64');
    };
    const bytes = (h: string) => deHex(h);
    // CH1's block is the noise of a channel that is off; CH2's, a 50 kHz triangle (block 3, the same format as CH1's)
    const memoria = { '200000f8': bytes(MEMORIA.osciloscopioEnMarcha!), '20000208': bytes(MEMORIA.medidasParado!), '20000238': bytes(MEMORIA.medidasTriangulo!) };
    await limpio(page, 'oscuro');
    await page.addInitScript((f) => {
      (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = f;
    }, { modo: 2, parche: 3, eventos: informesDe(conCanales(REGISTRO_PAR_CH2, 2), 1, 1), repetir: true, memoria });
    await banco(page);
    await page.getByRole('button', { name: 'Usar un aparato real' }).click();
    await page.locator('[data-fnirsi-real]').getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    const lineas = page.locator('[data-medidas-fnirsi]');
    // CH2 alone: its measurements, labelled; nothing of CH1
    await expect(lineas).toHaveCount(1, { timeout: 15_000 });
    await expect(lineas.first()).toHaveAttribute('data-medidas-fnirsi', 'CH2');
    await expect(lineas.first()).toContainText(/Medidas del propio FNIRSI en CH2: Frec: 50,18 kHz · .*Ciclo\+: 50,50 % · .*Vp-p: 220,0 mV/);
    await expect(page.locator('[data-fnirsi-real]')).not.toContainText('en CH1:');
    const poner = (e: number[][]) =>
      page.evaluate((x) => {
        (window as unknown as { __epaFnirsiFalso: { eventos: number[][] } }).__epaFnirsiFalso.eventos = x;
      }, e);
    // both on: one line each
    await poner([...informesDe(REGISTRO_PAR_CH1, 0, 2), ...informesDe(REGISTRO_PAR_CH2, 1, 2)]);
    await expect(lineas).toHaveCount(2, { timeout: 10_000 });
    await expect(page.locator('[data-medidas-fnirsi="CH1"]')).toContainText('Medidas del propio FNIRSI en CH1: Frec: 40,23 kHz');
    await expect(page.locator('[data-medidas-fnirsi="CH2"]')).toContainText('Medidas del propio FNIRSI en CH2: Frec: 50,18 kHz');
    // neither on: said in one line
    await poner(informesDe(conCanales(REGISTRO_CH1, 0), 0, 3));
    await expect(page.locator('[data-medidas-fnirsi="ninguno"]')).toHaveText('Los dos canales del FNIRSI están apagados: no da medidas.', { timeout: 10_000 });
    await expect(lineas).toHaveCount(1);
  });

  for (const tema of ['oscuro', 'sepia', 'claro'] as const)
    test(`panel del FNIRSI real con todo abierto (promedio, cursores, más medidas; relativo y límites) en 2.1: axe sin hallazgos · ${tema}`, async ({ page }) => {
      await limpio(page, tema);
      await page.addInitScript((e) => {
        (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = { modo: 2, parche: 3, eventos: e, repetir: true };
      }, informesDe(REGISTRO_CH1, 0, 1));
      await banco(page);
      await page.getByRole('button', { name: 'Usar un aparato real' }).click();
      const panel = page.locator('[data-fnirsi-real]');
      await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
      await expect(panel.locator('[data-promedio-fnirsi]')).toBeVisible({ timeout: 15_000 });
      await panel.locator('[data-promedio-fnirsi]').selectOption({ index: 2 });
      await panel.locator('[data-cursores-fnirsi]').getByLabel('Cursores').check();
      await panel.locator('[data-analisis-fnirsi] summary').click();
      await expect(panel.locator('[data-analisis-fnirsi] [data-medidas-ampliadas]').first()).toBeVisible();
      // the system's folded row and hairline rows, no box of its own
      await expect(panel.locator('details.plegable21[data-analisis-fnirsi]')).toHaveCount(1);
      sinHallazgos(await axe(page, '[data-fnirsi-real]'), `panel del FNIRSI real, osciloscopio, ${tema}`);
      // the multimeter: «Relativo y límites», a folded row of the system
      await page.evaluate((m) => {
        const c = (window as unknown as { __epaFnirsiFalso: Record<string, unknown> }).__epaFnirsiFalso;
        c.desenchufado = 'Se ha perdido la conexión con el FNIRSI.';
        c.errorAbrir = 'No se encuentra el FNIRSI 2C53T.';
        setTimeout(() => {
          delete c.desenchufado;
          delete c.errorAbrir;
          c.modo = 1;
          c.eventos = [m];
        }, 1500);
      }, deHex(MULTIMETRO.pila9V!));
      const extras = panel.locator('details.plegable21[data-extras-multimetro]');
      await expect(extras).toHaveCount(1, { timeout: 20_000 });
      await extras.locator('summary').click();
      await extras.locator('[data-limite="minimo"]').fill('10 V');
      await extras.locator('[data-vigilar]').click();
      await expect(extras.locator('[data-alarma-fnirsi="bajo"]')).toHaveClass(/aviso21/, { timeout: 10_000 });
      sinHallazgos(await axe(page, '[data-fnirsi-real]'), `panel del FNIRSI real, multímetro, ${tema}`);
    });

  test('aplicación instalada (parche 4): la onda a medida se envía y se comprueba; el conector solo deja leer la tabla de la onda', async ({ page }) => {
    await limpio(page, 'oscuro');
    await page.addInitScript((g) => {
      (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = { modo: 3, parche: 4, comoNativo: true, memoria: { '20000f50': g } };
    }, deHex(MEMORIA.generadorCuadrada!));
    await banco(page);
    await page.getByRole('button', { name: 'Usar un aparato real' }).click();
    const panel = page.locator('[data-fnirsi-real]');
    await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado', { timeout: 15_000 });
    const onda = panel.locator('details.plegable21[data-onda-fnirsi]');
    await onda.locator('summary').click();
    // 2.0's «only from a browser» notice is gone: the installed app sends it too
    await expect(onda.locator('[data-onda-solo-navegador]')).toHaveCount(0);
    await onda.locator('[data-onda-enviar]').click();
    await expect(onda.locator('[data-onda-estado]')).toHaveAttribute('data-onda-estado', 'enviada', { timeout: 15_000 });
    await expect(onda.locator('[data-onda-estado]')).toHaveClass(/aviso21 bien/);
    const f = await page.evaluate(() => (window as unknown as { __epaFnirsiFalso: { ondas?: number[][]; lecturas?: number[] } }).__epaFnirsiFalso);
    // four requests of at most 28 samples cover the 100 positions; «enviada» means the table was read back and matched
    // (the fake records reads outside the table in `lecturas`: none reached it from the installed app)
    expect(f.ondas).toEqual([[0, 28], [28, 28], [56, 28], [84, 16]]);
    expect(f.lecturas ?? []).toEqual([]);
    sinHallazgos(await axe(page, '[data-fnirsi-real]'), 'onda a medida, aplicación instalada');
  });

  test('sin el flujo de estado (parche 2) el FNIRSI dibujado no cambia y una línea dice por qué', async ({ page }) => {
    await limpio(page, 'oscuro');
    await page.addInitScript((m) => {
      (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = { modo: 1, parche: 2, eventos: [m], repetir: true };
    }, deHex(MULTIMETRO.pila9V!));
    await banco(page);
    const figura = page.locator('figure[data-modo-fnirsi]');
    await page.getByRole('button', { name: 'Usar un aparato real' }).click();
    await page.locator('[data-fnirsi-real]').getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    await expect(page.locator('[data-fnirsi-real]')).toHaveAttribute('data-conexion-fnirsi', 'conectado', { timeout: 15_000 });
    await expect(page.locator('[data-sigue-real-fnirsi]')).toContainText('no envía el flujo de estado');
    await expect(figura).toHaveAttribute('data-modo-fnirsi', 'osc');
  });

  test('consolas: el título abre el menú de las once máquinas, sin párrafo debajo, «otra placa» una sola vez', async ({ page }) => {
    await limpio(page, 'oscuro');
    await page.goto('/#/consolas/saturn/foto');
    const boton = page.locator('[data-elegir-consola]');
    await expect(page.locator('h1')).toContainText('Sega Saturn');
    await expect(boton).toContainText('VA0.5 NTSC-J · 1994');
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('navigation', { name: 'Consola' })).toHaveCount(0);
    // the introduction is no longer under the title (it is in «Fuentes»)
    await expect(page.locator('.consolas > header p')).toHaveCount(0);
    await boton.click();
    const menu = page.getByRole('navigation', { name: 'Consola' });
    await expect(menu.getByRole('link')).toHaveCount(11);
    await expect(menu.getByRole('link', { name: /Sega Saturn/ })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(boton).toBeFocused();
    // «otra placa» once: in the caption, not on each photo's switch
    await expect(page.locator('[data-pie-foto]')).toHaveText('26 piezas · otra placa');
    await expect(page.getByRole('tablist', { name: 'Foto' }).getByRole('tab')).toHaveText(['Placa VA8, cara de componentes', 'Placa VA8, cara de soldadura']);
    // the side panel about the part: reference, name, what it does, the two ways out
    await page.locator('button[data-hotspot="scu"]').click();
    const ficha = page.locator('.foto-vista .ficha');
    await expect(ficha.getByRole('heading', { level: 2 })).toContainText('SCU');
    await expect(ficha.getByRole('button', { name: 'Ver en el esquema' })).toBeVisible();
    await expect(ficha.getByRole('button', { name: 'Ver en la arquitectura' })).toBeVisible();
    // the views as the shared underline tabs; the introduction in «Fuentes»
    await page.getByRole('navigation', { name: 'Vista' }).getByRole('link', { name: 'Fuentes' }).click();
    await expect(page.locator('.presentacion')).toContainText('Las placas base de las figuras');
    // the menu goes to another machine on the same view
    await boton.click();
    await page.getByRole('navigation', { name: 'Consola' }).getByRole('link', { name: /PlayStation/ }).click();
    await expect(page).toHaveURL(/#\/consolas\/ps1\/fuentes$/);
    await expect(boton).toContainText('PU-18 · 1997');
  });
});

test.describe('movil', () => {
  test.beforeEach(soloEn('movil'));

  test('banco en el teléfono: Circuito / Brymen / FNIRSI, el aparato grande y la fila de las puntas que abre su editor', async ({ page }) => {
    await limpio(page, 'sepia');
    await banco(page);
    const seg = page.getByRole('tablist', { name: 'Qué ver' });
    await expect(seg.getByRole('tab')).toHaveText(['Circuito', 'Brymen', 'FNIRSI']);
    await expect(seg.getByRole('tab', { name: 'Brymen' })).toHaveAttribute('aria-selected', 'true');
    // the Brymen alone, big; the schematic hidden
    await expect(page.locator('figure.brymen')).toBeVisible();
    await expect(page.locator('figure.fnirsi')).toBeHidden();
    await expect(page.locator('[data-nodo-plano]').first()).toBeHidden();
    const ancho = (await page.locator('figure.brymen').boundingBox())!.width;
    expect(ancho).toBeGreaterThan(200);
    // the one-line summary of its leads opens their editor
    const fila = page.locator('[data-resumen-puntas]');
    await expect(fila).toContainText(/Puntas: roja en a\d, COM en 0/);
    await fila.tap();
    await expect(fila).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#banco-editor-movil [data-puntas-puestas]')).toBeVisible();
    // FNIRSI: its own summary
    await seg.getByRole('tab', { name: 'FNIRSI' }).tap();
    await expect(page.locator('figure.fnirsi')).toBeVisible();
    await expect(page.locator('figure.brymen')).toBeHidden();
    await expect(fila).toContainText(/Puntas: CH1 en a\d, masa en 0/);
    // Circuito: the schematic, the leads, the folded rows
    await seg.getByRole('tab', { name: 'Circuito' }).tap();
    await expect(page.locator('[data-nodo-plano]').first()).toBeVisible();
    await expect(page.locator('.banco > .puntas [data-puntas-puestas]')).toBeVisible();
    await expect(page.locator('figure.fnirsi')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
    sinHallazgos(await axe(page, '.banco'), 'banco 2.1, teléfono, sepia');
    // 360 px: no sideways scroll on any segment
    await page.setViewportSize({ width: 360, height: 780 });
    for (const t of ['Circuito', 'Brymen', 'FNIRSI']) {
      await seg.getByRole('tab', { name: t }).tap();
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), t).toBeLessThanOrEqual(360);
    }
  });

  test('consolas en el teléfono: las tablas de «Fuentes» y el dibujo de «Un fotograma» se alcanzan con el teclado (axe), en las once', async ({ page }) => {
    test.setTimeout(600_000);
    await limpio(page, 'oscuro');
    const MAQUINAS = ['nes', 'neogeo', 'sms', 'megadrive', 'gb', 'gbc', 'snes', 'n64', 'ps1', 'gamecube', 'saturn'];
    const malos: string[] = [];
    for (const m of MAQUINAS) {
      for (const vista of ['fuentes', 'fotograma']) {
        await page.goto(`/#/consolas/${m}/${vista}`);
        // («Un fotograma» exists only for the machines with a model: the route falls back to «Foto» otherwise)
        const sel = vista === 'fuentes' ? '.fuentes' : '.diagrama-paso';
        if (vista === 'fotograma' && !(await page.locator('[data-pestana21="fotograma"]').count())) continue;
        await expect(page.locator(sel).first()).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(600);
        const h = (await axe(page, '.consolas')).filter((x) => x.regla === 'scrollable-region-focusable');
        for (const x of h) malos.push(`${m}/${vista}: ${x.nodos.map((n) => n.sel).join(', ')}`);
        // every scroller that scrolls is a named region in the Tab order
        const sinNombre = await page.locator('.consolas .tabla, .consolas .desliza').evaluateAll((els) =>
          els.filter((e) => e.scrollWidth > e.clientWidth + 1).filter((e) => e.getAttribute('tabindex') !== '0' || !e.getAttribute('aria-label')).map((e) => e.className),
        );
        for (const c of sinNombre) malos.push(`${m}/${vista}: ${c} sin nombre o fuera del orden del tabulador`);
      }
    }
    expect(malos).toEqual([]);
  });

  test('consolas en el teléfono: el menú de máquinas cabe a 360 px y ningún subtítulo se corta', async ({ page }) => {
    await limpio(page, 'oscuro');
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/#/consolas/n64/foto');
    await page.locator('[data-elegir-consola]').tap();
    const enlaces = page.getByRole('navigation', { name: 'Consola' }).getByRole('link');
    await expect(enlaces).toHaveCount(11);
    const filas = await enlaces.evaluateAll((as) =>
      as.map((a) => {
        const r = a.getBoundingClientRect();
        const s = a.querySelector('small')!;
        return { t: a.textContent, derecha: r.right, cortada: s.scrollWidth > s.clientWidth + 1 };
      }),
    );
    for (const f of filas) {
      expect(f.derecha, f.t ?? '').toBeLessThanOrEqual(360);
      expect(f.cortada, f.t ?? '').toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});

test.describe('tableta', () => {
  test.beforeEach(soloEn('tableta'));

  // Owner's item of 25-11 (Xiaomi Pad 6): the bench and the console at 800 × 1280 and 1280 × 800, touch, DPR 2.5.
  test('banco y consola en la tableta, vertical y apaisada: nada solo de escritorio ni solo de teléfono se rompe', async ({ page }) => {
    await limpio(page, 'oscuro');
    // portrait: one column, no phone segments, both instruments side by side under the leads
    await banco(page);
    await expect(page.getByRole('tablist', { name: 'Qué ver' })).toBeHidden();
    await expect(page.locator('[data-nodo-plano]').first()).toBeVisible();
    const bm = (await page.locator('figure.brymen').boundingBox())!;
    const fn = (await page.locator('figure.fnirsi').boundingBox())!;
    expect(Math.abs(bm.y - fn.y)).toBeLessThan(40);
    expect(bm.x + bm.width).toBeLessThanOrEqual(fn.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(800);
    await expect(page.locator('[data-resumen-puntas]')).toBeHidden();
    // landscape: the left column and the instruments on the right
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    const plano = (await page.locator('.banco .circuito').boundingBox())!;
    const aparatos = (await page.locator('.banco .instrumentos').boundingBox())!;
    expect(plano.x + plano.width).toBeLessThanOrEqual(aparatos.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    // the console: the menu fits, the side panel under the photo in portrait
    await page.setViewportSize({ width: 800, height: 1280 });
    await page.goto('/#/consolas/saturn/foto/foto:scu');
    await expect(page.locator('.foto-vista .ficha h2')).toContainText('SCU');
    const foto = (await page.locator('.foto-vista .desplazable').boundingBox())!;
    const ficha = (await page.locator('.foto-vista .ficha').boundingBox())!;
    expect(ficha.y).toBeGreaterThan(foto.y + foto.height - 1);
    await page.locator('[data-elegir-consola]').tap();
    await expect(page.getByRole('navigation', { name: 'Consola' }).getByRole('link')).toHaveCount(11);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(800);
  });
});
