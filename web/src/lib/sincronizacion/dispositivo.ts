// The id of this installation (0.12): the key of its own items in stores where each device keeps its own record (the
// daily activity, lib/progreso-dias.ts). Device-only: kept under the almacen key `dispositivo-local` { id }, never
// synchronised nor exported in a backup (a backup restored elsewhere must not make two devices write one record).
// Read at load without writing anything (an upgrade writes nothing at load): a new id is stored the first time it is
// used (`usarIdDispositivo`). The tabs of a browser share it (each keeps its own record: `idRegistro`); two tabs that
// create it at once may each keep their own for the session — harmless: a day's activity is the sum of every record.

import { enTauri, obtenerAlmacen } from '../almacen';

export const CLAVE_DISPOSITIVO = 'dispositivo-local';

let estado: Promise<{ id: string; guardado: boolean }> | null = null;
let guardando = false;

const valido = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-z]{6,40}$/.test(x);

function nuevoId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** This device's id: the stored one, or a new one (stored when first used). Rejects if the storage cannot be read. */
export function idDispositivo(): Promise<string> {
  estado ??= (async () => {
    const v = await (await obtenerAlmacen()).leer<{ id?: unknown }>(CLAVE_DISPOSITIVO);
    return v && typeof v === 'object' && valido(v.id) ? { id: v.id, guardado: true } : { id: nuevoId(), guardado: false };
  })().catch((e: unknown) => {
    estado = null;
    throw e;
  });
  return estado.then((e) => e.id);
}

let pestana: Promise<string> | null = null;

/** BroadcastChannel of the tabs of this browser: a tab answers when another asks for the id it holds. */
const CANAL = 'epa-pestanas';
/** How long a tab waits for another holding the same id to answer (ms). */
const ESPERA_PESTANA = 150;

/** Web Lock held by the tab for its whole life on its id (`idPestana`). */
const CERROJO = 'epa-pestana:';

interface Cerrojos {
  request(nombre: string, o: { ifAvailable: boolean }, f: (l: unknown) => unknown): Promise<unknown>;
}

/**
 * Takes the tab's lock on `id` for the rest of the page's life: true if granted, false if another open tab holds it,
 * null if this browser has no Web Locks (or the request fails). The browser releases it when the page goes away.
 */
function tomarCerrojo(id: string): Promise<boolean | null> {
  const locks = (globalThis as { navigator?: { locks?: Cerrojos } }).navigator?.locks;
  if (!locks || typeof locks.request !== 'function') return Promise.resolve(null);
  return new Promise((ok) => {
    locks
      .request(CERROJO + id, { ifAvailable: true }, (l) => {
        if (!l) {
          ok(false);
          return undefined;
        }
        ok(true);
        // (held until the page goes away)
        return new Promise(() => undefined);
      })
      .catch(() => ok(null));
  });
}

/**
 * The tab's id: the one in sessionStorage (a reload keeps it), unless another open tab holds it — «Duplicar pestaña»
 * and «Reabrir pestaña cerrada» copy sessionStorage, and two tabs sharing a record could only keep one of two versions
 * of it (review 0.12, finding 5). Each tab holds a Web Lock on its id for its whole life (`tomarCerrojo`, review 0.12c,
 * finding 2): a tab that is refused the lock takes a new id. The browser grants and refuses it whatever the other tab is
 * doing — the BroadcastChannel question used before (and still the fallback without Web Locks) went unanswered when the
 * original tab was busy for longer than ESPERA_PESTANA (a 3D board, a simulation) or frozen, and both tabs kept one id.
 * Every tab still answers on the channel for its id for as long as it is open.
 */
async function idPestana(): Promise<string> {
  let guardada: string | null = null;
  try {
    guardada = sessionStorage.getItem('epa:pestana');
  } catch {
    // (no sessionStorage: one id for this page's life)
  }
  let mio = guardada && /^[0-9a-z]{4,16}$/.test(guardada) ? guardada : nuevoId().slice(0, 8);
  let cerrojo = await tomarCerrojo(mio);
  for (let i = 0; cerrojo === false && i < 5; i++) {
    mio = nuevoId().slice(0, 8);
    cerrojo = await tomarCerrojo(mio);
  }
  if (cerrojo === null && typeof BroadcastChannel !== 'undefined') {
    const canal = new BroadcastChannel(CANAL);
    // (Node: the open channel must not keep the process alive)
    (canal as unknown as { unref?: () => void }).unref?.();
    const ocupada = await new Promise<boolean>((ok) => {
      const pregunta = mio;
      canal.onmessage = (e: MessageEvent) => {
        const m = e.data as { pregunta?: unknown; ocupada?: unknown } | null;
        if (m?.pregunta === mio) canal.postMessage({ ocupada: mio });
        else if (m?.ocupada === pregunta) ok(true);
      };
      canal.postMessage({ pregunta });
      setTimeout(() => ok(false), ESPERA_PESTANA);
    });
    if (ocupada) mio = nuevoId().slice(0, 8);
  } else if (typeof BroadcastChannel !== 'undefined') {
    // (with the lock: still answering a tab that asks on the channel — one without Web Locks)
    const canal = new BroadcastChannel(CANAL);
    (canal as unknown as { unref?: () => void }).unref?.();
    canal.onmessage = (e: MessageEvent) => {
      if ((e.data as { pregunta?: unknown } | null)?.pregunta === mio) canal.postMessage({ ocupada: mio });
    };
  }
  try {
    sessionStorage.setItem('epa:pestana', mio);
  } catch {
    // (kept for this page's life)
  }
  return mio;
}

/**
 * The key of this device's own record (the daily activity): the device id in Tauri (one window), and the device id with
 * this browser tab's id in a browser («<device>-<tab>»; `idPestana`). Two tabs of a browser never share a record:
 * while the storage refuses writes each tab's count lives only in its memory, and the synchronisation could only keep
 * one of two versions of a shared record (found by the randomized simulation: tests/motor-real/azar.ts).
 */
export async function idRegistro(): Promise<string> {
  const id = await idDispositivo();
  if (enTauri()) return id;
  pestana ??= idPestana();
  return `${id}-${await pestana}`;
}

/**
 * The id is about to be written in a record: stores it if it is new (once; if that fails it is tried again next time —
 * meanwhile this session keeps using it, and a later session's new id is summed alike).
 */
export function usarIdDispositivo(): void {
  if (!estado || guardando) return;
  void estado.then(async (e) => {
    if (e.guardado || guardando) return;
    guardando = true;
    try {
      // (another tab may have stored one meanwhile: keep that one for the next sessions, this one for this session)
      const a = await obtenerAlmacen();
      const v = await a.leer<{ id?: unknown }>(CLAVE_DISPOSITIVO);
      if (!(v && typeof v === 'object' && valido(v.id))) await a.escribir(CLAVE_DISPOSITIVO, { id: e.id });
      e.guardado = true;
    } catch {
      // (tried again at the next use)
    } finally {
      guardando = false;
    }
  });
}
