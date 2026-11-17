// 1.2.1 (cierre121): data saved by 1.2.0 after the lessons were rewritten «aprender haciendo». The lesson ids were kept,
// but 1657 of the cards that «Práctica inteligente» asks on their own were removed (and others changed type: a
// «predecir» became a «simular»…). A 1.2.0 backup, or the synchronisation's file (format 3, unchanged), whose lesson
// progress, XP and mastery records name removed cards must still import, keep the lessons completed and the XP, and
// never give a broken card: the practice session asks only the cards of the current lessons
// (lib/aprendizaje/catalogo.ts itemsLecciones11, from libro/lecciones11/indice.json; componentes/practicar/sesion.ts
// skips a card that is no longer there), and a lesson whose number of cards changed starts again at its first card
// (componentes/leccion11/Leccion11.svelte) instead of jumping past its end.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test tests/compat121.spec.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const INDICE = JSON.parse(readFileSync(`${WEB}public/libro/lecciones11/indice.json`, 'utf8')) as {
  lecciones: Record<string, { tarjetas: number; preguntas: { id: string; tipo: string }[] }>;
};
const HOY = new Date(2026, 10, 16, 12).getTime();
const DIA = 86_400_000;
const T0 = HOY - 20 * DIA;

// 1.2.0's lessons as the backup remembers them: 0.12 had 15 cards (now 12) and was completed; 0.1 had 10 (now 8) and
// was left at its 10th; the cards named below were removed in 1.2.1 or changed type
const QUITADAS = ['cap00-l11-sec-0.12-promediar', 'cap00-l11-sec-0.12-ordene-spice', 'cap00-l11-sec-0.1-ordene-prefijos', 'cap00-l11-sec-0.1-griego'];
const CAMBIADAS = ['cap00-l11-sec-0.12-prediga-diez', 'cap00-l11-sec-0.1-prediga-kilo'];
const ALMACENES = {
  lecciones: {
    'cap00/sec-0.12': { t: T0, v: { h: Array.from({ length: 15 }, (_, k) => k), u: 15, n: 15, c: T0, t: T0 } },
    'cap00/sec-0.1': { t: T0 + 1000, v: { h: [0, 1, 2, 3, 4, 5, 6, 7, 8], u: 9, n: 10, c: 0, t: T0 + 1000 } },
  },
  'progreso-xp': {
    'l:cap00/sec-0.12': { t: T0, v: { x: 50, t: T0 } },
    ...Object.fromEntries([...QUITADAS, ...CAMBIADAS].map((id, k) => [`pr:${id}`, { t: T0 - k, v: { x: 10, t: T0 - k } }])),
  },
  // failed rounds on removed cards: the section is weak, so the practice plan picks it
  dominio: Object.fromEntries(
    [...QUITADAS, ...CAMBIADAS].map((id, k) => [id, { t: T0 - k, v: { s: id.startsWith('cap00-l11-sec-0.12') ? 'cap00/sec-0.12' : 'cap00/sec-0.1', c: 'p', r: [[T0 - 3 * DIA - k, 0], [T0 - k, 0]] } }]),
  ),
};
const PRIMERA_01 = (JSON.parse(readFileSync(`${WEB}public/libro/lecciones11/cap00/sec-0.1.json`, 'utf8')) as { tarjetas: { id: string }[] }).tarjetas[0]!.id;
const XP_TOTAL = 50 + 10 * (QUITADAS.length + CAMBIADAS.length);
const copia = { formato: 'epa-copia-seguridad', version: 3, app: '1.2.0', exportado: HOY - DIA, dispositivo: 'Portátil (1.2.0)', almacenes: ALMACENES };
const sincronizacion = { formato: 'epa-sincronizacion', version: 3, id: 'doc-120', actualizado: HOY - DIA, podado: 0, dispositivos: {}, almacenes: ALMACENES };

async function abrir(page: Page, hash: string): Promise<void> {
  await page.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
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
  // nothing of it is refused: the removed cards' items are well-formed data
  await expect(page.locator('[data-copia-descartados]')).toHaveCount(0);
  await page.locator('[data-copia-aplicar]').click();
  await expect(page.locator('[data-copia-resultado]')).toContainText('Importado');
}
const leer = <T>(page: Page, k: string) => page.evaluate((x) => JSON.parse(localStorage.getItem(`epa:${x}`) ?? 'null'), k) as Promise<T>;
const sinRoturas = async (page: Page) => {
  const texto = await page.locator('main').innerText();
  expect(texto).not.toMatch(/\bNaN\b|undefined|\[object Object\]/);
};

test('las tarjetas quitadas en la 1.2.1 ya no están en el índice (lo que esta prueba supone)', () => {
  for (const id of QUITADAS) {
    const [, label, tarjeta] = /^cap00-l11-(sec-[\d.]+)-(.+)$/.exec(id)!;
    expect(INDICE.lecciones[`cap00/${label}`]!.preguntas.map((q) => q.id), id).not.toContain(tarjeta);
  }
  expect(INDICE.lecciones['cap00/sec-0.12']!.tarjetas).toBe(12);
  expect(INDICE.lecciones['cap00/sec-0.1']!.tarjetas).toBe(8);
});

