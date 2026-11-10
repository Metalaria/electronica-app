// 1.0 «Teoría que se mueve» (formulas of the text with sliders, reviewed by hand in contenido/teoria_viva_curado.json →
// libro/teoria-viva.json by web/scripts/teoria10.mjs): content (each piece sits on its own equation, starts at the
// book's values and gives the book's results, the generation is idempotent), slider keys, and in the browser the
// reader (discreet button) and a lesson (open), keyboard and pointer, aria-valuenow/valuetext with units, the result
// and graph following at once, 44 px, reduced motion, axe in light, sepia and dark.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejercicios10.config.ts tests/ejercicios10-teoria.spec.ts
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { curva, entorno, resultadoDe, teclaMando, type DatosTeoriaViva, type PiezaViva } from '../src/lib/teoria-viva';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..');
const LIBRO = join(WEB, 'public', 'libro');
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const datos: DatosTeoriaViva = JSON.parse(readFileSync(join(LIBRO, 'teoria-viva.json'), 'utf-8'));
const pieza = (f: string): PiezaViva => Object.values(datos.partes).flat().find((p) => p.formula === f)!;
const inicio = (p: PiezaViva) => Object.fromEntries(p.entradas.map((e) => [e.id, e.inicio]));

test('contenido: cada pieza está en su ecuación del libro, con rangos válidos, y se genera igual dos veces', () => {
  expect(datos.total).toBeGreaterThanOrEqual(12);
  const ecs = JSON.parse(readFileSync(join(LIBRO, 'formulas-ec.json'), 'utf-8'));
  for (const [parte, ps] of Object.entries(datos.partes)) {
    const bl = JSON.parse(readFileSync(join(LIBRO, 'partes', `${parte}.json`), 'utf-8')).bloques;
    for (const p of ps) {
      const b = bl[p.bloque];
      expect(b?.t, p.id).toBe('ec');
      expect(b.svg, p.id).toBe(p.svg);
      expect(ecs[b.svg], p.id).toContain(p.formula);
      for (const e of p.entradas) {
        expect(e.valores.length, `${p.id} ${e.id}`).toBeGreaterThanOrEqual(2);
        expect([...e.valores].sort((a, z) => a - z), `${p.id} ${e.id}`).toEqual(e.valores);
        expect(e.inicio >= 0 && e.inicio < e.valores.length, `${p.id} ${e.id}`).toBe(true);
      }
      const c = curva(p, inicio(p));
      expect(c.ys.filter(Number.isFinite).length, p.id).toBeGreaterThan(40);
    }
  }
  const antes = readFileSync(join(LIBRO, 'teoria-viva.json'), 'utf-8');
  const salida = execFileSync('node', ['scripts/teoria10.mjs'], { cwd: WEB, encoding: 'utf-8' });
  expect(salida).toContain('sin cambios');
  expect(readFileSync(join(LIBRO, 'teoria-viva.json'), 'utf-8')).toBe(antes);
});

