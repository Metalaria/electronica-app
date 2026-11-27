// 2.2 Part B: the app's tour and the tools' tutorials (componentes/recorridos/, lib/recorridos*.ts).
//   - the tour is offered once per device (new or not), after «Novedades de la 2.1», never over a lesson, never under
//     automation unless the page asks for it (window.__epaRecorridos); a tool's tutorial the first time it is on screen,
//     one offer per page visit, unless the Guía's switch is off; the breadboard's 2.1 «seen» mark still counts;
//   - each step lights a real element; the card takes the focus, the page under it is inert, Esc is «Salir» and the
//     system's back closes it without changing the page; an action step keeps «Siguiente» disabled until it is done;
//   - every tutorial walks to its end from the Guía on the phone and the desktop, lighting something on every step.
import { test, expect, type Page, type Locator } from '@playwright/test';

type Marcas = { v: Record<string, number>; ofrecer?: boolean };

interface Opciones {
  ofertas?: boolean;
  marcas?: Marcas;
  tema?: string;
  extra?: Record<string, string>;
}

async function preparar(page: Page, o: Opciones = {}) {
  await page.addInitScript(
    ({ ofertas, marcas, tema, extra }) => {
      if (ofertas) (window as unknown as { __epaRecorridos?: boolean }).__epaRecorridos = true;
      if (sessionStorage.getItem('sembrado22')) return;
      sessionStorage.setItem('sembrado22', '1');
      localStorage.setItem('epa:prefs', JSON.stringify({ tema }));
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      if (marcas) localStorage.setItem('epa:recorridos', JSON.stringify(marcas));
      for (const [k, v] of Object.entries(extra ?? {})) localStorage.setItem(k, v);
    },
    { ofertas: o.ofertas ?? true, marcas: o.marcas ?? null, tema: o.tema ?? 'oscuro', extra: o.extra ?? {} },
  );
}

const marcas = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('epa:recorridos') ?? 'null') as Marcas | null);
const oferta = (page: Page) => page.locator('[data-recorrido-oferta]');
const tarjeta = (page: Page) => page.locator('[data-recorrido-tarjeta]');
const siguiente = (page: Page) => tarjeta(page).locator('.botones .primario');
const appInerte = (page: Page) => page.evaluate(() => !!document.getElementById('app')?.inert);

/** The lit box contains the centre of the first visible element of `sel` (once the ring has moved there). */
async function iluminado(page: Page, sel: string) {
  await expect(async () => iluminadoYa(page, sel)).toPass({ timeout: 5000 });
}

