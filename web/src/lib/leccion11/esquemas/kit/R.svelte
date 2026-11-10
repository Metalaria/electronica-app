<script lang="ts">
  // 1.1 schematic kit: a resistor (zigzag) between two points on a horizontal or vertical line, leads included.
  import { camino, cuerpo, en, type Punto } from './geometria';
  let { x1, y1, x2, y2, color = 'tinta', fantasma = false }: { x1: number; y1: number; x2: number; y2: number; color?: string; fantasma?: boolean } = $props();
  const d = $derived.by(() => {
    const { a, b, l } = cuerpo(x1, y1, x2, y2, 49);
    const ps: Punto[] = [en(x1, y1, x2, y2, 0), en(x1, y1, x2, y2, a), en(x1, y1, x2, y2, a + 3.5, 9)];
    for (let k = 0; k < 6; k++) ps.push(en(x1, y1, x2, y2, a + 3.5 + 7 * (k + 1), k % 2 ? 9 : -9));
    ps.push(en(x1, y1, x2, y2, b, 0), en(x1, y1, x2, y2, l));
    return camino(ps);
  });
</script>

<path class={`pieza ${color}`} class:fantasma {d}></path>
