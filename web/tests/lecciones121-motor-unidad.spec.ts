// 1.2.1 (motor121) in Node (no browser, no server): the instrument on circuits the page cannot solve by itself
// (contenido/lecciones11/GUIA.md §13.1, §13.10) — non-linear DC circuits read on the app's ngspice (.op) and circuits
// that change with time (the multimeter's average over the graph's window, the oscilloscope's waveform) — on the
// catalogue lesson tests/lecciones12-catalogo/cap05/sec-5.3.yaml: the request the page and the generator build is the
// same netlist; what the page reads from the simulator's plots (solucionDeGraficas, ondaDe) is what the generator's
// check compares (compararSimulacion with the same measure and window); each rule of the generator broken on
// purpose (a probe on a node that does not exist, both probes on one node, a branch that never carries current, an
// oscilloscope point without a curve on a DC circuit, a «leer.medida» the reader would not see within tolerance).
// And the schematics' catalogue (task 2 of motor121): every schematic exposes its points, branches and zones, each a
// node, a 0 V meter, a piece or a drawn part of it, each point marked on its drawing; and a meter on each named point
// against ground reads in the page exactly what the generator's ngspice gives.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones121-motor-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import { compilarModelo, valoresDeTarjeta } from '../src/lib/leccion11/modelo.ts';
import { valoresSueltos } from '../src/lib/leccion11/motor.ts';
import { compararSimulacion, contextoNetlist, montarNetlist, promedioMedida, type GraficaSim } from '../src/lib/leccion11/spice.ts';
import type { Leccion11, Tarjeta, WidgetCircuito } from '../src/lib/leccion11/tipos.ts';
import { esquemaDe, nombresEsquemas } from '../src/lib/leccion11/esquemas/registro.ts';
import { esLineal, resolverCC } from '../src/lib/leccion12/cc.ts';
import { ondaDe, peticionMedida, solucionDeGraficas } from '../src/lib/leccion12/hacer/punto-trabajo.ts';
import { compilar } from '../src/simulador/motor/nucleo.ts';
import { simular } from '../src/simulador/motor/simular.ts';
import { rutaFuenteCongelada } from './lecciones11-congeladas';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
};
const modulo = await compilar(fs.readFileSync(path.join(web, 'public', 'ngspice', 'ngspice-xspice.wasm')));
const ngspice = async (t: string) => (await simular(modulo, t, undefined, 'xspice')).ejecucion.graficas as unknown as GraficaSim[];

const FUENTE = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap05', 'sec-5.3.yaml'), 'utf8'));
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const generar = (f: unknown) => generarLeccion(f, contexto, 'catalogo-motor121');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type F = { tarjetas: Record<string, any>[] };
const tarjetaDe = (f: F, id: string) => f.tarjetas.find((t) => t.id === id)!;
function errores(cambio: (f: F) => void): string {
  const f = copia(FUENTE) as F;
  cambio(f);
  return generar(f).errores.join('\n');
}
const R = generar(FUENTE);
const L = R.leccion as Leccion11;
const T = (id: string) => L.tarjetas.find((t) => t.id === id)!;
const k = (id: string) => L.tarjetas.findIndex((t) => t.id === id);
const evaluado = (t: Tarjeta) => compilarModelo(L.modelo).evaluar(valoresDeTarjeta(t, valoresSueltos(L, k(t.id))));

