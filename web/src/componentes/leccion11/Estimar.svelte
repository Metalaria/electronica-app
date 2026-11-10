<script lang="ts">
  // 1.1 lessons: «estime» — a slider scored by closeness. Nothing counts until it is moved; after «Comprobar» it says
  // how far the estimate was (the value itself only once it is right, so trying again still makes sense).
  import MandoValor from '../teoria/MandoValor.svelte';
  import { formatoValor } from '../calculadoras/unidades';
  import { posicionMasCercana, posicionesEstimar, puntuarEstimacion } from '../../lib/leccion11/modelo';
  import { htmlDeTexto } from '../../lib/leccion11/texto';
  import type { Estimar } from '../../lib/leccion11/tipos';

  let {
    estimar,
    estimacion,
    objetivo,
    comprobado,
    resuelta,
    prefijo,
    mover,
  }: {
    estimar: Estimar;
    estimacion: number | null;
    objetivo: number;
    comprobado: boolean;
    resuelta: boolean;
    prefijo: string;
    mover: (x: number) => void;
  } = $props();

  const posiciones = $derived(posicionesEstimar(estimar));
  const actual = $derived(estimacion ?? estimar.inicio);
  const p = $derived(puntuarEstimacion(actual, objetivo, estimar.tol));
  const f = (v: number) => formatoValor(v, estimar.unidad, estimar.cifras, true);
  const desvio = $derived(`${formatoValor(p.error * 100, '%', 2, true)}`);
</script>

<div class="estimar" class:bloqueado={resuelta} data-estimar>
  <div class="mando">
    <MandoValor
      id={`${prefijo}-estimacion`}
      sim={htmlDeTexto(estimar.rotulo)}
      nombre=""
      unidad={estimar.unidad}
      valores={posiciones}
      pos={posicionMasCercana(posiciones, actual)}
      alMover={(k) => !resuelta && mover(posiciones[k]!)}
    />
  </div>
  {#if comprobado || resuelta}
    <p class="cerca" data-cerca={p.puntos}>
      {#if p.bien}
        Su estimación: {f(actual)}. El valor: {f(objetivo)}.
      {:else}
        Su estimación se desvía un {desvio}.
      {/if}
    </p>
  {:else if estimacion === null}
    <p class="ayuda">Mueva el deslizador hasta su estimación.</p>
  {/if}
</div>

<style>
  .estimar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: var(--v11-radio-tarjeta);
    background: var(--v11-panel);
  }
  .mando {
    --tinta: var(--v11-tinta);
    --tinta-suave: var(--v11-tinta-suave);
    --linea: var(--v11-linea);
    --superficie: var(--v11-fondo);
    --serif: var(--v11-texto);
    --sans: var(--v11-texto);
    --acento: var(--v11-azul);
  }
  .mando :global(.sim) {
    color: var(--v11-azul);
    font-style: normal;
    font-weight: 600;
  }
  .mando :global(.val) {
    font: 700 20px var(--v11-titular);
  }
  .mando :global(.pista:focus-visible) {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .cerca,
  .ayuda {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 14px;
  }
  .cerca {
    color: var(--v11-tinta);
    font-weight: 600;
  }
</style>
