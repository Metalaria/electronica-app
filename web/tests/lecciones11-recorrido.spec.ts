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
import { compilarModelo, formatear, objetivoEstimar, posicionesEstimar, posicionMasCercana, puntuarEstimacion, enRango, type Valores } from '../src/lib/leccion11/modelo.ts';
import { textoPlano } from '../src/lib/leccion11/texto.ts';
import { numeroAria } from '../src/lib/teoria-viva.ts';
import { falloDeRonda, lecturas } from '../src/lib/leccion12/averia.ts';
import { analizarDiseno } from '../src/lib/leccion12/tolerancias.ts';
import type { IndiceLecciones11, Leccion11, Tarjeta, Texto } from '../src/lib/leccion11/tipos.ts';
import type { ActividadDigital, WidgetFigura, WidgetLogica } from '../src/lib/leccion12/digital/tipos.ts';
// 1.2.1 (piloto121): the cards answered by doing on the live widget and the goal of an explore card (GUIA §13)
import { graficaDe, marcaBien, objetivoCumplido, posicionesMarca } from '../src/lib/leccion12/hacer/motor-hacer.ts';
import type { Instrumento } from '../src/lib/leccion12/hacer/tipos.ts';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(web, 'public', 'libro', 'lecciones11');
const indice = JSON.parse(fs.readFileSync(path.join(DIR, 'indice.json'), 'utf8')) as IndiceLecciones11;
const filtro = process.env.EPA_RECORRER ? new RegExp(process.env.EPA_RECORRER) : null;

