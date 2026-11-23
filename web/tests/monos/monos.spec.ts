// 1.3.1: the whole-app monkey (tests/monos/mono.ts) over many seeds and device profiles. Not part of the default
// suite (playwright.config.ts ignores tests/monos/); its own configuration serves a build and runs it:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.monos.config.ts --project=telefono
// Environment:
//   MONO_SEMILLA    first seed (default 1310); run k uses MONO_SEMILLA + k
//   MONO_RUNS       number of runs per profile (default 3)
//   MONO_ACCIONES   actions per run (default 300)
//   MONO_REDUCIR=1  on a failure, replay and shrink the trail to a minimal reproduction (MONO_PRESUPUESTO replays, 12)
//   MONO_RASTRO     a trail file written by a failing run (…/monos/<perfil>-<semilla>.json): replays only its
//                   «minimo» (or «acciones») and fails if the failure is still there
//   MONO_SALIDA     folder for the trails of failing runs and the summary lines (default test-results/monos)
//   MONO_HEAP_MB    heap growth over a run that counts as a leak (default 120; 0: off)
//   MONO_INICIO     route the runs start from (default «#/»), e.g. «#/instrumentos/practica/1»
//   MONO_FNIRSI=1   (1.4) the fake link of the real FNIRSI (window.__epaFnirsiFalso) installed, streaming real
//                   multimeter frames and an oscilloscope record, so its panel is there and can be connected
// A failing run writes <perfil>-<semilla>.json with the failures, the whole trail, and the shrunk one; a line per run
// goes to resumen.jsonl (seed, profile, actions, failures, heap).
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Browser } from '@playwright/test';
import { correr, describir, firma, reducir, sondaMono, type Accion, type Fallo } from './mono.ts';
import { MULTIMETRO, REGISTRO_CH1 } from '../fnirsi-real-datos.ts';

const BASE = Number(process.env.MONO_SEMILLA ?? 1310);
const RUNS = Number(process.env.MONO_RUNS ?? 3);
const N = Number(process.env.MONO_ACCIONES ?? 300);
const SALIDA = (process.env.MONO_SALIDA ?? new URL('../../test-results/monos/', import.meta.url).pathname).replace(/\/?$/, '/');
const HEAP = Number(process.env.MONO_HEAP_MB ?? 120) * 1048576;
mkdirSync(SALIDA, { recursive: true });

interface Rastro {
  perfil: string;
  semilla: number;
  inicio: string;
  fallos: Fallo[];
  acciones: Accion[];
  minimo?: { inicio: string; acciones: Accion[]; fallo: string };
}

/** 1.4: the real FNIRSI's fake link's events (MONO_FNIRSI): multimeter frames and one CH1 record, over and over. */
function eventosFnirsi(): number[][] {
  const deHex = (h: string) => h.match(/../g)!.map((x) => parseInt(x, 16));
  const b = Array.from(Buffer.from(REGISTRO_CH1, 'base64'));
  const informe = (cab: number[], datos: number[]) => {
    const r = new Array<number>(64).fill(0);
    cab.forEach((x, k) => (r[k] = x));
    datos.forEach((x, k) => (r[8 + k] = x));
    return r;
  };
  const v = [deHex(MULTIMETRO.pila9V!), deHex(MULTIMETRO.ohm10k!), deHex(MULTIMETRO.capacidadCero!)];
  v.push(informe([0xa0, 1, 0, 56, 0, 0, 0, 0], b.slice(0, 56)));
  for (let d = 0; d < 1024; d += 56) v.push(informe([0xa1, 1, 0, Math.min(56, 1024 - d), d & 0xff, d >> 8, 0, 0], b.slice(56 + d, 56 + d + 56)));
  return v;
}

