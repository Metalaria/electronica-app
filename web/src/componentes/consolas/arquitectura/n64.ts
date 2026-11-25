// Nintendo 64, NUS-CPU-03 NTSC (OpeN64 schematic): block diagram, physical address decoding and the timed
// scenarios. Written from the OpeN64 netlist (U10 VR4300, U9 RCP, U11/U14 RDRAM, U6 PIF, U4 VDC-NUS, U5 ENC-NUS,
// U1/U2 audio, U7/U15 MX8330) and these sources:
//   - Copetti, «Nintendo 64 Architecture»: CPU 93.75 MHz, RCP 62.5 MHz, RDRAM 4.5 MB on a 9-bit bus at 250 MHz (up to
//     500 MB/s), Jumper/Expansion Pak, boot at $BFC00000 (PIF ROM), CIC checked by the PIF, 44.1 kHz stereo 16-bit.
//   - Nintendo 64 Programming Manual 3.7 «Clock Speeds and Bus Bandwidth»: CPU 93.75 MHz, RCP 62.5 MHz, RDRAM 250 MHz,
//     AI 44.1 kHz, PI 20 MB/s peak and 5 MB/s from typical slow ROMs.
//   - N64brew: «Memory map» (physical map, KSEG0/KSEG1), «SysAD Interface» (32-bit multiplexed SysAD, 5-bit SysCmd,
//     EOK/PVALID/EVALID, everything at the 62.5 MHz MasterClock, the read and write sequences), «Peripheral Interface»
//     (16-bit multiplexed AD bus, ALEH ≥ 7 cycles, ALEL ≥ 14, LAT/PWD/RLS = 0x40/0x12/0x03 → 1040/304/64 ns),
//     «Joybus Protocol» (4 µs bits, 3 µs console stop bit, command 0x01 → 4 bytes), «Video Interface» (VI clock
//     measured 48.62 MHz NTSC / 49.56 MHz PAL, H_SYNC 3093/3177 quarter-pixels, V_SYNC 525/625 half-lines, VI
//     interrupt at VI_V_INTR).

