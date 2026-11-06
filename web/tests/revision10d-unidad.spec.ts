// Review 10d: failing proofs of what the 1.0 «Brilliant» features accept or do wrongly. No browser nor server:
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10d.config.ts tests/revision10d-unidad.spec.ts
// Each test states the scenario; they fail on the reviewed tree and must pass once fixed.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilar } from '../src/simulador/motor/nucleo.ts';
import { simular } from '../src/simulador/motor/simular.ts';
import { graficaOp, vectoresOp } from '../src/componentes/practica/circuito.ts';
import { comprobarConstruccion, medidaDeOp, netlistMedida, type MedidaCircuito } from '../src/componentes/practica/construye.ts';
import { MODELOS } from '../src/componentes/editor/modelos.ts';
import { ajustarRegistros, type RegistroSeguridad } from '../src/lib/aprendizaje/seguridad.ts';
import type { RegistroItem } from '../src/lib/aprendizaje/dominio.ts';
import type { ItemConstruye, ItemPractica } from '../src/componentes/practica/tipos.ts';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libro = path.join(web, 'public', 'libro');
const J = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(libro, p), 'utf8')) as T;
const indice = J<{ partes: string[] }>('practica/indice.json');
const items: ItemPractica[] = indice.partes.flatMap((p) => J<{ items: ItemPractica[] }>(`practica/${p}.json`).items);
const montaje = (ej: string) => items.find((x): x is ItemConstruye => x.tipo === 'construye' && x.ejercicio.label === ej)!;

let simularTexto: (t: string) => ReturnType<typeof simular>;
test.beforeAll(async () => {
  const modulo = await compilar(fs.readFileSync(path.join(web, 'public', 'ngspice', 'ngspice-xspice.wasm')));
  simularTexto = (t) => simular(modulo, t, undefined, 'xspice');
});
const modelos = (t: string) => MODELOS.filter((m) => new RegExp(`\\b${m.nombre}\\b`).test(t)).map((m) => m.texto).join('\n');
const medir = async (netlist: string): Promise<MedidaCircuito> => {
  const texto = netlistMedida(`* revision10d\n${netlist}${modelos(netlist)}\n`);
  const g = graficaOp(await simularTexto(texto));
  expect(g).not.toBeNull();
  return medidaDeOp(texto, vectoresOp(g!));
};
const veredicto = async (ej: string, netlist: string) => comprobarConstruccion(montaje(ej).condiciones, await medir(netlist));

test.describe('r10d·1 «carga» toma la resistencia serie por la carga (construye.ts, caso carga)', () => {
  test('ej. 5.3: un regulador SIN resistencia de carga no cumple «a una carga que consume 20 mA»', async () => {
    // Rs = 330 Ω and the Zener, nothing else: Rs carries 20,7 mA, all of it through the Zener. The checker reports
    // «La carga (RS) consume 20,7 mA» and accepts it.
    const r = await veredicto('ej-5.3', 'V1 a 0 dc 12\nRS a o 330\nDZ1 0 o DZ51\n');
    expect(r.resultados.find((x) => x.cond.k === 'carga')!.mensaje).not.toMatch(/La carga \(RS\)/);
    expect(r.bien).toBe(false);
  });

  test('ej. 5.8: con una carga de 10 mA (510 Ω) y 10 mA por el Zener no cumple «carga de 20 mA»', async () => {
    // The real load (RL = 510 Ω) takes 10 mA; the 20 mA resistor the checker calls «la carga» is Rs.
    const r = await veredicto('ej-5.8', 'V1 a 0 dc 12\nRS a o 330\nDZ1 0 o DZ51\nRL o 0 510\n');
    expect(r.bien).toBe(false);
  });

  test('las soluciones de referencia siguen cumpliendo (no se rompe lo correcto)', async () => {
    for (const ej of ['ej-5.3', 'ej-5.8']) expect((await veredicto(ej, montaje(ej).referencia.netlist)).bien, ej).toBe(true);
  });
});

