// 0.12 «platform»: the release check without a token (anonymous) and GitHub's rate limit, the signed automatic
// updates on Windows and macOS (instalador.svelte.ts) with the Tauri side replaced by a test bridge
// (globalThis.__epaPuenteActualizador), the fallback to the notice with the link (placeholder public key, Android,
// errors), and the reminder notification's own icon. GitHub is always mocked with route().
// Not testable here (needs the real apps): the plugin's download and signature check, the NSIS/.app replacement,
// the relaunch, and the single instance (tauri-plugin-single-instance acts before any web page exists).
//   PLAYWRIGHT_BROWSERS_PATH=… npx playwright test -c playwright.plataforma12.config.ts actualizador12
import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claveActualizadorValida, explicarErrorActualizador, sistemaActualizable } from '../src/lib/sincronizacion/actualizador';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONF = JSON.parse(fs.readFileSync(path.join(WEB, '..', 'src-tauri', 'tauri.conf.json'), 'utf8'));
const VERSION: string = CONF.version;
const MARCADOR: string = CONF.plugins.updater.pubkey;
const siguiente = () => {
  const [x, y, z] = VERSION.split('.').map(Number);
  return `${x}.${y}.${z! + 1}`;
};
const UA_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Safari/537.36';
const TOKEN = ['github', 'pat', '11PRUEBA0123456789abcdefghijklmnopqrstuvwxyz'].join('_');

