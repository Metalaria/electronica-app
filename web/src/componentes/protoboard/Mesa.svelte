<script lang="ts">
  // The breadboard on the bench: the boards, the parts, the wires and the equipment, with every gesture
  // through pointer events (mouse, pen, touch). Tap a part or wire to select it; drag it to move it (it snaps
  // to the holes and turns red where it cannot go); drag the handle of a leg (two-leg parts) or the end of a
  // wire to plug it elsewhere. Wires (0.11): a tap on a free hole starts one (its strip lit) and a tap on another
  // ends it, or a drag from hole to hole with the wire following the finger; a long press on a wire removes it;
  // wires are drawn over the parts with a wide touch area. Parts of the tray (0.11) are dragged in as a ghost
  // that lands exactly in the holes it shows (green when it fits, red with the reason when not), or put by a
  // tap on the board after a tap on their card. Empty space pans; pinch or Ctrl/⌘ + wheel zooms. Tapping a
  // hole shows its strip, its net and (after a simulation) its voltage. `touch-action: none` and
  // preventDefault keep the browser from zooming the page.
  // 1.3 (tactil13), precise placement with a finger (componentes/colocar/): a lead, a leg or a wire's end dragged by
  // a finger rides ELEVACION_DEDO px above it and snaps to the nearest valid hole with hysteresis; a loupe near the
  // finger shows the area with that hole ringed and named («C12 · tira 12 de arriba»), a short vibration marks each
  // change of hole and the landing; released off the holes it stays where it was. On a phone with holes smaller than
  // a finger the view zooms in while dragging and goes back on release (no animation with «reducir movimiento»).
  // After a placement dragged by a finger four arrows around it move it one hole at a time (not after a tap: in the
  // tap-tap flow the next tap goes near, often where an arrow would be).
  // 1.3 (averias13), the same precision for what a tap places — a meter lead, the start or the end of a wire, a part
  // chosen in the tray —: a finger held on the bench shows at once, in the loupe, the hole the tap takes and its name;
  // held still a little longer (MIRA_ARMAR) it «aims»: sliding the finger moves that hole (with hysteresis) instead of
  // panning or laying the wire, and lifting it places there, as a tap on that hole would. A quick tap is as before
  // (the tutors' tap-tap flow). A tray part dragged in by a finger gets the loupe too, named with the holes its legs
  // take («R1 · B10 y B14»), in red with the reason when it cannot go.
  import { onMount, untrack, type Snippet } from 'svelte';
  import type { Protoboard } from './estado.svelte';
  import { cable as svgCable, defsProtoboard, posRotulo, rotuloCorto, svgPieza, svgPlacas } from './dibujo.ts';
  import { cajaCuerpo, cajaExterno, cuerpoDe, esquinas, encapsuladoDe, EXTERNOS } from './encapsulados.ts';
  import { agujero, agujerosDe, ALTO_PLACA, clavePt, etiquetaHueco, nombreAgujero, type Pt } from './placa.ts';
  import { borneEn, motivoExtremo, piezaDe } from './edicion.ts';
  import Lupa from '../colocar/Lupa.svelte';
  import AjusteFino from '../colocar/AjusteFino.svelte';
  import { ELEVACION_DEDO, elevacion, histeresisRejilla, huecoConHisteresis, siguienteHueco, zoomAutomatico, type Direccion } from '../colocar/precision';
  import { vibrarAterrizaje, vibrarCambio } from '../colocar/haptica';
  import { movimiento } from '../figuras-vivas/carga.svelte';
  import { migaAccion } from '../../lib/informe-fallos';
  import { huecoCercano as huecoMasCercano } from './leccion.ts';
  import { pulsar } from './pulsar.ts';
  import type { Componente } from '../editor/tipos.ts';
  import Plus from '@lucide/svelte/icons/plus';
  import Minus from '@lucide/svelte/icons/minus';
  import Maximize from '@lucide/svelte/icons/scan';
  import { redEn } from './conexiones.ts';
  import { verificarMontaje } from './verificar.ts';
  import { formatoSI } from '../grafica/formato.ts';
  import { CONMUTABLES } from '../editor/catalogo.ts';
  import { clavePin, type CableProto, type Pieza } from './tipos.ts';
  import type { MedidaProtoboard } from './medida.svelte.ts';
  import { COLOR_PUNTA, LETRA_PUNTA, NOMBRE_PUNTA_PROTO, type PuntaProto } from '../instrumentos/puntas.ts';

  let {
    pb,
    rotulos = true,
    encendidos = {},
    ruedaDesplaza = false,
    alTocar,
    medida = null,
    guia = null,
    controles = false,
    vacia = '',
    flotante,
    sinInfo = false,
  }: {
    pb: Protoboard;
    rotulos?: boolean;
    /** LED brightness by piece id. */
    encendidos?: Record<string, number>;
    /** The wheel pans (full-screen view); otherwise a plain wheel scrolls the page. */
    ruedaDesplaza?: boolean;
    /** Double tap / double click on a part. */
    alTocar?: (id: string) => void;
    /** The instruments' leads (0.10): drawn, and placed by a tap with the «medir» tool. */
    medida?: MedidaProtoboard | null;
    /** «Monta este circuito» (0.11): the holes to light, the part's silhouette where it goes, the wire to lay. */
    guia?: { puntos: Pt[]; pieza?: Pieza | null; cable?: [Pt, Pt] | null; luces?: Pt[] } | null;
    /** Zoom buttons over the bench (0.11). */
    controles?: boolean;
    /** A hint in the middle of an empty board (0.11). */
    vacia?: string;
    /** The floating bar of the selection (0.11), placed by the bench next to it (box in px of the bench). */
    flotante?: Snippet<[{ x: number; y: number; w: number; h: number; ancho: number; alto: number }]>;
    /** Something else speaks at the foot of the bench (the guide's answer): no info line. */
    sinInfo?: boolean;
  } = $props();

  type Gesto =
    | { t: 'pieza'; ids: string[]; desde: Pt; ini: Pt; dx: number; dy: number; movido: boolean }
    | { t: 'pata'; id: string; i: number; q: Pt; desde: Pt; movido: boolean; fuera?: boolean }
    | { t: 'extremo'; id: string; e: 'a' | 'b'; q: Pt; desde: Pt; movido: boolean; fuera?: boolean }
    | { t: 'cable'; a: Pt; b: Pt; desde: Pt; movido: boolean; fuera?: boolean }
    | { t: 'pan'; desde: Pt; t0: Pt; movido: boolean; o?: { t: 'pieza' | 'cable'; id: string }; enCable?: boolean }
    /** A probe of the instruments dragged to another hole (0.10). */
    | { t: 'sonda'; p: PuntaProto; q: Pt; desde: Pt; movido: boolean; fuera?: boolean };
  /** 1.3: what was last placed by touch (the fine-adjust arrows move it). */
  type Colocado = { t: 'sonda'; p: PuntaProto } | { t: 'pata'; id: string; i: number } | { t: 'extremo'; id: string; e: 'a' | 'b' };

  let caja: HTMLDivElement | undefined = $state();
  let ancho = $state(600);
  let alto = $state(400);
  /** Screen px per pitch and the translation (screen px). */
  let s = $state(16);
  let tx = $state(20);
  let ty = $state(20);
  let gesto = $state<Gesto | null>(null);
  /** First hole of a wire laid tap by tap. */
  let pendiente = $state<Pt | null>(null);
  let cursor = $state<Pt | null>(null);
  /** Net highlighted (selected part, tapped hole). */
  let redMarcada = $state<string | null>(null);
  let info = $state('');
  /** A part of the tray being dragged in (0.11): where its legs would land and why it cannot, if so. */
  let fant = $state.raw<{ p: Pieza; motivo: string | null } | null>(null);
  /** Long press on a wire (removes it). */
  let largo: ReturnType<typeof setTimeout> | null = null;
  /** 1.3: a placement dragged by a finger — the lifted point (client px) the loupe looks at. */
  let colocando = $state<{ x: number; y: number } | null>(null);
  /** 1.3: the fine-adjust arrows, on what was last placed by touch. */
  let ajuste = $state<Colocado | null>(null);
  /** 1.3: the view before the auto zoom of a placement drag (restored on release). */
  let vistaPrevia: { s: number; tx: number; ty: number } | null = null;
  let grupo: SVGGElement | undefined = $state();
  /** 1.3 (averias13): a tap-placement held by a finger (see the header): where the finger is, the hole it takes. */
  let mira = $state<{ dedo: Pt; q: Pt | null; visible: boolean; armada: boolean } | null>(null);
  let miraVer: ReturnType<typeof setTimeout> | null = null;
  let miraArmar: ReturnType<typeof setTimeout> | null = null;
  /** 1.3 (averias13): a tray part dragged in by a finger — the lifted point the loupe looks at. */
  let colocandoFant = $state<{ x: number; y: number } | null>(null);

  const cfg = $derived({ placas: pb.doc.placas, columnas: pb.doc.columnas });
  const placasSvg = $derived(svgPlacas(cfg));
  const externos = $derived(pb.doc.piezas.filter((p) => EXTERNOS.has(p.enc)));
  const enPlaca = $derived(pb.doc.piezas.filter((p) => !EXTERNOS.has(p.enc)));
  const bornes = $derived(new Set(externos.flatMap((p) => p.pos.map((q) => clavePt(q[0], q[1])))));
  const esPunta = (w: CableProto) => bornes.has(clavePt(w.a[0], w.a[1])) || bornes.has(clavePt(w.b[0], w.b[1]));
  const cablesPlaca = $derived(pb.doc.cables.filter((w) => !esPunta(w)));
  const puntas = $derived(pb.doc.cables.filter((w) => esPunta(w)));
  const seleccion = $derived(new Set(pb.sel));

  // ---------------------------------------------------------------- coordinates

  function rel(cx: number, cy: number): Pt {
    const r = caja!.getBoundingClientRect();
    return [cx - r.left, cy - r.top];
  }
  function mundo(cx: number, cy: number): Pt {
    const [x, y] = rel(cx, cy);
    return [(x - tx) / s, (y - ty) / s];
  }
  const red0 = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];
  const tactilGrueso = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  function limites(): [number, number, number, number] {
    let y0 = -1.5;
    for (const p of externos) y0 = Math.min(y0, cajaExterno(p)[1] - 0.5);
    return [-1.4, y0, pb.doc.columnas + 2.4, pb.doc.placas * ALTO_PLACA - 2.4];
  }

  export function ajustar() {
    const [x0, y0, x1, y1] = limites();
    s = Math.min(60, Math.max(4, Math.min(ancho / (x1 - x0), alto / (y1 - y0))));
    tx = (ancho - (x1 - x0) * s) / 2 - x0 * s;
    ty = Math.max(4, (alto - (y1 - y0) * s) / 2) - y0 * s;
  }
  /** Fits the width of the board (phones: the board legible, the equipment above by scrolling). */
  export function ajustarAncho() {
    const [x0, , x1] = limites();
    s = Math.min(60, Math.max(4, ancho / (x1 - x0)));
    tx = -x0 * s;
    ty = alto - (pb.doc.placas * ALTO_PLACA - 1.5) * s - 4;
    if (ty > 2 * s) ty = Math.min(ty, -limites()[1] * s + 4);
  }
  /**
   * Phones (0.11): holes big enough for a finger — the first 18 columns with the equipment above them (two
   * fingers or «Ver todo» show the rest).
   */
  export function ajustarDedo() {
    const [x0, y0] = limites();
    s = Math.min(60, Math.max(4, ancho / 18.8));
    tx = -Math.max(x0, -0.6) * s;
    ty = -Math.max(y0, -9.2) * s + 4;
    // A board with parts further right: centre on them instead.
    const xs = pb.doc.piezas.filter((p) => !EXTERNOS.has(p.enc)).flatMap((p) => p.pos.map((q) => q[0]));
    if (xs.length && Math.max(...xs) > 17) {
      const c = (Math.min(...xs) + Math.max(...xs)) / 2;
      tx = ancho / 2 - c * s;
    }
  }
  /** Brings these points into view (the guide's step), panning — and zooming out if they do not fit. */
  export function mostrar(puntos: Pt[]) {
    if (!puntos.length || ancho < 50) return;
    // (the foot of the bench is for the answers and the info line)
    const m = 30;
    const abajo = 110;
    const xs = puntos.map((q) => q[0]);
    const ys = puntos.map((q) => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs) - 1.5, Math.max(...xs) + 1.5, Math.min(...ys) - 1.5, Math.max(...ys) + 1.5];
    const dentroVista = x0 * s + tx >= m && x1 * s + tx <= ancho - m && y0 * s + ty >= m && y1 * s + ty <= alto - abajo;
    if (dentroVista) return;
    const cabe = Math.min((ancho - 2 * m) / (x1 - x0), (alto - m - abajo) / (y1 - y0));
    if (cabe < s) {
      // Too big for the view at this zoom: zoom out and centre them.
      s = Math.max(4, cabe);
      tx = ancho / 2 - ((x0 + x1) / 2) * s;
      ty = m + (alto - m - abajo) / 2 - ((y0 + y1) / 2) * s;
      return;
    }
    // Else the smallest pan that brings them in (the rest of the view stays where the user had it).
    if (x0 * s + tx < m) tx = m - x0 * s;
    else if (x1 * s + tx > ancho - m) tx = ancho - m - x1 * s;
    if (y0 * s + ty < m) ty = m - y0 * s;
    else if (y1 * s + ty > alto - abajo) ty = alto - abajo - y1 * s;
  }
  export function zoom(f: number, px = ancho / 2, py = alto / 2) {
    const n = Math.min(80, Math.max(3, s * f));
    tx = px - (px - tx) * (n / s);
    ty = py - (py - ty) * (n / s);
    s = n;
  }
  /** Screen point (client coordinates) of a world point: for the tests. */
  export function pantalla(x: number, y: number): Pt {
    const r = caja!.getBoundingClientRect();
    return [r.left + tx + x * s, r.top + ty + y * s];
  }

  // ---------------------------------------------------------------- parts from the tray (0.11)

  /** Anchor of a piece: the centre of its body (or box) the finger carries. */
  function ancla(p: Pieza): Pt {
    if (EXTERNOS.has(p.enc)) {
      const c = cajaExterno(p);
      return [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2];
    }
    const b = cuerpoDe(p);
    if (b) return b.c;
    return [p.pos.reduce((a, q) => a + q[0], 0) / p.pos.length, p.pos.reduce((a, q) => a + q[1], 0) / p.pos.length];
  }

  /**
   * Where a tray part would land with the finger at (cx, cy): its legs snapped to holes (a DIP keeps straddling
   * the channel), lifted above a finger so it is not hidden. A guide's part near its place snaps to it.
   */
  function candidata(cx: number, cy: number, x: Componente | Pieza, dedo: boolean): Pieza | null {
    const p0 = 'comp' in x ? x : piezaDe(pb.doc, x);
    if (!p0) return null;
    const w = mundo(cx, cy - (dedo ? ELEVACION_DEDO : 0));
    const a = ancla(p0);
    // (1.3: with hysteresis, as a lead: a finger trembling between two holes does not make the part flicker)
    const h = histeresisRejilla(s, dedo ? 'touch' : 'mouse');
    const antes = ultimoDesp;
    const u = w[0] - a[0];
    const v = w[1] - a[1];
    const dx = antes && Math.abs(u - antes[0]) <= 0.5 + h ? antes[0] : Math.round(u);
    const dy = p0.enc === 'dip' ? Math.round(v / ALTO_PLACA) * ALTO_PLACA : antes && Math.abs(v - antes[1]) <= 0.5 + h ? antes[1] : Math.round(v);
    ultimoDesp = [dx, dy];
    const nueva = pb.nuevaEn(x, p0.pos.map(([px, py]) => [px + dx, py + dy] as Pt));
    if (!nueva) return null;
    // The guide's part comes with its target legs: within a hole and a half of them, it snaps there.
    if ('comp' in x && Math.hypot(dx, dy) <= 1.5 && (dx || dy)) {
      const justa = pb.nuevaEn(x, p0.pos);
      if (justa && !pb.motivoNueva(justa)) return justa;
    }
    return nueva;
  }

  /** The last offset (holes) of a tray part being dragged in (its hysteresis); null between drags. */
  let ultimoDesp: Pt | null = null;

  /** Over the bench? (client coordinates) */
  function dentro(cx: number, cy: number): boolean {
    const r = caja?.getBoundingClientRect();
    return !!r && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }

  /** A tray part dragged over the bench: its ghost (false when the finger is not over the bench). */
  export function fantasma(cx: number, cy: number, x: Componente | Pieza, dedo: boolean): boolean {
    if (!dentro(cx, cy)) {
      fant = null;
      colocandoFant = null;
      ultimoDesp = null;
      return false;
    }
    const antes = fant?.p.pos[0];
    const p = candidata(cx, cy, x, dedo);
    fant = p ? { p, motivo: pb.motivoNueva(p) } : null;
    colocandoFant = dedo ? { x: cx, y: cy - ELEVACION_DEDO } : null;
    if (dedo && p && !igual(p.pos[0], antes)) vibrarCambio();
    return true;
  }

  /** The tray part dropped: put where its ghost is, or refused with the reason. */
  export function soltarFantasma(cx: number, cy: number, x: Componente | Pieza, dedo: boolean): boolean {
    const sobre = fantasma(cx, cy, x, dedo);
    const f = fant;
    fant = null;
    colocandoFant = null;
    ultimoDesp = null;
    if (!sobre || !f) return false;
    if (f.motivo) {
      pb.mensaje = f.motivo;
      return false;
    }
    const p = pb.anadirEn(x, f.p.pos);
    if (p) info = describirPieza(p);
    if (p && dedo) vibrarAterrizaje();
    return !!p;
  }

  export function quitarFantasma() {
    fant = null;
    colocandoFant = null;
    ultimoDesp = null;
  }

  /** 1.3: the holes a part's legs take, short («R1 · B10 y B14»; «U1 · de E10 a F17» with more legs). */
  function corto(q: Pt): string {
    const a = agujero(cfg, q[0], q[1]);
    if (!a) return nombreDestino(q);
    return a.tipo === 'riel' ? `${etiquetaHueco(cfg, q[0], q[1]).split(' · ')[0]!.replace('Carril', 'carril')} (col. ${q[0]})` : etiquetaHueco(cfg, q[0], q[1]).split(' · ')[0]!;
  }
  function etiquetaPieza(p: Pieza): string {
    if (EXTERNOS.has(p.enc)) return `${p.comp.nombre} · encima de la placa`;
    const n = p.pos.length;
    const donde = n === 1 ? corto(p.pos[0]!) : n === 2 ? `${corto(p.pos[0]!)} y ${corto(p.pos[1]!)}` : `de ${corto(p.pos[0]!)} a ${corto(p.pos[n - 1]!)}`;
    return `${p.comp.nombre} · ${donde}`;
  }

  // The view centre, for parts added from the palette.
  $effect(() => {
    pb.vista = [(ancho / 2 - tx) / s, (alto / 2 - ty) / s];
  });

  let ajustado = false;
  $effect(() => {
    if (ancho > 50 && alto > 50 && !ajustado) {
      ajustado = true;
      untrack(() => (controles && ancho < 600 ? ajustarDedo() : ancho / alto < 1.05 && ancho < 700 ? ajustarAncho() : ajustar()));
    }
  });
  $effect(() => {
    void pb.version;
    void pb.doc.placas;
  });

  // ---------------------------------------------------------------- what is under the pointer

  function objetivo(ev: PointerEvent): { t: 'asa'; id: string; i: number; e?: 'a' | 'b' } | { t: 'pieza'; id: string } | { t: 'cable'; id: string } | null {
    const el = ev.target as Element | null;
    const asa = el?.closest?.('[data-asa]') as SVGElement | null;
    if (asa) {
      const [id, i] = asa.dataset['asa']!.split('|');
      if (i === 'a' || i === 'b') return { t: 'asa', id: id!, i: 0, e: i };
      return { t: 'asa', id: id!, i: Number(i) };
    }
    const p = (el?.closest?.('[data-pieza]') as SVGElement | null)?.dataset['pieza'];
    if (p) return { t: 'pieza', id: p };
    const w = (el?.closest?.('[data-cable]') as SVGElement | null)?.dataset['cable'];
    if (w) return { t: 'cable', id: w };
    return null;
  }

  function libreParaCable(q: Pt): boolean {
    if (borneEn(pb.doc, q)) return true;
    const a = agujero(cfg, q[0], q[1]);
    if (!a) return false;
    const k = clavePt(q[0], q[1]);
    for (const p of enPlaca) if (p.pos.some((x) => clavePt(x[0], x[1]) === k)) return false;
    for (const w of pb.doc.cables) if (clavePt(w.a[0], w.a[1]) === k || clavePt(w.b[0], w.b[1]) === k) return false;
    return true;
  }

  function describir(q: Pt): string {
    const a = agujero(cfg, q[0], q[1]);
    const b = borneEn(pb.doc, q);
    if (!a && !b) return '';
    const lugar = b ? `Borne ${encapsuladoDe(b.pieza.comp).nombres[b.i]} de ${b.pieza.comp.nombre}` : a!.tipo === 'riel' ? nombreAgujero(cfg, q[0], q[1]).replace(/^c/, 'C') : `Fila ${a!.fila}, columna ${a!.x}`;
    const r = redEn(pb.doc, pb.con, q[0], q[1]);
    if (r == null) return `${lugar} · sin conectar`;
    const v = pb.op?.v[r];
    return `${lugar} · red ${r === '0' ? '0 (masa)' : `«${r}»`}${v != null ? ` · ${formatoSI(v, 'V', 3)}` : ''}`;
  }

  // ---------------------------------------------------------------- pointer gestures

  const punteros = new Map<number, { x: number; y: number }>();
  let pinza: { d: number; s: number; c: Pt; t: Pt } | null = null;
  let ultimoToque = { t: 0, id: '' };

  /** A long press (600 ms, still) on a wire removes it (0.11). */
  function largoQuitaCable(id: string, g0: Gesto) {
    largo = setTimeout(() => {
      largo = null;
      if (gesto === g0 && !g0.movido) {
        gesto = null;
        pendiente = null;
        pb.quitarCable(id);
        info = '';
        // (1.3.1: coarse crumbs for the crash report — what the finger was doing, never what the board holds)
        migaAccion('protoboard: cable quitado con pulsación larga');
      }
    }, 600);
  }

  function soltarLargo() {
    if (largo) clearTimeout(largo);
    largo = null;
  }

  /** The end of a wire within a finger's reach of a world point. */
  function extremoCerca(w: Pt, ev: PointerEvent): { id: string; e: 'a' | 'b'; q: Pt } | null {
    const r = Math.max(0.42, (ev.pointerType === 'mouse' ? 8 : 14) / s);
    let mejor: { id: string; e: 'a' | 'b'; q: Pt; d: number } | null = null;
    for (const c of pb.doc.cables)
      for (const e of ['a', 'b'] as const) {
        const d = Math.hypot(c[e][0] - w[0], c[e][1] - w[1]);
        if (d < r && (!mejor || d < mejor.d)) mejor = { id: c.id, e, q: c[e], d };
      }
    return mejor;
  }

  // ---------------------------------------------------------------- 1.3: precise placement with a finger

  type GestoColocar = Extract<Gesto, { t: 'sonda' | 'pata' | 'extremo' | 'cable' }>;
  const esColocacion = (g: Gesto | null): g is GestoColocar => !!g && (g.t === 'sonda' || g.t === 'pata' || g.t === 'extremo' || g.t === 'cable');
  const esHueco = (q: Pt) => !!agujero(cfg, q[0], q[1]);
  const igual = (a: Pt | null | undefined, b: Pt | null | undefined) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

  /** Where the dragged thing was before the drag (it stays there when released off the holes). */
  function origenDe(g: GestoColocar): Pt | null {
    switch (g.t) {
      case 'sonda':
        return medida?.puntas[g.p] ?? null;
      case 'pata':
        return pb.pieza(g.id)?.pos[g.i] ?? null;
      case 'extremo':
        return pb.cable(g.id)?.[g.e] ?? null;
      case 'cable':
        return g.a;
    }
  }

  /** The name of a hole or terminal in the preview («C12 · tira 12 de arriba», «Borne + de V1»). */
  function nombreDestino(q: Pt): string {
    const b = borneEn(pb.doc, q);
    if (b) return `Borne ${encapsuladoDe(b.pieza.comp).nombres[b.i] ?? b.i + 1} de ${b.pieza.comp.nombre}`;
    return etiquetaHueco(cfg, q[0], q[1]) || nombreAgujero(cfg, q[0], q[1]);
  }

  /** The last pointer of a placement drag (aimed again when the auto zoom ends). */
  let ultimoPuntero: { x: number; y: number; tipo: string } | null = null;

  /** The dragged thing follows the pointer (lifted above a finger), snapped to a hole with hysteresis. */
  function apuntar(g: GestoColocar, cx: number, cy: number, tipo: string) {
    ultimoPuntero = { x: cx, y: cy, tipo };
    const lift = elevacion(tipo);
    const w = mundo(cx, cy - lift);
    const antes = g.fuera ? null : g.t === 'cable' ? g.b : g.q;
    const q = huecoConHisteresis(w, antes, g.t === 'pata' ? esHueco : esPunto, histeresisRejilla(s, tipo));
    if (q) {
      if (g.t === 'cable') g.b = q;
      else g.q = q;
      g.fuera = false;
    } else {
      if (g.t === 'cable') g.b = g.a;
      else g.q = origenDe(g) ?? g.q;
      g.fuera = true;
    }
    if (tipo === 'touch' && q && !igual(q, antes)) vibrarCambio();
    colocando = tipo === 'touch' ? { x: cx, y: cy - lift } : null;
    if (g.t === 'sonda') redMarcada = q ? (medida?.nodoEn(q) ?? null) : null;
    info = q ? describir(q) : 'Fuera de los agujeros: al soltar se queda donde estaba.';
  }

  // The auto zoom of a placement drag on a phone (and back on release).
  let animacion = 0;
  function irAVista(s1: number, tx1: number, ty1: number) {
    if (animacion) cancelAnimationFrame(animacion);
    animacion = 0;
    if (movimiento.reducido || typeof requestAnimationFrame === 'undefined') {
      s = s1;
      tx = tx1;
      ty = ty1;
      return;
    }
    const [s0, tx0, ty0] = [s, tx, ty];
    const t0 = performance.now();
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / 160);
      const e = 1 - (1 - k) ** 3;
      s = s0 + (s1 - s0) * e;
      tx = tx0 + (tx1 - tx0) * e;
      ty = ty0 + (ty1 - ty0) * e;
      if (k < 1) animacion = requestAnimationFrame(paso);
      else {
        animacion = 0;
        // (the finger may be still: what is under the lifted point now)
        const g = gesto;
        if (esColocacion(g) && g.movido && ultimoPuntero) apuntar(g, ultimoPuntero.x, ultimoPuntero.y, ultimoPuntero.tipo);
      }
    };
    animacion = requestAnimationFrame(paso);
  }
  function acercarParaColocar(ev: PointerEvent) {
    const z = zoomAutomatico(s, innerWidth, innerHeight, ev.pointerType);
    if (!z || vistaPrevia) return;
    vistaPrevia = { s, tx, ty };
    const [px, py] = rel(ev.clientX, ev.clientY);
    const f = z / s;
    irAVista(z, px - (px - tx) * f, py - (py - ty) * f);
  }
  /**
   * While a finger drags a placement, a lifted point near an edge of the bench pans the view that way (the zoomed-in
   * view of a phone has far holes out of sight), up to the edge of what can be drawn. Only once the lifted point has
   * been inside the bench and then rests a quarter of a second by the edge: a thing grabbed by the edge does not set
   * the board moving on its own.
   */
  let bordeRaf = 0;
  let bordeArmado = false;
  let bordeDesde = 0;
  function panearBorde() {
    bordeRaf = 0;
    const g = gesto;
    const u = ultimoPuntero;
    if (!esColocacion(g) || !g.movido || !u || u.tipo !== 'touch' || !caja) return;
    const r = caja.getBoundingClientRect();
    const lx = u.x - r.left;
    const ly = u.y - elevacion(u.tipo) - r.top;
    // (half a hole of the zoomed view: only a hole cut by the edge makes it pan)
    const M = 14;
    const V = 8;
    const [x0, y0, x1, y1] = limites();
    const f = (d: number) => Math.min(1, d / M);
    let vx = lx < M ? f(M - lx) : lx > ancho - M ? -f(lx - ancho + M) : 0;
    let vy = ly < M ? f(M - ly) : ly > alto - M ? -f(ly - alto + M) : 0;
    const ahora = performance.now();
    if (!vx && !vy) {
      bordeArmado = true;
      bordeDesde = 0;
    } else if (!bordeArmado || (bordeDesde || (bordeDesde = ahora)) > ahora - 250) vx = vy = 0;
    if ((vx > 0 && tx + x0 * s >= M) || (vx < 0 && tx + x1 * s <= ancho - M)) vx = 0;
    if ((vy > 0 && ty + y0 * s >= M) || (vy < 0 && ty + y1 * s <= alto - M)) vy = 0;
    if (vx || vy) {
      tx += vx * V;
      ty += vy * V;
      apuntar(g, u.x, u.y, u.tipo);
    }
    bordeRaf = requestAnimationFrame(panearBorde);
  }
  function devolverVista() {
    const v = vistaPrevia;
    vistaPrevia = null;
    if (v) irAVista(v.s, v.tx, v.ty);
  }

  /** What the fine-adjust arrows move, in words. */
  function nombreColocado(a: Colocado): string {
    if (a.t === 'sonda') return NOMBRE_PUNTA_PROTO[a.p].toLowerCase();
    if (a.t === 'pata') {
      const p = pb.pieza(a.id);
      return p ? `la pata ${encapsuladoDe(p.comp).nombres[a.i] ?? a.i + 1} de ${p.comp.nombre}` : 'la pata';
    }
    return 'el extremo del cable';
  }
  function puntoColocado(a: Colocado): Pt | null {
    if (a.t === 'sonda') return medida?.puntas[a.p] ?? null;
    if (a.t === 'pata') return pb.pieza(a.id)?.pos[a.i] ?? null;
    return pb.cable(a.id)?.[a.e] ?? null;
  }

  /** A fine-adjust arrow: what was placed goes to the next hole that way (the channel and gaps skipped). */
  function moverAjuste(d: Direccion) {
    const a = ajuste;
    if (!a) return;
    const o = puntoColocado(a);
    const q = o ? siguienteHueco(o, d, a.t === 'pata' ? esHueco : esPunto) : null;
    if (!q) {
      anuncio = info = 'Borde de la placa.';
      return;
    }
    pb.mensaje = '';
    let ok = false;
    if (a.t === 'sonda' && medida) {
      medida.activa = a.p;
      const t = medida.colocar(q);
      ok = igual(medida.puntas[a.p], q);
      if (!ok) pb.mensaje = t;
      else redMarcada = medida.nodoEn(q);
    } else if (a.t === 'pata') ok = pb.moverPata(a.id, a.i, q);
    else if (a.t === 'extremo') ok = pb.moverExtremo(a.id, a.e, q);
    if (ok) {
      vibrarCambio();
      info = `${nombreDestino(q)} · ${describir(q)}`;
      anuncio = `${nombreColocado(a)[0]!.toUpperCase()}${nombreColocado(a).slice(1)}: ${nombreDestino(q)}.`;
    } else anuncio = pb.mensaje || 'Ahí no puede ir.';
  }

  /** Is there a hole that way for what was placed? */
  function puedeAjuste(d: Direccion): boolean {
    const a = ajuste;
    const o = a ? puntoColocado(a) : null;
    return !!a && !!o && !!siguienteHueco(o, d, a.t === 'pata' ? esHueco : esPunto);
  }

  /** The fine-adjust arrows' place (client px). */
  const posAjuste = $derived.by(() => {
    const a = ajuste;
    if (!a || (gesto && gesto.movido) || !caja) return null;
    // (cierre22: also when the bench changes size or place without the view moving — a phone turned to 915 px gets the
    // 2.2 rail, which shifts the bench, and the arrows stayed where they had been drawn, far from the probe)
    void ancho;
    void alto;
    const q = puntoColocado(a);
    const r = caja.getBoundingClientRect();
    return q ? { x: r.left + tx + q[0] * s, y: r.top + ty + q[1] * s } : null;
  });

  // Another tool, another place: the arrows go.
  $effect(() => {
    void pb.herramienta;
    untrack(() => (ajuste = null));
  });

  // ---------------------------------------------------------------- 1.3 (averias13): aiming a tap

  /** After this (ms) a finger held still shows the hole a tap takes; after MIRA_ARMAR it aims. */
  const MIRA_VER = 120;
  const MIRA_ARMAR = 380;

  function pararMira() {
    if (miraVer) clearTimeout(miraVer);
    if (miraArmar) clearTimeout(miraArmar);
    miraVer = miraArmar = null;
    mira = null;
  }

  /** The hole a finger at (cx, cy) takes (with hysteresis on the one it took). */
  function huecoMira(cx: number, cy: number, antes: Pt | null): Pt | null {
    return huecoConHisteresis(mundo(cx, cy), antes, esPunto, histeresisRejilla(s, 'touch'), 0.75);
  }

  /** A finger went down where a tap places something: the preview, then the aim (see the header). */
  function empezarMira(ev: PointerEvent) {
    pararMira();
    const dedo: Pt = [ev.clientX, ev.clientY];
    mira = { dedo, q: huecoMira(dedo[0], dedo[1], null), visible: false, armada: false };
    miraVer = setTimeout(() => {
      miraVer = null;
      if (!mira) return;
      mira.visible = true;
      if (pb.armada) fantasma(mira.dedo[0], mira.dedo[1], pb.armada, false);
      else if (mira.q) info = `${nombreDestino(mira.q)}. Suelte para ponerla ahí, o deje el dedo quieto y deslícelo para afinar.`;
    }, MIRA_VER);
    miraArmar = setTimeout(() => {
      miraArmar = null;
      if (!mira) return;
      mira.visible = true;
      mira.armada = true;
      vibrarCambio();
      migaAccion('protoboard: apuntar con el dedo (lupa)');
      if (!pb.armada) info = 'Deslice el dedo hasta el agujero que quiera y suéltelo ahí.';
    }, MIRA_ARMAR);
  }

  /** Where a tap places something (touch): the tap-tap gestures, not a drag of what is already there. */
  function tocaColocar(g: Gesto | null): boolean {
    if (!g || g.movido) return false;
    if (pb.herramienta === 'medir') return g.t === 'pan' && !!medida?.activa && !medida.tutor?.esperaObjetivo;
    if (pb.herramienta === 'explorar') return false;
    return g.t === 'cable' || (!!pb.armada && g.t === 'pan');
  }

  /**
   * 1.3.1: what the finger went down on (a part, a wire, a handle), or null on a free spot. Holding a finger still on
   * something never aims (the owner, trying to long-press a wire away with «Medir» open or a wire being laid, got the
   * aiming loupe every time instead, and lifting moved the probe or the wire's end there).
   */
  let sobreAlgo = false;
  /** When the finger went down (ms, performance clock): a long press on something is never a tap (2.2, below). */
  let abajoEn = 0;
  const LARGO_MEDIR = 600;

  function abajo(ev: PointerEvent) {
    pararMira();
    sobreAlgo = !!objetivo(ev);
    abajoEn = performance.now();
    abajoGesto(ev);
    if (ev.pointerType === 'touch' && punteros.size === 1 && !sobreAlgo && tocaColocar(gesto)) empezarMira(ev);
  }

  function abajoGesto(ev: PointerEvent) {
    caja?.focus({ preventScroll: true });
    soltarLargo();
    ajuste = null;
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    try {
      (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    } catch {
      /* synthetic events */
    }
    if (punteros.size >= 2) {
      // (a second finger: the placement is dropped — the thing stays where it was — and the fingers zoom)
      gesto = null;
      colocando = null;
      vistaPrevia = null;
      if (animacion) cancelAnimationFrame(animacion);
      animacion = 0;
      soltarLargo();
      const [a, b] = [...punteros.values()];
      pinza = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, s, c: rel((a!.x + b!.x) / 2, (a!.y + b!.y) / 2), t: [tx, ty] };
      return;
    }
    if (ev.pointerType === 'mouse' && ev.button !== 0) {
      if (ev.button === 1) gesto = { t: 'pan', desde: [ev.clientX, ev.clientY], t0: [tx, ty], movido: false };
      return;
    }
    const w = mundo(ev.clientX, ev.clientY);
    const q = red0(w);
    const desde: Pt = [ev.clientX, ev.clientY];
    const o = objetivo(ev);
    if (pb.herramienta === 'medir' && medida) {
      // A probe under the finger is dragged; a leg's handle too (opening the circuit); otherwise a tap places
      // the chosen probe (or chooses the tutor's piece) and a drag pans.
      const r = Math.max(0.55, (ev.pointerType === 'mouse' ? 10 : 18) / s);
      let cerca: { p: PuntaProto; d: number } | null = null;
      for (const d of medida.dibujo) {
        const dd = Math.hypot(d.q[0] - w[0], d.q[1] - w[1]);
        if (dd < r && (!cerca || dd < cerca.d)) cerca = { p: d.p, d: dd };
      }
      if (cerca) {
        gesto = { t: 'sonda', p: cerca.p, q: medida.puntas[cerca.p]!, desde, movido: false };
        return;
      }
      if (o?.t === 'asa' && !o.e) {
        const p = pb.pieza(o.id);
        if (p) gesto = { t: 'pata', id: o.id, i: o.i, q: p.pos[o.i]!, desde, movido: false };
        return;
      }
      if (o?.t === 'asa' && o.e) {
        const c = pb.cable(o.id);
        if (c) gesto = { t: 'extremo', id: o.id, e: o.e, q: c[o.e], desde, movido: false };
        return;
      }
      gesto = { t: 'pan', desde, t0: [tx, ty], movido: false, ...(o && o.t !== 'asa' ? { o: { t: o.t, id: o.id } } : {}) };
      return;
    }
    // «La protoboard por dentro»: taps only light what is joined; a drag pans.
    if (pb.herramienta === 'explorar') {
      gesto = { t: 'pan', desde, t0: [tx, ty], movido: false };
      return;
    }
    if (pb.herramienta === 'cable' && (!o || o.t !== 'asa')) {
      if (libreParaCable(q) || pendiente) gesto = { t: 'cable', a: pendiente ?? q, b: q, desde, movido: false };
      else gesto = { t: 'pan', desde, t0: [tx, ty], movido: false };
      return;
    }
    if (o?.t === 'asa') {
      if (o.e) {
        const c = pb.cable(o.id);
        if (c) gesto = { t: 'extremo', id: o.id, e: o.e, q: c[o.e], desde, movido: false };
      } else {
        const p = pb.pieza(o.id);
        if (p) gesto = { t: 'pata', id: o.id, i: o.i, q: p.pos[o.i]!, desde, movido: false };
      }
      return;
    }
    // A wire being laid tap by tap: the next tap ends it (or cancels it).
    if (pendiente) {
      gesto = { t: 'cable', a: pendiente, b: q, desde, movido: false };
      // (1.3.1: held on a wire, a long press removes it, as it does without a wire being laid — and drops the start)
      if (o?.t === 'cable') largoQuitaCable(o.id, gesto);
      return;
    }
    // A wire: its end is dragged straight away (0.11); elsewhere it moves; a long press removes it.
    if (o?.t === 'cable') {
      const x = extremoCerca(w, ev);
      if (x && x.id === o.id) gesto = { t: 'extremo', id: x.id, e: x.e, q: x.q, desde, movido: false };
      else gesto = { t: 'pieza', ids: seleccion.has(o.id) ? [...pb.sel] : [o.id], desde, ini: w, dx: 0, dy: 0, movido: false };
      largoQuitaCable(o.id, gesto);
      return;
    }
    if (o) {
      const ids = seleccion.has(o.id) ? [...pb.sel] : [o.id];
      gesto = { t: 'pieza', ids, desde, ini: w, dx: 0, dy: 0, movido: false };
      return;
    }
    // A free hole starts a wire (0.11): a tap marks it, a drag lays it. Empty space pans.
    if (!pb.armada && libreParaCable(q) && Math.hypot(w[0] - q[0], w[1] - q[1]) < 0.5) gesto = { t: 'cable', a: q, b: q, desde, movido: false };
    else gesto = { t: 'pan', desde, t0: [tx, ty], movido: false };
  }

  function mover(ev: PointerEvent) {
    const p = punteros.get(ev.pointerId);
    if (p) {
      p.x = ev.clientX;
      p.y = ev.clientY;
    }
    if (pinza && punteros.size >= 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
      const c = rel((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      const n = Math.min(80, Math.max(3, (pinza.s * d) / pinza.d));
      tx = c[0] - (pinza.c[0] - pinza.t[0]) * (n / pinza.s);
      ty = c[1] - (pinza.c[1] - pinza.t[1]) * (n / pinza.s);
      s = n;
      return;
    }
    const w = mundo(ev.clientX, ev.clientY);
    cursor = w;
    const g = gesto;
    if (!g) {
      if (ev.pointerType === 'mouse') {
        info = describir(red0(w));
        // A tray part chosen by a tap follows the mouse as a ghost.
        if (pb.armada) fantasma(ev.clientX, ev.clientY, pb.armada, false);
      }
      return;
    }
    const umbral = ev.pointerType === 'mouse' ? 4 : 9;
    if (mira) {
      if (mira.armada) {
        // aiming: the finger moves the hole a tap takes (no pan, no wire laid)
        mira.dedo = [ev.clientX, ev.clientY];
        if (pb.armada) fantasma(ev.clientX, ev.clientY, pb.armada, false);
        else {
          const q = huecoMira(ev.clientX, ev.clientY, mira.q);
          if (q && !igual(q, mira.q)) vibrarCambio();
          mira.q = q;
          info = q ? `${nombreDestino(q)}. Suéltelo para ponerla ahí.` : 'Fuera de los agujeros: al soltar no se pone nada.';
        }
        return;
      }
      if (Math.hypot(ev.clientX - g.desde[0], ev.clientY - g.desde[1]) > 4) {
        // the finger moves before it aims: a pan or a wire laid as before (aiming needs it still)
        pararMira();
        if (pb.armada) fant = null;
        info = '';
      }
    }
    if (!g.movido && Math.hypot(ev.clientX - g.desde[0], ev.clientY - g.desde[1]) > umbral) {
      g.movido = true;
      soltarLargo();
      if (esColocacion(g)) {
        acercarParaColocar(ev);
        if (ev.pointerType === 'touch' && !bordeRaf && typeof requestAnimationFrame !== 'undefined') {
          bordeArmado = false;
          bordeDesde = 0;
          bordeRaf = requestAnimationFrame(panearBorde);
        }
      }
    }
    if (!g.movido) return;
    switch (g.t) {
      case 'pan':
        tx = g.t0[0] + ev.clientX - g.desde[0];
        ty = g.t0[1] + ev.clientY - g.desde[1];
        break;
      case 'pieza': {
        if (!g.ids.every((id) => seleccion.has(id))) pb.sel = g.ids;
        g.dx = Math.round(w[0] - g.ini[0]);
        g.dy = Math.round(w[1] - g.ini[1]);
        break;
      }
      case 'sonda':
      case 'pata':
      case 'extremo':
      case 'cable':
        apuntar(g, ev.clientX, ev.clientY, ev.pointerType);
        break;
    }
  }

  function arriba(ev: PointerEvent) {
    soltarLargo();
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pinza = null;
    const g = gesto;
    gesto = null;
    const m = mira;
    pararMira();
    if (!g) return;
    if (esColocacion(g)) {
      colocando = null;
      devolverVista();
    }
    if (!g.movido && (m?.armada || m?.visible) && !pb.armada) {
      // aimed (or shown, 1.3.1): a tap on the hole shown, never on another one (none off the holes)
      if (!m.q) {
        info = 'Fuera de los agujeros: no se ha puesto nada.';
        return;
      }
      const [x, y] = pantalla(m.q[0], m.q[1]);
      const antes = JSON.stringify([pb.doc.cables.length, pendiente, medida?.puntas]);
      tocar({ ...ev, clientX: x, clientY: y, shiftKey: false, ctrlKey: false, metaKey: false } as PointerEvent, g);
      if (JSON.stringify([pb.doc.cables.length, pendiente, medida?.puntas]) !== antes) vibrarAterrizaje();
      return;
    }
    // 2.2: with «Medir», a finger held still on a wire, a part or a handle and then lifted is a long press, not a tap:
    // the probe in hand stays where it was (the 1.3.1 crash: trying to long-press a wire away moved the probe to the
    // hole under the wire; it only went unseen while that spot happened to be off the holes).
    if (!g.movido && sobreAlgo && g.t !== 'sonda' && pb.herramienta === 'medir' && ev.pointerType !== 'mouse' && performance.now() - abajoEn >= LARGO_MEDIR) {
      info = 'Pulsación larga: la punta se queda donde estaba.';
      return;
    }
    if (!g.movido) {
      tocar(ev, g);
      return;
    }
    // (released off the holes: it stays where it was)
    if (esColocacion(g) && g.fuera) {
      info = 'Se queda donde estaba.';
      if (g.t === 'sonda') redMarcada = medida?.nodoDe(g.p) ?? null;
      return;
    }
    const dedo = ev.pointerType === 'touch';
    let puesto: Colocado | null = null;
    switch (g.t) {
      case 'sonda':
        if (medida) {
          medida.activa = g.p;
          info = medida.colocar(g.q);
          if (igual(medida.puntas[g.p], g.q)) puesto = { t: 'sonda', p: g.p };
        }
        break;
      case 'pieza':
        if (g.dx || g.dy) pb.moverPiezas(g.ids, g.dx, g.dy);
        break;
      case 'pata':
        if (pb.moverPata(g.id, g.i, g.q)) puesto = { t: 'pata', id: g.id, i: g.i };
        break;
      case 'extremo':
        if (pb.moverExtremo(g.id, g.e, g.q)) puesto = { t: 'extremo', id: g.id, e: g.e };
        break;
      case 'cable':
        if (g.a[0] !== g.b[0] || g.a[1] !== g.b[1]) {
          const w = pb.anadirCable(g.a, g.b);
          pendiente = null;
          if (w) puesto = { t: 'extremo', id: w.id, e: 'b' };
        }
        break;
    }
    if (dedo && puesto) {
      vibrarAterrizaje();
      ajuste = puesto;
      migaAccion(`protoboard: ${puesto.t === 'sonda' ? 'punta' : puesto.t === 'pata' ? 'pata' : 'extremo de cable'} arrastrado con el dedo`);
    }
  }

  function tocar(ev: PointerEvent, g: Gesto) {
    const q = red0(mundo(ev.clientX, ev.clientY));
    if (pb.herramienta === 'medir' && medida) {
      const tutor = medida.tutor;
      const o = g.t === 'pan' ? g.o : undefined;
      if (g.t === 'sonda') {
        // A tap on a probe: it becomes the one in hand.
        medida.activa = g.p;
        info = `En la mano: ${NOMBRE_PUNTA_PROTO[g.p].toLowerCase()}. Arrástrela para moverla.`;
        return;
      }
      if (tutor && o && tutor.esperaObjetivo) {
        const m = tutor.elegir(o);
        if (m) {
          info = m;
          return;
        }
      }
      // Opening the circuit (tutor): a tap on a part selects it, so its legs can be dragged.
      if (tutor && o?.t !== undefined && tutor.pasos[tutor.actual]?.id === 'abrir') {
        pb.sel = [o.id];
        info = 'Arrastre el círculo de una pata (o del extremo del cable) a una tira libre.';
        return;
      }
      let punto: Pt | null = q;
      if (!agujero(cfg, q[0], q[1]) && !borneEn(pb.doc, q)) {
        // On a body: the nearest leg of that part.
        const p = o?.t === 'pieza' ? pb.pieza(o.id) : undefined;
        const w = mundo(ev.clientX, ev.clientY);
        punto = p ? [...p.pos].sort((a, b) => Math.hypot(a[0] - w[0], a[1] - w[1]) - Math.hypot(b[0] - w[0], b[1] - w[1]))[0] ?? null : null;
      }
      if (!punto) {
        info = 'Las puntas van en un agujero, en una pata o en un borne.';
        return;
      }
      info = medida.colocar(punto);
      redMarcada = medida.nodoEn(punto);
      return;
    }
    if (pb.herramienta === 'explorar') {
      pb.leccion?.tocar(huecoMasCercano(cfg, mundo(ev.clientX, ev.clientY)));
      return;
    }
    // A tray part chosen by a tap: this tap puts it here (its legs around the point), or says why not.
    if (pb.armada && (g.t === 'pan' || g.t === 'cable')) {
      const x = pb.armada;
      const p = candidata(ev.clientX, ev.clientY, x, false);
      const m = p ? pb.motivoNueva(p) : 'Ahí no cabe.';
      if (m || !p) pb.mensaje = m ?? '';
      else if (pb.anadirEn(x, p.pos)) {
        pb.armada = null;
        fant = null;
      }
      ultimoDesp = null;
      pendiente = null;
      return;
    }
    if (g.t === 'cable') {
      // Tap by tap: the first tap marks the start (its strip lit), the second ends the wire.
      if (!pendiente) {
        if (libreParaCable(q)) {
          pendiente = q;
          redMarcada = redEn(pb.doc, pb.con, q[0], q[1]);
          const d = describir(q);
          info = `${d ? `${d}. ` : ''}Toque el agujero donde acaba el cable.`;
        } else pb.mensaje = 'Elija un agujero libre o un borne para empezar el cable.';
      } else if (q[0] !== pendiente[0] || q[1] !== pendiente[1]) {
        if (!agujero(cfg, q[0], q[1]) && !borneEn(pb.doc, q)) {
          // Off the holes: the wire is dropped.
          pendiente = null;
          info = '';
        } else {
          const w = pb.anadirCable(pendiente, q);
          if (w) {
            pendiente = null;
            const d = describir(q);
            info = `Cable puesto${d ? ` · ${d}` : ''}.`;
          }
        }
      } else {
        pendiente = null;
        info = '';
      }
      return;
    }
    if (g.t === 'pieza') {
      const id = g.ids.length === 1 ? g.ids[0]! : null;
      if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
        const x = g.ids[0]!;
        pb.sel = seleccion.has(x) ? pb.sel.filter((y) => y !== x) : [...pb.sel, x];
        return;
      }
      if (id) {
        const ahora = performance.now();
        if (ultimoToque.id === id && ahora - ultimoToque.t < 380) {
          const p = pb.pieza(id);
          if (p && CONMUTABLES.has(p.comp.tipo)) pb.conmutar(id);
          else alTocar?.(id);
        }
        ultimoToque = { t: ahora, id };
        pb.sel = [id];
        const p = pb.pieza(id);
        const pin = p?.patas.find((x) => !!x);
        redMarcada = p && pin ? (pb.con.redes[pb.con.redDePin.get(clavePin(p, pin)) ?? -1]?.nombre ?? null) : null;
        if (p) info = describirPieza(p);
        const w = pb.cable(id);
        if (w) {
          redMarcada = redEn(pb.doc, pb.con, w.a[0], w.a[1]);
          info = `Cable · ${describir(w.a)}`;
        }
      }
      return;
    }
    if (g.t === 'pan') {
      pb.sel = [];
      const d = describir(q);
      info = d;
      redMarcada = d ? redEn(pb.doc, pb.con, q[0], q[1]) : null;
    }
  }

  function describirPieza(p: Pieza): string {
    const e = encapsuladoDe(p.comp);
    const patas = p.patas
      .map((pin, i) => {
        if (!pin) return null;
        const r = pb.con.redes[pb.con.redDePin.get(clavePin(p, pin)) ?? -1]?.nombre;
        return `${e.nombres[i]}: ${r == null ? '—' : r === '0' ? '0' : r}`;
      })
      .filter(Boolean)
      .join(' · ');
    return `${p.comp.nombre}${p.chip ? ` (${p.comp.campos['modelo']})` : ''} · ${e.descripcion.split(' (')[0]} · ${patas}`;
  }

  function cancelar() {
    pararMira();
    soltarLargo();
    punteros.clear();
    pinza = null;
    gesto = null;
    colocando = null;
    devolverVista();
  }

  export function anularPendiente(): boolean {
    if (pendiente) {
      pendiente = null;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- keyboard (1.0 accessibility pass)
  // Everything a tap does, from the keyboard (WCAG 2.1.1): a cursor on the holes — arrows jump to the next hole or
  // terminal in that direction (Ctrl/⌘ + arrows: 5 holes) — and Enter acting on it exactly as a tap there: put the part
  // chosen in the tray, start a wire on a free hole and end it on another, select the part whose leg is there (twice:
  // switch it or open it, as a double tap), place the chosen probe with the «medir» tool. N / Mayús + N select the
  // next / previous part or wire; Mayús + arrows move the selection by one hole; Esc drops a wire half laid. A polite
  // live region says where the cursor is and what each key did; the cursor is drawn only with the keyboard focus.
  let enfocado = $state(false);
  let teclado = $state(false);
  let cursorTec = $state<Pt | null>(null);
  let anuncio = $state('');
  const uidMesa = $props.id();

  const esPunto = (q: Pt) => !!agujero(cfg, q[0], q[1]) || !!borneEn(pb.doc, q);

  /** The hole nearest to the centre of the view (where the keyboard cursor starts). */
  function puntoCentral(): Pt {
    const c = red0([(ancho / 2 - tx) / s, (alto / 2 - ty) / s]);
    if (esPunto(c)) return c;
    for (let r = 1; r < 30; r++)
      for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0], [r, r], [-r, -r], [r, -r], [-r, r]] as Pt[]) {
        const q: Pt = [c[0] + dx, c[1] + dy];
        if (esPunto(q)) return q;
      }
    return [1, 1];
  }

  function verPunto(q: Pt) {
    const m = Math.min(40, ancho / 4, alto / 4);
    const sx = tx + q[0] * s;
    const sy = ty + q[1] * s;
    if (sx < m) tx += m - sx;
    else if (sx > ancho - m) tx -= sx - (ancho - m);
    if (sy < m) ty += m - sy;
    else if (sy > alto - m) ty -= sy - (alto - m);
  }

  /** What is at a hole, in words (its place, net and voltage, and the part or wire end in it). */
  function describirTecla(q: Pt): string {
    const base = describir(q) || 'Fuera de los agujeros';
    const k = clavePt(q[0], q[1]);
    const p = enPlaca.find((x) => x.pos.some((t) => clavePt(t[0], t[1]) === k));
    if (p) {
      const i = p.pos.findIndex((t) => clavePt(t[0], t[1]) === k);
      return `${base} · pata ${encapsuladoDe(p.comp).nombres[i] ?? i + 1} de ${p.comp.nombre}`;
    }
    const w = pb.doc.cables.find((x) => clavePt(x.a[0], x.a[1]) === k || clavePt(x.b[0], x.b[1]) === k);
    return w ? `${base} · extremo de un cable` : base;
  }

  /** The bench takes the keyboard focus, its cursor on a hole (after a tray card chosen with the keyboard). */
  export function enfocarTeclado(texto?: string) {
    if (!caja) return;
    teclado = true;
    if (!cursorTec || !esPunto(cursorTec)) cursorTec = puntoCentral();
    caja.focus({ preventScroll: true });
    caja.scrollIntoView({ block: 'nearest' });
    if (texto) anuncio = texto;
  }

  /** Enter: a tap at the cursor (pointer down and up there, on the part whose leg is in that hole), then the outcome. */
  function pulsarCursor(shift: boolean) {
    const q = cursorTec;
    if (!q || !caja) return;
    verPunto(q);
    const k = clavePt(q[0], q[1]);
    const libre = pb.herramienta === 'seleccionar' && !pb.armada && !pendiente;
    const w = pb.doc.cables.find((x) => clavePt(x.a[0], x.a[1]) === k || clavePt(x.b[0], x.b[1]) === k);
    const p = pb.doc.piezas.find((x) => x.pos.some((t) => clavePt(t[0], t[1]) === k));
    if (libre && w && !p) {
      // a wire end: the pointer would drag it; the key selects the wire
      pb.sel = [w.id];
      redMarcada = redEn(pb.doc, pb.con, w.a[0], w.a[1]);
      anuncio = `Cable seleccionado · ${describir(w.a)} · hasta ${describir(w.b)}. Supr lo quita.`;
      return;
    }
    const r = caja.getBoundingClientRect();
    const cx = r.left + tx + q[0] * s;
    const cy = r.top + ty + q[1] * s;
    const objetivoEl = p && !(libre && EXTERNOS.has(p.enc)) ? caja.querySelector(`[data-pieza="${CSS.escape(p.id)}"]`) : null;
    const base = { pointerId: -1, pointerType: 'mouse', button: 0, clientX: cx, clientY: cy, shiftKey: shift, ctrlKey: false, metaKey: false, target: objetivoEl ?? caja.querySelector('svg'), currentTarget: null, preventDefault() {} };
    const n0 = pb.doc.piezas.length;
    const w0 = pb.doc.cables.length;
    const pend0 = pendiente;
    info = '';
    pb.mensaje = '';
    abajo({ ...base, type: 'pointerdown' } as unknown as PointerEvent);
    arriba({ ...base, type: 'pointerup' } as unknown as PointerEvent);
    const dicho = pb.mensaje || info;
    if (pb.doc.piezas.length > n0) {
      const nueva = pb.doc.piezas[pb.doc.piezas.length - 1]!;
      anuncio = `${nueva.comp.nombre} puesta. ${dicho || describirPieza(nueva)}`;
    } else if (pb.doc.cables.length > w0) anuncio = `Cable puesto hasta ${describir(q) || 'aquí'}.`;
    else if (pendiente && !pend0) anuncio = `Cable empezado en ${describir(q)}. Mueva el cursor al agujero donde acaba y pulse Intro; Esc lo deja.`;
    else anuncio = dicho || describirTecla(q);
  }

  function teclaMesa(ev: KeyboardEvent) {
    if (ev.target !== caja) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const flechas: Record<string, Pt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = flechas[ev.key];
    if (d) {
      ev.preventDefault();
      teclado = true;
      if (ev.shiftKey && pb.sel.length && pb.herramienta !== 'medir') {
        pb.mensaje = '';
        const ok = pb.moverPiezas([...pb.sel], d[0], d[1]);
        if (ok && cursorTec) cursorTec = [cursorTec[0] + d[0], cursorTec[1] + d[1]];
        if (cursorTec) verPunto(cursorTec);
        anuncio = ok ? `Movido ${d[0] < 0 ? 'a la izquierda' : d[0] > 0 ? 'a la derecha' : d[1] < 0 ? 'arriba' : 'abajo'}.` : pb.mensaje || 'Ahí no cabe.';
        return;
      }
      const p0 = cursorTec ?? puntoCentral();
      let q = p0;
      let saltos = 0;
      // the next hole (or terminal) in that direction: the channel and the gaps between boards are skipped
      for (let i = 1; i <= 40 && saltos < (mod ? 5 : 1); i++) {
        const c: Pt = [p0[0] + d[0] * i, p0[1] + d[1] * i];
        if (esPunto(c)) {
          q = c;
          saltos++;
        }
      }
      if (q === p0) {
        anuncio = 'Borde de la placa.';
        return;
      }
      cursorTec = q;
      cursor = q;
      verPunto(q);
      anuncio = describirTecla(q);
      return;
    }
    if (ev.key === 'Enter' && !mod && !ev.altKey) {
      ev.preventDefault();
      teclado = true;
      if (!cursorTec) cursorTec = puntoCentral();
      pulsarCursor(ev.shiftKey);
      return;
    }
    if (ev.key === 'Escape' && pendiente) {
      pendiente = null;
      info = '';
      anuncio = 'Cable sin terminar: dejado.';
      return;
    }
    if ((ev.key === 'n' || ev.key === 'N') && !mod && !ev.altKey) {
      const todos = [...pb.doc.piezas.map((x) => x.id), ...pb.doc.cables.map((x) => x.id)];
      if (!todos.length) {
        anuncio = 'La placa está vacía.';
        return;
      }
      ev.preventDefault();
      teclado = true;
      const i = todos.indexOf(pb.sel[0] ?? '');
      const j = i < 0 ? (ev.shiftKey ? todos.length - 1 : 0) : (i + (ev.shiftKey ? todos.length - 1 : 1)) % todos.length;
      const id = todos[j]!;
      pb.sel = [id];
      const p = pb.pieza(id);
      const w = pb.cable(id);
      if (p) {
        cursorTec = p.pos[0] ?? cursorTec;
        anuncio = `${describirPieza(p)} (${j + 1} de ${todos.length}). Mayús + flechas la mueven, R la gira, Supr la quita.`;
      } else if (w) {
        cursorTec = w.a;
        redMarcada = redEn(pb.doc, pb.con, w.a[0], w.a[1]);
        anuncio = `Cable · ${describir(w.a)} · hasta ${describir(w.b)} (${j + 1} de ${todos.length}).`;
      }
      if (cursorTec) verPunto(cursorTec);
    }
  }

  // A card of the tray chosen with the keyboard: the bench takes the focus to put it with the cursor.
  $effect(() => {
    const x = pb.armada;
    if (!x) return;
    untrack(() => {
      const a = document.activeElement;
      if (a instanceof HTMLElement && a.closest('.bandeja') && a.matches(':focus-visible'))
        enfocarTeclado(`${'comp' in x ? x.comp.nombre : 'Pieza'} elegida: mueva el cursor por los agujeros con las flechas y pulse Intro para ponerla ahí; Esc cancela.`);
    });
  });

  onMount(() => {
    const el = caja!;
    const rueda = (ev: WheelEvent) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        const [px, py] = rel(ev.clientX, ev.clientY);
        const paso = ev.deltaMode !== 0 || Math.abs(ev.deltaY) >= 50;
        zoom(Math.exp(paso ? -Math.sign(ev.deltaY) * 0.18 : -ev.deltaY * 0.01), px, py);
      } else if (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) {
        ev.preventDefault();
        tx -= (ev.deltaX || ev.deltaY) * (ev.deltaMode === 1 ? 16 : 1);
      } else if (ruedaDesplaza) {
        ev.preventDefault();
        ty -= ev.deltaY * (ev.deltaMode === 1 ? 16 : 1);
      }
    };
    const toque = (ev: TouchEvent) => {
      // (the controls over the bench — zoom, the floating bar — keep their taps)
      if ((ev.target as Element | null)?.closest?.('button, input, select, textarea, label, form, [role="toolbar"]')) return;
      if (ev.cancelable) ev.preventDefault();
    };
    const gestoSafari = (ev: Event) => ev.preventDefault();
    el.addEventListener('wheel', rueda, { passive: false });
    el.addEventListener('touchstart', toque, { passive: false });
    el.addEventListener('touchmove', toque, { passive: false });
    el.addEventListener('gesturestart', gestoSafari);
    el.addEventListener('gesturechange', gestoSafari);
    // 1.3.1: the app sent to the background mid-gesture (no release will come): the gesture and its loupe end
    const oculta = () => {
      if (document.visibilityState !== 'visible') cancelar();
    };
    document.addEventListener('visibilitychange', oculta);
    const g = globalThis as unknown as { __epaProtoboard?: unknown };
    g.__epaProtoboard = {
      pb,
      pantalla,
      ajustar,
      zoom: (f: number) => zoom(f),
      escala: () => s,
      verificar: () => verificarMontaje(pb.doc),
      /** Screen point of a leg of a part (by designator). */
      pata: (nombre: string, i: number) => {
        const p = pb.doc.piezas.find((x) => x.comp.nombre === nombre);
        return p ? pantalla(p.pos[i]![0], p.pos[i]![1]) : null;
      },
      /** Screen point of the body of a part. */
      centro: (nombre: string) => {
        const p = pb.doc.piezas.find((x) => x.comp.nombre === nombre);
        if (!p) return null;
        const b = cuerpoDe(p);
        if (b) return pantalla(b.c[0], b.c[1]);
        const c = EXTERNOS.has(p.enc) ? cajaExterno(p) : null;
        return c ? pantalla((c[0] + c[2]) / 2, (c[1] + c[3]) / 2) : pantalla(p.pos[0]![0], p.pos[0]![1]);
      },
    };
    return () => {
      el.removeEventListener('wheel', rueda);
      el.removeEventListener('touchstart', toque);
      el.removeEventListener('touchmove', toque);
      el.removeEventListener('gesturestart', gestoSafari);
      el.removeEventListener('gesturechange', gestoSafari);
      document.removeEventListener('visibilitychange', oculta);
      // (timers and frames of a gesture in progress when the bench goes)
      pararMira();
      soltarLargo();
      if (animacion) cancelAnimationFrame(animacion);
      if (bordeRaf) cancelAnimationFrame(bordeRaf);
      animacion = bordeRaf = 0;
      if ((g.__epaProtoboard as { pb?: unknown } | undefined)?.pb === pb) delete g.__epaProtoboard;
    };
  });

  // The tutor's holes come into view (0.11: the bench is smaller while the instruments are open).
  $effect(() => {
    const t = medida?.tutor;
    const paso = t && t.actual >= 0 ? t.pasos[t.actual] : undefined;
    const ps = paso?.puntos?.() ?? [];
    if (ps.length) untrack(() => mostrar(ps));
  });

  // The info line fades after a while (a refusal stays a little longer); a wire being laid keeps its hint.
  $effect(() => {
    const t = info;
    if (!t || pendiente) return;
    const k = setTimeout(() => {
      if (info === t && !pendiente) info = '';
    }, 5000);
    return () => clearTimeout(k);
  });
  $effect(() => {
    const m = pb.mensaje;
    if (!m) return;
    const k = setTimeout(() => {
      if (pb.mensaje === m) pb.mensaje = '';
    }, 7000);
    return () => clearTimeout(k);
  });

  // Selection → its net highlighted.
  $effect(() => {
    const id = pb.sel.length === 1 ? pb.sel[0]! : null;
    untrack(() => {
      if (!id) return;
      const p = pb.pieza(id);
      if (p) {
        const pin = p.patas.find((x) => !!x);
        redMarcada = pin ? (pb.con.redes[pb.con.redDePin.get(clavePin(p, pin)) ?? -1]?.nombre ?? null) : null;
        info = describirPieza(p);
      }
    });
  });

  // ---------------------------------------------------------------- drawing helpers

  /** Inject SVG markup into a <g> (parsed in the SVG namespace). */
  function marcado(node: SVGGElement, html: string) {
    node.innerHTML = html;
    return {
      update(h: string) {
        node.innerHTML = h;
      },
    };
  }

  /** The piece as drawn now: moved or with a leg dragged. */
  function vista(p: Pieza): Pieza {
    const g = gesto;
    if (g?.t === 'pieza' && g.movido && g.ids.includes(p.id)) return { ...p, pos: p.pos.map(([x, y]) => [x + g.dx, y + g.dy] as Pt) };
    if (g?.t === 'pata' && g.movido && g.id === p.id) return { ...p, pos: p.pos.map((x, i) => (i === g.i ? g.q : x)) };
    return p;
  }
  function vistaCable(w: CableProto): CableProto {
    const g = gesto;
    if (g?.t === 'pieza' && g.movido && g.ids.includes(w.id)) return { ...w, a: [w.a[0] + g.dx, w.a[1] + g.dy], b: [w.b[0] + g.dx, w.b[1] + g.dy] };
    if (g?.t === 'extremo' && g.movido && g.id === w.id) return { ...w, [g.e]: g.q };
    if (g?.t === 'pieza' && g.movido) {
      // Leads follow the equipment being moved.
      for (const id of g.ids) {
        const p = pb.pieza(id);
        if (!p || !EXTERNOS.has(p.enc)) continue;
        const enA = p.pos.some((t) => t[0] === w.a[0] && t[1] === w.a[1]);
        const enB = p.pos.some((t) => t[0] === w.b[0] && t[1] === w.b[1]);
        if (enA || enB) return { ...w, a: enA ? [w.a[0] + g.dx, w.a[1] + g.dy] : w.a, b: enB ? [w.b[0] + g.dx, w.b[1] + g.dy] : w.b };
      }
    }
    return w;
  }

  const invalida = $derived.by(() => {
    const g = gesto;
    if (!g || !g.movido) return null;
    if (g.t === 'pieza') {
      const cambios = new Map<string, Pt[]>();
      for (const id of g.ids) {
        const p = pb.pieza(id);
        if (p) cambios.set(id, p.pos.map(([x, y]) => [x + g.dx, y + g.dy] as Pt));
      }
      return cambios.size ? pb.probar(cambios) : null;
    }
    if (g.t === 'pata') {
      const p = pb.pieza(g.id);
      return p ? pb.probar(new Map([[g.id, p.pos.map((x, i) => (i === g.i ? g.q : x))]])) : null;
    }
    return null;
  });

  /** Box of a conductor (strip or rail) around a hole, in world units. */
  function cajaTira(q: Pt): { x: number; y: number; w: number; h: number } | null {
    const a = agujero(cfg, q[0], q[1]);
    if (!a) return null;
    const hs = agujerosDe(cfg, a.nodo);
    const xs = hs.map((h) => h[0]);
    const ys = hs.map((h) => h[1]);
    return { x: Math.min(...xs) - 0.42, y: Math.min(...ys) - 0.42, w: Math.max(...xs) - Math.min(...xs) + 0.84, h: Math.max(...ys) - Math.min(...ys) + 0.84 };
  }

  /** Strips lit while laying a wire (its start and where the finger is) or dragging a tray part in. */
  const tirasActivas = $derived.by(() => {
    const res: { x: number; y: number; w: number; h: number; k: string }[] = [];
    const g = gesto;
    const puntos: Pt[] = [];
    if (g?.t === 'cable') puntos.push(g.a, ...(g.movido ? [g.b] : []));
    else if (pendiente) puntos.push(pendiente, ...(cursor ? [red0(cursor)] : []));
    if (g?.t === 'extremo' && g.movido) puntos.push(g.q);
    const vistos = new Set<string>();
    for (const q of puntos) {
      const a = agujero(cfg, q[0], q[1]);
      if (!a || vistos.has(a.nodo)) continue;
      vistos.add(a.nodo);
      const c = cajaTira(q);
      if (c) res.push({ ...c, k: a.nodo });
    }
    return res;
  });
  const tirasFantasma = $derived.by(() => {
    const f = fant;
    if (!f || EXTERNOS.has(f.p.enc)) return [] as { x: number; y: number; w: number; h: number; k: string }[];
    const res: { x: number; y: number; w: number; h: number; k: string }[] = [];
    const vistos = new Set<string>();
    for (const q of f.p.pos) {
      const a = agujero(cfg, q[0], q[1]);
      if (!a || vistos.has(a.nodo)) continue;
      vistos.add(a.nodo);
      const c = cajaTira(q);
      if (c) res.push({ ...c, k: a.nodo });
    }
    return res;
  });

  /** Strips lit by the lesson (one box per conductor). */
  const lucesGuia = $derived.by(() => {
    const res: { x: number; y: number; w: number; h: number; k: string }[] = [];
    const vistos = new Set<string>();
    for (const q of guia?.luces ?? []) {
      const a = agujero(cfg, q[0], q[1]);
      if (!a || vistos.has(a.nodo)) continue;
      vistos.add(a.nodo);
      const c = cajaTira(q);
      if (c) res.push({ ...c, k: a.nodo });
    }
    return res;
  });

  /** Where the floating bar goes: the selection's box in px of the bench. */
  const cajaSel = $derived.by(() => {
    if (pb.sel.length !== 1 || pb.herramienta === 'medir' || (gesto && gesto.movido) || fant || ajuste) return null;
    const id = pb.sel[0]!;
    const p = pb.pieza(id);
    const w = pb.cable(id);
    let c: [number, number, number, number] | null = null;
    if (p) {
      if (EXTERNOS.has(p.enc)) c = cajaExterno(p);
      else {
        const xs = p.pos.map((q) => q[0]);
        const ys = p.pos.map((q) => q[1]);
        c = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        const b = cuerpoDe(p);
        if (b) {
          const k = cajaCuerpo(b);
          c = [Math.min(c[0], k[0]), Math.min(c[1], k[1]), Math.max(c[2], k[2]), Math.max(c[3], k[3])];
        }
      }
    } else if (w) c = [Math.min(w.a[0], w.b[0]), Math.min(w.a[1], w.b[1]), Math.max(w.a[0], w.b[0]), Math.max(w.a[1], w.b[1])];
    if (!c) return null;
    return { x: tx + (c[0] - 0.4) * s, y: ty + (c[1] - 0.4) * s, w: (c[2] - c[0] + 0.8) * s, h: (c[3] - c[1] + 0.8) * s, ancho, alto };
  });
  const anchoGolpe = $derived(Math.max(0.5, Math.min(0.95, (tactilGrueso ? 22 : 12) / s)));

  /** Outline of the conductors of the highlighted net. */
  const resaltes = $derived.by(() => {
    const r = redMarcada;
    if (r == null) return [] as { x: number; y: number; w: number; h: number }[];
    const i = pb.con.redes.findIndex((x) => x.nombre === r);
    if (i < 0) return [];
    const res: { x: number; y: number; w: number; h: number }[] = [];
    for (const c of pb.con.redes[i]!.conductores) {
      if (c.startsWith('E:')) continue;
      const hs = agujerosDe(cfg, c);
      if (!hs.length) continue;
      const xs = hs.map((h) => h[0]);
      const ys = hs.map((h) => h[1]);
      res.push({ x: Math.min(...xs) - 0.42, y: Math.min(...ys) - 0.42, w: Math.max(...xs) - Math.min(...xs) + 0.84, h: Math.max(...ys) - Math.min(...ys) + 0.84 });
    }
    return res;
  });

  function contorno(p: Pieza): string {
    if (EXTERNOS.has(p.enc)) {
      const [x0, y0, x1, y1] = cajaExterno(p);
      return `M${x0 - 0.2} ${y0 - 0.2}H${x1 + 0.2}V${y1 + 0.2}H${x0 - 0.2}Z`;
    }
    const b = cuerpoDe(p);
    if (!b) {
      const q = p.pos[0]!;
      return `M${q[0] - 0.5} ${q[1] - 0.5}h1v1h-1z`;
    }
    if (b.redondo) return `M${b.c[0] - b.hl - 0.2} ${b.c[1]}a${b.hl + 0.2} ${b.hl + 0.2} 0 1 0 ${2 * b.hl + 0.4} 0a${b.hl + 0.2} ${b.hl + 0.2} 0 1 0 ${-2 * b.hl - 0.4} 0`;
    const e = esquinas({ ...b, hl: b.hl + 0.2, hw: b.hw + 0.2 });
    return `M${e.map((q) => `${q[0]} ${q[1]}`).join('L')}Z`;
  }

  /** Handles: both legs of a two-leg part, both ends of a wire. */
  const asas = $derived.by(() => {
    if (pb.sel.length !== 1) return [] as { k: string; x: number; y: number }[];
    const id = pb.sel[0]!;
    const p = pb.pieza(id);
    if (p && p.pos.length === 2 && !EXTERNOS.has(p.enc)) return p.pos.map((q, i) => ({ k: `${id}|${i}`, x: q[0], y: q[1] }));
    const w = pb.cable(id);
    if (w) return [{ k: `${id}|a`, x: w.a[0], y: w.a[1] }, { k: `${id}|b`, x: w.b[0], y: w.b[1] }];
    return [];
  });
  const radioAsa = $derived(Math.max(0.42, (tactilGrueso ? 16 : 9) / s));

  /** 1.3 (averias13): the loupe of an aimed tap, or of a tray part dragged in by a finger. */
  const previaToque = $derived.by(() => {
    const r = caja?.getBoundingClientRect();
    const f = fant;
    const lugar = (q: Pt) => (r ? { x: r.left + tx + q[0] * s, y: r.top + ty + q[1] * s } : null);
    if (colocandoFant && f) return { objetivo: colocandoFant, marca: lugar(f.p.pos[0]!), etiqueta: f.motivo ? `${etiquetaPieza(f.p)}: no cabe` : etiquetaPieza(f.p), mal: !!f.motivo };
    const m = mira;
    if (!m || !m.visible) return null;
    const objetivo = { x: m.dedo[0], y: m.dedo[1] };
    if (pb.armada) return f ? { objetivo, marca: lugar(f.p.pos[0]!), etiqueta: f.motivo ? `${etiquetaPieza(f.p)}: no cabe` : etiquetaPieza(f.p), mal: !!f.motivo } : null;
    const q = m.q;
    let mal = !q;
    if (q && pb.herramienta === 'medir') mal = !!medida && Object.entries(medida.puntas).some(([k, v]) => k !== medida!.activa && igual(v, q));
    else if (q && !pendiente) mal = !libreParaCable(q);
    else if (q && pendiente) mal = igual(q, pendiente) || !!motivoExtremo(pb.doc, q, new Set());
    return { objetivo, marca: q ? lugar(q) : null, etiqueta: q ? nombreDestino(q) : 'Fuera de los agujeros', mal, q };
  });

  /** 1.3: the preview of a placement dragged by a finger — the snapped hole, its name, whether it can go there. */
  const previa = $derived.by(() => {
    const g = gesto;
    const c = colocando;
    if (!c || !esColocacion(g) || !g.movido) return null;
    const q = g.fuera ? null : g.t === 'cable' ? g.b : g.q;
    let mal = !q;
    if (q && g.t === 'pata') mal = !!invalida;
    else if (q && g.t === 'extremo') mal = !!motivoExtremo(pb.doc, q, new Set([`${g.id}:${g.e}`]));
    else if (q && g.t === 'cable') mal = igual(q, g.a) || !!motivoExtremo(pb.doc, q, new Set());
    else if (q && g.t === 'sonda') mal = !!medida && Object.entries(medida.puntas).some(([k, v]) => k !== g.p && igual(v, q));
    const r = caja?.getBoundingClientRect();
    return {
      q,
      objetivo: c,
      marca: q && r ? { x: r.left + tx + q[0] * s, y: r.top + ty + q[1] * s } : null,
      etiqueta: q ? nombreDestino(q) : 'Fuera de los agujeros: se queda donde estaba',
      mal,
    };
  });
