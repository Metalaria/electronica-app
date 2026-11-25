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

// 2.0 (n64ps1) ------------------------------------------------------------------------------------------------

/**
 * Nintendo 64, «Piloto encendido, sin imagen» (consola-n64/n64-averias, averia-sin-imagen: the supply's 12 V, the
 * 78M05 or the cartridge's CIC; N64brew «Non-Booting Troubleshooting»), on OpeN64's board (NUS-CPU-03). Its nets are
 * the PCB's: U13's input is +12V and its output +5V there (the OpeN64 schematic draws both on +3.3V).
 */
const N64: DefAveriaPlaca = {
  id: 'n64-sin-imagen',
  maquina: 'n64',
  placa: 'n64',
  leccion: { parte: 'consola-n64', seccion: 'n64-averias', tarjeta: 'averia-sin-imagen' },
  foto: { id: 'cpu04', lado: 'F' },
  sondas: {
    // «Entrada del 78M05»: the 12 V after the power switch, at U13's input
    entrada: { modo: 'V', redes: ['+12V', 'GND'] },
    // «Salida del 78M05»
    salida: { modo: 'V', redes: ['+5V', 'GND'] },
    // «Patilla 6 del PIF»: Cold Reset
    coldreset: { modo: 'V', redes: ['/CLDRES', 'GND'] },
  },
  tensiones: {
    '/+12V Pre-Switch': { expr: 'V_12*fu', porque: 'Los 12 V de la fuente antes del interruptor: «La fuente de la Nintendo 64 da dos tensiones: 3,3 V y 12 V».' },
    '+3.3V': { expr: 'V_33', porque: 'Los 3,3 V de la lógica, que llegan en las tres averías (el piloto luce).' },
    '/+3.3V Pre-Switch': { expr: 'V_33', porque: 'Los mismos 3,3 V de la fuente, antes del interruptor (encendida, el interruptor está cerrado).' },
  },
  nombres: {
    '/+12V Pre-Switch': '12 V de la fuente, antes del interruptor',
    '+12V': '12 V tras el interruptor: entrada del 78M05 y del AMP-NUS',
    '+5V': '5 V: salida del 78M05, al ENC-NUS y al Multi Out',
    '/+3.3V Pre-Switch': '3,3 V de la fuente, antes del interruptor',
    '+3.3V': '3,3 V de la lógica (RCP, CPU, RAM, PIF)',
    '/CLDRES': 'Cold Reset: patilla 6 del PIF',
    GND: 'masa',
  },
  puntos: [
    { pad: 'P4.6', rotulo: 'Conector de la fuente P4, 12 V' },
    { pad: 'P4.2', rotulo: 'Conector de la fuente P4, 3,3 V' },
    { pad: 'U13.1', rotulo: '78M05 (U13), entrada' },
    { pad: 'U13.2', rotulo: '78M05 (U13), masa' },
    { pad: 'U13.3', rotulo: '78M05 (U13), salida' },
    { pad: 'U5.4', rotulo: 'ENC-NUS (U5), patilla 4: VCC1' },
    { pad: 'U6.6', rotulo: 'PIF (U6), patilla 6: Cold Reset' },
    { pad: 'U6.28', rotulo: 'PIF (U6), patilla 28: 3,3 V' },
    { pad: 'U6.14', rotulo: 'PIF (U6), patilla 14: masa' },
  ],
  piezas: { fuente: ['P4'], regulador: ['U13'], cartucho: ['P6'] },
  encuadre: ['P4', 'SW1', 'U13', 'U6', 'P6'],
  notas: [
    'La fuente es un módulo aparte: aquí se mide su salida en el conector P4 y, tras el interruptor, en la entrada del 78M05.',
    'El esquema de OpeN64 dibuja la entrada y la salida del 78M05 en +3.3V; la placa (y esta vista) las lleva a +12V y +5V.',
  ],
};

/**
 * PlayStation, «Los mandos fallan» (consola-ps1/ps1-averias, averia-mandos: the fuse PS605 of the controllers' 3.3 V or
 * PS602 of their 8 V), on the PU-18 of xyzz/pu-18: CN602 (power supply) → PS605 → L106 → CN102.9 and
 * CN602 → PS602 → L104 → CN102.4 (the controller ports' flat cable).
 */
