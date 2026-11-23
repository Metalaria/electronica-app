// 1.3.1 (qa131-temas): the animations' palette (componentes/animaciones/nucleo/paleta.ts) in every theme. The
// sepia palette took the light theme's inks unchanged, and on sepia's warmer page the labels written in them (the
// current «I = 20,0 mA» in amber, the field, the carriers, the series of a plot) fell to 2.2–4.5:1 (light: 2.4–4.1).
// Every ink the scenes write text with must read (WCAG AA, 4.5:1) on the three surfaces of its theme, and the
// carriers, arrows and wires stand out (3:1). Without a browser.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config without server> tests/qa131-temas-unidad.spec.ts
import { expect, test } from '@playwright/test';
import { paleta, type Paleta } from '../src/componentes/animaciones/nucleo/paleta';

const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

/** The palette entries the scenes pass as a label's colour (grep «color: p.» in componentes/animaciones). */
const TEXTO: (keyof Paleta)[] = ['tinta', 'suave', 'tenue', 'acento', 'corriente', 'peligro', 'positivo', 'hueco', 'electron', 'bien', 'campoB', 'campoE', 'calor'];
/** Carriers, arrows, fields and wires: graphics needed to understand a scene (WCAG 1.4.11, 3:1). */
const TRAZOS: (keyof Paleta)[] = ['electron', 'hueco', 'ionD', 'ionA', 'flujo', 'corriente', 'campoE', 'campoB', 'calor', 'positivo', 'negativo', 'hilo', 'bien', 'aviso', 'peligro'];

for (const tema of ['sepia', 'oscuro', 'claro'] as const) {
  test(`animaciones, tema ${tema}: las tintas de los rótulos se leen sobre el fondo, el fondo 2 y el panel`, () => {
    const p = paleta(tema);
    const bajos: string[] = [];
    const tintas: [string, string][] = [...TEXTO.map((k) => [k, p[k] as string] as [string, string]), ...p.serie.map((c, i) => [`serie[${i}]`, c] as [string, string])];
    for (const [k, c] of tintas)
      for (const f of ['fondo', 'fondo2', 'panel'] as const) {
        const r = contraste(c, p[f]);
        if (r < 4.5) bajos.push(`${k} ${c} sobre ${f} ${p[f]}: ${r.toFixed(2)}`);
      }
    for (const k of TRAZOS)
      for (const f of ['fondo', 'fondo2', 'panel'] as const) {
        const r = contraste(p[k] as string, p[f]);
        if (r < 3) bajos.push(`trazo ${k} ${p[k]} sobre ${f} ${p[f]}: ${r.toFixed(2)}`);
      }
    expect(bajos).toEqual([]);
  });
}
