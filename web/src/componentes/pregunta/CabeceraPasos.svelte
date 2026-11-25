<script lang="ts">
  // Header of a lesson or a quiz (0.9; 2.1 as the approved mock-up Leccion.png): one continuous progress bar (the
  // segments touch; past 30 screens a single fill), «n / N», the close button at the end, and a line under it saying
  // where we are («Capítulo 5 · Diodos · 5.2 …»). No rule under it: air.
  import X from '@lucide/svelte/icons/x';

  let {
    total,
    actual,
    contexto,
    descripcion,
    cerrar,
    etiquetaCerrar = 'Cerrar',
  }: {
    total: number;
    /** 0-based index of the screen on show (total = finished). */
    actual: number;
    contexto: string;
    /** Spoken progress: «Paso 4 de 7». */
    descripcion: string;
    /** A route, or a function. */
    cerrar: string | (() => void);
    etiquetaCerrar?: string;
  } = $props();

  const n = $derived(Math.max(1, total));
  const segmentos = $derived(n <= 30);
</script>

<header class="cab-pasos">
  <div class="fila">
    <div class="barra" role="progressbar" aria-label={descripcion} aria-valuemin={0} aria-valuemax={n} aria-valuenow={Math.min(actual + 1, n)}>
      {#if segmentos}
        {#each { length: n } as _, i (i)}
          <span class="seg" class:hecho={i < actual} class:actual={i === actual}></span>
        {/each}
      {:else}
        <span class="continua" style:width={`${(Math.min(actual + 1, n) / n) * 100}%`}></span>
      {/if}
    </div>
    <span class="cuenta" aria-hidden="true">{Math.min(actual + 1, n)} / {n}</span>
    {#if typeof cerrar === 'string'}
      <a class="cerrar" href={cerrar} aria-label={etiquetaCerrar} title={etiquetaCerrar} data-cerrar><X size={22} strokeWidth={2.2} aria-hidden="true" /></a>
    {:else}
      <button type="button" class="cerrar" onclick={cerrar} aria-label={etiquetaCerrar} title={etiquetaCerrar} data-cerrar
        ><X size={22} strokeWidth={2.2} aria-hidden="true" /></button
      >
    {/if}
  </div>
  <span class="contexto">{contexto}</span>
</header>

<style>
  .cab-pasos {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: calc(680px + 2 * var(--pad-pie, 20px));
    margin: 0 auto;
    padding: max(20px, env(safe-area-inset-top)) var(--pad-pie, 20px) 8px;
    font-family: var(--v11-texto);
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .cerrar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-right: -10px;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--v11-tinta-suave);
  }
  .cerrar:hover {
    color: var(--v11-tinta);
  }
  .barra {
    display: flex;
    flex: 1;
    min-width: 0;
    height: 6px;
    overflow: hidden;
    border-radius: 3px;
    background: var(--v11-linea);
  }
  .seg {
    flex: 1;
    min-width: 2px;
    height: 100%;
    background: var(--v11-linea);
    transition: background 0.3s;
  }
  .seg.hecho,
  .seg.actual {
    background: var(--v11-azul);
  }
  .continua {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--v11-azul);
  }
  .cuenta {
    flex-shrink: 0;
    min-width: 52px;
    color: var(--v11-tinta-suave);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .contexto {
    color: var(--v11-tinta-suave);
    font-size: 15px;
    line-height: 1.4;
  }
  @media (prefers-reduced-motion: reduce) {
    .seg {
      transition: none;
    }
  }
</style>
