// «Hay una versión nueva»: the latest release of the app's repository (GitHub Releases, published
// by .github/workflows/compilar.yml on every tag vX.Y.Z) compared with this build's version. At start-up
// at most once every 12 h, never blocking and silent on any error; «Buscar actualizaciones» in the
// settings checks at once and reports errors.
//
// The repository is public, so the check needs no token (0.12): with the synchronisation token it is sent with
// it (GitHub allows far more requests then; a rejected token falls back to asking anonymously), without one it
// goes without an Authorization header. The data repository is never contacted here. Anonymous requests share
// GitHub's limit of 60 an hour per IP address: a rate-limited answer stores until when, and no request is sent
// before that (the manual check says when it can be tried again). In the plain browser (development build) the
// start-up check without a token is not made, so the browser tests and a development session stay off the
// network unless asked; the apps (Tauri) make it.
//
// On Windows and macOS the newer version can also be downloaded and installed from the app (instalador.svelte.ts);
// that check follows this one when it finds a newer version, or when the reader asks.

import { enTauri, obtenerAlmacen } from '../almacen';
import { compararVersiones } from './fusion';
import { ErrorGitHub, errorLimite, ultimaPublicacion, type Publicacion } from './github';
import { leerToken } from './credenciales';
import { VERSION_APP } from './version-app';
import { actualizadorDisponible, comprobarInstalable } from './instalador.svelte';

export const REPO_APP = { owner: 'Metalaria', repo: 'electronica-app' } as const;
export const CADA = 12 * 3_600_000;
const CLAVE = 'sinc-version';

interface Guardado {
  /** Last check (ms). */
  t: number;
  ultima: Publicacion | null;
  /** Version whose notice was dismissed. */
  descartada?: string;
  /** GitHub's rate limit: no request before this time (ms). */
  limite?: number;
}

export const actualizacion = $state({
  version: VERSION_APP,
  ultima: null as Publicacion | null,
  comprobada: 0,
  descartada: '',
  buscando: false,
  error: '',
  /** «Buscar actualizaciones» was pressed and there is nothing newer. */
  alDia: false,
  /** No synchronisation token: the check is anonymous. */
  sinToken: false,
  /** GitHub's rate limit: no request before this time (ms; 0 = none). */
  limite: 0,
});

/** Whether the start-up check is made without a token: in the apps, not in the plain browser (tests may force it). */
function anonimaAlArrancar(): boolean {
  return enTauri() || (globalThis as { __epaComprobarSinToken?: boolean }).__epaComprobarSinToken === true;
}

/** The newer release to announce, or null. */
export function versionNueva(): Publicacion | null {
  const u = actualizacion.ultima;
  if (!u || compararVersiones(u.version, VERSION_APP) <= 0) return null;
  return u;
}

export function avisoVisible(): boolean {
  const u = versionNueva();
  return !!u && u.version !== actualizacion.descartada;
}

async function guardar(): Promise<void> {
  const g: Guardado = {
    t: actualizacion.comprobada,
    ultima: $state.snapshot(actualizacion.ultima),
    descartada: actualizacion.descartada || undefined,
    limite: actualizacion.limite > Date.now() ? actualizacion.limite : undefined,
  };
  await (await obtenerAlmacen()).escribir(CLAVE, g);
}

let cargado: Promise<void> | null = null;
function cargar(): Promise<void> {
  cargado ??= (async () => {
    const g = await (await obtenerAlmacen()).leer<Guardado>(CLAVE);
    if (g && typeof g === 'object') {
      actualizacion.comprobada = Number(g.t) || 0;
      actualizacion.ultima = g.ultima && typeof g.ultima.version === 'string' ? g.ultima : null;
      actualizacion.descartada = typeof g.descartada === 'string' ? g.descartada : '';
      actualizacion.limite = Number(g.limite) > Date.now() ? Number(g.limite) : 0;
    }
  })();
  return cargado;
}

