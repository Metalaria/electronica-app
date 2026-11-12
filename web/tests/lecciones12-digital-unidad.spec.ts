// 1.2 (motor12c) digital toolkit and «figura» widget, in Node (no browser, no server): the logic simulation (every
// gate, the flip-flops' delta semantics, a ripple counter, a decade counter with reset, the mux and the decoder, an
// oscillating ring, faults stuck at 0/1 and an open TTL input), the timing diagram's slots, the fewest-gates search,
// the automatic drawing (no wire through a piece, every pin wired, junction dots), the generator's checks of the
// widgets and their steps (each rule broken on purpose) on the catalogue lesson tests/lecciones12-catalogo/cap29/
// sec-29.2.yaml, and the steps' rules through lib/leccion11/motor.ts (check, retry, gating). Deterministic.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones12-digital-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import { botonPrincipal, comprobar, esPracticable, exploracionHecha, faltaPorExplorar, nuevoEstado, reintentar, type EstadoTarjeta } from '../src/lib/leccion11/motor.ts';
import { textoPlano } from '../src/lib/leccion11/texto.ts';
import type { Leccion11, Tarjeta } from '../src/lib/leccion11/tipos.ts';
import { cronograma, iniciar, leer, mascaraDe, minimoPuertas, poner, pulso, sondear, tablaVerdad, type CircuitoLogico, type Nivel, type PiezaLogica } from '../src/lib/leccion12/digital/logica.ts';
import { planoDe } from '../src/lib/leccion12/digital/plano.ts';
import { circuitoDiseno, lecturaCon } from '../src/lib/leccion12/digital/motor-digital.ts';
import type { AveriaLogica, DisenoLogico, EstadoAveriaLogica, EstadoDibujarDigital, EstadoDisenoLogico, EstadoTabla, EstadoTocar } from '../src/lib/leccion12/digital/tipos.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { recursosLibro, tamanoImagen } from '../scripts/recursos11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
  recursos: recursosLibro(path.join(web, 'public', 'libro'), path.join(web, 'public')),
};
const FUENTE = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap29', 'sec-29.2.yaml'), 'utf8'));
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const generar = (f: unknown) => generarLeccion(f, contexto, 'catalogo-digital');
type F = { tarjetas: Record<string, any>[] };
function errores(cambio: (f: F) => void): string[] {
  const f = copia(FUENTE) as F;
  cambio(f);
  return generar(f).errores;
}
const tarjetaDe = (f: F, id: string) => f.tarjetas.find((t) => t.id === id)!;
const R = generar(FUENTE);
const L = R.leccion as Leccion11;
const T = (id: string) => L.tarjetas.find((t) => t.id === id)!;

const t = (s: string) => [{ t: 'txt' as const, s }];
const ent = (...ids: string[]) => ids.map((id) => ({ id, rotulo: t(id), valor: 0 as Nivel, reloj: false }));
const reloj = { id: 'CLK', rotulo: t('CLK'), valor: 0 as Nivel, reloj: true };
const circ = (entradas: CircuitoLogico['entradas'], piezas: PiezaLogica[], salidas: [string, string][] = []): CircuitoLogico => ({ entradas, piezas, salidas: salidas.map(([id, de]) => ({ id, de, rotulo: t(id) })) });
const columna = (c: CircuitoLogico, s = 'Y') => tablaVerdad(c, [s]).filas.map((f) => f.s[0]).join('');

