// 1.0 «modo docente», fixes of review 10h (besides the reviewer's own r10h·1–6 in tests/revision10h-navegador.spec.ts):
// atomic deletions, self-assessments merged question by question, a monotonic exam clock, the variant stored with the
// result, the result's own time limit, a hand-in of what there is when questions are no longer in the book, a PDF that
// never prints the book's values for a variant, and a hand-in after an unwritten draft without a question.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.docente10.config.ts tests/docente10-revision10h.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { unirResultados } from '../src/lib/docente/union';
import { calificarItem, type ContextoExamen } from '../src/lib/docente/examen';
import type { Resultado, ResultadoItem } from '../src/lib/docente/tipos';
import { cargarLibro } from './docente10/libro-node';

async function limpio(page: Page): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'claro', tam: 18 }));
    }
  });
}

/** Writes of keys starting with sessionStorage «fallar» fail (storage full) while it is set. */
async function fallosDeEscritura(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const poner = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      const f = sessionStorage.getItem('fallar');
      if (this === localStorage && f && k.startsWith(f)) throw new DOMException('lleno', 'QuotaExceededError');
      return poner.call(this, k, v);
    };
  });
}
const fallar = (page: Page, prefijo: string | null) => page.evaluate((p) => (p ? sessionStorage.setItem('fallar', p) : sessionStorage.removeItem('fallar')), prefijo);

