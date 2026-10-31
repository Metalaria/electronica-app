// 0.11 «group B»: learn by doing, adaptive.
//   - mastery per concept (pure, in Node): points of an answer, rounds, idempotence on replayed events and retries,
//     the formula (prior, spaced days, forgetting), levels, «para repasar», merge of two devices' rounds;
//   - smart practice selection (pure): weak first, quotas, no immediate repeats, prerequisites (chapter order of the
//     course), flashcards only when due and at most two, focus on a section, interleaving, deterministic with a seed;
//   - problem of the day (pure): deterministic per day, course and level, avoids the recent days, streak;
//   - in the browser: mastery from the answers of a lesson (and nothing new from a retry or a reload), migration
//     of 0.10/0.11 data (the other stores untouched), synchronisation round-trip (rounds of two devices merged),
//     «Práctica inteligente» (intro, items, end screen with what improved, events), «Practicar esto» from the
//     «Dominio» page, the problem of the day (same all day, solved state, XP, achievement, streak, yesterday's
//     solution, offline), live figures inside lessons (the reading changes with a value, nothing simulates while the
//     figure is off screen), the mastery markers in the reader, the index and the courses;
//   - 412 px phone and 800 px tablet without horizontal overflow; screenshots (light and dark) in
//     tests/capturas/grupoB11/.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.grupoB.config.ts tests/grupoB11.spec.ts
import { mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import {
  anotarRespuesta,
  dominioConcepto,
  dominioPorConcepto,
  fusionarRegistros,
  nivelDominio,
  puntosDe,
  agregar,
  VENTANA,
  MAX_RONDAS,
  DIA_MS,
  type RegistroItem,
  type RespuestaDominio,
} from '../src/lib/aprendizaje/dominio.ts';
import {
  completar,
  nuevosDisponibles,
  planificar,
  problemaDelDia,
  rachaDias,
  seleccionar,
  RECIENTE_MS,
  type CandidatoProblema,
  type ConceptoCandidato,
  type ItemCatalogo,
} from '../src/lib/aprendizaje/seleccion.ts';
import { CURSOS } from '../src/lib/aprendizaje/cursos.ts';
import { XP } from '../src/lib/aprendizaje/niveles.ts';
import { LOGROS } from '../src/lib/aprendizaje/logros.ts';
import type { Indice } from '../src/lib/tipos.ts';

const LIBRO = new URL('../public/libro/', import.meta.url);
const leerJson = <T>(ruta: string): T => JSON.parse(readFileSync(new URL(ruta, LIBRO), 'utf8')) as T;
const INDICE = leerJson<Indice>('indice.json');
const CAPTURAS = new URL('./capturas/grupoB11/', import.meta.url).pathname;
mkdirSync(CAPTURAS, { recursive: true });

const TABLETA = { width: 800, height: 1280 };
const MOVIL = { width: 412, height: 915 };
const H = 3_600_000;

interface PreguntaJson {
  id: string;
  tipo: 'opcion' | 'numero';
  opciones?: string[];
  correcta?: number;
  valor?: number;
  ref: string;
}
interface ItemPracticaJson {
  id: string;
  tipo: string;
  parte: string;
  seccion: string;
}
interface EjercicioJson {
  parte: string;
  seccion: string | null;
  modo: string;
  respuestas: unknown[];
}
const EJERCICIOS = leerJson<{ items: Record<string, EjercicioJson> }>('ejercicios.json').items;
const cuestionarios = new Map<string, PreguntaJson[]>();
const cuestionario = (p: string) => cuestionarios.get(p) ?? cuestionarios.set(p, leerJson<{ preguntas: PreguntaJson[] }>(`repaso/${p}.json`).preguntas).get(p)!;
const practicas = new Map<string, ItemPracticaJson[]>();
const practica = (p: string) => practicas.get(p) ?? practicas.set(p, leerJson<{ items: ItemPracticaJson[] }>(`practica/${p}.json`).items).get(p)!;

/** The concept of a Repaso question (the rules of lib/aprendizaje/catalogo.ts, written again). */
function conceptoDe(parte: string, ref: string): string | null {
  const secs = INDICE.partes[parte]?.secciones ?? [];
  if (secs.some((s) => s.label === ref)) return `${parte}/${ref}`;
  const ej = EJERCICIOS[ref];
  if (ej?.seccion && ej.parte === parte) return `${parte}/${ej.seccion}`;
  let mejor: string | null = null;
  for (const s of secs) if (ref.startsWith(`${s.label}.`) && (!mejor || s.label.length > mejor.length)) mejor = s.label;
  return mejor ? `${parte}/${mejor}` : null;
}

const plano = (h: string) =>
  h
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Review day key (the day starts at 04:00), k days ago from `desde`. */
function dia(k: number, desde = Date.now()): string {
  const d = new Date(desde);
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  d.setDate(d.getDate() - k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Silences Web Audio, collects the learning events, fixes the session seed; seeds localStorage once. */
async function preparar(ctx: BrowserContext | Page, datos: Record<string, unknown> = {}, semilla = 12345): Promise<void> {
  await ctx.addInitScript(
    ({ d, semilla }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__epaEventos = [];
      w.__epaSemillaPractica = semilla;
      class Param {
        value = 0;
        setValueAtTime() {
          return this;
        }
        exponentialRampToValueAtTime() {
          return this;
        }
        setTargetAtTime() {
          return this;
        }
      }
      class Nodo {
        connect(n: unknown) {
          return n;
        }
        disconnect() {}
      }
      class Oscilador extends Nodo {
        type = 'sine';
        frequency = new Param();
        onended: null | (() => void) = null;
        start() {}
        stop() {}
      }
      class Ganancia extends Nodo {
        gain = new Param();
      }
      class Contexto {
        state = 'running';
        currentTime = 0;
        destination = new Nodo();
        createOscillator() {
          return new Oscilador();
        }
        createGain() {
          return new Ganancia();
        }
        resume() {
          return Promise.resolve();
        }
        suspend() {
          return Promise.resolve();
        }
      }
      w.AudioContext = Contexto;
      if (sessionStorage.getItem('grupoB-sembrado')) return;
      sessionStorage.setItem('grupoB-sembrado', '1');
      for (const [k, v] of Object.entries(d)) localStorage.setItem(`epa:${k}`, JSON.stringify(v));
    },
    { d: datos, semilla },
  );
}

const leer = <T>(page: Page, clave: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(`epa:${k}`) ?? 'null'), clave) as Promise<T>;
const eventos = (page: Page) => page.evaluate(() => (window as unknown as { __epaEventos: Record<string, unknown>[] }).__epaEventos);

interface Dominio {
  version: number;
  items: Record<string, RegistroItem>;
  migrado: number;
}

/** Answers the Repaso question on screen, right or wrong, from the book's quiz data. */
async function responderPregunta(page: Page, bien: boolean): Promise<void> {
  const caja = page.locator('[data-pregunta]').first();
  const id = (await caja.getAttribute('data-pregunta'))!;
  const q = cuestionario(id.split('-')[0]!).find((x) => x.id === id)!;
  if (q.tipo === 'opcion') {
    const objetivo = plano(q.opciones![q.correcta!]!);
    const botones = caja.locator('button.opcion');
    const n = await botones.count();
    const textos: string[] = [];
    for (let i = 0; i < n; i++) textos.push(plano((await botones.nth(i).locator('.txt').textContent()) ?? ''));
    let k = textos.findIndex((t) => t === objetivo);
    if (k < 0) k = textos.findIndex((t) => t.includes(objetivo.slice(0, 25)) || objetivo.includes(t.slice(0, 25)));
    expect(k, `opción correcta de ${id}`).toBeGreaterThanOrEqual(0);
    await botones.nth(bien ? k : (k + 1) % n).click();
  } else {
    await caja.locator('[data-numero]').fill(bien ? String(q.valor).replace('.', ',') : '987654321');
    await caja.locator('[data-comprobar]').click();
  }
  await expect(caja.locator('[data-feedback]')).toHaveAttribute('data-feedback', bien ? 'bien' : 'mal');
}

/** No horizontal page scroll. */
async function sinDesborde(page: Page, que: string): Promise<void> {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(r.sw, `${que}: desborde horizontal`).toBeLessThanOrEqual(r.w + 1);
}

// ================================================================== pure: mastery

const T0 = Date.UTC(2026, 9, 1, 10);
const resp = (t: number, correcta: boolean, o: Partial<RespuestaDominio> = {}): RespuestaDominio => ({
  t,
  correcta,
  intento: 1,
  pistas: 0,
  final: true,
  clase: 'practica',
  ...o,
});
/** Folds events into records like the consumer does (ignoring «no change»). */
function plegar(eventos: { id: string; s: string; e: RespuestaDominio }[], base: Record<string, RegistroItem> = {}): Record<string, RegistroItem> {
  const r = structuredClone(base);
  for (const x of eventos) {
    const n = anotarRespuesta(r[x.id], x.s, x.e);
    if (n) r[x.id] = n;
  }
  return r;
}

test.describe('dominio por concepto (sin navegador)', () => {
  test('puntos de una respuesta', () => {
    expect(puntosDe({ correcta: true, intento: 1, pistas: 0, clase: 'practica' })).toBe(100);
    expect(puntosDe({ correcta: true, intento: 2, pistas: 0, clase: 'practica' })).toBe(60);
    expect(puntosDe({ correcta: true, intento: 1, pistas: 1, clase: 'pregunta' })).toBe(60);
    expect(puntosDe({ correcta: false, intento: 1, pistas: 0, clase: 'pregunta' })).toBe(0);
    // an exercise's attempt counter is lifetime: only its hints count
    expect(puntosDe({ correcta: true, intento: 7, pistas: 0, clase: 'ejercicio' })).toBe(100);
    expect(puntosDe({ correcta: true, intento: 1, pistas: 2, clase: 'ejercicio' })).toBe(60);
  });

  test('rondas: repeticiones, reintentos, provisionales e idempotencia', () => {
    const s = 'cap05/sec-5.1';
    const a = anotarRespuesta(undefined, s, resp(T0, true))!;
    expect(a.r).toEqual([[T0, 100]]);
    // the same event replayed: nothing
    expect(anotarRespuesta(a, s, resp(T0, true))).toBeNull();
    // «Probar otra vez» or a reload reporting it again within the window: nothing
    expect(anotarRespuesta(a, s, resp(T0 + 30_000, true, { intento: 2 }))).toBeNull();
    expect(anotarRespuesta(a, s, resp(T0 + VENTANA - 1, false))).toBeNull();
    // after the window: a new round
    const b = anotarRespuesta(a, s, resp(T0 + VENTANA + 1, false))!;
    expect(b.r).toEqual([
      [T0, 100],
      [T0 + VENTANA + 1, 0],
    ]);
    expect(a.r).toHaveLength(1); // never mutated
    // wrong first attempt with another left: provisional; the final answer settles it
    const p = anotarRespuesta(undefined, s, resp(T0, false, { final: false }))!;
    expect(p.r).toEqual([[T0, 0, 1]]);
    expect(anotarRespuesta(p, s, resp(T0 + 5_000, false, { final: false }))).toBeNull();
    expect(anotarRespuesta(p, s, resp(T0 + 20_000, true, { intento: 2 }))!.r).toEqual([[T0, 60]]);
    expect(anotarRespuesta(p, s, resp(T0 + 20_000, false, { intento: 2 }))!.r).toEqual([[T0, 0]]);
    // an exercise: a wrong check is provisional, a right one within the window settles it «with help»
    const e = anotarRespuesta(undefined, s, resp(T0, false, { final: false, clase: 'ejercicio', intento: 3 }))!;
    expect(anotarRespuesta(e, s, resp(T0 + 60_000, true, { clase: 'ejercicio', intento: 4 }))!.r).toEqual([[T0, 60]]);
    // an older answer arriving late opens its own round only when nothing is near
    expect(anotarRespuesta(b, s, resp(T0 - 2 * VENTANA, true))!.r[0]).toEqual([T0 - 2 * VENTANA, 100]);
    expect(anotarRespuesta(b, s, resp(T0 - 1000, true))).toBeNull();
    // at most MAX_RONDAS, the newest
    let r: RegistroItem | undefined;
    for (let i = 0; i < MAX_RONDAS + 4; i++) r = anotarRespuesta(r, s, resp(T0 + i * DIA_MS, i % 2 === 0)) ?? r;
    expect(r!.r).toHaveLength(MAX_RONDAS);
    expect(r!.r[MAX_RONDAS - 1]![0]).toBe(T0 + (MAX_RONDAS + 3) * DIA_MS);
  });

  test('plegar dos veces los mismos eventos no cambia nada (eventos repetidos tras recargar)', () => {
    const ev: { id: string; s: string; e: RespuestaDominio }[] = [];
    for (let i = 0; i < 40; i++) ev.push({ id: `cap01-${i % 7}`, s: `cap01/sec-1.${1 + (i % 3)}`, e: resp(T0 + i * 7 * 60_000 + (i % 5) * 1000, i % 3 !== 0, { final: i % 4 !== 1 || i % 3 !== 0 }) });
    const una = plegar(ev);
    const dos = plegar(ev, una);
    expect(dos).toEqual(una);
    // and in any order of delivery of the replay
    expect(plegar([...ev].reverse(), una)).toEqual(una);
    const ahora = T0 + 30 * DIA_MS;
    expect(dominioPorConcepto(dos, ahora)).toEqual(dominioPorConcepto(una, ahora));
  });

  test('la fórmula: evidencia, días espaciados, olvido, niveles y «para repasar»', () => {
    const s = 'cap05/sec-5.1';
    const reg = (r: [number, number][]): RegistroItem => ({ s, c: 'p', r });
    // one right answer is not mastery (pessimistic prior)
    const uno = dominioConcepto(s, [reg([[T0, 100]])], T0);
    expect(uno.precision).toBeCloseTo((1 + 0.45) / 2.5, 6);
    expect(uno.nivel).toBe('familiarizado');
    // more items right: higher
    const tres = dominioConcepto(s, [1, 2, 3].map(() => reg([[T0, 100]])), T0);
    expect(tres.precision).toBeGreaterThan(uno.precision);
    expect(tres.nivel).toBe('competente');
    // the same items right on three different days: more (spaced practice) and more stable
    const espaciado = dominioConcepto(s, [1, 2, 3].map(() => reg([[T0, 100], [T0 + 2 * DIA_MS, 100], [T0 + 6 * DIA_MS, 100]])), T0 + 6 * DIA_MS);
    expect(espaciado.precision).toBeGreaterThan(tres.precision);
    expect(espaciado.estabilidad).toBeGreaterThan(tres.estabilidad);
    expect(espaciado.nivel).toBe('dominado');
    // wrong answers: low
    expect(dominioConcepto(s, [reg([[T0, 0]]), reg([[T0, 0]])], T0).nivel).toBe('intentado');
    // forgetting: decreasing with time, never below half the accuracy, «para repasar» once retention < 0,7
    let previo = 2;
    for (const d of [0, 1, 3, 7, 30, 365, 5000]) {
      const x = dominioConcepto(s, [1, 2, 3].map(() => reg([[T0, 100]])), T0 + d * DIA_MS);
      expect(x.valor).toBeLessThanOrEqual(previo);
      expect(x.valor).toBeGreaterThanOrEqual(x.precision * 0.5 - 1e-12);
      expect(x.repasar).toBe(x.retencion < 0.7);
      previo = x.valor;
    }
    expect(dominioConcepto(s, [1, 2, 3].map(() => reg([[T0, 100]])), T0 + 7 * DIA_MS).repasar).toBe(true);
    // the latest round weighs most: failed long ago, right now > right long ago, failed now
    const mejora = dominioConcepto(s, [reg([[T0, 0], [T0 + DIA_MS, 100]])], T0 + DIA_MS);
    const empeora = dominioConcepto(s, [reg([[T0, 100], [T0 + DIA_MS, 0]])], T0 + DIA_MS);
    expect(mejora.valor).toBeGreaterThan(empeora.valor);
    expect(nivelDominio(0, false)).toBe('nuevo');
    expect([0.1, 0.4, 0.6, 0.8].map((v) => nivelDominio(v, true))).toEqual(['intentado', 'familiarizado', 'competente', 'dominado']);
    // a chapter: concepts without evidence count as 0
    const porC = dominioPorConcepto({ a: reg([[T0, 100]]), b: { s: 'cap05/sec-5.2', c: 'q', r: [[T0, 0]] } }, T0);
    const ag = agregar(['cap05/sec-5.1', 'cap05/sec-5.2', 'cap05/sec-5.3'], porC);
    expect(ag.total).toBe(3);
    expect(ag.practicados).toBe(2);
    expect(ag.cuenta.nuevo).toBe(1);
    expect(ag.valor).toBeCloseTo((porC['cap05/sec-5.1']!.valor + porC['cap05/sec-5.2']!.valor) / 3, 9);
  });

  test('fusión de dos dispositivos: unión conmutativa e idempotente', () => {
    const s = 'cap05/sec-5.1';
    const a: RegistroItem = { s, c: 'p', r: [[T0, 100], [T0 + DIA_MS, 0]] };
    const b: RegistroItem = { s, c: 'p', r: [[T0 + 2 * DIA_MS, 60], [T0, 100]] };
    const ab = fusionarRegistros(a, b);
    expect(ab.r).toEqual([
      [T0, 100],
      [T0 + DIA_MS, 0],
      [T0 + 2 * DIA_MS, 60],
    ]);
    expect(fusionarRegistros(b, a)).toEqual(ab);
    expect(fusionarRegistros(ab, ab)).toEqual(ab);
    expect(fusionarRegistros(ab, a)).toEqual(ab);
    // a provisional round settled on the other device
    expect(fusionarRegistros({ s, c: 'p', r: [[T0, 0, 1]] }, { s, c: 'p', r: [[T0, 60]] }).r).toEqual([[T0, 60]]);
  });
});

// ================================================================== pure: selection

/** A synthetic book: `capitulos` chapters of `secciones` sections, `items` per section of the given kinds. */
function libroSintetico(capitulos = 4, secciones = 5, items = 4) {
  const conceptos: ConceptoCandidato[] = [];
  const catalogo: ItemCatalogo[] = [];
  const tipos = ['practica', 'pregunta', 'practica', 'ejercicio'] as const;
  for (let c = 0; c < capitulos; c++) {
    for (let s = 0; s < secciones; s++) {
      const clave = `cap0${c}/sec-${c}.${s + 1}`;
      conceptos.push({ clave, parte: `cap0${c}`, orden: c * 1000 + s, dominio: null, leccion: false });
      for (let i = 0; i < items; i++) catalogo.push({ id: `${clave}#${i}`, tipo: tipos[i % 4]!, subtipo: `k${i % 3}`, concepto: clave });
    }
  }
  return { conceptos, catalogo, curso: Array.from({ length: capitulos }, (_, c) => `cap0${c}`) };
}
const dom = (valor: number, o: Partial<{ precision: number; retencion: number; ultima: number; repasar: boolean }> = {}) => ({
  valor,
  precision: o.precision ?? valor,
  retencion: o.retencion ?? 1,
  ultima: o.ultima ?? T0,
  nivel: nivelDominio(valor, true),
  repasar: o.repasar ?? false,
});

test.describe('práctica inteligente: selección (sin navegador)', () => {
  test('lo débil primero, con cupos, repaso de lo que se olvida y algo nuevo', () => {
    const b = libroSintetico();
    const c = b.conceptos;
    c[0]!.dominio = dom(0.2);
    c[1]!.dominio = dom(0.5);
    c[2]!.dominio = dom(0.35);
    c[3]!.dominio = dom(0.66, { precision: 0.9, retencion: 0.4, repasar: true });
    c[4]!.dominio = dom(0.9);
    const plan = planificar({ conceptos: c, curso: b.curso });
    const debiles = plan.conceptos.filter((x) => x.motivo === 'debil').map((x) => x.clave);
    // weakest first
    expect(debiles.slice(0, 3)).toEqual([c[0]!.clave, c[2]!.clave, c[1]!.clave]);
    expect(plan.conceptos.find((x) => x.clave === c[3]!.clave)?.motivo).toBe('repasar');
    expect(plan.conceptos.find((x) => x.clave === c[4]!.clave)?.motivo).toBe('dominado');
    expect(plan.conceptos.some((x) => x.motivo === 'nuevo')).toBe(true);
    expect(plan.conceptos.reduce((n, x) => n + x.cupo, 0)).toBe(10);
    const items = completar({ plan, items: b.catalogo, ultimas: {}, ahora: T0, semilla: 7 });
    expect(items).toHaveLength(10);
    // more items from the weak concepts than from anything else
    const deDebiles = items.filter((x) => x.motivo === 'debil').length;
    expect(deDebiles).toBeGreaterThanOrEqual(4);
    expect(new Set(items.map((x) => x.id)).size).toBe(10);
  });

  test('sin repeticiones recientes cuando hay alternativa, y fallos antiguos se vuelven a preguntar', () => {
    const b = libroSintetico(1, 2, 4);
    b.conceptos[0]!.dominio = dom(0.3);
    const ahora = T0 + 10 * DIA_MS;
    const ultimas: Record<string, { t: number; p: number }> = {
      [`${b.conceptos[0]!.clave}#0`]: { t: ahora - 2 * H, p: 0 }, // failed 2 h ago: too recent
      [`${b.conceptos[0]!.clave}#1`]: { t: ahora - 3 * DIA_MS, p: 0 }, // failed 3 days ago: retest first
      [`${b.conceptos[0]!.clave}#2`]: { t: ahora - 3 * DIA_MS, p: 100 },
    };
    const sel = seleccionar({ conceptos: b.conceptos, curso: b.curso, items: b.catalogo, ultimas, ahora, semilla: 3 });
    const ids = sel.map((x) => x.id);
    expect(ids).not.toContain(`${b.conceptos[0]!.clave}#0`);
    const delDebil = sel.filter((x) => x.concepto === b.conceptos[0]!.clave);
    expect(delDebil[0]!.id).toBe(`${b.conceptos[0]!.clave}#1`);
    // every item answered recently: nothing answered in the last 20 h is chosen while there is anything else
    for (let k = 0; k < 30; k++) {
      const lib = libroSintetico(2, 4, 3);
      const rnd = (n: number) => (Math.imul(k * 7919 + n, 2654435761) >>> 0) / 2 ** 32;
      lib.conceptos.forEach((x, i) => (x.dominio = rnd(i) < 0.6 ? dom(rnd(i + 99)) : null));
      const ult: Record<string, { t: number; p: number }> = {};
      lib.catalogo.forEach((it, i) => {
        if (rnd(i + 500) < 0.4) ult[it.id] = { t: ahora - rnd(i + 900) * 40 * H, p: rnd(i + 1300) < 0.5 ? 0 : 100 };
      });
      const s = seleccionar({ conceptos: lib.conceptos, curso: lib.curso, items: lib.catalogo, ultimas: ult, ahora, semilla: k });
      const libresQuedan = lib.catalogo.filter((it) => !ult[it.id] || ahora - ult[it.id]!.t >= RECIENTE_MS);
      for (const it of s) {
        const u = ult[it.id];
        // a recent one only when its concept had nothing else left
        if (u && ahora - u.t < RECIENTE_MS) expect(libresQuedan.filter((x) => x.concepto === it.concepto && !s.some((y) => y.id === x.id)).length, `${k}: ${it.id}`).toBe(0);
        expect(!u || ahora - u.t >= 3_600_000, `${k}: nunca en la última hora`).toBe(true);
      }
      expect(new Set(s.map((x) => x.id)).size).toBe(s.length);
      // interleaving: no two consecutive items of the same concept when it can be avoided (no concept holds
      // more than half of the items once the warm-up is set aside)
      const cuenta = new Map<string, number>();
      for (const x of s.slice(1)) cuenta.set(x.concepto, (cuenta.get(x.concepto) ?? 0) + 1);
      if (Math.max(0, ...cuenta.values()) * 2 <= s.length - 2) for (let i = 2; i < s.length; i++) expect(s[i]!.concepto === s[i - 1]!.concepto, `${k}: seguidos en ${i}`).toBe(false);
    }
  });

  test('prerrequisitos: lo nuevo sigue el orden del curso y no salta de capítulo', () => {
    const b = libroSintetico(4, 3, 2);
    // nothing touched: new material from the first chapter only, in order
    let nuevos = nuevosDisponibles(b.conceptos, b.curso);
    expect(new Set(nuevos.map((x) => x.parte))).toEqual(new Set(['cap00']));
    expect(nuevos.map((x) => x.clave)).toEqual(b.conceptos.slice(0, 3).map((x) => x.clave));
    // a section of chapter 2 studied (lesson): chapters 0–2 are open, earliest untouched first after the studied
    b.conceptos[6]!.leccion = true;
    nuevos = nuevosDisponibles(b.conceptos, b.curso);
    expect(nuevos[0]!.clave).toBe(b.conceptos[6]!.clave);
    expect(nuevos.every((x) => ['cap00', 'cap01', 'cap02'].includes(x.parte))).toBe(true);
    expect(nuevos.slice(1, 4).map((x) => x.clave)).toEqual(b.conceptos.slice(0, 3).map((x) => x.clave));
    // chapters 0–2 all touched: chapter 3 opens
    for (const x of b.conceptos.slice(0, 9)) x.dominio = dom(0.7);
    nuevos = nuevosDisponibles(b.conceptos, b.curso);
    expect(nuevos.map((x) => x.parte)).toEqual(['cap03', 'cap03', 'cap03']);
    // a whole session for a new reader: only chapter 0
    const s = seleccionar({ conceptos: libroSintetico(4, 3, 4).conceptos, curso: b.curso, items: libroSintetico(4, 3, 4).catalogo, ultimas: {}, ahora: T0, semilla: 1 });
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.concepto.startsWith('cap00/') && x.motivo === 'nuevo')).toBe(true);
  });

  test('tarjetas: solo vencidas, como mucho dos, nunca en lo nuevo', () => {
    const b = libroSintetico(1, 4, 2);
    b.conceptos.forEach((x, i) => (x.dominio = i < 3 ? dom(0.3 + i * 0.05) : null));
    const tarjetas: ItemCatalogo[] = [];
    for (const x of b.conceptos) for (let i = 0; i < 3; i++) tarjetas.push({ id: `t-${x.clave}-${i}`, tipo: 'tarjeta', subtipo: 'tarjeta', concepto: x.clave });
    for (let semilla = 0; semilla < 20; semilla++) {
      const s = seleccionar({ conceptos: b.conceptos, curso: b.curso, items: [...b.catalogo, ...tarjetas], ultimas: {}, ahora: T0, semilla });
      const t = s.filter((x) => x.tipo === 'tarjeta');
      expect(t.length).toBeLessThanOrEqual(2);
      expect(t.every((x) => x.motivo !== 'nuevo')).toBe(true);
    }
  });

  test('«Practicar esto»: una sección, completada con lo más débil del capítulo', () => {
    const b = libroSintetico(2, 4, 3);
    b.conceptos[1]!.dominio = dom(0.3);
    b.conceptos[2]!.dominio = dom(0.5);
    b.conceptos[5]!.dominio = dom(0.1); // another chapter: never
    const s = seleccionar({ conceptos: b.conceptos, curso: b.curso, alcance: { parte: 'cap00', label: 'sec-0.1' }, items: b.catalogo, ultimas: {}, ahora: T0, semilla: 4 });
    expect(s.filter((x) => x.concepto === 'cap00/sec-0.1')).toHaveLength(3);
    expect(s).toHaveLength(5);
    expect(s.every((x) => x.concepto.startsWith('cap00/'))).toBe(true);
    // a chapter: all of it, never another chapter
    const cap = seleccionar({ conceptos: b.conceptos, curso: b.curso, alcance: { parte: 'cap01' }, items: b.catalogo, ultimas: {}, ahora: T0, semilla: 4 });
    expect(cap.length).toBe(10);
    expect(cap.every((x) => x.concepto.startsWith('cap01/'))).toBe(true);
    expect(cap[0]!.concepto === 'cap01/sec-1.2' || cap.some((x) => x.concepto === 'cap01/sec-1.2' && x.motivo === 'debil')).toBe(true);
  });

  test('determinista con la semilla, y la semilla cambia la elección', () => {
    const b = libroSintetico(3, 6, 6);
    b.conceptos.forEach((x, i) => (x.dominio = i % 3 ? dom((i * 37) % 100 / 100) : null));
    const una = seleccionar({ conceptos: b.conceptos, curso: b.curso, items: b.catalogo, ultimas: {}, ahora: T0, semilla: 99 });
    const otra = seleccionar({ conceptos: [...b.conceptos].reverse(), curso: b.curso, items: [...b.catalogo].reverse(), ultimas: {}, ahora: T0, semilla: 99 });
    expect(otra.map((x) => x.id)).toEqual(una.map((x) => x.id));
    const distintas = new Set<string>();
    for (let s = 0; s < 12; s++) distintas.add(seleccionar({ conceptos: b.conceptos, curso: b.curso, items: b.catalogo, ultimas: {}, ahora: T0, semilla: s }).map((x) => x.id).join(','));
    expect(distintas.size).toBeGreaterThan(1);
  });
});

