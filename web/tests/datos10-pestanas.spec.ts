// 1.0: one active tab at a time (lib/pestana-activa.ts), with two and three REAL Chromium pages of one context (the same
// localStorage, Web Locks and BroadcastChannel). Every page logs its own writes of the reader's data (localStorage
// `epa:*`, with the time) so the checks can prove that no two tabs ever write in the same interval and that a paused
// tab writes nothing. Automation switches the gate off unless the page sets `__epaPestanaUnica` (as here).
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.datos10.config.ts tests/datos10-pestanas.spec.ts
import { createRequire } from 'node:module';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

interface Ventana {
  __epaEstadoPestana?: () => string;
  __epaEscrituras: [number, string][];
  __epaPruebasDiario: { registrarActividad(t: string, n: number): void; cargar(): Promise<void> };
}

async function preparar(context: BrowserContext, o: { sinCerrojos?: boolean } = {}): Promise<void> {
  await context.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await context.addInitScript((sinCerrojos) => {
    const w = window as unknown as Ventana & Record<string, unknown>;
    w.__epaPestanaUnica = true;
    w.__epaEsperasPestana = { ceder: 1500, propia: 1200, latido: 300 };
    w.__epaPruebasDiario = {} as Ventana['__epaPruebasDiario'];
    // (the log of this tab's writes survives its reloads: sessionStorage is the tab's)
    const poner = Storage.prototype.setItem;
    const registro = (): [number, string][] => JSON.parse(sessionStorage.getItem('__epaEscrituras') ?? '[]');
    Object.defineProperty(w, '__epaEscrituras', { get: registro, configurable: true });
    Storage.prototype.setItem = function (k: string, v: string) {
      if (this === localStorage && k.startsWith('epa:'))
        poner.call(sessionStorage, '__epaEscrituras', JSON.stringify([...registro(), [performance.timeOrigin + performance.now(), k, w.__epaEstadoPestana?.() ?? '', (new Error().stack ?? '').split('\n').slice(2, 7).join(' | ')]]));
      return poner.call(this, k, v);
    };
    if (sinCerrojos) Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined, configurable: true });
  }, !!o.sinCerrojos);
}

// (a page reloading — taking the app back — has no context for a moment: «recargando»)
const estado = (p: Page) => p.evaluate(() => (window as unknown as Ventana).__epaEstadoPestana?.() ?? 'sin-puerta').catch(() => 'recargando');
const pantalla = (p: Page) => p.locator('.epa-pestana');
const ahora = (p: Page) => p.evaluate(() => performance.timeOrigin + performance.now());
const escrituras = (p: Page) => p.evaluate(() => (window as unknown as Ventana).__epaEscrituras);
/** When the page became the active tab (lib/pestana-activa.ts sets it for the tests). */
const activaDesde = (p: Page) => p.evaluate(() => (window as unknown as { __epaActivaDesde?: number }).__epaActivaDesde ?? 0);

async function abrir(context: BrowserContext): Promise<Page> {
  const p = await context.newPage();
  await p.goto('/#/');
  await expect.poll(() => estado(p)).not.toBe('decidiendo');
  return p;
}

async function esperarActiva(p: Page): Promise<void> {
  await expect.poll(() => estado(p), { timeout: 20_000 }).toBe('activa');
  await p.waitForFunction(() => typeof (window as unknown as Ventana).__epaPruebasDiario.cargar === 'function');
  await p.evaluate(() => (window as unknown as Ventana).__epaPruebasDiario.cargar());
}

/** «Usar aquí» on `p`, then waits until it is the active tab (it may reload). */
async function usarAqui(p: Page): Promise<void> {
  await pantalla(p).getByRole('button', { name: 'Usar aquí' }).click();
  await esperarActiva(p);
}

const pasos = (p: Page) =>
  p.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('epa:progreso-diario') ?? '{}') as Record<string, { pasos: number }>;
    return Object.entries(m)
      .filter(([k]) => k.includes('@') && !k.endsWith('~'))
      .reduce((s, [, v]) => s + v.pasos, 0);
  });

