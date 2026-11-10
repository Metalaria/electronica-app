// Fake lib/datos.ts for the real-engine harness (hooks.mjs): what lecciones.svelte.ts uses of it (review 11a). The book
// itself (an import.meta.glob of Vite, fetched parts) is not part of these scenarios: only the store of the lessons.
export const cargarParte = (id: string): Promise<never> => Promise.reject(new Error(`sin libro: ${id}`));
export const infoParte = (_p: string): undefined => undefined;
export function obtenerIndice(): never {
  throw new Error('sin índice');
}
export const rotuloParte = (p: string): string => p;
export const textoPlano = (h: string): string => h.replace(/<[^>]+>/g, '');
