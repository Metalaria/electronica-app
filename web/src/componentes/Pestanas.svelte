<script lang="ts">
  // Bottom bar (phone and tablet portrait), 2.1: the same five groups as the rail (lib/navegacion GRUPOS), a pill
  // behind the current one's icon, its label in the accent. A group's parts are the tab row under the header
  // (Barra.svelte). While reading, «Libro» opens the book's index drawer.
  import { app } from '../lib/estado.svelte';
  import { GRUPOS, grupoActual, hrefGrupo, indiceDesdeLibro, type Grupo } from '../lib/navegacion.svelte';
  import { ruta } from '../lib/ruta.svelte';
  import Icono from './Icono.svelte';

  /** The index drawer is open over the page: the bar is inert under it (App.svelte). */
  let { inerte = false }: { inerte?: boolean } = $props();

  const actual = $derived(grupoActual()?.id ?? null);

  function activa(g: Grupo): boolean {
    if (g.id === 'libro' && app.lateral) return true;
    return g.id === actual && !app.lateral;
  }

  function clic(g: Grupo, ev: MouseEvent) {
    if (g.id !== 'libro' || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
    if (indiceDesdeLibro(false)) ev.preventDefault();
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

<nav class="pestanas" class:retenida aria-label="Secciones de la aplicación" inert={inerte}>
  {#each GRUPOS as g (g.id)}
    <a
      class="pestana"
      class:activa={activa(g)}
      href={hrefGrupo(g)}
      aria-current={g.id === actual ? 'page' : undefined}
      aria-expanded={g.id === 'libro' && ruta.vista === 'parte' ? app.lateral : undefined}
      data-grupo={g.id}
      data-herramienta={g.id}
      onclick={(ev) => clic(g, ev)}
    >
      <span class="icono"><Icono nombre={g.icono} tam={22} /></span>
      <span class="etiqueta">{g.etiqueta}</span>
    </a>
  {/each}
</nav>

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
    color: var(--v11-tinta-suave);
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
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pestana.activa {
    color: var(--v11-azul);
  }
  .pestana.activa .icono {
    background: var(--v11-azul-tinte);
  }
  .pestana.activa .etiqueta {
    font-weight: 700;
  }
  .pestana:focus-visible {
    outline: none;
  }
  .pestana:focus-visible .icono {
    outline: 2px solid var(--v11-foco);
  }
</style>
