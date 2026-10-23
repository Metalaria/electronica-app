<script lang="ts">
  // The automatic schematic of a netlist (or of one of its subcircuits), inline and themed, with pan and
  // zoom (buttons, Ctrl + wheel, trackpad and touch pinch, drag when zoomed) and clickable parts: a click
  // selects the part and announces it (`alElegir` and the window event «epa:elegir-componente»), which the
  // simulator page uses to bring up that part's slider.
  import { untrack } from 'svelte';
  import { esquemaAutomatico, type ResultadoEsquema } from './index';
  import EsquemaAuto from './EsquemaAuto.svelte';
  import Icono from '../Icono.svelte';

  let {
    texto,
    subckt = null,
    titulo = 'Circuito',
    alElegir,
    alVolver,
  }: {
    texto: string;
    /** Draw the body of this .subckt instead of the main circuit. */
    subckt?: string | null;
    titulo?: string;
    /** A part was clicked (lower-case netlist name). */
    alElegir?: (nombre: string) => void;
    /** Shown as «Volver» (subcircuit view). */
    alVolver?: () => void;
  } = $props();

  let r = $state.raw<ResultadoEsquema | null>(null);
  let estado = $state<'cargando' | 'ok' | 'vacio' | 'error'>('cargando');
  let mensaje = $state('');
  let interior = $state<string | null>(null);
  let seleccion = $state<string | null>(null);

  // Regenerate shortly after typing stops; the worker keeps the layout while only values change.
  let espera: ReturnType<typeof setTimeout> | null = null;
  let turno = 0;
  $effect(() => {
    const t = texto;
    const s = subckt;
    untrack(() => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(
        async () => {
          const mio = ++turno;
          try {
            const x = await esquemaAutomatico(t, { subckt: s });
            if (mio !== turno) return;
            r = x;
            estado = x ? 'ok' : 'vacio';
          } catch (e) {
            if (mio !== turno) return;
            estado = 'error';
            mensaje = e instanceof Error ? e.message : String(e);
          }
        },
        r ? 250 : 0,
      );
    });
    return () => {
      if (espera) clearTimeout(espera);
    };
  });

  // ---------------------------------------------------------------- view box (pan and zoom)
  let lienzo: HTMLDivElement | undefined = $state();
  let anchoLienzo = $state(0);
  let vb = $state<[number, number, number, number]>([0, 0, 1, 1]);
  const vista = $derived(r?.vista ?? ([0, 0, 1, 1] as [number, number, number, number]));
  const alto = $derived(anchoLienzo > 0 ? Math.max(150, Math.min((anchoLienzo * vista[3]) / vista[2], typeof innerHeight !== 'undefined' ? innerHeight * 0.62 : 600)) : 200);
  const ampliado = $derived(vb[2] < vista[2] * 0.98 || vb[3] < vista[3] * 0.98);

  function ajustar() {
    vb = [...vista];
  }
  $effect(() => {
    void vista;
    untrack(ajustar);
  });

  /** Zoom by `f` (> 1 enlarges) around a point given as a fraction of the canvas. */
  function zoom(f: number, fx = 0.5, fy = 0.5) {
    const [x, y, w, h] = vb;
    const nw = Math.min(vista[2] * 1.2, Math.max(vista[2] / 12, w / f));
    const nh = (nw * h) / w;
    vb = limitar([x + (w - nw) * fx, y + (h - nh) * fy, nw, nh]);
  }

  function limitar(v: [number, number, number, number]): [number, number, number, number] {
    const [x, y, w, h] = v;
    const mx = Math.max(0, vista[2] - w);
    const my = Math.max(0, vista[3] - h);
    const cx = w >= vista[2] ? (vista[2] - w) / 2 : Math.min(mx, Math.max(0, x));
    const cy = h >= vista[3] ? (vista[3] - h) / 2 : Math.min(my, Math.max(0, y));
    return [cx, cy, w, h];
  }

  /** SVG units per CSS pixel (preserveAspectRatio meet). */
  function escala(): number {
    const el = lienzo;
    if (!el) return 1;
    return Math.max(vb[2] / el.clientWidth, vb[3] / el.clientHeight);
  }

  function fraccion(ev: { clientX: number; clientY: number }): [number, number] {
    const b = lienzo!.getBoundingClientRect();
    return [(ev.clientX - b.left) / b.width, (ev.clientY - b.top) / b.height];
  }

  function rueda(ev: WheelEvent) {
    if (!ev.ctrlKey && !ev.metaKey && !ampliado) return;
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) {
      const [fx, fy] = fraccion(ev);
      zoom(Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0025)), fx, fy);
    } else {
      const k = escala();
      vb = limitar([vb[0] + ev.deltaX * k, vb[1] + ev.deltaY * k, vb[2], vb[3]]);
    }
  }

  // Pointers: drag pans (when zoomed or with a mouse), two fingers pinch; a short tap is a click.
  const punteros = new Map<number, { x: number; y: number }>();
  let inicio: { x: number; y: number; movido: boolean } | null = null;
  let pellizco: { d: number } | null = null;

  function abajo(ev: PointerEvent) {
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (punteros.size === 1) inicio = { x: ev.clientX, y: ev.clientY, movido: false };
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      pellizco = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
      inicio = null;
    }
    if (ev.pointerType === 'mouse' || ampliado || punteros.size === 2) lienzo?.setPointerCapture(ev.pointerId);
  }

  function mover(ev: PointerEvent) {
    const p = punteros.get(ev.pointerId);
    if (!p) return;
    const dx = ev.clientX - p.x;
    const dy = ev.clientY - p.y;
    p.x = ev.clientX;
    p.y = ev.clientY;
    if (punteros.size === 2 && pellizco) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const [fx, fy] = fraccion({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 });
      if (pellizco.d > 0) zoom(d / pellizco.d, fx, fy);
      pellizco.d = d;
      return;
    }
    if (inicio && Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > 6) inicio.movido = true;
    if (inicio?.movido && (ampliado || ev.pointerType === 'mouse')) {
      const k = escala();
      vb = limitar([vb[0] - dx * k, vb[1] - dy * k, vb[2], vb[3]]);
    }
  }

  function arriba(ev: PointerEvent) {
    const fue = inicio;
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pellizco = null;
    if (fue && !fue.movido && punteros.size === 0) tocar(ev);
    if (!punteros.size) inicio = null;
  }

  // Safari's trackpad pinch.
  $effect(() => {
    const el = lienzo;
    if (!el) return;
    let base = 1;
    const ini = (e: Event) => {
      e.preventDefault();
      base = 1;
    };
    const cambio = (e: Event) => {
      e.preventDefault();
      const s = (e as unknown as { scale: number }).scale;
      if (s > 0) zoom(s / base);
      base = s;
    };
    el.addEventListener('gesturestart', ini);
    el.addEventListener('gesturechange', cambio);
    return () => {
      el.removeEventListener('gesturestart', ini);
      el.removeEventListener('gesturechange', cambio);
    };
  });

  function teclado(ev: KeyboardEvent) {
    if (ev.key === '+' || ev.key === '=') zoom(1.4);
    else if (ev.key === '-') zoom(1 / 1.4);
    else if (ev.key === '0') ajustar();
    else if (ev.key === 'Escape') elegir(null);
    else return;
    ev.preventDefault();
  }

  // ---------------------------------------------------------------- clicks on parts
  function tocar(ev: PointerEvent) {
    // The pointer may be captured by the canvas: look at what is under it.
    const g = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('[data-disp]');
    elegir(g?.getAttribute('data-disp') ?? null, g?.getAttribute('data-el') ?? null);
  }

  function elegir(nombre: string | null, el: string | null = null) {
    seleccion = el;
    if (!nombre) return;
    alElegir?.(nombre);
    window.dispatchEvent(new CustomEvent('epa:elegir-componente', { detail: { nombre } }));
  }

  // The SVG markup is inserted once per result; the view box and the highlight are applied to the element.
  let svgEl: SVGSVGElement | null = null;
  let contenedor: HTMLDivElement | undefined = $state();
  $effect(() => {
    const c = contenedor;
    const x = r;
    if (!c || !x) return;
    c.innerHTML = x.svgTema;
    svgEl = c.querySelector('svg');
    if (svgEl) {
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svgEl.setAttribute('role', 'img');
      svgEl.setAttribute('aria-label', subckt ? `Esquema del subcircuito ${subckt}` : 'Esquema del circuito');
    }
    untrack(() => (seleccion = null));
  });
  $effect(() => {
    const v = vb;
    if (r && svgEl) svgEl.setAttribute('viewBox', v.join(' '));
  });
  $effect(() => {
    const s = seleccion;
    if (!r || !contenedor) return;
    for (const g of contenedor.querySelectorAll('.ea-sel')) g.classList.remove('ea-sel');
    if (s) contenedor.querySelector(`[data-el="${s}"]`)?.classList.add('ea-sel');
  });

  const nombreSel = $derived.by(() => {
    if (!seleccion || !r) return '';
    const e = r.esquema.elementos.find((x) => x.id === seleccion);
    return e?.designador ?? '';
  });
