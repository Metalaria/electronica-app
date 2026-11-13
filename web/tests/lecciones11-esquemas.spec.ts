// 1.1 widget catalogue, in Node (no browser, no server): the registry of circuit schematics (one folder each, nothing
// listed by hand), every schematic's model against the app's ngspice through the generator (the catalogue lesson
// tests/lecciones11-catalogo/cap01/sec-1.5.yaml: the initial state, both ends of every control), mistakes in a model
// caught by that check (a wrong formula, β for β + 1, the ripple at the wrong frequency…), the comparison and its
// tolerances (lib/leccion11/spice.ts), the generator's rules for circuits and graphs, wright() and numeroAria().
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones11-esquemas.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import { compararSimulacion, terminos, type ComprobacionSpice, type GraficaSim } from '../src/lib/leccion11/spice.ts';
import { esquemaDe, nombresEsquemas, registrarEsquemas } from '../src/lib/leccion11/esquemas/registro.ts';
import type { ContextoDibujo } from '../src/lib/leccion11/esquemas/tipos.ts';
import { wright } from '../src/componentes/calculadoras/expresion.ts';
import { numeroAria } from '../src/lib/teoria-viva.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11, carpetasEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirEsquemas = path.join(web, 'src', 'lib', 'leccion11', 'esquemas');
const CATALOGO = path.join(web, 'tests', 'lecciones11-catalogo');
const ID = 'cap01/sec-1.5';
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
};
const fuente = () => fs.readFileSync(path.join(CATALOGO, `${ID}.yaml`), 'utf8');
type Fuente = { tarjetas: Record<string, unknown>[] };
const generar = (texto = fuente()) => generarLeccion(parse(texto), contexto, 'catalogo');
/** Errors of the catalogue lesson with one card changed. */
function errores(id: string, cambio: (t: Record<string, unknown>) => void): string {
  const f = parse(fuente()) as Fuente;
  cambio(f.tarjetas.find((t) => t.id === id)!);
  return generarLeccion(f, contexto, 'catalogo').errores.join('\n');
}
const correr = (fuentes: string, args: string[] = []) =>
  spawnSync('node', [path.join(web, 'scripts', 'lecciones11.mjs'), '--solo', ID, '--comprobar', ...args], { cwd: web, env: { ...process.env, EPA_LECCIONES11: fuentes }, encoding: 'utf8' });

test.describe('registro de esquemas', () => {
  test('cada carpeta con esquema.ts y Dibujo.svelte está registrada con su nombre; nada más', () => {
    const carpetas = carpetasEsquemas11() as string[];
    expect(carpetas.length).toBeGreaterThanOrEqual(22);
    expect(nombresEsquemas()).toEqual(carpetas);
    for (const c of carpetas) {
      expect(fs.existsSync(path.join(dirEsquemas, c, 'Dibujo.svelte')), c).toBe(true);
      expect(esquemaDe(c)!.nombre).toBe(c);
    }
    // the app collects the same folders (definiciones.ts, dibujos.ts) with import.meta.glob
    expect(fs.readFileSync(path.join(dirEsquemas, 'definiciones.ts'), 'utf8')).toContain("import.meta.glob<DefinicionEsquema>('./*/esquema.ts'");
    expect(fs.readFileSync(path.join(dirEsquemas, 'dibujos.ts'), 'utf8')).toContain("import.meta.glob<Component<PropsDibujo>>('./*/Dibujo.svelte'");
  });

  test('cada definición: medidas que el simulador entiende, piezas coherentes y una descripción para el lector', () => {
    for (const n of nombresEsquemas()) {
      const d = esquemaDe(n)!;
      expect(d.titulo.length, n).toBeGreaterThan(5);
      expect(Object.values(d.piezas).some((p) => p.obligatoria), n).toBe(true);
      for (const [k, o] of Object.entries(d.observables)) {
        expect(terminos(o.medida), `${n}.${k}`).not.toBeNull();
        for (const q of o.requiere ?? []) expect(d.piezas[q], `${n}.${k} requiere ${q}`).toBeTruthy();
        if (o.analisis === 'ac') expect(d.piezas.f, `${n}.${k}: en alterna hace falta la pieza f`).toBeTruthy();
      }
      for (const x of d.noLineal?.(() => true) ?? []) {
        expect(d.piezas[x.pieza], `${n}: ${x.pieza}`).toBeTruthy();
        expect(x.desviacion, n).toBeGreaterThan(0);
        expect(x.desviacion, n).toBeLessThanOrEqual(0.25);
      }
      const c: ContextoDibujo = {
        p: () => 1, tiene: () => true, cerrado: () => true, sim: (q) => q.toUpperCase(), simT: (q) => [{ t: 'txt', s: q }], rot: (q) => [{ t: 'txt', s: q }],
        val: () => '1 Ω', ver: () => '1 V', id: (q) => q, n: () => 1, unidad: () => 'V', oculto: false,
      };
      expect(d.describir(c).length, n).toBeGreaterThan(20);
      // every netlist line of every analysis is text without «undefined» or «NaN»
      for (const a of ['op', 'tran', 'ac'] as const) expect(d.netlist(c, a).join('\n'), `${n} ${a}`).not.toMatch(/undefined|NaN/);
    }
  });

  test('una carpeta que declara otro nombre, o un nombre repetido, no se registra', () => {
    const d = esquemaDe('divisor')!;
    expect(() => registrarEsquemas([['otro', d]])).toThrow(/declara el nombre «divisor»/);
    expect(() => registrarEsquemas([['divisor', { ...d }]])).toThrow(/dos esquemas con el nombre «divisor»/);
    expect(() => registrarEsquemas([['x', {} as never]])).toThrow(/no exporta/);
  });
});

