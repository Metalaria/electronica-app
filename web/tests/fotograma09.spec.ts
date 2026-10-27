// «Un fotograma» (0.9): the step-by-step explanation of how one pixel of a frame comes to exist on each console.
// Every console has between 10 and 16 steps; «Siguiente», «Anterior», the segmented bar, the keys ← → and
// «Reproducir» / «Pausa» move through them; the step lives in the URL; the chips and wires lit by every step exist in
// that console's diagram; and on a phone no text leaves the screen.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.fotograma09.config.ts tests/fotograma09.spec.ts
// Screenshots: node tests/fotograma09-capturas.mjs (tests/capturas/fotograma09/).
import { expect, test, type Page } from '@playwright/test';

const MAQUINAS = ['nes', 'neogeo', 'sms', 'megadrive', 'gb', 'gbc', 'snes'] as const;

interface Gancho {
  maquina: string;
  total: number;
  paso: number;
  capa: string;
  bloques: string[];
  senales: string[];
  reproduciendo: boolean;
  duracion: number;
}

const gancho = (page: Page) => page.evaluate(() => (globalThis as unknown as { __epaFotograma: Gancho }).__epaFotograma);

async function abrir(page: Page, maquina: string, paso?: number): Promise<void> {
  await page.goto(`#/consolas/${maquina}/fotograma${paso ? `/${paso}` : ''}`);
  await expect(page.locator(`[data-fotograma="${maquina}"] h2`)).toBeVisible();
}

test('cada consola tiene entre 10 y 16 pasos', async ({ page }) => {
  for (const m of MAQUINAS) {
    await abrir(page, m);
    await expect(page.getByRole('navigation', { name: 'Vista' }).getByRole('link', { name: 'Un fotograma', exact: true })).toHaveAttribute('aria-current', 'page');
    const g = await gancho(page);
    expect(g.maquina).toBe(m);
    expect(g.total).toBeGreaterThanOrEqual(10);
    expect(g.total).toBeLessThanOrEqual(16);
    await expect(page.locator('[data-cuenta]')).toHaveText(`1/${g.total}`);
    await expect(page.locator('.segmentos .seg')).toHaveCount(g.total);
  }
});