</script>

{#if interior}
  <EsquemaAuto {texto} subckt={interior} titulo={`Subcircuito ${interior}`} {alElegir} alVolver={() => (interior = null)} />
{:else}
  <section class="esquema-auto-vista" aria-label={titulo}>
    <div class="cab">
      {#if alVolver}
        <button class="boton volver" onclick={alVolver}><Icono nombre="atras" tam={16} /> Volver al circuito</button>
      {/if}
      <h3>{titulo}</h3>
      <span class="origen">Dibujado automáticamente a partir de la netlist</span>
    </div>
    {#if estado === 'cargando'}
      <p class="nota">Dibujando el circuito…</p>
    {:else if estado === 'error'}
      <p class="nota">No se ha podido dibujar el circuito: {mensaje}</p>
    {:else if estado === 'vacio'}
      <p class="nota">La netlist no tiene componentes que dibujar.</p>
    {/if}
    {#if r}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="lienzo"
        class:ampliado
        bind:this={lienzo}
        bind:clientWidth={anchoLienzo}
        style:height={`${alto}px`}
        tabindex="0"
        role="group"
        aria-label="Esquema: + y − amplían, 0 ajusta; pulse un componente para elegir su control"
        onwheel={rueda}
        onpointerdown={abajo}
        onpointermove={mover}
        onpointerup={arriba}
        onpointercancel={(ev) => {
          punteros.delete(ev.pointerId);
          inicio = null;
          pellizco = null;
        }}
        onkeydown={teclado}
      >
        <div class="svg" bind:this={contenedor}></div>
      </div>
      <div class="mandos">
        <button class="boton-icono" onclick={() => zoom(1.4)} aria-label="Ampliar" title="Ampliar (+)"><Icono nombre="zoom-mas" tam={20} /></button>
        <button class="boton-icono" onclick={() => zoom(1 / 1.4)} aria-label="Reducir" title="Reducir (−)"><Icono nombre="zoom-menos" tam={20} /></button>
        <button class="boton-icono" onclick={ajustar} disabled={!ampliado} aria-label="Ajustar a la vista" title="Ajustar (0)"><Icono nombre="ampliar" tam={18} /></button>
        <span class="ayuda">
          {#if nombreSel}Elegido: <strong>{nombreSel}</strong>{:else}Pulse un componente para ir a su control.{/if}
        </span>
      </div>
      {#if r.ignoradas.length}
        <p class="nota">
          Sin dibujar: {r.ignoradas.slice(0, 4).map((i) => `línea ${i.linea + 1} (${i.motivo})`).join(', ')}{r.ignoradas.length > 4 ? '…' : ''}.
        </p>
      {/if}
      {#if !subckt && r.subckts.length}
        <div class="interiores">
          <span>Subcircuitos (se dibujan como cajas):</span>
          {#each r.subckts as s (s.nombre)}
            <button class="boton" onclick={() => (interior = s.nombre)}>Ver el interior de {s.nombre}</button>
          {/each}
        </div>
      {/if}
    {/if}
  </section>
{/if}

<style>
  .esquema-auto-vista {
    margin: 0 0 18px;
    font-family: var(--sans);
  }
  .cab {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    margin-bottom: 6px;
  }
  h3 {
    margin: 0;
    font-size: 15px;
    color: var(--titulos);
  }
  .origen,
  .nota,
  .ayuda {
    color: var(--tinta-tenue);
    font-size: 12.5px;
  }
  .nota {
    margin: 6px 0;
  }
  .volver {
    min-height: 44px;
  }
  .lienzo {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--linea-suave);
    border-radius: 10px;
    background: var(--superficie);
    touch-action: pan-x pan-y;
    cursor: default;
    outline-offset: 2px;
  }
  .lienzo.ampliado {
    touch-action: none;
    cursor: grab;
  }
  .svg,
  .svg :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .svg :global(.ea-u[data-disp]) {
    cursor: pointer;
  }
  .svg :global(.ea-u[data-disp]:hover .ea-l) {
    stroke: var(--acento);
  }
  .mandos {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }
  .mandos .boton-icono {
    width: 44px;
    height: 44px;
  }
  .mandos .boton-icono:disabled {
    opacity: 0.4;
  }
  .ayuda {
    margin-left: 6px;
  }
  .interiores {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    margin-top: 6px;
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .interiores .boton {
    min-height: 44px;
  }
</style>
