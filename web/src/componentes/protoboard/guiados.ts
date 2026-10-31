// The built-in circuits of «Monta este circuito» (0.11): five small classics, each as a CircuitoFuente
// (editor parts and the net of every pin), laid out by hand on the empty board (supply on the top rails, the
// rails bridged) in a clean left-to-right order a beginner can follow, or by the auto-placement when there
// is no hand layout; plus one sentence per part (from the book, with its section, when it has one) saying why
// it is there. Plain TypeScript, so the Node checks and the page share it.

import { analisisPorDefecto, type Componente } from '../editor/tipos.ts';
import { TIPO } from '../editor/catalogo.ts';
import { CABLE } from './colores.ts';
import { colocarCircuito } from './colocacion.ts';
import { piezaDe } from './edicion.ts';
import { montajeVacio } from './vacio.ts';
import type { CableProto, CircuitoFuente, DocumentoProtoboard, Pt } from './tipos.ts';

export interface CircuitoGuiado {
  id: string;
  titulo: string;
  /** One line under the title in the chooser. */
  resumen: string;
  /** What the user should see when it works (shown at the end, after simulating). */
  final: string;
  /** Why each part is there, by designator: a sentence of the book when there is one. */
  porQue: Record<string, string>;
  /** Builds the circuit (a fresh object each time). */
  circuito: () => CircuitoFuente;
  /** Simulation that proves it: an LED to light (designator) or a net whose voltage to report. */
  prueba: { led?: string; red?: string };
  /**
   * Hand layout on the empty board (supply V1 already there): the legs of each part (in the order of its
   * package's legs), the wires by a name of ours, and the order of the steps (designators and wire names).
   */
  montaje?: { piezas: Record<string, Pt[]>; cables: Record<string, [Pt, Pt]>; orden: string[] };
}

type Parte = [tipo: string, nombre: string, campos: Record<string, string>, redes: Record<string, string>];

function construir(titulo: string, partes: Parte[], tran?: { paso: string; fin: string }): CircuitoFuente {
  const componentes: Componente[] = [];
  const redes: Record<string, string> = {};
  const posiciones: Record<string, Pt> = {};
  partes.forEach(([tipo, nombre, campos, nets], i) => {
    const t = TIPO.get(tipo);
    const id = `g${i + 1}`;
    componentes.push({ id, tipo, nombre, x: i * 40, y: 0, o: t?.o ?? 0, campos: { ...(t?.inicial ?? {}), ...campos } });
    for (const [pin, red] of Object.entries(nets)) redes[`${id}.${pin}`] = red;
    posiciones[id] = [i * 40, 0];
  });
  const analisis = analisisPorDefecto();
  if (tran) analisis.tran = { activo: true, paso: tran.paso, fin: tran.fin, inicio: '0', uic: false };
  return { titulo, componentes, redes, directivas: '', analisis, posiciones, origen: { tipo: 'propio' } };
}

// Supply: the editor's V has «end» = + and «start» = −.
const fuente = (v: string): Parte => ['V', 'V1', { forma: 'dc', dc: v }, { end: 'vcc', start: '0' }];

const LLEVA_MAS = 'Un cable une dos tiras: este lleva el + de la fuente (carril rojo) a la tira de la columna donde empieza el circuito.';
const CIERRA = 'Este cable cierra el circuito: lleva su último punto al carril azul (−), la masa de la fuente. Sin él no circula corriente.';

