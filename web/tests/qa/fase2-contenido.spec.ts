// Phase 2 · 6 (content integrity): every cross-reference of the book (a.ref in parts, glossary, exercises,
// practice and review cards) names an entry of refs.json whose part holds that anchor; every internal link
// («#/…») goes to something that exists; every asset named by the content's JSON is on disk; the numbering of
// sections, figures and tables runs without gaps or repeats; and the search (the app's own dialog) finds every
// glossary term and every section by its title.
//   Node checks: seconds. The search sweep: one query per term and section in the tablet (QA_MODO=rapido samples).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from '@playwright/test';
import { Registro, esperarCalma, prepararPagina } from './arnes.ts';
import { MODO } from './perfiles.ts';
import { azarDe, indice, leerJson, spice } from './rutas.ts';

const LIBRO = new URL('../../public/libro/', import.meta.url);

/** Every JSON file of the content, with its path relative to public/libro/. */
function ficherosJson(dir = LIBRO, base = ''): string[] {
  const r: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = new URL(f, dir);
    if (statSync(p).isDirectory()) r.push(...ficherosJson(new URL(`${f}/`, dir), `${base}${f}/`));
    else if (f.endsWith('.json')) r.push(`${base}${f}`);
  }
  return r;
}

/** Every string inside a JSON value, with the key it is under. */
function cadenas(v: unknown, f: (s: string, clave: string) => void, clave = ''): void {
  if (typeof v === 'string') f(v, clave);
  else if (Array.isArray(v)) for (const x of v) cadenas(x, f, clave);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) cadenas(x, f, k);
}

/** Every anchor a part's page renders: block labels and ids, at any depth. */
function anclasDe(parte: string): Set<string> {
  const s = new Set<string>();
  const json = JSON.parse(readFileSync(new URL(`partes/${parte}.json`, LIBRO), 'utf8')) as unknown;
  const ir = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(ir);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      for (const k of ['label', 'id', 'ancla']) if (typeof o[k] === 'string') s.add(o[k] as string);
      if (Array.isArray(o['labels'])) for (const l of o['labels'] as unknown[]) if (typeof l === 'string') s.add(l);
      Object.values(o).forEach(ir);
    }
  };
  ir(json);
  // ids written inside HTML fragments
  cadenas(json, (t) => {
    for (const m of t.matchAll(/\sid="([^"]+)"/g)) s.add(m[1]!);
  });
  return s;
}

