// «Un fotograma» of the Neo Geo AES (first NEO-AES board): sprite 2, a 16 × 16 tile $0240 with palette 5, line 7,
// pixel 7 → point (167, 103).
//
// Checked against the NeoGeo Development Wiki («Sprites»: SCB1–SCB4, 96 sprites per line, 381 per frame; «Fix
// layer»: map at $7000, 40 × 32 tiles top to bottom, two hidden rows at the top, palette in bits 15–12, always above
// the sprites; «Palettes»: $400000, 256 palettes of 16 colours, backdrop at $401FFE; «Colors»: dark bit and the
// 5-bit channels; «VRAM» registers $3C0000/$3C0002/$3C0004; «IRQ»: VBlank level 1, vector $64, acknowledged at
// $3C000C) and the app's «Arquitectura» data (arquitectura/neogeo.ts, which cites SNK's own sheets: PRO-C0
// decoding and /DTACK, LSPC-A0 and its two VRAMs, the P bus with PCK1 for the C ROM and PCK2 for the S ROM, the
// cartridge's NEO-ZMC2 serialising 8 pixels onto GAD/GBD, the palette number taken from the P bus by the PRO-B0,
// PA0–PA11 to the palette RAM, the 74LS273 latches and resistor DAC, the CXA1145). Arithmetic: SCB1 of sprite 2 at
// 2 × 64 = $0080; SCB3 = (496 − 96) << 7 | 1 = $C801; SCB4 = 160 << 7 = $5000; fix map $7000 + 20 × 32 + (12 + 2)
// = $728E; palette 5 colour 6 at $400000 + (5 × 16 + 6) × 2 = $4000AC, PA = $056; red: R0 (bit 14) and R4–R1
// (bits 11–8) set = $4F00.

import type { FotogramaMaquina } from '../tipos';
import { PELOTA_4BPP, doblar } from '../ejemplo';

