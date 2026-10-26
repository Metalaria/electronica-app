<script lang="ts">
  // The journey on a photo with copper traces (Game Boy: the bare DMG-CPU-06 scanned on both faces, with Gekkio's
  // trace of every net): the photo, and over it the copper of the live nets with pulses running away from the part
  // that drives them (its box on the photo, and the same place mirrored on the solder side).
  import { onMount } from 'svelte';
  import { cargarTrazas, fotosDe, type DatosMaquina, type FotoExtra, type Trazas } from '../datos';
  import { colorGrupoPlaca } from './colores';
  import { dibujarRecorrido, type FuenteTramos } from './capaRecorrido';
  import { camino, orientar, type Tramos } from './pulsos';
  import type { Reproductor } from './reproductor';
  import { VistaPlana } from './vistaPlana';

  let { datos, rep }: { datos: DatosMaquina; rep: Reproductor } = $props();

  const foto = $derived<FotoExtra | undefined>(fotosDe(datos).find((f) => f.trazas));
  let trazas: Trazas | null = $state.raw(null);
  let imagen: HTMLImageElement | null = $state.raw(null);
  let error = $state('');
  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let raf = 0;
  const vista = new VistaPlana(() => pedir());
  let cache = new Map<string, { t: Tramos; p: Path2D } | null>();

  $effect(() => {
    const f = foto;
    if (!f?.trazas) return;
    let vivo = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = f.src;
    Promise.all([cargarTrazas(f.trazas), img.decode().then(() => img)])
      .then(([t, im]) => {
        if (!vivo) return;
        cache = new Map();
        trazas = t;
        imagen = im;
        vista.anchoContenido = f.ancho;
        vista.altoContenido = f.alto;
        vista.ajustar();
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  /** Segments of SVG path data (M, L, C, A, Z; absolute): curves and arcs as straight lines to their end. */
  function segmentos(d: string, out: number[]): void {
    const tok = d.match(/[MLCAZ]|-?[\d.]+(?:e-?\d+)?/gi) ?? [];
    let i = 0;
    let x = 0;
    let y = 0;
    let x0 = 0;
    let y0 = 0;
    let cmd = 'M';
    const num = () => Number(tok[i++]);
    while (i < tok.length) {
      const t = tok[i]!;
      if (/[MLCAZ]/i.test(t)) {
        cmd = t.toUpperCase();
        i++;
        if (cmd === 'Z') {
          out.push(x, y, x0, y0);
          x = x0;
          y = y0;
        }
        continue;
      }
      if (cmd === 'M') {
        x = num();
        y = num();
        x0 = x;
        y0 = y;
        cmd = 'L';
      } else if (cmd === 'L') {
        const nx = num();
        const ny = num();
        out.push(x, y, nx, ny);
        x = nx;
        y = ny;
      } else if (cmd === 'C') {
        i += 4;
        const nx = num();
        const ny = num();
        out.push(x, y, nx, ny);
        x = nx;
        y = ny;
      } else if (cmd === 'A') {
        i += 5;
        const nx = num();
        const ny = num();
        out.push(x, y, nx, ny);
        x = nx;
        y = ny;
      } else i++;
    }
  }

  const fuente: FuenteTramos = {
    tramos(red, desde) {
      const t = trazas;
      const f = foto;
      if (!t || !f) return null;
      const clave = `${red}|${desde ?? ''}`;
      if (cache.has(clave)) return cache.get(clave)!;
      const caminos = t.redes[red];
      let r: { t: Tramos; p: Path2D } | null = null;
      if (caminos?.length) {
        const segs: number[] = [];
        for (const d of caminos) segmentos(d, segs);
        const fuentes: [number, number][] = [];
        const h = desde ? f.hotspots.find((q) => q.esquema.includes(desde)) : undefined;
        if (h) {
          for (const [x0, y0, x1, y1] of h.cajas) {
            // the part's pins: path points inside its box, on both faces (the solder side is mirrored)
            for (let j = 0; j < segs.length; j += 2) {
              const x = segs[j]!;
              const y = segs[j + 1]!;
              const xm = f.ancho - x;
              if ((x >= x0 && x <= x1 && y >= y0 && y <= y1) || (xm >= x0 && xm <= x1 && y >= y0 && y <= y1)) fuentes.push([x, y]);
              if (fuentes.length > 64) break;
            }
            if (!fuentes.length) fuentes.push([(x0 + x1) / 2, (y0 + y1) / 2], [f.ancho - (x0 + x1) / 2, (y0 + y1) / 2]);
          }
        }
        const o = orientar(segs, fuentes, 2.5);
        r = { t: o, p: camino(o) };
      }
      cache.set(clave, r);
      return r;
    },
    cajas(refs) {
      const f = foto;
      if (!f) return [];
      const out: [number, number, number, number][] = [];
      for (const ref of refs) {
        const h = f.hotspots.find((q) => q.esquema.includes(ref));
        if (h) for (const c of h.cajas) out.push(c);
      }
      return out;
    },
  };

  function pedir(): void {
    if (!raf) raf = requestAnimationFrame(pintar);
  }

  function pintar(): void {
    raf = 0;
    const c0 = performance.now();
    pintarFoto();
    const st = ((globalThis as unknown as { __epaFotogramaPlacaMs?: number[] }).__epaFotogramaPlacaMs ??= []);
    st.push(performance.now() - c0);
    if (st.length > 600) st.splice(0, 300);
  }

  function pintarFoto(): void {
    const c = lienzo;
    if (!c || vista.ancho <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(vista.ancho * dpr);
    const H = Math.round(vista.alto * dpr);
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#101317';
    ctx.fillRect(0, 0, W, H);
    const f = foto;
    if (!imagen || !f) return;
    ctx.setTransform(vista.k * dpr, 0, 0, vista.k * dpr, vista.ox * dpr, vista.oy * dpr);
    ctx.drawImage(imagen, 0, 0, f.ancho, f.alto);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(0, 0, f.ancho, f.alto);
    dibujarRecorrido(ctx, fuente, rep, vista.k, (g) => colorGrupoPlaca(g), 2.6, dpr);
  }

  onMount(() => {
    const fn = () => pedir();
    rep.oyentes.add(fn);
    const ro = new ResizeObserver((e) => {
      const r = e[0]?.contentRect;
      if (!r) return;
      vista.ancho = r.width;
      vista.alto = r.height;
      vista.ajustar();
    });
    if (caja) ro.observe(caja);
    const rueda = (ev: WheelEvent) => vista.rueda(lienzo!, ev);
    lienzo?.addEventListener('wheel', rueda, { passive: false });
    return () => {
      rep.oyentes.delete(fn);
      ro.disconnect();
      lienzo?.removeEventListener('wheel', rueda);
      if (raf) cancelAnimationFrame(raf);
    };
  });
</script>

<div class="foto-recorrido" bind:this={caja}>
  <canvas
    bind:this={lienzo}
    aria-label="Cobre de la placa con el recorrido de las señales: arrastra para desplazar, rueda o pellizco para ampliar"
    onpointerdown={(e) => vista.abajo(lienzo!, e)}
    onpointermove={(e) => vista.mover(lienzo!, e)}
    onpointerup={(e) => vista.arriba(e)}
    onpointercancel={(e) => vista.arriba(e)}
    ondblclick={() => vista.ajustar()}
  ></canvas>
  {#if error}<p class="aviso">No se pudo cargar la foto: {error}</p>{:else if !imagen}<p class="aviso">Cargando la foto…</p>{/if}
  {#if foto?.credito}<p class="credito">{foto.titulo} · {foto.credito}</p>{/if}
</div>

<style>
  .foto-recorrido {
    position: relative;
    height: 100%;
    min-height: 0;
    border-radius: 12px;
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
  }
  .aviso,
  .credito {
    position: absolute;
    left: 10px;
    margin: 0;
    padding: 3px 8px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.55);
    color: #f1f3f5;
    font-size: 12px;
  }
  .aviso {
    top: 10px;
  }
  .credito {
    bottom: 8px;
  }
</style>
