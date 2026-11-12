// fix12 (1.2): three bugs the coordinator found in the UI sample.
//  1. The living circuit drew its particles ON the symbols (resistor zigzags, battery plates, node dots, labels).
//     Now they go only along the wires: in Node, the zones of the book's schematics (figuras-vivas) hide every
//     two-terminal body; in the browser, every lesson schematic (the 1.1 catalogue lesson, one card per schematic, plus
//     the divisor and the parallel circuit of cap01/sec-1.4) at phone size, animated and still (reduced motion): no lit
//     pixel of the particles' canvas falls inside a part's body, a label or a node dot (boxes measured on the drawing,
//     independently of the app's own zones). EPA_HOJA=<folder> also saves a picture of each drawing (the before/after
//     sheet). The owner's point («el cable y el componente se superponían»): no wire of a lesson drawing runs through a
//     part's body or under a label, and in the book's schematics no coloured wire of the live layer crosses a
//     two-terminal body (some figures have a wire along a whole part: its halo is clipped).
//  2. An «averia» card gave its fault away (label «R₂ 1 GΩ», wires coloured by the faulty voltages): until the fault is
//     found the drawing shows the nominal values, no voltages, legend or «Ver valores».
//  3. A course page's title showed a big focus ring after a route change: the heading keeps the focus, no ring.
//   EPA_DIST=… EPA_PUERTO=… PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones12-fix12.spec.ts
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
import { trayecto } from '../src/componentes/figuras-vivas/geometria.ts';
import { cuerposDeDosBornes, fueraDeZonas, posicionesVisibles, tramosOcultos, zonasDeElementos, type Zona } from '../src/componentes/figuras-vivas/esquema/particulas.ts';
import type { Camino } from '../src/componentes/figuras-vivas/esquema/modelo.svelte.ts';
import type { Punto } from '../src/componentes/figuras-vivas/tipos.ts';
import { sqlNode } from '../src/lib/leccion12/sql/node.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
  sql: await sqlNode(),
};
const CAT11 = 'cap01/sec-1.5';
const CAT12 = 'cap01/sec-1.4';
const cat11 = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones11-catalogo', `${CAT11}.yaml`), 'utf8')), contexto, 'catalogo').leccion as Leccion11;
const cat12 = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${CAT12}.yaml`), 'utf8')), contexto, 'catalogo12').leccion as Leccion11;

/** Serves a test lesson in place of the published one of the same id. */
async function servir(ctx: BrowserContext, id: string, leccion: Leccion11) {
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.route('**/libro/lecciones11/indice.json', async (x) => {
    const real = await x.fetch().then((y) => y.json()).catch(() => ({ version: 1, total: 0, lecciones: {} }));
    const lecciones = { ...(real.lecciones ?? {}), [id]: { tarjetas: leccion.tarjetas.length } };
    await x.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, total: Object.keys(lecciones).length, lecciones }) });
  });
  await ctx.route(`**/libro/lecciones11/${id}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(leccion) }));
}
async function preparar(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'claro', tam: 18, sonido: false, vibracion: false }));
    }
  });
}
async function irA(page: Page, id: string, k: number) {
  await page.goto(`#/leccion/${id}/${k + 1}`);
  const d = page.getByRole('alertdialog');
  if (await d.isVisible({ timeout: 300 }).catch(() => false)) await d.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator('[data-leccion11]')).toHaveAttribute('data-tarjeta-n', String(k));
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
}

