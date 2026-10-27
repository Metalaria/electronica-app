// «Un fotograma» of the Game Boy Color (CGB-CPU-04): tile $24 of the background with palette 1, row 3, pixel 3 →
// point (99, 51).
//
// Checked against Pan Docs («CGB Registers»: VBK, HDMA1–HDMA5, SVBK; «Tile Maps»: BG map attributes in VRAM bank
// 1; «Palettes»: BCPS/BCPD, RGB555 little-endian; «OAM DMA Transfer»; «Rendering»; «Interrupts») and the app's
// «Arquitectura» data (arquitectura/gbc.ts: VRAM inside the CPU, WRAM U2 on MA/MD with RA0/RA1 and /CS1, 18 colour
// lines LDR/LDG/LDB 0–5 with DCK to the screen connector P2). Arithmetic as on the Game Boy ($98CC, $8246/$8247);
// palette 1 colour 1 = byte 2 × (1 × 4 + 1) = $0A of the palette memory, so BCPS = $8A.

import type { FotogramaMaquina } from '../tipos';
import { PELOTA } from '../ejemplo';

export const GBC: FotogramaMaquina = {
  maquina: 'gbc',
  entrada:
    'Seguimos la tesela $24 del fondo, una pelota de 8 × 8 puntos pintada con la paleta 1, desde que la CPU lee su número en la ROM del cartucho hasta que su punto (99, 51) se enciende en la pantalla en color.',
  ejemplo: {
    ancho: 160,
    alto: 144,
    tesela: 8,
    x: 96,
    y: 48,
    indices: PELOTA,
    fila: 3,
    columna: 3,
    // palette 1: colour 0 $7EEB (sky), 1 $001F (red), 2 $7FFF (white), 3 $000F (dark red)
    colores: { 1: '#ff0000', 2: '#ffffff', 3: '#7b0000' },
    fondo: '#5abaff',
    bpp: 2,
    formato: 'planos',
    numero: '$24',
    color: '$001F',
  },
  pasos: [
    {
      fase: 'Bus del cartucho',
      titulo: 'La CPU lee una instrucción del cartucho',
      texto:
        'La CPU CGB saca la dirección $0150 por A0–A15 y baja /RD. Con A15 = 0 responde la ROM del cartucho, que devuelve $3E, el código de LD A con un dato inmediato, y en el ciclo siguiente el dato: $24, el número de la tesela que vamos a seguir.',
      bloques: ['soc', 'cart'],
      senales: [
        { id: 'soc-a', sentido: 1 },
        { id: 'bus-a', sentido: -1, valor: '$0150' },
        { id: 'cart-a', sentido: 1 },
        { id: 'a15', sentido: 1, valor: '0' },
        { id: 'bus-d', sentido: 1, valor: '$3E, $24' },
        { id: 'soc-d', sentido: -1 },
      ],
      internos: [
        ['/RD', '0'],
        ['Instrucción', 'LD A,$24 (3E 24)'],
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Bus de la WRAM',
      titulo: 'Y guarda el valor en la WRAM, por el otro bus',
      texto:
        'En la Game Boy Color el segundo bus de la CPU, MA/MD, ya no va a la VRAM sino a la WRAM de 32 KB. Con LD ($C0A0),A la CPU pone $00A0 en MA0–MA12, el banco en RA0/RA1, $24 en MD0–MD7 y baja /CS1 y /MWR: el byte queda en la SRAM U2.',
      bloques: ['soc', 'wram'],
      senales: [
        { id: 'ma', sentido: 1, valor: '$00A0, banco 0' },
        { id: 'cs1', sentido: 1, nombre: '/CS1', valor: '0' },
        { id: 'md', sentido: 1, valor: '$24' },
      ],
      internos: [['/MWR', '0']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'Línea 144: interrupción de VBlank',
      texto:
        'Cuando LY llega a 144, la PPU entra en el borrado vertical y pide la interrupción de VBlank (bit 0 de IF). La CPU guarda el contador de programa y salta a $0040. Todo ocurre dentro del chip: ninguna patilla cambia.',
      bloques: ['soc'],
      senales: [],
      internos: [
        ['LY', '144'],
        ['Vector', '$0040'],
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'Los sprites, por DMA de OAM',
      texto:
        'Escribir $C1 en $FF46 copia los 160 bytes de $C100–$C19F a la OAM, un byte por ciclo de máquina. Como la WRAM está en el bus MA/MD, la DMA la lee por ahí: dirección $0100–$019F y los datos de vuelta por MD0–MD7.',
      bloques: ['soc', 'wram'],
      senales: [
        { id: 'ma', sentido: 1, valor: '$0100…$019F' },
        { id: 'cs1', sentido: 1, nombre: '/CS1', valor: '0' },
        { id: 'md', sentido: -1, valor: 'atributos' },
      ],
      internos: [
        ['$FF46 (DMA)', '$C1'],
        ['/MRD', '0'],
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El dibujo de la tesela, por HDMA',
      texto:
        'La rutina escribe el origen $4240 en HDMA1/HDMA2, el destino $8240 en HDMA3/HDMA4 y $00 en HDMA5: una DMA general de un bloque de 16 bytes. La CPU se detiene unos 8 µs mientras el chip lee los 16 bytes de la ROM por el bus del cartucho y los deja en su VRAM interna.',
      bloques: ['soc', 'cart'],
      senales: [
        { id: 'soc-a', sentido: 1 },
        { id: 'bus-a', sentido: -1, valor: '$4240…$424F' },
        { id: 'cart-a', sentido: 1 },
        { id: 'a15', sentido: 1, valor: '0' },
        { id: 'bus-d', sentido: 1, valor: 'byte del dibujo' },
        { id: 'soc-d', sentido: -1 },
      ],
      internos: [
        ['HDMA5', '$00 (general, 16 bytes)'],
        ['Destino', 'VRAM $8240'],
      ],
      pantalla: 'vram',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'Número de tesela y atributos',
      texto:
        'Con VBK = 0 escribe $24 en $98CC, la columna 12, fila 6 del mapa. Con VBK = 1 escribe en la misma dirección del banco 1 el byte de atributos, $01: paleta 1, dibujo en el banco 0, sin volteos y sin prioridad sobre los sprites.',
      bloques: ['soc'],
      senales: [],
      internos: [
        ['VRAM banco 0, $98CC', '$24'],
        ['VRAM banco 1, $98CC', '$01'],
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'Los colores de la paleta 1',
      texto:
        'Las paletas no están en la memoria normal: se escriben por dos registros. BCPS = $8A apunta al byte $0A (paleta 1, color 1) y pide incremento automático; dos escrituras en BCPD dejan $1F y $00, es decir, el color de 15 bits $001F: rojo al máximo, verde y azul a cero.',
      bloques: ['soc'],
      senales: [],
      internos: [
        ['BCPS ($FF68)', '$8A'],
        ['BCPD ($FF69)', '$1F, $00'],
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'La PPU lee mapa y atributos a la vez',
      texto:
        'En el modo 3 de la línea 51, la PPU lee en $98CC el número de tesela del banco 0 ($24) y los atributos del banco 1 ($01). La VRAM de 16 KB está dentro del chip, así que esta lectura no mueve ninguna patilla: por eso el bus MA/MD puede servir a la WRAM.',
      bloques: ['soc'],
      senales: [],
      internos: [
        ['Tesela', '$24'],
        ['Atributos', '$01 (paleta 1)'],
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'Los dos bytes de la fila',
      texto:
        'El atributo dice que el dibujo está en el banco 0: la PPU lee la fila 3 en $8246 (bit bajo de cada punto, $DF) y $8247 (bit alto, $A1). Si el atributo pidiera volteo vertical, leería la fila 4 empezando por abajo.',
      bloques: ['soc'],
      senales: [],
      internos: [['$8246, $8247', '$DF, $A1']],
      pantalla: 'patron',
    },
    {
      fase: 'Dentro de la CPU',
      titulo: 'La cola de puntos junta los bits',
      texto:
        'Los dos bytes se emparejan bit a bit y entran en la cola de puntos con la paleta del atributo. El punto 3 da 1 en el byte bajo y 0 en el alto: índice 1 de la paleta 1.',
      bloques: ['soc'],
      senales: [],
      internos: [['Bits del punto 3', '1 y 0 → índice 1']],
      pantalla: 'mezcla',
    },
    {
      fase: 'Dentro de la CPU',
      titulo: 'Sprites y prioridad',
      texto:
        'La prioridad de la Color tiene tres llaves: el bit 7 del atributo del fondo, el bit de prioridad de cada sprite y el bit 0 de LCDC, que puede mandar los sprites delante de todo. Aquí da igual: en el punto 99 de la línea 51 no hay ningún sprite opaco.',
      bloques: ['soc'],
      senales: [],
      internos: [['Sprite en el punto 99', 'ninguno']],
      pantalla: 'prioridad',
      nota: 'Ningún sprite cubre el punto (99, 51): su color sale del fondo.',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'La paleta da el color: $001F',
      texto:
        'Paleta 1, índice 1: la PPU lee en su memoria de paletas los dos bytes que escribió la rutina y obtiene $001F, cinco bits por canal con el rojo a 31.',
      bloques: ['soc'],
      senales: [],
      internos: [
        ['Paleta 1, color 1', '$001F'],
        ['R, G, B', '31, 0, 0'],
      ],
      pantalla: 'paleta',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'El punto viaja a la pantalla en color',
      texto:
        'El color sale por 18 líneas, seis por canal (LDR0–LDR5, LDG0–LDG5, LDB0–LDB5), con el reloj de punto DCK y los pulsos de línea y de cuadro; el cable plano P2 lo lleva a la pantalla TFT, que enciende el punto (99, 51) en rojo.',
      bloques: ['soc', 'lcd'],
      senales: [{ id: 'lcdbus', sentido: 1, valor: 'rojo' }],
      internos: [['Punto', '(99, 51)']],
      pantalla: 'punto',
    },
    {
      fase: 'Fin del cuadro',
      titulo: 'Línea 144 otra vez',
      texto:
        'Tras 144 líneas la imagen está completa: LY vuelve a 144, llega otra interrupción de VBlank y la CPU salta a $0040 para preparar el cuadro siguiente, unas 59,7 veces por segundo.',
      bloques: ['soc'],
      senales: [],
      internos: [['Vector', '$0040']],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'Pan Docs: CGB Registers', url: 'https://gbdev.io/pandocs/CGB_Registers.html', nota: 'VBK, HDMA1–HDMA5, SVBK' },
    { titulo: 'Pan Docs: Tile Maps', url: 'https://gbdev.io/pandocs/Tile_Maps.html', nota: 'atributos del banco 1' },
    { titulo: 'Pan Docs: Palettes', url: 'https://gbdev.io/pandocs/Palettes.html', nota: 'BCPS, BCPD, RGB555' },
    { titulo: 'Pan Docs: OAM DMA Transfer', url: 'https://gbdev.io/pandocs/OAM_DMA_Transfer.html' },
    { titulo: 'Pan Docs: Rendering overview', url: 'https://gbdev.io/pandocs/Rendering.html' },
    { titulo: 'Rodrigo Copetti: Game Boy Architecture', url: 'https://www.copetti.org/writings/consoles/game-boy/', nota: 'la Color' },
  ],
};
