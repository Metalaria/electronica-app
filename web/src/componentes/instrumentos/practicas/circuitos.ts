// Circuits of the twelve practices of printed chapter 21 («Prácticas de laboratorio con el FNIRSI 2C53T»,
// cap22.typ). Values, models and component names come from the book's companion netlists
// (complementos/spice/cap22/*.cir) and from the text; each one is reduced to the single circuit that is on
// the bench (the book's netlists put several variants side by side to check every number at once).
// The source called VG is the one the 2C53T's DDS generator drives.

const LED = '.model LEDR D(IS=1e-20 N=1.8 RS=5)';
const D4148 = '.model D1N4148 D(IS=2.52n RS=0.568 N=1.752 CJO=4p M=0.4 TT=20n BV=100 IBV=100u)';
const D4007 = `.model D1N4007 D(IS=7.02767n RS=0.0341512 N=1.80803 EG=1.05743 XTI=5 BV=1000 IBV=5e-08
+ CJO=1e-11 VJ=0.7 M=0.5 FC=0.5 TT=1e-07)`;
const Q3904 = `.model Q2N3904 NPN(IS=6.734f XTI=3 EG=1.11 VAF=74.03 BF=416.4 NE=1.259 ISE=6.734f
+ IKF=66.78m XTB=1.5 BR=.7371 NC=2 ISC=0 IKR=0 RC=1 CJC=3.638p MJC=.3085 VJC=.75 FC=.5
+ CJE=4.493p MJE=.2593 VJE=.75 TR=239.5n TF=301.2p ITF=.4 VTF=4 XTF=2 RB=10)`;

