// The «syncable stores»: what the synchronisation carries between the owner's devices.
// Each store shows its local data as a map «item id → value» and takes back the merged result item by
// item. To add one (a new module's data), register it once, e.g. for a Record<id, item> kept under an
// almacen key, whose items carry their modification time:
//
//   registrarSincronizable(mapaDelAlmacen({ clave: 'mis-cosas', nombre: 'Mis cosas', tiempo: (v) => v.t }));
//
// A module that keeps its data in memory reloads it on the window event `epa:sincronizado`
// (detail.claves: the store keys that changed) and flushes pending writes on `epa:antes-de-sincronizar`.
// Deletions are dated with anotarBorrado(clave, id) from marcas.ts (else when the merge notices them).
//
// Not synchronised, on purpose (they belong to each device): theme and text size, the greeting's name, the index panel
// shown/hidden per view (`prefs`), the 2D/3D choice of the component pages (`componentes-vista`), the
// free-form netlist of the simulator (localStorage `epa:circuito`, a draft), and the synchronisation and
// update settings themselves.

import { obtenerAlmacen } from '../almacen';
import { usuario, type Marcador, type Nota, type Posicion } from '../usuario.svelte';
import { aprendizaje, cargarAprendizaje, type EstadoEjercicio } from '../aprendizaje.svelte';
import { repaso, cargarRepaso } from '../../componentes/repaso/estado.svelte';
import { calc, cargarFavoritos } from '../../componentes/calculadoras/datos.svelte';
import { aplicarDias, aplicarObjetivo, diaValido, leerDias, leerObjetivo } from '../progreso-diario.svelte';
import { progresoLecciones, cargarLecciones, type ProgresoGuardado } from '../lecciones.svelte';

export type Valores = Record<string, unknown>;

