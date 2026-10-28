// 0.10 «Aprender haciendo»: the interactive items of the lessons generated from the book (componentes/practica/,
// libro/practica/*.json written by scripts/practica10.mjs). Each kind answered right and wrong (explanation with
// the book fragment and its link, hint ladder, second attempt), Spanish number formats and tolerance, a problem
// with changing values (two attempts, two sets of values, the worked solution with the variant's numbers), a
// prediction graded against the app's own ngspice run, the breadboard puzzle (a correct fix accepted and a wrong
// one rejected), the end-of-lesson screen (key ideas and the next lesson), touch at 412 and 800 px, the daily
// goal, Repaso's «Practicar» and «Practicar con otros valores» in the exercises.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.preguntas10.config.ts tests/preguntas10.spec.ts
// Screenshots (git-ignored): tests/capturas/preguntas10/.
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { comprobar } from '../src/lib/magnitudes.ts';
import { variante, enunciadoDe, valorTexto } from '../src/componentes/practica/variantes.ts';
import { montajeCompleto } from '../src/componentes/practica/montaje.ts';
import { sentido } from '../src/componentes/practica/circuito.ts';
import type {
  IndicePractica,
  ItemDeslizador,
  ItemNumerico,
  ItemOrdenar,
  ItemParejas,
  ItemPractica,
  ItemPrediccion,
  ItemProtoboard,
  ItemToque,
  PracticaParte,
} from '../src/componentes/practica/tipos.ts';
import type { DatosFigura } from '../src/componentes/figuras-vivas/tipos.ts';

const LIBRO = new URL('../public/libro/', import.meta.url);
const leerJson = <T>(ruta: string): T => JSON.parse(readFileSync(new URL(ruta, LIBRO), 'utf8')) as T;
const CAPTURAS = new URL('./capturas/preguntas10/', import.meta.url).pathname;
mkdirSync(CAPTURAS, { recursive: true });

const partes = new Map<string, PracticaParte>();
const practica = (p: string) => partes.get(p) ?? partes.set(p, leerJson<PracticaParte>(`practica/${p}.json`)).get(p)!;
function item<T extends ItemPractica>(id: string): T {
  const p = id.split('-')[0]!;
  const it = practica(p).items.find((x) => x.id === id);
  if (!it) throw new Error(`no existe ${id}`);
  return it as T;
}
/** Route of an item inside its lesson (practica-N is its 1-based position among the lesson's items). */
function ruta(it: ItemPractica): string {
  const k = practica(it.parte).secciones[it.seccion]!.items.indexOf(it.id);
  if (k < 0) throw new Error(`${it.id} no está en la lección`);
  return `#/leccion/${it.parte}/${it.seccion}/practica-${k + 1}`;
}
async function abrir(page: Page, it: ItemPractica) {
  await page.goto(ruta(it));
  await page.reload();
  await expect(page.locator(`[data-practica="${it.id}"]`)).toBeVisible();
}
function leer<T>(page: Page, clave: string): Promise<T | null> {
  return page.evaluate((k) => {
    const v = localStorage.getItem(`epa:${k}`);
    return v ? JSON.parse(v) : null;
  }, clave);
}
const plano = (h: string) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const sinEspacios = (t: string) => t.replace(/[\s\u00a0\u202f]/g, '');

/** The changed part's value label drawn over the live figure shows `v` (and covers the book's label). */
async function etiquetaMuestra(page: Page, id: string, v: number, unidad: string) {
  const et = page.locator(`[data-practica] [data-etiqueta-nueva="${id}"]`);
  await expect(et).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(async () => sinEspacios((await et.textContent()) ?? '')).toBe(sinEspacios(valorTexto(v, unidad)));
}

