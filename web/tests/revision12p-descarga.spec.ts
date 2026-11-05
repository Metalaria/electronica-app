// Independent review of the 0.12 «platform» block: a download of the signed update that stalls (the connection
// stays open but no more bytes arrive). instalador.svelte.ts calls the plugin's download() without a timeout, and
// tauri-plugin-updater 2.14.1 (commands.rs `download`, updater.rs `Update::download`) only sets a reqwest timeout
// when one is passed, so in the real app such a download never ends. This spec reproduces what the reader then
// sees with the Tauri side replaced by a test bridge (as tests/actualizador12.spec.ts does): the progress stays
// put, there is no «Cancelar» or «Volver a intentarlo», and «Buscar actualizaciones» does not recover either,
// because comprobarInstalable() returns early while the state is «descargando». Only quitting the app helps.
// Fixed (0.12 fix round): a stall watchdog (no Progress event for 60 s → error with «Volver a intentarlo», the pending
// update dropped), a 15-minute total timeout passed to the plugin's download, and «Cancelar». The test shortens the
// watchdog with globalThis.__epaEsperaDescarga (ms) and checks the way out; the expectations were inverted.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision12p.config.ts
import { test, expect, type Route } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONF = JSON.parse(fs.readFileSync(path.join(WEB, '..', 'src-tauri', 'tauri.conf.json'), 'utf8'));
const VERSION: string = CONF.version;
const [x, y, z] = VERSION.split('.').map(Number);
const NUEVA = `${x}.${y}.${z! + 1}`;
const UA_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';

/** A real minisign public key (throwaway pair made with the Tauri CLI; the private half is deleted at once). */
function clavePublicaDePrueba(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epa-rev12p-'));
  try {
    const f = path.join(dir, 'k.key');
    execFileSync(process.execPath, [path.join(WEB, 'scripts', 'tauri.mjs'), 'signer', 'generate', '--ci', '-p', 'x', '-w', f, '-f'], { stdio: 'pipe' });
    return fs.readFileSync(f + '.pub', 'utf8').trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('una descarga que se atasca acaba en un error con «Volver a intentarlo» y no bloquea nuevas comprobaciones (hallazgo de la revisión, arreglado)', async ({ browser }) => {
  const clave = clavePublicaDePrueba();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 }, userAgent: UA_WINDOWS });
  await ctx.route('https://api.github.com/**', (route: Route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Accept, Content-Type, X-GitHub-Api-Version' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({
        tag_name: `v${NUEVA}`,
        name: `v${NUEVA}`,
        html_url: `https://github.com/Metalaria/electronica-app/releases/tag/v${NUEVA}`,
        body: '',
        published_at: '2026-11-04T10:00:00Z',
        assets: [{ name: 'latest.json' }],
      }),
    });
  });
  await ctx.addInitScript(
    ({ clave, version }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__epaComprobarSinToken = true;
      // the stall watchdog after 2 s instead of 60 s
      w.__epaEsperaDescarga = 2000;
      if (!sessionStorage.getItem('preparado')) {
        sessionStorage.setItem('preparado', '1');
        localStorage.clear();
        localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      }
      const registro = { comprobar: 0, descargas: 0 };
      w.__act = registro;
      w.__epaPuenteActualizador = {
        clave,
        async comprobar() {
          registro.comprobar++;
          return {
            version,
            // the plugin's download with a connection that stalls after 40 %: it never resolves nor rejects
            download(onEvent: (e: unknown) => void) {
              registro.descargas++;
              onEvent({ event: 'Started', data: { contentLength: 10_000_000 } });
              onEvent({ event: 'Progress', data: { chunkLength: 4_000_000 } });
              return new Promise<void>(() => {});
            },
            async install() {},
            async close() {},
          };
        },
        async reiniciar() {},
      };
    },
    { clave, version: NUEVA },
  );
  const page = await ctx.newPage();
  await page.goto('./#/');
  const aviso = page.locator('[data-aviso-version]');
  await aviso.getByRole('button', { name: 'Descargar e instalar' }).click();
  await expect(aviso).toContainText(`Descargando la versión ${NUEVA}… 40 %`);

  // While it downloads there is a way out («Cancelar»).
  await expect(aviso.getByRole('button', { name: 'Cancelar' })).toBeVisible();

  // The stall is detected (no data for the watchdog's time): an error in Spanish with «Volver a intentarlo».
  await expect(aviso.locator('[data-instalador="error"] [role="alert"]')).toContainText('La descarga se ha detenido', { timeout: 10_000 });
  await aviso.getByRole('button', { name: 'Ahora no' }).click();
  await page.getByRole('button', { name: 'Tema y tamaño de letra' }).click();
  const grupo = page.locator('[data-grupo-actualizaciones]');
  await expect(grupo).toBeVisible();
  await expect(grupo.locator('[data-instalador="error"]')).toBeVisible();
  await expect(grupo.locator('[data-instalador="descargando"]')).toHaveCount(0);

  // «Buscar actualizaciones» is no longer blocked: it checks latest.json again and offers the download again.
  await grupo.getByRole('button', { name: 'Buscar actualizaciones' }).click();
  await expect(grupo.getByRole('button', { name: 'Descargar e instalar' })).toBeVisible();
  const r = await page.evaluate(() => (window as unknown as { __act: { comprobar: number; descargas: number } }).__act);
  expect(r).toEqual({ comprobar: 2, descargas: 1 });
  await ctx.close();
});
