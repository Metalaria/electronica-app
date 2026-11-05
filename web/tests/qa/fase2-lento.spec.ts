// Phase 2 · 2 (low-end device): one route of every kind (rutas.ts: group, depth and action) opened on an emulated
// slow device — CPU four times slower and «Fast 3G» network (CDP) — measuring the time to the first content
// (#contenido holds text and no loading indicator) and to calm (nothing changes for 1 s); and the same routes
// with the content's JSON failing (route.abort): the page must say so and offer a way to try again (that works
// once the network is back), never spin forever or stay blank.
//   QA_FILTRO=<text> limits the routes (by id).
import { test, type Page } from '@playwright/test';
import { Registro, esperarCalma, prepararPagina, trozos } from './arnes.ts';
import { todasLasRutas, type Ruta } from './rutas.ts';
import { esAccion012 } from './novedades.ts';

/** The first route of each kind: group, number of hash segments and action. */
function representantes(): Ruta[] {
  const m = new Map<string, Ruta>();
  // (0.12 actions are not done here: their routes would only load a page another representative already loads; the
  // backup card's own route, #/sincronizacion/copia, is one)
  for (const r of todasLasRutas().filter((x) => !esAccion012(x.accion))) {
    const k = `${r.grupo}:${r.hash.split('/').length}:${r.accion ?? ''}`;
    // (0.11 group B: every page of the learning loop)
    if (!m.has(k) || r.grupo === 'aprendizaje') m.set(r.grupo === 'aprendizaje' ? r.id : k, r);
  }
  const filtro = process.env.QA_FILTRO;
  return [...m.values()].filter((r) => !filtro || r.id.includes(filtro));
}

const RUTAS = representantes();
const UMBRAL_MS = 3000;

/** State of the page: content, loading indicators, an error message and a way to retry. */
async function estado(page: Page): Promise<{ texto: number; cargando: boolean; error: string; reintento: boolean }> {
  return page
    .evaluate(() => {
      const vis = (e: Element) => (e as HTMLElement).offsetParent !== null || e.getClientRects().length > 0;
      const main = document.querySelector('#contenido') ?? document.body;
      const cargando =
        [...document.querySelectorAll('.cargando, .cargando-editor, .espera-carga, [aria-busy="true"]')].some(vis) ||
        /^(Cargando|Abriendo|Preparando)\b/.test((main.textContent ?? '').trim());
      const t = (main as HTMLElement).innerText ?? '';
      // a notice, not the content's own words: the app's notice elements only
      const avisos = [...document.querySelectorAll('.aviso, .error, [role="alert"], .cargando-editor, .estado')].filter(vis).map((e) => (e as HTMLElement).innerText ?? '');
      const m = avisos.join('\n').match(/[^\n]*(no se (ha )?pud|no se puede|sin conexión|error de red|failed to fetch|no se pudo cargar|no hay conexión)[^\n]*/i);
      const reintento = [...document.querySelectorAll('button, a')].some((b) => vis(b) && /^(Reintentar|Volver a intentar|Probar otra vez|Recargar|Intentar de nuevo)/i.test((b.textContent ?? '').trim()));
      return { texto: t.replace(/\s+/g, ' ').trim().length, cargando, error: m ? m[0].slice(0, 160) : '', reintento };
    })
    .catch(() => ({ texto: 0, cargando: false, error: '', reintento: false }));
}

/** Milliseconds until #contenido shows content without a loading indicator (or null within `max`). */
async function hastaContenido(page: Page, t0: number, max: number): Promise<number | null> {
  while (Date.now() - t0 < max) {
    const e = await estado(page);
    if (e.texto > 20 && !e.cargando) return Date.now() - t0;
    await page.waitForTimeout(100);
  }
  return null;
}

test.describe.configure({ mode: 'parallel' });

