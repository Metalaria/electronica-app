// The leads and probes of the instruments: names, colours and letters (shared by the bench's drawing, its
// chooser and, since 0.10, the breadboard). A light module: the breadboard imports it without the instruments.

/** A lead or probe that can be placed on a node. */
export type Punta = 'bmRojo' | 'bmNegro' | 'fnRojo' | 'fnNegro' | 'ch1' | 'ch2' | 'masa' | 'esc';

/** On the breadboard, also the FNIRSI generator's two leads (0.10). */
export type PuntaProto = Punta | 'genRojo' | 'genNegro';

export const NOMBRE_PUNTA: Record<Punta, string> = {
  bmRojo: 'Brymen · punta roja',
  bmNegro: 'Brymen · punta negra (COM)',
  fnRojo: 'FNIRSI multímetro · roja',
  fnNegro: 'FNIRSI multímetro · negra',
  ch1: 'Sonda CH1',
  ch2: 'Sonda CH2',
  masa: 'Pinza de masa (CH1 y CH2)',
  esc: 'Auricular (escuchar)',
};

export const NOMBRE_PUNTA_PROTO: Record<PuntaProto, string> = {
  ...NOMBRE_PUNTA,
  genRojo: 'Generador FNIRSI · salida',
  genNegro: 'Generador FNIRSI · masa',
};

/** In the order of the breadboard's chooser. */
export const PUNTAS_PROTO: PuntaProto[] = ['bmRojo', 'bmNegro', 'ch1', 'ch2', 'masa', 'genRojo', 'genNegro', 'esc', 'fnRojo', 'fnNegro'];

export const COLOR_PUNTA: Record<string, string> = {
  bmRojo: '#d62f37',
  bmNegro: '#222',
  fnRojo: '#f08a24',
  fnNegro: '#6b4a2a',
  ch1: '#d4b800',
  ch2: '#1aa6cf',
  masa: '#2e9a4a',
  esc: '#8e44c9',
  genRojo: '#e0457b',
  genNegro: '#4a4a58',
};

/** Relative luminance (WCAG) of a #rgb or #rrggbb colour. */
function luminancia(hex: string): number {
  const h = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

/**
 * Colour of the letter on each probe's disc: white where it reads (≥ 4.5:1), else near-black (0.11 QA: white on the
 * yellow, cyan, orange, green and pink discs was 2–4:1).
 */
export const TEXTO_PUNTA: Record<string, string> = Object.fromEntries(
  Object.entries(COLOR_PUNTA).map(([k, c]) => [k, 1.05 / (luminancia(c) + 0.05) >= 4.5 ? '#ffffff' : '#10161c']),
);

export const LETRA_PUNTA: Record<string, string> = {
  bmRojo: '+',
  bmNegro: '−',
  fnRojo: '+',
  fnNegro: '−',
  ch1: '1',
  ch2: '2',
  masa: '⏚',
  esc: '♪',
  genRojo: '∿',
  genNegro: '⏚',
};
