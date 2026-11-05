// Fake lib/aprendizaje/eventos.ts (0.12): the learning events emitted by a device's modules (the daily progress's
// «objetivo-cumplido»), collected per graph in `globalThis.__eventos[<graph>]` instead of delivered to the consumers.
const d = new URL(import.meta.url).searchParams.get('d')!;
const g = globalThis as unknown as { __eventos?: Record<string, unknown[]> };
export function emitir(e: Record<string, unknown>): void {
  ((g.__eventos ??= {})[d] ??= []).push({ t: Date.now(), ...e });
}
export function escuchar(): () => void {
  return () => {};
}
