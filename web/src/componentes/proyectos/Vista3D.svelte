<script lang="ts">
  // The board in 3D (escena3d.ts): orbit/pinch, views from above, below (the board is turned over), the side
  // and at an angle; layer toggles, explosion, X-ray, finish and voltages; tap or hover a part, a pad or a
  // track to select it. Rendered on demand; disposed on unmount.
  import { onMount, untrack } from 'svelte';
  import { formatoTension, type DatosPlaca } from './datos';
  import { cajaHuella, cajaRed, impacto, type Geometria } from './geometria';
  import { Escena3D } from './escena3d';
  import type { Seleccion } from './estado';
  import type { Opciones3D } from './opciones3d.svelte';
  import { deHuella, dePad, deRed, type Resuelta } from './seleccion';

  let {
    datos,
    geo,
    res,
    oscuro,
    enfocar = 0,
    opciones,
    alElegir,
  }: {
    datos: DatosPlaca;
    geo: Geometria;
    res: Resuelta;
    oscuro: boolean;
    enfocar?: number;
    opciones: Opciones3D;
    alElegir: (s: Seleccion | null) => void;
  } = $props();

  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let escena: Escena3D | null = null;
  let error = $state('');
  let listo = $state(false);
  /** Parts placed / total while they load (the board is already there). */
  let progreso = $state<[number, number] | null>(null);
  let ancho = 0;
  let alto = 0;
  let globo = $state<{ x: number; y: number; t: string } | null>(null);
  let etiqueta = $state<{ x: number; y: number; t: string } | null>(null);
  let vistaActual = $state<'iso' | 'arriba' | 'abajo' | 'lado'>('iso');
  /** Phone: layer and mode buttons folded behind «Capas y modos». */
  let abierta = $state(false);
  const tieneTensiones = $derived(datos.redes.some((r) => r.v));

  function texto(s: Seleccion | null): string {
    if (!s) return '';
    if (s.tipo === 'huella') {
      const h = datos.huellas.find((x) => x.r === s.id);
      return h ? `${h.r} · ${h.v}` : s.id;
    }
    if (s.tipo === 'red') {
      const r = datos.redes.find((x) => x.n === s.id);
      return `Red ${s.id}${r?.v ? ` · ${formatoTension(r.v.v)}` : ''}`;
    }
    const k = s.id.lastIndexOf('.');
    const h = datos.huellas.find((x) => x.r === s.id.slice(0, k));
    const p = h ? datos.pads.slice(h.pads[0], h.pads[0] + h.pads[1]).find((q) => q[1] === s.id.slice(k + 1)) : null;
    const r = p && p[12] >= 0 ? datos.redes[p[12]] : null;
    return `${s.id}${p?.[13] ? ` (${p[13]})` : ''}${r ? ` · ${r.n}` : ''}${r?.v ? ` · ${formatoTension(r.v.v)}` : ''}`;
  }

  /** Selection under a screen point. */
  function bajo(px: number, py: number, tol: number): Seleccion | null {
    if (!escena) return null;
    const t = escena.tocar(px, py, ancho, alto);
    if (!t) return null;
    if ('huella' in t) return deHuella(datos, t.huella);
    const vis = { F: opciones.capas.F, B: opciones.capas.B };
    const i = impacto(datos, geo, t.x, t.y, tol * 40, t.lado, vis, !opciones.capas.componentes || opciones.rayosX);
    if (!i) return null;
    if (i.tipo === 'pad') return dePad(datos, i.pad);
    if (i.tipo === 'huella') return deHuella(datos, i.huella);
    return i.red >= 0 ? deRed(datos, i.red) : null;
  }

  // tap = press and release without moving (Orbita handles the drag)
  let inicio: { x: number; y: number; t: number } | null = null;
  function pos(ev: PointerEvent): { x: number; y: number } {
    const r = lienzo!.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  function abajo(ev: PointerEvent): void {
    if (escena) escena.tocada = true;
    const p = pos(ev);
    inicio = { ...p, t: performance.now() };
  }
  function arriba(ev: PointerEvent): void {
    if (!inicio) return;
    const p = pos(ev);
    const quieto = Math.hypot(p.x - inicio.x, p.y - inicio.y) < (ev.pointerType === 'mouse' ? 4 : 10);
    inicio = null;
    if (quieto) alElegir(bajo(p.x, p.y, ev.pointerType === 'mouse' ? 0.15 : 0.4));
  }
  let pendiente = 0;
  function mover(ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse' || ev.buttons) {
      globo = null;
      return;
    }
    const p = pos(ev);
    if (pendiente) return;
    pendiente = requestAnimationFrame(() => {
      pendiente = 0;
      const s = bajo(p.x, p.y, 0.15);
      globo = s ? { x: p.x, y: p.y, t: texto(s) } : null;
    });
  }

  function vista(v: 'iso' | 'arriba' | 'abajo' | 'lado'): void {
    vistaActual = v;
    escena?.vista(v);
  }

  function actualizarEtiqueta(): void {
    if (!escena || res.huella === null) {
      etiqueta = null;
      return;
    }
    const p = escena.proyectar(res.huella, ancho, alto);
    const h = datos.huellas[res.huella]!;
    etiqueta = p ? { x: p[0], y: p[1], t: `${h.r} · ${h.v}` } : null;
  }

  onMount(() => {
    if (!lienzo || !caja) return;
    try {
      escena = new Escena3D(lienzo, datos, geo, oscuro);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      return;
    }
    escena.alCambiar = actualizarEtiqueta;
    const g = globalThis as unknown as { __epaPlaca3D?: unknown };
    g.__epaPlaca3D = escena.stats;
    const ro = new ResizeObserver((e) => {
      const r = e[0]?.contentRect;
      if (!r || !escena) return;
      ancho = r.width;
      alto = r.height;
      escena.tamano(r.width, r.height);
    });
    ro.observe(caja);
    escena.opciones({ capas: { ...opciones.capas }, acabado: opciones.acabado, rayosX: opciones.rayosX, tensiones: opciones.tensiones, red: res.red });
    escena.explotar(opciones.explosion);
    escena.seleccionar(res.huella);
    void escena.cargarPiezas((n, total) => (progreso = [n, total])).then(() => {
      listo = true;
      escena?.seleccionar(res.huella);
      // a selection from the route: frame it now that the parts are there
      if (escena && enfocar > 0) {
        if (res.huella !== null) escena.enfocar(cajaHuella(datos, res.huella));
        else if (res.red !== null) {
          const b = cajaRed(datos, res.red);
          if (b) escena.enfocar(b);
        }
      }
      (g as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo = true;
    });
    const perdido = (ev: Event) => {
      ev.preventDefault();
      error = 'Se perdió el contexto WebGL (la GPU se ha reiniciado). Vuelve a abrir la vista 3D o usa la vista 2D.';
    };
    lienzo.addEventListener('webglcontextlost', perdido);
    return () => {
      ro.disconnect();
      lienzo?.removeEventListener('webglcontextlost', perdido);
      if (pendiente) cancelAnimationFrame(pendiente);
      escena?.liberar();
      escena = null;
      (g as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo = false;
    };
  });

  // options and selection → scene
  $effect(() => {
    const o = { capas: { ...opciones.capas }, acabado: opciones.acabado, rayosX: opciones.rayosX, tensiones: opciones.tensiones, red: res.red };
    untrack(() => escena?.opciones(o));
  });
  $effect(() => {
    const e = opciones.explosion;
    untrack(() => escena?.explotar(e));
  });
  $effect(() => {
    const h = res.huella;
    untrack(() => {
      escena?.seleccionar(h);
      actualizarEtiqueta();
    });
  });
  $effect(() => {
    void enfocar;
    untrack(() => {
      if (!escena || enfocar === 0) return;
      if (res.huella !== null) escena.enfocar(cajaHuella(datos, res.huella));
      else if (res.red !== null) {
        const b = cajaRed(datos, res.red);
        if (b) escena.enfocar(b);
      }
    });
  });
</script>

<div class="v3d">
  <div class="barra" role="toolbar" aria-label="Opciones de la vista 3D">
    <div class="grupo" role="group" aria-label="Punto de vista">
      <button type="button" aria-pressed={vistaActual === 'iso'} onclick={() => vista('iso')}>Inclinada</button>
      <button type="button" aria-pressed={vistaActual === 'arriba'} onclick={() => vista('arriba')}>Arriba</button>
      <button type="button" aria-pressed={vistaActual === 'abajo'} onclick={() => vista('abajo')}>Abajo</button>
      <button type="button" aria-pressed={vistaActual === 'lado'} onclick={() => vista('lado')}>Canto</button>
    </div>
    <button type="button" class="mas" aria-expanded={abierta} onclick={() => (abierta = !abierta)}>{abierta ? 'Menos opciones' : 'Capas y modos'}</button>
    <div class="grupo capas extra" class:abierta role="group" aria-label="Capas">
      <button type="button" aria-pressed={opciones.capas.F} onclick={() => (opciones.capas.F = !opciones.capas.F)}><i class="m cf"></i>Cobre sup.</button>
      <button type="button" aria-pressed={opciones.capas.B} onclick={() => (opciones.capas.B = !opciones.capas.B)}><i class="m cb"></i>Cobre inf.</button>
      <button type="button" aria-pressed={opciones.capas.mascara} onclick={() => (opciones.capas.mascara = !opciones.capas.mascara)}><i class="m mk"></i>Máscara</button>
      <button type="button" aria-pressed={opciones.capas.serigrafia} onclick={() => (opciones.capas.serigrafia = !opciones.capas.serigrafia)}><i class="m sk"></i>Serigrafía</button>
      <button type="button" aria-pressed={opciones.capas.componentes} onclick={() => (opciones.capas.componentes = !opciones.capas.componentes)}><i class="m co"></i>Componentes</button>
    </div>
    <div class="grupo extra" class:abierta role="group" aria-label="Modos">
      <button type="button" aria-pressed={opciones.rayosX} onclick={() => (opciones.rayosX = !opciones.rayosX)}>Rayos X</button>
      {#if tieneTensiones}
        <button type="button" aria-pressed={opciones.tensiones} onclick={() => (opciones.tensiones = !opciones.tensiones)}>Tensiones</button>
      {/if}
      <button type="button" aria-pressed={opciones.acabado === 'enig'} onclick={() => (opciones.acabado = opciones.acabado === 'hasl' ? 'enig' : 'hasl')} title="Acabado de los pads: estaño (HASL) u oro (ENIG)">{opciones.acabado === 'hasl' ? 'HASL' : 'ENIG'}</button>
    </div>
    <label class="explosion extra" class:abierta>
      <span>Separar capas</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={opciones.explosion} aria-label="Separar las capas de la placa" />
    </label>
  </div>
  <div class="marco" bind:this={caja}>
    <canvas
      bind:this={lienzo}
      tabindex="0"
      aria-label="Placa en 3D: arrastra para girar, dos dedos o la rueda con Ctrl para acercar, Mayúsculas y arrastrar para desplazar; toca un componente, un pad o una pista"
      onpointerdown={abajo}
      onpointerup={arriba}
      onpointermove={mover}
      onpointerleave={() => (globo = null)}
      onwheel={() => escena && (escena.tocada = true)}
    ></canvas>
    {#if etiqueta}
      <div class="etiqueta" style:left={`${etiqueta.x}px`} style:top={`${etiqueta.y}px`}>{etiqueta.t}</div>
    {/if}
    {#if globo}
      <div class="globo" style:left={`${globo.x + 14}px`} style:top={`${globo.y + 14}px`}>{globo.t}</div>
    {/if}
    {#if !listo && !error}
      <div class="carga" aria-live="polite">
        Colocando los componentes…{#if progreso && progreso[1]}<span class="cuenta"> {progreso[0]} de {progreso[1]}</span>
          <span class="barra-progreso" style:--p={progreso[0] / progreso[1]}></span>{/if}
      </div>
    {/if}
    {#if opciones.rayosX}
      <div class="nota">Rayos X: placa de {datos.placa.capas.length} capas; el cobre superior (rojo) y el inferior (azul) a través del FR-4.</div>
    {/if}
    {#if error}
      <div class="error"><p>{error}</p></div>
    {/if}
  </div>
</div>

<style>
  .v3d {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100%;
    min-height: 0;
  }
  .barra {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 6px 0 8px;
  }
  .mas {
    display: none;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--acento);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  @media (max-width: 699px) {
    .mas {
      display: inline-flex;
      align-items: center;
    }
    .extra:not(.abierta) {
      display: none;
    }
  }
  .grupo {
    max-width: 100%;
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 2px;
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .grupo button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--tinta-suave);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .grupo button[aria-pressed='true'] {
    background: var(--superficie);
    color: var(--tinta);
    box-shadow: var(--sombra);
  }
  .capas button[aria-pressed='false'] .m {
    opacity: 0.25;
  }
  .m {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
  .cf {
    background: #d23c3c;
  }
  .cb {
    background: #4a82d6;
  }
  .mk {
    background: #1d5a32;
  }
  .sk {
    background: #f3f3ec;
    box-shadow: inset 0 0 0 1px #999;
  }
  .co {
    background: linear-gradient(135deg, #2b5fa8 0 50%, #c62828 50%);
  }
  .explosion {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  .explosion input {
    width: 140px;
    min-height: 32px;
  }
  @media (pointer: coarse) {
    .grupo button {
      min-height: 44px;
    }
    .explosion input {
      min-height: 44px;
    }
  }
  .marco {
    position: relative;
    min-height: 260px;
    overflow: hidden;
    border-radius: 12px;
    background: var(--superficie-2);
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
    outline: none;
    cursor: grab;
  }
  canvas:active {
    cursor: grabbing;
  }
  canvas:focus-visible {
    box-shadow: inset 0 0 0 2px var(--acento);
  }
  .etiqueta {
    position: absolute;
    transform: translate(-50%, calc(-100% - 10px));
    padding: 3px 8px;
    border-radius: 6px;
    background: #ffb02e;
    color: #1d1300;
    font-size: 13px;
    font-weight: 700;
    pointer-events: none;
    white-space: nowrap;
  }
  .globo {
    position: absolute;
    z-index: 2;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(20, 22, 26, 0.92);
    color: #fff;
    font-size: 13px;
    pointer-events: none;
    white-space: nowrap;
  }
  .carga,
  .nota {
    position: absolute;
    left: 10px;
    bottom: 8px;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 12px;
    pointer-events: none;
  }
  .carga .cuenta {
    font-variant-numeric: tabular-nums;
  }
  .barra-progreso {
    display: block;
    height: 3px;
    margin-top: 3px;
    border-radius: 2px;
    background: linear-gradient(90deg, #fff calc(var(--p) * 100%), rgba(255, 255, 255, 0.25) 0);
  }
  .error {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 20px;
    background: var(--superficie-2);
    color: var(--tinta);
    text-align: center;
  }
</style>
