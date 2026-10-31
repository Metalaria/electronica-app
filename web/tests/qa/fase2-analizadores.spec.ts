// Phase 2 · 3 — fuzzing and round trips of the parsers (Node, no browser): the answer checker (lib/magnitudes.ts)
// over every unit the app uses × every SI prefix × decimal comma/point × spacing × µ/u × Ω/ohm, and the round trip
// of every value the app itself prints (calculators' formatter, practice answers); SPICE numbers and the netlist
// parameters of all 313 netlists (read → write → read); every calculator against the book's worked example.
// Findings go to the report like the browser checks.
import { readFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { Registro } from './arnes.ts';
import { comprobar } from '../../src/lib/magnitudes.ts';
import { formatoValor, conPrefijo, leerValor } from '../../src/componentes/calculadoras/unidades.ts';
import { calcular } from '../../src/componentes/calculadoras/motor.ts';
import { numeroSpice, textoSpice, listarParametros, aplicarParametro, leerParametro } from '../../src/simulador/motor/netlist.ts';
import type { Formula } from '../../src/componentes/calculadoras/tipos.ts';
import { leerJson, spice } from './rutas.ts';

const LIBRO = new URL('../../public/libro/', import.meta.url);

/** Units the answer checker is asked about: the self-checked exercises and the practice problems. */
function unidades(): string[] {
  const u = new Set<string>();
  for (const it of Object.values(leerJson<{ items: Record<string, { respuestas?: { unidad: string }[] }> }>('libro/ejercicios.json').items)) for (const r of it.respuestas ?? []) u.add(r.unidad);
  const ind = leerJson<{ partes: string[] }>('libro/practica/indice.json');
  for (const p of ind.partes)
    for (const it of leerJson<{ items: { tipo: string; objetivo: string; formula: Formula }[] }>(`libro/practica/${p}.json`).items)
      if (it.tipo === 'numerico') u.add(it.formula.vars.find((v) => v.id === it.objetivo)?.unidad ?? '');
  return [...u];
}

/** Units of the calculators' fields (their own reader, calculadoras/unidades.ts leerValor). */
function unidadesCalculadoras(): string[] {
  const u = new Set<string>();
  for (const f of leerJson<{ formulas: Formula[] }>('libro/formulas.json').formulas) for (const v of f.vars) u.add(v.unidad);
  return [...u];
}

const PREFIJOS: [string, number][] = [['p', 1e-12], ['n', 1e-9], ['µ', 1e-6], ['u', 1e-6], ['μ', 1e-6], ['m', 1e-3], ['', 1], ['k', 1e3], ['M', 1e6], ['G', 1e9]];

test.describe.configure({ mode: 'parallel' });

test('analizadores: el comprobador de respuestas con todas las unidades, prefijos y formas de escribir', async ({}, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'una vez basta (Node)');
  reg.ruta = 'analizadores:magnitudes';
  let casos = 0;
  const fallos = new Map<string, string[]>();
  const fallo = (clave: string, ej: string) => (fallos.get(clave) ?? fallos.set(clave, []).get(clave)!).push(ej);
  for (const unidad of unidades()) {
    const prefijable = conPrefijo(unidad) && unidad !== '';
    for (const base of [1, 4.7, 22, 330, 0.5]) {
      for (const [p, f] of PREFIJOS) {
        if (p && !prefijable) continue;
        if (!prefijable && p === '' && unidad === '') continue;
        const valor = base * f;
        for (const coma of [',', '.']) {
          for (const esp of [' ', '', ' ', ' ']) {
            const num = String(base).replace('.', coma);
            const u = unidad === 'Ω' ? ['Ω', 'ohm'] : [unidad];
            for (const uu of u) {
              if (uu === 'ohm' && p) continue;
              const texto = `${num}${esp}${p}${uu}`;
              casos++;
              const r = comprobar(texto, { valor, unidad, tol: 0.01, texto: '' });
              if (r.tipo !== 'bien') fallo(`${unidad} · «${p || 'sin prefijo'}» · ${r.tipo}`, texto);
            }
          }
        }
      }
    }
    // the app's own way of printing values, at many magnitudes, read back
    for (let e = -12; e <= 9; e++) {
      for (const m of [1, 2.2, 4.7, 9.99]) {
        const v = m * 10 ** e;
        if (!prefijable && (v < 1e-3 || v > 1e6)) continue;
        for (const cifras of [3, 4]) {
          const texto = formatoValor(v, unidad, cifras, true);
          casos++;
          const r = comprobar(texto, { valor: v, unidad, tol: 0.006, texto: '' });
          if (r.tipo !== 'bien') fallo(`${unidad} · lo que escribe la app · ${r.tipo}`, texto);
        }
      }
    }
  }
  // the calculators' fields: what the calculator prints is read back by its own field reader
  for (const unidad of unidadesCalculadoras())
    for (let e = -12; e <= 9; e++)
      for (const m of [1, 2.2, 4.7, 9.99]) {
        const v = m * 10 ** e;
        if (!conPrefijo(unidad) && (v < 1e-3 || v > 1e6)) continue;
        const texto = formatoValor(v, unidad, 4, true);
        casos++;
        const leido = leerValor(texto, unidad);
        if (!(Math.abs(leido - v) <= Math.abs(v) * 0.006)) fallo(`${unidad} · calculadora: escribir y volver a leer`, `${texto} → ${leido}`);
      }
  for (const [clave, ejemplos] of fallos)
    await reg.anotar({ sev: 'funcional', tipo: 'magnitudes', firma: clave, msg: `El comprobador no acepta ${ejemplos.length} forma(s) válidas, p. ej. «${ejemplos.slice(0, 3).join('», «')}» (${clave}).` });
  reg.cobertura({ 'analizadores: respuestas probadas': casos });
});

