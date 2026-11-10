// 1.1 lessons: from an author's source (contenido/lecciones11/<parte>/<label>.yaml, already parsed) to the data the
// app loads (tipos.ts Leccion11), checking it on the way. Pure (no file system, no DOM): web/scripts/lecciones11.mjs
// does the reading and writing (and the ngspice cross-check of the circuits that this module prepares), and the unit
// tests call it directly. Generation fails on any error; warnings are printed.
//
// What is checked (contenido/lecciones11/GUIA.md «Lo que comprueba el generador»):
//   - shape: known card types, unique ids, the summary last, the parts each card type needs;
//   - text: at most 40 words per card (title + text + note), 20 per option, 40 per explanation or hint;
//   - every option has its explanation, exactly one is right;
//   - every value, calculation, control, reading, condition, hint and placeholder refers to the model;
//   - numbers: every number written in a card is in the book blocks the lesson cites, or is what the model gives
//     (a `comprobar` of that card, a value the card fixes); every `comprobar` holds;
//   - the book: each cited block exists, is in the section (or is named «parte#n»), and contains its quoted words;
//   - challenges: reachable with the controls, not solved at the start, a hint for every failing position;
//     estimates: target inside the slider, not right at the start.

import { analizar, variablesDe, CONSTANTES } from '../../componentes/calculadoras/expresion';
import { aSerie } from '../../componentes/calculadoras/eseries';
import { analizarTexto, contarPalabras, numerosDe, numerosDeTexto, textoPlano, valoresDeTexto } from './texto';
import { barajarFijo, compilarModelo, enRango, objetivoEstimar, posicionMasCercana, posicionesEstimar, puntuarEstimacion, type Valores } from './modelo';
import { esquemaDe, nombresEsquemas } from './esquemas/registro';
import type { DefinicionEsquema } from './esquemas/tipos';
import { comprobacionesCircuito, type ComprobacionSpice } from './spice';
import type {
  Asa, Barra, CalculoModelo, CitaLibro, Color, Condicion, Curva, Ecuacion, Emparejar, Estimar, Grafica, Idea, Leccion11, Lectura, Mando,
  Marca, Modelo, Opcion, Ordenar, Pista, Rango, Tarjeta, Texto, TipoTarjeta, ValorModelo, Widget, WidgetCircuito, WidgetGrafica,
} from './tipos';

export type { ComprobacionSpice } from './spice';

export const MAX_PALABRAS_TARJETA = 40;
export const MAX_PALABRAS_OPCION = 20;
export const MAX_PALABRAS_EXPLICACION = 40;
export const MAX_PALABRAS_ROTULO = 14;
/** Positions a challenge's search may visit (product of its controls' positions). */
export const MAX_COMBINACIONES = 250_000;

export const TIPOS: readonly TipoTarjeta[] = ['explorar', 'predecir', 'pregunta', 'formula', 'reto', 'sorpresa', 'porque', 'resumen'];
export const FASE: Record<TipoTarjeta, string> = {
  explorar: 'Explorar',
  predecir: 'Predecir',
  pregunta: 'Pregunta',
  formula: 'La regla',
  reto: 'Reto',
  sorpresa: 'Sorpresa',
  porque: 'Por qué',
  resumen: 'Resumen',
};
const COLORES: readonly string[] = ['azul', 'naranja', 'verde'];

/** What the generator needs from the book (web/public/libro/partes/*.json). */
export interface ContextoLibro {
  bloques(parte: string): unknown[] | null;
}

export interface ResultadoGeneracion {
  leccion: Leccion11 | null;
  errores: string[];
  avisos: string[];
  spice: ComprobacionSpice[];
}

// ------------------------------------------------------------------ the book's text

