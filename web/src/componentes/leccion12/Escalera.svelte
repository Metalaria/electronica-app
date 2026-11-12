<script lang="ts">
  // 1.2 hint ladder of an answered card: «Pista» opens the first hint, then the second, then the solution, one step
  // at a time, and they stay on show. The steps opened count as help in the answer's learning event
  // (lib/leccion11/motor.ts eventoDeComprobacion), as the 1.1 «ayuda» after two failed checks did.
  import './actividades12.css';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Tarjeta, Texto } from '../../lib/leccion11/tipos';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let { t, e, valor, cambiar }: { t: Tarjeta; e: EstadoTarjeta; valor: (id: string) => string; cambiar: (c: Partial<EstadoTarjeta>) => void } = $props();

  const pasos = $derived([...(t.escalera ?? []).map((x, k): [string, Texto] => [`Pista ${k + 1}`, x]), ...(t.solucion ? [['Solución', t.solucion] as [string, Texto]] : [])]);
  const vistas = $derived(Math.min(e.pistasVistas ?? 0, pasos.length));
  const siguiente = $derived(pasos[vistas]?.[0]);
</script>

{#if pasos.length && !(e.resuelta && vistas === 0)}
  <div class="escalera" data-escalera={vistas}>
    {#if vistas}
      <ol class="vistas" aria-live="polite">
        {#each pasos.slice(0, vistas) as [rotulo, x], k (k)}
          <li class:solucion={rotulo === 'Solución'}><strong>{rotulo}.</strong> <TextoVivo texto={x} {valor} /></li>
        {/each}
      </ol>
    {/if}
    {#if siguiente && !e.resuelta}
      <button type="button" class="a12-boton pedir" onclick={() => cambiar({ pistasVistas: vistas + 1 })} data-pedir-pista>
        {siguiente === 'Solución' ? 'Ver la solución' : vistas ? 'Otra pista' : 'Pista'}
      </button>
    {/if}
  </div>
{/if}

<style>
  .escalera {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .vistas {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 14px;
    line-height: 1.45;
  }
  .vistas li {
    padding: 8px 12px;
    border-left: 4px solid var(--v11-azul);
    border-radius: 8px;
    background: var(--v11-azul-tinte);
  }
  .vistas li.solucion {
    border-left-color: var(--v11-naranja);
    background: var(--v11-panel);
  }
  .pedir:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
</style>
