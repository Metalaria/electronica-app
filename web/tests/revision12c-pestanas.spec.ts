// Independent review 12c: real Chromium tabs of one context (one localStorage, each tab with its own cached view).
//   12c·1  the loop guard's truce (guardado.ts `enTregua`) then the tab is closed: is the tab's own change, kept only in
//          its memory during the truce, written by the flush on `pagehide`? (fails: `volcar` sees nothing due)
//   12c·2  the same with two real app tabs: a burst of simultaneous steps, then one tab closed at once (fails ~1 in 4)
//   12c·3  after such a burst: writes 5–30 s later (the truce's end) and the day's mirror against the records' sum
//          (the mirror stays short: 0.10/0.11 devices see fewer steps)
//   12c·4  three tabs click different stars at the same instants, add then remove (passes)
//   12c·5  «Duplicar pestaña» while the original is busy for 1 s: the copy keeps the original's tab id, both write one
//          record, and simultaneous steps are lost (fails; passes with the original idle)
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision12c.config.ts tests/revision12c-pestanas.spec.ts
import { expect, test, type Page } from '@playwright/test';

interface Diario {
  registrarActividad(tipo: string, n: number): void;
  leerDias(): Promise<Record<string, { pasos: number }>>;
  itemsDias(): Record<string, { pasos: number; t: number }>;
  escribir(): Promise<void>;
  cargar(): Promise<void>;
}

async function abrir(page: Page, ruta = '/#/'): Promise<void> {
  await page.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await page.addInitScript(() => ((window as unknown as { __epaPruebasDiario: object }).__epaPruebasDiario = {}));
  await page.goto(ruta);
  await page.waitForFunction(() => typeof (window as unknown as { __epaPruebasDiario: Partial<Diario> }).__epaPruebasDiario.cargar === 'function');
  await page.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.cargar());
}

const paso = (p: Page) =>
  p.evaluate(async () => {
    const d = (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario;
    d.registrarActividad('paso', 1);
    await d.escribir();
  });

/** The pasos of this tab's own record as stored (the records that are not «otra-*»). */
const propioGuardado = (p: Page) =>
  p.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, { pasos: number }>;
    return Object.entries(v)
      .filter(([k]) => k.includes('@') && !k.endsWith('~'))
      .reduce((n, [, r]) => n + r.pasos, 0);
  });

/**
 * A stale tab writes its old copy of the key again and again (what a tab whose cached view lags does); each time the
 * app tab keeps its own record and writes it back, until the loop guard's truce stops it. Returns how many stale
 * writes were answered.
 */
async function hastaTregua(obs: Page, viejo: string): Promise<number> {
  return obs.evaluate(async (viejo) => {
    let respondidas = 0;
    for (let i = 0; i < 20; i++) {
      localStorage.setItem('epa:progreso-diario', viejo);
      const t0 = performance.now();
      while (localStorage.getItem('epa:progreso-diario') === viejo && performance.now() - t0 < 1500) await new Promise((r) => setTimeout(r, 10));
      if (localStorage.getItem('epa:progreso-diario') === viejo) return respondidas;
      respondidas++;
    }
    return respondidas;
  }, viejo);
}

test('12c·2 dos pestañas reales escriben a la vez y una se cierra enseguida: ningún paso se pierde', async ({ context }) => {
  test.setTimeout(240_000);
  const p1 = await context.newPage();
  await abrir(p1);
  await p1.evaluate(() => {
    localStorage.removeItem('epa:progreso-diario');
    localStorage.removeItem('epa:sinc-marcas');
  });
  const p2 = await context.newPage();
  await abrir(p2);
  await abrir(p1);
  const avisos: string[] = [];
  for (const p of [p1, p2])
    p.on('console', (m) => {
      if (m.type() === 'warning' && m.text().includes('[guardado]')) avisos.push(m.text());
    });
  const N = 20;
  for (let i = 0; i < N; i++) {
    const T = (await p1.evaluate(() => performance.timeOrigin + performance.now())) + 120;
    const uno = (p: Page) =>
      p.evaluate(async (T) => {
        const d = (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario;
        while (performance.timeOrigin + performance.now() < T);
        d.registrarActividad('paso', 1);
        await d.escribir();
      }, T);
    await Promise.all([uno(p1), uno(p2)]);
    await p1.waitForTimeout(40);
  }
  // the reader closes the second tab at once
  await p2.close({ runBeforeUnload: true });
  await p1.waitForTimeout(12_000);
  const obs = await context.newPage();
  await obs.goto('/icono.png');
  const guardado = await propioGuardado(obs);
  const enP1 = Object.values(await p1.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.leerDias())).reduce((n, d) => n + d.pasos, 0);
  console.log('treguas', avisos.length, 'pasos guardados', guardado, 'pasos en la pestaña que sigue abierta', enP1);
  expect(guardado, 'pasos guardados de las dos pestañas').toBe(2 * N);
});