/** The latest release, with the token when there is one; a rejected token (401) asks again anonymously. */
async function pedirUltima(token: string): Promise<Publicacion | null> {
  if (!token) return ultimaPublicacion(null, REPO_APP.owner, REPO_APP.repo);
  try {
    return await ultimaPublicacion(token, REPO_APP.owner, REPO_APP.repo);
  } catch (e) {
    if (e instanceof ErrorGitHub && e.estado === 401) return ultimaPublicacion(null, REPO_APP.owner, REPO_APP.repo);
    throw e;
  }
}

/** Checks GitHub now (manual) or when the last check is older than 12 h (automatic). */
export async function buscarActualizaciones(manual = false): Promise<void> {
  await cargar();
  actualizacion.alDia = false;
  const token = await leerToken();
  actualizacion.sinToken = !token;
  if (!manual && !token && !anonimaAlArrancar()) return;
  if (actualizacion.buscando) return;
  if (!manual && Date.now() - actualizacion.comprobada < CADA) {
    // The newer version found earlier: is it installable from here? (no request to the API)
    if (versionNueva() && actualizadorDisponible()) void comprobarInstalable(false);
    return;
  }
  if (actualizacion.limite > Date.now()) {
    if (manual) {
      actualizacion.error = errorLimite(actualizacion.limite).message;
      void comprobarInstalable(true);
    }
    return;
  }
  actualizacion.buscando = true;
  try {
    const p = await pedirUltima(token);
    actualizacion.ultima = p;
    actualizacion.comprobada = Date.now();
    actualizacion.error = '';
    actualizacion.limite = 0;
    if (manual) {
      actualizacion.alDia = !versionNueva();
      // Asking again shows a dismissed notice again.
      if (versionNueva()) actualizacion.descartada = '';
    }
    await guardar();
  } catch (e) {
    if (e instanceof ErrorGitHub && e.reintentarEn > Date.now()) {
      actualizacion.limite = e.reintentarEn;
      await guardar().catch(() => undefined);
    }
    if (manual) actualizacion.error = e instanceof ErrorGitHub ? e.message : `No se pudo comprobar: ${String(e)}`;
  } finally {
    actualizacion.buscando = false;
  }
  // latest.json is read from github.com, not from the API: it does not count against the API's limit
  if (manual || versionNueva()) void comprobarInstalable(manual);
}

export function descartarAviso(): void {
  const u = versionNueva();
  if (!u) return;
  actualizacion.descartada = u.version;
  void guardar();
}

/** The first lines of the release notes as plain text (no Markdown marks), at most ~300 characters. */
export function resumenNotas(notas: string): string {
  const lineas = notas
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^\s*(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*)/, '')
        .replace(/\*\*|__|`/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .trim(),
    )
    .filter(Boolean);
  let s = '';
  for (const l of lineas) {
    if (s.length + l.length > 300) {
      if (!s) s = l.slice(0, 297) + '…';
      else s += ' …';
      break;
    }
    s += (s ? ' · ' : '') + l;
  }
  return s;
}

/** Which installer of the release fits this device. */
export function ficheroParaEsteEquipo(p: Publicacion): string | null {
  const ua = navigator.userAgent;
  const busca = /Android/i.test(ua) ? /android\.apk$/i : /Mac OS X|Macintosh/i.test(ua) ? /\.dmg$/i : /Windows/i.test(ua) ? /setup\.exe$/i : null;
  return (busca && p.ficheros.find((f) => busca.test(f))) || null;
}

/** Opens a web page in the system browser (Tauri: the opener plugin; browser: a new tab). */
export async function abrirEnNavegador(url: string): Promise<void> {
  if (!/^https:\/\//.test(url)) return;
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('plugin:opener|open_url', { url });
      return;
    } catch (e) {
      console.warn('No se pudo abrir el navegador del sistema', e instanceof Error ? e.message : e);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
