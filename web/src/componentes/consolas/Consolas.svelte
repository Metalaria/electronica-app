<script lang="ts">
  // «Consolas» view: NES and Neo Geo AES mainboards in three linked views (photo, architecture, schematic)
  // plus sources. Route: #/consolas/<maquina>/<pestana>[/<seleccion>] (see estado.svelte.ts).
  import { untrack } from 'svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { cargarMaquina, type DatosMaquina, type IdMaquina } from './datos';
  import { enlace, leerAncla, PESTANAS, type Pestana, type Seleccion } from './estado.svelte';
  import Foto from './Foto.svelte';
  import Fuentes from './Fuentes.svelte';

  const actual = $derived(leerAncla(ruta.ancla));
  let sel: Seleccion | null = $state(null);
  let datos: DatosMaquina | null = $state(null);
  let error = $state('');

  // The route sets the selection; later changes inside a tab only replace the URL.
  $effect(() => {
    void ruta.n;
    const s = actual.sel;
    untrack(() => (sel = s));
  });

  $effect(() => {
    const id = actual.maquina;
    let vivo = true;
    error = '';
    cargarMaquina(id)
      .then((d) => {
        if (vivo) datos = d;
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  function seleccionar(s: Seleccion | null): void {
    sel = s;
    history.replaceState(history.state, '', enlace(actual.maquina, actual.pestana, s));
  }

  function irA(pestana: Pestana, s: Seleccion): void {
    location.hash = enlace(actual.maquina, pestana, s);
  }

  function href(maquina: IdMaquina, pestana: Pestana): string {
    return enlace(maquina, pestana, null);
  }

  const MAQUINAS: { id: IdMaquina; titulo: string; placa: string }[] = [
    { id: 'nes', titulo: 'NES', placa: 'NES-CPU-07 · 1987' },
    { id: 'neogeo', titulo: 'Neo Geo AES', placa: 'NEO-AES · 1990' },
  ];
</script>

<svelte:head><title>Consolas · Electrónica Práctica Avanzada</title></svelte:head>

<div class="consolas">
  <header>
    <div class="titulo">
      <h1>Consolas</h1>
      <p>Las placas base de las figuras 36.16 y 36.22: foto interactiva, arquitectura animada y esquema real.</p>
    </div>
    <nav class="maquinas" aria-label="Consola">
      {#each MAQUINAS as m (m.id)}
        <a href={href(m.id, actual.pestana)} aria-current={actual.maquina === m.id ? 'page' : undefined}>
          <strong>{m.titulo}</strong><small>{m.placa}</small>
        </a>
      {/each}
    </nav>
  </header>

  <nav class="pestanas" aria-label="Vista">
    {#each PESTANAS as p (p.id)}
      <a href={enlace(actual.maquina, p.id, sel)} aria-current={actual.pestana === p.id ? 'page' : undefined}>{p.titulo}</a>
    {/each}
  </nav>

  {#if error}
    <div class="aviso"><p>No se pudieron cargar los datos: {error}</p></div>
  {:else if !datos || datos.id !== actual.maquina}
    <div class="cargando">Cargando…</div>
  {:else if actual.pestana === 'foto'}
    <Foto {datos} {sel} {seleccionar} {irA} />
  {:else if actual.pestana === 'arquitectura'}
    {#await import('./arquitectura/Arquitectura.svelte') then m}
      {#key datos.id}<m.default {datos} {sel} {seleccionar} {irA} />{/key}
    {/await}
  {:else if actual.pestana === 'esquema'}
    {#await import('./esquema/Esquema.svelte') then m}
      {#key datos.id}<m.default {datos} {sel} {seleccionar} {irA} />{/key}
    {/await}
  {:else}
    <Fuentes {datos} />
  {/if}
</div>

<style>
  .consolas {
    max-width: 1500px;
    margin: 0 auto;
    padding: 18px 20px 48px;
    display: grid;
    gap: 12px;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: end;
    gap: 10px 20px;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-size: 28px;
  }
  .titulo p {
    margin: 2px 0 0;
    color: var(--tinta-suave);
  }
  .maquinas {
    display: inline-flex;
    gap: 6px;
    padding: 4px;
    border-radius: 14px;
    background: var(--superficie-2);
  }
  .maquinas a {
    display: grid;
    min-width: 128px;
    min-height: 44px;
    padding: 5px 14px;
    border-radius: 10px;
    color: var(--tinta);
    text-decoration: none;
    line-height: 1.2;
  }
  .maquinas a small {
    color: var(--tinta-suave);
    font-size: 12px;
  }
  .maquinas a[aria-current='page'] {
    background: var(--superficie);
    box-shadow: var(--sombra);
    color: var(--acento);
  }
  .pestanas {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--linea);
    overflow-x: auto;
  }
  .pestanas a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    border-bottom: 3px solid transparent;
    color: var(--tinta-suave);
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
  }
  .pestanas a[aria-current='page'] {
    border-bottom-color: var(--acento);
    color: var(--acento);
  }
  .cargando,
  .aviso {
    padding: 30px;
    color: var(--tinta-suave);
  }
  @media (max-width: 599px) {
    .consolas {
      padding: 12px 12px 40px;
    }
    h1 {
      font-size: 24px;
    }
    .maquinas {
      width: 100%;
    }
    .maquinas a {
      flex: 1;
      min-width: 0;
    }
  }
</style>
