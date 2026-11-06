<script lang="ts">
  // The parts tray (0.11): big cards with the real-looking part, its name and value, always in view (a strip
  // under the bench on touch screens, a column beside it on wide ones). Drag a card onto the board (the bench
  // shows the ghost of the part where its legs will land), or tap it and then tap the board. During
  // «Monta este circuito» the tray holds only the parts still to put, the one of the current step first.
  import type { Componente } from '../editor/tipos.ts';
  import { TIPO } from '../editor/catalogo.ts';
  import type { Protoboard } from './estado.svelte';
  import type { Pieza } from './tipos.ts';
  import { CARTAS, muestra, svgCarta, valorCarta, type CartaBandeja } from './bandeja.ts';
  import Plus from '@lucide/svelte/icons/plus';

  let {
    pb,
    lateral = false,
    alArrastrar,
    alMas,
    soloCartas = CARTAS,
  }: {
    pb: Protoboard;
    /** A column beside the bench (wide screens) instead of a strip under it. */
    lateral?: boolean;
    /** A card dragged: over the bench (ghost), dropped or cancelled. Returns whether it is over the bench. */
    alArrastrar: (fase: 'mover' | 'soltar' | 'cancelar', cx: number, cy: number, x: Componente | Pieza, dedo: boolean) => boolean;
    /** «Más piezas»: the whole palette. */
    alMas?: () => void;
    /** 1.0 (building challenges): only these cards (free building: all of them). */
    soloCartas?: CartaBandeja[];
  } = $props();

  interface Carta {
    clave: string;
    nombre: string;
    valor: string;
    svg: string;
    /** Free building: a fresh part of the card made when it is taken. */
    carta?: CartaBandeja;
    /** The guide: the very piece of the plan. */
    pieza?: Pieza;
    actual?: boolean;
  }

  const guia = $derived(pb.guia);
  const cartas = $derived.by((): Carta[] => {
    if (guia) {
      const paso = guia.paso;
      const enPlaca = new Set(pb.doc.piezas.map((p) => p.comp.nombre.toUpperCase()));
      return guia.pendientes
        .filter((s) => !enPlaca.has(s.pieza.comp.nombre.toUpperCase()))
        .map((s) => ({
          clave: s.pieza.id,
          nombre: `${TIPO.get(s.pieza.comp.tipo)?.nombre.replace(/ NA$/, '') ?? 'Pieza'} ${s.pieza.comp.nombre}`,
          valor: valorCarta(s.pieza.comp, s.pieza),
          svg: svgCarta(s.pieza),
          pieza: s.pieza,
          actual: paso?.tipo === 'pieza' && paso.pieza.id === s.pieza.id,
        }))
        .sort((a, b) => Number(!!b.actual) - Number(!!a.actual));
    }
    return soloCartas.map((c) => {
      const m = muestra(c);
      return { clave: c.clave, nombre: c.nombre, valor: valorCarta(m), svg: svgCarta(m), carta: c };
    });
  });

  // ---------------------------------------------------------------- dragging a card

  let toma: { id: number; x0: number; y0: number; c: Carta; tipo: string; desliza?: { ultimo: number; t: number; v: number } } | null = null;
  let cartasEl: HTMLDivElement | undefined = $state();
  let arrastre = $state<{ c: Carta; x: Componente | Pieza; cx: number; cy: number; sobre: boolean; dedo: boolean } | null>(null);
  let tras = false;

  function plantilla(c: Carta): Componente | Pieza | null {
    if (c.pieza) return c.pieza;
    if (c.carta) return pb.componente(c.carta.tipo, c.carta.campos);
    return null;
  }

  function abajo(ev: PointerEvent, c: Carta) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    toma = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, c, tipo: ev.pointerType };
    tras = false;
  }

  function mover(ev: PointerEvent) {
    if (arrastre) {
      if (ev.pointerId !== toma?.id) return;
      const sobre = alArrastrar('mover', ev.clientX, ev.clientY, arrastre.x, arrastre.dedo);
      arrastre = { ...arrastre, cx: ev.clientX, cy: ev.clientY, sobre };
      return;
    }
    if (!toma || ev.pointerId !== toma.id) return;
    // Scrolling the tray by hand (the cards take every touch: a diagonal drag must take the card, not scroll).
    if (toma.desliza) {
      const p = lateral ? ev.clientY : ev.clientX;
      const d = p - toma.desliza.ultimo;
      const ahora = performance.now();
      if (cartasEl) {
        if (lateral) cartasEl.scrollTop -= d;
        else cartasEl.scrollLeft -= d;
      }
      toma.desliza = { ultimo: p, t: ahora, v: d / Math.max(1, ahora - toma.desliza.t) };
      return;
    }
    const dx = ev.clientX - toma.x0;
    const dy = ev.clientY - toma.y0;
    if (Math.hypot(dx, dy) < 8) return;
    // A finger mostly along the tray scrolls it; anything else takes the card. The mouse takes it any way.
    const ratonOLapiz = toma.tipo !== 'touch';
    if (!ratonOLapiz && (lateral ? Math.abs(dy) > 1.5 * Math.abs(dx) : Math.abs(dx) > 1.5 * Math.abs(dy))) {
      try {
        (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
      } catch {
        /* synthetic events */
      }
      tras = true;
      toma.desliza = { ultimo: lateral ? ev.clientY : ev.clientX, t: performance.now(), v: 0 };
      return;
    }
    const x = plantilla(toma.c);
    if (!x) return;
    try {
      (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    } catch {
      /* synthetic events */
    }
    pb.armada = null;
    pb.sel = [];
    tras = true;
    const dedo = toma.tipo === 'touch';
    arrastre = { c: toma.c, x, cx: ev.clientX, cy: ev.clientY, sobre: alArrastrar('mover', ev.clientX, ev.clientY, x, dedo), dedo };
  }

  /** A flick keeps the tray going for a moment. */
  function inercia(v: number) {
    let vel = v * 16;
    const paso = () => {
      if (!cartasEl || Math.abs(vel) < 0.5) return;
      if (lateral) cartasEl.scrollTop -= vel;
      else cartasEl.scrollLeft -= vel;
      vel *= 0.92;
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  function arriba(ev: PointerEvent) {
    if (toma?.desliza && ev.pointerId === toma.id) inercia(toma.desliza.v);
    if (arrastre && ev.pointerId === toma?.id) alArrastrar('soltar', ev.clientX, ev.clientY, arrastre.x, arrastre.dedo);
    arrastre = null;
    toma = null;
  }

  function cancelar(ev: PointerEvent) {
    if (arrastre && ev.pointerId === toma?.id) alArrastrar('cancelar', ev.clientX, ev.clientY, arrastre.x, arrastre.dedo);
    arrastre = null;
    toma = null;
  }

  /** A tap (or Enter) chooses the card: the next tap on the board puts it there. */
  function elegir(c: Carta) {
    if (tras) {
      tras = false;
      return;
    }
    if (pb.armada && armadaDe(c)) {
      pb.armada = null;
      return;
    }
    const x = plantilla(c);
    if (!x) return;
    pb.armada = x;
    pb.sel = [];
    pb.mensaje = '';
  }

  const armadaDe = (c: Carta): boolean => {
    const a = pb.armada;
    if (!a) return false;
    if (c.pieza) return 'comp' in a && a.id === c.pieza.id;
    return !('comp' in a) && a.tipo === c.carta?.tipo && JSON.stringify(c.carta?.campos ?? {}) === JSON.stringify(Object.fromEntries(Object.entries(c.carta?.campos ?? {}).map(([k]) => [k, a.campos[k]])));
  };
</script>

<section class="bandeja" class:lateral aria-label="Piezas">
  <header>
    <h2>{guia ? 'Piezas de este montaje' : 'Piezas'}</h2>
    <p class:ahora={!!pb.armada}>{pb.armada ? 'Ahora toque la placa donde va.' : guia ? 'Arrastre la que brilla hasta su sitio.' : 'Arrástrela a la placa, o tóquela y luego toque la placa.'}</p>
  </header>
  <div class="cartas" bind:this={cartasEl}>
    {#each cartas as c (c.clave)}
      <button
        type="button"
        class="carta"
        class:actual={c.actual}
        class:elegida={armadaDe(c)}
        data-carta={c.carta?.clave ?? c.pieza?.comp.nombre}
        aria-label={`${c.nombre}${c.valor ? `, ${c.valor}` : ''}: arrástrela a la placa`}
        onpointerdown={(e) => abajo(e, c)}
        onpointermove={mover}
        onpointerup={arriba}
        onpointercancel={cancelar}
        onclick={() => elegir(c)}
      >
        <span class="dibujo">{@html c.svg}</span>
        <span class="nombre">{c.nombre}</span>
        {#if c.valor}<span class="valor">{c.valor}</span>{/if}
      </button>
    {:else}
      {#if guia}<p class="nada">Todas las piezas están puestas{guia.montado ? '.' : ': faltan cables.'}</p>{/if}
    {/each}
    {#if !guia && alMas}
      <button type="button" class="carta mas" onclick={alMas}><span class="dibujo"><Plus size={28} aria-hidden="true" /></span><span class="nombre">Más piezas</span><span class="valor">todas</span></button>
    {/if}
  </div>
</section>

{#if arrastre && !arrastre.sobre}
  <!-- The card follows the finger until it is over the bench (then the bench shows the part). -->
  <div class="volando" style:left={`${arrastre.cx}px`} style:top={`${arrastre.cy - (arrastre.dedo ? 56 : 0)}px`} aria-hidden="true">{@html arrastre.c.svg}</div>
{/if}

<style>
  .bandeja {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--superficie);
    font-family: var(--sans);
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 8px 12px 2px;
    min-width: 0;
  }
  h2 {
    flex: none;
    margin: 0;
    color: var(--titulos);
    font-size: 14px;
    font-weight: 700;
  }
  header p {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--tinta-suave);
    font-size: 12.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .cartas {
    display: flex;
    gap: 8px;
    padding: 6px 12px 10px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
  }
  .carta {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 1px;
    width: 96px;
    min-height: 104px;
    padding: 6px 4px 6px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    background: var(--fondo);
    color: var(--tinta);
    font-family: var(--sans);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    cursor: grab;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .carta:hover {
    border-color: var(--acento-borde);
    box-shadow: var(--sombra);
  }
  .carta.elegida {
    border-color: var(--acento);
    box-shadow: 0 0 0 3px var(--acento-tinte);
  }
  .carta.actual {
    border-color: #e0a800;
    box-shadow: 0 0 0 3px rgba(242, 183, 5, 0.3);
    animation: latido 1.4s ease-in-out infinite;
  }
  @keyframes latido {
    50% {
      box-shadow: 0 0 0 6px rgba(242, 183, 5, 0.12);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .carta.actual {
      animation: none;
    }
  }
  .dibujo {
    display: grid;
    place-items: center;
    width: 84px;
    height: 54px;
    /* the parts are physical objects: a light board colour behind them in every theme */
    border-radius: 9px;
    background: #f4f2ec;
    color: #5d6d7e;
  }
  .dibujo :global(svg) {
    width: 100%;
    height: 100%;
    max-width: 76px;
    max-height: 46px;
  }
  .nombre {
    margin-top: 3px;
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.15;
    text-align: center;
  }
  .valor {
    color: var(--tinta-suave);
    font-size: 11.5px;
    line-height: 1.2;
    text-align: center;
  }
  header p.ahora {
    color: var(--acento);
    font-weight: 700;
  }
  .mas .dibujo {
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .nada {
    margin: 8px 0;
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  /* Beside the bench: two columns, scrolled vertically. */
  .lateral {
    height: 100%;
  }
  .lateral header {
    flex-direction: column;
    gap: 2px;
  }
  .lateral header p {
    white-space: normal;
  }
  .lateral .cartas {
    display: grid;
    grid-template-columns: repeat(2, 96px);
    align-content: start;
    overflow-x: hidden;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }
  /* Phones: smaller cards, so the bench keeps its height. */
  @media (max-width: 600px) {
    header {
      padding-top: 6px;
    }
    header {
      display: none;
    }
    header:has(p.ahora) {
      display: flex;
    }
    header:has(p.ahora) h2 {
      display: none;
    }
    .cartas {
      gap: 6px;
      padding: 4px 10px 8px;
    }
    .carta {
      width: 82px;
      min-height: 90px;
      padding: 4px 3px;
    }
    .dibujo {
      width: 72px;
      height: 44px;
    }
    .dibujo :global(svg) {
      max-width: 64px;
      max-height: 38px;
    }
    .nombre {
      font-size: 12px;
    }
    .valor {
      font-size: 11px;
    }
  }
  .volando {
    position: fixed;
    z-index: 80;
    width: 84px;
    height: 54px;
    margin: -27px 0 0 -42px;
    padding: 4px;
    border-radius: 10px;
    background: rgba(244, 242, 236, 0.92);
    box-shadow: var(--sombra-alta);
    pointer-events: none;
  }
  .volando :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
