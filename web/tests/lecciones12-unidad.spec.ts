// 1.2 learning-by-doing step types, in Node (no browser, no server): seeded randomness, the estimate's reading and
// its typical errors, the design's corners and Monte Carlo boards, the fault finding (rounds, probes, telling the
// faults apart, why a wrong suspect is not it), the drawing's error metric, the SQL sandbox (the sample database of
// section 17.10, the book's own query, errors in Spanish, comparing results), the generator's checks of each type
// (each rule broken on purpose) and the engine's rules through lib/leccion11/motor.ts (check, retry, gating, hint
// ladder, practicable cards, the fault laid over the widget). Every numeric check is deterministic.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones12-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import { compilarModelo, valoresDeTarjeta } from '../src/lib/leccion11/modelo.ts';
import { botonPrincipal, comprobar, esComprobable, esPracticable, eventoDeComprobacion, nuevoEstado, reintentar, valoresSueltos, type EstadoTarjeta } from '../src/lib/leccion11/motor.ts';
import { textoPlano } from '../src/lib/leccion11/texto.ts';
import type { Leccion11, Tarjeta } from '../src/lib/leccion11/tipos.ts';
import { generador, semillaDe } from '../src/lib/leccion12/azar.ts';
import { diagnosticar, leerEstimacion } from '../src/lib/leccion12/prediccion.ts';
import { analizarDiseno, placas } from '../src/lib/leccion12/tolerancias.ts';
import { falloDeRonda, faltaSeparar, lecturas, porQueNo } from '../src/lib/leccion12/averia.ts';
import { compararDibujo, rellenar, xsDibujo } from '../src/lib/leccion12/dibujo.ts';
import { compararResultados, explicarError, rellenarPlantilla } from '../src/lib/leccion12/sql/ejecutar.ts';
import { filasMuestra } from '../src/lib/leccion12/sql/muestra.ts';
import { sqlNode } from '../src/lib/leccion12/sql/node.ts';
import { otraAveria } from '../src/lib/leccion12/motor12.ts';
import type { Averia, Dibujar, Diseno, EstadoAveria, Simular } from '../src/lib/leccion12/tipos.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();
const sql = await sqlNode();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
  sql,
};
const FUENTE = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap01', 'sec-1.4.yaml'), 'utf8')) as Fuente;
type Fuente = { tarjetas: Record<string, Record<string, unknown>>[] & Record<string, unknown>[] };
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const generar = (f: unknown) => generarLeccion(f, contexto, 'catalogo12');
function errores(cambio: (f: { tarjetas: Record<string, any>[] }) => void): string[] {
  const f = copia(FUENTE) as unknown as { tarjetas: Record<string, any>[] };
  cambio(f);
  return generar(f).errores;
}
const tarjetaDe = (f: { tarjetas: Record<string, any>[] }, id: string) => f.tarjetas.find((t) => t.id === id)!;
const R = generar(FUENTE);
const L = R.leccion as Leccion11;
const mc = L ? compilarModelo(L.modelo) : null!;
const T = (id: string) => L.tarjetas.find((t) => t.id === id)!;
const k = (id: string) => L.tarjetas.findIndex((t) => t.id === id);
const valoresDe = (t: Tarjeta, e?: EstadoTarjeta) => valoresDeTarjeta(t, valoresSueltos(L, k(t.id)), e);

