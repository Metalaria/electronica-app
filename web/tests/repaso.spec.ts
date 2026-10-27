// «Repaso» end to end: glossary flashcards (answer, scheduling, undo, kept after a reload), a quiz run
// with feedback, the book's quote and the final score, the review of mistakes, the «Test del capítulo»
// button of the reader and the mixed exam; screenshots (phone, 1280 × 800 at DPR 2, tablet portrait;
// light and dark) into tests/capturas/.
import { expect, test, type Page } from '@playwright/test';

interface PreguntaJson {
  id: string;
  tipo: 'opcion' | 'numero';
  opciones?: string[];
  correcta?: number;
  valor_texto?: string;
  cita: string;
}

async function tema(page: Page, t: 'claro' | 'oscuro'): Promise<void> {
  await page.addInitScript((x) => {
    try {
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: x, tam: 18 }));
    } catch {
      /* private mode */
    }
  }, t);
}

function leer<T>(page: Page, clave: string): Promise<T | null> {
  return page.evaluate((k) => {
    const v = localStorage.getItem(`epa:${k}`);
    return v ? JSON.parse(v) : null;
  }, clave);
}

/** Plain text of an option as the button shows it. */
function plano(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function preguntas(page: Page, parte: string): Promise<Map<string, PreguntaJson>> {
  const r = await page.request.get(`libro/repaso/${parte}.json`);
  expect(r.ok()).toBe(true);
  const d = (await r.json()) as { preguntas: PreguntaJson[] };
  return new Map(d.preguntas.map((p) => [p.id, p]));
}

/** Answers the question on screen: right, or deliberately wrong. */
async function contestar(page: Page, banco: Map<string, PreguntaJson>, bien: boolean): Promise<PreguntaJson> {
  const caja = page.locator('[data-pregunta]');
  await expect(caja).toBeVisible();
  const id = (await caja.getAttribute('data-pregunta'))!;
  const p = banco.get(id)!;
  expect(p, `pregunta ${id}`).toBeTruthy();
  if (p.tipo === 'opcion') {
    const correcta = plano(p.opciones![p.correcta!]);
    const botones = caja.locator('button.opcion');
    const n = await botones.count();
    let elegida = -1;
    for (let k = 0; k < n; k++) {
      const txt = ((await botones.nth(k).locator('.txt').textContent()) ?? '').replace(/\s+/g, ' ').trim();
      if ((txt === correcta) === bien) {
        elegida = k;
        break;
      }
    }
    expect(elegida).toBeGreaterThanOrEqual(0);
    await botones.nth(elegida).click();
  } else {
    await caja.locator('[data-numero]').fill(bien ? p.valor_texto! : '98765');
    await caja.locator('[data-numero]').press('Enter');
  }
  await expect(caja.locator('[data-feedback]')).toHaveAttribute('data-feedback', bien ? 'bien' : 'mal');
  return p;
}

test('tarjetas: respuesta, programación, deshacer y todo guardado tras recargar', async ({ page }) => {
  await page.goto('#/repaso');
  await expect(page.locator('[data-para-hoy]')).toHaveText('15'); // 15 new cards a day by default
  await expect(page.locator('[data-aprendidas]')).toHaveText('0');
  await page.locator('[data-empezar]').click();
  await expect(page).toHaveURL(/#\/repaso\/tarjetas$/);

  // A new card: space turns it, the four buttons tell when it would come back
  const carta = page.locator('[data-tarjeta]');
  await expect(carta).toBeVisible();
  const id1 = (await carta.getAttribute('data-tarjeta'))!;
  await expect(carta.locator('.chip.nueva')).toBeVisible();
  await page.keyboard.press(' ');
  await expect(carta.locator('[data-reverso]')).toBeVisible();
  await expect(carta.locator('.ver a').first()).toHaveAttribute('href', /^#\//);
  await expect(page.locator('[data-calificar="1"] .esp')).toHaveText('1 min');
  await expect(page.locator('[data-calificar="3"] .esp')).toHaveText('10 min');
  await expect(page.locator('[data-calificar="4"] .esp')).toHaveText('4 d');

  // «Fácil» (key 4) graduates it straight away with four days
  await page.keyboard.press('4');
  await expect(carta).not.toHaveAttribute('data-tarjeta', id1);
  const id2 = (await carta.getAttribute('data-tarjeta'))!;

  // «Otra vez» with the button, then undo, then «Bien» (key 3): the second learning step (10 min)
  await page.locator('[data-mostrar]').click();
  await page.locator('[data-calificar="1"]').click();
  await expect(carta).not.toHaveAttribute('data-tarjeta', id2);
  await page.locator('[data-deshacer]').click();
  await expect(carta).toHaveAttribute('data-tarjeta', id2);
  await expect(carta.locator('[data-reverso]')).toBeVisible();
  await page.keyboard.press('3');
  await expect(carta).not.toHaveAttribute('data-tarjeta', id2);
  await expect(page.locator('[data-cuenta] .c-nueva')).toHaveText('13');

  // Stored (debounced writes)
  await expect
    .poll(async () => Object.keys((await leer<Record<string, unknown>>(page, 'repaso-tarjetas')) ?? {}).sort())
    .toEqual([id1, id2].sort());
  type Est = { e: string; p: number; i: number; v: number; f: number; n: number };
  const est = (await leer<Record<string, Est>>(page, 'repaso-tarjetas'))!;
  expect(est[id1]!.e).toBe('r');
  expect(est[id1]!.i).toBe(4);
  expect(est[id1]!.v - Date.now()).toBeGreaterThan(2.5 * 86_400_000);
  expect(est[id2]!.e).toBe('a');
  expect(est[id2]!.p).toBe(1);
  expect(est[id2]!.n).toBe(1); // the undone answer does not count
  expect(Math.round((est[id2]!.v - Date.now()) / 60_000)).toBe(10);

  // After a reload the home page shows the same progress
  await page.reload();
  await page.goto('#/repaso');
  await expect(page.locator('[data-aprendidas]')).toHaveText('1');
  await expect(page.locator('[data-cifras]')).toContainText('2 respuestas hoy');
  await expect(page.locator('[data-cifras]')).toContainText('1 día seguido');
  await expect(page.locator('[data-cifras] .c-nueva')).toHaveText('13');
  const est2 = (await leer<Record<string, Est>>(page, 'repaso-tarjetas'))!;
  expect(est2[id1]).toEqual(est[id1]);

  // Neither comes back yet: the graduated one is due in four days, the learning one in ten minutes
  await page.locator('[data-empezar]').click();
  await expect(carta).toBeVisible();
  const siguiente = await carta.getAttribute('data-tarjeta');
  expect([id1, id2]).not.toContain(siguiente);
  await expect(carta.locator('.chip.nueva')).toBeVisible();

  // Settings are kept too
  await page.goto('#/repaso');
  await page.getByRole('button', { name: 'Más nuevas al día' }).click();
  await expect(page.locator('[data-nuevas-dia]')).toHaveText('20');
  await expect.poll(async () => (await leer<{ nuevasDia: number }>(page, 'repaso-ajustes'))?.nuevasDia).toBe(20);
  await page.reload();
  await expect(page.locator('[data-nuevas-dia]')).toHaveText('20');
});

test('test de un apéndice: corrección inmediata, cita del libro, resultado y fallos para repasar', async ({ page }) => {
  const banco = await preguntas(page, 'apC');
  await page.goto('#/repaso');
  await page.locator('[data-test="apC"]').click();
  await expect(page).toHaveURL(/#\/repaso\/test\/apC$/);
  await expect(page.locator('.progreso')).toContainText(`Pregunta 1 de ${banco.size}`);

  // First answer wrong: red, the right one marked, the explanation and the quote with its link
  const primera = await contestar(page, banco, false);
  const fb = page.locator('[data-feedback]');
  await expect(fb).toContainText('No es correcto');
  await expect(fb.locator('blockquote')).toContainText(primera.cita.slice(0, 18));
  // 0.9: the shared question component (componentes/pregunta) puts «Ver la sección …» in the footer
  await expect(page.locator('[data-ver-seccion]')).toHaveText(/^Ver (la sección|el problema|el apartado|en el libro)/);
  await expect(page.locator('[data-ver-seccion]')).toHaveAttribute('href', /^#\/apC/);
  if (primera.tipo === 'opcion') await expect(page.locator('button.opcion[data-correcta="true"]')).toHaveCount(1);
  else await expect(fb).toContainText('el libro da');
  await page.keyboard.press('Enter');

  // The rest right
  for (let k = 2; k <= banco.size; k++) {
    await expect(page.locator('.progreso')).toContainText(`Pregunta ${k} de ${banco.size}`);
    await contestar(page, banco, true);
    await expect(page.locator('[data-feedback]')).toContainText('Correcto');
    await page.locator('[data-siguiente]').click();
  }

  const final = page.locator('[data-final]');
  await expect(final).toBeVisible();
  await expect(final).toHaveAttribute('data-aciertos', String(banco.size - 1));
  await expect(final).toHaveAttribute('data-total', String(banco.size));
  await expect(final.locator('.fallos li')).toHaveCount(1);

  await expect.poll(async () => Object.keys((await leer<Record<string, unknown>>(page, 'repaso-fallos')) ?? {})).toEqual([primera.id]);
  await expect.poll(async () => (await leer<Record<string, { mejor: number }>>(page, 'repaso-tests'))?.apC?.mejor).toBeCloseTo((banco.size - 1) / banco.size, 5);

  // After a reload: the score on the home page, and the mistake in «Repasar fallos»
  await page.reload();
  await page.goto('#/repaso');
  await expect(page.locator('[data-test="apC"] .nota')).toContainText(`${Math.round(((banco.size - 1) / banco.size) * 100)} %`);
  await expect(page.locator('[data-repasar] .cuenta')).toHaveText('1');
  await page.locator('[data-repasar]').click();
  await expect(page.locator('[data-pregunta]')).toHaveAttribute('data-pregunta', primera.id);
  await contestar(page, banco, true);
  await expect.poll(async () => Object.keys((await leer<Record<string, unknown>>(page, 'repaso-fallos')) ?? {})).toEqual([]);
});

test('el botón «Test del capítulo» al final de un capítulo abre su test', async ({ page }) => {
  await page.goto('#/cap05');
  const boton = page.locator('[data-test-capitulo]');
  await boton.scrollIntoViewIfNeeded();
  await expect(boton).toBeVisible();
  const caja = await boton.boundingBox();
  expect(caja!.height).toBeGreaterThanOrEqual(44);
  await boton.click();
  await expect(page).toHaveURL(/#\/repaso\/test\/cap05$/);
  await expect(page.locator('[data-pregunta]')).toBeVisible();
  await expect(page.locator('h1')).toContainText('Test');
});

test('examen mixto de dos capítulos', async ({ page }) => {
  const banco = new Map([...(await preguntas(page, 'cap01')), ...(await preguntas(page, 'apA'))]);
  await page.goto('#/repaso/examen');
  await page.locator('[data-elegir="cap01"]').click();
  await page.locator('[data-elegir="apA"]').click();
  await page.getByRole('group', { name: 'Número de preguntas' }).getByRole('button', { name: '10', exact: true }).click();
  await page.locator('[data-empezar-examen]').click();
  await expect(page.locator('.progreso')).toContainText('Pregunta 1 de 10');
  for (let k = 1; k <= 10; k++) {
    await contestar(page, banco, true);
    await page.locator('[data-siguiente]').click();
  }
  await expect(page.locator('[data-final]')).toHaveAttribute('data-aciertos', '10');
  await expect.poll(async () => (await leer<{ aciertos: number }[]>(page, 'repaso-examenes'))?.[0]?.aciertos).toBe(10);
});

// ------------------------------------------------------------------ screenshots

const TAMANOS = [
  { nombre: 'movil', w: 390, h: 844, dpr: 3, tactil: true },
  { nombre: 'portatil', w: 1280, h: 800, dpr: 2, tactil: false },
  { nombre: 'tableta-vertical', w: 800, h: 1280, dpr: 2, tactil: true },
];

for (const t of TAMANOS) {
  for (const modo of ['claro', 'oscuro'] as const) {
    test(`capturas ${t.nombre} ${modo}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: t.dpr, hasTouch: t.tactil });
      const page = await ctx.newPage();
      await tema(page, modo);
      const base = `tests/capturas/repaso-${t.nombre}-${modo}`;

      // Some real progress: six cards answered
      await page.goto('#/repaso/tarjetas');
      for (const c of ['3', '4', '1', '3', '2', '4']) {
        await page.locator('[data-mostrar]').click();
        await page.keyboard.press(c);
      }
      // a card turned
      await page.locator('[data-mostrar]').click();
      await expect(page.locator('[data-reverso]')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${base}-tarjeta.png` });

      // a quiz question with its feedback
      const banco = await preguntas(page, 'cap05');
      await page.goto('#/repaso/test/cap05');
      await contestar(page, banco, false);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${base}-pregunta.png` });
      await page.keyboard.press('Enter');
      for (let k = 2; k <= banco.size; k++) {
        await contestar(page, banco, k % 4 !== 0);
        await page.locator('[data-siguiente]').click();
      }
      await expect(page.locator('[data-final]')).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${base}-resultado.png` });

      // the home page with the progress
      await page.goto('#/repaso');
      await expect(page.locator('[data-aprendidas]')).not.toHaveText('0');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${base}-portada.png` });
      await page.locator('#tit-tests').scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -20));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${base}-tests.png` });

      // the mixed exam chooser
      await page.goto('#/repaso/examen');
      await page.locator('[data-elegir="cap05"]').click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${base}-examen.png` });

      // the button at the end of a chapter
      await page.goto('#/cap48');
      const boton = page.locator('[data-test-capitulo]');
      // The reader fills in figures as they come into view: go to the end until the height settles
      for (let k = 0; k < 8; k++) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(300);
      }
      await boton.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(800);
      await boton.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${base}-boton.png` });
      await ctx.close();
    });
  }
}
