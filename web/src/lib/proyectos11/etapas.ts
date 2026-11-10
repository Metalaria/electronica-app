// 1.1 «Proyectos por etapas»: the stages of the four detailed projects (printed chapters 48–51; files cap49–cap52).
// Types and rules in tipos.ts. Everything a stage asks for comes from the book: the specification lines quote its
// numbers (with the section that gives them), the starting circuits are the book's netlists (complementos, the same
// ones the simulator lists) cut down to the block of the stage, and each reference design is the book's (or, where the
// book gives a requirement but no component values, a design that meets it, marked `delLibro: false`). The thresholds
// that the book states as «unos…» or «típicamente…» are turned into a range here; each one is listed with its source
// in ESQUEMA.md («Proyectos por etapas») for the owner's review.
//
// Printed numbers: the file cap50 is the printed chapter 49 (from cap15 on, printed = file − 1); the app shows the
// printed numbers (refs.json), these data use the files' labels.
//
// Not covered: printed chapter 47 (file cap48, «Proyectos de integración: cuatro diseños completos»): its four designs
// are the block maps of these same four projects, with no component values nor measurable specification of their own
// (its section 47.4 says so: «Un mapa no da los valores concretos de los componentes»); the app links it to the four
// staged projects instead. Within the projects, what is not a circuit to simulate is left out: the IoT station's energy
// budget (a calculation over a year of cycles), its firmware, MQTT and security; the supply's mains side and its
// safety; the amplifier's grounding and hum; the SDR's quadrature detector (its simulation takes minutes) and the
// digital processing.

import type { Etapa, Proyecto } from './tipos';

// ------------------------------------------------------------------ shared models

/** The supply's op-amps (fig-50.5.cir): gain 1e5, output clamped to its rails, 20 Ω output resistance. */
const OPA_FUENTE = `.subckt OPA inp inn out vp vn
B1 n1 0 V = (V(vp)+V(vn))/2 + (V(vp)-V(vn)-1)/2*tanh(1e5*V(inp,inn)/((V(vp)-V(vn)-1)/2))
RO n1 out 20
.ends`;

/** TIP142 (fig-50.5.cir): a Darlington with its internal 8 kΩ and 120 Ω resistors. */
const TIP142 = `.model QD1 NPN(Is=1e-13 Bf=80 Vaf=100 Ikf=0.5 Rb=10 Rc=0.5)
.model QD2 NPN(Is=1e-11 Bf=40 Vaf=100 Ikf=8 Rb=1 Re=0.02 Rc=0.05)
.subckt TIP142 c b e
Q1 c b m QD1
Q2 c m e QD2
R1 b m 8k
R2 m e 120
.ends`;

/** The OPA1678 of the SDR's baseband (banda_base.cir): one pole, 120 dB, GBW 16 MHz, 20 Ω out, its noise resistor. */
const OPA_SDR = `.subckt opamp inp inn out
Ren inp inq 1.22k
E1 a 0 inq inn 1
R1 a b 1k
C1 b 0 {1/(6.2832*1k*16)}
E2 c 0 b 0 1e6
Ro c out 20
.ends`;

/** The amplifier's power transistors (fig-51.6.cir, fig-51.10.cir, sec-51.7.cir). */
const TRANSISTORES_HIFI = `.model QPN NPN(IS=1e-12 BF=80 IKF=3 VAF=100 RB=1 RE=0.02 RC=0.05)
.model QPP PNP(IS=1e-12 BF=60 IKF=3 VAF=100 RB=1 RE=0.02 RC=0.05)`;

// ------------------------------------------------------------------ printed 48: the IoT station (cap49)

