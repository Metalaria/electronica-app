// «Un fotograma» of the Master System II (171-5922A, PAL): tile $24 of the background, row 3, pixel 3 → point
// (99, 51).
//
// Checked against SMS Power! (Charles MacDonald's «Sega Master System VDP documentation»: ports $BE/$BF, the
// two-byte address and code word, mode 4 name table entries, 4 bitplanes interleaved per row, CRAM --BBGGRR, 8
// sprites per line, the frame interrupt) and the app's «Arquitectura» data (arquitectura/sms.ts: the 315-5237
// decoding /CE0 /CE1 /CE3 with /CSRAM from the VDP, the VDP port decoding with A0, A6, A7 and /IOREQ, the two PSRAMs
// on the multiplexed AD bus, 16 bits per access, /INT in IM 1 → $0038). Arithmetic: name table $3800 + (6 × 32 +
// 12) × 2 = $3998 (word $1CCC); pattern $24 × 32 + 3 × 4 = $048C (words $0446 and $0447); index 6 → CRAM 6.

import type { FotogramaMaquina } from '../tipos';
import { PELOTA_4BPP } from '../ejemplo';

export const SMS: FotogramaMaquina = {
  maquina: 'sms',
  entrada:
    'Seguimos la tesela $24 del fondo, una pelota de 8 × 8 puntos, desde que el Z80 lee su número en el cartucho hasta que su punto (99, 51) sale del VDP hacia la tele.',
  ejemplo: {
    ancho: 256,
    alto: 192,
    tesela: 8,
    x: 96,
    y: 48,
    indices: PELOTA_4BPP,
    fila: 3,
    columna: 3,
    // CRAM (--BBGGRR): 0 $39 (sky), 1 $01 (dark red), 6 $03 (red), 15 $3F (white)
    colores: { 1: '#550000', 6: '#ff0000', 15: '#ffffff' },
    fondo: '#55aaff',
    bpp: 4,
    formato: 'planos',
    numero: '$24',
    color: '$03',
  },
  pasos: [
    {
      fase: 'Bus del Z80',
      titulo: 'El Z80 lee una instrucción del cartucho',
      texto:
        'El Z80 saca la dirección $0200 y baja /MREQ y /RD. El 315-5237 decodifica las líneas altas y baja /CE3, la selección del cartucho, que devuelve $3E, el código de LD A con un dato inmediato; en el ciclo siguiente llega el dato, $24, el número de la tesela que vamos a seguir.',
      bloques: ['z80', 'io', 'cart'],
      senales: [
        { id: 'z80-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$0200' },
        { id: 'a-io', sentido: 1 },
        { id: 'cart-a', sentido: 1 },
        { id: 'ctl', sentido: 1, nombre: '/MREQ, /RD', valor: '0' },
        { id: 'ce3', sentido: 1, valor: '0' },
        { id: 'cart-d', sentido: -1 },
        { id: 'bus-d', sentido: -1, valor: '$3E, $24' },
        { id: 'z80-d', sentido: -1 },
      ],
      internos: [['Instrucción', 'LD A,$24 (3E 24)']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Bus del Z80',
      titulo: 'Y guarda el valor en la RAM',
      texto:
        'Con LD ($C100),A la dirección cae en $C000–$FFFF. Esa zona la detecta el VDP, que baja /CSRAM; el 315-5237 la convierte en /CE1 y la RAM de 8 KB guarda el $24 cuando el Z80 baja /WR.',
      bloques: ['z80', 'vdp', 'io', 'ram'],
      senales: [
        { id: 'z80-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$C100' },
        { id: 'a-vdp', sentido: 1, nombre: 'A15, A14', valor: '1, 1' },
        { id: 'csram', sentido: 1, valor: '0' },
        { id: 'ce1', sentido: 1, valor: '0' },
        { id: 'ram-a', sentido: 1 },
        { id: 'ctl', sentido: 1, nombre: '/MREQ, /WR', valor: '0' },
        { id: 'z80-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '$24' },
        { id: 'ram-d', sentido: 1 },
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El VDP pide /INT: se acabó la imagen',
      texto:
        'Tras la última de las 192 líneas visibles, el VDP activa su bandera de cuadro y, como el juego lo permitió en el registro 1, baja /INT. El Z80, en modo de interrupción 1, salta a $0038; al leer el puerto de control $BF la bandera se borra y /INT sube.',
      bloques: ['vdp', 'z80'],
      senales: [{ id: 'int', sentido: 1, valor: '0' }],
      internos: [['Vector', '$0038 (IM 1)']],
      pantalla: 'cuadro-anterior',
      nota: 'Durante el borrado vertical el VDP no dibuja: es el momento de escribir en la VRAM.',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El dibujo de la tesela llega a la VRAM',
      texto:
        'El Z80 no ve la VRAM y la Master System no tiene DMA: todo pasa por los puertos del VDP. Un OUT a $BF con $80 y $44 fija la dirección $0480 en modo escritura, y un OTIR manda los 32 bytes del dibujo al puerto $BE. El VDP los lleva a la VRAM por el bus AD: primero la dirección, que las PSRAM retienen al bajar /CE, y después el dato.',
      bloques: ['z80', 'vdp', 'vram'],
      senales: [
        { id: 'z80-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: 'puerto $BE' },
        { id: 'a-vdp', sentido: 1, nombre: 'A7, A6, A0', valor: '1, 0, 0' },
        { id: 'iorq', sentido: 1, valor: '0' },
        { id: 'z80-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: 'byte del dibujo' },
        { id: 'd-vdp', sentido: 1 },
        { id: 'ad', sentido: 1, valor: '$0480…$049F' },
        { id: 'vce', sentido: 1, nombre: '/CE, /WE', valor: '0' },
      ],
      internos: [['Puerto $BF', '$80, $44 → $0480']],
      pantalla: 'vram',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El número de tesela, en la tabla de nombres',
      texto:
        'La tabla de nombres empieza en $3800 y cada entrada ocupa 2 bytes. La de la columna 12, fila 6 está en $3998: $98 y $79 al puerto $BF, y después $24 y $00 al puerto $BE. El $00 alto dice paleta del fondo, sin volteos ni prioridad.',
      bloques: ['z80', 'vdp', 'vram'],
      senales: [
        { id: 'bus-a', sentido: 1, valor: 'puerto $BE' },
        { id: 'iorq', sentido: 1, valor: '0' },
        { id: 'bus-d', sentido: 1, valor: '$24, $00' },
        { id: 'd-vdp', sentido: 1 },
        { id: 'ad', sentido: 1, valor: '$3998' },
        { id: 'vce', sentido: 1, nombre: '/CE, /WE', valor: '0' },
      ],
      internos: [['Puerto $BF', '$98, $79 → $3998']],
      pantalla: 'mapa',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El color, en la CRAM',
      texto:
        'La CRAM, 32 colores de 6 bits, está dentro del VDP. $06 y $C0 al puerto $BF eligen la entrada 6 en modo CRAM, y $03 al puerto $BE la deja con rojo al máximo (bits RR = 11) y sin verde ni azul.',
      bloques: ['z80', 'vdp'],
      senales: [
        { id: 'bus-a', sentido: 1, valor: 'puertos $BF, $BE' },
        { id: 'iorq', sentido: 1, valor: '0' },
        { id: 'bus-d', sentido: 1, valor: '$06, $C0, $03' },
        { id: 'd-vdp', sentido: 1 },
      ],
      internos: [['CRAM 6', '$03 (--BBGGRR)']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'El VDP lee la entrada del mapa',
      texto:
        'En la línea 51 el VDP pide la palabra $1CCC (bytes $3998 y $3999): las dos PSRAM, una con los bytes pares y otra con los impares, contestan a la vez por AD0–AD15. Llega $0024: tesela $24, paleta del fondo.',
      bloques: ['vdp', 'vram'],
      senales: [
        { id: 'ad', sentido: -1, valor: '$0024' },
        { id: 'vce', sentido: 1, nombre: '/CE, /OE', valor: '0' },
      ],
      internos: [['Dirección de palabra', '$1CCC']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'Los cuatro planos de la fila',
      texto:
        'La fila 3 de la tesela $24 ocupa 4 bytes desde $048C, uno por plano. Con dos lecturas de 16 bits, las palabras $0446 y $0447, el VDP recibe $A1, $7E, $7E y $20.',
      bloques: ['vdp', 'vram'],
      senales: [
        { id: 'ad', sentido: -1, valor: '$7EA1, $207E' },
        { id: 'vce', sentido: 1, nombre: '/CE, /OE', valor: '0' },
      ],
      internos: [['Direcciones de palabra', '$0446, $0447']],
      pantalla: 'patron',
    },
    {
      fase: 'Dentro del VDP',
      titulo: 'Se juntan los planos: índice 6',
      texto:
        'El VDP toma un bit de cada plano para cada punto. El punto 3 de la fila da 0, 1, 1 y 0 en los planos 0 a 3: índice %0110 = 6. Con la paleta del fondo, la entrada de la CRAM es la 6. El desplazamiento horizontal y vertical está a 0.',
      bloques: ['vdp'],
      senales: [],
      internos: [['Planos 0–3 del punto 3', '0, 1, 1, 0 → 6']],
      pantalla: 'mezcla',
    },
    {
      fase: 'Dentro del VDP',
      titulo: 'Sprites y prioridad',
      texto:
        'En cada línea el VDP busca en la tabla de sprites hasta 8 que la toquen y lee sus dibujos en el borrado horizontal. En el punto 99 de la línea 51 no hay ninguno opaco; si lo hubiera, taparía el fondo salvo que el bit de prioridad de la entrada del mapa pusiera la tesela delante.',
      bloques: ['vdp'],
      senales: [],
      internos: [['Sprite en el punto 99', 'ninguno']],
      pantalla: 'prioridad',
      nota: 'Ningún sprite cubre el punto (99, 51): su color sale del fondo.',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'La CRAM da el color: $03',
      texto:
        'La entrada 6 de la CRAM vale $03: dos bits por canal, rojo 3, verde 0, azul 0. Los convertidores del VDP lo pasan a tres tensiones analógicas, R, G y B.',
      bloques: ['vdp'],
      senales: [],
      internos: [
        ['CRAM 6', '$03'],
        ['R, G, B', '3, 0, 0'],
      ],
      pantalla: 'paleta',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'El punto sale hacia la tele',
      texto:
        'R, G, B y /SYNC salen del VDP hacia el CXA1145, que con la subportadora SC del 315-5237 forma el vídeo compuesto PAL; el modulador lo convierte en señal de antena. El punto (99, 51) dura unos 188 ns.',
      bloques: ['vdp', 'av', 'io'],
      senales: [
        { id: 'rgb', sentido: 1, nombre: 'R, G, B', valor: 'rojo' },
        { id: 'sc', sentido: 1, valor: '4,43 MHz' },
      ],
      internos: [['Punto', '(99, 51)']],
      pantalla: 'punto',
    },
    {
      fase: 'Fin del cuadro',
      titulo: 'Cuadro acabado: /INT otra vez',
      texto:
        'Tras las 192 líneas visibles el VDP vuelve a bajar /INT; el Z80, que ha preparado el cuadro siguiente en la RAM, salta otra vez a $0038. En la Master System II PAL esto se repite 50 veces por segundo, cada 313 líneas.',
      bloques: ['vdp', 'z80'],
      senales: [{ id: 'int', sentido: 1, valor: '0' }],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'SMS Power!: Sega Master System VDP documentation (Charles MacDonald)', url: 'https://www.smspower.org/uploads/Development/msvdp-20021112.txt', nota: 'puertos, tabla de nombres, planos, CRAM, sprites, interrupción de cuadro' },
    { titulo: 'SMS Power!: VDP registers', url: 'https://www.smspower.org/Development/VDPRegisters' },
    { titulo: 'SMS Power!: Tilemap', url: 'https://www.smspower.org/Development/Tilemap' },
    { titulo: 'Rodrigo Copetti: Master System Architecture', url: 'https://www.copetti.org/writings/consoles/master-system/' },
  ],
};
