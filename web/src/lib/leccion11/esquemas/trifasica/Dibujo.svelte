<script lang="ts">
  // Schematic «trifasica» (esquema.ts): the three sources side by side on the left, joined at the bottom by the
  // supply's neutral; the lines L1, L2 and L3 as three rows to the right. In star, each load on its row and the star
  // bus on the right, with the neutral (a switch) back to the bottom; in delta, R₁ from L1 to L2, R₂ from L2 to L3 and
  // R₃ from L3 to L1, upright between the rows.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  import type { Texto } from '../../tipos';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const delta = $derived(c.tiene('triangulo') && c.cerrado('triangulo'));
  const neutro = $derived(!delta && c.cerrado('neutro'));
  const L = (k: number): Texto => [{ t: 'txt', s: 'L' }, { t: 'sub', s: String(k) }];
  const d = $derived(`${dur.toFixed(2)}s`);
</script>

<Lienzo {descripcion} ancho={460} alto={280}>
  {#if delta}
    <path class="flujo" d="M40 260 V40 H280 V110 H90 V260" style:animation-duration={d}></path>
    <path class="flujo" d="M90 260 V110 H320 V180 H140 V260" style:animation-duration={d}></path>
    <path class="flujo" d="M140 260 V180 H360 V40 H40" style:animation-duration={d}></path>
  {:else}
    <path class="flujo" d="M40 260 V40 H400 V180" style:animation-duration={d}></path>
    <path class="flujo" d="M90 260 V110 H400" style:animation-duration={d}></path>
    <path class="flujo" d="M140 260 V180 H400 V260 H40" style:animation-duration={d}></path>
  {/if}
  <FuenteCA x={40} y1={260} y2={40} pieza="fuente" nodos={['0', 'l1']} />
  <FuenteCA x={90} y1={260} y2={110} nodos={['0', 'l2']} />
  <FuenteCA x={140} y1={260} y2={180} nodos={['0', 'l3']} />
  <Et x={164} y={232} t={c.val('fuente')} peq />
  <Et x={164} y={250} t={c.val('f')} peq />
  <Et x={200} y={26} t={L(1)} ancla="middle" peq />
  <Et x={200} y={96} t={L(2)} ancla="middle" peq />
  <Et x={200} y={166} t={L(3)} ancla="middle" peq />
  <Et x={20} y={276} t="N" ancla="middle" peq />
  <path class="hilo" d="M40 260 H140" data-red="0"></path>
  {#if delta}
    <path class="hilo" d="M40 40 H360" data-red="l1"></path>
    <path class="hilo" d="M90 110 H320" data-red="l2"></path>
    <path class="hilo" d="M140 180 H360" data-red="l3"></path>
    <circle class="nodo" cx="280" cy="40" r="4.5" data-red="l1"></circle>
    <circle class="nodo" cx="280" cy="110" r="4.5" data-red="l2"></circle>
    <circle class="nodo" cx="320" cy="180" r="4.5" data-red="l3"></circle>
    <R x1={280} y1={40} x2={280} y2={110} color="azul" pieza="r1" />
    <Et x={266} y={80} t={c.rot('r1')} ancla="end" color="azul" peq />
    <R x1={320} y1={110} x2={320} y2={180} color="naranja" pieza="r2" />
    <Et x={306} y={150} t={c.rot('r2')} ancla="end" color="naranja" peq />
    <R x1={360} y1={180} x2={360} y2={40} color="verde" pieza="r3" />
    <Et x={374} y={114} t={c.rot('r3')} color="verde" peq />
  {:else}
    <path class="hilo" d="M40 40 H280" data-red="l1"></path>
    <path class="hilo" d="M90 110 H280" data-red="l2"></path>
    <path class="hilo" d="M140 180 H280" data-red="l3"></path>
    <R x1={280} y1={40} x2={370} y2={40} color="azul" pieza="r1" />
    <Et x={325} y={22} t={c.rot('r1')} ancla="middle" color="azul" peq />
    <R x1={280} y1={110} x2={370} y2={110} color="naranja" pieza="r2" />
    <Et x={325} y={92} t={c.rot('r2')} ancla="middle" color="naranja" peq />
    <R x1={280} y1={180} x2={370} y2={180} color="verde" pieza="r3" />
    <Et x={325} y={162} t={c.rot('r3')} ancla="middle" color="verde" peq />
    <path class="hilo" d="M370 40 H400 V180 M370 110 H400 M370 180 H400 V195" data-red="s"></path>
    <circle class="nodo" cx="400" cy="110" r="4.5" data-red="s"></circle>
    <circle class="nodo" cx="400" cy="180" r="4.5" data-red="s"></circle>
    <Et x={412} y={184} t={[{ t: 'txt', s: 'N' }, { t: 'txt', s: '′' }]} peq />
    {#if c.tiene('neutro')}
      <Interruptor x1={400} y1={195} x2={400} y2={245} cerrado={neutro} pieza="neutro" />
    {:else}
      <path class="hilo" d="M400 195 V245" data-red="s"></path>
    {/if}
    <path class="hilo" d="M400 245 V260 H140" data-red="0"></path>
  {/if}
</Lienzo>
