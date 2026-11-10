// Interaction monkey («gremlins»), seeded and reproducible: on each interactive page, N random but valid
// actions — taps on controls and on the drawing, drags, pinches, typing in fields, sliders, selects, scrolling,
// back/forward, rotating the device (portrait ↔ landscape) and Escape. Every uncaught error, console error,
// failed request or crash is recorded with the seed and the last steps; the page checks run again at the end.
//   reproduce one:  QA_SEMILLA=<semilla> QA_FILTRO='<id de la página>' npx playwright test -c playwright.qa.config.ts tests/qa/monos.spec.ts --project=<perfil>
import { test, type CDPSession, type Page } from '@playwright/test';
import { Registro, esperarCalma, prepararPagina, recogerYComprobar } from './arnes.ts';
import { MODO } from './perfiles.ts';
import { azarDe } from './rutas.ts';

/** Interactive pages (route ids for QA_FILTRO, hashes). */
const PAGINAS: [string, string][] = [
  ['inicio', '#/'],
  ['lector', '#/cap05/sec-5.3'],
  ['glosario', '#/glosario'],
  ['simulador-led', '#/simulador/cap05/sec-5.3_led_150ohm'],
  ['simulador-filtro', '#/simulador/cap42/fig-42.5_filtro_rc'],
  ['simulador-nuevo', '#/simulador/nuevo'],
  ['editor', '#/editor/libro/cap42/fig-42.3_op_emisor_comun'],
  ['protoboard', '#/protoboard'],
  ['instrumentos-practica', '#/instrumentos/practica/1'],
  ['instrumentos-libre', '#/instrumentos/libre'],
  ['fm7303-senal', '#/fm7303/senal'],
  ['fm7303-averias', '#/fm7303/averias'],
  ['consola-nes-3d', '#/consolas/nes/placa3d'],
  ['consola-snes-arquitectura', '#/consolas/snes/arquitectura'],
  ['consola-gb-fotograma', '#/consolas/gb/fotograma'],
  ['consola-megadrive-esquema', '#/consolas/megadrive/esquema'],
  ['proyecto-sdr-3d', '#/proyectos/sdr/3d'],
  ['proyecto-fuente-2d', '#/proyectos/fuente_laboratorio/placa'],
  ['componente-led', '#/componentes/led'],
  ['componente-3d', '#/componentes/3d/resistencia-axial'],
  ['concepto-fasores', '#/conceptos/fasores'],
  ['concepto-fourier', '#/conceptos/fourier'],
  ['calculadora', '#/calculadoras'],
  ['ejercicios', '#/ejercicios'],
  ['repaso-tarjetas', '#/repaso/tarjetas'],
  ['repaso-test', '#/repaso/test/cap05'],
  ['leccion', '#/leccion/cap01/sec-1.4/clasica'], // 1.1: the 1.0 lesson (1.4 has a hand-authored one)
  ['sincronizacion', '#/sincronizacion'],
  // 0.11 group B: the learning loop
  ['practicar', '#/practicar'],
  ['problema', '#/problema'],
  ['dominio', '#/progreso/dominio'],
  ['leccion-explora', '#/leccion/cap22/sec-22.1'],
  ['calculadora-formula', '#/calculadoras/deslizamiento'],
  // 0.12: the backup card (its file picker and «Exportar copia»), the editor's «Nuevo» over a drawing (the in-app
  // confirmation) and the progress page with the day summed across devices
  ['copia', '#/sincronizacion/copia'],
  ['editor-nuevo', '#/editor/libro/cap05/sec-5.3_led_150ohm'],
  ['progreso', '#/progreso'],
];

/** mulberry32: small seeded PRNG. */
function generador(semilla: number) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { r, entero: (n: number) => Math.floor(r() * n), de: <T>(xs: T[]): T => xs[Math.floor(r() * xs.length)]! };
}

const TEXTOS = ['4,7k', '1000', '-3', 'abc', '', '1e9', '0', '2,2 µF', '330', '0,5 mA', '99999999', 'R1 a b 1k'];

interface Objetivo {
  x: number;
  y: number;
  w: number;
  h: number;
  d: string;
  tipo: string;
}

