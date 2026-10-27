// 0.9 start page and shared look: daily progress and streak (lib/progreso-diario.svelte.ts), the goal and the
// name in «Aa», the tab bar with «Inicio», the two-column / one-column layout and 4.5:1 text contrast in the
// three themes (the path of chapters and «Seguir leyendo» are in tests/visual.spec.ts).
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.inicio09.config.ts tests/inicio09.spec.ts tests/visual.spec.ts tests/navegacion.spec.ts
import { expect, test, type Page } from '@playwright/test';

const MAC = { width: 1280, height: 800 };
const TABLETA = { width: 800, height: 1280 };
const MOVIL = { width: 412, height: 915 };

/** Review day key (the day starts at 04:00), k days ago. */
function dia(k: number): string {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  d.setDate(d.getDate() - k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Three days met before today, two steps today (goal: three steps). */
async function sembrar(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  const dias: Record<string, unknown> = {};
  for (let k = 1; k <= 3; k++) dias[dia(k)] = { pasos: 3, preguntas: 0, secciones: 0, cumplido: true, t: Date.now() - k * 864e5 };
  dias[dia(0)] = { pasos: 2, preguntas: 0, secciones: 0, cumplido: false, t: Date.now() };
  await page.addInitScript(
    ([d, e]) => {
      if (sessionStorage.getItem('sembrado')) return;
      sessionStorage.setItem('sembrado', '1');
      localStorage.setItem('epa:progreso-diario', JSON.stringify(d));
      localStorage.setItem('epa:posiciones', JSON.stringify({ cap05: { b: 0, sec: 'sec-5.3', t: Date.now() } }));
      for (const [k, v] of Object.entries(e)) localStorage.setItem(`epa:${k}`, JSON.stringify(v));
    },
    [dias, extra] as const,
  );
}

const leer = <T>(page: Page, clave: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(`epa:${k}`) ?? 'null'), clave) as Promise<T>;

async function abrirAjustes(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Tema y tamaño de letra' })).toBeVisible();
}

test.describe('progreso diario y racha', () => {
  test.use({ viewport: MAC });

  test('racha, anillo del objetivo y su cambio en «Aa»', async ({ page }) => {
    await sembrar(page);
    await page.goto('#/');
    const racha = page.locator('section.racha');
    await expect(racha).toHaveAttribute('data-racha', '3');
    await expect(racha.locator('h2')).toHaveText('3 días');
    await expect(racha).toContainText('Hoy te falta un paso para el cuarto.');
    await expect(racha.locator('.semana li')).toHaveCount(7);
    await expect(racha.locator('.semana li.hecho')).toHaveCount(3);
    await expect(racha.locator('.semana li.hoy')).not.toHaveClass(/hecho/);
    const objetivo = page.locator('section.objetivo');
    await expect(objetivo.locator('.cuenta')).toHaveText('2/3');
    await expect(objetivo).toContainText('3 pasos de lección');

    // a goal of two steps: today is met, the streak grows to four
    await abrirAjustes(page);
    await page.getByRole('button', { name: 'Objetivo más pequeño' }).click();
    await expect(page.locator('#cantidad-objetivo')).toHaveText(/2 pasos al día/);
    await expect(objetivo.locator('.cuenta')).toHaveText('2/2');
    await expect(objetivo).toHaveClass(/cumplido/);
    await expect(racha).toHaveAttribute('data-racha', '4');
    await expect(racha.locator('.semana li.hoy')).toHaveClass(/hecho/);
    await expect.poll(() => leer<{ tipo: string; cantidad: number }>(page, 'progreso-objetivo')).toMatchObject({ tipo: 'pasos', cantidad: 2 });
    await expect.poll(async () => (await leer<Record<string, { cumplido: boolean }>>(page, 'progreso-diario'))[dia(0)]?.cumplido).toBe(true);

    // review questions instead: none answered today, the streak is back to three (today still open)
    await page.getByRole('radio', { name: 'Preguntas de repaso' }).click();
    await expect(objetivo.locator('.cuenta')).toHaveText('0/2');
    await expect(racha).toHaveAttribute('data-racha', '3');
    // past days keep their verdict
    await expect(racha.locator('.semana li.hecho')).toHaveCount(3);

    // after a reload everything is still there
    await page.reload();
    await expect(page.locator('section.objetivo .cuenta')).toHaveText('0/2');
    await expect(page.locator('section.objetivo')).toContainText('2 preguntas de repaso');
  });

  test('las respuestas del repaso y las secciones leídas cuentan para hoy', async ({ page }) => {
    await sembrar(page, { 'progreso-objetivo': { tipo: 'preguntas', cantidad: 1, t: Date.now() } });
    await page.goto('#/');
    await expect(page.locator('section.objetivo .cuenta')).toHaveText('0/1');
    await expect(page.locator('section.racha')).toHaveAttribute('data-racha', '3');

    // one flashcard answered («Fácil»)
    await page.goto('#/repaso/tarjetas');
    await expect(page.locator('[data-tarjeta]')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.locator('[data-reverso]')).toBeVisible();
    await page.keyboard.press('4');
    await expect.poll(async () => (await leer<Record<string, { preguntas: number }>>(page, 'progreso-diario'))[dia(0)]?.preguntas).toBe(1);

    // a section marked as read
    await page.goto('#/cap01/sec-1.3');
    const boton = page.locator('.seccion-cab:has(#sec-1\\.3) button.leida');
    await expect(boton).toBeVisible();
    await boton.click();
    await expect.poll(async () => (await leer<Record<string, { secciones: number }>>(page, 'progreso-diario'))[dia(0)]?.secciones).toBe(1);

    await page.goto('#/');
    await expect(page.locator('section.objetivo .cuenta')).toHaveText('1/1');
    await expect(page.locator('section.racha')).toHaveAttribute('data-racha', '4');
    await expect(page.locator('section.racha')).toContainText('Objetivo de hoy cumplido');
  });

  test('con un objetivo de pasos, cada sección leída cuenta como un paso (opción de «Aa»)', async ({ page }) => {
    await sembrar(page, { 'progreso-objetivo': { tipo: 'pasos', cantidad: 3, t: Date.now() } });
    await page.goto('#/cap01/sec-1.3');
    const boton = page.locator('.seccion-cab:has(#sec-1\\.3) button.leida');
    await boton.click();
    await expect.poll(async () => (await leer<Record<string, { secciones: number }>>(page, 'progreso-diario'))[dia(0)]?.secciones).toBe(1);
    // seeded: 2 steps today; the section read makes 3 of 3
    await page.goto('#/');
    await expect(page.locator('section.objetivo .cuenta')).toHaveText('3/3');
    // turned off in «Aa»: back to the lesson steps only
    await abrirAjustes(page);
    const opcion = page.getByLabel('Cada sección que marcas como leída cuenta como un paso');
    await expect(opcion).toBeChecked();
    await opcion.uncheck();
    await expect(page.locator('section.objetivo .cuenta')).toHaveText('2/3');
    await expect.poll(() => leer<{ secciones: boolean }>(page, 'progreso-objetivo')).toMatchObject({ secciones: false });
  });
});

test.describe('saludo, pestañas y columnas', () => {
  test('«Tu nombre» en «Aa»: solo en este dispositivo', async ({ page }) => {
    await page.setViewportSize(MAC);
    await sembrar(page);
    await page.goto('#/');
    await expect(page.locator('.saludo h1')).toHaveText('Hola');
    await abrirAjustes(page);
    await page.getByLabel('Tu nombre').fill('Ada Lovelace');
    await expect(page.locator('.saludo h1')).toHaveText('Hola, Ada Lovelace');
    await expect.poll(async () => (await leer<{ nombre?: string }>(page, 'prefs'))?.nombre).toBe('Ada Lovelace');
    await page.reload();
    await expect(page.locator('.saludo h1')).toHaveText('Hola, Ada Lovelace');
    await abrirAjustes(page);
    await page.getByLabel('Tu nombre').fill('   ');
    await expect(page.locator('.saludo h1')).toHaveText('Hola');
  });

  test('tableta: dos columnas y la barra con «Inicio»', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: TABLETA, hasTouch: true });
    const page = await ctx.newPage();
    await sembrar(page);
    await page.goto('#/');
    const seguir = (await page.locator('.seguir').boundingBox())!;
    const camino = (await page.locator('section.camino-libro').boundingBox())!;
    expect(camino.x).toBeGreaterThan(seguir.x + seguir.width - 1);
    expect(Math.abs(camino.y - seguir.y)).toBeLessThan(40);
    const tabs = page.locator('nav.pestanas');
    await expect(tabs.locator('.pestana .etiqueta')).toHaveText(['Inicio', 'Libro', 'Simulador', 'Ejercicios', 'Más']);
    await expect(tabs.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
    await tabs.getByRole('link', { name: 'Simulador' }).tap();
    await expect(page).toHaveURL(/#\/simulador$/);
    await expect(tabs.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current', 'page');
    await tabs.getByRole('link', { name: 'Inicio' }).tap();
    await expect(page).toHaveURL(/#\/$/);
    await ctx.close();
  });

  test('teléfono: una columna, sin desplazamiento lateral, toques de 44 px', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: MOVIL, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await sembrar(page);
    await page.goto('#/');
    await expect(page.locator('a.nodo').first()).toBeVisible();
    const seguir = (await page.locator('.seguir').boundingBox())!;
    const camino = (await page.locator('section.camino-libro').boundingBox())!;
    expect(camino.y).toBeGreaterThan(seguir.y + seguir.height);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(ancho).toBeLessThanOrEqual(0);
    for (const sel of ['.seguir .continuar', '.repaso-hoy .t09-boton', 'button.tomo-fila', 'nav.pestanas .pestana']) {
      const c = (await page.locator(sel).first().boundingBox())!;
      expect(c.height, sel).toBeGreaterThanOrEqual(44);
    }
    await ctx.close();
  });
});

/** Text elements whose contrast with their background is below 4.5:1 (large text: 3:1). */
async function contrastesBajos(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const parsear = (c: string): number[] | null => {
      const m = c.match(/rgba?\(([^)]+)\)/) ?? c.match(/color\(srgb ([^)]+)\)/);
      if (!m) return null;
      const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
      const srgb = c.startsWith('color(');
      const [r, g, b] = srgb ? p.slice(0, 3).map((x) => x * 255) : p.slice(0, 3);
      return [r!, g!, b!, p[3] ?? 1];
    };
    const lum = ([r, g, b]: number[]) =>
      [r!, g!, b!].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const fondo = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const c = parsear(cs.backgroundColor);
        if (c && c[3]! > 0.5) return c;
        // a card with the block stripe paints its surface with a gradient
        if (cs.backgroundImage.includes('gradient')) return superficie;
      }
      return parsear(getComputedStyle(document.body).backgroundColor)!;
    };
    // the theme's card surface, as the browser computes it
    const sonda = document.createElement('i');
    sonda.style.background = 'var(--superficie)';
    document.body.append(sonda);
    const superficie = parsear(getComputedStyle(sonda).backgroundColor)!;
    sonda.remove();
    const malos: string[] = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || !el.textContent?.trim()) continue;
      const cs = getComputedStyle(el);
      const c = parsear(cs.color);
      if (!c) continue;
      const f = fondo(el);
      const [a, b] = [lum(c), lum(f)];
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      if (ratio < (grande ? 3 : 4.5)) malos.push(`${el.className || el.tagName} «${el.textContent.trim().slice(0, 30)}» ${ratio.toFixed(2)}`);
    }
    return malos;
  }, selector);
}

