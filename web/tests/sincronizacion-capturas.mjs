#!/usr/bin/env node
// Screenshots of the synchronisation page, the settings popover, the «Versión X.Y.Z disponible» notice and the
// console boards in 3D/2D, for the three devices of the owner (Mac 1280×800 @2×, tablet portrait, phone) in light
// and dark themes. GitHub is mocked (no network).
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/sincronizacion-capturas.mjs --url http://localhost:4221/
//   → tests/capturas/sincronizacion/*.png
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const URL_BASE = opt('--url', 'http://localhost:4221/');
const solo = opt('--solo', '');
const raiz = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(raiz, 'capturas', 'sincronizacion');
fs.mkdirSync(SALIDA, { recursive: true });
const VERSION = JSON.parse(fs.readFileSync(path.join(raiz, '..', '..', 'src-tauri', 'tauri.conf.json'), 'utf8')).version;
const [vx, vy, vz] = VERSION.split('.').map(Number);
const NUEVA = `${vx}.${vy + 1}.0`;
// Fake token, built in pieces so secret scanners (GitHub push protection) don't flag the literal.
const TOKEN = ['github', 'pat', '11CAPTURAS0000000000000000000000000000000000a1B2'].join('_');

const PERFILES = {
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  tableta: { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  movil: { viewport: { width: 412, height: 892 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
};

/** Remote file: another device (the tablet) already synchronised a bookmark and a note. */
function docRemoto() {
  const t = Date.now() - 3_600_000;
  return {
    formato: 'epa-sincronizacion', version: 1, id: 'capturas', actualizado: t, podado: 0,
    dispositivos: { tableta: { nombre: 'Android (tableta)', ultima: t, version: VERSION } },
    almacenes: {
      marcadores: { 'sec-5.3': { t, v: { parte: 'cap05', label: 'sec-5.3', num: '5.3', titulo: 'La Ecuación de Shockley', t } } },
      notas: { 'sec-5.3': { t, v: { parte: 'cap05', label: 'sec-5.3', num: '5.3', titulo: 'La Ecuación de Shockley', t, texto: 'Repasar n·V_T a 300 K' } } },
    },
  };
}

async function simularGitHub(ctx, conRelease) {
  let fichero = { sha: 'a1', texto: JSON.stringify(docRemoto()) };
  await ctx.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const u = new URL(req.url()).pathname;
    const json = (status, body) => route.fulfill({ status, headers: cors, body: JSON.stringify(body) });
    if (u.endsWith('/releases/latest'))
      return conRelease
        ? json(200, { tag_name: `v${NUEVA}`, name: `v${NUEVA}`, html_url: 'https://github.com/Metalaria/electronica-app/releases', body: '## Novedades\n- Sincronización entre dispositivos por GitHub\n- Placas de la Mega Drive y la Game Boy Color en 3D', assets: [{ name: `Electronica-${NUEVA}-macos-universal.dmg` }, { name: `Electronica-${NUEVA}-android.apk` }] })
        : json(200, { tag_name: `v${VERSION}`, body: '' });
    if (u.includes('/contents/')) {
      if (req.method() === 'GET')
        return json(200, { type: 'file', sha: fichero.sha, encoding: 'base64', content: Buffer.from(fichero.texto).toString('base64') });
      const b = JSON.parse(req.postData() ?? '{}');
      fichero = { sha: fichero.sha + 'x', texto: Buffer.from(b.content, 'base64').toString('utf8') };
      return json(200, { content: { sha: fichero.sha } });
    }
    return json(200, { full_name: 'x/y' });
  });
}

const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function contexto(perfil, tema, { token = true, release = false } = {}) {
  const ctx = await navegador.newContext({ ...PERFILES[perfil], baseURL: URL_BASE, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
  await simularGitHub(ctx, release);
  await ctx.addInitScript(
    ({ tema, token, t }) => {
      localStorage.setItem('epa:prefs', JSON.stringify({ tema, tam: 18 }));
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      if (token) localStorage.setItem('epa-credencial:github', t);
    },
    { tema, token, t: TOKEN },
  );
  return ctx;
}

async function listo(page) {
  await page.waitForFunction(() => !document.querySelector('.cargando'), null, { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

const escenas = [
  {
    id: 'pagina',
    async hacer(page) {
      await page.goto('#/sincronizacion');
      await listo(page);
      await page.locator('[data-sincronizar]').click();
      await page.locator('[data-resumen]').waitFor();
      await page.waitForTimeout(400);
    },
    completa: true,
  },
  {
    id: 'sin-token',
    opciones: { token: false },
    async hacer(page) {
      await page.goto('#/sincronizacion');
      await listo(page);
    },
  },
  {
    id: 'ajustes',
    async hacer(page) {
      await page.goto('#/sincronizacion');
      await listo(page);
      await page.locator('[data-sincronizar]').click();
      await page.locator('[data-resumen]').waitFor();
      await page.getByRole('button', { name: 'Tema y tamaño de letra' }).click();
      await page.locator('[data-grupo-actualizaciones]').waitFor();
      await page.waitForTimeout(400);
    },
  },
  {
    id: 'aviso-version',
    opciones: { release: true },
    async hacer(page) {
      await page.goto('#/');
      await page.locator('[data-aviso-version]').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(500);
    },
  },
  {
    id: 'megadrive-3d',
    async hacer(page) {
      await page.goto('#/consolas/megadrive/placa3d/U1');
      await page.waitForFunction(() => globalThis.__epaPlaca3DListo === true, null, { timeout: 240_000 });
      await page.waitForTimeout(1500);
    },
  },
  {
    id: 'megadrive-2d',
    async hacer(page) {
      await page.goto('#/consolas/megadrive/placa2d/U8');
      await listo(page);
      await page.waitForTimeout(1200);
    },
  },
  {
    id: 'gbc-2d',
    async hacer(page) {
      await page.goto('#/consolas/gbc/placa2d/U3');
      await listo(page);
      await page.getByRole('button', { name: 'Cara inferior' }).click();
      await page.waitForTimeout(1500);
    },
  },
  {
    id: 'gbc-3d',
    async hacer(page) {
      await page.goto('#/consolas/gbc/placa3d');
      await page.waitForFunction(() => globalThis.__epaPlaca3DListo === true, null, { timeout: 240_000 });
      await page.waitForTimeout(1500);
    },
  },
  {
    id: 'gbc-fuentes',
    async hacer(page) {
      await page.goto('#/consolas/gbc/fuentes');
      await page.locator('.placas-fuentes').waitFor();
      await page.locator('.placas-fuentes').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    },
  },
];

const combinaciones = [];
for (const e of escenas) {
  for (const perfil of Object.keys(PERFILES)) for (const tema of ['claro', 'oscuro']) combinaciones.push([e, perfil, tema]);
}
for (const [e, perfil, tema] of combinaciones) {
  const nombre = `${e.id}-${perfil}-${tema}`;
  if (solo && !nombre.includes(solo)) continue;
  const ctx = await contexto(perfil, tema, e.opciones);
  const page = await ctx.newPage();
  try {
    await e.hacer(page);
    await page.screenshot({ path: path.join(SALIDA, `${nombre}.png`), fullPage: !!e.completa && perfil !== 'mac', timeout: 180_000 });
    console.log('captura', nombre);
  } catch (err) {
    console.log('FALLO', nombre, err.message.split('\n')[0]);
  }
  await ctx.close();
}
await navegador.close();
