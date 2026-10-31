// The breadboard redesign of 0.11 (componentes/protoboard/): the parts tray (drag a card onto the board, its
// ghost in the holes its legs will take, a drop that does not fit refused with the reason; or tap the card
// and then the board), the floating bar of a part (rotate, flip, value with the E12 chips and the resistor's
// bands), wires (tap–tap, by dragging, moving an end, removing with a long press, colour by what they carry),
// «Monta este circuito» (each built-in circuit completed, a wrong step explained), the mini-lesson «La
// protoboard por dentro» (strips, channel, rails, questions answered from the board's model, skip, seen
// flag), the first-use tour (once), no sideways overflow at 412 px, a timed first-time user (LED, resistor and
// supply built and simulated with the LED lit, with visible controls only) and the screenshots of
// tests/capturas/proto11/ (tablet and phone, light and dark). All with real touch gestures.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.proto11.config.ts tests/proto11.spec.ts
import fs from 'node:fs';
import { expect, test, type Browser, type CDPSession, type Page } from '@playwright/test';

type P = [number, number];
const CAPTURAS = 'tests/capturas/proto11';

interface Pb {
  doc: {
    piezas: { id: string; enc: string; comp: { nombre: string; tipo: string; campos: Record<string, string> }; pos: P[] }[];
    cables: { id: string; a: P; b: P; color: string }[];
  };
  sel: string[];
  mensaje: string;
  guia: { estado: { actual: number; hechos: boolean[] }; plan: { pasos: unknown[]; id: string } } | null;
  leccion: unknown;
  motivoNueva: (p: unknown) => string | null;
  nuevaEn: (x: unknown, pos: P[]) => unknown;
  componente: (t: string, c?: Record<string, string>) => unknown;
}
interface Ventana {
  __epaProtoboard?: { pb: Pb; pantalla: (x: number, y: number) => P; escala: () => number };
}

// ------------------------------------------------------------------ helpers

async function contexto(browser: Browser, ancho: number, alto: number, opciones: { tema?: 'light' | 'dark'; recorrido?: boolean; leccion?: boolean } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: opciones.tema ?? 'light' });
  await ctx.addInitScript(
    ([r, l]) => {
      if (sessionStorage.getItem('proto11-hecho')) return;
      sessionStorage.setItem('proto11-hecho', '1');
      localStorage.removeItem('epa:protoboard-borrador');
      if (r) localStorage.setItem('epa:protoboard-recorrido', '1');
      if (l) localStorage.setItem('epa:protoboard-leccion', '1');
    },
    [opciones.recorrido ?? true, opciones.leccion ?? true] as [boolean, boolean],
  );
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}

async function abrir(page: Page) {
  await page.goto('/#/protoboard');
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await page.waitForTimeout(400);
}

const pantalla = (page: Page, x: number, y: number) => page.evaluate(([a, b]) => (window as unknown as Ventana).__epaProtoboard!.pantalla(a!, b!), [x, y]);
const estado = (page: Page) =>
  page.evaluate(() => {
    const pb = (window as unknown as Ventana).__epaProtoboard!.pb;
    return {
      piezas: pb.doc.piezas.map((p) => ({ id: p.id, nombre: p.comp.nombre, tipo: p.comp.tipo, pos: p.pos, campos: { ...p.comp.campos } })),
      cables: pb.doc.cables.map((w) => ({ id: w.id, a: w.a, b: w.b, color: w.color })),
      sel: [...pb.sel],
      mensaje: pb.mensaje,
      guia: pb.guia ? { actual: pb.guia.estado.actual, total: pb.guia.plan.pasos.length, id: pb.guia.plan.id } : null,
      leccion: !!pb.leccion,
    };
  });

async function toques(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', puntos: P[]) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos.map(([x, y], i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 1 })) });
}

/** A finger from `de` to `a` (and lifted unless `soltar` is false). */
async function arrastrar(page: Page, cdp: CDPSession, de: P, a: P, soltar = true, pasos = 12) {
  await toques(cdp, 'touchStart', [de]);
  await page.waitForTimeout(30);
  for (let k = 1; k <= pasos; k++) {
    await toques(cdp, 'touchMove', [[de[0] + ((a[0] - de[0]) * k) / pasos, de[1] + ((a[1] - de[1]) * k) / pasos]]);
    await page.waitForTimeout(16);
  }
  if (soltar) {
    await toques(cdp, 'touchEnd', []);
    await page.waitForTimeout(250);
  }
}

async function centroDe(page: Page, selector: string): Promise<P> {
  const c = await page.locator(selector).first().boundingBox();
  return [c!.x + c!.width / 2, c!.y + c!.height / 2];
}