async function crearExamen(page: Page, o: { variantes?: boolean; minutos?: number; soloEjercicio?: boolean } = {}): Promise<string> {
  await page.goto('#/docente');
  await page.locator('[data-nuevo-examen]').click();
  await expect(page.locator('[data-selector]')).toBeVisible();
  await page.locator('[data-titulo]').fill('Examen de diodos');
  await page.locator('[data-minutos]').fill(String(o.minutos ?? 30));
  if (o.variantes) await page.locator('[data-variantes]').check();
  else await page.locator('[data-variantes]').uncheck();
  await page.locator('[data-barajar]').uncheck();
  await page.locator('[data-filtro-parte]').selectOption('cap01');
  await page.locator('li[data-entrada="ejercicio:ej-1.1"] [data-anadir]').click();
  if (!o.soloEjercicio) {
    await page.locator('[data-filtro-parte]').selectOption('cap05');
    await page.locator('li[data-entrada="pregunta:cap05-01"] [data-anadir]').click();
  }
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(/#\/docente\/examen\/x[a-z0-9]+$/);
  return decodeURIComponent(new URL(page.url()).hash).split('/').pop()!;
}

// ------------------------------------------------------------------ pure

const item = (ref: string, autoeval: number | undefined, t: number | undefined, puntos: number): ResultadoItem => ({
  k: 'ejercicio',
  ref,
  puntos,
  maximo: 2,
  valores: { texto: 'x' },
  estado: autoeval == null ? 'pendiente' : autoeval === 1 ? 'bien' : 'mal',
  ...(autoeval != null ? { autoeval } : {}),
  ...(t != null ? { autoevalT: t } : {}),
});
const res = (items: ResultadoItem[], actualizado: number, extra: Partial<Resultado> = {}): Resultado => ({
  id: 'r1',
  examen: 'x1',
  titulo: 'E',
  semilla: 1,
  inicio: 1,
  t: 10,
  actualizado,
  puntos: Math.round(items.reduce((s, i) => s + i.puntos, 0) * 100) / 100,
  maximo: 4,
  items,
  ...extra,
});

test('unir resultados: la autoevaluación más reciente de cada pregunta, de cualquier dispositivo; conmutativa, asociativa e idempotente', () => {
  const base = [item('ej-5.9', undefined, undefined, 0), item('ej-5.7', undefined, undefined, 0)];
  const a = res([item('ej-5.9', 1, 100, 2), base[1]!], 100);
  const b = res([base[0]!, item('ej-5.7', 0.5, 200, 1)], 200);
  const u = unirResultados(a, b);
  expect(u.items.map((i) => i.autoeval)).toEqual([1, 0.5]);
  expect(u.puntos).toBe(3);
  expect(u.actualizado).toBe(200);
  // a later change of the same question wins over the earlier one
  const c = res([item('ej-5.9', 0, 300, 0), base[1]!], 300);
  expect(unirResultados(unirResultados(a, b), c).items.map((i) => i.autoeval)).toEqual([0, 0.5]);
  // a deletion is final: it wins over any live version, older or newer
  const borrado = res([], 150, { borrado: 150, puntos: 0, maximo: 0 });
  expect(unirResultados(u, borrado).borrado).toBe(150);
  expect(unirResultados(c, borrado).borrado).toBe(150);
  // properties on random triples
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const azar = (): Resultado => {
    if (rnd(6) === 0) return res([], 1 + rnd(5), { borrado: 1 + rnd(5), puntos: 0, maximo: 0 });
    const its = ['ej-5.9', 'ej-5.7', 'ej-1.1'].map((r) => (rnd(2) ? item(r, [0, 0.5, 1][rnd(3)], 1 + rnd(4), rnd(3)) : item(r, undefined, undefined, 0)));
    return res(its, 1 + rnd(5), { titulo: ['E', 'F'][rnd(2)] });
  };
  const k = (r: Resultado) => JSON.stringify(r);
  for (let i = 0; i < 3000; i++) {
    const [x, y, z] = [azar(), azar(), azar()];
    expect(k(unirResultados(x, y))).toBe(k(unirResultados(y, x)));
    expect(k(unirResultados(unirResultados(x, y), z))).toBe(k(unirResultados(x, unirResultados(y, z))));
    expect(k(unirResultados(x, x))).toBe(k(x));
  }
});

test('una variante guardada en el resultado se corrige con sus valores aunque falte el contenido de práctica', () => {
  const L = cargarLibro();
  const sinPractica: ContextoExamen = { ...L.libro, numerico: () => undefined };
  const vv = { valores: { V_CC: 9 }, resultado: 123, enunciado: '<p>x</p>', esperado: { valor: 123, unidad: 'Ω', tol: 0.02, texto: '123 Ω', nombre: 'R' } };
  const m = { k: 'ejercicio' as const, ref: 'ej-1.1', puntos: 2, n: 1, variante: 3, vv };
  expect(calificarItem(m, sinPractica, { r1: '123' }).estado).toBe('bien');
  expect(calificarItem(m, sinPractica, { r1: '440' }).estado).toBe('mal');
  expect(calificarItem(m, L.libro, { r1: '123' }).estado).toBe('bien');
});

// ------------------------------------------------------------------ browser

test('borrar con el almacenamiento lleno no hace nada y lo dice (examen y resultado)', async ({ page }) => {
  await fallosDeEscritura(page);
  await limpio(page);
  const id = await crearExamen(page, { soloEjercicio: true });
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('11,75');
  await page.locator('[data-entregar]').click();
  await expect(page.locator('[data-nota-total]')).toBeVisible();
  await page.goto(`#/docente/examen/${id}`);
  await fallar(page, 'epa:docente');
  await page.locator('[data-resultado] button').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
  await expect(page.locator('[data-fallo-borrar]')).toContainText('No se ha podido borrar el resultado');
  await expect(page.locator('[data-resultado]')).toHaveCount(1);
  await page.goto('#/docente');
  await page.locator(`[data-propio="${id}"] [data-borrar]`).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
  await expect(page.locator('[data-fallo-borrar]')).toContainText('No se ha podido borrar');
  await expect(page.locator(`[data-propio="${id}"]`)).toHaveCount(1);
  await fallar(page, null);
  await page.reload();
  await expect(page.locator(`[data-propio="${id}"]`)).toHaveCount(1);
});

test('un salto del reloj del sistema durante el examen no lo termina; al recargar con el reloj atrasado no se recupera tiempo', async ({ page }) => {
  await limpio(page);
  await page.clock.install();
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await expect(page.locator('[data-reloj]')).toContainText(/30:00|29:5\d/);
  await page.clock.runFor(60_000);
  // the system clock jumps two hours ahead
  await page.clock.setSystemTime(Date.now() + 2 * 3600_000 + 120_000);
  await page.clock.runFor(3000);
  await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}/hacer$`));
  await expect(page.locator('[data-tiempo-agotado]')).toHaveCount(0);
  await expect(page.locator('[data-reloj]')).toContainText(/28:5\d/);
  await page.clock.runFor(16_000);
  // the clock is put far back and the page reloaded: the time counted stays counted
  await page.clock.setSystemTime(Date.now() - 5 * 3600_000);
  await page.reload();
  await expect(page.locator('[data-reloj]')).toContainText(/28:[34]\d/);
});

test('el resultado guarda los valores de su variante y su propio límite de tiempo', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page, { variantes: true, soloEjercicio: true, minutos: 1 });
  // an attempt left open two hours ago (opened, with an answer): coming back hands it in at once
  await page.evaluate((x) => {
    const d = JSON.parse(localStorage.getItem('epa:docente')!).propios[x];
    localStorage.setItem(`epa:docente-en-curso:${x}`, JSON.stringify({ variante: 1, inicio: Date.now() - 2 * 3600_000, respuestas: { 1: { r1: '12' } }, actualizado: d.actualizado, def: d.examen, abierto: true, transcurrido: 30_000 }));
  }, id);
  await page.goto(`#/docente/examen/${id}/hacer`);
  await expect(page).toHaveURL(/#\/docente\/resultado\//, { timeout: 15_000 });
  await expect(page.locator('.total .meta')).toContainText('1 min · se acabó el tiempo');
  const rid = decodeURIComponent(new URL(page.url()).hash).split('/').pop()!;
  const r = await page.evaluate((k) => JSON.parse(localStorage.getItem('epa:docente-resultados')!).resultados[k], rid);
  expect(r.minutos).toBe(1);
  expect(r.items[0].vv.esperado.texto).toBeTruthy();
  // the exam is edited later (no limit) and the stored variant changed by hand: the result keeps its own
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-minutos]').fill('0');
  await page.locator('[data-guardar]').click();
  await page.evaluate((k) => {
    const d = JSON.parse(localStorage.getItem('epa:docente-resultados')!);
    d.resultados[k].items[0].vv.enunciado = 'Enunciado de la variante guardada';
    localStorage.setItem('epa:docente-resultados', JSON.stringify(d));
  }, rid);
  await page.goto(`#/docente/resultado/${rid}`);
  await page.reload();
  await expect(page.locator('.total .meta')).toContainText('1 min · se acabó el tiempo');
  await expect(page.locator('[data-enunciado-variante]')).toHaveText('Enunciado de la variante guardada');
});

