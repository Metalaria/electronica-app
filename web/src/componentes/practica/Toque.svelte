<script lang="ts">
  // «Toca R2 en el esquema»: the book's figure with an invisible layer of its parts and nodes (the schematic
  // data of «Datos de figuras»); a tap selects the nearest part or wire, «Comprobar» says whether it is the
  // one asked. The answer is shown on the drawing: the part's box or the node's wires.
  import { onMount, untrack } from 'svelte';
  import { url } from '../../lib/datos';
  import type { Esquema, Afin, Punto } from '../figuras-vivas/tipos';
  import type { ItemToque, Pista } from './tipos';
  import type { Comprobacion } from './Practica.svelte';
  import { datosFigura } from './medir';

  let { item, final, listo = $bindable(false), pistas = $bindable(null) }: { item: ItemToque; final: boolean; listo?: boolean; pistas?: Pista[] | null } = $props();

  /** `esq`: index of the schematic in the figure (a picture may hold several drawings). */
  type Objetivo = { esq: number; k: 'elemento' | 'nodo'; id: string; caja?: [number, number, number, number]; lineas: Punto[][]; puntos: Punto[] };

  let objetivos = $state.raw<Objetivo[]>([]);
  let elegido = $state<Objetivo | null>(null);
  let toque = $state<Punto | null>(null);
  let resultado = $state<boolean | null>(null);
  let capa: SVGSVGElement | undefined = $state();
  const vista = untrack(() => item.figura.vista);

  const SIN = new Set(['WIRE', 'DOT', 'ANOT', 'GND']);
  const af = (A: Afin, p: Punto): Punto => [A.sx * p[0] + A.tx, A.sy * p[1] + A.ty];

  function construir(esq: Esquema, k: number): Objetivo[] {
    const A = esq.dibujo_a_svg;
    const r: Objetivo[] = [];
    for (const e of esq.elementos) {
      if (SIN.has(e.rol) || !e.caja) continue;
      const a = af(A, [e.caja[0], e.caja[1]]);
      const b = af(A, [e.caja[2], e.caja[3]]);
      r.push({ esq: k, k: 'elemento', id: e.id, caja: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])], lineas: [], puntos: [] });
    }
    const pts = new Map(esq.puntos.map((p) => [p.id, p.xy]));
    for (const n of esq.nodos) {
      if (n.tierra) continue;
      const lineas = esq.tramos.filter((t) => t.nodo === n.id).map((t) => t.puntos.map((p) => af(A, p)));
      const puntos = n.puntos.map((p) => pts.get(p)).filter((p): p is Punto => !!p).map((p) => af(A, p));
      if (lineas.length) r.push({ esq: k, k: 'nodo', id: n.id, lineas, puntos });
    }
    return r;
  }

  onMount(() => {
    void datosFigura(item.figura.datos).then((d) => {
      objetivos = (d.esquemas ?? []).flatMap((esq, k) => construir(esq, k));
    });
    const base = item.pistas;
    if (item.pide.simbolo) {
      void import('../glosario/simbolo').then((m) => {
        if (!m.esClaveSimbolo(item.pide.simbolo)) return;
        pistas = [...base, { titulo: `El símbolo de ${m.nombreSimbolo(item.pide.simbolo)}`, html: `<span class="p10-simbolo">${m.svgSimbolo(item.pide.simbolo)}</span>` }];
      });
    } else if (item.pide.k === 'nodo') {
      pistas = [...base, { titulo: 'Dónde mirar', html: `Busca la etiqueta ${item.pide.nombre} en el esquema.` }];
    }
  });

  function distSeg(p: Punto, a: Punto, b: Punto): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  function distancia(o: Objetivo, p: Punto): number {
    if (o.caja) {
      const [x0, y0, x1, y1] = o.caja;
      const dx = Math.max(x0 - p[0], 0, p[0] - x1);
      const dy = Math.max(y0 - p[1], 0, p[1] - y1);
      // inside a box: the smaller box wins (a part drawn inside another's area)
      return dx === 0 && dy === 0 ? -1 / (1 + (x1 - x0) * (y1 - y0)) : Math.hypot(dx, dy);
    }
    let d = Infinity;
    for (const l of o.lineas) for (let i = 1; i < l.length; i++) d = Math.min(d, distSeg(p, l[i - 1]!, l[i]!));
    for (const q of o.puntos) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1]));
    // a wire must be hit closely; parts win when both are near
    return d + 0.5;
  }

  function tocar(ev: PointerEvent) {
    if (final || !capa) return;
    const r = capa.getBoundingClientRect();
    const p: Punto = [vista[0] + ((ev.clientX - r.left) / r.width) * vista[2], vista[1] + ((ev.clientY - r.top) / r.height) * vista[3]];
    const k = r.width / vista[2];
    let mejor: Objetivo | null = null;
    let dm = 26 / k;
    for (const o of objetivos) {
      const d = distancia(o, p);
      if (d < dm) {
        dm = d;
        mejor = o;
      }
    }
    toque = p;
    elegido = mejor;
    resultado = null;
  }

  $effect(() => {
    listo = !!elegido;
  });

  const es = (o: Objetivo) => o.esq === item.figura.esquema && o.k === item.pide.k && o.id === item.pide.id;
  const correcto = $derived(objetivos.find(es) ?? null);

  export function comprobar(): Comprobacion {
    if (!elegido) return { bien: false, nula: true, mensaje: 'Toca una pieza o un cable del esquema.' };
    resultado = es(elegido);
    return resultado ? { bien: true } : { bien: false, mensaje: 'Eso no es lo que se pide.' };
  }

  export function reintentar(): void {
    elegido = null;
    toque = null;
    resultado = null;
  }

  const trazo = (l: Punto[]) => l.map((p) => p.join(',')).join(' ');
  const grueso = $derived(Math.max(vista[2], vista[3]) / 160);
