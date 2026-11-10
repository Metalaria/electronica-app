// 1.1 «Laboratorio guiado»: the twelve practices of printed chapter 21 (cap22) as labs (laboratorio.ts explains the
// model). The steps follow the book's procedure for each practice (its «En el banco» and «Lo que hay que medir»), the
// hints name the mistakes the book warns about (×1/×10, AC/DC coupling, trigger source and edge, the ground clip, the
// meter in parallel, resistance with the supply on…), and every reading the summary compares is one of the
// practice's checks (practicas.ts `comprobaciones`, the book's expected values). Tolerances of a typed reading
// against the simulated instrument follow the instrument: the Brymen shows five digits (three are enough), the
// 2C53T has 8 bits (a step is 1/32 of a division, plus 1–2 mV of noise), its cursors move by 0,04 div and its
// FFT is read on a 10 dB/div grid. Ids of labs and steps are stored (progress, XP): never rename them.

import type { Banco } from '../banco.svelte.ts';
import type { Ajustes } from './tipos';
import type { Laboratorio, LecturaLab, Requisito } from './laboratorio';
import { PRACTICAS } from './practicas';
import { brymen, brymenSecundaria, deltaCursores, fnirsiDmm, gananciaDb, prm } from './lecturas';
import { leerParametro } from '../../../simulador/motor/netlist.ts';
import { FN_DMM_LISTA } from '../fnirsi/logica.svelte.ts';

// ------------------------------------------------------------------ reading the bench

const ch = (b: Banco, k: 0 | 1) => b.fnirsi.canales[k]!;
const nombreCh = (k: 0 | 1) => `CH${k + 1}`;
const casi = (x: number, y: number, r = 0.01) => Math.abs(x - y) <= Math.abs(y) * r + 1e-15;

/** A practice's check, by id (its `medir` reads the instrument only when it is set up as that check needs). */
function comp(n: number, id: string): (b: Banco) => number | null {
  const c = PRACTICAS.find((p) => p.n === n)?.comprobaciones.find((x) => x.id === id);
  if (!c) throw new Error(`Práctica ${n}: no existe la comprobación ${id}`);
  return c.medir;
}

/**
 * Screen position (divisions from the centre) of the first crossing of `nivel` by channel k, after `desde`. With
 * hysteresis: the trace must first have been a tenth of its span on the other side, so the noise of a crossing the
 * other way (a falling sine wiggling up through the level) is not taken for one (a cursor half a period off).
 */
export function cruce(b: Banco, k: 0 | 1, nivel: number, subida = true, desde = -6): number | null {
  const s = cruceS(b, k, nivel, subida, desde * b.fnirsi.sDiv);
  return s === null ? null : s / b.fnirsi.sDiv;
}

/**
 * The same crossing in seconds from the screen's centre (independent of the time base), after `desdeS` seconds. A
 * «Hágalo por mí» that also changes the time base converts with the base it applies, not the one on screen.
 */
export function cruceS(b: Banco, k: 0 | 1, nivel: number, subida = true, desdeS = -6 * b.fnirsi.sDiv): number | null {
  const c = b.fnirsi.captura;
  const y = c?.y[k];
  if (!c || !y) return null;
  const f = b.fnirsi;
  let max = -Infinity;
  let min = Infinity;
  for (const v of y) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
  const h = 0.1 * (max - min);
  let armado = false;
  for (let i = 1; i < y.length; i++) {
    const a = y[i - 1]!;
    const z = y[i]!;
    if (subida ? a <= nivel - h : a >= nivel + h) armado = true;
    const pasa = armado && (subida ? a < nivel && z >= nivel : a > nivel && z <= nivel);
    if (!pasa) continue;
    armado = false;
    const t = c.t0 + (i - 1 + (nivel - a) / (z - a)) * c.dt;
    const d = t - f.hpos;
    if (d >= desdeS) return d;
  }
  return null;
}

/** Highest and lowest displayed value of channel k on screen. */
function extremos(b: Banco, k: 0 | 1): { max: number; min: number } | null {
  const y = b.fnirsi.captura?.y[k];
  if (!y || !y.length) return null;
  let max = -Infinity;
  let min = Infinity;
  for (const v of y) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
  return { max, min };
}

/** The voltage cursors (displayed volts of the active channel), higher first. */
function cursoresV(b: Banco): [number, number] | null {
  const l = b.fnirsi.cursores === 'tension' ? b.fnirsi.lecturaCursores() : null;
  return l ? [Math.max(l.a, l.b), Math.min(l.a, l.b)] : null;
}

/**
 * Envelope of an AM signal at a probe tip, from the simulated waveform (not the 8-bit capture): its highest peak and
 * the lowest of the carrier's peaks, over the stretch on screen.
 */
function envolvente(b: Banco, k: 0 | 1, periodo: number): { max: number; min: number } | null {
  const e = b.entradasOsc().entradas[k];
  if (!e || typeof e === 'number') return null;
  const f = b.fnirsi;
  const t = e.t;
  const fin = t[t.length - 1]!;
  const ini = Math.max(t[0]!, fin - 12 * f.sDiv);
  let max = -Infinity;
  let min = Infinity;
  let pico = -Infinity;
  let inicioVentana = ini;
  for (let i = 0; i < t.length; i++) {
    if (t[i]! < ini) continue;
    const v = e.y[i]!;
    if (v > pico) pico = v;
    if (t[i]! - inicioVentana >= periodo) {
      if (pico > max) max = pico;
      if (pico < min) min = pico;
      pico = -Infinity;
      inicioVentana = t[i]!;
    }
  }
  return Number.isFinite(max) && Number.isFinite(min) ? { max, min } : null;
}

// ------------------------------------------------------------------ requirements

const r = (ok: (b: Banco) => boolean, pista: string): Requisito => ({ ok, pista });

/** The Brymen measuring voltage between two nodes. */
function rBrymenV(rojo: string, negro: string, pos: 'vdc' | 'vac' = 'vdc'): Requisito[] {
  const otra = pos === 'vdc' ? 'vac' : 'vdc';
  return [
    r((b) => b.brymen.posicion.id !== 'off', `El Brymen está apagado: gire el selector a ${pos === 'vdc' ? 'V⎓' : 'V∿'}.`),
    r((b) => b.brymen.borne === 'V', 'La punta roja está en un borne de corriente: para medir tensión va en <strong>VΩ</strong> (en paralelo, con la roja en mA fundiría el fusible).'),
    r((b) => b.brymen.posicion.id !== otra, pos === 'vdc' ? 'El selector está en V∿ (alterna) y esta tensión es continua: gírelo a <strong>V⎓</strong>.' : 'El selector está en V⎓ (continua): la frecuencia de esta señal solo se ve en <strong>V∿</strong>, en la pantalla secundaria.'),
    r((b) => b.brymen.posicion.id === pos, `Gire el selector del Brymen a <strong>${pos === 'vdc' ? 'V⎓' : 'V∿'}</strong>.`),
    r((b) => !b.bm.serie, 'El Brymen está en serie con una pieza: para tensión las puntas van en paralelo, una en cada punto.'),
    r((b) => !(b.bm.rojo === negro && b.bm.negro === rojo), `Las puntas están cambiadas (la lectura sale con el signo contrario): roja en <strong>${rojo}</strong>, negra en <strong>${negro === '0' ? 'masa' : negro}</strong>.`),
    r((b) => b.bm.negro === negro, `La punta negra (COM) va a <strong>${negro === '0' ? 'masa (0)' : negro}</strong>.`),
    r((b) => b.bm.rojo === rojo, `Ponga la punta roja en <strong>${rojo}</strong>.`),
  ];
}

/** The FNIRSI as an oscilloscope with channel k on node `nodo`, the ground clip on `masa`, probe and menu alike. */
function rSonda(k: 0 | 1, nodo: string, o: { masa?: string; textoMasa?: string; acoplamiento?: 'dc' | 'ac' } = {}): Requisito[] {
  const masa = o.masa ?? '0';
  const lista = [
    r((b) => b.fnirsi.encendido, 'El FNIRSI está apagado: enciéndalo con el botón rojo.'),
    r((b) => b.fnirsi.modo === 'osc', 'Pase el FNIRSI a <strong>osciloscopio</strong> (MENU → Osciloscopio).'),
    r((b) => b.sondas[k === 0 ? 'ch1' : 'ch2'] === nodo, `Ponga la sonda <strong>${nombreCh(k)}</strong> en <strong>${nodo === '0' ? 'la masa del circuito' : nodo}</strong>.`),
    r((b) => b.sondas.masa === masa, masa === '0' ? 'La pinza de masa no está en la masa del circuito: llévela a <strong>0</strong> (con la pinza en otro nodo, la sonda mide respecto a ese nodo).' : `Lleve la pinza de masa ${o.textoMasa ? `al <strong>${o.textoMasa}</strong>` : `a <strong>${masa}</strong>`}: la masa del FNIRSI es flotante y aquí es la referencia.`),
    r((b) => ch(b, k).on, `Active el canal ${nombreCh(k)} (botón ${nombreCh(k)}, Canal ON).`),
    r((b) => ch(b, k).sondaX10 === ch(b, k).menuX10, `El conmutador de la sonda de ${nombreCh(k)} y el factor del menú no coinciden (uno en ×10, otro en ×1): las amplitudes salen diez veces mal. Póngalos iguales.`),
  ];
  if (o.acoplamiento === 'dc') lista.push(r((b) => !ch(b, k).ac, `${nombreCh(k)} está en acoplamiento <strong>AC</strong>: quita la continua y la señal se ve alrededor de cero, sin su nivel. Póngalo en <strong>DC</strong> (menú del canal).`));
  if (o.acoplamiento === 'ac') lista.push(r((b) => ch(b, k).ac, `${nombreCh(k)} está en acoplamiento <strong>DC</strong>: la pequeña variación va sobre mucha continua y no cabe ampliada. Póngalo en <strong>AC</strong> (menú del canal).`));
  return lista;
}

