// Signed automatic updates on desktop (0.12, Windows and macOS): tauri-plugin-updater reads latest.json from the
// latest release (built by .github/workflows/compilar.yml), downloads the installer of this system and checks its
// signature against the public key in tauri.conf.json before installing anything; tauri-plugin-process relaunches
// the app afterwards. Nothing is downloaded or installed without the reader's click: at start-up the app only
// checks (when the release check of actualizaciones.svelte.ts found a newer version), and silently.
//
// Steps: «Descargar e instalar» downloads with progress; on macOS the new .app replaces the current one right away
// and «Reiniciar para terminar» relaunches; on Windows «Reiniciar para terminar» starts the installer (passive
// mode), which closes the app and opens it again when it ends. Before either, every pending write is flushed.
//
// Unavailable (the «Versión nueva» notice with the link stays, as before 0.12): Android and iOS (the plugin has no
// mobile support), Linux, the browser, and a build whose public key is still the placeholder.
//
// Tests replace the Tauri side with `globalThis.__epaPuenteActualizador` (a PuenteActualizador, optionally with its
// own public key); see tests/actualizador12.spec.ts.

import { enTauri, guardarTodoAntesDeSalir } from '../almacen';
import { CLAVE_ACTUALIZADOR, claveActualizadorValida, explicarErrorActualizador, sistemaActualizable } from './actualizador';
import { compararVersiones } from './fusion';
import { VERSION_APP } from './version-app';

export { explicarErrorActualizador, sistemaActualizable, type SistemaActualizable } from './actualizador';

export type EventoDescarga =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' };

/** The part of the plugin's Update the app uses. */
export interface ActualizacionNativa {
  version: string;
  download(onEvent?: (e: EventoDescarga) => void, options?: { timeout?: number }): Promise<void>;
  install(): Promise<void>;
  close(): Promise<void>;
}

/** What the app needs from Tauri; tests provide their own. */
export interface PuenteActualizador {
  /** Public key to judge availability with (tests); the build's one otherwise. */
  clave?: string;
  comprobar(): Promise<ActualizacionNativa | null>;
  reiniciar(): Promise<void>;
}

const puenteTauri: PuenteActualizador = {
  async comprobar() {
    const { check } = await import('@tauri-apps/plugin-updater');
    return check({ timeout: 30_000 });
  },
  async reiniciar() {
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  },
};

function puentePrueba(): PuenteActualizador | null {
  const p = (globalThis as { __epaPuenteActualizador?: PuenteActualizador }).__epaPuenteActualizador;
  return p && typeof p.comprobar === 'function' ? p : null;
}

function puente(): PuenteActualizador | null {
  return puentePrueba() ?? (enTauri() ? puenteTauri : null);
}

/** Whether this app can update itself: desktop Tauri (or a test bridge) with a real public key. */
export function actualizadorDisponible(): boolean {
  const p = puente();
  if (!p || !sistemaActualizable()) return false;
  return claveActualizadorValida(p.clave ?? CLAVE_ACTUALIZADOR);
}

export type EstadoInstalador = 'inactivo' | 'buscando' | 'disponible' | 'al-dia' | 'descargando' | 'instalando' | 'listo' | 'error';

export const instalador = $state({
  estado: 'inactivo' as EstadoInstalador,
  /** Version offered by latest.json. */
  version: '',
  descargado: 0,
  /** Size announced by the server (0: unknown). */
  total: 0,
  error: '',
});

let pendiente: ActualizacionNativa | null = null;
/** The download finished and (macOS) the new app is in place: only the restart remains. */
let descargada = false;
/** Increases on every download and on «Cancelar» / a stall: a stale download's events and result are ignored. */
let generacion = 0;

/** No `Progress` event for this long (ms) is a stalled download. Tests shorten it with `globalThis.__epaEsperaDescarga`. */
export const ESPERA_DESCARGA = 60_000;
/** Total time the plugin's download may take (reqwest timeout of the request, body included). */
export const DESCARGA_MAXIMA = 15 * 60_000;

