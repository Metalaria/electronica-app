// 1.1 hand-authored lessons, in Node (no browser, no server): design tokens and their contrast in the three themes,
// the authors' markup, the lesson model, the generator's checks (each rule broken on purpose), the engine's rules of a
// card, the route choice between the new and the 1.0 lesson, and the generator script (idempotent, order-stable,
// up to date with the committed output, stale outputs removed, nothing written on an error).
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones11-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { contraste, revisarContrastes, tokensPorTema, PARES } from '../src/lib/leccion11/contraste.ts';
import { analizarTexto, contarPalabras, numerosDe, textoPlano, htmlDeTexto } from '../src/lib/leccion11/texto.ts';
import { barajarFijo, compilarModelo, enRango, puntuarEstimacion, posicionesEstimar } from '../src/lib/leccion11/modelo.ts';
import { generarLeccion, textoDeBloque, valoresSerie, coincide, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import { botonPrincipal, comprobar, eventoDeComprobacion, nuevoEstado, reintentar, resumenIntentos, exploracionHecha } from '../src/lib/leccion11/motor.ts';
import { anclaClasica, elegirModo, restoDeAncla, tarjetaDeRuta, rutaTarjeta } from '../src/lib/leccion11/ruta.ts';
import { anchoEtiqueta, geometriaGrafica, TAM_MARCA, type EtiquetaEje } from '../src/lib/leccion11/ejes.ts';
import type { Leccion11, Tarjeta } from '../src/lib/leccion11/tipos.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

// the circuit schematics, registered as the generator script does (one folder each: lib/leccion11/esquemas/); before
// any describe block, since some generate a lesson while they are declared
await cargarEsquemas11();

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raiz = path.join(web, '..');
const libro = path.join(web, 'public', 'libro');
const FUENTES = path.join(raiz, 'contenido', 'lecciones11');
const css = fs.readFileSync(path.join(web, 'src', 'estilos', 'tokens11.css'), 'utf8');

const partes = new Map<string, unknown[] | null>();
const contexto: ContextoLibro = {
  bloques(p) {
    if (!partes.has(p)) {
      const f = path.join(libro, 'partes', `${p}.json`);
      partes.set(p, fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null);
    }
    return partes.get(p)!;
  },
};
const fuente = (id: string) => parse(fs.readFileSync(path.join(FUENTES, `${id}.yaml`), 'utf8')) as Record<string, unknown>;
const generar = (x: unknown) => generarLeccion(x, contexto, 'prueba');
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
type Fuente = { tarjetas: Record<string, unknown>[]; libro: Record<string, string>; modelo: { valores: Record<string, Record<string, unknown>>; calculos: Record<string, Record<string, unknown>> } };
const tarjetaFuente = (f: Fuente, id: string) => f.tarjetas.find((t) => t.id === id)!;
/** The source changed by `cambio`, generated: its errors. */
function errores(id: string, cambio: (f: Fuente) => void): string[] {
  const f = copia(fuente(id)) as unknown as Fuente;
  cambio(f);
  return generar(f).errores;
}

test.describe('estilo 1.1: tokens', () => {
  test('cada par de tokens usado cumple WCAG AA en claro, sepia y oscuro', () => {
    expect(revisarContrastes(css)).toEqual([]);
    const temas = tokensPorTema(css);
    for (const t of Object.values(temas)) for (const [a, b] of PARES) expect(t[a] && t[b], `${a}/${b}`).toBeTruthy();
    // the mock-up's accents in the light theme
    expect(temas.claro.azul).toBe('#2457d6');
    expect(temas.claro.naranja).toBe('#d9661c');
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  test('los componentes 1.1 solo usan tokens que existen, y los tres temas los definen todos', () => {
    const dir = path.join(web, 'src', 'componentes', 'leccion11');
    const usados = new Set<string>();
    for (const f of fs.readdirSync(dir)) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/var\(--v11-([a-z0-9-]+)\)/g)) usados.add(m[1]!);
    const definidos = new Set([...css.matchAll(/--v11-([a-z0-9-]+):/g)].map((m) => m[1]!));
    expect([...usados].filter((u) => !definidos.has(u))).toEqual([]);
    const temas = tokensPorTema(css);
    expect(Object.keys(temas.sepia).sort()).toEqual(Object.keys(temas.claro).sort());
    expect(Object.keys(temas.oscuro).sort()).toEqual(Object.keys(temas.claro).sort());
  });

  test('las tipografías van con la aplicación (sin CDN) y son OFL', () => {
    const f = fs.readFileSync(path.join(web, 'src', 'estilos', 'fuentes11.css'), 'utf8');
    expect(f).not.toMatch(/https?:/);
    for (const m of f.matchAll(/url\('([^']+)'\)/g)) expect(fs.existsSync(path.resolve(web, 'src', 'estilos', m[1]!)), m[1]).toBe(true);
    expect(f).toContain("font-family: 'Space Grotesk'");
    expect(f).toContain("font-family: 'Inter'");
    for (const p of ['inter', 'space-grotesk']) expect(JSON.parse(fs.readFileSync(path.join(web, 'node_modules', '@fontsource', p, 'package.json'), 'utf8')).license).toBe('OFL-1.1');
  });
});

test.describe('formato: texto y números', () => {
  test('marcas cortas a trozos, sin HTML', () => {
    const t = analizarTexto('V_{salida} = **{{V_out}}** y x^{2} <b>');
    expect(t).toEqual([
      { t: 'txt', s: 'V' },
      { t: 'sub', s: 'salida' },
      { t: 'txt', s: ' = ' },
      { t: 'val', id: 'V_out' },
      { t: 'txt', s: ' y x' },
      { t: 'sup', s: '2' },
      { t: 'txt', s: ' <b>' },
    ]);
    expect(htmlDeTexto(t, () => '4 V')).toBe('V<sub>salida</sub> = 4 V y x<sup>2</sup> &lt;b&gt;');
    expect(textoPlano(t, () => '4 V')).toBe('Vsalida = 4 V y x2 <b>');
    expect(contarPalabras(analizarTexto('Mueva R₁ y R₂: {{V_out}} — ya.'))).toBe(6);
  });

  test('números del texto (no los nombres de piezas ni los subíndices)', () => {
    expect(numerosDe('Con 12 V, 10 kΩ y 5 kΩ, la salida es 4,00 V; un 2N3904 y R2, E24, 1 000 000 Hz, −6 dB').map((n) => n.s)).toEqual(['12', '10', '5', '4,00', '1000000', '−6']);
    expect(coincide({ v: 3.33, decimales: 2 }, 3.3333)).toBe(true);
    expect(coincide({ v: 33.3, decimales: 1 }, 33333)).toBe(true);
    expect(coincide({ v: 3.3, decimales: 1 }, 3.4)).toBe(false);
  });

  test('el texto de un bloque del libro incluye listas, tablas, cajas y soluciones', () => {
    const b = { t: 'ejercicios', items: [{ label: 'ej', num: '1.4', bloques: [{ t: 'p', html: 'Diseña <b>un</b> divisor' }], solucion: [{ t: 'p', html: 'R₂ = 1941 Ω' }] }] };
    expect(textoDeBloque(b)).toBe('Diseña un divisor R₂ = 1941 Ω');
    expect(textoDeBloque({ t: 'tabla', filas: [['a', '90,9 Ω']] })).toBe('a 90,9 Ω');
  });
});

test.describe('modelo', () => {
  const l = generar(fuente('cap01/sec-1.4')).leccion!;
  const mc = compilarModelo(l.modelo);

  test('calcula el divisor del libro, con y sin carga', () => {
    expect(mc.evaluar({}).V_out).toBeCloseTo(4, 9);
    const c = mc.evaluar({ carga: 1, R_L: 10000 });
    expect(c.R_ab).toBeCloseTo(3333.333, 2);
    expect(c.V_out).toBeCloseTo(3, 9);
    expect(c.error).toBeCloseTo(25, 9);
    expect(enRango({ valor: 'V_out', min: 3.9, max: 4.1 }, mc.evaluar({}))).toBe(true);
  });

  test('estimar puntúa por cercanía; barajar nunca deja nada en su sitio y es estable', () => {
    expect(puntuarEstimacion(91, 90.909, 0.05)).toMatchObject({ bien: true, puntos: 100 });
    const lejos = puntuarEstimacion(150, 90.909, 0.05);
    expect(lejos.bien).toBe(false);
    expect(lejos.puntos).toBe(0);
    expect(puntuarEstimacion(97, 90.909, 0.05).puntos).toBeGreaterThan(0);
    for (let n = 2; n <= 7; n++) {
      const p = barajarFijo(n, `x${n}`);
      expect(p.every((x, k) => x !== k)).toBe(true);
      expect(barajarFijo(n, `x${n}`)).toEqual(p);
      expect([...p].sort()).toEqual(Array.from({ length: n }, (_, k) => k));
    }
    expect(posicionesEstimar({ objetivo: '', unidad: '', min: 0, max: 1, paso: 0.25, inicio: 0, tol: 0, rotulo: [], cifras: 3 })).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(valoresSerie(1000, 10000, 'E24')).toContain(2000);
    expect(valoresSerie(1000, 10000, 'E12')).not.toContain(2000);
  });
});

test.describe('generador: las lecciones de referencia', () => {
  for (const id of ['cap01/sec-1.4', 'cap00/sec-0.3']) {
    test(`${id} se genera sin errores y cada opción tiene su porqué`, () => {
      const r = generar(fuente(id));
      expect(r.errores).toEqual([]);
      const l = r.leccion!;
      expect(l.id).toBe(id);
      expect(l.tarjetas.at(-1)!.tipo).toBe('resumen');
      for (const t of l.tarjetas) {
        expect(t.libro.length, t.id).toBeGreaterThan(0);
        for (const k of t.libro) expect(l.libro[k], k).toBeTruthy();
        for (const o of t.opciones ?? []) expect(textoPlano(o.porque).length, `${t.id}`).toBeGreaterThan(10);
        expect(contarPalabras(t.titulo) + contarPalabras(t.texto) + contarPalabras(t.nota), t.id).toBeLessThanOrEqual(40);
      }
      // the circuits are checked against ngspice by the script: here, that there is something to check
      if (id === 'cap01/sec-1.4') expect(r.spice.length).toBeGreaterThan(10);
      // same input, same output (order-stable)
      expect(JSON.stringify(generar(fuente(id)).leccion)).toBe(JSON.stringify(l));
    });
  }

  test('la salida publicada está al día con las fuentes', () => {
    for (const id of ['cap01/sec-1.4', 'cap00/sec-0.3']) {
      const publicado = fs.readFileSync(path.join(libro, 'lecciones11', `${id}.json`), 'utf8');
      expect(publicado).toBe(`${JSON.stringify(generar(fuente(id)).leccion)}\n`);
    }
  });
});

test.describe('generador: cada regla, rota a propósito', () => {
  const casos: [string, (f: Fuente) => void, RegExp][] = [
    ['más de 40 palabras', (f) => (tarjetaFuente(f, 'explore-serie').texto = `${'palabra '.repeat(40)}fin`), /palabras entre título, texto y nota/],
    ['opción sin explicación', (f) => delete (tarjetaFuente(f, 'prediga-salida').opciones as Record<string, unknown>[])[1]!.porque, /falta «opcion 2.porque»/],
    ['dos opciones correctas', (f) => ((tarjetaFuente(f, 'prediga-salida').opciones as Record<string, unknown>[])[1]!.bien = true), /exactamente una opción/],
    ['un número que no está en el libro ni en el modelo', (f) => ((tarjetaFuente(f, 'prediga-salida').opciones as Record<string, unknown>[])[0]!.texto = '7 V'), /el número 7 no está/],
    ['una comprobación que el modelo no cumple', (f) => (tarjetaFuente(f, 'prediga-salida').comprobar = [{ V_out: 5 }]), /el modelo da V_out = 4/],
    ['un valor vivo que no existe', (f) => (tarjetaFuente(f, 'explore-serie').texto = 'Mire {{V_nada}}.'), /\{\{V_nada\}\} no está en el modelo/],
    ['una cita que el bloque no contiene', (f) => (f.libro['84'] = 'La fórmula vale siempre'), /el bloque no contiene/],
    ['un bloque fuera de la sección', (f) => (f.libro['20'] = 'x'), /no está en la sección/],
    ['una tarjeta sin bloques del libro', (f) => delete tarjetaFuente(f, 'explore-serie').libro, /falta «libro»/],
    ['un mando sobre un cálculo', (f) => ((tarjetaFuente(f, 'explore-serie').widget as { mandos: unknown[] }).mandos[0] = { valor: 'V_out', min: 0, max: 1, paso: 0.1 }), /un cálculo no se mueve/],
    ['una expresión con una variable desconocida', (f) => (f.modelo.calculos.V_out!.expr = 'V_in*R_9'), /«R_9» no está en el modelo/],
    ['un ciclo en el modelo', (f) => (f.modelo.calculos.V_1!.expr = 'V_in - V_1'), /ciclo/],
    ['un reto sin solución', (f) => ((tarjetaFuente(f, 'reto-33').condiciones as Record<string, unknown>[])[0]!.objetivo = 4.9), /no tiene solución/],
    ['un reto resuelto desde el principio', (f) => (tarjetaFuente(f, 'reto-33').inicio = { R_2: 2000 }), /empieza ya resuelto/],
    ['un reto con posiciones sin pista', (f) => (tarjetaFuente(f, 'reto-33').pistas = [{ cuando: { valor: 'V_out', mayor: 3.366 }, texto: 'Menor.' }]), /no se aplica ninguna pista/],
    ['una estimación que empieza acertada', (f) => ((tarjetaFuente(f, 'paralelo-estime').estimar as Record<string, unknown>).inicio = 91), /empieza ya acertada/],
    ['un objetivo fuera del deslizador', (f) => ((tarjetaFuente(f, 'paralelo-estime').estimar as Record<string, unknown>).max = 50), /fuera del deslizador/],
    ['el resumen no es el último', (f) => f.tarjetas.push(copia(tarjetaFuente(f, 'potencia-serie'))), /el resumen es la última tarjeta|«id» repetido/],
    ['un id repetido', (f) => (tarjetaFuente(f, 'potencia-serie').id = 'explore-serie'), /«id» repetido/],
    ['un «requiere» de un valor sin mando', (f) => (tarjetaFuente(f, 'explore-serie').requiere = { mover: ['R_L'] }), /no tiene mando en esta tarjeta/],
    ['un circuito sin «mide»', (f) => delete (tarjetaFuente(f, 'explore-serie').widget as Record<string, unknown>).mide, /widget.mide/],
    ['una fórmula sin su ecuación', (f) => delete tarjetaFuente(f, 'regla-reparto').ec, /lleva «ec»/],
    ['una clave mal escrita', (f) => (tarjetaFuente(f, 'explore-serie').txto = 'x'), /clave desconocida «txto»/],
    // motor fixes 1.1: a «lista» control with names
    ['nombres que no casan con la lista', (f) => ((tarjetaFuente(f, 'explore-serie').widget as { mandos: unknown[] }).mandos[0] = { valor: 'R_1', lista: [1000, 2000], nombres: ['uno'] }), /nombres: un texto por cada valor/],
    // (1.2, peticiones motor12: names may carry digits, «Sn63Pb37», «0805»; one that is only a number may not)
    ['un nombre que es su propio valor', (f) => ((tarjetaFuente(f, 'explore-serie').widget as { mandos: unknown[] }).mandos[0] = { valor: 'R_1', lista: [1000, 2000], nombres: ['rojo', '2000'] }), /nombres: un nombre que no sea su propio valor/],
    ['nombres repetidos', (f) => ((tarjetaFuente(f, 'explore-serie').widget as { mandos: unknown[] }).mandos[0] = { valor: 'R_1', lista: [1000, 2000], nombres: ['rojo', 'rojo'] }), /nombres repetidos/],
    ['nombres sin lista', (f) => ((tarjetaFuente(f, 'explore-serie').widget as { mandos: unknown[] }).mandos[0] = { valor: 'R_1', min: 1000, max: 2000, paso: 1000, nombres: ['a', 'b'] }), /nombres: solo con «lista»/],
    ['una explicación demasiado larga', (f) => ((tarjetaFuente(f, 'por-que-baja').opciones as Record<string, unknown>[])[1]!.porque = `${'muy '.repeat(41)}larga`), /porque: \d+ palabras/],
  ];
  for (const [nombre, cambio, esperado] of casos)
    test(nombre, () => {
      const e = errores('cap01/sec-1.4', cambio);
      expect(e.join('\n')).toMatch(esperado);
    });

  test('mando de lista con nombres: cada nombre sigue a su valor al ordenar la lista', () => {
    const f = fuente('cap01/sec-1.4') as unknown as Fuente;
    (tarjetaFuente(f, 'explore-serie').widget as { mandos: unknown[] }).mandos[0] = { valor: 'R_1', lista: [20000, 10000, 1000], nombres: ['rojo', 'marrón', 'negro'] };
    const r = generar(f);
    expect(r.errores).toEqual([]);
    const m = r.leccion!.tarjetas.find((t) => t.id === 'explore-serie')!.widget!.mandos[0]!;
    expect(m.valores).toEqual([1000, 10000, 20000]);
    expect(m.nombres).toEqual(['negro', 'marrón', 'rojo']);
  });

  test('una gráfica con una curva que no da números', () => {
    const e = errores('cap00/sec-0.3', (f) => ((tarjetaFuente(f, 'explore-senoide').widget as { curvas: Record<string, unknown>[] }).curvas[0]!.expr = 'sqrt(-V_p)*t'));
    expect(e.join('\n')).toMatch(/no da un número/);
  });
});

test.describe('motor de las tarjetas', () => {
  const l = generar(fuente('cap01/sec-1.4')).leccion!;
  const T = (id: string) => l.tarjetas.find((t) => t.id === id)!;
  const base = () => Object.fromEntries(Object.entries(l.modelo.valores).map(([k, v]) => [k, v.valor]));

  test('explorar: «Continuar» se abre al mover lo pedido', () => {
    const t = T('explore-serie');
    let e = nuevoEstado(t);
    expect(botonPrincipal(t, e, base())).toEqual({ texto: 'Continuar', accion: 'continuar', bloqueado: true });
    e = { ...e, movidos: ['R_1'] };
    expect(exploracionHecha(t, e, base())).toBe(false);
    e = { ...e, movidos: ['R_1', 'R_2'] };
    expect(botonPrincipal(t, e, base()).bloqueado).toBe(false);
    const s = T('con-carga');
    const es = { ...nuevoEstado(s), movidos: ['R_L'] };
    expect(exploracionHecha(s, es, { ...base(), carga: 0 })).toBe(false);
    expect(exploracionHecha(s, es, { ...base(), carga: 1 })).toBe(true);
  });

  test('predecir: la opción mal se explica y queda descartada; la buena abre «Continuar»', () => {
    const t = T('prediga-salida');
    const v = { ...base(), ...t.fijar };
    let e = nuevoEstado(t);
    expect(botonPrincipal(t, e, v)).toMatchObject({ accion: 'comprobar', bloqueado: true });
    e = { ...e, eleccion: 1 };
    const r1 = comprobar(l, t, e, v);
    expect(r1.aviso.bien).toBe(false);
    expect(r1.aviso.titulo).toBe('Por qué no.');
    expect(textoPlano(r1.aviso.textos[0])).toContain('Esos 8 V');
    expect(botonPrincipal(t, r1.estado, v).accion).toBe('reintentar');
    const ev1 = eventoDeComprobacion(l, t, e, r1.estado)!;
    expect(ev1.evento).toMatchObject({ id: 'cap01-l11-sec-1.4-prediga-salida', correcta: false, intento: 1, final: false, clase: 'practica', origen: 'leccion', parte: 'cap01', seccion: 'sec-1.4' });
    e = reintentar(t, r1.estado);
    expect(e.descartadas).toEqual([1]);
    expect(e.eleccion).toBeNull();
    e = { ...e, eleccion: 0 };
    const r2 = comprobar(l, t, e, v);
    expect(r2.aviso).toMatchObject({ bien: true, titulo: 'Eso es.' });
    expect(eventoDeComprobacion(l, t, e, r2.estado)!.evento).toMatchObject({ correcta: true, intento: 2, final: true });
    expect(botonPrincipal(t, r2.estado, v)).toMatchObject({ accion: 'continuar', bloqueado: false });
    // once right, later checks report nothing
    expect(eventoDeComprobacion(l, t, r2.estado, r2.estado)).toBeNull();
  });

  test('reto: pista según hacia dónde falla, ayuda tras dos fallos, éxito con sus valores', () => {
    const t = T('reto-33');
    const v = (r2: number) => ({ ...base(), ...t.fijar, R_2: r2 });
    let e = nuevoEstado(t);
    const r1 = comprobar(l, t, e, v(1000));
    expect(r1.aviso.titulo).toBe('Todavía no.');
    expect(textoPlano(r1.aviso.textos[0])).toContain('Falta tensión');
    e = reintentar(t, r1.estado);
    const r2 = comprobar(l, t, e, v(2200));
    expect(textoPlano(r2.aviso.textos[0])).toContain('Sobra tensión');
    expect(textoPlano(r2.aviso.textos[1])).toContain('1941');
    const r3 = comprobar(l, t, reintentar(t, r2.estado), v(2000));
    expect(r3.aviso).toMatchObject({ bien: true, titulo: '¡Conseguido!' });
    expect(r3.estado.intentos).toBe(3);
  });

  test('estimar, ordenar y emparejar', () => {
    const t = T('paralelo-estime');
    const v = { ...base(), ...t.fijar };
    let e = nuevoEstado(t);
    expect(botonPrincipal(t, e, v).bloqueado).toBe(true);
    e = { ...e, estimacion: 150 };
    expect(textoPlano(comprobar(l, t, e, v).aviso.textos[0])).toContain('Se ha pasado');
    e = { ...e, estimacion: 50 };
    expect(textoPlano(comprobar(l, t, e, v).aviso.textos[0])).toContain('Se ha quedado corto');
    e = { ...e, estimacion: 91 };
    expect(comprobar(l, t, e, v).aviso.bien).toBe(true);

    const o = T('ordene-metodo');
    const eo = nuevoEstado(o);
    expect(eo.orden).toEqual(o.ordenar!.inicio);
    const mal = comprobar(l, o, eo, base());
    expect(mal.aviso.bien).toBe(false);
    expect(textoPlano(mal.aviso.textos.at(-1))).toMatch(/de 4 en su sitio/);
    expect(comprobar(l, o, { ...eo, orden: [0, 1, 2, 3] }, base()).aviso.bien).toBe(true);

    const s = generar(fuente('cap00/sec-0.3')).leccion!;
    const m = s.tarjetas.find((x) => x.id === 'simbolos')!;
    const em = nuevoEstado(m);
    expect(botonPrincipal(m, em, {}).bloqueado).toBe(true);
    expect(comprobar(s, m, { ...em, puestas: [1, 0, 2, 3] }, {}).aviso.bien).toBe(false);
    expect(comprobar(s, m, { ...em, puestas: [0, 1, 2, 3] }, {}).aviso.bien).toBe(true);
  });

  test('el resumen de intentos', () => {
    expect(resumenIntentos(0)).toBe('Todo a la primera.');
    expect(resumenIntentos(1)).toBe('Con 1 intento fallido: lo repasará antes.');
    expect(resumenIntentos(3)).toBe('Con 3 intentos fallidos: lo repasará antes.');
  });
});

test.describe('ruta: lección nueva o la de la 1.0', () => {
  test('elige y conserva la clásica', () => {
    expect(elegirModo('', true)).toBe('nueva');
    expect(elegirModo('3', true)).toBe('nueva');
    expect(elegirModo('clasica', true)).toBe('clasica');
    expect(elegirModo('clasica/5', true)).toBe('clasica');
    for (const r of ['practica-2', 'pregunta-1', 'fin']) expect(elegirModo(r, true)).toBe('clasica');
    expect(elegirModo('', false)).toBe('clasica');
    expect(elegirModo('3', false)).toBe('clasica');
    expect(anclaClasica('sec-1.4/clasica/5')).toBe('sec-1.4/5');
    expect(anclaClasica('sec-1.4/practica-2')).toBe('sec-1.4/practica-2');
    expect(restoDeAncla('sec-1.4/clasica/5')).toBe('clasica/5');
    expect(tarjetaDeRuta('3', 12)).toBe(2);
    expect(tarjetaDeRuta('99', 12)).toBe(11);
    expect(tarjetaDeRuta('', 12)).toBe(0);
    expect(rutaTarjeta('cap01', 'sec-1.4', 0)).toBe('#/leccion/cap01/sec-1.4');
    expect(rutaTarjeta('cap01', 'sec-1.4', 2)).toBe('#/leccion/cap01/sec-1.4/3');
  });
});

test.describe('el script del generador', () => {
  test.setTimeout(240_000);
  /** A book folder that links the real parts and writes its own lessons. */
  function libroTemporal(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'epa-l11-'));
    for (const f of ['indice.json', 'refs.json', 'partes']) fs.symlinkSync(path.join(libro, f), path.join(d, f));
    return d;
  }
  const correr = (env: Record<string, string>, args: string[] = []) => spawnSync('node', [path.join(web, 'scripts', 'lecciones11.mjs'), ...args], { cwd: web, env: { ...process.env, ...env }, encoding: 'utf8' });
  const arbol = (d: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const andar = (x: string) => {
      for (const f of fs.readdirSync(x)) {
        const p = path.join(x, f);
        if (fs.statSync(p).isDirectory()) andar(p);
        else out[path.relative(d, p)] = fs.readFileSync(p, 'utf8');
      }
    };
    if (fs.existsSync(d)) andar(d);
    return out;
  };

  test('idempotente, igual a lo publicado, borra lo que ya no tiene fuente y no escribe nada si hay errores', () => {
    const d = libroTemporal();
    const r1 = correr({ EPA_LIBRO: d });
    expect(r1.status, r1.stderr).toBe(0);
    const uno = arbol(path.join(d, 'lecciones11'));
    expect(uno).toEqual(arbol(path.join(libro, 'lecciones11')));
    const r2 = correr({ EPA_LIBRO: d });
    expect(r2.stdout).toContain('sin cambios');
    expect(arbol(path.join(d, 'lecciones11'))).toEqual(uno);

    // a source removed: its output and its index entry go
    const fuentes = fs.mkdtempSync(path.join(os.tmpdir(), 'epa-l11f-'));
    fs.mkdirSync(path.join(fuentes, 'cap01'));
    fs.copyFileSync(path.join(FUENTES, 'cap01', 'sec-1.4.yaml'), path.join(fuentes, 'cap01', 'sec-1.4.yaml'));
    expect(correr({ EPA_LIBRO: d, EPA_LECCIONES11: fuentes }).status).toBe(0);
    const tres = arbol(path.join(d, 'lecciones11'));
    expect(Object.keys(tres).sort()).toEqual(['cap01/sec-1.4.json', 'indice.json']);
    // (motor fixes 1.1: each entry lists the cards «Práctica inteligente» asks on their own — no «por qué»)
    expect(JSON.parse(tres['indice.json']!).lecciones).toEqual({
      'cap01/sec-1.4': {
        tarjetas: 12,
        preguntas: [
          { id: 'prediga-salida', tipo: 'predecir' },
          { id: 'reto-33', tipo: 'reto' },
          { id: 'carga-minima', tipo: 'pregunta' },
          { id: 'paralelo-estime', tipo: 'pregunta' },
          { id: 'divisor-corriente', tipo: 'pregunta' },
          { id: 'ordene-metodo', tipo: 'pregunta' },
          { id: 'potencia-serie', tipo: 'pregunta' },
        ],
      },
    });
    // the practicable sections follow the index (conceptos11.mjs, run again when it changes)
    expect(JSON.parse(fs.readFileSync(path.join(d, 'conceptos.json'), 'utf8')).partes.cap01).toEqual(['sec-1.4']);

    // an error: exit 1 and nothing written
    fs.writeFileSync(path.join(fuentes, 'cap01', 'sec-1.4.yaml'), fs.readFileSync(path.join(FUENTES, 'cap01', 'sec-1.4.yaml'), 'utf8').replace('texto: "4 V"', 'texto: "7 V"'));
    const mal = correr({ EPA_LIBRO: d, EPA_LECCIONES11: fuentes });
    expect(mal.status).toBe(1);
    expect(mal.stderr).toContain('el número 7 no está');
    expect(arbol(path.join(d, 'lecciones11'))).toEqual(tres);
    // a YAML error says where
    fs.writeFileSync(path.join(fuentes, 'cap01', 'sec-1.4.yaml'), 'leccion: cap01/sec-1.4\nlibro: [\n');
    const yaml = correr({ EPA_LIBRO: d, EPA_LECCIONES11: fuentes });
    expect(yaml.status).toBe(1);
    expect(yaml.stderr).toContain('YAML no válido');
    fs.rmSync(d, { recursive: true });
    fs.rmSync(fuentes, { recursive: true });
  });

  test('el simulador detecta un modelo que no corresponde al circuito dibujado', () => {
    const d = libroTemporal();
    const fuentes = fs.mkdtempSync(path.join(os.tmpdir(), 'epa-l11f-'));
    fs.mkdirSync(path.join(fuentes, 'cap01'));
    // the «salida» reading claims the voltage across R₁ (the model says 8 V where the circuit gives 4 V)
    const texto = fs.readFileSync(path.join(FUENTES, 'cap01', 'sec-1.4.yaml'), 'utf8').replace('mide: { salida: V_out, corriente: I }', 'mide: { salida: V_1, corriente: I }');
    fs.writeFileSync(path.join(fuentes, 'cap01', 'sec-1.4.yaml'), texto);
    const r = correr({ EPA_LIBRO: d, EPA_LECCIONES11: fuentes }, ['--comprobar']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/el modelo da 8 y el simulador v\(salida\) = (4|3\.99)/);
    fs.rmSync(d, { recursive: true });
    fs.rmSync(fuentes, { recursive: true });
  });

  test('generar.py llama al generador tras conceptos11', () => {
    const py = fs.readFileSync(path.join(raiz, 'contenido', 'generar.py'), 'utf8');
    expect(py.indexOf("'lecciones11.mjs'")).toBeGreaterThan(py.indexOf("'conceptos11.mjs'"));
    void execFileSync;
  });
});

