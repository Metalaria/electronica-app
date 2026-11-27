// 2.2 (owner's key log on his real unit, firmware V1.2.0): the simulated FNIRSI's keys do what the real one's do.
// MENU short no longer opens the mode-selection screen: MENU held one second (MENU_LARGO_MS) does, in every mode; on
// that screen ◄ ► change the mode and the blue centre key enters it. The multimeter: ◄ ► step through entries 0 … 7
// (wrapping), MOVE toggles DC/AC in entry 1, AUTO goes back to Automático, the blue key is HOLD, and ▲ ▼ SELECT
// TRIGGER PRM SAVE CH1 CH2 MENU-short do nothing. The generator: three levels (wave list, settings rows, editing), ▲ ▼
// ±1 Hz on the frequency row. The oscilloscope: SELECT cycles three arrow modes; the blue key is RUN/STOP; MOVE does
// nothing. The state is read from the figure's data-teclas-fnirsi (componentes/instrumentos/banco/Aparatos.svelte).
import { test, expect, type Page } from '@playwright/test';
import { FORMAS } from '../src/componentes/instrumentos/motor/generador.ts';

test.skip(({ isMobile }) => isMobile, 'one window is enough: the logic is the same');

interface Teclas {
  menu: string | null;
  item: number;
  flechas: number;
  nivelGen: number;
  itemGen: number;
  forma: string;
  frecuencia: number;
  hold: boolean;
  run: boolean;
  sDiv: number;
  vDiv: [number, number];
  pos: [number, number];
  hpos: number;
  nivel: number;
  fuente: 0 | 1;
  activo: number;
}

const fnirsi = (page: Page) => page.locator('figure[data-modo-fnirsi]');
const tecla = (page: Page, nombre: string) => page.locator(`[data-recorrido="fnirsi-${nombre}"]`);
const flecha = (page: Page, f: string) => page.locator(`[data-recorrido="fnirsi-flecha"][aria-label="${f}"]`);
const estado = async (page: Page): Promise<Teclas> => JSON.parse((await fnirsi(page).getAttribute('data-teclas-fnirsi')) ?? '{}') as Teclas;
const funcion = (page: Page) => fnirsi(page).getAttribute('data-funcion-dibujada');

/** Holds a key down with the mouse for `ms` milliseconds. */
async function mantener(page: Page, nombre: string, ms = 1150) {
  const c = (await tecla(page, nombre).boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function abrir(page: Page) {
  await page.addInitScript(() => localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false })));
  await page.goto('#/instrumentos/libre');
  await expect(fnirsi(page)).toHaveAttribute('data-modo-fnirsi', 'osc');
  // (the free bench presses AUTO once its first result arrives, which closes an open menu: wait for it)
  await expect(page.locator('.cabeza21 .estado')).toContainText('simulado en', { timeout: 60_000 });
  await page.waitForTimeout(500);
}

/** To a mode through the mode-selection screen: MENU held, ◄ ► to it, the blue key. */
async function aModo(page: Page, modo: 'osc' | 'dmm' | 'gen') {
  await mantener(page, 'menu');
  await expect.poll(async () => (await estado(page)).menu).toBe('principal');
  const quiero = ['osc', 'dmm', 'gen'].indexOf(modo);
  for (let k = 0; k < 3 && (await estado(page)).item !== quiero; k++) await flecha(page, '►').click();
  await tecla(page, 'run').click();
  await expect(fnirsi(page)).toHaveAttribute('data-modo-fnirsi', modo);
}

