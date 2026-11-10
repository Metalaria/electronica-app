<script lang="ts">
  // 1.1 «Proyectos por etapas»: the card at the end of printed chapters 47–51 (Lector.svelte, after the new exercises).
  // In a project chapter: its stages and progress, «Empezar» / «Seguir»; in printed 47 (their common introduction):
  // the four projects, in the order the book recommends to start with.
  import Wrench from '@lucide/svelte/icons/wrench';
  import { onMount } from 'svelte';
  import { INDICE_PROYECTOS, PARTE_INTEGRACION, proyectoIndice } from '../../lib/proyectos11/indice';
  import { cargarProyectos, estadoProyectos, etapaPendiente, etapasHechas } from '../../lib/proyectos11/estado.svelte';

  let { parte }: { parte: string } = $props();
  const proyecto = $derived(proyectoIndice(parte));
  const integracion = $derived(parte === PARTE_INTEGRACION);

  onMount(() => {
    if (proyecto || integracion) void cargarProyectos();
  });
</script>

{#if proyecto}
  {@const hechas = etapasHechas(proyecto.parte)}
  {@const pendiente = etapaPendiente(proyecto.parte)}
  <aside class="proyecto-etapas" aria-labelledby="proyecto-etapas-titulo" data-proyecto-capitulo={proyecto.parte}>
    <p class="etiqueta"><Wrench size={15} strokeWidth={2.4} aria-hidden="true" /> Proyecto por etapas</p>
    <h2 id="proyecto-etapas-titulo">Monte este proyecto en el editor</h2>
    <p>{proyecto.etapas.length} etapas, cada una comprobada simulando su circuito frente a lo que pide este capítulo{estadoProyectos.listo && hechas ? `: lleva ${hechas} superada${hechas === 1 ? '' : 's'}` : ''}.</p>
    <a class="primario" href={`#/etapas/${proyecto.parte}/${pendiente || 1}`}>{hechas === 0 ? 'Empezar la etapa 1' : pendiente ? `Seguir con la etapa ${pendiente}` : 'Repasar las etapas'}</a>
  </aside>
{:else if integracion}
  <aside class="proyecto-etapas" aria-labelledby="proyecto-etapas-titulo" data-proyecto-capitulo={parte}>
    <p class="etiqueta"><Wrench size={15} strokeWidth={2.4} aria-hidden="true" /> Proyectos por etapas</p>
    <h2 id="proyecto-etapas-titulo">Los cuatro proyectos, en el editor</h2>
    <p>Estos cuatro mapas no traen valores que diseñar; sus capítulos sí, y cada uno se puede montar por etapas:</p>
    <ul>
      {#each INDICE_PROYECTOS as p (p.parte)}
        <li><a href={`#/etapas/${p.parte}`}>{p.titulo}</a></li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  .proyecto-etapas {
    display: grid;
    gap: 8px;
    margin: 24px 0;
    padding: 16px;
    border: 1px solid var(--v11-linea);
    border-radius: var(--v11-radio-tarjeta);
    background: var(--v11-fondo);
    box-shadow: var(--v11-sombra);
    color: var(--v11-tinta);
    font-family: var(--v11-texto);
    font-size: 15px;
    line-height: 1.5;
  }
  .etiqueta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h2 {
    margin: 0;
    font-family: var(--v11-titular);
    font-size: 20px;
    line-height: 1.2;
    color: var(--v11-tinta);
  }
  p,
  ul {
    margin: 0;
  }
  ul {
    padding-left: 20px;
  }
  li a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--v11-azul);
    font-weight: 600;
  }
  .primario {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    justify-self: start;
    min-height: 48px;
    padding: 0 18px;
    border-radius: var(--v11-radio-boton);
    background: var(--v11-azul);
    color: var(--v11-sobre-azul);
    font: 600 16px var(--v11-texto);
    text-decoration: none;
  }
  .primario:hover {
    background: var(--v11-azul-hover);
  }
  .primario:focus-visible,
  li a:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
</style>
