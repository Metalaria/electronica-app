<script lang="ts">
  // «Fuentes» of «Un fotograma»: the public documentation the steps were checked against (paraphrased, nothing
  // copied). Loaded with the console's steps.
  import type { IdMaquina } from '../datos';
  import { cargarFotograma } from './maquinas';

  let { maquina }: { maquina: IdMaquina } = $props();
</script>

{#await cargarFotograma(maquina) then f}
  <section class="fuentes-fotograma">
    <h3>«Un fotograma»: de dónde sale cada paso</h3>
    <p>
      Los pasos son una explicación genérica, sin emular ningún juego: los valores de los buses son un ejemplo
      coherente. Los nombres de chips y señales son los de la arquitectura y el esquema de esta consola; el
      funcionamiento se ha comprobado con esta documentación pública:
    </p>
    <ul>
      {#each f.fuentes as x (x.url)}
        <li>
          <a href={x.url} target="_blank" rel="noopener noreferrer">{x.titulo}</a>{#if x.nota}<span class="nota"> — {x.nota}</span>{/if}
        </li>
      {/each}
    </ul>
  </section>
{/await}

<style>
  section {
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--superficie);
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
  }
  h3 {
    margin: 0 0 8px;
    color: var(--titulos);
    font-size: 18px;
  }
  p {
    margin: 0 0 8px;
  }
  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding-left: 1.2em;
  }
  a {
    overflow-wrap: anywhere;
  }
  .nota {
    color: var(--tinta-suave);
  }
</style>
