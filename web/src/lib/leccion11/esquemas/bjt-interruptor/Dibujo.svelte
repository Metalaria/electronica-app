<script lang="ts">
  // Schematic «bjt-interruptor» (esquema.ts): the drive source and R_B on the left, the NPN in the middle, R_C up to
  // the V_CC rail, the emitter to ground.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Npn from '../kit/Npn.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={260}>
  <Flujo d="M332 240 V30 H222 V140 L222 240 Z" {dur} />
  <Pila x={40} y1={240} y2={140} pieza="entrada" />
  <Et x={2} y={128} t={c.val('entrada')} />
  <path class="hilo" d="M40 140 H70 M160 140 H176"></path>
  <R x1={70} y1={140} x2={160} y2={140} color="azul" pieza="rb" />
  <Et x={115} y={120} t={c.rot('rb')} ancla="middle" color="azul" peq />
  <Npn x={210} y={140} />
  <Et x={240} y={150} t={`β ${c.val('beta')}`} peq />
  <R x1={222} y1={30} x2={222} y2={100} color="naranja" pieza="rc" />
  <Et x={236} y={64} t={c.rot('rc')} color="naranja" peq />
  <path class="hilo" d="M222 30 H332 M222 180 V240 H40 M332 240 H222"></path>
  <Pila x={332} y1={240} y2={30} pieza="vcc" />
  <Et x={346} y={150} t={c.val('vcc')} peq />
</Lienzo>
