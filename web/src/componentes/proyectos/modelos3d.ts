// Component bodies for the 3D board: the procedural model library of the app (componentes/tres/modelos,
// `crearModelo(tipo, parametros, opciones)`, models in mm with the KiCad footprint's orientation, origin
// on the board surface and `userData.huella.origenKicad`), chosen from the pipeline's descriptor of each
// footprint (proyectos_kicad_pcb.model_for). Parts the library does not cover, or whose model does not fit
// the footprint, get a simple body built here from the footprint's fabrication outline.

import {
  BoxGeometry,
  CanvasTexture,
  PlaneGeometry,
  SRGBColorSpace,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { DescriptorModelo, Huella } from './datos';

type Params = Record<string, string | number | boolean>;
interface Biblioteca {
  crearModelo: (tipo: string, p?: Params, o?: Record<string, unknown>) => Group;
  tiposDisponibles?: () => string[];
  Recursos: new () => { liberar(): void };
}

const modulos = import.meta.glob('../tres/modelos/index.ts');

let biblioteca: Promise<Biblioteca | null> | null = null;

/** The model library, or null while the other module is not in the build. */
export function cargarBiblioteca(): Promise<Biblioteca | null> {
  if (!biblioteca) {
    const f = Object.values(modulos)[0];
    biblioteca = f ? (f() as Promise<Biblioteca>).catch(() => null) : Promise.resolve(null);
  }
  return biblioteca;
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Voltage rating from a value text («470u 10V», «100n/100V»). */
function tension(texto: string): number | undefined {
  const m = /(\d+(?:[.,]\d+)?)\s*V\b/i.exec(texto);
  return m ? parseFloat(m[1]!.replace(',', '.')) : undefined;
}

/** Library key and parameters for a footprint, or null (body built here). */
export function claveBiblioteca(h: Huella): { tipo: string; p: Params } | null {
  const m = h.m;
  const v = m.valor as number | null | undefined;
  const texto = String(m.texto ?? h.v);
  switch (m.tipo) {
    case 'resistencia_axial': {
      const din = { 0.25: '0207', 0.5: '0309', 1: '0414', 2: '0617' }[String(m.potencia ?? 0.25) as '0.25'] ?? '0207';
      return v ? { tipo: 'resistencia-axial', p: { valor: v, bandas: 5, tolerancia: 1, tecnologia: 'metalica', cuerpo: din, paso: num(m.paso, 10.16) } } : null;
    }
    case 'resistencia_smd':
      return { tipo: 'resistencia-smd', p: { valor: v ?? 0, tamano: String(m.encapsulado) } };
    case 'condensador_smd':
      return { tipo: 'mlcc', p: { valor: v ?? 100e-9, tamano: String(m.encapsulado), dielectrico: /C0G|NP0|1 ?%|5 ?%/i.test(texto + (h.mpn ?? '')) ? 'C0G' : 'X7R' } };
    case 'condensador_disco':
      return { tipo: 'condensador-disco', p: { valor: v ?? 100e-9, diametro: num(m.diametro, 5) } };
    case 'condensador_film':
      return { tipo: 'condensador-pelicula', p: { valor: v ?? 100e-9, paso: num(m.paso, 5), tension: tension(h.mpn ?? '') ?? 63 } };
    case 'electrolitico':
      return { tipo: 'electrolitico', p: { valor: v ?? 100e-6, tension: tension(texto) ?? 25, diametro: num(m.diametro, 6.3), alto: num(m.alto, 11), paso: num(m.paso, 2.5) } };
    case 'diodo_axial':
      return { tipo: m.encapsulado === 'DO-35' ? 'diodo-do35' : 'diodo-do41', p: { referencia: h.v, paso: num(m.paso, 10.16) } };
    case 'diodo_smd':
      return { tipo: 'diodo-sod123', p: { referencia: h.v } };
    case 'led':
      return { tipo: 'led-5mm', p: { color: String(m.color ?? 'rojo'), difuso: true, diametro: num(m.diametro, 3) } };
    case 'dip':
      // the library's DIP has its rows 7,62 mm apart: a 600 mil (15,24) or 400 mil (10,16) one is built here
      if (num(m.ancho_filas, 7.62) > 8) return null;
      return { tipo: 'dip', p: { pines: num(m.pines, 8), referencia: h.v.split(' ')[0]!, zocalo: !!m.zocalo } };
    case 'soic':
      return { tipo: 'soic', p: { pines: num(m.pines, 8), referencia: h.v.split(' ')[0]! } };
    case 'sot23':
      return { tipo: 'sot23', p: { referencia: h.v } };
    case 'to92':
      return { tipo: 'to92', p: { referencia: h.v } };
    case 'to':
      // the library's TO-220 has three leads; a 5-lead one (the Neo Geo's LM2576T-5) gets a body built here
      return m.encapsulado === 'TO-220' && num(m.pines, 3) === 3 ? { tipo: 'to220', p: { referencia: h.v } } : null;
    case 'tira_pines':
      return { tipo: 'tira-pines', p: { pines: num(m.columnas, 2), filas: num(m.filas, 1) } };
    case 'zocalo_hembra':
      // female sockets (the library's strip is male): built here
      return null;
    case 'borna':
      return { tipo: 'borna', p: { polos: num(m.pines, 2), color: 'verde', paso: num(m.paso, 5.08) } };
    case 'rele':
      return { tipo: 'rele', p: { bobina: tension(h.v) ?? 24 } };
    case 'trimmer_multivuelta':
      return { tipo: 'trimmer', p: { valor: (m.valor as number) ?? 500, multivuelta: true } };
    case 'potenciometro':
      // the library's pot stands shaft up; these are horizontal panel pots (built here)
      return null;
    case 'toroide':
      return { tipo: 'toroide', p: { diametro: num(m.diametro, 10), nucleo: m.trifilar ? 'ferrita' : 'hierro', espiras: 16 } };
    case 'bobina_axial':
      // air-core coil wound by hand (built here, see cuerpoSimple)
      return /aire/i.test(h.v + (h.mpn ?? '')) ? null : { tipo: 'bobina-axial', p: { valor: (m.valor as number) ?? 2.2e-6 } };
    case 'cristal_smd':
      return null;
    case 'portafusibles':
      return { tipo: 'fusible', p: { corriente: 3.15, curva: 'T' } };
    case 'ptc_radial':
      return { tipo: 'ptc', p: { corriente: 1 } };
    case 'puente_gbu':
      return null;
    default:
      return null;
  }
}

/** Library types whose marking comes from a fixed table: a part not in it would get someone else's marking. */
export const CON_MARCADO_FIJO = new Set(['diodo-do41', 'diodo-do35', 'diodo-sod123', 'to92', 'to220', 'sot23', 'rele']);

/** The marking printed by the model is the part's (ignoring case, spaces and suffixes). */
export function marcadoCoincide(marcado: unknown, valor: string): boolean {
  if (typeof marcado !== 'string' || !marcado) return true;
  const n = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const a = n(marcado);
  const b = n(valor.split(/\s/)[0] ?? valor);
  return !!a && !!b && (a.includes(b) || b.includes(a) || (a.length >= 5 && b.startsWith(a.slice(0, 5))));
}

// ------------------------------------------------------------------ simple bodies built here

const materiales = new Map<string, Material>();

function mat(color: string, rough = 0.6, metal = 0): Material {
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

/** A printed marking (the part's value from the BOM) on a face: a plane w × h mm facing +z. */
function rotulo(texto: string, w: number, h: number, color = '#e9e9e4'): Mesh {
  const k = `txt|${texto}|${color}|${Math.round((w / h) * 10)}`;
  let m = materiales.get(k);
  if (!m) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = Math.max(32, Math.round((512 * h) / w));
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
    m = new MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    materiales.set(k, m);
  }
  return new Mesh(new PlaneGeometry(w, h), m);
}

function malla(g: BufferGeometry, m: Material, x: number, y: number, z: number): Mesh {
  const o = new Mesh(g, m);
  o.position.set(x, y, z);
  return o;
}

/**
 * A body in footprint-local axes (KiCad x right, y flipped up), origin at the KiCad footprint origin, on the
 * board surface. Box from the fabrication outline, height and look from the package. `pads`: the footprint's
 * pads in the same local axes (mm, KiCad's y), for the packages whose leads are drawn (TO-220 / TO-247…).
 */
export function cuerpoSimple(h: Huella, pads: { n: string; x: number; y: number }[] = []): Group {
  const m: DescriptorModelo = h.m;
  const g = new Group();
  const [x0, y0, x1, y1] = m.caja;
  const w = Math.max(0.6, x1 - x0);
  const d = Math.max(0.6, y1 - y0);
  // Model y from the footprint's local y: flipped on top (KiCad's y points down, the model's up); on the bottom
  // the file's local y is already the library's mirrored, and the scene turns the part over (escena3d.colocar).
  const fy = (v: number): number => (h.lado === 'B' ? v : -v);
  const cx = (x0 + x1) / 2;
  const cy = fy((y0 + y1) / 2);
  const alto = num(m.alto, Math.max(1, Math.min(w, d) * 0.6));
  const t = m.tipo;
  if (t === 'taladro') return g;
  if (t === 'electrolitico') {
    const r = num(m.diametro, w) / 2;
    const hh = num(m.alto, 11);
    g.add(malla(new CylinderGeometry(r, r, hh, 28), mat('#1f3f8f', 0.45), cx, cy, hh / 2).rotateX(Math.PI / 2));
    g.add(malla(new CylinderGeometry(r * 0.96, r * 0.96, 0.2, 28), mat('#b8bcc2', 0.35, 0.8), cx, cy, hh + 0.1).rotateX(Math.PI / 2));
    return g;
  }
  if (t === 'toroide') {
    const r = num(m.diametro, 10) / 2;
    const tor = new Mesh(new TorusGeometry(r * 0.72, r * 0.28, 12, 32), mat(m.trifilar ? '#8a6a3a' : '#b0342c', 0.5, m.trifilar ? 0.4 : 0));
    if (m.vertical) {
      tor.rotation.x = Math.PI / 2;
      tor.position.set(cx, cy, r);
    } else tor.position.set(cx, cy, r * 0.3);
    g.add(tor);
    return g;
  }
  if (t === 'bobina_axial' && /aire/i.test(h.v + (h.mpn ?? ''))) {
    // air-core coil: close-wound turns of 1 mm enamelled wire on a 12 mm mandrel, 2–3 mm above the board
    const P = num(m.paso, 25.4);
    const vueltas = Number(/(\d+)\s*espiras/.exec(h.mpn ?? '')?.[1] ?? 18);
    const R = 6.5;
    const zc = R + 2.5;
    const largo = vueltas * 1.05;
    const x0 = P / 2 - largo / 2;
    const pts: Vector3[] = [new Vector3(0, 0, -1.6), new Vector3(0, 0, zc - R), new Vector3(x0, 0, zc - R)];
    for (let i = 0; i <= vueltas * 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push(new Vector3(x0 + (largo * i) / (vueltas * 16), R * Math.sin(a), zc - R * Math.cos(a)));
    }
    pts.push(new Vector3(P, 0, zc - R), new Vector3(P, 0, -1.6));
    const curva = new CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
    g.add(new Mesh(new TubeGeometry(curva, vueltas * 40, 0.5, 6, false), mat('#b8642a', 0.35, 0.85)));
    return g;
  }
  if (t === 'diodo_axial' || t === 'bobina_axial') {
    // axial body between the two leads (pads at x = 0 and x = pitch), cathode band next to pad 1
    const L = num(m.largo, 5.2);
    const D = num(m.diametro, 2.7);
    const P = num(m.paso, L + 5);
    const zc = D / 2 + 0.4;
    const cuerpo = new Mesh(new CylinderGeometry(D / 2, D / 2, L, 20), mat(m.vidrio ? '#d9822b' : t === 'bobina_axial' ? '#b87333' : '#1d1d1f', m.vidrio ? 0.15 : 0.45, t === 'bobina_axial' ? 0.7 : 0));
    cuerpo.rotation.z = Math.PI / 2;
    cuerpo.position.set(P / 2, 0, zc);
    g.add(cuerpo);
    if (t === 'diodo_axial') {
      const banda = new Mesh(new CylinderGeometry(D / 2 + 0.03, D / 2 + 0.03, L * 0.14, 20), mat(m.vidrio ? '#1d1d1f' : '#c9cdd1', 0.4, m.vidrio ? 0 : 0.6));
      banda.rotation.z = Math.PI / 2;
      banda.position.set(P / 2 - L * 0.36, 0, zc);
      g.add(banda);
    }
    const hilo = new CylinderGeometry(0.3, 0.3, 1, 8);
    for (const [x0, x1] of [[0, P / 2 - L / 2], [P / 2 + L / 2, P]] as [number, number][]) {
      const h1 = new Mesh(hilo, mat('#c9cdd1', 0.3, 0.9));
      h1.scale.y = Math.max(0.01, x1 - x0);
      h1.rotation.z = Math.PI / 2;
      h1.position.set((x0 + x1) / 2, 0, zc);
      g.add(h1);
      const v = new Mesh(hilo, mat('#c9cdd1', 0.3, 0.9));
      v.scale.y = zc + 1.6;
      v.position.set(x0 === 0 ? 0 : P, 0, (zc - 1.6) / 2);
      v.rotation.x = Math.PI / 2;
      g.add(v);
    }
    return g;
  }
  if (t === 'to92') {
    const cu = new Mesh(new CylinderGeometry(2.4, 2.4, 4.6, 24, 1, false, Math.PI, Math.PI), mat('#1e1e1e', 0.55));
    cu.rotation.x = Math.PI / 2;
    cu.position.set(cx, cy, 3.3);
    g.add(cu);
    const cara = new Mesh(new BoxGeometry(4.8, 0.05, 4.6), mat('#262626', 0.5));
    cara.position.set(cx, cy, 3.3);
    g.add(cara);
    return g;
  }
  if (t === 'sot23') {
    g.add(malla(new BoxGeometry(2.9, 1.3, 1.0), mat('#1b1b1d', 0.5), cx, cy, 0.6));
    return g;
  }
  if (t === 'punto_prueba') {
    const col = { rojo: '#c62828', negro: '#1c1c1c', blanco: '#eeeeee', amarillo: '#f2c200', naranja: '#ef7d00' }[String(m.color)] ?? '#c0c4c8';
    if (m.forma === 'keystone') {
      g.add(malla(new CylinderGeometry(0.9, 0.9, 3.2, 16), mat(col, 0.5), cx, cy, 1.6).rotateX(Math.PI / 2));
      g.add(malla(new TorusGeometry(1.1, 0.25, 8, 20), mat('#c9cdd1', 0.3, 0.9), cx, cy, 4.6).rotateY(Math.PI / 2));
    } else if (m.forma === 'lazo') {
      g.add(malla(new TorusGeometry(1.4, 0.22, 8, 20), mat('#c9cdd1', 0.3, 0.9), cx, cy, 1.4).rotateX(Math.PI / 2));
    }
    return g;
  }
  // Bodies of the parts reconstructed from a Gerber (consolas_gerber_piezas.py): boxes in the footprint's local
  // mm (`cuerpo`), leads drawn over the pads they sit on (`patas`), the marking read from the photo (`marcado`).
  const caja2 = (b: unknown): [number, number, number, number] | null =>
    Array.isArray(b) && b.length === 4 && b.every((v) => typeof v === 'number') ? (b as [number, number, number, number]) : null;
  const cuerpoDe = caja2(m.cuerpo) ?? m.caja;
  const marcado = typeof m.marcado === 'string' && m.marcado.trim() ? m.marcado : '';
  const encima = (texto: string, bx: number, by: number, z: number, px: number, py: number, color = '#d6d9dd'): void => {
    // the text runs along the longer side
    const ancho = Math.max(bx, by);
    const rt = rotulo(texto.replace(/\|/g, '\n'), ancho * 0.8, Math.min(bx, by) * 0.62, color);
    if (by > bx) rt.rotation.z = Math.PI / 2;
    // turned as the marking reads on the real part (photo), when the data says so
    rt.rotation.z += (num(m.giro_rotulo, 0) * Math.PI) / 180;
    rt.position.set(px, py, z + 0.01);
    g.add(rt);
  };
  if (t === 'ci' || t === 'electrolitico_smd' || t === 'diodo_smd' || t === 'interruptor' || t === 'rueda' || t === 'placa_hija' || t === 'conector') {
    const [a0, b0, a1, b1] = cuerpoDe;
    const bw = Math.max(0.4, a1 - a0);
    const bd = Math.max(0.4, b1 - b0);
    const bx = (a0 + a1) / 2;
    const by = fy((b0 + b1) / 2);
    const z0 = num(m.z0, 0);
    if (t === 'ci') {
      const hz = num(m.alto, 1.2);
      const zc = Math.min(0.15, hz * 0.12);
      g.add(malla(new BoxGeometry(bw, bd, hz - zc), mat(String(m.color ?? '#1b1b1d'), 0.5), bx, by, zc + (hz - zc) / 2));
      // leads: from the body's edge to the middle of each pad, flat on the board (gull wing, simplified)
      const patas = Array.isArray(m.patas) ? (m.patas as number[][]) : [];
      const metal = mat('#c9cdd1', 0.3, 0.9);
      for (const pt of patas) {
        const [px, py0, pw, ph] = pt as [number, number, number, number];
        const py = fy(py0);
        const fuera = (q: number, lo: number, hi: number): number => (q < lo ? lo - q : q > hi ? q - hi : 0);
        const ex = fuera(px, a0, a1);
        const ey = fuera(py0, b0, b1);
        if (ex >= ey) {
          const borde = px < a0 ? a0 : a1;
          const largo = Math.max(0.2, Math.abs(px - borde) + Math.min(pw, 0.6) * 0.3);
          const ancho = Math.min(ph, pw) * 0.55;
          g.add(malla(new BoxGeometry(largo, ancho, 0.16), metal, (px + borde) / 2, py, 0.18));
        } else {
          const borde = fy(py0 < b0 ? b0 : b1);
          const largo = Math.max(0.2, Math.abs(py - borde) + Math.min(ph, 0.6) * 0.3);
          const ancho = Math.min(ph, pw) * 0.55;
          g.add(malla(new BoxGeometry(ancho, largo, 0.16), metal, px, (py + borde) / 2, 0.18));
        }
      }
      // pin 1 dimple
      if (m.punto !== false && patas.length > 4) {
        const dot = malla(new CylinderGeometry(Math.min(0.45, bw * 0.06), Math.min(0.45, bw * 0.06), 0.04, 16), mat('#0c0c0d', 0.85), 0, 0, 0);
        const p1 = patas[0]!;
        const kx = Math.min(Math.max(p1[0]!, a0 + 0.9), a1 - 0.9);
        const ky = Math.min(Math.max(p1[1]!, b0 + 0.9), b1 - 0.9);
        dot.position.set(kx, fy(ky), hz + 0.01);
        dot.rotation.x = Math.PI / 2;
        g.add(dot);
      }
      if (marcado) encima(marcado, bw, bd, hz, bx, by);
      return g;
    }
    if (t === 'electrolitico_smd') {
      // aluminium V-chip can on its square plastic base
      const r = num(m.diametro, Math.min(bw, bd)) / 2;
      const hz = num(m.alto, 5.4);
      g.add(malla(new BoxGeometry(r * 2 + 0.3, r * 2 + 0.3, 0.5), mat('#1c1c1c', 0.6), bx, by, 0.25));
      g.add(malla(new CylinderGeometry(r, r, hz - 0.5, 28), mat('#b9bdc2', 0.35, 0.75), bx, by, 0.5 + (hz - 0.5) / 2).rotateX(Math.PI / 2));
      g.add(malla(new CylinderGeometry(r * 0.9, r * 0.9, 0.05, 28), mat('#9da2a8', 0.3, 0.85), bx, by, hz + 0.02).rotateX(Math.PI / 2));
      if (marcado) {
        const rt = rotulo(marcado.replace(/\|/g, '\n'), r * 1.3, r * 0.9, '#1c1c1c');
        rt.position.set(bx, by, hz + 0.06);
        g.add(rt);
      }
      return g;
    }
    if (t === 'diodo_smd') {
      // black moulded body, cathode band next to pad 1 (local −x)
      const hz = num(m.alto, 0.9);
      g.add(malla(new BoxGeometry(bw, bd, hz), mat('#1d1d1f', 0.5), bx, by, hz / 2));
      g.add(malla(new BoxGeometry(bw * 0.16, bd * 1.002, hz * 1.01), mat('#c9cdd1', 0.45, 0.4), bx - bw * 0.3, by, hz / 2));
      return g;
    }
    if (t === 'interruptor') {
      const hz = num(m.alto, 3.5);
      g.add(malla(new BoxGeometry(bw, bd, hz), mat(String(m.color ?? '#202124'), 0.55), bx, by, hz / 2));
      const pl = caja2(m.palanca);
      if (pl) g.add(malla(new BoxGeometry(pl[2] - pl[0], pl[3] - pl[1], hz * 0.6), mat('#e6dcc3', 0.6), (pl[0] + pl[2]) / 2, fy((pl[1] + pl[3]) / 2), hz * 0.5));
      return g;
    }
    if (t === 'rueda') {
      // potentiometer body under a knurled thumb wheel
      const hz = num(m.alto, 2.2);
      g.add(malla(new BoxGeometry(bw, bd, hz), mat('#2a2a2c', 0.55), bx, by, hz / 2));
      const c = Array.isArray(m.centro) ? (m.centro as number[]) : [bx, (b0 + b1) / 2];
      const r = num(m.diametro, 12) / 2;
      const gr = num(m.grosor, 2.4);
      g.add(malla(new CylinderGeometry(r, r, gr, 40), mat('#151516', 0.7), c[0]!, fy(c[1]!), hz + gr / 2).rotateX(Math.PI / 2));
      g.add(malla(new CylinderGeometry(r * 0.25, r * 0.25, gr + 0.1, 16), mat('#3a3a3c', 0.5), c[0]!, fy(c[1]!), hz + gr / 2).rotateX(Math.PI / 2));
      return g;
    }
    if (t === 'placa_hija') {
      // a small board on its pins, its parts on top as one low block
      const hz = num(m.alto, 1.0);
      g.add(malla(new BoxGeometry(bw, bd, hz), mat('#1f6b3a', 0.55), bx, by, z0 + hz / 2));
      g.add(malla(new BoxGeometry(bw * 0.7, bd * 0.6, 1.2), mat('#232325', 0.5), bx, by, z0 + hz + 0.6));
      if (marcado) encima(marcado, bw * 0.7, bd * 0.6, z0 + hz + 1.2, bx, by);
      return g;
    }
    // conector: a box in its colour, raised by z0 where it stands on posts
    const hz = num(m.alto, 3);
    g.add(malla(new BoxGeometry(bw, bd, hz), mat(String(m.color ?? '#1a1a1a'), num(m.rugosidad, 0.6), num(m.metal, 0)), bx, by, z0 + hz / 2));
    if (marcado) encima(marcado, bw, bd, z0 + hz, bx, by, String(m.color ?? '').startsWith('#e') ? '#2a2a2a' : '#d6d9dd');
    return g;
  }
  const colores: Record<string, [string, number, number]> = {
    to: ['#202124', 0.5, 0],
    to92: ['#1e1e1e', 0.55, 0],
    soic: ['#1b1b1d', 0.5, 0],
    msop: ['#1b1b1d', 0.5, 0],
    dip: ['#1b1b1d', 0.5, 0],
    cristal_smd: ['#c9cdd1', 0.3, 0.9],
    puente_gbu: ['#202124', 0.5, 0],
    rele: ['#16233e', 0.5, 0],
    zocalo_hembra: ['#1a1a1a', 0.6, 0],
    tira_pines: ['#1a1a1a', 0.6, 0],
    idc: ['#1a1a1a', 0.6, 0],
    jst_xh: ['#f1eee6', 0.55, 0],
    borna: ['#2c8a3e', 0.55, 0],
    portafusibles: ['#c9cdd1', 0.3, 0.9],
    blindaje: ['#c9cdd1', 0.35, 0.85],
    modulo: ['#0d4f8b', 0.6, 0],
    bnc: ['#c9cdd1', 0.3, 0.9],
    jack_cc: ['#1a1a1a', 0.6, 0],
    jack_audio: ['#1a1a1a', 0.6, 0],
    codificador: ['#2a2a2a', 0.5, 0],
    conmutador_deslizante: ['#1a1a1a', 0.6, 0],
    potenciometro: ['#3a3a3a', 0.5, 0],
    trimmer_multivuelta: ['#2a54a8', 0.5, 0],
    condensador_film: ['#b8322a', 0.45, 0],
    resistencia_shunt: ['#c9cdd1', 0.3, 0.85],
    ptc_radial: ['#d9a12a', 0.5, 0],
    bobina_axial: ['#b87333', 0.35, 0.8],
    ferrita_smd: ['#2b2b2d', 0.55, 0],
  };
  const [c, r, mt] = colores[t] ?? [typeof m.color === 'string' ? m.color : '#5b6168', 0.6, 0];
  let hh = alto;
  if (t === 'to') {
    const vertical = m.vertical !== false;
    hh = m.encapsulado === 'TO-247' ? 20 : m.encapsulado === 'TO-3P' ? 20 : m.encapsulado === 'TO-126' ? 11 : 15.5;
    const grosor = m.encapsulado === 'TO-126' ? 2.6 : 4.8;
    if (vertical) {
      // 0.9: the tab at the back of the outline (the side away from the row of leads), the moulded body in front
      // of it, standing 3 mm above the board on one lead per pad (any count: TO-220-3, the 5-lead TO-220 of a
      // switching regulator…). KiCad local y here; fy() turns it into the model's.
      const z0 = 3;
      const filaY = pads.length ? pads.reduce((a, p) => a + p.y, 0) / pads.length : (y0 + y1) / 2;
      const atras = Math.abs(y0 - filaY) >= Math.abs(y1 - filaY) ? y0 : y1;
      const sentido = atras === y0 ? 1 : -1;
      const tTab = Math.min(1.3, d * 0.3);
      const gCuerpo = Math.max(0.6, Math.min(grosor, d - tTab));
      const yTab = atras + (sentido * tTab) / 2;
      const yCuerpo = atras + sentido * (tTab + gCuerpo / 2);
      const altoCuerpo = hh * 0.58;
      g.add(malla(new BoxGeometry(w, gCuerpo, altoCuerpo), mat(c, r), cx, fy(yCuerpo), z0 + altoCuerpo / 2));
      g.add(malla(new BoxGeometry(w, tTab, hh), mat('#c9cdd1', 0.3, 0.9), cx, fy(yTab), z0 + hh / 2));
      const rt = rotulo(h.v, w * 0.8, Math.min(altoCuerpo * 0.4, hh * 0.25));
      // the marking faces the front (away from the tab)
      rt.rotation.x = fy(sentido) > 0 ? -Math.PI / 2 : Math.PI / 2;
      rt.position.set(cx, fy(yCuerpo + (sentido * gCuerpo) / 2) + fy(sentido) * 0.02, z0 + altoCuerpo * 0.55);
      g.add(rt);
      // leads: up from each pad, then bent to the body's mid-plane when the pad row is not under it
      const metal = mat('#c9cdd1', 0.3, 0.9);
      const ancho = Math.min(0.8, pads.length > 1 ? Math.abs(pads[1]!.x - pads[0]!.x) * 0.5 : 0.8);
      for (const p of pads) {
        const doblez = Math.abs(p.y - yCuerpo) > 0.25;
        const zDoblez = z0 * 0.45;
        g.add(malla(new BoxGeometry(ancho, 0.45, doblez ? zDoblez : z0), metal, p.x, fy(p.y), (doblez ? zDoblez : z0) / 2));
        if (doblez) {
          g.add(malla(new BoxGeometry(ancho, Math.abs(p.y - yCuerpo) + 0.45, 0.45), metal, p.x, fy((p.y + yCuerpo) / 2), zDoblez));
          g.add(malla(new BoxGeometry(ancho, 0.45, z0 - zDoblez), metal, p.x, fy(yCuerpo), (zDoblez + z0) / 2));
        }
      }
      return g;
    }
  }
  if (t === 'blindaje') {
    // a lidded can: thin walls and the lid
    const e = 0.3;
    g.add(malla(new BoxGeometry(w, d, e), mat(c, r, mt), cx, cy, hh));
    g.add(malla(new BoxGeometry(w, e, hh), mat(c, r, mt), cx, cy - d / 2, hh / 2));
    g.add(malla(new BoxGeometry(w, e, hh), mat(c, r, mt), cx, cy + d / 2, hh / 2));
    g.add(malla(new BoxGeometry(e, d, hh), mat(c, r, mt), cx - w / 2, cy, hh / 2));
    g.add(malla(new BoxGeometry(e, d, hh), mat(c, r, mt), cx + w / 2, cy, hh / 2));
    return g;
  }
  if (t === 'modulo') {
    g.add(malla(new BoxGeometry(w, d, 1.6), mat(c, r), cx, cy, 9));
    g.add(malla(new BoxGeometry(w * 0.3, d * 0.3, 1.2), mat('#1b1b1d', 0.5), cx, cy, 10.4));
    return g;
  }
  if (t === 'bnc' || t === 'jack_audio' || t === 'jack_cc') {
    g.add(malla(new BoxGeometry(w, d, Math.min(hh, 11)), mat(t === 'bnc' ? '#3a3a3a' : c, 0.5), cx, cy, Math.min(hh, 11) / 2));
    const rr = t === 'bnc' ? 4.8 : 3;
    const tubo = malla(new CylinderGeometry(rr, rr, 8, 20), mat(t === 'bnc' ? '#c9cdd1' : '#2a2a2a', 0.3, t === 'bnc' ? 0.9 : 0), cx - w / 2 - 3, cy, 6);
    tubo.rotation.z = Math.PI / 2;
    g.add(tubo);
    return g;
  }
  if (t === 'potenciometro' && /Frontal|Horizontal/.test(h.l)) {
    // Alps RK163 horizontal: metal body over the pins, bushing and shaft out over the board edge (−x local),
    // as the footprint's fabrication layer draws them
    const yC = fy((y0 + y1) / 2);
    const xb = x1 - 12.1;
    const zEje = 8;
    g.add(malla(new BoxGeometry(12.1, d, 16), mat('#b9bec4', 0.35, 0.85), xb + 6.05, cy, 8));
    g.add(malla(new BoxGeometry(0.6, d * 0.9, 15), mat('#2c2c2c', 0.6), xb - 0.3, cy, 7.5));
    const casq = new Mesh(new CylinderGeometry(3.5, 3.5, 5.1, 24), mat('#c8a43a', 0.3, 0.9));
    casq.rotation.z = Math.PI / 2;
    casq.position.set(xb - 2.55, yC, zEje);
    g.add(casq);
    const eje = new Mesh(new CylinderGeometry(3, 3, 10, 24), mat('#c9cdd1', 0.3, 0.9));
    eje.rotation.z = Math.PI / 2;
    eje.position.set(xb - 5.1 - 5, yC, zEje);
    g.add(eje);
    return g;
  }
  if (t === 'codificador' || t === 'potenciometro') {
    const caja = t === 'codificador' ? 6.5 : 9;
    g.add(malla(new BoxGeometry(w * 0.9, d * 0.9, caja), mat(c, r), cx, cy, caja / 2));
    const eje = malla(new CylinderGeometry(3, 3, t === 'codificador' ? 14 : 20, 20), mat('#b8bcc2', 0.3, 0.9), cx, cy, caja + 7);
    eje.rotation.x = Math.PI / 2;
    g.add(eje);
    return g;
  }
  if (t === 'borna') {
    hh = 9.5;
    g.add(malla(new BoxGeometry(w, d, hh), mat(c, r), cx, cy, hh / 2));
    return g;
  }
  if (t === 'zocalo_hembra' || t === 'tira_pines' || t === 'idc' || t === 'jst_xh') {
    hh = t === 'zocalo_hembra' ? 8.5 : t === 'idc' ? 9 : t === 'jst_xh' ? 7 : 2.5;
    g.add(malla(new BoxGeometry(w, d, hh), mat(c, r), cx, cy, hh / 2));
    if (t === 'zocalo_hembra') {
      // one square entry per contact, on the pads' grid (pads at multiples of the pitch from pad 1)
      const paso = num(m.paso, 2.54);
      const n = num(m.columnas, 1);
      const filas = num(m.filas, 1);
      const agujero = new BoxGeometry(1.0, 1.0, 0.05);
      for (let i = 0; i < n; i++)
        for (let f = 0; f < filas; f++) g.add(malla(agujero, mat('#050505', 0.9), f * paso, fy(i * paso), hh + 0.01));
    }
    return g;
  }
  if (t === 'trimmer_multivuelta') {
    // multi-turn trimmer (Bourns 3296): the box and its brass adjusting screw at one end, on top
    g.add(malla(new BoxGeometry(w, d, hh), mat(c, r), cx, cy, hh / 2));
    const rr = Math.min(1.1, d * 0.25);
    g.add(malla(new CylinderGeometry(rr, rr, 0.6, 16), mat('#c8a43a', 0.3, 0.9), x0 + rr + 0.5, cy, hh + 0.3).rotateX(Math.PI / 2));
    return g;
  }
  if (t === 'resistencia_shunt') {
    g.add(malla(new BoxGeometry(w * 0.85, d * 0.5, 6), mat(c, r, mt), cx, cy, 8));
    return g;
  }
  if (t === 'puente_gbu') {
    g.add(malla(new BoxGeometry(w, Math.min(d, 3.6), 18), mat(c, r), cx, cy, 9 + 1));
    return g;
  }
  if (t === 'rele') {
    hh = num(m.alto, 15.7);
    g.add(malla(new BoxGeometry(w, d, hh), mat('#1f2329', 0.55), cx, cy, hh / 2));
    const r = rotulo(`OMRON\n${h.v}`, w * 0.8, d * 0.5);
    r.position.set(cx, cy, hh + 0.02);
    g.add(r);
    return g;
  }
  if (t === 'dip' && pads.length) {
    // 0.9: a DIP the library does not draw (rows 10,16 / 15,24 / 22,86 mm apart, double footprints): the body
    // between the rows, a lead on each pad (the nearest of two pads with the same number) and its marking
    const porNumero = new Map<string, { x: number; y: number }>();
    const centro = { x: cx, y: (y0 + y1) / 2 };
    for (const p of pads) {
      const q = porNumero.get(p.n);
      if (!q || Math.hypot(p.x - centro.x, p.y - centro.y) < Math.hypot(q.x - centro.x, q.y - centro.y)) porNumero.set(p.n, p);
    }
    const ps = [...porNumero.values()];
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    const [px0, px1, py0, py1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // rows along the longer extent of the pads; the body spans the rows' length and most of the gap between them
    const filasEnY = py1 - py0 >= px1 - px0;
    const largo = (filasEnY ? py1 - py0 : px1 - px0) + 2.0;
    const hueco = Math.max(2, (filasEnY ? px1 - px0 : py1 - py0) - 1.6);
    const bx = filasEnY ? hueco : largo;
    const by = filasEnY ? largo : hueco;
    const mx = (px0 + px1) / 2;
    const my = (py0 + py1) / 2;
    const z0 = 0.6;
    const hz = 3.3;
    g.add(malla(new BoxGeometry(bx, by, hz), mat(c, r), mx, fy(my), z0 + hz / 2));
    const metal = mat('#c9cdd1', 0.3, 0.9);
    for (const p of ps) {
      // a pin down to the board and a shoulder to the body
      g.add(malla(new BoxGeometry(0.5, 0.3, z0 + 1.2), metal, p.x, fy(p.y), (z0 + 1.2) / 2));
      const borde = filasEnY ? mx + Math.sign(p.x - mx) * (bx / 2) : my + Math.sign(p.y - my) * (by / 2);
      const tramo = Math.max(0.2, Math.abs((filasEnY ? p.x : p.y) - borde));
      if (filasEnY) g.add(malla(new BoxGeometry(tramo, 0.5, 0.25), metal, (p.x + borde) / 2, fy(p.y), z0 + 1.1));
      else g.add(malla(new BoxGeometry(0.5, tramo, 0.25), metal, p.x, fy((p.y + borde) / 2), z0 + 1.1));
    }
    const texto = h.v.split(/\s*\/\s*|\s+\(/)[0]!.trim();
    if (texto && texto !== '~') {
      const rt = rotulo(texto, Math.max(bx, by) * 0.7, Math.min(bx, by) * 0.45, '#d6d9dd');
      if (filasEnY) rt.rotation.z = Math.PI / 2;
      rt.position.set(mx, fy(my), z0 + hz + 0.01);
      g.add(rt);
    }
    return g;
  }
  if (t === 'cristal_smd') hh = 0.8;
  if (t === 'soic' || t === 'msop') hh = 1.6;
  if (t === 'dip') hh = 4.5;
  g.add(malla(new BoxGeometry(w, d, hh), mat(c, r, mt), cx, cy, hh / 2 + (t === 'dip' ? 0.6 : 0)));
  return g;
}
