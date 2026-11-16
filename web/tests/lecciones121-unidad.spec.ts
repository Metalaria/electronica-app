// 1.2.1 (piloto121) «aprender haciendo», in Node (no browser, no server): the pieces of contenido/lecciones11/GUIA.md
// §13 on the catalogue lesson tests/lecciones12-catalogo/cap01/sec-1.5.yaml — the instrument's readings (the
// schematic's own DC solution), the generator's checks of the instrument, «medir», «elegir», «marcar», «leer» and
// «objetivo» (each rule broken on purpose), their verdicts through lib/leccion11/motor.ts (feedback on what the reader
// did), the ordered touch of a photo, and the lessons' mix of doing and choosing (the three pilot lessons published
// with at least 70 % doing cards and at most two of options). Deterministic.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones121-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import { compilarModelo, valoresDeTarjeta, type Valores } from '../src/lib/leccion11/modelo.ts';
import { botonPrincipal, comprobar, esPracticable, exploracionHecha, faltaPorExplorar, nuevoEstado, valoresSueltos, type EstadoTarjeta } from '../src/lib/leccion11/motor.ts';
import { textoPlano } from '../src/lib/leccion11/texto.ts';
import type { Leccion11, Tarjeta, WidgetCircuito } from '../src/lib/leccion11/tipos.ts';
import { lectura, nuevaMedida, solucionWidget } from '../src/lib/leccion12/hacer/medir.ts';
import { avisoMezcla, claseTarjeta, mezclaDe } from '../src/lib/leccion12/hacer/generar-hacer.ts';
import { tocarZona } from '../src/lib/leccion12/hacer/motor-hacer.ts';
import type { Elegir, EstadoElegir, EstadoMedida } from '../src/lib/leccion12/hacer/tipos.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
};
const FUENTE = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap01', 'sec-1.5.yaml'), 'utf8'));
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const generar = (f: unknown) => generarLeccion(f, contexto, 'catalogo-piloto121');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type F = { tarjetas: Record<string, any>[] };
const tarjetaDe = (f: F, id: string) => f.tarjetas.find((t) => t.id === id)!;
function errores(cambio: (f: F) => void): string {
  const f = copia(FUENTE) as F;
  cambio(f);
  return generar(f).errores.join('\n');
}
const R = generar(FUENTE);
const L = R.leccion as Leccion11;
const T = (id: string) => L.tarjetas.find((t) => t.id === id)!;
const k = (id: string) => L.tarjetas.findIndex((t) => t.id === id);
/** The card's values as the reader finds them (the model with the starting values of the cards before it). */
const valores = (t: Tarjeta): Valores => valoresDeTarjeta(t, valoresSueltos(L, k(t.id)));
const plano = (e: { aviso: { textos: unknown[] } }) => e.aviso.textos.map((x) => textoPlano(x as never)).join(' | ');

test.describe('el catálogo de las piezas', () => {
  test('se genera sin errores, con una tarjeta de cada pieza, y todas se responden haciendo', () => {
    expect(R.errores).toEqual([]);
    const tipos = new Set(L.tarjetas.map((t) => t.tipo));
    for (const x of ['medir', 'elegir', 'marcar', 'leer']) expect(tipos.has(x as never), x).toBe(true);
    expect(T('explore-objetivo').objetivo?.condiciones).toHaveLength(1);
    expect(T('explore-objetivo').fase).toBe('Consiga');
    const m = mezclaDe(L.tarjetas);
    expect(m).toMatchObject({ hacer: m.total, elegir: 0, mirar: 0 });
    // the steps answered by doing are practised on their own too
    for (const id of ['mida-tension', 'mida-corriente', 'elija-carga', 'lea-corriente', 'marque-maximo']) expect(esPracticable(T(id)), id).toBe(true);
    expect(esPracticable(T('explore-objetivo'))).toBe(false);
  });
});

