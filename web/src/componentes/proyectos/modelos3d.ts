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
      return { tipo: 'dip', p: { pines: num(m.pines, 8), referencia: h.v.split(' ')[0]!, zocalo: !!m.zocalo } };
    case 'soic':
      return { tipo: 'soic', p: { pines: num(m.pines, 8), referencia: h.v.split(' ')[0]! } };
    case 'sot23':
      return { tipo: 'sot23', p: { referencia: h.v } };
    case 'to92':
      return { tipo: 'to92', p: { referencia: h.v } };
    case 'to':
      return m.encapsulado === 'TO-220' ? { tipo: 'to220', p: { referencia: h.v } } : null;
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
 * board surface. Box from the fabrication outline, height and look from the package.
 */
export function cuerpoSimple(h: Huella): Group {
  const m: DescriptorModelo = h.m;
  const g = new Group();
  const [x0, y0, x1, y1] = m.caja;
  const w = Math.max(0.6, x1 - x0);
  const d = Math.max(0.6, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = -(y0 + y1) / 2;
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
    resistencia_shunt: ['#c9cdd1', 0.3, 0.85],
    ptc_radial: ['#d9a12a', 0.5, 0],
    bobina_axial: ['#b87333', 0.35, 0.8],
  };
  const [c, r, mt] = colores[t] ?? ['#5b6168', 0.6, 0];
  let hh = alto;
  if (t === 'to') {
    const vertical = m.vertical !== false;
    hh = m.encapsulado === 'TO-247' ? 20 : m.encapsulado === 'TO-3P' ? 20 : m.encapsulado === 'TO-126' ? 11 : 15.5;
    const grosor = m.encapsulado === 'TO-126' ? 2.6 : 4.8;
    if (vertical) {
      const yb = cy + d / 2 - grosor / 2;
      g.add(malla(new BoxGeometry(w, grosor, hh * 0.62), mat(c, r), cx, yb, 3 + hh * 0.31));
      g.add(malla(new BoxGeometry(w, 1.3, hh * 0.4), mat('#c9cdd1', 0.3, 0.9), cx, cy + d / 2 - 0.65, 3 + hh * 0.62 + hh * 0.2));
      const rt = rotulo(h.v, w * 0.8, hh * 0.25);
      rt.rotation.x = Math.PI / 2;
      rt.position.set(cx, yb - grosor / 2 - 0.02, 3 + hh * 0.36);
      g.add(rt);
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
    const yC = -(y0 + y1) / 2;
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
        for (let f = 0; f < filas; f++) g.add(malla(agujero, mat('#050505', 0.9), f * paso, -i * paso, hh + 0.01));
    }
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
  if (t === 'cristal_smd') hh = 0.8;
  if (t === 'soic' || t === 'msop') hh = 1.6;
  if (t === 'dip') hh = 4.5;
  g.add(malla(new BoxGeometry(w, d, hh), mat(c, r, mt), cx, cy, hh / 2 + (t === 'dip' ? 0.6 : 0)));
  return g;
}
