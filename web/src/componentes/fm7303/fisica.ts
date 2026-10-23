// Physics of the FM7303 alignment (printed section 15.11, theory in 15.18 and 15.19).
//
// From the book: L1 = 0,058 µH and L2 = 0,042 µH (figure 15.28), C4A = C4B = 20 pF with trimmers C4A' and
// C4B' of 10 pF, C3 = C7 = 22 pF, C9 = 10 pF (original schematic, figure 15.26), IF 10,7 MHz, band 88–108 MHz,
// local oscillator 98,7–118,7 MHz, ceramic filters about 280 kHz wide, B1 = 3 µH with C13 = 75 pF, B2 = 7,6 µH,
// TP3 = TP1 = 4,6 V, VCO set by C38 = 1000 pF, R17 = 9,1 kΩ and W3 = 5 kΩ to 38 kHz, signal meter below 5 V.
// Resonance f = 1/(2π√(LC)) everywhere.
//
// Modelled (not in the book, chosen and stated in the app): the minimum capacitance of the tuning sections, the
// stray capacitances of both tanks (chosen so that with the book's L1 and L2 and the trimmers at mid travel the
// band is exactly 88–108 MHz), the varicap law (the FV1043 model of the companion netlist fig-16.25_afc), the
// tank Q values, the shape of the IF passband and of the discriminator S-curve, the signal meter law, the VCO
// constant (38 kHz with W3 at mid travel), the PLL lock range, the mute threshold, the effect of a supply below
// 9 V, and the simulated stations.

import type { EfectoAveria, EmisoraSimulada } from './tipos';

const TAU = 2 * Math.PI;

/** Every control of the kit that the app lets the reader move. */
export interface Controles {
  /** Tuning capacitor: 0 = fully meshed (low end, 88 MHz), 1 = open (high end, 108 MHz). */
  dial: number;
  /** Trimmers C4A' and C4B': 0–1 of their travel (1 to 10 pF). */
  c4a: number;
  c4b: number;
  /** Air coils L1 and L2: relative change of inductance (spreading the turns lowers it). */
  l1: number;
  l2: number;
  /** IF transformer B1 and discriminator coil B2 cores: relative change of inductance. */
  b1: number;
  b2: number;
  /** Trimmer potentiometers, 0–1 of their travel (W1: wiper from ground; W3: resistance in circuit). */
  w1: number;
  w2: number;
  w3: number;
  /** Volume W4, 0–1. */
  volumen: number;
  k1: boolean;
  k2: boolean;
  /** K3 pressed: VCO stopped, mono. */
  k3: boolean;
  /** «Monitor» bridge soldered. */
  monitor: boolean;
  /** Power switch (in the volume pot). */
  k4: boolean;
  antena: boolean;
  /** Supply voltage at CZ1 (V). */
  vcc: number;
}

/** The kit as it comes out of the bag: coils not stretched to size, trimmers and cores anywhere. */
export const RECIEN_MONTADO: Controles = {
  dial: 0.52,
  c4a: 0.15,
  c4b: 0.88,
  l1: 0.12,
  l2: 0.09,
  b1: 0.085,
  b2: -0.055,
  w1: 0.52,
  w2: 0.3,
  w3: 0.84,
  volumen: 0.45,
  k1: false,
  k2: false,
  k3: false,
  monitor: false,
  k4: true,
  antena: true,
  vcc: 12,
};

// ------------------------------------------------------------------ constants
export const L1 = 0.058e-6;
export const L2 = 0.042e-6;
export const CMAX = 20e-12;
export const TRIM_MAX = 10e-12;
/** Modelled: minimum capacitance of each tuning section and of the trimmers. */
export const CMIN = 0.895e-12;
export const TRIM_MIN = 1e-12;
export const C3 = 22e-12;
export const C7 = 22e-12;
export const C9 = 10e-12;
export const FI = 10.7e6;
export const B1_L = 3e-6;
export const C13 = 75e-12;
export const B2_L = 7.6e-6;
/** Modelled: C27 (24 pF) plus about 5 pF of strays and IC capacitance (companion netlist prob-16.A). */
export const B2_C = 29e-12;
export const C38 = 1000e-12;
export const R17 = 9.1e3;
export const W3_MAX = 5e3;
export const TP_OBJETIVO = 4.6;
/** Modelled: lock range of the stereo PLL around 38 kHz. */
export const BLOQUEO = 2800;