test.describe('r10d·2 «puente» acepta circuitos que no son un puente (construye.ts, caso puente)', () => {
  test('ej. 2.5: un divisor de 1 kΩ + 1 kΩ con una tercera resistencia colgando de un solo extremo no es un puente', async () => {
    // R3 has one end in an empty row: no current, its free end sits at the divider's 2,5 V — «two midpoints at 2,5 V».
    const r = await veredicto('ej-2.5', 'V1 a 0 dc 5\nR1 a x 1k\nR2 x 0 1k\nR3 x y 1k\n');
    expect(r.bien).toBe(false);
  });

  test('ej. 2.5: una sola rama en serie (1 kΩ, 10 Ω, 1 kΩ, 1 kΩ) no es un puente equilibrado', async () => {
    // two adjacent nodes of ONE chain, 17 mV apart (< 1 % of 5 V), pass as «the two midpoints of the bridge».
    const r = await veredicto('ej-2.5', 'V1 a 0 dc 5\nR1 a x 1k\nR2 x y 10\nR3 y z 1k\nR4 z 0 1k\n');
    expect(r.bien).toBe(false);
  });
});

test.describe('r10d·3 ej. 2.8 acepta tres resistencias en serie como «divisor cargado» (construye.ts, caso nodo)', () => {
  test('tres de 10 kΩ en serie desde 10 V dan un punto a 3,33 V, pero la carga no está en paralelo con R2', async () => {
    const r = await veredicto('ej-2.8', 'V1 a 0 dc 10\nR1 a x 10k\nR2 x y 10k\nR3 y 0 10k\n');
    expect(r.bien).toBe(false);
  });
});

test.describe('r10d·4 «¿Qué seguridad tiene?»: el toque de una ronda cambia también la ronda anterior (seguridad.ts nivelDeRonda)', () => {
  test('acertar a las 12:00 («Lo sabía»), volver a acertar a las 12:12 y marcar «He adivinado» no rebaja la ronda de las 12:00', () => {
    const T = Date.UTC(2026, 0, 5, 12);
    const MIN = 60_000;
    // two right rounds of the same question, 12 min apart (dominio.ts VENTANA = 10 min: two rounds)
    const items: Record<string, RegistroItem> = { 'cap01-02': { s: 'cap01/sec-1.2', c: 'q', r: [[T, 100], [T + 12 * MIN, 100]] } };
    const seg: Record<string, RegistroSeguridad> = {
      'cap01-02': {
        e: [
          [T + 10_000, 'sabia'], // the tap right after the first round
          [T + 12 * MIN + 10_000, 'adivinado'], // the tap right after the second round
        ],
        t: T + 12 * MIN + 10_000,
      },
    };
    const ajustado = ajustarRegistros(items, seg)['cap01-02']!.r;
    expect(ajustado[1]![1]).toBe(30); // the second round: guessed
    // the first round was known: its own tap said so; today it becomes 30 points too
    expect(ajustado[0]![1]).toBe(100);
  });
});

test.describe('r10d·5 «Por qué no»: frases aprobadas que, sacadas de contexto, dan la razón a la opción incorrecta', () => {
  const curado = JSON.parse(fs.readFileSync(path.join(web, '..', 'contenido', 'porque_curado.json'), 'utf8')) as { pares: Record<string, { ok: boolean }> };
  const engañosas: Record<string, string> = {
    // «10¹⁴, prácticamente ilimitados» for Flash ← «Sus cifras son notables: … 10¹⁴ ciclos …» (the subject, FRAM, is
    // in the sentence before: alone it confirms the wrong option)
    'R|cap29-12|0': 'Flash: 10¹⁴ ciclos',
    // «Funciona como una AND cableada» (two tri-state outputs, opposite levels) ← «Eso implementa una AND cableada…»
    // («Eso» is open collector, not tri-state: alone it reads as a yes)
    'R|cap09-07|3': 'tri-estado: AND cableada',
    // «Una sección crítica» (the missing piece is volatile) ← «… sigue necesitando la sección crítica …»: it argues FOR it
    'R|cap38-05|2': 'volatile: sección crítica',
    // «Sí: la corriente se reparte a partes iguales» (two LEDs in parallel, one resistor) ← a sentence about LEDs with
    // their own resistors at 2,5 V («Y obsérvese…»): it does not speak of parallel LEDs sharing one resistor
    'R|cap05-13|0': 'LED en paralelo',
  };
  for (const [k, que] of Object.entries(engañosas))
    test(`${k} (${que}) no está aprobada`, () => {
      expect(curado.pares[k]?.ok, k).not.toBe(true);
    });
});
