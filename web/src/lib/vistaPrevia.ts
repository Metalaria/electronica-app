// Floating preview of the book's references (a.ref links, wherever they are rendered: reader, exercises,
// glossary, quizzes). This controller is the only part in the start-up bundle: a few delegated listeners on
// the document. The card itself (componentes/vista-previa/) is a lazy chunk, loaded the first time a preview
// is wanted (or when the pointer rests on a reference, so it is ready when the delay ends).
//
// Interaction:
//   mouse     resting ~350 ms on a reference opens the card; leaving reference and card closes it; a click
//             follows the link as always (with «Volver»).
//   touch/pen a tap opens the card instead of jumping; «Ir a …» in the card, or a second tap on the same
//             reference, follows the link exactly as a click did before.
//   keyboard  Enter on a focused reference opens the card and focuses «Ir a …» (Enter again goes there);
//             Esc closes it and gives the focus back to the reference.
// The card closes on Esc, a tap outside it, scrolling the page, or a change of route.

import { cargarParte, obtenerRefs } from './datos';

type Modo = 'raton' | 'toque' | 'teclado';

export interface PeticionVista {
  a: HTMLAnchorElement;
  clave: string;
  modo: Modo;
  /** Pointer position (to choose the line of a reference that wraps). */
  x?: number;
  y?: number;
}

interface ModuloVista {
  abrir(p: PeticionVista, alCerrar: () => void): void;
  cerrar(): void;
}

const RETARDO_ABRIR = 350;
const RETARDO_CERRAR = 280;

let modulo: Promise<ModuloVista> | null = null;
let abierta: HTMLAnchorElement | null = null;
let modoAbierta: Modo | null = null;
let ultimoPuntero = 'mouse';
let temporizadorAbrir: ReturnType<typeof setTimeout> | null = null;
let temporizadorCerrar: ReturnType<typeof setTimeout> | null = null;
let siguiendo = false;
/** Page scroll when the card opened (scrolling the page away closes it). */
let yAbierta = 0;

function cargarModulo(): Promise<ModuloVista> {
  modulo ??= import('../componentes/vista-previa/montar.svelte').then((m) => m as ModuloVista);
  modulo.catch(() => (modulo = null));
  return modulo;
}

/** The reference link under an event target, when it has a preview. */
function referencia(t: EventTarget | null): HTMLAnchorElement | null {
  const el = t instanceof Element ? t : t instanceof Node ? t.parentElement : null;
  const a = el?.closest?.<HTMLAnchorElement>('a.ref[data-ref][href]');
  if (!a || a.getAttribute('aria-disabled') === 'true') return null;
  // references inside the card itself are plain text; inside other dialogs (figure viewer) they jump as before
  if (a.closest('.vista-previa, [aria-modal="true"]')) return null;
  const clave = a.dataset.ref ?? '';
  return obtenerRefs()[clave] ? a : null;
}

/** Starts loading what the card will need (the target part is cached by datos.ts). */
function preparar(a: HTMLAnchorElement): void {
  const r = obtenerRefs()[a.dataset.ref ?? ''];
  if (r) void cargarParte(r.parte).catch(() => {});
  void cargarModulo();
}

function cancelarAbrir(): void {
  if (temporizadorAbrir) clearTimeout(temporizadorAbrir);
  temporizadorAbrir = null;
}

function cancelarCerrar(): void {
  if (temporizadorCerrar) clearTimeout(temporizadorCerrar);
  temporizadorCerrar = null;
}

function cerrada(): void {
  abierta?.removeAttribute('aria-describedby');
  abierta = null;
  modoAbierta = null;
}

async function abrir(a: HTMLAnchorElement, modo: Modo, x?: number, y?: number): Promise<void> {
  cancelarAbrir();
  cancelarCerrar();
  const m = await cargarModulo();
  if (!a.isConnected) return;
  if (abierta && abierta !== a) abierta.removeAttribute('aria-describedby');
  abierta = a;
  modoAbierta = modo;
  yAbierta = window.scrollY;
  m.abrir({ a, clave: a.dataset.ref ?? '', modo, x, y }, () => {
    if (abierta === a) cerrada();
  });
}

