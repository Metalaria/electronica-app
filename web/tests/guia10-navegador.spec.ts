// 1.0 «Guía de uso» in the browser: reached from the rail («Más»), from «Aa» and from the diagnostic; every section
// opens with the focus on its heading; the deep links («¿Cómo funciona?») land on their subsection; the filter; the
// keyboard; 44 px and no horizontal scroll on a phone; axe (contrast included) in light, sepia and dark; and offline:
// once the guide is open, every section and the filter work with the network cut (the content is in the bundle).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.guia10.config.ts tests/guia10-navegador.spec.ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { GUIA } from '../src/lib/guia/contenido.ts';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const libro = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'public', 'libro');
const J = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(libro, p), 'utf8')) as T;

type Tema = 'claro' | 'sepia' | 'oscuro';

async function limpio(page: Page, tema: Tema = 'claro'): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript((t) => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18, sonido: false, vibracion: false }));
    }
  }, tema);
}

/** The id of the focused element (or its tag). */
const foco = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || '');

test('se llega desde el carril («Más»), desde «Aa» y desde el diagnóstico', async ({ page }) => {
  await limpio(page);
  await page.goto('#/');
  const carril = page.getByRole('navigation', { name: 'Secciones de la aplicación' });
  await expect(carril).toBeVisible();
  // the last entry of the rail: on a 900 px window it is in «Más»
  await carril.getByRole('button', { name: /^Más/ }).click();
  await page.getByRole('menu', { name: 'Más secciones' }).getByRole('menuitem', { name: /Guía de uso/ }).click();
  await expect(page).toHaveURL(/#\/guia$/);
  await expect(page.locator('h1')).toHaveText('Guía de uso');
  await expect.poll(() => foco(page)).toBe('H1');
  await expect(page.locator('[data-tarjeta-guia]')).toHaveCount(GUIA.length);
  // the rail marks «Más» as holding the current entry
  await expect(carril.getByRole('button', { name: /^Más/ })).toHaveClass(/activo/);
  await expect(page).toHaveTitle('Guía de uso · Electrónica Práctica Avanzada');

  // «Aa» → «Ayuda» → «Guía de uso»
  await page.goto('#/');
  await page.getByRole('button', { name: 'Tema y tamaño de letra' }).click();
  const ajustes = page.getByRole('dialog', { name: 'Tema y tamaño de letra' });
  await ajustes.getByRole('link', { name: 'Guía de uso' }).click();
  await expect(page).toHaveURL(/#\/guia$/);
  await expect(ajustes).toHaveCount(0);

  // the diagnostic links to its own section
  await page.goto('#/diagnostico');
  await page.locator('[data-enlace-guia="diagnostico"]').click();
  await expect(page).toHaveURL(/#\/guia\/diagnostico$/);
  await expect(page.locator('h1')).toHaveText('Diagnóstico e informe de fallos');
});

test('cada sección se abre con el foco en su título, su índice y «Anterior» / «Siguiente»', async ({ page }) => {
  await limpio(page);
  await page.goto('#/guia');
  for (const [i, s] of GUIA.entries()) {
    await page.goto('#/guia');
    await page.locator(`[data-tarjeta-guia="${s.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#/guia/${s.id}$`));
    const art = page.locator(`[data-seccion-guia="${s.id}"]`);
    await expect(art).toBeVisible();
    await expect(page.locator('h1')).toHaveText(s.titulo);
    await expect.poll(() => foco(page), s.id).toBe('h-guia-seccion');
    // one landmark per role and name: the guide's own navigation, the article with its subsections
    await expect(page.getByRole('navigation', { name: 'Secciones de la guía' }).getByRole('link', { name: s.titulo })).toHaveAttribute('aria-current', 'page');
    await expect(art.locator('[data-apartado]')).toHaveCount(s.apartados.length);
    for (const a of s.apartados) await expect(art.getByRole('heading', { level: 2, name: a.titulo })).toBeVisible();
    await expect(art.locator('[data-enlace-app]')).toHaveCount(s.enlaces.length);
    // the heading order: h1, then h2 only
    const niveles = await art.evaluate((el) => [...el.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1])));
    expect(niveles[0], s.id).toBe(1);
    expect(niveles.slice(1).every((n) => n === 2), s.id).toBe(true);
    // neighbours
    const sig = page.getByRole('navigation', { name: 'Sección anterior y siguiente de la guía' }).locator('a[rel="next"]');
    if (i < GUIA.length - 1) await expect(sig).toHaveAttribute('href', `#/guia/${GUIA[i + 1]!.id}`);
    else await expect(sig).toHaveCount(0);
  }
  // «Siguiente» moves on and «Atrás» comes back
  await page.goto('#/guia/primeros-pasos');
  await page.locator('a[rel="next"]').click();
  await expect(page).toHaveURL(new RegExp(`#/guia/${GUIA[1]!.id}$`));
  await page.goBack();
  await expect(page).toHaveURL(/#\/guia\/primeros-pasos$/);
  await expect(page.locator('h1')).toHaveText(GUIA[0]!.titulo);
  // an «Abrir en la aplicación» link opens the app there
  await page.goto('#/guia/docente');
  await page.locator('[data-enlace-app="#/docente"]').click();
  await expect(page).toHaveURL(/#\/docente$/);
  await expect(page.locator('h1')).toHaveText('Modo docente');
  // an unknown section: says so and lists them all
  await page.goto('#/guia/no-existe');
  await expect(page.getByRole('status')).toContainText('No hay ninguna sección «no-existe»');
  await expect(page.locator('[data-tarjeta-guia]')).toHaveCount(GUIA.length);
});

test('los «¿Cómo funciona?» llevan a su apartado, con el foco en él', async ({ page }) => {
  await limpio(page);
  const ir = async (desde: string, enlace: string, apartadoDom: string, titulo: string) => {
    await page.goto(desde);
    const a = page.locator(`[data-enlace-guia="${enlace}"]`).first();
    await expect(a).toBeVisible({ timeout: 60_000 });
    await expect(a).toHaveAccessibleName('¿Cómo funciona? (guía de uso)');
    await a.click();
    await expect(page).toHaveURL(new RegExp(`#/guia/${enlace}$`));
    const h = page.locator(`#${apartadoDom}`);
    await expect(h).toHaveText(titulo);
    await expect.poll(() => foco(page), enlace).toBe(apartadoDom);
    await expect(h).toBeInViewport();
  };
  await ir('#/sincronizacion', 'datos/sincronizacion', 'guia-datos-sincronizacion', 'Sincronizar sus dispositivos');
  await page.goto('#/docente');
  await page.locator('[data-enlace-guia="docente"]').click();
  await expect(page).toHaveURL(/#\/guia\/docente$/);
  await expect.poll(() => foco(page)).toBe('h-guia-seccion');
  // «Encuentre la avería» inside a lesson
  const d = J<{ secciones: Record<string, { items: string[] }> }>('practica/cap01.json');
  const i = d.secciones['sec-1.4']!.items.indexOf('cap01-averia-fig-1.4-0-E2-abierta');
  expect(i).toBeGreaterThanOrEqual(0);
  await ir(`#/leccion/cap01/sec-1.4/practica-${i + 1}`, 'practica/averia', 'guia-practica-averia', '«Encuentre la avería»');
  // a deep link typed or bookmarked: the subsection, scrolled into view under the bar
  await page.goto('#/guia/repaso/repaso-espaciado');
  await expect.poll(() => foco(page)).toBe('guia-repaso-repaso-espaciado');
  await expect(page.locator('#guia-repaso-repaso-espaciado')).toBeInViewport();
  const arriba = await page.locator('#guia-repaso-repaso-espaciado').evaluate((el) => el.getBoundingClientRect().top);
  expect(arriba).toBeGreaterThanOrEqual(50);
});

test('el filtro de la guía, también con el teclado', async ({ page }) => {
  await limpio(page);
  await page.goto('#/guia/teclado');
  const campo = page.getByRole('searchbox', { name: 'Buscar en la guía' });
  await campo.fill('token caducado');
  const res = page.locator('[data-resultados-guia]');
  await expect(res).toBeVisible();
  await expect(page.locator('[data-resultado-guia="datos/sincronizacion"]')).toBeVisible();
  await expect(page.locator('#cuenta-guia')).toHaveText(/\d+ apartados?\./);
  // accents and case do not matter
  await campo.fill('AVERIA');
  const sinTilde = await page.locator('[data-resultado-guia]').count();
  await campo.fill('avería');
  await expect(page.locator('[data-resultado-guia]')).toHaveCount(sinTilde);
  await expect(page.locator('[data-resultado-guia]').first()).toHaveAttribute('data-resultado-guia', 'practica/averia');
  // with the keyboard: Tab goes to the first result, Intro opens it; the filter is cleared and the focus is on it
  await campo.focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-resultado-guia]').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/guia\/practica\/averia$/);
  await expect(campo).toHaveValue('');
  await expect(res).toHaveCount(0);
  await expect.poll(() => foco(page)).toBe('guia-practica-averia');
  // nothing found
  await campo.fill('zzqxw');
  await expect(page.locator('#cuenta-guia')).toHaveText('Nada en la guía con esas palabras.');
  await expect(page.locator('[data-resultados-guia="0"]')).toBeVisible();
});

async function tactil(browser: Browser, tema: Tema) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await limpio(page, tema);
  return { ctx, page };
}

const PANTALLAS: [string, () => string, ((p: Page) => Promise<void>)?][] = [
  ['índice', () => '#/guia'],
  ['sección', () => '#/guia/datos'],
  ['teclas', () => '#/guia/teclado'],
  ['filtro', () => '#/guia', async (p) => void (await p.getByRole('searchbox', { name: 'Buscar en la guía' }).fill('sincronizar'))],
];

test('en el teléfono: desde «Más», 44 px y sin desbordar', async ({ browser }) => {
  const { ctx, page } = await tactil(browser, 'claro');
  await page.goto('#/');
  const barra = page.getByRole('navigation', { name: 'Secciones de la aplicación' });
  await barra.getByRole('button', { name: 'Más' }).click();
  await page.getByRole('menu', { name: 'Más secciones' }).getByRole('menuitem', { name: /Guía de uso/ }).click();
  await expect(page).toHaveURL(/#\/guia$/);
  for (const [nombre, ruta, preparar] of PANTALLAS) {
    await page.goto(ruta());
    const zona = page.locator('[data-guia]');
    await expect(zona).toBeVisible();
    await preparar?.(page);
    await page.waitForTimeout(300);
    const pequenos = await zona.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('a, button, input')]
        .filter((x) => x.offsetParent)
        .map((x) => ({ n: (x.textContent || x.getAttribute('aria-label') || x.tagName).trim().slice(0, 30), r: x.getBoundingClientRect() }))
        .filter((x) => x.r.height < 44)
        .map((x) => `${x.n} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`),
    );
    expect(pequenos, nombre).toEqual([]);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(ancho, nombre).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});

test('accesibilidad (axe, contraste incluido) en claro, sepia y oscuro', async ({ browser }) => {
  for (const tema of ['claro', 'sepia', 'oscuro'] as const) {
    for (const vista of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport: vista });
      const page = await ctx.newPage();
      await limpio(page, tema);
      for (const [nombre, ruta, preparar] of PANTALLAS) {
        await page.goto(ruta());
        await expect(page.locator('[data-guia]')).toBeVisible();
        await preparar?.(page);
        await page.waitForTimeout(300);
        await page.addScriptTag({ path: AXE });
        const fallos = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
          const r = await axe.run({ include: [['[data-guia]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
          return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
        });
        expect(fallos, `${nombre} ${tema} ${vista.width}`).toEqual([]);
      }
      await ctx.close();
    }
  }
});

test('sin conexión: abierta la guía, todas las secciones y el filtro funcionan sin pedir nada', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await limpio(page);
  const externas: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) externas.push(r.url());
  });
  await page.goto('#/guia');
  await expect(page.locator('[data-tarjeta-guia]')).toHaveCount(GUIA.length);
  // one pass online first: the browser fetches the app's own font subsets (Greek for Ω, the monospace of the keys) only
  // when a page uses them; in the installed app they are local files like the rest
  for (const s of GUIA) {
    await page.goto(`#/guia/${s.id}`);
    await expect(page.locator(`[data-seccion-guia="${s.id}"]`)).toBeVisible();
  }
  await page.goto('#/guia');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const pedidas: string[] = [];
  page.on('request', (r) => pedidas.push(r.url()));
  await ctx.setOffline(true);
  for (const s of GUIA) {
    await page.goto(`#/guia/${s.id}`);
    await expect(page.locator(`[data-seccion-guia="${s.id}"]`)).toBeVisible();
    for (const a of s.apartados) await expect(page.locator(`#guia-${s.id}-${a.id}`)).toHaveText(a.titulo);
  }
  await page.getByRole('searchbox', { name: 'Buscar en la guía' }).fill('copia');
  await expect(page.locator('[data-resultado-guia="datos/copias"]')).toBeVisible();
  await page.goto('#/guia');
  await expect(page.locator('[data-tarjeta-guia]')).toHaveCount(GUIA.length);
  // the guide's content came with its chunk: moving around it asked nothing of the network
  expect(pedidas).toEqual([]);
  await ctx.setOffline(false);
  expect(externas).toEqual([]);
  await ctx.close();
});
