// Schematic «fuente-controlada» (1.2): a dependent source driven by the voltage v of an input port, with its output
// resistance and a load that a switch connects (sección 22.11 «Fuentes Dependientes en el Análisis»: «El transistor en
// pequeña señal es una fuente de corriente controlada por tensión», «gm = IC/VT es exactamente el coeficiente de una
// VCCS»; sección 22.8: «la fuente controlada gm·vbe del transistor con su ro en paralelo es una fuente Norton»). Two
// modes, by the piece the widget gives:
//   - `gm` (S): a VCCS, the current g_m·v into the output node, `ro` in parallel (the Norton form);
//   - `av` (V/V): a VCVS, the voltage A_v·v, `ro` in series (the Thévenin form; without it, an ideal source).
// The output's sign is the drawn one: the current (or the + terminal) towards the output node, so the output is
// +g_m·v·(r_o ∥ R_L); a lesson about an inverting stage writes its model with the minus sign and a negative v.
// 1.2 (esquemas12c, sección 43.3): the switch piece «invierte» turns the source round — the VCCS's arrow points to
// ground (its current g_m·v leaves the output node: v_o = −g_m·v·(r_o ∥ R_L), the common emitter's sign), the VCVS's
// + terminal goes to ground (v_o = −A_v·v in open circuit).
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'fuente-controlada',
  titulo: 'Fuente controlada por tensión (VCCS o VCVS) con carga',
  resumen: 'Una tensión de control v manda una fuente de corriente g_m·v (con r_o en paralelo) o de tensión A_v·v (con r_o en serie); carga en los bornes.',
  piezas: {
    control: { obligatoria: true, descripcion: 'tensión de control, v, la del puerto de entrada (V)' },
    gm: { descripcion: 'transconductancia de la fuente de corriente controlada, g_m (S): VCCS', color: 'naranja' },
    av: { descripcion: 'ganancia de la fuente de tensión controlada, A_v (V/V): VCVS', color: 'naranja' },
    ro: { descripcion: 'resistencia de salida: en paralelo con la VCCS (obligatoria con g_m), en serie con la VCVS (Ω)', color: 'azul' },
    carga: { obligatoria: true, descripcion: 'resistencia de carga (Ω)', color: 'verde', seVeCon: 'interruptor' },
    interruptor: { interruptor: true, descripcion: 'conecta la carga (abierto: en vacío)', color: 'verde' },
    invierte: { interruptor: true, descripcion: 'fuente invertida (1: la flecha hacia masa, o el borne + abajo: la salida cambia de signo, como en emisor común)', color: 'naranja' },
  },
  observables: {
    salida: { medida: 'v(s)', analisis: 'op', unidad: 'V', descripcion: 'tensión de salida, en los bornes' },
    carga: { medida: 'i(vcarga)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga' },
    controlada: { medida: 'i(vg)', analisis: 'op', unidad: 'A', descripcion: 'corriente que entrega la fuente controlada (hacia la salida; invertida, negativa)' },
    ro: { medida: 'i(vr)', analisis: 'op', unidad: 'A', descripcion: 'corriente por r_o (con g_m: la que baja por ella; con A_v: la de la carga)', requiere: ['ro'] },
  },
  validar: (tiene) => {
    if (tiene('gm') === tiene('av')) return ['«piezas»: una de las dos, «gm» (fuente de corriente, VCCS) o «av» (fuente de tensión, VCVS)'];
    if (tiene('gm') && !tiene('ro')) return ['«piezas.ro»: con «gm» hace falta la resistencia de salida en paralelo (una fuente de corriente ideal en vacío no tiene tensión definida)'];
    return [];
  },
  netlist: (c) => {
    const rl = c.cerrado('interruptor') ? ng(c.p('carga')) : '1e15';
    // (the input port only senses v: no current flows in it)
    const comun = [`VC c 0 DC ${num(c.p('control'))}`, 'VCARGA s l 0', `RL l 0 ${rl}`];
    // (inverted: the same source with its gain negated, so every meter keeps its drawn direction and reads the sign)
    const s = c.tiene('invierte') && c.cerrado('invierte') ? -1 : 1;
    if (c.tiene('gm'))
      // the current g_m·v leaves the source at g (SPICE: from n+ = 0 through the source to n− = g)
      return [...comun, `G1 0 g c 0 ${num(s * c.p('gm'))}`, 'VG g s 0', 'VR s r 0', `RO r 0 ${ng(c.p('ro'))}`];
    return [
      ...comun,
      `E1 e 0 c 0 ${num(s * c.p('av'))}`,
      'VG e m 0',
      c.tiene('ro') ? 'VR m r 0' : 'VR m s 0',
      ...(c.tiene('ro') ? [`RO r s ${ng(c.p('ro'))}`] : []),
    ];
  },
  describir: (c) => {
    const inv = c.tiene('invierte') && c.cerrado('invierte');
    const salida = c.cerrado('interruptor') ? `carga ${c.sim('carga')} de ${c.val('carga')} conectada` : 'bornes en vacío';
    if (c.tiene('gm'))
      return `Fuente de corriente controlada por tensión: ${c.sim('control')} de ${c.val('control')} en la entrada manda una corriente ${c.sim('gm')}·${c.sim('control')}${inv ? ' hacia masa (invertida)' : ''} con ${c.sim('gm')} de ${c.val('gm')}; ${c.sim('ro')} de ${c.val('ro')} en paralelo; ${salida}`;
    const ro = c.tiene('ro') ? `${c.sim('ro')} de ${c.val('ro')} en serie` : 'sin resistencia en serie';
    return `Fuente de tensión controlada por tensión: ${c.sim('control')} de ${c.val('control')} en la entrada manda una tensión ${c.sim('av')}·${c.sim('control')}${inv ? ' con el borne + hacia masa (invertida)' : ''} con ${c.sim('av')} de ${c.val('av')}; ${ro}; ${salida}`;
  },
};
export default d;