const IOT: Etapa[] = [
  {
    id: 'cap49-1',
    n: 1,
    titulo: 'El bus I²C: la resistencia de pull-up',
    objetivo: 'Elija la resistencia de pull-up de la línea SDA para que el bus funcione a 400 kHz con la capacidad de la placa, sin pasar de la corriente que admite el I²C.',
    especificacion: [
      'Tiempo de subida (del 30 al 70 %) de <strong>300 ns como máximo</strong>: el límite a 400 kHz.',
      'Corriente por línea con la línea baja de <strong>3 mA como máximo</strong>, la que admite el I²C.',
      'Capacidad del bus: unos <strong>50 pF</strong>, tres o cuatro sensores en unos centímetros de pista.',
    ],
    secciones: ['sec-49.6'],
    leccion: 'cap03/sec-3.2',
    modelo:
      'La línea se modela como en la netlist del libro (fig-49.10): el transistor de drenador abierto del maestro es un interruptor de 20 Ω, mandado por V<sub>G</sub>, que baja la línea durante 5 µs; la capacidad del bus es C<sub>BUS</sub>.',
    netlist: `* Estacion IoT, etapa 1: una linea del bus I2C con su pull-up
VDD vdd 0 DC 3.3
VG g 0 PULSE(0 1 1u 1n 1n 5u 10u)
RGG g 0 1meg
S1 sda 0 g 0 swod
.model swod SW(Vt=0.5 Vh=0.05 Ron=20 Roff=1e9)
RPU vdd sda 10k
CBUS sda 0 50p
`,
    control: `tran 2n 20u
meas tran ibaja FIND i(VDD) AT=4u
meas tran t30 WHEN v(sda)=0.99 RISE=1 FROM=6u
meas tran t70 WHEN v(sda)=2.31 RISE=1 FROM=6u
let tsub = t70 - t30
print tsub`,
    componentes: [
      {
        id: 'RPU',
        tipo: 'pieza',
        nombre: 'R<sub>PU</sub>',
        unidad: 'Ω',
        series: ['E12'],
        min: 100,
        max: 1e6,
        papel: 'Sube la línea a 3,3 V cuando nadie la baja; con C<sub>BUS</sub> fija la subida.',
        referencia: '4,7k',
        delLibro: true,
      },
    ],
    medidas: [
      { id: 'tsub', nombre: 'tiempo de subida (30–70 %)', unidad: 's' },
      { id: 'ibaja', nombre: 'corriente con la línea baja', unidad: 'A' },
    ],
    derivadas: (m) => ({ ibaja: Math.abs(m['ibaja'] ?? Number.NaN) }),
    condiciones: [
      {
        medida: 'tsub',
        max: 300e-9,
        texto: '300 ns como máximo',
        siAlta: 'la línea sube demasiado despacio (la constante de tiempo es R<sub>PU</sub>·C<sub>BUS</sub>): baje R<sub>PU</sub>',
      },
      {
        medida: 'ibaja',
        max: 3e-3,
        texto: '3 mA como máximo',
        siAlta: 'con la línea baja circulan 3,3 V / R<sub>PU</sub>, más de lo que admite el I²C: suba R<sub>PU</sub>',
      },
    ],
  },
  {
    id: 'cap49-2',
    n: 2,
    titulo: 'El micrófono: amplificación y referencia',
    objetivo: 'Dé al amplificador del electret su ganancia y móntelo sobre media alimentación, para que el convertidor vea la onda entera.',
    especificacion: [
      'Amplificación de <strong>40 a 60 dB</strong>, con un operacional de ruido bajo.',
      'Referencia a <strong>media alimentación</strong> (1,65 V con 3,3 V), porque la señal es bipolar y el convertidor solo admite tensiones positivas.',
      'Polarización del electret con 2,2 kΩ a 3,3 V.',
    ],
    secciones: ['sec-49.7'],
    leccion: 'cap02/sec-2.7',
    modelo:
      'Como en la netlist del libro (sec-49.7): el JFET del electret es una fuente de corriente de 0,3 mA más la señal de 1 Pa (6,3 mV sobre los 2,2 kΩ), y el operacional, un amplificador de ganancia 10⁵ con un polo a 10 Hz. Los condensadores de acoplo son los de esa netlist (el libro no los da).',
    netlist: `* Estacion IoT, etapa 2: el microfono de electret, su amplificador y la referencia
VDD vdd 0 DC 3.3
IJ mic 0 DC 0.3m AC 2.868u
RB vdd mic 2.2k
CC mic in 0.47u
RIN in ref 100k
RR1 vdd ref 100k
RR2 ref 0 22k
CR ref 0 10u
EOP oa 0 in inv 1e5
ROP oa opout 1k
COP opout 0 15.9u
EBUF amp 0 opout 0 1
RF amp inv 10k
RG inv rgc 1k
CG rgc ref 47u
`,
    control: `op
let vref = v(ref)
print vref
ac dec 20 100 10k
let gan = vdb(amp) - vdb(mic)
meas ac gdb FIND gan AT=1k`,
    componentes: [
      { id: 'RF', tipo: 'pieza', nombre: 'R<sub>F</sub>', unidad: 'Ω', series: ['E24'], min: 10, max: 10e6, papel: 'Realimentación: G = 1 + R<sub>F</sub>/R<sub>G</sub>.', referencia: '100k', delLibro: false },
      { id: 'RG', tipo: 'pieza', nombre: 'R<sub>G</sub>', unidad: 'Ω', series: ['E24'], min: 10, max: 10e6, papel: 'La otra mitad del divisor de la ganancia.', referencia: '1k', delLibro: false },
      { id: 'RR1', tipo: 'pieza', nombre: 'R<sub>R1</sub>', unidad: 'Ω', series: ['E24'], min: 1e3, max: 10e6, papel: 'Divisor de la referencia, del lado de 3,3 V.', referencia: '100k', delLibro: false },
      { id: 'RR2', tipo: 'pieza', nombre: 'R<sub>R2</sub>', unidad: 'Ω', series: ['E24'], min: 1e3, max: 10e6, papel: 'Divisor de la referencia, del lado de masa.', referencia: '100k', delLibro: false },
    ],
    medidas: [
      { id: 'gdb', nombre: 'ganancia a 1 kHz', unidad: 'dB' },
      { id: 'vref', nombre: 'tensión de referencia', unidad: 'V' },
    ],
    condiciones: [
      {
        medida: 'gdb',
        min: 40,
        max: 60,
        texto: 'de 40 a 60 dB',
        siBaja: 'falta ganancia (G = 1 + R<sub>F</sub>/R<sub>G</sub>; 40 dB son 100 veces): suba R<sub>F</sub> o baje R<sub>G</sub>',
        siAlta: 'sobra ganancia: baje R<sub>F</sub> o suba R<sub>G</sub>',
      },
      {
        medida: 'vref',
        min: 1.6,
        max: 1.7,
        texto: 'media alimentación, 1,65 V (± 0,05 V)',
        siBaja: 'la referencia queda por debajo de la mitad y el convertidor perdería los semiciclos negativos: R<sub>R1</sub> y R<sub>R2</sub> deben ser iguales (suba R<sub>R2</sub> o baje R<sub>R1</sub>)',
        siAlta: 'la referencia queda por encima de la mitad: R<sub>R1</sub> y R<sub>R2</sub> deben ser iguales (baje R<sub>R2</sub> o suba R<sub>R1</sub>)',
      },
    ],
  },
  {
    id: 'cap49-3',
    n: 3,
    titulo: 'El detector de nivel: la constante de tiempo',
    objetivo: 'Elija la R y la C del detector de pico para que su salida caiga con la constante de tiempo normalizada de la respuesta rápida.',
    especificacion: [
      'Detector de pico con diodo y RC: basta la envolvente, no hace falta digitalizar la onda.',
      'Constante de tiempo de <strong>125 ms</strong>, la de la respuesta rápida normalizada (la lenta es de 1 s).',
    ],
    secciones: ['sec-49.7'],
    leccion: 'cap05/sec-5.10',
    modelo:
      'La señal de prueba es un escalón de 1 V que dura 0,2 s, como un sonido que empieza y se corta; el diodo es el 1N4148 de la biblioteca. Son valores del modelo (el libro no los da): la constante de tiempo se mide en la caída, desde el final del escalón hasta que la salida baja al 36,8 %.',
    netlist: `* Estacion IoT, etapa 3: el detector de nivel de pico
VS sig 0 PULSE(0 1 0 1u 1u 0.2 10)
D1 sig env D1N4148
CD env 0 1u
RD env 0 10k
`,
    control: `tran 20u 1.5 0 20u
meas tran vpico FIND v(env) AT=0.2
let v37 = vpico*0.3679
meas tran tcae WHEN v(env)=v37 FALL=1 FROM=0.2
let tau = tcae - 0.2
print tau`,
    componentes: [
      { id: 'RD', tipo: 'pieza', nombre: 'R<sub>D</sub>', unidad: 'Ω', series: ['E12'], min: 100, max: 100e6, papel: 'Descarga el condensador cuando el sonido baja.', referencia: '120k', delLibro: false },
      { id: 'CD', tipo: 'pieza', nombre: 'C<sub>D</sub>', unidad: 'F', series: ['E12'], min: 1e-9, max: 1e-3, papel: 'Guarda el pico; con R<sub>D</sub>, τ = R<sub>D</sub>·C<sub>D</sub>.', referencia: '1µ', delLibro: false },
    ],
    medidas: [{ id: 'tau', nombre: 'constante de tiempo de la caída', unidad: 's' }],
    condiciones: [
      {
        medida: 'tau',
        min: 0.1125,
        max: 0.1375,
        texto: '125 ms (± 10 %)',
        siBaja: 'la salida cae demasiado deprisa (τ = R<sub>D</sub>·C<sub>D</sub>): suba R<sub>D</sub> o C<sub>D</sub>',
        siAlta: 'la salida cae demasiado despacio: baje R<sub>D</sub> o C<sub>D</sub>',
      },
    ],
  },
];

