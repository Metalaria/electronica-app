// Geometry of the virtual breadboard («protoboard»). Plain TypeScript (runs in Node for the tests).
//
// Units: one pitch (2,54 mm) = 1, y DOWN, every hole on integer coordinates. A board has N columns of
// holes (x = 1…N; 30 for a «400 puntos» board, 63 for an «830 puntos» one) and, from top to bottom:
//   y = 0   top + rail (red line, outer)        y = 1   top − rail (blue line)
//   y = 3…7 rows a–e: one vertical strip of 5 holes per column (top half)
//   y = 8…9 the centre channel (0,3 in: a DIP straddles it with its pins on rows e and f)
//   y = 10…14 rows f–j: the strips of the bottom half
//   y = 16  bottom − rail (blue)                 y = 17  bottom + rail (red, outer)
// Rail holes come in groups of 5 with a gap; each rail row is one conductor along the whole board.
// Several boards stack downwards, ALTO_PLACA apart (board b: y + b·ALTO_PLACA); their rails are separate.
// Off-board equipment (bench supply, generator…) lives above the first board (y < 0), not on holes.

export type Pt = [number, number];

export const ALTO_PLACA = 21;
/** Rows of the rails (relative to the board) and their polarity marking. */
export const FILAS_RIEL = [0, 1, 16, 17] as const;
export const SIGNO_RIEL = ['+', '−', '−', '+'] as const;
export const FILAS_ARRIBA = [3, 4, 5, 6, 7] as const;
export const FILAS_ABAJO = [10, 11, 12, 13, 14] as const;
export const LETRAS = 'abcdefghij';
/** Top of the off-board area (equipment above the first board). */
export const Y_EQUIPOS = -16;

export interface ConfigPlaca {
  placas: number;
  columnas: number;
}

export interface Agujero {
  x: number;
  y: number;
  placa: number;
  tipo: 'tira' | 'riel';
  /** Conductor it belongs to: «T<placa>:<columna>:<a|b>» (strip) or «R<placa>:<0-3>» (rail). */
  nodo: string;
  /** Row letter (a–j) for strips; the rail index 0–3 for rails. */
  fila: string;
}

/** Columns that have rail holes (groups of five with a one-hole gap). */
export function columnasRiel(n: number): number[] {
  const s = n <= 30 ? 2 : 3;
  const res: number[] = [];
  for (let c = s; c <= n; c++) if ((c - s) % 6 < 5) res.push(c);
  return res;
}

const cacheRiel = new Map<number, Set<number>>();
function esColumnaRiel(n: number, x: number): boolean {
  let s = cacheRiel.get(n);
  if (!s) cacheRiel.set(n, (s = new Set(columnasRiel(n))));
  return s.has(x);
}

/** The hole at a point, or null (between holes, in the channel, outside the boards). */
export function agujero(cfg: ConfigPlaca, x: number, y: number): Agujero | null {
  if (!Number.isInteger(x) || !Number.isInteger(y) || y < 0) return null;
  const placa = Math.floor(y / ALTO_PLACA);
  if (placa >= cfg.placas) return null;
  const ry = y - placa * ALTO_PLACA;
  if (x < 1 || x > cfg.columnas) return null;
  const ir = (FILAS_RIEL as readonly number[]).indexOf(ry);
  if (ir >= 0) {
    if (!esColumnaRiel(cfg.columnas, x)) return null;
    return { x, y, placa, tipo: 'riel', nodo: `R${placa}:${ir}`, fila: String(ir) };
  }
  if (ry >= 3 && ry <= 7) return { x, y, placa, tipo: 'tira', nodo: `T${placa}:${x}:a`, fila: LETRAS[ry - 3]! };
  if (ry >= 10 && ry <= 14) return { x, y, placa, tipo: 'tira', nodo: `T${placa}:${x}:b`, fila: LETRAS[ry - 5]! };
  return null;
}

/** «c12» style name of a hole for messages: «fila b, columna 12» or «carril + superior». */
export function nombreAgujero(cfg: ConfigPlaca, x: number, y: number): string {
  const a = agujero(cfg, x, y);
  if (!a) return `(${x}, ${y})`;
  const pl = cfg.placas > 1 ? ` de la placa ${a.placa + 1}` : '';
  if (a.tipo === 'riel') return `carril ${SIGNO_RIEL[Number(a.fila)]} ${Number(a.fila) < 2 ? 'superior' : 'inferior'}${pl}`;
  return `${a.fila}${x}${pl}`;
}

/** Every hole of a board configuration. */
export function agujeros(cfg: ConfigPlaca): Agujero[] {
  const res: Agujero[] = [];
  for (let p = 0; p < cfg.placas; p++) {
    for (let ry = 0; ry < ALTO_PLACA; ry++) {
      for (let x = 1; x <= cfg.columnas; x++) {
        const a = agujero(cfg, x, p * ALTO_PLACA + ry);
        if (a) res.push(a);
      }
    }
  }
  return res;
}

/** Holes of one conductor (strip or rail). */
export function agujerosDe(cfg: ConfigPlaca, nodo: string): Pt[] {
  const m = /^([TR])(\d+):(\d+)(?::([ab]))?$/.exec(nodo);
  if (!m) return [];
  const placa = Number(m[2]);
  const oy = placa * ALTO_PLACA;
  if (m[1] === 'T') {
    const x = Number(m[3]);
    const filas = m[4] === 'a' ? FILAS_ARRIBA : FILAS_ABAJO;
    return filas.map((f) => [x, oy + f] as Pt);
  }
  const y = oy + FILAS_RIEL[Number(m[3])]!;
  return columnasRiel(cfg.columnas).map((x) => [x, y] as Pt);
}

/** Rectangle of a board (world units) as drawn: [x0, y0, x1, y1]. */
export function rectPlaca(cfg: ConfigPlaca, placa: number): [number, number, number, number] {
  const oy = placa * ALTO_PLACA;
  return [-0.9, oy - 1.1, cfg.columnas + 1.9, oy + 18.1];
}

/** Bounds of everything that can be drawn (equipment area included). */
export function limitesMundo(cfg: ConfigPlaca): [number, number, number, number] {
  return [-2, Y_EQUIPOS - 1, cfg.columnas + 3, cfg.placas * ALTO_PLACA - 1.5];
}

export const clavePt = (x: number, y: number): string => `${x},${y}`;
