// 1.3 (averias13): the consoles whose lesson of faults has a fault with numbers («Consolas por dentro», card `averia`)
// and whose board carries the parts of that fault, each with the nets of its board where the lesson's measurements
// are taken (see modelo.ts). The values, the faults and their sources come from the lesson's published JSON; here only
// the board's nets (read from public/consolas/placas/<placa>.json) and their names in words.

import type { DefAveriaPlaca } from './modelo';

/**
 * Super Nintendo, «No enciende» (consola-snes/snes-averias, averia-no-enciende: the adapter SNS-002, the fuse F1 or
 * the 7805), on the PAL board of nonSNES (SNSP-CPU-01): J1 → T1 → DB1 → F1 → P3 (the switch) → U12 (7805) → VCC.
 */
const SNES: DefAveriaPlaca = {
  id: 'snes-no-enciende',
  maquina: 'snes',
  placa: 'snes',
  leccion: { parte: 'consola-snes', seccion: 'snes-averias', tarjeta: 'averia-no-enciende' },
  foto: { id: 'cara-a', lado: 'F' },
  sondas: {
    // «Clavija del adaptador»: between the two contacts of the jack J1
    clavija: { modo: 'V', redes: ['Net-(C30-Pad1)', 'Net-(C30-Pad2)'], sinSigno: true },
    // «Fusible F1, apagada»: across the fuse
    fusible: { modo: 'Ω', redes: ['Net-(DB1-+)', 'Net-(P3-Pin_2)'] },
    // «Salida del 7805»: the logic's 5 V against ground
    salida: { modo: 'V', redes: ['VCC', 'GND'] },
  },
  tensiones: {
    'Net-(DB1-+)': {
      expr: 'V_ad*ad',
      porque: 'La salida del puente, antes del fusible: el modelo de la lección lleva aquí la tensión del adaptador («El 7805 recibe los 10 V del adaptador», lección «La alimentación de la Super Nintendo»).',
    },
    'Net-(P3-Pin_2)': { expr: 'V_ad*ad*fu', porque: 'Después del fusible: con F1 abierto «no llegan los 10 V al 7805».' },
    'Net-(DA11-K)': { expr: 'V_ad*ad*fu', porque: 'La entrada del 7805, con el interruptor cerrado: si el averiado es él, «recibe la entrada pero no da sus 5 V».' },
  },
  nombres: {
    'Net-(C30-Pad1)': 'entrada del adaptador, en la toma J1',
    'Net-(C30-Pad2)': 'entrada del adaptador, en la toma J1',
    'Net-(C31-Pad1)': 'entrada del puente DB1, tras el filtro T1',
    'Net-(C31-Pad2)': 'entrada del puente DB1, tras el filtro T1',
    'Net-(DB1-+)': 'salida del puente DB1, antes del fusible',
    'Net-(P3-Pin_2)': 'entre el fusible F1 y el interruptor',
    'Net-(DA11-K)': 'entrada del 7805, tras el interruptor',
    VCC: '5 V de la lógica, salida del 7805',
    GND: 'masa',
  },
  puntos: [
    { pad: 'J1.1', rotulo: 'Toma J1, contacto 1' },
    { pad: 'J1.2', rotulo: 'Toma J1, contacto 2' },
    { pad: 'DB1.1', rotulo: 'Puente DB1, salida +' },
    { pad: 'DB1.3', rotulo: 'Puente DB1, salida − (masa)' },
    { pad: 'F1.1', rotulo: 'Fusible F1, lado del puente' },
    { pad: 'F1.2', rotulo: 'Fusible F1, lado del interruptor' },
    { pad: 'P3.2', rotulo: 'Conector del interruptor P3, del fusible' },
    { pad: 'P3.1', rotulo: 'Conector del interruptor P3, al 7805' },
    { pad: 'U12.1', rotulo: '7805 (U12), entrada' },
    { pad: 'U12.2', rotulo: '7805 (U12), masa' },
    { pad: 'U12.3', rotulo: '7805 (U12), salida' },
    { pad: 'C67.1', rotulo: 'Condensador C67, +' },
    { pad: 'C67.2', rotulo: 'Condensador C67, − (masa)' },
    { pad: 'U1.1', rotulo: 'CPU (U1), patilla 1: VCC' },
    { pad: 'U1.18', rotulo: 'CPU (U1), patilla 18: masa' },
  ],
  piezas: { adaptador: ['J1'], fusible: ['F1'], regulador: ['U12'] },
  encuadre: ['J1', 'T1', 'DB1', 'F1', 'C67', 'U12', 'P3'],
  notas: [
    'El modelo de la lección no cuenta la caída de tensión del puente DB1: en una placa real, después del puente se lee algo menos que en la clavija.',
    'La polaridad de la clavija no está en las fuentes de la aplicación (el puente DB1 acepta continua o alterna): entre los dos contactos de J1 se da el valor sin signo.',
  ],
};

/**
 * Master System II, «No enciende» (consola-sms/sms-averias, averia-no-enciende: the adapter, the switch or the 7805),
 * on the board reconstructed from its photos (171-5922A): CN4 → ferrite JV1 → SW1 → D2 → IC8 (the 7805, «Regulador
 * 7805» of the explorer) → VCC. No photo with the board's positions: only the 3D board.
 */
