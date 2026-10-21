<script lang="ts">
  // Page of one animation: title, links to the book sections it illustrates, the scene, and navigation.
  import { onMount, type Component } from 'svelte';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import CornerUpLeft from '@lucide/svelte/icons/corner-up-left';
  import { ANIMACIONES, animacion, familiaDe } from './catalogo';
  import { CARGADORES, disponible } from './cargadores';
  import { referencia } from './referencias';
  import { ruta, prepararSalto, volver } from '../../lib/ruta.svelte';

  let { id }: { id: string } = $props();

  const a = $derived(animacion(id));
  const fam = $derived(a ? familiaDe(a.familia) : null);
  const refs = $derived((a?.libro ?? []).map((l) => referencia(l)).filter((r) => r !== null));
  const lista = $derived(ANIMACIONES.filter((x) => disponible(x.id)));
  const pos = $derived(lista.findIndex((x) => x.id === id));
  const anterior = $derived(pos > 0 ? lista[pos - 1] : undefined);
  const siguiente = $derived(pos >= 0 && pos < lista.length - 1 ? lista[pos + 1] : undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Escena: Component<any> | null = $state(null);
  let error = $state('');

  $effect(() => {
    const cargar = CARGADORES[id];
    Escena = null;
    error = '';
    if (!cargar) return;
    let vivo = true;
    cargar()
      .then((m) => {
        if (vivo) Escena = m.default;
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  function irAlLibro(): void {
    prepararSalto({ texto: 'Volver a la animación' });
  }

  onMount(() => {
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
  });
</script>

<svelte:head><title>{a ? `${a.titulo} · Componentes` : 'Componentes'} · Electrónica Práctica Avanzada</title></svelte:head>

<div class="pagina" style:--c={fam?.color}>
  {#if !a || !disponible(id)}
    <div class="aviso">
      <h1>No existe esa animación</h1>
      <p><a href="#/componentes">Ver todas las animaciones</a></p>
    </div>
  {:else}
    <nav class="migas" aria-label="Ruta">
      <a href="#/componentes"><ArrowLeft size={16} strokeWidth={2.2} /> Componentes</a>
      <span aria-hidden="true">·</span>
      <span class="fam"><i></i>{fam?.nombre}</span>
    </nav>
    <h1>{a.titulo}</h1>
    <p class="resumen">{a.resumen}</p>
    {#if refs.length}
      <div class="libro">
        <span class="et"><BookOpen size={16} strokeWidth={2} /> En el libro</span>
        <ul>
          {#each refs as r (r.label)}
            <li><a href={r.href} onclick={irAlLibro}><b>{r.num}</b>{#if r.titulo}<span>{r.titulo}</span>{/if}</a></li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="animacion">
      {#if Escena}
        {#key id}<Escena />{/key}
      {:else if error}
        <p class="aviso">No se pudo cargar la animación: {error}</p>
      {:else}
        <div class="cargando" aria-live="polite">Preparando la animación…</div>
      {/if}
    </div>

    <nav class="vecinos" aria-label="Otras animaciones">
      {#if anterior}
        <a href={`#/componentes/${anterior.id}`} class="ant"><ChevronLeft size={18} /><span><small>Anterior</small>{anterior.titulo}</span></a>
      {:else}<span></span>{/if}
      {#if siguiente}
        <a href={`#/componentes/${siguiente.id}`} class="sig"><span><small>Siguiente</small>{siguiente.titulo}</span><ChevronRight size={18} /></a>
      {/if}
    </nav>
  {/if}
</div>

{#if ruta.desde}
  <button class="volver" onclick={volver}>
    <CornerUpLeft size={18} strokeWidth={2} />
    {ruta.desde.texto}
  </button>
{/if}

<style>
  .pagina {
    --c: var(--acento);
    max-width: 1240px;
    margin: 0 auto;
    padding: 18px clamp(16px, 3vw, 32px) 80px;
    font-family: var(--sans);
  }
  .migas {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 14px;
    color: var(--tinta-suave);
  }
  .migas a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    text-decoration: none;
  }
  .fam {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .fam i {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    background: var(--c);
  }
  h1 {
    margin: 8px 0 4px;
    font-size: clamp(24px, 4.2vw, 34px);
    line-height: 1.15;
    color: var(--titulos);
  }
  .resumen {
    margin: 0 0 12px;
    font-family: var(--serif);
    font-size: 17px;
    color: var(--tinta-suave);
  }
  .libro {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
  }
  .libro .et {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 700;
    color: var(--tinta-suave);
  }
  .libro ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .libro a {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    max-width: 100%;
    padding: 5px 11px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 13.5px;
    text-decoration: none;
  }
  .libro a:hover {
    border-color: var(--acento);
  }
  .libro b {
    color: var(--acento);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .libro a span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 26em;
  }
  .cargando {
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 9;
    border-radius: 14px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
  }
  .vecinos {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 34px;
  }
  .vecinos a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 48%;
    padding: 10px 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    font-weight: 600;
    text-decoration: none;
  }
  .vecinos a:hover {
    border-color: var(--acento);
  }
  .vecinos span {
    display: grid;
  }
  .vecinos .sig span {
    text-align: right;
  }
  .vecinos small {
    font-size: 12px;
    font-weight: 600;
    color: var(--tinta-suave);
  }
  .aviso {
    padding: 18vh 0;
    text-align: center;
  }
  .volver {
    position: fixed;
    left: 50%;
    bottom: calc(18px + env(safe-area-inset-bottom));
    z-index: 15;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px;
    border: 0;
    border-radius: 999px;
    background: var(--banda);
    color: #fff;
    font-family: var(--sans);
    font-size: 15px;
    font-weight: 600;
    box-shadow: var(--sombra-alta);
    transform: translateX(-50%);
  }
  @media (pointer: coarse) {
    .libro a {
      min-height: 44px;
      align-items: center;
    }
    .vecinos a {
      min-height: 44px;
    }
  }
</style>
