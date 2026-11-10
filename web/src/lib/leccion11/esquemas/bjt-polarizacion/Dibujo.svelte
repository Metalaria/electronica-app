<script lang="ts">
  // Schematic «bjt-polarizacion» (esquema.ts): the divider R₁–R₂ on the left, the NPN, R_C up to the rail and R_E
  // down to ground, V_CC on the right.
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
  <Flujo d="M332 240 V20 H222 V240 Z" {dur} />
  <path class="hilo" d="M80 20 H332 M80 240 H332"></path>
  <R x1={80} y1={20} x2={80} y2={130} color="azul" />
  <R x1={80} y1={130} x2={80} y2={240} color="azul" />
  <Et x={8} y={70} t={c.simT('r1')} color="azul" />
  <Et x={8} y={88} t={c.val('r1')} color="azul" peq />
  <Et x={8} y={186} t={c.simT('r2')} color="azul" />
  <Et x={8} y={204} t={c.val('r2')} color="azul" peq />
  <circle class="nodo" cx="80" cy="130" r="4.5"></circle>
  <path class="hilo" d="M80 130 H176"></path>
  <Npn x={210} y={130} />
  <Et x={150} y={160} t={`β ${c.val('beta')}`} peq ancla="middle" />
  <R x1={222} y1={20} x2={222} y2={90} color="naranja" />
  <Et x={236} y={58} t={c.rot('rc')} color="naranja" peq />
  <R x1={222} y1={170} x2={222} y2={240} color="verde" />
  <Et x={236} y={210} t={c.rot('re')} color="verde" peq />
  <Pila x={332} y1={240} y2={20} />
  <Et x={346} y={150} t={c.val('vcc')} peq />
</Lienzo>
