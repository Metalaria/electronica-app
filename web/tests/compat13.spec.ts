// 1.3 (cierre13): data saved by 1.2.1 opened by 1.3. The storage and the synchronisation's file did not change (format
// 3, minimum data version 1.2.0): 1.3 adds cards (a «montar» card in cap02/sec-2.7, cap03/sec-3.2, cap05/sec-5.5 and
// cap08/sec-8.2, so those lessons have one card more), removes a few (cap03/sec-3.10 «entre-dos»…) and gives some
// doing cards review variants (lib/leccion12/variantes.ts: other values or another goal, chosen by the session from
// the card's id and its seed, never stored; the answer goes under the card's own id). A 1.2.1 backup, or the
// synchronisation's file, must import cleanly: lessons completed, XP and mastery records kept; the practice session asks
// a card with variants as one of them over the records 1.2.1 left under its usual id, and never a broken card; a lesson
// whose number of cards grew starts again at its first card and keeps its completion.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test tests/compat13.spec.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
import { elegirVariante } from '../src/lib/leccion12/variantes.ts';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const INDICE = JSON.parse(readFileSync(`${WEB}public/libro/lecciones11/indice.json`, 'utf8')) as {
  lecciones: Record<string, { tarjetas: number; preguntas: { id: string; tipo: string }[] }>;
};
const leccion = (id: string) => JSON.parse(readFileSync(`${WEB}public/libro/lecciones11/${id}.json`, 'utf8')) as Leccion11;
const HOY = new Date(2026, 10, 20, 12).getTime();
const DIA = 86_400_000;
const T0 = HOY - 10 * DIA;
const SEMILLA = 1313;

// 1.2.1's lessons as the backup remembers them: 8.2 had 13 cards (now 14, with «monte-realimentacion») and was
// completed; 0.7 was left at its 6th card (11 then and now); 1.10 was completed and its «cortocircuito» (a card with
// variants in 1.3) failed twice; «entre-dos» of 3.10 was removed in 1.3
const CON_VARIANTES = 'cap01-l11-sec-1.10-cortocircuito';
const QUITADA = 'cap03-l11-sec-3.10-entre-dos';
const OTRAS = ['cap01-l11-sec-1.10-prediga-bornes', 'cap08-l11-sec-8.2-prediga-no-inversor', 'cap00-l11-sec-0.7-prediga-carga'];
const seccionDe = (id: string) => {
  const [, cap, label] = /^(cap\d+)-l11-(sec-[\d.]+)-/.exec(id)!;
  return `${cap}/${label}`;
};
const ALMACENES = {
  lecciones: {
    'cap08/sec-8.2': { t: T0, v: { h: Array.from({ length: 13 }, (_, k) => k), u: 13, n: 13, c: T0, t: T0 } },
    'cap00/sec-0.7': { t: T0 + 1000, v: { h: [0, 1, 2, 3, 4], u: 5, n: 11, c: 0, t: T0 + 1000 } },
    'cap01/sec-1.10': { t: T0 + 2000, v: { h: Array.from({ length: 12 }, (_, k) => k), u: 12, n: 12, c: T0 + 2000, t: T0 + 2000 } },
  },
  'progreso-xp': {
    'l:cap08/sec-8.2': { t: T0, v: { x: 50, t: T0 } },
    'l:cap01/sec-1.10': { t: T0 + 2000, v: { x: 50, t: T0 + 2000 } },
    ...Object.fromEntries([CON_VARIANTES, QUITADA, ...OTRAS].map((id, k) => [`pr:${id}`, { t: T0 - k, v: { x: 10, t: T0 - k } }])),
  },
  // failed rounds: the sections are weak, so the practice plan picks them
  dominio: Object.fromEntries(
    [CON_VARIANTES, QUITADA, ...OTRAS].map((id, k) => [id, { t: T0 - k, v: { s: seccionDe(id), c: 'p', r: [[T0 - 3 * DIA - k, 0], [T0 - k, 0]] } }]),
  ),
};
const XP_TOTAL = 50 + 50 + 10 * (2 + OTRAS.length);
const copia = { formato: 'epa-copia-seguridad', version: 3, app: '1.2.1', exportado: HOY - DIA, dispositivo: 'Portátil (1.2.1)', almacenes: ALMACENES };
const sincronizacion = { formato: 'epa-sincronizacion', version: 3, id: 'doc-121', actualizado: HOY - DIA, podado: 0, dispositivos: {}, almacenes: ALMACENES };

