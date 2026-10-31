<script lang="ts">
  // The formula as math, where every quantity that can be computed is a button: tap it to solve for it.
  // On a touch screen the symbols are too small to hit (a letter of the formula is 25–40 px): the whole formula is
  // one button that opens a picker with a large button per quantity (its symbol and name), with the same result as
  // tapping the symbol with a mouse (owner's decision on the 0.11 QA). Mouse and keyboard keep the inline buttons.
  import './mates.css';
  import { onMount, tick } from 'svelte';
  import type { Formula } from './tipos';
  import { ecuacionHtml } from './mates';

  let { f, objetivo, posibles, onelegir }: { f: Formula; objetivo: string; posibles: string[]; onelegir: (id: string) => void } = $props();

  const uid = $props.id();
  /** A coarse pointer (touch screen): the picker instead of the inline buttons. */
  let tactil = $state(false);
  let abierto = $state(false);
  let boton: HTMLButtonElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();

  onMount(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const mirar = () => {
      tactil = mq.matches;
      if (!tactil) abierto = false;
    };
    mirar();
    mq.addEventListener('change', mirar);
    return () => mq.removeEventListener('change', mirar);
  });

  const html = $derived(
    ecuacionHtml(f.resultado, f.expr, {
      sim: (id) => f.vars.find((v) => v.id === id)?.sim ?? id,
      objetivo,
      pulsable: tactil
        ? () => null
        : (id) => {
            const v = f.vars.find((x) => x.id === id);
            return v && posibles.includes(id) ? `Calcular ${v.nombre}` : null;
          },
    }),
  );
  const opciones = $derived(posibles.map((id) => f.vars.find((v) => v.id === id)).filter((v) => !!v));

  function pulsar(ev: MouseEvent) {
    const b = (ev.target as Element | null)?.closest?.('[data-var]');
    const id = b?.getAttribute('data-var');
    if (id) onelegir(id);
  }

  async function abrir() {
    abierto = !abierto;
    if (!abierto) return;
    await tick();
    (panel?.querySelector<HTMLElement>('[aria-checked="true"]') ?? panel?.querySelector<HTMLElement>('button'))?.focus();
  }

  function cerrar(volver = true) {
    abierto = false;
    if (volver) boton?.focus({ preventScroll: true });
  }

  function elegir(id: string) {
    onelegir(id);
    cerrar();
  }

  // closes on a tap outside (the formula's button toggles it itself) and on Escape
  $effect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel?.contains(t) && !boton?.contains(t)) cerrar(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar();
      }
    };
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera, true);
      document.removeEventListener('keydown', tecla);
    };
  });
</script>

{#if tactil && opciones.length}
  <div class="formula-viva mate tactil">
    <button
      type="button"
      class="formula-boton"
      bind:this={boton}
      aria-haspopup="dialog"
      aria-expanded={abierto}
      aria-controls={abierto ? `${uid}-elegir` : undefined}
      aria-label="Fórmula: elegir qué magnitud se calcula"
      onclick={abrir}
      data-formula-tactil>{@html html}</button
    >
  </div>
  {#if abierto}
    <div class="elegir" id={`${uid}-elegir`} role="dialog" aria-label="¿Qué magnitud quiere calcular?" bind:this={panel} data-elegir-magnitud>
      <p class="titulo">¿Qué quiere calcular?</p>
      <div class="opciones" role="radiogroup" aria-label="Magnitud que se calcula">
        {#each opciones as v (v.id)}
          <button type="button" role="radio" aria-checked={v.id === objetivo} class:activa={v.id === objetivo} onclick={() => elegir(v.id)} data-var-tactil={v.id}>
            <span class="sim mate">{@html v.sim}</span>
            <span class="nom">{v.nombre}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
{:else}
  <!-- The variables are <button>s: keyboard activation reaches this delegated handler as a click. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="formula-viva mate" onclick={pulsar}>{@html html}</div>
{/if}

<style>
  .formula-viva {
    overflow-x: auto;
    padding: 10px 4px 8px;
    font-size: 23px;
    text-align: center;
    scrollbar-width: thin;
  }
  .formula-boton {
    display: inline-block;
    min-height: 48px;
    max-width: 100%;
    padding: 4px 10px;
    border: 1px dashed var(--acento-borde);
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: inherit;
  }
  .formula-boton[aria-expanded='true'] {
    border-style: solid;
    background: var(--acento-tinte);
  }
  .elegir {
    margin: 2px 0 8px;
    padding: 10px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
  }
  .titulo {
    margin: 0 0 8px;
    color: var(--tinta-suave);
    font: 600 14px var(--sans);
  }
  .opciones {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
    gap: 8px;
  }
  .opciones button {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 6px 12px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie-2);
    color: var(--tinta);
    font: 14.5px var(--sans);
    text-align: left;
  }
  .opciones button.activa {
    border-color: var(--acento);
    background: var(--acento-tinte);
  }
  .sim {
    min-width: 1.6em;
    color: var(--acento);
    font-size: 21px;
    text-align: center;
  }
  :global(:root[data-tema='oscuro']) .sim {
    color: var(--titulos);
  }
  .nom {
    line-height: 1.25;
  }
</style>
