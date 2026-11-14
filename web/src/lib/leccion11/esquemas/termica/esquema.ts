// Schematic «termica» (1.2, esquemas12d; secciones 10.5 and 10.11, problema 10.B; bloque 133 «La analogía no es una
// metáfora: las ecuaciones son literalmente las mismas»): the thermal chain of a power device as the circuit it is —
// the dissipated power P a current source into the junction node, the thermal resistances R_jc (junction–case),
// R_cs (case–heatsink: paste, a mica washer) and R_sa (heatsink–ambient) in series to the ambient temperature T_a,
// a voltage source. Node «voltages» are temperatures (°C), the «current» is the heat flow (W): T_j = T_a +
// P·(R_jc + R_cs + R_sa) (bloque 123). Without a heatsink («disipador» open, with «rja», the datasheet's R_ja) the case
// goes straight to the ambient through R_ja − R_jc. Optional thermal capacitances (J/°C) from the junction, the case
// and the heatsink to the reference: the transient from the ambient temperature when P is switched on at t = 0 (and
// off after «duracion»). The capacitors go to the 0 °C rail starting at T_a, which is the same as hanging them from
// the (constant) ambient.
import { ng, num } from '../comun';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

/** With a heatsink: «disipador» closed or absent (without «rja» there is always one). */
export const conDisipador = (c: ContextoNetlist): boolean => !c.tiene('rja') || c.cerrado('disipador');

const d: DefinicionEsquema = {
  nombre: 'termica',
  titulo: 'Cadena térmica: unión, cápsula, disipador y ambiente',
  resumen: 'La potencia como una fuente de corriente, las resistencias térmicas en serie hasta el ambiente (una fuente de tensión) y las capacidades térmicas; temperaturas en °C.',
  piezas: {
    p: { obligatoria: true, descripcion: 'potencia disipada en la unión, P (W): la «corriente» de calor' },
    ta: { obligatoria: true, descripcion: 'temperatura ambiente, T_a (°C): la «tensión» de referencia' },
    rjc: { obligatoria: true, descripcion: 'resistencia térmica unión-cápsula, R_jc (°C/W)', color: 'naranja' },
    rcs: { descripcion: 'resistencia térmica cápsula-disipador, R_cs (°C/W: pasta, arandela; sin ella, 0)', color: 'azul' },
    rsa: { descripcion: 'resistencia térmica disipador-ambiente, R_sa (°C/W; obligatoria salvo sin disipador)', color: 'verde' },
    rja: { descripcion: 'resistencia térmica unión-ambiente sin disipador, R_ja (°C/W, la de la hoja de datos): con «disipador» abierto, la cápsula va al ambiente por R_ja − R_jc' },
    disipador: { interruptor: true, descripcion: 'monta el disipador (cerrado: R_cs y R_sa; abierto: R_ja de la cápsula sola)', color: 'verde' },
    cj: { descripcion: 'capacidad térmica de la unión (J/°C)', color: 'naranja' },
    cc: { descripcion: 'capacidad térmica de la cápsula (J/°C)', color: 'azul' },
    cs: { descripcion: 'capacidad térmica del disipador (J/°C)', color: 'verde' },
    duracion: { descripcion: 'en el transitorio, la potencia se corta tras este tiempo (s; sin ella, sigue)' },
  },
  observables: {
    tj: { medida: 'v(j)', analisis: 'op', unidad: '°C', descripcion: 'temperatura de la unión' },
    tc: { medida: 'v(c)', analisis: 'op', unidad: '°C', descripcion: 'temperatura de la cápsula' },
    ts: { medida: 'v(s)', analisis: 'op', unidad: '°C', descripcion: 'temperatura del disipador (sin disipador, la de la cápsula)' },
    flujo: { medida: 'i(vmq)', analisis: 'op', unidad: 'W', descripcion: 'flujo de calor por la cadena (en continua, P)' },
    union: { medida: 'v(j)', analisis: 'tran', unidad: '°C', descripcion: 'temperatura de la unión frente al tiempo' },
    capsula: { medida: 'v(c)', analisis: 'tran', unidad: '°C', descripcion: 'temperatura de la cápsula frente al tiempo' },
    radiador: { medida: 'v(s)', analisis: 'tran', unidad: '°C', descripcion: 'temperatura del disipador frente al tiempo' },
  },
  validar: (tiene) => [
    ...(!tiene('rsa') && !tiene('rja') ? ['hace falta «rsa» (el disipador) o «rja» (sin disipador)'] : []),
    ...(tiene('disipador') && !tiene('rja') ? ['«disipador» quita el disipador: hace falta «rja», la resistencia sin él'] : []),
    ...(tiene('disipador') && !tiene('rsa') ? ['«disipador» lo monta: hace falta «rsa»'] : []),
    ...(tiene('duracion') && !tiene('cj') && !tiene('cc') && !tiene('cs') ? ['«duracion» corta la potencia en el transitorio: sin capacidades térmicas no hay transitorio'] : []),
  ],
  netlist(c) {
    const p = c.p('p');
    const ta = c.p('ta');
    const pulso = c.tiene('duracion') && c.p('duracion') > 0 ? ` PULSE(${num(p)} 0 ${num(c.p('duracion'))} ${num(c.p('duracion') * 1e-4)} ${num(c.p('duracion') * 1e-4)} 1e30 2e30)` : '';
    const disip = conDisipador(c);
    return [
      `IP 0 j DC ${num(p)}${pulso}`,
      'VMQ j jm 0',
      `RJC jm c ${ng(c.p('rjc'))}`,
      ...(disip
        ? [c.tiene('rcs') && c.p('rcs') > 0 ? `RCS c s ${ng(c.p('rcs'))}` : 'VCS c s 0', `RSA s a ${ng(c.p('rsa'))}`]
        : ['VCS c s 0', `RCA s a ${ng(Math.max(1e-6, c.p('rja') - c.p('rjc')))}`]),
      `VTA a 0 DC ${num(ta)}`,
      ...(c.tiene('cj') ? [`CJ j 0 ${ng(c.p('cj'))} IC=${num(ta)}`] : []),
      ...(c.tiene('cc') ? [`CC c 0 ${ng(c.p('cc'))} IC=${num(ta)}`] : []),
      ...(c.tiene('cs') && disip ? [`CS s 0 ${ng(c.p('cs'))} IC=${num(ta)}`] : []),
    ];
  },
  tran: { bordes: () => 0.0015 },
  describir: (c) =>
    `Cadena térmica: ${c.val('p')} disipados en la unión; ${c.sim('rjc')} de ${c.val('rjc')} de la unión a la cápsula; ${
      conDisipador(c)
        ? `${c.tiene('rcs') ? `${c.sim('rcs')} de ${c.val('rcs')} de la cápsula al disipador y ` : 'la cápsula unida al disipador y '}${c.sim('rsa')} de ${c.val('rsa')} del disipador al ambiente`
        : `sin disipador, de la cápsula al ambiente lo que falta hasta ${c.sim('rja')} de ${c.val('rja')}`
    }, a ${c.val('ta')}${c.tiene('cj') || c.tiene('cc') || c.tiene('cs') ? '; con las capacidades térmicas de cada nodo' : ''}. Las tensiones son temperaturas y la corriente, el calor`,
};
export default d;
