<script lang="ts">
  // Live layer over the book's schematics: wires coloured by their node voltage, charge particles along the
  // wires and through the parts (one canvas, one requestAnimationFrame loop for the whole figure, running
  // only on screen), and hover/tap on a wire, node or part with its voltage, current and power. Without a
  // simulation it highlights the net under the pointer and its terminals (topology only).
  import { onMount, untrack } from 'svelte';
  import type { Caja } from '../tipos';
  import type { EstadoEsquema, Seleccion } from './modelo.svelte';
  import { avanzar, dibujar, repartir } from './particulas';
  import { colorTension } from './color';
  import { movimiento, tactil } from '../carga.svelte';
  import Ficha from './Ficha.svelte';

  let {
    esquemas,
    vista,
    k,
    activo,
    /** Seconds of real time per period of the transient. */
    duracionPeriodo = 4,
    visible = null,
  }: {
    esquemas: EstadoEsquema[];
    vista: Caja;
    k: number;
    activo: boolean;
    duracionPeriodo?: number;
    /** Part of the drawing on screen when the parent zooms it (SVG units): the canvas covers only that. */
    visible?: Caja | null;
  } = $props();

  let lienzo: HTMLCanvasElement | undefined = $state();

  const radio = $derived((tactil ? 22 : 9) / Math.max(k, 0.01));

  // ---------------------------------------------------------------- particles
  $effect(() => {
    const kk = k;
    untrack(() => {
      for (const e of esquemas) if (e.simulable) repartir(e.caminos, kk);
      pintar();
    });
  });

  type Stats = { n: number; total: number; max: number; marcas: number[] };
  const g = globalThis as unknown as { __epaFiguras?: Stats };

  function pintar(): void {
    const c = lienzo;
    if (!c || k <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const z = zonaLienzo;
    const W = Math.max(1, Math.round(z[2] * k * dpr));
    const H = Math.max(1, Math.round(z[3] * k * dpr));
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(k * dpr, 0, 0, k * dpr, -z[0] * k * dpr, -z[1] * k * dpr);
    for (const e of esquemas) {
      if (!e.simulable || !e.op) continue;
      const sel = e.seleccion ?? e.hover;
      const foco = sel ? (sel.k === 'elem' ? sel.id : e.nodoDe(sel)) : null;
      dibujar(ctx, e, e.caminos, k, foco);
    }
  }

  /** The particle canvas covers only the drawings (a figure may also hold plots): fewer pixels per frame. */
  const zonaLienzo = $derived.by((): Caja => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const e of esquemas) {
      if (!e.simulable) continue;
      const m = 6;
      x0 = Math.min(x0, e.limites[0] - m);
      y0 = Math.min(y0, e.limites[1] - m);
      x1 = Math.max(x1, e.limites[2] + m);
      y1 = Math.max(y1, e.limites[3] + m);
    }
    if (!(x1 > x0)) return vista;
    // Zoomed in: never more canvas pixels than the window shows (same cost at any zoom).
    const lim = visible ?? vista;
    x0 = Math.max(vista[0], lim[0], x0);
    y0 = Math.max(vista[1], lim[1], y0);
    x1 = Math.min(vista[0] + vista[2], lim[0] + lim[2], x1);
    y1 = Math.min(vista[1] + vista[3], lim[1] + lim[3], y1);
    return [x0, y0, Math.max(1 / Math.max(k, 0.01), x1 - x0), Math.max(1 / Math.max(k, 0.01), y1 - y0)];
  });

  const enMarcha = $derived(activo && esquemas.some((e) => e.simulable && e.reproduciendo));

  let raf = 0;
  let ultimo = 0;
  let ultimoColor = 0;
  function bucle(ts: number): void {
    raf = 0;
    if (!enMarcha) {
      ultimo = 0;
      return;
    }
    const t0 = performance.now();
    const dt = ultimo ? Math.min(0.05, (ts - ultimo) / 1000) : 1 / 60;
    ultimo = ts;
    // Colours and readouts follow the transient at ~15 Hz (DOM and blending work); particles every frame.
    const refrescar = ts - ultimoColor > 66;
    if (refrescar) ultimoColor = ts;
    for (const e of esquemas) {
      if (!e.simulable || !e.reproduciendo) continue;
      if (e.tran) {
        if (e.fase !== e.faseEscrita) e.faseFina = e.fase;
        e.faseFina = (e.faseFina + dt / (2 * duracionPeriodo)) % 1;
        if (refrescar) e.fase = e.faseEscrita = e.faseFina;
      }
      avanzar(e, e.caminos, dt, k);
    }
    pintar();
    const st = (g.__epaFiguras ??= { n: 0, total: 0, max: 0, marcas: [] });
    const coste = performance.now() - t0;
    st.n++;
    st.total += coste;
    st.max = Math.max(st.max, coste);
    st.marcas.push(ts);
    if (st.marcas.length > 600) st.marcas.splice(0, 300);
    raf = requestAnimationFrame(bucle);
  }

  $effect(() => {
    if (enMarcha && !raf) {
      ultimo = 0;
      raf = requestAnimationFrame(bucle);
    }
  });

  // Paused: redraw when what the particles show changes (results, direction, selection, time).
  $effect(() => {
    for (const e of esquemas) {
      void e.op;
      void e.tran;
      void e.fase;
      void e.electrones;
      void e.seleccion;
      void e.hover;
    }
    void lienzo;
    void zonaLienzo;
    untrack(() => {
      for (const e of esquemas) if (e.fase !== e.faseEscrita) e.faseFina = e.faseEscrita = e.fase;
      if (!enMarcha) pintar();
    });
  });

  onMount(() => {
    // Reduced motion: start paused (particles stay visible and still; play is one tap away).
    if (movimiento.reducido) for (const e of esquemas) e.reproduciendo = false;
    return () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
  });

  // ---------------------------------------------------------------- pointer
  function aSvg(ev: PointerEvent, el: HTMLElement, caja: Caja): [number, number] {
    const r = el.getBoundingClientRect();
    return [caja[0] + ((ev.clientX - r.left) / (r.width || 1)) * caja[2], caja[1] + ((ev.clientY - r.top) / (r.height || 1)) * caja[3]];
  }

  /** Hit region of a schematic: its drawing plus a margin. */
  function region(e: EstadoEsquema): Caja {
    const [x0, y0, x1, y1] = e.limites;
    const m = Math.max(radio, 4);
    const a = Math.max(vista[0], x0 - m);
    const b = Math.max(vista[1], y0 - m);
    return [a, b, Math.min(vista[0] + vista[2], x1 + m) - a, Math.min(vista[1] + vista[3], y1 + m) - b];
  }

  let pulsado: { x: number; y: number; id: number } | null = null;

  function mover(ev: PointerEvent, e: EstadoEsquema, caja: Caja) {
    if (ev.pointerType !== 'mouse') return;
    const [X, Y] = aSvg(ev, ev.currentTarget as HTMLElement, caja);
    const h = e.buscar(X, Y, radio);
    if (!igual(h, e.hover)) e.hover = h;
  }

  function igual(a: Seleccion, b: Seleccion): boolean {
    return a === b || (!!a && !!b && a.k === b.k && a.id === b.id);
  }

  function abajo(ev: PointerEvent) {
    pulsado = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
  }

  function arriba(ev: PointerEvent, e: EstadoEsquema, caja: Caja) {
    const p = pulsado;
    pulsado = null;
    if (!p || p.id !== ev.pointerId || Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > 10) return;
    const [X, Y] = aSvg(ev, ev.currentTarget as HTMLElement, caja);
    const h = e.buscar(X, Y, radio);
    e.seleccion = igual(h, e.seleccion) ? null : h;
    // One selection per figure.
    for (const o of esquemas) if (o !== e) o.seleccion = null;
  }

  function teclas(ev: KeyboardEvent, e: EstadoEsquema) {
    if (ev.key === 'Escape' && (e.seleccion || e.hover)) {
      e.seleccion = null;
      e.hover = null;
      ev.preventDefault();
    } else if (ev.key === ' ' && e.simulable) {
      ev.preventDefault();
      e.reproduciendo = !e.reproduciendo;
    }
  }

  function enfocar(e: EstadoEsquema) {
    // Keyboard users get the first wire selected, so the readout appears.
    if (!e.seleccion && e.caminos[0]) e.seleccion = { k: 'tramo', id: e.caminos[0].clave.id };
  }

  const pct = (v: number, base: number, largo: number) => `${(((v - base) / largo) * 100).toFixed(3)}%`;
  const puntos = (pts: [number, number][]) => pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const ref = (e: EstadoEsquema) => Math.max(Math.abs(e.rangos.vmin), Math.abs(e.rangos.vmax));