/** Drags a tray card so that the part's body ends over world point (x, y) (the ghost rides 56 px above the finger). */
async function cartaA(page: Page, cdp: CDPSession, carta: string, x: number, y: number, soltar = true) {
  await page.locator(`.bandeja [data-carta="${carta}"]`).scrollIntoViewIfNeeded();
  const de = await centroDe(page, `.bandeja [data-carta="${carta}"]`);
  const q = await pantalla(page, x, y);
  await arrastrar(page, cdp, de, [q[0], q[1] + 56], soltar);
}

async function tocarHueco(page: Page, x: number, y: number) {
  const q = await pantalla(page, x, y);
  await page.touchscreen.tap(q[0], q[1]);
  await page.waitForTimeout(150);
}

/** A tap on empty bench (the channel): nothing selected. */
async function soltarSeleccion(page: Page) {
  const q = await pantalla(page, 6, 8.5);
  await page.touchscreen.tap(q[0], q[1]);
  await page.waitForTimeout(120);
}

async function sinDesbordar(page: Page, que: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, b: document.body.scrollWidth }));
  expect(m.sw, `desbordamiento: ${que}`).toBeLessThanOrEqual(m.w);
  expect(m.b, `desbordamiento: ${que}`).toBeLessThanOrEqual(m.w);
}

const ledEncendido = (page: Page, nombre: string) =>
  page.evaluate((n) => {
    const pb = (window as unknown as Ventana).__epaProtoboard!.pb;
    const p = pb.doc.piezas.find((x) => x.comp.nombre === n);
    return !!p && (document.querySelector(`[data-pieza="${p.id}"]`)?.innerHTML.includes('pb-luz') ?? false);
  }, nombre);

// ------------------------------------------------------------------ the tray

for (const [ancho, alto] of [
  [800, 1280],
  [412, 915],
] as const) {
  test(`bandeja a ${ancho} px: arrastrar una pieza a la placa con su fantasma; una suelta que no cabe se rechaza con el motivo`, async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page, cdp } = await contexto(browser, ancho, alto);
    await abrir(page);
    await expect(page.locator('.mesa .vacia')).toBeVisible();
    // Halfway: the ghost shows the two holes and their strips, in green.
    await cartaA(page, cdp, 'R', 12, 5, false);
    await expect(page.locator('.pata-fantasma')).toHaveCount(2);
    await expect(page.locator('.tira-fantasma')).toHaveCount(2);
    await expect(page.locator('.tira-fantasma.mal')).toHaveCount(0);
    await toques(cdp, 'touchEnd', []);
    await page.waitForTimeout(300);
    let e = await estado(page);
    const r1 = e.piezas.find((p) => p.tipo === 'R')!;
    expect(r1.pos).toEqual([
      [10, 5],
      [14, 5],
    ]);
    // Dropped: selected, with its floating bar next to it.
    expect(e.sel).toEqual([r1.id]);
    await expect(page.locator('.barra-pieza')).toBeVisible();
    // A second resistor onto the first: red ghost, refused with the reason.
    await soltarSeleccion(page);
    await cartaA(page, cdp, 'R', 12, 5, false);
    await expect(page.locator('.tira-fantasma.mal').first()).toBeVisible();
    await expect(page.locator('.mesa .info.aviso')).toContainText('No cabe ahí');
    await toques(cdp, 'touchEnd', []);
    await page.waitForTimeout(300);
    e = await estado(page);
    expect(e.piezas.filter((p) => p.tipo === 'R')).toHaveLength(1);
    expect(e.mensaje).toMatch(/^No cabe ahí: /);
    // A part whose legs would share a strip is refused too (shorted by the board).
    const corto = await page.evaluate(() => {
      const pb = (window as unknown as Ventana).__epaProtoboard!.pb;
      return pb.motivoNueva(pb.nuevaEn(pb.componente('R', { valor: '1k' }), [[20, 3], [20, 7]]));
    });
    expect(corto).toMatch(/misma tira.*cortocircuito/);
    await sinDesbordar(page, 'bandeja');
    await ctx.close();
  });
}

test('bandeja: tocar una carta y luego la placa la pone allí', async ({ browser }) => {
  const { ctx, page } = await contexto(browser, 800, 1280);
  await abrir(page);
  await page.locator('.bandeja [data-carta="LEDR"]').tap();
  await expect(page.locator('.bandeja [data-carta="LEDR"]')).toHaveClass(/elegida/);
  await tocarHueco(page, 20, 12);
  const e = await estado(page);
  const led = e.piezas.find((p) => p.tipo === 'LED');
  expect(led).toBeTruthy();
  expect(led!.pos.flat().every((v) => Number.isInteger(v))).toBe(true);
  await expect(page.locator('.bandeja .carta.elegida')).toHaveCount(0);
  await ctx.close();
});

