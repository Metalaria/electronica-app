// Node side of the QA harness: preparing a page (probe, listeners for errors, console and network), visiting a
// route and waiting until it is quiet, running the in-page checks and recording findings per test as JSON
// lines in tests/qa/informe/crudo/ (informe.ts merges them into the report).
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { comprobarPagina, type Crudo, type OpcionesComprobar } from './comprobaciones.ts';
import { instalarSonda, type EstadoSonda } from './sonda.ts';
import { perfilDe, type Perfil } from './perfiles.ts';
import type { Ruta } from './rutas.ts';

export const INFORME = process.env.QA_INFORME ? `${process.env.QA_INFORME.replace(/\/$/, '')}/` : new URL('./informe/', import.meta.url).pathname;
export const CRUDO = `${INFORME}crudo/`;
export const CAPTURAS = `${INFORME}capturas/`;

export type Severidad = Crudo['sev'];

export interface Hallazgo extends Crudo {
  ruta: string;
  perfil: string;
  prueba: string;
  captura?: string;
  semilla?: number;
  pasos?: string[];
}

/** Coverage counters a test adds to the report («cobertura»). */
export type Cobertura = Record<string, number>;

const MAX_CAPTURAS = 12;

export class Registro {
  readonly perfil: Perfil;
  readonly prueba: string;
  ruta = '';
  private archivo: string;
  private capturas = 0;
  private firmas = new Set<string>();
  page: Page | null = null;
  /** Steps of the monkey, attached to the findings it causes. */
  pasos: string[] | null = null;
  semilla: number | undefined;
  /** Console messages that the current action expects (e.g. ngspice's own errors on purpose). */
  silenciar: RegExp[] = [];

  constructor(info: TestInfo) {
    this.perfil = perfilDe(info.project.name);
    this.prueba = info.titlePath.slice(1).join(' › ');
    mkdirSync(CRUDO, { recursive: true });
    mkdirSync(CAPTURAS, { recursive: true });
    const id = createHash('sha1').update(`${info.project.name}|${info.file}|${this.prueba}`).digest('hex').slice(0, 12);
    this.archivo = `${CRUDO}${info.project.name}-${id}.jsonl`;
  }

  private t0 = Date.now();
  /** QA_TRAZA=1: one line per step on the console (to see where a long test spends its time). */
  traza(m: string): void {
    if (process.env.QA_TRAZA) console.log(`[${this.perfil.id} ${((Date.now() - this.t0) / 1000).toFixed(1)} s] ${m}`);
  }

  async anotar(c: Crudo, extra: Partial<Hallazgo> = {}): Promise<void> {
    const h: Hallazgo = { ...c, ruta: this.ruta, perfil: this.perfil.id, prueba: this.prueba, ...extra };
    if (this.pasos) {
      h.pasos = this.pasos.slice(-25);
      h.semilla = this.semilla;
    }
    const k = `${c.sev}|${c.tipo}|${c.firma}`;
    if (!this.firmas.has(k) && ['error', 'funcional', 'visual'].includes(c.sev) && this.capturas < MAX_CAPTURAS && this.page && !this.page.isClosed()) {
      this.firmas.add(k);
      const nombre = `${createHash('sha1').update(`${this.perfil.id}|${k}`).digest('hex').slice(0, 14)}.jpg`;
      try {
        await this.page.screenshot({ path: `${CAPTURAS}${nombre}`, type: 'jpeg', quality: 40, scale: 'css', timeout: 8000 });
        h.captura = `capturas/${nombre}`;
        this.capturas++;
      } catch {
        /* the page is gone */
      }
    }
    appendFileSync(this.archivo, JSON.stringify({ k: 'hallazgo', ...h }) + '\n');
  }

  cobertura(c: Cobertura): void {
    appendFileSync(this.archivo, JSON.stringify({ k: 'cobertura', perfil: this.perfil.id, prueba: this.prueba, ...c }) + '\n');
  }
}

/** Console noise that is not the app's (Chromium/SwiftShader messages). */
const RUIDO = [/KHR_parallel_shader_compile extension not supported/, /GPU stall due to ReadPixels/i, /Automatic fallback to software WebGL/i, /WebGL: too many errors/i, /\[\.WebGL-[^\]]*\]/];

