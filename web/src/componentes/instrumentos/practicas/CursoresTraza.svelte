<script lang="ts">
  // The real FNIRSI's oscilloscope: cursors on the trace the panel draws, placed with four sliders (two in time, two
  // in voltage), and what they read: the time between the first pair and its inverse, the voltage between the second
  // pair in each channel's scale, and each trace's value under the time cursors. The lines themselves are drawn by
  // the panel, on its trace; this component is the controls and the figures.
  // They are the application's own (lib/fnirsi-real/cursores.ts): the instrument's cursors, on its own screen, are
  // neither used nor moved.
  import { leerCursores, type Cursores, type Ventana } from '../../../lib/fnirsi-real/cursores';
  import { formatoSI } from '../../grafica/formato';

  let {
    cursores = $bindable(),
    ventanas,
    ancho,
    minimo,
    maximo,
  }: {
    cursores: Cursores;
    /** The traces as drawn: the samples of each one's window. */
    ventanas: Ventana[];
    /** Samples across the drawing, and the sample values at its bottom and top edges. */
    ancho: number;
    minimo: number;
    maximo: number;
  } = $props();

  const l = $derived(cursores.activo && ventanas.length ? leerCursores(cursores, ventanas) : null);
</script>

<div class="cu" data-cursores-fnirsi>
  <label class="cu-activar"><input type="checkbox" bind:checked={cursores.activo} /> Cursores</label>
  {#if cursores.activo}
    <div class="cu-mandos">
      <label>Tiempo 1 <input type="range" min="0" max={ancho} step="1" bind:value={cursores.t1} data-cursor="t1" /></label>
      <label>Tiempo 2 <input type="range" min="0" max={ancho} step="1" bind:value={cursores.t2} data-cursor="t2" /></label>
      <label>Tensión 1 <input type="range" min={minimo} max={maximo} step="1" bind:value={cursores.v1} data-cursor="v1" /></label>
      <label>Tensión 2 <input type="range" min={minimo} max={maximo} step="1" bind:value={cursores.v2} data-cursor="v2" /></label>
    </div>
    {#if l}
      <p data-cursores-tiempo>De T1 a T2: {formatoSI(l.dt, 's', 4)} · su inverso: {l.frecuencia === null ? '—' : formatoSI(l.frecuencia, 'Hz', 4)}</p>
      {#each l.canales as x (x.canal)}
        <p data-cursores-canal={x.canal + 1}>
          CH{x.canal + 1}: de V1 a V2, {formatoSI(x.dv, 'V', 3)} · la traza vale {formatoSI(x.enT1, 'V', 3)} en T1 y {formatoSI(x.enT2, 'V', 3)} en T2
        </p>
      {/each}
      <p class="cu-nota">Son de la aplicación, sobre la traza que dibuja: los cursores del propio aparato no se usan ni se mueven.</p>
    {/if}
  {/if}
</div>

<style>
  .cu {
    margin-top: 6px;
    font-size: 12.5px;
  }
  .cu-activar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    cursor: pointer;
    color: var(--tinta-suave);
  }
  .cu-mandos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
    max-width: 420px;
  }
  .cu-mandos label {
    display: flex;
    flex-direction: column;
    color: var(--tinta-suave);
  }
  .cu-mandos input {
    width: 100%;
    min-height: 28px;
  }
  .cu p {
    margin: 4px 0;
  }
  .cu-nota {
    color: var(--tinta-tenue);
  }
  @media (pointer: coarse) {
    .cu-activar {
      min-height: 44px;
    }
    .cu-mandos input {
      min-height: 44px;
    }
  }
</style>
