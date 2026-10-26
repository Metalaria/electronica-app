<script lang="ts">
  // The 3D view of one model (this component and everything it imports is the lazily loaded 3D chunk):
  // canvas, label overlay and the toolbar (initial view, cutaway with its plane position, explosion, labels).
  import { onMount, untrack } from 'svelte';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Scissors from '@lucide/svelte/icons/scissors';
  import Layers from '@lucide/svelte/icons/layers';
  import Tag from '@lucide/svelte/icons/tag';
  import { Visor } from './motor/visor';
  import { crearModelo, liberarModelo } from './modelos';
  import type { DatosModelo, Montaje, Parametros } from './modelos/tipos';
  import { app } from '../../lib/estado.svelte';
  import { rutaDeRef } from '../../lib/datos';
  import { prepararSalto } from '../../lib/ruta.svelte';

  let {
    tipo,
    parametros = {},
    montaje = 'placa',
    nombre = '',
    alFallar,
    alto,
  }: {
    tipo: string;
    parametros?: Parametros;
    montaje?: Montaje;
    nombre?: string;
    alFallar?: (motivo: string) => void;
    /** CSS height of the viewport (default: 16:10, taller on phones). */
    alto?: string;
  } = $props();

  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let capa: HTMLDivElement | undefined = $state();
  let leyenda: HTMLOListElement | undefined = $state();
  let visor: Visor | null = null;
  let datos = $state<DatosModelo | null>(null);
  let listo = $state(false);
  /** 0.8: the first model's shader programs are compiled (until then «Preparando el modelo 3D…» stays). */
  let preparado = $state(false);

  let corte = $state(false);
  let iCorte = $state(0);
  let posCorte = $state(0);
  let explosion = $state(0);
  let etiquetas = $state(true);
  const tactil = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  const cortes = $derived(datos?.cortes ?? []);
  const rango = $derived(cortes[iCorte] ?? null);
  const fraccion = $derived(rango ? (posCorte - rango.min) / (rango.max - rango.min || 1) : 0);

  function enlace(ref: string): { href: string; num: string } | null {
    const r = app.refs[ref];
    const href = rutaDeRef(ref);
    if (!r || !href) return null;
    return { href, num: (r.tipo === 'fig' ? 'fig. ' : '') + r.num };
  }

  function fondo(): void {
    if (!visor || !caja) return;
    const css = getComputedStyle(caja);
    const c = css.getPropertyValue('--fondo-3d').trim() || '#f2f0eb';
    visor.ponerFondo(c, app.tema === 'oscuro');
  }

  let ultimoTipo = '';
  let pendiente = 0;
  function reconstruir(): void {
    if (!visor) return;
    cancelAnimationFrame(pendiente);
    const t = tipo;
    const p = $state.snapshot(parametros) as Parametros;
    const m = montaje;
    pendiente = requestAnimationFrame(() => {
      if (!visor) return;
      const g = crearModelo(t, p, { montaje: m });
      const mismo = t === ultimoTipo;
      ultimoTipo = t;
      visor.ponerModelo(g, mismo);
      datos = visor.datos();
      const n = datos?.cortes?.length ?? 0;
      if (iCorte >= n) iCorte = 0;
      posCorte = visor.posicionCorte();
      visor.ponerCorte(corte, posCorte);
      visor.ponerExplosion(explosion, false);
      visor.ponerEtiquetas(etiquetas);
      (globalThis as unknown as { __epaVisor3d?: unknown }).__epaVisor3d = { visor, datos, crearModelo, liberarModelo };
    });
  }

  onMount(() => {
    let vivo = true;
    // Markings are drawn with the app's font: wait for it (briefly) so the first textures use it.
    const fuentes = document.fonts?.load ? Promise.race([document.fonts.load('700 40px "Source Sans 3"'), new Promise((r) => setTimeout(r, 600))]) : Promise.resolve();
    void fuentes.then(() => {
      if (!vivo || !lienzo || !capa) return;
      try {
        visor = new Visor(lienzo, capa, {
          enlace,
          alSeguir: () => prepararSalto({ texto: nombre ? `Volver a ${nombre}` : 'Volver al modelo 3D' }),
          alFallar: (m) => alFallar?.(m),
          leyenda,
          alPreparar: () => (preparado = true),
        });
      } catch (e) {
        alFallar?.(e instanceof Error ? e.message : String(e));
        return;
      }
      fondo();
      listo = true;
      untrack(reconstruir);
    });
    return () => {
      vivo = false;
      cancelAnimationFrame(pendiente);
      const g = globalThis as unknown as { __epaVisor3d?: { visor: unknown } };
      if (g.__epaVisor3d?.visor === visor) delete g.__epaVisor3d;
      visor?.liberar();
      visor = null;
    };
  });

  // Rebuild when the model or its parameters change (coalesced to one frame).
  $effect(() => {
    void tipo;
    void montaje;
    void JSON.stringify(parametros);
    if (listo) untrack(reconstruir);
  });

  $effect(() => {
    void app.tema;
    if (listo) fondo();
  });

  function alternarCorte(): void {
    corte = !corte;
    visor?.ponerCorte(corte, posCorte);
    if (corte) visor?.mirarCorte();
  }

  function elegirCorte(i: number): void {
    iCorte = i;
    visor?.ponerCorteDatos(i);
    posCorte = visor?.posicionCorte() ?? 0;
    visor?.ponerCorte(corte, posCorte);
    visor?.mirarCorte();
  }

  function moverCorte(f: number): void {
    if (!rango) return;
    posCorte = rango.min + f * (rango.max - rango.min);
    if (!corte) corte = true;
    visor?.ponerCorte(true, posCorte);
  }

  function moverExplosion(f: number): void {
    explosion = f;
    visor?.ponerExplosion(f);
  }

  function alternarEtiquetas(): void {
    etiquetas = !etiquetas;
    visor?.ponerEtiquetas(etiquetas);
  }
