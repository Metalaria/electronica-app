// 1.3 (motor13b) «Monte este circuito en la protoboard» (GUIA §13.14) in Node, on the catalogue lesson
// tests/lecciones12-catalogo/cap02/sec-2.7.yaml (the divider, guided, with its measure; the LED, free; the RC with an
// electrolytic, guided): the generator (the schematic's netlist folded for a real board, placed automatically and
// checked, each rule broken on purpose, the measure checked on the placed board by ngspice), the diagnosis of a board
// (a part missing, a node split, two nodes joined, a LED and an electrolytic the wrong way round, a resistor either way),
// the electrical check with the app's ngspice (the board against the schematic, node by node; a value changed on the
// board), the verdict and how it counts (doing; practised in the review).
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config> tests/lecciones13b-montar-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import { comprobar, esPracticable, nuevoEstado, puedeComprobar } from '../src/lib/leccion11/motor.ts';
import { compilarModelo } from '../src/lib/leccion11/modelo.ts';
import { textoPlano } from '../src/lib/leccion11/texto.ts';
import type { Leccion11, Tarjeta } from '../src/lib/leccion11/tipos.ts';
import { claseTarjeta, mezclaDe } from '../src/lib/leccion12/hacer/generar-hacer.ts';
import { designadorDeSimbolo, numeroSpice, plegarNetlist } from '../src/lib/leccion12/montar/generar-montar.ts';
import { compararTensiones, comprobarMontar, diagnosticarMontaje, lecturaMedir, placaInicial, placaVacia } from '../src/lib/leccion12/montar/motor-montar.ts';
import type { EstadoMontar, Montar } from '../src/lib/leccion12/montar/tipos.ts';
import { conexiones, conductorEn, netlistProtoboard } from '../src/componentes/protoboard/conexiones.ts';
import { agujero } from '../src/componentes/protoboard/placa.ts';
import { leerPuntoTrabajo, netlistPuntoTrabajo } from '../src/componentes/protoboard/simulacion.ts';
import type { DocumentoProtoboard, Pieza } from '../src/componentes/protoboard/tipos.ts';
import { valorCarta } from '../src/componentes/protoboard/bandeja.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { motor } from '../scripts/libro-node.mjs';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { recursosLibro } from '../scripts/recursos11.mjs';
import { objetivoCumplido } from '../src/lib/leccion12/hacer/motor-hacer.ts';
import { variablesWidget12 } from '../src/lib/leccion12/digital/objetivo-figura.ts';
import type { WidgetAveriaPlaca } from '../src/lib/leccion12/averia-placa.ts';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
};
const FUENTE = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap02', 'sec-2.7.yaml'), 'utf8'));
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type F = { modelo: any; tarjetas: Record<string, any>[] };
const tarjetaDe = (f: F, id: string) => f.tarjetas.find((t) => t.id === id)!;
const generar = (f: unknown) => generarLeccion(f, contexto, 'catalogo-motor13b');
function errores(cambio: (f: F) => void): string {
  const f = copia(FUENTE) as F;
  cambio(f);
  return generar(f).errores.join('\n');
}
const R = generar(FUENTE);
const L = R.leccion as Leccion11;
const T = (id: string) => L.tarjetas.find((t) => t.id === id)!;
const A = (id: string) => T(id).actividad as Montar;
const mc = compilarModelo(L.modelo);

// ------------------------------------------------------------------ board helpers (as the reader's fingers would)

