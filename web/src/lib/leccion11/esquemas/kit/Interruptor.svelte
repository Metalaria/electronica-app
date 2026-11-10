<script lang="ts">
  // 1.1 schematic kit: a switch between two points on a horizontal or vertical line (open: the blade lifted 30°).
  import { camino, cuerpo, en } from './geometria';
  let { x1, y1, x2, y2, cerrado, color = 'tinta' }: { x1: number; y1: number; x2: number; y2: number; cerrado: boolean; color?: string } = $props();
  const g = $derived.by(() => {
    const { a, b, l } = cuerpo(x1, y1, x2, y2, 30);
    const P = (s: number, t = 0) => en(x1, y1, x2, y2, s, t);
    return { hilos: `${camino([P(0), P(a)])} ${camino([P(b), P(l)])}`, hoja: camino([P(a), cerrado ? P(b) : P(a + 26, -15)]), a: P(a), b: P(b) };
  });
</script>

<path class={`pieza ${color}`} d={g.hilos}></path>
<path class={`pieza ${color}`} d={g.hoja}></path>
<circle class="nodo" cx={g.a[0]} cy={g.a[1]} r="3.5"></circle>
<circle class="borne" cx={g.b[0]} cy={g.b[1]} r="3.5"></circle>