async function iluminadoYa(page: Page, sel: string) {
  const foco = await page.locator('[data-recorrido-foco]').boundingBox();
  expect(foco, `nada iluminado para ${sel}`).toBeTruthy();
  const c = await page.evaluate((s) => {
    const e = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, sel);
  expect(c, `no se ve ${sel}`).toBeTruthy();
  expect(c![0]).toBeGreaterThanOrEqual(foco!.x - 1);
  expect(c![0]).toBeLessThanOrEqual(foco!.x + foco!.width + 1);
  expect(c![1]).toBeGreaterThanOrEqual(foco!.y - 1);
  expect(c![1]).toBeLessThanOrEqual(foco!.y + foco!.height + 1);
}

async function tocar(page: Page, l: Locator, movil: boolean) {
  // (the page may still be scrolling to the step's element, or growing above it: wait until it stays put)
  let antes = '';
  await expect(async () => {
    const r = JSON.stringify(await l.boundingBox());
    const igual = r === antes;
    antes = r;
    expect(igual).toBe(true);
  }).toPass({ intervals: [250], timeout: 10_000 });
  if (movil) await l.tap({ force: true });
  else await l.click({ force: true });
}

// ------------------------------------------------------------------ the app's tour

test('instalación nueva: se ofrece el recorrido una vez, con el foco; «Ahora no» y no vuelve', async ({ page }) => {
  test.skip(test.info().project.name === 'tableta', 'teléfono y escritorio bastan');
  await preparar(page);
  await page.goto('#/');
  const o = oferta(page);
  await expect(o).toBeVisible({ timeout: 20_000 });
  await expect(o).toBeFocused();
  await expect(o).toHaveAttribute('aria-modal', 'true');
  await expect(o.getByRole('heading')).toHaveText('¿Le enseño dónde está cada cosa?');
  // the page under it is inert
  expect(await appInerte(page)).toBe(true);
  // Esc is «Ahora no»
  await page.keyboard.press('Escape');
  await expect(o).toHaveCount(0);
  expect(await appInerte(page)).toBe(false);
  expect((await marcas(page))?.v.app).toBe(1);
  // never again on this device
  await page.reload();
  await expect(page.locator('[data-inicio21]')).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(o).toHaveCount(0);
});

const PASOS_APP = ['[data-grupo="inicio"]', '[data-grupo="aprender"]', '[data-grupo="libro"]', '[data-grupo="taller"]', '[data-grupo="proyectos"]', '[data-herramienta="buscar"]'];

for (const apaisada of [false, true]) {
  test(`el recorrido entero${apaisada ? ' (tableta apaisada)' : ''}: seis pasos, cada uno ilumina su grupo, y Buscar con «Aa»; queda visto`, async ({ page }) => {
    if (apaisada) {
      test.skip(test.info().project.name !== 'tableta', 'solo la tableta');
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    await preparar(page);
    await page.goto('#/');
    await oferta(page).getByRole('button', { name: 'Empezar el recorrido' }).click();
    for (let i = 0; i < 6; i++) {
      const t = tarjeta(page);
      await expect(t).toHaveAttribute('data-paso', String(i + 1));
      await expect(t).toContainText(`Paso ${i + 1} de 6`);
      await expect(t).toBeFocused();
      await expect(t).toHaveAttribute('aria-modal', 'true');
      await iluminado(page, PASOS_APP[i]!);
      if (i === 5) await iluminado(page, '[data-herramienta="aa"]');
      expect(await appInerte(page)).toBe(true);
      // the first step has no «Anterior»
      await expect(t.getByRole('button', { name: 'Anterior' })).toHaveCount(i === 0 ? 0 : 1);
      await siguiente(page).click();
    }
    await expect(tarjeta(page)).toHaveCount(0);
    expect((await marcas(page))?.v.app).toBe(2);
    expect(await appInerte(page)).toBe(false);
    // the Guía's list ticks it
    await page.goto('#/guia/recorridos');
    await expect(page.locator('[data-empezar-recorrido="app"]')).toHaveAttribute('data-visto', '1');
    await expect(page.locator('[data-empezar-recorrido="app"]')).toContainText('6 pasos · visto');
  });
}

test('Esc sale; el Atrás del sistema cierra el recorrido y deja la página como estaba', async ({ page }) => {
  test.skip(test.info().project.name === 'tableta', 'teléfono y escritorio bastan');
  await preparar(page, { marcas: { v: { app: 1 } } });
  await page.goto('#/glosario');
  await page.goto('#/guia/recorridos');
  await page.locator('[data-empezar-recorrido="app"]').click();
  await expect(tarjeta(page)).toBeVisible();
  await siguiente(page).click();
  await page.keyboard.press('Escape');
  await expect(tarjeta(page)).toHaveCount(0);
  expect((await marcas(page))?.v.app).toBe(1);
  // again, closed with the system's back: the page stays, and the next back goes to the page before
  await page.locator('[data-empezar-recorrido="app"]').click();
  await expect(tarjeta(page)).toBeVisible();
  await page.goBack();
  await expect(tarjeta(page)).toHaveCount(0);
  await expect(page).toHaveURL(/#\/guia\/recorridos$/);
  expect(await appInerte(page)).toBe(false);
  await page.goBack();
  await expect(page).toHaveURL(/#\/glosario$/);
});

test('«Novedades de la 2.1» primero, y la oferta del recorrido después: nunca las dos a la vez', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio');
  await page.addInitScript(() => {
    if (sessionStorage.getItem('sembrado-nov')) return;
    sessionStorage.setItem('sembrado-nov', '1');
    localStorage.setItem('epa:esquemas', JSON.stringify({ formato: 'epa-esquemas', app: '2.0.0', almacenes: {} }));
    localStorage.setItem('epa:leidas', JSON.stringify({ cap05: { 'sec-5.1': Date.now() - 1000 } }));
  });
  await preparar(page);
  await page.goto('#/');
  const nota = page.getByRole('dialog', { name: 'La 2.1 ordena la aplicación' });
  await expect(nota).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3000);
  await expect(oferta(page)).toHaveCount(0);
  await nota.getByRole('button', { name: 'Entendido' }).click();
  await expect(oferta(page)).toBeVisible({ timeout: 10_000 });
  await expect(nota).toHaveCount(0);
});

test('en una lección no se ofrece; al salir de ella, sí', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio');
  await preparar(page);
  await page.goto('#/leccion/cap05/sec-5.1');
  await expect(page.locator('#contenido')).not.toBeEmpty();
  await page.waitForTimeout(4000);
  await expect(oferta(page)).toHaveCount(0);
  await page.goto('#/');
  await expect(oferta(page)).toBeVisible({ timeout: 20_000 });
});

test('bajo automatización, sin la marca de las pruebas, no se ofrece nada', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio');
  await preparar(page, { ofertas: false });
  await page.goto('#/');
  await expect(page.locator('[data-inicio21]')).toBeVisible();
  await page.waitForTimeout(4000);
  await expect(oferta(page)).toHaveCount(0);
  expect(await marcas(page)).toBeNull();
});

