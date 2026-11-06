// The three PDFs of «modo docente» (1.0), as document models for maquetar.ts: the exam (statements, data, points,
// room to answer, a heading with the title, the date and a line for the name), its solutions (the answers and the
// book's development of each item) and a course outline. Only book content: statements, solutions, quotes and
// formulas come from the book's files; the app adds headings, the item numbers and points, and fixed phrases.

import type { Bloque } from '../../tipos';
import type { ItemEjercicio } from '../../ejercicios.svelte';
import { respuestaCorrecta, type Pregunta as PreguntaEjercicio } from '../../preguntas-ejercicio';
import { enunciadoDe, textoCorrecto, textoPide, valorTexto } from '../../../componentes/practica/variantes';
import { exprLinea } from '../../../componentes/calculadoras/mates';
import { esperadoVariante, preguntaVista, textoPuntos, varianteDe, type ContextoExamen, type ExamenMontado, type ItemMontado } from '../examen';
import type { ElementoCurso, EspacioRespuesta } from '../tipos';
import { TEXTO, deHtml, texto, type BloquePdf, type Documento, type EstiloTexto, type Trozo } from './maquetar';

/** The book data a document needs, already loaded (lib/docente/fuentes.ts). */
export interface LibroPdf extends ContextoExamen {
  /** An exercise's statement and solution blocks (problems: from the h3 to «Se pide», and the analysis after it). */
  bloques(label: string): { enunciado: Bloque[]; solucion: Bloque[] } | undefined;
  /** «Capítulo 5 · Diodos — …» */
  rotulo(parte: string): string;
  seccion(parte: string, label: string): { num: string | null; titulo: string } | undefined;
}

const SANS: Partial<EstiloTexto> = { familia: 'sans' };
const LETRAS = 'ABCDEFGHIJ';

const titulo = (s: string): BloquePdf => ({ k: 'parrafo', trozos: texto(s, { ...SANS, negrita: true, tam: 17 }), antes: 0, conSiguiente: true, interlinea: 1.2 });
const subtitulo = (s: string): BloquePdf => ({ k: 'parrafo', trozos: texto(s, { ...SANS, tam: 10, color: [0.25, 0.25, 0.25] }), antes: 2 });
const rotuloItem = (s: string, extra = ''): BloquePdf => ({
  k: 'parrafo',
  trozos: [...texto(s, { ...SANS, negrita: true, tam: 11.5 }), ...(extra ? texto(`  ${extra}`, { ...SANS, tam: 9, color: [0.3, 0.3, 0.3] }) : [])],
  antes: 16,
  conSiguiente: true,
});
const etiquetaSeccion = (s: string): BloquePdf => ({ k: 'parrafo', trozos: texto(s, { ...SANS, negrita: true, tam: 9.5, color: [0.2, 0.2, 0.2] }), antes: 8, conSiguiente: true });

