// 1.0 stability in the browser, with failures injected into the real build: a component that throws (a whole page, a
// live figure) shows its Spanish fallback with «Reintentar» and an entry in the «Informe de fallos»; a lost WebGL
// context on a 3D board; ngspice's WebAssembly that does not arrive and a worker that fails to start (the next run
// must work: before 1.0 the failed start was kept and every later simulation failed until a reload); a lazy chunk that
// does not arrive (stale copy after an update: «Recargar la página»); a page that died while in use found at the next
// start, with the notice, «Ver el informe», «Copiar el informe» and «Borrar»; no token in the report.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.rendimiento10.config.ts tests/rendimiento10-navegador.spec.ts
import { expect, test, type Page } from '@playwright/test';

interface Entrada {
  t: number;
  k: string;
  m: string;
  z?: string;
  r: string;
  b: string[];
  n: number;
  v: string;
  p: string;
}

/** Empty storage once per page session; `fallo`: the zone that throws at its first render; `aviso`: show the notice. */
async function limpio(page: Page, op: { fallo?: string; aviso?: boolean; limpiar?: boolean } = {}): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(
    ({ fallo, aviso, limpiar }) => {
      const w = window as unknown as { __epaFalloPrueba?: string; __epaInformeAviso?: boolean };
      if (aviso) w.__epaInformeAviso = true;
      if (!sessionStorage.getItem('preparado')) {
        sessionStorage.setItem('preparado', '1');
        if (fallo) w.__epaFalloPrueba = fallo;
        if (limpiar) {
          localStorage.clear();
          localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
          localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'claro', tam: 18, sonido: false, vibracion: false }));
        }
      }
    },
    { fallo: op.fallo ?? '', aviso: !!op.aviso, limpiar: op.limpiar !== false },
  );
}

const informe = (page: Page) =>
  page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('epa-informe-fallos') ?? '[]') as Entrada[] | { e: Entrada[] };
    return Array.isArray(v) ? v : v.e;
  }) as Promise<Entrada[]>;

async function esperarEntrada(page: Page, k: string): Promise<Entrada> {
  await expect.poll(async () => (await informe(page)).filter((e) => e.k === k).length, { timeout: 30_000 }).toBeGreaterThan(0);
  return (await informe(page)).find((e) => e.k === k)!;
}

