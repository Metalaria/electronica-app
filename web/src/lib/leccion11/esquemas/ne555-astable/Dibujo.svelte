<script lang="ts">
  // Schematic «ne555-astable» (esquema.ts): V_CC on the left and its rail along the top; R_a, R_b and C in a column;
  // the chip as a box: the discharge transistor under the DIS pin (its emitter to the chip's ground), the flip-flop
  // that drives it, the threshold comparator (⅔ V_CC) and the trigger comparator (⅓ V_CC) on the left edge, wired to
  // the capacitor, and the output on the right.
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Npn from '../kit/Npn.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} ancho={500} alto={300}>
  <path class="flujo" d="M30 290 V20 H80 V290 Z" style:animation-duration={`${dur.toFixed(2)}s`} data-medidor="vmb"></path>
  <Pila x={30} y1={290} y2={20} pieza="vcc" nodos={['0', 'vcc']} />
  <Et x={44} y={196} t={c.val('vcc')} peq />
  <path class="hilo" d="M30 20 H380 V50" data-red="vcc"></path>
  <R x1={80} y1={20} x2={80} y2={80} color="azul" pieza="ra" />
  <Et x={94} y={44} t={c.simT('ra')} color="azul" peq />
  <Et x={94} y={60} t={c.val('ra')} color="azul" peq />
  <circle class="nodo" cx="80" cy="80" r="4.5" data-red="dis"></circle>
  <path class="hilo" d="M80 80 H140 V36 H342 V50" data-red="dis"></path>
  <R x1={80} y1={80} x2={80} y2={155} color="azul" pieza="rb" />
  <Et x={94} y={102} t={c.simT('rb')} color="azul" peq />
  <Et x={94} y={118} t={c.val('rb')} color="azul" peq />
  <circle class="nodo" cx="80" cy="155" r="4.5" data-red="c"></circle>
  <path class="hilo" d="M80 155 H130 M130 130 V180 M130 130 H180 M130 180 H180" data-red="c"></path>
  <circle class="nodo" cx="130" cy="155" r="4.5" data-red="c"></circle>
  <C x1={80} y1={155} x2={80} y2={290} color="naranja" pieza="c" />
  <Et x={100} y={226} t={c.simT('c')} color="naranja" peq />
  <Et x={100} y={242} t={c.val('c')} color="naranja" peq />
  <path class="hilo" d="M30 290 H300 V270" data-red="0"></path>
  <!-- the chip -->
  <rect class="cuerpo" x="150" y="50" width="290" height="220" rx="8"></rect>
  <Et x={430} y={262} t="555" ancla="end" peq />
  <Et x={348} y={64} t="DIS" peq />
  <Et x={384} y={64} t="VCC" peq />
  <!-- the threshold comparator: + from the capacitor, − at ⅔ V_CC; the trigger one: − from the capacitor, + at ⅓ V_CC -->
  <AO x={180} y={110} />
  <path class="hilo fino" d="M166 90 H180"></path>
  <Et x={164} y={94} t="⅔" ancla="end" peq />
  <AO x={180} y={200} />
  <path class="hilo fino" d="M166 220 H180"></path>
  <Et x={164} y={224} t="⅓" ancla="end" peq />
  <!-- the flip-flop: R from the threshold comparator, S from the trigger one; Q̄ drives the discharge transistor -->
  <rect class="cuerpo" x="246" y="80" width="40" height="80" rx="4"></rect>
  <path class="hilo fino" d="M240 110 H246 M240 200 H266 V160"></path>
  <Et x={250} y={96} t="R" peq />
  <Et x={252} y={152} t="S" peq />
  <Et x={278} y={96} t="Q̄" ancla="end" peq />
  <path class="hilo fino" d="M286 90 H296"></path>
  <Npn x={330} y={90} />
  <path class="hilo fino" d="M342 130 V140 M334 140 H350 M337 144 H347 M340 148 H344"></path>
  <Et x={278} y={136} t="Q" ancla="end" peq />
  <path class="hilo" d="M286 130 H300 V170 H470" data-red="out"></path>
  <circle class="borne" cx="470" cy="170" r="5"></circle>
  <Et x={470} y={154} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
</Lienzo>