</script>

<div class="visor3d" bind:this={caja}>
  <div class="lienzo" style:height={alto}>
    <canvas
      bind:this={lienzo}
      tabindex="0"
      aria-label={`Modelo 3D${nombre ? ` de ${nombre}` : ''}. Arrastra para girarlo; las flechas también lo giran, + y − acercan, 0 vuelve a la vista inicial.`}
      data-tipo={tipo}
    ></canvas>
    <div class="capa" bind:this={capa}></div>
    {#if !listo || !preparado}<div class="cargando" aria-live="polite">Preparando el modelo 3D…</div>{/if}
    <p class="ayuda" aria-hidden="true">
      {#if tactil}Un dedo gira · dos dedos acercan y desplazan{:else}Arrastra para girar · Ctrl + rueda para acercar · Mayús + arrastrar desplaza{/if}
    </p>
  </div>

  <ol class="leyenda3d" bind:this={leyenda} aria-label="Partes señaladas"></ol>

  <div class="barra" role="toolbar" aria-label="Vista 3D">
    <button type="button" class="b" onclick={() => visor?.vistaInicial(true)} title="Vista inicial (0)">
      <RotateCcw size={18} strokeWidth={2.2} /><span>Vista inicial</span>
    </button>
    {#if cortes.length}
      <button type="button" class="b" aria-pressed={corte} onclick={alternarCorte} data-control="corte">
        <Scissors size={18} strokeWidth={2.2} /><span>Corte</span>
      </button>
    {/if}
    {#if datos?.explosionable}
      <label class="deslizador" title="Separa las piezas">
        <Layers size={18} strokeWidth={2.2} aria-hidden="true" />
        <span>Explosión</span>
        <input type="range" min="0" max="1" step="0.01" value={explosion} oninput={(e) => moverExplosion(Number(e.currentTarget.value))} aria-label="Explosión: separación de las piezas" data-control="explosion" />
      </label>
    {/if}
    <button type="button" class="b" aria-pressed={etiquetas} onclick={alternarEtiquetas}>
      <Tag size={18} strokeWidth={2.2} /><span>Etiquetas</span>
    </button>
  </div>
  {#if cortes.length && corte}
    <div class="corte">
      {#if cortes.length > 1}
        <div class="segmentos" role="radiogroup" aria-label="Orientación del corte">
          {#each cortes as c, i (i)}
            <button type="button" role="radio" aria-checked={i === iCorte} onclick={() => elegirCorte(i)}>{c.nombre ?? `Corte ${i + 1}`}</button>
          {/each}
        </div>
      {/if}
      <label class="deslizador ancho">
        <span>Posición del plano</span>
        <input type="range" min="0" max="1" step="0.005" value={fraccion} oninput={(e) => moverCorte(Number(e.currentTarget.value))} aria-label="Posición del plano de corte" data-control="plano" />
        <output>{Math.round(fraccion * 100)} %</output>
      </label>
    </div>
  {/if}
</div>

<style>
  .visor3d {
    --fondo-3d: #eeece6;
    display: grid;
    gap: 10px;
    font-family: var(--sans);
  }
  :global([data-tema='sepia']) .visor3d {
    --fondo-3d: #ece2cc;
  }
  :global([data-tema='oscuro']) .visor3d {
    --fondo-3d: #23272e;
  }
  .lienzo {
    position: relative;
    width: 100%;
    /* Gestures on the canvas and on its labels move the model, never the page (no page pinch-zoom). */
    touch-action: none;
    aspect-ratio: 16 / 10;
    max-height: 72vh;
    border-radius: 14px;
    overflow: hidden;
    background: var(--fondo-3d);
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
  }
  @media (max-width: 640px) {
    .lienzo {
      aspect-ratio: 4 / 4.2;
    }
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
    outline: none;
  }
  canvas:active {
    cursor: grabbing;
  }
  canvas:focus-visible {
    box-shadow: inset 0 0 0 3px var(--acento);
  }
  .capa {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .capa :global(svg.lineas) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .capa :global(svg.lineas line) {
    stroke: var(--tinta-suave);
    stroke-width: 1.1;
    opacity: 0.85;
  }
  .capa :global(svg.lineas circle) {
    fill: var(--superficie);
    stroke: var(--tinta);
    stroke-width: 1.4;
  }
  .capa :global(.etiqueta3d) {
    position: absolute;
    left: 0;
    top: 0;
    max-width: min(46%, 300px);
    padding: 4px 9px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--superficie) 92%, transparent);
    box-shadow:
      0 0 0 1px var(--linea),
      0 2px 8px rgba(0, 0, 0, 0.12);
    color: var(--tinta);
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.25;
    text-decoration: none;
    pointer-events: auto;
    will-change: transform;
  }
  .capa :global(a.etiqueta3d b) {
    color: var(--acento);
    white-space: nowrap;
  }
  .capa :global(a.etiqueta3d:hover) {
    box-shadow:
      0 0 0 1.5px var(--acento),
      0 2px 8px rgba(0, 0, 0, 0.12);
  }
  .capa :global(.etiqueta3d.interior) {
    border-left: 3px solid var(--acento);
  }
  .capa :global(.etiqueta3d.oculta) {
    display: none;
  }
  .capa :global(.etiqueta3d .n) {
    display: none;
  }
  /* Narrow viewer: numbered markers on the model, the texts in the list below. */
  .capa:global(.compacta) :global(.etiqueta3d) {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    max-width: none;
    padding: 0;
    border-radius: 50%;
    background: var(--acento);
    color: #fff;
    border-left: 0;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .capa:global(.compacta) :global(.etiqueta3d .texto),
  .capa:global(.compacta) :global(.etiqueta3d b) {
    display: none;
  }
  .capa:global(.compacta) :global(.etiqueta3d .n) {
    display: block;
    font-style: normal;
    font-size: 12px;
    font-weight: 700;
  }
  .capa:global(.compacta) :global(.etiqueta3d.oculta) {
    display: none;
  }
  .leyenda3d {
    display: none;
    margin: 0;
    padding: 0 0 0 26px;
    font-size: 14px;
    line-height: 1.35;
    color: var(--tinta);
  }
  .leyenda3d:global(.activa) {
    display: grid;
    gap: 6px;
  }
  .leyenda3d :global(li::marker) {
    color: var(--acento);
    font-weight: 700;
  }
  .leyenda3d :global(a) {
    color: var(--tinta);
    text-decoration: none;
  }
  .leyenda3d :global(b) {
    color: var(--acento);
  }
  @media (pointer: coarse) {
    /* Touch targets: the same padding on every item (a min-height made one-line items taller than the rest). */
    .leyenda3d :global(li) {
      padding-block: 3px;
    }
  }

  @media (pointer: coarse) {
    .capa :global(a.etiqueta3d)::after {
      content: '';
      position: absolute;
      inset: -8px -4px;
    }
  }
  .cargando {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--tinta-suave);
    pointer-events: none;
  }
  .ayuda {
    position: absolute;
    left: 10px;
    bottom: 8px;
    margin: 0;
    padding: 2px 8px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--fondo-3d) 80%, transparent);
    color: var(--tinta-tenue);
    font-size: 12px;
    pointer-events: none;
  }
  .barra,
  .corte {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .b,
  .segmentos button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 14.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .b:hover,
  .segmentos button:hover {
    border-color: var(--acento);
  }
  .b[aria-pressed='true'],
  .segmentos button[aria-checked='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .segmentos {
    display: inline-flex;
    gap: 4px;
  }
  .deslizador {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    font-size: 14.5px;
    font-weight: 600;
    color: var(--tinta);
  }
  .deslizador.ancho {
    flex: 1 1 260px;
  }
  .deslizador input {
    flex: 1;
    min-width: 110px;
    height: 32px;
    accent-color: var(--acento);
  }
  output {
    min-width: 3.2em;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--tinta-suave);
  }
</style>
