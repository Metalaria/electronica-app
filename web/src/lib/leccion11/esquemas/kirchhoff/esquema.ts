// Schematic «kirchhoff»: two sources, each with its resistor, feeding a common load (sección 1.5's superposition
// example, 12 V and 6 V with 1 kΩ each and 2 kΩ of load: 7,20 V; sección 1.3 for the node and the loops). A source
// can be switched off as superposition does it: replaced by a short circuit (its switch pieces «activa1/2»).
import { ng } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'kirchhoff',
  titulo: 'Dos fuentes y un nodo',
  resumen: 'Dos fuentes con su resistencia sobre una carga común; tensión del nodo y las tres corrientes (Kirchhoff, superposición).',
  piezas: {
    fuente1: { obligatoria: true, descripcion: 'tensión de la fuente de la izquierda (V)' },
    fuente2: { obligatoria: true, descripcion: 'tensión de la fuente de la derecha (V)' },
    r1: { obligatoria: true, descripcion: 'resistencia de la fuente de la izquierda (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia de la fuente de la derecha (Ω)', color: 'naranja' },
    r3: { obligatoria: true, descripcion: 'carga común, del nodo a masa (Ω)', color: 'verde' },
    activa1: { interruptor: true, descripcion: 'fuente de la izquierda encendida (apagada = cortocircuito)' },
    activa2: { interruptor: true, descripcion: 'fuente de la derecha encendida (apagada = cortocircuito)' },
  },
  // 1.2.1 (motor121): the instrument's points and branches, the parts a tap can choose (GUIA §13.1, §13.4)
  medible: () => ({
    puntos: { f1: 'Arriba de la fuente izquierda', n: 'Nodo de arriba', f2: 'Arriba de la fuente derecha', '0': 'Masa, abajo' },
    ramas: { vm1: 'Rama de R₁', vm2: 'Rama de R₂', vm3: 'Rama de la carga' },
    zonas: { fuente1: 'Fuente de la izquierda', fuente2: 'Fuente de la derecha', r1: 'Resistencia de la izquierda', r2: 'Resistencia de la derecha', r3: 'Resistencia del centro' },
  }),
  observables: {
    nodo: { medida: 'v(n)', analisis: 'op', unidad: 'V', descripcion: 'tensión del nodo común (la de la carga)' },
    i1: { medida: 'i(vm1)', analisis: 'op', unidad: 'A', descripcion: 'corriente que la rama izquierda lleva al nodo' },
    i2: { medida: 'i(vm2)', analisis: 'op', unidad: 'A', descripcion: 'corriente que la rama derecha lleva al nodo' },
    i3: { medida: 'i(vm3)', analisis: 'op', unidad: 'A', descripcion: 'corriente que baja por la carga' },
  },
  netlist: (c) => [
    `V1 f1 0 DC ${c.cerrado('activa1') ? c.p('fuente1') : 0}`,
    `R1 f1 x1 ${ng(c.p('r1'))}`,
    'VM1 x1 n 0',
    `V2 f2 0 DC ${c.cerrado('activa2') ? c.p('fuente2') : 0}`,
    `R2 f2 x2 ${ng(c.p('r2'))}`,
    'VM2 x2 n 0',
    'VM3 n x3 0',
    `R3 x3 0 ${ng(c.p('r3'))}`,
  ],
  describir: (c) => {
    const f = (k: string, a: string) => (c.cerrado(a) ? `fuente de ${c.val(k)}` : 'fuente apagada (cortocircuito)');
    return `Dos fuentes sobre una carga común: a la izquierda, ${f('fuente1', 'activa1')} con ${c.sim('r1')} de ${c.val('r1')}; a la derecha, ${f('fuente2', 'activa2')} con ${c.sim('r2')} de ${c.val('r2')}; carga ${c.sim('r3')} de ${c.val('r3')}`;
  },
};
export default d;