test('contenido: los valores iniciales dan los resultados del libro (comprobados a mano por otro camino)', () => {
  // cap01 1.4: «Con 12 V, 10 kΩ y 5 kΩ, la salida es 4,00 V»
  expect(resultadoDe(pieza('divisor'), inicio(pieza('divisor')))).toBeCloseTo((12 * 5000) / 15000, 9);
  expect(resultadoDe(pieza('divisor'), inicio(pieza('divisor')))).toBeCloseTo(4, 9);
  // cap05 5.3: LED rojo de 2,0 V a 20 mA desde 5 V → 150 Ω
  expect(resultadoDe(pieza('resistencia-led'), inicio(pieza('resistencia-led')))).toBeCloseTo(150, 6);
  // cap03 3.2 (the box example): 10 kΩ, 100 µF, 9 V → τ = 1 s; at t = τ, 63,2 % of 9 V
  expect(resultadoDe(pieza('carga-rc-vcc'), inicio(pieza('carga-rc-vcc')))).toBeCloseTo(9 * 0.632, 2);
  // cap04 4.3: 10 mH and 100 Ω → τ = 100 µs; at t = τ the current is 63 % of V/R = 0,1 A
  expect(resultadoDe(pieza('corriente-rl'), inicio(pieza('corriente-rl')))).toBeCloseTo(0.1 * (1 - Math.exp(-1)), 6);
  // prob-5.A: Rs = 136 Ω with 9 V, 5,6 V, 5 mA and 20 mA
  expect(resultadoDe(pieza('zener-rs'), inicio(pieza('zener-rs')))).toBeCloseTo(136, 0);
  // E12 snapping: the divisor's R₁ walks through E12 values only
  const r1 = pieza('divisor').entradas.find((e) => e.id === 'R_1')!;
  expect(r1.valores).toContain(4700);
  expect(r1.valores).not.toContain(5000);
  const env = entorno(pieza('divisor'), { ...inicio(pieza('divisor')), R_1: r1.valores.indexOf(4700) });
  expect(env.R_1).toBe(4700);
});

test('teclas del deslizador: flechas, Re Pág / Av Pág, Inicio y Fin', () => {
  expect(teclaMando('ArrowRight', 3, 20)).toBe(4);
  expect(teclaMando('ArrowUp', 19, 20)).toBe(19);
  expect(teclaMando('ArrowLeft', 0, 20)).toBe(0);
  expect(teclaMando('ArrowDown', 5, 20)).toBe(4);
  expect(teclaMando('PageUp', 3, 20)).toBe(5);
  expect(teclaMando('PageDown', 1, 100)).toBe(0);
  expect(teclaMando('Home', 7, 20)).toBe(0);
  expect(teclaMando('End', 7, 20)).toBe(19);
  expect(teclaMando('a', 7, 20)).toBeNull();
});

async function limpio(page: Page, tema: 'claro' | 'sepia' | 'oscuro' = 'claro'): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript((t) => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 }));
    }
  }, tema);
}

test('en el lector: botón discreto; teclado y arrastre mueven el valor, el resultado y la gráfica al momento', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap01/sec-1.4');
  const t = page.locator('[data-teoria="divisor"]');
  await t.scrollIntoViewIfNeeded();
  await t.getByRole('button', { name: 'Mover los valores de esta fórmula' }).click();
  const r2 = t.getByRole('slider', { name: /R2|R₂/ });
  await expect(r2).toHaveAttribute('aria-valuenow', '5000');
  await expect(r2).toHaveAttribute('aria-valuetext', /^5 kiloohmios$/); // (1.1 motor fixes: the value in words)
  await expect(t.locator('output')).toHaveText(/^4\sV$/);
  const punto = async () => t.locator('circle.punto').getAttribute('cx');
  const antes = await punto();
  await r2.focus();
  await page.keyboard.press('ArrowRight'); // 5 k → 5,6 k
  await expect(r2).toHaveAttribute('aria-valuenow', '5600');
  await expect(r2).toHaveAttribute('aria-valuetext', /5,6 kiloohmios/);
  // 12 · 5,6 / 15,6 = 4,31 V
  await expect(t.locator('output')).toHaveText(/4,31\sV/);
  expect(await punto()).not.toBe(antes);
  await page.keyboard.press('End');
  await expect(r2).toHaveAttribute('aria-valuenow', '100000');
  await page.keyboard.press('Home');
  await expect(r2).toHaveAttribute('aria-valuenow', '1000');
  await page.keyboard.press('PageUp');
  expect(Number(await r2.getAttribute('aria-valuenow'))).toBeGreaterThan(1000);
  // drag along the track with the mouse: to the far right is the largest value
  const caja = (await r2.boundingBox())!;
  await page.mouse.move(caja.x + 5, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width * 0.5, caja.y + caja.height / 2, { steps: 4 });
  await page.mouse.move(caja.x + caja.width + 30, caja.y + caja.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(r2).toHaveAttribute('aria-valuenow', '100000');
  // back to the book's values
  await t.getByRole('button', { name: 'Volver a los valores del libro' }).click();
  await expect(t.locator('output')).toHaveText(/^4\sV$/);
  await expect(t.getByRole('img')).toHaveAttribute('aria-label', /punto actual: R2 = 5\skΩ, Vout = 4\sV/);
});