async function vuelta(browser: Browser, uso: Record<string, unknown>, origen: string, tactil: boolean, o: { semilla: number; n: number; inicio: string; acciones?: Accion[]; pararEnFallo?: boolean }) {
  const ctx = await browser.newContext(uso);
  await ctx.addInitScript(sondaMono);
  if (process.env.MONO_FNIRSI)
    await ctx.addInitScript((eventos) => {
      (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = { modo: 1, eventos, repetir: true };
    }, eventosFnirsi());
  // no real GitHub: the update check and the synchronisation answer «no network»
  await ctx.route('https://api.github.com/**', (r) => r.abort('blockedbyclient'));
  ctx.on('page', (p) => p.on('dialog', (d) => void d.dismiss().catch(() => {})));
  const page = await ctx.newPage();
  page.on('download', (d) => void d.cancel().catch(() => {}));
  try {
    return await correr(page, { origen, tactil, maxCrecimiento: o.acciones ? 0 : HEAP, ...o });
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Replays `acciones` from `inicio` and tells whether the failure `f` (by signature) is seen again. */
async function reproduce(browser: Browser, uso: Record<string, unknown>, origen: string, tactil: boolean, inicio: string, acciones: Accion[], f: string): Promise<boolean> {
  const r = await vuelta(browser, uso, origen, tactil, { semilla: 0, n: acciones.length, inicio, acciones, pararEnFallo: true });
  return r.fallos.some((x) => firma(x) === f);
}

if (process.env.MONO_RASTRO) {
  test('mono · reproducir un rastro', async ({ browser, baseURL }, info) => {
    const r = JSON.parse(readFileSync(process.env.MONO_RASTRO!, 'utf8')) as Rastro;
    const acciones = r.minimo?.acciones ?? r.acciones;
    const inicio = r.minimo?.inicio ?? r.inicio;
    test.setTimeout(acciones.length * 5000 + 120_000);
    const uso = info.project.use as Record<string, unknown>;
    const res = await vuelta(browser, uso, baseURL!, !!uso.hasTouch, { semilla: 0, n: acciones.length, inicio, acciones });
    for (const [k, a] of acciones.entries()) console.log(`${k + 1}. ${describir(a)}`);
    expect(res.fallos.map((f) => `${f.paso + 1}: ${f.oraculo}: ${f.mensaje}`)).toEqual([]);
  });
} else {
  for (let k = 0; k < RUNS; k++) {
    const semilla = BASE + k;
    test(`mono · semilla ${semilla}`, async ({ browser, baseURL }, info) => {
      test.setTimeout(N * 4000 + (process.env.MONO_REDUCIR ? 30 * 60_000 : 0) + 120_000);
      const uso = info.project.use as Record<string, unknown>;
      const tactil = !!uso.hasTouch;
      const perfil = info.project.name;
      const inicio = process.env.MONO_INICIO ?? '#/';
      const t0 = Date.now();
      const res = await vuelta(browser, uso, baseURL!, tactil, { semilla, n: N, inicio });
      // one failure per signature, the first time it is seen
      const unicos = new Map<string, Fallo>();
      for (const f of res.fallos) if (!unicos.has(firma(f))) unicos.set(firma(f), f);
      const fallos = [...unicos.values()];
      appendFileSync(
        `${SALIDA}resumen.jsonl`,
        JSON.stringify({ perfil, semilla, acciones: res.acciones.length, ms: Date.now() - t0, heapInicial: res.heapInicial, heapFinal: res.heapFinal, fallos: fallos.map((f) => `${f.paso + 1}: ${f.oraculo}: ${f.mensaje}`) }) + '\n',
      );
      if (!fallos.length) return;
      const rastro: Rastro = { perfil, semilla, inicio, fallos, acciones: res.acciones };
      const archivo = `${SALIDA}${perfil}-${semilla}.json`;
      writeFileSync(archivo, JSON.stringify(rastro, null, 1));
      if (process.env.MONO_REDUCIR) {
        const f = fallos.find((x) => x.paso >= 0 && x.oraculo !== 'memoria') ?? fallos[0]!;
        const fi = firma(f);
        const prefijo = res.acciones.slice(0, Math.min(f.paso + 1, res.acciones.length));
        let mejor: { inicio: string; acciones: Accion[] } | null = null;
        // the shortest replay first: from the last route the monkey opened before the failure
        const rutas = prefijo.map((a, i) => (a.a === 'ruta' ? i : -1)).filter((i) => i >= 0).reverse().slice(0, 3);
        for (const i of rutas) {
          const ini = (prefijo[i] as { hash: string }).hash;
          if (await reproduce(browser, uso, baseURL!, tactil, ini, prefijo.slice(i + 1), fi)) {
            mejor = { inicio: ini, acciones: prefijo.slice(i + 1) };
            break;
          }
        }
        if (!mejor && (await reproduce(browser, uso, baseURL!, tactil, inicio, prefijo, fi))) mejor = { inicio, acciones: prefijo };
        if (mejor) {
          const m = mejor;
          const corto = await reducir(m.acciones, (a) => reproduce(browser, uso, baseURL!, tactil, m.inicio, a, fi), Number(process.env.MONO_PRESUPUESTO ?? 12));
          rastro.minimo = { inicio: m.inicio, acciones: corto, fallo: fi };
        } else rastro.minimo = undefined;
        writeFileSync(archivo, JSON.stringify(rastro, null, 1));
      }
      const pasos = (rastro.minimo?.acciones ?? res.acciones.slice(Math.max(0, fallos[0]!.paso - 12), fallos[0]!.paso + 1)).map(describir);
      expect(fallos.map((f) => `${f.paso + 1}: ${f.oraculo}: ${f.mensaje}`), `semilla ${semilla} (${archivo})\n${rastro.minimo ? `mínimo desde ${rastro.minimo.inicio}` : 'últimos pasos'}:\n${pasos.join('\n')}`).toEqual([]);
    });
  }
}
