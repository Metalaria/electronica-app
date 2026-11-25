// «Un fotograma» of the Nintendo 64 (NUS-CPU-03, NTSC): an 8 × 8 texture in 4-bit colour index (CI4) with a
// 16-entry palette in 16-bit RGBA, drawn 1:1 as a texture rectangle at (96, 48) of a 320 × 240 frame; row 3,
// texel 3 → point (99, 51).
//
// Checked against Copetti («Nintendo 64 Architecture»: the CPU stores the display list in RAM, the RSP runs it with
// microcode from its 4 KB IMEM/DMEM and passes rasterisation commands to the RDP; textures go into the 4 KB TMEM by
// DMA; the RDP writes the frame buffer (and the Z-buffer) in RAM; the VI turns the frame buffer into the signal for
// the video DAC; assets are copied from the cartridge to RAM first), the Nintendo 64 Programming Manual 13.8
// («Texture Memory»: CI textures keep their palettes in the upper half of TMEM, 16 entries per CI4 palette, RGBA16
// or IA16), N64brew («Video Interface»: VI_ORIGIN, 16-bit 5/5/5/3 or 32-bit frame buffers, the 7-bit multiplexed bus
// to the video DAC, the VI interrupt; «Peripheral Interface»: the cartridge DMA to RDRAM; «Memory map») and the
// app's «Arquitectura» data (arquitectura/n64.ts). Arithmetic: row 3 = bytes 12–15 of the 32-byte texture
// ($16 $F6 $66 $61, the left texel in the high nibble); texel 3 is the low nibble of byte 13 → index 6; palette
// entry 6 = $F801 (RGBA 5/5/5/1: red 31, green 0, blue 0, alpha 1).

import type { FotogramaMaquina } from '../tipos';
import { PELOTA_4BPP } from '../ejemplo';

