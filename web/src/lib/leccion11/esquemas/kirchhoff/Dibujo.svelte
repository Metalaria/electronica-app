<script lang="ts">
  // Schematic «kirchhoff» (esquema.ts): source 1 on the left, source 2 on the right, the load in the middle. A source
  // switched off is drawn as the short circuit that replaces it (its battery faded).
  import type { PropsDibujo } from '../dibujos';
  import Punto from '../kit/Punto.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  import Rama from '../kit/Rama.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const on1 = $derived(c.cerrado('activa1'));
  const on2 = $derived(c.cerrado('activa2'));
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d="M40 230 V50 H190 V230 Z" {dur} medidor="vm1" />
  <Flujo d="M340 230 V50 H190 V230 Z" {dur} medidor="vm2" />
  {#if on1}<Pila x={40} y1={230} y2={50} pieza="fuente1" nodos={['0', 'f1']} />{:else}<g class="fantasma"><Pila x={40} y1={230} y2={50} pieza="fuente1" /></g><path class="hilo" d="M40 230 V50"></path>{/if}
  {#if on2}<Pila x={340} y1={230} y2={50} pieza="fuente2" nodos={['0', 'f2']} />{:else}<g class="fantasma"><Pila x={340} y1={230} y2={50} pieza="fuente2" /></g><path class="hilo" d="M340 230 V50"></path>{/if}
  <Et x={2} y={170} t={on1 ? c.val('fuente1') : '0 V'} />
  <Et x={326} y={170} t={on2 ? c.val('fuente2') : '0 V'} ancla="end" />
  <path class="hilo" d="M40 50 H55" data-red="f1"></path>
  <path class="hilo" d="M325 50 H340" data-red="f2"></path>
  <R x1={55} y1={50} x2={175} y2={50} color="azul" pieza="r1" />
  <Et x={115} y={30} t={c.rot('r1')} ancla="middle" color="azul" />
  <path class="hilo" d="M175 50 H205" data-red="n"></path>
  <R x1={205} y1={50} x2={325} y2={50} color="naranja" pieza="r2" />
  <Et x={265} y={30} t={c.rot('r2')} ancla="middle" color="naranja" />
  <circle class="nodo" cx="190" cy="50" r="4.5" data-red="n"></circle>
  <R x1={190} y1={50} x2={190} y2={230} color="verde" pieza="r3" />
  <Et x={204} y={136} t={c.simT('r3')} color="verde" />
  <Et x={204} y={156} t={c.val('r3')} color="verde" peq />
  <path class="hilo" d="M40 230 H340" data-red="0"></path>
  <circle class="nodo" cx="190" cy="230" r="4.5" data-red="0"></circle>
  <!-- (1.2.1: where an ammeter opens each branch: the 0 V meters of the netlist) -->
  <Rama x={115} y={50} medidor="vm1" />
  <Rama x={265} y={50} medidor="vm2" />
  <Rama x={190} y={140} medidor="vm3" />
  <!-- (1.2.1: where the probes touch each node and the ammeter opens each branch) -->
  <Punto x={47} y={50} red="f1" />
  <Punto x={333} y={50} red="f2" />
  <Punto x={110} y={230} red="0" />
</Lienzo>