test.describe('cada esquema frente a ngspice (la lección de catálogo)', () => {
  // (esquemas12: the catalogue's 272 simulations take about a minute, and the mutations run it eight times)
  test.setTimeout(900_000);

  test('se genera y tiene comprobaciones de cada esquema en el estado inicial y en los extremos de cada mando', () => {
    const r = generar();
    expect(r.errores).toEqual([]);
    const l = r.leccion!;
    for (const t of l.tarjetas) {
      if (t.widget?.tipo !== 'circuito') continue;
      const propias = r.spice.filter((c) => c.donde.includes(`tarjeta ${t.id} `));
      const estados = new Set(propias.map((c) => /estado (\d+)/.exec(c.donde)![1]));
      expect(estados.size, t.id).toBe(1 + 2 * t.widget.mandos.length);
      // the analyses its readings and curves need
      const analisis = new Set(propias.map((c) => c.analisis));
      if (t.widget.grafica?.curvas.some((c) => c.mide)) expect(analisis.has(t.widget.grafica.x.unidad === 'Hz' ? 'ac' : 'tran'), t.id).toBe(true);
    }
  });

  test('el simulador confirma el modelo de cada esquema (continua, alterna, transitorio, diodos y transistores)', () => {
    const r = correr(CATALOGO);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/1 lecciones correctas \((\d{3,}) comprobaciones con el simulador\)/);
  });

  test('un modelo equivocado no pasa: cada error, en su tarjeta', () => {
    const mutaciones: [string, string, string, RegExp][] = [
      ['β en lugar de β + 1', '(par(R_p1, R_p2) + (beta + 1)*R_pe)', '(par(R_p1, R_p2) + beta*R_pe)', /tarjeta bjt-polarizacion .*con la caída real del simulador/],
      ['τ doble', '"V_c0 + (V_cf - V_c0)*(1 - exp(-t/tau_c))"', '"V_c0 + (V_cf - V_c0)*(1 - exp(-t/(2*tau_c)))"', /tarjeta carga-rc .*la curva 1 \(vc\)/],
      ['rizado del puente a f en vez de 2f', 'T_red/2*floor((t - T_red/4)/(T_red/2))', 'T_red*floor((t - T_red/4)/T_red)', /tarjeta puente .*la curva 1 \(salida\)/],
      ['fase de v_C con el signo cambiado', 'phi_f - atan(x_c)*180/pi', 'phi_f + atan(x_c)*180/pi', /tarjeta rc-tiempo .*fase\(v\(c\)\)/],
      ['corriente del primario al revés', 'expr: "I_2*N_2/N_1"', 'expr: "I_2*N_1/N_2"', /tarjeta transformador .*i\(vmed\)/],
      ['un 2 % de más en la resistencia del diodo', 'max(0, (V_d - V_D)/R_d)', 'max(0, (V_d - V_D)/(1.02*R_d))', /tarjeta diodo-caida .*i\(vmed\)/],
      ['resonancia con el signo de X_C cambiado', '(2*pi*nu*L_r - 1/(2*pi*nu*C_r))^2', '(2*pi*nu*L_r + 1/(2*pi*nu*C_r))^2', /tarjeta rlc-resonancia .*mag\(i\(vmed\)\)/],
      ['detector sin su resistencia', '(par(R_w1, R_w2) + R_wd + par(R_w3, R_w4))', '(par(R_w1, R_w2) + par(R_w3, R_w4))', /tarjeta wheatstone .*v\(a\)-v\(b\)/],
    ];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epa-l11e-'));
    fs.mkdirSync(path.join(dir, 'cap01'));
    for (const [nombre, a, b, esperado] of mutaciones) {
      expect(fuente().split(a).length, nombre).toBe(2);
      // (esquemas12c: only the mutated card and the cards without a circuit — the whole catalogue, 400 checks with
      // ngspice, took three and a half minutes for each of the eight mutations)
      const f = parse(fuente().replace(a, b)) as Fuente;
      const tarjeta = /tarjeta (\S+)/.exec(esperado.source)![1]!;
      f.tarjetas = f.tarjetas.filter((t) => t.id === tarjeta || (t.widget as { tipo?: string } | undefined)?.tipo !== 'circuito');
      fs.writeFileSync(path.join(dir, `${ID}.yaml`), stringify(f));
      const r = correr(dir);
      expect(r.status, nombre).toBe(1);
      expect(r.stderr, nombre).toMatch(esperado);
    }
    fs.rmSync(dir, { recursive: true });
  });
});

