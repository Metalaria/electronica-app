// Motor fixes 1.1: the predictions, questions and challenges of the hand-authored lessons are items of «Práctica
// inteligente» and of a section's spaced review (#/practicar/<parte>/<label>), as the 1.0 lesson items are. In Node:
// which cards are practicable and the published index lists exactly those, the state a card is asked in (the one
// the generator checked), the catalogue's items and their ids (the lesson's own answer ids), the practicable
// sections. In the browser: a section that had nothing of 1.0 to answer is practised with its lesson's cards, a
// wrong and a right check, the mastery rounds and the XP under the lesson's id (once, also when the lesson answers
// the same card afterwards).
//   EPA_DIST=… EPA_PUERTO=… PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones11-practica.spec.ts
// (EPA_SIN_SERVIDOR=1 and -g "sin navegador" for the Node part alone)
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { compilarModelo, enRango } from '../src/lib/leccion11/modelo.ts';
import { entradaIndice, esPracticable, eventoDeComprobacion, idRespuesta, nuevoEstado, comprobar, valoresSueltos } from '../src/lib/leccion11/motor.ts';
import { completar, type ItemCatalogo } from '../src/lib/aprendizaje/seleccion.ts';
import type { IndiceLecciones11, Leccion11 } from '../src/lib/leccion11/tipos.ts';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libro = path.join(web, 'public', 'libro');
const leer = <T>(r: string): T => JSON.parse(fs.readFileSync(path.join(libro, r), 'utf8')) as T;
const INDICE = leer<IndiceLecciones11>('lecciones11/indice.json');
const leccion = (id: string) => leer<Leccion11>(`lecciones11/${id}.json`);
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

test.describe('práctica con las lecciones 1.1 (sin navegador)', () => {
  test('practicables: predecir, pregunta y reto; nunca explorar, fórmula, sorpresa, por qué ni resumen', () => {
    const l = leccion('cap01/sec-1.4');
    const tipos = new Set(l.tarjetas.filter(esPracticable).map((t) => t.tipo));
    expect([...tipos].sort()).toEqual(['predecir', 'pregunta', 'reto']);
    for (const t of l.tarjetas) if (['explorar', 'formula', 'sorpresa', 'porque', 'resumen'].includes(t.tipo)) expect(esPracticable(t), t.id).toBe(false);
  });

  test('el índice publicado lista, de cada lección, sus tarjetas practicables (al día con cada lección)', () => {
    let n = 0;
    for (const id of Object.keys(INDICE.lecciones)) {
      const l = leccion(id);
      expect(INDICE.lecciones[id], id).toEqual(entradaIndice(l));
      n += INDICE.lecciones[id]!.preguntas!.length;
    }
    expect(n).toBeGreaterThan(200);
  });

  test('una tarjeta suelta se pregunta en el estado que comprobó el generador: ningún reto empieza resuelto', () => {
    for (const id of Object.keys(INDICE.lecciones)) {
      const l = leccion(id);
      const mc = compilarModelo(l.modelo);
      l.tarjetas.forEach((t, k) => {
        if (!esPracticable(t)) return;
        const v = mc.evaluar({ ...valoresSueltos(l, k), ...t.fijar });
        for (const x of Object.values(v)) expect(Number.isFinite(x), `${id} ${t.id}`).toBe(true);
        if (t.condiciones) expect(t.condiciones.every((c) => enRango(c, v)), `${id} ${t.id} empieza resuelto`).toBe(false);
      });
    }
  });

  test('la respuesta en la práctica va con el id de la lección y origen «inteligente»', () => {
    const l = leccion('cap01/sec-1.4');
    const t = l.tarjetas.find((x) => x.id === 'prediga-salida')!;
    const e0 = { ...nuevoEstado(t), eleccion: t.opciones!.findIndex((o) => o.bien) };
    const { estado } = comprobar(l, t, e0, valoresSueltos(l, l.tarjetas.indexOf(t)));
    const r = eventoDeComprobacion(l, t, e0, estado, 'inteligente')!;
    expect(r.evento).toMatchObject({ id: 'cap01-l11-sec-1.4-prediga-salida', origen: 'inteligente', clase: 'practica', correcta: true, final: true, parte: 'cap01', seccion: 'sec-1.4' });
    expect(r.evento.id).toBe(idRespuesta(l, t));
    // the lesson's own default stays
    expect(eventoDeComprobacion(l, t, e0, estado)!.evento.origen).toBe('leccion');
  });

  test('conceptos.json: toda lección con preguntas es una sección practicable (también las que no tenían nada de la 1.0)', () => {
    const c = leer<{ total: number; partes: Record<string, string[]> }>('conceptos.json');
    for (const [id, e] of Object.entries(INDICE.lecciones)) {
      if (!e.preguntas?.length) continue;
      const [p, label] = [id.slice(0, id.indexOf('/')), id.slice(id.indexOf('/') + 1)];
      expect(c.partes[p], id).toContain(label);
    }
    expect(c.partes.cap02).toContain('sec-2.2');
  });

  test('la selección mezcla las tarjetas de la lección con los ítems de la 1.0, sin repetir ni lo respondido hace poco', () => {
    const items: ItemCatalogo[] = [
      { id: 'cap01-num-sec-1.4-a', tipo: 'practica', subtipo: 'numerico', concepto: 'cap01/sec-1.4' },
      { id: 'cap01-03', tipo: 'pregunta', subtipo: 'opcion', concepto: 'cap01/sec-1.4' },
      ...INDICE.lecciones['cap01/sec-1.4']!.preguntas!.map((q): ItemCatalogo => ({ id: `cap01-l11-sec-1.4-${q.id}`, tipo: 'leccion11', subtipo: `leccion11-${q.tipo}`, concepto: 'cap01/sec-1.4' })),
    ];
    const ahora = Date.UTC(2026, 10, 9, 12);
    const plan = { conceptos: [{ clave: 'cap01/sec-1.4', motivo: 'foco' as const, cupo: 99 }], n: 10 };
    const ultimas = { 'cap01-l11-sec-1.4-reto-33': { t: ahora - 10 * 60_000, p: 100 } };
    const r = completar({ plan, items, ultimas, ahora, semilla: 7 });
    expect(r.length).toBe(8);
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
    expect(r.map((x) => x.id)).not.toContain('cap01-l11-sec-1.4-reto-33');
    expect(r.some((x) => x.tipo === 'leccion11')).toBe(true);
    expect(r.some((x) => x.tipo !== 'leccion11')).toBe(true);
  });
});