// ------------------------------------------------------------------ the tools' offers

test('el banco ofrece el tutorial del Brymen; un paso de acción espera a que el selector llegue a OFF', async ({ page, isMobile }) => {
  test.skip(test.info().project.name === 'tableta', 'teléfono y escritorio bastan');
  await preparar(page, { marcas: { v: { app: 1 } } });
  await page.goto('#/instrumentos/libre');
  const o = oferta(page);
  await expect(o).toBeVisible({ timeout: 30_000 });
  await expect(o).toHaveAttribute('data-recorrido-oferta', 'brymen');
  await expect(o).toContainText('Puede repetirlo desde la Guía de uso.');
  await o.getByRole('button', { name: 'Empezar el tutorial' }).click();
  await expect(tarjeta(page)).toContainText('Brymen · paso 1 de 5');
  await iluminado(page, '[data-recorrido="brymen"]');
  await siguiente(page).click();
  // the action step: «Siguiente» disabled, the dial reachable, the rest of the page not
  await expect(tarjeta(page)).toContainText('Brymen · paso 2 de 5');
  await expect(tarjeta(page)).toHaveAttribute('aria-modal', 'false');
  await expect(siguiente(page)).toBeDisabled();
  await iluminado(page, '[data-recorrido="brymen-selector"]');
  expect(await page.evaluate(() => !!document.querySelector('[data-recorrido="brymen-selector"]')?.closest('[inert]'))).toBe(false);
  expect(await page.evaluate(() => !!document.querySelector('[data-grupo="inicio"]')?.closest('[inert]') || !!document.querySelector('[data-herramienta="buscar"]')?.closest('[inert]'))).toBe(true);
  await tocar(page, page.locator('[data-recorrido="brymen-selector"] [aria-label="Selector en OFF"]'), isMobile);
  await expect(page.locator('[data-posicion-brymen]')).toHaveAttribute('data-posicion-brymen', 'off');
  await expect(siguiente(page)).toBeEnabled();
  await expect(tarjeta(page).locator('.aviso21.bien')).toHaveText('Hecho: la pantalla se apaga.');
  // «Salir» half way: offered, not seen
  await tarjeta(page).getByRole('button', { name: 'Salir' }).click();
  await expect(tarjeta(page)).toHaveCount(0);
  expect((await marcas(page))?.v.brymen).toBe(1);
});

