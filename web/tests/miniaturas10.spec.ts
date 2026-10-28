// Thumbnails in the lists (0.10): simulator index and «Simular» menu (automatic schematics), search results and
// exercises (the figure they refer to, else their circuit, else the glossary symbol, else a neutral
// placeholder), 3D catalogue and animation gallery (pre-rendered model images). Checks that each item shows
// what it should, that thumbnails are requested only when they are about to be seen, that nothing moves when
// they arrive, that the 3D lists open no WebGL context per card, that «Mis circuitos» and «Mis montajes» show
// the reader's own drawings and follow their edits, and measures long tasks while scrolling each
// list at 800 px with the CPU throttled ×4 (numbers in tests/capturas/miniaturas10/rendimiento.json);
// screenshots of every list (tablet 800 and phone 412, light and dark) into tests/capturas/miniaturas10/.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.miniaturas10.config.ts tests/miniaturas10.spec.ts
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const CAPTURAS = 'tests/capturas/miniaturas10';

type Tema = 'claro' | 'oscuro';

async function contexto(browser: Browser, w: number, h: number, tema: Tema = 'claro', movil = false): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: movil, hasTouch: movil });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 }));
    } catch {
      /* private mode */
    }
  }, tema);
  return ctx;
}

/** Thumbnail files requested by the page (schematic chapters, figures, 3D models). */
function peticiones(page: Page): string[] {
  const lista: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.includes('/miniaturas/')) lista.push(u.pathname.replace(/^.*\/miniaturas\//, ''));
  });
  return lista;
}

/** Holds every thumbnail request until `soltar()` (to measure the rows before and after they arrive). */
async function retener(page: Page): Promise<() => void> {
  let soltar!: () => void;
  const puerta = new Promise<void>((r) => (soltar = r));
  await page.route('**/miniaturas/**', async (ruta) => {
    await puerta;
    await ruta.continue();
  });
  return soltar;
}

async function cajas(page: Page, selector: string, n = 8): Promise<number[][]> {
  return page.locator(selector).evaluateAll(
    (els, n) =>
      els.slice(0, n).map((e) => {
        const r = e.getBoundingClientRect();
        return [Math.round(r.top * 2) / 2, Math.round(r.height * 2) / 2, Math.round(r.width * 2) / 2];
      }),
    n,
  );
}

/** Visible thumbnails (in the viewport and inside their scroller) and their state. */
async function visibles(page: Page, selector = '[data-miniatura]'): Promise<{ tipo: string; estado: string }[]> {
  return page.locator(selector).evaluateAll((els) =>
    els
      .filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight) return false;
        const s = e.closest('[data-miniaturas-raiz]')?.getBoundingClientRect();
        return !s || (r.bottom > s.top && r.top < s.bottom);
      })
      .map((e) => ({ tipo: (e as HTMLElement).dataset.miniatura ?? '', estado: (e as HTMLElement).dataset.estado ?? '' })),
  );
}

test('índice del simulador: el esquema de cada netlist, pedido por capítulos al verlo y sin mover nada', async ({ browser }) => {
  const ctx = await contexto(browser, 800, 1280);
  const page = await ctx.newPage();
  const pedidas = peticiones(page);
  const soltar = await retener(page);
  await page.goto('#/simulador');
  const filas = page.locator('.indice-sim li a');
  await expect(filas.first()).toBeVisible();
  await expect(page.locator('.indice-sim [data-miniatura="esquema"]').first()).toHaveAttribute('data-estado', 'espera');
  const antes = await cajas(page, '.indice-sim li a');
  soltar();
  await expect(page.locator('.indice-sim [data-miniatura="esquema"]').first()).toHaveAttribute('data-estado', 'lista');
  await expect.poll(async () => (await visibles(page)).every((v) => v.estado === 'lista')).toBe(true);
  expect(await cajas(page, '.indice-sim li a')).toEqual(antes);
  // One file per chapter, only the chapters near the top.
  const esquemas = () => [...new Set(pedidas.filter((p) => p.startsWith('esquemas/')))];
  expect(esquemas().length).toBeGreaterThan(0);
  expect(esquemas().length).toBeLessThan(6);
  expect(esquemas()).not.toContain('esquemas/cap53.json');
  // Each drawing is one small inline SVG with no text.
  const svg = page.locator('.indice-sim [data-miniatura="esquema"] svg').first();
  await expect(svg.locator('path')).not.toHaveCount(0);
  await expect(svg.locator('text')).toHaveCount(0);
  // The last chapter arrives when scrolled to.
  await page.locator('.indice-sim .capitulo').last().scrollIntoViewIfNeeded();
  await expect.poll(esquemas).toContain('esquemas/cap53.json');
  await expect.poll(async () => (await visibles(page)).every((v) => v.estado === 'lista')).toBe(true);
  // A filter redraws the rows at once from what is loaded (no placeholder flash).
  await page.getByRole('searchbox', { name: 'Buscar netlists' }).fill('filtro rc');
  await expect(page.locator('.indice-sim [data-miniatura="esquema"][data-estado="lista"]').first()).toBeVisible();
  await ctx.close();
});

