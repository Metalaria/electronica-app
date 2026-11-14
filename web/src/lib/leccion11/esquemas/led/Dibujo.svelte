<script lang="ts">
  // Schematic «led» (esquema.ts): source, R on top, the LED down the right; it glows as its current over 20 mA (the
  // widget's «corriente»).
  import type { PropsDibujo } from '../dibujos';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  import EtiquetaRed from '../kit/EtiquetaRed.svelte';
  let { c, widget, dur, descripcion }: PropsDibujo = $props();
  const rev = $derived(c.tiene('reves') && c.cerrado('reves'));
  const brillo = $derived(widget.corriente && !c.oculto ? Math.max(0, c.n(widget.corriente)) / 0.02 : 0.5);
  // (esquemas12d: the feed by net labels — the source's wire ends in one, R and the LED hang from another, apart)
  const etq = $derived(c.tiene('etiqueta'));
  const unida = $derived(!etq || c.cerrado('etiqueta'));
  // where R starts: after the second label in that mode
  const xr = $derived(etq ? 176 : 110);
</script>

<Lienzo {descripcion} alto={250}>
  {#if etq}
    <!-- (two stretches: the current «jumps» from one label to the other, nothing is drawn in between) -->
    <Flujo d="M40 230 V50 H62" {dur} />
    <Flujo d="M176 50 H280 V230 H40" {dur} />
  {:else}
    <Flujo d="M40 230 V50 H280 V230 Z" {dur} />
  {/if}
  <Pila x={40} y1={230} y2={50} pieza="fuente" nodos={['0', 'fte']} />
  <Et x={2} y={170} t={c.val('fuente')} />
  {#if etq}
    <path class="hilo" d="M40 50 H62" data-red="fte"></path>
    <EtiquetaRed x={62} y={50} texto={c.sim('etiqueta')} color="verde" />
    <EtiquetaRed x={176} y={50} hacia="derecha" texto={c.sim(c.tiene('etiqueta2') && !unida ? 'etiqueta2' : 'etiqueta')} color="verde" pieza="etiqueta" />
  {:else}
    <path class="hilo" d="M40 50 H110" data-red="fte"></path>
  {/if}
  <path class="hilo" d="M230 50 H280" data-red="an"></path>
  <path class="hilo" d="M280 230 H40" data-red="0"></path>
  <R x1={xr} y1={50} x2={230} y2={50} color="azul" pieza="r" />
  <Et x={(xr + 230) / 2} y={30} t={c.rot('r')} ancla="middle" color="azul" />
  <!-- (esquemas12c: «reves» draws it the other way round; a tap on it turns it, like a switch) -->
  <D x1={280} y1={rev ? 230 : 50} x2={280} y2={rev ? 50 : 230} color="naranja" variante="led" {brillo} pieza={c.tiene('reves') ? 'reves' : undefined} />
  <Et x={318} y={136} t="LED" color="naranja" />
  {#if c.tiene('vf')}<Et x={318} y={156} t={c.val('vf')} color="naranja" peq />{/if}
</Lienzo>
