// 1.2 engine requests done by motor12e, in Node (no browser, no server) on the catalogue lesson
// tests/lecciones12-catalogo/cap01/sec-1.12.yaml: «ajuste» with a band open on one side and with two controls; the
// numbers of a book table read cell by cell; erfc, erf and a seeded noise in the model's language; graphs with
// parametric curves, stems, an equal aspect and curves hidden in a prediction; tick labels with the figures their axis
// needs; and the small ones (a decimal comma in a YAML flow list, a «lista» control in a design, an equation inside a
// review «tarjeta», named cycles in a timing diagram). The walker's own cases (a design whose first nominal solution
// fails with the tolerances, a fault «al azar») are walked in the browser with EPA_RECORRER_CATALOGO=1
// (tests/lecciones11-recorrido.spec.ts).
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones12-motor12e.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, textoDeBloque, valoresSerie, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import { compilarModelo, enRango } from '../src/lib/leccion11/modelo.ts';
import { numerosDe } from '../src/lib/leccion11/texto.ts';
import { cifrasEje, etiquetasEje, geometriaGrafica } from '../src/lib/leccion11/ejes.ts';
import { compilar, erfc, ruido } from '../src/componentes/calculadoras/expresion.ts';
import { comprobar, nuevoEstado, valoresSueltos } from '../src/lib/leccion11/motor.ts';
import { valoresDeTarjeta } from '../src/lib/leccion11/modelo.ts';
import { analizarDiseno } from '../src/lib/leccion12/tolerancias.ts';
import { exploracion12, ladoAjuste } from '../src/lib/leccion12/motor12.ts';
import type { Leccion11, Tarjeta, WidgetGrafica } from '../src/lib/leccion11/tipos.ts';
import type { Ajuste, Diseno } from '../src/lib/leccion12/tipos.ts';
import type { WidgetFigura, WidgetLogica } from '../src/lib/leccion12/digital/tipos.ts';
import { cronograma, iniciar, leer, poner } from '../src/lib/leccion12/digital/logica.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { recursosLibro } from '../scripts/recursos11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bloques = (p: string) => {
  const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
};
const contexto: ContextoLibro = { bloques, recursos: recursosLibro(path.join(web, 'public', 'libro'), path.join(web, 'public')) };
type F = { libro: Record<string, string>; modelo: Record<string, any>; tarjetas: Record<string, any>[] };
const FUENTE = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap01', 'sec-1.12.yaml'), 'utf8')) as F;
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const generar = (f: unknown) => generarLeccion(f, contexto, 'catalogo-motor12e');
const tarjetaDe = (f: F, id: string) => f.tarjetas.find((t) => t.id === id)!;
function con(cambio: (f: F) => void) {
  const f = copia(FUENTE);
  cambio(f);
  return generar(f);
}
const R = generar(FUENTE);
const L = R.leccion as Leccion11;
const mc = compilarModelo(L.modelo);
const T = (id: string) => L.tarjetas.find((t) => t.id === id)!;
const k = (id: string) => L.tarjetas.findIndex((t) => t.id === id);
const valoresDe = (t: Tarjeta) => valoresDeTarjeta(t, valoresSueltos(L, k(t.id)));

test('la lección del catálogo de motor12e se genera sin errores', () => {
  expect(R.errores).toEqual([]);
  // (no warnings of its own beyond the sequence's: a catalogue has no «porque»)
  expect(R.avisos.filter((a) => !/no hay ninguna tarjeta/.test(a))).toEqual([]);
});

test.describe('recorrido: los casos que el recorredor sabe ya seguir', () => {
  test('diseño: la primera solución nominal (2,7 kΩ y 1 kΩ) no aprueba con el 1 %; otra sí', () => {
    // (the walker used to take the first nominal one and expect «bien»: autor-digital-E, autor-potencia-A, autor-senales-C)
    const t = T('disene-tolerancias');
    const d = t.actividad as Diseno;
    const v = { ...valoresDe(t), R_1: 2700, R_2: 1000 };
    const inf = analizarDiseno(mc, d, t.condiciones!, v);
    expect(inf.nominal).toBe(true);
    expect(inf.pasa).toBe(false);
    expect(analizarDiseno(mc, d, t.condiciones!, { ...v, R_1: 3900, R_2: 1500 }).pasa).toBe(true);
  });
  test('avería al azar: la elección es «azar» y las dos primeras sondas separan las tres averías', () => {
    const a = T('averia-azar').actividad as { eleccion: string; sondas: { id: string }[] };
    expect(a.eleccion).toBe('azar');
    expect(a.sondas.slice(0, 2).map((s) => s.id)).toEqual(['salida', 'corriente']);
  });
});

