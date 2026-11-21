// 1.3.1 (qa131-plataforma): the whole-app monkey. A seeded PRNG (mulberry32) picks every action, so a run is
// reproducible by its seed; each action is recorded as data (the «trail»: what was done and where), so a failing run
// can be replayed action by action without the PRNG and shrunk to a minimal reproduction (reducir()).
//
// Actions: taps on controls and on free points, long presses, swipes and two-finger pinches (touch profiles, through
// CDP Input.dispatchTouchEvent), clicks, drags and the wheel (desktop), keys (Tab, Shift+Tab, Enter, Space, Escape,
// arrows), text typed into fields, and «tasks»: a random route of the app (lessons, protoboard, 3D boards, the
// simulator, consoles…), back and forward, rotating the viewport, the «Aa» panel (theme, text size), the search
// dialog, opened and closed.
//
// Oracles: an uncaught exception or unhandled rejection, a console error, a crashed page, a failed request to the
// app's own files (or an HTTP error), text on screen with NaN / undefined / null / [object Object], horizontal
// overflow of the page, a stuck state (a modal that Escape, its close button and Back cannot close; or nothing
// interactive left on screen), the JS heap growing past a threshold over the run, and a WebGL context lost while
// its canvas is still in the page.
import type { CDPSession, Page } from '@playwright/test';

// ------------------------------------------------------------------ PRNG

/** mulberry32: small seeded PRNG, the same as tests/qa/monos.spec.ts. */
export function azar(semilla: number) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { r, entero: (n: number) => Math.floor(r() * n), de: <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]! };
}
export type Azar = ReturnType<typeof azar>;

// ------------------------------------------------------------------ actions as data

export type Accion =
  | { a: 'tocar'; x: number; y: number; d: string }
  | { a: 'larga'; x: number; y: number; d: string }
  | { a: 'arrastrar'; x0: number; y0: number; x1: number; y1: number; d: string }
  | { a: 'pellizcar'; x: number; y: number; abrir: boolean; d: string }
  | { a: 'rueda'; x: number; y: number; dy: number }
  | { a: 'tecla'; k: string; n: number }
  | { a: 'escribir'; x: number; y: number; t: string; enter: boolean; d: string }
  | { a: 'ruta'; hash: string }
  | { a: 'atras' }
  | { a: 'adelante' }
  | { a: 'girar' }
  | { a: 'aa'; boton: number }
  | { a: 'buscar'; t: string };

export function describir(x: Accion): string {
  switch (x.a) {
    case 'tocar':
      return `tocar ${x.d} (${x.x}, ${x.y})`;
    case 'larga':
      return `pulsación larga en ${x.d} (${x.x}, ${x.y})`;
    case 'arrastrar':
      return `arrastrar en ${x.d} (${x.x0}, ${x.y0}) → (${x.x1}, ${x.y1})`;
    case 'pellizcar':
      return `pellizcar (${x.abrir ? 'ampliar' : 'reducir'}) en ${x.d} (${x.x}, ${x.y})`;
    case 'rueda':
      return `rueda ${x.dy} en (${x.x}, ${x.y})`;
    case 'tecla':
      return `tecla ${x.k} ×${x.n}`;
    case 'escribir':
      return `escribir «${x.t}»${x.enter ? ' + Enter' : ''} en ${x.d}`;
    case 'ruta':
      return `ir a ${x.hash}`;
    case 'atras':
      return 'Atrás';
    case 'adelante':
      return 'Adelante';
    case 'girar':
      return 'girar el dispositivo';
    case 'aa':
      return `«Aa»: botón ${x.boton}`;
    case 'buscar':
      return `buscar «${x.t}» y cerrar`;
  }
}

// ------------------------------------------------------------------ routes

