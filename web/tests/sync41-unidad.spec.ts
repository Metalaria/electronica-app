// 1.2 «sync41»: the app as a mirror of book 4.1, in Node (no browser, no server):
//   - the ids of 4.1 (lib/esquemas.ts renombrar41, contenido/ids41.py) against the book's own Informes/ids_4.1.json;
//   - the migration of a profile with the shape 1.1 stores (tests/fixtures/perfil-11-capitulos-nuevos.json): every
//     old id of the two chapters new in 4.0 renamed, each renamed id present in the content generated from 4.1,
//     the reader's own texts untouched, the originals backed up, idempotent; the synchronisation file of format 2;
//   - the printed numbering of web/public/libro/refs.json against the book's figuras/numeros.json (0 differences);
//   - every QR code the book prints (epa://leccion/<parte>/<sección>) opens a section of the app, and those of 4.0 too.
// The book checks are skipped when its sources are not on this machine (EPA_FUENTES, contenido/fuentes.py).
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.sync41.config.ts
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { ESQUEMAS, FORMATO_DATOS, MIGRACIONES, migrarColecciones, renombrar41, renombrarIds41 } from '../src/lib/esquemas';
import { migrarAlmacen, RANURA_MIGRACION } from '../src/lib/migrar';
import { rutaDeEnlace } from '../src/lib/enlaces';
import { CURSOS, verificarCursos } from '../src/lib/aprendizaje/cursos';
import type { Almacen } from '../src/lib/almacen';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(WEB, '..');
const LIBRO = path.join(WEB, 'public', 'libro');
const FUENTES = process.env.EPA_FUENTES ?? '/home/claude/libro-integra/Fuentes';
const HAY_LIBRO = existsSync(path.join(FUENTES, 'libro'));
const J = <T = any>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T; // eslint-disable-line @typescript-eslint/no-explicit-any
const FIX = J(path.join(WEB, 'tests', 'fixtures', 'perfil-11-capitulos-nuevos.json'));
const VIEJO = /new-(automatas|maquinas)/;

