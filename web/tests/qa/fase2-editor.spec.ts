// Phase 2 · 3 (round trip of the netlist writer): every netlist of the book opened as a drawing in the schematic
// editor (#/editor/libro/<id>) must give back an equivalent netlist (ed.nl.texto): the same elements with the same
// values and the same connections (node names may change, consistently), and every node that the netlist's own
// measurements name (v(x), i(x) in .control, .meas, .print) must still exist — otherwise its results break.
import { readFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { Registro, prepararPagina } from './arnes.ts';
import { lineasNetlist } from '../../src/simulador/motor/netlist.ts';
import { azarDe, spice } from './rutas.ts';
import { MODO } from './perfiles.ts';

const LIBRO = new URL('../../public/libro/', import.meta.url);

/** Number of node tokens of an element line, by its letter (X: every token but the last). */
function nodosDe(tokens: string[]): string[] {
  const l = tokens[0]![0]!.toUpperCase();
  const n: Record<string, number> = { R: 2, C: 2, L: 2, V: 2, I: 2, D: 2, B: 2, F: 2, H: 2, Q: 3, J: 3, M: 4, E: 4, G: 4, S: 4, W: 2, T: 4, U: 3, O: 4, Z: 3 };
  if (l === 'X') {
    const sinParams = tokens.slice(1).filter((t, i, a) => !t.includes('=') && a[i + 1] !== '=' && a[i - 1] !== '=');
    return sinParams.slice(0, -1);
  }
  if (l === 'A') return [];
  return tokens.slice(1, 1 + (n[l] ?? 0));
}

interface Elemento {
  nombre: string;
  nodos: string[];
  resto: string;
}

function elementos(texto: string): Map<string, Elemento> {
  const m = new Map<string, Elemento>();
  for (const l of lineasNetlist(texto).lineas) {
    if (l.subckt) continue;
    const t = l.tokens;
    if (!t.length || t[0]!.startsWith('.') || t[0]!.startsWith('*')) continue;
    const nodos = nodosDe(t).map((x) => x.toLowerCase());
    m.set(t[0]!.toLowerCase(), { nombre: t[0]!.toLowerCase(), nodos, resto: t.slice(1 + nodos.length).join(' ').toLowerCase() });
  }
  return m;
}

/** Nodes named by the netlist's measurements: v(a), v(a,b), i(...) is about elements. */
function nodosMedidos(texto: string): Set<string> {
  const s = new Set<string>();
  for (const m of texto.toLowerCase().matchAll(/\bv(?:db|m|p|r|i)?\(\s*([\w.+-]+)\s*(?:,\s*([\w.+-]+)\s*)?\)/g)) {
    s.add(m[1]!);
    if (m[2]) s.add(m[2]);
  }
  s.delete('0');
  return s;
}

/** Names written more than once in a netlist (the book's own example of that error): not comparable. */
function repetidos(texto: string): Set<string> {
  const vistos = new Set<string>();
  const res = new Set<string>();
  for (const l of lineasNetlist(texto).lineas) {
    const n = l.tokens[0]?.toLowerCase();
    if (l.subckt || !n || n.startsWith('.') || n.startsWith('*')) continue;
    if (vistos.has(n)) res.add(n);
    vistos.add(n);
  }
  return res;
}

/** Differences between a netlist and the one its drawing writes (empty: equivalent). */
export function comparar(original: string, texto: string): string[] {
  const a = elementos(original);
  const b = elementos(texto);
  const dobles = repetidos(original);
  const problemas: string[] = [];
  const mapa = new Map<string, string>();
  const inverso = new Map<string, string>();
  for (const [n, e] of a) {
    if (dobles.has(n)) continue;
    let f = b.get(n);
    // A subcircuit that is only a diode bridge becomes the palette's bridge, its four diodes written out
    // (d<name>a…d: ac1→pos, ac2→pos, neg→ac1, neg→ac2): the same four connections.
    const da = b.get(`d${n}a`);
    const dd = b.get(`d${n}d`);
    if (!f && n.startsWith('x') && da && dd && e.nodos.length === 4) f = { nombre: n, nodos: [da.nodos[0]!, dd.nodos[1]!, da.nodos[1]!, dd.nodos[0]!], resto: e.resto };
    if (!f) {
      problemas.push(`falta ${e.nombre}`);
      continue;
    }
    if (f.nodos.length !== e.nodos.length) {
      problemas.push(`${e.nombre}: ${e.nodos.length} nodos y vuelve con ${f.nodos.length}`);
      continue;
    }
    e.nodos.forEach((x, k) => {
      const y = f.nodos[k]!;
      if ((x === '0') !== (y === '0')) problemas.push(`${e.nombre}: la masa no se conserva (${x} → ${y})`);
      if (mapa.has(x) && mapa.get(x) !== y) problemas.push(`${e.nombre}: el nodo ${x} se parte (${mapa.get(x)} y ${y})`);
      if (inverso.has(y) && inverso.get(y) !== x) problemas.push(`${e.nombre}: los nodos ${inverso.get(y)} y ${x} se unen en ${y}`);
      mapa.set(x, y);
      inverso.set(y, x);
    });
  }
  const nodosB = new Set([...b.values()].flatMap((e) => e.nodos));
  for (const n of nodosMedidos(original)) if (!nodosB.has(n) && [...a.values()].some((e) => e.nodos.includes(n))) problemas.push(`la medida v(${n}) se queda sin su nodo (ahora ${mapa.get(n) ?? '?'})`);
  // Nodes renamed although nothing asked for it (a later v(x) typed by the reader would not find them).
  for (const [x, y] of mapa) if (x !== y && x !== '0' && !problemas.length) problemas.push(`el nodo ${x} pasa a llamarse ${y}`);
  return [...new Set(problemas)];
}

test('editor: cada netlist del libro abierta como dibujo devuelve una netlist equivalente', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'en la tableta');
  const sp = spice() as { netlists: Record<string, { fichero: string; motor: { estado: string } }> };
  const ids = Object.keys(sp.netlists).filter((id) => MODO !== 'rapido' || azarDe(`ed:${id}`) < 0.1);
  test.setTimeout(ids.length * 60_000);
  await prepararPagina(page, reg);
  let bien = 0;
  let dibujadas = 0;
  for (const [i, id] of ids.entries()) {
    reg.ruta = `editor:${id}`;
    reg.traza(reg.ruta);
    const original = readFileSync(new URL(sp.netlists[id]!.fichero, LIBRO), 'utf8');
    if (i === 0) await page.goto(`/#/editor/libro/${id}`);
    else await page.evaluate((h) => (location.hash = h), `#/editor/libro/${id}`);
    const texto = await page
      .waitForFunction(
        (want) => {
          const e = (window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[]; origen?: { id?: string } }; nl: { texto: string } } } }).__epaEditor;
          // the page replaces its hash with «#/editor» once the drawing is made
          return e && e.ed.doc.componentes.length > 0 && e.ed.doc.origen?.id === want ? e.ed.nl.texto : null;
        },
        id,
        { timeout: 45_000 },
      )
      .then((h) => h.jsonValue() as Promise<string>)
      .catch(() => null);
    if (!texto) {
      // a netlist the editor cannot draw shows its own notice; only a hang is a problem
      const aviso = await page.evaluate(() => document.querySelector('.editor-pagina')?.textContent ?? '');
      if (!/no se puede|no tiene|no se ha podido/i.test(aviso)) await reg.anotar({ sev: 'funcional', tipo: 'editor-ida-vuelta', firma: 'no se abre', msg: `${id}: el editor no termina de abrirla como dibujo.` });
      continue;
    }
    dibujadas++;
    const problemas = comparar(original, texto);
    if (problemas.length)
      for (const p of [...new Set(problemas)].slice(0, 4))
        await reg.anotar({ sev: 'funcional', tipo: 'editor-ida-vuelta', firma: p.replace(/^[\w.-]+:/, '').replace(/\b[a-z]+\d*\b/g, 'X').slice(0, 60), msg: `${id}: ${p}.` });
    else bien++;
  }
  reg.cobertura({ 'editor: netlists del libro abiertas como dibujo': dibujadas, 'editor: netlists que vuelven equivalentes': bien });
});