const pieza = (d: DocumentoProtoboard, nombre: string) => d.piezas.find((p) => p.comp.nombre === nombre)!;
const ocupados = (d: DocumentoProtoboard) => new Set([...d.piezas.flatMap((p) => p.pos), ...d.cables.flatMap((w) => [w.a, w.b])].map((q) => `${q[0]},${q[1]}`));
/** A free hole of the same strip or rail as `q` (nearby, along its row or its column). */
function libreEnTira(d: DocumentoProtoboard, q: [number, number]): [number, number] {
  const c = conductorEn(d, q[0], q[1]);
  const o = ocupados(d);
  for (let r = 1; r <= 8; r++)
    for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0]] as const) {
      const x: [number, number] = [q[0] + dx, q[1] + dy];
      if (!o.has(`${x[0]},${x[1]}`) && conductorEn(d, x[0], x[1]) === c) return x;
    }
  throw new Error(`sin hueco libre en la tira de ${q}`);
}
/** A free hole on a strip nothing else uses, `dx` columns away. */
function libreLejos(d: DocumentoProtoboard, q: [number, number], dx: number): [number, number] {
  const usados = new Set([...d.piezas.flatMap((p) => p.pos), ...d.cables.flatMap((w) => [w.a, w.b])].map((x) => conductorEn(d, x[0], x[1])));
  for (let k = dx; k < dx + 20; k++) {
    const r: [number, number] = [q[0] + k, q[1]];
    const a = agujero({ placas: d.placas, columnas: d.columnas }, r[0], r[1]);
    if (a && a.tipo !== 'riel' && !usados.has(conductorEn(d, r[0], r[1]))) return r;
  }
  throw new Error('sin tira libre');
}
const invertir = (p: Pieza) => (p.pos = [...p.pos].reverse());
const tipos = (a: Montar, d: DocumentoProtoboard) => diagnosticarMontaje(a, d).map((x) => x.tipo);

// ------------------------------------------------------------------ the generator

