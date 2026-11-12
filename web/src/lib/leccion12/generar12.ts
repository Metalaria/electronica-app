// 1.2 step types in the generator: from the author's YAML block of a card (`simular:`, `diseno:`, `averia:`,
// `ajuste:`, `banco:`, `dibujar:`, `sql:`) to the data the app loads (tipos.ts), checking it on the way
// (contenido/lecciones11/GUIA.md §10). lib/leccion11/generar.ts calls `actividadDe` for a card of one of these types,
// with the card's model, state and widget; what it returns joins the card's checks: its texts go through the numbers
// rule (book or model), its extra states through the ngspice cross-check of the circuit. Pure.

import { contarPalabras, valoresDeTexto } from '../leccion11/texto';
import { barajarFijo, enRango, type ModeloCompilado, type Valores } from '../leccion11/modelo';
import type { Eje, Mando, Rango, Tarjeta, Texto, Widget } from '../leccion11/tipos';
import { semillaDe } from './azar';
import { faltaSeparar, lecturas } from './averia';
import { xsDibujo } from './dibujo';
import { errorRelativo } from './prediccion';
import { NO_DETERMINISTA, rellenarPlantilla, unirClausulas, type Ejecucion } from './sql/ejecutar';
import { MAX_MUESTRAS, MAX_TOLERANCIAS, analizarDiseno } from './tolerancias';
import { actividadDigitalDe, type ContextoDigital } from './digital/generar-digital';
import { TIPOS_ACTIVIDAD, type Actividad12, type Ajuste, type Averia, type Banco, type Dibujar, type Diseno, type ErrorTipico, type Fallo, type Simular, type Sonda, type Sql, type TipoActividad } from './tipos';

export const MAX_PALABRAS_EXPLICACION = 40;
export const MAX_PALABRAS_OPCION = 20;
const TIPOS_FALLO = ['abierta', 'corto', 'alto', 'bajo', 'reves', 'base-abierta', 'valor'];

/** Labels of the cards' step («3 de 12 · Prediga y simule»). */
export const FASE12: Record<TipoActividad, string> = {
  simular: 'Prediga y simule',
  diseno: 'Diseñe',
  averia: 'Busque la avería',
  ajuste: 'Ajuste',
  banco: 'En el banco',
  dibujar: 'Dibuje',
  sql: 'SQL',
  tocar: 'Toque',
  tabla: 'Tabla de verdad',
};

export function esTipoActividad(x: unknown): x is TipoActividad {
  return typeof x === 'string' && (TIPOS_ACTIVIDAD as readonly string[]).includes(x);
}

/** Variables a hint's «cuando» may look at on each type, besides the model (what the reader did). */
export const VARIABLES_PISTA: Partial<Record<TipoActividad, string[]>> = {
  simular: ['estimacion'],
  dibujar: ['error', 'amplitud', 'media', 'desfase', 'tramos_mal'],
  // (motor12c: the steps on a figure or a logic circuit, lib/leccion12/digital/motor-digital.ts)
  tocar: ['mal', 'faltan'],
  tabla: ['error', 'filas_mal'],
  averia: ['medidas'],
  diseno: ['puertas'],
};

/** What the generator gives the step type's checks: the card as built so far and its helpers. */
export interface Contexto12 {
  /** «cap18/sec-new-18-datos/tarjeta» (seeds). */
  semilla: string;
  t: Tarjeta;
  mc: ModeloCompilado;
  /** The card's starting state (the reader's values, its `inicio` and its `fijar`). */
  inicial: Valores;
  mandos: Mando[];
  widget?: Widget;
  /** The circuit widget's measures (observable → calculation), checked against ngspice. */
  mide: Record<string, string>;
  enModelo(id: string): boolean;
  texto(x: unknown, campo: string, obligatorio?: boolean): Texto | undefined;
  variables(donde: string, expr: unknown, extra?: string[]): Set<string> | null;
  rango(x: unknown, donde: string): Rango | null;
  e(m: string): void;
  aviso(m: string): void;
  /** Runs SQL on the sample database (the script passes sql.js; absent: SQL cards cannot be checked). */
  sql?: (consulta: string) => Ejecucion;
  /** The figure and logic widgets' context (their steps: GUIA §11). */
  digital?: ContextoDigital;
}

export interface Resultado12 {
  actividad: Actividad12 | null;
  /** Texts for the numbers rule. */
  textos: [string, Texto][];
  /** Numbers the model gives on this card (the faults' readings…). */
  cifras: number[];
  /** More states to check the circuit in with ngspice (each fault). */
  estados: Valores[];
}

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const ID = /^[a-z0-9][a-z0-9-]*$/;

