// The guided alignment of section 15.11, step by step, as the book describes it, with the check that tells the
// reader when the right setting has been reached. Tolerances are the app's (stated in each message).

import type { EstadoKit } from './estado.svelte';
import { radio, cobertura, seguimiento, fRF, resonancia, Q_RF, FI, TP_OBJETIVO, type Controles } from './fisica';
import { fx, mhz, khz, voltios } from './formato';

export interface Evaluacion {
  ok: boolean;
  /** What the reader sees now and what is missing. */
  mensaje: string;
  /** Controls of Mandos.svelte to show, and parts to highlight on the schematic. */
  mandos: string[];
  piezas: string[];
  instrumento: 'multimetro' | 'osciloscopio' | null;
  /** Shortcuts: dial positions or stations to tune. */
  atajos?: { texto: string; accion: (k: EstadoKit) => void }[];
}

const RAILES = ['v12', 'v8', 'v6', 'v59', 'v33', 'v31'];
const NOMBRE_RAIL: Record<string, string> = {
  v12: '12 V tras K4',
  v8: '8 V de IC4',
  v6: '6 V del 78L06',
  v59: '5,9 V de IC1',
  v33: '3,3 V del AMS1117',
  v31: '3,1 V del display',
};

/** Tunes a station (MHz) with the current coils, if it is inside the dial's range. */
function sintonizar(k: EstadoKit, f: number): void {
  let a = 0;
  let b = 1;
  const c = k.c;
  const g = (d: number) => {
    const r = radio({ ...c, dial: d, k1: false }, { emisoras: [], averia: k.averia?.senal ?? null });
    return (r.fRx ?? 0) - f * 1e6;
  };
  if (g(0) > 0) {
    k.c.dial = 0;
    return;
  }
  if (g(1) < 0) {
    k.c.dial = 1;
    return;
  }
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    if (g(m) > 0) b = m;
    else a = m;
  }
  k.c.dial = (a + b) / 2;
}

const emisoraFuerte = (k: EstadoKit) => {
  const r = k.radio;
  return !!r.emisora && r.emisora.nivel >= 58 && Math.abs(r.desvio) < 80e3;
};

/** Best RF gain reachable with C4A' for the present dial and station (dB). */
function mejorC4A(c: Controles, f: number): number {
  let mejor = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const g = 20 * Math.log10(resonancia(f, fRF({ ...c, c4a: i / 200 }), Q_RF));
    if (g > mejor) mejor = g;
  }
  return mejor;
}