/** Probe, listeners and popups blocked. Call once per page, before the first navigation. */
export async function prepararPagina(page: Page, reg: Registro): Promise<void> {
  reg.page = page;
  await page.addInitScript(instalarSonda);
  page.on('pageerror', (e) => {
    void reg.anotar({ sev: 'error', tipo: 'excepcion', firma: (e.message || String(e)).slice(0, 120), msg: `Excepción no capturada: ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 4).join('\n')}` });
  });
  page.on('console', (m) => {
    const t = m.type();
    if (t !== 'error' && t !== 'warning') return;
    const txt = m.text();
    if (RUIDO.some((r) => r.test(txt)) || reg.silenciar.some((r) => r.test(txt))) return;
    // the location is the stable part of the message (numbers in the text vary)
    const firma = txt.replace(/\d+(\.\d+)?/g, '#').slice(0, 120);
    void reg.anotar({ sev: t === 'error' ? 'error' : 'rendimiento', tipo: t === 'error' ? 'consola-error' : 'consola-aviso', firma, msg: `console.${t}: ${txt.slice(0, 400)}` });
  });
  page.on('response', (r) => {
    if (r.status() >= 400) {
      const u = new URL(r.url());
      void reg.anotar({ sev: 'error', tipo: 'red', firma: `${r.status()} ${u.pathname.replace(/\d+/g, '#')}`, msg: `HTTP ${r.status()} al pedir ${u.pathname}` });
    }
  });
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText ?? '';
    // cancelled on purpose (navigation, AbortController) is not a failure
    if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(err)) return;
    const u = new URL(r.url());
    if (u.hostname !== 'localhost') return;
    const msg = `Petición fallida (${err}): ${u.pathname}`;
    // a test that cuts the network on purpose silences its own failures
    if (reg.silenciar.some((x) => x.test(msg))) return;
    void reg.anotar({ sev: 'error', tipo: 'red', firma: `${err} ${u.pathname.replace(/\d+/g, '#')}`, msg });
  });
  page.on('crash', () => {
    void reg.anotar({ sev: 'error', tipo: 'cuelgue', firma: 'la pestaña se ha caído', msg: 'La pestaña del navegador se ha caído (crash del renderizador).' });
  });
  page.on('dialog', (d) => void d.dismiss().catch(() => {}));
  page.on('download', (d) => void d.cancel().catch(() => {}));
  page.context().on('page', (p) => {
    if (p !== page) void p.close().catch(() => {});
  });
}

/** A new context with the profile's options (the projects set them) and a prepared page. */
export async function nuevaPagina(context: BrowserContext, reg: Registro): Promise<Page> {
  const page = await context.newPage();
  await prepararPagina(page, reg);
  return page;
}

