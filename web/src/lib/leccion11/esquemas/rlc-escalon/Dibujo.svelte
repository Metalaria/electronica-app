<script lang="ts">
  // Schematic «rlc-escalon» (esquema.ts): the source, the two-way switch of carga-rc (to the source, or to the wire
  // down to ground), R and L on top, C on the right.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Conmutador from '../kit/Conmutador.svelte';
  import Et from '../kit/Et.svelte';
  import L from '../kit/L.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} ancho={400} alto={250}>
  <Pila x={40} y1={230} y2={50} pieza="fuente" nodos={['0', 'fte']} />
  <Et x={2} y={170} t={c.val('fuente')} />
  <Conmutador carga={c.cerrado('interruptor')} pieza="interruptor" />
  <R x1={150} y1={50} x2={228} y2={50} color="azul" pieza="r" />
  <Et x={189} y={30} t={c.rot('r')} ancla="middle" color="azul" />
  <path class="hilo" d="M228 50 H238"></path>
  <L x1={238} y1={50} x2={330} y2={50} color="naranja" pieza="l" />
  <Et x={284} y={30} t={c.rot('l')} ancla="middle" color="naranja" />
  <path class="hilo" d="M330 50 H350 M350 230 H40"></path>
  <C x1={350} y1={50} x2={350} y2={230} color="verde" pieza="c" />
  <Et x={334} y={136} t={c.simT('c')} color="verde" ancla="end" />
  <Et x={334} y={156} t={c.val('c')} color="verde" peq ancla="end" />
</Lienzo>
