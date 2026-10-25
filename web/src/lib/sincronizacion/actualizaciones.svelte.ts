// «Hay una versión nueva»: the latest release of the app's private repository (GitHub Releases, published
// by .github/workflows/compilar.yml on every tag vX.Y.Z) compared with this build's version. At start-up
// at most once every 12 h, never blocking and silent on any error; «Buscar actualizaciones» in the
// settings checks at once and reports errors. Without a token nothing is requested at all (the
// repository is private, so the API answers 404 to anonymous requests).

import { obtenerAlmacen } from '../almacen';
import { compararVersiones } from './fusion';
import { ErrorGitHub, ultimaPublicacion, type Publicacion } from './github';
import { leerToken } from './credenciales';
import { VERSION_APP } from './version-app';

export const REPO_APP = { owner: 'Metalaria', repo: 'electronica-app' } as const;
export const CADA = 12 * 3_600_000;
const CLAVE = 'sinc-version';

interface Guardado {
  /** Last check (ms). */
  t: number;
  ultima: Publicacion | null;
  /** Version whose notice was dismissed. */
  descartada?: string;
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
  sinToken: false,
});

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
    }
  })();
  return cargado;
}

/** Checks GitHub now (manual) or when the last check is older than 12 h (automatic). */
export async function buscarActualizaciones(manual = false): Promise<void> {
  await cargar();
  actualizacion.alDia = false;
  const token = await leerToken();
  actualizacion.sinToken = !token;
  if (!token) {
    if (manual) actualizacion.error = '';
    return;
  }
  if (!manual && Date.now() - actualizacion.comprobada < CADA) return;
  if (actualizacion.buscando) return;
  actualizacion.buscando = true;
  try {
    const p = await ultimaPublicacion(token, REPO_APP.owner, REPO_APP.repo);
    actualizacion.ultima = p;
    actualizacion.comprobada = Date.now();
    actualizacion.error = '';
    if (manual) {
      actualizacion.alDia = !versionNueva();
      // Asking again shows a dismissed notice again.
      if (versionNueva()) actualizacion.descartada = '';
    }
    await guardar();
  } catch (e) {
    if (manual) actualizacion.error = e instanceof ErrorGitHub ? e.message : `No se pudo comprobar: ${String(e)}`;
  } finally {
    actualizacion.buscando = false;
  }
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
