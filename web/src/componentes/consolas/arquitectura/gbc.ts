// Game Boy Color (CGB-CPU-04 with the CPU CGB): board diagram, address decoding and the timed scenarios.
//
// Timing figures (Pan Docs, «CGB Registers», «Rendering», «Memory Map»):
//   - crystal 8.388608 MHz (2^23 Hz, X1 on the board); dots stay at 4.194304 MHz in both speeds; one M-cycle is
//     4 dots in Normal Speed (953.7 ns) and 2 dots in Double Speed (476.8 ns).
//   - speed switch: write 1 to KEY1 ($FF4D) and execute STOP; the CPU stops for 2050 M-cycles (8200 T-cycles).
//   - VRAM DMA (HDMA, $FF51–$FF55): general-purpose (CPU halted until the end) or HBlank (16 bytes per HBlank of
//     lines 0–143); a block of 16 bytes takes about 8 µs in both speeds (8 M-cycles normal, 16 double): 2 bytes
//     per microsecond.
//   - memory: VRAM 2 × 8 KB inside the CPU CGB (bank in VBK $FF4F); WRAM 32 KB = bank 0 at $C000 and banks 1–7 at
//     $D000 (SVBK $FF70) in the external SRAM U2 on the MA0–MA12 + RA0/RA1 bus (CGB-CPU-04 schematic).
//   - the cartridge bus keeps the Game Boy timing of GBCTR appendix C (gb.ts), scaled to the M-cycle length.

