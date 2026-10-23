<script lang="ts">
  // The formula as math, where every quantity that can be computed is a button: tap it to solve for it.
  import './mates.css';
  import type { Formula } from './tipos';
  import { ecuacionHtml } from './mates';

  let { f, objetivo, posibles, onelegir }: { f: Formula; objetivo: string; posibles: string[]; onelegir: (id: string) => void } = $props();

  const html = $derived(
    ecuacionHtml(f.resultado, f.expr, {
      sim: (id) => f.vars.find((v) => v.id === id)?.sim ?? id,
      objetivo,
      pulsable: (id) => {
        const v = f.vars.find((x) => x.id === id);
        return v && posibles.includes(id) ? `Calcular ${v.nombre}` : null;
      },
    }),
  );

  function pulsar(ev: MouseEvent) {
    const b = (ev.target as Element | null)?.closest?.('[data-var]');
    const id = b?.getAttribute('data-var');
    if (id) onelegir(id);
  }
</script>

<!-- The variables are <button>s: keyboard activation reaches this delegated handler as a click. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="formula-viva mate" onclick={pulsar}>{@html html}</div>

<style>
  .formula-viva {
    overflow-x: auto;
    padding: 10px 4px 8px;
    font-size: 23px;
    text-align: center;
    scrollbar-width: thin;
  }
</style>