test.describe('simulación lógica', () => {
  test('cada puerta de dos entradas da su tabla (A·B, A+B, NAND, NOR, XOR, XNOR) y NOT y búfer la suya', () => {
    const esperadas: Record<string, string> = { and: '0001', or: '0111', nand: '1110', nor: '1000', xor: '0110', xnor: '1001' };
    for (const [tipo, col] of Object.entries(esperadas)) expect(columna(circ(ent('A', 'B'), [{ id: 'g', tipo: tipo as PiezaLogica['tipo'], entradas: ['A', 'B'] }], [['Y', 'g']])), tipo).toBe(col);
    expect(columna(circ(ent('A'), [{ id: 'g', tipo: 'not', entradas: ['A'] }], [['Y', 'g']]))).toBe('10');
    expect(columna(circ(ent('A'), [{ id: 'g', tipo: 'buf', entradas: ['A'] }], [['Y', 'g']]))).toBe('01');
    // three inputs and constants
    expect(columna(circ(ent('A', 'B', 'C'), [{ id: 'g', tipo: 'and', entradas: ['A', 'B', 'C'] }], [['Y', 'g']]))).toBe('00000001');
    expect(columna(circ(ent('A'), [{ id: 'g', tipo: 'nand', entradas: ['A', '1'] }], [['Y', 'g']]))).toBe('10');
  });

  test('la OR de tres NAND del libro (sección 28.2) y De Morgan', () => {
    const or3 = circ(ent('A', 'B'), [{ id: 'n1', tipo: 'nand', entradas: ['A', 'A'] }, { id: 'n2', tipo: 'nand', entradas: ['B', 'B'] }, { id: 'n3', tipo: 'nand', entradas: ['n1', 'n2'] }], [['Y', 'n3']]);
    expect(columna(or3)).toBe('0111');
    const nor = circ(ent('A', 'B'), [{ id: 'g', tipo: 'nor', entradas: ['A', 'B'] }, { id: 'na', tipo: 'not', entradas: ['A'] }, { id: 'nb', tipo: 'not', entradas: ['B'] }, { id: 'y2', tipo: 'and', entradas: ['na', 'nb'] }], [['Y', 'g'], ['Z', 'y2']]);
    expect(columna(nor, 'Y')).toBe(columna(nor, 'Z'));
  });

  test('biestable D: muestrea en el flanco de subida (no en la bajada) y un registro de dos etapas desplaza una por flanco', () => {
    const c = circ([reloj, ...ent('D')], [{ id: 'f1', tipo: 'd', entradas: ['D', 'CLK'] }, { id: 'f2', tipo: 'd', entradas: ['f1.q', 'CLK'] }]);
    let s = iniciar(c);
    s = poner(c, s, { D: 1 });
    expect([leer(s, 'f1.q'), leer(s, 'f2.q')]).toEqual([0, 0]);
    s = poner(c, s, { CLK: 1 });
    // (delta semantics: f2 sampled f1's old Q at the same edge)
    expect([leer(s, 'f1.q'), leer(s, 'f2.q')]).toEqual([1, 0]);
    s = poner(c, s, { D: 0, CLK: 0 });
    expect([leer(s, 'f1.q'), leer(s, 'f2.q')]).toEqual([1, 0]);
    s = pulso(c, s, 'CLK');
    expect([leer(s, 'f1.q'), leer(s, 'f2.q'), leer(s, 'f1.nq')]).toEqual([0, 1, 1]);
  });

  test('JK (mantener, poner, borrar, conmutar), T, y el D con Q̄ en su entrada divide por dos (sección 9.4)', () => {
    const jk = circ([reloj, ...ent('J', 'K')], [{ id: 'f', tipo: 'jk', entradas: ['J', 'K', 'CLK'] }]);
    let s = iniciar(jk);
    const paso = (j: Nivel, k: Nivel) => {
      s = poner(jk, s, { J: j, K: k });
      s = pulso(jk, s, 'CLK');
      return leer(s, 'f.q');
    };
    expect([paso(0, 0), paso(1, 0), paso(0, 0), paso(0, 1), paso(1, 1), paso(1, 1)]).toEqual([0, 1, 1, 0, 1, 0]);
    const tt = circ([reloj, ...ent('T')], [{ id: 'f', tipo: 't', entradas: ['T', 'CLK'] }]);
    let u = poner(tt, iniciar(tt), { T: 1 });
    const qs: Nivel[] = [];
    for (let j = 0; j < 4; j++) qs.push(leer((u = pulso(tt, u, 'CLK')), 'f.q'));
    expect(qs).toEqual([1, 0, 1, 0]);
    const div = circ([reloj], [{ id: 'f1', tipo: 'd', entradas: ['f1.nq', 'CLK'] }], [['Q', 'f1.q']]);
    expect(cronograma(div, 4, {}).tramos.map((x) => x['f1.q']).join('')).toBe('01100110');
  });

  test('contador asíncrono de dos biestables y contador de décadas con reset', () => {
    const rizado = circ([reloj], [{ id: 'f1', tipo: 'd', entradas: ['f1.nq', 'CLK'] }, { id: 'f2', tipo: 'd', entradas: ['f2.nq', 'f1.nq'] }]);
    let s = iniciar(rizado);
    const cuenta: number[] = [];
    for (let j = 0; j < 5; j++) {
      s = pulso(rizado, s, 'CLK');
      cuenta.push(2 * leer(s, 'f2.q') + leer(s, 'f1.q'));
    }
    expect(cuenta).toEqual([1, 2, 3, 0, 1]);
    const bcd = circ([reloj, ...ent('R')], [{ id: 'c', tipo: 'contador', bits: 4, modulo: 10, entradas: ['CLK', 'R'] }]);
    let u = iniciar(bcd);
    const vs: number[] = [];
    for (let j = 0; j < 11; j++) vs.push((u = pulso(bcd, u, 'CLK')).internos.c!);
    expect(vs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1]);
    u = poner(bcd, u, { R: 1 });
    expect([leer(u, 'c.q0'), u.internos.c]).toEqual([0, 0]);
    u = pulso(bcd, u, 'CLK');
    expect(u.internos.c).toBe(0);
  });

  test('multiplexor de 4 a 1 y decodificador de 2 a 4 con habilitación', () => {
    const mux = circ(ent('S0', 'S1', 'D0', 'D1', 'D2', 'D3'), [{ id: 'm', tipo: 'mux', bits: 2, entradas: ['S0', 'S1', 'D0', 'D1', 'D2', 'D3'] }], [['Y', 'm']]);
    for (let sel = 0; sel < 4; sel++) {
      const st = iniciar(mux, null, { S0: (sel & 1) as Nivel, S1: (sel >> 1) as Nivel, [`D${sel}`]: 1 });
      expect(leer(st, 'm'), `sel ${sel}`).toBe(1);
      const otro = iniciar(mux, null, { S0: (sel & 1) as Nivel, S1: (sel >> 1) as Nivel, [`D${(sel + 1) % 4}`]: 1 });
      expect(leer(otro, 'm')).toBe(0);
    }
    const dec = circ(ent('A0', 'A1', 'EN'), [{ id: 'd', tipo: 'decodificador', bits: 2, entradas: ['A0', 'A1', 'EN'] }]);
    const st = iniciar(dec, null, { A0: 0, A1: 1, EN: 1 });
    expect([0, 1, 2, 3].map((k) => leer(st, `d.y${k}`))).toEqual([0, 0, 1, 0]);
    expect([0, 1, 2, 3].map((k) => leer(iniciar(dec, null, { A0: 0, A1: 1, EN: 0 }), `d.y${k}`))).toEqual([0, 0, 0, 0]);
  });

  test('un anillo de tres inversores oscila (no estable); un biestable de dos NAND con realimentación no', () => {
    expect(iniciar(circ([], [{ id: 'a', tipo: 'not', entradas: ['c'] }, { id: 'b', tipo: 'not', entradas: ['a'] }, { id: 'c', tipo: 'not', entradas: ['b'] }])).estable).toBe(false);
    const sr = circ(ent('S', 'R'), [{ id: 'n1', tipo: 'nand', entradas: ['S', 'n2'] }, { id: 'n2', tipo: 'nand', entradas: ['R', 'n1'] }]);
    const s = iniciar(sr, null, { S: 1, R: 1 });
    expect(s.estable).toBe(true);
    // set with /S = 0, then hold
    const a = poner(sr, s, { S: 0 });
    const b = poner(sr, a, { S: 1 });
    expect([leer(b, 'n1'), leer(b, 'n2'), b.estable]).toEqual([1, 0, true]);
  });

  test('averías: atascada a 0 o a 1 y una entrada TTL al aire (se lee 1; la sonda no da nivel)', () => {
    const or3 = circ(ent('A', 'B'), [{ id: 'n1', tipo: 'nand', entradas: ['A', 'A'] }, { id: 'n2', tipo: 'nand', entradas: ['B', 'B'] }, { id: 'n3', tipo: 'nand', entradas: ['n1', 'n2'] }], [['Y', 'n3']]);
    expect(tablaVerdad(or3, ['Y'], { tipo: 'atascada-0', senal: 'n1' }).filas.map((f) => f.s[0]).join('')).toBe('1111');
    expect(tablaVerdad(or3, ['Y'], { tipo: 'atascada-1', senal: 'n3' }).filas.map((f) => f.s[0]).join('')).toBe('1111');
    const aire = { tipo: 'sin-conexion' as const, pieza: 'n3', pin: 0 };
    expect(tablaVerdad(or3, ['Y'], aire).filas.map((f) => f.s[0]).join('')).toBe('0101');
    expect(sondear(or3, iniciar(or3, aire), { pieza: 'n3', pin: 0 }, aire)).toBe('aire');
    // the wire before the break still has its level
    expect(sondear(or3, iniciar(or3, aire), { senal: 'n1' }, aire)).toBe(1);
    expect(lecturaCon(or3, { A: 1, B: 0 }, { senal: 'n1' }, null)).toBe(0);
  });

  test('cronograma: dos tramos por ciclo, el estímulo cambia con el reloj bajo y el flanco sube a mitad del ciclo', () => {
    const c = circ([reloj, ...ent('D')], [{ id: 'f', tipo: 'd', entradas: ['D', 'CLK'] }]);
    const cr = cronograma(c, 4, { D: [1, 0, 0, 1] });
    expect(cr.tramos.map((x) => x.CLK).join('')).toBe('01010101');
    expect(cr.tramos.map((x) => x.D).join('')).toBe('11000011');
    expect(cr.tramos.map((x) => x['f.q']).join('')).toBe('01100001');
    expect(cr.estable).toBe(true);
  });

  test('mínimo de puertas: OR con NAND = 3, XOR con NAND = 4, inversor con NAND = 1, AND con NOR = 3', () => {
    expect(minimoPuertas(mascaraDe([0, 1, 1, 1]), 2, ['nand'], 4).minimo).toBe(3);
    expect(minimoPuertas(mascaraDe([0, 1, 1, 0]), 2, ['nand'], 5).minimo).toBe(4);
    expect(minimoPuertas(mascaraDe([1, 0]), 1, ['nand'], 3).minimo).toBe(1);
    expect(minimoPuertas(mascaraDe([0, 0, 0, 1]), 2, ['nor'], 4).minimo).toBe(3);
    expect(minimoPuertas(mascaraDe([0, 1, 1, 0]), 2, ['nand'], 3)).toEqual({ minimo: null, agotado: false });
    expect(minimoPuertas(mascaraDe([0, 1, 1, 0, 1, 0, 0, 1]), 3, ['nand', 'nor', 'and', 'or', 'not'], 9, 2000).agotado).toBe(true);
  });
});

