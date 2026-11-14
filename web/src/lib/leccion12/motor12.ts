// 1.2 step types: the rules of each card as the reader goes through it — its fresh state, when it can be checked,
// what a check concludes and says, when «Continuar» opens (an «ajuste» inside its band; an optional «banco» always),
// and the values it lays over the widget (the hidden fault of an «averia»). lib/leccion11/motor.ts calls these for a
// card with `actividad`, so the shell (Leccion11.svelte, TarjetaPractica.svelte), the learning events, the XP and the
// requeue of missed cards work the same for every type. Pure.

import { enRango, formatear, type ModeloCompilado, type Valores } from '../leccion11/modelo';
import type { Condicion, Tarjeta, Texto } from '../leccion11/tipos';
import { acierta, falloDeRonda, porQueNo } from './averia';
import { semillaNueva } from './azar';
import { cobertura, compararDibujo, curvaDe } from './dibujo';
import { diagnosticar, errorRelativo } from './prediccion';
import { compararResultados, rellenarPlantilla, unirClausulas } from './sql/ejecutar';
import { analizarDiseno } from './tolerancias';
import { comprobarDigital, esActividadDigital, nuevoEstadoDigital, puedeComprobarDigital, reintentarDigital } from './digital/motor-digital';
import type { EstadoActividadDigital } from './digital/tipos';
import type { Actividad12, Averia, EstadoActividad12, EstadoAveria, EstadoBanco, EstadoDibujar, EstadoSimular, EstadoSql } from './tipos';

const T = (s: string): Texto => [{ t: 'txt', s }];
const pc = (x: number) => formatear({ sim: [], nombre: '', unidad: '%', cifras: 2, recortar: true }, x * 100);

export function nuevoEstadoActividad(t: Tarjeta): EstadoActividad12 | undefined {
  const a = t.actividad;
  if (!a) return undefined;
  // motor12c: the steps on a figure or a logic circuit (lib/leccion12/digital/motor-digital.ts)
  if (esActividadDigital(a)) return nuevoEstadoDigital(t, a);
  switch (a.tipo) {
    case 'simular':
      return { tipo: 'simular', texto: '', valor: null } satisfies EstadoSimular;
    case 'averia':
      // (fija: the first fault of the list; azar: a different draw each time the card is opened or asked again)
      return { tipo: 'averia', fallo: falloDeRonda(a, t.id, 0, a.eleccion === 'azar' ? semillaNueva() : undefined), ronda: 0, medidas: [], sospechoso: null, tipoElegido: null, descartados: [] } satisfies EstadoAveria;
    case 'banco':
      return { tipo: 'banco', texto: '', valor: null, comparado: false } satisfies EstadoBanco;
    case 'dibujar':
      return { tipo: 'dibujar', ys: Array.from({ length: a.puntos }, () => null), punto: 0 } satisfies EstadoDibujar;
    case 'sql':
      return {
        tipo: 'sql',
        texto: a.modo === 'consulta' ? (a.inicial ?? '') : '',
        huecos: (a.huecos ?? []).map(() => ''),
        orden: a.inicio ? [...a.inicio] : [],
        ejecutado: null,
      } satisfies EstadoSql;
    default:
      return { tipo: a.tipo };
  }
}

/** The step types that are answered (checked, reported, practised): all but «ajuste» and the optional «banco». */
export function esComprobable12(a: Actividad12): boolean {
  return a.tipo !== 'ajuste' && a.tipo !== 'banco';
}

/** The query a SQL card's state stands for. */
export function consultaDe(a: Actividad12 & { tipo: 'sql' }, e: EstadoSql): string {
  if (a.modo === 'rellenar') return rellenarPlantilla(a.plantilla ?? '', e.huecos);
  if (a.modo === 'ordenar') return unirClausulas(a.clausulas ?? [], e.orden);
  return e.texto;
}

