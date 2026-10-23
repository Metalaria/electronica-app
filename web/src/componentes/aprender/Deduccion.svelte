<script lang="ts">
  // A derivation of the book, revealed step by step: each paragraph, equation or table is a step.
  // «Siguiente paso» (button, → or space with the derivation focused, or a tap on it) shows one more;
  // «Ver todo» shows them all. Where the reader left each one is saved on the device.
  import { onMount, tick } from 'svelte';
  import type { BDeduccion } from '../../lib/tipos';
  import { prepararHtml, textoPlano } from '../../lib/datos';
  import { aprendizaje, cargarAprendizaje, guardarPasos } from '../../lib/aprendizaje.svelte';
  import Bloques from '../Bloques.svelte';
  import Icono from '../Icono.svelte';

  let { bloque, parte, indice }: { bloque: BDeduccion; parte: string; indice?: number } = $props();

  const n = $derived(bloque.bloques.length);
  const pasos = $derived(bloque.bloques.map((b) => [b]));
  const clave = $derived(`${parte}:${indice ?? textoPlano(bloque.titulo)}`);
  const vistos = $derived(n <= 1 ? n : Math.max(1, Math.min(n, aprendizaje.deducciones[clave] ?? 1)));
  const completa = $derived(vistos >= n);

  let raiz: HTMLElement | undefined = $state();
  let ultimo = $state(-1);

  async function mostrar(k: number, enfocar = false) {
    const destino = Math.max(1, Math.min(n, k));
    if (destino === vistos) return;
    const antes = vistos;
    guardarPasos(clave, destino);
    if (destino > antes) {
      ultimo = destino - 1;
      await tick();
      const el = raiz?.querySelector<HTMLElement>(`.paso[data-k="${destino - 1}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    if (enfocar) raiz?.focus({ preventScroll: true });
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target as HTMLElement;
    if (t !== raiz) return; // keys inside buttons and links keep their own meaning
    if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'Spacebar') {
      if (completa) return;
      ev.preventDefault();
      void mostrar(vistos + 1);
    } else if (ev.key === 'ArrowLeft') {
      if (vistos <= 1) return;
      ev.preventDefault();
      void mostrar(vistos - 1);
    }
  }

  function toque(ev: MouseEvent) {
    if (completa || ev.button !== 0) return;
    const t = ev.target as HTMLElement;
    if (t.closest('a, button, input, textarea, select, summary, .figura, .tabla-scroll, [role="button"]')) return;
    if (window.getSelection()?.toString()) return;
    void mostrar(vistos + 1, true);
  }

  onMount(() => {
    void cargarAprendizaje();
  });
</script>

{#if n <= 1}
  <section id={bloque.label || undefined} data-b={indice} class="deduccion">
    <div class="deduccion-tit">Deducción <span class="guion">—</span> {@html prepararHtml(bloque.titulo)}</div>
    <Bloques bloques={bloque.bloques} {parte} />
  </section>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <section
    id={bloque.label || undefined}
    data-b={indice}
    class="deduccion por-pasos"
    class:completa
    tabindex="0"
    aria-label={`Deducción paso a paso: ${textoPlano(bloque.titulo)}. Flecha derecha o espacio para el paso siguiente.`}
    bind:this={raiz}
    onkeydown={teclas}
    onclick={toque}
  >
    <div class="deduccion-tit">
      Deducción <span class="guion">—</span> {@html prepararHtml(bloque.titulo)}
    </div>
    {#each pasos as p, k (k)}
      <div class="paso" data-k={k} hidden={k >= vistos} class:nuevo={k === ultimo}>
        <Bloques bloques={p} {parte} />
      </div>
    {/each}
    <div class="controles">
      {#if !completa}
        <button type="button" class="boton primario siguiente" onclick={() => mostrar(vistos + 1, true)}>
          <Icono nombre="paso" tam={17} /> Siguiente paso
        </button>
        <button type="button" class="boton" onclick={() => mostrar(n, true)}>Ver todo</button>
      {:else}
        <button type="button" class="boton" onclick={() => mostrar(1, true)}>
          <Icono nombre="restablecer" tam={16} /> Paso a paso desde el principio
        </button>
      {/if}
      <span class="cuenta" aria-live="polite">Paso {vistos} de {n}</span>
    </div>
  </section>
{/if}

<style>
  .por-pasos {
    border-radius: 0 6px 6px 0;
    cursor: default;
  }
  .por-pasos:not(.completa) {
    cursor: pointer;
  }
  .por-pasos:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 4px;
  }
  .paso.nuevo {
    animation: paso 0.22s ease-out;
  }
  @keyframes paso {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  .controles {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0.3em 0 0.6em;
    font-family: var(--sans);
  }
  .controles .boton {
    min-height: 44px;
  }
  .cuenta {
    margin-left: auto;
    color: var(--tinta-tenue);
    font-size: 13.5px;
    font-variant-numeric: tabular-nums;
  }
</style>