const TEXTOS = [
  '.saludo h1', '.saludo p', '.t09-rotulo', '.seguir h2', '.seguir .capitulo', '.seguir .det', '.seguir .continuar', '.por-pasos',
  '.racha h2', '.racha .txt', '.racha .letra', '.objetivo h2', '.objetivo .det', '.objetivo .txt', '.objetivo .cuenta',
  '.repaso-hoy h2', '.repaso-hoy .det', '.repaso-hoy .t09-boton', '.camino-libro h2', '.nodo .nom', '.nodo .sub', '.nodo .aqui',
  '.nodo .disco', '.tomo-id', '.tomo-tit', '.t09-chip', 'nav.pestanas .etiqueta', '.edicion',
].join(', ');

for (const tema of ['claro', 'sepia', 'oscuro'] as const) {
  test(`contraste 4,5:1 en el inicio, tema ${tema}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: MOVIL, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await sembrar(page, { prefs: { tema, tam: 18 }, lecciones: { 'cap05/sec-5.2': { h: [0, 1], u: 2, n: 6, c: 0, t: Date.now() } } });
    await page.goto('#/');
    await expect(page.locator('.repaso-hoy')).toHaveAttribute('data-pendientes', /\d+/);
    await expect(page.locator('.nodo .aqui')).toBeVisible();
    expect(await contrastesBajos(page, TEXTOS)).toEqual([]);
    // the restyled tool pages
    for (const ruta of ['#/simulador', '#/ejercicios', '#/calculadoras', '#/repaso']) {
      await page.goto(ruta);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForTimeout(600);
      expect(await contrastesBajos(page, 'main h1, main h2, main p, main .t09-chip, main .chip, main .cuenta, main .sec, main .n, main .auto, main .cap-n'), ruta).toEqual([]);
    }
    await ctx.close();
  });
}
