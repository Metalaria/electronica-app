<script lang="ts">
  // Schematic «divisor» (esquema.ts): the approved mock-up's drawing, unchanged from the first 1.1 engine.
  import type { PropsDibujo } from '../dibujos';
  import Lienzo from '../kit/Lienzo.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const cargada = $derived(c.tiene('carga') && c.cerrado('interruptor'));
  const fantasma = $derived(c.tiene('carga') && !cargada);
  const Z1 = 'M190 30 V48 l9 3.5 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l9 3.5 V125';
  const Z2 = 'M190 125 V146 l9 3.5 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l9 3.5 V220';
  const ZL = 'M190 125 H300 V146 l9 3.5 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l9 3.5 V220 H190';
</script>

<Lienzo {descripcion}>
  <path class="flujo" d="M50 220 V30 H190 V220 Z" style:animation-duration={`${dur.toFixed(2)}s`}></path>
  <path class="hilo" d="M50 220 V133"></path>
  <path class="hilo" d="M50 117 V30 H190"></path>
  <path class="hilo" d="M34 117 H66"></path>
  <path class="hilo gordo" d="M42 127 H58"></path>
  <text x="2" y="150" class="et tinta">{c.val('fuente')}</text>
  <path class="pieza azul" d={Z1}></path>
  <text x="208" y="82" class="et azul">{c.sim('arriba')} {c.val('arriba')}</text>
  <path class="pieza naranja" d={Z2}></path>
  <text x="208" y="190" class="et naranja">{c.sim('abajo')} {c.val('abajo')}</text>
  <path class="hilo" d="M190 220 H50"></path>
  {#if c.tiene('carga')}
    <g class:fantasma data-carga={cargada ? 'conectada' : 'suelta'}>
      <path class="pieza verde" d={ZL}></path>
      {#if cargada}
        <!-- (the ghost of a load not connected yet has no labels: faded text would be unreadable) -->
        <text x="316" y="172" class="et verde">{c.sim('carga')}</text>
        <text x="316" y="192" class="et verde peq">{c.val('carga')}</text>
      {/if}
    </g>
  {/if}
  <path class="hilo" d="M190 125 H244"></path>
  <circle cx="190" cy="125" r="4.5" class="nodo"></circle>
  <circle cx="250" cy="125" r="6" class="salida"></circle>
  <text x="232" y="110" class="et naranja peq">salida</text>
</Lienzo>
