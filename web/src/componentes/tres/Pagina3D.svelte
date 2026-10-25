<script lang="ts">
  // Page of one 3D model (#/componentes/3d/<tipo>[?parámetros]): the viewer, its parameters, the package
  // data (dimensions, pads), the book sections and the animations of the same component.
  import { onMount } from 'svelte';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Play from '@lucide/svelte/icons/circle-play';
  import CornerUpLeft from '@lucide/svelte/icons/corner-up-left';
  import { MODELOS_3D, FAMILIAS_3D, modelo3d } from './catalogo3d';
  import { leerValor } from './modelos/codigos';
  import type { Parametros } from './modelos/tipos';
  import { referencia } from '../animaciones/referencias';
  import { animacion } from '../animaciones/catalogo';
  import { ruta, prepararSalto, volver } from '../../lib/ruta.svelte';
  import { ponerVista } from './compartir.svelte';
  import Vista3D from './Vista3D.svelte';
  import ControlesModelo from './ControlesModelo.svelte';

  let { ancla }: { ancla: string } = $props();

  const tipo = $derived(ancla.split('?')[0] ?? '');
  const m = $derived(modelo3d(tipo));
  const fam = $derived(m ? FAMILIAS_3D.find((f) => f.id === m.familia) : undefined);
  const refs = $derived((m?.libro ?? []).map((l) => referencia(l)).filter((r) => r !== null));
  const anims = $derived((m?.animaciones ?? []).map((id) => animacion(id)).filter((a) => !!a));
  const pos = $derived(MODELOS_3D.findIndex((x) => x.tipo === tipo));
  const anterior = $derived(pos > 0 ? MODELOS_3D[pos - 1] : undefined);
  const siguiente = $derived(pos >= 0 && pos < MODELOS_3D.length - 1 ? MODELOS_3D[pos + 1] : undefined);

  function inicial(): Parametros {
    const base: Parametros = { ...(m?.defecto ?? {}) };
    const q = ancla.split('?')[1];
    if (q)
      for (const [k, v] of new URLSearchParams(q)) {
        const d = base[k];
        base[k] = typeof d === 'number' ? leerValor(v, d) : typeof d === 'boolean' ? v === 'true' : v;
      }
    return base;
  }

  let parametros = $state<Parametros>({});
  let montaje = $state<'placa' | 'suelto'>('placa');
  $effect.pre(() => {
    void ancla;
    parametros = inicial();
    montaje = m?.montaje ?? 'placa';
  });

  let fallo = $state('');

  function irAlLibro(): void {
    prepararSalto({ texto: m ? `Volver a ${m.nombre}` : 'Volver al modelo 3D' });
  }

  onMount(() => {
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
  });
</script>

<svelte:head><title>{m ? `${m.nombre} · Componentes 3D` : 'Componentes 3D'} · Electrónica Práctica Avanzada</title></svelte:head>

