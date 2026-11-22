// 1.3 (motor13) «explorar sin modelo», in Node (no browser, no server): a goal of zones to touch on a book figure
// (GUIA §13.3, «Sobre una figura»), on the catalogue lesson tests/lecciones12-catalogo/cap16/sec-16.16.yaml (the
// published lesson without a numeric model, its explore card with a goal and one more in order): the generator's rules
// (each broken on purpose), the zone variables the shell adds, the gating of «Continuar», the live advice of an ordered
// goal, the lesson's mix (both explore cards count as doing), and a lesson without a model that has «tocar» cards and
// no «explorar». And «repaso haciendo» (GUIA §13.13) on tests/lecciones12-catalogo/cap01/sec-1.10.yaml: the review
// variants of a card (declared, automatic), deterministic, their texts written again from the model, every one checked
// by the app's ngspice, chosen by the session's seed, checked with their own values under the card's answer id, and
// each rule broken on purpose. Deterministic.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones13-motor-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import { compilarModelo, enRango, formatear, valoresDeTarjeta } from '../src/lib/leccion11/modelo.ts';
import { botonPrincipal, comprobar, entradaIndice, esPracticable, eventoDeComprobacion, faltaPorExplorar, idRespuesta, nuevoEstado, valoresSueltos } from '../src/lib/leccion11/motor.ts';
import { compararSimulacion } from '../src/lib/leccion11/spice.ts';
import { conVariante, descartarVariantes, elegirVariante, PALABRAS_DE_PROPORCION, rotuloVariante, sustituirNumeros } from '../src/lib/leccion12/variantes.ts';
import { textoPlano } from '../src/lib/leccion11/texto.ts';
import type { Leccion11, Tarjeta } from '../src/lib/leccion11/tipos.ts';
import { claseTarjeta, mezclaDe } from '../src/lib/leccion12/hacer/generar-hacer.ts';
import { consejoObjetivo, objetivoCumplido } from '../src/lib/leccion12/hacer/motor-hacer.ts';
import { tocarVisita, variablesFigura, variablesWidget12 } from '../src/lib/leccion12/digital/objetivo-figura.ts';
import type { EstadoWidget12, WidgetFigura } from '../src/lib/leccion12/digital/tipos.ts';
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
const FUENTE = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap16', 'sec-16.16.yaml'), 'utf8'));
const CIRCUITO = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap01', 'sec-1.5.yaml'), 'utf8'));
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const generar = (f: unknown) => generarLeccion(f, contexto, 'catalogo-motor13');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type F = { modelo: any; tarjetas: Record<string, any>[] };
const tarjetaDe = (f: F, id: string) => f.tarjetas.find((t) => t.id === id)!;
function errores(cambio: (f: F) => void, fuente: unknown = FUENTE): string {
  const f = copia(fuente) as F;
  cambio(f);
  return generar(f).errores.join('\n');
}
const R = generar(FUENTE);
const L = R.leccion as Leccion11;
const T = (id: string) => L.tarjetas.find((t) => t.id === id)!;
const mc = compilarModelo(L.modelo);
const w12 = (visitadas: string[]): EstadoWidget12 => ({ zona: visitadas[visitadas.length - 1] ?? null, visitadas, niveles: {}, logica: null, pulsos: 0, tramo: 0 });
/** The values the shell evaluates the card with (the model, empty here, and the figure's zones). */
const valores = (id: string, visitadas: string[]) => ({ ...mc.evaluar({}), ...variablesWidget12(T(id), w12(visitadas)) });

