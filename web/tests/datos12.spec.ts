// 0.12, the «data» block: the backup of all the progress (export and import, src/lib/sincronizacion/copia.ts and
// copia-formato.ts; the «Copia de seguridad» card of the Sincronización page and the entry in «Aa») and the daily
// activity summed across devices (src/lib/progreso-dias.ts, progreso-diario.svelte.ts).
//   - pure, in Node: the merge of the per-device records (commutative, associative, idempotent; the day's total is the
//     sum of every device's latest record, never twice), the legacy rule (0.9–0.11 days), the three-way merge of two
//     tabs, and the import's plan (never loses a local item, never brings back what a newer deletion removed,
//     importing twice changes nothing);
//   - the REAL engine in Node (tests/motor-real, child process): the 0.12 scenarios (d12·…, c12·…) and a share of the
//     randomized simulation (the whole one: revision11-motor.spec.ts and `correr.ts azar 520`);
//   - in the browser: export (a download without the token), import (file chooser, preview, «Unir», «Sustituir todo»
//     behind its confirmation and the automatic backup), damaged files, «Aa», the start page's goal with two devices'
//     records, a 360 px phone, touch targets and axe in the three themes.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.datos12.config.ts tests/datos12.spec.ts
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { canonico, fusionarColecciones, ganadora, esLapida, type Coleccion, type Entrada } from '../src/lib/sincronizacion/fusion';
import { ErrorCopia, leerCopia, planificar, FORMATO_COPIA, type AlmacenConocido, type Copia } from '../src/lib/sincronizacion/copia-formato';
import {
  agrupar,
  compactar,
  grupoDe,
  idAporte,
  rehacerDia,
  rehacerDias,
  tocarDia,
  totalDia,
  unirAportesPestanas,
  LEGADO,
  absorberLegado,
  type DiaProgreso,
  type ObjetivoDiario,
} from '../src/lib/progreso-dias';
import { unirDiasRepaso } from '../src/componentes/repaso/diario';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const TOKEN = ['github', 'pat', '11PRUEBA0123456789abcdefghijklmnopqrstuvwxyz'].join('_');
const OBJ: ObjetivoDiario = { tipo: 'pasos', cantidad: 3, secciones: true };
/**
 * 1.0: data an older version wrote on top of a sum (a 0.11 device's mirror) reach 1.0 only through the schema migration
 * (lib/esquemas.ts, `absorberLegado`, the same on the device's storage, an old file and an old backup): these 0.12
 * checks of the legacy excess are run on the migrated map — the counts must be 0.12's.
 */
const migrado = (m: Record<string, DiaProgreso>): Record<string, DiaProgreso> => {
  const c = structuredClone(m);
  absorberLegado(c);
  return c;
};

/** mulberry32 */
function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ================================================================== pure: the daily activity

