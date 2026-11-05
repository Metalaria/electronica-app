// Minimal GitHub REST client for the two features that talk to GitHub: the update notice (latest release
// of the app's repository, public since 0.11: read without a token when there is none, 0.12) and the
// synchronisation file (Contents API of the data repository, always with the token).
// Plain fetch from the webview: api.github.com answers CORS requests, and the Tauri CSP allows it
// (src-tauri/tauri.conf.json → connect-src). The token is only ever put in the Authorization header:
// it is never logged, and error messages never include it.

const API = 'https://api.github.com';

export class ErrorGitHub extends Error {
  constructor(
    mensaje: string,
    /** HTTP status, or 0 for a network error. */
    readonly estado: number,
    /** A transient problem (offline, 5xx, rate limit): automatic runs stay quiet and retry later. */
    readonly pasajero = false,
    /** Rate limit: GitHub accepts requests again from this time (ms); nothing should be asked before. */
    readonly reintentarEn = 0,
  ) {
    super(mensaje);
    this.name = 'ErrorGitHub';
  }
}

/** Request headers; without a token (public data only) there is no Authorization header at all. */
function cabeceras(token: string | null, accept = 'application/vnd.github+json'): Record<string, string> {
  const h: Record<string, string> = {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** «owner/repo» → validated pair, or null. */
export function leerRepositorio(texto: string): { owner: string; repo: string } | null {
  const m = /^\s*([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})\s*$/.exec(texto);
  if (!m || m[2] === '.' || m[2] === '..') return null;
  return { owner: m[1]!, repo: m[2]! };
}

/** «carpeta/fichero.json» → URL path with each segment encoded; null when unusable. */
export function leerRutaFichero(texto: string): string | null {
  const partes = texto.trim().replace(/^\/+/, '').split('/');
  if (!partes.length || partes.some((p) => !p || p === '.' || p === '..')) return null;
  return partes.map(encodeURIComponent).join('/');
}

/** A request that does not answer in this time is given up (a hung connection must not block the synchronisation,
 * which runs one at a time across tabs). Tests may lower it with `globalThis.__epaEsperaRed` (ms). */
export const ESPERA_RED = 45_000;

async function pedir(url: string, init: RequestInit): Promise<Response> {
  const espera = (globalThis as { __epaEsperaRed?: number }).__epaEsperaRed ?? ESPERA_RED;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), espera);
  try {
    // no-store: GitHub's API answers with max-age=60, and a cached GET would give a stale sha.
    return await fetch(url, { ...init, cache: 'no-store', credentials: 'omit', signal: control.signal });
  } catch {
    if (control.signal.aborted) throw new ErrorGitHub('GitHub tarda demasiado en responder; se reintentará más tarde.', 0, true);
    throw new ErrorGitHub('Sin conexión con GitHub (api.github.com); se reintentará más tarde.', 0, true);
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * When a rate-limited response lets requests through again (ms): `retry-after` (seconds, secondary limits), else
 * `x-ratelimit-reset` (epoch seconds, primary limit), else in a minute (GitHub's advice for secondary limits
 * without headers).
 */
export function finDelLimite(r: Response, ahora = Date.now()): number {
  const espera = Number(r.headers.get('retry-after'));
  if (espera > 0) return ahora + espera * 1000;
  const reinicio = Number(r.headers.get('x-ratelimit-reset'));
  if (reinicio > 0 && reinicio * 1000 > ahora) return reinicio * 1000;
  return ahora + 60_000;
}

function horaReinicio(t: number): string {
  return 'a las ' + new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/** The rate-limit error (Spanish) for a request that may not be sent before `t`. */
export function errorLimite(t: number, estado = 429): ErrorGitHub {
  return new ErrorGitHub(`GitHub limita el número de peticiones; se podrá volver a intentar ${horaReinicio(t)}.`, estado, true, t);
}

/** Spanish explanation of a failed response; `que` names what was being accessed; `anonima`: sent without a token. */
export async function explicar(r: Response, que: string, permiso: string, anonima = false): Promise<ErrorGitHub> {
  let msg = '';
  try {
    const j = (await r.json()) as { message?: string };
    msg = typeof j.message === 'string' ? j.message : '';
  } catch {
    /* not JSON */
  }
  if (r.status === 401)
    return new ErrorGitHub(
      'GitHub rechaza el token (401): no es válido, ha caducado o se ha revocado. Cree uno nuevo y péguelo en «Sincronización».',
      401,
    );
  if (
    r.status === 429 ||
    (r.status === 403 && (r.headers.get('x-ratelimit-remaining') === '0' || r.headers.has('retry-after') || /rate limit/i.test(msg)))
  )
    return errorLimite(finDelLimite(r), r.status);
  if (anonima && r.status === 403) return new ErrorGitHub(`GitHub no deja leer ${que} (error 403).`, 403);
  if (anonima && r.status === 404) return new ErrorGitHub(`No se encuentra ${que} en GitHub.`, 404);
  if (r.status === 403)
    return new ErrorGitHub(`El token no tiene permiso para ${que} (hace falta ${permiso}).`, 403);
  if (r.status === 404)
    return new ErrorGitHub(
      `No se encuentra ${que}, o el token no tiene acceso a él («Repository access» debe incluir ese repositorio).`,
      404,
    );
  if (r.status >= 500) return new ErrorGitHub(`GitHub no responde bien (error ${r.status}); se reintentará más tarde.`, r.status, true);
  return new ErrorGitHub(`GitHub responde ${r.status}${msg ? ` («${msg}»)` : ''} al acceder a ${que}.`, r.status);
}

// ------------------------------------------------------------------ base64 + UTF-8

export function aBase64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function deBase64(b64: string): string {
  const bin = atob(b64.replace(/[\s]/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

// ------------------------------------------------------------------ releases

export interface Publicacion {
  version: string;
  nombre: string;
  url: string;
  notas: string;
  fecha: string;
  ficheros: string[];
}

/** The latest release of a public repository; `token` null (or empty) asks anonymously (no Authorization header). */
export async function ultimaPublicacion(token: string | null, owner: string, repo: string): Promise<Publicacion | null> {
  const anonima = !token;
  const r = await pedir(`${API}/repos/${owner}/${repo}/releases/latest`, { headers: cabeceras(token) });
  if (r.status === 404) {
    // Either no release yet, or no access: tell them apart with the repository itself.
    const repoR = await pedir(`${API}/repos/${owner}/${repo}`, { headers: cabeceras(token) });
    if (repoR.ok) return null;
    throw await explicar(repoR, `el repositorio ${owner}/${repo}`, '«Contents: Read-only» en ese repositorio', anonima);
  }
  if (!r.ok) throw await explicar(r, `las publicaciones de ${owner}/${repo}`, '«Contents: Read-only» en ese repositorio', anonima);
  const j = (await r.json()) as {
    tag_name?: string;
    name?: string;
    html_url?: string;
    body?: string;
    published_at?: string;
    assets?: { name?: string }[];
  };
  return {
    version: (j.tag_name ?? '').replace(/^v/, ''),
    nombre: j.name ?? j.tag_name ?? '',
    url: j.html_url ?? `https://github.com/${owner}/${repo}/releases/latest`,
    notas: j.body ?? '',
    fecha: j.published_at ?? '',
    ficheros: (j.assets ?? []).map((a) => a.name ?? '').filter(Boolean),
  };
}

// ------------------------------------------------------------------ contents API

export interface FicheroRemoto {
  sha: string;
  texto: string;
}

const PERMISO_DATOS = '«Contents: Read and write» en el repositorio de datos';

/** The file, or null when it does not exist yet (the repository itself is reachable). */
export async function leerFichero(token: string, owner: string, repo: string, ruta: string): Promise<FicheroRemoto | null> {
  const url = `${API}/repos/${owner}/${repo}/contents/${ruta}`;
  const r = await pedir(url, { headers: cabeceras(token) });
  // 409 «Git Repository is empty»: no file yet (the first PUT creates it)
  if (r.status === 409) return null;
  if (r.status === 404) {
    const repoR = await pedir(`${API}/repos/${owner}/${repo}`, { headers: cabeceras(token) });
    if (repoR.ok) return null;
    throw await explicar(repoR, `el repositorio ${owner}/${repo}`, PERMISO_DATOS);
  }
  if (!r.ok) throw await explicar(r, `el fichero de sincronización de ${owner}/${repo}`, PERMISO_DATOS);
  const j = (await r.json()) as { sha?: string; content?: string; encoding?: string; type?: string; size?: number };
  if (Array.isArray(j) || j.type !== 'file' || !j.sha)
    throw new ErrorGitHub(`La ruta del fichero de sincronización es una carpeta en ${owner}/${repo}; indique un fichero .json.`, 400);
  if (j.encoding === 'base64' && typeof j.content === 'string') return { sha: j.sha, texto: deBase64(j.content) };
  // Files over 1 MB come without content: ask for the raw bytes (up to 100 MB).
  const raw = await pedir(url, { headers: cabeceras(token, 'application/vnd.github.raw') });
  if (!raw.ok) throw await explicar(raw, `el fichero de sincronización de ${owner}/${repo}`, PERMISO_DATOS);
  return { sha: j.sha, texto: await raw.text() };
}

/** Creates (sha null) or replaces the file; returns the new sha, or null on a conflict (409/422: someone wrote first). */
export async function escribirFichero(
  token: string,
  owner: string,
  repo: string,
  ruta: string,
  texto: string,
  sha: string | null,
  mensaje: string,
): Promise<string | null> {
  const cuerpo: Record<string, string> = { message: mensaje, content: aBase64(texto) };
  if (sha) cuerpo.sha = sha;
  const r = await pedir(`${API}/repos/${owner}/${repo}/contents/${ruta}`, {
    method: 'PUT',
    headers: { ...cabeceras(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (r.status === 409 || r.status === 422) return null;
  if (!r.ok) throw await explicar(r, `escribir el fichero de sincronización en ${owner}/${repo}`, PERMISO_DATOS);
  const j = (await r.json()) as { content?: { sha?: string } };
  return j.content?.sha ?? '';
}
