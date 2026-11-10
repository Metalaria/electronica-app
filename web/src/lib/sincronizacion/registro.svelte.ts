// The «syncable stores»: what the synchronisation carries between the owner's devices.
// Each store shows its local data as a map «item id → value» and takes back the merged result item by
// item. To add one (a new module's data), register it once, e.g. for a Record<id, item> kept under an
// almacen key, whose items carry their modification time:
//
//   registrarSincronizable(mapaDelAlmacen({ clave: 'mis-cosas', nombre: 'Mis cosas', tiempo: (v) => v.t }));
//
// A module that keeps its data in memory does NOT register `mapaDelAlmacen` (the synchronisation would write the
// storage behind the module's back, and the module's next write of its stale memory would undo it): it keeps a
// `Guardado` per key and registers `sincronizableGuardado(…)` (guardado.ts: read-merge-write, marks, atomic
// application). Deletions are marked by the Guardado (or anotarBorrado(clave, id) from marcas.ts).
//
// Not synchronised, on purpose (they belong to each device): theme and text size, the greeting's name, the index panel
// shown/hidden per view (`prefs`), the 2D/3D choice of the component pages (`componentes-vista`), the
// free-form netlist of the simulator (localStorage `epa:circuito`, a draft), and the synchronisation and
// update settings themselves.

import { obtenerAlmacen } from '../almacen';
import { sincronizableGuardado } from './guardado';
import { cargarUsuario, guardadosUsuario } from '../usuario.svelte';
import { cargarAprendizaje, guardadosAprendizaje, type EstadoEjercicio } from '../aprendizaje.svelte';
import { unirEjercicios } from '../union-ejercicios';
import { AJUSTES_DEFECTO, cargarRepaso, guardadosRepaso, unirDiasRepaso, type DiaRepaso } from '../../componentes/repaso/estado.svelte';
import { cargarFavoritos, guardadoFavoritos } from '../../componentes/calculadoras/datos.svelte';
import { cargarCircuitos, guardadoCircuitos, tiempoCircuito } from '../../componentes/editor/circuitos.svelte';
import { cargarMontajes, guardadoMontajes } from '../../componentes/protoboard/circuitos.svelte';
import { cargarDocente, guardadoPropios, guardadoResultados, propioValido, resultadoValido, tiempoDocente } from '../docente/estado.svelte';
import { unirResultados } from '../docente/union';
import type { Resultado } from '../docente/tipos';
import { OBJETIVO_GUARDADO_DEFECTO, cargarProgresoDiario, diaValido, guardadoDias, guardadoObjetivo } from '../progreso-diario.svelte';
import { cargarLecciones, guardadoLecciones, progresoValido, type ProgresoGuardado } from '../lecciones.svelte';
import { unirProgresoLeccion } from '../union-lecciones';
import { aplicarLogros, aplicarXp, leerLogros, leerXp, premioValido } from '../aprendizaje/progreso.svelte';
import { aplicarPruebas, aplicarSuperadas, leerPruebas, leerSuperadas, pruebaValida } from '../aprendizaje/cursos-estado.svelte';
import { aplicarDominio, leerDominio, tiempoRegistro } from '../aprendizaje/dominio.svelte';
import { fusionarRegistros, registroValido, type RegistroItem } from '../aprendizaje/dominio';
import { preferirDia, type DiaComparable } from '../aprendizaje/seleccion';
import { aplicarProblemas, diaProblemaValido, leerProblemas, tiempoProblema } from '../aprendizaje/problema-dia.svelte';
import { cargarSeguridad, guardadoSeguridad } from '../aprendizaje/seguridad.svelte';
import { seguridadValida, unirSeguridad, type RegistroSeguridad } from '../aprendizaje/seguridad';
import { cargarLaboratorio, guardadoLab } from '../laboratorio.svelte';
import { registroLabValido, unirRegistrosLab, type RegistroLab } from '../laboratorio';
import { cargarProyectos, guardadoProyectos } from '../proyectos11/estado.svelte';
import { registroEtapaValido, unirRegistrosEtapa, type RegistroEtapa } from '../proyectos11/registro';

export type Valores = Record<string, unknown>;

