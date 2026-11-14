<script lang="ts">
  // 1.1 schematic kit: a transformer between y1 (top) and y2 (bottom): the primary winding at x1 (bulging right),
  // the secondary at x2 (bulging left), the core between them.
  let { x1, x2, y1, y2 }: { x1: number; x2: number; y1: number; y2: number } = $props();
  const vueltas = (x: number, s: 0 | 1) => {
    const h = (y2 - y1) / 4;
    let d = `M${x} ${y1}`;
    for (let k = 1; k <= 4; k++) d += ` A${h / 2} ${h / 2} 0 0 ${s} ${x} ${y1 + h * k}`;
    return d;
  };
  const c = $derived((x1 + x2) / 2);
</script>

<!-- (1.2: data-cuerpo, each winding's box, kept clear of the living circuit's particles) -->
<path class="pieza azul" d={vueltas(x1, 1)} data-cuerpo={`${x1 - 2} ${y1} ${x1 + (y2 - y1) / 8 + 2} ${y2}`}></path>
<path class="pieza naranja" d={vueltas(x2, 0)} data-cuerpo={`${x2 - (y2 - y1) / 8 - 2} ${y1} ${x2 + 2} ${y2}`}></path>
<path class="hilo" d={`M${c - 4} ${y1 - 4} V${y2 + 4} M${c + 4} ${y1 - 4} V${y2 + 4}`}></path>
