// Catalogue of the concept animations (theory the book explains with static figures): metadata only, so the
// reader can import it cheaply for its «Ver animación» buttons. `libro` lists the refs.json labels each one
// illustrates, most relevant first; the page links back to them.

export type Area = 'circuitos' | 'alterna' | 'senales' | 'analogica' | 'potencia' | 'digital' | 'rf';

export const AREAS: { id: Area; nombre: string; color: string }[] = [
  { id: 'circuitos', nombre: 'Campos, leyes y teoremas de circuitos', color: '#1A3A5C' },
  { id: 'alterna', nombre: 'Alterna, transitorios y resonancia', color: '#6B3FA0' },
  { id: 'senales', nombre: 'Señales, muestreo y modulación', color: '#2E6EA6' },
  { id: 'analogica', nombre: 'Realimentación, filtros, osciladores y ruido', color: '#A6552B' },
  { id: 'potencia', nombre: 'Alimentación y potencia', color: '#B9770E' },
  { id: 'digital', nombre: 'Lógica digital y temporización', color: '#1F6F5C' },
  { id: 'rf', nombre: 'Líneas, antenas y alta frecuencia', color: '#8A1F3D' },
];

export type IconoConcepto =
  | 'campo'
  | 'induccion'
  | 'kirchhoff'
  | 'thevenin'
  | 'superposicion'
  | 'potencia-max'
  | 'fasor'
  | 'impedancia'
  | 'transitorio'
  | 'resonancia'
  | 'potencia-ac'
  | 'fourier'
  | 'fft'
  | 'muestreo'
  | 'cuantizacion'
  | 'modulacion'
  | 'mezclador'
  | 'convolucion'
  | 'realimentacion'
  | 'margen'
  | 'bode'
  | 'oscilador'
  | 'ruido'
  | 'histeresis'
  | 'pid'
  | 'fuente'
  | 'conmutada'
  | 'pwm'
  | 'niveles'
  | 'glitch'
  | 'metaestabilidad'
  | 'reflexion'
  | 'estacionaria'
  | 'smith'
  | 'antena'
  | 'pelicular';

export interface Concepto {
  id: string;
  titulo: string;
  area: Area;
  /** One sentence for the gallery card. */
  resumen: string;
  /** Extra search words. */
  claves: string;
  /** Book labels (sections, subsections, figures) it illustrates, most relevant first. */
  libro: string[];
  icono: IconoConcepto;
}