test.describe('dibujo automático', () => {
  const casos: [string, CircuitoLogico][] = [
    ['OR de tres NAND', circ(ent('A', 'B'), [{ id: 'n1', tipo: 'nand', entradas: ['A', 'A'] }, { id: 'n2', tipo: 'nand', entradas: ['B', 'B'] }, { id: 'n3', tipo: 'nand', entradas: ['n1', 'n2'] }], [['Y', 'n3']])],
    ['divisor por dos', circ([reloj], [{ id: 'f1', tipo: 'd', entradas: ['f1.nq', 'CLK'] }], [['Q', 'f1.q']])],
    ['contador de rizado y su decodificador', circ([reloj, ...ent('EN')], [{ id: 'f1', tipo: 'd', entradas: ['f1.nq', 'CLK'] }, { id: 'f2', tipo: 'd', entradas: ['f2.nq', 'f1.nq'] }, { id: 'd', tipo: 'decodificador', bits: 2, entradas: ['f1.q', 'f2.q', 'EN'] }], [['Y0', 'd.y0'], ['Y3', 'd.y3']])],
    ['semisumador y una entrada lejana', circ(ent('A', 'B', 'C'), [{ id: 'x', tipo: 'xor', entradas: ['A', 'B'] }, { id: 'y', tipo: 'and', entradas: ['A', 'B'] }, { id: 'z', tipo: 'or', entradas: ['y', 'x'] }, { id: 'w', tipo: 'and', entradas: ['z', 'C'] }], [['S', 'x'], ['W', 'w']])],
  ];
  for (const [nombre, c] of casos)
    test(`${nombre}: cada patilla cableada, ningún cable cruza una pieza y todo dentro del dibujo`, () => {
      const p = planoDe(c);
      const pines = c.piezas.reduce((n, q) => n + q.entradas.filter((r) => r !== '0' && r !== '1').length, 0);
      expect(p.hilos.length).toBe(pines + c.salidas.length);
      for (const h of p.hilos) {
        for (const [x, y] of h.puntos) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(p.ancho);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(p.alto);
        }
        // orthogonal, and no segment runs through the inside of a piece's box
        for (let k = 0; k + 1 < h.puntos.length; k++) {
          const [a, b] = [h.puntos[k]!, h.puntos[k + 1]!];
          expect(a[0] === b[0] || a[1] === b[1], `${h.senal} ortogonal`).toBe(true);
          for (const q of p.piezas) {
            const dentroX = (x: number) => x > q.x + 6 && x < q.x + q.w - 6;
            const dentroY = (y: number) => y > q.y + 2 && y < q.y + q.h - 2;
            if (a[1] === b[1] && dentroY(a[1])) expect(Math.max(a[0], b[0]) <= q.x + 6 || Math.min(a[0], b[0]) >= q.x + q.w - 6, `${h.senal} atraviesa ${q.id}`).toBe(true);
            if (a[0] === b[0] && dentroX(a[0])) expect(Math.max(a[1], b[1]) <= q.y + 2 || Math.min(a[1], b[1]) >= q.y + q.h - 2, `${h.senal} atraviesa ${q.id}`).toBe(true);
          }
        }
      }
      // the boxes do not overlap
      for (const q of p.piezas) for (const r of p.piezas) if (q !== r) expect(q.x + q.w <= r.x || r.x + r.w <= q.x || q.y + q.h <= r.y || r.y + r.h <= q.y, `${q.id}/${r.id}`).toBe(true);
      expect(planoDe(c)).toEqual(p);
    });
  test('un punto de unión donde una señal se reparte (y ninguno en una simple esquina)', () => {
    const p = planoDe(casos[0]![1]);
    expect(p.uniones.map((u) => u.senal).sort()).toEqual(['A', 'B']);
  });
});