test('Siguiente, Anterior, la barra, el teclado y la URL', async ({ page }) => {
  await abrir(page, 'nes');
  const raiz = page.locator('[data-fotograma="nes"]');
  await expect(page.locator('[data-anterior]')).toBeDisabled();
  await page.locator('[data-siguiente]').click();
  await expect(raiz).toHaveAttribute('data-paso', '2');
  await expect(page).toHaveURL(/#\/consolas\/nes\/fotograma\/2$/);
  await expect(page.locator('[data-cuenta]')).toHaveText('2/15');
  await page.locator('[data-anterior]').click();
  await expect(raiz).toHaveAttribute('data-paso', '1');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(raiz).toHaveAttribute('data-paso', '3');
  await page.keyboard.press('ArrowLeft');
  await expect(raiz).toHaveAttribute('data-paso', '2');
  // a segment jumps to its step
  await page.getByRole('button', { name: /^Paso 10:/ }).click();
  await expect(raiz).toHaveAttribute('data-paso', '10');
  await expect(page.locator('#fotograma-titulo')).toContainText('planos');
  await expect(page).toHaveURL(/fotograma\/10$/);
  // the step survives a reload, and a link opens the step it names
  await page.reload();
  await expect(raiz).toHaveAttribute('data-paso', '10');
  await page.goto('#/consolas/gb/fotograma/7');
  await expect(page.locator('[data-fotograma="gb"]')).toHaveAttribute('data-paso', '7');
  await expect(page.locator('#fotograma-titulo')).toHaveText('Modo 2: la PPU busca los sprites de la línea');
  // out of range: the last step
  await page.goto('#/consolas/gb/fotograma/99');
  await page.reload();
  await expect(page.locator('[data-fotograma="gb"]')).toHaveAttribute('data-paso', '14');
  await expect(page.locator('[data-siguiente]')).toContainText('Desde el principio');
  await page.locator('[data-siguiente]').click();
  await expect(page.locator('[data-fotograma="gb"]')).toHaveAttribute('data-paso', '1');
});

test('Reproducir avanza solo y Pausa lo para', async ({ page }) => {
  await page.clock.install();
  await abrir(page, 'sms');
  const raiz = page.locator('[data-fotograma="sms"]');
  await page.locator('[data-reproducir]').click();
  await expect(page.locator('[data-reproducir]')).toHaveAttribute('aria-label', 'Pausa');
  let g = await gancho(page);
  expect(g.reproduciendo).toBe(true);
  expect(g.duracion).toBeGreaterThanOrEqual(7000);
  await page.clock.runFor(g.duracion + 200);
  await expect(raiz).toHaveAttribute('data-paso', '2');
  g = await gancho(page);
  await page.clock.runFor(g.duracion + 200);
  await expect(raiz).toHaveAttribute('data-paso', '3');
  await page.locator('[data-reproducir]').click();
  await expect(page.locator('[data-reproducir]')).toHaveAttribute('aria-label', 'Reproducir');
  await page.clock.runFor(30_000);
  await expect(raiz).toHaveAttribute('data-paso', '3');
});

test('los chips y los cables de cada paso están en el diagrama de su consola', async ({ page }) => {
  for (const m of MAQUINAS) {
    await abrir(page, m, 1);
    const { total } = await gancho(page);
    for (let i = 1; i <= total; i++) {
      if (i > 1) await page.locator('[data-siguiente]').click();
      await expect(page.locator(`[data-fotograma="${m}"]`)).toHaveAttribute('data-paso', String(i));
      const g = await gancho(page);
      const faltan = await page.evaluate(({ bloques, senales }) => {
        const d = document.querySelector('.tarjeta-diagrama svg')!;
        const r: string[] = [];
        for (const b of bloques) if (!d.querySelector(`[data-bloque="${b}"][data-activo="true"]`)) r.push(`bloque ${b}`);
        for (const s of senales) if (!d.querySelector(`[data-conexion="${s}"][data-activa="true"]`)) r.push(`cable ${s}`);
        const encendidos = d.querySelectorAll('[data-activo="true"]').length;
        if (encendidos !== bloques.length) r.push(`${encendidos} bloques encendidos, ${bloques.length} en el paso`);
        return r;
      }, g);
      expect(faltan, `${m}, paso ${i}`).toEqual([]);
      expect(g.bloques.length, `${m}, paso ${i}: algún chip encendido`).toBeGreaterThan(0);
    }
  }
});

test.describe('en el móvil', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

  test('ningún texto se sale de la pantalla en ningún paso', async ({ page }) => {
    for (const m of MAQUINAS) {
      await abrir(page, m, 1);
      const { total } = await gancho(page);
      for (let i = 1; i <= total; i++) {
        if (i > 1) await page.locator('[data-siguiente]').click();
        await expect(page.locator(`[data-fotograma="${m}"]`)).toHaveAttribute('data-paso', String(i));
        const fuera = await page.evaluate(() => {
          const r: string[] = [];
          const ancho = document.documentElement.clientWidth;
          if (document.documentElement.scrollWidth > ancho) r.push(`la página mide ${document.documentElement.scrollWidth} px`);
          const raiz = document.querySelector('[data-fotograma]')!;
          for (const el of raiz.querySelectorAll<HTMLElement>('*')) {
            if (el instanceof SVGElement || el.closest('svg') || el.closest('.desliza')) continue;
            if (!(el.textContent ?? '').trim()) continue;
            const b = el.getBoundingClientRect();
            if (!b.width) continue;
            if (b.right > ancho + 0.5 || b.left < -0.5) r.push(`${el.tagName.toLowerCase()} «${(el.textContent ?? '').trim().slice(0, 40)}» de ${Math.round(b.left)} a ${Math.round(b.right)}`);
            else if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && el.children.length === 0)
              r.push(`${el.tagName.toLowerCase()} «${(el.textContent ?? '').trim().slice(0, 40)}» desborda su caja`);
          }
          return r;
        });
        expect(fuera, `${m}, paso ${i}`).toEqual([]);
      }
    }
  });
});
