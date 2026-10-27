// «Un fotograma» of the NES (NES-CPU-07, NTSC): tile $24 of the background, row 3, pixel 3 → point (99, 51).
//
// Checked against the NESdev Wiki («PPU rendering»: four fetches of 2 dots per tile, two tiles ahead, sprite
// fetches at dots 257–320, VBlank and NMI at line 241 dot 1; «PPU registers»; «PPU attribute tables»; «PPU
// palettes»; «PPU pinout»: ALE and the multiplexed AD0–AD7; «CPU memory map»; OAM DMA: 513 or 514 cycles) and the
// app's own «Arquitectura» data (arquitectura/nes.ts: 74LS139 decoding with M2, latch U2, CIRAM /CE and A10 from
// the cartridge). Arithmetic: nametable $2000 + 6 × 32 + 12 = $20CC; attribute $23C0 + (6 / 4) × 8 + 12 / 4 =
// $23CB, bottom-left quadrant → bits 5–4; pattern $24 × 16 + 3 = $0243 and + 8 = $024B; palette 1 colour 1 → $3F05.

import type { FotogramaMaquina } from '../tipos';
import { PELOTA } from '../ejemplo';

export const NES: FotogramaMaquina = {
  maquina: 'nes',
  entrada:
    'Seguimos la tesela $24 del fondo, una pelota de 8 × 8 puntos, desde que la CPU lee su número en la ROM del cartucho hasta que su punto (99, 51) sale hacia la tele.',
  ejemplo: {
    ancho: 256,
    alto: 240,
    tesela: 8,
    x: 96,
    y: 48,
    indices: PELOTA,
    fila: 3,
    columna: 3,
    // 2C02 colours $16, $30 and $06 over the backdrop $21 (approximate RGB of the composite signal)
    colores: { 1: '#b53120', 2: '#fffeff', 3: '#6e1a0c' },
    fondo: '#64b0ff',
    bpp: 2,
    formato: 'planos',
    numero: '$24',
    color: '$16',
  },
  extra: [
    // PPU /WE (PPU-~{WE}) to the CIRAM: the «Arquitectura» diagram only draws /RD
    { id: 'we', puntos: [[680, 240], [680, 306], [740, 306], [740, 320]], bits: 1, etiqueta: '/WE', pos: [770, 312], clase: 'control', red: '/PPU-~{WE}' },
  ],
  pasos: [
    {
      fase: 'Bus de la CPU',
      titulo: 'La CPU pide una instrucción a la ROM',
      texto:
        'La CPU 2A03 pone en el bus de direcciones su contador de programa, $C0F0, con R/W a 1 porque va a leer. El decodificador 74LS139 ve A15 = 1 y, mientras M2 está alto, baja /ROMSEL: de todos los chips, solo la PRG-ROM del cartucho se da por aludida.',
      bloques: ['cpu', 'dec', 'prg'],
      senales: [
        { id: 'cpu-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$C0F0' },
        { id: 'prg-a', sentido: 1 },
        { id: 'a-dec', sentido: 1, nombre: 'A15', valor: '1' },
        { id: 'm2', sentido: 1, valor: '1' },
        { id: 'romsel', sentido: 1, valor: '0' },
      ],
      internos: [['R/W', '1 (lectura)']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Bus de la CPU',
      titulo: 'La ROM contesta con el código de la instrucción',
      texto:
        'Con /ROMSEL a 0, la ROM saca por D0–D7 el byte guardado en $C0F0: $A9, el código de LDA con un dato inmediato. La CPU lo captura al final de la fase alta de M2 y, en el ciclo siguiente, lee en $C0F1 el dato: $24, el número de la tesela que vamos a seguir hasta la pantalla.',
      bloques: ['prg', 'cpu', 'dec'],
      senales: [
        { id: 'bus-a', sentido: 1, valor: '$C0F0' },
        { id: 'prg-a', sentido: 1 },
        { id: 'romsel', sentido: 1, valor: '0' },
        { id: 'prg-d', sentido: -1 },
        { id: 'bus-d', sentido: -1, valor: '$A9' },
        { id: 'cpu-d', sentido: -1 },
      ],
      internos: [['Instrucción', 'LDA #$24 (A9 24)']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Escritura en la RAM',
      titulo: 'La CPU guarda el valor en la WRAM',
      texto:
        'La instrucción siguiente, STA $0300 (8D 00 03), copia el acumulador en la RAM de trabajo. Con la dirección $0300, A13, A14 y A15 valen 0 y el 74LS139 baja WRAM /CS; la CPU pone R/W a 0 y saca $24 por el bus de datos, y la MB8416 lo guarda. El juego prepara así el cuadro siguiente mientras la PPU dibuja el actual.',
      bloques: ['cpu', 'dec', 'wram'],
      senales: [
        { id: 'cpu-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$0300' },
        { id: 'wram-a', sentido: 1 },
        { id: 'a-dec', sentido: 1, nombre: 'A13–A15', valor: '0' },
        { id: 'm2', sentido: 1, valor: '1' },
        { id: 'wramcs', sentido: 1, valor: '0' },
        { id: 'cpu-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '$24' },
        { id: 'wram-d', sentido: 1 },
      ],
      internos: [['R/W', '0 (escritura)']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'La PPU avisa con /NMI: empieza el borrado vertical',
      texto:
        'Tras la última línea visible (la 239) y una línea de reposo, en la línea 241 la PPU activa su bandera de VBlank y, como el juego puso a 1 el bit 7 de PPUCTRL, baja /NMI. La CPU acaba la instrucción en curso, guarda en la pila el contador de programa y salta a la rutina cuya dirección lee en $FFFA–$FFFB.',
      bloques: ['ppu', 'cpu'],
      senales: [{ id: 'nmi', sentido: 1, valor: '0' }],
      internos: [
        ['Línea', '241, punto 1'],
        ['Vector', '$FFFA–$FFFB'],
      ],
      pantalla: 'cuadro-anterior',
      nota: 'Durante las 20 líneas del borrado vertical la PPU no lee su memoria: es el momento de escribir en ella.',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'Los sprites, por DMA',
      texto:
        'La rutina escribe $02 en $4014 y el 2A03 se encarga solo: detiene la CPU y copia los 256 bytes de $0200–$02FF, la tabla de sprites que el juego mantiene en la WRAM, al registro OAMDATA ($2004) de la PPU. Un byte leído y otro escrito por cada dos ciclos: 513 o 514 ciclos en total.',
      bloques: ['cpu', 'dec', 'wram', 'ppu'],
      senales: [
        { id: 'cpu-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$0200…, $2004' },
        { id: 'wram-a', sentido: 1 },
        { id: 'wramcs', sentido: 1, valor: '0' },
        { id: 'ppucs', sentido: 1, valor: '0' },
        { id: 'wram-d', sentido: -1 },
        { id: 'bus-d', sentido: 1, valor: 'byte de sprite' },
        { id: 'ppu-d', sentido: 1 },
      ],
      internos: [
        ['$4014 (OAMDMA)', '$02'],
        ['Duración', '513–514 ciclos'],
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'La CPU elige una dirección de la memoria de vídeo',
      texto:
        'La CPU no tiene camino directo a la memoria de la PPU: le habla por sus registros. Escribe dos veces en PPUADDR ($2006), primero $20 y luego $CC, y la PPU guarda la dirección $20CC: columna 12, fila 6 de la primera tabla de nombres, el mapa de teselas del fondo.',
      bloques: ['cpu', 'dec', 'ppu'],
      senales: [
        { id: 'cpu-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$2006' },
        { id: 'a-dec', sentido: 1, nombre: 'A13–A15', valor: '1, 0, 0' },
        { id: 'ppucs', sentido: 1, valor: '0' },
        { id: 'ppu-a', sentido: 1, nombre: 'A0–A2', valor: '6' },
        { id: 'cpu-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '$20, $CC' },
        { id: 'ppu-d', sentido: 1 },
      ],
      internos: [['PPUADDR', '$20CC']],
      pantalla: 'vram',
      nota: 'El dibujo de la tesela $24 no hay que copiarlo: está en la CHR-ROM del cartucho, en la tabla de patrones.',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El número de tesela llega a la CIRAM',
      texto:
        'La rutina lee $24 de la WRAM y lo escribe en PPUDATA ($2007). La PPU lo lleva a su memoria por su propio bus: pone el byte bajo de la dirección en AD0–AD7 con ALE a 1 para que el latch 74LS373 lo retenga, después el dato $24 en las mismas líneas, y baja /WE. Como PA13 = 1, el cartucho activa la CIRAM y elige con A10 una de sus dos tablas.',
      bloques: ['ppu', 'latch', 'vram', 'chr'],
      senales: [
        { id: 'ale', sentido: 1, valor: '1' },
        { id: 'bus-ad', sentido: 1, valor: '$CC, $24' },
        { id: 'ad-latch', sentido: 1 },
        { id: 'bus-pa', sentido: 1, valor: '$20CC' },
        { id: 'pa-vram', sentido: 1 },
        { id: 'ad-vram', sentido: 1 },
        { id: 'we', sentido: 1, valor: '0' },
        { id: 'ciramce', sentido: 1, nombre: 'CIRAM /CE', valor: '0' },
        { id: 'a10', sentido: 1, valor: '0' },
      ],
      internos: [['PPUDATA ($2007)', '$24']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'La PPU lee el número de tesela',
      texto:
        'Acaba el borrado y la PPU vuelve a dibujar, línea a línea, leyendo cada tesela 16 puntos antes de mostrarla. En la línea 51 pide el byte $20CC de la tabla de nombres: dirección por AD0–AD7 con ALE, después /RD = 0, y la CIRAM devuelve $24 por las mismas líneas. Cada lectura dura 2 puntos de 186 ns.',
      bloques: ['ppu', 'latch', 'vram'],
      senales: [
        { id: 'ale', sentido: 1, valor: '1' },
        { id: 'ad-latch', sentido: 1 },
        { id: 'bus-pa', sentido: 1, valor: '$20CC' },
        { id: 'pa-vram', sentido: 1 },
        { id: 'rd', sentido: 1, valor: '0' },
        { id: 'ciramce', sentido: 1, nombre: 'CIRAM /CE', valor: '0' },
        { id: 'ad-vram', sentido: -1 },
        { id: 'bus-ad', sentido: -1, valor: '$24' },
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'El byte de atributos elige la paleta',
      texto:
        'En los 2 puntos siguientes lee el byte de atributos $23CB, que reparte paletas por cuadros de 32 × 32 puntos. Nuestra tesela cae en el cuarto inferior izquierdo de su cuadro, así que cuentan sus bits 5 y 4: el byte vale $10 y elige la paleta 1 del fondo.',
      bloques: ['ppu', 'latch', 'vram'],
      senales: [
        { id: 'ale', sentido: 1, valor: '1' },
        { id: 'ad-latch', sentido: 1 },
        { id: 'bus-pa', sentido: 1, valor: '$23CB' },
        { id: 'pa-vram', sentido: 1 },
        { id: 'rd', sentido: 1, valor: '0' },
        { id: 'ciramce', sentido: 1, nombre: 'CIRAM /CE', valor: '0' },
        { id: 'ad-vram', sentido: -1 },
        { id: 'bus-ad', sentido: -1, valor: '$10' },
      ],
      internos: [['Paleta', '1 (bits 5–4 = 01)']],
      pantalla: 'mapa',
      nota: 'Paleta 1 del fondo: sus colores están en $3F05–$3F07; el índice 0 de todas las paletas es el color de fondo común, $3F00.',
    },
    {
      fase: 'Línea a línea',
      titulo: 'Los dos planos del dibujo, desde la CHR-ROM',
      texto:
        'Ahora la dirección cae en la tabla de patrones: tesela $24 × 16 bytes + fila 3 = $0243. Con PA13 = 0 responde la CHR-ROM del cartucho, que da $DF; 2 puntos después, en $024B, 8 bytes más allá, da el segundo plano, $A1. Cada byte guarda un bit de cada uno de los 8 puntos de la fila.',
      bloques: ['ppu', 'latch', 'chr'],
      senales: [
        { id: 'ale', sentido: 1, valor: '1' },
        { id: 'ad-latch', sentido: 1 },
        { id: 'bus-pa', sentido: 1, valor: '$0243, $024B' },
        { id: 'pa-chr', sentido: 1 },
        { id: 'rd', sentido: 1, valor: '0' },
        { id: 'rd-chr', sentido: 1 },
        { id: 'ad-chr', sentido: -1 },
        { id: 'bus-ad', sentido: -1, valor: '$DF, $A1' },
      ],
      pantalla: 'patron',
    },
    {
      fase: 'Dentro de la PPU',
      titulo: 'Se juntan los planos: un índice por punto',
      texto:
        'Los dos bytes entran en dos registros de desplazamiento que avanzan un bit por punto, y el desplazamiento fino X (aquí 0: el juego no ha movido el fondo) elige qué bit sale. En el punto 99 salen un 1 del plano 0 y un 0 del plano 1: índice 1. Los dos bits del atributo se le ponen delante: paleta 1, color 1.',
      bloques: ['ppu'],
      senales: [],
      internos: [
        ['Planos 0 y 1', '1 y 0 → índice 1'],
        ['Con el atributo', '%01 01'],
      ],
      pantalla: 'mezcla',
    },
    {
      fase: 'Dentro de la PPU',
      titulo: 'Sprites y prioridad',
      texto:
        'En cada línea la PPU busca en la OAM hasta 8 sprites que toquen la línea siguiente y lee sus dibujos entre los puntos 257 y 320. En el punto 99 de la línea 51 ninguno tiene un punto opaco, así que pasa el fondo. Si lo hubiera, ganaría el sprite, salvo que su bit de prioridad lo mandara detrás de un fondo opaco.',
      bloques: ['ppu'],
      senales: [],
      internos: [['Sprite en el punto 99', 'ninguno']],
      pantalla: 'prioridad',
      nota: 'Ningún sprite cubre el punto (99, 51): su color sale del fondo.',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'La paleta da el color: $16',
      texto:
        'Los 5 bits (fondo, paleta 1, color 1) apuntan a la entrada $3F05 de la memoria de paletas, 32 bytes dentro de la propia PPU que el juego escribió en un borrado anterior, también por $2006 y $2007. Allí hay un $16: matiz 6, un rojo, con luminancia 1.',
      bloques: ['ppu'],
      senales: [],
      internos: [
        ['Entrada de paleta', '$3F05'],
        ['Color', '$16'],
      ],
      pantalla: 'paleta',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'El punto sale como vídeo compuesto',
      texto:
        'La PPU no da RGB: su generador de vídeo convierte $16 directamente en señal compuesta NTSC, la subportadora con la fase del matiz 6 sobre el nivel de la luminancia 1. El transistor Q1 la lleva al conector de A/V y al modulador de RF. El punto (99, 51) dura 186 ns.',
      bloques: ['ppu', 'av'],
      senales: [{ id: 'video', sentido: 1, valor: 'compuesto' }],
      internos: [['Punto', '(99, 51)']],
      pantalla: 'punto',
    },
    {
      fase: 'Fin del cuadro',
      titulo: 'Cuadro acabado: /NMI otra vez',
      texto:
        'La PPU repite lo mismo en los 61 440 puntos de las 240 líneas visibles. Al llegar a la línea 241 vuelve a activar VBlank y a bajar /NMI; la CPU, que entretanto ha preparado el cuadro siguiente en la WRAM, salta de nuevo a la rutina y todo empieza otra vez, unas 60 veces por segundo.',
      bloques: ['ppu', 'cpu'],
      senales: [{ id: 'nmi', sentido: 1, valor: '0' }],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'NESdev Wiki: PPU rendering', url: 'https://www.nesdev.org/wiki/PPU_rendering', nota: 'orden de las lecturas, sprites, VBlank y NMI' },
    { titulo: 'NESdev Wiki: PPU registers', url: 'https://www.nesdev.org/wiki/PPU_registers', nota: 'PPUCTRL, PPUADDR, PPUDATA, OAMDMA' },
    { titulo: 'NESdev Wiki: PPU attribute tables', url: 'https://www.nesdev.org/wiki/PPU_attribute_tables' },
    { titulo: 'NESdev Wiki: PPU palettes', url: 'https://www.nesdev.org/wiki/PPU_palettes' },
    { titulo: 'NESdev Wiki: PPU pinout', url: 'https://www.nesdev.org/wiki/PPU_pinout', nota: 'ALE, AD0–AD7, /RD, /WE' },
    { titulo: 'Rodrigo Copetti: NES Architecture', url: 'https://www.copetti.org/writings/consoles/nes/' },
  ],
};
