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
  const rev = $derived(c.tiene('reves') && c.cerrado('reves'));
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d="M40 230 V50 H280 V230 Z" {dur} />
  <Pila x={40} y1={230} y2={50} pieza="fuente" nodos={['0', 'fte']} />
  <Et x={2} y={170} t={c.val('fuente')} />
  <path class="hilo" d="M40 50 H110" data-red="fte"></path>
  <path class="hilo" d="M230 50 H280" data-red="an"></path>
  <path class="hilo" d="M280 230 H40" data-red="0"></path>
  <R x1={110} y1={50} x2={230} y2={50} color="azul" pieza="r" />
  <Et x={170} y={30} t={c.rot('r')} ancla="middle" color="azul" />
  <!-- (esquemas12c: «reves» draws it the other way round; a tap on it turns it, like a switch) -->
  <D x1={280} y1={rev ? 230 : 50} x2={280} y2={rev ? 50 : 230} color="naranja" pieza={c.tiene('reves') ? 'reves' : undefined} />
  <Et x={300} y={136} t={c.tiene('vd') ? c.val('vd') : 'Shockley'} color="naranja" peq />
</Lienzo>
