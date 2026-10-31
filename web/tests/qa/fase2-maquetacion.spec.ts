// Phase 2 · 5 (layout stress): every route of the app in seven more layouts (perfiles.ts VARIANTES: the tablet
// turned, a 360 px phone, split screen at 600 and 700 px, the biggest text, the sepia theme, a desktop window at
// 200 % zoom), with the layout checks of comprobaciones.ts (horizontal scroll, content off screen or clipped,
// overflowing text, covered or overlapping targets, contrast in sepia). Only the variant projects run this file:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers nice npx playwright test -c playwright.qa.config.ts tests/qa/fase2-maquetacion.spec.ts
//   … --project=apaisada (one variant) · QA_MODO=rapido (5 % of the routes) · QA_FILTRO=<text> (route ids)
import { test } from '@playwright/test';
import { Registro, prepararPagina, trozos, visitar } from './arnes.ts';
import { MODO } from './perfiles.ts';
import { azarDe, todasLasRutas, type Ruta } from './rutas.ts';

/** Every route; a figure is its part's page scrolled to it (its viewer is the same dialog everywhere). */
function rutas(): Ruta[] {
  const filtro = process.env.QA_FILTRO ? new RegExp(process.env.QA_FILTRO) : null;
  return todasLasRutas()
    .map((r) => (r.accion === 'visor' ? { ...r, accion: undefined } : r))
    .filter((r) => (MODO !== 'rapido' || r.siempre || azarDe(`m:${r.id}`) < 0.05) && (!filtro || filtro.test(r.id)));
}

const RUTAS = rutas();
const GRUPOS = [...new Set(RUTAS.map((r) => r.grupo))];

test.describe.configure({ mode: 'parallel' });

for (const g of GRUPOS) {
  trozos(
    RUTAS.filter((r) => r.grupo === g),
    40,
  ).forEach((trozo, k) => {
    test(`maquetación · ${g} ${k + 1}`, async ({ page }, info) => {
      const reg = new Registro(info);
      test.setTimeout(Math.max(5, trozo.length) * 60_000);
      const prefs = reg.perfil.prefs;
      if (prefs) await page.addInitScript((p) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'auto', tam: 18, ...p })), prefs);
      await prepararPagina(page, reg);
      let visitadas = 0;
      for (const [i, r] of trozo.entries()) {
        // the layout checks only: accessible names and the probe's timings are the crawler's job
        await visitar(page, reg, r, i % 25 === 0, { accesibilidad: !!prefs?.tema, completa: !!r.completa });
        visitadas++;
      }
      reg.cobertura({ [`maquetación: rutas · ${g}`]: visitadas });
    });
  });
}
