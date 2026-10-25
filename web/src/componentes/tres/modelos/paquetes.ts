// Registry of the procedural 3D models: package keys, default parameters and the parameter controls the
// viewer offers. No three.js here (the catalogue, the gallery and the reader import it).

import type { Parametros } from './tipos';

export type Familia3d =
  | 'resistencias'
  | 'condensadores'
  | 'inductores'
  | 'diodos'
  | 'transistores'
  | 'integrados'
  | 'varios';

export const FAMILIAS_3D: { id: Familia3d; nombre: string; color: string }[] = [
  { id: 'resistencias', nombre: 'Resistencias y potenciómetros', color: '#A6552B' },
  { id: 'condensadores', nombre: 'Condensadores', color: '#2E6EA6' },
  { id: 'inductores', nombre: 'Bobinas, transformadores y relés', color: '#6B3FA0' },
  { id: 'diodos', nombre: 'Diodos y LED', color: '#C62828' },
  { id: 'transistores', nombre: 'Transistores', color: '#1F6F5C' },
  { id: 'integrados', nombre: 'Circuitos integrados', color: '#1A3A5C' },
  { id: 'varios', nombre: 'Cristales, protección y conectores', color: '#8A1F3D' },
];

export interface Opcion {
  v: string | number;
  t: string;
}

export interface Control {
  id: string;
  etiqueta: string;
  tipo: 'opciones' | 'valor' | 'numero' | 'interruptor' | 'texto';
  opciones?: Opcion[];
  /** 'valor': SI unit of the value (Ω, F, H…); 'numero': display unit. */
  unidad?: string;
  min?: number;
  max?: number;
  paso?: number;
  /** Logarithmic slider (values). */
  log?: boolean;
}

export interface Paquete {
  tipo: string;
  /** Catalogue name. */
  nombre: string;
  familia: Familia3d;
  /** Package name(s) as printed in datasheets. */
  encapsulado: string;
  defecto: Parametros;
  controles: Control[];
  /** One sentence for the catalogue card. */
  resumen: string;
  /** Some KiCad footprints this model stands for (documentation and tipoDeHuella tests). */
  kicad: string[];
  /** It has a cutaway and/or an explosion (detailed inside). */
  interior?: boolean;
}

const op = (...xs: (string | number | [string | number, string])[]): Opcion[] =>
  xs.map((x) => (Array.isArray(x) ? { v: x[0], t: x[1] } : { v: x, t: String(x) }));

const COLOR_LED = op(['rojo', 'Rojo'], ['verde', 'Verde'], ['azul', 'Azul'], ['amarillo', 'Amarillo'], ['blanco', 'Blanco'], ['infrarrojo', 'Infrarrojo']);

