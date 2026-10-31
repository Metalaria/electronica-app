// Queue of the small celebrations shown over any page (0.11): «+10 XP», a new level, an achievement.
// App.svelte mounts componentes/progreso/Celebraciones.svelte (its own chunk) only once something is queued, so
// a session without awards never loads it. Nothing here runs on its own.

export type Aviso =
  | { id: number; tipo: 'xp'; xp: number }
  | { id: number; tipo: 'nivel'; nivel: number; nombre: string }
  | { id: number; tipo: 'logro'; logro: string };

type SinId<T> = T extends unknown ? Omit<T, 'id'> : never;

export const avisos = $state({
  lista: [] as Aviso[],
  /** Something was ever queued in this session (App.svelte mounts the toasts from then on). */
  usado: false,
});

let n = 0;

export function avisar(a: SinId<Aviso>): void {
  avisos.usado = true;
  avisos.lista = [...avisos.lista, { ...a, id: ++n } as Aviso];
  // never a long backlog: a burst of awards (e.g. a whole lesson reconciled) keeps the newest few
  if (avisos.lista.length > 12) avisos.lista = avisos.lista.slice(-12);
}

export function retirar(id: number): void {
  avisos.lista = avisos.lista.filter((a) => a.id !== id);
}
