// «Práctica inteligente» and «Problema del día» (0.11, group B): which items to practise. Pure module (types
// only): the tests import it directly, with a fixed seed every choice is reproducible.
//
// Smart practice, in two steps (so the app only loads the data of the chapters it is going to use):
//   1. planificar(): which concepts (book sections) and how many items each. Four buckets, in this priority:
//        débiles   practised, mastery < 0,6 (weakest first)                    4 of 10 items
//        repasar   known (accuracy ≥ 0,6) but decaying (retention < 0,7)       3
//        nuevos    never practised, in the order of the current course         2
//        dominados competent or mastered and not decaying (least recent first) 1
//      Slots a bucket cannot fill go to the others in that same priority. Prerequisites: new material comes only
//      from the course's chapters up to the furthest one the reader has touched (lessons completed or passed,
//      answers), the earliest untouched sections first, and from the next chapter only once every section of the
//      chapters before has been touched. A focus («Practicar esto»: a chapter or a section) limits everything to it.
//   2. completar(): the items of each chosen concept. Never one answered in the last 20 h when the concept has
//      another (and never one answered in the last hour); weak concepts retest the items failed before, decaying
//      and mastered ones review the right ones answered longest ago, new ones start with unanswered items; kinds
//      are mixed; at most two glossary flashcards (only cards already due, never new ones) of the chosen concepts.
//      Finally the order: a warm-up from what is known, then no two items of the same concept in a row.
//
// Problem of the day: problemaDelDia() — deterministic per day, course and level (the furthest chapter reached).

/** What can be practised (1.1: `leccion11`, a card of a hand-authored lesson asked on its own). */
export type TipoItemSesion = 'practica' | 'pregunta' | 'ejercicio' | 'tarjeta' | 'leccion11';

export interface ItemCatalogo {
  /** Practice item id, Repaso question id, exercise label, flashcard id or 1.1 card id («cap01-l11-sec-1.4-reto-33»). */
  id: string;
  tipo: TipoItemSesion;
  /** numerico, prediccion…; opcion, numero; auto. */
  subtipo?: string;
  /** «parte/label». */
  concepto: string;
}

/** The mastery figures the selection needs (DominioConcepto fits). */
export interface DominioMinimo {
  valor: number;
  precision: number;
  retencion: number;
  ultima: number;
  nivel: 'nuevo' | 'intentado' | 'familiarizado' | 'competente' | 'dominado';
  repasar: boolean;
}

export interface ConceptoCandidato {
  clave: string;
  parte: string;
  /** Reading order of the concept in the whole book (chapter order, then section order). */
  orden: number;
  dominio: DominioMinimo | null;
  /** Its lesson was completed or passed by a placement test. */
  leccion: boolean;
}

export type Motivo = 'debil' | 'repasar' | 'nuevo' | 'dominado' | 'foco';

export interface ConceptoPlan {
  clave: string;
  motivo: Motivo;
  /** Items wanted from it. */
  cupo: number;
}

export interface Plan {
  conceptos: ConceptoPlan[];
  /** Total items wanted. */
  n: number;
  /** Items per concept at most when topping up (a chapter in focus has few concepts: more from each). */
  limite?: number;
}

export interface Alcance {
  parte: string;
  label?: string;
}

export interface EntradaPlan {
  /** Every concept that has something to answer (any chapter). */
  conceptos: ConceptoCandidato[];
  /** Parts of the reader's current course, in order. */
  curso: string[];
  alcance?: Alcance | null;
  n?: number;
}

export const N_SESION = 10;
export const CUPOS: Record<Exclude<Motivo, 'foco'>, number> = { debil: 4, repasar: 3, nuevo: 2, dominado: 1 };
const PRIORIDAD: Exclude<Motivo, 'foco'>[] = ['debil', 'repasar', 'nuevo', 'dominado'];
/** Items per concept at most (a weak concept may give more when nothing else is left). */
const MAX_POR_CONCEPTO: Record<Motivo, number> = { debil: 3, repasar: 2, nuevo: 2, dominado: 1, foco: 99 };
export const RECIENTE_MS = 20 * 3_600_000;
export const MINIMO_MS = 3_600_000;
export const MAX_TARJETAS = 2;

