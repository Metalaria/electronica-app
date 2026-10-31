// Phase 2 · 8 (UI string quality): every user-facing string of the app's source (Svelte markup text, the
// attributes people read — aria-label, title, placeholder, alt — and string literals of the scripts that read as
// Spanish prose), checked for spelling (nspell with the Spanish dictionary of dictionary-es, both dev
// dependencies; the book's own vocabulary counts as known words), the «usted» register (no «tú» forms), English
// leftovers, and names written in more than one way («KiCad»/«Kicad», «FM7303»/«FM-7303», a missing accent).
// Node only (the parsers of Svelte and TypeScript); seconds.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from '@playwright/test';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import nspell from 'nspell';
import dictionary from 'dictionary-es';
import { Registro } from './arnes.ts';
import { leerJson } from './rutas.ts';

const SRC = new URL('../../src/', import.meta.url);

/** Areas owned by other agents in 0.11: reported for them, not fixed here. */
const AJENAS = [/^lib\/aprendizaje\//, /^componentes\/(cursos|progreso|protoboard)\//];

function ficheros(dir = SRC, base = ''): string[] {
  const r: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = new URL(f, dir);
    if (statSync(p).isDirectory()) {
      if (f !== 'muestra' && f !== 'node_modules') r.push(...ficheros(new URL(`${f}/`, dir), `${base}${f}/`));
    } else if (/\.(svelte|ts)$/.test(f) && !/\.(d|test|spec)\.ts$/.test(f)) r.push(`${base}${f}`);
  }
  return r;
}

/** Object keys whose strings are identifiers, search keywords, paths or styles. */
const CLAVES_CODIGO = new Set(['id', 'tipo', 'clase', 'claves', 'enc', 'modo', 'forma', 'rol', 'prefijo', 'icono', 'color', 'variante', 'ruta', 'href', 'clave', 'fichero', 'svg', 'src', 'datos', 'campo', 'k', 'key', 'cls', 'class', 'estilo', 'ancla', 'hash', 'vista', 'grupoId', 'familia', 'modelo', 'sim', 'unidad', 'simbolo', 'red', 'pin', 'patas', 'url']);

const ATRIBUTOS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'aria-description', 'aria-roledescription', 'label']);