function esperaDescarga(): number {
  const t = (globalThis as { __epaEsperaDescarga?: number }).__epaEsperaDescarga;
  return typeof t === 'number' && t > 0 ? t : ESPERA_DESCARGA;
}

class DescargaDetenida extends Error {}

function ocupado(): boolean {
  return instalador.estado === 'descargando' || instalador.estado === 'instalando' || instalador.estado === 'listo';
}

async function soltarPendiente(): Promise<void> {
  const p = pendiente;
  pendiente = null;
  descargada = false;
  await p?.close().catch(() => undefined);
}

/**
 * Asks latest.json whether there is an update for this system. Automatic (start-up): silent on errors, and never
 * while a download or the restart is under way.
 */
export async function comprobarInstalable(manual = false): Promise<void> {
  const p = puente();
  if (!p || !actualizadorDisponible() || ocupado() || instalador.estado === 'buscando') return;
  // an error on screen (e.g. the installer that could not be started) stays until the reader acts on it
  if (!manual && instalador.estado === 'error') return;
  const antes = instalador.estado;
  instalador.estado = 'buscando';
  instalador.error = '';
  try {
    const u = await p.comprobar();
    await soltarPendiente();
    if (u) {
      pendiente = u;
      instalador.version = u.version;
      instalador.estado = 'disponible';
    } else {
      instalador.version = '';
      instalador.estado = 'al-dia';
    }
  } catch (e) {
    if (manual) {
      instalador.error = explicarErrorActualizador(e, 'comprobar');
      instalador.estado = 'error';
    } else {
      console.warn('No se pudo comprobar la actualización automática', e);
      // a failed automatic check changes nothing visible
      instalador.estado = antes;
    }
  }
}

/**
 * The plugin's download with a watchdog: it rejects with DescargaDetenida when no data arrives for esperaDescarga() ms
 * (a connection that stays open but stalls would otherwise keep «Descargando…» forever), and the plugin itself gives
 * up after DESCARGA_MAXIMA.
 */
function descargarVigilado(u: ActualizacionNativa, gen: number): Promise<void> {
  return new Promise<void>((resolver, rechazar) => {
    let ultimo = Date.now();
    const espera = esperaDescarga();
    const reloj = setInterval(() => {
      if (gen !== generacion) {
        clearInterval(reloj);
        rechazar(new DescargaDetenida('cancelada'));
      } else if (Date.now() - ultimo > espera) {
        clearInterval(reloj);
        rechazar(new DescargaDetenida('sin datos'));
      }
    }, Math.max(50, Math.min(1000, espera / 4)));
    u.download(
      (ev) => {
        if (gen !== generacion) return;
        ultimo = Date.now();
        if (ev.event === 'Started') instalador.total = ev.data.contentLength ?? 0;
        else if (ev.event === 'Progress') instalador.descargado += ev.data.chunkLength;
      },
      { timeout: DESCARGA_MAXIMA },
    ).then(
      () => {
        clearInterval(reloj);
        // A download abandoned earlier that ends now: free what it holds — but never the Update in use (closing it
        // frees its Rust resource, and its install would fail with «The resource id N is invalid»). «Cancelar» and
        // the watchdog drop `pendiente`, so an abandoned Update is never the current one; the check is kept anyway.
        if (gen !== generacion && u !== pendiente) void u.close().catch(() => undefined);
        resolver();
      },
      (e: unknown) => {
        clearInterval(reloj);
        rechazar(e);
      },
    );
  });
}