/** FV1043 junction capacitance (model of the companion netlist fig-16.25_afc.cir). */
export function cVaricap(v: number): number {
  return 30e-12 / Math.sqrt(1 + Math.max(0, v) / 0.7);
}
/** Varicap in series with C9 (what the oscillator tank sees). */
function cVaricapSerie(v: number): number {
  const cj = cVaricap(v);
  return (C9 * cj) / (C9 + cj);
}

const trim = (t: number) => TRIM_MIN + (TRIM_MAX - TRIM_MIN) * t;
const seccion = (dial: number) => CMAX - (CMAX - CMIN) * dial;

// Strays chosen so that, with the book's coils and both trimmers at mid travel, the oscillator covers exactly
// 98,7–118,7 MHz and the RF tank is tuned to 88 MHz at the low end.
const C_OL_BAJO = 1 / ((TAU * 98.7e6) ** 2 * L2);
export const CS_OL = C_OL_BAJO - C7 - trim(0.5) - CMAX - cVaricapSerie(TP_OBJETIVO);
const C_RF_BAJO = 1 / ((TAU * 88e6) ** 2 * L1);
export const CS_RF = C_RF_BAJO - C3 - trim(0.5) - CMAX;

/** Local oscillator frequency (Hz) for a dial position, trimmer, coil and varicap voltage. */
export function fOL(c: Pick<Controles, 'dial' | 'c4b' | 'l2'>, vVar: number): number {
  const C = C7 + seccion(c.dial) + trim(c.c4b) + cVaricapSerie(vVar) + CS_OL;
  return 1 / (TAU * Math.sqrt(L2 * (1 + c.l2) * C));
}

/** Resonance of the RF input tank (L1 + C4A) (Hz). */
export function fRF(c: Pick<Controles, 'dial' | 'c4a' | 'l1'>): number {
  const C = C3 + seccion(c.dial) + trim(c.c4a) + CS_RF;
  return 1 / (TAU * Math.sqrt(L1 * (1 + c.l1) * C));
}

/** Resonance of the IF transformer B1 with C13 (Hz). */
export const fB1 = (b1: number) => 1 / (TAU * Math.sqrt(B1_L * (1 + b1) * C13));
/** Centre of the discriminator B2 (Hz). */
export const fB2 = (b2: number) => 1 / (TAU * Math.sqrt(B2_L * (1 + b2) * B2_C));
/** Free-running frequency of the stereo decoder's VCO (Hz): C38, R17 and W3 (modelled constant). */
export const KVCO = 1 / (38e3 * (R17 + W3_MAX / 2) * C38);
export const fVCO = (w3: number) => 1 / (KVCO * (R17 + W3_MAX * w3) * C38);

/** Amplitude response of a parallel tank of quality factor q at f (0–1). */
export function resonancia(f: number, f0: number, q: number): number {
  const x = f / f0 - f0 / f;
  return 1 / Math.sqrt(1 + (q * x) ** 2);
}

/** Modelled loaded Q of the RF tank («unas decenas», section 36.9) and of B1. */
export const Q_RF = 25;
export const Q_B1 = 20;

/** IF passband of the two ceramic filters, dB at an offset (Hz) from 10,7 MHz: −3 dB at ±140 kHz. */
export function fiDb(df: number): number {
  return Math.max(-70, -3 * (df / 140e3) ** 2);
}

/** Discriminator: TP3 DC voltage for an IF frequency and the centre of B2 (modelled S-curve, ±0,6 V). */
export function tp3(fIF: number, centro: number, señal: number): number {
  return TP_OBJETIVO - 0.6 * Math.tanh((fIF - centro) / 80e3) * señal;
}

