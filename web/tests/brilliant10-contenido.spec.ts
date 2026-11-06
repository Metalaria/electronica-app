// 1.0 «Brilliant»: content and checker tests without a browser (EPA_SIN_SERVIDOR=1 skips the build):
//   - every challenge with a live figure (`reto`): a source in the book, a target the book's own values reach when
//     simulated here with the app's ngspice, a start that does not, a hint ladder and a development;
//   - every building challenge (`construye`): its numbers written in the book's exercise, its reference circuit
//     meeting every condition when simulated, and wrong circuits failing with a clear Spanish message;
//   - every wrong option of every choice question: an explanation (a sentence copied from the book, found there
//     verbatim, or «general»), and none for the right option;
//   - the pure rules: the challenge checker, the circuit checker, the course path, the review schedule.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { compilar } from '../src/simulador/motor/nucleo.ts';
import { simular } from '../src/simulador/motor/simular.ts';
import { graficaOp, netlistFiguraCon, resultadoFigura, leerEnFigura, vectoresOp } from '../src/componentes/practica/circuito.ts';
import { evaluarReto, consejoMando, posicionesMando, posicionDe, serieE96 } from '../src/componentes/practica/retos.ts';
import { comprobarConstruccion, esE12, medidaDeOp, netlistMedida, textoCondicion, type MedidaCircuito } from '../src/componentes/practica/construye.ts';
import { MODELOS } from '../src/componentes/editor/modelos.ts';
import { aprobadoSalto, calcularCamino, cuandoRepaso, repasoDe, saltadas, type NodoEntrada } from '../src/lib/aprendizaje/camino.ts';
import { DIA_MS, dominioConcepto } from '../src/lib/aprendizaje/dominio.ts';
import type { ItemConstruye, ItemPractica, ItemReto, ItemPrediccion } from '../src/componentes/practica/tipos.ts';
import type { PorqueParte } from '../src/componentes/pregunta/porque.ts';
import { netlistAveria, difiere, tensionEntre, corrienteDe, puntuacion, averiasDe } from '../src/componentes/practica/averias.ts';
import { anotarSeguridad, ajustarRegistros, nivelDeRonda, seguridadValida, unirSeguridad, type RegistroSeguridad } from '../src/lib/aprendizaje/seguridad.ts';
import type { ItemAveria } from '../src/componentes/practica/tipos.ts';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libro = path.join(web, 'public', 'libro');
const J = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(libro, p), 'utf8')) as T;

const indPractica = J<{ partes: string[]; items: Record<string, number> }>('practica/indice.json');
const items: ItemPractica[] = indPractica.partes.flatMap((p) => J<{ items: ItemPractica[] }>(`practica/${p}.json`).items);
const retos = items.filter((x): x is ItemReto => x.tipo === 'reto');
const construyes = items.filter((x): x is ItemConstruye => x.tipo === 'construye');
const textoParte = new Map<string, string>();
const parteTexto = (p: string) => {
  if (!textoParte.has(p)) textoParte.set(p, fs.readFileSync(path.join(libro, 'partes', `${p}.json`), 'utf8'));
  return textoParte.get(p)!;
};
/** A book HTML fragment is in the part's file exactly as it is (JSON-escaped). */
const enLibro = (p: string, html: string) => parteTexto(p).includes(JSON.stringify(html).slice(1, -1));
const plano = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
/** Messages use the app's narrow no-break space before units. */
const sp = (t: string | undefined) => (t ?? '').replace(/[\u202f\u00a0]/g, ' ');

let simularTexto: (t: string) => ReturnType<typeof simular>;
test.beforeAll(async () => {
  const modulo = await compilar(fs.readFileSync(path.join(web, 'public', 'ngspice', 'ngspice-xspice.wasm')));
  simularTexto = (t) => simular(modulo, t, undefined, 'xspice');
});

// ------------------------------------------------------------------ challenges with live figures

test.describe('retos con la figura (sin navegador)', () => {
  test('hay retos en cada capítulo con esquemas vivos que se pueden ajustar, y cada uno tiene su fuente', () => {
    expect(retos.length).toBeGreaterThanOrEqual(25);
    expect(indPractica.items.reto).toBe(retos.length);
    const partes = new Set(retos.map((r) => r.parte));
    // the chapters whose live DC schematics have a quantity worth adjusting (cap03 and cap49 have none: identical
    // unnamed parts, or pull-ups without current)
    for (const p of ['cap00', 'cap01', 'cap02', 'cap06', 'cap22', 'cap23', 'cap45', 'cap53']) expect(partes.has(p), p).toBe(true);
    for (const r of retos) {
      expect(r.citas.length, r.id).toBeGreaterThan(0);
      for (const c of r.citas) expect(enLibro(r.parte, c.html), `${r.id}: ${c.donde}`).toBe(true);
      if (r.origen === 'texto') expect(r.desarrollo[0], r.id).toMatch(/El objetivo lo da el libro/);
      expect(r.pistas.map((p) => p.titulo)).toEqual(['Lo que dice el libro', 'Hacia dónde', 'El valor del libro']);
      expect(r.desarrollo.length, r.id).toBeGreaterThanOrEqual(3);
      expect(r.mandos.length).toBeGreaterThanOrEqual(1);
      expect(r.mandos.length).toBeLessThanOrEqual(2);
      for (const m of r.mandos) {
        expect(m.valores, `${r.id} ${m.id}`).toContain(m.de);
        expect(m.valores).toContain(m.inicio);
        expect(r.efecto[m.id]).toMatch(/^(sube|baja)$/);
      }
      // «usted»: the statement asks, it does not use «tú»
      expect(plano(r.enunciado)).toMatch(/^Ajuste /);
    }
  });

  test('el objetivo se alcanza con los valores del libro y no desde el principio (simulado aquí)', async () => {
    const datos = new Map<string, { esquemas: unknown[] }>();
    for (const r of retos) {
      const d = datos.get(r.fuente.datos) ?? J<{ esquemas: unknown[] }>(r.fuente.datos);
      datos.set(r.fuente.datos, d);
      const esq = d.esquemas[r.fuente.esquema] as Parameters<typeof netlistFiguraCon>[0];
      const leer = async (valores: Record<string, number>) => {
        const { texto, meta } = netlistFiguraCon(esq, valores);
        const op = resultadoFigura(esq, meta, await simularTexto(texto));
        return op ? leerEnFigura(op, r.observa) : null;
      };
      const solucion = await leer(r.solucion.valores);
      const ev = evaluarReto(solucion, r.objetivo, r.tol, r.observa.unidad, 'x');
      expect(ev.bien, `${r.id}: ${solucion}`).toBe(true);
      const inicio = await leer(Object.fromEntries(r.mandos.map((m) => [m.id, m.inicio])));
      expect(evaluarReto(inicio, r.objetivo, r.tol, r.observa.unidad, 'x').bien, `${r.id} empieza resuelto`).toBe(false);
      // the «which way» hint is right: moving each knob up from the start moves the reading as stated
      for (const m of r.mandos) {
        const i = m.valores.indexOf(m.inicio);
        if (i + 3 >= m.valores.length) continue;
        const arriba = await leer({ ...Object.fromEntries(r.mandos.map((x) => [x.id, x.inicio])), [m.id]: m.valores[i + 3]! });
        expect(Math.abs(arriba!) > Math.abs(inicio!) ? 'sube' : 'baja', `${r.id} ${m.id}`).toBe(r.efecto[m.id]);
      }
    }
  });

  test('el comprobador del reto: dentro, falta, sobra, valores absolutos y el consejo', () => {
    expect(evaluarReto(4.05, 4, 0.02, 'V', 'la tensión en Vsal')).toMatchObject({ bien: true });
    const falta = evaluarReto(3, 4, 0.02, 'V', 'la tensión en Vsal');
    expect(falta.bien).toBe(false);
    expect(sp(falta.mensaje)).toBe('La tensión en Vsal es 3 V: le faltan 1 V para llegar a 4 V (−25 %).');
    const sobra = evaluarReto(5, 4, 0.02, 'V', 'la tensión en Vsal');
    expect(sp(sobra.mensaje)).toMatch(/le sobran 1 V sobre 4 V \(\+25 %\)/);
    expect(evaluarReto(-0.0102, 0.01, 0.05, 'A', 'la corriente').bien).toBe(true);
    expect(evaluarReto(null, 4, 0.02, 'V', 'x').mensaje).toMatch(/No se pudo simular/);
    expect(evaluarReto(4.09, 4, 0.02, 'V', 'x').bien).toBe(false);
    expect(consejoMando(-0.2, 'baja', 'R1', 'la tensión')).toBe('Para que la tensión suba, R1 tiene que disminuir.');
    expect(consejoMando(0.2, 'baja', 'R1', 'la tensión')).toBe('Para que la tensión baje, R1 tiene que aumentar.');
    const pos = posicionesMando('Ω', 5000);
    expect(pos).toContain(5000);
    expect(pos[0]).toBe(511); // the first E96 value from ×0,1 (500 Ω) up
    expect(pos.at(-1)).toBeCloseTo(49900, 0);
    expect(serieE96(1000, 1100)).toEqual([1000, 1020, 1050, 1070, 1100]);
    const v = posicionesMando('V', 12);
    expect(v).toContain(12);
    expect(v[1]! - v[0]!).toBeCloseTo(0.1, 6);
    expect(posicionDe(pos, 5100)).toBe(pos.indexOf(5110));
  });
});

