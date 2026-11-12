<script lang="ts">
  // Schematic «paralelo» (esquema.ts): the first 1.1 engine's drawing, unchanged. Each branch's current moves at the
  // speed of its own bar when the bars are currents (the split), else at the widget's «corriente».
  import type { PropsDibujo } from '../dibujos';
  import Lienzo from '../kit/Lienzo.svelte';
  let { c, widget, vuelta, descripcion }: PropsDibujo = $props();
  const durRama = (k: 0 | 1) => {
    const b = widget.barras?.[k];
    return vuelta(b && c.unidad(b.valor) === 'A' ? c.n(b.valor) : widget.corriente ? c.n(widget.corriente) : undefined);
  };
  /** 1.2: the branch's current for the living circuit (A, signed), as the speed above. */
  const iRama = (k: 0 | 1) => {
    const b = widget.barras?.[k];
    return b && c.unidad(b.valor) === 'A' ? c.n(b.valor) : widget.corriente ? c.n(widget.corriente) : undefined;
  };
  const zig = (x: number) => `M${x} 30 V78 l9 3.5 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l18 7 l-18 7 l9 3.5 V220`;
</script>

<Lienzo {descripcion}>
  <path class="flujo" d="M50 220 V30 H170 V220 Z" style:animation-duration={`${durRama(0).toFixed(2)}s`} data-i={iRama(0)} data-medidor="v1"></path>
  <path class="flujo" d="M50 220 V30 H300 V220 Z" style:animation-duration={`${durRama(1).toFixed(2)}s`} data-i={iRama(1)} data-medidor="v2"></path>
  <path class="hilo" d="M50 220 V133" data-red="0"></path>
  <path class="hilo" d="M50 117 V30 H300" data-red="fte"></path>
  <g data-pieza="fuente"><path class="hilo" d="M34 117 H66"></path>
  <path class="hilo gordo" d="M42 127 H58"></path></g>
  <text x="2" y="150" class="et tinta">{c.val('fuente')}</text>
  <path class="pieza azul" d={zig(170)} data-pieza="r1"></path>
  <text x="186" y="120" class="et azul">{c.sim('r1')}</text>
  <text x="186" y="140" class="et azul peq">{c.val('r1')}</text>
  <path class="pieza naranja" d={zig(300)} data-pieza="r2"></path>
  <text x="316" y="120" class="et naranja">{c.sim('r2')}</text>
  <text x="316" y="140" class="et naranja peq">{c.val('r2')}</text>
  <path class="hilo" d="M300 220 H50" data-red="0"></path>
  <circle cx="170" cy="30" r="4.5" class="nodo" data-red="fte"></circle>
  <circle cx="170" cy="220" r="4.5" class="nodo" data-red="0"></circle>
</Lienzo>
