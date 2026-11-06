// 1.0 «Resolver paso a paso» (guided steps reviewed by hand in contenido/pasos_curado.json → libro/pasos.json):
// content checks without a browser (every step quotes the book, its own answer is accepted, the last step is the
// exercise's result; never offered in a teacher-mode exam), and the flow in the browser (offer after two failed checks,
// discreet button, numeric and choice steps, «Por qué no», hints, leaving at any time, focus, counted as help, 44 px,
// axe in light, sepia and dark).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejercicios10.config.ts tests/ejercicios10-pasos.spec.ts
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { comprobar } from '../src/lib/magnitudes';

const AQUI = dirname(fileURLToPath(import.meta.url));
const LIBRO = join(AQUI, '..', 'public', 'libro');
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const norm = (t: string) => t.replace(/<[^>]+>/g, '').replace(/[\s   ]+/g, ' ').trim();

test('contenido: cada paso cita el libro, acepta su respuesta y el último es el resultado del ejercicio', () => {
  const pasos = JSON.parse(readFileSync(join(LIBRO, 'pasos.json'), 'utf-8'));
  const ej = JSON.parse(readFileSync(join(LIBRO, 'ejercicios.json'), 'utf-8'));
  const curado = JSON.parse(readFileSync(join(AQUI, '..', '..', 'contenido', 'pasos_curado.json'), 'utf-8'));
  const fallos: string[] = [];
  const labels = Object.keys(pasos.items);
  expect(labels.length).toBeGreaterThanOrEqual(40);
  // only what was approved by hand is published
  expect(labels.sort()).toEqual(Object.keys(curado).filter((l) => !l.startsWith('_') && curado[l].aprobado).sort());
  for (const l of labels) {
    const it = ej.items[l];
    if (!it || it.modo !== 'auto') fallos.push(`${l}: no es un ejercicio autocomprobable`);
    const ps = pasos.items[l].pasos;
    if (ps.length < 2) fallos.push(`${l}: menos de dos pasos`);
    ps.forEach((p: any, i: number) => {
      if (!p.pregunta || !p.explicacion) fallos.push(`${l}/${i + 1}: sin pregunta o sin cita`);
      if (p.tipo === 'numerico' && comprobar(p.respuesta.texto, p.respuesta, p.alternativas).tipo !== 'bien') fallos.push(`${l}/${i + 1}: no acepta ${p.respuesta.texto}`);
      if (p.tipo === 'eleccion') {
        if (!(p.correcta >= 0 && p.correcta < p.opciones.length)) fallos.push(`${l}/${i + 1}: correcta`);
        if (p.porque[String(p.correcta)]) fallos.push(`${l}/${i + 1}: «por qué no» en la correcta`);
      }
    });
    const ult = ps[ps.length - 1];
    if (ult.tipo !== 'numerico' || !it.respuestas.some((r: any) => comprobar(ult.respuesta.texto, r, r.alternativas).tipo === 'bien')) fallos.push(`${l}: el último paso no es una respuesta del ejercicio`);
  }
  expect(fallos).toEqual([]);
});

test('regresión 10e: un paso que da una respuesta del ejercicio acepta lo mismo que el ejercicio', () => {
  const pasos = JSON.parse(readFileSync(join(LIBRO, 'pasos.json'), 'utf-8'));
  const ej = JSON.parse(readFileSync(join(LIBRO, 'ejercicios.json'), 'utf-8'));
  const fallos: string[] = [];
  for (const [l, it] of Object.entries(pasos.items) as [string, any][]) {
    for (const [i, p] of (it.pasos as any[]).entries()) {
      if (p.tipo !== 'numerico') continue;
      for (const r of ej.items[l].respuestas) {
        if (r.unidad !== p.respuesta.unidad || comprobar(p.respuesta.texto, r, r.alternativas).tipo !== 'bien') continue;
        // the same answer: whatever the exercise accepts, the step accepts, and the same tolerance
        for (const t of [r.texto, ...r.alternativas.map((a: any) => a.texto)]) {
          if (comprobar(t, p.respuesta, p.alternativas).tipo !== 'bien') fallos.push(`${l}/${i + 1}: no acepta ${t}`);
        }
        if ((r.tol ?? null) !== (p.respuesta.tol ?? null) || (r.tol_abs ?? null) !== (p.respuesta.tol_abs ?? null)) fallos.push(`${l}/${i + 1}: otra tolerancia`);
      }
    }
  }
  expect(fallos).toEqual([]);
});

