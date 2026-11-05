// Second independent review of the 0.12 «platform» block: «Cancelar» during the download of the signed update and
// then «Descargar e instalar» again, with a test bridge that behaves like the real plugin. tests/actualizador12.spec.ts
// covers the same steps, but its fake Update has a no-op close(); the real one (@tauri-apps/plugin-updater 2.14.1,
// dist-js/index.js `Update`) closes the Update resource and its downloaded bytes in the Rust resource table, and
// `install` then fails with «The resource id N is invalid.» (tauri 2.12.4 error.rs BadResourceId; updater
// commands.rs `install` looks both ids up). instalador.svelte.ts keeps the same Update after «Cancelar» (pendiente)
// and, when the abandoned first download ends, calls u.close() on it (descargarVigilado, stale branch) while the
// second download of that same Update is under way, so the second one can never be installed.
// The bridge below copies the plugin's Update class (download / install / close) over a fake resource table with
// the Rust side's lookups. Each download waits until the test releases it (window.__soltar[i]()).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision12q.config.ts
import { test, expect, type Browser, type Route } from '@playwright/test';
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
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** A real minisign public key (throwaway pair made with the Tauri CLI; the private half is deleted at once). */
function clavePublicaDePrueba(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epa-rev12q-'));
  try {
    const f = path.join(dir, 'k.key');
    execFileSync(process.execPath, [path.join(WEB, 'scripts', 'tauri.mjs'), 'signer', 'generate', '--ci', '-p', 'x', '-w', f, '-f'], { stdio: 'pipe' });
    return fs.readFileSync(f + '.pub', 'utf8').trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const CLAVE = clavePublicaDePrueba();

interface Registro {
  descargas: number;
  instalados: number;
  reinicios: number;
  errores: string[];
}

async function preparar(browser: Browser, ua: string) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 }, userAgent: ua });
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
      if (!sessionStorage.getItem('preparado')) {
        sessionStorage.setItem('preparado', '1');
        localStorage.clear();
        localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      }
      const registro = { descargas: 0, instalados: 0, reinicios: 0, errores: [] as string[] };
      w.__reg = registro;
      const soltar: (() => void)[] = [];
      w.__soltar = soltar;

      // ---- the Rust resource table (tauri 2.12.4 resources/plugin.rs close; error.rs BadResourceId)
      const tabla = new Map<number, unknown>();
      let siguiente = 1;
      const añadir = (v: unknown) => {
        const rid = siguiente++;
        tabla.set(rid, v);
        return rid;
      };
      const exigir = (rid: number) => {
        if (!tabla.has(rid)) {
          const m = `The resource id ${rid} is invalid.`;
          registro.errores.push(m);
          throw m;
        }
      };
      class Resource {
        constructor(readonly rid: number) {}
        async close() {
          exigir(this.rid);
          tabla.delete(this.rid);
        }
      }
      // ---- @tauri-apps/plugin-updater 2.14.1 dist-js `Update`, with invoke() replaced by the commands' lookups
      class Update extends Resource {
        version = version;
        downloadedBytes?: Resource;
        async download(onEvent?: (e: unknown) => void) {
          // commands.rs download: resources_table().get::<Update>(rid)? first, then the request
          exigir(this.rid);
          const i = registro.descargas++;
          onEvent?.({ event: 'Started', data: { contentLength: 10_000_000 } });
          onEvent?.({ event: 'Progress', data: { chunkLength: 4_000_000 } });
          await new Promise<void>((r) => (soltar[i] = r));
          onEvent?.({ event: 'Progress', data: { chunkLength: 6_000_000 } });
          onEvent?.({ event: 'Finished' });
          const bytesRid = añadir('bytes');
          await this.downloadedBytes?.close().catch(() => {});
          this.downloadedBytes = new Resource(bytesRid);
        }
        async install() {
          if (!this.downloadedBytes) throw new Error('Update.install called before Update.download');
          // commands.rs install: both ids are looked up
          exigir(this.rid);
          exigir(this.downloadedBytes.rid);
          tabla.delete(this.downloadedBytes.rid);
          this.downloadedBytes = undefined;
          registro.instalados++;
        }
        override async close() {
          await this.downloadedBytes?.close();
          await super.close();
        }
      }
      w.__epaPuenteActualizador = {
        clave,
        async comprobar() {
          return new Update(añadir('update'));
        },
        async reiniciar() {
          registro.reinicios++;
        },
      };
    },
    { clave: CLAVE, version: NUEVA },
  );
  const page = await ctx.newPage();
  const reg = () => page.evaluate(() => (window as unknown as { __reg: Registro }).__reg);
  const soltar = (i: number) => page.evaluate((i) => (window as unknown as { __soltar: (() => void)[] }).__soltar[i]!(), i);
  return { ctx, page, reg, soltar };
}

for (const [sistema, ua] of [
  ['macOS', UA_MAC],
  ['Windows', UA_WINDOWS],
] as const) {
  test(`${sistema}: «Cancelar» y otra vez «Descargar e instalar» mientras la primera descarga sigue: la segunda se instala`, async ({ browser }) => {
    const { ctx, page, reg, soltar } = await preparar(browser, ua);
    await page.goto('./#/');
    const aviso = page.locator('[data-aviso-version]');
    await aviso.getByRole('button', { name: 'Descargar e instalar' }).click();
    await expect(aviso).toContainText('40 %');
    await aviso.getByRole('button', { name: 'Cancelar' }).click();
    // the reader asks again at once: the plugin cannot abort the first request, so both run
    await aviso.getByRole('button', { name: 'Descargar e instalar' }).click();
    await expect(aviso).toContainText('40 %');
    expect((await reg()).descargas).toBe(2);
    // the abandoned first download ends, then the second one
    await soltar(0);
    await page.waitForTimeout(300);
    await soltar(1);
    if (sistema === 'macOS') {
      // macOS installs right after the download: it must succeed and offer the restart
      await expect(aviso.getByRole('button', { name: 'Reiniciar para terminar' })).toBeVisible();
      expect((await reg()).instalados).toBe(1);
    } else {
      await aviso.getByRole('button', { name: 'Reiniciar para terminar' }).click();
      // the installer must start (install), not fail and relaunch the app with «No se pudo abrir el instalador»
      await expect.poll(async () => (await reg()).instalados + (await reg()).reinicios).toBeGreaterThan(0);
      const r = await reg();
      expect(r.instalados).toBe(1);
      expect(r.reinicios).toBe(0);
      expect(await page.evaluate(() => localStorage.getItem('epa-actualizador:fallo'))).toBeNull();
    }
    expect((await reg()).errores).toEqual([]);
    await ctx.close();
  });
}