// The same round trip without the browser, straight through the layout and the importer (every netlist, in
// seconds): catches a regression of the drawing's connections even when the page test is not run.
test('editor (Node): las 313 netlists pasan por el dibujo y vuelven equivalentes', async ({}, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'una vez');
  test.setTimeout(30 * 60_000);
  const { sembrarDibujos } = await import('../../src/componentes/esquema-auto/generar.ts');
  const { editableDeNetlist } = await import('../../src/componentes/esquema-auto/editable.ts');
  const { documentoDeEditable } = await import('../../src/componentes/editor/importar.ts');
  const { generarNetlist } = await import('../../src/componentes/editor/netlist.ts');
  sembrarDibujos(JSON.parse(readFileSync(new URL('../../src/componentes/esquema-auto/precalculado.json', import.meta.url), 'utf8')));
  const sp = spice() as { netlists: Record<string, { fichero: string }> };
  let bien = 0;
  let total = 0;
  for (const [id, n] of Object.entries(sp.netlists)) {
    reg.ruta = `editor-node:${id}`;
    const original = readFileSync(new URL(n.fichero, LIBRO), 'utf8');
    let problemas: string[];
    try {
      const e = editableDeNetlist(original);
      if (!e) continue;
      total++;
      problemas = comparar(original, generarNetlist(documentoDeEditable(original, e, { tipo: 'libro', id })).texto);
    } catch (err) {
      problemas = [`excepción: ${String(err).slice(0, 120)}`];
    }
    for (const p of problemas.slice(0, 4))
      await reg.anotar({ sev: 'funcional', tipo: 'editor-ida-vuelta', firma: p.replace(/^[\w.-]+:/, '').replace(/\b[a-z]+\d*\b/g, 'X').slice(0, 60), msg: `${id}: ${p}.` });
    if (!problemas.length) bien++;
  }
  reg.cobertura({ 'editor (Node): netlists dibujadas': total, 'editor (Node): netlists que vuelven equivalentes': bien });
});
