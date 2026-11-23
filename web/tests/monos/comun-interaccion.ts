// 1.3.1 (qa131-interaccion): the small harness of the seeded «monkeys» of the interactive features (precise placement on
// the breadboard, the boards in 3D, «Busque la avería», the real Brymen with a fake cable, the «Monte» card): a seeded
// PRNG, a trail of what was done (printed when an oracle fails, so a seed is replayed exactly), real touches through
// CDP, and the oracles — errors and unhandled rejections, NaN / undefined / [object Object] on screen or in an SVG
// attribute or an inline style, horizontal scroll, and counters of what a page leaves behind (listeners on window and
// document, intervals, pending timeouts, animation frames that keep coming while idle, live ResizeObservers, WebGL
// contexts), installed before the app's scripts by `instrumentar`.
import { expect, type BrowserContext, type CDPSession, type Page } from '@playwright/test';

/** mulberry32: a small seeded PRNG (the same seed gives the same storm). */
export function azar(semilla: number) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    r,
    entre: (a0: number, a1: number) => a0 + (a1 - a0) * r(),
    entero: (a0: number, a1: number) => Math.floor(a0 + (a1 - a0 + 1) * r()),
    uno: <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!,
    pesos: <T extends string>(p: Record<T, number>): T => {
      const t = Object.values<number>(p).reduce((x, y) => x + y, 0);
      let u = r() * t;
      for (const [k, w] of Object.entries<number>(p)) if ((u -= w) < 0) return k as T;
      return Object.keys(p)[0] as T;
    },
  };
}

/** The seeds to run (MONO_SEMILLAS=1,2,3) and actions per seed (MONO_ACCIONES), with defaults small enough for the suite. */
export function semillas(defecto: number[]): number[] {
  const e = process.env.MONO_SEMILLAS;
  return e ? e.split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x)) : defecto;
}
export const ACCIONES = Number(process.env.MONO_ACCIONES ?? 60);

/** What was done, in order (printed with the seed when something fails). */
export class Rastro {
  pasos: string[] = [];
  constructor(readonly semilla: number) {}
  apuntar(s: string) {
    this.pasos.push(s);
  }
  toString() {
    return `semilla ${this.semilla}, ${this.pasos.length} acciones:\n  ${this.pasos.slice(-40).join('\n  ')}`;
  }
}

export interface Registro {
  errores: string[];
  oyentes: Record<string, number>;
  /** Live listeners on window/document: [id, «type: where it was added»]. */
  pilas: [number, string][];
  intervalos: number;
  esperas: number;
  observadores: number;
  gl: number;
  glPerdidos: number;
  cuadros: number;
}

/**
 * Installs the counters before the app's scripts (window.__mono): listeners added to window, document, <html> and
 * <body> and not removed (once and AbortSignal listeners accounted), live intervals, pending timeouts, animation
 * frames run, live ResizeObservers (observing something), WebGL contexts created and lost; errors and unhandled
 * rejections.
 */
