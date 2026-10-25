// The GitHub token, stored only on this device and apart from the reader's data:
//   - Tauri (Windows, macOS, Android): its own plugin-store file `credenciales.json` in the app data
//     folder (not `lector.json`, so nothing that reads or copies the reader's data carries the token);
//   - plain browser (development builds only): localStorage key `epa-credencial:github`, outside the
//     `epa:` prefix of the reader's data. Anyone with access to this browser profile can read it.
// The token is never logged, never written to the synchronised file and only shown by its last 4 characters.

import { enTauri } from '../almacen';

const CLAVE = 'epa-credencial:github';

interface Caja {
  leer(): Promise<string>;
  escribir(token: string): Promise<void>;
  borrar(): Promise<void>;
  readonly tipo: 'tauri' | 'navegador' | 'memoria';
}

let caja: Promise<Caja> | null = null;

function obtenerCaja(): Promise<Caja> {
  caja ??= (async (): Promise<Caja> => {
    if (enTauri()) {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('credenciales.json', { autoSave: false, defaults: {} });
        return {
          tipo: 'tauri',
          async leer() {
            return (await store.get<string>('github')) ?? '';
          },
          async escribir(token) {
            await store.set('github', token);
            await store.save();
          },
          async borrar() {
            await store.delete('github');
            await store.save();
          },
        };
      } catch {
        /* fall through to the browser storage */
      }
    }
    try {
      localStorage.getItem(CLAVE);
      return {
        tipo: 'navegador',
        async leer() {
          return localStorage.getItem(CLAVE) ?? '';
        },
        async escribir(token) {
          localStorage.setItem(CLAVE, token);
        },
        async borrar() {
          localStorage.removeItem(CLAVE);
        },
      };
    } catch {
      let t = '';
      return {
        tipo: 'memoria',
        async leer() {
          return t;
        },
        async escribir(token) {
          t = token;
        },
        async borrar() {
          t = '';
        },
      };
    }
  })();
  return caja;
}

export async function leerToken(): Promise<string> {
  try {
    return (await (await obtenerCaja()).leer()).trim();
  } catch {
    return '';
  }
}

export async function guardarToken(token: string): Promise<void> {
  await (await obtenerCaja()).escribir(token.trim());
}

export async function olvidarToken(): Promise<void> {
  await (await obtenerCaja()).borrar();
}

export async function dondeSeGuarda(): Promise<Caja['tipo']> {
  return (await obtenerCaja()).tipo;
}

/** «…a1B2» for the UI. */
export function finalDelToken(token: string): string {
  return token ? '…' + token.slice(-4) : '';
}

/** Rough shape check of a GitHub token (fine-grained `github_pat_…`, classic `ghp_…`, others). */
export function pareceToken(token: string): boolean {
  return /^[A-Za-z0-9_]{20,255}$/.test(token.trim());
}
