// Synchronisation through a private GitHub repository and the «Hay una versión nueva» notice.
// GitHub is never contacted: every request to api.github.com goes to FakeGitHub through route().
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.sincronizacion.config.ts sincronizacion
import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  fusionarDocs,
  docVacio,
  canonico,
  type DocSincronizacion,
  type Coleccion,
} from '../src/lib/sincronizacion/fusion';

const VERSION: string = JSON.parse(readFileSync(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8')).version;
// Fake token, built in pieces so secret scanners (GitHub push protection) don't flag the literal.
const TOKEN = ['github', 'pat', '11PRUEBA0123456789abcdefghijklmnopqrstuvwxyz'].join('_');
const DATOS = 'Metalaria/electronica-datos';
const RUTA = 'sincronizacion/datos.json';

interface Peticion {
  metodo: string;
  ruta: string;
  token: string;
}

/** An in-memory GitHub: the two repositories, the Contents API with sha checks, and releases/latest. */
class FakeGitHub {
  ficheros = new Map<string, { sha: string; texto: string }>();
  peticiones: Peticion[] = [];
  release: { tag_name: string; body: string } | null = null;
  /** The next PUT fails with 409 after «another device» has written this change into the file. */
  conflicto: ((doc: DocSincronizacion) => void) | null = null;
  conflictos = 0;

  doc(): DocSincronizacion | null {
    const f = this.ficheros.get(`${DATOS}/${RUTA}`);
    return f ? (JSON.parse(f.texto) as DocSincronizacion) : null;
  }

  private guardar(clave: string, texto: string): string {
    const sha = createHash('sha1').update(texto).digest('hex');
    this.ficheros.set(clave, { sha, texto });
    return sha;
  }

  async atender(route: Route): Promise<void> {
    const req = route.request();
    const url = new URL(req.url());
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization, Accept, Content-Type, X-GitHub-Api-Version',
      'access-control-allow-methods': 'GET, PUT, OPTIONS',
      'access-control-expose-headers': 'x-ratelimit-remaining, x-ratelimit-reset',
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const auth = (await req.headerValue('authorization')) ?? '';
    const token = auth.replace(/^Bearer /, '');
    this.peticiones.push({ metodo: req.method(), ruta: url.pathname, token });
    const json = (status: number, cuerpo: unknown) =>
      route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(cuerpo) });
    if (token !== TOKEN) return json(401, { message: 'Bad credentials' });

    const m = /^\/repos\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(url.pathname);
    if (!m) return json(404, { message: 'Not Found' });
    const repo = `${m[1]}/${m[2]}`;
    const resto = m[3] ?? '';
    if (repo !== DATOS && repo !== 'Metalaria/electronica-app') return json(404, { message: 'Not Found' });
    if (!resto) return json(200, { full_name: repo, private: true });
    if (resto === 'releases/latest') {
      if (repo !== 'Metalaria/electronica-app' || !this.release) return json(404, { message: 'Not Found' });
      return json(200, {
        ...this.release,
        name: `Electrónica Práctica Avanzada ${this.release.tag_name}`,
        html_url: `https://github.com/Metalaria/electronica-app/releases/tag/${this.release.tag_name}`,
        published_at: '2026-10-25T10:00:00Z',
        assets: [
          { name: `Electronica-${this.release.tag_name.slice(1)}-macos-universal.dmg` },
          { name: `Electronica-${this.release.tag_name.slice(1)}-android.apk` },
        ],
      });
    }
    const c = /^contents\/(.+)$/.exec(resto);
    if (!c || repo !== DATOS) return json(404, { message: 'Not Found' });
    const clave = `${repo}/${decodeURIComponent(c[1]!)}`;
    const f = this.ficheros.get(clave);
    if (req.method() === 'GET') {
      if (!f) return json(404, { message: 'Not Found' });
      // GitHub wraps the base64 content every 60 characters.
      const b64 = Buffer.from(f.texto, 'utf8').toString('base64').replace(/.{60}/g, '$&\n');
      return json(200, { type: 'file', sha: f.sha, encoding: 'base64', content: b64, size: f.texto.length });
    }
    if (req.method() === 'PUT') {
      const cuerpo = JSON.parse(req.postData() ?? '{}') as { content: string; sha?: string; message: string };
      if (this.conflicto && f) {
        const otro = JSON.parse(f.texto) as DocSincronizacion;
        this.conflicto(otro);
        this.conflicto = null;
        this.conflictos++;
        this.guardar(clave, JSON.stringify(otro));
        return json(409, { message: 'is at 0000 but expected ' + cuerpo.sha });
      }
      if (f && cuerpo.sha !== f.sha) return json(409, { message: 'sha mismatch' });
      if (!f && cuerpo.sha) return json(422, { message: 'sha for a file that does not exist' });
      if (f && !cuerpo.sha) return json(422, { message: '"sha" wasn\'t supplied.' });
      const sha = this.guardar(clave, Buffer.from(cuerpo.content, 'base64').toString('utf8'));
      return json(f ? 200 : 201, { content: { sha, path: c[1] } });
    }
    return json(405, { message: 'Method not allowed' });
  }
}

