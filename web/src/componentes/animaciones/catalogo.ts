// Catalogue of the component animations: metadata only (no scene code), so that the reader can import it
// cheaply to show «Ver animación» next to the sections and figures each animation illustrates.

export type Familia =
  | 'resistencias'
  | 'condensadores'
  | 'inductores'
  | 'diodos'
  | 'bjt'
  | 'fet'
  | 'potencia'
  | 'especiales';

export const FAMILIAS: { id: Familia; nombre: string; color: string }[] = [
  { id: 'resistencias', nombre: 'Resistencias', color: '#A6552B' },
  { id: 'condensadores', nombre: 'Condensadores', color: '#2E6EA6' },
  { id: 'inductores', nombre: 'Bobinas, transformadores y relés', color: '#6B3FA0' },
  { id: 'diodos', nombre: 'Diodos', color: '#C62828' },
  { id: 'bjt', nombre: 'Transistores bipolares', color: '#1F6F5C' },
  { id: 'fet', nombre: 'MOSFET y transistores de efecto de campo', color: '#1A3A5C' },
  { id: 'potencia', nombre: 'Potencia y protección', color: '#B9770E' },
  { id: 'especiales', nombre: 'Componentes especiales y sensores', color: '#8A1F3D' },
];

export type Simbolo =
  | 'resistencia'
  | 'ohm'
  | 'calor'
  | 'colores'
  | 'potenciometro'
  | 'ntc'
  | 'condensador'
  | 'mlcc'
  | 'electrolitico'
  | 'pelicula'
  | 'super'
  | 'rc'
  | 'alterna'
  | 'esr'
  | 'bobina'
  | 'nucleo'
  | 'transformador'
  | 'rele'
  | 'union'
  | 'diodo'
  | 'zener'
  | 'led'
  | 'fotodiodo'
  | 'schottky'
  | 'puente'
  | 'npn'
  | 'curvas'
  | 'nmos'
  | 'mosfet-curvas'
  | 'puerta'
  | 'cmos'
  | 'jfet'
  | 'scr'
  | 'fusible'
  | 'varistor'
  | 'opto'
  | 'cristal'
  | 'hall'
  | 'opamp';

export interface Animacion {
  id: string;
  titulo: string;
  familia: Familia;
  /** One sentence for the gallery card. */
  resumen: string;
  /** Extra search words. */
  claves: string;
  /**
   * Book labels this animation illustrates (sections, subsections, figures), most relevant first. Each one
   * gets a «Ver animación» button in the reader and is listed as «En el libro» on the animation page.
   */
  libro: string[];
  simbolo: Simbolo;
}

