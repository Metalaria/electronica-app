// «Un fotograma» of the Mega Drive (model 1 VA6.8, PAL): tile $24 of plane A with palette 1, row 3, pixel 3 →
// point (99, 51).
//
// Checked against plutiedev («VDP ports», «VDP commands»: the 32-bit address and code word, «DMA», «Tiles»: 4 bits
// per pixel packed two per byte, «Planes»: name table entries PCCV HTTT TTTT TTTT, «Palettes»: CRAM ----BBB-GGG-RRR-,
// «Sprites»), Sega Retro («Sega Mega Drive/Interrupts»: VINT level 6, vector $78) and the app's «Arquitectura» data
// (arquitectura/megadrive.ts: 315-5433 decoding with /CE0 and /DTACK, the VDP's /RAS0 /CAS0 for the work RAM, /BR
// /BG for its DMA, the VRAM's random port A0–A7 with RAS/CAS and serial port SD0–SD7 with SC). Arithmetic: plane A
// at $C000, 64 entries per row: $C000 + (6 × 64 + 12) × 2 = $C318; pattern $24 × 32 + 3 × 4 = $048C; palette 1
// colour 6 → CRAM byte (16 + 6) × 2 = $2C.

import type { FotogramaMaquina } from '../tipos';
import { PELOTA_4BPP } from '../ejemplo';

