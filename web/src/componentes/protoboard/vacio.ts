// The empty board every own circuit starts from (and the guided circuits build on): a 400-point board with a
// bench supply wired to the top rails and the rails bridged to the bottom ones. Plain TypeScript (the Node
// checks of the guided circuits use it too).

import { analisisPorDefecto, type Componente } from '../editor/tipos.ts';
import { CABLE } from './colores.ts';
import { bornesExterno } from './encapsulados.ts';
import { columnasRiel } from './placa.ts';
import type { DocumentoProtoboard } from './tipos.ts';

export function montajeVacio(titulo = 'Montaje nuevo', voltios = '5'): DocumentoProtoboard {
  const comp: Componente = { id: 'v1', tipo: 'V', nombre: 'V1', x: 0, y: 0, o: 3, campos: { forma: 'dc', dc: voltios } };
  const pos = bornesExterno([3, -3]);
  const rc = columnasRiel(30);
  const fin = rc[rc.length - 1]!;
  return {
    version: 1,
    titulo,
    placas: 1,
    columnas: 30,
    piezas: [{ id: 'v1', comp, enc: 'alimentacion', pos, patas: ['end', 'start'] }],
    cables: [
      { id: 'w1', a: pos[0]!, b: [2, 0], color: CABLE.rojo },
      { id: 'w2', a: pos[1]!, b: [5, 1], color: CABLE.negro },
      { id: 'w3', a: [fin, 0], b: [fin, 17], color: CABLE.rojo },
      { id: 'w4', a: [fin - 1, 1], b: [fin - 1, 16], color: CABLE.negro },
    ],
    analisis: analisisPorDefecto(),
    directivas: '',
    origen: { tipo: 'propio' },
  };
}