/** Visible controls inside the viewport (no external links, no downloads, nothing that leaves the app). */
function objetivos(page: Page): Promise<Objetivo[]> {
  return page.evaluate(() => {
    const W = innerWidth;
    const H = innerHeight;
    const r: Objetivo[] = [];
    const sel = 'a[href], button, input, select, textarea, summary, [role="button"], [role="tab"], [role="slider"], [tabindex="0"], canvas, svg[viewBox]';
    for (const el of document.querySelectorAll(sel)) {
      const rc = el.getBoundingClientRect();
      if (rc.width < 4 || rc.height < 4 || rc.bottom < 0 || rc.top > H || rc.right < 0 || rc.left > W) continue;
      if ((el as HTMLButtonElement).disabled) continue;
      const href = el.getAttribute('href') ?? '';
      if (/^(https?:|mailto:)/.test(href) || el.hasAttribute('download')) continue;
      const t = ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
      // the performance diagnostic runs for minutes; synchronisation talks to GitHub
      if (/^Empezar|Sincronizar ahora|Comprobar ahora|Descargar/.test(t)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
      const tag = el.tagName.toLowerCase();
      const tipo = tag === 'input' ? `input:${(el as HTMLInputElement).type}` : tag;
      const x = Math.max(rc.left, 0);
      const y = Math.max(rc.top, 0);
      r.push({ x, y, w: Math.min(rc.right, W) - x, h: Math.min(rc.bottom, H) - y, d: `${tipo}${t ? ` «${t.slice(0, 30)}»` : ''}`, tipo });
    }
    return r;
  }) as Promise<Objetivo[]>;
}

async function toque(cdp: CDPSession, tipo: 'touchStart' | 'touchMove' | 'touchEnd', puntos: { x: number; y: number }[]) {
  await cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: puntos.map((p, id) => ({ x: Math.round(p.x), y: Math.round(p.y), id })) });
}