async function abrir(page: Page, hash: string): Promise<void> {
  await page.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await page.addInitScript((s) => ((window as unknown as { __epaSemillaPractica: number }).__epaSemillaPractica = s), SEMILLA);
  await page.clock.setFixedTime(HOY);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
  await page.reload();
}
async function importar(page: Page, nombre: string, texto: string): Promise<void> {
  await abrir(page, '#/sincronizacion');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-copia-importar]').click()]);
  await fc.setFiles({ name: nombre, mimeType: 'application/json', buffer: Buffer.from(texto, 'utf8') });
  await expect(page.locator('[data-copia-vista]')).toBeVisible();
  await expect(page.locator('[data-copia-error]')).toHaveCount(0);
  await expect(page.locator('[data-copia-descartados]')).toHaveCount(0);
  await page.locator('[data-copia-aplicar]').click();
  await expect(page.locator('[data-copia-resultado]')).toContainText('Importado');
}
const leer = <T>(page: Page, k: string) => page.evaluate((x) => JSON.parse(localStorage.getItem(`epa:${x}`) ?? 'null'), k) as Promise<T>;
const sinRoturas = async (page: Page) => {
  const texto = await page.locator('main').innerText();
  expect(texto).not.toMatch(/\bNaN\b|undefined|\[object Object\]/);
};

test('lo que esta prueba supone de la 1.3: 8.2 creció, «entre-dos» ya no está, «cortocircuito» tiene variantes', () => {
  expect(INDICE.lecciones['cap08/sec-8.2']!.tarjetas).toBe(14);
  expect(INDICE.lecciones['cap08/sec-8.2']!.preguntas.map((q) => q.id)).toContain('monte-realimentacion');
  expect(INDICE.lecciones['cap03/sec-3.10']!.preguntas.map((q) => q.id)).not.toContain('entre-dos');
  expect(INDICE.lecciones['cap01/sec-1.10']!.preguntas.map((q) => q.id)).toContain('cortocircuito');
  expect(leccion('cap01/sec-1.10').tarjetas.find((t) => t.id === 'cortocircuito')!.variantes?.length).toBeGreaterThan(0);
  expect(INDICE.lecciones['cap00/sec-0.7']!.tarjetas).toBe(11);
});

