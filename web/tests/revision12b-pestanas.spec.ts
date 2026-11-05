// Independent review 12b: two (three) REAL Chromium tabs of one context (one localStorage, each tab with its own cached
// view of it). Checks of the tab protection of 0.12 (guardado.ts `propios`, `atestiguado`) where the single-threaded
// fake storage of the Node harness cannot show anything:
//   12b·1  after two tabs write the daily activity at the same instant, do they stop writing (no ping-pong), and does
//          every tab's last change keep its mark in `sinc-marcas`?
//   12b·2  a deletion made in one tab whose mark is written over by a stale tab's `sinc-marcas` (the known residual
//          risk): what does the other open tab do with it?
//   12b·3  no race at all: tab B adds and removes a favourite, tab A adds it again (A's mark is for a value B once
//          wrote itself: `atestiguado`'s `mio` rule ignores it).
//   12b·4  three tabs: a stale copy of this tab's record, then an up-to-date one (the base moved to the stale copy, so
//          the three-way sum of `unirAportesPestanas` counts this tab's own step twice).
// Each of 12b·1–4 fails on the 0.12 working tree of 7ca94e4 as reviewed; with the three changes described in the
// review 12b report (a scratch copy) all pass.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision12b.config.ts tests/revision12b-pestanas.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { RETRASO_TREGUA } from '../src/lib/sincronizacion/tregua';

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

/** A plain same-origin page that counts the storage events of the keys (writes by the other tabs). */
async function observador(page: Page): Promise<void> {
  await page.goto('/icono.png');
  await page.evaluate(() => {
    const w = window as unknown as { __eventos: Record<string, number> };
    w.__eventos = {};
    window.addEventListener('storage', (e) => {
      if (e.key) w.__eventos[e.key] = (w.__eventos[e.key] ?? 0) + 1;
    });
  });
}
const eventos = (p: Page) => p.evaluate(() => ({ ...(window as unknown as { __eventos: Record<string, number> }).__eventos }));
const ponerACero = (p: Page) => p.evaluate(() => ((window as unknown as { __eventos: Record<string, number> }).__eventos = {}));

test('12b·1 escrituras simultáneas: después, ninguna pestaña sigue escribiendo y cada cambio conserva su marca', async ({ context }) => {
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
  const obs = await context.newPage();
  await observador(obs);
  const N = 20;
  for (let i = 0; i < N; i++) {
    const T = (await p1.evaluate(() => performance.timeOrigin + performance.now())) + 120;
    const paso = (p: Page) =>
      p.evaluate(async (T) => {
        const d = (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario;
        while (performance.timeOrigin + performance.now() < T);
        d.registrarActividad('paso', 1);
        await d.escribir();
      }, T);
    await Promise.all([paso(p1), paso(p2)]);
    await p1.waitForTimeout(40);
  }
  // (round 5 of fixes, the only change to this test: the quiet window opens after the loop guard's repair write — at
  // most one per tab, RETRASO_TREGUA after its last retention — plus a margin, instead of 2,5 s)
  await p1.waitForTimeout(Math.max(2500, RETRASO_TREGUA + 1500));
  // quiet: nobody changes anything any more; any write now is a tab answering the other tab's write
  await ponerACero(obs);
  await p1.waitForTimeout(4000);
  const tras = await eventos(obs);
  // every record's newest change must have a change mark at least as new as the record (its step's time ≥ record t)
  const sinMarca = await p1.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, { t: number }>;
    const m = JSON.parse(localStorage.getItem('epa:sinc-marcas') ?? '{}') as { cambios?: Record<string, Record<string, number>> };
    const c = m.cambios?.['progreso-diario'] ?? {};
    return Object.entries(v)
      .filter(([k]) => k.includes('@'))
      .filter(([k, r]) => !(c[k]! >= r.t))
      .map(([k, r]) => `${k}: registro t=${r.t}, marca ${c[k] ?? 'ninguna'}`);
  });
  console.log('eventos en reposo', JSON.stringify(tras), 'registros sin marca de su último cambio', JSON.stringify(sinMarca));
  expect(tras['epa:progreso-diario'] ?? 0, 'escrituras de progreso-diario en reposo (ping-pong)').toBe(0);
  expect(sinMarca, 'cambios cuya marca se perdió (sinc-marcas pisado por la otra pestaña)').toEqual([]);
});

