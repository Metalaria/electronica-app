<script lang="ts">
  // «Ver en protoboard» under a book figure that has a real circuit behind it: the book's netlists that
  // check it (spice-refs.json, as «Simular»), or else a simulable schematic of its figure data
  // (datos/NAME.json, esquemas[].simulacion.simulable). Figures that are only drawings (block diagrams,
  // schematics without values or sources, plots without a netlist) get nothing. The figure data are
  // fetched only when the figure comes near the viewport (the same cache as the live figures).
  import { onMount } from 'svelte';
  import Breadboard from '@lucide/svelte/icons/grid-3x3';
  import type { BFigura } from '../../lib/tipos';
  import { spice, cargarIndiceSpice, cargarNetlist, rotuloRef } from '../../simulador/datos.svelte';
  import { abrirProtoboard } from '../../lib/protoboard.svelte';
  import { cargarDatos, cerca } from '../figuras-vivas/carga.svelte';

  let { bloque }: { bloque: BFigura } = $props();

  interface FiguraConDatos extends BFigura {
    tipo_figura?: string;
    datos?: string;
  }
  const f = $derived(bloque as FiguraConDatos);
  const label = $derived(bloque.label ?? '');
  const ids = $derived(label ? (spice.porRef[label] ?? []) : []);
  /** Simulable schematics of the figure (indices into esquemas[]). */
  let esquemas = $state<number[]>([]);
  let abierto = $state(false);
  let raiz: HTMLElement | undefined = $state();
  let ocupado = $state(false);

  onMount(() => {
    if (f.tipo_figura !== 'esquema' || !f.datos || !raiz) return;
    const ruta = f.datos;
    const dejar = cerca.observar(raiz, (dentro) => {
      if (!dentro) return;
      dejar();
      cargarDatos(ruta)
        .then((d) => {
          esquemas = (d.esquemas ?? []).map((e, i) => (e.simulacion?.simulable ? i : -1)).filter((i) => i >= 0);
        })
        .catch(() => {});
    });
    return dejar;
  });

  const titulo = $derived(rotuloRef(label) || (bloque.num ? `Figura ${bloque.num}` : 'Figura'));

  async function abrirNetlist(id: string) {
    abierto = false;
    ocupado = true;
    try {
      const idx = await cargarIndiceSpice();
      const n = idx?.netlists[id];
      if (!n) return;
      const texto = await cargarNetlist(n);
      abrirProtoboard({ tipo: 'netlist', texto, titulo: `${titulo}${n.titulo ? ` · ${n.titulo}` : ''}`, origen: { tipo: 'libro', id }, refs: n.refs });
    } finally {
      ocupado = false;
    }
  }

  function abrirEsquema(i: number) {
    abierto = false;
    abrirProtoboard({ tipo: 'figura', ruta: f.datos!, indice: i, titulo: esquemas.length > 1 ? `${titulo} · esquema ${esquemas.indexOf(i) + 1}` : titulo, label });
  }

  const opciones = $derived(
    ids.length
      ? ids.map((id) => ({ k: id, texto: id.split('/')[1]?.replace(/_/g, ' ') ?? id, abrir: () => abrirNetlist(id) }))
      : esquemas.map((i, k) => ({ k: String(i), texto: `Esquema ${k + 1}`, abrir: () => abrirEsquema(i) })),
  );
</script>

<span class="ver-protoboard" bind:this={raiz}>
  {#if opciones.length === 1}
    <button type="button" class="boton-pb" onclick={opciones[0]!.abrir} disabled={ocupado} title="Montar este circuito en una protoboard virtual">
      <Breadboard size={16} strokeWidth={2.2} /> Ver en protoboard
    </button>
  {:else if opciones.length > 1}
    <button type="button" class="boton-pb" aria-expanded={abierto} aria-haspopup="true" onclick={() => (abierto = !abierto)} disabled={ocupado}>
      <Breadboard size={16} strokeWidth={2.2} /> Ver en protoboard <span class="n">{opciones.length}</span>
    </button>
    {#if abierto}
      <ul class="menu">
        {#each opciones as o (o.k)}<li><button type="button" onclick={o.abrir}>{o.texto}</button></li>{/each}
      </ul>
    {/if}
  {/if}
</span>

<style>
  .ver-protoboard {
    position: relative;
    display: inline-block;
  }
  .boton-pb {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 32px;
    padding: 0 11px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 13.5px;
    font-weight: 600;
    white-space: nowrap;
    vertical-align: middle;
  }
  .boton-pb:hover {
    background: var(--acento-tinte);
  }
  .n {
    min-width: 1.4em;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--acento-suave);
    font-size: 11.5px;
    text-align: center;
  }
  /* Upwards: over its own figure (the next block of the reader paints above anything that overflows down). */
  .menu {
    position: absolute;
    z-index: 15;
    bottom: calc(100% + 4px);
    right: 0;
    min-width: 16em;
    max-width: min(26em, 86vw);
    margin: 0;
    padding: 4px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    list-style: none;
  }
  .menu button {
    display: block;
    width: 100%;
    min-height: 40px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta);
    font: 14px var(--sans);
    text-align: left;
  }
  .menu button:hover {
    background: var(--hover);
  }
</style>