test.describe('ajuste: banda abierta y dos mandos', () => {
  test('solo max: dentro por debajo, «alto» por encima; nunca «bajo»', () => {
    const t = T('ajuste-consumo');
    const a = t.actividad as Ajuste;
    expect(a.banda).toEqual({ valor: 'I', max: 0.002 });
    expect(a.bajo).toEqual([]);
    const r = (R_1: number) => mc.evaluar({ ...valoresDe(t), R_1 });
    expect(ladoAjuste(a, r(1000))).toBe('alto');
    expect(exploracion12(t, r(1000))).toBe(false);
    expect(ladoAjuste(a, r(10000))).toBe('dentro');
    expect(exploracion12(t, r(10000))).toBe(true);
    // the meter's scale: what the control reaches, never below 0 A
    expect(a.escala.min).toBeGreaterThanOrEqual(0);
    expect(a.escala.max).toBeGreaterThan(12 / (100 + 1800));
  });
  test('solo min: «bajo» por debajo, dentro por encima; la escala no baja de 0 V', () => {
    const t = T('ajuste-minimo');
    const a = t.actividad as Ajuste;
    expect(a.banda).toEqual({ valor: 'V_out', min: 3.3 });
    const r = (R_2: number) => mc.evaluar({ ...valoresDe(t), R_2 });
    expect(ladoAjuste(a, r(1000))).toBe('bajo');
    expect(ladoAjuste(a, r(5000))).toBe('dentro');
    expect(a.escala.min).toBe(0);
  });
  test('dos mandos: una posición de los dos dentro de la banda', () => {
    const t = T('ajuste-dos');
    const a = t.actividad as Ajuste;
    expect(t.widget!.mandos.map((m) => m.valor)).toEqual(['R_1', 'R_2']);
    expect(enRango(a.banda, mc.evaluar({ ...valoresDe(t), R_1: 4000, R_2: 1500 }))).toBe(true);
    expect(enRango(a.banda, mc.evaluar(valoresDe(t)))).toBe(false);
  });
  test('reglas: siempre dentro, consejos del lado abierto, banda cerrada sin sus consejos', () => {
    expect(con((f) => (tarjetaDe(f, 'ajuste-consumo').ajuste.max = 1)).errores).toContainEqual(expect.stringMatching(/empieza ya dentro|dentro de la banda en todas las posiciones/));
    expect(con((f) => (tarjetaDe(f, 'ajuste-consumo').ajuste.bajo = 'Nunca.')).avisos).toContainEqual(expect.stringMatching(/ajuste\.bajo.*no tiene «min»/));
    expect(con((f) => delete tarjetaDe(f, 'ajuste-dos').ajuste.bajo).errores).toContainEqual(expect.stringMatching(/ajuste\.bajo/));
    expect(con((f) => delete tarjetaDe(f, 'ajuste-minimo').ajuste.bajo).errores).toContainEqual(expect.stringMatching(/ajuste\.bajo/));
  });
});

test.describe('números de una tabla del libro', () => {
  test('las celdas vecinas no se juntan en un número con separador de miles', () => {
    // (autor-placas-B: the FMEA table of cap46, block 499, read «4 5 5 100» as «5 100»)
    const tabla = bloques('cap46')![499];
    const juntas = numerosDe(textoDeBloque(tabla)).map((n) => n.v);
    const separadas = numerosDe(textoDeBloque(tabla, ' | ')).map((n) => n.v);
    expect(juntas).toContain(5100);
    expect(separadas).not.toContain(5100);
    for (const v of [9, 3, 7, 189, 4, 5, 100, 8, 120, 168]) expect(separadas).toContain(v);
    // a quote is still looked for in the plain text
    expect(textoDeBloque({ t: 'tabla', filas: [['a', '90,9 Ω']] })).toBe('a 90,9 Ω');
  });
  test('un «189» de la tabla citada vale en una tarjeta; sin citarla, no', () => {
    const r = con((f) => {
      f.libro['cap46#499'] = 'Condensador de filtro';
      tarjetaDe(f, 'explore-erfc').nota = 'El RPN más alto de la tabla FMEA es 189.';
      tarjetaDe(f, 'explore-erfc').libro.push('cap46#499');
    });
    expect(r.errores).toEqual([]);
    expect(con((f) => (tarjetaDe(f, 'explore-erfc').nota = 'El RPN más alto de la tabla FMEA es 189.')).errores).toContainEqual(expect.stringMatching(/el número 189 no está/));
  });
});

