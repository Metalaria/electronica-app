// Answering the lessons' practice items («Aprender haciendo») and Repaso questions from the data, right and
// wrong, for the functional sweep of barridos.spec.ts (same DOM contract as tests/preguntas10.spec.ts:
// data-practica, data-numero, data-opcion, data-deslizador, data-capa, data-pendiente, data-izq/data-der,
// data-comprobar, data-reintento, data-de-nuevo, data-otra-vez, data-feedback).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { valorTexto } from '../../src/componentes/practica/variantes.ts';
import { montajeCompleto } from '../../src/componentes/practica/montaje.ts';
import type { ItemDeslizador, ItemNumerico, ItemOrdenar, ItemPractica, ItemPrediccion, ItemProtoboard, ItemToque, PracticaParte } from '../../src/componentes/practica/tipos.ts';
import type { DatosFigura } from '../../src/componentes/figuras-vivas/tipos.ts';

const LIBRO = new URL('../../public/libro/', import.meta.url);
const leerJson = <T>(ruta: string): T => JSON.parse(readFileSync(new URL(ruta, LIBRO), 'utf8')) as T;

const practicas = new Map<string, PracticaParte>();
export function itemPractica(id: string, parte: string): ItemPractica | null {
  const p = practicas.get(parte) ?? practicas.set(parte, leerJson<PracticaParte>(`practica/${parte}.json`)).get(parte)!;
  return p.items.find((x) => x.id === id) ?? null;
}

const SIM = 120_000;

/** Waits for the final verdict of the item on screen; returns it ('bien' | 'mal') or the problem. */
async function veredicto(page: Page, ms = 60_000): Promise<string> {
  const fb = page.locator('[data-practica] [data-feedback]');
  await fb.first().waitFor({ timeout: ms });
  return (await fb.first().getAttribute('data-feedback')) ?? '?';
}

/** Client point of an SVG-unit point of the tap layer. */
function puntoCapa(page: Page, x: number, y: number): Promise<[number, number]> {
  return page.locator('[data-practica] [data-capa]').first().evaluate(
    (svg, [x, y]) => {
      const r = svg.getBoundingClientRect();
      const vb = (svg as SVGSVGElement).viewBox.baseVal;
      return [r.left + ((x - vb.x) / vb.width) * r.width, r.top + ((y - vb.y) / vb.height) * r.height] as [number, number];
    },
    [x, y] as [number, number],
  );
}