test('contenido: referencias, enlaces, recursos y numeración', async ({}, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'una vez');
  test.setTimeout(10 * 60_000);
  const refs = leerJson<Record<string, { parte: string; tipo: string; num: string; label?: string }>>('libro/refs.json');
  const ind = indice();
  const partes = new Set(Object.keys(ind.partes));
  const anclas = new Map<string, Set<string>>();
  const anclasDeParte = (p: string) => anclas.get(p) ?? anclas.set(p, anclasDe(p)).get(p)!;
  const glosario = new Set(leerJson<{ id: string }[]>('libro/glosario.json').map((e) => e.id));
  const sp = spice();
  const malas = new Map<string, string[]>();
  const apuntar = (tipo: string, donde: string, que: string) => (malas.get(`${tipo}|${que}`) ?? malas.set(`${tipo}|${que}`, []).get(`${tipo}|${que}`)!).push(donde);
  let nRefs = 0;
  let nEnlaces = 0;
  let nRecursos = 0;

  // 1. refs.json itself: each entry's part exists and renders an anchor for it
  for (const [k, r] of Object.entries(refs)) {
    if (!partes.has(r.parte)) {
      apuntar('ref-sin-parte', 'refs.json', `${k} → ${r.parte}`);
      continue;
    }
    if (r.tipo === 'cap' || r.tipo === 'ap') continue;
    const a = anclasDeParte(r.parte);
    // as candidatosDeRef (lib/datos.ts): the key, its label, «tipo-num» and the keys of the same entry (aliases)
    const alias = Object.entries(refs).filter(([, v]) => v.parte === r.parte && v.tipo === r.tipo && v.num === r.num).map(([x]) => x);
    if (![k, r.label, `${r.tipo}-${r.num}`, ...alias].some((x) => x && a.has(x))) apuntar('ref-sin-ancla', `refs.json`, `${k} (${r.parte})`);
  }

  // 2. every JSON of the content: data-ref keys, internal links, asset paths
  for (const f of ficherosJson()) {
    if (f === 'refs.json' || f.startsWith('spice/')) continue;
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(new URL(f, LIBRO), 'utf8'));
    } catch (e) {
      apuntar('json-roto', f, String(e).slice(0, 80));
      continue;
    }
    cadenas(json, (t, clave) => {
      for (const m of t.matchAll(/data-ref="([^"]+)"/g)) {
        nRefs++;
        if (!refs[m[1]!]) apuntar('ref-desconocida', f, m[1]!);
      }
      for (const m of t.matchAll(/href="#\/([^"]*)"/g)) {
        nEnlaces++;
        const [a, ...resto] = decodeURIComponent(m[1]!).split('/');
        const b = resto.join('/');
        const ok =
          (partes.has(a!) && (!b || refs[b] != null || anclasDeParte(a!).has(b))) ||
          (a === 'glosario' && (!b || glosario.has(b))) ||
          (a === 'simulador' && (!b || b === 'nuevo' || sp.netlists[b] != null)) ||
          ['calculadoras', 'instrumentos', 'consolas', 'proyectos', 'fm7303', 'animaciones', 'conceptos', 'modelos3d', 'ejercicios', 'repaso', 'editor', 'protoboard', 'leccion', 'cursos'].includes(a!);
        if (!ok) apuntar('enlace-roto', f, `#/${m[1]}`);
      }
      // asset paths: fields that hold one, and src="…" inside HTML
      const rutas: string[] = [];
      if (['svg', 'src', 'datos', 'imagen', 'img', 'fichero', 'foto', 'miniatura'].includes(clave) && /^[\w./-]+\.(svg|png|jpe?g|webp|json|cir|txt|glb|gltf)$/i.test(t)) rutas.push(t);
      for (const m of t.matchAll(/\ssrc="(?!data:|https?:)([^"]+)"/g)) rutas.push(m[1]!);
      for (const r of rutas) {
        nRecursos++;
        const limpia = r.replace(/^\.?\//, '');
        const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/') + 1) : '';
        if (!existsSync(new URL(limpia, LIBRO)) && !existsSync(new URL(dir + limpia, LIBRO)) && !existsSync(new URL(`../${limpia}`, LIBRO))) apuntar('recurso-ausente', f, limpia);
      }
    });
  }

  // 3. netlists: every file exists, every reference of a netlist to the book resolves
  for (const [id, n] of Object.entries(sp.netlists as Record<string, { fichero?: string; refs: string[]; parte: string }>)) {
    if (n.fichero && !existsSync(new URL(n.fichero, LIBRO))) apuntar('recurso-ausente', 'spice.json', n.fichero);
    for (const r of n.refs) if (!refs[r]) apuntar('ref-desconocida', `spice.json (${id})`, r);
  }

  // 4. numbering: sections, figures and tables of each chapter in order, without repeats or gaps
  const numeracion = (lista: string[], que: string, parte: string) => {
    const vistos = new Set<string>();
    let previo: number[] | null = null;
    for (const n of lista) {
      if (vistos.has(n)) apuntar('numeracion', parte, `${que} ${n} repetida`);
      vistos.add(n);
      const v = n.split('.').map((x) => (/^\d+$/.test(x) ? Number(x) : NaN));
      if (v.some(Number.isNaN)) continue;
      if (previo && v.length === previo.length && v.slice(0, -1).join('.') === previo.slice(0, -1).join('.') && v[v.length - 1] !== previo[previo.length - 1]! + 1)
        apuntar('numeracion', parte, `${que}: de ${previo.join('.')} a ${n}`);
      previo = v;
    }
  };
  for (const p of partes) {
    const json = JSON.parse(readFileSync(new URL(`partes/${p}.json`, LIBRO), 'utf8')) as unknown;
    const por: Record<string, string[]> = { sección: [], figura: [], tabla: [] };
    const ir = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(ir);
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const num = typeof o['num'] === 'string' ? (o['num'] as string) : null;
        if (num && o['t'] === 'h2') por['sección']!.push(num);
        if (num && o['t'] === 'figura') por['figura']!.push(num);
        if (num && o['t'] === 'tabla') por['tabla']!.push(num);
        Object.values(o).forEach(ir);
      }
    };
    ir((json as { bloques: unknown }).bloques);
    for (const [que, l] of Object.entries(por)) numeracion(l, que, p);
  }

  for (const [k, donde] of malas) {
    const [tipo, que] = k.split('|') as [string, string];
    reg.ruta = donde[0]!;
    await reg.anotar({ sev: tipo === 'numeracion' ? 'texto' : 'funcional', tipo: `contenido-${tipo}`, firma: `${tipo}: ${que.replace(/[\d.]+/g, '#').slice(0, 60)}`, msg: `${que} — en ${[...new Set(donde)].slice(0, 4).join(', ')}${donde.length > 4 ? ` y ${donde.length - 4} sitios más` : ''}.` });
  }
  reg.cobertura({ 'contenido: referencias comprobadas': nRefs + Object.keys(refs).length, 'contenido: enlaces internos comprobados': nEnlaces, 'contenido: recursos comprobados': nRecursos, 'contenido: partes numeradas revisadas': partes.size });
});

