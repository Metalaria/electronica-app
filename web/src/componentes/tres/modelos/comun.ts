// Shared building blocks of the procedural models: a resource cache (materials, textures and geometries that
// many parts reuse, disposed together), PBR material presets, leads (round or square wire with rounded
// bends), gull-wing and J leads, rounded boxes, lathe bodies, text decals drawn on a canvas, and the
// bookkeeping of parts (labels, explosion offsets, cut colours).

import {
  Box3,
  BufferGeometry,
  CanvasTexture,
  Color,
  Curve,
  CurvePath,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  LineCurve3,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  QuadraticBezierCurve3,
  Shape,
  SRGBColorSpace,
  Texture,
  TubeGeometry,
  Vector2,
  Vector3,
  type MeshStandardMaterialParameters,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DatosModelo, DatosParte, Montaje, Parametros } from './tipos';

// ------------------------------------------------------------------ resources

/**
 * Cache of the GPU resources of one or many models. Pass the same instance to every crearModelo() call of a
 * board so that equal materials, markings and lead geometries are shared; call liberar() once at the end.
 */
export class Recursos {
  private materiales = new Map<string, Material>();
  private texturas = new Map<string, Texture>();
  private geometrias = new Map<string, BufferGeometry>();
  private sueltas = new Set<BufferGeometry>();

  material(clave: string, crear: () => Material): Material {
    let m = this.materiales.get(clave);
    if (!m) {
      m = crear();
      this.materiales.set(clave, m);
    }
    return m;
  }

  textura(clave: string, crear: () => Texture): Texture {
    let t = this.texturas.get(clave);
    if (!t) {
      t = crear();
      this.texturas.set(clave, t);
    }
    return t;
  }

  /** A geometry reused by key (equal leads, pins…). */
  geometria<T extends BufferGeometry>(clave: string, crear: () => T): T {
    let g = this.geometrias.get(clave);
    if (!g) {
      g = crear();
      this.geometrias.set(clave, g);
    }
    return g as T;
  }

  /** A one-off geometry owned by this cache. */
  propia<T extends BufferGeometry>(g: T): T {
    this.sueltas.add(g);
    return g;
  }

  liberar(): void {
    for (const m of this.materiales.values()) m.dispose();
    for (const t of this.texturas.values()) t.dispose();
    for (const g of this.geometrias.values()) g.dispose();
    for (const g of this.sueltas) g.dispose();
    this.materiales.clear();
    this.texturas.clear();
    this.geometrias.clear();
    this.sueltas.clear();
  }
}

/** A model builder: parts in a group plus the model metadata (footprint, cuts…). */
export type Constructor = (ctx: Ctx, p: Parametros) => { g: Group; datos: Partial<DatosModelo> };

/** Everything a model builder receives. */
export interface Ctx {
  rec: Recursos;
  /** Segment count factor: 1 high detail, ~0,5 low. */
  seg: (n: number) => number;
  bajo: boolean;
  montaje: Montaje;
  /** Board thickness (mm). */
  placa: number;
  /** Markings at low resolution (boards, thumbnails). */
  marcasBajas?: boolean;
}

// ------------------------------------------------------------------ materials

export interface Acabado {
  color: string;
  metal?: number;
  rugosidad?: number;
  transparente?: number;
  emisivo?: string;
  emision?: number;
  /** Colour of the cut face in the cutaway. */
  corte?: string;
}