// ------------------------------------------------------------------ the floating bar

test('barra flotante: girar, voltear y el valor con los valores comunes (las bandas cambian)', async ({ browser }) => {
  test.setTimeout(90_000);
  const { ctx, page, cdp } = await contexto(browser, 800, 1280);
  await abrir(page);
  await cartaA(page, cdp, 'R', 12, 5);
  await expect(page.locator('.barra-pieza')).toBeVisible();
  const id = (await estado(page)).sel[0]!;
  const pos = async () => (await estado(page)).piezas.find((p) => p.id === id)!.pos;
  const antes = await pos();
  await page.locator('.barra-pieza button:has-text("Girar")').tap();
  const girada = await pos();
  expect(girada[0]![0]).toBe(girada[1]![0]);
  expect(girada).not.toEqual(antes);
  // Turned upright in place it would have both legs in one strip: it moves to where it is not shorted.
  const mitad = (y: number) => (y >= 3 && y <= 7 ? 'a' : y >= 10 && y <= 14 ? 'b' : `riel${y}`);
  expect(mitad(girada[0]![1])).not.toBe(mitad(girada[1]![1]));
  await page.locator('.barra-pieza button:has-text("Voltear")').tap();
  expect(await pos()).toEqual([girada[1], girada[0]]);
  // The value: 330 Ω from the chips → orange, orange, brown bands on the board.
  await page.locator('.barra-pieza button.valor').tap();
  await page.locator('.pop .chip:has-text("330 Ω")').tap();
  expect((await estado(page)).piezas.find((p) => p.id === id)!.campos['valor']).toBe('330');
  const bandas = await page.locator(`[data-pieza="${id}"]`).innerHTML();
  expect((bandas.match(/#ef7d12/g) ?? []).length).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.pop .leyenda')).toContainText('naranja');
  // One E12 step up: 390 Ω.
  await page.locator('.pop button[aria-label="Valor siguiente de la serie E12"]').tap();
  expect((await estado(page)).piezas.find((p) => p.id === id)!.campos['valor']).toBe('390');
  // Typed.
  await page.locator('.pop input').fill('4k7');
  await page.locator('.pop button:has-text("Poner")').tap();
  expect((await estado(page)).piezas.find((p) => p.id === id)!.campos['valor']).toBe('4k7');
  await page.locator('.barra-pieza button:has-text("Quitar")').tap();
  expect((await estado(page)).piezas.some((p) => p.id === id)).toBe(false);
  await ctx.close();
});

// ------------------------------------------------------------------ wires

for (const [ancho, alto] of [
  [800, 1280],
  [412, 915],
] as const) {
  test(`cables a ${ancho} px: toque–toque, arrastrando, mover un extremo y quitar con una pulsación larga`, async ({ browser }) => {
    test.setTimeout(90_000);
    const { ctx, page, cdp } = await contexto(browser, ancho, alto);
    await abrir(page);
    const n0 = (await estado(page)).cables.length;
    // Tap–tap: the start strip lights while choosing the end; a wire to the + rail is red.
    await tocarHueco(page, 8, 4);
    await expect(page.locator('.tira-cable')).toHaveCount(1);
    await tocarHueco(page, 8, 0);
    let e = await estado(page);
    expect(e.cables).toHaveLength(n0 + 1);
    const rojo = e.cables[e.cables.length - 1]!;
    expect([rojo.a, rojo.b]).toEqual([
      [8, 4],
      [8, 0],
    ]);
    expect(rojo.color).toBe('#d63a2f');
    // Dragged: the wire follows the finger, both strips lit; to the − rail it is black.
    const a = await pantalla(page, 16, 4);
    const b = await pantalla(page, 16, 1);
    await arrastrar(page, cdp, a, b, false);
    await expect(page.locator('.tira-cable')).toHaveCount(2);
    await toques(cdp, 'touchEnd', []);
    await page.waitForTimeout(250);
    e = await estado(page);
    const negro = e.cables[e.cables.length - 1]!;
    expect(negro.color).toBe('#2b2b2b');
    // An end dragged to another hole.
    await arrastrar(page, cdp, await pantalla(page, 8, 4), await pantalla(page, 9, 5));
    e = await estado(page);
    expect(e.cables.find((w) => w.id === rojo.id)!.a).toEqual([9, 5]);
    // A long press on the black one removes it, with «Deshacer».
    const m = await pantalla(page, 16, 2.5);
    await toques(cdp, 'touchStart', [m]);
    await page.waitForTimeout(900);
    await toques(cdp, 'touchEnd', []);
    await page.waitForTimeout(200);
    expect((await estado(page)).cables.some((w) => w.id === negro.id)).toBe(false);
    await expect(page.locator('.nota-flotante')).toContainText('Cable quitado');
    await page.locator('.nota-flotante button:has-text("Deshacer")').tap();
    expect((await estado(page)).cables.some((w) => w.id === negro.id)).toBe(true);
    await sinDesbordar(page, 'cables');
    await ctx.close();
  });
}

// ------------------------------------------------------------------ «Monta este circuito»

async function elegirGuiado(page: Page, id: string) {
  await page.locator('.acciones .guiar').tap();
  await page.locator(`.elegir [data-guiado="${id}"]`).tap();
  await page.waitForTimeout(300);
}

/**
 * The guide's last step, «Simular». Once a board has been simulated it also re-solves itself live after each change,
 * so the proof may come from that run first: then the step is done, its button goes away (it never stays under the
 * celebration) and there is nothing to tap. Waits for the page's own run otherwise.
 */
async function simularPasoFinal(page: Page): Promise<void> {
  const boton = page.locator('.guia button:has-text("Simular")');
  const fiesta = page.locator('.fiesta');
  await expect(boton.or(fiesta).first()).toBeVisible({ timeout: 60_000 });
  if (!(await boton.isVisible())) return;
  await page.evaluate(() => delete (window as unknown as { __epaProtoboardSim?: unknown }).__epaProtoboardSim);
  await boton.tap({ timeout: 15_000 }).catch(async (e: unknown) => {
    if (!(await fiesta.isVisible())) throw e;
  });
  await expect
    .poll(async () => (await page.evaluate(() => !!(window as unknown as { __epaProtoboardSim?: unknown }).__epaProtoboardSim)) || (await fiesta.isVisible()), { timeout: 90_000 })
    .toBe(true);
}

test('monta este circuito: cada circuito de serie se completa y se celebra', async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, page } = await contexto(browser, 800, 1280);
  await abrir(page);
  for (const id of ['led', 'divisor', 'pulsador', 'transistor', '555']) {
    await elegirGuiado(page, id);
    let e = await estado(page);
    expect(e.guia?.id).toBe(id);
    for (let k = 0; k < 30; k++) {
      e = await estado(page);
      if (e.guia!.actual >= e.guia!.total - 1) break;
      await page.locator('.guia button:has-text("Hazlo por mí")').tap();
      await page.waitForTimeout(120);
    }
    e = await estado(page);
    expect(e.guia!.actual, `${id}: montado`).toBe(e.guia!.total - 1);
    await simularPasoFinal(page);
    if (id === 'pulsador' || id === 'transistor') {
      const s1 = await page.evaluate(() => {
        const g = (window as unknown as Ventana).__epaProtoboard!;
        const p = g.pb.doc.piezas.find((x) => x.comp.nombre === 'S1')!;
        const q = p.pos[1]!;
        return g.pantalla(q[0], q[1] - 0.9);
      });
      await page.touchscreen.tap(s1[0], s1[1]);
      await page.waitForTimeout(120);
      await page.touchscreen.tap(s1[0], s1[1]);
    }
    await expect(page.locator('.fiesta'), `${id}: celebración`).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('.fiesta h2')).toHaveText('¡Funciona!');
    if (id !== 'divisor' && id !== '555') expect(await ledEncendido(page, 'D1')).toBe(true);
    await page.locator('.fiesta button:has-text("Seguir con esta placa")').tap();
    await page.evaluate(() => delete (window as unknown as { __epaProtoboardSim?: unknown }).__epaProtoboardSim);
    await expect(page.locator('.fiesta')).toHaveCount(0);
  }
  await ctx.close();
});