/** «Descargar e instalar»: downloads (with progress) and, on macOS, puts the new app in place. */
export async function descargarEInstalar(): Promise<void> {
  const u = pendiente;
  if (!u || ocupado()) return;
  const gen = ++generacion;
  instalador.estado = 'descargando';
  instalador.error = '';
  instalador.descargado = 0;
  instalador.total = 0;
  let fase: 'descargar' | 'instalar' = 'descargar';
  try {
    if (!descargada) {
      await descargarVigilado(u, gen);
      if (gen !== generacion) return;
      if (sistemaActualizable() === 'macos') {
        fase = 'instalar';
        instalador.estado = 'instalando';
        // replaces the .app bundle (the running copy keeps working until the restart)
        await u.install();
      }
      descargada = true;
    }
    instalador.estado = 'listo';
  } catch (e) {
    if (gen !== generacion) return;
    if (e instanceof DescargaDetenida) {
      // The plugin cannot abort its request: the update is dropped (a later check gives a fresh one) and the
      // abandoned download only frees its bytes if it ever ends.
      generacion++;
      pendiente = null;
      descargada = false;
      instalador.error = `La descarga se ha detenido: no llega nada desde hace más de ${Math.round(esperaDescarga() / 1000)} segundos. Compruebe la conexión y vuelva a intentarlo.`;
      instalador.estado = 'error';
      return;
    }
    instalador.error = explicarErrorActualizador(e, fase);
    instalador.estado = 'error';
  }
}

/**
 * «Cancelar» during the download. The plugin cannot abort its request, so the Update being downloaded is dropped
 * (closed when that download settles) and a fresh check gives a new one for «Descargar e instalar»: no Update object is
 * ever shared between an abandoned download and a new one.
 */
export function cancelarDescarga(): void {
  if (instalador.estado !== 'descargando') return;
  generacion++;
  pendiente = null;
  descargada = false;
  instalador.descargado = 0;
  instalador.total = 0;
  instalador.estado = 'inactivo';
  void comprobarInstalable(true);
}

// ------------------------------------------------------------------ Windows: the installer could not be started

/*
 * On Windows `install()` first runs the plugin's on_before_exit hook (AppHandle::cleanup_before_exit: window hidden,
 * resource table emptied — the stores, the single-instance lock) and only then starts the installer, which ends the
 * process. If starting it fails, nothing can be written to a store any more. So the attempt is recorded BEFORE
 * install(), with the store alive: «intento» {version, t} in a small store of its own (actualizador.json; the reader's
 * lector.json is not touched) and in localStorage. At the next start (recuperarFalloDeInstalacion): this build is that
 * version or newer → it worked, the mark goes; older → it did not, the reader is told once. If install() does return
 * an error, its detail goes to localStorage («fallo», which still works) and the app relaunches; if even the relaunch
 * fails, nothing is shown in the hidden window: the marks speak at the next start.
 */
const MARCA_FALLO = 'epa-actualizador:fallo';
const MARCA_INTENTO = 'epa-actualizador:intento';

interface FalloInstalacion {
  version: string;
  error: string;
  t: number;
}

interface IntentoInstalacion {
  version: string;
  t: number;
}

async function storeActualizador() {
  const { load } = await import('@tauri-apps/plugin-store');
  return load('actualizador.json', { autoSave: false, defaults: {} });
}

async function anotar(clave: 'fallo' | 'intento', marca: string, valor: FalloInstalacion | IntentoInstalacion): Promise<void> {
  try {
    localStorage.setItem(marca, JSON.stringify(valor));
  } catch {
    /* storage refused */
  }
  if (enTauri()) {
    try {
      const s = await storeActualizador();
      await s.set(clave, valor);
      await s.save();
    } catch {
      /* the localStorage copy is enough */
    }
  }
}

/** Reads and removes a mark from both places (the store's copy wins over nothing, localStorage's over the store's). */
async function recoger<T>(clave: 'fallo' | 'intento', marca: string): Promise<T | null> {
  let v: T | null = null;
  try {
    const t = localStorage.getItem(marca);
    if (t) v = JSON.parse(t) as T;
    localStorage.removeItem(marca);
  } catch {
    /* storage refused or not JSON */
  }
  if (enTauri()) {
    try {
      const s = await storeActualizador();
      const g = await s.get<T>(clave);
      if (g) {
        v ??= g;
        await s.delete(clave);
        await s.save();
      }
    } catch {
      /* no store: the localStorage copy, if any */
    }
  }
  return v;
}