test.describe('una sola pestaña activa', () => {
  test('la segunda pestaña dice que está abierta en otra; «Usar aquí» la toma y la primera queda en pausa', async ({ context }) => {
    await preparar(context);
    const a = await abrir(context);
    await esperarActiva(a);
    const b = await abrir(context);
    expect(await estado(b)).toBe('esperando');
    const dialogo = b.getByRole('dialog', { name: 'La aplicación está abierta en otra pestaña' });
    await expect(dialogo).toBeVisible();
    const boton = dialogo.getByRole('button', { name: 'Usar aquí' });
    await expect(boton).toBeFocused();
    const caja = await boton.boundingBox();
    expect(caja!.height).toBeGreaterThanOrEqual(44);
    expect(await b.evaluate(() => document.getElementById('app')!.inert)).toBe(true);
    // the waiting tab has not even read the reader's data: nothing written
    expect((await escrituras(b)).length).toBe(0);

    await usarAqui(b);
    await expect(a.getByRole('dialog', { name: 'Esta pestaña está en pausa' })).toBeVisible();
    expect(await estado(a)).toBe('pausada');
    await expect(pantalla(b)).toHaveCount(0);
    expect(await b.evaluate(() => document.getElementById('app')!.inert)).toBe(false);

    // and back: the paused tab reloads as the active one
    await usarAqui(a);
    await expect.poll(() => estado(b)).toBe('pausada');
    await expect(a.locator('.epa-pestana')).toHaveCount(0);
  });

  test('la pestaña activa guarda lo pendiente antes de ceder; una en pausa no escribe nada', async ({ context }) => {
    await preparar(context);
    const a = await abrir(context);
    await esperarActiva(a);
    await a.evaluate(() => localStorage.removeItem('epa:progreso-diario'));
    const b = await abrir(context);
    // a step whose write is still pending (debounced 400 ms) when the hand-over starts
    await a.evaluate(() => (window as unknown as Ventana).__epaPruebasDiario.registrarActividad('paso', 1));
    const tPedir = await ahora(b);
    await pantalla(b).getByRole('button', { name: 'Usar aquí' }).click();
    await expect.poll(() => estado(a)).toBe('pausada');
    const tPausa = await ahora(a);
    await esperarActiva(b);
    expect(await pasos(b)).toBe(1);
    // the paused tab tries to count a step: refused, nothing written
    await a.evaluate(() => (window as unknown as Ventana).__epaPruebasDiario.registrarActividad('paso', 1));
    await a.waitForTimeout(1500);
    const deA = await escrituras(a);
    expect(deA.filter(([t]) => t > tPausa)).toEqual([]);
    expect(deA.some(([t, k]) => t > tPedir && t <= tPausa && k === 'epa:progreso-diario')).toBe(true);
    expect(await pasos(b)).toBe(1);
  });

  test('tres pestañas que se pasan el relevo con actividad continua: nunca escriben dos a la vez y no se pierde ningún paso', async ({ context }) => {
    test.setTimeout(240_000);
    await preparar(context);
    const ps = [await abrir(context)];
    await esperarActiva(ps[0]!);
    await ps[0]!.evaluate(() => localStorage.removeItem('epa:progreso-diario'));
    ps.push(await abrir(context), await abrir(context));
    let contados = 0;
    // which tab is active, from when: [page index, time it became active]
    const turnos: [number, number][] = [[0, 0]];
    let activa = 0;
    for (let ronda = 0; ronda < 6; ronda++) {
      for (let k = 0; k < 4; k++) {
        await ps[activa]!.evaluate(() => (window as unknown as Ventana).__epaPruebasDiario.registrarActividad('paso', 1));
        contados++;
        await ps[activa]!.waitForTimeout(120);
      }
      const siguiente = (activa + 1 + (ronda % 2)) % 3;
      await usarAqui(ps[siguiente]!);
      turnos.push([siguiente, await activaDesde(ps[siguiente]!)]);
      activa = siguiente;
    }
    await ps[activa]!.waitForTimeout(800);
    await ps[activa]!.evaluate(() => (window as unknown as Ventana).__epaPruebasDiario.cargar());
    // every step counted once (each tab its own record: lib/progreso-dias.ts), nothing lost in a hand-over
    expect(await pasos(ps[activa]!)).toBe(contados);
    // each tab wrote only while it was the active one (its turn, up to the next tab's start)
    for (let i = 0; i < 3; i++) {
      const mias = await escrituras(ps[i]!);
      for (const [t, k] of mias) {
        const turno = [...turnos].reverse().find(([, desde]) => desde <= t);
        expect(turno?.[0], `${k} escrito por la pestaña ${i} a ${Math.round(t)} (turnos ${JSON.stringify(turnos.map(([p, d]) => [p, Math.round(d)]))})`).toBe(i);
      }
    }
  });

  test('dos pestañas piden a la vez: queda una activa y ninguna se queda luego el relevo sin pedirlo', async ({ context }) => {
    await preparar(context);
    const a = await abrir(context);
    await esperarActiva(a);
    const b = await abrir(context);
    const c = await abrir(context);
    const activas = async () => (await Promise.all([a, b, c].map(estado))).filter((x) => x === 'activa').length;
    await Promise.all([pantalla(b).getByRole('button', { name: 'Usar aquí' }).click(), pantalla(c).getByRole('button', { name: 'Usar aquí' }).click()]);
    // (whichever order the two requests land in: one tab ends active, never two)
    for (let i = 0; i < 20; i++) {
      expect(await activas()).toBeLessThanOrEqual(1);
      await a.waitForTimeout(150);
    }
    await expect.poll(activas, { timeout: 20_000 }).toBe(1);
    expect(await estado(a)).toBe('pausada');
    // the first tab takes it back: it gets it, and no tab takes it afterwards without being asked
    await usarAqui(a);
    for (let i = 0; i < 15; i++) {
      expect(await estado(a)).toBe('activa');
      expect(await activas()).toBe(1);
      await a.waitForTimeout(200);
    }
  });

  test('una pestaña que se cuelga: «Usar aquí de todos modos» la sustituye y, al volver, queda en pausa sin escribir', async ({ context }) => {
    await preparar(context);
    const a = await abrir(context);
    await esperarActiva(a);
    const b = await abrir(context);
    // the active tab hangs for 8 s (a long script)
    void a.evaluate(() => {
      const t = Date.now();
      while (Date.now() - t < 8000);
    }).catch(() => undefined);
    await b.waitForTimeout(200);
    await pantalla(b).getByRole('button', { name: 'Usar aquí' }).click();
    const forzar = b.getByRole('dialog', { name: 'La otra pestaña no responde' }).getByRole('button', { name: 'Usar aquí de todos modos' });
    await expect(forzar).toBeVisible({ timeout: 10_000 });
    await forzar.click();
    await esperarActiva(b);
    const tTomada = await ahora(b);
    await expect.poll(() => estado(a), { timeout: 20_000 }).toBe('pausada');
    await a.evaluate(() => (window as unknown as Ventana).__epaPruebasDiario.registrarActividad('paso', 1));
    await a.waitForTimeout(1500);
    expect((await escrituras(a)).filter(([t]) => t > tTomada + 50)).toEqual([]);
  });

  test('una pestaña que desaparece sin ceder (cerrada de golpe) libera la aplicación', async ({ context }) => {
    // (a renderer crash cannot be isolated here: both pages share one renderer process, and Page.crash kills both; a
    // page closed without its unload handlers leaves the lock to the browser the same way)
    await preparar(context);
    const a = await abrir(context);
    await esperarActiva(a);
    const b = await abrir(context);
    expect(await estado(b)).toBe('esperando');
    await a.close({ runBeforeUnload: false });
    await b.waitForTimeout(300);
    await pantalla(b).getByRole('button', { name: 'Usar aquí' }).click();
    // the browser released the dead tab's lock: taken at once, without «no responde»
    await esperarActiva(b);
    await expect(b.getByRole('dialog', { name: 'La otra pestaña no responde' })).toHaveCount(0);
  });

  test('recargar la pestaña activa la deja activa; la otra sigue esperando', async ({ context }) => {
    await preparar(context);
    const a = await abrir(context);
    await esperarActiva(a);
    const b = await abrir(context);
    for (let i = 0; i < 3; i++) {
      await a.reload();
      await esperarActiva(a);
      expect(await estado(b)).toBe('esperando');
    }
  });

  test('atrás y adelante (caché del navegador): sigue habiendo una sola pestaña activa', async ({ context }) => {
    await preparar(context);
    const a = await abrir(context);
    await esperarActiva(a);
    const b = await abrir(context);
    await a.goto('about:blank');
    // while A is away, B takes over
    await usarAqui(b);
    await a.goBack();
    await expect.poll(() => estado(a), { timeout: 20_000 }).not.toBe('decidiendo');
    const ea = await estado(a);
    expect(['esperando', 'pausada']).toContain(ea);
    expect(await estado(b)).toBe('activa');
  });

  test('sin Web Locks (latidos por BroadcastChannel): la segunda espera, el relevo funciona y guarda lo pendiente', async ({ context }) => {
    await preparar(context, { sinCerrojos: true });
    const a = await abrir(context);
    await esperarActiva(a);
    await a.evaluate(() => localStorage.removeItem('epa:progreso-diario'));
    const b = await abrir(context);
    expect(await estado(b)).toBe('esperando');
    await a.evaluate(() => (window as unknown as Ventana).__epaPruebasDiario.registrarActividad('paso', 1));
    await usarAqui(b);
    await expect.poll(() => estado(a)).toBe('pausada');
    expect(await pasos(b)).toBe(1);
  });

  test('un examen con tiempo en una pestaña en pausa: no se entrega en pausa, y al volver a ella se entrega con sus respuestas (revisión 10a)', async ({ context }) => {
    test.setTimeout(180_000);
    await preparar(context);
    const a = await abrir(context);
    await esperarActiva(a);
    await a.goto('/#/docente/nuevo/examen');
    await a.locator('[data-titulo]').fill('Un minuto');
    await a.locator('[data-minutos]').fill('1');
    await a.locator('[data-filtro-parte]').selectOption('cap05');
    await a.locator('li[data-entrada="pregunta:cap05-01"] [data-anadir]').click();
    await a.locator('[data-guardar]').click();
    await a.locator('[data-empezar]').click();
    await expect(a.locator('[data-reloj]')).toBeVisible();
    await a.locator('[data-item-examen="1"]').getByRole('radio').first().check();
    const id = await a.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:docente') ?? '{}').propios ?? {})[0]!);
    const b = await abrir(context);
    await usarAqui(b);
    await expect.poll(() => estado(a)).toBe('pausada');
    // the time runs out while paused: nothing is handed in nor removed
    await a.waitForTimeout(65_000);
    const resultados = () => b.evaluate(() => Object.values(JSON.parse(localStorage.getItem('epa:docente-resultados') ?? '{}').resultados ?? {}) as { borrado?: number; items: { valores: Record<string, string> }[] }[]);
    expect((await resultados()).length).toBe(0);
    expect(await b.evaluate((i) => localStorage.getItem(`epa:docente-en-curso:${i}`), id)).not.toBeNull();
    // back to A: it reloads as the active tab and, the time being over, hands the exam in with its answer
    await pantalla(a).getByRole('button', { name: 'Usar aquí' }).click();
    await expect.poll(async () => (await resultados()).filter((r) => !r.borrado).length, { timeout: 30_000 }).toBe(1);
    const [r] = await resultados();
    expect(Object.keys(r!.items[0]!.valores).length).toBeGreaterThan(0);
    await expect.poll(() => a.evaluate((i) => localStorage.getItem(`epa:docente-en-curso:${i}`), id)).toBeNull();
  });

  test.describe('accesibilidad', () => {
    test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
    test('las pantallas «otra pestaña» y «en pausa» sin fallos de axe en los tres temas, 360 px', async ({ context }) => {
      await preparar(context);
      for (const tema of ['claro', 'oscuro', 'sepia'] as const) {
        const a = await abrir(context);
        await esperarActiva(a);
        await a.evaluate((tema) => localStorage.setItem('epa:prefs', JSON.stringify({ tema, tam: 18 })), tema);
        await a.reload();
        await esperarActiva(a);
        const b = await abrir(context);
        for (const [p, cual] of [
          [b, 'otra'],
          [a, 'pausada'],
        ] as const) {
          if (cual === 'pausada') await usarAqui(b);
          await expect(pantalla(p)).toHaveAttribute('data-pantalla', cual);
          expect(await p.evaluate(() => document.scrollingElement!.scrollWidth), tema).toBeLessThanOrEqual(360);
          await p.addScriptTag({ path: AXE });
          const v = await p.evaluate(async () => {
            const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
            const r = await axe.run(document.querySelector('.epa-pestana'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
            return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
          });
          expect(v, `${tema} ${cual}`).toEqual([]);
        }
        await a.close();
        await b.close();
      }
    });
  });
});