/** Looks like words for people (not an identifier, a selector, CSS or a path). */
function esProsa(s: string): boolean {
  const t = s.trim();
  if (t.length < 3 || !/\p{L}{2}/u.test(t)) return false;
  // markup built in scripts (SVG, HTML snippets)
  if (/<\/?[a-z][\w-]*[\s>]/i.test(t)) return false;
  if (/[{};=<>]|=>|\b(px|rem|em|vh|vw)\b|^[#./]|^--|^\w+:\/\/|^[\w-]+(\.[\w-]+)+$|^[a-z]+([A-Z][a-z]+)+$|^[\w-]+$/.test(t) && !/\s/.test(t)) return false;
  if (/^(rgba?|hsla?|var|calc|color-mix|translate|rotate|scale|url)\(/.test(t)) return false;
  // a sentence or a label: spaces between words, or accented Spanish
  return /\p{L}+\s+\p{L}+/u.test(t) || /[áéíóúñü¿¡«»]/i.test(t);
}

interface Cadena {
  texto: string;
  fichero: string;
}

function cadenasDe(fichero: string): Cadena[] {
  const src = readFileSync(new URL(fichero, SRC), 'utf8');
  const res: Cadena[] = [];
  const poner = (t: string | undefined | null) => {
    if (t && esProsa(t)) res.push({ texto: t.replace(/\s+/g, ' ').trim(), fichero });
  };
  const deTs = (codigo: string) => {
    const sf = ts.createSourceFile('x.ts', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    /** A string the program uses as a key, a name or a pattern, not to show. */
    const esCodigo = (n: ts.Node): boolean => {
      const p = n.parent;
      if (ts.isPropertyAssignment(p) && p.initializer === n && CLAVES_CODIGO.has(p.name.getText(sf).replace(/['"]/g, ''))) return true;
      if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return true;
      if (ts.isCaseClause(p) || ts.isElementAccessExpression(p) || ts.isLiteralTypeNode(p)) return true;
      if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && /^(has|get|set|delete|includes|startsWith|endsWith|test|split|replace|replaceAll|indexOf|add|remove|toggle|contains|setAttribute|getAttribute|closest|matches|emit|on|off|send|postMessage|cargar|leer|fetch)$/.test(p.expression.name.text)) return true;
      return false;
    };
    const ir = (n: ts.Node) => {
      // module names, and the arguments of console and DOM queries, are not for people
      if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
      if (ts.isCallExpression(n)) {
        const f = n.expression.getText(sf);
        if (/^console\.|querySelector|matchMedia|getElementById|addEventListener|setProperty|getPropertyValue|new RegExp|RegExp/.test(f)) return;
      }
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !esCodigo(n)) poner(n.text);
      else if (ts.isTemplateExpression(n)) poner([n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' … '));
      n.forEachChild(ir);
    };
    ir(sf);
  };
  if (fichero.endsWith('.ts')) {
    deTs(src);
    return res;
  }
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(src, { modern: true });
  } catch {
    return res;
  }
  for (const s of [ast.instance, ast.module]) if (s) deTs(src.slice((s.content as unknown as { start: number }).start, (s.content as unknown as { end: number }).end));
  const ir = (n: unknown, enAtributo = false): void => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach((x) => ir(x, enAtributo));
    const o = n as Record<string, unknown>;
    if (o['type'] === 'Text' && !enAtributo) poner(o['data'] as string);
    if (o['type'] === 'Attribute') {
      const v = o['value'];
      if (ATRIBUTOS.has(o['name'] as string) && Array.isArray(v)) poner(v.map((x: { type: string; data?: string }) => (x.type === 'Text' ? x.data : ' … ')).join(''));
      // expressions inside attributes can still hold UI text ({cond ? 'Abrir' : 'Cerrar'}), but not class lists
      if (o['name'] === 'class' || o['name'] === 'style') return;
      if (Array.isArray(v)) {
        for (const x of v) if ((x as { type: string }).type !== 'Text') ir(x, false);
      } else if (v && typeof v === 'object') ir(v, false);
      return;
    }
    if (o['type'] === 'Literal' && typeof o['value'] === 'string') poner(o['value'] as string);
    if (o['type'] === 'TemplateLiteral') poner((o['quasis'] as { value: { cooked: string } }[]).map((q) => q.value.cooked).join(' … '));
    if (o['type'] === 'StyleSheet' || o['type'] === 'Style') return;
    for (const [k, v] of Object.entries(o)) if (k !== 'parent' && k !== 'metadata' && v && typeof v === 'object') ir(v, enAtributo);
  };
  ir(ast.fragment);
  return res;
}

/** Words of the book: they are spelled as the author wants (technical terms, names, units). */
function vocabularioDelLibro(): Set<string> {
  const s = new Set<string>();
  const docs = leerJson<{ titulo: string; texto: string }[]>('libro/busqueda.json');
  for (const d of docs) for (const w of `${d.titulo} ${d.texto}`.toLowerCase().match(/\p{L}+/gu) ?? []) s.add(w);
  return s;
}

// «tú» forms: the unambiguous ones (2nd person verbs, «tu», «ti»), and imperatives that tell the reader what to do
// («Toca una pieza», «arrastra para mover»); a 3rd person «la CPU lee…» is not one.
const TUTEO = /(?<!\p{L})(puedes|tienes|quieres|necesitas|sabes|estás|eres|has (?:hecho|visto|terminado|acertado|completado|fallado|contestado|respondido|elegido)|tú|tu|tus|ti|contigo|tuyo|tuya|tuyos|tuyas|te (?:queda|quedan|toca|falta|faltan|ayuda|lleva|recomiendo|recomendamos|proponemos|…))(?!\p{L})|(?:^|[.:;!?¿¡(«—–-]\s*)(toca|pulsa|arrastra|elige|escribe|mira|prueba|abre|usa|añade|quita|selecciona|comprueba|recuerda|intenta|aprende|empieza|descubre|lee|guarda|borra|suelta|conecta|haz|pon|ve a|vuelve a|cambia|sigue|repasa|practica|piensa|fíjate|imagina|calcula|anota|apunta|sube|baja|gira|mueve)(?!\p{L})|(?<!\p{L})(toca|pulsa|arrastra|desliza|elige|mueve|gira) (?:para|aquí|sobre|el|la|los|las|un|una)(?!\p{L})/iu;
const INGLES = /(?<!\p{L})(the|and|with|from|loading|failed|fetch|click|button|settings|cancel|delete|please|cannot|could|not found|unknown|invalid|warning|select|choose|show|hide|retry|help|about|undefined|null|true|false|NaN)(?!\p{L})/u;

/** Chips described in the third person («la CPU lee…», «SAVE: guarda la pantalla»): not the reader being addressed. */
const DESCRIPCIONES = /^componentes\/(consolas\/(arquitectura|fotograma)\/|instrumentos\/banco\/Aparatos)/;

/**
 * Words the dictionary lacks that are right: technical terms, names and sources, and «usted» imperatives with
 * pronouns (the dictionary has no enclitic forms). Anything else unknown is reported.
 */
const PALABRAS = new Set(
  `abs access account add ammeters android anomie api appendwrite attribute autoincremento autorregeneraciones autorregeneración binary borna bottom boy cartridge chipset
  ciérrelo cjo cntl colors commands comprimirlo contents copetti coprocesadores corríjalo create ctl defínalo desadaptada desexcitación deslizador deslizadores developer
  development dis docs documentation dumet dyke déc edlc elíjalo empty endc epa esc exp export fall femtofaradios ferroeléctrico filetype fix font format freq fujitsu
  function game gear gekkio generate genesis genvdp ghp github gminsteps gobernarla graetz homografía idss imm inf inn inom inp interrupts intro json klu layer list
  manténgalo mappers maps mayús meet memmap metalizaciones method mod modes mpíxel msinger multiplexadas móntelo name nametable nametables narrow neogeodev nmos null
  opamp opengbc options orientarle overview owner paginador paginadores palettes parallel param params parseval pentóxido permissions phase phi pinout plutiedev pmos
  polilíneas polyfuse posrenderizado ppp promediable péguelo quítela quítelo raster recablearlo registers regs reintentará relay renderbuffer rendering renderizado
  repositories repository resolvedor resource resuélvalo retrazado right rise roboto roff savecurrents sch schematics schoopage scroll segoe serializa serializada
  serializador settings shader singer slots small sna snc sony spdt speaker sprite spst sqrt srcsteps stepping strobe strobes sup super superfamicom svg tanh tdr
  termorretráctil tests thevenin thick thr three tile tilemap tilemaps tiles timestep timing titanato token tokens trafo transfers tref txt unset vblank vdb vmax vmín
  write xtal pwl pruébelo sepárelos gírelos córtelos actívelas arrástrelas arrástrela`.split(/\s+/),
);

test('textos de la interfaz: ortografía, «usted», inglés y nombres', async ({}, info) => {
  const reg = new Registro(info);
  test.skip(reg.perfil.id !== 'tableta', 'una vez');
  test.setTimeout(10 * 60_000);
  const spell = nspell(dictionary as unknown as { aff: Uint8Array; dic: Uint8Array });
  const libro = vocabularioDelLibro();
  const todas = ficheros().flatMap(cadenasDe);
  const ajena = (f: string) => AJENAS.some((r) => r.test(f));
  const desconocidas = new Map<string, Set<string>>();
  const variantes = new Map<string, Map<string, Set<string>>>();
  for (const c of todas) {
    const zona = ajena(c.fichero) ? ' (área de otro agente)' : '';
    reg.ruta = c.fichero;
    // register and English: whole strings
    const tu = DESCRIPCIONES.test(c.fichero) ? null : c.texto.match(TUTEO);
    if (tu) await reg.anotar({ sev: 'texto', tipo: 'tuteo', firma: `«${tu[0].toLowerCase()}» en ${c.fichero}`, msg: `«${c.texto.slice(0, 140)}» usa «${tu[0]}» (la aplicación trata de usted)${zona}.` });
    const en = c.texto.match(INGLES);
    if (en && !/^[\w.-]+$/.test(c.texto)) await reg.anotar({ sev: 'texto', tipo: 'ingles', firma: `«${en[0]}» en ${c.fichero}`, msg: `«${c.texto.slice(0, 140)}» lleva «${en[0]}» en inglés${zona}.` });
    for (const w of c.texto.match(/[\p{L}][\p{L}\p{N}-]*[\p{L}\p{N}]|\p{L}/gu) ?? []) {
      // names: the same word with other capitals or hyphens («KiCad»/«Kicad», «FM7303»/«FM-7303»); a sentence's
      // capital and words in capitals (labels of a panel) are not other spellings
      const clave = w.replace(/-/g, '').toLowerCase();
      if (clave.length >= 4 && !(w.length > 1 && w === w.toUpperCase())) {
        const forma = w[0]!.toLowerCase() + w.slice(1);
        const m = variantes.get(clave) ?? variantes.set(clave, new Map()).get(clave)!;
        (m.get(forma) ?? m.set(forma, new Set()).get(forma)!).add(c.fichero);
      }
      // spelling: plain lower-case words (acronyms, CamelCase names and words with digits are names)
      if (w.length < 3 || /[\d²³₀-₉]/.test(w) || /\p{Lu}/u.test(w.slice(1)) || w.includes('-')) continue;
      const l = w.toLowerCase();
      if (libro.has(l) || PALABRAS.has(l) || spell.correct(w) || spell.correct(l)) continue;
      (desconocidas.get(l) ?? desconocidas.set(l, new Set()).get(l)!).add(c.fichero);
    }
  }
  for (const [w, fs] of desconocidas) {
    const lista = [...fs];
    reg.ruta = lista[0]!;
    const sug = spell.suggest(w).slice(0, 3);
    await reg.anotar({ sev: 'texto', tipo: 'ortografia', firma: w, msg: `«${w}» no está en el diccionario ni en el libro${sug.length ? ` (¿${sug.join(', ')}?)` : ''} — en ${lista.slice(0, 3).join(', ')}${lista.length > 3 ? ` y ${lista.length - 3} más` : ''}${lista.every(ajena) ? ' (área de otro agente)' : ''}.` });
  }
  for (const [clave, m] of variantes) {
    if (m.size < 2) continue;
    const formas = [...m.keys()];
    reg.ruta = [...m.values()][0]![Symbol.iterator]().next().value!;
    await reg.anotar({ sev: 'texto', tipo: 'nombre-inconsistente', firma: clave, msg: `Se escribe de ${m.size} maneras: ${formas.map((f) => `«${f}» (${[...m.get(f)!].slice(0, 2).join(', ')})`).join(', ')}.` });
  }
  reg.cobertura({ 'textos: cadenas de la interfaz revisadas': todas.length, 'textos: ficheros fuente': new Set(todas.map((c) => c.fichero)).size });
});