// ------------------------------------------------------------------ search
interface Doc {
  id: string;
  parte: string;
  titulo: string;
}

test('búsqueda: encuentra cada término del glosario y cada sección por su título', async ({ page }, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'en la tableta');
  const docs = leerJson<Doc[]>('libro/busqueda.json').filter((d) => /^(glos|sec)-/.test(d.id) && d.titulo.trim() && (MODO !== 'rapido' || azarDe(`b:${d.id}`) < 0.05));
  test.setTimeout(docs.length * 3000 + 120_000);
  await prepararPagina(page, reg);
  await page.goto('/#/');
  await esperarCalma(page, 20_000);
  await page.keyboard.press('Control+k');
  const caja = page.getByRole('dialog', { name: 'Buscar en el libro' }).locator('input');
  await caja.waitFor({ timeout: 15_000 });
  let encontrados = 0;
  /** The words searched for a doc (what a reader types). */
  const consulta = (d: Doc) => (d.id.startsWith('sec-') ? d.titulo.replace(/^\S+\s+/, '') : d.titulo).replace(/\s+/g, ' ').trim();
  const clave = (q: string) => q.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  // a title many sections share («Problemas de Diseño»): ten results cannot hold them all
  const veces = new Map<string, number>();
  for (const d of docs) veces.set(clave(consulta(d)), (veces.get(clave(consulta(d))) ?? 0) + 1);
  for (const d of docs) {
    // the section's title without its number («5.3 Diodos» → «Diodos»): a reader types the words (a glossary term
    // keeps its first word: «CIC (filtro)» is not «(filtro)»)
    const q = consulta(d);
    reg.ruta = `buscar:${d.id}`;
    await caja.fill(q);
    // the dialog searches 90 ms after the last key: wait for its list to settle on this query
    let hrefs: string[] = [];
    let previo = '';
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(100);
      hrefs = await page.evaluate(() => [...document.querySelectorAll('#resultados a')].slice(0, 10).map((a) => decodeURIComponent(a.getAttribute('href') ?? '')));
      const ahora = hrefs.join('|');
      if (i >= 2 && ahora === previo && (hrefs.length || (await page.locator('.nada').isVisible().catch(() => false)))) break;
      previo = ahora;
    }
    const esperado = d.parte === 'glosario' ? `#/glosario/${d.id}` : `#/${d.parte}/${d.id}`;
    if (hrefs.includes(esperado)) encontrados++;
    else
      await reg.anotar({
        sev: 'funcional',
        tipo: 'busqueda',
        firma: (veces.get(clave(q)) ?? 0) > 10 ? 'título que comparten más de diez secciones' : d.id.startsWith('glos') ? 'término del glosario no encontrado' : 'sección no encontrada por su título',
        msg: `Buscar «${q}» no da ${d.id} entre los 10 primeros resultados (${hrefs.length ? `el primero es ${hrefs[0]}` : 'sin resultados'}).`,
      });
  }
  reg.cobertura({ 'búsqueda: títulos buscados': docs.length, 'búsqueda: encontrados entre los 10 primeros': encontrados });
});
