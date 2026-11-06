// 1.0 «Guía de uso»: the guide kept in step with the app, without a browser (EPA_SIN_SERVIDOR=1 skips the build):
//   - structure: unique ids usable in a route, no empty text, «usted»;
//   - every «Abrir en la aplicación» link is a route the router knows (lib/ruta.svelte.ts) and App.svelte renders, and
//     a sub-route is one the app itself links to;
//   - every «¿Cómo funciona?» link of the app (EnlaceGuia, #/guia/… literals) points to a section and subsection here,
//     and the agreed ones are still there;
//   - every «…» quoted in the guide is in the app's source (a label, a button, a notice), or in the short list of
//     quotes that are examples;
//   - every section of the rail (HERRAMIENTAS) is mentioned in the guide and linked from it;
//   - the filter: accents, prefixes, every subsection found by its own title.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.guia10.config.ts tests/guia10-contenido.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIA, seccionGuia, type SeccionGuia } from '../src/lib/guia/contenido.ts';
import { buscarEnGuia, normalizarGuia, textoApartado } from '../src/lib/guia/buscar.ts';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(web, 'src');
const leer = (p: string) => fs.readFileSync(path.join(src, p), 'utf8');

/** Every .svelte and .ts file of the app, except the guide's own content (so a quote cannot vouch for itself). */
function fuentes(): { fichero: string; texto: string }[] {
  const out: { fichero: string; texto: string }[] = [];
  const recorrer = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (/\.(svelte|ts)$/.test(e.name) && !p.includes(`${path.sep}lib${path.sep}guia${path.sep}`)) out.push({ fichero: path.relative(src, p), texto: fs.readFileSync(p, 'utf8') });
    }
  };
  recorrer(src);
  return out;
}
const FUENTES = fuentes();
const TODO = FUENTES.map((f) => f.texto).join('\n');

/** All the text of a section, titles included. */
function textoSeccion(s: SeccionGuia): string {
  return [s.titulo, s.resumen, ...s.apartados.flatMap((a) => [a.titulo, textoApartado(a)]), ...s.enlaces.map((e) => e.texto)].join('\n');
}
const TEXTO_GUIA = GUIA.map(textoSeccion).join('\n');

/** Quotes of the guide that are examples or names, not labels of the app. */
const NO_ETIQUETAS = new Set<string>([]);

test('estructura: ids de ruta únicos, textos no vacíos', () => {
  const ids = new Set<string>();
  for (const s of GUIA) {
    expect(s.id, s.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(ids.has(s.id), `sección repetida ${s.id}`).toBe(false);
    ids.add(s.id);
    expect(s.titulo.trim().length, s.id).toBeGreaterThan(3);
    expect(s.resumen.trim().length, s.id).toBeGreaterThan(20);
    expect(s.apartados.length, s.id).toBeGreaterThan(0);
    expect(s.enlaces.length, `${s.id}: «Abrir en la aplicación»`).toBeGreaterThan(0);
    const apartados = new Set<string>();
    for (const a of s.apartados) {
      expect(a.id, `${s.id}/${a.id}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(apartados.has(a.id), `apartado repetido ${s.id}/${a.id}`).toBe(false);
      apartados.add(a.id);
      expect(a.bloques.length, `${s.id}/${a.id}`).toBeGreaterThan(0);
      for (const b of a.bloques) {
        const textos = b.t === 'lista' || b.t === 'pasos' ? b.items : b.t === 'teclas' ? b.filas.flat() : [b.texto];
        expect(textos.length, `${s.id}/${a.id}`).toBeGreaterThan(0);
        for (const t of textos) {
          expect(t.trim(), `${s.id}/${a.id}`).not.toBe('');
          // plain text: the view escapes it, so markup would show as is
          expect(t, `${s.id}/${a.id}`).not.toMatch(/<[a-z/][^>]*>|\*\*|`/i);
        }
      }
    }
  }
  // the sections the owner asked for are all there
  for (const id of ['primeros-pasos', 'lecciones-cursos', 'preguntas', 'ejercicios', 'practica', 'teoria-viva', 'simulador', 'repaso', 'docente', 'datos', 'actualizaciones', 'diagnostico', 'teclado', 'problemas']) {
    expect(seccionGuia(id), id).toBeTruthy();
  }
});