const marcador = (parte: string, label: string, num: string, titulo: string, t: number) => ({ parte, label, num, titulo, t });

/** A «device»: its own browser context (own localStorage) with the fake GitHub routed in. */
async function dispositivo(
  browser: import('@playwright/test').Browser,
  gh: FakeGitHub,
  datos: Record<string, unknown>,
  opciones: { token?: string; auto?: boolean } = {},
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.route('https://api.github.com/**', (r) => gh.atender(r));
  const page = await ctx.newPage();
  await page.goto('./#/');
  await page.evaluate(
    ({ datos, token, auto }) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(datos)) localStorage.setItem('epa:' + k, JSON.stringify(v));
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto }));
      if (token) localStorage.setItem('epa-credencial:github', token);
    },
    { datos, token: opciones.token ?? TOKEN, auto: opciones.auto ?? false },
  );
  await page.goto('./#/sincronizacion');
  await page.reload();
  await expect(page.locator('[data-pagina="sincronizacion"]')).toBeVisible();
  return { ctx, page };
}

async function sincronizarAhora(page: Page): Promise<void> {
  const pag = page.locator('[data-pagina="sincronizacion"]');
  const n = Number(await pag.getAttribute('data-ejecuciones'));
  await page.locator('[data-sincronizar]').click();
  await expect(pag).toHaveAttribute('data-ejecuciones', String(n + 1));
}

async function leer<T>(page: Page, clave: string): Promise<T> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem('epa:' + k) ?? 'null'), clave) as Promise<T>;
}

