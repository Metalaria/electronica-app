// 2.1 «lavado de cara»: the start page of the approved mock-ups (Inicio.png, InicioMovil.png) and the lesson chrome
// (Leccion.png). «Seguir» (the lesson or reading to continue, «Continuar» primary and a quiet second way in), «Hoy»
// (goal and streak: two figures), «Para hoy también» (hairline rows, the ones that apply), «Su curso · …» (the
// course's chapters), no greeting and no book index; desktop, tablet (both orientations) and phone, dark and sepia,
// axe, no horizontal scroll at 360 px. The goal/streak behaviour is in inicio09.spec.ts, «Su curso» against the
// reading in visual.spec.ts.
//   EPA_DIST=/tmp/claude-0/epa-21b/dist EPA_PUERTO=4782 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb nice npx playwright test -c playwright.inicio09.config.ts tests/inicio21.spec.ts
import { expect, test, type Browser, type Page } from '@playwright/test';
import { axe, limpio, asentar, sinHallazgos } from './accesibilidad10-comun';

const ESCRITORIO = { width: 1366, height: 900 };
const MOVIL = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true };

/** Review day key (the day starts at 04:00), k days ago. */
function dia(k: number): string {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  d.setDate(d.getDate() - k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Four days met, one step today; lesson 0.1 left at step 3 of 11 (2 done). */
function enCurso(): Record<string, unknown> {
  const dias: Record<string, unknown> = {};
  for (let k = 1; k <= 4; k++) dias[dia(k)] = { pasos: 3, preguntas: 0, secciones: 0, cumplido: true, t: Date.now() - k * 864e5 };
  dias[dia(0)] = { pasos: 1, preguntas: 0, secciones: 0, cumplido: false, t: Date.now() };
  return {
    'epa:progreso-diario': dias,
    'epa:lecciones': { 'cap00/sec-0.1': { h: [0, 1], u: 2, n: 11, c: 0, t: Date.now() } },
  };
}

async function abrir(page: Page, tema: 'oscuro' | 'sepia', extra: Record<string, unknown> = {}): Promise<void> {
  await limpio(page, tema, extra);
  await page.goto('#/');
  await asentar(page);
  await expect(page.locator('.seguir')).toBeVisible();
}

async function movil(browser: Browser, ancho = 412) {
  const ctx = await browser.newContext({ ...MOVIL, viewport: { width: ancho, height: 915 } });
  return { ctx, page: await ctx.newPage() };
}

test.describe('inicio 2.1: bloques y enlaces', () => {
  test.use({ viewport: ESCRITORIO });

  test('con una lección a medias: «Seguir», «Hoy», «Para hoy también» y «Su curso»', async ({ page }) => {
    await abrir(page, 'oscuro', enCurso());
    // the four section labels of the mock-up, in this order; no greeting, no path of the volume, no shortcuts
    await expect(page.locator('main .etiqueta21')).toHaveText(['Seguir', 'Hoy', 'Para hoy también', 'Su curso · Fundamentos']);
    await expect(page.locator('main')).not.toContainText('Hola');
    await expect(page.locator('section.camino-libro, nav[aria-label="Atajos"], .t09-tarjeta')).toHaveCount(0);

    // «Seguir»: the lesson, «2 de 11 pasos», Continuar → the lesson at its step, «Leer la sección» → the book
    const seguir = page.locator('.seguir');
    await expect(seguir).toHaveAttribute('data-tipo', 'leccion');
    await expect(seguir.locator('h3')).toContainText('0.1');
    await expect(seguir.locator('.det')).toHaveText('2 de 11 pasos');
    await expect(seguir.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '18');
    const continuar = seguir.getByRole('link', { name: 'Continuar' });
    await expect(continuar).toHaveClass(/boton primario/);
    await expect(continuar).toHaveAttribute('href', /^#\/leccion\/cap00\/sec-0\.1/);
    await expect(seguir.getByRole('link', { name: 'Leer la sección' })).toHaveAttribute('href', '#/cap00/sec-0.1');

    // «Hoy»: two figures
    await expect(page.locator('.hoy .objetivo .valor')).toHaveText('1 de 3 pasos');
    await expect(page.locator('.hoy .racha .valor')).toHaveText('4 días seguidos');
    await expect(page.locator('.hoy .racha')).toHaveAttribute('href', '#/progreso');

    // «Para hoy también»: hairline rows, each a link
    const filas = page.locator('.para-hoy a.fila21');
    await expect(page.locator('.para-hoy a.fila21[href="#/problema"]')).toContainText('Problema del día');
    await expect(page.locator('.para-hoy a.repaso-hoy')).toHaveAttribute('href', /^#\/repaso(\/tarjetas)?$/);
    await expect(page.locator('.para-hoy a.fila21[href="#/practicar"]')).toContainText('Práctica inteligente');
    // the course is started: no placement test row
    await expect(page.locator('[data-prueba-nivel-inicio]')).toHaveCount(0);
    expect(await filas.count()).toBeGreaterThanOrEqual(3);
    for (const f of await filas.all()) expect(await f.evaluate((e) => getComputedStyle(e).borderBottomStyle)).toBe('solid');

    // «Su curso · Fundamentos»: its chapters, «Aquí» on chapter 0, «Ver el curso entero»
    const curso = page.locator('section.su-curso');
    await expect(curso.locator('a.capitulo[data-estado="actual"]')).toHaveAttribute('data-parte', 'cap00');
    await expect(curso.locator('a.capitulo[data-estado="actual"] .aqui')).toHaveText(/^Aquí · \d+ secciones$/);
    await expect(curso.getByRole('link', { name: 'Ver el curso entero' })).toHaveAttribute('href', '#/cursos/fundamentos');

    // two columns: the course on the right, at the height of «Seguir»
    const s = (await page.locator('.seguir-bloque').boundingBox())!;
    const c = (await curso.boundingBox())!;
    expect(c.x).toBeGreaterThan(s.x + s.width);
    expect(Math.abs(c.y - s.y)).toBeLessThan(8);

    // the rows lead where they say
    await page.locator('.para-hoy a.fila21[href="#/problema"]').click();
    await expect(page).toHaveURL(/#\/problema$/);
    await page.goBack();
    await page.locator('.hoy .racha').click();
    await expect(page).toHaveURL(/#\/progreso$/);
    // the reading and exercise progress that the start page showed until 2.0 is on «Progreso» now
    await expect(page.locator('.progreso-inicio')).toBeVisible();
  });

  test('sin nada empezado: «Empezar», «Estudiar 0.1 por pasos» y la prueba de nivel', async ({ page }) => {
    await abrir(page, 'sepia');
    const seguir = page.locator('.seguir');
    await expect(seguir).toHaveAttribute('data-tipo', 'empezar');
    await expect(seguir.getByRole('link', { name: 'Empezar' })).toHaveAttribute('href', /^#\/cap00/);
    await expect(seguir.getByRole('link', { name: 'Estudiar 0.1 por pasos' })).toHaveAttribute('href', '#/leccion/cap00/sec-0.1');
    await expect(page.locator('[data-prueba-nivel-inicio]')).toHaveAttribute('href', '#/cursos/fundamentos/prueba');
    // no XP yet: no level row
    await expect(page.locator('a.nivel-inicio')).toHaveCount(0);
    await expect(page.locator('.hoy .racha .valor')).toHaveText('0 días seguidos');
  });
});

test.describe('inicio 2.1: filas que solo salen cuando tocan', () => {
  test.use({ viewport: ESCRITORIO });

  test('«La solución de ayer» solo si se vio el problema de ayer', async ({ page }) => {
    const ayer = { id: 'cap00-num-carga-rc', k: 'practica', parte: 'cap00', semilla: 3, curso: 'fundamentos', t: 1, r: { bien: true, intentos: 1, t: 2 } };
    await abrir(page, 'oscuro', { 'epa:problema-dia': { version: 1, dias: { [dia(1)]: ayer } } });
    await expect(page.locator('[data-problema-inicio="pendiente"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('a[data-problema-ayer-inicio]')).toHaveAttribute('href', '#/problema/ayer');
    // a fresh profile: no row for yesterday
    const otra = await page.context().browser()!.newPage({ viewport: ESCRITORIO });
    await abrir(otra, 'oscuro');
    await expect(otra.locator('[data-problema-inicio="pendiente"]')).toBeVisible({ timeout: 30_000 });
    await expect(otra.locator('a[data-problema-ayer-inicio]')).toHaveCount(0);
    await otra.close();
  });
});

test.describe('inicio 2.1: teléfono, tableta, temas y accesibilidad', () => {
  test('teléfono: el orden del boceto, formas cortas, sin desplazamiento a 360 px', async ({ browser }) => {
    for (const ancho of [412, 360]) {
      const { ctx, page } = await movil(browser, ancho);
      await abrir(page, 'sepia', enCurso());
      // one column: Seguir, Hoy, Para hoy también, then Su curso
      const ys = await page.locator('main .etiqueta21').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().top));
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
      await expect(page.locator('.hoy .objetivo .corto').first()).toBeVisible();
      await expect(page.locator('.hoy .objetivo')).toContainText('pasos hoy');
      await expect(page.locator('.hoy .racha')).toContainText('de racha');
      // the section's visual only on wide screens
      await expect(page.locator('.seguir .imagen')).toBeHidden();
      // «Continuar» across the card
      const card = (await page.locator('.seguir').boundingBox())!;
      const boton = (await page.locator('.seguir .continuar').boundingBox())!;
      expect(boton.width).toBeGreaterThan(card.width - 48);
      const ancho2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(ancho2, `${ancho} px`).toBeLessThanOrEqual(0);
      await ctx.close();
    }
  });

  test('tableta: 800 × 1280 en una columna y 1280 × 800 en dos', async ({ browser }) => {
    for (const [w, h, dos] of [[800, 1280, false], [1280, 800, true]] as const) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      await abrir(page, 'oscuro', enCurso());
      const s = (await page.locator('.seguir-bloque').boundingBox())!;
      const c = (await page.locator('section.su-curso').boundingBox())!;
      if (dos) expect(c.x).toBeGreaterThan(s.x + s.width);
      else expect(c.y).toBeGreaterThan(s.y + s.height);
      // portrait is wide enough for the section's visual beside the text
      await expect(page.locator('.seguir .imagen')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      await ctx.close();
    }
  });

  for (const tema of ['oscuro', 'sepia'] as const) {
    test(`colores del tema ${tema} y axe, escritorio y teléfono`, async ({ browser }) => {
      for (const disp of ['escritorio', 'telefono'] as const) {
        const ctx = disp === 'escritorio' ? await browser.newContext({ viewport: ESCRITORIO }) : await browser.newContext({ ...MOVIL, viewport: { width: 360, height: 780 } });
        const page = await ctx.newPage();
        await abrir(page, tema, enCurso());
        // the card is the theme's panel; «Continuar» the one accent; the current chapter row the accent tint
        const c = await page.evaluate(() => {
          const v = (n: string) => {
            const i = document.createElement('i');
            i.style.color = `var(${n})`;
            document.body.append(i);
            const r = getComputedStyle(i).color;
            i.remove();
            return r;
          };
          return {
            panel: v('--v11-panel'),
            azul: v('--v11-azul'),
            tinte: v('--v11-azul-tinte'),
            tarjeta: getComputedStyle(document.querySelector('.seguir')!).backgroundColor,
            boton: getComputedStyle(document.querySelector('.seguir .continuar')!).backgroundColor,
            aqui: getComputedStyle(document.querySelector('.su-curso a.capitulo.actual')!).backgroundColor,
          };
        });
        expect(c.tarjeta).toBe(c.panel);
        expect(c.boton).toBe(c.azul);
        expect(c.aqui).toBe(c.tinte);
        await page.waitForTimeout(1500);
        sinHallazgos(await axe(page, 'main'), `inicio ${tema} ${disp}`);
        await ctx.close();
      }
    });
  }
});

test.describe('lección 2.1: barra mínima', () => {
  for (const tema of ['oscuro', 'sepia'] as const) {
    test(`una barra continua con «n / N», etiqueta del paso y «Comprobar» (${tema})`, async ({ browser }) => {
      for (const disp of ['escritorio', 'telefono'] as const) {
        const ctx = disp === 'escritorio' ? await browser.newContext({ viewport: ESCRITORIO }) : await browser.newContext({ ...MOVIL, viewport: { width: 360, height: 780 } });
        const page = await ctx.newPage();
        await limpio(page, tema);
        await page.goto('#/leccion/cap01/sec-1.4/2');
        await expect(page.locator('[data-leccion11]')).toBeVisible();
        await expect(page.locator('.cab [data-cuenta-leccion]')).toHaveText(/^\d+ \/ \d+$/);
        await expect(page.locator('.cab [role="progressbar"]')).toBeVisible();
        // the segments touch: one continuous bar
        expect(await page.locator('.cab .segmentos').evaluate((e) => getComputedStyle(e).columnGap)).toMatch(/^(normal|0px)$/);
        // the label is only the step's kind (the count is in the bar)
        await expect(page.locator('.pantalla .etiqueta')).not.toHaveText(/\d+ de \d+/);
        // the lesson is full screen: no rail, no bottom bar, no header
        await expect(page.locator('nav.carril, nav.pestanas, header.barra')).toHaveCount(0);
        const col = (await page.locator('.hoja').boundingBox())!;
        expect(col.width).toBeLessThanOrEqual(720);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.waitForTimeout(800);
        sinHallazgos(await axe(page, '.l11'), `lección ${tema} ${disp}`);
        await ctx.close();
      }
    });
  }
});

// 2.1 close-out (theme sweep, light theme): a won achievement sits on the 2.1 panel tint now (2.0: white), and its
// «Conseguido el …» in the example colour fell to 4.28:1
test('Progreso: el «Conseguido el …» de un logro se lee en claro, sepia y oscuro (axe, contraste)', async ({ browser }) => {
  for (const tema of ['claro', 'sepia', 'oscuro'] as const) {
    const ctx = await browser.newContext({ viewport: ESCRITORIO, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
    const page = await ctx.newPage();
    await limpio(page, tema, { 'epa:progreso-xp': { version: 1, xp: {}, logros: { 'primer-acierto': Date.now() - 3600e3 } } });
    await page.goto('#/progreso');
    await expect(page.locator('.logro .cuando').first()).toBeVisible({ timeout: 30_000 });
    await asentar(page);
    sinHallazgos(await axe(page, '.logros'), `logros · ${tema}`);
    await ctx.close();
  }
});
