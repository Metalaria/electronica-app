// Schematic «regulador-lineal» (1.2, esquemas12): the linear regulator of sección 8.4, «un divisor de tensión cuya
// parte superior se ajusta sola»: a pass element in series between the input and the load, driven by an error
// amplifier that compares a reference V_ref with the output (or, with R₁ and R₂, with the divider's tap), so
// V_out = V_ref·(1 + R₁/R₂) while V_in − V_out stays above the dropout. The pass element is ideal: it follows the
// error amplifier without base current and takes from the input exactly what it delivers («la corriente de entrada es
// igual a la de salida», so P = (V_in − V_out)·I, sección 8.4 and problema 8.A); the error amplifier is the app's
// op-amp (comun-ao.ts) with its output between 0 and V_in − dropout, which is how the dropout shows: below it the
// output follows the input, V_out = V_in − V_do. DC only. The power meter is a «BMED» behavioural source (cc.ts).
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
  nombre: 'regulador-lineal',
  titulo: 'Regulador lineal: elemento de paso, referencia y lazo',
  resumen: 'Entrada, elemento de paso en serie con la carga, amplificador de error con su referencia (y divisor R₁–R₂); tensión, corrientes y potencia del paso.',
  piezas: {
    entrada: { obligatoria: true, descripcion: 'tensión de entrada, V_in (V)' },
    ref: { obligatoria: true, descripcion: 'tensión de referencia, V_ref (V)' },
    r1: { descripcion: 'resistencia del divisor, de la salida a la toma, R₁ (Ω; sin ella, V_out = V_ref)', color: 'azul' },
    r2: { descripcion: 'resistencia del divisor, de la toma a masa, R₂ (Ω; con R₁)', color: 'azul' },
    dropout: { descripcion: 'tensión mínima entre entrada y salida, V_do (V; sin ella, 0: el 78xx necesita unos 2 V, un LDO de 0,2 a 0,5 V)' },
    carga: { obligatoria: true, descripcion: 'resistencia de carga, R_L (Ω)', color: 'verde', seVeCon: 'interruptor' },
    interruptor: { interruptor: true, descripcion: 'conecta la carga (abierto: en vacío)', color: 'verde' },
    a0: { descripcion: 'ganancia en lazo abierto del amplificador de error (sin ella, 10⁵)' },
  },
  observables: {
    vout: { medida: 'v(out)', analisis: 'op', unidad: 'V', descripcion: 'tensión de salida' },
    iin: { medida: 'i(vmi)', analisis: 'op', unidad: 'A', descripcion: 'corriente de entrada' },
    iout: { medida: 'i(vmo)', analisis: 'op', unidad: 'A', descripcion: 'corriente que entrega el elemento de paso (carga y divisor)' },
    icarga: { medida: 'i(vml)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga' },
    vpaso: { medida: 'v(in)-v(out)', analisis: 'op', unidad: 'V', descripcion: 'tensión en el elemento de paso, V_in − V_out' },
    p_paso: { medida: 'v(pp)', analisis: 'op', unidad: 'W', descripcion: 'potencia disipada en el elemento de paso, (V_in − V_out)·I_in' },
    vb: { medida: 'v(b)', analisis: 'op', unidad: 'V', descripcion: 'salida del amplificador de error (la que gobierna el paso)' },
  },
  validar: (tiene) => (tiene('r1') !== tiene('r2') ? ['«r1» y «r2» van juntas (sin ellas, V_out = V_ref)'] : []),
  netlist(c) {
    const resto = [
      `VIN in 0 DC ${num(c.p('entrada'))}`,
      'VMI in inx 0',
      'FP inx 0 VMO 1',
      `VREF ref 0 DC ${num(c.p('ref'))}`,
      'EP e 0 b 0 1',
      'VMO e out 0',
      ...(c.tiene('r1') ? [`R1 out fb ${ng(c.p('r1'))}`, `R2 fb 0 ${ng(c.p('r2'))}`] : ['VFB out fb 0']),
      'VML out l 0',
      `RL l 0 ${c.cerrado('interruptor') ? ng(c.p('carga')) : '1e15'}`,
      'BMEDP pp 0 V = (v(in)-v(out))*i(vmi)',
    ];
    return lineasCC(amplificador(c), resto, { mas: 'ref', menos: 'fb', salida: 'b' }).lineas;
  },
  describir: (c) =>
    `Regulador lineal: entrada de ${c.val('entrada')}; elemento de paso en serie hasta la salida; amplificador de error que compara la referencia de ${c.val('ref')} con ${c.tiene('r1') ? `la toma del divisor ${c.sim('r1')} de ${c.val('r1')} y ${c.sim('r2')} de ${c.val('r2')}` : 'la salida'}${c.tiene('dropout') ? `; necesita ${c.val('dropout')} entre entrada y salida` : ''}; ${c.cerrado('interruptor') ? `carga ${c.sim('carga')} de ${c.val('carga')}` : 'sin carga'}`,
};
export default d;
