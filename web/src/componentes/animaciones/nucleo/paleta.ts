// Colours of the animations for each theme. Carriers and arrows keep the same meaning everywhere:
// electrons blue (filled), holes red (hollow), fixed ions as small squares, conventional current amber,
// electron flow blue dashed, electric field green (as in the book's figures), magnetic field violet.

import type { TemaEfectivo } from '../../../lib/color';

export interface Paleta {
  oscuro: boolean;
  fondo: string;
  fondo2: string;
  panel: string;
  tinta: string;
  suave: string;
  tenue: string;
  linea: string;
  rejilla: string;
  acento: string;
  /** Carriers and fixed charges. */
  electron: string;
  electronBorde: string;
  hueco: string;
  ionD: string;
  ionA: string;
  /** Arrows and fields. */
  corriente: string;
  flujo: string;
  campoE: string;
  campoB: string;
  calor: string;
  /** Plot series. */
  serie: [string, string, string, string, string];
  /** Materials. */
  cobre: string;
  cobreClaro: string;
  estano: string;
  ceramica: string;
  ceramicaSombra: string;
  carbon: string;
  peliculaMetal: string;
  laca: string;
  lacaAzul: string;
  epoxi: string;
  oxido: string;
  siP: string;
  siN: string;
  siPfuerte: string;
  siNfuerte: string;
  agotamiento: string;
  aluminio: string;
  polisilicio: string;
  plastico: string;
  ferrita: string;
  hierro: string;
  cuarzo: string;
  electrolito: string;
  /** States. */
  bien: string;
  aviso: string;
  peligro: string;
  positivo: string;
  negativo: string;
  hilo: string;
}

const CLARO: Paleta = {
  oscuro: false,
  fondo: '#fbfaf7',
  fondo2: '#f3f1ec',
  panel: '#ffffff',
  tinta: '#1f2933',
  suave: '#52606d',
  tenue: '#8a96a3',
  linea: '#c9c4b8',
  rejilla: '#e6e2d8',
  acento: '#2e6ea6',
  electron: '#2468d6',
  electronBorde: '#0f3f8f',
  hueco: '#d63a2f',
  ionD: '#3d5a80',
  ionA: '#9b3a3a',
  corriente: '#e08a00',
  flujo: '#2468d6',
  campoE: '#1f8a4c',
  campoB: '#7a4fd0',
  calor: '#e8590c',
  serie: ['#0f8b8d', '#d63a2f', '#1f8a4c', '#e08a00', '#7a4fd0'],
  cobre: '#b8733a',
  cobreClaro: '#e3a46c',
  estano: '#b9bec4',
  ceramica: '#efe8d8',
  ceramicaSombra: '#cfc4ad',
  carbon: '#3a3836',
  peliculaMetal: '#8d99a6',
  laca: '#d8c49a',
  lacaAzul: '#7fa8cc',
  epoxi: '#2b2d30',
  oxido: '#efe2a2',
  siP: '#f7dcdc',
  siN: '#d9e5f7',
  siPfuerte: '#eab0b0',
  siNfuerte: '#a9c3ec',
  agotamiento: '#f2f0ea',
  aluminio: '#a7b0ba',
  polisilicio: '#6d7b8c',
  plastico: '#3b4a5c',
  ferrita: '#4a4b50',
  hierro: '#7d838c',
  cuarzo: '#dfeef2',
  electrolito: '#c8b26a',
  bien: '#1f8a4c',
  aviso: '#c77700',
  peligro: '#c62828',
  positivo: '#c62828',
  negativo: '#1f2933',
  hilo: '#55606b',
};

const OSCURO: Paleta = {
  oscuro: true,
  fondo: '#1b1f25',
  fondo2: '#22272e',
  panel: '#20252c',
  tinta: '#e3e6ea',
  suave: '#a8b1bc',
  tenue: '#77818c',
  linea: '#46505c',
  rejilla: '#2d343d',
  acento: '#6fa8dc',
  electron: '#5b9bff',
  electronBorde: '#bcd6ff',
  hueco: '#ff6b5e',
  ionD: '#8fb0d9',
  ionA: '#e09a9a',
  corriente: '#ffb02e',
  flujo: '#5b9bff',
  campoE: '#4cc47f',
  campoB: '#a98bf0',
  calor: '#ff7a33',
  serie: ['#3cc6c8', '#ff6b5e', '#4cc47f', '#ffb02e', '#a98bf0'],
  cobre: '#c98a4f',
  cobreClaro: '#efb98a',
  estano: '#9aa1a9',
  ceramica: '#d9d2c2',
  ceramicaSombra: '#a59c88',
  carbon: '#141414',
  peliculaMetal: '#9aa6b3',
  laca: '#bfae86',
  lacaAzul: '#6c94b8',
  epoxi: '#121417',
  oxido: '#a39563',
  siP: '#4a2d31',
  siN: '#26364d',
  siPfuerte: '#6e3a40',
  siNfuerte: '#33507a',
  agotamiento: '#2b2e33',
  aluminio: '#8e98a3',
  polisilicio: '#7f8da0',
  plastico: '#3a4656',
  ferrita: '#3c3d42',
  hierro: '#6f7680',
  cuarzo: '#9fb9c1',
  electrolito: '#9c8a4e',
  bien: '#4cc47f',
  aviso: '#f0a43a',
  peligro: '#ff6b5e',
  positivo: '#ff6b5e',
  negativo: '#e3e6ea',
  hilo: '#9aa5b1',
};

