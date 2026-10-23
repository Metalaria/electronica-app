// The twelve practices of printed chapter 21 (cap22.typ, «Práctica 1 … 12»), as guided practices on the
// test bench: circuit (CIRCUITOS), instrument settings the book asks for, steps taken from the book, and the
// expected values the book gives (or that its companion netlists compute) to compare with what the virtual
// instruments read. Expected values were checked with this same engine (see README, «Instrumentos»).

import type { Practica } from './tipos';
import type { Banco } from '../banco.svelte.ts';
import { leerParametro } from '../../../simulador/motor/netlist.ts';
import {
  brymen,
  conGenerador,
  cursoresTension,
  deltaCursores,
  fftRelativo,
  fnirsiDmm,
  gananciaDb,
  generador,
  prm,
} from './lecturas';

const en = (b: Banco, variante: string | string[]) => (Array.isArray(variante) ? variante : [variante]).includes(b.variante);
const puntas = (b: Banco, rojo: string, negro: string) => b.bm.rojo === rojo && b.bm.negro === negro && !b.bm.serie;
const pos = (b: Banco, id: string) => b.brymen.posicion.id === id;
const formaDds = (b: Banco, forma: string, simetria?: number) =>
  b.fnirsi.dds.forma === forma && b.fnirsi.dds.salida && (simetria === undefined || b.fnirsi.dds.simetria === simetria);

/** Interpolated frequencies where a resonance curve crosses max/√2 (from noted points). */
function anchoBanda(filas: Record<string, number>[], x: string, y: string): { f0: number; f1: number; f2: number } | null {
  const p = filas.filter((r) => Number.isFinite(r[x]) && Number.isFinite(r[y])).sort((a, c) => a[x]! - c[x]!);
  if (p.length < 3) return null;
  let k = 0;
  for (let i = 1; i < p.length; i++) if (p[i]![y]! > p[k]![y]!) k = i;
  const lim = p[k]![y]! / Math.SQRT2;
  const cruce = (i: number, j: number) => {
    const a = p[i]!;
    const c = p[j]!;
    const t = (lim - a[y]!) / (c[y]! - a[y]!);
    return a[x]! + t * (c[x]! - a[x]!);
  };
  let f1: number | null = null;
  for (let i = k; i > 0; i--) if (p[i - 1]![y]! <= lim) {
    f1 = cruce(i - 1, i);
    break;
  }
  let f2: number | null = null;
  for (let i = k; i < p.length - 1; i++) if (p[i + 1]![y]! <= lim) {
    f2 = cruce(i, i + 1);
    break;
  }
  return f1 !== null && f2 !== null ? { f0: p[k]![x]!, f1, f2 } : null;
}

