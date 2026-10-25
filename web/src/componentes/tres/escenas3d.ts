// Which 3D model stands for each component animation, and how the scene's shared parameters (compartir3d)
// become model parameters: the resistor value slider changes the bands, the LED material its colour, the
// capacitance of the RC scene the size of the can… (no three.js here).

import type { Parametros } from './modelos/tipos';

export interface Opcion3D {
  tipo: string;
  parametros: Parametros;
  /** Name in the model selector when a scene offers several models. */
  etiqueta: string;
}

export interface Eleccion3D {
  /** The model that follows the scene (first) and the other models of the same component. */
  opciones: Opcion3D[];
  /** Index of the option the scene's state points to. */
  actual: number;
}

type P = Record<string, unknown>;
const n = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const s = (x: unknown, d: string) => (typeof x === 'string' ? x : d);

const LED_COLOR: Record<string, string> = { ir: 'infrarrojo', rojo: 'rojo', verde: 'verde', azul: 'azul', si: 'rojo' };
const ZENER: Record<string, string> = { '3.3': '3V3', '5.6': '5V6', '12': '12V' };

function una(tipo: string, parametros: Parametros, etiqueta: string, ...otras: Opcion3D[]): Eleccion3D {
  return { opciones: [{ tipo, parametros, etiqueta }, ...otras], actual: 0 };
}
function elegir(opciones: Opcion3D[], actual: number): Eleccion3D {
  return { opciones, actual: Math.max(0, Math.min(opciones.length - 1, actual)) };
}

const axial = (valor = 4700, extra: Parametros = {}): Opcion3D => ({ tipo: 'resistencia-axial', parametros: { valor, ...extra }, etiqueta: 'Resistencia axial' });
const do41 = (referencia = '1N4007'): Opcion3D => ({ tipo: 'diodo-do41', parametros: { referencia }, etiqueta: 'DO-41' });