/** «<b>4,00 V</b>» → «4,00 V»; inline maths keeps its alternative text. */
export function planoHtml(h: string): string {
  return h
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g, ' $1 ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const NO_TEXTO = new Set(['t', 'svg', 'src', 'label', 'datos', 'tipo', 'tipo_figura', 'align', 'num', 'svg_vista', 'credito', 'w', 'h', 'ancho', 'cols', 'cabecera', 'ordenada']);

/** All the text of a book block (paragraphs, list items, table cells, boxes, derivations, exercises and solutions). */
export function textoDeBloque(b: unknown): string {
  const out: string[] = [];
  const andar = (x: unknown, clave = ''): void => {
    if (typeof x === 'string') {
      if (!NO_TEXTO.has(clave)) out.push(planoHtml(x));
    } else if (Array.isArray(x)) for (const y of x) andar(y, clave);
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (!NO_TEXTO.has(k)) andar(v, k);
  };
  andar(b);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

const normal = (s: string) => s.replace(/[\s   ]+/g, ' ').trim();

// ------------------------------------------------------------------ helpers

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const ID = /^[A-Za-z][A-Za-z0-9_]*$/;

/** E12/E24 values between min and max (as teoria10.mjs: the app's own aSerie, so the values are the app's). */
export function valoresSerie(min: number, max: number, serie: 'E12' | 'E24'): number[] {
  const out = new Set<number>();
  const d0 = Math.floor(Math.log10(min)) - 1;
  const d1 = Math.ceil(Math.log10(max)) + 1;
  for (let d = d0; d <= d1; d++)
    for (let k = 0; k < 96; k++) {
      const v = aSerie(10 ** (d + k / 96), serie);
      if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) out.add(v);
    }
  return [...out].sort((a, b) => a - b);
}

/** Linear positions min, min + paso … max. */
export function valoresLineales(min: number, max: number, paso: number): number[] {
  const n = Math.round((max - min) / paso);
  const out: number[] = [];
  for (let k = 0; k <= n; k++) out.push(Number((min + k * paso).toPrecision(12)));
  return out;
}

/** Can a written number («3,33» with 2 decimals) be this value, in the unit or with an SI prefix? */
export function coincide(n: { v: number; decimales: number }, valor: number): boolean {
  for (let k = -5; k <= 5; k++) {
    const x = valor * 10 ** (3 * k);
    const media = 0.5 * 10 ** -n.decimales;
    if (Math.abs(Math.abs(n.v) - Math.abs(x)) <= media * (1 + 1e-9) + 1e-12 * Math.abs(x)) return true;
  }
  return false;
}

// ------------------------------------------------------------------ the generator

export function generarLeccion(fuente: unknown, libro: ContextoLibro, origen = 'lección'): ResultadoGeneracion {
  const errores: string[] = [];
  const avisos: string[] = [];
  const spice: ComprobacionSpice[] = [];
  /** What each circuit widget's readings are (widget.mide), for its ngspice check. */
  const medidas = new Map<Widget, Record<string, string>>();
  const err = (donde: string, m: string) => errores.push(`${origen}: ${donde}: ${m}`);
  const aviso = (donde: string, m: string) => avisos.push(`${origen}: ${donde}: ${m}`);
  const fallo = (): ResultadoGeneracion => ({ leccion: null, errores, avisos, spice });

  if (!esObjeto(fuente)) {
    err('fichero', 'no es un objeto');
    return fallo();
  }
  const conocidas = new Set(['leccion', 'titulo', 'libro', 'modelo', 'tarjetas']);
  for (const k of Object.keys(fuente)) if (!conocidas.has(k)) err('fichero', `clave desconocida «${k}»`);

  // ---- the section
  const id = String(fuente.leccion ?? '');
  const m = /^(cap\d\d|ap[A-Z]|[a-z0-9-]+)\/(.+)$/.exec(id);
  if (!m) {
    err('leccion', `«${id}» no tiene la forma «cap01/sec-1.4»`);
    return fallo();
  }
  const parte = m[1]!;
  const seccion = m[2]!;
  const bloques = libro.bloques(parte);
  if (!bloques) {
    err('leccion', `no existe la parte «${parte}»`);
    return fallo();
  }
  const h2 = bloques.findIndex((b) => esObjeto(b) && b.t === 'h2' && b.label === seccion);
  if (h2 < 0) {
    err('leccion', `no existe la sección «${seccion}» en ${parte}`);
    return fallo();
  }
  let fin = h2 + 1;
  while (fin < bloques.length && !(esObjeto(bloques[fin]) && (bloques[fin] as { t?: string }).t === 'h2')) fin++;
  const bh2 = bloques[h2] as { num?: string; html: string };

  // ---- the book blocks it comes from
  const citas: Record<string, CitaLibro> = {};
  const textoLibro: string[] = [];
  const claveLibro = (x: unknown): string | null => {
    if (esNumero(x) || (typeof x === 'string' && /^\d+$/.test(x))) return `${parte}#${Number(x)}`;
    if (typeof x === 'string' && /^[a-zA-Z0-9-]+#\d+$/.test(x)) return x;
    return null;
  };
  if (!esObjeto(fuente.libro) || !Object.keys(fuente.libro).length) err('libro', 'falta la lista de bloques del libro (número: «cita literal»)');
  else {
    // 1.1 (book expansions): the index is where the block was when the lesson was written, and an expansion merged
    // before it (contenido/ampliaciones.py), or pasted into the book, shifts it. The block is the one with the quote:
    // the written index while it still has it, else the only block that has it (in the section, for a plain number);
    // when several have it, the one the lesson's other quotes in that part say the blocks moved by.
    const entradas = Object.entries(fuente.libro).map(([k, v]) => {
      const clave = claveLibro(k);
      const p = clave ? clave.split('#')[0]! : '';
      const n0 = clave ? Number(clave.split('#')[1]) : -1;
      const bl = clave ? (p === parte ? bloques : libro.bloques(p)) : null;
      const cita = typeof v === 'string' ? v : '';
      const enSeccion = p === parte && /^\d+$/.test(k);
      const tiene = (i: number) => bl?.[i] != null && (!enSeccion || (i >= h2 && i < fin)) && normal(textoDeBloque(bl[i])).includes(normal(cita));
      const cand: number[] = [];
      if (bl && cita.trim() && !tiene(n0)) for (let i = 0; i < bl.length; i++) if (tiene(i)) cand.push(i);
      return { k, clave, p, n0, bl, cita, enSeccion, cand };
    });
    const movidos = new Map<string, Map<number, number>>();
    for (const x of entradas)
      if (x.cand.length === 1) {
        const m = movidos.get(x.p) ?? movidos.set(x.p, new Map()).get(x.p)!;
        m.set(x.cand[0]! - x.n0, (m.get(x.cand[0]! - x.n0) ?? 0) + 1);
      }
    for (const { k, clave, p, n0, bl, cita, enSeccion, cand } of entradas) {
      if (!clave) {
        err('libro', `«${k}» no es un bloque (78, o «cap01#345» para uno de fuera de la sección)`);
        continue;
      }
      let nb = n0;
      if (cand.length === 1) nb = cand[0]!;
      else if (cand.length > 1) {
        const deltas = [...(movidos.get(p) ?? new Map<number, number>())].sort((a, b) => b[1] - a[1]).map(([d]) => d);
        const elegido = deltas.map((d) => n0 + d).find((i) => cand.includes(i));
        if (elegido == null) {
          // (a plain index outside the section says so first: that is what the author has to fix)
          if (enSeccion && (n0 < h2 || n0 >= fin)) err('libro', `el bloque ${n0} no está en la sección ${seccion} (bloques ${h2}–${fin - 1}); escríbalo «${parte}#${n0}» si es de otra`);
          else err('libro', `${clave}: el bloque no contiene «${cita}» y varios bloques sí (${cand.join(', ')}): escriba el índice actual`);
          continue;
        }
        nb = elegido;
      }
      const b = bl?.[nb];
      if (!b) {
        err('libro', `no existe el bloque ${clave}`);
        continue;
      }
      if (enSeccion && (nb < h2 || nb >= fin)) err('libro', `el bloque ${nb} no está en la sección ${seccion} (bloques ${h2}–${fin - 1}); escríbalo «${parte}#${nb}» si es de otra`);
      const texto = textoDeBloque(b);
      if (!cita.trim()) err('libro', `${clave}: falta la cita literal`);
      else if (!normal(texto).includes(normal(cita))) err('libro', `${clave}: el bloque no contiene «${cita}» (¿ha cambiado el índice del bloque?)`);
      citas[clave] = { parte: p, bloque: nb, cita };
      textoLibro.push(texto);
    }
  }
  const numerosLibro = numerosDe(textoLibro.join(' '));

  // ---- the model
  const antesModelo = errores.length;
  const modelo: Modelo = { valores: {}, calculos: {}, orden: [] };
  const fm = esObjeto(fuente.modelo) ? fuente.modelo : {};
  if (!esObjeto(fuente.modelo)) err('modelo', 'falta el modelo (valores y calculos)');
  const magnitudDe = (donde: string, x: Record<string, unknown>, idm: string, entrada = false) => {
    const unidad = typeof x.unidad === 'string' ? x.unidad : '';
    if (x.unidad != null && typeof x.unidad !== 'string') err(donde, '«unidad» debe ser texto');
    return {
      sim: analizarTexto(typeof x.sim === 'string' ? x.sim : idm),
      nombre: typeof x.nombre === 'string' ? x.nombre : idm,
      unidad,
      cifras: esNumero(x.cifras) ? x.cifras : 3,
      // (values the author gives are exact: «12 V», not «12,0 V»; computed results keep their figures: «4,00 V»)
      recortar: typeof x.recortar === 'boolean' ? x.recortar : entrada || ['Ω', 'F', 'H'].includes(unidad),
    };
  };
  if (esObjeto(fm.valores))
    for (const [k, v] of Object.entries(fm.valores)) {
      const donde = `modelo.valores.${k}`;
      if (!ID.test(k) || k in CONSTANTES) err(donde, 'nombre no válido (letras, cifras y _; no «pi» ni otras constantes)');
      if (!esObjeto(v)) {
        err(donde, 'debe ser { valor, unidad… }');
        continue;
      }
      const tipo = v.tipo === 'interruptor' ? 'interruptor' : 'numero';
      if (v.tipo != null && v.tipo !== 'interruptor' && v.tipo !== 'numero') err(donde, `tipo «${String(v.tipo)}» desconocido`);
      if (!esNumero(v.valor)) err(donde, 'falta «valor» (número, en unidades SI)');
      if (tipo === 'interruptor' && v.valor !== 0 && v.valor !== 1) err(donde, 'un interruptor vale 0 (abierto) o 1 (cerrado)');
      modelo.valores[k] = { ...magnitudDe(donde, v, k, true), valor: esNumero(v.valor) ? v.valor : 0, tipo } satisfies ValorModelo;
    }
  else err('modelo.valores', 'faltan los valores');
  const usos = new Map<string, Set<string>>();
  const variables = (donde: string, expr: unknown, extra: string[] = []): Set<string> | null => {
    if (typeof expr !== 'string' || !expr.trim()) {
      err(donde, 'falta la expresión');
      return null;
    }
    try {
      const vs = variablesDe(analizar(expr));
      for (const v of vs) if (!(v in modelo.valores) && !(v in (fm.calculos as object ?? {})) && !extra.includes(v)) err(donde, `«${v}» no está en el modelo`);
      return vs;
    } catch (e) {
      err(donde, `expresión no válida «${expr}»: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };
  if (esObjeto(fm.calculos))
    for (const [k, v] of Object.entries(fm.calculos)) {
      const donde = `modelo.calculos.${k}`;
      if (!ID.test(k) || k in CONSTANTES) err(donde, 'nombre no válido');
      if (k in modelo.valores) err(donde, 'ya es un valor del modelo');
      if (!esObjeto(v)) {
        err(donde, 'debe ser { expr, unidad… } o { si, entonces, sino… }');
        continue;
      }
      const c: CalculoModelo = magnitudDe(donde, v, k);
      const dep = new Set<string>();
      if (v.si != null) {
        if (typeof v.si !== 'string' || modelo.valores[v.si]?.tipo !== 'interruptor') err(donde, '«si» debe ser un interruptor del modelo');
        c.si = String(v.si);
        c.entonces = String(v.entonces ?? '');
        c.sino = String(v.sino ?? '');
        for (const x of [variables(`${donde}.entonces`, v.entonces), variables(`${donde}.sino`, v.sino)]) for (const y of x ?? []) dep.add(y);
      } else {
        c.expr = String(v.expr ?? '');
        for (const y of variables(`${donde}.expr`, v.expr) ?? []) dep.add(y);
      }
      modelo.calculos[k] = c;
      usos.set(k, dep);
    }
  // order: each calculation after the ones it uses (a cycle is an error)
  {
    const hecho = new Set<string>();
    const visitando = new Set<string>();
    const visitar = (k: string): void => {
      if (hecho.has(k)) return;
      if (visitando.has(k)) {
        err(`modelo.calculos.${k}`, 'depende de sí mismo (ciclo)');
        return;
      }
      visitando.add(k);
      for (const d of usos.get(k) ?? []) if (d in modelo.calculos) visitar(d);
      visitando.delete(k);
      hecho.add(k);
      modelo.orden.push(k);
    };
    for (const k of Object.keys(modelo.calculos)) visitar(k);
  }
  const enModelo = (x: string) => x in modelo.valores || x in modelo.calculos;
  if (errores.length > antesModelo) return fallo();
  const mc = compilarModelo(modelo);
  const base: Valores = {};
  for (const [k, v] of Object.entries(modelo.valores)) base[k] = v.valor;

  // ---- cards
  const fuenteTarjetas = Array.isArray(fuente.tarjetas) ? fuente.tarjetas : [];
  if (!fuenteTarjetas.length) err('tarjetas', 'no hay tarjetas');
  const ids = new Set<string>();
  const tarjetas: Tarjeta[] = [];
  // the reader's own values as the lesson goes (what each card starts from: the cards before set them)
  let propios: Valores = { ...base };

  fuenteTarjetas.forEach((ft: unknown, i: number) => {
    const t0 = esObjeto(ft) ? ft : {};
    const tid = typeof t0.id === 'string' ? t0.id : `#${i + 1}`;
    const donde = `tarjeta ${tid}`;
    const e = (msg: string) => err(donde, msg);
    const antes = errores.length;
    /** No error in this card so far (the checks that evaluate the model need a sound card). */
    const sana = () => errores.length === antes;
    if (!esObjeto(ft)) return e('no es un objeto');
    const CLAVES = new Set(['id', 'tipo', 'fase', 'titulo', 'texto', 'nota', 'libro', 'fijar', 'inicio', 'widget', 'requiere', 'opciones', 'estimar', 'ordenar', 'emparejar', 'condiciones', 'exito', 'pistas', 'ayuda', 'ec', 'sustitucion', 'ideas', 'comprobar']);
    for (const k of Object.keys(ft)) if (!CLAVES.has(k)) e(`clave desconocida «${k}»`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(tid)) e('«id» debe ser corto, en minúsculas y con guiones («prediga-salida»)');
    if (ids.has(tid)) e('«id» repetido');
    ids.add(tid);
    const tipo = ft.tipo as TipoTarjeta;
    if (!TIPOS.includes(tipo)) return e(`tipo «${String(ft.tipo)}» desconocido (${TIPOS.join(', ')})`);
    const texto = (x: unknown, campo: string, obligatorio = false): Texto | undefined => {
      if (x == null || x === '') {
        if (obligatorio) e(`falta «${campo}»`);
        return undefined;
      }
      if (typeof x !== 'string') {
        e(`«${campo}» debe ser texto`);
        return undefined;
      }
      if (/<[a-z/]/i.test(x)) e(`«${campo}»: sin HTML (use _{…}, ^{…}, **…**)`);
      const r = analizarTexto(x);
      for (const v of valoresDeTexto(r)) if (!enModelo(v)) e(`«${campo}»: {{${v}}} no está en el modelo`);
      if (/\{\{|\}\}/.test(textoPlano(r))) e(`«${campo}»: llaves sin cerrar`);
      return r;
    };
    const t: Tarjeta = {
      id: tid,
      tipo,
      fase: typeof ft.fase === 'string' ? ft.fase : FASE[tipo],
      titulo: texto(ft.titulo, 'titulo', true) ?? [],
      texto: texto(ft.texto, 'texto', tipo !== 'resumen') ?? [],
      libro: [],
      fijar: {},
      inicio: {},
    };
    const nota = texto(ft.nota, 'nota');
    if (nota) t.nota = nota;
    // book blocks
    const lib = Array.isArray(ft.libro) ? ft.libro : ft.libro != null ? [ft.libro] : [];
    if (!lib.length) e('falta «libro»: los bloques del libro de los que sale');
    for (const x of lib) {
      const clave = claveLibro(x);
      if (!clave || !citas[clave]) e(`«libro»: ${String(x)} no está en la lista «libro» de la lección`);
      else t.libro.push(clave);
    }
    // values: fixed (overlay) and starting ones
    for (const campo of ['fijar', 'inicio'] as const) {
      const x = ft[campo];
      if (x == null) continue;
      if (!esObjeto(x)) {
        e(`«${campo}» debe ser { valor: número }`);
        continue;
      }
      for (const [k, v] of Object.entries(x)) {
        if (!(k in modelo.valores)) e(`«${campo}»: «${k}» no es un valor del modelo`);
        else if (!esNumero(v)) e(`«${campo}.${k}» debe ser un número`);
        else t[campo][k] = v;
      }
    }
    const comprobar = Array.isArray(ft.comprobar) ? ft.comprobar : ft.comprobar != null ? [ft.comprobar] : [];
    // what this card's numbers may be: verified results of the model
    const cifrasModelo: number[] = [];
    for (const v of Object.values(t.fijar)) cifrasModelo.push(v);
    for (const v of Object.values(t.inicio)) cifrasModelo.push(v);

    // widget
    let mandos: Mando[] = [];
    if (ft.widget != null) {
      const w = widgetDe(ft.widget, t, e);
      if (w) {
        t.widget = w;
        mandos = w.mandos;
      }
    }
    const valoresMando = new Set(mandos.map((x) => x.valor));
    for (const k of Object.keys(t.inicio)) {
      const md = mandos.find((x) => x.valor === k);
      if (!md) e(`«inicio.${k}»: solo se ponen al empezar valores que la tarjeta deja mover`);
      else if (!md.valores.some((x) => Math.abs(x - t.inicio[k]!) <= 1e-9 * Math.max(1, Math.abs(x)))) e(`«inicio.${k}» = ${t.inicio[k]} no es una posición del mando`);
    }
    for (const k of Object.keys(t.fijar)) if (valoresMando.has(k)) e(`«${k}» está fijado y también tiene mando`);

    // the state this card starts in, and its evaluation
    const inicial = { ...propios, ...t.inicio, ...t.fijar };
    const ev0 = mc.evaluar(inicial);
    for (const k of modelo.orden) if (!Number.isFinite(ev0[k]!)) e(`con los valores de esta tarjeta, «${k}» no da un número (${ev0[k]})`);

    // gating
    if (tipo === 'explorar' || tipo === 'sorpresa' || ft.requiere != null) {
      if (!mandos.length) e('una tarjeta para explorar necesita un widget con mandos');
      const rq = esObjeto(ft.requiere) ? ft.requiere : {};
      if (ft.requiere != null && !esObjeto(ft.requiere)) e('«requiere» debe ser { mover: [...], conectar: [...] }');
      const mover = Array.isArray(rq.mover) ? rq.mover.map(String) : [];
      const conectar = Array.isArray(rq.conectar) ? rq.conectar.map(String) : [];
      for (const k of mover) if (!valoresMando.has(k)) e(`«requiere.mover»: «${k}» no tiene mando en esta tarjeta`);
      for (const k of conectar) if (!mandos.some((x) => x.valor === k && x.tipo !== 'deslizador')) e(`«requiere.conectar»: «${k}» no es un interruptor de esta tarjeta`);
      // a «conectar» button is always something to do before going on
      for (const x of mandos) if (x.tipo === 'conectar' && !conectar.includes(x.valor)) conectar.push(x.valor);
      const minimo = esNumero(rq.minimo) ? rq.minimo : mover.length ? mover.length : conectar.length ? 0 : 1;
      t.requiere = { mover, minimo, conectar };
    }

    // answers
    const respuestas = ['opciones', 'estimar', 'ordenar', 'emparejar', 'condiciones'].filter((k) => ft[k] != null);
    const pregunta = tipo === 'predecir' || tipo === 'pregunta' || tipo === 'porque';
    if (pregunta && respuestas.filter((k) => k !== 'condiciones').length !== 1) e('una pregunta lleva exactamente una de: opciones, estimar, ordenar, emparejar');
    if (tipo === 'porque' && ft.opciones == null) e('«porque» lleva opciones');
    if (!pregunta && tipo !== 'reto' && respuestas.length) e(`una tarjeta «${tipo}» no lleva ${respuestas.join(', ')}`);
    if (Array.isArray(ft.opciones)) {
      const ops: Opcion[] = [];
      ft.opciones.forEach((o: unknown, k: number) => {
        const d = `opcion ${k + 1}`;
        if (!esObjeto(o)) return e(`${d}: debe ser { texto, bien?, porque }`);
        for (const k of Object.keys(o)) if (!['texto', 'bien', 'porque'].includes(k)) e(`${d}: clave desconocida «${k}»`);
        const tx = texto(o.texto, `${d}.texto`, true) ?? [];
        const pq = texto(o.porque, `${d}.porque`, true) ?? [];
        if (contarPalabras(tx) > MAX_PALABRAS_OPCION) e(`${d}: ${contarPalabras(tx)} palabras (máximo ${MAX_PALABRAS_OPCION})`);
        if (contarPalabras(pq) > MAX_PALABRAS_EXPLICACION) e(`${d}.porque: ${contarPalabras(pq)} palabras (máximo ${MAX_PALABRAS_EXPLICACION})`);
        ops.push({ texto: tx, bien: o.bien === true, porque: pq });
      });
      if (ops.length < 2 || ops.length > 5) e('entre 2 y 5 opciones');
      if (ops.filter((o) => o.bien).length !== 1) e('exactamente una opción con «bien: true»');
      const textos = ops.map((o) => textoPlano(o.texto));
      if (new Set(textos).size !== textos.length) e('opciones repetidas');
      t.opciones = ops;
    } else if (ft.opciones != null) e('«opciones» debe ser una lista');
    if (ft.estimar != null) {
      const x = ft.estimar;
      if (!esObjeto(x)) e('«estimar» debe ser { objetivo, unidad, min, max, paso, inicio, tol, rotulo }');
      else {
        variables('estimar.objetivo', x.objetivo);
        const est: Estimar = {
          objetivo: String(x.objetivo ?? ''),
          unidad: typeof x.unidad === 'string' ? x.unidad : '',
          min: Number(x.min),
          max: Number(x.max),
          paso: Number(x.paso),
          inicio: Number(x.inicio),
          tol: esNumero(x.tol) ? x.tol : 0.05,
          rotulo: texto(x.rotulo, 'estimar.rotulo', true) ?? [],
          cifras: esNumero(x.cifras) ? x.cifras : 3,
        };
        if (![est.min, est.max, est.paso, est.inicio].every(Number.isFinite) || !(est.min < est.max) || !(est.paso > 0)) e('«estimar»: min < max, paso > 0 e inicio numéricos');
        else if ((est.max - est.min) / est.paso > 2000) e('«estimar»: más de 2000 posiciones');
        else if (sana()) {
          const pos = posicionesEstimar(est);
          if (!pos.some((p) => Math.abs(p - est.inicio) < est.paso * 1e-6)) e('«estimar.inicio» no es una posición (min + k·paso)');
          const obj = objetivoEstimar(mc, est, inicial);
          if (!Number.isFinite(obj)) e(`«estimar.objetivo» no da un número (${obj})`);
          else {
            if (obj < est.min || obj > est.max) e(`el objetivo (${obj}) cae fuera del deslizador`);
            if (!pos.some((p) => puntuarEstimacion(p, obj, est.tol).bien)) e('ninguna posición del deslizador cae dentro de la tolerancia');
            if (puntuarEstimacion(est.inicio, obj, est.tol).bien) e('la estimación empieza ya acertada');
            cifrasModelo.push(obj);
          }
        }
        t.estimar = est;
      }
    }
    if (ft.ordenar != null) {
      if (!Array.isArray(ft.ordenar) || ft.ordenar.length < 3 || ft.ordenar.length > 7) e('«ordenar» es una lista de 3 a 7 textos, en su orden correcto');
      else {
        const el = ft.ordenar.map((x: unknown, k: number) => texto(x, `ordenar ${k + 1}`, true) ?? []);
        for (const [k, x] of el.entries()) if (contarPalabras(x) > MAX_PALABRAS_OPCION) e(`ordenar ${k + 1}: más de ${MAX_PALABRAS_OPCION} palabras`);
        t.ordenar = { elementos: el, inicio: barajarFijo(el.length, `${id}/${tid}`) } satisfies Ordenar;
      }
    }
    if (ft.emparejar != null) {
      if (!Array.isArray(ft.emparejar) || ft.emparejar.length < 2 || ft.emparejar.length > 6) e('«emparejar» es una lista de 2 a 6 parejas [izquierda, derecha]');
      else {
        const pj: [Texto, Texto][] = [];
        ft.emparejar.forEach((x: unknown, k: number) => {
          if (!Array.isArray(x) || x.length !== 2) return e(`emparejar ${k + 1}: debe ser [izquierda, derecha]`);
          const a = texto(x[0], `emparejar ${k + 1}.izquierda`, true) ?? [];
          const b = texto(x[1], `emparejar ${k + 1}.derecha`, true) ?? [];
          if (contarPalabras(b) > MAX_PALABRAS_OPCION) e(`emparejar ${k + 1}: más de ${MAX_PALABRAS_OPCION} palabras`);
          pj.push([a, b]);
        });
        t.emparejar = { parejas: pj, inicio: barajarFijo(pj.length, `${id}/${tid}`) } satisfies Emparejar;
      }
    }
    const rango = (x: unknown, d: string): Rango | null => {
      if (!esObjeto(x) || typeof x.valor !== 'string') {
        e(`${d}: debe ser { valor, objetivo + tol | min / max | menor | mayor }`);
        return null;
      }
      // (an estimate's hints may look at the reader's estimate itself: «estimacion»)
      if (!enModelo(x.valor) && !(x.valor === 'estimacion' && ft.estimar != null)) e(`${d}: «${x.valor}» no está en el modelo`);
      const r: Rango = { valor: x.valor };
      if (esNumero(x.objetivo)) {
        const tol = esNumero(x.tol) ? x.tol : 0.02;
        const a = x.objetivo * (1 - tol);
        const b = x.objetivo * (1 + tol);
        r.min = Math.min(a, b);
        r.max = Math.max(a, b);
      }
      if (esNumero(x.min)) r.min = x.min;
      if (esNumero(x.max)) r.max = x.max;
      if (esNumero(x.menor)) r.max = x.menor;
      if (esNumero(x.mayor)) r.min = x.mayor;
      if (r.min == null && r.max == null) e(`${d}: falta el objetivo o los límites`);
      if (r.min != null && r.max != null && r.min > r.max) e(`${d}: min > max`);
      return r;
    };
    if (ft.condiciones != null) {
      if (tipo !== 'reto') e('solo un reto lleva «condiciones»');
      if (!Array.isArray(ft.condiciones) || !ft.condiciones.length) e('«condiciones» es una lista');
      else {
        t.condiciones = [];
        ft.condiciones.forEach((x: unknown, k: number) => {
          const r = rango(x, `condicion ${k + 1}`);
          const rot = texto(esObjeto(x) ? x.rotulo : undefined, `condicion ${k + 1}.rotulo`, true) ?? [];
          if (contarPalabras(rot) > MAX_PALABRAS_ROTULO) e(`condicion ${k + 1}.rotulo: más de ${MAX_PALABRAS_ROTULO} palabras`);
          if (r) t.condiciones!.push({ ...r, rotulo: rot } satisfies Condicion);
        });
      }
    }
    if (tipo === 'reto' && !t.condiciones) e('un reto lleva «condiciones»');
    const exito = texto(ft.exito, 'exito', tipo === 'reto' || !!t.estimar || !!t.ordenar || !!t.emparejar);
    if (exito) {
      t.exito = exito;
      if (contarPalabras(exito) > MAX_PALABRAS_EXPLICACION) e(`«exito»: más de ${MAX_PALABRAS_EXPLICACION} palabras`);
    }
    if (ft.pistas != null) {
      if (!Array.isArray(ft.pistas)) e('«pistas» es una lista');
      else {
        t.pistas = ft.pistas.map((x: unknown, k: number): Pista => {
          const p: Pista = { texto: texto(esObjeto(x) ? x.texto : x, `pista ${k + 1}`, true) ?? [] };
          if (esObjeto(x) && x.cuando != null) {
            const r = rango(x.cuando, `pista ${k + 1}.cuando`);
            if (r) p.cuando = r;
          }
          if (contarPalabras(p.texto) > MAX_PALABRAS_EXPLICACION) e(`pista ${k + 1}: más de ${MAX_PALABRAS_EXPLICACION} palabras`);
          return p;
        });
      }
    }
    if ((tipo === 'reto' || t.estimar || t.ordenar || t.emparejar) && !t.pistas?.length) e('falta «pistas»: qué decir cuando no está bien');
    const ayuda = texto(ft.ayuda, 'ayuda');
    if (ayuda) {
      t.ayuda = ayuda;
      if (contarPalabras(ayuda) > MAX_PALABRAS_EXPLICACION) e(`«ayuda»: más de ${MAX_PALABRAS_EXPLICACION} palabras`);
    }
    // formula
    if (ft.ec != null) {
      const clave = claveLibro(ft.ec);
      const c = clave ? citas[clave] : null;
      const b = c ? (c.parte === parte ? bloques : libro.bloques(c.parte))?.[c.bloque] : null;
      if (!clave || !c) e(`«ec»: ${String(ft.ec)} no está en la lista «libro»`);
      else if (!esObjeto(b) || b.t !== 'ec') e(`«ec»: el bloque ${clave} no es una ecuación`);
      else {
        t.ec = { libro: clave, svg: String(b.svg), fuente: String(b.fuente ?? ''), w: Number(b.w), h: Number(b.h) } satisfies Ecuacion;
        if (!t.libro.includes(clave)) t.libro.push(clave);
      }
    }
    if (tipo === 'formula' && !t.ec) e('una tarjeta «formula» lleva «ec» (el bloque de la ecuación del libro)');
    const sus = texto(ft.sustitucion, 'sustitucion');
    if (sus) {
      if (!valoresDeTexto(sus).length) e('«sustitucion» debe usar valores vivos {{…}}');
      t.sustitucion = sus;
    }
    // summary
    if (tipo === 'resumen') {
      if (i !== fuenteTarjetas.length - 1) e('el resumen es la última tarjeta');
      if (!Array.isArray(ft.ideas) || ft.ideas.length < 1 || ft.ideas.length > 4) e('«ideas»: de 1 a 4 { titulo, texto }');
      else
        t.ideas = ft.ideas.map((x: unknown, k: number): Idea => {
          const o = esObjeto(x) ? x : {};
          const idea = { titulo: texto(o.titulo, `idea ${k + 1}.titulo`, true) ?? [], texto: texto(o.texto, `idea ${k + 1}.texto`, true) ?? [] };
          const n = contarPalabras(idea.titulo) + contarPalabras(idea.texto);
          if (n > MAX_PALABRAS_TARJETA) e(`idea ${k + 1}: ${n} palabras (máximo ${MAX_PALABRAS_TARJETA})`);
          return idea;
        });
    } else if (ft.ideas != null) e('solo el resumen lleva «ideas»');

    // words of the card
    const palabras = contarPalabras(t.titulo) + contarPalabras(t.texto) + contarPalabras(t.nota);
    if (palabras > MAX_PALABRAS_TARJETA) e(`${palabras} palabras entre título, texto y nota (máximo ${MAX_PALABRAS_TARJETA})`);

    // claims checked against the model
    comprobar.forEach((x: unknown, k: number) => {
      const d = `comprobar ${k + 1}`;
      if (!esObjeto(x)) return e(`${d}: debe ser { con: {…}, cálculo: valor }`);
      const con = esObjeto(x.con) ? x.con : {};
      for (const [q, v] of Object.entries(con)) {
        if (!(q in modelo.valores)) e(`${d}.con: «${q}» no es un valor del modelo`);
        else if (!esNumero(v)) e(`${d}.con.${q}: número`);
      }
      const tol = esNumero(x.tol) ? x.tol : 0.005;
      const r = mc.evaluar({ ...inicial, ...(con as Valores) });
      let alguno = false;
      for (const [q, v] of Object.entries(x)) {
        if (q === 'con' || q === 'tol') continue;
        alguno = true;
        if (!enModelo(q)) e(`${d}: «${q}» no está en el modelo`);
        else if (!esNumero(v)) e(`${d}.${q}: número`);
        else {
          const real = r[q]!;
          const ok = v === 0 ? Math.abs(real) <= 1e-12 : Math.abs(real - v) <= tol * Math.abs(v);
          if (!ok) e(`${d}: el modelo da ${q} = ${real}, no ${v} (tolerancia ${tol * 100} %)`);
          cifrasModelo.push(v, real);
        }
      }
      for (const v of Object.values(con)) if (esNumero(v)) cifrasModelo.push(v);
      if (!alguno) e(`${d}: no comprueba ningún cálculo`);
    });

    // numbers: from the book, or what the model gives
    const textos: [string, Texto | undefined][] = [
      ['titulo', t.titulo], ['texto', t.texto], ['nota', t.nota], ['exito', t.exito], ['ayuda', t.ayuda],
      ...(t.opciones ?? []).flatMap((o, k): [string, Texto][] => [[`opcion ${k + 1}`, o.texto], [`opcion ${k + 1}.porque`, o.porque]]),
      ...(t.pistas ?? []).map((p, k): [string, Texto] => [`pista ${k + 1}`, p.texto]),
      ...(t.ideas ?? []).flatMap((x, k): [string, Texto][] => [[`idea ${k + 1}`, x.titulo], [`idea ${k + 1}`, x.texto]]),
      ...(t.ordenar?.elementos ?? []).map((x, k): [string, Texto] => [`ordenar ${k + 1}`, x]),
      ...(t.emparejar?.parejas ?? []).flatMap((x, k): [string, Texto][] => [[`emparejar ${k + 1}`, x[0]], [`emparejar ${k + 1}`, x[1]]]),
      ...(t.condiciones ?? []).map((x, k): [string, Texto] => [`condicion ${k + 1}`, x.rotulo]),
    ];
    for (const [campo, tx] of textos)
      for (const n of numerosDeTexto(tx)) {
        const enLibro = numerosLibro.some((b) => Math.abs(b.v - n.v) <= 1e-9 * Math.max(1, Math.abs(n.v)) || Math.abs(b.v + n.v) <= 1e-12);
        if (enLibro || cifrasModelo.some((c) => coincide(n, c))) continue;
        e(`«${campo}»: el número ${n.s} no está en los bloques del libro citados ni lo da el modelo (añada un «comprobar»)`);
      }

    // challenge: reachable, not solved at the start, a hint for every failing position
    if (t.condiciones && t.condiciones.length && mandos.length && sana()) {
      const combinaciones = mandos.reduce((a, x) => a * x.valores.length, 1);
      if (combinaciones > MAX_COMBINACIONES) e(`el reto tiene ${combinaciones} posiciones (máximo ${MAX_COMBINACIONES}): menos mandos o posiciones`);
      else {
        let soluciones = 0;
        let sinPista = 0;
        const pos = mandos.map(() => 0);
        for (let n = 0; n < combinaciones; n++) {
          const v: Valores = { ...inicial };
          mandos.forEach((x, k) => (v[x.valor] = x.valores[pos[k]!]!));
          const r = mc.evaluar(v);
          if (t.condiciones.every((c) => enRango(c, r))) soluciones++;
          else if (!(t.pistas ?? []).some((p) => !p.cuando || enRango(p.cuando, r))) sinPista++;
          for (let k = 0; k < pos.length; k++) {
            pos[k]!++;
            if (pos[k]! < mandos[k]!.valores.length) break;
            pos[k] = 0;
          }
        }
        if (!soluciones) e('el reto no tiene solución con los mandos de la tarjeta');
        if (sinPista) e(`hay ${sinPista} posiciones que no cumplen el reto y a las que no se aplica ninguna pista (añada una pista sin «cuando»)`);
        if (t.condiciones.every((c) => enRango(c, ev0))) e('el reto empieza ya resuelto (ponga «inicio»)');
      }
    }

    // circuit: what the model says against the app's ngspice (run by the script)
    if (t.widget?.tipo === 'circuito' && sana()) {
      const w = t.widget;
      const def = esquemaDe(w.esquema)!;
      const estados: Valores[] = [inicial];
      for (const x of mandos) for (const v of [x.valores[0]!, x.valores[x.valores.length - 1]!]) estados.push({ ...inicial, [x.valor]: v });
      for (const x of comprobar) if (esObjeto(x) && esObjeto(x.con)) estados.push({ ...inicial, ...(x.con as Valores) });
      spice.push(...comprobacionesCircuito(def, w, medidas.get(w) ?? {}, mc, estados, `${origen}: ${donde}`));
    }

    // the reader's values carry on to the next card (what the controls of this one start from)
    propios = { ...propios, ...t.inicio };
    tarjetas.push(t);
  });

  if (tarjetas.length && tarjetas[tarjetas.length - 1]!.tipo !== 'resumen') err('tarjetas', 'la última tarjeta es el resumen');
  if (tarjetas.filter((t) => t.tipo === 'resumen').length > 1) err('tarjetas', 'un solo resumen');
  if (!tarjetas.some((t) => t.tipo === 'explorar')) err('tarjetas', 'falta al menos una tarjeta «explorar»');
  if (!tarjetas.some((t) => t.opciones || t.estimar || t.ordenar || t.emparejar || t.condiciones)) err('tarjetas', 'falta algo que responder (predecir, pregunta, reto o porque)');
  // the approved sequence: explore → predict → formalise → apply → surprise → why → summary
  const orden = ['explorar', 'predecir', 'formula', 'reto', 'sorpresa', 'porque', 'resumen'];
  const vistos = tarjetas.map((t) => t.tipo).filter((x) => orden.includes(x));
  for (const [k, x] of vistos.entries()) if (k > 0 && orden.indexOf(x) < orden.indexOf(vistos[k - 1]!) && x !== 'explorar' && x !== 'predecir') {
    aviso('orden', `«${x}» después de «${vistos[k - 1]}» (la secuencia aprobada es ${orden.join(' → ')})`);
    break;
  }
  for (const tipo of ['predecir', 'formula', 'porque'] as const) if (!tarjetas.some((t) => t.tipo === tipo)) aviso('tarjetas', `no hay ninguna tarjeta «${tipo}»`);
  const sinCitar = Object.keys(citas).filter((k) => !tarjetas.some((t) => t.libro.includes(k)));
  if (sinCitar.length) aviso('libro', `bloques citados por ninguna tarjeta: ${sinCitar.join(', ')}`);

  if (errores.length) return fallo();
  const leccion: Leccion11 = {
    version: 1,
    id,
    parte,
    seccion,
    num: bh2.num ?? '',
    titulo: typeof fuente.titulo === 'string' ? fuente.titulo : planoHtml(bh2.html),
    libro: citas,
    modelo,
    tarjetas,
  };
  return { leccion, errores, avisos, spice };

  // ---------------------------------------------------------------- widgets

  function mandoDe(x: unknown, d: string, e: (m: string) => void, t: Tarjeta): Mando | null {
    const o = typeof x === 'string' ? { valor: x } : x;
    if (!esObjeto(o) || typeof o.valor !== 'string') {
      e(`${d}: debe ser { valor, min, max, paso | serie | lista | tipo }`);
      return null;
    }
    const v = modelo.valores[o.valor];
    if (!v) {
      e(`${d}: «${o.valor}» no es un valor del modelo (un cálculo no se mueve)`);
      return null;
    }
    const md: Mando = { valor: o.valor, tipo: 'deslizador', valores: [] };
    if (o.rotulo != null) md.rotulo = analizarTexto(String(o.rotulo));
    if (v.tipo === 'interruptor' || o.tipo === 'interruptor' || o.tipo === 'conectar') {
      if (v.tipo !== 'interruptor') e(`${d}: «${o.valor}» no es un interruptor del modelo`);
      md.tipo = o.tipo === 'conectar' ? 'conectar' : 'interruptor';
      md.valores = [0, 1];
      if (md.tipo === 'conectar') {
        if (typeof o.boton !== 'string') e(`${d}: un mando «conectar» lleva «boton» (su texto)`);
        else md.boton = analizarTexto(o.boton);
      }
      return md;
    }
    if (Array.isArray(o.lista)) {
      if (!o.lista.every(esNumero) || o.lista.length < 2) e(`${d}.lista: al menos dos números`);
      md.valores = [...new Set(o.lista.filter(esNumero))].sort((a, b) => a - b);
      if (o.nombres != null) {
        // a name for each position, in the order of «lista» (the colours of the colour code, materials…)
        const nombres = o.nombres;
        if (!Array.isArray(nombres) || nombres.length !== o.lista.length || !nombres.every((x) => typeof x === 'string' && x.trim() !== ''))
          e(`${d}.nombres: un texto por cada valor de «lista», en el mismo orden`);
        else if (md.valores.length !== o.lista.length) e(`${d}.nombres: «lista» tiene valores repetidos`);
        else if (new Set(nombres.map((x) => (x as string).trim())).size !== nombres.length) e(`${d}.nombres: hay nombres repetidos`);
        else if (nombres.some((x) => /\d/.test(x as string))) e(`${d}.nombres: sin cifras (el valor ya se ve entre paréntesis: «rojo (2)»)`);
        else if (nombres.some((x) => (x as string).trim().length > 24)) e(`${d}.nombres: como mucho 24 caracteres cada uno`);
        else {
          const de = new Map((o.lista as number[]).map((v, k) => [v, (nombres[k] as string).trim()]));
          md.nombres = md.valores.map((v) => de.get(v)!);
        }
      }
    } else if (o.serie === 'E12' || o.serie === 'E24') {
      if (!esNumero(o.min) || !esNumero(o.max) || !(o.min > 0) || !(o.min < o.max)) e(`${d}: una serie necesita 0 < min < max`);
      else md.valores = valoresSerie(o.min, o.max, o.serie);
      md.serie = o.serie;
    } else if (esNumero(o.min) && esNumero(o.max) && esNumero(o.paso)) {
      if (!(o.min < o.max) || !(o.paso > 0)) e(`${d}: min < max y paso > 0`);
      else if ((o.max - o.min) / o.paso > 2000) e(`${d}: más de 2000 posiciones`);
      else md.valores = valoresLineales(o.min, o.max, o.paso);
    } else e(`${d}: falta el recorrido (min, max y paso; serie E12/E24 con min y max; o lista)`);
    if (o.nombres != null && !Array.isArray(o.lista)) e(`${d}.nombres: solo con «lista»`);
    if (md.valores.length && !(o.valor in t.inicio)) {
      // the value the control starts at must be one of its positions
      const k = posicionMasCercana(md.valores, v.valor);
      if (Math.abs(md.valores[k]! - v.valor) > 1e-9 * Math.max(1, Math.abs(v.valor)) && !(o.valor in t.fijar))
        aviso(d, `el valor del modelo (${v.valor}) no es una posición del mando: empezará en ${md.valores[k]}`);
    }
    return md;
  }

  function lecturaDe(x: unknown, d: string, e: (m: string) => void): Lectura | null {
    const o = typeof x === 'string' ? { valor: x } : x;
    if (!esObjeto(o) || typeof o.valor !== 'string' || !enModelo(o.valor)) {
      e(`${d}: debe ser { valor (del modelo), rotulo }`);
      return null;
    }
    const mag = mc.magnitud(o.valor)!;
    return { valor: o.valor, rotulo: typeof o.rotulo === 'string' ? analizarTexto(o.rotulo) : [{ t: 'txt', s: mag.nombre }] };
  }

  function widgetDe(x: unknown, t: Tarjeta, e: (m: string) => void): Widget | null {
    const antesWidget = errores.length;
    if (!esObjeto(x)) {
      e('«widget» debe ser { tipo: circuito | grafica, … }');
      return null;
    }
    const mandos = (Array.isArray(x.mandos) ? x.mandos : []).map((m, k) => mandoDe(m, `mando ${k + 1}`, e, t)).filter((m): m is Mando => !!m);
    if (new Set(mandos.map((m) => m.valor)).size !== mandos.length) e('dos mandos para el mismo valor');
    const ocultar = x.ocultar === true;
    if (x.tipo === 'circuito') {
      const def = typeof x.esquema === 'string' ? esquemaDe(x.esquema) : undefined;
      if (!def) {
        e(`«widget.esquema» «${String(x.esquema)}» no existe; los esquemas son: ${nombresEsquemas().join(', ') || '(ninguno registrado)'}`);
        return null;
      }
      const piezas: Record<string, string> = {};
      const fp = esObjeto(x.piezas) ? x.piezas : {};
      for (const [k, pz] of Object.entries(def.piezas)) if (pz.obligatoria && typeof fp[k] !== 'string') e(`«widget.piezas.${k}» falta (${pz.descripcion})`);
      for (const [k, v] of Object.entries(fp)) {
        const pz = def.piezas[k];
        if (!pz) e(`«widget.piezas.${k}»: pieza desconocida del esquema ${def.nombre} (${Object.keys(def.piezas).join(', ')})`);
        else if (typeof v !== 'string' || !enModelo(v)) e(`«widget.piezas.${k}»: «${String(v)}» no está en el modelo`);
        else {
          if (pz.interruptor && modelo.valores[v]?.tipo !== 'interruptor') e(`«widget.piezas.${k}» debe ser un interruptor del modelo`);
          piezas[k] = v;
        }
      }
      const tiene = (k: string) => k in piezas;
      for (const m of def.validar?.(tiene) ?? []) e(`«widget.piezas»: ${m}`);
      for (const n of def.noLineal?.(tiene) ?? [])
        if (piezas[n.pieza] && !(piezas[n.pieza]! in modelo.valores)) e(`«widget.piezas.${n.pieza}»: la caída constante del libro debe ser un valor del modelo (no un cálculo): así se comprueba su aproximación`);
      const w: WidgetCircuito = { tipo: 'circuito', esquema: def.nombre, piezas, mandos, ocultar };
      if (x.lectura != null) w.lectura = lecturaDe(x.lectura, 'widget.lectura', e) ?? undefined;
      if (Array.isArray(x.barras)) {
        w.barras = x.barras
          .map((b, k): Barra | null => {
            const l = lecturaDe(b, `widget.barras ${k + 1}`, e);
            const color = esObjeto(b) && typeof b.color === 'string' ? b.color : k === 0 ? 'azul' : 'naranja';
            if (!COLORES.includes(color)) e(`widget.barras ${k + 1}: color ${color} (azul, naranja o verde)`);
            return l ? { ...l, color: color as Color } : null;
          })
          .filter((b): b is Barra => !!b);
        if (w.barras.length < 2) e('«widget.barras»: al menos dos (las partes que se reparten)');
      }
      if (Array.isArray(x.datos)) w.datos = x.datos.map((d, k) => lecturaDe(d, `widget.datos ${k + 1}`, e)).filter((d): d is Lectura => !!d);
      if (x.corriente != null) {
        if (typeof x.corriente !== 'string' || !enModelo(x.corriente)) e('«widget.corriente»: un cálculo del modelo (en A)');
        else w.corriente = x.corriente;
      }
      if (x.grafica != null) {
        const g = graficaDe(x.grafica, 'widget.grafica', mandos, t, e, antesWidget, def, tiene);
        if (g) w.grafica = g;
      }
      if (x.dibujo === false) w.dibujo = false;
      else if (x.dibujo != null && x.dibujo !== true) e('«widget.dibujo»: true o false');
      if (w.dibujo === false && !w.grafica) e('«widget.dibujo: false» sin «grafica»: no quedaría nada que ver');
      // what the drawing measures, checked against ngspice
      const lista = Object.entries(def.observables).filter(([, o]) => o.analisis !== 'tran').map(([k]) => k).join(', ');
      const mide: Record<string, string> = {};
      if (x.mide != null && !esObjeto(x.mide)) e('«widget.mide» debe ser { medida: cálculo }');
      for (const [k, v] of Object.entries(esObjeto(x.mide) ? x.mide : {})) {
        const o = def.observables[k];
        if (!o) e(`«widget.mide.${k}»: el esquema ${def.nombre} mide ${lista}`);
        else if (o.analisis === 'tran') e(`«widget.mide.${k}» es una curva frente al tiempo: póngala en una curva de «grafica» («mide: ${k}»)`);
        else if (o.analisis === 'ac' && !tiene('f')) e(`«widget.mide.${k}» se mide en alterna: el esquema necesita la pieza «f» (frecuencia)`);
        else if (o.requiere?.some((q) => !tiene(q))) e(`«widget.mide.${k}» necesita la pieza ${o.requiere.filter((q) => !tiene(q)).join(', ')}`);
        if (typeof v !== 'string' || !enModelo(v)) e(`«widget.mide.${k}»: «${String(v)}» no está en el modelo`);
        else if (o) mide[k] = v;
      }
      if (!Object.keys(mide).length && !w.grafica?.curvas.some((c) => c.mide))
        e(`«widget.mide»: qué cálculo del modelo da cada medida del esquema (${lista}), o una curva con «mide», para comprobarlo con el simulador`);
      medidas.set(w, mide);
      for (const k of Object.keys(x)) if (!['tipo', 'esquema', 'piezas', 'lectura', 'barras', 'datos', 'corriente', 'mandos', 'ocultar', 'mide', 'grafica', 'dibujo'].includes(k)) e(`«widget.${k}»: clave desconocida`);
      return w;
    }
    if (x.tipo === 'grafica') {
      const g = graficaDe(x, 'widget', mandos, t, e, antesWidget, null);
      if (!g) return null;
      const w: WidgetGrafica = { tipo: 'grafica', x: g.x, y: g.y, curvas: g.curvas, asas: g.asas, ...(g.marcas ? { marcas: g.marcas } : {}), mandos, ocultar };
      if (x.lectura != null) w.lectura = lecturaDe(x.lectura, 'widget.lectura', e) ?? undefined;
      if (Array.isArray(x.datos)) w.datos = x.datos.map((d, k) => lecturaDe(d, `widget.datos ${k + 1}`, e)).filter((d): d is Lectura => !!d);
      for (const k of Object.keys(x)) if (!['tipo', 'x', 'y', 'curvas', 'asas', 'marcas', 'mandos', 'lectura', 'datos', 'ocultar'].includes(k)) e(`«widget.${k}»: clave desconocida`);
      return w;
    }
    e('«widget.tipo» debe ser circuito o grafica');
    return null;
  }

  /** The plot of a `grafica` widget or of a circuit's `grafica` (then its curves may measure the schematic). */
  function graficaDe(x: unknown, d: string, mandos: Mando[], t: Tarjeta, e: (m: string) => void, antesWidget: number, def: DefinicionEsquema | null, piezasDe: (q: string) => boolean = () => false): Grafica | null {
    if (!esObjeto(x)) {
      e(`«${d}» debe ser { x, y, curvas… }`);
      return null;
    }
    const eje = (o: unknown, de: string, conId: boolean): Grafica['x'] | Grafica['y'] | null => {
      if (!esObjeto(o) || !esNumero(o.min) || !esNumero(o.max) || !(o.min < o.max)) {
        e(`«${d}.${de}»: { ${conId ? 'id, ' : ''}min, max, unidad, rotulo } con min < max`);
        return null;
      }
      if (conId && (typeof o.id !== 'string' || !ID.test(o.id) || enModelo(o.id))) e(`«${d}.${de}.id»: un nombre que no esté en el modelo («t»)`);
      if (o.escala != null && o.escala !== 'log' && o.escala !== 'lineal') e(`«${d}.${de}.escala»: lineal o log`);
      if (o.escala === 'log' && !(o.min > 0)) e(`«${d}.${de}»: un eje logarítmico empieza por encima de 0`);
      for (const k of Object.keys(o)) if (!['id', 'min', 'max', 'unidad', 'rotulo', 'escala'].includes(k)) e(`«${d}.${de}.${k}»: clave desconocida`);
      return { id: conId ? String(o.id) : undefined, min: o.min, max: o.max, unidad: typeof o.unidad === 'string' ? o.unidad : '', rotulo: analizarTexto(String(o.rotulo ?? '')), ...(o.escala === 'log' ? { escala: 'log' as const } : {}) };
    };
    const ex = eje(x.x, 'x', true);
    const ey = eje(x.y, 'y', false);
    if (!ex || !ey) return null;
    const xid = ex.id!;
    const analisis = new Set<string>();
    const curvas: Curva[] = (Array.isArray(x.curvas) ? x.curvas : []).map((c, k) => {
      const o = esObjeto(c) ? c : {};
      variables(`${d}.curvas ${k + 1}`, o.expr, [xid]);
      const color = typeof o.color === 'string' ? o.color : 'azul';
      if (![...COLORES, 'tinta'].includes(color)) e(`${d}.curvas ${k + 1}: color ${color}`);
      const cv: Curva = { expr: String(o.expr ?? ''), color: color as Curva['color'], rotulo: analizarTexto(String(o.rotulo ?? '')), discontinua: o.discontinua === true };
      if (o.mide != null) {
        const ob = def && typeof o.mide === 'string' ? def.observables[o.mide] : undefined;
        if (ob?.requiere?.some((q) => !piezasDe(q))) e(`${d}.curvas ${k + 1}: «${String(o.mide)}» necesita la pieza ${ob.requiere.filter((q) => !piezasDe(q)).join(', ')}`);
        if (!def) e(`${d}.curvas ${k + 1}: «mide» solo en la gráfica de un circuito`);
        else if (!ob || ob.analisis === 'op') e(`${d}.curvas ${k + 1}: «mide» es una curva del esquema ${def.nombre}: ${Object.entries(def.observables).filter(([, v]) => v.analisis !== 'op').map(([n]) => n).join(', ') || '(no tiene)'}`);
        else {
          analisis.add(ob.analisis);
          cv.mide = String(o.mide);
        }
      }
      for (const q of Object.keys(o)) if (!['expr', 'color', 'rotulo', 'discontinua', 'mide'].includes(q)) e(`${d}.curvas ${k + 1}.${q}: clave desconocida`);
      return cv;
    });
    if (!curvas.length) e(`«${d}.curvas»: al menos una`);
    if (analisis.size > 1) e(`«${d}»: curvas frente al tiempo y frente a la frecuencia en la misma gráfica`);
    if (analisis.has('tran') && ex.min < 0) e(`«${d}.x»: el tiempo empieza en 0 o después`);
    if (analisis.has('tran') && def?.tran?.periodos && !def.piezas.f) e(`«${d}»: el esquema necesita la pieza «f»`);
    if (analisis.has('ac') && !(ex.min > 0)) e(`«${d}.x»: la frecuencia empieza por encima de 0`);
    const asas: Asa[] = (Array.isArray(x.asas) ? x.asas : []).map((a, k) => {
      const o = esObjeto(a) ? a : {};
      if (typeof o.mueve !== 'string' || !mandos.some((m) => m.valor === o.mueve && m.tipo === 'deslizador')) e(`${d}.asas ${k + 1}: «mueve» debe ser un valor con deslizador en esta tarjeta`);
      variables(`${d}.asas ${k + 1}.x`, o.x);
      variables(`${d}.asas ${k + 1}.y`, o.y);
      return { mueve: String(o.mueve ?? ''), x: String(o.x ?? ''), y: String(o.y ?? ''), rotulo: analizarTexto(String(o.rotulo ?? o.mueve ?? '')) };
    });
    const marcas: Marca[] = (Array.isArray(x.marcas) ? x.marcas : []).map((a, k) => {
      const o = esObjeto(a) ? a : {};
      variables(`${d}.marcas ${k + 1}.x`, o.x);
      variables(`${d}.marcas ${k + 1}.y`, o.y);
      const rot = analizarTexto(String(o.rotulo ?? ''));
      if (!rot.length) e(`${d}.marcas ${k + 1}: falta «rotulo»`);
      for (const v of valoresDeTexto(rot)) if (!enModelo(v)) e(`${d}.marcas ${k + 1}.rotulo: {{${v}}} no está en el modelo`);
      if (contarPalabras(rot) > MAX_PALABRAS_ROTULO) e(`${d}.marcas ${k + 1}.rotulo: más de ${MAX_PALABRAS_ROTULO} palabras`);
      for (const q of Object.keys(o)) if (!['x', 'y', 'rotulo', 'guias'].includes(q)) e(`${d}.marcas ${k + 1}.${q}: clave desconocida`);
      return { x: String(o.x ?? ''), y: String(o.y ?? ''), rotulo: rot, guias: o.guias !== false };
    });
    if (x.marcas != null && !Array.isArray(x.marcas)) e(`«${d}.marcas» es una lista`);
    // the curves must be numbers over the axis with the card's values
    if (errores.length === antesWidget) {
      const st = mc.evaluar({ ...propios, ...t.inicio, ...t.fijar });
      const enEje = (j: number) => (ex.escala === 'log' ? ex.min * (ex.max / ex.min) ** (j / 8) : ex.min + ((ex.max - ex.min) * j) / 8);
      for (const [k, c] of curvas.entries()) {
        const f = mc.funcion(c.expr);
        for (let j = 0; j <= 8; j++) {
          const y = f({ ...st, [xid]: enEje(j) });
          if (!Number.isFinite(y)) {
            e(`${d}.curvas ${k + 1}: no da un número en ${xid} = ${enEje(j)}`);
            break;
          }
        }
      }
    }
    return { x: ex as Grafica['x'], y: ey, curvas, asas, ...(marcas.length ? { marcas } : {}) };
  }
}