test.describe('suma diaria por dispositivo (puro)', () => {
  test('la unión de los registros es conmutativa, asociativa e idempotente, y el día suma la última versión de cada dispositivo una vez', () => {
    const DIA = '2026-11-04';
    for (let k = 0; k < 3000; k++) {
      const rnd = azar(k + 1);
      const n = 2 + Math.floor(rnd() * 3);
      // each device's record grows over time (a few versions); three copies hold random versions of each
      const versiones: Record<string, DiaProgreso[]> = {};
      for (let d = 0; d < n; d++) {
        let p = 0;
        versiones[`d${d}aaaaaa`] = Array.from({ length: 1 + Math.floor(rnd() * 4) }, (_, i) => {
          p += 1 + Math.floor(rnd() * 3);
          return { pasos: p, preguntas: i, secciones: 0, cumplido: false, t: 1000 + i * 10 + d };
        });
      }
      const copia = (): Coleccion => {
        const c: Coleccion = {};
        for (const [d, vs] of Object.entries(versiones)) {
          if (rnd() < 0.2) continue;
          const v = vs[Math.floor(rnd() * vs.length)]!;
          c[idAporte(DIA, d)] = { t: v.t, v };
        }
        return c;
      };
      const [a, b, c] = [copia(), copia(), copia()];
      const ab_c = fusionarColecciones(fusionarColecciones(a, b), c);
      const a_bc = fusionarColecciones(a, fusionarColecciones(b, c));
      const cba = fusionarColecciones(fusionarColecciones(c, b), a);
      expect(canonico(ab_c), `prueba ${k}: asociativa`).toBe(canonico(a_bc));
      expect(canonico(ab_c), `prueba ${k}: conmutativa`).toBe(canonico(cba));
      expect(canonico(fusionarColecciones(ab_c, ab_c)), `prueba ${k}: idempotente`).toBe(canonico(ab_c));
      expect(canonico(fusionarColecciones(ab_c, a)), `prueba ${k}: volver a sincronizar no cambia nada`).toBe(canonico(ab_c));
      // the day's total: every device's newest version present, once
      const m: Record<string, DiaProgreso> = Object.fromEntries(Object.entries(ab_c).map(([id, e]) => [id, (e as { v: DiaProgreso }).v]));
      let esperado = 0;
      for (const [d] of Object.entries(versiones)) {
        const e = [a, b, c].map((x) => x[idAporte(DIA, d)]).reduce<Entrada | undefined>((x, y) => ganadora(x, y), undefined);
        if (e && !esLapida(e)) esperado += (e.v as DiaProgreso).pasos;
      }
      expect(totalDia(agrupar(m).get(DIA) ?? { aportes: new Map() }).pasos, `prueba ${k}: la suma`).toBe(esperado);
      // the mirror rebuilt from the same records is the same on every device, and rebuilding again changes nothing
      const m1 = structuredClone(m);
      const m2 = structuredClone(m);
      rehacerDia(m1, DIA, OBJ, true, 0);
      rehacerDia(m2, DIA, OBJ, true, 0);
      expect(canonico(m1)).toBe(canonico(m2));
      expect(rehacerDia(m1, DIA, OBJ, true, 0)).toEqual([]);
    }
  });

  test('datos de la 0.11: el día viejo cuenta una vez, lo nuevo se suma, y lo que añade una versión vieja encima también', () => {
    const DIA = '2026-11-04';
    const m: Record<string, DiaProgreso> = { [DIA]: { pasos: 3, preguntas: 1, secciones: 0, cumplido: true, t: 500 } };
    expect(totalDia(agrupar(m).get(DIA)!)).toEqual({ pasos: 3, preguntas: 1, secciones: 0 });
    // two devices change the day: both store the same legacy record and add their own
    const x = structuredClone(m);
    const y = structuredClone(m);
    tocarDia(x, DIA, 'xxxxxxxx', 1000, OBJ, 'pasos', 1);
    tocarDia(y, DIA, 'yyyyyyyy', 1001, OBJ, 'pasos', 2);
    expect(x[idAporte(DIA, LEGADO)]).toEqual(y[idAporte(DIA, LEGADO)]);
    const u = { ...x, ...y, [idAporte(DIA, 'xxxxxxxx')]: x[idAporte(DIA, 'xxxxxxxx')]! };
    expect(totalDia(agrupar(u).get(DIA)!).pasos).toBe(6);
    // an older version adds 4 on top of the mirror it saw (6): newer than every record, its excess counts
    const viejo = migrado({ ...u, [DIA]: { ...u[DIA]!, pasos: 10, t: 5000 } });
    expect(totalDia(agrupar(viejo).get(DIA)!).pasos).toBe(10);
    expect(viejo[idAporte(DIA, LEGADO)]!.pasos).toBe(7);
    rehacerDia(viejo, DIA, OBJ, true, 0);
    expect(totalDia(agrupar(viejo).get(DIA)!).pasos).toBe(10);
    // a mirror of 0.12 (dated as its newest record) never adds anything
    const nuevo = { ...u, [DIA]: { ...u[DIA]!, pasos: 99, t: 1001 } };
    expect(totalDia(agrupar(nuevo).get(DIA)!).pasos).toBe(6);
  });

  test('dos escritores del mismo dispositivo: el registro propio suma sin bajar nunca, «día@0» el mayor, el resto el más nuevo', () => {
    const base: DiaProgreso = { pasos: 2, preguntas: 1, secciones: 0, cumplido: false, t: 10 };
    const a: DiaProgreso = { ...base, pasos: 3, t: 20 };
    const b: DiaProgreso = { ...base, pasos: 5, preguntas: 0, t: 21 };
    // this tab's own record: both additions kept, never below this tab's count (an older copy written back: no loss)
    expect(unirAportesPestanas('2026-11-04@x', a, b, base, 'x')).toEqual({ pasos: 6, preguntas: 1, secciones: 0, cumplido: false, t: 21 });
    expect(unirAportesPestanas('2026-11-04@x', a, b, undefined, 'x')).toEqual({ pasos: 8, preguntas: 1, secciones: 0, cumplido: false, t: 21 });
    const viejo: DiaProgreso = { ...base, pasos: 1, t: 5 };
    expect(unirAportesPestanas('2026-11-04@x', a, viejo, base, 'x')!.pasos).toBe(3);
    // the legacy record: the larger, never a sum (review 0.12, finding 2)
    expect(unirAportesPestanas('2026-11-04@0', { ...base, pasos: 3 }, { ...base, pasos: 5 }, undefined, 'x')!.pasos).toBe(5);
    // another tab's or device's record and the mirror: the Guardado's default (the newer)
    expect(unirAportesPestanas('2026-11-04@y', a, b, base, 'x')).toBeUndefined();
    expect(unirAportesPestanas('2026-11-04', a, b, base, 'x')).toBeUndefined();
  });
});

test.describe('ronda de arreglos 1 (puro)', () => {
  test('un paso deshecho no baja el registro: va a su registro de deshechos y no vuelve con el excedente de una 0.11', () => {
    const DIA = '2026-11-04';
    const m: Record<string, DiaProgreso> = {};
    tocarDia(m, DIA, 'aaaaaaaa', 1000, OBJ, 'secciones', 3);
    tocarDia(m, DIA, 'aaaaaaaa', 2000, OBJ, 'secciones', -1);
    expect(m[idAporte(DIA, 'aaaaaaaa')]!.secciones).toBe(3);
    expect(m[idAporte(DIA, 'aaaaaaaa~')]!.secciones).toBe(1);
    expect(totalDia(agrupar(m).get(DIA)!).secciones).toBe(2);
    // a 0.11 device that saw 3 (before the undo) adds 1: 4 on its mirror, newer than every record → 2 + 1 = 3, not 4
    const viejo = migrado({ ...m, [DIA]: { ...m[DIA]!, secciones: 4, t: 5000 } });
    expect(totalDia(agrupar(viejo).get(DIA)!).secciones).toBe(3);
    // an undo never goes below what this writer counted
    tocarDia(m, DIA, 'aaaaaaaa', 3000, OBJ, 'secciones', -9);
    expect(totalDia(agrupar(m).get(DIA)!).secciones).toBe(0);
  });

  test('compactar: los registros de este dispositivo de días pasados quedan en uno (y uno de deshechos); el total no cambia', () => {
    const m: Record<string, DiaProgreso> = {};
    const d = '2026-11-01';
    tocarDia(m, d, 'dev00001-t1', 1000, OBJ, 'pasos', 2);
    tocarDia(m, d, 'dev00001-t2', 1100, OBJ, 'pasos', 3);
    tocarDia(m, d, 'dev00001-t2', 1200, OBJ, 'pasos', -1);
    tocarDia(m, d, 'otro0001', 1300, OBJ, 'pasos', 5);
    tocarDia(m, '2026-11-04', 'dev00001-t1', 9000, OBJ, 'pasos', 1);
    const antes = totalDia(agrupar(m).get(d)!).pasos;
    const r = compactar(m, 'dev00001', '2026-11-03');
    expect(r.poner.sort()).toEqual([`${d}@dev00001`, `${d}@dev00001~`]);
    expect(r.quitar.sort()).toEqual([`${d}@dev00001-t1`, `${d}@dev00001-t2`, `${d}@dev00001-t2~`]);
    expect(totalDia(agrupar(m).get(d)!).pasos).toBe(antes);
    expect(m[`${d}@otro0001`]!.pasos).toBe(5);
    expect(m['2026-11-04@dev00001-t1']).toBeTruthy();
    // compacting again changes nothing
    expect(compactar(m, 'dev00001', '2026-11-03')).toEqual({ poner: [], quitar: [] });
  });

  test('«unir» deja fuera lo antiguo que este dispositivo no conoce (más viejo que la poda del fichero), salvo que se pida', () => {
    const local = { notas: { b: { t: 50, v: { texto: 'b' } } } } as Record<string, Coleccion>;
    const copia = copiaDe({ notas: { a: { t: 10, v: { texto: 'a vieja' } }, b: { t: 20, v: { texto: 'b vieja' } }, c: { t: 200, v: { texto: 'c nueva' } } } });
    const [p] = planificar(local, copia, ALMACENES, 'unir', 300, { horizonte: 100 });
    expect(p!.antiguos).toBe(1);
    expect(Object.keys(p!.poner)).toEqual(['c']);
    const [q] = planificar(local, copia, ALMACENES, 'unir', 300, { horizonte: 100, incluirAntiguos: true });
    expect(q!.antiguos).toBe(0);
    expect(Object.keys(q!.poner).sort()).toEqual(['a', 'c']);
  });
});