test('menú «Simular» con varias netlists: cada una con su esquema', async ({ browser }) => {
  const ctx = await contexto(browser, 800, 1280);
  const page = await ctx.newPage();
  await page.goto('#/cap05/sec-5.3');
  await page.locator('button.simular').first().click();
  const menu = page.locator('.menu').first();
  await expect(menu.locator('li')).toHaveCount(3);
  await expect(menu.locator('[data-miniatura="esquema"][data-estado="lista"]')).toHaveCount(3);
  await ctx.close();
});

test('búsqueda: figura de la sección, circuito, símbolo del término o hueco; perezosas dentro del panel', async ({ browser }) => {
  const ctx = await contexto(browser, 800, 1280);
  const page = await ctx.newPage();
  const pedidas = peticiones(page);
  await page.goto('#/cap05');
  await expect(page.locator('h1, h2').first()).toBeVisible();
  const soltar = await retener(page);
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox', { name: 'Buscar en el libro' }).fill('diodo zener');
  const res = page.locator('#resultados > li');
  await expect(res.first()).toBeVisible();
  const n = await res.count();
  expect(n).toBeGreaterThan(20);
  const antes = await cajas(page, '#resultados > li', 6);
  soltar();
  await expect.poll(async () => (await visibles(page, '#resultados [data-miniatura]')).every((v) => v.estado === 'lista' || v.estado === 'hueco')).toBe(true);
  expect(await cajas(page, '#resultados > li', 6)).toEqual(antes);
  // What each visible result shows agrees with the data.
  const datos = await page.evaluate(async () => {
    const j = (u: string) => fetch(u).then((r) => r.json());
    const [ind, refs, glos] = await Promise.all([j('miniaturas/indice.json'), j('libro/spice-refs.json'), j('libro/glosario-imagenes.json')]);
    return { fig: ind.figuras as Record<string, string>, refs: refs as Record<string, string[]>, glos: glos.terminos as Record<string, { s?: string }> };
  });
  const filas = await res.evaluateAll((els) =>
    els
      .filter((e) => {
        const r = e.getBoundingClientRect();
        const s = e.closest('[data-miniaturas-raiz]')!.getBoundingClientRect();
        return r.bottom > s.top && r.top < s.bottom;
      })
      .map((e) => {
        const href = decodeURIComponent(e.querySelector('a')!.getAttribute('href')!);
        const m = e.querySelector('[data-miniatura]') as HTMLElement;
        return { id: href.split('/').pop()!, tipo: m.dataset.miniatura!, estado: m.dataset.estado! };
      }),
  );
  expect(filas.length).toBeGreaterThan(3);
  const tipos = new Set<string>();
  for (const f of filas) {
    const esperado = datos.fig[f.id] ? 'figura' : datos.refs[f.id]?.length ? 'esquema' : datos.glos[f.id]?.s ? 'simbolo' : 'libro';
    expect(f.tipo, f.id).toBe(esperado);
    expect(f.estado, f.id).toBe(esperado === 'libro' ? 'hueco' : 'lista');
    tipos.add(esperado);
  }
  expect(tipos.has('figura')).toBe(true);
  // Only the results near the visible part of the panel asked for their figure.
  const figuras = () => pedidas.filter((p) => /^(fig|img)\//.test(p)).length;
  const alPrincipio = figuras();
  expect(alPrincipio).toBeGreaterThan(0);
  expect(alPrincipio).toBeLessThan(n / 2);
  await page.locator('[data-miniaturas-raiz]').evaluate((e) => e.scrollTo({ top: e.scrollHeight }));
  await expect.poll(figuras).toBeGreaterThan(alPrincipio);
  await expect(page.locator('#resultados img').first()).toHaveAttribute('decoding', 'async');
  // A glossary term with a symbol.
  await page.getByRole('searchbox', { name: 'Buscar en el libro' }).fill('condensador electrolitico');
  await expect(page.locator('#resultados [data-miniatura="simbolo"][data-estado="lista"] svg').first()).toBeVisible();
  await ctx.close();
});

test('ejercicios: la figura o el circuito del enunciado, y un hueco cuando no hay', async ({ browser }) => {
  const ctx = await contexto(browser, 800, 1280);
  const page = await ctx.newPage();
  const pedidas = peticiones(page);
  await page.goto('#/ejercicios');
  await page.locator('button.cap-cab', { hasText: 'Capítulo 4 ·' }).click();
  const filas = page.locator('.pagina-ej li .fila');
  await expect(filas.first()).toBeVisible();
  await expect.poll(async () => (await visibles(page)).every((v) => v.estado === 'lista' || v.estado === 'hueco')).toBe(true);
  const v = await visibles(page);
  expect(v.some((x) => x.tipo === 'esquema' && x.estado === 'lista')).toBe(true);
  expect(v.some((x) => x.estado === 'hueco')).toBe(true);
  // Exercise 39.3 (ej-40.3 of part cap40) links to figure 39.5 (fig/40.5); closed chapters asked for nothing.
  expect(pedidas.some((p) => p.startsWith('esquemas/cap40'))).toBe(false);
  await page.locator('button.cap-cab', { hasText: 'Capítulo 39 ·' }).click();
  const fila = page.locator('.pagina-ej li .fila', { has: page.locator('.num', { hasText: /^39\.3$/ }) });
  await fila.scrollIntoViewIfNeeded();
  await expect(fila.locator('[data-miniatura="figura"][data-estado="lista"] img')).toHaveAttribute('src', /miniaturas\/fig\/40\.5\.webp$/);
  await expect.poll(() => fila.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  // Opening an exercise keeps its row in place (the thumbnail does not change size).
  const h = (await fila.boundingBox())!.height;
  await fila.click();
  await expect(fila).toHaveAttribute('aria-expanded', 'true');
  expect((await fila.boundingBox())!.height).toBe(h);
  await ctx.close();
});

const CONTAR_WEBGL = () => {
  const w = window as unknown as { __webgl: string[] };
  w.__webgl = [];
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: string, ...resto: unknown[]) {
    const c = (original as (...a: unknown[]) => unknown).call(this, tipo, ...resto);
    const marca = this as unknown as { __contado?: boolean };
    if (c && /webgl/.test(tipo) && !marca.__contado) {
      marca.__contado = true;
      w.__webgl.push(`${tipo} ${this.width}×${this.height}`);
    }
    return c;
  } as typeof original;
};

test('catálogo 3D: imágenes previas pedidas al verlas, sin contextos WebGL por tarjeta', async ({ browser }) => {
  const ctx = await contexto(browser, 800, 1280);
  await ctx.addInitScript(CONTAR_WEBGL);
  const page = await ctx.newPage();
  const pedidas = peticiones(page);
  const soltar = await retener(page);
  await page.goto('#/componentes/3d');
  const tarjetas = page.locator('.catalogo3d .tarjeta');
  await expect(tarjetas.first()).toBeVisible();
  const total = await tarjetas.count();
  const antes = await cajas(page, '.catalogo3d .tarjeta');
  soltar();
  await expect.poll(() => page.locator('.catalogo3d .arte img').evaluateAll((is) => is.filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length)).toBeGreaterThan(1);
  expect(await cajas(page, '.catalogo3d .tarjeta')).toEqual(antes);
  const modelos = () => pedidas.filter((p) => p.startsWith('3d/')).length;
  expect(modelos()).toBeLessThan(total / 2);
  // Scrolled through the whole page: every card asked for its image on the way.
  await page.mouse.move(400, 700);
  for (let i = 0; i < 60 && modelos() < total; i++) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(80);
  }
  await expect.poll(modelos).toBe(total);
  // At most the WebGL2 check (one context, lost at once); no renderer at all.
  const webgl = await page.evaluate(() => (window as unknown as { __webgl: string[] }).__webgl);
  expect(webgl.length).toBeLessThanOrEqual(1);
  await ctx.close();
});

