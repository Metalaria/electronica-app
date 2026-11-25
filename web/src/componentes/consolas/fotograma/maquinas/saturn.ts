// «Un fotograma» of the Sega Saturn (VA0.5): cell $24 of the background plane NBG0, 16 colours with palette 1, row 3,
// pixel 3 → point (99, 51).
//
// Checked against Sega's «VDP2 User's Manual» (ST-058-R2): cells of 8 × 8 dots, 4 bits per dot = 32 bytes per cell
// on a 20H-byte boundary (table 4.2), so character $24 starts at $24 × $20 = $0480 and its row 3 at $048C; 2-word
// pattern name data: palette number in bits 22–16, character number in bits 14–0 (figure 4.9); colour RAM mode 0:
// 5-bit B, G, R in bits 14–0 (figure 3.9), palette 1 colour 6 = entry 16 + 6 = 22 at $05F00000 + 22 × 2 = $05F0002C;
// up to five background planes and the VDP1's frame buffer mixed by priority. Memory map, SCU and interrupt level F
// for V-Blank-IN: «SCU User's Manual» ST-097-R5. Nets of the schematic: /BCS2 to the VDP2, FBD0–FBD7 from the VDP1's
// frame buffers, RED/GREEN/BLUE and CSYNC to the CXA1645. Arithmetic: plane map at VRAM $4000 with 64 two-word
// entries per row: $4000 + (6 × 64 + 12) × 4 = $4630.

import type { FotogramaMaquina } from '../tipos';
import { PELOTA_4BPP } from '../ejemplo';

