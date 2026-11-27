// 2.2 Part B: the texts of the tour and the tutorials (lib/recorridos-pasos.ts) against the app's source. Every «…» in
// a step, an offer or a «done» line is something the app shows (a label, a button, a screen's word), so it must be in
// the source outside that file; the step counts are the mock-up's (ListaTutoriales); every lit element is named by a
// data attribute that some component writes; the texts say «usted», never «tú».
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const PASOS = readFileSync(join(RAIZ, 'lib', 'recorridos-pasos.ts'), 'utf8');

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? ficheros(f) : /\.(svelte|ts)$/.test(n) ? [f] : [];
  });
}
const FUENTE = ficheros(RAIZ)
  .filter((f) => !f.endsWith('recorridos-pasos.ts'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

/** The string literals of the texts the reader sees (titulo, texto, logrado, the offer's fields). */
const TEXTOS = [...PASOS.matchAll(/\b(titulo|texto|logrado|antetitulo|empezar|nombre): '((?:[^'\\]|\\.)*)'/g)].map((m) => m[2]!);

test('cada «…» de los pasos es algo que la aplicación muestra', () => {
  expect(TEXTOS.length).toBeGreaterThan(80);
  const faltan: string[] = [];
  for (const t of TEXTOS)
    for (const m of t.matchAll(/«([^»]+)»/g)) {
      const q = m[1]!;
      // the quoted label, as text of the source (a string, a template, a tag's text)
      if (!FUENTE.includes(q)) faltan.push(q);
    }
  expect(faltan).toEqual([]);
});

test('los pasos de cada recorrido son los de la maqueta (6, 5, 6, 5, 4, 6, 5, 4)', () => {
  const bloques = PASOS.split(/\nconst [A-Z_]+: Recorrido = \{/).slice(1);
  const ids = bloques.map((b) => /id: '([a-z-]+)'/.exec(b)![1]);
  const pasos = bloques.map((b) => (b.slice(b.indexOf('pasos: [')).match(/\n {6}titulo: /g) ?? []).length);
  expect(Object.fromEntries(ids.map((id, i) => [id, pasos[i]]))).toEqual({
    app: 6,
    brymen: 5,
    'fnirsi-osc': 6,
    'fnirsi-mult': 5,
    banco: 4,
    protoboard: 6,
    simulador: 5,
    consolas: 4,
  });
});

test('cada elemento iluminado tiene su atributo en algún componente', () => {
  const sels = [...PASOS.matchAll(/objetivo: '([^']+)'/g)].flatMap((m) => [...m[1]!.matchAll(/\[(data-[a-z0-9-]+)(?:="([^"]+)")?\]/g)]);
  expect(sels.length).toBeGreaterThan(30);
  const faltan = sels.filter(([, attr, val]) => {
    if (!val) return !FUENTE.includes(attr!);
    // a literal value, or a template that builds it (data-recorrido={`fnirsi-${b.id}`})
    if (FUENTE.includes(`${attr}="${val}"`)) return false;
    const pre = val.split('-')[0]!;
    if (FUENTE.includes(`${attr}={\`${pre}-\${`)) return false;
    // an attribute written from an id (data-grupo={g.id}, the groups of lib/navegacion.svelte.ts)
    return !(FUENTE.includes(`${attr}={`) && FUENTE.includes(`id: '${val}'`));
  });
  expect(faltan.map((m) => m[0])).toEqual([]);
});

test('de usted: ninguna forma de tú en los textos', () => {
  // (forms that only «tú» has: «toca», «pulsa» or «elige» are also the third person and the impersonal «se»)
  const tu = /\b(tú|tu|tus|puedes|quieres|tienes|haz|pon|pulse[s]|toques|elijas)\b/i;
  expect(TEXTOS.filter((t) => tu.test(t))).toEqual([]);
});
