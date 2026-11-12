<script lang="ts">
  // Schematic «carga-rc» (esquema.ts): the source, the two-way switch (charge: to the source; discharge: to ground),
  // R on top and C on the right.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Conmutador from '../kit/Conmutador.svelte';
  import Et from '../kit/Et.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={250}>
  <Pila x={40} y1={230} y2={50} pieza="fuente" />
  <Et x={2} y={170} t={c.val('fuente')} />
  <Conmutador carga={c.cerrado('interruptor')} pieza="interruptor" />
  <R x1={150} y1={50} x2={270} y2={50} color="azul" pieza="r" />
  <Et x={210} y={30} t={c.rot('r')} ancla="middle" color="azul" />
  <path class="hilo" d="M270 50 H300 M300 230 H40"></path>
  <C x1={300} y1={50} x2={300} y2={230} color="naranja" pieza="c" />
  <Et x={318} y={136} t={c.simT('c')} color="naranja" />
  <Et x={318} y={156} t={c.val('c')} color="naranja" peq />
</Lienzo>
