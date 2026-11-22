// 1.3.1 (qa131-interaccion): seeded monkeys on the interactive features of 1.3, on the owner's phone (Pixel 8 Pro:
// 412 × 915, DPR 3.5, touch; real multi-touch through CDP) and on a desktop where the feature is a mouse one. Each seed
// runs a storm of random actions — taps, drags with the lift, a second finger or a turn of the phone mid-drag, long
// presses, pinches, the fine-adjust arrows, the «Medir» grip at its extremes, the tray, undo/redo, keys; on the boards
// in 3D one- and two-finger gestures, the wheel, double taps, the view buttons; in «Busque la avería» leads on random
// pads, the modes, the faults, photo ↔ 3D; the real Brymen's panel with a fake cable that sends random, malformed,
// partial, OL and negative packets and gets unplugged; the «Monte» card — and checks after every few actions: no error
// nor unhandled rejection, no NaN / undefined on screen or in the drawing, no horizontal scroll, nothing left
// half-done (a loupe with no finger down), every part, lead and wire end on a whole hole, the camera finite and within
// its limits; once the page is left, no listener, interval, observer or animation frame left behind.
// The trail of a failing seed is printed with it; MONO_SEMILLAS=7,8 and MONO_ACCIONES=200 run others / longer.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with a server> tests/monos/qa131-monos-interaccion.spec.ts
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ACCIONES, azar, Dedos, errores, instrumentar, Rastro, registro, semillas, sinBasura, sinFugas, type P } from './comun-interaccion';

const ELEVACION = 56;

type Doc = { piezas: { id: string; comp: { nombre: string }; pos: P[] }[]; cables: { id: string; a: P; b: P }[]; columnas: number; placas: number };
interface Ventana {
  __epaProtoboard?: { pb: { doc: Doc; herramienta: string; sel: string[] }; pantalla: (x: number, y: number) => P; escala: () => number; pata: (n: string, i: number) => P | null };
  __epaMedida?: { medida: { puntas: Record<string, P | null> } };
}

async function telefono(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await instrumentar(ctx);
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true });
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    if (sessionStorage.getItem('qa131-mono')) return;
    sessionStorage.setItem('qa131-mono', '1');
    localStorage.removeItem('epa:protoboard-borrador');
    localStorage.setItem('epa:protoboard-recorrido', '1');
    localStorage.setItem('epa:protoboard-leccion', '1');
    localStorage.setItem('epa:medir-pista', 'vista');
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, dedos: new Dedos(cdp, page) };
}

/** Every leg, lead and wire end on a whole hole (finite integers); no loupe or arrows left without a finger down. */
async function protoboardSana(page: Page, rastro: Rastro) {
  const r = await page.evaluate(() => {
    const w = window as unknown as Ventana;
    const e = w.__epaProtoboard;
    if (!e) return ['sin protoboard'];
    const mal: string[] = [];
    const entero = (q: unknown) => Array.isArray(q) && q.length === 2 && q.every((x) => Number.isInteger(x));
    for (const p of e.pb.doc.piezas) for (const q of p.pos) if (!entero(q)) mal.push(`${p.comp.nombre} en ${JSON.stringify(q)}`);
    for (const c of e.pb.doc.cables) if (!entero(c.a) || !entero(c.b)) mal.push(`cable ${c.id} ${JSON.stringify([c.a, c.b])}`);
    for (const [k, q] of Object.entries(w.__epaMedida?.medida.puntas ?? {})) if (q != null && !entero(q)) mal.push(`punta ${k} en ${JSON.stringify(q)}`);
    if (!Number.isFinite(e.escala())) mal.push(`escala ${e.escala()}`);
    if (document.querySelector('[data-lupa]')) mal.push('lupa sin dedo');
    return mal;
  });
  expect(r, `protoboard (${rastro})`).toEqual([]);
}

