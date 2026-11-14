<script lang="ts">
  // Schematic «crowbar» (esquema.ts): the input on the left (its normal value and the failure's), the fuse along the
  // top to the rail; across the rail, left to right, the Zener down to the gate node with R_G to ground, the SCR
  // (anode at the rail, its gate wired from the gate node) and the load R_L.
  import type { PropsDibujo } from '../dibujos';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  import Tiristor from '../kit/Tiristor.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} ancho={440} alto={262}>
  <Flujo d="M40 240 V60 H390 V240 Z" {dur} medidor="vmf" />
  <Pila x={40} y1={240} y2={60} pieza="fuente" nodos={['0', 'in']} />
  <Et x={2} y={176} t={c.val('fuente')} />
  <Et x={50} y={208} t="avería:" color="naranja" peq />
  <Et x={50} y={226} t={c.val('falla')} color="naranja" peq />
  <path class="hilo" d="M40 60 H90" data-red="in"></path>
  <!-- the fuse: a box with its wire through it -->
  <g data-pieza="i2t" data-cuerpo="90 52 140 68">
    <rect class="pieza azul" x="90" y="52" width="50" height="16" rx="2" fill="none"></rect>
    <path class="pieza fina azul" d="M90 60 H140"></path>
  </g>
  <Et x={115} y={40} t="fusible" ancla="middle" color="azul" peq />
  <Et x={115} y={88} t={`${c.val('i2t')}`} ancla="middle" color="azul" peq />
  <path class="hilo" d="M140 60 H390" data-red="r"></path>
  <circle class="nodo" cx="210" cy="60" r="4.5" data-red="r"></circle>
  <circle class="nodo" cx="300" cy="60" r="4.5" data-red="r"></circle>
  <!-- the Zener, cathode on the rail, down to the gate node; R_G to ground -->
  <D x1={210} y1={150} x2={210} y2={60} color="naranja" variante="zener" pieza="vz" />
  <Et x={190} y={100} t={[{ t: 'txt', s: 'V' }, { t: 'sub', s: 'Z' }]} ancla="end" color="naranja" peq />
  <Et x={190} y={118} t={c.val('vz')} ancla="end" color="naranja" peq />
  <circle class="nodo" cx="210" cy="150" r="4.5"></circle>
  <R x1={210} y1={150} x2={210} y2={240} color="naranja" pieza={c.tiene('rg') ? 'rg' : undefined} />
  <Et x={196} y={192} t={c.tiene('rg') ? c.simT('rg') : [{ t: 'txt', s: 'R' }, { t: 'sub', s: 'G' }]} ancla="end" color="naranja" peq />
  {#if c.tiene('rg')}<Et x={196} y={210} t={c.val('rg')} ancla="end" color="naranja" peq />{/if}
  <path class="hilo" d="M210 150 H266 V171"></path>
  <Tiristor x1={300} y1={60} x2={300} y2={240} color="azul" />
  <Et x={322} y={146} t="SCR" color="azul" />
  <R x1={390} y1={60} x2={390} y2={240} color="verde" pieza="carga" />
  <Et x={376} y={192} t={c.simT('carga')} ancla="end" color="verde" peq />
  <Et x={376} y={210} t={c.val('carga')} ancla="end" color="verde" peq />
  <path class="hilo" d="M390 240 H40" data-red="0"></path>
</Lienzo>
