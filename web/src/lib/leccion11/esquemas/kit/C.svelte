<script lang="ts">
  // 1.1 schematic kit: a capacitor (two plates across the line), leads included; `polar` marks the + plate.
  import { camino, cuerpo, en } from './geometria';
  let { x1, y1, x2, y2, color = 'tinta', polar = false }: { x1: number; y1: number; x2: number; y2: number; color?: string; polar?: boolean } = $props();
  const g = $derived.by(() => {
    const { a, b, l } = cuerpo(x1, y1, x2, y2, 10);
    return {
      hilos: `${camino([en(x1, y1, x2, y2, 0), en(x1, y1, x2, y2, a)])} ${camino([en(x1, y1, x2, y2, b), en(x1, y1, x2, y2, l)])}`,
      placas: `${camino([en(x1, y1, x2, y2, a, -15), en(x1, y1, x2, y2, a, 15)])} ${camino([en(x1, y1, x2, y2, b, -15), en(x1, y1, x2, y2, b, 15)])}`,
      mas: en(x1, y1, x2, y2, a - 6, 20),
    };
  });
</script>

<path class={`pieza ${color}`} d={g.hilos}></path>
<path class={`pieza placa ${color}`} d={g.placas}></path>
{#if polar}<text class={`et peq ${color}`} x={g.mas[0]} y={g.mas[1] + 4} text-anchor="middle">+</text>{/if}