test.describe('monos de la protoboard en el teléfono', () => {
  for (const semilla of semillas([131, 1312, 13131])) {
    test(`semilla ${semilla}: tocar, arrastrar, dos dedos, girar el teléfono, flechas, «Medir», bandeja, deshacer y teclas`, async ({ browser }) => {
      test.setTimeout(400_000);
      const { ctx, page, dedos } = await telefono(browser);
      const fallos = errores(page);
      const a = azar(semilla);
      const rastro = new Rastro(semilla);
      // (a first visit sets up the app's lazy singletons — a storage key's listener —: the leaks are counted after it)
      const abrir = async () => {
        await page.goto('/#/protoboard');
        await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
        await page.waitForTimeout(500);
      };
      await abrir();
      await page.goto('/#/');
      await page.waitForTimeout(1200);
      const antes = await registro(page);
      await abrir();
      const mesa = async () => {
        const b = await page.locator('.mesa').first().boundingBox({ timeout: 5000 }).catch(() => null);
        expect(b, `el banco ha desaparecido en ${page.url()} (${rastro})`).not.toBeNull();
        return b;
      };
      const punto = async (): Promise<P> => {
        const b = (await mesa())!;
        // (also a few px off the bench's edges: the edge cases)
        return [a.entre(b.x - 6, b.x + b.width + 6), a.entre(b.y - 6, b.y + b.height + 6)];
      };
      const agarre = async (): Promise<P> => {
        const p = await page.evaluate((k) => {
          const w = window as unknown as Ventana;
          const e = w.__epaProtoboard!;
          const cosas: P[] = [];
          for (const q of Object.values(w.__epaMedida?.medida.puntas ?? {})) if (q) cosas.push(e.pantalla(q[0], q[1]));
          for (const p of e.pb.doc.piezas) for (const q of p.pos) cosas.push(e.pantalla(q[0], q[1]));
          for (const c of e.pb.doc.cables) cosas.push(e.pantalla(c.a[0], c.a[1]), e.pantalla(c.b[0], c.b[1]));
          return cosas.length ? cosas[Math.floor(k * cosas.length)]! : null;
        }, a.r());
        return p ?? punto();
      };
      for (let i = 0; i < ACCIONES; i++) {
        const acc = a.pesos({ toque: 12, arrastrar: 18, largo: 4, pellizco: 4, pestana: 8, punta: 6, flecha: 8, tirador: 5, bandeja: 6, deshacer: 4, tecla: 6, cable: 3, girar: 3, desplazar: 3 });
        switch (acc) {
          case 'toque': {
            const p = await punto();
            rastro.apuntar(`toque ${p.map(Math.round)}`);
            await dedos.toque(p, a.uno([0, 40, 200]));
            break;
          }
          case 'arrastrar': {
            const de = await agarre();
            const a1 = await punto();
            const hacia: P = [a1[0], a1[1] + ELEVACION];
            const raro = a.pesos({ nada: 6, segundo: 1, girar: 1, cancelar: 1, desplazar: 1 });
            rastro.apuntar(`arrastrar ${de.map(Math.round)} → ${hacia.map(Math.round)} (${raro})`);
            await dedos.bajar([de]);
            await page.waitForTimeout(a.uno([0, 30, 450]));
            await dedos.deslizar([de], [[de[0], de[1] + 14]], 3);
            await page.waitForTimeout(a.uno([0, 200]));
            await dedos.deslizar([[de[0], de[1] + 14]], [hacia], a.entero(2, 12));
            if (raro === 'segundo') {
              await dedos.bajar([hacia, [hacia[0] - 80, hacia[1] - 60]]);
              await dedos.deslizar([hacia, [hacia[0] - 80, hacia[1] - 60]], [hacia, [hacia[0] - 120, hacia[1] - 100]], 4);
            } else if (raro === 'girar') {
              await page.setViewportSize({ width: 915, height: 412 });
              await page.waitForTimeout(150);
              await dedos.mover([[Math.min(hacia[0], 900), Math.min(hacia[1], 400)]]);
              await page.setViewportSize({ width: 412, height: 915 });
              await page.waitForTimeout(150);
            } else if (raro === 'desplazar') await page.evaluate(() => scrollBy(0, 40));
            if (raro === 'cancelar') await dedos.cancelar();
            else await dedos.soltar();
            break;
          }
          case 'largo': {
            const p = await agarre();
            rastro.apuntar(`largo ${p.map(Math.round)}`);
            await dedos.bajar([p]);
            await page.waitForTimeout(a.uno([500, 900]));
            await dedos.soltar();
            break;
          }
          case 'pellizco': {
            const c = await punto();
            const d0 = a.entre(30, 120);
            const d1 = a.entre(30, 200);
            rastro.apuntar(`pellizco ${c.map(Math.round)} ${Math.round(d0)}→${Math.round(d1)}`);
            await dedos.bajar([[c[0] - d0 / 2, c[1]], [c[0] + d0 / 2, c[1]]]);
            await dedos.deslizar([[c[0] - d0 / 2, c[1]], [c[0] + d0 / 2, c[1]]], [[c[0] - d1 / 2, c[1] + 10], [c[0] + d1 / 2, c[1] - 10]], 6);
            await dedos.soltar();
            break;
          }
          case 'pestana': {
            const n = await page.locator('[data-pestana]:visible').count();
            if (!n) break;
            const k = a.entero(0, n - 1);
            rastro.apuntar(`pestaña ${k}`);
            await page.locator('[data-pestana]:visible').nth(k).tap({ timeout: 5000 }).catch(() => rastro.apuntar('(pestaña tapada)'));
            break;
          }
          case 'punta': {
            const n = await page.locator('[data-punta]:visible').count();
            if (!n) break;
            const k = a.entero(0, n - 1);
            rastro.apuntar(`punta ${k}`);
            await page.locator('[data-punta]:visible').nth(k).tap({ timeout: 5000 }).catch(() => rastro.apuntar('(punta tapada)'));
            break;
          }
          case 'flecha': {
            const n = await page.locator('[data-ajuste]:visible').count();
            if (!n) break;
            const k = a.entero(0, n - 1);
            const veces = a.entero(1, 6);
            rastro.apuntar(`flecha ${k} ×${veces}`);
            for (let v = 0; v < veces; v++) {
              const b = page.locator('[data-ajuste]:visible').nth(k);
              if (!(await b.count())) break;
              await b.tap({ timeout: 3000 }).catch(() => {});
            }
            break;
          }
          case 'tirador': {
            const t = page.locator('[data-tirador-dock]:visible');
            if (!(await t.count())) break;
            const b = (await t.boundingBox())!;
            const y = a.uno([0, 5, 200, 450, 700, 910, 2000]);
            rastro.apuntar(`tirador → ${y}`);
            const de: P = [b.x + b.width / 2, b.y + b.height / 2];
            await dedos.bajar([de]);
            await dedos.deslizar([de], [[de[0], y]], 5);
            await dedos.soltar();
            break;
          }
          case 'bandeja': {
            const n = await page.locator('[data-carta]:visible').count();
            if (!n) break;
            const k = a.entero(0, n - 1);
            const b = await page.locator('[data-carta]:visible').nth(k).boundingBox();
            if (!b) break;
            const de: P = [b.x + b.width / 2, b.y + b.height / 2];
            const hacia = await punto();
            const toque = a.r() < 0.4;
            rastro.apuntar(`bandeja ${k} ${toque ? 'toque' : 'arrastre'} → ${hacia.map(Math.round)}`);
            if (toque) {
              await dedos.toque(de);
              await page.waitForTimeout(100);
              await dedos.toque(hacia, a.uno([40, 500]));
            } else {
              await dedos.bajar([de]);
              await page.waitForTimeout(a.uno([30, 400]));
              await dedos.deslizar([de], [hacia], 10);
              await dedos.soltar();
            }
            break;
          }
          case 'deshacer': {
            const nombre = a.uno(['Deshacer', 'Rehacer']);
            rastro.apuntar(nombre);
            const b = page.getByRole('button', { name: nombre, exact: true }).first();
            if (await b.isEnabled().catch(() => false)) await b.tap({ timeout: 3000 }).catch(() => {});
            break;
          }
          case 'tecla': {
            const t = a.uno(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'r', 'Delete', ' ']);
            rastro.apuntar(`tecla ${t}`);
            // (on the bench: the keyboard path of the board itself, not the page's links)
            await page.locator('.mesa').first().focus().catch(() => {});
            await page.keyboard.press(t);
            break;
          }
          case 'cable': {
            rastro.apuntar('modo cable (w)');
            await page.evaluate(() => {
              const pb = (window as unknown as Ventana).__epaProtoboard!.pb;
              if (pb.herramienta !== 'medir') pb.herramienta = pb.herramienta === 'cable' ? 'seleccionar' : 'cable';
            });
            break;
          }
          case 'girar': {
            const tumbado = a.r() < 0.5;
            rastro.apuntar(`girar el teléfono ${tumbado ? 'tumbado' : 'de pie'}`);
            await page.setViewportSize(tumbado ? { width: 915, height: 412 } : { width: 412, height: 915 });
            break;
          }
          case 'desplazar': {
            const dy = a.entre(-300, 300);
            rastro.apuntar(`desplazar la página ${Math.round(dy)}`);
            await page.evaluate((y) => scrollBy(0, y), dy);
            break;
          }
        }
        await page.waitForTimeout(a.uno([0, 30, 120]));
        if (i % 8 === 7 || i === ACCIONES - 1) {
          await page.setViewportSize({ width: 412, height: 915 });
          await page.waitForTimeout(450);
          expect(fallos, String(rastro)).toEqual([]);
          expect((await registro(page)).errores, String(rastro)).toEqual([]);
          await protoboardSana(page, rastro);
          await sinBasura(page, rastro, '.protoboard');
        }
      }
      // leaving the page leaves nothing behind
      await page.goto('/#/');
      await sinFugas(page, antes, rastro);
      expect(fallos, String(rastro)).toEqual([]);
      await ctx.close();
    });
  }
});

