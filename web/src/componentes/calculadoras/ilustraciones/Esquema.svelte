<script lang="ts">
  // A formula's circuit drawn from its template, with every quantity labelled where it lives: symbol and
  // live value, the result highlighted, magnitude bars where they mean something. Tapping a quantity (its
  // label or its part) solves for it.
  import type { Entorno } from '../expresion';
  import type { Formula, Huecos } from '../tipos';
  import { ESQUEMAS } from './esquemas';
  import { compilar, U, type Prim } from './geometria';
  import { resolver, svgTexto, anchoEm } from './huecos';
  import { formatoValor, MENOS } from '../unidades';

  let {
    f,
    plantilla,
    huecos,
    valores,
    objetivo = '',
    posibles = [],
    onelegir,
    miniatura = false,
  }: {
    f: Formula | null;
    plantilla: string;
    huecos: Huecos;
    valores: Entorno;
    objetivo?: string;
    posibles?: string[];
    onelegir?: (id: string) => void;
    miniatura?: boolean;
  } = $props();

  const t = $derived(ESQUEMAS[plantilla]);
  // Geometry depends only on the template: computed once per template.
  const prims = $derived(t ? compilar(t) : []);

  interface Etiqueta {
    p: Extract<Prim, { t: 'lab' }>;
    sim: string;
    valor: string;
    mapeado: boolean;
    objetivo: boolean;
    id?: string;
    nombre?: string;
  }

  function sim(rol: string, id?: string): string {
    if (id && f) return f.vars.find((v) => v.id === id)?.sim ?? rol;
    return t?.roles[rol]?.[0] ?? rol;
  }

  const etiquetas = $derived.by((): Etiqueta[] => {
    if (!t) return [];
    const out: Etiqueta[] = [];
    for (const p of prims) {
      if (p.t !== 'lab') continue;
      const h = f && !miniatura ? resolver(f, huecos, p.rol, valores) : { mapeado: false as const };
      if (miniatura || !h.mapeado) {
        if (p.auto) out.push({ p, sim: sim(p.rol), valor: '', mapeado: false, objetivo: false });
        continue;
      }
      const u = h.v?.unidad ?? t.roles[p.rol]?.[1] ?? '';
      const valor = h.texto ?? (h.valor !== undefined && Number.isFinite(h.valor) ? formatoValor(h.valor, u, 4, true).replace(/^-/, MENOS) : '—');
      out.push({
        p,
        sim: sim(p.rol, h.v?.id),
        valor,
        mapeado: true,
        objetivo: !!h.v && h.v.id === objetivo,
        id: h.v && posibles.includes(h.v.id) ? h.v.id : undefined,
        nombre: h.v?.nombre,
      });
    }
    return out;
  });

  /** Var id behind a role (to highlight and tap the part body). */
  function idDe(rol: string | undefined): string | undefined {
    if (!rol || !f || miniatura) return undefined;
    const s = huecos[rol];
    return s && f.vars.some((v) => v.id === s) ? s : undefined;
  }

  const barras = $derived.by(() => {
    const bs = prims.filter((p): p is Extract<Prim, { t: 'hbarra' }> => p.t === 'hbarra');
    if (!bs.length || !f) return [];
    const vals = bs.map((b) => {
      const h = miniatura ? { valor: b.rol === 'Vin' ? 12 : 4 } : resolver(f, huecos, b.rol, valores);
      return Math.abs(h.valor ?? NaN);
    });
    return bs.map((b, i) => {
      const grupo = bs.map((x, j) => (x.grupo === b.grupo ? (vals[j] as number) : 0)).filter(Number.isFinite);
      const max = Math.max(...grupo, 1e-300);
      const v = vals[i] as number;
      const id = idDe(b.rol);
      return { b, frac: Number.isFinite(v) ? Math.min(1, v / max) : 0, sim: sim(b.rol, id), obj: !!id && id === objetivo };
    });
  });

  function elegir(id: string | undefined) {
    if (id) onelegir?.(id);
  }

  function teclas(ev: KeyboardEvent, id: string | undefined) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      elegir(id);
    }
  }

  function x0(e: Etiqueta, w: number): number {
    const x = e.p.x * U;
    return e.p.ancla === 'l' ? x : e.p.ancla === 'r' ? x - w : x - w / 2;
  }
  const anclaSvg = (a: string) => (a === 'l' ? 'start' : a === 'r' ? 'end' : 'middle');
