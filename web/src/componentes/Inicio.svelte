<script lang="ts">
  // Start page (2.1, the approved mock-ups Inicio.png and InicioMovil.png): on the left «Seguir» (the lesson or the
  // reading to continue, with the section's visual), «Hoy» (today's goal and the streak, two figures) and «Para hoy
  // también» (hairline rows: the problem of the day, the review, and whatever else applies today — failed questions,
  // lessons to review, smart practice, failed exercises, the placement test, the course's next lesson, the level);
  // on the right «Su curso · …», the chapters of the course being studied. One column under 900 px of content (the
  // course goes last). No greeting and no book index here (the index lives in the «Libro» group).
  // (What 0.9–2.0 showed and where it went: the path of the volume → «Su curso»; the reading and exercise progress →
  // «Progreso»; the shortcuts → the five groups of the navigation; the 7-day streak row → «Progreso».)
  import { onMount } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { ruta } from '../lib/ruta.svelte';
  import Seguir from './inicio/Seguir.svelte';
  import Hoy from './inicio/Hoy.svelte';
  import ProblemaInicio from './inicio/ProblemaInicio.svelte';
  import RepasoHoy from './inicio/RepasoHoy.svelte';
  import RepasoCamino from './inicio/RepasoCamino.svelte';
  import PracticaInicio from './inicio/PracticaInicio.svelte';
  import EjerciciosInicio from './inicio/EjerciciosInicio.svelte';
  import NivelInicio from './inicio/NivelInicio.svelte';
  import SuCurso from './inicio/SuCurso.svelte';
  import { destinoActual } from './inicio/destino.svelte';

  const destino = $derived(destinoActual());

  onMount(() => {
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
  });
</script>

<svelte:head><title>Electrónica Práctica Avanzada</title></svelte:head>

<div class="inicio pagina21" data-inicio21>
  <h1 class="solo-lector">Inicio</h1>

  {#if app.modo === 'muestra'}
    <p class="aviso21 mal muestra">
      Se está mostrando el <strong>contenido de muestra</strong>. Para ver el libro completo, genere
      <code>web/public/libro/</code> con <code>python3 contenido/generar.py</code>.
    </p>
  {/if}

  <div class="columnas">
    <div class="secciones21 izquierda">
      <Seguir />
      <Hoy />
      <section class="seccion21 para-hoy" aria-labelledby="tit-para-hoy">
        <h2 class="etiqueta21" id="tit-para-hoy">Para hoy también</h2>
        <ul class="filas21">
          <ProblemaInicio />
          <RepasoHoy />
          <RepasoCamino />
          <PracticaInicio />
          <EjerciciosInicio />
          <NivelInicio parte={destino?.parte ?? ''} hrefSeguir={destino?.href ?? ''} />
        </ul>
      </section>
    </div>
    <SuCurso actual={destino?.parte ?? ''} />
  </div>
</div>

<style>
  .inicio {
    container: inicio / inline-size;
    font-family: var(--v11-texto);
    color: var(--v11-tinta);
  }
  @media (min-width: 600px) {
    .inicio {
      padding-top: var(--e21-6);
    }
  }
  .muestra {
    max-width: 44em;
    margin-bottom: var(--e21-4);
  }
  .muestra code {
    font-family: var(--mono);
    font-size: 0.9em;
  }
  .columnas {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--e21-6);
  }
  /* the mock-up's two columns (1.35 : 1) once the content is wide enough */
  @container inicio (min-width: 900px) {
    .columnas {
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .para-hoy {
    gap: 4px;
  }
  .para-hoy :global(.etiqueta21) {
    margin-bottom: 12px;
  }
  /* the phone's tighter rhythm (InicioMovil.png: 32 between sections, 12 under a label) */
  @container inicio (max-width: 599px) {
    .columnas,
    .izquierda {
      gap: var(--e21-4);
    }
    .izquierda :global(.seccion21) {
      gap: 12px;
    }
    .izquierda .para-hoy {
      gap: 0;
    }
    .para-hoy :global(.etiqueta21) {
      margin-bottom: 4px;
    }
  }
</style>