/** The book's blocks as PDF blocks. */
export function deBloques(bs: Bloque[], sangria = 0, tam = TEXTO.tam): BloquePdf[] {
  const base: EstiloTexto = { ...TEXTO, tam };
  const r: BloquePdf[] = [];
  for (const b of bs) {
    switch (b.t) {
      case 'p':
        r.push({ k: 'parrafo', trozos: deHtml(b.html, base), sangria, antes: 5 });
        break;
      case 'h2':
      case 'h3':
      case 'h4':
        r.push({ k: 'parrafo', trozos: deHtml(b.html, { ...base, familia: 'sans', negrita: true }), sangria, antes: 9, conSiguiente: true });
        break;
      case 'centrado':
        r.push({ k: 'parrafo', trozos: deHtml(b.html, base), alinear: 'centro', antes: 5 });
        break;
      case 'lista': {
        const s = sangria + 16 + 14 * (b.nivel ?? 0);
        b.items.forEach((it, k) =>
          r.push({ k: 'parrafo', trozos: deHtml(it, base), sangria: s, etiqueta: texto(b.ordenada ? `${(b.inicio ?? 1) + k}.` : '•', { tam }), antes: k === 0 ? 4 : 2 }),
        );
        break;
      }
      case 'tabla': {
        const t9: EstiloTexto = { ...base, tam: Math.min(tam, 9.2) };
        r.push({
          k: 'tabla',
          filas: b.filas.map((f, i) => f.map((c) => deHtml(c, b.cabecera && i === 0 ? { ...t9, negrita: true } : t9))),
          align: (b.align ?? []).map((a) => (a === 'center' || a === 'right' ? a : 'left')),
          cabecera: !!b.cabecera,
          pie: b.num || b.pie ? [...texto(b.num ? `Tabla ${b.num}${b.pie ? ' — ' : ''}` : '', { ...SANS, negrita: true, tam: 8.8 }), ...deHtml(b.pie ?? '', { ...base, familia: 'sans', tam: 8.8 })] : undefined,
          sangria,
        });
        break;
      }
      case 'ec':
        r.push({ k: 'ecuacion', src: b.svg, w: b.w, h: b.h, etiqueta: b.etiqueta ? deHtml(b.etiqueta, base) : undefined, sangria });
        break;
      case 'figura':
        r.push({
          k: 'figura',
          src: b.src,
          ancho: b.ancho ?? 0.8,
          pie: [...texto(b.num ? `Figura ${b.num}${b.pie ? ' — ' : ''}` : '', { ...SANS, negrita: true, tam: 8.8 }), ...deHtml(b.pie ?? '', { ...base, familia: 'sans', tam: 8.8 })],
          vista: b.svg_vista?.length === 4 ? (b.svg_vista as [number, number, number, number]) : undefined,
          tam: b.img_tam?.length === 2 ? (b.img_tam as [number, number]) : undefined,
        });
        break;
      case 'codigo':
        r.push({ k: 'codigo', lineas: b.texto.replace(/\n$/, '').split('\n') });
        break;
      case 'caja':
      case 'tarjeta':
      case 'deduccion': {
        const cab = b.t === 'deduccion' ? deHtml(b.titulo, { ...base, familia: 'sans', negrita: true }) : b.t === 'caja' ? texto(NOMBRE_CAJA[b.tipo] ?? 'Nota', { ...SANS, negrita: true, tam }) : [];
        if (cab.length) r.push({ k: 'parrafo', trozos: cab, sangria: sangria + 10, antes: 7, conSiguiente: true });
        r.push(...deBloques(b.bloques, sangria + 10, tam));
        break;
      }
      default:
        break;
    }
  }
  return r;
}

const NOMBRE_CAJA: Record<string, string> = { nota: 'Nota', importante: 'Importante', precaucion: 'Precaución', ejemplo: 'Ejemplo', comprobacion: 'Comprobación' };

const LINEAS: Record<EspacioRespuesta, number> = { no: 0, corto: 4, largo: 10 };

const linea = (n = 18) => '_'.repeat(n);

function nombreItem(m: Pick<ItemMontado, 'k' | 'ref'>, libro: LibroPdf): { nombre: string; donde: string } {
  if (m.k === 'pregunta') {
    const p = libro.pregunta(m.ref);
    const parte = m.ref.replace(/-\d+$/, '');
    return { nombre: `Pregunta de test ${Number(/-(\d+)$/.exec(m.ref)?.[1] ?? 0)}`, donde: `${libro.rotulo(parte)}${p ? ` · ${p.ref_tipo} ${p.ref_num ?? ''}`.trimEnd() : ''}` };
  }
  const e = libro.ejercicio(m.ref);
  return { nombre: e ? `${e.tipo === 'prob' ? 'Problema' : 'Ejercicio'} ${e.num}` : m.ref, donde: e ? libro.rotulo(e.parte) : '' };
}

const puntos = (p: number) => `${textoPuntos(p)} ${p === 1 ? 'punto' : 'puntos'}`;

