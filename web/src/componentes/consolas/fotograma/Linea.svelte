<script lang="ts">
  // Timeline of «Un fotograma»: on top, the whole segment with its video phases (visible lines, HBlank, VBlank…);
  // below, a zoomed window around the cursor (its width follows the speed level) with one row per bus — every
  // access as a box, coloured by what it is — the instruction boundaries and the pixel output. Drag to move in time.
  import { onMount } from 'svelte';
  import { app } from '../../../lib/estado.svelte';
  import { colorGrupo } from './colores';
  import type { Reproductor } from './reproductor';
  import { ultimoHasta } from './traza';

  let { rep, alMover }: { rep: Reproductor; alMover: () => void } = $props();

  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let ancho = $state(0);
  const oscuro = $derived(app.tema === 'oscuro');
  const tr = $derived(rep.traza);
  const filas = $derived(tr.buses.length + 2);
  const ALTO_RESUMEN = 26;
  const ALTO_FILA = 22;
  const alto = $derived(ALTO_RESUMEN + 18 + filas * ALTO_FILA + 6);
  const MARGEN = 74;

  const COLOR_FASE: Record<string, [string, string]> = {
    visible: ['#9cc3f5', '#2f5f99'],
    modo3: ['#9cc3f5', '#2f5f99'],
    sprites: ['#c9a7f0', '#64428f'],
    modo2: ['#c9a7f0', '#64428f'],
    precarga: ['#b3b8f2', '#4a4f8f'],
    relleno: ['#d5d9df', '#3c434d'],
    modo0: ['#d5d9df', '#3c434d'],
    postrender: ['#c4cad3', '#353b44'],
    vblank: ['#5b6474', '#14181e'],
    modo1: ['#5b6474', '#14181e'],
    prerender: ['#f3cf8a', '#7a5a1d'],
    apagada: ['#8b929c', '#22262c'],
  };

  function colorFase(id: string): string {
    const c = COLOR_FASE[id] ?? ['#cccccc', '#444444'];
    return oscuro ? c[1] : c[0];
  }

  function ventana(): [number, number] {
    const s = rep.seg;
    const v = tr.m.video;
    let w: number;
    switch (rep.nivel) {
      case 'cuadro':
        return [s.t0, s.t1];
      case 'linea':
        w = v.puntosPorLinea * rep.upp * 1.15;
        break;
      case 'puntos':
        w = 48 * rep.upp;
        break;
      default:
        w = rep.unidadesCiclo * 6;
    }
    let a = rep.t - w * 0.4;
    a = Math.max(s.t0, Math.min(s.t1 - w, a));
    return [a, a + w];
  }

  const hex = (v: number, n: number) => v.toString(16).toUpperCase().padStart(n, '0');

  // The static part (phases, accesses, pixels) is cached in a bitmap while the zoomed window does not move (always at
  // «Cuadro entero», where the window is the whole segment): then a frame only blits it and draws the cursors.
  let fondo: HTMLCanvasElement | null = null;
  let claveFondo = '';

  function pintar(): void {
    const c = lienzo;
    if (!c || ancho <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(ancho * dpr);
    const H = Math.round(alto * dpr);
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const [wa, wb] = ventana();
    const clave = `${wa}|${wb}|${W}|${H}|${oscuro}|${rep.seg.id}`;
    if (clave !== claveFondo || !fondo) {
      fondo ??= document.createElement('canvas');
      if (fondo.width !== W) fondo.width = W;
      if (fondo.height !== H) fondo.height = H;
      const f = fondo.getContext('2d')!;
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      f.clearRect(0, 0, ancho, alto);
      pintarFondo(f, wa, wb);
      claveFondo = clave;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(fondo, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // cursors and the window on the overview
    const s = rep.seg;
    const anchoUtil = ancho - MARGEN - 6;
    const xr = (t: number) => MARGEN + ((t - s.t0) / (s.t1 - s.t0)) * anchoUtil;
    const xw = (t: number) => MARGEN + ((t - wa) / (wb - wa)) * anchoUtil;
    ctx.strokeStyle = oscuro ? '#e6e9ee' : '#1d232b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(xr(wa), 1, Math.max(2, xr(wb) - xr(wa)), ALTO_RESUMEN - 2);
    ctx.fillStyle = '#ff3b6b';
    ctx.fillRect(xr(rep.t) - 1, 0, 2, ALTO_RESUMEN);
    const y0 = ALTO_RESUMEN + 18;
    ctx.fillRect(xw(rep.t) - 1, y0 - 14, 2, filas * ALTO_FILA + 14);
    (globalThis as unknown as { __epaFotogramaLinea?: unknown }).__epaFotogramaLinea = { wa, wb, margen: MARGEN, anchoUtil, y0, resumen: ALTO_RESUMEN };
  }

  function pintarFondo(ctx: CanvasRenderingContext2D, wa: number, wb: number): void {
    const suave = oscuro ? '#9aa3ae' : '#5c6672';
    const s = rep.seg;
    const L = s.t1 - s.t0;
    const anchoUtil = ancho - MARGEN - 6;
    ctx.font = '600 11px "Source Sans 3", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    // --- overview: phases of the whole segment
    const ft = tr.array(tr.m.fases.t);
    const fk = tr.array(tr.m.fases.k);
    let i = Math.max(0, ultimoHasta(ft, s.t0));
    const xr = (t: number) => MARGEN + ((t - s.t0) / L) * anchoUtil;
    ctx.fillStyle = suave;
    ctx.fillText('Tramo', 4, ALTO_RESUMEN / 2);
    for (; i < ft.length && ft[i]! < s.t1; i++) {
      const a = Math.max(s.t0, ft[i]!);
      const b = Math.min(s.t1, i + 1 < ft.length ? ft[i + 1]! : s.t1);
      ctx.fillStyle = colorFase(tr.m.fases.tipos[fk[i]!]?.id ?? '');
      ctx.fillRect(xr(a), 2, Math.max(0.6, xr(b) - xr(a)), ALTO_RESUMEN - 4);
    }
    // --- zoomed window (clipped to the area right of the row labels)
    const y0 = ALTO_RESUMEN + 18;
    ctx.save();
    ctx.beginPath();
    ctx.rect(MARGEN - 2, y0 - 16, anchoUtil + 4, alto - y0 + 16);
    ctx.clip();
    const xw = (t: number) => MARGEN + ((t - wa) / (wb - wa)) * anchoUtil;
    const upx = (wb - wa) / anchoUtil; // units per CSS px
    // phases as a thin band
    i = Math.max(0, ultimoHasta(ft, wa));
    for (; i < ft.length && ft[i]! < wb; i++) {
      const a = Math.max(wa, ft[i]!);
      const b = Math.min(wb, i + 1 < ft.length ? ft[i + 1]! : wb);
      ctx.fillStyle = colorFase(tr.m.fases.tipos[fk[i]!]?.id ?? '');
      ctx.fillRect(xw(a), y0 - 12, Math.max(0.6, xw(b) - xw(a)), 6);
    }
    // instruction boundaries
    const it = tr.ins.t;
    let k = Math.max(0, ultimoHasta(it, wa));
    let ultimoX = -1e9;
    for (; k < it.length && it[k]! <= wb; k++) {
      const x = xw(it[k]!);
      if (x - ultimoX < 1.5) continue;
      ultimoX = x;
      ctx.fillStyle = oscuro ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, y0 + 3, 1, filas * ALTO_FILA - 6);
    }
    // one row per bus
    tr.buses.forEach((b, bi) => {
      const y = y0 + (bi + 1) * ALTO_FILA;
      let j = Math.max(0, ultimoHasta(b.t, wa - rep.duracion(bi, Math.max(0, ultimoHasta(b.t, wa)))));
      let ux = -1e9;
      for (; j < b.t.length && b.t[j]! < wb; j++) {
        const t = b.t[j]!;
        const x = xw(t);
        const w = Math.max(1, rep.duracion(bi, j) / upx - 0.6);
        if (w < 2 && x - ux < 1) continue;
        ux = x;
        const f = b.f[j]!;
        let col: string;
        if (f & 8) col = colorGrupo('dma', oscuro);
        else if (f & 1) col = colorGrupo('control', oscuro);
        else if (f & 2) col = colorGrupo('datos', oscuro);
        else if (f & 36) col = oscuro ? '#4b5563' : '#c3c8cf';
        else col = colorGrupo('direccion', oscuro);
        if (b.k && b.def.id !== 'cpu') {
          const kk = b.k[j]!;
          const tipos = b.def.tipos?.[kk]?.id ?? '';
          col = tipos.includes('spr') ? colorGrupo('interrupcion', oscuro) : tipos === 'nt' || tipos === 'mapa' ? colorGrupo('seleccion', oscuro) : tipos === 'at' || tipos === 'atrib' ? colorGrupo('control', oscuro) : tipos.includes('oam') ? (oscuro ? '#6b7280' : '#b8bec7') : tipos === 'cpu' || tipos === 'hdma' || tipos === 'dma' ? colorGrupo('dma', oscuro) : colorGrupo('video', oscuro);
        }
        ctx.fillStyle = col;
        ctx.fillRect(x, y + 3, w, ALTO_FILA - 6);
        if (w > 44) {
          ctx.fillStyle = '#fff';
          ctx.fillText(`${hex(b.a[j]!, b.def.anchoDir > 8 ? 4 : 2)}${w > 70 ? ' ' + hex(b.d[j]!, 2) : ''}`, x + 3, y + ALTO_FILA / 2);
        }
      }
    });
    ctx.restore();
    // row labels (outside the clipped area)
    ctx.fillStyle = suave;
    ctx.fillText('Instr.', 4, y0 + ALTO_FILA / 2);
    tr.buses.forEach((b, bi) => ctx.fillText(b.def.id === 'cpu' ? 'CPU' : b.def.id.toUpperCase(), 4, y0 + (bi + 1) * ALTO_FILA + ALTO_FILA / 2));
    // pixel output
    const yp = y0 + (tr.buses.length + 1) * ALTO_FILA;
    ctx.fillStyle = suave;
    ctx.fillText('Píxeles', 4, yp + ALTO_FILA / 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(MARGEN - 2, yp, anchoUtil + 4, ALTO_FILA);
    ctx.clip();
    const pt = tr.array(tr.m.pixeles.t);
    let p = Math.max(s.pixel0, ultimoHasta(pt, wa, s.pixel0, s.pixel1 - 1));
    ctx.fillStyle = colorGrupo('video', oscuro);
    let px0 = -1;
    let px1 = -1;
    for (; p < s.pixel1 && pt[p]! < wb; p++) {
      const x = xw(pt[p]!);
      if (px0 < 0) {
        px0 = x;
        px1 = x;
      } else if (x - px1 <= 2.5) px1 = x;
      else {
        ctx.fillRect(px0, yp + 6, Math.max(1, px1 - px0 + 1), ALTO_FILA - 12);
        px0 = x;
        px1 = x;
      }
    }
    if (px0 >= 0) ctx.fillRect(px0, yp + 6, Math.max(1, px1 - px0 + 1), ALTO_FILA - 12);
    ctx.restore();
  }

  let arrastre: 'resumen' | 'zoom' | null = null;
  let ventanaArrastre: [number, number] = [0, 1];

  function tiempoEn(ev: PointerEvent): number {
    const r = lienzo!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (ev.clientX - r.left - MARGEN) / (ancho - MARGEN - 6)));
    if (arrastre === 'resumen') return rep.seg.t0 + x * (rep.seg.t1 - rep.seg.t0);
    return ventanaArrastre[0] + x * (ventanaArrastre[1] - ventanaArrastre[0]);
  }

  function abajo(ev: PointerEvent): void {
    const r = lienzo!.getBoundingClientRect();
    arrastre = ev.clientY - r.top < ALTO_RESUMEN + 6 ? 'resumen' : 'zoom';
    ventanaArrastre = ventana();
    lienzo!.setPointerCapture(ev.pointerId);
    rep.jugando = false;
    rep.irA(tiempoEn(ev));
    alMover();
  }

  function mover(ev: PointerEvent): void {
    if (!arrastre) return;
    rep.irA(tiempoEn(ev));
    alMover();
  }

  function arriba(): void {
    arrastre = null;
  }

  $effect(() => {
    void oscuro;
    void ancho;
    pintar();
  });

  onMount(() => {
    const f = () => pintar();
    rep.oyentes.add(f);
    const ro = new ResizeObserver((e) => {
      ancho = e[0]?.contentRect.width ?? 0;
    });
    if (caja) ro.observe(caja);
    return () => {
      rep.oyentes.delete(f);
      ro.disconnect();
    };
  });
</script>

<div class="linea" bind:this={caja}>
  <canvas
    bind:this={lienzo}
    style:height="{alto}px"
    aria-label="Línea de tiempo: arriba el tramo entero con sus fases, abajo los accesos de cada bus alrededor del cursor; arrastra para moverte"
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={arriba}
  ></canvas>
</div>

<style>
  .linea {
    width: 100%;
    min-width: 0;
  }
  canvas {
    display: block;
    width: 100%;
    touch-action: pan-y;
    cursor: ew-resize;
  }
</style>
