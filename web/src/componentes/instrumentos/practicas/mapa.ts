// The book sections of the twelve practices of printed chapter 21 (cap22) and their numbers: static and tiny, for the
// links from the reader (VerPractica.svelte), the instruments' page and the course path (1.1) without loading the
// practices themselves.

export const PRACTICA_DE_SECCION: Readonly<Record<string, number>> = {
  'sec-22.1': 1,
  'sec-22.2': 2,
  'sec-22.3': 3,
  'sec-22.4': 4,
  'sec-22.5': 5,
  'sec-22.6': 6,
  'sec-22.7': 7,
  'sec-22.8': 8,
  'sec-22.9': 9,
  'sec-22.11': 10,
  'sec-22.12': 11,
  'sec-22.13': 12,
};

/** Steps of each guided lab (laboratorios.ts; a unit test keeps them equal), for progress shown outside the bench. */
export const PASOS_LAB: Readonly<Record<number, number>> = { 1: 6, 2: 4, 3: 6, 4: 4, 5: 4, 6: 4, 7: 6, 8: 3, 9: 3, 10: 3, 11: 4, 12: 3 };