test('trato de usted (nada de tuteo)', () => {
  const tuteo = /\b(puedes|tienes|quieres|pulsa|elige|escribe|abre|mira|usa|haz|tu|tus|te|contigo)\b/giu;
  const fallos: string[] = [];
  for (const s of GUIA) {
    for (const linea of textoSeccion(s).split('\n')) {
      // «usa» and similar are also third person («la aplicación usa…»): only flag the imperative at the start of a sentence
      for (const m of linea.matchAll(tuteo)) {
        const antes = linea.slice(0, m.index).trimEnd();
        const inicio = antes === '' || /[.:;!?¿¡(]$/.test(antes);
        if (['tu', 'tus', 'te', 'contigo', 'puedes', 'tienes', 'quieres'].includes(m[0].toLowerCase()) || inicio) fallos.push(`${s.id}: «${m[0]}» en «${linea.slice(0, 80)}»`);
      }
    }
  }
  expect(fallos).toEqual([]);
});

/** The router's first segments and the view each one sets (lib/ruta.svelte.ts, function leer). */
function rutasDelRouter(): Map<string, string> {
  const fuente = leer('lib/ruta.svelte.ts');
  const m = new Map<string, string>();
  for (const x of fuente.matchAll(/a === '([a-z0-9]+)'\)\s*\{[\s\S]*?ruta\.vista = '([a-z0-9]+)'/g)) m.set(x[1]!, x[2]!);
  return m;
}

test('cada enlace de la guía es una ruta que existe', () => {
  const rutas = rutasDelRouter();
  // sanity: the parser sees the router
  for (const r of ['simulador', 'docente', 'sincronizacion', 'diagnostico', 'guia', 'editor', 'protoboard']) expect(rutas.has(r), r).toBe(true);
  const app = leer('App.svelte');
  const fallos: string[] = [];
  for (const s of GUIA) {
    for (const e of s.enlaces) {
      const m = /^#\/(.*)$/.exec(e.ruta);
      if (!m) {
        fallos.push(`${s.id}: «${e.ruta}» no es una ruta de la aplicación`);
        continue;
      }
      const [cabeza = '', ...resto] = m[1]!.split('/');
      if (cabeza === '') {
        if (resto.length) fallos.push(`${s.id}: ${e.ruta}`);
        continue;
      }
      const vista = rutas.get(cabeza);
      if (!vista) {
        fallos.push(`${s.id}: ${e.ruta} (el router no conoce «${cabeza}»)`);
        continue;
      }
      if (!app.includes(`ruta.vista === '${vista}'`)) fallos.push(`${s.id}: ${e.ruta} (App.svelte no dibuja la vista «${vista}»)`);
      // a sub-route must be one the app itself links to (or the router documents), so it cannot be invented here
      if (resto.length && !TODO.includes(e.ruta)) fallos.push(`${s.id}: ${e.ruta} (ninguna parte de la aplicación enlaza esa subruta)`);
    }
  }
  expect(fallos).toEqual([]);
});

test('cada «¿Cómo funciona?» de la aplicación lleva a un apartado que existe', () => {
  const vistos: string[] = [];
  const fallos: string[] = [];
  const comprobar = (fichero: string, sec: string, apt: string | undefined) => {
    const s = seccionGuia(sec);
    const clave = apt ? `${sec}/${apt}` : sec;
    vistos.push(clave);
    if (!s) fallos.push(`${fichero}: no hay sección «${sec}»`);
    else if (apt && !s.apartados.some((a) => a.id === apt)) fallos.push(`${fichero}: la sección «${sec}» no tiene el apartado «${apt}»`);
  };
  for (const f of FUENTES) {
    for (const m of f.texto.matchAll(/<EnlaceGuia\s+seccion="([^"]+)"(?:\s+apartado="([^"]+)")?/g)) comprobar(f.fichero, m[1]!, m[2]);
    for (const m of f.texto.matchAll(/#\/guia\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/g)) comprobar(f.fichero, m[1]!, m[2]);
    // a dynamic seccion={…} would escape this test
    expect(f.texto, f.fichero).not.toMatch(/<EnlaceGuia\s+seccion=\{/);
  }
  expect(fallos).toEqual([]);
  // the agreed handful: synchronisation, teacher mode, «Encuentre la avería», the spaced review, and the diagnostic
  for (const k of ['datos/sincronizacion', 'docente', 'practica/averia', 'repaso/repaso-espaciado', 'diagnostico']) expect(vistos, k).toContain(k);
  // «a handful at most»: no more than these few places
  const lugares = FUENTES.filter((f) => /<EnlaceGuia\b/.test(f.texto)).map((f) => f.fichero);
  expect(lugares.length, lugares.join(', ')).toBeLessThanOrEqual(6);
});

test('cada «…» citado en la guía está en la aplicación', () => {
  const fallos: string[] = [];
  for (const s of GUIA) {
    for (const m of textoSeccion(s).matchAll(/«([^«»]+)»/g)) {
      const cita = m[1]!;
      if (NO_ETIQUETAS.has(cita)) continue;
      if (!TODO.includes(cita)) fallos.push(`${s.id}: «${cita}»`);
    }
  }
  expect(fallos).toEqual([]);
});

test('cada sección del carril está en la guía y enlazada desde ella', () => {
  const nav = leer('lib/navegacion.svelte.ts');
  const entradas = [...nav.matchAll(/\{ id: '([a-z0-9]+)', ruta: (null|'[^']*'), icono: '[^']+', etiqueta: '([^']+)'/g)].map((m) => ({ id: m[1]!, ruta: m[2] === 'null' ? null : m[2]!.slice(1, -1), etiqueta: m[3]! }));
  expect(entradas.length).toBeGreaterThan(15);
  expect(entradas.map((e) => e.id)).toContain('guia');
  const texto = normalizarGuia(TEXTO_GUIA);
  const enlaces = new Set(GUIA.flatMap((s) => s.enlaces.map((e) => e.ruta)));
  const fallos: string[] = [];
  for (const e of entradas) {
    if (e.id === 'guia') continue;
    if (!texto.includes(normalizarGuia(e.etiqueta))) fallos.push(`«${e.etiqueta}» no se nombra en la guía`);
    if (e.ruta && !enlaces.has(e.ruta)) fallos.push(`${e.ruta} («${e.etiqueta}») no está en ningún «Abrir en la aplicación»`);
  }
  expect(fallos).toEqual([]);
});

test('el filtro: sin tildes, por el comienzo de las palabras y cada apartado por su título', () => {
  expect(buscarEnGuia('')).toEqual([]);
  expect(buscarEnGuia('   ')).toEqual([]);
  expect(buscarEnGuia('zzqxw')).toEqual([]);
  const conTilde = buscarEnGuia('avería').map((r) => `${r.seccion.id}/${r.apartado.id}`);
  expect(conTilde.length).toBeGreaterThan(0);
  expect(buscarEnGuia('AVERIA').map((r) => `${r.seccion.id}/${r.apartado.id}`)).toEqual(conTilde);
  expect(conTilde[0]).toBe('practica/averia');
  // a prefix
  expect(buscarEnGuia('sincro').map((r) => r.seccion.id)).toContain('datos');
  // every word must be there
  const token = buscarEnGuia('token caducado').map((r) => `${r.seccion.id}/${r.apartado.id}`);
  expect(token).toContain('datos/sincronizacion');
  for (const r of buscarEnGuia('token caducado')) expect(normalizarGuia(`${r.seccion.titulo} ${(r.seccion.claves ?? []).join(' ')} ${r.seccion.resumen} ${r.apartado.titulo} ${textoApartado(r.apartado)}`)).toMatch(/caducad/);
  // the keywords: words the text does not use
  expect(buscarEnGuia('backup').map((r) => r.seccion.id)).toContain('datos');
  // each subsection is found by its own title, among the first three
  for (const s of GUIA) {
    for (const a of s.apartados) {
      const r = buscarEnGuia(a.titulo).slice(0, 3).map((x) => `${x.seccion.id}/${x.apartado.id}`);
      expect(r, a.titulo).toContain(`${s.id}/${a.id}`);
    }
  }
  // the snippet is plain text taken from the subsection
  const [primero] = buscarEnGuia('polímetro');
  expect(primero).toBeTruthy();
  expect(normalizarGuia(primero!.fragmento.replace(/^… | …$/g, ''))).toContain('polimetro');
});
