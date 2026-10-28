// State of the schematic editor: the document, the selection, the tool, undo/redo (snapshots of the
// document) and the editing operations shared by the canvas, the toolbar, the keyboard and the panels.

import { conectividad } from './conectividad.ts';
import { tipoDe, TIPO } from './catalogo.ts';
import { cajaMundo, geometria, girada, pinesMundo, reflejada } from './geometria.ts';
import { generarNetlist } from './netlist.ts';
import { documentoVacio, type Cable, type Componente, type DocumentoEsquema } from './tipos.ts';

export type Herramienta = 'seleccionar' | 'cable' | 'colocar';

const MAX_HISTORIA = 200;

/** What «Copiar» keeps (in memory, shared by every editor of the page). */
let portapapeles: { componentes: Componente[]; cables: Cable[] } | null = null;

export class Editor {
  doc = $state<DocumentoEsquema>(documentoVacio());
  /** Selected part and wire ids. */
  sel = $state<string[]>([]);
  herramienta = $state<Herramienta>('seleccionar');
  /** Kind being placed (palette) when the tool is «colocar». */
  colocando = $state<string | null>(null);
  /** Bumps on every change of the document (autosave, results going stale). */
  version = $state(0);
  puedeDeshacer = $state(false);
  puedeRehacer = $state(false);
  hayPortapapeles = $state(!!portapapeles);

  private pasado: string[] = [];
  private futuro: string[] = [];
  private ultimoId = 0;

  readonly con = $derived(conectividad(this.doc));
  readonly nl = $derived(generarNetlist(this.doc));

  cargar(doc: DocumentoEsquema): void {
    this.doc = doc;
    this.sel = [];
    this.pasado = [];
    this.futuro = [];
    this.puedeDeshacer = this.puedeRehacer = false;
    this.ultimoId = 0;
    for (const x of [...doc.componentes, ...doc.cables]) {
      const n = Number(/(\d+)$/.exec(x.id)?.[1] ?? 0);
      if (n > this.ultimoId) this.ultimoId = n;
    }
    this.version++;
  }

  nuevoId(p: 'c' | 'w'): string {
    return `${p}${++this.ultimoId}`;
  }

  /** Records the state before a change; `fn` changes the document. */
  cambiar(fn: () => void): void {
    this.pasado.push(JSON.stringify($state.snapshot(this.doc)));
    if (this.pasado.length > MAX_HISTORIA) this.pasado.shift();
    this.futuro = [];
    fn();
    this.puedeDeshacer = true;
    this.puedeRehacer = false;
    this.version++;
  }

  deshacer(): void {
    const s = this.pasado.pop();
    if (!s) return;
    this.futuro.push(JSON.stringify($state.snapshot(this.doc)));
    this.doc = JSON.parse(s) as DocumentoEsquema;
    this.sel = this.sel.filter((id) => this.existe(id));
    this.puedeDeshacer = this.pasado.length > 0;
    this.puedeRehacer = true;
    this.version++;
  }

  rehacer(): void {
    const s = this.futuro.pop();
    if (!s) return;
    this.pasado.push(JSON.stringify($state.snapshot(this.doc)));
    this.doc = JSON.parse(s) as DocumentoEsquema;
    this.sel = this.sel.filter((id) => this.existe(id));
    this.puedeRehacer = this.futuro.length > 0;
    this.puedeDeshacer = true;
    this.version++;
  }

  existe(id: string): boolean {
    return this.doc.componentes.some((c) => c.id === id) || this.doc.cables.some((w) => w.id === id);
  }

  componente(id: string): Componente | undefined {
    return this.doc.componentes.find((c) => c.id === id);
  }

  /** The only selected part, if exactly one part is selected. */
  get unico(): Componente | null {
    if (this.sel.length !== 1) return null;
    return this.componente(this.sel[0]!) ?? null;
  }

  // ---------------------------------------------------------------- names

