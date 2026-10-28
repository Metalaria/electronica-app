<script lang="ts">
  // «Componentes 3D»: the catalogue of every procedural model, grouped by family, with an accent-insensitive
  // filter and thumbnails: the WebP images pre-rendered by scripts/miniaturas.mjs (transparent, the card's
  // studio colour of each theme shows through), requested when a card is about to be seen. Only when one is
  // missing (a model added without running the script) is it drawn on this device, by the shared off-screen
  // renderer of miniaturas.ts (one WebGL context for the whole page).
  import { onMount } from 'svelte';
  import Search from '@lucide/svelte/icons/search';
  import X from '@lucide/svelte/icons/x';
  import Scissors from '@lucide/svelte/icons/scissors';
  import { MODELOS_3D, FAMILIAS_3D, type Modelo3D } from './catalogo3d';
  import { referencia } from '../animaciones/referencias';
  import { normalizar } from '../../lib/datos';
  import { ruta } from '../../lib/ruta.svelte';
  import { soporteWebGL2 } from './motor/soporte';
  import { urlModelo3d } from '../miniaturas/datos';
  import { visible } from '../miniaturas/visible';
  import Conmutador from './Conmutador.svelte';

  let consulta = $state('');
  let familia = $state('');
  /** Cards seen (their image is requested), pre-rendered images that failed, thumbnails drawn here. */
  let vistos = $state<Record<string, boolean>>({});
  let fallidos = $state<Record<string, boolean>>({});
  let dibujadas = $state<Record<string, string | null>>({});
  let sinWebGL = $state(false);
  let vivo = true;

  const filtrados = $derived.by(() => {
    const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
    return MODELOS_3D.filter((m) => {
      if (familia && m.familia !== familia) return false;
      if (!palabras.length) return true;
      const nums = m.libro.map((l) => referencia(l)?.num ?? '').join(' ');
      const texto = normalizar(`${m.nombre} ${m.encapsulado} ${m.resumen} ${m.tipo} ${nums} ${m.kicad.join(' ')}`);
      return palabras.every((p) => texto.includes(p));
    });
  });
  const grupos = $derived(FAMILIAS_3D.map((f) => ({ ...f, items: filtrados.filter((m) => m.familia === f.id) })).filter((g) => g.items.length));

  function secciones(m: Modelo3D): string[] {
    return m.libro
      .map((l) => referencia(l))
      .filter((r) => r && (r.tipo === 'sec' || r.tipo === 'subsec'))
      .slice(0, 3)
      .map((r) => r!.num);
  }

  // Fallback for a missing pre-rendered image: drawn here, transparent like the files (so it does not depend
  // on the theme), queued in miniaturas.ts, which renders one at a time and keeps the object URLs.
  async function dibujar(m: Modelo3D): Promise<void> {
    fallidos[m.tipo] = true;
    if (!soporteWebGL2()) {
      sinWebGL = true;
      dibujadas[m.tipo] = null;
      return;
    }
    try {
      const { miniatura } = await import('./miniaturas');
      const url = await miniatura(m.tipo, m.defecto, m.montaje, null, false);
      if (vivo) dibujadas[m.tipo] = url;
    } catch {
      if (vivo) dibujadas[m.tipo] = null;
    }
  }

  onMount(() => {
    sinWebGL = !soporteWebGL2();
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
    return () => {
      vivo = false;
    };
  });
</script>

<svelte:head><title>Componentes 3D · Electrónica Práctica Avanzada</title></svelte:head>

