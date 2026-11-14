// Schematic «tiristor» (1.2, esquemas12d; sección 10.1 «Tiristores: SCR, TRIAC y DIAC», bloques 7 to 19): phase-angle
// control of an AC load — the mains sine (peak «fuente», «f»), an SCR or a TRIAC in series and the load R (with an
// optional L). The device latches as the book describes it (bloque 9): a gate pulse at the firing angle α of each
// half-cycle (the positive one for an SCR; both for a TRIAC) turns it on, and it stays on without the gate until its
// current dies out (the holding current, milliamperes, is negligible against the load's). In ngspice each direction is
// a switch with memory (RON 1 mΩ) in series with a diode: the switch closes with the gate pulse and stays closed while
// its own branch carries more than 1 µA; the diode takes the current to zero smoothly, so cutting a coil's current
// leaves no spike, and drops about 0,7 V, as a real thyristor (bloque 5: «una caída de uno o dos voltios»). 100 kΩ
// across the device is its off-state leakage (and damps the node when it lets go). With a resistive load the load sees
// the sine from α to 180° (and from 180° + α to 360° with a TRIAC); with an inductive one the current goes on past the
// voltage's zero until it dies out: i = (V_p/Z)·(sen(θ − φ) − sen(α − φ)·e^(−(θ − α)/tan φ)) from θ = α,
// φ = atan(ωL/R). The gate pulse lasts «ancho» degrees (10° without it). Transient only; it starts at t = 0 at the
// voltage's rising zero with the device off.
import { ng, num } from '../comun';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

export const esTriac = (c: ContextoNetlist): boolean => c.tiene('triac') && c.cerrado('triac');

const d: DefinicionEsquema = {
  nombre: 'tiristor',
  titulo: 'Control por ángulo de fase con SCR o TRIAC',
  resumen: 'Senoide de red, un SCR o un TRIAC que se enclava con un pulso de puerta a α y se apaga bajo la corriente de mantenimiento, y la carga R (o R-L).',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de pico de la red (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la red (Hz)' },
    r: { obligatoria: true, descripcion: 'resistencia de la carga, R (Ω)', color: 'naranja' },
    l: { descripcion: 'inductancia de la carga, L (H; sin ella, carga resistiva)', color: 'naranja' },
    alfa: { obligatoria: true, descripcion: 'ángulo de disparo α en cada semiciclo (grados, de 0 a 180)', color: 'azul' },
    triac: { interruptor: true, descripcion: 'TRIAC (cerrado: dispara en los dos semiciclos) en lugar de SCR (abierto o sin la pieza: solo el positivo)', color: 'azul' },
    ancho: { descripcion: 'duración del pulso de puerta (grados; sin ella, 10°)' },
  },
  observables: {
    red: { medida: 'v(fte)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la red frente al tiempo' },
    carga: { medida: 'v(k)', analisis: 'tran', unidad: 'V', descripcion: 'tensión en la carga frente al tiempo' },
    corriente: { medida: 'i(vmi)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de la carga frente al tiempo' },
    tiristor: { medida: 'v(a)-v(k)', analisis: 'tran', unidad: 'V', descripcion: 'tensión en el tiristor frente al tiempo' },
    resistencia: { medida: 'v(k)-v(q)', analisis: 'tran', unidad: 'V', descripcion: 'tensión en la resistencia de la carga frente al tiempo', requiere: ['l'] },
  },
  netlist(c) {
    const vp = c.p('fuente');
    const f = c.p('f');
    const T = 1 / f;
    const alfa = Math.min(179.9, Math.max(0.1, c.p('alfa')));
    const ancho = c.tiene('ancho') && c.p('ancho') > 0 ? c.p('ancho') : 10;
    const td = (alfa / 360) * T;
    const pw = (Math.min(ancho, 179.9 - alfa) / 360) * T;
    const tr = T * 1e-5;
    const pulso = (fuente: string, n: string, t0: number) => `${fuente} ${n} 0 DC 0 PULSE(0 2 ${num(t0)} ${num(tr)} ${num(tr)} ${num(pw)} ${num(T)})`;
    const triac = esTriac(c);
    return [
      `VF fte 0 DC 0 SIN(0 ${num(vp)} ${num(f)} 0 0 0)`,
      'VMI fte a 0',
      // forward (the SCR, or MT2 → MT1 of the TRIAC)
      'S1 a x1 c1 0 swt OFF',
      'VM1 x1 d1 0',
      'D1 d1 k dtir',
      pulso('VGP', 'gp', td),
      'B1 c1 0 V = v(gp)+i(vm1)/1e-6',
      ...(triac ? ['S2 k x2 c2 0 swt OFF', 'VM2 x2 d2 0', 'D2 d2 a dtir', pulso('VGN', 'gn', td + T / 2), 'B2 c2 0 V = v(gn)+i(vm2)/1e-6'] : []),
      'RX a k 1e5',
      '.model swt SW(VT=1.25 VH=0.25 RON=1e-3 ROFF=1e9)',
      '.model dtir D(IS=1e-12 N=1)',
      ...(c.tiene('l') && c.p('l') > 0 ? [`RL k q ${ng(c.p('r'))}`, `LL q 0 ${ng(c.p('l'))} IC=0`] : [`RL k 0 ${ng(c.p('r'))}`]),
    ];
  },
  tran: { bordes: () => 0.0015 },
  describir: (c) =>
    `Control por ángulo de fase: la red de ${c.val('fuente')} de pico y ${c.val('f')}, ${esTriac(c) ? 'un TRIAC que se dispara en los dos semiciclos' : 'un SCR que se dispara en el semiciclo positivo'} con α de ${c.val('alfa')} y la carga, ${c.sim('r')} de ${c.val('r')}${c.tiene('l') ? ` con ${c.sim('l')} de ${c.val('l')}` : ''}. Una vez disparado conduce sin la puerta hasta que su corriente se anula`,
};
export default d;