export const NEOGEO: FotogramaMaquina = {
  maquina: 'neogeo',
  entrada:
    'La Neo Geo no tiene fondos de teselas: todo son sprites de 16 × 16 puntos más la capa fija de textos. Seguimos el sprite 2, una pelota con el dibujo $0240 y la paleta 5, desde que el 68000 lee su número en la ROM P hasta que su punto (167, 103) sale hacia la tele.',
  ejemplo: {
    ancho: 320,
    alto: 224,
    tesela: 16,
    x: 160,
    y: 96,
    indices: doblar(PELOTA_4BPP),
    fila: 7,
    columna: 7,
    // palette 5: colour 1 (dark red), 6 $4F00 (red), 15 $7FFF (white); backdrop $401FFE
    colores: { 1: '#7b0000', 6: '#ff0000', 15: '#ffffff' },
    fondo: '#4a8cff',
    bpp: 4,
    formato: 'planos',
    sinHex: true,
    ventana: [0, 8],
    numero: '$0240',
    color: '$4F00',
  },
  pasos: [
    {
      fase: 'Bus del 68000',
      titulo: 'El 68000 lee una instrucción de la ROM P',
      texto:
        'El 68000 saca $000400 por A1–A23 y baja /AS. El PRO-C0 decodifica la dirección, activa la lectura de la ROM P del cartucho (ROMOE) y le contesta con /DTACK; por D0–D15 llega $33FC, el principio de MOVE.W #$0240,$100100. $0240 es el número del dibujo que vamos a seguir.',
      bloques: ['m68k', 'proc0', 'prom'],
      senales: [
        { id: 'm-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$000400' },
        { id: 'p-a', sentido: 1 },
        { id: 'r-a', sentido: 1 },
        { id: 'p-sel', sentido: 1 },
        { id: 'bus-sel', sentido: 1 },
        { id: 'r-s', sentido: 1, nombre: 'ROMOE', valor: '0' },
        { id: 'r-d', sentido: -1 },
        { id: 'bus-d', sentido: -1, valor: '$33FC' },
        { id: 'm-d', sentido: -1 },
        { id: 'dtack', sentido: 1, valor: '0' },
      ],
      internos: [['/AS, R/W', '0, 1']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Bus del 68000',
      titulo: 'Y guarda el valor en la RAM de usuario',
      texto:
        'La escritura va a $100100 con R/W a 0. El PRO-C0 selecciona las dos SRAM de 32K × 8 de la RAM de usuario, una para el byte alto y otra para el bajo, que guardan $0240 hasta el borrado vertical.',
      bloques: ['m68k', 'proc0', 'wram'],
      senales: [
        { id: 'm-a', sentido: 1 },
        { id: 'bus-a', sentido: -1, valor: '$100100' },
        { id: 'w-a', sentido: 1 },
        { id: 'p-sel', sentido: 1 },
        { id: 'bus-sel', sentido: -1 },
        { id: 'w-s', sentido: 1, nombre: '/WE', valor: '0' },
        { id: 'm-d', sentido: 1 },
        { id: 'bus-d', sentido: -1, valor: '$0240' },
        { id: 'w-d', sentido: 1 },
        { id: 'dtack', sentido: 1, valor: '0' },
      ],
      internos: [['/AS, R/W', '0, 0']],
      pantalla: 'cuadro-anterior',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'Línea 224: interrupción de nivel 1',
      texto:
        'Tras las 224 líneas visibles el LSPC baja /IPL0: interrupción de nivel 1, la del borrado vertical. El 68000 salta a la rutina del vector $64, que la reconoce escribiendo 4 en $3C000C y reinicia el perro guardián escribiendo en $300001.',
      bloques: ['lspc', 'm68k'],
      senales: [{ id: 'ipl', sentido: 1, nombre: '/IPL0', valor: '0' }],
      internos: [
        ['Nivel', '1'],
        ['Vector', '$64'],
      ],
      pantalla: 'cuadro-anterior',
      nota: 'SNK pide tocar la VRAM y la paleta durante el borrado vertical.',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El sprite 2, en la VRAM lenta',
      texto:
        'El 68000 no ve la VRAM: le pasa al LSPC la dirección en $3C0000 y los datos en $3C0002. La primera tesela del sprite 2 está en SCB1, en $0080: escribe $0240 (el número del dibujo) y $0500 (paleta 5, sin volteos). El PRO-C0 baja LSPWE y el LSPC lo copia en la VRAM lenta.',
      bloques: ['m68k', 'proc0', 'lspc', 'svram'],
      senales: [
        { id: 'm-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$3C0000, $3C0002' },
        { id: 'l-a', sentido: 1 },
        { id: 'lspsel', sentido: 1, nombre: 'LSPWE', valor: '0' },
        { id: 'm-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '$0080, $0240, $0500' },
        { id: 'l-d', sentido: 1 },
        { id: 'svram', sentido: 1, nombre: 'SCB1 $0080', valor: '$0240, $0500' },
      ],
      pantalla: 'vram',
      nota: 'El dibujo $0240 no se copia: está en las ROM C del cartucho, 128 bytes por tesela de 16 × 16.',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'La posición, en la VRAM rápida',
      texto:
        'Por el mismo camino escribe en la VRAM rápida la altura y la posición del sprite: SCB3 ($8202) = $C801, es decir, Y = 496 − 96 y una tesela de alto, y SCB4 ($8402) = $5000, X = 160.',
      bloques: ['m68k', 'proc0', 'lspc', 'fvram'],
      senales: [
        { id: 'bus-a', sentido: 1, valor: '$3C0000, $3C0002' },
        { id: 'lspsel', sentido: 1, nombre: 'LSPWE', valor: '0' },
        { id: 'bus-d', sentido: 1, valor: '$8202, $C801…' },
        { id: 'l-d', sentido: 1 },
        { id: 'fvram', sentido: 1, valor: '$8202, $8402' },
      ],
      internos: [
        ['SCB3 ($8202)', '$C801'],
        ['SCB4 ($8402)', '$5000'],
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'Borrado vertical',
      titulo: 'El color, directamente en la paleta',
      texto:
        'La RAM de paleta sí está en el bus del 68000: escribe $4F00 en $4000AC, el color 6 de la paleta 5. Es un rojo con los cinco bits al máximo, repartidos entre los bits 11–8 y el bit 14; el bit 15, el de oscurecer, está a 0.',
      bloques: ['m68k', 'proc0', 'palram'],
      senales: [
        { id: 'm-a', sentido: 1 },
        { id: 'bus-a', sentido: 1, valor: '$4000AC' },
        { id: 'pal-a', sentido: 1 },
        { id: 'p-sel', sentido: 1 },
        { id: 'bus-sel', sentido: 1 },
        { id: 'pal-s', sentido: 1, nombre: 'selección', valor: '0' },
        { id: 'm-d', sentido: 1 },
        { id: 'bus-d', sentido: 1, valor: '$4F00' },
        { id: 'pal-d', sentido: 1 },
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'El LSPC busca los sprites de la línea',
      texto:
        'El LSPC prepara cada línea mientras se muestra otra. Para la línea 103 recorre las alturas y posiciones Y de SCB3 en la VRAM rápida y apunta los sprites que la cruzan, hasta 96. El sprite 2 entra: su fila 7 cae en esa línea.',
      bloques: ['lspc', 'fvram'],
      senales: [{ id: 'fvram', sentido: -1, valor: 'SCB3: $C801' }],
      internos: [['Fila del sprite 2', '103 − 96 = 7']],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'Número de dibujo y reducción',
      texto:
        'De la VRAM lenta lee la entrada de SCB1: dibujo $0240, paleta 5. Con la reducción vertical de SCB2, la tabla de la ROM L0 le dice qué línea del dibujo toca; a tamaño completo es la misma, la 7.',
      bloques: ['lspc', 'svram', 'l0'],
      senales: [
        { id: 'svram', sentido: -1, valor: '$0240, $0500' },
        { id: 'bus-p', sentido: 1, nombre: 'P0–P23', valor: 'L0' },
        { id: 'p-l0', sentido: 1 },
      ],
      pantalla: 'mapa',
    },
    {
      fase: 'Línea a línea',
      titulo: 'La ROM C, por el bus P',
      texto:
        'El LSPC pone en el bus P la dirección del dibujo (número $0240, línea 7, mitad izquierda con CA4 = 0) y la retiene en el cartucho con un pulso de PCK1; con el mismo pulso el PRO-B0 se queda con el número de paleta, 5. Las dos ROM C devuelven 32 bits: los cuatro planos de 8 puntos.',
      bloques: ['lspc', 'crom', 'buf'],
      senales: [
        { id: 'bus-p', sentido: 1, nombre: 'P0–P23', valor: '$0240, línea 7' },
        { id: 'pck1', sentido: 1, valor: '↑' },
        { id: 'p-c', sentido: 1 },
      ],
      internos: [['CA4', '0 (puntos 0–7)']],
      pantalla: 'patron',
    },
    {
      fase: 'Línea a línea',
      titulo: 'El NEO-ZMC2 junta los planos',
      texto:
        'El NEO-ZMC2 del cartucho toma un bit de cada plano para cada punto y manda dos puntos de 4 bits por ciclo de 12 MHz por GAD y GBD. El punto 7 de la fila da 0, 1, 1 y 0 en los planos 0 a 3: índice 6. Se escribe en el buffer de línea, en la X = 167, junto con la paleta 5.',
      bloques: ['crom', 'buf'],
      senales: [{ id: 'gad', sentido: 1, valor: '2 puntos por ciclo' }],
      internos: [['Buffer, X = 167', 'paleta 5, color 6']],
      pantalla: 'mezcla',
    },
    {
      fase: 'Línea a línea',
      titulo: 'La capa fija, por encima de todo',
      texto:
        'En la misma pasada el LSPC lee la capa fija: la entrada $728E del mapa vale $0020, una tesela vacía. Pide su fila a la ROM S por el bus P con PCK2 y llegan ceros por FIXD: transparente. Como ningún sprite posterior al 2 ocupa el punto, este se queda con el color de la pelota.',
      bloques: ['lspc', 'svram', 'srom', 'buf'],
      senales: [
        { id: 'svram', sentido: -1, valor: '$728E: $0020' },
        { id: 'bus-p', sentido: 1, nombre: 'P0–P23', valor: 'fija $020' },
        { id: 'pck2', sentido: 1, valor: '↑' },
        { id: 'p-s', sentido: 1 },
        { id: 'fix', sentido: 1, valor: '$00' },
      ],
      pantalla: 'prioridad',
      nota: 'La capa fija es transparente en (167, 103) y ningún otro sprite lo tapa: gana el sprite 2.',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'Del buffer de línea a la paleta',
      texto:
        'En la línea siguiente los buffers se intercambian y el que llenamos se lee punto a punto. Para el punto 167 da la paleta 5 y el color 6, que forman la dirección de la RAM de paleta PA0–PA11 = $056; la RAM contesta por PC0–PC15 con $4F00.',
      bloques: ['buf', 'palram'],
      senales: [
        { id: 'pa', sentido: 1, valor: '$056' },
        { id: 'color', sentido: 1, valor: '$4F00' },
      ],
      pantalla: 'paleta',
    },
    {
      fase: 'Paleta y salida',
      titulo: 'El punto sale hacia la tele',
      texto:
        'Los 74LS273 retienen el color con el reloj de punto de 6 MHz y las redes de resistencias lo convierten en tres tensiones, R, G y B. El CXA1145 las convierte en vídeo compuesto y las lleva, con el RGB, al conector de A/V. El punto (167, 103) dura 167 ns.',
      bloques: ['dac', 'enc'],
      senales: [{ id: 'rgb', sentido: 1, valor: 'rojo' }],
      internos: [['Punto', '(167, 103)']],
      pantalla: 'punto',
    },
    {
      fase: 'Fin del cuadro',
      titulo: 'Línea 224: nivel 1 otra vez',
      texto:
        'Tras las 224 líneas visibles el LSPC vuelve a bajar /IPL0. El 68000, que ha preparado el cuadro siguiente en la RAM de usuario, vuelve a la rutina del vector $64, unas 59 veces por segundo, cada 264 líneas.',
      bloques: ['lspc', 'm68k'],
      senales: [{ id: 'ipl', sentido: 1, nombre: '/IPL0', valor: '0' }],
      pantalla: 'cuadro',
    },
  ],
  fuentes: [
    { titulo: 'NeoGeo Development Wiki: Sprites', url: 'https://wiki.neogeodev.org/index.php/Sprites', nota: 'SCB1–SCB4, límites por línea y por cuadro' },
    { titulo: 'NeoGeo Development Wiki: Fix layer', url: 'https://wiki.neogeodev.org/index.php/Fix_layer', nota: 'mapa en $7000, filas ocultas, prioridad' },
    { titulo: 'NeoGeo Development Wiki: Palettes', url: 'https://wiki.neogeodev.org/index.php/Palettes', nota: '$400000, color de fondo en $401FFE' },
    { titulo: 'NeoGeo Development Wiki: Colors', url: 'https://wiki.neogeodev.org/index.php/Colors', nota: 'bit de oscurecer y canales de 5 bits' },
    { titulo: 'NeoGeo Development Wiki: L0 ROM', url: 'https://wiki.neogeodev.org/index.php/L0_ROM', nota: 'reducción vertical' },
    { titulo: 'NeoGeo Development Wiki: Layer', url: 'https://wiki.neogeodev.org/index.php/Layer', nota: 'orden de las capas' },
    { titulo: 'NeoGeo Development Wiki: PRO-CT0', url: 'https://wiki.neogeodev.org/index.php/PRO-CT0', nota: 'el serializador de los gráficos, luego NEO-ZMC2' },
    { titulo: 'Rodrigo Copetti: Neo Geo Architecture', url: 'https://www.copetti.org/writings/consoles/neogeo/' },
  ],
};
