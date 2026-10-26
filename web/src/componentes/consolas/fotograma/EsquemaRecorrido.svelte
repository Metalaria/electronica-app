<script lang="ts">
  // The journey on the schematic: the console's real KiCad sheet (esquema/Lienzo.svelte, pan/zoom as in the
  // «Esquema» tab) with an overlay canvas where the live nets glow in their group colour and pulses run along the
  // wires away from the pin that drives them. The overlay follows the sheet's view (Lienzo's alPintar).
  import { onMount } from 'svelte';
  import { cargarCapa, cargarDibujo, type CapaHoja, type DatosMaquina } from '../datos';
  import { decodificar, type Dibujo, type VistaEsquema } from '../esquema/dibujo';
  import { cajaSimbolo } from '../esquema/capa';
  import Lienzo from '../esquema/Lienzo.svelte';
  import { colorGrupo } from './colores';
  import { dibujarRecorrido, type FuenteTramos } from './capaRecorrido';
  import { camino, orientar, type Tramos } from './pulsos';
  import type { Reproductor } from './reproductor';

  let { datos, rep, oscuro, hoja = $bindable(0) }: { datos: DatosMaquina; rep: Reproductor; oscuro: boolean; hoja?: number } = $props();

  let dibujo: Dibujo | null = $state.raw(null);
  let capa: CapaHoja | null = $state.raw(null);
  let error = $state('');
  let superpuesto: HTMLCanvasElement | undefined = $state();
  let vista: VistaEsquema | null = null;
  let anchoCss = 0;
  let altoCss = 0;
  const indice = $derived(new Map(datos.redes.map((r, i) => [r.n, i])));
  let cache = new Map<string, { t: Tramos; p: Path2D } | null>();

  $effect(() => {
    const hj = datos.hojas[hoja];
    if (!hj) return;
    let vivo = true;
    error = '';
    Promise.all([cargarDibujo(hj), cargarCapa(hj)])
      .then(([b, c]) => {
        if (!vivo) return;
        cache = new Map();
        dibujo = decodificar(b);
        capa = c;
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  const fuente: FuenteTramos = {
    tramos(red, desde) {
      const c = capa;
      if (!c) return null;
      const clave = `${red}|${desde ?? ''}`;
      if (cache.has(clave)) return cache.get(clave)!;
      const i = indice.get(red);
      let r: { t: Tramos; p: Path2D } | null = null;
      if (i !== undefined) {
        const segs: number[] = [];
        const h = c.hilos;
        for (let j = 0; j < h.length; j += 5) if (h[j] === i) segs.push(h[j + 1]!, h[j + 2]!, h[j + 3]!, h[j + 4]!);
        const fuentes: [number, number][] = [];
        for (const p of c.pines) {
          if (p[0] !== i) continue;
          segs.push(p[4], p[5], p[6], p[7]);
          if (desde && p[1] === desde) fuentes.push([p[6], p[7]]);
        }
        if (segs.length) {
          const t = orientar(segs, fuentes, 8);
          r = { t, p: camino(t) };
        }
      }
      cache.set(clave, r);
      return r;
    },
    cajas(refs) {
      const c = capa;
      if (!c) return [];
      const out: [number, number, number, number][] = [];
      for (const ref of refs) {
        const b = cajaSimbolo(c, ref);
        if (b) out.push(b);
      }
      return out;
    },
  };

  function pintar(): void {
    const cv = superpuesto;
    const v = vista;
    if (!cv || !v || anchoCss <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(anchoCss * dpr);
    const H = Math.round(altoCss * dpr);
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(v.k * dpr, 0, 0, v.k * dpr, v.ox * dpr, v.oy * dpr);
    dibujarRecorrido(ctx, fuente, rep, v.k, (g) => colorGrupo(g, oscuro), 3.2, dpr);
  }

  function alPintar(v: VistaEsquema, w: number, h: number): void {
    vista = v;
    anchoCss = w;
    altoCss = h;
    pintar();
  }

  $effect(() => {
    void oscuro;
    pintar();
  });

  onMount(() => {
    const f = () => pintar();
    rep.oyentes.add(f);
    return () => {
      rep.oyentes.delete(f);
    };
  });
</script>

<div class="esquema-recorrido">
  {#if datos.hojas.length > 1}
    <div class="hojas" role="group" aria-label="Hoja del esquema">
      {#each datos.hojas as h, i (h.id)}
        <button type="button" aria-pressed={hoja === i} class:activo={hoja === i} onclick={() => (hoja = i)}>{h.nombre}</button>
      {/each}
    </div>
  {/if}
  <div class="marco">
    {#if error}
      <p class="aviso">No se pudo cargar la hoja: {error}</p>
    {:else if dibujo && capa}
      <Lienzo {dibujo} {capa} {oscuro} acento="#7a7f87" alTocar={() => {}} alPasar={() => {}} {alPintar} />
      <canvas class="superpuesto" bind:this={superpuesto} aria-hidden="true"></canvas>
    {:else}
      <p class="aviso">Cargando la hoja…</p>
    {/if}
  </div>
</div>

<style>
  .esquema-recorrido {
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 6px;
    height: 100%;
    min-height: 0;
  }
  .hojas {
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }
  .hojas button {
    min-height: 32px;
    padding: 2px 10px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font: inherit;
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;
  }
  .hojas button.activo {
    border-color: var(--acento);
    color: var(--acento);
    font-weight: 700;
  }
  .marco {
    position: relative;
    min-height: 0;
    border: 1px solid var(--linea);
    border-radius: 12px;
    overflow: hidden;
    background: var(--superficie);
  }
  .superpuesto {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .aviso {
    margin: 0;
    padding: 20px;
    color: var(--tinta-suave);
  }
</style>
