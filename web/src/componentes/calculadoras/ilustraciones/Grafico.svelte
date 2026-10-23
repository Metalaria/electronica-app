<script lang="ts" module>
  let siguiente = 0;
</script>

<script lang="ts">
  // Draws a scene of graficos.ts: a small SVG plot (linear or logarithmic axes with SI prefixes and decimal
  // comma) or a diagram, with the result in the accent colour. Cheap enough to redraw on every slider step.
  import type { Escena, EjeG, ItemG } from './graficos';
  import { svgTexto } from './huecos';
  import { formatoValor, MENOS } from '../unidades';

  let { escena, miniatura = false }: { escena: Escena; miniatura?: boolean } = $props();

  const uid = `g${++siguiente}`;
  const W = 320;
  const H = 188;

  const m = $derived({
    l: miniatura || escena.y.oculto ? 10 : 46,
    r: 12,
    t: 14,
    b: miniatura || (escena.x.oculto && !escena.x.categorias?.length) ? 10 : 30,
  });

  /** Axis ranges, widened to equal scales for vector diagrams. */
  const ejes = $derived.by(() => {
    const x = { ...escena.x };
    const y = { ...escena.y };
    if (escena.cuadrado) {
      const pw = W - m.l - m.r;
      const ph = H - m.t - m.b;
      const kx = (x.max - x.min) / pw;
      const ky = (y.max - y.min) / ph;
      const k = Math.max(kx, ky);
      const cx = (x.min + x.max) / 2;
      const cy = (y.min + y.max) / 2;
      x.min = cx - (k * pw) / 2;
      x.max = cx + (k * pw) / 2;
      y.min = cy - (k * ph) / 2;
      y.max = cy + (k * ph) / 2;
    }
    return { x, y };
  });

  const T = (e: EjeG, v: number): number => (e.log ? Math.log10(v) : v);
  function sx(v: number): number {
    const e = ejes.x;
    return m.l + ((T(e, v) - T(e, e.min)) / (T(e, e.max) - T(e, e.min))) * (W - m.l - m.r);
  }
  function sy(v: number): number {
    const e = ejes.y;
    return H - m.b - ((T(e, v) - T(e, e.min)) / (T(e, e.max) - T(e, e.min))) * (H - m.t - m.b);
  }
  const ok = (e: EjeG, v: number): boolean => Number.isFinite(v) && (!e.log || v > 0);

  function marcas(e: EjeG): number[] {
    if (e.oculto || e.categorias) return [];
    if (e.log) {
      const a = Math.ceil(Math.log10(e.min) - 1e-9);
      const b = Math.floor(Math.log10(e.max) + 1e-9);
      const n = b - a + 1;
      const paso = n > 5 ? 2 : 1;
      const out: number[] = [];
      for (let k = a; k <= b; k += paso) out.push(10 ** k);
      if (out.length < 2) for (const k of [2, 5]) for (let d = a - 1; d <= b; d++) if (k * 10 ** d >= e.min && k * 10 ** d <= e.max) out.push(k * 10 ** d);
      return out.sort((p, q) => p - q);
    }
    const span = e.max - e.min;
    if (!(span > 0)) return [];
    const bruto = span / 4;
    const p10 = 10 ** Math.floor(Math.log10(bruto));
    const paso = ([1, 2, 2.5, 5, 10].map((k) => k * p10).find((s) => s >= bruto) ?? 10 * p10) as number;
    const out: number[] = [];
    for (let v = Math.ceil(e.min / paso) * paso; v <= e.max + paso * 1e-6; v += paso) out.push(Math.abs(v) < paso * 1e-9 ? 0 : v);
    return out;
  }

  const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  /** Tick label: enough digits to tell neighbours apart; bare powers of ten when a unit has no prefixes. */
  function etiqueta(v: number, u: string, e: EjeG, ticks: number[]): string {
    if (e.log) {
      const t = formatoValor(v, u, 3, true);
      if (t.length <= 9) return t.replace(/^-/, MENOS);
      const k = Math.round(Math.log10(v));
      return `10${String(k).replace(/[-0-9]/g, (c) => SUP[c] ?? c)}`;
    }
    const paso = ticks.length > 1 ? Math.abs((ticks[1] as number) - (ticks[0] as number)) : Math.abs(v) || 1;
    const max = Math.max(...ticks.map(Math.abs), paso);
    const cifras = Math.min(6, Math.max(2, Math.ceil(Math.log10(max / paso) + 1e-9) + 1));
    return formatoValor(v, u, cifras, true).replace(/^-/, MENOS);
  }
  const marcasX = $derived(marcas(ejes.x));
  const marcasY = $derived(marcas(ejes.y));
  /** Keeps a text inside the plot: flips its anchor near the edges (approximate width from its length). */
  function ancla(x: number, a: 'l' | 'r' | 'c', html: string): { x: number; a: 'l' | 'r' | 'c' } {
    const w = html.replace(/<[^>]+>/g, '').length * 5.6;
    if (a === 'l' && x + 6 + w > der) return { x: x - 6, a: 'r' };
    if (a === 'r' && x - 6 - w < izq) return { x: x + 6, a: 'l' };
    if (a === 'c') return { x: Math.min(der - w / 2, Math.max(izq + w / 2, x)), a };
    return { x: x + (a === 'l' ? 6 : -6), a };
  }

  function puntos(xs: number[], ys: number[]): string[] {
    const tramos: string[] = [];
    let cur: string[] = [];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i] as number;
      const y = ys[i] as number;
      if (ok(ejes.x, x) && ok(ejes.y, y)) cur.push(`${sx(x).toFixed(1)},${sy(y).toFixed(1)}`);
      else if (cur.length) {
        tramos.push(cur.join(' '));
        cur = [];
      }
    }
    if (cur.length) tramos.push(cur.join(' '));
    return tramos;
  }

  const anclaSvg = (a: string) => (a === 'l' ? 'start' : a === 'r' ? 'end' : 'middle');
  const izq = $derived(m.l);
  const der = $derived(W - m.r);
  const arriba = $derived(m.t);
  const abajo = $derived(H - m.b);
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const items = $derived(escena.items as ItemG[]);
</script>

