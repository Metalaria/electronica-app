<script lang="ts">
  // 1.2.1 (piloto121): the goal of an explore, surprise or tuning card (GUIA §13.3) — one chip per condition, live
  // (ticked when it holds), and while the goal is not reached the first advice whose condition holds on the model's
  // state. Reaching it completes the card (the shell latches it: lib/leccion11/motor.ts exploracionHecha).
  import { enRango, type Valores } from '../../lib/leccion11/modelo';
  import type { Tarjeta } from '../../lib/leccion11/tipos';
  import { consejoObjetivo } from '../../lib/leccion12/hacer/motor-hacer';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let { t, valores, logrado, valor }: { t: Tarjeta; valores: Valores; logrado: boolean; valor: (id: string) => string } = $props();
  const consejo = $derived(logrado ? undefined : consejoObjetivo(t, valores));
</script>

{#if t.objetivo}
  <div class="a12 objetivo" data-objetivo={logrado ? 'logrado' : 'pendiente'}>
    <span class="tit">{logrado ? '¡Conseguido!' : 'Objetivo'}</span>
    <div class="chips">
      {#each t.objetivo.condiciones as c, k (k)}
        {@const ok = enRango(c, valores)}
        <span class="chip" class:ok data-objetivo-condicion={k} data-cumple={ok ? 'si' : 'no'}><span class="marca" aria-hidden="true">{ok ? '✓' : '○'}</span><span class="solo-lector">{ok ? 'Cumple: ' : 'Todavía no: '}</span><TextoVivo texto={c.rotulo} {valor} /></span>
      {/each}
    </div>
    {#if consejo}<p class="consejo" aria-live="polite" data-consejo-objetivo><TextoVivo texto={consejo} {valor} /></p>{/if}
  </div>
{/if}

<style>
  .objetivo {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border: 2px dashed var(--v11-azul);
    border-radius: 14px;
  }
  .objetivo[data-objetivo='logrado'] {
    border-style: solid;
    border-color: var(--v11-bien);
    background: var(--v11-bien-tinte);
  }
  .tit {
    font: 700 13px var(--v11-texto);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--v11-tinta-suave);
  }
  .objetivo[data-objetivo='logrado'] .tit {
    color: var(--v11-bien-texto);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1.5px solid var(--v11-borde);
    border-radius: 999px;
    background: var(--v11-fondo);
    font-size: 14px;
    font-weight: 600;
  }
  .chip.ok {
    border-color: var(--v11-bien);
    color: var(--v11-bien-texto);
  }
  .consejo {
    margin: 0;
    font-size: 14px;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