test('una oferta por visita; la siguiente herramienta en otra visita; el interruptor de la Guía las apaga', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio');
  await preparar(page, { marcas: { v: { app: 1 } } });
  await page.goto('#/instrumentos/libre');
  await expect(oferta(page)).toHaveAttribute('data-recorrido-oferta', 'brymen', { timeout: 30_000 });
  await oferta(page).getByRole('button', { name: 'Ahora no' }).click();
  await page.waitForTimeout(3000);
  await expect(oferta(page)).toHaveCount(0);
  // another visit of a bench: the FNIRSI's oscilloscope
  await page.goto('#/instrumentos/practica/1');
  await expect(oferta(page)).toHaveAttribute('data-recorrido-oferta', 'fnirsi-osc', { timeout: 30_000 });
  await oferta(page).getByRole('button', { name: 'Ahora no' }).click();
  // the switch off: the simulator offers nothing
  await page.goto('#/guia/recorridos');
  const sw = page.locator('[data-ofrecer-tutoriales]');
  await expect(sw).toBeChecked();
  await sw.uncheck();
  expect((await marcas(page))?.ofrecer).toBe(false);
  await page.goto('#/simulador');
  await page.waitForTimeout(4000);
  await expect(oferta(page)).toHaveCount(0);
  // and on again
  await page.goto('#/guia/recorridos');
  await page.locator('[data-ofrecer-tutoriales]').check();
  await page.goto('#/simulador');
  await expect(oferta(page)).toHaveAttribute('data-recorrido-oferta', 'simulador', { timeout: 20_000 });
});

test('protoboard: quien vio el recorrido de la 2.1 no recibe la oferta, y la Guía lo da por visto', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio');
  await preparar(page, { marcas: { v: { app: 1 } }, extra: { 'epa:protoboard-recorrido': '1' } });
  await page.goto('#/protoboard');
  await expect(page.locator('[data-recorrido="proto-placa"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(4000);
  await expect(oferta(page)).toHaveCount(0);
  await page.goto('#/guia/recorridos');
  await expect(page.locator('[data-empezar-recorrido="protoboard"]')).toContainText('6 pasos · visto');
});

test('movimiento reducido: el foco salta sin transición', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparar(page, { marcas: { v: { app: 1 } } });
  await page.goto('#/guia/recorridos');
  await page.locator('[data-empezar-recorrido="app"]').click();
  const d = await page.locator('[data-recorrido-foco]').evaluate((e) => getComputedStyle(e).transitionDuration);
  // (app.css shortens every transition to 0.01 ms under reduced motion)
  expect(d.split(',').every((x) => parseFloat(x) < 0.001)).toBe(true);
});

// ------------------------------------------------------------------ every tutorial, to its end

type Accion = (page: Page, movil: boolean) => Promise<void>;
const pulsar = (sel: string): Accion => (page, movil) => tocar(page, page.locator(sel).first(), movil);
/** 2.2: a long press (the FNIRSI's MENU opens the mode screen when held one second), by pointer events on the key. */
const mantener = (sel: string, ms = 1150): Accion => async (page) => {
  const l = page.locator(sel).first();
  await l.dispatchEvent('pointerdown', { button: 0, pointerId: 1, isPrimary: true });
  await page.waitForTimeout(ms);
  await l.dispatchEvent('pointerup', { button: 0, pointerId: 1, isPrimary: true });
};
async function hueco(page: Page, movil: boolean, x: number, y: number) {
  const q = await page.evaluate(([a, b]) => (window as unknown as { __epaProtoboard: { pantalla: (x: number, y: number) => [number, number] } }).__epaProtoboard.pantalla(a!, b!), [x, y]);
  if (movil) await page.touchscreen.tap(q[0], q[1]);
  else await page.mouse.click(q[0], q[1]);
  await page.waitForTimeout(250);
}
async function tile(page: Page, x: number) {
  const c = (await page.locator('[data-recorrido="fnirsi-pantalla"]').boundingBox())!;
  await page.mouse.click(c.x + c.width * (x / 320), c.y + c.height * (115 / 240));
}

