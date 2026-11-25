// 2.1 navigation: every hash route of the app lands in its group (rail on the desktop, bottom bar on the phone) and,
// inside the group, on its tab of the header (or on none: the group's other views, the pages of «Más», the lesson),
// on the desktop and the phone, in the dark and the sepia themes (the two the owner uses). Also the tablet of the owner
// (Xiaomi Pad 6): portrait gets the phone's shell, landscape the desktop's. No route leaves the page wider than the
// screen.
import { expect, test, type Page } from '@playwright/test';

type Caso = [ruta: string, grupo: string | null, parte: string | null];

const CASOS: Caso[] = [
  ['#/', 'inicio', null],
  ['#/cursos', 'aprender', 'Cursos'],
  ['#/cursos/fundamentos', 'aprender', 'Cursos'],
  ['#/repaso', 'aprender', 'Repaso'],
  ['#/repaso/tarjetas', 'aprender', 'Repaso'],
  ['#/progreso', 'aprender', 'Progreso'],
  ['#/progreso/dominio', 'aprender', 'Progreso'],
  ['#/practicar', 'aprender', null],
  ['#/problema', 'aprender', null],
  ['#/diagnostico', 'aprender', null],
  ['#/etapas', 'aprender', null],
  ['#/cap05', 'libro', 'Índice'],
  ['#/cap05/sec-5.3', 'libro', 'Índice'],
  ['#/ejercicios', 'libro', 'Ejercicios'],
  ['#/ejercicios/repaso', 'libro', 'Ejercicios'],
  ['#/conceptos', 'libro', 'Conceptos'],
  ['#/glosario', 'libro', 'Glosario'],
  ['#/marcadores', 'libro', 'Marcadores'],
  ['#/simulador', 'taller', 'Simulador'],
  ['#/editor', 'taller', 'Simulador'],
  ['#/protoboard', 'taller', 'Protoboard'],
  ['#/instrumentos', 'taller', 'Instrumentos'],
  ['#/calculadoras', 'taller', 'Calculadoras'],
  ['#/componentes', 'taller', 'Componentes'],
  ['#/fm7303', 'proyectos', 'Kit FM7303'],
  ['#/consolas', 'proyectos', 'Consolas'],
  ['#/consolas/saturn/foto', 'proyectos', 'Consolas'],
  ['#/proyectos', 'proyectos', 'Proyectos del libro'],
  ['#/docente', null, null],
  ['#/guia', null, null],
  ['#/sincronizacion', null, null],
];

const GRUPO: Record<string, string> = { inicio: 'Inicio', aprender: 'Aprender', libro: 'Libro', taller: 'Taller', proyectos: 'Proyectos' };

async function preparar(page: Page, tema: 'oscuro' | 'sepia'): Promise<void> {
  await page.addInitScript((t) => {
    try {
      if (sessionStorage.getItem('nav21')) return;
      sessionStorage.setItem('nav21', '1');
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t }));
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:protoboard-recorrido', '1');
    } catch {
      /* private mode */
    }
  }, tema);
}

/** Goes to a route the way a link does (same page, the router's hashchange). */
async function ir(page: Page, ruta: string): Promise<void> {
  await page.evaluate((r) => {
    location.hash = r;
  }, ruta);
  await expect(page).toHaveURL(new RegExp(`${ruta.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`));
}

