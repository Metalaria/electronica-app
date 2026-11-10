<script lang="ts">
  // Schematic «recortador» (esquema.ts): the sine input, R on top, and from the output node down to ground the branch
  // of the positive peaks (diode, optional Zener and optional reference battery), the branch of the negative ones
  // (a diode upside down), or the two Zeners in antiserie. A disconnected branch is drawn as a ghost.
  import type { PropsDibujo } from '../dibujos';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const zz = $derived(c.tiene('zz'));
  const pos = $derived(!zz && c.cerrado('positivo'));
  const neg = $derived(!zz && c.cerrado('negativo'));
</script>

<Lienzo {descripcion} alto={250}>
  <FuenteCA x={40} y1={230} y2={50} />
  <Et x={2} y={110} t={c.val('fuente')} peq />
  <Et x={2} y={190} t={c.val('f')} peq />
  <path class="hilo" d="M40 50 H70 M170 50 H330 M40 230 H330"></path>
  <R x1={70} y1={50} x2={170} y2={50} color="azul" />
  <Et x={120} y={30} t={c.rot('r')} ancla="middle" color="azul" />
  {#if zz}
    <circle class="nodo" cx="240" cy="50" r="4.5"></circle>
    <circle class="nodo" cx="240" cy="230" r="4.5"></circle>
    <D x1={240} y1={140} x2={240} y2={50} color="naranja" variante="zener" />
    <D x1={240} y1={140} x2={240} y2={230} color="naranja" variante="zener" />
    <Et x={256} y={100} t={`Zener ${c.val('zz')}`} color="naranja" peq />
    <Et x={256} y={186} t={`Zener ${c.val('zz')}`} color="naranja" peq />
  {:else}
      <g class:fantasma={!pos} data-rama={pos ? 'conectada' : 'suelta'}>
        <circle class="nodo" cx="210" cy="50" r="4.5"></circle>
        <circle class="nodo" cx="210" cy="230" r="4.5"></circle>
        <D x1={210} y1={50} x2={210} y2={110} color="naranja" />
        <Et x={196} y={84} t={c.val('vd')} color="naranja" peq ancla="end" />
        {#if c.tiene('vz')}
          <D x1={210} y1={170} x2={210} y2={110} color="naranja" variante="zener" />
          <Et x={196} y={144} t={`Zener ${c.val('vz')}`} color="naranja" peq ancla="end" />
        {:else}
          <path class="hilo" d="M210 110 V170"></path>
        {/if}
        {#if c.tiene('vref')}
          <Pila x={210} y1={230} y2={170} />
          <Et x={196} y={204} t={`ref. ${c.val('vref')}`} color="naranja" peq ancla="end" />
        {:else}
          <path class="hilo" d="M210 170 V230"></path>
        {/if}
      </g>
    <g class:fantasma={!neg} data-rama={neg ? 'conectada' : 'suelta'}>
      <circle class="nodo" cx="280" cy="50" r="4.5"></circle>
      <circle class="nodo" cx="280" cy="230" r="4.5"></circle>
      <D x1={280} y1={230} x2={280} y2={50} color="verde" />
      <Et x={294} y={144} t={c.val('vd')} color="verde" peq />
    </g>
  {/if}
  <circle class="salida" cx="330" cy="50" r="6"></circle>
  <Et x={330} y={34} t="salida" color="naranja" peq ancla="middle" />
</Lienzo>
