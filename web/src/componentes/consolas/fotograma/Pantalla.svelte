<script lang="ts">
  // The simulated screen of «Un fotograma»: the pixels the trace says went out up to the current instant, in their
  // real order; the part not drawn yet shows the previous frame dimmed (what the LCD or the TV still holds), and a
  // marker shows where the beam (the pixel output) is.
  import { onMount } from 'svelte';
  import type { Reproductor } from './reproductor';

  let { rep }: { rep: Reproductor } = $props();

  let lienzo: HTMLCanvasElement | undefined = $state();
  const v = $derived(rep.traza.m.video);
  let img: ImageData | null = null;
  let rgb: Uint32Array = new Uint32Array(0);
  let hechos = -1;
  let ultimoSeg = '';

  /** ABGR (little-endian ImageData) of a pixel value of the trace. */
  function color(c: number): number {
    let r: number;
    let g: number;
    let b: number;
    if (v.formato === 'rgb555') {
      r = ((c & 31) * 255) / 31;
      g = (((c >> 5) & 31) * 255) / 31;
      b = (((c >> 10) & 31) * 255) / 31;
    } else {
      const x = v.paleta?.[c] ?? 0;
      r = x >> 16;
      g = (x >> 8) & 255;
      b = x & 255;
    }
    return (255 << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r);
  }

  function atenuar(abgr: number): number {
    const r = abgr & 255;
    const g = (abgr >> 8) & 255;
    const b = (abgr >> 16) & 255;
    const f = (x: number) => Math.round(x * 0.32 + 24);
    return (255 << 24) | (f(b) << 16) | (f(g) << 8) | f(r);
  }

  function preparar(): void {
    const tr = rep.traza;
    const n = v.ancho * v.alto;
    img = new ImageData(v.ancho, v.alto);
    rgb = new Uint32Array(img.data.buffer);
    const fb = tr.m.fb ? tr.array(tr.m.fb) : null;
    for (let i = 0; i < n; i++) rgb[i] = fb ? atenuar(color(fb[i]!)) : 0xff181818;
    hechos = 0;
  }

  function pintar(): void {
    const c = lienzo;
    if (!c) return;
    const seg = rep.seg;
    if (!img || ultimoSeg !== seg.id) {
      ultimoSeg = seg.id;
      preparar();
    }
    const tr = rep.traza;
    const pc = tr.array(tr.m.pixeles.c);
    const fb = tr.m.fb ? tr.array(tr.m.fb) : null;
    const n = rep.pixelesHasta() - seg.pixel0;
    if (n > hechos) {
      for (let i = hechos; i < n; i++) rgb[i] = color(pc[seg.pixel0 + i]!);
    } else if (n < hechos) {
      for (let i = n; i < hechos; i++) rgb[i] = fb ? atenuar(color(fb[i]!)) : 0xff181818;
    }
    hechos = n;
    const ctx = c.getContext('2d');
    if (!ctx || !img) return;
    if (c.width !== v.ancho) c.width = v.ancho;
    if (c.height !== v.alto) c.height = v.alto;
    ctx.putImageData(img, 0, 0);
    // the beam: the next pixel to go out
    if (seg.pixel1 > seg.pixel0 && n < seg.pixel1 - seg.pixel0) {
      const x = n % v.ancho;
      const y = Math.floor(n / v.ancho);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = 'rgba(255,60,120,0.55)';
      ctx.fillRect(0, y, 2, 1);
      ctx.fillRect(v.ancho - 2, y, 2, 1);
    }
    (globalThis as unknown as { __epaFotogramaPantalla?: { pixeles: number } }).__epaFotogramaPantalla = { pixeles: n };
  }

  /** The screen as drawn (for the integrity test): pixel values of the trace, in raster order. */
  export function valores(): number[] {
    const tr = rep.traza;
    const pc = tr.array(tr.m.pixeles.c);
    return Array.from(pc.subarray(rep.seg.pixel0, rep.seg.pixel1));
  }

  onMount(() => {
    const f = () => pintar();
    rep.oyentes.add(f);
    pintar();
    return () => {
      rep.oyentes.delete(f);
    };
  });
</script>

<div class="pantalla" style:aspect-ratio="{v.ancho} / {v.alto}">
  <canvas bind:this={lienzo} width={v.ancho} height={v.alto} aria-label="Pantalla: el cuadro se va dibujando píxel a píxel"></canvas>
</div>

<style>
  .pantalla {
    width: 100%;
    border-radius: 10px;
    overflow: hidden;
    background: #111;
    box-shadow: inset 0 0 0 3px #222;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
</style>