test.describe('Ejes de las gráficas: etiquetas que no se pisan (lib/leccion11/ejes.ts)', () => {
  type EjeP = { min: number; max: number; unidad: string; escala?: 'log' };
  /** Extent of each drawn label along its axis, as GraficaLeccion draws it (x: by anchor; y: one line high). */
  function tramos(g: ReturnType<typeof geometriaGrafica>, eje: 'x' | 'y'): [number, number, string][] {
    const et: EtiquetaEje[] = eje === 'x' ? g.etqX : g.etqY;
    return et
      .filter((e) => e.visible)
      .map((e): [number, number, string] => {
        if (eje === 'y') return [g.sy(e.v) - TAM_MARCA / 2, g.sy(e.v) + TAM_MARCA / 2, e.texto];
        const p = g.sx(e.v);
        const w = anchoEtiqueta(e.texto);
        return e.ancla === 'start' ? [p, p + w, e.texto] : e.ancla === 'end' ? [p - w, p, e.texto] : [p - w / 2, p + w / 2, e.texto];
      })
      .sort((a, b) => a[0] - b[0]);
  }
  function solapes(t: [number, number, string][]): string[] {
    const out: string[] = [];
    for (let k = 1; k < t.length; k++) if (t[k]![0] < t[k - 1]![1]) out.push(`${t[k - 1]![2]} / ${t[k]![2]}`);
    return out;
  }

  test('cap05/sec-5.1: nueve décadas de cm⁻³ en x y veinte en y no se pisan', () => {
    const x: EjeP = { min: 1e10, max: 1e19, unidad: 'cm⁻³', escala: 'log' };
    const y: EjeP = { min: 1, max: 1e20, unidad: 'cm⁻³', escala: 'log' };
    const g = geometriaGrafica(x, y);
    // every decade keeps its tick (grid line); before the fix every label was drawn and they overlapped
    expect(g.etqX).toHaveLength(10);
    expect(g.etqY).toHaveLength(21);
    const vx = g.etqX.filter((e) => e.visible);
    const vy = g.etqY.filter((e) => e.visible);
    expect(vx.length).toBeGreaterThanOrEqual(3);
    expect(vx.length).toBeLessThan(10);
    expect(vy.length).toBeGreaterThanOrEqual(3);
    expect(vy.length).toBeLessThan(21);
    expect(solapes(tramos(g, 'x'))).toEqual([]);
    expect(solapes(tramos(g, 'y'))).toEqual([]);
    // a bare power of ten, every s-th decade (exponents multiple of the stride), the ends inside the drawing
    expect(vx.map((e) => e.texto.replace(/\s/gu, ' '))).toContain('10¹² cm⁻³');
    expect(vx.every((e) => !e.texto.startsWith('1 ×'))).toBe(true);
    const s = Math.round(Math.log10(vy[1]!.v / vy[0]!.v));
    expect(vy.every((e) => Math.round(Math.log10(e.v)) % s === 0)).toBe(true);
    for (const [a, b] of tramos(g, 'x')) expect(a >= 0 && b <= g.W).toBe(true);
    // the left margin grows to hold the y labels
    expect(Math.max(...vy.map((e) => anchoEtiqueta(e.texto)))).toBeLessThanOrEqual(g.M.izq - 6);
  });

  test('pocas marcas: se ven todas (lineal, y una década con 2 y 5)', () => {
    const lin = geometriaGrafica({ min: 0, max: 5, unidad: 's' }, { min: -10, max: 10, unidad: 'V' });
    expect(lin.etqX.every((e) => e.visible)).toBe(true);
    expect(lin.etqY.every((e) => e.visible)).toBe(true);
    expect(lin.M.izq).toBe(52);
    const una = geometriaGrafica({ min: 1000, max: 25000, unidad: 'Hz', escala: 'log' }, { min: 0, max: 1, unidad: '' });
    expect(una.etqX.map((e) => e.texto.replace(/\s/gu, ' '))).toEqual(['1 kHz', '2 kHz', '5 kHz', '10 kHz', '20 kHz']);
    expect(una.etqX.every((e) => e.visible)).toBe(true);
  });

  test('todas las gráficas publicadas: etiquetas sin pisarse y dentro del dibujo', () => {
    const malas: string[] = [];
    const dir = path.join(libro, 'lecciones11');
    for (const p of fs.readdirSync(dir).filter((x) => fs.statSync(path.join(dir, x)).isDirectory())) {
      for (const f of fs.readdirSync(path.join(dir, p)).filter((x) => x.endsWith('.json'))) {
        const l = JSON.parse(fs.readFileSync(path.join(dir, p, f), 'utf8')) as Leccion11;
        for (const t of l.tarjetas) {
          const w = (t as { widget?: { tipo: string; x?: EjeP; y?: EjeP; grafica?: { x: EjeP; y: EjeP } } }).widget;
          const gr = w?.tipo === 'grafica' ? (w as { x: EjeP; y: EjeP }) : w?.grafica;
          if (!gr) continue;
          const g = geometriaGrafica(gr.x, gr.y);
          const id = `${l.id} ${t.id}`;
          for (const eje of ['x', 'y'] as const) {
            const tr = tramos(g, eje);
            if (tr.length < 2) malas.push(`${id} ${eje}: ${tr.length} etiqueta(s)`);
            for (const s of solapes(tr)) malas.push(`${id} ${eje}: ${s}`);
          }
          for (const [a, b, s] of tramos(g, 'x')) if (a < 0 || b > g.W) malas.push(`${id} x: ${s} se sale`);
          for (const e of g.etqY.filter((e) => e.visible)) if (anchoEtiqueta(e.texto) > g.M.izq - 6) malas.push(`${id} y: ${e.texto} se sale`);
        }
      }
    }
    expect(malas).toEqual([]);
  });
});

// (the types are used by the helpers above; keep the import checked)
export type { Leccion11, Tarjeta };