const PS1: DefAveriaPlaca = {
  id: 'ps1-mandos',
  maquina: 'ps1',
  placa: 'ps1',
  leccion: { parte: 'consola-ps1', seccion: 'ps1-averias', tarjeta: 'averia-mandos' },
  foto: { id: 'cara-a', lado: 'F' },
  sondas: {
    // «PS605, apagada»: across the fuse
    r605: { modo: 'Ω', redes: ['PWR_3.3v', 'Net-(L106-Pad1)'] },
    // «3,3 V en CN102»: pin 9 of the controllers' connector
    v33: { modo: 'V', redes: ['CTR_3.3v', 'GND'] },
    // «8 V en CN102»: pin 4
    v8: { modo: 'V', redes: ['/CONT_8v', 'GND'] },
  },
  iguales: {
    'Net-(L106-Pad1)': { como: 'CTR_3.3v', porque: 'Entre PS605 y CN102 solo está la ferrita L106.' },
    'EXT_8v': { como: '/CONT_8v', porque: 'Entre PS602 y CN102 solo está la ferrita L104.' },
    '/CONT_GND': { como: 'GND', porque: 'La masa de los mandos sale de la de la placa por la ferrita L105.' },
  },
  tensiones: {
    'PWR_3.3v': { expr: 'V_33', porque: 'Los 3,3 V de la fuente antes del fusible: «Llegan los 3,3 V y los 8 V de la fuente».' },
    'PWR_8v': { expr: 'V_8', porque: 'Los 8 V de la fuente antes del fusible: «Llegan los 3,3 V y los 8 V de la fuente».' },
  },
  nombres: {
    'PWR_3.3v': '3,3 V de la fuente, antes de PS605',
    'PWR_8v': '8 V de la fuente, antes de PS602',
    'Net-(L106-Pad1)': 'entre PS605 y la ferrita L106',
    'CTR_3.3v': '3,3 V de los mandos, patilla 9 de CN102',
    'EXT_8v': 'tras PS602: 8 V de los mandos (por L104) y del puerto paralelo (por L110)',
    '/CONT_8v': '8 V de los mandos, patilla 4 de CN102',
    '/CONT_GND': 'masa de los mandos, patilla 7 de CN102 (por L105)',
    GND: 'masa',
  },
  puntos: [
    { pad: 'CN602.3', rotulo: 'Conector de la fuente CN602, 3,3 V' },
    { pad: 'CN602.1', rotulo: 'Conector de la fuente CN602, 8 V' },
    { pad: 'CN602.2', rotulo: 'Conector de la fuente CN602, masa' },
    { pad: 'PS605.1', rotulo: 'Fusible PS605, lado de la fuente' },
    { pad: 'PS605.2', rotulo: 'Fusible PS605, lado de los mandos' },
    { pad: 'PS602.1', rotulo: 'Fusible PS602, lado de la fuente' },
    { pad: 'PS602.2', rotulo: 'Fusible PS602, lado de los mandos' },
    { pad: 'CN102.9', rotulo: 'Conector de los mandos CN102, patilla 9: 3,3 V' },
    { pad: 'CN102.4', rotulo: 'Conector de los mandos CN102, patilla 4: 8 V' },
    { pad: 'CN102.7', rotulo: 'Conector de los mandos CN102, patilla 7: masa' },
  ],
  piezas: { ps605: ['PS605'], ps602: ['PS602'] },
  encuadre: ['CN602', 'PS605', 'PS602', 'L104', 'L106', 'CN102'],
  notas: [
    'Las tensiones son las nominales de la fuente que da la lección; el modelo no cuenta la caída en las ferritas.',
    'PS602 también alimenta, por la ferrita L110, la red /CART_7.5v del puerto paralelo; la lección solo trata los mandos.',
  ],
};

/**
 * 2.0 (saturn20): Sega Saturn, «Piloto encendido, sin imagen» (consola-saturn/saturn-averias, averia-sin-imagen: the three
 * supply rails at CN3 and the 5 V regulator IC34 that feeds the PLL), on RGBeter's VA0.5 board: CN3 (+9V, VCC, LVCC)
 * and IC34 (+9V → AVCC1). No photo of this board: only the 3D board.
 */
const SATURN: DefAveriaPlaca = {
  id: 'saturn-sin-imagen',
  maquina: 'saturn',
  placa: 'saturn',
  leccion: { parte: 'consola-saturn', seccion: 'saturn-averias', tarjeta: 'averia-sin-imagen' },
  sondas: {
    'cn3-9': { modo: 'V', redes: ['+9V', 'GND'] },
    'cn3-5': { modo: 'V', redes: ['VCC', 'GND'] },
    'cn3-3': { modo: 'V', redes: ['LVCC', 'GND'] },
    ic34: { modo: 'V', redes: ['AVCC1', 'GND'] },
  },
  nombres: {
    '+9V': '+9 V de la fuente (unidad de CD y PLL), en CN3',
    VCC: '+5 V de la fuente (VCC, todos los chips salvo la SDRAM), en CN3',
    LVCC: '+3,3 V de la fuente (LVCC, la SDRAM), en CN3',
    AVCC1: 'salida de 5 V de IC34, que alimenta el PLL',
    GND: 'masa',
  },
  puntos: [
    { pad: 'CN3.6', rotulo: 'CN3, +9 V' },
    { pad: 'CN3.4', rotulo: 'CN3, +5 V (VCC)' },
    { pad: 'CN3.3', rotulo: 'CN3, +3,3 V (LVCC)' },
    { pad: 'CN3.1', rotulo: 'CN3, masa' },
    { pad: 'IC34.3', rotulo: 'Regulador IC34, entrada (+9 V)' },
    { pad: 'IC34.2', rotulo: 'Regulador IC34, masa' },
    { pad: 'IC34.1', rotulo: 'Regulador IC34, salida (AVCC1)' },
  ],
  piezas: { fuente: ['CN3'], regulador: ['IC34'] },
  encuadre: ['CN3', 'IC34', 'CE48'],
  notas: ['La placa es la reproducción de RGBeter de la VA0.5; la fuente interna no está en ella: sus tensiones se miden en CN3.'],
};

export const AVERIAS_PLACA: DefAveriaPlaca[] = [SNES, SMS, NES, N64, PS1, SATURN];

/** The fault definitions of a console (none: no fault mode). */
export function averiasDe(maquina: string): DefAveriaPlaca[] {
  return AVERIAS_PLACA.filter((d) => d.maquina === maquina);
}

export function averiaPorId(id: string): DefAveriaPlaca | null {
  return AVERIAS_PLACA.find((d) => d.id === id) ?? null;
}