test.describe('generador de «montar»', () => {
  test('el catálogo se genera; las tres tarjetas cuentan como «haciendo» y se practican en el repaso', () => {
    expect(R.errores).toEqual([]);
    for (const id of ['monte-divisor', 'monte-led', 'monte-rc']) {
      expect(T(id).actividad?.tipo, id).toBe('montar');
      expect(claseTarjeta(T(id)), id).toBe('hacer');
      expect(esPracticable(T(id)), id).toBe(true);
    }
    expect(A('monte-divisor').ayuda).toBe('guiada');
    expect(A('monte-led').ayuda).toBe('libre');
    expect(mezclaDe(L.tarjetas).hacer).toBeGreaterThanOrEqual(4);
  });

  test('la netlist se pliega para una placa real: los medidores de 0 V son cables y la carga abierta no está', () => {
    const p = plegarNetlist(['VF fte 0 DC 12', 'VMED fte ent 0', 'R1 ent salida 7000.000000', 'VABAJO salida b 0', 'R2 b 0 5000', 'VCARGA salida c 0', 'RL c 0 1e15', 'VREVES zrev 0 DC 2'], new Set(['fte', 'salida', '0']), new Set(['vmed', 'vabajo', 'vcarga']));
    expect(p.errores).toEqual([]);
    expect(p.lineas).toEqual(['VF fte 0 DC 12', 'R1 fte salida 7k', 'R2 salida 0 5k']);
    expect(p.nodo.get('ent')).toBe('fte');
    expect(p.nodo.get('b')).toBe('salida');
    expect(numeroSpice('0.0001')).toBe('100u');
    expect(numeroSpice('4700')).toBe('4.7k');
    // (a supply at 0 V, an alternating source, a part the tray has not)
    expect(plegarNetlist(['VF fte 0 DC 0', 'R1 fte 0 1k'], new Set()).errores.join()).toMatch(/está a 0 V/);
    expect(plegarNetlist(['VF fte 0 SIN(0 1 50)', 'R1 fte 0 1k'], new Set()).errores.join()).toMatch(/no es una fuente de continua/);
    expect(plegarNetlist(['VF fte 0 DC 5', 'XU1 fte 0 opamp'], new Set()).errores.join()).toMatch(/no es una pieza que se pueda montar/);
  });

  test('la actividad: la colocación automática limpia, los nombres neutros de los nudos y la medida', () => {
    const a = A('monte-divisor');
    expect(a.redes).toEqual({ '0': 'Masa, abajo', fte: 'Arriba de la fuente', salida: 'Salida, entre las dos resistencias' });
    expect(a.netlist).toMatch(/R1 fte salida 7k\nR2 salida 0 5k/);
    expect(a.medir).toMatchObject({ entre: ['salida', '0'], valor: 'V_out', unidad: 'V', tol: 0.02 });
    expect(Object.keys(a.porque)).toEqual(['salida']);
    expect(diagnosticarMontaje(a, a.objetivo)).toEqual([]);
    expect(diagnosticarMontaje(A('monte-led'), A('monte-led').objetivo)).toEqual([]);
    expect(diagnosticarMontaje(A('monte-rc'), A('monte-rc').objetivo)).toEqual([]);
    // (1.3, cierre13: named as the card's drawing names them, «R» and «C», not as the netlist, R1 and C1)
    expect(A('monte-rc').objetivo.piezas.find((p) => p.comp.nombre === 'C')!.enc).toBe('electrolitico');
    // the measure goes to the script's ngspice, on the placed board's own netlist
    const s = R.spice.find((x) => /montar\.medir/.test(x.donde))!;
    expect(s.netlist).toMatch(/R1 fte salida 7k/);
    expect(s.valores).toEqual([{ medida: 'v(salida)', esperado: 5, tol: 0.1 }]);
  });

  const reglas: [string, (f: F) => void, RegExp][] = [
    ['una clave desconocida', (f) => (tarjetaDe(f, 'monte-led').montar.color = 'rojo'), /«montar.color»: clave desconocida/],
    ['una ayuda que no existe', (f) => (tarjetaDe(f, 'monte-led').montar.ayuda = 'mucha'), /«montar.ayuda»: guiada .* o libre/],
    ['sin widget circuito', (f) => delete tarjetaDe(f, 'monte-led').widget, /«montar»: la tarjeta lleva un widget «circuito»/],
    ['la medida en un nodo que no existe', (f) => (tarjetaDe(f, 'monte-divisor').montar.medir.entre = ['arriba', '0']), /«montar.medir.entre»: «arriba» no es un nodo del esquema/],
    ['la medida con un valor fuera del modelo', (f) => (tarjetaDe(f, 'monte-divisor').montar.medir.valor = 'V_x'), /«montar.medir.valor»: un valor del modelo/],
    ['las dos puntas en el mismo nudo del montaje', (f) => (tarjetaDe(f, 'monte-divisor').montar.medir.entre = ['fte', 'fte']), /las dos puntas en el mismo nodo del montaje/],
    ['un «porque» de un nudo que no existe', (f) => (tarjetaDe(f, 'monte-divisor').montar.porque = { zz: 'x' }), /«montar.porque.zz»: no es un nodo del esquema montado/],
    ['la fuente a 0 V', (f) => (tarjetaDe(f, 'monte-divisor').fijar = { R_2: 5000, V_in: 0 }), /la fuente «VF» está a 0 V/],
    ['sin «exito»', (f) => delete tarjetaDe(f, 'monte-led').exito, /exito/],
  ];
  for (const [nombre, cambio, error] of reglas)
    test(`error: ${nombre}`, () => {
      expect(errores(cambio)).toMatch(error);
    });
});

// ------------------------------------------------------------------ the diagnosis

