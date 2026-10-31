// The consumers of the learning events (eventos.ts loads this chunk on the first event and replays what was
// emitted meanwhile). Each one is registered once with registrarConsumidor and receives every event, in order.
//
// 0.11: XP, levels and achievements (progreso.svelte.ts); group B: mastery per concept (dominio.svelte.ts: every
// `respuesta` folded into rounds per item). Smart practice and the problem of the day only emit events.

import { registrarConsumidor } from './eventos';
import { consumirEvento } from './progreso.svelte';
import { consumirDominio } from './dominio.svelte';

let instalado = false;

export function instalar(): void {
  if (instalado) return;
  instalado = true;
  registrarConsumidor(consumirEvento);
  registrarConsumidor(consumirDominio);
}
