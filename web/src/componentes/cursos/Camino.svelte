<script lang="ts" module>
  import type { EstadoNodo, Repaso } from '../../lib/aprendizaje/camino';

  /** A node of a course's path as it is drawn. */
  export interface NodoVista {
    clave: string;
    /** «1.4», «Ej. 2.6», «Pregunta». */
    rotulo: string;
    titulo: string;
    href: string;
    estado: EstadoNodo;
    /** 0–1: steps done of a lesson (1 when done or passed). */
    progreso: number;
    repaso: Repaso | null;
    tipo: 'leccion' | 'ejercicio' | 'pregunta';
    /** The short check that opens a locked node (its route). */
    saltar?: string;
  }

  export interface GrupoCamino {
    clave: string;
    titulo: string;
    nodos: NodoVista[];
  }
</script>

<script lang="ts">
  // 1.0 «Mapa de cada curso como camino»: the lessons (and, in own courses, the exercises and questions) as a path of
  // round nodes that open one after another. The DOM is an ordered list per chapter: a screen reader or the keyboard
  // walks it as a list (each node says its number, title, state and review), the zigzag and the connectors are only
  // drawn. A locked node is not a link: its «Saltar hasta aquí» opens the short check. Nothing animates.
  import Check from '@lucide/svelte/icons/check';
  import Lock from '@lucide/svelte/icons/lock';
  import Play from '@lucide/svelte/icons/play';
  import FastForward from '@lucide/svelte/icons/fast-forward';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import PenLine from '@lucide/svelte/icons/pen-line';
  import CircleHelp from '@lucide/svelte/icons/circle-help';
  import { cuandoRepaso } from '../../lib/aprendizaje/camino';

  let { grupos, siguiente = null, ahora = Date.now() }: { grupos: GrupoCamino[]; siguiente?: string | null; ahora?: number } = $props();

  /** Horizontal offset of the k-th node (px; scaled down on narrow screens). */
  const ZIG = [0, 46, 70, 46, 0, -46, -70, -46];
  let estrecho = $state(false);
  $effect(() => {
    const m = window.matchMedia('(max-width: 520px)');
    const ver = () => (estrecho = m.matches);
    ver();
    m.addEventListener('change', ver);
    return () => m.removeEventListener('change', ver);
  });
  const x = (k: number) => (k < 0 ? 0 : ZIG[k % ZIG.length]!) * (estrecho ? 0.45 : 1);

  const ESTADO: Record<EstadoNodo, string> = {
    hecho: 'Completada',
    superado: 'Superada por una prueba',
    'en-curso': 'Empezada',
    disponible: 'Disponible',
    bloqueado: 'Bloqueada',
  };

  function estadoTexto(n: NodoVista): string {
    if (n.tipo !== 'leccion') {
      const m: Record<EstadoNodo, string> = { hecho: 'Resuelto', superado: 'Superado', 'en-curso': 'Intentado', disponible: 'Disponible', bloqueado: 'Bloqueado' };
      return m[n.estado];
    }
    if (n.estado === 'en-curso') return `Empezada · ${Math.round(n.progreso * 100)} %`;
    return ESTADO[n.estado];
  }

  function repasoTexto(r: Repaso | null): string {
    if (!r) return '';
    if (r.k === 'ahora') return 'Para repasar hoy';
    if (r.k === 'fecha') return `Repaso ${cuandoRepaso(r.t, ahora)}`;
    if (r.k === 'flojo') return 'Conviene practicarla';
    return '';
  }

  const repasoHref = (clave: string) => `#/practicar/${clave.split('/').map(encodeURIComponent).join('/')}`;
</script>

