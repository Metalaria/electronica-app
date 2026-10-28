// Shared pieces of the simple bodies of the 3D boards (modelos3d.cuerpoSimple) and, since 0.10, the bodies of
// the console boards' parts that the model library does not draw: ICs in any gull-wing package with their marking,
// SIP networks, axial and radial parts, SMD chips, TO-92, connectors with their openings, metal cans, switches,
// trimmers, chokes, wire links and lying crystals (descriptors from contenido/consolas_cuerpos.py). Every body is
// built from the footprint's own pads, in footprint-local model axes (x right, y up on the top face, z up from the
// board), so its leads land on them. Materials are shared by colour and markings by text (one texture per text).

import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { DescriptorModelo, Huella } from './datos';

/** A footprint pad in local axes (mm, KiCad's: y down): number, centre, size along x / y, through-hole. */
export interface PadLocal {
  n: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  tht?: boolean;
}

// ------------------------------------------------------------------ shared materials, geometries and markings

const materiales = new Map<string, Material>();

export function mat(color: string, rough = 0.6, metal = 0): Material {
  const k = `${color}|${rough}|${metal}`;
  let m = materiales.get(k);
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    materiales.set(k, m);
  }
  return m;
}

export function liberarMateriales(): void {
  for (const m of materiales.values()) {
    (m as MeshStandardMaterial).map?.dispose();
    m.dispose();
  }
  materiales.clear();
}

/** A printed marking (the part's value) on a face: a plane w × h mm facing +z («\n» separates lines). */
export function rotulo(texto: string, w: number, h: number, color = '#e9e9e4'): Mesh {
  const k = `txt|${texto}|${color}|${Math.round((w / h) * 10)}`;
  let m = materiales.get(k);
  if (!m) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = Math.max(32, Math.min(512, Math.round((512 * h) / w)));
    const g = c.getContext('2d')!;
    const lineas = texto.split('\n');
    let px = Math.min(c.height / (lineas.length * 1.25), 140);
    g.font = `600 ${px}px "Source Sans 3", system-ui, sans-serif`;
    const ancho = Math.max(...lineas.map((l) => g.measureText(l).width));
    if (ancho > c.width * 0.92) px *= (c.width * 0.92) / ancho;
    g.font = `600 ${px}px "Source Sans 3", system-ui, sans-serif`;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lineas.forEach((l, i) => g.fillText(l, c.width / 2, c.height / 2 + (i - (lineas.length - 1) / 2) * px * 1.15));
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    m = new MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    materiales.set(k, m);
  }
  return new Mesh(new PlaneGeometry(w, h), m);
}

export function malla(g: BufferGeometry, m: Material, x: number, y: number, z: number): Mesh {
  const o = new Mesh(g, m);
  o.position.set(x, y, z);
  return o;
}

// unit solids shared by every body (scaled per mesh; the board merges them by material anyway)
const unidad = { caja: null as BoxGeometry | null, cil: new Map<number, CylinderGeometry>(), esfera: null as SphereGeometry | null };

function cajaU(): BoxGeometry {
  return (unidad.caja ??= new BoxGeometry(1, 1, 1));
}

/** Unit cylinder (radius 1, height 1) along z. */
function cilU(seg: number): CylinderGeometry {
  let c = unidad.cil.get(seg);
  if (!c) {
    c = new CylinderGeometry(1, 1, 1, seg);
    c.rotateX(Math.PI / 2);
    unidad.cil.set(seg, c);
  }
  return c;
}

/** A box w × d × h centred at (x, y, z), turned by `giro` about z. */
function bloque(g: Group, m: Material, w: number, d: number, h: number, x: number, y: number, z: number, giro = 0): Mesh {
  const o = new Mesh(cajaU(), m);
  o.scale.set(Math.max(0.01, w), Math.max(0.01, d), Math.max(0.01, h));
  o.position.set(x, y, z);
  o.rotation.z = giro;
  g.add(o);
  return o;
}

/** A vertical cylinder of radius r from z0 to z1 at (x, y). */
function columna(g: Group, m: Material, r: number, x: number, y: number, z0: number, z1: number, seg = 20): Mesh {
  const o = new Mesh(cilU(seg), m);
  o.scale.set(r, r, Math.max(0.01, z1 - z0));
  o.position.set(x, y, (z0 + z1) / 2);
  g.add(o);
  return o;
}

/** A bar (a lead, a wire) of section ancho × grueso from a to b; its width stays horizontal. */
function barra(g: Group, m: Material, a: Vector3, b: Vector3, ancho: number, grueso: number, redonda = false): Mesh {
  const dir = new Vector3().subVectors(b, a);
  const largo = dir.length();
  dir.normalize();
  let lado = new Vector3(0, 0, 1).cross(dir);
  if (lado.lengthSq() < 1e-6) lado = new Vector3(0, 1, 0).cross(dir);
  lado.normalize();
  const arriba = new Vector3().crossVectors(dir, lado);
  const o = new Mesh(redonda ? cilU(8) : cajaU(), m);
  if (redonda) {
    // the unit cylinder runs along z: its axis is the bar's
    o.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(lado, arriba, dir));
    o.scale.set(ancho / 2, ancho / 2, Math.max(0.01, largo));
  } else {
    o.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(dir, lado, arriba));
    o.scale.set(Math.max(0.01, largo), ancho, grueso);
  }
  o.position.copy(a).add(b).multiplyScalar(0.5);
  g.add(o);
  return o;
}

