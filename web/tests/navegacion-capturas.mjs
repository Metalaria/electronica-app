// Screenshots of the navigation (icon rail, book index, breadcrumb, phone tabs and drawer) on the target
// screens, light and dark, into tests/capturas/navegacion/.
//   node tests/navegacion-capturas.mjs --url http://localhost:4173 [--perfil portatil] [--tema claro] [--escena lector]
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
const URL_BASE = (args.url ?? 'http://localhost:4173').replace(/\/$/, '') + '/';
const SALIDA = 'tests/capturas/navegacion';
mkdirSync(SALIDA, { recursive: true });

const PERFILES = [
  { nombre: 'movil', w: 412, h: 915, dpr: 2.625, tactil: true },
  { nombre: 'portatil', w: 1280, h: 800, dpr: 2, tactil: false },
  { nombre: 'tableta', w: 1280, h: 800, dpr: 2, tactil: true },
  { nombre: 'tableta-vertical', w: 800, h: 1280, dpr: 2, tactil: true },
];

/** Some reading progress, so that the index shows rings, bars and ticks. */
function progreso() {
  try {
    const t = Date.now();
    const leidas = {};
    for (let k = 1; k <= 7; k++) leidas[`sec-5.${k}`] = t - k * 1000;
    const cap1 = {};
    for (let k = 1; k <= 13; k++) cap1[`sec-1.${k}`] = t - 1e6 - k;
    localStorage.setItem('epa:leidas', JSON.stringify({ cap05: leidas, cap01: cap1, cap00: { 'sec-0.1': t - 5e6 } }));
    localStorage.setItem('epa:posiciones', JSON.stringify({ cap05: { b: 0, t } }));
  } catch {
    /* private mode */
  }
}

async function preparar(navegador, perfil, tema) {
  const ctx = await navegador.newContext({
    viewport: { width: perfil.w, height: perfil.h },
    deviceScaleFactor: perfil.dpr,
    hasTouch: perfil.tactil,
    isMobile: perfil.tactil && perfil.w < 1000,
    colorScheme: tema === 'oscuro' ? 'dark' : 'light',
  });
  await ctx.addInitScript(progreso);
  const page = await ctx.newPage();
  return { ctx, page };
}

async function lector(page) {
  await page.goto(URL_BASE + '#/cap05/sec-5.8');
  await page.locator('#sec-5\\.8').waitFor();
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(900);
}

const ESCENAS = {
  async lector(page, perfil) {
    await lector(page);
    if (perfil.w < 1024) return;
  },
  async indice(page, perfil) {
    await lector(page);
    if (perfil.w < 1024) {
      await page.locator('[data-herramienta="libro"]').click();
      await page.waitForTimeout(500);
    }
  },
  async filtro(page, perfil) {
    await lector(page);
    if (perfil.w < 1024) {
      await page.locator('[data-herramienta="libro"]').click();
      await page.waitForTimeout(400);
    }
    await page.getByRole('searchbox', { name: 'Filtrar capítulos y secciones' }).fill('zener');
    await page.waitForTimeout(400);
  },
  async menu(page) {
    await lector(page);
    await page.locator('.miga-boton').click();
    await page.waitForTimeout(400);
  },
  async herramienta(page) {
    await page.goto(URL_BASE + '#/simulador');
    await page.waitForTimeout(2500);
  },
  async mas(page, perfil) {
    await page.goto(URL_BASE + '#/consolas');
    await page.waitForTimeout(1500);
    if (perfil.w < 1024) {
      await page.locator('[data-herramienta="mas"]').click();
      await page.waitForTimeout(400);
    } else {
      await page.locator('[data-herramienta="instrumentos"]').hover();
      await page.waitForTimeout(800);
    }
  },
  async inicio(page) {
    await page.goto(URL_BASE + '#/');
    await page.waitForTimeout(1000);
  },
};

const navegador = await chromium.launch();
for (const perfil of PERFILES) {
  if (args.perfil && args.perfil !== perfil.nombre) continue;
  for (const tema of ['claro', 'oscuro']) {
    if (args.tema && args.tema !== tema) continue;
    for (const [nombre, escena] of Object.entries(ESCENAS)) {
      if (args.escena && args.escena !== nombre) continue;
      const { ctx, page } = await preparar(navegador, perfil, tema);
      try {
        await escena(page, perfil);
        const ruta = `${SALIDA}/${perfil.nombre}-${tema}-${nombre}.png`;
        await page.screenshot({ path: ruta });
        console.log(ruta);
      } catch (e) {
        console.error(`${perfil.nombre} ${tema} ${nombre}:`, e.message);
      }
      await ctx.close();
    }
  }
}
await navegador.close();