test.describe('lenguaje del modelo', () => {
  test('erfc y erf: colas exactas; asin, acos y log2', () => {
    expect(erfc(0)).toBeCloseTo(1, 6);
    expect(Math.abs(erfc(1) / 0.157299207050285 - 1)).toBeLessThan(1.2e-7);
    expect(Math.abs(erfc(3) / 2.209049699858544e-5 - 1)).toBeLessThan(1.2e-7);
    expect(Math.abs(erfc(5) / 1.537459794428035e-12 - 1)).toBeLessThan(1.2e-7);
    expect(erfc(-1)).toBeCloseTo(2 - 0.157299207050285, 7);
    expect(compilar('erf(1)')({})).toBeCloseTo(0.842700792949715, 7);
    // BPSK: Q(√(2·Eb/N0)) at 9,6 dB is about 10⁻⁵ (problem 30.C territory)
    expect(compilar('0.5*erfc(sqrt(10^(0.96)))')({})).toBeCloseTo(1.0e-5, 6);
    expect(compilar('asin(0.5)*180/pi')({})).toBeCloseTo(30, 10);
    expect(compilar('acos(0.5)*180/pi')({})).toBeCloseTo(60, 10);
    expect(compilar('log2(1024)')({})).toBe(10);
  });
  test('ruido(x, semilla): determinista, normal de media 0 y desviación 1, blanco', () => {
    expect(ruido(1, 7)).toBe(ruido(1, 7));
    expect(ruido(1, 7)).not.toBe(ruido(1, 8));
    expect(ruido(1, 7)).not.toBe(ruido(2, 7));
    expect(Number.isNaN(ruido(NaN, 1))).toBe(true);
    const xs = Array.from({ length: 20000 }, (_, n) => ruido(n, 3));
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    expect(Math.abs(m)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
    let r1 = 0;
    for (let n = 1; n < xs.length; n++) r1 += (xs[n]! - m) * (xs[n - 1]! - m);
    expect(Math.abs(r1 / xs.length / sd ** 2)).toBeLessThan(0.03);
    // (the same along a time axis sampled finely: each instant its own draw)
    expect(compilar('ruido(t, 7)')({ t: 0.001 })).toBe(ruido(0.001, 7));
  });
});

test.describe('gráficas', () => {
  test('paramétricas, palitos, aspecto igual y curvas ocultas, en los datos publicados', () => {
    const lis = T('explore-lissajous').widget as WidgetGrafica;
    expect(lis.aspecto).toBe('igual');
    expect(lis.curvas[0]).toMatchObject({ x: 'cos(th)', expr: 'cos(th - phi*pi/180)', param: { id: 'th', min: '0', max: '2*pi', muestras: 240 } });
    const pal = T('explore-palitos').widget as WidgetGrafica;
    expect(pal.curvas.map((c) => c.palitos)).toEqual([{ paso: 1 }, { paso: 1 }]);
    const pred = T('prediga-curva').widget as WidgetGrafica;
    expect(pred.ocultar).toBe(true);
    expect(pred.curvas.every((c) => c.oculta) && pred.marcas!.every((m) => m.oculta)).toBe(true);
    // (no «ocultar sin lectura» warning: the hidden curves are what is hidden)
    expect(R.avisos.some((a) => /prediga-curva.*sin «lectura»/.test(a))).toBe(false);
  });
  test('aspecto igual: una unidad mide lo mismo en x que en y', () => {
    const lis = T('explore-lissajous').widget as WidgetGrafica;
    const g = geometriaGrafica(lis.x, lis.y, 12, 'igual');
    const ux = (g.x.max - g.x.min) / g.ancho;
    const uy = (g.y.max - g.y.min) / g.alto;
    expect(Math.abs(ux / uy - 1)).toBeLessThan(0.01);
    // the shorter range was widened about its centre; nothing was cut
    expect(g.x.min).toBeLessThanOrEqual(lis.x.min);
    expect(g.x.max).toBeGreaterThanOrEqual(lis.x.max);
    expect((g.x.min + g.x.max) / 2).toBeCloseTo(0, 9);
  });
  test('reglas de las curvas nuevas', () => {
    const lis = (c: (o: any) => void) => con((f) => c(tarjetaDe(f, 'explore-lissajous').widget)).errores;
    const pal = (c: (o: any) => void) => con((f) => c(tarjetaDe(f, 'explore-palitos').widget)).errores;
    expect(lis((w) => (w.curvas[0].param.id = 'phi'))).toContainEqual(expect.stringMatching(/param\.id: un nombre que no esté en el modelo/));
    expect(lis((w) => (w.curvas[0].param.max = 0))).toContainEqual(expect.stringMatching(/param: min < max/));
    expect(lis((w) => (w.curvas[0].x = 'cos(th) + 0.1'))).toEqual([]);
    expect(lis((w) => (w.curvas[0].x = 'cos(th) + 50'))).toContainEqual(expect.stringMatching(/queda fuera de los ejes/));
    expect(lis((w) => (w.curvas[0].y = 'u'))).toContainEqual(expect.stringMatching(/«u» no está en el modelo/));
    expect(lis((w) => delete w.curvas[0].param)).toContainEqual(expect.stringMatching(/«x» e «y» solo en una curva paramétrica/));
    expect(lis((w) => (w.y.unidad = 'A'))).toContainEqual(expect.stringMatching(/aspecto: igual» necesita la misma unidad/));
    expect(lis((w) => Object.assign(w.x, { min: 0.1, escala: 'log' }))).toContainEqual(expect.stringMatching(/aspecto: igual» necesita los dos ejes lineales/));
    expect(pal((w) => (w.curvas[0].paso = 0.01))).toContainEqual(expect.stringMatching(/más de 400 palitos/));
    expect(pal((w) => (w.curvas[0].discontinua = true))).toContainEqual(expect.stringMatching(/«palitos» no va con «discontinua»/));
    expect(pal((w) => (delete w.curvas[0].palitos, (w.curvas[0].paso = 2)))).toContainEqual(expect.stringMatching(/paso: solo con «palitos: true»/));
    expect(pal((w) => (w.curvas[0].oculta = true))).toContainEqual(expect.stringMatching(/«oculta» en una curva o marca de un widget sin «ocultar»/));
    expect(con((f) => (tarjetaDe(f, 'ajuste-dos').widget.ocultar = 'curvas')).errores).toContainEqual(expect.stringMatching(/ocultar: curvas» necesita una gráfica/));
    expect(con((f) => (tarjetaDe(f, 'prediga-curva').widget.ocultar = 'todo')).errores).toContainEqual(expect.stringMatching(/widget\.ocultar»: true, false o curvas/));
  });
  test('marcas de los ejes: las cifras que hacen falta para que dos vecinas no se lean igual', () => {
    // (autor-taller-E: 99,8–100,4 mV gave «100 mV» on every tick)
    const e = { min: 0.0998, max: 0.1004, unidad: 'V' };
    expect(cifrasEje(e)).toBeGreaterThan(2);
    const t = etiquetasEje(e, (v) => v * 1e5, false).map((x) => x.texto);
    expect(new Set(t).size).toBe(t.length);
    // (trailing zeros are dropped as everywhere: «10 A» between «9,998 A» and «10,002 A»)
    expect(etiquetasEje({ min: 9.994, max: 10.002, unidad: 'A' }, (v) => v * 1e4, false).map((x) => x.texto.replace(/\s/gu, ' '))).toEqual(['9,994 A', '9,996 A', '9,998 A', '10 A', '10,002 A']);
    // an ordinary axis keeps its two figures
    expect(cifrasEje({ min: 0, max: 12, unidad: 'V' })).toBe(2);
    expect(etiquetasEje({ min: 0, max: 12, unidad: 'V' }, (v) => v * 30, false).map((x) => x.texto.replace(/\s/gu, ' '))).toEqual(['0', '5 V', '10 V']);
  });
});

test.describe('peticiones pequeñas', () => {
  test('nombres partidos por una coma decimal en una lista de YAML: el error lo dice', () => {
    const r = con((f) => (tarjetaDe(f, 'ajuste-dos').widget.mandos[0] = { valor: 'R_1', lista: [1000, 2000], nombres: parse('[2 m de 0,5 mm², 4 m]') }));
    expect(r.errores).toContainEqual(expect.stringMatching(/nombres: un texto por cada valor.*coma decimal sin comillas/));
    const s = con((f) => (tarjetaDe(f, 'ajuste-dos').widget.mandos[0] = { valor: 'R_1', lista: [1000, 2000], nombres: ['uno'] }));
    expect(s.errores).toContainEqual(expect.stringMatching(/nombres: un texto por cada valor de «lista», en el mismo orden$/));
  });
  test('diseño con un mando de «lista» (un catálogo): sin el aviso de la serie E', () => {
    const r = con((f) => {
      const t = tarjetaDe(f, 'disene-tolerancias');
      t.widget.mandos = [{ valor: 'R_1', lista: [2700, 3900, 4700], nombres: ['pequeña', 'mediana', 'grande'] }, { valor: 'R_2', lista: [1000, 1500] }];
      t.inicio = { R_1: 4700, R_2: 1000 };
    });
    expect(r.errores).toEqual([]);
    expect(r.avisos.some((a) => /sin un mando de serie/.test(a))).toBe(false);
    const s = con((f) => {
      const t = tarjetaDe(f, 'disene-tolerancias');
      t.widget.mandos = [{ valor: 'R_1', min: 1000, max: 10000, paso: 100 }, { valor: 'R_2', min: 1000, max: 2000, paso: 100 }];
    });
    expect(s.avisos).toContainEqual(expect.stringMatching(/sin un mando de serie E6\/E12\/E24 ni de «lista»/));
    // (autor-proyectos-A: the electrolytics' E6 series)
    expect(valoresSerie(1e-4, 1e-3, 'E6').map((v) => Number(v.toPrecision(3)))).toEqual([1e-4, 1.5e-4, 2.2e-4, 3.3e-4, 4.7e-4, 6.8e-4, 1e-3]);
    const e6 = con((f) => (tarjetaDe(f, 'disene-tolerancias').widget.mandos[0] = { valor: 'R_1', serie: 'E6', min: 1000, max: 10000 }));
    expect(e6.leccion?.tarjetas.find((t) => t.id === 'disene-tolerancias')?.widget?.mandos[0]).toMatchObject({ serie: 'E6', valores: [1000, 1500, 2200, 3300, 4700, 6800, 10000] });
  });
  test('fórmula con una ecuación de dentro de una «tarjeta» de repaso (cap53#338.1)', () => {
    const t = T('formula-cuadro');
    expect(t.ec?.libro).toBe('cap53#338');
    expect(t.ec?.fuente).toMatch(/^R_\("□"\) = \(ρ\)\/\(t\)/);
    expect(con((f) => (tarjetaDe(f, 'formula-cuadro').ec = 'cap53#338.2')).leccion?.tarjetas.find((x) => x.id === 'formula-cuadro')?.ec?.fuente).toMatch(/"Δ" V = I/);
    expect(con((f) => (tarjetaDe(f, 'formula-cuadro').ec = 'cap53#338.3')).errores).toContainEqual(expect.stringMatching(/tiene 2 ecuaciones dentro/));
    expect(con((f) => (tarjetaDe(f, 'formula-cuadro').ec = 'cap53#338')).errores).toContainEqual(expect.stringMatching(/no es una ecuación.*«n\.k»/));
  });
  test('cronograma con nombres de ciclo', () => {
    const w = T('explore-ciclos').widget as unknown as WidgetLogica;
    expect(w.cronograma?.etiquetas).toEqual(['reposo', 'inicio', 'dato', 'fin']);
    expect(con((f) => (tarjetaDe(f, 'explore-ciclos').widget.cronograma.etiquetas = ['a', 'b'])).errores).toContainEqual(expect.stringMatching(/cronograma\.etiquetas»: 4 nombres/));
    expect(con((f) => (tarjetaDe(f, 'explore-ciclos').widget.cronograma.etiquetas = ['reposo', 'inicio', 'dato', 'demasiado'])).errores).toContainEqual(expect.stringMatching(/hasta 6 caracteres/));
  });
  test('simular sin circuito: se comprueba con el modelo (la estimación buena acierta)', () => {
    const t = T('simule-modelo');
    expect((t.actividad as { medida?: string }).medida).toBeUndefined();
    const e = { ...nuevoEstado(t), actividad: { tipo: 'simular' as const, texto: '1,85 mA', valor: 0.00185 } };
    expect(comprobar(L, t, e, valoresDe(t)).aviso.bien).toBe(true);
  });
});

test.describe('si da tiempo: listado de código y cerrojo D', () => {
  test('un listado del libro como figura: líneas, resaltadas, zonas de líneas; y sus reglas', () => {
    const w = T('pregunta-relleno').widget as unknown as WidgetFigura;
    expect(w.fuente.origen).toBe('codigo');
    expect(w.fuente.codigo?.lineas).toHaveLength(13);
    expect(w.fuente.codigo?.lineas[4]).toBe('    uint32_t instante;');
    expect(w.fuente.codigo?.resaltar).toEqual([3, 4, 5, 6, 7]);
    expect(w.zonas).toEqual([]);
    const z = (T('toque-campo').widget as unknown as WidgetFigura).zonas;
    expect(z.map((q) => q.lineas)).toEqual([[4, 4], [5, 5], [6, 6]]);
    // a zone covers its line: the second one sits right under the first
    expect(z[1]!.rects[0]![1] - z[0]!.rects[0]![1]).toBe(z[0]!.rects[0]![3]);
    const tc = (c: (w: any) => void) => con((f) => c(tarjetaDe(f, 'toque-campo').widget)).errores;
    expect(tc((w) => (w.codigo = 'apK#19'))).toContainEqual(expect.stringMatching(/no es un bloque de código del libro/));
    expect(tc((w) => (w.zonas[0].lineas = [14]))).toContainEqual(expect.stringMatching(/lineas»: \[primera, última\].*entre 1 y 13/));
    expect(tc((w) => (w.zonas[0].rect = [0, 0, 10, 10]))).toContainEqual(expect.stringMatching(/en un listado, una zona son líneas/));
    expect(tc((w) => (w.resaltar = [0]))).toContainEqual(expect.stringMatching(/resaltar»: números de línea/));
    expect(tc((w) => (w.codigo = { lenguaje: 'c', texto: 'a;\nb;\nc;\nint x; // one\nint y;\nint z;' }))).toEqual([]);
    expect(con((f) => (tarjetaDe(f, 'toque-campo').widget = { tipo: 'figura', figura: 'fig-13.5', resaltar: [1], zonas: [{ id: 'a', rect: [0, 0, 50, 50], rotulo: 'A' }] })).errores).toContainEqual(expect.stringMatching(/resaltar»: solo con «codigo»/));
  });
  test('cerrojo D: transparente con EN alto, guarda con EN bajo; en el cronograma va medio ciclo antes que el biestable', () => {
    const w = T('explore-latch').widget as unknown as WidgetLogica;
    const c = w.circuito;
    // (EN = NOT CLK: transparent while the clock is low)
    let s = iniciar(c, null, { CLK: 0, D: 0 });
    s = poner(c, s, { D: 1 });
    expect(leer(s, 'l1.q')).toBe(1);
    expect(leer(s, 'f1.q')).toBe(0);
    s = poner(c, s, { CLK: 1 });
    expect(leer(s, 'f1.q')).toBe(1);
    s = poner(c, s, { D: 0 });
    expect(leer(s, 'l1.q')).toBe(1); // held: EN is low while the clock is high
    const cr = cronograma(c, 4, w.cronograma!.estimulo);
    const ql = cr.tramos.map((x) => x['l1.q']);
    const qf = cr.tramos.map((x) => x['f1.q']);
    expect(ql).toEqual([0, 0, 1, 1, 1, 1, 0, 0]);
    expect(qf).toEqual([0, 0, 0, 1, 1, 1, 1, 0]);
  });
});