/** Signal meter (pin 3 of IC3) for a level at the IF in dBµV: logarithmic, never above 5 V. */
export function medidor(dbuv: number): number {
  return Math.min(4.9, 0.1 + 4.45 * (1 - Math.exp(-Math.max(0, dbuv - 10) / 24)));
}
/** Meter between stations: the limiter amplifies noise, so it does not read zero (modelled). */
export const MEDIDOR_RUIDO = 0.9;

export interface EstadoRadio {
  alimentada: boolean;
  /** Local oscillator (Hz) or null if it does not run. */
  fOL: number | null;
  /** What the display shows: f_OL − 10,7 MHz (Hz), or null (display off or no count). */
  display: number | null;
  /** Frequency the radio receives (Hz) and RF tank resonance. */
  fRx: number | null;
  fRF: number;
  /** Station inside the IF passband (or null) and its offset from the tuned frequency (Hz). */
  emisora: EmisoraSimulada | null;
  desvio: number;
  /** Signal level at the IF (dBµV), and the gains of the RF tank and B1 (dB). */
  nivel: number;
  gRF: number;
  gB1: number;
  vMedidor: number;
  vTP1: number;
  vTP3: number;
  vVaricap: number;
  fB1: number;
  fB2: number;
  /** IF of the received station (Hz). */
  fIF: number;
  /** Free-running VCO and what TP4 shows (Hz, null = no signal there). */
  fVCO: number;
  fTP4: number | null;
  piloto: boolean;
  estereo: boolean;
  parpadeo: boolean;
  /** Mute: voltage at pin 4 and resulting gain (0 = silent). */
  vMute: number;
  gMute: number;
  /** Audio: relative levels 0–1 per channel, hiss 0–1, distortion 0–1, and a description. */
  audioL: number;
  audioR: number;
  siseo: number;
  distorsion: number;
  calidadDetector: number;
  descripcion: string;
  /** Stereo decoder powered (8 V present). */
  decodificador: boolean;
}

export interface Contexto {
  emisoras: EmisoraSimulada[];
  averia: EfectoAveria | null;
}

/** Level of a station at the IF (dBµV) seen with the tuning of `c` and the oscillator at fOL_. */
function nivelDe(e: EmisoraSimulada, c: Controles, fOL_: number, ctx: Contexto): { nivel: number; gRF: number; gB1: number; desvio: number } {
  const fRx = fOL_ - FI;
  const desvio = e.f * 1e6 - fRx;
  const gRF = 20 * Math.log10(resonancia(e.f * 1e6, fRF(c), Q_RF));
  const gB1 = 20 * Math.log10(resonancia(FI, fB1(c.b1), Q_B1));
  let nivel = e.nivel + gRF + gB1 + fiDb(desvio);
  if (!c.antena) nivel -= 15;
  if (ctx.averia?.antena === false) nivel -= 60;
  // Below 9 V the TA7061 and TA7303 lose gain (section 15.15.4): modelled as 3 dB per volt.
  if (c.vcc < 9) nivel -= 3 * (9 - c.vcc);
  return { nivel, gRF, gB1, desvio };
}

