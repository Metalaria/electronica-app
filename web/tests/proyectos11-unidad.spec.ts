// 1.1 «Proyectos por etapas» (lib/proyectos11/; ESQUEMA.md «Proyectos por etapas»). In Node, no browser: every stage's
// starting circuit opened as the editor opens it (esquema-auto's layout → documentoDeEditable) and checked by
// comprobarEtapa on the editor's own netlist with the app's WebAssembly ngspice — the starting values fail, the book's
// design (or the reference design that meets what the book asks) passes, the accepted alternatives pass, and the
// typical wrong designs fail on the right condition with the right hint; the value checks before simulating; the
// progress record and its merge; the data's links (sections, 1.1 lessons, KiCad boards).
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.proyectos11.config.ts tests/proyectos11-unidad.spec.ts
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { compilar } from '../src/simulador/motor/nucleo.ts';
import { simular } from '../src/simulador/motor/simular.ts';
import { todasLasMedidas } from '../src/simulador/motor/salida.ts';
import { editableDeNetlist } from '../src/componentes/esquema-auto/editable.ts';
import { documentoDeEditable } from '../src/componentes/editor/importar.ts';
import { generarNetlist } from '../src/componentes/editor/netlist.ts';
import type { DocumentoEsquema } from '../src/componentes/editor/tipos.ts';
import { PROYECTOS, etapaPorId, PARTE_INTEGRACION } from '../src/lib/proyectos11/etapas.ts';
import { ETAPAS_DE_SECCION, INDICE_PROYECTOS } from '../src/lib/proyectos11/indice.ts';
import { comprobarEtapa, conValor, esDeSerie, leerComponente, netlistEtapa, plano, textoEnDibujo, valoresEtapa } from '../src/lib/proyectos11/comprobar.ts';
import type { Etapa } from '../src/lib/proyectos11/tipos.ts';
import { anotarCircuito, anotarComprobacion, anotarSolucion, registroEtapaValido, registroVacio, unirRegistrosEtapa, type RegistroEtapa } from '../src/lib/proyectos11/registro.ts';
import { ESQUEMAS, migracionesDe } from '../src/lib/esquemas.ts';
import { fusionarColecciones } from '../src/lib/sincronizacion/fusion.ts';
import type { Simulador } from '../src/lib/diseno-ejercicio.ts';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIBRO = path.join(WEB, 'public', 'libro');

let medir: Simulador;
test.beforeAll(async () => {
  const modulo = await compilar(fs.readFileSync(path.join(WEB, 'public', 'ngspice', 'ngspice-xspice.wasm')));
  medir = async (t) => {
    const r = await simular(modulo, t, undefined, 'xspice');
    if (r.ejecucion.fallo) throw new Error(String(r.ejecucion.fallo));
    return todasLasMedidas(r.salida).map((m) => ({ nombre: m.nombre, valor: m.valor }));
  };
});

const etapa = (id: string): Etapa => etapaPorId(id)!.etapa;
/** The stage's starting circuit as the editor opens it. */
function dibujo(e: Etapa): DocumentoEsquema {
  const ed = editableDeNetlist(e.netlist);
  expect(ed, `${e.id}: el esquema automático no dibuja la netlist`).not.toBeNull();
  return documentoDeEditable(e.netlist, ed!, { tipo: 'proyecto', id: e.id });
}
/** The drawing with some design values written as the reader would type them. */
function con(e: Etapa, valores: Record<string, string>): DocumentoEsquema {
  let d = dibujo(e);
  for (const [id, t] of Object.entries(valores)) {
    const c = e.componentes.find((x) => x.id === id)!;
    const l = leerComponente(c, t);
    expect(l.ok, `${e.id}: ${id} = ${t}`).toBe(true);
    d = conValor(d, c, (l as { v: number }).v);
  }
  return d;
}
const referencia = (e: Etapa) => Object.fromEntries(e.componentes.map((c) => [c.id, c.referencia]));

// ------------------------------------------------------------------ every stage: start fails, the book's design passes

