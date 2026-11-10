// Review 11a in the browser: what the reader sees of the fixes of the data review — a 1.0 exam result with an
// exercise 1.1 now checks by itself, a stored grade the book's key changed later, a design the hand-in could not
// simulate, a lab completed by two devices together, and a bookmark of a section an expansion renumbered.
import { test, expect, type Page } from '@playwright/test';
import { LABORATORIOS } from '../src/componentes/instrumentos/practicas/laboratorios';
import { cargarLibro } from './docente10/libro-node';

const L = cargarLibro();
const T = Date.UTC(2026, 10, 1, 10);

async function con(page: Page, datos: Record<string, unknown>): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript((d) => {
    if (sessionStorage.getItem('preparado')) return;
    sessionStorage.setItem('preparado', '1');
    localStorage.clear();
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'claro', tam: 18 }));
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
  }, datos);
}

const resultado = (items: unknown[], puntos: number, maximo: number) => ({
  version: 1,
  resultados: { r11a: { id: 'r11a', examen: 'e11a', titulo: 'Examen de la 1.0', semilla: 1, inicio: T - 600_000, t: T, actualizado: T, puntos, maximo, items, variante: 0 } },
});

test('resultado de la 1.0: el texto escrito se ve y se autoevalúa; una clave cambiada después avisa sin cambiar la nota', async ({ page }) => {
  const viejo = { k: 'ejercicio', ref: 'ej-4.6', puntos: 0, maximo: 1, valores: { texto: 'Con el óhmetro: casi 0 Ω es el inductor.' }, estado: 'pendiente' };
  // prob-1.B handed in with 1.0's key (r3 = 1,15 W, corrected later to 1,33 W)
  const valores: Record<string, string> = { texto: 'Mi explicación' };
  for (const r of L.ejercicios.items['prob-1.B']!.respuestas) valores[r.id] = r.id === 'r3' ? '1,15 W' : r.texto;
  const errata = { k: 'ejercicio', ref: 'prob-1.B', puntos: 3, maximo: 4, valores, estado: 'pendiente' };
  await con(page, { 'epa:docente-resultados': resultado([viejo, errata], 3, 5) });
  await page.goto('/#/docente/resultado/r11a');
  const uno = page.locator('[data-item-resultado="1"]');
  await expect(uno).toHaveAttribute('data-estado', 'pendiente');
  await expect(uno.locator('.escrita')).toContainText('casi 0 Ω es el inductor');
  await expect(page.locator('[data-item-resultado="2"] [data-clave-cambiada]')).toContainText('se mantiene la nota de entonces');
  await expect(page.locator('[data-item-resultado="2"] [data-puntos-item]')).toHaveText('3 de 4');
  await expect(uno.locator('[data-clave-cambiada]')).toHaveCount(0);
  await uno.locator('[data-autoeval-valor="1"]').click();
  await expect(uno).toHaveAttribute('data-estado', 'bien');
  // «Bien» on the erratum's item: only the open part moves (3 + 1), the old field keeps its grade
  await page.locator('[data-item-resultado="2"] [data-autoeval-valor="1"]').click();
  await expect(page.locator('[data-item-resultado="2"]')).toHaveAttribute('data-estado', 'bien');
  await expect(page.locator('[data-nota-total] strong')).toHaveText('5');
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:docente-resultados')!).resultados.r11a);
  expect(r.items.map((x: { puntos: number; estado: string }) => [x.puntos, x.estado])).toEqual([[1, 'bien'], [4, 'bien']]);
});

test('un diseño que el examen no pudo simular al entregar se simula desde el resultado y se corrige', async ({ page }) => {
  const it = { k: 'ejercicio', ref: 'ej-25.9', puntos: 0, maximo: 2, valores: { p1: '3,3 k|47 n' }, estado: 'mal' };
  await con(page, { 'epa:docente-resultados': resultado([it], 0, 2) });
  await page.goto('/#/docente/resultado/r11a');
  const item = page.locator('[data-item-resultado="1"]');
  await expect(item).toContainText('Falta simular este diseño');
  await item.locator('[data-simular-ahora]').click();
  await expect(item).toHaveAttribute('data-estado', 'bien', { timeout: 60_000 });
  await expect(item.locator('[data-simular-ahora]')).toHaveCount(0);
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:docente-resultados')!).resultados.r11a);
  expect(r.puntos).toBe(2);
  expect(r.items[0].valores.p1).toMatch(/^3,3 k\|47 n#3300,4\.7e-8#fc=/);
  expect(r.items[0].autoevalT).toBeGreaterThan(T);
});

test('laboratorio completado entre dos dispositivos (sin `c`) y marcador de una sección renumerada', async ({ page }) => {
  const lab = LABORATORIOS.find((x) => x.n === 1)!;
  await con(page, {
    'epa:laboratorio': { version: 1, practicas: { p1: { h: lab.pasos.map((x) => x.id).sort(), l: {}, c: 0, t: T } } },
    // marked with an old number (33.14); the expansions renumbered the section: 33.15 today (refs.json, after P02
    // retired 32.13)
    'epa:marcadores': { 'sec-33.14': { parte: 'cap33', label: 'sec-33.14', num: '33.14', titulo: 'Sección marcada', t: T } },
  });
  await page.goto('/#/instrumentos');
  await expect(page.locator('[data-laboratorio-enlace="1"] .avance')).toHaveText('· completado');
  await page.goto('/#/marcadores');
  await expect(page.locator('a[href="#/cap33/sec-33.14"] .n')).toHaveText('33.15');
});
