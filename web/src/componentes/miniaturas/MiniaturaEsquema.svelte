<script lang="ts">
  // Thumbnail of a book netlist's automatic schematic (pre-rendered paths, see esquema-auto/miniatura.ts):
  // a fixed box (--mini-w × --mini-h, no layout shift) that asks for its chapter's file only when it is about
  // to be seen, then draws one inline SVG in the theme's colours. Neutral placeholder without a drawing.
  // `dibujo` passes the paths directly (a circuit drawn elsewhere, e.g. one of the reader's own circuits).
  import { untrack } from 'svelte';
  import type { TrazosMiniatura } from '../esquema-auto/miniatura';
  import { esquemaDe, esquemaYa } from './datos';
  import { visible } from './visible';
  import Hueco from './Hueco.svelte';

  let { id = null, dibujo = undefined }: { id?: string | null; dibujo?: TrazosMiniatura | null } = $props();

  let cargados = $state<TrazosMiniatura | null | undefined>(undefined);
  const trazos = $derived(dibujo !== undefined ? dibujo : cargados);
  let visto = false;

  // Already loaded (a list redrawn by a filter): drawn at once, without waiting to be seen again.
  $effect.pre(() => {
    const i = id;
    untrack(() => {
      cargados = i ? esquemaYa(i) : null;
      if (visto) cargar();
    });
  });

  function cargar() {
    if (!id || cargados !== undefined) return;
    const pedido = id;
    void esquemaDe(pedido).then((t) => {
      if (pedido === id) cargados = t;
    });
  }

  function alVer() {
    visto = true;
    cargar();
  }
</script>

<span class="mini mini-esquema" aria-hidden="true" data-miniatura="esquema" data-estado={trazos ? 'lista' : trazos === null ? 'hueco' : 'espera'} use:visible={alVer}>
  {#if trazos}
    <svg viewBox="0 0 {trazos[0]} {trazos[1]}" preserveAspectRatio="xMidYMid meet" focusable="false">
      <path class="c" d={trazos[2]} />
      {#if trazos[5]}<path class="b" d={trazos[5]} />{/if}
      <path class="l" d={trazos[3]} />
      {#if trazos[4]}<path class="t" d={trazos[4]} />{/if}
    </svg>
  {:else if trazos === null}
    <Hueco icono="esquema" />
  {/if}
</span>

<style>
  .mini {
    display: block;
    flex: none;
    box-sizing: border-box;
    width: var(--mini-w, 104px);
    height: var(--mini-h, 60px);
    padding: 4px 5px;
    border: 1px solid var(--linea-suave);
    border-radius: var(--mini-radio, 10px);
    background: var(--mini-fondo, var(--superficie));
    overflow: hidden;
    contain: strict;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .c,
  .l {
    fill: none;
    stroke: var(--titulos);
    stroke-width: var(--mini-trazo, 1.1px);
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .t {
    fill: var(--titulos);
  }
  .b {
    fill: var(--mini-fondo, var(--superficie));
  }
</style>
