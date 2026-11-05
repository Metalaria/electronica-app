// Saving and opening a text file chosen by the reader (0.12: the progress backup, copia.ts).
// Tauri (desktop and Android): the app's own commands `guardar_fichero_elegido` / `abrir_fichero_elegido`
// (src-tauri/src/lib.rs, module fichero) show the system's save / open dialog and write or read the chosen file in
// Rust — on Android a content:// URI (Storage Access Framework) opened through the content resolver. The webview has
// no dialog or fs permission (tauri-plugin-fs opens file:// URLs without checking its scope, so it must not get
// write/read access). A WebView cannot be relied on for a Blob download: Android's WebView ignores `<a download>`
// (it needs a native DownloadListener, and blob: URLs cannot be handed to the DownloadManager), and WKWebView needs
// a download delegate. If the commands are not there (not available), the browser's way is tried.
// Browser: a Blob download (`<a download>`); opening uses `<input type="file">` (the component), which every WebView
// supports too.

import { invoke } from '@tauri-apps/api/core';
import { enTauri } from '../almacen';

/**
 * Tauri's own rejection of the command itself (missing, or refused by the ACL) — tauri 2.12 webview/mod.rs and
 * ipc/authority.rs texts, anchored to these two commands — and nothing else: an error from the file itself (e.g. an
 * Android document provider's «File not found») must reach the reader as an error, not trigger the fallback.
 */
export function noDisponible(e: unknown): boolean {
  return /^(Command (guardar|abrir)_fichero_elegido not (found|allowed by ACL)|(guardar|abrir)_fichero_elegido not allowed\b)/.test(String(e));
}

/** Android's WebView ignores `<a download>` of a Blob: there the browser fallback would only pretend to save. */
function descargaPosible(): boolean {
  return !/Android/i.test(navigator.userAgent);
}

/** The reader cancelled the dialog. */
export const CANCELADO = 'cancelado';

function descargar(nombre: string, texto: string, tipo: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nombre;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

/**
 * Saves `texto` as a file named `nombre`. Resolves 'guardado' (Tauri: written where the reader chose), 'descargado'
 * (browser: handed to its downloads) or CANCELADO; rejects when the file could not be written.
 */
export async function guardarFichero(nombre: string, texto: string, tipo = 'application/json'): Promise<'guardado' | 'descargado' | typeof CANCELADO> {
  if (enTauri()) {
    let guardado: boolean;
    try {
      guardado = await invoke<boolean>('guardar_fichero_elegido', { nombre, texto });
    } catch (e) {
      if (!noDisponible(e)) throw new Error(String(e));
      if (!descargaPosible()) throw new Error('Este dispositivo no permite guardar el fichero de la copia: no se ha guardado nada.');
      console.warn('diálogo de guardar no disponible; se descarga', e);
      descargar(nombre, texto, tipo);
      return 'descargado';
    }
    return guardado ? 'guardado' : CANCELADO;
  }
  descargar(nombre, texto, tipo);
  return 'descargado';
}

/**
 * Tauri only: the open dialog and the chosen file's text (null: cancelled). Undefined when the plugins are not available
 * (the component then uses `<input type="file">`).
 */
export async function abrirFicheroTauri(): Promise<{ nombre: string; texto: string } | null | undefined> {
  if (!enTauri()) return undefined;
  try {
    // (the command filters .json on desktop only: on Android a document provider may give a .json file another
    // MIME type, and it could not be chosen; it refuses files over 50 MB and text that is not UTF-8)
    return await invoke<{ nombre: string; texto: string } | null>('abrir_fichero_elegido');
  } catch (e) {
    if (!noDisponible(e)) throw new Error(String(e));
    console.warn('diálogo de abrir no disponible', e);
    return undefined;
  }
}
