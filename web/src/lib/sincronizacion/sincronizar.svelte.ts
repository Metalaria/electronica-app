// Synchronisation of the owner's data through a JSON file in a private GitHub repository of his.
//
// One run: read the local items of every syncable store (registro.svelte.ts) → GET the file (sha +
// content) → merge item by item (fusion.ts) → PUT it back with that sha when the merge changed it (on
// 409/422 someone wrote first: fetch again and redo the merge) → apply what came from other devices.
// Local times: an item keeps the time of its last synchronised version while its content is unchanged
// (`sinc-estado`: id → [time, hash of the file's value, …]); a changed item marked by its module (marcas.ts) takes
// the later of its own time field and its mark; a change without a mark is a stale copy and never outdates what was
// synchronised (fusion.ts fecharLocal). What is recorded after applying is the FILE's value, so an item
// whose store keeps something else (a union, an answered problem of the day kept over an unanswered one) counts as
// changed and is sent on the next run (fusion.ts registroSincronizado, with its limit against back-and-forth).
// A store with `unir` (a union: mastery rounds, the problem of the day) has its items merged in the file itself,
// before the PUT and against its sha, so the union is durable at once. An item the store cannot take (`aplicar` failed)
// or rejects (`valido`) is recorded as losing to the file, and the marks of a failed store are kept.
// The per-store rules are pure functions in fusion.ts (fecharLocal, porAplicar, registroSincronizado). Several tabs:
// one run at a time (navigator.locks `epa-sinc`), each reading `sinc-estado` and the marks again. Runs: at
// start-up, every INTERVALO while the app is visible, when it is hidden (and when it comes back after a while),
// and with «Sincronizar ahora».

import { obtenerAlmacen } from '../almacen';
import { usuario } from '../usuario.svelte';
import {
  alinearIguales,
  docVacio,
  escribirDoc,
  BORRADO,
  esLapida,
  dispositivosValidos,
  fecharLocal,
  fusionarDocs,
  horizontePoda,
  huella,
  leerDoc,
  mismosAlmacenes,
  podar,
  porAplicar,
  registroSincronizado,
  type DocSincronizacion,
  type Sincronizado,
  type Union,
} from './fusion';
import { ErrorGitHub, escribirFichero, leerFichero, leerRepositorio, leerRutaFichero } from './github';
import { leerToken } from './credenciales';
import { olvidarMarcas, recargarMarcas, volcarMarcas } from './marcas';
import { sincronizables, type Valores } from './registro.svelte';
import { VERSION_APP } from './version-app';

export const REPOSITORIO_DEFECTO = 'Metalaria/electronica-datos';
export const RUTA_DEFECTO = 'sincronizacion/datos.json';
/** Automatic runs while the app is open. */
export const INTERVALO = 5 * 60_000;
const REINTENTOS = 5;

export interface AjustesSinc {
  repositorio: string;
  ruta: string;
  /** Automatic runs (start-up, every few minutes, on hide). */
  auto: boolean;
}

interface EstadoLocal {
  /** Id of the document last merged (another file = another history). */
  doc: string;
  /** Per store: item id → [time, hash of the file's value, …] of the version last synchronised (fusion.ts). */
  items: Record<string, Record<string, Sincronizado>>;
  dispositivo: string;
  ultima: number;
  /**
   * Local time the last successful run started: a mark not newer was seen by it (or kept for a store it could not
   * write, or made again for a change still unwritten) — fusion.ts fecharLocal does not move it past what is recorded.
   */
  iniciada?: number;
  /** Summary of the last successful run, for the settings page. */
  resumen?: Resumen;
}

export interface Resumen {
  /** Items received from other devices (created, changed or deleted here). */
  recibidos: number;
  /** Whether this run wrote the file. */
  escrito: boolean;
  creado: boolean;
  reintentos: number;
  dispositivos: { nombre: string; ultima: number; version: string; este: boolean }[];
  porAlmacen: Record<string, number>;
}