test('analizadores: números SPICE y parámetros de las 313 netlists (leer, escribir, leer)', async ({}, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'una vez basta (Node)');
  reg.ruta = 'analizadores:netlist';
  let casos = 0;
  for (let e = -15; e <= 12; e++)
    for (const m of [1, 1.5, 2.2, 4.7, 6.8, 9.999]) {
      const v = m * 10 ** e;
      for (const s of [v, -v]) {
        casos++;
        const t = textoSpice(s);
        const r = numeroSpice(t);
        if (r == null || Math.abs(r - s) > Math.abs(s) * 1e-3) await reg.anotar({ sev: 'funcional', tipo: 'netlist', firma: 'textoSpice/numeroSpice', msg: `${s} se escribe «${t}» y se lee ${r}.` });
      }
    }
  const sp = spice();
  for (const [id, n] of Object.entries(sp.netlists as Record<string, { fichero?: string }>)) {
    const texto = readFileSync(new URL((n as { fichero: string }).fichero, LIBRO), 'utf8');
    const ps = listarParametros(texto);
    for (const p of ps) {
      casos++;
      // the same value written back keeps the value, and the other parameters
      const t1 = aplicarParametro(texto, p.id, p.valor);
      const v1 = leerParametro(t1, p.id);
      const ps1 = listarParametros(t1).map((x) => x.id).join(',');
      if (v1 == null || Math.abs(v1 - p.valor) > Math.abs(p.valor) * 1e-3 || ps1 !== ps.map((x) => x.id).join(','))
        await reg.anotar({ sev: 'funcional', tipo: 'netlist', firma: 'reescribir un parámetro', msg: `${id}: reescribir ${p.id} con su propio valor (${p.texto}) da ${v1} o cambia los parámetros.` });
      // and a different value is read back as written
      const nuevo = p.valor * 2.2;
      const v2 = leerParametro(aplicarParametro(texto, p.id, nuevo), p.id);
      if (v2 == null || Math.abs(v2 - nuevo) > Math.abs(nuevo) * 1e-3)
        await reg.anotar({ sev: 'funcional', tipo: 'netlist', firma: 'cambiar un parámetro', msg: `${id}: ${p.id} = ${nuevo} se lee como ${v2}.` });
    }
  }
  reg.cobertura({ 'analizadores: números y parámetros de netlist probados': casos });
});