import { Cronograma, hex, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';

interface Norma {
  id: 'ntsc' | 'pal';
  nombre: string;
  /** VI clock (n64brew, measured on the MX8330). */
  vi: number;
  /** H_SYNC + 1: line length in VI clock cycles. */
  hsync: number;
  /** V_SYNC + 1: half-lines per frame (non-interlaced). */
  medias: number;
}

const NORMAS: Record<'ntsc' | 'pal', Norma> = {
  ntsc: { id: 'ntsc', nombre: 'NTSC', vi: 48.62e6, hsync: 3094, medias: 525 },
  pal: { id: 'pal', nombre: 'PAL', vi: 49.56e6, hsync: 3178, medias: 625 },
};

const MCLK = 62.5e6;
const TM = 1 / MCLK; // 16 ns
const CPU = 93.75e6;
const RAMBUS = 250e6;

let N: Norma = NORMAS.ntsc;
function conNorma(f: (op: Opciones) => Escenario): (op: Opciones) => Escenario {
  return (op) => {
    N = op.norma === 'pal' ? NORMAS.pal : NORMAS.ntsc;
    return f(op);
  };
}

const coma = (x: number, d: number): string => x.toFixed(d).replace('.', ',');
const mhz = (f: number, d = 2): string => `${coma(f / 1e6, d)} MHz`;
const us = (t: number, d = 2): string => `${coma(t * 1e6, d)} µs`;

// ------------------------------------------------------------------ diagram

const base: Diagrama = {
  ancho: 1000,
  alto: 560,
  bloques: [
    { id: 'cart', x: 20, y: 14, w: 190, h: 70, titulo: 'Cartucho', sub: 'P5 (P6 en OpeN64) · bus PI', foto: 'cart', esquema: ['P6'], externo: true,
      actividad: [{ pista: 'RD' }, { pista: 'ALEL', nivel: 1 }],
      info: 'ROM (y a veces SRAM o EEPROM) en un bus de 16 bits que lleva direcciones y datos por los mismos hilos (CAD0–CAD15), con ALEH y ALEL para la dirección y /RD y /WR. Lleva también el CIC, que el PIF comprueba.' },
    { id: 'clk', x: 420, y: 14, w: 170, h: 56, titulo: 'Relojes', sub: 'U7, U15 · MX8330', foto: 'clk', esquema: ['U7', 'U15'],
      actividad: [{ pista: 'VCLK', nivel: 1 }],
      info: 'Dos generadores con su cristal: U7 da el reloj de vídeo al RCP y al VDC-NUS y la subportadora al ENC-NUS; U15 da el reloj del bus Rambus, que entra por el final del canal (CLKTOEND).' },
    { id: 'exp', x: 610, y: 14, w: 150, h: 56, titulo: 'Expansión', sub: 'P1 · Jumper Pak', foto: 'exp', esquema: ['P1'], externo: true,
      info: 'El bus Rambus termina aquí: el Jumper Pak lo cierra y el Expansion Pak añade 4,5 MB. Sin ninguno de los dos no hay imagen.' },
    { id: 'av', x: 800, y: 14, w: 180, h: 56, titulo: 'Multi Out', sub: 'P7 · Y/C, compuesto, audio', foto: 'av', esquema: ['P7'],
      info: 'Vídeo compuesto, S-vídeo, sincronismo, audio estéreo y 5 V. No lleva RGB.' },
    { id: 'cpu', x: 20, y: 150, w: 180, h: 110, titulo: 'CPU VR4300', sub: 'U10 · 93,75 MHz', foto: 'cpu', esquema: ['U10'],
      actividad: [{ pista: 'PVALID' }],
      info: 'MIPS de 64 bits a 93,75 MHz (1,5 × los 62,5 MHz del reloj maestro), con 16 KB de caché de instrucciones y 8 KB de datos. No tiene bus de memoria propio: todo lo pide al RCP por SysAD.' },
    { id: 'rcp', x: 300, y: 130, w: 250, h: 170, titulo: 'RCP', sub: 'U9 · RSP + RDP · 62,5 MHz', foto: 'rcp', esquema: ['U9'],
      actividad: [{ pista: 'EVALID' }, { pista: 'RD' }, { pista: 'VIINT' }],
      info: 'El RSP hace la geometría y el sonido con microcódigo; el RDP rasteriza. Además lleva todas las interfaces: la memoria (RI), el vídeo (VI), el audio (AI), el cartucho (PI) y el PIF (SI). Decide qué contesta a cada dirección de la CPU.' },
    { id: 'rdram', x: 620, y: 130, w: 160, h: 90, titulo: 'RDRAM 4 MB', sub: 'U14, U11 · Rambus de 9 bits', foto: 'rdram', esquema: ['U14', 'U11'],
      actividad: [{ pista: 'RAMBUS' }],
      info: 'Dos chips de 18 Mbit en un bus de 9 bits a 250 MHz que transfiere en los dos flancos (hasta 500 MB/s). El noveno bit es para el RDP; el resto de la consola ve 4 MB. Vterm la da el regulador U12.' },
    { id: 'vdc', x: 620, y: 250, w: 150, h: 60, titulo: 'VDC-NUS', sub: 'U4 · DAC de vídeo', foto: 'vdc', esquema: ['U4'],
      actividad: [{ pista: 'SRGB' }],
      info: 'Recibe el color por un bus de 7 bits multiplexado (SRGB0–SRGB6), 21 bits por punto, a cuatro veces el reloj de punto, y saca RGB analógico y sincronismo.' },
    { id: 'enc', x: 800, y: 250, w: 180, h: 60, titulo: 'ENC-NUS', sub: 'U5 · Y/C y compuesto', foto: 'enc', esquema: ['U5'],
      info: 'Convierte el RGB en luminancia, crominancia y compuesto con la subportadora de U7. Su patilla NT/PAL está a +5 V (NTSC).' },
    { id: 'audio', x: 620, y: 350, w: 180, h: 60, titulo: 'Audio', sub: 'U1 BU9480F · U2 AMP-NUS', foto: 'dac', esquema: ['U1', 'U2'],
      actividad: [{ pista: 'AUDLRCLK', nivel: 1 }],
      info: 'El RCP no tiene chip de sonido: el RSP mezcla y el AI manda las muestras en serie (AUDCLK, AUDDAT, AUDLRCLK) al DAC; el AMP-NUS, a 12 V, las lleva al Multi Out.' },
    { id: 'pif', x: 300, y: 400, w: 200, h: 70, titulo: 'PIF', sub: 'U6 · arranque, CIC, mandos', foto: 'pif', esquema: ['U6'],
      actividad: [{ pista: 'PCH' }, { pista: 'JOY' }],
      info: 'Tiene la ROM de arranque (IPL1, la CPU empieza en $BFC00000) y 64 bytes de RAM para hablar con el RCP; comprueba el CIC del cartucho al arrancar y durante el juego, maneja el reset y la NMI y habla con los cuatro mandos.' },
    { id: 'mandos', x: 20, y: 400, w: 200, h: 70, titulo: 'Mandos', sub: 'P2, P3 · U8 74LV125A', foto: 'mandos', esquema: ['P2', 'P3', 'U8'],
      actividad: [{ pista: 'JOY' }],
      info: 'Un hilo de datos por mando, en reposo alto. El PIF lo lee directamente y lo baja a través del 74LV125A; cada bit dura 4 µs.' },
    { id: 'alim', x: 820, y: 470, w: 160, h: 60, titulo: 'Alimentación', sub: 'P4, SW1 · 3,3 V y 12 V · U13 5 V', foto: 'alim', esquema: ['P4', 'SW1', 'U13'],
      info: 'La fuente da 3,3 V para casi todo y 12 V para el amplificador de audio; el 78M05 saca de los 12 V los 5 V del codificador de vídeo.' },
  ],
  conexiones: [
    { id: 'mclk', puntos: [[300, 165], [200, 165]], bits: 1, etiqueta: 'MasterClock', pos: [250, 158], clase: 'reloj', pista: 'MCLK', nivel: 1, red: '/MASTER_CLOCK' },
    { id: 'sysad', puntos: [[200, 200], [300, 200]], bits: 32, etiqueta: 'SysAD', pos: [250, 193], clase: 'bus', pista: 'SYSAD', valor: true, red: '/SysAD0' },
    { id: 'syscmd', puntos: [[200, 225], [300, 225]], bits: 5, etiqueta: 'SysCmd', pos: [250, 218], clase: 'control', pista: 'SYSCMD', valor: true, red: '/SysCmd0' },
    { id: 'valid', puntos: [[200, 245], [300, 245]], bits: 3, etiqueta: 'PVALID, EVALID, EOK', pos: [250, 256], clase: 'control', pista: 'PVALID', nivel: 0, red: '/PVALID' },
    { id: 'int', puntos: [[300, 285], [230, 285], [230, 255], [200, 255]], bits: 1, etiqueta: 'INT0', pos: [262, 278], clase: 'interrupcion', pista: 'VIINT', nivel: 1, red: '/INT0*' },
    { id: 'rambus', puntos: [[550, 175], [620, 175]], bits: 9, etiqueta: 'BUSD0–8', pos: [585, 168], clase: 'bus', pista: 'RAMBUS', valor: true, red: '/RBD0' },
    { id: 'rambus-exp', puntos: [[685, 130], [685, 70]], bits: 9, etiqueta: '', clase: 'bus', pista: 'RAMBUS', red: '/RBD0' },
    { id: 'rclk', puntos: [[590, 42], [610, 42]], bits: 1, etiqueta: 'CLKTOEND', pos: [600, 92], clase: 'reloj', pista: 'RCLK', nivel: 1, red: '/CLKTOEND' },
    { id: 'vclk', puntos: [[440, 70], [440, 130]], bits: 1, etiqueta: 'VCLK', pos: [462, 100], clase: 'reloj', pista: 'VCLK', nivel: 1, red: '/FSO{slash}5' },
    { id: 'tclk', puntos: [[500, 70], [500, 114], [790, 114], [790, 265], [770, 265]], bits: 1, etiqueta: 'TCLK', pos: [790, 238], clase: 'reloj', pista: 'VCLK', nivel: 1, red: '/TCLK' },
    { id: 'cad', puntos: [[330, 130], [330, 110], [115, 110], [115, 84]], bits: 16, etiqueta: 'CAD0–15', pos: [200, 104], clase: 'bus', pista: 'CAD', valor: true, red: '/CAD0' },
    { id: 'ale', puntos: [[360, 130], [360, 96], [170, 96], [170, 84]], bits: 4, etiqueta: 'ALEH, ALEL, /RD, /WR', pos: [270, 90], clase: 'control', pista: 'RD', nivel: 0, red: '/CALEH' },
    { id: 'srgb', puntos: [[550, 280], [620, 280]], bits: 7, etiqueta: 'SRGB0–6', pos: [585, 273], clase: 'dato', pista: 'SRGB', valor: true, red: '/SRGB0' },
    { id: 'rgb', puntos: [[770, 280], [800, 280]], bits: 4, etiqueta: 'RGB', pos: [785, 300], clase: 'dato', red: '/RIN' },
    { id: 'yc', puntos: [[890, 250], [890, 70]], bits: 3, etiqueta: 'Y, C, vídeo', pos: [920, 160], clase: 'dato', red: '/YOUT' },
    { id: 'i2s', puntos: [[550, 380], [620, 380]], bits: 3, etiqueta: 'AUDCLK, AUDDAT, LRCLK', pos: [585, 398], clase: 'dato', pista: 'AUDDAT', valor: true, red: '/AUDDAT' },
    { id: 'lr', puntos: [[800, 380], [950, 380], [950, 70]], bits: 2, etiqueta: 'L, R', pos: [962, 330], clase: 'dato', red: '/AUDIO_L' },
    { id: 'pch', puntos: [[420, 300], [420, 400]], bits: 3, etiqueta: 'PCHCLK, PCHCMD, PCHRSP', pos: [480, 350], clase: 'control', pista: 'PCH', valor: true, red: '/PCHCMD' },
    { id: 'joy', puntos: [[300, 440], [220, 440]], bits: 4, etiqueta: 'JOY0–3', pos: [260, 433], clase: 'control', pista: 'JOY', valor: true, red: '/1Y' },
    { id: 'cic', puntos: [[300, 420], [260, 420], [260, 60], [210, 60]], bits: 3, etiqueta: 'SECCLK, SEC1, SEC2', pos: [262, 330], clase: 'control', pista: 'CIC', red: '/SECCLK' },
    { id: 'nmi', puntos: [[340, 400], [340, 360], [110, 360], [110, 260]], bits: 2, etiqueta: 'NMI, reset', pos: [180, 354], clase: 'interrupcion', pista: 'NMI', nivel: 0, red: '/NMI' },
  ],
};

const diagramas = new Map<string, Diagrama>();

function diagramaDe(id: string): Diagrama {
  const n = id === 'pal' ? NORMAS.pal : NORMAS.ntsc;
  let d = diagramas.get(n.id);
  if (!d) {
    d = {
      ...base,
      bloques: base.bloques.map((b) =>
        b.id === 'clk'
          ? { ...b, sub: `U7, U15 · vídeo ${mhz(n.vi)}`, info: n.id === 'ntsc' ? b.info : `${b.info} En las PAL, otro reloj de vídeo (49,56 MHz medidos) y otra velocidad del bus de la RAM (BitBuilt): la patilla FSEL del MX8330 elige la frecuencia.` }
          : b.id === 'enc' && n.id === 'pal'
            ? { ...b, titulo: 'Codificador PAL', sub: 'DENC-NUS en la PAL normal', info: 'Según BitBuilt, la placa PAL normal lleva un solo chip, el DENC-NUS, en lugar del VDC-NUS y el ENC-NUS de esta placa NTSC, y no saca RGB.' }
            : b,
      ),
    };
    diagramas.set(n.id, d);
  }
  return d;
}

// ------------------------------------------------------------------ decoding (n64brew «Memory map»)

interface Region {
  ini: number;
  fin: number;
  zona: string;
  bloque: string | null;
  bus: 'ri' | 'rsp' | 'rdp' | 'mi' | 'vi' | 'ai' | 'pi' | 'si' | 'cart' | 'pif' | null;
  texto: string;
}

const MAPA: Region[] = [
  { ini: 0x00000000, fin: 0x03efffff, zona: 'RDRAM', bloque: 'rdram', bus: 'ri', texto: 'La memoria principal: el RCP la pide a la RDRAM por el bus Rambus (RI). Con 4 MB solo existen las direcciones hasta $003FFFFF; con el Expansion Pak, hasta $007FFFFF.' },
  { ini: 0x03f00000, fin: 0x03ffffff, zona: 'Registros de la RDRAM', bloque: 'rdram', bus: 'ri', texto: 'La configuración de cada chip RDRAM (y, desde $03F80000, la escritura a todos a la vez).' },
  { ini: 0x04000000, fin: 0x04001fff, zona: 'RSP: DMEM e IMEM', bloque: 'rcp', bus: 'rsp', texto: '4 KB de datos ($04000000) y 4 KB de instrucciones ($04001000) del RSP, dentro del RCP; se repiten cada 8 KB hasta $0403FFFF.' },
  { ini: 0x04002000, fin: 0x0403ffff, zona: 'RSP: espejos de DMEM e IMEM', bloque: 'rcp', bus: 'rsp', texto: 'Las mismas DMEM e IMEM, repetidas cada 8 KB.' },
  { ini: 0x04040000, fin: 0x040fffff, zona: 'Registros del RSP', bloque: 'rcp', bus: 'rsp', texto: 'DMA, estado, semáforo y contador de programa del RSP.' },
  { ini: 0x04100000, fin: 0x042fffff, zona: 'Registros del RDP', bloque: 'rcp', bus: 'rdp', texto: 'Órdenes del rasterizador (DMA de la lista de órdenes, reloj, ocupado) y su prueba.' },
  { ini: 0x04300000, fin: 0x043fffff, zona: 'MI (interfaz MIPS)', bloque: 'rcp', bus: 'mi', texto: 'Modo, versión del RCP y las interrupciones y sus máscaras: todas llegan a la CPU por INT0.' },
  { ini: 0x04400000, fin: 0x044fffff, zona: 'VI (interfaz de vídeo)', bloque: 'rcp', bus: 'vi', texto: 'El vídeo: dónde está el cuadro en la RDRAM (VI_ORIGIN), 16 o 32 bits por punto, la línea de la interrupción y la temporización. Saca los puntos por SRGB0–6 al VDC-NUS.' },
  { ini: 0x04500000, fin: 0x045fffff, zona: 'AI (interfaz de audio)', bloque: 'audio', bus: 'ai', texto: 'DMA de las muestras desde la RDRAM y el divisor del reloj del DAC. Sale por AUDCLK, AUDDAT y AUDLRCLK.' },
  { ini: 0x04600000, fin: 0x046fffff, zona: 'PI (interfaz del cartucho)', bloque: 'rcp', bus: 'pi', texto: 'DMA entre el cartucho y la RDRAM, estado y los tiempos de cada dominio (LAT, PWD, PGS, RLS).' },
  { ini: 0x04700000, fin: 0x047fffff, zona: 'RI (interfaz de la RDRAM)', bloque: 'rcp', bus: 'ri', texto: 'Modo, refresco y latencia del bus Rambus.' },
  { ini: 0x04800000, fin: 0x048fffff, zona: 'SI (interfaz serie)', bloque: 'pif', bus: 'si', texto: 'DMA con la RAM del PIF por los tres hilos PCHCLK, PCHCMD y PCHRSP: así se leen los mandos.' },
  { ini: 0x04900000, fin: 0x04ffffff, zona: 'Sin usar', bloque: null, bus: null, texto: 'Zona del RCP sin dispositivo.' },
  { ini: 0x05000000, fin: 0x05ffffff, zona: 'Cartucho, dominio 2, dirección 1', bloque: 'cart', bus: 'cart', texto: 'Registros del 64DD si está. Sale por el bus del cartucho.' },
  { ini: 0x06000000, fin: 0x07ffffff, zona: 'Cartucho, dominio 1, dirección 1', bloque: 'cart', bus: 'cart', texto: 'ROM de arranque del 64DD si está.' },
  { ini: 0x08000000, fin: 0x0fffffff, zona: 'Cartucho, dominio 2, dirección 2', bloque: 'cart', bus: 'cart', texto: 'La SRAM del cartucho, si la lleva.' },
  { ini: 0x10000000, fin: 0x1fbfffff, zona: 'ROM del cartucho (dominio 1, dirección 2)', bloque: 'cart', bus: 'cart', texto: 'La ROM del juego: el RCP saca la dirección por CAD0–CAD15 en dos mitades (ALEH, ALEL) y lee palabras de 16 bits con /RD.' },
  { ini: 0x1fc00000, fin: 0x1fc007bf, zona: 'ROM del PIF (IPL1/IPL2)', bloque: 'pif', bus: 'pif', texto: '1984 bytes de arranque dentro del PIF; la CPU empieza aquí ($BFC00000 en KSEG1). Se lee por la interfaz serie.' },
  { ini: 0x1fc007c0, fin: 0x1fc007ff, zona: 'RAM del PIF', bloque: 'pif', bus: 'pif', texto: '64 bytes para hablar con los mandos y la EEPROM, y para los datos de arranque.' },
  { ini: 0x1fc00800, fin: 0x1fcfffff, zona: 'Reservado (PIF)', bloque: null, bus: null, texto: 'Uso desconocido.' },
  { ini: 0x1fd00000, fin: 0x7fffffff, zona: 'Cartucho, dominio 1, dirección 3', bloque: 'cart', bus: 'cart', texto: 'Se lleva a la misma dirección del bus del cartucho; no tiene un uso conocido.' },
];

export function decodificar(dir: number, escritura: boolean): Decodificacion {
  const v = dir >>> 0;
  let fis = v;
  let seg = '';
  if (v >= 0x80000000 && v < 0xa0000000) {
    fis = v - 0x80000000;
    seg = 'KSEG0 (con caché)';
  } else if (v >= 0xa0000000 && v < 0xc0000000) {
    fis = v - 0xa0000000;
    seg = 'KSEG1 (sin caché)';
  }
  const fuera = v >= 0xc0000000;
  const r = fuera ? null : MAPA.find((x) => fis >= x.ini && fis <= x.fin) ?? null;
  const tabla = [
    { etiqueta: 'RDRAM (RI, bus Rambus)', activa: r?.bus === 'ri' },
    { etiqueta: 'Dentro del RCP (RSP, RDP, MI, VI, AI, PI)', activa: !!r && ['rsp', 'rdp', 'mi', 'vi', 'ai', 'pi'].includes(r.bus ?? '') },
    { etiqueta: 'Bus del cartucho (CAD0–15, ALEH, ALEL)', activa: r?.bus === 'cart' },
    { etiqueta: 'PIF (SI: PCHCLK, PCHCMD, PCHRSP)', activa: r?.bus === 'pif' || r?.bus === 'si' },
    { etiqueta: seg ? `Segmento ${seg}: dirección física ${hex(fis, 8)}` : 'Dirección física (KUSEG: pasaría por la TLB)', activa: !!seg },
  ].map((x) => ({ ...x, valor: x.activa ? 'activa' : '' }));
  const texto = fuera
    ? 'Por encima de $BFFFFFFF (KSEG2 y siguientes) la dirección pasa por la TLB de la CPU; el RCP no contesta a nada de $80000000 en adelante.'
    : r
      ? `${seg ? `${seg}: la CPU resta la base del segmento y pide ${hex(fis, 8)} al RCP por SysAD. ` : ''}${r.texto}`
      : 'Zona sin dispositivo.';
  return { direccion: v, escritura, tabla, zona: r?.zona ?? (fuera ? 'Fuera de KSEG0/KSEG1' : 'Sin dispositivo'),
    seleccion: r?.bus ? r.bus.toUpperCase() : null, bloque: r?.bloque ?? null, texto, espejo: seg ? hex(fis, 8) : undefined };
}

// ------------------------------------------------------------------ SysAD: one write and one read (n64brew)

function senalesSysAD(c: Cronograma): void {
  c.bit('MCLK', 'MasterClock 62,5 MHz', 1)
    .bus('SYSAD', 'SysAD31–0')
    .bus('SYSCMD', 'SysCmd4–0')
    .bit('PVALID', '/PVALID (CPU)', 1, 'La CPU pone una orden válida')
    .bit('EVALID', '/EVALID (RCP)', 1, 'El RCP pone datos válidos')
    .bit('EOK', '/EOK (RCP)', 0, 'Bajo: el RCP acepta una orden')
    .bus('RCP', 'RCP');
}

function escenarioSysAD(op: Opciones): Escenario {
  const espera = Number(op.espera ?? '16');
  const c = new Cronograma();
  senalesSysAD(c);
  let t = 0;
  // write: uncached 32-bit write to VI_ORIGIN
  c.marca(t);
  c.set('SYSAD', t, '$A4400004');
  c.set('SYSCMD', t, 'escribir 32');
  c.set('PVALID', t, 0);
  c.set('RCP', t, 'acepta la orden');
  c.paso(t, t + TM, 'Escritura sin caché en $A4400004 (VI_ORIGIN): con /EOK bajo, la CPU pone la dirección en SysAD, la orden en SysCmd y baja /PVALID.');
  t += TM;
  c.set('EOK', t, 1);
  c.set('SYSAD', t, '$00100000');
  c.set('SYSCMD', t, 'dato');
  c.paso(t, t + TM, 'El RCP sube /EOK; en el ciclo siguiente la CPU pone el dato, $00100000 (el cuadro empezará en ese byte de la RDRAM).');
  t += TM;
  c.set('PVALID', t, 1);
  c.set('SYSAD', t, null);
  c.set('SYSCMD', t, null);
  c.set('RCP', t, 'escribe VI_ORIGIN');
  c.paso(t, t + 3 * TM, 'La CPU sube /PVALID: la escritura ha terminado. /EOK sigue alto mientras el RCP la procesa y vuelve a bajar.');
  t += 3 * TM;
  c.set('EOK', t, 0);
  c.set('RCP', t, null);
  t += 2 * TM;
  // read: uncached 32-bit read from RDRAM
  c.marca(t);
  c.set('SYSAD', t, '$A0000100');
  c.set('SYSCMD', t, 'leer 32');
  c.set('PVALID', t, 0);
  c.set('RCP', t, 'pide a la RDRAM');
  c.paso(t, t + TM, 'Lectura sin caché en $A0000100 (RDRAM): dirección, orden de lectura y /PVALID bajo.');
  t += TM;
  c.set('PVALID', t, 1);
  c.paso(t, t + espera * TM, `La CPU mantiene dirección y orden y espera. El RCP va a buscar la palabra a la RDRAM: ${espera} ciclos de 16 ns en este ejemplo.`);
  t += espera * TM;
  c.marca(t);
  c.set('SYSAD', t, '$3C1A8000');
  c.set('SYSCMD', t, 'fin del dato');
  c.set('EVALID', t, 0);
  c.set('RCP', t, 'contesta');
  c.paso(t, t + TM, 'El RCP baja /EVALID y pone el dato y la orden «fin del dato»; la CPU, que ha soltado el bus, los toma.');
  t += TM;
  c.set('EVALID', t, 1);
  c.set('SYSAD', t, null);
  c.set('SYSCMD', t, null);
  c.set('RCP', t, null);
  t += 2 * TM;
  c.reloj('MCLK', 0, t, TM);
  c.marca(t);
  return {
    id: 'sysad', titulo: 'CPU ↔ RCP por SysAD',
    descripcion: 'La CPU no tiene memoria propia: escribe un registro del vídeo y lee una palabra de la RDRAM pidiéndoselo al RCP por SysAD, al reloj maestro de 62,5 MHz.',
    duracion: t, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: TM / 1.2,
    defecto: ['MCLK', 'SYSAD', 'SYSCMD', 'PVALID', 'EOK', 'EVALID', 'RCP'],
    fidelidad: 'Exacto: el reloj (62,5 MHz, 16 ns por ciclo), el orden de las señales de una escritura y de una lectura sin caché de 32 bits (N64brew, «SysAD Interface») y las direcciones (KSEG1). Ilustrativo: la espera de la lectura (N64brew habla de unos 10 a 20 ciclos o más para la RDRAM) y los datos.',
  };
}

function escenarioDecodificar(op: Opciones): Escenario {
  const dir = (parseInt(op.dir ?? '0', 16) || 0) >>> 0;
  const w = op.escritura === '1';
  const d = decodificar(dir, w);
  const c = new Cronograma();
  senalesSysAD(c);
  c.bus('SEL', 'Quién contesta');
  c.set('SYSAD', 0, hex(dir, 8));
  c.set('SYSCMD', 0, w ? 'escribir 32' : 'leer 32');
  c.set('PVALID', 0, 0);
  c.set('SEL', 0, d.seleccion ?? 'nadie');
  c.set('PVALID', TM, 1);
  c.set('SYSAD', TM, w ? '$12345678' : null);
  c.set('SYSCMD', TM, w ? 'dato' : null);
  const fin = 12 * TM;
  if (!w) {
    c.set('EVALID', 8 * TM, 0);
    c.set('SYSAD', 8 * TM, '$12345678');
    c.set('EVALID', 9 * TM, 1);
    c.set('SYSAD', 9 * TM, null);
  } else {
    c.set('SYSAD', 2 * TM, null);
    c.set('SYSCMD', 2 * TM, null);
  }
  c.set('SEL', fin - TM, null);
  c.paso(0, fin, `${hex(dir, 8)}: ${d.zona}. ${d.texto}`);
  c.reloj('MCLK', 0, fin, TM);
  c.marca(0);
  c.marca(fin);
  return {
    id: 'decodificar', titulo: `Acceso a ${hex(dir, 8)}`, descripcion: 'Una dirección de la CPU, por SysAD hasta el RCP, que decide qué la contesta.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: TM / 1.2,
    defecto: ['MCLK', 'SYSAD', 'SYSCMD', 'PVALID', 'EVALID', 'SEL'],
    fidelidad: 'Exacto: el mapa de direcciones físico y los segmentos KSEG0 y KSEG1 (N64brew, «Memory map»). Ilustrativo: los ciclos de espera de la respuesta, que dependen de qué contesta.',
  };
}

// ------------------------------------------------------------------ cartridge bus (PI)

function escenarioCartucho(): Escenario {
  const c = new Cronograma();
  const T = TM; // the RCP's 16 ns cycle
  c.bit('ALEH', 'ALEH', 0, 'Baja: los dispositivos guardan la mitad alta de la dirección')
    .bit('ALEL', 'ALEL', 0, 'Baja: guardan la mitad baja')
    .bus('CAD', 'CAD15–0')
    .bit('RD', '/RD', 1)
    .bus('DIR', 'Dirección dentro del cartucho');
  const dir = 0x10001000;
  let t = 0;
  c.marca(t);
  c.set('ALEH', t, 1);
  c.set('CAD', t, hex(dir >>> 16, 4));
  t += 7 * T;
  c.set('ALEH', t, 0);
  c.paso(0, t, `ALEH alto al menos 7 ciclos (${7 * 16} ns) con la mitad alta, $1000, en CAD0–CAD15; al bajar, el cartucho la guarda.`);
  c.marca(t);
  c.set('ALEL', t, 1);
  c.set('CAD', t, hex(dir & 0xffff, 4));
  const t1 = t;
  t += 14 * T;
  c.set('ALEL', t, 0);
  c.set('CAD', t, null);
  c.set('DIR', t, hex(dir, 8));
  c.paso(t1, t, `ALEL alto al menos 14 ciclos (${14 * 16} ns) con la mitad baja, $1000; al bajar, el cartucho tiene la dirección entera.`);
  const tLat = t;
  t += 0x41 * T;
  c.marca(t);
  c.paso(tLat, t, 'LAT: el RCP espera antes de la primera lectura. Los cartuchos oficiales piden $40 en su cabecera: 65 ciclos, 1040 ns.');
  const palabras = [0x8037, 0x1240, 0x000f, 0x0000];
  for (let k = 0; k < palabras.length; k++) {
    const a = t;
    c.set('RD', a, 0);
    c.set('CAD', a + 8 * T, hex(palabras[k]!, 4));
    t += 0x13 * T;
    c.set('RD', t, 1);
    c.set('CAD', t, null);
    c.paso(a, t, `/RD bajo 304 ns (PWD = $12): el cartucho pone la palabra ${k + 1}, ${hex(palabras[k]!, 4)}; el RCP la toma al subir /RD.`);
    const b = t;
    t += 4 * T;
    c.set('DIR', t, hex(dir + 2 * (k + 1), 8));
    c.paso(b, t, 'RLS = $03: /RD alto 64 ns. El cartucho avanza su contador de direcciones para la palabra siguiente.');
    c.marca(t);
  }
  return {
    id: 'cartucho', titulo: 'Lectura del cartucho',
    descripcion: 'El RCP lee cuatro palabras de 16 bits de la ROM ($10001000) por el bus multiplexado del cartucho, con los tiempos que pide la cabecera de los cartuchos oficiales.',
    duracion: t, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: t / 14,
    defecto: ['ALEH', 'ALEL', 'CAD', 'RD', 'DIR'],
    fidelidad: 'Exacto: el bus de 16 bits con la dirección en dos mitades (ALEH ≥ 7 ciclos, ALEL ≥ 14), LAT, PWD y RLS de los cartuchos oficiales ($40, $12, $03 → 1040, 304 y 64 ns) y el contador de direcciones del cartucho (N64brew, «Peripheral Interface»). Ilustrativo: los datos y el instante en que son válidos dentro de /RD.',
  };
}

// ------------------------------------------------------------------ controllers (Joybus)

function escenarioMandos(): Escenario {
  const c = new Cronograma();
  const B = 4e-6;
  c.bit('JOY', 'Línea del mando 1', 1, 'En reposo alta; se baja al principio de cada bit')
    .bus('BYTE', 'Byte')
    .bus('QUIEN', 'Quién habla');
  let t = 2e-6;
  const bit = (v: number): void => {
    c.set('JOY', t, 0);
    c.set('JOY', t + (v ? 1e-6 : 3e-6), 1);
    t += B;
  };
  const byte = (v: number, quien: string, nota: string): void => {
    const a = t;
    c.marca(a);
    c.set('BYTE', a, hex(v, 2));
    c.set('QUIEN', a, quien);
    for (let k = 7; k >= 0; k--) bit((v >> k) & 1);
    c.paso(a, t, nota);
  };
  byte(0x01, 'PIF', 'El PIF manda la orden $01, «estado del mando»: 8 bits de 4 µs.');
  const s = t;
  c.set('JOY', t, 0);
  c.set('JOY', t + 1e-6, 1);
  t += 3e-6;
  c.set('BYTE', s, 'parada');
  c.paso(s, t, 'Bit de parada de la consola: 3 µs. Ahora contesta el mando.');
  t += 2e-6;
  byte(0x10, 'mando', 'Primer byte: botones (aquí, START).');
  byte(0x00, 'mando', 'Segundo byte: más botones.');
  byte(0x12, 'mando', 'Tercer byte: la palanca en X, en complemento a dos (+18).');
  byte(0xf6, 'mando', 'Cuarto byte: la palanca en Y (−10).');
  const p = t;
  c.set('JOY', t, 0);
  c.set('JOY', t + 2e-6, 1);
  c.set('BYTE', t, 'parada');
  t += B;
  c.paso(p, t, 'Bit de parada del mando, de 4 µs. El PIF guarda los 4 bytes en su RAM para el RCP.');
  c.set('BYTE', t, null);
  c.set('QUIEN', t, null);
  t += 4e-6;
  c.marca(t);
  return {
    id: 'mandos', titulo: 'Leer un mando', descripcion: 'El PIF pregunta al mando por su único hilo de datos y el mando contesta con sus botones y su palanca: 40 bits de 4 µs y dos bits de parada.',
    duracion: t, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: t / 16,
    defecto: ['JOY', 'BYTE', 'QUIEN'],
    fidelidad: 'Exacto: bits de 4 µs, el bit de parada de la consola de 3 µs, la orden $01 y la respuesta de 4 bytes (botones y palanca con signo) (N64brew, «Joybus Protocol»). Ilustrativo: cuánto de cada bit está abajo (1 µs para un 1, 3 µs para un 0, dibujado así) y los valores.',
  };
}

// ------------------------------------------------------------------ frame and VI interrupt

function escenarioCuadro(): Escenario {
  const TL = N.hsync / N.vi;
  const lineas = N.medias / 2;
  const fin = lineas * TL;
  const c = new Cronograma();
  c.bus('LINEA', 'Línea').bit('VIINT', 'Interrupción del VI', 0).bit('VIDEO', 'Imagen', 0).bus('CPU', 'CPU');
  for (let l = 0; l < Math.ceil(lineas); l++) c.set('LINEA', l * TL, String(l));
  const primera = N.id === 'ntsc' ? 18 : 22;
  const ultima = N.id === 'ntsc' ? 258 : 310;
  c.set('VIDEO', primera * TL, 1);
  c.set('VIDEO', ultima * TL, 0);
  c.set('CPU', 0, 'prepara el cuadro siguiente');
  const tI = 1 * TL;
  c.set('VIINT', tI, 1);
  c.set('VIINT', tI + 3e-6, 0);
  c.set('CPU', tI, 'atiende la interrupción: cambia VI_ORIGIN');
  c.set('CPU', tI + 40e-6, 'prepara el cuadro siguiente');
  c.marca(tI);
  c.paso(0, primera * TL, `VI_V_INTR = 2 (media línea 2): el VI avisa a la CPU (por el MI, en INT0) al empezar el cuadro. La rutina cambia VI_ORIGIN al cuadro que el RDP acaba de dibujar.`);
  c.paso(primera * TL, ultima * TL, 'El VI lee el cuadro de la RDRAM línea a línea y saca los puntos por SRGB0–SRGB6 al VDC-NUS, mientras el RSP y el RDP dibujan el siguiente en otra zona.');
  c.paso(ultima * TL, fin, 'Borrado vertical hasta el final del cuadro.');
  c.marca(fin);
  return {
    id: 'cuadro', titulo: 'Un cuadro y la interrupción del VI',
    descripcion: `Un cuadro ${N.nombre} sin entrelazar: ${N.medias} medias líneas de ${N.hsync} ciclos del reloj de vídeo (${mhz(N.vi)}): líneas de ${us(TL)}, ${coma(1 / fin, 2)} cuadros por segundo.`,
    duracion: fin, escala: 'ms', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 16,
    defecto: ['LINEA', 'VIINT', 'VIDEO', 'CPU'],
    fidelidad: `Exacto: H_SYNC ${N.hsync - 1} (líneas de ${N.hsync} cuartos de punto) y V_SYNC de ${N.medias} medias líneas, el reloj de vídeo medido (${mhz(N.vi)}) y la interrupción en la media línea de VI_V_INTR (N64brew, «Video Interface»). Ilustrativo: las líneas visibles (${primera}–${ultima - 1}) y lo que tarda la rutina.`,
  };
}

// ------------------------------------------------------------------ audio to the DAC

function escenarioAudio(): Escenario {
  const fs = 44100;
  const T = 1 / fs;
  const TB = T / 32;
  const c = new Cronograma();
  c.bit('AUDLRCLK', 'AUDLRCLK (44,1 kHz)', 1, 'Canal izquierdo o derecho').bit('AUDCLK', 'AUDCLK (bit)', 1).bus('AUDDAT', 'AUDDAT (serie)').bus('AI', 'AI (DMA de la RDRAM)');
  const m: [number, number][] = [[0x0a3c, 0xf5c4], [0x0b10, 0xf4f0]];
  for (let k = 0; k < 2; k++) {
    const a = k * T;
    c.set('AUDLRCLK', a, 1);
    c.set('AUDLRCLK', a + T / 2, 0);
    c.set('AUDDAT', a, `L ${hex(m[k]![0], 4)}`);
    c.set('AUDDAT', a + T / 2, `R ${hex(m[k]![1], 4)}`);
    c.marca(a);
    c.paso(a, a + T / 2, `Muestra ${k + 1}, canal izquierdo: 16 bits en serie, uno por flanco de AUDCLK.`);
    c.paso(a + T / 2, a + T, `Muestra ${k + 1}, canal derecho. El BU9480F convierte cada palabra y el AMP-NUS la amplifica.`);
  }
  c.set('AI', 0, 'muestras del búfer');
  const fin = 2 * T;
  c.reloj('AUDCLK', 0, fin, TB);
  c.marca(fin);
  return {
    id: 'audio', titulo: 'Del AI al DAC', descripcion: 'El RSP mezcla el sonido en la RDRAM; el AI lo lee por DMA y lo manda al DAC en serie: 44 100 muestras estéreo de 16 bits por segundo.',
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 12,
    defecto: ['AUDLRCLK', 'AUDCLK', 'AUDDAT', 'AI'],
    fidelidad: 'Exacto: 44,1 kHz estéreo de 16 bits por canal (Copetti; manual de programación, 3.7) y las tres señales del esquema (AUDCLK, AUDDAT y AUDLRCLK del RCP a DCK, SI y LRCK del BU9480F). Ilustrativo: 32 flancos de bit por muestra, el formato exacto de la serie y los valores (el juego elige la frecuencia con el divisor del AI).',
  };
}

// ------------------------------------------------------------------ clocks

function escenarioRelojes(): Escenario {
  const c = new Cronograma();
  const fin = 6 * TM;
  c.bit('MCLK', 'MasterClock 62,5 MHz (RCP)', 1)
    .bit('CPU', 'CPU 93,75 MHz (× 1,5)', 1)
    .bit('RCLK', 'Bus Rambus 250 MHz', 1)
    .bit('VCLK', `Reloj de vídeo ${mhz(N.vi)} (${N.nombre})`, 1);
  c.reloj('MCLK', 0, fin, TM);
  c.reloj('CPU', 0, fin, 1 / CPU);
  c.reloj('RCLK', 0, fin, 1 / RAMBUS);
  c.reloj('VCLK', 0, fin, 1 / N.vi);
  for (let k = 0; k <= 6; k++) c.marca(k * TM);
  c.paso(0, fin, `El RCP y SysAD van al reloj maestro de 62,5 MHz; la CPU lo multiplica por 1,5 (93,75 MHz). El bus Rambus va a 250 MHz y transfiere en los dos flancos. El vídeo tiene su reloj, de U7: ${mhz(N.vi)} medidos en ${N.nombre}${N.id === 'pal' ? '; en las PAL cambian también la frecuencia del bus de la RAM y el PIF (BitBuilt)' : ''}.`);
  return {
    id: 'relojes', titulo: 'Relojes', descripcion: 'El reloj maestro del RCP, la CPU, el bus de la RDRAM y el reloj de vídeo.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 8,
    defecto: ['MCLK', 'CPU', 'RCLK', 'VCLK'],
    fidelidad: 'Exacto: 62,5 MHz, 93,75 MHz y 250 MHz (manual de programación, 3.7; N64brew, «SysAD Interface») y el reloj de vídeo medido (N64brew, «Video Interface»). Ilustrativo: las fases relativas.',
  };
}

export const N64: Maquina = {
  id: 'n64',
  diagrama: diagramaDe('ntsc'),
  diagramaDe,
  variantes: [
    { id: 'ntsc', titulo: 'NTSC · 60 Hz', nota: 'NTSC, como la placa del esquema y la de la foto: reloj de vídeo de 48,62 MHz medidos, 525 medias líneas.' },
    { id: 'pal', titulo: 'PAL · 50 Hz', nota: 'PAL: reloj de vídeo de 49,56 MHz medidos y 625 medias líneas; otro PIF, otra velocidad del bus de la RAM y, en la PAL normal, el DENC-NUS (BitBuilt).' },
  ],
  digitos: 8,
  dirInicial: 'A4400004',
  notaDecodificador: 'Direcciones de la CPU: KSEG0 ($80000000) y KSEG1 ($A0000000) son la misma memoria física, con y sin caché.',
  decodificar,
  escenarios: [
    { id: 'sysad', titulo: 'CPU ↔ RCP por SysAD', crear: conNorma(escenarioSysAD) },
    { id: 'decodificar', titulo: 'Decodificar una dirección', crear: conNorma(escenarioDecodificar) },
    { id: 'cartucho', titulo: 'Lectura del cartucho', crear: conNorma(escenarioCartucho) },
    { id: 'mandos', titulo: 'Leer un mando', crear: conNorma(escenarioMandos) },
    { id: 'cuadro', titulo: 'Un cuadro y la interrupción del VI', crear: conNorma(escenarioCuadro) },
    { id: 'audio', titulo: 'Del AI al DAC', crear: conNorma(escenarioAudio) },
    { id: 'relojes', titulo: 'Relojes', crear: conNorma(escenarioRelojes) },
  ],
  ejemplos: [
    { dir: 0x80000400, escritura: false, texto: 'RDRAM (caché)' },
    { dir: 0xa4400004, escritura: true, texto: 'VI_ORIGIN' },
    { dir: 0xa4040010, escritura: false, texto: 'RSP' },
    { dir: 0xb0001000, escritura: false, texto: 'ROM' },
    { dir: 0xbfc00000, escritura: false, texto: 'arranque' },
    { dir: 0xbfc007fc, escritura: true, texto: 'RAM del PIF' },
    { dir: 0xa4500000, escritura: true, texto: 'audio' },
  ],
  opciones: [
    { id: 'espera', titulo: 'Espera de la RDRAM', escenarios: ['sysad'], valores: [{ v: '10', texto: '10 ciclos' }, { v: '16', texto: '16 ciclos' }, { v: '24', texto: '24 ciclos' }] },
  ],
};
