<script lang="ts" module>
  /** One tab of a row. `href`: a route (the row is links in a <nav>); without it the row is a tablist. */
  export interface Pestana21 {
    id: string;
    texto: string;
    href?: string;
    /** Small counter after the text (bookmarks, pending items). */
    cuenta?: number;
    /** Accessible name when the visible text is not enough. */
    etiqueta?: string;
  }

  /** Scrolls a row of tabs sideways so its current tab is in view (a phone row that does not fit). */
  export function mostrarActual21(fila: HTMLElement): void {
    const el = fila.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]');
    if (!el || fila.scrollWidth <= fila.clientWidth + 1) return;
    const f = fila.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.left < f.left || r.right > f.right) {
      fila.scrollTo({ left: Math.max(0, fila.scrollLeft + r.left - f.left - 24), behavior: 'instant' as ScrollBehavior });
    }
  }

  /** The ids a tablist's panel uses: `<div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab}>`. */
  export function idsPestana21(base: string, id: string): { tab: string; panel: string } {
    return { tab: `${base}-pestana-${id}`, panel: `${base}-panel-${id}` };
  }
</script>

<script lang="ts">
  // 2.1: the shared underline tabs of the system (estilos/sistema21.css .pestanas21 / .pestana21).
  //   - With `href` on the items: links in a <nav aria-label={etiqueta}>, the current one aria-current="page"
  //     (routes: the header's group tabs, a console's views). Tab moves through them as through any links.
  //   - Without `href`: a WAI-ARIA tablist. Roving tabindex (only the selected tab is in the Tab order), ← / → move
  //     and select (automatic activation), Home / End the first and last; `onelegir(id)` tells the page. With `base`,
  //     each tab is `aria-controls` of the panel `idsPestana21(base, id).panel` (the page writes that panel).
  // The row scrolls sideways when it does not fit (phone) and keeps the current tab in view.
  import { tick } from 'svelte';

  let {
    items,
    actual,
    etiqueta,
    onelegir,
    base,
    linea = true,
    clase = '',
  }: {
    items: Pestana21[];
    /** Id of the current tab (none: no tab marked). */
    actual: string | null | undefined;
    /** Accessible name of the row («Partes de Libro», «Vistas de la consola»). */
    etiqueta: string;
    onelegir?: (id: string) => void;
    /** Id prefix for aria-controls / the panels (tablist only). */
    base?: string;
    /** Draw the 1 px line under the row (off when the container draws its own). */
    linea?: boolean;
    clase?: string;
  } = $props();

  let fila: HTMLElement | undefined = $state();
  const enlaces = $derived(items.length > 0 && items.every((i) => i.href != null));

  // keep the current tab in view when it changes (a phone row scrolled sideways)
  $effect(() => {
    void actual;
    const f = fila;
    if (!f) return;
    void tick().then(() => mostrarActual21(f));
  });

  function teclas(ev: KeyboardEvent) {
    if (enlaces) return;
    const k = items.findIndex((i) => i.id === actual);
    let n = -1;
    if (ev.key === 'ArrowRight') n = (k + 1 + items.length) % items.length;
    else if (ev.key === 'ArrowLeft') n = (k - 1 + items.length) % items.length;
    else if (ev.key === 'Home') n = 0;
    else if (ev.key === 'End') n = items.length - 1;
    else return;
    ev.preventDefault();
    const it = items[n];
    if (!it) return;
    onelegir?.(it.id);
    void tick().then(() => fila?.querySelectorAll<HTMLElement>('[role="tab"]')[n]?.focus());
  }
</script>

{#if enlaces}
  <nav class="pestanas21 {clase}" class:sin-linea={!linea} aria-label={etiqueta} bind:this={fila}>
    {#each items as it (it.id)}
      <a
        class="pestana21"
        href={it.href}
        aria-current={it.id === actual ? 'page' : undefined}
        aria-label={it.etiqueta ?? (it.cuenta ? `${it.texto} (${it.cuenta})` : undefined)}
        data-pestana21={it.id}
        onclick={() => onelegir?.(it.id)}
      >
        {it.texto}{#if it.cuenta}<span class="cuenta21" aria-hidden="true">{it.cuenta > 99 ? '99+' : it.cuenta}</span>{/if}
      </a>
    {/each}
  </nav>
{:else}
  <div class="pestanas21 {clase}" class:sin-linea={!linea} role="tablist" aria-label={etiqueta} tabindex="-1" bind:this={fila} onkeydown={teclas}>
    {#each items as it, i (it.id)}
      {@const sel = it.id === actual}
      {@const ids = base ? idsPestana21(base, it.id) : null}
      <button
        type="button"
        role="tab"
        class="pestana21"
        id={ids?.tab}
        aria-controls={ids?.panel}
        aria-selected={sel}
        aria-label={it.etiqueta ?? (it.cuenta ? `${it.texto} (${it.cuenta})` : undefined)}
        tabindex={sel || (actual == null && i === 0) ? 0 : -1}
        data-pestana21={it.id}
        onclick={() => onelegir?.(it.id)}
      >
        {it.texto}{#if it.cuenta}<span class="cuenta21" aria-hidden="true">{it.cuenta > 99 ? '99+' : it.cuenta}</span>{/if}
      </button>
    {/each}
  </div>
{/if}