// ------------------------------------------------------------------ browser

type Dominio = { items: Record<string, { s: string; c: string; r: [number, number, number?][] }> };
type Xp = { xp: Record<string, { x: number; t: number }> };
const SECCION = 'cap02/sec-2.2';
const ELEGIDAS = ['preamplificador', 'pulsos'];

async function preparar(page: Page, tema = 'claro') {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  // only two option questions of 2.2 are practicable (the session is then fully predictable)
  await page.context().route('**/libro/lecciones11/indice.json', async (r) => {
    const real = (await (await r.fetch()).json()) as IndiceLecciones11;
    const e = real.lecciones[SECCION]!;
    real.lecciones[SECCION] = { ...e, preguntas: e.preguntas!.filter((q) => ELEGIDAS.includes(q.id)) };
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify(real) });
  });
  await page.addInitScript((t) => ((window as unknown as { __tema: string }).__tema = t), tema);
  await page.addInitScript(() => {
    (window as unknown as { __epaSemillaPractica: number }).__epaSemillaPractica = 4242;
    if (sessionStorage.getItem('preparado')) return;
    sessionStorage.setItem('preparado', '1');
    localStorage.clear();
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    localStorage.setItem('epa:prefs', JSON.stringify({ tema: (window as unknown as { __tema: string }).__tema, tam: 18, sonido: false, vibracion: false }));
  });
}
const leerAlmacen = <T,>(page: Page, k: string) => page.evaluate((c) => JSON.parse(localStorage.getItem(`epa:${c}`) ?? 'null'), k) as Promise<T | null>;

