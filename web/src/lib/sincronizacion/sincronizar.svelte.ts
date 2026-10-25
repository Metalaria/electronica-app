// Synchronisation of the owner's data through a JSON file in a private GitHub repository of his.
//
// One run: read the local items of every syncable store (registro.svelte.ts) → GET the file (sha +
// content) → merge item by item (fusion.ts) → PUT it back with that sha when the merge changed it (on
// 409/422 someone wrote first: fetch again and redo the merge) → apply what came from other devices.
// Local times: an item keeps the time of its last synchronised version while its content is unchanged
// (`sinc-estado`: id → [time, hash]); a changed item takes its own time field, the mark of marcas.ts or,
// failing both, the current time. Runs: at start-up, every INTERVALO while the app is visible, when it
// is hidden (and when it comes back after a while), and with «Sincronizar ahora».

import { obtenerAlmacen } from '../almacen';
import { usuario } from '../usuario.svelte';
import {
  docVacio,
  escribirDoc,
  esLapida,
  fusionarDocs,
  horizontePoda,
  huella,
  leerDoc,
  mismosAlmacenes,
  podar,
  type Coleccion,
  type DocSincronizacion,
} from './fusion';
import { ErrorGitHub, escribirFichero, leerFichero, leerRepositorio, leerRutaFichero } from './github';
import { leerToken } from './credenciales';
import { cargarMarcas, olvidarMarcas, volcarMarcas } from './marcas';
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
  /** Per store: item id → [time, hash] of the version last synchronised. */
  items: Record<string, Record<string, [number, string]>>;
  dispositivo: string;
  ultima: number;
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

async function leerEstadoLocal(): Promise<EstadoLocal> {
  if (estadoLocal) return estadoLocal;
  const a = await obtenerAlmacen();
  const e = await a.leer<Partial<EstadoLocal>>(CLAVE_ESTADO);
  estadoLocal = {
    doc: typeof e?.doc === 'string' ? e.doc : '',
    items: e?.items && typeof e.items === 'object' ? e.items : {},
    dispositivo: typeof e?.dispositivo === 'string' && e.dispositivo ? e.dispositivo : idAleatorio(),
    ultima: Number(e?.ultima) || 0,
    resumen: e?.resumen,
  };
  if (!e?.dispositivo) await a.escribir(CLAVE_ESTADO, estadoLocal);
  return estadoLocal;
}