// ================================================================== pure: problem of the day

test.describe('problema del día (sin navegador)', () => {
  const fund = CURSOS[0]!;
  const cands: CandidatoProblema[] = [];
  for (const p of fund.partes)
    for (const it of practica(p).filter((x) => x.tipo === 'numerico')) cands.push({ id: it.id, k: 'practica', parte: it.parte, orden: fund.partes.indexOf(p) * 1000 });
  for (const [label, it] of Object.entries(EJERCICIOS)) if (it.modo === 'auto' && fund.partes.includes(it.parte)) cands.push({ id: label, k: 'ejercicio', parte: it.parte, orden: 99_000 });

  test('el mismo para el mismo día, curso y nivel; otro otro día; del nivel del lector', () => {
    const a = problemaDelDia('2026-10-30', fund, 0, cands);
    expect(a).toEqual(problemaDelDia('2026-10-30', fund, 0, [...cands].reverse()));
    expect(a!.k).toBe('practica');
    expect(a!.parte).toBe('cap00');
    const dias = new Set<string>();
    for (let d = 1; d <= 30; d++) dias.add(problemaDelDia(`2026-11-${String(d).padStart(2, '0')}`, fund, 3, cands)!.id);
    expect(dias.size).toBeGreaterThan(5);
    for (let d = 1; d <= 30; d++) {
      const x = problemaDelDia(`2026-11-${String(d).padStart(2, '0')}`, fund, 3, cands)!;
      expect(fund.partes.indexOf(x.parte)).toBeLessThanOrEqual(3);
      expect(x.semilla).toBe(problemaDelDia(`2026-11-${String(d).padStart(2, '0')}`, fund, 3, cands)!.semilla);
    }
    // avoids the recent ones while the pool allows it
    const hoy = problemaDelDia('2026-10-30', fund, 2, cands)!;
    expect(problemaDelDia('2026-10-30', fund, 2, cands, [hoy.id])!.id).not.toBe(hoy.id);
    // nothing for the course: anything of the book rather than nothing; nothing at all: null
    expect(problemaDelDia('2026-10-30', { id: 'x', partes: ['cap99'] }, 0, cands)).not.toBeNull();
    expect(problemaDelDia('2026-10-30', fund, 0, [])).toBeNull();
  });

  test('racha de días resueltos', () => {
    expect(rachaDias([], '2026-10-30')).toBe(0);
    expect(rachaDias(['2026-10-30'], '2026-10-30')).toBe(1);
    expect(rachaDias(['2026-10-28', '2026-10-29'], '2026-10-30')).toBe(2); // today still pending
    expect(rachaDias(['2026-10-28', '2026-10-29', '2026-10-30'], '2026-10-30')).toBe(3);
    expect(rachaDias(['2026-10-27', '2026-10-29', '2026-10-30'], '2026-10-30')).toBe(2);
    expect(rachaDias(['2026-10-31', '2026-11-01'], '2026-11-01')).toBe(2); // across months
  });

  test('XP, logros y aviso diario conectados', () => {
    expect(XP.problemaDia).toBeGreaterThan(0);
    expect(LOGROS.some((l) => l.id === 'problema-dia')).toBe(true);
    expect(LOGROS.some((l) => l.id === 'problemas-7')).toBe(true);
    const fuente = readFileSync(new URL('../src/lib/aprendizaje/recordatorio.ts', import.meta.url), 'utf8');
    expect(fuente).toMatch(/RUTA_RECORDATORIO = '#\/problema'/);
    expect(fuente).toMatch(/extra: \{ ruta: RUTA_RECORDATORIO \}/);
    expect(fuente).toMatch(/location\.hash = RUTA_RECORDATORIO/);
  });

  test('conceptos.json: las secciones con algo que responder, al día con los datos', () => {
    const c = leerJson<{ version: number; total: number; partes: Record<string, string[]> }>('conceptos.json');
    let n = 0;
    for (const [p, labels] of Object.entries(c.partes)) {
      const secs = (INDICE.partes[p]?.secciones ?? []).map((s) => s.label);
      for (const l of labels) expect(secs, `${p}/${l}`).toContain(l);
      n += labels.length;
    }
    expect(n).toBe(c.total);
    expect(c.total).toBeGreaterThan(600);
    for (const p of ['cap01', 'cap05', 'cap23']) for (const it of practica(p)) expect(c.partes[p], it.id).toContain(it.seccion);
    for (const p of ['cap05', 'cap24']) for (const q of cuestionario(p)) expect(c.partes[p], q.id).toContain(conceptoDe(p, q.ref)!.split('/')[1]);
  });
});