// ------------------------------------------------------------------------------------------------ 1, in Node
test('figuras vivas: las partículas no se dibujan dentro del cuerpo de una pieza ni sobre un punto de unión', () => {
  const dir = path.join(web, 'public', 'libro', 'datos');
  const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && fs.readFileSync(path.join(dir, f), 'utf8').includes('"istart"'));
  expect(ficheros.length).toBeGreaterThan(5);
  type Elem = { id: string; rol: string; anclas: Record<string, Punto>; caja?: [number, number, number, number] };
  type Esq = { elementos: Elem[]; dibujo_a_svg: { sx: number; sy: number; tx: number; ty: number } };
  const esquemas: Esq[] = [];
  const buscar = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(buscar);
    else if (o && typeof o === 'object') {
      const x = o as Record<string, unknown>;
      if (Array.isArray(x['elementos']) && x['dibujo_a_svg']) esquemas.push(x as unknown as Esq);
      else Object.values(x).forEach(buscar);
    }
  };
  for (const f of ficheros.slice(0, 40)) buscar(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  let cuerpos = 0;
  const fallos: string[] = [];
  for (const esq of esquemas) {
    const A = esq.dibujo_a_svg;
    const P = (p: Punto): Punto => [A.sx * p[0] + A.tx, A.sy * p[1] + A.ty];
    const caja = (c: [number, number, number, number]): [number, number, number, number] => {
      const a = P([c[0], c[1]]);
      const b = P([c[2], c[3]]);
      return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    };
    const zonas = zonasDeElementos(esq.elementos.map((e) => ({ e, caja: e.caja ? caja(e.caja) : null })), P);
    for (const e of esq.elementos) {
      const [s, t, is, ie] = [e.anclas['start'], e.anclas['end'], e.anclas['istart'], e.anclas['iend']];
      if (e.rol === 'WIRE' || !s || !t || !is || !ie || Math.hypot(is[0] - ie[0], is[1] - ie[1]) < 1e-6) continue;
      // a path through the part, start → end, with a particle every 0,5 units
      const tr = trayecto([P(s), P(t)]);
      const c: Camino = { clave: { k: 'elem', id: e.id }, tr, nodo: null, elemento: e.id, fase: 0.25, n: Math.floor(tr.largo / 0.5), paso: 0.5, zonas };
      c.ocultos = tramosOcultos(tr, zonas, 2);
      // the body (istart → iend along the path) is hidden whole
      const d0 = Math.hypot(P(is)[0] - P(s)[0], P(is)[1] - P(s)[1]);
      const d1 = Math.hypot(P(ie)[0] - P(s)[0], P(ie)[1] - P(s)[1]);
      const [a, b] = [Math.min(d0, d1), Math.max(d0, d1)];
      if (!c.ocultos.some(([x, y]) => x <= a + 1e-6 && y >= b - 1e-6)) fallos.push(`${e.id}: cuerpo ${a.toFixed(1)}…${b.toFixed(1)} visible (${JSON.stringify(c.ocultos)})`);
      // and no particle drawn is inside any zone (bodies, node dots)
      const dentro = posicionesVisibles([c]).filter(([x, y]) => zonas.some((z: Zona) => x >= z[0] && x <= z[2] && y >= z[1] && y <= z[3]));
      if (dentro.length) fallos.push(`${e.id}: ${dentro.length} partículas dentro de una pieza`);
      cuerpos++;
    }
  }
  expect(cuerpos).toBeGreaterThan(20);
  expect(fallos).toEqual([]);
});