<figure class="grafico-calc" class:miniatura>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Gráfica de la fórmula con el resultado marcado">
    <defs>
      <clipPath id="{uid}-clip"><rect x={izq} y={arriba - 2} width={der - izq} height={abajo - arriba + 4} /></clipPath>
      <marker id="{uid}-f" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L8 4L0 8Z" class="punta" />
      </marker>
    </defs>
    {#if !miniatura}
      {#each marcasX as v (v)}
        <line x1={sx(v)} x2={sx(v)} y1={arriba} y2={abajo} class="rejilla" />
        <!-- the last labels leave room for the axis title -->
        {#if sx(v) < der - 26 || !ejes.x.titulo}
          <text x={sx(v)} y={abajo + 13} text-anchor="middle" class="tick">{etiqueta(v, ejes.x.unidad, ejes.x, marcasX)}</text>
        {/if}
      {/each}
      {#each marcasY as v (v)}
        <line x1={izq} x2={der} y1={sy(v)} y2={sy(v)} class="rejilla" />
        <text x={izq - 4} y={sy(v) + 3.5} text-anchor="end" class="tick">{etiqueta(v, ejes.y.unidad, ejes.y, marcasY)}</text>
      {/each}
      {#if ejes.x.categorias}
        {#each ejes.x.categorias as c, i (i)}
          <text x={sx(i)} y={abajo + 15} text-anchor="middle" class="cat">{@html svgTexto(c)}</text>
        {/each}
      {/if}
      {#if !ejes.y.oculto}
        <line x1={izq} x2={izq} y1={arriba} y2={abajo} class="eje" />
        {#if ejes.y.titulo}<text x={izq + 4} y={arriba + 2} class="titulo-eje">{@html svgTexto(ejes.y.titulo)}</text>{/if}
      {/if}
      {#if !ejes.x.oculto}
        <line x1={izq} x2={der} y1={abajo} y2={abajo} class="eje" />
        {#if ejes.x.titulo}<text x={der} y={abajo + 15} text-anchor="end" class="titulo-eje x">{@html svgTexto(ejes.x.titulo)}</text>{/if}
      {/if}
    {/if}
    <g clip-path="url(#{uid}-clip)">
      {#each items as it, i (i)}
        {#if it.k === 'franja' && ok(ejes.x, it.x1) && ok(ejes.x, it.x2)}
          <rect x={Math.min(sx(it.x1), sx(it.x2))} y={arriba} width={Math.abs(sx(it.x2) - sx(it.x1))} height={abajo - arriba} class="f-{it.cls}" />
        {:else if it.k === 'area'}
          {#each puntos(it.x, it.y) as pts, j (j)}<polygon points={pts} class="a-{it.cls}" />{/each}
        {:else if it.k === 'linea'}
          {#each puntos(it.x, it.y) as pts, j (j)}<polyline points={pts} class="l-{it.cls}" />{/each}
        {:else if it.k === 'barra'}
          <rect x={sx(it.x - 0.32)} y={Math.min(sy(it.y0), sy(it.y1))} width={sx(it.x + 0.32) - sx(it.x - 0.32)} height={Math.max(1, Math.abs(sy(it.y1) - sy(it.y0)))} rx="2" class="b-{it.cls}" />
        {:else if it.k === 'vguia' && ok(ejes.x, it.x)}
          <line x1={sx(it.x)} x2={sx(it.x)} y1={arriba} y2={abajo} class="l-{it.cls}" />
        {:else if it.k === 'hguia' && ok(ejes.y, it.y)}
          <line x1={izq} x2={der} y1={sy(it.y)} y2={sy(it.y)} class="l-{it.cls}" />
        {:else if it.k === 'flecha' && ok(ejes.x, it.x1) && ok(ejes.x, it.x2) && ok(ejes.y, it.y1) && ok(ejes.y, it.y2)}
          <line x1={sx(it.x1)} y1={sy(it.y1)} x2={sx(it.x2)} y2={sy(it.y2)} class="fl-{it.cls}" marker-end="url(#{uid}-f)" marker-start={it.doble ? `url(#${uid}-f)` : undefined} />
        {:else if it.k === 'punto' && ok(ejes.x, it.x) && ok(ejes.y, it.y)}
          <circle cx={sx(it.x)} cy={sy(it.y)} r={it.cls === 'res' ? 4.5 : 3.2} class="p-{it.cls}" />
        {/if}
      {/each}
    </g>
    {#if !miniatura}
      {#each items as it, i (i)}
        {#if it.k === 'texto' && ok(ejes.x, it.x) && ok(ejes.y, it.y)}
          {@const a = ancla(sx(it.x), it.ancla, it.html)}
          <text x={a.x} y={clamp(sy(it.y) + (it.dy ?? 0), arriba + 9, abajo - 3)}
            text-anchor={anclaSvg(a.a)} class="t-{it.cls} texto">{@html svgTexto(it.html)}</text>
        {:else if it.k === 'vguia' && it.html && ok(ejes.x, it.x)}
          {@const x = sx(it.x)}
          <text x={x > der - 70 ? x - 4 : x + 4} y={it.abajo ? abajo - 5 : arriba + 10} text-anchor={x > der - 70 ? 'end' : 'start'} class="t-{it.cls} texto">{@html svgTexto(it.html)}</text>
        {:else if it.k === 'hguia' && it.html && ok(ejes.y, it.y)}
          <text x={it.lado === 'l' ? izq + 4 : der - 4} y={sy(it.y) - 4} text-anchor={it.lado === 'l' ? 'start' : 'end'} class="t-{it.cls} texto">{@html svgTexto(it.html)}</text>
        {/if}
      {/each}
    {/if}
  </svg>
  {#if escena.pie && !miniatura}<figcaption>{@html escena.pie}</figcaption>{/if}
</figure>

<style>
  .grafico-calc {
    margin: 0;
    font-family: var(--sans);
    --g-1: #2a78d6;
    --g-2: #eb6834;
    --g-3: #1baf7a;
    --g-4: #eda100;
  }
  :global(:root[data-tema='oscuro']) .grafico-calc {
    --g-1: #3987e5;
    --g-2: #d95926;
    --g-3: #199e70;
    --g-4: #c98500;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .rejilla {
    stroke: var(--linea-suave);
    stroke-width: 1;
  }
  .eje {
    stroke: var(--tinta-tenue);
    stroke-width: 1;
  }
  .tick {
    fill: var(--tinta-tenue);
    font-size: 9.5px;
    font-variant-numeric: tabular-nums;
  }
  .cat {
    fill: var(--tinta-suave);
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
  }
  .titulo-eje {
    fill: var(--tinta-suave);
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    dominant-baseline: hanging;
  }
  .titulo-eje.x {
    dominant-baseline: auto;
  }
  polyline,
  line {
    fill: none;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .l-curva {
    stroke: var(--g-1);
    stroke-width: 2.2;
  }
  .l-curva2 {
    stroke: var(--g-2);
    stroke-width: 2;
  }
  .l-guia {
    stroke: var(--tinta-tenue);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  .l-guia2 {
    stroke: var(--g-2);
    stroke-width: 1.4;
    stroke-dasharray: 5 3;
  }
  .l-res {
    stroke: var(--acento);
    stroke-width: 1.6;
    stroke-dasharray: 5 3;
  }
  .l-res-grueso {
    stroke: var(--acento);
    stroke-width: 3.2;
  }
  .l-total {
    stroke: var(--tinta);
    stroke-width: 2.6;
  }
  .l-seg-a {
    stroke: var(--g-1);
    stroke-width: 3;
  }
  .l-seg-b {
    stroke: var(--g-2);
    stroke-width: 3;
  }
  .l-seg-c {
    stroke: var(--g-3);
    stroke-width: 3;
  }
  .l-seg-d {
    stroke: var(--g-4);
    stroke-width: 3;
  }
  .l-marca,
  .l-tenue {
    stroke: var(--tinta-tenue);
    stroke-width: 1;
  }
  .a-banda,
  .f-banda {
    fill: color-mix(in srgb, var(--g-1) 12%, transparent);
    stroke: none;
  }
  .f-res,
  .a-res {
    fill: color-mix(in srgb, var(--acento) 16%, transparent);
    stroke: none;
  }
  .b-seg-a {
    fill: var(--g-1);
  }
  .b-seg-b {
    fill: var(--g-2);
  }
  .b-seg-c {
    fill: var(--g-3);
  }
  .b-seg-d {
    fill: var(--g-4);
  }
  .b-total {
    fill: var(--tinta-suave);
  }
  .b-res {
    fill: var(--acento);
  }
  .fl-tenue,
  .fl-marca,
  .fl-guia {
    stroke: var(--tinta-suave);
    stroke-width: 1.2;
  }
  .fl-res {
    stroke: var(--acento);
    stroke-width: 1.8;
  }
  .fl-curva {
    stroke: var(--g-1);
    stroke-width: 2.4;
  }
  .fl-curva2 {
    stroke: var(--g-2);
    stroke-width: 2.4;
  }
  .fl-guia2 {
    stroke: var(--g-2);
    stroke-width: 1.6;
    stroke-dasharray: 4 3;
  }
  .punta {
    fill: var(--tinta-suave);
  }
  .p-res {
    fill: var(--acento);
    stroke: var(--superficie);
    stroke-width: 2;
  }
  .p-marca {
    fill: var(--superficie);
    stroke: var(--tinta-suave);
    stroke-width: 1.6;
  }
  .texto {
    font-size: 10.5px;
    paint-order: stroke;
    stroke: var(--superficie);
    stroke-width: 3px;
    stroke-linejoin: round;
    font-variant-numeric: tabular-nums;
  }
  .t-res {
    fill: var(--acento);
    font-weight: 700;
  }
  .t-tenue,
  .t-guia {
    fill: var(--tinta-suave);
  }
  .t-marca,
  .t-guia2 {
    fill: var(--tinta);
  }
  .t-total {
    fill: var(--tinta);
    font-weight: 600;
  }
  .t-seg-a {
    fill: var(--g-1);
    font-weight: 600;
  }
  .t-seg-b {
    fill: var(--g-2);
    font-weight: 600;
  }
  .t-seg-c {
    fill: var(--g-3);
    font-weight: 600;
  }
  .t-seg-d {
    fill: var(--g-4);
    font-weight: 600;
  }
  .texto :global(.g-sim) {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
  }
  figcaption {
    margin-top: 4px;
    color: var(--tinta-suave);
    font-size: 13px;
    line-height: 1.4;
  }
  figcaption :global(sub) {
    font-size: 0.75em;
  }
  .miniatura .l-curva {
    stroke-width: 4;
  }
  .miniatura .l-guia,
  .miniatura .l-guia2 {
    stroke-width: 2;
  }
</style>
