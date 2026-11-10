// Fix 11c (independent review 11c, minor points) in Node: the origin's corner of the lessons' graphs, their tick
// labels at a phone's width, the lab's hints for a reading without its prefix or with the sign changed, the crossings
// of lab 5 converted with the time base the «Hágalo por mí» applies, the editor's label of a three-phase source and
// the state of a card answered in an earlier visit. The browser side is revision11c-navegador.spec.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { anchoEtiqueta, bajaY, baseX, etiquetaMarca, geometriaGrafica, tamMarca, TAM_MARCA } from '../src/lib/leccion11/ejes.ts';
import { estadoRespondido, eventoDeComprobacion, botonPrincipal } from '../src/lib/leccion11/motor.ts';
import type { Leccion11, Tarjeta } from '../src/lib/leccion11/tipos.ts';
import { evaluarPaso, type PasoLab } from '../src/componentes/instrumentos/practicas/laboratorio';
import { LABORATORIOS, cruce, cruceS } from '../src/componentes/instrumentos/practicas/laboratorios';
import type { Banco } from '../src/componentes/instrumentos/banco.svelte';
import { rotuloAc } from '../src/componentes/editor/catalogo.ts';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libro = path.join(web, 'public', 'libro');

type EjeP = { min: number; max: number; unidad: string; escala?: 'log' };

/** Every published graph of the 1.1 lessons. */
function graficas(): { id: string; x: EjeP; y: EjeP }[] {
  const out: { id: string; x: EjeP; y: EjeP }[] = [];
  const dir = path.join(libro, 'lecciones11');
  for (const p of fs.readdirSync(dir).filter((x) => fs.statSync(path.join(dir, x)).isDirectory()))
    for (const f of fs.readdirSync(path.join(dir, p)).filter((x) => x.endsWith('.json'))) {
      const l = JSON.parse(fs.readFileSync(path.join(dir, p, f), 'utf8')) as Leccion11;
      for (const t of l.tarjetas) {
        const w = (t as { widget?: { tipo: string; x?: EjeP; y?: EjeP; grafica?: { x: EjeP; y: EjeP } } }).widget;
        const gr = w?.tipo === 'grafica' ? (w as { x: EjeP; y: EjeP }) : w?.grafica;
        if (gr) out.push({ id: `${l.id} ${t.id}`, x: gr.x, y: gr.y });
      }
    }
  return out;
}

/**
 * The boxes of the drawn tick labels as GraficaLeccion draws them, in viewBox units, with the font's real height
 * (Inter: ascent 0,97 em, descent 0,24 em): a y label right of its anchor at izq − 6, an x label by its anchor.
 */
function cajas(g: ReturnType<typeof geometriaGrafica>) {
  const t = g.tam;
  const alto = (base: number) => [base - 0.97 * t, base + 0.24 * t] as const;
  const ys = g.etqY.filter((e) => e.visible).map((e) => {
    const w = anchoEtiqueta(e.texto, t);
    const [a, b] = alto(g.sy(e.v) + bajaY(t));
    return { s: e.texto, x0: g.M.izq - 6 - w, x1: g.M.izq - 6, y0: a, y1: b };
  });
  const xs = g.etqX.filter((e) => e.visible).map((e) => {
    const p = g.sx(e.v);
    const w = anchoEtiqueta(e.texto, t);
    const [x0, x1] = e.ancla === 'start' ? [p, p + w] : e.ancla === 'end' ? [p - w, p] : [p - w / 2, p + w / 2];
    const [a, b] = alto(g.H - g.M.aba + baseX(t));
    return { s: e.texto, x0, x1, y0: a, y1: b };
  });
  return { xs, ys };
}