test('regresión: el HTML de los pasos no lleva etiquetas escapadas (V<sub>R</sub> se veía tal cual)', () => {
  const texto = readFileSync(join(LIBRO, 'pasos.json'), 'utf-8');
  expect(texto.match(/&lt;\/?(sub|sup|strong|em)&gt;/g) ?? []).toEqual([]);
  const pasos = JSON.parse(texto);
  expect(pasos.items['ej-2.6'].pasos[0].nombre).toBe('V<sub>R</sub>');
});

test('regresión: una transconductancia en mA/V se lee con su prefijo (como la guarda el generador, en A/V)', () => {
  const e = { valor: 0.0385, unidad: 'A/V', tol: 0.02, texto: '38,5 mA/V' };
  expect(comprobar('38,5 mA/V', e).tipo).toBe('bien');
  expect(comprobar('0,0385 A/V', e).tipo).toBe('bien');
  expect(comprobar('38,5 A/V', e).tipo).toBe('cerca');
});

test('contenido: el modo examen no ofrece el paso a paso (no usa el panel de ejercicios)', () => {
  const dir = join(AQUI, '..', 'src', 'componentes', 'docente');
  for (const f of readdirSync(dir).filter((x) => /Examen/.test(x))) {
    const t = readFileSync(join(dir, f), 'utf-8');
    expect(t, f).not.toMatch(/Comprobador|ResolverPasos|TarjetaEjercicio|PanelProblema/);
    // the statement is rendered without `raiz`, so no problem panel (with its guided mode) appears inside it
    for (const m of t.matchAll(/<Bloques[^>]*>/g)) expect(m[0], f).not.toMatch(/\braiz\b/);
  }
});

async function limpio(page: Page, tema: 'claro' | 'sepia' | 'oscuro' = 'claro'): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript((t) => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 }));
    }
  }, tema);
}
const panel = (page: Page, label: string) => page.locator(`.comprobador[data-label="${label}"]`);
const campo = (page: Page, label: string, r: string) => page.locator(`#cmp-${label.replace(/[^\w-]/g, '_')}-${r}`);

async function dosFallos(page: Page, label: string) {
  const p = panel(page, label);
  await campo(page, label, 'r1').fill('1');
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
}

test('tras dos fallos se ofrece; pasos numéricos y de elegir con pista y «Por qué no»; termina en el resultado y cuenta como ayuda', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap02/ej-2.6');
  const p = panel(page, 'ej-2.6');
  await expect(p).toBeVisible();
  // the discreet button is there from the start; the offer only after two failed checks
  await expect(p.locator('[data-pasos-boton]')).toBeVisible();
  await expect(p.locator('[data-oferta-pasos]')).toHaveCount(0);
  await dosFallos(page, 'ej-2.6');
  await p.locator('[data-oferta-pasos]').click();
  const g = p.locator('[data-pasos="ej-2.6"]');
  await expect(g.getByRole('heading', { name: 'Paso a paso · Paso 1 de 4' })).toBeFocused();
  // step 1: a wrong value, the hint, then the right one with its unit and a decimal comma
  await g.getByRole('textbox').fill('7');
  await g.getByRole('button', { name: 'Comprobar el paso' }).click();
  await expect(g.locator('.fb-mal, .fb-cerca')).toBeVisible();
  await g.getByRole('button', { name: 'Pista' }).click();
  await expect(g.locator('.pista')).toContainText('Alimentación menos la tensión del LED');
  // the exercise's own hints (which give intermediate results away) stay hidden while the steps are answered
  await expect(p.locator('ol.pistas')).toHaveCount(0);
  await expect(g.locator('.nom')).toHaveText('VR =');
  await g.getByRole('textbox').fill('3,0 V');
  await g.getByRole('textbox').press('Enter');
  await expect(g.locator('.fb-bien')).toBeVisible();
  await expect(g.locator('.desarrollo')).toContainText('5 − 2 = 3 V');
  await g.getByRole('button', { name: 'Siguiente paso' }).click();
  await expect(g.getByRole('heading', { name: 'Paso a paso · Paso 2 de 4' })).toBeFocused();
  // step 2 with a prefix
  await g.getByRole('textbox').fill('0,2 k');
  await g.getByRole('button', { name: 'Comprobar el paso' }).click();
  await g.getByRole('button', { name: 'Siguiente paso' }).click();
  // step 3: a choice, the wrong option says why not
  await g.getByRole('radio', { name: '180 Ω' }).check();
  await g.getByRole('button', { name: 'Comprobar el paso' }).click();
  await expect(g.locator('.porque')).toContainText('la corriente pasaría de los 15 mA');
  await g.getByRole('radio', { name: '220 Ω' }).check();
  await g.getByRole('button', { name: 'Comprobar el paso' }).click();
  await expect(g.locator('.fb-bien')).toBeVisible();
  await g.getByRole('button', { name: 'Siguiente paso' }).click();
  // step 4: two wrong checks settle it and show the answer and the book's sentence
  await g.getByRole('textbox').fill('1 W');
  await g.getByRole('button', { name: 'Comprobar el paso' }).click();
  await g.getByRole('textbox').fill('2 W');
  await g.getByRole('button', { name: 'Comprobar el paso' }).click();
  await expect(g.locator('.desarrollo')).toContainText('Respuesta:');
  await expect(g.locator('.desarrollo')).toContainText('41 mW');
  await g.getByRole('button', { name: 'Ver el resultado' }).click();
  await expect(g.locator('.final')).toContainText('Ha llegado al resultado');
  await g.getByRole('button', { name: 'Volver al ejercicio' }).click();
  await expect(p.locator('[data-pasos="ej-2.6"]')).toHaveCount(0);
  await expect(p.locator('[data-pasos-boton]')).toBeFocused();
  // the exercise is then solved «with help»
  await campo(page, 'ej-2.6', 'r1').fill('200');
  await campo(page, 'ej-2.6', 'r2').fill('220');
  await campo(page, 'ej-2.6', 'r3').fill('41 mW');
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(p.locator('.estado')).toContainText('Resuelto con 2 pistas');
});