/** Main routes of the app (lib/ruta.svelte.ts), the heavy ones among them. */
export const RUTAS_FIJAS = [
  '#/',
  '#/cap05/sec-5.3',
  '#/cap22',
  '#/glosario',
  '#/marcadores',
  '#/simulador',
  '#/simulador/cap05/sec-5.3_led_150ohm',
  '#/simulador/cap42/fig-42.5_filtro_rc',
  '#/simulador/nuevo',
  '#/editor',
  '#/editor/libro/cap42/fig-42.3_op_emisor_comun',
  '#/protoboard',
  '#/componentes',
  '#/componentes/led',
  '#/componentes/3d/resistencia-axial',
  '#/conceptos',
  '#/conceptos/fasores',
  '#/consolas',
  '#/consolas/nes/placa3d',
  '#/consolas/snes/averia',
  '#/consolas/snes/placa2d',
  '#/consolas/gb/fotograma',
  '#/consolas/megadrive/esquema',
  '#/fm7303',
  '#/fm7303/averias',
  '#/proyectos',
  '#/proyectos/sdr/3d',
  '#/proyectos/fuente_laboratorio/placa',
  '#/instrumentos',
  '#/instrumentos/libre',
  '#/instrumentos/practica/1',
  '#/calculadoras',
  '#/calculadoras/deslizamiento',
  '#/repaso',
  '#/repaso/tarjetas',
  '#/repaso/test/cap05',
  '#/ejercicios',
  '#/ejercicios/repaso',
  '#/sincronizacion',
  '#/sincronizacion/copia',
  '#/diagnostico/informe',
  '#/cursos',
  '#/progreso',
  '#/progreso/dominio',
  '#/practicar',
  '#/problema',
  '#/problema/ayer',
  '#/guia',
  '#/etapas',
  '#/docente',
  '#/leccion/cap02/sec-2.7',
  '#/leccion/cap08/sec-8.2',
  '#/leccion/cap22/sec-22.1',
  '#/leccion/consola-snes/snes-averias',
] as const;

// ------------------------------------------------------------------ in-page probe

export interface EstadoMono {
  rechazos: string[];
  contextosPerdidos: string[];
}

/** Installed before the app (addInitScript): unhandled rejections and WebGL contexts lost while in the page. */
export function sondaMono(): void {
  const w = window as unknown as { __mono?: EstadoMono };
  if (w.__mono) return;
  const m: EstadoMono = { rechazos: [], contextosPerdidos: [] };
  w.__mono = m;
  addEventListener('unhandledrejection', (e) => {
    const r = (e as PromiseRejectionEvent).reason;
    m.rechazos.push(String(r instanceof Error ? `${r.name}: ${r.message}` : r).slice(0, 300));
  });
  const original = HTMLCanvasElement.prototype.getContext;
  const vistos = new WeakSet<HTMLCanvasElement>();
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: string, ...resto: unknown[]) {
    const c = (original as (...a: unknown[]) => RenderingContext | null).call(this, tipo, ...resto);
    if (c && /webgl/.test(tipo) && !vistos.has(this)) {
      vistos.add(this);
      const lienzo = this;
      // a context released on purpose (three.js forceContextLoss on dispose) is lost on a canvas being removed
      lienzo.addEventListener('webglcontextlost', () => {
        setTimeout(() => {
          if (lienzo.isConnected) m.contextosPerdidos.push(`${lienzo.className || 'canvas'} en ${location.hash}`);
        }, 0);
      });
    }
    return c;
  } as typeof original;
}

// ------------------------------------------------------------------ the run

export interface Fallo {
  oraculo: string;
  mensaje: string;
  /** Index of the action after which it was seen (-1: while loading). */
  paso: number;
}

export interface OpcionesMono {
  tactil: boolean;
  /** Origin of the app (failed requests elsewhere are not its own). */
  origen: string;
  /** Heap growth that counts as a leak over the run (bytes), measured after a GC. */
  maxCrecimiento?: number;
  /** Every how many actions to run the expensive oracles (text, overflow, stuck state). */
  cada?: number;
}