test.describe('práctica con las lecciones 1.1', () => {
  test.use({ viewport: { width: 1024, height: 900 } });

  test('una sección sin prácticas de la 1.0 se practica con su lección: dominio y XP con el id de la tarjeta, una vez', async ({ page }) => {
    test.setTimeout(120_000);
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await preparar(page);
    await page.goto(`#/practicar/${SECCION}`);
    await expect(page.locator('[data-sesion]')).toHaveAttribute('data-fase', 'intro', { timeout: 30_000 });
    await page.locator('[data-empezar-sesion]').click();
    const vistos: string[] = [];
    for (let j = 0; j < 12; j++) {
      const fase = await page.locator('[data-sesion]').getAttribute('data-fase');
      if (fase !== 'items') break;
      const cuerpo = page.locator('[data-item]');
      const id = (await cuerpo.getAttribute('data-item'))!;
      if ((await cuerpo.getAttribute('data-item-tipo')) !== 'leccion11') {
        await page.locator('[data-saltar]').click();
        continue;
      }
      vistos.push(id);
      const tarjeta = cuerpo.locator('[data-leccion11-suelta]');
      await expect(tarjeta).toHaveAttribute('data-leccion11-suelta', SECCION);
      const continuar = page.locator('[data-continuar]');
      const boton = tarjeta.locator('[data-comprobar-l11]');
      if (vistos.length === 1) {
        // wrong first: explained, the round stays open (Continuar waits, «Saltar» is there), then right
        await tarjeta.locator('[data-opcion]:not([data-correcta])').first().click();
        await boton.click();
        await expect(tarjeta.locator('[data-veredicto="mal"]')).toBeVisible();
        await expect(continuar).toBeDisabled();
        await expect(boton).toHaveAttribute('data-accion', 'reintentar');
        await boton.click();
      }
      await tarjeta.locator('[data-opcion][data-correcta]').click();
      await boton.click();
      await expect(tarjeta.locator('[data-veredicto="bien"]')).toBeVisible();
      await expect(boton).toHaveCount(0);
      await expect(tarjeta.locator('[data-abrir-leccion11]')).toBeVisible();
      await expect(continuar).toBeEnabled();
      await continuar.click();
    }
    expect([...vistos].sort()).toEqual(ELEGIDAS.map((x) => `cap02-l11-sec-2.2-${x}`).sort());
    await expect(page.locator('[data-fin-sesion]')).toBeVisible();
    await expect(page.locator('[data-fin-sesion]')).toHaveAttribute('data-aciertos', '1');

    const [primera, segunda] = [vistos[0]!, vistos[1]!];
    await expect.poll(async () => Object.keys((await leerAlmacen<Dominio>(page, 'dominio'))?.items ?? {}).filter((k) => k.includes('-l11-')).sort(), { timeout: 15_000 }).toEqual([primera, segunda].sort());
    const d = (await leerAlmacen<Dominio>(page, 'dominio'))!;
    expect(d.items[primera]).toMatchObject({ s: SECCION, c: 'p' });
    expect(d.items[primera]!.r.map((x) => x[1])).toEqual([60]);
    expect(d.items[segunda]!.r.map((x) => x[1])).toEqual([100]);
    await expect.poll(async () => (await leerAlmacen<Xp>(page, 'progreso-xp'))?.xp[`pr:${segunda}`]?.x, { timeout: 15_000 }).toBe(10);
    expect((await leerAlmacen<Xp>(page, 'progreso-xp'))!.xp[`pr:${primera}`]!.x).toBe(5);

    // the same card answered in the lesson right after: the same round (no double counting) and no XP again
    const l = leccion(SECCION);
    const k = l.tarjetas.findIndex((t) => `cap02-l11-sec-2.2-${t.id}` === primera);
    await page.goto(`#/leccion/${SECCION}/${k + 1}`);
    const d0 = page.getByRole('alertdialog');
    if (await d0.isVisible({ timeout: 500 }).catch(() => false)) await d0.getByRole('button', { name: 'Salir' }).click();
    await expect(page.locator('[data-leccion11]')).toHaveAttribute('data-tarjeta-n', String(k));
    await page.locator('[data-tarjeta] [data-opcion][data-correcta]').click();
    await page.locator('[data-continuar][data-accion="comprobar"]').click();
    await expect(page.locator('[data-veredicto="bien"]')).toBeVisible();
    await page.waitForTimeout(1500);
    expect((await leerAlmacen<Dominio>(page, 'dominio'))!.items[primera]).toEqual(d.items[primera]);
    expect((await leerAlmacen<Xp>(page, 'progreso-xp'))!.xp[`pr:${primera}`]!.x).toBe(5);
    expect(errores).toEqual([]);
  });

  test('la tarjeta en la sesión: axe en claro y oscuro (contraste incluido) y sin desplazamiento a 360 px', async ({ browser }) => {
    test.setTimeout(120_000);
    for (const [tema, ancho] of [['claro', 1024], ['oscuro', 360]] as const) {
      const ctx = await browser.newContext({ viewport: { width: ancho, height: 800 } });
      const page = await ctx.newPage();
      await preparar(page, tema);
      await page.goto(`#/practicar/${SECCION}`);
      await page.locator('[data-empezar-sesion]').click();
      for (let j = 0; j < 12 && (await page.locator('[data-item]').getAttribute('data-item-tipo')) !== 'leccion11'; j++) await page.locator('[data-saltar]').click();
      const tarjeta = page.locator('[data-leccion11-suelta]');
      await expect(tarjeta).toBeVisible();
      await tarjeta.locator('[data-opcion]:not([data-correcta])').first().click();
      await tarjeta.locator('[data-comprobar-l11]').click();
      await expect(tarjeta.locator('[data-veredicto="mal"]')).toBeVisible();
      await page.addScriptTag({ path: AXE });
      const fallos = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const x = await axe.run({ include: [['[data-sesion]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
        return x.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      });
      expect(fallos, tema).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), tema).toBeLessThanOrEqual(ancho);
      await ctx.close();
    }
  });
});