export async function instrumentar(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    type Reg = { errores: string[]; oyentes: Record<string, number>; pilas: Map<number, string>; intervalos: Set<number>; esperas: Set<number>; observadores: Set<unknown>; gl: number; glPerdidos: number; cuadros: number };
    const reg: Reg = { errores: [], oyentes: {}, pilas: new Map(), intervalos: new Set(), esperas: new Set(), observadores: new Set(), gl: 0, glPerdidos: 0, cuadros: 0 };
    let n = 0;
    /** Where a listener was added (its first frames of the app); Playwright's own injected listeners are not counted. */
    const pila = () => (new Error().stack ?? '').split('\n').slice(3, 6).map((x) => x.trim()).join(' < ');
    const w = window as unknown as { __mono: unknown };
    const globales = () => [window, document, document.documentElement, document.body];
    const vivos = new WeakMap<object, Map<string, Map<unknown, number>>>();
    const add = EventTarget.prototype.addEventListener;
    const rem = EventTarget.prototype.removeEventListener;
    const clave = (t: string, o: unknown) => `${t}|${typeof o === 'boolean' ? o : !!(o as { capture?: boolean } | undefined)?.capture}`;
    const quitar = (obj: object, t: string, f: unknown, o: unknown) => {
      const s = vivos.get(obj)?.get(clave(t, o));
      const id = s?.get(f);
      if (id === undefined) return;
      s!.delete(f);
      reg.pilas.delete(id);
      reg.oyentes[t] = (reg.oyentes[t] ?? 1) - 1;
    };
    EventTarget.prototype.addEventListener = function (this: EventTarget, t: string, f: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions) {
      if (f && globales().includes(this as never) && !(typeof o === 'object' && o?.once)) {
        let m = vivos.get(this);
        if (!m) vivos.set(this, (m = new Map()));
        const k = clave(t, o);
        let s = m.get(k);
        if (!s) m.set(k, (s = new Map()));
        const de = pila();
        if (!s.has(f) && !/playwright|__pw|UtilityScript|InjectedScript/i.test(de)) {
          s.set(f, ++n);
          reg.pilas.set(n, `${t}: ${de}`);
          reg.oyentes[t] = (reg.oyentes[t] ?? 0) + 1;
          const sig = typeof o === 'object' ? o?.signal : undefined;
          if (sig) add.call(sig, 'abort', () => quitar(this, t, f, o));
        }
      }
      return add.call(this, t, f, o);
    };
    EventTarget.prototype.removeEventListener = function (this: EventTarget, t: string, f: EventListenerOrEventListenerObject | null, o?: boolean | EventListenerOptions) {
      if (f) quitar(this, t, f, o);
      return rem.call(this, t, f, o);
    };
    const si = window.setInterval.bind(window);
    const ci = window.clearInterval.bind(window);
    const st = window.setTimeout.bind(window);
    const ct = window.clearTimeout.bind(window);
    window.setInterval = ((f: TimerHandler, ms?: number, ...a: unknown[]) => {
      const id = si(f, ms, ...a);
      reg.intervalos.add(id);
      return id;
    }) as typeof setInterval;
    window.clearInterval = ((id?: number) => {
      if (id !== undefined) reg.intervalos.delete(id);
      ci(id);
    }) as typeof clearInterval;
    window.setTimeout = ((f: TimerHandler, ms?: number, ...a: unknown[]) => {
      if (typeof f !== 'function') return st(f, ms, ...a);
      const id: number = st(() => {
        reg.esperas.delete(id);
        (f as (...x: unknown[]) => void)(...a);
      }, ms);
      reg.esperas.add(id);
      return id;
    }) as typeof setTimeout;
    window.clearTimeout = ((id?: number) => {
      if (id !== undefined) reg.esperas.delete(id);
      ct(id);
    }) as typeof clearTimeout;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f: FrameRequestCallback) =>
      raf((t) => {
        reg.cuadros++;
        f(t);
      });
    const RO = window.ResizeObserver;
    if (RO)
      window.ResizeObserver = class extends RO {
        observe(t: Element, o?: ResizeObserverOptions) {
          reg.observadores.add(this);
          super.observe(t, o);
        }
        disconnect() {
          reg.observadores.delete(this);
          super.disconnect();
        }
      };
    const gc = HTMLCanvasElement.prototype.getContext;
    const vistos = new WeakSet<object>();
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, t: string, o?: unknown) {
      const c = (gc as (this: HTMLCanvasElement, t: string, o?: unknown) => RenderingContext | null).call(this, t, o);
      if (c && /webgl/.test(t) && !vistos.has(c)) {
        vistos.add(c);
        reg.gl++;
        add.call(this, 'webglcontextlost', () => reg.glPerdidos++);
      }
      return c;
    } as typeof gc;
    add.call(window, 'error', (e: Event) => reg.errores.push(`error: ${(e as ErrorEvent).message}`));
    add.call(window, 'unhandledrejection', (e: Event) => reg.errores.push(`promesa: ${String((e as PromiseRejectionEvent).reason?.stack ?? (e as PromiseRejectionEvent).reason)}`));
    w.__mono = {
      reg,
      resumen: () => ({
        errores: [...reg.errores],
        oyentes: { ...reg.oyentes },
        pilas: [...reg.pilas.entries()],
        intervalos: reg.intervalos.size,
        esperas: reg.esperas.size,
        observadores: reg.observadores.size,
        gl: reg.gl,
        glPerdidos: reg.glPerdidos,
        cuadros: reg.cuadros,
      }),
    };
  });
}

export const registro = (page: Page): Promise<Registro> => page.evaluate(() => (window as unknown as { __mono: { resumen(): Registro } }).__mono.resumen());

/** Errors seen by Playwright (console errors and page errors), collected from now on. */
export function errores(page: Page, ignorar: RegExp[] = []): string[] {
  const e: string[] = [];
  const vale = (t: string) => !ignorar.some((r) => r.test(t));
  page.on('pageerror', (x) => vale(x.message) && e.push(`pageerror: ${x.message}`));
  page.on('console', (m) => m.type() === 'error' && vale(m.text()) && e.push(`console: ${m.text()}`));
  return e;
}

