<script lang="ts">
  // Schematic «reductor» (esquema.ts): V_in on the left, the high-side switch S along the top (its PWM marked under
  // it), the switch node with the freewheel diode (or the synchronous switch) down to ground, the coil L (and its DCR)
  // along the top to the output node, the capacitor C (with its ESR above it) and the load R down to ground, the output
  // terminal on the right.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import L from '../kit/L.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  import { conDiodo } from './esquema';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const diodo = $derived(conDiodo(c));
  const pct = $derived(`D ${(c.p('ciclo') * 100).toLocaleString('es-ES', { maximumSignificantDigits: 3 })} %`);
</script>

<Lienzo {descripcion} ancho={460} alto={262}>
  <Flujo d="M40 240 V60 H380 V240 Z" {dur} />
  <Pila x={40} y1={240} y2={60} pieza="vin" nodos={['0', 'vin']} />
  <Et x={34} y={176} t={c.val('vin')} ancla="end" />
  <path class="hilo" d="M40 60 H70" data-red="vin"></path>
  <Interruptor x1={70} y1={60} x2={130} y2={60} cerrado={true} color="azul" pieza="ciclo" />
  <Et x={100} y={34} t="S" ancla="middle" color="azul" />
  <!-- the PWM under the switch -->
  <path class="hilo fino" d="M78 98 h6 v-12 h10 v12 h12 v-12 h10 v12 h6"></path>
  <Et x={100} y={118} t={c.val('f')} ancla="middle" color="azul" peq />
  <Et x={100} y={136} t={pct} ancla="middle" color="azul" peq />
  <path class="hilo" d="M130 60 H200" data-red="sw"></path>
  <circle class="nodo" cx="170" cy="60" r="4.5" data-red="sw"></circle>
  {#if diodo}
    <D x1={170} y1={240} x2={170} y2={60} />
    <Et x={184} y={156} t={c.val('vf')} peq />
  {:else}
    <Interruptor x1={170} y1={240} x2={170} y2={60} cerrado={false} color="azul" />
    <Et x={184} y={156} t="síncrono" color="azul" peq />
  {/if}
  {#if c.tiene('dcr')}
    <L x1={200} y1={60} x2={260} y2={60} color="naranja" pieza="l" />
    <R x1={260} y1={60} x2={310} y2={60} color="naranja" pieza="dcr" />
    <Et x={230} y={34} t={c.rot('l')} ancla="middle" color="naranja" peq />
    <Et x={285} y={86} t={c.val('dcr')} ancla="middle" color="naranja" peq />
  {:else}
    <L x1={200} y1={60} x2={300} y2={60} color="naranja" pieza="l" />
    <Et x={250} y={34} t={c.rot('l')} ancla="middle" color="naranja" peq />
  {/if}
  <path class="hilo" d={`M${c.tiene('dcr') ? 310 : 300} 60 H430`} data-red="o"></path>
  <circle class="nodo" cx="330" cy="60" r="4.5" data-red="o"></circle>
  {#if c.tiene('esr')}
    <R x1={330} y1={60} x2={330} y2={140} color="verde" pieza="esr" />
    <Et x={344} y={96} t={[{ t: 'txt', s: 'ESR ' }, { t: 'txt', s: c.val('esr') }]} color="verde" peq />
    <C x1={330} y1={140} x2={330} y2={240} color="verde" pieza="c" />
    <Et x={344} y={196} t={c.rot('c')} color="verde" peq />
  {:else}
    <C x1={330} y1={60} x2={330} y2={240} color="verde" pieza="c" />
    <Et x={344} y={156} t={c.rot('c')} color="verde" peq />
  {/if}
  <circle class="nodo" cx="380" cy="60" r="4.5" data-red="o"></circle>
  <R x1={380} y1={60} x2={380} y2={240} color="verde" pieza="carga" />
  <Et x={394} y={146} t={c.simT('carga')} color="verde" peq />
  <Et x={394} y={164} t={c.val('carga')} color="verde" peq />
  <circle class="borne" cx="435" cy="60" r="5"></circle>
  <Et x={435} y={44} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M380 240 H40" data-red="0"></path>
</Lienzo>