test.describe('1.2: piezas puras', () => {
  test('azar con semilla: igual cada vez, distinto con otra semilla', () => {
    const a = generador(semillaDe('x'));
    const b = generador(semillaDe('x'));
    const xs = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(generador(semillaDe('y'))()).not.toBe(xs[0]);
  });

  test('estimación: se lee con su unidad y prefijos, coma decimal', () => {
    expect(leerEstimacion('4,2 V', 'V')).toBeCloseTo(4.2);
    expect(leerEstimacion('150 m', 'V')).toBeCloseTo(0.15);
    expect(leerEstimacion('4k7', 'Ω')).toBeCloseTo(4700);
    expect(leerEstimacion('3', 'V')).toBe(3);
    expect(Number.isNaN(leerEstimacion('tres', 'V'))).toBe(true);
  });

  test('esquinas: 2ⁿ placas en los extremos; Monte Carlo: las mismas placas cada vez, dentro de la tolerancia', () => {
    const d: Diseno = { tipo: 'diseno', tolerancias: { R_1: 0.05, R_2: 0.01 }, metodo: 'esquinas', muestras: 50, semilla: 7, exigir: 'todas' };
    const ps = placas(d, { R_1: 1000, R_2: 2000 });
    expect(ps).toHaveLength(4);
    expect(new Set(ps.map((p) => `${p.R_1}/${p.R_2}`))).toEqual(new Set(['950/1980', '1050/1980', '950/2020', '1050/2020']));
    const mcx = { ...d, metodo: 'montecarlo' as const };
    const a = placas(mcx, { R_1: 1000, R_2: 2000 });
    expect(a).toEqual(placas(mcx, { R_1: 1000, R_2: 2000 }));
    expect(a).toHaveLength(50);
    expect(a.every((p) => p.R_1! >= 950 && p.R_1! <= 1050 && p.R_2! >= 1980 && p.R_2! <= 2020)).toBe(true);
  });

  test('dibujo: la curva exacta da 0; un pequeño desfase y un pequeño escalón se perdonan; el doble de amplitud no', () => {
    const d: Dibujar = { tipo: 'dibujar', x: { id: 't', min: 0, max: 1, unidad: 's', rotulo: [] }, y: { min: -2, max: 2, unidad: 'V', rotulo: [] }, curva: 'sin(2*pi*t)', puntos: 25, tol: 0.1, holgura: 0.03, rotulo: [] };
    const f = (x: number) => Math.sin(2 * Math.PI * x);
    const xs = xsDibujo(d);
    expect(compararDibujo(d, xs.map(f), f).error).toBeLessThan(1e-9);
    const desplazada = compararDibujo(d, xs.map((x) => f(x - 0.02) + 0.05), f);
    expect(desplazada.bien).toBe(true);
    expect(desplazada.desfase).toBeGreaterThan(0);
    const doble = compararDibujo(d, xs.map((x) => 2 * f(x)), f);
    expect(doble.bien).toBe(false);
    expect(doble.amplitud).toBeCloseTo(2, 1);
    const alta = compararDibujo(d, xs.map((x) => f(x) + 1), f);
    expect(alta.bien).toBe(false);
    expect(alta.media).toBeCloseTo(0.25, 2);
    // gaps are filled by straight lines; the ends take the nearest point
    expect(rellenar([null, 1, null, 3, null])).toEqual([1, 1, 2, 3, 3]);
    expect(rellenar([null, null])).toBeNull();
  });

  test('dibujo con el eje x logarítmico (motor12b, el Bode de 24.3): puntos por décadas, desfase en décadas', () => {
    // a first-order low-pass with f_c = 1 kHz, from 10 Hz to 100 kHz (four decades)
    const d: Dibujar = { tipo: 'dibujar', x: { id: 'f', min: 10, max: 100000, unidad: 'Hz', rotulo: [], escala: 'log' }, y: { min: -45, max: 5, unidad: 'dB', rotulo: [] }, curva: '', puntos: 17, tol: 0.08, holgura: 0.03, rotulo: [] };
    const f = (x: number) => -10 * Math.log10(1 + (x / 1000) ** 2);
    const xs = xsDibujo(d);
    // evenly spaced in log x: 10, 17,8, 31,6 … 100 000 (four points per decade), the cut-off in the middle
    expect(xs[0]).toBeCloseTo(10, 9);
    expect(xs[16]).toBeCloseTo(100000, 6);
    expect(xs[8]).toBeCloseTo(1000, 6);
    expect(xs[1]! / xs[0]!).toBeCloseTo(10 ** 0.25, 9);
    expect(compararDibujo(d, xs.map(f), f).error).toBeLessThan(1e-9);
    // drawn a tenth of a decade late (a shift of 2,5 % of the axis): forgiven, and told as a positive shift
    const tarde = compararDibujo(d, xs.map((x) => f(x / 10 ** 0.1)), f);
    expect(tarde.bien).toBe(true);
    expect(tarde.desfase).toBeCloseTo(0.1 / 4, 2);
    // a decade late is not the same curve
    expect(compararDibujo(d, xs.map((x) => f(x / 10)), f).bien).toBe(false);
    // the same drawing on a linear axis would put almost every point beyond the cut-off
    expect(xsDibujo({ ...d, x: { ...d.x, escala: undefined } }).filter((x) => x > 1000)).toHaveLength(16);
  });

  test('SQL: la base de ejemplo, la consulta del libro (31 filas) y los errores en español', () => {
    expect(filasMuestra()).toHaveLength(38 * 144 * 4);
    const r = sql(`SELECT date(t, 'unixepoch') AS dia, time(t, 'unixepoch') AS hora, max(valor) AS maxima FROM medidas WHERE sensor = 1 AND t >= strftime('%s', '2026-03-01') AND t < strftime('%s', '2026-04-01') GROUP BY dia ORDER BY dia;`);
    expect(r.error).toBeUndefined();
    expect(r.total).toBe(31);
    expect(r.resultado!.columnas).toEqual(['dia', 'hora', 'maxima']);
    expect(r.resultado!.filas[0]![0]).toBe('2026-03-01');
    expect(sql('SELECT nombre, unidad FROM sensores ORDER BY id').resultado!.filas).toEqual([['BME280-T', '°C'], ['BME280-H', '%'], ['BME280-P', 'hPa'], ['SCD41', 'ppm']]);
    // each run starts from the same data: a DELETE does not carry over
    sql('DELETE FROM medidas');
    expect(sql('SELECT count(*) FROM medidas').resultado!.filas[0]![0]).toBe(38 * 144 * 4);
    expect(sql('SELECT * FROM medida').error).toMatch(/^No existe la tabla «medida»/);
    expect(sql('SELECT valr FROM medidas').error).toMatch(/^No existe la columna «valr»/);
    expect(sql('SELECT sensor FROM medidas WHERE max(valor) > 3').error).toMatch(/HAVING/);
    expect(sql('SELECT * FROM medidas WHERE').error).toMatch(/incompleta/);
    expect(sql('SELEC 1').error).toMatch(/^Error de sintaxis cerca de «SELEC»/);
    expect(sql('SELECT id FROM medidas JOIN sensores ON id = sensor').error ?? '').not.toMatch(/SQLite dice/);
    expect(explicarError('Error: algo raro')).toBe('SQLite dice: algo raro');
    expect(rellenarPlantilla('SELECT [[1]] FROM [[2]]', ['a', 'b'])).toBe('SELECT a FROM b');
  });

  test('SQL: comparar resultados (columnas, filas de más o de menos, orden, valores)', () => {
    const e = { columnas: ['a', 'b'], filas: [[1, 'x'], [2, 'y']] };
    expect(compararResultados({ columnas: ['p', 'q'], filas: [[1, 'x'], [2, 'y']] }, e, true).bien).toBe(true);
    expect(compararResultados({ columnas: ['a'], filas: [[1], [2]] }, e, true).texto).toMatch(/1 columna y se piden 2/);
    expect(compararResultados({ columnas: ['a', 'b'], filas: [[1, 'x']] }, e, true).texto).toMatch(/faltan filas/);
    expect(compararResultados({ columnas: ['a', 'b'], filas: [[2, 'y'], [1, 'x']] }, e, true).texto).toMatch(/ORDER BY/);
    expect(compararResultados({ columnas: ['a', 'b'], filas: [[2, 'y'], [1, 'x']] }, e, false).bien).toBe(true);
    expect(compararResultados({ columnas: ['a', 'b'], filas: [[1, 'x'], [3, 'y']] }, e, false).bien).toBe(false);
    expect(compararResultados({ columnas: ['a', 'b'], filas: [[1 + 1e-12, 'x'], [2, 'y']] }, e, true).bien).toBe(true);
  });
});

