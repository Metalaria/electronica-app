<script lang="ts">
  // Card next to the wire, node or part under the pointer (or selected): voltage, current and power at the
  // time shown, and for a part the links to its component animation and to the book section.
  import type { Caja } from '../tipos';
  import type { EstadoEsquema, Seleccion } from './modelo.svelte';
  import { si } from '../formato';
  import { animacionDe, nombreElemento, textoEtiqueta } from './textos';
  import { animacion } from '../../animaciones/catalogo';
  import { disponible } from '../../animaciones/cargadores';
  import { referencia } from '../../animaciones/referencias';
  import { prepararSalto } from '../../../lib/ruta.svelte';
  import { afin } from '../geometria';
  import { colorTension } from './color';

  let {
    est,
    sel,
    vista,
    k,
    fija,
    cerrar,
    /** Text of the «Volver» button after following a link. */
    volverA = 'Volver a la figura',
    alNavegar,
  }: {
    est: EstadoEsquema;
    sel: NonNullable<Seleccion>;
    vista: Caja;
    k: number;
    fija: boolean;
    cerrar: () => void;
    volverA?: string;
    alNavegar?: () => void;
  } = $props();

  const NOMBRES_TERM: Record<string, string> = {
    base: 'base',
    collector: 'colector',
    emitter: 'emisor',
    gate: 'puerta',
    drain: 'drenador',
    source: 'fuente',
    in1: 'entrada −',
    in2: 'entrada +',
    out: 'salida',
    vd: 'alim. +',
    vs: 'alim. −',
    tap: 'cursor',
    start: 'terminal 1',
    end: 'terminal 2',
  };

  const nodoId = $derived(est.nodoDe(sel));
  const nodo = $derived(nodoId ? est.esq.nodos.find((n) => n.id === nodoId) : undefined);
  const elemento = $derived(sel.k === 'elem' ? est.esq.elementos.find((e) => e.id === sel.id) : undefined);
  const simulado = $derived(est.simulable && !!est.op);

  function nombreNodo(id: string): string {
    const n = est.esq.nodos.find((x) => x.id === id);
    if (!n) return id;
    if (n.tierra) return 'masa';
    const et = (n.etiquetas ?? []).map(textoEtiqueta).filter(Boolean);
    return et.length ? et.join(', ') : `nodo ${id.replace(/^N/, '')}`;
  }

  /** Where the card goes: next to the item, in CSS px within the figure. */
  const posicion = $derived.by(() => {
    let p: [number, number];
    if (elemento) {
      const g = est.elementos.find((x) => x.e.id === elemento.id);
      p = g?.caja ? [(g.caja[0] + g.caja[2]) / 2, g.caja[1]] : g?.centro ?? [0, 0];
      if (g?.caja) p = [g.caja[2], (g.caja[1] + g.caja[3]) / 2];
    } else if (sel.k === 'tramo') {
      const c = est.caminos.find((x) => x.clave.k === 'tramo' && x.clave.id === sel.id);
      const pts = c?.tr.pts ?? [[0, 0]];
      p = pts[Math.floor(pts.length / 2)] ?? [0, 0];
      if (c && c.tr.pts.length >= 2) {
        const a = c.tr.pts[0]!;
        const b = c.tr.pts[c.tr.pts.length - 1]!;
        p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      }
    } else {
      const pt = est.esq.puntos.find((x) => x.nodo === sel.id);
      p = pt ? afin(est.esq.dibujo_a_svg, pt.xy) : [0, 0];
    }
    const x = (p[0] - vista[0]) * k;
    const y = (p[1] - vista[1]) * k;
    const W = vista[2] * k;
    const H = vista[3] * k;
    return { x, y, izquierda: x > W * 0.55, arriba: y > H * 0.5 };
  });

  let anchoFicha = $state(0);
  /** Left edge in px, kept inside the figure (a little overflow into the plate's padding is fine). */
  const izquierdaPx = $derived.by(() => {
    const W = vista[2] * k;
    const w = anchoFicha || 200;
    let x = posicion.izquierda ? posicion.x - 12 - w : posicion.x + 12;
    if (x + w > W + 10) x = W + 10 - w;
    return Math.max(-10, x);
  });

  const valorV = (v: number | null) => (v == null ? '—' : si(v, 'V', 3));
  const valorI = (v: number | null) => (v == null ? '—' : si(Math.abs(v) < 1e-15 ? 0 : v, 'A', 3));

  const anim = $derived.by(() => {
    if (!elemento) return null;
    const id = animacionDe(elemento);
    if (!id || !disponible(id)) return null;
    const a = animacion(id);
    if (!a) return null;
    const lib = a.libro.map((l) => referencia(l)).find((r) => r && r.tipo === 'sec') ?? null;
    return { a, lib };
  });

  function salto() {
    prepararSalto({ texto: volverA });
    alNavegar?.();
  }

  const medidas = $derived(elemento && simulado ? est.medidas(elemento.id) : null);
  const corrienteTramo = $derived(sel.k === 'tramo' && simulado ? est.corriente({ k: 'tramo', id: sel.id }) : null);
  const tensionNodo = $derived(nodoId && simulado ? est.tension(nodoId) : null);
  const ref = $derived(Math.max(Math.abs(est.rangos.vmin), Math.abs(est.rangos.vmax)));

  const conexiones = $derived.by(() => {
    if (!nodo) return [];
    return nodo.terminales.flatMap((s) => {
      const [el, t] = s.split('.') as [string, string];
      const e = est.esq.elementos.find((x) => x.id === el);
      if (!e || ['WIRE', 'DOT', 'GND', 'ANOT'].includes(e.rol)) return [];
      const n = Object.keys(e.terminales ?? {}).length;
      return [`${nombreElemento(e)}${n > 2 || !['start', 'end'].includes(t) ? ` (${NOMBRES_TERM[t] ?? t})` : ''}`];
    });
  });