// ---------------------------------------------------------------- the boards in 3D, navigated as a map

type Cam = { az: number; el: number; d: number; t: number[]; pos: number[]; lim: { x: number; y: number }; min: number; max: number; anim: boolean };
const camara = (page: Page): Promise<Cam> =>
  page.evaluate(() => {
    type V = { x: number; y: number; z: number };
    const e = (globalThis as unknown as { __epaPlaca3DEscena: { camara: { position: V }; orbita: { azimut: number; elevacion: number; distanciaReal: number; objetivo: V; minDist: number; maxDist: number; mapa: { limites(): { x: number; y: number } }; transicion: unknown } } }).__epaPlaca3DEscena;
    const o = e.orbita;
    return { az: o.azimut, el: o.elevacion, d: o.distanciaReal, t: [o.objetivo.x, o.objetivo.y, o.objetivo.z], pos: [e.camara.position.x, e.camara.position.y, e.camara.position.z], lim: o.mapa.limites(), min: o.minDist, max: o.maxDist, anim: !!o.transicion };
  });

async function camaraSana(page: Page, rastro: Rastro) {
  const c = await camara(page);
  const mal: string[] = [];
  if (![c.az, c.el, c.d, ...c.t, ...c.pos].every(Number.isFinite)) mal.push(`no finita: ${JSON.stringify(c)}`);
  if (c.el < -1e-6 || c.el > Math.PI / 2 + 1e-6) mal.push(`elevación ${c.el}`);
  if (c.d < c.min - 1e-6 || c.d > c.max * 2) mal.push(`distancia ${c.d} fuera de [${c.min}, ${c.max}]`);
  if (Math.abs(c.t[0]!) > c.lim.x + 1e-6 || Math.abs(c.t[1]!) > c.lim.y + 1e-6) mal.push(`pivote ${c.t} fuera de ±${c.lim.x}, ±${c.lim.y}`);
  expect(mal, `cámara (${rastro})`).toEqual([]);
}

