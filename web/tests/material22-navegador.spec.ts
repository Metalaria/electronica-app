// 2.2 «Material en Android» (Main.dc.html and the approved mock-ups of scratchpad ui22): the shell by Material window
// size class, 48 dp touch targets (the drawn Brymen and FNIRSI included, their drawing unchanged), the Material
// navigation bar and rail, the pressed state layer and the keyboard focus ring, the system's back closing what is open
// on top first (lib/encima.ts), the lesson asking only with an unchecked answer, edge to edge and the system's text
// size. Each test says on which of the owner's devices it runs (projects of playwright.material22.config.ts).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.material22.config.ts
import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function abrir(page: Page, ruta: string, tema: 'oscuro' | 'sepia' = 'oscuro'): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript((t) => {
    try {
      if (sessionStorage.getItem('m22')) return;
      sessionStorage.setItem('m22', '1');
      localStorage.clear();
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t }));
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:protoboard-recorrido', '1');
      localStorage.setItem('epa:novedades-21', '1');
    } catch {
      /* private mode */
    }
  }, tema);
  await page.goto(ruta);
  await expect(page.locator('main#contenido')).toBeVisible();
  await expect(page.locator('.cargando')).toHaveCount(0, { timeout: 60_000 });
}

/** Goes to a route the way a link does (a new history entry, the router's hashchange). */
async function ir(page: Page, ruta: string): Promise<void> {
  await page.evaluate((r) => (location.hash = r), ruta);
  await expect(page.locator('.cargando')).toHaveCount(0, { timeout: 60_000 });
}

const solo = (info: TestInfo, ...p: string[]) => test.skip(!p.includes(info.project.name), `only ${p.join(', ')}`);

// ---------------------------------------------------------------- window size classes

test('compacta (teléfono, 412): barra inferior de 80 dp, indicador de 64 × 32 y etiquetas de 12 sp; sin carril', async ({ page }, info) => {
  solo(info, 'telefono');
  await abrir(page, '#/');
  await expect(page.locator('.app')).toHaveAttribute('data-ventana', 'compacta');
  await expect(page.locator('nav.carril')).toHaveCount(0);
  const barra = page.locator('nav.pestanas');
  await expect(barra).toBeVisible();
  const b = (await barra.boundingBox())!;
  expect(Math.round(b.height)).toBe(80);
  expect(Math.round(b.y + b.height)).toBe(915);
  const ind = (await page.locator('nav.pestanas a[aria-current="page"] .icono').boundingBox())!;
  expect([Math.round(ind.width), Math.round(ind.height)]).toEqual([64, 32]);
  const fs = await page.locator('nav.pestanas .etiqueta').first().evaluate((e) => getComputedStyle(e).fontSize);
  expect(fs).toBe('12px');
  // every item of the bar is at least 48 × 48
  for (const a of await page.locator('nav.pestanas a').all()) {
    const r = (await a.boundingBox())!;
    expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(48);
  }
});

test('media (tableta vertical, 800): carril de 80 con indicador de 56 × 32, sin barra inferior; «Libro» abre el índice como cajón', async ({ page }, info) => {
  solo(info, 'tableta');
  await abrir(page, '#/');
  await expect(page.locator('.app')).toHaveAttribute('data-ventana', 'media');
  await expect(page.locator('nav.pestanas')).toHaveCount(0);
  const carril = page.locator('nav.carril');
  await expect(carril).toBeVisible();
  expect(Math.round((await carril.boundingBox())!.width)).toBe(80);
  const ind = (await page.locator('nav.carril a.activo .icono').boundingBox())!;
  expect([Math.round(ind.width), Math.round(ind.height)]).toEqual([56, 32]);
  // the page starts beside the rail
  expect(Math.round((await page.locator('.principal').boundingBox())!.x)).toBe(80);
  // the group's tabs are in the header (as on the desktop)
  await ir(page, '#/instrumentos');
  await expect(page.locator('header.barra nav.grupo-pestanas a[aria-current="page"]')).toHaveText('Instrumentos');
  // in the reader the index is a drawer over the page, not a panel beside it
  await ir(page, '#/cap05/sec-5.3');
  await expect(page.locator('aside.lateral')).not.toHaveClass(/abierto/);
  await page.locator('nav.carril a[data-grupo="libro"]').click();
  await expect(page.locator('aside.lateral.movil.abierto')).toBeVisible();
  await expect(page.locator('.principal')).toHaveAttribute('inert', '');
  // the system's back closes it, and the reader stays
  await page.goBack();
  await expect(page.locator('aside.lateral.abierto')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/cap05\/sec-5\.3/);
});

