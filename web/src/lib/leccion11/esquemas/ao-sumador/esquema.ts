// Schematic «ao-sumador» (1.2, esquemas12): the inverting summing amplifier (sección 8.2): two or three inputs, each
// through its resistor to the − input (the virtual ground), R_f from there to the output, the + input to ground:
// v_o = −R_f·(v₁/R₁ + v₂/R₂ + v₃/R₃). Input 1 may carry a signal (comun-ao.ts piezasEntrada); inputs 2 and 3 are DC.
// The amplifier is the app's model (comun-ao.ts).
import { ng, num } from '../comun';
import { bordesEntrada, describirAO, describirEntrada, netlistAO, observablesAO, piezasAO, piezasEntrada } from '../comun-ao';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'ao-sumador',
  titulo: 'Sumador inversor con operacional',
  resumen: 'Dos o tres entradas, cada una por su resistencia a la entrada −, R_f a la salida: v_o = −R_f·(v₁/R₁ + v₂/R₂ + v₃/R₃).',
  piezas: {
    ...piezasEntrada(),
    r1: { obligatoria: true, descripcion: 'resistencia de la entrada 1, R₁ (Ω)', color: 'azul' },
    entrada2: { obligatoria: true, descripcion: 'tensión de la entrada 2, v₂ (V, continua)' },
    r2: { obligatoria: true, descripcion: 'resistencia de la entrada 2, R₂ (Ω)', color: 'azul' },
    entrada3: { descripcion: 'tensión de la entrada 3, v₃ (V, continua)' },
    r3: { descripcion: 'resistencia de la entrada 3, R₃ (Ω; con «entrada3»)', color: 'azul' },
    rf: { obligatoria: true, descripcion: 'resistencia de realimentación, R_f (Ω)', color: 'naranja' },
    ...piezasAO(),
  },
  observables: {
    ...observablesAO(),
    vmenos: { medida: 'v(mn)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la entrada − (la masa virtual)' },
    i1: { medida: 'i(vm1)', analisis: 'op', unidad: 'A', descripcion: 'corriente por R₁ (hacia la entrada −)' },
    i2: { medida: 'i(vm2)', analisis: 'op', unidad: 'A', descripcion: 'corriente por R₂ (hacia la entrada −)' },
    i3: { medida: 'i(vm3)', analisis: 'op', unidad: 'A', descripcion: 'corriente por R₃ (hacia la entrada −)', requiere: ['entrada3'] },
    irf: { medida: 'i(vmf)', analisis: 'op', unidad: 'A', descripcion: 'corriente por R_f (de la entrada − a la salida)' },
  },
  validar: (tiene) => (tiene('entrada3') !== tiene('r3') ? ['«entrada3» y «r3» van juntas'] : []),
  netlist: (c, analisis) =>
    netlistAO(
      c,
      analisis,
      (fuente) => [
        fuente,
        'VM1 in a1 0',
        `R1 a1 mn ${ng(c.p('r1'))}`,
        `V2 in2 0 DC ${num(c.p('entrada2'))}`,
        'VM2 in2 a2 0',
        `R2 a2 mn ${ng(c.p('r2'))}`,
        ...(c.tiene('entrada3') ? [`V3 in3 0 DC ${num(c.p('entrada3'))}`, 'VM3 in3 a3 0', `R3 a3 mn ${ng(c.p('r3'))}`] : []),
        'VMF mn f 0',
        `RF f out ${ng(c.p('rf'))}`,
      ],
      { mas: '0', menos: 'mn', salida: 'out' },
    ),
  tran: { bordes: bordesEntrada },
  describir: (c) =>
    `Sumador inversor: ${describirEntrada(c)} por ${c.sim('r1')} de ${c.val('r1')}; ${c.val('entrada2')} por ${c.sim('r2')} de ${c.val('r2')}${c.tiene('entrada3') ? `; ${c.val('entrada3')} por ${c.sim('r3')} de ${c.val('r3')}` : ''}, todas a la entrada −; ${c.sim('rf')} de ${c.val('rf')} a la salida; entrada + a masa; ${describirAO(c)}`,
};
export default d;
