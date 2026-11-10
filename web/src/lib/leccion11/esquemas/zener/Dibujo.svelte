<script lang="ts">
  // Schematic «zener» (esquema.ts): input, R_s on top, the Zener down (cathode up), the output node and the load.
  import type { PropsDibujo } from '../dibujos';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const cargada = $derived(c.tiene('carga') && c.cerrado('interruptor'));
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d="M40 230 V50 H200 V230 Z" {dur} />
  <Pila x={40} y1={230} y2={50} />
  <Et x={2} y={170} t={c.val('fuente')} />
  <path class="hilo" d={c.tiene('carga') ? 'M40 50 H70 M180 50 H300 M40 230 H300' : 'M40 50 H70 M180 50 H244 M40 230 H200'}></path>
  <R x1={70} y1={50} x2={180} y2={50} color="azul" />
  <Et x={125} y={30} t={c.rot('rs')} ancla="middle" color="azul" />
  <circle class="nodo" cx="200" cy="50" r="4.5"></circle>
  <D x1={200} y1={230} x2={200} y2={50} color="naranja" variante="zener" />
  <Et x={216} y={130} t={c.simT('vz')} color="naranja" />
  <Et x={216} y={150} t={c.val('vz')} color="naranja" peq />
  {#if c.tiene('carga')}
    <g class:fantasma={!cargada} data-carga={cargada ? 'conectada' : 'suelta'}>
      <R x1={300} y1={50} x2={300} y2={230} color="verde" />
      {#if cargada}
        <Et x={314} y={130} t={c.simT('carga')} color="verde" />
        <Et x={314} y={150} t={c.val('carga')} color="verde" peq />
      {/if}
    </g>
  {/if}
  <circle class="salida" cx="250" cy="50" r="6"></circle>
  <Et x={250} y={34} t="salida" color="naranja" peq ancla="middle" />
</Lienzo>
