// Fix round of review 10e (1.0 exercises): regression tests of the findings fixed here, beyond the reviewer's own
// (tests/revision10e-*.spec.ts). Unit tests need no browser:
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejercicios10.config.ts tests/ejercicios10-r10e.spec.ts -g unidad
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comprobar, type Esperado } from '../src/lib/magnitudes';
import { enunciadoDe, variantes } from '../src/componentes/practica/variantes';
import type { ItemNumerico } from '../src/componentes/practica/tipos';

const PRACTICA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'libro', 'practica');
const enlazados = (): ItemNumerico[] =>
  readdirSync(PRACTICA)
    .filter((f) => /^(cap|ap)\w+\.json$/.test(f))
    .flatMap((f) => JSON.parse(readFileSync(join(PRACTICA, f), 'utf-8')).items ?? [])
    .filter((x: ItemNumerico) => x?.tipo === 'numerico' && x.ejercicio);
const item = (id: string) => enlazados().find((x) => x.id === id)!;
const plano = (h: string) => h.replace(/<[^>]+>/g, '');

const e = (valor: number, unidad: string, texto = ''): Esperado => ({ valor, unidad, texto, tol: 0.02 });

test('unidad: siemens no es segundo ni henrio es hora (las mayúsculas de los símbolos cuentan)', () => {
  // «4,7 mS» was accepted as 4,7 ms: a wrong answer passed
  expect(comprobar('4,7 mS', e(0.0047, 's')).tipo).not.toBe('bien');
  expect(comprobar('4,7 ms', e(0.0047, 's')).tipo).toBe('bien');
  expect(comprobar('4,7 ms', e(0.0047, 'S')).tipo).not.toBe('bien');
  expect(comprobar('4,7 mS', e(0.0047, 'S')).tipo).toBe('bien');
  expect(comprobar('2 h', e(2, 'H')).tipo).not.toBe('bien');
  expect(comprobar('2 H', e(2, 'H')).tipo).toBe('bien');
  expect(comprobar('3 S', e(3, 's')).tipo).not.toBe('bien');
  // the friendly spellings that are not ambiguous keep working
  expect(comprobar('1 khz', e(1000, 'Hz')).tipo).toBe('bien');
  expect(comprobar('5 v', e(5, 'V')).tipo).toBe('bien');
  expect(comprobar('20 ma', e(0.02, 'A')).tipo).not.toBe('vacio');
  expect(comprobar('4,7 kohm', e(4700, 'Ω')).tipo).toBe('bien');
  expect(comprobar('3,3 mv', e(0.0033, 'V')).tipo).toBe('bien');
});

test('unidad: «R33», «5 V.» y «- 6 dB» se leen', () => {
  expect(comprobar('R33', e(0.33, 'Ω')).tipo).toBe('bien');
  expect(comprobar('R47 Ω', e(0.47, 'Ω')).tipo).toBe('bien');
  expect(comprobar('5 V.', e(5, 'V')).tipo).toBe('bien');
  expect(comprobar('- 6 dB', e(-6, 'dB')).tipo).toBe('bien');
  expect(comprobar('− 6 dB', e(-6, 'dB')).tipo).toBe('bien');
  // what already worked
  expect(comprobar('4k7', e(4700, 'Ω')).tipo).toBe('bien');
  expect(comprobar('2R2', e(2.2, 'Ω')).tipo).toBe('bien');
  expect(comprobar('5.', e(5, 'V')).tipo).toBe('bien');
});

test('unidad: equivalentes con prefijo pegado o con dos grafías', () => {
  expect(comprobar('0,165 m', e(165, 'mm')).tipo).toBe('bien');
  expect(comprobar('165', e(165, 'mm')).tipo).toBe('bien');
  expect(comprobar('165 mm', e(165, 'mm')).tipo).toBe('bien');
  expect(comprobar('0,96 kg', e(0.96, 'kg')).tipo).toBe('bien');
  expect(comprobar('960 g', e(0.96, 'kg')).tipo).toBe('bien');
  expect(comprobar('31 °C/W', e(31, 'K/W')).tipo).toBe('bien');
  expect(comprobar('38,5 mS', e(0.0385, 'A/V')).tipo).toBe('bien');
  // a unit of another magnitude is still refused with its message
  const v = comprobar('165 g', e(165, 'mm'));
  expect(v.tipo).toBe('unidad');
});

