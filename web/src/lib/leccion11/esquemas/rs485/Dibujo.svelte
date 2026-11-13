<script lang="ts">
  // Schematic «rs485» (esquema.ts): the two wires of the bus across the drawing, D1 (B) above and D0 (A) below; at the
  // near end (left) V_CC with R_p up to it and R_pd down to ground, and the termination R_T between the wires; the n
  // unit loads in the middle, from each wire to the receivers' internal voltage; at the far end (right) the other
  // termination and, with «activa», the bias again. Each termination's jumper is a switch on it.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const activa = $derived(c.tiene('activa') && c.cerrado('activa'));
  const n = $derived(Math.max(0, Math.round(c.p('n'))));
  // the far end's x (the bias there needs room)
  const xf = $derived(activa ? 400 : 430);
</script>

{#snippet terminacion(x: number, pieza: string)}
  <circle class="nodo" cx={x} cy="100" r="4.5" data-red="d1"></circle>
  {#if c.tiene(pieza)}
    <Interruptor x1={x} y1={100} x2={x} y2={124} cerrado={c.cerrado(pieza)} color="azul" pieza={pieza} />
    <R x1={x} y1={124} x2={x} y2={170} color="azul" pieza="rt" />
  {:else}
    <R x1={x} y1={100} x2={x} y2={170} color="azul" pieza="rt" />
  {/if}
  <circle class="nodo" cx={x} cy="170" r="4.5" data-red="d0"></circle>
{/snippet}

<Lienzo {descripcion} ancho={480} alto={262}>
  <Pila x={30} y1={240} y2={30} pieza="vcc" nodos={['0', 'vcc']} />
  <Et x={36} y={210} t={c.val('vcc')} peq />
  <path class="hilo" d="M30 30 H70" data-red="vcc"></path>
  <R x1={70} y1={30} x2={70} y2={100} color="naranja" pieza="rp" />
  <Et x={84} y={62} t={c.rot('rp')} color="naranja" peq />
  <path class="hilo" d={`M70 100 H${xf}`} data-red="d1"></path>
  <path class="hilo" d={`M70 170 H${xf}`} data-red="d0"></path>
  <Et x={190} y={92} t="D1 (B)" peq />
  <Et x={190} y={188} t="D0 (A)" peq />
  <R x1={70} y1={170} x2={70} y2={240} color="naranja" pieza={c.tiene('rpd') ? 'rpd' : 'rp'} />
  <Et x={84} y={212} t={c.tiene('rpd') ? c.rot('rpd') : c.rot('rp')} color="naranja" peq />
  <path class="hilo" d="M30 240 H70" data-red="0"></path>
  {@render terminacion(140, 't1')}
  <Et x={154} y={150} t={c.rot('rt')} color="azul" peq />
  <!-- the unit loads -->
  {#if n > 0}
    <circle class="nodo" cx="260" cy="100" r="4.5" data-red="d1"></circle>
    <circle class="nodo" cx="260" cy="170" r="4.5" data-red="d0"></circle>
    <!-- (each wire's loads to the receivers' internal voltage, «ref»: one terminal each, the same net) -->
    <R x1={260} y1={100} x2={260} y2={44} color="verde" pieza="n" />
    <circle class="borne" cx="260" cy="39" r="5"></circle>
    <Et x={272} y={43} t="ref" color="verde" peq />
    <R x1={260} y1={170} x2={260} y2={226} color="verde" />
    <circle class="borne" cx="260" cy="231" r="5"></circle>
    <Et x={272} y={235} t="ref" color="verde" peq />
  {/if}
  <Et x={274} y={204} t={`${n} ${n === 1 ? 'carga unidad' : 'cargas unidad'}`} color="verde" peq />
  {@render terminacion(xf, 't2')}
  {#if activa}
    <!-- the far end's own bias (PROFIBUS' active termination) -->
    <path class="hilo" d="M400 100 H450" data-red="d1"></path>
    <path class="hilo" d="M400 170 H450" data-red="d0"></path>
    <R x1={450} y1={30} x2={450} y2={100} color="naranja" />
    <path class="hilo" d="M450 30 V22 M444 22 H456" data-red="vcc"></path>
    <Et x={438} y={26} t={[{ t: 'txt', s: 'V' }, { t: 'sub', s: 'CC' }]} ancla="end" color="naranja" peq />
    <R x1={450} y1={170} x2={450} y2={240} color="naranja" />
    <path class="hilo" d="M444 240 H456" data-red="0"></path>
  {/if}
</Lienzo>
