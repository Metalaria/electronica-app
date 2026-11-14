<script lang="ts">
  // Schematic «tiristor» (esquema.ts): the mains on the left, the SCR or TRIAC along the top (a tap on it swaps one for
  // the other when the card has the «triac» switch), its gate down to a trigger terminal with the firing angle, the
  // load R (and L) down the right.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import L from '../kit/L.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  import Tiristor from '../kit/Tiristor.svelte';
  import { esTriac } from './esquema';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const triac = $derived(esTriac(c));
  const bobina = $derived(c.tiene('l'));
</script>

<Lienzo {descripcion} ancho={400} alto={262}>
  <Flujo d="M40 240 V60 H300 V240 Z" {dur} medidor="vmi" />
  <FuenteCA x={40} y1={240} y2={60} pieza="fuente" nodos={['0', 'fte']} />
  <Et x={58} y={176} t={c.val('fuente')} peq />
  <Et x={58} y={194} t={c.val('f')} peq />
  <path class="hilo" d="M40 60 H90" data-red="fte"></path>
  <Tiristor x1={90} y1={60} x2={190} y2={60} tipo={triac ? 'triac' : 'scr'} color="azul" pieza={c.tiene('triac') ? 'triac' : undefined} />
  <Et x={140} y={34} t={triac ? 'TRIAC' : 'SCR'} ancla="middle" color="azul" />
  <!-- the gate: down to the trigger's terminal, with the firing angle -->
  <path class="hilo" d="M161 94 V108"></path>
  <circle class="borne" cx="161" cy="113" r="5"></circle>
  <Et x={161} y={138} t="disparo" ancla="middle" color="azul" peq />
  <Et x={161} y={156} t={`α ${c.val('alfa')}`} ancla="middle" color="azul" />
  <path class="hilo" d="M190 60 H300" data-red="k"></path>
  {#if bobina}
    <R x1={300} y1={60} x2={300} y2={150} color="naranja" pieza="r" />
    <Et x={314} y={100} t={c.simT('r')} color="naranja" />
    <Et x={314} y={118} t={c.val('r')} color="naranja" peq />
    <L x1={300} y1={150} x2={300} y2={240} color="naranja" pieza="l" />
    <Et x={314} y={192} t={c.simT('l')} color="naranja" />
    <Et x={314} y={210} t={c.val('l')} color="naranja" peq />
  {:else}
    <R x1={300} y1={60} x2={300} y2={240} color="naranja" pieza="r" />
    <Et x={314} y={146} t={c.simT('r')} color="naranja" />
    <Et x={314} y={164} t={c.val('r')} color="naranja" peq />
  {/if}
  <path class="hilo" d="M300 240 H40" data-red="0"></path>
</Lienzo>