/** A real minisign public key (throwaway pair made with the Tauri CLI; the private half is deleted). */
function clavePublicaDePrueba(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epa-act12-'));
  try {
    const f = path.join(dir, 'k.key');
    execFileSync(process.execPath, [path.join(WEB, 'scripts', 'tauri.mjs'), 'signer', 'generate', '--ci', '-p', 'x', '-w', f, '-f'], { stdio: 'pipe' });
    return fs.readFileSync(f + '.pub', 'utf8').trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const CLAVE = clavePublicaDePrueba();

// ------------------------------------------------------------------ fake GitHub API

interface Peticion {
  ruta: string;
  autorizada: boolean;
}

class GitHubFalso {
  peticiones: Peticion[] = [];
  version = siguiente();
  /** 'ok' | 'limite' (403, primary limit) | 'secundario' (403 + retry-after) | 'token-caducado' (401 with a token). */
  modo: 'ok' | 'limite' | 'secundario' | 'token-caducado' = 'ok';
  reinicio = Math.floor(Date.now() / 1000) + 3600;

  async atender(route: Route): Promise<void> {
    const req = route.request();
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization, Accept, Content-Type, X-GitHub-Api-Version',
      'access-control-allow-methods': 'GET, PUT, OPTIONS',
      'access-control-expose-headers': 'x-ratelimit-remaining, x-ratelimit-reset, retry-after',
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    const auth = await req.headerValue('authorization');
    this.peticiones.push({ ruta: url.pathname, autorizada: auth !== null });
    const json = (status: number, cuerpo: unknown, extra: Record<string, string> = {}) =>
      route.fulfill({ status, headers: { ...cors, ...extra, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(cuerpo) });
    if (this.modo === 'limite')
      return json(403, { message: 'API rate limit exceeded for 203.0.113.7.' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(this.reinicio) });
    if (this.modo === 'secundario') return json(403, { message: 'You have exceeded a secondary rate limit.' }, { 'retry-after': '120' });
    if (this.modo === 'token-caducado' && auth !== null) return json(401, { message: 'Bad credentials' });
    if (url.pathname !== '/repos/Metalaria/electronica-app/releases/latest') return json(404, { message: 'Not Found' });
    return json(200, {
      tag_name: `v${this.version}`,
      name: `Electrónica Práctica Avanzada v${this.version}`,
      html_url: `https://github.com/Metalaria/electronica-app/releases/tag/v${this.version}`,
      body: '## Novedades\n- Actualización automática',
      published_at: '2026-11-04T10:00:00Z',
      assets: [{ name: `Electronica-${this.version}-windows-x64-setup.exe` }, { name: 'latest.json' }],
    });
  }

  releases(): number {
    return this.peticiones.filter((p) => p.ruta.endsWith('/releases/latest')).length;
  }
}

// ------------------------------------------------------------------ the Tauri side, replaced

interface Bridge {
  clave?: string;
  /** Version latest.json offers (null: none). */
  version: string | null;
  /** Error message of the next check / download, then cleared. */
  fallarComprobar?: string;
  fallarDescarga?: string;
  /** The download stops half-way until window.__soltarDescarga() is called. */
  pausa?: boolean;
  /** Windows: starting the installer fails with this message (Defender, for instance). */
  fallarInstalacion?: string;
}

/** A context with the app's start-up check on (as in the apps), the fake GitHub and, optionally, the test bridge. */
async function contexto(browser: Browser, gh: GitHubFalso, ua: string, puente: Bridge | null, extra: { token?: string } = {}): Promise<{ ctx: BrowserContext; page: Page }> {
  // tall enough that the notice (bottom right) does not cover the bottom of «Aa» (top right)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 }, userAgent: ua });
  await ctx.route('https://api.github.com/**', (r) => gh.atender(r));
  await ctx.addInitScript(
    ({ puente, token }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__epaComprobarSinToken = true;
      if (!sessionStorage.getItem('preparado')) {
        sessionStorage.setItem('preparado', '1');
        localStorage.clear();
        localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
        if (token) localStorage.setItem('epa-credencial:github', token);
      }
      if (!puente) return;
      const registro = { comprobar: 0, descargas: 0, eventos: [] as string[] };
      w.__act = registro;
      w.__actCfg = puente;
      window.addEventListener('pagehide', () => registro.eventos.push('pagehide'));
      let soltar: () => void = () => {};
      const pausa = new Promise<void>((r) => (soltar = r));
      w.__soltarDescarga = () => soltar();
      w.__epaPuenteActualizador = {
        clave: puente.clave,
        async comprobar() {
          registro.comprobar++;
          const cfg = w.__actCfg as Bridge;
          if (cfg.fallarComprobar) {
            const m = cfg.fallarComprobar;
            cfg.fallarComprobar = undefined;
            throw m;
          }
          if (!cfg.version) return null;
          // like the plugin's Update: close() frees the Rust resource, and using it afterwards fails
          let cerrado = false;
          const rid = (registro as { rids?: number }).rids = ((registro as { rids?: number }).rids ?? 0) + 1;
          const vivo = () => {
            if (cerrado) {
              const m = `The resource id ${rid} is invalid.`;
              ((registro as { errores?: string[] }).errores ??= []).push(m);
              throw m;
            }
          };
          return {
            version: cfg.version,
            async download(onEvent: (e: unknown) => void, opciones?: { timeout?: number }) {
              vivo();
              registro.descargas++;
              (registro as { timeout?: number }).timeout = opciones?.timeout;
              registro.eventos.push('download');
              if (cfg.fallarDescarga) {
                const m = cfg.fallarDescarga;
                cfg.fallarDescarga = undefined;
                throw m;
              }
              onEvent({ event: 'Started', data: { contentLength: 10_000_000 } });
              onEvent({ event: 'Progress', data: { chunkLength: 4_000_000 } });
              if (cfg.pausa) await pausa;
              onEvent({ event: 'Progress', data: { chunkLength: 6_000_000 } });
              onEvent({ event: 'Finished' });
            },
            async install() {
              vivo();
              registro.eventos.push('install');
              if (cfg.fallarInstalacion) throw cfg.fallarInstalacion;
            },
            async close() {
              vivo();
              cerrado = true;
            },
          };
        },
        async reiniciar() {
          registro.eventos.push('reiniciar');
        },
      };
    },
    { puente, token: extra.token ?? '' },
  );
  const page = await ctx.newPage();
  return { ctx, page };
}

async function registro(page: Page): Promise<{ comprobar: number; descargas: number; eventos: string[] }> {
  return page.evaluate(() => (window as unknown as { __act: { comprobar: number; descargas: number; eventos: string[] } }).__act);
}

async function abrirAa(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Tema y tamaño de letra' }).click();
  await expect(page.locator('[data-grupo-actualizaciones]')).toBeVisible();
}

// ------------------------------------------------------------------ pure parts (Node)

test.describe('partes puras del actualizador', () => {
  test('la clave pública: la de tauri signer vale; el marcador, vacía o basura, no', () => {
    expect(claveActualizadorValida(CLAVE)).toBe(true);
    expect(claveActualizadorValida(MARCADOR)).toBe(MARCADOR.startsWith('CLAVE-PUBLICA-PENDIENTE') ? false : true);
    expect(claveActualizadorValida('')).toBe(false);
    expect(claveActualizadorValida('dW50cnVzdGVkIGNvbW1lbnQ6IGhvbGEK')).toBe(false);
    // a truncated key line (41 bytes) is refused, like the plugin does
    const texto = Buffer.from(CLAVE, 'base64').toString('utf8').split('\n');
    const corta = Buffer.from(texto[1]!, 'base64').subarray(0, 41).toString('base64');
    expect(claveActualizadorValida(Buffer.from(`${texto[0]}\n${corta}\n`).toString('base64'))).toBe(false);
  });

  test('qué sistemas se actualizan solos', () => {
    expect(sistemaActualizable(UA_WINDOWS)).toBe('windows');
    expect(sistemaActualizable(UA_MAC)).toBe('macos');
    expect(sistemaActualizable(UA_ANDROID)).toBeNull();
    expect(sistemaActualizable('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBeNull();
    expect(sistemaActualizable('Mozilla/5.0 (X11; Linux x86_64)')).toBeNull();
  });

  test('los errores del plugin se explican en español', () => {
    expect(explicarErrorActualizador('Could not fetch a valid release JSON from the remote', 'comprobar')).toContain('no trae actualización automática');
    expect(explicarErrorActualizador('None of the fallback platforms `["windows-x86_64-nsis","windows-x86_64"]` were found in the response `platforms` object', 'comprobar')).toContain('no trae actualización automática');
    expect(explicarErrorActualizador('The signature verification failed', 'descargar')).toContain('La firma de la actualización no es válida');
    expect(explicarErrorActualizador('Invalid encoding in minisign data', 'descargar')).toContain('La firma');
    expect(explicarErrorActualizador('The update was signed for version 0.12.0 but the update endpoint announced version 0.12.1.', 'descargar')).toContain('no corresponde a la versión anunciada');
    expect(explicarErrorActualizador(new Error('error sending request for url (https://github.com/…/latest.json)'), 'comprobar')).toBe(
      'No se pudo conectar con GitHub para comprobar la actualización. Compruebe la conexión y vuelva a intentarlo.',
    );
    expect(explicarErrorActualizador('Authentication failed or was cancelled', 'instalar')).toContain('macOS pidió permiso');
    expect(explicarErrorActualizador('temp directory is not on the same mount point as the app', 'instalar')).toContain('«Aplicaciones»');
    expect(explicarErrorActualizador('Permission denied (os error 13)', 'instalar')).toContain('no deja reemplazar');
    expect(explicarErrorActualizador('algo raro', 'instalar')).toBe('No se pudo instalar la actualización (algo raro).');
  });
});

// ------------------------------------------------------------------ anonymous check and rate limit

test.describe('comprobación sin token', () => {
  test('al abrir la app sin token: una petición anónima, el aviso, y nada más en 12 horas', async ({ browser }) => {
    const gh = new GitHubFalso();
    const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, null);
    await page.goto('./#/');
    const aviso = page.locator('[data-aviso-version]');
    await expect(aviso).toContainText(`Versión ${siguiente()} disponible`);
    expect(gh.peticiones).toEqual([{ ruta: '/repos/Metalaria/electronica-app/releases/latest', autorizada: false }]);
    // no bridge (a browser): no «Descargar e instalar», the link is the way
    await expect(aviso.locator('[data-instalador]')).toHaveCount(0);
    await expect(aviso.getByRole('button', { name: 'Ver la publicación' })).toBeVisible();
    await page.reload();
    await expect(aviso).toBeVisible();
    await page.waitForTimeout(1500);
    expect(gh.releases()).toBe(1);
    await ctx.close();
  });

  test('con un token caducado la comprobación se repite sin token y funciona', async ({ browser }) => {
    const gh = new GitHubFalso();
    gh.modo = 'token-caducado';
    const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, null, { token: TOKEN });
    await page.goto('./#/');
    await expect(page.locator('[data-aviso-version]')).toContainText(`Versión ${siguiente()} disponible`);
    expect(gh.peticiones.filter((p) => p.ruta.endsWith('/releases/latest')).map((p) => p.autorizada)).toEqual([true, false]);
    await ctx.close();
  });

  test('límite de GitHub: se respeta la hora de reinicio (sin peticiones) y se explica al pedirlo', async ({ browser }) => {
    const gh = new GitHubFalso();
    gh.modo = 'limite';
    const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, null);
    await page.goto('./#/');
    // start-up: one request, silent
    await expect.poll(() => gh.releases()).toBe(1);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('epa:sinc-version') ?? '{}').limite ?? 0))
      .toBe(gh.reinicio * 1000);
    await expect(page.locator('[data-aviso-version]')).toHaveCount(0);
    await abrirAa(page);
    await expect(page.locator('[data-grupo-actualizaciones] [role="alert"]')).toHaveCount(0);
    // asking before the reset time sends nothing and says when it can be tried again
    const hora = new Date(gh.reinicio * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    await page.locator('[data-grupo-actualizaciones]').getByRole('button', { name: 'Buscar actualizaciones' }).click();
    await expect(page.locator('[data-grupo-actualizaciones] [role="alert"]')).toHaveText(
      `GitHub limita el número de peticiones; se podrá volver a intentar a las ${hora}.`,
    );
    // the next start-up does not ask either
    await page.reload();
    await expect(page.locator('#contenido')).not.toContainText('Abriendo el libro');
    await page.waitForTimeout(1500);
    expect(gh.releases()).toBe(1);
    // once the time has passed, it asks again
    gh.modo = 'ok';
    await page.evaluate(() => {
      const g = JSON.parse(localStorage.getItem('epa:sinc-version') ?? '{}');
      g.limite = Date.now() - 1000;
      localStorage.setItem('epa:sinc-version', JSON.stringify(g));
    });
    await page.reload();
    await expect(page.locator('[data-aviso-version]')).toContainText(`Versión ${siguiente()} disponible`);
    expect(gh.releases()).toBe(2);
    await ctx.close();
  });

  test('límite secundario (retry-after): espera esos segundos', async ({ browser }) => {
    const gh = new GitHubFalso();
    gh.modo = 'secundario';
    const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, null);
    await page.goto('./#/');
    await expect.poll(() => gh.releases()).toBe(1);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('epa:sinc-version') ?? '{}').limite ?? 0))
      .toBeGreaterThan(Date.now() + 100_000);
    await abrirAa(page);
    await page.locator('[data-grupo-actualizaciones]').getByRole('button', { name: 'Buscar actualizaciones' }).click();
    await expect(page.locator('[data-grupo-actualizaciones] [role="alert"]')).toContainText('GitHub limita el número de peticiones');
    expect(gh.releases()).toBe(1);
    await ctx.close();
  });
});

