<script lang="ts">
  // Schematic «mixto» (esquema.ts): r1 on top, then r2 and r3 down to the bottom wire, side by side.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d="M40 230 V50 H300 V230 Z" {dur} />
  <Pila x={40} y1={230} y2={50} pieza="fuente" nodos={['0', 'fte']} />
  <Et x={2} y={170} t={c.val('fuente')} />
  <path class="hilo" d="M40 50 H60" data-red="fte"></path>
  <R x1={60} y1={50} x2={190} y2={50} color="azul" pieza="r1" />
  <Et x={125} y={30} t={c.rot('r1')} ancla="middle" color="azul" />
  <path class="hilo" d="M190 50 H300" data-red="b"></path>
  <circle class="nodo" cx="210" cy="50" r="4.5" data-red="b"></circle>
  <circle class="nodo" cx="210" cy="230" r="4.5" data-red="0"></circle>
  <R x1={210} y1={50} x2={210} y2={230} color="naranja" pieza="r2" />
  <Et x={224} y={136} t={c.simT('r2')} color="naranja" />
  <Et x={224} y={156} t={c.val('r2')} color="naranja" peq />
  <R x1={300} y1={50} x2={300} y2={230} color="verde" pieza="r3" />
  <Et x={314} y={136} t={c.simT('r3')} color="verde" />
  <Et x={314} y={156} t={c.val('r3')} color="verde" peq />
  <path class="hilo" d="M300 230 H40" data-red="0"></path>
</Lienzo>
