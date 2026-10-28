<script lang="ts" module>
  import type { Esquema, Punto } from '../../figuras-vivas/tipos';

  /** A circuit drawing: the book's figure with its schematic data, or a schematic drawn by the app. */
  export type Fuente =
    | { tipo: 'figura'; svg: string; vista: [number, number, number, number]; esquema: Esquema; mapa: Record<string, string> }
    | { tipo: 'propio'; esquema: Esquema }
    /** Drawn by the automatic schematic generator (SVG markup in theme colours). */
    | { tipo: 'auto'; svg: string; vista: [number, number, number, number]; esquema: Esquema; mapa: Record<string, string> };

  import { COLOR_PUNTA, LETRA_PUNTA } from '../puntas';
  export { COLOR_PUNTA, LETRA_PUNTA };
</script>

<script lang="ts">
  // The circuit on the bench, drawn, with its nodes as tap targets: tapping a node places the selected lead
  // or probe there. Over a book figure the node positions come from the figure's data (ESQUEMA.md); for
  // circuits without a figure the app draws the schematic itself from the same format.
  import { onMount } from 'svelte';
  import { caja } from './dibujoPropio';
  import { url } from '../../../lib/datos';

  let {
    fuente,
    puntas,
    activa,
    alTocar,
  }: {
    fuente: Fuente;
    puntas: { p: string; nodo: string }[];
    activa: string | null;
    alTocar: (nodo: string) => void;
  } = $props();

  // Drawing units → SVG units.
  const af = $derived(fuente.tipo === 'propio' ? { sx: 1, tx: 0, sy: -1, ty: 0 } : fuente.esquema.dibujo_a_svg);
  const vista = $derived(fuente.tipo === 'propio' ? caja(fuente.esquema) : fuente.vista);
  const aSvg = (p: Punto): [number, number] => [af.sx * p[0] + af.tx, af.sy * p[1] + af.ty];

  /** Net node of a schematic node. */
  function red(id: string): string | null {
    if (fuente.tipo !== 'propio') {
      const n = fuente.esquema.nodos.find((x) => x.id === id);
      if (n?.tierra) return '0';
      return fuente.mapa[id] ?? null;
    }
    return id;
  }

  /** One marker per node: the point nearest the centre of its points. */
  const marcas = $derived.by(() => {
    const e = fuente.esquema;
    const res: { nodo: string; xy: [number, number] }[] = [];
    const vistos = new Set<string>();
    for (const n of e.nodos) {
      const r = red(n.id);
      if (!r || vistos.has(r)) continue;
      const pts = n.puntos.map((id) => e.puntos.find((p) => p.id === id)?.xy).filter((p): p is Punto => !!p);
      if (!pts.length) continue;
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      let mejor = pts[0]!;
      for (const p of pts) if (Math.hypot(p[0] - cx, p[1] - cy) < Math.hypot(mejor[0] - cx, mejor[1] - cy)) mejor = p;
      vistos.add(r);
      res.push({ nodo: r, xy: aSvg(mejor) });
    }
    return res;
  });

  // Rendered scale (px per SVG unit) for touch-sized targets.
  let contenedor: HTMLDivElement | undefined = $state();
  let k = $state(1);
  let lienzo: SVGSVGElement | undefined = $state();
  onMount(() => {
    if (!contenedor) return;
    const medir = () => (k = (lienzo?.getBoundingClientRect().width || contenedor?.clientWidth || vista[2]) / vista[2]);
    const ro = new ResizeObserver(medir);
    ro.observe(contenedor);
    medir();
    return () => ro.disconnect();
  });
  const radio = $derived(12 / Math.max(k, 0.05));
  const fuenteTxt = $derived(11 / Math.max(k, 0.05));

  // ---------------------------------------------------------------- own symbols (drawing units)
  function simbolo(rol: string, L: number): { d: string; relleno?: string } {
    const m = L / 2;
    switch (rol) {
      case 'R':
      case 'POT':
        return { d: `M0 0H${m - 0.55}M${m + 0.55} 0H${L}M${m - 0.55} -0.22H${m + 0.55}V0.22H${m - 0.55}Z` };
      case 'C':
        return { d: `M0 0H${m - 0.12}M${m + 0.12} 0H${L}M${m - 0.12} -0.4V0.4M${m + 0.12} -0.4V0.4` };
      case 'L': {
        let d = `M0 0H${m - 0.8}`;
        for (let i = 0; i < 4; i++) d += `a0.2 0.2 0 0 1 0.4 0`;
        return { d: d + `M${m + 0.8} 0H${L}` };
      }
      case 'D':
      case 'LED':
      case 'DZ':
        return {
          d: `M0 0H${m - 0.3}M${m + 0.3} 0H${L}M${m - 0.3} -0.3L${m + 0.3} 0L${m - 0.3} 0.3ZM${m + 0.3} -0.3V0.3` +
            (rol === 'LED' ? `M${m} -0.45l0.25 -0.35m-0.1 0.02 0.1 -0.02 0 0.1M${m + 0.25} -0.4l0.25 -0.35` : ''),
        };
      case 'V':
      case 'VSIN':
      case 'VPULSE':
      case 'V?':
      case 'BAT': {
        let d = `M0 0H${m - 0.5}M${m + 0.5} 0H${L}M${m - 0.5} 0a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0`;
        if (rol === 'VSIN') d += `M${m - 0.3} 0q0.15 -0.35 0.3 0t0.3 0`;
        else if (rol === 'VPULSE') d += `M${m - 0.3} 0.15h0.15v-0.3h0.3v0.3h0.15`;
        else d += `M${m - 0.35} -0.2h0.18M${m - 0.26} -0.29v0.18M${m + 0.18} -0.2h0.18`;
        return { d };
      }
      default:
        return { d: `M0 0H${m - 0.4}M${m + 0.4} 0H${L}M${m - 0.4} -0.3h0.8v0.6h-0.8z` };
    }
  }