// The owner's point (12-11): «el cable y el componente se superponían». In every book schematic the live layer colours
// the wires (tramos) and the leads (start → istart, iend → end): none of them may run through a part's body (the body
// box shrunk by 1 SVG unit: touching it at a terminal is fine).
test('figuras vivas: ningún hilo ni terminal coloreado atraviesa el cuerpo de una pieza', () => {
  const dir = path.join(web, 'public', 'libro', 'datos');
  type Elem = { id: string; rol: string; anclas: Record<string, Punto>; caja?: [number, number, number, number]; terminales?: Record<string, string> };
  type Esq = { elementos: Elem[]; tramos: { id: string; puntos: Punto[] }[]; dibujo_a_svg: { sx: number; sy: number; tx: number; ty: number } };
  const fallos: string[] = [];
  let hilos = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!txt.includes('"dibujo_a_svg"')) continue;
    const esquemas: Esq[] = [];
    const buscar = (o: unknown) => {
      if (Array.isArray(o)) o.forEach(buscar);
      else if (o && typeof o === 'object') {
        const x = o as Record<string, unknown>;
        if (Array.isArray(x['elementos']) && Array.isArray(x['tramos']) && x['dibujo_a_svg']) esquemas.push(x as unknown as Esq);
        else Object.values(x).forEach(buscar);
      }
    };
    buscar(JSON.parse(txt));
    for (const esq of esquemas) {
      const A = esq.dibujo_a_svg;
      const P = (p: Punto): Punto => [A.sx * p[0] + A.tx, A.sy * p[1] + A.ty];
      const caja = (c: [number, number, number, number]): [number, number, number, number] => {
        const a = P([c[0], c[1]]);
        const b = P([c[2], c[3]]);
        return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
      };
      // the bodies: every two-terminal part's box between istart and iend (measured here from the data)
      const cuerpos: { id: string; z: Zona }[] = [];
      for (const e of esq.elementos) {
        const t = Object.keys(e.terminales ?? {});
        const [ia, ib] = [e.anclas['istart'], e.anclas['iend']];
        if (!e.caja || t.length !== 2 || !t.includes('start') || !t.includes('end') || !ia || !ib) continue;
        const [A, B, c] = [P(ia), P(ib), caja(e.caja)];
        if (Math.hypot(A[0] - B[0], A[1] - B[1]) < 1e-6) continue;
        const hor = Math.abs(B[0] - A[0]) >= Math.abs(B[1] - A[1]);
        cuerpos.push({ id: e.id, z: hor ? [Math.min(A[0], B[0]), c[1], Math.max(A[0], B[0]), c[3]] : [c[0], Math.min(A[1], B[1]), c[2], Math.max(A[1], B[1])] });
      }
      // what the live layer draws: the halos clipped off the bodies (modelo.svelte.ts)
      const recorte = cuerposDeDosBornes(esq.elementos.map((e) => ({ e, caja: e.caja ? caja(e.caja) : null })), P);
      const lineas: { que: string; pts: Punto[] }[] = esq.tramos.map((t) => ({ que: `tramo ${t.id}`, pts: t.puntos.map(P) }));
      for (const e of esq.elementos) {
        const te = e.terminales ?? {};
        if (Object.keys(te).length !== 2 || !('start' in te) || !('end' in te)) continue;
        for (const [t, i] of [['start', 'istart'], ['end', 'iend']] as const) {
          const a = e.anclas[t];
          const b = e.anclas[i];
          if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-3) lineas.push({ que: `terminal ${e.id}.${t}`, pts: [P(a), P(b)] });
        }
      }
      for (const l of lineas.flatMap((x) => fueraDeZonas(x.pts, recorte).map((pts) => ({ que: x.que, pts })))) {
        hilos++;
        const tr = trayecto(l.pts);
        for (const { id, z } of cuerpos) {
          const dentro: Zona = [z[0] + 1, z[1] + 1, z[2] - 1, z[3] - 1];
          if (dentro[0] >= dentro[2] || dentro[1] >= dentro[3]) continue;
          const o = tramosOcultos(tr, [dentro], 0).reduce((s, [a, b]) => s + b - a, 0);
          if (o > 0.5) fallos.push(`${f} ${l.que} atraviesa ${id} (${o.toFixed(1)} u)`);
        }
      }
    }
  }
  expect(hilos).toBeGreaterThan(200);
  expect(fallos).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ 1, in the browser
/**
 * The owner's point: wires and parts must not overlap. The drawing's wires (`.hilo` paths outside a part, the plates of
 * a battery excepted) sampled every unit: none inside a part's body (the box of its outline off the wires — so its
 * leads, which continue the wires, do not count — shrunk by 1 unit) nor under a label.
 */
