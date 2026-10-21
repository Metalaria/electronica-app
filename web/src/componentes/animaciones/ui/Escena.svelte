<script lang="ts">
  // Canvas scene: crisp at any size (device-pixel backing store), theme-aware, animated with
  // requestAnimationFrame only while playing and on screen. While paused it redraws when anything the
  // drawing function reads changes (Svelte tracks it), so sliders still update the picture.
  import { onMount } from 'svelte';
  import { app } from '../../../lib/estado.svelte';
  import { paleta } from '../nucleo/paleta';
  import { FAMILIA, limitar, type Ctx, type Vista } from '../nucleo/dibujo';
  import type { Reloj } from '../nucleo/reloj.svelte';

  export interface EventoPuntero {
    tipo: 'abajo' | 'mover' | 'arriba';
    x: number;
    y: number;
  }

  let {
    dibujar,
    paso,
    reloj,
    dims,
    etiqueta,
    puntero,
  }: {
    dibujar: (v: Vista) => void;
    paso?: (dt: number, t: number) => void;
    reloj: Reloj;
    /** Logical size for a given CSS width (lets a scene use a taller layout on phones). */
    dims?: (anchoCss: number) => [number, number];
    etiqueta: string;
    /** Pointer interaction in logical coordinates; return true to capture the drag. */
    puntero?: (e: EventoPuntero) => boolean | void;
  } = $props();

  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let anchoCss = $state(0);
  let enPantalla = $state(true);
  let paginaVisible = $state(true);
  let fuentes = $state(0);
  let arrastrando = false;

  const pal = $derived(paleta(app.tema));
  const tam = $derived<[number, number]>(dims ? dims(Math.max(anchoCss, 1)) : [800, 450]);
  const escala = $derived(anchoCss > 0 ? anchoCss / tam[0] : 1);
  const altoCss = $derived(Math.round(anchoCss * (tam[1] / tam[0])));

  let t = 0;
  let raf = 0;
  let ultimo = 0;
  const capas = new Map<string, { clave: string; c: HTMLCanvasElement }>();

  // Frame cost statistics, read by the performance test (tests/animaciones.mjs).
  type Stats = { n: number; total: number; max: number; marcas: number[] };
  const g = globalThis as unknown as { __epaAnim?: Stats };

  function render(): void {
    const c = lienzo;
    if (!c || anchoCss <= 0) return;
    // Backing store: device pixels, but at most 2× and about 1,6 Mpx (Retina, 2.6× phones and 2880 px
    // tablets would otherwise push 2–3 Mpx per frame through the compositor for no visible gain).
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1.6e6 / Math.max(1, anchoCss * altoCss)));
    const W = Math.round(anchoCss * dpr);
    const H = Math.round(altoCss * dpr);
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const [w, h] = tam;
    const k = escala;
    const s = k * dpr;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    void fuentes;
    const f = (px: number) => (px * limitar(k, 0.98, 1.3)) / k;
    const v: Vista = {
      ctx,
      w,
      h,
      escala: k,
      dpr,
      pal,
      estrecho: anchoCss < 560,
      t,
      f,
      fuente: (px, peso = 600) => `${peso} ${f(px).toFixed(2)}px ${FAMILIA}`,
      capa: (clave, fn) => {
        // One bitmap per layer name (the part before «:»); the rest of the key only says when to redraw it,
        // so a slider sweeping through values does not pile up full-size canvases.
        const nombre = clave.split(':')[0]!;
        const id = `${clave}|${W}x${H}|${w}x${h}|${pal.fondo}`;
        let e = capas.get(nombre);
        if (!e || e.clave !== id) {
          const off = e?.c ?? document.createElement('canvas');
          off.width = W;
          off.height = H;
          const oc = off.getContext('2d') as Ctx | null;
          if (oc) {
            oc.setTransform(s, 0, 0, s, 0, 0);
            oc.clearRect(0, 0, w, h);
            fn(oc);
          }
          e = { clave: id, c: off };
          capas.set(nombre, e);
        }
        // Pixel-aligned copy (identity transform): no resampling, the cheapest blit.
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(e.c, 0, 0);
        ctx.restore();
      },
    };
    ctx.clearRect(0, 0, w, h);
    dibujar(v);
  }

  function enMarcha(): boolean {
    return reloj.play && enPantalla && paginaVisible && anchoCss > 0;
  }

  function bucle(ts: number): void {
    raf = 0;
    if (!enMarcha()) {
      ultimo = 0;
      return;
    }
    const t0 = performance.now();
    const dt = ultimo ? Math.min(0.05, (ts - ultimo) / 1000) : 1 / 60;
    ultimo = ts;
    const d = dt * reloj.velocidad;
    t += d;
    paso?.(d, t);
    render();
    const coste = performance.now() - t0;
    const st = (g.__epaAnim ??= { n: 0, total: 0, max: 0, marcas: [] });
    st.n++;
    st.total += coste;
    st.max = Math.max(st.max, coste);
    st.marcas.push(ts);
    if (st.marcas.length > 600) st.marcas.splice(0, 300);
    raf = requestAnimationFrame(bucle);
  }

  // Start/stop the loop; while stopped, redraw whenever something the drawing reads changes.
  $effect(() => {
    if (enMarcha()) {
      if (!raf) raf = requestAnimationFrame(bucle);
      return;
    }
    ultimo = 0;
    void tam;
    render();
  });

  $effect(() => {
    void reloj.reinicios;
    t = 0;
  });

  function coords(ev: PointerEvent): { x: number; y: number } {
    const r = lienzo!.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / escala, y: (ev.clientY - r.top) / escala };
  }

  function abajo(ev: PointerEvent): void {
    if (!puntero) return;
    const p = coords(ev);
    if (puntero({ tipo: 'abajo', ...p }) === true) {
      arrastrando = true;
      lienzo?.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    }
  }

  function mover(ev: PointerEvent): void {
    if (!puntero) return;
    if (arrastrando || ev.pointerType === 'mouse') puntero({ tipo: 'mover', ...coords(ev) });
  }

  function arriba(ev: PointerEvent): void {
    if (!puntero || !arrastrando) return;
    arrastrando = false;
    puntero({ tipo: 'arriba', ...coords(ev) });
  }

  onMount(() => {
    const ro = new ResizeObserver((e) => {
      const ancho = e[0]?.contentRect.width ?? 0;
      if (Math.abs(ancho - anchoCss) > 0.5) anchoCss = ancho;
    });
    if (caja) ro.observe(caja);
    const io = new IntersectionObserver((e) => {
      for (const x of e) enPantalla = x.isIntersecting;
    });
    if (caja) io.observe(caja);
    const vis = () => (paginaVisible = document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', vis);
    document.fonts?.ready.then(() => fuentes++);
    // Hook for tests/animaciones-hz.mjs: redraw without advancing, or advance by many tiny steps.
    const prueba = globalThis as unknown as { __epaEscena?: { dibujar: () => void; pasos: (n: number, dt: number) => void } };
    prueba.__epaEscena = {
      dibujar: render,
      pasos: (n, dt) => {
        for (let i = 0; i < n; i++) paso?.(dt, t);
        render();
      },
    };
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
  });
</script>

<div class="escena" role="img" aria-label={etiqueta} bind:this={caja} style:height={anchoCss ? `${altoCss}px` : undefined} style:aspect-ratio={anchoCss ? undefined : `${tam[0]} / ${tam[1]}`}>
  <canvas
    bind:this={lienzo}
    aria-hidden="true"
    class:interactivo={!!puntero}
    style:width={`${anchoCss}px`}
    style:height={`${altoCss}px`}
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={arriba}
  ></canvas>
</div>

<style>
  .escena {
    position: relative;
    width: 100%;
    border-radius: 14px;
    overflow: hidden;
    background: var(--superficie);
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
  }
  canvas {
    display: block;
    touch-action: pan-y;
  }
  canvas.interactivo {
    cursor: grab;
  }
</style>
