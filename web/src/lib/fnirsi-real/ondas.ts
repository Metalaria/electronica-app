// One period of a waveform for the FNIRSI 2C53T's own signal generator, sent through «stock-link» (patch 4 on).
//
// FNIRSI's firmware plays a table of 100 samples, over and over, at the frequency set on the instrument. Patch 4 of
// the link adds one order, 0x04, that stores samples in that table and in nothing else: the request names a
// position in the table (0 to 99), never an address, and carries at most 28 samples of 16 bits, each from 0 to
// 4094. The link scales them as the firmware scales its own sine, with the amplitude set on the instrument:
//     stored = floor(sample * amplitude / 33) + 20        (amplitude in tenths of a volt, at most 30)
// and answers with the amplitude it used and the waveform the instrument will go back to. The table can be read
// back at 0x20000F5A with the read order, which is how a send is checked here.
//
// The waveform lasts until the instrument rebuilds its table: at power-on and when its waveform, its duty or its
// amplitude is changed. A change of frequency keeps it. Checked on the real unit on 2026-11-25 (written, read
// back, seen on its oscilloscope, kept from 1 kHz to 2 kHz).
//
// This is the only thing the link writes in the instrument. The format is the one documented by
// github.com/Metalaria/fnirsi-2c53t-link (README, «Protocol»; docs/formats.md, «The generator's table»).

export const PUNTOS_ONDA = 100;
/** Full scale of a sample sent to the link. */
export const FONDO_ONDA = 4094;
/** Samples one request carries. */
export const MUESTRAS_POR_PETICION = 28;
/** Where the table is in the instrument's memory (read back with the read order). */
export const DIR_TABLA_ONDA = 0x20000f5a;
/** Most the instrument's amplitude setting goes to, in tenths of a volt. */
export const AMPLITUD_MAXIMA = 30;

export type FormaOnda =
  | 'senoidal' | 'triangular' | 'rampa' | 'rampa-descendente' | 'pulso' | 'sinc' | 'gaussiana' | 'caida-exponencial'
  | 'subida-exponencial' | 'media-onda' | 'onda-completa' | 'escalera' | 'rafaga' | 'am' | 'armonicos';

export interface DescripcionForma {
  id: FormaOnda;
  nombre: string;
  /** `ciclo` matters: the high part of the pulse, the rising part of the triangle. */
  conCiclo?: boolean;
  conArmonicos?: boolean;
}

export const FORMAS_ONDA: DescripcionForma[] = [
  { id: 'senoidal', nombre: 'Senoidal' },
  { id: 'triangular', nombre: 'Triangular', conCiclo: true },
  { id: 'rampa', nombre: 'Rampa ascendente' },
  { id: 'rampa-descendente', nombre: 'Rampa descendente' },
  { id: 'pulso', nombre: 'Pulso', conCiclo: true },
  { id: 'sinc', nombre: 'Sinc' },
  { id: 'gaussiana', nombre: 'Campana de Gauss' },
  { id: 'caida-exponencial', nombre: 'Caída exponencial' },
  { id: 'subida-exponencial', nombre: 'Subida exponencial' },
  { id: 'media-onda', nombre: 'Senoidal rectificada en media onda' },
  { id: 'onda-completa', nombre: 'Senoidal rectificada en onda completa' },
  { id: 'escalera', nombre: 'Escalera de ocho peldaños' },
  { id: 'rafaga', nombre: 'Ráfaga de diez ciclos' },
  { id: 'am', nombre: 'Portadora modulada en amplitud' },
  { id: 'armonicos', nombre: 'Suma de armónicos', conArmonicos: true },
];

export interface Armonico {
  orden: number;
  nivel: number;
  /** Degrees. */
  fase: number;
}

/** Highest harmonic 100 points can hold with four points a cycle. */
export const ARMONICO_MAXIMO = PUNTOS_ONDA / 4;

/** Any 100 numbers as samples: the lowest becomes 0 and the highest 4094; a flat list stays at mid scale. */
export function normalizar(valores: ArrayLike<number>): number[] {
  const v = Array.from(valores, Number);
  if (v.length !== PUNTOS_ONDA) throw new Error(`Una onda son ${PUNTOS_ONDA} puntos y hay ${v.length}.`);
  if (v.some((x) => !Number.isFinite(x))) throw new Error('La onda tiene valores que no son números.');
  const minimo = Math.min(...v);
  const maximo = Math.max(...v);
  if (maximo === minimo) return v.map(() => Math.floor(FONDO_ONDA / 2));
  return v.map((x) => Math.round(((x - minimo) / (maximo - minimo)) * FONDO_ONDA));
}

/** One period given with any number of points (two at least) as 100, interpolating around the period. */
export function remuestrear(valores: ArrayLike<number>, puntos = PUNTOS_ONDA): number[] {
  const v = Array.from(valores, Number);
  const n = v.length;
  if (n < 2) throw new Error('Una onda necesita al menos dos puntos.');
  if (n === puntos) return v;
  return Array.from({ length: puntos }, (_, i) => {
    const x = (i * n) / puntos;
    const k = Math.floor(x);
    const a = v[k % n]!;
    return a + (v[(k + 1) % n]! - a) * (x - k);
  });
}