test('monta este circuito: un paso mal se rechaza con su explicación y su arreglo', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await contexto(browser, 800, 1280);
  await abrir(page);
  await elegirGuiado(page, 'led');
  await expect(page.locator('.guia .ahora')).toContainText('Tienda un cable desde a10 hasta el carril + (rojo)');
  // The wire to the wrong rail.
  await tocarHueco(page, 10, 3);
  await tocarHueco(page, 10, 1);
  await expect(page.locator('.respuesta.mal')).toContainText('este paso pide unir la columna 10 (filas a–e) con el carril + (rojo) de arriba');
  await page.locator('.respuesta.mal button:has-text("Quitarlo")').tap();
  await expect(page.locator('.respuesta.mal')).toHaveCount(0);
  // Right this time: the step is done and says why.
  await tocarHueco(page, 10, 3);
  await tocarHueco(page, 10, 0);
  await expect(page.locator('.respuesta.bien')).toContainText('Un cable une dos tiras');
  expect((await estado(page)).guia!.actual).toBe(1);
  // R1 by hand, then the LED put by «Hazlo por mí» and turned round: «al revés», fixed with «Voltear».
  await page.locator('.guia button:has-text("Hazlo por mí")').tap();
  await page.locator('.guia button:has-text("Hazlo por mí")').tap();
  expect((await estado(page)).guia!.actual).toBe(3);
  const d1 = (await estado(page)).piezas.find((p) => p.nombre === 'D1')!;
  const c = await page.evaluate((id) => {
    const g = (window as unknown as Ventana).__epaProtoboard!;
    const p = g.pb.doc.piezas.find((x) => x.id === id)!;
    return g.pantalla((p.pos[0]![0] + p.pos[1]![0]) / 2, p.pos[0]![1] - 0.3);
  }, d1.id);
  await page.touchscreen.tap(c[0], c[1]);
  await page.locator('.barra-pieza button:has-text("Voltear")').tap();
  await expect(page.locator('.respuesta.mal')).toContainText('D1 está al revés: la pata larga (ánodo) va en la columna 14');
  await page.locator('.respuesta.mal button:has-text("Voltear")').tap();
  await expect(page.locator('.respuesta.mal')).toHaveCount(0);
  expect((await estado(page)).guia!.actual).toBe(3);
  // «Salir» brings back the board before the guide.
  await page.locator('.guia button[aria-label^="Salir de la guía"]').tap();
  const e = await estado(page);
  expect(e.guia).toBeNull();
  expect(e.piezas.map((p) => p.nombre)).toEqual(['V1']);
  await ctx.close();
});

