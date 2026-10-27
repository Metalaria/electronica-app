<script lang="ts">
  // «Consolas» view: seven mainboards (NES, Neo Geo AES, Master System II, Mega Drive, Game Boy, Game Boy Color, Super Nintendo)
  // in three linked views (photo, architecture, schematic) plus sources, the boards and «Un fotograma». Route: #/consolas/<maquina>/<pestana>[/<seleccion>] (see estado.svelte.ts).
  import { untrack } from 'svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { cargarMaquina, type DatosMaquina, type IdMaquina } from './datos';
  import { enlace, leerAncla, PESTANAS, type Pestana, type Seleccion } from './estado.svelte';
  import { cargarArquitectura } from './arquitectura/maquinas';
  import Foto from './Foto.svelte';
  import Fuentes from './Fuentes.svelte';
  import { tienePlaca } from './placa/datos';

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

  // «Placa en 3D / 2D» only for the machines with a board
  const disponible = (m: IdMaquina, p: Pestana) => (p === 'placa3d' || p === 'placa2d' ? tienePlaca(m) : true);
  const pestanas = $derived(PESTANAS.filter((p) => disponible(actual.maquina, p.id)));
  const pestana = $derived(pestanas.some((p) => p.id === actual.pestana) ? actual.pestana : 'foto');

  const MAQUINAS: { id: IdMaquina; titulo: string; placa: string }[] = [
    { id: 'nes', titulo: 'NES', placa: 'NES-CPU-07 · 1987' },
    { id: 'neogeo', titulo: 'Neo Geo AES', placa: 'NEO-AES · 1990' },
    { id: 'sms', titulo: 'Master System II', placa: '171-5922A · 1990' },
    { id: 'megadrive', titulo: 'Mega Drive', placa: 'Modelo 1 VA6.8 PAL · 1993' },
    { id: 'gb', titulo: 'Game Boy', placa: 'DMG-CPU-05/06 · 1989' },
    { id: 'gbc', titulo: 'Game Boy Color', placa: 'CGB-CPU-04 · 1999' },
    { id: 'snes', titulo: 'Super Nintendo', placa: 'SNSP-CPU-01 PAL · 1992' },
  ];
</script>

<svelte:head><title>Consolas · Electrónica Práctica Avanzada</title></svelte:head>

<div class="consolas">
  <header>
    <div class="titulo">
      <h1>Consolas</h1>
      <p>Las placas base de las figuras 36.16 y 36.22 y otras cinco consolas: foto interactiva, arquitectura animada, esquema real y, donde hay placa publicada, la placa en 3D.</p>
    </div>
    <nav class="maquinas" aria-label="Consola">
      {#each MAQUINAS as m (m.id)}
        <a href={href(m.id, disponible(m.id, actual.pestana) ? actual.pestana : 'foto')} aria-current={actual.maquina === m.id ? 'page' : undefined}>
          <strong>{m.titulo}</strong><small>{m.placa}</small>
        </a>
      {/each}
    </nav>
  </header>

  <nav class="pestanas" aria-label="Vista">
    {#each pestanas as p (p.id)}
      <a href={enlace(actual.maquina, p.id, sel)} aria-current={pestana === p.id ? 'page' : undefined}>{p.titulo}</a>
    {/each}
  </nav>

  {#if error}
    <div class="aviso"><p>No se pudieron cargar los datos: {error}</p></div>
  {:else if !datos || datos.id !== actual.maquina}
    <div class="cargando">Cargando…</div>
  {:else if pestana === 'foto'}
    <Foto {datos} {sel} {seleccionar} {irA} />
  {:else if pestana === 'arquitectura'}
    {#await Promise.all([import('./arquitectura/Arquitectura.svelte'), cargarArquitectura(datos.id)])}
      <div class="cargando">Cargando…</div>
    {:then [m, maquina]}
      {#key datos.id}<m.default {datos} {maquina} {sel} {seleccionar} {irA} />{/key}
    {/await}
  {:else if pestana === 'fotograma'}
    <!-- «Un fotograma»: how one pixel of a frame comes to exist, step by step, loaded only when the tab opens. -->
    {#await import('./fotograma/Fotograma.svelte')}
      <div class="cargando">Cargando…</div>
    {:then m}
      {#key datos.id}<m.default {datos} />{/key}
    {:catch e}
      <div class="aviso"><p>No se pudo abrir «Un fotograma»: {String(e)}</p></div>
    {/await}
  {:else if pestana === 'esquema'}
    {#await import('./esquema/Esquema.svelte') then m}
      {#key datos.id}<m.default {datos} {sel} {seleccionar} {irA} />{/key}
    {/await}
  {:else if pestana === 'placa3d' || pestana === 'placa2d'}
    <!-- The mainboard in the «Proyectos KiCad» viewer (contenido/consolas_pcb.py), loaded on demand. -->
    {#await import('./placa/PlacaConsola.svelte')}
      <div class="cargando">Cargando…</div>
    {:then m}
      {#key datos.id}<m.default {datos} vista={pestana === 'placa3d' ? '3d' : '2d'} {sel} {seleccionar} {irA} />{/key}
    {:catch e}
      <div class="aviso"><p>No se pudo abrir la placa: {String(e)}</p></div>
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
  /* 0.9 look (componentes/ui09): serif title, segmented machine picker with 14–18 px radii */
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 30px;
    font-weight: 700;
    line-height: 1.15;
  }
  .titulo p {
    margin: 2px 0 0;
    color: var(--tinta-suave);
  }
  .maquinas {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
    width: 100%;
    padding: 4px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta);
    background: var(--superficie-2);
  }
  .maquinas a {
    display: grid;
    align-content: center;
    min-width: 0;
    min-height: 44px;
    padding: 5px 14px;
    border-radius: 14px;
    color: var(--tinta);
    text-decoration: none;
    line-height: 1.2;
  }
  .maquinas a strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .maquinas a small {
    overflow: hidden;
    color: var(--tinta-suave);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
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
      padding: 16px 16px 40px;
    }
    h1 {
      font-size: 26px;
    }
    .maquinas {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .maquinas a {
      padding: 5px 10px;
    }
  }
  @media (min-width: 600px) and (max-width: 1099px) {
    .maquinas {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
</style>