/** The structured question as it is printed: the statement and what to fill in. */
function preguntaImpresa(p: PreguntaEjercicio, n: number): BloquePdf[] {
  const r: BloquePdf[] = [{ k: 'parrafo', trozos: [...texto(`${String.fromCharCode(97 + n)}) `, { negrita: true }), ...deHtml(p.enunciado)], antes: 7 }];
  switch (p.tipo) {
    case 'eleccion':
      p.opciones.forEach((o, k) => r.push({ k: 'parrafo', trozos: deHtml(o), sangria: 30, etiqueta: texto(`☐ ${LETRAS[k]})`), antes: 2 }));
      break;
    case 'orden':
      r.push({ k: 'parrafo', trozos: texto('Escriba el orden (1, 2, 3…) junto a cada paso:', { cursiva: true }), sangria: 16, antes: 3 });
      p.mezcla.forEach((i, k) => r.push({ k: 'parrafo', trozos: deHtml(p.elementos[i]!), sangria: 46, etiqueta: texto(`${'_'.repeat(4)}  ${LETRAS[k]})`), antes: 2 }));
      break;
    case 'clasificar':
      r.push({ k: 'parrafo', trozos: [...texto('Clasifique cada elemento: ', { cursiva: true }), ...deHtml(p.categorias.join(' / '), { ...TEXTO, negrita: true })], sangria: 16, antes: 3 });
      p.elementos.forEach((e, k) => r.push({ k: 'parrafo', trozos: [...deHtml(e.texto), ...texto(`   ${linea(14)}`)], sangria: 30, etiqueta: texto(`${k + 1}.`), antes: 2 }));
      break;
    case 'exacta':
    case 'logica':
      r.push({ k: 'parrafo', trozos: texto(`Respuesta: ${linea(30)}`), sangria: 16, antes: 4 });
      break;
    case 'combinacion':
      r.push({ k: 'parrafo', trozos: texto(`R₁ = ${linea(10)}   R₂ = ${linea(10)}   ☐ en serie   ☐ en paralelo`), sangria: 16, antes: 4 });
      break;
  }
  return r;
}

const ESPACIO_CAMPO = ' ';

/** One item of the exam paper. */
function itemExamen(m: ItemMontado, libro: LibroPdf, espacio: EspacioRespuesta): BloquePdf[] {
  const { nombre, donde } = nombreItem(m, libro);
  const r: BloquePdf[] = [rotuloItem(`${m.n}. ${nombre} (${puntos(m.puntos)})`, donde)];
  if (m.k === 'pregunta') {
    const p = libro.pregunta(m.ref);
    if (!p) return r;
    r.push({ k: 'parrafo', trozos: deHtml(p.enunciado), antes: 5 });
    if (p.tipo === 'opcion') {
      const orden = m.orden ?? p.opciones.map((_, k) => k);
      orden.forEach((k, i) => r.push({ k: 'parrafo', trozos: deHtml(p.opciones[k]!), sangria: 30, etiqueta: texto(`☐ ${LETRAS[i]})`), antes: 2 }));
    } else r.push({ k: 'parrafo', trozos: texto(`Respuesta: ${linea(16)}${ESPACIO_CAMPO}${p.unidad}`), sangria: 16, antes: 5 });
    return r;
  }
  const e = libro.ejercicio(m.ref);
  const bl = libro.bloques(m.ref);
  const vr = varianteDe(m, libro);
  if (vr) {
    // the exercise's own statement with this variant's values
    r.push({ k: 'parrafo', trozos: deHtml(enunciadoDe(vr.item, vr.v)), antes: 5 });
    const esp = esperadoVariante(vr.item, vr.v);
    // final QA 1.0: what is asked, as the practice says it («solo» when the book's exercise asks more)
    r.push({ k: 'parrafo', trozos: [...texto(`${textoPide(vr.item)} `), ...deHtml(esp.nombre, { ...TEXTO, negrita: true })], antes: 4 });
    r.push({ k: 'parrafo', trozos: [...deHtml(esp.nombre, { ...TEXTO, negrita: true }), ...texto(`: ${linea(16)}${ESPACIO_CAMPO}${esp.unidad}`)], sangria: 16, antes: 6 });
  } else {
    if (bl) r.push(...deBloques(bl.enunciado));
    if (e) {
      if (e.respuestas.length) r.push(etiquetaSeccion('Resultados'));
      for (const x of e.respuestas)
        r.push({ k: 'parrafo', trozos: [...deHtml(x.nombre, { ...TEXTO, negrita: true }), ...texto(`: ${linea(16)}${x.unidad ? ESPACIO_CAMPO + x.unidad : ''}`)], sangria: 16, antes: 4 });
      (e.preguntas ?? []).forEach((p, k) => r.push(...preguntaImpresa(preguntaVista(p, m.opciones?.[p.id]), k)));
    }
  }
  const abierta = !vr && e && (e.modo === 'comparar' || (e.otras?.length ?? 0) > 0);
  const lineas = abierta ? LINEAS[espacio] + (espacio === 'no' ? 0 : 2) : LINEAS[espacio];
  if (lineas) r.push({ k: 'espacio', lineas, reglado: true });
  return r;
}

