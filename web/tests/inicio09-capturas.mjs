// Screenshots of the 0.9 facelift (start page and restyled tool pages) on the Mac, a tablet in portrait and a
// phone, in the three themes, into tests/capturas/lavado09/inicio/.
//   node tests/inicio09-capturas.mjs --url http://localhost:4301 [--perfil movil] [--tema sepia] [--escena inicio]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split('--')
    .filter(Boolean)
    .map((a) => a.trim().split(/\s+/))
    .map(([k, v]) => [k, v ?? '1']),
);
const URL_BASE = (args.url ?? 'http://localhost:4301').replace(/\/$/, '') + '/';
const SALIDA = 'tests/capturas/lavado09/inicio';
mkdirSync(SALIDA, { recursive: true });

const PERFILES = [
  { nombre: 'mac', w: 1280, h: 800, dpr: 2, tactil: false },
  { nombre: 'tableta', w: 800, h: 1280, dpr: 2, tactil: true },
  { nombre: 'movil', w: 412, h: 915, dpr: 2, tactil: true },
];
const TEMAS = ['claro', 'oscuro', 'sepia'];

/** A reader in the middle of tome I: chapters 0–4 read, 5.1–5.4 read, a lesson of 5.2 at step 4 of 7, a streak. */
function sembrar(tema) {
  try {
    const t = Date.now();
    const leidas = { cap05: {} };
    const secciones = { cap00: 21, cap01: 14, cap02: 14, cap03: 11, cap04: 13 };
    for (const [parte, n] of Object.entries(secciones)) {
      const num = Number(parte.slice(3));
      leidas[parte] = {};
      for (let k = 1; k <= n; k++) leidas[parte][`sec-${num}.${k}`] = t - 9e7 - k;
    }
    for (let k = 1; k <= 4; k++) leidas.cap05[`sec-5.${k}`] = t - k * 1000;
    leidas['00_preliminares'] = { 'sec-pre-1': t - 1e9 };
    localStorage.setItem('epa:leidas', JSON.stringify(leidas));
    localStorage.setItem('epa:posiciones', JSON.stringify({ cap05: { b: 0, sec: 'sec-5.3', t }, cap02: { b: 0, sec: 'sec-2.4', t: t - 5e7 } }));
    localStorage.setItem('epa:lecciones', JSON.stringify({ 'cap05/sec-5.2': { h: [0, 1, 2], u: 3, n: 7, c: 0, t } }));
    localStorage.setItem('epa:prefs', JSON.stringify({ tema, tam: 18, nombre: 'Gonzalo' }));
    // a six-day streak, two of three steps today (days start at 04:00)
    const dia = (k) => {
      const d = new Date(t);
      if (d.getHours() < 4) d.setDate(d.getDate() - 1);
      d.setDate(d.getDate() - k);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const dias = {};
    for (let k = 1; k <= 6; k++) dias[dia(k)] = { pasos: 3 + (k % 2), preguntas: 4, secciones: 1, cumplido: true, t: t - k * 864e5 };
    dias[dia(0)] = { pasos: 2, preguntas: 0, secciones: 0, cumplido: false, t };
    localStorage.setItem('epa:progreso-diario', JSON.stringify(dias));
  } catch {
    /* private mode */
  }
}

const ESCENAS = {
  inicio: { ruta: '#/', espera: '.camino-libro', completa: true },
  simulador: { ruta: '#/simulador', espera: 'main h1', completa: false },
  ejercicios: { ruta: '#/ejercicios', espera: 'main h1', completa: false },
  repaso: { ruta: '#/repaso', espera: 'main h1', completa: false },
  calculadoras: { ruta: '#/calculadoras', espera: 'main h1', completa: false },
  componentes: { ruta: '#/componentes', espera: 'main h1', completa: false },
  conceptos: { ruta: '#/conceptos', espera: 'main h1', completa: false },
  consolas: { ruta: '#/consolas', espera: 'main h1', completa: false },
};

const navegador = await chromium.launch();
const perfiles = PERFILES.filter((p) => !args.perfil || p.nombre === args.perfil);
const temas = TEMAS.filter((t) => !args.tema || t === args.tema);
const escenas = Object.entries(ESCENAS).filter(([n]) => (args.escena ? args.escena.split(',').includes(n) : ['inicio', 'simulador', 'ejercicios'].includes(n)));
for (const perfil of perfiles) {
  for (const tema of temas) {
    const ctx = await navegador.newContext({
      viewport: { width: perfil.w, height: perfil.h },
      deviceScaleFactor: perfil.dpr,
      hasTouch: perfil.tactil,
      isMobile: perfil.tactil && perfil.w < 1000,
    });
    await ctx.addInitScript(sembrar, tema);
    const page = await ctx.newPage();
    for (const [nombre, e] of escenas) {
      await page.goto(URL_BASE + e.ruta);
      await page.locator(e.espera).first().waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500);
      const archivo = `${SALIDA}/${nombre}-${perfil.nombre}-${tema}.png`;
      await page.screenshot({ path: archivo, fullPage: e.completa });
      console.log(archivo);
    }
    await ctx.close();
  }
}
await navegador.close();
