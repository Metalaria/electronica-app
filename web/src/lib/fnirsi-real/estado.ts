// The real FNIRSI 2C53T: what its own firmware keeps in memory and the link's two measuring streams do not carry.
// A link with the status stream (protocolo.ts, event 0xB0) sends these blocks by itself; from one without it the
// connection reads them on request (order 0x02), each as it is at one instant, a few times a second. Nothing is
// written in the instrument.
//
// Addresses and layouts are those of FNIRSI's firmware V1.2.0, the only one the link exists for, found on a real
// unit on 2026-11-24 by reading its memory with one setting changed between two readings and a photograph of its
// screen next to each (github.com/Metalaria/fnirsi-2c53t-link, docs/stock_v120_notes.md):
//
//   signal generator, 10 bytes at 0x20000F50
//     [1]     waveform: its place in the instrument's menu, 0 to 12
//     [4…7]   frequency in Hz
//     [8]     duty cycle in %
//     [9]     amplitude in tenths of a volt
//     ([0] goes between 0 and 1 while the generator screen is operated; not understood, not used)
//
//   oscilloscope, FNIRSI's own measurements of CH1 as its screen shows them, 12 words at 0x20000208
//     [0] frequency in Hz, [1] period in ns, [2] and [3] positive and negative duty in 0.01 %, [4] and [5]
//     positive and negative pulse width in ns, [6] Vmax, [7] Vmin and [8] Vpp in µV, signed
//     Checked against two photographs of the stopped screen (40.23KHz 64.51% 114.0mV; 50.18KHz 50.50% 220.0mV).
//     While the oscilloscope runs they are a running average; stopped, those of the frozen acquisition. All zeros
//     outside the oscilloscope. CH2's follow CH1's but were only seen with the channel off: not read here.
//
//   oscilloscope state, 56 bytes at 0x200000F8 (the same block that heads every record): [46] is 1 while it
//     runs and 0 once stopped (RUN/STOP). A stopped oscilloscope sends no records, so this is the only way to tell
//     it from one that sends nothing for another reason.

export const DIR_GENERADOR = 0x20000f50;
export const LARGO_GENERADOR = 10;
export const DIR_ESTADO_OSCILOSCOPIO = 0x200000f8;
export const LARGO_ESTADO_OSCILOSCOPIO = 56;
export const DIR_MEDIDAS_CH1 = 0x20000208;
export const LARGO_MEDIDAS = 48;

/**
 * The waveforms whose place in the menu is established, with the instrument's own label. 1 to 12 were read on
 * the unit one by one on 2026-11-25: each entry selected on the generator's screen, its label typed as the screen
 * showed it and the index read from the instrument's memory. The Spanish names of 7 to 12 are a reading of those
 * labels ("Index" being the instrument's word for an exponential); their shapes were not looked at on the
 * oscilloscope. The labels are spelled as the firmware's own table of names has them (thirteen per language, in
 * this order). Index 0, one step before Square Wave in the menu, is the first of that table, «Sine Wave»; the
 * firmware builds it from a table of samples that is a sine.
 */
const FORMAS: Record<number, { nombre: string; rotulo: string }> = {
  0: { nombre: 'Senoidal', rotulo: 'Sine Wave' },
  1: { nombre: 'Cuadrada', rotulo: 'Square Wave' },
  2: { nombre: 'Diente de sierra', rotulo: 'Sawtooth wave' },
  3: { nombre: 'Media onda', rotulo: 'Half-wave' },
  4: { nombre: 'Onda completa', rotulo: 'Full Wave' },
  5: { nombre: 'Escalera', rotulo: 'Step Wave' },
  6: { nombre: 'Escalera inversa', rotulo: 'Reverse Step Wave' },
  7: { nombre: 'Exponencial creciente', rotulo: 'Index Up' },
  8: { nombre: 'Exponencial decreciente', rotulo: 'Index Decrease' },
  9: { nombre: 'Continua', rotulo: 'Direct current' },
  10: { nombre: 'Multitono', rotulo: 'Multi-audio' },
  11: { nombre: 'Pulso sinc', rotulo: 'Sink Pulse' },
  12: { nombre: 'Lorentziana', rotulo: 'Lorentz waves' },
};
/**
 * The last index that can be a waveform: the firmware's own list ends at 12, and a link from patch 5 on may add up
 * to eight entries after it (github.com/Metalaria/fnirsi-2c53t-link, `--menu-wave`). Those have no name here: the
 * card gives their place in the menu.
 * 2.1.1 (owner, 26-11): the link's identification has base English labels for them, and whoever builds the image
 * may give each one a name of its own per language on the instrument's screen, so a label would not match what the
 * screen shows. The app names them by their place only, never reads the instrument's table of names (the
 * identification's bytes 48 to 51 point there and are not read), and says which one plays what is sent from here
 * (the identification's `entradaUsb`).
 */
