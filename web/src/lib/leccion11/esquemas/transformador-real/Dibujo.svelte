<script lang="ts">
  // Schematic «transformador-real» (esquema.ts): the source with R_s, the leakage L_d along the top, the magnetising
  // L_m down across the primary, the ideal transformer (the kit's windings) and, on the secondary, C_p and the load.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import L from '../kit/L.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  import Trafo from '../kit/Trafo.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const d = $derived(`${dur.toFixed(2)}s`);
</script>

<Lienzo {descripcion} ancho={480} alto={250}>
  <path class="flujo" d="M40 220 V40 H250 V80" style:animation-duration={d}></path>
  <path class="flujo" d="M310 80 V40 H440 V220 H310 V190" style:animation-duration={d}></path>
  <FuenteCA x={40} y1={220} y2={40} pieza="fuente" />
  <Et x={64} y={120} t={c.val('fuente')} peq />
  <Et x={64} y={140} t={c.val('f')} peq />
  <path class="hilo" d="M40 40 H60"></path>
  <R x1={60} y1={40} x2={130} y2={40} pieza="rs" />
  <Et x={95} y={22} t={c.rot('rs')} ancla="middle" peq />
  {#if c.tiene('ld')}
    <path class="hilo" d="M130 40 H140"></path>
    <L x1={140} y1={40} x2={200} y2={40} color="naranja" pieza="ld" />
    <Et x={170} y={22} t={c.rot('ld')} ancla="middle" color="naranja" peq />
    <path class="hilo" d="M200 40 H250 V80"></path>
  {:else}
    <path class="hilo" d="M130 40 H250 V80"></path>
  {/if}
  <circle class="nodo" cx="215" cy="40" r="4.5"></circle>
  <circle class="nodo" cx="215" cy="220" r="4.5"></circle>
  <L x1={215} y1={40} x2={215} y2={220} color="azul" pieza="lm" />
  <Et x={204} y={126} t={c.simT('lm')} ancla="end" color="azul" peq />
  <Et x={204} y={144} t={c.val('lm')} ancla="end" color="azul" peq />
  <path class="hilo" d="M40 220 H250 V190"></path>
  <Trafo x1={250} x2={310} y1={80} y2={190} />
  <Et x={240} y={238} t={`${c.val('n1')} esp.`} color="azul" peq ancla="end" />
  <Et x={320} y={238} t={`${c.val('n2')} esp.`} color="naranja" peq />
  <path class="hilo" d="M310 80 V40 H440 M310 190 V220 H440"></path>
  {#if c.tiene('cp')}
    <circle class="nodo" cx="370" cy="40" r="4.5"></circle>
    <circle class="nodo" cx="370" cy="220" r="4.5"></circle>
    <C x1={370} y1={40} x2={370} y2={220} color="verde" pieza="cp" />
    <Et x={360} y={170} t={c.simT('cp')} ancla="end" color="verde" peq />
  {/if}
  <R x1={440} y1={40} x2={440} y2={220} color="verde" pieza="carga" />
  <Et x={428} y={110} t={c.simT('carga')} ancla="end" color="verde" peq />
  <Et x={428} y={128} t={c.val('carga')} ancla="end" color="verde" peq />
</Lienzo>
