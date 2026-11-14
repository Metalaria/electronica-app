// Schematic «desfase» (1.2, esquemas12d; secciones 27.1 and 27.4 «Osciladores RC», bloques 10 and 103): the phase-shift
// oscillator's network — three equal RC cells in cascade, «en la versión con los condensadores en serie» (C along the
// signal path, R to ground). Connected directly the phase reaches 180° at f = 1/(2π·√6·R·C) with an attenuation of
// 1/29 (each cell loads the previous one: about 56°, 56° and 68°); with followers between the cells («separadores», a
// switch: ideal unity buffers) each gives 60°, at f = 1/(2π·√3·R·C), and the network attenuates (1/2)³ = 1/8. AC only.
import { ng, num } from '../comun';
import { observablesCA } from '../comun-ca';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

export const conSeparadores = (c: ContextoNetlist): boolean => c.tiene('separadores') && c.cerrado('separadores');

const d: DefinicionEsquema = {
  nombre: 'desfase',
  titulo: 'Red de desplazamiento de fase de tres células RC',
  resumen: 'Tres células C en serie y R a masa, unidas directamente o con seguidores: 180° y 1/29 en 1/(2π√6·RC), o 60° por célula y 1/8.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud de la entrada (V de pico: la salida del amplificador)' },
    f: { descripcion: 'frecuencia de una lectura (Hz; las curvas barren la frecuencia)' },
    r: { obligatoria: true, descripcion: 'resistencia de cada célula, R (Ω)', color: 'naranja' },
    c: { obligatoria: true, descripcion: 'condensador de cada célula, C (F)', color: 'azul' },
    separadores: { interruptor: true, descripcion: 'seguidores ideales entre las células (cerrado; abierto o sin la pieza, unidas directamente)', color: 'verde' },
  },
  observables: {
    ...observablesCA('salida', 'v(n3)', 'V', 'la salida de la red, tras la tercera célula'),
    ...observablesCA('celula1', 'v(n1)', 'V', 'la salida de la primera célula'),
    ...observablesCA('celula2', 'v(n2)', 'V', 'la salida de la segunda célula'),
  },
  netlist(c) {
    const r = ng(c.p('r'));
    const cc = ng(c.p('c'));
    const sep = conSeparadores(c);
    return [
      `VF in 0 DC 0 AC ${num(c.p('fuente'))} 0`,
      `C1 in n1 ${cc}`,
      `R1 n1 0 ${r}`,
      ...(sep ? ['E1 b1 0 n1 0 1'] : []),
      `C2 ${sep ? 'b1' : 'n1'} n2 ${cc}`,
      `R2 n2 0 ${r}`,
      ...(sep ? ['E2 b2 0 n2 0 1'] : []),
      `C3 ${sep ? 'b2' : 'n2'} n3 ${cc}`,
      `R3 n3 0 ${r}`,
    ];
  },
  describir: (c) =>
    `Red de desplazamiento de fase: entrada de ${c.val('fuente')} y tres células iguales, cada una con ${c.sim('c')} de ${c.val('c')} en serie y ${c.sim('r')} de ${c.val('r')} a masa, ${conSeparadores(c) ? 'separadas por seguidores' : 'unidas directamente'}`,
};
export default d;