test.describe('el instrumento: lo que marca', () => {
  test('el multímetro lee la solución en continua del propio esquema: tensión entre puntas y corriente de una rama', () => {
    const t = T('mida-tension');
    const w = t.widget as WidgetCircuito;
    const mc = compilarModelo(L.modelo);
    const s = solucionWidget(w, mc.evaluar(valores(t)));
    expect(s).not.toBeNull();
    const m: EstadoMedida = { ...nuevaMedida(w.instrumento!), roja: 'n' };
    expect(m.negra).toBe('0');
    expect(lectura(w.instrumento!, m, s)).toBeCloseTo(7.2, 6);
    // the probes reversed: the sign
    expect(lectura(w.instrumento!, { ...m, roja: '0', negra: 'n' }, s)).toBeCloseTo(-7.2, 6);
    // across R₁: 12 − 7,2
    expect(lectura(w.instrumento!, { ...m, roja: 'f1', negra: 'n' }, s)).toBeCloseTo(4.8, 6);
    // the ammeter in each branch, in the direction the drawing gives
    const a = { ...m, modo: 'A' as const };
    expect(lectura(w.instrumento!, { ...a, rama: 'vm3' }, s)).toBeCloseTo(0.0036, 9);
    expect(lectura(w.instrumento!, { ...a, rama: 'vm1' }, s)).toBeCloseTo(0.0048, 9);
    expect(lectura(w.instrumento!, { ...a, rama: 'vm2' }, s)).toBeCloseTo(-0.0012, 9);
    // incomplete: nothing
    expect(lectura(w.instrumento!, { ...a, rama: null }, s)).toBeNull();
    expect(lectura(w.instrumento!, { ...m, roja: null }, s)).toBeNull();
  });
});

test.describe('generador: cada regla, rota a propósito', () => {
  const casos: [string, (f: F) => void, RegExp][] = [
    ['un punto que no es un nodo', (f) => (tarjetaDe(f, 'mida-tension').widget.instrumento.puntos.x9 = 'Otro'), /no es un nodo del esquema kirchhoff/],
    ['una rama que no es un medidor de 0 V', (f) => (tarjetaDe(f, 'mida-tension').widget.instrumento.ramas.v1 = 'La fuente'), /no es un medidor de 0 V/],
    ['un instrumento en un widget oculto', (f) => (tarjetaDe(f, 'mida-tension').widget.ocultar = true), /el instrumento daría la respuesta/],
    // (motor121: a non-linear schematic is measured too — on the app's ngspice —; its points are still checked)
    ['un punto que no es un nodo de un esquema no lineal', (f) => {
      const t = tarjetaDe(f, 'mida-tension');
      t.widget = { tipo: 'circuito', esquema: 'diodo', piezas: { fuente: 'V_in', r: 'R_1', vd: 'V_k2' }, mide: { corriente: 'I_dv' }, instrumento: { tipo: 'multimetro', puntos: { zz: 'A', '0': 'Masa' } }, mandos: [] };
    }, /«widget.instrumento.puntos.zz»: no es un nodo del esquema diodo/],
    ['medir una rama que no está', (f) => (tarjetaDe(f, 'mida-corriente').medir.rama = 'vm9'), /«medir.rama»: una rama del instrumento/],
    ['medir con un valor que no es el que marcaría', (f) => (tarjetaDe(f, 'mida-corriente').medir.valor = 'I_k1'), /el multímetro marcaría/],
    ['un porqué de una medida imposible', (f) => (tarjetaDe(f, 'mida-tension').medir.porque.zz = 'No.'), /ni un punto, ni una rama/],
    ['medir sin instrumento', (f) => delete tarjetaDe(f, 'mida-tension').widget.instrumento, /necesita un widget «circuito» con «instrumento»/],
    ['una corriente con un osciloscopio', (f) => (tarjetaDe(f, 'mida-senal').medir.magnitud = 'corriente'), /necesita un multímetro/],
    ['elegir una zona que no es una pieza', (f) => (tarjetaDe(f, 'elija-carga').elegir.zonas.r9 = 'Otra'), /no es una pieza de este widget/],
    ['elegir un nodo que no existe', (f) => (tarjetaDe(f, 'elija-carga').elegir.zonas['red:zz'] = 'Otro'), /no es un nodo del esquema/],
    ['elegir sin el porqué de una zona', (f) => delete tarjetaDe(f, 'elija-carga').elegir.porque.r1, /cada zona que no es la respuesta dice por qué no/],
    ['marcar que empieza en el objetivo', (f) => (tarjetaDe(f, 'marque-maximo').marcar.inicio.x = 2.4), /empieza ya en el objetivo/],
    ['marcar sin ninguna posición dentro', (f) => Object.assign(tarjetaDe(f, 'marque-punto').marcar, { tol: 0.001, pasos: 11 }), /ninguna posición del marcador/],
    ['marcar fuera del eje', (f) => (tarjetaDe(f, 'marque-maximo').marcar.x = 'R_th*10'), /cae fuera del eje/],
    ['marcar en un eje que el modo no mueve', (f) => (tarjetaDe(f, 'marque-maximo').marcar.y = 'P_max'), /con «modo: x» no se marca en y/],
    ['leer con un error que es la respuesta', (f) => (tarjetaDe(f, 'lea-corriente').leer.errores[0].expr = 'I_k3*1.001'), /dentro de la tolerancia: no es un error/],
    ['un objetivo que no se alcanza', (f) => (tarjetaDe(f, 'explore-objetivo').objetivo.condiciones[0].objetivo = 11.5), /el objetivo no se alcanza/],
    ['un objetivo cumplido al empezar', (f) => (tarjetaDe(f, 'explore-objetivo').inicio = { R_1: 2000, R_2: 1000 }), /se cumple ya al empezar/],
    ['un objetivo en una tarjeta que se responde', (f) => (tarjetaDe(f, 'elija-carga').objetivo = { condiciones: [{ valor: 'V_kn', min: 1, rotulo: 'x' }], logrado: 'Bien.' }), /«objetivo» va en una tarjeta explorar, sorpresa o ajuste/],
    ['un objetivo sin «logrado»', (f) => delete tarjetaDe(f, 'explore-objetivo').objetivo.logrado, /falta «objetivo.logrado»/],
  ];
  for (const [nombre, cambio, re] of casos) test(nombre, () => expect(errores(cambio)).toMatch(re));
});