const SMS: DefAveriaPlaca = {
  id: 'sms-no-enciende',
  maquina: 'sms',
  placa: 'sms',
  leccion: { parte: 'consola-sms', seccion: 'sms-averias', tarjeta: 'averia-no-enciende' },
  sondas: {
    // «Clavija del adaptador»: the jack's two contacts (the return goes to ground through the ferrite JG1)
    clavija: { modo: 'V', redes: ['CN4-IN', 'CN4-RET'], sinSigno: true },
    // «Interruptor cerrado, desenchufada»: across SW1
    interruptor: { modo: 'Ω', redes: ['JV-SW', 'SW-D2'] },
    // «Salida del 7805»
    salida: { modo: 'V', redes: ['VCC', 'GND'] },
  },
  iguales: {
    'JV-SW': { como: 'CN4-IN', porque: 'La ferrita JV1 une la toma con el interruptor: en continua es un hilo.' },
    'CN4-RET': { como: 'GND', porque: 'La ferrita JG1 une el retorno de la toma con la masa: en continua es un hilo.' },
  },
  tensiones: {
    'SW-D2': { expr: 'V_ad*ad*sw', porque: 'Después del interruptor: si no cierra, «no llegan los 9 V al diodo y al 7805».' },
    VIN: { expr: 'V_ad*ad*sw', porque: 'La entrada del 7805, tras el diodo D2: si el averiado es él, «recibe la entrada pero no da sus 5 V».' },
  },
  nombres: {
    'CN4-IN': 'entrada del adaptador, en la toma CN4',
    'CN4-RET': 'retorno del adaptador, en la toma CN4',
    'JV-SW': 'entre la ferrita JV1 y el interruptor',
    'SW-D2': 'entre el interruptor y el diodo D2',
    VIN: 'entrada del 7805 (IC8), tras el diodo D2',
    VCC: '5 V de la lógica, salida del 7805',
    GND: 'masa',
  },
  puntos: [
    { pad: 'CN4.1', rotulo: 'Toma CN4, entrada' },
    { pad: 'CN4.2', rotulo: 'Toma CN4, retorno' },
    { pad: 'SW1.1', rotulo: 'Interruptor SW1, lado de la toma' },
    { pad: 'SW1.2', rotulo: 'Interruptor SW1, lado del diodo' },
    { pad: 'D2.1', rotulo: 'Diodo D2, lado del 7805' },
    { pad: 'IC8.1', rotulo: '7805 (IC8), entrada' },
    { pad: 'IC8.2', rotulo: '7805 (IC8), masa' },
    { pad: 'IC8.3', rotulo: '7805 (IC8), salida' },
  ],
  piezas: { adaptador: ['CN4'], interruptor: ['SW1'], regulador: ['IC8'] },
  encuadre: ['CN4', 'JV1', 'SW1', 'D2', 'IC8'],
  notas: [
    'El modelo de la lección no cuenta la caída del diodo D2: en una placa real, en la entrada del 7805 se lee algo menos que en la clavija.',
    'Entre los dos contactos de CN4 se da el valor sin signo: la placa reconstruida no dice cuál es el centro de la clavija.',
  ],
};

/**
 * NES, «Un condensador en corto» (consola-nes/nes-alimentacion, averia-vias: C15 on the +9 V rail or C16 on the
 * +5 V one), on the board of OpenTendo (NES-CPU-11). Only voltages: the lesson gives no resistance. No photo with
 * the board's positions: only the 3D board.
 */
const NES: DefAveriaPlaca = {
  id: 'nes-condensador-corto',
  maquina: 'nes',
  placa: 'nes',
  leccion: { parte: 'consola-nes', seccion: 'nes-alimentacion', tarjeta: 'averia-vias' },
  sondas: {
    // «+9 V en el modulador»: the rail of +9 V against ground (P3, the RF modulator's connector)
    modulador: { modo: 'V', redes: ['/+9V', '/GND'] },
    // «VCC en la CPU»: the rail of +5 V against ground (the RP2A03, U6)
    cpu: { modo: 'V', redes: ['/VCC', '/GND'] },
  },
  nombres: {
    '/+9V': 'vía de +9 V (modulador y audio)',
    '/VCC': 'vía de +5 V (VCC de los chips)',
    '/GND': 'masa',
  },
  puntos: [
    { pad: 'P3.4', rotulo: 'Modulador (P3), +9 V' },
    { pad: 'P3.3', rotulo: 'Modulador (P3), VCC' },
    { pad: 'P3.6', rotulo: 'Modulador (P3), masa' },
    { pad: 'P6.2', rotulo: 'Conector de alimentación P6, +9 V' },
    { pad: 'P6.3', rotulo: 'Conector de alimentación P6, +5 V' },
    { pad: 'C15.2', rotulo: 'Condensador C15, lado de +9 V' },
    { pad: 'C15.1', rotulo: 'Condensador C15, masa' },
    { pad: 'C16.2', rotulo: 'Condensador C16, lado de +5 V' },
    { pad: 'C16.1', rotulo: 'Condensador C16, masa' },
    { pad: 'U6.40', rotulo: 'CPU RP2A03 (U6), patilla 40: VCC' },
    { pad: 'U6.20', rotulo: 'CPU RP2A03 (U6), patilla 20: masa' },
  ],
  piezas: { c15: ['C15'], c16: ['C16'] },
  encuadre: ['C15', 'C16', 'P6'],
};

export const AVERIAS_PLACA: DefAveriaPlaca[] = [SNES, SMS, NES];

/** The fault definitions of a console (none: no fault mode). */
export function averiasDe(maquina: string): DefAveriaPlaca[] {
  return AVERIAS_PLACA.filter((d) => d.maquina === maquina);
}

export function averiaPorId(id: string): DefAveriaPlaca | null {
  return AVERIAS_PLACA.find((d) => d.id === id) ?? null;
}
