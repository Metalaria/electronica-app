<script lang="ts">
  // Schematic «muestreo-retencion» (esquema.ts): the input source on the left, the switch (closed while sampling) with
  // its R_on, the hold capacitor C_h down from the node, the leakage as a current source beside it, and the follower.
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import C from '../kit/C.svelte';
  import Entrada from '../kit/Entrada.svelte';
  import Et from '../kit/Et.svelte';
  import EtiquetasAO from '../kit/EtiquetasAO.svelte';
  import FuenteI from '../kit/FuenteI.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const tm: import('../../tipos').Texto = [{ t: 'txt', s: 'hasta t' }, { t: 'sub', s: 'm' }];
</script>

<Lienzo {descripcion} ancho={460} alto={260}>
  <path class="flujo" d="M40 240 V110 H160 V240 Z" style:animation-duration={`${dur.toFixed(2)}s`}></path>
  <Entrada {c} x={40} y1={240} y2={110} />
  <EtiquetasAO {c} x={64} y={170} />
  <path class="hilo" d="M40 110 H80" data-red="in"></path>
  <Interruptor x1={80} y1={110} x2={140} y2={110} cerrado color="azul" pieza="ron" />
  <Et x={110} y={84} t={c.rot('ron')} ancla="middle" color="azul" peq />
  <Et x={110} y={140} t={tm} ancla="middle" peq />
  {#if c.tiene('carga')}<Et x={110} y={60} t={`Q ${c.val('carga')}`} ancla="middle" peq />{/if}
  <path class="hilo" d="M140 110 H250" data-red="c"></path>
  <circle class="nodo" cx="160" cy="110" r="4.5" data-red="c"></circle>
  <C x1={160} y1={110} x2={160} y2={240} color="naranja" pieza="ch" />
  <Et x={136} y={170} t={c.simT("ch")} color="naranja" peq ancla="end" />
  <Et x={136} y={188} t={c.val("ch")} color="naranja" peq ancla="end" />
  {#if c.tiene('fuga')}
    <circle class="nodo" cx="210" cy="110" r="4.5" data-red="c"></circle>
    <FuenteI x={210} y1={110} y2={240} pieza="fuga" nodos={['c', '0']} />
    <Et x={232} y={222} t={`I ${c.val('fuga')}`} peq />
  {/if}
  <AO x={250} y={130} masArriba />
  <path class="hilo" d="M250 150 H240 V200 H330 V130" data-red="out"></path>
  <circle class="nodo" cx="330" cy="130" r="4.5" data-red="out"></circle>
  <path class="hilo" d="M310 130 H420" data-red="out"></path>
  <EtiquetasAO {c} x={346} y={190} ao />
  <circle class="borne" cx="420" cy="130" r="5"></circle>
  <Et x={420} y={114} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M40 240 H420" data-red="0"></path>
  <circle class="borne" cx="420" cy="240" r="5"></circle>
</Lienzo>