test('en una lección está abierta desde el principio', async ({ page }) => {
  await limpio(page);
  // (the 1.0 lesson «por pasos»: since 1.1 the section also has a hand-authored lesson, the default route)
  await page.goto('#/leccion/cap03/sec-3.2/clasica');
  await expect(page.locator('.leccion')).toBeVisible();
  let visto = false;
  for (let k = 0; k < 12 && !visto; k++) {
    await page.waitForTimeout(400);
    if (await page.locator('[data-teoria="carga-rc-vcc"] .caja').count()) visto = true;
    else {
      const seguir = page.getByRole('button', { name: /^Continuar/ });
      if (!(await seguir.count())) break;
      await seguir.first().click();
    }
  }
  if (!visto) console.log('PASOS', await page.locator('.leccion').getAttribute('data-pantalla'), (await page.getByRole('button').allTextContents()).slice(0, 12));
  expect(visto).toBe(true);
  const t = page.locator('[data-teoria="carga-rc-vcc"]');
  await expect(t.getByRole('button', { name: 'Ocultar' })).toHaveCount(0);
  const ts = t.getByRole('slider', { name: /Tiempo/ });
  await ts.focus();
  await page.keyboard.press('ArrowRight');
  await expect(ts).toHaveAttribute('aria-valuetext', /1,1 segundos/);
});

async function tactil(browser: Browser, tema: 'claro' | 'sepia' | 'oscuro') {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await limpio(page, tema);
  return { ctx, page };
}

test('en el teléfono: 44 px, sin desbordar, sin movimiento, y axe (contraste incluido) en claro, sepia y oscuro', async ({ browser }) => {
  for (const tema of ['claro', 'sepia', 'oscuro'] as const) {
    const { ctx, page } = await tactil(browser, tema);
    await page.goto('#/cap06/sec-6.5');
    const t = page.locator('[data-teoria="ib-divisor"]');
    await t.scrollIntoViewIfNeeded();
    await t.getByRole('button', { name: 'Mover los valores de esta fórmula' }).click();
    await expect(t.getByRole('slider')).toHaveCount(5);
    // a finger drag on the track moves it too
    const beta = t.getByRole('slider', { name: /β/ });
    const caja = (await beta.boundingBox())!;
    await beta.tap({ position: { x: caja.width - 2, y: caja.height / 2 } });
    await expect(beta).toHaveAttribute('aria-valuenow', '400');
    const pequenos = await t.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('button, [role=slider]')]
        .filter((x) => x.offsetParent)
        .map((x) => ({ n: (x.textContent || x.getAttribute('aria-valuetext') || x.tagName).trim().slice(0, 30), r: x.getBoundingClientRect() }))
        .filter((x) => x.r.height < 44 || x.r.width < 44)
        .map((x) => `${x.n} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`),
    );
    expect(pequenos, tema).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), tema).toBeLessThanOrEqual(0);
    // nothing animates
    const animado = await t.evaluate((el) => [...el.querySelectorAll('*')].filter((x) => { const s = getComputedStyle(x); const seg = (d: string) => Math.max(...d.split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) / 1000 : parseFloat(x)))); return seg(s.transitionDuration) > 0.02 || (s.animationName !== 'none' && seg(s.animationDuration) > 0.02); }).map((x) => `${x.tagName}.${x.className}`));
    expect(animado, tema).toEqual([]);
    await page.addScriptTag({ path: AXE });
    const v = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
      const r = await axe.run({ include: [['[data-teoria="ib-divisor"]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
      return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    });
    expect(v, tema).toEqual([]);
    await ctx.close();
  }
});
