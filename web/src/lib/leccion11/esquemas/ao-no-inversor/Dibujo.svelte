<script lang="ts">
  // Schematic «ao-no-inversor» (esquema.ts): the input source under the + input; the − input to the node N, R₁ from N
  // (to its left) down to ground, R₂ above from N to the output; without R₁ (the follower) a wire from the output back
  // to the − input. The optional load from the output to ground.
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import Entrada from '../kit/Entrada.svelte';
  import Et from '../kit/Et.svelte';
  import EtiquetasAO from '../kit/EtiquetasAO.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const seguidor = $derived(!c.tiene('r1'));
</script>

<Lienzo {descripcion} ancho={480} alto={260}>
  {#if !seguidor}
    <path class="flujo" d="M340 130 V40 H200 V110 H160 V240" style:animation-duration={`${dur.toFixed(2)}s`} data-medidor="vmi"></path>
  {/if}
  <Entrada {c} x={200} y1={240} y2={150} />
  <EtiquetasAO {c} x={222} y={196} />
  <path class="hilo" d="M200 150 H250" data-red="in"></path>
  <AO x={250} y={130} />
  {#if seguidor}
    <path class="hilo" d="M250 110 H200 V40 H340 V130 M310 130 H440" data-red="out"></path>
  {:else}
    <path class="hilo" d="M250 110 H160 M200 110 V40 H220" data-red="mn"></path>
    <circle class="nodo" cx="200" cy="110" r="4.5" data-red="mn"></circle>
    <R x1={160} y1={110} x2={160} y2={240} color="azul" pieza="r1" />
    <Et x={146} y={176} t={c.simT('r1')} ancla="end" color="azul" />
    <Et x={146} y={196} t={c.val('r1')} ancla="end" color="azul" peq />
    <R x1={220} y1={40} x2={320} y2={40} color="naranja" pieza="r2" />
    <Et x={270} y={22} t={c.rot('r2')} ancla="middle" color="naranja" />
    <path class="hilo" d="M320 40 H340 V130 M310 130 H440" data-red="out"></path>
  {/if}
  <circle class="nodo" cx="340" cy="130" r="4.5" data-red="out"></circle>
  <EtiquetasAO {c} x={300} y={196} ao />
  {#if c.tiene('carga')}
    <circle class="nodo" cx="410" cy="130" r="4.5" data-red="out"></circle>
    <R x1={410} y1={130} x2={410} y2={240} color="verde" pieza="carga" />
    <Et x={424} y={182} t={c.simT('carga')} color="verde" peq />
    <Et x={424} y={200} t={c.val('carga')} color="verde" peq />
  {/if}
  <circle class="borne" cx="440" cy="130" r="5"></circle>
  <Et x={440} y={114} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M160 240 H440" data-red="0"></path>
  <circle class="borne" cx="440" cy="240" r="5"></circle>
</Lienzo>
