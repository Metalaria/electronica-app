// Hash-based routing (works from files inside Tauri) and history management.
//
// Routes:  #/                    home
//          #/<parte>             a part, at the reader's last position
//          #/<parte>/<ancla>     a part, scrolled to the element whose id is <ancla>
//          #/glosario[/<ancla>]  the glossary view (the «glosario» part)
//          #/marcadores          bookmarks and notes
//          #/simulador[/<id>]    the circuit simulator: index, a netlist of the book (cap42/fig-42.5_filtro_rc)
//                                or «nuevo» (free-form circuit)
//          #/editor[/<id>|/libro/<netlist>|/importar]  the schematic editor, a tab of the simulator (view
//                                «simulador», ruta.sim = «editor…»): the draft, a saved circuit, a book netlist as a drawing
//          #/protoboard[/<id>]   the virtual breadboard, a tab of the simulator (view «simulador», ruta.sim =
//                                «protoboard…»): the working board of this device, or a saved own circuit
//          #/componentes[/<id>]  the component animations: gallery, or one animation
//          #/conceptos[/<id>]    the concept animations (phasors, Fourier, aliasing…): gallery, or one
//          #/consolas[/<maquina>/<vista>[/<seleccion>]]  NES and Neo Geo mainboards (componentes/consolas)
//          #/fm7303[/<capa>[/<seleccion>]]  the FM7303 kit, live (componentes/fm7303)
//          #/proyectos[/<placa>/<vista>[/<seleccion>]]  the KiCad boards of the book (componentes/proyectos)
//          #/calculadoras[/<id>]  formula calculators: catalogue, or one formula (componentes/calculadoras)
//          #/repaso[/tarjetas|test/<parte>|examen|repasar[/<parte>]]  flashcards and quizzes (componentes/repaso)
//          #/ejercicios[/repaso]  exercises and problems by chapter, or the review of the failed ones
//          #/sincronizacion      GitHub synchronisation of the reader's data and update check
//          #/diagnostico         performance diagnostic of this device (componentes/diagnostico), from «Ajustes»
//          #/diagnostico/informe the same page at its «Informe de fallos» (1.0)
//          #/leccion/<parte>/<seccion>[/<n>|/pregunta-<n>|/fin]  a section studied step by step (componentes/leccion):
//                                step n (1-based), a question after the steps, or the summary
//          #/cursos[/<curso>[/prueba]]  the thematic courses (0.11, componentes/cursos): all, one, its placement test
//          #/progreso[/dominio]  level, XP, streak and achievements (0.11, componentes/progreso); «Dominio»: mastery
//                                per concept (group B, componentes/dominio)
//          #/practicar[/<parte>[/<seccion>]]  «Práctica inteligente» (group B, componentes/practicar): a session of
//                                ~10 items chosen for the reader, or focused on a chapter or a section
//          #/problema[/ayer]     the problem of the day, or yesterday's with its solution (group B, componentes/problema)
//          #/guia[/<seccion>[/<apartado>]]  the in-app user guide (1.0, componentes/guia, content in lib/guia/contenido.ts)
//          #/etapas[/<parte>[/<n>]]  1.1 projects by stages (componentes/proyectos11): the four projects, one, a stage
//          #epa://leccion/<parte>/<label>  1.1: a deep link of the book's QR codes (lib/enlaces.ts), replaced by
//                                #/leccion/<parte>/<label> (also #/epa://…; invalid → #/leccion, «no encontrada»)
//
// Each history entry remembers its scroll position (history.state.y), so «Atrás» (the button,
// the browser or the Android back button) returns exactly where the reader was. Overlays
// (drawer, search, figure viewer) push their own entry so the back button closes them.

import { registrar } from './registro';
import { hayCambiosSinGuardar, olvidarPermiso, preguntandoSalida, puedeSalir } from './salida';
import { miga, rutaSegura } from './informe-fallos';
import { rutaDeHashEnlace } from './enlaces';
import { destinoRetirado } from './datos';

