<script lang="ts">
  // Schematic «wien» (esquema.ts): the input on the left, R₁ and C₁ in series along the top to the output node, R₂ and
  // C₂ side by side down to ground, the output terminal on the right.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const et2 = (p: string, q: string) => (c.tiene(p) ? c.simT(p) : c.simT(q));
  const val2 = (p: string, q: string) => (c.tiene(p) ? c.val(p) : c.val(q));
</script>

<Lienzo {descripcion} ancho={400} alto={262}>
  <Flujo d="M40 240 V60 H240 V240 Z" {dur} />
  <FuenteCA x={40} y1={240} y2={60} pieza="fuente" nodos={['0', 'in']} />
  <Et x={58} y={176} t={c.val('fuente')} peq />
  <path class="hilo" d="M40 60 H60" data-red="in"></path>
  <R x1={60} y1={60} x2={140} y2={60} color="azul" pieza="r1" />
  <Et x={100} y={40} t={c.rot('r1')} ancla="middle" color="azul" peq />
  <path class="hilo" d="M140 60 H160" data-red="m"></path>
  <C x1={160} y1={60} x2={200} y2={60} color="azul" pieza="c1" />
  <Et x={180} y={30} t={c.rot('c1')} ancla="middle" color="azul" peq />
  <path class="hilo" d="M200 60 H350" data-red="o"></path>
  <circle class="nodo" cx="240" cy="60" r="4.5" data-red="o"></circle>
  <R x1={240} y1={60} x2={240} y2={240} color="naranja" pieza={c.tiene('r2') ? 'r2' : undefined} />
  <Et x={226} y={140} t={et2('r2', 'r1')} ancla="end" color="naranja" peq />
  <Et x={226} y={158} t={val2('r2', 'r1')} ancla="end" color="naranja" peq />
  <circle class="nodo" cx="300" cy="60" r="4.5" data-red="o"></circle>
  <C x1={300} y1={60} x2={300} y2={240} color="naranja" pieza={c.tiene('c2') ? 'c2' : undefined} />
  <Et x={322} y={140} t={et2('c2', 'c1')} color="naranja" peq />
  <Et x={322} y={158} t={val2('c2', 'c1')} color="naranja" peq />
  <circle class="borne" cx="355" cy="60" r="5"></circle>
  <Et x={355} y={44} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M300 240 H40" data-red="0"></path>
</Lienzo>