<div class="pagina3d" style:--c={fam?.color}>
  {#if !m}
    <div class="aviso">
      <h1>No existe ese modelo</h1>
      <p><a href="#/componentes">Ver todos los modelos</a></p>
    </div>
  {:else}
    <nav class="migas" aria-label="Ruta">
      <a href="#/componentes" onclick={() => ponerVista('3d')}><ArrowLeft size={16} strokeWidth={2.2} /> Componentes 3D</a>
      <span aria-hidden="true">·</span>
      <span class="fam"><i></i>{fam?.nombre}</span>
    </nav>
    <h1>{m.nombre}</h1>
    <p class="resumen">{m.resumen}</p>

    <div class="cuerpo">
      <div class="col-a">
        <Vista3D {tipo} {parametros} {montaje} nombre={m.nombre} alFallar={(e) => (fallo = e)} />
        {#if fallo && anims.length}
          <p class="nota">Puedes ver cómo funciona en la animación 2D: <a href={`#/componentes/${anims[0]!.id}`} onclick={() => ponerVista('2d')}>{anims[0]!.titulo}</a>.</p>
        {/if}
      </div>
      <aside class="col-b">
        <div class="panel">
          <p class="enc">{m.encapsulado}</p>
          <ControlesModelo controles={m.controles} bind:parametros />
          {#if m.kicad.length}
            <label class="montaje">
              <input type="checkbox" checked={montaje === 'placa'} onchange={(e) => (montaje = e.currentTarget.checked ? 'placa' : 'suelto')} />
              <span>Patillas dobladas como en la placa</span>
            </label>
          {/if}
        </div>
        {#if anims.length}
          <div class="bloque">
            <span class="et"><Play size={16} strokeWidth={2} /> Cómo funciona</span>
            <ul>
              {#each anims as a (a!.id)}
                <li><a href={`#/componentes/${a!.id}`} onclick={() => ponerVista('2d')}>{a!.titulo}</a></li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if refs.length}
          <div class="bloque">
            <span class="et"><BookOpen size={16} strokeWidth={2} /> En el libro</span>
            <ul>
              {#each refs as r (r.label)}
                <li><a href={r.href} onclick={irAlLibro}><b>{r.num}</b>{#if r.titulo}<span>{r.titulo}</span>{/if}</a></li>
              {/each}
            </ul>
          </div>
        {/if}
        <p class="kicad">Huella KiCad: <code>{m.kicad[0]}</code></p>
      </aside>
    </div>

    <nav class="vecinos" aria-label="Otros modelos">
      {#if anterior}
        <a href={`#/componentes/3d/${anterior.tipo}`}><ChevronLeft size={18} /><span><small>Anterior</small>{anterior.nombre}</span></a>
      {:else}<span></span>{/if}
      {#if siguiente}
        <a href={`#/componentes/3d/${siguiente.tipo}`} class="sig"><span><small>Siguiente</small>{siguiente.nombre}</span><ChevronRight size={18} /></a>
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
  .pagina3d {
    --c: var(--acento);
    max-width: 1240px;
    margin: 0 auto;
    padding: 18px clamp(16px, 3vw, 32px) 80px;
    font-family: var(--sans);
    container-type: inline-size;
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
    min-height: 32px;
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
    margin: 0 0 14px;
    font-family: var(--serif);
    font-size: 17px;
    color: var(--tinta-suave);
  }
  .cuerpo {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  @container (min-width: 900px) {
    .cuerpo {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr);
      align-items: start;
      gap: 22px;
    }
    .col-b {
      position: sticky;
      top: calc(var(--alto-barra) + 12px);
    }
  }
  .col-b {
    display: grid;
    gap: 14px;
  }
  .panel {
    display: grid;
    gap: 14px;
    padding: 14px;
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: 0 0 0 1px var(--linea-suave);
  }
  .enc {
    margin: 0;
    font-weight: 700;
    color: var(--c);
  }
  .montaje {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    font-size: 14.5px;
    font-weight: 600;
  }
  .montaje input {
    width: 20px;
    height: 20px;
    accent-color: var(--acento);
  }
  .bloque .et {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--tinta-suave);
  }
  .bloque ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
  }
  .bloque a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-height: 34px;
    padding: 4px 11px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 13.5px;
    text-decoration: none;
  }
  .bloque a:hover {
    border-color: var(--acento);
  }
  .bloque b {
    color: var(--acento);
    white-space: nowrap;
  }
  .bloque a span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 20em;
  }
  .kicad {
    margin: 0;
    font-size: 12.5px;
    color: var(--tinta-tenue);
    overflow-wrap: anywhere;
  }
  .nota {
    margin: 10px 0 0;
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
    min-height: 44px;
    padding: 10px 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    font-weight: 600;
    text-decoration: none;
  }
  .vecinos span {
    display: grid;
  }
  .vecinos .sig span {
    text-align: right;
  }
  .vecinos small {
    font-size: 12px;
    color: var(--tinta-suave);
  }
  .aviso {
    padding: 18vh 0;
    text-align: center;
  }
  .volver {
    position: fixed;
    left: 50%;
    bottom: calc(18px + var(--hueco-inferior));
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
    .bloque a {
      min-height: 44px;
    }
  }
</style>
