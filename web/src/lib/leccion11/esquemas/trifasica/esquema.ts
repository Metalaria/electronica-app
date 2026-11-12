// Schematic «trifasica» (1.2, esquemas12): the three-phase supply of sección 23.10 («Sistemas Trifásicos»): three sine
// sources of the same amplitude at 0°, −120° and +120° (V₁ = V_f∠0°, V₂ = V_f∠−120°, V₃ = V_f∠+120°; the values are
// effective or peak alike: the circuit is linear) and three resistive loads R₁, R₂ and R₃, in star — with the neutral
// joining the star point to the supply's, or cut (the star point floats: 139 V, 263 V and 331 V with 26,45 Ω,
// 52,9 Ω and 264,5 Ω; Millman, 112,7 V) — or in delta (R₁ from L1 to L2, R₂ from L2 to L3, R₃ from L3 to L1). The
// readings are AC phasors at the frequency `f` (amplitude and phase) or curves against time (the steady state from
// t = 0: there is nothing to settle in a resistive load).
import { ng, num } from '../comun';
import { observablesCA } from '../comun-ca';
import type { DefinicionEsquema, Observable } from '../tipos';

const tiempo = (medida: string, unidad: string, descripcion: string): Observable => ({ medida, analisis: 'tran', unidad, descripcion });

const d: DefinicionEsquema = {
  nombre: 'trifasica',
  titulo: 'Sistema trifásico con carga en estrella o en triángulo',
  resumen: 'Tres fuentes a 120°, tres cargas resistivas en estrella (con el neutro conectado o cortado) o en triángulo; tensiones de las cargas, corrientes de línea y del neutro.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de fase de cada fuente, V_f (V, eficaz o de pico)' },
    f: { obligatoria: true, descripcion: 'frecuencia (Hz)' },
    r1: { obligatoria: true, descripcion: 'carga de la fase 1, R₁ (Ω; en triángulo, de L1 a L2)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'carga de la fase 2, R₂ (Ω; en triángulo, de L2 a L3)', color: 'naranja' },
    r3: { obligatoria: true, descripcion: 'carga de la fase 3, R₃ (Ω; en triángulo, de L3 a L1)', color: 'verde' },
    neutro: { interruptor: true, descripcion: 'neutro conectado (1) o cortado (0); sin él, conectado (solo en estrella)' },
    triangulo: { interruptor: true, descripcion: 'conexión: 1 en triángulo, 0 en estrella (sin ella, estrella)' },
  },
  observables: {
    ...observablesCA('v1', 'v(p1)-v(q1)', 'V', 'la tensión de la carga 1'),
    ...observablesCA('v2', 'v(p2)-v(q2)', 'V', 'la tensión de la carga 2'),
    ...observablesCA('v3', 'v(p3)-v(q3)', 'V', 'la tensión de la carga 3'),
    ...observablesCA('i1', 'i(vm1)', 'A', 'la corriente de la línea L1'),
    ...observablesCA('i2', 'i(vm2)', 'A', 'la corriente de la línea L2'),
    ...observablesCA('i3', 'i(vm3)', 'A', 'la corriente de la línea L3'),
    ...observablesCA('ir1', 'i(vj1)', 'A', 'la corriente de la carga 1'),
    ...observablesCA('ir2', 'i(vj2)', 'A', 'la corriente de la carga 2'),
    ...observablesCA('ir3', 'i(vj3)', 'A', 'la corriente de la carga 3'),
    ...observablesCA('in', 'i(vmn)', 'A', 'la corriente del neutro (hacia la fuente)'),
    ...observablesCA('vn', 'v(s)', 'V', 'la tensión del punto de estrella respecto al neutro'),
    t_v1: tiempo('v(p1)-v(q1)', 'V', 'tensión de la carga 1 frente al tiempo'),
    t_v2: tiempo('v(p2)-v(q2)', 'V', 'tensión de la carga 2 frente al tiempo'),
    t_v3: tiempo('v(p3)-v(q3)', 'V', 'tensión de la carga 3 frente al tiempo'),
    t_i1: tiempo('i(vm1)', 'A', 'corriente de la línea L1 frente al tiempo'),
    t_in: tiempo('i(vmn)', 'A', 'corriente del neutro frente al tiempo'),
    t_vn: tiempo('v(s)', 'V', 'tensión del punto de estrella frente al tiempo'),
  },
  validar: (tiene) => (tiene('neutro') && tiene('triangulo') ? ['«neutro» es de la estrella: en triángulo no hay punto de estrella (use «neutro» o «triangulo», no los dos)'] : []),
  netlist(c) {
    const v = num(c.p('fuente'));
    const f = num(c.p('f'));
    const fase = (k: number, g: number) => `V${k} l${k} 0 DC 0 AC ${v} ${g} SIN(0 ${v} ${f} 0 0 ${g})`;
    const delta = c.tiene('triangulo') && c.cerrado('triangulo');
    // each load between p_k and q_k, joined by 0 V meters (vj_k: the load's current) to its two ends
    const fin = delta ? ['a2', 'a3', 'a1'] : ['s', 's', 's'];
    const neutro = !delta && c.cerrado('neutro');
    return [
      fase(1, 0),
      fase(2, -120),
      fase(3, 120),
      'VM1 l1 a1 0',
      'VM2 l2 a2 0',
      'VM3 l3 a3 0',
      ...[1, 2, 3].flatMap((k) => [`VJ${k} a${k} p${k} 0`, `R${k} p${k} q${k} ${ng(c.p(`r${k}`))}`, `VK${k} q${k} ${fin[k - 1]} 0`]),
      // the neutral: from the star point back to the supply's (cut: open, the meter reads 0)
      neutro ? 'VMN s 0 0' : 'VMN s nn 0',
      ...(neutro ? [] : ['RNN nn 0 1e15']),
    ];
  },
  describir: (c) => {
    const delta = c.tiene('triangulo') && c.cerrado('triangulo');
    const cargas = `${c.sim('r1')} de ${c.val('r1')}, ${c.sim('r2')} de ${c.val('r2')} y ${c.sim('r3')} de ${c.val('r3')}`;
    return `Sistema trifásico: tres fuentes de ${c.val('fuente')} y ${c.val('f')} desfasadas 120°; cargas ${cargas} ${delta ? 'en triángulo' : `en estrella con el neutro ${c.cerrado('neutro') ? 'conectado' : 'cortado'}`}`;
  },
};
export default d;