test('12c·3 tras una ráfaga simultánea de dos pestañas: nadie sigue escribiendo pasados 10 s (fin de la tregua) y el espejo cuadra', async ({ context }) => {
  test.setTimeout(240_000);
  const p1 = await context.newPage();
  await abrir(p1);
  await p1.evaluate(() => {
    localStorage.removeItem('epa:progreso-diario');
    localStorage.removeItem('epa:sinc-marcas');
  });
  const p2 = await context.newPage();
  await abrir(p2);
  await abrir(p1);
  const avisos: string[] = [];
  for (const p of [p1, p2])
    p.on('console', (m) => {
      if (m.type() === 'warning' && m.text().includes('[guardado]')) avisos.push(`${Date.now()} ${m.text()}`);
    });
  const obs = await context.newPage();
  await obs.goto('/icono.png');
  await obs.evaluate(() => {
    const w = window as unknown as { __ev: number[] };
    w.__ev = [];
    window.addEventListener('storage', (e) => {
      if (e.key === 'epa:progreso-diario') w.__ev.push(Date.now());
    });
  });
  const N = 20;
  for (let i = 0; i < N; i++) {
    const T = (await p1.evaluate(() => performance.timeOrigin + performance.now())) + 120;
    const uno = (p: Page) =>
      p.evaluate(async (T) => {
        const d = (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario;
        while (performance.timeOrigin + performance.now() < T);
        d.registrarActividad('paso', 1);
        await d.escribir();
      }, T);
    await Promise.all([uno(p1), uno(p2)]);
    await p1.waitForTimeout(40);
  }
  const fin = Date.now();
  await obs.waitForTimeout(30_000);
  const ev = await obs.evaluate(() => (window as unknown as { __ev: number[] }).__ev);
  const tramo = (a: number, b: number) => ev.filter((t) => t >= fin + a && t < fin + b).length;
  const cuadra = await obs.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, { pasos: number }>;
    const dias: Record<string, { espejo: number; suma: number }> = {};
    for (const [k, r] of Object.entries(v)) {
      const d = k.split('@')[0]!;
      const x = (dias[d] ??= { espejo: 0, suma: 0 });
      if (!k.includes('@')) x.espejo = r.pasos;
      else x.suma += k.endsWith('~') ? -r.pasos : r.pasos;
    }
    return dias;
  });
  const total = async (p: Page) =>
    Object.values(await p.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.leerDias())).reduce((n, d) => n + d.pasos, 0);
  console.log('escrituras 0-5 s', tramo(0, 5000), '5-15 s', tramo(5000, 15_000), '15-30 s', tramo(15_000, 30_000), 'treguas', avisos.length, JSON.stringify(avisos.map((a) => a.slice(0, 90))));
  console.log('espejo/suma', JSON.stringify(cuadra), 'totales', await total(p1), await total(p2));
  expect(tramo(5000, 30_000), 'escrituras de progreso-diario de 5 a 30 s después, sin que nadie haga nada').toBe(0);
  for (const x of Object.values(cuadra)) expect(x.espejo, 'el espejo del día (0.10/0.11) es la suma de los registros').toBe(x.suma);
});

