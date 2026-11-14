<script lang="ts">
  // 1.1 schematic kit: an inductor (four turns), leads included.
  import { cajaCuerpo, camino, cuerpo, ejes, en } from './geometria';
  let { x1, y1, x2, y2, color = 'tinta', pieza }: { x1: number; y1: number; x2: number; y2: number; color?: string; pieza?: string } = $props();
  // (1.2: the turns' box — they bulge to one side, 6 units — kept clear of the living circuit's particles)
  const caja = $derived.by(() => {
    const { a, b } = cuerpo(x1, y1, x2, y2, 48);
    return cajaCuerpo(x1, y1, x2, y2, a, b, 7);
  });
  const d = $derived.by(() => {
    const { a, b, l } = cuerpo(x1, y1, x2, y2, 48);
    const { n } = ejes(x1, y1, x2, y2);
    // arcs bulge to the left of the direction of travel (sweep chosen by the normal's sign)
    const barrido = n[0] + n[1] > 0 ? 0 : 1;
    let s = camino([en(x1, y1, x2, y2, 0), en(x1, y1, x2, y2, a)]);
    for (let k = 0; k < 4; k++) {
      const p = en(x1, y1, x2, y2, a + 12 * (k + 1));
      s += ` A6 6 0 0 ${barrido} ${p[0]} ${p[1]}`;
    }
    return `${s} ${camino([en(x1, y1, x2, y2, b), en(x1, y1, x2, y2, l)])}`;
  });
</script>

<g data-pieza={pieza} data-cuerpo={caja}><path class={`pieza ${color}`} {d}></path></g>