export const sinc = $state({
  cargado: false,
  hayToken: false,
  ajustes: { repositorio: REPOSITORIO_DEFECTO, ruta: RUTA_DEFECTO, auto: true } as AjustesSinc,
  ocupado: false,
  /** ms of the last successful run (0: never on this device). */
  ultima: 0,
  error: '',
  /** The last error was transient (offline, GitHub down): shown in a softer tone. */
  pasajero: false,
  resumen: null as Resumen | null,
  /** Runs finished (successful or not) since the app opened: the tests wait on it. */
  ejecuciones: 0,
});

const CLAVE_AJUSTES = 'sinc-ajustes';
const CLAVE_ESTADO = 'sinc-estado';

let estadoLocal: EstadoLocal | null = null;
/** The last run's record could not be stored (storage full): the memory's copy is used until it can. */
let estadoSinGuardar = false;

/**
 * `sinc-estado` as stored: the records of deleted items (`BORRADO`) apart, in `borrados` {store: {id: time}}, which the
 * engine of 0.10 ignores (it would read them as items deleted here — third review).
 */
interface EstadoGuardado extends Omit<EstadoLocal, 'items'> {
  items: Record<string, Record<string, Sincronizado>>;
  borrados?: Record<string, Record<string, number>>;
}

function aGuardado(e: EstadoLocal): EstadoGuardado {
  const items: EstadoGuardado['items'] = {};
  const borrados: NonNullable<EstadoGuardado['borrados']> = {};
  for (const [k, ids] of Object.entries(e.items)) {
    const vivos: Record<string, Sincronizado> = {};
    for (const [id, r] of Object.entries(ids)) {
      if (r[1] === BORRADO) (borrados[k] ??= {})[id] = r[0];
      else vivos[id] = r;
    }
    items[k] = vivos;
  }
  return { ...e, items, borrados };
}

/** A record as stored: [time, hash] or [time, hash, n, file hash] (anything else — damaged, null — is dropped). */
function registroValido(r: unknown): r is Sincronizado {
  if (!Array.isArray(r) || typeof r[0] !== 'number' || !Number.isFinite(r[0]) || typeof r[1] !== 'string') return false;
  return r.length === 2 || (r.length === 4 && typeof r[2] === 'number' && Number.isFinite(r[2]) && typeof r[3] === 'string');
}

function deGuardado(items: unknown, borrados: unknown): EstadoLocal['items'] {
  // only well-formed records (fourth review: a null record made every run throw); a dropped one counts as never
  // synchronised, which dates the item as of unknown age or by its mark
  const r: EstadoLocal['items'] = {};
  if (items && typeof items === 'object' && !Array.isArray(items))
    for (const [k, ids] of Object.entries(items as Record<string, unknown>)) {
      if (!ids || typeof ids !== 'object' || Array.isArray(ids)) continue;
      for (const [id, reg] of Object.entries(ids as Record<string, unknown>)) if (registroValido(reg)) (r[k] ??= {})[id] = [...reg] as Sincronizado;
    }
  if (borrados && typeof borrados === 'object' && !Array.isArray(borrados))
    for (const [k, ids] of Object.entries(borrados as Record<string, Record<string, unknown>>))
      for (const [id, t] of Object.entries(ids && typeof ids === 'object' ? ids : {})) if (typeof t === 'number' && Number.isFinite(t)) (r[k] ??= {})[id] = [t, BORRADO];
  return r;
}

async function guardarEstado(e: EstadoLocal): Promise<void> {
  await (await obtenerAlmacen()).escribir(CLAVE_ESTADO, aGuardado(e));
}

function idAleatorio(): string {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function nombreDispositivo(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const tauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  let s = 'Navegador';
  if (/Android/i.test(ua)) s = /Mobile/i.test(ua) ? 'Android (teléfono)' : 'Android (tableta)';
  else if (/iPhone|iPad/i.test(ua)) s = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) s = 'Mac';
  else if (/Windows/i.test(ua)) s = 'Windows';
  else if (/Linux/i.test(ua)) s = 'Linux';
  return tauri ? s : `${s} · navegador`;
}

