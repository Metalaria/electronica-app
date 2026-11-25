<script lang="ts">
  // Start page (0.11; 2.1 rows of «Para hoy también»): the thematic course of the chapter being studied and the level.
  //  - «Prueba de nivel» (#/cursos/<id>/prueba) while that course is not started and its test has not been taken;
  //  - «Siguiente lección del curso» when the course's next lesson is not the one «Seguir» already continues;
  //  - the level with its XP («Nivel 3 · …», «240 XP · hoy +20») → «Progreso», once some XP has been earned.
  // The course itself, with its chapters, is «Su curso» (SuCurso.svelte).
  import { onMount } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { progresoXp, cargarProgresoXp } from '../../lib/aprendizaje/progreso.svelte';
  import { cargarCursos, estadoCursos } from '../../lib/aprendizaje/cursos-estado.svelte';
  import { CURSOS, cursosDeParte } from '../../lib/aprendizaje/cursos';
  import { cargarLecciones, progresoLecciones } from '../../lib/lecciones.svelte';
  import { avanceCurso } from '../cursos/avance.svelte';
  import Fila from './Fila.svelte';

  let { parte = '', hrefSeguir = '' }: { parte?: string; hrefSeguir?: string } = $props();

  const nivel = $derived(progresoXp.nivel);
  /** The course of the chapter being studied (the first one when a chapter is in two), else the first course. */
  const curso = $derived(cursosDeParte(parte)[0] ?? CURSOS[0]!);
  const listo = $derived(estadoCursos.listo && progresoLecciones.listo);
  const avance = $derived(app.indice && listo ? avanceCurso(curso, app.indice) : null);
  const prueba = $derived(!!avance && !avance.empezado && !curso.unidades && !estadoCursos.pruebas[curso.id]);
  /** The course's next lesson, when «Seguir» goes somewhere else. */
  const siguiente = $derived(avance?.empezado && avance.href && avance.siguiente && avance.href !== hrefSeguir ? avance.siguiente : null);

  onMount(() => {
    void cargarProgresoXp();
    void cargarCursos();
    void cargarLecciones();
  });
</script>

{#if prueba}
  <Fila
    href={`#/cursos/${curso.id}/prueba`}
    titulo="Prueba de nivel"
    detalle={`${curso.nombre} · para saber por dónde empezar`}
    data-prueba-nivel-inicio={curso.id}
  />
{/if}
{#if siguiente && avance?.href}
  <Fila
    href={avance.href}
    titulo="Siguiente lección del curso"
    detalle={`${curso.nombre} · ${siguiente.num ? `${siguiente.num} ` : ''}${siguiente.titulo}`}
    data-continuar-curso-inicio
  />
{/if}
{#if progresoXp.total > 0}
  <Fila
    href="#/progreso"
    titulo={`Nivel ${nivel.nivel} · ${nivel.nombre}`}
    detalle={`${progresoXp.total} XP${progresoXp.hoy ? ` · hoy +${progresoXp.hoy}` : ''}`}
    clase="nivel-inicio"
    data-nivel-inicio={nivel.nivel}
    data-ir-progreso
  />
{/if}
