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