test('MENU: corta no abre la pantalla de modos; mantenida un segundo sí, en los tres modos; ◄ ► cambian de modo y la tecla azul entra', async ({ page }) => {
  await abrir(page);
  // osc: a short MENU is not the mode screen (it opens the functions menu, which SELECT opened before)
  await tecla(page, 'menu').click();
  expect((await estado(page)).menu).toBe('funciones');
  await tecla(page, 'menu').click();
  expect((await estado(page)).menu).toBeNull();
  // held less than a second: still not the mode screen
  await mantener(page, 'menu', 700);
  expect((await estado(page)).menu).not.toBe('principal');
  await tecla(page, 'menu').click();
  // held one second: the mode screen, with Osciloscopio marked
  await mantener(page, 'menu');
  expect(await estado(page)).toMatchObject({ menu: 'principal', item: 0 });
  // ▲ ▼ SELECT on the mode screen are kept as they were; ◄ ► change the mode shown, wrapping
  await flecha(page, '◄').click();
  expect((await estado(page)).item).toBe(2);
  await flecha(page, '►').click();
  await flecha(page, '►').click();
  expect((await estado(page)).item).toBe(1);
  // the blue key enters it
  await tecla(page, 'run').click();
  await expect(fnirsi(page)).toHaveAttribute('data-modo-fnirsi', 'dmm');
  expect((await estado(page)).menu).toBeNull();
  // multimeter: a short MENU does nothing; held, the mode screen with Multímetro marked
  await tecla(page, 'menu').click();
  expect((await estado(page)).menu).toBeNull();
  await mantener(page, 'menu');
  expect(await estado(page)).toMatchObject({ menu: 'principal', item: 1 });
  await flecha(page, '►').click();
  await tecla(page, 'run').click();
  await expect(fnirsi(page)).toHaveAttribute('data-modo-fnirsi', 'gen');
  // generator: held, the mode screen with Generador marked; ► wraps to Osciloscopio
  await mantener(page, 'menu');
  expect(await estado(page)).toMatchObject({ menu: 'principal', item: 2 });
  await flecha(page, '►').click();
  await tecla(page, 'run').click();
  await expect(fnirsi(page)).toHaveAttribute('data-modo-fnirsi', 'osc');
  // the keyboard's long press (Shift+Enter) opens it too
  await tecla(page, 'menu').focus();
  await page.keyboard.press('Shift+Enter');
  expect((await estado(page)).menu).toBe('principal');
});

test('multímetro: ◄ ► recorren las entradas 0 a 7 dando la vuelta, MOVE pasa de continua a alterna, AUTO vuelve a Automático, la tecla azul es HOLD y el resto no hace nada', async ({ page }) => {
  await abrir(page);
  await aModo(page, 'dmm');
  expect(await funcion(page)).toBe('auto');
  await flecha(page, '►').click();
  expect(await funcion(page)).toBe('vdc');
  await tecla(page, 'move').click();
  expect(await funcion(page)).toBe('vac');
  await tecla(page, 'move').click();
  expect(await funcion(page)).toBe('vdc');
  // entry 2: continuity first, MOVE toggles continuity and diode (the real menu's order)
  await flecha(page, '►').click();
  expect(await funcion(page)).toBe('cont');
  await tecla(page, 'move').click();
  expect(await funcion(page)).toBe('diodo');
  await tecla(page, 'move').click();
  expect(await funcion(page)).toBe('cont');
  await flecha(page, '►').click();
  expect(await funcion(page)).toBe('ohm');
  // MOVE in an entry with one variant: nothing
  await tecla(page, 'move').click();
  expect(await funcion(page)).toBe('ohm');
  await flecha(page, '►').click();
  expect(await funcion(page)).toBe('cap');
  // entry 5: temperature, without a probe in the drawing
  await flecha(page, '►').click();
  expect(await funcion(page)).toBe('temp');
  // back from entry 5 to entry 1
  for (let k = 0; k < 4; k++) await flecha(page, '◄').click();
  expect(await funcion(page)).toBe('vdc');
  await flecha(page, '◄').click();
  expect(await funcion(page)).toBe('auto');
  // 0 → 7 (A), 6 (mA), 5 (temperature), and 7 → 0
  await flecha(page, '◄').click();
  expect(await funcion(page)).toBe('idc');
  await flecha(page, '◄').click();
  expect(await funcion(page)).toBe('idc');
  await flecha(page, '◄').click();
  expect(await funcion(page)).toBe('temp');
  await flecha(page, '►').click();
  await flecha(page, '►').click();
  await flecha(page, '►').click();
  expect(await funcion(page)).toBe('auto');
  // ▲ ▼ SELECT TRIGGER PRM SAVE CH1 CH2: nothing
  await flecha(page, '►').click();
  await flecha(page, '►').click();
  await flecha(page, '►').click();
  expect(await funcion(page)).toBe('ohm');
  let descargas = 0;
  page.on('download', () => descargas++);
  const antes = await estado(page);
  for (const t of ['select', 'trigger', 'prm', 'save', 'ch1', 'ch2']) await tecla(page, t).click();
  await flecha(page, '▲').click();
  await flecha(page, '▼').click();
  await page.waitForTimeout(300);
  expect(await funcion(page)).toBe('ohm');
  await expect(fnirsi(page)).toHaveAttribute('data-modo-fnirsi', 'dmm');
  expect(await estado(page)).toEqual(antes);
  expect(descargas).toBe(0);
  // AUTO: back to Automático
  await tecla(page, 'auto').click();
  expect(await funcion(page)).toBe('auto');
  // the blue key: HOLD
  await tecla(page, 'run').click();
  expect((await estado(page)).hold).toBe(true);
  await expect(tecla(page, 'run')).toHaveAttribute('aria-label', 'Tecla azul: HOLD, retener el valor');
  await tecla(page, 'run').click();
  expect((await estado(page)).hold).toBe(false);
});