// ------------------------------------------------------------------ building challenges

test.describe('retos de montar (sin navegador)', () => {
  const ejercicios = J<{ items: Record<string, { parte: string }> }>('ejercicios.json').items;
  const modelos = (t: string) => MODELOS.filter((m) => new RegExp(`\\b${m.nombre}\\b`).test(t)).map((m) => m.texto).join('\n');
  const medir = async (netlist: string): Promise<MedidaCircuito> => {
    const texto = netlistMedida(`* prueba\n${netlist}${modelos(netlist)}\n`);
    const g = graficaOp(await simularTexto(texto));
    expect(g).not.toBeNull();
    return medidaDeOp(texto, vectoresOp(g!));
  };

  test('seis ejercicios de diseño del libro, cada uno con su enunciado y una solución de referencia que cumple', async () => {
    expect(construyes.map((c) => c.ejercicio.label).sort()).toEqual(['ej-1.4', 'ej-2.4', 'ej-2.5', 'ej-2.6', 'ej-2.8', 'ej-26.3', 'ej-45.1', 'ej-5.3', 'ej-5.8', 'ej-6.2']);
    for (const c of construyes) {
      expect(ejercicios[c.ejercicio.label]?.parte).toBe(c.parte);
      // the statement is the book's (verbatim in the part) and every condition's number is written in the statement or
      // in the book's solution (the development quoted)
      expect(enLibro(c.parte, c.ejercicio.html.split(' ')[0]!)).toBe(true);
      const libroTexto = plano(c.ejercicio.html) + ' ' + c.citas.map((x) => plano(x.html)).join(' ');
      for (const x of c.condiciones) {
        const n =
          x.k === 'fuente' || x.k === 'nodo' ? x.valor
          : x.k === 'led' || x.k === 'carga' ? x.corriente * 1000
          : x.k === 'zener' ? (x.max != null ? ((x.min + x.max) / 2) * 1000 : x.min * 1000)
          : x.k === 'resistencia' || x.k === 'resistencias' ? x.valor / 1000
          : x.k === 'transistor' ? x.ic * 1000
          : x.k === 'divisor' ? (x.arriba != null ? x.arriba / 1000 : x.valor != null ? x.valor / 1000 : null)
          : null;
        if (n != null) expect(libroTexto, `${c.id} ${x.k}`).toContain(String(Number(n.toPrecision(4))).replace('.', ','));
        if (x.k === 'transistor' && x.vce != null) expect(libroTexto, `${c.id} vce`).toContain(String(x.vce).replace('.', ','));
      }
      expect(c.citas.length).toBeGreaterThan(0);
      for (const ci of c.citas) expect(enLibro(c.parte, ci.html)).toBe(true);
      expect(c.pistas.length).toBe(3);
      const r = comprobarConstruccion(c.condiciones, await medir(c.referencia.netlist));
      expect(r.bien, `${c.id}: ${r.resultados.map((x) => x.mensaje).join(' ')}`).toBe(true);
      expect(r.resultados.map((x) => x.mensaje)).toEqual(c.referencia.lecturas);
      expect(plano(c.enunciado)).toMatch(/^Monte en la protoboard/);
      for (const x of c.condiciones) expect(textoCondicion(x)).toMatch(/\.$/);
    }
  });

  test('cualquier solución válida vale y lo que falla se explica en español', async () => {
    const divisor = construyes.find((c) => c.ejercicio.label === 'ej-2.4')!;
    // another valid E12 pair of the book's solution (4,7 k and 3,3 k), and with the resistors the other way round
    expect(comprobarConstruccion(divisor.condiciones, await medir('V1 a 0 dc 12\nR8 a x 4.7k\nR9 x 0 3.3k\n')).bien).toBe(true);
    expect(comprobarConstruccion(divisor.condiciones, await medir('V1 a 0 dc 12\nRB 0 x 3.3k\nRA x a 4.7k\n')).bien).toBe(true);
    const malE12 = comprobarConstruccion(divisor.condiciones, await medir('V1 a 0 dc 12\nR1 a x 7.5k\nR2 x 0 5.36k\n'));
    expect(malE12.bien).toBe(false);
    expect(sp(malE12.resultados.find((x) => x.cond.k === 'e12')!.mensaje)).toBe('7,5 kΩ, 5,36 kΩ no son valores de la serie E12.');
    const lejos = comprobarConstruccion(divisor.condiciones, await medir('V1 a 0 dc 12\nR1 a x 1k\nR2 x 0 1k\n'));
    expect(sp(lejos.resultados.find((x) => x.cond.k === 'nodo')!.mensaje)).toBe('Ningún punto de su circuito está a 5 V ± 3 %: el más cercano está a 6 V (+20 %).');
    const sinPunto = comprobarConstruccion(divisor.condiciones, await medir('V1 a 0 dc 12\nR1 a 0 1k\n'));
    expect(sinPunto.resultados.find((x) => x.cond.k === 'nodo')!.mensaje).toMatch(/no tiene ningún punto entre las piezas/);
    const fuente = comprobarConstruccion(divisor.condiciones, await medir('V1 a 0 dc 9\nR1 a x 2.2k\nR2 x 0 1.5k\n'));
    expect(sp(fuente.resultados[0]!.mensaje)).toBe('El reto pide una fuente de 12 V; la suya da 9 V.');

    const led = construyes.find((c) => c.ejercicio.label === 'ej-45.1')!;
    expect(comprobarConstruccion(led.condiciones, await medir('V1 a 0 dc 5\nD1 a k LEDR\nR1 k 0 330\n')).bien).toBe(true);
    const alReves = comprobarConstruccion(led.condiciones, await medir('V1 a 0 dc 5\nR1 a k 330\nD1 0 k LEDR\n'));
    expect(alReves.resultados.find((x) => x.cond.k === 'led')!.mensaje).toMatch(/^El LED no se enciende/);
    const mucha = comprobarConstruccion(led.condiciones, await medir('V1 a 0 dc 5\nR1 a k 100\nD1 k 0 LEDR\n'));
    expect(mucha.resultados.find((x) => x.cond.k === 'led')!.mensaje).toMatch(/la resistencia en serie tiene que ser mayor\.$/);
    const sinLed = comprobarConstruccion(led.condiciones, await medir('V1 a 0 dc 5\nR1 a 0 330\n'));
    expect(sinLed.resultados.find((x) => x.cond.k === 'led')!.mensaje).toBe('Falta el LED.');

    const zener = construyes.find((c) => c.ejercicio.label === 'ej-5.3')!;
    const zr = comprobarConstruccion(zener.condiciones, await medir('V1 a 0 dc 12\nRS a o 270\nDZ1 o 0 DZ51\nRL o 0 270\n'));
    expect(zr.resultados.find((x) => x.cond.k === 'zener')!.mensaje).toMatch(/está al revés/);
    const poca = comprobarConstruccion(zener.condiciones, await medir('V1 a 0 dc 12\nRS a o 330\nDZ1 0 o DZ51\nRL o 0 270\n'));
    expect(poca.resultados.find((x) => x.cond.k === 'zener')!.mensaje).toMatch(/la resistencia serie tiene que ser menor\.$/);
  });

  test('puente, transistor y Zener con máximo: lo que falla se explica', async () => {
    const puente = construyes.find((c) => c.ejercicio.label === 'ej-2.5')!;
    // balanced, but not the exercise's bridge (review 10g: its four arms are of 1 kΩ)
    expect(comprobarConstruccion(puente.condiciones, await medir('V1 a 0 dc 5\nR1 a x 1k\nR2 x 0 1k\nR3 a y 2.2k\nR4 y 0 2.2k\nR5 a z 1k\n')).resultados[0]!.mensaje).toMatch(/cuatro brazos del puente/);
    // the balance itself, within 5 mV: the 1010 Ω sensor of the exercise breaks it (12 mV)
    const solo = [{ k: 'puente' as const, tol: 0.001 }];
    expect(comprobarConstruccion(solo, await medir('V1 a 0 dc 5\nR1 a x 1k\nR2 x 0 1k\nR3 a y 1k\nR4 y 0 1010\n')).resultados[0]!.mensaje).toMatch(/no está equilibrado/);
    expect(comprobarConstruccion(solo, await medir('V1 a 0 dc 5\nR1 a x 1k\nR2 x 0 1k\nR3 a y 2.2k\nR4 y 0 2.2k\n')).bien).toBe(true);
    const desequilibrado = comprobarConstruccion(puente.condiciones, await medir('V1 a 0 dc 5\nR1 a x 1k\nR2 x 0 1k\nR3 a y 1k\nR4 y 0 1.5k\n'));
    expect(desequilibrado.resultados[0]!.mensaje).toMatch(/R4 no/);
    expect(comprobarConstruccion(puente.condiciones, await medir('V1 a 0 dc 5\nR1 a x 1k\nR2 x 0 1k\n')).resultados[0]!.mensaje).toMatch(/menos de dos puntos intermedios/);
    const bjt = construyes.find((c) => c.ejercicio.label === 'ej-6.2')!;
    const saturado = comprobarConstruccion(bjt.condiciones, await medir('V1 v 0 dc 9\nR1 v b 4.7k\nR2 b 0 22k\nRC v c 2.2k\nRE e 0 470\nQ1 c b e Q2N3904\n'));
    expect(sp(saturado.resultados.find((x) => x.cond.k === 'transistor')!.mensaje)).toMatch(/está saturado/);
    const sinQ = comprobarConstruccion(bjt.condiciones, await medir('V1 v 0 dc 9\nR1 v b 22k\nR2 b 0 4.7k\n'));
    expect(sinQ.resultados.find((x) => x.cond.k === 'transistor')!.mensaje).toBe('Falta el transistor NPN.');
    const z = construyes.find((c) => c.ejercicio.label === 'ej-5.8')!;
    const demasiada = comprobarConstruccion(z.condiciones, await medir('V1 a 0 dc 12\nRS a o 150\nDZ1 0 o DZ51\nRL o 0 270\n'));
    expect(demasiada.resultados.find((x) => x.cond.k === 'zener')!.mensaje).toMatch(/la resistencia serie tiene que ser mayor/);
  });

  test('revisión 10d: la carga, el puente, el divisor cargado y el transistor sin resistencia de colector', async () => {
    const reg = construyes.find((c) => c.ejercicio.label === 'ej-5.3')!;
    // the series resistor is not the load; a load across the Zener is
    const sinCarga = comprobarConstruccion(reg.condiciones, await medir('V1 a 0 dc 12\nRS a o 330\nDZ1 0 o DZ51\n'));
    expect(sinCarga.bien).toBe(false);
    expect(sinCarga.resultados.find((x) => x.cond.k === 'carga')!.mensaje).toMatch(/^Falta la resistencia de carga: va en paralelo con el Zener/);
    const otra = comprobarConstruccion(reg.condiciones, await medir('V1 x 0 dc 12\nRA x m 270\nDZ9 0 m DZ51\nRB 0 m 270\n'));
    expect(otra.bien, otra.resultados.map((x) => x.mensaje).join(' ')).toBe(true);
    const pocaCarga = comprobarConstruccion(reg.condiciones, await medir('V1 a 0 dc 12\nRS a o 330\nDZ1 0 o DZ51\nRL o 0 510\n'));
    expect(sp(pocaCarga.resultados.find((x) => x.cond.k === 'carga')!.mensaje)).toMatch(/^La carga \(RL\) consume 10,\d mA y el reto pide 20 mA ± 10 %: para que consuma más, su resistencia tiene que ser menor\.$/);
    // a bridge: two branches; one chain or a dangling resistor is not one
    const puente = construyes.find((c) => c.ejercicio.label === 'ej-2.5')!;
    expect(comprobarConstruccion(puente.condiciones, await medir(puente.referencia.netlist)).bien).toBe(true);
    // with a detector between the midpoints (balanced: no current through it)
    expect(comprobarConstruccion(puente.condiciones, await medir('V1 1 0 dc 5\nR1 1 a 1k\nR2 a 0 1k\nR3 1 b 1k\nR4 b 0 1k\nRD a b 10k\n')).bien).toBe(true);
    const cadena = comprobarConstruccion(puente.condiciones, await medir('V1 a 0 dc 5\nR1 a x 1k\nR2 x y 10\nR3 y z 10\nR4 z 0 1k\n'));
    expect(cadena.resultados.find((x) => x.cond.k === 'puente')!.mensaje).toMatch(/no hay dos puntos medios en ramas distintas/);
    const tres = comprobarConstruccion(puente.condiciones, await medir('V1 1 0 dc 5\nR1 1 a 1k\nR2 a 0 1k\nR3 1 b 1k\nR4 b 0 2.2k\n'));
    expect(tres.resultados.find((x) => x.cond.k === 'puente')!.mensaje).toMatch(/R4 no/); // R₄ = 1 kΩ is the answer
    // the loaded divider: the load across the lower resistor; three in series also give 3,33 V
    const div = construyes.find((c) => c.ejercicio.label === 'ej-2.8')!;
    const serie = comprobarConstruccion(div.condiciones, await medir('V1 a 0 dc 10\nR1 a x 10k\nR2 x y 10k\nR3 y 0 10k\n'));
    expect(serie.resultados.find((x) => x.cond.k === 'nodo')!.bien).toBe(true);
    expect(serie.resultados.find((x) => x.cond.k === 'divisor')!.mensaje).toMatch(/la de abajo y la carga, en paralelo/);
    expect(comprobarConstruccion(div.condiciones, await medir('V1 p 0 dc 10\nRL 0 s 10k\nRA p s 10k\nRB s 0 10k\n')).bien).toBe(true);
    // the transistor without R_C: the same collector current, but V_CE is the supply minus V_E
    const bjt = construyes.find((c) => c.ejercicio.label === 'ej-6.2')!;
    const sinRC = comprobarConstruccion(bjt.condiciones, await medir('V1 v 0 dc 9\nR1 v b 22k\nR2 b 0 4.7k\nRE e 0 470\nQ1 v b e Q2N3904\n'));
    expect(sinRC.bien).toBe(false);
    expect(sp(sinRC.resultados.find((x) => x.cond.k === 'transistor')!.mensaje)).toMatch(/falta R_C \(del \+ al colector\)\.$/);
    // with too small an R_C: the same collector current, the wrong V_CE
    const rcPoca = comprobarConstruccion(bjt.condiciones, await medir('V1 v 0 dc 9\nR1 v b 22k\nR2 b 0 4.7k\nRC v c 470\nRE e 0 470\nQ1 c b e Q2N3904\n'));
    expect(sp(rcPoca.resultados.find((x) => x.cond.k === 'transistor')!.mensaje)).toMatch(/entre colector y emisor hay 7,\d+ V y el reto pide 3,98 V ± 10 %: la resistencia de colector tiene que ser mayor \(o falta\)\.$/);
  });

  test('revisión 10g: cada reto de montar contra montajes tramposos (piezas de más, combinaciones, posiciones)', async () => {
    // [exercise, netlist, accepted?, what it tries]: the right circuits pass and none of the wrong ones does
    const casos: [string, string, boolean, string][] = [
      ['ej-1.4', "V1 a 0 dc 5\nR1 a o 1k\nR2 o 0 2k\n", true, 'referencia'],
      ['ej-1.4', "V1 a 0 dc 5\nR1 a o 1k\nR2 o 0 1.8k\n", true, '1,8k'],
      ['ej-1.4', "V1 a 0 dc 5\nR1 a o 1k\nR2 o m 1k\nR3 m 0 1k\n", false, 'R2 de dos'],
      ['ej-1.4', "V1 a 0 dc 5\nR1 a o 1k\nR2 o 0 2k\nR3 a o 1Meg\n", false, 'paralelo arriba'],
      ['ej-1.4', "V1 a 0 dc 5\nV2 o 0 dc 3.3\nR1 a o 1k\nR2 o 0 2k\n", false, 'segunda fuente'],
      ['ej-1.4', "V1 a 0 dc 5\nR1 a o 1k\nR2 o 0 2k\nR3 o x 1k\n", false, 'colgando'],
      ['ej-2.4', "V1 a 0 dc 12\nR1 a o 2.2k\nR2 o 0 1.5k\n", true, 'referencia'],
      ['ej-2.4', "V1 a 0 dc 12\nR1 a o 2.2k\nR2 o 0 1.5k\nR3 a 0 10k\n", false, 'extra a la fuente'],
      ['ej-2.4', "V1 a 0 dc 12\nR1 a o 4.7k\nR2 o 0 3.3k\nRL o 0 1Meg\n", false, 'carga extra'],
      ['ej-2.4', "V1 a 0 dc 12\nR1 0 o 1.5k\nR2 o a 2.2k\n", true, 'al revés de nombres'],
      ['ej-2.5', "V1 1 0 dc 5\nR1 1 a 1k\nR2 a 0 1k\nR3 1 b 1k\nR4 b 0 1k\n", true, 'referencia'],
      ['ej-2.5', "V1 1 0 dc 5\nR1 1 a 1k\nR2 a 0 1k\nR3 1 b 1k\nR4 b 0 1k\nRD a b 1k\n", true, 'con detector'],
      ['ej-2.5', "V1 1 0 dc 5\nR1 1 a 1k\nR2 a 0 1k\nR3 1 b 1k\nR4 b 0 1k\nR5 1 c 1k\nR6 c 0 1k\n", false, 'tercera rama'],
      ['ej-2.5', "V1 1 0 dc 5\nR1 1 a 1k\nR2 a 0 1k\nR3 1 b 1k\nR4 b m 500\nR5 m 0 500\n", false, 'brazo de dos'],
      ['ej-2.5', "V1 1 0 dc 5\nR1 1 a 1k\nR2 a 0 1k\nR3 1 b 1k\nR4 b 0 1.01k\n", false, '1010'],
      ['ej-2.5', "V1 1 0 dc 5\nR1 1 a 1k\nR2 a 0 1k\nR3 1 b 1k\nR4 b 0 1k\nR5 a 0 1Meg\n", false, 'paralelo en un brazo'],
      ['ej-2.6', "V1 a 0 dc 5\nR1 a k 220\nD1 k 0 LEDR\n", true, 'referencia'],
      ['ej-2.6', "V1 a 0 dc 5\nR1 a m 100\nR2 m k 100\nD1 k 0 LEDR\n", false, 'dos resistencias'],
      ['ej-2.6', "V1 a 0 dc 5\nR1 a k 180\nD1 k 0 LEDR\nR2 k 0 1k\n", false, 'resistencia en paralelo con el LED'],
      ['ej-2.6', "V1 a 0 dc 5\nD1 a k LEDR\nR1 k 0 220\n", true, 'LED arriba'],
      ['ej-2.6', "V1 a 0 dc 5\nR1 a k 220\nD1 k 0 LEDR\nD2 a 0 LEDR\n", false, 'LED directo a la fuente'],
      ['ej-26.3', "V1 a 0 dc 5\nR1 a k 330\nD1 k 0 LEDR\n", true, 'referencia'],
      ['ej-45.1', "V1 a 0 dc 5\nR1 a k 330\nD1 k 0 LEDR\nR2 a 0 1k\n", false, 'resistencia directa'],
      ['ej-45.1', "V1 a 0 dc 5\nR1 a k 330\nD1 k 0 LEDR\nD2 0 k LEDR\n", false, 'segundo LED al revés'],
      ['ej-2.8', "V1 1 0 dc 10\nR1 1 2 10k\nR2 2 0 10k\nRL 2 0 10k\n", true, 'referencia'],
      ['ej-2.8', "V1 1 0 dc 10\nR1 1 2 10k\nR2 2 0 10k\nRL 2 0 10k\nR4 1 2 10Meg\n", false, 'extra arriba'],
      ['ej-2.8', "V1 1 0 dc 10\nR1 1 2 4.7k\nR2 2 0 4.7k\nRL 2 0 4.7k\n", false, 'otros valores'],
      ['ej-5.3', "V1 1 0 dc 12\nRS 1 2 270\nDZ1 0 2 DZ51\nRL 2 0 270\n", true, 'referencia'],
      ['ej-5.3', "V1 1 0 dc 12\nRS 1 2 270\nDZ1 0 2 DZ51\nRL 2 0 270\nDZ2 0 2 DZ51\n", false, 'dos Zener'],
      ['ej-5.3', "V1 1 0 dc 12\nRS 1 2 270\nDZ1 m 2 DZ51\nRL m 0 270\n", false, 'Zener en serie con la carga'],
      ['ej-5.3', "V1 1 0 dc 12\nRS 1 2 270\nDZ1 0 2 DZ51\nRL 2 0 270\nR9 1 0 1k\n", false, 'resistencia directa'],
      ['ej-5.3', "V1 1 0 dc 12\nRA 1 2 540\nRB 1 2 540\nDZ1 0 2 DZ51\nRL 2 0 270\n", true, 'Rs de dos en paralelo'],
      ['ej-5.3', "V1 1 0 dc 12\nRS 1 2 270\nDZ1 0 2 DZ51\nRL 2 0 270\nRX 2 x 1k\n", false, 'colgando'],
      ['ej-5.8', "V1 1 0 dc 12\nRS 1 2 220\nDZ1 0 2 DZ51\nRL 2 0 270\n", true, 'referencia'],
      ['ej-5.8', "V1 1 0 dc 12\nRS 1 2 220\nDZ1 0 2 DZ51\nRL 2 0 270\nRB 2 0 4.7k\n", true, 'la carga de dos piezas en paralelo (270 Ω ∥ 4,7 kΩ = 20 mA)'],
      ['ej-6.2', "V1 v 0 dc 9\nR1 v b 22k\nR2 b 0 4.7k\nRC v c 2.2k\nRE e 0 470\nQ1 c b e Q2N3904\n", true, 'referencia'],
      ['ej-6.2', "V1 v 0 dc 9\nRB v b 560k\nRC v c 2.2k\nRE e 0 470\nQ1 c b e Q2N3904\n", false, 'una sola de base'],
      ['ej-6.2', "V1 v 0 dc 9\nR1 v b 22k\nR2 b 0 4.7k\nRC v c 2.2k\nRE e 0 470\nQ1 c b e Q2N3904\nRX v 0 1k\n", false, 'directa'],
      // review 10g's own cases: loads of two parts and two LEDs in series
      ['ej-5.3', 'V1 a 0 dc 12\nRS a o 150\nDZ1 0 o DZ51\nRL o 0 270\nRL2 o 0 270\n', false, 'dos cargas de 270 Ω (38 mA)'],
      ['ej-5.8', 'V1 a 0 dc 12\nRS a o 220\nDZ1 0 o DZ51\nRL o m 120\nRL2 m 0 150\n', true, 'carga de 120 Ω + 150 Ω'],
      ['ej-26.3', 'V1 a 0 dc 5\nR1 a m 120\nD1 m n LEDR\nD2 n 0 LEDR\n', false, 'dos LED en serie'],
      ['ej-1.4', 'V1 a 0 dc 5\nR1 a o 510\nR2 o 0 1k\n', false, 'la de 1 kΩ abajo'],
    ];
    const fallos: string[] = [];
    for (const [ej, nl, esperado, nota] of casos) {
      const c = construyes.find((x) => x.ejercicio.label === ej)!;
      const r = comprobarConstruccion(c.condiciones, await medir(nl));
      if (r.bien !== esperado) fallos.push(`${ej} ${nota}: ${r.bien ? 'aceptado' : 'rechazado'} · ${r.resultados.filter((x) => !x.bien).map((x) => x.mensaje).join(' / ')}`);
    }
    expect(fallos).toEqual([]);
  });

  test('esE12 y la potencia', () => {
    for (const r of [10, 220, 330, 4700, 1.5e6, 1e3, 8.2]) expect(esE12(r), String(r)).toBe(true);
    for (const r of [200, 300, 7500, 5360, 0, -100]) expect(esE12(r), String(r)).toBe(false);
    const m: MedidaCircuito = { nodos: { '0': 0, a: 12 }, elementos: [{ nombre: 'R1', tipo: 'R', valor: 100, a: 'a', b: '0', corriente: 0.12, tension: 12 }] };
    expect(sp(comprobarConstruccion([{ k: 'potencia', max: 0.25 }], m).resultados[0]!.mensaje)).toBe('R1 disipa 1,44 W: más de los 250 mW que aguanta.');
  });
});