// ------------------------------------------------------------------ automatic updates (bridge)

test.describe('actualización automática firmada (Tauri simulado)', () => {
  test('con la clave pública de marcador no hay actualizador: aviso con enlace y ninguna comprobación', async ({ browser }) => {
    const gh = new GitHubFalso();
    // no `clave`: the build's own one, the placeholder of the repository
    const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, { version: siguiente() });
    await page.goto('./#/');
    const aviso = page.locator('[data-aviso-version]');
    await expect(aviso).toContainText(`Versión ${siguiente()} disponible`);
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-instalador]')).toHaveCount(0);
    expect((await registro(page)).comprobar).toBe(MARCADOR.startsWith('CLAVE-PUBLICA-PENDIENTE') ? 0 : 1);
    // (the notice sits over the bottom of «Aa»)
    await aviso.getByRole('button', { name: 'Ahora no' }).click();
    await abrirAa(page);
    await page.locator('[data-grupo-actualizaciones]').getByRole('button', { name: 'Buscar actualizaciones' }).click();
    await expect(page.locator('[data-grupo-actualizaciones]')).toContainText(`Versión ${siguiente()} disponible`);
    await expect(page.locator('[data-grupo-actualizaciones] [data-instalador]')).toHaveCount(0);
    await ctx.close();
  });

  test('en Android no hay actualizador aunque haya clave: aviso con enlace al APK', async ({ browser }) => {
    const gh = new GitHubFalso();
    const { ctx, page } = await contexto(browser, gh, UA_ANDROID, { clave: CLAVE, version: siguiente() });
    await page.goto('./#/');
    await expect(page.locator('[data-aviso-version]')).toContainText(`Versión ${siguiente()} disponible`);
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-instalador]')).toHaveCount(0);
    expect((await registro(page)).comprobar).toBe(0);
    await ctx.close();
  });

  test('Windows: al abrir solo comprueba; descargar con progreso; reiniciar guarda y luego instala', async ({ browser }) => {
    const gh = new GitHubFalso();
    const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, { clave: CLAVE, version: siguiente(), pausa: true });
    await page.goto('./#/');
    const aviso = page.locator('[data-aviso-version]');
    const descargar = aviso.getByRole('button', { name: 'Descargar e instalar' });
    await expect(descargar).toBeVisible();
    // the link stays, as a secondary button
    await expect(aviso.getByRole('button', { name: 'Ver la publicación' })).not.toHaveClass(/primario/);
    let r = await registro(page);
    expect(r.comprobar).toBe(1);
    // nothing downloaded or installed without the click
    expect(r.eventos).toEqual([]);
    await page.waitForTimeout(800);
    expect((await registro(page)).eventos).toEqual([]);

    await descargar.click();
    const barra = aviso.getByRole('progressbar');
    await expect(barra).toHaveAttribute('aria-valuenow', '40');
    await expect(aviso).toContainText(`Descargando la versión ${siguiente()}… 40 %`);
    // the same progress in «Aa»
    await abrirAa(page);
    await expect(page.locator('[data-grupo-actualizaciones] [role="progressbar"]')).toHaveAttribute('aria-valuenow', '40');
    await page.keyboard.press('Escape');
    await page.evaluate(() => (window as unknown as { __soltarDescarga: () => void }).__soltarDescarga());
    const reiniciar = aviso.getByRole('button', { name: 'Reiniciar para terminar' });
    await expect(reiniciar).toBeVisible();
    await expect(aviso).toContainText('se cerrará la aplicación, se instalará la versión');
    r = await registro(page);
    // Windows: the installer only runs at the restart
    expect(r.eventos).toEqual(['download']);
    // the plugin gets a total limit (15 min) besides the stall watchdog
    expect((r as { timeout?: number }).timeout).toBe(15 * 60_000);

    await reiniciar.click();
    // saved, the attempt recorded with the store alive, saved once more, then the installer
    await expect.poll(async () => (await registro(page)).eventos).toEqual(['download', 'pagehide', 'pagehide', 'install']);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('epa-actualizador:intento') ?? 'null'))).toMatchObject({ version: siguiente() });
    // the installer would end this process; if the app comes back still on the old version, it says so once
    await page.reload();
    await expect(aviso.locator('[data-instalador="error"] [role="alert"]')).toContainText(`La versión ${siguiente()} no llegó a instalarse`);
    expect(await page.evaluate(() => localStorage.getItem('epa-actualizador:intento'))).toBeNull();
    await ctx.close();
  });

  test('macOS: la descarga deja la app nueva en su sitio y «Reiniciar para terminar» relanza', async ({ browser }) => {
    const gh = new GitHubFalso();
    const { ctx, page } = await contexto(browser, gh, UA_MAC, { clave: CLAVE, version: siguiente() });
    await page.goto('./#/sincronizacion');
    const tarjeta = page.locator('section[aria-labelledby="t-version"]');
    await expect(tarjeta.locator('[data-nota-actualizaciones]')).toContainText('nunca instala nada sin que usted lo pida');
    await tarjeta.getByRole('button', { name: 'Buscar actualizaciones' }).click();
    await expect(tarjeta).toContainText(`La versión ${siguiente()} se puede descargar e instalar desde aquí (firmada).`);
    await tarjeta.getByRole('button', { name: 'Descargar e instalar' }).click();
    await expect(tarjeta.getByRole('button', { name: 'Reiniciar para terminar' })).toBeVisible();
    await expect(tarjeta).toContainText('ya está instalada; se usará al reiniciar');
    expect((await registro(page)).eventos).toEqual(['download', 'install']);
    await tarjeta.getByRole('button', { name: 'Reiniciar para terminar' }).click();
    await expect.poll(async () => (await registro(page)).eventos).toEqual(['download', 'install', 'pagehide', 'reiniciar']);
    await ctx.close();
  });

  test('errores: sin latest.json (en silencio al abrir, explicado al pedirlo) y firma no válida con reintento', async ({ browser }) => {
    const gh = new GitHubFalso();
    const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, {
      clave: CLAVE,
      version: siguiente(),
      fallarComprobar: 'Could not fetch a valid release JSON from the remote',
    });
    await page.goto('./#/');
    const aviso = page.locator('[data-aviso-version]');
    await expect(aviso).toContainText(`Versión ${siguiente()} disponible`);
    await expect.poll(async () => (await registro(page)).comprobar).toBe(1);
    // at start-up the failure is silent: the notice keeps the link
    await expect(aviso.locator('[data-instalador="error"]')).toHaveCount(0);
    await expect(aviso.getByRole('button', { name: 'Ver la publicación' })).toHaveClass(/primario/);

    // asked for: explained (the bridge fails once more)
    await page.evaluate(() => ((window as unknown as { __actCfg: { fallarComprobar?: string } }).__actCfg.fallarComprobar = 'Could not fetch a valid release JSON from the remote'));
    // (the notice sits over the bottom of «Aa»)
    await aviso.getByRole('button', { name: 'Ahora no' }).click();
    await abrirAa(page);
    const grupo = page.locator('[data-grupo-actualizaciones]');
    await grupo.getByRole('button', { name: 'Buscar actualizaciones' }).click();
    await expect(grupo.locator('[data-instalador="error"] [role="alert"]')).toHaveText(
      'La última versión no trae actualización automática para este equipo. Descárguela desde la publicación.',
    );
    // «Volver a intentarlo» checks again (this time latest.json is there)
    await page.evaluate(() => ((window as unknown as { __actCfg: { fallarDescarga?: string } }).__actCfg.fallarDescarga = 'The signature verification failed'));
    await grupo.getByRole('button', { name: 'Volver a intentarlo' }).click();
    await grupo.getByRole('button', { name: 'Descargar e instalar' }).click();
    await expect(grupo.locator('[role="alert"]')).toHaveText(
      'La firma de la actualización no es válida, así que no se ha instalado nada. Descárguela desde la publicación.',
    );
    expect((await registro(page)).eventos).toEqual(['download']);
    // retrying downloads again; nothing was installed in between
    await grupo.getByRole('button', { name: 'Volver a intentarlo' }).click();
    await expect(grupo.getByRole('button', { name: 'Reiniciar para terminar' })).toBeVisible();
    expect((await registro(page)).eventos).toEqual(['download', 'download']);
    await ctx.close();
  });
});

