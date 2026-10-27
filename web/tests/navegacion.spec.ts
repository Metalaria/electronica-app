// Navigation end to end: the icon rail (one entry per registry item, active state, «Más» when the window is
// short), the book index (filter by text and number, current section highlighted and kept in view, keyboard),
// previous/next section and the breadcrumb menu, the index panel hidden per tool, and on the phone the tab
// bar, the index drawer and «Más», with the back button closing them first.
import { expect, test, type Page } from '@playwright/test';

const ESCRITORIO = { width: 1280, height: 800 };
const MOVIL = { width: 412, height: 915 };

/** Reading progress (chapter 5 half read) so the index shows ticks. */
async function progreso(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      const t = Date.now();
      const leidas: Record<string, number> = {};
      for (let k = 1; k <= 4; k++) leidas[`sec-5.${k}`] = t - k;
      localStorage.setItem('epa:leidas', JSON.stringify({ cap05: leidas }));
    } catch {
      /* private mode */
    }
  });
}

const carril = (page: Page) => page.getByRole('navigation', { name: 'Secciones de la aplicación' });
const indice = (page: Page) => page.getByRole('complementary', { name: 'Índice del libro' });
const filtro = (page: Page) => page.getByRole('searchbox', { name: 'Filtrar capítulos y secciones' });

/**
 * Clicks a link of the sticky reading bar where a person would, at its centre on screen. Locator.click()
 * first asks Chromium to scroll the element into view, and for an element inside a sticky header that can
 * scroll the page while the reader is still pinning a freshly opened section, so the click lands on the
 * bar of another section (seen as a flaky «5.7» instead of «5.8» on a busy machine).
 */
async function pulsarEnBarra(page: Page, enlace: ReturnType<Page['locator']>): Promise<void> {
  await expect(enlace).toBeVisible();
  const caja = await enlace.boundingBox();
  if (!caja) throw new Error('the bar link has no box');
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
}

/** The row is inside the visible part of the index list. */
async function enVista(page: Page, fila: ReturnType<Page['locator']>): Promise<boolean> {
  const caja = await fila.boundingBox();
  const lista = await indice(page).locator('nav.lista').boundingBox();
  return !!caja && !!lista && caja.y >= lista.y && caja.y + caja.height <= lista.y + lista.height;
}