export const GUIADOS: CircuitoGuiado[] = [
  {
    id: 'led',
    titulo: 'LED y resistencia',
    resumen: 'El primer circuito: una resistencia limita la corriente de un LED.',
    final: 'El LED se enciende: por él circulan unos 9 mA.',
    porQue: {
      'c+': LLEVA_MAS,
      R1: '«El LED se gobierna por corriente: una resistencia en serie la limita» (sección 45.2). Con 5 V y unos 2 V en el LED quedan 3 V en 330 Ω: unos 9 mA.',
      D1: 'Un LED solo conduce en un sentido: la pata larga (ánodo, +) va en la tira de la resistencia y la corta (cátodo, lado plano) hacia masa.',
      'c−': CIERRA,
    },
    circuito: () =>
      construir('LED y resistencia', [fuente('5'), ['R', 'R1', { valor: '330' }, { start: 'vcc', end: 'a' }], ['LED', 'D1', { modelo: 'LEDR' }, { start: 'a', end: '0' }]]),
    prueba: { led: 'D1' },
    montaje: {
      piezas: { R1: [[10, 5], [14, 5]], D1: [[14, 7], [15, 7]] },
      cables: { 'c+': [[10, 3], [10, 0]], 'c−': [[15, 3], [15, 1]] },
      orden: ['c+', 'R1', 'D1', 'c−'],
    },
  },
  {
    id: 'divisor',
    titulo: 'Divisor de tensión',
    resumen: 'Dos resistencias en serie se reparten la tensión de la fuente.',
    final: 'En el punto medio (la columna 14) hay 4,5 V, la mitad de los 9 V: tóquelo para verlo.',
    porQue: {
      'c+': LLEVA_MAS,
      R1: '«El divisor de tensión es la consecuencia inmediata: como la corriente es común, la tensión se reparte en proporción a las resistencias» (sección 1.4).',
      R2: 'La salida es la tensión de R2: V·R2/(R1 + R2). Con dos de 10 kΩ, la mitad de la fuente. La tira de la columna 14 es el punto medio.',
      'c−': CIERRA,
    },
    circuito: () =>
      construir('Divisor de tensión', [fuente('9'), ['R', 'R1', { valor: '10k' }, { start: 'vcc', end: 'out' }], ['R', 'R2', { valor: '10k' }, { start: 'out', end: '0' }]]),
    prueba: { red: 'out' },
    montaje: {
      piezas: { R1: [[10, 5], [14, 5]], R2: [[14, 7], [18, 7]] },
      cables: { 'c+': [[10, 3], [10, 0]], 'c−': [[18, 3], [18, 1]] },
      orden: ['c+', 'R1', 'R2', 'c−'],
    },
  },
  {
    id: 'pulsador',
    titulo: 'LED con pulsador',
    resumen: 'Un pulsador abre y cierra el circuito del LED.',
    final: 'Con el pulsador apretado el circuito se cierra y el LED se enciende; al soltarlo (dos toques más) se apaga.',
    porQue: {
      'c+': LLEVA_MAS,
      S1: 'El pulsador cierra el circuito solo mientras se aprieta: une la tira de su pata 1 con la de su pata 2.',
      R1: '«El LED se gobierna por corriente: una resistencia en serie la limita» (sección 45.2).',
      D1: 'La pata larga del LED (ánodo) en la tira de la resistencia; la corta (cátodo), hacia masa.',
      'c−': CIERRA,
    },
    circuito: () =>
      construir('LED con pulsador', [
        fuente('5'),
        ['PULNA', 'S1', { pulsado: 'no' }, { start: 'vcc', end: 'b' }],
        ['R', 'R1', { valor: '330' }, { start: 'b', end: 'a' }],
        ['LED', 'D1', { modelo: 'LEDV' }, { start: 'a', end: '0' }],
      ]),
    prueba: { led: 'D1' },
    montaje: {
      piezas: { S1: [[8, 6], [9, 6], [10, 6]], R1: [[10, 4], [14, 4]], D1: [[14, 6], [15, 6]] },
      cables: { 'c+': [[8, 3], [8, 0]], 'c−': [[15, 3], [15, 1]] },
      orden: ['c+', 'S1', 'R1', 'D1', 'c−'],
    },
  },
  {
    id: 'transistor',
    titulo: 'Transistor como interruptor',
    resumen: 'Una corriente pequeña en la base enciende un LED en el colector.',
    final: 'Con el pulsador apretado entra una corriente pequeña por la base y el transistor deja pasar la del LED, mucho mayor.',
    porQue: {
      'c+': LLEVA_MAS,
      S1: 'El pulsador lleva la tensión a la base: es la «orden» de encender, como la salida de un microcontrolador.',
      R2: 'La resistencia de base fija la corriente de base: con 10 kΩ, unos 0,4 mA, de sobra para saturar el transistor («Cuánta corriente de base: la saturación forzada», sección 6.7).',
      Q1: 'Como interruptor, el transistor pasa de corte a saturación (sección 6.7). El 2N3904 tiene, con la cara plana delante, emisor, base y colector: la base en la tira de R2.',
      'cE': 'El emisor va a masa: la corriente del LED baja por el colector y sale por el emisor.',
      R1: 'La resistencia del colector, desde el carril +, limita la corriente del LED cuando el transistor conduce.',
      D1: 'El LED, entre la resistencia y el colector: la pata larga (ánodo) hacia la resistencia, la corta hacia el colector.',
    },
    circuito: () =>
      construir('Transistor como interruptor', [
        fuente('5'),
        ['PULNA', 'S1', { pulsado: 'no' }, { start: 'vcc', end: 'in' }],
        ['R', 'R2', { valor: '10k' }, { start: 'in', end: 'b' }],
        ['QN', 'Q1', { modelo: 'Q2N3904' }, { collector: 'c', base: 'b', emitter: '0' }],
        ['R', 'R1', { valor: '330' }, { start: 'vcc', end: 'k' }],
        ['LED', 'D1', { modelo: 'LEDR' }, { start: 'k', end: 'c' }],
      ]),
    prueba: { led: 'D1' },
    montaje: {
      piezas: {
        S1: [[4, 6], [5, 6], [6, 6]],
        R2: [[6, 4], [10, 4]],
        Q1: [[9, 6], [10, 6], [11, 6]],
        R1: [[14, 0], [14, 3]],
        D1: [[14, 4], [11, 4]],
      },
      cables: { 'c+': [[4, 3], [4, 0]], cE: [[9, 3], [9, 1]] },
      orden: ['c+', 'S1', 'R2', 'Q1', 'cE', 'R1', 'D1'],
    },
  },
  {
    id: '555',
    titulo: '555 astable',
    resumen: 'El clásico intermitente: un 555 hace parpadear un LED.',
    final: 'La salida del 555 sube y baja unas siete veces por segundo: el LED parpadea (véalo en «Resultados»).',
    porQue: {
      U1: '«En modo astable, el 555 genera una señal cuadrada continua» (sección 8.5). Va a caballo del canal central: cada patilla en su tira.',
      RA: '«El condensador se carga desde la alimentación a través de Ra + Rb» (sección 8.5).',
      RB: '«El condensador se carga a través de Ra y Rb, y se descarga a través de Rb, lo que define los tiempos en alto y en bajo» (sección 8.5).',
      C1: 'El condensador temporizador: con Ra = 1 kΩ, Rb = 10 kΩ y 10 µF, f ≈ 1,44 / ((Ra + 2Rb)·C) ≈ 7 Hz. Es electrolítico: la franja (−) hacia masa.',
      C2: 'El condensador de la patilla de control la protege del ruido: no cambia los umbrales.',
      R1: 'La resistencia limita la corriente que la salida del 555 da al LED.',
      D1: 'El LED se enciende cada vez que la salida está en alto.',
    },
    circuito: () =>
      construir(
        '555 astable',
        [
          fuente('9'),
          ['T555', 'U1', { modelo: 'ne555' }, { trig: 'thr', thres: 'thr', reset: 'vcc', vcc: 'vcc', gnd: '0', out: 'out', dis: 'dis', ctrl: 'ctl' }],
          ['R', 'RA', { valor: '1k' }, { start: 'vcc', end: 'dis' }],
          ['R', 'RB', { valor: '10k' }, { start: 'dis', end: 'thr' }],
          ['C', 'C1', { valor: '10µ' }, { start: 'thr', end: '0' }],
          ['C', 'C2', { valor: '10n' }, { start: 'ctl', end: '0' }],
          ['R', 'R1', { valor: '470' }, { start: 'out', end: 'led' }],
          ['LED', 'D1', { modelo: 'LEDR' }, { start: 'led', end: '0' }],
        ],
        { paso: '1m', fin: '1.5' },
      ),
    // (the operating point of an astable is not an oscillation: the transient run proves it)
    prueba: {},
  },
];

