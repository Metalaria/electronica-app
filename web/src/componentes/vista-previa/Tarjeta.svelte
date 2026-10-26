<script lang="ts">
  // Preview card of a reference: floating next to it (never over it) on a wide screen, a sheet at the bottom
  // (or at the top, when the reference is low on the screen) on a phone. Fixed position: the text under it
  // never moves.
  import { tick, untrack } from 'svelte';
  import type { BFigura } from '../../lib/tipos';
  import { prepararHtml, textoPlano, url, urlCss } from '../../lib/datos';
  import { ruta } from '../../lib/ruta.svelte';
  import { seguirReferencia } from '../../lib/vistaPrevia';
  import Insignia from '../Insignia.svelte';
  import Icono from '../Icono.svelte';
  import Tabla from '../Tabla.svelte';
  import { vista, cerrar } from './montar.svelte';
  import { resolver, rotulosDe, type Destino } from './destino';

  let destino = $state<Destino | null>(null);
  let fallo = $state(false);
  let tarjeta: HTMLElement | undefined = $state();
  let interior: HTMLElement | undefined = $state();
  let boton: HTMLButtonElement | undefined = $state();
  let colocada = $state(false);
  let estilo = $state('');
  let forma = $state<'flotante' | 'hoja' | 'hoja-arriba'>('flotante');
  let cortado = $state(false);
  let parrafosEl: HTMLElement | undefined = $state();

  const peticion = $derived(vista.peticion);
  const rapido = $derived(peticion ? rotulosDe(peticion.clave) : null);
  const rotulo = $derived(destino?.rotulo ?? rapido?.rotulo ?? '');
  const objeto = $derived(destino?.objeto ?? rapido?.objeto ?? 'la referencia');

  let generacion = 0;

  $effect(() => {
    const p = vista.peticion;
    void vista.n;
    untrack(() => void cargar(p));
  });

  async function cargar(p: typeof vista.peticion): Promise<void> {
    const g = ++generacion;
    destino = null;
    fallo = false;
    colocada = false;
    if (!p) return;
    p.a.setAttribute('aria-describedby', 'vista-previa');
    await tick();
    colocar();
    try {
      const d = await resolver(p.clave, ruta.vista === 'parte' ? ruta.parte : '');
      if (g !== generacion) return;
      destino = d;
      fallo = !d;
    } catch {
      if (g === generacion) fallo = true;
    }
    await tick();
    if (g !== generacion) return;
    colocar();
    if (p.modo === 'teclado') boton?.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ placement

  let hueco = -1;

  /** Height of what the app keeps at the bottom (tab bar + safe area). */
  function huecoInferior(): number {
    if (hueco >= 0) return hueco;
    const s = document.createElement('div');
    s.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:var(--hueco-inferior);visibility:hidden;pointer-events:none';
    document.body.appendChild(s);
    const h = s.offsetHeight;
    s.remove();
    // the tab bar changes with the layout: measure again next time
    requestAnimationFrame(() => (hueco = -1));
    hueco = h;
    return h;
  }

  function rectReferencia(): DOMRect | null {
    const p = vista.peticion;
    if (!p) return null;
    const rects = Array.from(p.a.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) return p.a.getBoundingClientRect();
    if (p.y == null) return rects[0]!;
    // the line of a wrapped reference under the pointer
    let mejor = rects[0]!;
    for (const r of rects) if (Math.abs((r.top + r.bottom) / 2 - p.y) < Math.abs((mejor.top + mejor.bottom) / 2 - p.y)) mejor = r;
    return mejor;
  }

  function colocar(): void {
    if (!tarjeta || !interior || !vista.peticion) return;
    const r = rectReferencia();
    if (!r) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const barra = (document.querySelector('header.barra') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 56;
    const arriba = Math.max(8, barra + 6);
    const abajo = vh - huecoInferior() - 8;
    // natural height of the card's content (the card itself may be capped, its body scrolls)
    let natural = 4;
    for (const el of Array.from(interior.children) as HTMLElement[]) natural += el.classList.contains('cuerpo') ? el.scrollHeight : el.offsetHeight;
    if (vw < 600) {
      const maxH = Math.round(Math.min(vh * 0.62, abajo - arriba));
      const h = Math.min(natural, maxH);
      // a sheet at the bottom unless it would cover the reference: then at the top
      if (r.bottom + 8 > abajo - h && r.top - 8 >= arriba + h) {
        forma = 'hoja-arriba';
        estilo = `top:${arriba - 6}px;max-height:${maxH}px`;
      } else {
        forma = 'hoja';
        estilo = `bottom:${vh - abajo - 8}px;max-height:${Math.min(maxH, Math.max(160, abajo - r.bottom - 8))}px`;
      }
    } else {
      forma = 'flotante';
      const w = Math.min(440, vw - 24);
      const bajo = abajo - r.bottom - 10;
      const sobre = r.top - arriba - 10;
      let top: number;
      let maxH: number;
      if (natural <= bajo || bajo >= sobre) {
        maxH = Math.max(120, bajo);
        top = r.bottom + 8;
      } else {
        maxH = Math.max(120, sobre);
        top = r.top - 8 - Math.min(natural, maxH);
      }
      const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12);
      estilo = `left:${Math.round(left)}px;top:${Math.round(top)}px;width:${Math.round(w)}px;max-height:${Math.round(maxH)}px`;
    }
    colocada = true;
    if (parrafosEl) cortado = parrafosEl.scrollHeight > parrafosEl.clientHeight + 2;
  }

  // Content that grows (an image that loads) places the card again.
  $effect(() => {
    if (!interior) return;
    void destino;
    const ro = new ResizeObserver(() => colocar());
    ro.observe(interior);
    for (const el of Array.from(interior.querySelectorAll('.cuerpo > *'))) ro.observe(el);
    return () => ro.disconnect();
  });

  // ------------------------------------------------------------------ content helpers

  /** Reference links inside the card are plain text (the card is about one reference). */
  function sinEnlaces(html: string | null | undefined): string {
    return prepararHtml(html)
      .replace(/<a\b[^>]*>/g, '<span class="ref-txt">')
      .replace(/<\/a>/g, '</span>');
  }

  function aspecto(f: BFigura): string | undefined {
    const v = (f as BFigura & { svg_vista?: number[] }).svg_vista;
    return v && v[2] && v[3] ? `${v[2]} / ${v[3]}` : undefined;
  }

  const PT_TEXTO = 10.5 / 1.12;

  function ir(): void {
    const p = vista.peticion;
    if (p) seguirReferencia(p.a);
  }

  function salirFoco(ev: FocusEvent): void {
    const p = vista.peticion;
    if (p?.modo !== 'teclado') return;
    const a = ev.relatedTarget as Node | null;
    if (a && (tarjeta?.contains(a) || p.a.contains(a))) return;
    cerrar();
  }
</script>

{#if peticion}
  {@const d = destino}
  <div
    bind:this={tarjeta}
    id="vista-previa"
    class="vista-previa {forma}"
    class:colocada
    class:tactil={peticion.modo === 'toque'}
    role="dialog"
    aria-modal="false"
    aria-labelledby="vista-previa-tit"
    tabindex="-1"
    style={estilo}
    style:--c={`#${d?.color ?? '1A3A5C'}`}
    onfocusout={salirFoco}
  >
    <div class="interior" bind:this={interior}>
      <header class="cab">
        {#if d}<Insignia parte={d.parte} />{/if}
        <span class="rotulo" id="vista-previa-tit">
          {rotulo}{#if d?.enParte}<span class="en">&nbsp;· {d.enParte}</span>{/if}
        </span>
        <button class="boton-icono cerrar" type="button" aria-label="Cerrar la vista previa" onclick={() => cerrar()}><Icono nombre="x" tam={18} /></button>
      </header>

      <div class="cuerpo">
        {#if fallo}
          <p class="aviso">No se pudo cargar la vista previa.</p>
        {:else if !d}
          <div class="esqueleto" aria-hidden="true"><span></span><span></span><span style="width:70%"></span></div>
        {:else if d.tipo === 'fig' && d.figura}
          {@const f = d.figura}
          <div class="placa" class:vectorial={/\.svg$/i.test(f.src)}>
            <img src={url(f.src)} alt={`Figura ${f.num ?? ''}: ${textoPlano(f.pie)}`} style:aspect-ratio={aspecto(f)} decoding="async" draggable="false" onload={colocar} />
          </div>
          {#if f.pie}<p class="pie"><span class="rot">Figura {f.num} —</span> {@html sinEnlaces(f.pie)}</p>{/if}
        {:else if d.tipo === 'tab' && d.tabla}
          <div class="texto-libro tabla-previa"><Tabla bloque={{ ...d.tabla, label: null }} /></div>
        {:else if d.tipo === 'ec' && d.ecuacion}
          {@const e = d.ecuacion}
          {@const src = url(e.svg)}
          <div class="ec texto-libro">
            {#if e.etiqueta}<div class="ec-etiqueta">{@html sinEnlaces(e.etiqueta)}</div>{/if}
            <div class="ec-marco">
              <img
                class="m ec-img"
                {src}
                alt={e.fuente}
                draggable="false"
                style={`width:${(e.w / PT_TEXTO).toFixed(3)}em;height:${(e.h / PT_TEXTO).toFixed(3)}em;-webkit-mask-image:${urlCss(src)};mask-image:${urlCss(src)}`}
              />
            </div>
          </div>
        {:else}
          {#if d.titulo}<h3 class="titulo">{#if d.tipo === 'sec' && d.num}<span class="num">{d.num}</span>{/if}{d.titulo}</h3>{/if}
          {#if d.parrafos.length}
            <div class="parrafos texto-libro" class:cortado bind:this={parrafosEl}>
              {#each d.parrafos as h, k (k)}<p>{@html sinEnlaces(h)}</p>{/each}
            </div>
          {/if}
          {#if d.figura}
            {@const f = d.figura}
            <div class="figura-mini">
              <div class="placa" class:vectorial={/\.svg$/i.test(f.src)}>
                <img src={url(f.src)} alt={`Figura ${f.num ?? ''}: ${textoPlano(f.pie)}`} style:aspect-ratio={aspecto(f)} decoding="async" draggable="false" onload={colocar} />
              </div>
              {#if f.num}<span class="pie-mini"><span class="rot">Figura {f.num}</span> {textoPlano(f.pie)}</span>{/if}
            </div>
          {/if}
        {/if}
      </div>

      <footer class="pie-tarjeta">
        <button class="boton primario ir" type="button" bind:this={boton} onclick={ir}>
          Ir a {objeto}
          <Icono nombre="chevron" tam={17} />
        </button>
        {#if peticion.modo === 'toque'}<span class="pista">o toque de nuevo el enlace</span>{/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  .vista-previa {
    position: fixed;
    z-index: 70;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--linea);
    border-top: 3px solid var(--c);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
    visibility: hidden;
    --simbolo-fondo: var(--superficie);
  }
  :global(:root[data-tema='oscuro']) .vista-previa {
    border-top-color: color-mix(in srgb, var(--c) 70%, #fff 30%);
  }
  .vista-previa.colocada {
    visibility: visible;
  }
  .vista-previa:focus {
    outline: none;
  }
  .hoja,
  .hoja-arriba {
    left: 0;
    right: 0;
    width: auto;
    border-radius: 16px 16px 0 0;
    border-left: 0;
    border-right: 0;
  }
  .hoja-arriba {
    border-radius: 0 0 16px 16px;
    border-top-width: 1px;
    border-bottom: 3px solid var(--c);
  }
  @media (prefers-reduced-motion: no-preference) {
    .vista-previa.colocada {
      animation: aparecer 0.14s ease-out;
    }
    .hoja.colocada {
      animation: subir 0.18s ease-out;
    }
  }
  @keyframes aparecer {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  @keyframes subir {
    from {
      transform: translateY(24px);
      opacity: 0.4;
    }
  }
  .interior {
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: inherit;
  }
  .cab {
    display: flex;
    flex: none;
    align-items: center;
    gap: 9px;
    padding: 9px 8px 6px 14px;
  }
  .rotulo {
    flex: 1;
    min-width: 0;
    color: var(--titulos);
    font-size: 14.5px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  .en {
    color: var(--tinta-tenue);
    font-weight: 600;
  }
  .cerrar {
    flex: none;
    width: 34px;
    height: 34px;
  }
  .cuerpo {
    flex: 1 1 auto;
    min-height: 0;
    padding: 2px 14px 10px;
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .placa {
    display: grid;
    place-items: center;
    border-radius: 8px;
    overflow: hidden;
  }
  .placa.vectorial {
    padding: 10px;
    border: 1px solid var(--linea-suave);
    background: var(--placa);
  }
  .placa img {
    display: block;
    width: 100%;
    max-height: min(300px, 40vh);
    height: auto;
    object-fit: contain;
  }
  .placa.vectorial img {
    filter: var(--placa-filtro);
  }
  .pie {
    margin: 8px 0 0;
    color: var(--tinta-suave);
    font-size: 13.5px;
    line-height: 1.45;
  }
  .rot {
    color: var(--c);
    font-weight: 700;
  }
  :global(:root[data-tema='oscuro']) .rot {
    color: color-mix(in srgb, var(--c) 45%, #fff 55%);
  }
  .vista-previa :global(.ref-txt) {
    font-weight: 600;
  }
  .titulo {
    margin: 2px 0 6px;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.25;
  }
  .titulo .num {
    margin-right: 0.4em;
    color: var(--c);
  }
  :global(:root[data-tema='oscuro']) .titulo .num {
    color: color-mix(in srgb, var(--c) 45%, #fff 55%);
  }
  .parrafos {
    max-height: 9.4em;
    overflow: hidden;
    font-size: 15.5px;
    line-height: 1.5;
  }
  .parrafos.cortado {
    -webkit-mask-image: linear-gradient(to bottom, #000 62%, transparent);
    mask-image: linear-gradient(to bottom, #000 62%, transparent);
  }
  .parrafos :global(p) {
    margin: 0 0 0.5em;
    text-align: left;
    hyphens: manual;
  }
  .figura-mini {
    margin-top: 8px;
  }
  .figura-mini .placa img {
    max-height: 150px;
  }
  .pie-mini {
    display: -webkit-box;
    margin-top: 5px;
    overflow: hidden;
    color: var(--tinta-suave);
    font-size: 13px;
    line-height: 1.4;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .tabla-previa {
    font-size: 15px;
  }
  .tabla-previa :global(.tabla) {
    margin: 0;
  }
  .ec {
    margin: 0;
    font-size: 17px;
  }
  .aviso {
    margin: 4px 0 6px;
    color: var(--tinta-suave);
  }
  .esqueleto {
    display: grid;
    gap: 10px;
    padding: 6px 0 8px;
  }
  .esqueleto span {
    height: 12px;
    border-radius: 6px;
    background: var(--linea-suave);
  }
  .pie-tarjeta {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 8px 14px 12px;
    border-top: 1px solid var(--linea-suave);
  }
  .ir {
    min-height: 40px;
  }
  .pista {
    color: var(--tinta-tenue);
    font-size: 13px;
  }
</style>