// ------------------------------------------------------------------ the explanation of each wrong option

test.describe('por qué no (sin navegador)', () => {
  const ind = J<{ partes: string[] }>('porque/indice.json');
  const porque = new Map(ind.partes.map((p) => [p, J<PorqueParte>(`porque/${p}.json`)]));

  test('cada opción incorrecta de cada pregunta de Repaso tiene la suya (y la correcta ninguna)', () => {
    const repaso = J<{ partes: { parte: string }[] }>('repaso/indice.json').partes.map((x) => x.parte);
    let libroN = 0;
    let total = 0;
    for (const p of repaso) {
      const qs = J<{ preguntas: { id: string; tipo: string; opciones?: string[]; correcta?: number }[] }>(`repaso/${p}.json`).preguntas;
      for (const q of qs) {
        if (q.tipo !== 'opcion') continue;
        const e = porque.get(p)?.repaso[q.id];
        expect(e, q.id).toBeTruthy();
        const malas = q.opciones!.map((_, i) => i).filter((i) => i !== q.correcta);
        expect(Object.keys(e!).map(Number).sort()).toEqual(malas);
        for (const i of malas) {
          const x = e![String(i)]!;
          total++;
          if (x.k === 'libro') {
            libroN++;
            // copied from the book, as it is, and from the question's own section
            expect(parteTexto(p).includes(JSON.stringify(x.html).slice(1, -1)) || x.html.split(' ').length > 3, q.id).toBe(true);
            expect(plano(x.html).length).toBeGreaterThanOrEqual(40);
            expect(x.donde).toMatch(/^(Sección|Apartado|Problema|Figura|Tabla)/);
          } else expect(x.k).toBe('general');
        }
      }
    }
    expect(total).toBe(2697);
    expect(libroN).toBeGreaterThan(100);
  });

  test('solo se muestran las frases revisadas a mano y aprobadas (contenido/porque_curado.json)', () => {
    const curado = JSON.parse(fs.readFileSync(path.join(web, '..', 'contenido', 'porque_curado.json'), 'utf8')) as { pares: Record<string, { ok: boolean; frase: string; previa?: boolean }> };
    const huella = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/(\d),(\d)/g, '$1.$2').replace(/[^a-z0-9]+/g, '');
    const pref: Record<string, string> = { repaso: 'R', ejercicios: 'E', prediccion: 'P' };
    let emitidas = 0;
    for (const d of porque.values()) {
      for (const g of ['repaso', 'ejercicios', 'prediccion'] as const) {
        for (const [q, ops] of Object.entries(d[g])) {
          for (const [i, x] of Object.entries(ops)) {
            if (x.k !== 'libro') continue;
            emitidas++;
            const c = curado.pares[`${pref[g]}|${q}|${i}`];
            expect(c?.ok, `${q} ${i} sin aprobar`).toBe(true);
            // «previa»: the sentence before it comes first (review 10d), the reviewed one follows
            if (c!.previa) expect(huella(plano(x.html)).includes(huella(c!.frase)), `${q} ${i}`).toBe(true);
            else expect(huella(plano(x.html).replace(/\s+/g, ' ').slice(0, 80))).toBe(huella(c!.frase));
          }
        }
      }
    }
    const aprobadas = Object.values(curado.pares).filter((x) => x.ok).length;
    expect(emitidas).toBe(aprobadas);
    // review 10d: 10 more rejected (no subject out of context, or arguing for the option); 5 shown with the one before
    expect(aprobadas).toBe(129);
    expect(Object.keys(curado.pares).length).toBe(386);
  });

  test('ninguna frase aprobada empieza por un pronombre sin su sujeto (salvo con la frase anterior)', () => {
    // review 10d (r10d·5): «Eso implementa una AND cableada…» alone reads as a yes to the wrong option
    const curado = JSON.parse(fs.readFileSync(path.join(web, '..', 'contenido', 'porque_curado.json'), 'utf8')) as { pares: Record<string, { ok: boolean; frase: string; previa?: boolean }> };
    const anafora = /^(Eso|Esto|Ello|Ese|Esa|Este|Esta|Estos|Estas|Es la|Es el|Se usa)\b|^Y (ese|esa|eso|esto|el segundo|la segunda|obsérvese)\b/;
    const malas = Object.entries(curado.pares).filter(([, v]) => v.ok && !v.previa && anafora.test(v.frase)).map(([k]) => k);
    expect(malas).toEqual([]);
    for (const k of ['R|cap29-12|0', 'R|cap09-07|3', 'R|cap38-05|2', 'R|cap05-13|0', 'R|apF-05|0', 'R|cap53-12|1']) expect(curado.pares[k]?.ok, k).toBe(false);
  });

  test('cada frase del libro está en el libro tal cual', () => {
    for (const [p, d] of porque) {
      const texto = parteTexto(p);
      const todas = [...Object.values(d.repaso), ...Object.values(d.ejercicios), ...Object.values(d.prediccion)].flatMap((o) => Object.values(o));
      for (const x of todas) {
        if (x.k !== 'libro') continue;
        // a sentence is a piece of a paragraph: its plain text is in the part's text
        expect(plano(texto).includes(plano(x.html)) || texto.includes(JSON.stringify(x.html).slice(1, -1)), `${p}: ${plano(x.html).slice(0, 60)}`).toBe(true);
      }
    }
  });

  test('preguntas de los ejercicios y predicciones: todas las opciones incorrectas', () => {
    const ej = J<{ items: Record<string, { parte: string; preguntas?: { id: string; tipo: string; opciones?: string[]; correcta?: number }[] }> }>('ejercicios.json').items;
    let n = 0;
    for (const [label, it] of Object.entries(ej)) {
      for (const q of it.preguntas ?? []) {
        if (q.tipo !== 'eleccion') continue;
        const e = porque.get(it.parte)?.ejercicios[`${label}/${q.id}`];
        expect(e, `${label}/${q.id}`).toBeTruthy();
        expect(Object.keys(e!).map(Number).sort()).toEqual(q.opciones!.map((_, i) => i).filter((i) => i !== q.correcta));
        n += Object.keys(e!).length;
      }
    }
    expect(n).toBe(127);
    const preds = items.filter((x): x is ItemPrediccion => x.tipo === 'prediccion');
    for (const it of preds) {
      const e = porque.get(it.parte)?.prediccion[it.id];
      expect(e, it.id).toBeTruthy();
      expect(Object.keys(e!).sort()).toEqual(['baja', 'igual', 'sube'].filter((s) => s !== it.esperado.respuesta));
    }
  });
});

