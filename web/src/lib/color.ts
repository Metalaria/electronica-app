// Chapter accent colours, adapted to each theme with enough contrast for text.

export type TemaEfectivo = 'claro' | 'sepia' | 'oscuro';

const NAVY = '1A3A5C';

/** The book's «bright» variant of each block colour (used for accents in the text). */
const BRILLANTE: Record<string, string> = {
  '1A3A5C': '2E6EA6',
  '1F6F5C': '1F6F5C',
  '6B3FA0': '6B3FA0',
  A6552B: 'A6552B',
  '2E6EA6': '2E6EA6',
  '8A1F3D': '8A1F3D',
};

/** Page background of each theme (must match app.css). */
export const FONDO: Record<TemaEfectivo, string> = {
  claro: 'FCFBF8',
  sepia: 'F5ECD9',
  oscuro: '16191D',
};

type RGB = [number, number, number];

function aRGB(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('');
}

/** Mixes a towards b by t (0 → a, 1 → b). */
function mezclar(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function luminancia([r, g, b]: RGB): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contraste(a: RGB, b: RGB): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function normalizarColor(c: string | null | undefined): string {
  const h = (c ?? NAVY).replace('#', '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(h) ? h : NAVY;
}

export interface Acentos {
  '--banda': string;
  '--acento': string;
  '--acento-tinte': string;
  '--acento-suave': string;
  '--acento-borde': string;
}

/** CSS variables of a chapter colour for a theme. */
export function acentos(color: string | null | undefined, tema: TemaEfectivo): Acentos {
  const base = normalizarColor(color);
  const banda = aRGB(base);
  const fondo = aRGB(FONDO[tema]);
  let acento = aRGB(BRILLANTE[base] ?? base);
  if (tema === 'oscuro') {
    // Lighten until it reads well on the dark page.
    const blanco: RGB = [255, 255, 255];
    let t = 0.25;
    let c = mezclar(acento, blanco, t);
    while (contraste(c, fondo) < 5 && t < 0.9) {
      t += 0.05;
      c = mezclar(acento, blanco, t);
    }
    acento = c;
  } else {
    while (contraste(acento, fondo) < 4.6) acento = mezclar(acento, [0, 0, 0], 0.08);
  }
  const oscuro = tema === 'oscuro';
  return {
    '--banda': aHex(oscuro ? mezclar(banda, fondo, 0.15) : banda),
    '--acento': aHex(acento),
    '--acento-tinte': aHex(mezclar(acento, fondo, oscuro ? 0.88 : 0.93)),
    '--acento-suave': aHex(mezclar(acento, fondo, oscuro ? 0.78 : 0.85)),
    '--acento-borde': aHex(mezclar(acento, fondo, oscuro ? 0.55 : 0.6)),
  };
}

export function colorBloque(color: string | null | undefined): string {
  return '#' + normalizarColor(color);
}

/** Surface of the cards of each theme (must match --superficie in app.css). */
const SUPERFICIE: Record<TemaEfectivo, string> = { claro: 'FFFFFF', sepia: 'FAF3E4', oscuro: '1F2329' };

/** A block colour as the 0.9 facelift paints it (componentes/ui09, the start page's path). */
export interface TonoBloque {
  /** Solid fills: done nodes, the primary button, the segments done. */
  relleno: string;
  /** Text and icons on `relleno` (≥ 4.5:1). */
  sobre: string;
  /** Pale background of the current node and of chips. */
  tinte: string;
  /** The colour as text on the page and on cards (≥ 4.5:1 on both). */
  texto: string;
}

/**
 * Light and sepia: the block colour itself with white on it; dark: a light version of its bright variant
 * (≥ 7:1 on the page) with near-black on it, as in the 0.9 mockups.
 */
export function tonoBloque(color: string | null | undefined, tema: TemaEfectivo): TonoBloque {
  const base = normalizarColor(color);
  const fondo = aRGB(FONDO[tema]);
  const sup = aRGB(SUPERFICIE[tema]);
  if (tema === 'oscuro') {
    const blanco: RGB = [255, 255, 255];
    const brillante = aRGB(BRILLANTE[base] ?? base);
    let t = 0.3;
    let c = mezclar(brillante, blanco, t);
    while (Math.min(contraste(c, fondo), contraste(c, sup)) < 7 && t < 0.92) {
      t += 0.04;
      c = mezclar(brillante, blanco, t);
    }
    return { relleno: aHex(c), sobre: '#10161d', tinte: aHex(mezclar(c, sup, 0.84)), texto: aHex(c) };
  }
  let c = aRGB(base);
  while (Math.min(contraste(c, fondo), contraste(c, sup)) < 4.6) c = mezclar(c, [0, 0, 0], 0.06);
  return { relleno: aHex(c), sobre: '#ffffff', tinte: aHex(mezclar(c, sup, tema === 'sepia' ? 0.88 : 0.9)), texto: aHex(c) };
}
