// 2.2: the guided steps — the tour of the app and the tools' tutorials (componentes/recorridos/*, the steps in
// lib/recorridos-pasos.ts). This module is the small part the app's start-up carries: what has been offered and seen
// on this device, the «offer the tutorial the first time I open a tool» switch, which tour is running, and the live
// state of the tool on screen (the bench, the breadboard) that a step's «done» check reads.
//
// Marks: one device-local key, `epa:recorridos` ({ v: { <id>: 1 offered | 2 seen }, ofrecer: false }), read and
// written straight in localStorage as `epa:novedades-21` is: not a store of lib/almacen.ts, not in lib/esquemas.ts, not
// synchronised, so the data format does not change. The breadboard's 2.1 tour mark (`epa:protoboard-recorrido`) still
// counts as «seen» and is still written when its tutorial ends, so whoever saw that tour is not asked again.
//
// Under automation (navigator.webdriver: every Playwright suite) nothing is offered by itself unless the page sets
// `window.__epaRecorridos = true` (the tour's own tests): a fresh install would otherwise get the offer over every
// test's page. Starting a tour by hand (the Guía) works the same everywhere.

import { ruta } from './ruta.svelte';
import type { Banco } from '../componentes/instrumentos/banco.svelte.ts';
import type { Protoboard } from '../componentes/protoboard/estado.svelte';

export type IdRecorrido = 'app' | 'brymen' | 'fnirsi-osc' | 'fnirsi-mult' | 'banco' | 'protoboard' | 'simulador' | 'consolas';

export const CLAVE_RECORRIDOS = 'epa:recorridos';
export const CLAVE_PROTOBOARD_21 = 'epa:protoboard-recorrido';

interface Marcas {
  v: Partial<Record<IdRecorrido, 1 | 2>>;
  ofrecer?: boolean;
}

function leerMarcas(): Marcas {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE_RECORRIDOS) ?? 'null') as Marcas | null;
    const v = m && typeof m.v === 'object' && m.v ? m.v : {};
    const res: Marcas = { v: { ...v } };
    if (m?.ofrecer === false) res.ofrecer = false;
    if (localStorage.getItem(CLAVE_PROTOBOARD_21) === '1') res.v.protoboard = 2;
    return res;
  } catch {
    // private mode, no storage: nothing is offered (it would come back on every start)
    return { v: { app: 2, brymen: 2, 'fnirsi-osc': 2, 'fnirsi-mult': 2, banco: 2, protoboard: 2, simulador: 2, consolas: 2 } };
  }
}

/** Reactive copy of the marks (the Guía's list ticks, the switch). */
export const marcas = $state<Marcas>(leerMarcas());

function guardar(): void {
  try {
    const m: Marcas = { v: { ...marcas.v } };
    if (marcas.ofrecer === false) m.ofrecer = false;
    localStorage.setItem(CLAVE_RECORRIDOS, JSON.stringify(m));
  } catch {
    /* private mode */
  }
}

export function visto(id: IdRecorrido): boolean {
  return marcas.v[id] === 2;
}

export function ofrecido(id: IdRecorrido): boolean {
  return (marcas.v[id] ?? 0) >= 1;
}

export function marcarOfrecido(id: IdRecorrido): void {
  if (ofrecido(id)) return;
  marcas.v[id] = 1;
  guardar();
}

export function marcarVisto(id: IdRecorrido): void {
  marcas.v[id] = 2;
  guardar();
  if (id === 'protoboard') {
    try {
      localStorage.setItem(CLAVE_PROTOBOARD_21, '1');
    } catch {
      /* private mode */
    }
  }
}

/** «Ofrecer el tutorial la primera vez que abro una herramienta» (on by default). */
export function ofrecerTutoriales(): boolean {
  return marcas.ofrecer !== false;
}

export function ponerOfrecerTutoriales(si: boolean): void {
  if (si) delete marcas.ofrecer;
  else marcas.ofrecer = false;
  guardar();
}

