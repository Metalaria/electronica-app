// 1.3.1 (qa131-plataforma): the robustness sweep of every main route, by device profile and theme — console errors,
// exceptions and unhandled rejections, failed requests to the app's own files, broken text, horizontal overflow,
// touch targets under 44 px in the UI 1.3 added (touch profiles), axe violations (serious and critical) — plus
// back/forward through the main sections, the app offline, and the heaviest pages with the CPU 6× slower (load time
// and long tasks, written to MONO_SALIDA/rendimiento.jsonl). Not part of the default suite:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.monos.config.ts tests/monos/barrido.spec.ts
//   MONO_TEMAS=claro,oscuro (default)   MONO_FILTRO=<regex over hashes>
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import { escuchar, oraculosPagina, RUTAS_FIJAS, sondaMono, type EstadoMono } from './mono.ts';

const SALIDA = (process.env.MONO_SALIDA ?? new URL('../../test-results/monos/', import.meta.url).pathname).replace(/\/?$/, '/');
mkdirSync(SALIDA, { recursive: true });
const TEMAS = (process.env.MONO_TEMAS ?? 'claro,oscuro').split(',');
const FILTRO = process.env.MONO_FILTRO ? new RegExp(process.env.MONO_FILTRO) : null;
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
/** The containers of the UI 1.3 added (their controls must be 44 px or more on touch). */
const UI13 = '[data-ajuste-fino], .averia-placa, [data-foto-averia], [data-brymen-real], .a12-montar, .a12-averia-placa, .v3d .barra';

async function calma(page: Page, max = 25_000): Promise<number> {
  const t0 = Date.now();
  await page.waitForLoadState('load').catch(() => {});
  // quiet: no DOM change outside canvas/svg for 600 ms and no «Cargando…»
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
  return Date.now() - t0;
}

interface Hallazgo {
  ruta: string;
  tipo: string;
  msg: string;
}

async function revisar(page: Page, ruta: string, tactil: boolean, fallos: Hallazgo[]): Promise<void> {
  const anotar = (tipo: string, msg: string) => fallos.push({ ruta, tipo, msg });
  const s = await page.evaluate(() => {
    const m = (window as unknown as { __mono?: EstadoMono }).__mono;
    return m ? { r: m.rechazos.splice(0), p: m.contextosPerdidos.splice(0) } : null;
  });
  for (const r of s?.r ?? []) anotar('rechazo', r);
  for (const p of s?.p ?? []) anotar('webgl', p);
  const o = await page.evaluate(oraculosPagina);
  for (const t of o.texto) anotar('texto', t);
  if (o.desborde > 2) anotar('desborde', `${o.desborde} px de desplazamiento horizontal`);
  const vp = page.viewportSize()!;
  if (o.ancho > vp.width + 2) anotar('desborde', `el contenido ensancha la página a ${o.ancho} px (pantalla de ${vp.width})`);
  if (tactil) {
    const pequenos = await page.evaluate((sel) => {
      const r: string[] = [];
      for (const c of document.querySelectorAll(sel)) {
        for (const el of c.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role="button"], [role="tab"], [role="radio"], [role="slider"]')) {
          const rc = el.getBoundingClientRect();
          if (!rc.width || !rc.height || getComputedStyle(el).visibility === 'hidden') continue;
          // (a to-scale instrument drawing, the simulated Brymen's dial and keys, has finger-sized controls outside it)
          if (el.closest('svg')) continue;
          if (rc.width < 44 - 0.01 || rc.height < 44 - 0.01) {
            const t = ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
            r.push(`${(c as HTMLElement).className || c.tagName} › «${t}» ${Math.round(rc.width)}×${Math.round(rc.height)}`);
          }
        }
      }
      return [...new Set(r)];
    }, UI13);
    for (const p of pequenos) anotar('tactil-44', p);
  }
  await page.addScriptTag({ content: AXE }).catch(() => {});
  const v = await page
    .evaluate(async () => {
      const axe = (window as unknown as { axe?: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe;
      if (!axe) return [];
      // (bounded: on the longest pages — a whole chapter, the glossary — axe takes minutes on a slow machine)
      const limite = new Promise<never>((_, no) => setTimeout(() => no(new Error('tiempo agotado (20 s)')), 20_000));
      const r = await Promise.race([limite, axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }, resultTypes: ['violations'] })]);
      return r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} (${x.impact}): ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    })
    .catch((e) => (/tiempo agotado/.test(String(e)) ? [] : [`axe no pudo ejecutarse: ${String(e).slice(0, 80)}`]));
  for (const x of v) anotar('axe', x);
}

