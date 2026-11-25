// «Un fotograma» of the GameCube (DOL-CPU(P)-01, PAL): an 8 × 8 texture in CI4 (4-bit colour indices, a 16-entry
// palette in RGB565) drawn 1:1 on a quad at (96, 48) of a 640 × 528 frame; row 3, texel 3 → point (99, 51).
//
// Checked against YAGCD (ch. 4/5: the write gather pipe at $CC00_8000, the VI's XFB address register $CC00_201C and
// its line interrupts, the PI interrupt causes; ch. 17: the XFB's two bytes per point, Y with Cb or Cr), Copetti
// (the GPU stages: command processor reading the FIFO in main memory, transform, rasteriser, four texture units with
// the 1 MB texture memory, the 16-stage TEV, the pixel engine and the 2 MB EFB, the copy to the XFB, the VI), libogc
// (gx.h: GX_QUADS = $80, GX_TF_CI4, GX_TL_RGB565; gx.c: 4-bit textures in 8 × 8 tiles of 32 bytes; the EFB stride of
// 640 points; video.c: the PAL 640 × 528 mode), Dolphin's C4 decoder (left texel in the high nibble, consulted only)
// and the app's «Arquitectura» data (arquitectura/gamecube.ts). Arithmetic: row 3 of the tile = bytes 12–15 of its
// 32; texel 3 is the low nibble of byte 13; palette entry 6 = $F800 (RGB565 red).

import type { FotogramaMaquina } from '../tipos';
import { PELOTA_4BPP } from '../ejemplo';

