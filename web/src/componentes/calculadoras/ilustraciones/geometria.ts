// Drawing primitives of the calculators' schematic templates, in the style of the book's figures (IEC
// resistors, loop inductors, circled sources, three-bar grounds). A template is a list of elements on a grid
// (1 unit = 10 SVG units); this module turns it into SVG path data once per template. Plain TypeScript.

export const U = 10;

/** Elements of a template (tuples, kind first; coordinates in grid units). */
export type Elem =
  /** wire polyline */
  | ['w', ...number[]]
  /** two-terminal part from (x1, y1) to (x2, y2); a source has its «+» at the second end; a diode its cathode;
   *  lado: where its label goes (a arriba, b abajo, i izquierda, d derecha, '' none) */
  | [Dos, number, number, number, number, string?, Lado?]
  | ['gnd', number, number]
  | ['dot', number, number]
  | ['term', number, number]
  /** supply rail: lead up and a bar, with a fixed text above */
  | ['vcc', number, number, string]
  /** op-amp: inputs at (x, y ∓ 1), output at (x + 4, y); `inv` true: «−» on top */
  | ['oa', number, number, boolean]
  /** NPN: base at (x, y), collector (x + 2, y − 2), emitter (x + 2, y + 2) */
  | ['npn', number, number]
  /** N-MOSFET: gate (x, y), drain (x + 2, y − 2), source (x + 2, y + 2) */
  | ['nmos', number, number]
  /** box with a centred text */
  | ['caja', number, number, number, number, string]
  /** a block of a diagram that shows a role's value inside */
  | ['bloque', number, number, number, number, string]
  /** summing junction */
  | ['suma', number, number]
  /** magnetic core: two parallel lines */
  | ['nucleo', number, number, number, number]
  /** full-wave bridge: diamond centred at (x, y), half diagonal r; AC at top and bottom, + right, − left */
  | ['puente', number, number, number]
  /** antenna whose mast foot is at (x, y) */
  | ['antena', number, number]
  /** closed polygon with a face style (1, 2, 3) */
  | ['cara', number, ...number[]]
  /** arrow from (x1, y1) to (x2, y2) (current, signal); optional role highlights it */
  | ['flecha', number, number, number, number, string?]
  /** dimension line with ticks at both ends */
  | ['cota', number, number, number, number]
  /** dashed line */
  | ['trazos', ...number[]]
  /** label of a role: symbol and value; ancla l / r / c; una: on one line */
  | ['lab', number, number, string, Ancla, boolean?]
  /** fixed text (simple HTML: sub/sup) */
  | ['txt', number, number, string, Ancla, string?]
  /** horizontal magnitude bar: left end at (x, y), full length w for the largest of its group */
  | ['hbarra', number, number, number, string, string];

export type Dos = 'R' | 'C' | 'Cp' | 'L' | 'V' | 'Vac' | 'I' | 'D' | 'LED' | 'DZ' | 'SW' | 'X' | 'Rv';
export type Lado = 'a' | 'b' | 'i' | 'd' | '';
export type Ancla = 'l' | 'r' | 'c';

export interface Plantilla {
  w: number;
  h: number;
  /** Role → [default symbol (HTML), unit of an expression slot]. */
  roles: Record<string, [string, string]>;
  e: Elem[];
}

export type Prim =
  | { t: 'path'; d: string; cls: 'linea' | 'cuerpo' | 'relleno' | 'tenue' | 'cara1' | 'cara2' | 'cara3' | 'flecha' | 'trazos'; rol?: string }
  | { t: 'circ'; cx: number; cy: number; r: number; cls: 'cuerpo' | 'relleno' | 'hueco'; rol?: string }
  | { t: 'txt'; x: number; y: number; html: string; ancla: Ancla; cls: string }
  /** auto: the label of a drawn part (shows its symbol even when the formula does not use it) */
  | { t: 'lab'; x: number; y: number; rol: string; ancla: Ancla; una: boolean; auto?: boolean }
  | { t: 'hbarra'; x: number; y: number; w: number; rol: string; grupo: string };

type P = [number, number];

const f = (n: number): string => String(Math.round(n * U * 100) / 100);
const M = (p: P): string => `M${f(p[0])} ${f(p[1])}`;
const Lto = (p: P): string => `L${f(p[0])} ${f(p[1])}`;

/** Local frame of a two-terminal part: a along the part, b across it. */
function marco(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const p = (a: number, b: number): P => [mx + a * ux - b * uy, my + a * uy + b * ux];
  return { p, L, ux, uy, mx, my };
}

