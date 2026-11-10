<script lang="ts">
  // Entry page of the instruments: the two instruments in one line each, the twelve practices, and the
  // free bench.
  import { onMount } from 'svelte';
  import { PRACTICAS } from './practicas/practicas';
  import { app } from '../../lib/estado.svelte';
  // 1.1: each practice also as a guided lab, with its progress
  import { cargarLaboratorio, registroLab } from '../../lib/laboratorio.svelte';
  import { laboratorioDe } from './practicas/laboratorios';
  import { labCompletado } from '../../lib/laboratorio';

  onMount(() => void cargarLaboratorio());
  function avanceLab(n: number): string {
    const r = registroLab(n);
    const total = laboratorioDe(n)?.pasos.length ?? 0;
    // (review 11a: completed by `c` or by the steps done — after a merge of two devices only `h` may cover it)
    if (labCompletado(r, laboratorioDe(n)?.pasos.map((x) => x.id) ?? [])) return 'completado';
    return r?.h.length ? `${Math.min(r.h.length, total)} de ${total} pasos` : `${total} pasos`;
  }
</script>

<div class="portada">
  <h1>Instrumentos</h1>
  <p class="intro">
    El <strong>Brymen BM869s</strong> y el <strong>FNIRSI 2C53T</strong> del libro, en virtual, midiendo circuitos que simula
    ngspice: con sus escalas, su exactitud, la carga que añaden al circuito y las limitaciones del osciloscopio (memoria de
    1 000 puntos, 8 bits, 50 MHz). Coloque las puntas tocando los nodos del dibujo.
  </p>

  <h2>Prácticas del capítulo {app.indice?.partes['cap22']?.num ?? '21'}</h2>
  <ol class="practicas">
    {#each PRACTICAS as p (p.n)}
      <li>
        <a href={`#/instrumentos/practica/${p.n}`}>
          <span class="n">{p.n}</span>
          <span class="t">{p.titulo}</span>
          <span class="o">{@html p.objetivo}</span>
        </a>
        <a class="lab" href={`#/instrumentos/laboratorio/${p.n}`} data-laboratorio-enlace={p.n}>Laboratorio guiado <span class="avance">· {avanceLab(p.n)}</span></a>
      </li>
    {/each}
  </ol>

  <h2>Banco libre</h2>
  <p class="intro">Cualquier netlist del simulador en el banco: elija el circuito, conecte los instrumentos y mida.</p>
  <a class="boton primario" href="#/instrumentos/libre">Abrir el banco libre</a>
</div>

<style>
  .portada {
    max-width: 980px;
    margin: 0 auto;
    padding: 20px 16px 60px;
    font-family: var(--sans);
  }
  h1 {
    margin: 0 0 8px;
    color: var(--titulos);
  }
  h2 {
    margin: 28px 0 10px;
    color: var(--titulos);
    font-size: 19px;
  }
  .intro {
    color: var(--tinta-suave);
    max-width: 46em;
    line-height: 1.5;
  }
  .practicas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .practicas li {
    display: grid;
    grid-template-rows: 1fr auto;
    gap: 4px;
  }
  .practicas a.lab {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 12px;
    color: var(--acento);
    font-weight: 600;
    font-size: 14px;
  }
  .avance {
    color: var(--tinta-suave);
    font-weight: 400;
  }
  .practicas a:not(.lab) {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    height: 100%;
    padding: 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
  }
  .practicas a:not(.lab):hover {
    border-color: var(--acento-borde);
    background: var(--acento-tinte);
  }
  .n {
    grid-row: span 2;
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--acento);
    color: var(--sobre-acento);
    font-weight: 800;
  }
  .t {
    font-weight: 700;
    color: var(--titulos);
  }
  .o {
    color: var(--tinta-suave);
    font-size: 13.5px;
    line-height: 1.35;
  }
</style>