test('catálogo 3D sin imágenes previas: se dibujan aquí con un solo contexto WebGL compartido', async ({ browser }) => {
  const ctx = await contexto(browser, 800, 1280);
  await ctx.addInitScript(CONTAR_WEBGL);
  const page = await ctx.newPage();
  await page.route('**/miniaturas/3d/**', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('#/componentes/3d');
  await expect(page.locator('.catalogo3d .tarjeta').first()).toBeVisible();
  // The cards in view get an image drawn on this device (object URL).
  await expect.poll(() => page.locator('.catalogo3d .arte img[src^="blob:"]').count(), { timeout: 60_000 }).toBeGreaterThan(2);
  await page.locator('.catalogo3d .tarjeta').nth(8).scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.catalogo3d .arte img[src^="blob:"]').count(), { timeout: 60_000 }).toBeGreaterThan(5);
  const webgl = await page.evaluate(() => (window as unknown as { __webgl: string[] }).__webgl);
  // The WebGL2 check plus one renderer (384 × 288) for every thumbnail.
  expect(webgl.filter((w) => w.endsWith('384×288'))).toHaveLength(1);
  expect(webgl.length).toBeLessThanOrEqual(2);
  await ctx.close();
});

test('galería de componentes animados: la pieza en 3D con su símbolo', async ({ browser }) => {
  const ctx = await contexto(browser, 800, 1280);
  await ctx.addInitScript(CONTAR_WEBGL);
  const page = await ctx.newPage();
  await page.goto('#/componentes');
  await expect(page.locator('.galeria .tarjeta').first()).toBeVisible();
  await expect.poll(() => page.locator('.galeria [data-miniatura="modelo"] img').evaluateAll((is) => is.filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length)).toBeGreaterThan(1);
  await expect(page.locator('.galeria [data-miniatura="modelo"] .insignia-simbolo svg').first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __webgl: string[] }).__webgl.length)).toBeLessThanOrEqual(1);
  await ctx.close();
});

