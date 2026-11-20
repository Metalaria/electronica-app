<script lang="ts">
  // The board in 3D (escena3d.ts): navigated like a map (1.3, tres/motor/orbita.ts: one finger pans, two fingers
  // zoom, twist and tilt), views from above, below (the board is turned over), the side and at an angle; layer
  // toggles, explosion, X-ray, finish and voltages; tap or hover a part, a pad or a track to select it, double
  // tap (or double click) to bring it closer. Rendered on demand; disposed on unmount. 0.9: the parts are only
  // built when «Componentes» is on (at once, or when it is turned on later): with it off nothing of them is loaded.
  import { onMount, untrack, type Snippet } from 'svelte';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Compass from '@lucide/svelte/icons/compass';
  import { formatoTension, type DatosPlaca } from './datos';
  import { cajaHuella, cajaRed, impacto, type Geometria } from './geometria';
  import { Escena3D, type Vista } from './escena3d';
  import { precargarEntorno } from '../tres/motor/entorno';
  import { cargarBiblioteca } from './modelos3d';
  import type { Seleccion } from './estado';
  import type { Opciones3D } from './opciones3d.svelte';
  import { deHuella, dePad, deRed, type Resuelta } from './seleccion';
  import { zonaRecuperable } from '../fallos/Recuperable.svelte';
  import { informarFallo, miga } from '../../lib/informe-fallos';

  let {
    datos,
    geo,
    res,
    oscuro,
    enfocar = 0,
    opciones,
    alElegir,
    alEscena,
    alToque,
    alCuadro,
    encima,
  }: {
    datos: DatosPlaca;
    geo: Geometria;
    res: Resuelta;
    oscuro: boolean;
    enfocar?: number;
    opciones: Opciones3D;
    alElegir: (s: Seleccion | null) => void;
    /** 1.3 (averias13): a host that draws on the board («Busque la avería»): the scene when it exists (null when it goes). */
    alEscena?: (e: Escena3D | null) => void;
    /** 1.3: a single tap (canvas px) the host takes first; true: taken (no selection). */
    alToque?: (x: number, y: number, tipo: string) => boolean;
    /** 1.3: every frame drawn (the host's overlays follow the camera). */
    alCuadro?: () => void;
    /** 1.3: the host's overlays over the canvas (in the canvas's box). */
    encima?: Snippet;
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
  let vistaActual = $state<Vista>('arriba');
  const tactil = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
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

  // tap = press and release of a single pointer without moving (Orbita handles the drag); two taps in a row on
  // the same spot = double tap (1.3: bring it closer)
  let inicio: { x: number; y: number; t: number; id: number; boton: number } | null = null;
  let presionados = 0;
  let ultimoToque: { x: number; y: number; t: number } | null = null;
  function pos(ev: PointerEvent): { x: number; y: number } {
    const r = lienzo!.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  /**
   * The canvas's listeners, added and removed by hand (0.11 QA, leaks): three.js keeps every WebGL context it used
   * reachable (its shared empty textures stay uploaded in it), and with it the canvas; handlers set as attributes
   * stay on the element after the view closes and kept this component's data (the whole board) alive per visit.
   */
  function oyentes(el: HTMLCanvasElement): { destroy(): void } {
    const h: [string, EventListener, AddEventListenerOptions?][] = [
      ['pointerdown', abajo as EventListener],
      ['pointerup', arriba as EventListener],
      ['pointercancel', cancelado as EventListener],
      ['pointermove', mover as EventListener],
      ['pointerleave', () => (globo = null)],
      ['wheel', () => escena && (escena.tocada = true), { passive: true }],
    ];
    for (const [t, f, o] of h) el.addEventListener(t, f, o);
    return {
      destroy() {
        for (const [t, f] of h) el.removeEventListener(t, f);
      },
    };
  }

  function abajo(ev: PointerEvent): void {
    if (escena) escena.tocada = true;
    presionados++;
    // a second finger: a gesture, not a tap
    if (presionados > 1) {
      inicio = null;
      ultimoToque = null;
      return;
    }
    // (right button, Ctrl/⌘ + click: turning the board, not a tap)
    const boton = ev.button === 0 && !ev.ctrlKey && !ev.metaKey ? 0 : 1;
    inicio = { ...pos(ev), t: performance.now(), id: ev.pointerId, boton };
  }
  function cancelado(): void {
    presionados = Math.max(0, presionados - 1);
    inicio = null;
  }
  function arriba(ev: PointerEvent): void {
    presionados = Math.max(0, presionados - 1);
    if (!inicio || inicio.id !== ev.pointerId) return;
    const p = pos(ev);
    const raton = ev.pointerType === 'mouse';
    const quieto = inicio.boton === 0 && Math.hypot(p.x - inicio.x, p.y - inicio.y) < (raton ? 4 : 10);
    inicio = null;
    if (!quieto) {
      ultimoToque = null;
      return;
    }
    // (the input's own time: a page busy with the first tap's selection must not turn a double tap into two taps)
    const ahora = ev.timeStamp > 0 ? ev.timeStamp : performance.now();
    if (ultimoToque && Math.abs(ahora - ultimoToque.t) < 400 && Math.hypot(p.x - ultimoToque.x, p.y - ultimoToque.y) < (raton ? 8 : 32)) {
      // the second tap: closer (the first one already chose what is there)
      ultimoToque = null;
      escena?.acercar(p.x, p.y, ancho, alto);
      return;
    }
    ultimoToque = { ...p, t: ahora };
    if (alToque?.(p.x, p.y, ev.pointerType)) return;
    alElegir(bajo(p.x, p.y, raton ? 0.15 : 0.4));
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

  function vista(v: Vista): void {
    vistaActual = v;
    escena?.vista(v);
  }

  function actualizarEtiqueta(): void {
    alCuadro?.();
    if (!escena || res.huella === null) {
      etiqueta = null;
      return;
    }
    const p = escena.proyectar(res.huella, ancho, alto);
    const h = datos.huellas[res.huella]!;
    etiqueta = p ? { x: p[0], y: p[1], t: `${h.r} · ${h.v}` } : null;
  }

  // (__epaPlaca3DEscena: the scene itself, for the tests of the navigation — its camera, Orbita)
  const g = globalThis as unknown as { __epaPlaca3D?: unknown; __epaPlaca3DListo?: boolean; __epaPlaca3DEscena?: unknown };

  /** Frames the selected part or net (from the route). */
  function enfocarSeleccion(e: Escena3D): void {
    if (res.huella !== null) e.enfocar(cajaHuella(datos, res.huella));
    else if (res.red !== null) {
      const b = cajaRed(datos, res.red);
      if (b) e.enfocar(b);
    }
  }

  /** Builds the parts once, when «Componentes» is on. */
  function pedirPiezas(): void {
    if (!escena || escena.piezasPedidas) return;
    const e = escena;
    listo = false;
    g.__epaPlaca3DListo = false;
    progreso = null;
    void e.cargarPiezas((n, total) => (progreso = [n, total])).then(() => {
      if (e !== escena) return;
      listo = true;
      e.seleccionar(res.huella);
      // a selection from the route: frame it now that the parts are there
      if (enfocar > 0) enfocarSeleccion(e);
      g.__epaPlaca3DListo = true;
    });
  }

  // 0.12: the studio's environment saved by an earlier session is read meanwhile (entorno.ts), so the scene
  // below does not filter it again
  // 1.0: the recoverable zone around the view (a lost WebGL context is shown there with «Reintentar»)
  const zona = zonaRecuperable();
  const entornoListo = precargarEntorno();
  // and the model library is fetched now, while the board is set up (it was asked for only once the scene existed)
  untrack(() => {
    if (opciones.capas.componentes) void cargarBiblioteca();
  });

  onMount(() => {
    if (!lienzo || !caja) return;
    let cerrada = false;
    let ro: ResizeObserver | null = null;
    const perdido = (ev: Event) => {
      ev.preventDefault();
      // 1.0: inside a recoverable zone (Proyectos, PlacaConsola) the zone shows «Reintentar», which builds the view
      // again in a new canvas; elsewhere the message as before. Either way, into the «Informe de fallos».
      const motivo = 'Se perdió el contexto WebGL (la GPU se ha reiniciado). Pulse «Reintentar» o use la vista 2D.';
      if (zona) zona.fallar(motivo, 'contexto WebGL perdido (placa 3D)', 'webgl');
      else {
        informarFallo('webgl', 'contexto WebGL perdido (placa 3D)', { zona: 'la vista 3D de la placa' });
        error = 'Se perdió el contexto WebGL (la GPU se ha reiniciado). Vuelva a abrir la vista 3D o use la vista 2D.';
      }
    };
    void entornoListo.then(() => {
      if (!cerrada) crear();
    });
    function crear(): void {
      if (!lienzo || !caja) return;
      miga('placa 3D: abrir');
      let es: Escena3D;
      try {
        es = new Escena3D(lienzo, datos, geo, oscuro);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        return;
      }
      escena = es;
      es.alCambiar = actualizarEtiqueta;
      es.alVista = (v) => (vistaActual = v);
      vistaActual = es.vistaPorDefecto;
      g.__epaPlaca3D = es.stats;
      g.__epaPlaca3DEscena = es;
      alEscena?.(es);
      ro = new ResizeObserver((e) => {
        const r = e[0]?.contentRect;
        if (!r || escena !== es) return;
        ancho = r.width;
        alto = r.height;
        es.tamano(r.width, r.height);
      });
      ro.observe(caja);
      // (the effects below ran before the scene existed: what they set is applied here)
      es.opciones({ capas: { ...opciones.capas }, acabado: opciones.acabado, rayosX: opciones.rayosX, tensiones: opciones.tensiones, red: res.red });
      es.explotar(opciones.explosion);
      es.seleccionar(res.huella);
      if (enfocar > 0) enfocarSeleccion(es);
      if (opciones.capas.componentes) pedirPiezas();
      else {
        // Without the parts the view is ready with the board's first frame.
        void es.placaLista.then(() => {
          if (es !== escena || es.piezasPedidas) return;
          listo = true;
          g.__epaPlaca3DListo = true;
        });
      }
      lienzo.addEventListener('webglcontextlost', perdido);
    }
    return () => {
      cerrada = true;
      ro?.disconnect();
      lienzo?.removeEventListener('webglcontextlost', perdido);
      if (pendiente) cancelAnimationFrame(pendiente);
      if (g.__epaPlaca3DEscena === escena) delete g.__epaPlaca3DEscena;
      if (escena) alEscena?.(null);
      escena?.liberar();
      escena = null;
      g.__epaPlaca3DListo = false;
      // three.js keeps the context (and so the canvas) reachable after it is released: out of the page's tree,
      // the canvas no longer holds the view's other ≈ 190 elements with it (0.11 QA, leaks)
      lienzo?.remove();
    };
  });

  // options and selection → scene
  $effect(() => {
    const o = { capas: { ...opciones.capas }, acabado: opciones.acabado, rayosX: opciones.rayosX, tensiones: opciones.tensiones, red: res.red };
    untrack(() => {
      escena?.opciones(o);
      // «Componentes» turned on: the parts are built now (only once)
      if (o.capas.componentes) pedirPiezas();
    });
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
      if (escena && enfocar > 0) enfocarSeleccion(escena);
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
    <div class="grupo" role="group" aria-label="Encuadre">
      <button type="button" onclick={() => escena && escena.vista(escena.vistaPorDefecto)} title="Vista inicial: la placa entera desde arriba (tecla 0)"><RotateCcw size={16} strokeWidth={2.2} aria-hidden="true" />Vista inicial</button>
      <button type="button" onclick={() => escena?.enderezar()} title="Mirar desde arriba, con la placa derecha, sin cambiar el encuadre"><Compass size={16} strokeWidth={2.2} aria-hidden="true" />Vista desde arriba</button>
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
      aria-label="Placa en 3D, que se recorre como un mapa: arrastre con un dedo o con el ratón para moverla; con dos dedos, pellizque para acercar, gírelos para girarla o arrástrelos juntos hacia arriba o hacia abajo para inclinarla; con el ratón, el botón derecho o Ctrl y arrastrar giran e inclinan, y la rueda acerca hacia el puntero; doble toque o doble clic acerca un componente. Con el teclado: flechas para moverla, Mayúsculas y flechas para girarla (izquierda y derecha) e inclinarla (arriba y abajo), + y − para acercar o alejar y 0 para la vista inicial. Toque un componente, un pad o una pista para elegirlo."
      use:oyentes
    ></canvas>
    {#if etiqueta}
      <div class="etiqueta" style:left={`${etiqueta.x}px`} style:top={`${etiqueta.y}px`}>{etiqueta.t}</div>
    {/if}
    {#if encima}{@render encima()}{/if}
    {#if globo}
      <div class="globo" style:left={`${globo.x + 14}px`} style:top={`${globo.y + 14}px`}>{globo.t}</div>
    {/if}
    <div class="pie">
      {#if !listo && !error && opciones.capas.componentes}
        <div class="carga" aria-live="polite">
          Colocando los componentes…{#if progreso && progreso[1]}<span class="cuenta"> {progreso[0]} de {progreso[1]}</span>
            <span class="barra-progreso" style:--p={progreso[0] / progreso[1]}></span>{/if}
        </div>
      {/if}
      {#if opciones.rayosX}
        <div class="nota">Rayos X: placa de {datos.placa.capas.length} capas; el cobre superior (rojo) y el inferior (azul) a través del FR-4.</div>
      {/if}
      <p class="ayuda" aria-hidden="true">
        {#if tactil}Un dedo mueve · dos dedos acercan o, girándolos, giran · dos dedos hacia arriba o abajo inclinan · doble toque acerca{:else}Arrastre para mover · Ctrl + rueda acerca · botón derecho o Ctrl + arrastrar gira e inclina · doble clic acerca · flechas mueven, Mayús + flechas giran e inclinan, 0 vuelve al inicio{/if}
      </p>
    </div>
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
  .pie {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    pointer-events: none;
  }
  .carga,
  .nota {
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 12px;
  }
  .ayuda {
    max-width: 100%;
    margin: 0;
    padding: 2px 8px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--superficie-2) 82%, transparent);
    color: var(--tinta-suave);
    font-size: 12px;
    line-height: 1.35;
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