export function actividadDe(tipo: TipoActividad, x: unknown, c: Contexto12): Resultado12 {
  const out: Resultado12 = { actividad: null, textos: [], cifras: [], estados: [] };
  const { e } = c;
  if (!esObjeto(x)) {
    e(`«${tipo}» debe ser un bloque con sus datos (GUIA §10)`);
    return out;
  }
  // motor12c: a step on a figure or a logic circuit (GUIA §11)
  if (c.digital && (tipo === 'tocar' || tipo === 'tabla' || ((tipo === 'averia' || tipo === 'diseno' || tipo === 'dibujar') && c.widget?.tipo === 'logica'))) {
    const r = actividadDigitalDe(tipo, x, c.t, { ...c.digital, e, aviso: c.aviso });
    out.actividad = r.actividad;
    out.textos.push(...r.textos);
    return out;
  }
  if (tipo === 'tocar' || tipo === 'tabla') {
    e(`«${tipo}» necesita su widget (figura o logica)`);
    return out;
  }
  const claves = (permitidas: string[], d = tipo) => {
    for (const k of Object.keys(x)) if (!permitidas.includes(k)) e(`«${d}.${k}»: clave desconocida`);
  };
  const explicacion = (v: unknown, campo: string, obligatorio = true): Texto | undefined => {
    const t = c.texto(v, campo, obligatorio);
    if (t && contarPalabras(t) > MAX_PALABRAS_EXPLICACION) e(`«${campo}»: ${contarPalabras(t)} palabras (máximo ${MAX_PALABRAS_EXPLICACION})`);
    if (t) out.textos.push([campo, t]);
    return t;
  };
  const r0 = c.mc.evaluar(c.inicial);
  const valorDe = (expr: string) => c.mc.funcion(expr)(r0);

  switch (tipo) {
    case 'simular': {
      claves(['objetivo', 'unidad', 'cifras', 'tol', 'rotulo', 'medida', 'errores']);
      c.variables('simular.objetivo', x.objetivo);
      const s: Simular = {
        tipo,
        objetivo: String(x.objetivo ?? ''),
        unidad: typeof x.unidad === 'string' ? x.unidad : '',
        cifras: esNumero(x.cifras) ? x.cifras : 3,
        tol: esNumero(x.tol) ? x.tol : 0.05,
        rotulo: c.texto(x.rotulo, 'simular.rotulo', true) ?? [],
        errores: [],
      };
      if (!(s.tol > 0 && s.tol < 1)) e('«simular.tol»: una fracción entre 0 y 1 (0.05 = 5 %)');
      const obj = valorDe(s.objetivo);
      if (!Number.isFinite(obj)) e(`«simular.objetivo» no da un número (${obj})`);
      else out.cifras.push(obj);
      if (x.medida != null) {
        if (c.widget?.tipo !== 'circuito') e('«simular.medida»: solo con un widget «circuito» (lo que simula la app)');
        else if (typeof x.medida !== 'string' || !(x.medida in c.mide)) e(`«simular.medida»: una medida de «widget.mide» (${Object.keys(c.mide).join(', ') || 'ninguna'})`);
        else {
          s.medida = x.medida;
          const q = r0[c.mide[x.medida]!]!;
          if (Number.isFinite(obj) && errorRelativo(q, obj) > 1e-9 && Math.abs(q - obj) > 1e-12) e(`«simular.medida» (${x.medida} = ${q}) no es el objetivo (${obj}): la simulación diría otra cosa`);
        }
      } else if (c.widget?.tipo === 'circuito') c.aviso('«simular» sin «medida»: la app no podrá enseñar lo que da el simulador');
      if (!Array.isArray(x.errores) || !x.errores.length) e('«simular.errores»: al menos un error típico { expr | razon, texto } (lo que confunde y dónde falla)');
      else
        x.errores.forEach((y: unknown, k: number) => {
          const d = `simular.errores ${k + 1}`;
          if (!esObjeto(y)) return e(`«${d}»: { expr | razon, texto }`);
          for (const q of Object.keys(y)) if (!['expr', 'razon', 'tol', 'texto'].includes(q)) e(`«${d}.${q}»: clave desconocida`);
          const et: ErrorTipico = { texto: explicacion(y.texto, `${d}.texto`) ?? [] };
          if (y.expr != null) {
            c.variables(`${d}.expr`, y.expr);
            et.expr = String(y.expr);
            const w = valorDe(et.expr);
            if (!Number.isFinite(w)) e(`«${d}.expr» no da un número`);
            else if (Number.isFinite(obj) && errorRelativo(w, obj) <= s.tol) e(`«${d}.expr» da ${w}, dentro de la tolerancia del objetivo: no es un error`);
            else out.cifras.push(w);
          } else if (esObjeto(y.razon)) {
            et.razon = {};
            if (esNumero(y.razon.min)) et.razon.min = y.razon.min;
            if (esNumero(y.razon.max)) et.razon.max = y.razon.max;
            if (et.razon.min == null && et.razon.max == null) e(`«${d}.razon»: { min, max }`);
            else if ((et.razon.min ?? -Infinity) <= 1 + s.tol && (et.razon.max ?? Infinity) >= 1 - s.tol) e(`«${d}.razon» incluye la respuesta buena (razón 1)`);
          } else e(`«${d}»: falta «expr» (lo que da la confusión) o «razon» { min, max }`);
          if (esNumero(y.tol)) et.tol = y.tol;
          s.errores.push(et);
        });
      out.actividad = s;
      break;
    }

    case 'diseno': {
      claves(['tolerancias', 'metodo', 'muestras', 'exigir', 'si_tolerancias']);
      if (!c.t.condiciones?.length) e('un «diseno» lleva «condiciones» (la especificación, con su tolerancia)');
      if (!c.mandos.some((m) => m.serie)) c.aviso('«diseno» sin un mando de serie E12/E24: ¿no se eligen valores normalizados?');
      const tol: Record<string, number> = {};
      if (!esObjeto(x.tolerancias) || !Object.keys(x.tolerancias).length) e('«diseno.tolerancias»: { valor: tolerancia } (R_1: 0.05 = ± 5 %)');
      else
        for (const [k, v] of Object.entries(x.tolerancias)) {
          if (!(k in c.mc.modelo.valores)) e(`«diseno.tolerancias.${k}»: no es un valor del modelo`);
          else if (!esNumero(v) || !(v > 0 && v < 0.5)) e(`«diseno.tolerancias.${k}»: una fracción (0.05 = ± 5 %)`);
          else tol[k] = v;
        }
      if (Object.keys(tol).length > MAX_TOLERANCIAS) e(`«diseno.tolerancias»: como mucho ${MAX_TOLERANCIAS}`);
      const metodo = x.metodo === 'montecarlo' ? 'montecarlo' : 'esquinas';
      if (x.metodo != null && x.metodo !== 'esquinas' && x.metodo !== 'montecarlo') e('«diseno.metodo»: esquinas o montecarlo');
      const muestras = esNumero(x.muestras) ? Math.round(x.muestras) : 200;
      if (muestras < 20 || muestras > MAX_MUESTRAS) e(`«diseno.muestras»: de 20 a ${MAX_MUESTRAS}`);
      let exigir: Diseno['exigir'] = 'todas';
      if (x.exigir === 'nominal' || x.exigir === 'todas') exigir = x.exigir;
      else if (esNumero(x.exigir) && x.exigir > 0 && x.exigir <= 1) exigir = x.exigir;
      else if (x.exigir != null) e('«diseno.exigir»: nominal, todas o una fracción de placas (0.95)');
      const d: Diseno = { tipo, tolerancias: tol, metodo, muestras, semilla: semillaDe(c.semilla), exigir };
      const st = explicacion(x.si_tolerancias, 'diseno.si_tolerancias', false);
      if (st) d.siTolerancias = st;
      // reachable with the tolerances, and not passing at the start
      if (c.t.condiciones?.length && c.mandos.length) {
        const total = c.mandos.reduce((a, m) => a * m.valores.length, 1);
        const porPlaca = metodo === 'esquinas' ? 2 ** Object.keys(tol).length : muestras;
        if (total * porPlaca > 2_000_000) e(`el diseño tiene ${total} posiciones × ${porPlaca} placas: demasiadas para comprobarlo (menos mandos, posiciones o muestras)`);
        else {
          let soluciones = 0;
          const pos = c.mandos.map(() => 0);
          for (let n = 0; n < total && !soluciones; n++) {
            const v: Valores = { ...c.inicial };
            c.mandos.forEach((m, k) => (v[m.valor] = m.valores[pos[k]!]!));
            if (analizarDiseno(c.mc, d, c.t.condiciones, v).pasa) soluciones++;
            for (let k = 0; k < pos.length; k++) {
              pos[k]!++;
              if (pos[k]! < c.mandos[k]!.valores.length) break;
              pos[k] = 0;
            }
          }
          if (!soluciones) e(`el diseño no tiene solución con las tolerancias (exigir: ${String(exigir)}): ninguna posición de los mandos pasa`);
          if (analizarDiseno(c.mc, d, c.t.condiciones, c.inicial).pasa) e('el diseño empieza ya aprobado (ponga «inicio»)');
        }
      }
      out.actividad = d;
      break;
    }

    case 'averia': {
      claves(['fallos', 'sospechosos', 'sondas', 'pasos', 'eleccion', 'preguntar_tipo', 'adaptativa']);
      if (x.adaptativa != null && typeof x.adaptativa !== 'boolean') e('«averia.adaptativa»: true o false');
      if (c.widget?.tipo === 'circuito') {
        const w = c.widget;
        if (w.lectura || w.barras?.length || w.datos?.length) e('una «averia» no enseña lecturas en el widget (lectura, barras, datos): se mide con las sondas');
      }
      if (c.mandos.length) e('una «averia» no lleva mandos: la placa es la que es');
      const sospechosos: Averia['sospechosos'] = [];
      if (!Array.isArray(x.sospechosos) || x.sospechosos.length < 2 || x.sospechosos.length > 8) e('«averia.sospechosos»: de 2 a 8 { id, rotulo } (las piezas entre las que se elige)');
      else
        x.sospechosos.forEach((y: unknown, k: number) => {
          const o = esObjeto(y) ? y : {};
          const id = String(o.id ?? '');
          if (!ID.test(id)) e(`«averia.sospechosos ${k + 1}.id»: minúsculas, cifras y guiones`);
          if (sospechosos.some((s) => s.id === id)) e(`«averia.sospechosos»: «${id}» repetido`);
          const rot = c.texto(o.rotulo, `averia.sospechosos ${k + 1}.rotulo`, true) ?? [];
          if (contarPalabras(rot) > 6) e(`«averia.sospechosos ${k + 1}.rotulo»: como mucho 6 palabras`);
          sospechosos.push({ id, rotulo: rot });
        });
      const sondas: Sonda[] = [];
      if (!Array.isArray(x.sondas) || x.sondas.length < 2 || x.sondas.length > 10) e('«averia.sondas»: de 2 a 10 { id, rotulo, valor } (los puntos donde se mide)');
      else
        x.sondas.forEach((y: unknown, k: number) => {
          const d = `averia.sondas ${k + 1}`;
          const o = esObjeto(y) ? y : {};
          for (const q of Object.keys(o)) if (!['id', 'rotulo', 'valor', 'curva'].includes(q)) e(`«${d}.${q}»: clave desconocida`);
          const id = String(o.id ?? '');
          if (!ID.test(id)) e(`«${d}.id»: minúsculas, cifras y guiones`);
          if (sondas.some((s) => s.id === id)) e(`«averia.sondas»: «${id}» repetido`);
          if (typeof o.valor !== 'string' || !c.enModelo(o.valor)) e(`«${d}.valor»: un valor o cálculo del modelo (lo que lee el multímetro)`);
          const s: Sonda = { id, rotulo: c.texto(o.rotulo, `${d}.rotulo`, true) ?? [], valor: String(o.valor ?? '') };
          if (o.curva != null) {
            const cv = esObjeto(o.curva) ? o.curva : {};
            const ex = eje(cv.x, `${d}.curva.x`, true);
            const ey = eje(cv.y, `${d}.curva.y`, false);
            c.variables(`${d}.curva.expr`, cv.expr, ex?.id ? [ex.id] : []);
            if (ex && ey) s.curva = { expr: String(cv.expr ?? ''), x: ex as Eje & { id: string }, y: ey };
          }
          sondas.push(s);
        });
      const fallos: Fallo[] = [];
      if (!Array.isArray(x.fallos) || !x.fallos.length || x.fallos.length > 12) e('«averia.fallos»: de 1 a 12 { id, pieza, tipo, con, texto }');
      else
        x.fallos.forEach((y: unknown, k: number) => {
          const d = `averia.fallos ${k + 1}`;
          const o = esObjeto(y) ? y : {};
          for (const q of Object.keys(o)) if (!['id', 'pieza', 'tipo', 'con', 'texto'].includes(q)) e(`«${d}.${q}»: clave desconocida`);
          const id = String(o.id ?? '');
          if (!ID.test(id)) e(`«${d}.id»: minúsculas, cifras y guiones`);
          if (fallos.some((f) => f.id === id)) e(`«averia.fallos»: «${id}» repetido`);
          if (!sospechosos.some((s) => s.id === o.pieza)) e(`«${d}.pieza»: uno de los sospechosos (${sospechosos.map((s) => s.id).join(', ')})`);
          if (!TIPOS_FALLO.includes(String(o.tipo))) e(`«${d}.tipo»: ${TIPOS_FALLO.join(', ')}`);
          const con: Record<string, number> = {};
          if (!esObjeto(o.con) || !Object.keys(o.con).length) e(`«${d}.con»: los valores del modelo con la avería ({ R_2: 1e9 } abierta)`);
          else
            for (const [q, v] of Object.entries(o.con)) {
              if (!(q in c.mc.modelo.valores)) e(`«${d}.con.${q}»: no es un valor del modelo`);
              else if (!esNumero(v)) e(`«${d}.con.${q}»: un número`);
              else {
                con[q] = v;
                out.cifras.push(v);
              }
            }
          fallos.push({ id, pieza: String(o.pieza ?? ''), tipo: String(o.tipo) as Fallo['tipo'], con, texto: explicacion(o.texto, `${d}.texto`) ?? [] });
        });
      for (const s of sospechosos) if (!fallos.some((f) => f.pieza === s.id)) e(`«averia.sospechosos»: «${s.id}» no tiene ninguna avería en «fallos» (sin ella no se puede explicar por qué no es)`);
      const pasos = esNumero(x.pasos) ? Math.round(x.pasos) : sondas.length;
      if (pasos < 1 || pasos > sondas.length) e(`«averia.pasos»: de 1 a ${sondas.length} (las medidas que puede hacer)`);
      const eleccion = x.eleccion === 'azar' ? 'azar' : 'fija';
      if (x.eleccion != null && x.eleccion !== 'azar' && x.eleccion !== 'fija') e('«averia.eleccion»: fija o azar');
      const sano: Record<string, number> = {};
      for (const f of fallos) for (const q of Object.keys(f.con)) sano[q] = c.inicial[q] ?? c.mc.modelo.valores[q]?.valor ?? 0;
      const a: Averia = { tipo, fallos, sospechosos, sondas, pasos, eleccion, preguntarTipo: x.preguntar_tipo === true, sano };
      if (fallos.length && sondas.length && sospechosos.length) {
        // every reading a number, every fault visible, every pair of suspects told apart
        for (const f of [null, ...fallos]) {
          const l = lecturas(c.mc, a, c.inicial, f);
          for (const [s, v] of Object.entries(l)) {
            if (!Number.isFinite(v)) e(`con ${f ? `la avería «${f.id}»` : 'el circuito sano'}, la sonda «${s}» no da un número`);
            else out.cifras.push(v);
          }
          if (f) out.estados.push({ ...c.inicial, ...sano, ...f.con });
        }
        const r = faltaSeparar(c.mc, a, c.inicial);
        for (const id of r.sano) e(`la avería «${id}» mide lo mismo que el circuito sano en todas las sondas: no se puede encontrar`);
        for (const [p, q] of r.pares) e(`las averías «${p}» y «${q}» (de piezas distintas) miden lo mismo en todas las sondas: añada una sonda que las distinga`);
        // (peticiones motor12, autor-taller-A: a bisection, where each probe is chosen after the previous reading, needs
        // only ceil(log2(faults + 1)) probes; `adaptativa: true` says the lesson means it that way)
        const biseccion = pasos >= Math.ceil(Math.log2(fallos.length + 1)) || x.adaptativa === true;
        if (!r.pares.length && r.minimo != null && r.minimo > pasos && !biseccion) c.aviso(`hacen falta ${r.minimo} medidas fijas para distinguir todas las averías y solo se permiten ${pasos} (eligiendo bien cada medida puede bastar)`);
      }
      out.actividad = a;
      break;
    }

    case 'ajuste': {
      claves(['valor', 'objetivo', 'tol', 'min', 'max', 'rotulo', 'escala', 'bajo', 'alto', 'dentro']);
      if (!c.mandos.length) e('un «ajuste» necesita un widget con mandos');
      const r = c.rango(x, 'ajuste');
      if (r && (r.min == null || r.max == null)) e('«ajuste»: una banda cerrada (objetivo + tol, o min y max)');
      const banda = { valor: r?.valor ?? '', min: r?.min ?? 0, max: r?.max ?? 0 };
      const ancho = banda.max - banda.min;
      let escala = { min: banda.min - 3 * ancho, max: banda.max + 3 * ancho };
      if (esObjeto(x.escala) && esNumero(x.escala.min) && esNumero(x.escala.max) && x.escala.min < x.escala.max) escala = { min: x.escala.min, max: x.escala.max };
      else if (x.escala != null) e('«ajuste.escala»: { min, max } con min < max');
      const a: Ajuste = {
        tipo,
        banda,
        escala,
        rotulo: c.texto(x.rotulo, 'ajuste.rotulo', true) ?? [],
        bajo: explicacion(x.bajo, 'ajuste.bajo') ?? [],
        alto: explicacion(x.alto, 'ajuste.alto') ?? [],
        dentro: explicacion(x.dentro, 'ajuste.dentro') ?? [],
      };
      if (r && c.mandos.length && r.min != null && r.max != null) {
        const total = c.mandos.reduce((s, m) => s * m.valores.length, 1);
        if (total > 250_000) e(`el ajuste tiene ${total} posiciones (máximo 250000)`);
        else {
          let dentro = 0;
          const pos = c.mandos.map(() => 0);
          for (let n = 0; n < total; n++) {
            const v: Valores = { ...c.inicial };
            c.mandos.forEach((m, k) => (v[m.valor] = m.valores[pos[k]!]!));
            if (enRango(banda, c.mc.evaluar(v))) dentro++;
            for (let k = 0; k < pos.length; k++) {
              pos[k]!++;
              if (pos[k]! < c.mandos[k]!.valores.length) break;
              pos[k] = 0;
            }
          }
          if (!dentro) e('ninguna posición de los mandos lleva la medida a su banda');
          if (enRango(banda, r0)) e('el ajuste empieza ya dentro de la banda (ponga «inicio»)');
        }
      }
      out.actividad = a;
      break;
    }

    case 'banco': {
      claves(['piezas', 'medir', 'esperado', 'unidad', 'cifras', 'tol', 'consejos', 'ficha']);
      const piezas = Array.isArray(x.piezas) ? x.piezas.map((p: unknown, k: number) => c.texto(p, `banco.piezas ${k + 1}`, true) ?? []) : [];
      if (!piezas.length || piezas.length > 10) e('«banco.piezas»: de 1 a 10 (lo que hace falta en el banco)');
      for (const [k, p] of piezas.entries()) {
        if (contarPalabras(p) > MAX_PALABRAS_OPCION) e(`«banco.piezas ${k + 1}»: más de ${MAX_PALABRAS_OPCION} palabras`);
        out.textos.push([`banco.piezas ${k + 1}`, p]);
      }
      c.variables('banco.esperado', x.esperado);
      const b: Banco = {
        tipo,
        piezas,
        medir: explicacion(x.medir, 'banco.medir') ?? [],
        esperado: String(x.esperado ?? ''),
        unidad: typeof x.unidad === 'string' ? x.unidad : '',
        cifras: esNumero(x.cifras) ? x.cifras : 3,
        tol: esNumero(x.tol) ? x.tol : 0.05,
        consejos: [],
      };
      if (!(b.tol > 0 && b.tol < 1)) e('«banco.tol»: una fracción (0.05 = ± 5 %)');
      const esp = valorDe(b.esperado);
      if (!Number.isFinite(esp)) e('«banco.esperado» no da un número');
      else out.cifras.push(esp);
      if (!Array.isArray(x.consejos) || !x.consejos.length) e('«banco.consejos»: al menos uno { cuando?, texto } (qué revisar si no sale)');
      else
        x.consejos.forEach((y: unknown, k: number) => {
          const o = esObjeto(y) ? y : { texto: y };
          const p: Banco['consejos'][number] = { texto: explicacion(o.texto, `banco.consejos ${k + 1}`) ?? [] };
          if (o.cuando != null) {
            const cu = o.cuando;
            if (!esObjeto(cu) || (cu.valor !== 'desviacion' && cu.valor !== 'medida')) e(`«banco.consejos ${k + 1}.cuando»: { valor: desviacion | medida, min/max/menor/mayor }`);
            else {
              const rr = rangoLibre(cu);
              if (rr) p.cuando = rr;
              else e(`«banco.consejos ${k + 1}.cuando»: falta el límite`);
            }
          }
          b.consejos.push(p);
        });
      if (x.ficha != null) {
        const f = x.ficha;
        if (!esObjeto(f) || !Number.isInteger(f.n) || typeof f.titulo !== 'string' || !f.titulo.trim()) e('«banco.ficha»: { n, titulo } (la ficha del cuaderno de prácticas)');
        else if ((f.n as number) < 1 || (f.n as number) > 99) e('«banco.ficha.n»: el número de la ficha');
        else b.ficha = { n: f.n as number, titulo: f.titulo.trim() };
      }
      out.actividad = b;
      break;
    }

    case 'dibujar': {
      claves(['x', 'y', 'curva', 'puntos', 'tol', 'holgura', 'rotulo']);
      // (1.2: the x axis may be logarithmic, `escala: log`, as a graph's: a Bode plot against f)
      const ex = eje(x.x, 'dibujar.x', true, true);
      const ey = eje(x.y, 'dibujar.y', false);
      c.variables('dibujar.curva', x.curva, ex?.id ? [ex.id] : []);
      const puntos = esNumero(x.puntos) ? Math.round(x.puntos) : 25;
      if (puntos < 9 || puntos > 61) e('«dibujar.puntos»: de 9 a 61');
      const d: Dibujar = {
        tipo,
        x: (ex ?? { id: 't', min: 0, max: 1, unidad: '', rotulo: [] }) as Dibujar['x'],
        y: ey ?? { min: 0, max: 1, unidad: '', rotulo: [] },
        curva: String(x.curva ?? ''),
        puntos,
        tol: esNumero(x.tol) ? x.tol : 0.1,
        holgura: esNumero(x.holgura) ? x.holgura : 0.03,
        rotulo: c.texto(x.rotulo, 'dibujar.rotulo', true) ?? [],
      };
      if (!(d.tol > 0 && d.tol <= 0.3)) e('«dibujar.tol»: entre 0 y 0.3 (0.1 = 10 % de la altura del eje)');
      if (!(d.holgura >= 0 && d.holgura <= 0.1)) e('«dibujar.holgura»: entre 0 y 0.1');
      if (ex && ey && d.curva) {
        const f = c.mc.funcion(d.curva);
        const ys = xsDibujo(d).map((xx) => f({ ...r0, [d.x.id]: xx }));
        if (ys.some((y) => !Number.isFinite(y))) e('«dibujar.curva» no da un número en todo el eje');
        else {
          const fuera = ys.filter((y) => y < d.y.min - 1e-9 || y > d.y.max + 1e-9).length;
          if (fuera) e(`«dibujar.curva» se sale del eje y en ${fuera} de ${ys.length} puntos: amplíe «y»`);
          if (Math.max(...ys) - Math.min(...ys) < 0.1 * (d.y.max - d.y.min)) c.aviso('«dibujar.curva» es casi plana en este eje: ¿es lo que se quiere dibujar?');
        }
      }
      out.actividad = d;
      break;
    }

    case 'sql': {
      claves(['modo', 'base', 'solucion', 'ordenado', 'inicial', 'plantilla', 'huecos', 'clausulas']);
      const modo = x.modo === 'rellenar' || x.modo === 'ordenar' ? x.modo : 'consulta';
      if (x.modo != null && !['consulta', 'rellenar', 'ordenar'].includes(String(x.modo))) e('«sql.modo»: consulta, rellenar u ordenar');
      if (x.base != null && x.base !== 'mediciones') e('«sql.base»: mediciones (la base de ejemplo de la sección 17.10)');
      const s: Sql = { tipo, modo, base: 'mediciones', solucion: '', esperado: { columnas: [], filas: [] }, ordenado: false };
      if (modo === 'ordenar') {
        if (!Array.isArray(x.clausulas) || x.clausulas.length < 3 || x.clausulas.length > 7 || !x.clausulas.every((q) => typeof q === 'string' && q.trim())) e('«sql.clausulas»: de 3 a 7 trozos de la consulta, en su orden');
        else {
          s.clausulas = x.clausulas.map((q) => String(q).trim());
          s.inicio = barajarFijo(s.clausulas.length, c.semilla);
          s.solucion = unirClausulas(s.clausulas, s.clausulas.map((_, k) => k));
        }
        if (x.solucion != null) e('«sql.solucion»: en «ordenar» la solución son las cláusulas en su orden');
      } else if (modo === 'rellenar') {
        if (typeof x.plantilla !== 'string' || !/\[\[1\]\]/.test(x.plantilla)) e('«sql.plantilla»: la consulta con sus huecos [[1]], [[2]]…');
        const n = typeof x.plantilla === 'string' ? Math.max(0, ...[...x.plantilla.matchAll(/\[\[(\d+)\]\]/g)].map((m) => Number(m[1]))) : 0;
        const hs = Array.isArray(x.huecos) ? x.huecos : [];
        if (hs.length !== n) e(`«sql.huecos»: uno por hueco de la plantilla (${n}), con su respuesta { solucion, opciones? }`);
        s.plantilla = String(x.plantilla ?? '');
        s.huecos = [];
        const sol: string[] = [];
        hs.forEach((h: unknown, k: number) => {
          const o = esObjeto(h) ? h : {};
          if (typeof o.solucion !== 'string' || !o.solucion.trim()) e(`«sql.huecos ${k + 1}.solucion»: lo que va en el hueco`);
          sol.push(String(o.solucion ?? ''));
          if (o.opciones != null) {
            if (!Array.isArray(o.opciones) || o.opciones.length < 2 || o.opciones.length > 6 || !o.opciones.every((q) => typeof q === 'string')) e(`«sql.huecos ${k + 1}.opciones»: de 2 a 6 textos`);
            else if (!o.opciones.includes(String(o.solucion ?? ''))) e(`«sql.huecos ${k + 1}.opciones»: la solución debe ser una de ellas`);
            else s.huecos!.push({ opciones: o.opciones.map(String) });
          } else s.huecos!.push({});
        });
        s.solucion = rellenarPlantilla(s.plantilla, sol);
      } else {
        if (typeof x.solucion !== 'string' || !x.solucion.trim()) e('«sql.solucion»: la consulta que da el resultado bueno');
        s.solucion = String(x.solucion ?? '').trim();
        if (typeof x.inicial === 'string') s.inicial = x.inicial;
      }
      if (s.solucion && NO_DETERMINISTA.test(s.solucion)) e('«sql»: la solución usa la fecha de hoy o el azar (now, random…): su resultado cambiaría cada día');
      s.ordenado = typeof x.ordenado === 'boolean' ? x.ordenado : /\border\s+by\b/i.test(s.solucion);
      if (s.solucion && !c.sql) e('«sql»: no se puede comprobar sin SQLite (el generador lo carga: node scripts/lecciones11.mjs)');
      else if (s.solucion && c.sql) {
        const r = c.sql(s.solucion);
        if (r.error) e(`«sql»: la solución no se ejecuta: ${r.error}`);
        else if (!r.resultado || !r.resultado.columnas.length) e('«sql»: la solución no devuelve filas (una consulta SELECT)');
        else if ((r.total ?? 0) > 200) e(`«sql»: la solución devuelve ${r.total} filas (máximo 200: que se puedan mirar)`);
        else if (!r.total) e('«sql»: la solución no devuelve ninguna fila');
        else s.esperado = r.resultado;
        if (modo === 'consulta' && s.inicial != null && c.sql && s.inicial.trim()) {
          const ri = c.sql(s.inicial);
          if (ri.resultado && s.esperado.columnas.length && JSON.stringify(ri.resultado) === JSON.stringify(s.esperado)) e('«sql.inicial» ya da el resultado bueno');
        }
      }
      out.actividad = s;
      break;
    }
  }
  return out;

  function eje(o: unknown, d: string, conId: boolean, conEscala = false): (Eje & { id?: string }) | null {
    if (!esObjeto(o) || !esNumero(o.min) || !esNumero(o.max) || !(o.min < o.max)) {
      e(`«${d}»: { ${conId ? 'id, ' : ''}min, max, unidad, rotulo } con min < max`);
      return null;
    }
    if (conId && (typeof o.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(o.id) || c.enModelo(o.id))) e(`«${d}.id»: un nombre que no esté en el modelo («t»)`);
    const validas = ['id', 'min', 'max', 'unidad', 'rotulo', ...(conEscala ? ['escala'] : [])];
    for (const k of Object.keys(o)) if (!validas.includes(k)) e(`«${d}.${k}»: clave desconocida`);
    if (conEscala && o.escala != null && o.escala !== 'log' && o.escala !== 'lineal') e(`«${d}.escala»: lineal o log`);
    const log = conEscala && o.escala === 'log';
    if (log && !(o.min > 0)) e(`«${d}»: un eje logarítmico empieza por encima de 0`);
    const rot = c.texto(String(o.rotulo ?? ''), `${d}.rotulo`) ?? [];
    for (const v of valoresDeTexto(rot)) if (!c.enModelo(v)) e(`«${d}.rotulo»: {{${v}}} no está en el modelo`);
    return { ...(conId ? { id: String(o.id) } : {}), min: o.min, max: o.max, unidad: typeof o.unidad === 'string' ? o.unidad : '', rotulo: rot, ...(log ? { escala: 'log' as const } : {}) };
  }
}

/** A range on a variable that is not the model's (the bench's deviation): min/max/menor/mayor. */
function rangoLibre(x: Record<string, unknown>): Rango | null {
  const r: Rango = { valor: String(x.valor) };
  if (esNumero(x.min)) r.min = x.min;
  if (esNumero(x.max)) r.max = x.max;
  if (esNumero(x.menor)) r.max = x.menor;
  if (esNumero(x.mayor)) r.min = x.mayor;
  return r.min == null && r.max == null ? null : r;
}