test.describe('Sincronización con GitHub', () => {
  test('sin token no se hace ninguna petición a GitHub', async ({ page }) => {
    const gh = new FakeGitHub();
    gh.release = { tag_name: 'v99.0.0', body: 'Nada' };
    const todas: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('api.github.com')) todas.push(r.url());
    });
    await page.route('https://api.github.com/**', (r) => gh.atender(r));
    await page.goto('./#/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('#contenido')).not.toContainText('Abriendo el libro');
    await page.getByRole('button', { name: 'Tema y tamaño de letra' }).click();
    await expect(page.locator('[data-grupo-actualizaciones] [data-sin-token]')).toContainText('repositorio Metalaria/electronica-app es privado');
    await expect(page.locator('[data-grupo-sincronizacion]')).toContainText('falta el token');
    await page.goto('./#/sincronizacion');
    await expect(page.locator('[data-pagina] [data-sin-token]')).toContainText('sin token no se puede');
    await expect(page.locator('[data-sincronizar]')).toBeDisabled();
    await page.waitForTimeout(2500);
    expect(todas).toEqual([]);
    expect(gh.peticiones).toEqual([]);
  });

  test('la primera sincronización crea el fichero (UTF-8 correcto) y el token se ve solo por su final', async ({ browser }) => {
    const gh = new FakeGitHub();
    const nota = { ...marcador('cap05', 'sec-5.3', '5.3', 'La Ecuación de Shockley', 1000), texto: 'Ω, µ, ñ, «comillas» y 😀' };
    const { ctx, page } = await dispositivo(browser, gh, {
      marcadores: { 'sec-5.1': marcador('cap05', 'sec-5.1', '5.1', 'El Semiconductor', 1000) },
      notas: { 'sec-5.3': nota },
      leidas: { cap05: { 'sec-5.1': 1500 } },
    });
    await expect(page.locator('[data-token-final]')).toHaveText('…wxyz');
    await expect(page.locator('body')).not.toContainText(TOKEN);
    await sincronizarAhora(page);
    await expect(page.locator('[data-resumen]')).toContainText('Se creó el fichero');
    const doc = gh.doc()!;
    expect(doc.formato).toBe('epa-sincronizacion');
    expect(Object.keys(doc.almacenes.marcadores!)).toEqual(['sec-5.1']);
    expect((doc.almacenes.notas!['sec-5.3'] as { v: { texto: string } }).v.texto).toBe(nota.texto);
    expect(doc.almacenes.leidas!['cap05/sec-5.1']).toEqual({ t: 1500, v: 1500 });
    // The token never reaches the file, and the commit goes to the default repository and path.
    expect(JSON.stringify(doc)).not.toContain(TOKEN);
    const put = gh.peticiones.find((p) => p.metodo === 'PUT')!;
    expect(put.ruta).toBe(`/repos/${DATOS}/contents/${RUTA}`);
    // A second run with nothing new does not write.
    const puts = gh.peticiones.filter((p) => p.metodo === 'PUT').length;
    await sincronizarAhora(page);
    expect(gh.peticiones.filter((p) => p.metodo === 'PUT').length).toBe(puts);
    await expect(page.locator('[data-resumen]')).toContainText('No había cambios');
    await ctx.close();
  });

  test('dos dispositivos convergen, gana la última escritura y se propagan los borrados', async ({ browser }) => {
    const gh = new FakeGitHub();
    const a = await dispositivo(browser, gh, {
      marcadores: {
        'sec-5.1': marcador('cap05', 'sec-5.1', '5.1', 'El Semiconductor', 1000),
        'sec-5.2': marcador('cap05', 'sec-5.2', '5.2', 'La Unión P-N', 1100),
      },
      notas: { 'sec-5.3': { ...marcador('cap05', 'sec-5.3', '5.3', 'Shockley', 2000), texto: 'antigua (A)' } },
      posiciones: { cap05: { b: 40, sec: 'sec-5.2', f: 0.2, t: 5000 } },
      'repaso-tarjetas': { 'glos-diodo': { e: 'r', p: 0, f: 2.5, i: 3, v: 9e12, n: 4, l: 0, u: 3000 } },
    });
    const b = await dispositivo(browser, gh, {
      marcadores: { 'sec-7.1': marcador('cap07', 'sec-7.1', '7.1', 'Otro', 1200) },
      notas: { 'sec-5.3': { ...marcador('cap05', 'sec-5.3', '5.3', 'Shockley', 9000), texto: 'nueva (B) ñ' } },
      posiciones: { cap05: { b: 10, sec: 'sec-5.1', f: 0.05, t: 4000 } },
      'calc-favoritos': ['fc-rc'],
    });
    await sincronizarAhora(a.page);
    await sincronizarAhora(b.page);
    await sincronizarAhora(a.page);

    for (const d of [a, b]) {
      const marc = await leer<Record<string, unknown>>(d.page, 'marcadores');
      expect(Object.keys(marc).sort()).toEqual(['sec-5.1', 'sec-5.2', 'sec-7.1']);
      const notas = await leer<Record<string, { texto: string }>>(d.page, 'notas');
      expect(notas['sec-5.3']!.texto).toBe('nueva (B) ñ');
      const pos = await leer<Record<string, { b: number }>>(d.page, 'posiciones');
      expect(pos.cap05!.b).toBe(40);
      expect(await leer<string[]>(d.page, 'calc-favoritos')).toEqual(['fc-rc']);
      expect(Object.keys(await leer<Record<string, unknown>>(d.page, 'repaso-tarjetas'))).toEqual(['glos-diodo']);
    }
    await expect(b.page.locator('[data-resumen]')).toContainText('Recibidos de otros dispositivos');
    // The reactive state follows too: B's bookmarks page lists A's bookmarks without reloading.
    await b.page.goto('./#/marcadores');
    await expect(b.page.getByRole('button', { name: 'Quitar el marcador de 5.2' })).toBeVisible();

    // Deletion on B (through the UI) reaches A as a tombstone.
    await b.page.getByRole('button', { name: 'Quitar el marcador de 5.2' }).click();
    await b.page.goto('./#/sincronizacion');
    await sincronizarAhora(b.page);
    const lapida = gh.doc()!.almacenes.marcadores!['sec-5.2'] as { x?: number };
    expect(lapida.x).toBe(1);
    await sincronizarAhora(a.page);
    expect(Object.keys(await leer<Record<string, unknown>>(a.page, 'marcadores')).sort()).toEqual(['sec-5.1', 'sec-7.1']);
    await a.page.goto('./#/marcadores');
    await expect(a.page.getByRole('button', { name: 'Quitar el marcador de 5.1' })).toBeVisible();
    await expect(a.page.getByRole('button', { name: 'Quitar el marcador de 5.2' })).toHaveCount(0);
    await a.ctx.close();
    await b.ctx.close();
  });

  test('un 409 (otro dispositivo escribió antes) se resuelve leyendo de nuevo y fusionando', async ({ browser }) => {
    const gh = new FakeGitHub();
    const a = await dispositivo(browser, gh, { marcadores: { 'sec-5.1': marcador('cap05', 'sec-5.1', '5.1', 'Uno', 1000) } });
    await sincronizarAhora(a.page);
    // A changes something; meanwhile device C writes its own bookmark just before A's PUT.
    await a.page.goto('./#/marcadores');
    await a.page.getByRole('button', { name: 'Quitar el marcador de 5.1' }).click();
    gh.conflicto = (doc) => {
      doc.almacenes.marcadores!['sec-9.1'] = { t: Date.now(), v: marcador('cap09', 'sec-9.1', '9.1', 'De C', Date.now()) };
    };
    await a.page.goto('./#/sincronizacion');
    await sincronizarAhora(a.page);
    expect(gh.conflictos).toBe(1);
    await expect(a.page.locator('[data-error-sinc]')).toHaveCount(0);
    const m = gh.doc()!.almacenes.marcadores!;
    expect((m['sec-5.1'] as { x?: number }).x).toBe(1);
    expect('v' in m['sec-9.1']!).toBe(true);
    expect(Object.keys(await leer<Record<string, unknown>>(a.page, 'marcadores'))).toEqual(['sec-9.1']);
    await a.ctx.close();
  });

  test('un token rechazado da un error claro en español', async ({ browser }) => {
    const gh = new FakeGitHub();
    const a = await dispositivo(browser, gh, {}, { token: ['github', 'pat', 'CADUCADO000000000000000000'].join('_') });
    await sincronizarAhora(a.page);
    await expect(a.page.locator('[data-error-sinc]')).toContainText('GitHub rechaza el token (401)');
    expect(gh.doc()).toBeNull();
    // «Desconectar» forgets the token on this device.
    await a.page.getByRole('button', { name: 'Desconectar' }).click();
    expect(await a.page.evaluate(() => localStorage.getItem('epa-credencial:github'))).toBeNull();
    await expect(a.page.locator('#token')).toBeVisible();
    await a.ctx.close();
  });

  test('pegar el token en Ajustes conecta y sincroniza; al abrir con sincronización automática también', async ({ browser }) => {
    const gh = new FakeGitHub();
    const a = await dispositivo(browser, gh, { marcadores: { 'sec-5.1': marcador('cap05', 'sec-5.1', '5.1', 'Uno', 1000) } }, { token: '' });
    await a.page.locator('#token').fill('no vale');
    await a.page.getByRole('button', { name: 'Guardar y sincronizar' }).click();
    await expect(a.page.getByRole('alert')).toContainText('no parece un token');
    await a.page.locator('#token').fill(TOKEN);
    await a.page.getByRole('button', { name: 'Guardar y sincronizar' }).click();
    await expect(a.page.locator('[data-resumen]')).toContainText('Se creó el fichero');
    await a.ctx.close();

    // Another device opens the app with automatic sync on: it merges at start-up without any click.
    const b = await dispositivo(browser, gh, { marcadores: { 'sec-7.1': marcador('cap07', 'sec-7.1', '7.1', 'Dos', 1200) } }, { auto: true });
    await expect.poll(async () => Object.keys((await leer<Record<string, unknown>>(b.page, 'marcadores')) ?? {}).sort()).toEqual(['sec-5.1', 'sec-7.1']);
    await expect.poll(() => Object.keys(gh.doc()!.almacenes.marcadores!).sort()).toEqual(['sec-5.1', 'sec-7.1']);
    await b.ctx.close();
  });
});

