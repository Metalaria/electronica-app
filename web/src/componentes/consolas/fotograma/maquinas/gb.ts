// «Un fotograma» of the Game Boy (DMG-CPU-05/06): tile $24 of the background, row 3, pixel 3 → point (99, 51).
//
// Checked against Pan Docs («Memory Map», «Tile Data», «Tile Maps», «LCDC», «Palettes»: BGP, «OAM DMA
// Transfer», «Rendering»: modes 2, 3, 0 and 1, «Interrupts»: VBlank at LY = 144, vector $40), Gekkio's DMG-CPU
// schematic (nets MA0–MA12, MD0–MD7, /MCS, /MRD, /MWR, LD0, LD1, CP, CPL, ST, S, FR) and the app's «Arquitectura»
// data (arquitectura/gb.ts: WRAM with /CE1 = /CS and CE2 = A14, ROM selected by A15, the inside of the SoC).
// Arithmetic: map $9800 + 6 × 32 + 12 = $98CC (MA = $18CC); tile data $8000 + $24 × 16 = $8240, row 3 at
// $8246/$8247 (MA = $0246/$0247); BGP = $D8 maps index 1 to shade 2.

import type { FotogramaMaquina } from '../tipos';
import { PELOTA } from '../ejemplo';

export const GB: FotogramaMaquina = {
  maquina: 'gb',
  entrada:
    'Seguimos la tesela $24 del fondo, una pelota de 8 × 8 puntos, desde que la CPU lee su número en la ROM del cartucho hasta que su punto (99, 51) se enciende en la pantalla de cristal líquido.',
  ejemplo: {
    ancho: 160,
    alto: 144,
    tesela: 8,
    x: 96,
    y: 48,
    indices: PELOTA,
    fila: 3,
    columna: 3,
    // BGP = $D8: index 1 → shade 2, index 2 → shade 1, index 3 → shade 3 (approximate tones of the DMG screen)
    colores: { 1: '#4d533c', 2: '#8b956d', 3: '#1f1f1f' },
    fondo: '#c4cfa1',
    bpp: 2,
    formato: 'planos',
    numero: '$24',
    color: 'tono 2',
    pantalla: 'LCD',
  },
  pasos: [
    {
      fase: 'Bus del cartucho',
      titulo: 'La CPU lee una instrucción del cartucho',
      texto:
        'El núcleo SM83, dentro del SoC, saca la dirección $0150 por A0–A15 y baja /RD. Con A15 = 0 responde la ROM del cartucho, que devuelve $3E, el código de LD A con un dato inmediato; en el ciclo siguiente lee el dato, $24: el número de la tesela que vamos a seguir.',
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
      fase: 'Bus del cartucho',
      titulo: 'Y guarda el valor en la WRAM',
      texto:
        'Con LD ($C0A0),A el SoC saca $C0A0, baja /CS, pone $24 en D0–D7 y baja /WR. La WRAM está cableada para responder solo con /CS bajo y A14 alto, es decir, de $C000 a $DFFF, y guarda el byte. El juego prepara así el cuadro siguiente mientras la PPU dibuja el actual.',
      bloques: ['soc', 'wram'],
      senales: [
        { id: 'soc-a', sentido: 1 },
        { id: 'bus-a', sentido: -1, valor: '$C0A0' },
        { id: 'wram-a', sentido: 1 },
        { id: 'cs', sentido: 1, valor: '0' },
        { id: 'wr', sentido: 1, valor: '0' },
        { id: 'soc-d', sentido: 1 },
        { id: 'bus-d', sentido: -1, valor: '$24' },
      ],
      internos: [['A14 (CE2 de la WRAM)', '1']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'Línea 144: interrupción de VBlank',
      texto:
        'Cuando el contador de líneas LY llega a 144, la PPU pasa al modo 1 (borrado vertical) y pide la interrupción de VBlank, el bit 0 del registro IF. Si está permitida en IE, la CPU guarda el contador de programa y salta a $0040. Durante las 10 líneas del borrado la VRAM y la OAM son de la CPU.',
      capa: 'interior',
      bloques: ['ppu', 'stat', 'int', 'cpu'],
      placa: ['soc'],
      senales: [
        { id: 'ppu-stat', sentido: 1, nombre: 'modo', valor: '1' },
        { id: 'stat-int', sentido: 1, nombre: 'VBlank', valor: '1' },
        { id: 'int-cpu', sentido: 1, nombre: 'IF.0', valor: '1' },
      ],
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
        'La rutina escribe $C1 en $FF46 y el bloque de DMA copia por su cuenta los 160 bytes de $C100–$C19F, los atributos de 40 sprites que el juego prepara en la WRAM, a la OAM, un byte por ciclo de máquina. Mientras dura, la CPU solo puede usar la HRAM, donde espera la propia rutina.',
      capa: 'interior',
      bloques: ['dma', 'oam', 'ext', 'hram'],
      placa: ['soc', 'wram'],
      senales: [
        { id: 'pins', sentido: -1, valor: '$C100…$C19F' },
        { id: 'dmaext', sentido: -1 },
        { id: 'dmaoam', sentido: 1, nombre: 'OAM', valor: '$FE00…$FE9F' },
      ],
      internos: [
        ['$FF46 (DMA)', '$C1'],
        ['Duración', '160 ciclos de máquina'],
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El dibujo de la tesela llega a la VRAM',
      texto:
        'La Game Boy no tiene DMA hacia la VRAM: un bucle copia los 16 bytes del dibujo, leyéndolos de la ROM y escribiéndolos en $8240–$824F. La VRAM es otra memoria, U2, con su propio bus: el SoC pone la dirección en MA0–MA12 (sin el $8000) y el dato en MD0–MD7, y baja /MCS y /MWR.',
      bloques: ['soc', 'cart', 'vram'],
      senales: [
        { id: 'bus-a', sentido: -1, valor: '$4240…' },
        { id: 'cart-a', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: 'byte del dibujo' },
        { id: 'ma', sentido: 1, valor: '$0240…$024F' },
        { id: 'md', sentido: 1, valor: 'byte' },
        { id: 'mcs', sentido: 1, nombre: '/MCS', valor: '0' },
      ],
      internos: [['/MWR', '0']],
      pantalla: 'vram',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El número de tesela, en el mapa',
      texto:
        'Después escribe $24 en $98CC: la columna 12, fila 6 del mapa de fondo que empieza en $9800. Por el bus de la VRAM viaja la dirección $18CC y el byte $24.',
      bloques: ['soc', 'vram'],
      senales: [
        { id: 'ma', sentido: 1, valor: '$18CC' },
        { id: 'md', sentido: 1, valor: '$24' },
        { id: 'mcs', sentido: 1, nombre: '/MCS', valor: '0' },
      ],
      internos: [['/MWR', '0']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'Modo 2: la PPU busca los sprites de la línea',
      texto:
        'Cada línea visible empieza con 80 puntos de modo 2: la PPU recorre las 40 entradas de la OAM y apunta hasta 10 sprites cuya altura cubre la línea. En la línea 51 se queda con la lista que usará al mezclar.',
      capa: 'interior',
      bloques: ['oam', 'ppu'],
      placa: ['soc'],
      senales: [{ id: 'oam-ppu', sentido: 1, nombre: 'OAM', valor: '40 entradas' }],
      internos: [['LY', '51']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'Modo 3: lee el número de tesela',
      texto:
        'En el modo 3 el bus de la VRAM es de la PPU. Para la columna 12 de la línea 51 pide la dirección $18CC del mapa (con los desplazamientos SCX y SCY a 0), baja /MCS y /MRD, y la VRAM devuelve $24 por MD0–MD7.',
      bloques: ['soc', 'vram'],
      senales: [
        { id: 'ma', sentido: 1, valor: '$18CC' },
        { id: 'mcs', sentido: 1, nombre: '/MCS', valor: '0' },
        { id: 'md', sentido: -1, valor: '$24' },
      ],
      internos: [['/MRD', '0']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'Los dos bytes de la fila',
      texto:
        'La fila 3 de la tesela $24 está en $8246 y $8247: el primer byte lleva el bit bajo de cada punto ($DF) y el segundo, el alto ($A1). Por el bus viajan las direcciones $0246 y $0247 y vuelven los dos bytes.',
      bloques: ['soc', 'vram'],
      senales: [
        { id: 'ma', sentido: 1, valor: '$0246, $0247' },
        { id: 'mcs', sentido: 1, nombre: '/MCS', valor: '0' },
        { id: 'md', sentido: -1, valor: '$DF, $A1' },
      ],
      internos: [['/MRD', '0']],
      pantalla: 'patron',
    },
    {
      fase: 'Dentro del SoC',
      titulo: 'La cola de puntos junta los bits',
      texto:
        'La PPU empareja los dos bytes bit a bit y mete los 8 índices de 2 bits en su cola de puntos (FIFO), de la que sale uno por punto; los primeros SCX mod 8 se tirarían para el desplazamiento fino. El punto 3 de la fila da 1 en el byte bajo y 0 en el alto: índice 1.',
      capa: 'interior',
      bloques: ['vif', 'ppu'],
      placa: ['soc'],
      senales: [{ id: 'vram-ppu', sentido: 1, nombre: 'bytes', valor: '$DF, $A1' }],
      internos: [['Bits del punto 3', '1 y 0 → índice 1']],
      pantalla: 'mezcla',
    },
    {
      fase: 'Dentro del SoC',
      titulo: 'Sprites y prioridad',
      texto:
        'Cuando el haz llega a la X de un sprite de la lista, la PPU para un momento, lee su dibujo y lo mezcla en la cola de sprites. En el punto 99 ningún sprite tiene un punto opaco, así que sale el del fondo; si lo hubiera, ganaría el sprite salvo que su bit de prioridad lo pusiera detrás de los colores 1–3 del fondo.',
      capa: 'interior',
      bloques: ['oam', 'ppu'],
      placa: ['soc'],
      senales: [],
      internos: [['Sprite en el punto 99', 'ninguno']],
      pantalla: 'prioridad',
      nota: 'Ningún sprite cubre el punto (99, 51): su tono sale del fondo.',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'La paleta BGP da el tono',
      texto:
        'La Game Boy no tiene colores, sino cuatro tonos. El registro BGP ($FF47) dice qué tono toca a cada índice: el juego lo dejó en $D8, que asigna al índice 1 el tono 2, un gris oscuro.',
      capa: 'interior',
      bloques: ['ppu'],
      placa: ['soc'],
      senales: [],
      internos: [
        ['BGP ($FF47)', '$D8'],
        ['Índice 1', 'tono 2'],
      ],
      pantalla: 'paleta',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'El punto viaja a la pantalla',
      texto:
        'El tono sale en dos bits, LD0 = 0 y LD1 = 1, con un flanco del reloj de punto CP; CPL marca el final de cada línea, S el principio del cuadro y FR invierte la polaridad del cristal líquido. Los drivers de la placa de la pantalla reparten la tensión al punto (99, 51) de la matriz de 160 × 144.',
      bloques: ['soc', 'lcd'],
      senales: [
        { id: 'lcdbus', sentido: 1, nombre: 'LD1, LD0', valor: '1, 0' },
        { id: 'sync', sentido: 1 },
      ],
      internos: [
        ['CP', 'un flanco por punto'],
        ['Punto', '(99, 51)'],
      ],
      pantalla: 'punto',
    },
    {
      fase: 'Fin del cuadro',
      titulo: 'Línea 144 otra vez',
      texto:
        'Tras 144 líneas de 456 puntos la imagen está completa y LY vuelve a llegar a 144: nueva interrupción de VBlank, y la CPU, que entretanto ha preparado el cuadro siguiente, vuelve a $0040. El ciclo se repite unas 59,7 veces por segundo.',
      capa: 'interior',
      bloques: ['ppu', 'stat', 'int', 'cpu'],
      placa: ['soc'],
      senales: [
        { id: 'ppu-stat', sentido: 1, nombre: 'modo', valor: '1' },
        { id: 'stat-int', sentido: 1, nombre: 'VBlank', valor: '1' },
        { id: 'int-cpu', sentido: 1, nombre: 'IF.0', valor: '1' },
      ],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'Pan Docs: Rendering overview y PPU modes', url: 'https://gbdev.io/pandocs/Rendering.html', nota: 'modos 2, 3, 0 y 1, 456 puntos por línea' },
    { titulo: 'Pan Docs: Tile Data y Tile Maps', url: 'https://gbdev.io/pandocs/Tile_Data.html', nota: '16 bytes por tesela, byte bajo y alto' },
    { titulo: 'Pan Docs: Palettes', url: 'https://gbdev.io/pandocs/Palettes.html', nota: 'BGP' },
    { titulo: 'Pan Docs: OAM DMA Transfer', url: 'https://gbdev.io/pandocs/OAM_DMA_Transfer.html' },
    { titulo: 'Pan Docs: Interrupts', url: 'https://gbdev.io/pandocs/Interrupts.html', nota: 'VBlank, IF, IE, $0040' },
    { titulo: 'Gekkio: Game Boy schematics (DMG-CPU)', url: 'https://github.com/Gekkio/gb-schematics', nota: 'nombres de las señales' },
    { titulo: 'Rodrigo Copetti: Game Boy Architecture', url: 'https://www.copetti.org/writings/consoles/game-boy/' },
  ],
};