async function cablesSobrePiezas(page: Page): Promise<string[]> {
  return page.locator('[data-vivo]').first().evaluate((vivo) => {
    const svg = vivo.querySelector<SVGSVGElement>('svg.e11')!;
    const inv = DOMMatrix.fromMatrix(svg.getScreenCTM()!).inverse();
    const aSvg = (el: SVGGraphicsElement) => inv.multiply(DOMMatrix.fromMatrix(el.getScreenCTM()!));
    const muestras = (el: SVGGeometryElement) => {
      const M = aSvg(el);
      const L = el.getTotalLength();
      const out: [number, number][] = [];
      for (let s = 0; s <= L; s += 1) {
        const q = M.transformPoint(el.getPointAtLength(s));
        out.push([q.x, q.y]);
      }
      return out;
    };
    const esHilo = (p: Element) => !p.closest('[data-pieza]') && !p.matches('.gordo, .fino') && !p.parentElement?.querySelector(':scope > .gordo');
    const hilos = [...svg.querySelectorAll<SVGPathElement>('path.hilo')].filter(esHilo).map((h) => ({ d: h.getAttribute('d') ?? '', pts: muestras(h) }));
    const todos = hilos.flatMap((h) => h.pts);
    const cerca = (x: number, y: number) => todos.some(([a, b]) => Math.hypot(a - x, b - y) <= 1.5);
    const cajas: { que: string; c: [number, number, number, number] }[] = [];
    svg.querySelectorAll<SVGGraphicsElement>('[data-pieza], .pieza').forEach((g) => {
      if (g.matches('.pieza') && g.closest('[data-pieza]') && g.closest('[data-pieza]') !== g) return;
      // (a switch's terminals — .borne, .nodo — are where the wires end: not its body)
      const geos = (g instanceof SVGGeometryElement ? [g] : [...g.querySelectorAll<SVGGeometryElement>('path, circle, line, polyline, polygon, rect, ellipse')]).filter((x) => !x.matches('.brillo, .borne, .nodo, .salida'));
      let c: [number, number, number, number] | null = null;
      for (const el of geos)
        for (const [x, y] of muestras(el)) {
          if (cerca(x, y)) continue;
          c = c ? [Math.min(c[0], x), Math.min(c[1], y), Math.max(c[2], x), Math.max(c[3], y)] : [x, y, x, y];
        }
      if (c) cajas.push({ que: `pieza ${g.getAttribute('data-pieza') ?? g.getAttribute('class')}`, c });
    });
    // the bodies the kit declares (data-cuerpo «x0 y0 x1 y1»: a coil's turns lie on one side of its wire)
    svg.querySelectorAll<SVGGraphicsElement>('[data-cuerpo]').forEach((el) => {
      const n = (el.getAttribute('data-cuerpo') ?? '').split(' ').map(Number);
      const M = aSvg(el);
      const a = M.transformPoint(new DOMPoint(n[0], n[1]));
      const b = M.transformPoint(new DOMPoint(n[2], n[3]));
      cajas.push({ que: `cuerpo ${el.closest('[data-pieza]')?.getAttribute('data-pieza') ?? el.getAttribute('class')}`, c: [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)] });
    });
    svg.querySelectorAll<SVGTextElement>('text').forEach((t) => {
      const M = aSvg(t);
      const b = t.getBBox();
      const p = [M.transformPoint(new DOMPoint(b.x, b.y)), M.transformPoint(new DOMPoint(b.x + b.width, b.y + b.height))];
      cajas.push({ que: `etiqueta «${t.textContent}»`, c: [Math.min(p[0]!.x, p[1]!.x), Math.min(p[0]!.y, p[1]!.y), Math.max(p[0]!.x, p[1]!.x), Math.max(p[0]!.y, p[1]!.y)] });
    });
    const fallos: string[] = [];
    for (const h of hilos)
      for (const { que, c } of cajas) {
        const n = h.pts.filter(([x, y]) => x > c[0] + 1 && x < c[2] - 1 && y > c[1] + 1 && y < c[3] - 1).length;
        if (n) fallos.push(`hilo «${h.d}» dentro de ${que} (${n} u)`);
      }
    return fallos;
  });
}