test.describe('Aviso de versión nueva', () => {
  const siguiente = () => {
    const [x, y, z] = VERSION.split('.').map(Number);
    return `${x}.${y}.${z! + 1}`;
  };

  test('aparece con una publicación más nueva y se puede descartar', async ({ browser }) => {
    const gh = new FakeGitHub();
    gh.release = { tag_name: `v${siguiente()}`, body: '## Novedades\n- Sincronización entre dispositivos\n- Placas de las consolas en 3D' };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('https://api.github.com/**', (r) => gh.atender(r));
    // token present from the very first load (a fresh context has empty storage; re-set on reload is harmless)
    await ctx.addInitScript((t) => {
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa-credencial:github', t);
    }, TOKEN);
    const page = await ctx.newPage();
    await page.goto('./#/');
    const aviso = page.locator('[data-aviso-version]');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText(`Versión ${siguiente()} disponible`);
    await expect(aviso).toContainText('Novedades · Sincronización entre dispositivos');
    await expect(aviso).toContainText(`Tiene la ${VERSION}`);
    expect(gh.peticiones.filter((p) => p.ruta.endsWith('/releases/latest'))).toHaveLength(1);
    await aviso.getByRole('button', { name: 'Ahora no' }).click();
    await expect(aviso).toHaveCount(0);
    // Not again on the next start (dismissed, and checked less than 12 h ago: no new request either).
    await page.reload();
    await expect(page.locator('#contenido')).not.toContainText('Abriendo el libro');
    await page.waitForTimeout(2500);
    await expect(aviso).toHaveCount(0);
    expect(gh.peticiones.filter((p) => p.ruta.endsWith('/releases/latest'))).toHaveLength(1);
    // «Buscar actualizaciones» asks again and reports it.
    await page.getByRole('button', { name: 'Tema y tamaño de letra' }).click();
    await page.getByRole('button', { name: 'Buscar actualizaciones' }).click();
    await expect(page.locator('[data-grupo-actualizaciones]')).toContainText(`Versión ${siguiente()} disponible`);
    expect(gh.peticiones.filter((p) => p.ruta.endsWith('/releases/latest'))).toHaveLength(2);
    await ctx.close();
  });

  test('no aparece con la misma versión', async ({ browser }) => {
    const gh = new FakeGitHub();
    gh.release = { tag_name: `v${VERSION}`, body: 'La misma' };
    const ctx = await browser.newContext();
    await ctx.route('https://api.github.com/**', (r) => gh.atender(r));
    // token present from the very first load (a fresh context has empty storage; re-set on reload is harmless)
    await ctx.addInitScript((t) => {
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa-credencial:github', t);
    }, TOKEN);
    const page = await ctx.newPage();
    await page.goto('./#/');
    await expect.poll(() => gh.peticiones.filter((p) => p.ruta.endsWith('/releases/latest')).length).toBe(1);
    await page.waitForTimeout(800);
    await expect(page.locator('[data-aviso-version]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tema y tamaño de letra' }).click();
    await page.getByRole('button', { name: 'Buscar actualizaciones' }).click();
    await expect(page.locator('[data-grupo-actualizaciones]')).toContainText('Tiene la última versión');
    await ctx.close();
  });
});