test.describe('escritorio', () => {
  test.use({ viewport: ESCRITORIO });

  test('el carril lleva a cada sección y marca la actual', async ({ page }) => {
    await page.goto('#/');
    const c = carril(page);
    await expect(c.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
    // every entry of the registry fits at 800 px, labels visible without hovering
    for (const nombre of ['Inicio', 'Libro', 'Buscar', 'Simulador', 'Calculadoras', 'Ejercicios', 'Repaso', 'Componentes', 'Conceptos', 'Instrumentos', 'Kit FM7303', 'Consolas', 'Proyectos', 'Glosario', 'Marcadores']) {
      await expect(c.locator('.etiqueta', { hasText: new RegExp(`^${nombre}$`) })).toBeVisible();
    }
    const destinos: [string, string][] = [
      ['Simulador', '#/simulador'],
      ['Calculadoras', '#/calculadoras'],
      ['Ejercicios', '#/ejercicios'],
      ['Repaso', '#/repaso'],
      ['Componentes animados', '#/componentes'],
      ['Conceptos animados', '#/conceptos'],
      ['Instrumentos', '#/instrumentos'],
      ['Kit FM7303', '#/fm7303'],
      ['Consolas', '#/consolas'],
      ['Proyectos KiCad', '#/proyectos'],
      ['Glosario', '#/glosario'],
      ['Marcadores y notas', '#/marcadores'],
    ];
    for (const [nombre, hash] of destinos) {
      const enlace = c.getByRole('link', { name: nombre, exact: true });
      await enlace.click();
      await expect(page).toHaveURL(new RegExp(`${hash.replace(/[/#]/g, '\\$&')}$`));
      await expect(enlace).toHaveAttribute('aria-current', 'page');
      await expect(c.locator('[aria-current="page"]')).toHaveCount(1);
    }
    // «Buscar» opens the search; «Libro» returns to the reading
    await c.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByRole('dialog', { name: 'Buscar en el libro' })).toBeVisible();
    await page.keyboard.press('Escape');
    await c.getByRole('button', { name: 'Libro' }).click();
    await expect(page).toHaveURL(/#\/cap\d+/);
    await expect(c.getByRole('button', { name: 'Libro' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('con poca altura, lo que no cabe va a «Más»', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 560 });
    await page.goto('#/');
    const mas = carril(page).getByRole('button', { name: /^Más/ });
    await expect(mas).toBeVisible();
    await expect(carril(page).getByRole('link', { name: 'Marcadores y notas' })).toHaveCount(0);
    await mas.click();
    const menu = page.getByRole('menu', { name: 'Más secciones' });
    await expect(menu.getByRole('menuitem', { name: /Marcadores y notas/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await mas.click();
    await menu.getByRole('menuitem', { name: 'Consolas' }).click();
    await expect(page).toHaveURL(/#\/consolas$/);
    await expect(menu).toHaveCount(0);
    await expect(mas).toHaveClass(/activo/);
    // the menu did not leave a history entry behind: «Atrás» returns home
    await page.goBack();
    await expect(page).toHaveURL(/#\/$/);
  });

  test('el filtro encuentra capítulos y secciones por texto y por número', async ({ page }) => {
    await page.goto('#/cap01');
    const ind = indice(page);
    await filtro(page).fill('díodo ZENER');
    await expect(ind.locator('.secciones a')).toHaveCount(1);
    await expect(ind.locator('.secciones a')).toContainText('5.8');
    await expect(ind.locator('.secciones a mark').first()).toHaveText(/Diodo|Zener/);

    await filtro(page).fill('5.8');
    await expect(ind.locator('.secciones a')).toHaveCount(1);
    await expect(ind.locator('a.capitulo')).toContainText('Diodos');

    await filtro(page).fill('cap 33');
    await expect(ind.locator('a.capitulo')).toHaveCount(1);
    await expect(ind.locator('a.capitulo .insignia')).toHaveText('33');
    await expect(ind.locator('.secciones a').first()).toContainText('33.1');

    await filtro(page).fill('ap b');
    await expect(ind.locator('a.capitulo .insignia')).toHaveText('B');

    await filtro(page).fill('qqzzxx');
    await expect(ind.getByText(/Nada coincide/)).toBeVisible();

    // Enter opens the first result
    await filtro(page).fill('12.4');
    await filtro(page).press('Enter');
    await expect(page).toHaveURL(/#\/cap\d+\/sec-12\.4$/);
    await expect(page.locator('#sec-12\\.4')).toBeVisible();

    // the filter hands its words over to the full-text search
    await filtro(page).fill('bandgap');
    await ind.getByRole('button', { name: /en el texto del libro/ }).click();
    await expect(page.locator('input[type="search"]:focus')).toHaveValue('bandgap');
  });

  test('la sección actual se resalta y se mantiene a la vista', async ({ page }) => {
    await progreso(page);
    await page.goto('#/cap34/sec-34.9');
    const ind = indice(page);
    const actual = ind.locator('.secciones a[aria-current="location"]');
    await expect(actual).toContainText('33.9');
    await expect.poll(() => enVista(page, actual)).toBe(true);
    // its volume is open and the others closed
    await expect(ind.locator('.tomo-cab[aria-expanded="true"]')).toHaveCount(1);

    // reading on moves the highlight
    await page.locator('#sec-34\\.10').evaluate((el) => {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'instant' });
    });
    await expect(actual).toContainText('33.10');
    await expect.poll(() => enVista(page, actual)).toBe(true);

    // the reader scrolls the index away: no automatic jump back, but «Ir a la sección actual» appears
    await ind.locator('nav.lista').hover();
    await page.mouse.wheel(0, -4000);
    await expect(ind.getByRole('button', { name: 'Ir a la sección actual' })).toBeVisible();
    await ind.getByRole('button', { name: 'Ir a la sección actual' }).click();
    await expect.poll(() => enVista(page, actual)).toBe(true);
    await expect(actual).toBeFocused();

    // read sections are ticked in chapter 5
    await page.goto('#/cap05/sec-5.6');
    await expect(ind.locator('.secciones a.leida')).toHaveCount(4);
  });

  test('teclado en el índice: flechas, desplegar y abrir', async ({ page }) => {
    await page.goto('#/cap05/sec-5.2');
    await filtro(page).focus();
    await page.keyboard.press('ArrowDown');
    const primera = indice(page).locator('[data-fila]').first();
    await expect(primera).toBeFocused();
    await expect(primera).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(primera).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowRight');
    await expect(primera).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown'); // Prefacio
    await page.keyboard.press('ArrowDown'); // chapter 0
    await expect(indice(page).locator('a.capitulo[data-id="cap00"]')).toBeFocused();
    await page.keyboard.press('ArrowRight'); // shows its sections
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(':focus')).toContainText('0.1');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/cap00\/sec-0\.1$/);
  });

  test('anterior y siguiente sección, y el menú de la miga', async ({ page }) => {
    await page.goto('#/cap05/sec-5.8');
    const barra = page.locator('header.barra');
    await expect(barra.locator('.seccion')).toContainText('5.8');
    // let the reading position settle (late images move the page for a moment)
    await page.waitForTimeout(1500);
    await expect(barra.locator('.seccion')).toContainText('5.8');
    await pulsarEnBarra(page, barra.getByRole('link', { name: /Sección siguiente: 5\.9/ }));
    await expect(page).toHaveURL(/#\/cap05\/sec-5\.9$/);
    await expect(barra.locator('.seccion')).toContainText('5.9');
    await pulsarEnBarra(page, barra.getByRole('link', { name: /Sección anterior: 5\.8/ }));
    await expect(page).toHaveURL(/sec-5\.8$/);
    // Alt + ↓
    await expect(barra.locator('.seccion')).toContainText('5.8');
    await page.keyboard.press('Alt+ArrowDown');
    await expect(page).toHaveURL(/sec-5\.9$/);
    // the last section goes on to the next chapter's opening
    await page.goto('#/cap05/sec-5.11');
    await expect(barra.getByRole('link', { name: /Sección siguiente: Capítulo 6/ })).toHaveAttribute('href', '#/cap06/cap-6');

    // the breadcrumb opens the chapter's sections, the current one marked
    await barra.locator('.miga-boton').click();
    const menu = page.getByRole('dialog', { name: 'Secciones de Capítulo 5' });
    await expect(menu).toBeVisible();
    const enBarra = ((await barra.locator('.seccion b').textContent()) ?? '').trim();
    await expect(menu.locator('a[aria-current="location"] .sn')).toHaveText(enBarra);
    await expect(menu.getByRole('link', { name: /Siguiente.*Capítulo 6/ })).toBeVisible();
    await menu.getByRole('link', { name: /5\.3/ }).click();
    await expect(menu).toHaveCount(0);
    await expect(page).toHaveURL(/sec-5\.3$/);
    // «Atrás» returns to where the menu was opened
    await page.goBack();
    await expect(page).toHaveURL(/sec-5\.11$/);
    // Esc closes it
    await barra.locator('.miga-boton').click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(page).toHaveURL(/sec-5\.11$/);
  });

  test('el índice se oculta por herramienta y se recuerda', async ({ page }) => {
    await page.goto('#/cap05');
    const ind = indice(page);
    const ancho = () => page.evaluate(() => document.querySelector('.principal')!.getBoundingClientRect().left);
    await expect(ind).toBeVisible();
    const conIndice = await ancho();
    // in a tool the index starts hidden: the tool gets the whole width
    await page.goto('#/simulador');
    await expect(ind).toBeHidden();
    expect(await ancho()).toBeLessThan(conIndice - 200);
    await page.getByRole('button', { name: 'Mostrar el índice' }).click();
    await expect(ind).toBeVisible();
    await expect.poll(ancho).toBe(conIndice);
    // the reader keeps its own choice
    await page.goto('#/cap05');
    await expect(ind).toBeVisible();
    await page.getByRole('button', { name: 'Ocultar el índice' }).click();
    await expect(ind).toBeHidden();
    // «Libro» on the rail toggles it while reading
    await carril(page).getByRole('button', { name: 'Libro' }).click();
    await expect(ind).toBeVisible();
    await carril(page).getByRole('button', { name: 'Libro' }).click();
    await expect(ind).toBeHidden();
    // remembered after a reload, per view
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.locator('.carril')).toBeVisible();
    await expect(ind).toBeHidden();
    await page.goto('#/simulador');
    await expect(ind).toBeVisible();
    await page.goto('#/consolas');
    await expect(ind).toBeHidden();
  });
});

test.describe('teléfono', () => {
  test.use({ viewport: MOVIL, hasTouch: true });

  test('pestañas, cajón del índice, «Más» y el botón Atrás', async ({ page }) => {
    await progreso(page);
    await page.goto('#/cap05/sec-5.8');
    const tabs = page.locator('nav.pestanas');
    await expect(tabs).toBeVisible();
    await expect(page.locator('.carril')).toHaveCount(0);
    await expect(tabs.getByRole('button', { name: 'Libro' })).toHaveClass(/activa/);

    // «Libro» opens the drawer with the current section in view
    await tabs.getByRole('button', { name: 'Libro' }).click();
    const ind = indice(page);
    await expect(ind).toBeVisible();
    const actual = ind.locator('.secciones a[aria-current="location"]');
    await expect(actual).toContainText('5.8');
    await expect.poll(() => enVista(page, actual)).toBe(true);
    // the back button closes the drawer, not the page
    await page.goBack();
    await expect(ind).toBeHidden();
    await expect(page).toHaveURL(/sec-5\.8$/);

    // a section chosen in the drawer: the drawer closes and «Atrás» returns to 5.8
    await tabs.getByRole('button', { name: 'Libro' }).click();
    await filtro(page).fill('5.10');
    await ind.locator('.secciones a').first().tap();
    await expect(page).toHaveURL(/sec-5\.10$/);
    await expect(ind).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/sec-5\.8$/);

    // «Más» opens the rest; «Atrás» closes it
    await tabs.getByRole('button', { name: 'Más' }).click();
    const hoja = page.getByRole('menu', { name: 'Más secciones' });
    // 0.9: «Inicio» is a tab; «Buscar» moved into «Más»
    await expect(tabs.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(hoja.getByRole('menuitem', { name: 'Buscar' })).toBeVisible();
    await expect(hoja.getByRole('menuitem', { name: 'Consolas' })).toBeVisible();
    await page.goBack();
    await expect(hoja).toHaveCount(0);
    await expect(page).toHaveURL(/sec-5\.8$/);
    await tabs.getByRole('button', { name: 'Más' }).click();
    await hoja.getByRole('menuitem', { name: 'Instrumentos' }).tap();
    await expect(page).toHaveURL(/#\/instrumentos$/);
    await expect(tabs.getByRole('button', { name: 'Más' })).toHaveClass(/activa/);
    await page.goBack();
    await expect(page).toHaveURL(/sec-5\.8$/);

    // the tabs that are routes
    await tabs.getByRole('link', { name: 'Simulador' }).tap();
    await expect(page).toHaveURL(/#\/simulador$/);
    await expect(tabs.getByRole('link', { name: 'Simulador' })).toHaveAttribute('aria-current', 'page');

    // the breadcrumb menu, as a sheet under the bar, closed by «Atrás»
    await page.goto('#/cap05/sec-5.8');
    await page.locator('.miga-boton').tap();
    const menu = page.getByRole('dialog', { name: 'Secciones de Capítulo 5' });
    await expect(menu).toBeVisible();
    await page.goBack();
    await expect(menu).toHaveCount(0);
    await expect(page).toHaveURL(/sec-5\.8$/);
  });

  test('la barra inferior no tapa el botón «Volver» ni el final de la página', async ({ page }) => {
    await page.goto('#/cap05/sec-5.8');
    const ref = page.locator('a.ref[href^="#/cap08"]').first();
    await ref.scrollIntoViewIfNeeded();
    // on touch a tap opens the reference's preview (0.8); «Ir a …» follows it
    await ref.tap();
    await page.locator('.vista-previa').getByRole('button', { name: /^Ir a / }).tap();
    const volver = page.locator('button.volver');
    await expect(volver).toBeVisible();
    const b = (await volver.boundingBox())!;
    const t = (await page.locator('nav.pestanas').boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(t.y);
    // the page can scroll its last line above the tabs
    const hueco = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main')!).paddingBottom));
    expect(hueco).toBeGreaterThanOrEqual(58);
  });
});