export const PRACTICAS: Practica[] = [
  // ------------------------------------------------------------------ 1
  {
    n: 1,
    label: 'sec-22.1',
    titulo: 'Ley de Ohm y divisor de tensión',
    objetivo: 'Comprobar el divisor y descubrir las tres lecciones de la práctica: la tolerancia importa, el instrumento carga y un divisor no alimenta nada.',
    variantes: [
      { id: 'p1', nombre: 'R1 = 10 kΩ, R2 = 4,7 kΩ', circuito: 'p1', figura: { num: '22.1', mapa: { N1: 'a', N2: 'out' } } },
      { id: 'p1_alta', nombre: 'R1 = R2 = 1 MΩ', circuito: 'p1_alta', figura: { num: '22.1', mapa: { N1: 'a', N2: 'out' } } },
      { id: 'p1_led', nombre: 'Con un LED en la salida', circuito: 'p1_led', dibujo: 'p1_led' },
    ],
    inicial: { variante: 'p1', alimentado: true, bm: { pos: 'vdc', sub: 0, borne: 'V', rojo: 'a', negro: '0' }, sondas: { ch1: null, ch2: null } },
    pasos: [
      { texto: '<strong>Medir la alimentación real</strong>: Brymen en V⎓, punta roja en el positivo de la fuente y negra en masa. «Una pila de 9 V nueva da 9,5 y usada da 8»: aquí la fuente es ideal.', aplicar: { variante: 'p1', bm: { pos: 'vdc', sub: 0, borne: 'V', rojo: 'a', negro: '0' } } },
      { texto: '<strong>Medir V<sub>out</sub></strong> en el punto medio. Calculado: 9 × 4 700 / 14 700 = 2,88 V. Compare la lectura con la incertidumbre del Brymen (±(0,02 % + 2 cuentas)).', aplicar: { bm: { rojo: 'out', negro: '0' } } },
      { texto: '<strong>Medir la corriente</strong>: selector en A mA, punta roja al borne mA µA y el multímetro <em>en serie</em>, abriendo el circuito entre la fuente y R1. Calculado: 9 / 14 700 = 0,61 mA.', aplicar: { bm: { pos: 'amA', sub: 0, borne: 'mA', serie: { elemento: 'R1', terminal: 0 } } } },
      { texto: '<strong>Impedancia de salida</strong>: devuelva la roja a VΩ, apague la alimentación (la fuente queda como un cortocircuito) y mida en Ω entre la salida y masa: se lee R1 ∥ R2, el Thévenin del divisor (3,2 kΩ).', aplicar: { alimentado: false, bm: { pos: 'ohm', sub: 0, borne: 'V', rojo: 'out', negro: '0' } } },
      { texto: '<strong>El instrumento carga</strong>: con R1 = R2 = 1 MΩ la salida teórica es 4,5 V… y sale menos, porque los 10 MΩ del multímetro quedan en paralelo con R2.', aplicar: { variante: 'p1_alta', alimentado: true, bm: { pos: 'vdc', sub: 0, borne: 'V', rojo: 'out', negro: '0' } } },
      { texto: '<strong>Un divisor no alimenta nada</strong>: con un LED rojo y su resistencia de 330 Ω en la salida, la tensión se hunde: el divisor tiene 3,2 kΩ de impedancia de salida.', aplicar: { variante: 'p1_led', bm: { pos: 'vdc', sub: 0, borne: 'V', rojo: 'out', negro: '0' } } },
    ],
    comprobaciones: [
      { id: 'vin', que: 'Alimentación', donde: 'Brymen V⎓, entre a y masa', esperado: 9, unidad: 'V', tol: { rel: 0.002 }, libro: 'fuente de 9 V', medir: (b) => (en(b, 'p1') && pos(b, 'vdc') && puntas(b, 'a', '0') ? brymen(b) : null) },
      { id: 'vout', que: 'V<sub>out</sub>', donde: 'Brymen V⎓, entre out y masa', esperado: 2.88, unidad: 'V', tol: { rel: 0.005 }, libro: 'V<sub>out</sub> = 9 × 4700/14700 = 2,88 V', medir: (b) => (en(b, 'p1') && b.alimentado && pos(b, 'vdc') && puntas(b, 'out', '0') ? brymen(b) : null) },
      { id: 'i', que: 'Corriente', donde: 'Brymen A mA en serie con R1', esperado: 0.61e-3, unidad: 'A', tol: { rel: 0.01 }, libro: 'la corriente es 9 / 14 700 = 0,61 mA', medir: (b) => (en(b, 'p1') && pos(b, 'amA') && b.bm.serie?.elemento === 'R1' ? brymen(b) : null) },
      { id: 'rth', que: 'Impedancia de salida', donde: 'Brymen Ω entre out y masa, sin alimentación', esperado: 3197, unidad: 'Ω', tol: { rel: 0.01 }, libro: 'R1 en paralelo con R2: 3,2 kΩ', medir: (b) => (en(b, 'p1') && !b.alimentado && pos(b, 'ohm') && puntas(b, 'out', '0') ? brymen(b) : null) },
      { id: 'alta', que: 'V<sub>out</sub> con 1 MΩ', donde: 'Brymen V⎓ entre out y masa', esperado: 4.29, unidad: 'V', tol: { rel: 0.005 }, libro: 'sale menos de 4,5 V: el 95,2 %, 4,29 V (netlist del libro)', medir: (b) => (en(b, 'p1_alta') && b.alimentado && pos(b, 'vdc') && puntas(b, 'out', '0') ? brymen(b) : null) },
      { id: 'led', que: 'V<sub>out</sub> con el LED', donde: 'Brymen V⎓ entre out y masa', esperado: 1.87, unidad: 'V', tol: { rel: 0.03 }, libro: 'la tensión se hunde (netlist del libro: unos 1,9 V)', medir: (b) => (en(b, 'p1_led') && pos(b, 'vdc') && puntas(b, 'out', '0') ? brymen(b) : null) },
    ],
    leccion: 'Si la diferencia es menor que la incertidumbre del multímetro, la ley de Ohm queda confirmada; si es mayor, la discrepancia es el resultado interesante, no el fallo.',
  },
  // ------------------------------------------------------------------ 2
  {
    n: 2,
    label: 'sec-22.2',
    titulo: 'Carga y descarga de un condensador (RC)',
    objetivo: 'Medir la constante de tiempo τ = R·C en la pantalla y descubrir que la sonda forma parte del circuito.',
    variantes: [
      { id: 'p2', nombre: 'R = 10 kΩ, C = 100 nF', circuito: 'p2', generador: 'VG', figura: { num: '22.3', mapa: { N1: 'g', N2: 'c' } } },
      { id: 'p2_lenta', nombre: 'R = 1 MΩ (cuadrada de 1 Hz)', circuito: 'p2_lenta', generador: 'VG', figura: { num: '22.3', mapa: { N1: 'g', N2: 'c' } } },
    ],
    inicial: {
      variante: 'p2',
      bm: { pos: 'off' },
      sondas: { ch1: 'c', ch2: 'g', masa: '0' },
      fn: {
        modo: 'osc',
        ch: [{ on: true, vDiv: 0.5, pos: -3, ac: false, x10: true }, { on: true, vDiv: 1, pos: 0.5, ac: false, x10: true }],
        sDiv: 1e-3,
        hpos: 4e-3,
        disparo: { modo: 'auto', fuente: 1, subida: true, nivel: 1.5 },
        dds: { forma: 'cuadrada', frecuencia: 100, amplitud: 3, ciclo: 50, salida: true },
        cursores: 'no',
        mates: 'no',
        xy: false,
        prm: true,
      },
    },
    pasos: [
      { texto: 'El generador da una <strong>cuadrada de 100 Hz</strong> (de 0 a 3 V: la salida del DDS es siempre positiva). Cada semiciclo dura 5 ms: <strong>cinco constantes de tiempo</strong>. CH1 en el condensador, CH2 en el generador; disparo en CH2, flanco de subida, a la izquierda de la pantalla.' },
      { texto: 'Con <strong>cursores de tensión</strong> (SELECT → Cursores → Tensión), sitúe uno en 0 V y otro en el 63,2 % de la tensión final (1,90 V con 3 V).', aplicar: { fn: { cursores: 'tension', cur: { a: -3, b: -3 + 1.896 / 0.5 } } } },
      { texto: 'Pase a <strong>cursores de tiempo</strong>: A en el flanco del generador y B donde la carga cruza el 63,2 %. Δt es τ; compárelo con R·C = 1 ms.', aplicar: { fn: { cursores: 'tiempo', cur: { a: -4, b: -3.5 } } } },
      { texto: 'El <strong>descubrimiento</strong>: con R = 1 MΩ y la cuadrada a 1 Hz, la sonda (10 MΩ) queda en paralelo con el condensador. La tensión final se queda en el 90,9 % y la constante efectiva baja a unos 91 ms.', aplicar: { variante: 'p2_lenta', fn: { sDiv: 100e-3, hpos: 0.4, dds: { frecuencia: 1 }, cursores: 'no' } } },
    ],
    comprobaciones: [
      { id: 'tau', que: 'τ (Δt de los cursores)', donde: 'FNIRSI, cursores de tiempo del flanco al 63,2 %', esperado: 1e-3, unidad: 's', tol: { rel: 0.05 }, libro: 'τ = R·C = 10 000 × 100 nF = 1 ms', medir: (b) => (en(b, 'p2') ? deltaCursores(b, 'tiempo') : null) },
      { id: 'final', que: 'Tensión final con 1 MΩ', donde: 'FNIRSI, PRM Vmáx de CH1', esperado: 2.727, unidad: 'V', tol: { rel: 0.02 }, libro: 'la tensión final se queda en el 90,9 % (10/11) de 3 V', medir: (b) => (en(b, 'p2_lenta') ? prm(b, 0, 'vmax') : null) },
      { id: 'tau2', que: 'τ efectiva con 1 MΩ', donde: 'FNIRSI, cursores de tiempo', esperado: 0.091, unidad: 's', tol: { rel: 0.06 }, libro: 'la constante efectiva baja a 0,91·τ, unos 91 ms', medir: (b) => (en(b, 'p2_lenta') ? deltaCursores(b, 'tiempo') : null) },
    ],
    leccion: 'Medir modifica lo medido: los 20 pF de la sonda son despreciables frente a 100 nF; sus 10 MΩ no lo son frente a 1 MΩ.',
  },
  // ------------------------------------------------------------------ 3
  {
    n: 3,
    label: 'sec-22.3',
    titulo: 'Característica I-V de un diodo',
    objetivo: 'Levantar la curva del diodo punto a punto con dos multímetros, ver la recta en escala logarítmica y verla dibujarse en modo X-Y.',
    variantes: [
      { id: 'p3', nombre: 'Fuente ajustable, 1 kΩ y 1N4148', circuito: 'p3', figura: { num: '22.5', mapa: { N1: 's', N2: 'a' } } },
      { id: 'p3_suelto', nombre: 'Diodo suelto (prueba de diodos)', circuito: 'p3_suelto', dibujo: 'p3_suelto' },
      { id: 'p3_xy', nombre: 'Trazador de curvas (X-Y)', circuito: 'p3_xy', generador: 'VG', dibujo: 'p3_xy' },
    ],
    inicial: {
      variante: 'p3',
      alimentado: true,
      bm: { pos: 'vdc', sub: 0, borne: 'V', rojo: 'a', negro: '0' },
      fnDmm: { funcion: 'idc', borne: 'mA', serie: { elemento: 'R1', terminal: 0 } },
      fn: { modo: 'dmm' },
      sondas: { ch1: null, ch2: null },
      parametros: { 'v1.dc': 5 },
    },
    pasos: [
      { texto: 'Montaje: fuente ajustable, <strong>R = 1 kΩ</strong> y el diodo. El Brymen mide V<sub>D</sub> (V⎓ sobre el diodo); el multímetro del FNIRSI, en serie con la resistencia (borne mA), mide la corriente. Si lo pusiera en serie con el diodo, el Brymen mediría también la caída de su derivación (10 Ω × 4 mA = 43 mV).' },
      { texto: 'Recorra la fuente (deslizador <strong>V1</strong>) de 0 a 5 V y <strong>anote cada punto</strong>. Por cada década de corriente la tensión sube una cantidad fija: unos 100 mV en un 1N4148 (59,5 mV en el diodo ideal).' },
      { texto: 'Con 5 V se llega a unos <strong>4,4 mA</strong>; para 10 y 100 mA habría que bajar R. En la gráfica (corriente en escala logarítmica) los puntos forman una recta: la ecuación de Shockley.', aplicar: { parametros: { 'v1.dc': 5 } } },
      { texto: '<strong>Prueba de diodos</strong> del Brymen con el diodo suelto (sin alimentación): unos 0,5 V con la corriente de prueba del instrumento.', aplicar: { variante: 'p3_suelto', alimentado: false, bm: { pos: 'cap', sub: 1, borne: 'V', rojo: 'a', negro: '0' }, fnDmm: { serie: null } } },
      { texto: '<strong>En tiempo real, con el osciloscopio en X-Y</strong>: senoide del generador, diodo y 1 kΩ. La pinza de masa en el cátodo (la masa del FNIRSI es flotante): CH1 en el ánodo da V<sub>D</sub> (eje X) y CH2 en la masa del circuito, <em>invertido</em>, da I·R (eje Y). Solo se dibuja el primer cuadrante: la salida del DDS es siempre positiva.', aplicar: { variante: 'p3_xy', alimentado: true, bm: { pos: 'off' }, sondas: { ch1: 'g', ch2: '0', masa: 'k' }, fn: { modo: 'osc', xy: true, sDiv: 5e-3, ch: [{ on: true, vDiv: 0.1, pos: -3, x10: true }, { on: true, vDiv: 0.5, pos: -3, x10: true, invertir: true }], dds: { forma: 'seno', frecuencia: 50, amplitud: 3, salida: true } } } },
    ],
    comprobaciones: [
      { id: 'vd', que: 'V<sub>D</sub> con 5 V', donde: 'Brymen V⎓ sobre el diodo', esperado: 0.653, unidad: 'V', tol: { rel: 0.02 }, libro: 'un 1N4148 real ronda unos 0,69 V a 10 mA (y unos 0,65 V a 4,4 mA, netlist)', medir: (b) => (en(b, 'p3') && leerParametro(b.texto, 'v1.dc') === 5 && pos(b, 'vdc') && puntas(b, 'a', '0') ? brymen(b) : null) },
      { id: 'id', que: 'Corriente con 5 V', donde: 'FNIRSI multímetro, DCA en serie con R', esperado: 4.35e-3, unidad: 'A', tol: { rel: 0.02 }, libro: 'hasta unos 4,4 mA al final del barrido', medir: (b) => (en(b, 'p3') && leerParametro(b.texto, 'v1.dc') === 5 ? fnirsiDmm(b) : null) },
      { id: 'prueba', que: 'Prueba de diodos', donde: 'Brymen en ⏵, diodo suelto', esperado: 0.53, unidad: 'V', tol: { abs: 0.03 }, libro: 'la caída del silicio con la corriente de prueba (sección 52.4)', medir: (b) => (en(b, 'p3_suelto') && b.brymen.ids?.[0] === 'diodo' ? brymen(b) : null) },
    ],
    tabla: {
      titulo: 'Puntos de la curva',
      columnas: [
        { id: 'v1', nombre: 'V1', unidad: 'V' },
        { id: 'vd', nombre: 'V<sub>D</sub>', unidad: 'V' },
        { id: 'i', nombre: 'I', unidad: 'A' },
      ],
      anotar: (b) => {
        if (!en(b, 'p3')) return 'Anote con el montaje de la fuente ajustable.';
        const vd = pos(b, 'vdc') && puntas(b, 'a', '0') ? brymen(b) : null;
        const i = fnirsiDmm(b);
        if (vd === null) return 'El Brymen debe medir V⎓ entre a y masa.';
        if (i === null) return 'El multímetro del FNIRSI debe medir DCA en serie con la resistencia.';
        return { v1: leerParametro(b.texto, 'v1.dc') ?? 0, vd, i };
      },
      grafica: { x: 'vd', y: 'i', yLog: true, teoria: (v) => 2.52e-9 * (Math.exp(v / (1.752 * 0.025852)) - 1), nombreTeoria: 'Shockley (1N4148)' },
    },
    leccion: 'La pendiente de la recta entre los 59,5 mV por década del diodo ideal da el coeficiente de emisión n (en torno a 1,75 en un 1N4148).',
  },
  // ------------------------------------------------------------------ 4
  {
    n: 4,
    label: 'sec-22.4',
    titulo: 'Rectificación de media onda y rizado',
    objetivo: 'Medir la caída del diodo, el rizado y la forma de la corriente de un rectificador de media onda.',
    variantes: [
      { id: 'p4', nombre: 'Con 1 000 µF', circuito: 'p4', dibujo: 'p4', asentamiento: 0.4 },
      { id: 'p4_sinC', nombre: 'Sin condensador', circuito: 'p4_sinC', dibujo: 'p4_sinC', asentamiento: 0.4 },
    ],
    inicial: {
      variante: 'p4_sinC',
      alimentado: true,
      bm: { pos: 'vdc', sub: 0, borne: 'V', rojo: 'out', negro: '0' },
      sondas: { ch1: 'out', ch2: null, masa: '0' },
      fn: { modo: 'osc', ch: [{ on: true, vDiv: 5, pos: -2, ac: false, x10: true }, { on: false }], sDiv: 5e-3, hpos: 0, disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 5 }, cursores: 'no', mates: 'no', xy: false, prm: true },
    },
    pasos: [
      { texto: 'Secundario de <strong>9 V eficaces</strong> (12,7 V de pico) con 0,5 Ω de devanado, diodo 1N4007 y 110 Ω de carga. <strong>Sin condensador</strong>, la salida son semiciclos: el osciloscopio los ve entre 0 y 12 V.' },
      { texto: 'El <strong>multímetro en continua promedia</strong>: marca unos 3,7 V (4,0 V con un diodo ideal) aunque la señal real esté entre 0 y 12. El instrumento promedia y oculta la forma.' },
      { texto: '<strong>Con 1 000 µF</strong>, la salida se mantiene cerca del pico. Para ver el rizado: CH1 en <strong>acoplamiento AC</strong> y 0,5 V/div. La fórmula ΔV = I/(f·C) da 2,0 V; el montaje real, del orden de 1,7 V.', aplicar: { variante: 'p4', fn: { ch: [{ on: true, vDiv: 0.5, pos: 0, ac: true }, null], disparo: { nivel: 0 } } } },
      { texto: '<strong>La forma de la corriente</strong>: Brymen en A mA, punta roja al borne A, en serie con el diodo, y <strong>CREST</strong> (picos de 1 ms): el diodo conduce un pulso estrecho de más de 1 A para dar 100 mA de media.', aplicar: { bm: { pos: 'amA', sub: 0, borne: 'A', serie: { elemento: 'D1', terminal: 0 } } } },
    ],
    comprobaciones: [
      { id: 'media', que: 'Valor medio sin condensador', donde: 'Brymen V⎓ en la salida', esperado: 3.67, unidad: 'V', tol: { rel: 0.02 }, libro: 'unos 3,7 V, que es el primer número a comprobar', medir: (b) => (en(b, 'p4_sinC') && pos(b, 'vdc') && puntas(b, 'out', '0') ? brymen(b) : null) },
      { id: 'rizado', que: 'Rizado pico a pico', donde: 'FNIRSI CH1 en AC, PRM Vpp', esperado: 1.72, unidad: 'V', tol: { rel: 0.06 }, libro: 'la fórmula da 2,0 V; el montaje real, del orden de 1,7 V', medir: (b) => (en(b, 'p4') && b.fnirsi.canales[0]!.ac && b.sondas.ch1 === 'out' ? prm(b, 0, 'vpp') : null) },
      { id: 'pico', que: 'Pico de corriente del diodo', donde: 'Brymen A en serie, CREST (máximo)', esperado: 1.22, unidad: 'A', tol: { rel: 0.06 }, libro: 'con 100 mA de salida, el pico puede ser de 1 A o más', medir: (b) => (en(b, 'p4') && b.brymen.crest && b.brymen.crest.vista === 0 && b.bm.serie?.elemento === 'D1' ? brymen(b) : null) },
    ],
    leccion: 'Es la demostración más directa de la diferencia entre lo que mide un multímetro y lo que ocurre.',
  },
  // ------------------------------------------------------------------ 5
  {
    n: 5,
    label: 'sec-22.5',
    titulo: 'Filtro RC paso bajo y diagrama de Bode',
    objetivo: 'Levantar el Bode punto a punto: el corte a −3 dB, la pendiente de −20 dB/década y la fase.',
    variantes: [{ id: 'p5', nombre: 'R = 1,6 kΩ, C = 100 nF', circuito: 'p5', generador: 'VG', figura: { num: '22.10', mapa: { N1: 'in', N2: 'out' } }, asentamiento: 0.005 }],
    inicial: {
      variante: 'p5',
      bm: { pos: 'off' },
      sondas: { ch1: 'in', ch2: 'out', masa: '0' },
      fn: {
        modo: 'osc',
        ch: [{ on: true, vDiv: 1, pos: -1.5, ac: false, x10: true }, { on: true, vDiv: 1, pos: -1.5, ac: false, x10: true }],
        sDiv: 200e-6,
        hpos: 0,
        disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 1.5 },
        dds: { forma: 'seno', frecuencia: 1000, amplitud: 3, salida: true },
        cursores: 'no',
        mates: 'no',
        xy: false,
        prm: true,
      },
    },
    pasos: [
      { texto: 'Generador a la entrada (senoide de 3 V), CH1 en la entrada y CH2 en la salida. Calculado: f<sub>c</sub> = 1/(2π·1600·100 nF) = <strong>995 Hz</strong>.' },
      { texto: 'Recorra frecuencias en <strong>progresión geométrica</strong>: 100, 200, 500, 1 k, 2 k, 5 k, 10 k y 20 k (MENU → Generador, o el campo de frecuencia). En cada una pulse AUTO y <strong>anote el punto</strong>: la relación de Vpp de CH2 y CH1 en dB.' },
      { texto: 'En 1 kHz la salida es <strong>0,707 veces la entrada (−3 dB)</strong>. Para la fase, cursores de tiempo entre los pasos por el centro de las dos señales: Δt·f·360 = 45°.', aplicar: { fn: { dds: { frecuencia: 1000 }, sDiv: 100e-6, cursores: 'tiempo', cur: { a: 0, b: 2 } } } },
      { texto: 'De 2 kHz a 20 kHz la salida cae unos 19 dB: la asíntota de −20 dB/década de un filtro de primer orden.' },
    ],
    comprobaciones: [
      { id: 'g1k', que: 'Ganancia a 1 kHz', donde: 'PRM: 20·log(Vpp CH2 / Vpp CH1)', esperado: -3.0, unidad: 'dB', tol: { abs: 0.4 }, libro: 'en el corte, 0,707 veces la entrada (−3 dB)', medir: (b) => (en(b, 'p5') ? conGenerador(b, 1000, () => gananciaDb(b)) : null) },
      { id: 'g20k', que: 'Ganancia a 20 kHz', donde: 'PRM, relación de Vpp', esperado: -26.1, unidad: 'dB', tol: { abs: 1.2 }, libro: 'de 2 kHz a 20 kHz la salida cae unos 19 dB (−7,0 → −26,1 dB)', medir: (b) => (en(b, 'p5') ? conGenerador(b, 20000, () => gananciaDb(b)) : null) },
      { id: 'fase', que: 'Desfase a 1 kHz', donde: 'Cursores de tiempo: Δt·f·360', esperado: 45, unidad: '°', tol: { abs: 5 }, libro: 'en el corte, desfasada −45°', medir: (b) => (en(b, 'p5') ? conGenerador(b, 1000, () => { const d = deltaCursores(b, 'tiempo'); return d === null ? null : d * 1000 * 360; }) : null) },
    ],
    tabla: {
      titulo: 'Bode medido',
      columnas: [
        { id: 'f', nombre: 'f', unidad: 'Hz' },
        { id: 'vin', nombre: 'Vpp entrada', unidad: 'V' },
        { id: 'vout', nombre: 'Vpp salida', unidad: 'V' },
        { id: 'g', nombre: 'Ganancia', unidad: 'dB' },
      ],
      anotar: (b) => {
        const f = generador(b);
        const a = prm(b, 0, 'vpp');
        const c = prm(b, 1, 'vpp');
        if (f === null) return 'Active la salida del generador.';
        if (!a || !c) return 'Hacen falta los dos canales con la señal en pantalla (pulse AUTO).';
        return { f, vin: a, vout: c, g: 20 * Math.log10(c / a) };
      },
      grafica: { x: 'f', y: 'g', xLog: true, teoria: (f) => -10 * Math.log10(1 + (f / 994.7) ** 2), nombreTeoria: 'Teoría (f_c = 995 Hz)' },
    },
    leccion: 'La fase cambia mucho antes que la amplitud: ya vale −6° una década por debajo del corte.',
  },
  // ------------------------------------------------------------------ 6
  {
    n: 6,
    label: 'sec-22.6',
    titulo: 'Formas de onda y armónicos con la FFT',
    objetivo: 'Comprobar con la FFT que la cuadrada solo tiene armónicos impares con amplitud 1/n, la triangular 1/n² y la sierra todos.',
    variantes: [{ id: 'p6', nombre: 'Generador al CH1', circuito: 'p6', generador: 'VG', figura: { num: '22.12', mapa: { N1: 'g' } } }],
    inicial: {
      variante: 'p6',
      bm: { pos: 'off' },
      sondas: { ch1: 'g', ch2: null, masa: '0' },
      fn: {
        modo: 'osc',
        ch: [{ on: true, vDiv: 1, pos: -1.5, ac: false, x10: true }, { on: false }],
        sDiv: 1e-3,
        hpos: 0,
        disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 1.5 },
        dds: { forma: 'cuadrada', frecuencia: 1000, amplitud: 3, ciclo: 50, salida: true },
        mates: 'fft1',
        cursores: 'tiempo',
        cur: { a: -6 + 12 * (1000 / 41667), b: -6 + 12 * (3000 / 41667) },
        xy: false,
        prm: true,
      },
    },
    pasos: [
      { texto: 'Cuadrada de 1 kHz del generador al CH1, 1 ms/div (doce ciclos en pantalla: resolución de 83 Hz) y <strong>Math → FFT CH1</strong>. Los cursores leen frecuencia y nivel de cada raya.' },
      { texto: '<strong>Onda cuadrada</strong>: solo armónicos impares con amplitud 1/n. El tercero, <strong>9,5 dB</strong> por debajo de la fundamental; el quinto, 14 dB.' },
      { texto: '<strong>Onda triangular</strong> (diente de sierra con simetría al 50 %): también solo impares, con 1/n²: el tercero, 19 dB por debajo.', aplicar: { fn: { dds: { forma: 'sierra', simetria: 50 } } } },
      { texto: '<strong>Diente de sierra</strong> (simetría al 100 %): todos los armónicos, pares e impares, con 1/n: el segundo, 6 dB por debajo.', aplicar: { fn: { dds: { forma: 'sierra', simetria: 100 } } } },
      { texto: '<strong>Senoide</strong>: solo la fundamental. Lo que aparezca es distorsión del generador o del propio osciloscopio (y el suelo de sus 8 bits).', aplicar: { fn: { dds: { forma: 'seno' } } } },
    ],
    comprobaciones: [
      { id: 'h3', que: '3.er armónico de la cuadrada', donde: 'FFT CH1, relativo a la fundamental', esperado: -9.54, unidad: 'dB', tol: { abs: 1.0 }, libro: '20·log(1/3) = −9,54 dB', medir: (b) => (formaDds(b, 'cuadrada') ? fftRelativo(b, b.fnirsi.dds.frecuencia, 3 * b.fnirsi.dds.frecuencia) : null) },
      { id: 'h3t', que: '3.er armónico de la triangular', donde: 'FFT CH1', esperado: -19.1, unidad: 'dB', tol: { abs: 1.5 }, libro: 'con 1/n²: el tercero, 19 dB por debajo', medir: (b) => (formaDds(b, 'sierra', 50) ? fftRelativo(b, b.fnirsi.dds.frecuencia, 3 * b.fnirsi.dds.frecuencia) : null) },
      { id: 'h2s', que: '2.º armónico de la sierra', donde: 'FFT CH1', esperado: -6.0, unidad: 'dB', tol: { abs: 1.2 }, libro: 'todos los armónicos, con amplitud 1/n', medir: (b) => (formaDds(b, 'sierra', 100) ? fftRelativo(b, b.fnirsi.dds.frecuencia, 2 * b.fnirsi.dds.frecuencia) : null) },
    ],
    leccion: 'Cuanto más suave es la forma de onda, más rápido caen sus armónicos: un salto en la señal es contenido de alta frecuencia.',
  },
  // ------------------------------------------------------------------ 7
  {
    n: 7,
    label: 'sec-22.7',
    titulo: 'Oscilador astable con el 555',
    objetivo: 'Medir la frecuencia y el ciclo de trabajo, ver los umbrales de 1/3 y 2/3 de V<sub>CC</sub> y comprobar que la frecuencia no depende de la alimentación.',
    variantes: [{ id: 'p7', nombre: 'R_A = 10 kΩ, R_B = 47 kΩ, C = 1 µF', circuito: 'p7', figura: { num: '22.14', mapa: { N1: 'thr', N2: 'dis', N4: 'out', N5: 'vcc' } }, asentamiento: 0.1, dinamico: true }],
    inicial: {
      variante: 'p7',
      bm: { pos: 'vac', sub: 0, borne: 'V', rojo: 'out', negro: '0' },
      sondas: { ch1: 'out', ch2: 'thr', masa: '0' },
      fn: {
        modo: 'osc',
        ch: [{ on: true, vDiv: 5, pos: 0, ac: false, x10: true }, { on: true, vDiv: 2, pos: -3, ac: false, x10: true }],
        sDiv: 20e-3,
        hpos: 0,
        disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 4.5 },
        cursores: 'no',
        mates: 'no',
        xy: false,
        prm: true,
      },
      parametros: { 'param:vcc': 9 },
    },
    pasos: [
      { texto: 'Astable con <strong>R<sub>A</sub> = 10 kΩ, R<sub>B</sub> = 47 kΩ y C = 1 µF</strong> a 9 V. Calculado: t<sub>alto</sub> = 39,5 ms, t<sub>bajo</sub> = 32,6 ms, <strong>f = 13,9 Hz</strong>, ciclo del 55 %. CH1 en la salida, CH2 en el condensador.' },
      { texto: 'Lea la frecuencia y el ciclo de trabajo con <strong>PRM</strong>. El Brymen en V∿ muestra la frecuencia en la pantalla secundaria.' },
      { texto: '<strong>La tensión en el condensador</strong> (CH2): dos exponenciales entre los umbrales de 1/3 y 2/3 de V<sub>CC</sub> (3 y 6 V).' },
      { texto: '<strong>Varíe la alimentación</strong> entre 5 y 12 V (parámetro vcc): la frecuencia apenas cambia, porque los umbrales suben en la misma proporción.', aplicar: { parametros: { 'param:vcc': 5 } } },
    ],
    comprobaciones: [
      { id: 'f', que: 'Frecuencia', donde: 'FNIRSI PRM, CH1', esperado: 13.9, unidad: 'Hz', tol: { rel: 0.02 }, libro: 'f = 13,9 Hz (T = 72,1 ms)', medir: (b) => (en(b, 'p7') && b.sondas.ch1 === 'out' ? prm(b, 0, 'f') : null) },
      { id: 'ciclo', que: 'Ciclo de trabajo', donde: 'FNIRSI PRM, CH1', esperado: 55, unidad: '%', tol: { abs: 2 }, libro: 'un ciclo de trabajo del 55 %', medir: (b) => (en(b, 'p7') && b.sondas.ch1 === 'out' ? prm(b, 0, 'ciclo') : null) },
      { id: 'alto', que: 'Umbral superior', donde: 'FNIRSI PRM Vmáx de CH2 (condensador)', esperado: 6, unidad: 'V', tol: { rel: 0.04 }, libro: '2/3 de V<sub>CC</sub>', medir: (b) => (en(b, 'p7') && leerParametro(b.texto, 'param:vcc') === 9 && b.sondas.ch2 === 'thr' ? prm(b, 1, 'vmax') : null) },
      { id: 'bajo', que: 'Umbral inferior', donde: 'FNIRSI PRM Vmín de CH2', esperado: 3, unidad: 'V', tol: { rel: 0.05 }, libro: '1/3 de V<sub>CC</sub>', medir: (b) => (en(b, 'p7') && leerParametro(b.texto, 'param:vcc') === 9 && b.sondas.ch2 === 'thr' ? prm(b, 1, 'vmin') : null) },
      { id: 'f5', que: 'Frecuencia a 5 V', donde: 'FNIRSI PRM, CH1', esperado: 13.9, unidad: 'Hz', tol: { rel: 0.02 }, libro: 'la frecuencia no depende de la tensión de alimentación', medir: (b) => (en(b, 'p7') && leerParametro(b.texto, 'param:vcc') === 5 ? prm(b, 0, 'f') : null) },
      { id: 'fbm', que: 'Frecuencia en el Brymen', donde: 'Brymen V∿, pantalla secundaria (Hz)', esperado: 13.9, unidad: 'Hz', tol: { rel: 0.02 }, libro: 'f = 13,9 Hz', medir: (b) => (en(b, 'p7') && pos(b, 'vac') && b.brymen.sub === 0 ? (b.brymen.pantalla.secundaria?.valor ?? null) : null) },
    ],
    leccion: 'El 0,693 es ln 2: el condensador recorre siempre la mitad del camino restante, y por eso f no depende de V<sub>CC</sub>.',
  },
  // ------------------------------------------------------------------ 8
  {
    n: 8,
    label: 'sec-22.8',
    titulo: 'El transistor BJT como interruptor',
    objetivo: 'Encender un LED con una señal pequeña viendo las regiones de corte y saturación.',
    variantes: [
      { id: 'p8_0', nombre: 'Base a 0 V', circuito: 'p8_0', figura: { num: '22.16', mapa: { N1: 'b', N2: 'c', N3: 'ctl', N4: 'a', N5: 'vcc' } } },
      { id: 'p8_5', nombre: 'Base a 5 V por R_B', circuito: 'p8_5', figura: { num: '22.16', mapa: { N1: 'b', N2: 'c', N3: 'ctl', N4: 'a', N5: 'vcc' } } },
      { id: 'p8_gen', nombre: 'Base desde el generador', circuito: 'p8_gen', generador: 'VG', figura: { num: '22.16', mapa: { N1: 'b', N2: 'c', N3: 'ctl', N4: 'a', N5: 'vcc' } } },
    ],
    inicial: { variante: 'p8_0', alimentado: true, bm: { pos: 'vdc', sub: 0, borne: 'V', rojo: 'c', negro: '0' }, sondas: { ch1: null, ch2: null } },
    pasos: [
      { texto: 'LED con 330 Ω en el colector hacia +5 V, emisor a masa, base por R<sub>B</sub> = 10 kΩ. <strong>Base a 0 V</strong>: LED apagado. V<sub>CE</sub> es alta pero no toda la alimentación: con la corriente minúscula del voltímetro el LED aún cae 1 a 1,5 V, y se leen unos 3,5 V.' },
      { texto: '<strong>Base a 5 V</strong> a través de R<sub>B</sub>: el LED se enciende y V<sub>CE</sub> cae a ≈ 0,2 V (saturación).', aplicar: { variante: 'p8_5' } },
      { texto: 'Sustituya el control por una <strong>cuadrada lenta del generador (2 Hz, 3 V)</strong> y observe con el osciloscopio cómo V<sub>CE</sub> conmuta entre los dos estados al ritmo de la base.', aplicar: { variante: 'p8_gen', bm: { pos: 'off' }, sondas: { ch1: 'c', ch2: 'ctl', masa: '0' }, fn: { modo: 'osc', ch: [{ on: true, vDiv: 1, pos: -2, ac: false, x10: true }, { on: true, vDiv: 2, pos: -3, ac: false, x10: true }], sDiv: 200e-3, hpos: 0, disparo: { modo: 'auto', fuente: 1, subida: true, nivel: 1.5 }, dds: { forma: 'cuadrada', frecuencia: 2, amplitud: 3, ciclo: 50, salida: true }, cursores: 'no', mates: 'no', xy: false, prm: true } } },
      { texto: 'Suba R<sub>B</sub> (deslizador) hasta que el transistor no sature (con 1 MΩ, por ejemplo): V<sub>CE</sub> se queda en un valor intermedio, como amplificador y no como interruptor.' },
    ],
    comprobaciones: [
      { id: 'corte', que: 'V<sub>CE</sub> en corte', donde: 'Brymen V⎓ entre colector y masa', esperado: 3.5, unidad: 'V', tol: { rel: 0.04 }, libro: 'con 5 V se leen unos 3,5 V', medir: (b) => (en(b, 'p8_0') && pos(b, 'vdc') && puntas(b, 'c', '0') ? brymen(b) : null) },
      { id: 'sat', que: 'V<sub>CE</sub> en saturación', donde: 'Brymen V⎓ entre colector y masa', esperado: 0.2, unidad: 'V', tol: { abs: 0.12 }, libro: 'caerá a ≈ 0,2 V (saturación)', medir: (b) => (en(b, 'p8_5') && leerParametro(b.texto, 'rb') === 10e3 && pos(b, 'vdc') && puntas(b, 'c', '0') ? brymen(b) : null) },
      { id: 'f', que: 'Conmutación', donde: 'FNIRSI PRM frecuencia de CH1', esperado: 2, unidad: 'Hz', tol: { rel: 0.03 }, libro: 'onda cuadrada lenta del DDS (p. ej. 2 Hz)', medir: (b) => (en(b, 'p8_gen') && b.sondas.ch1 === 'c' ? prm(b, 0, 'f') : null) },
    ],
    leccion: 'El transistor como conmutador es el principio de toda la electrónica digital.',
  },
  // ------------------------------------------------------------------ 9
  {
    n: 9,
    label: 'sec-22.9',
    titulo: 'Resonancia de un circuito RLC y factor Q',
    objetivo: 'Localizar f₀, medir el ancho de banda y descubrir por qué el Q medido es menor que el calculado.',
    variantes: [{ id: 'p9', nombre: 'L = 10 mH (20 Ω de cobre), C = 100 nF, R = 100 Ω', circuito: 'p9', generador: 'VG', dibujo: 'p9', asentamiento: 0.003 }],
    inicial: {
      variante: 'p9',
      bm: { pos: 'off' },
      sondas: { ch1: 'in', ch2: 'n2', masa: '0' },
      fn: {
        modo: 'osc',
        ch: [{ on: true, vDiv: 1, pos: -1.5, ac: false, x10: true }, { on: true, vDiv: 0.5, pos: 0, ac: false, x10: true }],
        sDiv: 100e-6,
        hpos: 0,
        disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 1.5 },
        dds: { forma: 'seno', frecuencia: 5000, amplitud: 3, salida: true },
        cursores: 'no',
        mates: 'no',
        xy: false,
        prm: true,
      },
    },
    pasos: [
      { texto: '<strong>Predicción</strong>: f₀ = 1/(2π√(LC)) = 5 033 Hz, Z₀ = √(L/C) = 316 Ω, Q = Z₀/R = 3,16, BW = f₀/Q = 1 592 Hz. CH1 en la salida del generador, CH2 sobre la resistencia (proporcional a la corriente).' },
      { texto: '<strong>Barra la frecuencia</strong> de 1 a 20 kHz y anote la amplitud sobre la resistencia en una docena de puntos, más densos cerca del máximo.' },
      { texto: '<strong>Localice el máximo</strong> (f₀) y los <strong>puntos de −3 dB</strong>, donde la amplitud cae al 70,7 %: su diferencia es el ancho de banda, y Q = f₀/Δf.' },
      { texto: 'El Q medido sale <strong>menor que 3,16</strong>: la resistencia de la bobina (20 Ω) y la impedancia de salida del generador (50 Ω) se suman a los 100 Ω. Con 170 Ω, Q = 1,86. Repita con R = 1 kΩ: f₀ no cambia y Q cae.' },
    ],
    comprobaciones: [
      { id: 'f0', que: 'f₀ (máximo de la tabla)', donde: 'Tabla: frecuencia con la mayor V<sub>R</sub>', esperado: 5033, unidad: 'Hz', tol: { rel: 0.04 }, libro: 'f₀ = 5 033 Hz', medir: (b) => (en(b, 'p9') ? (anchoBanda(b.anotaciones, 'f', 'vr')?.f0 ?? null) : null) },
      { id: 'vr', que: 'V<sub>R</sub> en resonancia', donde: 'FNIRSI PRM Vpp de CH2 a 5 033 Hz', esperado: 1.765, unidad: 'V', tol: { rel: 0.04 }, libro: 'en resonancia la impedancia es mínima (solo R… más la bobina y el generador)', medir: (b) => (en(b, 'p9') && leerParametro(b.texto, 'r1') === 100 ? conGenerador(b, 5033, () => prm(b, 1, 'vpp')) : null) },
      { id: 'q', que: 'Q medido', donde: 'Tabla: f₀/(f₂ − f₁)', esperado: 1.86, unidad: '', tol: { rel: 0.12 }, libro: 'el Q medido será menor que el calculado (3,16)', medir: (b) => { const a = en(b, 'p9') ? anchoBanda(b.anotaciones, 'f', 'vr') : null; return a ? a.f0 / (a.f2 - a.f1) : null; } },
    ],
    tabla: {
      titulo: 'Curva de resonancia',
      columnas: [
        { id: 'f', nombre: 'f', unidad: 'Hz' },
        { id: 'vr', nombre: 'Vpp en R', unidad: 'V' },
        { id: 'vin', nombre: 'Vpp entrada', unidad: 'V' },
      ],
      anotar: (b) => {
        const f = generador(b);
        const vr = prm(b, 1, 'vpp');
        const vin = prm(b, 0, 'vpp');
        if (f === null) return 'Active la salida del generador.';
        if (vr === null || vin === null) return 'Hacen falta los dos canales en pantalla.';
        return { f, vr, vin };
      },
      grafica: {
        x: 'f',
        y: 'vr',
        xLog: true,
        teoria: (f) => {
          const w = 2 * Math.PI * f;
          return (3 * 100) / Math.hypot(170, w * 10e-3 - 1 / (w * 100e-9));
        },
        nombreTeoria: 'Teoría con 170 Ω',
      },
    },
    leccion: 'La resonancia la fijan L y C; el amortiguamiento lo fija R. Son dos propiedades independientes.',
  },
  // ------------------------------------------------------------------ 10
  {
    n: 10,
    label: 'sec-22.11',
    titulo: 'Tiempo de subida y ancho de banda',
    objetivo: 'Medir el tiempo de subida del conjunto sonda-osciloscopio y deducir su ancho de banda: t<sub>r</sub> = 0,35/BW.',
    variantes: [{ id: 'p10', nombre: 'Flanco de un 74AC04', circuito: 'p10', dibujo: 'p10' }],
    inicial: {
      variante: 'p10',
      bm: { pos: 'off' },
      sondas: { ch1: 'out', ch2: null, masa: '0' },
      fn: {
        modo: 'osc',
        ch: [{ on: true, vDiv: 1, pos: -2.5, ac: false, x10: true }, { on: false }],
        sDiv: 10e-9,
        hpos: 0,
        disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 2.5 },
        cursores: 'tiempo',
        cur: { a: -1, b: 1 },
        mates: 'no',
        xy: false,
        prm: false,
      },
    },
    pasos: [
      { texto: 'El generador del 2C53T no sirve aquí (sus flancos son lentos): la fuente es una puerta <strong>74AC04</strong>, con flancos de unos 2,5 ns. Sonda ×10 compensada y 10 ns/div: un solo flanco ocupa la pantalla.' },
      { texto: 'Con los <strong>cursores de tiempo</strong> marque el <strong>10 % y el 90 %</strong> del salto (0,5 V y 4,5 V). Δt es t<sub>r</sub>; BW = 0,35/t<sub>r</sub>. El 2C53T mostrará unos 7,5 ns: la suma en cuadratura de sus 7 ns y los del flanco.' },
      { texto: 'Repita con la sonda en <strong>×1</strong> (conmutador de la sonda y menú del canal) y 50 ns/div: unos 60 ns, el ancho de banda de unos 6 MHz de la propia sonda.', aplicar: { fn: { ch: [{ x10: false }, null], sDiv: 50e-9, cur: { a: -2, b: 2 } } } },
    ],
    comprobaciones: [
      { id: 'tr10', que: 't<sub>r</sub> con ×10', donde: 'Cursores de tiempo del 10 al 90 %', esperado: 7.3e-9, unidad: 's', tol: { rel: 0.1 }, libro: 'el 2C53T mostrará unos 7,5 ns', medir: (b) => (en(b, 'p10') && b.fnirsi.canales[0]!.sondaX10 ? deltaCursores(b, 'tiempo') : null) },
      { id: 'tr1', que: 't<sub>r</sub> con ×1', donde: 'Cursores de tiempo del 10 al 90 %', esperado: 58e-9, unidad: 's', tol: { rel: 0.12 }, libro: 'sonda en ×1: unos 60 ns, unos 6 MHz', medir: (b) => (en(b, 'p10') && !b.fnirsi.canales[0]!.sondaX10 ? deltaCursores(b, 'tiempo') : null) },
    ],
    leccion: 'El osciloscopio no muestra la realidad: muestra la realidad filtrada por su ancho de banda.',
  },
  // ------------------------------------------------------------------ 11
  {
    n: 11,
    label: 'sec-22.12',
    titulo: 'Ver y demodular una señal modulada en AM',
    objetivo: 'Medir el índice de modulación en la pantalla, ver las tres líneas del espectro y recuperar el tono con un diodo y un RC.',
    variantes: [{ id: 'p11', nombre: 'Portadora de 100 kHz al 50 %', circuito: 'p11', dibujo: 'p11', asentamiento: 0.002 }],
    inicial: {
      variante: 'p11',
      bm: { pos: 'off' },
      sondas: { ch1: 'am', ch2: 'o1', masa: '0' },
      fn: {
        modo: 'osc',
        ch: [{ on: true, vDiv: 1, pos: 0, ac: false, x10: true }, { on: true, vDiv: 1, pos: -3, ac: false, x10: true }],
        sDiv: 200e-6,
        hpos: 0,
        disparo: { modo: 'auto', fuente: 1, subida: true, nivel: 1.4 },
        cursores: 'tension',
        cur: { a: 2, b: -2 },
        mates: 'no',
        xy: false,
        prm: true,
      },
    },
    pasos: [
      { texto: 'Hace falta un <strong>generador de banco con modulación</strong> (el DDS del 2C53T no pasa de 50 kHz ni modula): portadora de 100 kHz modulada al 50 % por 1 kHz. En la pantalla, la portadora con su envolvente.' },
      { texto: '<strong>Índice de modulación</strong> con los cursores de tensión en el máximo y el mínimo de la envolvente: m = (A<sub>máx</sub> − A<sub>mín</sub>)/(A<sub>máx</sub> + A<sub>mín</sub>). Con 3 V y 1 V, m = 0,5.' },
      { texto: '<strong>En frecuencia</strong> (Math → FFT CH1): tres líneas, la portadora en 100 kHz y las bandas laterales en 99 y 101 kHz, 12 dB por debajo (m/2 = 0,25).', aplicar: { fn: { mates: 'fft1', cursores: 'tiempo', cur: { a: -6 + 12 * (99e3 / 208333), b: -6 + 12 * (100e3 / 208333) } } } },
      { texto: '<strong>El demodulador</strong> (CH2): diodo y RC con τ = 100 µs, entre los 10 µs de la portadora y el 1 ms de la moduladora: sale el tono de 1 kHz. Cambie C1 a 1 nF (rizado de portadora) y a 100 nF (corte diagonal).', aplicar: { fn: { mates: 'no', cursores: 'no' } } },
    ],
    comprobaciones: [
      { id: 'm', que: 'Índice de modulación', donde: 'Cursores de tensión: (A − B)/(A + B)', esperado: 0.5, unidad: '', tol: { abs: 0.05 }, libro: 'con 3 V de máximo y 1 V de mínimo: m = 0,5', medir: (b) => { const c = en(b, 'p11') ? cursoresTension(b) : null; return c && c[0] + c[1] > 0 ? (c[0] - c[1]) / (c[0] + c[1]) : null; } },
      { id: 'bandas', que: 'Bandas laterales', donde: 'FFT CH1: nivel medio de 99 y 101 kHz respecto a 100 kHz', esperado: -12, unidad: 'dB', tol: { abs: 3 }, libro: 'tres líneas: 100 kHz y las bandas en 99 y 101 kHz (m/2 = 0,25: −12 dB)', medir: (b) => { if (!en(b, 'p11')) return null; const a = fftRelativo(b, 100e3, 99e3, 0.004); const c = fftRelativo(b, 100e3, 101e3, 0.004); return a !== null && c !== null ? (a + c) / 2 : null; } },
      { id: 'tono', que: 'Tono recuperado', donde: 'FNIRSI PRM frecuencia de CH2', esperado: 1000, unidad: 'Hz', tol: { rel: 0.05 }, libro: 'montar el demodulador de diodo y recuperar el tono', medir: (b) => (en(b, 'p11') && b.sondas.ch2 === 'o1' ? prm(b, 1, 'f') : null) },
    ],
    leccion: 'La constante de tiempo del demodulador tiene que ser mucho mayor que el periodo de la portadora y mucho menor que el de la moduladora: esa doble condición es todo el diseño.',
  },
  // ------------------------------------------------------------------ 12
  {
    n: 12,
    label: 'sec-22.13',
    titulo: 'Medir L y C: puentes y el medidor LCR',
    objetivo: 'Medir un electrolítico con el capacímetro del Brymen y por el método del divisor con el generador y el osciloscopio.',
    variantes: [{ id: 'p12', nombre: '100 µF (ESR 0,08 Ω, ESL 30 nH) y 100 Ω', circuito: 'p12', generador: 'VG', dibujo: 'p12', asentamiento: 0.08 }],
    inicial: {
      variante: 'p12',
      alimentado: false,
      bm: { pos: 'cap', sub: 0, borne: 'V', rojo: 'c', negro: '0' },
      sondas: { ch1: null, ch2: null, masa: '0' },
      fn: { dds: { forma: 'seno', frecuencia: 120, amplitud: 3, salida: true } },
    },
    pasos: [
      { texto: 'Con el circuito <strong>sin alimentar</strong> y el condensador descargado, el Brymen en ⊣⊢ lee la capacidad (los electrolíticos grandes tardan segundos). Medido a baja frecuencia da su capacidad nominal.' },
      { texto: '<strong>Por divisor</strong>: el componente en serie con una resistencia conocida (100 Ω) y una senoide de 120 Hz; CH1 en la entrada y CH2 sobre el condensador.', aplicar: { alimentado: true, bm: { pos: 'off' }, sondas: { ch1: 'in', ch2: 'c', masa: '0' }, fn: { modo: 'osc', ch: [{ on: true, vDiv: 1, pos: -1.5, ac: false, x10: true }, { on: true, vDiv: 0.1, pos: 0, ac: true, x10: true }], sDiv: 2e-3, hpos: 0, disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 1.5 }, dds: { forma: 'seno', frecuencia: 120, amplitud: 3, salida: true }, cursores: 'no', mates: 'no', xy: false, prm: true } } },
      { texto: 'Con r = Vpp(C)/Vpp(entrada) y el condensador casi ideal (90° de desfase), |Z| = 100·r/√(1 − r²). A 120 Hz: <strong>13,3 Ω</strong>, y C = 1/(2π·120·|Z|) = 100 µF. A 100 kHz domina la ESR. Con señales pequeñas el ruido de la sonda ×10 infla el Vpp unos milivoltios: las medidas de pico son las más sensibles al ruido.' },
    ],
    comprobaciones: [
      { id: 'c', que: 'Capacidad', donde: 'Brymen ⊣⊢, sin alimentación', esperado: 100e-6, unidad: 'F', tol: { rel: 0.035 }, libro: 'un electrolítico medido a 120 Hz da su capacidad nominal', medir: (b) => (en(b, 'p12') && !b.alimentado && pos(b, 'cap') && b.brymen.sub === 0 ? brymen(b) : null) },
      { id: 'z', que: '|Z| a 120 Hz por divisor', donde: 'PRM: 100·r/√(1 − r²)', esperado: 13.3, unidad: 'Ω', tol: { rel: 0.08 }, libro: '|Z| = 13,3 Ω a 120 Hz (domina 1/ωC)', medir: (b) => { if (!en(b, 'p12')) return null; return conGenerador(b, 120, () => { const a = prm(b, 0, 'vpp'); const c = prm(b, 1, 'vpp'); if (!a || !c || c >= a) return null; const r = c / a; return (100 * r) / Math.sqrt(1 - r * r); }); } },
    ],
    leccion: 'Detectar un cero o comparar con un patrón es más preciso que medir en absoluto; y un componente medido a 100 Hz y a 100 kHz da valores distintos, ambos correctos.',
  },
];

/** Practice for a book section label. */
export function practicaDe(label: string): Practica | undefined {
  return PRACTICAS.find((p) => p.label === label);
}