test('gráficas: en la esquina del origen la primera etiqueta de x no pisa la más baja de y (12 px y a 360 px)', () => {
  const malas: string[] = [];
  for (const gr of graficas())
    for (const tam of [TAM_MARCA, tamMarca(296)]) {
      const g = geometriaGrafica(gr.x, gr.y, tam);
      const { xs, ys } = cajas(g);
      for (const a of xs)
        for (const b of ys)
          if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1) malas.push(`${gr.id} (${tam} px): «${a.s}» × «${b.s}»`);
      // nor the x labels one another, nor out of the drawing; the axis's name stays under them
      const sx = [...xs].sort((a, b) => a.x0 - b.x0);
      for (let k = 1; k < sx.length; k++) if (sx[k]!.x0 < sx[k - 1]!.x1) malas.push(`${gr.id} (${tam} px): x «${sx[k - 1]!.s}» × «${sx[k]!.s}»`);
      for (const a of xs) if (a.x0 < 0 || a.x1 > g.W) malas.push(`${gr.id} (${tam} px): «${a.s}» se sale`);
      for (const b of ys) if (b.x0 < 0) malas.push(`${gr.id} (${tam} px): «${b.s}» se sale por la izquierda`);
      if (Math.max(...xs.map((a) => a.y1)) > g.H - 2 - 0.97 * tam + 0.5) malas.push(`${gr.id} (${tam} px): las etiquetas de x tocan el nombre del eje`);
    }
  // reviewed: «0» × «−200 V» (6.9), «1 µA» × «550 mV» (6.12), «0» × «100 Ω» (6.14)… about 40 cards
  expect(malas).toEqual([]);
});

test('gráficas: el tamaño de las etiquetas da 11 px en pantalla a 360 px y 12 px en escritorio; «1 vez»', () => {
  expect(tamMarca(0)).toBe(TAM_MARCA);
  expect(tamMarca(560)).toBe(TAM_MARCA);
  for (const ancho of [270, 296, 320]) expect((tamMarca(ancho) * ancho) / 380).toBeGreaterThanOrEqual(11);
  expect(etiquetaMarca(1, { unidad: 'veces', escala: 'log' })).toBe('1 vez');
  expect(etiquetaMarca(10, { unidad: 'veces', escala: 'log' }).replace(/\s/gu, ' ')).toBe('10 veces');
});

test('laboratorio: la pista nombra el prefijo que falta («100,5 F») y el signo cambiado de unos dB', () => {
  const paso = (unidad: string, v: number): PasoLab => ({
    id: 'x',
    titulo: '',
    texto: '',
    requisitos: [],
    lectura: { que: 'la medida', unidad, medir: () => v, tol: { rel: 0.01 }, porqueTol: 'tres cifras' },
    hazlo: {},
  });
  const b = { vigente: true } as unknown as Banco;
  const pista = (p: PasoLab, t: string) => {
    const r = evaluarPaso(p, b, t);
    return r.estado === 'bien' ? 'bien' : r.pista;
  };
  const c = paso('F', 100.5e-6);
  expect(pista(c, '100,5 µF')).toBe('bien');
  // reviewed: «El instrumento marca otra cosa»
  expect(pista(c, '100,5 F')).toMatch(/prefijo/);
  expect(pista(c, '100,5 nF')).toMatch(/prefijo/);
  expect(pista(c, '100,5')).toMatch(/prefijo/);
  const db = paso('dB', -3.01);
  expect(pista(db, '-3,01')).toBe('bien');
  expect(pista(db, '3,01')).toMatch(/signo.*negativo.*atenuación/);
  expect(pista(db, '30,1')).toMatch(/otra cosa|diez veces/);
  // ten times off is still named as such
  expect(pista(paso('V', 2.5), '25 V')).toMatch(/diez veces/);
});