test('generador: la lista de ondas, la de ajustes y la edición; ▲ ▼ ±1 Hz en la frecuencia, MENU vuelve un nivel', async ({ page }) => {
  await abrir(page);
  await aModo(page, 'gen');
  const forma0 = (await estado(page)).forma;
  const siguiente = FORMAS[(FORMAS.findIndex((x) => x.id === forma0) + 1) % FORMAS.length]!.id;
  expect(await estado(page)).toMatchObject({ nivelGen: 0, itemGen: 0 });
  // level 0: ▼ next wave, ▲ previous; ◄ ► MENU SELECT AUTO SAVE nothing
  await flecha(page, '▼').click();
  expect((await estado(page)).forma).toBe(siguiente);
  await flecha(page, '▲').click();
  expect((await estado(page)).forma).toBe(forma0);
  let descargas = 0;
  page.on('download', () => descargas++);
  const cero = await estado(page);
  await flecha(page, '◄').click();
  await flecha(page, '►').click();
  for (const t of ['menu', 'select', 'auto', 'save']) await tecla(page, t).click();
  await page.waitForTimeout(300);
  expect(await estado(page)).toEqual(cero);
  expect(descargas).toBe(0);
  // the blue key: level 1, the cursor on the first settings row (the frequency)
  await tecla(page, 'run').click();
  expect(await estado(page)).toMatchObject({ nivelGen: 1, itemGen: 1 });
  await flecha(page, '▼').click();
  expect((await estado(page)).itemGen).toBe(2);
  await flecha(page, '▲').click();
  expect((await estado(page)).itemGen).toBe(1);
  // ◄ ► SELECT nothing at level 1
  const uno = await estado(page);
  await flecha(page, '◄').click();
  await flecha(page, '►').click();
  await tecla(page, 'select').click();
  expect(await estado(page)).toEqual(uno);
  // MENU: back to level 0
  await tecla(page, 'menu').click();
  expect(await estado(page)).toMatchObject({ nivelGen: 0, itemGen: 0 });
  // level 2 on the frequency row: ▲ +1 Hz, ▼ −1 Hz; ◄ ► as before (the 1-1.2-1.5-2 steps)
  await tecla(page, 'run').click();
  await tecla(page, 'run').click();
  expect(await estado(page)).toMatchObject({ nivelGen: 2, itemGen: 1 });
  const f0 = (await estado(page)).frecuencia;
  await flecha(page, '▲').click();
  expect((await estado(page)).frecuencia).toBe(f0 + 1);
  await flecha(page, '▼').click();
  await flecha(page, '▼').click();
  expect((await estado(page)).frecuencia).toBe(f0 - 1);
  await flecha(page, '►').click();
  expect((await estado(page)).frecuencia).toBe(f0);
  await flecha(page, '►').click();
  expect((await estado(page)).frecuencia).toBeGreaterThan(f0);
  // MENU: level 1, then level 0
  await tecla(page, 'menu').click();
  expect(await estado(page)).toMatchObject({ nivelGen: 1, itemGen: 1 });
  await tecla(page, 'menu').click();
  expect((await estado(page)).nivelGen).toBe(0);
  // held: the mode screen
  await mantener(page, 'menu');
  expect((await estado(page)).menu).toBe('principal');
});