export function puedeComprobar12(t: Tarjeta, e: EstadoActividad12 | undefined): boolean {
  const a = t.actividad;
  if (!a || !e) return false;
  if (esActividadDigital(a)) return puedeComprobarDigital(a, e as EstadoActividadDigital);
  if (a.tipo === 'simular' && e.tipo === 'simular') return e.valor != null && Number.isFinite(e.valor);
  if (a.tipo === 'averia' && e.tipo === 'averia') return e.sospechoso != null && (!a.preguntarTipo || e.tipoElegido != null);
  if (a.tipo === 'dibujar' && e.tipo === 'dibujar') return cobertura(e.ys) >= 0.5;
  if (a.tipo === 'sql' && e.tipo === 'sql') {
    if (a.modo === 'ordenar') return true;
    if (a.modo === 'rellenar' && e.huecos.some((h) => !h.trim())) return false;
    // (the reader runs it first and sees the result: what is checked is that run)
    return !!e.ejecutado && e.ejecutado.texto === consultaDe(a, e) && !!e.ejecutado.resultado;
  }
  return a.tipo === 'diseno';
}

export interface Veredicto12 {
  bien: boolean;
  textos: Texto[];
  /** The card counts as done whatever the verdict («simular»: the point is seeing the simulation). */
  resuelta?: boolean;
  /** Changes to the activity's state (a wrong suspect crossed out). */
  estado?: EstadoActividad12;
}

/** Checks the activity with the card's values `v` (the controls', with the fault of an «averia» NOT applied). */
export function comprobar12(mc: ModeloCompilado, t: Tarjeta, e: EstadoActividad12 | undefined, v: Valores): Veredicto12 {
  const a = t.actividad!;
  if (esActividadDigital(a)) return comprobarDigital(t, a, e as EstadoActividadDigital | undefined);
  const exito = t.exito ? [t.exito] : [];
  const pista = (estado: Valores) => (t.pistas ?? []).find((p) => !p.cuando || enRango(p.cuando, estado))?.texto;
  if (a.tipo === 'simular' && e?.tipo === 'simular') {
    const x = e.valor ?? NaN;
    const d = diagnosticar(mc, a, v, x);
    const obj = mc.funcion(a.objetivo)(mc.evaluar(v));
    const linea = T(`Su estimación: ${formatear({ sim: [], nombre: '', unidad: a.unidad, cifras: a.cifras, recortar: true }, x)}. El modelo: ${formatear({ sim: [], nombre: '', unidad: a.unidad, cifras: a.cifras, recortar: false }, obj)} (error del ${pc(errorRelativo(x, obj))}).`);
    const p = d.bien ? null : pista({ ...mc.evaluar(v), estimacion: x });
    return { bien: d.bien, resuelta: true, textos: [linea, ...(d.bien ? exito : [d.texto ?? p ?? T('Se ha alejado bastante: rehaga el cálculo paso a paso.')])] };
  }
  if (a.tipo === 'diseno') {
    const conds: Condicion[] = t.condiciones ?? [];
    const inf = analizarDiseno(mc, a, conds, v);
    const c0 = conds[0];
    const mag = c0 ? mc.magnitud(c0.valor) : null;
    const rg = inf.rangos[0];
    const resumen = rg
      ? T(`Nominal: ${formatear(mag, rg.nominal)}${inf.nominal ? '' : ' (no cumple)'}. Con las tolerancias, de ${formatear(mag, rg.min)} a ${formatear(mag, rg.max)}: cumplen ${inf.cumplen} de ${inf.placas} ${a.metodo === 'esquinas' ? 'esquinas' : 'placas'}.`)
      : T('');
    if (inf.pasa) return { bien: true, textos: [resumen, ...exito] };
    const r = mc.evaluar(v);
    const extra = !inf.nominal ? pista(r) : a.siTolerancias ?? T('El valor nominal cumple, pero con las tolerancias de las piezas no siempre: busque valores que dejen más margen.');
    return { bien: false, textos: [resumen, ...(extra ? [extra] : [])] };
  }
  if (a.tipo === 'averia' && e?.tipo === 'averia') {
    const real = a.fallos[e.fallo]!;
    const vf = { ...v };
    if (acierta(a, real, e.sospechoso, e.tipoElegido)) return { bien: true, textos: [real.texto, ...exito] };
    if (e.sospechoso === real.pieza) return { bien: false, textos: [T('La pieza es esa, pero su avería es otra: mire qué miden los puntos de alrededor.')], estado: { ...e, tipoElegido: null } };
    const por = porQueNo(mc, a, vf, real, e.sospechoso ?? '', e.medidas);
    const p = pista(mc.evaluar(v));
    return { bien: false, textos: [por, ...(p ? [p] : [])], estado: { ...e, descartados: e.sospechoso && !e.descartados.includes(e.sospechoso) ? [...e.descartados, e.sospechoso] : e.descartados, sospechoso: null, tipoElegido: null } };
  }
  if (a.tipo === 'dibujar' && e?.tipo === 'dibujar') {
    const c = compararDibujo(a, e.ys, curvaDe(mc, a, v));
    const linea = T(`Diferencia con la curva: ${pc(c.error)} de la altura del eje (vale hasta un ${pc(a.tol)}).`);
    if (c.bien) return { bien: true, textos: [linea, ...exito] };
    const p = pista({ ...mc.evaluar(v), error: c.error, amplitud: c.amplitud, media: c.media, desfase: c.desfase });
    const auto =
      Math.abs(c.amplitud - 1) > 0.25 ? T(c.amplitud > 1 ? 'Su curva sube y baja más de lo que debe: revise la amplitud.' : 'Su curva se queda corta: revise la amplitud.')
        : Math.abs(c.media) > a.holgura ? T(c.media > 0 ? 'Su curva está desplazada hacia arriba: revise el valor medio.' : 'Su curva está desplazada hacia abajo: revise el valor medio.')
          : T('La forma no es la buena: fíjese en dónde cruza y dónde tiene los máximos.');
    return { bien: false, textos: [linea, p ?? auto] };
  }
  if (a.tipo === 'sql' && e?.tipo === 'sql') {
    if (a.modo === 'ordenar') {
      const bien = e.orden.every((x, k) => x === k);
      const n = e.orden.filter((x, k) => x === k).length;
      return { bien, textos: bien ? exito : [...(pista({}) ? [pista({})!] : [T('Las cláusulas van en este orden: SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.')]), T(`${n} de ${e.orden.length} en su sitio.`)] };
    }
    const r = e.ejecutado?.resultado;
    if (!r) return { bien: false, textos: [T('Ejecute la consulta antes de comprobarla.')] };
    const d = compararResultados(r, a.esperado, a.ordenado, e.ejecutado?.total ?? r.filas.length);
    if (d.bien) return { bien: true, textos: exito };
    const p = pista({});
    return { bien: false, textos: [T(d.texto), ...(p ? [p] : [])] };
  }
  return { bien: false, textos: [] };
}