const rX10 = (k: 0 | 1, x10: boolean) =>
  r((b) => ch(b, k).sondaX10 === x10 && ch(b, k).menuX10 === x10, `Ponga la sonda de ${nombreCh(k)} en <strong>${x10 ? '×10' : '×1'}</strong>: el conmutador de la sonda y el factor del menú del canal.`);

function rBase(min: number, max: number, texto: string): Requisito {
  return r((b) => b.fnirsi.sDiv >= min * 0.999 && b.fnirsi.sDiv <= max * 1.001, `Ajuste la base de tiempos a <strong>${texto}</strong> (◄ ► en el osciloscopio).`);
}

const rPrm = r((b) => b.fnirsi.prm, 'Active las medidas automáticas con <strong>PRM</strong>.');
const rCorre = r((b) => b.fnirsi.run || b.fnirsi.esperando, 'El osciloscopio está parado (STOP): pulse <strong>RUN/STOP</strong> para que adquiera.');
const rNoRecorta = (k: 0 | 1) =>
  r((b) => !b.fnirsi.captura?.recortado[k], `La señal de ${nombreCh(k)} se sale de la pantalla y las medidas fallan sin avisar: suba los V/div (▲ ▼) o pulse AUTO.`);
const rSinMates = r((b) => b.fnirsi.mates === 'no' && !b.fnirsi.xy, 'Quite Math y X-Y (SELECT): este paso se mira en la pantalla normal, tensión frente a tiempo.');

function rDisparo(fuente: 0 | 1, subida = true): Requisito[] {
  return [
    r((b) => b.fnirsi.disparo.fuente === fuente, `El disparo está en ${nombreCh(fuente === 0 ? 1 : 0)}: póngalo en <strong>${nombreCh(fuente)}</strong> (TRIGGER → Fuente) para que la imagen quede quieta en el mismo punto.`),
    r((b) => b.fnirsi.disparo.subida === subida, `Dispare con el flanco de <strong>${subida ? 'subida' : 'bajada'}</strong> (TRIGGER → Flanco).`),
  ];
}

const FORMAS: Record<string, string> = { seno: 'senoide', cuadrada: 'cuadrada', sierra: 'diente de sierra' };

function rGen(forma: string, frecuencia: number, o: { amplitud?: number; simetria?: number; textoF?: string } = {}): Requisito[] {
  const amp = o.amplitud ?? 3;
  const lista = [
    r((b) => b.fnirsi.dds.forma === forma, `Elija la forma <strong>${FORMAS[forma] ?? forma}</strong> en el generador (MENU → Generador).`),
    r((b) => casi(b.fnirsi.dds.frecuencia, frecuencia), `Ponga el generador a <strong>${o.textoF ?? `${frecuencia} Hz`}</strong>.`),
    r((b) => Math.abs(b.fnirsi.dds.amplitud - amp) < 0.05, `Ponga la amplitud del generador a <strong>${String(amp).replace('.', ',')} V</strong>.`),
    r((b) => b.fnirsi.dds.salida, 'Active la <strong>salida</strong> del generador (Salida ON).'),
  ];
  if (o.simetria !== undefined) lista.splice(1, 0, r((b) => b.fnirsi.dds.simetria === o.simetria, `Ponga la simetría del diente de sierra al <strong>${o.simetria} %</strong>.`));
  return lista;
}

// (review 11c: the hint names the instrument of the step and says what the simulator really shows: its capacitance
// meter, a small-signal model, reads the same with the supply on, which the old hint «miden mal» contradicted)
const SIN_TENSION = {
  ohm: 'Quite la alimentación («Circuito alimentado»): con tensión en el circuito el óhmetro mide mal (su pila de prueba se suma a la tensión del circuito), o se daña.',
  diodo: 'Quite la alimentación («Circuito alimentado»): la prueba de diodos inyecta su propia corriente y, con tensión en el circuito, mide mal o se daña.',
  cap: 'Quite la alimentación («Circuito alimentado»): la capacidad se mide sin tensión. Este simulador la mostraría igual, pero un capacímetro real carga el condensador con su propia corriente y, con el circuito alimentado, marca mal o se daña.',
} as const;
const rAlimentado = (si: boolean, para: keyof typeof SIN_TENSION = 'ohm') =>
  r((b) => b.alimentado === si, si ? 'El circuito está sin alimentación: marque «Circuito alimentado».' : SIN_TENSION[para]);

/** A time cursor within 0,06 div of a crossing (the cursor moves by 0,04 div: one step and a half). */
function rCursorEn(cual: 'a' | 'b', donde: (b: Banco) => number | null, texto: string): Requisito {
  return r((b) => {
    const d = donde(b);
    return d !== null && Math.abs(b.fnirsi.cur[cual] - d) <= 0.06;
  }, `Lleve el cursor <strong>${cual.toUpperCase()}</strong> ${texto}.`);
}

const rCursores = (tipo: 'tiempo' | 'tension') =>
  r((b) => b.fnirsi.cursores === tipo, `Active los <strong>cursores de ${tipo === 'tiempo' ? 'tiempo' : 'tensión'}</strong> (SELECT → Cursores).`);

const rSenal = (k: 0 | 1) => r((b) => !!b.fnirsi.captura?.y[k], `La pantalla aún no tiene la señal de ${nombreCh(k)}: espere a que adquiera (o pulse AUTO).`);

// ------------------------------------------------------------------ readings

const TRES_CIFRAS = 'basta con tres cifras; el Brymen da cinco y la última baila';
const OCHO_BITS = 'el 2C53T tiene 8 bits: un escalón es 1/32 de división y su ruido mueve uno o dos';

function lBm(que: string, unidad: string, libro?: string, medir: (b: Banco) => number | null = brymen): LecturaLab {
  return { que, unidad, medir, tol: { rel: 0.005 }, porqueTol: TRES_CIFRAS, libro };
}
function lPrm(k: 0 | 1, campo: 'vpp' | 'vmax' | 'vmin' | 'vrms' | 'f' | 'ciclo', que: string, libro?: string): LecturaLab {
  const medir = (b: Banco) => prm(b, k, campo);
  if (campo === 'f') return { que, unidad: 'Hz', medir, tol: { rel: 0.02 }, porqueTol: 'PRM da cuatro cifras y el recuento de flancos en 1 000 puntos baila un poco', libro };
  if (campo === 'ciclo') return { que, unidad: '%', medir, tol: { abs: 1.5 }, porqueTol: 'PRM da una décima y el flanco se sitúa con la resolución de la muestra', libro };
  return { que, unidad: 'V', medir, tol: { rel: 0.03, abs: 0.03 }, porqueTol: OCHO_BITS, libro };
}
function lDeltaT(que: string, libro?: string): LecturaLab {
  return { que, unidad: 's', medir: (b) => deltaCursores(b, 'tiempo'), tol: { rel: 0.015 }, porqueTol: 'la pantalla da Δt con tres cifras', libro };
}
function lFft(que: string, medir: (b: Banco) => number | null, libro: string, abs = 2): LecturaLab {
  return { que, unidad: 'dB', medir, tol: { abs }, porqueTol: 'la FFT se lee en una cuadrícula de 10 dB por división: una quinta parte de división', libro };
}

// ------------------------------------------------------------------ settings shared by «Hágalo por mí»

const OSC_INICIAL: NonNullable<Ajustes['fn']> = {
  modo: 'osc',
  ch: [{ on: true, vDiv: 1, pos: 0, ac: false, x10: true, invertir: false }, { on: false, vDiv: 1, pos: 0, ac: false, x10: true, invertir: false }],
  sDiv: 1e-3,
  hpos: 0,
  disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 0 },
  cursores: 'no',
  mates: 'no',
  xy: false,
  prm: false,
  dds: { salida: false },
};
const BM_APAGADO = { pos: 'off', sub: 0, borne: 'V' as const, rojo: null, negro: null, serie: null };
const sinGenerador = (dds: NonNullable<NonNullable<Ajustes['fn']>['dds']>) => ({ ...OSC_INICIAL, dds });
const bmV = (rojo: string, negro: string, pos = 'vdc') => ({ pos, sub: 0, borne: 'V' as const, rojo, negro, serie: null });

/** Cursor positions on a crossing: «Hágalo por mí» on a cursor step. */
// (the cursors move in steps of 0,04 div: B is rounded as A plus the rounded difference, so the Δ the reader then
// types is off by at most half a step, not by two roundings; review 11c)
const cursoresEn = (tipo: 'tiempo' | 'tension', a: number | null, c: number | null): Ajustes => {
  const ra = Math.round((a ?? -2) * 25) / 25;
  const rb = a !== null && c !== null ? Math.round((ra + Math.round((c - a) * 25) / 25) * 25) / 25 : Math.round((c ?? 2) * 25) / 25;
  return { fn: { cursores: tipo, cur: { a: ra, b: rb } } };
};

// ------------------------------------------------------------------ the labs

/** Practice 2: the flank of the generator and the 63,2 % crossing of the charge. */
const flancoP2 = (b: Banco) => cruce(b, 1, 1.5, true, -1);
const cruceP2 = (b: Banco) => {
  const e = extremos(b, 0);
  const a = flancoP2(b);
  return e && a !== null ? cruce(b, 0, 0.632 * e.max, true, a) : null;
};
/** Practice 5: the mid-level rising crossings of the input (CH1) and the output (CH2). */
const medio = (b: Banco, k: 0 | 1) => {
  const e = extremos(b, k);
  return e ? (e.max + e.min) / 2 : null;
};
const cruceP5 = (b: Banco, k: 0 | 1, desde = -6) => {
  const m = medio(b, k);
  return m === null ? null : cruce(b, k, m, true, desde);
};
/**
 * Practice 5: the delay of CH2's mid-level rising crossing after CH1's, from the simulated waveforms at the probes
 * (not the 8-bit capture, whose crossings wander by a few µs): the cursors' Δt the «Hágalo por mí» sets, so the
 * reading it leads to is the circuit's own (review 11c: 120 or 128 µs instead of 124 µs, outside the ± 1°).
 */
