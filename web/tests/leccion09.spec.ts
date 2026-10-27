// 0.9 «Estudiar por pasos»: the automatic steps over every section of the book (Node), the lesson of 5.2 from
// the reader's button to the summary (steps by subsection, live figures, keys, a numeric question answered wrong
// and retried, progress stored, section marked read, next lesson, Back leaving the lesson), a section without
// subsections (5.8), a live schematic (5.3) and the reload / close behaviour.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.leccion09.config.ts tests/leccion09.spec.ts
// Screenshots: node tests/leccion09-capturas.mjs (tests/capturas/lavado09/leccion/).
import { readFileSync, readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { calcularPasos, finDeSeccion } from '../src/lib/leccion-pasos.ts';
import type { Bloque, Indice } from '../src/lib/tipos.ts';

const LIBRO = new URL('../public/libro/', import.meta.url);
const leerJson = <T>(ruta: string): T => JSON.parse(readFileSync(new URL(ruta, LIBRO), 'utf8')) as T;

function bloquesDe(parte: string): Bloque[] {
  return leerJson<{ bloques: Bloque[] }>(`partes/${parte}.json`).bloques;
}

function pasosDe(parte: string, label: string) {
  const bl = bloquesDe(parte);
  const h2 = bl.findIndex((b) => b.t === 'h2' && b.label === label);
  return calcularPasos(bl, h2);
}

interface PreguntaJson {
  id: string;
  tipo: 'opcion' | 'numero';
  opciones?: string[];
  correcta?: number;
  valor_texto?: string;
  ref: string;
}

function plano(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function leer<T>(page: Page, clave: string): Promise<T | null> {
  return page.evaluate((k) => {
    const v = localStorage.getItem(`epa:${k}`);
    return v ? JSON.parse(v) : null;
  }, clave);
}

/** Answers the question on screen, right or wrong. */
async function contestar(page: Page, banco: Map<string, PreguntaJson>, bien: boolean): Promise<PreguntaJson> {
  const caja = page.locator('[data-pregunta]');
  await expect(caja).toBeVisible();
  const p = banco.get((await caja.getAttribute('data-pregunta'))!)!;
  if (p.tipo === 'opcion') {
    const correcta = plano(p.opciones![p.correcta!]!);
    const botones = caja.locator('button.opcion');
    const n = await botones.count();
    for (let k = 0; k < n; k++) {
      const txt = ((await botones.nth(k).locator('.txt').textContent()) ?? '').replace(/\s+/g, ' ').trim();
      if ((txt === correcta) === bien) {
        await botones.nth(k).click();
        break;
      }
    }
  } else {
    await caja.locator('[data-numero]').fill(bien ? p.valor_texto! : '98765');
    await caja.locator('[data-numero]').press('Enter');
  }
  await expect(caja.locator('[data-feedback]')).toHaveAttribute('data-feedback', bien ? 'bien' : 'mal');
  return p;
}

test('los pasos automáticos cubren todas las secciones del libro', () => {
  const indice = leerJson<Indice>('indice.json');
  let secciones = 0;
  let sinH3 = 0;
  // Problems collected and checked at the end (one expect per block would take a minute).
  const fallos: string[] = [];
  for (const parte of Object.keys(indice.partes)) {
    const bl = bloquesDe(parte);
    bl.forEach((b, h2) => {
      if (b.t !== 'h2') return;
      secciones++;
      const id = `${parte} ${b.label}`;
      const pasos = calcularPasos(bl, h2);
      const fin = finDeSeccion(bl, h2);
      if (!pasos.length) fallos.push(`${id}: sin pasos`);
      // Every block of the section is in exactly one step, except the headings that became step titles.
      const vistos = new Set<number>();
      for (const p of pasos) {
        if (!p.titulo) fallos.push(`${id}: paso sin título`);
        for (let i = p.desde; i < p.hasta; i++) {
          if (vistos.has(i)) fallos.push(`${id}: bloque ${i} repetido`);
          vistos.add(i);
        }
      }
      for (let i = h2 + 1; i < fin; i++) if (!vistos.has(i) && !['h3', 'h4'].includes(bl[i]!.t)) fallos.push(`${id}: falta el bloque ${i}`);
      const h3 = bl.slice(h2 + 1, fin).filter((x) => x.t === 'h3').length;
      if (!h3) sinH3++;
      // «Por subapartados»: one step per h3 (a very long one may add «continuación» steps).
      else if (pasos.filter((p) => p.tipo === 'sub').length !== h3) fallos.push(`${id}: ${h3} h3 y otros tantos pasos no`);
    });
  }
  expect(fallos).toEqual([]);
  expect(secciones).toBeGreaterThan(740);
  expect(sinH3).toBeGreaterThan(90);
  // 5.2: one step per subsection, plus the introduction if the section has text before its first h3.
  const bl = bloquesDe('cap05');
  const h2 = bl.findIndex((b) => b.label === 'sec-5.2');
  const h3 = bl.slice(h2 + 1, finDeSeccion(bl, h2)).filter((x) => x.t === 'h3').length;
  expect(pasosDe('cap05', 'sec-5.2').length).toBeGreaterThanOrEqual(h3);
  // 5.8 has no h3: split into a few screens of its own text.
  expect(pasosDe('cap05', 'sec-5.8').length).toBeGreaterThan(1);
});

test('lección de 5.2: del botón del lector al resumen, con figuras vivas, teclas y pregunta numérica', async ({ page }) => {
  const pasos = pasosDe('cap05', 'sec-5.2');
  const repaso = leerJson<{ preguntas: PreguntaJson[] }>('repaso/cap05.json').preguntas;
  const bl = bloquesDe('cap05');
  const h2 = bl.findIndex((b) => b.label === 'sec-5.2');
  const dentro = new Set(bl.slice(h2, finDeSeccion(bl, h2)).map((b) => b.label).filter(Boolean));
  const suyas = repaso.filter((p) => dentro.has(p.ref));
  expect(suyas.some((p) => p.tipo === 'numero')).toBe(true);
  const banco = new Map(suyas.map((p) => [p.id, p]));
  const n = pasos.length;
  const total = n + suyas.length;

  // The discreet button at the end of the section title
  await page.goto('#/cap05/sec-5.2');
  const boton = page.locator('h2#sec-5\\.2 [data-por-pasos]');
  await expect(boton).toBeVisible();
  await expect(boton).toHaveAttribute('href', '#/leccion/cap05/sec-5.2');
  const caja = (await boton.boundingBox())!;
  const titulo = (await page.locator('h2#sec-5\\.2').boundingBox())!;
  expect(caja.height).toBeLessThanOrEqual(32);
  expect(caja.y).toBeGreaterThanOrEqual(titulo.y - 8);
  await boton.click();
  await expect(page).toHaveURL(/#\/leccion\/cap05\/sec-5\.2$/);

  // Full screen: no rail, no index, no top bar
  const leccion = page.locator('[data-leccion="cap05/sec-5.2"]');
  await expect(leccion).toBeVisible();
  await expect(page.locator('.cab-pasos .cuenta')).toHaveText(`1/${total}`);
  await expect(page.locator('.cab-pasos .contexto')).toContainText('Capítulo 5 · Diodos · 5.2');
  await expect(leccion.locator('h1')).toHaveText(pasos[0]!.titulo);
  await expect(page.locator('[data-atras]')).toBeDisabled();

  // Keys: → forward, ← back; each screen replaces the URL (one history entry)
  await page.keyboard.press('ArrowRight');
  await expect(leccion).toHaveAttribute('data-pantalla', '1');
  await expect(page).toHaveURL(/#\/leccion\/cap05\/sec-5\.2\/2$/);
  await expect(leccion.locator('h1')).toHaveText(pasos[1]!.titulo);
  await page.keyboard.press('ArrowLeft');
  await expect(leccion).toHaveAttribute('data-pantalla', '0');

  // Through the steps with «Continuar»; the live plots of 5.2 work inside the lesson
  let vivas = 0;
  for (let k = 0; k < n; k++) {
    await expect(leccion).toHaveAttribute('data-pantalla', String(k));
    const figs = leccion.locator('figure#fig-5\\.5, figure#fig-5\\.6');
    for (let f = 0; f < (await figs.count()); f++) {
      await figs.nth(f).scrollIntoViewIfNeeded();
      await expect(figs.nth(f).locator('.viva.lista')).toBeVisible();
      vivas++;
    }
    await page.locator('[data-continuar]').click();
  }
  expect(vivas).toBe(2);

  // The questions about 5.2, one per screen
  for (let q = 0; q < suyas.length; q++) {
    await expect(page.locator('.cab-pasos .cuenta')).toHaveText(`${n + q + 1}/${total}`);
    await expect(page.locator('[data-continuar]')).toBeDisabled();
    const id = await page.locator('[data-pregunta]').getAttribute('data-pregunta');
    const p = banco.get(id!)!;
    if (p.tipo === 'numero') {
      // Wrong first: red, with the book's value, the quote and «Ver la sección 5.2»; then «Probar otra vez»
      await contestar(page, banco, false);
      const fb = page.locator('[data-feedback]');
      await expect(fb).toContainText('No es correcto');
      await expect(fb).toContainText('el libro da');
      await expect(fb.locator('blockquote')).toContainText('Del libro · Sección 5.2', { ignoreCase: true });
      await expect(page.locator('[data-ver-seccion]')).toHaveText('Ver la sección 5.2');
      await expect(page.locator('[data-ver-seccion]')).toHaveAttribute('href', /^#\/cap05\/sec-5\.2/);
      await page.locator('[data-reintentar]').click();
      await expect(page.locator('[data-feedback]')).toHaveCount(0);
      await expect(page.locator('[data-numero]')).toBeEnabled();
    }
    await contestar(page, banco, true);
    await expect(page.locator('[data-feedback]')).toContainText('Correcto');
    await page.keyboard.press('Enter');
  }

  // Summary: completed, marked as read, progress stored, steps counted for the day
  const resumen = page.locator('[data-resumen]');
  await expect(resumen).toBeVisible();
  await expect(resumen.locator('h1')).toHaveText('Sección completada');
  await expect(page).toHaveURL(/#\/leccion\/cap05\/sec-5\.2\/fin$/);
  await expect.poll(async () => (await leer<Record<string, { c: number; h: number[] }>>(page, 'lecciones'))?.['cap05/sec-5.2']?.c ?? 0).toBeGreaterThan(0);
  await expect.poll(async () => (await leer<Record<string, Record<string, number>>>(page, 'leidas'))?.cap05?.['sec-5.2'] ?? 0).toBeGreaterThan(0);
  await expect
    .poll(async () => Object.values((await leer<Record<string, { pasos?: number; preguntas?: number }>>(page, 'progreso-diario')) ?? {}).reduce((s, d) => s + (d.pasos ?? 0), 0))
    .toBeGreaterThanOrEqual(n);

  // Next section's lesson, then Back leaves the lessons for the reader
  await page.locator('[data-siguiente-leccion]').click();
  await expect(page).toHaveURL(/#\/leccion\/cap05\/sec-5\.3$/);
  await expect(page.locator('[data-leccion="cap05/sec-5.3"]')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/cap05\/sec-5\.2$/);
  await expect(page.locator('h2#sec-5\\.2')).toBeVisible();
});

test('sección sin subapartados (5.8): pasos automáticos, recarga en un paso y cierre', async ({ page }) => {
  const pasos = pasosDe('cap05', 'sec-5.8');
  expect(pasos.every((p) => p.tipo === 'parte')).toBe(true);
  await page.goto('#/leccion/cap05/sec-5.8/2');
  const leccion = page.locator('[data-leccion="cap05/sec-5.8"]');
  await expect(leccion).toHaveAttribute('data-pantalla', '1');
  await expect(leccion.locator('[data-paso="1"]')).toContainText('Paso 2');
  await expect(leccion.locator('h1')).toHaveText(pasos[1]!.titulo);
  // Reload: the same screen
  await page.reload();
  await expect(page.locator('[data-leccion="cap05/sec-5.8"]')).toHaveAttribute('data-pantalla', '1');
  await expect.poll(async () => (await leer<Record<string, { u: number }>>(page, 'lecciones'))?.['cap05/sec-5.8']?.u).toBe(1);
  // Opened as the first page: the close button opens the section in the reader
  await page.locator('[data-cerrar]').click();
  await expect(page).toHaveURL(/#\/cap05\/sec-5\.8$/);
  await expect(page.locator('h2#sec-5\\.8')).toBeVisible();
});

test('esquema vivo dentro de una lección (5.3)', async ({ page }) => {
  const pasos = pasosDe('cap05', 'sec-5.3');
  const bl = bloquesDe('cap05');
  const k = pasos.findIndex((p) => bl.slice(p.desde, p.hasta).some((b) => b.label === 'fig-5.8'));
  expect(k).toBeGreaterThanOrEqual(0);
  await page.goto(`#/leccion/cap05/sec-5.3/${k + 1}`);
  const fig = page.locator('[data-leccion="cap05/sec-5.3"] figure#fig-5\\.8');
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator('.viva.lista')).toBeVisible();
  await expect(page.locator('[data-leccion="cap05/sec-5.3"]')).toHaveAttribute('data-pantalla', String(k));
});

test('el resto del libro: una lección de un apéndice y de una sección de un capítulo largo abren', async ({ page }) => {
  const indice = leerJson<Indice>('indice.json');
  const casos = [
    ['apA', indice.partes.apA?.secciones?.[0]?.label],
    ['cap53', 'sec-53.7'],
  ] as const;
  for (const [parte, label] of casos) {
    expect(label).toBeTruthy();
    await page.goto(`#/leccion/${parte}/${label}`);
    const total = pasosDe(parte, label!).length;
    await expect(page.locator(`[data-leccion="${parte}/${label}"] h1`)).toBeVisible();
    await expect(page.locator('.cab-pasos .cuenta')).toHaveText(new RegExp(`^1/(${total}|\\d+)$`));
  }
});

test('las preguntas de Repaso usan el componente compartido', async ({ page }) => {
  const repaso = new Map(leerJson<{ preguntas: PreguntaJson[] }>('repaso/cap05.json').preguntas.map((p) => [p.id, p]));
  await page.goto('#/repaso/test/cap05');
  await expect(page.locator('.progreso')).toContainText(`Pregunta 1 de ${repaso.size}`);
  await expect(page.locator('.cab-pasos .cuenta')).toHaveText(`1/${repaso.size}`);
  await contestar(page, repaso, false);
  await expect(page.locator('[data-feedback] .veredicto')).toContainText('No es correcto');
  await expect(page.locator('[data-ver-seccion]')).toHaveText(/^Ver (la sección|el problema|el apartado) /);
  await page.locator('[data-reintentar]').click();
  await contestar(page, repaso, true);
  // Only the first answer counts: still a mistake to review
  await expect.poll(async () => Object.keys((await leer<Record<string, unknown>>(page, 'repaso-fallos')) ?? {}).length).toBe(1);
  await page.locator('[data-siguiente]').click();
  await expect(page.locator('.cab-pasos .cuenta')).toHaveText(`2/${repaso.size}`);
});

// Every file under public/libro/partes is a part of the index (guards the coverage test above).
test('todas las partes del índice tienen su JSON', () => {
  const indice = leerJson<Indice>('indice.json');
  const ficheros = new Set(readdirSync(new URL('partes/', LIBRO)).map((f) => f.replace(/\.json$/, '')));
  for (const p of Object.keys(indice.partes)) expect(ficheros.has(p), p).toBe(true);
});