/** Values the activity lays over the card's (the hidden fault: the living circuit shows the faulty board). */
export function sobrescritos(t: Tarjeta, e: EstadoActividad12 | undefined): Valores {
  const a = t.actividad;
  if (a?.tipo === 'averia' && e?.tipo === 'averia') return { ...(a.fallos[e.fallo]?.con ?? {}) };
  return {};
}

/** «Continuar» of a card that is not answered: an «ajuste» opens inside its band; the optional «banco», always. */
export function exploracion12(t: Tarjeta, r: Valores): boolean {
  const a = t.actividad;
  if (a?.tipo === 'ajuste') return enRango(a.banda, r);
  return true;
}

export function falta12(t: Tarjeta): string {
  const a = t.actividad;
  if (a?.tipo === 'ajuste') return 'Para seguir, lleve la medida a su banda.';
  return '';
}

/** Where an «ajuste» stands: below, inside or above its band. */
export function ladoAjuste(a: Actividad12 & { tipo: 'ajuste' }, r: Valores): 'bajo' | 'dentro' | 'alto' {
  const x = r[a.banda.valor] ?? NaN;
  if (enRango(a.banda, r)) return 'dentro';
  // (an open band has one side only: motor12e)
  return a.banda.min != null && x < a.banda.min ? 'bajo' : 'alto';
}

/** «Volver a intentarlo»: what stays (the probes taken, the drawing, the query) and what goes. */
export function reintentar12(e: EstadoActividad12 | undefined): EstadoActividad12 | undefined {
  if (e?.tipo === 'averia') return { ...e, sospechoso: null, tipoElegido: null };
  if (e && esActividadDigital(e)) return reintentarDigital(e as EstadoActividadDigital);
  return e;
}

/** Another board with another fault (after one is found; nothing more is reported). */
export function otraAveria(a: Averia, id: string, e: EstadoAveria, semilla?: number): EstadoAveria {
  const ronda = e.ronda + 1;
  return { tipo: 'averia', fallo: falloDeRonda(a, id, ronda, semilla), ronda, medidas: [], sospechoso: null, tipoElegido: null, descartados: [] };
}
