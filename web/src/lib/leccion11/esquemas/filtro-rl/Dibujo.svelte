<script lang="ts">
  // Schematic «filtro-rl» (esquema.ts): the sine source on the left, R on top, L on the right.
  import type { PropsDibujo } from '../dibujos';
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
  <Et x={2} y={110} t={c.val('fuente')} peq />
  <Et x={2} y={190} t={c.val('f')} peq />
  <path class="hilo" d="M40 50 H130 M250 50 H300 M300 230 H40"></path>
  <R x1={130} y1={50} x2={250} y2={50} color="azul" pieza="r" />
  <Et x={190} y={30} t={c.rot('r')} ancla="middle" color="azul" />
  <L x1={300} y1={50} x2={300} y2={230} color="naranja" pieza="l" />
  <Et x={318} y={136} t={c.simT('l')} color="naranja" />
  <Et x={318} y={156} t={c.val('l')} color="naranja" peq />
</Lienzo>