// ------------------------------------------------------------------ the course path and the review schedule

test.describe('camino de los cursos (sin navegador)', () => {
  const n = (progreso: NodoEntrada['progreso'], leccion = true, clave = Math.random().toString(36)): NodoEntrada => ({ clave, leccion, progreso });

  test('la siguiente lección se abre al completar la anterior; lo ya tocado nunca se bloquea', () => {
    expect(calcularCamino([n('nada'), n('nada'), n('nada')]).estados).toEqual(['disponible', 'bloqueado', 'bloqueado']);
    expect(calcularCamino([n('hecho'), n('nada'), n('nada')]).estados).toEqual(['hecho', 'disponible', 'bloqueado']);
    expect(calcularCamino([n('superado'), n('empezado'), n('nada')]).estados).toEqual(['superado', 'en-curso', 'bloqueado']);
    // read ahead in the book: everything up to it stays open
    expect(calcularCamino([n('nada'), n('nada'), n('empezado'), n('nada')]).estados).toEqual(['disponible', 'disponible', 'en-curso', 'bloqueado']);
    expect(calcularCamino([n('hecho'), n('hecho')]).siguiente).toBe(-1);
    expect(calcularCamino([n('hecho'), n('nada'), n('nada')]).siguiente).toBe(1);
  });

  test('en un curso propio, los ejercicios y preguntas no bloquean: se abren con su lección', () => {
    const c = [n('hecho'), n('nada', false), n('nada', false), n('nada'), n('nada', false), n('nada')];
    expect(calcularCamino(c).estados).toEqual(['hecho', 'disponible', 'disponible', 'disponible', 'disponible', 'bloqueado']);
    expect(calcularCamino([n('nada'), n('nada', false), n('nada'), n('nada', false)]).estados).toEqual(['disponible', 'disponible', 'bloqueado', 'bloqueado']);
    expect(calcularCamino([n('nada', false), n('nada')]).estados).toEqual(['disponible', 'disponible']);
  });

  test('saltar hasta una lección marca las lecciones anteriores sin hacer', () => {
    const c = [n('hecho', true, 'a'), n('nada', true, 'b'), n('superado', true, 'c'), n('nada', false, 'x'), n('empezado', true, 'd'), n('nada', true, 'e')];
    expect(saltadas(c, 5)).toEqual(['b', 'd']);
    expect(saltadas(c, 0)).toEqual([]);
    expect(aprobadoSalto(3, 4)).toBe(true);
    expect(aprobadoSalto(2, 4)).toBe(false);
    expect(aprobadoSalto(2, 2)).toBe(true);
    expect(aprobadoSalto(1, 2)).toBe(false);
    expect(aprobadoSalto(0, 0)).toBe(false);
  });

  test('el repaso espaciado sale del dominio: ahora, una fecha, flojo o sin datos', () => {
    const T0 = Date.UTC(2026, 0, 5, 12);
    const reg = (r: [number, number][]) => ({ s: 'cap01/sec-1.4', c: 'q' as const, r });
    const sabido = [1, 2, 3].map(() => reg([[T0, 100], [T0 + 2 * DIA_MS, 100]]));
    const reciente = dominioConcepto('cap01/sec-1.4', sabido, T0 + 2 * DIA_MS + 3_600_000);
    const r = repasoDe(reciente);
    expect(r.k).toBe('fecha');
    if (r.k === 'fecha') {
      // stability 6 days (two good days): due at 0,515 · 6 days after the last round
      expect((r.t - (T0 + 2 * DIA_MS)) / DIA_MS).toBeCloseTo(0.515 * reciente.estabilidad, 2);
      // and at that time mastery agrees that it is due
      expect(dominioConcepto('cap01/sec-1.4', sabido, r.t + 3_600_000).repasar).toBe(true);
    }
    expect(repasoDe(dominioConcepto('cap01/sec-1.4', sabido, T0 + 30 * DIA_MS)).k).toBe('ahora');
    expect(repasoDe(dominioConcepto('cap01/sec-1.4', [reg([[T0, 0]])], T0)).k).toBe('flojo');
    expect(repasoDe(dominioConcepto('cap01/sec-1.4', [], T0)).k).toBe('sin-datos');
    // review 10d: mastery computed earlier; once the date is reached it is due now (the view's clock ticks)
    if (r.k === 'fecha') {
      expect(repasoDe(reciente, r.t - 60_000).k).toBe('fecha');
      expect(repasoDe(reciente, r.t + 60_000).k).toBe('ahora');
    }
    expect(cuandoRepaso(T0 + 0.5 * DIA_MS, T0)).toBe('mañana');
    expect(cuandoRepaso(T0 - DIA_MS, T0)).toBe('hoy');
    // review 10d: in two hours, the same day, is «hoy» (it said «mañana»)
    const manana = new Date(2026, 0, 5, 9).getTime();
    expect(cuandoRepaso(manana + 2 * 3_600_000, manana)).toBe('hoy');
    expect(cuandoRepaso(new Date(2026, 0, 6, 8).getTime(), new Date(2026, 0, 5, 23).getTime())).toBe('mañana');
    expect(cuandoRepaso(T0 + 3 * DIA_MS, T0)).toBe('en 3 días');
    expect(cuandoRepaso(T0 + 20 * DIA_MS, T0)).toBe('en 3 semanas');
  });
});