export const ESCENAS_3D: Record<string, (p: P) => Eleccion3D> = {
  'resistencia-construccion': (p) => {
    const t = s(p.tipo, 'carbon');
    return elegir(
      [
        axial(4700, { tecnologia: 'carbon' }),
        { ...axial(4700, { tecnologia: 'metalica', bandas: 5, tolerancia: 1 }), etiqueta: 'Película metálica' },
        { ...axial(10, { tecnologia: 'bobinada', cuerpo: '0617' }), etiqueta: 'Bobinada' },
        { tipo: 'resistencia-smd', parametros: { valor: 8200, tamano: '0805' }, etiqueta: 'SMD 0805' },
      ].map((o, i) => (i === 0 ? { ...o, etiqueta: 'Película de carbón' } : o)),
      ['carbon', 'metal', 'bobinada', 'smd'].indexOf(t),
    );
  },
  'resistencia-ohm': () => una('resistencia-axial', { valor: 1000 }, 'Resistencia axial'),
  'resistencia-potencia': (p) => una('resistencia-axial', { valor: n(p.R, 100), cuerpo: '0617', tecnologia: 'metalica', bandas: 5, tolerancia: 1 }, 'Resistencia de 2 W', axial(n(p.R, 100))),
  'codigo-colores': (p) =>
    una('resistencia-axial', { valor: n(p.valor, 4700), bandas: n(p.bandas, 4) === 5 ? 5 : 4, tolerancia: n(p.tolerancia, 5), tecnologia: n(p.bandas, 4) === 5 ? 'metalica' : 'carbon' }, 'Resistencia axial', {
      tipo: 'resistencia-smd',
      parametros: { valor: n(p.valor, 4700), codigo: n(p.bandas, 4) === 5 ? 'cuatro' : 'tres' },
      etiqueta: 'SMD con su código',
    }),
  potenciometro: (p) =>
    elegir(
      [
        { tipo: 'potenciometro', parametros: { posicion: n(p.x, 0.5), ley: s(p.ley, 'B') }, etiqueta: 'Potenciómetro' },
        { tipo: 'trimmer', parametros: { posicion: n(p.x, 0.5) }, etiqueta: 'Trimmer' },
      ],
      s(p.modo, 'pot') === 'trimmer' ? 1 : 0,
    ),
  'sensores-resistivos': (p) =>
    elegir(
      [
        { tipo: 'termistor', parametros: { clase: 'ntc', diametro: 5 }, etiqueta: 'NTC' },
        { tipo: 'termistor', parametros: { clase: 'ptc', diametro: 7 }, etiqueta: 'PTC' },
        { tipo: 'ldr', parametros: {}, etiqueta: 'LDR' },
      ],
      ['ntc', 'ptc', 'ldr'].indexOf(s(p.tipo, 'ntc')),
    ),
  'condensador-placas': () => una('condensador-disco', { valor: 100e-9 }, 'Cerámico de disco', { tipo: 'condensador-pelicula', parametros: {}, etiqueta: 'Película' }),
  'condensador-ceramico': (p) =>
    elegir(
      [
        { tipo: 'mlcc', parametros: { dielectrico: s(p.clase, 'X7R'), tamano: '1206', capas: 18 }, etiqueta: 'MLCC' },
        { tipo: 'condensador-disco', parametros: { valor: 100e-9 }, etiqueta: 'Disco' },
      ],
      s(p.modo, 'mlcc') === 'disco' ? 1 : 0,
    ),
  'condensador-electrolitico': (p) =>
    elegir(
      [
        { tipo: 'electrolitico', parametros: { valor: 1000e-6, tension: 16 }, etiqueta: 'Aluminio radial' },
        { tipo: 'tantalo', parametros: { valor: 10e-6, tension: 16 }, etiqueta: 'Tántalo' },
        { tipo: 'electrolitico-smd', parametros: { valor: 100e-6, tension: 16 }, etiqueta: 'Aluminio SMD' },
      ],
      s(p.modo, 'aluminio') === 'tantalo' ? 1 : s(p.modo, '') === 'polimero' ? 2 : 0,
    ),
  'condensador-pelicula': (p) => una('condensador-pelicula', { film: s(p.film, 'pp'), valor: 1e-6, paso: 15, tension: n(p.V, 460) > 300 ? 630 : 250 }, 'Película'),
  supercondensador: (p) => una('supercondensador', { valor: 1, tension: n(p.Vmax, 2.7) }, 'Supercondensador'),
  'rc-carga': (p) =>
    una('electrolitico', { valor: Math.max(1e-6, n(p.C, 100e-6)), tension: n(p.VCC, 9) > 16 ? 25 : 16 }, 'Condensador', axial(n(p.R, 10e3))),
  'condensador-alterna': (p) => {
    const C = n(p.C, 1e-6);
    return C >= 4.7e-6
      ? una('electrolitico', { valor: C, tension: 25 }, 'Electrolítico')
      : una('condensador-pelicula', { valor: C, paso: C > 470e-9 ? 10 : 5 }, 'Película');
  },
  'esr-autorresonancia': (p) =>
    elegir(
      [
        { tipo: 'electrolitico', parametros: { valor: 100e-6, tension: 25 }, etiqueta: 'Electrolítico 100 µF' },
        { tipo: 'mlcc', parametros: { valor: 100e-9, tamano: '0805' }, etiqueta: 'MLCC 0805' },
        { tipo: 'mlcc', parametros: { valor: 100e-12, tamano: '0603', dielectrico: 'C0G' }, etiqueta: 'MLCC 0603' },
      ],
      ['elec', 'mlcc', 'rf'].indexOf(s(p.tipo, 'elec')),
    ),
  'bobina-lenz': (p) =>
    una('toroide', { espiras: Math.max(6, Math.min(60, Math.round(n(p.N, 100) / 5))) }, 'Toroide', { tipo: 'bobina-radial', parametros: {}, etiqueta: 'Tambor' }, { tipo: 'bobina-axial', parametros: {}, etiqueta: 'Axial' }),
  'nucleo-saturacion': () => una('toroide', { nucleo: 'ferrita' }, 'Toroide', { tipo: 'bobina-smd', parametros: {}, etiqueta: 'SMD apantallada' }, { tipo: 'transformador', parametros: {}, etiqueta: 'Núcleo EI' }),
  transformador: () => una('transformador', {}, 'Transformador EI', { tipo: 'toroide', parametros: { devanados: 2 }, etiqueta: 'Toroide de dos devanados' }),
  'rele-flyback': (p) => una('rele', { activado: p.activado === true || (typeof p.armadura === 'number' && p.armadura > 0.5) }, 'Relé', do41('1N4007')),
  'union-pn': () => una('diodo-do41', { referencia: '1N4007' }, 'DO-41'),
  'diodo-polarizacion': () => una('diodo-do41', { referencia: '1N4007' }, 'DO-41', { tipo: 'diodo-do35', parametros: { referencia: '1N4148' }, etiqueta: 'DO-35' }),
  zener: (p) => una('diodo-do35', { referencia: ZENER[String(n(p.vz, 5.6))] ?? '5V6' }, 'Zener DO-35', { tipo: 'diodo-sod123', parametros: { referencia: 'MMSZ5V6' }, etiqueta: 'SOD-123' }),
  led: (p) => {
    const c = LED_COLOR[s(p.mat, 'rojo')] ?? 'rojo';
    return una('led-5mm', { color: c, encendido: n(p.I, 0.02) > 1e-4 && s(p.mat, 'rojo') !== 'si' }, 'LED de 5 mm', { tipo: 'led-smd', parametros: { color: c === 'infrarrojo' ? 'rojo' : c }, etiqueta: 'LED SMD' });
  },
  fotodiodo: () => una('led-5mm', { color: 'fotodiodo' }, 'Fotodiodo de 5 mm', { tipo: 'ldr', parametros: {}, etiqueta: 'LDR' }),
  schottky: () => una('diodo-do41', { referencia: '1N5819' }, 'DO-41', { tipo: 'diodo-sod123', parametros: { referencia: 'B5819W' }, etiqueta: 'SOD-123' }),
  rectificador: (p) => elegir([{ tipo: 'puente', parametros: {}, etiqueta: 'Puente' }, do41('1N4007')], s(p.tipo, 'puente') === 'puente' ? 0 : 1),
  'bjt-portadores': (p) => {
    const pnp = s(p.tipo, 'npn') === 'pnp';
    return una('to92', { referencia: pnp ? 'BC557B' : 'BC547B' }, 'TO-92', { tipo: 'sot23', parametros: { referencia: pnp ? 'MMBT3906' : 'MMBT3904' }, etiqueta: 'SOT-23' }, { tipo: 'to220', parametros: { referencia: 'TIP31C' }, etiqueta: 'TO-220' });
  },
  'bjt-curvas': () => una('to92', { referencia: 'BC547B' }, 'TO-92', { tipo: 'to220', parametros: { referencia: 'TIP31C' }, etiqueta: 'TO-220' }),
  'mosfet-canal': (p) => {
    const pc = s(p.tipo, 'n') === 'p';
    return una('to220', { referencia: pc ? 'IRF9540N' : 'IRF540N' }, 'TO-220', { tipo: 'sot23', parametros: { referencia: '2N7002' }, etiqueta: 'SOT-23' }, { tipo: 'dpak', parametros: {}, etiqueta: 'D-PAK' });
  },
  'mosfet-curvas': () => una('to220', { referencia: 'IRF540N' }, 'TO-220', { tipo: 'dpak', parametros: {}, etiqueta: 'D-PAK' }),
  'mosfet-puerta': () => una('to220', { referencia: 'IRF540N' }, 'TO-220'),
  'cmos-inversor': () => una('dip', { pines: 14, referencia: 'CD4069UBE' }, 'DIP-14', { tipo: 'soic', parametros: { pines: 14, referencia: 'SN74HC14D' }, etiqueta: 'SOIC-14' }),
  jfet: () => una('to92', { referencia: 'J201' }, 'TO-92'),
  tiristor: (p) => una('to220', { referencia: s(p.tipo, 'scr') === 'triac' ? 'BT136' : 'TYN612' }, 'TO-220'),
  fusible: (p) =>
    elegir(
      [
        { tipo: 'fusible', parametros: { fundido: p.fundido === true }, etiqueta: 'Fusible 5 × 20' },
        { tipo: 'ptc', parametros: {}, etiqueta: 'PTC rearmable' },
      ],
      s(p.tipo, 'fusible') === 'ptc' ? 1 : 0,
    ),
  supresor: (p) =>
    elegir(
      [
        { tipo: 'termistor', parametros: { clase: 'varistor', diametro: 14 }, etiqueta: 'Varistor' },
        { tipo: 'diodo-do41', parametros: { referencia: 'P6KE15A' }, etiqueta: 'TVS' },
      ],
      s(p.prot, 'tvs') === 'tvs' ? 1 : 0,
    ),
  optoacoplador: (p) => una('optoacoplador', { pines: 4, encendido: n(p.IF, 0.005) > 1e-4 }, 'Optoacoplador'),
  cristal: () => una('cristal', { cuerpo: 'U' }, 'HC-49/U', { tipo: 'cristal', parametros: { cuerpo: 'S' }, etiqueta: 'HC-49/S' }),
  hall: () => una('to92', { referencia: 'A3144', cuerpo: 'TO-92S' }, 'Sensor Hall'),
  opamp: (p) => una('dip', { pines: 8, referencia: s(p.modo, '') === 'comparador' ? 'LM358N' : 'TL072CP' }, 'DIP-8', { tipo: 'soic', parametros: { pines: 8, referencia: 'LM358D' }, etiqueta: 'SOIC-8' }),
};

export function tiene3d(id: string): boolean {
  return id in ESCENAS_3D;
}

export function eleccion3d(id: string, p: P): Eleccion3D | null {
  const f = ESCENAS_3D[id];
  return f ? f(p) : null;
}
