// Deterministic «randomness» for the practice items: the same seed always gives the same values and the
// same order, so tests and the reader's second attempt are stable. Plain TypeScript.

/** 32-bit FNV-1a hash of a text. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: a small seeded generator of numbers in [0, 1). */
export function generador(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy (Fisher–Yates with the seeded generator). */
export function barajarCon<T>(xs: readonly T[], semilla: number): T[] {
  const r = generador(semilla);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A permutation of 0…n−1 that is never the identity (when n > 1): an order to put right. */
export function desorden(n: number, semilla: number): number[] {
  const base = Array.from({ length: n }, (_, k) => k);
  if (n < 2) return base;
  for (let s = 0; s < 20; s++) {
    const p = barajarCon(base, semilla + s * 7919);
    if (p.some((v, k) => v !== k)) return p;
  }
  return [...base.slice(1), 0];
}