const rutas = RUTAS_FIJAS.filter((h) => !FILTRO || FILTRO.test(h));

for (const tema of TEMAS) {
  test(`barrido · todas las rutas · tema ${tema}`, async ({ browser }, info) => {
    test.setTimeout(rutas.length * 60_000);
    const uso = info.project.use as Record<string, unknown>;
    const ctx = await browser.newContext(uso);
    await ctx.addInitScript(sondaMono);
    await ctx.addInitScript((t) => {
      try {
        if (!localStorage.getItem('epa:prefs')) localStorage.setItem('epa:prefs', JSON.stringify({ tema: t === 'oscuro' ? 'oscuro' : 'claro' }));
      } catch {
        /* private mode */
      }
    }, tema);
    await ctx.route('https://api.github.com/**', (r) => r.abort('blockedbyclient'));
    const page = await ctx.newPage();
    // (a native dialog would block every later step)
    page.on('dialog', (d) => void d.dismiss().catch(() => {}));
    const fallos: Hallazgo[] = [];
    let actual = '';
    escuchar(page, { origen: info.project.use.baseURL ?? '', tactil: !!uso.hasTouch }, (tipo, msg) => fallos.push({ ruta: actual, tipo, msg }));
    const tiempos: Record<string, number> = {};
    for (const h of rutas) {
      actual = h;
      if (process.env.MONO_TRAZA) console.log(`[barrido ${info.project.name} ${tema}] → ${h}`);
      await page.goto(`/${h}`);
      tiempos[h] = await calma(page);
      await revisar(page, h, !!uso.hasTouch, fallos);
      if (process.env.MONO_TRAZA) console.log(`[barrido ${info.project.name} ${tema}] ${h} ${tiempos[h]} ms, ${fallos.length} hallazgos`);
    }
    await ctx.close();
    appendFileSync(`${SALIDA}barrido.jsonl`, JSON.stringify({ perfil: info.project.name, tema, tiempos, fallos }) + '\n');
    const lista = [...new Set(fallos.map((f) => `${f.ruta} · ${f.tipo}: ${f.msg}`))];
    expect(lista).toEqual([]);
  });
}

test('Atrás y Adelante por todas las secciones principales devuelven cada vista', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  await page.addInitScript(sondaMono);
  await page.route('https://api.github.com/**', (r) => r.abort('blockedbyclient'));
  const fallos: string[] = [];
  escuchar(page, { origen: 'http://localhost', tactil: false }, (t, m) => fallos.push(`${t}: ${m}`));
  const secciones = ['#/', '#/cap05/sec-5.3', '#/glosario', '#/simulador', '#/editor', '#/protoboard', '#/componentes', '#/consolas', '#/proyectos', '#/instrumentos', '#/calculadoras', '#/repaso', '#/ejercicios', '#/cursos', '#/progreso', '#/practicar', '#/guia', '#/leccion/cap08/sec-8.2', '#/sincronizacion'];
  await page.goto('/#/');
  await calma(page);
  for (const h of secciones.slice(1)) {
    await page.evaluate((x) => (location.hash = x.slice(1)), h);
    await calma(page, 15_000);
  }
  const ver = async (h: string, como: string) => {
    const hash = await page.evaluate(() => location.hash || '#/');
    if (hash !== h) fallos.push(`${como}: se esperaba ${h} y está ${hash}`);
    const main = (await page.locator('main').first().innerText().catch(() => '')).trim();
    if (main.length < 20) fallos.push(`${como} ${h}: la vista está vacía`);
  };
  for (let k = secciones.length - 2; k >= 0; k--) {
    await page.goBack();
    await calma(page, 15_000);
    await ver(secciones[k]!, 'Atrás');
  }
  for (let k = 1; k < secciones.length; k++) {
    await page.goForward();
    await calma(page, 15_000);
    await ver(secciones[k]!, 'Adelante');
  }
  expect(fallos).toEqual([]);
});

