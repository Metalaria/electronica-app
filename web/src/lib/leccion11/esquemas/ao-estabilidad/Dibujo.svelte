<script lang="ts">
  // Schematic «ao-estabilidad» (esquema.ts): the input source on the left to the + input (on top); the amplifier, its
  // output resistance R_o, R_iso, the load C_L and the snubber R_s–C_s along the output line to the right; the feedback
  // from the amplifier's pin (outside the loop) or from the load (inside) back along the bottom through R₂ to the −
  // input, R₁ to ground (a plain wire for the follower).
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import C from '../kit/C.svelte';
  import Entrada from '../kit/Entrada.svelte';
  import Et from '../kit/Et.svelte';
  import EtiquetasAO from '../kit/EtiquetasAO.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const fbx = $derived(c.tiene('riso') && c.cerrado('dentro') ? 390 : 300);
  const nfb = $derived(c.tiene('riso') && c.cerrado('dentro') ? 'out' : 'o');
  const div = $derived(c.tiene('r2'));
  const sub = (s: string, i: string) => [{ t: 'txt' as const, s }, { t: 'sub' as const, s: i }];
  const ao = $derived.by(() => {
    const out: (string | ReturnType<typeof sub>)[] = [`GBW ${c.val('gbw')}`];
    if (c.tiene('polo2')) out.push(sub('f', 'p2').concat([{ t: 'txt', s: ` ${c.val('polo2')}` }]));
    if (c.tiene('a0')) out.push(sub('A', '0').concat([{ t: 'txt', s: ` ${c.val('a0')}` }]));
    return out;
  });
</script>

<Lienzo {descripcion} ancho={560} alto={300}>
  <Entrada {c} x={40} y1={280} y2={110} />
  <EtiquetasAO {c} x={52} y={136} />
  <path class="hilo" d="M40 110 H170" data-red="in"></path>
  <AO x={170} y={130} masArriba />
  {#each ao as t, k (k)}<Et x={200} y={64 + 18 * k} {t} color="verde" peq ancla="middle" />{/each}
  <path class="hilo" d="M170 150 H140 V200" data-red="m"></path>
  <circle class="nodo" cx="140" cy="200" r="4.5" data-red="m"></circle>
  {#if div}
    <R x1={140} y1={200} x2={140} y2={280} color="azul" pieza="r1" />
    <Et x={126} y={236} t={c.simT('r1')} ancla="end" color="azul" />
    <Et x={126} y={254} t={c.val('r1')} ancla="end" color="azul" peq />
    <path class="hilo" d="M140 200 H160" data-red="m"></path>
    <R x1={160} y1={200} x2={260} y2={200} color="naranja" pieza="r2" />
    <Et x={210} y={228} t={c.rot('r2')} ancla="middle" color="naranja" peq />
    <path class="hilo" d={`M260 200 H${fbx} V130`} data-red={nfb}></path>
  {:else}
    <path class="hilo" d={`M140 200 H${fbx} V130`} data-red={nfb}></path>
  {/if}
  {#if c.tiene('rsal')}
    <path class="hilo" d="M230 130 H236" data-red="o1"></path>
    <R x1={236} y1={130} x2={290} y2={130} color="verde" pieza="rsal" />
    <Et x={263} y={112} t={c.rot('rsal')} ancla="middle" color="verde" peq />
    <path class="hilo" d="M290 130 H310" data-red="o"></path>
  {:else}
    <path class="hilo" d="M230 130 H310" data-red="o"></path>
  {/if}
  <circle class="nodo" cx="300" cy="130" r="4.5" data-red="o"></circle>
  {#if c.tiene('riso')}
    <R x1={310} y1={130} x2={370} y2={130} color="azul" pieza="riso" />
    <Et x={340} y={112} t={c.rot('riso')} ancla="middle" color="azul" peq />
    <path class="hilo" d="M370 130 H410" data-red="out"></path>
  {:else}
    <path class="hilo" d="M310 130 H410" data-red="out"></path>
  {/if}
  {#if fbx === 390}<circle class="nodo" cx="390" cy="130" r="4.5" data-red="out"></circle>{/if}
  {#if c.tiene('cl')}
    <circle class="nodo" cx="410" cy="130" r="4.5" data-red="out"></circle>
    <C x1={410} y1={130} x2={410} y2={280} color="naranja" pieza="cl" />
    <Et x={428} y={200} t={c.simT('cl')} color="naranja" />
    <Et x={428} y={218} t={c.val('cl')} color="naranja" peq />
  {/if}
  {#if c.tiene('rsn')}
    <path class="hilo" d="M410 130 H490" data-red="out"></path>
    <R x1={490} y1={130} x2={490} y2={205} color="verde" pieza="rsn" />
    <Et x={504} y={164} t={c.simT('rsn')} color="verde" />
    <Et x={504} y={182} t={c.val('rsn')} color="verde" peq />
    <C x1={490} y1={205} x2={490} y2={280} color="verde" pieza="csn" />
    <Et x={504} y={238} t={c.simT('csn')} color="verde" />
    <Et x={504} y={256} t={c.val('csn')} color="verde" peq />
  {/if}
  <circle class="borne" cx={c.tiene('rsn') ? 490 : 440} cy="130" r="5"></circle>
  {#if !c.tiene('rsn')}<path class="hilo" d="M410 130 H440" data-red="out"></path>{/if}
  <Et x={c.tiene('rsn') ? 490 : 440} y={114} t={sub('v', 'o')} ancla="middle" />
  <path class="hilo" d={`M40 280 H${c.tiene('rsn') ? 490 : 440}`} data-red="0"></path>
</Lienzo>