/** Console noise that is not the app's (SwiftShader, the harness's own block of GitHub). */
const RUIDO = [
  /KHR_parallel_shader_compile/,
  /GPU stall due to ReadPixels/i,
  /Automatic fallback to software WebGL/i,
  /WebGL: too many errors/i,
  /\[\.WebGL-[^\]]*\]/,
  /net::ERR_BLOCKED_BY_CLIENT/,
  /api\.github\.com/,
];

const TEXTOS = ['4,7k', '1000', '-3', 'abc', '', '1e9', '0', '2,2 µF', '330', '0,5 mA', '99999999', 'R1 a b 1k', 'ñ́', '<b>x</b>', '   '];
const BUSQUEDAS = ['diodo zener', 'ohm', 'zzzz', 'transistor', '555', 'é', ''];

interface Objetivo {
  x: number;
  y: number;
  w: number;
  h: number;
  d: string;
  tipo: string;
}

/** Visible controls inside the viewport (nothing that leaves the app, downloads, or talks to GitHub for real). */
function objetivos(page: Page): Promise<Objetivo[]> {
  return page.evaluate(() => {
    const W = innerWidth;
    const H = innerHeight;
    const r: Objetivo[] = [];
    const sel = 'a[href], button, input, select, textarea, summary, [role="button"], [role="tab"], [role="slider"], [role="radio"], [tabindex="0"], canvas, svg[viewBox]';
    for (const el of document.querySelectorAll(sel)) {
      const rc = el.getBoundingClientRect();
      if (rc.width < 4 || rc.height < 4 || rc.bottom < 0 || rc.top > H || rc.right < 0 || rc.left > W) continue;
      if ((el as HTMLButtonElement).disabled || el.closest('[inert]')) continue;
      const href = el.getAttribute('href') ?? '';
      if (/^(https?:|mailto:)/.test(href) || el.hasAttribute('download')) continue;
      const t = ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
      // the performance diagnostic runs for minutes; the synchronisation and the updater talk to GitHub; a file
      // chooser would wait for a file
      if (/^Empezar|Sincronizar ahora|Comprobar ahora|Descargar|Importar|Actualizar ahora|Instalar/.test(t)) continue;
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'file') continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
      const tag = el.tagName.toLowerCase();
      const tipo = tag === 'input' ? `input:${(el as HTMLInputElement).type}` : tag;
      const x = Math.max(rc.left, 0);
      const y = Math.max(rc.top, 0);
      r.push({ x, y, w: Math.min(rc.right, W) - x, h: Math.min(rc.bottom, H) - y, d: `${tipo}${t ? ` «${t.slice(0, 30)}»` : ''}`, tipo });
    }
    return r;
  }) as Promise<Objetivo[]>;
}

const centro = (o: Objetivo) => ({ x: Math.round(o.x + o.w / 2), y: Math.round(o.y + o.h / 2) });

