// Review 10g (second review of the 1.0 «Brilliant» and exercises blocks): failing proofs that need neither a browser
// nor a server. Each test states the scenario; they fail on the reviewed tree and must pass once fixed.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10g.config.ts tests/revision10g-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilar } from '../src/simulador/motor/nucleo.ts';
import { simular } from '../src/simulador/motor/simular.ts';
import { graficaOp, vectoresOp } from '../src/componentes/practica/circuito.ts';
import { comprobarConstruccion, medidaDeOp, netlistMedida, type MedidaCircuito } from '../src/componentes/practica/construye.ts';
import { MODELOS } from '../src/componentes/editor/modelos.ts';
import { variantes } from '../src/componentes/practica/variantes.ts';
import { comprobar } from '../src/lib/magnitudes.ts';
import type { ItemConstruye, ItemNumerico, ItemPractica } from '../src/componentes/practica/tipos.ts';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libro = path.join(web, 'public', 'libro');
const J = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(libro, p), 'utf8')) as T;
const indice = J<{ partes: string[] }>('practica/indice.json');
const items: ItemPractica[] = indice.partes.flatMap((p) => {
  try {
    return J<{ items: ItemPractica[] }>(`practica/${p}.json`).items;
  } catch {
    return [];
  }
});
const montaje = (ej: string) => items.find((x): x is ItemConstruye => x.tipo === 'construye' && x.ejercicio.label === ej)!;

let simularTexto: (t: string) => ReturnType<typeof simular>;
test.beforeAll(async () => {
  const modulo = await compilar(fs.readFileSync(path.join(web, 'public', 'ngspice', 'ngspice-xspice.wasm')));
  simularTexto = (t) => simular(modulo, t, undefined, 'xspice');
});
const modelos = (t: string) => MODELOS.filter((m) => new RegExp(`\\b${m.nombre}\\b`).test(t)).map((m) => m.texto).join('\n');
const medir = async (netlist: string): Promise<MedidaCircuito> => {
  const texto = netlistMedida(`* revision10g\n${netlist}${modelos(netlist)}\n`);
  const g = graficaOp(await simularTexto(texto));
  expect(g).not.toBeNull();
  return medidaDeOp(texto, vectoresOp(g!));
};
const veredicto = async (ej: string, netlist: string) => comprobarConstruccion(montaje(ej).condiciones, await medir(netlist));
const resumen = (r: Awaited<ReturnType<typeof veredicto>>) => r.resultados.map((x) => `${x.bien ? '✓' : '✗'} ${x.mensaje}`).join(' | ');

// ---------------------------------------------------------------------------------------------- «Monte el circuito»

test.describe('r10g·1 (medio) Zener: la carga es lo que hay en paralelo con el Zener, no la resistencia que más se parece (construye.ts, caso carga)', () => {
  test('ej. 5.3 y 5.8: dos cargas de 270 Ω en paralelo (38 mA en total) no son «una carga que consume 20 mA»', async () => {
    // The checker takes, among the resistors across the Zener, the one whose current is closest to 20 mA: RL alone
    // carries 19 mA and passes, although the regulator feeds 38 mA (RL ∥ RL2 = 135 Ω). With Rs = 150 Ω the Zener still
    // gets 8 mA, inside 7…13 mA for 5.8: a series resistor of 150 Ω instead of the book's 220 Ω is accepted.
    for (const ej of ['ej-5.3', 'ej-5.8']) {
      const r = await veredicto(ej, 'V1 a 0 dc 12\nRS a o 150\nDZ1 0 o DZ51\nRL o 0 270\nRL2 o 0 270\n');
      expect(r.bien, `${ej}: ${resumen(r)}`).toBe(false);
    }
  });

  test('ej. 5.3 y 5.8: una carga de 20 mA hecha con dos resistencias (510 Ω ∥ 510 Ω, o 120 Ω + 150 Ω) cumple', async () => {
    // The same 20 mA load built from two parts (there may be no single resistor of the needed value): each one carries
    // 10 mA (parallel) or none of them sits across the Zener alone (series), and a right circuit is refused with
    // «la carga consume 10 mA» / «Falta la resistencia de carga».
    for (const [ej, rs] of [['ej-5.3', '270'], ['ej-5.8', '220']] as const) {
      const p = await veredicto(ej, `V1 a 0 dc 12\nRS a o ${rs}\nDZ1 0 o DZ51\nRL o 0 510\nRL2 o 0 510\n`);
      expect(p.bien, `${ej} 510 ∥ 510: ${resumen(p)}`).toBe(true);
      const s = await veredicto(ej, `V1 a 0 dc 12\nRS a o ${rs}\nDZ1 0 o DZ51\nRL o m 120\nRL2 m 0 150\n`);
      expect(s.bien, `${ej} 120 + 150: ${resumen(s)}`).toBe(true);
    }
  });

  test('control: las soluciones de referencia siguen cumpliendo', async () => {
    for (const ej of ['ej-5.3', 'ej-5.8']) expect((await veredicto(ej, montaje(ej).referencia.netlist)).bien, ej).toBe(true);
  });
});

