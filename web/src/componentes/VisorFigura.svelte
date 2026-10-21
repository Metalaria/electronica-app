<script lang="ts">
  // Full-screen figure viewer: zoom with wheel, buttons, double tap or pinch; pan by dragging.
  // The image is resized (not CSS-scaled) so vector figures stay sharp at any zoom.
  import { onMount } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { prepararHtml } from '../lib/datos';
  import { cerrarFigura } from '../lib/acciones';
  import { navegarDesdeCapa } from '../lib/ruta.svelte';
  import Icono from './Icono.svelte';

  const f = $derived(app.figura!);
  const vectorial = $derived(/\.svg(\?|$)|^data:image\/svg/i.test(f.src));

  const MAX = 8;
  let escenario: HTMLDivElement | undefined = $state();
  let natural = $state({ w: 0, h: 0 });
  let caja = $state({ w: 0, h: 0 });
  let s = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  let animar = $state(false);
  let pieAbierto = $state(true);

  // Size of the image fitted in the stage at zoom 1.
  const ajuste = $derived.by(() => {
    if (!natural.w || !natural.h || !caja.w || !caja.h) return { w: 0, h: 0 };
    const margen = caja.w < 600 ? 36 : 64;
    const k = Math.min((caja.w - margen) / natural.w, (caja.h - margen) / natural.h, vectorial ? 4 : 1.5);
    return { w: natural.w * k, h: natural.h * k };
  });

  function limitar() {
    const mx = Math.max(0, (ajuste.w * s - caja.w) / 2 + 40);
    const my = Math.max(0, (ajuste.h * s - caja.h) / 2 + 40);
    if (s <= 1) {
      tx = 0;
      ty = 0;
      return;
    }
    tx = Math.min(mx, Math.max(-mx, tx));
    ty = Math.min(my, Math.max(-my, ty));
  }

  /** Zoom to s2 keeping the stage point (px, py), relative to the centre, fixed. */
  function zoom(s2: number, px = 0, py = 0, suave = false) {
    const n = Math.min(MAX, Math.max(1, s2));
    const r = n / s;
    tx = px - (px - tx) * r;
    ty = py - (py - ty) * r;
    s = n;
    animar = suave;
    limitar();
  }

  function centroRel(x: number, y: number): [number, number] {
    const r = escenario!.getBoundingClientRect();
    return [x - r.left - r.width / 2, y - r.top - r.height / 2];
  }

  // ------------------------------------------------------------------ pointer gestures
  const punteros = new Map<number, { x: number; y: number }>();
  let pinza: { d: number; s: number; c: [number, number]; t: [number, number] } | null = null;
  let ultimoToque = { t: 0, x: 0, y: 0 };
  let movido = false;

  function distancia(): number {
    const [a, b] = [...punteros.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  function centro(): [number, number] {
    const [a, b] = [...punteros.values()];
    if (!a || !b) return [0, 0];
    return centroRel((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  function abajo(ev: PointerEvent) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    escenario?.setPointerCapture(ev.pointerId);
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    animar = false;
    movido = false;
    if (punteros.size === 2) pinza = { d: distancia(), s, c: centro(), t: [tx, ty] };
  }

  function mover(ev: PointerEvent) {
    const p = punteros.get(ev.pointerId);
    if (!p) return;
    const dx = ev.clientX - p.x;
    const dy = ev.clientY - p.y;
    p.x = ev.clientX;
    p.y = ev.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 2) movido = true;
    if (punteros.size >= 2 && pinza) {
      const d = distancia();
      const c = centro();
      const n = Math.min(MAX, Math.max(1, (pinza.s * d) / (pinza.d || 1)));
      const r = n / pinza.s;
      tx = c[0] - (pinza.c[0] - pinza.t[0]) * r;
      ty = c[1] - (pinza.c[1] - pinza.t[1]) * r;
      s = n;
      limitar();
    } else if (punteros.size === 1 && s > 1) {
      tx += dx;
      ty += dy;
      limitar();
    }
  }

  function arriba(ev: PointerEvent) {
    const p = punteros.get(ev.pointerId);
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pinza = null;
    if (!p || movido || punteros.size) return;
    // Double tap / double click toggles the zoom at that point.
    const ahora = performance.now();
    if (ahora - ultimoToque.t < 320 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 30) {
      const [px, py] = centroRel(ev.clientX, ev.clientY);
      if (s > 1.05) {
        s = 1;
        tx = 0;
        ty = 0;
        animar = true;
      } else zoom(2.5, px, py, true);
      ultimoToque.t = 0;
    } else {
      ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY };
    }
  }

  function rueda(ev: WheelEvent) {
    ev.preventDefault();
    const [px, py] = centroRel(ev.clientX, ev.clientY);
    const k = ev.ctrlKey ? 0.01 : 0.0022; // trackpad pinch arrives as ctrl+wheel
    zoom(s * Math.exp(-ev.deltaY * k), px, py);
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      cerrarFigura();
    } else if (ev.key === '+' || ev.key === '=') zoom(s * 1.4, 0, 0, true);
    else if (ev.key === '-') zoom(s / 1.4, 0, 0, true);
    else if (ev.key === '0') {
      s = 1;
      tx = 0;
      ty = 0;
      animar = true;
    }
  }

  function cargada(ev: Event) {
    const img = ev.currentTarget as HTMLImageElement;
    natural = { w: img.naturalWidth || 800, h: img.naturalHeight || 600 };
  }

  // A reference in the caption leaves the viewer and goes to its target.
  function enlacePie(ev: MouseEvent) {
    const a = (ev.target as Element).closest('a[href^="#/"]');
    if (!a) return;
    ev.preventDefault();
    navegarDesdeCapa(a.getAttribute('href')!, { texto: 'Volver' });
  }

  let botonCerrar: HTMLButtonElement | undefined = $state();

  onMount(() => {
    const anterior = document.activeElement as HTMLElement | null;
    botonCerrar?.focus();
    const ro = new ResizeObserver(() => {
      if (escenario) caja = { w: escenario.clientWidth, h: escenario.clientHeight };
      limitar();
    });
    if (escenario) ro.observe(escenario);
    // Wheel must be non-passive to prevent the page zoom/scroll.
    escenario?.addEventListener('wheel', rueda, { passive: false });
    return () => {
      ro.disconnect();
      escenario?.removeEventListener('wheel', rueda);
      anterior?.focus?.({ preventScroll: true });
    };
  });
</script>

<svelte:window onkeydown={teclas} />

<div class="visor" role="dialog" aria-modal="true" aria-label={f.num ? `Figura ${f.num}` : 'Figura'}>
  <div class="barra">
    <span class="nombre">{f.num ? `Figura ${f.num}` : 'Figura'}</span>
    <span class="zoom">{Math.round(s * 100)} %</span>
    <button class="b" aria-label="Alejar" disabled={s <= 1} onclick={() => zoom(s / 1.5, 0, 0, true)}><Icono nombre="zoom-menos" /></button>
    <button class="b" aria-label="Acercar" disabled={s >= MAX} onclick={() => zoom(s * 1.5, 0, 0, true)}><Icono nombre="zoom-mas" /></button>
    <button
      class="b"
      aria-label="Ajustar a la pantalla"
      disabled={s === 1}
      onclick={() => {
        s = 1;
        tx = 0;
        ty = 0;
        animar = true;
      }}><Icono nombre="restablecer" /></button
    >
    <button class="b cerrar" aria-label="Cerrar" bind:this={botonCerrar} onclick={cerrarFigura}><Icono nombre="x" tam={22} /></button>
  </div>

  <div
    class="escenario"
    class:arrastrable={s > 1}
    bind:this={escenario}
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={arriba}
    role="presentation"
  >
    <img
      src={f.src}
      alt={f.alt}
      class:vectorial
      class:animar
      draggable="false"
      onload={cargada}
      style:width={`${ajuste.w * s}px`}
      style:height={`${ajuste.h * s}px`}
      style:transform={`translate(-50%, -50%) translate(${tx}px, ${ty}px)`}
      style:visibility={ajuste.w ? 'visible' : 'hidden'}
    />
  </div>

  {#if f.pie || f.credito}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="pie" class:cerrado={!pieAbierto} onclick={enlacePie}>
      <button class="alternar" onclick={() => (pieAbierto = !pieAbierto)} aria-expanded={pieAbierto}>
        {pieAbierto ? 'Ocultar pie' : 'Mostrar pie'}
      </button>
      {#if pieAbierto}
        <p>
          {#if f.num}<b>Figura {f.num} —</b>{/if}
          {@html prepararHtml(f.pie)}
          {#if f.credito}<span class="credito">{@html prepararHtml(f.credito)}</span>{/if}
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .visor {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    background: rgba(10, 12, 15, 0.985);
    color: #e9edf1;
    font-family: var(--sans);
    animation: aparecer 0.16s ease-out;
    touch-action: none;
  }
  @keyframes aparecer {
    from {
      opacity: 0;
    }
  }
  .barra {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
    padding: calc(env(safe-area-inset-top) + 8px) 8px 8px 18px;
  }
  .nombre {
    flex: 1;
    font-size: 16px;
    font-weight: 700;
  }
  .zoom {
    min-width: 54px;
    margin-right: 4px;
    color: #9aa6b2;
    font-size: 13.5px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .b {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 12px;
    background: none;
    color: #e9edf1;
  }
  .b:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
  .b:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .cerrar {
    margin-left: 6px;
    background: rgba(255, 255, 255, 0.1);
  }
  .escenario {
    position: relative;
    flex: 1;
    overflow: hidden;
    cursor: zoom-in;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .escenario.arrastrable {
    cursor: grab;
  }
  .escenario.arrastrable:active {
    cursor: grabbing;
  }
  img {
    position: absolute;
    top: 50%;
    left: 50%;
    max-width: none;
    border-radius: 6px;
    -webkit-user-drag: none;
  }
  img.vectorial {
    background: #fff;
    padding: 0;
    box-shadow: 0 0 0 10px #fff;
  }
  img.animar {
    transition:
      width 0.2s ease,
      height 0.2s ease,
      transform 0.2s ease;
  }
  .pie {
    flex: none;
    max-height: 30vh;
    overflow-y: auto;
    padding: 10px 20px calc(14px + env(safe-area-inset-bottom));
    background: rgba(0, 0, 0, 0.35);
    font-size: 14.5px;
    line-height: 1.45;
  }
  .pie p {
    max-width: 60em;
    margin: 6px auto 0;
    color: #c9d1d9;
  }
  .pie b {
    color: #fff;
  }
  .pie :global(a.ref) {
    color: #9cc3ea;
  }
  .credito {
    display: block;
    margin-top: 4px;
    color: #8c98a4;
    font-size: 0.9em;
  }
  .alternar {
    display: block;
    margin: 0 auto;
    padding: 2px 10px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: #9aa6b2;
    font-size: 12.5px;
  }
  .pie.cerrado {
    padding-top: 8px;
  }
</style>