test('accesibilidad (axe) del aviso y de la tarjeta con el actualizador, en claro, sepia y oscuro', async ({ browser }) => {
  const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
  for (const tema of ['claro', 'sepia', 'oscuro']) {
    const gh = new GitHubFalso();
    const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, { clave: CLAVE, version: siguiente(), pausa: true, fallarDescarga: undefined });
    await ctx.addInitScript((t) => {
      const p = JSON.parse(localStorage.getItem('epa:prefs') ?? '{}');
      localStorage.setItem('epa:prefs', JSON.stringify({ ...p, tema: t }));
    }, tema);
    await page.goto('./#/sincronizacion');
    const aviso = page.locator('[data-aviso-version]');
    await expect(aviso.getByRole('button', { name: 'Descargar e instalar' })).toBeVisible();
    const revisar = async (estado: string) => {
      await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const r = await axe.run(
          { include: [['[data-aviso-version]'], ['section[aria-labelledby="t-version"]']] },
          { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] },
        );
        return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      });
      expect(v, `${tema} · ${estado}`).toEqual([]);
    };
    await revisar('disponible');
    await aviso.getByRole('button', { name: 'Descargar e instalar' }).click();
    await expect(aviso.getByRole('progressbar')).toBeVisible();
    await revisar('descargando');
    await page.evaluate(() => (window as unknown as { __soltarDescarga: () => void }).__soltarDescarga());
    await expect(aviso.getByRole('button', { name: 'Reiniciar para terminar' })).toBeVisible();
    await revisar('listo');
    await ctx.close();
  }
});

