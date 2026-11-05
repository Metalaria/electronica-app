// Independent review 12d: real Chromium tabs of one context (one localStorage, each tab with its own cached view).
//   12d·1  an import in tab A deletes items (a backup's tombstones, «Unir») while tab B keeps writing the same store
//          (steps of the daily activity): B's write from its lagging cached view puts the deleted items back, and tab A
//          — which dropped `propios` for the items it applied — takes them as another writer's: the deletion is undone
//          in both tabs, and the next synchronisation keeps the items (their hash is the recorded one)
//   EPA_DIST=/tmp/claude-0/epa-revision12d EPA_PUERTO=4555 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb \
//     npx playwright test -c playwright.revision12c.config.ts tests/revision12d-pestanas.spec.ts
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

async function elegirFichero(page: Page, nombre: string, texto: string): Promise<void> {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-copia-importar]').click()]);
  await fc.setFiles({ name: nombre, mimeType: 'application/json', buffer: Buffer.from(texto, 'utf8') });
}

const copiaDe = (almacenes: Record<string, unknown>) =>
  JSON.stringify({ formato: 'epa-copia-seguridad', version: 1, app: '0.12.0', exportado: 1, dispositivo: 'Prueba', almacenes });

test('12d·4 recargar la pestaña conserva su id de pestaña (el cerrojo de la página anterior ya se soltó)', async ({ context }) => {
  const p = await context.newPage();
  await abrir(p);
  const ids = new Set<string | null>();
  for (let i = 0; i < 6; i++) {
    await p.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.registrarActividad('paso', 1));
    await p.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.escribir());
    ids.add(await p.evaluate(() => sessionStorage.getItem('epa:pestana')));
    await p.reload();
    await abrir(p);
  }
  const registros = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}')).filter((k) => k.includes('@')));
  console.log('ids de pestaña', [...ids], 'registros', registros);
  expect(ids.size, 'un solo id de pestaña tras 6 recargas').toBe(1);
});

test('12d·1 una importación borra elementos mientras otra pestaña escribe el mismo almacén: no vuelven', async ({ context }) => {
  test.setTimeout(600_000);
  const p1 = await context.newPage();
  await abrir(p1, '/#/sincronizacion');
  await p1.evaluate(() => {
    localStorage.removeItem('epa:progreso-diario');
    localStorage.removeItem('epa:sinc-marcas');
  });
  await abrir(p1, '/#/sincronizacion');
  const p2 = await context.newPage();
  await abrir(p2);
  const obs = await context.newPage();
  await obs.goto('/icono.png');
  const RONDAS = Number(process.env.EPA_RONDAS ?? 6);
  const vueltos: string[] = [];
  let pasosB = 0;
  for (let k = 1; k <= RONDAS; k++) {
    const dia = `2026-01-${String(k).padStart(2, '0')}`;
    const ids = [dia, `${dia}@zzzzzz`];
    // another device's day, as a synchronisation would have stored it (a third writer: both tabs take it)
    await obs.evaluate((ids) => {
      const v = JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, unknown>;
      for (const id of ids) v[id] = { pasos: 1, preguntas: 0, secciones: 0, cumplido: false, t: 1_700_000_000_000 };
      localStorage.setItem('epa:progreso-diario', JSON.stringify(v));
    }, ids);
    await p1.waitForTimeout(800);
    for (const p of [p1, p2]) expect(Object.keys(await p.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.itemsDias()))).toEqual(expect.arrayContaining(ids));
    // a backup whose newer tombstones delete them («Unir»)
    const ahora = await p1.evaluate(() => Date.now());
    const copia = copiaDe({ 'progreso-diario': Object.fromEntries(ids.map((id) => [id, { t: ahora, x: 1 }])) });
    await elegirFichero(p1, `copia-${k}.json`, copia);
    await expect(p1.locator('tr[data-almacen="progreso-diario"] [data-borrados]')).toHaveText('2');
    // tab B: the reader keeps studying there (a step written every few ms) while A imports
    const bucle = p2.evaluate(async (ms) => {
      const d = (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario;
      const fin = performance.now() + ms;
      let n = 0;
      while (performance.now() < fin) {
        d.registrarActividad('paso', 1);
        await d.escribir();
        n++;
        await new Promise((r) => setTimeout(r, 1 + Math.random() * 4));
      }
      return n;
    }, 2500);
    await p1.waitForTimeout(300 + Math.random() * 600);
    await p1.locator('[data-copia-aplicar]').click();
    await expect(p1.locator('[data-copia-resultado]')).toContainText('Importado');
    pasosB += await bucle;
    await p1.waitForTimeout(4000);
    const guardado = await obs.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, unknown>));
    const enA = Object.keys(await p1.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.itemsDias()));
    const enB = Object.keys(await p2.evaluate(() => (window as unknown as { __epaPruebasDiario: Diario }).__epaPruebasDiario.itemsDias()));
    const fuera = ids.filter((id) => guardado.includes(id) || enA.includes(id) || enB.includes(id));
    console.log(`ronda ${k}: vueltos ${JSON.stringify(fuera)} (almacén ${ids.filter((id) => guardado.includes(id)).length}, A ${ids.filter((id) => enA.includes(id)).length}, B ${ids.filter((id) => enB.includes(id)).length})`);
    vueltos.push(...fuera);
  }
  // no step of tab B lost either
  const totalB = await obs.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, { pasos: number }>;
    return Object.entries(v)
      .filter(([k]) => k.includes('@') && !k.endsWith('~') && !k.includes('@zzzzzz'))
      .reduce((n, [, r]) => n + r.pasos, 0);
  });
  console.log('pasos de B', pasosB, 'guardados', totalB, 'marcas', await obs.evaluate(() => localStorage.getItem('epa:sinc-marcas')?.slice(0, 400)));
  expect(totalB, 'pasos de la pestaña B').toBe(pasosB);
  expect(vueltos, 'elementos borrados por la importación que volvieron').toEqual([]);
});