/** The whole radio for a set of controls (and a fault, if any). */
export function radio(c0: Controles, ctx: Contexto): EstadoRadio {
  const av = ctx.averia;
  const c: Controles = { ...c0 };
  const alimentada = c.k4 && c.vcc > 2 && av?.alimentacion !== false;
  const frontEnd = alimentada && av?.front_end !== false;
  const oscila = frontEnd && av?.oscilador !== false;
  const decod = alimentada && av?.decodificador !== false;
  const vTP1 = alimentada ? 6 * c.w1 : 0;
  const centroB2 = fB2(c.b2);
  const vacio: EstadoRadio = {
    alimentada, fOL: null, display: null, fRx: null, fRF: fRF(c), emisora: null, desvio: 0, nivel: -20, gRF: 0, gB1: 0,
    vMedidor: 0, vTP1, vTP3: 0, vVaricap: 0, fB1: fB1(c.b1), fB2: centroB2, fIF: FI, fVCO: fVCO(c.w3), fTP4: null, piloto: false,
    estereo: false, parpadeo: false, vMute: 0, gMute: 1, audioL: 0, audioR: 0, siseo: 0, distorsion: 0, calidadDetector: 0,
    descripcion: 'La radio está apagada: no hay alimentación tras K4.', decodificador: false,
  };
  if (!alimentada) return vacio;

  // Oscillator with the varicap: K1 OFF → W1 (TP1); K1 ON → detector (TP3), solved as a fixed point (AFC loop).
  const mejor = (fo: number) => {
    let m: { e: EmisoraSimulada; n: ReturnType<typeof nivelDe> } | null = null;
    for (const e of ctx.emisoras) {
      const n = nivelDe(e, c, fo, ctx);
      if (n.nivel > 12 && (!m || n.nivel > m.n.nivel)) m = { e, n };
    }
    return m;
  };
  const tp3De = (fo: number) => {
    const m = mejor(fo);
    const señal = m ? Math.min(1, Math.max(0, (m.n.nivel - 12) / 12)) : 0;
    const fIF = m ? fo - m.e.f * 1e6 : FI;
    // Without a station the limiter's noise is centred on the IF passband (10,7 MHz).
    return m ? tp3(fIF, centroB2, señal) + (1 - señal) * (tp3(FI, centroB2, 1) - TP_OBJETIVO) : tp3(FI, centroB2, 1);
  };
  let vVar = vTP1;
  let fo = oscila ? fOL(c, vVar) : null;
  if (fo != null && c.k1) {
    vVar = tp3De(fo);
    for (let i = 0; i < 40; i++) {
      const f1 = fOL(c, vVar);
      const v1 = tp3De(f1);
      const nuevo = vVar + 0.5 * (v1 - vVar);
      if (Math.abs(nuevo - vVar) < 1e-6) {
        vVar = nuevo;
        break;
      }
      vVar = nuevo;
    }
    fo = fOL(c, vVar);
  }

  const m = fo != null ? mejor(fo) : null;
  const nivel = m ? m.n.nivel : -10;
  const señal = m ? Math.min(1, Math.max(0, (nivel - 12) / 12)) : 0;
  const fIF = m && fo != null ? fo - m.e.f * 1e6 : FI;
  const vTP3 = frontEnd ? (fo != null ? tp3De(fo) : tp3(FI, centroB2, 1)) : tp3(FI, centroB2, 1);
  const vMedidor = m ? Math.max(MEDIDOR_RUIDO, medidor(nivel)) : MEDIDOR_RUIDO;
  if (!c.k1) vVar = vTP1;

  // Detector quality: best with the station centred on B2 (TP3 = 4,6 V, section 15.11.3).
  const calidadDetector = Math.exp(-(((fIF - centroB2) / 160e3) ** 2));
  const distorsion = m ? Math.min(1, ((fIF - centroB2) / 120e3) ** 2) : 0;
  // FM capture: hiss vanishes as the level rises (modelled).
  const siseoBase = 1 / (1 + 10 ** ((nivel - 26) / 8));

  // Stereo: pilot of a stereo station, PLL locked when the free VCO is within the lock range.
  const fv = fVCO(c.w3);
  const piloto = !!m && m.e.estereo && nivel > 32 && decod;
  const vcoCorre = decod && !c.k3;
  const estereo = piloto && vcoCorre && Math.abs(fv - 38e3) < BLOQUEO;
  const parpadeo = estereo && nivel < 42;
  const fTP4 = c.monitor && vcoCorre ? (estereo ? 38e3 : fv) : null;

  // Mute (K2): part of the meter voltage reaches pin 4 through R11 (2 kΩ) and W2 (10 kΩ).
  const vMute = vMedidor * ((10 * c.w2) / 12);
  const gMute = c.k2 ? Math.min(1, Math.max(0, (vMute - 0.6) / 0.6)) : 1;

  // Audio at the speakers (relative): volume (log pot), detector, mute, decoder.
  const vol = c.volumen ** 2;
  const programa = m ? señal * calidadDetector : 0;
  const siseo = decod ? Math.min(1, siseoBase * (estereo ? 1.4 : 1)) * vol * gMute : 0;
  let audioL = decod ? programa * vol * gMute : 0;
  let audioR = audioL;
  if (av?.canal_r === false) audioR = 0;

  const display = av?.display === false || fo == null ? null : fo - FI;
  const fRx = fo != null ? fo - FI : null;

  let descripcion: string;
  if (!frontEnd && av?.front_end === false) descripcion = 'Solo siseo en todo el dial: no se recibe nada.';
  else if (fo == null) descripcion = 'Solo siseo en todo el dial: el oscilador local no funciona.';
  else if (!decod) descripcion = 'Silencio: el decodificador estéreo no tiene alimentación y no llega audio al amplificador.';
  else if (c.k2 && gMute < 0.15) descripcion = m ? 'Silencio: el mute calla esta emisora (W2 demasiado sensible).' : 'Silencio entre emisoras: el mute calla el siseo.';
  else if (!m) descripcion = 'Siseo de FM: no hay emisora en esta frecuencia (entre emisoras se oye más ruido que con una sintonizada).';
  else {
    const partes: string[] = [m.e.nombre.replace(/ \(.*\)$/, '')];
    if (nivel < 30) partes.push('muy débil, con mucho ruido');
    else if (nivel < 45) partes.push('débil, con algo de ruido');
    else partes.push('clara');
    if (distorsion > 0.35) partes.push('distorsionada: el discriminador (B2) no está centrado');
    else if (distorsion > 0.12) partes.push('algo distorsionada');
    if (estereo) partes.push(parpadeo ? 'en estéreo, con el indicador parpadeando' : 'en estéreo');
    else if (m.e.estereo && !c.k3 && decod && nivel > 32) partes.push('en mono (el PLL no engancha el piloto)');
    else partes.push('en mono');
    if (c.k2 && gMute < 0.9) partes.push('con el volumen reducido por el mute');
    if (av?.canal_r === false) partes.push('solo por el altavoz izquierdo');
    if (c.volumen < 0.05) partes.push('(volumen al mínimo)');
    descripcion = partes.join(', ') + '.';
    if (audioL === 0 && audioR === 0 && c.volumen >= 0.05) descripcion = 'Silencio.';
  }
  audioL = Math.min(1, audioL);
  audioR = Math.min(1, audioR);
  return {
    alimentada, fOL: fo, display, fRx, fRF: fRF(c), emisora: m?.e ?? null, desvio: m?.n.desvio ?? 0, nivel,
    gRF: m?.n.gRF ?? 0, gB1: m?.n.gB1 ?? 0, vMedidor: frontEnd ? vMedidor : 0.1, vTP1, vTP3, vVaricap: vVar,
    fB1: fB1(c.b1), fB2: centroB2, fIF, fVCO: fv, fTP4, piloto, estereo, parpadeo, vMute, gMute, audioL, audioR,
    siseo, distorsion, calidadDetector, descripcion, decodificador: decod,
  };
}