</script>

<div class="plano" bind:this={contenedor}>
  <div class="lamina" style={fuente.tipo === 'auto' ? `max-width:${Math.round(fuente.vista[2] * 1.3)}px` : undefined}>
  {#if fuente.tipo === 'figura'}
    <img src={url(fuente.svg)} alt="Esquema del montaje" draggable="false" />
  {:else if fuente.tipo === 'auto'}
    <div class="auto">{@html fuente.svg}</div>
  {/if}
  <svg
    bind:this={lienzo}
    class:encima={fuente.tipo !== 'propio'}
    class:placa={fuente.tipo === 'figura'}
    viewBox={vista.join(' ')}
    style={fuente.tipo === 'propio' ? `max-width:${Math.round(vista[2] * 46)}px` : undefined}
    role="group"
    aria-label="Nodos del circuito"
  >
    {#if fuente.tipo === 'propio'}
      <g class="dibujo" fill="none" stroke="currentColor" stroke-width="0.07" stroke-linecap="round" stroke-linejoin="round" style={`stroke-width:${1.8 / Math.max(k, 0.05)}px`}>
        {#each fuente.esquema.tramos as t (t.id)}
          <polyline points={t.puntos.map((p) => aSvg(p).join(',')).join(' ')} />
        {/each}
        {#each fuente.esquema.elementos as el (el.id)}
          {#if el.rol === 'GND'}
            {@const [x, y] = aSvg(el.anclas.start!)}
            <path d={`M${x} ${y}v0.35M${x - 0.4} ${y + 0.35}h0.8M${x - 0.25} ${y + 0.5}h0.5M${x - 0.1} ${y + 0.65}h0.2`} />
          {:else if el.anclas.start && el.anclas.end}
            {@const [x1, y1] = aSvg(el.anclas.start)}
            {@const [x2, y2] = aSvg(el.anclas.end)}
            {@const L = Math.hypot(x2 - x1, y2 - y1)}
            {@const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI}
            {@const s = simbolo(el.rol, L)}
            <g transform={`translate(${x1} ${y1}) rotate(${ang})`}><path d={s.d} /></g>
            {#if el.etiquetas_html?.[0]}
              {@const vertical = Math.abs(Math.sin((ang * Math.PI) / 180)) > 0.7}
              <text
                class="etiqueta"
                x={(x1 + x2) / 2 + (vertical ? 0.75 : 0)}
                y={(y1 + y2) / 2 + (vertical ? 0.12 : -0.65)}
                text-anchor={vertical ? 'start' : 'middle'}
                font-size={13 / Math.max(k, 0.05)}>{el.etiquetas_html[0]}</text
              >
            {/if}
          {/if}
        {/each}
      </g>
    {/if}
    {#each marcas as mk (mk.nodo)}
      {@const aqui = puntas.filter((p) => p.nodo.toLowerCase() === mk.nodo.toLowerCase())}
      <g
        class="nodo"
        class:conectado={aqui.length > 0}
        role="button"
        tabindex="0"
        aria-label={`Nodo ${mk.nodo === '0' ? 'masa (0)' : mk.nodo}${aqui.length ? ', con ' + aqui.length + ' puntas' : ''}`}
        onclick={() => alTocar(mk.nodo)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), alTocar(mk.nodo))}
      >
        <circle cx={mk.xy[0]} cy={mk.xy[1]} r={radio * 1.5} fill="transparent" />
        <circle class="anillo" cx={mk.xy[0]} cy={mk.xy[1]} r={radio * 0.55} />
        <text class="nombre" x={mk.xy[0] + radio * 0.75} y={mk.xy[1] - radio * 0.6} font-size={fuenteTxt}>{mk.nodo === '0' ? '0' : mk.nodo}</text>
        {#each aqui as pt, i (pt.p)}
          {@const a = -Math.PI / 2 + (i - (aqui.length - 1) / 2) * 0.75}
          {@const px = mk.xy[0] + Math.cos(a) * radio * 1.45}
          {@const py = mk.xy[1] + Math.sin(a) * radio * 1.45 + radio * 2.2}
          <line x1={mk.xy[0]} y1={mk.xy[1]} x2={px} y2={py} stroke={COLOR_PUNTA[pt.p]} stroke-width={radio * 0.18} />
          <circle cx={px} cy={py} r={radio * 0.62} fill={COLOR_PUNTA[pt.p]} stroke="#fff" stroke-width={radio * 0.08} />
          <text x={px} y={py + radio * 0.26} font-size={radio * 0.75} text-anchor="middle" fill="#fff" font-weight="700">{LETRA_PUNTA[pt.p]}</text>
        {/each}
      </g>
    {/each}
  </svg>
  </div>
  {#if activa}
    <div class="ayuda" style={`--c:${COLOR_PUNTA[activa]}`}>Toque un nodo para poner la punta</div>
  {/if}
</div>

<style>
  .plano {
    position: relative;
    width: 100%;
    color: var(--tinta);
  }
  img {
    display: block;
    width: 100%;
    height: auto;
    background: var(--placa);
    filter: var(--placa-filtro);
    border-radius: 8px;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    margin: 0 auto;
  }
  svg.encima {
    position: absolute;
    inset: 0;
    height: 100%;
    max-height: none;
  }
  .lamina {
    position: relative;
    margin: 0 auto;
  }
  .auto :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }

  .etiqueta {
    fill: currentColor;
    stroke: none;
    font-family: var(--sans);
  }
  .nodo {
    cursor: pointer;
    outline: none;
  }
  .anillo {
    fill: var(--acento-tinte);
    stroke: var(--acento);
    stroke-width: 0.6;
    vector-effect: non-scaling-stroke;
    opacity: 0.85;
  }
  .nodo:hover .anillo,
  .nodo:focus-visible .anillo {
    fill: var(--acento);
  }
  .nombre {
    fill: var(--acento);
    font-family: var(--mono);
    font-weight: 700;
    paint-order: stroke;
    stroke: var(--superficie);
    stroke-width: 3px;
    vector-effect: non-scaling-stroke;
  }
  svg.placa .nombre {
    stroke: #fff;
    fill: #1f5f99;
  }
  svg.placa .anillo {
    fill: rgba(255, 255, 255, 0.55);
    stroke: #2e6ea6;
  }
  .ayuda {
    margin-top: 6px;
    padding: 4px 10px;
    border-left: 4px solid var(--c);
    color: var(--tinta-suave);
    font-family: var(--sans);
    font-size: 13px;
  }
</style>
