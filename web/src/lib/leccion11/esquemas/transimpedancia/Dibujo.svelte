<script lang="ts">
  // Schematic «transimpedancia» (esquema.ts): the current source (arrow up into the − input's node) and C_in on the
  // left, the amplifier with its + input to ground, R_f and, above it, C_f from the output back to the − input.
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import EtiquetasAO from '../kit/EtiquetasAO.svelte';
  import FuenteI from '../kit/FuenteI.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const senal = $derived(c.tiene('amplitud') && c.tiene('f') && c.p('f') > 0);
</script>

<Lienzo {descripcion} ancho={460} alto={310}>
  <FuenteI x={60} y1={290} y2={150} pieza="entrada" nodos={['0', 'm']} />
  <Et x={82} y={206} t={senal ? `${c.val('amplitud')} pico` : c.val('entrada')} peq />
  {#if senal}<Et x={82} y={224} t={c.val('f')} peq />{/if}
  <path class="hilo" d="M60 150 H230" data-red="m"></path>
  {#if c.tiene('cin')}
    <circle class="nodo" cx="140" cy="150" r="4.5" data-red="m"></circle>
    <C x1={140} y1={150} x2={140} y2={290} color="azul" pieza="cin" />
    <Et x={158} y={232} t={c.simT('cin')} color="azul" />
    <Et x={158} y={250} t={c.val('cin')} color="azul" peq />
  {/if}
  <circle class="nodo" cx="190" cy="150" r="4.5" data-red="m"></circle>
  <path class="hilo" d="M190 150 V75 H210" data-red="m"></path>
  <R x1={210} y1={75} x2={320} y2={75} color="naranja" pieza="rf" />
  <Et x={265} y={100} t={c.rot('rf')} ancla="middle" color="naranja" peq />
  {#if c.tiene('cf')}
    <path class="hilo" d="M190 75 V30 H230" data-red="m"></path>
    <circle class="nodo" cx="190" cy="75" r="4.5" data-red="m"></circle>
    <C x1={230} y1={30} x2={300} y2={30} color="naranja" pieza="cf" />
    <!-- (between the plates and R_f: above the plates the label rose out of the drawing's top edge) -->
    <Et x={265} y={60} t={c.rot('cf')} ancla="middle" color="naranja" peq />
    <path class="hilo" d="M300 30 H340 V75" data-red="out"></path>
  {/if}
  <path class="hilo" d="M320 75 H340 V170" data-red="out"></path>
  <circle class="nodo" cx="340" cy="75" r="4.5" data-red="out"></circle>
  <AO x={230} y={170} />
  <path class="hilo" d="M230 190 H215 V290" data-red="0"></path>
  <path class="hilo" d="M290 170 H420" data-red="out"></path>
  <circle class="nodo" cx="340" cy="170" r="4.5" data-red="out"></circle>
  <EtiquetasAO {c} x={300} y={230} ao />
  <circle class="borne" cx="420" cy="170" r="5"></circle>
  <Et x={420} y={154} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M60 290 H420" data-red="0"></path>
  <circle class="borne" cx="420" cy="290" r="5"></circle>
</Lienzo>