test('una página que falla al dibujarse: aviso con «Reintentar», entrada en el informe con sus migas, y se recupera', async ({ page }) => {
  await limpio(page, { fallo: 'esta página' });
  await page.goto('#/marcadores');
  const caja = page.locator('[data-fallo-zona="esta página"]');
  await expect(caja).toBeVisible();
  await expect(caja).toContainText('No se ha podido mostrar esta página');
  // the app around it still works (the top bar is there)
  await expect(page.locator('header').first()).toBeVisible();
  const e = await esperarEntrada(page, 'componente');
  expect(e.z).toBe('esta página');
  expect(e.m).toContain('fallo de prueba en esta página');
  expect(e.r).toBe('#/marcadores');
  expect(e.b.some((x) => /inicio .* en #\/marcadores/.test(x))).toBe(true);
  expect(e.v).toMatch(/^\d+\.\d+\.\d+/);
  await caja.getByRole('button', { name: 'Reintentar' }).click();
  await expect(caja).toHaveCount(0);
  await expect(page.locator('#contenido h1').first()).toBeVisible();
});

test('una figura viva que falla: solo ella muestra el aviso; el capítulo sigue y «Reintentar» la trae', async ({ page }) => {
  await limpio(page, { fallo: 'la figura 1.4' });
  await page.goto('#/cap01');
  const caja = page.locator('[data-fallo-zona="la figura 1.4"]');
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('figure.figura').nth(1)).toBeAttached();
  expect((await esperarEntrada(page, 'componente')).z).toBe('la figura 1.4');
  await caja.getByRole('button', { name: 'Reintentar' }).click();
  await expect(caja).toHaveCount(0);
});

test('contexto WebGL perdido en una placa 3D: «Reintentar» la vuelve a montar en un lienzo nuevo', async ({ page }) => {
  test.setTimeout(300_000);
  await limpio(page);
  await page.goto('#/proyectos/estacion_iot/3d');
  const lienzo = page.locator('section.vista canvas').first();
  await expect(lienzo).toBeAttached({ timeout: 120_000 });
  await page.waitForFunction(() => !!(window as unknown as { __epaPlaca3D?: unknown }).__epaPlaca3D, null, { timeout: 120_000, polling: 250 });
  await page.waitForTimeout(500);
  await lienzo.evaluate((c: HTMLCanvasElement) => {
    const gl = c.getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  const caja = page.locator('[data-fallo-zona="la vista 3D de la placa"]');
  await expect(caja).toBeVisible({ timeout: 30_000 });
  await expect(caja).toContainText('Se perdió el contexto WebGL');
  expect((await esperarEntrada(page, 'webgl')).z).toBe('la vista 3D de la placa');
  await caja.getByRole('button', { name: 'Reintentar' }).click();
  await expect(caja).toHaveCount(0);
  const nuevo = page.locator('section.vista canvas').first();
  await expect(nuevo).toBeAttached({ timeout: 120_000 });
  expect(await nuevo.evaluate((c: HTMLCanvasElement) => !!c.getContext('webgl2') && !c.getContext('webgl2')!.isContextLost())).toBe(true);
});

test('el motor de simulación no llega (WebAssembly 404): error en castellano, al informe, y la siguiente simulación funciona', async ({ page }) => {
  test.setTimeout(240_000);
  await limpio(page);
  await page.route('**/ngspice/*.wasm', (r) => r.fulfill({ status: 404, body: 'no' }));
  await page.goto('#/simulador/cap30/rc_digital_1ms');
  await expect(page.locator('.aviso.error').first()).toContainText('No se pudo cargar el motor de simulación', { timeout: 60_000 });
  const e = await esperarEntrada(page, 'simulador');
  expect(e.m).toContain('No se pudo cargar el motor');
  await page.unroute('**/ngspice/*.wasm');
  await page.getByRole('button', { name: /^Simular/ }).first().click();
  await expect(page.locator('.estado')).toContainText('Simulado en', { timeout: 120_000 });
});

test('un trabajador de ngspice que no arranca no deja el simulador roto: la siguiente simulación arranca otro', async ({ page }) => {
  test.setTimeout(240_000);
  await limpio(page);
  let roto = true;
  await page.route('**/assets/worker-*.js', (r) =>
    roto
      ? r.fulfill({ status: 200, contentType: 'text/javascript', body: "self.onmessage = () => self.postMessage({ t: 'error', id: 0, mensaje: 'arranque roto de prueba' });" })
      : r.continue(),
  );
  await page.goto('#/simulador/cap30/rc_digital_1ms');
  await expect(page.locator('.aviso.error').first()).toContainText('arranque roto de prueba', { timeout: 90_000 });
  roto = false;
  await page.getByRole('button', { name: /^Simular/ }).first().click();
  await expect(page.locator('.estado')).toContainText('Simulado en', { timeout: 120_000 });
  expect((await informe(page)).some((x) => x.k === 'simulador' && x.m.includes('arranque roto de prueba'))).toBe(true);
});

test('una parte de la aplicación que no llega (copia vieja tras actualizar): «Recargar la página» y al informe', async ({ page }) => {
  await limpio(page);
  await page.goto('#/');
  await expect(page.locator('#contenido .cargando')).toHaveCount(0);
  await page.route('**/assets/PaginaCursos-*.js', (r) => r.abort());
  await page.evaluate(() => (location.hash = '#/cursos'));
  const aviso = page.locator('[data-parte-desactualizada]');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('puede que se haya actualizado');
  expect((await esperarEntrada(page, 'carga')).r).toBe('#/cursos');
  // review 10c, r10c·5: Vite's event, the rejected import and the page's notice are one failure, one entry
  await page.waitForTimeout(1500);
  expect((await informe(page)).filter((e) => e.k === 'carga')).toHaveLength(1);
  await page.unroute('**/assets/PaginaCursos-*.js');
  await page.getByRole('button', { name: 'Recargar la página' }).click();
  await expect(page.locator('[data-camino], .cursos, #contenido h1').first()).toBeVisible({ timeout: 60_000 });
  await expect(aviso).toHaveCount(0);
});

test('cierre de golpe: la siguiente apertura lo informa con sus migas; aviso, «Ver el informe», copiar y borrar; recargar no es un cierre', async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ locale: 'es-ES', permissions: ['clipboard-read', 'clipboard-write'] });
  const a = await ctx.newPage();
  await limpio(a);
  await a.goto('#/cap05');
  await expect(a.locator('#contenido .cargando')).toHaveCount(0);
  await a.evaluate(() => (location.hash = '#/glosario'));
  await expect.poll(() => a.evaluate(() => localStorage.getItem('epa-informe-sesion') ?? ''), { timeout: 10_000 }).toContain('glosario');
  // The renderer dies (as the Android WebView does when its GPU work dies): no pagehide, nothing to catch, the session
  // record stays as it was. (CDP Page.crash takes the whole headless browser down here, so the page is closed and
  // what it left in the storage is put back, exactly as a dead page leaves it.)
  const sesion = await a.evaluate(() => localStorage.getItem('epa-informe-sesion'));
  expect(JSON.parse(sesion!)).toMatchObject({});
  expect(Object.values(JSON.parse(sesion!) as Record<string, { e: string }>)[0]!.e).toBe('activa');
  await a.close();
  const b = await ctx.newPage();
  await b.addInitScript((s) => {
    if (!sessionStorage.getItem('repuesta')) {
      sessionStorage.setItem('repuesta', '1');
      localStorage.setItem('epa-informe-sesion', s);
    }
  }, sesion!);
  await b.addInitScript(() => ((window as unknown as { __epaInformeSinLatido: number }).__epaInformeSinLatido = 4000));
  await limpio(b, { aviso: true, limpiar: false });
  await b.goto('#/');
  const e = await esperarEntrada(b, 'cierre');
  expect(e.r).toBe('#/glosario');
  expect(e.b.some((x) => x.includes('ruta #/glosario'))).toBe(true);
  const aviso = b.locator('[data-aviso-fallo="cierre"]');
  await expect(aviso).toBeVisible();
  await aviso.getByRole('button', { name: 'Ver el informe' }).click();
  await expect(b).toHaveURL(/#\/diagnostico\/informe$/);
  const tarjeta = b.locator('[data-informe-fallos]');
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.locator('[data-fallo="cierre"]')).toContainText('se cerró de golpe');
  await tarjeta.getByRole('button', { name: 'Copiar el informe' }).click();
  const copiado = await b.evaluate(() => navigator.clipboard.readText());
  expect(copiado).toMatch(/^Informe de fallos · Electrónica Práctica Avanzada \d/);
  expect(copiado).toContain('Cierre inesperado');
  expect(copiado).toContain('ruta #/glosario');
  // a normal reload ends the page properly: not a crash
  await b.reload();
  await expect(b.locator('[data-informe-fallos]')).toBeVisible();
  await b.waitForTimeout(2500);
  expect((await informe(b)).filter((x) => x.k === 'cierre')).toHaveLength(1);
  await b.locator('[data-informe-fallos]').getByRole('button', { name: 'Borrar' }).click();
  await b.locator('.confirmacion-host').getByRole('button', { name: 'Borrar' }).click();
  await expect(b.locator('[data-informe-fallos]')).toContainText('No hay fallos registrados.');
  expect(await informe(b)).toEqual([]);
  await ctx.close();
});