// ================================================================== pure: the backup's format and plan

const ALMACENES: AlmacenConocido[] = [
  { clave: 'notas', nombre: 'Notas', valido: (v) => typeof (v as { texto?: unknown })?.texto === 'string' },
  { clave: 'leidas', nombre: 'Secciones leídas', valido: (v) => typeof v === 'number' },
];
const copiaDe = (almacenes: Record<string, Coleccion>): Copia => ({ formato: FORMATO_COPIA, version: 1, app: '0.12.0', exportado: 1, dispositivo: 'Prueba', almacenes });

test.describe('ronda de arreglos 3 (puro)', () => {
  test('el repaso del día (repaso-diario) de dos versiones: el mayor por campo — conmutativo, asociativo, idempotente; nunca más que la suma ni menos que cada una', () => {
    const rnd = azar(12_003);
    const dia = () => ({ r: Math.floor(rnd() * 50), n: Math.floor(rnd() * 20), b: Math.floor(rnd() * 50) });
    for (let k = 0; k < 2000; k++) {
      const [a, b, c] = [dia(), dia(), dia()];
      const ab = unirDiasRepaso(a, b);
      expect(ab).toEqual(unirDiasRepaso(b, a));
      expect(unirDiasRepaso(ab, c)).toEqual(unirDiasRepaso(a, unirDiasRepaso(b, c)));
      expect(unirDiasRepaso(ab, ab)).toEqual(ab);
      for (const f of ['r', 'n', 'b'] as const) {
        expect(ab[f]).toBeGreaterThanOrEqual(Math.max(a[f], b[f]));
        expect(ab[f]).toBeLessThanOrEqual(a[f] + b[f]);
      }
    }
  });
});

test.describe('ronda de arreglos 4 (puro)', () => {
  test('un paso de una 0.11 encima de un día con deshechos: nunca cuenta dos veces el deshecho (se queda corto si la 0.11 ya lo había visto)', () => {
    const dia = '2026-11-04';
    const base = () => {
      const m: Record<string, DiaProgreso> = {};
      tocarDia(m, dia, 'x', 1000, OBJ, 'pasos', 1);
      tocarDia(m, dia, 'x', 2000, OBJ, 'pasos', 1);
      return m;
    };
    const total = (m: Record<string, DiaProgreso>) => totalDia(grupoDe(migrado(m), dia)).pasos;
    // A: the 0.11 device, offline, adds a step on top of the mirror it had (2, before the undo), later in real time
    // than the undo (its mirror is the newest): 2 − 1 + 1 = 2 — what a rule taking the excess against the sum without
    // the undo records whenever the mirror is newer than them would count as 3
    const a = base();
    const visto = { ...a[dia]! };
    tocarDia(a, dia, 'x', 3000, OBJ, 'pasos', -1);
    a[dia] = { ...visto, pasos: visto.pasos + 1, t: Math.max(4000, visto.t + 1) };
    expect(total(a)).toBe(2);
    // B (review 12d·3, the limit of 0.12's rule): the 0.11 device had seen the undo (mirror 1) and adds a step: exact
    // would be 2; counted 1 — short, never twice. 1.0 migrates such data with 0.12's rule (once), and no 0.11 device
    // can write on top of a 1.0 file any more
    const b = base();
    tocarDia(b, dia, 'x', 3000, OBJ, 'pasos', -1);
    const e = b[dia]!;
    b[dia] = { ...e, pasos: e.pasos + 1, t: Math.max(4000, e.t + 1) };
    expect(total(b)).toBe(1);
    // a mirror M is ambiguous: «the sum with the undone step + k» or «the sum without it + k + 1» — the 0.11 device does
    // not say which day it saw, and its time (max(now, t + 1)) is newer than the undo in both cases
    expect([a[dia]!.pasos, b[dia]!.pasos]).toEqual([3, 2]);
    expect(a[dia]!.t > a[`${dia}@x~`]!.t && b[dia]!.t > b[`${dia}@x~`]!.t).toBe(true);
  });
});

