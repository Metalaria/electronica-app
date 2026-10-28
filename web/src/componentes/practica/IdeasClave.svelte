<script lang="ts">
  // The key ideas of a section on the lesson's end screen, all taken from the book: its highlighted boxes
  // («Importante», «Nota», «Precaución»), its formulas (the calculators' catalogue, with «Calcular»), its formula
  // card, and the glossary definitions of the terms the glossary sends to it.
  import Calculator from '@lucide/svelte/icons/calculator';
  import { prepararHtml, rutaDeRef } from '../../lib/datos';
  import type { Idea } from './tipos';
  import EcLibro from './EcLibro.svelte';

  let { ideas, parte }: { ideas: Idea[]; parte: string } = $props();

  const CAJA: Record<string, string> = { importante: 'Importante', nota: 'Nota', precaucion: 'Precaución' };
  const enlace = (ref: string) => rutaDeRef(ref) ?? `#/${parte}/${encodeURIComponent(ref)}`;
</script>

{#if ideas.length}
  <section class="ideas" data-ideas={ideas.length} aria-labelledby="ideas-titulo">
    <h2 id="ideas-titulo">Ideas clave</h2>
    <ul>
      {#each ideas as idea, i (i)}
        <li class="idea {idea.k}" data-idea={idea.k}>
          {#if idea.k === 'caja'}
            <span class="rot">{CAJA[idea.tipo] ?? 'Del libro'}</span>
            <p>{@html prepararHtml(idea.html)}</p>
            <a class="ir" href={enlace(idea.ref)}>Leer en el libro</a>
          {:else if idea.k === 'formula'}
            <span class="rot">Fórmula · {idea.nombre}</span>
            <EcLibro svg={idea.svg} w={idea.w} h={idea.h} alt={idea.nombre} />
            <span class="fila">
              <a class="ir" href={enlace(idea.ref)}>Leer en el libro</a>
              <a class="ir" href={`#/calculadoras/${encodeURIComponent(idea.calc)}`}><Calculator size={15} aria-hidden="true" /> Calcular</a>
            </span>
          {:else if idea.k === 'tarjeta'}
            <span class="rot">Tarjeta de fórmulas</span>
            {#each idea.svgs as s, j (j)}<EcLibro svg={s.svg} w={s.w} h={s.h} />{/each}
            <a class="ir" href={enlace(idea.ref)}>Leer en el libro</a>
          {:else}
            <span class="rot">Glosario</span>
            <p><strong>{@html prepararHtml(idea.termino)}</strong>: {@html prepararHtml(idea.html)}</p>
            <a class="ir" href={`#/glosario/${encodeURIComponent(idea.glosario)}`}>Ver en el glosario</a>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .ideas {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-top: 10px;
    text-align: left;
  }
  h2 {
    margin: 0;
    color: var(--bloque-texto, var(--titulos));
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .idea {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    border: 1px solid var(--linea);
    border-left: 5px solid var(--bloque, var(--acento));
    border-radius: 14px;
    background: var(--superficie);
  }
  .rot {
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  p {
    margin: 0;
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 16.5px;
    line-height: 1.5;
  }
  .fila {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
  }
  .ir {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    min-height: 36px;
    font-size: 14.5px;
    font-weight: 600;
  }
</style>