const SEPIA: Paleta = {
  ...CLARO,
  fondo: '#f8f0df',
  fondo2: '#efe5cf',
  panel: '#fbf5e8',
  rejilla: '#e4d8bd',
  linea: '#cdbf9f',
  tinta: '#3b3024',
  suave: '#6b5d4c',
  agotamiento: '#f3ead6',
};

export function paleta(tema: TemaEfectivo): Paleta {
  return tema === 'oscuro' ? OSCURO : tema === 'sepia' ? SEPIA : CLARO;
}

// ------------------------------------------------------------------ colour utilities

type RGB = [number, number, number];

export function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hex([r, g, b]: RGB): string {
  const c = (x: number) =>
    Math.round(Math.min(255, Math.max(0, x)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mixes a towards b (t = 0 → a, 1 → b). */
export function mezcla(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  const k = Math.min(1, Math.max(0, t));
  return hex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
}

/** A colour with alpha. */
export function alfa(c: string, a: number): string {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, a)).toFixed(3)})`;
}

/** Visible colour of a wavelength in nm (approximation after Bruton); infrared and UV shown dim. */
export function colorLongitudOnda(nm: number): string {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 380) {
    r = 0.45;
    b = 0.75;
  } else if (nm < 440) {
    r = -(nm - 440) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = -(nm - 510) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = -(nm - 645) / 65;
  } else if (nm <= 780) {
    r = 1;
  } else {
    // Infrared: drawn as a deep dark red so that it is still visible.
    r = 0.55;
    g = 0.08;
    b = 0.12;
  }
  let f = 1;
  if (nm >= 380 && nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700 && nm <= 780) f = 0.3 + (0.7 * (780 - nm)) / 80;
  const k = (c: number) => 255 * Math.pow(c * f, 0.8);
  return hex([k(r), k(g), k(b)]);
}

/**
 * Colour of a hot body by its temperature in °C: ambient bodies keep `base`, from about 400 °C a dull red
 * glow appears and goes to orange and yellow-white (Draper point ≈ 525 °C).
 */
export function colorTemperatura(base: string, tc: number): string {
  if (tc < 60) return base;
  // Below incandescence the body darkens a little (scorching) and gets a warm tint.
  const tinte = mezcla(base, '#8a4b2a', Math.min(1, (tc - 60) / 400) * 0.55);
  if (tc < 420) return tinte;
  const paradas: [number, string][] = [
    [420, mezcla(tinte, '#3a0d05', 0.5)],
    [525, '#8f1c0a'],
    [650, '#d0300c'],
    [800, '#ff6a14'],
    [1000, '#ffb347'],
    [1300, '#fff1c9'],
  ];
  for (let i = 1; i < paradas.length; i++) {
    const [t1, c1] = paradas[i]!;
    const [t0, c0] = paradas[i - 1]!;
    if (tc <= t1) return mezcla(c0, c1, (tc - t0) / (t1 - t0));
  }
  return '#fff1c9';
}

/** Heat map for temperatures from cold blue to hot red, for plots and overlays. */
export function colorCalor(f: number): string {
  const p: [number, string][] = [
    [0, '#3b6fd6'],
    [0.35, '#35b3a6'],
    [0.6, '#f2c230'],
    [0.8, '#f07a1a'],
    [1, '#d4231c'],
  ];
  const x = Math.min(1, Math.max(0, f));
  for (let i = 1; i < p.length; i++) {
    const [a, ca] = p[i - 1]!;
    const [b, cb] = p[i]!;
    if (x <= b) return mezcla(ca, cb, (x - a) / (b - a));
  }
  return '#d4231c';
}
