<script lang="ts">
  // 2.1 (owner's item 10): «Novedades de la 2.1», shown once on a device an earlier version used
  // (lib/novedades21.svelte.ts decides and keeps the «seen» mark). A non-modal card: bottom right on the desktop, above
  // the bottom bar on the phone; it takes the focus when it appears (a screen reader reads its title and text), Esc or
  // «Entendido» closes it for good and gives the focus to the page. Never over a lesson (it waits until the lesson ends).
  import { tick } from 'svelte';
  import { ruta } from '../lib/ruta.svelte';
  import { cerrarNovedades } from '../lib/novedades21.svelte';
  import { enfocarContenido } from '../lib/foco-ruta';

  let caja: HTMLElement | undefined = $state();
  const visible = $derived(ruta.vista !== 'leccion');

  $effect(() => {
    if (!visible || !caja) return;
    const c = caja;
    void tick().then(() => c.focus({ preventScroll: true }));
  });

  function cerrar() {
    cerrarNovedades();
    enfocarContenido();
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      cerrar();
    }
  }
</script>

{#if visible}
  <div
    class="novedades"
    role="dialog"
    aria-modal="false"
    aria-labelledby="novedades21-titulo"
    aria-describedby="novedades21-texto"
    tabindex="-1"
    bind:this={caja}
    onkeydown={teclas}
    data-novedades21
  >
    <p class="etiqueta21">Novedades</p>
    <h2 id="novedades21-titulo">La 2.1 ordena la aplicación</h2>
    <div id="novedades21-texto">
      <ul>
        <li>
          <strong>Cinco grupos</strong> en lugar de dieciocho entradas: Inicio, Aprender (Cursos, Repaso, Progreso), Libro
          (Índice, Ejercicios, Conceptos, Glosario, Marcadores), Taller (Simulador, Protoboard, Instrumentos, Calculadoras,
          Componentes) y Proyectos (Kit FM7303, Consolas, Proyectos del libro). Las partes de cada grupo son pestañas arriba.
        </li>
        <li>La <strong>Guía de uso</strong>, el <strong>Modo docente</strong> y la <strong>Sincronización</strong> están al pie de «Aa».</li>
        <li><strong>Buscar</strong> encuentra también las partes de la aplicación, los instrumentos, las consolas, las calculadoras y los proyectos.</li>
        <li>Cada grupo <strong>recuerda la última pestaña</strong> que usó.</li>
      </ul>
    </div>
    <div class="acciones">
      <button class="boton primario" type="button" onclick={cerrar}>Entendido</button>
      <a class="boton fantasma" href="#/guia/primeros-pasos/navegar" onclick={() => cerrarNovedades()}>Ver la guía</a>
    </div>
  </div>
{/if}

<style>
  .novedades {
    position: fixed;
    right: 24px;
    bottom: calc(24px + var(--hueco-inferior));
    z-index: 45;
    width: min(420px, calc(100vw - 32px));
    max-height: calc(100dvh - var(--alto-barra) - var(--hueco-inferior) - 48px);
    overflow-y: auto;
    padding: var(--e21-3);
    border: 1px solid var(--v11-linea);
    border-radius: 16px;
    background: var(--v11-fondo);
    box-shadow: var(--sombra-alta);
    color: var(--v11-tinta);
    font-family: var(--sans);
    animation: entrar 0.18s ease-out;
  }
  :global(:root[data-tema='oscuro']) .novedades {
    background: var(--v11-panel);
  }
  .novedades:focus {
    outline: none;
  }
  .novedades:focus-visible {
    outline: 2px solid var(--v11-foco);
    outline-offset: 2px;
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  h2 {
    margin: 4px 0 var(--e21-2);
    font-size: 20px;
    font-weight: 600;
    line-height: 1.25;
  }
  ul {
    display: grid;
    gap: 8px;
    margin: 0;
    padding-left: 1.1em;
    color: var(--v11-tinta-suave);
    font-size: 15px;
    line-height: 1.45;
  }
  strong {
    color: var(--v11-tinta);
    font-weight: 600;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: var(--e21-3);
  }
  @media (max-width: 1023px) {
    .novedades {
      right: 16px;
      left: 16px;
      bottom: calc(16px + var(--hueco-inferior));
      width: auto;
      margin: 0 auto;
      max-width: 520px;
    }
  }
</style>