/** Lit pixels of the particles' canvas that fall inside a body, a label or a node dot of the drawing. */
async function solapes(page: Page): Promise<{ encendidos: number; dentro: string[] }> {
  return page.locator('[data-vivo]').first().evaluate((vivo) => {
    const svg = vivo.querySelector<SVGSVGElement>('svg.e11')!;
    const lienzo = vivo.querySelector<HTMLCanvasElement>('canvas')!;
    // (getScreenCTM gives an SVGMatrix, without transformPoint: as DOMMatrix)
    const inv = DOMMatrix.fromMatrix(svg.getScreenCTM()!).inverse();
    const aSvg = (el: SVGGraphicsElement) => inv.multiply(DOMMatrix.fromMatrix(el.getScreenCTM()!));
    // the wires that carry the current, sampled every unit
    const flujo: [number, number][] = [];
    svg.querySelectorAll<SVGPathElement>('path.flujo').forEach((p) => {
      const M = aSvg(p);
      const L = p.getTotalLength();
      for (let s = 0; s <= L; s += 1) {
        const q = M.transformPoint(p.getPointAtLength(s));
        flujo.push([q.x, q.y]);
      }
    });
    const enHilo = (x: number, y: number) => flujo.some(([a, b]) => Math.hypot(a - x, b - y) <= 2);
    const cajaDe = (el: SVGGraphicsElement) => {
      const M = aSvg(el);
      const b = el.getBBox();
      const ps = [M.transformPoint(new DOMPoint(b.x, b.y)), M.transformPoint(new DOMPoint(b.x + b.width, b.y + b.height))];
      return [Math.min(ps[0]!.x, ps[1]!.x), Math.min(ps[0]!.y, ps[1]!.y), Math.max(ps[0]!.x, ps[1]!.x), Math.max(ps[0]!.y, ps[1]!.y)] as [number, number, number, number];
    };
    const cajas: { que: string; c: [number, number, number, number] }[] = [];
    // labels
    svg.querySelectorAll<SVGTextElement>('text').forEach((t) => cajas.push({ que: `etiqueta «${t.textContent}»`, c: cajaDe(t) }));
    // node dots, terminals, a diode's triangle, a source's circle (small closed shapes)
    svg.querySelectorAll<SVGGraphicsElement>('circle, ellipse, polygon, path').forEach((el) => {
      if (el.matches('.flujo, .brillo')) return;
      if (el.tagName === 'path' && !/z/i.test(el.getAttribute('d') ?? '')) return;
      const c = cajaDe(el);
      if (Math.max(c[2] - c[0], c[3] - c[1]) <= 50) cajas.push({ que: `${el.tagName}.${el.getAttribute('class') ?? ''}`, c });
    });
    // every part's body: the box of its outline off the wires that carry the current (its leads lie on them)
    svg.querySelectorAll<SVGGraphicsElement>('[data-pieza], .pieza').forEach((g) => {
      const geos = (g instanceof SVGGeometryElement ? [g] : [...g.querySelectorAll<SVGGeometryElement>('path, circle, line, polyline, polygon, rect, ellipse')]).filter((x) => !x.matches('.brillo'));
      let c: [number, number, number, number] | null = null;
      for (const el of geos) {
        const M = aSvg(el);
        const L = el.getTotalLength();
        for (let s = 0; s <= L; s += 1) {
          const q = M.transformPoint(el.getPointAtLength(s));
          if (enHilo(q.x, q.y)) continue;
          c = c ? [Math.min(c[0], q.x), Math.min(c[1], q.y), Math.max(c[2], q.x), Math.max(c[3], q.y)] : [q.x, q.y, q.x, q.y];
        }
      }
      if (c) cajas.push({ que: `pieza ${g.getAttribute('data-pieza') ?? g.getAttribute('class')}`, c });
    });
    // the bodies the kit declares (data-cuerpo «x0 y0 x1 y1»: a coil's turns lie on one side of its wire)
    svg.querySelectorAll<SVGGraphicsElement>('[data-cuerpo]').forEach((el) => {
      const n = (el.getAttribute('data-cuerpo') ?? '').split(' ').map(Number);
      const M = aSvg(el);
      const a = M.transformPoint(new DOMPoint(n[0], n[1]));
      const b = M.transformPoint(new DOMPoint(n[2], n[3]));
      cajas.push({ que: `cuerpo ${el.closest('[data-pieza]')?.getAttribute('data-pieza') ?? el.getAttribute('class')}`, c: [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)] });
    });
    // the canvas' lit pixels, in the drawing's units
    const r = lienzo.getBoundingClientRect();
    const sx = r.width / lienzo.width;
    const sy = r.height / lienzo.height;
    const scr = inv;
    const d = lienzo.getContext('2d')!.getImageData(0, 0, lienzo.width, lienzo.height).data;
    let encendidos = 0;
    const dentro = new Map<string, number>();
    for (let y = 0; y < lienzo.height; y++)
      for (let x = 0; x < lienzo.width; x++) {
        if (d[(y * lienzo.width + x) * 4 + 3]! <= 40) continue;
        encendidos++;
        const p = scr.transformPoint(new DOMPoint(r.left + (x + 0.5) * sx, r.top + (y + 0.5) * sy));
        for (const { que, c } of cajas) if (p.x > c[0] && p.x < c[2] && p.y > c[1] && p.y < c[3]) dentro.set(que, (dentro.get(que) ?? 0) + 1);
      }
    return { encendidos, dentro: [...dentro].map(([q, n]) => `${q}: ${n} px`) };
  });
}