function retardoP5(b: Banco): number | null {
  const es = b.entradasOsc().entradas;
  const subidas = (k: 0 | 1): number[] => {
    const e = es[k];
    if (!e || typeof e === 'number' || e.t.length < 4) return [];
    const ini = Math.floor(e.t.length / 2);
    let max = -Infinity;
    let min = Infinity;
    for (let i = ini; i < e.y.length; i++) {
      if (e.y[i]! > max) max = e.y[i]!;
      if (e.y[i]! < min) min = e.y[i]!;
    }
    const m = (max + min) / 2;
    const h = 0.1 * (max - min);
    const out: number[] = [];
    let armado = false;
    for (let i = ini + 1; i < e.y.length; i++) {
      const y0 = e.y[i - 1]!;
      const y1 = e.y[i]!;
      if (y0 <= m - h) armado = true;
      if (armado && y0 < m && y1 >= m) {
        out.push(e.t[i - 1]! + ((m - y0) / (y1 - y0)) * (e.t[i]! - e.t[i - 1]!));
        armado = false;
      }
    }
    return out;
  };
  const s1 = subidas(0);
  const s2 = subidas(1);
  for (let k = s1.length - 1; k >= 0; k--) {
    const t2 = s2.find((t) => t > s1[k]!);
    if (t2 !== undefined) return t2 - s1[k]!;
  }
  return null;
}
/** The same crossings in seconds (for a «Hágalo por mí» that changes the time base as it places the cursors). */
const cruceP5s = (b: Banco, k: 0 | 1, desdeS: number) => {
  const m = medio(b, k);
  return m === null ? null : cruceS(b, k, m, true, desdeS);
};
/** Practice 10: the 10 % and 90 % crossings of the edge. */
const cruceP10 = (b: Banco, f: number) => {
  const e = extremos(b, 0);
  return e ? cruce(b, 0, e.min + f * (e.max - e.min), true, -6) : null;
};
/** Practice 12: |Z| from the two channels' RMS values (both AC-coupled), at the generator's 120 Hz. */
const zEficaz = (b: Banco) => {
  const a = prm(b, 0, 'vrms');
  const c = prm(b, 1, 'vrms');
  if (!a || !c || c >= a || !casi(b.fnirsi.dds.frecuencia, 120)) return null;
  const k = c / a;
  return (100 * k) / Math.sqrt(1 - k * k);
};
/** Practice 11: the AM envelope on CH1 (carrier of 100 kHz). */
const envP11 = (b: Banco) => envolvente(b, 0, 10e-6);
const divTension = (b: Banco, v: number, k: 0 | 1 = b.fnirsi.activo as 0 | 1) => v / ch(b, k).vDiv + ch(b, k).pos;