// ------------------------------------------------------------------ printed 49: the bench supply (cap50)

const FUENTE: Etapa[] = [
  {
    id: 'cap50-1',
    n: 1,
    titulo: 'El rectificador y el filtro',
    objetivo: 'Elija el secundario del transformador y el condensador de filtro para que el regulador tenga tensión de sobra incluso en el valle del rizado con la red baja, sin pasarse con la red alta.',
    especificacion: [
      'Salida de la fuente: hasta <strong>30 V a 3 A</strong>, con la red entre −10 % y +10 %.',
      'Con la red al −10 % y 3 A, el valle de la continua debe dejar unos 3 V sobre los 30 V para el transistor de paso: <strong>33 V como mínimo</strong>.',
      'Rizado de <strong>3 V como máximo</strong> a 3 A (C = I / (f·ΔV)).',
      'Con la red al +10 % y en vacío, <strong>48 V como máximo</strong>: la tensión que soportan el regulador y el condensador.',
    ],
    secciones: ['sec-50.9', 'sec-50.5'],
    leccion: 'cap05/sec-5.6',
    modelo:
      'Como en la netlist del libro (rectificador.cir): el secundario es una senoide de 50 Hz con 0,05 Ω en serie, el puente lleva diodos de varios amperios y la carga es una corriente constante. «Comprobar» simula la red nominal, al −10 % y al +10 % cambiando el parámetro <code>kred</code>.',
    netlist: `* Fuente de laboratorio, etapa 1: rectificador en puente y filtro
.param vsec=24 kred=1 icarga=3
.model DPTE D(Is=63n Rs=10m N=1.7 Cjo=50p)
VSEC a b SIN(0 {vsec*1.41421*kred} 50)
RT a a1 0.05
D1 a1 vcc DPTE
D2 b vcc DPTE
D3 neg a1 DPTE
D4 neg b DPTE
C1 vcc neg 4.7m
ICARGA vcc neg PWL(0 0 40m 0 80m {icarga})
RG neg 0 10k
RH b 0 10k
.options method=gear
`,
    control: `tran 20u 400m 0 20u
let vv = v(vcc) - v(neg)
meas tran vmin_nom MIN vv FROM=300m TO=400m
meas tran vmax_nom MAX vv FROM=300m TO=400m
let rizado = vmax_nom - vmin_nom
print rizado
alterparam kred=0.9
reset
tran 20u 400m 0 20u
let vv = v(vcc) - v(neg)
meas tran valle_baja MIN vv FROM=300m TO=400m
alterparam kred=1.1
alterparam icarga=1m
reset
tran 20u 400m 0 20u
let vv = v(vcc) - v(neg)
meas tran vacio_alta MAX vv FROM=300m TO=400m`,
    componentes: [
      {
        id: 'vsec',
        tipo: 'param',
        nombre: 'V<sub>sec</sub> (eficaz)',
        unidad: 'V',
        series: [],
        min: 5,
        max: 60,
        papel: 'Tensión eficaz del secundario a la red nominal (el parámetro <code>vsec</code> de las directivas).',
        referencia: '30',
        delLibro: true,
      },
      { id: 'C1', tipo: 'pieza', nombre: 'C<sub>1</sub>', unidad: 'F', series: ['E12'], min: 100e-6, max: 0.1, papel: 'Condensador de filtro: entrega la corriente entre los picos.', referencia: '10m', delLibro: true },
    ],
    medidas: [
      { id: 'valle_baja', nombre: 'valle con la red al −10 % y 3 A', unidad: 'V' },
      { id: 'rizado', nombre: 'rizado a 3 A', unidad: 'V' },
      { id: 'vacio_alta', nombre: 'tensión en vacío con la red al +10 %', unidad: 'V' },
    ],
    condiciones: [
      {
        medida: 'valle_baja',
        min: 33,
        texto: '33 V como mínimo',
        siBaja: 'con la red baja el regulador se quedaría sin caída en el valle: suba V<sub>sec</sub> (o, si el rizado es grande, C<sub>1</sub>). El cálculo se hace hacia atrás, desde el peor caso',
      },
      {
        medida: 'rizado',
        max: 3,
        texto: '3 V como máximo',
        siAlta: 'demasiado rizado (C = I / (f·ΔV), con f = 100 Hz): suba C<sub>1</sub>',
      },
      {
        medida: 'vacio_alta',
        max: 48,
        texto: '48 V como máximo',
        siAlta: 'con la red alta y en vacío la tensión se dispara, y con ella la disipación del peor caso: baje V<sub>sec</sub>',
      },
    ],
  },
  {
    id: 'cap50-2',
    n: 2,
    titulo: 'El lazo de tensión',
    objetivo: 'Elija el divisor de realimentación para que la consigna de 0 a 2,5 V del potenciómetro dé de 0 a 30 V, y compruebe la regulación de carga del lazo.',
    especificacion: [
      'Salida de <strong>0 a 30 V</strong> con la consigna de 0 a 2,5 V (la referencia TL431).',
      'Regulación de carga <strong>mejor del 0,1 %</strong> de vacío a plena carga.',
    ],
    secciones: ['sec-50.6', 'sec-50.4'],
    leccion: 'cap02/sec-2.7',
    modelo:
      'El esquema de la figura del libro (fig-50.5): TIP142 como elemento de paso, operacionales de ganancia 10⁵, shunt de 0,05 Ω y límite de corriente en 3 A. La entrada es la continua bruta del valle con la red baja (33,3 V). «Comprobar» mide con 100 Ω de carga, con 11 Ω (unos 2,7 A) y con la consigna a cero.',
    netlist: `* Fuente de laboratorio, etapa 2: el lazo de tension
.model D1N4148 D(Is=2.52n Rs=0.568 N=1.752 Cjo=4p Bv=100)
${TIP142}
${OPA_FUENTE}
VRAW raw 0 DC 33.3
VP pos 0 DC 45
VN neg 0 DC -5
VP1 p1 0 DC 2.5
VP2 p2 0 DC 2.5
RB raw base 1k
XQ1 raw base e TIP142
RS e out 0.05
ESNS isns 0 e out 16.6667
XAV p1 fb av pos neg OPA
XAI p2 isns ai pos neg OPA
D1 base av D1N4148
D2 base ai D1N4148
R1 out fb 10k
R2 fb 0 10k
D3 0 out D1N4148
RL out 0 100
`,
    control: `op
let vmax = v(out)
print vmax
alter RL resistance = 11
op
let vcarga = v(out)
print vcarga
alter RL resistance = 100
alter VP1 dc = 0
op
let vmin = v(out)
print vmin`,
    componentes: [
      { id: 'R1', tipo: 'pieza', nombre: 'R<sub>1</sub>', unidad: 'Ω', series: ['E24'], min: 100, max: 10e6, papel: 'Rama alta del divisor: V<sub>sal</sub> = V<sub>P1</sub>·(1 + R<sub>1</sub>/R<sub>2</sub>).', referencia: '22k', delLibro: true },
      { id: 'R2', tipo: 'pieza', nombre: 'R<sub>2</sub>', unidad: 'Ω', series: ['E24'], min: 100, max: 10e6, papel: 'Rama baja del divisor.', referencia: '2k', delLibro: true },
    ],
    medidas: [
      { id: 'vmax', nombre: 'salida con la consigna al máximo', unidad: 'V' },
      { id: 'regcarga', nombre: 'regulación de carga', unidad: '%' },
      { id: 'vmin', nombre: 'salida con la consigna a cero', unidad: 'V' },
    ],
    derivadas: (m) => ({ regcarga: (100 * ((m['vmax'] ?? Number.NaN) - (m['vcarga'] ?? Number.NaN))) / (m['vcarga'] ?? Number.NaN) }),
    condiciones: [
      {
        medida: 'vmax',
        min: 29.7,
        max: 30.3,
        texto: '30 V (± 1 %)',
        siBaja: 'el divisor da poca ganancia (con 2,5 V hay que multiplicar por 12): suba R<sub>1</sub> o baje R<sub>2</sub>',
        siAlta: 'el divisor da demasiada ganancia: baje R<sub>1</sub> o suba R<sub>2</sub>',
      },
      {
        medida: 'regcarga',
        max: 0.1,
        texto: 'mejor del 0,1 %',
        siAlta: 'la salida cae al cargarla: si la consigna da más de 30 V, a 2,7 A la entrada de 33,3 V ya no deja caída al transistor de paso (dropout); si no, compruebe que el divisor lleva la salida a la entrada − del amplificador de error',
      },
      { medida: 'vmin', max: 0.1, texto: 'unos 0 V (0,1 V como máximo)', siAlta: 'la salida no baja a cero con la consigna a cero: revise el divisor y su masa' },
    ],
  },
  {
    id: 'cap50-3',
    n: 3,
    titulo: 'El límite de corriente',
    objetivo: 'Elija la resistencia sensora para que el transistor limitador robe la corriente de base cuando la salida pase de 2 A.',
    especificacion: [
      'Limitar la corriente a <strong>unos 2 A</strong> (ejercicio {{num:ej-50.5}}): en cortocircuito, de 1,85 a 2,3 A.',
      'El lazo de límite actúa con un umbral de unos <strong>0,65 V</strong>, el V<sub>BE</sub> del transistor limitador.',
    ],
    secciones: ['sec-50.8'],
    leccion: 'cap06/sec-6.2',
    modelo:
      'El circuito de la netlist del ejercicio (ej-50.5): un seguidor con Darlington excitado por 4,7 kΩ desde 20 V, base fijada por un Zener de 12 V, y un transistor pequeño cuya base-emisor está en paralelo con R<sub>S</sub>. «Comprobar» cortocircuita la salida (0,01 Ω).',
    netlist: `* Fuente de laboratorio, etapa 3: el limite de corriente con un transistor
.model QPOW NPN(Is=1e-12 Bf=40 Vaf=100 Ikf=5 Rb=1 Re=0.02 Rc=0.05)
.model QDRV NPN(Is=1e-13 Bf=120 Vaf=100 Ikf=1 Rb=5)
.model QSIG NPN(Is=6.7f Bf=200 Vaf=74 Ikf=66m Rb=10)
.model DZ12 D(Is=1e-14 N=1 Bv=12 Ibv=5m Rs=2)
VIN in 0 DC 20
RB in b 4.7k
DZ 0 b DZ12
Q2 in b m QDRV
Q1 in m e QPOW
RS e out 1
QL b e out QSIG
RL out 0 10
`,
    control: `op
let vnormal = v(out)
print vnormal
alter RL resistance = 0.01
op
let icorto = v(out)/0.01
let prs = v(e,out)*v(e,out)
print icorto prs`,
    componentes: [
      { id: 'RS', tipo: 'pieza', nombre: 'R<sub>S</sub>', unidad: 'Ω', series: ['E12'], min: 0.01, max: 100, papel: 'Resistencia sensora: su caída, I·R<sub>S</sub>, abre el transistor limitador.', referencia: '0,33', delLibro: true },
    ],
    medidas: [
      { id: 'icorto', nombre: 'corriente en cortocircuito', unidad: 'A' },
      { id: 'prsw', nombre: 'potencia en R<sub>S</sub> en cortocircuito', unidad: 'W', informativa: true },
      { id: 'vnormal', nombre: 'salida con 10 Ω de carga', unidad: 'V', informativa: true },
    ],
    derivadas: (m, v) => ({ prsw: (m['prs'] ?? Number.NaN) / (v['RS'] ?? Number.NaN) }),
    condiciones: [
      {
        medida: 'icorto',
        min: 1.85,
        max: 2.3,
        texto: 'unos 2 A (de 1,85 a 2,3 A)',
        siBaja: 'limita demasiado pronto (R<sub>S</sub> = V<sub>umbral</sub> / I<sub>límite</sub>): baje R<sub>S</sub>',
        siAlta: 'deja pasar demasiada corriente: suba R<sub>S</sub>',
      },
    ],
  },
  {
    id: 'cap50-4',
    n: 4,
    titulo: 'El prerregulador y la disipación',
    objetivo: 'Elija cuánta caída deja el prerregulador sobre el transistor de paso: bastante para no entrar en dropout, poca para no disipar.',
    especificacion: [
      'Salida a 5 V y 3 A, el caso que más calienta una fuente lineal.',
      'Sin dropout: la salida debe seguir en <strong>5 V (4,95 V como mínimo)</strong>.',
      'Con el prerregulador, el elemento de paso disipa <strong>12 W como máximo</strong> (4 V × 3 A); sin él, más de 100 W.',
    ],
    secciones: ['sec-50.7', 'sec-50.3'],
    leccion: 'cap01/sec-1.8',
    modelo:
      'El esquema de la etapa 2 (fig-50.5) con el prerregulador como una fuente que sigue a la salida con la caída <code>margen</code> (como en la netlist fig-50.22). Consigna de 5 V, carga de 1,67 Ω (3 A) y límite en 3,3 A.',
    netlist: `* Fuente de laboratorio, etapa 4: el prerregulador y la disipacion
.param margen=8
.model D1N4148 D(Is=2.52n Rs=0.568 N=1.752 Cjo=4p Bv=100)
${TIP142}
${OPA_FUENTE}
BPRE raw 0 V = V(out) + {margen}
VP pos 0 DC 45
VN neg 0 DC -5
VP1 p1 0 DC 0.41667
VP2 p2 0 DC 2.75
RB raw base 1k
XQ1 raw base e TIP142
RS e out 0.05
ESNS isns 0 e out 16.6667
XAV p1 fb av pos neg OPA
XAI p2 isns ai pos neg OPA
D1 base av D1N4148
D2 base ai D1N4148
R1 out fb 22k
R2 fb 0 2k
D3 0 out D1N4148
RL out 0 1.6667
`,
    control: `op
let vsal = v(out)
let pq1 = (v(raw)-v(e))*v(out)/1.6667
print vsal pq1`,
    componentes: [
      {
        id: 'margen',
        tipo: 'param',
        nombre: 'Caída del prerregulador',
        unidad: 'V',
        series: [],
        min: 0.5,
        max: 30,
        papel: 'Lo que el prerregulador deja sobre el lineal (el parámetro <code>margen</code> de las directivas).',
        referencia: '4',
        delLibro: true,
      },
    ],
    medidas: [
      { id: 'vsal', nombre: 'salida', unidad: 'V' },
      { id: 'pq1', nombre: 'disipación en el transistor de paso', unidad: 'W' },
    ],
    condiciones: [
      {
        medida: 'vsal',
        min: 4.95,
        texto: '5 V (4,95 V como mínimo)',
        siBaja: 'el lineal entra en dropout: el TIP142 necesita dos V<sub>BE</sub> y la caída en R<sub>B</sub> para su base. Suba la caída del prerregulador',
      },
      {
        medida: 'pq1',
        max: 12,
        texto: '12 W como máximo',
        siAlta: 'el transistor disipa la caída por la corriente (P = (V<sub>ent</sub> − V<sub>sal</sub>)·I): baje la caída del prerregulador',
      },
    ],
  },
];