test.describe('ronda de arreglos 7 (puro)', () => {
  test('rehacer los espejos de todos los días recorre el mapa un número fijo de veces, no una por día (sin depender de la carga)', () => {
    // 2 years × 3 devices: one record per device and day, and the day's mirror
    const m: Record<string, DiaProgreso> = {};
    const t0 = new Date(2024, 10, 4, 12).getTime();
    for (let d = 0; d < 730; d++) {
      const dia = new Date(t0 + d * 86_400_000).toISOString().slice(0, 10);
      for (const x of ['a', 'b', 'c']) m[`${dia}@${x}`] = { pasos: 1 + (d % 3), preguntas: 0, secciones: 0, cumplido: false, t: t0 + d * 86_400_000 };
      m[dia] = { pasos: 1, preguntas: 0, secciones: 0, cumplido: false, t: t0 + d * 86_400_000 - 1 };
    }
    let recorridos = 0;
    const contado = new Proxy(m, {
      ownKeys(o) {
        recorridos++;
        return Reflect.ownKeys(o);
      },
    });
    const cambiados = rehacerDias(contado, null, OBJ, '2026-11-04', () => Number.MAX_SAFE_INTEGER);
    expect(cambiados.length).toBeGreaterThan(700);
    // (before: three scans of the whole map per day, 2190 here)
    expect(recorridos).toBeLessThanOrEqual(2);
    // and the result is that of remaking each day on the whole map
    const uno = structuredClone(m);
    for (const dia of new Set(Object.keys(uno).map((k) => k.split('@')[0]!))) rehacerDia(uno, dia, OBJ, dia === '2026-11-04', Number.MAX_SAFE_INTEGER);
    expect(m).toEqual(uno);
  });
});

test.describe('copia de seguridad (puro)', () => {
  test('ficheros inservibles: mensajes en español y nada importado', () => {
    const buena = JSON.stringify(copiaDe({ notas: { a: { t: 1, v: { texto: 'x' } } } }));
    const casos: [string, RegExp][] = [
      ['{"formato":', /dañado o incompleto/],
      ['null', /no contiene una copia/],
      [JSON.stringify({ formato: 'x' }), /no es una copia/],
      // (1.0: format 2 is this version's; 1.2: 3, so a newer one is 4 — esquemas.ts FORMATO_DATOS)
      [JSON.stringify({ ...JSON.parse(buena), version: 4 }), /versión más nueva.*Actualice/],
      [JSON.stringify({ ...JSON.parse(buena), version: 0 }), /versión de formato válida/],
    ];
    for (const [t, e] of casos) {
      expect(() => leerCopia(t, ALMACENES), t).toThrow(ErrorCopia);
      expect(() => leerCopia(t, ALMACENES), t).toThrow(e);
    }
    // the synchronisation's own file is accepted (its collections are the same)
    const sinc = leerCopia(JSON.stringify({ formato: 'epa-sincronizacion', version: 1, id: 'f', actualizado: 5, podado: 0, dispositivos: {}, almacenes: { notas: { a: { t: 1, v: { texto: 'x' } } } } }), ALMACENES);
    expect(sinc.deSincronizacion).toBe(true);
    expect(Object.keys(sinc.copia.almacenes.notas!)).toEqual(['a']);
  });

  test('«unir»: nada local se pierde, nada que un borrado más nuevo quitó vuelve, e importar dos veces no cambia nada', () => {
    for (let k = 0; k < 2000; k++) {
      const rnd = azar(9000 + k);
      const col = (): Coleccion => {
        const c: Coleccion = {};
        for (let i = 0; i < 6; i++) {
          if (rnd() < 0.3) continue;
          const t = 1 + Math.floor(rnd() * 20);
          c[`n${i}`] = rnd() < 0.25 ? { t, x: 1 } : { t, v: { texto: `v${t}-${Math.floor(rnd() * 3)}` } };
        }
        return c;
      };
      const local = { notas: col() };
      const copia = copiaDe({ notas: col() });
      const [p] = planificar(local, copia, ALMACENES, 'unir', 100);
      // what the store holds afterwards
      const despues: Record<string, unknown> = {};
      for (const [id, e] of Object.entries(local.notas)) if (!esLapida(e)) despues[id] = e.v;
      Object.assign(despues, p!.poner);
      for (const id of p!.quitar) delete despues[id];
      for (const id of new Set([...Object.keys(local.notas), ...Object.keys(copia.almacenes.notas!)])) {
        const g = ganadora(local.notas[id], copia.almacenes.notas![id]);
        const esperado = g && !esLapida(g) ? g.v : undefined;
        expect(despues[id], `prueba ${k}: ${id} es la versión más nueva (o sigue borrado)`).toEqual(esperado);
      }
      // the marks carry the merged item's time (what the synchronisation sends)
      for (const id of Object.keys(p!.poner)) expect(p!.marcas[id]).toBe(ganadora(local.notas[id], copia.almacenes.notas![id])!.t);
      // importing again (local now dated as merged) changes nothing
      const otra: Coleccion = {};
      for (const id of new Set([...Object.keys(local.notas), ...Object.keys(copia.almacenes.notas!)])) otra[id] = ganadora(local.notas[id], copia.almacenes.notas![id])!;
      const [q] = planificar({ notas: otra }, copia, ALMACENES, 'unir', 100);
      expect(q!.nuevos + q!.cambiados + q!.borrados, `prueba ${k}: dos veces`).toBe(0);
    }
  });

  test('«sustituir»: los almacenes de la copia quedan como en ella; los demás no se tocan', () => {
    const local = { notas: { a: { t: 5, v: { texto: 'a' } }, b: { t: 9, v: { texto: 'b' } } }, leidas: { x: { t: 1, v: 1 } } } as Record<string, Coleccion>;
    const copia = copiaDe({ notas: { a: { t: 1, v: { texto: 'a vieja' } }, c: { t: 2, v: { texto: 'c' } }, b: { t: 3, x: 1 } } });
    const [p, otro] = planificar(local, copia, ALMACENES, 'sustituir', 100);
    expect(otro).toBeUndefined();
    expect(p!.poner).toEqual({ a: { texto: 'a vieja' }, c: { texto: 'c' } });
    expect(p!.quitar).toEqual(['b']);
    expect(Object.values(p!.marcas).every((t) => t === 100)).toBe(true);
  });
});

