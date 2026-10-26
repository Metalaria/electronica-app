<script lang="ts">
  // The journey on the board: the console's linked board (NES OpenTendo, GBC CGB-CPU-04 Gerbers) painted once with
  // the «Proyectos KiCad» painter (proyectos/pintar.ts → pintarLado, used as is) into a cached bitmap, and over it
  // the copper tracks of the live nets, both faces, with pulses running away from the pads of the driving part.
  import { onMount, untrack } from 'svelte';
  import type { DatosMaquina } from '../datos';
  import { construirGeometria, type Geometria } from '../../proyectos/geometria';
  import { pintarLado } from '../../proyectos/pintar';
  import { cargarPlacaConsola, PLACAS_DE, type DatosPlacaConsola } from '../placa/datos';
  import { colorGrupoPlaca } from './colores';
  import { dibujarRecorrido, type FuenteTramos } from './capaRecorrido';
  import { camino, orientar, type Tramos } from './pulsos';
  import type { Reproductor } from './reproductor';
  import { VistaPlana } from './vistaPlana';

  let { datos, rep, oscuro }: { datos: DatosMaquina; rep: Reproductor; oscuro: boolean } = $props();

  const idPlaca = $derived(PLACAS_DE[datos.id]?.find((p) => p.enlazada)?.id ?? '');
  let d: DatosPlacaConsola | null = $state.raw(null);
  let error = $state('');
  let pintando = $state(true);
  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let base: HTMLCanvasElement | null = null;
  let escalaBase = 1;
  let baseOscuro = false;
  let raf = 0;
  const vista = new VistaPlana(() => pedir());
  /** Face looked at: the one with the CPU by default (the CGB-CPU-04 has it underneath). */
  let lado: 'F' | 'B' = $state('F');
  /** Schematic net -> board net indices. */
  let redesPlaca = new Map<string, number[]>();
  let cache = new Map<string, { t: Tramos; p: Path2D } | null>();

  $effect(() => {
    const id = idPlaca;
    if (!id) return;
    let vivo = true;
    error = '';
    cargarPlacaConsola(id)
      .then((x) => {
        if (!vivo) return;
        const m = new Map<string, number[]>();
        const idx = new Map(x.redes.map((r, i) => [r.n, i]));
        for (const [placa, esq] of Object.entries(x.consola.redes)) {
          const i = idx.get(placa);
          if (i !== undefined) m.set(esq, [...(m.get(esq) ?? []), i]);
        }
        redesPlaca = m;
        cache = new Map();
        lado = ladoDe(x, x.consola.maquina === 'nes' ? 'U6' : 'U1');
        d = x;
        // paint the board after the first frame so the tab shows at once
        setTimeout(() => {
          if (!vivo) return;
          prepararBase(x, construirGeometria(x));
          pintando = false;
          vista.anchoContenido = x.placa.ancho;
          vista.altoContenido = x.placa.alto;
          vista.ajustar();
        }, 30);
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  /** Face of a part: the copper layer of most of its pads. */
  function ladoDe(x: DatosPlacaConsola, ref: string): 'F' | 'B' {
    const h = x.huellas.find((q) => q.r === ref);
    if (!h) return 'F';
    if (h.lado === 'B' && h.t !== 'mec') return 'B';
    let f = 0;
    let b = 0;
    for (let i = h.pads[0]; i < h.pads[0] + h.pads[1]; i++) {
      const fl = x.pads[i]![11];
      if (fl & 4) continue; // through-hole: both faces
      if (fl & 1) f++;
      if (fl & 2) b++;
    }
    return b > f ? 'B' : 'F';
  }

  function cambiarLado(l: 'F' | 'B'): void {
    lado = l;
    if (d) {
      prepararBase(d, construirGeometria(d));
      pedir();
    }
  }

  function prepararBase(x: DatosPlacaConsola, g: Geometria): void {
    // about 18 px/mm, at most 4096 px on the long side
    const largo = Math.max(x.placa.ancho, x.placa.alto);
    escalaBase = Math.min(0.18, 4096 / largo);
    const c = document.createElement('canvas');
    c.width = Math.ceil(x.placa.ancho * escalaBase);
    c.height = Math.ceil(x.placa.alto * escalaBase);
    const ctx = c.getContext('2d')!;
    // seen from below, the board is mirrored left to right (as in proyectos/Placa2D.svelte)
    if (lado === 'B') ctx.setTransform(-escalaBase, 0, 0, escalaBase, x.placa.ancho * escalaBase, 0);
    else ctx.setTransform(escalaBase, 0, 0, escalaBase, 0, 0);
    pintarLado(ctx, x, g, {
      lado,
      aspecto: 'real',
      acabado: x.placa.acabado === 'enig' ? 'enig' : 'hasl',
      visibles: { F: true, B: true, mascara: true, serigrafia: true, fab: false, areas: false },
      mascara: x.placa.mascara,
      escala: escalaBase,
      oscuro,
    });
    // dimmed once here (not every frame) so that the signals stand out
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-over';
    base = c;
    baseOscuro = oscuro;
  }

  const fuente: FuenteTramos = {
    tramos(red, desde) {
      const x = d;
      if (!x) return null;
      const clave = `${red}|${desde ?? ''}`;
      if (cache.has(clave)) return cache.get(clave)!;
      const nets = redesPlaca.get(red) ?? [];
      let r: { t: Tramos; p: Path2D } | null = null;
      if (nets.length) {
        const segs: number[] = [];
        for (const lado of Object.keys(x.pistas)) {
          const p = x.pistas[lado]!;
          for (let j = 0; j < p.length; j += 6) if (nets.includes(p[j]!)) segs.push(p[j + 2]!, p[j + 3]!, p[j + 4]!, p[j + 5]!);
        }
        const fuentes: [number, number][] = [];
        for (const pad of x.pads) {
          if (!nets.includes(pad[12])) continue;
          if (desde && x.huellas[pad[0]]?.r === desde) fuentes.push([pad[3], pad[4]]);
        }
        if (segs.length) {
          const t = orientar(segs, fuentes, 30);
          r = { t, p: camino(t) };
        }
      }
      cache.set(clave, r);
      return r;
    },
    cajas(refs) {
      const x = d;
      if (!x) return [];
      const out: [number, number, number, number][] = [];
      for (const ref of refs) {
        const h = x.huellas.find((q) => q.r === ref);
        if (!h) continue;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (let i = h.pads[0]; i < h.pads[0] + h.pads[1]; i++) {
          const p = x.pads[i]!;
          x0 = Math.min(x0, p[3] - p[5] / 2);
          y0 = Math.min(y0, p[4] - p[6] / 2);
          x1 = Math.max(x1, p[3] + p[5] / 2);
          y1 = Math.max(y1, p[4] + p[6] / 2);
        }
        if (x0 < Infinity) out.push([x0, y0, x1, y1]);
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
    pintarPlaca();
    const st = ((globalThis as unknown as { __epaFotogramaPlacaMs?: number[] }).__epaFotogramaPlacaMs ??= []);
    st.push(performance.now() - c0);
    if (st.length > 600) st.splice(0, 300);
  }

  function pintarPlaca(): void {
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
    ctx.fillStyle = oscuro ? '#0f1216' : '#e9ecef';
    ctx.fillRect(0, 0, W, H);
    if (!base || !d) return;
    const k = vista.k;
    ctx.setTransform(k * dpr, 0, 0, k * dpr, vista.ox * dpr, vista.oy * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, 0, 0, base.width / escalaBase, base.height / escalaBase);
    // the tracks in board units, mirrored when seen from below
    if (lado === 'B') ctx.setTransform(-k * dpr, 0, 0, k * dpr, (vista.ox + d.placa.ancho * k) * dpr, vista.oy * dpr);
    dibujarRecorrido(ctx, fuente, rep, k, (g) => colorGrupoPlaca(g), 2.6, dpr);
  }

  // the theme changes the board's page colour: repaint the cached bitmap
  $effect(() => {
    const o = oscuro;
    untrack(() => {
      if (d && base && o !== baseOscuro) {
        prepararBase(d, construirGeometria(d));
        pedir();
      }
    });
  });

  onMount(() => {
    const f = () => pedir();
    rep.oyentes.add(f);
    const ro = new ResizeObserver((e) => {
      const r = e[0]?.contentRect;
      if (!r) return;
      const primera = vista.ancho <= 0;
      vista.ancho = r.width;
      vista.alto = r.height;
      if (primera || d) vista.ajustar();
      pedir();
    });
    if (caja) ro.observe(caja);
    const rueda = (ev: WheelEvent) => vista.rueda(lienzo!, ev);
    lienzo?.addEventListener('wheel', rueda, { passive: false });
    return () => {
      rep.oyentes.delete(f);
      ro.disconnect();
      lienzo?.removeEventListener('wheel', rueda);
      if (raf) cancelAnimationFrame(raf);
      base = null;
    };
  });
</script>

<div class="placa-recorrido" bind:this={caja}>
  <canvas
    bind:this={lienzo}
    aria-label="Placa con el recorrido de las señales por las pistas: arrastra para desplazar, rueda o pellizco para ampliar"
    onpointerdown={(e) => vista.abajo(lienzo!, e)}
    onpointermove={(e) => vista.mover(lienzo!, e)}
    onpointerup={(e) => vista.arriba(e)}
    onpointercancel={(e) => vista.arriba(e)}
    ondblclick={() => vista.ajustar()}
  ></canvas>
  <div class="caras" role="group" aria-label="Cara de la placa">
    <button type="button" aria-pressed={lado === 'F'} class:activo={lado === 'F'} onclick={() => cambiarLado('F')}>Cara superior</button>
    <button type="button" aria-pressed={lado === 'B'} class:activo={lado === 'B'} onclick={() => cambiarLado('B')}>Cara inferior</button>
  </div>
  {#if error}
    <p class="aviso">No se pudo cargar la placa: {error}</p>
  {:else if pintando}
    <p class="aviso">Pintando la placa…</p>
  {/if}
</div>

<style>
  .placa-recorrido {
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
  .caras {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.55);
  }
  .caras button {
    min-height: 32px;
    padding: 2px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #e6e9ee;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .caras button.activo {
    background: #f1f3f5;
    color: #1d232b;
    font-weight: 700;
  }
  .aviso {
    position: absolute;
    top: 10px;
    left: 12px;
    margin: 0;
    padding: 4px 10px;
    border-radius: 8px;
    background: var(--superficie);
    color: var(--tinta-suave);
  }
</style>
