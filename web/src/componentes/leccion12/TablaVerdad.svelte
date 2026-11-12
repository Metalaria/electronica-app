<script lang="ts">
  // 1.2 digital toolkit: a truth table. Shown under a logic circuit (`tabla: true`) with the row of the current inputs
  // marked; or filled by the reader on a «tabla» card: each output cell is a button that cycles «?», 0, 1 (rows marked
  // wrong after a check keep their mark until changed).
  import type { Nivel } from '../../lib/leccion12/digital/logica';
  import type { Texto } from '../../lib/leccion11/tipos';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let {
    entradas,
    salidas,
    filas,
    actual = -1,
    celdas,
    mal = [],
    bloqueado = false,
    poner,
  }: {
    entradas: string[];
    salidas: { id: string; rotulo: Texto }[];
    /** Inputs of each row, and the outputs when they are shown (null: hidden). */
    filas: { e: Nivel[]; s: Nivel[] | null }[];
    /** Row of the current inputs (−1: none). */
    actual?: number;
    /** Fill mode: the reader's cells. */
    celdas?: (Nivel | null)[][];
    mal?: number[];
    bloqueado?: boolean;
    poner?: (fila: number, col: number, v: Nivel) => void;
  } = $props();
  const valor = (id: string) => id;
</script>

<table class="d12-tabla" data-tabla-verdad>
  <caption class="a12-solo-lector">Tabla de verdad{celdas ? ': rellene las salidas' : ''}</caption>
  <thead>
    <tr>
      {#each entradas as x (x)}<th scope="col">{x}</th>{/each}
      {#each salidas as s (s.id)}<th scope="col" class="d12-sal"><TextoVivo texto={s.rotulo} {valor} /></th>{/each}
    </tr>
  </thead>
  <tbody>
    {#each filas as f, r (r)}
      <tr class:actual={r === actual} class:mal={mal.includes(r)} data-fila={r} data-actual={r === actual ? 'si' : undefined}>
        {#each f.e as v, k (k)}<td>{v}</td>{/each}
        {#each salidas as s, k (s.id)}
          <td class="d12-sal">
            {#if celdas && poner}
              {@const v = celdas[r]?.[k] ?? null}
              <button
                type="button"
                class="d12-celda"
                aria-label={`Fila ${entradas.map((x, j) => `${x} = ${f.e[j]}`).join(', ')}: ${s.id} ${v === null ? 'sin poner' : `= ${v}`}${mal.includes(r) ? ' (mal)' : ''}`}
                aria-disabled={bloqueado}
                onclick={() => !bloqueado && poner(r, k, v === 1 ? 0 : v === 0 ? 1 : 0)}
                data-celda={`${r}-${k}`}>{v === null ? '?' : v}</button
              >
            {:else}
              {f.s ? f.s[k] : '?'}
            {/if}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