const LARGO: Record<Dos, number> = { R: 3, Rv: 3, C: 0.6, Cp: 0.6, L: 3.2, V: 2.4, Vac: 2.4, I: 2.4, D: 1.6, LED: 1.6, DZ: 1.6, SW: 2.4, X: 2 };

function dosTerminales(k: Dos, x1: number, y1: number, x2: number, y2: number, rol: string | undefined, out: Prim[]): void {
  const { p, L } = marco(x1, y1, x2, y2);
  const h = Math.min(LARGO[k], L) / 2;
  // leads
  out.push({ t: 'path', d: `${M(p(-L / 2, 0))}${Lto(p(-h, 0))}${M(p(h, 0))}${Lto(p(L / 2, 0))}`, cls: 'linea' });
  const poli = (pts: [number, number][], cerrado = true): string =>
    pts.map((q, i) => (i ? Lto(p(q[0], q[1])) : M(p(q[0], q[1])))).join('') + (cerrado ? 'Z' : '');
  const c = p(0, 0);
  switch (k) {
    case 'R':
    case 'Rv':
      out.push({ t: 'path', d: poli([[-1.5, -0.55], [1.5, -0.55], [1.5, 0.55], [-1.5, 0.55]]), cls: 'cuerpo', rol });
      if (k === 'Rv') out.push({ t: 'path', d: `${M(p(-1.4, 1.1))}${Lto(p(1.4, -1.1))}`, cls: 'linea', rol });
      break;
    case 'C':
    case 'Cp':
      out.push({ t: 'path', d: `${M(p(-0.3, -1.1))}${Lto(p(-0.3, 1.1))}${M(p(0.3, -1.1))}${Lto(p(0.3, 1.1))}`, cls: 'linea', rol });
      // the plates are drawn thicker as a filled body
      out.push({ t: 'path', d: poli([[-0.42, -1.1], [-0.18, -1.1], [-0.18, 1.1], [-0.42, 1.1]]) + poli([[0.18, -1.1], [0.42, -1.1], [0.42, 1.1], [0.18, 1.1]]), cls: 'relleno', rol });
      if (k === 'Cp') out.push({ t: 'path', d: `${M(p(0.9, -1.0))}${Lto(p(0.9, -0.4))}${M(p(0.6, -0.7))}${Lto(p(1.2, -0.7))}`, cls: 'linea' });
      break;
    case 'L': {
      let d = M(p(-1.6, 0));
      for (let i = 0; i < 4; i++) {
        const q = p(-1.6 + 0.8 * (i + 1), 0);
        d += `A${f(0.4)} ${f(0.4)} 0 0 1 ${f(q[0])} ${f(q[1])}`;
      }
      out.push({ t: 'path', d, cls: 'linea', rol });
      break;
    }
    case 'V':
    case 'Vac':
    case 'I':
      out.push({ t: 'circ', cx: c[0], cy: c[1], r: 1.2, cls: 'cuerpo', rol });
      if (k === 'V') {
        const mas = p(0.6, 0);
        const menos = p(-0.6, 0);
        out.push({
          t: 'path',
          d: `M${f(mas[0] - 0.3)} ${f(mas[1])}L${f(mas[0] + 0.3)} ${f(mas[1])}M${f(mas[0])} ${f(mas[1] - 0.3)}L${f(mas[0])} ${f(mas[1] + 0.3)}M${f(menos[0] - 0.3)} ${f(menos[1])}L${f(menos[0] + 0.3)} ${f(menos[1])}`,
          cls: 'linea',
        });
      } else if (k === 'Vac') {
        // a sine across the circle, always horizontal on screen
        const d = `M${f(c[0] - 0.7)} ${f(c[1])}Q${f(c[0] - 0.35)} ${f(c[1] - 0.9)} ${f(c[0])} ${f(c[1])}T${f(c[0] + 0.7)} ${f(c[1])}`;
        out.push({ t: 'path', d, cls: 'linea' });
      } else {
        out.push({ t: 'path', d: `${M(p(-0.7, 0))}${Lto(p(0.6, 0))}`, cls: 'linea' });
        out.push({ t: 'path', d: poli([[0.75, 0], [0.25, -0.35], [0.25, 0.35]]), cls: 'relleno' });
      }
      break;
    case 'D':
    case 'LED':
    case 'DZ':
      out.push({ t: 'path', d: poli([[-0.8, -0.85], [-0.8, 0.85], [0.8, 0]]), cls: 'cuerpo', rol });
      if (k === 'DZ') out.push({ t: 'path', d: `${M(p(0.5, -1.1))}${Lto(p(0.8, -0.85))}${Lto(p(0.8, 0.85))}${Lto(p(1.1, 1.1))}`, cls: 'linea', rol });
      else out.push({ t: 'path', d: `${M(p(0.8, -0.9))}${Lto(p(0.8, 0.9))}`, cls: 'linea', rol });
      if (k === 'LED') {
        for (const s of [0, 0.7]) {
          const a = p(-0.1 + s, -1.0);
          const b = p(0.6 + s, -1.9);
          out.push({ t: 'path', d: `${M(a)}${Lto(b)}`, cls: 'linea' });
          out.push({ t: 'path', d: poli([[0.6 + s, -1.9], [0.25 + s, -1.7], [0.5 + s, -1.45]]), cls: 'relleno' });
        }
      }
      break;
    case 'SW': {
      out.push({ t: 'circ', ...xy(p(-1.0, 0)), r: 0.22, cls: 'hueco' });
      out.push({ t: 'circ', ...xy(p(1.0, 0)), r: 0.22, cls: 'hueco' });
      out.push({ t: 'path', d: `${M(p(-0.8, -0.1))}${Lto(p(1.0, -1.0))}`, cls: 'linea', rol });
      break;
    }
    case 'X':
      out.push({ t: 'path', d: poli([[-0.45, -0.9], [0.45, -0.9], [0.45, 0.9], [-0.45, 0.9]]), cls: 'cuerpo', rol });
      out.push({ t: 'path', d: `${M(p(-0.8, -1.1))}${Lto(p(-0.8, 1.1))}${M(p(0.8, -1.1))}${Lto(p(0.8, 1.1))}`, cls: 'linea' });
      break;
  }
}