</script>

<!-- Node voltages: halos multiplied over the drawing, so the black wires stay on top of their colour. -->
<svg class="capa-v" viewBox={vista.join(' ')} preserveAspectRatio="none" aria-hidden="true">
  {#each esquemas as e (e.indice)}
    {#if e.simulable && e.op}
      {@const r = ref(e)}
      {@const foco = e.nodoDe(e.seleccion ?? e.hover)}
      {#each e.nodos as n (n.id)}
        {@const v = e.tension(n.id) ?? 0}
        {@const c = colorTension(v, r)}
        <g stroke={c} fill={c} opacity={foco && foco !== n.id ? 0.45 : 1}>
          {#each n.tramos as t, i (i)}
            <polyline points={puntos(t)} class="halo" class:foco={foco === n.id} />
          {/each}
          {#each n.sueltos as p, i (i)}
            <circle cx={p[0]} cy={p[1]} r={(foco === n.id ? 6 : 4.5) / k} />
          {/each}
          {#each n.terminales as t, i (i)}
            <circle cx={t.p[0]} cy={t.p[1]} r={3.4 / k} />
          {/each}
        </g>
      {/each}
    {/if}
  {/each}
</svg>

{#if esquemas.some((e) => e.simulable)}
<canvas
  class="capa-p"
  bind:this={lienzo}
  aria-hidden="true"
  style:left={pct(zonaLienzo[0], vista[0], vista[2])}
  style:top={pct(zonaLienzo[1], vista[1], vista[3])}
  style:width={`${((zonaLienzo[2] / vista[2]) * 100).toFixed(3)}%`}
  style:height={`${((zonaLienzo[3] / vista[3]) * 100).toFixed(3)}%`}
></canvas>
{/if}

<!-- Highlights of the item under the pointer or selected. -->
<svg class="capa-s" viewBox={vista.join(' ')} preserveAspectRatio="none" aria-hidden="true">
  {#each esquemas as e (e.indice)}
    {@const s = e.seleccion ?? e.hover}
    {#if s}
      {@const nodo = e.nodoDe(s)}
      {#if nodo}
        {@const n = e.nodos.find((x) => x.id === nodo)}
        {#if n}
          {#each n.tramos as t, i (i)}
            <polyline points={puntos(t)} class="marca-red" class:topologia={!e.simulable} />
          {/each}
          {#each n.terminales as t, i (i)}
            <circle class="marca-term" class:topologia={!e.simulable} cx={t.p[0]} cy={t.p[1]} r={5 / k} />
          {/each}
          {#each n.sueltos as p, i (i)}
            <circle class="marca-term" class:topologia={!e.simulable} cx={p[0]} cy={p[1]} r={5 / k} />
          {/each}
        {/if}
      {:else if s.k === 'elem'}
        {@const el = e.elementos.find((x) => x.e.id === s.id)}
        {#if el?.caja}
          {@const m = 4 / k}
          <rect
            class="marca-el"
            x={el.caja[0] - m}
            y={el.caja[1] - m}
            width={el.caja[2] - el.caja[0] + 2 * m}
            height={el.caja[3] - el.caja[1] + 2 * m}
            rx={4 / k}
          />
          {#each Object.entries(el.e.terminales ?? {}) as [t] (t)}
            {@const a = el.e.anclas[t]}
            {#if a}
              {@const p = [e.esq.dibujo_a_svg.sx * a[0] + e.esq.dibujo_a_svg.tx, e.esq.dibujo_a_svg.sy * a[1] + e.esq.dibujo_a_svg.ty]}
              <circle class="marca-term" class:topologia={!e.simulable} cx={p[0]} cy={p[1]} r={4 / k} />
            {/if}
          {/each}
        {/if}
      {/if}
    {/if}
  {/each}
</svg>

{#each esquemas as e (e.indice)}
  {@const caja = region(e)}
  <!-- Schematic region: hover and tap on wires, nodes and parts (Esc clears, space plays/pauses). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="zona-e"
    class:con-sel={!!e.seleccion}
    style:left={pct(caja[0], vista[0], vista[2])}
    style:top={pct(caja[1], vista[1], vista[3])}
    style:width={`${((caja[2] / vista[2]) * 100).toFixed(3)}%`}
    style:height={`${((caja[3] / vista[3]) * 100).toFixed(3)}%`}
    role="application"
    aria-roledescription="esquema interactivo"
    aria-label={e.simulable
      ? 'Esquema con tensiones y corrientes simuladas: toque o pase el puntero por un cable, un nodo o un componente'
      : 'Esquema (solo conexiones): toque o pase el puntero por un cable para ver su red'}
    tabindex="0"
    data-esquema={e.indice}
    onpointermove={(ev) => mover(ev, e, caja)}
    onpointerdown={abajo}
    onpointerup={(ev) => arriba(ev, e, caja)}
    onpointerleave={(ev) => {
      if (ev.pointerType === 'mouse') e.hover = null;
    }}
    onkeydown={(ev) => teclas(ev, e)}
    onfocus={() => enfocar(e)}
  ></div>
{/each}

{#each esquemas as e (e.indice)}
  {@const s = e.seleccion ?? e.hover}
  {#if s}
    <Ficha est={e} sel={s} {vista} {k} fija={!!e.seleccion} cerrar={() => (e.seleccion = null)} />
  {/if}
{/each}

<style>
  .capa-v,
  .capa-s {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .capa-p {
    position: absolute;
    pointer-events: none;
  }
  .capa-v {
    mix-blend-mode: multiply;
  }
  .halo {
    fill: none;
    stroke-width: 7;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .halo.foco {
    stroke-width: 10;
  }
  .marca-red {
    fill: none;
    stroke: #1b2733;
    stroke-opacity: 0.5;
    stroke-width: 2.5;
    stroke-dasharray: 5 4;
    vector-effect: non-scaling-stroke;
  }
  .marca-red.topologia {
    stroke: #d97a00;
    stroke-opacity: 0.85;
    stroke-width: 6;
    stroke-dasharray: none;
    stroke-linecap: round;
    mix-blend-mode: multiply;
  }
  .marca-term {
    fill: #fff;
    stroke: #1b2733;
    stroke-width: 1.6;
    vector-effect: non-scaling-stroke;
  }
  .marca-term.topologia {
    fill: #f2a43a;
    stroke: #6b3f00;
  }
  .marca-el {
    fill: rgba(224, 138, 0, 0.08);
    stroke: #d97a00;
    stroke-width: 1.8;
    vector-effect: non-scaling-stroke;
  }
  .zona-e {
    position: absolute;
    touch-action: manipulation;
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
    border-radius: 4px;
  }
  .zona-e:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 2px;
  }
</style>