test('osciloscopio: SELECT cambia el modo de las flechas (escalas, posiciones, nivel de disparo), la tecla azul es RUN/STOP y MOVE no hace nada', async ({ page }) => {
  await abrir(page);
  const marca = (e: Teclas) => e.nivel / e.vDiv[e.fuente] + e.pos[e.fuente];
  const e0 = await estado(page);
  expect(e0.flechas).toBe(0);
  // mode 0: ► one time base faster, ◄ slower; ▲ one V/div index up, ▼ down
  await flecha(page, '►').click();
  expect((await estado(page)).sDiv).toBeLessThan(e0.sDiv);
  await flecha(page, '◄').click();
  expect((await estado(page)).sDiv).toBeCloseTo(e0.sDiv, 12);
  await flecha(page, '▲').click();
  expect((await estado(page)).vDiv[e0.activo]).toBeGreaterThan(e0.vDiv[e0.activo]);
  await flecha(page, '▼').click();
  expect((await estado(page)).vDiv[e0.activo]).toBeCloseTo(e0.vDiv[e0.activo], 9);
  // mode 1: ► ◄ the horizontal position ±1/10 div; ▲ ▼ CH1's position and the trigger level together, 1/25 div
  await tecla(page, 'select').click();
  const e1 = await estado(page);
  expect(e1.flechas).toBe(1);
  await flecha(page, '►').click();
  expect((await estado(page)).hpos).toBeCloseTo(e1.hpos - e1.sDiv / 10, 12);
  await flecha(page, '◄').click();
  expect((await estado(page)).hpos).toBeCloseTo(e1.hpos, 12);
  await flecha(page, '▲').click();
  const e1b = await estado(page);
  expect(e1b.pos[0]).toBeCloseTo(e1.pos[0] + 1 / 25, 9);
  expect(marca(e1b)).toBeCloseTo(marca(e1) + 1 / 25, 9);
  expect(e1b.vDiv).toEqual(e1.vDiv);
  // mode 2: ► ◄ the horizontal position; ▲ ▼ the trigger level alone
  await tecla(page, 'select').click();
  const e2 = await estado(page);
  expect(e2.flechas).toBe(2);
  await flecha(page, '▼').click();
  const e2b = await estado(page);
  expect(e2b.pos).toEqual(e2.pos);
  expect(marca(e2b)).toBeCloseTo(marca(e2) - 1 / 25, 9);
  await flecha(page, '◄').click();
  expect((await estado(page)).hpos).toBeCloseTo(e2.hpos + e2.sDiv / 10, 12);
  // and back to mode 0
  await tecla(page, 'select').click();
  expect((await estado(page)).flechas).toBe(0);
  // the blue key: RUN/STOP
  await expect(tecla(page, 'run')).toHaveAttribute('aria-label', 'RUN/STOP');
  await tecla(page, 'run').click();
  expect((await estado(page)).run).toBe(false);
  await tecla(page, 'run').click();
  expect((await estado(page)).run).toBe(true);
  // MOVE (short): nothing
  const antes = await estado(page);
  await tecla(page, 'move').click();
  expect((await estado(page)).activo).toBe(antes.activo);
});