test('«Cancelar» durante la descarga vuelve a «Descargar e instalar» y lo que siga llegando se ignora', async ({ browser }) => {
  const gh = new GitHubFalso();
  const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, { clave: CLAVE, version: siguiente(), pausa: true });
  await page.goto('./#/');
  const aviso = page.locator('[data-aviso-version]');
  await aviso.getByRole('button', { name: 'Descargar e instalar' }).click();
  await expect(aviso).toContainText('40 %');
  await aviso.getByRole('button', { name: 'Cancelar' }).click();
  await expect(aviso.getByRole('button', { name: 'Descargar e instalar' })).toBeVisible();
  await expect(aviso.getByRole('progressbar')).toHaveCount(0);
  // the abandoned download ends later: nothing changes
  await page.evaluate(() => (window as unknown as { __soltarDescarga: () => void }).__soltarDescarga());
  await page.waitForTimeout(500);
  await expect(aviso.locator('[data-instalador="disponible"]')).toBeVisible();
  // a new download goes to the end
  await aviso.getByRole('button', { name: 'Descargar e instalar' }).click();
  await expect(aviso.getByRole('button', { name: 'Reiniciar para terminar' })).toBeVisible();
  expect((await registro(page)).descargas).toBe(2);
  // «Cancelar» checked again: the new download used a new Update, and the restart installs it
  expect((await registro(page)).comprobar).toBe(2);
  await aviso.getByRole('button', { name: 'Reiniciar para terminar' }).click();
  await expect.poll(async () => (await registro(page)).eventos.filter((e) => e === 'install')).toEqual(['install']);
  expect((await registro(page) as { errores?: string[] }).errores ?? []).toEqual([]);
  await ctx.close();
});