export const GUIADO = new Map(GUIADOS.map((g) => [g.id, g]));

/**
 * The finished board of a built-in circuit: its hand layout on the empty board, or the auto-placement.
 * `original` says the net of every pin, so the checks compare the board with the schematic; the wires carry
 * the step name in their id («g:c+»).
 */
export function objetivoGuiado(g: CircuitoGuiado): DocumentoProtoboard {
  const c = g.circuito();
  if (!g.montaje) {
    const d = colocarCircuito(c).doc;
    d.titulo = g.titulo;
    return d;
  }
  const v = c.componentes.find((x) => x.tipo === 'V')!;
  const doc = montajeVacio(g.titulo, v.campos['dc'] ?? '5');
  doc.analisis = c.analisis;
  doc.directivas = c.directivas;
  const original: Record<string, string> = { 'v1.end': c.redes[`${v.id}.end`] ?? 'vcc', 'v1.start': c.redes[`${v.id}.start`] ?? '0' };
  for (const comp of c.componentes) {
    if (comp === v) continue;
    const pos = g.montaje.piezas[comp.nombre];
    if (!pos) throw new Error(`Falta la posición de ${comp.nombre}`);
    const p = piezaDe(doc, comp, pos);
    if (!p) throw new Error(`No hay pieza para ${comp.nombre}`);
    doc.piezas.push(p);
    for (const [k, red] of Object.entries(c.redes)) if (k.startsWith(`${comp.id}.`)) original[k] = red;
  }
  for (const [nombre, [a, b]] of Object.entries(g.montaje.cables)) {
    const w: CableProto = { id: `g:${nombre}`, a, b, color: nombre.endsWith('+') ? CABLE.rojo : nombre.endsWith('−') || nombre === 'cE' ? CABLE.negro : CABLE.amarillo };
    doc.cables.push(w);
  }
  doc.original = original;
  return doc;
}