/** Loads settings, token presence and the last run (once). */
export async function cargarSinc(): Promise<void> {
  if (sinc.cargado) return;
  const a = await obtenerAlmacen();
  const aj = await a.leer<Partial<AjustesSinc>>(CLAVE_AJUSTES);
  if (aj && typeof aj === 'object') sinc.ajustes = { ...sinc.ajustes, ...aj };
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
  e.resumen = undefined;
  sinc.ultima = 0;
  sinc.resumen = null;
  await (await obtenerAlmacen()).escribir(CLAVE_ESTADO, e);
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

/** The local data as a document, dating each item (see the header). */
function docLocal(l: Lectura, e: EstadoLocal, mismoDoc: boolean, marcas: Awaited<ReturnType<typeof cargarMarcas>>, ahora: number) {
  const d = docVacio(e.doc || 'local', ahora);
  for (const s of sincronizables()) {
    const c: Coleccion = {};
    const previos = mismoDoc ? (e.items[s.clave] ?? {}) : {};
    const cambios = marcas.cambios[s.clave] ?? {};
    const borrados = marcas.borrados[s.clave] ?? {};
    const valores = l.valores.get(s.clave)!;
    const huellas = l.huellas.get(s.clave)!;
    for (const [id, v] of Object.entries(valores)) {
      const h = huellas.get(id)!;
      const p = previos[id];
      let t: number;
      if (p && p[1] === h) t = p[0];
      else {
        t = Math.max(s.tiempo?.(v) ?? 0, cambios[id] ?? 0);
        if (!t || (p && t <= p[0])) t = ahora;
      }
      c[id] = { t, v };
    }
    for (const [id, p] of Object.entries(previos)) {
      if (id in valores) continue;
      const t = Math.max(borrados[id] ?? ahora, p[0] + 1);
      c[id] = { t, x: 1 };
    }
    d.almacenes[s.clave] = c;
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

async function ejecutar(manual: boolean): Promise<boolean> {
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
    const e = await leerEstadoLocal();
    const inicio = Date.now();
    const lectura = await leerLocales();
    const marcas = await cargarMarcas();
    const maximos = Object.fromEntries(sincronizables().filter((s) => s.maximo).map((s) => [s.clave, s.maximo!]));
    const nombre = nombreDispositivo();

    let remoto: DocSincronizacion | null = null;
    let fusion: DocSincronizacion | null = null;
    let reintentos = 0;
    let escrito = false;
    let creado = false;
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
      const mismoDoc = !!remoto && remoto.id === e.doc;
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
      const base = remoto ?? docVacio(idAleatorio(), ahora);
      fusion = fusionarDocs(base, { ...local, id: base.id }, maximos);
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

    // Apply what the merge changed, item by item, skipping items edited here while the run was going on.
    const ahoraLeido = await leerLocales();
    const porAlmacen: Record<string, number> = {};
    const claves: string[] = [];
    let recibidos = 0;
    const items: EstadoLocal['items'] = {};
    for (const s of sincronizables()) {
      const c = fusion.almacenes[s.clave] ?? {};
      const antes = lectura.huellas.get(s.clave)!;
      const ahoraH = ahoraLeido.huellas.get(s.clave)!;
      const tocado = (id: string) => antes.get(id) !== ahoraH.get(id);
      const poner: Valores = {};
      const quitar: string[] = [];
      for (const [id, entrada] of Object.entries(c)) {
        if (tocado(id)) continue;
        if (esLapida(entrada)) {
          if (ahoraH.has(id)) quitar.push(id);
        } else if (s.valido && !s.valido(entrada.v)) {
          continue;
        } else if (ahoraH.get(id) !== huella(entrada.v)) poner[id] = entrada.v;
      }
      for (const id of ahoraH.keys()) if (!(id in c) && !tocado(id)) quitar.push(id);
      const n = Object.keys(poner).length + quitar.length;
      if (n) {
        try {
          await s.aplicar(poner, quitar);
          porAlmacen[s.clave] = n;
          recibidos += n;
          claves.push(s.clave);
        } catch (err) {
          console.warn(`sincronización: no se pudo aplicar «${s.clave}»`, err instanceof Error ? err.message : err);
        }
      }
      // What is now synchronised: time of the merged entry, hash of what the store really holds.
      const despues = n ? new Map(Object.entries(await s.leer()).map(([id, x]) => [id, huella(x)])) : ahoraH;
      const reg: Record<string, [number, string]> = {};
      for (const [id, entrada] of Object.entries(c)) {
        if (esLapida(entrada) || tocado(id)) continue;
        const h = despues.get(id);
        if (h) reg[id] = [entrada.t, h];
      }
      items[s.clave] = reg;
    }
    if (claves.length) window.dispatchEvent(new CustomEvent('epa:sincronizado', { detail: { claves } }));

    const fin = Date.now();
    e.doc = fusion.id;
    e.items = items;
    e.ultima = fin;
    e.resumen = {
      recibidos,
      escrito,
      creado,
      reintentos,
      porAlmacen,
      dispositivos: Object.entries(fusion.dispositivos)
        .map(([id, d]) => ({ nombre: d.nombre, ultima: d.ultima, version: d.version, este: id === e.dispositivo }))
        .sort((a, b) => b.ultima - a.ultima),
    };
    await (await obtenerAlmacen()).escribir(CLAVE_ESTADO, e);
    await olvidarMarcas(inicio);
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
      void volcarMarcas();
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
