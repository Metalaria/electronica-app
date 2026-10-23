<script lang="ts">
  // Interaction layer over the book's plots: a crosshair that follows the pointer (or finger) and snaps to
  // the nearest series, a readout of every series at that x, highlighted points, A/B cursors and a readout
  // pinned by a click or tap. Each plotting box (an Axes with its twins, or an inset) is independent.
  import type { Caja, DatosFigura } from '../tipos';
  import { grupos as calcularGrupos, leer, type Grupo, type Lectura } from './lectura';
  import { ejeNumerico, nombreEje, valorEje } from '../formato';
  import { prepararHtml } from '../../../lib/datos';
  import { tactil } from '../carga.svelte';
  import type { EstadoGraficas } from './estado.svelte';

  let {
    datos,
    grupos = calcularGrupos(datos),
    vista,
    k,
    estado,
  }: { datos: DatosFigura; grupos?: Grupo[]; vista: Caja; k: number; estado: EstadoGraficas } = $props();

  /** Hover (not pinned) readout. */
  let hover = $state<{ grupo: number; X: number; Y: number } | null>(null);
  let arrastre: {
    grupo: Grupo;
    cursor: 0 | 1 | null;
    x0: number;
    y0: number;
    movido: boolean;
    tactil: boolean;
    /** Pinned reading when the finger went down. */
    antes: { grupo: number; X: number; Y: number } | null;
  } | null = null;

  let anchoLectura = $state(0);
  const radio = $derived((tactil ? 22 : 10) / Math.max(k, 0.01));

  function grupoDe(id: number): Grupo | undefined {
    return grupos.find((g) => g.principal === id);
  }

  const lectura = $derived.by((): Lectura | null => {
    const p = estado.fijada ?? hover;
    if (!p) return null;
    const g = grupoDe(p.grupo);
    if (!g) return null;
    return leer(g, p.X, p.Y, radio);
  });

  /** Default cursor positions (1/3 and 2/3 of the box) for groups without them. */
  $effect(() => {
    if (!estado.cursores) return;
    for (const g of grupos) {
      if (estado.posiciones[g.principal]) continue;
      const m = g.mapas.get(g.principal)!;
      const [X, , W] = g.caja;
      estado.posiciones[g.principal] = [m.xi(X + W / 3), m.xi(X + (2 * W) / 3)];
    }
  });

  function aSvg(ev: PointerEvent, g: Grupo): [number, number] {
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    return [g.caja[0] + ((ev.clientX - r.left) / (r.width || 1)) * g.caja[2], g.caja[1] + ((ev.clientY - r.top) / (r.height || 1)) * g.caja[3]];
  }

  function cursorCerca(g: Grupo, X: number): 0 | 1 | null {
    if (!estado.cursores) return null;
    const c = estado.posiciones[g.principal];
    if (!c) return null;
    const m = g.mapas.get(g.principal)!;
    const tol = (tactil ? 20 : 8) / k;
    const d0 = Math.abs(m.x(c[0]) - X);
    const d1 = Math.abs(m.x(c[1]) - X);
    if (Math.min(d0, d1) > tol) return null;
    return d0 <= d1 ? 0 : 1;
  }

  function moverCursor(g: Grupo, i: 0 | 1, X: number) {
    const m = g.mapas.get(g.principal)!;
    const Xc = Math.min(Math.max(X, g.caja[0]), g.caja[0] + g.caja[2]);
    const c = [...(estado.posiciones[g.principal] ?? [0, 0])] as [number, number];
    c[i] = m.xi(Xc);
    estado.posiciones[g.principal] = c;
  }

  function abajo(ev: PointerEvent, g: Grupo) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const [X, Y] = aSvg(ev, g);
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    const c = cursorCerca(g, X);
    arrastre = { grupo: g, cursor: c, x0: ev.clientX, y0: ev.clientY, movido: false, tactil: ev.pointerType !== 'mouse', antes: estado.fijada };
    if (c == null && ev.pointerType !== 'mouse') {
      // A finger reads values while it moves; the reading stays pinned when it lifts.
      if (estado.fijada && estado.fijada.grupo === g.principal) estado.fijada = { grupo: g.principal, X, Y };
      else hover = { grupo: g.principal, X, Y };
    }
  }

  function mover(ev: PointerEvent, g: Grupo) {
    const [X, Y] = aSvg(ev, g);
    const a = arrastre;
    if (a && a.grupo === g) {
      if (Math.hypot(ev.clientX - a.x0, ev.clientY - a.y0) > 6) a.movido = true;
      if (a.cursor != null) {
        moverCursor(g, a.cursor, X);
        return;
      }
      if (a.tactil) {
        if (estado.fijada?.grupo === g.principal) estado.fijada = { grupo: g.principal, X, Y };
        else hover = { grupo: g.principal, X, Y };
        return;
      }
    }
    if (ev.pointerType === 'mouse' && !estado.fijada) hover = { grupo: g.principal, X, Y };
  }

  function arriba(ev: PointerEvent, g: Grupo) {
    const a = arrastre;
    arrastre = null;
    if (!a || a.grupo !== g || a.cursor != null) return;
    const [X, Y] = aSvg(ev, g);
    if (a.tactil) {
      const f = a.antes;
      // A second tap on the pinned point lets it go; any other tap or drag pins the reading there.
      if (f && !a.movido && f.grupo === g.principal && Math.hypot(f.X - X, f.Y - Y) * k < 16) {
        estado.fijada = null;
      } else estado.fijada = { grupo: g.principal, X, Y };
      hover = null;
      return;
    }
    if (a.movido) return;
    if (estado.fijada) estado.fijada = null;
    else estado.fijada = { grupo: g.principal, X, Y };
    hover = { grupo: g.principal, X, Y };
  }

  function cancelar() {
    arrastre = null;
    if (!estado.fijada) hover = null;
  }

  function salir(ev: PointerEvent) {
    if (ev.pointerType === 'mouse' && !arrastre) hover = null;
  }

  function teclas(ev: KeyboardEvent, g: Grupo) {
    const p = estado.fijada ?? hover ?? { grupo: g.principal, X: g.caja[0] + g.caja[2] / 2, Y: g.caja[1] + g.caja[3] / 2 };
    const paso = (g.caja[2] / 100) * (ev.shiftKey ? 10 : 1);
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      const X = Math.min(Math.max(p.X + (ev.key === 'ArrowLeft' ? -paso : paso), g.caja[0]), g.caja[0] + g.caja[2]);
      // Keyboard reading snaps the y to the nearest curve at the new x.
      const l = leer(g, X, p.Y, radio);
      estado.fijada = { grupo: g.principal, X, Y: l.cerca?.Y ?? p.Y };
    } else if (ev.key === 'Escape' && estado.fijada) {
      ev.preventDefault();
      estado.fijada = null;
    } else if (ev.key.toLowerCase() === 'c') {
      estado.cursores = !estado.cursores;
    }
  }

  const pct = (v: number, base: number, largo: number) => `${(((v - base) / largo) * 100).toFixed(3)}%`;

  /** Readout box in CSS px within the figure. */
  const caja = $derived.by(() => {
    const l = lectura;
    if (!l) return null;
    const ancho = vista[2] * k;
    const px = (l.X - vista[0]) * k;
    const yRef = l.cerca?.Y ?? (estado.fijada ?? hover)?.Y ?? l.grupo.caja[1];
    const py = (yRef - vista[1]) * k;
    const w = anchoLectura || 160;
    let x = px > ancho * 0.55 ? px - 14 - w : px + 14;
    if (x + w > ancho + 10) x = ancho + 10 - w;
    return { px: Math.max(-10, x), py, alto: vista[3] * k };
  });

  function nombreX(g: Grupo): string {
    return nombreEje(g.ejeX);
  }

  function filas(l: Lectura) {
    return l.valores
      .filter((v) => ejeNumerico(datos.ejes[v.serie.ejes]?.y))
      .slice(0, 7)
      .map((v) => {
        const ey = datos.ejes[v.serie.ejes]!.y!;
        const texto = v.valor != null ? valorEje(v.valor, ey) : valorEje(v.y, ey);
        return { v, texto };
      });
  }

  const etiquetaZona = (g: Grupo) => {
    const ej = datos.ejes[g.principal]!;
    const t = [ej.titulo, nombreEje(ej.x), nombreEje(ej.y)].filter(Boolean).join(', ');
    return `Gráfica${t ? ` (${t})` : ''}: flechas para leer valores, C para los cursores, Esc para soltar la lectura`;
  };
