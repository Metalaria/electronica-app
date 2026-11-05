// The loop guard of guardado.ts (`Guardado.enTregua`, review 0.12b, finding 1): plain constants, in their own module so
// the browser tests can wait on them without importing the storage modules.

/** More retentions of one item than this within RETENCIONES_MS start a truce. */
export const RETENCIONES_MAX = 8;
export const RETENCIONES_MS = 5_000;
/** How long a truce lasts. */
export const TREGUA_MS = 10_000;
/**
 * During a truce, a kept change is written back after this long (once per wait), not at once: a loop is slowed to one
 * write per RETRASO_TREGUA per tab. Long enough that a tab that keeps writing a stale copy back is not answered at once
 * (`tests/revision12c-pestanas.spec.ts` 12c·1 waits 1,5 s for an answer); a burst of real writes ends with at most this
 * one repair write per tab (12b·1 opens its quiet window after it). 3 s (0.12c): 2 s in 0.12d was a change made to fit a
 * test, not a fix (review 0.12e, point 4).
 */
export const RETRASO_TREGUA = 3_000;
