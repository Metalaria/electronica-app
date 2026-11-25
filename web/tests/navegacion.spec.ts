// Navigation end to end: the icon rail (2.1: the five groups, the current one marked, the header's tabs for the group's
// parts, each group remembering where it was left), the book index (filter by text and number, current section
// highlighted and kept in view, keyboard), previous/next section and the breadcrumb menu, the index panel only while
// reading, and on the phone the bottom bar, the group's tab row, the index drawer, with the back button closing them first.
// (The route → group/tab matrix in both themes: tests/navegacion21.spec.ts.)
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

  test('el carril lleva a cada grupo, las pestañas a sus partes, y se marca lo actual', async ({ page }) => {
    await page.goto('#/');
    const c = carril(page);
    await expect(c.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
    // 2.1: five groups, labels visible without hovering, and nothing in a «Más»
    await expect(c.locator('.etiqueta')).toHaveText(['Inicio', 'Aprender', 'Libro', 'Taller', 'Proyectos']);
    await expect(c.getByRole('button', { name: /^Más/ })).toHaveCount(0);
    const cab = page.locator('header.barra');
    // a group of one part: its name, no tabs
    await expect(cab.locator('.donde')).toHaveText('Inicio');

    const grupos: [string, RegExp, string][] = [
      ['Aprender', /#\/cursos$/, 'Cursos'],
      ['Taller', /#\/simulador$/, 'Simulador'],
      ['Proyectos', /#\/fm7303$/, 'Kit FM7303'],
    ];
    for (const [nombre, hash, parte] of grupos) {
      await c.getByRole('link', { name: nombre, exact: true }).click();
      await expect(page).toHaveURL(hash);
      await expect(c.getByRole('link', { name: nombre, exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(c.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(cab.getByRole('navigation', { name: `Partes de ${nombre}` }).locator('[aria-current="page"]')).toHaveText(parte);
    }
    // the header's tabs: Proyectos → Consolas
    const partes = cab.getByRole('navigation', { name: 'Partes de Proyectos' });
    await expect(partes.getByRole('link')).toHaveText(['Kit FM7303', 'Consolas', 'Proyectos del libro']);
    await partes.getByRole('link', { name: 'Consolas' }).click();
    await expect(page).toHaveURL(/#\/consolas$/);
    await expect(partes.getByRole('link', { name: 'Consolas' })).toHaveAttribute('aria-current', 'page');
    // Taller → Protoboard, then away and back: the group returns where it was left
    await c.getByRole('link', { name: 'Taller', exact: true }).click();
    await cab.getByRole('navigation', { name: 'Partes de Taller' }).getByRole('link', { name: 'Protoboard' }).click();
    await expect(page).toHaveURL(/#\/protoboard$/);
    await c.getByRole('link', { name: 'Proyectos', exact: true }).click();
    await expect(page).toHaveURL(/#\/consolas$/);
    await c.getByRole('link', { name: 'Taller', exact: true }).click();
    await expect(page).toHaveURL(/#\/protoboard$/);
    // the group on screen leads to its first part
    await c.getByRole('link', { name: 'Taller', exact: true }).click();
    await expect(page).toHaveURL(/#\/simulador$/);

    // «Buscar» (header) opens the search; «Libro» goes to the reading, and there shows / hides the index
    await cab.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByRole('dialog', { name: 'Buscar en el libro' })).toBeVisible();
    await page.keyboard.press('Escape');
    await c.getByRole('link', { name: 'Libro', exact: true }).click();
    await expect(page).toHaveURL(/#\/cap\d+/);
    await expect(c.getByRole('link', { name: 'Libro', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(indice(page)).toBeVisible();
    await c.getByRole('link', { name: 'Libro', exact: true }).click();
    await expect(indice(page)).toBeHidden();
    await expect(c.getByRole('link', { name: 'Libro', exact: true })).toHaveAttribute('aria-expanded', 'false');
    // «Índice», the reader's tab, shows it again
    await page.getByRole('navigation', { name: 'Partes de Libro' }).getByRole('link', { name: 'Índice' }).click();
    await expect(indice(page)).toBeVisible();
  });

  test('«Más» está al pie de «Aa»: Guía de uso, Modo docente y Sincronización', async ({ page }) => {
    await page.goto('#/');
    await page.getByRole('button', { name: 'Tema y tamaño de letra' }).click();
    const mas = page.getByRole('dialog', { name: 'Tema y tamaño de letra' }).getByRole('navigation', { name: 'Más' });
    await expect(mas.getByRole('link')).toHaveText(['Guía de uso', 'Modo docente', 'Sincronización']);
    await mas.getByRole('link', { name: 'Modo docente' }).click();
    await expect(page).toHaveURL(/#\/docente$/);
    await expect(page.getByRole('dialog', { name: 'Tema y tamaño de letra' })).toHaveCount(0);
    // outside the five groups: no group marked, the page's name in the header
    await expect(carril(page).locator('[aria-current="page"]')).toHaveCount(0);
    await expect(page.locator('header.barra .donde')).toHaveText('Modo docente');
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
    // (printed 33.9 in the book; 35.9 in 1.1: the expansions' two new chapters come before part cap34)
    await expect(actual).toContainText('35.9');
    await expect.poll(() => enVista(page, actual)).toBe(true);
    // its volume is open and the others closed
    await expect(ind.locator('.tomo-cab[aria-expanded="true"]')).toHaveCount(1);

    // reading on moves the highlight
    await page.locator('#sec-34\\.10').evaluate((el) => {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'instant' });
    });
    await expect(actual).toContainText('35.10');
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
    // (only chapter 5's: 34.9, read above, is still listed and ticked while volume V stays open)
    await expect(ind.locator('.secciones a.leida[href^="#/cap05/"]')).toHaveCount(4);
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

  test('el índice solo acompaña a la lectura, y su elección se recuerda', async ({ page }) => {
    await page.goto('#/cap05');
    const ind = indice(page);
    const ancho = () => page.evaluate(() => document.querySelector('.principal')!.getBoundingClientRect().left);
    await expect(ind).toBeVisible();
    const conIndice = await ancho();
    // 2.1: not on Inicio nor in the tools (nor its toggle): they get the whole width
    for (const r of ['#/', '#/simulador', '#/glosario', '#/consolas']) {
      await page.goto(r);
      await expect(ind).toBeHidden();
      await expect(page.getByRole('button', { name: 'Mostrar el índice' })).toHaveCount(0);
      expect(await ancho()).toBeLessThan(conIndice - 200);
    }
    await page.goto('#/cap05');
    await expect(ind).toBeVisible();
    await page.getByRole('button', { name: 'Ocultar el índice' }).click();
    await expect(ind).toBeHidden();
    // «Libro» on the rail toggles it while reading
    await carril(page).getByRole('link', { name: 'Libro' }).click();
    await expect(ind).toBeVisible();
    await carril(page).getByRole('link', { name: 'Libro' }).click();
    await expect(ind).toBeHidden();
    // remembered after a reload
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.locator('.carril')).toBeVisible();
    await expect(ind).toBeHidden();
    await expect(page.getByRole('button', { name: 'Mostrar el índice' })).toBeVisible();
  });
});

test.describe('teléfono', () => {
  test.use({ viewport: MOVIL, hasTouch: true });

  test('barra inferior, pestañas del grupo, cajón del índice y el botón Atrás', async ({ page }) => {
    await progreso(page);
    await page.goto('#/cap05/sec-5.8');
    const tabs = page.locator('nav.pestanas');
    await expect(tabs).toBeVisible();
    await expect(page.locator('.carril')).toHaveCount(0);
    await expect(tabs.locator('.etiqueta')).toHaveText(['Inicio', 'Aprender', 'Libro', 'Taller', 'Proyectos']);
    const libro = tabs.getByRole('link', { name: 'Libro' });
    await expect(libro).toHaveClass(/activa/);
    await expect(libro).toHaveAttribute('aria-current', 'page');

    // «Libro» while reading opens the drawer with the current section in view
    await libro.click();
    const ind = indice(page);
    await expect(ind).toBeVisible();
    await expect(libro).toHaveAttribute('aria-expanded', 'true');
    const actual = ind.locator('.secciones a[aria-current="location"]');
    await expect(actual).toContainText('5.8');
    await expect.poll(() => enVista(page, actual)).toBe(true);
    // the back button closes the drawer, not the page
    await page.goBack();
    await expect(ind).toBeHidden();
    await expect(page).toHaveURL(/sec-5\.8$/);

    // a section chosen in the drawer: the drawer closes and «Atrás» returns to 5.8
    await libro.click();
    await filtro(page).fill('5.10');
    await ind.locator('.secciones a').first().tap();
    await expect(page).toHaveURL(/sec-5\.10$/);
    await expect(ind).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/sec-5\.8$/);

    // the group's tab row: «Índice» (the reader's own tab) also opens the drawer
    await page.evaluate(() => window.scrollTo(0, 0));
    const fila = page.getByRole('navigation', { name: 'Partes de Libro' });
    await fila.getByRole('link', { name: 'Índice' }).tap();
    await expect(ind).toBeVisible();
    await page.goBack();
    await expect(ind).toBeHidden();

    // another group: its first part, its tabs in a row under the bar
    await tabs.getByRole('link', { name: 'Taller' }).tap();
    await expect(page).toHaveURL(/#\/simulador$/);
    await expect(tabs.getByRole('link', { name: 'Taller' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('header.barra .donde')).toHaveText('Taller');
    const taller = page.getByRole('navigation', { name: 'Partes de Taller' });
    await expect(taller.locator('[aria-current="page"]')).toHaveText('Simulador');
    await taller.getByRole('link', { name: 'Instrumentos' }).tap();
    await expect(page).toHaveURL(/#\/instrumentos$/);
    await expect(taller.locator('[aria-current="page"]')).toHaveText('Instrumentos');
    await page.goBack();
    await expect(page).toHaveURL(/#\/simulador$/);

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