test('laboratorio 5, paso «fase»: los cursores del «Hágalo por mí» se calculan en la base que aplica', () => {
  // a 1 kHz sine on both channels (CH2 45° late), captured at 200 µs/div as the step before leaves it
  const dt = 2e-6;
  const n = 1200;
  const t0 = -1.2e-3;
  const y1: number[] = [];
  const y2: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + i * dt;
    y1.push(Math.sin(2 * Math.PI * 1000 * t));
    y2.push(Math.sin(2 * Math.PI * 1000 * t - Math.PI / 4));
  }
  // (the simulated waveforms at the probes, finer than the capture: the delay B − A comes from them)
  const ts = Array.from({ length: 4000 }, (_, i) => i * 1e-6);
  const sim = (f: number) => ts.map((t) => Math.sin(2 * Math.PI * 1000 * t - f));
  const b = {
    fnirsi: { captura: { t0, dt, y: [y1, y2] }, hpos: 0, sDiv: 200e-6, cur: { a: 0, b: 0 } },
    entradasOsc: () => ({ entradas: [{ t: ts, y: sim(0) }, { t: ts, y: sim(Math.PI / 4) }], inicio: 0, fin: 4e-3 }),
  } as unknown as Banco;
  const fase = LABORATORIOS.find((l) => l.n === 5)!.pasos.find((p) => p.id === 'fase')!;
  const a = (fase.hazlo as (b: Banco) => { fn: { sDiv: number; cur: { a: number; b: number } } })(b).fn;
  expect(a.sDiv).toBe(100e-6);
  // in the divisions of 100 µs/div: A on a rising crossing of CH1, B 125 µs (45°) after it
  const ta = cruceS(b, 0, 0, true, -5 * 100e-6)!;
  expect(a.cur.a).toBeCloseTo(ta / 100e-6, 1);
  // (125 µs is 31,25 steps of 4 µs: the cursors give 124 µs, half a step at most from the circuit's delay)
  expect(Math.abs((a.cur.b - a.cur.a) * 100e-6 - 125e-6)).toBeLessThanOrEqual(2e-6 + 1e-12);
  // (cruce keeps its meaning: divisions of the base on screen)
  expect(cruce(b, 0, 0, true, -5)).toBeCloseTo(cruceS(b, 0, 0, true, -5 * 200e-6)! / 200e-6, 9);
});

test('editor: una fuente de alterna con fase se rotula con su valor y su fase', () => {
  expect(rotuloAc('AC 230.940108 -120', 'V')).toBe('AC 231 V ∠−120°');
  expect(rotuloAc('AC 230.940108 120', 'V')).toBe('AC 231 V ∠120°');
  expect(rotuloAc('ac 1', 'A')).toBe('AC 1 A');
  expect(rotuloAc('AC 2.5 -45.25', 'V')).toBe('AC 2,5 V ∠−45,3°');
  expect(rotuloAc('DC 5 AC 1 30', 'V')).toBe('AC 1 V ∠30°');
  expect(rotuloAc('AC 1 SIN(0 1 1k)', 'V')).toBeNull();
  expect(rotuloAc('PULSE(0 5 0 1n 1n 1u 2u)', 'V')).toBeNull();
});

test('lección: una tarjeta respondida en otra visita vuelve respondida, sin informar de nada otra vez', () => {
  const l = JSON.parse(fs.readFileSync(path.join(libro, 'lecciones11', 'cap01', 'sec-1.4.json'), 'utf8')) as Leccion11;
  const t = l.tarjetas.find((x) => x.id === 'prediga-salida') as Tarjeta;
  const { estado, aviso } = estadoRespondido(t);
  const k = t.opciones!.findIndex((o) => o.bien);
  expect(estado).toMatchObject({ eleccion: k, comprobado: true, bien: true, resuelta: true, cerrada: true });
  expect(aviso?.bien).toBe(true);
  expect(aviso?.textos[0]).toEqual(t.opciones![k]!.porque);
  expect(botonPrincipal(t, estado, {}).accion).toBe('continuar');
  expect(eventoDeComprobacion(l, t, estado, { ...estado, intentos: 2 })).toBeNull();
});