export const ANIMACIONES: Animacion[] = [
  // ------------------------------------------------------------------ resistors
  {
    id: 'resistencia-construccion',
    titulo: 'Cómo está hecha una resistencia',
    familia: 'resistencias',
    resumen: 'Película de carbón, película metálica, bobinada y SMD de capa gruesa, en corte.',
    claves: 'carbón película metálica bobinada hilo smd capa gruesa thick film construcción corte helicoidal',
    libro: ['sec-2.2', 'sec-2.2.2', 'sec-2.2.3', 'sec-2.2.4', 'sec-2.2.5', 'fig-2.3'],
    simbolo: 'resistencia',
  },
  {
    id: 'resistencia-ohm',
    titulo: 'Ley de Ohm: electrones que chocan',
    familia: 'resistencias',
    resumen: 'La deriva de los electrones entre choques con la red, y por qué I = V/R.',
    claves: 'ohm deriva colisiones red cristalina conductor joule resistividad',
    libro: ['sec-2.1', 'sec-1.2'],
    simbolo: 'ohm',
  },
  {
    id: 'resistencia-potencia',
    titulo: 'Potencia, calor y derating',
    familia: 'resistencias',
    resumen: 'P = V²/R se convierte en temperatura; la curva de derating dice cuánto se puede.',
    claves: 'potencia disipación calor temperatura derating joule vatios',
    libro: ['sec-2.8', 'sec-2.1'],
    simbolo: 'calor',
  },
  {
    id: 'codigo-colores',
    titulo: 'El código de colores',
    familia: 'resistencias',
    resumen: 'Lector interactivo de cuatro y cinco bandas con tolerancia y serie E.',
    claves: 'bandas colores tolerancia multiplicador e12 e24 iec 60062 lectura',
    libro: ['sec-2.4', 'sec-2.5'],
    simbolo: 'colores',
  },
  {
    id: 'potenciometro',
    titulo: 'Potenciómetro, reóstato y trimmer',
    familia: 'resistencias',
    resumen: 'El cursor recorre la pista; ley lineal o logarítmica y el efecto de la carga.',
    claves: 'potenciómetro trimmer reóstato cursor pista lineal logarítmico carga divisor',
    libro: ['sec-2.11', 'sec-2.6'],
    simbolo: 'potenciometro',
  },
  {
    id: 'sensores-resistivos',
    titulo: 'NTC, PTC y LDR',
    familia: 'resistencias',
    resumen: 'Resistencias que responden a la temperatura y a la luz.',
    claves: 'ntc ptc ldr termistor fotorresistencia temperatura luz sensor beta',
    libro: ['sec-2.6', 'sec-20.6', 'sec-45.3', 'sec-10.8'],
    simbolo: 'ntc',
  },
  // ------------------------------------------------------------------ capacitors
  {
    id: 'condensador-placas',
    titulo: 'Placas, carga y campo eléctrico',
    familia: 'condensadores',
    resumen: 'La carga se acumula, el campo crece y el dieléctrico se polariza.',
    claves: 'capacidad placas paralelas campo eléctrico dieléctrico polarización permitividad energía',
    libro: ['sec-3.1', 'fig-3.3'],
    simbolo: 'condensador',
  },
  {
    id: 'condensador-ceramico',
    titulo: 'Cerámicos de disco y MLCC',
    familia: 'condensadores',
    resumen: 'Capas apiladas de un MLCC y la capacidad que se pierde con la tensión continua.',
    claves: 'mlcc cerámico disco multicapa x7r y5v c0g np0 dc bias polarización clase 2',
    libro: ['sec-3.4.1', 'sec-3.7', 'fig-3.7', 'prob-3.C'],
    simbolo: 'mlcc',
  },
  {
    id: 'condensador-electrolitico',
    titulo: 'Electrolíticos, tántalo y polímero',
    familia: 'condensadores',
    resumen: 'Lámina enrollada, capa de óxido, polaridad y lo que ocurre al invertirla.',
    claves: 'electrolítico aluminio óxido polaridad inverso explota tántalo polímero ánodo',
    libro: ['sec-3.4.2', 'sec-3.4.4', 'sec-3.8', 'fig-3.7'],
    simbolo: 'electrolitico',
  },
  {
    id: 'condensador-pelicula',
    titulo: 'Película metalizada y autorregeneración',
    familia: 'condensadores',
    resumen: 'Una perforación vaporiza la metalización y el condensador sigue funcionando.',
    claves: 'película polipropileno poliéster metalizado autorregenerable clase x',
    libro: ['sec-3.4.3', 'sec-3.10'],
    simbolo: 'pelicula',
  },
  {
    id: 'supercondensador',
    titulo: 'Supercondensador de doble capa',
    familia: 'condensadores',
    resumen: 'Iones contra un carbón poroso: faradios a 2,7 V.',
    claves: 'supercondensador doble capa edlc iones carbón activado faradios',
    libro: ['sec-3.10', 'sec-3.4.4'],
    simbolo: 'super',
  },
  {
    id: 'rc-carga',
    titulo: 'Carga y descarga RC',
    familia: 'condensadores',
    resumen: 'La exponencial, la constante de tiempo τ = RC y sus hitos.',
    claves: 'rc carga descarga constante de tiempo tau exponencial 63,2',
    libro: ['sec-3.2', 'fig-3.4'],
    simbolo: 'rc',
  },
  {
    id: 'condensador-alterna',
    titulo: 'El condensador en alterna',
    familia: 'condensadores',
    resumen: 'La corriente adelanta 90° y la reactancia cae con la frecuencia.',
    claves: 'reactancia capacitiva alterna desfase 90 fasor frecuencia',
    libro: ['sec-3.3', 'fig-3.5'],
    simbolo: 'alterna',
  },
  {
    id: 'esr-autorresonancia',
    titulo: 'ESR, ESL y autorresonancia',
    familia: 'condensadores',
    resumen: 'La impedancia en V de un condensador real y por qué por encima es una bobina.',
    claves: 'esr esl autorresonancia srf impedancia desacoplo parásitos',
    libro: ['sec-3.5', 'fig-3.8'],
    simbolo: 'esr',
  },
  // ------------------------------------------------------------------ inductors
  {
    id: 'bobina-lenz',
    titulo: 'Campo magnético y ley de Lenz',
    familia: 'inductores',
    resumen: 'El campo crece, la fuerza contraelectromotriz se opone y la energía queda en el campo.',
    claves: 'bobina inductancia lenz faraday fem campo magnético rl constante de tiempo energía',
    libro: ['sec-4.1', 'sec-4.3'],
    simbolo: 'bobina',
  },
  {
    id: 'nucleo-saturacion',
    titulo: 'Saturación del núcleo y entrehierro',
    familia: 'inductores',
    resumen: 'Dominios que se alinean, la inductancia que se desploma y lo que hace el gap.',
    claves: 'saturación núcleo ferrita entrehierro gap dominios reluctancia energía',
    libro: ['sec-4.10', 'fig-4.16', 'sec-4.4'],
    simbolo: 'nucleo',
  },
  {
    id: 'transformador',
    titulo: 'El transformador',
    familia: 'inductores',
    resumen: 'Flujo común, relación de espiras y conservación de la potencia.',
    claves: 'transformador primario secundario espiras relación flujo núcleo',
    libro: ['sec-4.6'],
    simbolo: 'transformador',
  },
  {
    id: 'rele-flyback',
    titulo: 'Relé y pico de desconexión',
    familia: 'inductores',
    resumen: 'El contacto se cierra; al cortar, el pico inductivo y el diodo que lo recorta.',
    claves: 'relé bobina contacto flyback diodo libre circulación rueda libre pico inductivo',
    libro: ['sec-4.5', 'sec-20.3'],
    simbolo: 'rele',
  },
  // ------------------------------------------------------------------ diodes
  {
    id: 'union-pn',
    titulo: 'Formación de la unión PN',
    familia: 'diodos',
    resumen: 'Difusión, recombinación, iones fijos y el campo que detiene el proceso.',
    claves: 'unión pn difusión zona de agotamiento deplexión barrera potencial de contacto iones',
    libro: ['sec-5.2', 'fig-5.5', 'fig-5.7', 'sec-26.2'],
    simbolo: 'union',
  },
  {
    id: 'diodo-polarizacion',
    titulo: 'El diodo polarizado: directa, inversa y ruptura',
    familia: 'diodos',
    resumen: 'La barrera sube y baja; la curva I-V de Shockley se traza en directo.',
    claves: 'diodo shockley directa inversa ruptura avalancha corriente de saturación curva',
    libro: ['sec-5.3', 'sec-5.2', 'fig-5.6'],
    simbolo: 'diodo',
  },
  {
    id: 'zener',
    titulo: 'Zener y avalancha',
    familia: 'diodos',
    resumen: 'Ruptura por efecto túnel o por avalancha y el regulador Zener.',
    claves: 'zener avalancha túnel regulador ruptura inversa',
    libro: ['sec-5.8', 'sec-5.5', 'fig-5.13'],
    simbolo: 'zener',
  },
  {
    id: 'led',
    titulo: 'LED: recombinación que emite luz',
    familia: 'diodos',
    resumen: 'El color lo decide la banda prohibida: rojo, verde y azul con sus energías.',
    claves: 'led fotón banda prohibida color longitud de onda recombinación rojo verde azul',
    libro: ['sec-5.5', 'sec-45.1', 'sec-45.2'],
    simbolo: 'led',
  },
  {
    id: 'fotodiodo',
    titulo: 'Fotodiodo',
    familia: 'diodos',
    resumen: 'Los fotones crean pares en la zona de agotamiento y el campo los separa.',
    claves: 'fotodiodo fotocorriente luz pares electrón hueco célula solar fotovoltaico',
    libro: ['sec-45.3', 'sec-45.1'],
    simbolo: 'fotodiodo',
  },
  {
    id: 'schottky',
    titulo: 'Diodo Schottky',
    familia: 'diodos',
    resumen: 'Metal sobre silicio N: menos caída y sin carga almacenada al apagar.',
    claves: 'schottky metal semiconductor recuperación inversa conmutación caída',
    libro: ['sec-5.5', 'sec-5.7'],
    simbolo: 'schottky',
  },
  {
    id: 'rectificador',
    titulo: 'Rectificadores de media onda y onda completa',
    familia: 'diodos',
    resumen: 'Qué diodos conducen en cada semiciclo y cómo el condensador alisa.',
    claves: 'rectificador media onda onda completa puente toma media rizado condensador filtro',
    libro: ['sec-5.6'],
    simbolo: 'puente',
  },
  // ------------------------------------------------------------------ BJT
  {
    id: 'bjt-portadores',
    titulo: 'El transistor bipolar por dentro',
    familia: 'bjt',
    resumen: 'El emisor inyecta, la base delgada deja pasar y el colector recoge (NPN y PNP).',
    claves: 'bjt npn pnp emisor base colector beta inyección recombinación transistor bipolar',
    libro: ['sec-6.1', 'sec-6.2', 'fig-6.1', 'sec-26.4'],
    simbolo: 'npn',
  },
  {
    id: 'bjt-curvas',
    titulo: 'Regiones del BJT: interruptor y amplificador',
    familia: 'bjt',
    resumen: 'Curvas de salida, recta de carga y el punto de trabajo en corte, activa y saturación.',
    claves: 'curvas de salida recta de carga punto de trabajo corte activa saturación amplificador interruptor',
    libro: ['sec-6.2', 'sec-6.5', 'sec-6.7', 'sec-26.3'],
    simbolo: 'curvas',
  },
  // ------------------------------------------------------------------ FET
  {
    id: 'mosfet-canal',
    titulo: 'MOSFET: cómo se forma el canal',
    familia: 'fet',
    resumen: 'La puerta invierte la superficie, el canal se estrangula y aparece el diodo de cuerpo.',
    claves: 'mosfet canal inversión umbral vth pinch-off estrangulamiento óxido puerta diodo de cuerpo canal n canal p',
    libro: ['sec-7.1', 'sec-7.2', 'fig-7.1', 'fig-7.2', 'sec-26.5', 'sec-26.6', 'sec-7.9'],
    simbolo: 'nmos',
  },
  {
    id: 'mosfet-curvas',
    titulo: 'Curvas del MOSFET y el MOSFET como interruptor',
    familia: 'fet',
    resumen: 'Región óhmica y de saturación, la ley cuadrática y la carga que gobierna.',
    claves: 'mosfet curvas óhmica triodo saturación ley cuadrática rds on interruptor carga',
    libro: ['sec-7.2', 'fig-7.3', 'sec-7.5'],
    simbolo: 'mosfet-curvas',
  },
  {
    id: 'mosfet-puerta',
    titulo: 'Carga de puerta y meseta de Miller',
    familia: 'fet',
    resumen: 'Qg, la meseta de Miller y por qué el driver decide las pérdidas.',
    claves: 'carga de puerta qg miller meseta driver conmutación pérdidas cgd',
    libro: ['sec-7.8', 'fig-7.10'],
    simbolo: 'puerta',
  },
  {
    id: 'cmos-inversor',
    titulo: 'El inversor CMOS',
    familia: 'fet',
    resumen: 'Un PMOS arriba, un NMOS abajo: la curva de transferencia y la corriente de paso.',
    claves: 'cmos inversor pmos nmos lógica transferencia consumo',
    libro: ['sec-9.2', 'sec-9.3'],
    simbolo: 'cmos',
  },
  {
    id: 'jfet',
    titulo: 'JFET',
    familia: 'fet',
    resumen: 'La tensión inversa de puerta estrecha el canal hasta cerrarlo.',
    claves: 'jfet unión puerta canal estrangulamiento idss vp',
    libro: ['sec-7.3'],
    simbolo: 'jfet',
  },
  // ------------------------------------------------------------------ power and protection
  {
    id: 'tiristor',
    titulo: 'SCR y TRIAC',
    familia: 'potencia',
    resumen: 'Un pulso de puerta lo enclava; el control de fase recorta la senoide.',
    claves: 'scr tiristor triac diac enclavamiento control de fase ángulo de disparo corriente de mantenimiento',
    libro: ['sec-10.1'],
    simbolo: 'scr',
  },
  {
    id: 'fusible',
    titulo: 'Fusible y PTC rearmable',
    familia: 'potencia',
    resumen: 'I²t que funde el hilo, y la PTC que se dispara y se rearma.',
    claves: 'fusible ptc rearmable polyfuse i2t sobrecorriente protección',
    libro: ['sec-10.3'],
    simbolo: 'fusible',
  },
  {
    id: 'supresor',
    titulo: 'Varistor y TVS ante un pico',
    familia: 'potencia',
    resumen: 'Un transitorio de tensión y el componente que lo recorta.',
    claves: 'varistor mov tvs transitorio sobretensión pico recorte protección',
    libro: ['sec-10.4', 'sec-5.5', 'sec-2.6'],
    simbolo: 'varistor',
  },
  // ------------------------------------------------------------------ special components and sensors
  {
    id: 'optoacoplador',
    titulo: 'Optoacoplador',
    familia: 'especiales',
    resumen: 'Luz que cruza una barrera aislante: LED, fototransistor y CTR.',
    claves: 'optoacoplador aislamiento led fototransistor ctr galvánico',
    libro: ['sec-20.2', 'sec-45.4'],
    simbolo: 'opto',
  },
  {
    id: 'cristal',
    titulo: 'Cuarzo y efecto piezoeléctrico',
    familia: 'especiales',
    resumen: 'La lámina vibra; resonancias serie y paralelo con un Q enorme.',
    claves: 'cristal cuarzo piezoeléctrico resonador resonancia serie paralelo oscilador zumbador',
    libro: ['sec-20.12', 'sec-28.3', 'sec-20.4', 'sec-20.6'],
    simbolo: 'cristal',
  },
  {
    id: 'hall',
    titulo: 'Sensor de efecto Hall',
    familia: 'especiales',
    resumen: 'El campo magnético desvía los portadores y aparece una tensión transversal.',
    claves: 'hall campo magnético lorentz sensor corriente posición',
    libro: ['sec-35.5', 'sec-20.6'],
    simbolo: 'hall',
  },
  {
    id: 'opamp',
    titulo: 'Amplificador operacional con realimentación',
    familia: 'especiales',
    resumen: 'La salida se mueve hasta que las entradas casi se igualan.',
    claves: 'operacional amplificador realimentación inversor no inversor masa virtual ganancia saturación',
    libro: ['sec-27.1', 'sec-27.2', 'sec-27.3'],
    simbolo: 'opamp',
  },
];

export function familiaDe(id: Familia): { id: Familia; nombre: string; color: string } {
  return FAMILIAS.find((f) => f.id === id) ?? FAMILIAS[0]!;
}

export function animacion(id: string): Animacion | undefined {
  return ANIMACIONES.find((a) => a.id === id);
}

let porEtiqueta: Map<string, Animacion[]> | null = null;

/** Animations that illustrate a book label (section, subsection or figure). */
export function animacionesDe(label: string): Animacion[] {
  if (!porEtiqueta) {
    porEtiqueta = new Map();
    for (const a of ANIMACIONES)
      for (const l of a.libro) {
        const lista = porEtiqueta.get(l) ?? [];
        lista.push(a);
        porEtiqueta.set(l, lista);
      }
  }
  return porEtiqueta.get(label) ?? [];
}
