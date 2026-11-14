<script lang="ts">
  // Schematic «puente» (esquema.ts): the AC input on the left, the four diodes as a diamond, the capacitor and the
  // load on the right; the diodes of the positive half cycle in blue, those of the negative one in orange.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const fin = $derived(c.tiene('carga') ? 330 : 260);
  // a diode as a triangle and a bar along the direction (dx, dy) from (x, y), 22 px long
  const diodo = (x: number, y: number, dx: number, dy: number) => {
    const l = Math.hypot(dx, dy);
    const u = [dx / l, dy / l];
    const n = [-u[1]!, u[0]!];
    const P = (a: number, b: number) => `${(x + u[0]! * a + n[0]! * b).toFixed(1)} ${(y + u[1]! * a + n[1]! * b).toFixed(1)}`;
    return { tri: `M${P(0, -9)} L${P(0, 9)} L${P(16, 0)} Z`, barra: `M${P(16, -9)} L${P(16, 9)}` };
  };
  // the diamond: left (90, 140), top (140, 90), right (190, 140), bottom (140, 190)
  const D1 = diodo(107, 123, 1, -1);
  const D2 = diodo(157, 173, 1, -1);
  const D3 = diodo(107, 157, 1, 1);
  const D4 = diodo(157, 107, 1, 1);
</script>

<Lienzo {descripcion} alto={250}>
  <FuenteCA x={30} y1={190} y2={90} pieza="fuente" />
  <Et x={2} y={36} t={`${c.val('fuente')} · ${c.val('f')}`} peq />
  <path class="hilo" d="M30 90 V60 H140 V90 M30 190 V220 H140 V190"></path>
  <path class="pieza azul" d="M90 140 L107 123 M123 107 L140 90 M140 190 L157 173 M173 157 L190 140"></path>
  <path class="pieza naranja" d="M90 140 L107 157 M123 173 L140 190 M140 90 L157 107 M173 123 L190 140"></path>
  <path class="pieza relleno azul" d={D1.tri}></path><path class="pieza azul" d={D1.barra}></path>
  <path class="pieza relleno azul" d={D2.tri}></path><path class="pieza azul" d={D2.barra}></path>
  <path class="pieza relleno naranja" d={D3.tri}></path><path class="pieza naranja" d={D3.barra}></path>
  <path class="pieza relleno naranja" d={D4.tri}></path><path class="pieza naranja" d={D4.barra}></path>
  <!-- (the − rail hops over the input's lower wire: they do not touch) -->
  <path class="hilo" d={`M190 140 H210 V40 H${fin} M90 140 H70 V214 a6 6 0 0 0 0 12 V240 H${fin}`}></path>
  <Et x={140} y={145} t={c.val('vd')} peq ancla="middle" />
  {#if c.tiene('c')}
    <C x1={260} y1={40} x2={260} y2={240} color="naranja" polar pieza="c" />
    <Et x={242} y={150} t={c.val('c')} color="naranja" peq ancla="end" />
  {/if}
  {#if c.tiene('carga')}
    <R x1={330} y1={40} x2={330} y2={240} color="verde" pieza="carga" />
    <Et x={344} y={136} t={c.simT('carga')} color="verde" />
    <Et x={344} y={156} t={c.val('carga')} color="verde" peq />
  {/if}
  <circle class="salida" cx="230" cy="40" r="6"></circle>
  <Et x={230} y={26} t="salida" color="naranja" peq ancla="middle" />
</Lienzo>