export interface Sincronizable {
  /** Key of the store in the synchronised file. */
  clave: string;
  /**
   * 1.0: the almacen key that holds it (lib/almacen.ts), when it is not `clave`: a store whose key is blocked — its
   * migration failed, or the data from before it were restored (lib/migrar.ts) — is left out of the synchronisation
   * and the backups (sincronizar.svelte.ts `activos`).
   */
  claveAlmacen?: string;
  /** Spanish name for the settings page. */
  nombre: string;
  /** The local items (loads the module if needed). */
  leer(): Promise<Valores>;
  /**
   * Applies the merged result: items to create or replace, and items to delete. `leidoEn`: when the data it is based
   * on were read (0.12d: a `Guardado` dates the applied items as its own version from then); `vistos`: the hash of each
   * item the merge read (0.12g: evidence for another tab whose change the merge saw and merged over).
   */
  aplicar(poner: Valores, quitar: string[], leidoEn?: number, vistos?: Map<string, string>): Promise<void>;
  /** Modification time stored in the item itself, when it has one (ms). */
  tiempo?(v: unknown): number | undefined;
  /** Rejects malformed values coming from the file. */
  valido?(v: unknown): boolean;
  /** Keep only the newest N items. */
  maximo?: number;
  /**
   * Two versions of an item merged instead of the newer replacing the older (a union of rounds, a preference): the
   * engine merges them in the file itself, before writing it (fusion.ts fusionarColecciones). Must be commutative,
   * associative and idempotent, and return a valid value (it is only given valid ones).
   */
  unir?(a: unknown, b: unknown): unknown;
  /**
   * The store's default value of an item (a fresh install has it): never synchronised and without a time of its own,
   * it is dated 1 and anything else 2, so a default never replaces the reader's own value (fusion.ts fecharLocal).
   */
  porDefecto?(id: string): unknown;
}

const registro = new Map<string, Sincronizable>();

export function registrarSincronizable(s: Sincronizable): void {
  registro.set(s.clave, s);
}

export function sincronizables(): Sincronizable[] {
  return [...registro.values()];
}

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

async function escribirAlmacen(clave: string, valor: unknown): Promise<void> {
  await (await obtenerAlmacen()).escribir(clave, valor);
}

/** A store kept as one Record<id, item> under an almacen key (read and written there directly). */
export function mapaDelAlmacen(o: {
  clave: string;
  nombre: string;
  claveAlmacen?: string;
  /** For a Record nested in an object: { version, circuitos: {…} } → 'circuitos'. */
  campo?: string;
  tiempo?: (v: any) => number | undefined;
  valido?: (v: unknown) => boolean;
}): Sincronizable {
  const claveAlmacen = o.claveAlmacen ?? o.clave;
  const leerRaiz = async () => (await (await obtenerAlmacen()).leer<Record<string, unknown>>(claveAlmacen)) ?? {};
  const mapa = (raiz: Record<string, unknown>): Record<string, unknown> => {
    const m = o.campo ? raiz[o.campo] : raiz;
    return esObjeto(m) ? m : {};
  };
  return {
    clave: o.clave,
    nombre: o.nombre,
    tiempo: o.tiempo,
    valido: o.valido ?? esObjeto,
    async leer() {
      return { ...mapa(await leerRaiz()) };
    },
    async aplicar(poner, quitar) {
      const raiz = await leerRaiz();
      const m = { ...mapa(raiz), ...poner };
      for (const id of quitar) delete m[id];
      await escribirAlmacen(claveAlmacen, o.campo ? { version: 1, ...raiz, [o.campo]: m } : m);
    },
  };
}

// Every module that keeps a store's items in memory registers it through its `Guardado` (guardado.ts,
// `sincronizableGuardado`): the store's items are the module's memory merged with what the storage holds, and the
// synchronisation's result is written first and put in memory after (atomic); the module's own writes are
// read-merge-write, so neither overwrites the other with an older copy (third review, finding 1). The modules of 0.11
// (XP, courses, mastery, problem of the day) keep their memory as their storage's mirror with lib/pestanas.ts and
// apply atomically too.

// ------------------------------------------------------------------ the reader's data

registrarSincronizable(
  sincronizableGuardado(guardadosUsuario.marcadores, {
    clave: 'marcadores',
    nombre: 'Marcadores',
    cargar: cargarUsuario,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.label === 'string' && typeof v.parte === 'string',
  }),
);

registrarSincronizable(
  sincronizableGuardado(guardadosUsuario.notas, {
    clave: 'notas',
    nombre: 'Notas',
    cargar: cargarUsuario,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.texto === 'string' && typeof v.label === 'string',
  }),
);

registrarSincronizable(
  sincronizableGuardado(guardadosUsuario.posiciones, {
    clave: 'posiciones',
    nombre: 'Posición de lectura de cada capítulo',
    cargar: cargarUsuario,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.b === 'number',
  }),
);

