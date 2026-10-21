<script lang="ts">
  import type { BTabla } from '../lib/tipos';
  import { prepararHtml, textoPlano } from '../lib/datos';

  let { bloque, indice }: { bloque: BTabla; indice?: number } = $props();

  const cabecera = $derived(bloque.cabecera !== false && bloque.filas.length > 1 ? bloque.filas[0] : null);
  const cuerpo = $derived(cabecera ? bloque.filas.slice(1) : bloque.filas);
  const nombre = $derived(bloque.num ? `Tabla ${bloque.num}` : textoPlano(bloque.pie) || 'Tabla');

  function alinear(k: number): string {
    const a = bloque.align?.[k] ?? 'left';
    return a === 'right' || a === 'center' ? a : 'left';
  }
</script>

<figure class="tabla" id={bloque.label || undefined} data-b={indice}>
  {#if bloque.num || bloque.pie}
    <figcaption class="pie">
      {#if bloque.num}<span class="rot">Tabla {bloque.num} —</span>{/if}
      {@html prepararHtml(bloque.pie)}
    </figcaption>
  {/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="tabla-scroll" tabindex="0" role="region" aria-label={nombre}>
    <table>
      {#if cabecera}
        <thead>
          <tr>
            {#each cabecera as c, k (k)}<th scope="col" style:text-align={alinear(k)}>{@html prepararHtml(c)}</th>{/each}
          </tr>
        </thead>
      {/if}
      <tbody>
        {#each cuerpo as fila, j (j)}
          <tr>
            {#each fila as c, k (k)}<td style:text-align={alinear(k)}>{@html prepararHtml(c)}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</figure>