export function evaluar(id: string, k: EstadoKit, memoria: Record<string, boolean>): Evaluacion {
  const r = k.radio;
  const c = k.c;
  const ctx = { emisoras: k.kit.emisoras, averia: k.averia?.senal ?? null };
  switch (id) {
    case 'preparacion': {
      const faltan: string[] = [];
      if (!c.k4) faltan.push('encender la radio (K4)');
      if (c.k1) faltan.push('soltar K1 (AFC)');
      if (c.k2) faltan.push('soltar K2 (Mute)');
      if (c.vcc < 9 || c.vcc > 12.6) faltan.push('alimentar entre 9 y 12 V');
      const ok = !faltan.length;
      return {
        ok,
        mensaje: ok ? 'Listo: K1 y K2 sueltos, medidor y display conectados, alimentación correcta.' : `Falta: ${faltan.join(', ')}.`,
        mandos: ['vcc'],
        piezas: ['K1', 'K2', 'M1', 'SC3610D', 'CZ1'],
        instrumento: null,
      };
    }
    case 'railes': {
      const medidas = RAILES.filter((x) => k.redesMedidas.includes(x));
      const faltan = RAILES.filter((x) => !medidas.includes(x));
      const malas = medidas.filter((x) => {
        const m = k.kit.mapa.find((p) => p.red === x);
        const v = k.tensionRed(x);
        return m && v != null && Math.abs(v - m.esperado) > m.esperado * m.tol;
      });
      const ok = !faltan.length && !malas.length;
      return {
        ok,
        mensaje: ok
          ? 'Los seis raíles están en su valor: la alimentación es correcta.'
          : faltan.length
            ? `Mida con la punta negra en masa y la roja en cada raíl. Faltan: ${faltan.map((x) => NOMBRE_RAIL[x]).join(', ')}.`
            : `Hay raíles fuera de su valor: ${malas.map((x) => NOMBRE_RAIL[x]).join(', ')}. Una tensión ausente localiza el problema.`,
        mandos: [],
        piezas: ['K4', 'R13', 'IC7', 'L3', 'IC6', 'D3'],
        instrumento: 'multimetro',
      };
    }
    case 'c4a': {
      if (!emisoraFuerte(k))
        return {
          ok: false,
          mensaje: 'Primero sintonice una emisora fuerte de referencia (la D, 98,0 MHz, por ejemplo): el medidor debe subir claramente.',
          mandos: ['c4a'],
          piezas: ["C4A'"],
          instrumento: null,
          atajos: [{ texto: 'Sintonizar 98,0 MHz', accion: (kk) => sintonizar(kk, 98.0) }],
        };
      const mejor = mejorC4A(c, r.emisora!.f * 1e6);
      const ok = r.gRF >= mejor - 0.3;
      return {
        ok,
        mensaje: ok
          ? `Máximo del medidor con C4A': ${voltios(r.vMedidor)}. El sonido es más estable y claro.`
          : `Medidor: ${voltios(r.vMedidor)}. Gire C4A' despacio y observe la aguja: busque el máximo.`,
        mandos: ['c4a'],
        piezas: ["C4A'"],
        instrumento: null,
      };
    }
    case 'b1': {
      if (!emisoraFuerte(k))
        return { ok: false, mensaje: 'Sintonice la emisora fuerte de referencia.', mandos: ['b1'], piezas: ['B1'], instrumento: null,
          atajos: [{ texto: 'Sintonizar 98,0 MHz', accion: (kk) => sintonizar(kk, 98.0) }] };
      const ok = r.gB1 >= -0.3;
      const saturado = r.vMedidor > 4.1 && c.antena;
      return {
        ok,
        mensaje: ok
          ? `Núcleo de B1 en el máximo del medidor (${voltios(r.vMedidor)}).`
          : `Medidor: ${voltios(r.vMedidor)}. Gire el núcleo de B1 buscando el máximo.${saturado ? ' Si el pico no se aprecia, recoja la antena o use una emisora más floja.' : ''}`,
        mandos: ['b1'],
        piezas: ['B1'],
        instrumento: null,
      };
    }
    case 'b2': {
      const tp3 = k.nodoDeRed.get('det');
      const enTP3 = k.roja === tp3 && k.negra === 'N0';
      const v = k.tensionRed('det');
      if (!emisoraFuerte(k))
        return { ok: false, mensaje: 'Sintonice la emisora de referencia, centrada.', mandos: ['b2'], piezas: ['B2'], instrumento: 'multimetro',
          atajos: [{ texto: 'Sintonizar 98,0 MHz', accion: (kk) => sintonizar(kk, 98.0) }] };
      if (!enTP3)
        return { ok: false, mensaje: 'Coloque la punta roja del multímetro en TP3 (patilla 8 del TA7303P) y la negra en masa.', mandos: ['b2'], piezas: ['B2', 'IC3'], instrumento: 'multimetro' };
      const ok = v != null && k.dcEstado === 'listo' && Math.abs(v - TP_OBJETIVO) <= 0.03;
      return {
        ok,
        mensaje: ok ? `TP3 = ${voltios(v, 3)}: el detector está centrado; la calidad es la mejor y el volumen, el máximo.` : `TP3 = ${voltios(v, 3)}. Gire el núcleo de B2 hasta 4,60 V (±0,03 V).`,
        mandos: ['b2'],
        piezas: ['B2'],
        instrumento: 'multimetro',
      };
    }
    case 'cobertura': {
      const [lo, hi] = cobertura(c, ctx);
      const okLo = lo != null && Math.abs(lo - 88e6) <= 0.15e6;
      const okHi = hi != null && Math.abs(hi - 108e6) <= 0.15e6;
      const ok = okLo && okHi;
      return {
        ok,
        mensaje: `Display en los extremos del dial: ${mhz(lo)} y ${mhz(hi)}. ${ok ? 'La banda cubre de 88 a 108 MHz.' : 'Objetivo: 88,0 y 108,0 MHz (±0,15). Extremo alto → C4B\'; extremo bajo → espiras de L2; repita: se influyen.'}`,
        mandos: ['c4b', 'l2'],
        piezas: ["C4B'", 'L2'],
        instrumento: null,
        atajos: [
          { texto: 'Variable al extremo alto', accion: (kk) => (kk.c.dial = 1) },
          { texto: 'Variable al extremo bajo', accion: (kk) => (kk.c.dial = 0) },
        ],
      };
    }
    case 'seguimiento': {
      const bajo = seguimiento(c, 88.6e6);
      const alto = seguimiento(c, 107.4e6);
      const ok = bajo != null && alto != null && bajo >= -0.4 && alto >= -0.4;
      const t = (g: number | null) => (g == null ? 'fuera del dial' : `${fx(g, 1)} dB`);
      return {
        ok,
        mensaje: ok
          ? `El circuito de entrada sigue al oscilador en toda la banda (pérdida ${t(bajo)} abajo y ${t(alto)} arriba).`
          : `Medidor: ${voltios(r.vMedidor)}. Con la emisora baja (88,6 MHz) ajuste L1 al máximo; con la alta (107,4 MHz), C4A'. Repita hasta estabilizar.`,
        mandos: ['l1', 'c4a'],
        piezas: ['L1', "C4A'"],
        instrumento: null,
        atajos: [
          { texto: 'Sintonizar 88,6 MHz (baja)', accion: (kk) => sintonizar(kk, 88.6) },
          { texto: 'Sintonizar 107,4 MHz (alta)', accion: (kk) => sintonizar(kk, 107.4) },
        ],
      };
    }
    case 'afc': {
      const tp1 = k.nodoDeRed.get('tp1');
      const v = k.tensionRed('tp1');
      if (!c.k1) return { ok: false, mensaje: 'Pulse K1 para activar el AFC.', mandos: ['w1'], piezas: ['K1', 'W1'], instrumento: 'multimetro' };
      if (k.roja !== tp1)
        return { ok: false, mensaje: 'Mida TP1 (el cursor de W1) con la punta roja; la negra, en masa.', mandos: ['w1'], piezas: ['W1'], instrumento: 'multimetro' };
      const salto = radio({ ...c, k1: false }, ctx).fOL != null && r.fOL != null ? Math.abs((radio({ ...c, k1: false }, ctx).fOL ?? 0) - (r.fOL ?? 0)) : 0;
      const ok = v != null && k.dcEstado === 'listo' && Math.abs(v - TP_OBJETIVO) <= 0.05;
      return {
        ok,
        mensaje: ok
          ? `TP1 = ${voltios(v, 3)}, igual que TP3: al pulsar o soltar K1 la frecuencia ya no salta (diferencia ${khz(salto, 1)}).`
          : `TP1 = ${voltios(v, 3)}. Gire W1 hasta 4,60 V (±0,05 V). Ahora, al soltar K1 la emisora se movería ${khz(salto, 0)}.`,
        mandos: ['w1'],
        piezas: ['W1', 'K1'],
        instrumento: 'multimetro',
      };
    }
    case 'estereo': {
      const faltan: string[] = [];
      if (!c.monitor && !memoria['estereo:w3']) faltan.push('soldar el puente «Monitor»');
      if (c.k3) faltan.push('poner K3 en estéreo');
      if (r.estereo) faltan.push('quitar la emisora estéreo (sintonice entre emisoras o recoja la antena)');
      const enTP4 = k.tp === 'TP4';
      if (!memoria['estereo:w3'] && !enTP4) faltan.push('mirar TP4 con el osciloscopio');
      const dentro = Math.abs(r.fVCO - 38e3) <= 150;
      if (!memoria['estereo:w3'] && !faltan.length && c.monitor && dentro && r.fTP4 != null) memoria['estereo:w3'] = true;
      const ok = !!memoria['estereo:w3'] && !c.monitor;
      return {
        ok,
        mensaje: ok
          ? `VCO libre en ${khz(r.fVCO, 2)} y puente «Monitor» abierto de nuevo. El indicador estéreo se encenderá con las emisoras estéreo.`
          : memoria['estereo:w3']
            ? `VCO en ${khz(r.fVCO, 2)}: correcto. Ahora vuelva a abrir el puente «Monitor».`
            : faltan.length
              ? `Falta: ${faltan.join(', ')}.`
              : `TP4: ${khz(r.fTP4, 2)}. Gire W3 hasta 38,00 kHz (±0,15 kHz).`,
        mandos: ['monitor', 'w3'],
        piezas: ['W3', 'MON', 'K3'],
        instrumento: 'osciloscopio',
        atajos: [{ texto: 'Sintonizar entre emisoras (93,0 MHz)', accion: (kk) => sintonizar(kk, 93.0) }],
      };
    }
    case 'mute': {
      if (!c.k2) return { ok: false, mensaje: 'Pulse K2 (Mute).', mandos: ['w2'], piezas: ['K2', 'W2'], instrumento: null };
      const entre = radio({ ...c, dial: dialDe(k, 93.0) ?? c.dial }, ctx);
      const debil = radio({ ...c, dial: dialDe(k, 91.3) ?? c.dial }, ctx);
      const calla = entre.gMute <= 0.1;
      const deja = debil.gMute >= 0.9;
      const ok = calla && deja;
      return {
        ok,
        mensaje: ok
          ? 'El siseo entre emisoras se calla y la emisora débil (91,3 MHz) sigue sonando: sensibilidad correcta.'
          : !calla
            ? `Entre emisoras aún se oye el siseo (mute al ${Math.round((1 - entre.gMute) * 100)} %): gire W2 para silenciar más.`
            : 'Demasiado silenciado: la emisora débil de 91,3 MHz también se calla. Gire W2 en sentido contrario.',
        mandos: ['w2'],
        piezas: ['W2', 'K2'],
        instrumento: null,
        atajos: [
          { texto: 'Entre emisoras (93,0 MHz)', accion: (kk) => sintonizar(kk, 93.0) },
          { texto: 'Emisora débil (91,3 MHz)', accion: (kk) => sintonizar(kk, 91.3) },
        ],
      };
    }
  }
  return { ok: false, mensaje: '', mandos: [], piezas: [], instrumento: null };
}

/** Dial position of a frequency (MHz) with the present tuning (no AFC). */
function dialDe(k: EstadoKit, f: number): number | null {
  const c = k.c;
  let a = 0;
  let b = 1;
  const g = (d: number) => (radio({ ...c, dial: d, k1: false }, { emisoras: [], averia: null }).fRx ?? 0) - f * 1e6;
  if (g(0) > 0 || g(1) < 0) return null;
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    if (g(m) > 0) b = m;
    else a = m;
  }
  return (a + b) / 2;
}

export { sintonizar, FI };
