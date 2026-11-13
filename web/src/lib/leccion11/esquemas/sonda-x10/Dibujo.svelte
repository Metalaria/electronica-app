<script lang="ts">
  // Schematic «sonda-x10» (esquema.ts): the calibration square on the left, the tip's R₁ ∥ C₁ along the top (R₁ on
  // the wire, C₁ on a branch above it), the scope's R₂ and C₂ (the trimmer, an arrow across it) side by side down to
  // ground on the right, the scope terminal v_o.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} ancho={440} alto={270}>
  <FuenteCA x={40} y1={250} y2={110} pieza="entrada" nodos={['0', 'in']} />
  <Et x={64} y={176} t={`${c.val('entrada')} ⊓`} peq />
  <Et x={64} y={194} t={c.val('f')} peq />
  <path class="hilo" d="M40 110 H140 M120 110 V50 H170" data-red="in"></path>
  <circle class="nodo" cx="120" cy="110" r="4.5" data-red="in"></circle>
  <R x1={140} y1={110} x2={240} y2={110} color="azul" pieza="r1" />
  <Et x={190} y={140} t={c.rot('r1')} ancla="middle" color="azul" peq />
  <C x1={170} y1={50} x2={210} y2={50} color="azul" pieza="c1" />
  <Et x={190} y={24} t={c.rot('c1')} ancla="middle" color="azul" peq />
  <path class="hilo" d="M210 50 H260 V110 M240 110 H400" data-red="out"></path>
  <circle class="nodo" cx="260" cy="110" r="4.5" data-red="out"></circle>
  <circle class="nodo" cx="290" cy="110" r="4.5" data-red="out"></circle>
  <R x1={290} y1={110} x2={290} y2={250} color="naranja" pieza="r2" />
  <Et x={276} y={176} t={c.simT('r2')} ancla="end" color="naranja" />
  <Et x={276} y={194} t={c.val('r2')} ancla="end" color="naranja" peq />
  <circle class="nodo" cx="350" cy="110" r="4.5" data-red="out"></circle>
  <C x1={350} y1={110} x2={350} y2={250} color="naranja" variable pieza="c2" />
  <Et x={380} y={176} t={c.simT('c2')} color="naranja" />
  <Et x={380} y={194} t={c.val('c2')} color="naranja" peq />
  <circle class="borne" cx="400" cy="110" r="5"></circle>
  <Et x={400} y={94} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M40 250 H350" data-red="0"></path>
</Lienzo>