/** A marking on a plane through `c` whose text reads along `x` with its top towards `y` (normal x × y). */
function letrero(g: Group, texto: string, ancho: number, alto: number, color: string, c: Vector3, x: Vector3, y: Vector3): void {
  if (!texto || ancho <= 0.2 || alto <= 0.1) return;
  const n = new Vector3().crossVectors(x, y).normalize();
  const rt = rotulo(texto.replace(/\|/g, '\n'), ancho, alto, color);
  rt.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(x.clone().normalize(), y.clone().normalize(), n));
  rt.position.copy(c).addScaledVector(n, 0.02);
  g.add(rt);
}

const METAL = (): Material => mat('#c9cdd1', 0.3, 0.9);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const natural = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true });

/**
 * Reading direction (angle in radians of the text's x axis, model axes) of an IC's marking, as on a real chip:
 * - two rows (DIP, SOP, SOIC, SIP): pin 1 at the left end, its row underneath (the text runs from pin 1 to pin 2);
 * - four sides, oblong (QFP 14 × 20): along the longer side, pin 1 at the left end;
 * - four sides, square (QFP 28 × 28): pin 1 at the top left corner and the numbering going down the left side, so
 *   the text's up is the way back from pin 2 to pin 1; a pin 1 in the middle of a side (PLCC): that side is the top.
 * `p1`, `p2`: pins 1 and 2 relative to the body's centre; `cuatro`: leads on (at least) three sides. The result is
 * snapped to the body's axes.
 */
export function giroRotulo(bw: number, bd: number, p1: { x: number; y: number }, p2: { x: number; y: number } | null, cuatro: boolean): number {
  const dx = p2 ? p2.x - p1.x : 1;
  const dy = p2 ? p2.y - p1.y : 0;
  let rx: number;
  let ry: number;
  if (!cuatro) {
    rx = dx;
    ry = dy;
  } else if (Math.max(bw, bd) > Math.min(bw, bd) * 1.15) {
    // along the longer side, away from pin 1
    const largoX = bw >= bd;
    rx = largoX ? -Math.sign(p1.x) || 1 : 0;
    ry = largoX ? 0 : -Math.sign(p1.y) || 1;
  } else {
    // where pin 1 sits along its side: near a corner (QFP) or in the middle (PLCC)
    const enLadoX = Math.abs(Math.abs(p1.y) - bd / 2) < Math.abs(Math.abs(p1.x) - bw / 2);
    const medio = enLadoX ? Math.abs(p1.x) < bw * 0.15 : Math.abs(p1.y) < bd * 0.15;
    if (medio) {
      // up towards pin 1's side
      const ux = enLadoX ? 0 : Math.sign(p1.x);
      const uy = enLadoX ? Math.sign(p1.y) : 0;
      rx = uy;
      ry = -ux;
    } else {
      // up = from pin 2 back to pin 1, reading = up turned clockwise
      rx = -dy;
      ry = dx;
    }
  }
  // snapped to the body's axes
  return Math.abs(rx) >= Math.abs(ry) ? (rx >= 0 ? 0 : Math.PI) : ry >= 0 ? Math.PI / 2 : -Math.PI / 2;
}

// ------------------------------------------------------------------ the bodies

/** Types drawn here (the rest stay in modelos3d.cuerpoSimple). */
export const TIPOS_CONSOLA = new Set([
  'ci',
  'sip',
  'axial',
  'radial',
  'chip',
  'to92',
  'conector',
  'lata',
  'pulsador',
  'deslizante',
  'trimmer_c',
  'bobina_tambor',
  'puente_hilo',
  'cristal_h',
  'generico',
  'sin_cuerpo',
  'dip',
  'resistencia_axial',
  'bobina_axial',
  'condensador_disco',
  'electrolitico',
  'cristal',
]);

/**
 * The body of a console part (or null: not one of these descriptors, or a library type without its own pads
 * description, left to cuerpoSimple). `pads`: the footprint's pads in local axes.
 */