test.describe('motor: el veredicto habla de lo que hizo', () => {
  const con = (e: EstadoTarjeta, c: Partial<EstadoTarjeta>): EstadoTarjeta => ({ ...e, ...c });

  test('medir una tensión: la medida equivocada dice dónde puso las puntas y qué mide; la buena, con su lectura', () => {
    const t = T('mida-tension');
    let e = nuevoEstado(t);
    expect(botonPrincipal(t, e, {}).bloqueado).toBe(true);
    e = con(e, { medida: { ...e.medida!, roja: 'f1', negra: 'n' } });
    let r = comprobar(L, t, e, valores(t));
    expect(r.aviso.bien).toBe(false);
    expect(plano(r)).toContain('Ha puesto la punta roja en «Arriba de la fuente izquierda» y la negra en «Nodo de arriba»: 4,80 V');
    expect(plano(r)).toContain('Así mide la caída en R₁');
    // in amperes, a voltage is not measured: the mode is said
    e = con(e, { medida: { ...e.medida!, modo: 'A', rama: 'vm3' } });
    r = comprobar(L, t, e, valores(t));
    expect(plano(r)).toContain('Una tensión se mide en paralelo');
    // the probes reversed count too (polarity not asked)
    e = con(e, { medida: { ...e.medida!, modo: 'V', roja: '0', negra: 'n' } });
    expect(comprobar(L, t, e, valores(t)).aviso.bien).toBe(true);
    e = con(e, { medida: { ...e.medida!, modo: 'V', roja: 'n', negra: '0' } });
    r = comprobar(L, t, e, valores(t));
    expect(r.aviso.bien).toBe(true);
    expect(plano(r)).toContain('7,20 V');
  });

  test('medir una corriente: otra rama se explica con la suya', () => {
    const t = T('mida-corriente');
    const e0 = nuevoEstado(t);
    let r = comprobar(L, t, con(e0, { medida: { ...e0.medida!, modo: 'A', rama: 'vm1' } }), valores(t));
    expect(plano(r)).toContain('«Rama de R₁»: 4,80 mA');
    expect(plano(r)).toContain('Esa es la corriente de R₁');
    r = comprobar(L, t, con(e0, { medida: { ...e0.medida!, modo: 'V', roja: 'n', negra: '0' } }), valores(t));
    expect(plano(r)).toContain('Una corriente se mide en serie');
    r = comprobar(L, t, con(e0, { medida: { ...e0.medida!, modo: 'A', rama: 'vm3' } }), valores(t));
    expect(r.aviso.bien).toBe(true);
  });

  test('medir con el osciloscopio: el punto equivocado se explica', () => {
    const t = T('mida-senal');
    const e0 = nuevoEstado(t);
    expect(e0.medida?.negra).toBeNull();
    let r = comprobar(L, t, con(e0, { medida: { ...e0.medida!, roja: 'in' } }), valores(t));
    expect(plano(r)).toContain('En la entrada la senoidal está entera');
    r = comprobar(L, t, con(e0, { medida: { ...e0.medida!, roja: 'out' } }), valores(t));
    expect(r.aviso.bien).toBe(true);
  });

  test('elegir: la zona mala se explica y queda descartada; tocar de nuevo la quita', () => {
    const t = T('elija-carga');
    const a = t.actividad as Elegir;
    let ea = nuevoEstado(t).actividad as EstadoElegir;
    ea = tocarZona(a, ea, 'red:n');
    expect(ea.elegidas).toEqual(['red:n']);
    let r = comprobar(L, t, con(nuevoEstado(t), { actividad: ea }), valores(t));
    expect(r.aviso.bien).toBe(false);
    expect(plano(r)).toContain('En ese nodo se juntan');
    ea = r.estado.actividad as EstadoElegir;
    expect(ea.descartadas).toEqual(['red:n']);
    expect(tocarZona(a, ea, 'red:n')).toBe(ea);
    ea = tocarZona(a, ea, 'r3');
    r = comprobar(L, t, con(nuevoEstado(t), { actividad: ea }), valores(t));
    expect(r.aviso.bien).toBe(true);
  });

  test('marcar: dice hacia dónde, con la pista de la tarjeta; dentro de la tolerancia, bien', () => {
    const t = T('marque-maximo');
    const e0 = nuevoEstado(t);
    expect(botonPrincipal(t, e0, {}).bloqueado).toBe(true);
    let r = comprobar(L, t, con(e0, { actividad: { tipo: 'marcar', x: 6, y: 0, movida: true } }), valores(t));
    expect(plano(r)).toContain('Más a la izquierda');
    r = comprobar(L, t, con(e0, { actividad: { tipo: 'marcar', x: 1, y: 0, movida: true } }), valores(t));
    expect(plano(r)).toContain('Más a la derecha');
    r = comprobar(L, t, con(e0, { actividad: { tipo: 'marcar', x: 2.5, y: 0, movida: true } }), valores(t));
    expect(r.aviso.bien).toBe(true);
    // a free point: both coordinates, each said when off
    const p = T('marque-punto');
    r = comprobar(L, p, con(nuevoEstado(p), { actividad: { tipo: 'marcar', x: 2.4, y: 3, movida: true } }), valores(p));
    expect(r.aviso.bien).toBe(false);
    r = comprobar(L, p, con(nuevoEstado(p), { actividad: { tipo: 'marcar', x: 2.4, y: 5.4, movida: true } }), valores(p));
    expect(r.aviso.bien).toBe(true);
  });

  test('leer: el error típico, un prefijo equivocado y la buena con unidad', () => {
    const t = T('lea-corriente');
    const e0 = nuevoEstado(t);
    const leido = (texto: string, valor: number) => con(e0, { actividad: { tipo: 'leer', texto, valor } });
    let r = comprobar(L, t, leido('4,8 m', 0.0048), valores(t));
    expect(plano(r)).toContain('Esa es la corriente de R₁');
    r = comprobar(L, t, leido('3,6', 3.6), valores(t));
    expect(plano(r)).toContain('factor mil');
    r = comprobar(L, t, leido('3,6 mA', 0.0036), valores(t));
    expect(r.aviso.bien).toBe(true);
  });

  test('objetivo: «Continuar» se abre al alcanzarlo y no se vuelve a cerrar', () => {
    const t = T('explore-objetivo');
    const mc = compilarModelo(L.modelo);
    const e0 = { ...nuevoEstado(t), movidos: ['R_1'] };
    const lejos = mc.evaluar({ ...valores(t), R_1: 1000, R_2: 1000 });
    const dentro = mc.evaluar({ ...valores(t), R_1: 4000, R_2: 2000 });
    expect(exploracionHecha(t, e0, lejos)).toBe(false);
    expect(faltaPorExplorar(L, t, e0, lejos)).toBe('Para seguir, consiga el objetivo de la tarjeta.');
    expect(exploracionHecha(t, e0, dentro)).toBe(true);
    // (the shell latches it: EstadoTarjeta.logrado)
    expect(exploracionHecha(t, { ...e0, logrado: true }, lejos)).toBe(true);
  });
});