export const GAMECUBE: FotogramaMaquina = {
  maquina: 'gamecube',
  entrada:
    'Seguimos una textura de 8 × 8 texeles en formato CI4 (una pelota con índices de 4 bits y una paleta de 16 colores) dibujada sobre un cuadrado a tamaño real, desde que el Gekko pide dibujarla hasta que su punto (99, 51) sale de la consola hacia la tele.',
  ejemplo: {
    ancho: 640,
    alto: 528,
    tesela: 8,
    x: 96,
    y: 48,
    indices: PELOTA_4BPP,
    fila: 3,
    columna: 3,
    // palette (TLUT, RGB565): entry 1 $7800 (dark red), 6 $F800 (red), 15 $FFFF (white); the EFB is cleared to a sky blue
    colores: { 1: '#7b0000', 6: '#ff0000', 15: '#ffffff' },
    fondo: '#5a9cff',
    bpp: 4,
    formato: 'nibbles',
    numero: 'CI4',
    color: '$F800',
    pantalla: 'Búfer de imagen',
  },
  pasos: [
    {
      fase: 'Antes del cuadro',
      titulo: 'La textura llegó del disco',
      texto:
        'Al cargar el nivel, la interfaz del disco (DI) trajo de la unidad, por DMA, la textura y su paleta a la memoria principal: 32 bytes de texeles (una sola tesela de 8 × 8 en formato CI4, dos texeles por byte) y 16 colores de 2 bytes en RGB565.',
      bloques: ['dvd', 'flipper', 'ram'],
      senales: [
        { id: 'di', sentido: -1, valor: 'datos del disco' },
        { id: 'sur', sentido: 1, valor: '32 + 32 bytes' },
      ],
      internos: [
        ['Formato', 'CI4 (GX_TF_CI4)'],
        ['Paleta', 'RGB565 (GX_TL_RGB565)'],
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Gekko',
      titulo: 'El juego decide dónde va la pelota',
      texto:
        'El Gekko ejecuta el programa del juego, que lee de la memoria principal a través de Flipper (y casi siempre de sus cachés). Calcula que la pelota va en un cuadrado de 8 × 8 puntos con la esquina en (96, 48). Mientras, la tele sigue mostrando el cuadro anterior.',
      bloques: ['gekko', 'flipper', 'ram'],
      senales: [
        { id: 'sur', sentido: -1 },
        { id: 'norte', sentido: -1, valor: 'instrucciones' },
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Gekko',
      titulo: 'Las órdenes van por la tubería de escritura',
      texto:
        'El Gekko escribe la orden de dibujo en $CC00_8000: GX_QUADS ($80), cuatro vértices, y por cada uno su posición y su coordenada de textura. La tubería de escritura agrupada junta las escrituras y las manda a Flipper en ráfagas de 32 bytes por el bus de 64 bits.',
      bloques: ['gekko', 'flipper'],
      senales: [{ id: 'norte', sentido: 1, valor: 'ráfaga de 32 bytes' }],
      internos: [
        ['Dirección', '$CC00_8000'],
        ['Orden', '$80 (GX_QUADS), 4 vértices'],
      ],
      pantalla: 'vram',
    },
    {
      fase: 'Dentro de Flipper',
      titulo: 'Las órdenes esperan en la cola',
      texto:
        'Flipper deja cada ráfaga al final de la cola de órdenes, que está en la memoria principal. El procesador de órdenes (CP) la va leyendo por su lado: así el Gekko no tiene que esperar a que el dibujo acabe.',
      capa: 'interior',
      bloques: ['i-gekko', 'pi', 'mi', 'i-ram', 'cp'],
      placa: ['gekko', 'flipper', 'ram'],
      senales: [
        { id: 'i-nb', sentido: 1 },
        { id: 'i-wgp', sentido: 1, valor: '32 bytes' },
        { id: 'i-mi-ram', sentido: -1 },
        { id: 'i-mi-cp', sentido: 1, valor: 'orden $80' },
      ],
      pantalla: 'vram',
    },
    {
      fase: 'Dentro de Flipper',
      titulo: 'Transformación: el cuadrado se coloca en la pantalla',
      texto:
        'El bloque de transformación (XF) pasa cada vértice por la matriz de la cámara. Aquí el cuadrado está de frente y a tamaño real: sus esquinas caen en (96, 48) y (104, 56) del búfer de imagen, y las coordenadas de textura van de (0, 0) a (1, 1).',
      capa: 'interior',
      bloques: ['cp', 'xf'],
      placa: ['flipper'],
      senales: [{ id: 'i-cp-xf', sentido: 1, valor: '4 vértices' }],
      internos: [['Esquinas', '(96, 48) – (104, 56)']],
      pantalla: 'mapa',
    },
    {
      fase: 'Dentro de Flipper',
      titulo: 'Rasterizado: qué puntos cubre',
      texto:
        'El montaje parte el cuadrado en triángulos y el rasterizador decide qué puntos cubren: los 64 de 96–103 × 48–55. Para el punto (99, 51) interpola la coordenada de textura: texel 3 de la fila 3.',
      capa: 'interior',
      bloques: ['xf', 'su'],
      placa: ['flipper'],
      senales: [
        { id: 'i-xf-su', sentido: 1 },
        { id: 'i-su-tx', sentido: 1, valor: 's = 3, t = 3' },
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'Texturas',
      titulo: 'La tesela entra en la memoria de texturas',
      texto:
        'La unidad de texturas no lee la memoria principal punto a punto: trae la tesela entera, 32 bytes, a su memoria de 1 MB dentro de Flipper (y la paleta, que se cargó antes con GX_LoadTlut). La fila 3 son los bytes 12 a 15: cuatro bytes, dos texeles en cada uno.',
      capa: 'interior',
      bloques: ['i-ram', 'mi', 'tx'],
      placa: ['flipper', 'ram'],
      senales: [
        { id: 'i-mi-ram', sentido: -1, valor: '32 bytes' },
        { id: 'i-mi-tx', sentido: 1 },
      ],
      internos: [['Fila 3', 'bytes 12–15 de la tesela']],
      pantalla: 'patron',
    },
    {
      fase: 'Texturas',
      titulo: 'El índice del texel',
      texto:
        'En CI4, cada byte lleva dos texeles: el de la izquierda en los 4 bits altos. El texel 3 es la mitad baja del byte 13 (el segundo de la fila) y vale 6: todavía no es un color, es un índice de la paleta.',
      capa: 'interior',
      bloques: ['tx'],
      placa: ['flipper'],
      senales: [],
      internos: [
        ['Byte 13', '4 bits altos: texel 2; bajos: texel 3'],
        ['Índice', '6'],
      ],
      pantalla: 'mezcla',
    },
    {
      fase: 'Texturas',
      titulo: 'La paleta da el color',
      texto:
        'La unidad de texturas busca la entrada 6 de la paleta: $F800 en RGB565, rojo puro. El TEV, que aquí solo tiene una etapa, deja pasar el color de la textura tal cual.',
      capa: 'interior',
      bloques: ['tx', 'tev'],
      placa: ['flipper'],
      senales: [{ id: 'i-tx-tev', sentido: 1, valor: '$F800' }],
      internos: [['Paleta[6]', '$F800 → rojo']],
      pantalla: 'paleta',
    },
    {
      fase: 'Píxeles',
      titulo: 'Al búfer de imagen interno',
      texto:
        'El motor de píxeles compara la profundidad del punto con la que ya hay en el EFB, la pasa (no hay nada delante) y escribe el rojo en (99, 51) del búfer de imagen de 2 MB que Flipper lleva dentro. Cada fila del EFB mide siempre 640 puntos.',
      capa: 'interior',
      bloques: ['tev', 'pe'],
      placa: ['flipper'],
      senales: [{ id: 'i-tev-pe', sentido: 1, valor: 'rojo' }],
      internos: [['EFB', 'punto (99, 51), prueba Z superada']],
      pantalla: 'paleta',
      nota: 'El punto ya está en el EFB, pero el EFB no se ve: la tele muestra el XFB.',
    },
    {
      fase: 'Píxeles',
      titulo: 'Copia del EFB al XFB',
      texto:
        'Con todo el cuadro dibujado, el programa pide la copia del EFB a un XFB en la memoria principal. Al copiar, Flipper convierte el color al formato que lee la interfaz de vídeo: 2 bytes por punto, la luminancia con Cb o Cr.',
      capa: 'interior',
      bloques: ['pe', 'mi', 'i-ram'],
      placa: ['flipper', 'ram'],
      senales: [
        { id: 'i-pe-mi', sentido: 1, valor: '640 × 528 puntos' },
        { id: 'i-mi-ram', sentido: 1 },
      ],
      pantalla: 'paleta',
    },
    {
      fase: 'Vídeo',
      titulo: 'La interfaz de vídeo cambia de XFB',
      texto:
        'En una interrupción de línea de la VI, el programa escribe la dirección del nuevo XFB en $CC00_201C. Desde el siguiente campo, la VI lee ese XFB: el cuadro anterior se acaba.',
      capa: 'interior',
      bloques: ['vi', 'pi', 'i-gekko'],
      placa: ['flipper', 'gekko'],
      senales: [
        { id: 'i-int', sentido: -1, valor: 'VI' },
        { id: 'i-nb', sentido: -1 },
      ],
      internos: [['VI ($CC00_201C)', 'dirección del XFB nuevo']],
      pantalla: 'paleta',
    },
    {
      fase: 'Vídeo',
      titulo: 'Línea 51: la VI lee el punto',
      texto:
        'Al llegar a la línea 51, la VI lee del XFB los bytes de esa línea y los saca por el bus de vídeo digital de 8 bits: un byte de luminancia y uno de color por muestra, 13,5 millones de muestras por segundo.',
      capa: 'interior',
      bloques: ['i-ram', 'mi', 'vi', 'i-ave'],
      placa: ['flipper', 'ram', 'ave'],
      senales: [
        { id: 'i-mi-ram', sentido: -1 },
        { id: 'i-mi-vi', sentido: 1, valor: 'línea 51' },
        { id: 'i-vi-ave', sentido: 1, valor: 'Y, Cr' },
      ],
      pantalla: 'punto',
    },
    {
      fase: 'Vídeo',
      titulo: 'El AVE lo convierte en señal analógica',
      texto:
        'El codificador AVE (U6, en la cara de abajo) recibe el vídeo digital y saca el punto rojo por el conector P7: en esta consola PAL, como RGB y como vídeo compuesto. Si hay un cable digital, el mismo vídeo sale también por P2 con su reloj de 54 MHz.',
      bloques: ['flipper', 'ave', 'digital'],
      senales: [
        { id: 'video', sentido: 1, valor: 'Y, Cr' },
        { id: 'video-d', sentido: 1 },
      ],
      internos: [['Punto', '(99, 51)']],
      pantalla: 'punto',
    },
    {
      fase: 'Fin del cuadro',
      titulo: 'El siguiente cuadro empieza igual',
      texto:
        'Mientras la VI muestra este XFB, el Gekko ya prepara el cuadro siguiente y el procesador gráfico lo dibuja en el EFB. En PAL, 50 campos por segundo.',
      bloques: ['gekko', 'flipper', 'ram'],
      senales: [
        { id: 'int', sentido: 1, valor: 'VI' },
        { id: 'norte', sentido: 1 },
      ],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'Rodrigo Copetti: GameCube Architecture', url: 'https://www.copetti.org/writings/consoles/gamecube/', nota: 'etapas del procesador gráfico, EFB, XFB y VI' },
    { titulo: 'YAGCD: Hardware Registers', url: 'https://www.gc-forever.com/yagcd/chap5.html', nota: 'tubería de escritura, registros de la VI' },
    { titulo: 'YAGCD: Graphic Formats', url: 'https://www.gc-forever.com/yagcd/chap17.html', nota: 'formato del XFB' },
    { titulo: 'devkitPro/libogc: gx.h y gx.c', url: 'https://github.com/devkitPro/libogc', nota: 'GX_QUADS, CI4 en teselas de 8 × 8, paleta RGB565, EFB de 640 puntos' },
    { titulo: 'Dolphin: TextureDecoder_Generic.cpp', url: 'https://github.com/dolphin-emu/dolphin', nota: 'orden de los texeles en CI4 (solo consultado)' },
  ],
};