<div class="camino" data-camino>
  {#each grupos as g, gi (g.clave)}
    <section class="tramo" data-tramo={g.clave}>
      <h2 class="tit-tramo">{g.titulo}</h2>
      <ol class="nodos">
        {#each g.nodos as n, k (n.clave)}
          {@const r = repasoTexto(n.repaso)}
          {@const sig = n.clave === siguiente}
          <li class="nodo {n.estado}" class:sig style:--x={`${x(k) - x(0)}px`} data-nodo={n.clave} data-estado={n.estado} data-repaso={n.repaso?.k}>
            {#if k > 0 || gi > 0}<svg class="union" width="200" height="26" viewBox="-100 0 200 26" aria-hidden="true"><line x1={k > 0 ? x(k - 1) - x(k) : 0} y1="0" x2="0" y2="26" /></svg>{/if}
            <div class="fila">
              {#if n.estado === 'bloqueado'}
                <span class="disco" aria-hidden="true" style:--p={n.progreso}><span class="cara"><Lock size={22} /></span></span>
              {:else}
                <a class="disco" href={n.href} style:--p={n.progreso} aria-label={`${n.rotulo} ${n.titulo}: ${estadoTexto(n)}${r ? `. ${r}` : ''}`} data-abrir-nodo>
                  <span class="cara" aria-hidden="true">
                    {#if n.estado === 'hecho'}<Check size={26} strokeWidth={3} />{:else if n.estado === 'superado'}<FastForward size={22} />{:else if n.tipo === 'ejercicio'}<PenLine size={22} />{:else if n.tipo === 'pregunta'}<CircleHelp size={22} />{:else}<Play size={22} />{/if}
                  </span>
                </a>
              {/if}
              <div class="texto">
                <span class="rotulo">{n.rotulo}</span>
                <span class="titulo">{n.titulo}</span>
                <span class="estado">{estadoTexto(n)}{#if sig}{' · '}<strong>la siguiente</strong>{/if}</span>
                {#if r}
                  <a class="repaso" class:ya={n.repaso?.k === 'ahora'} href={repasoHref(n.clave)} data-repasar={n.clave}><RotateCcw size={14} aria-hidden="true" /> {r}</a>
                {/if}
                {#if n.estado === 'bloqueado'}
                  <span class="solo-lector">Se abre al completar la lección anterior.</span>
                  {#if n.saltar}<a class="saltar" href={n.saltar} data-saltar={n.clave}>Saltar hasta aquí</a>{/if}
                {/if}
              </div>
            </div>
          </li>
        {/each}
      </ol>
    </section>
  {/each}
</div>

<style>
  .camino {
    display: flex;
    flex-direction: column;
    gap: 8px;
    --disco: 64px;
    --base: calc(50% - 190px);
  }
  @media (max-width: 520px) {
    .camino {
      --disco: 56px;
      --base: 40px;
    }
  }
  .tit-tramo {
    margin: 18px 0 4px;
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .nodos {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .nodo {
    position: relative;
    padding-left: max(0px, calc(var(--base) + var(--x)));
  }
  .union {
    display: block;
    margin-left: calc(var(--disco) / 2 - 100px);
    overflow: visible;
    stroke: var(--linea);
    stroke-width: 4;
    stroke-dasharray: 2 7;
    stroke-linecap: round;
  }
  .nodo.hecho .union,
  .nodo.superado .union,
  .nodo.disponible .union,
  .nodo.en-curso .union {
    stroke: var(--c09, var(--acento));
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .disco {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: var(--disco);
    height: var(--disco);
    border-radius: 50%;
    background: conic-gradient(var(--c09, var(--acento)) calc(var(--p) * 360deg), var(--linea) 0);
    color: inherit;
    text-decoration: none;
  }
  .cara {
    display: grid;
    place-items: center;
    width: calc(var(--disco) - 10px);
    height: calc(var(--disco) - 10px);
    border-radius: 50%;
    background: var(--superficie);
    color: var(--c09-texto, var(--titulos));
  }
  .hecho .cara {
    background: var(--c09, var(--acento));
    color: var(--sobre09, #fff);
  }
  .superado .cara {
    background: var(--superficie-2);
    color: var(--tinta);
  }
  .bloqueado .disco {
    background: var(--linea);
  }
  .bloqueado .cara {
    background: var(--superficie-2);
    color: var(--tinta-suave);
  }
  .sig .disco {
    box-shadow: 0 0 0 4px var(--fondo), 0 0 0 7px var(--c09, var(--acento));
  }
  a.disco:focus-visible {
    outline: 3px solid var(--acento);
    outline-offset: 4px;
  }
  .texto {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 1px;
    max-width: 300px;
  }
  .rotulo {
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 700;
  }
  .titulo {
    color: var(--titulos);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
  }
  .bloqueado .titulo {
    color: var(--tinta-suave);
  }
  .estado {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .repaso,
  .saltar {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    gap: 5px;
    min-height: 44px;
    color: var(--acento);
    font-size: 14px;
    font-weight: 600;
  }
  .repaso.ya {
    color: var(--titulos);
  }
  .saltar {
    padding: 0 12px;
    margin-top: 2px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    text-decoration: none;
  }
  .saltar:hover {
    background: var(--hover);
  }
</style>