/** Frequency shown by the display at both ends of the dial (coverage, section 15.11.4). */
export function cobertura(c: Controles, ctx: Contexto): [number | null, number | null] {
  const a = radio({ ...c, dial: 0, k1: false }, ctx);
  const b = radio({ ...c, dial: 1, k1: false }, ctx);
  return [a.display, b.display];
}

/** Dial position that tunes a frequency (Hz) with the current coils and trimmers (bisection), or null. */
export function dialPara(c: Controles, f: number, vVar = TP_OBJETIVO): number | null {
  let a = 0;
  let b = 1;
  const g = (d: number) => fOL({ ...c, dial: d }, vVar) - FI - f;
  if (g(a) > 0 || g(b) < 0) return null;
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2;
    if (g(m) > 0) b = m;
    else a = m;
  }
  return (a + b) / 2;
}

/** Tracking: RF tank gain (dB) for a station at its dial position. */
export function seguimiento(c: Controles, f: number): number | null {
  const d = dialPara(c, f, c.k1 ? TP_OBJETIVO : 6 * c.w1);
  if (d == null) return null;
  return 20 * Math.log10(resonancia(f, fRF({ ...c, dial: d }), Q_RF));
}

/** Frequency shift of the oscillator when K1 switches from W1 to the detector (AFC check, Hz). */
export function saltoAFC(c: Controles): number {
  return fOL(c, TP_OBJETIVO) - fOL(c, 6 * c.w1);
}