test('el botón discreto abre el paso a paso antes de intentarlo y se puede salir en cualquier paso', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap03/ej-3.2');
  const p = panel(page, 'ej-3.2');
  await p.locator('[data-pasos-boton]').click();
  const g = p.locator('[data-pasos="ej-3.2"]');
  await expect(g).toBeVisible();
  await g.getByRole('button', { name: 'Salir del paso a paso' }).click();
  await expect(g).toHaveCount(0);
  // left without using it: no help is counted, solving it now is «a la primera»
  await p.locator('#cmp-ej-3_2-r1').fill('1,034');
  await p.locator('#cmp-ej-3_2-r2').fill('7,44 V');
  await p.locator('#cmp-ej-3_2-r3').fill('4,76');
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(p.locator('.estado')).toContainText('Resuelto a la primera');
  // exercises without reviewed steps have neither the button nor the offer
  await page.goto('#/cap02/ej-2.1');
  await expect(panel(page, 'ej-2.1')).toBeVisible();
  await expect(panel(page, 'ej-2.1').locator('[data-pasos-boton]')).toHaveCount(0);
});

async function tactil(browser: Browser, tema: 'claro' | 'sepia' | 'oscuro') {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await limpio(page, tema);
  return { ctx, page };
}

test('paso a paso en el teléfono: 44 px, sin desbordar, y axe (contraste incluido) en claro, sepia y oscuro', async ({ browser }) => {
  for (const tema of ['claro', 'sepia', 'oscuro'] as const) {
    const { ctx, page } = await tactil(browser, tema);
    await page.goto('#/cap01/ej-1.4');
    const p = panel(page, 'ej-1.4');
    await expect(p).toBeVisible();
    await p.locator('[data-pasos-boton]').click();
    const g = p.locator('[data-pasos="ej-1.4"]');
    await g.getByRole('radio').nth(1).check();
    await g.getByRole('button', { name: 'Comprobar el paso' }).click();
    await expect(g.locator('.porque')).toBeVisible();
    await g.getByRole('button', { name: 'Pista' }).click();
    const pequenos = await g.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('button, label.opcion, input[type=text]')]
        .filter((x) => x.offsetParent)
        .map((x) => ({ n: (x.textContent || x.tagName).trim().slice(0, 30), r: x.getBoundingClientRect() }))
        .filter((x) => x.r.height < 44 || x.r.width < 44)
        .map((x) => `${x.n} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`),
    );
    expect(pequenos, tema).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), tema).toBeLessThanOrEqual(0);
    await page.addScriptTag({ path: AXE });
    const v = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
      const r = await axe.run({ include: [['[data-pasos="ej-1.4"]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
      return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    });
    expect(v, tema).toEqual([]);
    await ctx.close();
  }
});