/** Preset finishes (real materials, sRGB colours). */
export const ACABADOS = {
  estano: { color: '#c9cdd1', metal: 1, rugosidad: 0.32 },
  estanoMate: { color: '#b9bcbf', metal: 0.9, rugosidad: 0.5 },
  cobre: { color: '#c47a45', metal: 1, rugosidad: 0.3 },
  cobreEsmaltado: { color: '#b5652c', metal: 0.85, rugosidad: 0.28 },
  oro: { color: '#e7bd54', metal: 1, rugosidad: 0.22 },
  aluminio: { color: '#d4d7db', metal: 1, rugosidad: 0.38, corte: '#9aa0a6' },
  aluminioCepillado: { color: '#c2c6cb', metal: 1, rugosidad: 0.5 },
  niquel: { color: '#b3b1aa', metal: 1, rugosidad: 0.42 },
  acero: { color: '#9ea3a8', metal: 1, rugosidad: 0.45 },
  laton: { color: '#c9a64a', metal: 1, rugosidad: 0.35 },
  plata: { color: '#d8d8d6', metal: 1, rugosidad: 0.25 },
  epoxiNegro: { color: '#1e1f22', rugosidad: 0.62, corte: '#3a3b40' },
  epoxiGris: { color: '#2b2d31', rugosidad: 0.7, corte: '#45474c' },
  ceramica: { color: '#efe8da', rugosidad: 0.75, corte: '#e2d9c6' },
  ceramicaMlcc: { color: '#b39468', rugosidad: 0.85, corte: '#a3865c' },
  alumina: { color: '#f3f1ec', rugosidad: 0.8, corte: '#e6e2d8' },
  silicio: { color: '#59607a', metal: 0.4, rugosidad: 0.25 },
  plasticoBlanco: { color: '#ece9e2', rugosidad: 0.6, corte: '#dcd8cf' },
  plasticoNegro: { color: '#232427', rugosidad: 0.55, corte: '#3d3e42' },
  goma: { color: '#2a2a2a', rugosidad: 0.9, corte: '#3a3a3a' },
  vidrio: { color: '#e9f2ef', rugosidad: 0.05, transparente: 0.28 },
  fr4: { color: '#2f6b3c', rugosidad: 0.7, corte: '#c9b98a' },
} satisfies Record<string, Acabado>;

export function material(ctx: Ctx, a: Acabado, clave?: string): MeshStandardMaterial {
  const k = clave ?? `m:${a.color}:${a.metal ?? 0}:${a.rugosidad ?? 0.5}:${a.transparente ?? 1}:${a.emisivo ?? ''}:${a.emision ?? 0}`;
  return ctx.rec.material(k, () => {
    const p: MeshStandardMaterialParameters = {
      color: new Color(a.color),
      metalness: a.metal ?? 0,
      roughness: a.rugosidad ?? 0.5,
    };
    if (a.transparente != null && a.transparente < 1) {
      p.transparent = true;
      p.opacity = a.transparente;
      p.depthWrite = false;
      p.side = DoubleSide;
    }
    if (a.emisivo) {
      p.emissive = new Color(a.emisivo);
      p.emissiveIntensity = a.emision ?? 1;
    }
    const m = new MeshStandardMaterial(p);
    if (a.corte) m.userData.corte = a.corte;
    return m;
  }) as MeshStandardMaterial;
}

// ------------------------------------------------------------------ parts

export function malla(geo: BufferGeometry, mat: Material, datos?: DatosParte): Mesh {
  const m = new Mesh(geo, mat);
  if (datos) Object.assign(m.userData, datos);
  return m;
}

/** A named group (one part of a model: its label and explosion offset apply to everything inside). */
export function parte(nombre: string, datos: DatosParte = {}, ...hijos: Object3D[]): Group {
  const g = new Group();
  g.name = nombre;
  Object.assign(g.userData, { parte: nombre, ...datos });
  for (const h of hijos) g.add(h);
  return g;
}

export function colocar<T extends Object3D>(o: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): T {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}

/** Instanced copies of one geometry at the given matrices (pins of an IC, layers of an MLCC…). */
export function instancias(geo: BufferGeometry, mat: Material, matrices: Matrix4[], datos?: DatosParte): InstancedMesh | Mesh {
  if (matrices.length === 1) {
    const m = malla(geo, mat, datos);
    m.applyMatrix4(matrices[0]!);
    return m;
  }
  const im = new InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  if (datos) Object.assign(im.userData, datos);
  return im;
}