export const CIRCUITOS: Record<string, string> = {
  // Práctica 1 — divisor de tensión (fig-22.1_divisor.cir): 9 V, R1 = 10 k, R2 = 4,7 k.
  p1: `* Práctica 1: divisor de tensión
V1 a 0 DC 9
R1 a out 10k
R2 out 0 4.7k
`,
  p1_alta: `* Práctica 1: divisor con R1 = R2 = 1 MΩ
V1 a 0 DC 9
R1 a out 1meg
R2 out 0 1meg
`,
  p1_led: `* Práctica 1: divisor cargado con un LED rojo y 330 Ω
${LED}
V1 a 0 DC 9
R1 a out 10k
R2 out 0 4.7k
RL out led 330
DL led 0 LEDR
`,
  // Práctica 2 — carga RC (fig-22.3_carga_rc.cir), excitada por el generador (cuadrada de 0 a 3 V).
  p2: `* Práctica 2: carga y descarga RC
VG g 0 DC 0
R1 g c 10k
C1 c 0 100n
`,
  p2_lenta: `* Práctica 2: R = 1 MΩ (la sonda carga el condensador)
VG g 0 DC 0
R1 g c 1meg
C1 c 0 100n
`,
  // Práctica 3 — diodo (fig-22.5_diodo_iv.cir): fuente ajustable, 1 k, 1N4148.
  p3: `* Práctica 3: característica I-V del diodo (1N4148)
${D4148}
V1 s 0 DC 5
R1 s a 1k
D1 a 0 D1N4148
`,
  p3_xy: `* Práctica 3: trazador de curvas con el generador y el modo X-Y
${D4148}
VG g 0 DC 0
D1 g k D1N4148
R1 k 0 1k
`,
  // Práctica 4 — media onda (fig-22.7_media_onda.cir): 9 V eficaces, 0,5 Ω, 1N4007, 1 000 µF, 110 Ω.
  p4: `* Práctica 4: rectificador de media onda con condensador
${D4007}
VS s 0 SIN(0 12.728 50)
RS s x 0.5
D1 x out D1N4007
C1 out 0 1000u
RL out 0 110
`,
  p4_sinC: `* Práctica 4: rectificador de media onda sin condensador
${D4007}
VS s 0 SIN(0 12.728 50)
RS s x 0.5
D1 x out D1N4007
RL out 0 110
`,
  // Práctica 5 — Bode de un RC (fig-22.10_rc_bode.cir): R = 1,6 k, C = 100 nF.
  p5: `* Práctica 5: filtro RC paso bajo
VG in 0 DC 0
R1 in out 1.6k
C1 out 0 100n
`,
  // Práctica 6 — FFT del generador (fig-22.12_cuadrada_fft.cir): el generador al CH1.
  p6: `* Práctica 6: el generador directamente al canal 1
VG g 0 DC 0
RL g 0 1meg
`,
  // Práctica 7 — 555 astable (fig-22.14_555_astable.cir), modelo de comportamiento del libro.
  p7: `* Práctica 7: 555 astable (RA = 10 k, RB = 47 k, C = 1 µF)
.param vcc=9
.model SW555 SW(VT={vcc/2} VH={vcc/6} RON=10 ROFF=1G)
VCC vcc 0 DC {vcc}
RA vcc dis 10k
RB dis thr 47k
C1 thr 0 1u IC={vcc/3}
S1 dis 0 thr 0 SW555
BOUT out 0 V = v(dis) > {vcc/30} ? {vcc} : 0
ROUT out 0 1MEG
.tran 20u 1 0 20u UIC
`,
  // Práctica 8 — BJT como interruptor (fig-22.16_bjt_interruptor.cir): 2N3904, RB = 10 k, LED y 330 Ω, 5 V.
  p8_0: `* Práctica 8: base a 0 V (corte)
${Q3904}
${LED}
VCC vcc 0 DC 5
RL vcc a 330
DL a c LEDR
Q1 c b 0 Q2N3904
RB ctl b 10k
VB ctl 0 DC 0
`,
  p8_5: `* Práctica 8: base a 5 V a través de RB (saturación)
${Q3904}
${LED}
VCC vcc 0 DC 5
RL vcc a 330
DL a c LEDR
Q1 c b 0 Q2N3904
RB ctl b 10k
VB ctl 0 DC 5
`,
  p8_gen: `* Práctica 8: base gobernada por el generador (cuadrada de 2 Hz)
${Q3904}
${LED}
VCC vcc 0 DC 5
RL vcc a 330
DL a c LEDR
Q1 c b 0 Q2N3904
RB ctl b 10k
VG ctl 0 DC 0
`,
  // Práctica 9 — RLC serie (fig-22.17_rlc_serie.cir): L = 10 mH (con 20 Ω de cobre), C = 100 nF, R = 100 Ω.
  p9: `* Práctica 9: resonancia RLC serie
VG in 0 DC 0
L1 in nl 10m
RCU nl n1 20
C1 n1 n2 100n
R1 n2 0 100
`,
  // Práctica 10 — tiempo de subida (sec-22.11_tiempo_subida.cir): flanco de una puerta 74AC04 (≈ 2,5 ns).
  p10: `* Práctica 10: flanco rápido de un 74AC04 a 1 MHz
VP g 0 PULSE(0 5 0 2.5n 2.5n 497.5n 1u)
RO g out 25
`,
  // Práctica 11 — AM y demodulador (fig-22.21_am_demodulador.cir): 100 kHz al 50 % con 1 kHz.
  p11: `* Práctica 11: señal AM y demodulador de diodo
${D4148}
BAM am 0 V = 2*(1+0.5*cos(2*pi*1k*time))*cos(2*pi*100k*time)
RAM am 0 1MEG
D1 am o1 D1N4148
R1 o1 0 10k
C1 o1 0 10n
`,
  // Práctica 12 — electrolítico real (fig-22.22_condensador_lcr.cir): 100 µF, ESR 0,08 Ω, ESL 30 nH,
  // medido por divisor con una resistencia de 100 Ω y el generador.
  p12: `* Práctica 12: impedancia de un electrolítico por divisor
VG in 0 DC 0
R1 in c 100
RESR c e1 0.08
LESL e1 e2 30n
C1 e2 0 100u
`,
};