function xy(q: P): { cx: number; cy: number } {
  return { cx: q[0], cy: q[1] };
}

/** Where the label of a two-terminal part goes. */
function lugarEtiqueta(x1: number, y1: number, x2: number, y2: number, lado: Lado, k: Dos): { x: number; y: number; ancla: Ancla } | null {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const ancho = k === 'V' || k === 'Vac' || k === 'I' ? 1.7 : k === 'C' || k === 'Cp' || k === 'L' ? 1.6 : 1.2;
  switch (lado) {
    case 'd':
      return { x: mx + ancho + 0.2, y: my, ancla: 'l' };
    case 'i':
      return { x: mx - ancho - 0.2, y: my, ancla: 'r' };
    case 'a':
      return { x: mx, y: my - ancho - 1.5, ancla: 'c' };
    case 'b':
      return { x: mx, y: my + ancho + 1.8, ancla: 'c' };
    default:
      return null;
  }
}

/** All the primitives of a template (geometry in SVG units, labels and bars by role). */
export function compilar(t: Plantilla): Prim[] {
  const out: Prim[] = [];
  const labs: Prim[] = [];
  for (const e of t.e) {
    const k = e[0];
    switch (k) {
      case 'w': {
        const n = e.slice(1) as number[];
        let d = '';
        for (let i = 0; i < n.length; i += 2) d += (i ? Lto : M)([n[i] as number, n[i + 1] as number]);
        out.push({ t: 'path', d, cls: 'linea' });
        break;
      }
      case 'trazos': {
        const n = e.slice(1) as number[];
        let d = '';
        for (let i = 0; i < n.length; i += 2) d += (i ? Lto : M)([n[i] as number, n[i + 1] as number]);
        out.push({ t: 'path', d, cls: 'trazos' });
        break;
      }
      case 'gnd': {
        const [, x, y] = e;
        out.push({
          t: 'path',
          d: `${M([x, y])}${Lto([x, y + 0.6])}${M([x - 0.8, y + 0.6])}${Lto([x + 0.8, y + 0.6])}${M([x - 0.5, y + 0.95])}${Lto([x + 0.5, y + 0.95])}${M([x - 0.2, y + 1.3])}${Lto([x + 0.2, y + 1.3])}`,
          cls: 'linea',
        });
        break;
      }
      case 'dot':
        out.push({ t: 'circ', cx: e[1], cy: e[2], r: 0.26, cls: 'relleno' });
        break;
      case 'term':
        out.push({ t: 'circ', cx: e[1], cy: e[2], r: 0.32, cls: 'hueco' });
        break;
      case 'vcc': {
        const [, x, y, txt] = e;
        out.push({ t: 'path', d: `${M([x, y])}${Lto([x, y - 0.8])}${M([x - 0.8, y - 0.8])}${Lto([x + 0.8, y - 0.8])}`, cls: 'linea' });
        out.push({ t: 'txt', x, y: y - 1.3, html: txt, ancla: 'c', cls: 'fijo' });
        break;
      }
      case 'oa': {
        const [, x, y, inv] = e;
        out.push({ t: 'path', d: `${M([x, y - 2.2])}${Lto([x, y + 2.2])}${Lto([x + 4, y])}Z`, cls: 'cuerpo' });
        const s1 = inv ? '−' : '+';
        const s2 = inv ? '+' : '−';
        out.push({ t: 'txt', x: x + 0.7, y: y - 0.65, html: s1, ancla: 'c', cls: 'signo' });
        out.push({ t: 'txt', x: x + 0.7, y: y + 1.35, html: s2, ancla: 'c', cls: 'signo' });
        break;
      }
      case 'npn': {
        const [, x, y] = e;
        out.push({ t: 'circ', cx: x + 1.35, cy: y, r: 1.55, cls: 'cuerpo' });
        out.push({
          t: 'path',
          d: `${M([x, y])}${Lto([x + 0.8, y])}${M([x + 0.8, y - 0.85])}${Lto([x + 0.8, y + 0.85])}${M([x + 0.8, y - 0.4])}${Lto([x + 2, y - 1.15])}${Lto([x + 2, y - 2])}${M([x + 0.8, y + 0.4])}${Lto([x + 2, y + 1.15])}${Lto([x + 2, y + 2])}`,
          cls: 'linea',
        });
        out.push({ t: 'path', d: `${M([x + 1.85, y + 1.06])}${Lto([x + 1.3, y + 1.08])}${Lto([x + 1.6, y + 0.6])}Z`, cls: 'relleno' });
        break;
      }
      case 'nmos': {
        const [, x, y] = e;
        out.push({ t: 'circ', cx: x + 1.4, cy: y, r: 1.6, cls: 'cuerpo' });
        out.push({
          t: 'path',
          d: `${M([x, y])}${Lto([x + 0.7, y])}${M([x + 0.7, y - 0.9])}${Lto([x + 0.7, y + 0.9])}` +
            `${M([x + 1.05, y - 1.0])}${Lto([x + 1.05, y - 0.5])}${M([x + 1.05, y - 0.25])}${Lto([x + 1.05, y + 0.25])}${M([x + 1.05, y + 0.5])}${Lto([x + 1.05, y + 1.0])}` +
            `${M([x + 1.05, y - 0.75])}${Lto([x + 2, y - 0.75])}${Lto([x + 2, y - 2])}${M([x + 1.05, y + 0.75])}${Lto([x + 2, y + 0.75])}${Lto([x + 2, y + 2])}${M([x + 1.05, y])}${Lto([x + 2, y])}${Lto([x + 2, y + 0.75])}`,
          cls: 'linea',
        });
        out.push({ t: 'path', d: `${M([x + 1.1, y])}${Lto([x + 1.55, y - 0.25])}${Lto([x + 1.55, y + 0.25])}Z`, cls: 'relleno' });
        break;
      }
      case 'caja': {
        const [, x, y, w, h, txt] = e;
        out.push({ t: 'path', d: `${M([x, y])}${Lto([x + w, y])}${Lto([x + w, y + h])}${Lto([x, y + h])}Z`, cls: 'cuerpo' });
        out.push({ t: 'txt', x: x + w / 2, y: y + h / 2 + 0.45, html: txt, ancla: 'c', cls: 'caja' });
        break;
      }
      case 'bloque': {
        const [, x, y, w, h, rol] = e;
        out.push({ t: 'path', d: `${M([x, y])}${Lto([x + w, y])}${Lto([x + w, y + h])}${Lto([x, y + h])}Z`, cls: 'cuerpo', rol });
        labs.push({ t: 'lab', x: x + w / 2, y: y + h / 2 - 0.5, rol, ancla: 'c', una: false, auto: true });
        break;
      }
      case 'suma': {
        const [, x, y] = e;
        out.push({ t: 'circ', cx: x, cy: y, r: 0.9, cls: 'cuerpo' });
        out.push({ t: 'txt', x, y: y + 0.45, html: 'Σ', ancla: 'c', cls: 'fijo' });
        break;
      }
      case 'nucleo': {
        const [, x1, y1, x2, y2] = e;
        out.push({ t: 'path', d: `${M([x1 - 0.18, y1])}${Lto([x2 - 0.18, y2])}${M([x1 + 0.18, y1])}${Lto([x2 + 0.18, y2])}`, cls: 'linea' });
        break;
      }
      case 'puente': {
        const [, x, y, r] = e;
        const top: P = [x, y - r];
        const der: P = [x + r, y];
        const bajo: P = [x, y + r];
        const izq: P = [x - r, y];
        // diodes point from the − corner (left) to the + corner (right)
        dosTerminales('D', izq[0], izq[1], top[0], top[1], undefined, out);
        dosTerminales('D', top[0], top[1], der[0], der[1], undefined, out);
        dosTerminales('D', izq[0], izq[1], bajo[0], bajo[1], undefined, out);
        dosTerminales('D', bajo[0], bajo[1], der[0], der[1], undefined, out);
        for (const q of [top, der, bajo, izq]) out.push({ t: 'circ', cx: q[0], cy: q[1], r: 0.24, cls: 'relleno' });
        break;
      }
      case 'antena': {
        const [, x, y] = e;
        out.push({ t: 'path', d: `${M([x, y])}${Lto([x, y - 3])}${M([x - 1.1, y - 4.2])}${Lto([x, y - 3])}${Lto([x + 1.1, y - 4.2])}${M([x - 1.1, y - 4.2])}${Lto([x + 1.1, y - 4.2])}`, cls: 'linea' });
        break;
      }
      case 'cara': {
        const [, n, ...pts] = e;
        let d = '';
        for (let i = 0; i < pts.length; i += 2) d += (i ? Lto : M)([pts[i] as number, pts[i + 1] as number]);
        out.push({ t: 'path', d: d + 'Z', cls: (`cara${n}` as 'cara1') });
        break;
      }
      case 'flecha': {
        const [, x1, y1, x2, y2, rol] = e;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const L = Math.hypot(dx, dy) || 1;
        const ux = dx / L;
        const uy = dy / L;
        const b: P = [x2 - 0.75 * ux, y2 - 0.75 * uy];
        out.push({ t: 'path', d: `${M([x1, y1])}${Lto(b)}`, cls: 'flecha', rol });
        out.push({ t: 'path', d: `${M([x2, y2])}${Lto([b[0] - 0.38 * uy, b[1] + 0.38 * ux])}${Lto([b[0] + 0.38 * uy, b[1] - 0.38 * ux])}Z`, cls: 'relleno', rol });
        break;
      }
      case 'cota': {
        const [, x1, y1, x2, y2] = e;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L;
        const ny = dx / L;
        const ux = dx / L;
        const uy = dy / L;
        const tick = (q: P) => `${M([q[0] - 0.5 * nx, q[1] - 0.5 * ny])}${Lto([q[0] + 0.5 * nx, q[1] + 0.5 * ny])}`;
        const head = (q: P, s: number) =>
          `${M(q)}${Lto([q[0] + s * 0.6 * ux + 0.3 * nx, q[1] + s * 0.6 * uy + 0.3 * ny])}${M(q)}${Lto([q[0] + s * 0.6 * ux - 0.3 * nx, q[1] + s * 0.6 * uy - 0.3 * ny])}`;
        out.push({ t: 'path', d: `${M([x1, y1])}${Lto([x2, y2])}${tick([x1, y1])}${tick([x2, y2])}${head([x1, y1], 1)}${head([x2, y2], -1)}`, cls: 'tenue' });
        break;
      }
      case 'lab':
        labs.push({ t: 'lab', x: e[1], y: e[2], rol: e[3], ancla: e[4], una: !!e[5] });
        break;
      case 'txt':
        out.push({ t: 'txt', x: e[1], y: e[2], html: e[3], ancla: e[4], cls: e[5] ?? 'fijo' });
        break;
      case 'hbarra':
        labs.push({ t: 'hbarra', x: e[1], y: e[2], w: e[3], rol: e[4], grupo: e[5] });
        break;
      default: {
        const [kk, x1, y1, x2, y2, rol, lado] = e as [Dos, number, number, number, number, string?, Lado?];
        dosTerminales(kk, x1, y1, x2, y2, rol || undefined, out);
        if (rol && lado) {
          const q = lugarEtiqueta(x1, y1, x2, y2, lado, kk);
          if (q) labs.push({ t: 'lab', x: q.x, y: q.y, rol, ancla: q.ancla, una: false, auto: true });
        }
      }
    }
  }
  return [...out, ...labs];
}
