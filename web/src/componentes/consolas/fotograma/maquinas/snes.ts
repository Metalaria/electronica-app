// «Un fotograma» of the Super Nintendo (SNSP-CPU-01, PAL): tile $24 of BG1 in mode 1 with palette 1, row 3,
// pixel 3 → point (99, 51) of the picture.
//
// Checked against the SNESdev Wiki («PPU registers»: VMAIN, VMADD, VMDATA, BG1SC, BG12NBA, CGADD, CGDATA, INIDISP;
// «Tiles»: 4bpp tiles, planes 0/1 then 2/3; «Tilemaps»: vhopppcc cccccccc; «DMA registers»: DMAP, BBAD, A1T, A1B,
// DAS, MDMAEN; «Timing»: NMI at the start of vertical blank), anomie's register documents and the app's
// «Arquitectura» data (arquitectura/snes.ts: the A bus CA0–CA23 with /ROMSEL and /RAMSEL, the B bus PA0–PA7, DMA over
// both buses at once, PPU1 with the two VRAM chips, PPU2 with CGRAM, the S-ENC; nets /CPURD, /CPUWR, /PARD, /PAWR,
// CHR0–3, COLOR0–2). Arithmetic: BG1SC = $7C → map at word $7C00, entry $7C00 + 6 × 32 + 12 = $7CCC; tile $24 × 16
// words = $0240, row 3 at word $0243 (planes 0 and 1) and $024B (planes 2 and 3); palette 1 colour 6 → CGRAM $16.

import type { FotogramaMaquina } from '../tipos';
import { PELOTA_4BPP } from '../ejemplo';

