<script lang="ts">
  // Schematic «rlc-serie» (esquema.ts): the sine source on the left, R and L on top, C on the right.
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
  <Flujo d="M40 230 V50 H300 V230 Z" {dur} />
  <FuenteCA x={40} y1={230} y2={50} pieza="fuente" />
  <!-- (fix12: inside the loop, right of the source — at the left edge «5,03 kHz» ran over the source's wire) -->
  <Et x={64} y={110} t={c.val('fuente')} peq />
  <Et x={64} y={190} t={c.val('f')} peq />
  <path class="hilo" d="M40 50 H70 M175 50 H185 M290 50 H300 M300 230 H40"></path>
  <R x1={70} y1={50} x2={175} y2={50} color="azul" pieza="r" />
  <Et x={122} y={30} t={c.rot('r')} ancla="middle" color="azul" />
  <L x1={185} y1={50} x2={290} y2={50} color="naranja" pieza="l" />
  <Et x={237} y={30} t={c.rot('l')} ancla="middle" color="naranja" />
  <C x1={300} y1={50} x2={300} y2={230} color="verde" pieza="c" />
  <Et x={318} y={136} t={c.simT('c')} color="verde" />
  <Et x={318} y={156} t={c.val('c')} color="verde" peq />
</Lienzo>