export interface Sincronizable {
  /** Key of the store in the synchronised file. */
  clave: string;
  /** Spanish name for the settings page. */
  nombre: string;
  /** The local items (loads the module if needed). */
  leer(): Promise<Valores>;
  /** Applies the merged result: items to create or replace, and items to delete. */
  aplicar(poner: Valores, quitar: string[]): Promise<void>;
  /** Modification time stored in the item itself, when it has one (ms). */
  tiempo?(v: unknown): number | undefined;
  /** Rejects malformed values coming from the file. */
  valido?(v: unknown): boolean;
  /** Keep only the newest N items. */
  maximo?: number;
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

/** A store whose data lives in a reactive record of a loaded module. */
function mapaReactivo<T>(o: {
  clave: string;
  nombre: string;
  claveAlmacen?: string;
  cargar?: () => Promise<unknown>;
  obtener: () => Record<string, T>;
  tiempo?: (v: T) => number | undefined;
  valido?: (v: unknown) => boolean;
}): Sincronizable {
  return {
    clave: o.clave,
    nombre: o.nombre,
    tiempo: o.tiempo as ((v: unknown) => number | undefined) | undefined,
    valido: o.valido ?? esObjeto,
    async leer() {
      await o.cargar?.();
      return $state.snapshot(o.obtener()) as Valores;
    },
    async aplicar(poner, quitar) {
      await o.cargar?.();
      const r = o.obtener();
      for (const [id, v] of Object.entries(poner)) r[id] = v as T;
      for (const id of quitar) delete r[id];
      await escribirAlmacen(o.claveAlmacen ?? o.clave, $state.snapshot(r));
    },
  };
}

// ------------------------------------------------------------------ the reader's data

registrarSincronizable(
  mapaReactivo<Marcador>({
    clave: 'marcadores',
    nombre: 'Marcadores',
    obtener: () => usuario.marcadores,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.label === 'string' && typeof v.parte === 'string',
  }),
);

registrarSincronizable(
  mapaReactivo<Nota>({
    clave: 'notas',
    nombre: 'Notas',
    obtener: () => usuario.notas,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.texto === 'string' && typeof v.label === 'string',
  }),
);

registrarSincronizable(
  mapaReactivo<Posicion>({
    clave: 'posiciones',
    nombre: 'Posición de lectura de cada capítulo',
    obtener: () => usuario.posiciones,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.b === 'number',
  }),
);

// Sections read: part → label → time, flattened to «part/label» → time.
registrarSincronizable({
  clave: 'leidas',
  nombre: 'Secciones leídas',
  tiempo: numero,
  valido: (v) => numero(v) !== undefined,
  async leer() {
    await cargarAprendizaje();
    const r: Valores = {};
    for (const [parte, secs] of Object.entries(aprendizaje.leidas)) for (const [label, t] of Object.entries(secs)) r[`${parte}/${label}`] = t;
    return r;
  },
  async aplicar(poner, quitar) {
    await cargarAprendizaje();
    const partir = (id: string): [string, string] => {
      const i = id.indexOf('/');
      return [id.slice(0, i), id.slice(i + 1)];
    };
    for (const [id, t] of Object.entries(poner)) {
      const [parte, label] = partir(id);
      if (!parte || !label) continue;
      aprendizaje.leidas[parte] ??= {};
      aprendizaje.leidas[parte]![label] = t as number;
    }
    for (const id of quitar) {
      const [parte, label] = partir(id);
      const secs = aprendizaje.leidas[parte];
      if (!secs) continue;
      delete secs[label];
      if (!Object.keys(secs).length) delete aprendizaje.leidas[parte];
    }
    await escribirAlmacen('leidas', $state.snapshot(aprendizaje.leidas));
  },
});

registrarSincronizable(
  mapaReactivo<EstadoEjercicio>({
    clave: 'ejercicios',
    nombre: 'Progreso de ejercicios y problemas',
    cargar: cargarAprendizaje,
    obtener: () => aprendizaje.ejercicios,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.intentos === 'number',
  }),
);

registrarSincronizable(
  mapaReactivo<number>({
    clave: 'deducciones',
    nombre: 'Pasos vistos de las deducciones',
    cargar: cargarAprendizaje,
    obtener: () => aprendizaje.deducciones,
    valido: (v) => numero(v) !== undefined,
  }),
);

// ------------------------------------------------------------------ «Repaso»

registrarSincronizable(
  mapaReactivo({
    clave: 'repaso-tarjetas',
    nombre: 'Tarjetas de repaso (SM-2)',
    cargar: cargarRepaso,
    obtener: () => repaso.tarjetas,
    tiempo: (v) => numero(v.u),
    valido: (v) => esObjeto(v) && typeof v.v === 'number' && typeof v.e === 'string',
  }),
);

registrarSincronizable(
  mapaReactivo({
    clave: 'repaso-diario',
    nombre: 'Registro diario del repaso',
    cargar: cargarRepaso,
    obtener: () => repaso.diario,
    valido: (v) => esObjeto(v) && typeof v.r === 'number',
  }),
);

registrarSincronizable({
  clave: 'repaso-ajustes',
  nombre: 'Ajustes del repaso (nuevas al día, inversas, mazo)',
  valido: esObjeto,
  async leer() {
    await cargarRepaso();
    return { ajustes: $state.snapshot(repaso.ajustes) };
  },
  async aplicar(poner) {
    await cargarRepaso();
    const a = poner.ajustes;
    if (!esObjeto(a)) return;
    repaso.ajustes = { ...repaso.ajustes, ...a };
    await escribirAlmacen('repaso-ajustes', $state.snapshot(repaso.ajustes));
  },
});

registrarSincronizable(
  mapaReactivo({
    clave: 'repaso-tests',
    nombre: 'Resultados de los tests por capítulo',
    cargar: cargarRepaso,
    obtener: () => repaso.tests,
    tiempo: (v) => numero(v.ultimo?.t),
    valido: (v) => esObjeto(v) && typeof v.mejor === 'number',
  }),
);

registrarSincronizable(
  mapaReactivo({
    clave: 'repaso-fallos',
    nombre: 'Preguntas falladas',
    cargar: cargarRepaso,
    obtener: () => repaso.fallos,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && typeof v.parte === 'string',
  }),
);

// The last 30 exams (a list, newest first), keyed by their time.
registrarSincronizable({
  clave: 'repaso-examenes',
  nombre: 'Exámenes',
  maximo: 30,
  tiempo: (v) => numero((v as { t?: unknown }).t),
  valido: (v) => esObjeto(v) && typeof v.t === 'number' && Array.isArray(v.partes),
  async leer() {
    await cargarRepaso();
    return Object.fromEntries($state.snapshot(repaso.examenes).map((e) => [String(e.t), e]));
  },
  async aplicar(poner, quitar) {
    await cargarRepaso();
    const m = new Map(repaso.examenes.map((e) => [String(e.t), $state.snapshot(e)]));
    for (const [id, e] of Object.entries(poner)) m.set(id, e as (typeof repaso.examenes)[number]);
    for (const id of quitar) m.delete(id);
    repaso.examenes = [...m.values()].sort((a, b) => b.t - a.t).slice(0, 30);
    await escribirAlmacen('repaso-examenes', $state.snapshot(repaso.examenes));
  },
});

// ------------------------------------------------------------------ calculators

registrarSincronizable({
  clave: 'calc-favoritos',
  nombre: 'Calculadoras favoritas',
  valido: (v) => v === 1,
  async leer() {
    await cargarFavoritos();
    return Object.fromEntries(calc.favoritos.map((id) => [id, 1]));
  },
  async aplicar(poner, quitar) {
    await cargarFavoritos();
    const fuera = new Set(quitar);
    const lista = calc.favoritos.filter((id) => !fuera.has(id));
    for (const id of Object.keys(poner).sort()) if (!lista.includes(id)) lista.push(id);
    calc.favoritos = lista;
    await escribirAlmacen('calc-favoritos', $state.snapshot(calc.favoritos));
  },
});

// ------------------------------------------------------------------ schematic editor (componentes/editor)

// { version: 1, circuitos: { <id>: { id, nombre, creado, actualizado, borrado?, doc } } }: the editor keeps
// its own logical deletions (`borrado`), so its tombstones travel as ordinary items.
registrarSincronizable(
  mapaDelAlmacen({
    clave: 'editor-circuitos',
    nombre: 'Circuitos del editor de esquemas',
    campo: 'circuitos',
    tiempo: (v) => Math.max(numero(v?.actualizado) ?? 0, numero(v?.borrado) ?? 0) || undefined,
    valido: (v) => esObjeto(v) && typeof v.id === 'string' && typeof v.actualizado === 'number',
  }),
);

// ------------------------------------------------------------------ own breadboards (componentes/protoboard, 0.10)

// The same shape as the editor's circuits: { version: 1, circuitos: { <id>: { id, nombre, creado, actualizado,
// borrado?, doc } } } with their own tombstones. The breadboard module reloads it on `epa:sincronizado`.
registrarSincronizable(
  mapaDelAlmacen({
    clave: 'protoboard-circuitos',
    nombre: 'Montajes de la protoboard',
    campo: 'circuitos',
    tiempo: (v) => Math.max(numero(v?.actualizado) ?? 0, numero(v?.borrado) ?? 0) || undefined,
    valido: (v) => esObjeto(v) && typeof v.id === 'string' && typeof v.actualizado === 'number',
  }),
);

// ------------------------------------------------------------------ daily progress and streak (0.9)

// One item per review day («2026-10-27» → { pasos, preguntas, secciones, cumplido, t }), last write wins.
registrarSincronizable({
  clave: 'progreso-diario',
  nombre: 'Progreso diario y racha',
  tiempo: (v) => numero((v as { t?: unknown }).t),
  valido: diaValido,
  leer: async () => (await leerDias()) as unknown as Valores,
  aplicar: aplicarDias,
});

registrarSincronizable({
  clave: 'progreso-objetivo',
  nombre: 'Objetivo diario',
  tiempo: (v) => numero((v as { t?: unknown }).t),
  valido: esObjeto,
  leer: leerObjetivo,
  aplicar: (poner) => aplicarObjetivo(poner),
});

// ------------------------------------------------------------------ lessons «Estudiar por pasos» (0.9)

// «<parte>/<label>» → { h: steps done, u: last screen, n: steps, c: completed (ms), t }.
registrarSincronizable(
  mapaReactivo<ProgresoGuardado>({
    clave: 'lecciones',
    nombre: 'Lecciones por pasos',
    cargar: cargarLecciones,
    obtener: () => progresoLecciones.secciones,
    tiempo: (v) => numero(v.t),
    valido: (v) => esObjeto(v) && Array.isArray(v.h) && typeof v.u === 'number' && typeof v.n === 'number' && typeof v.t === 'number',
  }),
);
