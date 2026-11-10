<script lang="ts">
  // Start page (0.11): the level with its XP bar (the XP count up when they change) and the way into the thematic
  // courses — the course of the chapter being studied with its «Continuar», or «Ver los cursos».
  import { onMount } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { progresoXp, cargarProgresoXp } from '../../lib/aprendizaje/progreso.svelte';
  import { cargarCursos } from '../../lib/aprendizaje/cursos-estado.svelte';
  import { CURSOS, cursosDeParte } from '../../lib/aprendizaje/cursos';
  import { avanceCurso } from '../cursos/avance.svelte';
  import ContadorXp from '../progreso/ContadorXp.svelte';
  import Icono from '../Icono.svelte';

  let { parte = '' }: { parte?: string } = $props();

  const nivel = $derived(progresoXp.nivel);
  /** The course of the chapter being studied (the first one when a chapter is in two), else the first course. */
  const curso = $derived(cursosDeParte(parte)[0] ?? CURSOS[0]!);
  const avance = $derived(app.indice ? avanceCurso(curso, app.indice) : null);

  onMount(() => {
    void cargarProgresoXp();
    void cargarCursos();
  });
</script>

<section class="t09-tarjeta nivel-inicio" aria-labelledby="tit-nivel-inicio" data-nivel-inicio={nivel.nivel}>
  <a class="nivel" href="#/progreso" data-ir-progreso>
    <span class="insignia" aria-hidden="true">{nivel.nivel}</span>
    <span class="datos">
      <span class="rot" id="tit-nivel-inicio">Nivel {nivel.nivel} · {nivel.nombre}</span>
      <span class="barra" aria-hidden="true"><span style:transform={`scaleX(${nivel.fraccion})`}></span></span>
      <span class="xp"><ContadorXp valor={progresoXp.total} /> XP{#if progresoXp.hoy} · hoy +{progresoXp.hoy}{/if}</span>
    </span>
  </a>
  <div class="curso">
    <span class="que">
      <span class="rot2">Curso</span>
      <span class="nombre">{curso.nombre}</span>
      {#if avance}<span class="cuanto">{avance.hechas + avance.superadas} de {avance.total} lecciones</span>{/if}
    </span>
    <span class="acciones">
      {#if avance?.href}
        <a class="t09-boton t09-contorno" href={avance.href} data-continuar-curso-inicio>{avance.empezado ? 'Continuar' : 'Empezar'}</a>
      {/if}
      <a class="todos" href="#/cursos" data-ir-cursos><Icono nombre="cursos" tam={17} /> Cursos</a>
    </span>
  </div>
</section>

<style>
  .nivel-inicio {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .nivel {
    display: flex;
    align-items: center;
    gap: 14px;
    color: var(--tinta);
    text-decoration: none;
  }
  .insignia {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--ambar);
    color: var(--sobre-ambar);
    font-size: 21px;
    font-weight: 800;
  }
  .datos {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .rot {
    color: var(--titulos);
    font-family: var(--titular);
    font-size: 19px;
    font-weight: 700;
    line-height: 1.2;
  }
  .barra {
    display: block;
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--linea);
  }
  .barra span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--ambar-relleno);
    transform-origin: left center;
    transition: transform 0.8s ease-out;
  }
  .xp {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .curso {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 14px;
    padding-top: 12px;
    border-top: 1px solid var(--linea-suave);
  }
  .que {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .rot2 {
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .nombre {
    color: var(--titulos);
    font-size: 16px;
    font-weight: 700;
  }
  .cuanto {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .acciones {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .todos {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    color: var(--acento);
    font-size: 15px;
    font-weight: 600;
  }
  @media (prefers-reduced-motion: reduce) {
    .barra span {
      transition: none;
    }
  }
</style>
