<script lang="ts" module>
  export type ElementoLeyenda =
    | 'electron'
    | 'hueco'
    | 'ionD'
    | 'ionA'
    | 'corriente'
    | 'flujo'
    | 'campoE'
    | 'campoB'
    | 'foton'
    | 'calor'
    | 'recombinacion';
</script>

<script lang="ts">
  // Legend of the symbols used in the scene (same meaning in every animation).
  import { app } from '../../../lib/estado.svelte';
  import { paleta } from '../nucleo/paleta';

  let { elementos }: { elementos: ElementoLeyenda[] } = $props();
  const pal = $derived(paleta(app.tema));

  const TEXTOS: Record<ElementoLeyenda, string> = {
    electron: 'electrón libre',
    hueco: 'hueco',
    ionD: 'ion donador fijo (+)',
    ionA: 'ion aceptor fijo (−)',
    corriente: 'corriente convencional',
    flujo: 'movimiento de los electrones',
    campoE: 'campo eléctrico',
    campoB: 'campo magnético',
    foton: 'fotón',
    calor: 'calor',
    recombinacion: 'recombinación',
  };
</script>

<ul class="leyenda" aria-label="Leyenda">
  {#each elementos as e (e)}
    <li>
      <svg viewBox="0 0 28 16" width="28" height="16" aria-hidden="true">
        {#if e === 'electron'}
          <circle cx="14" cy="8" r="5" fill={pal.electron} /><circle cx="12.5" cy="6.4" r="1.6" fill="rgba(255,255,255,.6)" />
        {:else if e === 'hueco'}
          <circle cx="14" cy="8" r="4.6" fill="none" stroke={pal.hueco} stroke-width="2" />
        {:else if e === 'ionD' || e === 'ionA'}
          {@const c = e === 'ionD' ? pal.ionD : pal.ionA}
          <rect x="8.5" y="2.5" width="11" height="11" rx="2.6" fill="none" stroke={c} stroke-width="1.5" />
          <path d={e === 'ionD' ? 'M11 8h6M14 5v6' : 'M11 8h6'} stroke={c} stroke-width="1.7" />
        {:else if e === 'corriente'}
          <path d="M2 8h18" stroke={pal.corriente} stroke-width="2.4" /><path d="M26 8l-8-5v10z" fill={pal.corriente} />
        {:else if e === 'flujo'}
          <path d="M26 8H8" stroke={pal.flujo} stroke-width="2" stroke-dasharray="3 3" /><path d="M2 8l7-4.5v9z" fill={pal.flujo} />
        {:else if e === 'campoE'}
          <path d="M2 8h18" stroke={pal.campoE} stroke-width="1.8" /><path d="M26 8l-7-4v8z" fill={pal.campoE} />
        {:else if e === 'campoB'}
          <ellipse cx="14" cy="8" rx="11" ry="5.5" fill="none" stroke={pal.campoB} stroke-width="1.6" /><path d="M16 2.5l-4 0 3 -2.5" fill="none" stroke={pal.campoB} stroke-width="1.6" />
        {:else if e === 'foton'}
          <path d="M2 8q2-5 4 0t4 0 4 0 4 0" fill="none" stroke="#e6a800" stroke-width="1.8" /><path d="M26 8l-6-3.5v7z" fill="#e6a800" />
        {:else if e === 'calor'}
          <path d="M8 13q-3-3 0-5t0-6M14 13q-3-3 0-5t0-6M20 13q-3-3 0-5t0-6" fill="none" stroke={pal.calor} stroke-width="1.7" />
        {:else if e === 'recombinacion'}
          <circle cx="14" cy="8" r="6" fill={pal.corriente} opacity=".35" /><circle cx="14" cy="8" r="2.5" fill={pal.corriente} />
        {/if}
      </svg>
      {TEXTOS[e]}
    </li>
  {/each}
</ul>

<style>
  .leyenda {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
    color: var(--tinta-suave);
  }
  li {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
</style>