// ------------------------------------------------------------------ printed 50: the Hi-Fi amplifier (cap51)

const HIFI: Etapa[] = [
  {
    id: 'cap51-1',
    n: 1,
    titulo: 'El preamplificador',
    objetivo: 'Elija las resistencias del preamplificador no inversor A1 para su ganancia de 6 dB, y compruebe que con el tono al centro la respuesta queda plana.',
    especificacion: [
      'A1, no inversor: <strong>G = 1 + R<sub>F</sub>/R<sub>G</sub> = 2</strong> (6 dB), una ganancia modesta: repartirla mal satura etapas.',
      'Respuesta de 20 Hz a 20 kHz <strong>dentro de ± 0,5 dB</strong>.',
    ],
    secciones: ['sec-51.3', 'sec-51.2'],
    modelo:
      'El circuito de la figura del libro (fig-51.4) con el volumen al máximo y el tono Baxandall con los dos mandos al centro; los operacionales tienen ganancia 10⁵ y un polo a 10 Hz (1 MHz de producto ganancia-ancho de banda).',
    netlist: `* Amplificador Hi-Fi, etapa 1: el preamplificador A1 y el tono al centro
.subckt opamp inp inn out
E1 n1 0 inp inn 1e5
Rp n1 n2 1k
Cp n2 0 15.9u
E2 out 0 n2 0 1
.ends
.subckt baxa vin vout
R1 vin a 10k
RP1a a w 50k
RP1b w b 50k
C1 a w 22n
C2 w b 22n
R2 b vout 10k
R3 w inv 10k
C3 vin t1 2.2n
RP2a t1 tw 50k
RP2b tw t2 50k
C4 t2 vout 2.2n
Rtw tw inv 1m
XA2 0 inv vout opamp
.ends
VIN in 0 DC 0 AC 1
RVa in vol 1m
RVb vol 0 10k
XA1 vol fb pre opamp
RF pre fb 22k
RG fb 0 10k
XT pre sal baxa
RCARGA sal 0 10k
`,
    control: `ac dec 50 10 100k
let gpre = vdb(pre)
let gsal = vdb(sal)
meas ac gpre_1k FIND gpre AT=1k
meas ac gmax MAX gsal FROM=20 TO=20k
meas ac gmin MIN gsal FROM=20 TO=20k`,
    componentes: [
      { id: 'RF', tipo: 'pieza', nombre: 'R<sub>F</sub>', unidad: 'Ω', series: ['E12'], min: 100, max: 1e6, papel: 'Realimentación de A1.', referencia: '10k', delLibro: true },
      { id: 'RG', tipo: 'pieza', nombre: 'R<sub>G</sub>', unidad: 'Ω', series: ['E12'], min: 100, max: 1e6, papel: 'De la entrada − de A1 a masa.', referencia: '10k', delLibro: true },
    ],
    medidas: [
      { id: 'gpre_1k', nombre: 'ganancia de A1 a 1 kHz', unidad: 'dB' },
      { id: 'plano', nombre: 'variación de 20 Hz a 20 kHz', unidad: 'dB' },
    ],
    derivadas: (m) => ({ plano: (m['gmax'] ?? Number.NaN) - (m['gmin'] ?? Number.NaN) }),
    condiciones: [
      {
        medida: 'gpre_1k',
        min: 5.5,
        max: 6.5,
        texto: '6 dB (± 0,5 dB)',
        siBaja: 'A1 amplifica menos de 2 veces: suba R<sub>F</sub> o baje R<sub>G</sub> (R<sub>F</sub> = R<sub>G</sub> da G = 2)',
        siAlta: 'A1 amplifica más de 2 veces: baje R<sub>F</sub> o suba R<sub>G</sub> (R<sub>F</sub> = R<sub>G</sub> da G = 2)',
      },
      {
        medida: 'plano',
        max: 1,
        texto: '± 0,5 dB (1 dB de variación como máximo)',
        siAlta: 'la respuesta no es plana: con una ganancia tan alta el operacional se queda sin ancho de banda; baje la ganancia de A1',
      },
    ],
  },
  {
    id: 'cap51-2',
    n: 2,
    titulo: 'La polarización: el multiplicador de V<sub>BE</sub>',
    objetivo: 'Ajuste R<sub>1</sub> del multiplicador de V<sub>BE</sub> para dejar en la etapa de salida la corriente de reposo que quita la distorsión de cruce.',
    especificacion: [
      'Corriente de reposo objetivo de <strong>50 mA</strong>: 11 mV en cada resistencia de emisor de 0,22 Ω.',
      'Entre las bases, unos 1,2 V (dos caídas base-emisor): V<sub>bias</sub> = V<sub>BE</sub>·(1 + R<sub>1</sub>/R<sub>2</sub>).',
    ],
    secciones: ['sec-51.5', 'sec-51.4'],
    leccion: 'cap06/sec-6.10',
    modelo:
      'La etapa de la figura del libro (fig-51.6) a ±35 V sobre 8 Ω con la polarización de la figura {{num:fig-51.9}}: el multiplicador con R<sub>2</sub> = 1 kΩ, una fuente de 10 mA, el driver y la realimentación global ideal (netlist fig-51.10). R<sub>1</sub> es el ajuste: en la placa, un trimmer, así que vale cualquier valor; se acepta de 40 a 60 mA.',
    netlist: `* Amplificador Hi-Fi, etapa 2: la polarizacion con multiplicador de VBE
${TRANSISTORES_HIFI}
.model QVAS NPN(IS=1e-13 BF=120 VAF=100)
.model QBIAS NPN(IS=1e-13 BF=100 VAF=100)
VCC vcc 0 35
VEE vee 0 -35
I1 vcc a 10m
R1 a bq 680
R2 bq b 1k
QB a bq b QBIAS
Q1 vcc a e1 QPN
RE1 e1 out 0.22
Q2 vee b e2 QPP
RE2 e2 out 0.22
RL out 0 8
Q3 b b3 vee QVAS
RB3 err b3 10k
BERR err 0 V = -34.0 + 300*V(out)
`,
    control: `op
let vbias = v(a)-v(b)
let iq = (v(e1)-v(out))/0.22
let vre = v(e1)-v(out)
print vbias iq vre`,
    componentes: [
      { id: 'R1', tipo: 'pieza', nombre: 'R<sub>1</sub> (ajuste)', unidad: 'Ω', series: [], min: 100, max: 5e3, papel: 'Del colector a la base del multiplicador: fija cuántas V<sub>BE</sub> hay entre las bases.', referencia: '850', delLibro: false },
    ],
    medidas: [
      { id: 'iq', nombre: 'corriente de reposo', unidad: 'A' },
      { id: 'vre', nombre: 'caída en cada R<sub>E</sub>', unidad: 'V', informativa: true },
      { id: 'vbias', nombre: 'tensión entre las bases', unidad: 'V', informativa: true },
    ],
    condiciones: [
      {
        medida: 'iq',
        min: 0.04,
        max: 0.06,
        texto: '50 mA (de 40 a 60 mA)',
        siBaja: 'poca corriente de reposo: vuelve la distorsión de cruce. Suba R<sub>1</sub> (más tensión entre las bases)',
        siAlta: 'demasiada corriente de reposo: más calor y riesgo de embalamiento. Baje R<sub>1</sub>',
      },
    ],
  },
  {
    id: 'cap51-3',
    n: 3,
    titulo: 'Los raíles: potencia y disipación',
    objetivo: 'Elija la tensión de los raíles para dar 50 W sobre 8 Ω sin recortar, sin que cada transistor disipe más de lo que admite el diseño.',
    especificacion: [
      'Potencia: <strong>50 W sobre 8 Ω</strong> (28,3 V de pico); la etapa pierde unos 3 V.',
      'La disipación máxima por transistor, V²/(π²·R), ocurre con la salida al 64 % del raíl: con los 2 × 28 V del libro, <strong>hasta unos 19 W</strong>.',
    ],
    secciones: ['sec-51.7', 'sec-51.8'],
    modelo:
      'La etapa de salida de la netlist del libro (sec-51.7) con drivers ideales que no pasan de 1 V por debajo de cada raíl. «Comprobar» excita al máximo (recorte) para la potencia y con el 64 % del raíl para la disipación del NPN (la del PNP es igual).',
    netlist: `* Amplificador Hi-Fi, etapa 3: los railes, la potencia y la disipacion
.param vr=28 kexc=1
${TRANSISTORES_HIFI}
VCC vcc 0 {vr}
VEE vee 0 {-vr}
VIN in 0 DC 0 SIN(0 {kexc*vr} 1k)
RIN in 0 10k
BBN a 0 V = min(V(in) + 0.642, V(vcc) - 1)
BBP b 0 V = max(V(in) - 0.642, V(vee) + 1)
Q1 vcc a e1 QPN
RE1 e1 sal 0.22
Q2 vee b e2 QPP
RE2 e2 sal 0.22
RL sal 0 8
`,
    control: `tran 2u 4m 2m
let pl = v(sal)*v(sal)/8
meas tran pmax AVG pl FROM=2m TO=4m
alterparam kexc=0.637
reset
tran 2u 4m 2m
let pq1 = (v(vcc) - v(e1))*(v(e1)-v(sal))/0.22
meas tran pq1max AVG pq1 FROM=2m TO=4m`,
    componentes: [
      {
        id: 'vr',
        tipo: 'param',
        nombre: 'Tensión de cada raíl (± V)',
        unidad: 'V',
        series: [],
        min: 10,
        max: 70,
        papel: 'Los raíles simétricos de la etapa (el parámetro <code>vr</code> de las directivas).',
        referencia: '35',
        delLibro: true,
      },
    ],
    medidas: [
      { id: 'pmax', nombre: 'potencia máxima sobre 8 Ω', unidad: 'W' },
      { id: 'pq1max', nombre: 'disipación de un transistor al 64 %', unidad: 'W' },
    ],
    condiciones: [
      {
        medida: 'pmax',
        min: 50,
        texto: '50 W como mínimo',
        siBaja: 'la salida recorta antes de los 28,3 V de pico (P = (V − V<sub>sat</sub>)²/(2R)): suba los raíles',
      },
      {
        medida: 'pq1max',
        max: 19,
        texto: '19 W como máximo',
        siAlta: 'cada transistor disipa demasiado en el peor caso (crece con V²): baje los raíles',
      },
    ],
  },
];