test('analizadores: cada calculadora da el ejemplo resuelto del libro', async ({}, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'una vez basta (Node)');
  reg.ruta = 'analizadores:calculadoras';
  let n = 0;
  let bien = 0;
  for (const f of leerJson<{ formulas: (Formula & { ejemplo?: { valores: Record<string, number>; resultado: number; libro?: number; origen?: string } })[] }>('libro/formulas.json').formulas) {
    if (!f.ejemplo) continue;
    n++;
    const r = calcular(f, f.resultado, f.ejemplo.valores);
    const esperado = f.ejemplo.libro ?? f.ejemplo.resultado;
    // the book prints a rounded value: half a unit of its last printed digit (at least 0,5 %)
    const mant = Math.abs(esperado).toExponential(10).split('e');
    const sig = mant[0]!.replace('.', '').replace(/0+$/, '').length;
    const media = Math.max(0.5 * 10 ** (Number(mant[1]) - sig + 1), Math.abs(esperado) * 0.005);
    const okLibro = Number.isFinite(r.valor) && Math.abs(r.valor - esperado) <= media * 1.0001 + 1e-12;
    const okGen = Number.isFinite(r.valor) && Math.abs(r.valor - f.ejemplo.resultado) <= Math.abs(f.ejemplo.resultado) * 1e-6 + 1e-15;
    if (okLibro && okGen) bien++;
    else await reg.anotar({ sev: 'funcional', tipo: 'calculadora-libro', firma: f.id, msg: `${f.id}: con los valores del ejemplo (${f.ejemplo.origen ?? 'libro'}) calcula ${r.valor} y el libro da ${esperado}.` });
    // every other variable solved back from the result gives its input again
    for (const v of f.vars) {
      if (v.id === f.resultado || !(v.id in f.ejemplo.valores)) continue;
      const entorno = { ...f.ejemplo.valores, [f.resultado]: f.ejemplo.resultado };
      delete (entorno as Record<string, number>)[v.id];
      const d = calcular(f, v.id, entorno);
      const quiero = f.ejemplo.valores[v.id]!;
      // several roots: the solver may pick another valid one
      if (Number.isFinite(d.valor) && d.raices <= 1 && !d.error && Math.abs(d.valor - quiero) > Math.abs(quiero) * 1e-3 + 1e-12)
        await reg.anotar({ sev: 'funcional', tipo: 'calculadora-despeje', firma: `${f.id}:${v.id}`, msg: `${f.id}: despejando ${v.id} del resultado del ejemplo sale ${d.valor} y no ${quiero}.` });
    }
  }
  reg.cobertura({ 'analizadores: calculadoras con ejemplo del libro': n, 'analizadores: calculadoras que lo reproducen': bien });
});

test('analizadores: las respuestas de los ejercicios del libro y sus alternativas', async ({}, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'una vez basta (Node)');
  reg.ruta = 'analizadores:ejercicios';
  let n = 0;
  type Resp = { id: string; valor: number; unidad: string; texto: string; tol?: number; tol_abs?: number; alternativas: { valor: number; texto: string; tol?: number }[] };
  const items = leerJson<{ items: Record<string, { respuestas?: Resp[] }> }>('libro/ejercicios.json').items;
  for (const [label, it] of Object.entries(items))
    for (const r of it.respuestas ?? []) {
      const esperado = { valor: r.valor, unidad: r.unidad, tol: r.tol, tol_abs: r.tol_abs, texto: r.texto };
      for (const t of [r.texto, r.texto.replace(',', '.'), formatoValor(r.valor, r.unidad, 4, true)]) {
        n++;
        const v = comprobar(t, esperado as never, r.alternativas as never);
        if (v.tipo !== 'bien') await reg.anotar({ sev: 'funcional', tipo: 'ejercicio-respuesta', firma: `${label}:${r.id}`, msg: `${label} (${r.id}): «${t}» se califica «${v.tipo}».` });
      }
    }
  reg.cobertura({ 'analizadores: respuestas de ejercicios probadas': n });
});

