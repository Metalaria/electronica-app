// Routes of the «Proyectos KiCad» section:
//   #/proyectos                                  the four projects and their boards
//   #/proyectos/<placa>/<vista>[/<seleccion>]    one board
//   vista: 3d | placa | esquema | simulacion | comprobaciones
//   seleccion: a reference («R17»), «red:<net>» or «pad:<ref>.<pin>» (URI-encoded)

export type Vista = '3d' | 'placa' | 'esquema' | 'simulacion' | 'comprobaciones';

export interface Seleccion {
  tipo: 'huella' | 'red' | 'pad';
  id: string;
}

export const VISTAS: { id: Vista; titulo: string; corto: string }[] = [
  { id: '3d', titulo: 'Placa en 3D', corto: '3D' },
  { id: 'placa', titulo: 'Placa en 2D', corto: '2D' },
  { id: 'esquema', titulo: 'Esquema', corto: 'Esquema' },
  { id: 'simulacion', titulo: 'Simulación', corto: 'Simulación' },
  { id: 'comprobaciones', titulo: 'Comprobaciones', corto: 'Comprobaciones' },
];

export function leerAncla(ancla: string): { placa: string; vista: Vista; sel: Seleccion | null } {
  const [p = '', v = '', ...resto] = ancla.split('/');
  const vista = VISTAS.find((x) => x.id === v)?.id ?? '3d';
  const s = resto.join('/');
  let sel: Seleccion | null = null;
  if (s) {
    const d = decodeURIComponent(s);
    if (d.startsWith('red:')) sel = { tipo: 'red', id: d.slice(4) };
    else if (d.startsWith('pad:')) sel = { tipo: 'pad', id: d.slice(4) };
    else sel = { tipo: 'huella', id: d };
  }
  return { placa: p, vista, sel };
}

export function enlace(placa: string, vista: Vista, sel?: Seleccion | null): string {
  let s = '';
  if (sel) s = '/' + encodeURIComponent((sel.tipo === 'huella' ? '' : `${sel.tipo}:`) + sel.id);
  return `#/proyectos/${placa}/${vista}${s}`;
}

/** The reader's «Ver la placa» buttons: book label → board, view and selection (route after #/proyectos/). */
export const PLACA_DE_LABEL: Record<string, string> = {
  // the KiCad figures of the four projects
  'fig-new-49-placa': 'estacion_iot/3d',
  'fig-new-50-placa': 'fuente_laboratorio/3d',
  'fig-new-51-placa': 'hifi-potencia/3d',
  'fig-new-52-placa': 'sdr/3d',
  // schematics of the book that the boards implement
  'fig-49.8': 'estacion_iot/esquema',
  'fig-49.10': 'estacion_iot/esquema/red:SDA',
  'fig-50.22': 'fuente_laboratorio/esquema',
  'fig-51.4': 'hifi-preamplificador/esquema',
  'fig-51.6': 'hifi-potencia/3d/Q12',
  'fig-51.10': 'hifi-potencia/3d/Q9',
  // sections that present the boards
  'sec-49.12': 'estacion_iot/3d',
  'sec-50.15': 'fuente_laboratorio/3d',
  'sec-50.16': 'fuente_laboratorio/3d',
  'sec-51.9': 'hifi-potencia/3d',
  'sec-new-52-frontend': 'sdr/3d',
};
