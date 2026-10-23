<script lang="ts">
  // One exercise or problem out of the reader (the «Ejercicios» page and the review of the failed ones):
  // the statement from its part, the answer panel and the book's solution.
  import type { Bloque, BEjercicios } from '../../lib/tipos';
  import { cargarParte, rotuloParte } from '../../lib/datos';
  import { item as itemDe } from '../../lib/ejercicios.svelte';
  import Bloques from '../Bloques.svelte';
  import Icono from '../Icono.svelte';
  import Comprobador from './Comprobador.svelte';

  let { label, titulo = true }: { label: string; titulo?: boolean } = $props();

  const item = $derived(itemDe(label));
  let enunciado = $state<Bloque[] | null>(null);
  let solucion = $state<Bloque[]>([]);
  let error = $state('');
  let verSol = $state(false);

  $effect(() => {
    const it = item;
    verSol = false;
    enunciado = null;
    error = '';
    if (!it) return;
    let vivo = true;
    cargarParte(it.parte)
      .then((p) => {
        if (!vivo) return;
        if (it.tipo === 'ej') {
          const b = p.bloques[it.pos[0] ?? -1] as BEjercicios | undefined;
          const e = b?.t === 'ejercicios' ? b.items[it.pos[1] ?? -1] : undefined;
          if (!e) throw new Error('ejercicio no encontrado');
          enunciado = e.bloques;
          solucion = e.solucion ?? [];
        } else {
          const [h, pide, fin] = it.pos as [number, number, number];
          enunciado = p.bloques.slice(h + 1, pide + 1);
          solucion = p.bloques.slice(pide + 1, fin);
        }
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });
</script>

{#if item}
  <article class="tarjeta-ej" data-label={label}>
    {#if titulo}
      <header>
        <span class="cual">
          {item.tipo === 'ej' ? `Ejercicio ${item.num}` : `Problema ${item.num}`}
          <span class="donde">· {rotuloParte(item.parte)}</span>
        </span>
        {#if item.titulo}<span class="tit">{item.titulo}</span>{/if}
        <a class="boton abrir" href={`#/${item.parte}/${label}`}><Icono nombre="libro" tam={16} /> Abrir en el libro</a>
      </header>
    {/if}
    {#if error}
      <p class="fallo">No se pudo cargar el enunciado: {error}</p>
    {:else if !enunciado}
      <p class="cargando">Cargando…</p>
    {:else}
      <div class="texto-libro enunciado"><Bloques bloques={enunciado} parte={item.parte} /></div>
      <Comprobador
        {label}
        {item}
        solucionVisible={verSol}
        sinSolucion={!solucion.length}
        alVerSolucion={(v) => (verSol = v)}
      />
      {#if verSol && solucion.length}
        <div class="solucion texto-libro">
          <span class="solucion-tit">{item.tipo === 'ej' ? `Solución ${item.num}.` : 'Análisis y resultado del libro'}</span>
          <div class="sol-cuerpo"><Bloques bloques={solucion} parte={item.parte} /></div>
        </div>
      {/if}
    {/if}
  </article>
{/if}

<style>
  .tarjeta-ej {
    font-size: var(--tam);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin-bottom: 8px;
    font-family: var(--sans);
  }
  .cual {
    color: var(--acento);
    font-size: 15px;
    font-weight: 700;
  }
  .donde {
    color: var(--tinta-tenue);
    font-weight: 600;
  }
  .tit {
    flex-basis: 100%;
    order: 3;
    color: var(--titulos);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.25;
  }
  .abrir {
    min-height: 44px;
    margin-left: auto;
  }
  .enunciado {
    font-size: 0.95em;
  }
  .fallo,
  .cargando {
    color: var(--tinta-tenue);
    font-family: var(--sans);
  }
</style>
