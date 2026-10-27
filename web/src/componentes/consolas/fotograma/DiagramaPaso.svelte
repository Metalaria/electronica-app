<script lang="ts">
  // «Un fotograma»: the console's «Arquitectura» block diagram drawn as SVG, with only the blocks and wires of the
  // current step lit. Lit wires carry pulses that flow in the direction of the signal and end in an arrow; their
  // labels show the value on the wire. On narrow screens the view frames the lit part (tweened from step to step)
  // and a toggle shows the whole diagram; from 700 px the whole diagram is always shown.
  import { untrack } from 'svelte';
  import { app } from '../../../lib/estado.svelte';
  import { paleta } from '../../animaciones/nucleo/paleta';
  import type { Bloque, Conexion, Diagrama } from '../arquitectura/diagrama';
  import type { Paso, Senal } from './tipos';

  let {
    diagrama,
    extra = [],
    paso,
    etiqueta,
  }: {
    diagrama: Diagrama;
    extra?: Conexion[];
    paso: Paso;
    /** Accessible name of the picture. */
    etiqueta: string;
  } = $props();

  const uid = $props.id();
  const pal = $derived(paleta(app.tema));
  const CLASES = ['bus', 'dato', 'control', 'seleccion', 'reloj', 'interrupcion'] as const;
  type Clase = (typeof CLASES)[number];

  // Same colours as the «Arquitectura» canvas (arquitectura/dibujo.ts → colorClase).
  const colores = $derived<Record<Clase, string>>({
    bus: pal.acento,
    dato: pal.serie[0],
    control: pal.campoB,
    seleccion: pal.peligro,
    reloj: pal.campoE,
    interrupcion: pal.aviso,
  });

  const conexiones = $derived([...diagrama.conexiones, ...extra]);
  const activos = $derived(new Set(paso.bloques));
  const senales = $derived(new Map(paso.senales.map((s) => [s.id, s] as const)));

  // ------------------------------------------------------------------ text measuring (label pills)

  let medidor: CanvasRenderingContext2D | null = null;
  function ancho(texto: string, peso: number, tam: number): number {
    if (!medidor && typeof document !== 'undefined') medidor = document.createElement('canvas').getContext('2d');
    if (!medidor) return texto.length * tam * 0.55;
    medidor.font = `${peso} ${tam}px 'Source Sans 3', system-ui, sans-serif`;
    return medidor.measureText(texto).width;
  }

  function posEtiqueta(c: Conexion): [number, number] {
    if (c.pos) return c.pos;
    let mejor = -1;
    let p: [number, number] = c.puntos[0]!;
    for (let i = 1; i < c.puntos.length; i++) {
      const a = c.puntos[i - 1]!;
      const b = c.puntos[i]!;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > mejor) {
        mejor = l;
        p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - (c.etiqueta ? 6 : 0)];
      }
    }
    return p;
  }

  interface Pastilla {
    id: string;
    x: number;
    y: number;
    w: number;
    tam: number;
    texto: string;
    clase: Clase;
    activa: boolean;
  }

  function textoSenal(c: Conexion, s: Senal | undefined): string {
    if (!s) return c.etiqueta;
    const nombre = s.nombre ?? c.etiqueta;
    if (s.valor === undefined) return nombre;
    return nombre ? `${nombre} = ${s.valor}` : s.valor;
  }

  /** Labels at the diagram's own size (the framing uses them; the drawn ones may be larger). */
  function etiquetas(tam: number): Pastilla[] {
    const r: Pastilla[] = [];
    for (const c of conexiones) {
      const s = senales.get(c.id);
      const texto = textoSenal(c, s);
      if (!texto) continue;
      const [x, y] = s?.pos ?? posEtiqueta(c);
      const activa = !!s;
      // idle labels grow less: they are context, not the step
      const t = activa ? tam : Math.min(tam, 13);
      const w = ancho(texto, activa ? 700 : 600, t) + t;
      // keep the pill inside the drawing
      const xc = Math.min(Math.max(x, w / 2 + 2), diagrama.ancho - w / 2 - 2);
      r.push({ id: c.id, x: xc, y, w, tam: t, texto, clase: c.clase, activa });
    }
    // lit labels on top
    return r.sort((a, b) => Number(a.activa) - Number(b.activa));
  }

  function puntos(c: Conexion, s: Senal | undefined): string {
    const p = s?.sentido === -1 ? [...c.puntos].reverse() : c.puntos;
    return p.map(([x, y]) => `${x},${y}`).join(' ');
  }

  // ------------------------------------------------------------------ framing

  let anchoCaja = $state(0);
  let completo = $state(false);
  const estrecho = $derived(anchoCaja > 0 && anchoCaja < 700);
  const encuadrado = $derived(estrecho && !completo);
  /** Width / height of the box on narrow screens. */
  const ASPECTO = 1.2;
  /**
   * Smallest zoom (CSS px per diagram unit) on narrow screens: a step whose parts are further apart is drawn wider
   * than the screen, in a box that scrolls sideways, instead of shrinking the text out of reach.
   */
  const ESCALA_MIN = 0.62;

  type Caja = [number, number, number, number];

  function cajaActiva(): Caja | null {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const meter = (x: number, y: number) => {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    };
    for (const b of diagrama.bloques) {
      if (!activos.has(b.id)) continue;
      meter(b.x, b.y);
      meter(b.x + b.w, b.y + b.h);
    }
    // Long buses would always widen the frame to the whole board: wires count only when no block is lit.
    if (!Number.isFinite(x0))
      for (const c of conexiones) {
        if (!senales.has(c.id)) continue;
        for (const [x, y] of c.puntos) meter(x, y);
      }
    for (const p of etiquetas(11.5)) {
      if (!p.activa) continue;
      meter(p.x - p.w / 2, p.y - 9);
      meter(p.x + p.w / 2, p.y + 9);
    }
    return Number.isFinite(x0) ? [x0, y0, x1 - x0, y1 - y0] : null;
  }

  function encuadre(): Caja {
    const W = diagrama.ancho;
    const H = diagrama.alto;
    if (!encuadrado) return [0, 0, W, H];
    const c = cajaActiva();
    if (!c) return [0, 0, W, H];
    const margen = 22;
    // never zoom in more than 1.35 CSS px per diagram unit
    const minW = anchoCaja / 1.35;
    let w = Math.max(c[2] + 2 * margen, minW);
    let h: number;
    if (w * ESCALA_MIN > anchoCaja) {
      // wide step: keep its own width (it scrolls) and a height that still reads well
      w = Math.min(w, W);
      h = Math.min(H, Math.max(c[3] + 2 * margen, anchoCaja / ESCALA_MIN / ASPECTO));
    } else {
      h = Math.max(c[3] + 2 * margen, w / ASPECTO);
      w = Math.max(w, h * ASPECTO);
      if (w > W) {
        w = W;
        h = w / ASPECTO;
      }
      if (h > H) h = H;
    }
    const cx = c[0] + c[2] / 2;
    const cy = c[1] + c[3] / 2;
    const x = w >= W ? (W - w) / 2 : Math.min(Math.max(cx - w / 2, 0), W - w);
    const y = h >= H ? (H - h) / 2 : Math.min(Math.max(cy - h / 2, 0), H - h);
    return [x, y, w, h];
  }

  const destino = $derived(encuadre());
  /** Label size in diagram units: never under about 10.5 CSS px when the frame is zoomed out. */
  /** CSS width of the drawing: wider than the box for a wide step on a narrow screen. */
  const anchoSvg = $derived(encuadrado ? Math.max(anchoCaja, destino[2] * ESCALA_MIN) : anchoCaja);
  const ancha = $derived(anchoSvg > anchoCaja + 1);
  const tam = $derived(anchoSvg ? Math.min(20, Math.max(11.5, (10.5 * destino[2]) / anchoSvg)) : 11.5);
  const pastillas = $derived(etiquetas(tam));

  let vista = $state<Caja>([0, 0, 1000, 560]);
  let raf = 0;
  let primera = true;
  $effect(() => {
    const fin = destino;
    const reducido = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const antes = untrack(() => vista);
    // a change of shape (a wide step) is not tweened: the box itself changes size
    const otraForma = Math.abs(antes[2] / antes[3] - fin[2] / fin[3]) > 0.02;
    cancelAnimationFrame(raf);
    if (primera || reducido || otraForma) {
      primera = false;
      vista = fin;
      return;
    }
    const desde = untrack(() => [...vista]) as Caja;
    const t0 = performance.now();
    const T = 420;
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / T);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      vista = desde.map((v, i) => v + (fin[i]! - v) * e) as Caja;
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  });

  const aspecto = $derived(encuadrado ? destino[2] / destino[3] : diagrama.ancho / diagrama.alto);

  // a wide step opens centred on its parts
  let caja: HTMLDivElement | undefined = $state();
  $effect(() => {
    void destino;
    if (!caja) return;
    const c = caja;
    const x = ancha ? (anchoSvg - anchoCaja) / 2 : 0;
    // after the browser has laid out the new width
    const r = requestAnimationFrame(() => (c.scrollLeft = x));
    return () => cancelAnimationFrame(r);
  });

  // ------------------------------------------------------------------ block text

  function cabe(b: Bloque, texto: string, tam: number, peso: number): number | undefined {
    const w = ancho(texto, peso, tam);
    return w > b.w - 12 ? b.w - 12 : undefined;
  }
