// 1.3.1 (qa131-temas): the theme sweep. The owner reads almost only in the dark and sepia themes; this walks every
// main route (RUTAS_FIJAS) in those themes at phone, tablet and desktop size and records, per route: the theme really
// applied (data-tema), every axe violation (all rules, color-contrast included), console errors and exceptions, a
// heuristic of colours that ignore the theme (a light box on the dark page, pure white on sepia, near-black SVG text
// on the dark page), and a screenshot (the first three screens) to look at. Not part of the default suite:
//   QA_SIN_COMPILAR=1 EPA_DIST=<build> EPA_PUERTO=<port> TEMAS_SALIDA=<dir> npx playwright test -c playwright.monos.config.ts tests/monos/qa131-temas.spec.ts --project=telefono
// (results in TEMAS_SALIDA/temas.jsonl, one row per route, and a folder of screenshots per profile and theme)
//   TEMAS=oscuro,sepia (default)   TEMAS_FILTRO=<regex over hashes>   TEMAS_PERFILES=telefono,tableta,escritorio
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, type Page } from '@playwright/test';
import { escuchar, RUTAS_FIJAS, sondaMono } from './mono.ts';

const SALIDA = (process.env.TEMAS_SALIDA ?? new URL('../../test-results/temas/', import.meta.url).pathname).replace(/\/?$/, '/');
const TEMAS = (process.env.TEMAS ?? 'oscuro,sepia').split(',');
const FILTRO = process.env.TEMAS_FILTRO ? new RegExp(process.env.TEMAS_FILTRO) : null;
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const rutas = [...RUTAS_FIJAS, ...(process.env.TEMAS_EXTRA ? process.env.TEMAS_EXTRA.split(',') : [])].filter((h) => !FILTRO || FILTRO.test(h));

/** Waits for a quiet page (no DOM change outside svg/canvas for 600 ms, nothing «loading»). */
export async function calma(page: Page, max = 25_000): Promise<void> {
  await page.waitForLoadState('load').catch(() => {});
  await page
    .evaluate(
      (max) =>
        new Promise<void>((ok) => {
          let ultimo = performance.now();
          const o = new MutationObserver((ms) => {
            if (ms.some((m) => !(m.target instanceof SVGElement) && !(m.target as Element).closest?.('svg, canvas'))) ultimo = performance.now();
          });
          o.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
          const fin = performance.now() + max;
          const mirar = () => {
            const cargando = [...document.querySelectorAll('.cargando, [aria-busy="true"]')].some((e) => e.getClientRects().length > 0);
            if ((!cargando && performance.now() - ultimo > 600) || performance.now() > fin) {
              o.disconnect();
              ok();
            } else setTimeout(mirar, 100);
          };
          mirar();
        }),
      max,
    )
    .catch(() => {});
}

