<script lang="ts">
  // Schematic «divisor» (esquema.ts): the approved mock-up's drawing, unchanged from the first 1.1 engine.
  import type { PropsDibujo } from '../dibujos';
  import EtiquetaRed from '../kit/EtiquetaRed.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  // (esquemas12c: the load's connection as a crossing, «union», or as a net label, «etiqueta»; otherwise as before)
  const modo = $derived(c.tiene('etiqueta') ? 'etiqueta' : c.tiene('union') ? 'union' : 'normal');
  const cargada = $derived(c.tiene('carga') && c.cerrado('interruptor') && c.cerrado('union') && c.cerrado('etiqueta'));
  const fantasma = $derived(c.tiene('carga') && !cargada);
  const Z1 = 'M190 30 V48 l9 3.5 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l9 3.5 V125';
  const Z2 = 'M190 125 V146 l9 3.5 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l9 3.5 V220';
  const ZL = 'M190 125 H300 V146 l9 3.5 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l9 3.5 V220 H190';
</script>

<Lienzo {descripcion}>
  <path class="flujo" d="M50 220 V30 H190 V220 Z" style:animation-duration={`${dur.toFixed(2)}s`} data-medidor="vmed"></path>
  <path class="hilo" d="M50 220 V133" data-red="0"></path>
  <path class="hilo" d="M50 117 V30 H190" data-red="fte"></path>
  <g data-pieza="fuente"><path class="hilo" d="M34 117 H66"></path>
  <path class="hilo gordo" d="M42 127 H58"></path></g>
  <text x="2" y="150" class="et tinta">{c.val('fuente')}</text>
  <path class="pieza azul" d={Z1} data-pieza="arriba"></path>
  <text x="208" y="82" class="et azul">{c.sim('arriba')} {c.val('arriba')}</text>
  <path class="pieza naranja" d={Z2} data-pieza="abajo"></path>
  <text x="208" y="190" class="et naranja">{c.sim('abajo')} {c.val('abajo')}</text>
  <path class="hilo" d="M190 220 H50" data-red="0"></path>
  {#if c.tiene('carga') && modo === 'union'}
    <!-- the output wire runs on past the load's lead: a crossing, joined only where the dot is -->
    <g data-pieza="union"><path class="hilo" d="M300 95 V125" data-red={cargada ? 'salida' : undefined}></path></g>
    <R x1={300} y1={125} x2={300} y2={220} color="verde" pieza="carga" />
    <path class="hilo" d="M300 220 H190" data-red="0"></path>
    <text x="316" y="172" class="et verde">{c.sim('carga')}</text>
    <text x="316" y="192" class="et verde peq">{c.val('carga')}</text>
    {#if cargada}<circle cx="300" cy="125" r="4.5" class="nodo" data-red="salida"></circle>{/if}
  {:else if c.tiene('carga') && modo === 'etiqueta'}
    <!-- the load on its own, under its own label -->
    <EtiquetaRed x={330} y={70} hacia="izquierda" texto={c.sim(c.tiene('etiqueta2') && !c.cerrado('etiqueta') ? 'etiqueta2' : 'etiqueta')} color="verde" pieza="etiqueta" />
    <path class="hilo" d="M330 70 V125" data-red={cargada ? 'salida' : undefined}></path>
    <R x1={330} y1={125} x2={330} y2={220} color="verde" pieza="carga" />
    <path class="hilo" d="M330 220 H190" data-red="0"></path>
    <text x="346" y="172" class="et verde">{c.sim('carga')}</text>
    <text x="346" y="192" class="et verde peq">{c.val('carga')}</text>
  {:else if c.tiene('carga')}
    <g class:fantasma data-carga={cargada ? 'conectada' : 'suelta'}>
      <path class="pieza verde" d={ZL} data-pieza="carga"></path>
      {#if cargada}
        <!-- (the ghost of a load not connected yet has no labels: faded text would be unreadable) -->
        <text x="316" y="172" class="et verde">{c.sim('carga')}</text>
        <text x="316" y="192" class="et verde peq">{c.val('carga')}</text>
      {/if}
    </g>
  {/if}
  {#if modo === 'union'}
    <path class="hilo" d="M190 125 H354" data-red="salida"></path>
    <circle cx="360" cy="125" r="6" class="salida"></circle>
    <text x="342" y="110" class="et naranja peq">salida</text>
  {:else if modo === 'etiqueta'}
    <path class="hilo" d="M190 125 H230" data-red="salida"></path>
    <EtiquetaRed x={230} y={125} texto={c.sim('etiqueta')} color="naranja" />
  {:else}
    <path class="hilo" d="M190 125 H244" data-red="salida"></path>
    <circle cx="250" cy="125" r="6" class="salida"></circle>
    <text x="232" y="110" class="et naranja peq">salida</text>
  {/if}
  <circle cx="190" cy="125" r="4.5" class="nodo" data-red="salida"></circle>
</Lienzo>