// ------------------------------------------------------------------ printed 51: the SDR (cap52)

const SDR: Etapa[] = [
  {
    id: 'cap52-1',
    n: 1,
    titulo: 'El atenuador de entrada',
    objetivo: 'Calcule la red en π de 10 dB del atenuador de entrada, que debe atenuar sin desadaptar los 50 Ω de la antena y del preselector.',
    especificacion: [
      'Atenuación de <strong>10 dB</strong> (± 0,5 dB): la primera defensa contra la saturación.',
      'Entre <strong>50 Ω</strong>: la impedancia de entrada debe seguir en 50 Ω (± 5 Ω).',
    ],
    secciones: ['sec-new-52-frontend'],
    leccion: 'cap02/sec-2.9',
    modelo:
      'Un generador de 50 Ω (2 V de f.e.m.: 1 V sobre una carga adaptada) y la carga de 50 Ω del preselector, medidos a 7 MHz. Las resistencias de la placa del libro son de la serie E96; también valen las E24.',
    netlist: `* SDR, etapa 1: el atenuador en pi de 10 dB
VG gen 0 DC 0 AC 2
RGEN gen ent 50
RP1 ent 0 100
RS ent sal 150
RP2 sal 0 100
RCARGA sal 0 50
`,
    control: `ac dec 10 1meg 10meg
let at = db(v(sal))
let zin = mag(v(ent)/((v(gen)-v(ent))/50))
meas ac aten FIND at AT=7meg
meas ac zent FIND zin AT=7meg`,
    componentes: [
      { id: 'RP1', tipo: 'pieza', nombre: 'R<sub>P1</sub>', unidad: 'Ω', series: ['E24', 'E96'], min: 1, max: 100e3, papel: 'Rama en paralelo de la entrada.', referencia: '97,6', delLibro: true },
      { id: 'RS', tipo: 'pieza', nombre: 'R<sub>S</sub>', unidad: 'Ω', series: ['E24', 'E96'], min: 1, max: 100e3, papel: 'Rama serie: la que atenúa.', referencia: '71,5', delLibro: true },
      { id: 'RP2', tipo: 'pieza', nombre: 'R<sub>P2</sub>', unidad: 'Ω', series: ['E24', 'E96'], min: 1, max: 100e3, papel: 'Rama en paralelo de la salida.', referencia: '97,6', delLibro: true },
    ],
    medidas: [
      { id: 'atenuacion', nombre: 'atenuación', unidad: 'dB' },
      { id: 'zent', nombre: 'impedancia de entrada', unidad: 'Ω' },
    ],
    derivadas: (m) => ({ atenuacion: -(m['aten'] ?? Number.NaN) }),
    condiciones: [
      {
        medida: 'atenuacion',
        min: 9.5,
        max: 10.5,
        texto: '10 dB (± 0,5 dB)',
        // (review 11c: each hint says what its change does to the other condition, so the two never contradict each
        // other — 100/100/100 had read «suba R_P» here and «baje las ramas en paralelo» below; lowering R_S fixes both)
        siBaja: 'atenúa poco: suba R<sub>S</sub> (o baje las ramas en paralelo, que también bajan la impedancia)',
        siAlta: 'atenúa demasiado: baje R<sub>S</sub> (o suba las ramas en paralelo, que también suben la impedancia)',
      },
      {
        medida: 'zent',
        min: 45,
        max: 55,
        texto: '50 Ω (± 5 Ω)',
        siBaja: 'la entrada queda por debajo de 50 Ω: suba las ramas en paralelo (o R<sub>S</sub>, que también sube la atenuación)',
        siAlta: 'la entrada queda por encima de 50 Ω: baje las ramas en paralelo (o R<sub>S</sub>, que también baja la atenuación)',
      },
    ],
  },
  {
    id: 'cap52-2',
    n: 2,
    titulo: 'La ganancia de la banda base',
    objetivo: 'Elija R<sub>G</sub> del amplificador de instrumentación de dos operacionales para la ganancia de 31 del libro.',
    especificacion: [
      'G = 1 + R<sub>a</sub>/R<sub>b</sub> + 2R<sub>a</sub>/R<sub>G</sub> = <strong>31</strong> (unos 30 dB), con R<sub>a</sub> = 4,99 kΩ y R<sub>b</sub> = 499 Ω.',
      'Resistencias del 0,1 %: el rechazo de imagen depende de que I y Q tengan la misma ganancia.',
    ],
    secciones: ['sec-new-52-frontend'],
    modelo:
      'El amplificador de la netlist del libro (banda_base.cir): el OPA1678 como un polo (120 dB, 16 MHz). Se acepta la ganancia de 31 (29,8 dB) ± 0,25 dB, lo que el trimmer del canal Q puede igualar.',
    netlist: `* SDR, etapa 2: la ganancia del amplificador de instrumentacion
${OPA_SDR}
VREF vref 0 2.5
VCM cm 0 DC 2.5
VDP xp cm DC 0 AC 0.5
VDN xn cm DC 0 AC -0.5
XA xn n1 v1 opamp
RA1 n1 vref 4.99k
RB1 n1 v1 499
RB2 v1 n2 499
RA2 n2 ina 4.99k
RG n1 n2 1k
XB xp n2 ina opamp
`,
    control: `ac dec 10 100 10k
let g = db(v(ina))
meas ac gdb FIND g AT=1e3`,
    componentes: [
      { id: 'RG', tipo: 'pieza', nombre: 'R<sub>G</sub>', unidad: 'Ω', series: ['E96'], min: 10, max: 1e6, papel: 'Fija la ganancia: 2R<sub>a</sub>/R<sub>G</sub> son 20 de los 31.', referencia: '499', delLibro: true },
    ],
    medidas: [{ id: 'gdb', nombre: 'ganancia a 1 kHz', unidad: 'dB' }],
    condiciones: [
      {
        medida: 'gdb',
        min: 29.58,
        max: 30.08,
        texto: '31, 29,8 dB (± 0,25 dB)',
        siBaja: 'falta ganancia: baje R<sub>G</sub> (2R<sub>a</sub>/R<sub>G</sub> debe valer 20)',
        siAlta: 'sobra ganancia: suba R<sub>G</sub>',
      },
    ],
  },
  {
    id: 'cap52-3',
    n: 3,
    titulo: 'El filtro de la banda base',
    objetivo: 'Elija las resistencias del filtro Sallen-Key para no recortar la banda de 48 kHz y atenuar la fuga del oscilador a 7 MHz.',
    especificacion: [
      'Ancho de banda instantáneo de <strong>48 kHz</strong> (± 24 kHz): la banda base no debe caer 3 dB antes de 24 kHz.',
      'Atenuar la fuga del oscilador a 7 MHz: el libro da <strong>unos 70 dB</strong>; se pide −68 dB como máximo.',
      'Sallen-Key de ganancia unidad con condensadores de 2,2 nF y 1 nF.',
    ],
    secciones: ['sec-new-52-frontend'],
    leccion: 'cap03/sec-3.6',
    modelo:
      'La banda base completa de la netlist del libro (banda_base.cir): el amplificador de instrumentación de la etapa 2 con su R<sub>G</sub> de 499 Ω y, detrás, el Sallen-Key. Se mide la salida del filtro.',
    netlist: `* SDR, etapa 3: el filtro Sallen-Key de la banda base
${OPA_SDR}
VREF vref 0 2.5
VCM cm 0 DC 2.5
VDP xp cm DC 0 AC 0.5
VDN xn cm DC 0 AC -0.5
XA xn n1 v1 opamp
RA1 n1 vref 4.99k
RB1 n1 v1 499
RB2 v1 n2 499
RA2 n2 ina 4.99k
RG n1 n2 499
C35 n2 ina 220p
C48 n1 vref 220p
XB xp n2 ina opamp
R33 ina s1 10k
R34 s1 s2 10k
C42 s1 bb 2.2n
C43 s2 0 1n
XC s2 bb bb opamp
`,
    control: `ac dec 100 100 10meg
let g = db(v(bb))
meas ac g_1k FIND g AT=1e3
let g3 = g_1k - 3
meas ac f3db WHEN g=g3 FALL=1
meas ac fuga FIND g AT=7e6`,
    componentes: [
      { id: 'R33', tipo: 'pieza', nombre: 'R<sub>33</sub>', unidad: 'Ω', series: ['E96'], min: 10, max: 1e6, papel: 'Primera resistencia del filtro: con la otra y los condensadores fija f<sub>0</sub>.', referencia: '3,92k', delLibro: true },
      { id: 'R34', tipo: 'pieza', nombre: 'R<sub>34</sub>', unidad: 'Ω', series: ['E96'], min: 10, max: 1e6, papel: 'Segunda resistencia (igual a la primera en el libro).', referencia: '3,92k', delLibro: true },
    ],
    medidas: [
      { id: 'f3db', nombre: 'frecuencia de −3 dB', unidad: 'Hz' },
      { id: 'fuga', nombre: 'ganancia a 7 MHz (la fuga del oscilador)', unidad: 'dB' },
    ],
    condiciones: [
      {
        medida: 'f3db',
        min: 24e3,
        texto: '24 kHz como mínimo',
        siBaja: 'el filtro corta dentro de la banda (f<sub>0</sub> = 1 / (2π·R·√(C<sub>1</sub>C<sub>2</sub>))): baje las resistencias',
      },
      {
        medida: 'fuga',
        max: -68,
        texto: '−68 dB como máximo',
        siAlta: 'la fuga del oscilador pasa demasiado: el filtro corta muy arriba; suba las resistencias',
      },
    ],
  },
];

