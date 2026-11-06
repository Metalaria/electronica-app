// 1.0 accessibility pass, without a browser: the equations of the book read aloud (lib/habla-matematicas.ts). Every
// equation's text alternative was its Typst source; now it is Spanish words. Checks a few readings exactly and that, for
// every equation of the book (inline and display), no Typst syntax is left in what a screen reader says.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.accesibilidad10.config.ts tests/accesibilidad10-unidad.spec.ts --project=escritorio
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { leerMatematicas, leerUnidades } from '../src/lib/habla-matematicas.ts';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'no browser: once'));

test('lecturas de ecuaciones del libro', () => {
  const casos: [string, string][] = [
    ['V_("B") = V_("CC") dot.op (R_("2"))/(R_("1") + R_("2"))', 'V sub B igual a V sub CC por R sub 2 entre R sub 1 más R sub 2,'],
    ['λ = (c)/(f)', 'λ igual a c entre f'],
    ['V_("RMS") = (V_("p"))/(sqrt("2")) approx "0,707" dot.op V_("p")', 'V sub RMS igual a V sub p entre raíz cuadrada de 2, aproximadamente igual a 0,707 por V sub p'],
    ['I_("D") = ("1")/("2") dot.op k dot.op lr(( V_("GS") - V_("th") )) zws^("2")', 'I sub D igual a 1 entre 2 por k por V sub GS menos V sub th, todo al cuadrado'],
    ['f lr(( t )) = a_("0")', 'f de t igual a a sub 0'],
    ['R_("Th") = "3,1 Ω"', 'R sub Th igual a 3,1 ohmios'],
    ['Q = ("10,7 MHz")/("200 kHz") approx "53"', 'Q igual a 10,7 megahercios, entre 200 kilohercios, aproximadamente igual a 53'],
    ['overline(A) dot.op overline(B) = overline(A + B)', 'A negada por B negada igual a A más B negada'],
  ];
  for (const [src, esperado] of casos) expect(leerMatematicas(src).replace(/,$/, ''), src).toBe(esperado.replace(/,$/, ''));
  expect(leerUnidades('4,7 kΩ · 1 V · 25 µA · 2 mm')).toBe('4,7 kiloohmios · 1 voltio · 25 microamperios · 2 mm');
});

test('ninguna ecuación del libro deja sintaxis de Typst en su texto alternativo', () => {
  const dir = new URL('../public/libro/partes/', import.meta.url);
  const fuentes = new Set<string>();
  for (const f of readdirSync(dir)) {
    const s = readFileSync(new URL(f, dir), 'utf8');
    for (const m of s.matchAll(/class=\\"m\\" src=\\"[^"\\]*\\" alt=\\"((?:[^"\\]|\\.)*)\\"/g)) fuentes.add(JSON.parse(`"${m[1]}"`) as string);
    for (const m of s.matchAll(/"fuente":("(?:[^"\\]|\\.)*")/g)) fuentes.add(JSON.parse(m[1]!) as string);
  }
  expect(fuentes.size).toBeGreaterThan(500);
  const malas: string[] = [];
  for (const f of fuentes) {
    const l = leerMatematicas(f);
    if (!l.trim() || /dot\.op|\blr\b|_\(|\^\(|arrow\.|\bquad\b|"|\\/.test(l)) malas.push(`${f} → ${l}`);
  }
  expect(malas.slice(0, 10), `${malas.length} de ${fuentes.size}`).toEqual([]);
});
