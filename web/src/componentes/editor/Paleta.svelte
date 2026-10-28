<script lang="ts">
  // The palette: the book's symbols by group, with a filter. A tap (or click) picks the part to place with
  // the next tap on the canvas; dragging a part onto the canvas places it where it is dropped.
  import { normalizar } from '../../lib/datos';
  import { TIPOS, type Tipo } from './catalogo.ts';
  import { geometria, S } from './geometria.ts';
  import type { EdicionPaleta } from './estado.svelte';
  import type { Componente } from './tipos.ts';

  let {
    ed,
    arrastre,
    horizontal = false,
  }: {
    ed: EdicionPaleta;
    /** Drag towards the canvas (screen point), returns whether it is over the canvas. */
    arrastre: (tipo: string, x: number, y: number, fase: 'mover' | 'soltar' | 'cancelar') => boolean;
    horizontal?: boolean;
  } = $props();

  let filtro = $state('');
  const grupos = $derived.by(() => {
    const q = normalizar(filtro.trim());
    const res = new Map<string, Tipo[]>();
    for (const t of TIPOS) {
      if (q && !normalizar(`${t.nombre} ${t.claves ?? ''} ${t.prefijo}`).includes(q)) continue;
      (res.get(t.grupo) ?? res.set(t.grupo, []).get(t.grupo)!).push(t);
    }
    return [...res.entries()];
  });

  function muestra(t: Tipo): { c: Componente; vista: string } {
    // Previews lie horizontally when they can (sources too), so the buttons stay small.
    const o = ['VM', 'V', 'VSIN', 'VPULSE', 'I'].includes(t.id) ? 0 : t.o;
    const c: Componente = { id: 'm', tipo: t.id, nombre: '', x: 0, y: 0, o, campos: { ...t.inicial } };
    const b = geometria(c).caja;
    const m = 0.25;
    return { c, vista: `${(b[0] - m) * S} ${(b[1] - m) * S} ${(b[2] - b[0] + 2 * m) * S} ${(b[3] - b[1] + 2 * m) * S}` };
  }

  let arr: { tipo: string; x: number; y: number; id: number; activo: boolean } | null = null;

  function abajo(ev: PointerEvent, tipo: string) {
    if (ev.button !== 0) return;
    arr = { tipo, x: ev.clientX, y: ev.clientY, id: ev.pointerId, activo: false };
  }
  function mover(ev: PointerEvent) {
    if (!arr || arr.id !== ev.pointerId) return;
    if (!arr.activo && Math.hypot(ev.clientX - arr.x, ev.clientY - arr.y) > 10) {
      // Horizontal swipes in the phone strip scroll it; only a drag away from it is a drag.
      if (horizontal && Math.abs(ev.clientY - arr.y) < Math.abs(ev.clientX - arr.x)) {
        arr = null;
        return;
      }
      arr.activo = true;
      try {
        (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (arr.activo) arrastre(arr.tipo, ev.clientX, ev.clientY, 'mover');
  }
  function arriba(ev: PointerEvent) {
    if (!arr || arr.id !== ev.pointerId) return;
    const a = arr;
    arr = null;
    if (!a.activo) return;
    if (!arrastre(a.tipo, ev.clientX, ev.clientY, ev.type === 'pointercancel' ? 'cancelar' : 'soltar')) return;
    ed.herramienta = 'seleccionar';
    ed.colocando = null;
    soltado = true;
  }
  let soltado = false;
  function elegir(tipo: string) {
    if (soltado) {
      soltado = false;
      return;
    }
    if (ed.herramienta === 'colocar' && ed.colocando === tipo) {
      ed.herramienta = 'seleccionar';
      ed.colocando = null;
      return;
    }
    ed.herramienta = 'colocar';
    ed.colocando = tipo;
    ed.sel = [];
  }
</script>

<div class="paleta" class:horizontal role="toolbar" aria-label="Paleta de componentes">
  {#if !horizontal}
    <input class="filtro" type="search" placeholder="Buscar componente" bind:value={filtro} aria-label="Buscar componente" />
  {/if}
  <div class="grupos">
    {#each grupos as [g, tipos] (g)}
      <div class="grupo">
        {#if !horizontal}<h4>{g}</h4>{/if}
        <div class="items">
          {#each tipos as t (t.id)}
            {@const m = muestra(t)}
            {@const geo = geometria(m.c)}
            <button
              type="button"
              class="item"
              class:activo={ed.herramienta === 'colocar' && ed.colocando === t.id}
              title={t.nombre}
              aria-label={t.nombre}
              aria-pressed={ed.herramienta === 'colocar' && ed.colocando === t.id}
              data-tipo={t.id}
              onpointerdown={(e) => abajo(e, t.id)}
              onpointermove={mover}
              onpointerup={arriba}
              onpointercancel={arriba}
              onclick={() => elegir(t.id)}
            >
              <svg viewBox={m.vista} aria-hidden="true">
                {#each geo.trazos as tr, i (i)}
                  <path class="l" class:ft={tr.relleno === 'tinta'} class:fb={tr.relleno === 'fondo'} d={tr.d} />
                {/each}
                {#each geo.textos as tx, i (i)}
                  <text x={tx.x * S} y={tx.y * S} text-anchor={tx.ancla} font-size={tx.tam * S}>{tx.s}</text>
                {/each}
              </svg>
              <span>{t.nombre}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .paleta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    min-width: 0;
    font-family: var(--sans);
  }
  .filtro {
    width: 100%;
    box-sizing: border-box;
    min-height: 38px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
  }
  .grupos {
    overflow-y: auto;
    min-height: 0;
    display: grid;
    gap: 10px;
    padding-right: 2px;
  }
  h4 {
    margin: 0 0 4px;
    font-size: 11.5px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--tinta-tenue);
  }
  .items {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
  }
  .item {
    display: grid;
    grid-template-rows: 34px auto;
    justify-items: center;
    align-items: center;
    gap: 2px;
    min-height: 64px;
    padding: 6px 4px 5px;
    border: 1px solid var(--linea-suave);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font-size: 11.5px;
    line-height: 1.15;
    text-align: center;
    touch-action: pan-y;
    cursor: grab;
  }
  .item:hover {
    border-color: var(--acento-borde);
    background: var(--superficie-2);
  }
  .item.activo {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--tinta);
  }
  .item svg {
    width: 100%;
    max-width: 66px;
    height: 34px;
    overflow: visible;
  }
  .l {
    fill: none;
    stroke: var(--titulos);
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ft {
    fill: var(--titulos);
  }
  .fb {
    fill: var(--superficie);
  }
  text {
    fill: var(--tinta);
    font-family: var(--sans);
  }
  /* Phones and tablets in portrait: one scrolling strip. */
  .horizontal .grupos {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 10px;
    padding-bottom: 4px;
    scrollbar-width: thin;
  }
  .horizontal .items {
    display: flex;
    gap: 4px;
  }
  .horizontal .grupo {
    display: flex;
  }
  .horizontal .item {
    width: 84px;
    font-size: 11px;
    flex: none;
    touch-action: pan-x;
  }
</style>