export const PROYECTOS: readonly Proyecto[] = [
  {
    parte: 'cap50',
    titulo: 'Fuente de alimentación de laboratorio',
    corto: 'Fuente de laboratorio',
    resumen: 'De la red a 0–30 V con límite de corriente: rectificador y filtro, lazo de tensión, límite y disipación.',
    placa: 'fuente_laboratorio/3d',
    etapas: FUENTE,
  },
  {
    parte: 'cap49',
    titulo: 'Estación de medida ambiental IoT',
    corto: 'Estación IoT',
    resumen: 'La electrónica alrededor del ESP32: el bus I²C, el micrófono y su detector de nivel.',
    placa: 'estacion_iot/3d',
    etapas: IOT,
  },
  {
    parte: 'cap51',
    titulo: 'Amplificador de audio Hi-Fi',
    corto: 'Amplificador Hi-Fi',
    resumen: 'Clase AB de 50 W: el preamplificador, la polarización de la etapa de salida y sus raíles.',
    placa: 'hifi-potencia/3d',
    etapas: HIFI,
  },
  {
    parte: 'cap52',
    titulo: 'Radio definida por software (SDR)',
    corto: 'Radio SDR',
    resumen: 'El front-end analógico: el atenuador de entrada y la banda base que llega a la tarjeta de sonido.',
    placa: 'sdr/3d',
    etapas: SDR,
  },
];

/** The project of a chapter (file id), or undefined. */
export const proyectoDe = (parte: string): Proyecto | undefined => PROYECTOS.find((p) => p.parte === parte);

/** A stage by its stable id («cap50-2»). */
export function etapaPorId(id: string): { proyecto: Proyecto; etapa: Etapa } | undefined {
  for (const proyecto of PROYECTOS) {
    const etapa = proyecto.etapas.find((e) => e.id === id);
    if (etapa) return { proyecto, etapa };
  }
  return undefined;
}

export { PARTE_INTEGRACION } from './indice';
