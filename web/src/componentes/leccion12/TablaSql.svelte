<script lang="ts">
  // 1.2 SQL sandbox: a query's result as a table (columns as headers, numbers right-aligned in Spanish style), in its
  // own scrollable box (keyboard-scrollable: it takes the focus) so a wide result never scrolls the page sideways.
  import type { ResultadoSql } from '../../lib/leccion12/tipos';

  let { resultado, total }: { resultado: ResultadoSql; total: number } = $props();
  const n = (x: number) => (Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(10)))).replace('.', ',').replace('-', '−');
</script>

{#if !resultado.columnas.length}
  <p class="a12-suave" data-filas="0">La orden se ha ejecutado y no devuelve filas.</p>
{:else}
  <!-- (a scrollable region must take the keyboard focus to be scrolled without a mouse: WCAG 2.1.1) -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="caja" tabindex="0" role="region" aria-label={`Resultado: ${total} ${total === 1 ? 'fila' : 'filas'}`} data-filas={total}>
    <table>
      <caption>{total} {total === 1 ? 'fila' : 'filas'}{total > resultado.filas.length ? ` (se ven las ${resultado.filas.length} primeras)` : ''}</caption>
      <thead><tr>{#each resultado.columnas as c, k (k)}<th scope="col">{c}</th>{/each}</tr></thead>
      <tbody>
        {#each resultado.filas as f, i (i)}
          <tr>{#each f as x, k (k)}<td class:num={typeof x === 'number'}>{x == null ? 'NULL' : typeof x === 'number' ? n(x) : x}</td>{/each}</tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .caja {
    max-height: 320px;
    overflow: auto;
    border: 1.5px solid var(--v11-linea);
    border-radius: 10px;
    background: var(--v11-fondo);
  }
  table {
    border-collapse: collapse;
    font: 500 14px var(--v11-mono);
    font-variant-numeric: tabular-nums;
  }
  caption {
    padding: 6px 10px;
    color: var(--v11-tinta-suave);
    font-family: var(--v11-texto);
    text-align: left;
  }
  th,
  td {
    padding: 5px 10px;
    border-top: 1px solid var(--v11-linea);
    white-space: nowrap;
    text-align: left;
  }
  th {
    position: sticky;
    top: 0;
    background: var(--v11-panel);
  }
  td.num {
    text-align: right;
  }
</style>