test('un error no capturado con un token en el mensaje: al informe sin el token; el aviso solo si la página lo permite', async ({ page, browser }) => {
  await limpio(page, { aviso: true });
  await page.goto('#/glosario');
  await expect(page.locator('#contenido .cargando')).toHaveCount(0);
  const token = ['ghp', 'Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2'].join('_');
  await page.evaluate((t) => setTimeout(() => {
    throw new Error(`fallo con ${t} y «un texto largo que el lector escribió en su nota»`);
  }), token);
  const e = await esperarEntrada(page, 'error');
  expect(e.m).toContain('[token]');
  expect(e.m).toContain('«[texto]»');
  expect(JSON.stringify(await informe(page))).not.toContain(token.slice(4, 20));
  await expect(page.locator('[data-aviso-fallo="error"]')).toBeVisible();
  // under automation without the page's permission, no notice (the QA screenshots stay as they were)
  const otra = await browser.newPage();
  await limpio(otra);
  await otra.goto('#/glosario');
  await expect(otra.locator('#contenido .cargando')).toHaveCount(0);
  await otra.evaluate(() => setTimeout(() => {
    throw new Error('otro fallo');
  }));
  await expect.poll(async () => (await informe(otra)).length).toBeGreaterThan(0);
  await expect(otra.locator('[data-aviso-fallo]')).toHaveCount(0);
  await otra.close();
});