test('otros valores: las variantes de los 40 ejercicios enlazados quedan en el régimen del enunciado (auditoría 10e)', () => {
  const its = enlazados();
  // (1.2, book 4.1: 46 — the new ones keep to the generic rules below)
  expect(its.length).toBe(46);
  // the linked Early-resistance formula for «una carga de 24 Ω alimentada a 12 V» is gone, and (1.2) Euler's largest
  // step linked to Ziegler-Nichols' T_i = T_u/2
  expect(its.some((x) => x.ejercicio!.label === 'prob-6.C')).toBe(false);
  expect(its.some((x) => x.ejercicio!.label === 'ej-31.22')).toBe(false);
  const fallos: string[] = [];
  for (const it of its) {
    const vs = variantes(it);
    if (vs.length < 8) fallos.push(`${it.id}: ${vs.length} variantes`);
    for (const v of vs) {
      const x = v.valores as Record<string, number>;
      const t = plano(enunciadoDe(it, v));
      if (/\{\{/.test(t)) fallos.push(`${it.id}: hueco sin rellenar`);
      switch (it.ejercicio!.label) {
        case 'ej-5.6':
          if (x.f_r !== 100) fallos.push(`ej-5.6: rizado ${x.f_r} Hz`);
          break;
        case 'ej-5.1':
          if (x.I_F! > 0.02 || x.V_CC! - x.V_F! < 1) fallos.push(`ej-5.1: ${x.I_F} A desde ${x.V_CC} V`);
          break;
        case 'ej-6.2': {
          const vb = (x.V_CC! * x.R_2!) / (x.R_1! + x.R_2!);
          if (vb <= 0.7 || x.V_CC! - ((vb - 0.7) / 470) * 2670 <= 0.3) fallos.push(`ej-6.2: VB ${vb.toFixed(2)}`);
          break;
        }
        case 'ej-16.2':
          if (x.f_s !== 10.7e6 || x.f_FI! < 87.5e6 || x.f_FI! > 108e6) fallos.push(`ej-16.2: ${x.f_FI} / ${x.f_s}`);
          break;
        case 'ej-5.3':
        case 'ej-5.8':
          // the load current is the larger one in the book's statement: «carga que consume 20 mA»
          if (!/carga (que consume|de) \S+\s?mA/.test(t)) fallos.push(`${it.id}: ${t.slice(0, 90)}`);
          if (x.V_in! - x.V_Z! <= 1) fallos.push(`${it.id}: sin margen`);
          break;
        case 'prob-4.C':
          if (x.I !== 2) fallos.push('prob-4.C: la corriente debe seguir siendo 2 A (6 Ω a 12 V)');
          break;
        case 'ej-1.4':
          if (x.V_out! >= x.V_in!) fallos.push('ej-1.4: salida ≥ entrada');
          break;
        case 'prob-4.A':
        case 'ej-33.1':
          if (x.V_out! >= x.V_in!) fallos.push(`${it.id}: salida ≥ entrada`);
          break;
        case 'prob-8.A':
          if (x.V_in! - x.V_out! < 2) fallos.push('prob-8.A: sin margen');
          break;
        case 'ej-56.7':
          // (1.2) «un variador V/f de 8 V/Hz», 400 V at 50 Hz: the nominal frequency stays and the new one is below it
          if (x.f_1 !== 50 || x.f_2! >= 50) fallos.push(`ej-56.7: ${x.f_2} Hz con nominal ${x.f_1} Hz`);
          break;
      }
    }
  }
  expect(fallos).toEqual([]);
  // the Zener statements name the load current where the book does
  const z = item('cap05-num-ej-5.3');
  expect(z.ejercicio!.html).toMatch(/consume \{\{I_L\}\}/);
  expect(z.libro.I_L).toBe(0.02);
});

// ---------------------------------------------------------------------------------------------------- browser

import type { Page } from '@playwright/test';

async function limpio(page: Page): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'claro', tam: 18 }));
    }
  });
}
const panel = (page: Page, label: string) => page.locator(`.comprobador[data-label="${label}"]`);
const campo = (page: Page, label: string, r: string) => page.locator(`#cmp-${label.replace(/[^\w-]/g, '_')}-${r}`);
const guardado = (page: Page, label: string) =>
  page.evaluate((l) => {
    const t = localStorage.getItem('epa:ejercicios');
    const d = t ? JSON.parse(t) : {};
    return (d.items ?? d)[l];
  }, label);