export const CONCEPTOS: Concepto[] = [
  // ------------------------------------------------------------------ fields, laws and theorems
  {
    id: 'campo-potencial',
    titulo: 'Campo eléctrico, potencial y tensión',
    area: 'circuitos',
    resumen: 'Líneas de campo y equipotenciales de dos cargas o de dos placas, y una carga que cae de potencial alto a bajo: V = W/Q.',
    claves: 'campo eléctrico potencial tensión equipotencial líneas de campo coulomb carga trabajo energía por unidad de carga placas paralelas',
    libro: ['sec-1.1.3', 'sec-1.1', 'fig-1.1', 'sec-3.1', 'fig-3.3'],
    icono: 'campo',
  },
  {
    id: 'induccion',
    titulo: 'Campo magnético e inducción (Faraday y Lenz)',
    area: 'circuitos',
    resumen: 'Un imán que atraviesa una bobina: el flujo, la tensión v = −N·dΦ/dt que solo aparece mientras cambia, y el campo circular de un hilo.',
    claves: 'campo magnético inducción faraday lenz flujo weber tesla bobina imán espiras hilo mano derecha',
    libro: ['sec-4.1', 'fig-4.2', 'sec-4.3', 'sec-1.14', 'sec-24.9'],
    icono: 'induccion',
  },
  {
    id: 'kirchhoff',
    titulo: 'Las leyes de Kirchhoff en dos mallas',
    area: 'circuitos',
    resumen: 'Corrientes de malla, la corriente que se reparte en un nodo y el potencial que sube y baja a lo largo de un lazo.',
    claves: 'kirchhoff mallas nodos ltk lck lazo caída de tensión corriente de malla balance de potencias',
    libro: ['sec-1.3', 'sec-0.2', 'fig-0.2', 'sec-23.4', 'sec-23.2', 'fig-1.3'],
    icono: 'kirchhoff',
  },
  {
    id: 'thevenin-norton',
    titulo: 'Thévenin y Norton: la misma recta',
    area: 'circuitos',
    resumen: 'Una red y sus dos equivalentes con la misma carga: vacío, cortocircuito y la recta tensión-corriente.',
    claves: 'thevenin norton equivalente resistencia de salida vacío cortocircuito recta de carga impedancia de salida medir rth',
    libro: ['sec-23.6', 'sec-23.7', 'sec-1.5', 'fig-23.6', 'fig-23.7', 'fig-23.8', 'sec-23.8', 'sec-1.10'],
    icono: 'thevenin',
  },
  {
    id: 'superposicion',
    titulo: 'Superposición: una fuente cada vez',
    area: 'circuitos',
    resumen: 'Cada fuente sola, la suma de sus efectos, por qué las potencias no se suman y qué pasa con un diodo.',
    claves: 'superposición linealidad anular fuente cortocircuito potencia no lineal diodo',
    libro: ['sec-23.5', 'fig-23.5', 'sec-1.5'],
    icono: 'superposicion',
  },
  {
    id: 'maxima-potencia',
    titulo: 'Máxima transferencia de potencia',
    area: 'circuitos',
    resumen: 'La carga que recibe más potencia, la planicie del máximo y el 50 % de rendimiento que nadie quiere en potencia.',
    claves: 'máxima transferencia potencia adaptación rendimiento carga rth rl 50 %',
    libro: ['sec-23.9', 'fig-23.10', 'fig-23.11', 'sec-1.5', 'fig-1.6'],
    icono: 'potencia-max',
  },
  // ------------------------------------------------------------------ AC, transients and resonance
  {
    id: 'fasores',
    titulo: 'Fasores: la senoide como vector que gira',
    area: 'alterna',
    resumen: 'La proyección de un vector giratorio, la suma de senoides como suma de vectores y derivar como girar 90°.',
    claves: 'fasor complejo euler senoide fase desfase proyección suma vectorial jω derivada módulo ángulo',
    libro: ['sec-0.5', 'fig-0.5', 'fig-0.6', 'sec-0.3', 'fig-0.3', 'sec-24.4', 'sec-0.9', 'sec-24.2'],
    icono: 'fasor',
  },
  {
    id: 'impedancia',
    titulo: 'Impedancia compleja y tensiones en cuadratura',
    area: 'alterna',
    resumen: 'El triángulo R + jX de un RC, RL o RLC serie que cambia con la frecuencia, y por qué las tensiones no suman.',
    claves: 'impedancia reactancia capacitiva inductiva triángulo desfase rc rl rlc serie cuadratura módulo',
    libro: ['sec-0.9', 'sec-24.4', 'fig-0.10', 'fig-24.7', 'fig-24.8', 'sec-3.3', 'sec-4.3'],
    icono: 'impedancia',
  },
  {
    id: 'transitorio-rlc',
    titulo: 'Transitorio de segundo orden (RLC)',
    area: 'alterna',
    resumen: 'Sobreamortiguado, crítico y subamortiguado: respuesta natural y forzada, energía que va y viene y los polos en el plano s.',
    claves: 'transitorio escalón rlc amortiguamiento zeta sobreimpulso respuesta natural forzada polos plano s laplace segundo orden',
    libro: ['sec-24.3', 'fig-24.5', 'fig-24.6', 'sec-24.1', 'fig-24.1', 'sec-0.8', 'fig-0.9', 'sec-0.10', 'fig-0.11'],
    icono: 'transitorio',
  },
  {
    id: 'resonancia',
    titulo: 'Resonancia, factor Q y ancho de banda',
    area: 'alterna',
    resumen: 'Barrido de frecuencia de un RLC serie o paralelo: la curva, la banda a −3 dB y la sobretensión de Q veces.',
    claves: 'resonancia factor de calidad q ancho de banda selectividad sintonía tanque lc serie paralelo sobretensión',
    libro: ['sec-24.6', 'sec-24.7', 'sec-1.7', 'fig-1.8', 'fig-24.11', 'fig-24.13', 'sec-4.7', 'sec-22.9'],
    icono: 'resonancia',
  },
  {
    id: 'potencia-alterna',
    titulo: 'Potencia en alterna y factor de potencia',
    area: 'alterna',
    resumen: 'p(t) = v·i, potencia activa, reactiva y aparente, la corrección con condensadores y el rectificador que no se deja corregir.',
    claves: 'potencia activa reactiva aparente factor de potencia cos phi corrección condensador triángulo de potencias armónicos pfc',
    libro: ['sec-24.5', 'sec-24.8', 'fig-24.9', 'fig-24.10', 'fig-24.14', 'sec-1.6', 'fig-1.7', 'sec-33.8'],
    icono: 'potencia-ac',
  },
  // ------------------------------------------------------------------ signals, sampling and modulation
  {
    id: 'fourier',
    titulo: 'Series de Fourier: una onda hecha de armónicos',
    area: 'senales',
    resumen: 'Cuadrada, triangular, sierra y pulsos construidas armónico a armónico con fasores giratorios, su espectro y el fenómeno de Gibbs.',
    claves: 'fourier armónicos serie espectro cuadrada triangular diente de sierra pulso ciclo de trabajo gibbs epiciclos parseval',
    libro: ['sec-0.11', 'fig-0.12', 'sec-21.12', 'fig-21.26', 'sec-22.6', 'sec-24.2', 'fig-24.4'],
    icono: 'fourier',
  },
  {
    id: 'fft-ventanas',
    titulo: 'La FFT: resolución, fuga y ventanas',
    area: 'senales',
    resumen: 'Una captura de 10 ms, lo que la FFT supone en el empalme, la fuga espectral que tapa los armónicos y lo que arreglan Hann y flat-top.',
    claves: 'fft espectro ventana hann flat-top rectangular fuga leakage resolución bin thd armónicos osciloscopio',
    libro: ['sec-21.13', 'fig-21.27', 'fig-21.28', 'sec-21.12', 'fig-21.25', 'sec-30.6', 'fig-30.12'],
    icono: 'fft',
  },
  {
    id: 'muestreo-aliasing',
    titulo: 'Muestreo, Nyquist y aliasing',
    area: 'senales',
    resumen: '700 Hz muestreados a 1 kHz parecen 300 Hz: las muestras, la frecuencia aparente que se pliega y las réplicas del espectro.',
    claves: 'muestreo nyquist aliasing alias frecuencia de muestreo plegado antialiasing réplicas submuestreo',
    libro: ['sec-30.4', 'fig-30.6', 'fig-30.7', 'fig-30.9', 'sec-21.20', 'fig-21.44', 'sec-52.3', 'sec-30.1'],
    icono: 'muestreo',
  },
  {
    id: 'cuantizacion',
    titulo: 'Cuantificación, ADC y dither',
    area: 'senales',
    resumen: 'Bits, LSB y el error de ±½ LSB; la SNR de 6,02·n + 1,76 dB, y por qué una señal pequeña da armónicos y el dither los borra.',
    claves: 'cuantificación cuantización adc dac lsb bits snr enob dither error de cuantificación conversor código',
    libro: ['sec-34.1', 'fig-34.2', 'fig-34.3', 'sec-34.9', 'sec-34.2', 'sec-34.5', 'sec-30.4'],
    icono: 'cuantizacion',
  },
  {
    id: 'modulacion',
    titulo: 'Modulación AM y FM',
    area: 'senales',
    resumen: 'La portadora en el tiempo y su espectro: bandas laterales de AM, rayas de Bessel de FM y la regla de Carson.',
    claves: 'modulación am fm amplitud frecuencia portadora bandas laterales índice carson bessel desviación sobremodulación',
    libro: ['sec-31.4', 'fig-31.6', 'fig-31.7', 'fig-31.8', 'fig-31.9', 'sec-22.12'],
    icono: 'modulacion',
  },
  {
    id: 'superheterodino',
    titulo: 'Mezclador, frecuencia intermedia e imagen',
    area: 'senales',
    resumen: 'El dial del FM7303: el oscilador local 10,7 MHz por encima, todas las emisoras desplazadas y la imagen que solo frena el filtro de entrada.',
    claves: 'superheterodino mezclador oscilador local frecuencia intermedia fi 10,7 mhz imagen filtro cerámico selectividad sintonía fm7303',
    libro: ['sec-16.3', 'sec-36.9', 'fig-36.11', 'fig-16.3', 'sec-36.7', 'fig-31.7'],
    icono: 'mezclador',
  },
  // ------------------------------------------------------------------ feedback, filters, oscillators and noise
  {
    id: 'realimentacion',
    titulo: 'Realimentación negativa y ganancia por ancho de banda',
    area: 'analogica',
    resumen: 'El lazo A·β con sus señales: la ganancia que solo depende de β, el factor de desensibilización y el ancho de banda que se gana.',
    claves: 'realimentación negativa ganancia de lazo desensibilización gbw producto ganancia ancho de banda operacional polo dominante cortocircuito virtual',
    libro: ['sec-27.2', 'fig-27.3', 'fig-27.4', 'fig-27.11', 'fig-27.5', 'sec-27.5', 'fig-27.10', 'sec-8.6', 'sec-27.1'],
    icono: 'realimentacion',
  },
  {
    id: 'margen-fase',
    titulo: 'Estabilidad y margen de fase',
    area: 'analogica',
    resumen: 'Polos que acumulan fase, el cruce de 0 dB, el margen que queda y la respuesta al escalón que timbra u oscila; el seguidor y la carga capacitiva.',
    claves: 'estabilidad margen de fase margen de ganancia compensación polo dominante carga capacitiva seguidor oscila sobreimpulso bode lazo',
    libro: ['sec-27.8', 'fig-27.14', 'sec-27.9', 'fig-27.15', 'sec-27.10', 'fig-27.16', 'fig-27.17', 'sec-31.9', 'fig-31.17'],
    icono: 'margen',
  },
  {
    id: 'bode-polos-ceros',
    titulo: 'El diagrama de Bode con polos y ceros',
    area: 'analogica',
    resumen: 'Arrastra polos y ceros por el eje de frecuencia: asíntotas de ±20 dB/década, la curva real, la fase y una senoide que atraviesa el filtro.',
    claves: 'bode polos ceros asíntotas decibelios década fase filtro paso bajo paso alto paso banda frecuencia de corte',
    libro: ['sec-25.3', 'fig-25.3', 'fig-25.4', 'sec-0.20', 'sec-25.4', 'fig-25.5', 'sec-25.7', 'sec-22.5', 'sec-0.10'],
    icono: 'bode',
  },
  {
    id: 'oscilador',
    titulo: 'Osciladores: Barkhausen y el arranque',
    area: 'analogica',
    resumen: 'Un puente de Wien que arranca desde el ruido, crece si la ganancia de lazo pasa de 1 y se estabiliza recortando, con diodos o con la lámpara de Hewlett.',
    claves: 'oscilador barkhausen puente de wien ganancia de lazo arranque estabilización amplitud lámpara diodos distorsión thd',
    libro: ['sec-28.1', 'fig-28.1', 'sec-28.4', 'fig-28.7', 'sec-28.7', 'fig-28.10'],
    icono: 'oscilador',
  },
  {
    id: 'ruido',
    titulo: 'Ruido térmico y suma en cuadratura',
    area: 'analogica',
    resumen: 'Las fuentes de ruido de una entrada, cómo se suman en potencia, la zona 1/f y la banda que se integra.',
    claves: 'ruido térmico johnson 4ktr densidad nv raíz hz 1/f flicker esquina suma en cuadratura ancho de banda gaussiana',
    libro: ['sec-32.2', 'fig-32.4', 'sec-32.3', 'fig-32.5', 'sec-32.5', 'fig-32.7', 'sec-32.1'],
    icono: 'ruido',
  },
  {
    id: 'pid',
    titulo: 'Control PID de un horno',
    area: 'analogica',
    resumen: 'Proporcional, integral y derivativo actuando sobre una planta con retardo; error permanente, windup y la sintonía de Ziegler–Nichols.',
    claves: 'pid control proporcional integral derivativo lazo cerrado ziegler nichols windup anti-windup retardo consigna horno',
    libro: ['sec-31.2', 'fig-31.3', 'fig-31.4', 'sec-31.3', 'fig-31.5', 'sec-31.11', 'fig-31.20', 'sec-31.5', 'fig-31.10', 'sec-31.1'],
    icono: 'pid',
  },
  // ------------------------------------------------------------------ power
  {
    id: 'fuente-lineal',
    titulo: 'Fuente lineal: rectificar, filtrar y regular',
    area: 'potencia',
    resumen: 'El puente y el condensador simulados con ngspice: rizado, pulsos de corriente, la caída mínima del regulador y lo que disipa.',
    claves: 'fuente de alimentación lineal rectificador puente condensador de filtro rizado regulador lm317 caída disipación red baja ngspice',
    libro: ['sec-50.5', 'fig-50.7', 'sec-50.6', 'sec-50.7', 'sec-5.6', 'sec-8.4', 'sec-3.8'],
    icono: 'fuente',
  },
  {
    id: 'conmutadas',
    titulo: 'Convertidores conmutados: buck, boost y buck-boost',
    area: 'potencia',
    resumen: 'El interruptor y el diodo en cámara lenta, la corriente triangular de la bobina, el ciclo de trabajo y el modo discontinuo.',
    claves: 'conmutada buck reductor boost elevador buck-boost ciclo de trabajo bobina rizado modo continuo discontinuo voltios segundo',
    libro: ['sec-33.2', 'fig-33.2', 'fig-28.6', 'sec-33.3', 'fig-33.3', 'sec-33.1', 'fig-33.1'],
    icono: 'conmutada',
  },
  {
    id: 'pwm',
    titulo: 'PWM: una onda cuadrada que se promedia',
    area: 'potencia',
    resumen: 'analogWrite(), el ciclo de trabajo, el filtro RC con su rizado y su retardo, y un LED y un motor que promedian solos.',
    claves: 'pwm modulación de anchura de pulso ciclo de trabajo analogwrite arduino filtro rc rizado motor led temporizador',
    libro: ['sec-17.5', 'fig-17.8', 'fig-17.9', 'sec-38.5', 'sec-15.5', 'sec-7.5'],
    icono: 'pwm',
  },
  // ------------------------------------------------------------------ digital logic and timing
  {
    id: 'niveles-logicos',
    titulo: 'Niveles lógicos y márgenes de ruido',
    area: 'digital',
    resumen: 'Lo que una salida garantiza frente a lo que una entrada exige: márgenes, la zona prohibida, 3,3 V contra 5 V y bits que se pierden con ruido.',
    claves: 'niveles lógicos voh vol vih vil margen de ruido ttl cmos hc hct lvcmos 3,3 v 5 v zona prohibida familias lógicas',
    libro: ['sec-9.7', 'fig-9.8', 'sec-9.2', 'fig-9.2', 'sec-9.8', 'fig-9.10', 'sec-C.3'],
    icono: 'niveles',
  },
  {
    id: 'glitch',
    titulo: 'Retardo de propagación y glitches',
    area: 'digital',
    resumen: 'Dos caminos de distinto retardo hasta la misma puerta: el pulso espurio que el álgebra no ve y que un contador sí cuenta.',
    claves: 'glitch azar hazard retardo de propagación puertas xor inversor consenso diagrama de tiempos camino crítico',
    libro: ['sec-29.3', 'fig-29.4', 'sec-9.7', 'sec-29.8', 'sec-9.3'],
    icono: 'glitch',
  },
  {
    id: 'metaestabilidad',
    titulo: 'Metaestabilidad y sincronizadores',
    area: 'digital',
    resumen: 'Un dato asíncrono que cae en la ventana de setup y hold, la salida que tarda en decidirse y el MTBF de uno, dos o tres biestables.',
    claves: 'metaestabilidad setup hold sincronizador dos biestables flip-flop mtbf dominio de reloj asíncrono tau',
    libro: ['sec-9.9', 'fig-9.11', 'fig-9.12', 'prob-29.B', 'sec-29.8', 'sec-37.17', 'sec-29.4'],
    icono: 'metaestabilidad',
  },
  // ------------------------------------------------------------------ lines, antennas and high frequency
  {
    id: 'reflexiones',
    titulo: 'Líneas de transmisión: ondas que rebotan',
    area: 'rf',
    resumen: 'Un escalón que recorre un metro de coaxial, se refleja en la carga y en la fuente, y lo que ve el osciloscopio en cada extremo.',
    claves: 'línea de transmisión reflexión coeficiente gamma impedancia característica terminación serie abierta cortocircuito tdr timbre integridad de señal',
    libro: ['sec-36.2', 'fig-36.2', 'sec-41.3', 'fig-41.4', 'fig-41.5', 'sec-36.1', 'fig-36.1', 'sec-41.1'],
    icono: 'reflexion',
  },
  {
    id: 'onda-estacionaria',
    titulo: 'Onda estacionaria, VSWR y la carta de Smith',
    area: 'rf',
    resumen: 'Incidente más reflejada en régimen senoidal: la envolvente, el VSWR, y el punto que gira en la carta de Smith al recorrer la línea.',
    claves: 'onda estacionaria vswr roe coeficiente de reflexión pérdida de retorno carta de smith cuarto de onda línea desadaptada',
    libro: ['sec-36.2', 'fig-36.3', 'sec-36.4', 'fig-36.5', 'sec-36.3', 'fig-36.4'],
    icono: 'estacionaria',
  },
  {
    id: 'adaptacion-smith',
    titulo: 'Redes de adaptación en la carta de Smith',
    area: 'rf',
    resumen: 'Una red en L como camino de dos tramos hasta el centro de la carta, sus valores a 100 MHz y el ancho de banda que impone el salto.',
    claves: 'adaptación de impedancias red en l carta de smith q ancho de banda bobina condensador serie paralelo 50 ohmios antena',
    libro: ['sec-36.5', 'fig-36.6', 'sec-36.4', 'fig-36.5', 'sec-23.9'],
    icono: 'smith',
  },
  {
    id: 'antena',
    titulo: 'Antenas: longitud de onda y radiación',
    area: 'rf',
    resumen: 'Un dipolo con su onda estacionaria de corriente, los frentes de onda que salen, el diagrama de radiación y la resistencia de radiación.',
    claves: 'antena dipolo longitud de onda lambda resistencia de radiación diagrama de radiación rendimiento cuarto de onda monopolo',
    libro: ['sec-36.8', 'fig-36.10', 'sec-31.4', 'sec-36.9'],
    icono: 'antena',
  },
  {
    id: 'efecto-pelicular',
    titulo: 'Efecto pelicular',
    area: 'rf',
    resumen: 'La corriente alterna se va a la superficie del hilo: profundidad de penetración, la densidad en la sección y la resistencia que sube.',
    claves: 'efecto pelicular skin profundidad de penetración delta resistencia en alterna litz cobre alta frecuencia',
    libro: ['sec-1.14', 'fig-1.16', 'sec-41.8', 'fig-41.12', 'sec-4.8', 'sec-33.14'],
    icono: 'pelicular',
  },
];

export function concepto(id: string): Concepto | undefined {
  return CONCEPTOS.find((c) => c.id === id);
}