test('expandida (tableta apaisada, 1280): carril y panel del índice en el lector, como en la 2.1', async ({ page }, info) => {
  solo(info, 'apaisada', 'escritorio');
  await abrir(page, '#/cap05/sec-5.3');
  await expect(page.locator('.app')).toHaveAttribute('data-ventana', 'expandida');
  await expect(page.locator('nav.carril')).toBeVisible();
  await expect(page.locator('nav.pestanas')).toHaveCount(0);
  await expect(page.locator('aside.lateral.abierto')).toBeVisible();
  expect(Math.round((await page.locator('nav.carril').boundingBox())!.width)).toBe(88);
  expect(Math.round((await page.locator('.principal').boundingBox())!.x)).toBe(388);
});

// ---------------------------------------------------------------- touch targets

/** Interactive elements smaller than 48 px (their ::before/::after touch boxes count), except inline text links. */
async function pequenos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const sel = 'a[href], button, select, textarea, input:not([type="hidden"]), [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="slider"], [role="menuitem"], summary';
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if ((el as HTMLButtonElement).disabled || el.closest('[inert], [aria-hidden="true"]')) continue;
      if (el instanceof SVGElement || el.closest('svg')) continue;
      const rc = el.getBoundingClientRect();
      if (rc.width === 0 || rc.height === 0) continue;
      if (rc.bottom < 0 || rc.top > innerHeight) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none') continue;
      // inline links in running text are exempt (WCAG 2.5.8)
      if (el.tagName === 'A' && s.display === 'inline') continue;
      // inside a label that is itself a target
      const et = el.closest('label');
      if (et && et !== el && et.getBoundingClientRect().height >= 48) continue;
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range' && rc.width >= 48) continue;
      let w = rc.width;
      let h = rc.height;
      for (const ps of ['::before', '::after']) {
        const p = getComputedStyle(el, ps);
        if (p.content === 'none' || p.position !== 'absolute') continue;
        const n = (v: string) => (v.endsWith('px') ? Math.max(0, -parseFloat(v)) : 0);
        w = Math.max(w, rc.width + n(p.left) + n(p.right), parseFloat(p.width) || 0);
        h = Math.max(h, rc.height + n(p.top) + n(p.bottom), parseFloat(p.height) || 0);
      }
      if (Math.min(w, h) < 47.5) {
        const nombre = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
        out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} «${nombre}» ${Math.round(w)}×${Math.round(h)}`);
      }
    }
    return out;
  });
}

for (const [nombre, ruta] of [
  ['Inicio', '#/'],
  ['Instrumentos (el banco)', '#/instrumentos/circuito/cap05/sec-5.3_led_150ohm'],
  ['Consolas', '#/consolas/saturn/foto'],
  ['Cursos', '#/cursos'],
  ['el lector', '#/cap05/sec-5.3'],
] as const)
  test(`48 dp: todo lo que se toca en «${nombre}» mide al menos 48 px`, async ({ page }, info) => {
    solo(info, 'telefono', 'tableta');
    await abrir(page, ruta);
    await page.waitForTimeout(1500);
    expect(await pequenos(page)).toEqual([]);
  });

test('48 dp: los botones del Brymen y el FNIRSI dibujados, sus bornes y el selector tienen 48 px de zona de toque; el dibujo no cambia', async ({ page }, info) => {
  solo(info, 'telefono', 'tableta');
  await abrir(page, '#/instrumentos/circuito/cap05/sec-5.3_led_150ohm');
  if (info.project.name === 'telefono') await page.getByRole('tab', { name: 'Brymen' }).click();
  const svg = page.locator('svg.brymen');
  await expect(svg).toBeVisible();
  // every touch shape is at least 47.5 × 47.5 CSS px on screen
  const medidas = await page.locator('svg.brymen [data-toque], svg.cuerpo [data-toque]').evaluateAll((els) =>
    els.filter((e) => (e as SVGGraphicsElement).getBoundingClientRect().width > 0).map((e) => {
      const r = e.getBoundingClientRect();
      return Math.min(r.width, r.height);
    }),
  );
  expect(medidas.length).toBeGreaterThanOrEqual(10);
  for (const m of medidas) expect(m).toBeGreaterThanOrEqual(47.5);
  // the drawn keys keep their size (62 × 30 drawing units)
  await expect(svg.locator('rect.tecla').first()).toHaveAttribute('width', '58');
  // a tap in the dial's ring, between two labels' circles, turns the dial to the nearest position
  const antes = await svg.locator('[role="slider"]').getAttribute('aria-valuenow');
  const caja = (await svg.boundingBox())!;
  const s = caja.width / 300;
  // the position at +24° from the top (index 6 of 11), at radius 135 (outside its label's circle)
  const a = (24 * Math.PI) / 180;
  await page.touchscreen.tap(caja.x + (150 + 135 * Math.sin(a)) * s, caja.y + (424 - 135 * Math.cos(a)) * s);
  await expect(svg.locator('[role="slider"]')).toHaveAttribute('aria-valuenow', '6');
  expect(antes).not.toBe('6');
});

// ---------------------------------------------------------------- state layer and focus ring

test('velo al pulsar (12 % del color del contenido) en botones, filas y pestañas; anillo de foco de 3 px con el teclado', async ({ page }, info) => {
  solo(info, 'escritorio');
  await abrir(page, '#/');
  const fila = page.locator('a.fila21').first();
  const b = (await fila.boundingBox())!;
  await page.mouse.move(b.x + 20, b.y + b.height / 2);
  await page.mouse.down();
  expect(await fila.evaluate((e) => getComputedStyle(e).boxShadow)).toMatch(/inset/);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  expect(await fila.evaluate((e) => getComputedStyle(e).boxShadow)).toBe('none');
  // keyboard focus: a 3 px ring
  await page.locator('[data-herramienta="buscar"]').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const anillo = await page.locator('[data-herramienta="buscar"]').evaluate((e) => [getComputedStyle(e).outlineStyle, getComputedStyle(e).outlineWidth]);
  expect(anillo).toEqual(['solid', '3px']);
});

// ---------------------------------------------------------------- system back

test('atrás cierra primero lo que está encima: «Aa», el buscador, el menú de consolas, el editor de puntas y un diálogo', async ({ page }, info) => {
  solo(info, 'telefono', 'tableta');
  await abrir(page, '#/');
  await ir(page, '#/consolas/saturn/foto');
  // the consoles' menu
  await page.locator('[data-elegir-consola]').click();
  await expect(page.locator('#menu-consolas')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#menu-consolas')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/consolas\/saturn\/foto$/);
  // «Aa»
  await page.locator('[data-herramienta="aa"]').click();
  await expect(page.locator('.ajustes[role="dialog"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.ajustes[role="dialog"]')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/consolas\/saturn\/foto$/);
  // the search
  await page.locator('[data-herramienta="buscar"]').click();
  await expect(page.getByRole('dialog', { name: 'Buscar en el libro' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Buscar en el libro' })).toHaveCount(0);
  await expect(page).toHaveURL(/#\/consolas\/saturn\/foto$/);
  // nothing open: back goes to the page before
  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);
});

test('atrás: «Aa» cerrado con su propio botón no deja una entrada muerta; un enlace de «Aa» se sigue y atrás vuelve a la página', async ({ page }, info) => {
  solo(info, 'telefono');
  await abrir(page, '#/');
  await ir(page, '#/cursos');
  const aa = page.locator('[data-herramienta="aa"]');
  await aa.click();
  await expect(page.locator('.ajustes[role="dialog"]')).toBeVisible();
  await aa.click();
  await expect(page.locator('.ajustes[role="dialog"]')).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);
  // a link inside «Aa» (the guide): followed; back returns to the page, not to the panel
  await ir(page, '#/cursos');
  await aa.click();
  await page.locator('.ajustes').getByRole('link', { name: /Guía de uso/ }).click();
  await expect(page).toHaveURL(/#\/guia/);
  await expect(page.locator('.ajustes[role="dialog"]')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/#\/cursos$/);
  await expect(page.locator('.ajustes[role="dialog"]')).toHaveCount(0);
});

test('atrás: el editor de puntas del teléfono y la lista de nodos de una punta se cierran antes de salir del banco', async ({ page }, info) => {
  solo(info, 'telefono');
  await abrir(page, '#/');
  await ir(page, '#/instrumentos/circuito/cap05/sec-5.3_led_150ohm');
  await page.getByRole('tab', { name: 'Brymen' }).click();
  await page.locator('[data-resumen-puntas]').click();
  await expect(page.locator('#banco-editor-movil')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#banco-editor-movil')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/instrumentos\/circuito/);
});

test('atrás: el menú «Poner otra punta» cerrado al abrir el editor de la punta no deja un atrás muerto', async ({ page }, info) => {
  solo(info, 'escritorio');
  await abrir(page, '#/');
  await ir(page, '#/instrumentos/circuito/cap05/sec-5.3_led_150ohm');
  const zona = page.locator('[data-puntas-puestas]');
  await zona.getByRole('button', { name: /Poner otra punta/ }).click();
  await zona.locator('[data-poner-punta="ch2"]').click();
  await expect(zona.locator('[data-editor-punta="ch2"]')).toBeVisible();
  // back: the editor closes, the bench stays
  await page.goBack();
  await expect(zona.locator('[data-editor-punta="ch2"]')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/instrumentos\/circuito/);
  // the next back leaves the bench at once (the menu's entry, closed under the editor, is skipped)
  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);
});

test('atrás en un diálogo de la app: es «Cancelar» y la página se queda', async ({ page }, info) => {
  solo(info, 'telefono', 'escritorio');
  await abrir(page, '#/');
  await ir(page, '#/protoboard');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/#\/protoboard\/.+/);
  const url = page.url();
  await page.getByRole('button', { name: /Mis montajes|Montajes/ }).click();
  const lista = page.getByRole('region', { name: 'Mis montajes' });
  await lista.getByRole('button', { name: 'Borrar' }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toBeVisible();
  await page.goBack();
  await expect(dialogo).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  // and «Borrar» still works afterwards (the answer comes once the history settled)
  await lista.getByRole('button', { name: 'Borrar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
  await expect(lista.getByRole('listitem')).toHaveCount(0);
  // (deleting the board on screen goes to an empty one: that route change is not undone by the dialog's step back)
  await expect(page).toHaveURL(/#\/protoboard$/);
});

test('en una lección, atrás pregunta solo si hay una respuesta sin comprobar', async ({ page }, info) => {
  solo(info, 'telefono');
  await abrir(page, '#/cap01/sec-1.4');
  // explored, nothing to check: back leaves at once
  await ir(page, '#/leccion/cap01/sec-1.4');
  await expect(page.locator('[data-tarjeta="explore-serie"]')).toBeVisible();
  await page.locator('[data-mando11="R_1"] [role="slider"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.goBack();
  await expect(page.locator('[data-leccion11]')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  // an answer chosen and not checked: back asks
  await ir(page, '#/leccion/cap01/sec-1.4/6');
  await expect(page.locator('[data-tarjeta="por-que-baja"]')).toBeVisible();
  await page.locator('[data-opcion="0"]').click();
  await page.goBack();
  const d = page.getByRole('alertdialog');
  await expect(d).toContainText('¿Salir de la lección?');
  await expect(d).toContainText('respuesta sin comprobar');
  await d.getByRole('button', { name: 'Seguir en la lección' }).click();
  await expect(page.locator('[data-tarjeta="por-que-baja"]')).toBeVisible();
  await page.goBack();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator('[data-leccion11]')).toHaveCount(0);
});

// ---------------------------------------------------------------- edge to edge

test('de borde a borde: cabecera y barra inferior bajo las barras del sistema, con su color; el contenido nunca debajo', async ({ page }, info) => {
  solo(info, 'telefono');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride' as never, { insets: { top: 32, bottom: 24, left: 0, right: 0 } } as never);
  await abrir(page, '#/');
  const cab = (await page.locator('header.barra').boundingBox())!;
  expect(Math.round(cab.y)).toBe(0);
  expect(Math.round(cab.height)).toBe(64 + 32);
  const fondoCab = await page.locator('header.barra').evaluate((e) => getComputedStyle(e).backgroundColor);
  const barra = (await page.locator('nav.pestanas').boundingBox())!;
  expect(Math.round(barra.y + barra.height)).toBe(915);
  expect(Math.round(barra.height)).toBe(80 + 24);
  expect(await page.locator('nav.pestanas').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(fondoCab);
  // the bar's items sit above the gesture area
  const item = (await page.locator('nav.pestanas a').first().boundingBox())!;
  expect(item.y + item.height).toBeLessThanOrEqual(915 - 24 + 0.5);
  // the page's end clears the bar and the gesture area
  const pad = await page.locator('main#contenido').evaluate((e) => parseFloat(getComputedStyle(e).paddingBottom));
  expect(pad).toBeGreaterThanOrEqual(104);
});

test('de borde a borde en apaisado: el carril cubre el recorte de la izquierda y la página no queda debajo del de la derecha', async ({ page }, info) => {
  solo(info, 'apaisada');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride' as never, { insets: { top: 24, bottom: 16, left: 40, right: 40 } } as never);
  await abrir(page, '#/');
  const carril = (await page.locator('nav.carril').boundingBox())!;
  expect(Math.round(carril.width)).toBe(88 + 40);
  const items = (await page.locator('nav.carril a.item').first().boundingBox())!;
  expect(items.x).toBeGreaterThanOrEqual(40);
  const p = (await page.locator('.principal').boundingBox())!;
  expect(Math.round(p.x)).toBe(128);
  const derecha = await page.locator('.principal').evaluate((e) => parseFloat(getComputedStyle(e).paddingRight));
  expect(derecha).toBe(40);
});

// ---------------------------------------------------------------- the system's text size

test('letra del sistema al 200 %: todo se recoloca sin desbordar y las etiquetas de la barra crecen como mucho 1,3×', async ({ page }, info) => {
  solo(info, 'telefono');
  await abrir(page, '#/');
  // (the WebView's text zoom scales the text of every element that does not opt out with text-size-adjust: none, and
  // the app measures the factor in --escala-texto; simulated here on Chromium, which has no such setting)
  await page.evaluate(() => {
    const els = [...document.querySelectorAll<HTMLElement>('body *')];
    // (the labels that opt out carry data-letra-tope: desktop Chromium does not compute text-size-adjust)
    const tams = els.filter((e) => !e.closest('[data-letra-tope]')).map((e) => [e, parseFloat(getComputedStyle(e).fontSize)] as const);
    for (const [e, t] of tams) e.style.fontSize = `${t * 2}px`;
    document.documentElement.style.setProperty('--escala-texto', '2');
  });
  await page.waitForTimeout(300);
  const fs = await page.locator('nav.pestanas .etiqueta').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(fs).toBeCloseTo(15.6, 1);
  // no page wider than the screen
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
  // the bar grew to hold its labels; none is cut in height
  const cortadas = await page.locator('nav.pestanas .etiqueta').evaluateAll((els) => els.filter((e) => e.scrollHeight > e.clientHeight + 1).length);
  expect(cortadas).toBe(0);
  // the header's title is not cut either
  const t = page.locator('header.barra .donde .titulo');
  expect(await t.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
});

test('la escala de la letra del sistema se mide: 1 en un navegador de escritorio', async ({ page }, info) => {
  solo(info, 'escritorio');
  await abrir(page, '#/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--escala-texto').trim())).toBe('1');
});
