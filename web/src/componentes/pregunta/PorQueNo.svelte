<script lang="ts">
  // 1.0: «Por qué no «…»» after a wrong pick — what the book says about that very option (a sentence copied from the
  // book, with where it is), and/or a sentence built from the app's own simulation (predictions). Nothing when the
  // book gives no specific basis: the question's general explanation covers it.
  import { prepararHtml, rutaDeRef } from '../../lib/datos';
  import type { Porque } from './porque';

  let { opcion, porque = null, parte, extra = '' }: { opcion: string; porque?: Porque | null; parte: string; extra?: string } = $props();

  const libro = $derived(porque?.k === 'libro' ? porque : null);
  const href = $derived(libro ? (rutaDeRef(libro.ref) ?? `#/${parte}/${encodeURIComponent(libro.ref)}`) : '');
</script>

{#if libro || extra}
  <div class="porque" data-porque={libro ? 'libro' : 'simulacion'}>
    <span class="rot">Por qué no «{@html prepararHtml(opcion)}»</span>
    {#if extra}<p class="extra">{@html prepararHtml(extra)}</p>{/if}
    {#if libro}
      <blockquote>
        <p>«{@html prepararHtml(libro.html)}»</p>
        <a class="de" href={href}>Del libro · {libro.donde}</a>
      </blockquote>
    {/if}
  </div>
{/if}

<style>
  .porque {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-left: 4px solid var(--mal, #b03a1e);
    border-radius: 12px;
    background: var(--superficie-2);
  }
  .rot {
    color: var(--tinta);
    font-size: 14px;
    font-weight: 700;
  }
  .extra,
  blockquote p {
    margin: 0;
    color: var(--tinta);
    font-size: 16px;
    line-height: 1.5;
  }
  blockquote {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
  }
  blockquote p {
    font-family: var(--serif);
  }
  .de {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    min-height: 44px;
    color: var(--acento);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