</script>

<div
  class="ficha"
  class:izquierda={posicion.izquierda}
  class:arriba={posicion.arriba}
  class:fija
  style:left={`${izquierdaPx}px`}
  style:top={`${posicion.y}px`}
  bind:offsetWidth={anchoFicha}
  role={fija ? 'dialog' : 'status'}
  aria-label="Valores del circuito"
>
  {#if fija}<button type="button" class="cerrar" aria-label="Cerrar" onclick={cerrar}>×</button>{/if}
  {#if elemento}
    <div class="tit">{nombreElemento(elemento)}{#if elemento.valor_texto}<span class="valor">{elemento.valor_texto}</span>{/if}</div>
    {#if medidas}
      <dl>
        {#if medidas.v != null}<dt>V</dt><dd>{valorV(medidas.v)}</dd>{/if}
        {#if medidas.i != null}<dt>I</dt><dd>{valorI(medidas.i)}</dd>{/if}
        {#if Object.keys(medidas.terminales).length > 2 || (medidas.i == null && Object.keys(medidas.terminales).length)}
          {#each Object.entries(medidas.terminales) as [t, i] (t)}
            <dt>I<sub>{NOMBRES_TERM[t] ?? t}</sub></dt><dd>{valorI(i)}</dd>
          {/each}
        {/if}
        {#if medidas.p != null}
          <dt>P</dt><dd>{si(Math.abs(medidas.p) < 1e-15 ? 0 : Math.abs(medidas.p), 'W', 3)} <span class="nota">{medidas.p < -1e-15 ? 'entrega' : 'absorbe'}</span></dd>
        {/if}
      </dl>
      {#if est.tran}<div class="nota">en t = {si(est.tiempo ?? 0, 's', 3)}</div>{/if}
      {#if elemento.rol === 'C' || elemento.rol === 'VAR'}
        <div class="nota">Entre las placas no pasan cargas: los puntos que lo cruzan son la corriente de desplazamiento (la que llega a una placa sale de la otra).</div>
      {/if}
    {:else if est.simulable === false}
      <div class="nota">Conexiones: {Object.entries(elemento.terminales ?? {}).map(([t, n]) => `${NOMBRES_TERM[t] ?? t} → ${nombreNodo(n)}`).join(' · ') || 'ninguna'}</div>
    {/if}
    {#if anim && fija}
      <div class="enlaces">
        <a href={`#/componentes/${anim.a.id}`} onclick={salto}>Ver animación: {anim.a.titulo}</a>
        {#if anim.lib}<a href={anim.lib.href} onclick={salto}>En el libro: {anim.lib.num}{anim.lib.titulo ? ` ${anim.lib.titulo}` : ''}</a>{/if}
      </div>
    {:else if anim}
      <div class="nota">Clic para ver la animación del componente</div>
    {/if}
  {:else if nodoId}
    <div class="tit">
      {#if simulado}<span class="muestra" style:background={colorTension(tensionNodo ?? 0, ref)}></span>{/if}
      {sel.k === 'tramo' ? 'Cable' : 'Nodo'} · {nombreNodo(nodoId)}
    </div>
    {#if simulado}
      <dl>
        <dt>V</dt><dd>{valorV(tensionNodo)}</dd>
        {#if sel.k === 'tramo'}<dt>I</dt><dd>{valorI(corrienteTramo == null ? null : Math.abs(corrienteTramo))}</dd>{/if}
      </dl>
      {#if est.tran}<div class="nota">en t = {si(est.tiempo ?? 0, 's', 3)}</div>{/if}
    {/if}
    {#if conexiones.length}<div class="nota">Une: {conexiones.join(' · ')}</div>{/if}
  {/if}
</div>

<style>
  .ficha {
    position: absolute;
    z-index: 4;
    transform: translateY(-50%);
    width: max-content;
    max-width: min(17em, 82vw);
    padding: 7px 10px;
    border: 1px solid var(--linea);
    border-radius: 9px;
    background: color-mix(in srgb, var(--superficie) 96%, transparent);
    box-shadow: var(--sombra);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 13px;
    line-height: 1.35;
    text-align: left;
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }
  .ficha.fija {
    pointer-events: auto;
    border-color: var(--acento-borde);
    padding-right: 30px;
  }
  .tit {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px 6px;
    font-weight: 700;
    color: var(--titulos);
  }
  .valor {
    font-weight: 600;
    color: var(--tinta-suave);
  }
  .muestra {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.25);
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1px 8px;
    margin: 4px 0 0;
  }
  dt {
    color: var(--tinta-suave);
    font-style: italic;
  }
  dd {
    margin: 0;
    font-weight: 600;
  }
  .nota {
    margin-top: 3px;
    color: var(--tinta-tenue);
    font-size: 11.5px;
    font-weight: 400;
  }
  .enlaces {
    display: grid;
    gap: 2px;
    margin-top: 6px;
  }
  .enlaces a {
    display: flex;
    align-items: center;
    min-height: 32px;
    color: var(--acento);
    font-weight: 600;
    text-decoration: none;
  }
  .enlaces a:hover {
    text-decoration: underline;
  }
  .cerrar {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: none;
    color: var(--tinta-suave);
    font-size: 18px;
    line-height: 1;
  }
  .cerrar:hover {
    background: var(--hover);
  }
  @media (pointer: coarse) {
    .enlaces a {
      min-height: 44px;
    }
    .cerrar {
      width: 44px;
      height: 44px;
      top: -6px;
      right: -6px;
    }
    .ficha.fija {
      padding-right: 40px;
    }
  }
</style>
