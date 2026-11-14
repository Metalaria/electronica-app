<script lang="ts">
  // Schematic «espejo» (esquema.ts): Q1 on the left, mirrored so its base faces Q2, with collector and base joined
  // and R_ref up to the rail; Q2 on the right with the load up to the rail; the two bases joined; V_CC on the right.
  // The moving current is the widget's «corriente» along the reference branch.
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
  <Flujo d="M340 20 H108 V240 H340 Z" {dur} />
  <path class="hilo" d="M108 20 H340 M108 240 H340"></path>
  <R x1={108} y1={20} x2={108} y2={96} color="azul" pieza="rref" />
  <Et x={20} y={56} t={c.simT('rref')} color="azul" />
  <!-- (review 11c: 22 below the symbol, whose subscript hung into the value at 18) -->
  <Et x={20} y={78} t={c.val('rref')} color="azul" peq />
  <path class="hilo" d="M108 96 V110 M108 100 H150 V150 M150 150 H226 M108 190 V240 M272 190 V240"></path>
  <circle class="nodo" cx="108" cy="100" r="4.5"></circle>
  <circle class="nodo" cx="150" cy="150" r="4.5"></circle>
  <g transform="translate(240 0) scale(-1 1)"><Npn x={120} y={150} /></g>
  <Et x={70} y={154} t="Q₁" peq />
  <Npn x={260} y={150} />
  <Et x={292} y={170} t="Q₂" peq />
  <Et x={292} y={188} t={`β ${c.val('beta')}`} peq />
  {#if c.tiene('dvbe')}
    <Et x={188} y={140} t={`ΔV ${c.val('dvbe')}`} ancla="middle" peq />
  {/if}
  <R x1={272} y1={20} x2={272} y2={110} color="naranja" pieza="carga" />
  <!-- (review 11c: symbol and value on two lines; on one, «R_L 4,7 kΩ» ran over the V_CC wire at x = 340) -->
  <Et x={286} y={56} t={c.simT('carga')} color="naranja" />
  <Et x={286} y={78} t={c.val('carga')} color="naranja" peq />
  <Pila x={340} y1={240} y2={20} pieza="vcc" />
  <Et x={348} y={176} t={c.val('vcc')} peq />
</Lienzo>