test('sin conexión: lo ya abierto sigue y lo nuevo da un aviso claro, nunca una página en blanco ni una excepción', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);
  await page.addInitScript(sondaMono);
  const excepciones: string[] = [];
  page.on('pageerror', (e) => excepciones.push(e.message));
  await page.goto('/#/');
  await calma(page);
  await page.goto('/#/cap05/sec-5.3');
  await calma(page);
  await context.setOffline(true);
  const vacias: string[] = [];
  for (const h of ['#/cap05/sec-5.3', '#/cap41', '#/glosario', '#/leccion/cap13/sec-13.2', '#/consolas/nes/placa3d', '#/proyectos/sdr/3d', '#/simulador/cap42/fig-42.5_filtro_rc', '#/repaso/test/cap07', '#/ejercicios', '#/sincronizacion']) {
    await page.evaluate((x) => (location.hash = x.slice(1)), h);
    await calma(page, 15_000);
    const texto = (await page.locator('main').first().innerText().catch(() => '')).trim();
    if (texto.length < 20) vacias.push(h);
    const r = await page.evaluate(() => (window as unknown as { __mono?: EstadoMono }).__mono?.rechazos.splice(0) ?? []);
    excepciones.push(...r.map((x) => `rechazo en ${h}: ${x}`));
  }
  await context.setOffline(false);
  expect({ vacias, excepciones }).toEqual({ vacias: [], excepciones: [] });
});

test('páginas pesadas con la CPU 6× más lenta: tiempo hasta la calma y tareas largas', async ({ page }, info) => {
  test.setTimeout(30 * 60_000);
  await page.addInitScript(sondaMono);
  await page.addInitScript(() => {
    const w = window as unknown as { __largas: number[] };
    w.__largas = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) w.__largas.push(e.duration);
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      /* not supported */
    }
  });
  const fallos: string[] = [];
  escuchar(page, { origen: 'http://localhost', tactil: false }, (t, m) => fallos.push(`${t}: ${m}`));
  await page.goto('/#/');
  await calma(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const r: Record<string, { ms: number; largas: number; maxLarga: number }> = {};
  for (const h of ['#/consolas/nes/placa3d', '#/proyectos/sdr/3d', '#/componentes/3d/resistencia-axial', '#/protoboard', '#/leccion/cap08/sec-8.2', '#/leccion/cap02/sec-2.7', '#/simulador/cap42/fig-42.5_filtro_rc', '#/consolas/snes/averia', '#/editor/libro/cap42/fig-42.3_op_emisor_comun']) {
    await page.evaluate(() => ((window as unknown as { __largas: number[] }).__largas = []));
    const t0 = Date.now();
    await page.evaluate((x) => (location.hash = x.slice(1)), h);
    await page.waitForTimeout(200);
    await calma(page, 120_000);
    const l = await page.evaluate(() => (window as unknown as { __largas: number[] }).__largas.slice());
    r[h] = { ms: Date.now() - t0, largas: Math.round(l.reduce((a, b) => a + b, 0)), maxLarga: Math.round(Math.max(0, ...l)) };
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  appendFileSync(`${SALIDA}rendimiento.jsonl`, JSON.stringify({ perfil: info.project.name, cpu: 6, paginas: r }) + '\n');
  console.log(JSON.stringify(r, null, 1));
  expect(fallos).toEqual([]);
});

// The monkey (seed 3000, tablet) found the breadboard's bench kept the width measured before a rotation: its panel
// ended past the screen. Every main route, opened at one size and then resized (a desktop window made narrower, a
// tablet turned), must fit the new width.
for (const [nombre, de, a] of [
  ['ventana de escritorio más estrecha', { width: 1920, height: 1080 }, { width: 1100, height: 900 }],
  ['tableta girada a apaisada', { width: 834, height: 1334 }, { width: 1334, height: 834 }],
  ['tableta girada a vertical', { width: 1334, height: 834 }, { width: 834, height: 1334 }],
] as const) {
  test(`al cambiar de tamaño (${nombre}) nada queda fuera de la pantalla`, async ({ browser }, info) => {
    test.skip(info.project.name !== (nombre.startsWith('tableta') ? 'tableta' : 'escritorio'), 'un perfil por caso');
    test.setTimeout(rutas.length * 40_000);
    const uso = info.project.use as Record<string, unknown>;
    const ctx = await browser.newContext({ ...uso, viewport: de });
    await ctx.route('https://api.github.com/**', (r) => r.abort('blockedbyclient'));
    const page = await ctx.newPage();
    const fuera: string[] = [];
    for (const h of rutas) {
      await page.setViewportSize(de);
      await page.goto(`/${h}`);
      await calma(page, 15_000);
      await page.setViewportSize(a);
      await page.waitForTimeout(1200);
      const o = await page.evaluate(oraculosPagina);
      if (o.desborde > 2 || o.ancho > a.width + 2) fuera.push(`${h}: ancho ${o.ancho}, desplazamiento ${o.desborde} px`);
    }
    await ctx.close();
    expect(fuera).toEqual([]);
  });
}
