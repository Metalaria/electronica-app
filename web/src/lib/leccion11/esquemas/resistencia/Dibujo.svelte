<script lang="ts">
  // Schematic «resistencia» (esquema.ts): the source on the left, the resistor on the right, one loop.
  import type { PropsDibujo } from '../dibujos';
  import Punto from '../kit/Punto.svelte';
  import Rama from '../kit/Rama.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d="M90 230 V50 H270 V230 Z" {dur} />
  <Pila x={90} y1={230} y2={50} pieza="fuente" nodos={['0', 'fte']} />
  <Et x={20} y={150} t={c.val('fuente')} />
  <path class="hilo" d="M90 50 H270" data-red="fte"></path>
  <path class="hilo" d="M90 230 H270" data-red="0"></path>
  <R x1={270} y1={50} x2={270} y2={230} color="naranja" pieza="r" />
  <Et x={286} y={136} t={c.simT('r')} color="naranja" />
  <Et x={286} y={156} t={c.val('r')} color="naranja" peq />
  <!-- (1.2.1: where the probes touch each node and the ammeter opens each branch) -->
  <Punto x={180} y={50} red="fte" />
  <Punto x={180} y={230} red="0" />
  <Rama x={180} y={50} medidor="vmed" />
</Lienzo>
