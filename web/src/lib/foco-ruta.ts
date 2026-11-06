// 1.0 accessibility pass: where the keyboard focus goes when the route changes (WCAG 2.4.3, 4.1.3). The app is a
// single page: without this, a link of the rail or a button that changes the route left the focus on the rail (or on
// <body> when the button disappeared with its page), and a screen reader said nothing about the new page.
//
// After every route change (not the first load): when the new page is on screen, the focus goes to its level-1 heading
// (or, in the reader with an anchor, to that element) without scrolling, so the screen reader reads the page's name and
// Tab goes on from the top of the page. Left alone:
//   - a page that moved the focus itself (lessons, practice, the guide, a dialog it opened): the focus is inside main;
//   - the book's index panel (arrows and Enter walk the tree and open sections: the focus stays in the tree);
//   - an overlay that is open (search, figure viewer, the drawer), or an app dialog (lib/confirmar.ts).
// Also the skip link «Saltar al contenido» (App.svelte) uses `enfocarContenido`.

import { hayCapas } from './ruta.svelte';

let generacion = 0;

/** Something the reader can see (not inside a hidden subtree, an inert one or a closed <details>). */
function visible(el: Element): boolean {
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0 || el.classList.contains('solo-lector');
}

function enfocar(el: HTMLElement): void {
  if (!el.hasAttribute('tabindex') && !el.matches('a[href], button, input, select, textarea, [tabindex]')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/** The target of a route: the element of the reader's anchor, else the page's first visible h1, else main itself. */
function destino(main: HTMLElement, ancla: string | null): HTMLElement | null {
  if (ancla) {
    const a = document.getElementById(ancla);
    if (a && main.contains(a) && visible(a)) return a;
  }
  const h = [...main.querySelectorAll<HTMLElement>('h1')].find(visible);
  return h ?? null;
}

/** The focus is somewhere that must keep it (see the header). */
function conservar(main: HTMLElement): boolean {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return false;
  if (!a.isConnected) return false;
  if (main.contains(a) && a !== main) return true;
  if (a.closest('[role="dialog"], [role="alertdialog"], dialog, .confirmacion-host, .epa-pestana')) return true;
  // the book's index panel (tree navigation with the keyboard)
  if (a.closest('aside.lateral') && visible(a)) return true;
  return false;
}

/**
 * Called on every route change. Waits (≤ 4 s, frame by frame) for the new page to draw its heading — lazy pages show
 * «Abriendo…» first — then moves the focus. A newer route change cancels a pending one.
 */
export function focoTrasRuta(ancla: string | null): void {
  const g = ++generacion;
  const limite = performance.now() + 4000;
  const paso = () => {
    if (g !== generacion) return;
    const main = document.getElementById('contenido');
    if (!main || hayCapas()) return;
    if (conservar(main)) return;
    const cargando = !!main.querySelector('.cargando');
    const d = cargando ? null : destino(main, ancla);
    if (d) {
      enfocar(d);
      return;
    }
    if (performance.now() < limite) requestAnimationFrame(paso);
    else if (!conservar(main)) enfocar(main);
  };
  // two frames: the route's components mount and run their own effects (which may focus) first
  requestAnimationFrame(() => requestAnimationFrame(paso));
}

/** The skip link: the focus to the page's heading (or main), scrolled into view. */
export function enfocarContenido(): void {
  const main = document.getElementById('contenido');
  if (!main) return;
  const d = destino(main, null) ?? main;
  enfocar(d);
  d.scrollIntoView({ block: 'start' });
}
