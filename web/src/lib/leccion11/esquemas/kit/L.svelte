<script lang="ts">
  // 1.1 schematic kit: an inductor (four turns), leads included.
  import { camino, cuerpo, ejes, en } from './geometria';
  let { x1, y1, x2, y2, color = 'tinta' }: { x1: number; y1: number; x2: number; y2: number; color?: string } = $props();
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

<path class={`pieza ${color}`} {d}></path>