/** Whether tours may be offered by themselves here (not under automation, unless a test asks for it). */
export function ofertasPermitidas(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !navigator.webdriver || !!(window as unknown as { __epaRecorridos?: boolean }).__epaRecorridos;
}

// ------------------------------------------------------------------ what runs

export const recorridos = $state({
  /** The tour on screen, its step (0-based). */
  activo: null as IdRecorrido | null,
  paso: 0,
  /** The offer card on screen. */
  oferta: null as IdRecorrido | null,
  /** A tour asked to start (the Guía, the offer): the layer takes it, goes where it runs and opens it. */
  pedido: null as IdRecorrido | null,
});

/** Starts a tour (from the Guía's list or an offer). */
export function empezarRecorrido(id: IdRecorrido): void {
  recorridos.oferta = null;
  recorridos.pedido = id;
}

// ------------------------------------------------------------------ the tool on screen

/** The live tools a step reads (registered by the components while they are mounted). */
export const vivo = $state({
  banco: null as Banco | null,
  protoboard: null as Protoboard | null,
});

/** The bench registers itself while it is mounted (componentes/instrumentos/banco/activo.svelte.ts). */
export function registrarBanco(b: Banco): () => void {
  vivo.banco = b;
  return () => {
    if (vivo.banco === b) vivo.banco = null;
  };
}

/** The breadboard page registers its board while it is mounted (componentes/protoboard/Protoboard.svelte). */
export function registrarProtoboard(pb: Protoboard): () => void {
  vivo.protoboard = pb;
  return () => {
    if (vivo.protoboard === pb) vivo.protoboard = null;
  };
}

// ------------------------------------------------------------------ where each tutorial runs

const enProtoboard = () => ruta.vista === 'simulador' && (ruta.sim === 'protoboard' || ruta.sim.startsWith('protoboard/'));

export const sitio = {
  /** A bench of the instruments (a practice, a catalogue circuit, the free bench), not a guided lab (it guides already). */
  banco: () => ruta.vista === 'instrumentos' && !!ruta.ancla && !ruta.ancla.startsWith('laboratorio'),
  /** The breadboard page, not while «Monta este circuito» or a lesson guides it. */
  protoboard: () => enProtoboard() && !!vivo.protoboard && !vivo.protoboard.guia && !vivo.protoboard.leccion,
  /** A netlist of the book in the simulator (#/simulador/cap42/fig-42.5_filtro_rc). */
  netlist: () => ruta.vista === 'simulador' && /^(cap|ap)[^/]*\/./.test(ruta.sim),
  /** The simulator's list of netlists or one of them. */
  simulador: () => ruta.vista === 'simulador' && (ruta.sim === '' || sitio.netlist()),
  /** The consoles on the photo view (where #/consolas and #/consolas/<maquina> open). */
  consolas: () => ruta.vista === 'consolas' && ['', 'foto'].includes(ruta.ancla.split('/')[1] ?? ''),
};

function visibleId(id: string): boolean {
  const e = document.getElementById(id);
  return !!e && e.getClientRects().length > 0;
}

/** The tutorials of the tools on screen, in the order they are offered (the first not offered yet wins). */
export function tutorialesEnPantalla(): IdRecorrido[] {
  if (sitio.banco()) {
    const b = vivo.banco;
    if (!b || !b.texto) return [];
    const fn: IdRecorrido = b.fnirsi.modo === 'osc' ? 'fnirsi-osc' : 'fnirsi-mult';
    // on a phone the bench shows one thing at a time (its segments): the tutorial of what is shown
    if (visibleId('banco-seg-brymen')) {
      const seg = document.querySelector('.banco[data-segmento]')?.getAttribute('data-segmento');
      return seg === 'brymen' ? ['brymen'] : seg === 'fnirsi' ? [fn] : seg === 'circuito' ? ['banco'] : [];
    }
    return ['brymen', fn, 'banco'];
  }
  if (sitio.protoboard()) return ['protoboard'];
  if (sitio.simulador()) return ['simulador'];
  if (sitio.consolas()) return ['consolas'];
  return [];
}