test.describe('objetivo de zonas en una figura', () => {
  test('el catálogo se genera; las dos exploraciones llevan su objetivo y cuentan como «haciendo»', () => {
    expect(R.errores).toEqual([]);
    const a = T('explore-equivalente');
    expect(a.objetivo?.condiciones.map((c) => [c.valor, c.min])).toEqual([['zona:coincidir', 1], ['zona:diferir', 1], ['zona:trampas', 1]]);
    expect(a.objetivo?.orden).toBeUndefined();
    expect(a.fase).toBe('Consiga');
    expect(T('explore-orden').objetivo?.orden).toBe(true);
    expect(claseTarjeta(a)).toBe('hacer');
    expect(claseTarjeta(T('explore-orden'))).toBe('hacer');
    expect(mezclaDe(L.tarjetas)).toMatchObject({ hacer: 5, elegir: 1, mirar: 0, total: 6 });
    // (without the goal, as the lesson was published in 1.2.1, its exploration was «looking»)
    const f = copia(FUENTE) as F;
    delete tarjetaDe(f, 'explore-equivalente').objetivo;
    tarjetaDe(f, 'explore-equivalente').requiere = { mover: ['coincidir', 'diferir', 'trampas'] };
    expect(claseTarjeta((generar(f).leccion as Leccion11).tarjetas.find((t) => t.id === 'explore-equivalente')!)).toBe('mirar');
  });

  test('las reglas del generador', () => {
    const casos: [string, (f: F) => void, RegExp][] = [
      ['una zona que la figura no tiene', (f) => (tarjetaDe(f, 'explore-equivalente').objetivo.condiciones[0].zona = 'arriba'), /«arriba» no es una zona de la figura \(coincidir, diferir, trampas\)/],
      ['una condición del modelo en una figura', (f) => (tarjetaDe(f, 'explore-equivalente').objetivo.condiciones[0] = { valor: 'x', min: 1, rotulo: 'x' }), /en una figura, una condición es \{ zona, rotulo \}/],
      ['«todavía no» como condición', (f) => (tarjetaDe(f, 'explore-equivalente').objetivo.condiciones[0].valor = 0), /solo va en una pista/],
      ['un valor que no es 0 ni 1', (f) => (tarjetaDe(f, 'explore-equivalente').objetivo.condiciones[0].valor = 2), /«valor»: 1 \(la zona se ha tocado/],
      ['una zona repetida', (f) => (tarjetaDe(f, 'explore-equivalente').objetivo.condiciones[1].zona = 'coincidir'), /una zona repetida/],
      ['en orden con una sola zona', (f) => (tarjetaDe(f, 'explore-orden').objetivo.condiciones = [{ zona: 'coincidir', rotulo: 'Una' }]), /una sola zona/],
      ['una clave desconocida', (f) => (tarjetaDe(f, 'explore-equivalente').objetivo.condiciones[0].mayor = 1), /clave desconocida «mayor»/],
      ['una pista sobre una zona que no hay', (f) => (tarjetaDe(f, 'explore-equivalente').objetivo.pistas[0].cuando.zona = 'nada'), /«nada» no es una zona/],
      ['sin «rotulo»', (f) => delete tarjetaDe(f, 'explore-equivalente').objetivo.condiciones[0].rotulo, /falta «objetivo.condicion 1.rotulo»/],
    ];
    for (const [nombre, cambio, re] of casos) expect(errores(cambio), nombre).toMatch(re);
    // «orden» only on a figure
    expect(errores((f) => (tarjetaDe(f, 'explore-objetivo').objetivo.orden = true), CIRCUITO)).toMatch(/«objetivo.orden»: true o false, en una tarjeta con una figura/);
  });

  test('las variables de las zonas: tocadas, y en orden solo las que siguen el orden', () => {
    const w = T('explore-orden').widget as WidgetFigura;
    const o = T('explore-orden').objetivo!;
    expect(variablesFigura(w, w12([]))).toMatchObject({ 'zona:coincidir': 0, 'zona:diferir': 0, 'zona:trampas': 0, 'zonas:tocadas': 0 });
    expect(variablesFigura(w, w12(['trampas', 'coincidir']))).toMatchObject({ 'zona:coincidir': 1, 'zona:diferir': 0, 'zona:trampas': 1, 'zonas:tocadas': 2 });
    // in order: «trampas» first does not count; the walk goes on from there
    expect(variablesFigura(w, w12(['trampas', 'coincidir']), o)).toMatchObject({ 'zona:coincidir': 1, 'zona:diferir': 0, 'zona:trampas': 0 });
    expect(variablesFigura(w, w12(['trampas', 'coincidir', 'diferir', 'trampas']), o)).toMatchObject({ 'zona:coincidir': 1, 'zona:diferir': 1, 'zona:trampas': 1 });
    // (the figure keeps its touches, the last ones)
    let e: EstadoWidget12 = w12([]);
    for (let k = 0; k < 150; k++) e = { ...e, visitadas: tocarVisita(e, k % 2 ? 'diferir' : 'coincidir') };
    expect(e.visitadas).toHaveLength(100);
    expect(e.visitadas!.at(-1)).toBe('diferir');
  });

  test('«Continuar» se abre al tocar las tres zonas, en cualquier orden; el consejo dice la que falta', () => {
    const t = T('explore-equivalente');
    const e0 = nuevoEstado(t);
    expect(botonPrincipal(t, e0, valores(t.id, [])).bloqueado).toBe(true);
    expect(faltaPorExplorar(L, t, e0, valores(t.id, []))).toBe('Para seguir, consiga el objetivo de la tarjeta.');
    expect(textoPlano(consejoObjetivo(t, valores(t.id, ['coincidir'])))).toBe('Falta el recuadro de abajo: las trampas de las tablas.');
    expect(textoPlano(consejoObjetivo(t, valores(t.id, ['trampas'])))).toBe('Toque los recuadros que faltan.');
    expect(objetivoCumplido(t, valores(t.id, ['trampas', 'diferir']))).toBe(false);
    const v = valores(t.id, ['trampas', 'diferir', 'coincidir']);
    expect(objetivoCumplido(t, v)).toBe(true);
    expect(botonPrincipal(t, { ...e0, movidos: ['trampas', 'diferir', 'coincidir'] }, v).bloqueado).toBe(false);
  });

  test('en orden: fuera de orden no cuenta, y el consejo dice la siguiente en cuanto se ha tocado algo', () => {
    const t = T('explore-orden');
    expect(consejoObjetivo(t, valores(t.id, []))).toBeUndefined();
    expect(textoPlano(consejoObjetivo(t, valores(t.id, ['diferir'])))).toBe('Van en orden. La siguiente: Arriba a la izquierda.');
    expect(textoPlano(consejoObjetivo(t, valores(t.id, ['diferir', 'coincidir'])))).toBe('Van en orden. La siguiente: Arriba a la derecha.');
    expect(objetivoCumplido(t, valores(t.id, ['trampas', 'diferir', 'coincidir']))).toBe(false);
    expect(objetivoCumplido(t, valores(t.id, ['coincidir', 'diferir', 'trampas']))).toBe(true);
  });
});

test.describe('una lección sin modelo numérico', () => {
  test('puede prescindir de la exploración si tiene tarjetas «tocar»; con modelo, no', () => {
    const sinExplorar = (f: F) => (f.tarjetas = f.tarjetas.filter((t) => t.tipo !== 'explorar'));
    expect(errores(sinExplorar)).not.toMatch(/falta al menos una tarjeta «explorar»/);
    expect(errores((f) => (sinExplorar(f), (f.tarjetas = f.tarjetas.filter((t) => t.tipo !== 'tocar'))))).toMatch(/falta al menos una tarjeta «explorar» \(o, sin modelo, una «tocar»\)/);
    expect(errores((f) => (sinExplorar(f), (f.modelo = { valores: { x: { valor: 1, nombre: 'x', unidad: 'V' } }, calculos: {} })))).toMatch(/falta al menos una tarjeta «explorar»$/m);
  });
});

// ------------------------------------------------------------------ B: review by doing (variants)

const FUENTE_B = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap01', 'sec-1.10.yaml'), 'utf8'));
const RB = generar(FUENTE_B);
const LB = RB.leccion as Leccion11;
const TB = (id: string) => LB.tarjetas.find((t) => t.id === id)!;
const kB = (id: string) => LB.tarjetas.findIndex((t) => t.id === id);
const mcB = compilarModelo(LB.modelo);
/** The values a card is checked with when asked on its own, as review asks it (TarjetaPractica: valoresSueltos + fijar). */
const sueltos = (t: Tarjeta) => valoresDeTarjeta(t, valoresSueltos(LB, kB(t.id)));
const erroresB = (cambio: (f: F) => void) => errores(cambio, FUENTE_B);

test.describe('repaso haciendo: variantes de una tarjeta', () => {
  test('declaradas: deterministas, dentro de lo declarado, con la respuesta distinta y los textos escritos de nuevo desde el modelo', () => {
    expect(RB.errores).toEqual([]);
    // the same every build
    expect(JSON.stringify(generar(FUENTE_B).leccion)).toBe(JSON.stringify(LB));
    const t = TB('prediga-bornes');
    expect(t.variantes?.length).toBe(3);
    const original = mcB.evaluar(sueltos(t)).V_to!;
    expect(original).toBeCloseTo(8.1, 6);
    for (const [k, v] of t.variantes!.entries()) {
      for (const [q, x] of Object.entries(v.valores!)) expect(q === 'R_tl' ? [10, 22, 100] : [2, 10], `${q}`).toContain(x);
      const tv = conVariante(t, k);
      expect(tv.fijar).toMatchObject(v.valores!);
      const r = mcB.evaluar(sueltos(tv));
      expect(Math.abs(r.V_to! - original) / original).toBeGreaterThan(0.05);
      // the data and the result, written again (no stale «45 Ω» or «8,1 V» left)
      const texto = textoPlano(tv.texto);
      const fm = (q: string) => formatear(mcB.magnitud(q), r[q]).replace(/\s+/g, ' ');
      expect(texto).toContain(fm('R_tl'));
      expect(texto).toContain(fm('R_ti'));
      expect(textoPlano(tv.exito)).toContain(fm('V_to'));
      expect(textoPlano(tv.solucion)).not.toContain('8,1 V');
      // nothing else of the card changes (the same id, type, activity)
      expect([tv.id, tv.tipo, JSON.stringify(tv.actividad)]).toEqual([t.id, t.tipo, JSON.stringify(t.actividad)]);
    }
    // another goal: its conditions and texts, the ladder of the card's own goal left out
    const reto = TB('reto-carga');
    expect(reto.variantes).toHaveLength(1);
    const rv = conVariante(reto, 0);
    expect(rv.condiciones?.[0]).toMatchObject({ valor: 'V_to', min: 6 });
    expect(textoPlano(rv.texto)).toContain('al menos 6 V');
    expect(rv.escalera).toBeUndefined();
    expect(rv.solucion).toBeUndefined();
    expect(rotuloVariante(reto, 0)).toBe('Otro objetivo');
    expect(rotuloVariante(t, 0)).toBe('Con otros valores');
    expect(rotuloVariante(t, null)).toBeNull();
  });

  test('el ngspice de la app comprueba cada variante; la que no cuadra con el simulador se descarta', async () => {
    // @ts-expect-error (a plain .mjs module of the scripts: no types)
    const { motor } = await import('../scripts/libro-node.mjs');
    const simular = await motor();
    const deVariantes = RB.spice.filter((c) => c.variante);
    expect(deVariantes.filter((c) => c.variante!.tarjeta === 'prediga-bornes').map((c) => c.variante!.k).sort()).toEqual([0, 1, 2]);
    for (const c of deVariantes) {
      const s = await simular(c.netlist);
      expect(compararSimulacion(c, s.ejecucion.graficas), c.donde).toEqual([]);
    }
    // a variant whose expected reading the simulator does not give: dropped by the script (descartarVariantes)
    const c = deVariantes.find((x) => x.variante!.tarjeta === 'prediga-bornes' && x.variante!.k === 1)!;
    const mala = { ...c, valores: c.valores.map((v) => ({ ...v, esperado: v.esperado * 1.5 + 1 })) };
    expect(compararSimulacion(mala, (await simular(mala.netlist)).ejecucion.graficas).length).toBeGreaterThan(0);
    const l = JSON.parse(JSON.stringify(LB)) as Leccion11;
    const antes = l.tarjetas.find((t) => t.id === 'prediga-bornes')!.variantes!;
    expect(descartarVariantes(l.tarjetas, new Map([['prediga-bornes', new Set([1])]]))).toBe(1);
    expect(l.tarjetas.find((t) => t.id === 'prediga-bornes')!.variantes).toEqual([antes[0], antes[2]]);
    expect(descartarVariantes(l.tarjetas, new Map([['reto-carga', new Set([0])]]))).toBe(1);
    expect(l.tarjetas.find((t) => t.id === 'reto-carga')!.variantes).toBeUndefined();
  });

  test('en el repaso: la variante sale del id de la tarjeta y la semilla de la sesión, y se corrige con sus valores', () => {
    const t = TB('prediga-bornes');
    const elegidas = new Set<number>();
    for (let s = 0; s < 60; s++) {
      const k = elegirVariante(t, s);
      expect(k).toBe(elegirVariante(t, s));
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(3);
      elegidas.add(k!);
    }
    expect(elegidas.size).toBe(3);
    expect(elegirVariante(T('toque-coincidir'), 7)).toBeNull();
    expect(conVariante(t, null)).toBe(t);
    // the variant's own answer is right; the remembered one (the lesson's 8,1 V) is not
    const k = 0;
    const tv = conVariante(t, k);
    const v = sueltos(tv);
    const bueno = mcB.evaluar(v).V_to!;
    const e0 = nuevoEstado(tv);
    const con = (x: number) => ({ ...e0, actividad: { tipo: 'simular' as const, texto: String(x), valor: x } });
    expect(comprobar(LB, tv, con(bueno), v).aviso.bien).toBe(true);
    expect(comprobar(LB, tv, con(8.1), v).aviso.bien).toBe(false);
    // recorded under the card's own answer id: the progress, the backups and the sync format do not change
    const r = comprobar(LB, tv, con(bueno), v);
    expect(eventoDeComprobacion(LB, tv, con(bueno), r.estado, 'inteligente')!.evento.id).toBe(idRespuesta(LB, t));
    expect(esPracticable(tv)).toBe(true);
    const sin = JSON.parse(JSON.stringify(LB)) as Leccion11;
    for (const x of sin.tarjetas) delete x.variantes;
    expect(entradaIndice(LB)).toEqual(entradaIndice(sin));
    // another goal: met by its own condition
    const rv = conVariante(TB('reto-carga'), 0);
    const vr = sueltos(rv);
    expect(rv.condiciones!.every((c) => enRango(c, mcB.evaluar({ ...vr, R_tl: 10 })))).toBe(true);
    expect(rv.condiciones!.every((c) => enRango(c, mcB.evaluar({ ...vr, R_tl: 5 })))).toBe(false);
  });

  test('las reglas de las variantes, cada una rota a propósito', () => {
    const casos: [string, (f: F) => void, RegExp][] = [
      ['en una tarjeta que no se calcula', (f) => (tarjetaDe(f, 'explore-fuente-real').variantes = { valores: { R_ti: [2] } }), /«variantes» va en una tarjeta simular, leer, medir, reto o diseno/],
      ['una clave desconocida', (f) => (tarjetaDe(f, 'prediga-bornes').variantes.otros = 1), /«variantes.otros»: clave desconocida/],
      ['un valor que no es del modelo', (f) => (tarjetaDe(f, 'prediga-bornes').variantes.valores = { R_9: [1, 2] }), /«R_9» no es un valor del modelo/],
      ['un valor que el lector mueve', (f) => (tarjetaDe(f, 'reto-carga').variantes = { valores: { R_tl: [10] } }), /«R_tl» lo mueve el lector en esta tarjeta/],
      ['sin ningún valor distinto', (f) => (tarjetaDe(f, 'prediga-bornes').variantes.valores = { R_tl: [45] }), /ningún valor distinto del de la tarjeta/],
      ['un recorrido mal escrito', (f) => (tarjetaDe(f, 'prediga-bornes').variantes.valores = { R_tl: { min: 10 } }), /\{ min, max, paso \}/],
      // a number derived from the data, written without being a quantity of the model: it would be stale
      ['un número que saldría de los datos', (f) => (tarjetaDe(f, 'prediga-bornes').exito = 'La corriente es 9/50 = 180 mA; quedan 8,1 V.'), /ninguna variante sirve.*«50» no es ninguna cantidad del modelo/],
      ['otro objetivo en una tarjeta sin condiciones', (f) => (tarjetaDe(f, 'prediga-bornes').variantes.objetivos = [{ condiciones: [], texto: 'x', exito: 'y' }]), /solo en un reto o un diseño/],
      ['otro objetivo sin sus textos', (f) => delete tarjetaDe(f, 'reto-carga').variantes.objetivos[0].exito, /\{ condiciones, texto, exito \}/],
      ['otro objetivo de un reto sin pistas', (f) => delete tarjetaDe(f, 'reto-carga').variantes.objetivos[0].pistas, /un reto con otro objetivo lleva sus «pistas»/],
      ['otro objetivo que no se alcanza', (f) => (tarjetaDe(f, 'reto-carga').variantes.objetivos[0].condiciones[0].min = 9), /«variantes.objetivos 1»: no sirve \(.*no tiene solución/],
    ];
    for (const [nombre, cambio, re] of casos) expect(erroresB(cambio), nombre).toMatch(re);
    // «false»: none, not even the automatic ones
    expect(generar({ ...copia(FUENTE_B), tarjetas: (copia(FUENTE_B) as F).tarjetas.map((t) => (t.id === 'prediga-bornes' ? { ...t, variantes: false } : t)) }).leccion!.tarjetas.find((t) => t.id === 'prediga-bornes')!.variantes).toBeUndefined();
  });

  // qa131: «mida-pin» (cap20/sec-20.5), «prediga-npn» (cap11/sec-11.2) and «mida-fase» (cap23/sec-23.10) were asked
  // «Con otros valores» changing only a value of another card's circuit (R_f, P_n, C_r): the card the reader saw was
  // the lesson's own, word for word. A «medir» card without «valor» took every calculation of the model as its answer,
  // so any value of the lesson «changed the answer».
  test('cada variante publicada cambia algo que la tarjeta enseña (su circuito, sus textos o su respuesta)', () => {
    const indice = JSON.parse(fs.readFileSync(path.join(web, 'public', 'libro', 'lecciones11', 'indice.json'), 'utf8'));
    let n = 0;
    const iguales: string[] = [];
    for (const id of Object.keys(indice.lecciones)) {
      const l = JSON.parse(fs.readFileSync(path.join(web, 'public', 'libro', 'lecciones11', `${id}.json`), 'utf8')) as Leccion11;
      const calculos = l.modelo.calculos as Record<string, { expr?: string }>;
      const enModelo = (w: string) => w in l.modelo.valores || w in calculos;
      for (const t of l.tarjetas) {
        if (!t.variantes) continue;
        // the quantities the card shows or asks for (any model id written in it), with what they are worked out from
        const usa = new Set<string>();
        const andar = (x: unknown): void => {
          if (typeof x === 'string') for (const w of x.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) if (enModelo(w)) usa.add(w);
          if (Array.isArray(x)) x.forEach(andar);
          else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) if (k !== 'variantes' && k !== 's') (enModelo(k) && usa.add(k), andar(y));
        };
        andar(t);
        for (const k of [...usa]) {
          const pila = [k];
          while (pila.length) for (const w of String(calculos[pila.pop()!]?.expr ?? '').match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) if (enModelo(w) && !usa.has(w)) (usa.add(w), pila.push(w));
        }
        for (const [k, v] of t.variantes.entries()) {
          if (v.objetivo) continue;
          n++;
          if (!Object.keys(v.valores ?? {}).some((q) => usa.has(q))) iguales.push(`${id} ${t.id} variante ${k + 1}: ${JSON.stringify(v.valores)}`);
        }
      }
    }
    expect(iguales).toEqual([]);
    expect(n).toBeGreaterThan(20);
  });

  test('automáticas solo donde es seguro: sobre los mandos de la lección, con las cifras escritas de nuevo, nunca en una figura ni con palabras que comparan', () => {
    const P = generar(parse(fs.readFileSync(path.join(web, '..', 'contenido', 'lecciones11', 'cap00', 'sec-0.7.yaml'), 'utf8'))).leccion as Leccion11;
    const t = P.tarjetas.find((x) => x.id === 'prediga-carga')!;
    expect(t.variantes?.length).toBeGreaterThan(0);
    for (const [k] of t.variantes!.entries()) {
      const tv = conVariante(t, k);
      expect(textoPlano(tv.texto)).not.toBe(textoPlano(t.texto));
      expect(textoPlano(tv.solucion)).not.toContain('= 6 C');
    }
    // the published lessons: no automatic variant on a figure, a logic circuit or a reading from a graph
    for (const id of Object.keys(JSON.parse(fs.readFileSync(path.join(web, 'public', 'libro', 'lecciones11', 'indice.json'), 'utf8')).lecciones)) {
      const l = JSON.parse(fs.readFileSync(path.join(web, 'public', 'libro', 'lecciones11', `${id}.json`), 'utf8')) as Leccion11;
      for (const x of l.tarjetas) if (x.variantes) expect(x.widget?.tipo === 'figura' || x.widget?.tipo === 'logica', `${id} ${x.id}`).toBe(false);
    }
  });

  test('las cifras de un texto: con su unidad se escriben de nuevo; sin unidad, ambiguas o del libro en otro paso, no hay variante', () => {
    const f = (id: string, v: number) => `«${id}=${v}»`;
    const c = (id: string, unidad: string, antes: number, despues: number, rol: 'dato' | 'respuesta' | 'otro' = 'dato', relevante = true) => ({ id, unidad, antes, despues, rol, relevante });
    const R = [c('R', 'Ω', 4700, 10000)];
    expect(sustituirNumeros('Con 4,7 kΩ y 2 V', R, [{ unidad: 'V', valor: 2 }], f)).toEqual({ texto: 'Con «R=10000» y 2 V', usadas: ['R'] });
    // (a live value, a subscript and a hexadecimal literal are not numbers to read)
    expect(sustituirNumeros('R_{4} vale {{R}} y $47', R, [], f)).toEqual({ texto: 'R_{4} vale {{R}} y $47', usadas: [] });
    expect(sustituirNumeros('4700 sin unidad', R, [], f)).toMatchObject({ inseguro: expect.stringContaining('no lleva unidad') });
    expect(sustituirNumeros('unos 4,7 k', R, [], f)).toMatchObject({ inseguro: expect.stringContaining('no lleva unidad') });
    expect(sustituirNumeros('9 V entre 50 Ω', R, [{ unidad: 'V', valor: 9 }], f)).toMatchObject({ inseguro: expect.stringContaining('50 Ω') });
    expect(sustituirNumeros('dos de 4,7 kΩ', [...R, c('S', 'Ω', 4700, 1)], [], f)).toMatchObject({ inseguro: expect.stringContaining('más de una cantidad') });
    expect(sustituirNumeros('dv/dt = 1,65 V/ns', [c('I', 'A', 1, 2)], [{ unidad: 'V', valor: 3.3 }], f)).toMatchObject({ inseguro: expect.stringContaining('1,65') });
    expect(sustituirNumeros('√(10⁻⁹)', [c('L', 'H', 1e-3, 2e-3)], [], f)).toMatchObject({ inseguro: expect.stringContaining('10⁻⁹') });
    expect(sustituirNumeros('1 nF × 400² × 2π', [c('f', 'Hz', 1e5, 1e6)], [{ unidad: 'V', valor: 400 }, { unidad: 'F', valor: 1e-9 }], f)).toEqual({ texto: '1 nF × 400² × 2π', usadas: [] });
    // the book's «1 GHz» that is also another step of the card (1/t): ambiguous
    const libro = (n: { v: number }) => n.v === 1;
    expect(sustituirNumeros('de 30 MHz a 1 GHz', [c('f_1', 'Hz', 1e9, 1e8, 'otro')], [{ unidad: 'Hz', valor: 3e7 }], f, libro)).toMatchObject({ inseguro: expect.stringContaining('número del libro') });
    expect(sustituirNumeros('unos 1 GHz', [c('f_x', 'Hz', 1e9, 1e8, 'respuesta')], [], f, libro)).toEqual({ texto: 'unos «f_x=100000000»', usadas: ['f_x'] });
    // a quantity the card does not use, written as if it were the card's
    expect(sustituirNumeros('a 1 GHz', [c('f_1', 'Hz', 1e9, 1e8, 'respuesta', false)], [], f)).toMatchObject({ inseguro: expect.stringContaining('la tarjeta no usa') });
    // (words that compare magnitudes)
    expect(PALABRAS_DE_PROPORCION.test('los 5 mV, tres veces por debajo, apenas cuentan')).toBe(true);
    expect(PALABRAS_DE_PROPORCION.test('Pasan 180 mA y en bornes quedan 8,1 V.')).toBe(false);
  });
});