test.describe('la comparación con el simulador', () => {
  const op = (vectores: Record<string, number>): GraficaSim => ({ analisis: 'Operating Point', vectores: Object.entries(vectores).map(([nombre, v]) => ({ nombre, re: [v], im: null })) });
  const base: ComprobacionSpice = { donde: 'x', netlist: '', analisis: 'op', valores: [], curvas: [] };

  test('medidas: sumas y restas de vectores, con coeficientes', () => {
    expect(terminos('v(a)-v(b)')).toEqual([{ signo: 1, vector: 'v(a)' }, { signo: -1, vector: 'v(b)' }]);
    expect(terminos('-i(vf)')).toEqual([{ signo: -1, vector: 'i(vf)' }]);
    expect(terminos('v(s)-7*i(vzm)')).toEqual([{ signo: 1, vector: 'v(s)' }, { signo: -7, vector: 'i(vzm)' }]);
    expect(terminos('v(a)v(b)')).toBeNull();
    expect(terminos('2+v(a)')).toBeNull();
  });

  test('continua: la tolerancia, un vector que falta y la corrección por la caída real de un diodo', () => {
    const g = [op({ 'v(a)': 4.003, 'v(b)': 1, 'i(vmed)': 0.0043, 'v(an)': 0.62 })];
    expect(compararSimulacion({ ...base, valores: [{ medida: 'v(a)-v(b)', esperado: 3, tol: 0.003 }] }, g)).toHaveLength(1);
    expect(compararSimulacion({ ...base, valores: [{ medida: 'v(a)-v(b)', esperado: 3, tol: 0.0031 }] }, g)).toEqual([]);
    expect(compararSimulacion({ ...base, valores: [{ medida: 'v(z)', esperado: 3, tol: 1 }] }, g)[0]).toMatch(/no da v\(z\)/);
    // 5 V, 1 kΩ and a diode of 0,7 V in the model; the simulator's diode drops 0,62 V: I = 4,38 mA would be right
    const diodo = (real: number, max = 0.1) =>
      compararSimulacion({ ...base, valores: [{ medida: 'i(vmed)', esperado: 0.0043, tol: 4.3e-6, correcciones: [{ pieza: 'vd', medida: 'v(an)', base: 0.7, pendiente: -1e-3, max }] }] }, [op({ 'i(vmed)': real, 'v(an)': 0.62 })]);
    expect(diodo(0.00438)).toEqual([]);
    expect(diodo(0.0043)[0]).toMatch(/el modelo da 0.0043 \(0.00438 con la caída real del simulador\)/);
    expect(diodo(0.00438, 0.05)[0]).toMatch(/«vd» supone 0.7 V y el dispositivo del simulador cae 0.62 V/);
  });

  test('curvas: el desfase de periodos, el peor punto, la fase que da la vuelta', () => {
    const t = Array.from({ length: 101 }, (_, k) => 0.02 + k * 0.0002);
    const g: GraficaSim = { analisis: 'Transient Analysis', vectores: [{ nombre: 'time', re: t, im: null }, { nombre: 'v(s)', re: t.map((x) => Math.sin(2 * Math.PI * 50 * x)), im: null }] };
    const curva = (modelo: (x: number) => number) => ({ medida: 'v(s)', nombre: 'la curva 1', eje: 't', min: 0, max: 0.02, desfase: 0.02, modelo, tol: () => 0.01 });
    expect(compararSimulacion({ ...base, analisis: 'tran', curvas: [curva((x) => Math.sin(2 * Math.PI * 50 * x))] }, [g])).toEqual([]);
    expect(compararSimulacion({ ...base, analisis: 'tran', curvas: [curva((x) => Math.cos(2 * Math.PI * 50 * x))] }, [g])[0]).toMatch(/la curva 1: en t = .* el modelo da/);
    expect(compararSimulacion({ ...base, analisis: 'ac', curvas: [] }, [g])[0]).toMatch(/no ha hecho el análisis ac/);
    // a phase of −179° and one of +179° are 2° apart
    const ac: GraficaSim = { analisis: 'AC Analysis', vectores: [{ nombre: 'frequency', re: [100], im: [0] }, { nombre: 'v(c)', re: [-1], im: [-0.0175] }] };
    const fase = (m: number) => compararSimulacion({ ...base, analisis: 'ac', curvas: [{ medida: 'v(c)', ac: 'fase', nombre: 'f', eje: 'nu', min: 10, max: 1000, desfase: 0, modelo: () => m, tol: () => 0.1 }] }, [ac]);
    expect(fase(-179)).toEqual([]);
    expect(fase(179)).toHaveLength(1);
  });
});

