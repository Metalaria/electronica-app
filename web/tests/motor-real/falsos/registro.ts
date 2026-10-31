// Fake registro.svelte.ts: the stores of this device or tab, as the harness builds them (arnes.ts).
const d = new URL(import.meta.url).searchParams.get('d')!;
export type Valores = Record<string, unknown>;
export function sincronizables(): unknown[] {
  return (globalThis as unknown as { __stores(d: string): unknown[] }).__stores(d);
}
export function registrarSincronizable(): void {}