test.describe('el instrumento en circuitos que la página no resuelve sola', () => {
  test('el catálogo se genera, y las lecturas del simulador están entre sus comprobaciones', async () => {
    expect(R.errores).toEqual([]);
    const delInstrumento = R.spice.filter((c) => /instrumento|medir\.valor|leer\.medida/.test(c.donde));
    expect(delInstrumento.length).toBeGreaterThanOrEqual(6);
    // and the app's ngspice agrees with every one of them (as the script runs them)
    for (const c of delInstrumento) expect(compararSimulacion(c, await ngspice(c.netlist)), c.donde).toEqual([]);
  });

  test('la petición: un LED y un transistor se simulan (.op); un circuito lineal no; la media onda, en el tiempo', () => {
    const led = peticionMedida(T('mida-led').widget as WidgetCircuito, evaluado(T('mida-led')));
    expect(led?.analisis).toBe('op');
    expect(led?.netlist).toMatch(/\.op\n\.end$/);
    expect(peticionMedida(T('mida-colector').widget as WidgetCircuito, evaluado(T('mida-colector')))?.analisis).toBe('op');
    const onda = peticionMedida(T('mida-onda').widget as WidgetCircuito, evaluado(T('mida-onda')));
    expect(onda).toMatchObject({ analisis: 'tran', desde: 0, hasta: 0.04 });
    const lineal: WidgetCircuito = { tipo: 'circuito', esquema: 'divisor', piezas: { fuente: 'V', arriba: 'A', abajo: 'B' }, mandos: [], ocultar: false };
    expect(peticionMedida(lineal, { V: 12, A: 1000, B: 1000 })).toBeNull();
  });

  test('lo que la página lee del simulador es lo que compara el generador: punto de trabajo, media y onda', async () => {
    const t = T('mida-led');
    const p = peticionMedida(t.widget as WidgetCircuito, evaluado(t))!;
    const s = solucionDeGraficas(p, await ngspice(p.netlist))!;
    expect(s.nodos.an).toBeCloseTo(2, 3);
    expect(s.corrientes.vmed).toBeCloseTo(0.02, 5);
    expect(s.nodos['0']).toBe(0);
    const tm = T('mida-media');
    const pm = peticionMedida(tm.widget as WidgetCircuito, evaluado(tm))!;
    const g = await ngspice(pm.netlist);
    const sm = solucionDeGraficas(pm, g)!;
    const media = promedioMedida(g.find((x) => /transient/i.test(x.analisis))!, 'v(s)', pm.desde!, pm.hasta!)!;
    expect(sm.nodos.s).toBeCloseTo(media, 9);
    // a half-wave rectifier's output averages close to (V_p − V_D)/π; the input averages to nothing
    expect(Math.abs(sm.nodos.s! - (16.97 - 0.7) / Math.PI)).toBeLessThan(0.3);
    expect(Math.abs(sm.nodos.fte!)).toBeLessThan(0.05);
    const w = ondaDe(pm, g, 's')!;
    expect(w[0]![0]).toBeCloseTo(0, 6);
    expect(w[w.length - 1]![0]).toBeCloseTo(0.04, 6);
    expect(Math.max(...w.map((x) => x[1]))).toBeGreaterThan(15.5);
    expect(Math.min(...w.map((x) => x[1]))).toBeGreaterThan(-0.01);
    expect(ondaDe(pm, g, 'no-existe')).toBeNull();
  });

  test('el generador rechaza lo que no tiene sentido', () => {
    expect(errores((f) => (tarjetaDe(f, 'mida-led').widget.instrumento = { tipo: 'multimetro', puntos: { an: 'A', zz: 'Z', '0': 'Masa' } }))).toMatch(/puntos\.zz»: no es un nodo del esquema led/);
    expect(errores((f) => (tarjetaDe(f, 'mida-led').widget.instrumento = { tipo: 'multimetro', puntos: ['an', 'zz'] }))).toMatch(/«zz» no tiene nombre en el esquema/);
    // both probes on one node (fte and a are joined by the 0 V meter)
    expect(
      errores((f) => {
        const t = tarjetaDe(f, 'mida-led');
        t.widget.instrumento = { tipo: 'multimetro', puntos: { fte: 'Fuente', a: 'Tras el medidor', an: 'LED', '0': 'Masa' } };
        t.medir = { magnitud: 'tension', entre: ['fte', 'a'], porque: {} };
      }),
    ).toMatch(/las dos puntas quedan en el mismo nodo/);
    expect(errores((f) => (tarjetaDe(f, 'mida-led').medir.entre = ['an', 'an']))).toMatch(/mismo nodo/);
    // a branch that never carries current (a linear circuit, solved here)
    const div = copia(FUENTE) as F;
    div.tarjetas.splice(1, 0, {
      id: 'mida-nada', tipo: 'medir', titulo: 'Nada', texto: 'Nada.', libro: [133],
      widget: { tipo: 'circuito', esquema: 'divisor', piezas: { fuente: 'V_e', arriba: 'R_e', abajo: 'R_e', carga: 'R_e', interruptor: 'k_c' }, mide: { salida: 'V_e' }, instrumento: { tipo: 'multimetro' }, mandos: [] },
      medir: { magnitud: 'corriente', rama: 'vcarga', porque: {} }, escalera: ['x'], solucion: 'x',
    });
    (div as unknown as { modelo: { valores: Record<string, unknown> } }).modelo.valores.k_c = { tipo: 'interruptor', nombre: 'carga conectada', valor: 0 };
    expect(generar(div).errores.join('\n')).toMatch(/no pasa corriente en ningún estado/);
    // an oscilloscope point without a curve needs a graph against time the schematic simulates
    expect(
      errores((f) => {
        const t = tarjetaDe(f, 'mida-led');
        t.tipo = 'medir';
        t.widget.instrumento = { tipo: 'osciloscopio', puntos: ['an', 'fte'] };
        t.widget.grafica = { x: { id: 'x', min: 0, max: 1, unidad: 's', rotulo: 't' }, y: { min: 0, max: 5, unidad: 'V', rotulo: 'v' }, curvas: [{ expr: 'V_e', color: 'azul', rotulo: 'v' }] };
        t.medir = { magnitud: 'senal', punto: 'an', porque: { fte: 'La fuente.' } };
      }),
    ).toMatch(/falta la curva de «an», «fte»/);
    expect(errores((f) => (tarjetaDe(f, 'lea-led').leer.medida = { rama: 'vzz' }))).toMatch(/«vzz» no es una rama del instrumento/);
    expect(errores((f) => (tarjetaDe(f, 'elija-estabilidad').elegir.zonas = ['r1', 'zz', 're']))).toMatch(/«zz» no tiene nombre en el esquema/);
  });

  test('«leer.medida» y «medir.valor» van al simulador; una lectura que el lector no vería dentro de la tolerancia falla', async () => {
    const f = copia(FUENTE) as F;
    tarjetaDe(f, 'lea-led').leer.objetivo = 'I_e*1.03';
    tarjetaDe(f, 'mida-colector').medir.valor = 'I_pb';
    const r = generar(f);
    expect(r.errores).toEqual([]);
    const fallos: string[] = [];
    for (const c of r.spice.filter((x) => /leer\.medida|medir\.valor/.test(x.donde))) fallos.push(...compararSimulacion(c, await ngspice(c.netlist)));
    expect(fallos.join('\n')).toMatch(/lea-led: «leer\.medida»/);
    expect(fallos.join('\n')).toMatch(/mida-colector: «medir\.valor»/);
  });

  test('las zonas y los puntos por defecto salen del esquema, con sus nombres', () => {
    const e = T('elija-estabilidad');
    expect(e.actividad?.tipo).toBe('elegir');
    const zonas = (e.actividad as { zonas: { id: string; rotulo: unknown }[] }).zonas.map((z) => z.id);
    expect(zonas).toEqual(['r1', 'r2', 'rc', 're']);
    const i = (T('mida-led').widget as WidgetCircuito).instrumento!;
    expect(i.puntos.map((p) => p.id)).toEqual(['0', 'fte', 'an']);
    expect(i.ramas.map((b) => b.id)).toEqual(['vmed']);
    expect(i.modos).toEqual(['V', 'A']);
    expect((T('lea-led').widget as WidgetCircuito).instrumento!.modos).toEqual(['A']);
  });
});