for (const [nombre, datos] of [
  ['una copia de seguridad de la 1.2.1', copia],
  ['el fichero de sincronización de la 1.2.1', sincronizacion],
] as const) {
  test(`${nombre}: se importa, conserva lecciones, XP y dominio, y el repaso pregunta las variantes sin romperse`, async ({ page }) => {
    test.setTimeout(180_000);
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await importar(page, 'copia-121.json', JSON.stringify(datos));
    const lec = await leer<Record<string, { c: number; n: number; u: number }>>(page, 'lecciones');
    expect(lec['cap08/sec-8.2']).toMatchObject({ c: T0 });
    expect(lec['cap00/sec-0.7']).toMatchObject({ c: 0, u: 5 });
    // the XP: every award kept, the removed card's too
    await page.goto('#/progreso');
    await expect(page.locator('[data-nivel][data-xp]')).toHaveAttribute('data-xp', String(XP_TOTAL));
    await sinRoturas(page);
    await page.goto('#/progreso/dominio');
    await expect(page.locator('main h1').first()).toBeVisible();
    await sinRoturas(page);
    await page.goto('#/cursos/fundamentos');
    await expect(page.locator('[data-nodo="cap01/sec-1.10"]')).toHaveAttribute('data-estado', 'hecho');
    await expect(page.locator('[data-nodo="cap00/sec-0.7"]')).toHaveAttribute('data-estado', 'en-curso');
    await sinRoturas(page);

    // the practice of 1.10: the card with variants is asked as the variant the seed gives, under its own id
    const l = leccion('cap01/sec-1.10');
    const corto = l.tarjetas.find((t) => t.id === 'cortocircuito')!;
    const k = elegirVariante(corto, SEMILLA);
    expect(k).not.toBeNull();
    const vigentes = new Set(INDICE.lecciones['cap01/sec-1.10']!.preguntas.map((q) => `cap01-l11-sec-1.10-${q.id}`));
    await page.goto('#/practicar/cap01/sec-1.10');
    await page.locator('[data-empezar-sesion]').click();
    const sesion = page.locator('[data-sesion]');
    await expect(sesion).toHaveAttribute('data-fase', 'items');
    let vista = false;
    for (let n = 0; n < 20; n++) {
      if ((await sesion.getAttribute('data-fase')) !== 'items') break;
      const cuerpo = page.locator('.cuerpo[data-item]');
      await expect(cuerpo).toBeVisible();
      const id = (await cuerpo.getAttribute('data-item'))!;
      expect(id).not.toBe(QUITADA);
      if ((await cuerpo.getAttribute('data-item-tipo')) === 'leccion11') {
        expect(vigentes.has(id), `${id} es una tarjeta de la lección de ahora`).toBe(true);
        const suelta = cuerpo.locator('[data-leccion11-suelta]');
        await expect(suelta).toBeVisible();
        expect((await suelta.innerText()).trim().length, `${id} tiene contenido`).toBeGreaterThan(20);
        if (id === CON_VARIANTES) {
          vista = true;
          await expect(suelta).toHaveAttribute('data-tarjeta', 'cortocircuito');
          await expect(suelta).toHaveAttribute('data-variante', String(k));
          await expect(suelta.locator('[data-rotulo-variante]')).toBeVisible();
        }
      }
      await sinRoturas(page);
      const saltar = page.locator('[data-saltar]');
      if (!(await saltar.count())) break;
      await saltar.click();
      await expect(cuerpo.or(page.locator('[data-sesion][data-fase="fin"]'))).not.toHaveAttribute('data-item', id);
    }
    await expect(sesion).toHaveAttribute('data-fase', 'fin');
    await sinRoturas(page);
    expect(vista, 'la sesión pregunta la tarjeta con variantes').toBe(true);
    // the records 1.2.1 left under the card's id are still there; nothing names a variant
    const dominio = await leer<{ items: Record<string, { r?: unknown[] }> }>(page, 'dominio');
    expect(Object.keys(dominio.items)).toContain(CON_VARIANTES);
    expect(await page.evaluate(() => JSON.stringify(localStorage).includes('variante'))).toBe(false);

    // the lesson that grew: it starts again at its first card, and keeps its completion with the new number of cards
    await page.goto('#/leccion/cap08/sec-8.2');
    await expect(page.locator('[data-leccion11="cap08/sec-8.2"]')).toBeVisible();
    await expect(page.locator('[data-leccion11] [data-tarjeta]').first()).toHaveAttribute('data-tarjeta', leccion('cap08/sec-8.2').tarjetas[0]!.id);
    await sinRoturas(page);
    await expect.poll(async () => (await leer<Record<string, { c: number; n: number }>>(page, 'lecciones'))?.['cap08/sec-8.2']).toMatchObject({ c: T0, n: 14 });
    // the lesson left half-way, same number of cards: still where it was
    await page.goto('#/leccion/cap00/sec-0.7');
    await expect(page.locator('[data-leccion11="cap00/sec-0.7"]')).toBeVisible();
    await sinRoturas(page);
    expect(errores).toEqual([]);
  });
}
