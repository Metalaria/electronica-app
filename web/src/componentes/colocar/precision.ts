// 1.3 (tactil13): precise placement with a finger — the shared maths of «drag to place» (plain TypeScript: it runs in
// Node for the unit tests). Used by the breadboard (componentes/protoboard/Mesa.svelte: leads, legs, wire ends), the
// lessons' schematics (componentes/leccion12/CircuitoVivo.svelte: the meter's leads on a node, the ammeter in a branch)
// and the instruments' bench (componentes/instrumentos/esquema/Plano.svelte).
//
// The gesture, on a touch screen: what is being placed rides ELEVACION_DEDO CSS px above the finger (the finger never
// hides the target); it snaps to the nearest valid hole or node with hysteresis, so it does not flicker between two
// neighbours while the finger trembles on the border; a loupe shows the area and the chosen place is named. With a mouse
// or a pen nothing is lifted (the pointer does not hide anything) and the hysteresis is smaller.

export type Pt = [number, number];

/** How far above the finger (CSS px) the placed thing rides on a touch screen (the tray's parts use it too). */
export const ELEVACION_DEDO = 56;

/** CSS px the placed thing is lifted for this pointer: only a finger hides what it points at. */
export function elevacion(tipoPuntero: string): number {
  return tipoPuntero === 'touch' ? ELEVACION_DEDO : 0;
}

/**
 * Hysteresis on a grid of holes (in pitches) for a given screen size of the pitch: about 5 CSS px for a finger and 2
 * for a mouse, between 0.08 and 0.3 of a pitch.
 */
export function histeresisRejilla(pasoPx: number, tipoPuntero: string): number {
  const px = tipoPuntero === 'touch' ? 5 : 2;
  return Math.min(0.3, Math.max(0.08, px / Math.max(pasoPx, 1)));
}

/**
 * The hole a point of a grid (holes on integer coordinates, `valido` says which exist) snaps to, with hysteresis: the
 * current hole is kept while the point stays within half a pitch plus `h` of it on both axes; otherwise the nearest
 * valid hole within `alcance` pitches (the channel is crossed) (Euclidean), or null (off the holes: nothing to snap to).
 */
export function huecoConHisteresis(w: Pt, actual: Pt | null, valido: (q: Pt) => boolean, h = 0.2, alcance = 1.5): Pt | null {
  if (actual && valido(actual) && Math.abs(w[0] - actual[0]) <= 0.5 + h && Math.abs(w[1] - actual[1]) <= 0.5 + h) return actual;
  const cx = Math.round(w[0]);
  const cy = Math.round(w[1]);
  let mejor: { q: Pt; d: number } | null = null;
  const r = Math.ceil(alcance);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const q: Pt = [cx + dx, cy + dy];
      const d = Math.hypot(q[0] - w[0], q[1] - w[1]);
      if (d > alcance || (mejor && d >= mejor.d) || !valido(q)) continue;
      mejor = { q, d };
    }
  return mejor?.q ?? null;
}

export interface Candidato {
  id: string;
  x: number;
  y: number;
}

/**
 * The candidate (nodes of a schematic, in screen px) a point snaps to, with hysteresis: the current one is kept unless
 * another is nearer by more than `histeresis` px; none farther than `alcance` px.
 */
export function candidatoConHisteresis<T extends Candidato>(cands: readonly T[], p: { x: number; y: number }, actualId: string | null, histeresis = 12, alcance = 60): T | null {
  let mejor: T | null = null;
  let dMejor = Infinity;
  let actual: T | null = null;
  let dActual = Infinity;
  for (const c of cands) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < dMejor) {
      mejor = c;
      dMejor = d;
    }
    if (c.id === actualId) {
      actual = c;
      dActual = d;
    }
  }
  if (actual && dActual <= alcance && dActual <= dMejor + histeresis) return actual;
  return mejor && dMejor <= alcance ? mejor : null;
}

export type Direccion = 'izquierda' | 'derecha' | 'arriba' | 'abajo';
export const VECTOR: Record<Direccion, Pt> = { izquierda: [-1, 0], derecha: [1, 0], arriba: [0, -1], abajo: [0, 1] };
export const DIRECCION_TECLA: Record<string, Direccion> = { ArrowLeft: 'izquierda', ArrowRight: 'derecha', ArrowUp: 'arriba', ArrowDown: 'abajo' };

/** The next valid hole of a grid in a direction (the channel and the gaps skipped), or null at the edge. */
export function siguienteHueco(q: Pt, dir: Direccion, valido: (q: Pt) => boolean, max = 40): Pt | null {
  const [dx, dy] = VECTOR[dir];
  for (let i = 1; i <= max; i++) {
    const c: Pt = [q[0] + dx * i, q[1] + dy * i];
    if (valido(c)) return c;
  }
  return null;
}

/**
 * The candidate next to `actual` in a direction (schematic nodes in screen px): within 60° of the direction, the one
 * with the smallest distance, a sideways offset counting double. Null when there is none that way.
 */
export function vecinoEnDireccion<T extends Candidato>(cands: readonly T[], actual: Candidato, dir: Direccion): T | null {
  const [ux, uy] = VECTOR[dir];
  let mejor: T | null = null;
  let coste = Infinity;
  for (const c of cands) {
    if (c.id === actual.id) continue;
    const dx = c.x - actual.x;
    const dy = c.y - actual.y;
    const along = dx * ux + dy * uy;
    const lado = Math.abs(dx * uy - dy * ux);
    if (along <= 0.5 || lado > along * Math.tan(Math.PI / 3)) continue;
    const k = along + 2 * lado;
    if (k < coste) {
      coste = k;
      mejor = c;
    }
  }
  return mejor;
}

/** Below this screen size of the breadboard's pitch (CSS px), a placement drag on a phone zooms in. */
export const PASO_MINIMO_DEDO = 20;
/** The pitch (CSS px) the auto zoom brings it to. */
export const PASO_COMODO_DEDO = 30;

/** Should a placement drag zoom in? (a phone-sized bench with holes smaller than a finger can aim at) */
export function zoomAutomatico(pasoPx: number, anchoVentana: number, altoVentana: number, tipoPuntero: string): number | null {
  if (tipoPuntero !== 'touch' || Math.min(anchoVentana, altoVentana) >= 600 || pasoPx >= PASO_MINIMO_DEDO) return null;
  return PASO_COMODO_DEDO;
}

/**
 * Where the loupe goes (its centre, screen px) for a target point and the finger under it: above the target, to the
 * side with more room, inside the window (margin 8 px). `r` is the loupe's radius.
 */
export function posicionLupa(objetivo: { x: number; y: number }, ventana: { ancho: number; alto: number }, r: number): { x: number; y: number } {
  const m = 8;
  const lado = objetivo.x > ventana.ancho / 2 ? -1 : 1;
  let x = objetivo.x + lado * (r + 28);
  let y = objetivo.y - r - 24;
  if (y - r < m) y = objetivo.y + r + 70; // no room above: below the finger
  x = Math.min(ventana.ancho - r - m, Math.max(r + m, x));
  y = Math.min(ventana.alto - r - m, Math.max(r + m, y));
  return { x, y };
}

/** A tick for every change of the snapped place, at most one each `intervalo` ms (a fast drag does not buzz). */
export class Pulsos {
  private ultimo = -Infinity;
  constructor(private readonly intervalo = 45) {}
  /** True when a tick is due now (time in ms). */
  toca(ahora: number): boolean {
    if (ahora - this.ultimo < this.intervalo) return false;
    this.ultimo = ahora;
    return true;
  }
}