test('r10g·2 (bajo-medio) LED: dos LED en serie no son «un LED con su resistencia limitadora» (ej. 26.3, 45.1 y 2.6)', async () => {
  // The «led» condition takes the largest LED current and never counts the LEDs: two red LEDs in series with 120 Ω
  // (82 Ω for 2.6) pass 10 mA (15 mA) and are accepted, with a resistor that is not the exercise's answer (330 Ω, 220 Ω).
  for (const [ej, r] of [['ej-26.3', '120'], ['ej-45.1', '120'], ['ej-2.6', '82']] as const) {
    const v = await veredicto(ej, `V1 a 0 dc 5\nR1 a m ${r}\nD1 m n LEDR\nD2 n 0 LEDR\n`);
    expect(v.bien, `${ej}: ${resumen(v)}`).toBe(false);
  }
});

test('r10g·3 (bajo-medio) puente de 2.5: las cuatro resistencias de 1 kΩ tienen que ser los brazos del puente', async () => {
  // «resistencias: 4 × 1 kΩ» counts 1 kΩ resistors anywhere. (a) A balanced bridge of 1 kΩ/1 kΩ and 2,2 kΩ/2,2 kΩ plus two
  // spare 1 kΩ straight across the supply passes (the exercise has R₃ = 1 kΩ); (b) R₄ = 1010 Ω — the sensor value that,
  // as the exercise itself asks, BREAKS the balance (12 mV) — passes with one spare 1 kΩ, because the balance tolerance
  // is 1 % of the supply (50 mV).
  const a = await veredicto('ej-2.5', 'V1 a 0 dc 5\nR1 a x 1k\nR2 x 0 1k\nR3 a y 2.2k\nR4 y 0 2.2k\nR5 a 0 1k\nR6 a 0 1k\n');
  expect(a.bien, `(a) ${resumen(a)}`).toBe(false);
  const b = await veredicto('ej-2.5', 'V1 a 0 dc 5\nR1 a x 1k\nR2 x 0 1k\nR3 a y 1k\nR4 y 0 1010\nR5 a 0 1k\n');
  expect(b.bien, `(b) ${resumen(b)}`).toBe(false);
  // control: the reference bridge still passes
  expect((await veredicto('ej-2.5', montaje('ej-2.5').referencia.netlist)).bien).toBe(true);
});

test('r10g·4 (bajo-medio) divisor de 1.4: la R₁ de 1 kΩ es la de arriba y forma parte del divisor', async () => {
  // «resistencia: 1 kΩ» is met by a 1 kΩ resistor anywhere: (a) 510 Ω on top and the 1 kΩ at the bottom (3,31 V) and
  // (b) a 1,8 kΩ / 3,3 kΩ divider with a 1 kΩ straight across the supply are accepted; the exercise fixes R₁ = 1 kΩ
  // (+ to the output) and asks for R₂.
  const a = await veredicto('ej-1.4', 'V1 a 0 dc 5\nR1 a o 510\nR2 o 0 1k\n');
  expect(a.bien, `(a) ${resumen(a)}`).toBe(false);
  const b = await veredicto('ej-1.4', 'V1 a 0 dc 5\nR1 a o 1.8k\nR2 o 0 3.3k\nR3 a 0 1k\n');
  expect(b.bien, `(b) ${resumen(b)}`).toBe(false);
  expect((await veredicto('ej-1.4', montaje('ej-1.4').referencia.netlist)).bien).toBe(true);
});

// ---------------------------------------------------------------------------------------------- «otros valores»

test('r10g·5 (medio) «otros valores» de prob-8.A: la disipación cabe en un TO-220 (si no, no hay radiador que dimensionar)', () => {
  // The statement fixes Rjc = 3 °C/W, Rcs = 0,5 °C/W, Tj ≤ 125 °C and 40 °C inside the box, and asks to size the
  // heatsink: Rsa = (125 − 40)/P − 3,5 must be positive, so P < 24,3 W (the book's own derated answer, 110 °C, needs
  // P < 20 W). The generator draws V_in up to 30 V and I up to 3 A: 8 of the 40 variants ask a TO-220 three-terminal
  // regulator to burn 26…57 W (24 V → 5 V at 3 A), for which no heatsink exists.
  const it = items.find((x): x is ItemNumerico => x.id === 'cap08-num-prob-8.A')!;
  const malas = variantes(it)
    .filter((v) => v.resultado > (125 - 40) / (3 + 0.5))
    .map((v) => `V_in=${v.valores.V_in} V_out=${v.valores.V_out} I=${v.valores.I}: P=${v.resultado.toFixed(1)} W`);
  expect(malas).toEqual([]);
});

// ---------------------------------------------------------------------------------------------- lib/magnitudes.ts

test('r10g·6 (bajo-medio) una potencia de diez escrita con superíndice se lee como tal: «10⁴ rad/s» no es 104 rad/s', () => {
  // leerNumero turns superscripts into digits before parsing, so «×10⁴» works but a bare «10⁴» becomes «104». ej-24.2
  // asks ω₀ = 10 000 rad/s: «10⁴ rad/s» is refused as «ni siquiera el orden de magnitud»; «10⁻³ A» says ««-3A» no es
  // una unidad de esta magnitud».
  const ej = J<{ items: Record<string, { respuestas: Parameters<typeof comprobar>[1][] }> }>('ejercicios.json').items['ej-24.2']!;
  const r = ej.respuestas.find((x) => x.unidad === 'rad/s')!;
  expect(comprobar('10⁴ rad/s', r).tipo).toBe('bien');
  expect(comprobar('10⁻³ A', { valor: 0.001, unidad: 'A', texto: '1 mA' }).tipo).toBe('bien');
});