/** Every circuit card with a drawing: the 1.1 catalogue's and the reference lesson's divisor and parallel circuit. */
const real14 = JSON.parse(fs.readFileSync(path.join(web, 'public', 'libro', 'lecciones11', 'cap01', 'sec-1.4.json'), 'utf8')) as Leccion11;
const tarjetas = [
  ...['divisor', 'paralelo'].map((e) => ({ id: 'cap01/sec-1.4', lec: null as Leccion11 | null, k: real14.tarjetas.findIndex((t) => t.widget?.tipo === 'circuito' && t.widget.esquema === e), esquema: e })),
  ...cat11.tarjetas.flatMap((t, k) => (t.widget?.tipo === 'circuito' && t.widget.dibujo !== false ? [{ id: CAT11, lec: cat11 as Leccion11 | null, k, esquema: t.widget.esquema }] : [])),
];

for (const quieto of [false, true]) {
  test(`circuito vivo: ninguna partícula sobre un símbolo, una etiqueta o un punto (${quieto ? 'movimiento reducido' : 'animado'}, móvil)`, async ({ browser }) => {
    test.setTimeout(420_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: quieto ? 'reduce' : 'no-preference' });
    await servir(ctx, CAT11, cat11);
    const page = await ctx.newPage();
    await preparar(page);
    const hoja = process.env.EPA_HOJA;
    if (hoja && !quieto) fs.mkdirSync(hoja, { recursive: true });
    const fallos: string[] = [];
    let n = 0;
    for (const t of tarjetas) {
      expect(t.k, t.esquema).toBeGreaterThanOrEqual(0);
      await irA(page, t.id, t.k);
      const vivo = page.locator('[data-vivo]').first();
      await expect(vivo).toBeVisible();
      await vivo.scrollIntoViewIfNeeded();
      await expect(vivo).toHaveAttribute('data-vivo', quieto ? 'quieto' : 'animado');
      // the drawing itself: no wire through a part's body or under a label
      if (!quieto) for (const x of await cablesSobrePiezas(page)) fallos.push(`${t.esquema} (tarjeta ${t.k + 1}): ${x}`);
      const hayFlujo = await vivo.evaluate((v) => v.querySelectorAll('path.flujo').length > 0 && ((v as unknown as { __epaParticulasTodas?: () => number }).__epaParticulasTodas?.() ?? 1) > 0);
      // three moments (the particles move between them)
      for (let j = 0; j < (quieto ? 1 : 3); j++) {
        await page.waitForTimeout(quieto ? 150 : 260);
        const r = await solapes(page);
        // (a drawing with a moving current and particles: not every one of them hidden; a still picture draws no arrow
        // on a path without current, nor do drawings without one)
        if (!quieto && hayFlujo && r.encendidos === 0) fallos.push(`${t.esquema} (tarjeta ${t.k + 1}): ni una partícula`);
        if (r.dentro.length) fallos.push(`${t.esquema} (tarjeta ${t.k + 1}, momento ${j + 1}): ${r.dentro.join('; ')}`);
      }
      if (hoja && !quieto) await page.locator('[data-circuito]').first().screenshot({ path: path.join(hoja, `${String(++n).padStart(2, '0')}-${t.esquema}.png`) });
    }
    expect(fallos).toEqual([]);
    await ctx.close();
  });
}