test('la fusión converge en cualquier orden (tres dispositivos)', () => {
  // Deterministic pseudo-random documents with overlapping items, equal times and tombstones.
  let s = 7;
  const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const docs: DocSincronizacion[] = [0, 1, 2].map((k) => {
    const d = docVacio('mismo', 0);
    const c: Coleccion = {};
    for (let i = 0; i < 40; i++) {
      if (azar() < 0.5) continue;
      const t = Math.floor(azar() * 6);
      c[`i${i}`] = azar() < 0.25 ? { t, x: 1 } : { t, v: { k, i, n: Math.floor(azar() * 3) } };
    }
    d.almacenes.marcadores = c;
    return d;
  });
  const [x, y, z] = docs as [DocSincronizacion, DocSincronizacion, DocSincronizacion];
  const r1 = fusionarDocs(fusionarDocs(x, y), z);
  const r2 = fusionarDocs(z, fusionarDocs(y, x));
  const r3 = fusionarDocs(fusionarDocs(y, z), x);
  expect(canonico(r1.almacenes)).toBe(canonico(r2.almacenes));
  expect(canonico(r1.almacenes)).toBe(canonico(r3.almacenes));
  expect(canonico(fusionarDocs(r1, r1).almacenes)).toBe(canonico(r1.almacenes));
});
