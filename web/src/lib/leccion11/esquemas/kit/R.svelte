<script lang="ts">
  // 1.1 schematic kit: a resistor (zigzag) between two points on a horizontal or vertical line, leads included.
  import { cajaCuerpo, camino, cuerpo, en, type Punto } from './geometria';
  let { x1, y1, x2, y2, color = 'tinta', fantasma = false, pieza }: { x1: number; y1: number; x2: number; y2: number; color?: string; fantasma?: boolean; pieza?: string } = $props();
  // (1.2: the zigzag's box, kept clear of the living circuit's particles)
  const caja = $derived.by(() => {
    const { a, b } = cuerpo(x1, y1, x2, y2, 49);
    return cajaCuerpo(x1, y1, x2, y2, a, b, 9);
  });
  const d = $derived.by(() => {
    const { a, b, l } = cuerpo(x1, y1, x2, y2, 49);
    const ps: Punto[] = [en(x1, y1, x2, y2, 0), en(x1, y1, x2, y2, a), en(x1, y1, x2, y2, a + 3.5, 9)];
    for (let k = 0; k < 6; k++) ps.push(en(x1, y1, x2, y2, a + 3.5 + 7 * (k + 1), k % 2 ? 9 : -9));
    ps.push(en(x1, y1, x2, y2, b, 0), en(x1, y1, x2, y2, l));
    return camino(ps);
  });
</script>

<g data-pieza={pieza} data-cuerpo={caja}><path class={`pieza ${color}`} class:fantasma {d}></path></g>