test('r10c·2 una pestaña visible ocupada varios segundos (PDF, sincronización con CPU lenta) no es un «cierre inesperado»', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ locale: 'es-ES' });
  const corto = () => ((window as unknown as { __epaInformeSinLatido: number }).__epaInformeSinLatido = 6000);
  const a = await ctx.newPage();
  await a.addInitScript(corto);
  await limpio(a);
  await a.goto('#/glosario');
  await expect(a.locator('#contenido .cargando')).toHaveCount(0);
  await expect.poll(() => a.evaluate(() => localStorage.getItem('epa-informe-sesion') ?? ''), { timeout: 10_000 }).toContain('activa');
  // the first tab is busy for 4 s (one long task) right while a second one starts
  void a.evaluate(() => {
    const fin = performance.now() + 4000;
    while (performance.now() < fin);
  });
  const b = await ctx.newPage();
  await b.addInitScript(corto);
  await limpio(b, { limpiar: false });
  await b.goto('#/');
  await expect(b.locator('#contenido .cargando')).toHaveCount(0);
  // the check (6 s without a heartbeat, then 3 s for an answer) is over well within this
  await b.waitForTimeout(14_000);
  expect((await informe(b)).filter((e) => e.k === 'cierre')).toEqual([]);
  await ctx.close();
});

test('r10f·6 dos pestañas: «Borrar» en una se mantiene aunque la otra anote después; lo de cada una se conserva', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'es-ES' });
  const a = await ctx.newPage();
  await limpio(a);
  await a.goto('#/glosario');
  await expect(a.locator('#contenido .cargando')).toHaveCount(0);
  const fallar = (p: Page, m: string) => p.evaluate((x) => setTimeout(() => { throw new Error(x); }), m);
  await fallar(a, 'primero en la pestaña A');
  const b = await ctx.newPage();
  await limpio(b, { limpiar: false });
  await b.goto('#/diagnostico/informe');
  await fallar(b, 'en la pestaña B');
  await fallar(a, 'segundo en la pestaña A');
  await expect.poll(async () => (await informe(a)).map((e) => e.m).sort()).toEqual(['en la pestaña B', 'primero en la pestaña A', 'segundo en la pestaña A']);
  // «Borrar» in B, then A reports again: the old ones do not come back
  await b.reload();
  const tarjeta = b.locator('[data-informe-fallos]');
  await tarjeta.getByRole('button', { name: 'Borrar' }).click();
  await b.locator('.confirmacion-host').getByRole('button', { name: 'Borrar' }).click();
  await expect(tarjeta).toContainText('No hay fallos registrados.');
  await fallar(a, 'tercero en la pestaña A');
  await expect.poll(async () => (await informe(b)).map((e) => e.m)).toEqual(['tercero en la pestaña A']);
  await ctx.close();
});
