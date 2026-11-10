// 1.1 hand-authored lessons, walked in the browser one by one from their published data (parametric: every lesson of
// lecciones11/indice.json, or those whose id matches EPA_RECORRER, a regular expression such as «^cap00/»). For each
// card: the explore gating (it opens after moving what it asks), every question answered wrong first (the explanation
// of that option is shown) and then right, the estimate too low or too high and then within its tolerance, the
// challenge failing (a hint) and then solved with the keyboard at a position the model says is a solution, the order
// put right with «Subir», the pairs placed, axe (contrast included) on every card, and the summary at the end. A second
// pass at 360 px in the dark theme checks there is no horizontal scroll and runs axe again.
//   EPA_RECORRER='^cap00/' PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones11-recorrido.spec.ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { compilarModelo, objetivoEstimar, posicionesEstimar, posicionMasCercana, puntuarEstimacion, enRango, type Valores } from '../src/lib/leccion11/modelo.ts';
import { textoPlano } from '../src/lib/leccion11/texto.ts';
import { numeroAria } from '../src/lib/teoria-viva.ts';
import type { IndiceLecciones11, Leccion11, Tarjeta, Texto } from '../src/lib/leccion11/tipos.ts';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(web, 'public', 'libro', 'lecciones11');
const indice = JSON.parse(fs.readFileSync(path.join(DIR, 'indice.json'), 'utf8')) as IndiceLecciones11;
const filtro = process.env.EPA_RECORRER ? new RegExp(process.env.EPA_RECORRER) : null;
const lecciones = Object.keys(indice.lecciones).filter((id) => !filtro || filtro.test(id));
const cargar = (id: string) => JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8')) as Leccion11;

type Tema = 'claro' | 'sepia' | 'oscuro';
async function limpio(page: Page, tema: Tema): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript((t) => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18, sonido: false, vibracion: false }));
    }
  }, tema);
}

const boton = (page: Page) => page.locator('[data-continuar]');
const aviso = (page: Page) => page.locator('[data-veredicto]');
/** An explanation as the banner shows it (only its static part when it has live values: those are formatted). */
// (only the runs before the first live value: dropping a value from the middle would glue its neighbours, «da . El»)
const plano = (t: Texto | undefined) => {
  const k = t?.findIndex((x) => x.t === 'val') ?? -1;
  return textoPlano(k >= 0 ? t!.slice(0, k) : t).split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
};

