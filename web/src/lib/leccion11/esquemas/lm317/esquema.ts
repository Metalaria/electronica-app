// Schematic «lm317» (1.2, esquemas12c; sección 8.4): the adjustable regulator — the chip keeps its reference V_ref
// (1,25 V) between OUT and ADJ, so the current V_ref/R₁ flows down R₁ and on through R₂ to ground with the ADJ pin's own
// I_adj (about 50 µA): V_out = V_ref·(1 + R₂/R₁) + I_adj·R₂ (240 Ω and 720 Ω: 5,00 V, plus 36 mV of I_adj). Inside, as
// in «regulador-lineal»: an ideal pass element driven by the app's op-amp (comun-ao.ts) between 0 and V_in − dropout,
// which is how the dropout shows; the input current is the output's plus I_adj; the power meter is a «BMED» source.
import { ng, num } from '../comun';
import { lineasCC } from '../comun-ao';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

/** The error amplifier's view of the pieces: its rails are 0 V and V_in − dropout. */
function amplificador(c: ContextoNetlist): ContextoNetlist {
  const alto = c.p('entrada') - c.p('dropout');
  return {
    p: (k) => (k === 'vsat' ? alto : k === 'vsatneg' ? 0 : k === 'alto' ? 1 : c.p(k)),
    tiene: (k) => k === 'vsat' || k === 'vsatneg' || (k !== 'alto' && c.tiene(k)),
    cerrado: (k) => k === 'alto' || c.cerrado(k),
  };
}

const d: DefinicionEsquema = {
  nombre: 'lm317',
  titulo: 'Regulador ajustable LM317',
  resumen: 'La referencia de 1,25 V entre OUT y ADJ, R₁ de OUT a ADJ y R₂ de ADJ a masa; V_out = V_ref·(1 + R₂/R₁) + I_adj·R₂.',
  piezas: {
    entrada: { obligatoria: true, descripcion: 'tensión de entrada, V_in (V)' },
    r1: { obligatoria: true, descripcion: 'resistencia de OUT a ADJ, R₁ (Ω; el fabricante: 240 Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia de ADJ a masa, R₂ (Ω): la que ajusta la salida', color: 'azul' },
    ref: { descripcion: 'tensión de referencia entre OUT y ADJ, V_ref (V; sin ella, 1,25 V)' },
    iadj: { descripcion: 'corriente que sale de la patilla ADJ, I_adj (A; sin ella, 0; la hoja: unos 50 µA)' },
    dropout: { descripcion: 'tensión mínima entre entrada y salida (V; sin ella, 0; el LM317, unos 2 V)' },
    carga: { obligatoria: true, descripcion: 'resistencia de carga, R_L (Ω)', color: 'verde', seVeCon: 'interruptor' },
    interruptor: { interruptor: true, descripcion: 'conecta la carga (abierto: en vacío)', color: 'verde' },
    a0: { descripcion: 'ganancia del amplificador de error interno (sin ella, 10⁵)' },
  },
  observables: {
    vout: { medida: 'v(out)', analisis: 'op', unidad: 'V', descripcion: 'tensión de salida' },
    vadj: { medida: 'v(adj)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la patilla ADJ (la de R₂)' },
    vref: { medida: 'v(out)-v(adj)', analisis: 'op', unidad: 'V', descripcion: 'tensión en R₁, entre OUT y ADJ' },
    iin: { medida: 'i(vmi)', analisis: 'op', unidad: 'A', descripcion: 'corriente de entrada' },
    ir1: { medida: 'i(vmr)', analisis: 'op', unidad: 'A', descripcion: 'corriente por R₁' },
    icarga: { medida: 'i(vml)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga' },
    p_paso: { medida: 'v(pp)', analisis: 'op', unidad: 'W', descripcion: 'potencia disipada en el regulador, (V_in − V_out)·I_in' },
  },
  netlist(c) {
    const ref = c.tiene('ref') ? c.p('ref') : 1.25;
    const resto = [
      `VIN in 0 DC ${num(c.p('entrada'))}`,
      'VMI in inx 0',
      'FP inx 0 VMO 1',
      'EP e 0 b 0 1',
      'VMO e out 0',
      `VREF rp adj DC ${num(ref)}`,
      'VMR out r1 0',
      `R1 r1 adj ${ng(c.p('r1'))}`,
      `R2 adj 0 ${ng(c.p('r2'))}`,
      ...(c.tiene('iadj') ? [`IADJ inx adj DC ${num(c.p('iadj'))}`] : []),
      'VML out l 0',
      `RL l 0 ${c.cerrado('interruptor') ? ng(c.p('carga')) : '1e15'}`,
      'BMEDP pp 0 V = (v(in)-v(out))*i(vmi)',
    ];
    return lineasCC(amplificador(c), resto, { mas: 'rp', menos: 'out', salida: 'b' }).lineas;
  },
  describir: (c) =>
    `Regulador ajustable LM317 con entrada de ${c.val('entrada')}: ${c.sim('r1')} de ${c.val('r1')} de OUT a ADJ y ${c.sim('r2')} de ${c.val('r2')} de ADJ a masa; referencia de ${c.tiene('ref') ? c.val('ref') : '1,25 V'} entre OUT y ADJ${c.tiene('iadj') ? `; corriente de ADJ de ${c.val('iadj')}` : ''}${c.tiene('dropout') ? `; necesita ${c.val('dropout')} entre entrada y salida` : ''}; ${c.cerrado('interruptor') ? `carga ${c.sim('carga')} de ${c.val('carga')}` : 'sin carga'}`,
};
export default d;