/** The stored summary of the last run (shown on the settings page), only in its expected shape (fifth review). */
function resumenValido(r: unknown): Resumen | undefined {
  if (!r || typeof r !== 'object') return undefined;
  const x = r as Partial<Resumen>;
  if (!Array.isArray(x.dispositivos) || !x.porAlmacen || typeof x.porAlmacen !== 'object' || Array.isArray(x.porAlmacen)) return undefined;
  const dispositivos = x.dispositivos.filter(
    (d): d is Resumen['dispositivos'][number] => !!d && typeof d === 'object' && typeof d.nombre === 'string' && typeof d.version === 'string' && typeof d.ultima === 'number',
  );
  const porAlmacen = Object.fromEntries(Object.entries(x.porAlmacen).filter(([, n]) => typeof n === 'number')) as Record<string, number>;
  return { recibidos: Number(x.recibidos) || 0, escrito: !!x.escrito, creado: !!x.creado, reintentos: Number(x.reintentos) || 0, dispositivos, porAlmacen };
}

/** `releer`: from the storage again (another tab may have run meanwhile). */
async function leerEstadoLocal(releer = false): Promise<EstadoLocal> {
  if (estadoLocal && (!releer || estadoSinGuardar)) return estadoLocal;
  const a = await obtenerAlmacen();
  const e = await a.leer<Partial<EstadoGuardado>>(CLAVE_ESTADO);
  estadoLocal = {
    doc: typeof e?.doc === 'string' ? e.doc : '',
    items: deGuardado(e?.items, e?.borrados),
    dispositivo: typeof e?.dispositivo === 'string' && e.dispositivo ? e.dispositivo : (estadoLocal?.dispositivo ?? idAleatorio()),
    ultima: Number(e?.ultima) || 0,
    iniciada: Number(e?.iniciada) || 0,
    // (shown on the settings page: only a summary of the expected shape)
    resumen: resumenValido(e?.resumen),
  };
  if (!e?.dispositivo) await guardarEstado(estadoLocal).catch(() => undefined);
  return estadoLocal;
}

/** Loads settings, token presence and the last run (once). */
export async function cargarSinc(): Promise<void> {
  if (sinc.cargado) return;
  const a = await obtenerAlmacen();
  const aj = await a.leer<Partial<AjustesSinc>>(CLAVE_AJUSTES);
  // field by field: a damaged value (another type) keeps the default (fourth review: a run threw on it)
  if (aj && typeof aj === 'object') {
    if (typeof aj.repositorio === 'string') sinc.ajustes.repositorio = aj.repositorio;
    if (typeof aj.ruta === 'string') sinc.ajustes.ruta = aj.ruta;
    if (typeof aj.auto === 'boolean') sinc.ajustes.auto = aj.auto;
  }
  const e = await leerEstadoLocal();
  sinc.ultima = e.ultima;
  sinc.resumen = e.resumen ?? null;
  sinc.hayToken = !!(await leerToken());
  sinc.cargado = true;
}

export async function ponerAjustesSinc(a: Partial<AjustesSinc>): Promise<void> {
  await cargarSinc();
  const antes = sinc.ajustes;
  sinc.ajustes = { ...sinc.ajustes, ...a };
  await (await obtenerAlmacen()).escribir(CLAVE_AJUSTES, $state.snapshot(sinc.ajustes));
  // Another file is another history: the next run merges everything again.
  if (antes.repositorio !== sinc.ajustes.repositorio || antes.ruta !== sinc.ajustes.ruta) await olvidarHistoria();
}

/** Forgets what was synchronised (after «Desconectar» or a change of file): the next run merges all again. */
export async function olvidarHistoria(): Promise<void> {
  const e = await leerEstadoLocal();
  e.doc = '';
  e.items = {};
  e.ultima = 0;
  e.iniciada = 0;
  e.resumen = undefined;
  sinc.ultima = 0;
  sinc.resumen = null;
  await guardarEstado(e);
}

function mensajeCommit(nombre: string, ahora: number): string {
  const f = new Date(ahora);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `Sincronización desde ${nombre} (${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())} ${dos(f.getHours())}:${dos(f.getMinutes())})`;
}

interface Lectura {
  valores: Map<string, Valores>;
  huellas: Map<string, Map<string, string>>;
}