// ------------------------------------------------------------------------------------------------ 2
test('avería: el dibujo no delata el fallo (valores nominales, sin tensiones ni leyenda) hasta encontrarlo', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await servir(ctx, CAT12, cat12);
  const page = await ctx.newPage();
  await preparar(page);
  const k = cat12.tarjetas.findIndex((t) => t.id === 'averia-divisor');
  await irA(page, CAT12, k);
  const tarjeta = page.locator('[data-tarjeta="averia-divisor"]');
  const svg = tarjeta.locator('svg.e11');
  const oculta = async () => {
    // the labels: the nominal R₂ (5 kΩ), never the open one (1 GΩ); the description for screen readers too
    await expect(svg).toContainText('5 kΩ');
    await expect(svg).not.toContainText('GΩ');
    expect(await svg.getAttribute('aria-label')).not.toMatch(/GΩ|gigaohmio/);
    // no voltage colours, legend or values
    await expect(tarjeta.locator('[data-vivo]')).toHaveAttribute('data-vivo-tensiones', 'no');
    await expect(tarjeta.locator('[data-leyenda-tension]')).toHaveCount(0);
    await expect(tarjeta.locator('[data-ver-tensiones]')).toHaveCount(0);
    expect(await tarjeta.locator('svg.e11 [data-tension]').count()).toBe(0);
  };
  await oculta();
  // a measurement does not give it away either (the probe reads the faulty board: that is the point)
  await page.locator('[data-sonda="salida"]').click();
  await expect(page.locator('[data-lectura-multimetro]')).toHaveText('12,0 V');
  await oculta();
  // a wrong suspect: still hidden
  await page.locator('[data-sospechoso="r1"]').click();
  await page.locator('[data-continuar]').click();
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'mal');
  await oculta();
  // found: the faulty board on show, with its voltages
  await page.locator('[data-continuar]').click();
  await page.locator('[data-sospechoso="r2"]').click();
  await page.locator('[data-continuar]').click();
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'bien');
  await expect(svg).toContainText('GΩ');
  await expect(tarjeta.locator('[data-leyenda-tension]')).toBeVisible();
  await expect(tarjeta.locator('[data-vivo]')).not.toHaveAttribute('data-vivo-tensiones', 'no');
  // another board, another hidden fault: hidden again
  await page.locator('[data-otra-averia]').click();
  await expect(page.locator('[data-averia]')).toHaveAttribute('data-ronda', '1');
  await expect(svg).toContainText('10 kΩ');
  await oculta();
  await ctx.close();
});

// ------------------------------------------------------------------------------------------------ 3
test('curso: el título recibe el foco tras navegar, sin anillo de foco', async ({ page }) => {
  await page.context().route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await preparar(page);
  await page.goto('#/cursos');
  await expect(page.locator('h1').first()).toBeVisible();
  const enlace = await page.locator('a[href^="#/cursos/"]').first().getAttribute('href');
  // a route change with no pointer input (as a link opened from the keyboard or from outside)
  await page.evaluate((h) => (location.hash = h!), enlace);
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1');
  const r = await page.evaluate(() => {
    const h = document.activeElement as HTMLElement;
    return { visible: h.matches(':focus-visible'), contorno: getComputedStyle(h).outlineStyle, texto: h.textContent };
  });
  expect(r.contorno, `«${r.texto}» (:focus-visible ${r.visible})`).toBe('none');
});