// ------------------------------------------------------------------ «La protoboard por dentro»

test('la protoboard por dentro: tiras, canal, carriles y preguntas (bien, mal y segundo intento)', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await contexto(browser, 412, 915, { leccion: false });
  await abrir(page);
  await elegirGuiado(page, 'led');
  // The first guided run starts with the lesson.
  expect((await estado(page)).leccion).toBe(true);
  await expect(page.locator('.leccion .ahora')).toHaveText('Toque cualquier agujero de la placa.');
  const siguiente = page.locator('.leccion button:has-text("Siguiente")');
  await expect(siguiente).toBeDisabled();
  // A tap a little off a hole snaps to it: its strip of five lights up.
  const q = await pantalla(page, 12, 4);
  await page.touchscreen.tap(q[0] + 4, q[1] + 3);
  await expect(page.locator('.luz')).toHaveCount(5);
  await expect(page.locator('.tira-luz')).toHaveCount(1);
  await expect(page.locator('.leccion-respuesta, .respuesta').first()).toContainText('los 5 agujeros de la columna 12, filas a–e');
  await siguiente.tap();
  // The channel: e and f of one column are two strips; a DIP drawn across it.
  await tocarHueco(page, 8, 7);
  await tocarHueco(page, 8, 10);
  await expect(page.locator('.tira-luz')).toHaveCount(2);
  await expect(page.locator('.silueta')).toHaveCount(1);
  await siguiente.tap();
  // The rails: a strip first (told so), then the + rail lit along the board.
  await tocarHueco(page, 14, 5);
  await expect(siguiente).toBeDisabled();
  await tocarHueco(page, 14, 0);
  expect(await page.locator('.luz').count()).toBeGreaterThanOrEqual(20);
  await siguiente.tap();
  // Question 1 (a10, e10: yes), right at once.
  await expect(page.locator('.leccion .ahora')).toHaveText('¿Están unidos los agujeros a10 y e10?');
  await page.locator('.leccion button:has-text("Sí")').tap();
  await expect(page.locator('.respuesta.bien')).toContainText('misma tira');
  await siguiente.tap();
  // Question 2 (a10, f10: no, the channel), wrong first, then right.
  await expect(page.locator('.leccion .ahora')).toHaveText('¿Están unidos los agujeros a10 y f10?');
  await page.locator('.leccion button:has-text("Sí")').tap();
  await expect(page.locator('.respuesta.mal')).toBeVisible();
  await expect(siguiente).toBeDisabled();
  await page.locator('.leccion button:has-text("No")').tap();
  await expect(page.locator('.respuesta.bien')).toContainText('el canal central las separa');
  await siguiente.tap();
  // Question 3 (a10, a11: no).
  await page.locator('.leccion button:has-text("No")').tap();
  await expect(page.locator('.respuesta.bien')).toContainText('cada columna es una tira distinta');
  await siguiente.tap();
  // Tap a hole joined to c23: wrong one first, then right.
  await tocarHueco(page, 24, 5);
  await expect(page.locator('.respuesta.mal')).toBeVisible();
  await tocarHueco(page, 23, 7);
  await expect(page.locator('.respuesta.bien')).toContainText('misma tira que c23');
  await siguiente.tap();
  await expect(page.locator('.leccion .ahora')).toHaveText('Ya sabe cómo es por dentro');
  await page.locator('.leccion button:has-text("Siguiente: LED y resistencia")').tap();
  const e = await estado(page);
  expect(e.leccion).toBe(false);
  expect(e.guia?.id).toBe('led');
  expect(await page.evaluate(() => localStorage.getItem('epa:protoboard-leccion'))).toBe('1');
  await sinDesbordar(page, 'lección');
  await ctx.close();
});