// ================================================================== browser: mastery

test.describe('dominio en la aplicación', () => {
  test.use({ viewport: TABLETA });

  test('las respuestas de una lección se anotan una vez por ronda, también tras recargar', async ({ page }) => {
    await preparar(page);
    await page.goto('#/leccion/cap05/sec-5.1/pregunta-1');
    await expect(page.locator('[data-pregunta]')).toBeVisible();
    const id = (await page.locator('[data-pregunta]').getAttribute('data-pregunta'))!;
    await responderPregunta(page, true);
    await expect.poll(async () => (await leer<Dominio>(page, 'dominio'))?.items[id]?.r.length ?? 0, { timeout: 15_000 }).toBe(1);
    const d1 = (await leer<Dominio>(page, 'dominio'))!;
    expect(d1.version).toBe(1);
    expect(d1.items[id]).toMatchObject({ s: conceptoDe('cap05', cuestionario('cap05').find((q) => q.id === id)!.ref), c: 'q' });
    expect(d1.items[id]!.r[0]![1]).toBe(100);
    // «Probar otra vez» and a reload that answers again within the round: the same record
    const otra = page.locator('[data-pregunta] button', { hasText: 'Probar otra vez' });
    if (await otra.count()) {
      await otra.click();
      await responderPregunta(page, false);
    }
    await page.reload();
    await expect(page.locator('[data-pregunta]')).toBeVisible();
    await page.waitForTimeout(1500);
    expect((await leer<Dominio>(page, 'dominio'))!.items[id]).toEqual(d1.items[id]);
    // the reader shows the section's mastery next to its title
    await page.goto('#/cap05/sec-5.1');
    await expect(page.locator('#sec-5\\.1 ~ * [data-marca-dominio], .seccion-cab [data-marca-dominio]').first()).toBeVisible({ timeout: 15_000 });
    const href = await page.locator('[data-marca-dominio]').first().getAttribute('href');
    expect(href).toBe('#/practicar/cap05/sec-5.1');
  });

  test('migración: lo ya guardado se convierte en rondas una vez, sin tocar los otros almacenes', async ({ page }) => {
    const T = Date.now() - 5 * DIA_MS;
    const pr = practica('cap01').find((x) => x.seccion === 'sec-1.4')!;
    const ej = Object.entries(EJERCICIOS).find(([, e]) => e.parte === 'cap05' && e.modo === 'auto' && e.seccion)!;
    const datos = {
      'progreso-xp': { version: 1, xp: { 'pq:cap05-01': { x: 10, t: T }, [`pr:${pr.id}`]: { x: 5, t: T + H }, 'l:cap05/sec-5.1': { x: 20, t: T } }, logros: {} },
      'repaso-fallos': { 'cap05-04': { parte: 'cap05', t: T + 2 * H, veces: 2 } },
      ejercicios: { [ej[0]]: { intentos: 2, fallos: 1, resuelto: true, pistas: 0, solucion: false, t: T + 3 * H } },
    };
    await preparar(page, datos);
    await page.goto('#/progreso/dominio');
    await expect.poll(async () => (await leer<Dominio>(page, 'dominio'))?.migrado ?? 0, { timeout: 20_000 }).toBeGreaterThan(0);
    const d = (await leer<Dominio>(page, 'dominio'))!;
    expect(d.items['cap05-01']).toEqual({ s: 'cap05/sec-5.1', c: 'q', r: [[T, 100]] });
    expect(d.items[pr.id]).toEqual({ s: 'cap01/sec-1.4', c: 'p', r: [[T + H, 60]] });
    expect(d.items['cap05-04']).toEqual({ s: conceptoDe('cap05', cuestionario('cap05').find((q) => q.id === 'cap05-04')!.ref), c: 'q', r: [[T + 2 * H, 0]] });
    expect(d.items[ej[0]]).toEqual({ s: `cap05/${ej[1].seccion}`, c: 'e', r: [[T + 3 * H, 60]] });
    expect(Object.keys(d.items)).toHaveLength(4);
    // the old stores are read only
    expect(await leer(page, 'repaso-fallos')).toEqual(datos['repaso-fallos']);
    expect(await leer(page, 'ejercicios')).toEqual(datos.ejercicios);
    // the page shows the weakest first
    await expect(page.locator('[data-concepto-debil]').first()).toBeVisible();
    // once: a reload adds nothing
    await page.reload();
    await page.waitForTimeout(2000);
    expect((await leer<Dominio>(page, 'dominio'))!.items).toEqual(d.items);
    expect((await leer<Dominio>(page, 'dominio'))!.migrado).toBe(d.migrado);
  });

  test('marcas de dominio en el índice, el lector y los cursos', async ({ page }) => {
    const ahora = Date.now();
    await preparar(page, {
      dominio: {
        version: 1,
        migrado: 1,
        items: {
          'cap05-01': { s: 'cap05/sec-5.1', c: 'q', r: [[ahora - 3 * DIA_MS, 100], [ahora - DIA_MS, 100]] },
          'cap05-02': { s: 'cap05/sec-5.1', c: 'q', r: [[ahora - DIA_MS, 100]] },
          'cap05-04': { s: 'cap05/sec-5.2', c: 'q', r: [[ahora - DIA_MS, 0]] },
        },
      },
    });
    // the book's index (the side panel of the desktop layout): a mastery mark on the practised sections
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('#/cap05/sec-5.1');
    await expect(page.locator('.secciones a[href*="sec-5.2"] .pin.dominio [data-nivel-dominio="intentado"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.secciones a[href*="sec-5.3"] .pin.dominio')).toHaveCount(0);
    await page.setViewportSize(TABLETA);
    await page.goto('#/cursos/fundamentos');
    await expect(page.locator('[data-dominio-curso="fundamentos"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-capitulo="cap05"] .cab-cap').click();
    await expect(page.locator('[data-dominio-capitulo="cap05"]')).toBeVisible();
    await expect(page.locator('[data-leccion-curso="cap05/sec-5.2"] [data-nivel-dominio="intentado"]')).toBeVisible();
    await page.goto('#/progreso/dominio');
    await expect(page.locator('[data-concepto-debil]').first()).toHaveAttribute('data-concepto-debil', 'cap05/sec-5.2');
    await expect(page.locator('[data-cuenta-nivel]')).toHaveCount(4);
    await page.locator('[data-dominio-curso="fundamentos"] .fila').click();
    await expect(page.locator('[data-dominio-capitulo="cap05"]')).toBeVisible();
    await page.locator('[data-concepto-debil] [data-practicar-esto]').first().click();
    await expect(page).toHaveURL(/#\/practicar\/cap05\/sec-5\.2$/);
    await expect(page.locator('[data-intro-sesion]')).toBeVisible({ timeout: 20_000 });
    const conceptos = await page.locator('[data-intro-sesion] [data-concepto]').evaluateAll((l) => l.map((e) => e.getAttribute('data-concepto')));
    expect(conceptos[0]).toBe('cap05/sec-5.2');
    expect(conceptos.every((c) => c!.startsWith('cap05/'))).toBe(true);
  });
});

// ================================================================== browser: smart practice

test.describe('práctica inteligente', () => {
  test.use({ viewport: TABLETA });

  const sembrado = () => {
    const ahora = Date.now();
    return {
      dominio: {
        version: 1,
        migrado: 1,
        items: {
          // weak: failed two days ago
          'cap05-01': { s: 'cap05/sec-5.1', c: 'q', r: [[ahora - 2 * DIA_MS, 0]] },
          'cap05-03': { s: 'cap05/sec-5.1', c: 'q', r: [[ahora - 2 * DIA_MS, 0]] },
          // known but decaying: right long ago
          'cap05-04': { s: 'cap05/sec-5.2', c: 'q', r: [[ahora - 40 * DIA_MS, 100]] },
          'cap05-05': { s: 'cap05/sec-5.2', c: 'q', r: [[ahora - 40 * DIA_MS, 100]] },
          'cap05-07': { s: 'cap05/sec-5.2', c: 'q', r: [[ahora - 40 * DIA_MS, 100]] },
        },
      },
      lecciones: { 'cap05/sec-5.1': { h: [0], u: 1, n: 1, c: ahora - 3 * DIA_MS, t: ahora - 3 * DIA_MS } },
    };
  };

  test('una sesión: lo débil primero, determinista, y al final lo que ha mejorado', async ({ page }) => {
    test.setTimeout(240_000);
    await preparar(page, sembrado(), 4242);
    await page.goto('#/practicar');
    await expect(page.locator('[data-intro-sesion]')).toBeVisible({ timeout: 30_000 });
    const lista = async () => page.locator('[data-intro-sesion] [data-concepto]').evaluateAll((l) => l.map((e) => e.getAttribute('data-concepto')));
    const primera = await lista();
    expect(primera[0]).toBe('cap05/sec-5.1');
    expect(primera).toContain('cap05/sec-5.2');
    await expect(page.locator('[data-motivo="debil"]')).toBeVisible();
    await expect(page.locator('[data-motivo="repasar"]')).toBeVisible();
    // the same seed, the same session
    await page.reload();
    await expect(page.locator('[data-intro-sesion]')).toBeVisible({ timeout: 30_000 });
    expect(await lista()).toEqual(primera);
    await sinDesborde(page, 'práctica · intro');

    await page.locator('[data-empezar-sesion]').click();
    const vistos: string[] = [];
    let respondidas = 0;
    for (let i = 0; i < 12; i++) {
      const cuerpo = page.locator('.cuerpo[data-item]');
      await expect(cuerpo).toBeVisible();
      const id = (await cuerpo.getAttribute('data-item'))!;
      vistos.push(id);
      if ((await cuerpo.getAttribute('data-item-tipo')) === 'pregunta') {
        await responderPregunta(page, true);
        respondidas++;
        await page.locator('[data-continuar]').click();
      } else await page.locator('[data-saltar]').click();
      // the next item (or the end) is on screen
      await expect
        .poll(async () => ((await page.locator('[data-fin-sesion]').isVisible()) ? 'fin' : await page.locator('.cuerpo[data-item]').getAttribute('data-item')), { message: `tras ${id}` })
        .not.toBe(id);
      if (await page.locator('[data-fin-sesion]').isVisible()) break;
    }
    // never the same item twice in a session
    expect(new Set(vistos).size).toBe(vistos.length);
    await expect(page.locator('[data-fin-sesion]')).toBeVisible();
    expect(respondidas).toBeGreaterThan(0);
    // the answers are learning events like any other practice (origin «inteligente»)
    const ev = (await eventos(page)).filter((e) => e.tipo === 'respuesta' && e.origen === 'inteligente');
    expect(ev.length).toBe(respondidas);
    // what improved: at least one concept up
    await expect(page.locator('[data-mejora]').first()).toBeVisible({ timeout: 15_000 });
    expect(Number(await page.locator('[data-fin-sesion]').getAttribute('data-subieron'))).toBeGreaterThan(0);
    // (the mastery records are written after a pause: polled)
    await expect
      .poll(async () => {
        const d = (await leer<Dominio>(page, 'dominio'))!;
        return Object.values(d.items).some((x) => x.r.some(([t, p]) => p === 100 && Date.now() - t < 10 * 60_000));
      })
      .toBe(true);
    await sinDesborde(page, 'práctica · fin');
  });

  test('un lector nuevo empieza por su curso, en orden', async ({ page }) => {
    await preparar(page, {}, 7);
    await page.goto('#/practicar');
    await expect(page.locator('[data-intro-sesion]')).toBeVisible({ timeout: 30_000 });
    const conceptos = await page.locator('[data-intro-sesion] [data-concepto]').evaluateAll((l) => l.map((e) => e.getAttribute('data-concepto')!));
    expect(conceptos.length).toBeGreaterThan(0);
    expect(conceptos.every((c) => c.startsWith('cap00/'))).toBe(true);
    await expect(page.locator('[data-motivo="nuevo"]')).toBeVisible();
  });
});

// ================================================================== browser: problem of the day

test.describe('problema del día', () => {
  test.use({ viewport: TABLETA });
  const HOY = new Date(2026, 9, 30, 10, 0, 0);

  /** Types the right result of the numeric problem on screen. */
  async function resolver(page: Page, bien = true): Promise<void> {
    const n = page.locator('.numerico[data-resultado]').first();
    const v = Number(await n.getAttribute('data-resultado'));
    await n.locator('[data-numero]').fill(bien ? String(Number(v.toPrecision(6))).replace('.', ',') : '987654321');
    await n.locator('[data-comprobar]').click();
  }

  test('el mismo todo el día y en otro dispositivo; resolverlo da XP, logro y racha; sin red', async ({ browser }) => {
    test.setTimeout(240_000);
    const externas: string[] = [];
    const abrir = async (fecha: Date, datos: Record<string, unknown> = {}) => {
      const ctx = await browser.newContext({ viewport: TABLETA });
      ctx.on('request', (r) => {
        if (!r.url().startsWith('http://localhost')) externas.push(r.url());
      });
      await preparar(ctx, datos);
      const page = await ctx.newPage();
      await page.clock.setFixedTime(fecha);
      return { ctx, page };
    };
    const a = await abrir(HOY, {
      'problema-dia': { version: 1, dias: {} },
    });
    await a.page.goto('#/problema');
    await expect(a.page.locator('[data-problema-dia="2026-10-30"][data-estado="listo"]')).toBeVisible({ timeout: 30_000 });
    const delDia = async (p: Page, d: string) => {
      await expect.poll(async () => !!(await leer<{ dias: Record<string, unknown> }>(p, 'problema-dia'))?.dias?.[d], { timeout: 10_000 }).toBe(true);
      return (await leer<{ dias: Record<string, { id: string; semilla: number }> }>(p, 'problema-dia'))!.dias[d]!;
    };
    const elegido = await delDia(a.page, '2026-10-30');
    expect(elegido.id).toBeTruthy();
    const enunciado = await a.page.locator('[data-enunciado]').innerText();

    // another reader with the same course and level on the same day: the same problem, the same values
    const b = await abrir(HOY);
    await b.page.goto('#/problema');
    await expect(b.page.locator('[data-estado="listo"]')).toBeVisible({ timeout: 30_000 });
    expect(await delDia(b.page, '2026-10-30')).toMatchObject({ id: elegido.id, semilla: elegido.semilla });
    expect(await b.page.locator('[data-enunciado]').innerText()).toBe(enunciado);
    await b.ctx.close();

    // the day after: another day stored (and another seed)
    const c = await abrir(new Date(2026, 9, 31, 10, 0, 0));
    await c.page.goto('#/problema');
    await expect(c.page.locator('[data-problema-dia="2026-10-31"][data-estado="listo"]')).toBeVisible({ timeout: 30_000 });
    expect((await delDia(c.page, '2026-10-31')).semilla).not.toBe(elegido.semilla);
    await c.ctx.close();

    // solve it
    await resolver(a.page, true);
    await expect(a.page.locator('[data-problema-dia]')).toHaveAttribute('data-resuelto', 'bien');
    await expect(a.page.locator('[data-veredicto-dia]')).toBeVisible();
    await expect.poll(async () => (await leer<{ xp: Record<string, { x: number }> }>(a.page, 'progreso-xp'))?.xp['pd:2026-10-30']?.x ?? 0, { timeout: 15_000 }).toBe(XP.problemaDia);
    await expect.poll(async () => (await leer<{ logros: Record<string, number> }>(a.page, 'progreso-xp'))?.logros['problema-dia'] ?? 0).toBeGreaterThan(0);
    const ev = (await eventos(a.page)).filter((e) => e.tipo === 'problema-dia');
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ dia: '2026-10-30', id: elegido.id, correcta: true, racha: 1 });
    expect((await eventos(a.page)).some((e) => e.tipo === 'respuesta' && e.origen === 'problema-dia')).toBe(true);
    // no «otro con otros valores»: one problem a day
    await expect(a.page.locator('[data-otra-vez]')).toHaveCount(0);

    // a reload: solved, with the solution of the day, and the start page says so
    await a.page.reload();
    await expect(a.page.locator('[data-solucion-dia] [data-solucion]')).toBeVisible({ timeout: 30_000 });
    await expect(a.page.locator('[data-problema-dia]')).toHaveAttribute('data-resuelto', 'bien');
    await a.page.goto('#/');
    await expect(a.page.locator('[data-problema-inicio="bien"]')).toBeVisible({ timeout: 20_000 });

    // offline: the stored problem still opens (nothing needs the network)
    await a.ctx.setOffline(true);
    await a.page.goto('#/problema');
    await expect(a.page.locator('[data-estado="listo"]')).toBeVisible({ timeout: 20_000 });
    await expect(a.page.locator('[data-solucion-dia]')).toBeVisible();
    await a.ctx.setOffline(false);
    expect(externas).toEqual([]);
    await a.ctx.close();
  });

  test('racha, fallo y la solución de ayer', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ viewport: TABLETA });
    const id = 'cap00-num-carga-rc';
    const dias = {
      '2026-10-28': { id, k: 'practica', parte: 'cap00', semilla: 11, curso: 'fundamentos', t: 1, r: { bien: true, intentos: 1, t: 2 } },
      '2026-10-29': { id: 'cap00-num-descarga-rc', k: 'practica', parte: 'cap00', semilla: 12, curso: 'fundamentos', t: 3, r: { bien: true, intentos: 1, t: 4 } },
    };
    await preparar(ctx, { 'problema-dia': { version: 1, dias } });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(HOY);
    await page.goto('#/problema');
    await expect(page.locator('[data-estado="listo"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-racha-problemas]')).toHaveAttribute('data-racha-problemas', '2');
    await resolver(page, true);
    await expect(page.locator('[data-racha-problemas]')).toHaveAttribute('data-racha-problemas', '3');
    expect((await eventos(page)).find((e) => e.tipo === 'problema-dia')).toMatchObject({ racha: 3 });
    // yesterday's: its values (seed 12) and the solution, without answering
    await page.goto('#/problema/ayer');
    await expect(page.locator('[data-problema-dia="2026-10-29"] [data-solucion]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.numerico')).toHaveAttribute('data-semilla', '12');
    await expect(page.locator('[data-problema-hoy]')).toBeVisible();
    await ctx.close();

    // a wrong answer (twice): the day is answered but not solved, no XP for it, the streak breaks
    const ctx2 = await browser.newContext({ viewport: TABLETA });
    await preparar(ctx2, { 'problema-dia': { version: 1, dias } });
    const p2 = await ctx2.newPage();
    await p2.clock.setFixedTime(HOY);
    await p2.goto('#/problema');
    await expect(p2.locator('[data-estado="listo"]')).toBeVisible({ timeout: 30_000 });
    await resolver(p2, false);
    await expect(p2.locator('[data-reintento]')).toBeVisible();
    await resolver(p2, false);
    await expect(p2.locator('[data-problema-dia]')).toHaveAttribute('data-resuelto', 'mal');
    await p2.waitForTimeout(800);
    expect((await leer<{ xp: Record<string, unknown> }>(p2, 'progreso-xp'))?.xp['pd:2026-10-30']).toBeUndefined();
    await ctx2.close();
  });
});