/** In-page: colours that ignore the theme (heuristic; the screenshots decide). */
export function coloresFueraDeTema(tema: string): string[] {
  const r: string[] = [];
  const rgba = (s: string): number[] | null => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
  };
  const lum = (c: number[]) => {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
  };
  const nombre = (e: Element) => {
    const c = typeof (e as HTMLElement).className === 'string' ? (e as HTMLElement).className : (e.getAttribute('class') ?? '');
    const cls = c.split(/\s+/).filter((x) => x && !x.startsWith('svelte-')).slice(0, 2).join('.');
    const padre = e.parentElement;
    const pc = padre ? (typeof padre.className === 'string' ? padre.className : (padre.getAttribute('class') ?? '')).split(/\s+/).filter((x) => x && !x.startsWith('svelte-'))[0] : '';
    return `${pc ? pc + ' > ' : ''}${e.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
  };
  // (book figures, photos and the deliberately paper-coloured drawing surfaces are not UI boxes)
  const excluir = 'img, picture, video, canvas, .placa, [data-placa], .figura img';
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
    const rc = e.getBoundingClientRect();
    if (rc.width * rc.height < 1500 || rc.bottom < 0 || rc.top > innerHeight * 3) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.2) continue;
    if (e.matches(excluir)) continue;
    const bg = rgba(cs.backgroundColor);
    if (!bg || bg[3]! < 0.6) continue;
    const l = lum(bg);
    if (tema === 'oscuro' && l > 0.5) r.push(`caja clara en oscuro: ${nombre(e)} ${cs.backgroundColor} ${Math.round(rc.width)}×${Math.round(rc.height)}`);
    if (tema === 'sepia' && bg[0] === 255 && bg[1] === 255 && bg[2] === 255) r.push(`blanco puro en sepia: ${nombre(e)} ${Math.round(rc.width)}×${Math.round(rc.height)}`);
  }
  if (tema === 'oscuro') {
    for (const t of document.querySelectorAll('svg text, svg tspan')) {
      const rc = t.getBoundingClientRect();
      if (!rc.width || rc.top > innerHeight * 3) continue;
      const cs = getComputedStyle(t);
      const f = rgba(cs.fill);
      if (f && f[3]! > 0.5 && lum(f) < 0.04) r.push(`texto SVG casi negro en oscuro: ${nombre(t.closest('svg')!)} «${(t.textContent ?? '').trim().slice(0, 20)}»`);
    }
  }
  return [...new Set(r)];
}

export async function ponerTemaInicial(page: Page, tema: string): Promise<void> {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t }));
    } catch {
      /* private mode */
    }
  }, tema);
}

export async function axeTodo(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: AXE }).catch(() => {});
  return page
    .evaluate(async () => {
      const axe = (window as unknown as { axe?: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[]; any: { message: string }[] }[] }[] }> } }).axe;
      if (!axe) return ['axe no cargó'];
      const limite = new Promise<never>((_, no) => setTimeout(() => no(new Error('tiempo agotado (40 s)')), 40_000));
      const r = await Promise.race([limite, axe.run(document, { resultTypes: ['violations'] })]);
      return r.violations.map((x) => `${x.id} (${x.impact}): ${x.nodes.slice(0, 4).map((n) => `${n.target.join(' ')}${x.id === 'color-contrast' ? ` [${n.any[0]?.message.match(/contrast of ([\d.]+)/)?.[1] ?? '?'}]` : ''}`).join(' | ')}${x.nodes.length > 4 ? ` (+${x.nodes.length - 4})` : ''}`);
    })
    .catch((e) => [`axe: ${String(e).slice(0, 80)}`]);
}

const PERFILES = (process.env.TEMAS_PERFILES ?? 'telefono,tableta,escritorio').split(',');

for (const tema of TEMAS) {
  test(`temas · todas las rutas · ${tema}`, async ({ browser }, info) => {
    test.skip(!PERFILES.includes(info.project.name), 'perfil fuera de TEMAS_PERFILES');
    test.setTimeout(rutas.length * 90_000);
    const uso = { ...(info.project.use as Record<string, unknown>), forcedColors: 'none', colorScheme: tema === 'oscuro' ? 'dark' : 'light' };
    const ctx = await browser.newContext(uso);
    await ctx.addInitScript(sondaMono);
    await ctx.route('https://api.github.com/**', (r) => r.abort('blockedbyclient'));
    const page = await ctx.newPage();
    await ponerTemaInicial(page, tema);
    page.on('dialog', (d) => void d.dismiss().catch(() => {}));
    const dir = `${SALIDA}${info.project.name}-${tema}/`;
    mkdirSync(dir, { recursive: true });
    let actual = '';
    const errores: { ruta: string; tipo: string; msg: string }[] = [];
    escuchar(page, { origen: String(info.project.use.baseURL ?? ''), tactil: !!uso.hasTouch }, (tipo, msg) => errores.push({ ruta: actual, tipo, msg }));
    for (const h of rutas) {
      actual = h;
      const fila: Record<string, unknown> = { perfil: info.project.name, tema, ruta: h };
      try {
        await page.goto(`/${h}`);
        await calma(page);
        await page.waitForTimeout(500);
        fila.temaAplicado = await page.evaluate(() => document.documentElement.dataset.tema);
        fila.fuera = await page.evaluate(coloresFueraDeTema, tema);
        fila.axe = await axeTodo(page);
        const vp = page.viewportSize()!;
        const alto = await page.evaluate(() => document.documentElement.scrollHeight);
        const archivo = `${dir}${h.replace(/^#\//, '').replace(/[^\w.-]+/g, '_') || 'inicio'}.png`;
        await page.screenshot({ path: archivo, fullPage: true, clip: { x: 0, y: 0, width: vp.width, height: Math.min(alto, vp.height * 3) }, animations: 'disabled' });
        fila.captura = archivo;
      } catch (e) {
        fila.error = String(e).slice(0, 200);
      }
      fila.errores = errores.filter((x) => x.ruta === h).map((x) => `${x.tipo}: ${x.msg}`);
      appendFileSync(`${SALIDA}temas.jsonl`, JSON.stringify(fila) + '\n');
    }
    await ctx.close();
  });
}