</script>

{#snippet contenido(e: Etiqueta, w: number, h: number, y0: number)}
  {#if e.id || e.objetivo}
    <rect class="zona" x={x0(e, w) - 4} y={y0 - 4} width={w + 8} height={Math.max(h + 8, 32)} rx="6" />
  {/if}
  {#if e.p.una || !e.valor}
    <text x={e.p.x * U} y={e.p.y * U + 4.5} text-anchor={anclaSvg(e.p.ancla)}>
      <tspan class="sim">{@html svgTexto(e.sim)}</tspan>{#if e.valor}<tspan class="igual"> = </tspan><tspan class="valor">{e.valor}</tspan>{/if}
    </text>
  {:else}
    <text x={e.p.x * U} y={e.p.y * U - 1} text-anchor={anclaSvg(e.p.ancla)} class="sim">{@html svgTexto(e.sim)}</text>
    <text x={e.p.x * U} y={e.p.y * U + 12} text-anchor={anclaSvg(e.p.ancla)} class="valor">{e.valor}</text>
  {/if}
{/snippet}

{#if t}
  <svg class="esquema-calc" class:miniatura viewBox="0 0 {t.w * U} {t.h * U}" role="img" aria-label="Esquema del circuito con las magnitudes de la fórmula">
    {#each prims as p, i (i)}
      {@const id = idDe('rol' in p ? p.rol : undefined)}
      {@const pulsable = !!id && posibles.includes(id)}
      {#if p.t === 'path'}
        <!-- The part bodies are a second, pointer-only target: the labels are the keyboard-accessible ones. -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <path d={p.d} class={p.cls} class:objetivo={!!id && id === objetivo} class:pulsable onclick={pulsable ? () => elegir(id) : undefined} />
      {:else if p.t === 'circ'}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <circle cx={p.cx * U} cy={p.cy * U} r={p.r * U} class={p.cls} class:objetivo={!!id && id === objetivo} class:pulsable onclick={pulsable ? () => elegir(id) : undefined} />
      {:else if p.t === 'txt'}
        <text x={p.x * U} y={p.y * U} text-anchor={anclaSvg(p.ancla)} class="txt-{p.cls}">{@html svgTexto(p.html)}</text>
      {/if}
    {/each}
    {#each barras as { b, frac, sim: s, obj } (b.rol + b.x + b.y)}
      <g class="barra" class:objetivo={obj}>
        <text x={b.x * U - 4} y={b.y * U + 4} text-anchor="end" class="sim">{@html svgTexto(s)}</text>
        <rect x={b.x * U} y={b.y * U - 4} width={b.w * U} height="8" rx="4" class="pista" />
        <rect x={b.x * U} y={b.y * U - 4} width={Math.max(2, frac * b.w * U)} height="8" rx="4" class="lleno" />
      </g>
    {/each}
    {#each etiquetas as e, i (i)}
      {@const w = Math.max(32, (e.p.una ? anchoEm(e.sim + ' = ' + e.valor) : Math.max(anchoEm(e.sim) * 1.2, anchoEm(e.valor))) * 11 + 8)}
      {@const h = e.p.una || !e.valor ? 18 : 30}
      {@const y0 = e.p.y * U + (e.p.una || !e.valor ? -9 : -14)}
      {#if e.id}
        {@const id = e.id}
        <g class="etiqueta pulsable" class:objetivo={e.objetivo} role="button" tabindex="0" aria-label="Calcular {e.nombre ?? id}"
          onclick={() => elegir(id)} onkeydown={(ev) => teclas(ev, id)}>
          {@render contenido(e, w, h, y0)}
        </g>
      {:else}
        <g class="etiqueta" class:objetivo={e.objetivo} class:tenue={!e.mapeado}>
          {@render contenido(e, w, h, y0)}
        </g>
      {/if}
    {/each}
  </svg>
{/if}

<style>
  .esquema-calc {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    font-family: var(--sans);
    -webkit-user-select: none;
    user-select: none;
  }
  path,
  circle {
    stroke: var(--tinta);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    transition: stroke 0.15s;
  }
  .cuerpo {
    fill: var(--superficie);
  }
  .relleno {
    fill: var(--tinta);
    stroke: none;
  }
  .hueco {
    fill: var(--superficie);
    stroke-width: 1.3;
  }
  .tenue,
  .trazos {
    stroke: var(--tinta-tenue);
    stroke-width: 1;
  }
  .trazos {
    stroke-dasharray: 3 3;
  }
  .flecha {
    stroke: var(--tinta-suave);
    stroke-width: 1.3;
  }
  path.relleno.objetivo,
  .flecha.objetivo {
    fill: var(--acento);
    stroke: var(--acento);
  }
  .cara1 {
    fill: color-mix(in srgb, var(--c-importante) 30%, var(--superficie));
    stroke-width: 1.2;
  }
  .cara2 {
    fill: color-mix(in srgb, var(--tinta-tenue) 18%, var(--superficie));
    stroke-width: 1.2;
  }
  .cara3 {
    fill: color-mix(in srgb, var(--c-importante) 55%, var(--superficie));
    stroke-width: 1.2;
  }
  .objetivo:is(path, circle):not(.relleno) {
    stroke: var(--acento);
    stroke-width: 2.2;
  }
  .cuerpo.objetivo {
    fill: var(--acento-tinte);
  }
  .pulsable {
    cursor: pointer;
  }
  text {
    fill: var(--tinta);
    font-size: 11px;
  }
  .txt-fijo {
    fill: var(--tinta-suave);
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
  }
  .txt-signo {
    fill: var(--tinta-suave);
    font-size: 12px;
    font-weight: 600;
  }
  .txt-pin {
    fill: var(--tinta-tenue);
    font-size: 8px;
    letter-spacing: 0.04em;
  }
  .txt-tenue {
    fill: var(--tinta-tenue);
    font-size: 10px;
  }
  .txt-caja {
    fill: var(--tinta-suave);
    font-size: 11px;
    font-weight: 600;
  }
  .etiqueta text {
    paint-order: stroke;
    stroke: var(--superficie);
    stroke-width: 3.5px;
    stroke-linejoin: round;
  }
  .etiqueta .sim,
  .barra .sim {
    font-family: var(--serif);
    font-style: italic;
    font-size: 13px;
  }
  .etiqueta .valor {
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
    fill: var(--tinta-suave);
  }
  .etiqueta .igual {
    fill: var(--tinta-tenue);
  }
  .etiqueta.tenue .sim {
    fill: var(--tinta-suave);
  }
  .zona {
    fill: transparent;
    stroke: none;
  }
  .etiqueta.pulsable:hover .zona,
  .etiqueta.pulsable:focus-visible .zona {
    fill: var(--hover);
  }
  .etiqueta.objetivo .zona {
    fill: var(--acento-tinte);
    stroke: var(--acento-borde);
    stroke-width: 1;
  }
  .etiqueta.objetivo text {
    stroke: var(--acento-tinte);
  }
  .etiqueta.objetivo .sim,
  .etiqueta.objetivo .valor {
    fill: var(--acento);
    font-weight: 700;
  }
  .etiqueta:focus {
    outline: none;
  }
  .etiqueta:focus-visible .zona {
    stroke: var(--acento);
    stroke-width: 2;
  }
  .barra .pista {
    fill: var(--linea-suave);
    stroke: none;
  }
  .barra .lleno {
    fill: color-mix(in srgb, var(--tinta-suave) 55%, transparent);
    stroke: none;
    transition: width 0.08s linear;
  }
  .barra.objetivo .lleno {
    fill: var(--acento);
  }
  .miniatura path,
  .miniatura circle {
    stroke-width: 2.2;
  }
  .miniatura .etiqueta {
    display: none;
  }
  .miniatura text {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .barra .lleno {
      transition: none;
    }
  }
</style>