export const MEGADRIVE: FotogramaMaquina = {
  maquina: 'megadrive',
  entrada:
    'Seguimos la tesela $24 del plano A, una pelota de 8 × 8 puntos pintada con la paleta 1, desde que el 68000 lee su entrada en la ROM del cartucho hasta que su punto (99, 51) sale del VDP hacia la tele.',
  ejemplo: {
    ancho: 320,
    alto: 224,
    tesela: 8,
    x: 96,
    y: 48,
    indices: PELOTA_4BPP,
    fila: 3,
    columna: 3,
    // CRAM (----BBB-GGG-RRR-): palette 1 colour 1 $0006, 6 $000E (red), 15 $0EEE; backdrop $0E84
    colores: { 1: '#6d0000', 6: '#ff0000', 15: '#ffffff' },
    fondo: '#4992ff',
    bpp: 4,
    formato: 'nibbles',
    numero: '$24',
    color: '$000E',
  },
  pasos: [
    {
      fase: 'Bus del 68000',
      titulo: 'El 68000 lee una instrucción del cartucho',
      texto:
        'El 68000 saca $000300 por VA1–VA23, baja /AS y deja R/W a 1. El 315-5433 decodifica la dirección y baja /CE0, la selección de la ROM, que pone la palabra $33FC en VD0–VD15; el árbitro contesta con /DTACK y el 68000 la captura. Es el principio de MOVE.W #$2024,$FF0100: el valor $2024 dice tesela $24, paleta 1.',
      bloques: ['m68k', 'io', 'cart'],
      senales: [
        { id: 'm68-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$000300' },
        { id: 'io-a', sentido: 1 },
        { id: 'cart-a', sentido: 1 },
        { id: 'ce0', sentido: 1, valor: '0' },
        { id: 'cart-d', sentido: -1 },
        { id: 'bus-d', sentido: -1, valor: '$33FC' },
        { id: 'm68-d', sentido: -1 },
        { id: 'dtack', sentido: 1, valor: '0' },
      ],
      internos: [
        ['/AS, R/W', '0, 1'],
        ['Instrucción', 'MOVE.W #$2024,$FF0100'],
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Bus del 68000',
      titulo: 'Y guarda el valor en la RAM de trabajo',
      texto:
        'La escritura va a $FF0100 con /UDS y /LDS bajos (los dos bytes) y R/W a 0. La RAM de 64 KB son dos PSRAM que no se gobiernan solas: el VDP, que también las refresca, les da /RAS0 y /CAS0. El valor $2024 queda guardado hasta que llegue el borrado vertical.',
      bloques: ['m68k', 'io', 'vdp', 'wram'],
      senales: [
        { id: 'm68-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$FF0100' },
        { id: 'ram-a', sentido: 1 },
        { id: 'ras0', sentido: 1, valor: '0' },
        { id: 'm68-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '$2024' },
        { id: 'ram-d', sentido: 1 },
        { id: 'dtack', sentido: 1, valor: '0' },
      ],
      internos: [['/UDS, /LDS, R/W', '0, 0, 0']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'Línea 224: el VDP pide VINT',
      texto:
        'Tras la última de las 224 líneas visibles el VDP pide la interrupción vertical: baja /IPL1 y /IPL2, que el 68000 lee como nivel 6. Acaba la instrucción en curso, guarda el contador de programa y el registro de estado y salta a la rutina cuya dirección está en el vector $78.',
      bloques: ['vdp', 'm68k'],
      senales: [{ id: 'ipl', sentido: 1, valor: '0, 0' }],
      internos: [
        ['Nivel', '6'],
        ['Vector', '$78'],
      ],
      pantalla: 'cuadro-anterior',
      nota: 'En el borrado vertical el VDP no dibuja y la DMA va más deprisa: es cuando se actualiza la VRAM.',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El dibujo de la tesela, por DMA',
      texto:
        'La rutina programa en el VDP la longitud (16 palabras) y el origen en la ROM, y escribe la orden $4480 0080: escribir en la VRAM desde $0480 por DMA. El VDP pide el bus con /BR, el 68000 lo suelta con /BG y se queda parado mientras el VDP lee cada palabra del cartucho y la escribe en la VRAM por su puerto aleatorio.',
      bloques: ['vdp', 'm68k', 'io', 'cart', 'vram'],
      senales: [
        { id: 'br', sentido: 1, valor: '0' },
        { id: 'bg', sentido: 1, valor: '0' },
        { id: 'vdp-a', sentido: 1 },
        { id: 'bus-a', sentido: -1, valor: '$012480…' },
        { id: 'cart-a', sentido: 1 },
        { id: 'ce0', sentido: 1, valor: '0' },
        { id: 'cart-d', sentido: -1 },
        { id: 'bus-d', sentido: 1, valor: 'palabra del dibujo' },
        { id: 'vdp-d', sentido: -1 },
        { id: 'vram-bus', sentido: 1, valor: '$0480…$049F' },
      ],
      internos: [
        ['Orden ($C00004)', '$4480 0080'],
        ['Longitud', '16 palabras'],
      ],
      pantalla: 'vram',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'La entrada del plano A',
      texto:
        'El plano A empieza en $C000 con 64 entradas de 2 bytes por fila; la de la columna 12, fila 6 está en $C318. El 68000 escribe la orden $4318 0003 en el puerto de control ($C00004) y la palabra $2024 en el de datos ($C00000). El 315-5433 selecciona el VDP y este la escribe en la VRAM.',
      bloques: ['m68k', 'io', 'vdp', 'vram'],
      senales: [
        { id: 'm68-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$C00004, $C00000' },
        { id: 'io-a', sentido: 1 },
        { id: 'vdpsel', sentido: 1, valor: '0' },
        { id: 'm68-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '$4318, $0003, $2024' },
        { id: 'vdp-d', sentido: -1 },
        { id: 'vram-bus', sentido: 1, valor: '$C318' },
      ],
      internos: [['Entrada', '$2024: paleta 1, tesela $24']],
      pantalla: 'mapa',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El color, en la CRAM',
      texto:
        'La CRAM, 64 colores de 9 bits en cuatro paletas, está dentro del VDP. La orden $C02C 0000 apunta al color 6 de la paleta 1 y la palabra $000E lo deja con rojo 7, verde 0 y azul 0.',
      bloques: ['m68k', 'io', 'vdp'],
      senales: [
        { id: 'bus-a', sentido: 1, valor: '$C00004, $C00000' },
        { id: 'vdpsel', sentido: 1, valor: '0' },
        { id: 'bus-d', sentido: 1, valor: '$C02C, $0000, $000E' },
        { id: 'vdp-d', sentido: -1 },
      ],
      internos: [['CRAM, paleta 1, color 6', '$000E']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'El VDP lee la entrada del plano A',
      texto:
        'Para dibujar, el VDP lee la VRAM por su puerto serie, mucho más rápido: da la dirección por A0–A7 (fila con RAS, columna con CAS) y los bytes salen por SD0–SD7 al ritmo de SC. En la línea 51 lee la entrada $C318 del plano A: $2024.',
      bloques: ['vdp', 'vram'],
      senales: [
        { id: 'vram-bus', sentido: 1, valor: '$C318' },
        { id: 'vram-sd', sentido: -1, valor: '$20, $24' },
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'Los 4 bytes de la fila',
      texto:
        'Cada tesela ocupa 32 bytes, 4 por fila; la fila 3 de la tesela $24 empieza en $048C. Llegan $16, $F6, $66 y $61. Aquí no hay planos que juntar: cada medio byte es ya el índice de un punto, el de la izquierda en los 4 bits altos.',
      bloques: ['vdp', 'vram'],
      senales: [
        { id: 'vram-bus', sentido: 1, valor: '$048C' },
        { id: 'vram-sd', sentido: -1, valor: '$16, $F6, $66, $61' },
      ],
      pantalla: 'patron',
    },
    {
      fase: 'Dentro del VDP',
      titulo: 'El índice del punto: 6 de la paleta 1',
      texto:
        'El punto 3 es el medio byte bajo de $F6: índice 6. La entrada del plano añade la paleta, 1, así que el color saldrá de la entrada 16 + 6 = 22 de la CRAM. Los desplazamientos del plano (la tabla de scroll horizontal y la VSRAM) están a 0.',
      bloques: ['vdp'],
      senales: [],
      internos: [['Punto 3', '$F6 → 6, paleta 1']],
      pantalla: 'mezcla',
    },
    {
      fase: 'Dentro del VDP',
      titulo: 'Planos, sprites y prioridad',
      texto:
        'El VDP mezcla el plano B, el plano A y hasta 20 sprites por línea, y cada uno lleva un bit de prioridad. En el punto 99 de la línea 51 ningún sprite es opaco y el plano A tapa al B, así que gana nuestro índice; si fuera 0, transparente, se vería el color de fondo que elige el registro 7.',
      bloques: ['vdp'],
      senales: [],
      internos: [['Gana', 'plano A']],
      pantalla: 'prioridad',
      nota: 'Ningún sprite cubre el punto (99, 51) y el plano A va delante del B.',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'La CRAM da el color: $000E',
      texto:
        'La entrada 22 de la CRAM vale $000E: 3 bits por canal, rojo 7, verde 0 y azul 0. Los convertidores del VDP lo pasan a tres tensiones, R, G y B.',
      bloques: ['vdp'],
      senales: [],
      internos: [
        ['CRAM 22', '$000E'],
        ['R, G, B', '7, 0, 0'],
      ],
      pantalla: 'paleta',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'El punto sale hacia la tele',
      texto:
        'R, G, B y el sincronismo salen del VDP hacia el codificador de vídeo (un CXA1145 en el esquema; la placa PAL de la foto lleva un MB3514), que forma el vídeo compuesto PAL y lo manda al conector de A/V y al modulador. En el modo de 320 puntos cada uno dura unos 150 ns.',
      bloques: ['vdp', 'av'],
      senales: [{ id: 'rgb', sentido: 1, nombre: 'RGB', valor: 'rojo' }],
      internos: [['Punto', '(99, 51)']],
      pantalla: 'punto',
    },
    {
      fase: 'Fin del cuadro',
      titulo: 'Línea 224: VINT otra vez',
      texto:
        'Tras las 224 líneas visibles el VDP vuelve a pedir la interrupción de nivel 6. El 68000, que ha preparado el cuadro siguiente en la RAM de trabajo, vuelve a la rutina del vector $78: 50 veces por segundo en esta consola PAL, cada 313 líneas.',
      bloques: ['vdp', 'm68k'],
      senales: [{ id: 'ipl', sentido: 1, valor: '0, 0' }],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'Plutiedev: VDP commands', url: 'https://plutiedev.com/vdp-commands', nota: 'órdenes de escritura en VRAM y CRAM' },
    { titulo: 'Plutiedev: DMA transfer', url: 'https://plutiedev.com/dma-transfer' },
    { titulo: 'Plutiedev: Tiles', url: 'https://plutiedev.com/tiles', nota: '4 bits por punto, dos por byte' },
    { titulo: 'Plutiedev: Planes', url: 'https://plutiedev.com/planes', nota: 'formato de las entradas' },
    { titulo: 'Plutiedev: Palettes', url: 'https://plutiedev.com/palettes', nota: 'CRAM de 9 bits' },
    { titulo: 'Sega Retro: Sega Mega Drive/Interrupts', url: 'https://segaretro.org/Sega_Mega_Drive/Interrupts', nota: 'VINT de nivel 6' },
    { titulo: 'Rodrigo Copetti: Mega Drive / Genesis Architecture', url: 'https://www.copetti.org/writings/consoles/mega-drive-genesis/' },
  ],
};