test('navegador: el paso a paso cuenta lo que se vio (solo la pista de un paso = una pista) en cuanto se ve', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap02/ej-2.6');
  const p = panel(page, 'ej-2.6');
  await p.locator('[data-pasos-boton]').click();
  const g = p.locator('[data-pasos="ej-2.6"]');
  await g.getByRole('button', { name: 'Pista' }).click();
  // counted at once, before leaving: one hint (the approach), not both
  await expect.poll(async () => (await guardado(page, 'ej-2.6'))?.pistas ?? 0).toBe(1);
  await g.getByRole('button', { name: 'Salir del paso a paso' }).click();
  await expect(p.locator('ol.pistas li')).toHaveCount(1);
});

test('navegador: un borrador escrito después de comprobar vuelve sin veredicto; lo comprobado, con el suyo', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap01/ej-1.1');
  const p = panel(page, 'ej-1.1');
  await campo(page, 'ej-1.1', 'r1').fill('11,75');
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(p.locator('[data-r="r1"] .fb-bien')).toBeVisible();
  // a later draft in the other field, never checked
  await campo(page, 'ej-1.1', 'r2').fill('5 W');
  await page.goto('#/cap02');
  await page.goto('#/cap01/ej-1.1');
  await expect(campo(page, 'ej-1.1', 'r2')).toHaveValue('5 W');
  await expect(p.locator('[data-r="r1"] .fb-bien')).toBeVisible();
  await expect(p.locator('[data-r="r2"] .fb')).toHaveCount(0);
  // a draft is not an attempt
  // stored too (debounced write, flushed when the panel went away), as a draft: not an attempt
  await expect.poll(async () => (await guardado(page, 'ej-1.1'))?.valores?.r2 ?? null, { timeout: 5000 }).toBe('5 W');
  expect((await guardado(page, 'ej-1.1'))?.intentos).toBe(1);
});

test('navegador: un ejercicio autoevaluado no dice «después de ver la solución»', async ({ page }) => {
  await limpio(page);
  // (1.1 «razonar»: ej-4.8 is self-checked now; ej-12.8 is still self-assessed)
  await page.goto('#/cap12/ej-12.8');
  const p = panel(page, 'ej-12.8');
  await p.getByRole('button', { name: 'Ver solución' }).click();
  await p.getByRole('group', { name: 'Autoevaluación' }).getByRole('button', { name: 'Sí' }).click();
  await expect(p.locator('.estado')).toContainText('Autoevaluado: lo tenía bien');
  await expect(p.locator('.estado')).not.toContainText('después de ver la solución');
});

test('navegador: teoría que se mueve, posiciones que se leen distinto y resultados despreciables como «≈ 0»', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap06/sec-6.5');
  const t = page.locator('[data-teoria="ib-divisor"]');
  await t.scrollIntoViewIfNeeded();
  await t.getByRole('button', { name: 'Mover los valores de esta fórmula' }).click();
  const vth = t.getByRole('slider', { name: /Thévenin del divisor$/ }).first();
  await expect(vth).toHaveAttribute('aria-valuetext', /^2,105 voltios$/); // (1.1 motor fixes: the value in words)
  await vth.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(vth).toHaveAttribute('aria-valuetext', /^2,1 voltios$/);
  await page.goto('#/cap03/sec-3.2');
  const d = page.locator('[data-teoria="descarga-rc-rc"]');
  await d.scrollIntoViewIfNeeded();
  await d.getByRole('button', { name: 'Mover los valores de esta fórmula' }).click();
  // τ = 1 kΩ · 100 µF = 0,1 s and t = 10 s: 9 V · e^(−100)
  await d.getByRole('slider', { name: /Resistencia/ }).focus();
  await page.keyboard.press('Home');
  await d.getByRole('slider', { name: /Tiempo/ }).focus();
  await page.keyboard.press('End');
  await expect(d.locator('output')).toHaveText(/^≈ 0\sV$/);
});
