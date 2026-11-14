<script lang="ts">
  // Schematic «induccion» (esquema.ts), as figura 34.5: the phase source on the left; R₁ and X₁ along the top to the
  // air-gap node; R_Fe and X_m down from it; X₂′ along the top on to the rotor, whose R₂′ and R₂′·(1 − s)/s (the slip's
  // resistor, drawn with an arrow: it changes with the speed) go down the right side.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import L from '../kit/L.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  import { deslizamiento } from './esquema';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const pct = $derived(`s ${(deslizamiento(c) * 100).toLocaleString('es-ES', { maximumSignificantDigits: 3 })} %`);
</script>

<Lienzo {descripcion} ancho={470} alto={262}>
  <Flujo d="M40 240 V50 H430 V240 Z" {dur} medidor="vmi" />
  <FuenteCA x={40} y1={240} y2={50} pieza="fuente" nodos={['0', 'fte']} />
  <Et x={58} y={140} t={c.val('fuente')} peq />
  <Et x={58} y={158} t={c.val('f')} peq />
  <path class="hilo" d="M40 50 H60" data-red="fte"></path>
  <R x1={60} y1={50} x2={130} y2={50} color="azul" pieza="r1" />
  <Et x={95} y={30} t={c.rot('r1')} ancla="middle" color="azul" peq />
  <L x1={130} y1={50} x2={200} y2={50} color="azul" pieza="x1" />
  <Et x={165} y={24} t={c.rot('x1')} ancla="middle" color="azul" peq />
  <path class="hilo" d="M200 50 H310" data-red="g"></path>
  <circle class="nodo" cx="290" cy="50" r="4.5" data-red="g"></circle>
  {#if c.tiene('rfe')}
    <circle class="nodo" cx="230" cy="50" r="4.5" data-red="g"></circle>
    <R x1={230} y1={50} x2={230} y2={240} color="naranja" pieza="rfe" />
    <Et x={216} y={140} t={c.simT('rfe')} ancla="end" color="naranja" peq />
    <Et x={216} y={158} t={c.val('rfe')} ancla="end" color="naranja" peq />
  {/if}
  <L x1={290} y1={50} x2={290} y2={240} color="naranja" pieza="xm" />
  <Et x={276} y={140} t={c.simT('xm')} ancla="end" color="naranja" peq />
  <Et x={276} y={158} t={c.val('xm')} ancla="end" color="naranja" peq />
  <Et x={250} y={80} t="E" ancla="middle" />
  <L x1={310} y1={50} x2={380} y2={50} color="verde" pieza="x2" />
  <Et x={345} y={24} t={c.rot('x2')} ancla="middle" color="verde" peq />
  <path class="hilo" d="M380 50 H430" data-red="r"></path>
  <R x1={430} y1={50} x2={430} y2={140} color="verde" pieza="r2" />
  <Et x={416} y={92} t={c.simT('r2')} ancla="end" color="verde" peq />
  <Et x={416} y={110} t={c.val('r2')} ancla="end" color="verde" peq />
  <!-- the mechanical load: R₂′·(1 − s)/s, its arrow across it; dragging it moves the slip -->
  <R x1={430} y1={140} x2={430} y2={240} color="verde" pieza="s" />
  <path class="pieza fina verde" d="M414 212 L446 168 M446 168 l-1 8 M446 168 l-7 3"></path>
  <Et x={416} y={224} t={[{ t: 'txt', s: 'R' }, { t: 'sub', s: '2' }, { t: 'txt', s: '′(1 − s)/s' }]} ancla="end" color="verde" peq />
  <Et x={416} y={196} t={pct} ancla="end" color="verde" peq />
  <path class="hilo" d="M430 240 H40" data-red="0"></path>
</Lienzo>