const ACCIONES: Record<string, Record<number, Accion>> = {
  brymen: {
    2: pulsar('[data-recorrido="brymen-selector"] [aria-label="Selector en OFF"]'),
    3: pulsar('[data-recorrido="brymen-selector"] [aria-label="Selector en V⎓"]'),
    4: pulsar('[data-recorrido="brymen-hold"]'),
  },
  'fnirsi-osc': { 3: pulsar('[data-recorrido="fnirsi-auto"]'), 4: pulsar('[data-recorrido="fnirsi-flecha"][aria-label="►"]'), 5: pulsar('[data-recorrido="fnirsi-run"]') },
  'fnirsi-mult': {
    // (2.2: MENU held one second; then ► and the blue key on the phone, a tap on the screen's tile on the desktop)
    1: mantener('[data-recorrido="fnirsi-menu"]'),
    2: async (page, movil) => {
      if (movil) {
        await pulsar('[data-recorrido="fnirsi-flecha"][aria-label="►"]')(page, movil);
        await pulsar('[data-recorrido="fnirsi-run"]')(page, movil);
      } else await tile(page, 160);
    },
    4: async (page, movil) => {
      await mantener('[data-recorrido="fnirsi-menu"]')(page, movil);
      if (movil) {
        await pulsar('[data-recorrido="fnirsi-flecha"][aria-label="►"]')(page, movil);
        await pulsar('[data-recorrido="fnirsi-run"]')(page, movil);
      } else await tile(page, 260);
    },
  },
  banco: {
    1: pulsar('[data-recorrido="banco-dibujo"] [data-nodo-plano="a"]'),
    3: pulsar('[data-plegable="serie"] summary'),
    4: async (page) => {
      await page.locator('[data-plegable="serie"] select').first().selectOption({ index: 1 });
    },
  },
  protoboard: {
    1: async (page, movil) => {
      await tocar(page, page.locator('.bandeja [data-carta="LEDR"]').first(), movil);
      await hueco(page, movil, 10, 5);
    },
    2: async (page, movil) => {
      await hueco(page, movil, 3, 7);
      await hueco(page, movil, 6, 7);
    },
    3: pulsar('[data-recorrido="proto-simular"]'),
  },
  simulador: {
    // (under load the engine may still be loading: «Simular» is disabled until it is ready)
    2: async (page, movil) => {
      await expect(page.locator('[data-recorrido="sim-simular"]')).toBeEnabled({ timeout: 60_000 });
      await pulsar('[data-recorrido="sim-simular"]')(page, movil);
    },
  },
  consolas: {
    3: async (page) => {
      await page.locator('[data-recorrido="consola-foto"] rect.punto[data-id]').first().click({ force: true });
    },
  },
};

const PASOS: Record<string, number> = { brymen: 5, 'fnirsi-osc': 6, 'fnirsi-mult': 5, banco: 4, protoboard: 6, simulador: 5, consolas: 4 };

