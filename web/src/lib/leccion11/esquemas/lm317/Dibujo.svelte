<script lang="ts">
  // Schematic «lm317» (esquema.ts): the input battery on the left into IN, the chip (a box: IN left, OUT right, ADJ
  // below), R₁ from OUT down to the ADJ node, R₂ from it to ground, the load switch and R_L on the right.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const cerrado = $derived(c.cerrado('interruptor'));
  const sub = (s: string, i: string) => [{ t: 'txt' as const, s }, { t: 'sub' as const, s: i }];
</script>

<Lienzo {descripcion} ancho={440} alto={280}>
  <Flujo d={cerrado ? 'M40 260 V60 H390 V260 Z' : 'M40 260 V60 H250 V260 Z'} {dur} medidor={cerrado ? 'vml' : 'vmr'} />
  <Pila x={40} y1={260} y2={60} pieza="entrada" nodos={['0', 'in']} />
  <Et x={56} y={170} t={c.val('entrada')} />
  <path class="hilo" d="M40 60 H110" data-red="in"></path>
  <g data-cuerpo="110 30 190 100"><rect class="pieza" x="110" y="30" width="80" height="70" rx="4"></rect></g>
  <Et x={150} y={56} t="LM317" ancla="middle" peq />
  <Et x={116} y={92} t="IN" peq />
  <Et x={184} y={92} t="OUT" ancla="end" peq />
  <path class="hilo" d="M190 60 H330" data-red="out"></path>
  <circle class="nodo" cx="250" cy="60" r="4.5" data-red="out"></circle>
  <path class="hilo" d="M150 100 V150 H250" data-red="adj"></path>
  <Et x={144} y={128} t="ADJ" ancla="end" peq />
  <R x1={250} y1={60} x2={250} y2={150} color="azul" pieza="r1" />
  <Et x={264} y={98} t={c.simT('r1')} color="azul" />
  <Et x={264} y={116} t={c.val('r1')} color="azul" peq />
  <circle class="nodo" cx="250" cy="150" r="4.5" data-red="adj"></circle>
  <R x1={250} y1={150} x2={250} y2={260} color="azul" pieza="r2" />
  <Et x={264} y={200} t={c.simT('r2')} color="azul" />
  <Et x={264} y={218} t={c.val('r2')} color="azul" peq />
  <Et x={236} y={128} t={[...sub('V', 'ref'), { t: 'txt', s: ` ${c.tiene('ref') ? c.val('ref') : '1,25 V'}` }]} ancla="end" peq />
  {#if c.tiene('interruptor')}
    <Interruptor x1={330} y1={60} x2={375} y2={60} {cerrado} color="verde" pieza="interruptor" />
  {:else}
    <path class="hilo" d="M330 60 H375" data-red="out"></path>
  {/if}
  <path class="hilo" d="M375 60 H390" data-red={cerrado ? 'out' : undefined}></path>
  <R x1={390} y1={60} x2={390} y2={260} color="verde" fantasma={!cerrado} pieza="carga" />
  {#if cerrado}
    <Et x={376} y={170} t={c.simT('carga')} ancla="end" color="verde" />
    <Et x={376} y={188} t={c.val('carga')} ancla="end" color="verde" peq />
  {/if}
  <path class="hilo" d="M40 260 H390" data-red="0"></path>
</Lienzo>