async function comprobar(page: Page, movil: boolean): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Secciones de la aplicación' });
  const cab = page.locator('header.barra');
  for (const [ruta, grupo, parte] of CASOS) {
    await ir(page, ruta);
    const m = `${ruta} (${movil ? 'teléfono' : 'escritorio'})`;
    await expect(nav, m).toBeVisible();
    // (pages have rows of their own called «pestanas»: the app's bar is the one with the navigation's name)
    await expect(page.locator(movil ? 'nav.carril' : 'nav.pestanas[aria-label="Secciones de la aplicación"]'), m).toHaveCount(0);
    // the group, and only it
    if (grupo) {
      await expect(nav.locator(`[data-grupo="${grupo}"]`), m).toHaveAttribute('aria-current', 'page');
      await expect(nav.locator('[aria-current="page"]'), m).toHaveCount(1);
    } else {
      await expect(nav.locator('[aria-current="page"]'), m).toHaveCount(0);
    }
    // its parts: the header's tabs (or the phone's row under the bar), the current one marked
    const partes = page.locator('[data-grupo-pestanas]');
    if (grupo && grupo !== 'inicio') {
      await expect(partes, m).toHaveCount(1);
      await expect(partes, m).toHaveAttribute('aria-label', `Partes de ${GRUPO[grupo]}`);
      if (parte) await expect(partes.locator('[aria-current="page"]'), m).toHaveText(parte);
      else await expect(partes.locator('[aria-current="page"]'), m).toHaveCount(0);
    } else {
      await expect(partes, m).toHaveCount(0);
    }
    // Buscar and «Aa», always
    await expect(cab.getByRole('button', { name: 'Buscar' }), m).toBeVisible();
    await expect(cab.getByRole('button', { name: 'Tema y tamaño de letra' }), m).toBeVisible();
    // the book's index panel only while reading (desktop)
    if (!movil) {
      const ind = page.getByRole('complementary', { name: 'Índice del libro' });
      if (ruta.startsWith('#/cap')) await expect(ind, m).toBeVisible();
      else await expect(ind, m).toBeHidden();
    }
    // nothing wider than the screen
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), m).toBeLessThanOrEqual(0);
  }
  // the lesson stays full screen: no rail, no bar, no header
  await ir(page, '#/leccion/cap01/sec-1.4');
  await expect(page.locator('nav.carril, nav.pestanas, header.barra')).toHaveCount(0);
}

for (const tema of ['oscuro', 'sepia'] as const) {
  test.describe(`tema ${tema}`, () => {
    test(`escritorio: cada ruta en su grupo y su pestaña (${tema})`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: 1366, height: 900 });
      await preparar(page, tema);
      await page.goto('#/');
      await expect(page.locator('html')).toHaveAttribute('data-tema', tema);
      await comprobar(page, false);
    });

    test(`teléfono: cada ruta en su grupo y su pestaña (${tema})`, async ({ browser }) => {
      test.setTimeout(240_000);
      const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await preparar(page, tema);
      await page.goto('#/');
      await expect(page.locator('html')).toHaveAttribute('data-tema', tema);
      await comprobar(page, true);
      await ctx.close();
    });
  });
}

test('la fila de pestañas del teléfono se desliza y deja la actual a la vista; 44 px de toque', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await preparar(page, 'sepia');
  await page.goto('#/componentes');
  const fila = page.getByRole('navigation', { name: 'Partes de Taller' });
  const actual = fila.locator('[aria-current="page"]');
  await expect(actual).toHaveText('Componentes');
  // the last tab does not fit at 360 px: the row scrolled to show it
  await expect.poll(() => fila.evaluate((f) => f.scrollWidth > f.clientWidth)).toBe(true);
  const caja = (await actual.boundingBox())!;
  expect(caja.x + caja.width).toBeLessThanOrEqual(360);
  expect(caja.x).toBeGreaterThanOrEqual(0);
  for (const a of await fila.getByRole('link').all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (const a of await page.locator('nav.pestanas[aria-label="Secciones de la aplicación"] a').all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await ctx.close();
});

// 2.1 close-out (QA harness, «objetivo táctil pequeño»): a short tab — the consoles' «Foto» — was 31 px wide on touch
test('cada pestaña del sistema mide al menos 44 × 44 px, también las de texto corto («Foto» de las consolas)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await preparar(page, 'oscuro');
  for (const ruta of ['#/consolas/nes/foto', '#/cursos/fundamentos', '#/simulador']) {
    await page.goto(ruta);
    await expect(page.locator('.pestana21').first()).toBeVisible({ timeout: 30_000 });
    const pequenas = await page.evaluate(() =>
      [...document.querySelectorAll('.pestana21')]
        .map((e) => ({ t: (e.textContent ?? '').trim(), r: e.getBoundingClientRect() }))
        .filter((x) => x.r.width > 0 && (x.r.width < 44 || x.r.height < 44))
        .map((x) => `${x.t} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`),
    );
    expect(pequenas, ruta).toEqual([]);
  }
  await ctx.close();
});

