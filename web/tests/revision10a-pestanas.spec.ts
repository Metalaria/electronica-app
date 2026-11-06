// Review 10a (copy of the helpers of datos10-pestanas.spec.ts). 1.0: one active tab at a time (lib/pestana-activa.ts), with two and three REAL Chromium pages of one context (the same
// localStorage, Web Locks and BroadcastChannel). Every page logs its own writes of the reader's data (localStorage
// `epa:*`, with the time) so the checks can prove that no two tabs ever write in the same interval and that a paused
// tab writes nothing. Automation switches the gate off unless the page sets `__epaPestanaUnica` (as here).
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.datos10.config.ts tests/datos10-pestanas.spec.ts
import { createRequire } from 'node:module';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

interface Ventana {
  __epaEstadoPestana?: () => string;
  __epaEscrituras: [number, string][];
  __epaPruebasDiario: { registrarActividad(t: string, n: number): void; cargar(): Promise<void> };
}

async function preparar(context: BrowserContext, o: { sinCerrojos?: boolean } = {}): Promise<void> {
  await context.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await context.addInitScript((sinCerrojos) => {
    const w = window as unknown as Ventana & Record<string, unknown>;
    w.__epaPestanaUnica = true;
    w.__epaEsperasPestana = { ceder: 1500, propia: 1200, latido: 300 };
    w.__epaPruebasDiario = {} as Ventana['__epaPruebasDiario'];
    // (the log of this tab's writes survives its reloads: sessionStorage is the tab's)
    const poner = Storage.prototype.setItem;
    const registro = (): [number, string][] => JSON.parse(sessionStorage.getItem('__epaEscrituras') ?? '[]');
    Object.defineProperty(w, '__epaEscrituras', { get: registro, configurable: true });
    Storage.prototype.setItem = function (k: string, v: string) {
      if (this === localStorage && k.startsWith('epa:'))
        poner.call(sessionStorage, '__epaEscrituras', JSON.stringify([...registro(), [performance.timeOrigin + performance.now(), k, w.__epaEstadoPestana?.() ?? '', (new Error().stack ?? '').split('\n').slice(2, 7).join(' | ')]]));
      return poner.call(this, k, v);
    };
    if (sinCerrojos) Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined, configurable: true });
  }, !!o.sinCerrojos);
}

// (a page reloading — taking the app back — has no context for a moment: «recargando»)
const estado = (p: Page) => p.evaluate(() => (window as unknown as Ventana).__epaEstadoPestana?.() ?? 'sin-puerta').catch(() => 'recargando');
const pantalla = (p: Page) => p.locator('.epa-pestana');
const ahora = (p: Page) => p.evaluate(() => performance.timeOrigin + performance.now());
const escrituras = (p: Page) => p.evaluate(() => (window as unknown as Ventana).__epaEscrituras);
/** When the page became the active tab (lib/pestana-activa.ts sets it for the tests). */
const activaDesde = (p: Page) => p.evaluate(() => (window as unknown as { __epaActivaDesde?: number }).__epaActivaDesde ?? 0);

async function abrir(context: BrowserContext): Promise<Page> {
  const p = await context.newPage();
  await p.goto('/#/');
  await expect.poll(() => estado(p)).not.toBe('decidiendo');
  return p;
}

async function esperarActiva(p: Page): Promise<void> {
  await expect.poll(() => estado(p), { timeout: 20_000 }).toBe('activa');
  await p.waitForFunction(() => typeof (window as unknown as Ventana).__epaPruebasDiario.cargar === 'function');
  await p.evaluate(() => (window as unknown as Ventana).__epaPruebasDiario.cargar());
}

/** «Usar aquí» on `p`, then waits until it is the active tab (it may reload). */
async function usarAqui(p: Page): Promise<void> {
  await pantalla(p).getByRole('button', { name: 'Usar aquí' }).click();
  await esperarActiva(p);
}

const pasos = (p: Page) =>
  p.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, { pasos: number }>;
    return Object.entries(m)
      .filter(([k]) => k.includes('@') && !k.endsWith('~'))
      .reduce((s, [, v]) => s + v.pasos, 0);
  });