test('Windows: si el instalador no arranca, la app se reinicia y al volver explica qué pasó', async ({ browser }) => {
  const gh = new GitHubFalso();
  const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, {
    clave: CLAVE,
    version: siguiente(),
    fallarInstalacion: 'Error al ejecutar el instalador: Acceso denegado. (os error 5)',
  });
  await page.goto('./#/');
  const aviso = page.locator('[data-aviso-version]');
  await aviso.getByRole('button', { name: 'Descargar e instalar' }).click();
  await aviso.getByRole('button', { name: 'Reiniciar para terminar' }).click();
  // the window is hidden by then (cleanup_before_exit): no error there, a relaunch instead, with the reason kept
  await expect.poll(async () => (await registro(page)).eventos).toEqual(['download', 'pagehide', 'pagehide', 'install', 'reiniciar']);
  const marca = await page.evaluate(() => JSON.parse(localStorage.getItem('epa-actualizador:fallo') ?? 'null'));
  expect(marca).toMatchObject({ version: siguiente() });
  // the relaunched app (a reload here) says what happened, once, with «Volver a intentarlo»
  await page.reload();
  await expect(aviso.locator('[data-instalador="error"] [role="alert"]')).toContainText(
    `No se pudo abrir el instalador de la versión ${siguiente()} (El sistema no deja reemplazar la aplicación`,
  );
  await expect(aviso.getByRole('button', { name: 'Volver a intentarlo' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('epa-actualizador:fallo'))).toBeNull();
  await page.reload();
  await expect(aviso.getByRole('button', { name: 'Descargar e instalar' })).toBeVisible();
  await ctx.close();
});