test('tableta (Xiaomi Pad 6): vertical con la barra inferior, horizontal con el carril', async ({ browser }) => {
  for (const [w, h, movil] of [[800, 1280, true], [1280, 800, false]] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await preparar(page, 'oscuro');
    await page.goto('#/cap05/sec-5.3');
    await expect(page.locator(movil ? 'nav.pestanas' : 'nav.carril')).toBeVisible();
    await expect(page.locator(movil ? 'nav.carril' : 'nav.pestanas[aria-label="Secciones de la aplicación"]')).toHaveCount(0);
    // reading: the index is a drawer (portrait) or the panel (landscape)
    const ind = page.getByRole('complementary', { name: 'Índice del libro' });
    if (movil) await expect(ind).toBeHidden();
    else await expect(ind).toBeVisible();
    for (const r of ['#/cap05/sec-5.3', '#/instrumentos', '#/consolas/saturn/foto', '#/glosario', '#/']) {
      await ir(page, r);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${r} ${w}×${h}`).toBeLessThanOrEqual(0);
    }
    await ctx.close();
  }
});

test('las pestañas del sistema (Pestanas21) se manejan con el teclado: ← → Inicio Fin', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await preparar(page, 'oscuro');
  await page.goto('#/marcadores');
  const fila = page.getByRole('tablist', { name: 'Mostrar' });
  const tab = (n: string | RegExp) => fila.getByRole('tab', { name: n });
  await expect(tab('Todo')).toHaveAttribute('aria-selected', 'true');
  // only the selected tab is in the Tab order
  await expect(fila.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  await tab('Todo').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(/^Marcadores/)).toHaveAttribute('aria-selected', 'true');
  await expect(tab(/^Marcadores/)).toBeFocused();
  await page.keyboard.press('End');
  await expect(tab(/^Notas/)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Todavía no hay notas' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(tab('Todo')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(tab(/^Notas/)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tab('Todo')).toBeFocused();
});

test('un solo acento para lo que se pulsa: el botón principal es --v11-azul, no el color del capítulo', async ({ browser }) => {
  for (const tema of ['oscuro', 'sepia'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await preparar(page, tema);
    // a chapter with an accent of its own (the reader sets --acento from the part's colour)
    await page.goto('#/cap05');
    await expect(page.locator('html')).toHaveAttribute('data-tema', tema);
    const colores = await page.evaluate(() => {
      const b = document.createElement('button');
      b.className = 'boton primario';
      b.textContent = 'Comprobar';
      document.querySelector('main')!.append(b);
      const cs = getComputedStyle(b);
      const raiz = getComputedStyle(document.documentElement);
      const azul = document.createElement('span');
      azul.style.color = raiz.getPropertyValue('--v11-azul');
      document.body.append(azul);
      const r = { fondo: cs.backgroundColor, alto: b.getBoundingClientRect().height, radio: cs.borderTopLeftRadius, peso: cs.fontWeight, azul: getComputedStyle(azul).color };
      b.remove();
      azul.remove();
      return r;
    });
    expect(colores.fondo, tema).toBe(colores.azul);
    expect(colores.alto, tema).toBe(48);
    expect(colores.radio, tema).toBe('14px');
    expect(colores.peso, tema).toBe('600');
    await ctx.close();
  }
});

test('«Aa» ya no pide «Su nombre» (el saludo del inicio se fue); el dato guardado sigue intacto', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('nombre21')) return;
    sessionStorage.setItem('nombre21', '1');
    localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'sepia', nombre: 'Ada' }));
  });
  await page.goto('#/');
  await page.getByRole('button', { name: 'Tema y tamaño de letra' }).click();
  const ajustes = page.getByRole('dialog', { name: 'Tema y tamaño de letra' });
  await expect(ajustes).toBeVisible();
  await expect(ajustes.getByLabel('Su nombre')).toHaveCount(0);
  await page.getByRole('button', { name: 'Letra más grande' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('epa:prefs') ?? '{}').nombre)).toBe('Ada');
});

// ------------------------------------------------------------------ owner's item 6: «Buscar» reaches the app's places

async function buscarLugar(page: Page, q: string) {
  const dialogo = page.getByRole('dialog', { name: 'Buscar en el libro' });
  if (!(await dialogo.isVisible())) await page.locator('header.barra').getByRole('button', { name: 'Buscar' }).click();
  const campo = dialogo.getByRole('searchbox', { name: 'Buscar en el libro' });
  await campo.fill(q);
  return { dialogo, campo, app: dialogo.getByRole('group', { name: 'En la aplicación' }) };
}

test('«Buscar» lleva también a las partes, los instrumentos, las consolas, las calculadoras y los proyectos', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1366, height: 900 });
  await preparar(page, 'sepia');
  await page.goto('#/');
  const casos: [string, string, RegExp][] = [
    ['osciloscopio', 'FNIRSI 2C53T', /#\/instrumentos\/libre$/],
    ['multimetro', 'Brymen BM869s', /#\/instrumentos\/libre$/],
    ['protoboard', 'Protoboard', /#\/protoboard$/],
    ['saturn', 'Sega Saturn', /#\/consolas\/saturn\/foto$/],
    ['snes', 'Super Nintendo', /#\/consolas\/snes\/foto$/],
    ['kit fm', 'Kit FM7303', /#\/fm7303$/],
    ['guia', 'Guía de uso', /#\/guia$/],
    ['SINCRONIZACION', 'Sincronización', /#\/sincronizacion$/],
    ['docente', 'Modo docente', /#\/docente$/],
    ['calculadoras', 'Calculadoras', /#\/calculadoras$/],
  ];
  for (const [q, titulo, destino] of casos) {
    const { app, campo } = await buscarLugar(page, q);
    await expect(app.getByRole('option').first(), q).toContainText(titulo);
    // the first option is selected: Enter opens it
    await expect(app.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await campo.press('Enter');
    await expect(page, q).toHaveURL(destino);
    await expect(page.getByRole('dialog', { name: 'Buscar en el libro' })).toHaveCount(0);
  }
  // each of the eleven consoles by its name
  for (const nombre of ['NES', 'Neo Geo', 'Master System', 'Mega Drive', 'Game Boy', 'Game Boy Color', 'Super Nintendo', 'Nintendo 64', 'PlayStation', 'GameCube', 'Sega Saturn']) {
    const { app } = await buscarLugar(page, nombre);
    await expect(app.getByRole('option').first(), nombre).toContainText(nombre);
  }
  // a calculator and a book project (fetched when the search opens)
  let r = await buscarLugar(page, 'constante de tiempo rc');
  await expect(r.app.getByRole('option', { name: /Constante de tiempo RC/ })).toBeVisible();
  r = await buscarLugar(page, 'estacion iot');
  await expect(r.app.getByRole('option', { name: /Estación de medida ambiental IoT/ })).toBeVisible();
  await r.app.getByRole('option', { name: /Estación de medida ambiental IoT/ }).click();
  await expect(page).toHaveURL(/#\/proyectos\/estacion_iot\/placa$/);
  // the book's results are still there, after the places
  r = await buscarLugar(page, 'diodo zener');
  await expect(r.dialogo.getByRole('group', { name: 'En el libro' }).getByRole('option').first()).toBeVisible();
  // the keyboard walks both lists as one
  r = await buscarLugar(page, 'osciloscopio');
  const n = await r.app.getByRole('option').count();
  for (let k = 0; k < n; k++) await r.campo.press('ArrowDown');
  await expect(r.dialogo.getByRole('group', { name: 'En el libro' }).getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
});

// ------------------------------------------------------------------ owner's item 7: each group remembers its tab

test('cada grupo recuerda su última pestaña (solo en memoria); pulsar el grupo activo lleva a su primera parte', async ({ browser }) => {
  for (const movil of [false, true]) {
    const ctx = await browser.newContext(movil ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await preparar(page, 'oscuro');
    await page.goto('#/');
    const claves = async () => page.evaluate(() => Object.keys(localStorage).sort().join(','));
    const antes = await claves();
    const nav = page.getByRole('navigation', { name: 'Secciones de la aplicación' });
    const grupo = (g: string) => nav.locator(`[data-grupo="${g}"]`);
    const pulsar = async (g: string) => (movil ? grupo(g).tap() : grupo(g).click());
    // Taller opens on its first part; then Calculadoras from its tabs
    await pulsar('taller');
    await expect(page).toHaveURL(/#\/simulador$/);
    await page.getByRole('navigation', { name: 'Partes de Taller' }).getByRole('link', { name: 'Calculadoras' }).click();
    await expect(page).toHaveURL(/#\/calculadoras$/);
    // Libro → Glosario; Aprender → Repaso
    await pulsar('libro');
    await page.getByRole('navigation', { name: 'Partes de Libro' }).getByRole('link', { name: 'Glosario' }).click();
    await expect(page).toHaveURL(/#\/glosario$/);
    await pulsar('aprender');
    await page.getByRole('navigation', { name: 'Partes de Aprender' }).getByRole('link', { name: 'Repaso' }).click();
    await expect(page).toHaveURL(/#\/repaso$/);
    // back to each group: where it was left
    await pulsar('taller');
    await expect(page).toHaveURL(/#\/calculadoras$/);
    await pulsar('libro');
    await expect(page).toHaveURL(/#\/glosario$/);
    await pulsar('aprender');
    await expect(page).toHaveURL(/#\/repaso$/);
    // the group on screen, pressed again: its first part
    await pulsar('aprender');
    await expect(page).toHaveURL(/#\/cursos$/);
    // nothing stored for it (no key of its own; the pages visited may write theirs)
    await page.waitForTimeout(300);
    const nuevas = (await claves()).split(',').filter((k) => k && !antes.split(',').includes(k));
    // («epa:pestana» in sessionStorage is the browser tab's own id, lib/pestana-activa.ts, there since 1.0)
    expect(nuevas.filter((k) => /grupo|ultim|naveg/i.test(k))).toEqual([]);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => /grupo|ultim|naveg/i.test(k)))).toEqual([]);
    // a reload forgets it: Taller opens on its first part again
    await page.reload();
    await pulsar('taller');
    await expect(page).toHaveURL(/#\/simulador$/);
    await ctx.close();
  }
});

test('el armazón no mueve la página al cargar: la fila de pestañas ocupa su sitio desde el primer fotograma', async ({ browser }) => {
  for (const [w, h] of [[800, 1280], [412, 915], [1366, 900]] as const) {
    for (const ruta of ['#/instrumentos', '#/cap05', '#/glosario']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 1024, hasTouch: w < 1024 });
      const page = await ctx.newPage();
      await preparar(page, 'oscuro');
      // the top of <main> at every frame from the start
      await page.addInitScript(() => {
        const tops: number[] = [];
        (window as unknown as { __tops: number[] }).__tops = tops;
        const t0 = performance.now();
        const mirar = () => {
          const m = document.querySelector('main');
          if (m) tops.push(Math.round(m.getBoundingClientRect().top + scrollY));
          if (performance.now() - t0 < 4000) requestAnimationFrame(mirar);
        };
        requestAnimationFrame(mirar);
      });
      await page.goto(ruta);
      await page.waitForTimeout(4300);
      const tops = await page.evaluate(() => (window as unknown as { __tops: number[] }).__tops);
      expect(tops.length, `${ruta} ${w}`).toBeGreaterThan(10);
      expect([...new Set(tops)], `${ruta} ${w}×${h}: <main> se movió`).toHaveLength(1);
      await ctx.close();
    }
  }
});