export const N64: FotogramaMaquina = {
  maquina: 'n64',
  entrada:
    'Seguimos una textura de 8 × 8 texeles en formato CI4 (una pelota con índices de 4 bits y una paleta de 16 colores) dibujada a tamaño real con un rectángulo de textura, desde el cartucho hasta que su punto (99, 51) sale del ENC-NUS hacia la tele.',
  ejemplo: {
    ancho: 320,
    alto: 240,
    tesela: 8,
    x: 96,
    y: 48,
    indices: PELOTA_4BPP,
    fila: 3,
    columna: 3,
    // palette (RGBA16): entry 1 $7801 (dark red), 6 $F801 (red), 15 $FFFF (white)
    colores: { 1: '#7b0000', 6: '#ff0000', 15: '#ffffff' },
    fondo: '#5a9cff',
    bpp: 4,
    formato: 'nibbles',
    numero: 'CI4',
    color: '$F801',
    pantalla: 'Búfer de imagen',
  },
  pasos: [
    {
      fase: 'Antes del cuadro',
      titulo: 'Del cartucho a la RDRAM',
      texto:
        'Al cargar el nivel, el juego copió con la DMA del PI la textura (32 bytes: 64 texeles de 4 bits) y su paleta (16 colores de 2 bytes) de la ROM del cartucho a la RDRAM. El RCP sacó cada dirección por CAD0–CAD15 con ALEH y ALEL y leyó palabras de 16 bits con /RD.',
      bloques: ['cart', 'rcp', 'rdram'],
      senales: [
        { id: 'ale', sentido: 1, nombre: 'ALEH, ALEL, /RD' },
        { id: 'cad', sentido: -1, valor: 'palabras de 16 bits' },
        { id: 'rambus', sentido: 1, valor: '32 + 32 bytes' },
      ],
      internos: [
        ['Formato', 'CI4: 4 bits por texel'],
        ['Paleta', '16 × RGBA16'],
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'CPU',
      titulo: 'La CPU escribe la lista de visualización',
      texto:
        'El VR4300 ejecuta el juego, que calcula dónde va la pelota y escribe en la RDRAM la lista de visualización: cargar la paleta, cargar la textura y dibujar un rectángulo de 8 × 8 con la esquina en (96, 48). Todo pasa por el RCP: la CPU no tiene otro camino a la memoria.',
      bloques: ['cpu', 'rcp', 'rdram'],
      senales: [
        { id: 'sysad', sentido: 1, valor: 'direcciones y datos' },
        { id: 'syscmd', sentido: 1 },
        { id: 'rambus', sentido: 1, valor: 'lista de visualización' },
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'RSP',
      titulo: 'El RSP la convierte en órdenes del RDP',
      texto:
        'La CPU arranca una tarea en el RSP escribiendo sus registros ($04040000…). El RSP trae la lista a su DMEM y la recorre con el microcódigo de su IMEM (4 KB cada una); el resultado son órdenes de rasterizado que pasa al RDP. Mientras, la tele sigue mostrando el cuadro anterior.',
      bloques: ['cpu', 'rcp', 'rdram'],
      senales: [
        { id: 'sysad', sentido: 1, valor: '$A4040010' },
        { id: 'rambus', sentido: -1, valor: 'lista → DMEM' },
      ],
      internos: [['RSP', 'microcódigo de gráficos']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'RDP',
      titulo: 'La paleta y la textura, a la TMEM',
      texto:
        'El RDP copia por DMA la textura de la RDRAM a su memoria de texturas, la TMEM de 4 KB: los índices en la mitad baja y la paleta en la mitad alta, como en todas las texturas de color indexado.',
      bloques: ['rcp', 'rdram'],
      senales: [{ id: 'rambus', sentido: -1, valor: '32 + 32 bytes' }],
      internos: [
        ['TMEM baja', 'índices CI4'],
        ['TMEM alta', 'paleta de 16 entradas'],
      ],
      pantalla: 'vram',
    },
    {
      fase: 'RDP',
      titulo: 'El rectángulo, en su sitio',
      texto:
        'La orden de rectángulo con textura da las esquinas (96, 48) y (103, 55) y la coordenada de textura del primer punto. El RDP recorre el rectángulo línea a línea; seguimos la línea 51 del cuadro, la fila 3 de la textura.',
      bloques: ['rcp'],
      senales: [],
      internos: [
        ['Rectángulo', '(96, 48)–(103, 55)'],
        ['Línea', '51 = 48 + 3'],
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'RDP',
      titulo: 'La fila 3, de la TMEM',
      texto:
        'Cada fila de la textura ocupa 4 bytes, dos texeles por byte. La fila 3 son los bytes 12 a 15: $16, $F6, $66 y $61.',
      bloques: ['rcp'],
      senales: [],
      internos: [['Fila 3', '$16 $F6 $66 $61']],
      pantalla: 'patron',
    },
    {
      fase: 'RDP',
      titulo: 'El texel 3: índice 6',
      texto:
        'El texel izquierdo de cada byte está en los 4 bits altos. El texel 3 es la mitad baja del byte 13 ($F6): el índice 6.',
      bloques: ['rcp'],
      senales: [],
      internos: [['Texel 3', '6 (mitad baja de $F6)']],
      pantalla: 'mezcla',
    },
    {
      fase: 'RDP',
      titulo: 'La profundidad',
      texto:
        'En una escena en 3D el RDP compararía la profundidad del punto con la del Z-buffer, otra zona de la RDRAM, y solo lo escribiría si está delante. Este rectángulo se dibuja encima de lo que haya.',
      bloques: ['rcp', 'rdram'],
      senales: [],
      internos: [['Z-buffer', 'no se usa en este rectángulo']],
      pantalla: 'prioridad',
    },
    {
      fase: 'RDP',
      titulo: 'De la paleta, el color',
      texto:
        'El índice 6 elige la entrada 6 de la paleta de la TMEM: $F801 en RGBA de 16 bits (5 bits de rojo, 5 de verde, 5 de azul y 1 de alfa): rojo al máximo.',
      bloques: ['rcp'],
      senales: [],
      internos: [['Entrada 6', '$F801 = R 31, G 0, B 0, A 1']],
      pantalla: 'paleta',
    },
    {
      fase: 'RDP',
      titulo: 'El punto, al búfer de imagen',
      texto:
        'El mezclador del RDP escribe el punto (99, 51) en el búfer de imagen de la RDRAM, de 16 bits por punto. Cuando la lista termina, el cuadro siguiente está entero en la memoria.',
      bloques: ['rcp', 'rdram'],
      senales: [{ id: 'rambus', sentido: 1, valor: '$F801' }],
      internos: [['Búfer', '320 × 240 × 16 bits']],
      pantalla: 'paleta',
    },
    {
      fase: 'Vídeo',
      titulo: 'El VI lo lee y lo saca por SRGB0–6',
      texto:
        'En la interrupción del VI, el juego apunta VI_ORIGIN al búfer recién dibujado. El VI lo lee línea a línea y, al llegar al punto (99, 51), manda su color al VDC-NUS por el bus de 7 bits multiplexado: 21 bits por punto, en tres partes, a cuatro veces el reloj de punto.',
      bloques: ['rcp', 'rdram', 'vdc', 'clk'],
      senales: [
        { id: 'rambus', sentido: -1, valor: 'línea 51' },
        { id: 'vclk', sentido: 1 },
        { id: 'srgb', sentido: 1, valor: 'rojo, verde, azul' },
      ],
      internos: [['VI_ORIGIN', 'el búfer nuevo']],
      pantalla: 'punto',
    },
    {
      fase: 'Vídeo',
      titulo: 'Del VDC-NUS a la tele',
      texto:
        'El VDC-NUS convierte el color en tres tensiones RGB y el sincronismo; el ENC-NUS hace con ellas la luminancia, la crominancia y el vídeo compuesto NTSC, que salen por el Multi Out.',
      bloques: ['vdc', 'enc', 'av'],
      senales: [
        { id: 'rgb', sentido: 1, valor: 'R alto, G y B bajos' },
        { id: 'yc', sentido: 1, valor: 'Y, C, compuesto' },
      ],
      pantalla: 'punto',
    },
    {
      fase: 'Cuadro',
      titulo: 'Y el cuadro siguiente',
      texto:
        'Cuando el VI llega a la media línea de VI_V_INTR, avisa a la CPU (por el MI, en INT0). El juego vuelve a cambiar VI_ORIGIN y el RDP dibuja el cuadro siguiente en otra zona de la RDRAM.',
      bloques: ['rcp', 'cpu'],
      senales: [{ id: 'int', sentido: 1, nombre: 'INT0', valor: 'interrupción del VI' }],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'Rodrigo Copetti, «Nintendo 64 Architecture»', url: 'https://www.copetti.org/writings/consoles/nintendo-64/', nota: 'lista de visualización, RSP y microcódigo, TMEM de 4 KB, búfer de imagen y Z-buffer en la RDRAM, VI' },
    { titulo: 'Nintendo 64 Programming Manual, 13.8 «Texture Memory»', url: 'https://ultra64.ca/files/documentation/online-manuals/man/pro-man/pro13/13-08.html', nota: 'paletas en la mitad alta de la TMEM, 16 entradas por paleta CI4, RGBA16 o IA16' },
    { titulo: 'N64brew Wiki, «Video Interface»', url: 'https://n64brew.dev/wiki/Video_Interface', nota: 'VI_ORIGIN, búfer de 16 o 32 bits, bus de 7 bits al DAC, interrupción' },
    { titulo: 'N64brew Wiki, «Peripheral Interface»', url: 'https://n64brew.dev/wiki/Peripheral_Interface', nota: 'DMA del cartucho a la RDRAM' },
  ],
};