/** Waits until the page is quiet: no DOM changes (outside SVG and canvas) for `quieto` ms, no loading placeholder. */
export async function esperarCalma(page: Page, max = 8000, quieto = 500): Promise<boolean> {
  const fin = Date.now() + max;
  while (Date.now() < fin) {
    const ok = await page
      .evaluate((q) => {
        const qa = (window as unknown as { __qa?: EstadoSonda }).__qa;
        if (!qa || document.readyState !== 'complete') return false;
        const cargando = [...document.querySelectorAll('.cargando, [aria-busy="true"]')].some((e) => (e as HTMLElement).offsetParent !== null || e.getClientRects().length > 0);
        return !cargando && performance.now() - qa.ultimaMutacion > q;
      }, quieto)
      .catch(() => false);
    if (ok) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

export interface ResultadoVisita {
  calma: boolean;
  ms: number;
  contextos: number;
}

/** Opens the settings panel, the search or the tools menu (route actions). */
async function hacerAccion(page: Page, r: Ruta): Promise<void> {
  if (r.accion === 'ajustes') await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click({ timeout: 10_000 });
  else if (r.accion === 'buscar') {
    await page.keyboard.press('Control+k');
    const caja = page.getByRole('dialog', { name: 'Buscar en el libro' }).locator('input');
    await caja.waitFor({ timeout: 10_000 });
    await caja.fill('diodo zener');
  } else if (r.accion === 'menu') {
    const b = page.getByRole('button', { name: /^(Más|Herramientas)/ }).first();
    if (await b.isVisible().catch(() => false)) await b.click();
  } else if (r.accion === 'visor') {
    const id = r.hash.split('/').pop()!;
    const fig = page.locator(`[id="${id}"]`);
    await fig.scrollIntoViewIfNeeded({ timeout: 10_000 });
    // a plain figure is a button «Ampliar la figura N»; a live one has «Abrir la figura N en grande»
    const boton = fig.getByRole('button', { name: /^(Ampliar|Abrir .* en grande)/ }).first();
    await boton.click({ timeout: 10_000 });
  }
}

/** Closes any overlay the action opened (Escape, then «Atrás» if one is still open). */
export async function cerrarCapas(page: Page): Promise<void> {
  for (let k = 0; k < 3; k++) {
    const abierta = await page.evaluate(() => !!document.querySelector('[role="dialog"], .capa-protoboard, .visor-figura, .buscador, html.bloqueado')).catch(() => false);
    if (!abierta) return;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
}

/**
 * Visits a route (a full load when `recarga`, else a hash change like a tap on a link), waits until it is
 * quiet, runs the checks and records the findings. Returns timing and WebGL contexts.
 */
export async function visitar(page: Page, reg: Registro, r: Ruta, recarga: boolean, op: Partial<OpcionesComprobar> = {}): Promise<ResultadoVisita> {
  reg.ruta = r.id;
  reg.traza(r.id);
  const t0 = Date.now();
  await page.evaluate(() => (window as unknown as { __qa?: EstadoSonda }).__qa?.marcar()).catch(() => {});
  try {
    if (recarga) await page.goto(`/${r.hash}`, { waitUntil: 'load', timeout: 60_000 });
    else
      await page.evaluate((h) => {
        if (location.hash === h) location.reload();
        else location.hash = h;
      }, r.hash);
  } catch (e) {
    await reg.anotar({ sev: 'error', tipo: 'navegacion', firma: String(e).slice(0, 80), msg: `No se pudo abrir ${r.hash}: ${String(e).slice(0, 200)}` });
    return { calma: false, ms: Date.now() - t0, contextos: 0 };
  }
  let calma = await esperarCalma(page, r.pesada ? 20_000 : 8000);
  if (r.accion) {
    try {
      await hacerAccion(page, r);
      calma = await esperarCalma(page, 6000);
    } catch (e) {
      await reg.anotar({ sev: 'funcional', tipo: 'accion', firma: `${r.accion}: ${String(e).split('\n')[0]!.slice(0, 80)}`, msg: `No se pudo hacer «${r.accion}» en ${r.hash}: ${String(e).split('\n')[0]}` });
    }
  }
  const ms = Date.now() - t0;
  if (!calma) await reg.anotar({ sev: 'rendimiento', tipo: 'sin-calma', firma: r.grupo, msg: `La página no se queda quieta (cambia el DOM o sigue «cargando») tras ${Math.round(ms / 1000)} s.` });
  const contextos = await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: !!r.completa, accesibilidad: true, ...op });
  if (r.accion) await cerrarCapas(page);
  return { calma, ms, contextos };
}

/** Reads the probe (shifts, flashes, long tasks, WebGL) and runs the in-page checks. */
export async function recogerYComprobar(page: Page, reg: Registro, op: OpcionesComprobar): Promise<number> {
  const sonda = await page
    .evaluate(() => {
      const qa = (window as unknown as { __qa?: EstadoSonda }).__qa;
      if (!qa) return null;
      return { inicio: qa.inicio, ahora: performance.now(), d: qa.desplazamientos, t: qa.tareasLargas, f: qa.destellos, gl: qa.contextosVivos() };
    })
    .catch(() => null);
  if (!sonda) return 0;
  const cls = sonda.d.filter((x) => x.t >= sonda.inicio).reduce((s, x) => s + x.valor, 0);
  if (cls > 0.1) {
    const fuentes = [...new Set(sonda.d.flatMap((x) => x.fuentes))].slice(0, 3).join(' | ');
    await reg.anotar({ sev: 'visual', tipo: 'cls', firma: fuentes || 'sin fuente', msg: `Desplazamiento acumulado del diseño (CLS) de ${cls.toFixed(3)} al cargar; mueve: ${fuentes}.` });
  }
  for (const f of sonda.f.filter((x) => x.t >= sonda.inicio))
    await reg.anotar({ sev: 'visual', tipo: 'destello', firma: f.firma, msg: `Algo aparece y desaparece en ${f.ms} ms empujando el contenido (${f.alto} px de alto): «${f.texto || '(sin texto)'}».` });
  // long tasks once the page was up (the checks below are excluded: they run after this read)
  const largas = sonda.t.filter((x) => x.t >= sonda.inicio && x.ms > 200);
  if (largas.length) {
    const peor = Math.max(...largas.map((x) => x.ms));
    await reg.anotar({ sev: 'rendimiento', tipo: 'tarea-larga', firma: reg.ruta.split(':')[0]!, msg: `${largas.length} tarea(s) de más de 200 ms en el hilo principal (la peor, ${Math.round(peor)} ms) al abrir o usar la página.` });
  }
  if (sonda.gl > 2) await reg.anotar({ sev: 'rendimiento', tipo: 'webgl-contextos', firma: reg.ruta.split(':')[0]!, msg: `${sonda.gl} contextos WebGL vivos a la vez (en la tableta, más de unos pocos agota la GPU).` });
  const crudos = await page.evaluate(comprobarPagina, op).catch((e: unknown) => [{ sev: 'error', tipo: 'comprobacion', firma: String(e).slice(0, 80), msg: `Las comprobaciones no han podido ejecutarse: ${String(e).slice(0, 200)}` } as Crudo]);
  for (const c of crudos) await reg.anotar(c);
  return sonda.gl;
}

/** Splits a list into chunks of n. */
export function trozos<T>(xs: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < xs.length; i += n) r.push(xs.slice(i, i + n));
  return r;
}
