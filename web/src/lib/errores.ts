// Failed loads (0.11 QA, «sin red»): the cause in plain Spanish, and caches that forget a failure so that
// «Reintentar» really tries again.

/** The browser's own wording of a network failure («Failed to fetch», a chunk that did not arrive…). */
/** The message of a load that failed for lack of network, when the app throws it itself. */
export const SIN_RED = 'Sin conexión.';

const DE_RED = /^sin conexión|failed to fetch|networkerror|load failed|network request failed|err_internet|err_network|dynamically imported module|importing a module script failed|error loading dynamically|unable to preload/i;

/** The cause of a failed load for people: the app's own Spanish messages as they are, the browser's in Spanish. */
export function textoError(e: unknown): string {
  const m = e instanceof Error ? e.message : e == null ? '' : String(e);
  if (!m || DE_RED.test(m)) return 'Compruebe la conexión e inténtelo de nuevo.';
  return m;
}

/** A promise kept in a cache that drops it when it fails (the next call loads again). */
export function sinFallos<T>(p: Promise<T>, olvidar: () => void): Promise<T> {
  p.catch(olvidar);
  return p;
}

/** A failure of the network (or of a part of the app that did not arrive), not of the content itself. */
export function esDeRed(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e ?? '');
  return DE_RED.test(m);
}