test('12c·4 tres pestañas pulsan a la vez estrellas distintas (añadir y luego quitar): ni se pierden, ni vuelven, ni siguen escribiendo', async ({ context }) => {
  test.setTimeout(300_000);
  const p1 = await context.newPage();
  await abrir(p1, '/#/calculadoras');
  await p1.evaluate(() => {
    localStorage.removeItem('epa:calc-favoritos');
    localStorage.removeItem('epa:sinc-marcas');
  });
  await p1.reload();
  const p2 = await context.newPage();
  await abrir(p2, '/#/calculadoras');
  const p3 = await context.newPage();
  await abrir(p3, '/#/calculadoras');
  const pags = [p1, p2, p3];
  for (const p of pags) await p.getByRole('button', { name: /^Añadir .* a favoritas$/ }).first().waitFor();
  const avisos: string[] = [];
  for (const p of pags)
    p.on('console', (m) => {
      if (m.type() === 'warning' && m.text().includes('[guardado]')) avisos.push(m.text());
    });
  const obs = await context.newPage();
  await obs.goto('/icono.png');
  await obs.evaluate(() => {
    const w = window as unknown as { __ev: number[] };
    w.__ev = [];
    window.addEventListener('storage', (e) => {
      if (e.key === 'epa:calc-favoritos') w.__ev.push(Date.now());
    });
  });
  const nombres = await p1.evaluate(() =>
    [...document.querySelectorAll('button[aria-label^="Añadir "][aria-label$=" a favoritas"]')].map((b) => b.getAttribute('aria-label')!.replace(/^Añadir (.*) a favoritas$/, '$1')),
  );
  const R = 5;
  expect(nombres.length).toBeGreaterThanOrEqual(3 * R);
  /** At the same instant, tab i clicks the star of calculator `nombre[i]` (Añadir or Quitar). */
  const ronda = async (accion: 'Añadir' | 'Quitar', r: number) => {
    const T = (await p1.evaluate(() => performance.timeOrigin + performance.now())) + 150;
    await Promise.all(
      pags.map((p, i) =>
        p.evaluate(
          ([T, etiqueta]) => {
            const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === etiqueta) as HTMLButtonElement | undefined;
            while (performance.timeOrigin + performance.now() < (T as number));
            b?.click();
            return !!b;
          },
          [T, `${accion} ${nombres[r * 3 + i]} ${accion === 'Añadir' ? 'a' : 'de'} favoritas`] as const,
        ),
      ),
    );
    await p1.waitForTimeout(60);
  };
  for (let r = 0; r < R; r++) await ronda('Añadir', r);
  await p1.waitForTimeout(3000);
  const ids = (p: Page) => p.evaluate(() => (JSON.parse(localStorage.getItem('epa:calc-favoritos') ?? '[]') as string[]).length);
  const estrellas = (p: Page) => p.getByRole('button', { name: /^Quitar .* de favoritas$/ }).count();
  console.log('tras añadir: guardadas', await ids(obs), 'en cada pestaña', await estrellas(p1), await estrellas(p2), await estrellas(p3));
  expect(await ids(obs), 'favoritas guardadas tras añadir 15 a la vez').toBe(3 * R);
  for (let r = 0; r < R; r++) await ronda('Quitar', r);
  const fin = Date.now();
  await obs.waitForTimeout(20_000);
  const ev = await obs.evaluate(() => (window as unknown as { __ev: number[] }).__ev);
  console.log('tras quitar: guardadas', await ids(obs), 'en cada pestaña', await estrellas(p1), await estrellas(p2), await estrellas(p3), 'escrituras 2-20 s', ev.filter((t) => t > fin + 2000).length, 'treguas', avisos.length);
  expect(await ids(obs), 'favoritas guardadas tras quitarlas todas').toBe(0);
  for (const p of pags) expect(await estrellas(p), 'favoritas marcadas en una pestaña').toBe(0);
  expect(ev.filter((t) => t > fin + 2000).length, 'escrituras de 2 a 20 s después').toBeLessThanOrEqual(3);
});

