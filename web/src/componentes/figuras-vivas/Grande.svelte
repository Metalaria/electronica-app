<script lang="ts">
  // Full-screen view of a live figure: the figure with its layers, zoom (wheel, pinch, buttons, double
  // click on the background) and pan (drag the background), next to its controls; for plots, a «Datos» tab
  // that redraws every curve with the app's plot component (box zoom, pan, cursors, table).
  import { onMount, untrack } from 'svelte';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import X from '@lucide/svelte/icons/x';
  import type { Caja, DatosFigura } from './tipos';
  import type { Grupo } from './grafica/lectura';
  import type { EstadoGraficas } from './grafica/estado.svelte';
  import type { EstadoEsquema } from './esquema/modelo.svelte';
  import { pagina } from './carga.svelte';
  import { abrirCapa, cerrarCapa, navegarDesdeCapa } from '../../lib/ruta.svelte';
  import { prepararHtml } from '../../lib/datos';
  import Escenario from './Escenario.svelte';
  import TablaCursores from './grafica/TablaCursores.svelte';
  import PanelEsquema from './esquema/PanelEsquema.svelte';
  import DatosGrafica from './grafica/DatosGrafica.svelte';

  let {
    src,
    alt,
    num,
    pie,
    credito,
    vista,
    datos,
    grupos,
    esquemas,
    estadoG,
    cerrar,
    titulo = null,
  }: {
    src: string;
    alt: string;
    num: string | null;
    pie: string | null;
    credito: string | null;
    vista: Caja;
    datos: DatosFigura;
    grupos: Grupo[];
    esquemas: EstadoEsquema[];
    estadoG: EstadoGraficas;
    cerrar: () => void;
    /** Heading when the drawing is not a numbered figure («Circuito»). */
    titulo?: string | null;
  } = $props();

  const CAPA = 'figura-viva';
  let pestana = $state<'figura' | 'datos'>('figura');
  const conDatos = $derived(grupos.some((g) => g.series.some((s) => s.tipo === 'curva')));
  const conPanel = $derived(esquemas.length > 0 || estadoG.cursores || !!pie);

  // ---------------------------------------------------------------- zoom and pan
  const MAX = 6;
  let escenario: HTMLDivElement | undefined = $state();
  let caja = $state({ w: 0, h: 0 });
  let s = $state(1);
  let tx = $state(0);
  let ty = $state(0);

  const ajuste = $derived.by(() => {
    if (!caja.w || !caja.h) return { w: 0, h: 0 };
    const m = caja.w < 600 ? 20 : 40;
    const kk = Math.min((caja.w - m) / vista[2], (caja.h - m) / vista[3]);
    return { w: vista[2] * kk, h: vista[3] * kk };
  });

  function limitar() {
    if (s <= 1) {
      tx = 0;
      ty = 0;
      return;
    }
    const mx = Math.max(0, (ajuste.w * s - caja.w) / 2 + 40);
    const my = Math.max(0, (ajuste.h * s - caja.h) / 2 + 40);
    tx = Math.min(mx, Math.max(-mx, tx));
    ty = Math.min(my, Math.max(-my, ty));
  }

  function zoom(n: number, px = 0, py = 0) {
    const s2 = Math.min(MAX, Math.max(1, n));
    const r = s2 / s;
    tx = px - (px - tx) * r;
    ty = py - (py - ty) * r;
    s = s2;
    limitar();
  }

  function rel(x: number, y: number): [number, number] {
    const r = escenario!.getBoundingClientRect();
    return [x - r.left - r.width / 2, y - r.top - r.height / 2];
  }

  const punteros = new Map<number, { x: number; y: number }>();
  let pinza: { d: number; s: number; c: [number, number]; t: [number, number] } | null = null;
  let arrastre: { id: number } | null = null;
  let ultimoToque = { t: 0, x: 0, y: 0 };

  const enZona = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('.zona-g, .zona-e, .ficha, .lectura-fv, button, a');

  function abajo(ev: PointerEvent) {
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const c = rel((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      pinza = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, s, c, t: [tx, ty] };
      arrastre = null;
      return;
    }
    if (enZona(ev.target)) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    arrastre = { id: ev.pointerId };
    escenario?.setPointerCapture(ev.pointerId);
  }

  function mover(ev: PointerEvent) {
    const p = punteros.get(ev.pointerId);
    if (!p) return;
    const dx = ev.clientX - p.x;
    const dy = ev.clientY - p.y;
    p.x = ev.clientX;
    p.y = ev.clientY;
    if (pinza && punteros.size >= 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
      const c = rel((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      const n = Math.min(MAX, Math.max(1, (pinza.s * d) / pinza.d));
      const r = n / pinza.s;
      tx = c[0] - (pinza.c[0] - pinza.t[0]) * r;
      ty = c[1] - (pinza.c[1] - pinza.t[1]) * r;
      s = n;
      limitar();
    } else if (arrastre?.id === ev.pointerId && s > 1) {
      tx += dx;
      ty += dy;
      limitar();
    }
  }

  function arriba(ev: PointerEvent) {
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pinza = null;
    if (arrastre?.id !== ev.pointerId) return;
    arrastre = null;
    // Double tap / double click on the background toggles the zoom.
    const ahora = performance.now();
    if (ahora - ultimoToque.t < 320 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 30) {
      const [px, py] = rel(ev.clientX, ev.clientY);
      if (s > 1.05) zoom(1);
      else zoom(2.5, px, py);
      ultimoToque.t = 0;
    } else ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY };
  }

  function rueda(ev: WheelEvent) {
    if (pestana !== 'figura') return;
    ev.preventDefault();
    const [px, py] = rel(ev.clientX, ev.clientY);
    zoom(s * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0022)), px, py);
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      // Esc first lets go of a pinned readout or selection, then closes.
      if (estadoG.fijada) estadoG.fijada = null;
      else if (esquemas.some((e) => e.seleccion)) for (const e of esquemas) e.seleccion = null;
      else cerrarCapa(CAPA);
      ev.preventDefault();
      return;
    }
    if ((ev.target as HTMLElement | null)?.closest?.('input, .zona-g, .zona-e')) return;
    if (ev.key === '+' || ev.key === '=') zoom(s * 1.4);
    else if (ev.key === '-') zoom(s / 1.4);
    else if (ev.key === '0') zoom(1);
  }

  /** Moves the view to the body, out of the reader's containment (content-visibility makes fixed relative). */
  function aCuerpo(nodo: HTMLElement) {
    document.body.appendChild(nodo);
    return {
      destroy() {
        nodo.remove();
      },
    };
  }

  let botonCerrar: HTMLButtonElement | undefined = $state();
  onMount(() => {
    const anterior = document.activeElement as HTMLElement | null;
    abrirCapa(CAPA, () => cerrar());
    document.documentElement.classList.add('bloqueado');
    botonCerrar?.focus();
    const ro = new ResizeObserver(() => {
      if (escenario) caja = { w: escenario.clientWidth, h: escenario.clientHeight };
      untrack(limitar);
    });
    if (escenario) ro.observe(escenario);
    escenario?.addEventListener('wheel', rueda, { passive: false });
    return () => {
      ro.disconnect();
      escenario?.removeEventListener('wheel', rueda);
      document.documentElement.classList.remove('bloqueado');
      anterior?.focus?.({ preventScroll: true });
    };
  });

  let anchoEsc = $state(0);
  const nombre = $derived(titulo ?? (num ? `Figura ${num}` : 'Figura'));

  /** Part of the figure on screen when zoomed (SVG units): the particle canvas covers only that. */
  const enPantallaSvg = $derived.by((): Caja => {
    const k = anchoEsc / vista[2] || 1;
    // Content box of the plate (10 px padding), centred in the stage and shifted by (tx, ty).
    const izq = caja.w / 2 + tx - (ajuste.w * s) / 2;
    const arr = caja.h / 2 + ty - (ajuste.h * s) / 2;
    return [vista[0] - izq / k, vista[1] - arr / k, caja.w / k, caja.h / k];
  });

  // Links inside the view (animations, book sections, references in the caption) leave it like the
  // figure viewer does: the overlay's history entry becomes the destination, and «Volver» returns here.
  function enlace(ev: MouseEvent) {
    const a = (ev.target as Element | null)?.closest?.('a[href^="#/"]');
    if (!a) return;
    ev.preventDefault();
    navegarDesdeCapa(a.getAttribute('href')!, { texto: num ? `Volver a la figura ${num}` : 'Volver a la figura' });
  }
