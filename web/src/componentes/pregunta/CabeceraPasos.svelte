<script lang="ts">
  // Header of a lesson or a quiz (0.9 mockups): close button, segmented progress bar with «n/N» and a line
  // saying where we are («Capítulo 5 · Diodos · 5.2 …»). Segments: done in the block colour, the current one
  // in amber, the rest in the line colour; past 30 screens the bar is continuous.
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
    {#if typeof cerrar === 'string'}
      <a class="cerrar" href={cerrar} aria-label={etiquetaCerrar} title={etiquetaCerrar} data-cerrar><X size={22} strokeWidth={2.2} aria-hidden="true" /></a>
    {:else}
      <button type="button" class="cerrar" onclick={cerrar} aria-label={etiquetaCerrar} title={etiquetaCerrar} data-cerrar
        ><X size={22} strokeWidth={2.2} aria-hidden="true" /></button
      >
    {/if}
    <div class="barra" role="progressbar" aria-label={descripcion} aria-valuemin={0} aria-valuemax={n} aria-valuenow={Math.min(actual + 1, n)}>
      {#if segmentos}
        {#each { length: n } as _, i (i)}
          <span class="seg" class:hecho={i < actual} class:actual={i === actual}></span>
        {/each}
      {:else}
        <span class="continua"><span style:width={`${(Math.min(actual + 1, n) / n) * 100}%`}></span></span>
      {/if}
    </div>
    <span class="cuenta" aria-hidden="true">{Math.min(actual + 1, n)}/{n}</span>
  </div>
  <span class="contexto">{contexto}</span>
</header>

<style>
  .cab-pasos {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: max(12px, env(safe-area-inset-top)) var(--pad-pie, 16px) 14px;
    border-bottom: 1px solid var(--linea);
    font-family: var(--sans);
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .cerrar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-left: -6px;
    padding: 0;
    border: 0;
    border-radius: 22px;
    background: transparent;
    color: var(--tinta-suave);
  }
  .cerrar:hover {
    background: var(--hover);
    color: var(--tinta);
  }
  .barra {
    display: flex;
    flex: 1;
    gap: 5px;
    min-width: 0;
  }
  .seg {
    flex: 1;
    min-width: 3px;
    height: 8px;
    border-radius: 4px;
    background: var(--linea);
    transition: background 0.2s;
  }
  .seg.hecho {
    background: var(--bloque, var(--titulos));
  }
  .seg.actual {
    background: var(--ambar-relleno, #d9921c);
  }
  .continua {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: var(--linea);
    overflow: hidden;
  }
  .continua span {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: var(--bloque, var(--titulos));
  }
  .cuenta {
    flex-shrink: 0;
    color: var(--tinta-suave);
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .contexto {
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.35;
  }
</style>