export function mt(x: number, y: number, z: number, rz = 0, sx = 1, sy = 1, sz = 1): Matrix4 {
  const m = new Matrix4().makeRotationZ(rz);
  m.scale(new Vector3(sx, sy, sz));
  m.setPosition(x, y, z);
  return m;
}

// ------------------------------------------------------------------ geometry helpers

export function caja(ctx: Ctx, w: number, d: number, h: number, r = 0): BufferGeometry {
  const rr = Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3, h / 2 - 1e-3);
  const clave = `caja:${w.toFixed(3)}:${d.toFixed(3)}:${h.toFixed(3)}:${rr.toFixed(3)}:${ctx.bajo}`;
  return ctx.rec.geometria(clave, () => (rr > 0.005 ? new RoundedBoxGeometry(w, d, h, ctx.bajo ? 1 : 2, rr) : new RoundedBoxGeometry(w, d, h, 1, 0.001)));
}

/** Cylinder along Z (base at z = 0). */
export function cilindro(ctx: Ctx, r: number, h: number, n = 32, rTop = r, abierto = false): BufferGeometry {
  const s = ctx.seg(n);
  const clave = `cil:${r.toFixed(3)}:${rTop.toFixed(3)}:${h.toFixed(3)}:${s}:${abierto}`;
  return ctx.rec.geometria(clave, () => {
    const g = new CylinderGeometry(rTop, r, h, s, 1, abierto);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, h / 2);
    return g;
  });
}

/**
 * Body of revolution around Z from a profile of [radius, z] points (z ascending); UV v is remapped to z so
 * that a band texture lands where it should along the axis.
 */
export function torno(ctx: Ctx, perfil: [number, number][], n = 40, clave?: string): BufferGeometry {
  const crear = () => {
    const g = new LatheGeometry(
      perfil.map(([r, z]) => new Vector2(Math.max(r, 1e-4), z)),
      ctx.seg(n),
    );
    // LatheGeometry revolves around Y: turn it to Z.
    g.rotateX(Math.PI / 2);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const z0 = perfil[0]![1];
    const z1 = perfil[perfil.length - 1]![1];
    for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getZ(i) - z0) / (z1 - z0 || 1));
    uv.needsUpdate = true;
    // LatheGeometry's own normals are already continuous across the seam (recomputing them would not be).
    return g;
  };
  return clave ? ctx.rec.geometria(`torno:${clave}:${ctx.bajo}`, crear) : ctx.rec.propia(crear());
}

/** Round or square wire along a polyline, with bends of radius `curva` at each inner vertex. */
export function hilo(ctx: Ctx, puntos: [number, number, number][], radio: number, opc: { curva?: number; cuadrado?: boolean; clave?: string } = {}): BufferGeometry {
  const crear = () => {
    const pts = puntos.map((p) => new Vector3(...p));
    const camino = new CurvePath<Vector3>();
    const rc = opc.curva ?? radio * 2.2;
    let actual = pts[0]!.clone();
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i]!;
      if (i < pts.length - 1) {
        const sig = pts[i + 1]!;
        const a = p.clone().sub(actual);
        const b = sig.clone().sub(p);
        const r = Math.min(rc, a.length() / 2, b.length() / 2);
        const entrada = p.clone().sub(a.normalize().multiplyScalar(r));
        const salida = p.clone().add(b.normalize().multiplyScalar(r));
        if (entrada.distanceTo(actual) > 1e-4) camino.add(new LineCurve3(actual, entrada));
        camino.add(new QuadraticBezierCurve3(entrada, p.clone(), salida));
        actual = salida;
      } else camino.add(new LineCurve3(actual, p.clone()));
    }
    const tramos = Math.max(2, camino.curves.length * (ctx.bajo ? 2 : 4));
    // A 4-sided tube reads as a square wire (LED and TO-92 leads); round wire gets 10 sides.
    return new TubeGeometry(camino, tramos, opc.cuadrado ? radio * 1.25 : radio, opc.cuadrado ? 4 : ctx.seg(10), false);
  };
  return opc.clave ? ctx.rec.geometria(`hilo:${opc.clave}:${ctx.bajo}`, crear) : ctx.rec.propia(crear());
}

