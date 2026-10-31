// QA crawler: every route of the app (rutas.ts), in chunks of a group, visited like a person tapping links
// (a full load at the start of each chunk and every 25 routes, hash changes in between), with the automatic
// checks of comprobaciones.ts and the probe of sonda.ts on each page. Plus the memory test (heap growth after 60
// pages, after garbage collection) and WebGL contexts left alive after leaving a 3D page.
// Findings go to the report (informe.ts); a test fails only when the harness itself breaks.
import { test } from '@playwright/test';
import { Registro, prepararPagina, trozos, visitar } from './arnes.ts';
import { MODO, perfilDe } from './perfiles.ts';
import { azarDe, lecciones, rutasDe, todasLasRutas, type Ruta } from './rutas.ts';
import type { EstadoSonda } from './sonda.ts';

const TODAS = todasLasRutas();
const GRUPOS = [...new Set(TODAS.map((r) => r.grupo))];
const TAMANO = 30;

test.describe.configure({ mode: 'parallel' });

test('inventario de rutas y lecciones', async ({}, info) => {
  const reg = new Registro(info);
  const mias = rutasDe(reg.perfil);
  const c: Record<string, number> = { 'rutas en total': TODAS.length, 'rutas de este perfil': mias.length };
  for (const g of GRUPOS) c[`rutas · ${g}`] = mias.filter((r) => r.grupo === g).length;
  if (reg.perfil.id === 'tableta') {
    const ls = lecciones();
    c['lecciones'] = ls.length;
    c['pantallas de lección'] = ls.reduce((s, l) => s + l.pantallas.length, 0);
    c['ejercicios de práctica'] = ls.reduce((s, l) => s + l.items.length, 0);
  }
  reg.cobertura(c);
});

for (const g of GRUPOS) {
  const delGrupo = TODAS.filter((r) => r.grupo === g);
  trozos(delGrupo, TAMANO).forEach((trozo, k) => {
    test(`rastreo · ${g} ${k + 1}`, async ({ page }, info) => {
      const reg = new Registro(info);
      const ids = new Set(rutasDe(reg.perfil).map((r) => r.id));
      const mias = trozo.filter((r) => ids.has(r.id));
      test.skip(!mias.length, 'ninguna ruta de este trozo en este perfil');
      test.setTimeout(Math.max(5, mias.length) * 60_000);
      await prepararPagina(page, reg);
      let anterior: Ruta | null = null;
      let visitadas = 0;
      let ms = 0;
      for (const [i, r] of mias.entries()) {
        if (page.isClosed()) break;
        const v = await visitar(page, reg, r, i % 25 === 0);
        visitadas++;
        ms += v.ms;
        // a 3D page left behind: its WebGL context must be released (the tablet runs out of GPU memory)
        if (anterior?.pesada && !r.pesada) {
          const huerfanos = await page
            .evaluate(() => {
              (window as unknown as { gc?: () => void }).gc?.();
              return (window as unknown as { __qa: EstadoSonda }).__qa.contextosHuerfanos();
            })
            .catch(() => 0);
          if (huerfanos > 0)
            await reg.anotar({ sev: 'rendimiento', tipo: 'webgl-fuga', firma: anterior.grupo, msg: `Al salir de ${anterior.hash} quedan ${huerfanos} contexto(s) WebGL sin liberar fuera del documento.` });
        }
        anterior = r;
      }
      reg.cobertura({ 'rutas visitadas': visitadas, [`ms · ${g}`]: ms });
    });
  });
}

test('memoria: el montón de JavaScript no crece al navegar por 60 páginas', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id === 'telefono', 'medido en la tableta y el escritorio');
  test.skip(!!process.env.QA_FILTRO, 'con QA_FILTRO solo se visitan las rutas elegidas');
  test.setTimeout(30 * 60_000);
  await prepararPagina(page, reg);
  // a fixed mix of every group (not the 3D ones: their GPU memory is checked apart)
  const mezcla = TODAS.filter((r) => !r.pesada && !r.accion)
    .sort((a, b) => azarDe(`m:${a.id}`) - azarDe(`m:${b.id}`))
    .slice(0, MODO === 'rapido' ? 30 : 60);
  const medir = async () => {
    await page.evaluate(async () => {
      const g = (window as unknown as { gc?: () => void }).gc;
      for (let k = 0; k < 3; k++) {
        g?.();
        await new Promise((r) => setTimeout(r, 100));
      }
    });
    return page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
  };
  const serie: number[] = [];
  for (const [i, r] of mezcla.entries()) {
    await visitar(page, reg, r, i === 0, { accesibilidad: false });
    if (i === 9 || i === mezcla.length - 1 || i % 10 === 9) serie.push(await medir());
  }
  // back to the start page and measure again: what is left is what the pages keep
  await visitar(page, reg, TODAS[0]!, false, { accesibilidad: false });
  serie.push(await medir());
  const mb = (b: number) => Math.round(b / 1e5) / 10;
  const crecimiento = serie[serie.length - 1]! - serie[0]!;
  reg.ruta = 'memoria';
  reg.cobertura({ 'memoria: MB al principio': mb(serie[0]!), 'memoria: MB al final': mb(serie[serie.length - 1]!) });
  if (crecimiento > 30e6)
    await reg.anotar({ sev: 'rendimiento', tipo: 'memoria', firma: 'crecimiento del montón', msg: `El montón de JavaScript crece ${mb(crecimiento)} MB tras ${mezcla.length} páginas (serie en MB: ${serie.map(mb).join(', ')}): algo se queda en memoria al cambiar de página.` });
});

test('perfil', async ({}, info) => {
  // documents the profile in the report (theme, touch, viewport)
  const p = perfilDe(info.project.name);
  new Registro(info).cobertura({ [`perfil: ${p.nombre} · tema ${p.tema}`]: 1 });
});
