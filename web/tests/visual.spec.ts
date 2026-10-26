// 0.8 visual improvements end to end: the floating preview of references (mouse, touch, keyboard; figure,
// table, equation, section, chapter), the glossary's symbols and lazy 3D thumbnails, and the start page as a
// map of the book (tiles that follow the reading, «Seguir leyendo», «Repaso de hoy»), on desktop and phone.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.visual.config.ts tests/visual.spec.ts
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

const ESCRITORIO = { width: 1280, height: 800 };
const MOVIL = { width: 412, height: 915 };

const tarjeta = (page: Page) => page.locator('.vista-previa.colocada');

/** The paragraph of the Prefacio that cites figure 0.1, table 0.1 and chapter 0. */
async function prefacio(page: Page): Promise<Locator> {
  await page.goto('#/00_preliminares');
  const a = page.locator('a.ref[data-ref="fig-0.1"]');
  await a.scrollIntoViewIfNeeded();
  // let the progressive rendering settle, then put the reference where a reader would have it
  await page.waitForTimeout(800);
  await a.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  return a;
}

function separados(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
}

async function movil(browser: Browser, init?: (page: Page) => Promise<void>): Promise<Page> {
  const ctx = await browser.newContext({ viewport: MOVIL, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  if (init) await init(page);
  return page;
}

/** An equation with a label and a reference to it (the book cites none today): injected into the data. */
async function inyectarEcuacion(page: Page): Promise<void> {
  await page.route('**/libro/refs.json', async (r) => {
    const res = await r.fetch();
    const j = await res.json();
    j['ec-prueba'] = { num: '', parte: 'cap01', tipo: 'ec' };
    await r.fulfill({ response: res, json: j });
  });
  await page.route('**/libro/partes/cap01.json', async (r) => {
    const res = await r.fetch();
    const j = await res.json();
    type B = { t: string; etiqueta?: string; label?: string; bloques?: B[] };
    const buscar = (bs: B[]): B | undefined => {
      for (const b of bs) {
        if (b.t === 'ec' && b.etiqueta) return b;
        const x = b.bloques ? buscar(b.bloques) : undefined;
        if (x) return x;
      }
      return undefined;
    };
    buscar(j.bloques)!.label = 'ec-prueba';
    const p = j.bloques.find((b: { t: string }) => b.t === 'p');
    p.html += ' Véase la <a class="ref" data-ref="ec-prueba">ecuación de prueba</a>.';
    await r.fulfill({ response: res, json: j });
  });
}

test.describe('vista previa · escritorio', () => {
  test.use({ viewport: ESCRITORIO });

  test('al posar el ratón sobre una figura o una tabla se ve sin moverse el texto', async ({ page }) => {
    const a = await prefacio(page);
    const parrafo = a.locator('xpath=ancestor::p[1]');
    const antes = await parrafo.boundingBox();
    const url = page.url();
    const ra = (await a.boundingBox())!;
    await page.mouse.move(ra.x + ra.width / 2, ra.y + ra.height / 2, { steps: 4 });
    await expect(tarjeta(page)).toBeVisible();
    await expect(tarjeta(page)).toHaveAttribute('role', 'dialog');
    await expect(tarjeta(page).locator('#vista-previa-tit')).toContainText('Figura 0.1');
    await expect(tarjeta(page).locator('.placa img')).toBeVisible();
    await expect(tarjeta(page)).toContainText('Ir a la figura 0.1');
    await expect(a).toHaveAttribute('aria-describedby', 'vista-previa');
    // never over the reference, inside the window, and the text has not moved
    const caja = (await tarjeta(page).boundingBox())!;
    expect(separados(caja, (await a.boundingBox())!)).toBe(true);
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.y).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(ESCRITORIO.width);
    expect(caja.y + caja.height).toBeLessThanOrEqual(ESCRITORIO.height);
    expect(await parrafo.boundingBox()).toEqual(antes);
    expect(page.url()).toBe(url);
    // leaving reference and card closes it
    await page.mouse.move(5, 790);
    await expect(page.locator('.vista-previa')).toHaveCount(0);

    // the table, from the same paragraph
    const t = page.locator('a.ref[data-ref="tab-0.1"]');
    await t.hover();
    await expect(tarjeta(page).locator('#vista-previa-tit')).toContainText('Tabla 0.1');
    await expect(tarjeta(page).locator('table')).toBeVisible();
    // moving into the card keeps it open
    const c = (await tarjeta(page).boundingBox())!;
    await page.mouse.move(c.x + c.width / 2, c.y + 20, { steps: 6 });
    await page.waitForTimeout(500);
    await expect(tarjeta(page)).toBeVisible();
    // Esc closes it
    await page.keyboard.press('Escape');
    await expect(page.locator('.vista-previa')).toHaveCount(0);
  });

  test('el capítulo muestra su número, su título, su color y su primera figura', async ({ page }) => {
    const a = (await prefacio(page)).locator('xpath=..').locator('a.ref[data-ref="cap-0"]');
    await a.hover();
    await expect(tarjeta(page).locator('#vista-previa-tit')).toContainText('Capítulo 0');
    await expect(tarjeta(page).locator('.titulo')).not.toBeEmpty();
    await expect(tarjeta(page).locator('.insignia')).toHaveText('0');
    await expect(tarjeta(page).locator('.figura-mini img')).toBeVisible();
    // a click on the reference still jumps as always
    await a.click();
    await expect(page).toHaveURL(/#\/cap00\/cap-0$/);
    await expect(page.locator('.vista-previa')).toHaveCount(0);
  });

  test('teclado: Intro abre la vista previa, Intro otra vez va a la sección y «Volver» regresa', async ({ page }) => {
    await page.goto('#/cap05/sec-5.1');
    const a = page.locator('a.ref[data-ref="sec-5.2"]').first();
    await a.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await a.focus();
    await page.keyboard.press('Enter');
    await expect(tarjeta(page).locator('#vista-previa-tit')).toContainText('Sección 5.2');
    await expect(tarjeta(page).locator('.titulo')).toContainText('5.2');
    await expect(tarjeta(page).locator('.parrafos p').first()).not.toBeEmpty();
    const ir = tarjeta(page).getByRole('button', { name: 'Ir a la sección 5.2' });
    await expect(ir).toBeFocused();
    await expect(page).toHaveURL(/#\/cap05\/sec-5\.1$/);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/cap05\/sec-5\.2$/);
    await expect(page.locator('.vista-previa')).toHaveCount(0);
    const volver = page.locator('button.volver');
    await expect(volver).toBeVisible();
    await volver.click();
    await expect(page).toHaveURL(/#\/cap05\/sec-5\.1$/);
    // Esc gives the focus back to the reference
    await a.focus();
    await page.keyboard.press('Enter');
    await expect(tarjeta(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.vista-previa')).toHaveCount(0);
    await expect(a).toBeFocused();
  });

  test('una ecuación se muestra dibujada con su etiqueta', async ({ page }) => {
    await inyectarEcuacion(page);
    await page.goto('#/cap01');
    const a = page.locator('a.ref[data-ref="ec-prueba"]');
    await a.scrollIntoViewIfNeeded();
    await a.hover();
    await expect(tarjeta(page).locator('#vista-previa-tit')).toContainText('Ecuación');
    await expect(tarjeta(page).locator('.ec-etiqueta')).toContainText('Ec.');
    await expect(tarjeta(page).locator('img.ec-img')).toBeVisible();
    await expect(tarjeta(page).getByRole('button', { name: 'Ir a la ecuación' })).toBeVisible();
  });
});

test.describe('vista previa · táctil', () => {
  test('un toque abre la hoja, «Ir a» salta, un segundo toque también, y desplazar la cierra', async ({ browser }) => {
    const page = await movil(browser);
    const a = await prefacio(page);
    const url = page.url();
    await a.tap();
    const hoja = page.locator('.vista-previa.colocada.hoja, .vista-previa.colocada.hoja-arriba');
    await expect(hoja).toBeVisible();
    await expect(hoja).toContainText('o toque de nuevo el enlace');
    expect(page.url()).toBe(url);
    const caja = (await hoja.boundingBox())!;
    expect(caja.x).toBe(0);
    expect(Math.round(caja.width)).toBe(MOVIL.width);
    expect(separados(caja, (await a.boundingBox())!)).toBe(true);
    // a tap outside closes it
    await page.touchscreen.tap(8, caja.y > 300 ? caja.y - 60 : caja.y + caja.height + 60);
    await expect(page.locator('.vista-previa')).toHaveCount(0);
    // a second tap on the same reference goes there
    await a.tap();
    await expect(hoja).toBeVisible();
    await a.tap();
    await expect(page).toHaveURL(/#\/cap00\/fig-0\.1$/);
    await expect(page.locator('button.volver')).toBeVisible();
    await page.locator('button.volver').tap();
    await expect(page).toHaveURL(/#\/00_preliminares/);
    // «Ir a» in the sheet
    const t = page.locator('a.ref[data-ref="tab-0.1"]');
    await t.scrollIntoViewIfNeeded();
    await t.tap();
    await expect(hoja.locator('table')).toBeVisible();
    await hoja.getByRole('button', { name: 'Ir a la tabla 0.1' }).tap();
    await expect(page).toHaveURL(/#\/cap00\/tab-0\.1$/);
    await expect(page.locator('button.volver')).toBeVisible();
    // scrolling the page closes an open sheet
    await page.goBack();
    await expect(page).toHaveURL(/#\/00_preliminares/);
    await page.locator('a.ref[data-ref="fig-0.1"]').tap();
    await expect(hoja).toBeVisible();
    await page.evaluate(() => window.scrollBy(0, 200));
    await expect(page.locator('.vista-previa')).toHaveCount(0);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
    await page.context().close();
  });

  test('ecuación en el teléfono, y referencias dentro de un ejercicio', async ({ browser }) => {
    const page = await movil(browser, async (p) => {
      await inyectarEcuacion(p);
      // exercise 9.2 cites section 9.1 in its statement (the book only cites in solutions)
      await p.route('**/libro/partes/cap09.json', async (r) => {
        const res = await r.fetch();
        const j = await res.json();
        const ej = j.bloques.find((b: { t: string }) => b.t === 'ejercicios');
        const it = ej.items.find((x: { label: string }) => x.label === 'ej-9.2');
        it.bloques[0].html += ' Repasa la <a class="ref" data-ref="sec-9.1">9.1</a>.';
        await r.fulfill({ response: res, json: j });
      });
    });
    await page.goto('#/cap01');
    const a = page.locator('a.ref[data-ref="ec-prueba"]');
    await a.scrollIntoViewIfNeeded();
    await a.tap();
    await expect(tarjeta(page).locator('img.ec-img')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.vista-previa')).toHaveCount(0);

    await page.goto('#/cap09/ej-9.2');
    const r = page.locator('a.ref[data-ref="sec-9.1"]').last();
    await r.scrollIntoViewIfNeeded();
    await r.tap();
    await expect(tarjeta(page).locator('#vista-previa-tit')).toContainText('Sección 9.1');
    await expect(page).toHaveURL(/#\/cap09\/ej-9\.2$/);
    await page.context().close();
  });
});

test.describe('glosario con imagen', () => {
  test.use({ viewport: ESCRITORIO });

  test('símbolos al momento y miniaturas 3D solo al llegar a cada término', async ({ page }) => {
    const pedidas: string[] = [];
    page.on('request', (r) => pedidas.push(r.url()));
    await page.goto('#/glosario');
    await expect(page.locator('.entrada.con-imagen').first()).toBeAttached();
    await page.waitForTimeout(2500);
    // the top of the glossary: no model in view yet, so neither three.js nor any thumbnail
    expect(await page.locator('.foto3d img').count()).toBe(0);
    expect(pedidas.some((u) => /three|miniaturas/.test(u))).toBe(false);
    const simbolos = await page.locator('.entrada .simbolo svg').count();
    expect(simbolos).toBeGreaterThan(120);
    // go to «Diodo»: symbol and thumbnail with «Ver en 3D»
    await page.goto('#/glosario/glos-diodo');
    const diodo = page.locator('#glos-diodo');
    await expect(diodo.locator('.simbolo svg')).toBeVisible();
    expect(await diodo.locator('.simbolo svg path').count()).toBeGreaterThan(2);
    await expect(diodo.locator('.simbolo')).toHaveAttribute('aria-label', 'Símbolo: diodo');
    await expect(diodo.locator('.foto3d img')).toBeVisible({ timeout: 30_000 });
    const enlace = diodo.getByRole('link', { name: /Ver en 3D/ });
    await expect(enlace).toHaveAttribute('href', '#/componentes/3d/diodo-do41');
    // only the thumbnails near the screen were made
    const hechas = await page.locator('.foto3d img').count();
    expect(hechas).toBeGreaterThan(0);
    expect(hechas).toBeLessThan(30);
    // the term without a picture keeps the old layout
    await expect(page.locator('#glos-1-wire')).not.toHaveClass(/con-imagen/);
  });
});

test.describe('inicio como mapa del libro', () => {
  async function sembrar(page: Page, b: number): Promise<void> {
    await page.addInitScript((bloque) => {
      const t = Date.now();
      const leidas: Record<string, Record<string, number>> = { cap05: {}, cap01: {} };
      for (let k = 1; k <= 4; k++) leidas.cap05![`sec-5.${k}`] = t - k;
      localStorage.setItem('epa:leidas', JSON.stringify(leidas));
      localStorage.setItem('epa:posiciones', JSON.stringify({ cap05: { b: bloque, sec: 'sec-5.3', f: 0.3, t: t - 3_600_000 } }));
    }, b);
  }

  test('las teselas siguen la lectura y «Seguir leyendo» abre la sección', async ({ page, request }) => {
    const cap05 = await (await request.get('libro/partes/cap05.json')).json();
    const b = cap05.bloques.findIndex((x: { t: string; label?: string }) => x.t === 'h2' && x.label === 'sec-5.3') + 1;
    const indice = await (await request.get('libro/indice.json')).json();
    // chapter 1 complete
    const sec1: string[] = indice.partes.cap01.secciones.map((s: { label: string }) => s.label);
    await sembrar(page, b);
    await page.addInitScript((labels) => {
      const l = JSON.parse(localStorage.getItem('epa:leidas') ?? '{}');
      l.cap01 = Object.fromEntries(labels.map((x: string) => [x, Date.now()]));
      localStorage.setItem('epa:leidas', JSON.stringify(l));
    }, sec1);
    await page.setViewportSize(ESCRITORIO);
    const figuras: string[] = [];
    page.on('request', (r) => {
      if (/\/libro\/(fig|img)\//.test(r.url())) figuras.push(r.url());
    });
    await page.goto('#/');
    const mapa = page.locator('section.mapa');
    await expect(mapa).toBeVisible();
    const total = Object.values(indice.tomos as { partes: string[] }[]).reduce((n, t) => n + t.partes.filter((p) => indice.partes[p]).length, 0);
    await expect(mapa.locator('a.tesela')).toHaveCount(total);
    const c5 = mapa.locator('a.tesela[data-parte="cap05"]');
    await expect(c5).toHaveAttribute('data-leidas', '4');
    await expect(c5.locator('.muescas i.l')).toHaveCount(4);
    await expect(c5).toHaveAttribute('aria-current', 'true');
    await expect(c5).toHaveAttribute('aria-label', new RegExp(`4 de ${indice.partes.cap05.secciones.length} secciones leídas`));
    const c1 = mapa.locator('a.tesela[data-parte="cap01"]');
    await expect(c1).toHaveClass(/completa/);
    await expect(c1.locator('.hecho')).toBeVisible();
    await expect(mapa.locator('a.tesela[data-parte="cap02"]')).toHaveAttribute('data-leidas', '0');
    await expect(mapa.locator('.tesela.completa')).toHaveCount(1);

    // «Repaso de hoy»: the count and the way in
    const repaso = page.locator('.repaso-hoy');
    await expect(repaso.locator('.cifra[data-pendientes]')).toBeVisible();
    await expect(repaso.getByRole('link', { name: /Empezar/ })).toHaveAttribute('href', '#/repaso/tarjetas');

    // «Seguir leyendo»: its figure is the only one the start page loads
    const seguir = page.locator('a.seguir');
    await expect(seguir).toHaveAttribute('data-seccion', 'sec-5.3');
    await expect(seguir.locator('.imagen img')).toBeVisible();
    await expect(seguir).toContainText('5.3');
    await page.waitForTimeout(800);
    expect(figuras.length).toBe(1);
    await seguir.click();
    await expect(page).toHaveURL(/#\/cap05$/);
    await expect(page.locator('header.barra')).toContainText('5.3');

    // a tile opens its chapter
    await page.goto('#/');
    await mapa.locator('a.tesela[data-parte="cap02"]').click();
    await expect(page).toHaveURL(/#\/cap02$/);
  });

  test('teléfono: sin desplazamiento lateral ni zoom', async ({ browser }) => {
    const page = await movil(browser, (p) => sembrar(p, 3));
    await page.goto('#/');
    await expect(page.locator('section.mapa a.tesela').first()).toBeVisible();
    await expect(page.locator('a.seguir')).toBeVisible();
    const medidas = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, vista: window.innerWidth, escala: window.visualViewport?.scale ?? 1 }));
    expect(medidas.ancho).toBeLessThanOrEqual(medidas.vista);
    expect(medidas.escala).toBe(1);
    // tiles are big enough to tap
    const caja = (await page.locator('a.tesela[data-parte="cap05"]').boundingBox())!;
    expect(caja.width).toBeGreaterThanOrEqual(72);
    expect(caja.height).toBeGreaterThanOrEqual(72);
    await page.locator('a.tesela[data-parte="cap05"]').tap();
    await expect(page).toHaveURL(/#\/cap05$/);
    await page.context().close();
  });
});