for (const ocupada of [false, true])
  test(`12c·5 «Duplicar pestaña» (sessionStorage copiado) con la original ${ocupada ? 'ocupada 1 s' : 'libre'}: cada pestaña tiene su registro`, async ({ context }) => {
    test.setTimeout(120_000);
    const p1 = await context.newPage();
    await abrir(p1);
    await p1.evaluate(() => {
      localStorage.removeItem('epa:progreso-diario');
      localStorage.removeItem('epa:sinc-marcas');
    });
    await abrir(p1);
    // (a step first: the device id is stored, so both tabs use it)
    await paso(p1);
    await p1.waitForTimeout(300);
    const idTab = await p1.evaluate(() => sessionStorage.getItem('epa:pestana'));
    expect(idTab).toBeTruthy();
    const p2 = await context.newPage();
    // what «Duplicar pestaña» does: the new tab starts with a copy of the original's sessionStorage
    await p2.addInitScript((id) => {
      if (!sessionStorage.getItem('epa:pestana')) sessionStorage.setItem('epa:pestana', id!);
    }, idTab);
    // the original busy (a long task: a 3D board, a simulation) while the copy loads
    const ocupado = ocupada
      ? p1.evaluate(() => {
          const t0 = performance.now();
          while (performance.now() - t0 < 1000);
        })
      : Promise.resolve();
    await abrir(p2);
    await ocupado;
    await paso(p1);
    await paso(p2);
    // then both tabs take steps at the same instants (two lessons open side by side)
    const N = 10;
    for (let i = 0; i < N; i++) {
      const T = (await p1.evaluate(() => performance.timeOrigin + performance.now())) + 120;
      const uno = (p: Page) =>
        p.evaluate(async (T) => {
          const d = (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario;
          while (performance.timeOrigin + performance.now() < T);
          d.registrarActividad('paso', 1);
          await d.escribir();
        }, T);
      await Promise.all([uno(p1), uno(p2)]);
      await p1.waitForTimeout(40);
    }
    await p1.waitForTimeout(12_000);
    const ids = await p1.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}')).filter((k) => k.includes('@')));
    const total = Object.values(await p1.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.leerDias())).reduce((n, d) => n + d.pasos, 0);
    console.log('dispositivo-local', await p1.evaluate(() => localStorage.getItem('epa:dispositivo-local')), 'original ocupada', ocupada, 'registros', JSON.stringify(ids), 'total', total, 'ids de pestaña', idTab, await p2.evaluate(() => sessionStorage.getItem('epa:pestana')));
    expect(ids.length, 'un registro por pestaña').toBe(2);
    expect(total, 'pasos de las dos pestañas').toBe(3 + 2 * N);
  });

for (const cierre of ['pagehide', 'sin cerrar'] as const)
  test(`12c·1 tregua del bucle y luego ${cierre}: el cambio propio que solo estaba en memoria llega al almacén`, async ({ context }) => {
    test.setTimeout(120_000);
    const p1 = await context.newPage();
    await abrir(p1);
    await p1.evaluate(() => {
      localStorage.removeItem('epa:progreso-diario');
      localStorage.removeItem('epa:sinc-marcas');
    });
    await abrir(p1);
    const avisos: string[] = [];
    p1.on('console', (m) => {
      if (m.type() === 'warning' && m.text().includes('[guardado]')) avisos.push(m.text());
    });
    await paso(p1);
    const s1 = await p1.evaluate(() => localStorage.getItem('epa:progreso-diario')!);
    await paso(p1);
    expect(await propioGuardado(p1)).toBe(2);
    const obs = await context.newPage();
    await obs.goto('/icono.png');
    const respondidas = await hastaTregua(obs, s1);
    console.log('escrituras desfasadas respondidas antes de la tregua', respondidas, avisos);
    expect(avisos.length, 'la tregua empezó').toBeGreaterThan(0);
    // during the truce the storage holds the stale copy; the reader's 2nd step lives only in the tab's memory
    expect(await propioGuardado(obs)).toBe(1);
    if (cierre === 'pagehide') {
      // the reader closes the tab (or leaves the page) right then
      await p1.close({ runBeforeUnload: true });
      await obs.waitForTimeout(1500);
    } else await obs.waitForTimeout(12_000);
    const final = await propioGuardado(obs);
    console.log(cierre, 'pasos guardados del registro de la pestaña', final);
    expect(final, 'los 2 pasos de la pestaña (el 2.º solo quedaba en su memoria durante la tregua)').toBe(2);
  });