/** The explanation of a final answer: verdict, the book's fragment(s) and the link to its place. */
async function explicacion(page: Page, it: ItemPractica, bien: boolean) {
  const fb = page.locator('[data-practica] [data-feedback]');
  await expect(fb).toHaveAttribute('data-feedback', bien ? 'bien' : 'mal');
  await expect(fb.locator('[data-cita]').first()).toContainText(`Del libro · ${it.citas[0]!.donde}`, { ignoreCase: true });
  await expect(fb.locator('[data-cita]').first()).toContainText(plano(it.citas[0]!.html).slice(0, 30));
  const ver = fb.locator('[data-ver-ref]');
  await expect(ver).toHaveText(`Ver ${it.verRef}`);
  await expect(ver).toHaveAttribute('href', new RegExp(`^#/${it.parte}/`));
  await expect(page.locator('[data-continuar]')).toBeEnabled();
}

/** Client point of an SVG-unit point of the tap layer. */
async function puntoCapa(page: Page, x: number, y: number): Promise<[number, number]> {
  return page.locator('[data-capa]').evaluate(
    (svg, [x, y]) => {
      const r = svg.getBoundingClientRect();
      const vb = (svg as SVGSVGElement).viewBox.baseVal;
      return [r.left + ((x - vb.x) / vb.width) * r.width, r.top + ((y - vb.y) / vb.height) * r.height] as [number, number];
    },
    [x, y] as [number, number],
  );
}

