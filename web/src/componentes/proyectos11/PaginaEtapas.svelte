<script lang="ts">
  // 1.1 «Proyectos por etapas» (#/etapas[/<parte>[/<n>]]): the four detailed projects of the book (printed chapters
  // 48–51), each built stage by stage in the schematic editor; one project's stages; or a stage (Etapa.svelte).
  // Printed chapter 47 (file cap48) is their common introduction: its four designs are these projects' block maps, with
  // no values to design (lib/proyectos11/etapas.ts), so it is linked here, not staged.
  import Check from '@lucide/svelte/icons/check';
  import { onMount } from 'svelte';
  import { infoParte, rotuloParte } from '../../lib/datos';
  import { PROYECTOS, proyectoDe } from '../../lib/proyectos11/etapas';
  import { PARTE_INTEGRACION } from '../../lib/proyectos11/indice';
  import { cargarProyectos, estadoProyectos, etapaPendiente, etapasHechas, registroEtapa } from '../../lib/proyectos11/estado.svelte';
  import Etapa from './Etapa.svelte';

  let { ancla = '' }: { ancla?: string } = $props();

  const partes = $derived(ancla.split('/').filter(Boolean));
  const proyecto = $derived(partes[0] ? proyectoDe(partes[0]) : undefined);
  const etapa = $derived(proyecto && partes[1] ? proyecto.etapas.find((e) => String(e.n) === partes[1]) : undefined);
  const capitulo = (parte: string) => {
    const i = infoParte(parte);
    return i ? `${rotuloParte(parte)}` : parte;
  };

  onMount(() => void cargarProyectos());
</script>

