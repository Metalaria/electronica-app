// Models offered by the palette: the ones the book's netlists use (complementos/spice), with the same
// parameters, so a drawn circuit behaves like the book's. Each entry adds its .model/.subckt text to the
// generated netlist when a part uses it and the directives do not already define that name.

export type FamiliaModelo = 'D' | 'DZ' | 'LED' | 'DS' | 'QN' | 'QP' | 'MN' | 'MP' | 'JN' | 'JP' | 'OA' | 'OA5' | 'T555';

export interface ModeloLibreria {
  nombre: string;
  familia: FamiliaModelo;
  /** What the picker shows. */
  descripcion: string;
  texto: string;
  /** .subckt (op-amps) instead of .model. */
  subckt?: boolean;
}

export const MODELOS: ModeloLibreria[] = [
  { nombre: 'D1N4148', familia: 'D', descripcion: '1N4148 (señal, rápido)', texto: '.model D1N4148 D(IS=2.52n RS=0.568 N=1.752 CJO=4p M=0.4 TT=20n BV=100 IBV=100u)' },
  {
    nombre: 'D1N4007',
    familia: 'D',
    descripcion: '1N4007 (rectificador, 1 A)',
    texto: '.model D1N4007 D(IS=7.02767n RS=0.0341512 N=1.80803 EG=1.05743 XTI=5 BV=1000 IBV=5e-08 CJO=1e-11 VJ=0.7 M=0.5 FC=0.5 TT=1e-07)',
  },
  { nombre: 'DSCH', familia: 'DS', descripcion: 'Schottky (≈ 0,3 V, 40 V)', texto: '.model DSCH D(IS=1e-5 N=1.05 RS=0.03 CJO=100p BV=40)' },
  { nombre: 'LEDR', familia: 'LED', descripcion: 'LED rojo (≈ 1,9 V a 20 mA)', texto: '.model LEDR D(IS=1e-18 N=1.9 RS=5)' },
  { nombre: 'LEDV', familia: 'LED', descripcion: 'LED verde (≈ 2,2 V a 20 mA)', texto: '.model LEDV D(IS=1e-20 N=2.1 RS=5)' },
  { nombre: 'DZ51', familia: 'DZ', descripcion: 'Zener 5,1 V', texto: '.model DZ51 D(IS=1e-14 N=1 BV=5.1 IBV=5m NBV=1 RS=1)' },
  { nombre: 'DZ56', familia: 'DZ', descripcion: 'Zener 5,6 V', texto: '.model DZ56 D(IS=1e-14 N=1 BV=5.6 IBV=5m NBV=1 RS=1)' },
  { nombre: 'DZ12', familia: 'DZ', descripcion: 'Zener 12 V', texto: '.model DZ12 D(IS=1e-14 N=1 BV=12 IBV=5m NBV=1 RS=2)' },
  {
    nombre: 'Q2N3904',
    familia: 'QN',
    descripcion: '2N3904 (NPN de señal)',
    texto:
      '.model Q2N3904 NPN(IS=6.734f XTI=3 EG=1.11 VAF=74.03 BF=416.4 NE=1.259 ISE=6.734f IKF=66.78m XTB=1.5 BR=.7371 NC=2 ISC=0 IKR=0 RC=1 CJC=3.638p MJC=.3085 VJC=.75 FC=.5 CJE=4.493p MJE=.2593 VJE=.75 TR=239.5n TF=301.2p ITF=.4 VTF=4 XTF=2 RB=10)',
  },
  { nombre: 'QPN', familia: 'QN', descripcion: 'NPN de potencia (β ≈ 80, 3 A)', texto: '.model QPN NPN(IS=1e-12 BF=80 IKF=3 VAF=100 RB=1 RE=0.02 RC=0.05)' },
  {
    nombre: 'Q2N3906',
    familia: 'QP',
    descripcion: '2N3906 (PNP de señal)',
    texto:
      '.model Q2N3906 PNP(IS=1.41f XTI=3 EG=1.11 VAF=18.7 BF=180.7 NE=1.5 ISE=0 IKF=80m XTB=1.5 BR=4.977 NC=2 ISC=0 IKR=0 RC=2.5 CJC=9.728p MJC=.5776 VJC=.75 FC=.5 CJE=8.063p MJE=.3677 VJE=.75 TR=33.42n TF=179.3p ITF=.4 VTF=4 XTF=6 RB=10)',
  },
  { nombre: 'QPP', familia: 'QP', descripcion: 'PNP de potencia (β ≈ 60, 3 A)', texto: '.model QPP PNP(IS=1e-12 BF=60 IKF=3 VAF=100 RB=1 RE=0.02 RC=0.05)' },
  { nombre: 'NTY', familia: 'MN', descripcion: 'MOSFET N de potencia (VTO 2 V, nivel 1)', texto: '.model NTY NMOS(LEVEL=1 VTO=2 KP=0.5)' },
  { nombre: 'NM', familia: 'MN', descripcion: 'MOSFET N de señal (VTO 1 V, KP 2 mA/V²)', texto: '.model NM NMOS(LEVEL=1 KP=2m VTO=1 LAMBDA=0)' },
  { nombre: 'PTY', familia: 'MP', descripcion: 'MOSFET P de potencia (VTO −2 V, nivel 1)', texto: '.model PTY PMOS(LEVEL=1 VTO=-2 KP=0.5)' },
  { nombre: 'PM', familia: 'MP', descripcion: 'MOSFET P de señal (VTO −1 V)', texto: '.model PM PMOS(LEVEL=1 KP=2m VTO=-1 LAMBDA=0)' },
  { nombre: 'JN', familia: 'JN', descripcion: 'JFET N (VP −2 V, IDSS ≈ 5 mA)', texto: '.model JN NJF(VTO=-2 BETA=1.3m LAMBDA=2m)' },
  { nombre: 'JP', familia: 'JP', descripcion: 'JFET P (VP 2 V, IDSS ≈ 5 mA)', texto: '.model JP PJF(VTO=2 BETA=1.3m LAMBDA=2m)' },
  {
    nombre: 'opamp',
    familia: 'OA',
    descripcion: 'Operacional del libro (A₀ = 10⁵, polo de 10 Hz, ±14 V)',
    subckt: true,
    texto: ['.subckt opamp inp inn out', 'E1 a 0 inp inn 1e5', 'R1 a b 1k', 'C1 b 0 15.915u', 'B1 out 0 V = max(min(v(b), 14), -14)', '.ends opamp'].join('\n'),
  },
  {
    nombre: 'op741',
    familia: 'OA',
    descripcion: 'Tipo 741 (1 MHz, 0,5 V/µs, ±15 V)',
    subckt: true,
    texto: [
      '.subckt op741 inp inn out',
      'B1 0 n1 I = 15u*tanh(188.5u*(v(inp) - v(inn))/15u)',
      'CC n1 0 30p',
      'RC n1 0 530.5Meg',
      'B2 out 0 V = max(min(v(n1), 15), -15)',
      '.ends op741',
    ].join('\n'),
  },
  {
    nombre: 'opa5',
    familia: 'OA5',
    descripcion: 'Con alimentación (salida limitada a sus raíles −0,2 V)',
    subckt: true,
    texto: [
      '.subckt opa5 inp inn out vp vn',
      'B1 n1 0 V = (V(vp)+V(vn))/2 + (V(vp)-V(vn)-0.4)/2*tanh(1e5*V(inp,inn)/((V(vp)-V(vn)-0.4)/2))',
      'RO n1 out 30',
      '.ends opa5',
    ].join('\n'),
  },
  {
    nombre: 'ne555',
    familia: 'T555',
    descripcion: 'NE555 de comportamiento (umbrales 1/3 y 2/3 de Vcc, salida alta ≈ Vcc − 1,7 V)',
    subckt: true,
    // Pins 1–8: gnd trig out reset ctrl thres dis vcc. Smooth comparators (tanh) into a set–reset latch kept
    // by a small RC with a bistable feedback, so the transient steps through the switching without trouble.
    texto: [
      '.subckt ne555 g tr o rs ct th ds vc',
      'R1 vc ct 5k',
      'R2 ct lo 5k',
      'R3 lo g 5k',
      'Bs s g V = 0.5*(1+tanh(40*(v(lo,g)-v(tr,g))))',
      'Br r g V = 0.5*(1+tanh(40*(v(th,g)-v(ct,g))))',
      'Bk k g V = 0.5*(1+tanh(20*(v(rs,g)-0.7)))',
      'Bq qd g V = v(k,g)*(v(s,g) + (1-v(s,g))*(1-v(r,g))*0.5*(1+tanh(12*(v(q,g)-0.5))))',
      'Rq qd q 1k',
      'Cq q g 1p',
      'Bo oi g V = v(q,g)*max(v(vc,g)-1.7, 0) + 0.05',
      'Ro oi o 10',
      'Bn nq g V = 1-v(q,g)',
      'Sd ds g nq g sdis555',
      'Ri vc g 15k',
      '.model sdis555 sw(vt=0.5 vh=0.1 ron=10 roff=1g)',
      '.ends ne555',
    ].join('\n'),
  },
];

export function modelosDe(f: FamiliaModelo): ModeloLibreria[] {
  return MODELOS.filter((m) => m.familia === f);
}

export function modeloPorNombre(n: string): ModeloLibreria | undefined {
  const k = n.toLowerCase();
  return MODELOS.find((m) => m.nombre.toLowerCase() === k);
}

/** Names defined by .model / .subckt lines of a text (lower case). */
export function definidos(texto: string): Set<string> {
  const s = new Set<string>();
  for (const l of texto.split('\n')) {
    const m = /^\s*\.(model|subckt)\s+(\S+)/i.exec(l);
    if (m) s.add(m[2]!.toLowerCase());
  }
  return s;
}