// ------------------------------------------------------------------ every schematic: points, branches and zones

/** Each schematic's card of the widget catalogue (tests/lecciones11-catalogo, and the frozen 1.4 for divisor/paralelo). */
const CATALOGO = (() => {
  const out = new Map<string, { t: Tarjeta; L: Leccion11 }>();
  for (const f of [path.join(web, 'tests', 'lecciones11-catalogo', 'cap01', 'sec-1.5.yaml'), rutaFuenteCongelada('cap01/sec-1.4')]) {
    const r = generarLeccion(parse(fs.readFileSync(f, 'utf8')), contexto, 'catalogo');
    for (const t of r.leccion?.tarjetas ?? []) if (t.widget?.tipo === 'circuito' && !out.has(t.widget.esquema)) out.set(t.widget.esquema, { t, L: r.leccion! });
  }
  return out;
})();

test.describe('cada esquema se puede medir y tocar', () => {
  test('todos los esquemas tienen su tarjeta de catálogo', () => {
    expect(nombresEsquemas().filter((n) => !CATALOGO.has(n))).toEqual([]);
  });

  for (const nombre of nombresEsquemas()) {
    test(`${nombre}: puntos, ramas y zonas del esquema, dibujados, y el multímetro marca lo que da ngspice`, async () => {
      const def = esquemaDe(nombre)!;
      const x = CATALOGO.get(nombre);
      expect(x, 'tarjeta de catálogo').toBeTruthy();
      const { t, L: lec } = x!;
      const w = t.widget as WidgetCircuito;
      const r = compilarModelo(lec.modelo).evaluar(valoresDeTarjeta(t, valoresSueltos(lec, lec.tarjetas.indexOf(t))));
      const c = contextoNetlist(w, r);
      expect(def.medible, 'medible()').toBeTruthy();
      const m = def.medible!(c);
      const lineas = def.netlist(c, 'op');
      const nodos = new Set<string>(['0']);
      const medidores = new Set<string>();
      for (const l of lineas) {
        const s = l.replace(/;.*$/, '').trim();
        if (!s || /^[.*+]/.test(s) || /^bmed/i.test(s)) continue;
        const tk = s.split(/\s+/);
        nodos.add(tk[1]!.toLowerCase());
        nodos.add(tk[2]!.toLowerCase());
        if (/^[eg]/i.test(tk[0]!)) {
          nodos.add(tk[3]!.toLowerCase());
          nodos.add(tk[4]!.toLowerCase());
        }
        if (/^v/i.test(tk[0]!) && /^(dc\s+)?0$/i.test(tk.slice(3).join(' '))) medidores.add(tk[0]!.toLowerCase());
      }
      const dibujo = fs.readFileSync(path.join(web, 'src', 'lib', 'leccion11', 'esquemas', nombre, 'Dibujo.svelte'), 'utf8');
      // points: nodes of the netlist, neutral names of at most eight words, each with its mark on the drawing
      expect(Object.keys(m.puntos).length, 'al menos dos puntos').toBeGreaterThanOrEqual(2);
      expect(m.puntos['0'], 'masa').toBeTruthy();
      for (const [p, n] of Object.entries(m.puntos)) {
        expect(nodos.has(p), `punto «${p}» en la netlist (${[...nodos].join(', ')})`).toBe(true);
        expect(n.split(/\s+/).length, `«${n}»`).toBeLessThanOrEqual(8);
        expect(dibujo.includes(`red="${p}"`) || dibujo.includes(`'${p}'`) || /<Punto [^>]*red=\{/.test(dibujo) || dibujo.includes('data-red={`'), `punto «${p}» marcado en el dibujo`).toBe(true);
      }
      for (const [b, n] of Object.entries(m.ramas ?? {})) {
        expect(medidores.has(b), `rama «${b}» es un medidor de 0 V (${[...medidores].join(', ')})`).toBe(true);
        expect(n.split(/\s+/).length).toBeLessThanOrEqual(8);
        expect(dibujo.includes(`medidor="${b}"`) || /<Rama [^>]*medidor=\{/.test(dibujo), `rama «${b}» marcada en el dibujo`).toBe(true);
      }
      expect(Object.keys(m.zonas ?? {}).length, 'al menos dos zonas para elegir').toBeGreaterThanOrEqual(2);
      for (const [z, n] of Object.entries(m.zonas ?? {})) {
        expect(z in w.piezas || z in (def.partes ?? {}), `zona «${z}»: pieza del widget o parte del esquema`).toBe(true);
        expect(n.split(/\s+/).length).toBeLessThanOrEqual(8);
      }
      // the readings: what the page shows (cc.ts for a linear DC circuit, else the simulator's plots as
      // punto-trabajo.ts reads them) against ngspice's own operating point of the same netlist
      const p = peticionMedida(w, r, def);
      const op = await ngspice(montarNetlist(def, c, 'op', '.op'));
      const ref = solucionDeGraficas({ netlist: '', analisis: 'op' }, op);
      expect(ref, 'ngspice da el punto de trabajo').toBeTruthy();
      const pagina = p ? solucionDeGraficas(p, await ngspice(p.netlist)) : resolverCC(lineas);
      expect(pagina, 'la página tiene lectura').toBeTruthy();
      for (const q of Object.keys(m.puntos)) expect(pagina!.nodos[q], `v(${q}) en la página`).not.toBeUndefined();
      for (const b of Object.keys(m.ramas ?? {})) expect(pagina!.corrientes[b], `i(${b}) en la página`).not.toBeUndefined();
      if (!p || p.analisis === 'op') {
        // a DC circuit: the page's reading of each point against ground and each branch is ngspice's — the simulator's
        // own run, or a linear one solved in the page: within 10⁻⁶ relative, plus what GMIN (10⁻¹² S) leaves on a node
        // held by teraohms (a bridge's leakage, an open load): 10⁻⁵ of the circuit's largest voltage, 0,1 nA
        const lin = esLineal(lineas) && !p;
        const vmax = Math.max(1e-3, ...Object.values(ref!.nodos).map((v) => Math.abs(v)));
        for (const q of Object.keys(m.puntos)) expect(Math.abs(pagina!.nodos[q]! - ref!.nodos[q]!), `v(${q})`).toBeLessThanOrEqual(lin ? 1e-6 * Math.abs(ref!.nodos[q]!) + 1e-5 * vmax : 1e-12);
        for (const b of Object.keys(m.ramas ?? {})) expect(Math.abs(pagina!.corrientes[b]! - ref!.corrientes[b]!), `i(${b})`).toBeLessThanOrEqual(lin ? 1e-6 * Math.abs(ref!.corrientes[b]!) + 1e-12 * vmax * Object.keys(ref!.nodos).length + 1e-10 : 1e-15);
      }
    });
  }
});

// ------------------------------------------------------------------ the conversion helper (--convertir)

import { convertirLeccion, numeroConUnidad } from '../src/lib/leccion12/hacer/convertir.ts';

test.describe('--convertir: el borrador hacia «aprender haciendo»', () => {
  test('lee los números de las opciones con su unidad y su prefijo', () => {
    expect(numeroConUnidad('5,24 µA: conduce, poco')).toEqual({ valor: expect.closeTo(5.24e-6, 12), unidad: 'A' });
    expect(numeroConUnidad('575 mA')).toEqual({ valor: expect.closeTo(0.575, 9), unidad: 'A' });
    expect(numeroConUnidad('1 000 Ω y algo')).toEqual({ valor: 1000, unidad: 'Ω' });
    expect(numeroConUnidad('−2,28 mV/°C')?.valor).toBeCloseTo(-2.28e-3, 9);
    expect(numeroConUnidad('4,7 kΩ')?.valor).toBeCloseTo(4700, 6);
    expect(numeroConUnidad('Seis veces más')).toBeNull();
  });

  const FIX = {
    leccion: 'cap05/sec-5.3',
    libro: { 133: 'Alimentar un LED rojo de 2,0 V nominales a 20 mA desde 5 V.', 135: 'El valor comercial de la serie E24 coincide: 150 Ω' },
    modelo: {
      valores: {
        V_e: { sim: 'V', nombre: 'tensión de la fuente', unidad: 'V', valor: 5 },
        R_e: { sim: 'R', nombre: 'resistencia del LED', unidad: 'Ω', valor: 100 },
        V_fe: { sim: 'V_{f}', nombre: 'tensión del LED', unidad: 'V', valor: 2 },
      },
      calculos: {
        I_e: { expr: '(V_e - V_fe)/R_e', sim: 'I', nombre: 'corriente del LED', unidad: 'A' },
        V_re: { expr: 'V_e - V_fe', sim: 'V_{R}', nombre: 'tensión de la resistencia', unidad: 'V' },
        I_sin: { expr: 'V_e/R_e', sim: 'I', nombre: 'corriente sin restar el LED', unidad: 'A' },
      },
    },
    tarjetas: [
      {
        id: 'explore-led', tipo: 'explorar', titulo: 'El LED', texto: 'Mueva la resistencia y mire la corriente.', libro: [133],
        widget: { tipo: 'circuito', esquema: 'led', piezas: { fuente: 'V_e', r: 'R_e', vf: 'V_fe' }, lectura: { valor: 'I_e', rotulo: 'Corriente' }, corriente: 'I_e', mide: { corriente: 'I_e', vf: 'V_fe' }, mandos: [{ valor: 'R_e', lista: [100, 150, 220], rotulo: 'Resistencia' }] },
        requiere: { mover: ['R_e'] },
      },
      {
        id: 'prediga-150', tipo: 'predecir', titulo: 'Prediga', texto: 'Con la resistencia de la serie E24, ¿qué corriente lleva el LED?', libro: [133, 135], fijar: { R_e: 150 },
        widget: { tipo: 'circuito', esquema: 'led', piezas: { fuente: 'V_e', r: 'R_e', vf: 'V_fe' }, lectura: { valor: 'I_e', rotulo: 'Corriente' }, corriente: 'I_e', mide: { corriente: 'I_e', vf: 'V_fe' }, ocultar: true, mandos: [] },
        opciones: [
          { texto: '20 mA', bien: true, porque: 'A la resistencia le quedan 3 V: 3/150 = 20 mA.' },
          { texto: '33 mA', porque: 'Eso sería con los 5 V enteros en la resistencia: falta restar el LED.' },
          { texto: 'Nada: el LED no conduce', porque: 'Con 3 V de sobra conduce de sobra.' },
        ],
        escalera: ['Reste la caída del LED.'], solucion: '20 mA.',
        comprobar: [{ V_re: 3, I_sin: 0.0333 }],
      },
      {
        id: 'lea-tension', tipo: 'pregunta', titulo: 'La resistencia', texto: '¿Cuánta tensión le queda a la resistencia?', libro: [133], fijar: { R_e: 150 },
        widget: { tipo: 'circuito', esquema: 'led', piezas: { fuente: 'V_e', r: 'R_e', vf: 'V_fe' }, corriente: 'I_e', mide: { corriente: 'I_e', vf: 'V_fe', vr: 'V_re' }, mandos: [] },
        estimar: { objetivo: 'V_re', unidad: 'V', min: 0, max: 5, paso: 0.1, inicio: 5, tol: 0.05, rotulo: 'Tensión de la resistencia' },
        pistas: [{ cuando: { valor: 'estimacion', mayor: 4 }, texto: 'Ha dado toda la fuente: el LED también cae.' }, { texto: 'Le queda más.' }],
        exito: 'Lo que el LED no cae.', escalera: ['La fuente menos el LED.'], solucion: 'Unos 3 V.',
      },
      { id: 'resumen', tipo: 'resumen', titulo: 'Resumen', libro: [133], ideas: [{ titulo: 'La resistencia', texto: 'Se lleva lo que el LED no cae.' }] },
    ],
  };

  test('opciones numéricas → simular con errores típicos; estimar sobre el circuito → leer con el multímetro; explorar → objetivo', () => {
    const r = generar(FIX);
    expect(r.errores).toEqual([]);
    const c = convertirLeccion(FIX, r.leccion!);
    const [ex, pr, le] = c.borrador.tarjetas;
    expect(pr.tipo).toBe('simular');
    expect(pr.opciones).toBeUndefined();
    expect(pr.simular).toMatchObject({ objetivo: 'I_e', unidad: 'A', medida: 'corriente' });
    expect(pr.simular.errores[0].razon.min).toBeCloseTo(1.67 * 0.97, 1);
    expect(pr.simular.errores[1].texto).toMatch(/^REVISAR/);
    expect(pr.exito).toMatch(/3\/150/);
    expect(le.tipo).toBe('leer');
    expect(le.widget.instrumento).toEqual({ tipo: 'multimetro' });
    expect(le.leer.medida).toEqual({ entre: ['fte', 'an'] });
    expect(ex.objetivo.condiciones[0]).toMatchObject({ valor: 'I_e', objetivo: 0.02 });
    expect(ex.objetivo.logrado).toMatch(/REVISAR/);
    expect(ex.requiere).toBeUndefined();
    expect(c.cambios).toHaveLength(3);
    // the draft generates (the REVISAR texts are for the author)
    expect(generar(c.borrador).errores).toEqual([]);
    // the source object is not touched
    expect(FIX.tarjetas[1]!.tipo).toBe('predecir');
  });
});

// ------------------------------------------------------------------ «diseno» with a value given as an interval

import { placas } from '../src/lib/leccion12/tolerancias.ts';

test.describe('diseno: β como intervalo', () => {
  test('las esquinas toman los extremos del intervalo, el Monte Carlo valores dentro; el generador rechaza un intervalo roto', () => {
    const d = { tipo: 'diseno' as const, tolerancias: { R: 0.05 }, intervalos: { beta: { min: 100, max: 300 } }, metodo: 'esquinas' as const, muestras: 50, semilla: 7, exigir: 'todas' as const };
    const ps = placas(d, { R: 1000, beta: 150 });
    expect(ps).toHaveLength(4);
    expect(new Set(ps.map((p) => p.beta))).toEqual(new Set([100, 300]));
    expect(new Set(ps.map((p) => Math.round(p.R!)))).toEqual(new Set([950, 1050]));
    const mc = placas({ ...d, metodo: 'montecarlo' }, { R: 1000, beta: 150 });
    expect(mc.every((p) => p.beta! >= 100 && p.beta! <= 300)).toBe(true);
    expect(Math.max(...mc.map((p) => p.beta!)) - Math.min(...mc.map((p) => p.beta!))).toBeGreaterThan(100);
    const t = T('disene-beta');
    expect(t.actividad).toMatchObject({ tipo: 'diseno', intervalos: { beta: { min: 100, max: 300 } } });
    expect(errores((f) => (tarjetaDe(f, 'disene-beta').diseno.tolerancias = { beta: { min: 300, max: 100 } }))).toMatch(/un intervalo \{ min, max \} con min < max/);
    // (a band too narrow for β from 100 to 300: the nominal reaches it, no R_E holds it at both ends)
    expect(errores((f) => (tarjetaDe(f, 'disene-beta').condiciones = [{ valor: 'I_pc', min: 0.00128, max: 0.00134, rotulo: 'I_{C}: {{I_pc}}' }]))).toMatch(/no tiene solución con las tolerancias/);
  });
});

// ------------------------------------------------------------------ logic circuits (requests of autor121-digital)

import { ficha, iniciar as iniciarLogica, poner as ponerLogica, type CircuitoLogico } from '../src/lib/leccion12/digital/logica.ts';
import { buscarObjetivo } from '../src/lib/leccion12/digital/objetivo-logico.ts';
import { comprobarHacer, leerEntero, escribirEntero } from '../src/lib/leccion12/hacer/motor-hacer.ts';
import { textoPlano } from '../src/lib/leccion11/texto.ts';

const DIG = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap09', 'sec-9.6.yaml'), 'utf8'));
const RD = generarLeccion(DIG, contexto, 'catalogo-motor121-digital');
const LD = RD.leccion as Leccion11;
const TD = (id: string) => LD.tarjetas.find((t) => t.id === id)!;
function erroresDig(cambio: (f: F) => void): string {
  const f = copia(DIG) as F;
  cambio(f);
  return generar(f).errores.join('\n');
}

test.describe('circuitos lógicos: líneas, objetivo, elegir, cronograma y hexadecimal', () => {
  test('el catálogo digital se genera', () => {
    expect(RD.errores).toEqual([]);
  });

  test('drenador abierto: AND cableada con pull-up; sin pull-up flota (Z); tri-estado: Z deshabilitado y X en conflicto', () => {
    const c = (TD('explore-and-cableada').widget as { circuito: CircuitoLogico }).circuito;
    for (let r = 0; r < 8; r++) {
      const v = { A: (r >> 2) & 1, B: (r >> 1) & 1, C: r & 1 } as Record<string, 0 | 1>;
      expect(ficha(iniciarLogica(c, null, v), 'linea'), `fila ${r}`).toBe(v.A && v.B && v.C ? 1 : 0);
    }
    const flotante: CircuitoLogico = { ...c, piezas: c.piezas.map((p) => (p.tipo === 'bus' ? { ...p, pullup: null } : p)) };
    expect(ficha(iniciarLogica(flotante, null, { A: 1, B: 1, C: 1 }), 'linea')).toBe('Z');
    const t = (TD('explore-contencion').widget as { circuito: CircuitoLogico }).circuito;
    let s = iniciarLogica(t, null, { D1: 1, E1: 0, D2: 0, E2: 0 });
    expect(ficha(s, 't1')).toBe('Z');
    expect(ficha(s, 'bus')).toBe('Z');
    s = ponerLogica(t, s, { E1: 1 });
    expect(ficha(s, 'bus')).toBe(1);
    s = ponerLogica(t, s, { E2: 1 });
    expect(ficha(s, 'bus')).toBe('X');
    // (what a gate reads from a line: Z as 1, X as 0)
    expect(s.senales.bus).toBe(0);
    expect(erroresDig((f) => f.tarjetas[0]!.widget.piezas.push({ id: 'n9', tipo: 'nand', entradas: ['A', 'B'] }) && f.tarjetas[0]!.widget.piezas[3].entradas.push('n9'))).toMatch(/se conecta a salidas «od» o «tri»/);
    expect(erroresDig((f) => (f.tarjetas[0]!.widget.piezas[3].pullup = 7))).toMatch(/pullup.*1 \(a la alimentación\)/);
  });

  test('objetivo sobre el circuito: el camino más corto, y lo que no tiene sentido es un error', () => {
    const cont = TD('explore-contador');
    const b = buscarObjetivo((cont.widget as { circuito: CircuitoLogico }).circuito, cont.objetivo!.condiciones);
    expect(b.camino).toEqual(Array.from({ length: 5 }, () => ({ tipo: 'pulso' })));
    const and = TD('explore-and-cableada');
    expect(buscarObjetivo((and.widget as { circuito: CircuitoLogico }).circuito, and.objetivo!.condiciones).camino).toHaveLength(3);
    expect(erroresDig((f) => (tarjetaDe(f, 'explore-contador').objetivo.condiciones = [{ contador: 'c1', valor: 0, rotulo: 'Cero' }]))).toMatch(/se cumple ya al encender/);
    expect(erroresDig((f) => (tarjetaDe(f, 'explore-contador').objetivo.condiciones = [{ contador: 'c1', valor: 9, rotulo: 'Nueve' }]))).toMatch(/no se alcanza/);
    expect(erroresDig((f) => (tarjetaDe(f, 'explore-contador').objetivo.condiciones = [{ led: 'ZZ', valor: 1, rotulo: 'x' }]))).toMatch(/no es un LED del circuito/);
  });

  test('marcar el ciclo en el cronograma y leer en hexadecimal: veredictos', () => {
    const mc = compilarModelo(LD.modelo);
    const m = TD('marque-ciclo');
    const e = (tramo: number) => ({ actividad: { tipo: 'marcar' }, movidos: ['tramo'], widget12: { tramo } });
    expect(comprobarHacer(mc, m, m.actividad as never, e(2), {}).bien).toBe(true);
    const mal = comprobarHacer(mc, m, m.actividad as never, e(4), {});
    expect(mal.bien).toBe(false);
    expect(mal.textos.map((x) => textoPlano(x)).join(' ')).toMatch(/ciclo 3.*vuelve a subir/);
    expect(erroresDig((f) => (tarjetaDe(f, 'marque-ciclo').marcar.ciclo = 1))).toMatch(/empieza en el ciclo 1/);
    const h = TD('lea-hex');
    const leer = (texto: string) => comprobarHacer(mc, h, h.actividad as never, { actividad: { tipo: 'leer', texto, valor: null } as never }, {});
    for (const ok of ['20', '0x20', '20h', '0X20']) expect(leer(ok).bien, ok).toBe(true);
    expect(textoPlano(leer('32').textos[0]!)).toMatch(/decimal/);
    expect(textoPlano(leer('0x04').textos[0]!)).toMatch(/bits al revés/);
    expect(textoPlano(leer('0x02').textos[0]!)).toMatch(/nibbles/);
    expect(textoPlano(leer('zz').textos[0]!)).toMatch(/no es un número en hexadecimal/);
    expect(leerEntero('0011 0001', 2)).toBe(49);
    expect(escribirEntero(49, 2, 8)).toBe('0011 0001');
    expect(escribirEntero(32, 16, 8)).toBe('0x20');
  });

  test('elegir sobre un circuito lógico: piezas y LED como zonas', () => {
    const t = TD('elija-inversor');
    expect((t.actividad as { zonas: { id: string }[] }).zonas.map((z) => z.id)).toEqual(['n1', 'n2', 'Y']);
    expect(erroresDig((f) => (tarjetaDe(f, 'elija-inversor').elegir.zonas = { n1: 'A', zz: 'B' }))).toMatch(/«elegir.zonas.zz»: no es una pieza, un LED ni una entrada/);
  });
});

test.describe('circuitos lógicos con un lazo de puertas (autor121-digital)', () => {
  test('un cerrojo de dos NAND guarda su estado: el objetivo «a 0 y en reposo» se alcanza', async () => {
    const { tieneLazo, conMemoria, circuitoSecuencial } = await import('../src/lib/leccion12/digital/logica.ts');
    const c: CircuitoLogico = {
      entradas: [{ id: 'S', rotulo: [{ t: 'txt', s: 'S' }], valor: 1, reloj: false }, { id: 'R', rotulo: [{ t: 'txt', s: 'R' }], valor: 1, reloj: false }],
      piezas: [{ id: 'n1', tipo: 'nand', entradas: ['S', 'n2'] }, { id: 'n2', tipo: 'nand', entradas: ['R', 'n1'] }],
      salidas: [{ id: 'Q', de: 'n1', rotulo: [{ t: 'txt', s: 'Q' }] }],
    };
    expect(tieneLazo(c)).toBe(true);
    expect(conMemoria(c)).toBe(true);
    expect(circuitoSecuencial(c)).toBe(false);
    const inicio = ficha(iniciarLogica(c, null, { S: 1, R: 1 }), 'n1');
    const meta = inicio === 1 ? 0 : 1;
    const b = buscarObjetivo(c, [{ valor: 'led:Q', min: meta, max: meta, rotulo: [] }, { valor: 'senal:S', min: 1, max: 1, rotulo: [] }, { valor: 'senal:R', min: 1, max: 1, rotulo: [] }]);
    expect(b.camino?.length).toBe(2);
    // and a goal in base 2 with an error one LSB off is accepted by the generator
    expect(erroresDig((f) => (tarjetaDe(f, 'lea-hex').leer.errores = [{ expr: 'v_reg - 1', texto: 'Uno de menos.' }]))).toBe('');
    expect(erroresDig((f) => (tarjetaDe(f, 'lea-hex').leer.errores = [{ expr: 'v_reg', texto: 'El bueno.' }]))).toMatch(/es el número bueno/);
  });
});

test.describe('números en hexadecimal en los textos (autor121-pc)', () => {
  test('«$7123» y «0x20» se leen como hexadecimales, y siguen valiendo por sus cifras de antes', async () => {
    const { numerosDe } = await import('../src/lib/leccion11/texto.ts');
    expect(numerosDe('$7123: los bits altos').map((n) => n.v)).toEqual([28963]);
    expect(numerosDe('$7123')[0]!.legado?.map((n) => n.v)).toEqual([7123]);
    expect(numerosDe('PORTB = 0x20 y 0b0101').map((n) => n.v)).toEqual([32, 5]);
    expect(numerosDe('R2 de 4,7 kΩ').map((n) => n.v)).toEqual([4.7]);
    // a hexadecimal address the model gives can be written in «exito»
    const f = copia(DIG) as F & { modelo: { calculos: Record<string, unknown> } };
    f.modelo.calculos.d_s = { expr: '7*4096 + 291', sim: 'D', nombre: 'dirección', unidad: '' };
    tarjetaDe(f, 'lea-hex').exito = '$7123: los bits altos son el banco.';
    tarjetaDe(f, 'lea-hex').comprobar = [{ d_s: 28963 }];
    expect(generar(f).errores).toEqual([]);
    tarjetaDe(f, 'lea-hex').exito = '$7124: otra.';
    expect(generar(f).errores.join('\n')).toMatch(/el número \$7124 no está/);
  });
});
