<script lang="ts">
  // Schematic «diodo» (esquema.ts): source, R on top, the diode down the right (anode up).
  import type { PropsDibujo } from '../dibujos';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d="M40 230 V50 H280 V230 Z" {dur} />
  <Pila x={40} y1={230} y2={50} />
  <Et x={2} y={170} t={c.val('fuente')} />
  <path class="hilo" d="M40 50 H110 M230 50 H280 M280 230 H40"></path>
  <R x1={110} y1={50} x2={230} y2={50} color="azul" />
  <Et x={170} y={30} t={c.rot('r')} ancla="middle" color="azul" />
  <D x1={280} y1={50} x2={280} y2={230} color="naranja" />
  <Et x={300} y={136} t={c.tiene('vd') ? c.val('vd') : 'Shockley'} color="naranja" peq />
</Lienzo>