test.describe('el generador: circuitos y gráficas', () => {
  const casos: [string, string, (t: Record<string, unknown>) => void, RegExp][] = [
    ['un esquema que no existe', 'serie', (t) => ((t.widget as Record<string, unknown>).esquema = 'serie3'), /«serie3» no existe; los esquemas son: .*bjt-interruptor/],
    ['una pieza que el esquema no tiene', 'serie', (t) => (((t.widget as Record<string, unknown>).piezas as Record<string, string>).r5 = 'R_s1'), /pieza desconocida del esquema serie/],
    ['una pieza obligatoria que falta', 'mixto', (t) => delete ((t.widget as Record<string, unknown>).piezas as Record<string, string>).r3, /«widget.piezas.r3» falta/],
    ['una medida que necesita una pieza que no está', 'serie', (t) => {
      const w = t.widget as Record<string, Record<string, string>>;
      delete w.piezas!.r4;
      delete w.piezas!.r3;
      w.mide = { v3: 'V_s3' };
    }, /«widget.mide.v3» necesita la pieza r3/],
    ['una curva en «mide»', 'carga-rc', (t) => ((t.widget as Record<string, unknown>).mide = { vc: 'tau_c' }), /es una curva frente al tiempo/],
    ['«mide» en una gráfica sin circuito', 'grafica-log', (t) => (((t.widget as Record<string, unknown>).curvas as Record<string, unknown>[])[0]!.mide = 'vc'), /«mide» solo en la gráfica de un circuito/],
    ['una curva que el esquema no mide', 'carga-rl', (t) => ((((t.widget as Record<string, Record<string, unknown>>).grafica!.curvas) as Record<string, unknown>[])[0]!.mide = 'vc'), /«mide» es una curva del esquema carga-rl: i, vl, vr/],
    ['un eje logarítmico desde 0', 'rc-frecuencia', (t) => (((t.widget as Record<string, Record<string, Record<string, unknown>>>).grafica!.x!).min = 0), /un eje logarítmico empieza por encima de 0/],
    ['la caída de un diodo como cálculo', 'diodo-caida', (t) => (((t.widget as Record<string, unknown>).piezas as Record<string, string>).vd = 'V_dc'), /la caída constante del libro debe ser un valor del modelo/],
    ['dos modelos de diodo a la vez', 'diodo-caida', (t) => Object.assign((t.widget as Record<string, unknown>).piezas as object, { is: 'I_S', n: 'n_d' }), /o el modelo de caída constante \(«vd»\) o el de Shockley/],
    ['sin dibujo ni gráfica', 'serie', (t) => ((t.widget as Record<string, unknown>).dibujo = false), /sin «grafica»: no quedaría nada que ver/],
    ['un circuito sin nada que comprobar', 'thevenin', (t) => delete (t.widget as Record<string, unknown>).mide, /«widget.mide»: qué cálculo del modelo da cada medida/],
    ['un interruptor que no es interruptor', 'kirchhoff', (t) => (((t.widget as Record<string, unknown>).piezas as Record<string, string>).activa1 = 'V_k1'), /«widget.piezas.activa1» debe ser un interruptor del modelo/],
    ['una marca sin rótulo', 'carga-rc', (t) => delete ((((t.widget as Record<string, Record<string, unknown>>).grafica!.marcas) as Record<string, unknown>[])[0]!.rotulo), /marcas 1: falta «rotulo»/],
  ];
  for (const [nombre, id, cambio, esperado] of casos)
    test(nombre, () => {
      expect(errores(id, cambio)).toMatch(esperado);
    });

  test('lo nuevo solo aparece en el JSON cuando se usa (las lecciones publicadas no cambian)', () => {
    const l = generar().leccion!;
    const t = (id: string) => l.tarjetas.find((x) => x.id === id)!;
    const serie = t('serie').widget!;
    expect('grafica' in serie || 'dibujo' in serie).toBe(false);
    const rc = t('rc-frecuencia').widget!;
    expect(rc.tipo === 'circuito' && rc.grafica?.x.escala).toBe('log');
    expect(rc.tipo === 'circuito' && rc.grafica?.y.escala).toBeUndefined();
    expect(t('descarga-rc').widget!.tipo === 'circuito' && (t('descarga-rc').widget as { dibujo?: boolean }).dibujo).toBe(false);
  });
});

