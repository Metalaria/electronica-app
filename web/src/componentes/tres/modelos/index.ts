// Public API of the procedural 3D component library (book chapters 2–10 and 45).
//
//   crearModelo(tipo, parametros?, opciones?) → THREE.Group
//     Millimetres, origin at the centre of the footprint on the board surface, +Z up, orientation of the
//     KiCad standard footprint (y flipped): see tipos.ts. `tipo` is a key of PAQUETES (paquetes.ts), e.g.
//     'resistencia-axial', 'resistencia-smd', 'mlcc', 'electrolitico', 'led-5mm', 'to92', 'to220', 'sot23',
//     'dip', 'soic', 'qfp', 'qfn', 'cristal', 'tira-pines', 'borna'…; unknown keys give a neutral box.
//     group.userData is a DatosModelo: { tipo, parametros, huella {pads, ancho, fondo, alto, origenKicad},
//     cortes, explosionable, marcado, triangulos }. Each child part carries DatosParte (label, explosion).
//     Options: { recursos: new Recursos() shared by many models (dispose once with recursos.liberar()),
//     detalle: 'bajo' for boards, montaje: 'placa' (default) | 'suelto', grosorPlaca: 1.6 }.
//     Every package that prints a part number (diodes, TO-92, TO-220, SOT-23, D-PAK, DIP/SOIC/QFP/QFN, crystal,
//     optocoupler) accepts parametros.marcado: free text printed verbatim («|» separates lines; userData.marcado).
//   liberarModelo(group)    disposes what a model created when it was built without a shared Recursos.
//   tipoDeHuella(nombreKiCad, valor?) → { tipo, parametros, origenKicad } | null   (huellas.ts)
//   PAQUETES, paquete(tipo), FAMILIAS_3D                                           (paquetes.ts)

import { Group, MeshStandardMaterial, type Object3D } from 'three';
import { Recursos, caja, contarTriangulos, malla, parte, separarSolidos, type Constructor, type Ctx } from './comun';
import { conDefecto } from './paquetes';
import type { DatosModelo, OpcionesModelo, Parametros } from './tipos';
import { potenciometro, resistenciaAxial, resistenciaSmd, trimmer } from './resistencias';
import { CONSTRUCTORES_C } from './condensadores';
import { CONSTRUCTORES_L } from './inductivos';
import { CONSTRUCTORES_S } from './semiconductores';
import { CONSTRUCTORES_CI } from './integrados';
import { CONSTRUCTORES_V } from './varios';

export { Recursos } from './comun';
export { PAQUETES, FAMILIAS_3D, paquete, conDefecto, type Paquete, type Control, type Familia3d } from './paquetes';
export { tipoDeHuella } from './huellas';
export type { DatosModelo, DatosParte, Huella, Pad, Parametros, OpcionesModelo, Corte, Montaje } from './tipos';

const CONSTRUCTORES: Record<string, Constructor> = {
  'resistencia-axial': (c, p) => resistenciaAxial(c, p),
  'bobina-axial': (c, p) => resistenciaAxial(c, p, { bobina: true }),
  'resistencia-smd': resistenciaSmd,
  potenciometro,
  trimmer,
  ...CONSTRUCTORES_C,
  ...CONSTRUCTORES_L,
  ...CONSTRUCTORES_S,
  ...CONSTRUCTORES_CI,
  ...CONSTRUCTORES_V,
};

/** Model types with a real builder. */
export function tiposDisponibles(): string[] {
  return Object.keys(CONSTRUCTORES);
}

export function crearModelo(tipo: string, parametros: Parametros = {}, opciones: OpcionesModelo = {}): Group {
  const propios = !(opciones.recursos instanceof Recursos);
  const rec = propios ? new Recursos() : (opciones.recursos as Recursos);
  const bajo = opciones.detalle === 'bajo';
  const ctx: Ctx = {
    rec,
    bajo,
    seg: (n) => Math.max(6, Math.round(bajo ? n * 0.45 : n)),
    montaje: opciones.montaje ?? 'placa',
    placa: opciones.grosorPlaca ?? 1.6,
    marcasBajas: opciones.marcas ? opciones.marcas === 'baja' : bajo,
  };
  const p = conDefecto(tipo, parametros);
  const fn = CONSTRUCTORES[tipo];
  let g: Group;
  let datos: Partial<DatosModelo>;
  if (fn) ({ g, datos } = fn(ctx, p));
  else {
    g = new Group();
    g.add(parte('cuerpo', {}, malla(caja(ctx, 4, 4, 2, 0.2), new MeshStandardMaterial({ color: 0x888888 }))));
    g.children[0]!.position.z = 1;
    datos = { huella: { pads: [], ancho: 4, fondo: 4, alto: 2, origenKicad: [0, 0] } };
  }
  g.name = tipo;
  // No two solids share a face (depth fighting on mobile GPUs, broken cut faces).
  separarSolidos(g);
  const completo: DatosModelo = {
    tipo,
    parametros: p,
    huella: datos.huella ?? { pads: [], ancho: 0, fondo: 0, alto: 0, origenKicad: [0, 0] },
    ...datos,
    montaje: ctx.montaje,
    triangulos: 0,
  };
  completo.triangulos = contarTriangulos(g);
  Object.assign(g.userData, completo);
  if (propios) g.userData.recursos = rec;
  return g;
}

/** Disposes the GPU resources of a model built without a shared Recursos (no-op otherwise). */
export function liberarModelo(g: Object3D): void {
  const rec = g.userData.recursos as Recursos | undefined;
  rec?.liberar();
}