test.describe('1.2: el generador', () => {
  test('la lección de catálogo genera sin errores, con un tipo de cada, y el diseño y las averías pasan por ngspice', () => {
    expect(R.errores).toEqual([]);
    const tipos = L.tarjetas.map((t) => t.tipo);
    for (const x of ['simular', 'diseno', 'averia', 'ajuste', 'banco', 'dibujar', 'sql']) expect(tipos).toContain(x);
    // every fault of the fault-finding card is one more state simulated
    expect(R.spice.filter((c) => c.donde.includes('averia-divisor')).length).toBe(1 + 3);
    expect(T('sql-cuenta').actividad).toMatchObject({ tipo: 'sql', ordenado: true, esperado: { columnas: ['nombre', 'n'], filas: [['BME280-T', 5472], ['BME280-H', 5472], ['BME280-P', 5472], ['SCD41', 5472]] } });
    expect(T('sql-maxima').actividad).toMatchObject({ esperado: { columnas: ['dia', 'maxima'] } });
    // the same output twice (idempotent: the seeds come from the ids)
    expect(JSON.stringify(generar(copia(FUENTE)).leccion)).toBe(JSON.stringify(L));
    // a question without any hint is a warning, not an error
    expect(R.avisos.some((a) => /sin pistas.*sql-maxima/.test(a))).toBe(true);
  });

  test('cada regla rota a propósito da su error', () => {
    expect(errores((f) => delete tarjetaDe(f, 'simule-carga').simular.errores)).toContainEqual(expect.stringMatching(/simular\.errores.*al menos un error típico/));
    expect(errores((f) => (tarjetaDe(f, 'simule-carga').simular.errores[0].expr = 'V_out*1.01'))).toContainEqual(expect.stringMatching(/dentro de la tolerancia del objetivo: no es un error/));
    expect(errores((f) => (tarjetaDe(f, 'simule-carga').simular.medida = 'corriente'))).toContainEqual(expect.stringMatching(/simular\.medida.*widget\.mide/));
    expect(errores((f) => (tarjetaDe(f, 'disene-33').diseno.tolerancias = { R_1: 0.05, R_2: 0.05 }))).toContainEqual(expect.stringMatching(/no tiene solución con las tolerancias/));
    expect(errores((f) => (tarjetaDe(f, 'disene-33').inicio = { R_1: 1000, R_2: 2000 }))).toContainEqual(expect.stringMatching(/empieza ya aprobado|empieza ya resuelto/));
    // two faults of different parts that read the same everywhere
    expect(errores((f) => (tarjetaDe(f, 'averia-divisor').averia.sondas = [{ id: 'salida', rotulo: 'Salida', valor: 'V_out' }, { id: 'r1', rotulo: 'R₁', valor: 'V_1' }]))).toContainEqual(expect.stringMatching(/«r1-abierta» y «r2-corto».*miden lo mismo/));
    expect(errores((f) => (tarjetaDe(f, 'averia-divisor').averia.fallos[0].con = { R_2: 5000 }))).toContainEqual(expect.stringMatching(/«r2-abierta» mide lo mismo que el circuito sano/));
    expect(errores((f) => (tarjetaDe(f, 'averia-divisor').averia.fallos = tarjetaDe(f, 'averia-divisor').averia.fallos.filter((x: { pieza: string }) => x.pieza !== 'r1')))).toContainEqual(expect.stringMatching(/«r1» no tiene ninguna avería/));
    expect(errores((f) => (tarjetaDe(f, 'averia-divisor').widget.lectura = { valor: 'V_out' }))).toContainEqual(expect.stringMatching(/no enseña lecturas/));
    expect(errores((f) => (tarjetaDe(f, 'ajuste-33').inicio = { R_2: 1940 }))).toContainEqual(expect.stringMatching(/empieza ya dentro de la banda/));
    expect(errores((f) => (tarjetaDe(f, 'ajuste-33').ajuste.objetivo = 6))).toContainEqual(expect.stringMatching(/ninguna posición de los mandos lleva la medida a su banda/));
    expect(errores((f) => delete tarjetaDe(f, 'banco-divisor').banco.consejos)).toContainEqual(expect.stringMatching(/banco\.consejos/));
    expect(errores((f) => (tarjetaDe(f, 'dibuje-salida').dibujar.y.max = 6))).toContainEqual(expect.stringMatching(/se sale del eje y/));
    // (motor12b) a logarithmic x axis: accepted from above 0; neither 0 nor another scale; the y axis stays linear
    expect(errores((f) => Object.assign(tarjetaDe(f, 'dibuje-salida').dibujar.x, { min: 100, escala: 'log' }))).toEqual([]);
    expect(errores((f) => (tarjetaDe(f, 'dibuje-salida').dibujar.x.escala = 'log'))).toContainEqual(expect.stringMatching(/dibujar\.x.*logarítmico empieza por encima de 0/));
    expect(errores((f) => Object.assign(tarjetaDe(f, 'dibuje-salida').dibujar.x, { min: 100, escala: 'cuadratica' }))).toContainEqual(expect.stringMatching(/dibujar\.x\.escala.*lineal o log/));
    expect(errores((f) => (tarjetaDe(f, 'dibuje-salida').dibujar.y.escala = 'log'))).toContainEqual(expect.stringMatching(/dibujar\.y\.escala.*clave desconocida/));
    expect(errores((f) => (tarjetaDe(f, 'sql-cuenta').sql.solucion = "SELECT count(*) FROM medidas WHERE t > strftime('%s', 'now')"))).toContainEqual(expect.stringMatching(/fecha de hoy o el azar/));
    expect(errores((f) => (tarjetaDe(f, 'sql-cuenta').sql.solucion = 'SELECT * FROM nada'))).toContainEqual(expect.stringMatching(/no se ejecuta: No existe la tabla «nada»/));
    expect(errores((f) => (tarjetaDe(f, 'sql-cuenta').sql.solucion = 'SELECT * FROM medidas'))).toContainEqual(expect.stringMatching(/máximo 200/));
    expect(errores((f) => (tarjetaDe(f, 'sql-maxima').sql.huecos[0].opciones = ['min', 'avg']))).toContainEqual(expect.stringMatching(/la solución debe ser una de ellas/));
    expect(errores((f) => (tarjetaDe(f, 'simule-carga').diseno = {}))).toContainEqual(expect.stringMatching(/«diseno» solo va en una tarjeta «tipo: diseno»/));
    expect(errores((f) => (tarjetaDe(f, 'simule-carga').escalera = ['a', 'b', 'c']))).toContainEqual(expect.stringMatching(/«escalera»: una o dos pistas/));
    // numbers in the step's texts follow the book-or-model rule
    expect(errores((f) => (tarjetaDe(f, 'averia-divisor').averia.fallos[0].texto = 'Mide 7,77 V.'))).toContainEqual(expect.stringMatching(/el número 7,77 no está/));
    // without SQLite the SQL cards cannot be checked
    expect(generarLeccion(copia(FUENTE), { bloques: contexto.bloques }, 'x').errores).toContainEqual(expect.stringMatching(/no se puede comprobar sin SQLite/));
  });
});