// Sections read: part → label → time, flattened to «part/label» → time (aprendizaje.svelte.ts).
registrarSincronizable(
  sincronizableGuardado(guardadosAprendizaje.leidas, {
    clave: 'leidas',
    nombre: 'Secciones leídas',
    cargar: cargarAprendizaje,
    tiempo: numero,
    valido: (v) => numero(v) !== undefined,
  }),
);

registrarSincronizable(
  sincronizableGuardado(guardadosAprendizaje.ejercicios, {
    clave: 'ejercicios',
    nombre: 'Progreso de ejercicios y problemas',
    cargar: cargarAprendizaje,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.intentos === 'number',
    // (1.0: two devices' versions of an exercise merged field by field — answers typed in different fields both
    // survive; a newer reset wins whole: lib/union-ejercicios.ts)
    unir: (a, b) => unirEjercicios(a as EstadoEjercicio, b as EstadoEjercicio),
  }),
);

registrarSincronizable(
  sincronizableGuardado(guardadosAprendizaje.deducciones, {
    clave: 'deducciones',
    nombre: 'Pasos vistos de las deducciones',
    cargar: cargarAprendizaje,
    valido: (v) => numero(v) !== undefined,
  }),
);

// ------------------------------------------------------------------ «Repaso»

registrarSincronizable(
  sincronizableGuardado(guardadosRepaso.tarjetas, {
    clave: 'repaso-tarjetas',
    nombre: 'Tarjetas de repaso (SM-2)',
    cargar: cargarRepaso,
    tiempo: (v) => numero(v.u),
    valido: (v) => esObjeto(v) && typeof v.v === 'number' && typeof v.e === 'string',
  }),
);

registrarSincronizable(
  sincronizableGuardado(guardadosRepaso.diario, {
    clave: 'repaso-diario',
    nombre: 'Registro diario del repaso',
    cargar: cargarRepaso,
    valido: (v) => esObjeto(v) && typeof v.r === 'number',
    // two devices that answered the same day: the larger count per field, in the file itself (review 0.12c, finding 5)
    unir: (a, b) => unirDiasRepaso(a as DiaRepaso, b as DiaRepaso),
  }),
);

// One item «ajustes»; a fresh install's settings are the default value (dated 1: never above the reader's own).
registrarSincronizable(
  sincronizableGuardado(guardadosRepaso.ajustes, {
    clave: 'repaso-ajustes',
    nombre: 'Ajustes del repaso (nuevas al día, inversas, mazo)',
    cargar: cargarRepaso,
    valido: esObjeto,
    porDefecto: (id) => (id === 'ajustes' ? AJUSTES_DEFECTO : undefined),
  }),
);

registrarSincronizable(
  sincronizableGuardado(guardadosRepaso.tests, {
    clave: 'repaso-tests',
    nombre: 'Resultados de los tests por capítulo',
    cargar: cargarRepaso,
    tiempo: (v) => numero(v.ultimo?.t),
    valido: (v) => esObjeto(v) && typeof v.mejor === 'number',
  }),
);

registrarSincronizable(
  sincronizableGuardado(guardadosRepaso.fallos, {
    clave: 'repaso-fallos',
    nombre: 'Preguntas falladas',
    cargar: cargarRepaso,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.parte === 'string',
  }),
);

// The last 30 exams (a list, newest first), keyed by their time.
registrarSincronizable(
  sincronizableGuardado(guardadosRepaso.examenes, {
    clave: 'repaso-examenes',
    nombre: 'Exámenes',
    cargar: cargarRepaso,
    maximo: 30,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.t === 'number' && Array.isArray(v.partes),
  }),
);

// ------------------------------------------------------------------ calculators

registrarSincronizable(
  sincronizableGuardado(guardadoFavoritos, {
    clave: 'calc-favoritos',
    nombre: 'Calculadoras favoritas',
    cargar: cargarFavoritos,
    valido: (v) => v === 1,
  }),
);

// ------------------------------------------------------------------ schematic editor (componentes/editor)

// { version: 1, circuitos: { <id>: { id, nombre, creado, actualizado, borrado?, doc } } }: the editor keeps
// its own logical deletions (`borrado`), so its tombstones travel as ordinary items. The open editor's list follows
// the synchronisation at once (it goes through the module's memory).
registrarSincronizable(
  sincronizableGuardado(guardadoCircuitos, {
    clave: 'editor-circuitos',
    nombre: 'Circuitos del editor de esquemas',
    cargar: cargarCircuitos,
    tiempo: tiempoCircuito,
    valido: (v) => esObjeto(v) && typeof v.id === 'string' && typeof v.actualizado === 'number',
  }),
);

