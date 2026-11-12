<script lang="ts">
  // Schematic «rectificador-toma-media» (esquema.ts): the mains and the transformer on the left, its secondary's centre
  // tap to ground; the bridge as a diamond (as in «puente»: the halves' ends at the top and bottom corners, the
  // negative rail from the left corner, the positive one from the right); on the right, the positive rail at the top
  // and the negative at the bottom with their capacitors to the ground rail between them, the regulators (if any) and
  // each rail's load. Ground is drawn with its symbol at the tap and on the rail. No current particles (as «puente»).
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import FuenteI from '../kit/FuenteI.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  import Trafo from '../kit/Trafo.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const reg = $derived(c.tiene('reg'));
  // the loads' column: after the regulators when there are any
  const xc = $derived(reg ? 450 : 380);
  // a resistor and a constant current together: the current source 40 units further right
  const ambos = $derived(c.tiene('carga') && c.tiene('i'));
  const xf = $derived(ambos ? xc + 40 : xc);
  // (the current's label sits right of its source's circle)
  const ancho = $derived(xf + (c.tiene('i') ? 80 : 60));
  // a diode as a triangle and a bar along (dx, dy) from (x, y), 22 units long (as in «puente»)
  const diodo = (x: number, y: number, dx: number, dy: number) => {
    const l = Math.hypot(dx, dy);
    const u = [dx / l, dy / l];
    const n = [-u[1]!, u[0]!];
    const P = (a: number, b: number) => `${(x + u[0]! * a + n[0]! * b).toFixed(1)} ${(y + u[1]! * a + n[1]! * b).toFixed(1)}`;
    return { tri: `M${P(0, -9)} L${P(0, 9)} L${P(16, 0)} Z`, barra: `M${P(16, -9)} L${P(16, 9)}` };
  };
  // the diamond: left (170, 150) the negative rail, top (220, 100) the upper end, right (270, 150) the positive rail,
  // bottom (220, 200) the lower end
  const Dna = diodo(187, 133, 1, -1);
  const Dbp = diodo(237, 183, 1, -1);
  const Dnb = diodo(187, 167, 1, 1);
  const Dap = diodo(237, 117, 1, 1);
  // a ground symbol hanging from (x, y)
  const masa = (x: number, y: number) => `M${x} ${y} V${y + 10} M${x - 10} ${y + 10} H${x + 10} M${x - 6} ${y + 15} H${x + 6} M${x - 2} ${y + 20} H${x + 2}`;
</script>

<Lienzo {descripcion} {ancho} alto={300}>
  <FuenteCA x={24} y1={220} y2={80} pieza="fuente" />
  <path class="hilo" d="M24 80 H60 M24 220 H60"></path>
  <Trafo x1={60} x2={110} y1={80} y2={220} />
  <Et x={2} y={36} t={`± ${c.val('fuente')} · ${c.val('f')}`} peq />
  <!-- the centre tap to ground -->
  <path class="hilo" d={`M112 150 H130 ${masa(130, 150)}`}></path>
  <!-- the halves' ends to the diamond's top and bottom corners -->
  <path class="hilo" d="M110 80 V60 H220 V100 M110 220 V240 H220 V200"></path>
  <path class="pieza azul" d="M170 150 L187 133 M203 117 L220 100 M220 200 L237 183 M253 167 L270 150"></path>
  <path class="pieza naranja" d="M170 150 L187 167 M203 183 L220 200 M220 100 L237 117 M253 133 L270 150"></path>
  <path class="pieza relleno azul" d={Dna.tri}></path><path class="pieza azul" d={Dna.barra}></path>
  <path class="pieza relleno azul" d={Dbp.tri}></path><path class="pieza azul" d={Dbp.barra}></path>
  <path class="pieza relleno naranja" d={Dnb.tri}></path><path class="pieza naranja" d={Dnb.barra}></path>
  <path class="pieza relleno naranja" d={Dap.tri}></path><path class="pieza naranja" d={Dap.barra}></path>
  <Et x={220} y={155} t={c.val('vd')} peq ancla="middle" />
  <!-- the rails: + from the right corner up to y = 40, − from the left corner down to y = 260 (hopping the lower end's
       wire); the ground rail between them -->
  <path class="hilo" d={`M270 150 H285 V40 H${reg ? 345 : xc}`}></path>
  <path class="hilo" d={`M170 150 H150 V234 a6 6 0 0 0 0 12 V260 H${reg ? 345 : xc}`}></path>
  <!-- (the ground rail joins the capacitors; its symbol hangs left of the loads) -->
  <path class="hilo" d={`M320 150 H${xf} ${masa(xc - 30, 150)}`}></path>
  <circle class="nodo" cx="320" cy="150" r="4.5"></circle>
  {#if ambos}<path class="hilo" d={`M${xc} 40 H${xf} M${xc} 260 H${xf}`}></path>{/if}
  {#if c.tiene('c')}
    <C x1={320} y1={40} x2={320} y2={150} color="naranja" polar pieza="c" />
    <C x1={320} y1={150} x2={320} y2={260} color="naranja" polar pieza="c" />
    <Et x={304} y={226} t={c.val('c')} color="naranja" peq ancla="end" />
  {/if}
  {#if reg}
    <!-- the regulators: a box on each rail, its ground pin to ground -->
    <rect class="pieza" x="345" y="26" width="50" height="28" rx="3" data-pieza="reg"></rect>
    <rect class="pieza" x="345" y="246" width="50" height="28" rx="3"></rect>
    <Et x={370} y={45} t={`+${c.val('reg')}`} peq ancla="middle" />
    <Et x={370} y={265} t={`−${c.val('reg')}`} peq ancla="middle" />
    <path class="hilo" d={`M370 54 V70 ${masa(370, 70)} M370 246 V200 ${masa(370, 200)}`}></path>
    <path class="hilo" d={`M395 40 H${xc} M395 260 H${xc}`}></path>
    {#if c.tiene('dropout')}<Et x={370} y={18} t={`${c.val('dropout')} dropout`} peq ancla="middle" />{/if}
  {/if}
  {#if c.tiene('carga')}
    <R x1={xc} y1={40} x2={xc} y2={150} color="verde" pieza="carga" />
    <R x1={xc} y1={150} x2={xc} y2={260} color="verde" pieza="carga" />
    <Et x={xc + 14} y={100} t={c.val('carga')} color="verde" peq />
  {/if}
  {#if c.tiene('i')}
    <FuenteI x={xf} y1={40} y2={150} pieza="i" />
    <FuenteI x={xf} y1={150} y2={260} pieza="i" />
    <Et x={xf + 22} y={100} t={c.val('i')} color="verde" peq />
  {/if}
  <circle class="salida" cx={xc - 20} cy="40" r="6"></circle>
  <Et x={xc - 20} y={26} t="+V" color="naranja" peq ancla="middle" />
  <circle class="salida" cx={xc - 20} cy="260" r="6"></circle>
  <Et x={xc - 20} y={286} t="−V" color="naranja" peq ancla="middle" />
</Lienzo>
