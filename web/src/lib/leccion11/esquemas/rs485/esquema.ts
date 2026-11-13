// Schematic «rs485» (1.2, esquemas12d; secciones 45.6 Modbus, bloque 205 and ejercicio 45.11 / bloque 472, and the
// PROFIBUS of bloque 221): an RS-485 bus at rest, every driver off. The bias resistor R_p from D1 (B) to V_CC, the
// two terminations R_T between the wires at the ends, the n unit loads — «12 kΩ de cada hilo a su tensión interna»
// (bloque 472), here a source «ref» (V_CC/2 without it: then the loads are 24 kΩ/n between the wires, the book's
// series loop) — and the bias R_pd from D0 (A) to ground (R_p without it). V_BA = v(D1) − v(D0) must stay above the
// receivers' 200 mV threshold. «activa»: PROFIBUS' active termination (bloque 221: 390 Ω, 220 Ω, 390 Ω at each end),
// the bias repeated at the far end. «t1», «t2»: switches that fit each termination (a jumper closed only at the ends,
// bloque 502). DC; the living circuit colours it (linear).
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'rs485',
  titulo: 'Bus RS-485 en reposo: polarización, terminaciones y cargas',
  resumen: 'R_p de D1 a V_CC, las dos terminaciones R_T entre hilos, n cargas unidad y R_p de D0 a masa; la tensión V_BA en reposo (y la terminación activa de PROFIBUS).',
  piezas: {
    vcc: { obligatoria: true, descripcion: 'alimentación de la polarización, V_CC (V)' },
    rp: { obligatoria: true, descripcion: 'resistencia de polarización de D1 (B) a V_CC, R_p (Ω)', color: 'naranja' },
    rpd: { descripcion: 'resistencia de polarización de D0 (A) a masa (Ω; sin ella, la misma R_p)', color: 'naranja' },
    rt: { obligatoria: true, descripcion: 'resistencia de cada terminación entre D1 y D0, R_T (Ω)', color: 'azul' },
    t1: { interruptor: true, descripcion: 'pone la terminación del extremo cercano (sin la pieza, puesta)', color: 'azul' },
    t2: { interruptor: true, descripcion: 'pone la terminación del extremo lejano (sin la pieza, puesta)', color: 'azul' },
    activa: { interruptor: true, descripcion: 'terminación activa (PROFIBUS): la polarización también en el extremo lejano (abierto o sin la pieza: solo en el cercano)', color: 'naranja' },
    n: { obligatoria: true, descripcion: 'número de cargas unidad (0 a 256; los receptores)', color: 'verde' },
    ru: { descripcion: 'resistencia de una carga unidad de cada hilo a su tensión interna (Ω; sin ella, 12 kΩ)', color: 'verde' },
    ref: { descripcion: 'tensión interna de los receptores (V; sin ella, V_CC/2)', color: 'verde' },
  },
  observables: {
    vba: { medida: 'v(d1)-v(d0)', analisis: 'op', unidad: 'V', descripcion: 'tensión diferencial del bus en reposo, V_BA = v(D1) − v(D0)' },
    vd1: { medida: 'v(d1)', analisis: 'op', unidad: 'V', descripcion: 'tensión de D1 (B) respecto a masa' },
    vd0: { medida: 'v(d0)', analisis: 'op', unidad: 'V', descripcion: 'tensión de D0 (A) respecto a masa' },
    ipol: { medida: 'i(vmp)', analisis: 'op', unidad: 'A', descripcion: 'corriente de la polarización desde V_CC (las dos, con «activa»)' },
    it: { medida: 'i(vmt)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la terminación del extremo cercano' },
  },
  netlist(c) {
    const rp = c.p('rp');
    const rpd = c.tiene('rpd') ? c.p('rpd') : rp;
    const n = Math.max(0, Math.round(c.p('n')));
    const ru = c.tiene('ru') ? c.p('ru') : 12000;
    const ref = c.tiene('ref') ? c.p('ref') : c.p('vcc') / 2;
    const activa = c.tiene('activa') && c.cerrado('activa');
    return [
      `VCC vcc 0 DC ${num(c.p('vcc'))}`,
      'VMP vcc p 0',
      `RP1 p d1 ${ng(rp)}`,
      `RPD1 d0 0 ${ng(rpd)}`,
      ...(c.cerrado('t1') ? ['VMT d1 t 0', `RT1 t d0 ${ng(c.p('rt'))}`] : ['VMT d1 t 0']),
      ...(c.cerrado('t2') ? [`RT2 d1 d0 ${ng(c.p('rt'))}`] : []),
      ...(activa ? [`RP2 p d1 ${ng(rp)}`, `RPD2 d0 0 ${ng(rpd)}`] : []),
      ...(n > 0 ? [`VREF cm 0 DC ${num(ref)}`, `RU1 d1 cm ${ng(ru / n)}`, `RU0 d0 cm ${ng(ru / n)}`] : []),
    ];
  },
  describir: (c) => {
    const n = Math.max(0, Math.round(c.p('n')));
    const ter = [c.cerrado('t1') ? 'en el extremo cercano' : '', c.cerrado('t2') ? 'en el lejano' : ''].filter(Boolean);
    return `Bus RS-485 en reposo: ${c.sim('rp')} de ${c.val('rp')} de D1 a ${c.val('vcc')} y ${c.tiene('rpd') ? `${c.sim('rpd')} de ${c.val('rpd')}` : 'otra igual'} de D0 a masa${c.tiene('activa') && c.cerrado('activa') ? ', repetidas en el extremo lejano (terminación activa)' : ''}; ${ter.length ? `terminación ${c.sim('rt')} de ${c.val('rt')} ${ter.join(' y ')}` : 'sin terminaciones'}; ${n} ${n === 1 ? 'carga unidad' : 'cargas unidad'}`;
  },
};
export default d;
