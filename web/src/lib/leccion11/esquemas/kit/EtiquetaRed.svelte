<script lang="ts">
  // 1.2 schematic kit (esquemas12c; sección 11.6): a net label — a flag with the net's name whose tip is the wire's end
  // at (x, y), pointing left (`hacia` «izquierda», the flag to its right) or right. Two flags with the same name are the
  // same node; a misspelt one («SALDA») is another, unconnected. The flag is a body (data-cuerpo): wires end at its tip
  // and particles keep out; `pieza` makes it a switch of the living circuit (a tap «writes it right» or wrong).
  let { x, y, texto, hacia = 'izquierda', color = 'tinta', pieza, red }: { x: number; y: number; texto: string; hacia?: 'izquierda' | 'derecha'; color?: string; pieza?: string; red?: string } = $props();
  // (13 px labels: about 7,6 units a capital letter, small caps included)
  const w = $derived(Math.max(24, 7.8 * [...texto].length + 8));
  const s = $derived(hacia === 'izquierda' ? 1 : -1);
  const pts = $derived(`${x},${y} ${x + 9 * s},${y - 10} ${x + (9 + w) * s},${y - 10} ${x + (9 + w) * s},${y + 10} ${x + 9 * s},${y + 10}`);
  const caja = $derived(`${Math.min(x, x + (9 + w) * s)} ${y - 10} ${Math.max(x, x + (9 + w) * s)} ${y + 10}`);
</script>

<g data-pieza={pieza} data-cuerpo={caja} data-red-etiqueta={red}>
<polygon class={`pieza fina ${color}`} points={pts}></polygon>
<text class={`et peq ${color}`} x={x + (9 + w / 2) * s} y={y + 4.5} text-anchor="middle">{texto}</text>
</g>