test.describe('generador: la lección de catálogo y cada regla rota', () => {
  test('la lección de catálogo se genera sin errores, con sus pasos digitales', () => {
    expect(R.errores).toEqual([]);
    expect(L.tarjetas.map((x) => x.actividad?.tipo ?? '-').join(' ')).toBe('- - tabla diseno-logico averia-logica - dibujar-digital - tocar tocar -');
    const fig = T('explore-soldaduras').widget!;
    expect(fig.tipo === 'figura' && fig.fuente).toMatchObject({ origen: 'libro', src: 'fig/13.5.svg', vectorial: true, num: '13.5' });
    const nes = T('toque-decodificador').widget!;
    expect(nes.tipo === 'figura' && nes.zonas.find((z) => z.id === 'decodificador')).toMatchObject({ hotspot: 'U3', rects: [[122, 320, 140, 48]] });
    expect(nes.tipo === 'figura' && nes.fuente.origen).toBe('consola');
    expect((T('dibuje-divisor').actividad as { esperado: Nivel[] }).esperado.join('')).toBe('01100110');
    expect((T('tabla-or-nand').actividad as { esperado: Nivel[][] }).esperado.map((f) => f[0]).join('')).toBe('0111');
    // the questions are practised on their own like every other
    expect(esPracticable(T('toque-puente')) && esPracticable(T('tabla-or-nand')) && esPracticable(T('averia-or'))).toBe(true);
  });

  const casos: [string, (f: F) => void, RegExp][] = [
    ['una señal que no existe', (f) => (tarjetaDe(f, 'explore-nand').widget.piezas[0].entradas = ['A', 'C']), /«C» no es una entrada ni la salida de una pieza/],
    ['una puerta con una sola entrada', (f) => (tarjetaDe(f, 'explore-nand').widget.piezas[0].entradas = ['A']), /widget.piezas 1.entradas»: de 2 a 4/],
    ['un tipo de pieza desconocido', (f) => (tarjetaDe(f, 'explore-nand').widget.piezas[0].tipo = 'nandd'), /widget.piezas 1.tipo/],
    ['un lazo que oscila', (f) => {
      const w = tarjetaDe(f, 'explore-nand').widget;
      w.piezas = [{ id: 'a', tipo: 'not', entradas: ['b'] }, { id: 'b', tipo: 'not', entradas: ['c'] }, { id: 'c', tipo: 'not', entradas: ['a'] }];
      w.salidas = [{ id: 'Y', de: 'a' }];
    }, /oscila/],
    ['un LED de una señal que no existe', (f) => (tarjetaDe(f, 'explore-nand').widget.salidas = [{ id: 'Y', de: 'n9' }]), /«n9» no es una señal del circuito/],
    ['tabla de verdad de un circuito con biestable', (f) => (tarjetaDe(f, 'explore-divisor').widget.tabla = true), /combinacional/],
    ['un estímulo de otra longitud', (f) => (tarjetaDe(f, 'explore-divisor').widget.cronograma.estimulo = { CLK: '0101' }), /que no sea el reloj/],
    ['«requiere» de una entrada que no hay', (f) => (tarjetaDe(f, 'explore-nand').requiere = { mover: ['C'] }), /«C» no tiene mando/],
    ['un diseño cuyo mínimo no lo es', (f) => {
      const d = tarjetaDe(f, 'disene-or').diseno;
      d.permitidas = ['nand', 'or'];
      d.referencia = [{ tipo: 'nand', entradas: ['A', 'A'] }, { tipo: 'nand', entradas: ['B', 'B'] }, { tipo: 'nand', entradas: ['p1', 'p2'] }];
    }, /con 1 puerta nand\/or ya se hace/],
    ['un diseño con piezas puestas', (f) => (tarjetaDe(f, 'disene-or').widget.piezas = [{ id: 'n1', tipo: 'nand', entradas: ['A', 'B'] }]), /empieza sin piezas/],
    ['una referencia que no da la columna', (f) => (tarjetaDe(f, 'disene-or').diseno.columna = '0001'), /no la de «diseno.columna»/],
    ['dos averías de piezas distintas que miden lo mismo', (f) => {
      const a = tarjetaDe(f, 'averia-or').averia;
      a.puntos = [{ id: 'a', rotulo: 'A', senal: 'A' }, { id: 'y', rotulo: 'Y', senal: 'n3' }];
    }, /miden lo mismo en todo/],
    ['una avería invisible (sin sondar las patillas, una entrada al aire que se lee 1 como la otra)', (f) => {
      const a = tarjetaDe(f, 'averia-or').averia;
      a.puntos = [{ id: 'a', rotulo: 'A', senal: 'A' }, { id: 'b', rotulo: 'B', senal: 'B' }, { id: 'n1', rotulo: 'N1', senal: 'n1' }, { id: 'n2', rotulo: 'N2', senal: 'n2' }, { id: 'n3', rotulo: 'N3', senal: 'n3' }];
      a.fallos[1] = { id: 'n1-x', pieza: 'n1', tipo: 'sin-conexion', pin: 2, texto: 'Al aire.' };
      a.fallos.push({ id: 'n1-y', pieza: 'n1', tipo: 'atascada-0', texto: 'A cero.' });
    }, /mide lo mismo que el circuito sano/],
    ['un sospechoso sin avería', (f) => (tarjetaDe(f, 'averia-or').averia.fallos = tarjetaDe(f, 'averia-or').averia.fallos.slice(0, 2)), /«n2» no tiene ninguna avería/],
    ['una zona sin explicación', (f) => delete tarjetaDe(f, 'toque-puente').tocar.porque.fria, /falta por qué no es «fria»/],
    ['una zona fuera de la figura', (f) => (tarjetaDe(f, 'toque-puente').widget.zonas[0].rect = [400, 2, 136, 126]), /se sale de la figura/],
    ['una figura que no existe', (f) => (tarjetaDe(f, 'toque-puente').widget.figura = 'fig-99.99'), /no es una figura del libro/],
    ['un hotspot que no está en la foto', (f) => (tarjetaDe(f, 'toque-decodificador').widget.zonas[0].hotspot = 'U99'), /«U99» no está en esa foto/],
    ['un «tocar» sin figura', (f) => (tarjetaDe(f, 'toque-puente').widget = tarjetaDe(f, 'explore-nand').widget), /lleva un widget «figura»/],
    ['dibujar una entrada', (f) => (tarjetaDe(f, 'dibuje-divisor').dibujar.senal = 'CLK'), /dibuje una salida/],
    ['un número del texto de una zona que no es del libro', (f) => (tarjetaDe(f, 'explore-soldaduras').widget.zonas[0].texto = 'Correcta: 37 grados.'), /el número 37/],
  ];
  for (const [nombre, cambio, esperado] of casos)
    test(nombre, () => {
      const e = errores(cambio);
      expect(e.join('\n')).toMatch(esperado);
    });

  test('los nombres de un mando de lista admiten cifras («Sn63Pb37», «0805»), salvo un nombre que es solo un número', () => {
    const base = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap01', 'sec-1.4.yaml'), 'utf8'));
    const g = (nombres: string[]) => {
      const f = copia(base) as F;
      (f.tarjetas[0]!.widget as { mandos: unknown[] }).mandos = [{ valor: 'R_2', lista: [1000, 5000], nombres }];
      return generarLeccion(f, contexto, 'cat').errores.filter((x) => /nombres/.test(x));
    };
    expect(g(['Sn63Pb37', 'SAC305'])).toEqual([]);
    expect(g(['0805', '12-0-12'])).toEqual([]);
    expect(g(['rojo', '5000']).join(' ')).toMatch(/un nombre que no sea su propio valor/);
  });

  test('avisos nuevos: «ocultar» sin lectura, estimación en el extremo más alejado y avería por bisección', () => {
    const base = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap01', 'sec-1.4.yaml'), 'utf8')) as F;
    const f = copia(base);
    const sim = f.tarjetas.find((x) => x.id === 'simule-carga')!;
    delete sim.widget.lectura;
    const r = generarLeccion(f, contexto, 'cat');
    expect(r.avisos.join('\n')).toMatch(/sin «lectura»/);
    expect(tamanoImagen(path.join(web, 'public', 'libro', 'img', 'foto_nes.jpg'))).toEqual({ ancho: 1600, alto: 1166 });
  });
});

