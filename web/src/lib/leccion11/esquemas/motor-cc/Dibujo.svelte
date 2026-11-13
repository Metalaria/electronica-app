<script lang="ts">
  // Schematic «motor-cc» (esquema.ts): on the left the armature as in figura 34.3a — the source V, R and L along the
  // top, the back-EMF E = k·ω down the right of the loop; on the right, apart, the mechanics as the circuit the book
  // simulates: the torque k·I a dependent current source into the speed node ω, the inertia J a capacitor, the
  // friction b a resistor (optional) and the load torque a current source taking out of the node. The mechanical
  // wires carry no `data-red`: their «voltage» is a speed, not volts (and the drawing is never coloured anyway: the
  // coil and the inertia start from their initial conditions).
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteDep from '../kit/FuenteDep.svelte';
  import FuenteI from '../kit/FuenteI.svelte';
  import L from '../kit/L.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const friccion = $derived(c.tiene('b'));
  // the load's x: one place further right with the friction drawn; the mechanical rails end at the last part
  const xc = $derived(friccion ? 460 : 430);
  const xfin = $derived(c.tiene('carga') ? xc : friccion ? 420 : 380);
</script>

<Lienzo {descripcion} ancho={480} alto={262}>
  <Flujo d="M40 240 V60 H270 V240 Z" {dur} medidor="vmi" />
  <Pila x={40} y1={240} y2={60} pieza="fuente" nodos={['0', 'in']} />
  <Et x={34} y={176} t={c.val('fuente')} ancla="end" />
  {#if c.tiene('rampa')}
    <!-- the ramp: a small slope under the source's value -->
    <path class="hilo fino" d="M4 206 l18 -14 h8"></path>
    <Et x={34} y={224} t={c.val('rampa')} ancla="end" peq />
  {/if}
  <path class="hilo" d="M40 60 H70" data-red="in"></path>
  <R x1={70} y1={60} x2={160} y2={60} color="azul" pieza="r" />
  <Et x={115} y={40} t={c.rot('r')} ancla="middle" color="azul" peq />
  <L x1={160} y1={60} x2={240} y2={60} color="azul" pieza="l" />
  <Et x={200} y={34} t={c.rot('l')} ancla="middle" color="azul" peq />
  <path class="hilo" d="M240 60 H270" data-red="e"></path>
  <FuenteDep x={270} y1={240} y2={60} tipo="tension" nodos={['0', 'e']} />
  <!-- (inside the loop, which is empty) -->
  <Et x={246} y={140} t="E = k·ω" ancla="end" />
  <Et x={246} y={160} t={`k ${c.val('k')}`} ancla="end" peq />
  <path class="hilo" d="M270 240 H40" data-red="0"></path>
  <!-- the mechanics -->
  <Et x={312} y={22} t="mecánica: ω como una tensión" peq />
  <FuenteDep x={330} y1={240} y2={60} tipo="corriente" />
  <Et x={348} y={118} t="k·I" />
  <path class="hilo" d={`M330 60 H${xfin}`}></path>
  <Et x={350} y={84} t="ω" />
  {#if xfin > 380}<circle class="nodo" cx="380" cy="60" r="4.5"></circle>{/if}
  <C x1={380} y1={60} x2={380} y2={240} color="naranja" pieza="j" />
  <Et x={394} y={140} t={c.simT('j')} color="naranja" />
  {#if friccion}
    <circle class="nodo" cx="420" cy="60" r="4.5"></circle>
    <R x1={420} y1={60} x2={420} y2={240} color="verde" pieza="b" />
    <Et x={428} y={110} t="1/b" color="verde" peq />
  {/if}
  {#if c.tiene('carga')}
    <FuenteI x={xc} y1={60} y2={240} pieza="carga" />
    <Et x={xc + 18} y={48} t={[{ t: 'txt', s: 'T' }, { t: 'sub', s: 'carga' }, { t: 'txt', s: ` ${c.val('carga')}` }]} ancla="end" color="verde" peq />
  {/if}
  <path class="hilo" d={`M330 240 H${xfin}`}></path>
</Lienzo>