const PRIMERA_ANADIDA = 13;
const ULTIMA_FORMA = 12 + 8;

/**
 * A waveform of the instrument's menu as the card names it: «Cuadrada (Square Wave)»; an entry the link added, by
 * its place: «la entrada n.º 14 de su menú, añadida por el enlace». `entradaUsb`: the index of the added entry that
 * plays the waveform sent from here (0: none).
 */
export function nombreForma(forma: number, entradaUsb = 0): string {
  const f = FORMAS[forma];
  if (f) return `${f.nombre} (${f.rotulo})`;
  if (forma >= PRIMERA_ANADIDA && forma <= ULTIMA_FORMA)
    return `la entrada n.º ${forma + 1} de su menú, añadida por el enlace${forma === entradaUsb ? ' (la que reproduce la onda que se le envía)' : ''}`;
  return `la forma n.º ${forma + 1} de su menú`;
}

export interface AjustesGenerador {
  /** Place of the waveform in the instrument's menu (0 to 12; 13 to 20 for the entries a link added). */
  forma: number;
  /** Its name in Spanish and the instrument's own label (null for an index the table of names does not hold: 13 to 20). */
  nombre: string | null;
  rotulo: string | null;
  /** Hz. */
  frecuencia: number;
  /** Duty cycle, %. */
  ciclo: number;
  /** Amplitude as the instrument's screen gives it, V. */
  amplitud: number;
}

/** The generator's settings from its ten bytes; null when they cannot be settings (another firmware, a bad read). */
export function decodificarGenerador(b: ArrayLike<number>): AjustesGenerador | null {
  if (b.length < LARGO_GENERADOR) return null;
  const forma = b[1] ?? 0xff;
  const ciclo = b[8] ?? 0xff;
  const frecuencia = ((b[4] ?? 0) | ((b[5] ?? 0) << 8) | ((b[6] ?? 0) << 16) | ((b[7] ?? 0) << 24)) >>> 0;
  if (forma > ULTIMA_FORMA || ciclo > 100 || frecuencia === 0) return null;
  const f = FORMAS[forma];
  return { forma, nombre: f?.nombre ?? null, rotulo: f?.rotulo ?? null, frecuencia, ciclo, amplitud: (b[9] ?? 0) / 10 };
}

export interface MedidasOsciloscopio {
  /** Hz. */
  frecuencia: number;
  /** s. */
  periodo: number;
  /** Positive duty cycle, %. */
  ciclo: number;
  /** Positive and negative pulse widths, s. */
  anchoPositivo: number;
  anchoNegativo: number;
  /** V, as the instrument's screen gives them. */
  vmax: number;
  vmin: number;
  vpp: number;
}

/** FNIRSI's own measurements of a channel from its twelve words; null when it has none (all zeros). */
export function decodificarMedidas(b: ArrayLike<number>): MedidasOsciloscopio | null {
  if (b.length < LARGO_MEDIDAS) return null;
  const v = new DataView(Uint8Array.from({ length: LARGO_MEDIDAS }, (_, k) => b[k] ?? 0).buffer);
  const u = (i: number) => v.getUint32(4 * i, true);
  const s = (i: number) => v.getInt32(4 * i, true);
  if (Array.from({ length: 12 }, (_, i) => u(i)).every((x) => x === 0)) return null;
  return {
    frecuencia: u(0),
    periodo: u(1) * 1e-9,
    ciclo: u(2) / 100,
    anchoPositivo: u(4) * 1e-9,
    anchoNegativo: u(5) * 1e-9,
    vmax: s(6) * 1e-6,
    vmin: s(7) * 1e-6,
    vpp: s(8) * 1e-6,
  };
}

/** Whether the oscilloscope runs, from its 56 state bytes: true RUN, false STOP, null when the byte is neither. */
export function osciloscopioEnMarcha(estado: ArrayLike<number>): boolean | null {
  const x = estado[46];
  return x === 1 ? true : x === 0 ? false : null;
}