/** Straight square lead along Z, from z0 to z1 (cheap box). */
export function patillaRecta(ctx: Ctx, w: number, t: number, z0: number, z1: number): BufferGeometry {
  const clave = `pr:${w}:${t}:${z0.toFixed(3)}:${z1.toFixed(3)}`;
  return ctx.rec.geometria(clave, () => {
    const g = new RoundedBoxGeometry(w, t, z1 - z0, 1, Math.min(w, t) * 0.18);
    g.translate(0, 0, (z0 + z1) / 2);
    return g;
  });
}

/**
 * Gull-wing lead seen from the side (SOIC, QFP, SOT-23): leaves the body at height `hSalida`, bends down
 * and runs flat on the board. Extruded along Y by the lead width; the lead points to +X from x = 0.
 */
export function alaGaviota(ctx: Ctx, largo: number, hSalida: number, grosor: number, ancho: number, pie: number): BufferGeometry {
  const clave = `gaviota:${largo}:${hSalida}:${grosor}:${ancho}:${pie}:${ctx.bajo}`;
  return ctx.rec.geometria(clave, () => {
    const t = grosor;
    const hs = hSalida;
    const x1 = Math.max(0.05, largo - pie - hs * 0.45);
    const x2 = largo - pie;
    const s = new Shape();
    s.moveTo(0, hs + t / 2);
    s.lineTo(x1 - t * 0.2, hs + t / 2);
    s.quadraticCurveTo(x1 + t * 0.6, hs + t / 2, x1 + t * 0.6, hs * 0.55);
    s.lineTo(x2 - t * 0.2, t * 1.1);
    s.quadraticCurveTo(x2 - t * 0.1, t, x2 + t * 0.7, t);
    s.lineTo(largo, t);
    s.lineTo(largo, 0);
    s.lineTo(x2 + t * 0.5, 0);
    s.quadraticCurveTo(x2 - t * 1.1, 0, x2 - t * 1.2, t * 0.9);
    s.lineTo(x1 - t * 0.4, hs * 0.55);
    s.quadraticCurveTo(x1 - t * 0.4, hs - t / 2, x1 - t * 1.2, hs - t / 2);
    s.lineTo(0, hs - t / 2);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: ancho, bevelEnabled: false, curveSegments: ctx.bajo ? 3 : 6 });
    // Shape in XZ: x along X, shape y is height (Z); extrusion along Y centred.
    g.rotateX(Math.PI / 2);
    g.translate(0, ancho / 2, 0);
    return g;
  });
}

/** Flat plane geometry facing +Z (decals). */
export function plano(ctx: Ctx, w: number, h: number): BufferGeometry {
  return ctx.rec.geometria(`plano:${w.toFixed(3)}:${h.toFixed(3)}`, () => new PlaneGeometry(w, h));
}

/** A parametric 3D curve from a function (helices, toroidal windings, bond wires). */
export class CurvaFn extends Curve<Vector3> {
  constructor(private f: (t: number, out: Vector3) => Vector3) {
    super();
  }
  override getPoint(t: number, out = new Vector3()): Vector3 {
    return this.f(t, out);
  }
}

/** Tube along a parametric curve (owned geometry). */
export function tubo(ctx: Ctx, f: (t: number, out: Vector3) => Vector3, tramos: number, radio: number, lados = 6, clave?: string): BufferGeometry {
  const crear = () => new TubeGeometry(new CurvaFn(f), Math.max(2, Math.round(ctx.bajo ? tramos / 2 : tramos)), radio, ctx.bajo ? Math.max(3, lados - 2) : lados, false);
  return clave ? ctx.rec.geometria(`tubo:${clave}:${ctx.bajo}`, crear) : ctx.rec.propia(crear());
}