export const LABORATORIOS: Laboratorio[] = [
  // ------------------------------------------------------------------ 1
  {
    n: 1,
    inicial: { variante: 'p1', alimentado: true, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: OSC_INICIAL },
    pasos: [
      {
        id: 'alimentacion',
        titulo: 'Mida la alimentación',
        texto: 'Brymen en <strong>V⎓</strong>, punta roja en el positivo de la fuente (<strong>a</strong>) y negra en masa. Escriba lo que marca.',
        requisitos: rBrymenV('a', '0'),
        lectura: lBm('la alimentación', 'V', 'vin'),
        guia: { bm: { posicion: 'vdc', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { bm: bmV('a', '0') },
        errores: [
          { nombre: 'selector en alterna', hacer: { bm: { pos: 'vac' } }, pista: 'V∿' },
          { nombre: 'puntas cambiadas', hacer: { bm: { rojo: '0', negro: 'a' } }, pista: 'cambiadas' },
          { nombre: 'roja en el borne de corriente', hacer: { bm: { borne: 'mA' } }, pista: 'VΩ' },
        ],
      },
      {
        id: 'vout',
        titulo: 'Mida la salida del divisor',
        texto: 'Lleve la punta roja al punto medio, <strong>out</strong>. Calculado: 9 × 4 700 / 14 700 = 2,88 V.',
        requisitos: rBrymenV('out', '0'),
        lectura: lBm('V<sub>out</sub>', 'V', 'vout'),
        guia: { bm: { posicion: 'vdc', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { bm: bmV('out', '0') },
      },
      {
        id: 'corriente',
        titulo: 'Mida la corriente, en serie',
        texto: 'Selector en <strong>A mA</strong>, punta roja al borne <strong>mA µA</strong> y el polímetro <em>en serie</em>: abra el circuito en una pata de R1 y ciérrelo con él.',
        requisitos: [
          r((b) => !b.avisoFusible, 'Se ha fundido el fusible: un amperímetro en paralelo es un cortocircuito. Cambie los fusibles y póngalo en serie.'),
          r((b) => b.brymen.posicion.id === 'amA', 'Gire el selector a <strong>A mA</strong>.'),
          r((b) => b.brymen.borne === 'mA', 'La punta roja debe ir al borne <strong>mA µA</strong> (en VΩ el polímetro no mide corriente; el borne A es para amperios).'),
          r((b) => !!b.bm.serie, 'Un amperímetro va <strong>en serie</strong>: elija «En serie con» R1 en las conexiones del Brymen, no las puntas sobre dos nodos.'),
          r((b) => b.bm.serie?.elemento === 'R1', 'Póngalo en serie con <strong>R1</strong>, entre la fuente y el divisor.'),
        ],
        lectura: lBm('la corriente', 'A', 'i'),
        guia: { bm: { posicion: 'amA', borne: 'mA' }, instrumento: 'brymen' },
        hazlo: { bm: { pos: 'amA', sub: 0, borne: 'mA', serie: { elemento: 'R1', terminal: 0 } } },
        errores: [
          { nombre: 'roja aún en VΩ', hacer: { bm: { borne: 'V' } }, pista: 'mA µA' },
          { nombre: 'en paralelo con la fuente', hacer: { bm: { serie: null, rojo: 'a', negro: '0' } }, pista: 'fusible' },
        ],
      },
      {
        id: 'rth',
        titulo: 'Impedancia de salida',
        texto: 'Devuelva la roja a <strong>VΩ</strong>, <strong>quite la alimentación</strong> (la fuente queda como un cortocircuito) y mida en <strong>Ω</strong> entre out y masa: R1 ∥ R2.',
        requisitos: [
          r((b) => b.brymen.borne === 'V', 'La punta roja tiene que volver al borne <strong>VΩ</strong>.'),
          rAlimentado(false),
          r((b) => b.brymen.posicion.id === 'ohm' && b.brymen.sub === 0, 'Gire el selector a <strong>Ω</strong> (sin continuidad: SELECT la cambia).'),
          r((b) => !b.bm.serie && b.bm.rojo === 'out' && b.bm.negro === '0', 'Las puntas van de <strong>out</strong> (roja) a masa (negra), en paralelo.'),
        ],
        lectura: lBm('la resistencia de salida', 'Ω', 'rth'),
        guia: { bm: { posicion: 'ohm', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { alimentado: false, bm: { pos: 'ohm', sub: 0, borne: 'V', serie: null, rojo: 'out', negro: '0' } },
        errores: [{ nombre: 'óhmetro con alimentación', hacer: { alimentado: true }, pista: 'alimentación' }],
      },
      {
        id: 'carga',
        titulo: 'El instrumento carga',
        texto: 'Ahora R1 = R2 = 1 MΩ y la alimentación vuelve. Mida V<sub>out</sub> en V⎓: la teoría dice 4,5 V; los 10 MΩ del multímetro quedan en paralelo con R2.',
        preparar: { variante: 'p1_alta', alimentado: true },
        requisitos: [rAlimentado(true), ...rBrymenV('out', '0')],
        lectura: lBm('V<sub>out</sub> con 1 MΩ', 'V', 'alta'),
        guia: { bm: { posicion: 'vdc', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { alimentado: true, bm: bmV('out', '0') },
      },
      {
        id: 'led',
        titulo: 'Un divisor no alimenta nada',
        texto: 'Con un LED y su resistencia de 330 Ω en la salida, mida otra vez V<sub>out</sub>: el divisor tiene 3,2 kΩ de impedancia de salida.',
        preparar: { variante: 'p1_led', alimentado: true },
        requisitos: [rAlimentado(true), ...rBrymenV('out', '0')],
        lectura: lBm('V<sub>out</sub> con el LED', 'V', 'led'),
        guia: { bm: { posicion: 'vdc', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { bm: bmV('out', '0') },
      },
    ],
  },
  // ------------------------------------------------------------------ 2
  {
    n: 2,
    inicial: { variante: 'p2', alimentado: true, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: sinGenerador({ forma: 'seno', frecuencia: 1000, amplitud: 1, salida: false }) },
    pasos: [
      {
        id: 'generador',
        titulo: 'Prepare el generador',
        texto: 'MENU → Generador: <strong>cuadrada de 100 Hz y 3 V</strong>, salida activada. Cada semiciclo dura 5 ms: cinco constantes de tiempo.',
        requisitos: rGen('cuadrada', 100),
        guia: { fn: { boton: 'menu' }, instrumento: 'fnirsi' },
        hazlo: { fn: { dds: { forma: 'cuadrada', frecuencia: 100, amplitud: 3, ciclo: 50, salida: true } } },
      },
      {
        id: 'sondas',
        titulo: 'Vea la carga',
        texto: 'Osciloscopio: CH1 en el condensador (<strong>c</strong>), CH2 en el generador (<strong>g</strong>), los dos en DC; <strong>1 ms/div</strong>; disparo en CH2, flanco de subida. Lea con PRM la Vmáx de CH1.',
        requisitos: [...rSonda(0, 'c', { acoplamiento: 'dc' }), ...rSonda(1, 'g', { acoplamiento: 'dc' }), rBase(1e-3, 1e-3, '1 ms/div'), ...rDisparo(1), rSinMates, rCorre, rPrm, rNoRecorta(0)],
        lectura: lPrm(0, 'vmax', 'la Vmáx de CH1'),
        guia: { fn: { boton: 'trigger' }, instrumento: 'fnirsi' },
        hazlo: {
          sondas: { ch1: 'c', ch2: 'g', masa: '0' },
          fn: { modo: 'osc', ch: [{ on: true, vDiv: 0.5, pos: -3, ac: false, x10: true }, { on: true, vDiv: 1, pos: 0.5, ac: false, x10: true }], sDiv: 1e-3, hpos: 0, disparo: { modo: 'auto', fuente: 1, subida: true, nivel: 1.5 }, mates: 'no', xy: false, prm: true },
        },
        errores: [
          { nombre: 'CH1 en AC', hacer: { fn: { ch: [{ ac: true }, null] } }, pista: 'AC' },
          { nombre: 'conmutador ×1 con el menú en ×10', hacer: (b) => void (ch(b, 0).sondaX10 = false), pista: 'no coinciden' },
          { nombre: 'disparo en CH1', hacer: { fn: { disparo: { fuente: 0 } } }, pista: 'CH2' },
          { nombre: 'pinza de masa en el generador', hacer: { sondas: { masa: 'g' } }, pista: 'pinza de masa' },
        ],
      },
      {
        id: 'tau',
        titulo: 'Mida τ con los cursores',
        texto: 'Cursores de <strong>tiempo</strong>: A en el flanco del generador y B donde la carga cruza el <strong>63,2 %</strong> de su valor final. Escriba Δt: es τ.',
        requisitos: [
          ...rSonda(0, 'c', { acoplamiento: 'dc' }),
          rCursores('tiempo'),
          rSenal(0),
          rCursorEn('a', flancoP2, 'al flanco de subida del generador (CH2)'),
          rCursorEn('b', cruceP2, 'al punto donde la carga cruza el 63,2 % de su valor final'),
        ],
        lectura: lDeltaT('Δt', 'tau'),
        cursores: true,
        guia: { fn: { boton: 'select' }, instrumento: 'fnirsi' },
        hazlo: (b) => cursoresEn('tiempo', flancoP2(b), cruceP2(b)),
      },
      {
        id: 'sonda',
        titulo: 'La sonda forma parte del circuito',
        texto: 'Ahora R = 1 MΩ. Baje el generador a <strong>1 Hz</strong> y la base a <strong>100 ms/div</strong>; lea la Vmáx de CH1: los 10 MΩ de la sonda la dejan en el 90,9 %.',
        preparar: { variante: 'p2_lenta' },
        requisitos: [...rGen('cuadrada', 1, { textoF: '1 Hz' }), ...rSonda(0, 'c', { acoplamiento: 'dc' }), rBase(100e-3, 100e-3, '100 ms/div'), rSinMates, rCorre, rPrm, rNoRecorta(0)],
        lectura: lPrm(0, 'vmax', 'la Vmáx de CH1', 'final'),
        guia: { fn: { boton: 'menu' }, instrumento: 'fnirsi' },
        hazlo: { fn: { dds: { frecuencia: 1 }, sDiv: 100e-3, hpos: 0, cursores: 'no', prm: true } },
      },
    ],
  },
  // ------------------------------------------------------------------ 3
  {
    n: 3,
    inicial: { variante: 'p3', alimentado: true, parametros: { 'v1.dc': 2 }, bm: BM_APAGADO, fnDmm: { serie: null }, sondas: { ch1: null, ch2: null, masa: '0' }, fn: OSC_INICIAL },
    pasos: [
      {
        id: 'vd',
        titulo: 'La tensión del diodo',
        texto: 'El Brymen mide V<sub>D</sub>: <strong>V⎓</strong>, roja en el ánodo (<strong>a</strong>) y negra en el cátodo, que está en masa.',
        requisitos: rBrymenV('a', '0'),
        guia: { bm: { posicion: 'vdc', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { bm: bmV('a', '0') },
      },
      {
        id: 'corriente',
        titulo: 'La corriente, con el FNIRSI',
        texto: 'MENU → <strong>Multímetro</strong>, función <strong>DCA</strong>, punta roja al borne <strong>mA</strong>, y el FNIRSI en serie con la <strong>resistencia</strong> R1.',
        requisitos: [
          r((b) => b.fnirsi.modo === 'dmm', 'Pase el FNIRSI a <strong>multímetro</strong> (MENU → Multímetro).'),
          r((b) => FN_DMM_LISTA[b.fnirsi.fnDmm]?.id === 'idc', 'Elija la función <strong>DCA</strong> (corriente continua) con ▲ ▼.'),
          r((b) => b.fnirsi.borne === 'mA', 'La punta roja del FNIRSI va al borne <strong>mA</strong>.'),
          r((b) => b.fn.serie?.elemento !== 'D1', 'En serie con el diodo, el Brymen mediría también la caída de la derivación (10 Ω × 4 mA = 43 mV): póngalo en serie con <strong>la resistencia</strong>.'),
          r((b) => b.fn.serie?.elemento === 'R1', 'Ponga el multímetro del FNIRSI <strong>en serie con R1</strong> (conexiones del FNIRSI, «En serie con»).'),
        ],
        guia: { fn: { boton: 'menu' }, instrumento: 'fnirsi' },
        hazlo: { fnDmm: { funcion: 'idc', borne: 'mA', serie: { elemento: 'R1', terminal: 0 } }, fn: { modo: 'dmm' } },
        errores: [{ nombre: 'en serie con el diodo', hacer: { fnDmm: { serie: { elemento: 'D1', terminal: 0 } } }, pista: 'derivación' }],
      },
      {
        id: 'v5',
        titulo: 'Al final del barrido',
        texto: 'Suba la fuente <strong>V1 a 5 V</strong> (deslizador de V1) y lea V<sub>D</sub> en el Brymen. Por cada década de corriente sube unos 100 mV.',
        requisitos: [r((b) => leerParametro(b.texto, 'v1.dc') === 5, 'Lleve el deslizador <strong>V1</strong> a 5 V.'), ...rBrymenV('a', '0')],
        lectura: lBm('V<sub>D</sub>', 'V', 'vd'),
        guia: { bm: { posicion: 'vdc' }, instrumento: 'brymen' },
        hazlo: { parametros: { 'v1.dc': 5 }, bm: bmV('a', '0') },
      },
      {
        id: 'i5',
        titulo: 'La corriente con 5 V',
        texto: 'Lea ahora la corriente en el FNIRSI: con 5 V se llega a unos 4,4 mA.',
        requisitos: [
          r((b) => leerParametro(b.texto, 'v1.dc') === 5, 'Deje la fuente <strong>V1</strong> en 5 V.'),
          r((b) => b.fnirsi.modo === 'dmm' && FN_DMM_LISTA[b.fnirsi.fnDmm]?.id === 'idc' && b.fnirsi.borne === 'mA' && b.fn.serie?.elemento === 'R1', 'El FNIRSI tiene que seguir en DCA, borne mA, en serie con R1.'),
        ],
        lectura: { que: 'la corriente', unidad: 'A', medir: fnirsiDmm, tol: { rel: 0.005 }, porqueTol: 'basta con tres cifras de las cuatro del FNIRSI', libro: 'id' },
        guia: { instrumento: 'fnirsi' },
        hazlo: { parametros: { 'v1.dc': 5 }, fnDmm: { funcion: 'idc', borne: 'mA', serie: { elemento: 'R1', terminal: 0 } }, fn: { modo: 'dmm' } },
      },
      {
        id: 'prueba',
        titulo: 'Prueba de diodos',
        texto: 'Con el diodo suelto y sin alimentación: Brymen en <strong>⊣⊢ ⏵</strong>, <strong>SELECT</strong> hasta el símbolo del diodo, roja en el ánodo y negra en el cátodo.',
        preparar: { variante: 'p3_suelto', alimentado: false, fnDmm: { serie: null } },
        requisitos: [
          rAlimentado(false, 'diodo'),
          r((b) => b.brymen.borne === 'V', 'La punta roja va al borne <strong>VΩ</strong>.'),
          r((b) => b.brymen.posicion.id === 'cap', 'Gire el selector a <strong>⊣⊢ ⏵</strong>.'),
          r((b) => b.brymen.ids?.[0] === 'diodo', 'El selector está en capacidad: pulse <strong>SELECT</strong> para pasar a la prueba de diodos (⏵).'),
          r((b) => !(b.bm.rojo === '0' && b.bm.negro === 'a'), 'Las puntas están al revés: así el diodo no conduce y la pantalla marca OL. Roja en el <strong>ánodo</strong> (a).'),
          r((b) => b.bm.rojo === 'a' && b.bm.negro === '0' && !b.bm.serie, 'Roja en el ánodo (<strong>a</strong>), negra en el cátodo (masa).'),
        ],
        lectura: lBm('la caída del diodo', 'V', 'prueba'),
        guia: { bm: { posicion: 'cap', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { bm: { pos: 'cap', sub: 1, borne: 'V', serie: null, rojo: 'a', negro: '0' } },
        errores: [{ nombre: 'diodo al revés', hacer: { bm: { rojo: '0', negro: 'a' } }, pista: 'al revés' }],
      },
      {
        id: 'xy',
        titulo: 'La curva en X-Y',
        texto: 'Senoide de 50 Hz y 3 V. Pinza de masa en el <strong>cátodo (k)</strong>; CH1 en el ánodo vía el generador (<strong>g</strong>) y CH2 en la masa del circuito, <strong>invertido</strong>; SELECT → Pantalla <strong>X-Y</strong>.',
        preparar: { variante: 'p3_xy', alimentado: true, bm: BM_APAGADO },
        requisitos: [
          ...rGen('seno', 50),
          ...rSonda(0, 'g', { masa: 'k', textoMasa: 'cátodo (k)' }),
          ...rSonda(1, '0', { masa: 'k', textoMasa: 'cátodo (k)' }),
          r((b) => ch(b, 1).invertir, 'Invierta <strong>CH2</strong> (menú de CH2 → Invertir): mide −I·R.'),
          r((b) => b.fnirsi.xy, 'Pase la pantalla a <strong>X-Y</strong> (SELECT → Pantalla).'),
        ],
        guia: { fn: { boton: 'select' }, instrumento: 'fnirsi' },
        hazlo: {
          sondas: { ch1: 'g', ch2: '0', masa: 'k' },
          fn: { modo: 'osc', xy: true, sDiv: 5e-3, ch: [{ on: true, vDiv: 0.1, pos: -3, x10: true }, { on: true, vDiv: 0.5, pos: -3, x10: true, invertir: true }], dds: { forma: 'seno', frecuencia: 50, amplitud: 3, salida: true } },
        },
        errores: [{ nombre: 'pinza de masa en la masa del circuito', hacer: { sondas: { masa: '0' } }, pista: 'cátodo' }],
      },
    ],
  },
  // ------------------------------------------------------------------ 4
  {
    n: 4,
    inicial: { variante: 'p4_sinC', alimentado: true, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: OSC_INICIAL },
    pasos: [
      {
        id: 'forma',
        titulo: 'Los semiciclos en pantalla',
        texto: 'Sin condensador. CH1 en la salida (<strong>out</strong>), en DC, con los V/div que hagan caber 12 V (5 V/div) y <strong>5 ms/div</strong>. Lea la Vmáx con PRM.',
        requisitos: [...rSonda(0, 'out', { acoplamiento: 'dc' }), rBase(5e-3, 5e-3, '5 ms/div'), rSinMates, rCorre, rPrm, rNoRecorta(0)],
        lectura: lPrm(0, 'vmax', 'la Vmáx de CH1'),
        guia: { fn: { boton: 'ch1' }, instrumento: 'fnirsi' },
        hazlo: { sondas: { ch1: 'out', masa: '0' }, fn: { modo: 'osc', ch: [{ on: true, vDiv: 5, pos: -2, ac: false, x10: true }, null], sDiv: 5e-3, hpos: 0, disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 5 }, prm: true } },
        errores: [{ nombre: 'canal en AC', hacer: { fn: { ch: [{ ac: true }, null] } }, pista: 'DC' }],
      },
      {
        id: 'media',
        titulo: 'Lo que promedia el multímetro',
        texto: 'Brymen en <strong>V⎓</strong> en la salida: marca el valor medio, unos 3,7 V, aunque la señal vaya de 0 a 12 V.',
        requisitos: rBrymenV('out', '0'),
        lectura: lBm('el valor medio', 'V', 'media'),
        guia: { bm: { posicion: 'vdc', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { bm: bmV('out', '0') },
      },
      {
        id: 'rizado',
        titulo: 'El rizado, en AC',
        texto: 'Con <strong>1 000 µF</strong> la salida queda cerca del pico. Para ver el rizado: CH1 en <strong>AC</strong> y <strong>0,5 V/div</strong>. Lea su Vpp.',
        preparar: { variante: 'p4' },
        requisitos: [
          ...rSonda(0, 'out', { acoplamiento: 'ac' }),
          r((b) => ch(b, 0).vDiv <= 0.5 * 1.001, 'Con tantos V/div el rizado ocupa una fracción de división y los 8 bits lo miden mal: baje a <strong>0,5 V/div</strong>.'),
          rSinMates,
          rCorre,
          rPrm,
          rNoRecorta(0),
        ],
        lectura: lPrm(0, 'vpp', 'la Vpp del rizado', 'rizado'),
        guia: { fn: { boton: 'ch1' }, instrumento: 'fnirsi' },
        hazlo: { fn: { ch: [{ on: true, vDiv: 0.5, pos: 0, ac: true }, null], disparo: { nivel: 0 }, prm: true } },
        errores: [{ nombre: 'rizado en DC', hacer: { fn: { ch: [{ ac: false }, null] } }, pista: 'AC' }],
      },
      {
        id: 'pico',
        titulo: 'La forma de la corriente',
        texto: 'Brymen en <strong>A mA</strong>, roja al borne <strong>A</strong>, en serie con el diodo D1, y <strong>CREST</strong> (picos de 1 ms). Lea el pico.',
        requisitos: [
          r((b) => !b.avisoFusible, 'Se ha fundido el fusible: cambie los fusibles y use el borne A.'),
          r((b) => b.brymen.posicion.id === 'amA', 'Gire el selector a <strong>A mA</strong>.'),
          r((b) => b.brymen.borne === 'A', 'Más de 1 A de pico no cabe en el borne mA (fusible de 440 mA): la roja va al borne <strong>A</strong>.'),
          r((b) => b.bm.serie?.elemento === 'D1', 'Ponga el Brymen <strong>en serie con el diodo</strong> D1.'),
          r((b) => !!b.brymen.crest && b.brymen.crest.vista === 0, 'Pulse <strong>CREST</strong> (una vez: el máximo).'),
        ],
        lectura: lBm('el pico de corriente', 'A', 'pico'),
        guia: { bm: { posicion: 'amA', borne: 'A' }, instrumento: 'brymen' },
        hazlo: { bm: { pos: 'amA', sub: 0, borne: 'A', serie: { elemento: 'D1', terminal: 0 }, crest: true } },
        errores: [{ nombre: 'borne mA', hacer: { bm: { borne: 'mA' } }, pista: 'borne' }],
      },
    ],
  },
  // ------------------------------------------------------------------ 5
  {
    n: 5,
    inicial: { variante: 'p5', alimentado: true, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: sinGenerador({ forma: 'seno', frecuencia: 100, amplitud: 3, salida: false }) },
    pasos: [
      {
        id: 'conexion',
        titulo: 'Entrada y salida',
        texto: 'Senoide de <strong>1 kHz y 3 V</strong> en la entrada. CH1 en la entrada (<strong>in</strong>), CH2 en la salida (<strong>out</strong>), los dos en DC; PRM activado.',
        requisitos: [...rGen('seno', 1000, { textoF: '1 kHz' }), ...rSonda(0, 'in', { acoplamiento: 'dc' }), ...rSonda(1, 'out', { acoplamiento: 'dc' }), rSinMates, rPrm],
        guia: { fn: { boton: 'menu' }, instrumento: 'fnirsi' },
        hazlo: {
          sondas: { ch1: 'in', ch2: 'out', masa: '0' },
          fn: { modo: 'osc', ch: [{ on: true, vDiv: 1, pos: -1.5, ac: false, x10: true }, { on: true, vDiv: 1, pos: -1.5, ac: false, x10: true }], sDiv: 200e-6, hpos: 0, disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 1.5 }, dds: { forma: 'seno', frecuencia: 1000, amplitud: 3, salida: true }, mates: 'no', xy: false, prm: true },
        },
      },
      {
        id: 'g1k',
        titulo: 'La ganancia en el corte',
        texto: 'A 1 kHz, lea la Vpp de CH1 y de CH2 y escriba la ganancia <strong>20·log(Vpp<sub>2</sub>/Vpp<sub>1</sub>)</strong> en dB. Calculado: f<sub>c</sub> = 995 Hz.',
        requisitos: [...rGen('seno', 1000, { textoF: '1 kHz' }), ...rSonda(0, 'in'), ...rSonda(1, 'out'), rSinMates, rPrm, rNoRecorta(0), rNoRecorta(1)],
        lectura: { que: 'la ganancia', unidad: 'dB', medir: gananciaDb, tol: { abs: 0.3 }, porqueTol: 'cada Vpp de 8 bits lleva un 1–2 %', libro: 'g1k' },
        guia: { instrumento: 'fnirsi' },
        hazlo: { fn: { dds: { frecuencia: 1000 }, prm: true } },
      },
      {
        id: 'fase',
        titulo: 'El desfase, con cursores',
        texto: 'A <strong>100 µs/div</strong>, cursores de tiempo: A en el paso por el centro de la entrada (subiendo) y B en el de la salida. Escriba el desfase <strong>Δt·f·360</strong> en grados.',
        requisitos: [
          ...rGen('seno', 1000, { textoF: '1 kHz' }),
          rBase(100e-6, 100e-6, '100 µs/div'),
          rCursores('tiempo'),
          rSenal(0),
          rSenal(1),
          rCursorEn('a', (b) => cruceP5(b, 0, -5), 'al paso de la entrada (CH1) por su nivel medio, subiendo'),
          rCursorEn('b', (b) => cruceP5(b, 1, b.fnirsi.cur.a), 'al siguiente paso de la salida (CH2) por su nivel medio, subiendo'),
        ],
        lectura: { que: 'el desfase', unidad: '°', medir: (b) => { const d = deltaCursores(b, 'tiempo'); return d === null ? null : d * b.fnirsi.dds.frecuencia * 360; }, tol: { abs: 1 }, porqueTol: 'Δt se lee con tres cifras', libro: 'fase' },
        cursores: true,
        guia: { fn: { boton: 'select' }, instrumento: 'fnirsi' },
        hazlo: (b) => {
          // the crossings in seconds, turned into divisions of the 100 µs/div this applies (the screen may still be
          // at 200 µs/div from the step before: positions in its divisions would land at half the time)
          const S = 100e-6;
          const a = cruceP5s(b, 0, -5 * S);
          const d = retardoP5(b);
          const c = a === null ? null : d !== null ? a + d : cruceP5s(b, 1, a);
          return { fn: { sDiv: S, ...cursoresEn('tiempo', a === null ? null : a / S, c === null ? null : c / S).fn } };
        },
      },
      {
        id: 'g20k',
        titulo: 'Una década y más arriba',
        texto: 'Suba el generador a <strong>20 kHz</strong> y quite los cursores. La salida es pequeña: CH2 a <strong>0,2 V/div</strong>, movida hacia abajo para que quepa. Escriba la ganancia en dB.',
        requisitos: [
          ...rGen('seno', 20000, { textoF: '20 kHz' }),
          ...rSonda(1, 'out'),
          rSinMates,
          rPrm,
          rSenal(1),
          r((b) => ch(b, 1).vDiv <= 0.2 * 1.001, 'La salida es de unos 0,15 Vpp: con tantos V/div ocupa una fracción de división y los 8 bits la miden mal. Baje CH2 a <strong>0,2 V/div</strong> (▲ ▼ con CH2 activo) y súbala con MOVE si se sale.'),
          rNoRecorta(1),
        ],
        lectura: { que: 'la ganancia', unidad: 'dB', medir: gananciaDb, tol: { abs: 0.5 }, porqueTol: 'una Vpp pequeña de 8 bits lleva un 3–4 %', libro: 'g20k' },
        guia: { instrumento: 'fnirsi' },
        hazlo: { fn: { dds: { frecuencia: 20000 }, sDiv: 20e-6, cursores: 'no', ch: [null, { vDiv: 0.2, pos: -4, ac: false }], prm: true } },
      },
    ],
  },
  // ------------------------------------------------------------------ 6
  {
    n: 6,
    inicial: { variante: 'p6', alimentado: true, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: sinGenerador({ forma: 'seno', frecuencia: 1000, amplitud: 3, salida: false }) },
    pasos: [
      {
        id: 'fft',
        titulo: 'La FFT de la cuadrada',
        texto: 'Cuadrada de <strong>1 kHz y 3 V</strong> al CH1 (<strong>g</strong>), <strong>1 ms/div</strong> (doce ciclos: resolución de 83 Hz) y SELECT → Math → <strong>FFT CH1</strong>.',
        requisitos: [
          ...rGen('cuadrada', 1000, { textoF: '1 kHz' }),
          ...rSonda(0, 'g'),
          rBase(1e-3, 1e-3, '1 ms/div'),
          r((b) => b.fnirsi.mates !== 'fft2', 'La FFT es la de CH2, que no tiene señal: elija <strong>FFT CH1</strong>.'),
          r((b) => b.fnirsi.mates === 'fft1', 'Active la FFT de CH1 (SELECT → Math → FFT CH1).'),
        ],
        guia: { fn: { boton: 'select' }, instrumento: 'fnirsi' },
        hazlo: { sondas: { ch1: 'g', masa: '0' }, fn: { modo: 'osc', ch: [{ on: true, vDiv: 1, pos: -1.5, ac: false, x10: true }, null], sDiv: 1e-3, mates: 'fft1', dds: { forma: 'cuadrada', frecuencia: 1000, amplitud: 3, ciclo: 50, salida: true } } },
        errores: [{ nombre: 'FFT de CH2', hacer: { fn: { mates: 'fft2' } }, pista: 'FFT CH1' }],
      },
      {
        id: 'h3',
        titulo: 'Solo armónicos impares',
        texto: 'Compare la raya de <strong>3 kHz</strong> con la de 1 kHz en la cuadrícula (10 dB/div). Escriba cuántos dB está por debajo (con signo menos).',
        requisitos: [...rGen('cuadrada', 1000, { textoF: '1 kHz' }), r((b) => b.fnirsi.mates === 'fft1', 'Mantenga la FFT de CH1.')],
        lectura: lFft('el 3.<sup>er</sup> armónico', comp(6, 'h3'), 'h3'),
        guia: { instrumento: 'fnirsi' },
        hazlo: { fn: { mates: 'fft1' } },
      },
      {
        id: 'h3t',
        titulo: 'La triangular',
        texto: 'Generador en <strong>diente de sierra con simetría del 50 %</strong> (una triangular). Lea otra vez el tercer armónico respecto a la fundamental.',
        requisitos: [...rGen('sierra', 1000, { simetria: 50, textoF: '1 kHz' }), r((b) => b.fnirsi.mates === 'fft1', 'Mantenga la FFT de CH1.')],
        lectura: lFft('el 3.<sup>er</sup> armónico', comp(6, 'h3t'), 'h3t'),
        guia: { fn: { boton: 'menu' }, instrumento: 'fnirsi' },
        hazlo: { fn: { dds: { forma: 'sierra', simetria: 50 } } },
      },
      {
        id: 'h2s',
        titulo: 'El diente de sierra',
        texto: 'Simetría al <strong>100 %</strong>: aparecen también los pares. Lea el <strong>segundo</strong> armónico (2 kHz) respecto a la fundamental.',
        requisitos: [...rGen('sierra', 1000, { simetria: 100, textoF: '1 kHz' }), r((b) => b.fnirsi.mates === 'fft1', 'Mantenga la FFT de CH1.')],
        lectura: lFft('el 2.º armónico', comp(6, 'h2s'), 'h2s'),
        guia: { fn: { boton: 'menu' }, instrumento: 'fnirsi' },
        hazlo: { fn: { dds: { forma: 'sierra', simetria: 100 } } },
      },
    ],
  },
  // ------------------------------------------------------------------ 7
  {
    n: 7,
    inicial: { variante: 'p7', alimentado: true, parametros: { 'param:vcc': 9 }, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: OSC_INICIAL },
    pasos: [
      {
        id: 'frecuencia',
        titulo: 'La frecuencia',
        texto: 'CH1 en la salida del 555 (<strong>out</strong>), en DC, a <strong>20 ms/div</strong> (varios periodos en pantalla) y con PRM. Calculado: 13,9 Hz.',
        requisitos: [...rSonda(0, 'out', { acoplamiento: 'dc' }), rBase(20e-3, 50e-3, '20 ms/div'), rSinMates, rCorre, rPrm, rNoRecorta(0)],
        lectura: lPrm(0, 'f', 'la frecuencia', 'f'),
        guia: { fn: { boton: 'prm' }, instrumento: 'fnirsi' },
        hazlo: { sondas: { ch1: 'out', masa: '0' }, fn: { modo: 'osc', ch: [{ on: true, vDiv: 5, pos: 0, ac: false, x10: true }, null], sDiv: 20e-3, disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 4.5 }, prm: true } },
        errores: [{ nombre: 'base de tiempos demasiado rápida', hacer: { fn: { sDiv: 1e-3 } }, pista: '20 ms/div' }],
      },
      {
        id: 'ciclo',
        titulo: 'El ciclo de trabajo',
        texto: 'En la misma pantalla, PRM da también el <strong>ciclo de trabajo</strong>. Calculado: 39,5 ms de 72,1, un 55 %.',
        requisitos: [...rSonda(0, 'out'), rSinMates, rPrm, rNoRecorta(0)],
        lectura: lPrm(0, 'ciclo', 'el ciclo de trabajo', 'ciclo'),
        guia: { instrumento: 'fnirsi' },
        hazlo: { fn: { prm: true } },
      },
      {
        id: 'umbral-alto',
        titulo: 'El condensador entre umbrales',
        texto: 'CH2 en el condensador (<strong>thr</strong>), en DC: dos exponenciales entre 1/3 y 2/3 de V<sub>CC</sub>. Lea la <strong>Vmáx de CH2</strong>.',
        requisitos: [...rSonda(1, 'thr', { acoplamiento: 'dc' }), rSinMates, rPrm, rNoRecorta(1)],
        lectura: lPrm(1, 'vmax', 'la Vmáx de CH2', 'alto'),
        guia: { fn: { boton: 'ch2' }, instrumento: 'fnirsi' },
        hazlo: { sondas: { ch2: 'thr' }, fn: { ch: [null, { on: true, vDiv: 2, pos: -3, ac: false, x10: true }], prm: true } },
        errores: [{ nombre: 'CH2 en AC', hacer: { fn: { ch: [null, { ac: true }] } }, pista: 'DC' }],
      },
      {
        id: 'umbral-bajo',
        titulo: 'El umbral inferior',
        texto: 'Ahora la <strong>Vmín de CH2</strong>: el umbral de 1/3 de V<sub>CC</sub>.',
        requisitos: [...rSonda(1, 'thr', { acoplamiento: 'dc' }), rSinMates, rPrm, rNoRecorta(1)],
        lectura: lPrm(1, 'vmin', 'la Vmín de CH2', 'bajo'),
        guia: { instrumento: 'fnirsi' },
        hazlo: { fn: { prm: true } },
      },
      {
        id: 'brymen',
        titulo: 'La frecuencia en el Brymen',
        texto: 'Brymen en <strong>V∿</strong> entre la salida y masa: la pantalla secundaria muestra la frecuencia.',
        requisitos: [...rBrymenV('out', '0', 'vac'), r((b) => b.brymen.sub === 0, 'Vuelva con SELECT a la primera función de V∿ (tensión y, abajo, Hz).')],
        lectura: lBm('la frecuencia', 'Hz', 'fbm', brymenSecundaria),
        guia: { bm: { posicion: 'vac', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { bm: bmV('out', '0', 'vac') },
        errores: [{ nombre: 'en continua', hacer: { bm: { pos: 'vdc' } }, pista: 'V∿' }],
      },
      {
        id: 'vcc',
        titulo: 'La frecuencia no depende de V<sub>CC</sub>',
        texto: 'Baje la alimentación a <strong>5 V</strong> (deslizador vcc) y lea otra vez la frecuencia con PRM: los umbrales bajan en la misma proporción.',
        requisitos: [r((b) => leerParametro(b.texto, 'param:vcc') === 5, 'Lleve el deslizador <strong>vcc</strong> a 5 V.'), ...rSonda(0, 'out'), rSinMates, rPrm, rNoRecorta(0)],
        lectura: lPrm(0, 'f', 'la frecuencia', 'f5'),
        guia: { instrumento: 'fnirsi' },
        hazlo: { parametros: { 'param:vcc': 5 }, fn: { prm: true } },
      },
    ],
  },
  // ------------------------------------------------------------------ 8
  {
    n: 8,
    inicial: { variante: 'p8_0', alimentado: true, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: OSC_INICIAL },
    pasos: [
      {
        id: 'corte',
        titulo: 'Base a 0 V: corte',
        texto: 'Brymen en <strong>V⎓</strong> entre el colector (<strong>c</strong>) y masa. El LED está apagado; V<sub>CE</sub> es alta, pero no toda la alimentación.',
        requisitos: rBrymenV('c', '0'),
        lectura: lBm('V<sub>CE</sub>', 'V', 'corte'),
        guia: { bm: { posicion: 'vdc', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { bm: bmV('c', '0') },
      },
      {
        id: 'saturacion',
        titulo: 'Base a 5 V: saturación',
        texto: 'Ahora la base va a 5 V por R<sub>B</sub> y el LED se enciende. Lea V<sub>CE</sub>: cae a unos 0,2 V.',
        preparar: { variante: 'p8_5' },
        requisitos: rBrymenV('c', '0'),
        lectura: { ...lBm('V<sub>CE</sub>', 'V', 'sat'), tol: { rel: 0.005, abs: 0.002 } },
        guia: { bm: { posicion: 'vdc' }, instrumento: 'brymen' },
        hazlo: { bm: bmV('c', '0') },
      },
      {
        id: 'conmutacion',
        titulo: 'Conmutando con el generador',
        texto: 'La base, desde una <strong>cuadrada de 2 Hz y 3 V</strong>. CH1 en el colector, CH2 en el control (<strong>ctl</strong>), disparo en CH2, <strong>200 ms/div</strong>. Lea la frecuencia de CH1.',
        preparar: { variante: 'p8_gen' },
        requisitos: [...rGen('cuadrada', 2), ...rSonda(0, 'c', { acoplamiento: 'dc' }), ...rSonda(1, 'ctl', { acoplamiento: 'dc' }), ...rDisparo(1), rBase(200e-3, 500e-3, '200 ms/div'), rSinMates, rCorre, rPrm],
        lectura: lPrm(0, 'f', 'la frecuencia de CH1', 'f'),
        guia: { fn: { boton: 'trigger' }, instrumento: 'fnirsi' },
        hazlo: {
          sondas: { ch1: 'c', ch2: 'ctl', masa: '0' },
          fn: { modo: 'osc', ch: [{ on: true, vDiv: 1, pos: -2, ac: false, x10: true }, { on: true, vDiv: 2, pos: -3, ac: false, x10: true }], sDiv: 200e-3, disparo: { modo: 'auto', fuente: 1, subida: true, nivel: 1.5 }, dds: { forma: 'cuadrada', frecuencia: 2, amplitud: 3, ciclo: 50, salida: true }, prm: true },
        },
      },
    ],
  },
  // ------------------------------------------------------------------ 9
  {
    n: 9,
    inicial: { variante: 'p9', alimentado: true, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: sinGenerador({ forma: 'seno', frecuencia: 1000, amplitud: 3, salida: false }) },
    pasos: [
      {
        id: 'conexion',
        titulo: 'El montaje',
        texto: 'Senoide de <strong>3 V</strong>. CH1 en la salida del generador (<strong>in</strong>) y CH2 sobre la resistencia (<strong>n2</strong>): su tensión es proporcional a la corriente.',
        requisitos: [
          r((b) => b.fnirsi.dds.forma === 'seno', 'Elija la forma <strong>senoide</strong> en el generador.'),
          r((b) => Math.abs(b.fnirsi.dds.amplitud - 3) < 0.05 && b.fnirsi.dds.salida, 'Ponga 3 V de amplitud y active la salida del generador.'),
          ...rSonda(0, 'in', { acoplamiento: 'dc' }),
          ...rSonda(1, 'n2', { acoplamiento: 'dc' }),
          rPrm,
        ],
        guia: { fn: { boton: 'menu' }, instrumento: 'fnirsi' },
        hazlo: {
          sondas: { ch1: 'in', ch2: 'n2', masa: '0' },
          fn: { modo: 'osc', ch: [{ on: true, vDiv: 1, pos: -1.5, ac: false, x10: true }, { on: true, vDiv: 0.5, pos: 0, ac: false, x10: true }], sDiv: 100e-6, disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 1.5 }, dds: { forma: 'seno', amplitud: 3, salida: true }, prm: true },
        },
      },
      {
        id: 'resonancia',
        titulo: 'En la resonancia',
        texto: 'Predicción: f<sub>0</sub> = 1/(2π√(LC)) = <strong>5 033 Hz</strong>. Ponga el generador ahí y lea la Vpp de CH2: es el máximo de la curva.',
        requisitos: [
          r((b) => casi(b.fnirsi.dds.frecuencia, 5033, 0.01), 'Ponga el generador a la f<sub>0</sub> calculada, <strong>5 033 Hz</strong> (a menos del 1 %).'),
          ...rSonda(1, 'n2'),
          rPrm,
          rNoRecorta(1),
        ],
        lectura: lPrm(1, 'vpp', 'la Vpp en R', 'vr'),
        guia: { instrumento: 'fnirsi' },
        hazlo: { fn: { dds: { frecuencia: 5033 }, prm: true } },
      },
      {
        id: 'curva',
        titulo: 'La curva y su Q',
        texto: 'Anote puntos de 1 a 20 kHz, más densos cerca del máximo, hasta tener los dos lados por debajo del 70,7 %. Escriba <strong>Q = f<sub>0</sub>/(f<sub>2</sub> − f<sub>1</sub>)</strong>.',
        requisitos: [
          r((b) => b.anotaciones.length >= 5, 'Anote al menos cinco puntos con «Anotar punto» (frecuencia y Vpp en R), cambiando la frecuencia del generador.'),
          r((b) => comp(9, 'q')(b) !== null, 'Aún no hay puntos por debajo del 70,7 % del máximo a los dos lados: anote frecuencias más bajas y más altas.'),
        ],
        lectura: { que: 'Q', unidad: '', medir: comp(9, 'q'), tol: { rel: 0.12 }, porqueTol: 'f<sub>1</sub> y f<sub>2</sub> se interpolan a ojo entre los puntos de la tabla', libro: 'q' },
        tabla: true,
        guia: { instrumento: 'fnirsi' },
        hazlo: {},
      },
    ],
  },
  // ------------------------------------------------------------------ 10
  {
    n: 10,
    inicial: { variante: 'p10', alimentado: true, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: OSC_INICIAL },
    pasos: [
      {
        id: 'flanco',
        titulo: 'Un flanco en pantalla',
        texto: 'CH1 en la salida del 74AC04 (<strong>out</strong>), sonda en <strong>×10</strong>, <strong>10 ns/div</strong>, disparo en CH1 con flanco de subida y nivel a media altura.',
        requisitos: [
          ...rSonda(0, 'out', { acoplamiento: 'dc' }),
          rX10(0, true),
          rBase(10e-9, 10e-9, '10 ns/div'),
          ...rDisparo(0),
          r((b) => b.fnirsi.disparo.nivel > 0.5 && b.fnirsi.disparo.nivel < 4.5, 'Ponga el nivel de disparo entre 0,5 y 4,5 V (TRIGGER → Nivel), a media altura del flanco.'),
          rSinMates,
          rCorre,
          rNoRecorta(0),
        ],
        guia: { fn: { boton: 'trigger' }, instrumento: 'fnirsi' },
        hazlo: { sondas: { ch1: 'out', masa: '0' }, fn: { modo: 'osc', ch: [{ on: true, vDiv: 1, pos: -2.5, ac: false, x10: true }, null], sDiv: 10e-9, hpos: 0, disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 2.5 }, prm: false } },
      },
      {
        id: 'tr10',
        titulo: 'Del 10 % al 90 %',
        texto: 'Cursores de tiempo en el <strong>10 %</strong> y el <strong>90 %</strong> del salto. Δt es t<sub>r</sub>: la suma en cuadratura del flanco y del osciloscopio (BW = 0,35/t<sub>r</sub>).',
        requisitos: [
          ...rSonda(0, 'out'),
          rX10(0, true),
          rCursores('tiempo'),
          rSenal(0),
          rCursorEn('a', (b) => cruceP10(b, 0.1), 'al 10 % del salto'),
          rCursorEn('b', (b) => cruceP10(b, 0.9), 'al 90 % del salto'),
        ],
        lectura: lDeltaT('t<sub>r</sub>', 'tr10'),
        cursores: true,
        guia: { fn: { boton: 'select' }, instrumento: 'fnirsi' },
        hazlo: (b) => cursoresEn('tiempo', cruceP10(b, 0.1), cruceP10(b, 0.9)),
      },
      {
        id: 'tr1',
        titulo: 'Con la sonda en ×1',
        texto: 'Pase la sonda a <strong>×1</strong> (el conmutador y el menú del canal) y la base a <strong>50 ns/div</strong>. Mida otra vez del 10 al 90 %: la sonda limita a unos 6 MHz.',
        requisitos: [
          ...rSonda(0, 'out'),
          rX10(0, false),
          rBase(50e-9, 50e-9, '50 ns/div'),
          rCursores('tiempo'),
          rSenal(0),
          rCursorEn('a', (b) => cruceP10(b, 0.1), 'al 10 % del salto'),
          rCursorEn('b', (b) => cruceP10(b, 0.9), 'al 90 % del salto'),
        ],
        lectura: lDeltaT('t<sub>r</sub>', 'tr1'),
        cursores: true,
        guia: { fn: { boton: 'ch1' }, instrumento: 'fnirsi' },
        hazlo: (b) => (ch(b, 0).sondaX10 || b.fnirsi.sDiv !== 50e-9 ? { fn: { ch: [{ x10: false, vDiv: 1 }, null], sDiv: 50e-9, cursores: 'tiempo' } } : cursoresEn('tiempo', cruceP10(b, 0.1), cruceP10(b, 0.9))),
        errores: [{ nombre: 'solo el conmutador en ×1', hacer: (b) => void (ch(b, 0).menuX10 = true), pista: 'no coinciden' }],
      },
    ],
  },
  // ------------------------------------------------------------------ 11
  {
    n: 11,
    inicial: { variante: 'p11', alimentado: true, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: OSC_INICIAL },
    pasos: [
      {
        id: 'envolvente',
        titulo: 'La portadora y su envolvente',
        texto: 'CH1 en la señal AM (<strong>am</strong>), CH2 en la salida del demodulador (<strong>o1</strong>), en DC; <strong>200 µs/div</strong> y disparo en <strong>CH2</strong>, el tono, para que la envolvente quede quieta.',
        requisitos: [...rSonda(0, 'am', { acoplamiento: 'dc' }), ...rSonda(1, 'o1', { acoplamiento: 'dc' }), rBase(200e-6, 200e-6, '200 µs/div'), ...rDisparo(1), rSinMates, rCorre, rNoRecorta(0)],
        guia: { fn: { boton: 'trigger' }, instrumento: 'fnirsi' },
        hazlo: { sondas: { ch1: 'am', ch2: 'o1', masa: '0' }, fn: { modo: 'osc', ch: [{ on: true, vDiv: 1, pos: 0, ac: false, x10: true }, { on: true, vDiv: 1, pos: -3, ac: false, x10: true }], sDiv: 200e-6, disparo: { modo: 'auto', fuente: 1, subida: true, nivel: 1.4 }, prm: true } },
        errores: [{ nombre: 'disparo en la portadora', hacer: { fn: { disparo: { fuente: 0 } } }, pista: 'CH2' }],
      },
      {
        id: 'indice',
        titulo: 'El índice de modulación',
        texto: 'Con CH1 activo, cursores de <strong>tensión</strong>: A en el máximo de la envolvente y B en su mínimo (los picos más bajos). Escriba <strong>m = (A − B)/(A + B)</strong>.',
        requisitos: [
          ...rSonda(0, 'am'),
          r((b) => b.fnirsi.activo === 0, 'Los cursores de tensión leen el canal activo: active <strong>CH1</strong> (botón CH1).'),
          rCursores('tension'),
          r((b) => { const e = envP11(b); const c = cursoresV(b); return !!e && !!c && Math.abs(c[0] - e.max) <= 0.15 * ch(b, 0).vDiv; }, 'Lleve el cursor más alto al <strong>máximo de la envolvente</strong> (los picos más altos de la portadora).'),
          r((b) => { const e = envP11(b); const c = cursoresV(b); return !!e && !!c && Math.abs(c[1] - e.min) <= 0.15 * ch(b, 0).vDiv; }, 'Lleve el cursor más bajo al <strong>mínimo de la envolvente</strong>: los picos más bajos de la portadora, no el fondo de la señal.'),
        ],
        lectura: { que: 'm', unidad: '', medir: (b) => { const c = cursoresV(b); return c && c[0] + c[1] > 0 ? (c[0] - c[1]) / (c[0] + c[1]) : null; }, tol: { abs: 0.02 }, porqueTol: 'los cursores dan los voltios con tres cifras', libro: 'm' },
        cursores: true,
        guia: { fn: { boton: 'select' }, instrumento: 'fnirsi' },
        // (the voltage cursors read the active channel: CH1 is made active and its scale is the one converted with,
        // or a learner who had CH2 active would get cursors placed in CH2's volts per division)
        hazlo: (b) => { const e = envP11(b); return { fn: { activo: 0, cursores: 'tension', cur: { a: e ? Math.round(divTension(b, e.max, 0) * 25) / 25 : 2, b: e ? Math.round(divTension(b, e.min, 0) * 25) / 25 : -2 } } }; },
      },
      {
        id: 'bandas',
        titulo: 'Tres rayas en el espectro',
        texto: 'SELECT → Math → <strong>FFT CH1</strong>: la portadora en 100 kHz y las bandas laterales en 99 y 101 kHz. ¿Cuántos dB por debajo de la portadora están?',
        requisitos: [
          ...rSonda(0, 'am'),
          r((b) => b.fnirsi.mates === 'fft1', 'Active la FFT de CH1 (SELECT → Math → FFT CH1).'),
          r((b) => b.fnirsi.sDiv >= 200e-6 * 0.999, 'Con tan poco tiempo en pantalla la FFT no separa rayas a 1 kHz: vuelva a <strong>200 µs/div</strong> o más.'),
        ],
        lectura: lFft('las bandas laterales', comp(11, 'bandas'), 'bandas', 2.5),
        guia: { fn: { boton: 'select' }, instrumento: 'fnirsi' },
        hazlo: { fn: { mates: 'fft1', cursores: 'no', sDiv: 200e-6 } },
      },
      {
        id: 'tono',
        titulo: 'El tono recuperado',
        texto: 'Quite la FFT. El demodulador (diodo y RC de 100 µs) da en CH2 el tono de la moduladora: lea su frecuencia con PRM.',
        requisitos: [...rSonda(1, 'o1', { acoplamiento: 'dc' }), rSinMates, rPrm, rNoRecorta(1)],
        lectura: lPrm(1, 'f', 'la frecuencia de CH2', 'tono'),
        guia: { fn: { boton: 'prm' }, instrumento: 'fnirsi' },
        hazlo: { fn: { mates: 'no', cursores: 'no', prm: true } },
      },
    ],
  },
  // ------------------------------------------------------------------ 12
  {
    n: 12,
    inicial: { variante: 'p12', alimentado: true, bm: BM_APAGADO, sondas: { ch1: null, ch2: null, masa: '0' }, fn: sinGenerador({ forma: 'seno', frecuencia: 120, amplitud: 3, salida: false }) },
    pasos: [
      {
        id: 'capacimetro',
        titulo: 'El capacímetro',
        texto: '<strong>Quite la alimentación</strong>. Brymen en <strong>⊣⊢</strong>, roja en el condensador (<strong>c</strong>) y negra en masa. Lea la capacidad.',
        requisitos: [
          rAlimentado(false, 'cap'),
          r((b) => b.brymen.borne === 'V', 'La punta roja va al borne <strong>VΩ⊣⊢</strong>.'),
          r((b) => b.brymen.posicion.id === 'cap' && b.brymen.sub === 0, 'Gire el selector a <strong>⊣⊢</strong> (capacidad; SELECT la cambia por el diodo).'),
          r((b) => !b.bm.serie && b.bm.rojo === 'c' && b.bm.negro === '0', 'Roja en el condensador (<strong>c</strong>), negra en masa.'),
        ],
        lectura: lBm('la capacidad', 'F', 'c'),
        guia: { bm: { posicion: 'cap', borne: 'V' }, instrumento: 'brymen' },
        hazlo: { alimentado: false, bm: { pos: 'cap', sub: 0, borne: 'V', serie: null, rojo: 'c', negro: '0' } },
        errores: [{ nombre: 'con alimentación', hacer: { alimentado: true }, pista: 'alimentación' }],
      },
      {
        id: 'divisor',
        titulo: 'El método del divisor',
        texto: 'Alimente otra vez. Senoide de <strong>120 Hz y 3 V</strong>; CH1 en la entrada (<strong>in</strong>) y CH2 sobre el condensador (<strong>c</strong>), los dos en <strong>AC</strong>; CH2 a 0,1 V/div. Lea la <strong>Vef</strong> de CH2.',
        requisitos: [rAlimentado(true), ...rGen('seno', 120), ...rSonda(0, 'in', { acoplamiento: 'ac' }), ...rSonda(1, 'c', { acoplamiento: 'ac' }), r((b) => ch(b, 1).vDiv <= 0.1 * 1.001, 'La tensión del condensador es pequeña (unos 0,3 Vpp): baje CH2 a <strong>0,1 V/div</strong> para que ocupe varias divisiones.'), rSinMates, rPrm, rNoRecorta(0), rNoRecorta(1)],
        lectura: lPrm(1, 'vrms', 'la Vef sobre el condensador'),
        guia: { fn: { boton: 'ch2' }, instrumento: 'fnirsi' },
        hazlo: {
          alimentado: true,
          bm: BM_APAGADO,
          sondas: { ch1: 'in', ch2: 'c', masa: '0' },
          fn: { modo: 'osc', ch: [{ on: true, vDiv: 0.5, pos: 0, ac: true, x10: true }, { on: true, vDiv: 0.1, pos: 0, ac: true, x10: true }], sDiv: 2e-3, disparo: { modo: 'auto', fuente: 0, subida: true, nivel: 0 }, dds: { forma: 'seno', frecuencia: 120, amplitud: 3, salida: true }, prm: true },
        },
        errores: [{ nombre: 'CH2 en DC', hacer: { fn: { ch: [null, { ac: false }] } }, pista: 'AC' }],
      },
      {
        id: 'impedancia',
        titulo: 'La impedancia',
        texto: 'Con r = Vef(C)/Vef(entrada), <strong>|Z| = 100·r/√(1 − r²)</strong>. El valor eficaz promedia el ruido, que infla las medidas de pico. A 120 Hz domina 1/ωC: 13,3 Ω, que da 100 µF.',
        requisitos: [...rGen('seno', 120), ...rSonda(0, 'in', { acoplamiento: 'ac' }), ...rSonda(1, 'c', { acoplamiento: 'ac' }), rSinMates, rPrm, rNoRecorta(0), rNoRecorta(1)],
        lectura: { que: '|Z|', unidad: 'Ω', medir: zEficaz, tol: { rel: 0.04 }, porqueTol: 'sale de dos valores eficaces de 8 bits', libro: 'z' },
        guia: { instrumento: 'fnirsi' },
        hazlo: { fn: { prm: true } },
      },
    ],
  },
];

/** The lab of a practice number. */
export function laboratorioDe(n: number): Laboratorio | undefined {
  return LABORATORIOS.find((l) => l.n === n);
}
