// Cost of the schematic editor's pointer gestures with a large drawing (~80 parts and their wires): JavaScript
// time of each pointermove (handler + Svelte's update), as on the reader's Mac (1280×800, DPR 2, CPU ×4).
//   node tests/editor-rendimiento.mjs [--url http://localhost:4201] [--cpu 4] [--partes 80]
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers  when the browsers live there
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4201');
const CPU = Number(opt('--cpu', '4'));
const PARTES = Number(opt('--partes', '80'));

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(`${BASE}/#/editor`);
await page.waitForFunction(() => !!globalThis.__epaEditor);

// A ladder of RC cells: rows of resistors joined by wires, a capacitor to ground under every joint.
const n = await page.evaluate((N) => {
  const comps = [];
  const cables = [];
  let k = 0;
  let partes = 0;
  for (let f = 0; partes < N; f++) {
    const y = f * 6;
    for (let i = 0; i < 6 && partes < N; i++, partes += 2) {
      const x = i * 4;
      comps.push({ id: `c${++k}`, tipo: 'R', nombre: `R${k}`, x, y, o: 0, campos: { valor: '1k' } });
      cables.push({ id: `w${k}a`, p: [x + 2, y, x + 4, y] });
      comps.push({ id: `c${++k}`, tipo: 'C', nombre: `C${k}`, x: x + 3, y: y + 1, o: 1, campos: { valor: '100n' } });
      cables.push({ id: `w${k}b`, p: [x + 3, y, x + 3, y + 1] });
      comps.push({ id: `c${++k}`, tipo: 'GND', nombre: '', x: x + 3, y: y + 3, o: 0, campos: {} });
    }
  }
  comps.unshift({ id: 'v0', tipo: 'V', nombre: 'V1', x: -3, y: 2, o: 3, campos: { forma: 'dc', dc: '5' } });
  const e = globalThis.__epaEditor;
  e.ed.cargar({ version: 1, titulo: 'Rendimiento', componentes: comps, cables, analisis: e.ed.doc.analisis, directivas: '' });
  return comps.filter((c) => c.tipo !== 'GND').length;
}, PARTES);
await page.waitForTimeout(300);
await page.evaluate(() => globalThis.__epaEditor.ajustar());
await page.waitForTimeout(500);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

async function medir(nombre, preparar) {
  const r = await page.evaluate(async (prep) => {
    const svg = document.querySelector('.lienzo svg');
    const e = globalThis.__epaEditor;
    const ev = (type, x, y, botones, extra = {}) =>
      new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', isPrimary: true, button: type === 'pointermove' ? -1 : 0, buttons: botones, bubbles: true, ...extra });
    const flush = async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    };
    let [x0, y0] = e.pantalla(10, 6);
    let boton = 0;
    if (prep === 'parte' || prep === 'todo') {
      if (prep === 'todo') e.ed.seleccionarTodo();
      [x0, y0] = e.centroDe('R1');
      svg.dispatchEvent(ev('pointerdown', x0, y0, 1));
      boton = 1;
    } else if (prep === 'cable') {
      [x0, y0] = e.pantalla(0, 0);
      svg.dispatchEvent(ev('pointerdown', x0, y0, 1));
      boton = 1;
    } else if (prep === 'desplazar') {
      svg.dispatchEvent(ev('pointerdown', x0, y0, 4, { button: 1 }));
      boton = 4;
    }
    await flush();
    const t = [];
    for (let i = 1; i <= 80; i++) {
      const x = x0 + i * 3.1;
      const y = y0 + i * 1.7;
      const a = performance.now();
      svg.dispatchEvent(ev('pointermove', x, y, boton));
      await flush();
      t.push(performance.now() - a);
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
    if (boton) svg.dispatchEvent(ev('pointerup', x0 + 248, y0 + 136, 0));
    await flush();
    if (prep === 'parte' || prep === 'todo') e.ed.deshacer();
    if (prep === 'cable') e.ed.deshacer();
    e.ed.sel = [];
    t.sort((a, b) => a - b);
    return { mediana: t[40], p95: t[Math.floor(t.length * 0.95)], max: t[t.length - 1] };
  }, preparar);
  console.log(`${nombre.padEnd(34)} mediana ${r.mediana.toFixed(2)} ms   p95 ${r.p95.toFixed(2)} ms   máx ${r.max.toFixed(2)} ms`);
  return r;
}

console.log(`Editor de esquemas: ${n} componentes, CPU ×${CPU}, 1280×800 DPR 2`);
const res = [
  await medir('pasar el puntero', 'nada'),
  await medir('arrastrar un componente', 'parte'),
  await medir('arrastrar toda la selección', 'todo'),
  await medir('dibujar un cable', 'cable'),
  await medir('desplazar la vista', 'desplazar'),
];
await navegador.close();
const peor = Math.max(...res.map((r) => r.p95));
console.log(peor < 16 ? `OK: p95 máximo ${peor.toFixed(2)} ms (< 16 ms)` : `LENTO: p95 máximo ${peor.toFixed(2)} ms`);
process.exit(peor < 16 ? 0 : 1);
