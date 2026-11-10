// 1.1 visual style: every foreground/background pair of design tokens (src/estilos/tokens11.css) that the lesson
// screens use, with the WCAG 2.2 AA minimum it must meet in each theme: «texto» 4.5:1 (1.4.3), «grafico» 3:1 (1.4.11:
// strokes of the circuit, slider tracks, borders that are a control's only boundary, focus rings). Pure (no DOM): the
// unit tests read the CSS file, resolve each theme and check every pair. A component that starts using a new pair adds
// it here first.

export type Uso = 'texto' | 'grafico';
export type Tema = 'claro' | 'sepia' | 'oscuro';

/** [foreground token, background token, use] (names without the «--v11-» prefix). */
export const PARES: readonly (readonly [string, string, Uso])[] = [
  // ink on the surfaces
  ['tinta', 'fondo', 'texto'],
  ['tinta', 'panel', 'texto'],
  ['tinta', 'azul-tinte', 'texto'],
  ['tinta', 'bien-tinte', 'texto'],
  ['tinta', 'mal-tinte', 'texto'],
  ['tinta-suave', 'fondo', 'texto'],
  ['tinta-suave', 'panel', 'texto'],
  // coloured labels and readings
  ['azul', 'fondo', 'texto'],
  ['azul', 'panel', 'texto'],
  ['azul', 'azul-tinte', 'texto'],
  ['naranja-texto', 'fondo', 'texto'],
  ['naranja-texto', 'panel', 'texto'],
  ['verde', 'fondo', 'texto'],
  ['verde', 'panel', 'texto'],
  // buttons
  ['sobre-azul', 'azul', 'texto'],
  ['sobre-azul', 'azul-hover', 'texto'],
  ['sobre-inactivo', 'inactivo', 'texto'],
  // feedback banners and chips
  ['bien-texto', 'bien-tinte', 'texto'],
  ['mal-texto', 'mal-tinte', 'texto'],
  // graphics: circuit strokes, slider thumbs and tracks, bars, the current
  ['tinta', 'panel', 'grafico'],
  ['azul', 'panel', 'grafico'],
  ['naranja', 'panel', 'grafico'],
  ['verde', 'panel', 'grafico'],
  ['azul', 'fondo', 'grafico'],
  ['naranja', 'fondo', 'grafico'],
  // boundaries of controls (options, chips, drag targets) and focus rings
  ['borde', 'fondo', 'grafico'],
  ['borde', 'panel', 'grafico'],
  ['azul', 'azul-tinte', 'grafico'],
  ['bien', 'fondo', 'grafico'],
  ['bien', 'bien-tinte', 'grafico'],
  ['mal', 'fondo', 'grafico'],
  ['mal', 'mal-tinte', 'grafico'],
  ['foco', 'fondo', 'grafico'],
  ['foco', 'panel', 'grafico'],
  // progress segments that carry state (the «to do» ones are decorative: the bar has a text alternative)
  ['hecho', 'fondo', 'grafico'],
  ['actual', 'fondo', 'grafico'],
];

export const MINIMO: Record<Uso, number> = { texto: 4.5, grafico: 3 };

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of «#rrggbb» (WCAG 2.x). */
export function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Color no válido: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/** Contrast ratio of two «#rrggbb» colours (1…21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/**
 * The --v11-* colour tokens of each theme from the text of tokens11.css: the light theme is `:root`, sepia and dark
 * redefine some of them (the rest are inherited from `:root`).
 */
export function tokensPorTema(css: string): Record<Tema, Record<string, string>> {
  const bloque = (sel: RegExp): Record<string, string> => {
    const m = sel.exec(css);
    const out: Record<string, string> = {};
    if (!m) return out;
    for (const d of m[1]!.matchAll(/--v11-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[d[1]!] = d[2]!.toLowerCase();
    return out;
  };
  const claro = bloque(/:root\s*\{([^}]*)\}/);
  return {
    claro,
    sepia: { ...claro, ...bloque(/:root\[data-tema='sepia'\]\s*\{([^}]*)\}/) },
    oscuro: { ...claro, ...bloque(/:root\[data-tema='oscuro'\]\s*\{([^}]*)\}/) },
  };
}

export interface FalloContraste {
  tema: Tema;
  fg: string;
  bg: string;
  uso: Uso;
  ratio: number;
}

/** Every listed pair below its minimum, in every theme (an unknown token is a failure with ratio 0). */
export function revisarContrastes(css: string): FalloContraste[] {
  const temas = tokensPorTema(css);
  const out: FalloContraste[] = [];
  for (const tema of Object.keys(temas) as Tema[]) {
    const t = temas[tema];
    for (const [fg, bg, uso] of PARES) {
      const a = t[fg];
      const b = t[bg];
      const ratio = a && b ? contraste(a, b) : 0;
      if (ratio < MINIMO[uso]) out.push({ tema, fg, bg, uso, ratio: Math.round(ratio * 100) / 100 });
    }
  }
  return out;
}