test.describe('diagnóstico de la placa', () => {
  test('la placa de partida: solo la fuente; vacía, sin nada que comprobar', () => {
    const a = A('monte-divisor');
    const d = placaInicial(a);
    expect(placaVacia(d)).toBe(true);
    expect(d.piezas.map((p) => p.comp.nombre)).toEqual(['VF']);
    expect(tipos(a, d)).toEqual(['falta', 'falta']);
  });

  test('una pieza que falta va primero', () => {
    const a = A('monte-divisor');
    const d = copia(a.objetivo);
    d.piezas = d.piezas.filter((p) => p.comp.nombre !== 'R2');
    const ps = diagnosticarMontaje(a, d);
    expect(ps[0]).toMatchObject({ tipo: 'falta', texto: 'Falta la resistencia R2: llévelo de la bandeja a la placa.' });
  });

  test('una red partida: una pata de R2 en una tira que nada une; con el «porque» del autor', () => {
    const a = A('monte-divisor');
    const d = copia(a.objetivo);
    const r2 = pieza(d, 'R2');
    const k = r2.patas.findIndex((pin) => a.objetivo.original![`${r2.id}.${pin}`] === 'salida');
    r2.pos[k] = libreLejos(d, r2.pos[k]!, 6);
    const ps = diagnosticarMontaje(a, d);
    expect(ps.map((x) => x.tipo)).toEqual(['partida']);
    expect(ps[0]!.texto).toMatch(/^«Salida, entre las dos resistencias» no está unido: R\d y R\d quedan en tiras distintas/);
    const t = T('monte-divisor');
    const v = comprobarMontar(t, a, { tipo: 'montar', doc: d, diagnostico: { version: 1, vacia: false, problemas: ps, simulado: 'no' } });
    expect(v.bien).toBe(false);
    expect(v.textos.map((x) => textoPlano(x))).toEqual([ps[0]!.texto, 'La salida es el punto común de R₁ y R₂: las dos tienen que tocar la misma tira.']);
  });

  test('dos redes unidas: un cable de más a través de R1', () => {
    const a = A('monte-divisor');
    const d = copia(a.objetivo);
    const r1 = pieza(d, 'R1');
    d.cables.push({ id: 'w-corto', a: libreEnTira(d, r1.pos[0]!), b: libreEnTira(d, r1.pos[1]!), color: '#c00' });
    const ps = diagnosticarMontaje(a, d);
    expect(ps.map((x) => x.tipo)).toEqual(['unidas']);
    expect(ps[0]!.texto).toMatch(/^«Arriba de la fuente» y «Salida, entre las dos resistencias» quedan unidos en su placa/);
  });

  test('una resistencia vale de cualquier lado; un LED y un electrolítico al revés se dicen (y no cuentan dos veces)', () => {
    const div = A('monte-divisor');
    const d1 = copia(div.objetivo);
    invertir(pieza(d1, 'R1'));
    invertir(pieza(d1, 'R2'));
    expect(diagnosticarMontaje(div, d1)).toEqual([]);
    const led = A('monte-led');
    const d2 = copia(led.objetivo);
    invertir(pieza(d2, 'D1'));
    const p2 = diagnosticarMontaje(led, d2);
    expect(p2.map((x) => x.tipo)).toEqual(['reves']);
    expect(p2[0]!.texto).toBe('El LED D1 está al revés: su pata larga (A, ánodo) va hacia «Entre la resistencia y el LED» y la corta (K) hacia «Masa, abajo». Al revés no conduce ni se enciende.');
    const rc = A('monte-rc');
    const d3 = copia(rc.objetivo);
    invertir(pieza(d3, 'C'));
    const p3 = diagnosticarMontaje(rc, d3);
    expect(p3.map((x) => x.tipo)).toEqual(['reves']);
    expect(p3[0]!.texto).toMatch(/^El electrolítico C está al revés: su pata \+ va hacia «Entre la resistencia y el condensador»/);
  });

  test('el primero, y cuántos quedan', () => {
    const a = A('monte-divisor');
    const d = copia(a.objetivo);
    d.piezas = d.piezas.filter((p) => p.comp.nombre !== 'R2');
    const r1 = pieza(d, 'R1');
    d.cables.push({ id: 'w-corto', a: libreEnTira(d, r1.pos[0]!), b: libreEnTira(d, r1.pos[1]!), color: '#c00' });
    const ps = diagnosticarMontaje(a, d);
    expect(ps.map((x) => x.tipo)).toEqual(['falta', 'unidas']);
    const v = comprobarMontar(T('monte-divisor'), a, { tipo: 'montar', doc: d, diagnostico: { version: 1, vacia: false, problemas: ps, simulado: 'no' } });
    expect(v.textos.map((x) => textoPlano(x))).toEqual([ps[0]!.texto, 'Después queda otra cosa por arreglar.']);
  });
});