async function leerLocales(): Promise<Lectura> {
  const valores = new Map<string, Valores>();
  const huellas = new Map<string, Map<string, string>>();
  for (const s of sincronizables()) {
    let v: Valores;
    try {
      v = await s.leer();
    } catch (e) {
      // Never merge with a store that could not be read: its items would look deleted.
      throw new ErrorGitHub(`No se pudieron leer los datos locales «${s.nombre}» (${e instanceof Error ? e.message : String(e)}).`, 0);
    }
    valores.set(s.clave, v);
    huellas.set(s.clave, new Map(Object.entries(v).map(([id, x]) => [id, huella(x)])));
  }
  return { valores, huellas };
}

/** The local data as a document, dating each item (see the header and fusion.ts fecharLocal). */
function docLocal(l: Lectura, e: EstadoLocal, mismoDoc: boolean, marcas: Awaited<ReturnType<typeof recargarMarcas>>, ahora: number) {
  const d = docVacio(e.doc || 'local', ahora);
  for (const s of sincronizables()) {
    // a change mark made for another value (another tab's change, still unwritten here) is not this value's: an older
    // copy of the item must not pass for the change
    const hs = l.huellas.get(s.clave)!;
    const hm = marcas.huellas[s.clave] ?? {};
    const cambios = Object.fromEntries(Object.entries(marcas.cambios[s.clave] ?? {}).filter(([id]) => hm[id] === undefined || hm[id] === hs.get(id)));
    d.almacenes[s.clave] = fecharLocal(
      l.valores.get(s.clave)!,
      hs,
      mismoDoc ? (e.items[s.clave] ?? {}) : {},
      cambios,
      marcas.borrados[s.clave] ?? {},
      s.tiempo,
      ahora,
      s.porDefecto,
      mismoDoc ? (e.iniciada ?? 0) : 0,
    );
  }
  return d;
}

let enCurso: Promise<boolean> | null = null;

/** One synchronisation; `manual` reports transient errors too. Returns whether it succeeded. */
export function sincronizar(manual = false): Promise<boolean> {
  enCurso ??= ejecutar(manual).finally(() => {
    enCurso = null;
  });
  return enCurso;
}

/** One run at a time across the tabs of this browser (where the Web Locks API exists; Tauri's WebViews have it). */
function ejecutar(manual: boolean): Promise<boolean> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (!locks?.request) return ejecutarSolo(manual);
  return locks.request('epa-sinc', () => ejecutarSolo(manual)) as Promise<boolean>;
}

