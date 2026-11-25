// «Un fotograma» of the PlayStation (PU-18): an 8 × 8 texture in 4 bits with a 16-colour CLUT, drawn 1:1 as a
// textured rectangle at (96, 48) of a 320 × 240 frame; row 3, texel 3 → point (99, 51).
//
// Checked against psx-spx («GPU»: 1 MB VRAM of 512 lines of 2048 bytes (1024 × 512 halfwords); 4-bit texels four
// per halfword, the leftmost in bits 0–3; the CLUT a 16 × 1 image in VRAM at an X multiple of 16; 15-bit colour
// with red in bits 0–4; rectangles with vertex, UV + CLUT and size, the texture page set by GP0(E1h); VRAM
// transfers by DMA2 in continuous mode; the ordering table sent by DMA2 in linked-list mode; GP0 at $1F801810, GP1
// at $1F801814), Copetti («PlayStation Architecture»: 2 MB RAM, GTE, no Z-buffer — the CPU orders the polygons;
// 4- and 8-bit textures use a CLUT; output up to 640 × 480 in 16-bit colour), the pu-18 schematic (DREQ2/DACK2,
// VBLANK → ~INTIN0, SR0–7/SG0–7/SB0–7 to the MC141685, the CXA1645M) and the app's «Arquitectura» data
// (arquitectura/ps1.ts). Arithmetic: row 3 = [1, 6, 15, 6, 6, 6, 6, 1] → bytes $61 $6F $66 $16 (leftmost texel in
// the low nibble), halfwords $6F61 and $1666; texel 3 = bits 12–15 of $6F61 → index 6; CLUT entry 6 = $001F (red 31).

import type { FotogramaMaquina } from '../tipos';
import { PELOTA_4BPP } from '../ejemplo';

