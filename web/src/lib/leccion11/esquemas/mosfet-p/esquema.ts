// Schematic «mosfet-p» (1.2, esquemas12c; sección 8.8 and the high-side switch): a P-channel enhancement MOSFET with
// its source at V_DD and the load R_D from the drain to ground; the gate from a source V_G (to ground) through R_G, and
// optionally R_GS from the gate to the source (the pull-up that keeps it off). The book's square law with the signs
// turned round (sección 7.2): V_SG = V_DD − V_G, and with |V_th| = vth, in saturation I_D = ½·k·(V_SG − |V_th|)², in the
// ohmic region I_D = k·((V_SG − |V_th|)·V_SD − V_SD²/2), nothing below |V_th|: ngspice's LEVEL=1 PMOS with KP = k and
// VTO = −vth, the body tied to the source. It conducts with the gate LOW. The body diode is drawn, not simulated.
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'mosfet-p',
  titulo: 'MOSFET de canal P en el lado alto',
  resumen: 'Fuente en V_DD, la carga del drenador a masa; conduce con la puerta baja: |V_GS| por encima de |V_th|.',
  piezas: {
    vdd: { obligatoria: true, descripcion: 'alimentación, V_DD (V): la fuente del MOSFET' },
    rd: { obligatoria: true, descripcion: 'carga del drenador a masa, R_D (Ω)', color: 'naranja' },
    entrada: { obligatoria: true, descripcion: 'tensión de la fuente de puerta respecto de masa, V_G (V; baja: conduce)' },
    rg: { descripcion: 'resistencia de puerta, R_G (Ω)', color: 'azul' },
    rgs: { descripcion: 'resistencia de la puerta a la fuente (a V_DD), R_GS (Ω)', color: 'azul' },
    k: { obligatoria: true, descripcion: 'parámetro de transconductancia, k (A/V²)' },
    vth: { obligatoria: true, descripcion: 'tensión umbral en valor absoluto, |V_th| (V)' },
    lambda: { descripcion: 'modulación de la longitud del canal, λ (1/V)' },
  },
  observables: {
    id: { medida: 'i(vmd)', analisis: 'op', unidad: 'A', descripcion: 'corriente de drenador (hacia la carga)' },
    vsd: { medida: 'v(vdd)-v(d)', analisis: 'op', unidad: 'V', descripcion: 'tensión fuente-drenador, V_SD' },
    vsg: { medida: 'v(vdd)-v(g)', analisis: 'op', unidad: 'V', descripcion: 'tensión fuente-puerta, V_SG' },
    vd: { medida: 'v(d)', analisis: 'op', unidad: 'V', descripcion: 'tensión del drenador (la de la carga)' },
  },
  netlist: (c) => [
    `VDD vdd 0 DC ${num(c.p('vdd'))}`,
    `VG in 0 DC ${num(c.p('entrada'))}`,
    `RG in g ${ng(c.p('rg'))}`,
    ...(c.tiene('rgs') ? [`RGS g vdd ${ng(c.p('rgs'))}`] : []),
    'M1 d g vdd vdd PM W=1 L=1',
    'VMD d y 0',
    `RD y 0 ${ng(c.p('rd'))}`,
    `.model PM PMOS(LEVEL=1 KP=${ng(c.p('k'))} VTO=${num(-c.p('vth'))} LAMBDA=${num(c.p('lambda'))})`,
  ],
  describir: (c) =>
    `MOSFET de canal P en el lado alto: fuente en ${c.val('vdd')}, drenador con ${c.sim('rd')} de ${c.val('rd')} a masa; puerta desde ${c.val('entrada')}${c.tiene('rg') ? ` por ${c.sim('rg')} de ${c.val('rg')}` : ''}${c.tiene('rgs') ? `, con ${c.sim('rgs')} de ${c.val('rgs')} a la fuente` : ''}; k ${c.val('k')}, umbral −${c.val('vth')}; con su diodo interno`,
};
export default d;