async function ejecutarSolo(manual: boolean): Promise<boolean> {
  await cargarSinc();
  const token = await leerToken();
  sinc.hayToken = !!token;
  if (!token) return false;
  const repo = leerRepositorio(sinc.ajustes.repositorio);
  const ruta = leerRutaFichero(sinc.ajustes.ruta);
  if (!repo) {
    sinc.error = `El repositorio «${sinc.ajustes.repositorio}» no tiene la forma propietario/nombre.`;
    return false;
  }
  if (!ruta) {
    sinc.error = `La ruta del fichero «${sinc.ajustes.ruta}» no es válida.`;
    return false;
  }
  if (!usuario.listo) return false;
  sinc.ocupado = true;
  try {
    window.dispatchEvent(new CustomEvent('epa:antes-de-sincronizar'));
    await new Promise((r) => setTimeout(r, 0));
    const e = await leerEstadoLocal(true);
    const inicio = Date.now();
    const lectura = await leerLocales();
    const marcas = await recargarMarcas();
    const maximos = Object.fromEntries(sincronizables().filter((s) => s.maximo).map((s) => [s.clave, s.maximo!]));
    const uniones: Record<string, Union> = Object.fromEntries(
      sincronizables()
        .filter((s) => s.unir)
        .map((s) => [s.clave, { unir: s.unir!, valido: s.valido }]),
    );
    const nombre = nombreDispositivo();

    let remoto: DocSincronizacion | null = null;
    let fusion: DocSincronizacion | null = null;
    let reintentos = 0;
    let escrito = false;
    let creado = false;
    let mismoDoc = false;
    for (;;) {
      const f = await leerFichero(token, repo.owner, repo.repo, ruta);
      remoto = null;
      if (f) {
        try {
          remoto = leerDoc(f.texto);
        } catch (err) {
          throw new ErrorGitHub(
            `El fichero ${sinc.ajustes.ruta} de ${sinc.ajustes.repositorio} no se puede usar: ${(err as Error).message}. No se ha modificado; cambie la ruta o bórrelo en GitHub.`,
            0,
          );
        }
      }
      const ahora = Date.now();
      mismoDoc = !!remoto && remoto.id === e.doc;
      const local = docLocal(lectura, e, mismoDoc, marcas, ahora);
      // An unchanged local item that the file no longer has, older than the prune horizon of the file:
      // it was deleted elsewhere and its tombstone already pruned; drop it instead of bringing it back.
      if (remoto && mismoDoc) {
        for (const s of sincronizables()) {
          const c = local.almacenes[s.clave]!;
          const r = remoto.almacenes[s.clave] ?? {};
          const previos = e.items[s.clave] ?? {};
          for (const [id, entrada] of Object.entries(c)) {
            const p = previos[id];
            if (esLapida(entrada) || id in r || !p || p[0] !== entrada.t) continue;
            if (remoto.podado >= p[0]) delete c[id];
          }
        }
      }
      if (remoto) {
        for (const s of sincronizables()) {
          const c = local.almacenes[s.clave]!;
          const r = remoto.almacenes[s.clave] ?? {};
          for (const [id, entrada] of Object.entries(c)) {
            // a tombstone the file no longer has, older than the file's prune horizon: already pruned there; sending
            // it again would make a device whose clock is behind (a later horizon) and the others prune and re-add
            // it for ever (third review)
            if (esLapida(entrada) && !(id in r) && remoto.podado >= entrada.t) delete c[id];
            // a store's default value of unknown age never replaces what the file has (third review)
            else if (!esLapida(entrada) && entrada.t === 1 && id in r) delete c[id];
          }
        }
      }
      // the same value as the file's keeps the file's time (nothing to write for it)
      if (remoto) for (const s of sincronizables()) alinearIguales(local.almacenes[s.clave]!, remoto.almacenes[s.clave]);
      const base = remoto ?? docVacio(idAleatorio(), ahora);
      fusion = fusionarDocs(base, { ...local, id: base.id }, maximos, uniones);
      fusion.id = base.id;
      const horizonte = horizontePoda(ahora);
      let podado = false;
      for (const c of Object.values(fusion.almacenes)) podado = podar(c, horizonte) || podado;
      if (podado) fusion.podado = Math.max(fusion.podado, horizonte);
      if (remoto && mismosAlmacenes(remoto, fusion)) break;
      fusion.actualizado = ahora;
      fusion.dispositivos[e.dispositivo] = { nombre, ultima: ahora, version: VERSION_APP };
      const sha = await escribirFichero(
        token,
        repo.owner,
        repo.repo,
        ruta,
        escribirDoc(fusion),
        f?.sha ?? null,
        mensajeCommit(nombre, ahora),
      );
      if (sha !== null) {
        escrito = true;
        creado = !f;
        break;
      }
      if (++reintentos >= REINTENTOS)
        throw new ErrorGitHub('Otro dispositivo escribía a la vez y no se ha podido terminar; se reintentará.', 409, true);
      await new Promise((r) => setTimeout(r, 300 * reintentos + Math.random() * 400));
    }

    // Apply what the merge changed, item by item, skipping items edited here while the run was going on (each store is
    // read again right before its own application: an edit made while an earlier store was applied counts too).
    const porAlmacen: Record<string, number> = {};
    const claves: string[] = [];
    let recibidos = 0;
    const items: EstadoLocal['items'] = {};
    /** Stores whose application failed: their marks are kept for the next run. */
    const fallidos = new Set<string>();
    for (const s of sincronizables()) {
      const c = fusion.almacenes[s.clave] ?? {};
      const antes = lectura.huellas.get(s.clave)!;
      let actuales: Valores;
      try {
        actuales = await s.leer();
      } catch (err) {
        throw new ErrorGitHub(`No se pudieron leer los datos locales «${s.nombre}» (${err instanceof Error ? err.message : String(err)}).`, 0);
      }
      const ahoraH = new Map(Object.entries(actuales).map(([id, x]) => [id, huella(x)]));
      const tocado = (id: string) => antes.get(id) !== ahoraH.get(id);
      const previos = mismoDoc ? (e.items[s.clave] ?? {}) : {};
      const { poner, quitar, rechazados } = porAplicar(c, ahoraH, tocado, s.valido, previos);
      const n = Object.keys(poner).length + quitar.length;
      let despues: Map<string, string> = ahoraH;
      let fallo = false;
      if (n) {
        try {
          await s.aplicar(poner, quitar);
          porAlmacen[s.clave] = n;
          recibidos += n;
          claves.push(s.clave);
          despues = new Map(Object.entries(await s.leer()).map(([id, x]) => [id, huella(x)]));
        } catch (err) {
          fallo = true;
          fallidos.add(s.clave);
          console.warn(`sincronización: no se pudo aplicar «${s.clave}»`, err instanceof Error ? err.message : err);
        }
      }
      // What is now synchronised: the time of the merged entry and the hash of the file's value (fusion.ts). When the
      // store could not take the merge (or be read back), the items it was given are recorded as losing to the file
      // (fusion.ts registroSincronizado): the next run tries again and sends nothing old.
      items[s.clave] = fallo
        ? registroSincronizado(c, ahoraH, previos, tocado, new Set(), new Set([...Object.keys(poner), ...quitar]), rechazados)
        : registroSincronizado(c, despues, previos, tocado, new Set(Object.keys(poner)), new Set(), rechazados);
    }
    if (claves.length) window.dispatchEvent(new CustomEvent('epa:sincronizado', { detail: { claves } }));

    const fin = Date.now();
    e.doc = fusion.id;
    e.items = items;
    e.ultima = fin;
    e.iniciada = inicio;
    e.resumen = {
      recibidos,
      escrito,
      creado,
      reintentos,
      porAlmacen,
      dispositivos: Object.entries(dispositivosValidos(fusion.dispositivos))
        .map(([id, d]) => ({ nombre: d.nombre, ultima: d.ultima, version: d.version, este: id === e.dispositivo }))
        .sort((a, b) => b.ultima - a.ultima),
    };
    try {
      await guardarEstado(e);
      estadoSinGuardar = false;
      // (marks that cannot be forgotten now stay: harmless, the next run finds those items as recorded)
      await olvidarMarcas(inicio, fallidos).catch(() => undefined);
    } catch (err) {
      // the record stays in memory (the next run uses it) and so do the marks; after a restart the older record is
      // harmless: what was received counts as unmarked (it loses or is equal), what was removed is not deleted again
      estadoSinGuardar = true;
      estadoLocal = e;
      console.warn('sincronización: no se pudo guardar el registro de la pasada', err instanceof Error ? err.message : err);
    }
    sinc.ultima = fin;
    sinc.resumen = e.resumen;
    sinc.error = '';
    sinc.pasajero = false;
    return true;
  } catch (err) {
    const g = err instanceof ErrorGitHub ? err : null;
    const msg = g ? g.message : `Error inesperado: ${err instanceof Error ? err.message : String(err)}`;
    // Automatic runs keep transient failures quiet unless nothing worked before.
    if (manual || !g?.pasajero || !sinc.ultima) {
      sinc.error = msg;
      sinc.pasajero = !!g?.pasajero;
    }
    return false;
  } finally {
    sinc.ocupado = false;
    sinc.ejecuciones++;
  }
}

// ------------------------------------------------------------------ automatic runs

let iniciada = false;
let reloj: ReturnType<typeof setInterval> | null = null;
let oculta = 0;

/** Start-up run and the timers (called once, after the reader's data is loaded). */
export async function iniciarSincronizacionAutomatica(): Promise<void> {
  if (iniciada) return;
  iniciada = true;
  await cargarSinc();
  const auto = () => sinc.ajustes.auto && sinc.hayToken;
  if (auto()) void sincronizar();
  reloj = setInterval(() => {
    if (document.visibilityState === 'visible' && auto()) void sincronizar();
  }, INTERVALO);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      oculta = Date.now();
      void volcarMarcas().catch(() => undefined);
      if (auto()) void sincronizar();
    } else if (oculta && Date.now() - oculta > 60_000 && auto()) {
      void sincronizar();
    }
  });
}

export function detenerSincronizacionAutomatica(): void {
  if (reloj) clearInterval(reloj);
  reloj = null;
}
