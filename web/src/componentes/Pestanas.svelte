<script lang="ts">
  // Bottom tab bar (phone and tablet portrait): the registry's entries marked `pestana` (0.9: Inicio, Libro,
  // Simulador, Ejercicios) and «Más» for the rest. «Libro» opens the index drawer. Styled as the 0.9 mockups:
  // a pill behind the active icon, the active label in the accent.
  import { app } from '../lib/estado.svelte';
  import { HERRAMIENTAS, activar, esActiva, type Herramienta } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';
  import MenuHerramientas from './MenuHerramientas.svelte';

  const pestanas = HERRAMIENTAS.filter((h) => h.pestana);
  const resto = HERRAMIENTAS.filter((h) => !h.pestana);

  let mas = $state(false);
  let botonMas: HTMLButtonElement | undefined = $state();
  const masActivo = $derived(resto.some(esActiva));

  function activa(h: Herramienta): boolean {
    if (h.id === 'libro') return app.lateral || (esActiva(h) && !masActivo);
    return esActiva(h) && !app.lateral;
  }

  // 2.0: the bar hides while a text box has the focus (style below) and comes back when it loses it. A tap that
  // starts on a control lying where the bar would be blurs the box on its mousedown: if the bar came back then, the
  // tap's mouseup and click would land on the bar and the control would never get its click («Decodificar» of a
  // console's «Arquitectura» right after typing). So a tap that starts while a text box has the focus keeps the bar
  // hidden until it is over: its click, or its cancellation, or a safety timeout.
  const ESCRITURA = "input:not([type='range'], [type='checkbox'], [type='radio'], [type='button']), textarea";
  let retenida = $state(false);
  let plazo: ReturnType<typeof setTimeout> | undefined;
  function soltar(ms: number) {
    clearTimeout(plazo);
    plazo = setTimeout(() => (retenida = false), ms);
  }
  $effect(() => {
    const abajo = () => {
      if (!(document.activeElement instanceof Element && document.activeElement.matches(ESCRITURA))) return;
      retenida = true;
      soltar(1500);
    };
    // after the click handlers have run (and whatever they focus), the bar may come back
    const hecho = () => retenida && soltar(0);
    const arriba = () => retenida && soltar(700);
    const opciones = { capture: true, passive: true } as const;
    document.addEventListener('pointerdown', abajo, opciones);
    document.addEventListener('pointerup', arriba, opciones);
    document.addEventListener('pointercancel', hecho, opciones);
    document.addEventListener('click', hecho, opciones);
    return () => {
      clearTimeout(plazo);
      document.removeEventListener('pointerdown', abajo, opciones);
      document.removeEventListener('pointerup', arriba, opciones);
      document.removeEventListener('pointercancel', hecho, opciones);
      document.removeEventListener('click', hecho, opciones);
    };
  });
</script>

<nav class="pestanas" class:retenida aria-label="Secciones de la aplicación">
  {#each pestanas as h (h.id)}
    {#if h.ruta}
      <a class="pestana" class:activa={activa(h)} href={h.ruta} aria-label={h.etiqueta} aria-current={activa(h) ? 'page' : undefined} data-herramienta={h.id}>
        <span class="icono"><Icono nombre={h.icono} tam={23} /></span>
        <span class="etiqueta">{h.corta ?? h.etiqueta}</span>
      </a>
    {:else}
      <button
        class="pestana"
        class:activa={activa(h)}
        type="button"
        aria-label={h.etiqueta}
        aria-expanded={h.id === 'libro' ? app.lateral : undefined}
        data-herramienta={h.id}
        onclick={() => activar(h)}
      >
        <span class="icono"><Icono nombre={h.icono} tam={23} /></span>
        <span class="etiqueta">{h.corta ?? h.etiqueta}</span>
      </button>
    {/if}
  {/each}
  <button
    class="pestana"
    class:activa={masActivo && !app.lateral}
    bind:this={botonMas}
    type="button"
    aria-haspopup="menu"
    aria-expanded={mas}
    aria-label="Más"
    data-herramienta="mas"
    onclick={() => (mas = !mas)}
  >
    <span class="icono"><Icono nombre="mas" tam={23} /></span>
    <span class="etiqueta">Más</span>
  </button>
</nav>

{#if mas && botonMas}
  <MenuHerramientas items={resto} ancla={botonMas} modo="hoja" onCerrar={() => (mas = false)} />
{/if}

<style>
  .pestanas {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 28;
    display: flex;
    justify-content: space-around;
    height: calc(var(--alto-pestanas) + env(safe-area-inset-bottom));
    padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    background: color-mix(in srgb, var(--barra-nav) 96%, transparent);
    border-top: 1px solid var(--linea);
    -webkit-backdrop-filter: saturate(1.4) blur(12px);
    backdrop-filter: saturate(1.4) blur(12px);
    font-family: var(--sans);
  }
  @supports not (background: color-mix(in srgb, red 50%, blue)) {
    .pestanas {
      background: var(--barra-nav);
    }
  }
  /* the keyboard is up: the tabs would only take room above it */
  :global(html:has(input:not([type='range'], [type='checkbox'], [type='radio'], [type='button']):focus, textarea:focus)) .pestanas {
    display: none;
  }
  /* (2.0) a tap that began while the keyboard was up is not over yet */
  .pestanas.retenida {
    display: none;
  }
  .pestana {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    max-width: 120px;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--tinta-suave);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }
  .icono {
    display: grid;
    place-items: center;
    width: 52px;
    height: 30px;
    border-radius: 15px;
    transition: background 0.15s, color 0.15s;
  }
  .etiqueta {
    max-width: 100%;
    overflow: hidden;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pestana.activa {
    color: var(--acento);
  }
  .pestana.activa .icono {
    background: var(--acento-tinte);
  }
  .pestana.activa .etiqueta {
    font-weight: 700;
  }
  .pestana:focus-visible {
    outline: none;
  }
  .pestana:focus-visible .icono {
    outline: 2px solid var(--acento);
  }
</style>