// ------------------------------------------------------------------ text

export interface OpcionesTexto {
  color?: string;
  fondo?: string;
  /** Bold weight etc. */
  peso?: number;
  /** Line height relative to the box height divided by the number of lines. */
  interlinea?: number;
  /** Letter spacing in em. */
  espaciado?: number;
  /** Horizontal alignment. */
  alinear?: 'center' | 'left';
  /** Monospace-like condensed industrial look. */
  familia?: string;
}

const FAMILIA_MARCAS = "'Source Sans 3', 'Arial Narrow', Arial, sans-serif";

function lienzo(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

/**
 * Texture with one or more lines of text filling a w × h mm box (transparent background unless `fondo`).
 * Detailed models: about 1024 px on the long side (at most 640 px per mm), so that a 1 mm marking stays
 * crisp when it fills a tablet screen; low detail (boards with many parts): 64 px per mm, at most 512 px.
 */
export function texturaTexto(ctx: Ctx, lineas: string[], wmm: number, hmm: number, o: OpcionesTexto = {}): Texture {
  const baja = ctx.bajo || !!ctx.marcasBajas;
  const clave = `txt:${lineas.join('|')}:${wmm}:${hmm}:${o.color}:${o.fondo}:${o.peso}:${o.alinear}:${o.familia}:${o.espaciado}:${baja}`;
  return ctx.rec.textura(clave, () => {
    const ppm = baja ? Math.min(64, 512 / Math.max(wmm, hmm)) : Math.min(640, 1024 / Math.max(wmm, hmm));
    const W = Math.max(16, Math.round(wmm * ppm));
    const H = Math.max(16, Math.round(hmm * ppm));
    const c = lienzo(W, H);
    const g = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (g) {
      if (o.fondo) {
        g.fillStyle = o.fondo;
        g.fillRect(0, 0, W, H);
      }
      const n = Math.max(1, lineas.length);
      const alto = H / n;
      const familia = o.familia ?? FAMILIA_MARCAS;
      g.fillStyle = o.color ?? '#e8e8e8';
      g.textBaseline = 'middle';
      g.textAlign = o.alinear ?? 'center';
      lineas.forEach((l, i) => {
        let px = alto * (o.interlinea ?? 0.82);
        g.font = `${o.peso ?? 700} ${px}px ${familia}`;
        if ('letterSpacing' in g) (g as CanvasRenderingContext2D).letterSpacing = `${(o.espaciado ?? 0.02) * px}px`;
        const ancho = g.measureText(l).width;
        if (ancho > W * 0.96) {
          px *= (W * 0.96) / ancho;
          g.font = `${o.peso ?? 700} ${px}px ${familia}`;
        }
        g.fillText(l, o.alinear === 'left' ? W * 0.02 : W / 2, alto * (i + 0.5));
      });
    }
    const t = new CanvasTexture(c as HTMLCanvasElement);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = baja ? 4 : 8;
    return t;
  });
}

/** A text decal lying on a face: plane w × h mm at (x, y, z), facing +Z unless rotated. */
export function rotulo(ctx: Ctx, lineas: string[], w: number, h: number, o: OpcionesTexto & { rugosidad?: number } = {}): Mesh {
  const tex = texturaTexto(ctx, lineas, w, h, o);
  const mat = ctx.rec.material(`rot:${tex.uuid}`, () => {
    // (Not premultiplied: uploading a canvas with UNPACK_PREMULTIPLY_ALPHA takes a slow path, 20 s for a
    // board's markings under SwiftShader.)
    const m = new MeshStandardMaterial({
      map: tex,
      transparent: !o.fondo,
      roughness: o.rugosidad ?? 0.6,
      metalness: 0,
      depthWrite: !!o.fondo,
    });
    return m;
  });
  // Lifted off its face by a real distance (not polygonOffset, which differs between GPUs): 0,01 mm, or
  // 0,4 % of the marking's size on large parts.
  const alto = Math.min(0.06, Math.max(0.01, 0.004 * Math.max(w, h)));
  const geo = ctx.rec.geometria(`rotulo:${w.toFixed(3)}:${h.toFixed(3)}:${alto.toFixed(4)}`, () => new PlaneGeometry(w, h).translate(0, 0, alto));
  const m = new Mesh(geo, mat);
  m.renderOrder = 1;
  m.userData.decal = true;
  return m;
}

/**
 * Pulls every solid of a model in by a hair, so that no two solids share a face: touching faces and coplanar
 * faces of neighbouring parts fight in the depth buffer (worst on mobile GPUs and ANGLE-Metal, with less depth
 * precision) and break the cutaway's caps. Each face moves inward by e = 0,004–0,05 mm depending on the
 * model's size (at most 5 % of the solid's thickness); solids whose boxes end on the same plane on the same
 * side (two coplanar faces facing the same way) get different steps of e (1, 1,5, 2… × e), so they part
 * too. Decals are lifted instead (rotulo). The geometry is not touched (it may be shared): the mesh transform,
 * or each instance matrix, gets the scale about the geometry's box centre.
 */
export function separarSolidos(g: Group): void {
  g.updateMatrixWorld(true);
  const radio = new Box3().setFromObject(g).getSize(new Vector3()).length() / 2;
  const e0 = Math.min(0.05, Math.max(0.004, radio * 0.0025));
  const inversa = new Matrix4().copy(g.matrixWorld).invert();
  // Every solid (a mesh, or one instance) with its matrix in model space and its box there.
  type Solido = { m: Mesh; j: number; rel: Matrix4; caja: Box3; tam: Vector3; c: Vector3; color: number };
  const solidos: Solido[] = [];
  g.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || m.userData.decal) return;
    const geo = m.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const b = geo.boundingBox!;
    const base = new Matrix4().multiplyMatrices(inversa, m.matrixWorld);
    const n = (m as InstancedMesh).isInstancedMesh ? (m as InstancedMesh).count : 1;
    for (let j = 0; j < n; j++) {
      const rel = base.clone();
      if (n > 1 || (m as InstancedMesh).isInstancedMesh) {
        const k = new Matrix4();
        (m as InstancedMesh).getMatrixAt(j, k);
        rel.multiply(k);
      }
      solidos.push({ m, j, rel, caja: b.clone().applyMatrix4(rel), tam: b.getSize(new Vector3()), c: b.getCenter(new Vector3()), color: 0 });
    }
  });
  // Greedy colouring: a solid takes the first step not used by an earlier one ending on the same plane, on
  // the same side, where their boxes overlap across that plane.
  const tol = 1e-4;
  const solapan = (a: Box3, b: Box3, k: number) =>
    [0, 1, 2].every((q) => q === k || (Math.min(a.max.getComponent(q), b.max.getComponent(q)) - Math.max(a.min.getComponent(q), b.min.getComponent(q)) > tol));
  solidos.forEach((s, i) => {
    const usados = new Set<number>();
    for (let t = 0; t < i; t++) {
      const o = solidos[t]!;
      for (let k = 0; k < 3; k++) {
        const mismoMin = Math.abs(s.caja.min.getComponent(k) - o.caja.min.getComponent(k)) < tol;
        const mismoMax = Math.abs(s.caja.max.getComponent(k) - o.caja.max.getComponent(k)) < tol;
        if ((mismoMin || mismoMax) && solapan(s.caja, o.caja, k)) {
          usados.add(o.color);
          break;
        }
      }
    }
    while (usados.has(s.color)) s.color++;
  });
  const ejes = [new Vector3(), new Vector3(), new Vector3()] as const;
  const T = new Matrix4();
  const S = new Matrix4();
  for (const s of solidos) {
    s.rel.extractBasis(ejes[0], ejes[1], ejes[2]);
    const f = [0, 1, 2].map((k) => {
      const t = s.tam.getComponent(k) * ejes[k]!.length();
      return t < 1e-6 ? 1 : 1 - (2 * Math.min(e0, t * 0.05) * (1 + 0.5 * Math.min(s.color, 6))) / t;
    });
    const local = T.makeTranslation(s.c.x, s.c.y, s.c.z)
      .multiply(S.makeScale(f[0]!, f[1]!, f[2]!))
      .multiply(new Matrix4().makeTranslation(-s.c.x, -s.c.y, -s.c.z));
    if ((s.m as InstancedMesh).isInstancedMesh) {
      const im = s.m as InstancedMesh;
      const k = new Matrix4();
      im.getMatrixAt(s.j, k);
      im.setMatrixAt(s.j, k.multiply(local));
      im.instanceMatrix.needsUpdate = true;
    } else {
      s.m.matrix.multiply(local);
      s.m.matrix.decompose(s.m.position, s.m.quaternion, s.m.scale);
    }
  }
  g.traverse((o) => (o as InstancedMesh).isInstancedMesh && (o as InstancedMesh).computeBoundingSphere());
  g.updateMatrixWorld(true);
}

