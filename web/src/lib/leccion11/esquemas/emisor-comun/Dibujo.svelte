<script lang="ts">
  // Schematic «emisor-comun» (esquema.ts): the signal source on the left with R_S and C_in to the base node; the divider
  // R₁–R₂ from the rail to ground; the NPN with R_C up to the rail and, down to ground, R_E1 (if any) and R_E with the
  // bypass branch (its switch and C_E) on the right; C_out from the collector to the load R_L; V_CC on the far right.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Npn from '../kit/Npn.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const re1 = $derived(c.tiene('re1'));
  // the top of R_E (the emitter itself without R_E1)
  const yE = $derived(re1 ? 245 : 190);
  const ce = $derived(c.tiene('ce'));
  const nE = $derived(re1 ? 'e2' : 'e');
</script>

<Lienzo {descripcion} ancho={460} alto={320}>
  <Flujo d="M440 300 V20 H262 V300 Z" {dur} medidor="vcm" />
  <FuenteCA x={30} y1={300} y2={150} pieza="fuente" nodos={['0', 's0']} />
  <Et x={52} y={206} t={c.val('fuente')} peq />
  <Et x={52} y={224} t={c.val('f')} peq />
  {#if c.tiene('rs')}
    <path class="hilo" d="M30 150 H40" data-red="s0"></path>
    <R x1={40} y1={150} x2={100} y2={150} color="azul" pieza="rs" />
    <Et x={70} y={132} t={c.simT('rs')} ancla="middle" color="azul" peq />
    <Et x={70} y={178} t={c.val('rs')} ancla="middle" color="azul" peq />
  {:else}
    <path class="hilo" d="M30 150 H100" data-red="s0"></path>
  {/if}
  <path class="hilo" d="M100 150 H110" data-red="s"></path>
  <C x1={110} y1={150} x2={150} y2={150} color="azul" pieza="cin" />
  {#if c.tiene('cin')}
    <Et x={130} y={124} t={c.simT('cin')} ancla="middle" color="azul" peq />
    <Et x={130} y={186} t={c.val('cin')} ancla="middle" color="azul" peq />
  {/if}
  <path class="hilo" d="M150 150 H216" data-red="b"></path>
  <circle class="nodo" cx="170" cy="150" r="4.5" data-red="b"></circle>
  <R x1={170} y1={20} x2={170} y2={150} color="azul" pieza="r1" />
  <Et x={156} y={80} t={c.simT('r1')} ancla="end" color="azul" />
  <Et x={156} y={98} t={c.val('r1')} ancla="end" color="azul" peq />
  <R x1={170} y1={150} x2={170} y2={300} color="azul" pieza="r2" />
  <Et x={156} y={232} t={c.simT('r2')} ancla="end" color="azul" />
  <Et x={156} y={250} t={c.val('r2')} ancla="end" color="azul" peq />
  <Npn x={250} y={150} />
  <Et x={196} y={136} t={`β ${c.val('beta')}`} peq ancla="middle" />
  <R x1={262} y1={20} x2={262} y2={110} color="naranja" pieza="rc" />
  <Et x={276} y={60} t={c.rot('rc')} color="naranja" peq />
  {#if re1}
    <R x1={262} y1={190} x2={262} y2={245} color="verde" pieza="re1" />
    <Et x={248} y={222} t={c.rot('re1')} ancla="end" color="verde" peq />
  {/if}
  <R x1={262} y1={yE} x2={262} y2={300} color="verde" pieza="re" />
  <Et x={248} y={yE + 38} t={c.simT('re')} ancla="end" color="verde" />
  <Et x={248} y={yE + 56} t={c.val('re')} ancla="end" color="verde" peq />
  {#if ce}
    <circle class="nodo" cx="262" cy={yE} r="4.5" data-red={nE}></circle>
    {#if c.tiene('desvio')}
      <path class="hilo" d={`M262 ${yE} H275`} data-red={nE}></path>
      <Interruptor x1={275} y1={yE} x2={315} y2={yE} cerrado={c.cerrado('desvio')} color="verde" pieza="desvio" />
      <path class="hilo" d={`M315 ${yE} H330`} data-red={c.cerrado('desvio') ? nE : undefined}></path>
    {:else}
      <path class="hilo" d={`M262 ${yE} H330`} data-red={nE}></path>
    {/if}
    <C x1={330} y1={yE} x2={330} y2={300} color="verde" pieza="ce" polar />
    <Et x={350} y={yE + 30} t={c.simT('ce')} color="verde" peq />
    <Et x={350} y={yE + 48} t={c.val('ce')} color="verde" peq />
  {/if}
  <path class="hilo" d="M262 110 H330" data-red="c"></path>
  <C x1={330} y1={110} x2={370} y2={110} color="naranja" pieza="cout" />
  {#if c.tiene('cout')}
    <Et x={350} y={84} t={c.simT('cout')} ancla="middle" color="naranja" peq />
    <Et x={350} y={146} t={c.val('cout')} ancla="middle" color="naranja" peq />
  {/if}
  <path class="hilo" d="M370 110 H400" data-red="out"></path>
  <circle class="borne" cx="400" cy="110" r="5"></circle>
  <Et x={400} y={94} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  {#if c.tiene('carga')}
    <R x1={400} y1={110} x2={400} y2={300} color="naranja" pieza="carga" />
    <Et x={386} y={196} t={c.simT('carga')} ancla="end" color="naranja" />
    <Et x={386} y={214} t={c.val('carga')} ancla="end" color="naranja" peq />
  {/if}
  <path class="hilo" d="M170 20 H440" data-red="vcc"></path>
  <Pila x={440} y1={300} y2={20} pieza="vcc" nodos={['0', 'vcc']} />
  <Et x={426} y={60} t={c.val('vcc')} ancla="end" peq />
  <path class="hilo" d="M30 300 H440" data-red="0"></path>
</Lienzo>