// ------------------------------------------------------------------ «Encuentre la avería»

test.describe('encuentre la avería (sin navegador)', () => {
  const averias = items.filter((x): x is ItemAveria => x.tipo === 'averia');
  const curado = JSON.parse(fs.readFileSync(path.join(web, '..', 'contenido', 'averias_curado.json'), 'utf8')) as { casos: Record<string, { ok: boolean }> };

  test('solo se publican los casos revisados y aprobados, cada uno con su figura citada, sus puntos y su pieza', () => {
    expect(averias.length).toBe(Object.values(curado.casos).filter((x) => x.ok).length);
    expect(averias.length).toBeGreaterThanOrEqual(30);
    expect(new Set(averias.map((a) => a.parte)).size).toBeGreaterThanOrEqual(8);
    for (const a of averias) {
      expect(curado.casos[a.id]?.ok, a.id).toBe(true);
      for (const c of a.citas) expect(enLibro(a.parte, c.html), a.id).toBe(true);
      expect(a.puntos.filter((p) => p.masa)).toHaveLength(1);
      expect(a.puntos.length).toBeGreaterThanOrEqual(3);
      expect(a.piezas.map((p) => p.id)).toContain(a.averia.elemento);
      expect(a.piezas.find((p) => p.id === a.averia.elemento)!.tipos).toContain(a.averia.tipo);
      expect(a.puntos.map((p) => p.nodo)).toContain(a.clave);
      expect(a.pistas).toHaveLength(3);
      expect(plano(a.enunciado)).toMatch(/^En este montaje de la figura .* Mida con el polímetro/);
    }
  });

  test('cada avería se ve al medir (simulada aquí) y ninguna otra de su circuito da las mismas medidas', async () => {
    const datos = new Map<string, { esquemas: unknown[] }>();
    for (const a of averias) {
      const d = datos.get(a.fuente.datos) ?? J<{ esquemas: unknown[] }>(a.fuente.datos);
      datos.set(a.fuente.datos, d);
      const esq = d.esquemas[a.fuente.esquema] as Parameters<typeof netlistAveria>[0];
      const correr = async (av: Parameters<typeof netlistAveria>[1]) => {
        const { texto, meta } = netlistAveria(esq, av);
        return resultadoFigura(esq, meta, await simularTexto(texto));
      };
      const mal = await correr(a.averia);
      expect(mal, a.id).not.toBeNull();
      const sano = (esq as { simulacion: { op: Parameters<typeof tensionEntre>[0] } }).simulacion.op;
      const masa = a.puntos.find((p) => p.masa)!.nodo;
      // the key point reveals it against the book's healthy circuit
      expect(difiere(tensionEntre(sano, a.clave, masa)!, tensionEntre(mal, a.clave, masa)!, 'V'), a.id).toBe(true);
      // unambiguous: every other fault of every part gives other readings somewhere
      const vec = (r: typeof mal) => [...a.puntos.map((p) => tensionEntre(r, p.nodo, masa) ?? NaN), ...a.ramas.map((x) => corrienteDe(r, x.id) ?? 0)];
      const v = vec(mal);
      for (const pz of a.piezas)
        for (const tipo of pz.tipos) {
          if (pz.id === a.averia.elemento && tipo === a.averia.tipo) continue;
          const otro = await correr({ elemento: pz.id, tipo }).catch(() => null);
          if (!otro) continue;
          const w = vec(otro);
          const igual = v.every((x, i) => Math.abs(x - w[i]!) <= (i >= a.puntos.length ? Math.max(1e-6, 0.02 * Math.abs(w[i]!)) : Math.max(0.05, 0.02 * Math.abs(w[i]!))));
          expect(igual, `${a.id} se confunde con ${pz.id} ${tipo}`).toBe(false);
        }
    }
  });

  test('la avería en la netlist: abierta, corto, valor, diodo al revés, base abierta; y la puntuación', () => {
    const esq = J<{ esquemas: Parameters<typeof netlistAveria>[0][] }>('datos/45.2.json').esquemas[0]!;
    const linea = (t: string, n: string) => t.split('\n').find((l) => l.startsWith(n + ' ')) ?? '';
    expect(linea(netlistAveria(esq, { elemento: 'E3', tipo: 'abierta' }).texto, 'r_e3')).toMatch(/ 1e\+12$/);
    expect(linea(netlistAveria(esq, { elemento: 'E3', tipo: 'alto' }).texto, 'r_e3')).toMatch(/ 3000$/);
    expect(linea(netlistAveria(esq, { elemento: 'E3', tipo: 'bajo' }).texto, 'r_e3')).toMatch(/ 30$/);
    expect(netlistAveria(esq, { elemento: 'E3', tipo: 'corto' }).texto).toContain('r_averia e3_start e3_end 1m');
    expect(linea(netlistAveria(esq, { elemento: 'E5', tipo: 'reves' }).texto, 'd_e5')).toBe('d_e5 e5_end e5_start DLED');
    expect(netlistAveria(esq, { elemento: 'E5', tipo: 'abierta' }).texto).toContain('* d_e5 abierto');
    const q = J<{ esquemas: Parameters<typeof netlistAveria>[0][] }>('datos/6.11.json').esquemas[0]!;
    const tq = netlistAveria(q, { elemento: 'E1', tipo: 'base-abierta' }).texto;
    expect(linea(tq, 'q_e1')).toBe('q_e1 e1_collector e1_bo e1_emitter Q2N3904');
    expect(tq).toContain('r_averia e1_bo 0 1e12');
    expect(netlistAveria(q, { elemento: 'E1', tipo: 'corto' }).texto).toContain('r_averia e1_collector e1_emitter 1m');
    expect(() => netlistAveria(esq, { elemento: 'E1', tipo: 'abierta' })).toThrow();
    expect(averiasDe('C')).toEqual([]);
    expect(puntuacion(1, true, true)).toBe(100);
    expect(puntuacion(5, true, true)).toBe(90);
    expect(puntuacion(2, true, false)).toBe(60);
    expect(puntuacion(30, true, true)).toBe(20);
    expect(puntuacion(1, false, true)).toBe(0);
    // review 10d: a wrong diagnosis first costs points (the wrong part, then the right one ≠ 100)
    expect(puntuacion(0, true, true, 1)).toBe(75);
    expect(puntuacion(0, true, false, 1)).toBe(35);
    expect(puntuacion(10, true, true, 3)).toBe(20);
    expect(difiere(4, 0, 'V')).toBe(true);
    expect(difiere(4, 3.9, 'V')).toBe(false);
    expect(difiere(0.001, 0.0011, 'A')).toBe(false);
  });
});