</script>

<div class="mesa-caja">
{#if pb.herramienta === 'medir'}
  {@const t = medida?.tutor}
  {@const paso = t && t.actual >= 0 ? t.pasos[t.actual] : undefined}
  <!-- The tutor's step is a bar above the bench (0.10): it never covers the supplies and instruments drawn there. -->
  <p class="pista barra" aria-live="polite">{paso ? paso.texto : t?.terminado ? 'Hecho: la lectura está en el instrumento (panel «Medir»).' : medida?.activa ? 'Toque el agujero donde va la punta elegida en «Medir», o arrastre una punta puesta.' : 'Elija una punta en el panel «Medir».'}</p>
{/if}
<!-- role=application with its own keyboard mode (1.0): focusable and with key handlers on purpose -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="mesa"
  class:con-cable={pb.herramienta === 'cable' || !!pendiente}
  class:modo-medir={pb.herramienta === 'medir'}
  class:armada={!!pb.armada}
  bind:this={caja}
  bind:clientWidth={ancho}
  bind:clientHeight={alto}
  tabindex="0"
  role="application"
  aria-label="Protoboard: toque una pieza para elegirla y arrástrela para moverla; toque un agujero y luego otro para tender un cable; dos dedos para desplazar y acercar"
  aria-describedby="ayuda-teclado-{uidMesa}"
  onkeydown={teclaMesa}
  onfocus={() => {
    enfocado = true;
    if (caja?.matches(':focus-visible')) {
      teclado = true;
      if (!cursorTec) cursorTec = puntoCentral();
    }
  }}
  onblur={() => {
    enfocado = false;
    teclado = false;
  }}
>
  <svg
    role="presentation"
    width={ancho}
    height={alto}
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={cancelar}
    onlostpointercapture={(ev) => {
      // (1.3.1: a pointer whose release will never come — the capture taken away — ends its gesture, its loupe too)
      if (punteros.has(ev.pointerId)) cancelar();
    }}
    onpointerleave={() => {
      cursor = null;
      if (pb.armada) fant = null;
    }}
    font-family="Source Sans 3, sans-serif"
  >
    <g use:marcado={defsProtoboard()}></g>
    <g bind:this={grupo} transform={`translate(${tx} ${ty}) scale(${s})`}>
      <g use:marcado={placasSvg}></g>
      {#each resaltes as r, i (i)}
        <rect class="resalte" x={r.x} y={r.y} width={r.w} height={r.h} rx=".3" />
      {/each}
      {#each tirasActivas as r (r.k)}
        <rect class="tira-cable" x={r.x} y={r.y} width={r.w} height={r.h} rx=".3" />
      {/each}
      {#each tirasFantasma as r (r.k)}
        <rect class="tira-fantasma" class:mal={!!fant?.motivo} x={r.x} y={r.y} width={r.w} height={r.h} rx=".3" />
      {/each}
      {#if guia}
        <!-- «Monta este circuito»: where the step goes (the part's silhouette, the wire's path, the holes). -->
        <g class="guia-mesa" aria-hidden="true">
          {#each lucesGuia as r (r.k)}
            <rect class="tira-luz" x={r.x} y={r.y} width={r.w} height={r.h} rx=".3" />
          {/each}
          {#each guia.luces ?? [] as q, i (i)}
            <circle class="luz" cx={q[0]} cy={q[1]} r=".3" />
          {/each}
          {#if guia.pieza}<g class="silueta" use:marcado={svgPieza(guia.pieza)}></g><path class="contorno guia-contorno" d={contorno(guia.pieza)} />{/if}
          {#if guia.cable}<line class="guia-cable" x1={guia.cable[0][0]} y1={guia.cable[0][1]} x2={guia.cable[1][0]} y2={guia.cable[1][1]} />{/if}
          {#each guia.puntos as q, i (i)}
            <circle class="guia-hueco" cx={q[0]} cy={q[1]} r=".46" />
          {/each}
        </g>
      {/if}
      {#each enPlaca as p (p.id)}
        {@const v = vista(p)}
        <g data-pieza={p.id} class="pieza" class:sel={seleccion.has(p.id)} class:mal={!!invalida && v !== p} use:marcado={svgPieza(v, { encendido: encendidos[p.id] })}></g>
      {/each}
      {#each externos as p (p.id)}
        {@const v = vista(p)}
        <g data-pieza={p.id} class="pieza externo" class:sel={seleccion.has(p.id)} class:mal={!!invalida && v !== p} use:marcado={svgPieza(v)}></g>
      {/each}
      <!-- Wires over the parts (0.11), each with a wide transparent line that takes the touch. -->
      {#each cablesPlaca as w (w.id)}
        {@const v = vistaCable(w)}
        <g data-cable={w.id} class="cable" class:sel={seleccion.has(w.id)}>
          <line class="golpe" x1={v.a[0]} y1={v.a[1]} x2={v.b[0]} y2={v.b[1]} stroke-width={anchoGolpe} />
          <g use:marcado={svgCable(v)}></g>
        </g>
      {/each}
      {#each puntas as w (w.id)}
        <g data-cable={w.id} class="cable punta" class:sel={seleccion.has(w.id)} use:marcado={svgCable(vistaCable(w), true)}></g>
      {/each}
      {#if fant}
        <g class="fantasma-pieza" class:mal={!!fant.motivo} use:marcado={svgPieza(fant.p)}></g>
        <path class="contorno" class:bien={!fant.motivo} class:mal={!!fant.motivo} d={contorno(fant.p)} />
        {#if !EXTERNOS.has(fant.p.enc)}
          {#each fant.p.pos as q, i (i)}
            <circle class="pata-fantasma" class:mal={!!fant.motivo} cx={q[0]} cy={q[1]} r=".34" />
          {/each}
        {/if}
      {/if}
      {#if medida}
        <g class="sondas" aria-hidden="true">
          {#each medida.tutor?.pasos[medida.tutor.actual]?.puntos?.() ?? [] as q, i (i)}
            <circle class="guia-hueco" cx={q[0]} cy={q[1]} r=".46" />
          {/each}
          {#each medida.dibujo as d (d.p)}
            {@const g = gesto}
            {@const [x, y] = g?.t === 'sonda' && g.movido && g.p === d.p ? g.q : d.q}
            <path class="cable-sonda" d={`M${x} ${y}C${x + 0.2} ${y - 1.4} ${x + 1.4} ${y - 1.6} ${x + 1.6} ${y - 2.8}`} stroke={COLOR_PUNTA[d.p]} />
            <circle class="punta-sonda" cx={x} cy={y} r=".42" fill={COLOR_PUNTA[d.p]} class:activa={medida.activa === d.p} />
            <text class="letra-sonda" x={x} y={y + 0.02} text-anchor="middle" dominant-baseline="central">{LETRA_PUNTA[d.p]}</text>
          {/each}
        </g>
      {/if}
      {#if rotulos}
        <g class="rotulos">
          {#each enPlaca as p (p.id)}
            {@const r = posRotulo(vista(p))}
            {#if r}<text x={r.x} y={r.y} text-anchor={r.ancla} dominant-baseline="central">{rotuloCorto(p.comp.nombre)}</text>{/if}
          {/each}
        </g>
      {/if}
      {#each pb.sel as id (id)}
        {@const p = pb.pieza(id)}
        {#if p}<path class="contorno" class:mal={!!invalida} d={contorno(vista(p))} />{/if}
      {/each}
      {#each medida?.tutor?.pieza ? [medida.tutor.pieza] : [] as p (p.id)}
        <path class="contorno objetivo" d={contorno(vista(p))} />
      {/each}
      {#if gesto?.t === 'cable' && gesto.movido}
        <g class="fantasma" use:marcado={svgCable({ id: '', a: gesto.a, b: gesto.b, color: pb.colorAuto(gesto.a, gesto.b) })}></g>
        <circle class="pendiente" cx={gesto.b[0]} cy={gesto.b[1]} r=".45" />
      {/if}
      {#if enfocado && teclado && cursorTec}
        <rect class="cursor-teclado" data-cursor-teclado={`${cursorTec[0]},${cursorTec[1]}`} x={cursorTec[0] - 0.62} y={cursorTec[1] - 0.62} width="1.24" height="1.24" rx=".25" />
      {/if}
      {#if pendiente}
        <circle class="pendiente" cx={pendiente[0]} cy={pendiente[1]} r=".45" />
        {#if cursor}<line class="goma" x1={pendiente[0]} y1={pendiente[1]} x2={cursor[0]} y2={cursor[1]} />{/if}
      {/if}
      {#if previaToque && 'q' in previaToque && previaToque.q && !previa}
        <circle class="destino" class:mal={previaToque.mal} cx={previaToque.q[0]} cy={previaToque.q[1]} r=".58" data-destino-hueco={`${previaToque.q[0]},${previaToque.q[1]}`} data-mira={mira?.armada ? 'armada' : 'vista'} />
      {/if}
      {#if previa?.q}
        <circle class="destino" class:mal={previa.mal} cx={previa.q[0]} cy={previa.q[1]} r=".58" data-destino-hueco={`${previa.q[0]},${previa.q[1]}`} />
      {/if}
      {#each asas as a (a.k)}
        {@const g = gesto}
        {@const mov = g && g.movido && (g.t === 'pata' || g.t === 'extremo') && `${g.id}|${g.t === 'pata' ? g.i : g.e}` === a.k}
        <circle class="asa" data-asa={a.k} cx={mov ? (g.t === 'pata' || g.t === 'extremo' ? g.q[0] : a.x) : a.x} cy={mov ? (g.t === 'pata' || g.t === 'extremo' ? g.q[1] : a.y) : a.y} r={radioAsa} />
      {/each}
    </g>
  </svg>
  {#if vacia && !fant && !pb.armada && pb.herramienta !== 'medir'}
    <p class="vacia" aria-hidden="true">{vacia}</p>
  {/if}
  {#if controles}
    <div class="zoom" role="group" aria-label="Vista">
      <button type="button" title="Acercar" aria-label="Acercar" use:pulsar={() => zoom(1.25)}><Plus size={18} /></button>
      <button type="button" title="Alejar" aria-label="Alejar" use:pulsar={() => zoom(0.8)}><Minus size={18} /></button>
      <button type="button" title="Ver toda la placa" aria-label="Ver todo" use:pulsar={ajustar}><Maximize size={17} /></button>
    </div>
  {/if}
  {#if posAjuste && ajuste}
    <AjusteFino x={posAjuste.x} y={posAjuste.y} nombre={nombreColocado(ajuste)} puede={puedeAjuste} mover={moverAjuste} cerrar={() => (ajuste = null)} />
  {/if}
  {#if cajaSel && flotante}
    {@render flotante(cajaSel)}
  {/if}
  {#if fant?.motivo}
    <p class="info aviso" aria-live={enfocado && teclado ? 'off' : 'polite'}>{fant.motivo}</p>
  {:else if ((info && !sinInfo) || pb.mensaje || invalida) && !previa}
    <!-- (while a finger drags, the loupe's label says where; the line would cover the bench's last holes) -->
    <p class="info" class:aviso={!!pb.mensaje || !!invalida} aria-live={enfocado && teclado ? 'off' : 'polite'}>{invalida ?? (pb.mensaje || info)}</p>
  {/if}
  <p class="solo-lector" id="ayuda-teclado-{uidMesa}">
    Con el teclado: las flechas mueven el cursor de agujero en agujero (Control y flecha, de cinco en cinco); Intro actúa donde
    está el cursor: pone la pieza elegida en la bandeja, empieza un cable en un agujero libre y lo acaba en otro, o elige la
    pieza que tiene una pata ahí. N y Mayúsculas N eligen la pieza o el cable siguiente o anterior; Mayúsculas y flechas
    mueven lo elegido; R gira, Supr quita y Esc cancela.
  </p>
  <p class="solo-lector" aria-live="polite" data-anuncio-mesa>{anuncio}</p>
  {#if previaToque && !previa}
    <Lupa origen={grupo ?? null} objetivo={previaToque.objetivo} marca={previaToque.marca} etiqueta={previaToque.etiqueta} mal={previaToque.mal} zoom={Math.min(4, Math.max(1.6, 40 / s))} fondo="var(--fondo-carril)" />
  {/if}
  {#if previa}
    <Lupa origen={grupo ?? null} objetivo={previa.objetivo} marca={previa.marca} etiqueta={previa.etiqueta} mal={previa.mal} zoom={Math.min(4, Math.max(1.6, 40 / s))} fondo="var(--fondo-carril)" />
  {/if}
  {#if pb.herramienta === 'cable' && !pendiente && !info}
    <p class="pista">Cable: toque un agujero libre y luego otro, o arrastre de uno a otro.</p>
  {/if}
</div>
</div>

<style>
  .mesa-caja {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .mesa {
    position: relative;
    flex: 1 1 auto;
    width: 100%;
    min-height: 0;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    background:
      radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--superficie) 70%, transparent), transparent 60%),
      var(--fondo-carril);
    outline: none;
    cursor: default;
  }
  .mesa.con-cable,
  .mesa.modo-medir {
    cursor: crosshair;
  }
  .sondas {
    pointer-events: none;
  }
  .cable-sonda {
    fill: none;
    stroke-width: 0.2;
    stroke-linecap: round;
    opacity: 0.9;
  }
  .guia-hueco {
    fill: rgba(255, 211, 77, 0.25);
    stroke: #f2b705;
    stroke-width: 0.12;
    animation: guia-hueco 1.1s ease-in-out infinite;
  }
  @keyframes guia-hueco {
    50% {
      stroke-opacity: 0.3;
      fill-opacity: 0.1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .guia-hueco {
      animation: none;
    }
  }
  .punta-sonda {
    stroke: #fff;
    stroke-width: 0.09;
  }
  .punta-sonda.activa {
    stroke: #ffd84a;
    stroke-width: 0.16;
  }
  .letra-sonda {
    font-size: 0.5px;
    font-weight: 700;
    fill: #fff;
  }
  svg {
    display: block;
    touch-action: none;
  }
  .pieza {
    cursor: grab;
  }
  .pieza.mal {
    opacity: 0.55;
  }
  .cable {
    cursor: grab;
  }
  .golpe {
    stroke: transparent;
    stroke-linecap: round;
    fill: none;
    pointer-events: stroke;
  }
  .tira-cable {
    fill: rgba(232, 164, 0, 0.18);
    stroke: rgba(232, 164, 0, 0.9);
    stroke-width: 0.1;
    pointer-events: none;
  }
  .tira-fantasma {
    fill: rgba(30, 132, 73, 0.16);
    stroke: rgba(30, 132, 73, 0.85);
    stroke-width: 0.1;
    pointer-events: none;
  }
  .tira-fantasma.mal {
    fill: rgba(217, 48, 37, 0.14);
    stroke: rgba(217, 48, 37, 0.85);
  }
  .fantasma-pieza {
    opacity: 0.82;
    pointer-events: none;
  }
  .fantasma-pieza.mal {
    opacity: 0.5;
  }
  .pata-fantasma {
    fill: rgba(30, 132, 73, 0.35);
    stroke: #1e8449;
    stroke-width: 0.1;
    pointer-events: none;
  }
  .pata-fantasma.mal {
    fill: rgba(217, 48, 37, 0.3);
    stroke: #d93025;
  }
  .contorno.bien {
    stroke: #1e8449;
    fill: rgba(30, 132, 73, 0.1);
  }
  .guia-mesa {
    pointer-events: none;
  }
  .tira-luz {
    fill: rgba(255, 214, 10, 0.22);
    stroke: #e0a800;
    stroke-width: 0.12;
    animation: luz 0.45s ease-out;
  }
  .luz {
    fill: #ffd60a;
    stroke: #b88600;
    stroke-width: 0.06;
    filter: drop-shadow(0 0 0.25px #ffd60a);
  }
  @keyframes luz {
    from {
      fill: rgba(255, 214, 10, 0.6);
    }
  }
  .silueta {
    opacity: 0.32;
    filter: grayscale(0.4);
  }
  .guia-contorno {
    stroke: #f2b705;
    fill: rgba(255, 216, 74, 0.08);
    animation: guia-hueco 1.1s ease-in-out infinite;
  }
  .guia-cable {
    stroke: #f2b705;
    stroke-width: 0.16;
    stroke-dasharray: 0.35 0.25;
    stroke-linecap: round;
    animation: hormigas 1s linear infinite;
  }
  @keyframes hormigas {
    to {
      stroke-dashoffset: -0.6;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .guia-contorno,
    .guia-cable {
      animation: none;
    }
  }
  .cable.sel {
    filter: drop-shadow(0 0 0.25px #ffd84a) drop-shadow(0 0 0.25px #ffd84a);
  }
  .resalte {
    fill: rgba(46, 140, 255, 0.16);
    stroke: rgba(46, 140, 255, 0.75);
    stroke-width: 0.08;
    pointer-events: none;
  }
  .contorno {
    fill: rgba(255, 216, 74, 0.12);
    stroke: #f2b705;
    stroke-width: 0.1;
    stroke-dasharray: 0.35 0.2;
    pointer-events: none;
  }
  .contorno.objetivo {
    stroke: #8e44c9;
    fill: rgba(142, 68, 201, 0.1);
  }
  .contorno.mal {
    stroke: #d93025;
    fill: rgba(217, 48, 37, 0.12);
  }
  .rotulos text {
    font-size: 0.62px;
    font-weight: 700;
    fill: #1d2a3a;
    stroke: #f7f5ef;
    stroke-width: 0.22px;
    paint-order: stroke;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .asa {
    fill: rgba(255, 255, 255, 0.35);
    stroke: #f2b705;
    stroke-width: 0.12;
    cursor: move;
  }
  .destino {
    fill: rgba(242, 183, 5, 0.18);
    stroke: #f2b705;
    stroke-width: 0.14;
    pointer-events: none;
  }
  .destino.mal {
    fill: rgba(217, 48, 37, 0.16);
    stroke: #d93025;
  }
  .pendiente {
    fill: none;
    stroke: #e8a400;
    stroke-width: 0.15;
  }
  .cursor-teclado {
    fill: none;
    stroke: var(--acento);
    stroke-width: 0.16;
    pointer-events: none;
  }
  .mesa:focus-visible {
    outline: 3px solid var(--acento);
    outline-offset: -3px;
  }
  .goma {
    stroke: #e8a400;
    stroke-width: 0.12;
    stroke-dasharray: 0.3 0.2;
    pointer-events: none;
  }
  .fantasma {
    opacity: 0.8;
    pointer-events: none;
  }
  .info,
  .pista {
    position: absolute;
    left: 8px;
    right: 8px;
    margin: 0;
    padding: 6px 10px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--superficie) 92%, transparent);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 13.5px;
    line-height: 1.3;
    box-shadow: var(--sombra);
    pointer-events: none;
  }
  .info {
    bottom: 8px;
    max-width: 640px;
    margin: 0 auto;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .vacia {
    position: absolute;
    left: 50%;
    top: 58%;
    transform: translate(-50%, -50%);
    width: min(80%, 26em);
    margin: 0;
    padding: 12px 16px;
    border: 2px dashed color-mix(in srgb, var(--acento) 45%, transparent);
    border-radius: 16px;
    background: color-mix(in srgb, var(--superficie) 88%, transparent);
    color: var(--tinta);
    font: 600 15px/1.35 var(--sans);
    text-align: center;
    pointer-events: none;
  }
  .zoom {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: color-mix(in srgb, var(--superficie) 94%, transparent);
    box-shadow: var(--sombra);
    overflow: hidden;
  }
  .zoom button {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 0;
    background: transparent;
    color: var(--tinta);
  }
  .zoom button + button {
    border-top: 1px solid var(--linea-suave);
  }
  .zoom button:hover {
    background: var(--hover);
  }
  .mesa.armada {
    cursor: copy;
  }
  .info.aviso {
    color: var(--c-precaucion);
    font-weight: 600;
  }
  .pista {
    top: 8px;
    color: var(--ambar);
    font-weight: 600;
  }
  .pista.barra {
    position: static;
    flex: none;
    margin: 0;
    border-radius: 0;
    box-shadow: none;
    border-bottom: 1px solid var(--linea-suave);
    background: var(--superficie);
  }
  /* 1.3: on a phone the tutor's bar takes less of the bench's height */
  @media (max-width: 599px) {
    .pista.barra {
      padding: 4px 10px;
      font-size: 13px;
      line-height: 1.25;
    }
  }
</style>