test.describe('funciones', () => {
  test('wright(x): w + ln w = x, sin desbordarse; resuelve el diodo de Shockley como ngspice', () => {
    for (const x of [-700, -30, -1, 0, 1, 5, 50, 1000, 1e6]) {
      const w = wright(x);
      expect(w, String(x)).toBeGreaterThan(0);
      expect(Math.abs(w + Math.log(w) - x), String(x)).toBeLessThan(1e-9 * Math.max(1, Math.abs(x)));
    }
    expect(wright(0)).toBeCloseTo(0.5671432904097838, 14);
    // 5 V, 1 kΩ, IS = 10⁻¹² A, n = 1, VT = 25,85 mV: the simulator gives 4,4258 mA (and 0,5742 V)
    const nVT = 0.02585;
    const i = (nVT / 1000) * wright(Math.log((1e-12 * 1000) / nVT) + (5 + 1e-12 * 1000) / nVT) - 1e-12;
    expect(i).toBeCloseTo(0.0044258, 6);
  });

  test('numeroAria: sin exponente (axe lo rechaza), igual que String() cuando no lo hay', () => {
    expect(numeroAria(5000)).toBe('5000');
    expect(numeroAria(0.5)).toBe('0.5');
    expect(numeroAria(1.5915e-7)).toBe('0.00000015915');
    expect(numeroAria(2e-9)).toBe('0.000000002');
    expect(numeroAria(1e21)).toBe('1000000000000000000000');
    expect(numeroAria(-4.7e-12)).toBe('-0.0000000000047');
  });
});