// ================================================================== browser: live figures inside lessons

test.describe('figuras vivas en las lecciones', () => {
  test.use({ viewport: TABLETA });

  test('mover un valor cambia la lectura; fuera de pantalla no se simula', async ({ page }) => {
    test.setTimeout(180_000);
    await preparar(page);
    // outside a lesson the same figure has no «explore» row
    await page.goto('#/cap01/sec-1.4');
    const fig = page.locator('[data-figura-viva="1.4"]').first();
    await fig.scrollIntoViewIfNeeded();
    await expect(page.locator('.figura:has([data-figura-viva="1.4"]) [data-explora]')).toHaveCount(0);

    // in the lesson, step by step until the figure
    await page.goto('#/leccion/cap01/sec-1.4');
    let ex = page.locator('[data-explora]').first();
    for (let i = 0; i < 15 && !(await ex.count()); i++) {
      const f = page.locator('[data-figura-viva]');
      if (await f.count()) {
        await f.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(1200);
        if (await ex.count()) break;
      }
      const c = page.locator('[data-continuar]');
      if (await c.isEnabled()) await c.click();
      else await page.locator('[data-saltar]').click();
      await page.waitForTimeout(500);
    }
    await expect(ex).toBeVisible({ timeout: 20_000 });
    // the slider item of the section says what to move and what to watch (R1 → Vsal)
    await expect(ex).toHaveAttribute('data-explora', 'E2');
    await expect(ex).toHaveAttribute('data-observa', 'nodo:N2');
    await expect(ex.locator('.ex-reto')).toContainText('Mueva R');
    const lectura = ex.locator('[data-lectura]');
    const antes = Number(await lectura.getAttribute('data-lectura'));
    expect(antes).toBeCloseTo(4, 2);
    await ex.scrollIntoViewIfNeeded();
    const r = ex.locator('input[type=range]');
    await r.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(await lectura.getAttribute('data-lectura')), { timeout: 20_000 }).toBeLessThan(antes - 0.01);
    await expect(ex.locator('[data-conclusion]')).toContainText('baja');
    await expect(lectura).toHaveAttribute('data-sentido', 'baja');
    const n = Number(await ex.getAttribute('data-simulaciones'));
    expect(n).toBeGreaterThan(0);

    // off screen: a change waits; nothing runs until it is seen again
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('h1').first().scrollIntoViewIfNeeded();
    const fueraDePantalla = await ex.evaluate((el) => {
      const b = el.closest('.figura')!.querySelector('[data-figura-viva]')!.getBoundingClientRect();
      return b.bottom < 0 || b.top > innerHeight;
    });
    if (!fueraDePantalla) {
      // the step is short: push the figure out of view with room below
      await page.evaluate(() => {
        const d = document.createElement('div');
        d.style.height = '3000px';
        d.id = 'relleno-prueba';
        document.querySelector('.cab-paso')!.after(d);
      });
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.waitForTimeout(400);
    await r.evaluate((el: HTMLInputElement) => {
      el.value = String(Number(el.value) + 3);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(1200);
    expect(Number(await ex.getAttribute('data-simulaciones'))).toBe(n);
    await expect(ex).toHaveAttribute('data-pendiente', '1');
    await ex.scrollIntoViewIfNeeded();
    await expect.poll(async () => Number(await ex.getAttribute('data-simulaciones')), { timeout: 15_000 }).toBe(n + 1);
    await expect(ex).toHaveAttribute('data-pendiente', '0');
    // back to the book
    await ex.locator('[data-explora-libro]').click();
    await expect.poll(async () => Number(await lectura.getAttribute('data-lectura'))).toBeCloseTo(antes, 2);
  });
});

test.describe('figuras vivas en las lecciones · sin saltos', () => {
  for (const tam of [TABLETA, MOVIL]) {
    test(`la fila «explore» tiene su sitio desde el principio (${tam.width} px)`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: tam });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        const w = window as unknown as { __cls: number };
        w.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto('#/leccion/cap01/sec-1.4/5');
      await expect(page.locator('[data-explora]')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
      await sinDesborde(page, 'lección con figura explorable');
      await ctx.close();
    });
  }
});