// ------------------------------------------------------------------ deterministic randomness

/** 32-bit FNV-1a. */
export function hashTexto(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32. */
export function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const conDatos = (c: ConceptoCandidato): boolean => !!c.dominio && c.dominio.nivel !== 'nuevo';
const parteDe = (clave: string): string => clave.slice(0, clave.indexOf('/'));

// ------------------------------------------------------------------ step 1: concepts

/** The concepts that count as «new material» now: the course's earliest untouched ones, up to the frontier. */
export function nuevosDisponibles(conceptos: ConceptoCandidato[], curso: string[]): ConceptoCandidato[] {
  const porParte = new Map<string, ConceptoCandidato[]>();
  for (const c of conceptos) {
    const l = porParte.get(c.parte);
    if (l) l.push(c);
    else porParte.set(c.parte, [c]);
  }
  const capitulos = curso.filter((p) => porParte.has(p));
  if (!capitulos.length) return [];
  const tocado = (c: ConceptoCandidato) => conDatos(c) || c.leccion;
  // the furthest chapter touched; the next one opens when everything before it has been touched
  let frontera = 0;
  capitulos.forEach((p, i) => {
    if (porParte.get(p)!.some(tocado)) frontera = i;
  });
  const hastaFrontera = capitulos.slice(0, frontera + 1).flatMap((p) => porParte.get(p)!);
  if (hastaFrontera.every(tocado) && frontera + 1 < capitulos.length) frontera++;
  return capitulos
    .slice(0, frontera + 1)
    .flatMap((p) => [...porParte.get(p)!].sort((a, b) => a.orden - b.orden))
    .filter((c) => !conDatos(c))
    // a section whose lesson is done but never answered is the best new material: it was just studied
    .sort((a, b) => Number(b.leccion) - Number(a.leccion) || capitulos.indexOf(a.parte) - capitulos.indexOf(b.parte) || a.orden - b.orden);
}

function bucket(c: ConceptoCandidato): Exclude<Motivo, 'foco' | 'nuevo'> | null {
  const d = c.dominio;
  if (!d || d.nivel === 'nuevo') return null;
  if (d.valor < 0.6 && !(d.repasar && d.precision >= 0.6)) return 'debil';
  if (d.repasar) return 'repasar';
  return 'dominado';
}

/** Step 1: the concepts of the session and how many items each. */
export function planificar(e: EntradaPlan): Plan {
  const n = Math.max(1, e.n ?? N_SESION);
  let conceptos = e.conceptos;
  const a = e.alcance;
  if (a) {
    conceptos = conceptos.filter((c) => c.parte === a.parte);
    if (a.label) {
      const clave = `${a.parte}/${a.label}`;
      const foco = conceptos.find((c) => c.clave === clave);
      const plan: ConceptoPlan[] = foco ? [{ clave, motivo: 'foco', cupo: n }] : [];
      // the rest of the chapter, weakest first, fills what the section cannot give (completar() decides)
      const resto = conceptos
        .filter((c) => c.clave !== clave && conDatos(c))
        .sort((x, y) => x.dominio!.valor - y.dominio!.valor || x.orden - y.orden)
        .slice(0, 4)
        .map((c) => ({ clave: c.clave, motivo: (bucket(c) ?? 'debil') as Motivo, cupo: 0 }));
      return { conceptos: [...plan, ...resto], n };
    }
  }
  const grupos: Record<Exclude<Motivo, 'foco'>, ConceptoCandidato[]> = { debil: [], repasar: [], nuevo: [], dominado: [] };
  for (const c of conceptos) {
    const b = bucket(c);
    if (b) grupos[b].push(c);
  }
  grupos.debil.sort((x, y) => x.dominio!.valor - y.dominio!.valor || x.dominio!.ultima - y.dominio!.ultima || x.orden - y.orden);
  grupos.repasar.sort((x, y) => x.dominio!.retencion - y.dominio!.retencion || x.orden - y.orden);
  grupos.dominado.sort((x, y) => x.dominio!.ultima - y.dominio!.ultima || x.orden - y.orden);
  // with a chapter in focus the new material is that chapter's, in order; otherwise the course's
  grupos.nuevo = a
    ? conceptos.filter((c) => !conDatos(c)).sort((x, y) => Number(y.leccion) - Number(x.leccion) || x.orden - y.orden)
    : nuevosDisponibles(conceptos, e.curso);

  // one item per concept first, by bucket quotas; then the free slots, in priority order
  const plan = new Map<string, ConceptoPlan>();
  const usados: Record<Exclude<Motivo, 'foco'>, number> = { debil: 0, repasar: 0, nuevo: 0, dominado: 0 };
  let libres = n;
  const tomar = (m: Exclude<Motivo, 'foco'>, limite: number) => {
    for (const c of grupos[m]) {
      if (libres <= 0 || usados[m] >= limite) return;
      if (plan.has(c.clave)) continue;
      plan.set(c.clave, { clave: c.clave, motivo: m, cupo: 1 });
      usados[m]++;
      libres--;
    }
  };
  for (const m of PRIORIDAD) tomar(m, CUPOS[m]);
  // a bucket with fewer concepts than its quota takes the rest of its quota as more items of its own concepts
  for (const m of PRIORIDAD) {
    let falta = CUPOS[m] - usados[m];
    for (let vuelta = 0; falta > 0 && libres > 0 && vuelta < 3; vuelta++) {
      for (const p of plan.values()) {
        if (falta <= 0 || libres <= 0) break;
        if (p.motivo !== m || p.cupo >= MAX_POR_CONCEPTO[m]) continue;
        p.cupo++;
        falta--;
        libres--;
      }
    }
  }
  // what is still free: more concepts, in priority order
  for (const m of PRIORIDAD) tomar(m, Number.POSITIVE_INFINITY);
  // still free (few concepts): more items from the chosen ones, weak first
  for (let vuelta = 0; libres > 0 && vuelta < 3; vuelta++) {
    for (const m of PRIORIDAD) {
      for (const p of plan.values()) {
        if (libres <= 0) break;
        if (p.motivo !== m || p.cupo >= MAX_POR_CONCEPTO[m]) continue;
        p.cupo++;
        libres--;
      }
    }
  }
  return { conceptos: [...plan.values()], n, limite: a ? 4 : undefined };
}

// ------------------------------------------------------------------ step 2: items

export interface ItemElegido extends ItemCatalogo {
  motivo: Motivo;
}

export interface EntradaCompletar {
  plan: Plan;
  /** Items of the planned concepts (others are ignored). Flashcards only when due. */
  items: ItemCatalogo[];
  /** Item id → time of its last answer, and the points of that answer (0–100). */
  ultimas: Record<string, { t: number; p: number }>;
  ahora: number;
  semilla: number;
}

/** Step 2: the items, in the order they are shown. */
export function completar(e: EntradaCompletar): ItemElegido[] {
  const azar = aleatorio(e.semilla);
  const ruido = new Map<string, number>();
  const r = (id: string) => ruido.get(id) ?? (ruido.set(id, azar()), ruido.get(id)!);
  const porConcepto = new Map<string, ItemCatalogo[]>();
  // items sorted by id first: the outcome must not depend on the order the caller loaded them
  for (const it of [...e.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const l = porConcepto.get(it.concepto);
    if (l) l.push(it);
    else porConcepto.set(it.concepto, [it]);
  }
  for (const l of porConcepto.values()) for (const it of l) r(it.id);
  // a focused session («Practicar esto» on a section) is that section's items, topped up to 5 with the chapter's
  // weakest concepts when the section has fewer
  const foco = e.plan.conceptos.find((c) => c.motivo === 'foco');
  const objetivo = foco ? Math.min(e.plan.n, Math.max(5, porConcepto.get(foco.clave)?.length ?? 0)) : e.plan.n;

  const elegidos: ItemElegido[] = [];
  const usados = new Set<string>();
  let tarjetas = 0;
  let ultimoSubtipo = '';

  const disponibles = (c: ConceptoPlan, estricto: boolean): ItemCatalogo[] =>
    (porConcepto.get(c.clave) ?? []).filter((it) => {
      if (usados.has(it.id)) return false;
      if (it.tipo === 'tarjeta' && (tarjetas >= MAX_TARJETAS || c.motivo === 'nuevo')) return false;
      const u = e.ultimas[it.id];
      if (!u) return true;
      const hace = e.ahora - u.t;
      return estricto ? hace >= RECIENTE_MS : hace >= MINIMO_MS;
    });

  const prioridad = (it: ItemCatalogo, m: Motivo): number => {
    const u = e.ultimas[it.id];
    if (m === 'debil' || m === 'foco') return !u ? 1 : u.p < 60 ? 0 : 2;
    if (m === 'nuevo') return !u ? 0 : 1;
    // review: the right ones answered longest ago (spaced retrieval), then unanswered ones
    return u && u.p >= 60 ? 0 : !u ? 1 : 2;
  };

  const elegirDe = (c: ConceptoPlan): boolean => {
    let lista = disponibles(c, true);
    if (!lista.length) lista = disponibles(c, false);
    if (!lista.length) return false;
    lista.sort((a, b) => {
      const d = prioridad(a, c.motivo) - prioridad(b, c.motivo);
      if (d) return d;
      // the review of right answers goes from the oldest
      if (c.motivo === 'repasar' || c.motivo === 'dominado') {
        const ta = e.ultimas[a.id]?.t ?? Number.POSITIVE_INFINITY;
        const tb = e.ultimas[b.id]?.t ?? Number.POSITIVE_INFINITY;
        if (ta !== tb) return ta - tb;
      }
      // mix the kinds: another kind than the last one chosen
      const sa = Number((a.subtipo ?? a.tipo) === ultimoSubtipo);
      const sb = Number((b.subtipo ?? b.tipo) === ultimoSubtipo);
      return sa - sb || r(a.id) - r(b.id);
    });
    const it = lista[0]!;
    usados.add(it.id);
    if (it.tipo === 'tarjeta') tarjetas++;
    ultimoSubtipo = it.subtipo ?? it.tipo;
    elegidos.push({ ...it, motivo: c.motivo });
    return true;
  };

  // round robin over the concepts (one item each per turn) up to their quotas
  const pendientes = e.plan.conceptos.map((c) => ({ c, quedan: c.cupo }));
  for (let vuelta = 0; elegidos.length < objetivo && vuelta < e.plan.n; vuelta++) {
    let alguno = false;
    for (const p of pendientes) {
      if (elegidos.length >= objetivo) break;
      if (p.quedan <= 0) continue;
      if (elegirDe(p.c)) {
        p.quedan--;
        alguno = true;
      } else p.quedan = 0;
    }
    if (!alguno) break;
  }
  // concepts that could not give their share: others take it (weak and focused first, then the plan's order)
  if (elegidos.length < objetivo) {
    const orden = [...e.plan.conceptos].sort((a, b) => Number(b.motivo === 'debil' || b.motivo === 'foco') - Number(a.motivo === 'debil' || a.motivo === 'foco'));
    let progreso = true;
    while (elegidos.length < objetivo && progreso) {
      progreso = false;
      for (const c of orden) {
        if (elegidos.length >= objetivo) break;
        const ya = elegidos.filter((x) => x.concepto === c.clave).length;
        if (c.motivo !== 'foco' && ya >= Math.max(c.cupo, e.plan.limite ?? MAX_POR_CONCEPTO[c.motivo])) continue;
        if (elegirDe(c)) progreso = true;
      }
    }
  }
  return ordenar(elegidos);
}

/**
 * Warm-up first (something known), then never the same concept twice in a row when it can be avoided: at each
 * step, among the items of another concept than the last one, the concept with the most items left goes first
 * (so the long runs are spread out), ties in the planned order.
 */
export function ordenar(items: ItemElegido[]): ItemElegido[] {
  const resto = items.map((it, i) => ({ it, i }));
  const r: ItemElegido[] = [];
  let previo = '';
  const k = resto.findIndex((x) => x.it.motivo === 'dominado' || x.it.motivo === 'repasar');
  if (k >= 0) {
    const [x] = resto.splice(k, 1);
    r.push(x!.it);
    previo = x!.it.concepto;
  }
  while (resto.length) {
    const quedan = new Map<string, number>();
    for (const x of resto) quedan.set(x.it.concepto, (quedan.get(x.it.concepto) ?? 0) + 1);
    let j = -1;
    for (let i = 0; i < resto.length; i++) {
      const x = resto[i]!;
      if (x.it.concepto === previo) continue;
      if (j < 0 || quedan.get(x.it.concepto)! > quedan.get(resto[j]!.it.concepto)!) j = i;
    }
    if (j < 0) j = 0;
    const [x] = resto.splice(j, 1);
    r.push(x!.it);
    previo = x!.it.concepto;
  }
  return r;
}

/** Both steps at once (tests; small catalogues). */
export function seleccionar(e: EntradaPlan & { items: ItemCatalogo[]; ultimas: EntradaCompletar['ultimas']; ahora: number; semilla: number }): ItemElegido[] {
  const plan = planificar(e);
  return completar({ plan, items: e.items, ultimas: e.ultimas, ahora: e.ahora, semilla: e.semilla });
}

/** The parts whose data a plan needs. */
export function partesDelPlan(plan: Plan): string[] {
  return [...new Set(plan.conceptos.map((c) => parteDe(c.clave)))];
}

// ------------------------------------------------------------------ problem of the day

export interface CandidatoProblema {
  id: string;
  /** practica: a «Calcula» item (values of the day from the seed); ejercicio: a self-checked exercise. */
  k: 'practica' | 'ejercicio';
  parte: string;
  orden: number;
}

export interface ProblemaElegido {
  id: string;
  k: 'practica' | 'ejercicio';
  parte: string;
  /** Seed of the values of the day (the same for everybody on that day). */
  semilla: number;
}

/**
 * The problem of a day: from the chapters of the course up to `nivel` (index of the furthest chapter reached), a
 * «Calcula» item when there is one, else a self-checked exercise; then the same over the rest of the course; and only
 * when the course has nothing, anything given. Deterministic per (day, course, level), skipping the ids of the recent
 * days when it can. A new reader (level 0, first course) gets one of the first chapter.
 * Which chapter: the pool's chapters are ranked from the reader's frontier (the level's chapter, then backwards; the
 * chapters after it, nearest first; outside the course, book order) and the first gets half the days, the next a
 * quarter… (`pesoCapitulo`), so a reader at 5.2 mostly practises chapter 5 and now and then revisits chapter 1.
 */
export function problemaDelDia(dia: string, curso: { id: string; partes: string[] }, nivel: number, candidatos: CandidatoProblema[], recientes: string[] = []): ProblemaElegido | null {
  const pos = new Map(curso.partes.map((p, i) => [p, i]));
  const tope = Math.max(0, Math.min(nivel, curso.partes.length - 1));
  const ordenar = (l: CandidatoProblema[]) => [...l].sort((a, b) => a.orden - b.orden || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const del = (k: CandidatoProblema['k'], hasta: number) => ordenar(candidatos.filter((c) => c.k === k && pos.has(c.parte) && pos.get(c.parte)! <= hasta));
  // the first non-empty pool: Calcula up to the level, exercises up to the level, the same over the whole course,
  // and at last anything given (the caller passes other courses' problems only when its course has none)
  const fondos = [del('practica', tope), del('ejercicio', tope), del('practica', 1e9), del('ejercicio', 1e9), ordenar(candidatos.filter((c) => c.k === 'practica')), ordenar(candidatos)];
  const fondo = fondos.find((f) => f.length);
  if (!fondo) return null;
  // chapters of the pool, the frontier first
  const distancia = (c: CandidatoProblema) => {
    const i = pos.get(c.parte);
    if (i === undefined) return 1e6 + c.orden;
    return i <= tope ? 2 * (tope - i) : 2 * (i - tope) - 1 + 1e3;
  };
  const grupos = new Map<string, CandidatoProblema[]>();
  for (const c of fondo) (grupos.get(c.parte) ?? grupos.set(c.parte, []).get(c.parte)!).push(c);
  const capitulos = [...grupos.values()].sort((a, b) => distancia(a[0]!) - distancia(b[0]!) || (a[0]!.parte < b[0]!.parte ? -1 : 1));
  const u = (hashTexto(`${dia}|${curso.id}|${tope}|capitulo`) % 1_000_000) / 1_000_000;
  let g = 0;
  for (let acum = 0; g < capitulos.length - 1; g++) {
    acum += pesoCapitulo(g, capitulos.length);
    if (u < acum) break;
  }
  const h = hashTexto(`${dia}|${curso.id}|${tope}`);
  const recientesSet = new Set(recientes);
  // the chosen chapter's item of the day; if it was a recent day's, another of that chapter, then of the next ones
  const orden = [g, ...capitulos.keys()].filter((x, i, l) => l.indexOf(x) === i);
  const primero = capitulos[g]![h % capitulos[g]!.length]!;
  let elegido = primero;
  buscar: for (const k of orden) {
    const l = capitulos[k]!;
    for (let i = 0; i < l.length; i++) {
      const c = l[(h + i) % l.length]!;
      if (!recientesSet.has(c.id)) {
        elegido = c;
        break buscar;
      }
    }
  }
  return { id: elegido.id, k: elegido.k, parte: elegido.parte, semilla: hashTexto(`${dia}|valores`) % 1_000_000 };
}

/** Share of the days of the k-th chapter (0: the frontier) among n: ½, ¼, ⅛…, the last takes what is left. */
export function pesoCapitulo(k: number, n: number): number {
  return k < n - 1 ? 0.5 ** (k + 1) : 0.5 ** (n - 1);
}

/** The parts of a stored problem of the day that decide which of two versions of a day is kept. */
export interface DiaComparable {
  id: string;
  t: number;
  r?: { bien: boolean; intentos: number; t: number };
}

/**
 * Of two versions of the same day's problem (two devices, two tabs), the one to keep — a total order, so every
 * device keeps the same one: an answered day beats an unanswered one; of two answers, a right one beats a wrong
 * one, then the first answer; of two unanswered, the one chosen first; at last the text of both.
 */
export function preferirDia<T extends DiaComparable>(a: T, b: T): T {
  if (!!a.r !== !!b.r) return a.r ? a : b;
  if (a.r && b.r) {
    if (a.r.bien !== b.r.bien) return a.r.bien ? a : b;
    if (a.r.t !== b.r.t) return a.r.t < b.r.t ? a : b;
  } else if (a.t !== b.t) return a.t < b.t ? a : b;
  const texto = (x: T) => JSON.stringify(Object.entries(x).sort(([p], [q]) => (p < q ? -1 : 1)));
  return texto(a) <= texto(b) ? a : b;
}

/** Consecutive days ending today (or yesterday, when today is not solved yet) in a set of day keys «2026-10-30». */
export function rachaDias(dias: string[], hoy: string): number {
  const num = (k: string) => {
    const [a, m, d] = k.split('-').map(Number);
    return Math.round(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
  };
  const set = new Set(dias.map(num));
  let n = num(hoy);
  if (!set.has(n)) n--;
  let r = 0;
  while (set.has(n)) {
    r++;
    n--;
  }
  return r;
}
