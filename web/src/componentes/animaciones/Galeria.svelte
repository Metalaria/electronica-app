<script lang="ts">
  // Gallery of a collection of animations (components or concepts), grouped by family or area, with an
  // accent-insensitive filter.
  import { onMount } from 'svelte';
  import Search from '@lucide/svelte/icons/search';
  import X from '@lucide/svelte/icons/x';
  import { COMPONENTES, disponibleEn, type Coleccion } from './coleccion';
  import type { Simbolo as TipoSimbolo } from './catalogo';
  import type { IconoConcepto } from './conceptos/catalogo';
  import { referencia } from './referencias';
  import { normalizar } from '../../lib/datos';
  import { ruta } from '../../lib/ruta.svelte';
  import Simbolo from './ui/Simbolo.svelte';
  import Icono from './conceptos/Icono.svelte';

  let { coleccion = COMPONENTES }: { coleccion?: Coleccion } = $props();

  let consulta = $state('');
  let familia = $state('');

  const conceptos = $derived(coleccion.ruta === 'conceptos');
  const FAMILIAS = $derived(coleccion.grupos);
  const lista = $derived(coleccion.lista.filter((a) => disponibleEn(coleccion, a.id)));

  const filtradas = $derived.by(() => {
    const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
    return lista.filter((a) => {
      if (familia && a.grupo !== familia) return false;
      if (!palabras.length) return true;
      const nums = a.libro.map((l) => referencia(l)?.num ?? '').join(' ');
      const texto = normalizar(`${a.titulo} ${a.resumen} ${a.claves} ${nums} ${FAMILIAS.find((f) => f.id === a.grupo)?.nombre ?? ''}`);
      return palabras.every((p) => texto.includes(p));
    });
  });

  const grupos = $derived(
    FAMILIAS.map((f) => ({ ...f, items: filtradas.filter((a) => a.grupo === f.id) })).filter((g) => g.items.length),
  );

  function secciones(libro: string[]): string[] {
    return libro
      .map((l) => referencia(l))
      .filter((r) => r && (r.tipo === 'sec' || r.tipo === 'subsec'))
      .slice(0, 3)
      .map((r) => r!.num);
  }

  onMount(() => {
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
  });
</script>

<svelte:head><title>{conceptos ? 'Conceptos animados' : 'Componentes animados'} · Electrónica Práctica Avanzada</title></svelte:head>