// ================================================================== synchronisation

const TOKEN = ['github', 'pat', '11PRUEBA0123456789abcdefghijklmnopqrstuvwxyz'].join('_');
const DATOS = 'Metalaria/electronica-datos';

/** A minimal in-memory GitHub Contents API (as in sincronizacion.spec.ts and grupoA11.spec.ts). */
class FakeGitHub {
  ficheros = new Map<string, { sha: string; texto: string }>();
  doc(): { almacenes: Record<string, Record<string, { t: number; v?: unknown; x?: number }>> } | null {
    const f = this.ficheros.get(`${DATOS}/sincronizacion/datos.json`);
    return f ? JSON.parse(f.texto) : null;
  }
  async atender(route: Route): Promise<void> {
    const req = route.request();
    const url = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Accept, Content-Type, X-GitHub-Api-Version', 'access-control-allow-methods': 'GET, PUT, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (status: number, cuerpo: unknown) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(cuerpo) });
    const m = /^\/repos\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(url.pathname);
    if (!m) return json(404, { message: 'Not Found' });
    const repo = `${m[1]}/${m[2]}`;
    const resto = m[3] ?? '';
    if (!resto) return json(200, { full_name: repo, private: true });
    if (resto === 'releases/latest') return json(404, { message: 'Not Found' });
    const c = /^contents\/(.+)$/.exec(resto);
    if (!c || repo !== DATOS) return json(404, { message: 'Not Found' });
    const clave = `${repo}/${decodeURIComponent(c[1]!)}`;
    const f = this.ficheros.get(clave);
    if (req.method() === 'GET') {
      if (!f) return json(404, { message: 'Not Found' });
      return json(200, { type: 'file', sha: f.sha, encoding: 'base64', content: Buffer.from(f.texto, 'utf8').toString('base64'), size: f.texto.length });
    }
    const cuerpo = JSON.parse(req.postData() ?? '{}') as { content: string; sha?: string };
    if (f && cuerpo.sha !== f.sha) return json(409, { message: 'sha mismatch' });
    const texto = Buffer.from(cuerpo.content, 'base64').toString('utf8');
    const sha = createHash('sha1').update(texto).digest('hex');
    this.ficheros.set(clave, { sha, texto });
    return json(f ? 200 : 201, { content: { sha } });
  }
}