/** Picks the next action from the page as it is now (the PRNG decides; the page only offers the targets). */
export async function elegir(page: Page, az: Azar, tactil: boolean, rutas: readonly string[]): Promise<Accion> {
  const vp = page.viewportSize()!;
  const obj = await objetivos(page).catch(() => [] as Objetivo[]);
  const controles = obj.filter((o) => o.tipo !== 'canvas' && o.tipo !== 'svg');
  const zonas = obj.filter((o) => o.tipo === 'canvas' || o.tipo === 'svg');
  const zona = (): Objetivo => (zonas.length ? az.de(zonas) : { x: 0, y: 0, w: vp.width, h: vp.height, d: 'la pantalla', tipo: '' });
  const t = az.r();
  if (t < 0.34 && controles.length) {
    const o = az.de(controles);
    return { a: 'tocar', ...centro(o), d: o.d };
  }
  if (t < 0.4) return { a: 'tocar', x: Math.round(az.r() * vp.width), y: Math.round(az.r() * vp.height), d: 'un punto' };
  if (t < 0.44) {
    const o = az.r() < 0.6 ? zona() : controles.length ? az.de(controles) : zona();
    return { a: 'larga', x: Math.round(o.x + az.r() * o.w), y: Math.round(o.y + az.r() * o.h), d: o.d };
  }
  if (t < 0.54) {
    const o = zona();
    const x0 = Math.round(o.x + az.r() * o.w);
    const y0 = Math.round(o.y + az.r() * o.h);
    return { a: 'arrastrar', x0, y0, x1: Math.round(x0 + (az.r() - 0.5) * 400), y1: Math.round(y0 + (az.r() - 0.5) * 400), d: o.d };
  }
  if (t < 0.58) {
    const o = zona();
    if (tactil) return { a: 'pellizcar', ...centro(o), abrir: az.r() < 0.5, d: o.d };
    return { a: 'rueda', ...centro(o), dy: Math.round((az.r() - 0.5) * 1200) };
  }
  if (t < 0.63) return { a: 'rueda', x: Math.round(vp.width / 2), y: Math.round(vp.height / 2), dy: Math.round((az.r() - 0.3) * 1500) };
  if (t < 0.71) {
    const k = az.de(['Tab', 'Tab', 'Shift+Tab', 'Enter', 'Space', 'Escape', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown']);
    return { a: 'tecla', k, n: k.startsWith('Arrow') || k === 'Tab' ? 1 + az.entero(4) : 1 };
  }
  if (t < 0.77) {
    const campos = obj.filter((o) => /^input:(text|number|search|tel|)$/.test(o.tipo) || o.tipo === 'textarea');
    if (campos.length) {
      const o = az.de(campos);
      return { a: 'escribir', ...centro(o), t: az.de(TEXTOS), enter: az.r() < 0.5, d: o.d };
    }
    return { a: 'tecla', k: 'Tab', n: 1 };
  }
  if (t < 0.87) return { a: 'ruta', hash: az.de(rutas) };
  if (t < 0.91) return az.r() < 0.7 ? { a: 'atras' } : { a: 'adelante' };
  if (t < 0.93) return { a: 'girar' };
  if (t < 0.97) return { a: 'aa', boton: az.entero(12) };
  return { a: 'buscar', t: az.de(BUSQUEDAS) };
}

async function toque(cdp: CDPSession, tipo: 'touchStart' | 'touchMove' | 'touchEnd', puntos: { x: number; y: number }[]): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: puntos.map((p, id) => ({ x: Math.round(p.x), y: Math.round(p.y), id })) });
}

