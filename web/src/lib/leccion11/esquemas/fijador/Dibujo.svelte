<script lang="ts">
  // Schematic «fijador» (esquema.ts): the sine input, the series capacitor on top, the diode from the node to ground
  // (its direction by the «sube» switch) and, for the doubler, the second diode on top and the peak capacitor down.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const sube = $derived(c.cerrado('sube'));
  const doble = $derived(c.tiene('c2'));
</script>

<Lienzo {descripcion} alto={250}>
  <FuenteCA x={40} y1={230} y2={50} pieza="fuente" />
  <Et x={2} y={110} t={c.val('fuente')} peq />
  <Et x={2} y={190} t={c.val('f')} peq />
  <path class="hilo" d={doble ? 'M40 50 H80 M140 50 H210 M290 50 H330 M40 230 H330' : 'M40 50 H80 M140 50 H330 M40 230 H330'}></path>
  <C x1={80} y1={50} x2={140} y2={50} color="azul" pieza="c" />
  <Et x={110} y={26} t={c.rot('c')} ancla="middle" color="azul" />
  <circle class="nodo" cx="190" cy="50" r="4.5"></circle>
  <circle class="nodo" cx="190" cy="230" r="4.5"></circle>
  {#if sube}
    <D x1={190} y1={230} x2={190} y2={50} color="naranja" />
  {:else}
    <D x1={190} y1={50} x2={190} y2={230} color="naranja" />
  {/if}
  <Et x={176} y={144} t={c.val('vd')} color="naranja" peq ancla="end" />
  {#if doble}
    {#if sube}
      <D x1={210} y1={50} x2={290} y2={50} color="verde" />
    {:else}
      <D x1={290} y1={50} x2={210} y2={50} color="verde" />
    {/if}
    <Et x={250} y={30} t={c.val('vd')} color="verde" peq ancla="middle" />
    <circle class="nodo" cx="310" cy="50" r="4.5"></circle>
    <circle class="nodo" cx="310" cy="230" r="4.5"></circle>
    <C x1={310} y1={50} x2={310} y2={230} color="verde" pieza="c2" />
    <Et x={284} y={136} t={c.simT('c2')} color="verde" ancla="end" />
    <Et x={284} y={156} t={c.val('c2')} color="verde" peq ancla="end" />
  {/if}
  <circle class="salida" cx="330" cy="50" r="6"></circle>
  <Et x={330} y={34} t="salida" color="naranja" peq ancla="middle" />
</Lienzo>