export const SNES: FotogramaMaquina = {
  maquina: 'snes',
  entrada:
    'Seguimos la tesela $24 del fondo 1, una pelota de 8 × 8 puntos pintada con la paleta 1, desde que la CPU lee su número en la ROM del cartucho hasta que su punto (99, 51) sale del S-ENC hacia la tele.',
  ejemplo: {
    ancho: 256,
    alto: 224,
    tesela: 8,
    x: 96,
    y: 48,
    indices: PELOTA_4BPP,
    fila: 3,
    columna: 3,
    // CGRAM (BGR555): palette 1 colour 1 $000F, 6 $001F (red), 15 $7FFF; backdrop (CGRAM 0) $7E6B
    colores: { 1: '#7b0000', 6: '#ff0000', 15: '#ffffff' },
    fondo: '#5a9cff',
    bpp: 4,
    formato: 'planos',
    numero: '$24',
    color: '$001F',
  },
  pasos: [
    {
      fase: 'Bus A',
      titulo: 'La CPU lee una instrucción del cartucho',
      texto:
        'La CPU 5A22 saca la dirección $008000 por el bus A (CA0–CA23) y baja /CPURD. Esa zona es ROM, así que baja también /ROMSEL y el cartucho devuelve $A9, el código de LDA con un dato inmediato; después llega el dato, $24, el número de la tesela que vamos a seguir.',
      bloques: ['cpu', 'cart'],
      senales: [
        { id: 'cpu-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$008000' },
        { id: 'cart-a', sentido: 1 },
        { id: 'romsel', sentido: 1, valor: '0' },
        { id: 'cart-d', sentido: -1 },
        { id: 'bus-d', sentido: -1, valor: '$A9, $24' },
        { id: 'cpu-d', sentido: -1 },
      ],
      internos: [
        ['/CPURD', '0'],
        ['Instrucción', 'LDA #$24 (A9 24)'],
      ],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Bus A',
      titulo: 'Y guarda el valor en la WRAM',
      texto:
        'Con STA $7E0100 la dirección cae en los bancos $7E–$7F: la CPU baja /RAMSEL y /CPUWR y la WRAM de 128 KB guarda el $24. El juego prepara así el cuadro siguiente mientras las PPU dibujan el actual.',
      bloques: ['cpu', 'wram'],
      senales: [
        { id: 'cpu-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$7E0100' },
        { id: 'wram-a', sentido: 1 },
        { id: 'ramsel', sentido: 1, valor: '0' },
        { id: 'cpu-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '$24' },
        { id: 'wram-d', sentido: 1 },
      ],
      internos: [['/CPUWR', '0']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'Empieza el borrado: NMI',
      texto:
        'Tras la última línea de la imagen (la 224) la PPU2 avisa a la CPU por VBLANK. Como el juego activó la NMI en $4200, la CPU termina la instrucción y salta a la rutina cuya dirección está en $00FFEA. Mientras, lee sola los dos mandos.',
      bloques: ['ppu2', 'cpu'],
      senales: [{ id: 'blank', sentido: 1, nombre: 'VBLANK', valor: 'activa' }],
      internos: [['Vector (modo nativo)', '$00FFEA']],
      pantalla: 'cuadro-anterior',
      nota: 'Durante el borrado vertical las PPU no leen la VRAM: es cuando se puede escribir en ella.',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El dibujo de la tesela, por DMA',
      texto:
        'La rutina pone la dirección de VRAM $0240 en VMADD, programa el canal 0 (origen $01:8240 en la ROM, destino $18, es decir, VMDATA, 32 bytes) y escribe 1 en $420B. La CPU se para y la DMA mueve cada byte en un solo acceso de 8 ciclos maestros: lo lee del cartucho por el bus A y a la vez lo escribe en la PPU1 por el bus B.',
      bloques: ['cpu', 'cart', 'ppu1', 'vram'],
      senales: [
        { id: 'cpu-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$018240…' },
        { id: 'cart-a', sentido: 1 },
        { id: 'romsel', sentido: 1, valor: '0' },
        { id: 'cart-d', sentido: -1 },
        { id: 'bus-d', sentido: 1, valor: 'byte del dibujo' },
        { id: 'ppu1-d', sentido: -1 },
        { id: 'cpu-b', sentido: 1 },
        { id: 'bus-b', sentido: 1, valor: '$18, $19' },
        { id: 'ppu1-b', sentido: -1 },
        { id: 'vram-a', sentido: -1, valor: '$0240…$024F' },
        { id: 'vram-d', sentido: -1 },
      ],
      internos: [
        ['/CPURD, /PAWR', '0, 0'],
        ['DMA canal 0', '32 bytes'],
      ],
      pantalla: 'vram',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El número de tesela, en el mapa del fondo 1',
      texto:
        'El mapa del fondo 1 empieza en la palabra $7C00 (BG1SC = $7C) y la entrada de la columna 12, fila 6 es la $7CCC. La CPU escribe la dirección en VMADD ($2116–$2117) y la entrada $0424 en VMDATA ($2118–$2119): tesela $24, paleta 1, sin volteos ni prioridad. Por el bus B viajan los números de registro, PA = $16 a $19.',
      bloques: ['cpu', 'ppu1', 'vram'],
      senales: [
        { id: 'cpu-b', sentido: 1 },
        { id: 'bus-b', sentido: 1, valor: '$16…$19' },
        { id: 'ppu1-b', sentido: -1 },
        { id: 'cpu-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '$CC, $7C, $24, $04' },
        { id: 'ppu1-d', sentido: -1 },
        { id: 'vram-a', sentido: -1, valor: '$7CCC' },
        { id: 'vram-d', sentido: -1, valor: '$0424' },
      ],
      internos: [['/PAWR', '0']],
      pantalla: 'mapa',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El color, en la CGRAM de la PPU2',
      texto:
        'En el modo 1, la paleta 1 de un fondo de 4 bits ocupa las entradas 16 a 31 de la CGRAM. La CPU escribe $16 (la entrada 22: paleta 1, color 6) en CGADD ($2121) y dos bytes en CGDATA ($2122): $1F y $00, el color de 15 bits $001F, rojo al máximo.',
      bloques: ['cpu', 'ppu2'],
      senales: [
        { id: 'cpu-b', sentido: 1 },
        { id: 'bus-b', sentido: 1, valor: '$21, $22' },
        { id: 'ppu2-b', sentido: -1 },
        { id: 'cpu-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '$16, $1F, $00' },
        { id: 'ppu2-d', sentido: -1 },
      ],
      internos: [['CGRAM $16', '$001F']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'La PPU1 lee la entrada del mapa',
      texto:
        'En la línea 51 de la imagen la PPU1 pide la palabra $7CCC a las dos memorias de vídeo a la vez, cada una con su bus de 8 bits: la de los bytes bajos devuelve $24 y la de los altos, $04. Entrada $0424: tesela $24, paleta 1.',
      bloques: ['ppu1', 'vram'],
      senales: [
        { id: 'vram-a', sentido: -1, valor: '$7CCC' },
        { id: 'vram-d', sentido: 1, valor: '$0424' },
      ],
      internos: [['/VRD', '0']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'Los cuatro planos de la fila',
      texto:
        'Una tesela de 4 bits ocupa 16 palabras: primero los planos 0 y 1 de sus 8 filas y después los planos 2 y 3. Para la fila 3 la PPU1 lee la palabra $0243, que trae $A1 y $7E, y la $024B, que trae $7E y $20.',
      bloques: ['ppu1', 'vram'],
      senales: [
        { id: 'vram-a', sentido: -1, valor: '$0243, $024B' },
        { id: 'vram-d', sentido: 1, valor: '$7EA1, $207E' },
      ],
      internos: [['/VRD', '0']],
      pantalla: 'patron',
    },
    {
      fase: 'De la PPU1 a la PPU2',
      titulo: 'Se juntan los planos: índice 6',
      texto:
        'La PPU1 toma un bit de cada plano para cada punto, con el desplazamiento del fondo (BG1HOFS y BG1VOFS) a 0. El punto 3 da 0, 1, 1 y 0 en los planos 0 a 3: índice 6. Lo pasa a la PPU2 con su paleta por las líneas CHR0–CHR3 y COLOR0–COLOR2, y la prioridad por PRIO0–PRIO1.',
      bloques: ['ppu1', 'ppu2'],
      senales: [{ id: 'ppu12', sentido: 1, valor: '6, paleta 1' }],
      internos: [['Planos 0–3 del punto 3', '0, 1, 1, 0 → 6']],
      pantalla: 'mezcla',
    },
    {
      fase: 'Dentro de la PPU2',
      titulo: 'Capas, sprites y prioridad',
      texto:
        'La PPU2 decide qué se ve en cada punto entre los tres fondos del modo 1 y hasta 32 sprites por línea, con las ventanas y la mezcla de color. En el punto 99 de la línea 51 no hay sprite ni otro fondo opaco delante, así que gana el fondo 1.',
      bloques: ['ppu2'],
      senales: [],
      internos: [['Gana', 'fondo 1']],
      pantalla: 'prioridad',
      nota: 'Ningún sprite ni otro fondo cubre el punto (99, 51): gana el fondo 1.',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'La CGRAM da el color: $001F',
      texto:
        'Paleta 1, índice 6: la entrada $16 de la CGRAM vale $001F, cinco bits por canal con el rojo a 31. El brillo de INIDISP está al máximo ($0F), así que el color no se atenúa.',
      bloques: ['ppu2'],
      senales: [],
      internos: [
        ['CGRAM $16', '$001F'],
        ['R, G, B', '31, 0, 0'],
      ],
      pantalla: 'paleta',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'El punto sale hacia la tele',
      texto:
        'Los convertidores de la PPU2 dan tres tensiones, R, G y B, que salen tal cual por el Multi Out y entran en el S-ENC, que forma el S-vídeo y el compuesto PAL; el modulador da la señal de antena. Cada punto dura unos 188 ns.',
      bloques: ['ppu2', 'enc'],
      senales: [{ id: 'rgb', sentido: 1, valor: 'rojo' }],
      internos: [['Punto', '(99, 51)']],
      pantalla: 'punto',
    },
    {
      fase: 'Fin del cuadro',
      titulo: 'Fin de la imagen: NMI otra vez',
      texto:
        'Tras las 224 líneas de la imagen la PPU2 vuelve a avisar por VBLANK y la CPU salta otra vez a su rutina para preparar el cuadro siguiente: 50 veces por segundo en esta consola PAL, cada 312 líneas.',
      bloques: ['ppu2', 'cpu'],
      senales: [{ id: 'blank', sentido: 1, nombre: 'VBLANK', valor: 'activa' }],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'SNESdev Wiki: PPU registers', url: 'https://snes.nesdev.org/wiki/PPU_registers', nota: 'VMAIN, VMADD, VMDATA, BG1SC, CGADD, CGDATA, INIDISP' },
    { titulo: 'SNESdev Wiki: Tiles', url: 'https://snes.nesdev.org/wiki/Tiles', nota: 'formato de 4 bits por punto' },
    { titulo: 'SNESdev Wiki: Tilemaps', url: 'https://snes.nesdev.org/wiki/Tilemaps' },
    { titulo: 'SNESdev Wiki: DMA registers', url: 'https://snes.nesdev.org/wiki/DMA_registers' },
    { titulo: 'SNESdev Wiki: Timing', url: 'https://snes.nesdev.org/wiki/Timing', nota: 'borrado vertical y NMI' },
    { titulo: 'SnesLab: List of Anomie\'s Docs (regs.txt, timing.txt)', url: 'https://sneslab.net/wiki/List_of_Anomie%27s_Docs' },
    { titulo: 'Rodrigo Copetti: Super Nintendo Architecture', url: 'https://www.copetti.org/writings/consoles/super-nintendo/' },
  ],
};
