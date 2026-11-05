// The day's review counts (repaso-diario, componentes/repaso/estado.svelte.ts): the merge of two versions of a day.
// Plain module (no runes): the tests import it in Node.

/**
 * A day's review counts as stored: what was answered (`r` answers, `n` new cards, `b` answers other than «Otra vez»),
 * only ever growing, and — since 0.12d — what of it was undone («Deshacer»: `dr`, `dn`, `db`, also only growing,
 * absent while 0). The day's real counts are the difference (`efectivo`).
 *
 * Why (review 0.12d, finding 2): an undo used to LOWER r/n/b; with the larger value per field kept in the file (0.12c),
 * the higher count already sent came back and the undone answer was counted again on every device. Counters that only
 * grow make the larger value exact for what one device did: an undo raises its own counter instead.
 *
 * 0.10/0.11 read r/n/b only: they show the answers including the undone ones (at worst a few more answers and new cards
 * that day; their new-card limit is then stricter, never looser), they keep `dr`/`dn`/`db` when they change the day
 * (they change the stored object in place, and an undo there restores a copy of it), and the merged version they
 * receive is dated after both, so nothing goes back and forth. Their own undo still lowers r/n/b: against a 0.12
 * device's larger value it is lost (the answer stays counted), as with any concurrent change of the day.
 */
export interface CuentasRepaso {
  r: number;
  n: number;
  b: number;
  dr?: number;
  dn?: number;
  db?: number;
}

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);

/** The day's real counts: answered minus undone (never below 0). */
export function efectivo(d: CuentasRepaso | undefined): { r: number; n: number; b: number } {
  if (!d) return { r: 0, n: 0, b: 0 };
  return { r: Math.max(0, num(d.r) - num(d.dr)), n: Math.max(0, num(d.n) - num(d.dn)), b: Math.max(0, num(d.b) - num(d.db)) };
}

/**
 * Two versions of a day's review counts (two devices, two tabs, review 0.12c finding 5): the larger value of each
 * field (of the undo counters too). Before, the newer version won whole and the other's answers and new cards were lost. A sum is not possible:
 * the item is one shared counter (no record per device — a 0.10/0.11 device reads every key as a day, so records like
 * the daily activity's would count as days of its streak), and with no common ancestor known a sum counts twice what
 * both versions already include. The larger value never counts anything twice (it can count short when two devices
 * answered the same day, and an undo made on one device after the other already counted that answer stays counted);
 * it is commutative, associative and idempotent, so every device reaches the same value (fusion.ts
 * fusionarColecciones), and a 0.10/0.11 device just takes the merged version, dated after both: no back and forth.
 */
export function unirDiasRepaso<D extends CuentasRepaso>(a: D, b: D): D {
  const r = { ...a, ...b, r: Math.max(num(a.r), num(b.r)), n: Math.max(num(a.n), num(b.n)), b: Math.max(num(a.b), num(b.b)) } as D;
  // (the undo counters, also the larger value; absent while 0, as a 0.10/0.11 device writes the day)
  for (const k of ['dr', 'dn', 'db'] as const) {
    const x = Math.max(num(a[k]), num(b[k]));
    if (x) r[k] = x;
    else delete r[k];
  }
  return r;
}

