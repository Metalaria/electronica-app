<script lang="ts">
  // Schematic «sallen-key» (esquema.ts): the sine source on the left, R₁ and R₂ along the signal row to the + input,
  // C₁ up from their junction to the wire that comes back from the output, C₂ down from the + input to ground, the
  // operational amplifier as a follower (its − input on the output) and the output terminal on the right.
  import type { Texto } from '../../tipos';
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const vo: Texto = [{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }];
</script>

<Lienzo {descripcion} ancho={460} alto={260}>
  <FuenteCA x={40} y1={240} y2={150} pieza="fuente" />
  <Et x={64} y={192} t={c.val('fuente')} peq />
  <Et x={64} y={212} t={c.val('f')} peq />
  <path class="hilo" d="M40 150 H60"></path>
  <R x1={60} y1={150} x2={150} y2={150} color="azul" pieza="r1" />
  <Et x={105} y={130} t={c.rot('r1')} ancla="middle" color="azul" />
  <path class="hilo" d="M150 150 H190"></path>
  <circle class="nodo" cx="170" cy="150" r="4.5"></circle>
  <R x1={190} y1={150} x2={280} y2={150} color="azul" pieza="r2" />
  <Et x={235} y={130} t={c.rot('r2')} ancla="middle" color="azul" />
  <path class="hilo" d="M280 150 H310"></path>
  <circle class="nodo" cx="300" cy="150" r="4.5"></circle>
  <!-- C₁: from the junction of R₁ and R₂ to the output (the positive feedback) -->
  <C x1={170} y1={150} x2={170} y2={40} color="naranja" pieza="c1" />
  <Et x={190} y={92} t={c.simT('c1')} color="naranja" />
  <Et x={190} y={110} t={c.val('c1')} color="naranja" peq />
  <path class="hilo" d="M170 40 H400 V130"></path>
  <!-- C₂: from the + input to ground -->
  <C x1={300} y1={150} x2={300} y2={240} color="naranja" pieza="c2" />
  <Et x={286} y={192} t={c.simT('c2')} color="naranja" ancla="end" />
  <Et x={286} y={212} t={c.val('c2')} color="naranja" peq ancla="end" />
  <!-- the follower: its − input on the output -->
  <AO x={310} y={130} pieza={c.tiene('gbw') ? 'gbw' : undefined} />
  <path class="hilo" d="M400 70 H295 V110 H310"></path>
  <circle class="nodo" cx="400" cy="70" r="4.5"></circle>
  {#if c.tiene('gbw')}<Et x={318} y={196} t={c.rot('gbw')} color="verde" peq />{/if}
  {#if c.tiene('rsal')}<Et x={318} y={214} t={c.rot('rsal')} color="verde" peq />{/if}
  <path class="hilo" d="M370 130 H440"></path>
  <circle class="nodo" cx="400" cy="130" r="4.5"></circle>
  <circle class="borne" cx="440" cy="130" r="5"></circle>
  <Et x={440} y={114} t={vo} ancla="middle" />
  <path class="hilo" d="M40 240 H440"></path>
  <circle class="nodo" cx="300" cy="240" r="4.5"></circle>
  <circle class="borne" cx="440" cy="240" r="5"></circle>
</Lienzo>