test('la protoboard por dentro: se salta, queda vista y no vuelve; sigue en la lista de la guía', async ({ browser }) => {
  const { ctx, page } = await contexto(browser, 800, 1280, { leccion: false });
  await abrir(page);
  await elegirGuiado(page, 'divisor');
  expect((await estado(page)).leccion).toBe(true);
  await page.locator('.leccion button:has-text("Saltar")').tap();
  let e = await estado(page);
  expect(e.leccion).toBe(false);
  expect(e.guia?.id).toBe('divisor');
  expect(await page.evaluate(() => localStorage.getItem('epa:protoboard-leccion'))).toBe('1');
  await page.locator('.guia button[aria-label^="Salir de la guía"]').tap();
  await elegirGuiado(page, 'led');
  e = await estado(page);
  expect(e.leccion).toBe(false);
  expect(e.guia?.id).toBe('led');
  // On its own from the list («0»).
  await elegirGuiado(page, 'leccion');
  expect((await estado(page)).leccion).toBe(true);
  await page.locator('.leccion button[aria-label="Cerrar la lección"]').tap();
  e = await estado(page);
  expect(e.leccion).toBe(false);
  await ctx.close();
});

// ------------------------------------------------------------------ the first-use tour and the layout

test('el recorrido de la primera vez se ve una vez', async ({ browser }) => {
  const { ctx, page } = await contexto(browser, 800, 1280, { recorrido: false });
  await abrir(page);
  await expect(page.locator('.recorrido')).toContainText('Las piezas');
  await page.locator('.recorrido button:has-text("Siguiente")').tap();
  await expect(page.locator('.recorrido')).toContainText('«La protoboard por dentro»');
  await page.locator('.recorrido button:has-text("Siguiente")').tap();
  await expect(page.locator('.recorrido')).toContainText('A probarlo');
  await page.locator('.recorrido button:has-text("Entendido")').tap();
  await expect(page.locator('.recorrido')).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length);
  await page.waitForTimeout(500);
  await expect(page.locator('.recorrido')).toHaveCount(0);
  await ctx.close();
});

test('a 412 px nada desborda: la página, un panel abierto, la guía y «Ver en protoboard»', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await contexto(browser, 412, 915);
  await abrir(page);
  await sinDesbordar(page, 'inicio');
  for (const b of await page.locator('.acciones button').all()) expect((await b.boundingBox())!.x + (await b.boundingBox())!.width).toBeLessThanOrEqual(412);
  for (const k of ['esquema', 'simulacion', 'avisos', 'pieza']) {
    await page.locator(`.dock .pestanas button[data-pestana="${k}"]`).tap();
    await sinDesbordar(page, `panel ${k}`);
  }
  await page.locator('.dock .pestanas button[data-pestana="piezas"]').tap();
  await elegirGuiado(page, 'transistor');
  await sinDesbordar(page, 'guía');
  await page.goto('/#/simulador/cap05/sec-5.3_led_150ohm');
  await page.locator('.meta button:has-text("Ver en protoboard")').click();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await sinDesbordar(page, 'Ver en protoboard');
  // There, «Monta este circuito» also offers that very circuit.
  await page.locator('.capa-protoboard .acciones .guiar').tap();
  await expect(page.locator('.elegir [data-guiado="libro"]')).toBeVisible();
  await page.locator('.elegir [data-guiado="libro"]').tap();
  expect((await estado(page)).guia?.id).toBe('libro');
  await sinDesbordar(page, 'guía del libro');
  await ctx.close();
});

