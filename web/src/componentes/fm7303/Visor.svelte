<script lang="ts">
  // The kit's schematic with pan and zoom (drag, wheel or trackpad, pinch, double tap, buttons, keyboard). The
  // drawing is inline SVG whose viewBox follows the view, so it stays sharp at any zoom without rasterising a
  // huge image; the shared live overlay (figuras-vivas CapaEsquema: current dots, node colours, cards) is laid
  // over it with the same visible window, and the page's own layers (snippet `capas`) on top.
  import { onMount, untrack, type Snippet } from 'svelte';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import Maximize from '@lucide/svelte/icons/maximize';
  import type { Caja } from '../figuras-vivas/tipos';
  import type { EstadoEsquema } from '../figuras-vivas/esquema/modelo.svelte';
  import CapaEsquema from '../figuras-vivas/esquema/CapaEsquema.svelte';

  let {
    svg,
    total,
    est,
    viva = true,
    activo,
    captura = false,
    alTocar,
    enfoque = null,
    capas,
    etiqueta = 'Esquema del FM7303',
  }: {
    /** Inner markup of esquema.svg (without the <svg> element). */
    svg: string;
    /** Whole drawing [x, y, w, h]. */
    total: Caja;
    est: EstadoEsquema;
    /** Show the live overlay (currents and voltages). */
    viva?: boolean;
    /** Animations may run (on screen, page visible). */
    activo: boolean;
    /** Taps go to `alTocar` instead of the live overlay (multimeter, pointing out a fault). */
    captura?: boolean;
    alTocar?: (X: number, Y: number, radio: number) => void;
    /** A region to bring into view; a new object each time. */
    enfoque?: { caja: [number, number, number, number] } | null;
    /** Layers drawn in drawing units over everything; receives the zoom (px per unit). */
    capas?: Snippet<[number, Caja]>;
    etiqueta?: string;
  } = $props();

  let w = $state(0);
  let h = $state(0);
  let cx = $state(0);
  let cy = $state(0);
  let z = $state(0);
  let raiz: HTMLDivElement | undefined = $state();
  let dibujo: SVGGElement | undefined = $state();

  const ajuste = $derived(w > 0 && h > 0 ? Math.min(w / total[2], h / total[3]) * 0.97 : 0);
  const zMin = $derived(ajuste * 0.85);
  const zMax = $derived(Math.max(ajuste * 14, 4.5));
  const vista = $derived.by((): Caja => {
    if (!z || !w || !h) return total;
    return [cx - w / (2 * z), cy - h / (2 * z), w / z, h / z];
  });

  function encuadrar(c: [number, number, number, number], margen = 0.08): void {
    if (!w || !h) return;
    const [x0, y0, x1, y1] = c;
    const zz = Math.min(w / ((x1 - x0) * (1 + 2 * margen)), h / ((y1 - y0) * (1 + 2 * margen)));
    z = Math.min(zMax, Math.max(zMin, zz));
    cx = (x0 + x1) / 2;
    cy = (y0 + y1) / 2;
    limitar();
  }

  function todo(): void {
    encuadrar([total[0], total[1], total[0] + total[2], total[1] + total[3]], 0.01);
  }

  function limitar(): void {
    const mx = Math.max(0, total[2] / 2 - w / (2 * z) * 0.4);
    const my = Math.max(0, total[3] / 2 - h / (2 * z) * 0.4);
    const ccx = total[0] + total[2] / 2;
    const ccy = total[1] + total[3] / 2;
    cx = Math.min(ccx + mx + w / (4 * z), Math.max(ccx - mx - w / (4 * z), cx));
    cy = Math.min(ccy + my + h / (4 * z), Math.max(ccy - my - h / (4 * z), cy));
  }

  /** Zoom to `n` px/unit keeping the drawing point under (px, py) (container px) fixed. */
  function zoomEn(n: number, px = w / 2, py = h / 2): void {
    const nz = Math.min(zMax, Math.max(zMin, n));
    const X = cx + (px - w / 2) / z;
    const Y = cy + (py - h / 2) / z;
    z = nz;
    cx = X - (px - w / 2) / z;
    cy = Y - (py - h / 2) / z;
    limitar();
  }

  /** First view: the whole drawing when the box has its shape; otherwise fill the height from the left
   *  (a tall box would show the wide sheet as a thin strip). */
  function inicial(): void {
    const proporcion = w / h / (total[2] / total[3]);
    if (proporcion > 0.7) return todo();
    const zz = Math.min(zMax, Math.max(zMin, (h / total[3]) * 0.97));
    const ancho = w / zz;
    encuadrar([total[0], total[1], total[0] + ancho, total[1] + total[3]], 0.01);
  }

  // First fit, and refit when the box changes size a lot (rotation).
  let ultimoAjuste = 0;
  $effect(() => {
    const a = ajuste;
    if (!a) return;
    if (!z || Math.abs(a - ultimoAjuste) / a > 0.25) {
      ultimoAjuste = a;
      const e = untrack(() => enfoque);
      if (e) encuadrar(e.caja);
      else inicial();
    }
  });

  $effect(() => {
    const e = enfoque;
    if (e && w) encuadrar(e.caja);
  });

  // ---------------------------------------------------------------- pointer
  const punteros = new Map<number, { x: number; y: number; x0: number; y0: number }>();
  let arrastrando = false;
  let pinza: { d: number; z: number; X: number; Y: number } | null = null;
  let ultimoToque = { t: 0, x: 0, y: 0 };

  function rel(ev: { clientX: number; clientY: number }): [number, number] {
    const r = raiz!.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  }

  function aDibujo(px: number, py: number): [number, number] {
    return [cx + (px - w / 2) / z, cy + (py - h / 2) / z];
  }

  function abajo(ev: PointerEvent): void {
    if ((ev.target as HTMLElement).closest?.('.mandos-visor, .ficha, a, button')) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY });
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const [mx, my] = rel({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 });
      const [X, Y] = aDibujo(mx, my);
      pinza = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, z, X, Y };
      arrastrando = true;
    }
  }

  function mover(ev: PointerEvent): void {
    const p = punteros.get(ev.pointerId);
    if (!p) return;
    const dx = ev.clientX - p.x;
    const dy = ev.clientY - p.y;
    p.x = ev.clientX;
    p.y = ev.clientY;
    if (pinza && punteros.size >= 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
      const [mx, my] = rel({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 });
      z = Math.min(zMax, Math.max(zMin, (pinza.z * d) / pinza.d));
      cx = pinza.X - (mx - w / 2) / z;
      cy = pinza.Y - (my - h / 2) / z;
      limitar();
      return;
    }
    if (!arrastrando && Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) > 5) {
      arrastrando = true;
      raiz?.setPointerCapture(ev.pointerId);
    }
    if (arrastrando) {
      cx -= dx / z;
      cy -= dy / z;
      limitar();
    }
  }

  function arriba(ev: PointerEvent): void {
    const p = punteros.get(ev.pointerId);
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pinza = null;
    if (!p) return;
    const fueArrastre = arrastrando;
    if (punteros.size === 0) arrastrando = false;
    if (fueArrastre || ev.type === 'pointercancel') return;
    const [px, py] = rel(ev);
    // Tap in a capture mode: hand it to the page.
    if (captura && alTocar) {
      const [X, Y] = aDibujo(px, py);
      alTocar(X, Y, (ev.pointerType === 'mouse' ? 10 : 24) / z);
      return;
    }
    // Double tap on the background: zoom in (or back to the whole drawing when already close).
    const ahora = performance.now();
    if (ahora - ultimoToque.t < 320 && Math.hypot(px - ultimoToque.x, py - ultimoToque.y) < 30) {
      if (z > ajuste * 5) todo();
      else zoomEn(z * 2.2, px, py);
      ultimoToque.t = 0;
    } else ultimoToque = { t: ahora, x: px, y: py };
  }

  function rueda(ev: WheelEvent): void {
    ev.preventDefault();
    const [px, py] = rel(ev);
    const raton = ev.deltaMode !== 0 || (Math.abs(ev.deltaX) < 0.5 && Math.abs(ev.deltaY) >= 40 && Number.isInteger(ev.deltaY));
    if (ev.ctrlKey || raton) {
      const k = ev.deltaMode === 1 ? 0.06 : ev.ctrlKey ? 0.012 : 0.0022;
      zoomEn(z * Math.exp(-ev.deltaY * k), px, py);
    } else {
      cx += ev.deltaX / z;
      cy += ev.deltaY / z;
      limitar();
    }
  }

  function teclas(ev: KeyboardEvent): void {
    const paso = 60 / (z || 1);
    if (ev.key === '+' || ev.key === '=') zoomEn(z * 1.4);
    else if (ev.key === '-') zoomEn(z / 1.4);
    else if (ev.key === '0') todo();
    else if (ev.key === 'ArrowLeft') cx -= paso;
    else if (ev.key === 'ArrowRight') cx += paso;
    else if (ev.key === 'ArrowUp') cy -= paso;
    else if (ev.key === 'ArrowDown') cy += paso;
    else return;
    limitar();
    ev.preventDefault();
  }

  onMount(() => {
    raiz?.addEventListener('wheel', rueda, { passive: false });
    return () => raiz?.removeEventListener('wheel', rueda);
  });

  // The drawing's markup goes in once (innerHTML on an SVG element parses it as SVG).
  $effect(() => {
    if (dibujo) dibujo.innerHTML = svg;
  });

  const zoomPct = $derived(ajuste ? Math.round((z / ajuste) * 100) : 100);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="visor"
  class:captura
  bind:this={raiz}
  bind:clientWidth={w}
  bind:clientHeight={h}
  onpointerdown={abajo}
  onpointermove={mover}
  onpointerup={arriba}
  onpointercancel={arriba}
  onkeydown={teclas}
  tabindex="0"
  role="region"
  aria-label={`${etiqueta}: arrastre para desplazar, rueda o pellizco para ampliar`}
  data-zoom={z.toFixed(4)}
  data-vista={vista.map((v) => v.toFixed(1)).join(' ')}
