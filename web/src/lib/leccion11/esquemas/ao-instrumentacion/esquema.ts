// Schematic «ao-instrumentacion» (1.2, esquemas12c; sección 27.7 and problema 26.A): the three-op-amp instrumentation
// amplifier — two non-inverting input buffers U₁ (input v₁) and U₂ (input v₂) with R from each output to its − input
// and R_G between the two − inputs, then the difference amplifier U₃ (R₃ from each buffer's output, R₄ to the output
// and to the reference pin V_ref). Matched, v_o = (1 + 2R/R_G)·(R₄/R₃)·(v₂ − v₁) + V_ref, and the common mode passes
// the first stage at unity and is cancelled by the second. The mismatch «desajuste» ε makes the R₄ to the reference
// R₄·(1 + ε): the common-mode gain is then (R₄/R₃)·ε/(1 + R₄/R₃·(1 + ε))·(1 + R₃/R₄)… — with R₃ = R₄, ε/(2 + ε) — and
// the CMRR finite. The op-amps are linear with A₀ = 10⁷ (piece «a0»: lower it to see the gain error): no rails. Inputs:
// DC levels v₁, v₂ and, in AC and the transient, a differential signal «ad» (−ad/2 on v₁, +ad/2 on v₂: positive ad
// gives a positive output) and a common-mode one «acm» at the frequency f.
import { ng, num } from '../comun';
import { observablesCA } from '../comun-ca';
import type { DefinicionEsquema } from '../tipos';

function fuente(nombre: string, nodo: string, dc: number, s: number, f: number, senal: boolean): string {
  if (!senal) return `${nombre} ${nodo} 0 DC ${num(dc)}`;
  return `${nombre} ${nodo} 0 DC ${num(dc)} AC ${num(Math.abs(s))} ${s < 0 ? 180 : 0} SIN(${num(dc)} ${num(s)} ${num(f)})`;
}

const d: DefinicionEsquema = {
  nombre: 'ao-instrumentacion',
  titulo: 'Amplificador de instrumentación de tres operacionales',
  resumen: 'Dos seguidores con ganancia (R y R_G) y un amplificador diferencial (R₃, R₄, referencia); ganancia diferencial, error de modo común con un desajuste.',
  piezas: {
    v1: { obligatoria: true, descripcion: 'tensión continua de la entrada − (la de U₁), v₁ (V)', color: 'azul' },
    v2: { obligatoria: true, descripcion: 'tensión continua de la entrada + (la de U₂), v₂ (V)', color: 'azul' },
    ad: { descripcion: 'señal diferencial de pico (V): −ad/2 en v₁ y +ad/2 en v₂', color: 'azul' },
    acm: { descripcion: 'señal de modo común de pico (V), en las dos entradas', color: 'azul' },
    f: { descripcion: 'frecuencia de las señales (Hz; obligatoria con «ad» o «acm»)' },
    r: { obligatoria: true, descripcion: 'resistencia de realimentación de cada seguidor, R (Ω)', color: 'naranja' },
    rg: { obligatoria: true, descripcion: 'resistencia de ganancia entre las entradas −, R_G (Ω)', color: 'verde' },
    r3: { obligatoria: true, descripcion: 'resistencias de entrada del diferencial, R₃ (Ω)', color: 'azul' },
    r4: { obligatoria: true, descripcion: 'resistencias de realimentación y de referencia del diferencial, R₄ (Ω)', color: 'naranja' },
    desajuste: { descripcion: 'desajuste ε de la R₄ de la referencia: R₄·(1 + ε) (sin él, emparejadas)', color: 'naranja' },
    ref: { descripcion: 'tensión de la patilla de referencia, V_ref (V; sin ella, masa)' },
    a0: { descripcion: 'ganancia en lazo abierto de los tres operacionales (sin ella, 10⁷)', color: 'verde' },
  },
  observables: {
    vo: { medida: 'v(out)', analisis: 'op', unidad: 'V', descripcion: 'tensión de salida' },
    vo1: { medida: 'v(o1)', analisis: 'op', unidad: 'V', descripcion: 'salida del seguidor U₁' },
    vo2: { medida: 'v(o2)', analisis: 'op', unidad: 'V', descripcion: 'salida del seguidor U₂' },
    irg: { medida: 'i(vrg)', analisis: 'op', unidad: 'A', descripcion: 'corriente por R_G (de U₁ hacia U₂)' },
    salida: { medida: 'v(out)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida frente al tiempo' },
    entrada1: { medida: 'v(in1)', analisis: 'tran', unidad: 'V', descripcion: 'entrada v₁ frente al tiempo' },
    entrada2: { medida: 'v(in2)', analisis: 'tran', unidad: 'V', descripcion: 'entrada v₂ frente al tiempo' },
    ...observablesCA('salida', 'v(out)', 'V', 'la tensión de salida'),
  },
  validar: (tiene) => ((tiene('ad') || tiene('acm')) && !tiene('f') ? ['con «ad» o «acm» hace falta «f»'] : []),
  netlist: (c) => {
    const A = c.tiene('a0') && c.p('a0') > 0 ? c.p('a0') : 1e7;
    const senal = (c.tiene('ad') || c.tiene('acm')) && c.p('f') > 0;
    return [
      fuente('V1', 'in1', c.p('v1'), c.p('acm') - c.p('ad') / 2, c.p('f'), senal),
      fuente('V2', 'in2', c.p('v2'), c.p('acm') + c.p('ad') / 2, c.p('f'), senal),
      `E1 o1 0 in1 n1 ${num(A)}`,
      `E2 o2 0 in2 n2 ${num(A)}`,
      `RA o1 n1 ${ng(c.p('r'))}`,
      `RB o2 n2 ${ng(c.p('r'))}`,
      'VRG n1 g 0',
      `RG g n2 ${ng(c.p('rg'))}`,
      `R3A o1 m3 ${ng(c.p('r3'))}`,
      `R4A m3 out ${ng(c.p('r4'))}`,
      `R3B o2 p3 ${ng(c.p('r3'))}`,
      `R4B p3 rf ${ng(c.p('r4') * (1 + c.p('desajuste')))}`,
      c.tiene('ref') ? `VREF rf 0 DC ${num(c.p('ref'))}` : 'VREF rf 0 0',
      `E3 out 0 p3 m3 ${num(A)}`,
    ];
  },
  describir: (c) =>
    `Amplificador de instrumentación: entradas de ${c.val('v1')} y ${c.val('v2')}${c.tiene('ad') ? `, señal diferencial de ${c.val('ad')}` : ''}${c.tiene('acm') ? `, de modo común de ${c.val('acm')}` : ''}; seguidores con ${c.sim('r')} de ${c.val('r')} y ${c.sim('rg')} de ${c.val('rg')} entre ellos; diferencial con ${c.sim('r3')} de ${c.val('r3')} y ${c.sim('r4')} de ${c.val('r4')}${c.tiene('desajuste') && c.p('desajuste') ? `, la de referencia desajustada ${c.val('desajuste')}` : ''}; referencia ${c.tiene('ref') ? `de ${c.val('ref')}` : 'a masa'}`,
};
export default d;