// ------------------------------------------------------------------ a first-time user, timed

for (const [ancho, alto] of [
  [800, 1280],
  [412, 915],
] as const) {
  test(`primera vez a ${ancho} px: LED, resistencia y fuente montados y simulados, con el LED encendido, en menos de un minuto`, async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page, cdp } = await contexto(browser, ancho, alto, { recorrido: false });
    await abrir(page);
    const t0 = Date.now();
    // Only what is on screen: the tour's «Saltar», the tray, the floating bar, the holes, «Simular».
    await page.locator('.recorrido button:has-text("Saltar")').tap();
    await cartaA(page, cdp, 'R', 12, 5);
    await page.locator('.barra-pieza button.valor').tap();
    await page.locator('.pop .chip:has-text("330 Ω")').tap();
    await soltarSeleccion(page);
    await soltarSeleccion(page);
    await cartaA(page, cdp, 'LEDR', 14.5, 7);
    await soltarSeleccion(page);
    await tocarHueco(page, 10, 3);
    await tocarHueco(page, 10, 0);
    await tocarHueco(page, 15, 3);
    await tocarHueco(page, 15, 1);
    await page.locator('.herramientas .simular').tap();
    await expect.poll(() => ledEncendido(page, 'D1'), { timeout: 60_000 }).toBe(true);
    const s = (Date.now() - t0) / 1000;
    expect(s).toBeLessThan(60);
    const e = await estado(page);
    expect(e.piezas.find((p) => p.tipo === 'LED')!.pos).toEqual([
      [14, 7],
      [15, 7],
    ]);
    await ctx.close();
  });
}

// 0.11 (full suite under load): after a simulated board the bench re-solves itself live, and right after a change it
// still shows the previous operating point. The guide took that stale «LED lit» as the proof of the next circuit and
// celebrated the push-button one with its switch still open (and the fresh result then put «Simular» back under the
// celebration). Only an operating point of the board as it is now proves it.
test('monta este circuito: no celebra con el resultado de la placa anterior', async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, page } = await contexto(browser, 800, 1280);
  const cdp = await ctx.newCDPSession(page);
  await abrir(page);
  for (const id of ['led', 'pulsador']) {
    await elegirGuiado(page, id);
    for (let k = 0; k < 30; k++) {
      const e = await estado(page);
      if (e.guia!.actual >= e.guia!.total - 1) break;
      await page.locator('.guia button:has-text("Hazlo por mí")').tap();
      await page.waitForTimeout(60);
    }
    if (id === 'led') {
      await page.locator('.guia button:has-text("Simular")').tap();
      await expect(page.locator('.fiesta')).toBeVisible({ timeout: 120_000 });
      await page.locator('.fiesta button:has-text("Seguir con esta placa")').tap();
      // (a loaded machine: the live re-solve comes late)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    } else {
      // the push-button's circuit is built and its switch has not been touched: the LED is off
      await page.waitForTimeout(6000);
      await expect(page.locator('.fiesta')).toHaveCount(0);
      await expect(page.locator('.guia button:has-text("Simular")')).toBeVisible();
    }
  }
  await ctx.close();
});

// ------------------------------------------------------------------ screenshots