/** Centre (SVG units) of a schematic element or of a node's first wire, from the figure data. */
function centroObjetivo(it: ItemToque, k: 'elemento' | 'nodo', id: string): [number, number] {
  const d = leerJson<DatosFigura>(it.figura.datos);
  const esq = d.esquemas![it.figura.esquema]!;
  const A = esq.dibujo_a_svg;
  const af = (p: [number, number]): [number, number] => [A.sx * p[0] + A.tx, A.sy * p[1] + A.ty];
  if (k === 'elemento') {
    const e = esq.elementos.find((x) => x.id === id)!;
    const a = af([e.caja![0], e.caja![1]]);
    const b = af([e.caja![2], e.caja![3]]);
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }
  const t = esq.tramos.find((x) => x.nodo === id)!;
  const a = af(t.puntos[0]!);
  const b = af(t.puntos[t.puntos.length - 1]!);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

// ------------------------------------------------------------------ Node: data and numbers

test('datos: índice, recuentos y respuestas numéricas en formato español con tolerancia', () => {
  const ind = leerJson<IndicePractica>('practica/indice.json');
  expect(ind.partes.length).toBeGreaterThan(40);
  for (const t of ['numerico', 'prediccion', 'deslizador', 'toque', 'ordenar', 'parejas', 'protoboard'] as const) expect(ind.items[t]).toBeGreaterThan(0);
  expect(Object.keys(ind.ejercicios).length).toBeGreaterThan(20);

  // Spanish formats: «4,7 k», «4k7», «0,5 mA», «2,2e-3», thousands with spaces; a wrong prefix is «cerca».
  const e = (valor: number, unidad: string, tol = 0.02) => ({ valor, unidad, tol, texto: '' });
  expect(comprobar('4,7 k', e(4700, 'Ω')).tipo).toBe('bien');
  expect(comprobar('4k7', e(4700, 'Ω')).tipo).toBe('bien');
  expect(comprobar('4.7kΩ', e(4700, 'Ω')).tipo).toBe('bien');
  expect(comprobar('0,5 mA', e(0.0005, 'A')).tipo).toBe('bien');
  expect(comprobar('500 µA', e(0.0005, 'A')).tipo).toBe('bien');
  expect(comprobar('2,2e-3', e(0.0022, 'F')).tipo).toBe('bien');
  expect(comprobar('2 200', e(2200, 'Ω')).tipo).toBe('bien');
  expect(comprobar('4,7', e(4700, 'Ω')).tipo).toBe('cerca');
  expect(comprobar('0,5 V', e(0.0005, 'A')).tipo).toBe('unidad');
  // tolerance: 2 % accepted, 3 % not
  expect(comprobar('1,02 k', e(1000, 'Ω')).tipo).toBe('bien');
  expect(comprobar('1,03 k', e(1000, 'Ω')).tipo).not.toBe('bien');

  // Problems with changing values: deterministic per seed, different on consecutive seeds, realistic values.
  const it = item<ItemNumerico>('cap01-num-ej-1.2');
  const a = variante(it, 0)!;
  const b = variante(it, 1)!;
  expect(variante(it, 0)).toEqual(a);
  expect(JSON.stringify(a.valores)).not.toBe(JSON.stringify(b.valores));
  const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  for (const v of [a, b]) for (const id of Object.keys(it.varia)) expect(E12.some((m) => Math.abs(v.valores[id]! / 10 ** Math.floor(Math.log10(v.valores[id]!)) - m) < 1e-6)).toBe(true);
  expect(enunciadoDe(it, a)).toContain(valorTexto(a.valores['R_1']!, 'Ω'));
  expect(sentido(4, 6, 'V')).toBe('sube');
  expect(sentido(6, 4, 'V')).toBe('baja');
  expect(sentido(4, 4.01, 'V')).toBe('igual');
});

// ------------------------------------------------------------------ each kind, right and wrong

test('problema con valores cambiantes: pistas en escalera, segundo intento, solución con los números de la variante y otra variante', async ({ page }) => {
  const it = item<ItemNumerico>('cap01-num-ej-1.2');
  await abrir(page, it);
  const caja = page.locator('[data-practica]');
  const v0 = variante(it, 0)!;
  await expect(caja.locator('[data-semilla]')).toHaveAttribute('data-semilla', '0');
  await expect(caja.locator('[data-enunciado]')).toContainText(plano(enunciadoDe(it, v0)).slice(0, 40));
  await expect(page.locator('[data-continuar]')).toBeDisabled();

  // Hints before answering: first the book's formula (equation and the paragraph that introduces it), then the set-up.
  await caja.locator('[data-pista]').click();
  await expect(caja.locator('.pista')).toHaveCount(1);
  await expect(caja.locator('.pista').first()).toContainText('La fórmula del libro');
  await expect(caja.locator('.pista').first().locator('img.m')).toHaveCount(1);
  await caja.locator('[data-pista]').click();
  await expect(caja.locator('.pista').nth(1)).toContainText('El planteamiento');
  // the set-up carries this variant's numbers (the calculators write them with their prefix)
  await expect(caja.locator('.pista').nth(1).locator('.mate').last()).toContainText('kΩ');
  await expect(caja.locator('[data-pista]')).toHaveCount(0);

  // An unreadable answer does not spend an attempt; a wrong one does.
  await caja.locator('[data-numero]').fill('abc');
  await caja.locator('[data-numero]').press('Enter');
  await expect(caja).toHaveAttribute('data-intento', '1');
  await caja.locator('[data-numero]').fill('1');
  await caja.locator('[data-numero]').press('Enter');
  await expect(caja.locator('[data-reintento]')).toContainText('otro intento');
  await expect(caja).toHaveAttribute('data-intento', '2');
  await caja.locator('[data-numero]').fill('2');
  await caja.locator('[data-numero]').press('Enter');
  await explicacion(page, it, false);
  // The worked solution with this variant's numbers
  const sol = caja.locator('[data-solucion]');
  await expect(sol.locator('[data-correcto]')).toHaveText(valorTexto(v0.resultado, 'Ω'));
  await expect(sol.locator('.paso.resultado')).toBeVisible();
  await expect(caja.locator('[data-cita]').nth(1)).toContainText('con los valores del libro', { ignoreCase: true });

  // «Otro con otros valores»: new values; answered right in a Spanish format at the first try.
  await caja.locator('[data-otra-vez]').click();
  await expect(caja.locator('[data-semilla]')).toHaveAttribute('data-semilla', '1');
  const v1 = variante(it, 1)!;
  expect(JSON.stringify(v1.valores)).not.toBe(JSON.stringify(v0.valores));
  await expect(caja.locator('[data-numero]')).toBeEnabled();
  const k = v1.resultado / 1000;
  await caja.locator('[data-numero]').fill(`${String(Number(k.toPrecision(4))).replace('.', ',')} k`);
  await caja.locator('[data-comprobar]').click();
  await expect(caja.locator('[data-feedback]')).toHaveAttribute('data-feedback', 'bien');
  await expect(caja.locator('[data-correcto]')).toHaveText(valorTexto(v1.resultado, 'Ω'));
});

test('predice y comprueba: la respuesta se califica con la simulación real del circuito', async ({ page }) => {
  test.setTimeout(180_000);
  const it = item<ItemPrediccion>('cap01-pred-sec-1.4');
  await abrir(page, it);
  const caja = page.locator('[data-practica]');
  await caja.locator('[data-pista]').click();
  await expect(caja.locator('.pista')).toContainText('Lo que dice el libro');
  const real = it.esperado.respuesta;
  const mala = real === 'sube' ? 'baja' : 'sube';
  await caja.locator(`[data-opcion="${mala}"]`).click();
  await expect(caja.locator('[data-simulacion]')).toBeVisible({ timeout: 120_000 });
  await explicacion(page, it, false);
  await expect(caja.locator('.prediccion')).toHaveAttribute('data-real', real);
  // The values shown are those of the app's simulation, and agree with the generator's run (same engine).
  const antes = Number(await caja.locator('[data-fila="antes"] [data-valor]').getAttribute('data-valor'));
  const despues = Number(await caja.locator('[data-fila="despues"] [data-valor]').getAttribute('data-valor'));
  expect(Math.abs(antes - it.esperado.antes)).toBeLessThan(Math.abs(it.esperado.antes) * 1e-3 + 1e-9);
  expect(Math.abs(despues - it.esperado.despues)).toBeLessThan(Math.abs(it.esperado.despues) * 1e-3 + 1e-9);
  expect(sentido(antes, despues, it.observa.unidad)).toBe(real);
  if (it.fuente.k === 'figura') {
    await expect(caja.locator('[data-vivo]')).toBeVisible();
    // the live schematic labels the changed part with its NEW value
    await etiquetaMuestra(page, it.cambio.id, it.a, it.cambio.unidad);
  }
  // Again, right this time
  await caja.locator('[data-otra-vez]').click();
  await caja.locator(`[data-opcion="${real}"]`).click();
  await expect(caja.locator('[data-feedback]')).toHaveAttribute('data-feedback', 'bien', { timeout: 60_000 });
});

test('deslizador hasta un objetivo, comprobado por simulación', async ({ page }) => {
  test.setTimeout(180_000);
  const it = item<ItemDeslizador>('cap01-desl-sec-1.4');
  await abrir(page, it);
  const caja = page.locator('[data-practica]');
  const rango = caja.locator('[data-deslizador]');
  const poner = async (v: number) => {
    const k = it.valores.findIndex((x) => Math.abs(x - v) / v < 1e-6);
    await rango.evaluate((el, k) => {
      (el as HTMLInputElement).value = String(k);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, k);
  };
  // a wrong value: the reading is simulated and the attempt explained
  const malo = it.valores.find((v) => !it.aciertan.includes(v) && Math.abs(v - it.cambio.de) > 1)!;
  await poner(malo);
  await expect(caja.locator('[data-medida]')).not.toHaveText(/simulando/, { timeout: 120_000 });
  // the live schematic's label follows the slider
  await etiquetaMuestra(page, it.cambio.id, malo, it.cambio.unidad);
  await caja.locator('[data-comprobar]').click();
  await expect(caja.locator('[data-reintento]')).toContainText('sale', { timeout: 60_000 });
  await poner(it.aciertan[0]!);
  await expect(caja.locator('[data-medida]')).not.toHaveText(/simulando/, { timeout: 60_000 });
  await caja.locator('[data-comprobar]').click();
  await explicacion(page, it, true);
  const y = Number(await caja.locator('.deslizador').getAttribute('data-lectura'));
  expect(Math.abs(y - it.objetivo)).toBeLessThanOrEqual(Math.abs(it.objetivo) * it.tol);
});

test('todas las predicciones y deslizadores sobre figuras: la etiqueta de la pieza cambiada muestra el valor nuevo', async ({ page }) => {
  test.setTimeout(600_000);
  const todos: (ItemPrediccion | ItemDeslizador)[] = [];
  for (const p of leerJson<IndicePractica>('practica/indice.json').partes)
    for (const x of practica(p).items)
      if ((x.tipo === 'prediccion' || x.tipo === 'deslizador') && x.fuente.k === 'figura' && practica(p).secciones[x.seccion]?.items.includes(x.id)) todos.push(x);
  expect(todos.length).toBeGreaterThan(10);
  for (const it of todos) {
    await abrir(page, it);
    const caja = page.locator('[data-practica]');
    if (it.tipo === 'prediccion') {
      await caja.locator(`[data-opcion="${it.esperado.respuesta}"]`).click();
      await expect(caja.locator('[data-vivo]')).toBeVisible({ timeout: 120_000 });
      await etiquetaMuestra(page, it.cambio.id, it.a, it.cambio.unidad);
    } else {
      const k = it.valores.findIndex((v) => Math.abs(v - it.cambio.de) / it.cambio.de > 0.5);
      await expect(caja.locator('[data-vivo]')).toBeVisible({ timeout: 60_000 });
      await caja.locator('[data-deslizador]').evaluate((el, k) => {
        (el as HTMLInputElement).value = String(k);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, k);
      await etiquetaMuestra(page, it.cambio.id, it.valores[k]!, it.cambio.unidad);
    }
  }
});

test('tocar en el esquema: una pieza y un nodo, mal y bien', async ({ page }) => {
  for (const id of ['cap22-toque-fig-22.16', 'cap05-toque-fig-5.13']) {
    const it = item<ItemToque>(id);
    await abrir(page, it);
    const caja = page.locator('[data-practica]');
    await expect(caja.locator('.toque')).not.toHaveAttribute('data-objetivos', '0');
    // wrong: another part of the drawing
    const d = leerJson<DatosFigura>(it.figura.datos);
    const otro = d.esquemas![it.figura.esquema]!.elementos.find((e) => e.caja && e.id !== it.pide.id && !['WIRE', 'DOT', 'ANOT', 'GND'].includes(e.rol))!;
    let p = await puntoCapa(page, ...centroObjetivo(it, 'elemento', otro.id));
    await page.mouse.click(p[0], p[1]);
    await expect(caja.locator('.toque')).toHaveAttribute('data-elegido', `${it.figura.esquema}:elemento:${otro.id}`);
    await caja.locator('[data-comprobar]').click();
    await expect(caja.locator('[data-reintento]')).toBeVisible();
    // the symbol of the part asked, as the second hint, when it has one
    if (it.pide.simbolo) {
      await caja.locator('[data-pista]').click();
      await expect(caja.locator('.pista').nth(1).locator('.p10-simbolo svg')).toHaveCount(1);
    }
    p = await puntoCapa(page, ...centroObjetivo(it, it.pide.k, it.pide.id));
    await page.mouse.click(p[0], p[1]);
    await expect(caja.locator('.toque')).toHaveAttribute('data-elegido', `${it.figura.esquema}:${it.pide.k}:${it.pide.id}`);
    await caja.locator('[data-comprobar]').click();
    await explicacion(page, it, true);
  }
});

test('ordenar los pasos de un procedimiento del libro', async ({ page }) => {
  const it = item<ItemOrdenar>('cap13-orden-sec-13.3-61');
  await abrir(page, it);
  const caja = page.locator('[data-practica]');
  const n = it.pasos.length;
  // wrong: the last step first
  await caja.locator(`[data-pendiente="${n - 1}"]`).click();
  for (let k = 0; k < n - 1; k++) await caja.locator(`[data-pendiente="${k}"]`).click();
  await caja.locator('[data-comprobar]').click();
  await expect(caja.locator('[data-reintento]')).toContainText(`de ${n} pasos`);
  await expect(caja.locator('.hueco.mal').first()).toBeVisible();
  // second attempt: nothing was right from the start, so everything goes back
  await caja.locator('[data-de-nuevo]').click();
  await expect(caja.locator('.ordenar')).toHaveAttribute('data-orden', '');
  for (let k = 0; k < n; k++) await caja.locator(`[data-pendiente="${k}"]`).click();
  await caja.locator('[data-comprobar]').click();
  await explicacion(page, it, true);
});

test('unir parejas: términos y definiciones del glosario, y símbolos', async ({ page }) => {
  for (const id of ['cap05-parejas-sec-5.1', 'cap45-simbolos-sec-45.3']) {
    const it = item<ItemParejas>(id);
    await abrir(page, it);
    const caja = page.locator('[data-practica]');
    const ders = caja.locator('[data-der]');
    const n = await ders.count();
    const pareja = async (pos: number) => Number(await ders.nth(pos).getAttribute('data-pareja'));
    // wrong: every card gets the next one's partner
    for (let pos = 0; pos < n; pos++) {
      await caja.locator(`[data-izq="${(await pareja((pos + 1) % n))}"]`).click();
      await ders.nth(pos).click();
    }
    await caja.locator('[data-comprobar]').click();
    await expect(caja.locator('[data-reintento]')).toContainText('parejas');
    await caja.locator('[data-de-nuevo]').click();
    for (let pos = 0; pos < n; pos++) {
      await caja.locator(`[data-izq="${await pareja(pos)}"]`).click();
      await ders.nth(pos).click();
    }
    await caja.locator('[data-comprobar]').click();
    await explicacion(page, it, true);
  }
});

test('completa el montaje en la protoboard: un arreglo mal y otro bien (por conectividad)', async ({ page }) => {
  test.setTimeout(180_000);
  for (const id of ['cap01-proto-fig-1.3-0', 'cap01-proto-fig-1.4-0']) {
    const it = item<ItemProtoboard>(id);
    const d = leerJson<DatosFigura>(it.figura.datos);
    const completo = montajeCompleto(d.esquemas![it.figura.esquema]!, it.figura.titulo, it.figura.label);
    await abrir(page, it);
    const caja = page.locator('[data-practica]');
    await expect(caja.locator('[data-mesa]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!(globalThis as { __epaProtoboard?: unknown }).__epaProtoboard)).toBe(true);
    if (it.quitar.k === 'cable') {
      const w = completo.cables[it.quitar.i]!;
      // wrong: a wire inside the strip of one end (it joins nothing new)
      const malo = await page.evaluate(
        ([a]) => {
          const pb = (globalThis as unknown as { __epaProtoboard: { pb: { anadirCable: (a: number[], b: number[]) => unknown; doc: { cables: unknown[] } } } }).__epaProtoboard.pb;
          for (const dy of [1, -1, 2, -2, 3, -3, 4, -4]) if (pb.anadirCable(a!, [a![0]!, a![1]! + dy])) return true;
          return false;
        },
        [w.a],
      );
      expect(malo).toBe(true);
      await caja.locator('[data-comprobar]').click();
      await expect(caja.locator('[data-reintento]')).toContainText('no corresponde al esquema');
      await caja.locator('[data-de-nuevo]').click();
      const bien = await page.evaluate(
        ([a, b]) => !!(globalThis as unknown as { __epaProtoboard: { pb: { anadirCable: (a: number[], b: number[]) => unknown } } }).__epaProtoboard.pb.anadirCable(a!, b!),
        [w.a, w.b],
      );
      expect(bien).toBe(true);
    } else {
      const pz = completo.piezas.find((x) => x.id === (it.quitar as { id: string }).id)!;
      // wrong: the part one column off its place
      await page.evaluate(
        ([id, pos]) => {
          const pb = (globalThis as unknown as { __epaProtoboard: { pb: { cambiar: (f: () => void) => void; pieza: (id: string) => { pos: number[][] } } } }).__epaProtoboard.pb;
          pb.cambiar(() => (pb.pieza(id as string).pos = pos as number[][]));
        },
        [pz.id, pz.pos.map(([x, y]) => [x + 2, y])] as const,
      );
      await caja.locator('[data-comprobar]').click();
      await expect(caja.locator('[data-reintento]')).toContainText('no corresponde al esquema');
      await page.evaluate(
        ([id, pos]) => {
          const pb = (globalThis as unknown as { __epaProtoboard: { pb: { cambiar: (f: () => void) => void; pieza: (id: string) => { pos: number[][] } } } }).__epaProtoboard.pb;
          pb.cambiar(() => (pb.pieza(id as string).pos = pos as number[][]));
        },
        [pz.id, pz.pos] as const,
      );
    }
    await caja.locator('[data-comprobar]').click();
    await explicacion(page, it, true);
  }
});

// ------------------------------------------------------------------ the lesson around them

test('lección con práctica: pantallas intercaladas, objetivo diario, ideas clave y siguiente lección', async ({ page }) => {
  const sec = practica('cap01').secciones['sec-1.4']!;
  const its = sec.items.map((id) => item<ItemPractica>(id));
  await page.goto('#/leccion/cap01/sec-1.4');
  await page.reload();
  const leccion = page.locator('[data-leccion="cap01/sec-1.4"]');
  await expect(leccion).toBeVisible();
  // Walk: steps «Continuar», practice screens «Saltar» except the parejas/ordenar/numeric one answered.
  let practicas = 0;
  for (let guarda = 0; guarda < 40; guarda++) {
    if (await page.locator('[data-resumen]').count()) break;
    if (await page.locator('[data-pregunta]').count()) {
      if (await page.locator('[data-pregunta] [data-numero]').count()) {
        await page.locator('[data-numero]').fill('1');
        await page.locator('[data-numero]').press('Enter');
      } else await page.locator('[data-pregunta] button.opcion').first().click();
      await page.locator('[data-continuar]').click();
      continue;
    }
    if (await page.locator('[data-practica]').count()) {
      practicas++;
      await expect(page).toHaveURL(/practica-\d+$/);
      if (practicas === 1) {
        // the first one answered (wrong twice): it counts for the day as a lesson question
        const antes = Object.values((await leer<Record<string, { preguntas?: number }>>(page, 'progreso-diario')) ?? {}).reduce((s, d) => s + (d.preguntas ?? 0), 0);
        await page.locator('[data-practica] [data-numero]').fill('1');
        await page.locator('[data-practica] [data-numero]').press('Enter');
        await page.locator('[data-practica] [data-numero]').fill('2');
        await page.locator('[data-practica] [data-numero]').press('Enter');
        await expect(page.locator('[data-practica] [data-feedback]')).toBeVisible();
        await expect
          .poll(async () => Object.values((await leer<Record<string, { preguntas?: number }>>(page, 'progreso-diario')) ?? {}).reduce((s, d) => s + (d.preguntas ?? 0), 0))
          .toBe(antes + 1);
        await page.locator('[data-continuar]').click();
      } else await page.locator('[data-saltar]').click();
      continue;
    }
    await page.locator('[data-continuar]').click();
  }
  expect(practicas).toBe(its.length);
  // End screen: the key ideas of the section (from the book) and the next lesson
  const resumen = page.locator('[data-resumen]');
  await expect(resumen).toBeVisible();
  await expect(resumen.locator('[data-ideas]')).toBeVisible();
  await expect(resumen.locator('[data-idea]')).toHaveCount(sec.ideas.length);
  const formula = sec.ideas.find((x) => x.k === 'formula');
  if (formula && formula.k === 'formula') await expect(resumen.locator('[data-idea="formula"]').first()).toContainText(formula.nombre);
  await expect(resumen.locator('[data-siguiente-titulo]')).toContainText('1.5');
  await expect(resumen.locator('[data-cifra-practica]')).toContainText(`de ${its.length}`);
  await page.locator('[data-siguiente-leccion]').click();
  await expect(page).toHaveURL(/#\/leccion\/cap01\/sec-1\.5$/);
});

test('Repaso «Aprender haciendo» y «Practicar con otros valores» en los ejercicios', async ({ page }) => {
  await page.goto('#/repaso');
  const enlace = page.locator('[data-practica-enlace="cap05"]');
  await expect(enlace).toBeVisible();
  await enlace.click();
  await expect(page).toHaveURL(/#\/repaso\/practica\/cap05$/);
  await expect(page.locator('[data-practica-parte="cap05"] [data-practica]')).toBeVisible();
  await page.locator('[data-saltar]').click();
  await expect(page.locator('.cab-pasos .cuenta')).toHaveText(`2/${practica('cap05').items.length}`);

  await page.goto('#/cap05/ej-5.1');
  const boton = page.locator('[data-otros-valores="ej-5.1"] [data-practicar-ej]');
  await expect(boton).toBeVisible();
  await boton.click();
  await expect(page.locator('[data-otros-valores="ej-5.1"] [data-practica]')).toBeVisible();
  await expect(page.locator('[data-otros-valores="ej-5.1"] [data-enunciado]')).toContainText('LED');
});

// ------------------------------------------------------------------ touch at 412 and 800 px, screenshots

const EQUIPOS = [
  { id: 'telefono', w: 412, h: 915 },
  { id: 'tableta', w: 800, h: 1280 },
];

async function contexto(browser: Browser, w: number, h: number, tema: string) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
  return ctx;
}

test('táctil a 412 y 800 px: parejas y orden con toques, sin desbordar, y capturas de cada tipo', async ({ browser }) => {
  test.setTimeout(600_000);
  const muestra: ItemPractica[] = [
    item('cap01-num-ej-1.2'),
    item('cap01-pred-sec-1.4'),
    item('cap01-desl-sec-1.4'),
    item('cap22-toque-fig-22.16'),
    item('cap13-orden-sec-13.3-61'),
    item('cap05-parejas-sec-5.1'),
    item('cap01-proto-fig-1.3-0'),
  ];
  for (const e of EQUIPOS) {
    for (const tema of ['claro', 'oscuro']) {
      const ctx = await contexto(browser, e.w, e.h, tema);
      const page = await ctx.newPage();
      for (const it of muestra) {
        await abrir(page, it);
        await page.waitForTimeout(it.tipo === 'protoboard' || it.tipo === 'deslizador' ? 1500 : 600);
        // never wider than the screen
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await page.screenshot({ path: `${CAPTURAS}${it.tipo}-${e.id}-${tema}.png` });
        // answered by touch where the kind is touch-first
        const caja = page.locator('[data-practica]');
        if (it.tipo === 'parejas') {
          const ders = caja.locator('[data-der]');
          for (let pos = 0; pos < (await ders.count()); pos++) {
            await caja.locator(`[data-izq="${await ders.nth(pos).getAttribute('data-pareja')}"]`).tap();
            await ders.nth(pos).tap();
          }
          await caja.locator('[data-comprobar]').tap();
          await expect(caja.locator('[data-feedback]')).toHaveAttribute('data-feedback', 'bien');
        } else if (it.tipo === 'ordenar') {
          for (let k = 0; k < (it as ItemOrdenar).pasos.length; k++) await caja.locator(`[data-pendiente="${k}"]`).tap();
          await caja.locator('[data-comprobar]').tap();
          await expect(caja.locator('[data-feedback]')).toHaveAttribute('data-feedback', 'bien');
        } else if (it.tipo === 'toque') {
          const t = it as ItemToque;
          const p = await puntoCapa(page, ...centroObjetivo(t, t.pide.k, t.pide.id));
          await page.touchscreen.tap(p[0], p[1]);
          await caja.locator('[data-comprobar]').tap();
          await expect(caja.locator('[data-feedback]')).toHaveAttribute('data-feedback', 'bien');
        } else if (it.tipo === 'numerico') {
          await caja.locator('[data-numero]').fill('1');
          await caja.locator('[data-numero]').press('Enter');
          await caja.locator('[data-numero]').fill('1');
          await caja.locator('[data-numero]').press('Enter');
          await expect(caja.locator('[data-feedback]')).toBeVisible();
        } else if (it.tipo === 'prediccion') {
          await caja.locator(`[data-opcion="${(it as ItemPrediccion).esperado.respuesta}"]`).tap();
          await expect(caja.locator('[data-feedback]')).toBeVisible({ timeout: 120_000 });
          await page.waitForTimeout(1200);
        } else continue;
        await caja.locator('[data-feedback]').scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await page.screenshot({ path: `${CAPTURAS}${it.tipo}-final-${e.id}-${tema}.png` });
      }
      // the end screen
      await page.goto('#/leccion/cap01/sec-1.4/fin');
      await page.reload();
      await expect(page.locator('[data-resumen] [data-ideas]')).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${CAPTURAS}fin-${e.id}-${tema}.png`, fullPage: true });
      await ctx.close();
    }
  }
});
