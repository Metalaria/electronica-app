// Phase 2 · 9 (visual regression against 0.10.1): about 80 routes (every kind of page plus a deterministic sample
// of sections, figures, netlists and glossary terms) captured in the tablet with the old build and the new one,
// compared pixel by pixel in the browser (a canvas: no image library). A page that changed more than 0,5 % gets a
// finding with an «antes | ahora | diferencia» picture in capturas/, to review by eye: most changes are the
// version's own work, the rest are regressions.
//   The old build: git archive of the 0.10.1 commit, built and served apart, e.g.
//     npx vite preview --outDir /tmp/epa-dist-v0101 --port 4423 --strictPort
//   QA_VIEJO=http://localhost:4423/ npx playwright test -c playwright.qa.config.ts tests/qa/fase2-visual.spec.ts --project=tableta
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, type Browser, type Page } from '@playwright/test';
import { INFORME, Registro } from './arnes.ts';
import { azarDe, todasLasRutas, type Ruta } from './rutas.ts';

const VIEJO = process.env.QA_VIEJO ?? 'http://localhost:4423/';
const UMBRAL = 0.005;

function rutas(): Ruta[] {
  const todas = todasLasRutas().filter((r) => !r.accion || r.accion === 'ajustes' || r.accion === 'menu');
  const m = new Map<string, Ruta>();
  for (const r of todas) {
    const k = `${r.grupo}:${r.hash.split('/').length}`;
    if (!m.has(k)) m.set(k, r);
  }
  const elegidas = [...m.values()];
  // then a sample of the big groups, the same every run
  for (const r of todas.filter((x) => !elegidas.includes(x)).sort((a, b) => azarDe(`v:${a.id}`) - azarDe(`v:${b.id}`)))
    if (elegidas.length < 80 && ['secciones', 'libro', 'figuras', 'simulador', 'glosario', 'calculadoras', 'consolas'].includes(r.grupo)) elegidas.push(r);
  return elegidas;
}

/** A capture of the route in a fresh context of the profile, at CSS pixels, motion stopped. */
async function capturar(browser: Browser, uso: Record<string, unknown>, base: string, r: Ruta): Promise<Buffer | null> {
  const ctx = await browser.newContext({ ...uso, baseURL: base, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}${r.hash}`, { waitUntil: 'load', timeout: 60_000 });
    await esperarListo(page, r);
    if (r.accion === 'ajustes') await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click({ timeout: 10_000 });
    if (r.accion === 'menu') await page.getByRole('button', { name: 'Más' }).first().click({ timeout: 10_000 });
    await page.waitForTimeout(600);
    return await page.screenshot({ type: 'png', scale: 'css', animations: 'disabled', caret: 'hide', timeout: 30_000 });
  } catch {
    return null;
  } finally {
    await ctx.close();
  }
}

/** Calm without the probe: no loading indicator and no DOM change for 800 ms. */
async function esperarListo(page: Page, r: Ruta): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __ultimo: number };
    w.__ultimo = performance.now();
    new MutationObserver(() => (w.__ultimo = performance.now())).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  const fin = Date.now() + (r.pesada ? 90_000 : 20_000);
  while (Date.now() < fin) {
    const ok = await page.evaluate(() => {
      const vis = (e: Element) => (e as HTMLElement).offsetParent !== null || e.getClientRects().length > 0;
      const cargando = [...document.querySelectorAll('.cargando, [aria-busy="true"]')].some(vis);
      return !cargando && performance.now() - (window as unknown as { __ultimo: number }).__ultimo > 800;
    });
    if (ok) return;
    await page.waitForTimeout(200);
  }
}

test('comparación visual con la 0.10.1', async ({ page, browser }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'en la tableta');
  const lista = rutas();
  test.setTimeout(lista.length * 4 * 60_000);
  const uso = { ...(info.project.use as Record<string, unknown>) };
  delete uso['baseURL'];
  const nuevo = (info.project.use as { baseURL?: string }).baseURL ?? 'http://localhost:4421/';
  await page.goto('about:blank');
  let iguales = 0;
  let comparadas = 0;
  for (const r of lista) {
    reg.ruta = r.id;
    reg.traza(`visual ${r.id}`);
    const [a, b] = [await capturar(browser, uso, VIEJO, r), await capturar(browser, uso, nuevo, r)];
    if (!a || !b) {
      await reg.anotar({ sev: 'visual', tipo: 'visual-sin-captura', firma: r.grupo, msg: `${r.hash}: no se pudo capturar ${!a ? 'la 0.10.1' : 'la versión nueva'}.` });
      continue;
    }
    comparadas++;
    const res = await page.evaluate(
      async ([pa, pb]) => {
        const img = (s: string) =>
          new Promise<HTMLImageElement>((ok, mal) => {
            const i = new Image();
            i.onload = () => ok(i);
            i.onerror = mal;
            i.src = `data:image/png;base64,${s}`;
          });
        const [ia, ib] = await Promise.all([img(pa), img(pb)]);
        const w = Math.max(ia.width, ib.width);
        const h = Math.max(ia.height, ib.height);
        const datos = (i: HTMLImageElement) => {
          const c = new OffscreenCanvas(w, h);
          const x = c.getContext('2d')!;
          x.fillStyle = '#fff';
          x.fillRect(0, 0, w, h);
          x.drawImage(i, 0, 0);
          return x.getImageData(0, 0, w, h).data;
        };
        const da = datos(ia);
        const db = datos(ib);
        let dif = 0;
        const c = document.createElement('canvas');
        c.width = w * 3;
        c.height = h;
        const x = c.getContext('2d')!;
        x.drawImage(ia, 0, 0);
        x.drawImage(ib, w, 0);
        const d = x.createImageData(w, h);
        for (let k = 0; k < da.length; k += 4) {
          const m = Math.max(Math.abs(da[k]! - db[k]!), Math.abs(da[k + 1]! - db[k + 1]!), Math.abs(da[k + 2]! - db[k + 2]!));
          const g = (da[k]! + da[k + 1]! + da[k + 2]!) / 3;
          if (m > 40) {
            dif++;
            d.data.set([230, 30, 30, 255], k);
          } else d.data.set([g, g, g, 60], k);
        }
        x.putImageData(d, w * 2, 0);
        return { fraccion: dif / (w * h), jpeg: c.toDataURL('image/jpeg', 0.5).split(',')[1]! };
      },
      [a.toString('base64'), b.toString('base64')] as const,
    );
    if (res.fraccion <= UMBRAL) {
      iguales++;
      continue;
    }
    const nombre = `visual-${createHash('sha1').update(r.id).digest('hex').slice(0, 12)}.jpg`;
    writeFileSync(`${INFORME}capturas/${nombre}`, Buffer.from(res.jpeg, 'base64'));
    await reg.anotar(
      { sev: 'visual', tipo: 'visual-cambio', firma: r.id, msg: `${r.hash}: cambia el ${(res.fraccion * 100).toFixed(1)} % de la pantalla respecto a la 0.10.1 (antes | ahora | diferencia en capturas/${nombre}).` },
      { captura: `capturas/${nombre}` },
    );
  }
  reg.cobertura({ 'visual: rutas comparadas con la 0.10.1': comparadas, 'visual: rutas sin cambios': iguales });
});
