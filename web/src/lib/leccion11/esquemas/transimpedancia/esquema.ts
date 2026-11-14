// Schematic «transimpedancia» (1.2, esquemas12c; problema 26.B and the TIA row of sección 27.3): a current source (a
// photodiode) with its capacitance C_in into the − input, the + input to ground, R_f ∥ C_f from the output back to the
// − input. The input pieces are those of the op-amp family (comun-ao.ts piezasEntrada) in amperes: `entrada` a DC
// current, `amplitud`, `f`, `forma` a signal. Ideal, v_o = −R_f·i; with the app's op-amp of one pole
// A(s) = A₀/(1 + s/ω_p), ω_p = 2π·GBW/A₀, the transimpedance is v_o/i = −1/(Y_f + (s·C_in + Y_f)/A(s)), Y_f = 1/R_f +
// s·C_f: C_in against R_f makes the noise gain rise and, without enough C_f, a peak (and ringing) near
// √(GBW/(2π·R_f·C_in)). The transient starts in the DC state of the input's value at t = 0 (capacitors' «IC=»).
import { ng, num } from '../comun';
import { describirAO, entradaInicial, lineasCC, netlistAO, piezasAO, piezasEntrada } from '../comun-ao';
import { observablesCA } from '../comun-ca';
import { resolverCC } from '../../../leccion12/cc';
import type { ContextoDibujo, DefinicionEsquema } from '../tipos';

const AO = { mas: '0', menos: 'm', salida: 'out' };

const d: DefinicionEsquema = {
  nombre: 'transimpedancia',
  titulo: 'Amplificador de transimpedancia',
  resumen: 'Una fuente de corriente con C_in en la entrada −, R_f ∥ C_f de realimentación; v_o = −R_f·i y su respuesta en frecuencia con el GBW del operacional.',
  piezas: {
    ...piezasEntrada(),
    entrada: { obligatoria: true, descripcion: 'corriente de entrada en continua (A; con una señal, su valor medio), hacia la entrada −' },
    amplitud: { descripcion: 'amplitud de pico de la corriente de entrada (A)' },
    rf: { obligatoria: true, descripcion: 'resistencia de realimentación, R_f (Ω)', color: 'naranja' },
    cf: { descripcion: 'condensador de realimentación en paralelo con R_f, C_f (F)', color: 'naranja' },
    cin: { descripcion: 'capacidad de la entrada (el fotodiodo y el cable), C_in (F)', color: 'azul' },
    ...piezasAO(),
  },
  observables: {
    vo: { medida: 'v(out)', analisis: 'op', unidad: 'V', descripcion: 'tensión de salida en continua' },
    entrada: { medida: 'i(vmi)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de entrada frente al tiempo' },
    salida: { medida: 'v(out)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida frente al tiempo' },
    ...observablesCA('salida', 'v(out)', 'V', 'la tensión de salida (V por cada amperio de pico de la entrada, por su amplitud)'),
  },
  netlist(c, analisis) {
    // (the input source of the op-amp family, turned into a current into the − input through a meter)
    const corriente = (l: string) => l.replace(/^VIN in 0 /, 'IIN 0 mi ');
    let ic: Record<string, number> | null = null;
    const resto = (fuente: string) => [
      corriente(fuente),
      'VMI mi m 0',
      `RF out m ${ng(c.p('rf'))}`,
      ...(c.tiene('cf') ? [`CF out m ${ng(c.p('cf'))}${ic ? ` IC=${num((ic['out'] ?? 0) - (ic['m'] ?? 0))}` : ''}`] : []),
      ...(c.tiene('cin') ? [`CIN m 0 ${ng(c.p('cin'))}${ic ? ` IC=${num(ic['m'] ?? 0)}` : ''}`] : []),
    ];
    if (analisis === 'tran') ic = resolverCC(lineasCC(c, resto(`VIN in 0 DC ${num(entradaInicial(c))}`), AO).lineas)?.nodos ?? null;
    return netlistAO(c, analisis, resto, AO);
  },
  describir: (c: ContextoDibujo) =>
    `Amplificador de transimpedancia: corriente de entrada de ${c.tiene('amplitud') && c.tiene('f') ? `${c.val('amplitud')} de pico y ${c.val('f')}` : c.val('entrada')}${c.tiene('cin') ? ` con ${c.sim('cin')} de ${c.val('cin')}` : ''} a la entrada −; ${c.sim('rf')} de ${c.val('rf')}${c.tiene('cf') ? ` en paralelo con ${c.sim('cf')} de ${c.val('cf')}` : ''} de realimentación; ${describirAO(c)}`,
};
export default d;
