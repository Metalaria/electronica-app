<script lang="ts">
  // 2.1 start page, «Su curso · …» (the approved mock-up Inicio.png; it replaces 0.9's path of the volume): the chapters
  // of the thematic course of the chapter being studied (lib/aprendizaje/cursos.ts; the first course before any
  // reading), one row each — done (a tick: every section read or its lesson completed or passed), here (tinted row,
  // «Aquí · 22 secciones»), to do (its number in a ring) — each a link to the chapter in the book; then «Ver el curso
  // entero» (#/cursos/<id>).
  import { onMount } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { aprendizaje, cargarAprendizaje } from '../../lib/aprendizaje.svelte';
  import { infoParte, rotuloParte } from '../../lib/datos';
  import { corto, hrefParte } from '../../lib/navegacion.svelte';
  import { CURSOS, cursosDeParte } from '../../lib/aprendizaje/cursos';
  import { estadoLeccion } from '../cursos/avance.svelte';
  import { cargarCursos } from '../../lib/aprendizaje/cursos-estado.svelte';
  import { cargarLecciones } from '../../lib/lecciones.svelte';
  import Icono from '../Icono.svelte';

  let { actual = '' }: { actual?: string } = $props();

  const curso = $derived(cursosDeParte(actual)[0] ?? CURSOS[0]!);

  const capitulos = $derived.by(() => {
    void aprendizaje.listo;
    void app.indice;
    return curso.partes.flatMap((id, i) => {
      const p = infoParte(id);
      if (!p) return [];
      const secs = p.secciones ?? [];
      const l = aprendizaje.leidas[id];
      const leidas = secs.filter((s) => l?.[s.label]).length;
      const hechas = secs.filter((s) => {
        if (l?.[s.label]) return true;
        const e = estadoLeccion(id, s.label);
        return e === 'hecha' || e === 'superada';
      }).length;
      const num = p.num != null && p.num !== '' && (p.tipo === 'capitulo' || p.tipo === 'apendice') ? String(p.num) : String(i + 1);
      const estado: 'hecho' | 'actual' | 'pendiente' = id === actual ? 'actual' : secs.length > 0 && hechas === secs.length ? 'hecho' : 'pendiente';
      return [{ id, num, nombre: corto(p.titulo).trim(), secciones: secs.length, leidas, estado, href: p.tipo === 'consola' ? `#/cursos/${curso.id}` : hrefParte(id) }];
    });
  });

  function etiqueta(c: (typeof capitulos)[number]): string {
    const base = c.estado === 'hecho' ? `${c.nombre}: hecho` : c.nombre;
    const r = /^cap/.test(c.id) || /^ap/.test(c.id) ? `${rotuloParte(c.id)}, ` : '';
    return c.estado === 'actual' ? `${r}${c.nombre}. Está aquí; ${c.leidas ? `${c.leidas} de ` : ''}${c.secciones} secciones` : `${r}${base}`;
  }

  onMount(() => {
    void cargarAprendizaje();
    void cargarCursos();
    void cargarLecciones();
  });
</script>

<section class="seccion21 su-curso" aria-labelledby="tit-su-curso" data-curso-inicio={curso.id}>
  <h2 class="etiqueta21" id="tit-su-curso">Su curso · {curso.nombre}</h2>
  <ol class="capitulos">
    {#each capitulos as c (c.id)}
      <li>
        <a class="capitulo {c.estado}" href={c.href} data-parte={c.id} data-estado={c.estado} data-leidas={c.leidas} aria-current={c.estado === 'actual' ? 'step' : undefined} aria-label={etiqueta(c)}>
          <span class="disco" aria-hidden="true">
            {#if c.estado === 'hecho'}<Icono nombre="hecho" tam={16} grosor={3} />{:else}{c.num}{/if}
          </span>
          <span class="textos" aria-hidden="true">
            <span class="nombre">{c.nombre}</span>
            {#if c.estado === 'actual'}<span class="aqui">Aquí · {c.leidas ? `${c.leidas} de ` : ''}{c.secciones} {c.secciones === 1 ? 'sección' : 'secciones'}</span>{/if}
          </span>
        </a>
      </li>
    {/each}
  </ol>
  <a class="boton fantasma todo" href={`#/cursos/${curso.id}`} data-ver-curso-inicio>Ver el curso entero</a>
</section>

<style>
  .capitulos {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .capitulo {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 52px;
    padding: 12px 14px;
    margin: 0 -14px;
    border-radius: 14px;
    color: var(--v11-tinta);
    text-decoration: none;
  }
  .capitulo:hover .nombre {
    color: var(--v11-azul);
  }
  .capitulo:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: -3px;
  }
  .capitulo.actual {
    background: var(--v11-azul-tinte);
  }
  .disco {
    display: grid;
    flex: none;
    place-items: center;
    width: 28px;
    height: 28px;
    box-sizing: border-box;
    border: 2px solid var(--v11-borde);
    border-radius: 50%;
    color: var(--v11-tinta-suave);
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .hecho .disco {
    border-color: var(--v11-bien);
    background: var(--v11-bien);
    color: var(--v11-fondo);
  }
  .actual .disco {
    border-color: var(--v11-azul);
    color: var(--v11-azul);
  }
  .textos {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .nombre {
    font-size: 16px;
    line-height: 1.3;
  }
  .hecho .nombre {
    color: var(--v11-tinta-suave);
  }
  .actual .nombre {
    font-weight: 600;
  }
  .aqui {
    color: var(--v11-tinta-suave);
    font-size: 14px;
  }
  .todo {
    align-self: flex-start;
    margin-left: -16px;
  }
</style>
