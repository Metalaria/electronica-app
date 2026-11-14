<script lang="ts">
  // Schematic «comparador-schmitt» (esquema.ts): the input source on the left straight to the − input; the + input to
  // the node P, R₁ from P down to the reference (a battery) or to ground, and, for the Schmitt trigger, R₂ below the
  // amplifier from P to the output.
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import Entrada from '../kit/Entrada.svelte';
  import Et from '../kit/Et.svelte';
  import EtiquetasAO from '../kit/EtiquetasAO.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const ref = $derived(c.tiene('ref'));
</script>

<Lienzo {descripcion} ancho={460} alto={300}>
  <Entrada {c} x={40} y1={280} y2={110} />
  <EtiquetasAO {c} x={64} y={170} />
  <path class="hilo" d="M40 110 H250" data-red="in"></path>
  <AO x={250} y={130} />
  <path class="hilo" d="M250 150 H200" data-red="p"></path>
  <circle class="nodo" cx={c.tiene('r2') ? 220 : 200} cy="150" r="4.5" data-red="p"></circle>
  {#if c.tiene('r1')}
    <R x1={200} y1={150} x2={200} y2={ref ? 215 : 280} color="azul" pieza="r1" />
    <Et x={186} y={ref ? 186 : 210} t={c.simT('r1')} ancla="end" color="azul" />
    <Et x={186} y={ref ? 204 : 228} t={c.val('r1')} ancla="end" color="azul" peq />
  {:else}
    <path class="hilo" d={`M200 150 V${ref ? 215 : 280}`} data-red="p"></path>
  {/if}
  {#if ref}
    <Pila x={200} y1={280} y2={215} pieza="ref" nodos={['0', 'ref']} />
    <Et x={218} y={262} t={[{ t: 'txt', s: 'V' }, { t: 'sub', s: 'ref' }, { t: 'txt', s: ` ${c.val('ref')}` }]} peq />
  {/if}
  {#if c.tiene('r2')}
    <path class="hilo" d="M220 150 V190 H240" data-red="p"></path>
    <R x1={240} y1={190} x2={330} y2={190} color="naranja" pieza="r2" />
    <Et x={285} y={178} t={c.rot('r2')} ancla="middle" color="naranja" peq />
    <path class="hilo" d="M330 190 H350 V130" data-red="out"></path>
    <circle class="nodo" cx="350" cy="130" r="4.5" data-red="out"></circle>
  {/if}
  <path class="hilo" d="M310 130 H420" data-red="out"></path>
  <EtiquetasAO {c} x={300} y={222} ao />
  <circle class="borne" cx="420" cy="130" r="5"></circle>
  <Et x={420} y={114} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M40 280 H420" data-red="0"></path>
  <circle class="borne" cx="420" cy="280" r="5"></circle>
</Lienzo>