test('12b·4 tres pestañas: una copia desfasada y luego una al día del registro propio — el registro no cuenta de más', async ({ context }) => {
  test.setTimeout(240_000);
  const p1 = await context.newPage();
  await abrir(p1);
  await p1.evaluate(() => {
    localStorage.removeItem('epa:progreso-diario');
    localStorage.removeItem('epa:sinc-marcas');
  });
  await abrir(p1);
  const d = (p: Page, f: string) => p.evaluate((f) => (window as unknown as { __epaPruebasDiario: Record<string, () => Promise<void>> }).__epaPruebasDiario[f]!(), f);
  const paso = (p: Page) => p.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.registrarActividad('paso', 1));
  const texto = () => p1.evaluate(() => localStorage.getItem('epa:progreso-diario')!);
  await paso(p1);
  await d(p1, 'escribir');
  const s1 = await texto();
  await paso(p1);
  await d(p1, 'escribir');
  const s2 = await texto();
  // tab Y (up to date) adds its own record to what it holds: s2 + «<day>@otra-y»
  const v2 = JSON.parse(s2) as Record<string, { t: number }>;
  const dia = Object.keys(v2).find((k) => !k.includes('@'))!;
  const s2y = JSON.stringify({ ...v2, [`${dia}@otra-y`]: { pasos: 1, preguntas: 0, secciones: 0, cumplido: false, t: Date.now() } });
  // the reader takes a step in this tab right as tab X's stale copy (s1) arrives
  await p1.evaluate((s1) => {
    window.addEventListener('storage', (e) => {
      if (e.key === 'epa:progreso-diario' && e.newValue === s1)
        (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.registrarActividad('paso', 1);
    });
  }, s1);
  const obs = await context.newPage();
  await observador(obs);
  // tab X (stale: this tab's record as 1) writes, then tab Y (its write in flight at the same time) lands after it
  await obs.evaluate(
    ([s1, s2y]) =>
      new Promise<void>((ok) => {
        localStorage.setItem('epa:progreso-diario', s1!);
        setTimeout(() => {
          localStorage.setItem('epa:progreso-diario', s2y!);
          ok();
        }, 0);
      }),
    [s1, s2y],
  );
  await p1.waitForTimeout(2000);
  const items = await p1.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.itemsDias());
  const propio = Object.entries(items).find(([k]) => k.includes('@') && !k.endsWith('@otra-y'))!;
  const total = Object.values(await p1.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.leerDias())).reduce((n, x) => n + x.pasos, 0);
  console.log('registro propio', JSON.stringify(propio), 'total del día', total);
  expect(propio[1].pasos, 'pasos de esta pestaña (dio 3)').toBe(3);
  expect(total, '3 de esta pestaña + 1 de la pestaña Y').toBe(4);
});

test('12b·3 sin ninguna carrera: B añade y quita una favorita, A la vuelve a añadir — se queda y nadie entra en bucle', async ({ context }) => {
  test.setTimeout(240_000);
  const p1 = await context.newPage();
  await abrir(p1, '/#/calculadoras');
  await p1.evaluate(() => {
    localStorage.removeItem('epa:calc-favoritos');
    localStorage.removeItem('epa:sinc-marcas');
  });
  await p1.reload();
  const p2 = await context.newPage();
  await abrir(p2, '/#/calculadoras');
  const obs = await context.newPage();
  await observador(obs);
  const favoritas = () => obs.evaluate(() => localStorage.getItem('epa:calc-favoritos') ?? '[]');
  const anadir = (p: Page) => p.getByRole('button', { name: /^Añadir .* a favoritas$/ }).first();
  const nombre = ((await anadir(p2).getAttribute('aria-label')) ?? '').replace(/^Añadir (.*) a favoritas$/, '$1');
  // tab B: adds the favourite, then (later) removes it; tab A follows each step
  await anadir(p2).click();
  await expect(p1.getByRole('button', { name: `Quitar ${nombre} de favoritas` })).toBeVisible();
  const id = JSON.parse(await favoritas())[0] as string;
  await p1.waitForTimeout(300);
  await p2.getByRole('button', { name: `Quitar ${nombre} de favoritas` }).click();
  await expect(p1.getByRole('button', { name: `Añadir ${nombre} a favoritas` })).toBeVisible();
  await expect.poll(favoritas).not.toContain(id);
  await p1.waitForTimeout(300);
  // a few seconds later, tab A adds it again (the reader changed their mind, in the other tab)
  await ponerACero(obs);
  await p1.getByRole('button', { name: `Añadir ${nombre} a favoritas` }).click();
  await p1.waitForTimeout(4000);
  const ev = await eventos(obs);
  const final = await favoritas();
  const enB = await p2.getByRole('button', { name: `Quitar ${nombre} de favoritas` }).count();
  console.log('eventos tras volver a añadirla', JSON.stringify(ev), 'favoritas guardadas', final, 'en B marcada', enB);
  expect(ev['epa:calc-favoritos'] ?? 0, 'escrituras de calc-favoritos en 4 s tras un solo clic (ping-pong)').toBeLessThanOrEqual(5);
  expect(final, 'la favorita que A volvió a añadir').toContain(id);
});