/**
 * The numbers of a text file with one period: one per line, or separated by semicolons, spaces or tabs. «#» starts
 * a comment and a line that begins with a letter (a column title) is skipped. A comma inside a number is the
 * decimal comma; a piece with several commas is a list separated by commas.
 */
export function leerNumeros(texto: string): number[] {
  const v: number[] = [];
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.split('#', 1)[0]!.trim();
    if (!linea || /^[A-Za-zÁÉÍÓÚÑáéíóúñ_"]/.test(linea)) continue;
    for (const trozo of linea.split(/[;\s]+/)) {
      if (!trozo) continue;
      const partes = (trozo.match(/,/g) ?? []).length > 1 ? trozo.split(',') : [trozo.replace(',', '.')];
      for (const p of partes) {
        if (!p) continue;
        const x = Number(p);
        if (!Number.isFinite(x)) throw new Error(`En el fichero hay algo que no es un número: «${p}».`);
        v.push(x);
      }
    }
  }
  return v;
}

/** «1:1; 3:0,33; 5:0,2» or «1:1:0; 2:0,5:90»: order, level and, optionally, phase in degrees. */
export function leerArmonicos(texto: string): Armonico[] {
  const v: Armonico[] = [];
  for (const cruda of texto.split(/[;\n]+/)) {
    const pieza = cruda.trim();
    if (!pieza) continue;
    const p = pieza.split(':').map((x) => x.trim().replace(',', '.'));
    const orden = Number(p[0]);
    const nivel = Number(p[1]);
    const fase = p.length > 2 ? Number(p[2]) : 0;
    if (p.length < 2 || p.length > 3 || p.some((x) => x === '') || !Number.isFinite(nivel) || !Number.isFinite(fase))
      throw new Error(`Un armónico se escribe «orden:nivel» o «orden:nivel:fase», y hay «${pieza}».`);
    if (!Number.isInteger(orden) || orden < 1 || orden > ARMONICO_MAXIMO)
      throw new Error(`El orden de un armónico va de 1 a ${ARMONICO_MAXIMO} (con ${PUNTOS_ONDA} puntos no caben más), y hay «${p[0]}».`);
    v.push({ orden, nivel, fase });
  }
  if (!v.length) throw new Error('Escriba al menos un armónico, por ejemplo «1:1; 3:0,33; 5:0,2».');
  return v;
}

/** One period of a named shape as 100 samples. `ciclo` in percent (held between 1 and 99). */
export function formaOnda(id: FormaOnda, ciclo = 50, armonicos: Armonico[] = []): number[] {
  const d = Math.min(Math.max(Number.isFinite(ciclo) ? ciclo : 50, 1), 99) / 100;
  const dosPi = 2 * Math.PI;
  const f = (x: number): number => {
    switch (id) {
      case 'senoidal': return Math.sin(dosPi * x);
      case 'triangular': return x < d ? x / d : (1 - x) / (1 - d);
      case 'rampa': return x;
      case 'rampa-descendente': return 1 - x;
      case 'pulso': return x < d ? 1 : 0;
      case 'sinc': { const u = 12 * Math.PI * (x - 0.5); return u === 0 ? 1 : Math.sin(u) / u; }
      case 'gaussiana': return Math.exp(-(((x - 0.5) / 0.12) ** 2));
      case 'caida-exponencial': return Math.exp(-5 * x);
      case 'subida-exponencial': return 1 - Math.exp(-5 * x);
      case 'media-onda': return Math.max(0, Math.sin(dosPi * x));
      case 'onda-completa': return Math.abs(Math.sin(dosPi * x));
      case 'escalera': return Math.floor(x * 8) / 7;
      case 'rafaga': return x < 0.5 ? Math.sin(dosPi * 10 * x) : 0;
      case 'am': return (1 + 0.8 * Math.sin(dosPi * x)) * Math.sin(dosPi * 10 * x);
      case 'armonicos': return armonicos.reduce((s, a) => s + a.nivel * Math.sin(dosPi * a.orden * x + (a.fase * Math.PI) / 180), 0);
    }
  };
  if (id === 'armonicos' && !armonicos.length) throw new Error('Escriba al menos un armónico, por ejemplo «1:1; 3:0,33; 5:0,2».');
  return normalizar(Array.from({ length: PUNTOS_ONDA }, (_, i) => f(i / PUNTOS_ONDA)));
}

/** The same samples upside down. */
export function invertir(muestras: ArrayLike<number>): number[] {
  return Array.from(muestras, (x) => FONDO_ONDA - x);
}

/** What the instrument stores for these samples at an amplitude in tenths of a volt (the link's own scaling). */
export function guardadas(muestras: ArrayLike<number>, amplitud: number): number[] {
  const a = Math.min(amplitud, AMPLITUD_MAXIMA);
  return Array.from(muestras, (x) => Math.floor((Math.min(x, FONDO_ONDA) * a) / 33) + 20);
}

/** Whether `muestras` can be sent as they are: 100 whole numbers from 0 to 4094. */
export function muestrasValidas(muestras: ArrayLike<number>): boolean {
  return muestras.length === PUNTOS_ONDA && Array.from(muestras).every((x) => Number.isInteger(x) && x >= 0 && x <= FONDO_ONDA);
}
