<script lang="ts">
  // Schematic «rlc-paralelo» (esquema.ts): the sine source on the left, R_s on top, then L, C (and R) in parallel.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import L from '../kit/L.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d="M40 230 V50 H180 V230 Z" {dur} />
  <FuenteCA x={40} y1={230} y2={50} />
  <Et x={2} y={110} t={c.val('fuente')} peq />
  <Et x={2} y={190} t={c.val('f')} peq />
  {@const fin = c.tiene('r') ? 340 : 260}
  <path class="hilo" d={`M40 50 H60 M160 50 H${fin} M${fin} 230 H40`}></path>
  <R x1={60} y1={50} x2={160} y2={50} color="azul" />
  <Et x={110} y={30} t={c.rot('rs')} ancla="middle" color="azul" />
  <circle class="nodo" cx="180" cy="50" r="4.5"></circle>
  <circle class="nodo" cx="180" cy="230" r="4.5"></circle>
  <L x1={180} y1={50} x2={180} y2={230} color="naranja" />
  <Et x={192} y={128} t={c.simT('l')} color="naranja" />
  <Et x={192} y={148} t={c.val('l')} color="naranja" peq />
  <C x1={260} y1={50} x2={260} y2={230} color="verde" />
  <Et x={272} y={190} t={c.simT('c')} color="verde" />
  <Et x={272} y={210} t={c.val('c')} color="verde" peq />
  {#if c.tiene('r')}
    <R x1={340} y1={50} x2={340} y2={230} color="azul" />
    <Et x={330} y={44} t={c.rot('r')} color="azul" peq ancla="end" />
  {/if}
</Lienzo>