// motor12e: EPA_RECORRER_CATALOGO=1 walks the engine's catalogue lessons of the 1.2 steps instead
// (tests/lecciones12-catalogo/<parte>/<label>.yaml, generated here in Node and served in place of the published ones,
// as the catalogue specs do): the walker's own hard cases live there (a design whose first nominal solution fails
// with the tolerances, a fault drawn «al azar», open-band and two-control «ajuste» cards).
const CATALOGO = new Map<string, Leccion11>();
if (process.env.EPA_RECORRER_CATALOGO) {
  const { parse } = await import('yaml');
  const { generarLeccion } = await import('../src/lib/leccion11/generar.ts');
  const { sqlNode } = await import('../src/lib/leccion12/sql/node.ts');
  // @ts-expect-error (a plain .mjs module of the scripts: no types)
  await (await import('../scripts/esquemas11.mjs')).cargarEsquemas11();
  // @ts-expect-error (a plain .mjs module of the scripts: no types)
  const { recursosLibro } = await import('../scripts/recursos11.mjs');
  const contexto = {
    bloques: (p: string) => {
      const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
      return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
    },
    sql: await sqlNode(),
    recursos: recursosLibro(path.join(web, 'public', 'libro'), path.join(web, 'public')),
  };
  const raiz = path.join(web, 'tests', 'lecciones12-catalogo');
  for (const p of fs.readdirSync(raiz).sort())
    for (const f of fs.readdirSync(path.join(raiz, p)).filter((x) => x.endsWith('.yaml')).sort()) {
      const r = generarLeccion(parse(fs.readFileSync(path.join(raiz, p, f), 'utf8')), contexto, 'catalogo-recorrido');
      if (r.errores.length) throw new Error(`${p}/${f}: ${r.errores.join('; ')}`);
      CATALOGO.set(r.leccion!.id, r.leccion!);
    }
}
const lecciones = (CATALOGO.size ? [...CATALOGO.keys()] : Object.keys(indice.lecciones)).filter((id) => !filtro || filtro.test(id));
const cargar = (id: string) => CATALOGO.get(id) ?? (JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8')) as Leccion11);

type Tema = 'claro' | 'sepia' | 'oscuro';
async function limpio(page: Page, tema: Tema): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  if (CATALOGO.size) {
    // (motor12e) the catalogue lessons, served in place of the published ones
    await page.context().route('**/libro/lecciones11/indice.json', async (x) => {
      const real = await x.fetch().then((y) => y.json()).catch(() => ({ version: 1, total: 0, lecciones: {} }));
      const lecciones = { ...(real.lecciones ?? {}), ...Object.fromEntries([...CATALOGO].map(([id, l]) => [id, { tarjetas: l.tarjetas.length }])) };
      await x.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, total: Object.keys(lecciones).length, lecciones }) });
    });
    for (const [id, l] of CATALOGO) await page.context().route(`**/libro/lecciones11/${id}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(l) }));
  }
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

// Targets under the sticky header or footer (autor-taller-D, for every card, desktop and 360 px). The walker looks at
// a card with its last link («Del libro») centred, as the reader does; on a card taller than the screen something
// then lies under the sticky header (.cab) or footer (.pie), e.g. a figure's zoom buttons, and axe reports it as a
// target-size failure («partially obscured»). That position alone proves nothing: what WCAG 2.4.11 (focus not
// obscured) and 2.5.8 (target size) ask is that the control is usable when the reader reaches it. So each target-size
// node lying under a bar is reached as the reader does — focused (the lesson sets scroll-padding to the bars' heights,
// Leccion11.svelte), or scrolled into view if it cannot take the focus (a disabled «−») —, must then lie fully in view
// and clear of both bars, and axe is run again on it alone: a failure that persists there counts. Nothing is exempt.
async function axe(page: Page, donde: string) {
  // finite animations (the summary's cards rising from transparent, the confetti) end first: axe measured a «días de
  // racha» half faded in as a contrast failure (motor fixes 1.1, a flake of cap04/sec-4.2 at 360 px)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => undefined);
  await page.addScriptTag({ path: AXE });
  const fallos = await page.evaluate(async () => {
    type Violacion = { id: string; nodes: { target: string[] }[] };
    const a = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Violacion[] }> } }).axe;
    const r = await a.run({ include: [['[data-leccion11]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    const barras = () => [...document.querySelectorAll('[data-leccion11] .cab, [data-leccion11] .pie')].map((e) => e.getBoundingClientRect());
    const bajoBarra = (q: DOMRect) => barras().some((f) => q.top < f.bottom && q.bottom > f.top);
    const salida: string[] = [];
    const x0 = scrollX;
    const y0 = scrollY;
    const foco = document.activeElement as HTMLElement | null;
    for (const v of r.violations) {
      const quedan: string[] = [];
      for (const n of v.nodes) {
        const sel = n.target.join(' ');
        const el = document.querySelector<HTMLElement>(sel);
        if (v.id !== 'target-size' || !el || !bajoBarra(el.getBoundingClientRect())) {
          quedan.push(sel);
          continue;
        }
        // reached as the reader reaches it
        el.focus();
        if (document.activeElement !== el) el.scrollIntoView({ block: 'nearest' });
        const q = el.getBoundingClientRect();
        if (bajoBarra(q) || q.top < 0 || q.bottom > innerHeight) {
          quedan.push(`${sel} (tapado aun al llegar a él)`);
          continue;
        }
        const otra = await a.run({ include: [[sel]] }, { runOnly: { type: 'rule', values: ['target-size'] }, resultTypes: ['violations'] });
        if (otra.violations.length) quedan.push(`${sel} (también a la vista)`);
      }
      if (quedan.length) salida.push(`${v.id}: ${quedan.join(', ')}`);
    }
    // (back where the walker left the card)
    foco?.focus?.({ preventScroll: true });
    scrollTo(x0, y0);
    return salida;
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

type MandoT = NonNullable<Tarjeta['widget']>['mandos'][number];
const selMando = (v: string) => `[data-mando11="${v}"] [role="slider"]`;

/**
 * The first positions of the card's controls (every combination, the first control turning fastest) at which `ok`
 * holds for the values `v`: a challenge's solution, a design that also passes with its tolerances, a tuning inside
 * its band (motor12e: every control of the card, not only the first).
 */
function buscarPosiciones(mandos: readonly MandoT[], estado: Valores, ok: (v: Valores) => boolean): number[] | null {
  const idx = mandos.map(() => 0);
  const total = mandos.reduce((a, m) => a * m.valores.length, 1);
  for (let n = 0; n < total; n++) {
    const v: Valores = { ...estado };
    mandos.forEach((m, j) => (v[m.valor] = m.valores[idx[j]!]!));
    if (ok(v)) return [...idx];
    for (let j = 0; j < idx.length; j++) {
      idx[j]!++;
      if (idx[j]! < mandos[j]!.valores.length) break;
      idx[j] = 0;
    }
  }
  return null;
}

/** Puts the controls at those positions as the reader does: sliders with the keyboard, a switch clicked if needed. */
async function ponerMandos(page: Page, mandos: readonly MandoT[], sol: number[], mios: Valores) {
  for (const [j, m] of mandos.entries()) {
    if (m.tipo === 'deslizador') await aPosicion(page, selMando(m.valor), sol[j]!);
    else if ((mios[m.valor] ?? 0) !== m.valores[sol[j]!]) await page.locator(`[data-mando11="${m.valor}"] button, [data-conectar="${m.valor}"], [data-interruptor="${m.valor}"]`).first().click();
    mios[m.valor] = m.valores[sol[j]!]!;
  }
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

// ------------------------------------------------------------------ 1.2 «figura» and «logica» (GUIA §11; autor-digital-A)

const widgetDigital = (t: Tarjeta) => (t.widget?.tipo === 'figura' || t.widget?.tipo === 'logica' ? (t.widget as unknown as WidgetFigura | WidgetLogica) : null);
const DIGITALES = ['tocar', 'tabla', 'averia-logica', 'diseno-logico', 'dibujar-digital'];
const esPasoDigital = (a: { tipo: string } | undefined): a is ActividadDigital => !!a && DIGITALES.includes(a.tipo);

/** An explore card on a figure or a logic circuit: touch the zones, flip the switches, pulse the clock, move the cursor. */
async function explorarDigital(page: Page, t: Tarjeta, w: WidgetFigura | WidgetLogica, donde: string) {
  await expect(boton(page), donde).toBeDisabled();
  const todos = w.tipo === 'figura' ? w.zonas.map((z) => z.id) : w.cronograma ? ['tramo'] : w.circuito.entradas.map((e) => e.id);
  const ids = t.requiere!.mover.length ? t.requiere!.mover : todos.slice(0, Math.max(1, t.requiere!.minimo));
  for (const id of ids) {
    if (w.tipo === 'figura') await page.locator(`[data-boton-zona="${id}"]`).click();
    else if (id === 'tramo') {
      await page.locator('[data-tramo]').focus();
      await page.keyboard.press('ArrowRight');
    } else if (w.circuito.entradas.find((e) => e.id === id)?.reloj) await page.locator('[data-pulso]').click();
    else await page.locator(`[data-boton-entrada="${id}"]`).click();
  }
}

/**
 * A circuit of `n` gates of the allowed types that gives `objetivo` (the truth table column, binary order of the
 * inputs): a depth-first search over every circuit of exactly `n` gates, each reading the inputs or earlier gates
 * (the generator proved that none smaller exists). Gates as [type, inputs]; signals by name (inputs, p1, p2…).
 */
function disenar(objetivo: number[], entradas: string[], permitidas: string[], n: number): [string, string[]][] | null {
  const filas = objetivo.length;
  const todo = (1 << filas) - 1;
  const meta = objetivo.reduce((m, v, r) => m | (v << r), 0);
  const col = entradas.map((_, k) => Array.from({ length: filas }, (_, r) => ((r >> (entradas.length - 1 - k)) & 1) << r).reduce((a, b) => a | b, 0));
  const op = (tp: string, a: number, b: number) =>
    ({ and: a & b, or: a | b, nand: todo & ~(a & b), nor: todo & ~(a | b), xor: a ^ b, xnor: todo & ~(a ^ b), not: todo & ~a, buf: a })[tp]!;
  const nombres = [...entradas];
  const valores = [...col];
  const elegidas: [string, string[]][] = [];
  const buscar = (k: number): boolean => {
    if (k === n) return valores[valores.length - 1] === meta;
    const m = valores.length;
    for (const tp of permitidas) {
      const uno = tp === 'not' || tp === 'buf';
      for (let i = 0; i < m; i++)
        for (let j = uno ? i : i; j < (uno ? i + 1 : m); j++) {
          valores.push(op(tp, valores[i]!, valores[j]!));
          nombres.push(`p${k + 1}`);
          elegidas.push([tp, uno ? [nombres[i]!] : [nombres[i]!, nombres[j]!]]);
          if (buscar(k + 1)) return true;
          valores.pop();
          nombres.pop();
          elegidas.pop();
        }
    }
    return false;
  };
  return buscar(0) ? elegidas : null;
}

/** A zone of a figure touched from its list (the keyboard and screen reader way; the drawing is tapped in lecciones13-motor-navegador). */
async function tocarZonaFigura(page: Page, id: string) {
  await page.locator(`[data-boton-zona="${id}"]`).click();
}

/** The 1.2 steps on a figure or a logic circuit, each wrong first (explained) and then right, as the reader does. */
async function pasoDigital(page: Page, t: Tarjeta, a: ActividadDigital, donde: string) {
  if (a.tipo === 'tocar' && a.orden) {
    // (1.2.1) an ordered touch: the second one first (said, and taken back), then all of them in their order
    await page.locator(`[data-boton-zona="${a.bien[1]}"]`).click();
    await comprobarYVer(page, false);
    for (const z of a.bien) await page.locator(`[data-boton-zona="${z}"]`).click();
    await expect(page.locator(`[data-boton-zona="${a.bien[a.bien.length - 1]}"] [data-orden-zona]`), donde).toHaveText(String(a.bien.length));
    await comprobarYVer(page, true, plano(t.exito));
  } else if (a.tipo === 'tocar') {
    // a wrong zone (its own explanation, crossed out), then the right one(s) from the list of zones
    const mal = (t.widget as unknown as WidgetFigura).zonas.find((z) => !a.bien.includes(z.id))!;
    await page.locator(`[data-boton-zona="${mal.id}"]`).click();
    await comprobarYVer(page, false, plano(a.porque[mal.id]));
    await expect(page.locator(`[data-zona="${mal.id}"]`), donde).toHaveAttribute('data-estado', 'mal');
    for (const z of a.todas ? a.bien : a.bien.slice(0, 1)) await page.locator(`[data-boton-zona="${z}"]`).click();
    await comprobarYVer(page, true, plano(t.exito));
  } else if (a.tipo === 'tabla') {
    // every cell (a press gives 0, a second one 1), the first row wrong: marked; then put right
    const pulsar = async (r: number, c: number, veces: number) => {
      for (let i = 0; i < veces; i++) await page.locator(`[data-celda="${r}-${c}"]`).click();
    };
    for (const [r, fila] of a.esperado.entries()) for (const [c, v] of fila.entries()) await pulsar(r, c, (r === 0 ? 1 - v : v) ? 2 : 1);
    await comprobarYVer(page, false);
    await expect(page.locator('[data-tabla-verdad] tr.mal'), donde).toHaveCount(1);
    for (const c of a.esperado[0]!.keys()) await pulsar(0, c, 1);
    await comprobarYVer(page, true, plano(t.exito));
  } else if (a.tipo === 'averia-logica') {
    // (eleccion «fija»: the first round is the first fault) one reading with the probe, a wrong suspect (explained
    // from the readings), then the right piece
    expect(a.eleccion, `${donde}: el recorrido sabe la avería de la primera ronda solo con «eleccion: fija»`).toBe('fija');
    const f = a.fallos[0]!;
    await page.locator('[data-punto]').selectOption(a.puntos[0]!.id);
    await page.locator('[data-medir]').click();
    await expect(page.locator('[data-medidas] li'), donde).toHaveCount(1);
    const otro = a.sospechosos.find((s) => s.id !== f.pieza)!;
    await page.locator(`[data-sospechoso="${otro.id}"]`).click();
    if (a.preguntarTipo) await page.locator(`[data-tipo-averia="${f.tipo}"]`).click();
    await comprobarYVer(page, false);
    await page.locator(`[data-sospechoso="${f.pieza}"]`).click();
    if (a.preguntarTipo) await page.locator(`[data-tipo-averia="${f.tipo}"]`).click();
    await comprobarYVer(page, true);
  } else if (a.tipo === 'diseno-logico') {
    // the LED on an input first (wrong: the row it fails is said), then a circuit with the fewest gates
    const w = t.widget as unknown as WidgetLogica;
    const ent = w.circuito.entradas.filter((e) => !e.reloj).map((e) => e.id);
    const sol = disenar(a.objetivo, ent, a.permitidas, a.minimo);
    expect(sol, `${donde}: hay un diseño de ${a.minimo} puertas`).not.toBeNull();
    for (const [k, [tp, es]] of sol!.entries()) {
      await page.locator('[data-anadir-puerta]').click();
      const p = page.locator(`[data-puerta="${k + 1}"]`);
      await p.locator('[data-tipo-puerta]').selectOption(tp);
      for (const [i, s] of es.entries()) await p.locator(`[data-entrada-puerta="${i + 1}"]`).selectOption(s);
      if (k === 0) {
        await page.locator('[data-salida-diseno]').selectOption(ent[0]!);
        await comprobarYVer(page, false);
      }
    }
    await page.locator('[data-salida-diseno]').selectOption(`p${sol!.length}`);
    await comprobarYVer(page, true, plano(t.exito));
  } else if (a.tipo === 'dibujar-digital') {
    // every slot inverted (all marked), then the right levels with the keyboard
    const d = page.locator('[data-dibujo-digital]');
    for (const [pasada, bien] of [[0, false], [1, true]] as const) {
      await d.focus();
      await page.keyboard.press('Home');
      for (const v of a.esperado) {
        await page.keyboard.press((bien ? v : 1 - v) ? 'ArrowUp' : 'ArrowDown');
        await page.keyboard.press('ArrowRight');
      }
      await comprobarYVer(page, bien, pasada && bien ? plano(t.exito) : undefined);
    }
    await expect(page.locator('[data-onda-correcta]'), donde).toBeVisible();
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
  // (a hidden logic circuit has no reading: its LEDs say «?», autor-digital-A)
  if (t.widget?.ocultar && t.widget.tipo === 'logica') await expect(page.locator('[data-led]').first(), donde).toHaveAttribute('data-encendido', 'oculto');
  else if (t.widget?.ocultar) {
    // (motor12e: a graph's hidden curves say so in the plot; a widget without a reading may hide only those)
    const g = t.widget.tipo === 'grafica' ? t.widget : t.widget.tipo === 'circuito' ? t.widget.grafica : undefined;
    if (g?.curvas.some((c) => c.oculta) || g?.marcas?.some((m) => m.oculta)) await expect(page.locator('[data-curva-oculta]').first(), donde).toBeVisible();
    if (t.widget.lectura || !g) await expect(page.locator('[data-lectura]').first(), donde).toContainText('¿?');
  }

  const w12 = widgetDigital(t);
  // (motor121: a goal on a logic circuit is reached from power-on below: nothing is touched before; motor13: nor a
  // goal of zones on a figure)
  if (t.requiere && w12 && !t.objetivo) await explorarDigital(page, t, w12, donde);
  else if (t.requiere) {
    // explore: touch every control it asks for and leave it where it was (a step there and back)
    await expect(boton(page), donde).toBeDisabled();
    // (esquemas12: what the card leaves free to touch — its sliders first, then its switches when it has fewer sliders
    // than it asks to move: a card whose only control is a switch, «neutro cortado» of cap24, was never opened)
    const tocables = [...mandos.filter((m) => m.tipo === 'deslizador'), ...mandos.filter((m) => m.tipo === 'interruptor')];
    const mover = t.requiere.mover.length ? t.requiere.mover : tocables.slice(0, t.requiere.minimo).map((m) => m.valor);
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

  // 1.2.1: a goal on an explore or surprise card (an «ajuste» with one is solved below, band and goal together): the
  // first positions of its controls that reach it, put with the keyboard; the card says «¡Conseguido!»
  if (t.objetivo && t.widget?.tipo === 'logica') {
    // (motor121: a goal on a logic circuit — the shortest way there, switch by switch and pulse by pulse)
    const { buscarObjetivo } = await import('../src/lib/leccion12/digital/objetivo-logico.ts');
    const b = buscarObjetivo(t.widget.circuito, t.objetivo.condiciones);
    expect(b.camino, `${donde}: el objetivo del circuito lógico se alcanza`).not.toBeNull();
    for (const paso of b.camino!) await page.locator(paso.tipo === 'pulso' ? '[data-pulso]' : `[data-boton-entrada="${paso.id}"]`).click();
    await expect(page.locator('[data-objetivo]'), donde).toHaveAttribute('data-objetivo', 'logrado');
    await expect(aviso(page), donde).toHaveAttribute('data-veredicto', 'bien');
  } else if (t.objetivo && t.widget?.tipo === 'figura') {
    // (motor13: a goal of zones on a figure — in order, the last zone first, which does not count and the advice
    // names the first; then every zone of the goal, in its order, tapped on the picture)
    const { zonasDelObjetivo } = await import('../src/lib/leccion12/digital/objetivo-figura.ts');
    const zonas = zonasDelObjetivo(t.objetivo);
    expect(zonas.length, `${donde}: el objetivo pide tocar zonas`).toBeGreaterThan(0);
    await expect(boton(page), donde).toBeDisabled();
    if (t.objetivo.orden) {
      await tocarZonaFigura(page, zonas[zonas.length - 1]!);
      await expect(page.locator(`[data-objetivo-condicion="${zonas.length - 1}"]`), donde).toHaveAttribute('data-cumple', 'no');
      await expect(page.locator('[data-consejo-objetivo]'), donde).toBeVisible();
    }
    for (const id of zonas) await tocarZonaFigura(page, id);
    await expect(page.locator('[data-objetivo]'), donde).toHaveAttribute('data-objetivo', 'logrado');
    await expect(aviso(page), donde).toHaveAttribute('data-veredicto', 'bien');
  } else if (t.objetivo && t.actividad?.tipo !== 'ajuste') {
    const sol = buscarPosiciones(mandos, estado, (v) => objetivoCumplido(t, mc.evaluar(v)));
    expect(sol, `${donde}: el objetivo se alcanza`).not.toBeNull();
    await ponerMandos(page, mandos, sol!, mios);
    await expect(page.locator('[data-objetivo]'), donde).toHaveAttribute('data-objetivo', 'logrado');
    await expect(aviso(page), donde).toHaveAttribute('data-veredicto', 'bien');
  }

  // 1.2 learning-by-doing steps (lib/leccion12): the ones lessons use so far, each driven as the reader does
  const act = t.actividad;
  if (act?.tipo === 'medir') {
    // a wrong placement first (from the panel's selects: explained), then the right one tapped on the drawing
    const ins = (t.widget as { instrumento: Instrumento }).instrumento;
    await expect(boton(page), donde).toBeDisabled();
    if (act.magnitud === 'corriente') {
      if ((await page.locator('[data-modo="A"]').count()) && (await page.locator('[data-instrumento]').getAttribute('data-modo-actual')) !== 'A') await page.locator('[data-modo="A"]').click();
      const otra = ins.ramas.find((b) => b.id !== act.rama);
      if (otra) {
        await page.locator('[data-rama-amperimetro]').selectOption(otra.id);
        await comprobarYVer(page, false, act.porque[otra.id] ? plano(act.porque[otra.id]) : undefined);
      }
      await page.locator(`[data-diana="${act.rama}"]`).click();
    } else if (act.magnitud === 'senal') {
      const otro = ins.puntos.find((p) => p.id !== act.punto);
      if (otro) {
        await page.locator('[data-sonda-osciloscopio]').selectOption(otro.id);
        await expect(page.locator('[data-grafica] path.curva'), donde).toHaveCount(1);
        await comprobarYVer(page, false, act.porque[otro.id] ? plano(act.porque[otro.id]) : undefined);
      }
      await page.locator(`[data-diana="${act.punto}"]`).click();
      await expect(page.locator('[data-sonda-en]'), donde).toBeVisible();
    } else {
      if ((await page.locator('[data-modo="V"]').count()) && (await page.locator('[data-instrumento]').getAttribute('data-modo-actual')) !== 'V') await page.locator('[data-modo="V"]').click();
      const [roja, negra] = act.entre!;
      const otro = ins.puntos.find((p) => p.id !== roja && p.id !== negra);
      if (otro) {
        await page.locator('[data-punta-roja]').selectOption(otro.id);
        await page.locator('[data-punta-negra]').selectOption(negra);
        await comprobarYVer(page, false);
      }
      // (the black probe from the panel, which leaves the red one next; the red one tapped on the drawing)
      await page.locator('[data-punta-negra]').selectOption(negra);
      await page.locator(`[data-diana="${roja}"]`).click();
      await expect(page.locator('[data-punta-roja]'), donde).toHaveValue(roja);
      await expect(page.locator('[data-punta-negra]'), donde).toHaveValue(negra);
      await expect(page.locator('[data-display-instrumento]'), donde).not.toHaveText('—');
    }
    await comprobarYVer(page, true, plano(t.exito));
  } else if (act?.tipo === 'elegir') {
    // a wrong zone from the list (its explanation, crossed out), then the right one(s) tapped on the drawing
    const mal = act.zonas.find((z) => !act.bien.includes(z.id))!;
    await page.locator(`[data-boton-zona-esquema="${mal.id}"]`).click();
    await comprobarYVer(page, false, plano(act.porque[mal.id]));
    await expect(page.locator(`[data-boton-zona-esquema="${mal.id}"]`), donde).toHaveAttribute('data-estado', 'mal');
    for (const z of act.todas ? act.bien : act.bien.slice(0, 1)) await page.locator(`[data-diana="${z}"]`).click();
    await comprobarYVer(page, true, plano(t.exito));
    await expect(page.locator(`[data-diana="${act.bien[0]}"]`), donde).toHaveAttribute('data-diana-estado', 'bien');
  } else if (act?.tipo === 'marcar' && act.cronograma) {
    // (motor121) the timing diagram's cursor: a wrong cycle first (its explanation), then the right one
    const ir = async (ciclo: number) =>
      page.locator('[data-tramo]').evaluate((el, v) => {
        const n = el as HTMLInputElement;
        n.value = String(v);
        n.dispatchEvent(new Event('input', { bubbles: true }));
      }, 2 * (ciclo - 1));
    await expect(boton(page), donde).toBeDisabled();
    const mal = Number(Object.keys(act.cronograma.porque)[0] ?? (act.cronograma.ciclo > 1 ? act.cronograma.ciclo - 1 : act.cronograma.ciclo + 1));
    await ir(mal);
    await comprobarYVer(page, false, act.cronograma.porque[String(mal)] ? plano(act.cronograma.porque[String(mal)]) : undefined);
    await ir(act.cronograma.ciclo);
    await expect(page.locator('[data-ciclo-marcado]'), donde).toHaveAttribute('data-ciclo-marcado', String(act.cronograma.ciclo));
    await comprobarYVer(page, true, plano(t.exito));
  } else if (act?.tipo === 'marcar') {
    // the marker with the keyboard's sliders: a wrong place first (where it says which way), then a right one
    const g = graficaDe(t)!;
    const r = mc.evaluar(estado);
    const xs = act.modo === 'y' ? [act.inicio.x] : posicionesMarca(g.x, act.pasos);
    const ys = act.modo === 'x' ? [act.inicio.y] : posicionesMarca(g.y, act.pasos);
    let bien: [number, number] | null = null;
    let mal: [number, number] | null = null;
    for (const [i, x] of xs.entries())
      for (const [j, y] of ys.entries()) {
        const ok = marcaBien(mc, g, act, r, { x, y });
        if (ok && !bien) bien = [i, j];
        if (!ok && !mal && (x !== act.inicio.x || y !== act.inicio.y)) mal = [i, j];
      }
    expect(bien, `${donde}: alguna posición de la marca es la buena`).not.toBeNull();
    const poner = async ([i, j]: [number, number]) => {
      for (const [sel, k] of [['[data-marcador-x]', i], ['[data-marcador-y]', j]] as const) {
        if (!(await page.locator(sel).count())) continue;
        await page.locator(sel).evaluate((el, v) => {
          const n = el as HTMLInputElement;
          n.value = String(v);
          n.dispatchEvent(new Event('input', { bubbles: true }));
        }, k);
      }
    };
    await expect(boton(page), donde).toBeDisabled();
    if (mal) {
      await poner(mal);
      await comprobarYVer(page, false);
    }
    await poner(bien!);
    await comprobarYVer(page, true, plano(t.exito));
    await expect(page.locator('[data-meta-marca]'), donde).toBeVisible();
  } else if (act?.tipo === 'leer' && act.base) {
    // (motor121) a whole number in hexadecimal or binary: the bits reversed first (explained), then right
    const { escribirEntero } = await import('../src/lib/leccion12/hacer/motor-hacer.ts');
    const obj = Math.round(mc.funcion(act.objetivo)(mc.evaluar(estado)));
    const rev = parseInt(obj.toString(2).padStart(act.cifras, '0').split('').reverse().join(''), 2);
    await expect(boton(page), donde).toBeDisabled();
    await page.locator('[data-valor-leido]').fill(escribirEntero(rev === obj ? obj + 1 : rev, act.base, act.cifras));
    await comprobarYVer(page, false);
    await page.locator('[data-valor-leido]').fill(escribirEntero(obj, act.base, act.cifras));
    await comprobarYVer(page, true, plano(t.exito));
  } else if (act?.tipo === 'leer') {
    // a slip of a prefix first (a thousand times too much: explained), then the value with its unit
    const obj = mc.funcion(act.objetivo)(mc.evaluar(estado));
    // (motor121, autor121-digital: as many figures as the card's tolerance needs — 29 780,67 with tol 5·10⁻⁶ —, at
    // least four)
    let fig = 4;
    while (fig < 15 && Math.abs(Number(obj.toPrecision(fig)) - obj) > (act.tol / 2) * Math.abs(obj)) fig++;
    const escrito = (x: number) => `${String(Number(x.toPrecision(fig))).replace('.', ',')} ${act.unidad}`;
    await expect(boton(page), donde).toBeDisabled();
    await page.locator('[data-valor-leido]').fill(escrito(obj * 1000));
    await comprobarYVer(page, false);
    await page.locator('[data-valor-leido]').fill(escrito(obj));
    await comprobarYVer(page, true, plano(t.exito));
  } else if (esPasoDigital(act)) {
    await pasoDigital(page, t, act, donde);
  } else if (act?.tipo === 'simular') {
    // the right estimate, written as the reader writes it («5 V», «8,1 V»); then the app's own ngspice answers
    const obj = mc.funcion(act.objetivo)(mc.evaluar(estado));
    await expect(boton(page), donde).toBeDisabled();
    let fig = 4;
    while (fig < 15 && Math.abs(Number(obj.toPrecision(fig)) - obj) > (act.tol / 2) * Math.abs(obj)) fig++;
    await page.locator('[data-estimacion]').fill(`${String(Number(obj.toPrecision(fig))).replace('.', ',')} ${act.unidad}`);
    await boton(page).click();
    await expect(aviso(page), donde).toHaveAttribute('data-veredicto', 'bien');
    await expect(page.locator('[data-simulado]'), donde).not.toBeEmpty({ timeout: 30_000 });
  } else if (act?.tipo === 'banco') {
    // optional: «Continuar» is open from the start; the expected reading itself compares within tolerance
    await expect(boton(page), donde).toBeEnabled();
    const esp = mc.funcion(act.esperado)(mc.evaluar(estado));
    await page.locator('[data-medida-banco]').fill(String(Number(esp.toPrecision(4))).replace('.', ','));
    await page.locator('[data-comparar]').click();
    await expect(page.locator('[data-comparacion]'), donde).toHaveAttribute('data-comparacion', 'bien');
  } else if (act?.tipo === 'ajuste') {
    // the first positions of the controls (all of them: a two-control tuning, motor12e) the model puts inside the
    // band — open on one side or closed —, reached with the keyboard
    // (1.2.1: with its goal too, if it has one)
    const sol = buscarPosiciones(mandos, estado, (v) => enRango(act.banda, mc.evaluar(v)) && (!t.objetivo || objetivoCumplido(t, mc.evaluar(v))));
    expect(sol, `${donde}: el ajuste tiene una posición dentro`).not.toBeNull();
    await expect(boton(page), donde).toBeDisabled();
    await ponerMandos(page, mandos, sol!, mios);
    await expect(page.locator('[data-ajuste]'), donde).toHaveAttribute('data-lado', 'dentro');
  } else if (act?.tipo === 'dibujar') {
    // the right curve, point by point with the keyboard's controls (the value slider of each point, then «▶»)
    const r = mc.evaluar(estado);
    const fc = mc.funcion(act.curva);
    for (let k = 0; k < act.puntos; k++) {
      // points are evenly spaced in log x on a logarithmic axis (GUIA §10.7), linearly otherwise
      const x = act.x.escala === 'log'
        ? act.x.min * Math.pow(act.x.max / act.x.min, k / (act.puntos - 1))
        : act.x.min + ((act.x.max - act.x.min) * k) / (act.puntos - 1);
      const y = Math.min(act.y.max, Math.max(act.y.min, fc({ ...r, [act.x.id]: x })));
      await page.locator('[data-valor-punto]').evaluate((el, v) => {
        const i = el as HTMLInputElement;
        i.value = String(v);
        i.dispatchEvent(new Event('input', { bubbles: true }));
      }, y);
      if (k < act.puntos - 1) await page.locator('[data-punto-siguiente]').click();
    }
    await expect(boton(page), donde).toHaveAttribute('data-accion', 'comprobar');
    await boton(page).click();
    await expect(aviso(page), donde).toHaveAttribute('data-veredicto', 'bien');
  } else if (act?.tipo === 'averia') {
    // measured at every probe it allows, then a wrong suspect (explained from those measurements) and the right one.
    // Which board is shown: «fija», the first fault of the list (lib/leccion12/averia.ts falloDeRonda); «azar», a fresh
    // draw each time the card opens (motor12e, autor-potencia-C), so the walker works it out as the reader does —
    // the faults whose readings are what the meter shows at each probe (lib/leccion12/averia.ts lecturas).
    let posibles = act.eleccion === 'fija' ? [falloDeRonda(act, t.id, 0)] : act.fallos.map((_, i) => i);
    for (const s of act.sondas.slice(0, act.pasos)) {
      await page.locator(`[data-sonda="${s.id}"]`).click();
      await expect(page.locator(`[data-sonda="${s.id}"]`), donde).toHaveAttribute('aria-pressed', 'true');
      const leido = ((await page.locator('[data-lectura-multimetro]').textContent()) ?? '').trim();
      const mag = mc.magnitud(s.valor);
      const igual = posibles.filter((i) => formatear(mag, lecturas(mc, act, estado, act.fallos[i]!)[s.id]) === leido);
      expect(igual.length, `${donde}: la lectura «${leido}» en «${s.id}» es la de alguna avería`).toBeGreaterThan(0);
      posibles = igual;
    }
    // what the reader names: the part (and its kind of fault, if asked); faults that still read alike are candidates
    const nombre = (i: number) => `${act.fallos[i]!.pieza}${act.preguntarTipo ? `/${act.fallos[i]!.tipo}` : ''}`;
    const candidatos = [...new Map(posibles.map((i) => [nombre(i), i])).values()];
    expect(candidatos.length, `${donde}: con ${act.pasos} medidas quedan como mucho dos averías posibles`).toBeLessThanOrEqual(2);
    const nombrar = async (i: number) => {
      const f = act.fallos[i]!;
      await page.locator(`[data-sospechoso="${f.pieza}"]`).click();
      if (act.preguntarTipo) await page.locator(`[data-tipo-averia="${f.tipo}"]`).click();
    };
    const otro = act.sospechosos.find((s) => !posibles.some((i) => act.fallos[i]!.pieza === s.id));
    if (candidatos.length === 1 && otro) {
      await page.locator(`[data-sospechoso="${otro.id}"]`).click();
      if (act.preguntarTipo) await page.locator('[data-tipo-averia]').first().click();
      await comprobarYVer(page, false);
    }
    // (two boards that read alike: the first guess may be wrong — explained — and the second is then the one)
    for (const [n, i] of candidatos.entries()) {
      await nombrar(i);
      await expect(boton(page), donde).toHaveAttribute('data-accion', 'comprobar');
      await boton(page).click();
      await expect(aviso(page), donde).toHaveAttribute('data-veredicto', /^(bien|mal)$/);
      const v = await aviso(page).getAttribute('data-veredicto');
      if (v === 'bien' || n === candidatos.length - 1) {
        await expect(aviso(page), donde).toHaveAttribute('data-veredicto', 'bien');
        break;
      }
      await expect(boton(page), donde).toHaveAttribute('data-accion', 'reintentar');
      await boton(page).click();
    }
  } else if (act?.tipo === 'sql') {
    // the reference query as the reader would give it (written whole; a fill-in card gets its blanks back by matching
    // the template against the solution; an order card is put right with «Subir»), run in the app's SQLite worker and
    // checked against the expected result
    if (act.modo === 'ordenar') {
      const n = act.clausulas!.length;
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < n; k++) {
          if ((await page.locator('[data-ordenar] li').nth(i).getAttribute('data-elemento')) === String(i)) break;
          await page.locator(`[data-subir="${i}"]`).click();
        }
      }
    } else if (act.modo === 'rellenar') {
      const plantilla = act.plantilla!;
      const trozos = plantilla.split(/\[\[\d+\]\]/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const m = new RegExp(`^${trozos.join('([\\s\\S]*?)')}$`).exec(act.solucion);
      expect(m, `${donde}: la solución encaja en la plantilla`).not.toBeNull();
      const huecos = [...plantilla.matchAll(/\[\[(\d+)\]\]/g)].map((x) => Number(x[1]) - 1);
      for (const [j, h] of huecos.entries()) {
        const campo = page.locator(`[data-sql] [data-hueco="${h}"]`);
        if (act.huecos?.[h]?.opciones) await campo.selectOption(m![j + 1]!);
        else await campo.fill(m![j + 1]!);
      }
    } else {
      await page.locator('[data-editor-sql]').fill(act.solucion);
    }
    await page.locator('[data-ejecutar]').click();
    await expect(page.locator('[data-salida-sql] [data-filas]'), donde).toHaveAttribute('data-filas', String(act.esperado.filas.length), { timeout: 30_000 });
    await expect(boton(page), donde).toHaveAttribute('data-accion', 'comprobar');
    await boton(page).click();
    await expect(aviso(page), donde).toHaveAttribute('data-veredicto', 'bien');
  } else if (t.opciones) {
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
    // a wrong estimate first: the position farthest from the target that is not where the slider starts (an estimate
    // whose «inicio» is that far end was never moved, so «Comprobar» stayed disabled: esquemas12, cap24 «timbre»)
    const k0 = posicionMasCercana(pos, est.inicio);
    const mal = pos
      .map((p, k) => ({ k, d: Math.abs(p - obj) }))
      .filter(({ k }) => k !== k0 && !puntuarEstimacion(pos[k]!, obj, est.tol).bien)
      .sort((a, b) => b.d - a.d)[0];
    expect(mal, `${donde}: la estimación tiene una posición equivocada que no es la inicial`).toBeTruthy();
    // (from the nearer end: Home or End, then the arrows)
    await page.locator(s).focus();
    const atras = pos.length - 1 - mal!.k;
    await page.keyboard.press(mal!.k <= atras ? 'Home' : 'End');
    for (let i = 0; i < Math.min(mal!.k, atras); i++) await page.keyboard.press(mal!.k <= atras ? 'ArrowRight' : 'ArrowLeft');
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
    // the challenge: wrong as it starts (a hint), then a solution the model finds among the controls' positions — for
    // a «diseno», one that also passes with the parts' tolerances, as the app checks it (corners or Monte Carlo:
    // lib/leccion12/tolerancias.ts; motor12e, autor-digital-E, autor-potencia-A, autor-senales-C), not merely the
    // first nominal one
    await comprobarYVer(page, false);
    const conds = t.condiciones;
    const cumple = act?.tipo === 'diseno' ? (v: Valores) => analizarDiseno(mc, act, conds, v).pasa : (v: Valores) => conds.every((c) => enRango(c, mc.evaluar(v)));
    const sol = buscarPosiciones(mandos, estado, cumple);
    expect(sol, `${donde}: el reto tiene solución`).not.toBeNull();
    await ponerMandos(page, mandos, sol!, mios);
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
    // 1.2: the cards missed at their first check (here, every question: each is answered wrong first) come back once
    // before the summary (lib/leccion12/ritmo.ts), from the values they had when first shown
    const entrada: Valores[] = [];
    for (const [k, t] of l.tarjetas.entries()) {
      if (t.tipo === 'resumen') {
        for (let vuelta = 0; vuelta < l.tarjetas.length; vuelta++) {
          await expect(page.locator('[data-leccion11][data-vuelta] [data-tarjeta], [data-resumen]').first()).toBeVisible();
          if (!(await page.locator('[data-leccion11][data-vuelta]').count())) break;
          const j = Number(await page.locator('[data-leccion11]').getAttribute('data-tarjeta-n'));
          await recorrerTarjeta(page, l, l.tarjetas[j]!, j, entrada[j]!);
        }
      }
      entrada[k] = propios;
      propios = await recorrerTarjeta(page, l, t, k, propios);
    }
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