export interface OpcionesExamen {
  titulo: string;
  notas: string;
  /** The date printed in the heading («6 de noviembre de 2026»), or empty for a blank line. */
  fecha: string;
  espacio: EspacioRespuesta;
  /** Fixed metadata date (ms). */
  creado: number;
}

const cabeceraExamen = (ex: ExamenMontado, o: OpcionesExamen, extra: string): BloquePdf[] => [
  titulo(o.titulo || 'Examen'),
  subtitulo(
    [
      extra,
      `Variante ${ex.letra}`,
      `${ex.items.length} ${ex.items.length === 1 ? 'pregunta' : 'preguntas'}`,
      puntos(ex.maximo),
      ex.minutos ? `${ex.minutos} minutos` : 'sin límite de tiempo',
    ].join(' · '),
  ),
];

export function documentoExamen(ex: ExamenMontado, libro: LibroPdf, o: OpcionesExamen): Documento {
  const bloques: BloquePdf[] = [
    ...cabeceraExamen(ex, o, 'Examen'),
    { k: 'campos', campos: [{ rotulo: 'Nombre:', ancho: 3 }, { rotulo: o.fecha ? `Fecha: ${o.fecha}` : 'Fecha:', ancho: o.fecha ? 0.0001 : 1 }] },
    { k: 'campos', campos: [{ rotulo: 'Calificación:', ancho: 1 }] },
  ];
  if (o.notas.trim()) bloques.push({ k: 'parrafo', trozos: texto(o.notas.trim(), { cursiva: true }), antes: 8 });
  bloques.push({ k: 'regla', antes: 10 });
  for (const m of ex.items) bloques.push(...itemExamen(m, libro, o.espacio));
  return { titulo: `${o.titulo || 'Examen'} — variante ${ex.letra}`, cabecera: `${o.titulo || 'Examen'} · Variante ${ex.letra}`, bloques, fecha: o.creado, asunto: 'Examen' };
}