/** NaN, undefined or [object Object] on screen, in an SVG attribute or in an inline style; horizontal scroll. */
export async function sinBasura(page: Page, rastro: Rastro, donde = 'body') {
  const r = await page.evaluate((sel) => {
    const raiz = document.querySelector(sel) ?? document.body;
    const malo = /\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b/;
    const fallos: string[] = [];
    const texto = (raiz as HTMLElement).innerText ?? '';
    const m = texto.match(new RegExp(`.{0,40}(${malo.source}).{0,40}`));
    if (m) fallos.push(`texto: «${m[0]}»`);
    for (const el of raiz.querySelectorAll('*')) {
      for (const a of el.attributes) {
        if ((el instanceof SVGElement || a.name === 'style') && /NaN|Infinity/.test(a.value)) fallos.push(`${el.tagName}[${a.name}="${a.value.slice(0, 80)}"]`);
        else if (a.name.startsWith('aria-') && malo.test(a.value)) fallos.push(`${el.tagName}[${a.name}="${a.value.slice(0, 80)}"]`);
      }
      if (fallos.length > 5) break;
    }
    const ancho = document.documentElement.scrollWidth - innerWidth;
    if (ancho > 1) fallos.push(`desplazamiento horizontal de ${ancho} px`);
    return fallos;
  }, donde);
  expect(r, `basura en pantalla (${rastro})`).toEqual([]);
}

export type P = [number, number];

/**
 * Real touches through CDP (several fingers at once). Finger k of `bajar` has id k + 1; `mover`/`deslizar` take the
 * ids of the fingers still down when some were lifted (CDP: touchEnd with points lifts those, with none lifts all).
 */
export class Dedos {
  constructor(
    private cdp: CDPSession,
    private page: Page,
  ) {}
  private enviar(type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', pts: P[], ids?: number[]) {
    return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], k) => ({ x, y, id: ids?.[k] ?? k + 1, radiusX: 4, radiusY: 4, force: 1 })) });
  }
  bajar(pts: P[]) {
    return this.enviar('touchStart', pts);
  }
  mover(pts: P[], ids?: number[]) {
    return this.enviar('touchMove', pts, ids);
  }
  /** Lifts every finger. */
  soltar() {
    return this.enviar('touchEnd', []);
  }
  /** Lifts only these fingers (their ids and where they are). */
  levantar(pts: P[], ids: number[]) {
    return this.enviar('touchEnd', pts, ids);
  }
  cancelar() {
    return this.enviar('touchCancel', []);
  }
  /** Fingers from `de` to `a` in `n` steps (still down). */
  async deslizar(de: P[], a: P[], n = 8, ms = 16, ids?: number[]) {
    for (let k = 1; k <= n; k++) {
      await this.mover(de.map(([x, y], i) => [x + ((a[i]![0] - x) * k) / n, y + ((a[i]![1] - y) * k) / n] as P), ids);
      if (ms) await this.page.waitForTimeout(ms);
    }
  }
  async toque(p: P, ms = 40) {
    await this.bajar([p]);
    if (ms) await this.page.waitForTimeout(ms);
    await this.soltar();
  }
}

/**
 * What a page leaves behind once left: compared with the registry before it was entered. Listeners on window and
 * document, intervals, ResizeObservers must come back to where they were (a small tolerance for the app's own lazy
 * singletons, set once); animation frames must stop.
 */
export async function sinFugas(page: Page, antes: Registro, rastro: Rastro, tolerancia = 0) {
  await page.waitForTimeout(1200);
  const d = await registro(page);
  const tipos = new Set([...Object.keys(antes.oyentes), ...Object.keys(d.oyentes)]);
  const viejos = new Set(antes.pilas.map(([id]) => id));
  const nuevos = d.pilas.filter(([id]) => !viejos.has(id)).map(([, p]) => p);
  const crecidos = [...tipos]
    .filter((t) => (d.oyentes[t] ?? 0) - (antes.oyentes[t] ?? 0) > tolerancia)
    .map((t) => `${t}: ${antes.oyentes[t] ?? 0} → ${d.oyentes[t] ?? 0} · ${nuevos.filter((p) => p.startsWith(`${t}:`)).join(' | ')}`);
  expect(crecidos, `oyentes que se quedan en window/document (${rastro})`).toEqual([]);
  expect(d.intervalos - antes.intervalos, `intervalos que siguen (${rastro})`).toBeLessThanOrEqual(tolerancia);
  expect(d.observadores - antes.observadores, `ResizeObserver que siguen (${rastro})`).toBeLessThanOrEqual(tolerancia);
  const c0 = d.cuadros;
  await page.waitForTimeout(1000);
  const c1 = (await registro(page)).cuadros;
  expect(c1 - c0, `cuadros de animación que siguen pidiéndose sin nada en pantalla (${rastro})`).toBeLessThan(5);
  return d;
}