function memoria(inicial: Record<string, unknown>): Almacen & { datos: Map<string, string> } {
  const datos = new Map(Object.entries(inicial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    tipo: 'memoria',
    datos,
    async leer<T>(k: string) {
      const v = datos.get(k);
      return v === undefined ? undefined : (JSON.parse(v) as T);
    },
    async escribir(k: string, v: unknown) {
      datos.set(k, JSON.stringify(v));
    },
  };
}

test.describe('ids de la 4.1', () => {
  test('renombrar41 da exactamente la correspondencia del libro (Informes/ids_4.1.json)', () => {
    const ruta = path.join(FUENTES, '..', 'Informes', 'ids_4.1.json');
    test.skip(!existsSync(ruta), 'sin las fuentes del libro');
    const ids = J(ruta);
    for (const [viejo, nuevo] of Object.entries(ids.partes as Record<string, string>)) expect(renombrar41(viejo)).toBe(nuevo);
    // object labels (the chapter's own label is `cap-55`: the label rule of bookmarks, checked below)
    for (const [viejo, nuevo] of Object.entries(ids.etiquetas as Record<string, string>))
      if (!/^cap-new-/.test(viejo)) expect(renombrar41(viejo), viejo).toBe(nuevo);
    for (const [viejo, nuevo] of Object.entries(ids.autoevaluacion as Record<string, string>)) expect(renombrar41(viejo)).toBe(nuevo);
    for (const [viejo, nuevo] of Object.entries(ids.lecciones as Record<string, string>)) expect(renombrar41(viejo)).toBe(nuevo);
    // composite ids of the app and what must not change
    expect(renombrar41('cap-new-automatas-pred-sec-new-automatas.3')).toBe('cap55-pred-sec-55.3');
    expect(renombrar41('l:cap-new-maquinas/sec-new-maquinas.8')).toBe('l:cap56/sec-56.8');
    expect(renombrar41('pq:cap-new-maquinas-4')).toBe('pq:cap56-04');
    for (const igual of ['sec-new-24-trifasica', 'fig-new-0-modos', 'cap33-18', 'sec-33.13', 'xcap-new-automatas']) expect(renombrar41(igual)).toBe(igual);
  });

  test('contenido/ids41.py y lib/esquemas.ts renombran igual cada id que publicó la 1.1', () => {
    const todos = Object.values(FIX.ids11 as Record<string, string[]>).flat();
    const extra = todos.flatMap((i) => [`pr:${i}`, `l:cap-new-automatas/${i}`, `cap-new-maquinas/${i}`]);
    const lista = [...todos, ...extra];
    const py = execFileSync('python3', ['-c', 'import sys,json; sys.path.insert(0, "contenido"); import ids41; print(json.dumps([ids41.renombrar(s) for s in json.load(sys.stdin)]))'], { cwd: APP, input: JSON.stringify(lista) }).toString();
    expect(JSON.parse(py)).toEqual(lista.map(renombrar41));
  });
});

test.describe('migración de un perfil de la 1.1', () => {
  test('cada clave pasa a los ids de la 4.1, los textos del lector no cambian, con copia previa e idempotente', async () => {
    const perfil = FIX.perfil as Record<string, unknown>;
    const a = memoria(perfil);
    const r = await migrarAlmacen(a);
    expect(r.fallidas).toEqual([]);
    expect(r.migradas.sort()).toEqual(Object.keys(perfil).filter((k) => VIEJO.test(JSON.stringify(perfil[k]))).sort());
    const valor = (k: string) => JSON.parse(a.datos.get(k)!) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const k of Object.keys(perfil)) {
      const v = valor(k);
      if (k === 'notas') {
        // the reader's note keeps its text as written; its key, label and part move
        expect(v['sec-56.3'].texto).toBe((perfil.notas as Record<string, { texto: string }>)['sec-new-maquinas.3']!.texto);
        expect(v['sec-56.3']).toMatchObject({ parte: 'cap56', label: 'sec-56.3', num: '34.3' });
        continue;
      }
      expect(JSON.stringify(v), k).not.toMatch(VIEJO);
    }
    // the chapter's own label where a label is stored
    expect(valor('marcadores')['cap-56']).toMatchObject({ parte: 'cap56', label: 'cap-56', num: '34' });
    expect(valor('marcadores')['sec-55.4']).toMatchObject({ parte: 'cap55', label: 'sec-55.4' });
    expect(valor('marcadores')['sec-1.4']).toEqual((perfil.marcadores as Record<string, unknown>)['sec-1.4']);
    expect(valor('posiciones')).toMatchObject({ cap55: { sec: 'sec-55.2' }, cap56: { sec: 'cap-56' }, cap01: { sec: 'sec-1.2' } });
    // a pending change mark follows its item; the hash it was made for is dropped (its value changed with the ids)
    expect(valor('sinc-marcas')).toEqual({ cambios: { leidas: { cap55: 1_760_000_000_005 }, notas: { 'sec-56.3': 1_760_000_000_005 } }, borrados: {}, huellas: { leidas: { cap01: 'def' } } });
    // the originals, once
    const copia = a.datos.get(RANURA_MIGRACION) ?? [...a.datos.entries()].find(([k]) => k.includes('migracion'))?.[1];
    expect(copia, 'copia previa').toBeTruthy();
    expect(JSON.stringify(JSON.parse(JSON.parse(copia!).texto ?? copia!))).toContain('cap-new-automatas');
    // idempotent: a second start changes nothing
    const antes = new Map(a.datos);
    expect((await migrarAlmacen(a)).migradas).toEqual([]);
    for (const k of Object.keys(perfil)) expect(a.datos.get(k)).toBe(antes.get(k));
  });

  test('cada id renombrado existe en el contenido generado desde la 4.1', () => {
    const ids = FIX.ids11 as Record<string, string[]>;
    const indice = J(path.join(LIBRO, 'indice.json'));
    const refs = J(path.join(LIBRO, 'refs.json'));
    const practica = new Set(['cap55', 'cap56'].flatMap((p) => J(path.join(LIBRO, 'practica', `${p}.json`)).items.map((x: { id: string }) => x.id)));
    const repaso = new Set(['cap55', 'cap56'].flatMap((p) => J(path.join(LIBRO, 'repaso', `${p}.json`)).preguntas.map((x: { id: string }) => x.id)));
    const ejercicios = J(path.join(LIBRO, 'ejercicios.json')).items;
    const spice = J(path.join(LIBRO, 'spice.json')).netlists;
    const falta: string[] = [];
    for (const i of ids.practica!) if (!practica.has(renombrar41(i))) falta.push(`práctica ${i}`);
    for (const i of ids.repaso!) if (!repaso.has(renombrar41(i))) falta.push(`repaso ${i}`);
    for (const i of ids.ejercicios!) if (!ejercicios[renombrar41(i)]) falta.push(`ejercicio ${i}`);
    for (const i of ids.spice!) if (!spice[renombrar41(i)]) falta.push(`netlist ${i}`);
    for (const i of ids.etiquetas!) if (!refs[i === 'cap-new-automatas' ? 'cap-55' : i === 'cap-new-maquinas' ? 'cap-56' : renombrar41(i)]) falta.push(`etiqueta ${i}`);
    for (const i of ids.secciones!) {
      const p = renombrar41(i.includes('automatas') ? 'cap-new-automatas' : 'cap-new-maquinas');
      if (!indice.partes[p]?.secciones.some((s: { label: string }) => s.label === renombrar41(i))) falta.push(`sección ${i}`);
    }
    expect(falta).toEqual([]);
    expect(JSON.stringify(indice)).not.toMatch(VIEJO);
  });

  test('el fichero de sincronización de formato 2: sus almacenes con los ids nuevos, también las lápidas', () => {
    expect(FORMATO_DATOS).toBe(3);
    for (const m of MIGRACIONES) expect((ESQUEMAS[m.clave] ?? m.de + 1) > m.de, m.clave).toBe(true);
    const almacenes = {
      leidas: { 'cap-new-automatas': { t: 5, v: { 'sec-new-automatas.1': 5 } }, cap01: { t: 3, v: { 'sec-1.1': 3 } } },
      marcadores: { 'cap-new-maquinas': { t: 7, x: 1 }, 'sec-new-automatas.2': { t: 8, v: { parte: 'cap-new-automatas', label: 'sec-new-automatas.2', num: '31.2', titulo: 't', t: 8 } } },
      'progreso-logros': { 'capitulo:cap-new-automatas': { t: 9, v: 9 } },
      'cursos-superadas': { 'cap-new-maquinas/sec-new-maquinas.1': { t: 4, v: 4 } },
    };
    const { almacenes: r, fallidas } = migrarColecciones(almacenes, 2);
    expect(fallidas).toEqual([]);
    expect(r.leidas).toEqual({ cap55: { t: 5, v: { 'sec-55.1': 5 } }, cap01: almacenes.leidas.cap01 });
    expect(r.marcadores).toEqual({ 'cap-56': { t: 7, x: 1 }, 'sec-55.2': { t: 8, v: { parte: 'cap55', label: 'sec-55.2', num: '31.2', titulo: 't', t: 8 } } });
    expect(r['progreso-logros']).toEqual({ 'capitulo:cap55': { t: 9, v: 9 } });
    expect(r['cursos-superadas']).toEqual({ 'cap56/sec-56.1': { t: 4, v: 4 } });
    // a file already in format 3 is not touched
    expect(migrarColecciones(almacenes, 3).almacenes).toEqual(almacenes);
    // an old and a new id of one item: the newer stays, whatever the order
    expect(renombrarIds41({ 'cap55/x': { t: 5, v: 1 }, 'cap-new-automatas/x': { t: 9, v: 2 } })).toEqual({ 'cap55/x': { t: 9, v: 2 } });
    expect(renombrarIds41({ 'cap-new-automatas/x': { t: 3, v: 2 }, 'cap55/x': { t: 5, v: 1 } })).toEqual({ 'cap55/x': { t: 5, v: 1 } });
  });
});