export const PAQUETES: Paquete[] = [
  // ------------------------------------------------------------------ resistors
  {
    tipo: 'resistencia-axial',
    nombre: 'Resistencia axial',
    familia: 'resistencias',
    encapsulado: 'DIN 0204 · 0207 · 0309 · 0414 · 0617',
    resumen: 'Película de carbón o metálica sobre un cilindro cerámico, con su corte helicoidal y las bandas del valor.',
    defecto: { valor: 4700, bandas: 4, tolerancia: 5, tecnologia: 'carbon', cuerpo: '0207' },
    controles: [
      { id: 'valor', etiqueta: 'Valor', tipo: 'valor', unidad: 'Ω', min: 1, max: 10e6, log: true },
      { id: 'bandas', etiqueta: 'Bandas', tipo: 'opciones', opciones: op([4, '4 (E24)'], [5, '5 (E96)']) },
      { id: 'tecnologia', etiqueta: 'Tecnología', tipo: 'opciones', opciones: op(['carbon', 'Película de carbón'], ['metalica', 'Película metálica'], ['bobinada', 'Bobinada']) },
      { id: 'cuerpo', etiqueta: 'Tamaño', tipo: 'opciones', opciones: op(['0204', '0204 · 1/8 W'], ['0207', '0207 · 1/4 W'], ['0309', '0309 · 1/2 W'], ['0414', '0414 · 1 W'], ['0617', '0617 · 2 W']) },
    ],
    kicad: ['Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal', 'Resistor_THT:R_Axial_DIN0204_L3.6mm_D1.6mm_P7.62mm_Horizontal'],
    interior: true,
  },
  {
    tipo: 'resistencia-smd',
    nombre: 'Resistencia SMD',
    familia: 'resistencias',
    encapsulado: '0402 · 0603 · 0805 · 1206 · 2512',
    resumen: 'Capa gruesa sobre alúmina, con el código de tres cifras o EIA-96 calculado del valor.',
    defecto: { valor: 4700, tamano: '0805', codigo: 'tres' },
    controles: [
      { id: 'valor', etiqueta: 'Valor', tipo: 'valor', unidad: 'Ω', min: 0.1, max: 10e6, log: true },
      { id: 'tamano', etiqueta: 'Tamaño', tipo: 'opciones', opciones: op('0402', '0603', '0805', '1206', '2512') },
      { id: 'codigo', etiqueta: 'Marcado', tipo: 'opciones', opciones: op(['tres', 'Tres cifras'], ['cuatro', 'Cuatro cifras'], ['eia96', 'EIA-96']) },
    ],
    kicad: ['Resistor_SMD:R_0805_2012Metric', 'Resistor_SMD:R_0603_1608Metric'],
    interior: true,
  },
  {
    tipo: 'potenciometro',
    nombre: 'Potenciómetro rotativo',
    familia: 'resistencias',
    encapsulado: '16 mm, eje de 6 mm',
    resumen: 'Pista de carbón en herradura y el cursor que la recorre al girar el eje.',
    defecto: { valor: 10000, posicion: 0.5, ley: 'B' },
    controles: [
      { id: 'posicion', etiqueta: 'Posición del eje', tipo: 'numero', min: 0, max: 1, paso: 0.01, unidad: '%' },
      { id: 'valor', etiqueta: 'Valor', tipo: 'valor', unidad: 'Ω', min: 100, max: 1e6, log: true },
      { id: 'ley', etiqueta: 'Ley', tipo: 'opciones', opciones: op(['B', 'B (lineal)'], ['A', 'A (logarítmica)']) },
    ],
    kicad: ['Potentiometer_THT:Potentiometer_Alps_RK163_Single_Vertical'],
    interior: true,
  },
  {
    tipo: 'trimmer',
    nombre: 'Trimmer (potenciómetro de ajuste)',
    familia: 'resistencias',
    encapsulado: '3362P · 6,6 × 7 mm',
    resumen: 'Pista de cermet en anillo y rotor con ranura para el destornillador.',
    defecto: { valor: 10000, posicion: 0.5 },
    controles: [
      { id: 'posicion', etiqueta: 'Posición del rotor', tipo: 'numero', min: 0, max: 1, paso: 0.01, unidad: '%' },
      { id: 'valor', etiqueta: 'Valor', tipo: 'valor', unidad: 'Ω', min: 100, max: 1e6, log: true },
    ],
    kicad: ['Potentiometer_THT:Potentiometer_Bourns_3362P_Vertical'],
    interior: true,
  },
  {
    tipo: 'termistor',
    nombre: 'NTC, PTC y varistor de disco',
    familia: 'resistencias',
    encapsulado: 'Disco con patillas radiales',
    resumen: 'Disco de cerámica semiconductora (NTC/PTC) u óxido de zinc (varistor) con su recubrimiento.',
    defecto: { clase: 'ntc', diametro: 7, marcado: '' },
    controles: [
      { id: 'clase', etiqueta: 'Componente', tipo: 'opciones', opciones: op(['ntc', 'NTC'], ['ptc', 'PTC'], ['varistor', 'Varistor (MOV)']) },
      { id: 'diametro', etiqueta: 'Diámetro', tipo: 'opciones', opciones: op([5, '5 mm'], [7, '7 mm'], [10, '10 mm'], [14, '14 mm'], [20, '20 mm']) },
    ],
    kicad: ['Varistor:RV_Disc_D7mm_W3.4mm_P5mm', 'Resistor_THT:R_Disc_D5.0mm_W2.5mm_P5.00mm'],
    interior: true,
  },
  {
    tipo: 'ldr',
    nombre: 'LDR (fotorresistencia)',
    familia: 'resistencias',
    encapsulado: '5 mm',
    resumen: 'La pista de sulfuro de cadmio en serpentina entre sus dos electrodos.',
    defecto: { diametro: 5 },
    controles: [{ id: 'diametro', etiqueta: 'Diámetro', tipo: 'opciones', opciones: op([5, '5 mm'], [12, '12 mm']) }],
    kicad: ['OptoDevice:R_LDR_5.1x4.3mm_P3.4mm_Vertical'],
  },
  // ------------------------------------------------------------------ capacitors
  {
    tipo: 'condensador-disco',
    nombre: 'Condensador cerámico de disco',
    familia: 'condensadores',
    encapsulado: 'Disco de 5 a 10 mm',
    resumen: 'Disco de cerámica con una cara metalizada a cada lado: el condensador de placas más sencillo.',
    defecto: { valor: 100e-9, tension: 50, diametro: 5 },
    controles: [
      { id: 'valor', etiqueta: 'Capacidad', tipo: 'valor', unidad: 'F', min: 1e-12, max: 1e-6, log: true },
      { id: 'diametro', etiqueta: 'Diámetro', tipo: 'opciones', opciones: op([4, '4 mm'], [5, '5 mm'], [7, '7 mm'], [10, '10 mm']) },
    ],
    kicad: ['Capacitor_THT:C_Disc_D5.0mm_W2.5mm_P5.00mm'],
    interior: true,
  },
  {
    tipo: 'mlcc',
    nombre: 'Condensador cerámico multicapa (MLCC)',
    familia: 'condensadores',
    encapsulado: '0402 · 0603 · 0805 · 1206 · 1210',
    resumen: 'Capas alternas de cerámica y electrodo de níquel, unidas a una u otra terminación.',
    defecto: { valor: 100e-9, tamano: '0805', dielectrico: 'X7R', capas: 14 },
    controles: [
      { id: 'tamano', etiqueta: 'Tamaño', tipo: 'opciones', opciones: op('0402', '0603', '0805', '1206', '1210') },
      { id: 'dielectrico', etiqueta: 'Dieléctrico', tipo: 'opciones', opciones: op(['C0G', 'C0G/NP0 (clase I)'], ['X7R', 'X7R (clase II)'], ['Y5V', 'Y5V (clase II)']) },
      { id: 'capas', etiqueta: 'Electrodos (dibujados)', tipo: 'numero', min: 4, max: 40, paso: 2 },
      { id: 'valor', etiqueta: 'Capacidad', tipo: 'valor', unidad: 'F', min: 1e-12, max: 100e-6, log: true },
    ],
    kicad: ['Capacitor_SMD:C_0805_2012Metric', 'Capacitor_SMD:C_0603_1608Metric'],
    interior: true,
  },
  {
    tipo: 'condensador-pelicula',
    nombre: 'Condensador de película',
    familia: 'condensadores',
    encapsulado: 'Caja prismática, paso 5 a 15 mm',
    resumen: 'Película de polipropileno o poliéster metalizada y bobinada, con los contactos de metal proyectado.',
    defecto: { valor: 100e-9, tension: 63, paso: 5, film: 'pet' },
    controles: [
      { id: 'valor', etiqueta: 'Capacidad', tipo: 'valor', unidad: 'F', min: 1e-9, max: 10e-6, log: true },
      { id: 'paso', etiqueta: 'Paso', tipo: 'opciones', opciones: op([5, '5 mm'], [7.5, '7,5 mm'], [10, '10 mm'], [15, '15 mm']) },
      { id: 'film', etiqueta: 'Película', tipo: 'opciones', opciones: op(['pet', 'Poliéster (MKT)'], ['pp', 'Polipropileno (MKP)']) },
    ],
    kicad: ['Capacitor_THT:C_Rect_L7.2mm_W2.5mm_P5.00mm_FKS2_FKP2_MKS2_MKP2'],
    interior: true,
  },
  {
    tipo: 'electrolitico',
    nombre: 'Electrolítico de aluminio radial',
    familia: 'condensadores',
    encapsulado: 'Radial, Ø 5 a 18 mm',
    resumen: 'Láminas de ánodo y cátodo enrolladas con papel y electrolito; el tamaño sale de C·V.',
    defecto: { valor: 1000e-6, tension: 16, funda: 'azul' },
    controles: [
      { id: 'valor', etiqueta: 'Capacidad', tipo: 'valor', unidad: 'F', min: 1e-6, max: 10000e-6, log: true },
      { id: 'tension', etiqueta: 'Tensión', tipo: 'opciones', opciones: op([6.3, '6,3 V'], [10, '10 V'], [16, '16 V'], [25, '25 V'], [35, '35 V'], [50, '50 V'], [63, '63 V'], [100, '100 V'], [400, '400 V']) },
      { id: 'funda', etiqueta: 'Funda', tipo: 'opciones', opciones: op(['azul', 'Azul'], ['negro', 'Negra'], ['verde', 'Verde']) },
    ],
    kicad: ['Capacitor_THT:CP_Radial_D10.0mm_P5.00mm', 'Capacitor_THT:CP_Radial_D6.3mm_P2.50mm'],
    interior: true,
  },
  {
    tipo: 'electrolitico-smd',
    nombre: 'Electrolítico de aluminio SMD',
    familia: 'condensadores',
    encapsulado: 'V-chip, Ø 4 a 10 mm',
    resumen: 'La misma lata sobre una base de plástico; la media luna negra marca el negativo.',
    defecto: { valor: 100e-6, tension: 16 },
    controles: [
      { id: 'valor', etiqueta: 'Capacidad', tipo: 'valor', unidad: 'F', min: 1e-6, max: 1000e-6, log: true },
      { id: 'tension', etiqueta: 'Tensión', tipo: 'opciones', opciones: op([6.3, '6,3 V'], [10, '10 V'], [16, '16 V'], [25, '25 V'], [35, '35 V'], [50, '50 V']) },
    ],
    kicad: ['Capacitor_SMD:CP_Elec_6.3x5.4'],
    interior: true,
  },
  {
    tipo: 'tantalo',
    nombre: 'Condensador de tántalo SMD',
    familia: 'condensadores',
    encapsulado: 'Caja A · B · C · D (EIA 3216 a 7343)',
    resumen: 'Pastilla de tántalo sinterizado con su hilo de ánodo; la banda marca el positivo.',
    defecto: { valor: 10e-6, tension: 16, caja: 'B' },
    controles: [
      { id: 'valor', etiqueta: 'Capacidad', tipo: 'valor', unidad: 'F', min: 0.1e-6, max: 470e-6, log: true },
      { id: 'tension', etiqueta: 'Tensión', tipo: 'opciones', opciones: op([6.3, '6,3 V'], [10, '10 V'], [16, '16 V'], [25, '25 V'], [35, '35 V']) },
      { id: 'caja', etiqueta: 'Caja', tipo: 'opciones', opciones: op(['A', 'A · 3216'], ['B', 'B · 3528'], ['C', 'C · 6032'], ['D', 'D · 7343']) },
    ],
    kicad: ['Capacitor_Tantalum_SMD:CP_EIA-3528-21_Kemet-B'],
    interior: true,
  },
  {
    tipo: 'supercondensador',
    nombre: 'Supercondensador',
    familia: 'condensadores',
    encapsulado: 'Radial, Ø 8 a 18 mm',
    resumen: 'Dos electrodos de carbón activado enrollados con su separador: faradios a 2,7 V.',
    defecto: { valor: 1, tension: 2.7 },
    controles: [{ id: 'valor', etiqueta: 'Capacidad', tipo: 'opciones', opciones: op([0.47, '0,47 F'], [1, '1 F'], [4.7, '4,7 F'], [10, '10 F'], [22, '22 F']) }],
    kicad: ['Capacitor_THT:CP_Radial_D10.0mm_P5.00mm'],
    interior: true,
  },
  // ------------------------------------------------------------------ inductors, transformers, relays
  {
    tipo: 'bobina-axial',
    nombre: 'Bobina axial',
    familia: 'inductores',
    encapsulado: 'Axial, como una resistencia gruesa',
    resumen: 'Hilo bobinado sobre un núcleo de ferrita, con el código de colores en microhenrios.',
    defecto: { valor: 100e-6 },
    controles: [{ id: 'valor', etiqueta: 'Inductancia', tipo: 'valor', unidad: 'H', min: 1e-6, max: 10e-3, log: true }],
    kicad: ['Inductor_THT:L_Axial_L9.5mm_D4.0mm_P15.24mm_Horizontal_Fastron_SMCC'],
    interior: true,
  },
  {
    tipo: 'bobina-radial',
    nombre: 'Bobina radial de tambor',
    familia: 'inductores',
    encapsulado: 'Tambor de ferrita, Ø 6 a 12 mm',
    resumen: 'Núcleo de ferrita en carrete con el bobinado a la vista; el flujo se cierra por el aire.',
    defecto: { valor: 10e-3, diametro: 8, funda: true },
    controles: [
      { id: 'valor', etiqueta: 'Inductancia', tipo: 'valor', unidad: 'H', min: 1e-6, max: 47e-3, log: true },
      { id: 'diametro', etiqueta: 'Diámetro', tipo: 'opciones', opciones: op([6, '6 mm'], [8, '8 mm'], [10, '10 mm'], [12, '12 mm']) },
      { id: 'funda', etiqueta: 'Funda termorretráctil', tipo: 'interruptor' },
    ],
    kicad: ['Inductor_THT:L_Radial_D8.7mm_P5.00mm_Fastron_07HCP'],
    interior: true,
  },
  {
    tipo: 'toroide',
    nombre: 'Bobina toroidal',
    familia: 'inductores',
    encapsulado: 'Toroide de ferrita o polvo de hierro',
    resumen: 'El flujo queda dentro del anillo; las espiras se cuentan una a una.',
    defecto: { espiras: 18, devanados: 1, nucleo: 'hierro', diametro: 16 },
    controles: [
      { id: 'espiras', etiqueta: 'Espiras', tipo: 'numero', min: 4, max: 60, paso: 1 },
      { id: 'devanados', etiqueta: 'Devanados', tipo: 'opciones', opciones: op([1, '1'], [2, '2 (modo común)']) },
      { id: 'nucleo', etiqueta: 'Núcleo', tipo: 'opciones', opciones: op(['hierro', 'Polvo de hierro'], ['ferrita', 'Ferrita (verde)']) },
      { id: 'diametro', etiqueta: 'Diámetro exterior', tipo: 'opciones', opciones: op([10, '10 mm'], [16, '16 mm'], [25, '25 mm']) },
    ],
    kicad: ['Inductor_THT:L_Toroid_Vertical_L14.0mm_W6.3mm_P4.57mm_Pulse_A'],
    interior: true,
  },
  {
    tipo: 'bobina-smd',
    nombre: 'Bobina de potencia SMD',
    familia: 'inductores',
    encapsulado: 'Apantallada, 4 × 4 a 10 × 10 mm',
    resumen: 'Tambor de ferrita con su bobinado y el anillo que confina el campo.',
    defecto: { valor: 10e-6, tamano: 6 },
    controles: [
      { id: 'valor', etiqueta: 'Inductancia', tipo: 'valor', unidad: 'H', min: 1e-6, max: 1e-3, log: true },
      { id: 'tamano', etiqueta: 'Tamaño', tipo: 'opciones', opciones: op([4, '4 × 4 mm'], [6, '6 × 6 mm'], [10, '10 × 10 mm']) },
    ],
    kicad: ['Inductor_SMD:L_Sunlord_SWPA6045S'],
    interior: true,
  },
  {
    tipo: 'transformador',
    nombre: 'Transformador de núcleo EI',
    familia: 'inductores',
    encapsulado: 'EI 30 a EI 48 para placa',
    resumen: 'Chapas E e I apiladas, carrete con el primario dentro y el secundario fuera.',
    defecto: { nucleo: 'EI38', primario: 230, secundario: 12 },
    controles: [
      { id: 'nucleo', etiqueta: 'Núcleo', tipo: 'opciones', opciones: op(['EI30', 'EI 30 · 1,5 VA'], ['EI38', 'EI 38 · 3 VA'], ['EI48', 'EI 48 · 10 VA']) },
      { id: 'secundario', etiqueta: 'Secundario', tipo: 'opciones', opciones: op([6, '6 V'], [9, '9 V'], [12, '12 V'], [15, '15 V'], [24, '24 V']) },
    ],
    kicad: ['Transformer_THT:Transformer_Breve_TEZ-38x45'],
    interior: true,
  },
  {
    tipo: 'rele',
    nombre: 'Relé',
    familia: 'inductores',
    encapsulado: 'Relé de placa tipo SRD (19 × 15,5 mm)',
    resumen: 'Bobina, núcleo, culata, armadura con su muelle y los contactos NA y NC.',
    defecto: { activado: false, bobina: 5 },
    controles: [
      { id: 'activado', etiqueta: 'Bobina con corriente', tipo: 'interruptor' },
      { id: 'bobina', etiqueta: 'Tensión de bobina', tipo: 'opciones', opciones: op([5, '5 V'], [12, '12 V'], [24, '24 V']) },
    ],
    kicad: ['Relay_THT:Relay_SPDT_SANYOU_SRD_Series_Form_C'],
    interior: true,
  },
  // ------------------------------------------------------------------ diodes and LEDs
  {
    tipo: 'diodo-do41',
    nombre: 'Diodo rectificador DO-41',
    familia: 'diodos',
    encapsulado: 'DO-41 (1N400x, 1N58xx)',
    resumen: 'El dado de silicio entre las cabezas de las patillas, en epoxi; la banda es el cátodo.',
    defecto: { referencia: '1N4007' },
    controles: [{ id: 'referencia', etiqueta: 'Referencia', tipo: 'opciones', opciones: op(['1N4007', '1N4007 (rectificador)'], ['1N5819', '1N5819 (Schottky)'], ['UF4007', 'UF4007 (rápido)'], ['1N4742A', '1N4742A (Zener 12 V)']) }],
    kicad: ['Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal'],
    interior: true,
  },
  {
    tipo: 'diodo-do35',
    nombre: 'Diodo de vidrio DO-35',
    familia: 'diodos',
    encapsulado: 'DO-35 (1N4148, Zener BZX55)',
    resumen: 'Cápsula de vidrio: el dado se ve entre los dos tetones; banda negra en el cátodo.',
    defecto: { referencia: '1N4148' },
    controles: [{ id: 'referencia', etiqueta: 'Referencia', tipo: 'opciones', opciones: op(['1N4148', '1N4148 (señal)'], ['5V6', 'Zener 5,6 V'], ['3V3', 'Zener 3,3 V'], ['12V', 'Zener 12 V'], ['BAT85', 'BAT85 (Schottky)']) }],
    kicad: ['Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal'],
    interior: true,
  },
  {
    tipo: 'diodo-sod123',
    nombre: 'Diodo SMD SOD-123',
    familia: 'diodos',
    encapsulado: 'SOD-123',
    resumen: 'La banda fina en un extremo marca el cátodo.',
    defecto: { referencia: '1N4148W' },
    controles: [{ id: 'referencia', etiqueta: 'Referencia', tipo: 'opciones', opciones: op(['1N4148W', '1N4148W (T4)'], ['B5819W', 'B5819W Schottky (SL)'], ['MMSZ5V6', 'Zener 5,6 V (C2)']) }],
    kicad: ['Diode_SMD:D_SOD-123'],
    interior: true,
  },
  {
    tipo: 'led-5mm',
    nombre: 'LED de 5 mm',
    familia: 'diodos',
    encapsulado: 'T-1¾ (5 mm)',
    resumen: 'Cazoleta reflectora con el dado, hilo de oro y patillas de distinta longitud.',
    defecto: { color: 'rojo', difuso: true, encendido: false },
    controles: [
      { id: 'color', etiqueta: 'Color', tipo: 'opciones', opciones: COLOR_LED },
      { id: 'encendido', etiqueta: 'Encendido', tipo: 'interruptor' },
      { id: 'difuso', etiqueta: 'Lente difusa', tipo: 'interruptor' },
    ],
    kicad: ['LED_THT:LED_D5.0mm'],
    interior: true,
  },
  {
    tipo: 'led-smd',
    nombre: 'LED SMD',
    familia: 'diodos',
    encapsulado: 'PLCC-2 (3528) · 0805',
    resumen: 'El dado en una cavidad reflectora, bajo la resina (con fósforo en el blanco).',
    defecto: { color: 'blanco', tamano: '3528', encendido: false },
    controles: [
      { id: 'color', etiqueta: 'Color', tipo: 'opciones', opciones: COLOR_LED },
      { id: 'tamano', etiqueta: 'Encapsulado', tipo: 'opciones', opciones: op(['3528', 'PLCC-2 3528'], ['0805', 'Chip 0805']) },
      { id: 'encendido', etiqueta: 'Encendido', tipo: 'interruptor' },
    ],
    kicad: ['LED_SMD:LED_PLCC-2', 'LED_SMD:LED_0805_2012Metric'],
    interior: true,
  },
  {
    tipo: 'puente',
    nombre: 'Puente rectificador',
    familia: 'diodos',
    encapsulado: 'DIP-4 (DB107)',
    resumen: 'Cuatro diodos en un encapsulado, con los terminales +, − y los dos de alterna.',
    defecto: { referencia: 'DB107' },
    controles: [],
    kicad: ['Diode_THT:Diode_Bridge_DIP-4_W7.62mm_P5.08mm'],
    interior: true,
  },
  // ------------------------------------------------------------------ transistors
  {
    tipo: 'to92',
    nombre: 'Transistor TO-92',
    familia: 'transistores',
    encapsulado: 'TO-92 · TO-92S',
    resumen: 'Media luna de epoxi: el dado sobre el marco de patillas y sus hilos de oro.',
    defecto: { referencia: 'BC547B', cuerpo: 'TO-92' },
    controles: [
      { id: 'referencia', etiqueta: 'Referencia', tipo: 'opciones', opciones: op(['BC547B', 'BC547B (NPN)'], ['BC557B', 'BC557B (PNP)'], ['2N7000', '2N7000 (MOSFET)'], ['J201', 'J201 (JFET)'], ['78L05', '78L05 (regulador)'], ['A3144', 'A3144 (Hall)']) },
      { id: 'cuerpo', etiqueta: 'Cuerpo', tipo: 'opciones', opciones: op(['TO-92', 'TO-92'], ['TO-92S', 'TO-92S (plano)']) },
    ],
    kicad: ['Package_TO_SOT_THT:TO-92_Inline'],
    interior: true,
  },
  {
    tipo: 'to220',
    nombre: 'Transistor TO-220',
    familia: 'transistores',
    encapsulado: 'TO-220-3',
    resumen: 'Lengüeta metálica con taladro: el dado de potencia va soldado sobre ella.',
    defecto: { referencia: 'IRF540N' },
    controles: [{ id: 'referencia', etiqueta: 'Referencia', tipo: 'opciones', opciones: op(['IRF540N', 'IRF540N (MOSFET N)'], ['IRF9540N', 'IRF9540N (MOSFET P)'], ['TIP31C', 'TIP31C (BJT)'], ['BT136', 'BT136 (TRIAC)'], ['TYN612', 'TYN612 (SCR)'], ['L7805CV', 'L7805CV (regulador)']) }],
    kicad: ['Package_TO_SOT_THT:TO-220-3_Vertical'],
    interior: true,
  },
  {
    tipo: 'sot23',
    nombre: 'Transistor SOT-23',
    familia: 'transistores',
    encapsulado: 'SOT-23-3',
    resumen: 'El SMD de tres patillas de pequeña señal, con su marcaje de dos o tres caracteres.',
    defecto: { referencia: 'MMBT3904' },
    controles: [{ id: 'referencia', etiqueta: 'Referencia', tipo: 'opciones', opciones: op(['MMBT3904', 'MMBT3904 (1AM)'], ['MMBT3906', 'MMBT3906 (2A)'], ['2N7002', '2N7002 (702)'], ['BAT54S', 'BAT54S (KL4)']) }],
    kicad: ['Package_TO_SOT_SMD:SOT-23'],
    interior: true,
  },
  {
    tipo: 'dpak',
    nombre: 'MOSFET D-PAK',
    familia: 'transistores',
    encapsulado: 'TO-252 (D-PAK)',
    resumen: 'La lengüeta convertida en pestaña soldada: la placa es el disipador.',
    defecto: { referencia: 'IRLR024N' },
    controles: [],
    kicad: ['Package_TO_SOT_SMD:TO-252-2'],
    interior: true,
  },
  // ------------------------------------------------------------------ integrated circuits
  {
    tipo: 'dip',
    nombre: 'Circuito integrado DIP',
    familia: 'integrados',
    encapsulado: 'DIP-8 · DIP-14 · DIP-16',
    resumen: 'El dado en el centro del marco de patillas, unido por hilos de oro; la muesca marca la patilla 1.',
    defecto: { pines: 8, referencia: 'NE555P' },
    controles: [
      { id: 'pines', etiqueta: 'Patillas', tipo: 'opciones', opciones: op([8, 'DIP-8'], [14, 'DIP-14'], [16, 'DIP-16'], [20, 'DIP-20'], [28, 'DIP-28']) },
      { id: 'referencia', etiqueta: 'Marcado', tipo: 'opciones', opciones: op('NE555P', 'LM358N', 'TL072CP', 'CD4069UBE', 'SN74HC00N', 'ATMEGA328P') },
    ],
    kicad: ['Package_DIP:DIP-8_W7.62mm', 'Package_DIP:DIP-14_W7.62mm', 'Package_DIP:DIP-16_W7.62mm'],
    interior: true,
  },
  {
    tipo: 'soic',
    nombre: 'Circuito integrado SOIC',
    familia: 'integrados',
    encapsulado: 'SOIC-8 · SOIC-14 · SOIC-16',
    resumen: 'Patillas de ala de gaviota a 1,27 mm; el mismo dado que el DIP en un cuarto del volumen.',
    defecto: { pines: 8, referencia: 'LM358D' },
    controles: [
      { id: 'pines', etiqueta: 'Patillas', tipo: 'opciones', opciones: op([8, 'SOIC-8'], [14, 'SOIC-14'], [16, 'SOIC-16']) },
      { id: 'referencia', etiqueta: 'Marcado', tipo: 'opciones', opciones: op('LM358D', 'NE555D', 'SN74HC14D', 'ADS1115') },
    ],
    kicad: ['Package_SO:SOIC-8_3.9x4.9mm_P1.27mm', 'Package_SO:SOIC-14_3.9x8.7mm_P1.27mm'],
    interior: true,
  },
  {
    tipo: 'qfp',
    nombre: 'Circuito integrado QFP',
    familia: 'integrados',
    encapsulado: 'LQFP-32 · 44 · 48 · 64',
    resumen: 'Patillas en los cuatro lados a 0,8 o 0,5 mm.',
    defecto: { pines: 48, referencia: 'STM32F103' },
    controles: [{ id: 'pines', etiqueta: 'Patillas', tipo: 'opciones', opciones: op([32, 'LQFP-32 7 × 7'], [44, 'LQFP-44 10 × 10'], [48, 'LQFP-48 7 × 7'], [64, 'LQFP-64 10 × 10']) }],
    kicad: ['Package_QFP:LQFP-48_7x7mm_P0.5mm', 'Package_QFP:LQFP-32_7x7mm_P0.8mm'],
    interior: true,
  },
  {
    tipo: 'qfn',
    nombre: 'Circuito integrado QFN',
    familia: 'integrados',
    encapsulado: 'QFN-16 · 20 · 32',
    resumen: 'Sin patillas: contactos en el borde inferior y la almohadilla térmica debajo.',
    defecto: { pines: 32, referencia: 'ATMEGA32U4' },
    controles: [{ id: 'pines', etiqueta: 'Contactos', tipo: 'opciones', opciones: op([16, 'QFN-16 3 × 3'], [20, 'QFN-20 4 × 4'], [32, 'QFN-32 5 × 5'], [48, 'QFN-48 7 × 7']) }],
    kicad: ['Package_DFN_QFN:QFN-32-1EP_5x5mm_P0.5mm_EP3.45x3.45mm'],
    interior: true,
  },
  {
    tipo: 'optoacoplador',
    nombre: 'Optoacoplador',
    familia: 'integrados',
    encapsulado: 'DIP-4 (PC817) · DIP-6 (4N35)',
    resumen: 'Un LED y un fototransistor enfrentados dentro del mismo encapsulado, separados por el aislante.',
    defecto: { pines: 4, encendido: false },
    controles: [
      { id: 'pines', etiqueta: 'Encapsulado', tipo: 'opciones', opciones: op([4, 'DIP-4 · PC817'], [6, 'DIP-6 · 4N35']) },
      { id: 'encendido', etiqueta: 'LED encendido', tipo: 'interruptor' },
    ],
    kicad: ['Package_DIP:DIP-4_W7.62mm', 'Package_DIP:DIP-6_W7.62mm'],
    interior: true,
  },
  // ------------------------------------------------------------------ crystals, protection, connectors
  {
    tipo: 'cristal',
    nombre: 'Cristal de cuarzo HC-49',
    familia: 'varios',
    encapsulado: 'HC-49/U · HC-49/S',
    resumen: 'El disco de cuarzo con sus electrodos metalizados, sujeto por dos pinzas dentro de la cápsula.',
    defecto: { frecuencia: 16e6, cuerpo: 'S' },
    controles: [
      { id: 'frecuencia', etiqueta: 'Frecuencia', tipo: 'opciones', opciones: op([4e6, '4 MHz'], [8e6, '8 MHz'], [12e6, '12 MHz'], [16e6, '16 MHz'], [20e6, '20 MHz']) },
      { id: 'cuerpo', etiqueta: 'Cápsula', tipo: 'opciones', opciones: op(['U', 'HC-49/U (alta)'], ['S', 'HC-49/S (baja)']) },
    ],
    kicad: ['Crystal:Crystal_HC49-4H_Vertical', 'Crystal:Crystal_HC49-U_Vertical'],
    interior: true,
  },
  {
    tipo: 'fusible',
    nombre: 'Fusible de cartucho 5 × 20',
    familia: 'varios',
    encapsulado: '5 × 20 mm en portafusibles de placa',
    resumen: 'El hilo calibrado dentro del tubo de vidrio, entre los dos casquillos.',
    defecto: { corriente: 1, curva: 'F', fundido: false },
    controles: [
      { id: 'corriente', etiqueta: 'Corriente nominal', tipo: 'opciones', opciones: op([0.5, '500 mA'], [1, '1 A'], [2, '2 A'], [5, '5 A']) },
      { id: 'curva', etiqueta: 'Curva', tipo: 'opciones', opciones: op(['F', 'F (rápido)'], ['T', 'T (lento)']) },
      { id: 'fundido', etiqueta: 'Fundido', tipo: 'interruptor' },
    ],
    kicad: ['Fuse:Fuseholder_Clip-5x20mm_Littelfuse_111_Inline_P20.00x5.00mm_D1.3mm_Horizontal'],
    interior: true,
  },
  {
    tipo: 'ptc',
    nombre: 'PTC rearmable',
    familia: 'varios',
    encapsulado: 'Radial (RXEF, MF-R)',
    resumen: 'Polímero cargado de carbón entre dos láminas de níquel: se dispara y se rearma.',
    defecto: { corriente: 0.5 },
    controles: [{ id: 'corriente', etiqueta: 'Corriente de mantenimiento', tipo: 'opciones', opciones: op([0.1, '100 mA'], [0.5, '500 mA'], [1.1, '1,1 A'], [2.5, '2,5 A']) }],
    kicad: ['Fuse:Fuse_Littelfuse-RXEF050'],
    interior: true,
  },
  {
    tipo: 'tira-pines',
    nombre: 'Tira de pines',
    familia: 'varios',
    encapsulado: 'Paso 2,54 mm',
    resumen: 'Pines cuadrados de 0,64 mm en un soporte de plástico.',
    defecto: { pines: 6, filas: 1 },
    controles: [
      { id: 'pines', etiqueta: 'Pines por fila', tipo: 'numero', min: 1, max: 20, paso: 1 },
      { id: 'filas', etiqueta: 'Filas', tipo: 'opciones', opciones: op([1, '1'], [2, '2']) },
    ],
    kicad: ['Connector_PinHeader_2.54mm:PinHeader_1x06_P2.54mm_Vertical'],
  },
  {
    tipo: 'borna',
    nombre: 'Borna de tornillo',
    familia: 'varios',
    encapsulado: 'Paso 5,08 mm',
    resumen: 'Bloque de terminales con tornillo y la pinza que aprieta el cable.',
    defecto: { polos: 2, color: 'verde' },
    controles: [
      { id: 'polos', etiqueta: 'Polos', tipo: 'opciones', opciones: op([2, '2'], [3, '3'], [4, '4']) },
      { id: 'color', etiqueta: 'Color', tipo: 'opciones', opciones: op(['verde', 'Verde'], ['azul', 'Azul']) },
    ],
    kicad: ['TerminalBlock_Phoenix:TerminalBlock_Phoenix_MKDS-1,5-2-5.08_1x02_P5.08mm_Horizontal'],
    interior: true,
  },
];

const POR_TIPO = new Map(PAQUETES.map((p) => [p.tipo, p]));

export function paquete(tipo: string): Paquete | undefined {
  return POR_TIPO.get(tipo);
}

/** Default parameters merged with the given ones. */
export function conDefecto(tipo: string, p: Parametros = {}): Parametros {
  return { ...(POR_TIPO.get(tipo)?.defecto ?? {}), ...p };
}
