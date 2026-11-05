// Pure parts of the signed automatic updates (0.12; instalador.svelte.ts holds the state).
// The public key, fixed at build time by vite.config.ts from src-tauri/tauri.conf.json (plugins.updater.pubkey):
// the repository ships a placeholder until the owner pastes his key (README, «Actualizaciones automáticas
// firmadas»); with the placeholder, or anything that is not a minisign public key, the desktop app treats the
// automatic update as unavailable and keeps the «Versión nueva» notice with the link. The check decodes the key as
// tauri-plugin-updater does (base64 → text whose second line is base64 of 42 bytes: algorithm «Ed», 8-byte key
// id, 32-byte Ed25519 key), so a key accepted here is one the plugin can use.
// Also which systems can update themselves, and the Spanish explanation of the plugin's errors. No runes, no DOM:
// the tests import this module in Node.

declare const __CLAVE_ACTUALIZADOR__: string;

export const CLAVE_ACTUALIZADOR: string = typeof __CLAVE_ACTUALIZADOR__ === 'string' ? __CLAVE_ACTUALIZADOR__ : '';

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

function deBase64(texto: string): Uint8Array | null {
  const t = texto.trim();
  if (!t || t.length % 4 !== 0 || !B64.test(t)) return null;
  try {
    const bin = atob(t);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Whether `pubkey` is a usable minisign public key (base64 of the .pub file, as `tauri signer generate` writes it). */
export function claveActualizadorValida(pubkey: string = CLAVE_ACTUALIZADOR): boolean {
  if (typeof pubkey !== 'string') return false;
  const texto = deBase64(pubkey);
  if (!texto) return false;
  let lineas: string[];
  try {
    lineas = new TextDecoder('utf-8', { fatal: true }).decode(texto).split(/\r?\n/);
  } catch {
    return false;
  }
  if (lineas.length < 2) return false;
  const bin = deBase64(lineas[1]!);
  return !!bin && bin.length === 42 && bin[0] === 0x45 && (bin[1] === 0x64 || bin[1] === 0x44);
}

export type SistemaActualizable = 'windows' | 'macos';

/** Windows or macOS from the webview's user agent (WebView2 / WKWebView); null elsewhere (Android says «Linux»). */
export function sistemaActualizable(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): SistemaActualizable | null {
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return null;
  if (/Windows NT/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  return null;
}

/** Spanish explanation of a plugin error; `fase` says what was being done. */
export function explicarErrorActualizador(e: unknown, fase: 'comprobar' | 'descargar' | 'instalar' | 'reiniciar'): string {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e) ?? '';
  if (/valid release JSON|ReleaseNotFound|platforms|TargetNotFound/i.test(m))
    return 'La última versión no trae actualización automática para este equipo. Descárguela desde la publicación.';
  if (/signed for version|does not specify the version/i.test(m))
    return 'La actualización no corresponde a la versión anunciada, así que no se ha instalado nada. Descárguela desde la publicación.';
  if (/signature|minisign|key ?id|UnexpectedKeyId|InvalidEncoding|base64/i.test(m))
    return 'La firma de la actualización no es válida, así que no se ha instalado nada. Descárguela desde la publicación.';
  if (/Authentication failed or was cancelled/i.test(m))
    return 'macOS pidió permiso para reemplazar la aplicación y no se concedió: no se ha cambiado nada.';
  if (/mount point/i.test(m))
    return 'La aplicación no está en «Aplicaciones» (¿se abrió desde la imagen .dmg?). Muévala allí e inténtelo de nuevo.';
  if (/permission denied|PermissionDenied|os error 13|os error 5\b|access is denied|acceso denegado/i.test(m))
    return 'El sistema no deja reemplazar la aplicación. Instale la versión nueva a mano desde la publicación.';
  if (/error sending request|connect|dns|timed? ?out|network|tls|certificate|reqwest|decoding response|body/i.test(m))
    return `No se pudo conectar con GitHub para ${fase} la actualización. Compruebe la conexión y vuelva a intentarlo.`;
  const detalle = m.replace(/\s+/g, ' ').trim().slice(0, 160);
  return `No se pudo ${fase} la actualización${detalle ? ` (${detalle})` : ''}.`;
}
