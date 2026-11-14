<script lang="ts">
  // Schematic «desfase» (esquema.ts): the input on the left, three cells along the top — C in series, R down to ground
  // at each cell's output — and, with «separadores», a follower (a triangle marked ×1) after the first and second
  // cells; a tap on a follower takes them out or puts them in.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  import { conSeparadores } from './esquema';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const sep = $derived(conSeparadores(c));
  // each cell: its capacitor from x to x + 40, its node and resistor at x + 60
  const celdas = [60, 180, 300];
</script>

<Lienzo {descripcion} ancho={420} alto={262}>
  <Flujo d="M30 240 V60 H120 V240 Z" {dur} />
  <FuenteCA x={30} y1={240} y2={60} pieza="fuente" nodos={['0', 'in']} />
  <Et x={46} y={200} t={c.val('fuente')} peq />
  <path class="hilo" d="M30 60 H60" data-red="in"></path>
  {#each celdas as x, k (x)}
    <C x1={x} y1={60} x2={x + 40} y2={60} color="azul" pieza="c" />
    <path class="hilo" d={`M${x + 40} 60 H${k < 2 ? x + 70 : x + 90}`} data-red={`n${k + 1}`}></path>
    <circle class="nodo" cx={x + 60} cy="60" r="4.5" data-red={`n${k + 1}`}></circle>
    <R x1={x + 60} y1={60} x2={x + 60} y2={240} color="naranja" pieza="r" />
    {#if k < 2}
      {#if sep}
        <!-- the follower: a small triangle from x + 70 to x + 104 -->
        <g data-pieza={c.tiene('separadores') ? 'separadores' : undefined} data-cuerpo={`${x + 70} 44 ${x + 104} 76`}>
          <path class="pieza verde" d={`M${x + 70} 44 V76 L${x + 104} 60 Z`}></path>
          <text class="et peq verde" x={x + 82} y={64} text-anchor="middle">1</text>
        </g>
        <path class="hilo" d={`M${x + 104} 60 H${x + 120}`} data-red={`b${k + 1}`}></path>
      {:else}
        <g data-pieza={c.tiene('separadores') ? 'separadores' : undefined}>
          <path class="hilo" d={`M${x + 70} 60 H${x + 120}`} data-red={`n${k + 1}`}></path>
        </g>
      {/if}
    {/if}
  {/each}
  <Et x={80} y={30} t={c.rot('c')} ancla="middle" color="azul" peq />
  <Et x={134} y={150} t={c.simT('r')} color="naranja" peq />
  <Et x={134} y={168} t={c.val('r')} color="naranja" peq />
  <circle class="borne" cx="395" cy="60" r="5"></circle>
  <Et x={395} y={44} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M360 240 H30" data-red="0"></path>
</Lienzo>
