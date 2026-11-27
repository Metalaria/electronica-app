<script lang="ts">
  // 2.2: the layer of the guided steps (mounted by App.svelte once the app and the reader's data are up). It decides
  // when to offer the app's tour (once per device, new or not: after «Novedades de la 2.1» if that is due, never over a
  // lesson, a menu, «Aa» or the search) and each tool's tutorial (the first time the tool is on screen, if the Guía's
  // switch allows it), at most one offer per page visit; it takes the tours asked from the Guía; and it keeps the one
  // entry of «what is open on top» (lib/encima.ts) while an offer or a tour is on screen, so the system's back closes
  // it. The card and the spotlight are their own chunk (Capa.svelte), loaded the first time one shows.
  import { untrack } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { encima, abrirEncima, irDesdeEncima } from '../../lib/encima';
  import { novedades } from '../../lib/novedades21.svelte';
  import {
    recorridos,
    ofrecido,
    marcarOfrecido,
    ofrecerTutoriales,
    ofertasPermitidas,
    tutorialesEnPantalla,
    type IdRecorrido,
  } from '../../lib/recorridos.svelte';

  // ---------------------------------------------------------------- the entry on top (system back)
  let quitar: (() => void) | null = null;
  /** Whether the layer's entry is on the stack (reactive: after a navigation of its own it is opened again). */
  let registrado = $state(false);
  /** The layer itself is going somewhere (a tour that runs on another page): its entry closes, the tour does not. */
  let navegando = false;
  const enPantalla = $derived(!!(recorridos.oferta || recorridos.activo || recorridos.pedido));

  function alCerrarPorAtras() {
    quitar = null;
    registrado = false;
    if (navegando) {
      navegando = false;
      return;
    }
    // «Atrás», or a link followed elsewhere: whatever is on screen goes, as «Ahora no» / «Salir»
    recorridos.oferta = null;
    recorridos.pedido = null;
    recorridos.activo = null;
  }

  $effect(() => {
    const si = enPantalla;
    const ya = registrado;
    untrack(() => {
      if (si && !ya) {
        quitar = abrirEncima('recorrido', alCerrarPorAtras);
        registrado = true;
      } else if (!si && ya) {
        const q = quitar;
        quitar = null;
        registrado = false;
        q?.();
      }
    });
  });

  /** Goes to `href` keeping the tour (its entry on top is replaced by the destination, then opened again). */
  function ir(href: string): void {
    if (quitar) {
      navegando = true;
      irDesdeEncima(href);
    } else location.hash = href;
  }

  // ---------------------------------------------------------------- offers
  /** The page visit (ruta.n) that already had an offer: one per visit. */
  let visitaConOferta = -1;

  function libre(): boolean {
    return (
      ruta.vista !== 'leccion' &&
      encima.n === 0 &&
      !app.ajustes &&
      !app.buscador &&
      !app.figura &&
      !(app.movil && app.lateral) &&
      novedades.decidido &&
      !novedades.mostrar &&
      !document.querySelector('.confirmacion-host')
    );
  }

  function candidato(): IdRecorrido | null {
    if (!ofrecido('app')) return 'app';
    if (!ofrecerTutoriales()) return null;
    return tutorialesEnPantalla().find((id) => !ofrecido(id)) ?? null;
  }

  $effect(() => {
    if (!ofertasPermitidas()) return;
    // the tool on screen is partly the page's DOM (the bench's segment on a phone): looked at once a second
    let antes: IdRecorrido | null = null;
    const t = setInterval(() => {
      if (enPantalla || ruta.n === visitaConOferta || !libre()) {
        antes = null;
        return;
      }
      const c = candidato();
      // the same candidate on two looks in a row: the page has settled
      if (c && c === antes) {
        visitaConOferta = ruta.n;
        marcarOfrecido(c);
        recorridos.oferta = c;
        antes = null;
      } else antes = c;
    }, 700);
    return () => clearInterval(t);
  });
</script>

{#if enPantalla}
  {#await import('./Capa.svelte') then m}
    <m.default {ir} />
  {/await}
{/if}