// ------------------------------------------------------------------ own breadboards (componentes/protoboard, 0.10)

// The same shape as the editor's circuits: { version: 1, circuitos: { <id>: { id, nombre, creado, actualizado,
// borrado?, doc } } } with their own tombstones.
registrarSincronizable(
  sincronizableGuardado(guardadoMontajes, {
    clave: 'protoboard-circuitos',
    nombre: 'Montajes de la protoboard',
    cargar: cargarMontajes,
    tiempo: tiempoCircuito,
    valido: (v) => esObjeto(v) && typeof v.id === 'string' && typeof v.actualizado === 'number',
  }),
);

// ------------------------------------------------------------------ teacher mode (1.0, lib/docente/)

// Own courses and exams, and the results of those exams: the editor's shape — { version: 1, propios | resultados:
// { <id>: … } } with their own tombstones (`borrado`, dated after the last version), last write wins per item, every
// item kept (no cap). Schema 1 of both keys (lib/esquemas.ts).
// 1.0: «¿Qué seguridad tiene?» — the taps of each item; two versions of an item are merged (union of the taps by time,
// seguridad.ts unirSeguridad), in the file and between tabs alike.
registrarSincronizable(
  sincronizableGuardado(guardadoSeguridad, {
    clave: 'seguridad',
    nombre: 'Seguridad de las respuestas (lo sabía, dudaba, he adivinado)',
    cargar: cargarSeguridad,
    tiempo: (v) => v.t,
    valido: seguridadValida,
    unir: (a, b) => unirSeguridad(a as RegistroSeguridad, b as RegistroSeguridad),
  }),
);

// 1.1: the guided labs of printed chapter 21 — per lab «p<n>» the steps done, their readings, the first completion; two
// versions of a lab are merged (union of the steps, newer reading per step: laboratorio.ts unirRegistrosLab), in the
// file and between tabs alike. An older app keeps the store in the file untouched (it does not know it).
registrarSincronizable(
  sincronizableGuardado(guardadoLab, {
    clave: 'laboratorio',
    nombre: 'Laboratorios guiados (capítulo 21)',
    cargar: cargarLaboratorio,
    tiempo: (v) => v.t,
    valido: registroLabValido,
    unir: (a, b) => unirRegistrosLab(a as RegistroLab, b as RegistroLab),
  }),
);

// 1.1: the projects by stages of printed chapters 48–51 — per stage its circuit, its first pass and the values of its
// latest pass, the checks; two versions of a stage are merged (proyectos11/registro.ts unirRegistrosEtapa), in the
// file and between tabs alike. An older app keeps the store in the file untouched (it does not know it).
registrarSincronizable(
  sincronizableGuardado(guardadoProyectos, {
    clave: 'proyectos',
    nombre: 'Proyectos por etapas (capítulos 48 a 51)',
    cargar: cargarProyectos,
    tiempo: (v) => v.t,
    valido: registroEtapaValido,
    unir: (a, b) => unirRegistrosEtapa(a as RegistroEtapa, b as RegistroEtapa),
  }),
);

registrarSincronizable(
  sincronizableGuardado(guardadoPropios, {
    clave: 'docente-propios',
    nombre: 'Cursos y exámenes propios',
    cargar: cargarDocente,
    tiempo: tiempoDocente,
    valido: propioValido,
  }),
);
registrarSincronizable(
  sincronizableGuardado(guardadoResultados, {
    clave: 'docente-resultados',
    nombre: 'Resultados de los exámenes propios',
    cargar: cargarDocente,
    tiempo: tiempoDocente,
    valido: resultadoValido,
    // (1.0, review 10h, teacher agent: two devices' self-assessments of one result merged question by question)
    unir: (a, b) => unirResultados(a as Resultado, b as Resultado),
  }),
);

// ------------------------------------------------------------------ daily progress and streak (0.9)

// One item per review day («2026-10-27» → { pasos, preguntas, secciones, cumplido, t }), last write wins; 0.12: and one
// record per device and day («2026-10-27@<device>», the same shape), summed (lib/progreso-dias.ts) — each has one
// writer, so last write wins is exact and synchronising again never counts twice.
registrarSincronizable(
  sincronizableGuardado(guardadoDias, {
    clave: 'progreso-diario',
    nombre: 'Progreso diario y racha',
    cargar: cargarProgresoDiario,
    tiempo: (v) => numero(v.t),
    valido: diaValido,
  }),
);

