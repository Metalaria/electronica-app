<script lang="ts">
  // Schematic «snubber» (esquema.ts): the bus on the left and its rail along the top; the load current I₀ down into the
  // drain node; the MOSFET (its channel opens at t = 0) and C_oss down to ground; the clamp diode up from the drain
  // node to the stray inductance L (and R_p beside it) back to the rail; on the right the snubber R_s–C_s across the
  // switch, with its switch.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import FuenteI from '../kit/FuenteI.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import L from '../kit/L.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Mosfet from '../kit/Mosfet.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  import { conSnubber } from './esquema';
  let { c, descripcion }: PropsDibujo = $props();
  const red = $derived(c.tiene('rsn') && c.tiene('csn'));
  const xfin = $derived(red ? 360 : 230);
</script>

<Lienzo {descripcion} ancho={420} alto={272}>
  <Pila x={40} y1={250} y2={40} pieza="vb" nodos={['0', 'bus']} />
  <Et x={56} y={150} t={c.val('vb')} peq />
  <path class="hilo" d={`M40 40 H${c.tiene('rp') ? 280 : 230}`} data-red="bus"></path>
  <FuenteI x={150} y1={40} y2={120} pieza="i0" nodos={['bus', 'd']} />
  <Et x={128} y={76} t={[{ t: 'txt', s: 'I' }, { t: 'sub', s: '0' }]} ancla="end" color="verde" />
  <Et x={128} y={94} t={c.val('i0')} ancla="end" color="verde" peq />
  <path class="hilo" d={`M150 120 V160 M150 140 H${xfin}`} data-red="d"></path>
  <circle class="nodo" cx="150" cy="140" r="4.5" data-red="d"></circle>
  <Mosfet x={138} y={200} />
  <path class="hilo" d="M150 240 V250" data-red="0"></path>
  <circle class="borne" cx="70" cy="200" r="5"></circle>
  <path class="hilo" d="M75 200 H104"></path>
  <Et x={70} y={184} t="puerta" ancla="middle" peq />
  <Et x={96} y={228} t="se abre en t = 0" ancla="middle" peq />
  <circle class="nodo" cx="190" cy="140" r="4.5" data-red="d"></circle>
  <C x1={190} y1={140} x2={190} y2={250} color="naranja" pieza="coss" />
  <Et x={208} y={196} t={c.simT('coss')} color="naranja" peq />
  <Et x={208} y={214} t={c.val('coss')} color="naranja" peq />
  <!-- the clamp: the diode up from the drain node, the stray inductance (and its losses) to the rail -->
  <circle class="nodo" cx="230" cy="140" r="4.5" data-red="d"></circle>
  <D x1={230} y1={140} x2={230} y2={100} />
  <L x1={230} y1={100} x2={230} y2={40} color="naranja" pieza="l" />
  <Et x={216} y={66} t={c.simT('l')} ancla="end" color="naranja" peq />
  <Et x={216} y={84} t={c.val('l')} ancla="end" color="naranja" peq />
  {#if c.tiene('rp')}
    <path class="hilo" d="M230 100 H280" data-red="y"></path>
    <circle class="nodo" cx="230" cy="100" r="4.5" data-red="y"></circle>
    <R x1={280} y1={100} x2={280} y2={40} color="naranja" pieza="rp" />
    <Et x={294} y={66} t={c.simT('rp')} color="naranja" peq />
    <Et x={294} y={84} t={c.val('rp')} color="naranja" peq />
  {/if}
  {#if red}
    <!-- the snubber across the switch -->
    {#if c.tiene('snubber')}
      <Interruptor x1={360} y1={140} x2={360} y2={170} cerrado={conSnubber(c)} color="azul" pieza="snubber" />
    {:else}
      <path class="hilo" d="M360 140 V170" data-red="d"></path>
    {/if}
    <R x1={360} y1={170} x2={360} y2={210} color="azul" pieza="rsn" />
    <C x1={360} y1={210} x2={360} y2={250} color="azul" pieza="csn" />
    <Et x={374} y={186} t={c.simT('rsn')} color="azul" peq />
    <Et x={374} y={202} t={c.val('rsn')} color="azul" peq />
    <Et x={374} y={228} t={c.simT('csn')} color="azul" peq />
    <Et x={374} y={244} t={c.val('csn')} color="azul" peq />
    <Et x={346} y={130} t="snubber" ancla="end" color="azul" peq />
  {/if}
  <path class="hilo" d={`M40 250 H${red ? 360 : 190}`} data-red="0"></path>
</Lienzo>
