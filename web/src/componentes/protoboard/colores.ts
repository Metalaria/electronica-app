// Colours of the physical parts: the resistor colour code, jumper wire insulation, LED colours.

export const COLOR_CODIGO = ['#141414', '#7b4a1e', '#d0281e', '#ef7d12', '#f2cf1d', '#2f9a3e', '#2563c9', '#8243c2', '#8e9196', '#f5f5f5'];
export const ORO = '#c8a23c';
export const PLATA = '#c4c7cb';
export const NOMBRES_COLOR = ['negro', 'marrón', 'rojo', 'naranja', 'amarillo', 'verde', 'azul', 'violeta', 'gris', 'blanco'];

/** Bands of a resistor (4 bands for two significant digits, 5 for three), or null for odd values. */
export function bandas(ohmios: number): { colores: string[]; nombres: string[]; precision: boolean } | null {
  if (!(ohmios > 0) || !Number.isFinite(ohmios)) return null;
  for (const cifras of [2, 3]) {
    const e = Math.floor(Math.log10(ohmios)) - (cifras - 1);
    const m = Math.round(ohmios / 10 ** e);
    if (Math.abs(m * 10 ** e - ohmios) / ohmios > 1e-6) continue;
    if (e < -2 || e > 9) return null;
    const dig = String(m).padStart(cifras, '0').split('').map(Number);
    const mult = e === -1 ? ORO : e === -2 ? PLATA : COLOR_CODIGO[e]!;
    const nMult = e === -1 ? 'oro' : e === -2 ? 'plata' : NOMBRES_COLOR[e]!;
    const tol = cifras === 2 ? ORO : COLOR_CODIGO[1]!;
    return {
      colores: [...dig.map((d) => COLOR_CODIGO[d]!), mult, tol],
      nombres: [...dig.map((d) => NOMBRES_COLOR[d]!), nMult, cifras === 2 ? 'oro (±5 %)' : 'marrón (±1 %)'],
      precision: cifras === 3,
    };
  }
  return null;
}

/** Jumper wire colours (insulation). */
export const CABLE = {
  rojo: '#d63a2f',
  negro: '#2b2b2b',
  azul: '#2f63c7',
  amarillo: '#e8c11c',
  verde: '#2f9e4f',
  naranja: '#ee7b1f',
  blanco: '#ececec',
  violeta: '#8150c4',
  marron: '#8a5329',
  gris: '#8d939a',
} as const;

export const CICLO_SENAL = [CABLE.amarillo, CABLE.verde, CABLE.naranja, CABLE.blanco, CABLE.violeta, CABLE.marron, CABLE.gris];

/** LED colour by model name. */
export function colorLed(modelo: string): { cuerpo: string; luz: string } {
  const m = modelo.toLowerCase();
  if (/(^|[^a-z])(ledv|verde|green|grn)|ledv/.test(m)) return { cuerpo: '#4fbf5a', luz: '#7dff8a' };
  if (/azul|blue|ledb|ledaz/.test(m)) return { cuerpo: '#3f7fe0', luz: '#8fc0ff' };
  if (/amar|yel|leda/.test(m)) return { cuerpo: '#f2c230', luz: '#ffe680' };
  if (/ir/.test(m)) return { cuerpo: '#5b4c6e', luz: '#b49bd6' };
  if (/blan|white|ledw/.test(m)) return { cuerpo: '#e6e6e6', luz: '#ffffff' };
  return { cuerpo: '#e0362c', luz: '#ff6b5c' };
}
