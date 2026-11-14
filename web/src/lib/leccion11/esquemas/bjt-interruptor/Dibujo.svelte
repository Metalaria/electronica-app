<script lang="ts">
  // Schematic «bjt-interruptor» (esquema.ts): the drive source and R_B on the left, the NPN in the middle, R_C up to
  // the V_CC rail, the emitter to ground. (esquemas12c: with «vf», the LED between R_C and the collector — the
  // transistor and the base 30 units lower — glowing with the widget's «corriente» over 20 mA.)
  import type { PropsDibujo } from '../dibujos';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Npn from '../kit/Npn.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, widget, dur, descripcion }: PropsDibujo = $props();
  const led = $derived(c.tiene('vf'));
  const yq = $derived(led ? 170 : 140);
  const brillo = $derived(widget.corriente && !c.oculto ? Math.max(0, c.n(widget.corriente)) / 0.02 : 0.5);
</script>

<Lienzo {descripcion} alto={260}>
  <Flujo d={`M332 240 V30 H222 V${yq} L222 240 Z`} {dur} />
  <Pila x={40} y1={240} y2={yq} pieza="entrada" />
  <Et x={2} y={yq - 12} t={c.val('entrada')} />
  <path class="hilo" d={`M40 ${yq} H70 M160 ${yq} H176`}></path>
  <R x1={70} y1={yq} x2={160} y2={yq} color="azul" pieza="rb" />
  <Et x={115} y={yq - 20} t={c.rot('rb')} ancla="middle" color="azul" peq />
  <Npn x={210} y={yq} />
  <Et x={240} y={yq + 10} t={`β ${c.val('beta')}`} peq />
  {#if led}
    <R x1={222} y1={30} x2={222} y2={84} color="naranja" pieza="rc" />
    <Et x={236} y={62} t={c.rot('rc')} color="naranja" peq />
    <D x1={222} y1={84} x2={222} y2={130} color="naranja" variante="led" {brillo} pieza="vf" />
    <Et x={242} y={104} t="LED" color="naranja" peq />
    <Et x={242} y={122} t={c.val('vf')} color="naranja" peq />
  {:else}
    <R x1={222} y1={30} x2={222} y2={100} color="naranja" pieza="rc" />
    <Et x={236} y={64} t={c.rot('rc')} color="naranja" peq />
  {/if}
  <path class="hilo" d={`M222 30 H332 M222 ${yq + 40} V240 H40 M332 240 H222`}></path>
  <Pila x={332} y1={240} y2={30} pieza="vcc" />
  <Et x={346} y={150} t={c.val('vcc')} peq />
</Lienzo>