/**
 * At start-up (Avisos.svelte): if the previous run tried to install a version on Windows and this build is older than
 * it, the installation did not happen: say so (once) with «Volver a intentarlo», with the reason when it is known. A
 * mark older than a day is dropped silently; one for this version (or an older one) means it worked.
 */
export async function recuperarFalloDeInstalacion(): Promise<void> {
  const fallo = await recoger<FalloInstalacion>('fallo', MARCA_FALLO);
  const intento = await recoger<IntentoInstalacion>('intento', MARCA_INTENTO);
  const reciente = (m: { version?: unknown; t?: unknown } | null): m is { version: string; t: number } =>
    !!m && typeof m.version === 'string' && Date.now() - Number(m.t) < 86_400_000;
  const version = reciente(fallo) ? fallo.version : reciente(intento) ? intento.version : null;
  if (!version || compararVersiones(VERSION_APP, version) >= 0) return;
  if (ocupado() || instalador.estado === 'buscando') return;
  instalador.version = version;
  instalador.error = reciente(fallo)
    ? `No se pudo abrir el instalador de la versión ${version} (${fallo.error}), así que la aplicación se ha vuelto a ` +
      'abrir sin cambios. Puede volver a intentarlo o descargar el instalador desde la publicación.'
    : `La versión ${version} no llegó a instalarse (el instalador no se abrió o no terminó). Puede volver a ` +
      'intentarlo o descargar el instalador desde la publicación.';
  instalador.estado = 'error';
}

/** «Reiniciar para terminar»: saves everything, then relaunches (macOS) or runs the installer (Windows). */
export async function reiniciarParaTerminar(): Promise<void> {
  const p = puente();
  const u = pendiente;
  if (!p || !u || instalador.estado !== 'listo') return;
  const windows = sistemaActualizable() === 'windows';
  instalador.estado = 'instalando';
  try {
    await guardarTodoAntesDeSalir();
    if (windows) {
      // recorded while the store is still alive (see above), then the reader's store saved once more right before
      // the plugin takes over, so a write that came in meanwhile is not lost either
      await anotar('intento', MARCA_INTENTO, { version: u.version, t: Date.now() });
      await guardarTodoAntesDeSalir(50);
      // the plugin starts the installer and ends this process
      await u.install();
    } else {
      // macOS: the new app is already in place
      await p.reiniciar();
    }
  } catch (e) {
    if (windows) {
      // The hook has already hidden the window and emptied the resource table: this process cannot go on usefully.
      // The reason goes to localStorage (the store is gone) and the app relaunches; if that fails too, nothing is
      // shown in the hidden window — the marks speak at the next start.
      await anotar('fallo', MARCA_FALLO, { version: u.version, error: explicarErrorActualizador(e, 'instalar').replace(/\.$/, ''), t: Date.now() });
      try {
        await p.reiniciar();
      } catch (e2) {
        console.warn('No se pudo reiniciar tras el fallo del instalador; se explicará al volver a abrir la aplicación', e2);
      }
      return;
    }
    instalador.error = explicarErrorActualizador(e, 'reiniciar') + ' Cierre la aplicación y ábrala de nuevo para terminar.';
    instalador.estado = 'error';
  }
}

/** «Volver a intentarlo» after an error: the step that failed (download/install, or the check). */
export async function reintentarActualizacion(): Promise<void> {
  if (instalador.estado !== 'error') return;
  if (pendiente && descargada) {
    instalador.estado = 'listo';
    return reiniciarParaTerminar();
  }
  if (pendiente) {
    instalador.estado = 'disponible';
    return descargarEInstalar();
  }
  instalador.estado = 'inactivo';
  return comprobarInstalable(true);
}
