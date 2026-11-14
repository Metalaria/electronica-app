<script lang="ts">
  // 1.1 schematic kit: a diode from anode (x1, y1) to cathode (x2, y2) — rectifier, Zener (bent bar) or LED (two
  // arrows, and a glow whose opacity is `brillo`, 0–1, the light it gives).
  import { cajaCuerpo, camino, cuerpo, en } from './geometria';
  let {
    x1, y1, x2, y2, color = 'tinta', variante = 'diodo', brillo = 0, pieza,
  }: { x1: number; y1: number; x2: number; y2: number; color?: string; variante?: 'diodo' | 'zener' | 'led'; brillo?: number; pieza?: string } = $props();
  const g = $derived.by(() => {
    const { a, b, l } = cuerpo(x1, y1, x2, y2, 20);
    const P = (s: number, t = 0) => en(x1, y1, x2, y2, s, t);
    const c = P((a + b) / 2);
    return {
      hilos: `${camino([P(0), P(a)])} ${camino([P(b), P(l)])}`,
      triangulo: `${camino([P(a, -11), P(a, 11), P(b, 0)])} Z`,
      barra: variante === 'zener' ? camino([P(b - 5, -15), P(b, -11), P(b, 11), P(b + 5, 15)]) : camino([P(b, -11), P(b, 11)]),
      flechas: variante === 'led' ? [camino([P(a + 4, 16), P(a + 12, 28)]), camino([P(a + 12, 16), P(a + 20, 28)])] : [],
      puntas: variante === 'led' ? [camino([P(a + 8, 27), P(a + 12, 28), P(a + 11, 24)]), camino([P(a + 16, 27), P(a + 20, 28), P(a + 19, 24)])] : [],
      c,
      // (1.2: the triangle and the bar — a Zener's bends 5 units past it —, kept clear of the living circuit's particles)
      caja: cajaCuerpo(x1, y1, x2, y2, a, variante === 'zener' ? b + 5 : b, variante === 'zener' ? 15 : 11),
    };
  });
</script>

<g data-pieza={pieza} data-cuerpo={g.caja}>
{#if variante === 'led'}<circle class="brillo" cx={g.c[0]} cy={g.c[1]} r="24" style:opacity={(0.06 + 0.34 * Math.max(0, Math.min(1, brillo))).toFixed(2)}></circle>{/if}
<path class={`pieza ${color}`} d={g.hilos}></path>
<path class={`pieza relleno ${color}`} d={g.triangulo}></path>
<path class={`pieza ${color}`} d={g.barra}></path>
{#each g.flechas as f, k (k)}<path class={`pieza fina ${color}`} d={f}></path><path class={`pieza fina ${color}`} d={g.puntas[k]}></path>{/each}
</g>
