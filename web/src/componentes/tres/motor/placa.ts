// A small piece of printed circuit board under a mounted model: FR-4 with green solder mask, tinned pads and
// drilled holes from the model's footprint (so the footprint data is checked by eye too). Built and owned by
// the viewer; never clipped by the cutaway.

import { CircleGeometry, Color, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Path, PlaneGeometry, RingGeometry, Shape, type BufferGeometry, type Material } from 'three';
import type { Huella } from '../modelos/tipos';

export interface Placa {
  grupo: Group;
  liberar(): void;
}

/** `elevacion`: height of the pads over the board's top face (a real gap, not polygonOffset). */
export function crearPlaca(h: Huella, ancho: number, fondo: number, grosor = 1.6, elevacion = 0.012): Placa {
  const geos: BufferGeometry[] = [];
  const mats: Material[] = [];
  const g = new Group();
  const w0 = Math.max(ancho, ...h.pads.map((p) => Math.abs(p.x) * 2 + p.w));
  const d0 = Math.max(fondo, ...h.pads.map((p) => Math.abs(p.y) * 2 + p.h));
  // Margin proportional to the part: a 0402 gets a sliver of board, a relay a few millimetres.
  const m = Math.max(0.8, Math.min(5, Math.max(w0, d0) * 0.35));
  const w = w0 + 2 * m;
  const d = d0 + 2 * m;
  const r = Math.min(1.5, w / 8, d / 8);
  const s = new Shape();
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  for (const p of h.pads) if (p.taladro) s.holes.push(new Path().absarc(p.x, p.y, p.taladro / 2, 0, Math.PI * 2, true));
  const geo = new ExtrudeGeometry(s, { depth: grosor, bevelEnabled: false, curveSegments: 16 });
  geo.translate(0, 0, -grosor);
  geos.push(geo);
  const mascara = new MeshStandardMaterial({ color: new Color('#1d6b3f'), roughness: 0.42, metalness: 0 });
  const canto = new MeshStandardMaterial({ color: new Color('#cdbf8e'), roughness: 0.8 });
  mats.push(mascara, canto);
  g.add(new Mesh(geo, [mascara, canto]));

  const estano = new MeshStandardMaterial({ color: new Color('#c9cdd1'), metalness: 1, roughness: 0.3 });
  const agujero = new MeshStandardMaterial({ color: new Color('#0d0e0f'), roughness: 1 });
  mats.push(estano, agujero);
  for (const p of h.pads) {
    let pg: BufferGeometry;
    if (p.taladro) pg = p.forma === 'rect' ? anilloCuadrado(p.w, p.h, p.taladro) : new RingGeometry(p.taladro / 2, Math.max(p.w, p.h) / 2, 32);
    else pg = new PlaneGeometry(p.w, p.h);
    geos.push(pg);
    const m = new Mesh(pg, estano);
    m.position.set(p.x, p.y, elevacion);
    g.add(m);
    if (p.taladro) {
      const hg = new CircleGeometry(p.taladro / 2, 24);
      geos.push(hg);
      const hm = new Mesh(hg, agujero);
      hm.position.set(p.x, p.y, -grosor + 0.02);
      g.add(hm);
    }
  }
  return {
    grupo: g,
    liberar() {
      for (const x of geos) x.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

function anilloCuadrado(w: number, h: number, taladro: number): BufferGeometry {
  const s = new Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  s.holes.push(new Path().absarc(0, 0, taladro / 2, 0, Math.PI * 2, true));
  const g = new ExtrudeGeometry(s, { depth: 0.001, bevelEnabled: false, curveSegments: 16 });
  return g;
}