test('12b·2 un borrado cuya marca pisa una pestaña desfasada: la otra pestaña abierta no lo resucita ni entra en bucle', async ({ context }) => {
  test.setTimeout(240_000);
  const p1 = await context.newPage();
  await abrir(p1, '/#/calculadoras');
  await p1.evaluate(() => {
    localStorage.removeItem('epa:calc-favoritos');
    localStorage.removeItem('epa:sinc-marcas');
  });
  await p1.reload();
  const p2 = await context.newPage();
  await abrir(p2, '/#/calculadoras');
  const obs = await context.newPage();
  await observador(obs);
  const estrella = (p: Page) => p.getByRole('button', { name: /^Añadir .* a favoritas$/ }).first();
  const nombre = ((await estrella(p2).getAttribute('aria-label')) ?? '').replace(/^Añadir (.*) a favoritas$/, '$1');
  // tab B (p2) adds the favourite; tab A (p1) sees it
  await estrella(p2).click();
  const favoritas = () => obs.evaluate(() => localStorage.getItem('epa:calc-favoritos'));
  await expect.poll(favoritas).toContain('"');
  const id = JSON.parse((await favoritas())!)[0] as string;
  await expect(p1.getByRole('button', { name: `Quitar ${nombre} de favoritas` })).toBeVisible();
  await p1.waitForTimeout(500);
  const marcasAntes = await obs.evaluate(() => localStorage.getItem('epa:sinc-marcas'));
  // tab B is frozen (a background tab): it handles the other tabs' writes when it runs again
  const cdp = await context.newCDPSession(p2);
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  // a stale tab's read-merge-write of sinc-marcas lands between A's marks write and A's data write: A's deletion mark
  // is gone (what a tab whose cached view lagged writes — the known residual risk; 12b·1 shows it happens by itself).
  // Emulated in tab A's page: right before its data write lands, the stale marks are written.
  await p1.evaluate((m) => {
    const set = Storage.prototype.setItem;
    let hecho = false;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (!hecho && k === 'epa:calc-favoritos') {
        hecho = true;
        if (m === null) localStorage.removeItem('epa:sinc-marcas');
        else set.call(this, 'epa:sinc-marcas', m);
      }
      return set.call(this, k, v);
    };
  }, marcasAntes);
  await ponerACero(obs);
  // tab A removes it: marks (deletion), then the data
  await p1.getByRole('button', { name: `Quitar ${nombre} de favoritas` }).click();
  await expect.poll(() => p1.evaluate(() => localStorage.getItem('epa:calc-favoritos'))).not.toContain(id);
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await p1.waitForTimeout(4000);
  const ev = await eventos(obs);
  const final = await favoritas();
  console.log('eventos tras descongelar', JSON.stringify(ev), 'favoritas guardadas', final);
  expect(ev['epa:calc-favoritos'] ?? 0, 'escrituras de calc-favoritos en 4 s sin que nadie haga nada (ping-pong)').toBeLessThanOrEqual(5);
  expect(final, 'la favorita borrada en la pestaña A, de nuevo guardada').not.toContain(id);
});