</script>

<svg class="capa-g" viewBox={vista.join(' ')} preserveAspectRatio="none" aria-hidden="true">
  {#if estado.cursores}
    {#each grupos as g (g.principal)}
      {@const c = estado.posiciones[g.principal]}
      {#if c}
        {#each c as x, i (i)}
          {@const X = g.mapas.get(g.principal)!.x(x)}
          {#if X >= g.caja[0] - 0.5 && X <= g.caja[0] + g.caja[2] + 0.5}
            <line class="cursor" x1={X} x2={X} y1={g.caja[1]} y2={g.caja[1] + g.caja[3]} />
            <g transform={`translate(${X} ${g.caja[1]}) scale(${1 / k})`}>
              <rect class="asa" x="-9" y="-1" width="18" height="16" rx="4" />
              <text class="asa-t" x="0" y="11.5">{i === 0 ? 'A' : 'B'}</text>
            </g>
          {/if}
        {/each}
      {/if}
    {/each}
  {/if}
  {#if lectura}
    {@const g = lectura.grupo}
    <line class="cruz" x1={lectura.X} x2={lectura.X} y1={g.caja[1]} y2={g.caja[1] + g.caja[3]} />
    {#if lectura.cerca}
      <line class="cruz h" x1={g.caja[0]} x2={g.caja[0] + g.caja[2]} y1={lectura.cerca.Y} y2={lectura.cerca.Y} />
    {/if}
    {#each lectura.valores as v, i (i)}
      {#if v.Y >= g.caja[1] - 1 && v.Y <= g.caja[1] + g.caja[3] + 1}
        <circle
          class="punto"
          class:cerca={v === lectura.cerca}
          cx={v.X}
          cy={v.Y}
          r={(v === lectura.cerca ? 5 : 3.6) / k}
          fill={v.serie.color}
        />
      {/if}
    {/each}
  {/if}
</svg>

{#each grupos as g (g.principal)}
  <!-- Plot region: pointer, touch and keyboard reading (arrows); focusable on purpose. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="zona-g"
    class:fijada={estado.fijada?.grupo === g.principal}
    style:left={pct(g.caja[0], vista[0], vista[2])}
    style:top={pct(g.caja[1], vista[1], vista[3])}
    style:width={`${((g.caja[2] / vista[2]) * 100).toFixed(3)}%`}
    style:height={`${((g.caja[3] / vista[3]) * 100).toFixed(3)}%`}
    role="application"
    aria-roledescription="gráfica interactiva"
    aria-label={etiquetaZona(g)}
    tabindex="0"
    data-grupo={g.principal}
    onpointerdown={(e) => abajo(e, g)}
    onpointermove={(e) => mover(e, g)}
    onpointerup={(e) => arriba(e, g)}
    onpointercancel={cancelar}
    onpointerleave={salir}
    onkeydown={(e) => teclas(e, g)}
    onblur={() => {
      if (!estado.fijada) hover = null;
    }}
  ></div>
{/each}

{#if lectura && caja && (lectura.grupo.xNumerico || filas(lectura).length)}
  {@const l = lectura}
  <div
    class="lectura-fv"
    class:fija={!!estado.fijada}
    style:left={`${caja.px}px`}
    style:top={`${Math.min(Math.max(caja.py - 18, 0), Math.max(0, caja.alto - 40))}px`}
    role="status"
    aria-live="polite"
    bind:offsetWidth={anchoLectura}
  >
    {#if l.grupo.xNumerico}
      <div class="lx">{#if nombreX(l.grupo)}<span>{nombreX(l.grupo)}</span>{/if} {valorEje(l.cerca && l.cerca.serie.orden === 0 ? l.cerca.x : l.x, l.grupo.ejeX)}</div>
    {/if}
    {#each filas(l) as f, i (i)}
      <div class="ly" class:principal={f.v === l.cerca}>
        <svg width="12" height="8" aria-hidden="true"><line x1="1" y1="4" x2="11" y2="4" stroke={f.v.serie.color} stroke-width="2.5" stroke-linecap="round" /></svg>
        <strong>{f.texto}</strong>
        <span class="n">{#if f.v.serie.html}{@html prepararHtml(f.v.serie.html)}{:else}{f.v.serie.nombre}{/if}</span>
      </div>
    {/each}
    {#if estado.fijada}<div class="pista">{tactil ? 'Toque otra vez para soltar' : 'Clic para soltar'}</div>{/if}
  </div>
{/if}

<style>
  .capa-g {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }
  .cruz {
    stroke: #2b3a48;
    stroke-opacity: 0.55;
    stroke-width: 1;
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
  }
  .cruz.h {
    stroke-opacity: 0.35;
  }
  .punto {
    stroke: #fff;
    stroke-width: 1.6;
    vector-effect: non-scaling-stroke;
  }
  .punto.cerca {
    stroke: #1b2733;
    stroke-width: 1.8;
  }
  .cursor {
    stroke: #6a3fb5;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .asa {
    fill: #6a3fb5;
  }
  .asa-t {
    fill: #fff;
    font: 700 11px var(--sans);
    text-anchor: middle;
  }
  .zona-g {
    position: absolute;
    touch-action: pan-y;
    cursor: crosshair;
    -webkit-user-select: none;
    user-select: none;
    border-radius: 2px;
  }
  .zona-g:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 2px;
  }
  .lectura-fv {
    position: absolute;
    z-index: 3;
    pointer-events: none;
    min-width: 7em;
    max-width: min(19em, 78vw);
    padding: 6px 9px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: color-mix(in srgb, var(--superficie) 95%, transparent);
    box-shadow: var(--sombra);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 12.5px;
    line-height: 1.35;
    font-variant-numeric: tabular-nums;
    text-align: left;
  }
  .lectura-fv.fija {
    border-color: var(--acento-borde);
  }
  .lx {
    margin-bottom: 2px;
    color: var(--tinta-suave);
    font-weight: 600;
    white-space: nowrap;
  }
  .lx span {
    font-weight: 400;
  }
  .ly {
    display: flex;
    align-items: baseline;
    gap: 5px;
    white-space: nowrap;
  }
  .ly svg {
    flex: none;
  }
  .ly.principal strong {
    color: var(--acento);
  }
  .n {
    overflow: hidden;
    color: var(--tinta-suave);
    font-size: 11.5px;
    text-overflow: ellipsis;
  }
  .pista {
    margin-top: 3px;
    color: var(--tinta-tenue);
    font-size: 11px;
  }
</style>
