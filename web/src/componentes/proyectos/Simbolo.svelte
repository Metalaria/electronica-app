<script lang="ts">
  // Thumbnail of a part's schematic symbol: the KiCad sheet (Consolas CSG1 drawing) cropped to the symbol's
  // box, with the selected net highlighted. Drawn once per change, no interaction.
  import type { CapaHoja } from '../consolas/datos';
  import { colores, dibujar, type Dibujo } from '../consolas/esquema/dibujo';
  import { cajaSimbolo, dibujarRed } from '../consolas/esquema/capa';

  let { dibujo, capa, refe, red = null, oscuro, alto = 150 }: { dibujo: Dibujo; capa: CapaHoja; refe: string; red?: number | null; oscuro: boolean; alto?: number } = $props();

  let lienzo: HTMLCanvasElement | undefined = $state();
  let ancho = $state(0);
  const caja = $derived(cajaSimbolo(capa, refe));

  $effect(() => {
    const c = lienzo;
    const b = caja;
    void red;
    void oscuro;
    if (!c || !b || ancho <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(ancho * dpr);
    c.height = Math.round(alto * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // labels run out of the symbol: frame the box with room for them
    const m = 900;
    const [x0, y0, x1, y1] = [b[0] - m, b[1] - 300, b[2] + m, b[3] + 300];
    const k = Math.min(ancho / (x1 - x0), alto / (y1 - y0), 0.09);
    const v = { k, ox: ancho / 2 - ((x0 + x1) / 2) * k, oy: alto / 2 - ((y0 + y1) / 2) * k };
    const col = colores(oscuro, '#2e6ea6');
    dibujar(ctx, dibujo, v, dpr, ancho, alto, col, red !== null);
    if (red !== null) {
      const s = v.k * dpr;
      ctx.setTransform(s, 0, 0, s, v.ox * dpr, v.oy * dpr);
      dibujarRed(ctx, capa, red, v.k, col.realce, col.realceSuave, true);
    }
  });
</script>

{#if caja}
  <div class="simbolo" bind:clientWidth={ancho} style:height={`${alto}px`}>
    <canvas bind:this={lienzo} aria-label={`Símbolo de ${refe} en el esquema`}></canvas>
  </div>
{/if}

<style>
  .simbolo {
    position: relative;
    overflow: hidden;
    border-radius: 10px;
    border: 1px solid var(--linea);
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