for (const p of PROYECTOS)
  for (const e of p.etapas)
    test(`${e.id} ${plano(e.titulo)}: el circuito de partida se abre limpio, no cumple, y el diseño de referencia sí`, async () => {
      const d = dibujo(e);
      const nl = generarNetlist(d);
      expect(nl.errores, `${e.id}: errores del editor`).toEqual([]);
      expect(nl.avisos.map((a) => `${a.texto} [${d.componentes.find((c) => c.id === a.id)?.tipo ?? ''}]`), `${e.id}: avisos del editor`).toEqual([]);
      // every design value is in the drawing, where the checker looks for it
      for (const c of e.componentes) expect(textoEnDibujo(c, d), `${e.id}: ${c.id}`).not.toBeNull();
      const inicio = await comprobarEtapa(e, d, medir);
      expect(inicio.tipo, `${e.id} partida: ${inicio.mensaje}`).toBe('mal');
      const ref = await comprobarEtapa(e, con(e, referencia(e)), medir);
      expect(ref.tipo, `${e.id} referencia: ${ref.mensaje}`).toBe('bien');
      for (const c of ref.condiciones) expect(Number.isFinite(c.medido)).toBe(true);
    });

// ------------------------------------------------------------------ alternatives and typical mistakes, per stage

interface Caso {
  valores: Record<string, string>;
  /** 'bien', or the condition that must fail (and only those listed) with a word of its hint. */
  falla?: Record<string, RegExp>;
}
const CASOS: Record<string, Caso[]> = {
  'cap49-1': [
    { valores: { RPU: '10k' }, falla: { tsub: /baje R/ } },
    { valores: { RPU: '1k' }, falla: { ibaja: /suba R/ } },
    { valores: { RPU: '2,2k' } },
    { valores: { RPU: '3,3k' } },
  ],
  'cap49-2': [
    { valores: { RF: '100k', RG: '1k', RR1: '100k', RR2: '22k' }, falla: { vref: /iguales/ } },
    { valores: { RF: '1k', RG: '10k', RR1: '100k', RR2: '100k' }, falla: { gdb: /suba R/ } },
    { valores: { RF: '10k', RG: '1k', RR1: '47k', RR2: '47k' }, falla: { gdb: /suba R/ } },
    { valores: { RF: '220k', RG: '2,2k', RR1: '47k', RR2: '47k' } },
    { valores: { RF: '330k', RG: '1k', RR1: '10k', RR2: '10k' } },
  ],
  'cap49-3': [
    { valores: { RD: '1,2M', CD: '1µ' }, falla: { tau: /baje/ } },
    { valores: { RD: '12k', CD: '1µ' }, falla: { tau: /suba/ } },
    { valores: { RD: '1,2M', CD: '100n' } },
    { valores: { RD: '56k', CD: '2,2µ' } },
  ],
  'cap50-1': [
    // the secondary that «a first glance» suggests (24 V): the regulator drops out with the mains low
    { valores: { vsec: '24', C1: '10m' }, falla: { valle_baja: /suba V/ } },
    { valores: { vsec: '30', C1: '4,7m' }, falla: { rizado: /suba C/, valle_baja: /suba/ } },
    { valores: { vsec: '36', C1: '10m' }, falla: { vacio_alta: /baje V/ } },
    { valores: { vsec: '30', C1: '15m' } },
    { valores: { vsec: '30', C1: '22m' } },
  ],
  'cap50-2': [
    // too high: and at 2,7 A the 33,3 V input leaves the pass transistor no room (dropout)
    { valores: { R1: '24k', R2: '2k' }, falla: { vmax: /baje R/, regcarga: /dropout/ } },
    { valores: { R1: '20k', R2: '2k' }, falla: { vmax: /suba R/ } },
    { valores: { R1: '110k', R2: '10k' } },
    { valores: { R1: '33k', R2: '3k' } },
  ],
  'cap50-3': [
    { valores: { RS: '0,27' }, falla: { icorto: /suba R/ } },
    { valores: { RS: '0,39' }, falla: { icorto: /baje R/ } },
    { valores: { RS: '0,1' }, falla: { icorto: /suba R/ } },
  ],
  'cap50-4': [
    { valores: { margen: '3' }, falla: { vsal: /dropout/ } },
    { valores: { margen: '5' }, falla: { pq1: /baje/ } },
    { valores: { margen: '3,8' } },
  ],
  'cap51-1': [
    { valores: { RF: '4,7k', RG: '10k' }, falla: { gpre_1k: /suba R/ } },
    { valores: { RF: '4,7k', RG: '4,7k' } },
    { valores: { RF: '100k', RG: '100k' } },
  ],
  'cap51-2': [
    { valores: { R1: '820' }, falla: { iq: /Suba R/ } },
    { valores: { R1: '910' }, falla: { iq: /Baje R/ } },
    { valores: { R1: '860' } },
  ],
  'cap51-3': [
    { valores: { vr: '40' }, falla: { pq1max: /baje/ } },
    { valores: { vr: '29' }, falla: { pmax: /suba/ } },
    { valores: { vr: '33' } },
    { valores: { vr: '38' } },
  ],
  'cap52-1': [
    // (review 11c: the two hints of a failing design agree — here both lead to larger shunts —; 100/100/100 had read
    // «suba R_P» for the attenuation and «baje las ramas en paralelo» for the impedance: both now name «baje R_S»)
    { valores: { RP1: '47', RS: '68', RP2: '47' }, falla: { zent: /^la entrada queda por debajo de 50 Ω: suba las ramas en paralelo/, atenuacion: /o suba las ramas en paralelo/ } },
    { valores: { RP1: '100', RS: '100', RP2: '100' }, falla: { atenuacion: /^atenúa demasiado: baje RS/, zent: /^la entrada queda por encima de 50 Ω: baje las ramas en paralelo \(o RS,/ } },
    { valores: { RP1: '95,3', RS: '71,5', RP2: '95,3' } },
    { valores: { RP1: '100', RS: '68', RP2: '100' } },
  ],
  'cap52-2': [
    { valores: { RG: '475' }, falla: { gdb: /suba R/ } },
    { valores: { RG: '549' }, falla: { gdb: /baje R/ } },
    { valores: { RG: '487' } },
    { valores: { RG: '511' } },
  ],
  'cap52-3': [
    { valores: { R33: '2,49k', R34: '2,49k' }, falla: { fuga: /suba/ } },
    { valores: { R33: '4,64k', R34: '4,64k' }, falla: { f3db: /baje/ } },
    { valores: { R33: '3,32k', R34: '3,32k' } },
    { valores: { R33: '4,32k', R34: '4,32k' } },
  ],
};

test('hay casos para cada etapa', () => {
  expect(Object.keys(CASOS).sort()).toEqual(PROYECTOS.flatMap((p) => p.etapas.map((e) => e.id)).sort());
});

for (const [id, casos] of Object.entries(CASOS))
  test(`${id}: alternativas aceptadas y errores típicos con su pista`, async () => {
    const e = etapa(id);
    for (const caso of casos) {
      const r = await comprobarEtapa(e, con(e, caso.valores), medir);
      const quien = `${id} ${JSON.stringify(caso.valores)}: ${r.mensaje}`;
      if (!caso.falla) {
        expect(r.tipo, quien).toBe('bien');
        continue;
      }
      expect(r.tipo, quien).toBe('mal');
      const mal = r.condiciones.filter((c) => !c.ok);
      expect(mal.map((c) => c.medida).sort(), quien).toEqual(Object.keys(caso.falla).sort());
      for (const c of mal) expect(plano(c.pista ?? ''), quien).toMatch(caso.falla[c.medida]!);
    }
  });

// ------------------------------------------------------------------ before simulating

test('los valores se revisan antes de simular: falta la pieza, ilegible, fuera de serie, expresión, parámetro', async () => {
  const e = etapa('cap49-1');
  let simulado = 0;
  const contar: Simulador = async (t) => {
    simulado++;
    return medir(t);
  };
  const d = dibujo(e);
  // out of the series
  let r = await comprobarEtapa(e, { ...d, componentes: d.componentes.map((c) => (c.nombre === 'RPU' ? { ...c, campos: { ...c.campos, valor: '5k' } } : c)) }, contar);
  expect(r.tipo).toBe('ilegible');
  expect(r.mensaje).toMatch(/serie E12/);
  // unreadable
  r = await comprobarEtapa(e, { ...d, componentes: d.componentes.map((c) => (c.nombre === 'RPU' ? { ...c, campos: { ...c.campos, valor: 'cuatro' } } : c)) }, contar);
  expect(r.mensaje).toMatch(/No se entiende/);
  // renamed / deleted
  r = await comprobarEtapa(e, { ...d, componentes: d.componentes.map((c) => (c.nombre === 'RPU' ? { ...c, nombre: 'R9' } : c)) }, contar);
  expect(r.mensaje).toMatch(/No encuentro R/);
  expect(r.mensaje).toMatch(/Restaurar la etapa/);
  // an expression
  r = await comprobarEtapa(e, { ...d, componentes: d.componentes.map((c) => (c.nombre === 'RPU' ? { ...c, campos: { ...c.campos, valor: '{r}' } } : c)) }, contar);
  expect(r.mensaje).toMatch(/expresión/);
  // a .param gone
  const f = etapa('cap50-1');
  const df = dibujo(f);
  r = await comprobarEtapa(f, { ...df, directivas: df.directivas.replace(/vsec=\S+/, '') }, contar);
  expect(r.mensaje).toMatch(/Falta el parámetro «vsec»/);
  // no ground: the editor's own message
  r = await comprobarEtapa(e, { ...d, componentes: d.componentes.filter((c) => c.tipo !== 'GND') }, contar);
  expect(r.tipo).toBe('ilegible');
  expect(r.mensaje).toMatch(/masa/);
  expect(simulado).toBe(0);
});

test('lo que se simula es el esquema del lector: sin sus análisis ni su .control, con el de la etapa', async () => {
  const e = etapa('cap49-1');
  const d = dibujo(e);
  d.directivas += '\n.tran 1n 1u\n.control\nrun\nprint v(sda)\n.endc';
  d.analisis.tran.activo = true;
  const n = netlistEtapa(e, d);
  expect(n.ok).toBe(true);
  const t = (n as { texto: string }).texto;
  expect(t.match(/^\.control$/gm)?.length).toBe(1);
  expect(t).not.toMatch(/^\.tran/m);
  expect(t).not.toMatch(/^\.op/m);
  expect(t).toMatch(/tran 2n 20u/);
  // a topology the starting circuit does not have, judged by what it measures: the 10 kΩ of the start fails alone, and
  // passes with a 4,7 kΩ added in parallel (3,2 kΩ)
  const texto = e.netlist.replace('RPU vdd sda 10k', 'RPU vdd sda 10k\nRX vdd sda 4.7k');
  const doble = documentoDeEditable(texto, editableDeNetlist(texto)!, { tipo: 'proyecto', id: e.id });
  const r = await comprobarEtapa(e, doble, medir);
  expect(r.tipo, r.mensaje).toBe('bien');
});

test('un fallo de ngspice no es un intento: «La simulación no terminó»', async () => {
  const e = etapa('cap49-1');
  const r = await comprobarEtapa(e, con(e, { RPU: '4,7k' }), async () => {
    throw new Error('timestep too small');
  });
  expect(r.tipo).toBe('ilegible');
  expect(r.mensaje).toMatch(/La simulación no terminó/);
});

// ------------------------------------------------------------------ the data

test('datos: ids estables, referencias en su serie y margen, secciones y lecciones que existen', () => {
  const refs = JSON.parse(fs.readFileSync(path.join(LIBRO, 'refs.json'), 'utf8')) as Record<string, unknown>;
  const lecciones = JSON.parse(fs.readFileSync(path.join(LIBRO, 'lecciones11', 'indice.json'), 'utf8')) as { lecciones: Record<string, unknown> };
  const ids = new Set<string>();
  for (const p of PROYECTOS) {
    expect(fs.existsSync(path.join(LIBRO, 'partes', `${p.parte}.json`))).toBe(true);
    if (p.placa) expect(fs.existsSync(path.join(WEB, 'public', 'proyectos', `${p.placa.split('/')[0]}.json`))).toBe(true);
    p.etapas.forEach((e, i) => {
      expect(e.id).toBe(`${p.parte}-${i + 1}`);
      expect(e.n).toBe(i + 1);
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      for (const s of e.secciones) expect(refs[s], `${e.id}: ${s}`).toBeTruthy();
      if (e.leccion) expect(lecciones.lecciones[e.leccion], `${e.id}: ${e.leccion}`).toBeTruthy();
      expect(plano(e.objetivo).split(/\s+/).length, `${e.id}: objetivo de más de 40 palabras`).toBeLessThanOrEqual(40);
      for (const c of e.componentes) {
        const l = leerComponente(c, c.referencia);
        expect(l.ok, `${e.id}: ${c.id} = ${c.referencia}`).toBe(true);
      }
      for (const c of e.condiciones) {
        expect(e.medidas.some((m) => m.id === c.medida), `${e.id}: ${c.medida}`).toBe(true);
        if (c.min != null) expect(c.siBaja, `${e.id}: ${c.medida} sin pista por debajo`).toBeTruthy();
        if (c.max != null) expect(c.siAlta, `${e.id}: ${c.medida} sin pista por encima`).toBeTruthy();
      }
    });
  }
  for (const [s, es] of Object.entries(ETAPAS_DE_SECCION)) for (const x of es) expect(etapaPorId(x.etapa.id)!.etapa.secciones).toContain(s);
  // the light index (reader, courses, progress) is the data's own
  expect(INDICE_PROYECTOS).toEqual(PROYECTOS.map((p) => ({ parte: p.parte, titulo: p.titulo, corto: p.corto, etapas: p.etapas.map((e) => ({ id: e.id, n: e.n, titulo: e.titulo, secciones: e.secciones })) })));
  expect(PROYECTOS.some((p) => p.parte === PARTE_INTEGRACION)).toBe(false);
  expect(esDeSerie(97.6, 'E96')).toBe(true);
  expect(esDeSerie(97.6, 'E24')).toBe(false);
  expect(esDeSerie(0.33, 'E12')).toBe(true);
  expect(esDeSerie(5000, 'E12')).toBe(false);
});

// ------------------------------------------------------------------ progress and its merge

test('registro: circuito, comprobaciones, primer paso, solución vista', () => {
  let r = anotarCircuito(undefined, 'c1', 1000);
  expect(r).toMatchObject({ c: 'c1', tc: 1000, h: 0, n: 0, m: null });
  r = anotarComprobacion(r, false, { RPU: 10e3 }, { tsub: 4e-7 }, 2000);
  expect(r).toMatchObject({ n: 1, h: 0, m: null });
  r = anotarComprobacion(r, true, { RPU: 4700 }, { tsub: 2e-7, ibaja: Number.NaN }, 3000);
  expect(r.h).toBe(3000);
  expect(r.m).toEqual({ v: { RPU: 4700 }, r: { tsub: 2e-7 }, t: 3000 });
  // a later pass keeps the first pass's time, updates the values
  r = anotarComprobacion(r, true, { RPU: 2200 }, { tsub: 1e-7 }, 4000);
  expect(r.h).toBe(3000);
  expect(r.m!.v['RPU']).toBe(2200);
  // a failed check later never takes the pass away
  r = anotarComprobacion(r, false, { RPU: 10 }, {}, 5000);
  expect(r.h).toBe(3000);
  expect(r.m!.v['RPU']).toBe(2200);
  r = anotarSolucion(r, 6000);
  expect(r.s).toBe(6000);
  expect(anotarSolucion(r, 7000).s).toBe(6000);
  // a clock set back never sorts a change before the older one
  expect(anotarComprobacion(r, false, {}, {}, 10).t).toBeGreaterThan(r.t);
  expect(registroEtapaValido(r)).toBe(true);
  expect(registroEtapaValido(JSON.parse(JSON.stringify(r)))).toBe(true);
  expect(registroEtapaValido({ ...r, m: { v: { a: 'x' }, r: {}, t: 1 } })).toBe(false);
  expect(registroEtapaValido({ ...r, c: 3 })).toBe(false);
  expect(registroEtapaValido(registroVacio())).toBe(true);
});

test('unión de dos dispositivos: conmutativa, asociativa e idempotente; nada se pierde ni resucita', () => {
  const A: RegistroEtapa = { c: 'ca', tc: 100, h: 0, m: null, n: 2, s: 0, t: 150 };
  const B: RegistroEtapa = { c: 'cb', tc: 200, h: 300, m: { v: { R1: 22e3 }, r: { vmax: 30 }, t: 300 }, n: 1, s: 0, t: 300 };
  const C: RegistroEtapa = { c: 'ca', tc: 100, h: 250, m: { v: { R1: 110e3 }, r: { vmax: 30 }, t: 250 }, n: 5, s: 260, t: 260 };
  const u = unirRegistrosEtapa;
  const k = (x: RegistroEtapa) => JSON.stringify(x);
  for (const [x, y] of [[A, B], [A, C], [B, C]] as const) expect(k(u(x, y))).toBe(k(u(y, x)));
  expect(k(u(u(A, B), C))).toBe(k(u(A, u(B, C))));
  for (const x of [A, B, C]) expect(k(u(x, x))).toBe(k(x));
  const t = u(u(A, B), C);
  // the newer circuit; the earliest pass and solution; the newer pass's values; the larger count; the newer time
  expect(t).toEqual({ c: 'cb', tc: 200, h: 250, m: { v: { R1: 22e3 }, r: { vmax: 30 }, t: 300 }, n: 5, s: 260, t: 300 });
  // same assignment time: the larger id, on both sides
  expect(u({ ...A, c: 'x', tc: 5 }, { ...A, c: 'y', tc: 5 }).c).toBe('y');
  expect(u({ ...A, c: 'y', tc: 5 }, { ...A, c: 'x', tc: 5 }).c).toBe('y');
});

test('almacén y sincronización: clave nueva sin migración, almacén «proyectos» con su unión, también en el fichero', () => {
  expect(ESQUEMAS['proyectos']).toBe(1);
  expect(migracionesDe('proyectos', 1)).toEqual([]);
  const registro = fs.readFileSync(path.join(WEB, 'src/lib/sincronizacion/registro.svelte.ts'), 'utf8');
  expect(registro).toMatch(/sincronizableGuardado\(guardadoProyectos, \{\s*clave: 'proyectos'/);
  expect(registro).toContain('unir: (a, b) => unirRegistrosEtapa(');
  // the synchronisation file: this device's entry and the file's, merged by the store's `unir` (not the newer wins):
  // a pass made on one device and the circuit made on the other both survive
  const a: RegistroEtapa = { c: 'cA', tc: 10, h: 0, m: null, n: 3, s: 0, t: 40 };
  const b: RegistroEtapa = { c: 'cB', tc: 20, h: 30, m: { v: { RPU: 4700 }, r: { tsub: 2e-7 }, t: 30 }, n: 1, s: 0, t: 30 };
  const union = { unir: (x: unknown, y: unknown) => unirRegistrosEtapa(x as RegistroEtapa, y as RegistroEtapa), valido: registroEtapaValido };
  const f = fusionarColecciones({ 'cap49-1': { t: 40, v: a } } as never, { 'cap49-1': { t: 30, v: b }, 'cap50-2': { t: 5, v: b } } as never, union) as Record<string, { v: RegistroEtapa }>;
  expect(f['cap49-1']!.v).toEqual({ c: 'cB', tc: 20, h: 30, m: b.m, n: 3, s: 0, t: 40 });
  expect(f['cap50-2']).toBeTruthy();
});

test('XP una vez por etapa: 10 si se supera a la primera, 5 después, nada por un fallo', () => {
  const out = execFileSync('node', ['--no-warnings', '--import', './tests/laboratorio11/registrar.mjs', 'tests/proyectos11/xp-node.ts'], { cwd: WEB, encoding: 'utf8' });
  const r = JSON.parse(out.trim().split('\n').pop()!) as Record<string, { id: string; x: number } | null>;
  expect(r['primera']).toEqual({ id: 'pr:proy-cap50-1', x: 10 });
  expect(r['tercera']).toEqual({ id: 'pr:proy-cap50-1', x: 5 });
  expect(r['fallo']).toBeNull();
});
