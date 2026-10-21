// Hash-based routing (works from files inside Tauri) and history management.
//
// Routes:  #/                    home
//          #/<parte>             a part, at the reader's last position
//          #/<parte>/<ancla>     a part, scrolled to the element whose id is <ancla>
//          #/glosario[/<ancla>]  the glossary view (the «glosario» part)
//          #/marcadores          bookmarks and notes
//          #/simulador[/<id>]    the circuit simulator: index, a netlist of the book (cap42/fig-42.5_filtro_rc)
//                                or «nuevo» (free-form circuit)
//          #/componentes[/<id>]  the component animations: gallery, or one animation
//
// Each history entry remembers its scroll position (history.state.y), so «Atrás» (the button,
// the browser or the Android back button) returns exactly where the reader was. Overlays
// (drawer, search, figure viewer) push their own entry so the back button closes them.

export type Vista = 'inicio' | 'parte' | 'glosario' | 'marcadores' | 'simulador' | 'componentes';

export interface AnclaLectura {
  /** Index of the top-level block at the top of the screen. */
  b: number;
  /** Pixels of that block already scrolled past. */
  off: number;
}

export interface EstadoHistoria {
  /** Scroll position of this entry. */
  y?: number;
  /** The same position as a block anchor: robust to images that load late or font changes. */
  pos?: AnclaLectura;
  /** Where the reader came from when the entry was reached through a reference. */
  desde?: { texto: string };
  /** Overlay entry. */
  capa?: string;
}

export const ruta = $state({
  vista: 'inicio' as Vista,
  parte: '',
  ancla: '',
  /** Simulator page: '' (index), 'nuevo' or a netlist id. */
  sim: '',
  /** Increments on every navigation, so the same route can be visited again. */
  n: 0,
  /** Scroll to restore (back/forward), or null to go to the anchor / last position. */
  y: null as number | null,
  pos: null as AnclaLectura | null,
  desde: null as { texto: string } | null,
});

function estado(): EstadoHistoria {
  const s: unknown = history.state;
  return s && typeof s === 'object' ? (s as EstadoHistoria) : {};
}

function leer(): void {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [a = '', ...resto] = h.split('/');
  const b = resto.join('/');
  if (!a) {
    ruta.vista = 'inicio';
    ruta.parte = '';
    ruta.ancla = '';
  } else if (a === 'marcadores') {
    ruta.vista = 'marcadores';
    ruta.parte = '';
    ruta.ancla = '';
  } else if (a === 'simulador') {
    ruta.vista = 'simulador';
    ruta.parte = '';
    ruta.ancla = '';
    ruta.sim = b;
  } else if (a === 'componentes') {
    ruta.vista = 'componentes';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'glosario') {
    ruta.vista = 'glosario';
    ruta.parte = 'glosario';
    ruta.ancla = b;
  } else {
    ruta.vista = 'parte';
    ruta.parte = a;
    ruta.ancla = b;
  }
  const e = estado();
  ruta.y = typeof e.y === 'number' ? e.y : null;
  ruta.pos = e.pos && typeof e.pos.b === 'number' ? e.pos : null;
  ruta.desde = e.desde ?? null;
  ruta.n++;
}

// ------------------------------------------------------------------ overlays

interface Capa {
  id: string;
  cerrar: () => void;
}
const pila: Capa[] = [];

/** Opens an overlay: pushes a history entry so that «Atrás» closes it. */
export function abrirCapa(id: string, cerrar: () => void): void {
  if (pila.some((c) => c.id === id)) return;
  // Remember where the page was before covering it.
  if (!pila.length && !estado().capa) history.replaceState({ ...estado(), ...posicionActual() }, '');
  history.pushState({ capa: id } satisfies EstadoHistoria, '', location.href);
  pila.push({ id, cerrar });
}

/** Closes an overlay from the UI (button, Esc): goes back over its history entry. */
export function cerrarCapa(id: string): void {
  const top = pila[pila.length - 1];
  if (top?.id === id) history.back();
}

export function hayCapas(): boolean {
  return pila.length > 0;
}

/**
 * Navigates from inside an overlay: the overlay entry is replaced by the destination, so the
 * history stays [page, destination] and «Atrás» returns to the page.
 */
export function navegarDesdeCapa(href: string, desde?: { texto: string }): void {
  while (pila.length) pila.pop()?.cerrar();
  const st: EstadoHistoria = desde ? { desde } : {};
  history.replaceState(st, '', href);
  leer();
}

// ------------------------------------------------------------------ scroll memory

let ultimoGuardado = 0;
let proveedorAncla: (() => AnclaLectura | null) | null = null;

/** The reader registers how to describe the current position as a block anchor. */
export function registrarAncla(fn: (() => AnclaLectura | null) | null): void {
  proveedorAncla = fn;
}

function posicionActual(): EstadoHistoria {
  const pos = proveedorAncla?.() ?? undefined;
  return { y: Math.round(window.scrollY), pos };
}
let temporizador: ReturnType<typeof setTimeout> | null = null;

/** Stores the current scroll in the current history entry (throttled: Safari limits replaceState). */
export function recordarScroll(inmediato = false): void {
  if (pila.length) return;
  const hacer = () => {
    temporizador = null;
    ultimoGuardado = Date.now();
    const e = estado();
    if (e.capa) return;
    history.replaceState({ ...e, ...posicionActual() }, '');
  };
  if (inmediato) {
    if (temporizador) clearTimeout(temporizador);
    hacer();
    return;
  }
  if (temporizador) return;
  const espera = Math.max(0, 800 - (Date.now() - ultimoGuardado));
  temporizador = setTimeout(hacer, espera);
}

/** Marks the current entry as reached from a reference, to offer a «Volver» button. */
export function marcarDesde(desde: { texto: string }): void {
  history.replaceState({ ...estado(), desde }, '');
  ruta.desde = desde;
}

let desdePendiente: { texto: string } | null = null;

/** Called just before following a reference link: the next entry will offer «Volver». */
export function prepararSalto(desde: { texto: string }): void {
  desdePendiente = desde;
}

export function iniciarRuta(): void {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', () => {
    if (desdePendiente) {
      history.replaceState({ ...estado(), desde: desdePendiente }, '');
      desdePendiente = null;
    }
    leer();
  });
  window.addEventListener('popstate', () => {
    const top = pila[pila.length - 1];
    if (top && estado().capa !== top.id) {
      pila.pop();
      top.cerrar();
    }
  });
  // Every internal link records the scroll of the entry it leaves.
  document.addEventListener(
    'click',
    (ev) => {
      const a = (ev.target as Element | null)?.closest?.('a[href^="#/"]');
      if (a) recordarScroll(true);
    },
    true,
  );
  // If the app is opened on an overlay entry (reload), drop it.
  if (estado().capa) history.replaceState({}, '');
  leer();
}

export function volver(): void {
  history.back();
}