export type Vista = 'inicio' | 'parte' | 'glosario' | 'marcadores' | 'simulador' | 'componentes' | 'conceptos' | 'consolas' | 'instrumentos' | 'fm7303' | 'repaso' | 'ejercicios' | 'calculadoras' | 'proyectos' | 'sincronizacion' | 'diagnostico' | 'leccion' | 'cursos' | 'progreso' | 'practicar' | 'problema' | 'docente' | 'guia' | 'etapas';

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
  // 1.1: a book QR's deep link opened or pasted as a hash (#epa://leccion/<parte>/<label>, lib/enlaces.ts): replaced by
  // its lesson route, validated (anything else that starts with «epa:» opens the lesson page's «no encontrada»)
  const enlace = rutaDeHashEnlace(location.hash);
  if (enlace !== null) history.replaceState(estado(), '', enlace);
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
  } else if (a === 'editor') {
    ruta.vista = 'simulador';
    ruta.parte = '';
    ruta.ancla = '';
    ruta.sim = b ? `editor/${b}` : 'editor';
  } else if (a === 'protoboard') {
    ruta.vista = 'simulador';
    ruta.parte = '';
    ruta.ancla = '';
    ruta.sim = b ? `protoboard/${b}` : 'protoboard';
  } else if (a === 'consolas') {
    ruta.vista = 'consolas';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'proyectos') {
    ruta.vista = 'proyectos';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'fm7303') {
    ruta.vista = 'fm7303';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'instrumentos') {
    ruta.vista = 'instrumentos';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'calculadoras') {
    ruta.vista = 'calculadoras';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'repaso') {
    ruta.vista = 'repaso';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'ejercicios') {
    ruta.vista = 'ejercicios';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'leccion') {
    // #/leccion/<parte>/<seccion>[/<pantalla>]: the part in ruta.parte, «<seccion>[/<pantalla>]» in ruta.ancla
    const [parte = '', ...demas] = resto;
    // 1.1: the lesson of a section a book expansion retired (P02 absorbs 32.13) is the one of where its content went
    const d = destinoRetirado(parte, demas[0] ?? '');
    if (d) history.replaceState(estado(), '', `#/leccion/${d.parte}/${encodeURIComponent(d.label)}`);
    ruta.vista = 'leccion';
    ruta.parte = d ? d.parte : parte;
    ruta.ancla = d ? d.label : demas.join('/');
  } else if (a === 'diagnostico') {
    ruta.vista = 'diagnostico';
    ruta.parte = '';
    // 1.0: #/diagnostico/informe opens it at the «Informe de fallos»
    ruta.ancla = b;
  } else if (a === 'cursos') {
    ruta.vista = 'cursos';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'progreso') {
    ruta.vista = 'progreso';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'practicar') {
    ruta.vista = 'practicar';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'problema') {
    ruta.vista = 'problema';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'etapas') {
    // 1.1: the projects by stages; «<parte>[/<n>]» in ruta.ancla (componentes/proyectos11)
    ruta.vista = 'etapas';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'guia') {
    // 1.0: the user guide; «<seccion>[/<apartado>]» in ruta.ancla (componentes/guia)
    ruta.vista = 'guia';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'docente') {
    // 1.0: own courses and exams (componentes/docente)
    ruta.vista = 'docente';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'sincronizacion') {
    ruta.vista = 'sincronizacion';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'componentes') {
    ruta.vista = 'componentes';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'conceptos') {
    ruta.vista = 'conceptos';
    ruta.parte = '';
    ruta.ancla = b;
  } else if (a === 'glosario') {
    ruta.vista = 'glosario';
    ruta.parte = 'glosario';
    ruta.ancla = b;
  } else {
    // 1.1: a label a book expansion retired (P02 absorbs 32.13: a bookmark, a note, an old link) opens where its
    // content went (lib/datos.ts destinoRetirado)
    const d = destinoRetirado(a, b);
    if (d) history.replaceState(estado(), '', `#/${d.parte}/${encodeURIComponent(d.label)}`);
    ruta.vista = 'parte';
    ruta.parte = d ? d.parte : a;
    ruta.ancla = d ? d.label : b;
  }
  const e = estado();
  ruta.y = typeof e.y === 'number' ? e.y : null;
  ruta.pos = e.pos && typeof e.pos.b === 'number' ? e.pos : null;
  ruta.desde = e.desde ?? null;
  ruta.n++;
  direccionActual = location.href;
  olvidarPermiso();
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
  if (hayCambiosSinGuardar()) {
    // (review 10f: the page on screen has unsaved changes — the teacher-mode editor —: the overlay's entry becomes the
    // page's again and the page asks; only a «yes» goes on)
    history.replaceState({}, '', location.href);
    void puedeSalir().then((ok) => {
      if (!ok) return;
      history.replaceState(st, '', href);
      leer();
    });
    return;
  }
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

/** The address of the route on screen (the last one read, or the one the page put in its place). */
let direccionActual = typeof location === 'undefined' ? '' : location.href;

/**
 * Review 11c: a page that shows another part of itself replaces its address (a lesson's card, «…/sec-1.4/4») without a
 * route change; it calls this so a leave question it then cancels puts back THAT address, not the one the router last
 * read (the lesson's first card: a reload after «Seguir en la lección» had jumped back to it).
 */
export function reemplazarDireccion(h: string): void {
  if (location.hash !== h) history.replaceState(history.state, '', h);
  direccionActual = location.href;
}

/**
 * Review 10f: a route change while the page on screen has unsaved changes (lib/salida.ts) — a link, a button that sets
 * location.hash, the browser's or Android's «Atrás» —: the page's address is put back (a new history entry: the one
 * left behind stays where it was) and the page asks with the app's dialog; only a «yes» goes to where it was going.
 */
function retenerSalida(): boolean {
  const destino = location.href;
  if (!hayCambiosSinGuardar() || destino === direccionActual) return false;
  history.pushState({}, '', direccionActual);
  // (review 10h: a question already open stays — one dialog whatever the number of «Atrás»; its answer decides)
  if (preguntandoSalida()) return true;
  void puedeSalir().then((ok) => {
    if (!ok) return;
    // (review 10h, r10h·6: back over the entry pushed above to the one being reached — no duplicate entries, so the
    // next «Atrás» moves on; the «yes» given lets that change through, lib/salida.ts)
    history.back();
  });
  return true;
}

export function iniciarRuta(): void {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', () => {
    if (retenerSalida()) return;
    if (desdePendiente) {
      history.replaceState({ ...estado(), desde: desdePendiente }, '');
      desdePendiente = null;
    }
    leer();
    // Application log (0.10): the screens visited, so a report says where the reader was.
    registrar('info', 'navegación', decodeURIComponent(location.hash || '#/'));
    // 1.0: and a breadcrumb of the «Informe de fallos» (ids only, lib/informe-fallos.ts)
    miga(`ruta ${rutaSegura(location.hash || '#/')}`);
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