test('Windows: la marca de un intento de instalar esta misma versión (la instalación funcionó) se borra sin decir nada', async ({ browser }) => {
  const gh = new GitHubFalso();
  gh.version = VERSION;
  const { ctx, page } = await contexto(browser, gh, UA_WINDOWS, { clave: CLAVE, version: null });
  await ctx.addInitScript((v) => {
    if (!sessionStorage.getItem('marcado')) {
      sessionStorage.setItem('marcado', '1');
      localStorage.setItem('epa-actualizador:intento', JSON.stringify({ version: v, t: Date.now() }));
    }
  }, VERSION);
  await page.goto('./#/');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('epa-actualizador:intento'))).toBeNull();
  await abrirAa(page);
  await expect(page.locator('[data-grupo-actualizaciones] [data-instalador="error"]')).toHaveCount(0);
  await ctx.close();
});

// ------------------------------------------------------------------ reminder icon (Android)

test('Android: un recordatorio de la 0.11 (sin icono) se reprograma una vez con el icono propio', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, userAgent: UA_ANDROID });
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:prefs', JSON.stringify({ recordatorio: { activo: true, hora: '20:00' } }));
    }
    const w = window as unknown as Record<string, unknown>;
    const llamadas: [string, unknown][] = [];
    w.__llamadas = llamadas;
    // the Tauri bridge from the start: the store is refused (the app falls back to localStorage), the reminder
    // of 0.11 is pending
    w.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args: unknown) => {
        llamadas.push([cmd, JSON.parse(JSON.stringify(args ?? null))]);
        if (cmd === 'plugin:notification|is_permission_granted') return true;
        if (cmd === 'plugin:notification|get_pending') return [{ id: 20110, title: 'Electrónica Práctica Avanzada', body: '', schedule: {} }];
        if (cmd.startsWith('plugin:store|')) throw new Error('sin almacén en la prueba');
        return null;
      },
      transformCallback: () => Math.floor(Math.random() * 1e9),
      unregisterCallback: () => {},
    };
  });
  const page = await ctx.newPage();
  const notifies = async () =>
    (await page.evaluate(() => (window as unknown as { __llamadas: [string, { options?: { icon?: string; id?: number } }][] }).__llamadas)).filter(
      (x) => x[0] === 'plugin:notification|notify',
    );
  await page.goto('./#/');
  await expect.poll(async () => (await notifies()).length, { timeout: 20_000 }).toBe(1);
  expect((await notifies())[0]![1].options).toMatchObject({ id: 20110, icon: 'ic_stat_epa' });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('epa:recordatorio-icono'))).toBe('1');
  // next start: pending and already with the icon, so it is left alone
  await page.reload();
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __llamadas: [string][] }).__llamadas)).some((x) => x[0] === 'plugin:notification|get_pending'), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(1000);
  expect(await notifies()).toEqual([]);
  await ctx.close();
});