for (const [disp, ancho, alto] of [
  ['tableta', 800, 1280],
  ['movil', 412, 915],
] as const) {
  for (const tema of ['claro', 'oscuro'] as const) {
    test(`capturas ${disp} ${tema}`, async ({ browser }) => {
      test.setTimeout(240_000);
      fs.mkdirSync(CAPTURAS, { recursive: true });
      const { ctx, page, cdp } = await contexto(browser, ancho, alto, { tema: tema === 'oscuro' ? 'dark' : 'light', recorrido: false, leccion: false });
      const foto = async (n: string) => {
        await page.waitForTimeout(350);
        await page.screenshot({ path: `${CAPTURAS}/${n}-${disp}-${tema}.png` });
      };
      await abrir(page);
      await foto('01-recorrido');
      await page.locator('.recorrido button:has-text("Saltar")').tap();
      await foto('02-vacia');
      await cartaA(page, cdp, 'R', 12, 5, false);
      await foto('03-fantasma');
      await toques(cdp, 'touchEnd', []);
      await page.locator('.barra-pieza button.valor').tap();
      await page.locator('.pop .chip:has-text("330 Ω")').tap();
      await foto('04-barra-valor');
      await soltarSeleccion(page);
      await soltarSeleccion(page);
      await cartaA(page, cdp, 'R', 12, 5, false);
      await foto('05-no-cabe');
      await toques(cdp, 'touchEnd', []);
      await soltarSeleccion(page);
      await tocarHueco(page, 10, 3);
      await foto('06-cable-empieza');
      await tocarHueco(page, 10, 0);
      await cartaA(page, cdp, 'LEDR', 14.5, 7);
      await soltarSeleccion(page);
      await tocarHueco(page, 15, 3);
      await tocarHueco(page, 15, 1);
      await page.locator('.herramientas .simular').tap();
      await expect.poll(() => ledEncendido(page, 'D1'), { timeout: 60_000 }).toBe(true);
      await foto('07-led-encendido');
      // The guide: the lesson first (first run), then the circuit.
      await page.locator('.acciones .guiar').tap();
      await foto('08-elegir');
      await page.locator('.elegir [data-guiado="pulsador"]').tap();
      await tocarHueco(page, 12, 4);
      await foto('09-leccion-tira');
      await page.locator('.leccion button:has-text("Siguiente")').tap();
      await tocarHueco(page, 8, 7);
      await tocarHueco(page, 8, 10);
      await foto('10-leccion-canal');
      await page.locator('.leccion button:has-text("Siguiente")').tap();
      await tocarHueco(page, 14, 0);
      await page.locator('.leccion button:has-text("Siguiente")').tap();
      await page.locator('.leccion button:has-text("No")').tap();
      await foto('11-leccion-pregunta-mal');
      await page.locator('.leccion button[aria-label="Cerrar la lección"]').tap();
      await page.locator('.acciones .guiar').tap();
      await page.locator('.elegir [data-guiado="pulsador"]').tap();
      await page.locator('.guia button:has-text("Hazlo por mí")').tap();
      await foto('12-guia-paso');
      await tocarHueco(page, 12, 3);
      await tocarHueco(page, 12, 1);
      await foto('13-guia-mal');
      await page.locator('.respuesta.mal button:has-text("Quitarlo")').tap();
      for (let k = 0; k < 8; k++) {
        const e = await estado(page);
        if (e.guia!.actual >= e.guia!.total - 1) break;
        await page.locator('.guia button:has-text("Hazlo por mí")').tap();
        await page.waitForTimeout(100);
      }
      // The last step: «Simular». The board was simulated before the guide, so it also re-solves itself live after
      // each change: whichever comes first proves the circuit, and once it is proved the step's button goes away
      // (it is never left under the celebration), so the tap is only for a board that still waits for it.
      await simularPasoFinal(page);
      await page.evaluate(() => {
        const g = (window as unknown as Ventana & { __epaProtoboard: { pb: { conmutar: (id: string) => void } } }).__epaProtoboard!;
        const p = g.pb.doc.piezas.find((x) => x.comp.nombre === 'S1')!;
        g.pb.conmutar(p.id);
      });
      await expect(page.locator('.fiesta')).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(1500);
      await foto('14-funciona');
      await page.locator('.fiesta button:has-text("Seguir con esta placa")').tap();
      await page.locator('.dock .pestanas button[data-pestana="esquema"], .panel .pestanas button[data-pestana="esquema"]').first().tap();
      await foto('15-esquema');
      await ctx.close();
    });
  }
}

// ------------------------------------------------------------------ the shared engine (0.11 QA)

const LENTA = `* RC lento: un transitorio largo para que la simulación dure
V1 in 0 SIN(0 1 1k)
R1 in out 1k
C1 out 0 100n
.tran 20n 40m
.end
`;

test('la barra sigue solo las simulaciones de la protoboard: la de la página de debajo no muestra «Detener» ni se cancela', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('epa:circuito', t), LENTA);
  await page.goto('/#/simulador/nuevo');
  await expect(page.locator('.meta button:has-text("Ver en protoboard")')).toBeVisible({ timeout: 30_000 });
  // The page simulates (a long run) and the board is opened over it.
  await page.locator('.mando button:has-text("Simular")').click();
  await expect(page.locator('.mando button:has-text("Detener")')).toBeVisible({ timeout: 60_000 });
  await page.locator('.meta button:has-text("Ver en protoboard")').click();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  const barra = page.locator('.capa-protoboard .herramientas');
  for (let k = 0; k < 6; k++) {
    await expect(barra.locator('button:has-text("Detener")')).toHaveCount(0);
    await expect(barra.locator('button.simular')).toHaveText(/Simular/);
    await page.waitForTimeout(250);
  }
  // Closed, the page's run is still going (nobody cancelled it).
  await page.locator('.capa-protoboard button[aria-label="Cerrar y volver al esquema"]').click();
  await expect(page.locator('.mando button:has-text("Detener")')).toBeVisible();
});