function centroObjetivo(it: ItemToque, k: 'elemento' | 'nodo', id: string): [number, number] | null {
  const d = leerJson<DatosFigura>(it.figura.datos);
  const esq = d.esquemas?.[it.figura.esquema];
  if (!esq) return null;
  const A = esq.dibujo_a_svg;
  const af = (p: [number, number]): [number, number] => [A.sx * p[0] + A.tx, A.sy * p[1] + A.ty];
  if (k === 'elemento') {
    const e = esq.elementos.find((x) => x.id === id);
    if (!e?.caja) return null;
    const a = af([e.caja[0], e.caja[1]]);
    const b = af([e.caja[2], e.caja[3]]);
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }
  const t = esq.tramos.find((x) => x.nodo === id);
  if (!t) return null;
  const a = af(t.puntos[0]!);
  const b = af(t.puntos[t.puntos.length - 1]!);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * Answers the item on screen wrong first and then right (second attempt, or «otra vez» for the kinds with a
 * single attempt). Returns the problems found ([] when it behaved as the data say).
 */
export async function contestarPractica(page: Page, it: ItemPractica): Promise<string[]> {
  const caja = page.locator(`[data-practica="${it.id}"]`);
  await caja.waitFor({ timeout: 60_000 });
  const fallos: string[] = [];
  const espera = (sel: string, ms = 30_000) => caja.locator(sel).first().waitFor({ timeout: ms });
  switch (it.tipo) {
    case 'numerico': {
      const x = it as ItemNumerico;
      const res = Number(await caja.locator('[data-resultado]').first().getAttribute('data-resultado'));
      const unidad = x.formula.vars.find((v) => v.id === x.objetivo)?.unidad ?? '';
      if (!Number.isFinite(res)) fallos.push('sin data-resultado: no se puede saber la respuesta de la variante');
      await caja.locator('[data-numero]').fill(Math.abs(res) > 1 ? '98765' : '-98765');
      await caja.locator('[data-numero]').press('Enter');
      await espera('[data-reintento]');
      await caja.locator('[data-numero]').fill(valorTexto(res, unidad));
      await caja.locator('[data-numero]').press('Enter');
      const v = await veredicto(page);
      if (v !== 'bien') fallos.push(`la respuesta correcta «${valorTexto(res, unidad)}» se califica «${v}»`);
      break;
    }
    case 'prediccion': {
      const x = it as ItemPrediccion;
      const real = x.esperado.respuesta;
      const mala = real === 'sube' ? 'baja' : 'sube';
      await caja.locator(`[data-opcion="${mala}"]`).click();
      const v1 = await veredicto(page, SIM);
      if (v1 !== 'mal') fallos.push(`la respuesta equivocada «${mala}» se califica «${v1}»`);
      await caja.locator('[data-otra-vez]').click();
      await caja.locator(`[data-opcion="${real}"]`).click();
      await page.waitForFunction((id) => document.querySelector(`[data-practica="${id}"] [data-feedback]`)?.getAttribute('data-feedback') === 'bien' || !!document.querySelector(`[data-practica="${id}"] [data-feedback="mal"]`), x.id, { timeout: SIM });
      const v2 = await veredicto(page, SIM);
      if (v2 !== 'bien') fallos.push(`la respuesta correcta «${real}» se califica «${v2}»`);
      break;
    }
    case 'deslizador': {
      const x = it as ItemDeslizador;
      const rango = caja.locator('[data-deslizador]');
      const poner = async (v: number) => {
        const k = x.valores.findIndex((y) => Math.abs(y - v) / (Math.abs(v) || 1) < 1e-6);
        await rango.evaluate((el, k) => {
          (el as HTMLInputElement).value = String(k);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, k);
        await page.waitForFunction((id) => !/simulando/i.test(document.querySelector(`[data-practica="${id}"] [data-medida]`)?.textContent ?? ''), x.id, { timeout: SIM });
      };
      const malo = x.valores.find((v) => !x.aciertan.includes(v) && Math.abs(v - x.cambio.de) > 1e-9);
      if (malo !== undefined) {
        await poner(malo);
        await caja.locator('[data-comprobar]').click();
        await espera('[data-reintento]', SIM);
      }
      await poner(x.aciertan[0]!);
      await caja.locator('[data-comprobar]').click();
      const v = await veredicto(page, SIM);
      if (v !== 'bien') fallos.push(`el valor correcto ${x.aciertan[0]} se califica «${v}»`);
      break;
    }
    case 'toque': {
      const x = it as ItemToque;
      await page.waitForFunction((id) => document.querySelector(`[data-practica="${id}"] .toque`)?.getAttribute('data-objetivos') !== '0', x.id, { timeout: 30_000 });
      const d = leerJson<DatosFigura>(x.figura.datos);
      const otro = d.esquemas?.[x.figura.esquema]?.elementos.find((e) => e.caja && e.id !== x.pide.id && !['WIRE', 'DOT', 'ANOT', 'GND'].includes(e.rol));
      if (otro) {
        const c = centroObjetivo(x, 'elemento', otro.id);
        if (c) {
          const p = await puntoCapa(page, ...c);
          await page.mouse.click(p[0], p[1]);
          await caja.locator('[data-comprobar]').click();
          await espera('[data-reintento]');
        }
      }
      const c = centroObjetivo(x, x.pide.k, x.pide.id);
      if (!c) {
        fallos.push(`el objetivo ${x.pide.k} ${x.pide.id} no está en los datos de la figura`);
        break;
      }
      const p = await puntoCapa(page, ...c);
      await page.mouse.click(p[0], p[1]);
      await caja.locator('[data-comprobar]').click();
      const v = await veredicto(page);
      if (v !== 'bien') fallos.push(`tocar ${x.pide.nombre} se califica «${v}»`);
      break;
    }
    case 'ordenar': {
      const x = it as ItemOrdenar;
      const n = x.pasos.length;
      await caja.locator(`[data-pendiente="${n - 1}"]`).click();
      for (let k = 0; k < n - 1; k++) await caja.locator(`[data-pendiente="${k}"]`).click();
      await caja.locator('[data-comprobar]').click();
      await espera('[data-reintento]');
      await caja.locator('[data-de-nuevo]').click();
      for (let k = 0; k < n; k++) await caja.locator(`[data-pendiente="${k}"]`).click();
      await caja.locator('[data-comprobar]').click();
      const v = await veredicto(page);
      if (v !== 'bien') fallos.push(`el orden del libro se califica «${v}»`);
      break;
    }
    case 'parejas': {
      const ders = caja.locator('[data-der]');
      const n = await ders.count();
      const pareja = async (pos: number) => Number(await ders.nth(pos).getAttribute('data-pareja'));
      if (n > 1) {
        for (let pos = 0; pos < n; pos++) {
          await caja.locator(`[data-izq="${await pareja((pos + 1) % n)}"]`).click();
          await ders.nth(pos).click();
        }
        await caja.locator('[data-comprobar]').click();
        await espera('[data-reintento]');
        await caja.locator('[data-de-nuevo]').click();
      }
      for (let pos = 0; pos < n; pos++) {
        await caja.locator(`[data-izq="${await pareja(pos)}"]`).click();
        await ders.nth(pos).click();
      }
      await caja.locator('[data-comprobar]').click();
      const v = await veredicto(page);
      if (v !== 'bien') fallos.push(`las parejas del libro se califican «${v}»`);
      break;
    }
    case 'protoboard': {
      const x = it as ItemProtoboard;
      const d = leerJson<DatosFigura>(x.figura.datos);
      const completo = montajeCompleto(d.esquemas![x.figura.esquema]!, x.figura.titulo, x.figura.label);
      await espera('[data-mesa]');
      await page.waitForFunction(() => !!(globalThis as { __epaProtoboard?: unknown }).__epaProtoboard, null, { timeout: 30_000 });
      type Pb = { pb: { anadirCable: (a: number[], b: number[]) => unknown; cambiar: (f: () => void) => void; pieza: (id: string) => { pos: number[][] } } };
      if (x.quitar.k === 'cable') {
        const w = completo.cables[x.quitar.i]!;
        const malo = await page.evaluate(([a]) => {
          const pb = (globalThis as unknown as { __epaProtoboard: Pb }).__epaProtoboard.pb;
          for (const dy of [1, -1, 2, -2, 3, -3, 4, -4]) if (pb.anadirCable(a!, [a![0]!, a![1]! + dy])) return true;
          return false;
        }, [w.a]);
        if (malo) {
          await caja.locator('[data-comprobar]').click();
          await espera('[data-reintento]');
          await caja.locator('[data-de-nuevo]').click();
        }
        await page.evaluate(([a, b]) => (globalThis as unknown as { __epaProtoboard: Pb }).__epaProtoboard.pb.anadirCable(a!, b!), [w.a, w.b]);
      } else {
        const q = x.quitar;
        const pz = completo.piezas.find((y) => y.id === q.id);
        if (!pz) {
          fallos.push(`la pieza ${q.id} no está en el montaje completo`);
          break;
        }
        const mover = (pos: number[][]) =>
          page.evaluate(([id, pos]) => {
            const pb = (globalThis as unknown as { __epaProtoboard: Pb }).__epaProtoboard.pb;
            pb.cambiar(() => (pb.pieza(id as string).pos = pos as number[][]));
          }, [pz.id, pos] as const);
        await mover(pz.pos.map(([a, b]) => [a + 2, b]));
        await caja.locator('[data-comprobar]').click();
        // two holes along: usually another strip, but not when the piece goes from a rail to a hole nothing else
        // uses (an open terminal: fig. 22.8, the I²C pull-ups) — the same circuit, and the app rightly says so
        await espera('[data-reintento], [data-feedback="bien"]');
        if (await caja.locator('[data-feedback="bien"]').count()) break;
        await mover(pz.pos);
      }
      await caja.locator('[data-comprobar]').click();
      const v = await veredicto(page);
      if (v !== 'bien') fallos.push(`el montaje completo se califica «${v}»`);
      break;
    }
  }
  return fallos;
}

/** A Repaso question on screen ([data-pregunta]): answered right or wrong from its data. */
export async function contestarPregunta(page: Page, preguntas: Map<string, { tipo: string; opciones?: string[]; correcta?: number; valor_texto?: string }>, bien: boolean): Promise<string[]> {
  const caja = page.locator('[data-pregunta]').first();
  await caja.waitFor({ timeout: 30_000 });
  const id = (await caja.getAttribute('data-pregunta')) ?? '';
  const p = preguntas.get(id);
  if (!p) return [`pregunta ${id} desconocida`];
  const plano = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  if (p.tipo === 'opcion') {
    const correcta = plano(p.opciones![p.correcta!]!);
    const botones = caja.locator('button.opcion');
    const n = await botones.count();
    let pulsado = false;
    for (let k = 0; k < n; k++) {
      const txt = ((await botones.nth(k).locator('.txt').textContent()) ?? '').replace(/\s+/g, ' ').trim();
      if ((txt === correcta) === bien) {
        await botones.nth(k).click();
        pulsado = true;
        break;
      }
    }
    if (!pulsado) return [`pregunta ${id}: no aparece la opción ${bien ? 'correcta' : 'equivocada'} («${correcta.slice(0, 40)}»)`];
  } else {
    await caja.locator('[data-numero]').fill(bien ? p.valor_texto! : '98765');
    await caja.locator('[data-numero]').press('Enter');
  }
  const fb = caja.locator('[data-feedback]');
  await fb.waitFor({ timeout: 15_000 });
  const v = await fb.getAttribute('data-feedback');
  return v === (bien ? 'bien' : 'mal') ? [] : [`pregunta ${id}: la respuesta ${bien ? 'correcta' : 'equivocada'} se califica «${v}»`];
}
