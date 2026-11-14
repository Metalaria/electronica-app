<script lang="ts">
  // Schematic «ao-inversor» (esquema.ts): the input source on the left, R₁ along the top to the − input (the node N),
  // R₂ above from N to the output, the + input down to ground, the optional load from the output to ground.
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import Entrada from '../kit/Entrada.svelte';
  import Et from '../kit/Et.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  import EtiquetasAO from '../kit/EtiquetasAO.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} ancho={480} alto={260}>
  <path class="flujo" d="M40 240 V110 H200 V40 H340 V130" style:animation-duration={`${dur.toFixed(2)}s`} data-medidor="vmi"></path>
  <Entrada {c} x={40} y1={240} y2={110} />
  <EtiquetasAO {c} x={64} y={170} />
  <path class="hilo" d="M40 110 H70" data-red="in"></path>
  <R x1={70} y1={110} x2={160} y2={110} color="azul" pieza="r1" />
  <Et x={115} y={92} t={c.rot('r1')} ancla="middle" color="azul" />
  <path class="hilo" d="M160 110 H250 M200 110 V40 H220" data-red="mn"></path>
  <circle class="nodo" cx="200" cy="110" r="4.5" data-red="mn"></circle>
  <R x1={220} y1={40} x2={320} y2={40} color="naranja" pieza="r2" />
  <Et x={270} y={22} t={c.rot('r2')} ancla="middle" color="naranja" />
  <path class="hilo" d="M320 40 H340 V130 M310 130 H440" data-red="out"></path>
  <circle class="nodo" cx="340" cy="130" r="4.5" data-red="out"></circle>
  <AO x={250} y={130} />
  <path class="hilo" d="M250 150 H230 V240" data-red="0"></path>
  <EtiquetasAO {c} x={262} y={190} ao />
  {#if c.tiene('carga')}
    <circle class="nodo" cx="410" cy="130" r="4.5" data-red="out"></circle>
    <R x1={410} y1={130} x2={410} y2={240} color="verde" pieza="carga" />
    <Et x={424} y={182} t={c.simT('carga')} color="verde" peq />
    <Et x={424} y={200} t={c.val('carga')} color="verde" peq />
  {/if}
  <circle class="borne" cx="440" cy="130" r="5"></circle>
  <Et x={440} y={114} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M40 240 H440" data-red="0"></path>
  <circle class="borne" cx="440" cy="240" r="5"></circle>
</Lienzo>