test.describe('tocar en orden (una foto) y la mezcla de las lecciones', () => {
  const leer = (id: string) => JSON.parse(fs.readFileSync(path.join(web, 'public', 'libro', 'lecciones11', `${id}.json`), 'utf8')) as Leccion11;

  test('tocar en orden: la primera fuera de su sitio se dice y se quitan las de detrás', () => {
    const l = leer('consola-snes/snes-alimentacion');
    const t = l.tarjetas.find((x) => x.id === 'ordene-camino')!;
    const e0 = nuevoEstado(t);
    const con = (elegidas: string[]) => ({ ...e0, actividad: { tipo: 'tocar' as const, elegidas, descartadas: [] } });
    let r = comprobar(l, t, con(['j1', 't1', 'f1']), {});
    expect(r.aviso.bien).toBe(false);
    expect(plano(r)).toContain('Las 2 primeras van bien; en el puesto 3 no va «Fusible (F1)»');
    expect((r.estado.actividad as { elegidas: string[] }).elegidas).toEqual(['j1', 't1']);
    r = comprobar(l, t, con(['j1', 't1']), {});
    expect(plano(r)).toContain('le faltan 4');
    r = comprobar(l, t, con(['j1', 't1', 'db1', 'f1', 'c67', 'u12']), {});
    expect(r.aviso.bien).toBe(true);
  });

  test('clases de tarjeta y el aviso por debajo de la mitad', () => {
    expect(claseTarjeta({ tipo: 'explorar' } as Tarjeta)).toBe('mirar');
    expect(claseTarjeta({ tipo: 'explorar', objetivo: { condiciones: [], logrado: [], pistas: [] } } as unknown as Tarjeta)).toBe('hacer');
    expect(claseTarjeta({ tipo: 'predecir', opciones: [] } as unknown as Tarjeta)).toBe('elegir');
    expect(claseTarjeta({ tipo: 'pregunta', estimar: {} } as unknown as Tarjeta)).toBe('elegir');
    expect(claseTarjeta({ tipo: 'reto' } as Tarjeta)).toBe('hacer');
    expect(avisoMezcla({ hacer: 5, elegir: 5, mirar: 0, total: 10, opciones: 2 })).toBeNull();
    expect(avisoMezcla({ hacer: 7, elegir: 3, mirar: 0, total: 10, opciones: 3 })).toMatch(/3 tarjetas de opciones/);
    // a tap on a plain-text list of answers is choosing, a tap on a code listing is doing
    const lista = { tipo: 'tocar', widget: { tipo: 'figura', codigo: { lenguaje: 'texto', texto: 'a\nb' } } };
    const codigo = { tipo: 'tocar', widget: { tipo: 'figura', codigo: { lenguaje: 'c', texto: 'x = 1;' } } };
    expect(claseTarjeta(lista as unknown as Tarjeta)).toBe('elegir');
    expect(claseTarjeta(codigo as unknown as Tarjeta)).toBe('hacer');
    expect(mezclaDe([lista, codigo] as unknown as Tarjeta[]).opciones).toBe(1);
    expect(avisoMezcla({ hacer: 4, elegir: 5, mirar: 1, total: 10, opciones: 3 })).toMatch(/4 de 10 tarjetas se responden haciendo \(40 %/);
  });

  test('las tres lecciones piloto: al menos el 70 % haciendo y como mucho dos de opciones', () => {
    for (const id of ['cap01/sec-1.5', 'cap08/sec-8.1', 'consola-snes/snes-alimentacion']) {
      const m = mezclaDe(leer(id).tarjetas);
      expect(m.hacer / m.total, id).toBeGreaterThanOrEqual(0.7);
      expect(m.opciones, id).toBeLessThanOrEqual(2);
    }
  });
});