>
  <svg class="dibujo" viewBox={vista.join(' ')} preserveAspectRatio="none" aria-hidden="true"
    font-family="'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif">
    <g bind:this={dibujo}></g>
  </svg>
  {#if viva && z > 0}
    <CapaEsquema esquemas={[est]} {vista} k={z} {activo} />
  {/if}
  {#if capas && z > 0}
    <svg class="encima" viewBox={vista.join(' ')} preserveAspectRatio="none">
      {@render capas(z, vista)}
    </svg>
  {/if}
  <div class="mandos-visor">
    <button type="button" aria-label="Alejar" title="Alejar (−)" onclick={() => zoomEn(z / 1.5)}><ZoomOut size={19} /></button>
    <span class="pct" aria-live="off">{zoomPct} %</span>
    <button type="button" aria-label="Acercar" title="Acercar (+)" onclick={() => zoomEn(z * 1.5)}><ZoomIn size={19} /></button>
    <button type="button" aria-label="Ver todo el esquema" title="Todo el esquema (0)" onclick={todo}><Maximize size={17} /></button>
  </div>
</div>

<style>
  .visor {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--placa);
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    cursor: grab;
    border-radius: 10px;
  }
  .visor:active {
    cursor: grabbing;
  }
  .visor.captura {
    cursor: crosshair;
  }
  .visor:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: -2px;
  }
  .dibujo,
  .encima {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .dibujo {
    filter: var(--placa-filtro);
    pointer-events: none;
  }
  .encima {
    pointer-events: none;
  }
  .visor.captura :global(.zona-e) {
    pointer-events: none;
  }
  .mandos-visor {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: color-mix(in srgb, var(--superficie) 92%, transparent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    font-family: var(--sans);
  }
  .mandos-visor button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--tinta);
    cursor: pointer;
  }
  .mandos-visor button:hover {
    background: var(--superficie-2);
  }
  .pct {
    min-width: 46px;
    text-align: center;
    font-size: 12.5px;
    color: var(--tinta-suave);
    font-variant-numeric: tabular-nums;
  }
  @media (pointer: coarse) {
    .mandos-visor button {
      width: 44px;
      height: 44px;
    }
  }
</style>