async function dispositivo(browser: Browser, gh: FakeGitHub, datos: Record<string, unknown>): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.route('https://api.github.com/**', (r) => gh.atender(r));
  const page = await ctx.newPage();
  await page.goto('./#/');
  await page.evaluate(
    ({ datos, token }) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(datos)) localStorage.setItem('epa:' + k, JSON.stringify(v));
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa-credencial:github', token);
    },
    { datos, token: TOKEN },
  );
  await page.goto('./#/sincronizacion');
  await page.reload();
  await expect(page.locator('[data-pagina="sincronizacion"]')).toBeVisible();
  return { ctx, page };
}

async function sincronizarAhora(page: Page): Promise<void> {
  const pag = page.locator('[data-pagina="sincronizacion"]');
  const n = Number(await pag.getAttribute('data-ejecuciones'));
  await page.locator('[data-sincronizar]').click();
  await expect(pag).toHaveAttribute('data-ejecuciones', String(n + 1));
}

test.describe('sincronización del dominio y del problema del día', () => {
  test('ida y vuelta: las rondas de los dos dispositivos se suman', async ({ browser }) => {
    test.setTimeout(180_000);
    const gh = new FakeGitHub();
    const T = 1761400000000;
    const dias = { '2026-10-29': { id: 'cap00-num-carga-rc', k: 'practica', parte: 'cap00', semilla: 5, curso: 'fundamentos', t: T, r: { bien: true, intentos: 1, t: T + 1000 } } };
    const a = await dispositivo(browser, gh, {
      dominio: { version: 1, migrado: 1, items: { 'cap05-01': { s: 'cap05/sec-5.1', c: 'q', r: [[T, 100]] }, 'cap05-02': { s: 'cap05/sec-5.1', c: 'q', r: [[T, 0]] } } },
      'problema-dia': { version: 1, dias },
    });
    await sincronizarAhora(a.page);
    const doc = gh.doc()!;
    expect(Object.keys(doc.almacenes.dominio!).sort()).toEqual(['cap05-01', 'cap05-02']);
    expect(doc.almacenes['problema-dia']!['2026-10-29']).toBeTruthy();

    // B answered cap05-01 on another day (later): its item is newer, so B keeps it and the file takes it
    const b = await dispositivo(browser, gh, {
      dominio: { version: 1, migrado: 1, items: { 'cap05-01': { s: 'cap05/sec-5.1', c: 'q', r: [[T + 3 * DIA_MS, 0]] } } },
    });
    await sincronizarAhora(b.page);
    const db = (await leer<Dominio>(b.page, 'dominio'))!;
    expect(db.items['cap05-02']!.r).toEqual([[T, 0]]);
    expect((await leer<{ dias: Record<string, unknown> }>(b.page, 'problema-dia'))!.dias['2026-10-29']).toEqual(dias['2026-10-29']);
    const union = [
      [T, 100],
      [T + 3 * DIA_MS, 0],
    ];
    // A receives B's newer version and keeps its own rounds too (union, not overwrite)…
    await sincronizarAhora(a.page);
    expect((await leer<Dominio>(a.page, 'dominio'))!.items['cap05-01']!.r).toEqual(union);
    // …which it sends on its next run, and B gets: nothing lost on either device
    await sincronizarAhora(a.page);
    await sincronizarAhora(b.page);
    expect((await leer<Dominio>(b.page, 'dominio'))!.items['cap05-01']!.r).toEqual(union);
    expect((await leer<Dominio>(a.page, 'dominio'))!.items['cap05-02']!.r).toEqual([[T, 0]]);
    await a.ctx.close();
    await b.ctx.close();
  });
});