for (const [id, hash] of PAGINAS) {
  test(`mono · ${id}`, async ({ page }, info) => {
    const reg = new Registro(info);
    test.skip(reg.perfil.id === 'escritorio' && MODO === 'rapido', 'en modo rápido, solo los perfiles táctiles');
    if (process.env.QA_FILTRO && !new RegExp(process.env.QA_FILTRO).test(id)) test.skip();
    const pasos = Number(process.env.QA_PASOS ?? (MODO === 'rapido' ? 15 : 40));
    const base = Number(process.env.QA_SEMILLA ?? 20261030);
    const semilla = (base + Math.floor(azarDe(`${reg.perfil.id}:${id}`) * 1e6)) >>> 0;
    test.setTimeout(pasos * 30_000 + 120_000);
    await prepararPagina(page, reg);
    reg.ruta = `mono:${id}`;
    reg.semilla = semilla;
    reg.pasos = [];
    const az = generador(semilla);
    await page.goto(`/${hash}`);
    await esperarCalma(page, 20_000);
    const cdp = reg.perfil.tactil ? await page.context().newCDPSession(page) : null;
    let tamano = page.viewportSize()!;
    const anotarPaso = (p: string) => reg.pasos!.push(`${reg.pasos!.length + 1}. ${p}`);

    for (let n = 0; n < pasos; n++) {
      if (page.isClosed()) break;
      // stay inside the app: back/forward may leave it
      if (!page.url().startsWith(info.project.use.baseURL ?? 'http://localhost')) {
        anotarPaso(`volver a ${hash} (había salido de la aplicación)`);
        await page.goto(`/${hash}`).catch(() => {});
      }
      const obj = await objetivos(page).catch(() => [] as Objetivo[]);
      const tirada = az.r();
      try {
        if (tirada < 0.4 && obj.length) {
          const o = az.de(obj.filter((x) => x.tipo !== 'canvas' && x.tipo !== 'svg').concat(obj.length ? [] : []));
          if (!o) continue;
          const x = o.x + o.w / 2;
          const y = o.y + o.h / 2;
          anotarPaso(`tocar ${o.d} en (${Math.round(x)}, ${Math.round(y)})`);
          if (reg.perfil.tactil) await page.touchscreen.tap(x, y);
          else await page.mouse.click(x, y);
        } else if (tirada < 0.5) {
          const x = az.r() * tamano.width;
          const y = az.r() * tamano.height;
          anotarPaso(`tocar el punto (${Math.round(x)}, ${Math.round(y)})`);
          if (reg.perfil.tactil) await page.touchscreen.tap(x, y);
          else await page.mouse.click(x, y);
        } else if (tirada < 0.62) {
          const zonas = obj.filter((x) => x.tipo === 'canvas' || x.tipo === 'svg');
          const o = zonas.length ? az.de(zonas) : { x: 0, y: 0, w: tamano.width, h: tamano.height, d: 'la pantalla' };
          const a = { x: o.x + az.r() * o.w, y: o.y + az.r() * o.h };
          const b = { x: a.x + (az.r() - 0.5) * 300, y: a.y + (az.r() - 0.5) * 300 };
          anotarPaso(`arrastrar en ${o.d} de (${Math.round(a.x)}, ${Math.round(a.y)}) a (${Math.round(b.x)}, ${Math.round(b.y)})`);
          if (cdp) {
            await toque(cdp, 'touchStart', [a]);
            for (let k = 1; k <= 6; k++) await toque(cdp, 'touchMove', [{ x: a.x + ((b.x - a.x) * k) / 6, y: a.y + ((b.y - a.y) * k) / 6 }]);
            await toque(cdp, 'touchEnd', []);
          } else {
            await page.mouse.move(a.x, a.y);
            await page.mouse.down();
            await page.mouse.move(b.x, b.y, { steps: 6 });
            await page.mouse.up();
          }
        } else if (tirada < 0.68 && cdp) {
          const zonas = obj.filter((x) => x.tipo === 'canvas' || x.tipo === 'svg');
          const o = zonas.length ? az.de(zonas) : { x: 0, y: 0, w: tamano.width, h: tamano.height, d: 'la pantalla' };
          const c = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
          const abrir = az.r() < 0.5;
          const [d0, d1] = abrir ? [30, 140] : [140, 30];
          anotarPaso(`pellizcar (${abrir ? 'ampliar' : 'reducir'}) en ${o.d}`);
          await toque(cdp, 'touchStart', [{ x: c.x - d0, y: c.y }, { x: c.x + d0, y: c.y }]);
          for (let k = 1; k <= 6; k++) {
            const d = d0 + ((d1 - d0) * k) / 6;
            await toque(cdp, 'touchMove', [{ x: c.x - d, y: c.y }, { x: c.x + d, y: c.y }]);
          }
          await toque(cdp, 'touchEnd', []);
        } else if (tirada < 0.78) {
          const campos = obj.filter((x) => /^input:(text|number|search|)$/.test(x.tipo) || x.tipo === 'textarea' || x.tipo === 'input:tel');
          if (!campos.length) continue;
          const o = az.de(campos);
          const t = az.de(TEXTOS);
          anotarPaso(`escribir «${t}» en ${o.d}`);
          await page.mouse.click(o.x + o.w / 2, o.y + o.h / 2);
          await page.keyboard.press('Control+a');
          await page.keyboard.type(t, { delay: 5 });
          if (az.r() < 0.5) await page.keyboard.press('Enter');
        } else if (tirada < 0.85) {
          const rangos = obj.filter((x) => x.tipo === 'input:range' || x.tipo === 'select');
          if (!rangos.length) continue;
          const o = az.de(rangos);
          const tecla = az.de(['ArrowRight', 'ArrowLeft', 'End', 'Home', 'ArrowDown', 'ArrowUp']);
          const veces = 1 + az.entero(5);
          anotarPaso(`${o.tipo === 'select' ? 'elegir en' : 'mover'} ${o.d} con ${tecla} ×${veces}`);
          await page.mouse.click(o.x + o.w / 2, o.y + o.h / 2);
          if (o.tipo === 'select') await page.keyboard.press('Escape');
          for (let k = 0; k < veces; k++) await page.keyboard.press(tecla);
        } else if (tirada < 0.9) {
          const dy = (az.r() - 0.3) * 1500;
          anotarPaso(`desplazar ${Math.round(dy)} px`);
          await page.mouse.wheel(0, dy);
        } else if (tirada < 0.95) {
          const atras = az.r() < 0.7;
          anotarPaso(atras ? 'Atrás' : 'Adelante');
          if (atras) await page.goBack({ timeout: 5000 }).catch(() => {});
          else await page.goForward({ timeout: 5000 }).catch(() => {});
        } else if (tirada < 0.98) {
          tamano = { width: tamano.height, height: tamano.width };
          anotarPaso(`girar a ${tamano.width}×${tamano.height}`);
          await page.setViewportSize(tamano);
        } else {
          anotarPaso('Escape');
          await page.keyboard.press('Escape');
        }
      } catch (e) {
        // an action that could not be done (the target moved away) is not a bug of the app
        reg.pasos!.push(`   (no se pudo: ${String(e).split('\n')[0]!.slice(0, 80)})`);
      }
      await page.waitForTimeout(250 + az.entero(300));
    }
    if (!page.isClosed()) {
      // what the monkey's own taps make appear and go is not a flash of the app: only the last quiet moment counts
      await page.evaluate(() => (window as unknown as { __qa?: { marcar: () => void } }).__qa?.marcar()).catch(() => {});
      await esperarCalma(page, 10_000);
      await recogerYComprobar(page, reg, { tactil: reg.perfil.tactil, completa: false, accesibilidad: false });
    }
    reg.cobertura({ 'mono: páginas': 1, 'mono: pasos': reg.pasos.length });
  });
}