<div class="pagina">
  {#if etapa && proyecto}
    <nav class="miga" aria-label="Ruta"><a href="#/etapas">Proyectos por etapas</a> › <a href={`#/etapas/${proyecto.parte}`}>{proyecto.corto}</a></nav>
    {#key etapa.id}
      <Etapa {proyecto} {etapa} />
    {/key}
  {:else if proyecto && !partes[1]}
    <nav class="miga" aria-label="Ruta"><a href="#/etapas">Proyectos por etapas</a></nav>
    <section class="proyecto" data-proyecto={proyecto.parte}>
      <p class="etiqueta">{capitulo(proyecto.parte)} · {etapasHechas(proyecto.parte)} de {proyecto.etapas.length} etapas superadas</p>
      <h1>{proyecto.titulo}</h1>
      <p>{@html proyecto.resumen}</p>
      <ol class="etapas">
        {#each proyecto.etapas as e (e.id)}
          {@const r = registroEtapa(e.id)}
          <li>
            <a class="fila" href={`#/etapas/${proyecto.parte}/${e.n}`} data-etapa-lista={e.id}>
              <span class="marca" class:hecha={!!r?.h} aria-hidden="true">{#if r?.h}<Check size={16} strokeWidth={3} />{:else}{e.n}{/if}</span>
              <span class="txt"><strong>Etapa {e.n}: {@html e.titulo}</strong><span class="sub">{@html e.objetivo}</span></span>
              <span class="estado">{r?.h ? 'Superada' : r?.n ? `${r.n} ${r.n === 1 ? 'comprobación' : 'comprobaciones'}` : 'Sin empezar'}</span>
            </a>
          </li>
        {/each}
      </ol>
      <p class="enlaces">
        <a href={`#/${proyecto.parte}`}>Leer el capítulo</a>
        {#if proyecto.placa}<a href={`#/proyectos/${proyecto.placa}`}>Ver la placa del proyecto</a>{/if}
      </p>
    </section>
  {:else if partes.length}
    <p class="aviso" role="alert">No existe ese proyecto o esa etapa. <a href="#/etapas">Ver los proyectos por etapas</a>.</p>
  {:else}
    <section class="indice">
      <h1>Proyectos por etapas</h1>
      <p>Los cuatro proyectos detallados del libro, montados por etapas en el editor de esquemas. Cada etapa se comprueba simulando su circuito frente a lo que pide el libro.</p>
      <ul class="proyectos">
        {#each PROYECTOS as p (p.parte)}
          {@const hechas = etapasHechas(p.parte)}
          {@const pendiente = etapaPendiente(p.parte)}
          <li class="tarjeta" data-proyecto-indice={p.parte}>
            <p class="etiqueta">{capitulo(p.parte)} · {estadoProyectos.listo ? `${hechas} de ${p.etapas.length} etapas` : `${p.etapas.length} etapas`}</p>
            <h2>{p.titulo}</h2>
            <p>{@html p.resumen}</p>
            <div class="acciones">
              <a class="primario" href={`#/etapas/${p.parte}/${pendiente || 1}`}>{hechas === 0 ? 'Empezar' : pendiente ? `Seguir: etapa ${pendiente}` : 'Repasar'}<span class="solo-lector"> {p.corto}</span></a>
              <a class="secundario" href={`#/etapas/${p.parte}`}>Las etapas<span class="solo-lector"> de {p.corto}</span></a>
            </div>
          </li>
        {/each}
      </ul>
      <p class="nota">
        El {capitulo(PARTE_INTEGRACION)} presenta los cuatro como mapas de bloques, sin valores que diseñar: <a href={`#/${PARTE_INTEGRACION}`}>leerlo</a>. Según el libro, la fuente es la más útil, la estación IoT la más asequible, el amplificador el que más enseña de analógica y la SDR la que más conocimiento previo exige.
      </p>
      <p class="nota">Quedan fuera lo que no es un circuito que simular: el presupuesto de energía, el firmware y la red de la estación; el lado de red de la fuente; masas y zumbidos del amplificador; y el detector y el procesado digital de la SDR.</p>
    </section>
  {/if}
</div>

<style>
  .pagina {
    display: grid;
    gap: 14px;
    max-width: 760px;
    margin: 0 auto;
    padding: 16px;
    overflow-wrap: anywhere;
    color: var(--v11-tinta);
    font-family: var(--v11-texto);
    font-size: 15px;
    line-height: 1.5;
  }
  .miga {
    color: var(--v11-tinta-suave);
    font-size: 14px;
  }
  .miga a,
  .enlaces a,
  .nota a,
  .aviso a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--v11-azul);
    font-weight: 600;
  }
  h1,
  h2 {
    margin: 0;
    font-family: var(--v11-titular);
    line-height: 1.2;
  }
  h1 {
    font-size: 26px;
  }
  h2 {
    font-size: 20px;
  }
  p {
    margin: 0;
  }
  .indice,
  .proyecto {
    display: grid;
    gap: 12px;
  }
  .etiqueta {
    color: var(--v11-tinta-suave);
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .nota {
    color: var(--v11-tinta-suave);
    font-size: 14px;
  }
  .aviso {
    padding: 10px 12px;
    border-radius: var(--v11-radio-panel);
    background: var(--v11-mal-tinte);
    color: var(--v11-mal-texto);
  }
  .proyectos,
  .etapas {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tarjeta {
    display: grid;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--v11-linea);
    border-radius: var(--v11-radio-tarjeta);
    background: var(--v11-fondo);
    box-shadow: var(--v11-sombra);
  }
  .fila {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    min-height: 56px;
    padding: 12px;
    border: 1px solid var(--v11-linea);
    border-radius: var(--v11-radio-panel);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    text-decoration: none;
  }
  .fila:hover {
    border-color: var(--v11-borde);
  }
  .marca {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 2px solid var(--v11-borde);
    border-radius: 50%;
    font-weight: 700;
  }
  .marca.hecha {
    border-color: var(--v11-azul);
    background: var(--v11-azul);
    color: var(--v11-sobre-azul);
  }
  .txt {
    display: grid;
    gap: 2px;
  }
  .sub,
  .estado {
    color: var(--v11-tinta-suave);
    font-size: 13.5px;
  }
  @media (max-width: 520px) {
    .fila {
      grid-template-columns: 34px minmax(0, 1fr);
    }
    .estado {
      grid-column: 2;
    }
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .primario,
  .secundario {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 18px;
    border-radius: var(--v11-radio-boton);
    font: 600 16px var(--v11-texto);
    text-decoration: none;
  }
  .primario {
    background: var(--v11-azul);
    color: var(--v11-sobre-azul);
  }
  .primario:hover {
    background: var(--v11-azul-hover);
  }
  .secundario {
    border: 2px solid var(--v11-borde);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
  }
  .fila:focus-visible,
  .primario:focus-visible,
  .secundario:focus-visible,
  a:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
