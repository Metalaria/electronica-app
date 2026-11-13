<script lang="ts">
  // Schematic «comparador-no-inversor» (esquema.ts): the input source on the left, R₁ along the top input wire to the
  // node P at the + input (on top), R₂ over the amplifier from P to the output; the − input below to the reference (a
  // battery) or to ground.
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
  <path class="hilo" d="M40 110 H80" data-red="in"></path>
  <R x1={80} y1={110} x2={190} y2={110} color="azul" pieza="r1" />
  <Et x={135} y={92} t={c.rot('r1')} ancla="middle" color="azul" peq />
  <path class="hilo" d="M190 110 H250" data-red="p"></path>
  <circle class="nodo" cx="215" cy="110" r="4.5" data-red="p"></circle>
  <path class="hilo" d="M215 110 V50 H240" data-red="p"></path>
  <R x1={240} y1={50} x2={330} y2={50} color="naranja" pieza="r2" />
  <Et x={285} y={34} t={c.rot('r2')} ancla="middle" color="naranja" peq />
  <path class="hilo" d="M330 50 H350 V130" data-red="out"></path>
  <circle class="nodo" cx="350" cy="130" r="4.5" data-red="out"></circle>
  <AO x={250} y={130} masArriba />
  <path class="hilo" d={`M250 150 H200 V${ref ? 215 : 280}`} data-red="m"></path>
  {#if ref}
    <Pila x={200} y1={280} y2={215} pieza="ref" nodos={['0', 'm']} />
    <Et x={218} y={262} t={[{ t: 'txt', s: 'V' }, { t: 'sub', s: 'ref' }, { t: 'txt', s: ` ${c.val('ref')}` }]} peq />
  {/if}
  <path class="hilo" d="M310 130 H420" data-red="out"></path>
  <EtiquetasAO {c} x={300} y={222} ao />
  <circle class="borne" cx="420" cy="130" r="5"></circle>
  <Et x={420} y={114} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M40 280 H420" data-red="0"></path>
  <circle class="borne" cx="420" cy="280" r="5"></circle>
</Lienzo>
