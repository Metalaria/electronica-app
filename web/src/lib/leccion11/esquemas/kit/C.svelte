<script lang="ts">
  // 1.1 schematic kit: a capacitor (two plates across the line), leads included; `polar` marks the + plate.
  import { cajaCuerpo, camino, cuerpo, en } from './geometria';
  // (1.2, esquemas12c: `variable` draws a trimmer — an arrow across the plates, a probe's compensation capacitor)
  let { x1, y1, x2, y2, color = 'tinta', polar = false, variable = false, pieza }: { x1: number; y1: number; x2: number; y2: number; color?: string; polar?: boolean; variable?: boolean; pieza?: string } = $props();
  const g = $derived.by(() => {
    const { a, b, l } = cuerpo(x1, y1, x2, y2, 10);
    return {
      hilos: `${camino([en(x1, y1, x2, y2, 0), en(x1, y1, x2, y2, a)])} ${camino([en(x1, y1, x2, y2, b), en(x1, y1, x2, y2, l)])}`,
      placas: `${camino([en(x1, y1, x2, y2, a, -15), en(x1, y1, x2, y2, a, 15)])} ${camino([en(x1, y1, x2, y2, b, -15), en(x1, y1, x2, y2, b, 15)])}`,
      mas: en(x1, y1, x2, y2, a - 6, 20),
      flecha: camino([en(x1, y1, x2, y2, a - 9, -18), en(x1, y1, x2, y2, b + 9, 18)]),
      punta: camino([en(x1, y1, x2, y2, b + 3, 18), en(x1, y1, x2, y2, b + 9, 18), en(x1, y1, x2, y2, b + 8, 12)]),
      // (1.2: the plates and the gap between them, kept clear of the living circuit's particles)
      caja: cajaCuerpo(x1, y1, x2, y2, a, b, 15),
    };
  });
</script>

<g data-pieza={pieza} data-cuerpo={g.caja}>
<path class={`pieza ${color}`} d={g.hilos}></path>
<path class={`pieza placa ${color}`} d={g.placas}></path>
{#if variable}<path class={`pieza fina ${color}`} d={g.flecha}></path><path class={`pieza fina ${color}`} d={g.punta}></path>{/if}
{#if polar}<text class={`et peq ${color}`} x={g.mas[0]} y={g.mas[1] + 4} text-anchor="middle">+</text>{/if}
</g>