// ------------------------------------------------------------------ the tray's names, as the lesson's drawing

// 1.3 (cierre13): the drawing labels each part with the symbol of the model's quantity it is bound to; the tray, the
// guide and the diagnosis used the schematic netlist's own names instead (in cap08/sec-8.2 the tray's «R1» was the
// drawing's R₂ of 9,1 kΩ). Now a resistor, capacitor or coil takes the drawing's name when it is a designator.
test.describe('las piezas de la bandeja se llaman como en el dibujo de la lección', () => {
  test('el símbolo como designador: R₂ → R2, R_L → RL, C → C; lo que no lo es, nada', () => {
    expect(designadorDeSimbolo([{ t: 'txt', s: 'R₂' }], 'R')).toBe('R2');
    expect(designadorDeSimbolo([{ t: 'txt', s: 'R' }, { t: 'sub', s: 'L' }], 'R')).toBe('RL');
    expect(designadorDeSimbolo([{ t: 'txt', s: 'C' }], 'C')).toBe('C');
    expect(designadorDeSimbolo([{ t: 'txt', s: 'τ' }], 'R')).toBeNull();
    expect(designadorDeSimbolo([{ t: 'txt', s: 'C₁' }], 'R')).toBeNull();
    expect(designadorDeSimbolo([{ t: 'txt', s: 'R' }, { t: 'val', id: 'R_1' }], 'R')).toBeNull();
  });
  const publicada = (id: string) => JSON.parse(fs.readFileSync(path.join(web, 'public', 'libro', 'lecciones11', `${id}.json`), 'utf8')) as Leccion11;
  const MONTAR: [string, string, Record<string, string | undefined>][] = [
    // (the divider of the non-inverting amplifier: R₂ = 9,1 kΩ on top, from the output; R₁ = 1 kΩ to ground)
    ['cap08/sec-8.2', 'monte-realimentacion', { R2: '9,1k', R1: '1k' }],
    ['cap02/sec-2.7', 'monte-12-a-5', { R1: '4,7k', R2: '3,3k' }],
    ['cap03/sec-3.2', 'monte-carga', { R: '10k', C: '100µ' }],
    ['cap05/sec-5.5', 'monte-azul', { R: '470', D1: undefined }],
  ];
  for (const [id, tarjeta, esperado] of MONTAR)
    test(`${id} «${tarjeta}»: la bandeja dice lo que el dibujo`, () => {
      const l = publicada(id);
      const t = l.tarjetas.find((x) => x.id === tarjeta)!;
      const a = t.actividad as Montar;
      const enPlaca = a.objetivo.piezas.filter((p) => p.enc !== 'alimentacion');
      expect(Object.fromEntries(enPlaca.map((p) => [p.comp.nombre, p.comp.campos['valor']]))).toEqual(esperado);
      // every resistor and capacitor is named by a symbol the drawing shows (a piece of the card's widget)
      const w = t.widget as { piezas: Record<string, string> };
      const simbolos = new Set(Object.values(w.piezas).map((m) => (l.modelo.valores[m] ?? l.modelo.calculos[m])?.sim).filter(Boolean).map((s) => designadorDeSimbolo(s!, 'R') ?? designadorDeSimbolo(s!, 'C')));
      for (const p of enPlaca.filter((x) => /^[RC]/.test(x.comp.nombre))) expect(simbolos.has(p.comp.nombre), `${id}: ${p.comp.nombre}`).toBe(true);
      // and the diagnosis says it so: the top resistor missing in 8.2 is «R2»
      if (id === 'cap08/sec-8.2') {
        const d = copia(a.objetivo);
        d.piezas = d.piezas.filter((p) => p.comp.campos['valor'] !== '9,1k');
        expect(diagnosticarMontaje(a, d)[0]!.texto).toMatch(/^Falta .*\bR2\b/);
      }
    });
});