<div class="galeria">
  <header>
    {#if conceptos}
      <p class="sobre">Conceptos animados</p>
      <h1>La teoría, en movimiento</h1>
      <p class="intro">
        {lista.length} animaciones interactivas de las ideas que una figura fija explica mal: fasores que giran,
        armónicos que se suman, muestras que se confunden, lazos que oscilan, ondas que rebotan. Calculadas en el
        momento con los números del libro, y cada una enlaza con las secciones que la explican.
      </p>
    {:else}
      <p class="sobre">Componentes animados</p>
      <h1>Cómo funcionan por dentro</h1>
      <p class="intro">
        {lista.length} animaciones interactivas de los componentes que trata el libro: su construcción, lo que ocurre
        dentro y lo que hacen en un circuito. Cada una enlaza con las secciones que la explican.
      </p>
    {/if}
    <div class="filtro">
      <label class="buscar">
        <Search size={18} strokeWidth={2} aria-hidden="true" />
        <span class="solo-lector">Buscar animación</span>
        <input type="search" placeholder={conceptos ? 'Buscar: fasor, Nyquist, 23.6, Bode…' : 'Buscar: diodo, MLCC, 5.3, saturación…'} bind:value={consulta} />
        {#if consulta}
          <button type="button" class="limpiar" aria-label="Borrar la búsqueda" onclick={() => (consulta = '')}><X size={16} /></button>
        {/if}
      </label>
      <div class="familias" role="group" aria-label={conceptos ? 'Áreas' : 'Familias'}>
        <button type="button" class:activa={familia === ''} onclick={() => (familia = '')}>Todas</button>
        {#each FAMILIAS.filter((f) => lista.some((a) => a.grupo === f.id)) as f (f.id)}
          <button type="button" class:activa={familia === f.id} style:--c={f.color} onclick={() => (familia = familia === f.id ? '' : f.id)}>
            <i></i>{f.nombre}
          </button>
        {/each}
      </div>
    </div>
  </header>

  {#each grupos as g (g.id)}
    <section class="grupo" style:--c={g.color}>
      <h2><i></i>{g.nombre}</h2>
      <ul class="tarjetas">
        {#each g.items as a (a.id)}
          <li>
            <a class="tarjeta" href={`#/${coleccion.ruta}/${a.id}`}>
              <span class="arte">
                {#if conceptos}<Icono s={a.arte as IconoConcepto} tam={104} />{:else}<Simbolo s={a.arte as TipoSimbolo} tam={104} />{/if}
              </span>
              <span class="txt">
                <span class="tit">{a.titulo}</span>
                <span class="res">{a.resumen}</span>
                {#if secciones(a.libro).length}
                  <span class="secs">{#each secciones(a.libro) as n (n)}<b>{n}</b>{/each}</span>
                {/if}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="nada">Ninguna animación coincide con «{consulta}».</p>
  {/each}
</div>

<style>
  .galeria {
    max-width: 1120px;
    margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 40px) 72px;
    font-family: var(--sans);
  }
  header {
    padding: clamp(20px, 5vw, 44px) 0 8px;
  }
  .sobre {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--acento);
  }
  h1 {
    margin: 6px 0 8px;
    font-size: clamp(28px, 5vw, 40px);
    line-height: 1.1;
    color: var(--titulos);
  }
  .intro {
    max-width: 44em;
    margin: 0 0 18px;
    font-family: var(--serif);
    font-size: 17px;
    color: var(--tinta-suave);
  }
  .filtro {
    display: grid;
    gap: 12px;
  }
  .buscar {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 560px;
    height: 46px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta-suave);
  }
  .buscar:focus-within {
    border-color: var(--acento);
    box-shadow: 0 0 0 3px var(--acento-suave);
  }
  .buscar input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    font-size: 16px;
    color: var(--tinta);
  }
  .limpiar {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: var(--superficie-2);
    color: var(--tinta-suave);
  }
  .familias {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .familias button {
    --c: var(--acento);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    font-size: 14px;
    font-weight: 600;
    color: var(--tinta-suave);
  }
  .familias button.activa {
    border-color: var(--c);
    color: var(--tinta);
    background: color-mix(in srgb, var(--c) 12%, var(--superficie));
  }
  .familias i,
  h2 i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: var(--c);
  }
  .grupo {
    margin-top: 30px;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 12px;
    font-size: 19px;
    color: var(--titulos);
  }
  .tarjetas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tarjeta {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 100%;
    padding: 14px;
    border: 1px solid var(--linea-suave);
    border-radius: 14px;
    background: var(--superficie);
    color: inherit;
    text-decoration: none;
    box-shadow: var(--sombra);
    transition:
      border-color 0.15s,
      transform 0.15s;
  }
  .tarjeta:hover {
    border-color: var(--c);
    transform: translateY(-1px);
  }
  .arte {
    flex: none;
    display: grid;
    place-items: center;
    width: 112px;
    height: 76px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--c) 8%, var(--superficie-2));
    color: var(--tinta);
  }
  .arte :global(.simbolo) {
    --c: var(--c);
  }
  .txt {
    display: grid;
    gap: 3px;
    min-width: 0;
  }
  .tit {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--titulos);
  }
  .res {
    font-size: 14px;
    line-height: 1.35;
    color: var(--tinta-suave);
  }
  .secs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
  }
  .secs b {
    padding: 1px 7px;
    border-radius: 6px;
    background: var(--superficie-2);
    font-size: 12px;
    font-weight: 700;
    color: var(--tinta-suave);
    font-variant-numeric: tabular-nums;
  }
  .nada {
    margin-top: 30px;
    color: var(--tinta-suave);
  }
  @media (max-width: 420px) {
    .arte {
      width: 84px;
      height: 64px;
    }
    .arte :global(svg) {
      width: 80px;
      height: auto;
    }
  }
  @media (pointer: coarse) {
    .familias button {
      min-height: 44px;
    }
    .limpiar {
      width: 40px;
      height: 40px;
    }
  }
</style>
