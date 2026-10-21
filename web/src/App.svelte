<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/estado.svelte';
  import { ruta, iniciarRuta } from './lib/ruta.svelte';
  import { usuario, cargarUsuario, volcar } from './lib/usuario.svelte';
  import { iniciar } from './lib/datos';
  import { cargarRefsSpice } from './simulador/datos.svelte';
  import { acentos, type TemaEfectivo } from './lib/color';
  import { abrirBuscador, cerrarLateral } from './lib/acciones';
  import Lateral from './componentes/Lateral.svelte';
  import Barra from './componentes/Barra.svelte';
  import Inicio from './componentes/Inicio.svelte';
  import Lector from './componentes/Lector.svelte';
  import Glosario from './componentes/Glosario.svelte';
  import Marcadores from './componentes/Marcadores.svelte';
  import Busqueda from './componentes/Busqueda.svelte';
  import VisorFigura from './componentes/VisorFigura.svelte';

  let oscuroSistema = $state(false);

  // Effective theme.
  const tema: TemaEfectivo = $derived(
    usuario.prefs.tema === 'auto' ? (oscuroSistema ? 'oscuro' : 'claro') : usuario.prefs.tema,
  );

  // Accent colour: the part on screen, the glossary's, or the book's navy.
  const color = $derived.by(() => {
    if (ruta.vista === 'parte' || ruta.vista === 'glosario') return app.indice?.partes[ruta.parte]?.color ?? app.color;
    return '1A3A5C';
  });

  $effect(() => {
    app.tema = tema;
    const raiz = document.documentElement;
    raiz.dataset.tema = tema;
    const vars = acentos(color, tema);
    for (const [k, v] of Object.entries(vars)) raiz.style.setProperty(k, v);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', tema === 'oscuro' ? '#16191d' : tema === 'sepia' ? '#f5ecd9' : '#fcfbf8');
  });

  $effect(() => {
    document.documentElement.style.setProperty('--tam', `${usuario.prefs.tam}px`);
  });

  // No page scroll under an overlay.
  $effect(() => {
    const bloquear = app.buscador || !!app.figura || (app.movil && app.lateral);
    document.documentElement.classList.toggle('bloqueado', bloquear);
  });

  // Leaving phone layout closes the drawer.
  $effect(() => {
    if (!app.movil && app.lateral) cerrarLateral();
  });

  function teclas(ev: KeyboardEvent) {
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      abrirBuscador();
      return;
    }
    const enCampo = (ev.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]');
    if (!enCampo && !mod && !ev.altKey && ev.key === '/') {
      ev.preventDefault();
      abrirBuscador();
    }
  }

  onMount(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    oscuroSistema = mq.matches;
    const cambioTema = (e: MediaQueryListEvent) => (oscuroSistema = e.matches);
    mq.addEventListener('change', cambioTema);

    const mqMovil = window.matchMedia('(max-width: 1023px)');
    app.movil = mqMovil.matches;
    const cambioMovil = (e: MediaQueryListEvent) => (app.movil = e.matches);
    mqMovil.addEventListener('change', cambioMovil);

    const ocultar = () => {
      if (document.visibilityState === 'hidden') volcar();
    };
    document.addEventListener('visibilitychange', ocultar);
    window.addEventListener('pagehide', volcar);

    iniciarRuta();
    Promise.all([iniciar(), cargarUsuario()])
      .then(([datos]) => {
        app.indice = datos.indice;
        app.refs = datos.refs;
        app.modo = datos.modo;
        app.cargado = true;
        // The map of «Simular» buttons, once the reader is up and idle.
        const pedir = () => void cargarRefsSpice();
        if ('requestIdleCallback' in window) window.requestIdleCallback(pedir, { timeout: 3000 });
        else setTimeout(pedir, 1200);
      })
      .catch((e: unknown) => {
        app.error = e instanceof Error ? e.message : String(e);
      });

    return () => {
      mq.removeEventListener('change', cambioTema);
      mqMovil.removeEventListener('change', cambioMovil);
      document.removeEventListener('visibilitychange', ocultar);
      window.removeEventListener('pagehide', volcar);
    };
  });
</script>

<svelte:window onkeydown={teclas} />

<div class="app" class:movil={app.movil}>
  {#if app.cargado}
    <Lateral />
  {/if}
  <div class="principal">
    <Barra />
    <main id="contenido">
      {#if app.error}
        <div class="aviso">
          <h1>No se pudo abrir el libro</h1>
          <p>{app.error}</p>
        </div>
      {:else if !app.cargado || !usuario.listo}
        <div class="cargando" aria-live="polite"><span class="punto"></span> Abriendo el libro…</div>
      {:else if ruta.vista === 'inicio'}
        <Inicio />
      {:else if ruta.vista === 'glosario'}
        <Glosario />
      {:else if ruta.vista === 'marcadores'}
        <Marcadores />
      {:else if ruta.vista === 'simulador'}
        <!-- Loaded on demand: the reader's start-up does not include the simulator. -->
        {#await import('./componentes/simulador/Simulador.svelte')}
          <div class="cargando" aria-live="polite"><span class="punto"></span> Abriendo el simulador…</div>
        {:then m}
          <m.default />
        {:catch e}
          <div class="aviso"><h1>No se pudo abrir el simulador</h1><p>{String(e)}</p></div>
        {/await}
      {:else if ruta.vista === 'componentes'}
        <!-- Component animations, also loaded on demand. -->
        {#await import('./componentes/Componentes.svelte')}
          <div class="cargando" aria-live="polite"><span class="punto"></span> Abriendo las animaciones…</div>
        {:then m}
          <m.default />
        {:catch e}
          <div class="aviso"><h1>No se pudieron abrir las animaciones</h1><p>{String(e)}</p></div>
        {/await}
      {:else}
        {#key ruta.parte}
          <Lector parte={ruta.parte} />
        {/key}
      {/if}
    </main>
  </div>
</div>

{#if app.cargado}
  <Busqueda />
{/if}
{#if app.figura}
  <VisorFigura />
{/if}

<style>
  .app {
    min-height: 100vh;
    min-height: 100dvh;
  }
  .principal {
    margin-left: var(--ancho-lateral);
    min-width: 0;
  }
  .app.movil .principal {
    margin-left: 0;
  }
  main {
    min-height: calc(100vh - var(--alto-barra));
    padding-bottom: env(safe-area-inset-bottom);
  }
  .cargando {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 30vh 20px;
    color: var(--tinta-suave);
    font-family: var(--sans);
  }
  .punto {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--acento);
    animation: latido 1s ease-in-out infinite;
  }
  @keyframes latido {
    50% {
      opacity: 0.25;
      transform: scale(0.7);
    }
  }
  .aviso {
    max-width: 36em;
    margin: 18vh auto;
    padding: 0 20px;
    font-family: var(--sans);
  }
  .aviso h1 {
    color: var(--titulos);
  }
</style>