  nombreLibre(prefijo: string, ocupados = new Set(this.doc.componentes.map((c) => c.nombre.toUpperCase()))): string {
    if (!prefijo) return '';
    for (let k = 1; ; k++) {
      const n = `${prefijo}${k}`;
      if (!ocupados.has(n.toUpperCase())) return n;
    }
  }

  // ---------------------------------------------------------------- operations

  colocar(tipo: string, x: number, y: number): Componente | null {
    const t = TIPO.get(tipo);
    if (!t) return null;
    const c: Componente = { id: this.nuevoId('c'), tipo, nombre: this.nombreLibre(t.prefijo), x, y, o: t.o, campos: { ...t.inicial } };
    // Place it so that the click falls on its body centre (pins stay on the grid).
    const g = geometria(c);
    c.x = Math.round(x - (g.cuerpo[0] + g.cuerpo[2]) / 2);
    c.y = Math.round(y - (g.cuerpo[1] + g.cuerpo[3]) / 2);
    this.cambiar(() => this.doc.componentes.push(c));
    this.sel = [c.id];
    return c;
  }

  /** Adds wires (an L made of up to two straight runs), dropping empty ones and exact duplicates. */
  anadirCables(tramos: [number, number, number, number][]): void {
    const nuevos = tramos.filter((p) => Math.hypot(p[2] - p[0], p[3] - p[1]) > 1e-6).filter((p) => !this.doc.cables.some((w) => mismo(w.p, p)));
    if (!nuevos.length) return;
    this.cambiar(() => {
      for (const p of nuevos) this.doc.cables.push({ id: this.nuevoId('w'), p });
    });
  }

  borrar(ids = this.sel): void {
    if (!ids.length) return;
    const s = new Set(ids);
    this.cambiar(() => {
      this.doc.componentes = this.doc.componentes.filter((c) => !s.has(c.id));
      this.doc.cables = this.doc.cables.filter((w) => !s.has(w.id));
    });
    this.sel = [];
  }

