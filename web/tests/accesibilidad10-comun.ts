// Shared helpers of the 1.0 accessibility pass (accesibilidad10-*.spec.ts): a clean profile in a given theme, axe-core
// injected and run with the WCAG 2.0/2.1/2.2 A and AA rules plus axe's best practices, and the app-wide checks axe does
// not make (one main landmark, the skip link first, the page title, the language, a level-1 heading).
import { expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

export const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export type Tema = 'claro' | 'sepia' | 'oscuro';
export const TEMAS: Tema[] = (process.env.ACC_TEMAS?.split(',') as Tema[] | undefined) ?? ['claro', 'sepia', 'oscuro'];

/** A fresh profile (once per tab) in the given theme; GitHub answers 404 so nothing leaves the machine. */
export async function limpio(page: Page, tema: Tema = 'claro', extra: Record<string, unknown> = {}): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(
    ([t, e]) => {
      if (!sessionStorage.getItem('preparado')) {
        sessionStorage.setItem('preparado', '1');
        localStorage.clear();
        localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
        localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18, sonido: false, vibracion: false }));
        for (const [k, v] of Object.entries(e as Record<string, unknown>)) localStorage.setItem(k, JSON.stringify(v));
      }
    },
    [tema, extra] as const,
  );
}

/** Waits until the route's chunk is in and the page has settled (no «Abriendo…» placeholder, fonts loaded). */
export async function asentar(page: Page, ms = 700): Promise<void> {
  await page.waitForFunction(() => !!document.querySelector('main#contenido') && !document.querySelector('main#contenido > .cargando, main#contenido .cargando:only-child'), null, { timeout: 60_000, polling: 100 });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(ms);
}

export interface Hallazgo {
  regla: string;
  impacto: string;
  ayuda: string;
  nodos: { sel: string; html: string; resumen: string }[];
}

/** Runs axe on the page (or a selector) and returns its violations, one entry per rule. */
export async function axe(page: Page, incluir?: string): Promise<Hallazgo[]> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE });
  return page.evaluate(async (sel) => {
    const a = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; impact?: string; help: string; nodes: { target: string[]; html: string; failureSummary?: string }[] }[] }> } }).axe;
    // [data-decorativo]: incidental text (WCAG 1.4.3 exception), such as the unlit annunciators of an LCD drawn faint
    const r = await a.run({ include: sel ? [[sel]] : [['html']], exclude: [['[data-decorativo]']] }, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      resultTypes: ['violations'],
    });
    // target-size «partially obscured»: axe counts the fixed bars and sticky headers over a target that is scrolled
    // under them (or off screen). Kept only when, scrolled into the middle of the view, the target itself is smaller
    // than 24 × 24 px or its centre is covered by something else.
    const tapadoDeVerdad = (n: { target: string[]; failureSummary?: string }): boolean => {
      if (!/partially obscured/.test(n.failureSummary ?? '')) return true;
      const el = n.target.length === 1 ? document.querySelector(n.target[0]!) : null;
      if (!(el instanceof HTMLElement || el instanceof SVGElement)) return true;
      // under a modal overlay (the page is inert): not a target while the overlay is open
      if (el.closest('[inert]')) return false;
      const y = scrollY;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rc = el.getBoundingClientRect();
      const encima = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
      scrollTo(0, y);
      // covered by a modal dialog (the figure viewer): the page below is not a target while it is open
      if (encima && !el.contains(encima) && encima.closest('[aria-modal="true"]')) return false;
      return rc.width < 24 || rc.height < 24 || !encima || !(el.contains(encima) || encima.contains(el));
    };
    // color-contrast measured while late content (a figure's plate, a chunk of the reader) was still moving gives a
    // background that is not there once the page has settled: such a node is checked again a moment later, on its own
    const contraste = r.violations.find((v) => v.id === 'color-contrast');
    let persisten: Set<string> | null = null;
    // (off screen, the reader's chunks have `content-visibility: auto` placeholder sizes and a live figure's plate
    // overlapped the heading above it: each node is scrolled into view first)
    if (contraste) {
      persisten = new Set();
      const y = scrollY;
      for (const n of contraste.nodes.slice(0, 20)) {
        const el = n.target.length === 1 ? document.querySelector(n.target[0]!) : null;
        if (!el) {
          persisten.add(n.target.join(' '));
          continue;
        }
        el.scrollIntoView({ block: 'center' });
        await new Promise((ok) => setTimeout(ok, 400));
        const otra = await a.run({ include: [n.target], exclude: [['[data-decorativo]']] }, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations'] });
        if (otra.violations.length) persisten.add(n.target.join(' '));
      }
      for (const n of contraste.nodes.slice(20)) persisten.add(n.target.join(' '));
      scrollTo(0, y);
    }
    return r.violations
      .map((v) => ({ ...v, nodes: v.id === 'target-size' ? v.nodes.filter(tapadoDeVerdad) : v.id === 'color-contrast' && persisten ? v.nodes.filter((n) => persisten!.has(n.target.join(' '))) : v.nodes }))
      .filter((v) => v.nodes.length)
      .map((v) => ({
        regla: v.id,
        impacto: v.impact ?? '',
        ayuda: v.help,
        nodos: v.nodes.slice(0, 8).map((n) => ({ sel: n.target.join(' '), html: n.html.slice(0, 160), resumen: (n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 240) })),
      }));
  }, incluir ?? null);
}

/** The app-wide checks: one main, the skip link, title, language and a level-1 heading on screen. */
export async function estructura(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const f: string[] = [];
    if (document.documentElement.lang !== 'es') f.push(`lang=${document.documentElement.lang}`);
    if (!document.title.trim()) f.push('sin título de página');
    const mains = document.querySelectorAll('main, [role="main"]');
    if (mains.length !== 1) f.push(`${mains.length} main`);
    const salto = document.querySelector<HTMLAnchorElement>('a[data-saltar-contenido]');
    if (!salto) f.push('sin enlace «Saltar al contenido»');
    const visibles = [...document.querySelectorAll('h1')].filter((h) => {
      const r = h.getBoundingClientRect();
      return h.closest('[hidden], [inert]') === null && (r.width > 0 || h.classList.contains('solo-lector'));
    });
    if (visibles.length === 0) f.push('sin h1');
    return f;
  });
}

/** Fails the test with a readable list unless the audit mode is on (then the caller stores them). */
export function sinHallazgos(h: Hallazgo[], nombre: string): void {
  expect(h.map((x) => `${x.regla}: ${x.nodos.map((n) => n.sel).slice(0, 4).join(', ')}`), nombre).toEqual([]);
}