</script>

<div class="diagrama-paso" bind:clientWidth={anchoCaja} data-encuadrado={encuadrado}>
  <div class="desliza" bind:this={caja} class:ancha>
    <svg
      style:width={encuadrado && ancha ? `${anchoSvg}px` : undefined}
      viewBox={vista.map((v) => v.toFixed(2)).join(' ')}
      style:aspect-ratio={aspecto}
      role="img"
      aria-label={etiqueta}
      style:--d-fondo={pal.fondo}
      style:--d-panel={pal.panel}
      style:--d-tinta={pal.tinta}
      style:--d-suave={pal.suave}
      style:--d-linea={pal.linea}
      style:--d-acento={pal.acento}
    >
      <defs>
        {#each CLASES as k (k)}
          <marker id={`${uid}-${k}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={colores[k]} />
          </marker>
        {/each}
      </defs>
      <rect class="fondo" x="-2000" y="-2000" width="5000" height="5000" />

      <!-- idle wires -->
      <g class="hilos">
        {#each conexiones as c (c.id)}
          <polyline points={puntos(c, undefined)} stroke-width={c.bits > 1 ? 5 : 1.8} />
        {/each}
      </g>

      <!-- blocks -->
      {#each diagrama.bloques as b (b.id)}
        {@const on = activos.has(b.id)}
        <g class="bloque" class:on class:apagado={!on} class:externo={b.externo} data-bloque={b.id} data-activo={on}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="10" />
          <text class="t1" x={b.x + b.w / 2} y={b.y + b.h / 2 - 7} textLength={cabe(b, b.titulo, 15, 700)} lengthAdjust="spacingAndGlyphs">{b.titulo}</text>
          <text class="t2" x={b.x + b.w / 2} y={b.y + b.h / 2 + 11} textLength={cabe(b, b.sub, 11.5, 600)} lengthAdjust="spacingAndGlyphs">{b.sub}</text>
        </g>
      {/each}

      <!-- lit wires: halo, line with arrow, pulses -->
      {#each conexiones as c (c.id)}
        {@const s = senales.get(c.id)}
        {#if s}
          {@const pts = puntos(c, s)}
          {@const ancho = c.bits > 1 ? 5 : 2.6}
          <g class="activa" data-conexion={c.id} data-activa="true" data-sentido={s.sentido} style:--c={colores[c.clase]}>
            <polyline class="halo" points={pts} stroke-width={c.bits > 1 ? 12 : 7} />
            <polyline class="linea" points={pts} stroke-width={ancho} marker-end={`url(#${uid}-${c.clase})`} />
            <polyline class="pulso" points={pts} stroke-width={c.bits > 1 ? 2.2 : 1.6} />
          </g>
        {/if}
      {/each}

      <!-- labels -->
      {#each pastillas as p (p.id)}
        <g class="pastilla" class:activa={p.activa} style:--c={colores[p.clase]} data-etiqueta={p.id}>
          <rect x={p.x - p.w / 2} y={p.y - p.tam * 0.78} width={p.w} height={p.tam * 1.56} rx={p.tam * 0.78} />
          <text x={p.x} y={p.y + 0.5} font-size={p.tam}>{p.texto}</text>
        </g>
      {/each}
    </svg>
  </div>
  {#if ancha}<p class="pista">Este paso ocupa más que la pantalla: desliza el diagrama a los lados.</p>{/if}
  {#if estrecho}
    <button type="button" class="ver-todo" aria-pressed={completo} onclick={() => (completo = !completo)}>
      {completo ? 'Acercar a este paso' : 'Ver el diagrama entero'}
    </button>
  {/if}
</div>

<style>
  .diagrama-paso {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .desliza {
    min-width: 0;
    overflow-x: auto;
    border-radius: 12px;
  }
  .pista {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 12px;
    font-family: var(--sans);
    user-select: none;
  }
  .fondo {
    fill: var(--d-fondo);
  }
  .hilos polyline {
    fill: none;
    stroke: var(--d-tinta);
    stroke-opacity: 0.16;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .bloque rect {
    fill: var(--d-panel);
    stroke: var(--d-linea);
    stroke-width: 1.4;
  }
  .bloque.externo rect {
    stroke-dasharray: 6 4;
  }
  .bloque.on rect {
    fill: color-mix(in srgb, var(--d-acento) 16%, var(--d-panel));
    stroke: var(--d-acento);
    stroke-width: 2.6;
  }
  .bloque.apagado {
    opacity: 0.5;
  }
  .bloque text {
    text-anchor: middle;
    dominant-baseline: middle;
  }
  .t1 {
    fill: var(--d-tinta);
    font-size: 15px;
    font-weight: 700;
  }
  .t2 {
    fill: var(--d-suave);
    font-size: 11.5px;
    font-weight: 600;
  }
  .activa polyline {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .halo {
    stroke: var(--c);
    stroke-opacity: 0.25;
  }
  .linea {
    stroke: var(--c);
  }
  .pulso {
    stroke: #fff;
    stroke-opacity: 0.85;
    stroke-dasharray: 6 12;
    animation: fluir 0.9s linear infinite;
  }
  :global(:root[data-tema='oscuro']) .pulso {
    stroke: #10161d;
    stroke-opacity: 0.7;
  }
  @keyframes fluir {
    to {
      stroke-dashoffset: -18;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pulso {
      animation: none;
    }
  }
  .pastilla rect {
    fill: var(--d-fondo);
    fill-opacity: 0.9;
  }
  .pastilla text {
    fill: var(--d-suave);
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: middle;
  }
  .pastilla.activa rect {
    fill: var(--d-panel);
    fill-opacity: 1;
    stroke: var(--c);
    stroke-width: 1.4;
  }
  .pastilla.activa text {
    fill: var(--c);
    font-weight: 700;
  }
  .ver-todo {
    justify-self: start;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 15px;
    font-weight: 600;
  }
  .ver-todo:hover {
    border-color: var(--acento-borde);
  }
</style>