export const PS1: FotogramaMaquina = {
  maquina: 'ps1',
  entrada:
    'Seguimos una textura de 8 × 8 texeles de 4 bits con su tabla de 16 colores (CLUT), una pelota dibujada a tamaño real con un rectángulo con textura, desde el disco hasta que su punto (99, 51) sale por el Multi Out.',
  ejemplo: {
    ancho: 320,
    alto: 240,
    tesela: 8,
    x: 96,
    y: 48,
    indices: PELOTA_4BPP,
    fila: 3,
    columna: 3,
    // CLUT (15-bit, red in bits 0–4): entry 1 $000F (dark red), 6 $001F (red), 15 $7FFF (white)
    colores: { 1: '#7b0000', 6: '#ff0000', 15: '#ffffff' },
    fondo: '#5a9cff',
    bpp: 4,
    formato: 'nibbles',
    nibbleBajo: true,
    numero: 'de 4 bits',
    color: '$001F',
    pantalla: 'Cuadro en la VRAM',
  },
  pasos: [
    {
      fase: 'Antes del cuadro',
      titulo: 'Del disco a la RAM',
      texto:
        'Al cargar el nivel, el lector leyó del disco los sectores con la textura y su CLUT. El DSP pasó los datos en serie al controlador del CD, que los guardó en su SRAM; la CPU los copió a la RAM principal por el bus de sistema.',
      bloques: ['lector', 'servo', 'cdc', 'cpu', 'ram'],
      senales: [
        { id: 'cddata', sentido: 1, valor: 'sectores' },
        { id: 'cdc', sentido: -1 },
        { id: 'sbus', sentido: -1, valor: 'SD0–SD7' },
        { id: 'ram', sentido: 1, valor: '32 + 32 bytes' },
      ],
      internos: [['Textura', '8 × 8 de 4 bits = 32 bytes']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Antes del cuadro',
      titulo: 'De la RAM a la VRAM',
      texto:
        'La textura pasa a la VRAM con una orden de copia de la CPU a la VRAM por GP0: el destino, el tamaño en medias palabras (2 × 8) y los datos, que lleva la DMA del canal 2. La CLUT se copia igual, como una imagen de 16 × 1 en una X múltiplo de 16.',
      bloques: ['cpu', 'ram', 'gpu', 'vram'],
      senales: [
        { id: 'ram', sentido: -1 },
        { id: 'gpucs', sentido: 1, nombre: 'DACK2, /CS', valor: '0' },
        { id: 'gpud', sentido: 1, valor: 'datos de la textura' },
        { id: 'vram', sentido: 1 },
      ],
      internos: [
        ['DMA', 'canal 2, continuo'],
        ['CLUT', '16 × 1 en la VRAM'],
      ],
      pantalla: 'vram',
    },
    {
      fase: 'CPU',
      titulo: 'La CPU pone el rectángulo en la tabla',
      texto:
        'El juego calcula dónde va la pelota (con el GTE, si fuera un objeto en 3D) y escribe en la RAM el paquete de un rectángulo con textura: el vértice de arriba a la izquierda (96, 48), las coordenadas de textura con la CLUT y el tamaño 8 × 8. Lo engancha en la tabla de orden según su profundidad.',
      bloques: ['cpu', 'ram'],
      senales: [{ id: 'ram', sentido: 1, valor: 'paquete del rectángulo' }],
      internos: [
        ['Vértice', '(96, 48)'],
        ['UV + CLUT', 'texel (0, 0) y la CLUT'],
        ['Tamaño', '8 × 8'],
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'DMA',
      titulo: 'La tabla de orden, a la GPU',
      texto:
        'La DMA del canal 2 recorre la tabla en modo lista enlazada y manda cada paquete a GP0. Antes del rectángulo va la página de textura (GP0 E1h), que en los rectángulos se pone aparte.',
      bloques: ['cpu', 'ram', 'gpu'],
      senales: [
        { id: 'ram', sentido: -1, valor: 'paquetes' },
        { id: 'gpucs', sentido: 1, nombre: 'DACK2, /CS', valor: '0' },
        { id: 'gpud', sentido: 1, valor: 'E1h…, rectángulo' },
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'GPU',
      titulo: 'La fila 3 de la textura',
      texto:
        'La GPU recorre el rectángulo y, en la línea 51, lee de la VRAM la fila 3 de la textura: dos medias palabras, $6F61 y $1666. Cada una guarda cuatro texeles, el de la izquierda en los bits 0 a 3.',
      bloques: ['gpu', 'vram'],
      senales: [{ id: 'vram', sentido: -1, valor: '$6F61, $1666' }],
      internos: [['Bytes', '$61 $6F $66 $16']],
      pantalla: 'patron',
    },
    {
      fase: 'GPU',
      titulo: 'El texel 3: índice 6',
      texto: 'El texel 3 son los bits 12 a 15 de la primera media palabra, $6F61: el índice 6.',
      bloques: ['gpu'],
      senales: [],
      internos: [['Texel 3', '6 (bits 12–15 de $6F61)']],
      pantalla: 'mezcla',
    },
    {
      fase: 'GPU',
      titulo: 'Sin Z-buffer: el orden lo da la tabla',
      texto:
        'La GPU no tiene Z-buffer: lo que llega después se dibuja encima. Por eso la CPU ordena los paquetes por profundidad en la tabla de orden, y la pelota se ve si su paquete llega después que el fondo.',
      bloques: ['gpu', 'cpu'],
      senales: [],
      pantalla: 'prioridad',
    },
    {
      fase: 'GPU',
      titulo: 'De la CLUT, el color',
      texto:
        'El índice 6 elige la entrada 6 de la CLUT, en la VRAM: $001F, color de 15 bits con el rojo en los bits 0 a 4: rojo al máximo.',
      bloques: ['gpu', 'vram'],
      senales: [{ id: 'vram', sentido: -1, valor: '$001F' }],
      internos: [['CLUT[6]', '$001F = R 31, G 0, B 0']],
      pantalla: 'paleta',
    },
    {
      fase: 'GPU',
      titulo: 'El punto, al cuadro que se dibuja',
      texto:
        'La GPU escribe $001F en el punto (99, 51) del cuadro que se está dibujando, en otra zona de la misma VRAM: la imagen, las texturas y las CLUT comparten el mismo 1 MB.',
      bloques: ['gpu', 'vram'],
      senales: [{ id: 'vram', sentido: 1, valor: '$001F' }],
      internos: [['VRAM', '1024 × 512 medias palabras']],
      pantalla: 'paleta',
    },
    {
      fase: 'Vídeo',
      titulo: 'La GPU saca el punto en RGB',
      texto:
        'Cuando ese cuadro ya es el que se muestra, la GPU lo lee de la VRAM línea a línea al ritmo del reloj de vídeo de X201 y, al llegar al punto (99, 51), saca su color en tres buses de 8 bits (SR0–7, SG0–7, SB0–7) hacia el MC141685.',
      bloques: ['gpu', 'vram', 'dacrgb', 'clk'],
      senales: [
        { id: 'xgpu', sentido: 1 },
        { id: 'vram', sentido: -1 },
        { id: 'rgb', sentido: 1, valor: 'R alto, G y B a 0' },
      ],
      pantalla: 'punto',
    },
    {
      fase: 'Vídeo',
      titulo: 'Del DAC al Multi Out',
      texto:
        'El MC141685 convierte los tres colores en tensiones; el CXA1645M hace con ellas el vídeo compuesto y el S-vídeo, que salen por el Multi Out junto con el RGB.',
      bloques: ['dacrgb', 'enc'],
      senales: [{ id: 'analog', sentido: 1, valor: 'R, G, B' }],
      pantalla: 'punto',
    },
    {
      fase: 'Cuadro',
      titulo: 'VBLANK y el cuadro siguiente',
      texto:
        'Al acabar la imagen, la GPU baja VBLANK, que entra en la CPU por ~INTIN0. El juego cambia por GP1 la zona de la VRAM que se muestra y lanza la DMA de la tabla del cuadro siguiente.',
      bloques: ['gpu', 'cpu'],
      senales: [{ id: 'vblank', sentido: 1, valor: 'borrado vertical' }],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'psx-spx, «GPU»', url: 'https://psx-spx.consoledev.net/graphicsprocessingunitgpu/', nota: 'VRAM de 1024 × 512, texeles de 4 bits (el izquierdo en los bits 0–3), CLUT, color de 15 bits, rectángulos, GP0 E1h, DMA del canal 2' },
    { titulo: 'Rodrigo Copetti, «PlayStation Architecture»', url: 'https://www.copetti.org/writings/consoles/playstation/', nota: 'GTE, CLUT de las texturas de 4 y 8 bits, sin Z-buffer: tabla de orden' },
    { titulo: 'xyzz/pu-18 (esquema)', url: 'https://github.com/xyzz/pu-18', nota: 'DREQ2/DACK2, VBLANK → ~INTIN0, SR/SG/SB0–7 al MC141685, CXA1645M' },
  ],
};