</script>

{#snippet marca(o: Objetivo, clase: string)}
  {#if o.caja}
    <rect class={clase} x={o.caja[0] - grueso * 2} y={o.caja[1] - grueso * 2} width={o.caja[2] - o.caja[0] + grueso * 4} height={o.caja[3] - o.caja[1] + grueso * 4} rx={grueso * 2} stroke-width={grueso} />
  {:else}
    {#each o.lineas as l, i (i)}<polyline class={clase} points={trazo(l)} stroke-width={grueso * 2.4} />{/each}
  {/if}
{/snippet}

<div class="toque" data-elegido={elegido ? `${elegido.esq}:${elegido.k}:${elegido.id}` : undefined} data-objetivos={objetivos.length}>
  <div class="p10-placa marco">
    <img src={url(item.figura.src)} alt={`Figura ${item.figura.num}`} draggable="false" />
    <svg
      bind:this={capa}
      class="capa"
      viewBox={vista.join(' ')}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label={`Esquema de la figura ${item.figura.num}: toca la pieza o el nodo que se pide`}
      onpointerdown={tocar}
      data-capa
    >
      {#if final && correcto}
        {@render marca(correcto, 'bien')}
      {/if}
      {#if elegido && !(final && elegido === correcto)}
        {@render marca(elegido, final || resultado === false ? 'mal' : 'sel')}
      {/if}
      {#if toque && !final}
        <circle class="punto" cx={toque[0]} cy={toque[1]} r={grueso * 2} />
      {/if}
    </svg>
  </div>
  <p class="ayuda">{final ? 'En verde, lo que se pedía.' : elegido ? 'Seleccionado. Toca otro sitio para cambiarlo, o comprueba.' : 'Toca directamente sobre el dibujo.'}</p>
</div>

<style>
  .toque {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .marco {
    position: relative;
    padding: 10px;
  }
  .marco img {
    display: block;
    width: 100%;
    height: auto;
    user-select: none;
  }
  .capa {
    position: absolute;
    inset: 10px;
    width: calc(100% - 20px);
    height: calc(100% - 20px);
    cursor: crosshair;
    touch-action: manipulation;
  }
  .capa :global(.sel) {
    fill: rgba(37, 99, 235, 0.12);
    stroke: #2563eb;
  }
  .capa :global(polyline.sel),
  .capa :global(polyline.bien),
  .capa :global(polyline.mal) {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.75;
  }
  .capa :global(.bien) {
    fill: rgba(30, 122, 69, 0.14);
    stroke: #1e7a45;
  }
  .capa :global(.mal) {
    fill: rgba(176, 58, 30, 0.12);
    stroke: #b03a1e;
  }
  .capa .punto {
    fill: #2563eb;
    opacity: 0.6;
  }
  .ayuda {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  :global(.p10-simbolo svg) {
    width: 96px;
    height: auto;
    color: var(--tinta);
  }
</style>