test.describe('el libro 4.1 en la aplicación', () => {
  test('numeración: cada etiqueta de refs.json con el número impreso de figuras/numeros.json (0 diferencias)', () => {
    const ruta = path.join(FUENTES, 'figuras', 'numeros.json');
    test.skip(!existsSync(ruta), 'sin las fuentes del libro');
    const nums = J<Record<string, string>>(ruta);
    const refs = J<Record<string, { num: string }>>(path.join(LIBRO, 'refs.json'));
    const distintos = Object.entries(nums).filter(([k, n]) => refs[k]?.num !== n).map(([k, n]) => `${k}: libro ${n}, app ${refs[k]?.num}`);
    expect(distintos).toEqual([]);
    // and nothing numbered in the app that the book does not number (subsections and a few generated labels apart)
    const solo = Object.keys(refs).filter((k) => !(k in nums) && !/^(subsec|tab|ap)-/.test(k) && !/^sec-\w+\.\d+\.\d+$/.test(k));
    expect(solo).toEqual([]);
    expect(Object.keys(nums).length).toBeGreaterThan(2700);
  });

  test('cada código QR del libro abre una sección de la aplicación; los de la 4.0 también', () => {
    test.skip(!HAY_LIBRO, 'sin las fuentes del libro');
    const indice = J(path.join(LIBRO, 'indice.json'));
    const nums = J<Record<string, string>>(path.join(FUENTES, 'figuras', 'numeros.json'));
    const enlaces: string[] = [];
    // (the targets the book prints: herramientas/construir.py write_qr, one per «== … <sec-…>» of every chapter and appendix)
    for (const f of readdirSync(path.join(FUENTES, 'libro')).filter((f) => /^(cap|ap)\w+\.typ$/.test(f)).sort())
      for (const l of readFileSync(path.join(FUENTES, 'libro', f), 'utf8').split('\n')) {
        const m = /^== .*<(sec-[\w.-]+)>\s*$/.exec(l);
        if (m && m[1]! in nums) enlaces.push(`epa://leccion/${f.slice(0, -4)}/${m[1]}`);
      }
    expect(enlaces.length).toBeGreaterThan(790);
    const rotos = enlaces.filter((e) => {
      const [, parte, label] = /^epa:\/\/leccion\/([^/]+)\/(.+)$/.exec(e)!;
      return rutaDeEnlace(e, indice) !== `#/leccion/${parte}/${label}` || !indice.partes[parte!]?.secciones.some((s: { label: string }) => s.label === label);
    });
    expect(rotos).toEqual([]);
    // QR codes printed with the provisional ids of 4.0
    expect(rutaDeEnlace('epa://leccion/cap-new-automatas/sec-new-automatas.3', indice)).toBe('#/leccion/cap55/sec-55.3');
    expect(rutaDeEnlace('EPA://LECCION/CAP-NEW-MAQUINAS/SEC-NEW-MAQUINAS.1', indice)).toBe('#/leccion/cap56/sec-56.1');
    expect(rutaDeEnlace('epa://leccion/apk/sec-k.2', indice)).toBe('#/leccion/apK/sec-K.2');
    // which of them already have a hand-made lesson (the others open the classic one until the course phases)
    const hechas = new Set(Object.keys(J(path.join(LIBRO, 'lecciones11', 'indice.json')).lecciones ?? {}));
    console.log(`QR: ${enlaces.length} enlaces, ${enlaces.filter((e) => hechas.has(e.slice('epa://leccion/'.length))).length} con lección hecha a mano`);
  });

  test('cursos: cap55, cap56 y cap57 en su curso, apK y el ensamblador en «Digital y programable»', () => {
    const indice = J(path.join(LIBRO, 'indice.json'));
    const v = verificarCursos(indice);
    expect(v.sinCurso).toEqual([]);
    expect(v.inexistentes).toEqual([]);
    const digital = CURSOS.find((c) => c.id === 'digital')!;
    expect(digital.partes).toEqual(['cap09', 'cap29', 'cap55', 'cap34', 'cap37', 'cap38', 'cap44', 'apK']);
    expect(indice.partes.cap38.secciones.some((s: { label: string; num: string }) => s.label === 'sec-new-38-ensamblador' && s.num === '39.16')).toBe(true);
    expect(CURSOS.find((c) => c.id === 'potencia')!.partes).toEqual(['cap10', 'cap33', 'cap56', 'cap39', 'cap50']);
    expect(CURSOS.find((c) => c.id === 'proyectos')!.partes).toEqual(['cap16', 'cap48', 'cap49', 'cap50', 'cap51', 'cap52', 'cap57', 'cap54']);
  });
});