// ------------------------------------------------------------------ «¿Qué seguridad tiene?»

test.describe('seguridad de las respuestas (sin navegador)', () => {
  const T = Date.UTC(2026, 0, 5, 12);
  const r = (e: [number, 'sabia' | 'dudaba' | 'adivinado'][]): RegistroSeguridad => ({ e, t: Math.max(...e.map((x) => x[0])) });

  test('la unión es conmutativa, asociativa e idempotente, y el mismo instante se queda con el más prudente', () => {
    const a = r([[T, 'sabia'], [T + 5, 'dudaba']]);
    const b = r([[T + 1, 'adivinado'], [T + 5, 'adivinado']]);
    const c = r([[T + 9, 'sabia']]);
    expect(unirSeguridad(a, b)).toEqual(unirSeguridad(b, a));
    expect(unirSeguridad(unirSeguridad(a, b), c)).toEqual(unirSeguridad(a, unirSeguridad(b, c)));
    expect(unirSeguridad(a, a)).toEqual(a);
    expect(unirSeguridad(a, b).e).toEqual([[T, 'sabia'], [T + 1, 'adivinado'], [T + 5, 'adivinado']]);
    expect(unirSeguridad(a, b).t).toBe(T + 5);
    let x: RegistroSeguridad | undefined;
    for (let i = 0; i < 20; i++) x = anotarSeguridad(x, T + i, 'sabia');
    expect(x!.e).toHaveLength(12);
    expect(x!.e[0]![0]).toBe(T + 8);
    expect(seguridadValida(x)).toBe(true);
    expect(seguridadValida({ e: [], t: 1 })).toBe(false);
    expect(seguridadValida({ e: [[1, 'quizas']], t: 1 })).toBe(false);
  });

  test('un toque vale para su ronda: el último hecho durante ella o hasta 30 minutos después', () => {
    const reg = r([[T + 2 * 60_000, 'adivinado'], [T + 3 * 60_000, 'dudaba'], [T + 2 * 3_600_000, 'sabia']]);
    expect(nivelDeRonda(reg, T)).toBe('dudaba');
    expect(nivelDeRonda(reg, T + 2 * 3_600_000 - 10 * 60_000)).toBe('sabia');
    expect(nivelDeRonda(reg, T - 3_600_000)).toBeNull();
    expect(nivelDeRonda(undefined, T)).toBeNull();
    // review 10d: the next round of the item takes over (a tap counts for one round only)
    expect(nivelDeRonda(reg, T, T + 2 * 60_000 + 30_000)).toBeNull();
    // (its window starts a minute before it: the tap at +3 min belongs to a round starting at +3 min 30 s)
    expect(nivelDeRonda(reg, T, T + 3 * 60_000 + 30_000)).toBe('adivinado');
    expect(nivelDeRonda(reg, T, T + 4 * 60_000 + 1000)).toBe('dudaba');
  });

  test('en el repaso espaciado: «He adivinado» es casi un fallo, «Dudaba» acorta el intervalo y «Lo sabía» no cambia nada', () => {
    const DIA = 86_400_000;
    // three questions of a section, right on two different days
    const items = Object.fromEntries(
      [1, 2, 3].map((i) => [`cap01-0${i}`, { s: 'cap01/sec-1.4', c: 'q' as const, r: [[T + i * 1000, 100], [T + 2 * DIA + i * 1000, 100]] as [number, number][] }]),
    );
    const con = (s: 'sabia' | 'dudaba' | 'adivinado') =>
      ajustarRegistros(items, Object.fromEntries(Object.keys(items).map((k, i) => [k, r([[T + 2 * DIA + (i + 1) * 1000 + 60_000, s]])])));
    const ahora = T + 2 * DIA + 3_600_000;
    const base = repasoDe(dominioConcepto('cap01/sec-1.4', Object.values(items), ahora));
    const sabia = repasoDe(dominioConcepto('cap01/sec-1.4', Object.values(con('sabia')), ahora));
    const dudaba = repasoDe(dominioConcepto('cap01/sec-1.4', Object.values(con('dudaba')), ahora));
    const adivinado = dominioConcepto('cap01/sec-1.4', Object.values(con('adivinado')), ahora);
    expect(con('sabia')).toBe(items); // no change: the same object
    expect(sabia).toEqual(base);
    expect(base.k).toBe('fecha');
    expect(dudaba.k).toBe('fecha');
    if (base.k === 'fecha' && dudaba.k === 'fecha') expect(dudaba.t - (T + 2 * DIA)).toBeCloseTo((base.t - (T + 2 * DIA)) / 2, -4);
    // guessed: accuracy falls and the day is no success (like a near miss)
    expect(adivinado.precision).toBeLessThan(dominioConcepto('cap01/sec-1.4', Object.values(items), ahora).precision - 0.2);
    expect(adivinado.estabilidad).toBeLessThan(dominioConcepto('cap01/sec-1.4', Object.values(items), ahora).estabilidad);
    // a wrong round is never changed
    const malo = { x: { s: 'a/b', c: 'q' as const, r: [[T, 0]] as [number, number][] } };
    expect(ajustarRegistros(malo, { x: r([[T + 1000, 'adivinado']]) })).toBe(malo);
  });
});