// r10a·3: a PAUSED tab navigated by the browser (Back/Forward, a typed hash — the page is inert, but history still
// routes) mounts pages; every write of `epa:*` it makes after pausing is logged. Expected: none.
test('r10a·3 · una pestaña en pausa que navega (atrás, hash) no escribe nada en epa:*', async ({ context }) => {
  await preparar(context);
  const a = await abrir(context);
  await esperarActiva(a);
  const rutas = ['#/editor', '#/protoboard', '#/simulador', '#/docente', '#/practicar', '#/repaso', '#/ejercicios', '#/progreso', '#/'];
  for (const r of rutas) {
    await a.evaluate((h) => (location.hash = h), r);
    await a.waitForTimeout(700);
  }
  const b = await abrir(context);
  await pantalla(b).getByRole('button', { name: 'Usar aquí' }).click();
  await expect.poll(() => estado(a)).toBe('pausada');
  const tPausa = await ahora(a);
  await esperarActiva(b);
  for (const r of rutas) {
    await a.evaluate((h) => (location.hash = h), r);
    await a.waitForTimeout(900);
  }
  await a.evaluate(() => history.back());
  await a.waitForTimeout(900);
  const despues = (await escrituras(a)).filter(([t]) => t > tPausa).map(([, k]) => k);
  console.log('r10a·3 escrituras en pausa:', JSON.stringify(despues));
  expect(despues).toEqual([]);
});

// r10a·4: a timed own exam started in tab A; the reader opens the app in tab B («Usar aquí», e.g. to look something up
// in the book) and A is paused. A's exam clock (HacerExamen.svelte setInterval) keeps running while paused: at the
// time limit it hands the exam in — the result's write is refused (estado.svelte.ts swallows it) — and removes the
// draft (borrador.ts, localStorage directly). Expected: the answers survive somewhere (the draft or a stored result).
test('r10a·4 · un examen con tiempo en una pestaña en pausa: al acabarse el tiempo no se pierden las respuestas', async ({ context }) => {
  test.setTimeout(150_000);
  await preparar(context);
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    }
  });
  const a = await abrir(context);
  await esperarActiva(a);
  await a.goto('/#/docente/nuevo/examen');
  await expect(a.locator('[data-selector]')).toBeVisible();
  await a.locator('[data-titulo]').fill('Un minuto');
  await a.locator('[data-minutos]').fill('1');
  await a.locator('[data-filtro-parte]').selectOption('cap05');
  await a.locator('li[data-entrada="pregunta:cap05-01"] [data-anadir]').click();
  await a.locator('[data-guardar]').click();
  await a.locator('[data-empezar]').click();
  await expect(a.locator('[data-reloj]')).toBeVisible();
  await a.locator('[data-item-examen="1"]').getByRole('radio').first().check();
  const id = await a.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:docente') ?? '{}').propios ?? {})[0]!);
  const borrador = () => a.evaluate((i) => localStorage.getItem(`epa:docente-en-curso:${i}`), id);
  expect(JSON.parse((await borrador())!).respuestas['1']).toBeTruthy();
  // the reader opens the book in tab B and uses it there: A is paused with the exam on screen
  const b = await abrir(context);
  await pantalla(b).getByRole('button', { name: 'Usar aquí' }).click();
  await expect.poll(() => estado(a)).toBe('pausada');
  await esperarActiva(b);
  await b.goto('/#/');
  // past the time limit (1 minute from the start)
  await a.waitForTimeout(65_000);
  const resultados = await b.evaluate(() => Object.values(JSON.parse(localStorage.getItem('epa:docente-resultados') ?? '{}').resultados ?? {}).filter((r) => !(r as { borrado?: number }).borrado).length);
  const quedaBorrador = await borrador();
  console.log('r10a·4: borrador', quedaBorrador ? 'presente' : 'BORRADO', '· resultados guardados', resultados, '· URL de A', a.url());
  expect(quedaBorrador !== null || resultados > 0, 'el examen con sus respuestas se ha perdido').toBe(true);
});