export function cuerpoConsola(h: Huella, pads: PadLocal[]): Group | null {
  const m: DescriptorModelo = h.m;
  const t = m.tipo;
  const deConsola = m.clasif === 'tabla' || m.clasif === 'geometria' || m.clasif === 'marcado' || m.patas_pads === true;
  if (!deConsola || !TIPOS_CONSOLA.has(t)) return null;
  const g = new Group();
  // model y from the footprint's local y (see modelos3d.cuerpoSimple)
  const fy = (v: number): number => (h.lado === 'B' ? v : -v);
  const ps = pads.filter((p) => p.n !== '').sort((a, b) => natural(a.n, b.n));
  const P = (p: PadLocal): Vector3 => new Vector3(p.x, fy(p.y), 0);
  const caja = (b: unknown): [number, number, number, number] | null =>
    Array.isArray(b) && b.length === 4 && b.every((v) => typeof v === 'number' && Number.isFinite(v)) ? (b as [number, number, number, number]) : null;
  // a body box in model axes from a local box
  const enModelo = (c: [number, number, number, number]) => {
    const y0 = fy(c[1]);
    const y1 = fy(c[3]);
    return { x0: c[0], x1: c[2], y0: Math.min(y0, y1), y1: Math.max(y0, y1), cx: (c[0] + c[2]) / 2, cy: (y0 + y1) / 2, w: c[2] - c[0], d: Math.abs(y1 - y0) };
  };
  const marcado = texto(m.marcado);
  const blancoTexto = '#d9dcdf';

  if (t === 'sin_cuerpo') return g;

  if (t === 'ci' && (m.patas_pads === true || Array.isArray(m.patas))) {
    const cb = caja(m.cuerpo) ?? m.caja;
    const b = enModelo(cb);
    const hz = num(m.alto, 1.2);
    const zc = Math.min(0.15, hz * 0.12);
    bloque(g, mat(String(m.color ?? '#1b1b1d'), 0.55), b.w, b.d, hz - zc, b.cx, b.cy, zc + (hz - zc) / 2);
    // leads: from the body's side (at 40 % of its height) down to the pad, then a foot on the pad
    const lista: { x: number; y: number; w: number; h: number; n: string }[] = Array.isArray(m.patas)
      ? (m.patas as number[][]).map((q, i) => ({ x: q[0]!, y: q[1]!, w: q[2]!, h: q[3]!, n: String(i + 1) }))
      : ps.map((p) => ({ x: p.x, y: p.y, w: p.w ?? 0.5, h: p.h ?? 0.5, n: p.n }));
    const metal = METAL();
    const zl = Math.max(0.25, Math.min(hz * 0.4, 1.2));
    const lados = new Set<string>();
    for (const q of lista) {
      const qx = q.x;
      const qy = fy(q.y);
      const fx = qx < b.x0 ? b.x0 - qx : qx > b.x1 ? qx - b.x1 : 0;
      const fyv = qy < b.y0 ? b.y0 - qy : qy > b.y1 ? qy - b.y1 : 0;
      if (fx <= 0 && fyv <= 0) continue; // a pad under the body (exposed pad)
      const enX = fx >= fyv;
      const sx = enX ? Math.sign(qx - b.cx) : 0;
      const sy = enX ? 0 : Math.sign(qy - b.cy);
      const borde = enX ? (sx > 0 ? b.x1 : b.x0) : sy > 0 ? b.y1 : b.y0;
      lados.add(enX ? `x${sx}` : `y${sy}`);
      const largoPad = enX ? q.w : q.h;
      const anchoPad = enX ? q.h : q.w;
      const ancho = Math.max(0.12, Math.min(anchoPad * 0.7, 0.6));
      const fuera = enX ? Math.abs(qx - borde) : Math.abs(qy - borde);
      const pie = Math.max(0.2, Math.min(largoPad * 0.55, fuera * 0.6));
      const fin = fuera + Math.min(largoPad * 0.25, 0.4);
      const ini = Math.max(0.15, fin - pie);
      const a = enX ? new Vector3(borde, qy, zl) : new Vector3(qx, borde, zl);
      const codo = enX ? new Vector3(borde + sx * Math.max(0.1, ini - 0.1), qy, 0.09) : new Vector3(qx, borde + sy * Math.max(0.1, ini - 0.1), 0.09);
      const punta = enX ? new Vector3(borde + sx * fin, qy, 0.09) : new Vector3(qx, borde + sy * fin, 0.09);
      const salida = enX ? new Vector3(borde + sx * 0.25, qy, zl) : new Vector3(qx, borde + sy * 0.25, zl);
      barra(g, metal, a, salida, ancho, 0.15);
      barra(g, metal, salida, codo, ancho, 0.15);
      barra(g, metal, codo, punta, ancho, 0.15);
    }
    const p1 = lista.find((q) => q.n === '1') ?? lista[0];
    const p2 = lista.find((q) => q.n === '2') ?? lista[1] ?? null;
    if (p1 && m.punto !== false && lista.length > 4) {
      // pin-1 dimple in the corner nearest to pin 1
      const r = Math.min(0.5, Math.min(b.w, b.d) * 0.07);
      const kx = Math.min(Math.max(p1.x, b.x0 + r * 2.2), b.x1 - r * 2.2);
      const ky = Math.min(Math.max(fy(p1.y), b.y0 + r * 2.2), b.y1 - r * 2.2);
      columna(g, mat('#0b0b0c', 0.9), r, kx, ky, hz - 0.01, hz + 0.012);
    }
    if (marcado && p1 && lista.length > 4) {
      // as the photo shows it (the reconstructed CGB-CPU-04: `giro_rotulo`), else as a real chip reads
      const a =
        typeof m.giro_rotulo === 'number'
          ? (b.d > b.w ? Math.PI / 2 : 0) + (m.giro_rotulo * Math.PI) / 180
          : giroRotulo(b.w, b.d, { x: p1.x - b.cx, y: fy(p1.y) - b.cy }, p2 ? { x: p2.x - b.cx, y: fy(p2.y) - b.cy } : null, lados.size >= 3);
      const largo = Math.abs(Math.cos(a)) > 0.5 ? b.w : b.d;
      const corto = Math.abs(Math.cos(a)) > 0.5 ? b.d : b.w;
      const lineas = marcado.split('|').length;
      const alto = Math.min(corto * (lineas > 1 ? 0.5 : 0.36), largo * 0.2 * lineas);
      letrero(g, marcado, largo * 0.74, alto, blancoTexto, new Vector3(b.cx, b.cy, hz), new Vector3(Math.cos(a), Math.sin(a), 0), new Vector3(-Math.sin(a), Math.cos(a), 0));
    }
    return g;
  }

  if (t === 'dip' && ps.length >= 4) {
    // a DIP from its pads (any row spacing; double footprints: the pad nearest to the middle of each number)
    const porNumero = new Map<string, PadLocal>();
    const cx0 = ps.reduce((s, p) => s + p.x, 0) / ps.length;
    const cy0 = ps.reduce((s, p) => s + p.y, 0) / ps.length;
    for (const p of ps) {
      const q = porNumero.get(p.n);
      if (!q || Math.hypot(p.x - cx0, p.y - cy0) < Math.hypot(q.x - cx0, q.y - cy0)) porNumero.set(p.n, p);
    }
    const qs = [...porNumero.values()].map(P);
    const xs = qs.map((p) => p.x);
    const ys = qs.map((p) => p.y);
    const [px0, px1, py0, py1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const filasEnY = py1 - py0 >= px1 - px0;
    const largo = (filasEnY ? py1 - py0 : px1 - px0) + 2.0;
    const hueco = Math.max(2, (filasEnY ? px1 - px0 : py1 - py0) - 1.3);
    const bx = filasEnY ? hueco : largo;
    const by = filasEnY ? largo : hueco;
    const mx = (px0 + px1) / 2;
    const my = (py0 + py1) / 2;
    const z0 = 0.6;
    const hz = 3.3;
    bloque(g, mat('#1b1b1d', 0.55), bx, by, hz, mx, my, z0 + hz / 2);
    const metal = METAL();
    for (const p of qs) {
      columna(g, metal, 0.25, p.x, p.y, -1.4, z0 + 1.1, 6);
      const lado = filasEnY ? new Vector3(mx + Math.sign(p.x - mx) * (bx / 2), p.y, z0 + 1.1) : new Vector3(p.x, my + Math.sign(p.y - my) * (by / 2), z0 + 1.1);
      barra(g, metal, new Vector3(p.x, p.y, z0 + 1.1), lado, 0.5, 0.25);
    }
    const n1 = porNumero.get('1');
    const n2 = porNumero.get('2');
    const p1 = n1 ? P(n1) : qs[0]!;
    const p2 = n2 ? P(n2) : (qs[1] ?? null);
    // pin-1 notch: a half disc at the end of the body nearest to pin 1
    const ext = filasEnY ? new Vector3(mx, my + Math.sign(p1.y - my) * (by / 2), 0) : new Vector3(mx + Math.sign(p1.x - mx) * (bx / 2), my, 0);
    columna(g, mat('#0b0b0c', 0.9), Math.min(1.0, hueco * 0.12), ext.x, ext.y, z0 + hz - 0.01, z0 + hz + 0.012);
    const mk = marcado || h.v.split(/\s*\/\s*|\s+\(/)[0]!.trim();
    if (mk && mk !== '~') {
      const a = giroRotulo(bx, by, { x: p1.x - mx, y: p1.y - my }, p2 ? { x: p2.x - mx, y: p2.y - my } : null, false);
      letrero(g, mk, largo * 0.72, Math.min(hueco * 0.42, largo * 0.2 * mk.split('|').length), blancoTexto, new Vector3(mx, my, z0 + hz), new Vector3(Math.cos(a), Math.sin(a), 0), new Vector3(-Math.sin(a), Math.cos(a), 0));
    }
    return g;
  }

  if (t === 'sip' && ps.length >= 2) {
    // single in-line package standing over its row (a ZIP's two staggered rows: over their middle line)
    const qs = ps.map(P);
    const a = qs[0]!;
    const z = qs[qs.length - 1]!;
    const dir = new Vector3().subVectors(z, a).setZ(0).normalize();
    const n = new Vector3(dir.y, -dir.x, 0);
    const c = qs.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / qs.length);
    const span = a.distanceTo(z) + 2.0;
    const grosor = num(m.grosor, 2.4);
    const alto = num(m.alto, 5);
    const z0 = 0.8;
    const ang = Math.atan2(dir.y, dir.x);
    bloque(g, mat(String(m.color ?? '#1d1d1f'), 0.55), span, grosor, alto, c.x, c.y, z0 + alto / 2, ang);
    const metal = METAL();
    for (const p of qs) {
      const enCuerpo = c.clone().addScaledVector(dir, dir.dot(new Vector3().subVectors(p, c)));
      columna(g, metal, 0.22, p.x, p.y, -1.4, z0 * 0.6, 6);
      barra(g, metal, new Vector3(p.x, p.y, z0 * 0.6), new Vector3(enCuerpo.x, enCuerpo.y, z0 + 0.2), 0.45, 0.25);
    }
    // the marking on the face that reads from pin 1 to the last pin, and the pin-1 dot on it
    const cara = c.clone().addScaledVector(n, grosor / 2);
    if (marcado) letrero(g, marcado, span * 0.74, Math.min(alto * 0.42, span * 0.2), String(m.color_texto ?? blancoTexto), new Vector3(cara.x, cara.y, z0 + alto * 0.52), dir, new Vector3(0, 0, 1));
    const punto = cara.clone().addScaledVector(dir, -span / 2 + 0.9);
    const dot = new Mesh(cilU(12), mat('#e6e6e0', 0.6));
    dot.scale.set(0.35, 0.35, 0.04);
    dot.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(dir, new Vector3(0, 0, 1), n));
    dot.position.set(punto.x, punto.y, z0 + alto * 0.22).addScaledVector(n, 0.02);
    g.add(dot);
    return g;
  }

  if ((t === 'axial' || t === 'resistencia_axial' || t === 'bobina_axial' || t === 'condensador_disco' || t === 'electrolitico' || t === 'cristal') && ps.length >= 2) {
    // (the library types land here only when the library model was refused: a simple body between the pads)
    const a = P(ps[0]!);
    const b = P(ps[1]!);
    if (t === 'condensador_disco' || t === 'electrolitico' || t === 'cristal') {
      const c = a.clone().add(b).multiplyScalar(0.5);
      const d = num(m.diametro, t === 'cristal' ? 4.6 : 5);
      const alto = t === 'electrolitico' ? num(m.alto, 11) : t === 'cristal' ? 3.5 : 4;
      columna(g, mat(t === 'electrolitico' ? '#1f3f8f' : t === 'cristal' ? '#c4c7c9' : '#c26a2c', 0.45, t === 'cristal' ? 0.8 : 0), d / 2, c.x, c.y, 0.5, 0.5 + alto, 24);
      return g;
    }
    const L = num(m.largo, t === 'resistencia_axial' ? (num(m.paso, 10) < 7 ? 3.6 : 6.3) : 5.2);
    const D = num(m.diametro, t === 'resistencia_axial' ? 1.8 : 2.6);
    const color = String(m.color ?? (t === 'resistencia_axial' ? '#d9c18e' : t === 'bobina_axial' ? '#86b98a' : '#1d1d1f'));
    const dir = new Vector3().subVectors(b, a).normalize();
    const metal = METAL();
    const cuerpo = mat(color, m.vidrio ? 0.15 : 0.5, 0);
    if (m.vertical === true) {
      // standing on pad 1, the other lead looped over to pad 2
      const zt = 0.8 + L;
      const tubo = columna(g, cuerpo, D / 2, a.x, a.y, 0.8, zt, 18);
      void tubo;
      if (m.banda) columna(g, mat(String(m.banda), 0.4, 0.5), D / 2 + 0.03, a.x, a.y, 0.9, 0.9 + L * 0.15, 18);
      columna(g, metal, 0.3, a.x, a.y, -1.4, 0.8, 6);
      const arriba = new Vector3(a.x, a.y, zt + 1.2);
      barra(g, metal, new Vector3(a.x, a.y, zt), arriba, 0.6, 0.6, true);
      barra(g, metal, arriba, new Vector3(b.x, b.y, zt + 1.2), 0.6, 0.6, true);
      barra(g, metal, new Vector3(b.x, b.y, zt + 1.2), new Vector3(b.x, b.y, -1.4), 0.6, 0.6, true);
      return g;
    }
    const smd = m.smd === true;
    const zc = D / 2 + (smd ? 0.05 : 0.4);
    const c = a.clone().add(b).multiplyScalar(0.5);
    const Le = Math.min(L, a.distanceTo(b) + (smd ? 1.5 : -1.2));
    const e0 = c.clone().addScaledVector(dir, -Le / 2).setZ(zc);
    const e1 = c.clone().addScaledVector(dir, Le / 2).setZ(zc);
    barra(g, cuerpo, e0, e1, D, D, true);
    if (smd) {
      // end caps on the pads (an SMD fuse)
      const k = Math.min(1.6, Le * 0.12);
      barra(g, metal, e0, e0.clone().addScaledVector(dir, k), D + 0.12, D + 0.12, true);
      barra(g, metal, e1.clone().addScaledVector(dir, -k), e1, D + 0.12, D + 0.12, true);
      return g;
    }
    if (m.banda) {
      // cathode band next to pad 1
      const b0 = e0.clone().addScaledVector(dir, Le * 0.1);
      barra(g, mat(String(m.banda), 0.4, 0.3), b0, b0.clone().addScaledVector(dir, Le * 0.14), D + 0.06, D + 0.06, true);
    }
    for (const [p, e] of [
      [a, e0],
      [b, e1],
    ] as const) {
      const sobre = new Vector3(p.x, p.y, zc);
      barra(g, metal, e, sobre, 0.55, 0.55, true);
      barra(g, metal, sobre, new Vector3(p.x, p.y, -1.4), 0.55, 0.55, true);
    }
    return g;
  }

  if (t === 'radial' && ps.length >= 1) {
    const qs = ps.map(P);
    const cen = Array.isArray(m.centro) ? new Vector3(num(m.centro[0], 0), fy(num(m.centro[1], 0)), 0) : qs.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / qs.length);
    const ultimo = qs[qs.length - 1]!;
    const ang = qs.length > 1 ? Math.atan2(ultimo.y - qs[0]!.y, ultimo.x - qs[0]!.x) : 0;
    const w = num(m.ancho, 4);
    const d = num(m.fondo, 2.5);
    const alto = num(m.alto, 4);
    const z0 = num(m.z0, 0.8);
    const color = String(m.color ?? '#2a2b2e');
    const forma = String(m.forma ?? 'caja');
    if (forma === 'cilindro') columna(g, mat(color, 0.5), w / 2, cen.x, cen.y, z0, z0 + alto, 28);
    else if (forma === 'led') {
      const r = w / 2;
      columna(g, mat(color, 0.25), r * 1.15, cen.x, cen.y, z0, z0 + 0.9, 20);
      columna(g, mat(color, 0.25), r, cen.x, cen.y, z0 + 0.9, z0 + alto - r, 20);
      const domo = new Mesh((unidad.esfera ??= new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mat(color, 0.25));
      domo.rotation.x = Math.PI / 2;
      domo.scale.set(r, r, r);
      domo.position.set(cen.x, cen.y, z0 + alto - r);
      g.add(domo);
    } else bloque(g, mat(color, 0.55), w, d, alto, cen.x, cen.y, z0 + alto / 2, ang);
    const metal = METAL();
    for (const p of qs) columna(g, metal, 0.25, p.x, p.y, -1.4, z0 + 0.2, 6);
    const mk = marcado;
    if (mk && forma === 'caja') {
      const dx = new Vector3(Math.cos(ang), Math.sin(ang), 0);
      const n = new Vector3(dx.y, -dx.x, 0);
      letrero(g, mk, w * 0.8, Math.min(alto * 0.35, 1.6), String(m.color_texto ?? '#e6e6e0'), cen.clone().addScaledVector(n, d / 2).setZ(z0 + alto * 0.55), dx, new Vector3(0, 0, 1));
    }
    return g;
  }

  if (t === 'chip' && ps.length >= 2) {
    const a = P(ps[0]!);
    const b = P(ps[ps.length - 1]!);
    const dir = new Vector3().subVectors(b, a).normalize();
    const enX = Math.abs(dir.x) >= Math.abs(dir.y);
    const pa = ps[0]!;
    const largoPad = enX ? (pa.w ?? 1) : (pa.h ?? 1);
    const anchoPad = enX ? (pa.h ?? 1) : (pa.w ?? 1);
    const L = a.distanceTo(b) + largoPad * 0.5;
    const W = Math.max(0.5, anchoPad * 0.85);
    const hz = num(m.alto, 1);
    const c = a.clone().add(b).multiplyScalar(0.5);
    const ang = Math.atan2(dir.y, dir.x);
    bloque(g, mat(String(m.color ?? '#2b2b2d'), 0.5), L * 0.76, W, hz, c.x, c.y, hz / 2, ang);
    const ext = mat(String(m.extremos ?? '#c9cdd1'), 0.35, 0.8);
    for (const s of [-1, 1]) {
      const e = c.clone().addScaledVector(dir, s * L * 0.44);
      bloque(g, ext, L * 0.12, W * 1.01, hz * 1.01, e.x, e.y, hz / 2, ang);
    }
    return g;
  }

  if (t === 'to92' && ps.length >= 2) {
    const qs = ps.map(P);
    const a = qs[0]!;
    const z = qs[qs.length - 1]!;
    const dir = new Vector3().subVectors(z, a).normalize();
    const c = qs.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / qs.length);
    const grande = m.tamano === 'L';
    const R = grande ? 2.6 : 2.4;
    const H = grande ? 5.2 : 4.6;
    const z0 = 2.6;
    const ang = Math.atan2(dir.y, dir.x);
    const sub = new Group();
    // half cylinder: round back towards +y of the sub-group, the flat (marked) face towards −y
    const cu = new Mesh(new CylinderGeometry(R, R, H, 20, 1, false, Math.PI / 2, Math.PI), mat('#1e1e1e', 0.55));
    cu.rotation.x = Math.PI / 2;
    cu.position.set(0, 0.0, z0 + H / 2);
    sub.add(cu);
    bloque(sub, mat('#232325', 0.5), 2 * R, 0.08, H, 0, -0.04, z0 + H / 2);
    const mk = marcado;
    if (mk) letrero(sub, mk.slice(0, 10), 2 * R * 0.82, Math.min(1.1, H * 0.22), blancoTexto, new Vector3(0, -0.08, z0 + H * 0.6), new Vector3(1, 0, 0), new Vector3(0, 0, 1));
    sub.rotation.z = ang;
    sub.position.set(c.x, c.y, 0);
    g.add(sub);
    const metal = METAL();
    for (const p of qs) {
      const l = new Vector3().subVectors(p, c);
      const sobre = c.clone().addScaledVector(dir, Math.max(-R * 0.7, Math.min(R * 0.7, l.dot(dir))));
      columna(g, metal, 0.22, p.x, p.y, -1.4, 1.2, 6);
      barra(g, metal, new Vector3(p.x, p.y, 1.2), new Vector3(sobre.x, sobre.y, z0 + 0.1), 0.42, 0.42, true);
    }
    return g;
  }

  if (t === 'conector' || t === 'lata' || t === 'generico') {
    const b = enModelo(caja(m.cuerpo) ?? m.caja);
    const hz = num(m.alto, 3);
    const z0 = num(m.z0, 0);
    const metalico = t === 'lata';
    const color = String(m.color ?? (t === 'generico' ? '#2a2b2e' : metalico ? '#c3c7cc' : '#1c1c1e'));
    bloque(g, mat(color, metalico ? 0.35 : num(m.rugosidad, 0.6), metalico ? 0.8 : num(m.metal, 0)), b.w, b.d, hz, b.cx, b.cy, z0 + hz / 2);
    const ab = m.abertura as { cara?: string; forma?: string } | undefined;
    const negro = mat('#060607', 0.9);
    if (ab?.cara === 'arriba') {
      // a slot along the longer side on the top
      const largoX = b.w >= b.d;
      bloque(g, negro, largoX ? b.w * 0.9 : Math.min(2.2, b.w * 0.3), largoX ? Math.min(2.2, b.d * 0.3) : b.d * 0.9, 0.04, b.cx, b.cy, z0 + hz + 0.02);
    } else if (ab?.cara === 'frente') {
      const f = Array.isArray(m.frente) ? (m.frente as number[]) : [0, 1];
      const ux = num(f[0], 0);
      const uy = fy(num(f[1], 1));
      const enX = Math.abs(ux) >= Math.abs(uy);
      const s = enX ? Math.sign(ux) || 1 : Math.sign(uy) || 1;
      const ancho = enX ? b.d : b.w;
      const cx = enX ? (s > 0 ? b.x1 : b.x0) : b.cx;
      const cy = enX ? b.cy : s > 0 ? b.y1 : b.y0;
      const zm = z0 + hz / 2;
      const forma = ab.forma ?? 'rect';
      const n = enX ? new Vector3(s, 0, 0) : new Vector3(0, s, 0);
      const pos = (k: number) => new Vector3(cx, cy, zm).addScaledVector(n, k);
      if (forma === 'redonda') {
        const r = Math.min(ancho, hz) * 0.32;
        const anillo = new Mesh(cilU(24), mat('#3a3a3c', 0.5));
        anillo.scale.set(r * 1.25, r * 1.25, 0.1);
        anillo.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), n);
        anillo.position.copy(pos(0.04));
        g.add(anillo);
        const hueco = new Mesh(cilU(24), negro);
        hueco.scale.set(r, r, 0.1);
        hueco.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), n);
        hueco.position.copy(pos(0.08));
        g.add(hueco);
      } else if (forma === 'dsub') {
        // the metal shell's front plate and the dark D of the insulator
        const placa = bloque(g, mat('#b9bdc2', 0.35, 0.85), enX ? 0.3 : ancho * 0.96, enX ? ancho * 0.96 : 0.3, hz * 0.9, pos(0.15).x, pos(0.15).y, zm);
        void placa;
        bloque(g, negro, enX ? 0.3 : ancho * 0.55, enX ? ancho * 0.55 : 0.3, hz * 0.32, pos(0.3).x, pos(0.3).y, zm);
      } else {
        const largo = forma === 'ranura' ? 0.8 : 0.6;
        bloque(g, negro, enX ? 0.12 : ancho * largo, enX ? ancho * largo : 0.12, hz * (forma === 'ranura' ? 0.22 : 0.45), pos(0.04).x, pos(0.04).y, zm);
      }
    }
    if (marcado) {
      const largoX = b.w >= b.d;
      letrero(g, marcado, (largoX ? b.w : b.d) * 0.7, Math.min(largoX ? b.d : b.w, hz) * 0.28, metalico ? '#2a2a2c' : blancoTexto, new Vector3(b.cx, b.cy, z0 + hz), largoX ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0), largoX ? new Vector3(0, 1, 0) : new Vector3(-1, 0, 0));
    }
    return g;
  }

  if (t === 'pulsador') {
    const b = enModelo(caja(m.cuerpo) ?? m.caja);
    const hz = num(m.alto, 5);
    const boton = String(m.boton ?? 'redondo');
    const cb = mat(String(m.color_boton ?? '#2a2a2c'), 0.5);
    if (boton === 'cruz') {
      // a key switch: base, upper housing and the cross stem
      bloque(g, mat(String(m.color ?? '#2a2a2c'), 0.6), b.w * 0.9, b.d * 0.9, hz * 0.45, b.cx, b.cy, hz * 0.225);
      bloque(g, mat('#3a3a3d', 0.5), b.w * 0.72, b.d * 0.72, hz * 0.3, b.cx, b.cy, hz * 0.6);
      bloque(g, cb, 4.1, 1.2, hz * 0.25, b.cx, b.cy, hz * 0.875);
      bloque(g, cb, 1.2, 4.1, hz * 0.25, b.cx, b.cy, hz * 0.875);
    } else {
      bloque(g, mat(String(m.color ?? '#1d1d1f'), 0.55), b.w, b.d, hz * 0.6, b.cx, b.cy, hz * 0.3);
      const r = Math.min(b.w, b.d) * 0.3;
      if (boton === 'cuadrado') bloque(g, cb, r * 1.8, r * 1.8, hz * 0.4, b.cx, b.cy, hz * 0.8);
      else columna(g, cb, r, b.cx, b.cy, hz * 0.6, hz, 20);
    }
    return g;
  }

  if (t === 'deslizante') {
    const b = enModelo(caja(m.cuerpo) ?? m.caja);
    const hz = num(m.alto, 7);
    const largoX = b.w >= b.d;
    bloque(g, mat(String(m.color ?? '#b9bdc2'), 0.35, 0.8), b.w, b.d, hz * 0.6, b.cx, b.cy, hz * 0.3);
    bloque(g, mat('#060607', 0.9), largoX ? b.w * 0.75 : 1.2, largoX ? 1.2 : b.d * 0.75, 0.04, b.cx, b.cy, hz * 0.6 + 0.02);
    bloque(g, mat('#1d1d1f', 0.5), largoX ? 3.2 : 2.0, largoX ? 2.0 : 3.2, hz * 0.45, b.cx, b.cy, hz * 0.6 + hz * 0.225);
    return g;
  }

  if (t === 'trimmer_c' && ps.length >= 1) {
    const qs = ps.map(P);
    const c = qs.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / qs.length);
    const D = num(m.diametro, 6);
    bloque(g, mat('#e9e4d6', 0.6), D * 0.95, D * 0.95, 1.4, c.x, c.y, 0.3 + 0.7);
    columna(g, mat(String(m.color ?? '#d8c27a'), 0.45), D * 0.4, c.x, c.y, 1.7, 2.6, 24);
    bloque(g, mat('#3a3a3a', 0.8), D * 0.55, 0.45, 0.06, c.x, c.y, 2.62);
    for (const p of qs) columna(g, METAL(), 0.25, p.x, p.y, -1.4, 0.4, 6);
    return g;
  }

  if (t === 'bobina_tambor') {
    const b = enModelo(caja(m.cuerpo) ?? m.caja);
    const hz = num(m.alto, 6);
    const r = Math.min(b.w, b.d) / 2;
    bloque(g, mat('#1f1f21', 0.6), b.w, b.d, hz * 0.18, b.cx, b.cy, hz * 0.09);
    columna(g, mat('#b8642a', 0.35, 0.8), r * 0.8, b.cx, b.cy, hz * 0.18, hz * 0.82, 28);
    columna(g, mat(String(m.color ?? '#2b2b2d'), 0.6), r * 0.92, b.cx, b.cy, hz * 0.82, hz, 28);
    return g;
  }

  if (t === 'puente_hilo' && ps.length >= 2) {
    const a = P(ps[0]!);
    const b = P(ps[1]!);
    const metal = METAL();
    const za = 0.9;
    barra(g, metal, new Vector3(a.x, a.y, -1.4), new Vector3(a.x, a.y, za), 0.6, 0.6, true);
    barra(g, metal, new Vector3(a.x, a.y, za), new Vector3(b.x, b.y, za), 0.6, 0.6, true);
    barra(g, metal, new Vector3(b.x, b.y, za), new Vector3(b.x, b.y, -1.4), 0.6, 0.6, true);
    return g;
  }

  if (t === 'cristal_h') {
    // an HC-49/U can lying flat, its leads bent into its near end
    const b = enModelo(caja(m.cuerpo) ?? m.caja);
    const hz = num(m.alto, 4.65);
    const z0 = 0.3;
    bloque(g, mat('#c4c7c9', 0.3, 0.85), b.w, b.d, hz, b.cx, b.cy, z0 + hz / 2);
    const metal = METAL();
    for (const p of ps.filter((q) => q.n === '1' || q.n === '2').map(P)) {
      const dentro = new Vector3(Math.min(Math.max(p.x, b.x0 + 0.8), b.x1 - 0.8), Math.min(Math.max(p.y, b.y0 + 0.8), b.y1 - 0.8), z0 + hz / 2);
      barra(g, metal, new Vector3(p.x, p.y, -1.4), new Vector3(p.x, p.y, z0 + hz / 2), 0.45, 0.45, true);
      barra(g, metal, new Vector3(p.x, p.y, z0 + hz / 2), dentro, 0.45, 0.45, true);
    }
    if (marcado) {
      const largoX = b.w >= b.d;
      letrero(g, marcado, (largoX ? b.w : b.d) * 0.7, Math.min(largoX ? b.d : b.w, 4) * 0.3, '#2a2a2c', new Vector3(b.cx, b.cy, z0 + hz), largoX ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0), largoX ? new Vector3(0, 1, 0) : new Vector3(-1, 0, 0));
    }
    return g;
  }
  return null;
}
