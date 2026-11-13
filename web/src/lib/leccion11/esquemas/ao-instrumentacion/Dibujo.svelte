<script lang="ts">
  // Schematic «ao-instrumentacion» (esquema.ts): U₁ on top (input v₁ on its + input) and U₂ below (v₂), their − inputs
  // joined through R_G down the middle-left, each R from its output back to its − input; U₃ on the right with R₃ from
  // each buffer, R₄ over it to the output and R₄ under it to the reference (a battery, or ground).
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import Et from '../kit/Et.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const senal = $derived((c.tiene('ad') || c.tiene('acm')) && c.p('f') > 0);
  const sub = (s: string, i: string) => [{ t: 'txt' as const, s }, { t: 'sub' as const, s: i }];
</script>

<Lienzo {descripcion} ancho={520} alto={360}>
  {#if senal}
    <FuenteCA x={40} y1={340} y2={60} pieza="v1" nodos={['0', 'in1']} />
    <FuenteCA x={84} y1={340} y2={260} pieza="v2" nodos={['0', 'in2']} />
  {:else}
    <Pila x={40} y1={340} y2={60} pieza="v1" nodos={['0', 'in1']} />
    <Pila x={84} y1={340} y2={260} pieza="v2" nodos={['0', 'in2']} />
  {/if}
  <Et x={48} y={44} t={[...sub('v', '1'), { t: 'txt', s: ` ${c.val('v1')}` }]} color="azul" peq />
  <Et x={108} y={330} t={[...sub('v', '2'), { t: 'txt', s: ` ${c.val('v2')}` }]} color="azul" peq />
  <path class="hilo" d="M40 60 H150" data-red="in1"></path>
  <path class="hilo" d="M84 260 H150" data-red="in2"></path>
  <AO x={150} y={80} masArriba />
  <AO x={150} y={240} />
  <Et x={180} y={30} t={sub('U', '1')} ancla="middle" peq />
  <Et x={180} y={296} t={sub('U', '2')} ancla="middle" peq />
  <!-- the gain network -->
  <path class="hilo" d="M150 100 H120 V130 H130" data-red="n1"></path>
  <path class="hilo" d="M150 220 H120 V190 H130" data-red="n2"></path>
  <circle class="nodo" cx="120" cy="130" r="4.5" data-red="n1"></circle>
  <circle class="nodo" cx="120" cy="190" r="4.5" data-red="n2"></circle>
  <R x1={120} y1={130} x2={120} y2={190} color="verde" pieza="rg" />
  <Et x={106} y={156} t={c.simT('rg')} ancla="end" color="verde" />
  <Et x={106} y={174} t={c.val('rg')} ancla="end" color="verde" peq />
  <R x1={130} y1={130} x2={210} y2={130} color="naranja" pieza="r" />
  <R x1={130} y1={190} x2={210} y2={190} color="naranja" />
  <path class="hilo" d="M210 130 H230 V80" data-red="o1"></path>
  <path class="hilo" d="M210 190 H230 V240" data-red="o2"></path>
  <Et x={238} y={112} t={c.rot('r')} color="naranja" peq />
  <Et x={238} y={218} t={c.rot('r')} color="naranja" peq />
  <path class="hilo" d="M210 80 H260" data-red="o1"></path>
  <path class="hilo" d="M210 240 H260" data-red="o2"></path>
  <circle class="nodo" cx="230" cy="80" r="4.5" data-red="o1"></circle>
  <circle class="nodo" cx="230" cy="240" r="4.5" data-red="o2"></circle>
  <!-- the difference amplifier -->
  <R x1={260} y1={80} x2={330} y2={80} color="azul" pieza="r3" />
  <Et x={295} y={62} t={c.rot('r3')} ancla="middle" color="azul" peq />
  <R x1={260} y1={240} x2={330} y2={240} color="azul" />
  <Et x={295} y={268} t={c.rot('r3')} ancla="middle" color="azul" peq />
  <path class="hilo" d="M330 80 H345 V140 H360" data-red="m3"></path>
  <circle class="nodo" cx="345" cy="80" r="4.5" data-red="m3"></circle>
  <path class="hilo" d="M345 80 V40 H360" data-red="m3"></path>
  <R x1={360} y1={40} x2={440} y2={40} color="naranja" pieza="r4" />
  <Et x={400} y={24} t={c.rot('r4')} ancla="middle" color="naranja" peq />
  <path class="hilo" d="M440 40 H450 V160" data-red="out"></path>
  <AO x={360} y={160} />
  <Et x={390} y={214} t={sub('U', '3')} ancla="middle" peq />
  <path class="hilo" d="M330 240 H345 V180 H360" data-red="p3"></path>
  <circle class="nodo" cx="345" cy="240" r="4.5" data-red="p3"></circle>
  <R x1={345} y1={240} x2={345} y2={300} color="naranja" />
  <Et x={359} y={270} t={c.tiene('desajuste') && c.p('desajuste') ? [...sub('R', '4'), { t: 'txt', s: ` (1 + ${c.val('desajuste')})` }] : sub('R', '4')} color="naranja" peq />
  {#if c.tiene('ref')}
    <Pila x={345} y1={340} y2={300} pieza="ref" nodos={['0', 'rf']} />
    <Et x={363} y={326} t={[...sub('V', 'ref'), { t: 'txt', s: ` ${c.val('ref')}` }]} peq />
  {:else}
    <path class="hilo" d="M345 300 V340" data-red="0"></path>
  {/if}
  <path class="hilo" d="M420 160 H490" data-red="out"></path>
  <circle class="nodo" cx="450" cy="160" r="4.5" data-red="out"></circle>
  <circle class="borne" cx="490" cy="160" r="5"></circle>
  <Et x={490} y={144} t={sub('v', 'o')} ancla="middle" />
  <path class="hilo" d="M40 340 H490" data-red="0"></path>
  <circle class="borne" cx="490" cy="340" r="5"></circle>
</Lienzo>