trozos(RUTAS, 6).forEach((trozo, k) => {
  test(`equipo lento (CPU ×4, Fast 3G) · ${k + 1}`, async ({ page }, info) => {
    const reg = new Registro(info);
    test.skip(reg.perfil.id === 'escritorio', 'perfiles táctiles');
    test.setTimeout(trozo.length * 4 * 60_000);
    await prepararPagina(page, reg);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    const lento = async () => {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024) / 8 * 0.9, uploadThroughput: (750 * 1024) / 8 * 0.9 });
    };
    const normal = async () => {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    };
    const tiempos: number[] = [];
    for (const r of trozo) {
      reg.ruta = r.id;
      reg.traza(`lento ${r.id}`);
      const max = r.pesada || /consolas|proyectos|modelos3d|fm7303|instrumentos/.test(r.grupo) ? 120_000 : 60_000;
      // cold: the whole app downloaded on the slow network, with an empty cache
      await page.goto('about:blank');
      await cdp.send('Network.clearBrowserCache');
      await lento();
      let t0 = Date.now();
      await page.goto(`/${r.hash}`, { waitUntil: 'commit', timeout: 120_000 }).catch(() => {});
      const frio = await hastaContenido(page, t0, max);
      if (frio == null) {
        const e = await estado(page);
        await reg.anotar({ sev: 'error', tipo: 'carga-sin-fin', firma: `${r.grupo} (en frío)`, msg: `En un equipo lento, ${r.hash} no muestra su contenido en ${max / 1000} s (${e.cargando ? 'sigue «cargando»' : e.texto ? 'contenido incompleto' : 'en blanco'}).` });
        await normal();
        continue;
      }
      if (frio > 15_000) await reg.anotar({ sev: 'rendimiento', tipo: 'lento-en-frio', firma: r.grupo, msg: `En un equipo lento, ${r.hash} tarda ${(frio / 1000).toFixed(1)} s en mostrar su contenido al abrir la aplicación.` });
      // warm: the start page first, then the route as a tap on a link
      await page.goto('/#/', { waitUntil: 'load', timeout: 120_000 }).catch(() => {});
      await esperarCalma(page, 30_000, 500);
      t0 = Date.now();
      await page.evaluate((h) => (location.hash = h), r.hash);
      const ms = await hastaContenido(page, t0, max);
      const calma = ms != null && (await esperarCalma(page, max, 1000));
      const total = Date.now() - t0;
      await normal();
      if (ms == null) {
        const e = await estado(page);
        await reg.anotar({ sev: 'error', tipo: 'carga-sin-fin', firma: r.grupo, msg: `En un equipo lento, ${r.hash} no muestra su contenido en ${max / 1000} s (${e.cargando ? 'sigue «cargando»' : e.texto ? 'contenido incompleto' : 'en blanco'}).` });
        continue;
      }
      tiempos.push(ms);
      if (ms > UMBRAL_MS)
        await reg.anotar({ sev: 'rendimiento', tipo: 'lento-3s', firma: r.grupo, msg: `En un equipo lento (CPU ×4, Fast 3G), ${r.hash} tarda ${(ms / 1000).toFixed(1)} s en mostrar su contenido (umbral ${UMBRAL_MS / 1000} s; frío ${(frio / 1000).toFixed(1)} s).` });
      if (!calma) await reg.anotar({ sev: 'rendimiento', tipo: 'sin-calma', firma: `${r.grupo} (equipo lento)`, msg: `En un equipo lento, ${r.hash} no se queda quieta tras ${(total / 1000).toFixed(0)} s.` });
    }
    tiempos.sort((a, b) => a - b);
    reg.cobertura({ 'equipo lento: rutas medidas': tiempos.length, 'equipo lento: mediana (ms)': tiempos[Math.floor(tiempos.length / 2)] ?? 0, 'equipo lento: máximo (ms)': tiempos[tiempos.length - 1] ?? 0 });
  });

  test(`sin red: el contenido falla y se puede reintentar · ${k + 1}`, async ({ page }, info) => {
    const reg = new Registro(info);
    test.skip(reg.perfil.id === 'escritorio', 'perfiles táctiles');
    test.setTimeout(trozo.length * 3 * 60_000);
    await prepararPagina(page, reg);
    // the failed requests are the point here; console messages about them are expected
    reg.silenciar = [/./];
    let bien = 0;
    for (const r of trozo) {
      reg.ruta = r.id;
      reg.traza(`sin red ${r.id}`);
      // the page with the network, to compare: a page that loses most of its text without a word is broken too
      await page.goto(`/${r.hash}`, { waitUntil: 'load', timeout: 60_000 });
      await esperarCalma(page, r.pesada ? 60_000 : 20_000, 500);
      const normal = (await estado(page)).texto;
      // a new document (a hash change alone would keep what the page already loaded in memory)
      await page.goto('/#/', { waitUntil: 'load', timeout: 60_000 });
      await page.reload({ waitUntil: 'load', timeout: 60_000 });
      await esperarCalma(page, 15_000, 500);
      let cortadas = 0;
      const cortar = /\.json(\?|$)/;
      await page.route(
        (u) => cortar.test(u.pathname) && !/\/libro\/(indice|refs)\.json$/.test(u.pathname),
        (rt) => {
          cortadas++;
          return rt.abort('internetdisconnected');
        },
      );
      await page.evaluate((h) => (location.hash = h), r.hash);
      let e = await estado(page);
      const t0 = Date.now();
      while (Date.now() - t0 < 20_000) {
        await page.waitForTimeout(250);
        e = await estado(page);
        if (e.error || (!e.cargando && e.texto > 20 && Date.now() - t0 > 3000)) break;
      }
      await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
      // (unrouteAll also took prepararPagina's block of the real GitHub away)
      await page.route('https://api.github.com/**', (rt) => rt.abort('blockedbyclient'));
      if (!cortadas) {
        bien++;
        continue;
      }
      if (e.error && e.reintento) {
        await page
          .locator('button, a')
          .filter({ hasText: /^\s*(Reintentar|Volver a intentar|Probar otra vez|Recargar|Intentar de nuevo)/i })
          .first()
          .click({ timeout: 10_000 })
          .catch(() => {});
        await esperarCalma(page, 30_000, 500);
        const d = await estado(page);
        if (d.error) await reg.anotar({ sev: 'funcional', tipo: 'reintento-no-recupera', firma: r.grupo, msg: `${r.hash}: con la red de vuelta, «Reintentar» no recupera el contenido («${d.error}»).` });
        else bien++;
      } else if (e.error) {
        await reg.anotar({ sev: 'funcional', tipo: 'error-sin-reintento', firma: r.grupo, msg: `${r.hash}: sin red dice «${e.error}» pero no ofrece reintentar (${cortadas} JSON cortados).` });
      } else if (e.cargando) {
        await reg.anotar({ sev: 'funcional', tipo: 'carga-sin-fin-sin-red', firma: r.grupo, msg: `${r.hash}: sin red se queda «cargando» para siempre, sin avisar (${cortadas} JSON cortados).` });
      } else if (e.texto <= 20) {
        await reg.anotar({ sev: 'funcional', tipo: 'en-blanco-sin-red', firma: r.grupo, msg: `${r.hash}: sin red se queda en blanco, sin avisar (${cortadas} JSON cortados).` });
      } else if (e.texto < normal * 0.5) {
        await reg.anotar({ sev: 'funcional', tipo: 'incompleta-sin-red', firma: r.grupo, msg: `${r.hash}: sin red muestra ${e.texto} caracteres de los ${normal} que tiene, sin avisar de que falta algo (${cortadas} JSON cortados).` });
      } else {
        // content shown: what failed was optional (thumbnails, a cache warm-up)
        bien++;
      }
    }
    reg.cobertura({ 'sin red: rutas probadas': trozo.length, 'sin red: rutas que avisan y se recuperan o no lo necesitan': bien });
  });
});
