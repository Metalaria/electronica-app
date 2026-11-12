// 1.2 step types: seeded randomness, so every numeric check is the same on every device and in the tests (the
// Monte Carlo boards of a design challenge, a fault «al azar»). Pure.

/** FNV-1a hash of a text (a card's id → its seed). */
export function semillaDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** mulberry32: a small, fast generator of numbers in [0, 1) from a 32-bit seed. */
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

/**
 * A fresh seed for what must change from one attempt to the next (the fault of an «averia» card with
 * `eleccion: azar`); the tests pass their own seed to the functions that take one, so their checks stay fixed.
 */
export function semillaNueva(): number {
  try {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}