import { Cronograma, hex, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';
import { TC, TMC, ciclosGB, escenarioCuadroGB, escenarioDMA, escenarioLineaPPU, senalesGB, zonaGB, type CicloGB } from './gb';

const diagrama: Diagrama = {
  ancho: 1000,
  alto: 450,
  bloques: [
    { id: 'osc', x: 30, y: 18, w: 160, h: 56, titulo: 'Cristal', sub: 'X1 · 8,388608 MHz', foto: 'xtal', esquema: ['X1'],
      actividad: [{ pista: 'CLK', nivel: 1 }],
      info: '2²³ Hz, el doble que la Game Boy. La PPU sigue trabajando con puntos de 4,194304 MHz; la CPU puede ir a 1 o a 2 ciclos de máquina por microsegundo.' },
    { id: 'soc', x: 250, y: 100, w: 260, h: 170, titulo: 'CPU CGB', sub: 'U1 · SM83 · PPU · 16 KB de VRAM · HDMA', foto: 'soc', esquema: ['U1'],
      actividad: [{ pista: 'RD' }, { pista: 'HDMA', nivel: 1 }, { pista: 'MODO3', nivel: 1 }],
      info: 'Como el SoC de la Game Boy, más: doble velocidad, la VRAM de 16 KB dentro (dos bancos), paletas de color de 15 bits, la DMA a VRAM (HDMA) y el puerto de infrarrojos. Su segundo bus externo (MA/MD) ya no va a la VRAM sino a la WRAM.' },
    { id: 'wram', x: 600, y: 100, w: 180, h: 76, titulo: 'WRAM 32 KB', sub: 'U2 · LH52256 · 8 bancos de 4 KB', foto: 'wram', esquema: ['U2'],
      actividad: [{ pista: 'WRAMSEL', nivel: 1 }],
      info: 'SRAM de 32K × 8 en MA0–MA12 más RA0/RA1. $C000–$CFFF es siempre el banco 0; $D000–$DFFF, el banco de SVBK ($FF70, 1–7).' },
    { id: 'lcd', x: 600, y: 230, w: 190, h: 82, titulo: 'Pantalla en color', sub: 'P2 · TFT 160 × 144', foto: 'ffc', esquema: ['P2'],
      actividad: [{ pista: 'CP', nivel: 1 }],
      info: 'Por el conector de 50 vías salen 18 bits de color (LDR, LDG, LDB 0–5) con el reloj DCK y los pulsos SPS, SPL, CLS, MOD y REVC, más las tensiones del panel.' },
    { id: 'cart', x: 30, y: 350, w: 190, h: 72, titulo: 'Cartucho', sub: 'P1 · ROM + MBC + RAM', foto: 'cart', esquema: ['P1'], externo: true,
      actividad: [{ pista: 'A15' }, { pista: 'CARTRAM', nivel: 1 }],
      info: 'El mismo conector y la misma temporización que en la Game Boy; en doble velocidad los ciclos duran la mitad.' },
    { id: 'mandos', x: 820, y: 230, w: 160, h: 82, titulo: 'Botones', sub: 'P00–P13 · $FF00', foto: 'b-dpad', esquema: ['SW2'],
      info: 'La misma matriz 2 × 4 que en la Game Boy.' },
    { id: 'ir', x: 820, y: 100, w: 160, h: 64, titulo: 'Infrarrojos', sub: 'D3, Q5 · $FF56', foto: 'ir', esquema: ['D3', 'Q5'],
      info: 'LED emisor y fototransistor para comunicarse entre consolas.' },
    { id: 'link', x: 30, y: 110, w: 130, h: 64, titulo: 'Puerto de enlace', sub: 'P3', foto: 'link', esquema: ['P3'],
      info: 'Puerto serie; en doble velocidad también puede ir más rápido.' },
    { id: 'audio', x: 30, y: 200, w: 130, h: 64, titulo: 'Audio', sub: 'U3 AMP MGB · VR1', foto: 'amp', esquema: ['U3', 'VR1'],
      info: 'SO1 y SO2 hacia el amplificador, el altavoz y los auriculares.' },
    { id: 'alim', x: 820, y: 360, w: 160, h: 62, titulo: 'Alimentación', sub: 'U5 DC-DC · U4 CGB-REG', foto: 'reg', esquema: ['U5', 'U4'],
      info: 'Dos pilas AA; el convertidor saca +5 V y +3,3 V y el CGB-REG las tensiones de la pantalla.' },
  ],
  conexiones: [
    { id: 'clk', puntos: [[190, 46], [300, 46], [300, 100]], bits: 1, etiqueta: 'XTAL1/XTAL2', pos: [245, 40], clase: 'reloj', pista: 'CLK', nivel: 1, red: 'Net-(U1A-XTAL1)' },
    { id: 'phi', puntos: [[270, 270], [270, 300], [150, 300], [150, 350]], bits: 1, etiqueta: 'PHI', pos: [200, 294], clase: 'reloj', pista: 'PHI', nivel: 1, red: 'Net-(P1-Pin_2)' },
    { id: 'bus-a', puntos: [[30, 330], [520, 330]], bits: 16, etiqueta: 'A0–A15', pos: [460, 324], clase: 'bus', pista: 'A', valor: true, red: '/A0' },
    { id: 'bus-d', puntos: [[30, 340], [520, 340]], bits: 8, etiqueta: 'D0–D7', pos: [470, 352], clase: 'dato', pista: 'D', valor: true, red: '/D0' },
    { id: 'soc-a', puntos: [[320, 270], [320, 330]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'soc-d', puntos: [[360, 270], [360, 340]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'cart-a', puntos: [[80, 330], [80, 350]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'a15', puntos: [[260, 270], [260, 310], [200, 310], [200, 350]], bits: 1, etiqueta: 'A15', pos: [230, 318], clase: 'seleccion', pista: 'A15', nivel: 0, red: '/A15' },
    { id: 'cs', puntos: [[440, 270], [440, 290], [480, 290], [480, 380], [220, 380]], bits: 1, etiqueta: '/CS', pos: [430, 374], clase: 'seleccion', pista: 'CS', nivel: 0, red: '/CS' },
    { id: 'ma', puntos: [[510, 120], [600, 120]], bits: 15, etiqueta: 'MA0–MA12, RA0/RA1', pos: [555, 112], clase: 'bus', pista: 'MA', valor: true, red: 'Net-(U1B-MA0)' },
    { id: 'md', puntos: [[510, 145], [600, 145]], bits: 8, etiqueta: 'MD0–MD7', pos: [555, 157], clase: 'dato', pista: 'MD', valor: true, red: 'Net-(U1B-MD0)' },
    { id: 'cs1', puntos: [[510, 168], [600, 168]], bits: 1, etiqueta: '', clase: 'seleccion', pista: 'MCS', nivel: 0, red: 'Net-(U1B-CS1)' },
    { id: 'lcdbus', puntos: [[510, 245], [600, 245]], bits: 18, etiqueta: 'LDR/G/B, DCK', pos: [555, 237], clase: 'dato', pista: 'CP', nivel: 1, red: '/CGB_Screen/LDR0' },
    { id: 'joy', puntos: [[510, 205], [810, 205], [810, 260], [820, 260]], bits: 6, etiqueta: 'P00–P13', pos: [700, 198], clase: 'control', red: '/CGB_Controls/P00' },
    { id: 'ir', puntos: [[510, 185], [800, 185], [800, 130], [820, 130]], bits: 4, etiqueta: 'R0–R3', pos: [700, 178], clase: 'control', red: '/CGB_IR/R0' },
    { id: 'ser', puntos: [[250, 140], [160, 140]], bits: 3, etiqueta: 'SCLK, SIN, SOUT', pos: [205, 132], clase: 'control', red: '/CGB_Serial/SCLK' },
    { id: 'so', puntos: [[250, 230], [160, 230]], bits: 2, etiqueta: 'SO1, SO2', pos: [205, 222], clase: 'control', red: '/CGB_Sound/S01' },
  ],
};

export function decodificar(dir: number, escritura: boolean): Decodificacion {
  const a = dir & 0xffff;
  const z = zonaGB(a, true);
  const a15 = z.bus === 'rom';
  const cs = z.bus === 'cram';
  const tabla = [
    { etiqueta: 'A15 baja: ROM del cartucho', valor: a15 ? 'baja' : 'alta', activa: a15 },
    { etiqueta: '/CS baja: RAM del cartucho ($A000–$BFFF)', valor: cs ? 'baja' : 'alta', activa: cs },
    { etiqueta: '/CS1 (WRAM, bus MA/MD)', valor: z.bus === 'wram' ? 'baja' : 'alta', activa: z.bus === 'wram' },
    { etiqueta: 'VRAM interna (banco de VBK)', valor: z.bus === 'vram' ? 'sí' : 'no', activa: z.bus === 'vram' },
  ];
  let texto = z.texto;
  if (escritura && a < 0x8000) texto = 'Escritura en la zona de ROM: la captura el MBC del cartucho como registro.';
  if (a === 0xff4d) texto = 'KEY1: con el bit 0 a 1, la siguiente instrucción STOP cambia de velocidad.';
  if (a === 0xff4f) texto = 'VBK: el bit 0 elige el banco de VRAM que ve la CPU en $8000–$9FFF.';
  if (a === 0xff70) texto = 'SVBK: los bits 0–2 eligen el banco de WRAM de $D000–$DFFF (0 equivale a 1).';
  if (a >= 0xff51 && a <= 0xff55) texto = 'Registros de la DMA a VRAM (HDMA): origen, destino y longitud/modo.';
  return { direccion: a, escritura, tabla, zona: z.zona, seleccion: a15 ? 'A15' : cs ? '/CS' : z.bus === 'wram' ? '/CS1' : null, bloque: z.bloque, texto,
    espejo: a >= 0xe000 && a < 0xfe00 ? hex(a - 0x2000, 4) : undefined };
}

const PROGRAMA: CicloGB[] = [
  { dir: 0x0150, escritura: false, dato: 0xfa, nota: 'LD A,(a16) desde la ROM del cartucho' },
  { dir: 0x0151, escritura: false, dato: 0x00, nota: 'byte bajo' },
  { dir: 0x0152, escritura: false, dato: 0xd0, nota: 'byte alto' },
  { dir: 0xd000, escritura: false, dato: 0x42, nota: 'lectura de la WRAM (banco de SVBK): sale por MA/MD, el bus del cartucho no se mueve' },
  { dir: 0x0153, escritura: false, dato: 0xea, nota: 'LD (a16),A' },
  { dir: 0x0154, escritura: false, dato: 0x00, nota: 'byte bajo' },
  { dir: 0x0155, escritura: false, dato: 0x98, nota: 'byte alto' },
  { dir: 0x9800, escritura: true, dato: 0x42, nota: 'escritura en la VRAM interna: ningún bus externo se mueve' },
  { dir: 0x0156, escritura: false, dato: 0xea, nota: 'LD (a16),A' },
  { dir: 0x0157, escritura: false, dato: 0x00, nota: 'byte bajo' },
  { dir: 0x0158, escritura: false, dato: 0xa0, nota: 'byte alto' },
  { dir: 0xa000, escritura: true, dato: 0x42, nota: 'escritura en la RAM del cartucho: /CS y /WR' },
];

function velocidad(op: Opciones): { tm: number; nombre: string } {
  return op.velocidad === 'doble' ? { tm: TMC / 2, nombre: 'doble velocidad (476,8 ns por ciclo)' } : { tm: TMC, nombre: 'velocidad normal (953,7 ns por ciclo)' };
}

function escenarioBus(op: Opciones): Escenario {
  const v = velocidad(op);
  return ciclosGB('bus', 'Ciclos de bus de la CPU', `Lectura de la WRAM (bus MA/MD), escritura en la VRAM interna y en la RAM del cartucho, en ${v.nombre}.`, PROGRAMA, v.tm, true, '8,388608 MHz ÷ 2');
}

function escenarioDecodificar(op: Opciones): Escenario {
  const dir = Math.max(0, Math.min(0xffff, parseInt(op.dir ?? '0', 16) || 0));
  const w = op.escritura === '1';
  const lista: CicloGB[] = [
    { dir: 0x0200, escritura: false, dato: w ? 0xea : 0xfa, nota: w ? 'LD (a16),A' : 'LD A,(a16)' },
    { dir: 0x0201, escritura: false, dato: dir & 0xff, nota: 'byte bajo' },
    { dir: 0x0202, escritura: false, dato: dir >> 8, nota: 'byte alto' },
    { dir, escritura: w, dato: 0x5a, nota: decodificar(dir, w).zona },
  ];
  return ciclosGB('decodificar', `Acceso a ${hex(dir, 4)}`, 'Instrucción leída del cartucho y el acceso a la dirección elegida.', lista, TMC, true, '8,388608 MHz ÷ 2');
}

// ------------------------------------------------------------------ speed switch

function escenarioVelocidad(): Escenario {
  const c = new Cronograma();
  c.bit('PHI', 'PHI (ciclo de máquina)', 1).bus('KEY1', 'KEY1 ($FF4D)').bit('PARADA', 'CPU parada', 0).bus('CPU', 'CPU');
  const antes = 6 * TMC;
  const parada = 2050 * TMC;
  const t1 = antes + parada;
  const fin = t1 + 12 * (TMC / 2);
  c.set('KEY1', 0, '$7E (normal)');
  c.set('CPU', 0, 'LD A,1 · LDH ($4D),A');
  c.set('KEY1', 3 * TMC, '$7F (preparado)');
  c.set('CPU', 4 * TMC, 'STOP');
  c.set('PARADA', antes, 1);
  c.set('CPU', antes, 'parada 2050 ciclos');
  c.set('PARADA', t1, 0);
  c.set('KEY1', t1, '$FE (doble)');
  c.set('CPU', t1, 'sigue al doble');
  c.reloj('PHI', 0, antes, TMC);
  c.set('PHI', antes, 0);
  c.reloj('PHI', t1, fin, TMC / 2);
  for (const t of [0, 3 * TMC, antes, t1, fin]) c.marca(t);
  c.paso(0, antes, 'Velocidad normal: se escribe 1 en KEY1 y se ejecuta STOP.');
  c.paso(antes, t1, `La CPU se detiene 2050 ciclos de máquina (8200 puntos, ${(parada * 1e3).toFixed(2).replace('.', ',')} ms) mientras el reloj cambia.`);
  c.paso(t1, fin, 'Doble velocidad: cada ciclo de máquina dura 476,8 ns (2 puntos). La PPU y el APU siguen igual; la CPU, los temporizadores, el puerto serie y la DMA de OAM van al doble.');
  return {
    id: 'velocidad', titulo: 'Cambio a doble velocidad', descripcion: 'KEY1 y STOP: la CPU pasa de 1,05 a 2,10 millones de ciclos de máquina por segundo.',
    duracion: fin, escala: 'ms', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 12, ventana: [0, fin],
    defecto: ['PHI', 'KEY1', 'PARADA', 'CPU'],
    fidelidad: 'Exacto: 2050 ciclos de máquina de parada (8200 puntos) y los periodos antes y después (Pan Docs, «CGB Registers», KEY1). Ilustrativo: los valores leídos de KEY1 (bits sin uso a 1) y el reloj durante la parada (dibujado quieto).',
  };
}

// ------------------------------------------------------------------ HBlank DMA

function escenarioHDMA(op: Opciones): Escenario {
  const v = velocidad(op);
  const TLn = 456 * TC;
  const lineas = 3;
  const c = new Cronograma();
  senalesGB(c, '8,388608 MHz ÷ 2', true);
  c.bus('MODO', 'Modo de la PPU').bit('HDMA', 'DMA a VRAM activa', 0).bus('VDST', 'Destino en la VRAM').bit('PARADA', 'CPU parada', 0).bus('CPU', 'CPU');
  const m3 = 172;
  c.set('CPU', 0, 'ejecuta su programa');
  for (let l = 0; l < lineas; l++) {
    const t0 = l * TLn;
    c.set('MODO', t0, '2');
    c.set('MODO', t0 + 80 * TC, '3');
    const th = t0 + (80 + m3) * TC;
    c.set('MODO', th, '0');
    c.marca(t0);
    c.marca(th);
    // a block of 16 bytes: 2 bytes per µs, the CPU halted
    const tb = 1 / 2e6;
    c.set('HDMA', th, 1);
    c.set('PARADA', th, 1);
    c.set('CPU', th, 'parada');
    for (let i = 0; i < 16; i++) {
      const ti = th + i * tb;
      const src = 0x4000 + l * 16 + i;
      c.set('A', ti, hex(src, 4));
      c.set('A15', ti, 0);
      c.set('RD', ti, 0);
      c.set('D', ti + tb * 0.4, hex((src * 7) & 0xff, 2));
      c.set('VDST', ti + tb * 0.6, hex(0x8800 + l * 16 + i, 4));
    }
    const tf = th + 16 * tb;
    c.set('A15', tf, 1);
    c.set('D', tf, null);
    c.set('A', tf, null);
    c.set('VDST', tf, null);
    c.set('HDMA', tf, 0);
    c.set('PARADA', tf, 0);
    c.set('CPU', tf, 'ejecuta su programa');
    c.paso(t0, th, `Línea ${l}: modos 2 y 3 (la VRAM es de la PPU).`);
    c.paso(th, tf, `Borrado horizontal de la línea ${l}: la DMA copia 16 bytes de la ROM ($${(0x4000 + l * 16).toString(16).toUpperCase()}…) a la VRAM ($${(0x8800 + l * 16).toString(16).toUpperCase()}…) en unos 8 µs; la CPU se detiene ${v.tm === TMC ? '8' : '16'} ciclos de máquina.`);
    c.paso(tf, t0 + TLn, 'Resto del borrado: la CPU sigue.');
  }
  const fin = lineas * TLn;
  c.marca(fin);
  return {
    id: 'hdma', titulo: 'DMA a VRAM por línea (HDMA)', descripcion: `HDMA en modo HBlank: 16 bytes al principio de cada borrado horizontal, en ${v.nombre}.`,
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 18,
    defecto: ['MODO', 'HDMA', 'A', 'A15', 'D', 'VDST', 'PARADA', 'CPU'],
    fidelidad: 'Exacto: 16 bytes por borrado horizontal de las líneas 0–143, unos 8 µs por bloque en las dos velocidades (2 bytes por microsegundo), la CPU parada durante el bloque y en marcha entre bloques (Pan Docs, «LCD VRAM DMA Transfers»). Ilustrativo: la forma de cada lectura del cartucho durante la DMA y el modo 3 dibujado con su duración mínima.',
  };
}

function escenarioGDMA(): Escenario {
  const c = new Cronograma();
  senalesGB(c, '8,388608 MHz ÷ 2', true);
  c.bit('HDMA', 'DMA a VRAM activa', 0).bus('VDST', 'Destino en la VRAM').bit('PARADA', 'CPU parada', 0).bus('CPU', 'CPU');
  const n = 64;
  const tb = 1 / 2e6;
  const t0 = 4 * TMC;
  c.set('CPU', 0, 'LDH ($55),A con A = $03');
  c.set('HDMA', t0, 1);
  c.set('PARADA', t0, 1);
  c.set('CPU', t0, 'parada hasta el final');
  for (let i = 0; i < n; i++) {
    const ti = t0 + i * tb;
    c.set('A', ti, hex(0x4000 + i, 4));
    c.set('A15', ti, 0);
    c.set('D', ti + tb * 0.4, hex((i * 13) & 0xff, 2));
    c.set('VDST', ti + tb * 0.6, hex(0x9000 + i, 4));
    if (i % 16 === 0) c.marca(ti);
  }
  const tf = t0 + n * tb;
  c.set('A15', tf, 1);
  c.set('A', tf, null);
  c.set('D', tf, null);
  c.set('VDST', tf, null);
  c.set('HDMA', tf, 0);
  c.set('PARADA', tf, 0);
  c.set('CPU', tf, 'sigue ($FF55 = $FF)');
  c.paso(0, t0, 'Escribir $03 en HDMA5 con el bit 7 a 0 pide una DMA general de 4 bloques (64 bytes).');
  c.paso(t0, tf, `La CPU se detiene hasta el final: 64 bytes a 2 bytes por microsegundo = ${(n * tb * 1e6).toFixed(0)} µs.`);
  const fin = tf + 4 * TMC;
  c.marca(fin);
  return {
    id: 'gdma', titulo: 'DMA a VRAM general', descripcion: 'La DMA general copia todo de una vez con la CPU parada; para usarla fuera del borrado conviene apagar la pantalla.',
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 10,
    defecto: ['HDMA', 'A', 'A15', 'D', 'VDST', 'PARADA', 'CPU'],
    fidelidad: 'Exacto: 2 bytes por microsegundo y la CPU parada hasta que acaba (Pan Docs). Ilustrativo: la forma de cada lectura.',
  };
}

function escenarioRelojes(): Escenario {
  const c = new Cronograma();
  const fin = 2 * TMC;
  c.bit('XTAL', 'Cristal 8,388608 MHz', 1).bit('CLK', 'Punto de la PPU 4,194304 MHz', 1).bit('PHI', 'Ciclo de máquina, normal', 1)
    .bit('PHI2', 'Ciclo de máquina, doble', 1);
  c.reloj('XTAL', 0, fin, TC / 2);
  c.reloj('CLK', 0, fin, TC);
  c.reloj('PHI', 0, fin, TMC);
  c.reloj('PHI2', 0, fin, TMC / 2);
  for (let k = 0; k <= 16; k++) c.marca((k * TC) / 2);
  c.paso(0, fin, 'El cristal de la CGB va al doble; la PPU sigue con puntos de 4 MHz, y la CPU usa 4 puntos por ciclo en velocidad normal o 2 en doble.');
  return {
    id: 'relojes', titulo: 'Relojes', descripcion: 'Cristal de 2²³ Hz, puntos de 2²² Hz y los dos ritmos de la CPU.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 6,
    defecto: ['XTAL', 'CLK', 'PHI', 'PHI2'],
    fidelidad: 'Exacto: 8,388608 MHz, 4 puntos por ciclo en velocidad normal y 2 en doble (Pan Docs, «Rendering»). Ilustrativo: la fase entre relojes.',
  };
}

export const GBC: Maquina = {
  id: 'gbc',
  diagrama,
  digitos: 4,
  dirInicial: 'D000',
  notaDecodificador: 'Con los bancos por defecto: VBK = 0 y SVBK = 1.',
  decodificar,
  escenarios: [
    { id: 'bus', titulo: 'Ciclos de bus', crear: escenarioBus },
    { id: 'decodificar', titulo: 'Decodificar una dirección', crear: escenarioDecodificar },
    { id: 'velocidad', titulo: 'Doble velocidad', crear: escenarioVelocidad },
    { id: 'hdma', titulo: 'HDMA por línea', crear: escenarioHDMA },
    { id: 'gdma', titulo: 'DMA general', crear: escenarioGDMA },
    { id: 'ppu', titulo: 'Una línea de la PPU', crear: (op) => escenarioLineaPPU(op, true) },
    { id: 'cuadro', titulo: 'Cuadro e interrupciones', crear: escenarioCuadroGB },
    { id: 'dma', titulo: 'DMA de OAM', crear: (op) => escenarioDMA(velocidad(op).tm, true) },
    { id: 'relojes', titulo: 'Relojes', crear: escenarioRelojes },
  ],
  ejemplos: [
    { dir: 0x0150, escritura: false, texto: 'ROM' },
    { dir: 0x8000, escritura: true, texto: 'VRAM' },
    { dir: 0xc000, escritura: false, texto: 'WRAM 0' },
    { dir: 0xd123, escritura: false, texto: 'WRAM n' },
    { dir: 0xa000, escritura: true, texto: 'RAM cartucho' },
    { dir: 0xff4d, escritura: true, texto: 'KEY1' },
    { dir: 0xff4f, escritura: true, texto: 'VBK' },
    { dir: 0xff55, escritura: true, texto: 'HDMA5' },
    { dir: 0xff70, escritura: true, texto: 'SVBK' },
  ],
  opciones: [
    { id: 'velocidad', titulo: 'Velocidad', escenarios: ['bus', 'hdma', 'dma'], valores: [{ v: 'normal', texto: 'Normal' }, { v: 'doble', texto: 'Doble' }] },
    { id: 'sprites', titulo: 'Sprites en la línea', escenarios: ['ppu'], valores: [{ v: '0', texto: 'ninguno' }, { v: '4', texto: '4' }, { v: '10', texto: '10' }] },
    { id: 'lyc', titulo: 'LYC', escenarios: ['cuadro'], valores: [{ v: '72', texto: '72' }, { v: '20', texto: '20' }, { v: '130', texto: '130' }] },
  ],
};