/** The answers and the book's development of one item. */
function itemSoluciones(m: ItemMontado, libro: LibroPdf): BloquePdf[] {
  const { nombre, donde } = nombreItem(m, libro);
  const r: BloquePdf[] = [rotuloItem(`${m.n}. ${nombre} (${puntos(m.puntos)})`, donde)];
  if (m.k === 'pregunta') {
    const p = libro.pregunta(m.ref);
    if (!p) return r;
    r.push({ k: 'parrafo', trozos: deHtml(p.enunciado, { ...TEXTO, cursiva: true }), antes: 4 });
    if (p.tipo === 'opcion') {
      const orden = m.orden ?? p.opciones.map((_, k) => k);
      const i = orden.indexOf(p.correcta);
      r.push({ k: 'parrafo', trozos: [...texto(`Respuesta: ${LETRAS[i]}) `, { negrita: true }), ...deHtml(p.opciones[p.correcta]!)], antes: 5 });
    } else r.push({ k: 'parrafo', trozos: texto(`Respuesta: ${p.valor_texto} ${p.unidad}`, { negrita: true }), antes: 5 });
    r.push({ k: 'parrafo', trozos: deHtml(p.explicacion), antes: 4 });
    r.push({ k: 'parrafo', trozos: [...texto(`Del libro · ${p.ref_tipo}${p.ref_num ? ` ${p.ref_num}` : ''}: `, { ...SANS, negrita: true, tam: 9.5 }), ...texto(`«${p.cita}»`, { cursiva: true })], antes: 4 });
    return r;
  }
  const e = libro.ejercicio(m.ref);
  const bl = libro.bloques(m.ref);
  const vr = varianteDe(m, libro);
  if (vr) {
    const esp = esperadoVariante(vr.item, vr.v);
    const f = vr.item.formula;
    r.push(etiquetaSeccion('Con los valores de esta variante'));
    r.push({ k: 'parrafo', trozos: deHtml(enunciadoDe(vr.item, vr.v), { ...TEXTO, cursiva: true }), antes: 4 });
    const sim = (id: string) => f.vars.find((x) => x.id === id)?.sim ?? id;
    const obj = vr.item.objetivo;
    const despeje = obj === f.resultado ? f.expr : f.despejes[obj];
    const ecuacion = despeje ? `${sim(obj)} = ${exprLinea(despeje, sim)}` : `${sim(f.resultado)} = ${exprLinea(f.expr, sim)}`;
    r.push({ k: 'parrafo', trozos: [...texto('Fórmula: ', { negrita: true }), ...deHtml(ecuacion)], antes: 5 });
    const datos = f.vars.filter((x) => x.id !== vr.item.objetivo && vr.v.valores[x.id] != null).map((x) => `${x.sim} = ${valorTexto(vr.v.valores[x.id]!, x.unidad)}`);
    if (datos.length) r.push({ k: 'parrafo', trozos: [...texto('Datos: ', { negrita: true }), ...deHtml(datos.join(', '))], antes: 4 });
    r.push({ k: 'parrafo', trozos: [...texto('Resultado: ', { negrita: true }), ...deHtml(`${esp.nombre} = ${textoCorrecto(esp)}`)], antes: 4 });
    r.push(etiquetaSeccion('Desarrollo del libro (con los valores del enunciado original)'));
  } else if (e) {
    if (bl) r.push(...deBloques(bl.enunciado, 0, 9.5).map((b) => (b.k === 'parrafo' ? { ...b, trozos: b.trozos.map((t) => (t.t === 'texto' ? { ...t, e: { ...t.e, color: [0.25, 0.25, 0.25] as [number, number, number] } } : t)) } : b)));
    if (e.respuestas.length) r.push(etiquetaSeccion('Resultados'));
    for (const x of e.respuestas) {
      const alt = x.alternativas.length ? ` (también vale: ${x.alternativas.map((a) => a.texto + (a.nota ? `, ${a.nota}` : '')).join('; ')})` : '';
      r.push({ k: 'parrafo', trozos: [...deHtml(x.nombre, { ...TEXTO, negrita: true }), ...texto(`: ${x.texto}${alt}`)], sangria: 16, antes: 3 });
    }
    (e.preguntas ?? []).forEach((p0, k) => {
      const p = preguntaVista(p0, m.opciones?.[p0.id]);
      const letra = p.tipo === 'eleccion' ? `${LETRAS[p.correcta]}) ` : '';
      r.push({ k: 'parrafo', trozos: [...texto(`${String.fromCharCode(97 + k)}) `, { negrita: true }), ...deHtml(p.enunciado, { ...TEXTO, cursiva: true })], antes: 6 });
      r.push({ k: 'parrafo', trozos: [...texto(`Respuesta: ${letra}`, { negrita: true }), ...deHtml(respuestaCorrecta(p))], sangria: 16, antes: 3 });
      if (p.explicacion) r.push({ k: 'parrafo', trozos: [...texto(p.calculo ? 'Desarrollo: ' : 'Del libro: ', { ...SANS, negrita: true, tam: 9.5 }), ...deHtml(p.explicacion)], sangria: 16, antes: 3 });
    });
    if (e.otras?.length) {
      r.push(etiquetaSeccion('Lo que se pide (para comparar con su respuesta)'));
      for (const o of e.otras) r.push({ k: 'parrafo', trozos: deHtml(o.texto), sangria: 16, etiqueta: texto('•'), antes: 2 });
    }
    r.push(etiquetaSeccion(e.tipo === 'prob' ? 'Análisis y resultado del libro' : `Solución ${e.num} del libro`));
  }
  if (bl?.solucion.length) r.push(...deBloques(bl.solucion));
  else r.push({ k: 'parrafo', trozos: texto('El libro no trae el desarrollo de este ejercicio.', { cursiva: true }), antes: 4 });
  return r;
}