for (const [nombre, datos] of [
  ['una copia de seguridad de la 1.2.0', copia],
  ['el fichero de sincronización de la 1.2.0', sincronizacion],
] as const) {
  test(`${nombre} con tarjetas quitadas: se importa, conserva lecciones y XP, y la práctica no da tarjetas rotas`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await importar(page, 'copia-120.json', JSON.stringify(datos));
    const lec = await leer<Record<string, { c: number; n: number }>>(page, 'lecciones');
    expect(lec['cap00/sec-0.12']).toMatchObject({ c: T0 });
    // the XP: every award kept, the removed cards' too (earned once, never taken back)
    await page.goto('#/progreso');
    await expect(page.locator('[data-nivel][data-xp]')).toHaveAttribute('data-xp', String(XP_TOTAL));
    await sinRoturas(page);
    // the mastery of the sections (their records name removed cards): numbers, no gaps
    await page.goto('#/progreso/dominio');
    await expect(page.locator('main h1').first()).toBeVisible();
    await sinRoturas(page);
    // the course path: 0.12 done, 0.1 started
    await page.goto('#/cursos/fundamentos');
    await expect(page.locator('[data-nodo="cap00/sec-0.12"]')).toHaveAttribute('data-estado', 'hecho');
    await expect(page.locator('[data-nodo="cap00/sec-0.1"]')).toHaveAttribute('data-estado', 'en-curso');
    await sinRoturas(page);

    // the practice of the weak sections: only current cards, each with its card on show
    for (const seccion of ['sec-0.12', 'sec-0.1']) {
      const vigentes = new Set(INDICE.lecciones[`cap00/${seccion}`]!.preguntas.map((q) => `cap00-l11-${seccion}-${q.id}`));
      await page.goto(`#/practicar/cap00/${seccion}`);
      await page.locator('[data-empezar-sesion]').click();
      let tarjetas = 0;
      const sesion = page.locator('[data-sesion]');
      await expect(sesion).toHaveAttribute('data-fase', 'items');
      for (let k = 0; k < 15; k++) {
        if ((await sesion.getAttribute('data-fase')) !== 'items') break;
        const cuerpo = page.locator('.cuerpo[data-item]');
        await expect(cuerpo).toBeVisible();
        const id = (await cuerpo.getAttribute('data-item'))!;
        expect(QUITADAS, `${seccion}: ${id}`).not.toContain(id);
        if ((await cuerpo.getAttribute('data-item-tipo')) === 'leccion11') {
          tarjetas++;
          expect(vigentes.has(id), `${seccion}: ${id} es una tarjeta de la lección de ahora`).toBe(true);
          const suelta = cuerpo.locator('[data-leccion11-suelta]');
          await expect(suelta).toBeVisible();
          await expect(suelta).toHaveAttribute('data-tarjeta', id.slice(`cap00-l11-${seccion}-`.length));
          expect((await suelta.innerText()).trim().length, `${seccion}: ${id} tiene contenido`).toBeGreaterThan(20);
        }
        await sinRoturas(page);
        const saltar = page.locator('[data-saltar]');
        if (!(await saltar.count())) break;
        await saltar.click();
        await expect(cuerpo.or(page.locator('[data-sesion][data-fase="fin"]'))).not.toHaveAttribute('data-item', id);
      }
      // (a session made only of what is still there: it ends with its summary, never on an empty card)
      await expect(sesion).toHaveAttribute('data-fase', 'fin');
      await sinRoturas(page);
      expect(tarjetas, `${seccion}: la sesión pregunta tarjetas de la lección`).toBeGreaterThan(0);
    }

    // the lesson whose cards changed: it starts again at its first card, and its summary is reachable
    await page.goto('#/leccion/cap00/sec-0.1');
    await expect(page.locator('[data-leccion11="cap00/sec-0.1"]')).toBeVisible();
    await expect(page).toHaveURL(/#\/leccion\/cap00\/sec-0\.1$/);
    await expect(page.locator('[data-leccion11] [data-tarjeta]').first()).toHaveAttribute('data-tarjeta', PRIMERA_01);
    await sinRoturas(page);
    await page.goto('#/leccion/cap00/sec-0.12');
    await expect(page.locator('[data-leccion11="cap00/sec-0.12"]')).toBeVisible();
    await sinRoturas(page);
    // the completion survives a visit (same key, now with the lesson's new number of cards)
    await expect.poll(async () => (await leer<Record<string, { c: number; n: number }>>(page, 'lecciones'))?.['cap00/sec-0.12']).toMatchObject({ c: T0, n: 12 });
    expect(errores).toEqual([]);
  });
}