/** Does one action. Throws only when the harness itself cannot (a target gone is not the app's fault: false). */
export async function hacer(page: Page, x: Accion, cdp: CDPSession | null, base: string): Promise<boolean> {
  try {
    switch (x.a) {
      case 'tocar':
        if (cdp) await page.touchscreen.tap(x.x, x.y);
        else await page.mouse.click(x.x, x.y);
        break;
      case 'larga':
        if (cdp) {
          await toque(cdp, 'touchStart', [x]);
          await page.waitForTimeout(700);
          await toque(cdp, 'touchEnd', []);
        } else {
          await page.mouse.move(x.x, x.y);
          await page.mouse.down();
          await page.waitForTimeout(700);
          await page.mouse.up();
        }
        break;
      case 'arrastrar': {
        const n = 8;
        if (cdp) {
          await toque(cdp, 'touchStart', [{ x: x.x0, y: x.y0 }]);
          for (let k = 1; k <= n; k++) await toque(cdp, 'touchMove', [{ x: x.x0 + ((x.x1 - x.x0) * k) / n, y: x.y0 + ((x.y1 - x.y0) * k) / n }]);
          await toque(cdp, 'touchEnd', []);
        } else {
          await page.mouse.move(x.x0, x.y0);
          await page.mouse.down();
          await page.mouse.move(x.x1, x.y1, { steps: n });
          await page.mouse.up();
        }
        break;
      }
      case 'pellizcar': {
        if (!cdp) break;
        const [d0, d1] = x.abrir ? [30, 140] : [140, 30];
        await toque(cdp, 'touchStart', [{ x: x.x - d0, y: x.y }, { x: x.x + d0, y: x.y }]);
        for (let k = 1; k <= 6; k++) {
          const d = d0 + ((d1 - d0) * k) / 6;
          await toque(cdp, 'touchMove', [{ x: x.x - d, y: x.y + k }, { x: x.x + d, y: x.y - k }]);
        }
        await toque(cdp, 'touchEnd', []);
        break;
      }
      case 'rueda':
        await page.mouse.move(x.x, x.y);
        await page.mouse.wheel(0, x.dy);
        break;
      case 'tecla':
        for (let k = 0; k < x.n; k++) await page.keyboard.press(x.k);
        break;
      case 'escribir':
        await page.mouse.click(x.x, x.y);
        await page.keyboard.press('Control+a');
        if (x.t) await page.keyboard.type(x.t, { delay: 3 });
        else await page.keyboard.press('Backspace');
        if (x.enter) await page.keyboard.press('Enter');
        break;
      case 'ruta':
        await page.evaluate((h) => (location.hash = h.slice(1)), x.hash);
        break;
      case 'atras':
        await page.goBack({ timeout: 5000 }).catch(() => {});
        break;
      case 'adelante':
        await page.goForward({ timeout: 5000 }).catch(() => {});
        break;
      case 'girar': {
        const v = page.viewportSize()!;
        await page.setViewportSize({ width: v.height, height: v.width });
        break;
      }
      case 'aa': {
        const b = page.getByRole('button', { name: 'Tema y tamaño de letra' }).first();
        if (!(await b.isVisible().catch(() => false))) return false;
        await b.click({ timeout: 3000 });
        const panel = page.locator('[role="dialog"], .ajustes, .panel-ajustes').filter({ has: page.getByText('Tema', { exact: false }) }).last();
        const botones = panel.locator('button:visible');
        const n = await botones.count().catch(() => 0);
        if (n) await botones.nth(x.boton % n).click({ timeout: 3000 }).catch(() => {});
        await page.keyboard.press('Escape');
        break;
      }
      case 'buscar': {
        await page.keyboard.press('Control+k');
        const caja = page.getByRole('dialog', { name: 'Buscar en el libro' }).locator('input');
        if (!(await caja.waitFor({ timeout: 3000 }).then(() => true, () => false))) return false;
        await caja.fill(x.t);
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape');
        break;
      }
    }
    // stay inside the app (Back past the first entry, an external page)
    if (!page.url().startsWith(base)) await page.goto(`${base}#/`).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Expensive in-page oracles: broken text, horizontal overflow, an open modal, nothing interactive on screen. */
export function oraculosPagina(): { texto: string[]; desborde: number; ancho: number; modal: string | null; interactivos: number } {
  const W = innerWidth;
  const raiz = document.scrollingElement ?? document.documentElement;
  const desborde = raiz.scrollWidth - W;
  const texto: string[] = [];
  // visible text only, outside the book's code listings and formulas (a netlist may print «null»)
  const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    const s = n.textContent ?? '';
    if (!/\bNaN\b|\bundefined\b|\[object Object\]|\bnull\b|\bInfinity\b/.test(s)) continue;
    const el = n.parentElement;
    if (!el || el.closest('pre, code, script, style, .katex, math, textarea, [data-netlist]')) continue;
    const rc = el.getBoundingClientRect();
    if (!rc.width || !rc.height || getComputedStyle(el).visibility === 'hidden') continue;
    texto.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}: «${s.trim().slice(0, 80)}»`);
  }
  const abierto = [...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]')].find((d) => {
    const rc = d.getBoundingClientRect();
    return rc.width > 0 && rc.height > 0 && getComputedStyle(d).visibility !== 'hidden';
  });
  let interactivos = 0;
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [tabindex="0"]')) {
    const rc = el.getBoundingClientRect();
    if (rc.width > 0 && rc.height > 0 && rc.bottom > 0 && rc.top < innerHeight && !el.closest('[inert]')) interactivos++;
  }
  return {
    texto: texto.slice(0, 5),
    desborde,
    ancho: W,
    modal: abierto ? `${abierto.tagName.toLowerCase()}${abierto.getAttribute('aria-label') ? ` «${abierto.getAttribute('aria-label')}»` : ''}` : null,
    interactivos,
  };
}

/** The JS heap after a forced GC (needs --js-flags=--expose-gc), in bytes; 0 if not measurable. */
export async function memoria(page: Page): Promise<number> {
  return page
    .evaluate(() => {
      const g = (globalThis as unknown as { gc?: () => void }).gc;
      g?.();
      return (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    })
    .catch(() => 0);
}

/** The oracles that listen to the page (exceptions, console, network, crash): one per page. */
export function escuchar(page: Page, opciones: OpcionesMono, anotar: (oraculo: string, mensaje: string) => void): void {
  page.on('pageerror', (e) => anotar('excepcion', `${e.name}: ${e.message}`.slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (RUIDO.some((r) => r.test(t))) return;
    anotar('consola', t.slice(0, 300));
  });
  page.on('crash', () => anotar('cuelgue', 'la pestaña se ha caído'));
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText ?? '';
    if (/ERR_ABORTED|BLOCKED_BY_CLIENT/.test(err) || !r.url().startsWith(opciones.origen)) return;
    anotar('red', `${err} ${new URL(r.url()).pathname}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(opciones.origen)) anotar('red', `HTTP ${r.status()} ${new URL(r.url()).pathname}`);
  });
}

