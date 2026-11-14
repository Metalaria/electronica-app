<script lang="ts">
  // Schematic «cristal» (esquema.ts): the crystal's symbol on the left (a slab between two plates) and what it stands
  // for on the right — the two terminals, C₀ down the middle and the motional branch R₁, L₁, C₁ down the right side.
  // The impedance is measured between the terminals (Z).
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import L from '../kit/L.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} ancho={420} alto={262}>
  <!-- the symbol: the slab between two plates, and «=» to the model -->
  <g data-cuerpo="22 100 58 160">
    <path class="pieza" d="M40 70 V100 M40 160 V190 M24 110 H56 M24 150 H56"></path>
    <rect class="pieza" x="30" y="117" width="20" height="26" fill="none"></rect>
  </g>
  <Et x={40} y={214} t="cuarzo" ancla="middle" peq />
  <Et x={86} y={136} t="=" ancla="middle" />
  <circle class="borne" cx="130" cy="60" r="5"></circle>
  <circle class="borne" cx="130" cy="240" r="5"></circle>
  <Et x={118} y={154} t="Z" ancla="end" />
  <path class="hilo" d="M135 60 H320" data-red="zx"></path>
  <path class="hilo" d="M135 240 H320" data-red="0"></path>
  <circle class="nodo" cx="200" cy="60" r="4.5" data-red="zx"></circle>
  <circle class="nodo" cx="200" cy="240" r="4.5" data-red="0"></circle>
  <C x1={200} y1={60} x2={200} y2={240} color="azul" pieza="c0" />
  <Et x={186} y={140} t={c.simT('c0')} ancla="end" color="azul" peq />
  <Et x={186} y={158} t={c.val('c0')} ancla="end" color="azul" peq />
  <R x1={320} y1={60} x2={320} y2={120} color="naranja" pieza="r1" />
  <Et x={334} y={94} t={c.rot('r1')} color="naranja" peq />
  <L x1={320} y1={120} x2={320} y2={180} color="naranja" pieza="l1" />
  <Et x={334} y={154} t={c.rot('l1')} color="naranja" peq />
  <C x1={320} y1={180} x2={320} y2={240} color="naranja" pieza="c1" />
  <Et x={334} y={214} t={c.rot('c1')} color="naranja" peq />
</Lienzo>