export function documentoSoluciones(ex: ExamenMontado, libro: LibroPdf, o: OpcionesExamen): Documento {
  const bloques: BloquePdf[] = [...cabeceraExamen(ex, o, 'Soluciones'), { k: 'regla', antes: 10 }];
  for (const m of ex.items) bloques.push(...itemSoluciones(m, libro));
  return { titulo: `${o.titulo || 'Examen'} — soluciones, variante ${ex.letra}`, cabecera: `${o.titulo || 'Examen'} · Soluciones · Variante ${ex.letra}`, bloques, fecha: o.creado, asunto: 'Soluciones' };
}

/** A course's outline: its notes and its sections, exercises and questions in order. */
export function documentoCurso(c: { titulo: string; notas: string; elementos: ElementoCurso[]; creado: number }, libro: LibroPdf): Documento {
  const n = c.elementos.length;
  const bloques: BloquePdf[] = [titulo(c.titulo || 'Curso'), subtitulo(`Curso · ${n} ${n === 1 ? 'elemento' : 'elementos'}`)];
  if (c.notas.trim()) bloques.push({ k: 'parrafo', trozos: texto(c.notas.trim()), antes: 8 });
  bloques.push({ k: 'regla', antes: 10 });
  let parteAnterior = '';
  c.elementos.forEach((el, i) => {
    const parte = el.k === 'seccion' ? el.parte : el.k === 'ejercicio' ? (libro.ejercicio(el.label)?.parte ?? '') : el.id.replace(/-\d+$/, '');
    if (parte && parte !== parteAnterior) {
      bloques.push(rotuloItem(libro.rotulo(parte)));
      parteAnterior = parte;
    }
    let trozos: Trozo[];
    if (el.k === 'seccion') {
      const s = libro.seccion(el.parte, el.label);
      trozos = [...texto(`Sección ${s?.num ?? ''} `, { negrita: true }), ...deHtml(s?.titulo ?? el.label)];
    } else if (el.k === 'ejercicio') {
      const e = libro.ejercicio(el.label);
      trozos = [...texto(`${e?.tipo === 'prob' ? 'Problema' : 'Ejercicio'} ${e?.num ?? el.label}. `, { negrita: true }), ...deHtml(e?.titulo ? `${e.titulo}. ` : ''), ...deHtml(e?.resumen ?? '')];
    } else {
      const p = libro.pregunta(el.id);
      trozos = [...texto(`Pregunta de test ${Number(/-(\d+)$/.exec(el.id)?.[1] ?? 0)}. `, { negrita: true }), ...deHtml(p?.enunciado ?? '')];
    }
    bloques.push({ k: 'parrafo', trozos, sangria: 24, etiqueta: texto(`${i + 1}.`), antes: 4 });
  });
  return { titulo: c.titulo || 'Curso', cabecera: `${c.titulo || 'Curso'} · Índice del curso`, bloques, fecha: c.creado, asunto: 'Curso' };
}

/** The statement of an exercise as plain text (checks: it must be in the PDF's text). */
export function itemTexto(e: ItemEjercicio | undefined): string {
  return (e?.resumen ?? '').replace(/\s+/g, ' ').trim();
}
