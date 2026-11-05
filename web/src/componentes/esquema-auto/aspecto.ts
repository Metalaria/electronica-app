// Sheet shape of the automatic schematics for netlists with several circuits (wide on wide screens, squarer on phones
// in portrait). Shared by the layout (index.ts) and the reserved places of the drawings (figuras-vivas/circuito/
// proporciones.ts), which must pick the same precomputed size (scripts/circuitos-proporciones.mjs).
export const ASPECTOS = [1.1, 1.5, 2] as const;

export function aspectoPantalla(): number {
  if (typeof innerWidth === 'undefined') return 1.8;
  return innerWidth < 700 ? 1.1 : innerWidth < 1100 ? 1.5 : 2;
}