// ------------------------------------------------------------------------------------------------ own circuits

type VentanaEditor = { __epaEditor?: { ed: { doc: { componentes: unknown[] } }; centroDe: (n: string) => [number, number] | null } };
type VentanaProto = { __epaProtoboard?: { pb: { doc: { piezas: unknown[] } }; centro: (n: string) => [number, number] | null } };

async function guardadoEn(page: Page, clave: string, id: string): Promise<number> {
  return page.evaluate(
    ([k, i]) => (JSON.parse(localStorage.getItem(k) ?? '{}').circuitos?.[i]?.actualizado as number | undefined) ?? 0,
    [clave, id] as const,
  );
}

test('«Mis circuitos»: el dibujo del editor, que se rehace al guardar un cambio, sin mover la fila', async ({ browser }) => {
  const ctx = await contexto(browser, 800, 1280);
  const page = await ctx.newPage();
  await page.goto('#/editor/libro/cap05/sec-5.3_led_150ohm');
  await page.waitForFunction(() => ((window as unknown as VentanaEditor).__epaEditor?.ed.doc.componentes.length ?? 0) > 2, null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.waitForURL(/#\/editor\/c[0-9a-z]+$/);
  const id = page.url().split('/').pop()!;
  await page.getByRole('button', { name: 'Mis circuitos' }).click();
  const fila = page.locator('.dialogo li').first();
  const mini = fila.locator('[data-miniatura="esquema"]');
  await expect(mini).toHaveAttribute('data-estado', 'lista');
  expect(await mini.evaluate((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height])).toEqual([84, 52]);
  await expect(mini.locator('text')).toHaveCount(0);
  const d0 = await mini.locator('path.l').getAttribute('d');
  const caja0 = await cajas(page, '.dialogo li');
  await page.locator('.dialogo').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.locator('.dialogo')).toHaveCount(0);
  // Delete a part: the editor saves by itself, the thumbnail follows.
  const t0 = await guardadoEn(page, 'epa:editor-circuitos', id);
  const c = await page.evaluate(() => (window as unknown as VentanaEditor).__epaEditor!.centroDe('R1'));
  await page.mouse.click(c![0], c![1]);
  await page.keyboard.press('Delete');
  await expect.poll(() => guardadoEn(page, 'epa:editor-circuitos', id), { timeout: 15_000 }).toBeGreaterThan(t0);
  await page.getByRole('button', { name: 'Mis circuitos' }).click();
  await expect(mini).toHaveAttribute('data-estado', 'lista');
  expect(await mini.locator('path.l').getAttribute('d')).not.toBe(d0);
  expect(await cajas(page, '.dialogo li')).toEqual(caja0);
  await ctx.close();
});

test('«Mis montajes»: la protoboard con sus piezas, que se rehace al guardar un cambio, sin mover la fila', async ({ browser }) => {
  const ctx = await contexto(browser, 800, 1280);
  const page = await ctx.newPage();
  await page.goto('#/editor/libro/cap05/sec-5.3_led_150ohm');
  await page.waitForFunction(() => ((window as unknown as VentanaEditor).__epaEditor?.ed.doc.componentes.length ?? 0) > 2, null, { timeout: 30_000 });
  await page.locator('button:has-text("Ver en protoboard")').first().click();
  await page.waitForFunction(() => !!(window as unknown as VentanaProto).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await page.locator('.capa-protoboard button:has-text("Guardar")').click();
  await page.locator('.capa-protoboard button:has-text("Abrirlo")').click();
  await expect(page).toHaveURL(/#\/protoboard\/m/);
  const id = page.url().split('/').pop()!;
  await page.waitForFunction(() => !!(window as unknown as VentanaProto).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Mis montajes")').click();
  const fila = page.locator('section[aria-label="Mis montajes"] li').first();
  const img = fila.locator('[data-miniatura="figura"] img');
  await expect(img).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(await fila.locator('[data-miniatura="figura"]').evaluate((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height])).toEqual([84, 52]);
  const src0 = await img.getAttribute('src');
  // The board is drawn without labels and cropped around the parts.
  expect(decodeURIComponent(src0!)).not.toContain('>R1<');
  const caja0 = await cajas(page, 'section[aria-label="Mis montajes"] li');
  const t0 = await guardadoEn(page, 'epa:protoboard-circuitos', id);
  const c = await page.evaluate(() => (window as unknown as VentanaProto).__epaProtoboard!.centro('R1'));
  await page.mouse.click(c![0], c![1]);
  await page.keyboard.press('Delete');
  await expect.poll(() => guardadoEn(page, 'epa:protoboard-circuitos', id), { timeout: 15_000 }).toBeGreaterThan(t0);
  await expect.poll(() => img.getAttribute('src')).not.toBe(src0);
  expect(await cajas(page, 'section[aria-label="Mis montajes"] li')).toEqual(caja0);
  await ctx.close();
});

test('capturas de «Mis circuitos» y «Mis montajes»: tableta y móvil, claro y oscuro', async ({ browser }) => {
  test.setTimeout(300_000);
  fs.mkdirSync(CAPTURAS, { recursive: true });
  // Two saved circuits and their montages, made once; then the stores are seeded in each context.
  const base = await contexto(browser, 800, 1280);
  const page = await base.newPage();
  for (const nl of ['cap05/sec-5.3_led_150ohm', 'cap22/fig-22.9_puente']) {
    await page.goto(`#/editor/libro/${nl}`);
    await page.waitForFunction(() => ((window as unknown as VentanaEditor).__epaEditor?.ed.doc.componentes.length ?? 0) > 2, null, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.waitForURL(/#\/editor\/c[0-9a-z]+$/);
    await page.locator('button:has-text("Ver en protoboard")').first().click();
    await page.waitForFunction(() => !!(window as unknown as VentanaProto).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
    await page.locator('.capa-protoboard button:has-text("Guardar")').click();
    await expect(page.locator('.capa-protoboard header.cab')).toContainText('Guardado en «Mis montajes»');
    await page.locator('.capa-protoboard button[aria-label="Cerrar y volver al esquema"]').click();
  }
  const almacen = await page.evaluate(() => ({ c: localStorage.getItem('epa:editor-circuitos')!, m: localStorage.getItem('epa:protoboard-circuitos')! }));
  await base.close();
  for (const [disp, w, h, movil] of [['tableta', 800, 1280, false], ['movil', 412, 915, true]] as const) {
    for (const tema of ['claro', 'oscuro'] as const) {
      const ctx = await contexto(browser, w, h, tema, movil);
      await ctx.addInitScript((a) => {
        if (!localStorage.getItem('epa:editor-circuitos')) {
          localStorage.setItem('epa:editor-circuitos', a.c);
          localStorage.setItem('epa:protoboard-circuitos', a.m);
        }
      }, almacen);
      const p = await ctx.newPage();
      await p.goto('#/editor');
      await p.getByRole('button', { name: 'Mis circuitos' }).click();
      await expect(p.locator('.dialogo [data-miniatura="esquema"][data-estado="lista"]')).toHaveCount(2);
      await p.screenshot({ path: path.join(CAPTURAS, `mis-circuitos-${disp}-${tema}.png`) });
      await p.goto('#/protoboard');
      await p.locator('button:has-text("Mis montajes")').click();
      await expect(p.locator('section[aria-label="Mis montajes"] [data-miniatura="figura"][data-estado="lista"]')).toHaveCount(2);
      await p.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('section[aria-label="Mis montajes"] img')].every((i) => i.complete && i.naturalWidth > 0));
      await p.screenshot({ path: path.join(CAPTURAS, `mis-montajes-${disp}-${tema}.png`) });
      await ctx.close();
    }
  }
});

// ------------------------------------------------------------------------------------------------ performance

interface Medida {
  lista: string;
  modo: 'con miniaturas' | 'miniaturas bloqueadas';
  largas: number;
  totalMs: number;
  maxMs: number;
  /** Frames longer than 50 ms seen by requestAnimationFrame while scrolling. */
  cuadrosLentos: number;
  cuadros: number;
}

async function medirDesplazamiento(page: Page, pasos: number, sobre?: string): Promise<Omit<Medida, 'lista' | 'modo'>> {
  await page.evaluate(() => {
    const w = window as unknown as { __largas: number[]; __cuadros: number[]; __midiendo: boolean };
    w.__largas = [];
    w.__cuadros = [];
    w.__midiendo = true;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__largas.push(e.duration);
    }).observe({ type: 'longtask' });
    let t0 = performance.now();
    const cuadro = (t: number) => {
      w.__cuadros.push(t - t0);
      t0 = t;
      if (w.__midiendo) requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  });
  if (sobre) {
    const b = (await page.locator(sobre).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 300));
  } else await page.mouse.move(400, 600);
  for (let i = 0; i < pasos; i++) {
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const w = window as unknown as { __largas: number[]; __cuadros: number[]; __midiendo: boolean };
    w.__midiendo = false;
    const l = w.__largas;
    return {
      largas: l.length,
      totalMs: Math.round(l.reduce((s, x) => s + x, 0)),
      maxMs: Math.round(Math.max(0, ...l)),
      cuadrosLentos: w.__cuadros.filter((x) => x > 50).length,
      cuadros: w.__cuadros.length,
    };
  });
}

// «miniaturas bloqueadas» aborts every thumbnail request: the lists show placeholders, except the 3D catalogue,
// which then draws its thumbnails on the device (here with SwiftShader, on the CPU: the cost that pre-rendering
// the images saves).
test('rendimiento: tareas largas al desplazar cada lista a 800 px con la CPU ×4', async ({ browser }) => {
  test.setTimeout(600_000);
  const medidas: Medida[] = [];
  const listas: { lista: string; preparar: (p: Page) => Promise<void>; pasos: number; sobre?: string }[] = [
    { lista: 'simulador', pasos: 40, preparar: async (p) => { await p.goto('#/simulador'); await expect(p.locator('.indice-sim li').first()).toBeVisible(); } },
    {
      lista: 'busqueda',
      pasos: 30,
      sobre: '[data-miniaturas-raiz]',
      preparar: async (p) => {
        await p.goto('#/cap05');
        await expect(p.locator('h1, h2').first()).toBeVisible();
        await p.keyboard.press('Control+k');
        await p.getByRole('searchbox', { name: 'Buscar en el libro' }).fill('tension');
        await expect(p.locator('#resultados > li').first()).toBeVisible();
      },
    },
    {
      lista: 'ejercicios',
      pasos: 40,
      preparar: async (p) => {
        await p.goto('#/ejercicios');
        // Every chapter open: the whole list (486 rows).
        await p.getByRole('radio', { name: /^Pendientes/ }).click();
        await expect(p.locator('.pagina-ej li .fila').nth(400)).toBeAttached();
      },
    },
    { lista: 'catalogo3d', pasos: 40, preparar: async (p) => { await p.goto('#/componentes/3d'); await expect(p.locator('.catalogo3d .tarjeta').first()).toBeVisible(); } },
    { lista: 'galeria', pasos: 40, preparar: async (p) => { await p.goto('#/componentes'); await expect(p.locator('.galeria .tarjeta').first()).toBeVisible(); } },
  ];
  for (const l of listas) {
    for (const modo of ['miniaturas bloqueadas', 'con miniaturas'] as const) {
      const ctx = await contexto(browser, 800, 1280);
      const page = await ctx.newPage();
      if (modo === 'miniaturas bloqueadas') await page.route('**/miniaturas/**', (r) => r.abort());
      await l.preparar(page);
      await page.waitForTimeout(1500);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const m = await medirDesplazamiento(page, l.pasos, l.sobre);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      medidas.push({ lista: l.lista, modo, ...m });
      if (modo === 'con miniaturas') {
        // Everything in view resolved (none stuck waiting).
        await expect.poll(async () => (await visibles(page)).every((v) => v.estado !== 'espera')).toBe(true);
      }
      await ctx.close();
    }
  }
  fs.mkdirSync(CAPTURAS, { recursive: true });
  fs.writeFileSync(path.join(CAPTURAS, 'rendimiento.json'), JSON.stringify(medidas, null, 2));
  console.table(medidas);
  // The thumbnails must not bring long main-thread stalls: no task over 250 ms at CPU ×4 caused by them.
  for (const m of medidas.filter((x) => x.modo === 'con miniaturas')) expect(m.maxMs, m.lista).toBeLessThan(250);
});

// ------------------------------------------------------------------------------------------------ screenshots

test('capturas de cada lista: tableta y móvil, claro y oscuro', async ({ browser }) => {
  test.setTimeout(600_000);
  fs.mkdirSync(CAPTURAS, { recursive: true });
  const esperar = async (p: Page) => {
    await expect.poll(async () => (await visibles(p)).every((v) => v.estado !== 'espera')).toBe(true);
    await p.waitForFunction(() => [...document.images].every((i) => i.complete));
    await p.waitForTimeout(300);
  };
  for (const [disp, w, h, movil] of [['tableta', 800, 1280, false], ['movil', 412, 915, true]] as const) {
    for (const tema of ['claro', 'oscuro'] as const) {
      const ctx = await contexto(browser, w, h, tema, movil);
      const page = await ctx.newPage();
      const foto = (n: string) => page.screenshot({ path: path.join(CAPTURAS, `${n}-${disp}-${tema}.png`) });

      await page.goto('#/simulador');
      await page.locator('.indice-sim .capitulo').first().scrollIntoViewIfNeeded();
      await esperar(page);
      await foto('simulador');

      await page.goto('#/cap05/sec-5.3');
      await page.locator('button.simular').first().click();
      await expect(page.locator('.menu [data-miniatura="esquema"][data-estado="lista"]')).toHaveCount(3);
      await foto('menu-simular');

      await page.goto('#/cap05');
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await page.keyboard.press('Control+k');
      await page.getByRole('searchbox', { name: 'Buscar en el libro' }).fill('diodo zener');
      await expect(page.locator('#resultados > li').first()).toBeVisible();
      await esperar(page);
      await foto('busqueda');
      await page.keyboard.press('Escape');

      await page.goto('#/ejercicios');
      await page.locator('button.cap-cab', { hasText: 'Capítulo 39 ·' }).click();
      await page.locator('button.cap-cab', { hasText: 'Capítulo 39 ·' }).evaluate((e) => window.scrollBy(0, e.getBoundingClientRect().top - 120));
      await esperar(page);
      await foto('ejercicios');

      await page.goto('#/componentes/3d');
      await expect(page.locator('.catalogo3d .tarjeta').first()).toBeVisible();
      await page.locator('.catalogo3d .grupo').first().evaluate((e) => window.scrollBy(0, e.getBoundingClientRect().top - 80));
      await esperar(page);
      await foto('catalogo3d');

      await page.goto('#/componentes');
      await expect(page.locator('.galeria .tarjeta').first()).toBeVisible();
      await page.locator('.galeria .grupo').first().evaluate((e) => window.scrollBy(0, e.getBoundingClientRect().top - 80));
      await esperar(page);
      await foto('galeria');
      await ctx.close();
    }
  }
});