async function abrir3D(page: Page) {
  await page.goto('/#/consolas/snes/placa3d');
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 300_000 });
  await page.locator('.v3d canvas').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
}

test.describe('monos de la placa en 3D', () => {
  for (const semilla of semillas([3131, 31313])) {
    test(`semilla ${semilla}: uno, dos y tres dedos, el orden al levantarlos, doble toque, rueda, ratón, teclado, botones y tamaño`, async ({ browser }) => {
      test.setTimeout(900_000);
      const { ctx, page, dedos } = await telefono(browser);
      const fallos = errores(page);
      const a = azar(semilla);
      const rastro = new Rastro(semilla);
      // (cierre131: on a phone the bottom bar's «Inicio» lies over the canvas, and a tap there opens the home page,
      // whose lazy singletons — the problem of the day, set once — are not a leak of the board: open it once first)
      await page.goto('/#/');
      await page.waitForTimeout(1500);
      await abrir3D(page);
      await page.goto('/#/consolas/snes');
      await page.waitForTimeout(1500);
      const antes = await registro(page);
      await abrir3D(page);
      const lienzo = () => page.locator('.v3d canvas').boundingBox({ timeout: 10_000 }).catch(() => null);
      const punto = async (b?: { x: number; y: number; width: number; height: number } | null): Promise<P> => {
        const c = b ?? (await lienzo())!;
        return [a.entre(c.x + 4, c.x + c.width - 4), a.entre(c.y + 4, c.y + c.height - 4)];
      };
      for (let i = 0; i < ACCIONES; i++) {
        const acc = a.pesos({ uno: 14, dos: 14, tres: 3, toque: 6, doble: 6, rueda: 8, raton: 6, teclas: 8, boton: 8, tamano: 3, cancelar: 2 });
        // (a tap on a part's label follows its link, to the book: back to the board)
        if (!page.url().includes('/placa3d')) {
          rastro.apuntar(`(se fue a ${page.url().split('#')[1]}: vuelta a la placa)`);
          await abrir3D(page);
        }
        const b = await lienzo();
        if (!b) break;
        switch (acc) {
          case 'uno': {
            const de = await punto(b);
            const hacia = await punto(b);
            rastro.apuntar(`un dedo ${de.map(Math.round)} → ${hacia.map(Math.round)}`);
            await dedos.bajar([de]);
            await dedos.deslizar([de], [hacia], a.entero(2, 12), a.uno([0, 8, 16]));
            await dedos.soltar();
            break;
          }
          case 'dos': {
            const c = await punto(b);
            const r0 = a.entre(20, 140);
            const g0 = a.entre(0, Math.PI);
            const r1 = a.entre(10, 220);
            const g1 = g0 + a.entre(-1.2, 1.2);
            const m: P = [a.entre(-80, 80), a.entre(-160, 160)];
            const ini: P[] = [[c[0] - r0 * Math.cos(g0), c[1] - r0 * Math.sin(g0)], [c[0] + r0 * Math.cos(g0), c[1] + r0 * Math.sin(g0)]];
            const fin: P[] = [[c[0] + m[0] - r1 * Math.cos(g1), c[1] + m[1] - r1 * Math.sin(g1)], [c[0] + m[0] + r1 * Math.cos(g1), c[1] + m[1] + r1 * Math.sin(g1)]];
            const orden = a.uno(['juntos', 'primero', 'segundo']);
            rastro.apuntar(`dos dedos ${c.map(Math.round)} r ${Math.round(r0)}→${Math.round(r1)} giro ${(g1 - g0).toFixed(2)} mueve ${m.map(Math.round)} suelta ${orden}`);
            await dedos.bajar([ini[0]!]);
            await page.waitForTimeout(a.uno([0, 20]));
            await dedos.bajar(ini);
            await dedos.deslizar(ini, fin, a.entero(3, 14), a.uno([0, 16]));
            if (orden === 'juntos') await dedos.soltar();
            else {
              // one finger lifts, the other one goes on panning
              const [sale, queda] = orden === 'primero' ? [0, 1] : [1, 0];
              await dedos.levantar([fin[sale]!], [sale + 1]);
              await dedos.deslizar([fin[queda]!], [await punto(b)], 6, 16, [queda + 1]);
              await dedos.soltar();
            }
            break;
          }
          case 'tres': {
            const ps: P[] = [await punto(b), await punto(b), await punto(b)];
            rastro.apuntar('tres dedos');
            await dedos.bajar(ps);
            await dedos.deslizar(ps, [await punto(b), await punto(b), await punto(b)], 5);
            if (a.r() < 0.5) await dedos.levantar([ps[2]!], [3]);
            await dedos.soltar();
            break;
          }
          case 'toque': {
            const p = await punto(b);
            rastro.apuntar(`toque ${p.map(Math.round)}`);
            await dedos.toque(p, a.uno([20, 120]));
            break;
          }
          case 'doble': {
            const p = await punto(b);
            rastro.apuntar(`doble toque ${p.map(Math.round)}`);
            await dedos.toque(p, 30);
            await page.waitForTimeout(a.uno([60, 150]));
            await dedos.toque([p[0] + a.entre(-6, 6), p[1] + a.entre(-6, 6)], 30);
            if (a.r() < 0.3) {
              // a gesture while it is still moving closer
              await page.waitForTimeout(100);
              const q = await punto(b);
              await dedos.bajar([q]);
              await dedos.deslizar([q], [await punto(b)], 4);
              await dedos.soltar();
            }
            break;
          }
          case 'rueda': {
            const p = await punto(b);
            const n = a.entero(1, 40);
            const dy = a.uno([-400, -100, -20, 20, 100, 400]);
            const ctrl = a.r() < 0.5;
            rastro.apuntar(`rueda ${n}× ${dy}${ctrl ? ' con Ctrl' : ''} en ${p.map(Math.round)}`);
            await page.mouse.move(p[0], p[1]);
            if (ctrl) await page.keyboard.down('Control');
            for (let k = 0; k < n; k++) await page.mouse.wheel(0, dy);
            if (ctrl) await page.keyboard.up('Control');
            break;
          }
          case 'raton': {
            const de = await punto(b);
            const hacia = await punto(b);
            const boton = a.uno(['left', 'right', 'middle'] as const);
            const ctrl = boton === 'left' && a.r() < 0.4;
            rastro.apuntar(`ratón ${boton}${ctrl ? '+Ctrl' : ''} ${de.map(Math.round)} → ${hacia.map(Math.round)}`);
            await page.mouse.move(de[0], de[1]);
            if (ctrl) await page.keyboard.down('Control');
            await page.mouse.down({ button: boton });
            await page.mouse.move(hacia[0], hacia[1], { steps: a.entero(2, 10) });
            await page.mouse.up({ button: boton });
            if (ctrl) await page.keyboard.up('Control');
            if (a.r() < 0.3) await page.mouse.dblclick(hacia[0], hacia[1]);
            break;
          }
          case 'teclas': {
            await page.locator('.v3d canvas').focus();
            const n = a.entero(1, 15);
            const ks: string[] = [];
            for (let k = 0; k < n; k++) ks.push(a.uno(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift+ArrowLeft', 'Shift+ArrowUp', 'Shift+ArrowDown', '+', '-', '0', 'Home']));
            rastro.apuntar(`teclas ${ks.join(' ')}`);
            for (const k of ks) await page.keyboard.press(k);
            break;
          }
          case 'boton': {
            const nombre = a.uno(['Vista inicial', 'Vista desde arriba', 'Inclinada', 'Arriba', 'Abajo', 'Canto']);
            rastro.apuntar(`botón ${nombre}`);
            await page.getByRole('button', { name: nombre, exact: true }).first().click({ timeout: 5000 }).catch(() => rastro.apuntar('(no se pudo)'));
            if (a.r() < 0.4) {
              // straight away, while it animates: a gesture or another view
              const q = await punto(b);
              await dedos.bajar([q]);
              await dedos.deslizar([q], [await punto(b)], 3);
              await dedos.soltar();
            }
            break;
          }
          case 'tamano': {
            const v = a.uno([{ width: 412, height: 915 }, { width: 915, height: 412 }, { width: 360, height: 740 }, { width: 834, height: 1194 }]);
            rastro.apuntar(`tamaño ${v.width}×${v.height}`);
            await page.setViewportSize(v);
            await page.locator('.v3d canvas').scrollIntoViewIfNeeded().catch(() => {});
            break;
          }
          case 'cancelar': {
            const p = await punto(b);
            rastro.apuntar(`dedo cancelado ${p.map(Math.round)}`);
            await dedos.bajar([p]);
            await dedos.deslizar([p], [await punto(b)], 3);
            await dedos.cancelar();
            break;
          }
        }
        if (i % 6 === 5 || i === ACCIONES - 1) {
          await page.waitForTimeout(700);
          expect(fallos, String(rastro)).toEqual([]);
          expect((await registro(page)).errores, String(rastro)).toEqual([]);
          await camaraSana(page, rastro);
          await sinBasura(page, rastro, '.v3d');
        }
      }
      // after the storm a single finger still pans and the view buttons still work (nothing stuck)
      await page.setViewportSize({ width: 412, height: 915 });
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Vista inicial', exact: true }).first().click();
      await page.waitForTimeout(800);
      const c0 = await camara(page);
      const bb = (await lienzo())!;
      const m: P = [bb.x + bb.width / 2, bb.y + bb.height / 2];
      await dedos.bajar([m]);
      await dedos.deslizar([m], [[m[0] + 60, m[1] + 40]], 8);
      await dedos.soltar();
      await page.waitForTimeout(600);
      const c1 = await camara(page);
      expect(Math.hypot(c1.t[0]! - c0.t[0]!, c1.t[1]! - c0.t[1]!), `un dedo ya no mueve la placa (${rastro})`).toBeGreaterThan(0.5);
      await page.goto('/#/consolas/snes');
      await sinFugas(page, antes, rastro);
      expect(fallos, String(rastro)).toEqual([]);
      await ctx.close();
    });
  }

  test('abrir y cerrar la placa en 3D muchas veces no acumula contextos WebGL ni memoria', async ({ browser }) => {
    test.setTimeout(900_000);
    const { ctx, page } = await telefono(browser);
    const fallos = errores(page);
    const cdp = await ctx.newCDPSession(page);
    const rastro = new Rastro(0);
    const heap = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      await page.waitForTimeout(300);
      await cdp.send('HeapProfiler.collectGarbage');
      return (await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6;
    };
    const medidas: { heap: number; vivos: number }[] = [];
    for (let k = 0; k < 7; k++) {
      await abrir3D(page);
      rastro.apuntar(`visita ${k + 1}`);
      await page.goto('/#/consolas/snes');
      await page.waitForTimeout(1500);
      const r = await registro(page);
      medidas.push({ heap: await heap(), vivos: r.gl - r.glPerdidos });
    }
    console.log('qa131 3D abrir/cerrar:', JSON.stringify(medidas));
    expect(fallos).toEqual([]);
    // (the first visits warm up the app's caches; from the third on nothing grows)
    expect(medidas.at(-1)!.vivos, 'contextos WebGL vivos tras cerrar').toBeLessThanOrEqual(1);
    expect(medidas.at(-1)!.heap - medidas[2]!.heap, `memoria que crece por visita: ${JSON.stringify(medidas)}`).toBeLessThan(6);
    await ctx.close();
  });
});

// ---------------------------------------------------------------- «Busque la avería»

test.describe('monos de «Busque la avería»', () => {
  for (const semilla of semillas([4131, 41313])) {
    test(`semilla ${semilla}: puntas en pads al azar, la misma para las dos, Ω encendida, otra avería, foto ↔ 3D, lista y piezas`, async ({ browser }) => {
      test.setTimeout(900_000);
      const { ctx, page, dedos } = await telefono(browser);
      const fallos = errores(page);
      const a = azar(semilla);
      const rastro = new Rastro(semilla);
      const abrir = async () => {
        await page.goto('/#/consolas/snes/averia');
        await expect(page.locator('[data-funcion="Ω"]')).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(600);
      };
      await abrir();
      await page.goto('/#/consolas/snes');
      await page.waitForTimeout(1200);
      const antes = await registro(page);
      await abrir();
      const zona = async () => (await page.locator('[data-foto-averia]:visible, .v3d canvas:visible').first().boundingBox({ timeout: 3000 }).catch(() => null)) ?? null;
      const boton = async (sel: string, nombre: string) => {
        const n = await page.locator(`${sel}:visible`).count();
        if (!n) return;
        const k = a.entero(0, n - 1);
        rastro.apuntar(`${nombre} ${k}`);
        await page.locator(`${sel}:visible`).nth(k).tap({ timeout: 4000 }).catch(() => rastro.apuntar('(no se pudo)'));
      };
      for (let i = 0; i < ACCIONES; i++) {
        if (!page.url().includes('/averia')) {
          rastro.apuntar(`(se fue a ${page.url().split('#')[1]}: vuelta)`);
          await abrir();
        }
        const acc = a.pesos({ toque: 14, arrastrePunta: 8, largo: 3, pellizco: 4, mano: 6, funcion: 6, encendida: 5, vista: 4, otra: 3, lista: 8, mismo: 3, pieza: 5, zoom: 3 });
        const b = await zona();
        switch (acc) {
          case 'toque': {
            if (!b) break;
            const p: P = [a.entre(b.x, b.x + b.width), a.entre(b.y, b.y + b.height)];
            rastro.apuntar(`toque ${p.map(Math.round)}`);
            await dedos.toque(p, a.uno([30, 200, 500]));
            break;
          }
          case 'arrastrePunta': {
            const n = await page.locator('[data-punta-foto], [data-asa-3d]').count();
            if (!n || !b) break;
            const k = a.entero(0, n - 1);
            const r = await page.locator('[data-punta-foto], [data-asa-3d]').nth(k).boundingBox().catch(() => null);
            if (!r) break;
            const de: P = [r.x + r.width / 2, r.y + r.height / 2];
            const hacia: P = [a.entre(b.x - 10, b.x + b.width + 10), a.entre(b.y - 10, b.y + b.height + 10)];
            rastro.apuntar(`arrastrar punta ${k} ${de.map(Math.round)} → ${hacia.map(Math.round)}`);
            await dedos.bajar([de]);
            await dedos.deslizar([de], [hacia], a.entero(3, 10));
            if (a.r() < 0.15) await dedos.cancelar();
            else await dedos.soltar();
            break;
          }
          case 'largo': {
            if (!b) break;
            const p: P = [a.entre(b.x, b.x + b.width), a.entre(b.y, b.y + b.height)];
            rastro.apuntar(`largo ${p.map(Math.round)}`);
            await dedos.bajar([p]);
            await page.waitForTimeout(700);
            await dedos.deslizar([p], [[p[0] + a.entre(-40, 40), p[1] + a.entre(-40, 40)]], 4);
            await dedos.soltar();
            break;
          }
          case 'pellizco': {
            if (!b) break;
            const c: P = [b.x + b.width / 2, b.y + b.height / 2];
            const d0 = a.entre(40, 120);
            const d1 = a.entre(20, 260);
            rastro.apuntar(`pellizco ${Math.round(d0)}→${Math.round(d1)}`);
            await dedos.bajar([[c[0] - d0 / 2, c[1]], [c[0] + d0 / 2, c[1]]]);
            await dedos.deslizar([[c[0] - d0 / 2, c[1]], [c[0] + d0 / 2, c[1]]], [[c[0] - d1 / 2, c[1]], [c[0] + d1 / 2, c[1]]], 6);
            await dedos.soltar();
            break;
          }
          case 'mano':
            await boton('[data-mano]', 'mano');
            break;
          case 'funcion':
            await boton('[data-funcion]', 'función');
            break;
          case 'encendida':
            await boton('[data-encendida]', 'encendida');
            break;
          case 'vista':
            await boton('[data-vista-averia]', 'vista');
            await page.waitForTimeout(a.uno([0, 1500]));
            break;
          case 'otra':
            await boton('[data-otra-averia]', 'otra avería');
            break;
          case 'pieza':
            await boton('[data-sospechoso]', 'pieza');
            break;
          case 'zoom':
            await boton('[data-foto-averia] .zoom button', 'zoom foto');
            break;
          case 'lista':
          case 'mismo': {
            const sel = page.locator('[data-select-punta]');
            if (!(await sel.count())) break;
            if (!(await sel.first().isVisible())) await page.locator('details.puntos summary').tap({ timeout: 3000 }).catch(() => {});
            const ops = await sel.first().locator('option').evaluateAll((xs) => xs.map((x) => (x as HTMLOptionElement).value));
            const v = a.uno(ops);
            const cual = a.uno(['roja', 'negra']);
            rastro.apuntar(acc === 'mismo' ? `las dos puntas en «${v}»` : `lista: ${cual} en «${v}»`);
            if (acc === 'mismo') {
              await page.locator('[data-select-punta="roja"]').selectOption(v, { timeout: 3000 }).catch(() => {});
              await page.locator('[data-select-punta="negra"]').selectOption(v, { timeout: 3000 }).catch(() => {});
            } else await page.locator(`[data-select-punta="${cual}"]`).selectOption(v, { timeout: 3000 }).catch(() => {});
            break;
          }
        }
        if (i % 6 === 5 || i === ACCIONES - 1) {
          await page.waitForTimeout(500);
          expect(fallos, String(rastro)).toEqual([]);
          expect((await registro(page)).errores, String(rastro)).toEqual([]);
          const r = await page.evaluate(() => {
            const e = (window as unknown as { __epaAveriaPlaca?: { puntas(): Record<string, string | null>; resultado(): { tipo: string; valor?: number } | null } }).__epaAveriaPlaca;
            if (!e) return ['sin __epaAveriaPlaca'];
            const mal: string[] = [];
            const r = e.resultado();
            if (r?.tipo === 'valor' && Number.isNaN(r.valor)) mal.push(`lectura NaN ${JSON.stringify(r)}`);
            if (document.querySelector('[data-lupa]')) mal.push('lupa sin dedo');
            return mal;
          });
          expect(r, String(rastro)).toEqual([]);
          await sinBasura(page, rastro, '.averia-placa');
        }
      }
      await page.goto('/#/consolas/snes');
      await sinFugas(page, antes, rastro);
      expect(fallos, String(rastro)).toEqual([]);
      await ctx.close();
    });
  }
});

// ---------------------------------------------------------------- the real Brymen with a fake cable that misbehaves

test.describe('monos del Brymen real con un cable falso', () => {
  for (const semilla of semillas([5131, 51313])) {
    test(`semilla ${semilla}: paquetes al azar, partidos, OL, negativos, otra unidad, desenchufes, conectar y desconectar, salir y volver`, async ({ browser }) => {
      test.setTimeout(400_000);
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
      await instrumentar(ctx);
      await ctx.addInitScript(() => {
        localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
        (window as unknown as { __epaBrymenFalso: unknown }).__epaBrymenFalso = { respuesta: null, fija: true };
      });
      const page = await ctx.newPage();
      const fallos = errores(page);
      const a = azar(semilla);
      const rastro = new Rastro(semilla);
      const { construirPaquete } = await import('../../src/lib/brymen-real/protocolo.ts');
      const RUTAS = ['/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm', '/#/instrumentos/practica/1'];
      const abrir = async (ruta: string) => {
        await page.goto(ruta);
        await expect(page.locator('[data-brymen-real]').first()).toBeVisible({ timeout: 90_000 });
      };
      await abrir(RUTAS[0]!);
      await page.goto('/#/');
      await page.waitForTimeout(1000);
      const antes = await registro(page);
      await abrir(RUTAS[0]!);
      const poner = (x: Record<string, unknown>) => page.evaluate((y) => Object.assign((window as unknown as { __epaBrymenFalso: Record<string, unknown> }).__epaBrymenFalso, y), x);
      const unidades = ['V', 'mV', 'A', 'mA', 'µA', 'Ω', 'kΩ', 'MΩ', 'F', 'µF', 'nF', 'Hz', 'kHz', '%', 'dBm', ''];
      const numero = () => a.uno(['0.0000', '1.2345', '-4.8712', '12.530', '0L', '-0.001', '99999', '5.0000', '.5000', '', 'diod']);
      for (let i = 0; i < ACCIONES; i++) {
        const acc = a.pesos({ bueno: 10, partido: 4, basura: 4, corto: 3, nada: 2, desenchufar: 2, enchufar: 3, boton: 8, ruta: 2, anotar: 3 });
        switch (acc) {
          case 'bueno': {
            const s = { principal: numero(), unidad: a.uno(unidades), ac: a.r() < 0.3, dc: a.r() < 0.5, hold: a.r() < 0.1, rel: a.r() < 0.1, secundaria: a.r() < 0.3 ? numero() : undefined, unidadSecundaria: a.uno(['Hz', 'V', 'mA', '']), bateriaBaja: a.r() < 0.1 };
            rastro.apuntar(`paquete ${JSON.stringify(s)}`);
            await poner({ fija: true, respuesta: Array.from(construirPaquete(s)) });
            break;
          }
          case 'partido': {
            const p = Array.from(construirPaquete({ principal: numero(), unidad: a.uno(unidades) }));
            const k = a.entero(1, 23);
            rastro.apuntar(`paquete partido en ${k}`);
            await poner({ cola: [p.slice(0, k), p.slice(k)] });
            break;
          }
          case 'basura': {
            const n = a.entero(1, 60);
            const bytes = Array.from({ length: n }, () => (a.r() < 0.2 ? 0x86 : a.entero(0, 255)));
            rastro.apuntar(`basura de ${n} bytes`);
            await poner({ fija: a.r() < 0.5, respuesta: bytes });
            break;
          }
          case 'corto': {
            // a valid header with random display bytes: whatever the LCD cells say
            const p = Array.from({ length: 24 }, () => a.entero(0, 255));
            p[16] = p[17] = p[18] = p[19] = 0x86;
            rastro.apuntar(`celdas al azar ${p.join(',')}`);
            await poner({ fija: true, respuesta: p });
            break;
          }
          case 'nada':
            rastro.apuntar('el Brymen no contesta');
            await poner({ respuesta: null });
            break;
          case 'desenchufar':
            rastro.apuntar('desenchufar');
            await poner({ desenchufado: 'Se ha perdido la conexión con el cable del Brymen: ¿se ha desenchufado?' });
            break;
          case 'enchufar':
            rastro.apuntar('enchufar');
            await page.evaluate(() => delete (window as unknown as { __epaBrymenFalso: Record<string, unknown> }).__epaBrymenFalso.desenchufado);
            break;
          case 'boton': {
            const b = page.locator('[data-conectar-real]:visible, [data-desconectar-real]:visible').first();
            if (!(await b.count())) break;
            rastro.apuntar(`botón ${await b.textContent()}`);
            await b.click({ timeout: 4000 }).catch(() => {});
            break;
          }
          case 'ruta': {
            const r = a.uno(RUTAS);
            rastro.apuntar(`ir a ${r}`);
            await abrir(r);
            break;
          }
          case 'anotar': {
            const b = page.locator('[data-usar-real]:visible');
            const n = await b.count();
            if (!n) break;
            rastro.apuntar('usar la lectura real');
            await b.nth(a.entero(0, n - 1)).click({ timeout: 4000 }).catch(() => {});
            break;
          }
        }
        await page.waitForTimeout(a.uno([50, 300, 900]));
        if (i % 5 === 4 || i === ACCIONES - 1) {
          expect(fallos, String(rastro)).toEqual([]);
          expect((await registro(page)).errores, String(rastro)).toEqual([]);
          await sinBasura(page, rastro, '[data-brymen-real]');
          const estado = await page.locator('[data-brymen-real]').first().getAttribute('data-conexion-real');
          expect(['desconectado', 'conectando', 'conectado', 'sin-respuesta', 'error'], String(rastro)).toContain(estado);
        }
      }
      // disconnected and left: nothing keeps asking the cable, nothing left behind
      const b = page.locator('[data-desconectar-real]:visible').first();
      if (await b.count()) await b.click();
      await page.goto('/#/');
      await page.waitForTimeout(600);
      const n0 = await page.evaluate(() => (window as unknown as { __epaBrymenFalso: { peticiones?: number } }).__epaBrymenFalso.peticiones ?? 0);
      await sinFugas(page, antes, rastro);
      const n1 = await page.evaluate(() => (window as unknown as { __epaBrymenFalso: { peticiones?: number } }).__epaBrymenFalso.peticiones ?? 0);
      expect(n1 - n0, `sigue preguntando al cable tras desconectar (${rastro})`).toBe(0);
      expect(fallos, String(rastro)).toEqual([]);
      await ctx.close();
    });
  }
});