export function cerrarVistaPrevia(): void {
  cancelarAbrir();
  cancelarCerrar();
  if (!abierta) return;
  cerrada();
  void modulo?.then((m) => m.cerrar());
}

/** Follows a reference exactly as a plain click on it does (the reader's «Volver» included). */
export function seguirReferencia(a: HTMLAnchorElement): void {
  cerrarVistaPrevia();
  if (a.isConnected) {
    siguiendo = true;
    try {
      a.click();
    } finally {
      siguiendo = false;
    }
  } else {
    const href = a.getAttribute('href');
    if (href) location.hash = href.replace(/^#/, '');
  }
}

function programarCierre(): void {
  if (modoAbierta !== 'raton') return;
  cancelarCerrar();
  temporizadorCerrar = setTimeout(cerrarVistaPrevia, RETARDO_CERRAR);
}

let instalada = false;

export function instalarVistaPrevia(): void {
  if (instalada || typeof document === 'undefined') return;
  instalada = true;

  document.addEventListener(
    'pointerdown',
    (ev) => {
      ultimoPuntero = ev.pointerType || 'mouse';
      if (!abierta) return;
      // a press outside the card and its reference closes it
      const t = ev.target instanceof Element ? ev.target : null;
      if (!t || !(abierta.contains(t) || t.closest('.vista-previa'))) cerrarVistaPrevia();
    },
    { capture: true, passive: true },
  );

  document.addEventListener('pointerover', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const a = referencia(ev.target);
    if (a) {
      if (abierta === a) {
        cancelarCerrar();
        return;
      }
      if (temporizadorAbrir) return;
      preparar(a);
      const { clientX: x, clientY: y } = ev;
      temporizadorAbrir = setTimeout(() => {
        temporizadorAbrir = null;
        if (a.matches(':hover')) void abrir(a, 'raton', x, y);
      }, RETARDO_ABRIR);
    } else if ((ev.target as Element | null)?.closest?.('.vista-previa')) {
      cancelarCerrar();
    }
  });

  document.addEventListener('pointerout', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const desde = referencia(ev.target);
    const hacia = ev.relatedTarget as Node | null;
    if (desde && hacia && desde.contains(hacia)) return;
    if (desde) cancelarAbrir();
    const enTarjeta = (n: Node | null) => !!(n instanceof Element ? n : n?.parentElement)?.closest('.vista-previa');
    if (abierta && (desde === abierta || enTarjeta(ev.target as Node)) && !enTarjeta(hacia) && !(hacia && abierta.contains(hacia))) {
      programarCierre();
    }
  });

  // Capture phase: a tap that opens the card must not reach the reader's own click handler («Volver»).
  document.addEventListener(
    'click',
    (ev) => {
      if (siguiendo) return;
      const a = referencia(ev.target);
      if (!a) return;
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
      const tactil = ultimoPuntero === 'touch' || ultimoPuntero === 'pen';
      if (!tactil || ev.detail === 0) {
        // mouse click (or a synthetic one): jump as always
        cerrarVistaPrevia();
        return;
      }
      if (abierta === a) {
        // second tap on the same reference: go there
        cerrarVistaPrevia();
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      void abrir(a, 'toque');
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key === 'Escape' && abierta) {
        const volverFoco = modoAbierta === 'teclado' || !!(document.activeElement as Element | null)?.closest?.('.vista-previa');
        const a = abierta;
        cerrarVistaPrevia();
        if (volverFoco) a.focus({ preventScroll: true });
        ev.stopPropagation();
        return;
      }
      if (ev.key !== 'Enter' || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
      const a = referencia(ev.target);
      if (!a || ev.target !== a) return;
      if (abierta === a) return; // Enter again on the link itself: follow it
      ev.preventDefault();
      preparar(a);
      void abrir(a, 'teclado');
    },
    true,
  );

  window.addEventListener(
    'scroll',
    () => {
      if (abierta && Math.abs(window.scrollY - yAbierta) > 12) cerrarVistaPrevia();
    },
    { passive: true },
  );
  window.addEventListener('hashchange', cerrarVistaPrevia);
  window.addEventListener('resize', () => {
    if (abierta && modoAbierta === 'raton') cerrarVistaPrevia();
  });
}