async function axe(page: Page, donde: string) {
  // finite animations (the summary's cards rising from transparent, the confetti) end first: axe measured a «días de
  // racha» half faded in as a contrast failure (motor fixes 1.1, a flake of cap04/sec-4.2 at 360 px)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => undefined);
  await page.addScriptTag({ path: AXE });
  const fallos = await page.evaluate(async () => {
    const a = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const r = await a.run({ include: [['[data-leccion11]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  });
  expect(fallos, donde).toEqual([]);
}

/** Puts a slider at position k of its list with the keyboard (Home, then one arrow per position). */
async function aPosicion(page: Page, sel: string, k: number) {
  const s = page.locator(sel);
  await s.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < k; i++) await page.keyboard.press('ArrowRight');
}

async function comprobarYVer(page: Page, bien: boolean, contiene?: string) {
  await expect(boton(page)).toHaveAttribute('data-accion', 'comprobar');
  await boton(page).click();
  await expect(aviso(page)).toHaveAttribute('data-veredicto', bien ? 'bien' : 'mal');
  if (contiene) await expect(aviso(page)).toContainText(contiene);
  if (!bien) {
    await expect(boton(page)).toHaveAttribute('data-accion', 'reintentar');
    await boton(page).click();
  }
}

/** Walks a card to the end; returns the reader's values after it (what the next card starts from). */
async function recorrerTarjeta(page: Page, l: Leccion11, t: Tarjeta, k: number, propios: Valores): Promise<Valores> {
  const mc = compilarModelo(l.modelo);
  const donde = `${l.id} · ${k + 1} ${t.id}`;
  await expect(page.locator('[data-leccion11]'), donde).toHaveAttribute('data-tarjeta-n', String(k));
  await expect(page.locator(`[data-tarjeta="${t.id}"]`), donde).toBeVisible();
  const mios: Valores = { ...propios, ...t.inicio };
  const estado = { ...mios, ...t.fijar };
  const mandos = t.widget?.mandos ?? [];
  const sel = (v: string) => `[data-mando11="${v}"] [role="slider"]`;

  if (t.tipo === 'resumen') {
    await expect(page.locator('[data-resumen]'), donde).toBeVisible();
    // (the confetti flies over the chips for a moment: axe once it has gone)
    await expect(page.locator('[data-celebracion] .confeti')).toHaveCount(0, { timeout: 5000 });
    // (a long summary scrolls under the sticky footer: look at its last links in view, as the reader does)
    await page.locator('[data-repetir]').evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await axe(page, donde);
    return mios;
  }
  if (t.widget?.ocultar) await expect(page.locator('[data-lectura]').first(), donde).toContainText('¿?');

  if (t.requiere) {
    // explore: touch every control it asks for and leave it where it was (a step there and back)
    await expect(boton(page), donde).toBeDisabled();
    const mover = t.requiere.mover.length ? t.requiere.mover : mandos.filter((m) => m.tipo === 'deslizador').slice(0, t.requiere.minimo).map((m) => m.valor);
    for (const v of mover) {
      const m = mandos.find((x) => x.valor === v)!;
      if (m.tipo === 'interruptor') {
        // a switch: flip it and back (it ends as it was)
        const s = page.locator(`[data-interruptor="${v}"]`);
        const antes = await s.getAttribute('aria-checked');
        await s.click();
        await s.click();
        await expect(s, `${donde} · ${v}`).toHaveAttribute('aria-checked', antes!);
        continue;
      }
      const pos = posicionMasCercana(m.valores, estado[v]!);
      await page.locator(sel(v)).focus();
      const [ida, vuelta] = pos < m.valores.length - 1 ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
      await page.keyboard.press(ida);
      await page.keyboard.press(vuelta);
      // as the control writes it, without an exponent (a 35 ns control reads «0.000000035», not «3.5e-8»)
      await expect(page.locator(sel(v)), `${donde} · ${v}`).toHaveAttribute('aria-valuenow', numeroAria(m.valores[pos]!));
    }
    for (const v of t.requiere.conectar) {
      await page.locator(`[data-conectar="${v}"]`).click();
      mios[v] = 1;
    }
  }

  if (t.opciones) {
    const mal = t.opciones.findIndex((o) => !o.bien);
    const bien = t.opciones.findIndex((o) => o.bien);
    await page.locator(`[data-opcion="${mal}"]`).click();
    await comprobarYVer(page, false, plano(t.opciones[mal]!.porque));
    await page.locator(`[data-opcion="${bien}"]`).click();
    await comprobarYVer(page, true, plano(t.opciones[bien]!.porque));
  } else if (t.estimar) {
    const est = t.estimar;
    const obj = objetivoEstimar(mc, est, estado);
    const pos = posicionesEstimar(est);
    const ok = pos.findIndex((p) => puntuarEstimacion(p, obj, est.tol).bien);
    const s = '[data-estimar] [role="slider"]';
    // a wrong estimate first: the far end of the slider from the target
    await page.locator(s).focus();
    await page.keyboard.press(obj - est.min > est.max - obj ? 'Home' : 'End');
    await comprobarYVer(page, false);
    await aPosicion(page, s, ok);
    await comprobarYVer(page, true, plano(t.exito));
  } else if (t.ordenar) {
    await comprobarYVer(page, false);
    // bring each item to its place from the top down with «Subir»
    for (let i = 0; i < t.ordenar.elementos.length; i++) {
      for (let n = 0; n < t.ordenar.elementos.length; n++) {
        if ((await page.locator('[data-ordenar] li').nth(i).getAttribute('data-elemento')) === String(i)) break;
        await page.locator(`[data-subir="${i}"]`).click();
      }
    }
    await comprobarYVer(page, true, plano(t.exito));
  } else if (t.emparejar) {
    const n = t.emparejar.parejas.length;
    // a wrong placing first (each chip one slot along), then the right one
    for (let i = 0; i < n; i++) {
      await page.locator(`[data-ficha="${i}"]`).click();
      await page.locator(`[data-hueco="${(i + 1) % n}"]`).click();
    }
    await comprobarYVer(page, false);
    // a slot taken gives its chip back when touched: empty them all, then place each chip on its partner
    for (let i = 0; i < n; i++) if (await page.locator(`[data-hueco="${i}"].lleno`).count()) await page.locator(`[data-hueco="${i}"]`).click();
    for (let i = 0; i < n; i++) {
      await page.locator(`[data-ficha="${i}"]`).click();
      await page.locator(`[data-hueco="${i}"]`).click();
    }
    await comprobarYVer(page, true, plano(t.exito));
  } else if (t.condiciones) {
    // the challenge: wrong as it starts (a hint), then a solution the model finds among the controls' positions
    await comprobarYVer(page, false);
    const idx = mandos.map(() => 0);
    let sol: number[] | null = null;
    const total = mandos.reduce((a, m) => a * m.valores.length, 1);
    for (let n = 0; n < total && !sol; n++) {
      const v: Valores = { ...estado };
      mandos.forEach((m, j) => (v[m.valor] = m.valores[idx[j]!]!));
      const r = mc.evaluar(v);
      if (t.condiciones.every((c) => enRango(c, r))) sol = [...idx];
      for (let j = 0; j < idx.length; j++) {
        idx[j]!++;
        if (idx[j]! < mandos[j]!.valores.length) break;
        idx[j] = 0;
      }
    }
    expect(sol, `${donde}: el reto tiene solución`).not.toBeNull();
    for (const [j, m] of mandos.entries()) {
      if (m.tipo === 'deslizador') await aPosicion(page, sel(m.valor), sol![j]!);
      else if ((mios[m.valor] ?? 0) !== m.valores[sol![j]!]) await page.locator(`[data-mando11="${m.valor}"] button, [data-conectar="${m.valor}"], [data-interruptor="${m.valor}"]`).first().click();
      mios[m.valor] = m.valores[sol![j]!]!;
    }
    for (let c = 0; c < t.condiciones.length; c++) await expect(page.locator(`[data-condicion="${c}"]`), donde).toHaveAttribute('data-cumple', 'si');
    await comprobarYVer(page, true, plano(t.exito));
  }

  // (a long card scrolls under the sticky footer: look at its last link in view, as the reader does)
  await page.locator('[data-libro]').evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await axe(page, donde);
  await expect(boton(page), donde).toBeEnabled();
  await expect(boton(page), donde).toHaveAttribute('data-accion', 'continuar');
  await boton(page).click();
  return mios;
}

test.describe.configure({ mode: 'default' });

for (const id of lecciones) {
  test(`${id}: recorrida entera, cada respuesta mal y luego bien, axe en cada tarjeta; 360 px en oscuro`, async ({ page, browser }) => {
    const l = cargar(id);
    await limpio(page, 'claro');
    await page.goto(`#/leccion/${id}`);
    const base: Valores = Object.fromEntries(Object.entries(l.modelo.valores).map(([k, v]) => [k, v.valor]));
    let propios = base;
    for (const [k, t] of l.tarjetas.entries()) propios = await recorrerTarjeta(page, l, t, k, propios);
    await expect(page.locator('[data-resumen]')).toBeVisible();

    // 360 px, dark theme: no horizontal scroll, axe on every card
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
    const p = await ctx.newPage();
    await limpio(p, 'oscuro');
    for (let k = 1; k <= l.tarjetas.length; k++) {
      await p.goto(`#/leccion/${id}/${k}`);
      await expect(p.locator('[data-leccion11]')).toHaveAttribute('data-tarjeta-n', String(k - 1));
      await expect(p.locator('[data-leccion11] [data-tarjeta]')).toBeVisible();
      await p.waitForTimeout(150);
      expect(await p.evaluate(() => document.documentElement.scrollWidth), `${id}/${k}`).toBeLessThanOrEqual(360);
      // (as in the first pass: a card taller than the screen has its last link under the sticky footer until scrolled)
      const libro = p.locator('[data-libro]');
      // (evaluateAll does not wait: a link that re-renders between count() and evaluate() hung the test once)
      await libro.evaluateAll((es) => es[0]?.scrollIntoView({ block: 'center' }));
      await axe(p, `${id}/${k} (360 px, oscuro)`);
    }
    await ctx.close();
  });
}