test('seguridad en el motor real: dos dispositivos y dos pestañas unen los toques (escenarios b10)', async () => {
  test.setTimeout(300_000);
  const salida = await new Promise<string>((ok, mal) =>
    execFile(
      process.execPath,
      ['--experimental-transform-types', '--no-warnings', '--import', './tests/motor-real/registrar.mjs', 'tests/motor-real/correr.ts', 'casos', 'b10'],
      { cwd: web, maxBuffer: 64 << 20 },
      (e, out) => (e ? mal(e) : ok(out)),
    ),
  );
  const r = JSON.parse(salida.trim().split('\n').pop()!) as { nombre: string; ok: boolean; error?: string }[];
  expect(r.length).toBe(1);
  expect(r.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
});

test('revisión 10d: los textos de la práctica generados y sus nombres hablan de usted', () => {
  const tu = /^(Toca|Une|Ajusta|Ordena|Calcula|Señala|Completa|Predice)\b|\bSi (duplicas|reduces)\b|\b(Ponlo|colócala)\b/;
  for (const it of items) expect(plano(it.enunciado), it.id).not.toMatch(tu);
  const datos = fs.readFileSync(path.join(web, 'src', 'componentes', 'practica', 'datos.ts'), 'utf8');
  const nombres = /NOMBRE_TIPO[^{]*\{([^}]*)\}/.exec(datos)![1]!;
  expect(nombres).not.toMatch(/'(Calcula|Predice y comprueba|Ajusta|Señala en el esquema|Ordena|Une las parejas|Completa el montaje)'/);
  expect(nombres).toContain("prediccion: 'Prediga y compruebe'");
});