<div class="catalogo3d">
  <header>
    <div class="fila">
      <p class="sobre">Componentes en 3D</p>
      <Conmutador />
    </div>
    <h1>Cómo son por fuera y por dentro</h1>
    <p class="intro">
      {MODELOS_3D.length} modelos tridimensionales de los componentes del libro, generados con sus medidas reales:
      gíralos, córtalos o sepáralos en piezas para ver la película de una resistencia, las láminas de un electrolítico
      o el dado de un transistor, con el nombre de cada parte y la sección que la explica.
    </p>
    <div class="filtro">
      <label class="buscar">
        <Search size={18} strokeWidth={2} aria-hidden="true" />
        <span class="solo-lector">Buscar modelo</span>
        <input type="search" placeholder="Buscar: MLCC, TO-220, SOIC, 5.4…" bind:value={consulta} />
        {#if consulta}
          <button type="button" class="limpiar" aria-label="Borrar la búsqueda" onclick={() => (consulta = '')}><X size={16} /></button>
        {/if}
      </label>
      <div class="familias" role="group" aria-label="Familias">
        <button type="button" class:activa={familia === ''} onclick={() => (familia = '')}>Todas</button>
        {#each FAMILIAS_3D as f (f.id)}
          <button type="button" class:activa={familia === f.id} style:--c={f.color} onclick={() => (familia = familia === f.id ? '' : f.id)}><i></i>{f.nombre}</button>
        {/each}
      </div>
    </div>
    {#if sinWebGL}<p class="aviso">Este dispositivo no ofrece WebGL 2: los modelos no se pueden mostrar en 3D aquí.</p>{/if}
  </header>

  {#each grupos as g (g.id)}
    <section class="grupo" style:--c={g.color}>
      <h2><i></i>{g.nombre}</h2>
      <ul class="tarjetas">
        {#each g.items as m (m.tipo)}
          <li>
            <a class="tarjeta" href={`#/componentes/3d/${m.tipo}`} data-tipo={m.tipo}>
              <span class="arte" data-miniatura="modelo" use:visible={() => (vistos[m.tipo] = true)}>
                {#if dibujadas[m.tipo]}
                  <img src={dibujadas[m.tipo]} alt="" width="384" height="288" decoding="async" />
                {:else if vistos[m.tipo] && !fallidos[m.tipo]}
                  <img src={urlModelo3d(m.tipo)} alt="" width="384" height="288" loading="lazy" decoding="async" onerror={() => dibujar(m)} />
                {:else if dibujadas[m.tipo] === null}
                  <span class="hueco">{m.encapsulado}</span>
                {/if}
              </span>
              <span class="txt">
                <span class="tit">{m.nombre}</span>
                <span class="enc">{m.encapsulado}</span>
                <span class="res">{m.resumen}</span>
                <span class="pie">
                  {#if m.interior}<span class="dentro"><Scissors size={13} strokeWidth={2.2} aria-hidden="true" /> Por dentro</span>{/if}
                  {#each secciones(m) as n (n)}<b>{n}</b>{/each}
                </span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="nada">Ningún modelo coincide con «{consulta}».</p>
  {/each}
</div>

<style>
  .catalogo3d {
    --fondo-3d: #eeece6;
    max-width: 1120px;
    margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 40px) 72px;
    font-family: var(--sans);
  }
  :global([data-tema='sepia']) .catalogo3d {
    --fondo-3d: #ece2cc;
  }
  :global([data-tema='oscuro']) .catalogo3d {
    --fondo-3d: #23272e;
  }
  header {
    padding: clamp(20px, 5vw, 44px) 0 8px;
  }
  .fila {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
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
    max-width: 46em;
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
    max-width: 460px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta-suave);
  }
  .buscar input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--tinta);
    font: inherit;
    font-size: 16px;
  }
  .limpiar {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: transparent;
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
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .familias button i {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    background: var(--c);
  }
  .familias button.activa {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, var(--superficie));
  }
  .aviso {
    margin: 14px 0 0;
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
  }
  .grupo {
    margin-top: 30px;
  }
  .grupo h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 12px;
    font-size: 19px;
    color: var(--titulos);
  }
  .grupo h2 i {
    width: 12px;
    height: 12px;
    border-radius: 4px;
    background: var(--c);
  }
  .tarjetas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tarjeta {
    display: flex;
    flex-direction: column;
    height: 100%;
    border: 1px solid var(--linea);
    border-radius: 14px;
    overflow: hidden;
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  .tarjeta:hover {
    border-color: var(--c);
    box-shadow: var(--sombra);
  }
  .arte {
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 4 / 3;
    background: var(--fondo-3d);
  }
  .arte img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hueco {
    padding: 12px;
    color: var(--tinta-tenue);
    font-size: 13px;
    text-align: center;
  }
  .txt {
    display: grid;
    gap: 3px;
    padding: 10px 14px 12px;
  }
  .tit {
    font-size: 16px;
    font-weight: 700;
    color: var(--titulos);
  }
  .enc {
    font-size: 13px;
    font-weight: 600;
    color: var(--c);
  }
  .res {
    font-family: var(--serif);
    font-size: 14.5px;
    line-height: 1.35;
    color: var(--tinta-suave);
  }
  .pie {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-size: 12.5px;
  }
  .pie b {
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-variant-numeric: tabular-nums;
  }
  .dentro {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
  }
  .nada {
    padding: 40px 0;
    color: var(--tinta-suave);
  }
  @media (max-width: 520px) {
    .tarjetas {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .res {
      display: none;
    }
    .txt {
      padding: 8px 10px 10px;
    }
    .tit {
      font-size: 14.5px;
    }
  }
</style>