// ================================================================== the real engine (child process)

function correrMotor<T>(...args: string[]): Promise<T> {
  return new Promise((ok, mal) => {
    execFile(
      process.execPath,
      ['--experimental-transform-types', '--no-warnings', '--import', './tests/motor-real/registrar.mjs', 'tests/motor-real/correr.ts', ...args],
      { cwd: WEB, maxBuffer: 64 * 1024 * 1024, timeout: 1_500_000 },
      (e, salida, errores) => {
        if (e) return mal(new Error(`${e.message}\n${errores}`));
        try {
          ok(JSON.parse(salida.trim().split('\n').at(-1)!) as T);
        } catch {
          mal(new Error(`salida inesperada:\n${salida}\n${errores}`));
        }
      },
    );
  });
}

test.describe('motor real · 0.12', () => {
  test('escenarios de la copia y de la suma diaria (d12, c12), la carrera entre pestañas (r12) y las revisiones (a12, b12)', async () => {
    test.setTimeout(600_000);
    const r = await correrMotor<{ nombre: string; ok: boolean; error?: string }[]>('casos', '12·');
    expect(r.length).toBeGreaterThanOrEqual(25);
    const b12 = Array.from({ length: 22 }, (_, i) => `b12·${i + 1}`);
    // (1.0: d12·4, a 0.11 device adding on top of the sum, was removed with the 0.10/0.11 compatibility)
    for (const n of ['d12·1', 'd12·2', 'd12·3', 'd12·5', 'c12·1', 'c12·2', 'c12·3', 'c12·4', 'c12·5', 'c12·6', 'c12·7', 'r12·1', 'a12·4', 'a12·5', 'a12·6', ...b12])
      expect(r.some((c) => c.nombre.startsWith(n)), n).toBe(true);
    expect(r.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
  });

  test('escenarios de la revisión independiente de la 0.12 (revision12a.ts: a12·1–3)', async () => {
    test.setTimeout(300_000);
    const r = await new Promise<{ nombre: string; ok: boolean; error?: string }[]>((ok, mal) =>
      execFile(
        process.execPath,
        ['--experimental-transform-types', '--no-warnings', '--import', './tests/motor-real/registrar.mjs', 'tests/motor-real/revision12a.ts', 'a12'],
        { cwd: WEB, maxBuffer: 64 * 1024 * 1024, timeout: 280_000 },
        (e, salida, errores) => (e ? mal(new Error(`${e.message}\n${errores}`)) : ok(JSON.parse(salida.trim().split('\n').at(-1)!))),
      ),
    );
    expect(r.map((c) => c.nombre.slice(0, 5))).toEqual(['a12·1', 'a12·2', 'a12·3']);
    expect(r.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
  });

  // (1.0: d12d·3 was a documented limit of the 0.10/0.11 compatibility, reported as an expected failure; that
  // compatibility was dropped and the check now asserts the 1.0 rule — no limit is left)
  test('escenarios de las revisiones 12d a 12i (revision12d/e/f/g/h/i.ts)', async () => {
    test.setTimeout(300_000);
    const guion = <T,>(f: string) =>
      new Promise<T>((ok, mal) =>
        execFile(
          process.execPath,
          ['--experimental-transform-types', '--no-warnings', '--import', './tests/motor-real/registrar.mjs', f],
          { cwd: WEB, maxBuffer: 64 * 1024 * 1024, timeout: 280_000 },
          (e, salida, errores) => (e && !salida ? mal(new Error(`${e.message}\n${errores}`)) : ok(JSON.parse(salida.trim().split('\n').at(-1)!))),
        ),
      );
    const d = await guion<{ problemas: string[]; limites: string[] }>('tests/motor-real/revision12d.ts');
    expect(d.problemas).toEqual([]);
    expect(d.limites).toEqual([]);
    const e = await guion<{ nombre: string; ok: boolean; error?: string }[]>('tests/motor-real/revision12e.ts');
    expect(e.length).toBeGreaterThanOrEqual(5);
    expect(e.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
    const f = await guion<{ nombre: string; ok: boolean; error?: string }[]>('tests/motor-real/revision12f.ts');
    expect(f.length).toBeGreaterThanOrEqual(5);
    expect(f.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
    const g = await guion<{ nombre: string; ok: boolean; error?: string }[]>('tests/motor-real/revision12g.ts');
    expect(g.length).toBeGreaterThanOrEqual(4);
    // (g12·1 and g12·1b measure milliseconds — under the load of parallel workers they vary several times over —: run
    // on their own, or in Chromium, revision12g-pestanas.spec.ts; here the load-independent check is the scan count,
    // «ronda de arreglos 7 (puro)»)
    expect(g.filter((c) => !c.ok && !/^g12·1b? /.test(c.nombre)).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
    const h = await guion<{ nombre: string; ok: boolean; error?: string }[]>('tests/motor-real/revision12h.ts');
    expect(h.length).toBeGreaterThanOrEqual(4);
    expect(h.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
    const i = await guion<{ nombre: string; ok: boolean; error?: string }[]>('tests/motor-real/revision12i.ts');
    expect(i.length).toBeGreaterThanOrEqual(4);
    expect(i.filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.error}`)).toEqual([]);
  });

  test('guardar antes de instalar una actualización espera de verdad las escrituras (almacenamiento lento, Tauri y navegador)', async () => {
    test.setTimeout(300_000);
    const correr = (entorno: Record<string, string>) =>
      new Promise<{ problemas: string[] }>((ok, mal) =>
        execFile(
          process.execPath,
          ['--no-warnings', '--import', './tests/actualizacion/registrar.mjs', 'tests/actualizacion/salir.ts'],
          { cwd: WEB, env: { ...process.env, ...entorno }, timeout: 140_000 },
          (e, salida, errores) => (e ? mal(new Error(`${e.message}\n${errores}`)) : ok(JSON.parse(salida.trim().split('\n').at(-1)!))),
        ),
      );
    expect((await correr({ EPA_TAURI: '1', EPA_IPC_MS: '150' })).problemas).toEqual([]);
    expect((await correr({ EPA_TAURI: '' })).problemas).toEqual([]);
  });

  test('simulación al azar con progreso diario real y copias (60 pruebas)', async () => {
    test.setTimeout(1_200_000);
    const r = await correrMotor<{ problemas: string[]; conProblemas: number; errores: string[] }>('azar', '60', '600');
    expect(r.problemas).toEqual([]);
    expect(r.conProblemas).toBe(0);
    expect(r.errores).toEqual([]);
  });
});

// ================================================================== in the browser

/** A fixed «today» (noon of 2026-11-04, local time): its review day is «2026-11-04». */
const HOY = new Date(2026, 10, 4, 12).getTime();

async function abrir(page: Page, hash: string, datos: Record<string, unknown> = {}): Promise<void> {
  await page.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await page.clock.setFixedTime(HOY);
  await page.goto('/');
  await page.evaluate((d) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, datos);
  await page.goto(`/${hash}`);
  await page.reload();
}

const NOTA = (label: string, texto: string, t: number) => ({ parte: 'cap01', label, num: '1.1', titulo: `Figura ${label}`, texto, t });
const CON_TOKEN = { 'epa-credencial:github': TOKEN, 'epa:sinc-ajustes': { repositorio: 'Metalaria/electronica-datos', ruta: 'sincronizacion/datos.json', auto: false } };

async function exportar(page: Page): Promise<{ nombre: string; texto: string }> {
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-copia-exportar]').click()]);
  return { nombre: d.suggestedFilename(), texto: readFileSync((await d.path())!, 'utf8') };
}

async function elegirFichero(page: Page, nombre: string, texto: string): Promise<void> {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-copia-importar]').click()]);
  await fc.setFiles({ name: nombre, mimeType: 'application/json', buffer: Buffer.from(texto, 'utf8') });
}

test.describe('copia de seguridad · página de Sincronización', () => {
  test('exportar: un fichero JSON con todos los almacenes y sin el token', async ({ page }) => {
    await abrir(page, '#/sincronizacion', { ...CON_TOKEN, 'epa:notas': { 'fig:1': NOTA('fig:1', 'nota exportada', HOY - 5000) } });
    await expect(page.locator('[data-copia]')).toBeVisible();
    const f = await exportar(page);
    expect(f.nombre).toMatch(/^electronica-copia-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    const o = JSON.parse(f.texto) as Copia;
    expect(o.formato).toBe('epa-copia-seguridad');
    // (1.0: format 2; 1.2: 3)
    expect(o.version).toBe(3);
    expect(o.dispositivo).toContain('navegador');
    expect(Object.keys(o.almacenes).length).toBeGreaterThanOrEqual(22);
    expect((o.almacenes.notas!['fig:1'] as { v: { texto: string } }).v.texto).toBe('nota exportada');
    for (const prohibido of [TOKEN, 'github_pat', 'sinc-ajustes', 'dispositivo-local', 'credencial']) expect(f.texto).not.toContain(prohibido);
    await expect(page.locator('[data-copia-aviso]')).toContainText('Copia descargada');
  });

  test('importar y unir: vista previa por almacén, se une sin perder lo local y se marca para sincronizar', async ({ page }) => {
    const copia = JSON.stringify(
      copiaDe({
        notas: { 'fig:2': { t: HOY - 1000, v: NOTA('fig:2', 'de la copia', HOY - 1000) }, 'fig:1': { t: 10, v: NOTA('fig:1', 'vieja', 10) } },
        leidas: { 'cap01/sec-1.1': { t: HOY - 2000, v: HOY - 2000 } },
      }),
    );
    await abrir(page, '#/sincronizacion', { 'epa:notas': { 'fig:1': NOTA('fig:1', 'local y más nueva', HOY - 500) } });
    await elegirFichero(page, 'mi-copia.json', copia);
    const vista = page.locator('[data-copia-vista]');
    await expect(vista).toBeVisible();
    await expect(vista.locator('tr[data-almacen="notas"] [data-nuevos]')).toHaveText('1');
    await expect(vista.locator('tr[data-almacen="notas"] [data-cambiados]')).toHaveText('0');
    await expect(vista.locator('tr[data-almacen="leidas"] [data-nuevos]')).toHaveText('1');
    await expect(vista).toContainText('Copia de Prueba');
    await page.locator('[data-copia-aplicar]').click();
    await expect(page.locator('[data-copia-resultado]')).toContainText('Importado: 2 cambios');
    const notas = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:notas') ?? '{}') as Record<string, { texto: string }>);
    expect(notas['fig:1']!.texto).toBe('local y más nueva');
    expect(notas['fig:2']!.texto).toBe('de la copia');
    const marcas = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:sinc-marcas') ?? '{}') as { cambios: Record<string, Record<string, number>> });
    expect(marcas.cambios.notas?.['fig:2']).toBe(HOY - 1000);
    // the same file again: nothing to import
    await elegirFichero(page, 'mi-copia.json', copia);
    await expect(page.locator('[data-copia-nada]')).toBeVisible();
    await expect(page.locator('[data-copia-aplicar]')).toBeDisabled();
  });

  test('ficheros dañados o de una versión futura: aviso claro y nada cambia', async ({ page }) => {
    await abrir(page, '#/sincronizacion', { 'epa:notas': { 'fig:1': NOTA('fig:1', 'intacta', HOY - 500) } });
    const antes = await page.evaluate(() => localStorage.getItem('epa:notas'));
    await elegirFichero(page, 'cortada.json', JSON.stringify(copiaDe({ notas: {} })).slice(0, 40));
    await expect(page.locator('[data-copia-error]')).toContainText('dañado o incompleto');
    await expect(page.locator('[data-copia-vista]')).toHaveCount(0);
    await elegirFichero(page, 'futura.json', JSON.stringify({ ...copiaDe({}), version: 7, app: '2.0.0' }));
    await expect(page.locator('[data-copia-error]')).toContainText('versión más nueva');
    await elegirFichero(page, 'foto.json', '{"hola": 1}');
    await expect(page.locator('[data-copia-error]')).toContainText('no es una copia');
    // partly damaged: imported without the bad items, which are counted
    await elegirFichero(page, 'medio.json', JSON.stringify(copiaDe({ notas: { 'fig:3': { t: 5, v: NOTA('fig:3', 'buena', 5) }, roto: { t: 'x' }, malo: { t: 4, v: { sin: 1 } } } as unknown as Coleccion })));
    await expect(page.locator('[data-copia-descartados]')).toContainText('2 elementos');
    expect(await page.evaluate(() => localStorage.getItem('epa:notas'))).toBe(antes);
  });

  test('«Unir» deja fuera lo de hace más de 90 días que el dispositivo no conoce, y se puede incluir', async ({ page }) => {
    const podado = HOY - 90 * 864e5;
    await abrir(page, '#/sincronizacion', {
      'epa:sinc-estado': { doc: 'f', dispositivo: 'x', ultima: HOY - 1000, iniciada: HOY - 2000, podado, items: {}, borrados: {} },
    });
    const copia = JSON.stringify(
      copiaDe({ notas: { 'fig:8': { t: podado - 5000, v: NOTA('fig:8', 'muy vieja', podado - 5000) }, 'fig:9': { t: HOY - 1000, v: NOTA('fig:9', 'reciente', HOY - 1000) } } }),
    );
    await elegirFichero(page, 'vieja.json', copia);
    await expect(page.locator('[data-copia-antiguos]')).toHaveAttribute('data-copia-antiguos', '1');
    await expect(page.locator('tr[data-almacen="notas"] [data-nuevos]')).toHaveText('1');
    await page.locator('[data-copia-incluir-antiguos]').check();
    await expect(page.locator('tr[data-almacen="notas"] [data-nuevos]')).toHaveText('2');
    await page.locator('[data-copia-incluir-antiguos]').uncheck();
    await expect(page.locator('tr[data-almacen="notas"] [data-nuevos]')).toHaveText('1');
    await page.locator('[data-copia-aplicar]').click();
    await expect(page.locator('[data-copia-resultado]')).toContainText('Importado: 1 cambio');
    const notas = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:notas') ?? '{}') as Record<string, unknown>);
    expect(Object.keys(notas)).toEqual(['fig:9']);
  });

  test('«Sustituir todo»: pide confirmación, guarda antes una copia automática y deja los datos como en la copia', async ({ page }) => {
    await abrir(page, '#/sincronizacion', { 'epa:notas': { 'fig:1': NOTA('fig:1', 'se borrará', HOY - 500), 'fig:2': NOTA('fig:2', 'cambiará', HOY - 500) } });
    const copia = JSON.stringify(copiaDe({ notas: { 'fig:2': { t: 3, v: NOTA('fig:2', 'la de la copia', 3) } } }));
    await elegirFichero(page, 'restaurar.json', copia);
    await page.locator('[data-copia-modo="sustituir"]').check();
    await expect(page.locator('tr[data-almacen="notas"] [data-borrados]')).toHaveText('1');
    await expect(page.locator('tr[data-almacen="notas"] [data-cambiados]')).toHaveText('1');
    const aplicar = page.locator('[data-copia-aplicar]');
    await expect(aplicar).toBeDisabled();
    await expect(aplicar).toHaveText('Sustituir todo');
    await page.locator('[data-copia-confirmar]').check();
    await aplicar.click();
    await expect(page.locator('[data-copia-resultado]')).toContainText('copia automática');
    const notas = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:notas') ?? '{}') as Record<string, { texto: string }>);
    expect(Object.keys(notas)).toEqual(['fig:2']);
    expect(notas['fig:2']!.texto).toBe('la de la copia');
    // the automatic backup (IndexedDB) can be saved, and holds the data before
    const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-copia-automatica]').click()]);
    const auto = JSON.parse(readFileSync((await d.path())!, 'utf8')) as Copia;
    expect((auto.almacenes.notas!['fig:1'] as { v: { texto: string } }).v.texto).toBe('se borrará');
  });

  test('deshacer «Sustituir todo»: la copia automática importada propone «Sustituir» (con «Unir» no recupera nada) y «Deshacer la sustitución» la recupera tras confirmar', async ({ page }) => {
    await abrir(page, '#/sincronizacion', { 'epa:notas': { 'fig:1': NOTA('fig:1', 'se borrará', HOY - 500), 'fig:2': NOTA('fig:2', 'cambiará', HOY - 500) } });
    const copia = JSON.stringify(copiaDe({ notas: { 'fig:2': { t: 3, v: NOTA('fig:2', 'la de la copia', 3) } } }));
    await elegirFichero(page, 'restaurar.json', copia);
    await page.locator('[data-copia-modo="sustituir"]').check();
    await page.locator('[data-copia-confirmar]').check();
    await page.locator('[data-copia-aplicar]').click();
    await expect(page.locator('[data-copia-resultado]')).toContainText('copia automática');
    // the automatic backup, saved to a file and imported back: «Sustituir» preselected, with the reason
    const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-copia-automatica]').click()]);
    const auto = readFileSync((await d.path())!, 'utf8');
    expect((JSON.parse(auto) as Copia).automatica).toBe(true);
    await elegirFichero(page, d.suggestedFilename(), auto);
    await expect(page.locator('[data-copia-es-automatica]')).toBeVisible();
    await expect(page.locator('[data-copia-modo="sustituir"]')).toBeChecked();
    // («Unir» would bring back nothing: the replacement's versions are newer)
    await page.locator('[data-copia-modo="unir"]').check();
    await expect(page.locator('[data-copia-nada]')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    // «Deshacer la sustitución»: the app's own dialog; «Cancelar» there changes nothing
    await page.locator('[data-copia-deshacer]').click();
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo).toContainText('¿Deshacer la sustitución?');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toHaveCount(0);
    let notas = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:notas') ?? '{}') as Record<string, { texto: string }>);
    expect(Object.keys(notas)).toEqual(['fig:2']);
    await page.locator('[data-copia-deshacer]').click();
    await dialogo.getByRole('button', { name: 'Deshacer la sustitución' }).click();
    await expect(page.locator('[data-copia-resultado]')).toContainText('Importado');
    notas = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:notas') ?? '{}') as Record<string, { texto: string }>);
    expect(Object.keys(notas).sort()).toEqual(['fig:1', 'fig:2']);
    expect(notas['fig:1']!.texto).toBe('se borrará');
    expect(notas['fig:2']!.texto).toBe('cambiará');
  });

  test('«Aa»: exportar desde el panel, e «Importar…» lleva a la tarjeta de la copia', async ({ page }) => {
    await abrir(page, '#/');
    await page.getByRole('button', { name: 'Tema y tamaño de letra' }).click();
    const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-aa-exportar]').click()]);
    expect(d.suggestedFilename()).toMatch(/^electronica-copia-.*\.json$/);
    await expect(page.locator('[data-aa-aviso-copia]')).toContainText('Copia descargada');
    await page.locator('[data-aa-importar]').click();
    await expect(page).toHaveURL(/#\/sincronizacion\/copia$/);
    await expect(page.locator('#t-copia')).toBeFocused();
    await expect(page.locator('#t-copia')).toBeInViewport();
  });
});

test.describe('suma diaria · página de inicio', () => {
  const DIA = '2026-11-04';
  const r = (pasos: number, t: number) => ({ pasos, preguntas: 0, secciones: 0, cumplido: false, t });
  test('el objetivo de hoy suma lo de dos dispositivos (y cuenta como cumplido)', async ({ page }) => {
    await abrir(page, '#/', {
      'epa:progreso-diario': { [`${DIA}@aaaaaaaaaaaa`]: r(2, HOY - 9000), [`${DIA}@bbbbbbbbbbbb`]: r(2, HOY - 8000), [DIA]: { ...r(2, HOY - 8000), cumplido: false } },
    });
    const obj = page.locator('section.objetivo');
    await expect(obj).toHaveAttribute('data-hechos', '4');
    await expect(obj).toHaveClass(/cumplido/);
  });
  // (1.0: 0.12 read such a day lazily and wrote nothing at load; 1.0's schema migration stores it once in «<day>@0» at
  // start-up, the day item untouched — lib/migrar.ts —, and still writes no device id: nothing was counted)
  test('un día guardado por la 0.11 cuenta tal cual (la migración lo guarda una vez en «día@0»)', async ({ page }) => {
    const viejo = JSON.stringify({ [DIA]: { pasos: 2, preguntas: 0, secciones: 0, cumplido: false, t: HOY - 9000 } });
    await abrir(page, '#/', { 'epa:progreso-diario': viejo });
    await expect(page.locator('section.objetivo')).toHaveAttribute('data-hechos', '2');
    await page.waitForTimeout(1500);
    const tras = JSON.parse((await page.evaluate(() => localStorage.getItem('epa:progreso-diario')))!) as Record<string, unknown>;
    expect(tras[DIA]).toEqual(JSON.parse(viejo)[DIA]);
    expect((tras[`${DIA}@0`] as { pasos: number }).pasos).toBe(2);
    expect(await page.evaluate(() => localStorage.getItem('epa:dispositivo-local'))).toBeNull();
  });
});

test.describe('copia de seguridad · móvil, accesibilidad', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  test('360 px: sin desplazamiento horizontal, controles de al menos 44 px y sin fallos de axe (claro, oscuro, sepia)', async ({ page }) => {
    test.setTimeout(180_000);
    const copia = JSON.stringify(copiaDe({ notas: { 'fig:2': { t: 5, v: NOTA('fig:2', 'x', 5) } }, 'progreso-xp': {}, 'editor-circuitos': {} }));
    for (const tema of ['claro', 'oscuro', 'sepia'] as const) {
      await abrir(page, '#/sincronizacion/copia', { 'epa:prefs': { tema, tam: 18 }, 'epa:notas': { 'fig:1': NOTA('fig:1', 'local', HOY - 500) } });
      await elegirFichero(page, 'c.json', copia);
      await page.locator('[data-copia-modo="sustituir"]').check();
      await expect(page.locator('[data-copia-confirmar]')).toBeVisible();
      const ancho = await page.evaluate(() => document.scrollingElement!.scrollWidth);
      expect(ancho, tema).toBeLessThanOrEqual(360);
      const pequenos = await page.locator('[data-copia] button:visible, [data-copia] label.modo, [data-copia] label.casilla').evaluateAll((els) =>
        els.map((e) => e.getBoundingClientRect()).filter((b) => b.height < 44 || b.width < 44).map((b) => `${Math.round(b.width)}×${Math.round(b.height)}`),
      );
      expect(pequenos, tema).toEqual([]);
      await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const r = await axe.run(document.querySelector('[data-copia]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
        return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      });
      expect(v, tema).toEqual([]);
    }
  });
});
