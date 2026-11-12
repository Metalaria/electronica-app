// Schematic «rlc-escalon» (1.2, esquemas12): a series RLC switched at t = 0 onto a DC source (the two-way switch of
// carga-rc: 1 to the source, 0 to a short — the ringing of a charged capacitor), the second-order step response of
// sección 24.3: ω₀ = 1/√(LC), ζ = (R/2)·√(C/L); overdamped (ζ > 1), critically damped (ζ = 1) or underdamped
// (ζ < 1, the overshoot e^(−πζ/√(1−ζ²))). The coil starts with `i0` and the capacitor with `v0` (default 0).
// Curves against time: the simulator's transient from that initial state.
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'rlc-escalon',
  titulo: 'Escalón en un RLC en serie (respuesta de segundo orden)',
  resumen: 'Fuente continua, conmutador, R, L y C en serie desde t = 0; v_C(t), i(t) y v_L(t) en los tres amortiguamientos.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    r: { obligatoria: true, descripcion: 'resistencia (Ω)', color: 'azul' },
    l: { obligatoria: true, descripcion: 'inductancia (H)', color: 'naranja' },
    c: { obligatoria: true, descripcion: 'capacidad (F)', color: 'verde' },
    v0: { descripcion: 'tensión del condensador en t = 0 (V; sin ella, 0)' },
    i0: { descripcion: 'corriente de la bobina en t = 0 (A; sin ella, 0)' },
    interruptor: { interruptor: true, descripcion: 'conmutador: 1 a la fuente, 0 a un cortocircuito (sin él, a la fuente)' },
  },
  observables: {
    vc: { medida: 'v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del condensador, v_C(t)' },
    i: { medida: 'i(vmed)', analisis: 'tran', unidad: 'A', descripcion: 'corriente del lazo (positiva hacia el condensador)' },
    vl: { medida: 'v(b)-v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la bobina, v_L(t)' },
    vr: { medida: 'v(a)-v(b)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la resistencia' },
  },
  netlist: (c) => [
    `VF fte 0 DC ${c.cerrado('interruptor') ? num(c.p('fuente')) : 0}`,
    'VMED fte a 0',
    `R1 a b ${ng(c.p('r'))}`,
    `L1 b c ${ng(c.p('l'))} IC=${num(c.p('i0'))}`,
    `C1 c 0 ${ng(c.p('c'))} IC=${num(c.p('v0'))}`,
  ],
  describir: (c) =>
    `Circuito RLC en serie conectado en t = 0 ${c.cerrado('interruptor') ? `a una fuente de ${c.val('fuente')}` : 'a un cortocircuito'}: ${c.sim('r')} de ${c.val('r')}, ${c.sim('l')} de ${c.val('l')} y ${c.sim('c')} de ${c.val('c')}${c.tiene('v0') ? `; el condensador empieza con ${c.val('v0')}` : ''}${c.tiene('i0') ? ` y la bobina con ${c.val('i0')}` : ''}`,
};
export default d;
