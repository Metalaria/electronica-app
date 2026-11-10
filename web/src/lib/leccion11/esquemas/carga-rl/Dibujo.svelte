<script lang="ts">
  // Schematic «carga-rl» (esquema.ts): as carga-rc, with the coil on the right.
  import type { PropsDibujo } from '../dibujos';
  import Conmutador from '../kit/Conmutador.svelte';
  import Et from '../kit/Et.svelte';
  import L from '../kit/L.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={250}>
  <Pila x={40} y1={230} y2={50} />
  <Et x={2} y={170} t={c.val('fuente')} />
  <Conmutador carga={c.cerrado('interruptor')} />
  <R x1={150} y1={50} x2={270} y2={50} color="azul" />
  <Et x={210} y={30} t={c.rot('r')} ancla="middle" color="azul" />
  <path class="hilo" d="M270 50 H300 M300 230 H40"></path>
  <L x1={300} y1={50} x2={300} y2={230} color="naranja" />
  <Et x={318} y={136} t={c.simT('l')} color="naranja" />
  <Et x={318} y={156} t={c.val('l')} color="naranja" peq />
</Lienzo>
