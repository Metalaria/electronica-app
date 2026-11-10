<script lang="ts">
  // Schematic «resistencia» (esquema.ts): the source on the left, the resistor on the right, one loop.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d="M90 230 V50 H270 V230 Z" {dur} />
  <Pila x={90} y1={230} y2={50} />
  <Et x={20} y={150} t={c.val('fuente')} />
  <path class="hilo" d="M90 50 H270 M90 230 H270"></path>
  <R x1={270} y1={50} x2={270} y2={230} color="naranja" />
  <Et x={286} y={136} t={c.simT('r')} color="naranja" />
  <Et x={286} y={156} t={c.val('r')} color="naranja" peq />
</Lienzo>
