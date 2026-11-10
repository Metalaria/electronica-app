// 1.1: deep links (lib/enlaces.ts) delivered by the native shell. src-tauri/src/lib.rs (module `enlaces`) keeps the
// last link the system gave the app — at a cold start (Windows/Linux: the command line; macOS: the «open URL» event;
// Android: the launching intent), from a second launch while the app runs (single instance), a macOS «open URL»
// event, or an Android new intent — and emits `epa-enlace`; the page takes it with the command `enlace_pendiente`
// (taken once: a reload of the page does not open it again) and goes to its lesson route. The listener is set before
// the first ask, so a link that arrives in between is not lost. In a browser nothing is listened to: the hash form
// (#epa://leccion/…) is handled by the router (lib/ruta.svelte.ts).

import { enTauri } from './almacen';
import { rutaDeEnlace } from './enlaces';
import { app } from './estado.svelte';
import { registrar } from './registro';

let iniciado = false;

/** Goes to the route of a deep link (validated: anything else opens the lesson page's «no encontrada»). */
export function abrirEnlace(texto: string): void {
  const destino = rutaDeEnlace(texto, app.indice);
  registrar('info', 'enlace', destino);
  if (location.hash === destino) return;
  location.hash = destino;
}

/** Starts listening to the native shell's deep links (Tauri only; once). */
export async function iniciarEnlaces(): Promise<void> {
  if (iniciado || !enTauri()) return;
  iniciado = true;
  try {
    const [{ invoke }, { listen }] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')]);
    const tomar = async () => {
      try {
        const url = await invoke<string | null>('enlace_pendiente');
        if (url) abrirEnlace(url);
      } catch (e) {
        registrar('aviso', 'enlace', `no se pudo leer el enlace: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    await listen('epa-enlace', () => void tomar());
    await tomar();
  } catch (e) {
    // (an older shell without the command, or no event API: the app works as before)
    registrar('aviso', 'enlace', `enlaces no disponibles: ${e instanceof Error ? e.message : String(e)}`);
  }
}