// One item «objetivo» (the goal and when it was set); a fresh install's goal is the default value.
registrarSincronizable(
  sincronizableGuardado(guardadoObjetivo, {
    clave: 'progreso-objetivo',
    nombre: 'Objetivo diario',
    cargar: cargarProgresoDiario,
    tiempo: (v) => numero(v.t) || undefined,
    valido: esObjeto,
    porDefecto: (id) => (id === 'objetivo' ? OBJETIVO_GUARDADO_DEFECTO : undefined),
  }),
);

// ------------------------------------------------------------------ lessons «Estudiar por pasos» (0.9)

// «<parte>/<label>» → { h: steps done, u: last screen, n: steps, c: completed (ms), t }; two versions are merged (union of
// the steps, first completion: union-lecciones.ts), in the file and between tabs alike.
registrarSincronizable(
  sincronizableGuardado(guardadoLecciones, {
    clave: 'lecciones',
    nombre: 'Lecciones por pasos',
    cargar: cargarLecciones,
    tiempo: (v) => numero(v.t),
    valido: progresoValido,
    // (review 11a: two versions of a lesson merged — union of the cards done, first completion: union-lecciones.ts)
    unir: (a, b) => unirProgresoLeccion(a as ProgresoGuardado, b as ProgresoGuardado),
  }),
);

// ------------------------------------------------------------------ XP, achievements and courses (0.11)

// The XP ledger (lib/aprendizaje/progreso.svelte.ts): «<award id>» → { x, t }. Ids are deterministic (the same
// lesson completed on two devices is one item), so the total is the sum and never double-counts.
registrarSincronizable({
  clave: 'progreso-xp',
  nombre: 'XP y niveles',
  tiempo: (v) => numero((v as { t?: unknown }).t),
  valido: premioValido,
  leer: leerXp,
  aplicar: aplicarXp,
});

// Achievements unlocked: id → time.
registrarSincronizable({
  clave: 'progreso-logros',
  claveAlmacen: 'progreso-xp',
  nombre: 'Logros',
  tiempo: numero,
  valido: (v) => numero(v) !== undefined,
  leer: leerLogros,
  aplicar: aplicarLogros,
});

// Lessons marked «superada por la prueba» (lib/aprendizaje/cursos-estado.svelte.ts): «<parte>/<label>» → time.
registrarSincronizable({
  clave: 'cursos-superadas',
  claveAlmacen: 'cursos',
  nombre: 'Lecciones superadas por la prueba de nivel',
  tiempo: numero,
  valido: (v) => numero(v) !== undefined,
  leer: leerSuperadas,
  aplicar: aplicarSuperadas,
});

// The last placement test of each course: course id → { t, aciertos, total, recomendado, marcadas }.
registrarSincronizable({
  clave: 'cursos-pruebas',
  claveAlmacen: 'cursos',
  nombre: 'Pruebas de nivel',
  tiempo: (v) => numero((v as { t?: unknown }).t),
  valido: pruebaValida,
  leer: leerPruebas,
  aplicar: aplicarPruebas,
});

// ------------------------------------------------------------------ mastery and problem of the day (0.11, group B)

// Mastery per concept (lib/aprendizaje/dominio.svelte.ts): item id → { s: concept, c: kind, r: rounds }. The
// rounds of the same item on two devices are merged (union) in the file itself, so practice on both is kept.
registrarSincronizable({
  clave: 'dominio',
  nombre: 'Dominio por concepto',
  tiempo: tiempoRegistro,
  valido: registroValido,
  unir: (a, b) => fusionarRegistros(a as RegistroItem, b as RegistroItem),
  leer: leerDominio,
  aplicar: aplicarDominio,
});

// The problem of each day (lib/aprendizaje/problema-dia.svelte.ts): day → { id, k, parte, semilla, curso, t, r? }.
// Of two versions of a day the preferred one (seleccion.ts preferirDia: answered, right, first…), in the file itself.
registrarSincronizable({
  clave: 'problema-dia',
  nombre: 'Problema del día',
  tiempo: tiempoProblema,
  valido: diaProblemaValido,
  unir: (a, b) => preferirDia(a as DiaComparable, b as DiaComparable),
  leer: leerProblemas,
  aplicar: aplicarProblemas,
});