test.describe('1.2: el motor', () => {
  const vacio = (t: Tarjeta) => nuevoEstado(t);
  const con = (e: EstadoTarjeta, c: Partial<EstadoTarjeta>): EstadoTarjeta => ({ ...e, ...c });

  test('prediga y simule: una estimación que olvida la carga se explica, la tarjeta sigue; la buena acierta', () => {
    const t = T('simule-carga');
    const a = t.actividad as Simular;
    let e = vacio(t);
    expect(e.actividad).toEqual({ tipo: 'simular', texto: '', valor: null });
    expect(botonPrincipal(t, e, {}).bloqueado).toBe(true);
    e = con(e, { actividad: { tipo: 'simular', texto: '4 V', valor: 4 } });
    const r = comprobar(L, t, e, valoresDe(t));
    expect(r.aviso.bien).toBe(false);
    expect(r.aviso.textos.map((x) => textoPlano(x)).join(' ')).toMatch(/Su estimación: 4 V\. El modelo: 3,00 V \(error del 33 %\).*olvidado la carga/);
    expect(r.estado.resuelta).toBe(true);
    expect(botonPrincipal(t, r.estado, {}).accion).toBe('continuar');
    const ev = eventoDeComprobacion(L, t, e, r.estado)!;
    expect(ev.evento).toMatchObject({ correcta: false, subtipo: 'leccion11-simular', final: false });
    expect(diagnosticar(mc, a, valoresDe(t), 3.05).bien).toBe(true);
    expect(diagnosticar(mc, a, valoresDe(t), 3000).causa).toBe('prefijo');
    expect(diagnosticar(mc, a, valoresDe(t), -3).causa).toBe('signo');
  });

  test('diseño: el informe nominal y con tolerancias; aprobado con 1 kΩ y 2 kΩ, no con 1 kΩ y 1 kΩ', () => {
    const t = T('disene-33');
    const v = valoresDe(t);
    const mal = comprobar(L, t, vacio(t), { ...v, R_1: 1000, R_2: 1000 });
    expect(mal.aviso.bien).toBe(false);
    expect(textoPlano(mal.aviso.textos[0])).toMatch(/^Nominal: 2,50 V \(no cumple\)\. Con las tolerancias, de 2,4\d V a 2,5\d V: cumplen 0 de 4 esquinas\.$/);
    expect(textoPlano(mal.aviso.textos[1])).toMatch(/Falta tensión/);
    const bien = comprobar(L, t, vacio(t), { ...v, R_1: 1000, R_2: 2000 });
    expect(bien.aviso.bien).toBe(true);
    const inf = analizarDiseno(mc, t.actividad as Diseno, t.condiciones!, { ...v, R_1: 1000, R_2: 2000 });
    expect(inf).toMatchObject({ nominal: true, placas: 4, cumplen: 4, pasa: true });
    // nominal right but the tolerances take it out: the card's lesson, said
    const justo = comprobar(L, t, vacio(t), { ...v, R_1: 1200, R_2: 2200 });
    expect(justo.aviso.bien).toBe(false);
    expect(textoPlano(justo.aviso.textos[1])).toMatch(/nominal cumple, pero con las tolerancias/);
  });

  test('busque la avería: la avería sobre el widget, medidas que cuestan pasos, un sospechoso mal explicado con lo medido', () => {
    const t = T('averia-divisor');
    const a = t.actividad as Averia;
    let e = vacio(t);
    const ea = e.actividad as EstadoAveria;
    expect(a.fallos[ea.fallo]!.id).toBe('r2-abierta');
    // the widget's values carry the fault; the healthy values are kept apart
    expect(valoresDe(t, e).R_2).toBe(1e9);
    expect(a.sano).toEqual({ R_2: 5000, R_1: 10000 });
    expect(lecturas(mc, a, valoresDe(t, e), null).salida).toBeCloseTo(4, 6);
    expect(lecturas(mc, a, valoresDe(t, e), a.fallos[0]!).salida).toBeCloseTo(12, 3);
    expect(esComprobable(t)).toBe(true);
    expect(botonPrincipal(t, e, {}).bloqueado).toBe(true);
    e = con(e, { actividad: { ...ea, medidas: ['salida'], sospechoso: 'r1' } });
    const r = comprobar(L, t, e, valoresDe(t, e));
    expect(r.aviso.bien).toBe(false);
    expect(textoPlano(r.aviso.textos[0])).toBe('Si fuera R₁ (está abierta: no conduce), en «Salida» mediría 0 V; usted ha medido 12,0 V.');
    expect((r.estado.actividad as EstadoAveria).descartados).toEqual(['r1']);
    const e2 = reintentar(t, r.estado);
    expect((e2.actividad as EstadoAveria).medidas).toEqual(['salida']);
    const r2 = comprobar(L, t, con(e2, { actividad: { ...(e2.actividad as EstadoAveria), sospechoso: 'r2' } }), valoresDe(t, e2));
    expect(r2.aviso.bien).toBe(true);
    expect(textoPlano(r2.aviso.textos[0])).toMatch(/R₂ abierta/);
    // nothing measured: what to do
    expect(textoPlano(porQueNo(mc, a, valoresDe(t), a.fallos[0]!, 'r1', []))).toMatch(/Mida primero/);
    // rounds: «fija» goes through the list; «azar» never repeats the round before, and is the same for the same seed
    expect([0, 1, 2, 3].map((n) => falloDeRonda(a, t.id, n))).toEqual([0, 1, 2, 0]);
    const az = { ...a, eleccion: 'azar' as const };
    const seq = [0, 1, 2, 3, 4, 5].map((n) => falloDeRonda(az, t.id, n, 99));
    expect([0, 1, 2, 3, 4, 5].map((n) => falloDeRonda(az, t.id, n, 99))).toEqual(seq);
    expect(seq.every((x, j) => j === 0 || x !== seq[j - 1])).toBe(true);
    expect(otraAveria(a, t.id, ea).fallo).toBe(1);
    expect(faltaSeparar(mc, a, valoresDe(t))).toEqual({ pares: [], sano: [], minimo: 2 });
  });

  test('ajuste y banco: «Continuar» dentro de la banda; el banco siempre (es opcional) y no se pregunta', () => {
    const t = T('ajuste-33');
    const e = vacio(t);
    const v = valoresDe(t);
    expect(botonPrincipal(t, e, mc.evaluar(v))).toMatchObject({ accion: 'continuar', bloqueado: true });
    expect(botonPrincipal(t, e, mc.evaluar({ ...v, R_2: 1940 }))).toMatchObject({ accion: 'continuar', bloqueado: false });
    const b = T('banco-divisor');
    expect(botonPrincipal(b, vacio(b), mc.evaluar(valoresDe(b)))).toMatchObject({ accion: 'continuar', bloqueado: false });
    expect(esComprobable(b)).toBe(false);
    expect(esPracticable(b)).toBe(false);
    expect(esPracticable(t)).toBe(false);
    for (const id of ['simule-carga', 'disene-33', 'averia-divisor', 'dibuje-salida', 'sql-cuenta']) expect(esPracticable(T(id)), id).toBe(true);
  });

  test('dibuje: hace falta la mitad de los puntos; la curva buena acierta, una plana no', () => {
    const t = T('dibuje-salida');
    const a = t.actividad as Dibujar;
    const v = valoresDe(t);
    const f = (r: number) => (12 * r) / (10000 + r);
    const e0 = vacio(t);
    expect(botonPrincipal(t, e0, {}).bloqueado).toBe(true);
    const bueno = con(e0, { actividad: { tipo: 'dibujar', ys: xsDibujo(a).map(f), punto: 0 } });
    expect(comprobar(L, t, bueno, v).aviso.bien).toBe(true);
    const plano = con(e0, { actividad: { tipo: 'dibujar', ys: xsDibujo(a).map(() => 6), punto: 0 } });
    const r = comprobar(L, t, plano, v);
    expect(r.aviso.bien).toBe(false);
    expect(textoPlano(r.aviso.textos[1])).toMatch(/amplitud/);
  });

  test('SQL: hay que ejecutar antes; el resultado ejecutado se compara; ordenar compara el orden', () => {
    const t = T('sql-cuenta');
    const e0 = vacio(t);
    const ea = e0.actividad as Extract<EstadoTarjeta['actividad'], { tipo: 'sql' }>;
    expect(botonPrincipal(t, e0, {}).bloqueado).toBe(true);
    const sin = 'SELECT s.nombre, count(*) AS n FROM medidas AS m JOIN sensores AS s ON s.id = m.sensor';
    const malo = con(e0, { actividad: { ...ea, texto: sin, ejecutado: { texto: sin, ...sql(sin) } } });
    const r = comprobar(L, t, malo, {});
    expect(r.aviso.bien).toBe(false);
    expect(textoPlano(r.aviso.textos[0])).toMatch(/1 fila y se esperan 4/);
    const bueno = (t.actividad as { solucion: string }).solucion;
    const ok = con(e0, { actividad: { ...ea, texto: bueno, ejecutado: { texto: bueno, ...sql(bueno) } } });
    expect(comprobar(L, t, ok, {}).aviso.bien).toBe(true);
    // a result of another text does not count
    expect(botonPrincipal(t, con(ok, { actividad: { ...ea, texto: `${bueno} `, ejecutado: { texto: bueno, ...sql(bueno) } } }), {}).bloqueado).toBe(true);
    const o = T('sql-orden');
    const eo = vacio(o);
    expect(comprobar(L, o, eo, {}).aviso.bien).toBe(false);
    expect(comprobar(L, o, con(eo, { actividad: { ...(eo.actividad as typeof ea), orden: [0, 1, 2, 3, 4] } }), {}).aviso.bien).toBe(true);
  });

  test('escalera de pistas: los pasos abiertos cuentan como ayuda; la solución sale tras dos fallos', () => {
    const t = T('simule-carga');
    expect(t.escalera).toHaveLength(2);
    const e = con(vacio(t), { actividad: { tipo: 'simular', texto: '3', valor: 3 }, pistasVistas: 2 });
    const r = comprobar(L, t, e, valoresDe(t));
    expect(eventoDeComprobacion(L, t, e, r.estado)!.evento.pistas).toBe(2);
    const d = T('disene-33');
    const v = { ...valoresDe(d), R_1: 1000, R_2: 1000 };
    const r1 = comprobar(L, d, vacio(d), v);
    const r2 = comprobar(L, d, reintentar(d, r1.estado), v);
    expect(r2.aviso.textos.length).toBe(r1.aviso.textos.length);
    expect(eventoDeComprobacion(L, d, reintentar(d, r1.estado), r2.estado)!.evento).toMatchObject({ final: true, pistas: 0 });
  });
});