for (const id of Object.keys(PASOS)) {
  test(`tutorial «${id}» entero desde la Guía: cada paso ilumina algo y queda visto`, async ({ page, isMobile }) => {
    test.skip(test.info().project.name === 'tableta', 'teléfono y escritorio');
    test.setTimeout(150_000);
    await preparar(page, { marcas: { v: { app: 1 } } });
    await page.goto('#/guia/recorridos');
    await expect(page.locator(`[data-empezar-recorrido="${id}"]`)).toContainText(`${PASOS[id]} pasos`);
    await page.locator(`[data-empezar-recorrido="${id}"]`).click();
    for (let i = 1; i <= PASOS[id]!; i++) {
      const t = tarjeta(page);
      await expect(t).toHaveAttribute('data-paso', String(i), { timeout: 40_000 });
      await expect(page.locator('[data-recorrido-foco]'), `paso ${i}: nada iluminado`).toBeVisible();
      const s = siguiente(page);
      if (await s.isDisabled()) {
        const a = ACCIONES[id]?.[i];
        expect(a, `paso ${i} espera una acción`).toBeTruthy();
        // (the step scrolls its element into view, smoothly: let it settle before touching it)
        await page.waitForTimeout(800);
        await a!(page, isMobile);
        await expect(s).toBeEnabled({ timeout: 10_000 });
        await expect(t.locator('.aviso21.bien')).toBeVisible();
      }
      await expect(s).toHaveText(i === PASOS[id] ? 'Terminar' : 'Siguiente');
      await s.click();
    }
    await expect(tarjeta(page)).toHaveCount(0);
    expect((await marcas(page))?.v[id]).toBe(2);
    await page.goto('#/guia/recorridos');
    await expect(page.locator(`[data-empezar-recorrido="${id}"]`)).toHaveAttribute('data-visto', '1');
  });
}

// cierre22: the card sat 24 px below the place worked out for it (the reader's global .tarjeta rule, 1.6em of margin),
// over the lit item and the bottom bar on the phone and over the header elsewhere; and a page element running under the
// bottom bar was lit together with part of the bar. The card now keeps the header, the bottom bar and the rail clear,
// and the ring of a page element stops where the page does.
async function chrome(page: Page) {
  return page.evaluate(() => {
    const r = (s: string) => {
      const e = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0);
      const q = e?.getBoundingClientRect();
      return q ? { x: q.x, y: q.y, w: q.width, h: q.height } : null;
    };
    const t = document.querySelector<HTMLElement>('[data-recorrido-tarjeta]');
    return {
      tarjeta: r('[data-recorrido-tarjeta]'),
      estiloTop: t ? parseFloat(t.style.top) : null,
      foco: r('[data-recorrido-foco]'),
      piezas: [r('header.barra'), r('nav.pestanas[aria-label="Secciones de la aplicación"]'), r('nav.carril')].filter((x) => !!x),
    };
  });
}
const cruza = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;

test('la tarjeta del recorrido no pisa la cabecera, la barra inferior ni el carril, y está donde se calcula', async ({ page }) => {
  await preparar(page);
  await page.goto('#/');
  await oferta(page).getByRole('button', { name: 'Empezar el recorrido' }).click();
  for (let i = 1; i <= 6; i++) {
    await expect(tarjeta(page)).toHaveAttribute('data-paso', String(i));
    await page.waitForTimeout(600);
    const c = await chrome(page);
    expect(Math.abs(c.tarjeta!.y - c.estiloTop!), `paso ${i}: la tarjeta, fuera de su sitio`).toBeLessThan(1);
    for (const p of c.piezas) expect(cruza(c.tarjeta!, p!), `paso ${i}: la tarjeta pisa ${JSON.stringify(p)}`).toBe(false);
    expect(cruza(c.tarjeta!, c.foco!), `paso ${i}: la tarjeta tapa lo iluminado`).toBe(false);
    await siguiente(page).click();
  }
});

test('el anillo de un elemento de la página no ilumina la barra inferior (banco, paso 1)', async ({ page }) => {
  test.skip(test.info().project.name !== 'movil', 'el teléfono');
  await preparar(page, { marcas: { v: { app: 1 } } });
  await page.goto('#/guia/recorridos');
  await page.locator('[data-empezar-recorrido="banco"]').click();
  await expect(tarjeta(page)).toHaveAttribute('data-paso', '1', { timeout: 40_000 });
  await page.waitForTimeout(1000);
  const c = await chrome(page);
  const barra = c.piezas.find((p) => p!.y > 400)!;
  expect(c.foco!.y + c.foco!.h).toBeLessThanOrEqual(barra.y);
  expect(cruza(c.tarjeta!, barra)).toBe(false);
});