/** Canvas texture painted by a function (bands, sleeves, tracks), w × h px. */
export function texturaPintada(ctx: Ctx, clave: string, w: number, h: number, pintar: (g: CanvasRenderingContext2D, w: number, h: number) => void): Texture {
  return ctx.rec.textura(`pint:${clave}:${w}x${h}`, () => {
    const c = lienzo(w, h);
    const g = c.getContext('2d') as CanvasRenderingContext2D | null;
    if (g) pintar(g, w, h);
    const t = new CanvasTexture(c as HTMLCanvasElement);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

export function materialTextura(ctx: Ctx, tex: Texture, a: Omit<Acabado, 'color'> & { color?: string } = {}): MeshStandardMaterial {
  return ctx.rec.material(`mt:${tex.uuid}:${a.metal ?? 0}:${a.rugosidad ?? 0.5}`, () => {
    const m = new MeshStandardMaterial({ map: tex, color: new Color(a.color ?? '#ffffff'), metalness: a.metal ?? 0, roughness: a.rugosidad ?? 0.5 });
    if (a.corte) m.userData.corte = a.corte;
    return m;
  }) as MeshStandardMaterial;
}

// ------------------------------------------------------------------ leads of through-hole parts

/** Bottom end of a THT lead: cut 1 mm below a board, or the full length when loose. */
export function finPatilla(ctx: Ctx, largoSuelto: number): number {
  return ctx.montaje === 'placa' ? -(ctx.placa + 1) : -largoSuelto;
}

/** Counts triangles of everything under a root (instancing included). */
export function contarTriangulos(raiz: Object3D): number {
  let n = 0;
  raiz.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry;
    const tri = g.index ? g.index.count / 3 : (g.getAttribute('position')?.count ?? 0) / 3;
    n += tri * ((o as InstancedMesh).isInstancedMesh ? (o as InstancedMesh).count : 1);
  });
  return Math.round(n);
}

// ------------------------------------------------------------------ semiconductor dies and bond wires

/** Deterministic pseudo-random numbers (die patterns must not change between renders). */
export function azar(semilla: number): () => number {
  let x = semilla >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

/** Top face of a die: silicon with metal tracks, transistor blocks and bond pads along the edges. */
export function texturaDado(ctx: Ctx, semilla: number, pads: number, tono = '#4b5674') {
  return texturaPintada(ctx, `dado:${semilla}:${pads}:${tono}`, 256, 256, (g, w, h) => {
    const r = azar(semilla);
    g.fillStyle = tono;
    g.fillRect(0, 0, w, h);
    // Functional blocks.
    for (let i = 0; i < 26; i++) {
      const x = 22 + r() * (w - 70);
      const y = 22 + r() * (h - 70);
      g.fillStyle = ['#5d6a8c', '#3d4762', '#6b5f86', '#476e6a'][Math.floor(r() * 4)]!;
      g.fillRect(x, y, 12 + r() * 40, 8 + r() * 36);
    }
    // Metal tracks.
    g.strokeStyle = 'rgba(214,220,230,0.75)';
    g.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      const x = 20 + r() * (w - 40);
      const y = 20 + r() * (h - 40);
      g.moveTo(x, y);
      if (r() > 0.5) g.lineTo(x + (r() - 0.5) * 120, y);
      else g.lineTo(x, y + (r() - 0.5) * 120);
      g.stroke();
    }
    // Bond pads around the edge.
    g.fillStyle = '#d9dde3';
    const porLado = Math.max(1, Math.ceil(pads / 4));
    for (let i = 0; i < porLado; i++) {
      const f = (i + 0.5) / porLado;
      const s = 14;
      g.fillRect(4, f * h - s / 2, s, s);
      g.fillRect(w - 4 - s, f * h - s / 2, s, s);
      g.fillRect(f * w - s / 2, 4, s, s);
      g.fillRect(f * w - s / 2, h - 4 - s, s, s);
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
}

/**
 * Bond wire from a to b (mm): the ball on the die, a loop rising `alto` above the higher end and a stitch
 * at the lead. Returned as points along a smooth curve for tubo().
 */
export function arcoHilo(a: [number, number, number], b: [number, number, number], alto: number): (t: number, out: Vector3) => Vector3 {
  return (t, out) => {
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    // Rises steeply from the ball, then descends towards the stitch.
    const base = a[2] + (b[2] - a[2]) * t;
    const lazo = alto * Math.sin(Math.PI * Math.min(1, t * 1.25)) * (1 - 0.35 * t);
    return out.set(x, y, base + Math.max(0, lazo));
  };
}

/** Many bond wires as one geometry (one draw call). */
export function hilos(ctx: Ctx, lista: { a: [number, number, number]; b: [number, number, number]; alto: number }[], radio: number): BufferGeometry {
  const partes = lista.map(({ a, b, alto }) => new TubeGeometry(new CurvaFn(arcoHilo(a, b, alto)), ctx.bajo ? 8 : 18, radio, ctx.bajo ? 3 : 5, false));
  const g = partes.length ? (mergeGeometries(partes) ?? new BufferGeometry()) : new BufferGeometry();
  for (const p of partes) p.dispose();
  return ctx.rec.propia(g);
}

/** Merges geometries already transformed into one owned geometry. */
export function unir(ctx: Ctx, partes: BufferGeometry[]): BufferGeometry {
  const g = partes.length ? (mergeGeometries(partes.map((p) => (p.index ? p.toNonIndexed() : p))) ?? new BufferGeometry()) : new BufferGeometry();
  for (const p of partes) p.dispose();
  return ctx.rec.propia(g);
}

/**
 * Lines of a free «marcado» parameter (printed verbatim: «|» or a line break separate lines; a long single
 * line is split in two when the face is narrow), or the builder's default lines.
 */
export function lineasMarcado(p: Record<string, unknown>, porDefecto: string[], largoMax = 12): string[] {
  const m = typeof p.marcado === 'string' ? p.marcado.trim() : '';
  if (!m) return porDefecto;
  const ls = m.split(/\n|\|/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
  if (ls.length === 1 && ls[0]!.length > largoMax) {
    const t = ls[0]!;
    const i = Math.ceil(t.length / 2);
    return [t.slice(0, i), t.slice(i)];
  }
  return ls;
}