/** Normalised signature of a failure (numbers out), to tell one failure from another. */
export const firma = (f: Pick<Fallo, 'oraculo' | 'mensaje'>) => `${f.oraculo}|${f.mensaje.replace(/\d+(\.\d+)?/g, '#').replace(/#\/[^\s»]*/g, '#/…').slice(0, 140)}`;

export interface ResultadoMono {
  fallos: Fallo[];
  acciones: Accion[];
  heapInicial: number;
  heapFinal: number;
}

/**
 * Runs `acciones` (a trail to replay) or `n` actions chosen by the seed, from `inicio`; stops at the first failure when
 * `pararEnFallo`. The page must have sondaMono installed (addInitScript) and the network of GitHub blocked.
 */
export async function correr(
  page: Page,
  opciones: OpcionesMono & { semilla: number; n: number; inicio: string; acciones?: Accion[]; pararEnFallo?: boolean; rutas?: readonly string[]; registro?: (s: string) => void },
): Promise<ResultadoMono> {
  const fallos: Fallo[] = [];
  const hechas: Accion[] = [];
  let paso = -1;
  const anotar = (oraculo: string, mensaje: string) => fallos.push({ oraculo, mensaje, paso });
  escuchar(page, opciones, anotar);
  const cdp = opciones.tactil ? await page.context().newCDPSession(page) : null;
  const az = azar(opciones.semilla);
  const rutas = opciones.rutas ?? RUTAS_FIJAS;
  const cada = opciones.cada ?? 10;
  await page.goto(`${opciones.origen}${opciones.inicio}`);
  await page.waitForTimeout(1500);
  let heapInicial = 0;
  const total = opciones.acciones ? opciones.acciones.length : opciones.n;
  const revisarSonda = async () => {
    const s = await page.evaluate(() => {
      const m = (window as unknown as { __mono?: EstadoMono }).__mono;
      if (!m) return null;
      const r = { rechazos: m.rechazos.splice(0), perdidos: m.contextosPerdidos.splice(0) };
      return r;
    }).catch(() => null);
    for (const r of s?.rechazos ?? []) anotar('rechazo', r);
    for (const c of s?.perdidos ?? []) anotar('webgl', `contexto WebGL perdido: ${c}`);
  };
  for (paso = 0; paso < total; paso++) {
    if (page.isClosed()) break;
    const x = opciones.acciones ? opciones.acciones[paso]! : await elegir(page, az, opciones.tactil, rutas);
    hechas.push(x);
    opciones.registro?.(`${paso + 1}. ${describir(x)}`);
    await hacer(page, x, cdp, opciones.origen);
    await page.waitForTimeout(120 + (opciones.acciones ? 200 : az.entero(250)));
    await revisarSonda();
    if (paso === 19) heapInicial = await memoria(page);
    if ((paso + 1) % cada === 0 || paso === total - 1) {
      const o = await page.evaluate(oraculosPagina).catch(() => null);
      if (o) {
        for (const t of o.texto) anotar('texto', `texto roto en pantalla: ${t}`);
        if (o.desborde > 2) anotar('desborde', `la página se desplaza en horizontal ${o.desborde} px`);
        // (a phone widens its layout viewport to fit content wider than the screen: the page then shows zoomed out)
        const vp = page.viewportSize();
        if (vp && o.ancho > vp.width + 2) anotar('desborde', `el contenido ensancha la página a ${o.ancho} px en una pantalla de ${vp.width} px`);
        if (o.modal) {
          // a modal open is fine; one that nothing closes is a stuck state
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(300);
          let sigue = (await page.evaluate(oraculosPagina).catch(() => null))?.modal;
          if (sigue) {
            // its own close button (inside the modal, the top one), then «Atrás», as a reader would
            const modal = page.locator('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]').last();
            const cerrar = modal.getByRole('button', { name: /^(Cerrar|Cancelar|Volver|Seguir aquí|Salir|Hecho|Aceptar|×|✕)/ }).first();
            await cerrar.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(300);
            sigue = (await page.evaluate(oraculosPagina).catch(() => null))?.modal;
            if (sigue) {
              await page.goBack({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(500);
              sigue = (await page.evaluate(oraculosPagina).catch(() => null))?.modal;
            }
          }
          if (sigue) anotar('atascado', `un diálogo modal que ni Escape, ni su botón de cerrar, ni «Atrás» cierran: ${sigue}`);
        } else if (o.interactivos === 0) {
          await page.waitForTimeout(1500);
          const o2 = await page.evaluate(oraculosPagina).catch(() => null);
          if (o2 && o2.interactivos === 0 && !o2.modal) anotar('atascado', 'ningún control a la vista');
        }
      }
    }
    if (opciones.pararEnFallo && fallos.length) break;
  }
  paso = total;
  const heapFinal = await memoria(page);
  const max = opciones.maxCrecimiento ?? 0;
  if (max && heapInicial && heapFinal - heapInicial > max) anotar('memoria', `el montón de JS crece ${Math.round((heapFinal - heapInicial) / 1048576)} MB en la prueba`);
  return { fallos, acciones: hechas, heapInicial, heapFinal };
}

/**
 * Shrinks a failing trail (delta debugging, ddmin-like): the prefix up to the failure, then chunks removed while
 * `falla(trail)` still reproduces it. `presupuesto`: most replays.
 */
export async function reducir(acciones: Accion[], falla: (a: Accion[]) => Promise<boolean>, presupuesto = 30): Promise<Accion[]> {
  let actual = acciones;
  let trozos = 2;
  let usados = 0;
  while (actual.length > 1 && usados < presupuesto) {
    const tam = Math.ceil(actual.length / trozos);
    let quitado = false;
    for (let i = 0; i < actual.length && usados < presupuesto; i += tam) {
      const prueba = [...actual.slice(0, i), ...actual.slice(i + tam)];
      if (!prueba.length) continue;
      usados++;
      if (await falla(prueba)) {
        actual = prueba;
        trozos = Math.max(trozos - 1, 2);
        quitado = true;
        break;
      }
    }
    if (!quitado) {
      if (tam <= 1) break;
      trozos = Math.min(trozos * 2, actual.length);
    }
  }
  return actual;
}
