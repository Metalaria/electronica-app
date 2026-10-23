<script lang="ts">
  // Logic-analyser style timing diagram of the selected signals, synchronised with the animation: the
  // cursor is the current instant; drag on the traces to scrub, wheel or pinch to zoom the time window.
  import { onMount } from 'svelte';
  import { app } from '../../../lib/estado.svelte';
  import { paleta } from '../../animaciones/nucleo/paleta';
  import { FAMILIA } from '../../animaciones/nucleo/dibujo';
  import { indice, tiempo, type Escenario, type Pista } from './modelo';

  let {
    escenario,
    t,
    ids,
    alMover,
  }: {
    escenario: Escenario;
    t: number;
    ids: string[];
    alMover: (t: number) => void;
  } = $props();

  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let ancho = $state(0);
  let ventana: [number, number] = $state([0, 1]);
  let escenarioPrevio: Escenario | null = null;

  const FILA = 26;
  const EJE = 24;
  const pistas = $derived(ids.map((id) => escenario.pistas.find((p) => p.id === id)).filter((p): p is Pista => !!p));
  const alto = $derived(EJE + pistas.length * FILA + 6);
  const izquierda = $derived(ancho < 520 ? 92 : 132);

  // New scenario: show it whole.
  $effect(() => {
    if (escenario !== escenarioPrevio) {
      escenarioPrevio = escenario;
      ventana = escenario.ventana ? [...escenario.ventana] : [0, escenario.duracion];
    }
  });

  // Follow the cursor while it plays.
  $effect(() => {
    const [a, b] = ventana;
    if (t < a || t > b) {
      const w = b - a;
      const na = Math.max(0, Math.min(escenario.duracion - w, t - w * 0.1));
      ventana = [na, na + w];
    }
  });

  function aX(x: number): number {
    const [a, b] = ventana;
    return izquierda + ((x - a) / (b - a)) * (ancho - izquierda - 8);
  }

  function deX(px: number): number {
    const [a, b] = ventana;
    return a + ((px - izquierda) / (ancho - izquierda - 8)) * (b - a);
  }

  function pintar(): void {
    const c = lienzo;
    if (!c || ancho <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(ancho * dpr);
    c.height = Math.round(alto * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const pal = paleta(app.tema);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pal.panel;
    ctx.fillRect(0, 0, ancho, alto);
    const [a, b] = ventana;
    // time axis
    ctx.font = `600 11px ${FAMILIA}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const paso = pasoEje((b - a) / Math.max(1, (ancho - izquierda) / 90));
    ctx.strokeStyle = pal.rejilla;
    ctx.lineWidth = 1;
    for (let x = Math.ceil(a / paso) * paso; x <= b; x += paso) {
      const X = Math.round(aX(x)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(X, EJE - 4);
      ctx.lineTo(X, alto);
      ctx.stroke();
      ctx.fillStyle = pal.tenue;
      ctx.fillText(tiempo(x, 3), X, 10);
    }
    // rows
    pistas.forEach((p, i) => {
      const y0 = EJE + i * FILA;
      if (i % 2) {
        ctx.fillStyle = pal.fondo2;
        ctx.fillRect(0, y0, ancho, FILA);
      }
      ctx.fillStyle = pal.tinta;
      ctx.textAlign = 'left';
      ctx.font = `700 12px ${FAMILIA}`;
      ctx.fillText(p.nombre, 6, y0 + FILA / 2, izquierda - 10);
      ctx.save();
      ctx.beginPath();
      ctx.rect(izquierda, y0, ancho - izquierda, FILA);
      ctx.clip();
      if (p.tipo === 'bit') dibujarBit(ctx, p, y0, pal.serie[i % 5]!, pal.tenue);
      else dibujarBus(ctx, p, y0, pal.serie[i % 5]!, pal.tinta, pal.tenue);
      ctx.restore();
    });
    // cursor
    const X = aX(t);
    if (X >= izquierda) {
      ctx.strokeStyle = pal.peligro;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X, EJE - 6);
      ctx.lineTo(X, alto);
      ctx.stroke();
    }
  }

  function pasoEje(min: number): number {
    const e = 10 ** Math.floor(Math.log10(min));
    for (const m of [1, 2, 5, 10]) if (m * e >= min) return m * e;
    return 10 * e;
  }

  function rango(p: Pista): [number, number] {
    const [a, b] = ventana;
    return [indice(p, a), indice(p, b)];
  }

  function dibujarBit(ctx: CanvasRenderingContext2D, p: Pista & { tipo: 'bit' }, y0: number, color: string, tenue: string): void {
    const [i0, i1] = rango(p);
    const yA = y0 + 5;
    const yB = y0 + FILA - 5;
    const [a, b] = ventana;
    const xMax = aX(b);
    // too many edges for the pixels: draw a band
    if (i1 - i0 > (ancho - izquierda) / 2.5) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(aX(Math.max(a, p.t[i0]!)), yA, xMax - aX(Math.max(a, p.t[i0]!)), yB - yA);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    let prevY: number | null = null;
    for (let i = i0; i <= i1; i++) {
      const x0 = aX(Math.max(a, p.t[i]!));
      const x1 = i + 1 < p.t.length ? aX(Math.min(b, p.t[i + 1]!)) : xMax;
      const val = p.v[i]!;
      const y = val === 1 ? yA : val === 0 ? yB : (yA + yB) / 2;
      if (prevY === null) ctx.moveTo(x0, y);
      else ctx.lineTo(x0, y);
      ctx.lineTo(x1, y);
      prevY = y;
    }
    ctx.stroke();
    void tenue;
  }

  function dibujarBus(ctx: CanvasRenderingContext2D, p: Pista & { tipo: 'bus' }, y0: number, color: string, tinta: string, tenue: string): void {
    const [i0, i1] = rango(p);
    const yA = y0 + 5;
    const yB = y0 + FILA - 5;
    const ym = (yA + yB) / 2;
    const [a, b] = ventana;
    const denso = i1 - i0 > (ancho - izquierda) / 3;
    ctx.font = `600 11px ${FAMILIA}`;
    ctx.textAlign = 'center';
    for (let i = i0; i <= i1; i++) {
      const x0 = aX(Math.max(a, p.t[i]!));
      const x1 = i + 1 < p.t.length ? aX(Math.min(b, p.t[i + 1]!)) : aX(b);
      const val = p.v[i];
      if (x1 - x0 < 0.3) continue;
      if (val === null || val === undefined) {
        ctx.strokeStyle = tenue;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x0, ym);
        ctx.lineTo(x1, ym);
        ctx.stroke();
        continue;
      }
      const s = Math.min(4, (x1 - x0) / 2);
      ctx.beginPath();
      ctx.moveTo(x0, ym);
      ctx.lineTo(x0 + s, yA);
      ctx.lineTo(x1 - s, yA);
      ctx.lineTo(x1, ym);
      ctx.lineTo(x1 - s, yB);
      ctx.lineTo(x0 + s, yB);
      ctx.closePath();
      ctx.fillStyle = color + '2e';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = denso ? 0.8 : 1.4;
      ctx.stroke();
      if (!denso && x1 - x0 > 18) {
        ctx.fillStyle = tinta;
        ctx.fillText(val, (x0 + x1) / 2, ym + 0.5, x1 - x0 - 6);
      }
    }
  }

  $effect(() => {
    void t;
    void ventana;
    void pistas;
    void ancho;
    void alto;
    void app.tema;
    pintar();
  });

  // ------------------------------------------------------------------ interaction

  const punteros = new Map<number, number>();
  let pellizco: { d: number; v: [number, number]; c: number } | null = null;

  function xDe(ev: PointerEvent | WheelEvent): number {
    return ev.clientX - lienzo!.getBoundingClientRect().left;
  }

  function abajo(ev: PointerEvent): void {
    lienzo?.setPointerCapture(ev.pointerId);
    punteros.set(ev.pointerId, xDe(ev));
    if (punteros.size === 2) {
      const [x1, x2] = [...punteros.values()] as [number, number];
      pellizco = { d: Math.abs(x1 - x2), v: [...ventana], c: deX((x1 + x2) / 2) };
    } else mover(ev);
  }

  function mover(ev: PointerEvent): void {
    if (!punteros.has(ev.pointerId)) return;
    punteros.set(ev.pointerId, xDe(ev));
    if (pellizco && punteros.size === 2) {
      const [x1, x2] = [...punteros.values()] as [number, number];
      const f = pellizco.d / Math.max(10, Math.abs(x1 - x2));
      zoomEn(pellizco.c, f, pellizco.v);
      return;
    }
    const x = xDe(ev);
    if (x >= izquierda) alMover(Math.max(0, Math.min(escenario.duracion, deX(x))));
  }

  function arriba(ev: PointerEvent): void {
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pellizco = null;
  }

  function zoomEn(centro: number, f: number, base: [number, number] = ventana): void {
    const D = escenario.duracion;
    const w = Math.max(D / 2000, Math.min(D, (base[1] - base[0]) * f));
    const r = (centro - base[0]) / (base[1] - base[0]);
    let a = centro - r * w;
    a = Math.max(0, Math.min(D - w, a));
    ventana = [a, a + w];
  }

  export function zoom(f: number): void {
    zoomEn(t, f);
  }

  export function todo(): void {
    ventana = [0, escenario.duracion];
  }

  function rueda(ev: WheelEvent): void {
    if (!ev.ctrlKey && !ev.altKey && Math.abs(ev.deltaX) <= Math.abs(ev.deltaY) && !ev.shiftKey && ev.deltaMode === 0 && Math.abs(ev.deltaY) < 50) return;
    ev.preventDefault();
    const x = xDe(ev);
    if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) || ev.shiftKey) {
      const w = ventana[1] - ventana[0];
      const d = ((ev.deltaX || ev.deltaY) / (ancho - izquierda)) * w;
      const a = Math.max(0, Math.min(escenario.duracion - w, ventana[0] + d));
      ventana = [a, a + w];
      return;
    }
    zoomEn(x >= izquierda ? deX(x) : t, Math.exp(ev.deltaY * (ev.ctrlKey ? 0.01 : 0.002)));
  }

  onMount(() => {
    const ro = new ResizeObserver((e) => {
      ancho = e[0]?.contentRect.width ?? 0;
    });
    if (caja) ro.observe(caja);
    lienzo?.addEventListener('wheel', rueda, { passive: false });
    return () => {
      ro.disconnect();
      lienzo?.removeEventListener('wheel', rueda);
    };
  });
</script>

<div class="analizador" bind:this={caja}>
  <canvas
    bind:this={lienzo}
    style:height={`${alto}px`}
    aria-label="Cronograma de las señales elegidas; arrastra para mover el instante"
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={arriba}
  ></canvas>
</div>

<style>
  .analizador {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
  }
  canvas {
    display: block;
    width: 100%;
    touch-action: pan-y;
    cursor: ew-resize;
  }
</style>