test('preguntas que ya no están en el libro: se ve y se entrega lo que hay; las otras respuestas van con el resultado', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('11,75');
  await page.locator('[data-item-examen="2"]').getByRole('radio').nth(1).check();
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k) ?? '', `epa:docente-en-curso:${id}`)).toContain('"2":{"r":"1"}');
  // a later version of the book without that test question
  await page.route('**/libro/repaso/cap05.json', async (r) => {
    const res = await r.fetch();
    const d = (await res.json()) as { preguntas: { id: string }[] };
    d.preguntas = d.preguntas.filter((p) => p.id !== 'cap05-01');
    await r.fulfill({ response: res, json: d });
  });
  await page.reload();
  await expect(page.locator('[data-no-disponibles]')).toBeVisible();
  await page.locator('[data-ver-lo-que-hay]').click();
  await expect(page.locator('[data-parcial]')).toBeVisible();
  await expect(page.locator('[data-item-examen]')).toHaveCount(1);
  await expect(page.locator('[data-item-examen="1"] [data-campo="r1"]')).toHaveValue('11,75');
  await page.locator('[data-entregar]').click();
  await expect(page).toHaveURL(/#\/docente\/resultado\//);
  await expect(page.locator('[data-sin-corregir]')).toContainText('cap05-01');
  await expect(page.locator('[data-nota-total]')).toContainText('de 2 puntos');
});

test('el PDF de un examen con variantes no se hace con los valores del libro si no carga la práctica', async ({ page }) => {
  await limpio(page);
  await crearExamen(page, { variantes: true, soloEjercicio: true });
  await page.reload();
  await page.route('**/libro/practica/indice.json', (r) => r.abort());
  let descargas = 0;
  page.on('download', () => descargas++);
  await page.locator('[data-pdf-generar]').click();
  await expect(page.locator('[data-pdf-estado]')).toContainText('No se pudo hacer el PDF');
  await expect(page.locator('[data-pdf-estado]')).not.toContainText('Failed to fetch');
  expect(descargas).toBe(0);
});

test('tras un borrador que no se pudo escribir, entregar no pregunta nada (las respuestas van al resultado)', async ({ page }) => {
  await fallosDeEscritura(page);
  await limpio(page);
  await crearExamen(page, { soloEjercicio: true });
  await page.locator('[data-empezar]').click();
  await fallar(page, 'epa:docente-en-curso:');
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('11,75');
  await expect(page.locator('[data-fallo-borrador]')).toBeVisible();
  await page.locator('[data-entregar]').click();
  await expect(page).toHaveURL(/#\/docente\/resultado\//);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