</script>

<svelte:window onkeydown={teclas} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="grande-fv" use:aCuerpo role="dialog" tabindex="-1" aria-modal="true" aria-label={nombre} onclick={enlace}>
  <div class="barra">
    <span class="nombre">{nombre}</span>
    {#if conDatos}
      <div class="pestanas" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'figura'} onclick={() => (pestana = 'figura')}>Figura</button>
        <button type="button" role="tab" aria-selected={pestana === 'datos'} onclick={() => (pestana = 'datos')}>Datos</button>
      </div>
    {/if}
    <span class="hueco"></span>
    {#if pestana === 'figura'}
      {#if grupos.some((g) => g.xNumerico)}
        <button type="button" class="b ab" aria-pressed={estadoG.cursores} title="Cursores A y B" onclick={() => (estadoG.cursores = !estadoG.cursores)}>A|B</button>
      {/if}
      <span class="zoom">{Math.round(s * 100)} %</span>
      <button type="button" class="b" aria-label="Alejar" disabled={s <= 1} onclick={() => zoom(s / 1.5)}><ZoomOut size={20} /></button>
      <button type="button" class="b" aria-label="Acercar" disabled={s >= MAX} onclick={() => zoom(s * 1.5)}><ZoomIn size={20} /></button>
      <button type="button" class="b" aria-label="Ajustar a la pantalla" disabled={s === 1} onclick={() => zoom(1)}><RotateCcw size={18} /></button>
    {/if}
    <button type="button" class="b cerrar" aria-label="Cerrar" bind:this={botonCerrar} onclick={() => cerrarCapa(CAPA)}><X size={22} /></button>
  </div>

  <div class="cuerpo" class:con-panel={conPanel && pestana === 'figura'}>
    {#if pestana === 'figura'}
      <div
        class="escena"
        class:arrastrable={s > 1}
        bind:this={escenario}
        onpointerdown={abajo}
        onpointermove={mover}
        onpointerup={arriba}
        onpointercancel={arriba}
        role="presentation"
      >
        <div
          class="placa"
          style:width={`${ajuste.w * s}px`}
          style:transform={`translate(-50%, -50%) translate(${tx}px, ${ty}px)`}
          style:visibility={ajuste.w ? 'visible' : 'hidden'}
        >
          <Escenario {src} {alt} {vista} {datos} {grupos} {esquemas} {estadoG} activo={pagina.visible} visible={s > 1 ? enPantallaSvg : null} bind:ancho={anchoEsc} />
        </div>
      </div>
      {#if conPanel}
        <aside class="lateral">
          {#if estadoG.cursores}<TablaCursores {datos} {grupos} estado={estadoG} />{/if}
          {#each esquemas as e, i (i)}
            <PanelEsquema est={e} numero={esquemas.length > 1 ? i + 1 : null} amplio />
          {/each}
          {#if pie}
            <p class="pie">{#if num}<b>Figura {num} —</b>{/if} {@html prepararHtml(pie)}{#if credito}<span class="credito">{@html prepararHtml(credito)}</span>{/if}</p>
          {/if}
        </aside>
      {/if}
    {:else}
      <div class="datos">
        <DatosGrafica {datos} {grupos} />
      </div>
    {/if}
  </div>
</div>

<style>
  .grande-fv {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    background: var(--fondo);
    color: var(--tinta);
    font-family: var(--sans);
    animation: aparecer 0.16s ease-out;
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
    padding: calc(env(safe-area-inset-top) + 6px) 8px 6px 16px;
    border-bottom: 1px solid var(--linea);
    background: var(--superficie);
  }
  .nombre {
    font-size: 16px;
    font-weight: 700;
    color: var(--titulos);
    white-space: nowrap;
  }
  .hueco {
    flex: 1;
  }
  .pestanas {
    display: inline-flex;
    margin-left: 12px;
    padding: 2px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .pestanas button {
    min-height: 34px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  .pestanas button[aria-selected='true'] {
    background: var(--superficie);
    color: var(--tinta);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }
  .zoom {
    min-width: 48px;
    color: var(--tinta-tenue);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .b {
    display: grid;
    place-items: center;
    min-width: 44px;
    height: 44px;
    border: 0;
    border-radius: 12px;
    background: none;
    color: var(--tinta-suave);
  }
  .b:hover:not(:disabled) {
    background: var(--hover);
    color: var(--tinta);
  }
  .b:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .b.ab {
    font-size: 13px;
    font-weight: 700;
  }
  .b.ab[aria-pressed='true'] {
    background: #6a3fb5;
    color: #fff;
  }
  .cerrar {
    margin-left: 4px;
    background: var(--hover);
  }
  .cuerpo {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .escena {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .escena.arrastrable {
    cursor: grab;
  }
  .placa {
    position: absolute;
    top: 50%;
    left: 50%;
    padding: 10px;
    border-radius: 8px;
    background: var(--placa);
    box-sizing: content-box;
    box-shadow: var(--sombra);
  }
  .lateral {
    flex: 0 0 min(400px, 38%);
    overflow-y: auto;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
    border-left: 1px solid var(--linea);
    background: var(--superficie);
  }
  .lateral :global(.panel-e),
  .lateral :global(.cursores-fv) {
    margin-top: 0;
    margin-bottom: 14px;
  }
  .pie {
    margin: 4px 0 0;
    color: var(--tinta-suave);
    font-size: 13.5px;
    line-height: 1.45;
  }
  .pie b {
    color: var(--tinta);
  }
  .credito {
    display: block;
    margin-top: 4px;
    font-size: 0.9em;
  }
  .datos {
    flex: 1;
    overflow-y: auto;
    padding: 14px 18px calc(18px + env(safe-area-inset-bottom));
  }
  /* Portrait and narrow screens: the figure on top, the controls below. */
  @media (max-aspect-ratio: 1/1), (max-width: 760px) {
    .cuerpo.con-panel {
      flex-direction: column;
    }
    .cuerpo.con-panel .escena {
      flex: 0 0 52%;
    }
    .lateral {
      flex: 1 1 auto;
      border-left: 0;
      border-top: 1px solid var(--linea);
    }
    .zoom {
      display: none;
    }
  }
</style>