  /** Centre of the selection on the grid. */
  private centro(ids: string[]): [number, number] {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const c = this.componente(id);
      if (c) {
        const g = geometria(c).cuerpo;
        x0 = Math.min(x0, g[0] + c.x);
        y0 = Math.min(y0, g[1] + c.y);
        x1 = Math.max(x1, g[2] + c.x);
        y1 = Math.max(y1, g[3] + c.y);
      }
      const w = this.doc.cables.find((x) => x.id === id);
      if (w) {
        x0 = Math.min(x0, w.p[0], w.p[2]);
        y0 = Math.min(y0, w.p[1], w.p[3]);
        x1 = Math.max(x1, w.p[0], w.p[2]);
        y1 = Math.max(y1, w.p[1], w.p[3]);
      }
    }
    return [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2)];
  }

  /** Quarter turn clockwise (or a left–right mirror) of the selection about its centre; wires follow. */
  transformar(ids: string[], modo: 'girar' | 'reflejar'): void {
    if (!ids.length) return;
    const [cx, cy] = this.centro(ids);
    const P = (x: number, y: number): [number, number] => (modo === 'girar' ? [cx - (y - cy), cy + (x - cx)] : [2 * cx - x, y]);
    const s = new Set(ids);
    // Wires hanging from the moved pins keep their far end: they become L shapes.
    const antes = new Map<string, [number, number][]>();
    for (const c of this.doc.componentes) if (s.has(c.id)) antes.set(c.id, pinesMundo(c).map((p) => [p.x, p.y]));
    this.cambiar(() => {
      const mover = new Map<string, [number, number]>();
      for (const c of this.doc.componentes) {
        if (!s.has(c.id)) continue;
        const g0 = geometria(c);
        const centro0: [number, number] = [c.x + (g0.cuerpo[0] + g0.cuerpo[2]) / 2, c.y + (g0.cuerpo[1] + g0.cuerpo[3]) / 2];
        c.o = modo === 'girar' ? girada(c.o) : reflejada(c.o);
        const g1 = geometria(c);
        const [nx, ny] = P(centro0[0], centro0[1]);
        c.x = Math.round(nx - (g1.cuerpo[0] + g1.cuerpo[2]) / 2);
        c.y = Math.round(ny - (g1.cuerpo[1] + g1.cuerpo[3]) / 2);
        const despues = pinesMundo(c);
        antes.get(c.id)!.forEach(([x, y], i) => mover.set(clave(x, y), [despues[i]!.x, despues[i]!.y]));
      }
      for (const w of this.doc.cables) {
        if (s.has(w.id)) {
          const [a, b] = P(w.p[0], w.p[1]);
          const [c2, d] = P(w.p[2], w.p[3]);
          w.p = [a, b, c2, d];
        }
      }
      this.estirar(mover, s);
    });
  }

  /**
   * Wires not in `fijos` whose ends sat on moved pins follow them: a wire that would go oblique becomes an
   * L that keeps its original direction from the end that did not move.
   */
  estirar(mover: Map<string, [number, number]>, fijos: Set<string>): void {
    const nuevos: Cable[] = [];
    for (const w of this.doc.cables) {
      if (fijos.has(w.id)) continue;
      const a = mover.get(clave(w.p[0], w.p[1]));
      const b = mover.get(clave(w.p[2], w.p[3]));
      if (!a && !b) continue;
      const horizontal = Math.abs(w.p[1] - w.p[3]) < 1e-9;
      const p: [number, number, number, number] = [a?.[0] ?? w.p[0], a?.[1] ?? w.p[1], b?.[0] ?? w.p[2], b?.[1] ?? w.p[3]];
      if (Math.abs(p[0] - p[2]) < 1e-9 || Math.abs(p[1] - p[3]) < 1e-9 || (a && b)) {
        w.p = p;
        continue;
      }
      // Fixed end F, moved end M.
      const F: [number, number] = a ? [p[2], p[3]] : [p[0], p[1]];
      const M: [number, number] = a ? [p[0], p[1]] : [p[2], p[3]];
      const codo: [number, number] = horizontal ? [M[0], F[1]] : [F[0], M[1]];
      w.p = [F[0], F[1], codo[0], codo[1]];
      nuevos.push({ id: this.nuevoId('w'), p: [codo[0], codo[1], M[0], M[1]], ...(w.red ? { red: w.red } : {}) });
    }
    this.doc.cables.push(...nuevos);
    this.doc.cables = this.doc.cables.filter((w) => Math.hypot(w.p[2] - w.p[0], w.p[3] - w.p[1]) > 1e-9);
  }

  /** Moves the selection by (dx, dy) grid units; wires attached to moved pins stretch. */
  mover(ids: string[], dx: number, dy: number): void {
    if (!ids.length || (!dx && !dy)) return;
    const s = new Set(ids);
    this.cambiar(() => {
      const mover = new Map<string, [number, number]>();
      for (const c of this.doc.componentes) {
        if (!s.has(c.id)) continue;
        for (const p of pinesMundo(c)) mover.set(clave(p.x, p.y), [p.x + dx, p.y + dy]);
        c.x += dx;
        c.y += dy;
      }
      for (const w of this.doc.cables) {
        if (!s.has(w.id)) continue;
        // Ends of selected wires drag the unselected wires attached to them too.
        mover.set(clave(w.p[0], w.p[1]), [w.p[0] + dx, w.p[1] + dy]);
        mover.set(clave(w.p[2], w.p[3]), [w.p[2] + dx, w.p[3] + dy]);
        w.p = [w.p[0] + dx, w.p[1] + dy, w.p[2] + dx, w.p[3] + dy];
      }
      this.estirar(mover, s);
    });
  }

  copiar(ids = this.sel): void {
    const s = new Set(ids);
    const componentes = $state.snapshot(this.doc.componentes.filter((c) => s.has(c.id))) as Componente[];
    const cables = $state.snapshot(this.doc.cables.filter((w) => s.has(w.id))) as Cable[];
    if (!componentes.length && !cables.length) return;
    portapapeles = JSON.parse(JSON.stringify({ componentes, cables })) as { componentes: Componente[]; cables: Cable[] };
    this.hayPortapapeles = true;
  }

  pegar(dx = 2, dy = 2): void {
    if (!portapapeles) return;
    const ocupados = new Set(this.doc.componentes.map((c) => c.nombre.toUpperCase()));
    const comps = portapapeles.componentes.map((c) => {
      const t = tipoDe(c);
      const nombre = t.prefijo && c.tipo !== 'GEN' && ocupados.has(c.nombre.toUpperCase()) ? this.nombreLibre(t.prefijo, ocupados) : c.nombre;
      ocupados.add(nombre.toUpperCase());
      return { ...JSON.parse(JSON.stringify(c)), id: this.nuevoId('c'), nombre, x: c.x + dx, y: c.y + dy } as Componente;
    });
    const cables = portapapeles.cables.map((w) => ({ ...w, id: this.nuevoId('w'), p: [w.p[0] + dx, w.p[1] + dy, w.p[2] + dx, w.p[3] + dy] as Cable['p'] }));
    this.cambiar(() => {
      this.doc.componentes.push(...comps);
      this.doc.cables.push(...cables);
    });
    this.sel = [...comps.map((c) => c.id), ...cables.map((w) => w.id)];
  }

  duplicar(): void {
    this.copiar();
    this.pegar();
  }

  seleccionarTodo(): void {
    this.sel = [...this.doc.componentes.map((c) => c.id), ...this.doc.cables.map((w) => w.id)];
  }

  /** Ids of the parts and wires inside a box (world units). */
  enCaja(x0: number, y0: number, x1: number, y1: number): string[] {
    const [a, b, c, d] = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
    const ids: string[] = [];
    for (const k of this.doc.componentes) {
      const r = cajaMundo(k);
      if (r[0] >= a && r[2] <= c && r[1] >= b && r[3] <= d) ids.push(k.id);
    }
    for (const w of this.doc.cables) {
      if (Math.min(w.p[0], w.p[2]) >= a && Math.max(w.p[0], w.p[2]) <= c && Math.min(w.p[1], w.p[3]) >= b && Math.max(w.p[1], w.p[3]) <= d) ids.push(w.id);
    }
    return ids;
  }

  cambiarCampo(id: string, campo: string, valor: string): void {
    const c = this.componente(id);
    if (!c || c.campos[campo] === valor) return;
    this.cambiar(() => {
      c.campos[campo] = valor;
    });
  }

  renombrar(id: string, nombre: string): void {
    const c = this.componente(id);
    if (!c || c.nombre === nombre) return;
    this.cambiar(() => {
      c.nombre = nombre;
    });
  }
}

/**
 * What the properties panel and the palette use of an editor. The breadboard (componentes/protoboard/)
 * offers the same members over its own parts, so it reuses both panels unchanged.
 */
export type EdicionPropiedades = Pick<Editor, 'unico' | 'sel' | 'doc' | 'con' | 'nl' | 'cambiarCampo' | 'renombrar' | 'transformar' | 'duplicar' | 'borrar' | 'cambiar'>;
export type EdicionPaleta = Pick<Editor, 'herramienta' | 'colocando' | 'sel'>;

function mismo(a: number[], b: number[]): boolean {
  const eq = (i: number, j: number) => Math.abs(a[i]! - b[j]!) < 1e-9;
  return (eq(0, 0) && eq(1, 1) && eq(2, 2) && eq(3, 3)) || (eq(0, 2) && eq(1, 3) && eq(2, 0) && eq(3, 1));
}

export const clave = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