export const SATURN: FotogramaMaquina = {
  maquina: 'saturn',
  entrada:
    'Seguimos la celda $24 del plano de fondo NBG0, una pelota de 8 × 8 puntos en 16 colores con la paleta 1, desde que la SH-2 maestra la escribe en la VRAM del VDP2 hasta que su punto (99, 51) sale hacia la tele.',
  ejemplo: {
    ancho: 320,
    alto: 224,
    tesela: 8,
    x: 96,
    y: 48,
    indices: PELOTA_4BPP,
    fila: 3,
    columna: 3,
    // CRAM mode 0 (-BBBBBGGGGGRRRRR): palette 1 colour 1 $000C, 6 $001F (red), 15 $7FFF; backdrop $5000 (blue)
    colores: { 1: '#630000', 6: '#ff0000', 15: '#ffffff' },
    fondo: '#0000a5',
    bpp: 4,
    formato: 'nibbles',
    numero: '$24',
    color: '$001F',
  },
  pasos: [
    {
      fase: 'Bus de la CPU',
      titulo: 'La SH-2 maestra lee su programa',
      texto:
        'Tras el arranque la SH-2 maestra ejecuta el juego desde la WORK RAM-H: saca la dirección por CA1–CA26 y baja /CS3, la selección de la SDRAM, que devuelve la instrucción por CD0–CD31. Casi siempre el código ya está en su caché de 4 KB y ni sale al bus.',
      bloques: ['sh2m', 'wramh'],
      senales: [
        { id: 'm-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$06004000' },
        { id: 'h-a', sentido: 1 },
        { id: 'cs3', sentido: 1, valor: '0' },
        { id: 'h-d', sentido: -1 },
        { id: 'bus-d', sentido: -1, valor: 'instrucción' },
        { id: 'm-d', sentido: -1 },
      ],
      internos: [['Zona', 'WORK RAM-H ($06000000)']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Bus B',
      titulo: 'El dibujo de la celda, en la VRAM del VDP2',
      texto:
        'Cada celda de 16 colores ocupa 32 bytes y empieza en un múltiplo de $20: la $24 va en $0480 de la VRAM. La SH-2 escribe en $25E00480 (la misma zona sin caché): baja /CS2, la SCU pasa el acceso al bus B con /BCS2 y el VDP2 lo guarda en su banco A0. Una DMA de la SCU haría lo mismo sin la CPU.',
      bloques: ['sh2m', 'scu', 'vdp2', 'vram2'],
      senales: [
        { id: 'bus-a', sentido: 1, valor: '$25E00480…' },
        { id: 'cs2', sentido: 1, valor: '0' },
        { id: 'scu-a', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '32 bytes' },
        { id: 'scu-d', sentido: 1 },
        { id: 'bbus-scu', sentido: 1 },
        { id: 'bbus', sentido: 1, valor: '16 bits por ciclo' },
        { id: 'b-vdp2', sentido: 1 },
        { id: 'bcs2', sentido: 1, valor: '0' },
        { id: 'vram2-bus', sentido: 1, valor: '$0480–$049F' },
      ],
      internos: [['Celda $24', '$24 × $20 = $0480']],
      pantalla: 'vram',
    },
    {
      fase: 'Bus B',
      titulo: 'La entrada del mapa de NBG0',
      texto:
        'El mapa de NBG0 empieza aquí en $4000 de la VRAM con 64 entradas de dos palabras por fila; la de la columna 12, fila 6 está en $4000 + (6 × 64 + 12) × 4 = $4630. La SH-2 escribe $0001 0024: paleta 1 en los bits 22–16 y celda $24 en los 15 bits bajos.',
      bloques: ['sh2m', 'scu', 'vdp2', 'vram2'],
      senales: [
        { id: 'bus-a', sentido: 1, valor: '$25E04630' },
        { id: 'cs2', sentido: 1, valor: '0' },
        { id: 'bbus', sentido: 1, valor: '$0001, $0024' },
        { id: 'bcs2', sentido: 1, valor: '0' },
        { id: 'vram2-bus', sentido: 1, valor: '$4630' },
      ],
      internos: [['Entrada', '$00010024: paleta 1, celda $24']],
      pantalla: 'mapa',
    },
    {
      fase: 'Bus B',
      titulo: 'El color, en la CRAM',
      texto:
        'La CRAM está dentro del VDP2, en $25F00000. En el modo 0 cada color es una palabra con 5 bits de azul, verde y rojo. El color 6 de la paleta 1 es la entrada 16 + 6 = 22, en $25F0002C; la SH-2 escribe $001F: rojo 31, verde 0, azul 0.',
      bloques: ['sh2m', 'scu', 'vdp2'],
      senales: [
        { id: 'bus-a', sentido: 1, valor: '$25F0002C' },
        { id: 'cs2', sentido: 1, valor: '0' },
        { id: 'bbus', sentido: 1, valor: '$001F' },
        { id: 'bcs2', sentido: 1, valor: '0' },
      ],
      internos: [['CRAM, entrada 22', '$001F']],
      pantalla: 'mapa',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'V-Blank-IN: la SCU avisa a la SH-2',
      texto:
        'Tras la última línea visible el VDP2 baja /VINT. La SCU lo convierte en una interrupción de nivel F por /IRL1–/IRL3 y la SH-2 maestra salta a la rutina del vector $40. Es el momento de cambiar mapas y colores sin que se vea.',
      bloques: ['vdp2', 'scu', 'sh2m'],
      senales: [
        { id: 'vint', sentido: 1, valor: '0' },
        { id: 'irl', sentido: 1, valor: 'nivel F' },
      ],
      internos: [
        ['Interrupción', 'V-Blank-IN'],
        ['Vector', '$40'],
      ],
      pantalla: 'cuadro-anterior',
      nota: 'En el borrado el VDP2 no lee la VRAM para la imagen: las escrituras no interfieren con el dibujo.',
    },
    {
      fase: 'Mientras tanto',
      titulo: 'El VDP1 dibuja su cuadro',
      texto:
        'En paralelo, el VDP1 lee su lista de órdenes y pinta sprites y polígonos en uno de sus dos búferes de imagen. En el punto que seguimos no dibuja nada: ese punto de su búfer queda transparente.',
      bloques: ['vdp1', 'vram1'],
      senales: [{ id: 'vram1-bus', sentido: 1, valor: 'órdenes y texturas' }],
      internos: [['Búfer en (99, 51)', 'transparente']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'El VDP2 lee la entrada del mapa',
      texto:
        'El VDP2 no tiene búfer de imagen: compone cada línea mientras se barre. En la línea 51 lee de la VRAM la entrada $4630 de NBG0: $0001 0024, paleta 1, celda $24. Lee a la vez los dos bancos, A y B, para atender varios planos en el mismo tiempo de punto.',
      bloques: ['vdp2', 'vram2'],
      senales: [{ id: 'vram2-bus', sentido: -1, valor: '$00010024' }],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'Los 4 bytes de la fila',
      texto:
        'La fila 3 de la celda $24 está en $0480 + 3 × 4 = $048C: llegan $16, $F6, $66 y $61. Con 4 bits por punto, cada medio byte es ya el código de color de un punto, el de la izquierda en los 4 bits altos.',
      bloques: ['vdp2', 'vram2'],
      senales: [{ id: 'vram2-bus', sentido: -1, valor: '$16, $F6, $66, $61' }],
      pantalla: 'patron',
    },
    {
      fase: 'Dentro del VDP2',
      titulo: 'El código del punto: 6 de la paleta 1',
      texto:
        'El punto 3 es el medio byte bajo de $F6: código 6. La entrada del mapa añade la paleta 1, así que el color saldrá de la entrada 16 + 6 = 22 de la CRAM. El desplazamiento de NBG0 está a 0.',
      bloques: ['vdp2'],
      senales: [],
      internos: [['Punto 3', '$F6 → 6, paleta 1']],
      pantalla: 'mezcla',
    },
    {
      fase: 'Dentro del VDP2',
      titulo: 'Planos, búfer del VDP1 y prioridad',
      texto:
        'El VDP2 compara, punto a punto, la prioridad de cada plano de fondo y la del punto que le llega del búfer del VDP1 por FBD. Aquí el VDP1 no dibujó nada y los demás planos son transparentes en (99, 51): gana NBG0. Si el código fuera 0, se vería el color de fondo.',
      bloques: ['vdp1', 'vdp2'],
      senales: [{ id: 'fb', sentido: 1, valor: 'transparente' }],
      internos: [['Gana', 'NBG0']],
      pantalla: 'prioridad',
      nota: 'Ningún sprite cubre el punto (99, 51).',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'La CRAM da el color: $001F',
      texto:
        'La entrada 22 de la CRAM vale $001F. Para la salida el VDP2 completa cada canal hasta 8 bits añadiendo tres ceros: rojo 248, verde 0, azul 0, y lo convierte en tensión en sus salidas RGB.',
      bloques: ['vdp2'],
      senales: [],
      internos: [
        ['CRAM 22', '$001F'],
        ['R, G, B', '248, 0, 0'],
      ],
      pantalla: 'paleta',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'El punto sale hacia la tele',
      texto:
        'RED, GREEN, BLUE y el sincronismo salen del VDP2 hacia el codificador CXA1645, que forma el vídeo compuesto y el S-vídeo (NTSC en esta placa, PAL en la europea) y los lleva, con el RGB, al conector de A/V.',
      bloques: ['vdp2', 'av'],
      senales: [{ id: 'rgb', sentido: 1, nombre: 'RGB', valor: 'rojo' }],
      internos: [['Punto', '(99, 51)']],
      pantalla: 'punto',
    },
    {
      fase: 'Fin del cuadro',
      titulo: 'Línea 224: V-Blank-IN otra vez',
      texto:
        'Tras las 224 líneas visibles el VDP2 vuelve a pedir V-Blank-IN. El VDP1 cambia de búfer y la SH-2 maestra, que ha preparado el cuadro siguiente con ayuda de la esclava, vuelve a la rutina del vector $40: 60 veces por segundo en esta placa NTSC, 50 en una PAL.',
      bloques: ['vdp2', 'scu', 'sh2m'],
      senales: [
        { id: 'vint', sentido: 1, valor: '0' },
        { id: 'irl', sentido: 1, valor: 'nivel F' },
      ],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'Sega: VDP2 User\'s Manual (ST-058-R2, 1994)', url: 'https://github.com/luckyseoul/saturn-docs/blob/main/files/ST-058-R2-060194.pdf', nota: 'celdas de 32 bytes en límites de $20, datos de nombre de dos palabras, CRAM modo 0' },
    { titulo: 'Sega: SCU User\'s Manual (ST-097-R5, 1994)', url: 'https://github.com/luckyseoul/saturn-docs/blob/main/files/ST-097-R5-072694.pdf', nota: 'mapa de memoria; V-Blank-IN de nivel F, vector $40' },
    { titulo: 'Sega: Saturn Overview Manual (ST-103-R1, 1994)', url: 'https://github.com/luckyseoul/saturn-docs/blob/main/files/ST-103-R1-040194.pdf', nota: 'VDP1 con dos búferes, VDP2 hasta cinco planos' },
    { titulo: 'Rodrigo Copetti: Sega Saturn Architecture', url: 'https://www.copetti.org/writings/consoles/sega-saturn/', nota: 'el VDP2 compone sin búfer, al ritmo del barrido' },
  ],
};
