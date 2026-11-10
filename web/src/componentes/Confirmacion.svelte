<script lang="ts">
  // The app's own confirmation dialog (0.12; opened by lib/confirmar.ts). window.confirm cannot be trusted in the
  // apps: on desktop tauri-plugin-dialog replaces it with an async function (its Promise is always truthy, so «¿Borrar?»
  // would delete without asking), WKWebView without a confirm delegate answers «no», and Android's depends on the
  // WebChromeClient (English buttons). This one is the same in the browser, desktop and Android, and needs no
  // permission. role=alertdialog, modal (the rest of the page is inert while it is open), the focus starts on the safe
  // option, Tab stays inside, Escape and a click outside cancel, and the focus goes back to whatever asked.
  // Keys: `inert` does not stop key events from reaching window listeners (the editor's Supr, «g», Ctrl+Z, Ctrl+S…), so
  // while it is open a window capture-phase guard stops every keydown/keyup/keypress before any other listener
  // (handling Escape and Tab itself); Enter and Space still activate the focused button (default actions are kept).
  import { onMount } from 'svelte';

  interface Props {
    titulo: string;
    mensaje?: string;
    /** The destructive button («Borrar», «Descartar»). */
    aceptar: string;
    cancelar?: string;
    responder: (si: boolean) => void;
  }
  let { titulo, mensaje = '', aceptar, cancelar = 'Cancelar', responder }: Props = $props();

  const uid = $props.id();
  let caja: HTMLDivElement;
  let botonCancelar: HTMLButtonElement;
  let respondido = false;
  const abierto = performance.now();
  /** The press that ends in a click on the backdrop began on the backdrop too (not on the button that opened it). */
  let pulsadoEnFondo = false;

  function fin(si: boolean) {
    if (respondido) return;
    respondido = true;
    responder(si);
  }

  function guardia(e: KeyboardEvent) {
    // nothing else on the page hears the keyboard while the question is open
    e.stopImmediatePropagation();
    if (e.type !== 'keydown') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      fin(false);
    } else if (e.key === 'Tab') {
      const botones = [...caja.querySelectorAll<HTMLButtonElement>('button')];
      const i = botones.indexOf(document.activeElement as HTMLButtonElement);
      const j = e.shiftKey ? (i <= 0 ? botones.length - 1 : i - 1) : i === botones.length - 1 ? 0 : i + 1;
      e.preventDefault();
      botones[j]?.focus();
    }
  }

  function fondoPulsado(e: PointerEvent) {
    pulsadoEnFondo = e.target === e.currentTarget;
  }

  function fondoClic(e: MouseEvent) {
    // a double click on the button that asked lands its second click here: ignored (and the first 300 ms)
    if (e.target === e.currentTarget && pulsadoEnFondo && performance.now() - abierto > 300) fin(false);
    pulsadoEnFondo = false;
  }

  onMount(() => {
    botonCancelar.focus();
    const tipos = ['keydown', 'keyup', 'keypress'] as const;
    for (const t of tipos) window.addEventListener(t, guardia, true);
    return () => {
      for (const t of tipos) window.removeEventListener(t, guardia, true);
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape is handled by the guard) -->
<div class="fondo" onpointerdown={fondoPulsado} onclick={fondoClic}>
  <div
    class="caja"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="confirmacion-titulo-{uid}"
    aria-describedby={mensaje ? `confirmacion-mensaje-${uid}` : undefined}
    tabindex="-1"
    bind:this={caja}
  >
    <h2 id="confirmacion-titulo-{uid}">{titulo}</h2>
    {#if mensaje}<p id="confirmacion-mensaje-{uid}">{mensaje}</p>{/if}
    <div class="botones">
      <button class="boton toque-44" bind:this={botonCancelar} onclick={() => fin(false)}>{cancelar}</button>
      <button class="boton peligro toque-44" onclick={() => fin(true)}>{aceptar}</button>
    </div>
  </div>
</div>

<style>
  .fondo {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(10, 15, 20, 0.45);
    animation: aparecer 0.12s ease-out;
  }
  @keyframes aparecer {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fondo {
      animation: none;
    }
  }
  .caja {
    width: min(420px, 100%);
    padding: 24px 22px 20px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta);
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    color: var(--tinta);
    font-family: var(--sans);
  }
  .caja:focus {
    outline: none;
  }
  h2 {
    margin: 0;
    color: var(--titulos);
    font-size: 20px;
    font-weight: 700;
    line-height: 1.25;
  }
  p {
    margin: 8px 0 0;
    color: var(--tinta-suave);
    font-size: 15px;
    line-height: 1.45;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }
  /* (1.1: the app's 44 px buttons everywhere; 88 px wide on touch screens) */
  .boton {
    padding: 0 18px;
  }
  @media (pointer: coarse) {
    .boton {
      min-width: 88px;
    }
  }
  /* destructive: the theme's warning ink as background, the surface colour as text (both themes keep >= 4.5:1) */
  .peligro {
    background: var(--c-precaucion);
    border-color: var(--c-precaucion);
    color: var(--superficie);
  }
  .peligro:hover {
    filter: brightness(1.08);
    background: var(--c-precaucion);
  }
</style>