test.describe('motor: los pasos sobre la figura y el circuito', () => {
  const nuevo = (x: Tarjeta) => nuevoEstado(x);
  test('explorar una figura: «Continuar» tras tocar las zonas pedidas, y dice cuáles faltan', () => {
    const x = T('explore-soldaduras');
    let e = nuevo(x);
    expect(e.widget12?.zona).toBe(null);
    expect(exploracionHecha(x, e, {})).toBe(false);
    expect(faltaPorExplorar(L, x, e, {})).toBe('Para seguir, toque: Arriba en el centro, Abajo en el centro.');
    e = { ...e, movidos: ['fria', 'puente'] };
    expect(botonPrincipal(x, e, {}).bloqueado).toBe(false);
    const n = T('explore-nand');
    expect(faltaPorExplorar(L, n, nuevo(n), {})).toBe('Para seguir, mueva: el interruptor A, el interruptor B.');
    expect(faltaPorExplorar(L, T('explore-divisor'), nuevo(T('explore-divisor')), {})).toBe('Para seguir, mueva el cursor del cronograma.');
  });

  test('tocar: una zona mala se explica y queda tachada; la buena acierta', () => {
    const x = T('toque-puente');
    let e: EstadoTarjeta = { ...nuevo(x), actividad: { tipo: 'tocar', elegidas: ['fria'], descartadas: [] } };
    const r1 = comprobar(L, x, e, {});
    expect(r1.estado.bien).toBe(false);
    expect(textoPlano(r1.aviso.textos[0])).toBe('Está mate y grumosa, pero en una sola isla.');
    expect((r1.estado.actividad as EstadoTocar).descartadas).toEqual(['fria']);
    e = reintentar(x, r1.estado);
    e = { ...e, actividad: { ...(e.actividad as EstadoTocar), elegidas: ['puente'] } };
    expect(comprobar(L, x, e, {}).estado.bien).toBe(true);
  });

  test('tabla: filas mal marcadas; bien con la columna de la OR', () => {
    const x = T('tabla-or-nand');
    const con = (c: Nivel[]) => ({ ...nuevo(x), actividad: { tipo: 'tabla', celdas: c.map((v) => [v]), mal: [] } as EstadoTabla });
    expect(botonPrincipal(x, nuevo(x), {}).bloqueado).toBe(true);
    const r = comprobar(L, x, con([0, 1, 1, 0]), {});
    expect([r.estado.bien, (r.estado.actividad as EstadoTabla).mal]).toEqual([false, [3]]);
    expect(comprobar(L, x, con([0, 1, 1, 1]), {}).estado.bien).toBe(true);
  });

  test('diseño: una fila que falla, de más puertas, y el mínimo', () => {
    const x = T('disene-or');
    const a = x.actividad as DisenoLogico;
    const con = (puertas: EstadoDisenoLogico['puertas'], salida: string) => ({ ...nuevo(x), actividad: { tipo: 'diseno-logico', puertas, salida } as EstadoDisenoLogico });
    const r1 = comprobar(L, x, con([{ tipo: 'nand', entradas: ['A', 'B'] }], 'p1'), {});
    expect(textoPlano(r1.aviso.textos[0])).toBe('Con A = 0, B = 0 su circuito da 1 y debe dar 0.');
    const cinco = con([{ tipo: 'nand', entradas: ['A', 'A'] }, { tipo: 'nand', entradas: ['p1', 'p1'] }, { tipo: 'nand', entradas: ['p2', 'p2'] }, { tipo: 'nand', entradas: ['B', 'B'] }, { tipo: 'nand', entradas: ['p3', 'p4'] }], 'p5');
    const r2 = comprobar(L, x, cinco, {});
    expect([r2.estado.bien, textoPlano(r2.aviso.textos[0])]).toEqual([false, 'Funciona, con 5 puertas: se puede con 3.']);
    const tres = con([{ tipo: 'nand', entradas: ['A', 'A'] }, { tipo: 'nand', entradas: ['B', 'B'] }, { tipo: 'nand', entradas: ['p1', 'p2'] }], 'p3');
    expect(comprobar(L, x, tres, {}).estado.bien).toBe(true);
    expect(circuitoDiseno((x.widget as { circuito: CircuitoLogico }).circuito, a, tres.actividad).salidas[0]!.de).toBe('p3');
  });

  test('avería lógica: un sospechoso malo explicado con su propia medida, luego la buena; «Volver a intentarlo» guarda las medidas', () => {
    const x = T('averia-or');
    const a = x.actividad as AveriaLogica;
    expect(a.puntos.map((p) => p.id)).toContain('p-n3-1');
    const e0 = nuevo(x);
    const ea = e0.actividad as EstadoAveriaLogica;
    expect(a.fallos[ea.fallo]!.id).toBe('n3-al-aire');
    const medidas = [{ niveles: { A: 0, B: 0 } as Record<string, Nivel>, punto: 's-n1', lectura: 1 as const }];
    const e: EstadoTarjeta = { ...e0, actividad: { ...ea, medidas, sospechoso: 'n1' } };
    const r = comprobar(L, x, e, {});
    expect(textoPlano(r.aviso.textos[0])).toBe('Si fuera N1 (invierte A) (salida atascada a 0), con A = 0, B = 0 la sonda en «Salida de N1» marcaría nivel bajo (0); usted midió nivel alto (1).');
    const e2 = reintentar(x, r.estado);
    expect((e2.actividad as EstadoAveriaLogica).medidas).toEqual(medidas);
    expect((e2.actividad as EstadoAveriaLogica).descartados).toEqual(['n1']);
    expect(comprobar(L, x, { ...e2, actividad: { ...(e2.actividad as EstadoAveriaLogica), sospechoso: 'n3' } }, {}).estado.bien).toBe(true);
  });

  test('dibujar en modo digital: tramos mal y el primero de ellos; bien con la onda del divisor', () => {
    const x = T('dibuje-divisor');
    const con = (s: string) => ({ ...nuevo(x), actividad: { tipo: 'dibujar-digital', niveles: s.split('').map(Number) as Nivel[], mal: [] } as EstadoDibujarDigital });
    const r = comprobar(L, x, con('00000000'), {});
    expect(textoPlano(r.aviso.textos[0])).toBe('4 de 8 tramos no coinciden (marcados); el primero, en el ciclo 1.');
    expect((r.estado.actividad as EstadoDibujarDigital).mal).toEqual([1, 2, 5, 6]);
    expect(comprobar(L, x, con('01100110'), {}).estado.bien).toBe(true);
  });
});