// ------------------------------------------------------------------ the electrical check and the verdict

test.describe('con el ngspice de la app', () => {
  test('la placa montada da en cada nudo lo que el esquema; un valor cambiado en la placa se nota', async () => {
    const simular = await motor();
    const op = async (texto: string) => leerPuntoTrabajo(await simular(texto))!.v;
    for (const id of ['monte-divisor', 'monte-led', 'monte-rc']) {
      const a = A(id);
      const esquema = await op(a.netlist);
      const placa = await op(netlistPuntoTrabajo(netlistProtoboard(a.objetivo).texto, []));
      const c = compararTensiones(a, placa, esquema);
      expect(c.problemas, id).toEqual([]);
      expect(Object.keys(c.tensiones).length, id).toBeGreaterThanOrEqual(1);
    }
    // the divider's measure, and R2 changed on the board: the topology is right, the voltages are not
    const a = A('monte-divisor');
    const esquema = await op(a.netlist);
    expect(lecturaMedir(a, esquema)).toBeCloseTo(mc.evaluar({ ...L.tarjetas.find((t) => t.id === 'monte-divisor')!.fijar }).V_out!, 6);
    const d = copia(a.objetivo);
    pieza(d, 'R2').comp.campos['valor'] = '10k';
    expect(diagnosticarMontaje(a, d)).toEqual([]);
    const c = compararTensiones(a, await op(netlistPuntoTrabajo(netlistProtoboard(d).texto, [])), esquema);
    expect(c.problemas.map((x) => x.texto.replace(/\s/g, ' '))).toEqual(['En «Salida, entre las dos resistencias» su montaje da 7,06 V y el esquema 5,00 V: algo no está como en el esquema.']);
  });

  test('el veredicto por el motor de la lección: «Comprobar» solo con la placa diagnosticada; bien, con la lectura', () => {
    const t = T('monte-divisor') as Tarjeta;
    const e = nuevoEstado(t);
    expect(e.actividad).toEqual({ tipo: 'montar', doc: null, diagnostico: null });
    expect(puedeComprobar(t, e)).toBe(false);
    const a = A('monte-divisor');
    const pendiente: EstadoMontar = { tipo: 'montar', doc: a.objetivo, diagnostico: { version: 3, vacia: false, problemas: [], simulado: 'pendiente' } };
    expect(puedeComprobar(t, { ...e, actividad: pendiente })).toBe(false);
    const listo: EstadoMontar = { ...pendiente, diagnostico: { version: 3, vacia: false, problemas: [], simulado: 'si', tensiones: {}, lectura: 5 } };
    expect(puedeComprobar(t, { ...e, actividad: listo })).toBe(true);
    const r = comprobar(L, t, { ...e, actividad: listo }, { ...mc.evaluar({}), ...t.fijar });
    expect(r.aviso.bien).toBe(true);
    const textos = r.aviso.textos.map((x) => textoPlano(x));
    expect(textos.join(' | ')).toContain('Salida del divisor: el multímetro marca 5,00 V.');
    expect(textos.join(' | ')).toContain('Su divisor da {V_out} a la salida, como el esquema.');
    // (the simulator could not run: the topology decides, and it says so)
    const sinSim = comprobarMontar(t, a, { ...listo, diagnostico: { ...listo.diagnostico!, simulado: 'fallo', lectura: undefined } });
    expect(sinSim.bien).toBe(true);
    expect(textoPlano(sinSim.textos[0]!)).toMatch(/El simulador no ha podido comprobar las tensiones aquí/);
    // (and the board before anything was put: not checkable)
    const vacia = conexiones(placaInicial(a));
    expect(vacia.redes.length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ «averia-placa» (petición de averias13)

test.describe('widget «averia-placa»: la avería en la placa de una consola', () => {
  const conRecursos: ContextoLibro = { ...contexto, recursos: recursosLibro(path.join(web, 'public', 'libro'), path.join(web, 'public')) };
  const generarR = (f: unknown) => generarLeccion(f, conRecursos, 'catalogo-motor13b');
  test('la tarjeta del catálogo: el widget, el objetivo «encontrada» y cuenta como «haciendo»', () => {
    const r = generarR(FUENTE);
    expect(r.errores).toEqual([]);
    expect(r.avisos.filter((a) => /widget.averia/.test(a))).toEqual([]);
    const t = (r.leccion as Leccion11).tarjetas.find((x) => x.id === 'averia-snes')!;
    expect(t.widget as unknown as WidgetAveriaPlaca).toEqual({ tipo: 'averia-placa', maquina: 'snes', definicion: 'snes-no-enciende', averia: 'fusible-abierto', vista: 'foto', mandos: [], ocultar: false });
    expect(t.objetivo!.condiciones.map((c) => [c.valor, c.min])).toEqual([['averia:encontrada', 1]]);
    expect(claseTarjeta(t)).toBe('hacer');
    // the shell's variables: not found, then found
    const base = { zona: null, niveles: {}, logica: null, pulsos: 0, tramo: 0 };
    expect(objetivoCumplido(t, { ...variablesWidget12(t, base) })).toBe(false);
    expect(objetivoCumplido(t, { ...variablesWidget12(t, { ...base, encontrada: true }) })).toBe(true);
  });
  const reglas: [string, (f: F) => void, RegExp][] = [
    ['una consola sin averías en la placa', (f) => (tarjetaDe(f, 'averia-snes').widget.maquina = 'gb'), /«widget.maquina»: «gb» no tiene averías en la placa/],
    ['una avería que no es de la tarjeta de la lección', (f) => (tarjetaDe(f, 'averia-snes').widget.averia = 'condensador'), /«widget.averia»: «condensador» no es una avería de la tarjeta averia-no-enciende de consola-snes\/snes-averias \(fusible-abierto, regulador-muerto, adaptador-muerto\)/],
    ['una definición de otra consola', (f) => (tarjetaDe(f, 'averia-snes').widget.definicion = 'sms-no-enciende'), /«widget.definicion»: «sms-no-enciende» no es una avería de snes/],
    ['una vista que no existe', (f) => (tarjetaDe(f, 'averia-snes').widget.vista = 'rayos'), /«widget.vista»: foto o 3d/],
    ['una condición que no es «encontrada»', (f) => (tarjetaDe(f, 'averia-snes').objetivo.condiciones = [{ averia: 'medida', rotulo: 'x' }]), /«averia»: encontrada/],
    ['una condición del modelo en la placa', (f) => (tarjetaDe(f, 'averia-snes').objetivo.condiciones = [{ valor: 'V_out', min: 1, rotulo: 'x' }]), /clave desconocida «valor»|una condición de la placa/],
  ];
  for (const [nombre, cambio, error] of reglas)
    test(`error: ${nombre}`, () => {
      const f = copia(FUENTE) as F;
      cambio(f);
      expect(generarR(f).errores.join('\n')).toMatch(error);
    });
});

test('bandeja: el LED de una lección no se presenta como rojo', () => {
  const led = (modelo?: string) => ({ id: 'l', tipo: 'LED', nombre: '', x: 0, y: 0, o: 0, campos: modelo ? { modelo } : {} }) as Parameters<typeof valorCarta>[0];
  expect(valorCarta(led('LEDR'))).toBe('rojo, 3 mm');
  expect(valorCarta(led('LEDV'))).toBe('verde, 3 mm');
  expect(valorCarta(led())).toBe('rojo, 3 mm');
  // cap05/sec-5.5 «Monte el LED azul»: the lesson's model DLED has no colour of its own
  expect(valorCarta(led('DLED'))).toBe('LED, 3 mm');
});