// ================================================================== layout and screenshots

test.describe('capturas y maquetación', () => {
  for (const [nombre, tam] of [
    ['tableta', TABLETA],
    ['movil', MOVIL],
  ] as const) {
    for (const tema of ['claro', 'oscuro'] as const) {
      test(`pantallas nuevas · ${nombre} · ${tema}`, async ({ browser }) => {
        test.setTimeout(300_000);
        const ctx = await browser.newContext({ viewport: tam, colorScheme: tema === 'oscuro' ? 'dark' : 'light', deviceScaleFactor: 1, hasTouch: nombre === 'movil', isMobile: nombre === 'movil' });
        const ahora = Date.now();
        const items: Record<string, RegistroItem> = {};
        const q = (id: string, s: string, r: [number, number][]) => (items[id] = { s, c: 'q', r });
        q('cap05-01', 'cap05/sec-5.1', [[ahora - 2 * DIA_MS, 0]]);
        q('cap05-02', 'cap05/sec-5.1', [[ahora - 2 * DIA_MS, 100]]);
        q('cap05-04', 'cap05/sec-5.2', [[ahora - 30 * DIA_MS, 100], [ahora - 20 * DIA_MS, 100]]);
        q('cap05-05', 'cap05/sec-5.2', [[ahora - 30 * DIA_MS, 100]]);
        q('cap01-01', conceptoDe('cap01', cuestionario('cap01')[0]!.ref)!, [[ahora - 5 * DIA_MS, 100], [ahora - 2 * DIA_MS, 100], [ahora - DIA_MS, 100]]);
        q('cap01-02', conceptoDe('cap01', cuestionario('cap01')[1]!.ref)!, [[ahora - DIA_MS, 60]]);
        q('cap02-01', conceptoDe('cap02', cuestionario('cap02')[0]!.ref)!, [[ahora - 3 * DIA_MS, 100], [ahora - DIA_MS, 100]]);
        await preparar(ctx, {
          dominio: { version: 1, migrado: 1, items },
          lecciones: { 'cap05/sec-5.1': { h: [0], u: 1, n: 1, c: ahora - 3 * DIA_MS, t: ahora - 3 * DIA_MS } },
          'problema-dia': { version: 1, dias: { [dia(1)]: { id: 'cap00-num-carga-rc', k: 'practica', parte: 'cap00', semilla: 3, curso: 'fundamentos', t: 1, r: { bien: true, intentos: 1, t: 2 } } } },
        });
        const page = await ctx.newPage();
        const foto = async (n: string) => {
          await sinDesborde(page, `${n} · ${nombre} · ${tema}`);
          await page.screenshot({ path: `${CAPTURAS}${n}-${nombre}-${tema}.png`, fullPage: false });
        };
        await page.goto('#/');
        await expect(page.locator('[data-problema-inicio="pendiente"]')).toBeVisible({ timeout: 30_000 });
        await page.locator('[data-problema-inicio]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        await foto('inicio');
        await page.locator('[data-practica-inicio]').scrollIntoViewIfNeeded();
        await foto('inicio-practica');

        await page.goto('#/problema');
        await expect(page.locator('[data-estado="listo"]')).toBeVisible({ timeout: 30_000 });
        await foto('problema');
        const n = page.locator('.numerico[data-resultado]').first();
        await n.locator('[data-numero]').fill(String(Number(Number(await n.getAttribute('data-resultado')).toPrecision(6))).replace('.', ','));
        await n.locator('[data-comprobar]').click();
        await expect(page.locator('[data-veredicto-dia]')).toBeVisible();
        await page.waitForTimeout(700);
        await foto('problema-resuelto');
        await page.goto('#/problema/ayer');
        await expect(page.locator('[data-solucion]')).toBeVisible({ timeout: 30_000 });
        await foto('problema-ayer');

        await page.goto('#/progreso/dominio');
        await expect(page.locator('[data-concepto-debil]').first()).toBeVisible({ timeout: 20_000 });
        await foto('dominio');
        await page.locator('[data-dominio-curso="fundamentos"] .fila').click();
        await page.locator('[data-dominio-curso="fundamentos"]').scrollIntoViewIfNeeded();
        await foto('dominio-cursos');

        await page.goto('#/practicar');
        await expect(page.locator('[data-intro-sesion]')).toBeVisible({ timeout: 30_000 });
        await foto('practica-intro');
        await page.locator('[data-empezar-sesion]').click();
        await expect(page.locator('.cuerpo[data-item]')).toBeVisible();
        await page.waitForTimeout(800);
        await foto('practica-item');
        for (let i = 0; i < 12 && !(await page.locator('[data-fin-sesion]').isVisible()); i++) {
          const tipo = await page.locator('.cuerpo[data-item]').getAttribute('data-item-tipo');
          if (tipo === 'pregunta') {
            await responderPregunta(page, true);
            if (i < 3) await foto('practica-pregunta');
            await page.locator('[data-continuar]').click();
          } else {
            if (tipo === 'tarjeta') await foto('practica-tarjeta');
            await page.locator('[data-saltar]').click();
          }
        }
        await expect(page.locator('[data-mejora]').first()).toBeVisible({ timeout: 20_000 });
        await foto('practica-fin');

        await page.goto('#/cursos/fundamentos');
        await page.locator('[data-capitulo="cap05"] .cab-cap').click();
        await page.locator('[data-capitulo="cap05"]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await foto('curso-dominio');
        await page.goto('#/cap05/sec-5.1');
        await expect(page.locator('[data-marca-dominio]').first()).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(500);
        await foto('lector-dominio');

        await page.goto('#/leccion/cap01/sec-1.4/5');
        const ex = page.locator('[data-explora]').first();
        await page.locator('[data-figura-viva]').first().scrollIntoViewIfNeeded();
        await expect(ex).toBeVisible({ timeout: 30_000 });
        await ex.locator('input[type=range]').focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await expect(ex.locator('[data-conclusion]')).toBeVisible({ timeout: 20_000 });
        await ex.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await foto('leccion-explora');
        await ctx.close();
      });
    }
  }
});
