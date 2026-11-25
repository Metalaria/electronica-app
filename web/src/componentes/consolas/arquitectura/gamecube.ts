// Nintendo GameCube (DOL-001, PAL board DOL-CPU(P)-01): block diagram, the inside of Flipper, address decoding and
// the timed scenarios. There is no schematic: blocks link to the photo boxes only, wires have no net.
//
// Figures and where they come from (all cited in «Fuentes»):
//   - YAGCD ch. 2: Gekko 486 MHz; North-Bridge (Gekko ↔ Flipper) 64 bits ~162 MHz; South-Bridge (Flipper ↔ 1T-SRAM)
//     64 bits ~324 MHz; East-Bridge (Flipper ↔ ARAM) 8 bits 81 MHz; U1–U10, P1–P10.
//   - YAGCD ch. 4/5: memory map (24 MB at 0, cached mirror 0x80000000, uncached 0xC0000000, EFB 0xC8000000, hardware
//     registers from 0xCC000000: CP, PE, VI, PI, MI, DSP, DI, SI, EXI, AI; write gather pipe 0xCC008000, 32 bytes;
//     IPL at 0xFFF00000 at boot); ARAM DMA registers 0xCC005020–0xCC00502A; EXI clocks 1–32 MHz; VI PAL 50 Hz.
//   - Copetti: write gather pipe (flushes in 32-byte bursts), ARAM reached only by DMA, GPU stages (command processor,
//     transform, texture with 1 MB cache, 16-stage TEV, pixel engine with the 2 MB embedded frame buffer, copy to the
//     XFB in main memory read by the VI), DSP at 81 MHz.
//   - ConsoleArtisan: X1/the digital video's 54 MHz clock, digital video 8 bits 4:2:2, EXI 16 MHz native.
//   - int03.co.uk (controller protocol): 4 µs bits, 0 = 3 µs low + 1 µs high, 1 = 1 µs low + 3 µs high, poll
//     0x40 0x03 0x02 and 64-bit reply.
//   - Rec. 601: 13.5 MHz luma sampling, 720 active samples; a PAL line lasts 64 µs (625 lines × 25 frames).
// Everything else (the phase between clocks, how long the CPU takes to issue its stores, how the VI spreads its reads)
// is marked as illustrative in each scenario's `fidelidad`.

import { Cronograma, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';

const F_GEKKO = 486e6;
const F_FLIPPER = 162e6;
const F_SUR = 324e6;
const F_ARAM = 81e6;
const F_X1 = 54e6;
const T_LINEA = 64e-6;
const F_LUMA = 13.5e6;

/** «0xCC008000» with a dot every four digits for reading: 0xCC00 8000 → «$CC00_8000». */
function h8(v: number): string {
  const s = (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `$${s.slice(0, 4)}_${s.slice(4)}`;
}

// ------------------------------------------------------------------ diagram of the board

const diagrama: Diagrama = {
  ancho: 1000,
  alto: 560,
  bloques: [
    { id: 'reloj', x: 30, y: 18, w: 220, h: 62, titulo: 'Reloj', sub: 'X1 54 MHz · U9 (Macronix)', foto: 'reloj',
      actividad: [{ pista: 'CLK', nivel: 1 }],
      info: 'El oscilador X1 de 54 MHz y el generador de reloj U9. De ahí salen los 162 MHz de Flipper (y de su bus con el Gekko), los 486 MHz del Gekko (tres veces más), los 324 MHz de la memoria principal y los 81 MHz de la ARAM y del DSP. Cómo los deriva U9 no está documentado.' },
    { id: 'gekko', x: 30, y: 118, w: 220, h: 132, titulo: 'Gekko', sub: 'U2 · PowerPC 486 MHz · 256 KB L2', foto: 'gekko',
      actividad: [{ pista: 'NB' }, { pista: 'CPU' }],
      info: 'CPU PowerPC de IBM (derivada del 750CXe) a 486 MHz, con 32 + 32 KB de caché L1 y 256 KB de L2. Solo habla con Flipper, por un bus de 64 bits a 162 MHz. Para dibujar escribe las órdenes en la dirección $CC00_8000: la tubería de escritura agrupada las junta y las manda en ráfagas de 32 bytes.' },
    { id: 'flipper', x: 330, y: 110, w: 300, h: 230, titulo: 'Flipper', sub: 'U1 · 162 MHz · GPU, DSP y E/S · 3 MB dentro', foto: 'flipper',
      actividad: [{ pista: 'NB' }, { pista: 'SB' }, { pista: 'EB' }, { pista: 'GP' }, { pista: 'VID' }],
      info: 'El centro de la consola: controla la memoria principal y la ARAM, dibuja (de las órdenes al búfer de imagen de 2 MB que lleva dentro, con 1 MB de caché de texturas), saca el vídeo, mezcla el sonido con su DSP de 81 MHz y atiende el disco (DI), los mandos (SI) y los periféricos (EXI). Pulse «Dentro de Flipper» para ver sus bloques.' },
    { id: 'ram', x: 720, y: 30, w: 250, h: 80, titulo: '1T-SRAM 24 MB', sub: 'U3, U4 · 2 × 12 MB · MoSys', foto: 'splash',
      actividad: [{ pista: 'SB' }],
      info: 'La memoria principal: programa, datos, texturas, la cola de órdenes de dibujo y el búfer de imagen externo (XFB). Bus de 64 bits a unos 324 MHz, gobernado solo por Flipper.' },
    { id: 'aram', x: 720, y: 140, w: 250, h: 72, titulo: 'ARAM 16 MB', sub: 'U5 · NEC · 8 bits · 81 MHz', foto: 'aram',
      actividad: [{ pista: 'EB' }],
      info: 'Memoria auxiliar lenta en un bus de 8 bits a 81 MHz. Solo se llega a ella por DMA desde la memoria principal (registros $CC00_5020–$CC00_502A). Los juegos guardan ahí las muestras de sonido del DSP y datos que esperan turno.' },
    { id: 'dvd', x: 720, y: 240, w: 250, h: 64, titulo: 'Unidad de discos', sub: 'P9 · DI · minidisco de 8 cm', foto: 'dvd', externo: true,
      actividad: [{ pista: 'DI' }],
      info: 'Lector con su propio controlador (Matsushita). Flipper le manda órdenes por la interfaz DI ($CC00_6000) y recibe los datos por DMA en la memoria principal.' },
    { id: 'ave', x: 720, y: 336, w: 120, h: 90, titulo: 'AVE', sub: 'U6 · P7 analógica', foto: 'ave',
      actividad: [{ pista: 'VID' }],
      info: 'El codificador de vídeo: recibe el vídeo digital de Flipper y saca las señales del conector P7 (en PAL, compuesto y RGB). También recibe el audio en serie.' },
    { id: 'digital', x: 850, y: 336, w: 120, h: 90, titulo: 'Salida digital', sub: 'P2 · 54 MHz', foto: 'av-digital', externo: true,
      actividad: [{ pista: 'VID' }],
      info: 'El mismo vídeo digital (YCbCr 4:2:2 en 8 bits) y el audio I²S, hacia fuera, con el reloj de 54 MHz. Ojo: su patilla 5 lleva +12 V.' },
    { id: 'ipl', x: 30, y: 300, w: 220, h: 70, titulo: 'ROM de arranque y reloj', sub: 'U10 · EXI · X2 32,768 kHz', foto: 'ipl',
      actividad: [{ pista: 'EXI' }],
      info: 'En el canal 0 del bus EXI: la ROM con el programa de arranque (IPL), que el Gekko ve en $FFF0_0000 al encender, el reloj de tiempo real y la SRAM de la configuración.' },
    { id: 'serie', x: 30, y: 410, w: 220, h: 78, titulo: 'Puertos de la base', sub: 'P6, P8 serie (EXI) · P10', foto: 'serie1',
      info: 'Dos puertos serie en el bus EXI (módem o adaptador de red) y el puerto de alta velocidad del Game Boy Player.' },
    { id: 'mandos', x: 330, y: 420, w: 150, h: 70, titulo: 'Mandos', sub: 'P3 · SI · 4 puertos', foto: 'mandos', externo: true,
      actividad: [{ pista: 'SI' }],
      info: 'La interfaz serie (SI) sondea los cuatro mandos por un solo hilo de datos cada uno, a 3,43 V: bits de unos 4 µs.' },
    { id: 'tarjetas', x: 490, y: 420, w: 160, h: 70, titulo: 'Tarjetas de memoria', sub: 'P4, P5 · EXI', foto: 'tarjetas', externo: true,
      actividad: [{ pista: 'EXI' }],
      info: 'Dos ranuras en el bus EXI: serie, con reloj de 1 a 32 MHz y selección de dispositivo.' },
    { id: 'alim', x: 720, y: 458, w: 250, h: 70, titulo: 'Alimentación', sub: '12 V → tarjeta CC-CC → P1 · U13', foto: 'p1',
      info: 'Solo entran 12 V. La tarjeta CC-CC los baja a unos 1,8 V para los núcleos y 3,3 V para las entradas y salidas, entre otras, y los lleva por P1. U13 es un regulador de baja pérdida de Sharp.' },
  ],
  conexiones: [
    { id: 'clk', puntos: [[250, 49], [480, 49], [480, 110]], bits: 1, etiqueta: '54 MHz → 162 MHz', pos: [365, 42], clase: 'reloj', pista: 'CLK', nivel: 1 },
    { id: 'clk-g', puntos: [[140, 80], [140, 118]], bits: 1, etiqueta: '', clase: 'reloj', pista: 'CLK', nivel: 1 },
    { id: 'norte', puntos: [[250, 165], [330, 165]], bits: 64, etiqueta: 'bus 64 bits · 162 MHz', pos: [290, 156], clase: 'dato', pista: 'NB', valor: true },
    { id: 'int', puntos: [[330, 225], [250, 225]], bits: 1, etiqueta: 'INT', pos: [290, 218], clase: 'interrupcion', pista: 'INT', nivel: 0 },
    { id: 'sur', puntos: [[630, 70], [720, 70]], bits: 64, etiqueta: '64 bits · 324 MHz', pos: [675, 62], clase: 'dato', pista: 'SB', valor: true },
    { id: 'este', puntos: [[630, 176], [720, 176]], bits: 8, etiqueta: '8 bits · 81 MHz', pos: [675, 168], clase: 'dato', pista: 'EB', valor: true },
    { id: 'di', puntos: [[630, 272], [720, 272]], bits: 8, etiqueta: 'DI', pos: [675, 264], clase: 'control', pista: 'DI', valor: true },
    { id: 'video', puntos: [[630, 320], [690, 320], [690, 370], [720, 370]], bits: 8, etiqueta: 'YCbCr 8 bits', pos: [660, 312], clase: 'dato', pista: 'VID', valor: true },
    { id: 'video-d', puntos: [[690, 330], [910, 330], [910, 336]], bits: 8, etiqueta: '', clase: 'dato', pista: 'VID' },
    { id: 'i2s', puntos: [[610, 340], [610, 400], [720, 400]], bits: 3, etiqueta: 'I²S', pos: [665, 393], clase: 'control', pista: 'I2S' },
    { id: 'si', puntos: [[405, 340], [405, 420]], bits: 1, etiqueta: 'SI', pos: [418, 380], clase: 'control', pista: 'SI', nivel: 0 },
    { id: 'exi-t', puntos: [[560, 340], [560, 420]], bits: 4, etiqueta: 'EXI', pos: [575, 380], clase: 'control', pista: 'EXI', valor: true },
    { id: 'exi', puntos: [[330, 320], [290, 320], [290, 450], [250, 450]], bits: 4, etiqueta: 'EXI', pos: [300, 390], clase: 'control', pista: 'EXI', valor: true },
    { id: 'exi-ipl', puntos: [[290, 335], [250, 335]], bits: 4, etiqueta: '', clase: 'control', pista: 'EXI' },
  ],
};

// ------------------------------------------------------------------ inside Flipper (Copetti's stages, YAGCD's blocks)

const interior: Diagrama = {
  ancho: 1000,
  alto: 560,
  bloques: [
    { id: 'i-gekko', x: 20, y: 20, w: 160, h: 64, titulo: 'Gekko', sub: 'fuera de Flipper', externo: true, actividad: [{ pista: 'NB' }],
      info: 'La CPU, al otro lado del bus de 64 bits.' },
    { id: 'pi', x: 20, y: 120, w: 160, h: 80, titulo: 'PI', sub: 'interfaz del procesador · interrupciones', actividad: [{ pista: 'NB' }, { pista: 'INT', nivel: 0 }],
      info: 'Recibe los accesos del Gekko (también las ráfagas de 32 bytes de la tubería de escritura agrupada) y le pasa las interrupciones de todos los bloques (registro $CC00_3000).' },
    { id: 'cp', x: 230, y: 20, w: 170, h: 70, titulo: 'CP', sub: 'procesador de órdenes · FIFO', actividad: [{ pista: 'GP' }],
      info: 'Lee la cola de órdenes de dibujo (un FIFO en la memoria principal) y reparte cada orden: registros, vértices, listas de visualización.' },
    { id: 'xf', x: 430, y: 20, w: 170, h: 70, titulo: 'XF', sub: 'transformación e iluminación', actividad: [{ pista: 'GP' }],
      info: 'Lleva cada vértice del espacio del objeto a la pantalla con sus matrices y calcula la luz.' },
    { id: 'su', x: 630, y: 20, w: 170, h: 70, titulo: 'Montaje y rasterizado', sub: 'triángulos → píxeles', actividad: [{ pista: 'GP' }],
      info: 'Monta los triángulos y decide qué píxeles cubren, con las coordenadas de textura de cada uno.' },
    { id: 'tx', x: 630, y: 130, w: 170, h: 90, titulo: 'Texturas', sub: '4 unidades · caché de 1 MB', actividad: [{ pista: 'TX' }],
      info: 'Leen los texeles de la caché de texturas de 1 MB (1T-SRAM dentro de Flipper), que se llena desde la memoria principal. Descomprimen los formatos de 4 bits y los de paleta.' },
    { id: 'tev', x: 430, y: 130, w: 170, h: 90, titulo: 'TEV', sub: 'combinador de 16 etapas', actividad: [{ pista: 'TEV' }],
      info: 'El combinador de texturas: hasta 16 etapas que mezclan colores de vértice, texturas y constantes para dar el color de cada píxel.' },
    { id: 'pe', x: 230, y: 130, w: 170, h: 90, titulo: 'PE + EFB', sub: 'motor de píxeles · 2 MB', actividad: [{ pista: 'PE' }],
      info: 'Prueba la profundidad (Z), mezcla y escribe en el búfer de imagen interno (EFB), de 640 × 528 como máximo. Al final del cuadro lo copia a la memoria principal (XFB).' },
    { id: 'mi', x: 830, y: 130, w: 150, h: 90, titulo: 'MI', sub: 'controlador de memoria', actividad: [{ pista: 'SB' }],
      info: 'Reparte la memoria principal entre todos: CPU, órdenes de dibujo, texturas, copia del EFB, vídeo, disco, DSP.' },
    { id: 'i-ram', x: 830, y: 20, w: 150, h: 70, titulo: '1T-SRAM', sub: 'fuera: 24 MB', externo: true, actividad: [{ pista: 'SB' }],
      info: 'La memoria principal, fuera de Flipper.' },
    { id: 'vi', x: 230, y: 270, w: 170, h: 80, titulo: 'VI', sub: 'interfaz de vídeo', actividad: [{ pista: 'VID' }],
      info: 'Lee el XFB de la memoria principal línea a línea y lo saca en digital hacia el codificador; genera los sincronismos y las interrupciones de línea.' },
    { id: 'dsp', x: 430, y: 270, w: 170, h: 80, titulo: 'DSP + AI', sub: 'sonido · 81 MHz', actividad: [{ pista: 'EB' }],
      info: 'El DSP mezcla las voces con muestras que trae de la ARAM; la interfaz de audio saca el resultado en serie.' },
    { id: 'aramc', x: 630, y: 270, w: 170, h: 80, titulo: 'ARAM', sub: 'DMA · 8 bits', actividad: [{ pista: 'EB' }],
      info: 'El controlador de la ARAM: copia bloques entre ella y la memoria principal.' },
    { id: 'io', x: 20, y: 270, w: 160, h: 80, titulo: 'DI · SI · EXI', sub: 'disco, mandos, periféricos', actividad: [{ pista: 'SI' }, { pista: 'EXI' }],
      info: 'Las interfaces de E/S: disco (DI), mandos (SI) y el bus serie de las tarjetas, la ROM de arranque y los puertos (EXI).' },
    { id: 'i-ave', x: 230, y: 420, w: 170, h: 70, titulo: 'AVE', sub: 'fuera: codificador', externo: true, actividad: [{ pista: 'VID' }],
      info: 'El codificador de vídeo, fuera de Flipper.' },
  ],
  conexiones: [
    { id: 'i-nb', puntos: [[100, 84], [100, 120]], bits: 64, etiqueta: '64 bits', pos: [130, 104], clase: 'dato', pista: 'NB', valor: true },
    { id: 'i-wgp', puntos: [[180, 140], [210, 140], [210, 55], [230, 55]], bits: 64, etiqueta: 'órdenes', pos: [212, 100], clase: 'dato', pista: 'WGP' },
    { id: 'i-cp-xf', puntos: [[400, 55], [430, 55]], bits: 32, etiqueta: '', clase: 'dato', pista: 'GP' },
    { id: 'i-xf-su', puntos: [[600, 55], [630, 55]], bits: 32, etiqueta: '', clase: 'dato', pista: 'GP' },
    { id: 'i-su-tx', puntos: [[715, 90], [715, 130]], bits: 32, etiqueta: 's, t', pos: [735, 112], clase: 'dato', pista: 'TX' },
    { id: 'i-tx-tev', puntos: [[630, 175], [600, 175]], bits: 32, etiqueta: 'texel', pos: [615, 168], clase: 'dato', pista: 'TEV', valor: true },
    { id: 'i-tev-pe', puntos: [[430, 175], [400, 175]], bits: 32, etiqueta: 'color', pos: [415, 168], clase: 'dato', pista: 'PE', valor: true },
    { id: 'i-mi-ram', puntos: [[905, 130], [905, 90]], bits: 64, etiqueta: '64 bits', pos: [935, 112], clase: 'dato', pista: 'SB', valor: true },
    { id: 'i-mi-tx', puntos: [[830, 175], [800, 175]], bits: 64, etiqueta: '', clase: 'dato', pista: 'TXL' },
    { id: 'i-mi-cp', puntos: [[830, 150], [815, 150], [815, 105], [315, 105], [315, 90]], bits: 64, etiqueta: 'FIFO', pos: [560, 100], clase: 'dato', pista: 'FIFO' },
    { id: 'i-pe-mi', puntos: [[315, 220], [315, 245], [905, 245], [905, 220]], bits: 64, etiqueta: 'copia EFB → XFB', pos: [610, 240], clase: 'dato', pista: 'COPIA' },
    { id: 'i-mi-vi', puntos: [[880, 220], [880, 258], [380, 258], [380, 270]], bits: 64, etiqueta: 'XFB', pos: [500, 254], clase: 'dato', pista: 'VIRD' },
    { id: 'i-vi-ave', puntos: [[315, 350], [315, 420]], bits: 8, etiqueta: 'YCbCr', pos: [345, 386], clase: 'dato', pista: 'VID', valor: true },
    { id: 'i-dsp-ar', puntos: [[600, 310], [630, 310]], bits: 8, etiqueta: '', clase: 'dato', pista: 'EB' },
    { id: 'i-int', puntos: [[180, 190], [205, 190], [205, 310], [230, 310]], bits: 1, etiqueta: 'INT', pos: [190, 250], clase: 'interrupcion', pista: 'INT', nivel: 0 },
  ],
};

// ------------------------------------------------------------------ address decoding (YAGCD ch. 4 and 5)

const REGISTROS: { base: number; fin: number; nombre: string; texto: string }[] = [
  { base: 0xcc000000, fin: 0xcc000fff, nombre: 'CP', texto: 'Procesador de órdenes: dónde está la cola de órdenes de dibujo y cómo va.' },
  { base: 0xcc001000, fin: 0xcc001fff, nombre: 'PE', texto: 'Motor de píxeles: modo de profundidad y de mezcla, avisos de fin de dibujo.' },
  { base: 0xcc002000, fin: 0xcc002fff, nombre: 'VI', texto: 'Interfaz de vídeo: tiempos de la línea, dirección del XFB ($CC00_201C), interrupciones de línea ($CC00_2030–3C).' },
  { base: 0xcc003000, fin: 0xcc003fff, nombre: 'PI', texto: 'Interfaz del procesador: causa ($CC00_3000) y máscara de las interrupciones.' },
  { base: 0xcc004000, fin: 0xcc004fff, nombre: 'MI', texto: 'Interfaz de memoria: protección de zonas de la memoria principal.' },
  { base: 0xcc005000, fin: 0xcc005fff, nombre: 'DSP', texto: 'DSP y DMA: buzones del DSP, DMA de la ARAM ($CC00_5020–2A) y DMA del audio ($CC00_5030–36).' },
  { base: 0xcc006000, fin: 0xcc0063ff, nombre: 'DI', texto: 'Interfaz del disco: órdenes a la unidad y su DMA.' },
  { base: 0xcc006400, fin: 0xcc0067ff, nombre: 'SI', texto: 'Interfaz serie: búferes de los cuatro mandos y el sondeo ($CC00_6430).' },
  { base: 0xcc006800, fin: 0xcc006bff, nombre: 'EXI', texto: 'Bus EXI: tres canales (tarjetas, ROM de arranque y reloj, puertos), reloj de 1 a 32 MHz.' },
  { base: 0xcc006c00, fin: 0xcc007fff, nombre: 'AI', texto: 'Interfaz de audio: frecuencia (48 o 32 kHz), volumen y el sonido que llega del disco.' },
  { base: 0xcc008000, fin: 0xcc008fff, nombre: 'GX FIFO', texto: 'La tubería de escritura agrupada: lo que se escribe aquí se junta en bloques de 32 bytes y va a la cola de órdenes de dibujo.' },
];

const BLOQUE_DE: Record<string, string> = { CP: 'flipper', PE: 'flipper', VI: 'flipper', PI: 'flipper', MI: 'flipper', DSP: 'aram', DI: 'dvd', SI: 'mandos', EXI: 'tarjetas', AI: 'ave', 'GX FIFO': 'flipper' };

export function decodificar(dir: number, escritura: boolean): Decodificacion {
  const a = dir >>> 0;
  const tabla: Decodificacion['tabla'] = [];
  const fila = (etiqueta: string, activa: boolean) => tabla.push({ etiqueta, valor: activa ? 'sí' : 'no', activa });
  const ram = (base: number) => a >= base && a < base + 0x01800000;
  let zona = 'Sin nada conectado';
  let bloque: string | null = null;
  let seleccion: string | null = null;
  let texto = 'Fuera de las zonas que documenta YAGCD: el acceso da error.';
  let espejo: string | undefined;
  if (ram(0)) {
    zona = 'Memoria principal (dirección física)';
    bloque = 'ram';
    texto = 'Los 24 MB de 1T-SRAM tal como los ve el hardware (DMA, vídeo, disco). El programa usa los espejos de $8000_0000 y $C000_0000.';
  } else if (ram(0x80000000)) {
    zona = 'Memoria principal, con caché';
    bloque = 'ram';
    espejo = h8(a - 0x80000000);
    texto = 'La memoria principal a través de las cachés del Gekko: aquí corre el programa y están sus datos.';
  } else if (ram(0xc0000000)) {
    zona = 'Memoria principal, sin caché';
    bloque = 'ram';
    espejo = h8(a - 0xc0000000);
    texto = 'La misma memoria sin pasar por la caché: para lo que comparten la CPU y el hardware (búferes de DMA, el XFB).';
  } else if (a >= 0xc8000000 && a < 0xc8200000) {
    zona = 'Búfer de imagen interno (EFB)';
    bloque = 'flipper';
    texto = 'Los 2 MB de 1T-SRAM dentro de Flipper donde dibuja el procesador gráfico; la CPU puede leerlos y escribirlos aquí.';
  } else if (a >= 0xcc000000 && a < 0xcc009000) {
    const r = REGISTROS.find((x) => a >= x.base && a <= x.fin);
    if (r) {
      zona = `Registros de ${r.nombre}`;
      seleccion = r.nombre;
      bloque = BLOQUE_DE[r.nombre] ?? 'flipper';
      texto = r.texto;
      if (r.nombre === 'GX FIFO' && !escritura) texto += ' Solo tiene sentido escribir en ella.';
    }
  } else if (a >= 0xe0000000 && a < 0xe0004000) {
    zona = 'Caché bloqueada (16 KB)';
    bloque = 'gekko';
    texto = 'Parte de la caché de datos del Gekko usada como memoria rápida: no sale al bus.';
  } else if (a >= 0xfff00000) {
    zona = 'ROM de arranque (IPL), al encender';
    bloque = 'ipl';
    texto = 'El Gekko arranca en $FFF0_0100: en ese momento esta zona muestra el principio de la ROM de arranque, que llega por el bus EXI.';
  }
  fila('Memoria principal (1T-SRAM)', bloque === 'ram');
  fila('EFB dentro de Flipper', zona.startsWith('Búfer'));
  fila('Registros de Flipper ($CC00_xxxx)', a >= 0xcc000000 && a < 0xcc009000);
  fila('Caché bloqueada del Gekko', zona.startsWith('Caché'));
  fila('ROM de arranque', bloque === 'ipl');
  return { direccion: a, escritura, zona, seleccion, bloque, espejo, texto, tabla };
}

// ------------------------------------------------------------------ scenarios

function escenarioRelojes(): Escenario {
  const c = new Cronograma();
  const fin = 2 / F_X1;
  c.bit('CLK', 'X1 · 54 MHz', 1).bit('FL', 'Flipper · 162 MHz', 1).bit('GK', 'Gekko · 486 MHz', 1).bit('SR', '1T-SRAM · 324 MHz', 1)
    .bit('AR', 'ARAM y DSP · 81 MHz', 1);
  c.reloj('CLK', 0, fin, 1 / F_X1);
  c.reloj('FL', 0, fin, 1 / F_FLIPPER);
  c.reloj('GK', 0, fin, 1 / F_GEKKO);
  c.reloj('SR', 0, fin, 1 / F_SUR);
  c.reloj('AR', 0, fin, 1 / F_ARAM);
  for (let k = 0; k <= 6; k++) c.marca(k / F_FLIPPER);
  c.paso(0, fin, 'En un periodo de X1 (18,5 ns) Flipper da 3 ciclos, el Gekko 9, la memoria principal 6 y la ARAM 1,5. Todos son múltiplos o divisores de 162 MHz, así que van en fase.');
  return {
    id: 'relojes', titulo: 'Relojes', descripcion: '54 MHz de X1; 162 MHz de Flipper y de su bus; 486, 324 y 81 MHz.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 8,
    defecto: ['CLK', 'FL', 'GK', 'SR', 'AR'],
    fidelidad: 'Exacto: las frecuencias (YAGCD 2.1 y 2.5; 54 MHz leídos en X1). Ilustrativo: la fase entre relojes y que los cinco salgan del mismo; cómo los genera U9 no está documentado.',
  };
}

/** The write gather pipe: eight 32-bit stores to $CC00_8000, one 32-byte burst on the 64-bit bus, into the FIFO. */
function escenarioTuberia(): Escenario {
  const c = new Cronograma();
  const tg = 1 / F_GEKKO;
  const tn = 1 / F_FLIPPER;
  const ts = 1 / F_SUR;
  c.bit('CLK', 'Bus del Gekko · 162 MHz', 1).bus('CPU', 'Gekko').bus('WGP', 'Tubería (bytes juntados)').bus('NB', 'Bus Gekko ↔ Flipper')
    .bus('SB', 'Bus de la memoria principal').bus('FIFO', 'Cola de órdenes (puntero)').bus('GP', 'Procesador gráfico');
  const palabras = ['$6100_0000', '$0000_1234', '$6128_0000', '$0034_5678', '$9000_0300', '$3F80_0000', '$0000_0000', '$3F80_0000'];
  // the stores, a few CPU cycles apart (illustrative)
  const paso = 6 * tg;
  c.set('CPU', 0, 'stw → $CC00_8000');
  for (let i = 0; i < 8; i++) {
    const t = i * paso;
    c.set('CPU', t, `stw ${palabras[i]}`);
    c.set('WGP', t + tg, `${(i + 1) * 4} bytes`);
    c.marca(t);
  }
  const t0 = 8 * paso + 2 * tn;
  c.set('CPU', 8 * paso, 'sigue con su programa');
  c.set('WGP', t0, '32 → ráfaga');
  for (let b = 0; b < 4; b++) {
    c.set('NB', t0 + b * tn, `${palabras[2 * b]!.slice(0, 5)}… (8 bytes)`);
  }
  c.set('NB', t0 + 4 * tn, null);
  c.set('WGP', t0 + 4 * tn, '0 bytes');
  const t1 = t0 + 4 * tn + 2 * ts;
  for (let b = 0; b < 4; b++) c.set('SB', t1 + b * ts, `escribe 8 bytes en $0080_00${(b * 8).toString(16).toUpperCase().padStart(2, '0')}`);
  c.set('SB', t1 + 4 * ts, null);
  c.set('FIFO', 0, '$0080_0000');
  c.set('FIFO', t1 + 4 * ts, '$0080_0020');
  c.set('GP', 0, 'esperando órdenes');
  c.set('GP', t1 + 6 * ts, 'lee la orden: dibujar');
  const fin = t1 + 12 * ts;
  c.reloj('CLK', 0, fin, tn);
  c.marca(t0);
  c.marca(t1);
  c.paso(0, 8 * paso, 'El Gekko escribe ocho palabras de 32 bits seguidas en $CC00_8000. No salen una a una: la tubería de escritura agrupada las va juntando.');
  c.paso(t0, t0 + 4 * tn, 'Con 32 bytes juntos, una sola ráfaga por el bus de 64 bits: cuatro transferencias de 8 bytes a 162 MHz, 24,7 ns.');
  c.paso(t0 + 4 * tn, fin, 'Flipper escribe la ráfaga al final de la cola de órdenes, en la memoria principal (bus de 64 bits a 324 MHz), y el procesador de órdenes la lee cuando le toca.');
  return {
    id: 'tuberia', titulo: 'Tubería de escritura agrupada', descripcion: 'Así le manda el Gekko las órdenes de dibujo a Flipper: escrituras sueltas, una ráfaga de 32 bytes.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 12,
    defecto: ['CLK', 'CPU', 'WGP', 'NB', 'SB', 'FIFO', 'GP'],
    fidelidad: 'Exacto: la dirección $CC00_8000 y los bloques de 32 bytes (YAGCD 5.11; Copetti), el bus de 64 bits a 162 MHz y el de la memoria a 324 MHz (YAGCD 2.5). Ilustrativo: el ritmo de las escrituras del Gekko, los retardos de Flipper, las palabras escritas y la dirección de la cola.',
  };
}

/** ARAM DMA: 32 bytes from main memory to the ARAM over the 8-bit bus. */
function escenarioARAM(op: Opciones): Escenario {
  const leer = op.sentido === 'leer';
  const c = new Cronograma();
  const tr = 1 / F_ARAM;
  const ts = 1 / F_SUR;
  c.bit('CLK', 'Reloj de la ARAM · 81 MHz', 1).bus('CPU', 'Gekko').bus('SB', 'Bus de la memoria principal').bus('EB', 'Bus de la ARAM (8 bits)')
    .bit('INT', 'Interrupción (DSP)', 1);
  c.set('CPU', 0, 'escribe $CC00_5020 (memoria)');
  c.set('CPU', 4 * tr, 'escribe $CC00_5024 (ARAM)');
  c.set('CPU', 8 * tr, `escribe $CC00_5028 (32 bytes, ${leer ? 'desde' : 'hacia'} la ARAM)`);
  c.set('CPU', 12 * tr, 'sigue con su programa');
  const t0 = 13 * tr;
  if (!leer) {
    for (let b = 0; b < 4; b++) c.set('SB', t0 + b * ts, `lee 8 bytes de $0100_00${(b * 8).toString(16).toUpperCase().padStart(2, '0')}`);
    c.set('SB', t0 + 4 * ts, null);
  }
  const t1 = t0 + (leer ? 0 : 4 * ts + tr);
  for (let i = 0; i < 32; i++) c.set('EB', t1 + i * tr, `byte ${i}`);
  c.set('EB', t1 + 32 * tr, null);
  let t2 = t1 + 32 * tr;
  if (leer) {
    for (let b = 0; b < 4; b++) c.set('SB', t2 + tr + b * ts, `escribe 8 bytes en $0100_00${(b * 8).toString(16).toUpperCase().padStart(2, '0')}`);
    c.set('SB', t2 + tr + 4 * ts, null);
    t2 += tr + 4 * ts;
  }
  c.set('INT', t2 + tr, 0);
  c.set('INT', t2 + 3 * tr, 1);
  const fin = t2 + 6 * tr;
  c.reloj('CLK', 0, fin, tr);
  for (const t of [0, t0, t1, t1 + 32 * tr, t2 + tr]) c.marca(t);
  c.paso(0, t0, 'El Gekko programa la DMA: dirección en la memoria principal, dirección en la ARAM y longitud con el sentido. Después sigue a lo suyo.');
  c.paso(t0, t1 + 32 * tr, `Los 32 bytes pasan de byte en byte por el bus de 8 bits a 81 MHz: ${((32 * tr) * 1e9).toFixed(0)} ns. La memoria principal da los mismos 32 bytes en 4 transferencias de 3,1 ns.`);
  c.paso(t1 + 32 * tr, fin, 'Al acabar, Flipper avisa con una interrupción (la de la interfaz del DSP).');
  return {
    id: 'aram', titulo: 'DMA de la ARAM', descripcion: 'La ARAM solo se alcanza por DMA: 32 bytes por el bus de 8 bits a 81 MHz.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 12,
    defecto: ['CLK', 'CPU', 'SB', 'EB', 'INT'],
    fidelidad: 'Exacto: los registros $CC00_5020–$CC00_502A y el bit de sentido (YAGCD 5.6), el bus de 8 bits a 81 MHz y el de 64 bits a 324 MHz (YAGCD 2.5), que la ARAM solo se alcanza por DMA (Copetti). Ilustrativo: los retardos de Flipper, las direcciones y que los bytes vayan sin pausas.',
  };
}

/** One PAL line of the video interface: 64 µs, 720 active samples at 13.5 MHz, Y and C bytes on the 8-bit bus. */
function escenarioLinea(): Escenario {
  const c = new Cronograma();
  const tm = 1 / F_LUMA;
  const activa = 720 * tm;
  const inicio = T_LINEA - activa - 1.5e-6;
  c.bit('HS', 'Sincronismo horizontal', 1).bit('ACT', 'Parte visible', 0).bus('VIRD', 'VI lee el XFB').bus('VID', 'Vídeo digital (8 bits)');
  c.set('HS', 0, 0);
  c.set('HS', 4.7e-6, 1);
  c.set('ACT', inicio, 1);
  c.set('ACT', inicio + activa, 0);
  // the VI reads the line's 1280 bytes (640 pixels × 2) ahead of time, in bursts (illustrative spacing)
  for (let k = 0; k < 40; k++) c.set('VIRD', 2e-6 + k * 1.3e-6, `32 bytes (${k * 16}–${k * 16 + 15})`);
  c.set('VIRD', 2e-6 + 40 * 1.3e-6, null);
  // the bytes on the bus: Y Cb Y Cr … two bytes per sample (27 Mbyte/s); shown in groups of 16 pixels
  for (let p = 0; p < 720; p += 16) c.set('VID', inicio + p * tm, `Y/Cb/Y/Cr · puntos ${p}–${p + 15}`);
  c.set('VID', inicio + activa, null);
  c.marca(0);
  c.marca(inicio);
  c.marca(inicio + activa);
  c.paso(0, inicio, 'Sincronismo y borrado: la VI ya va leyendo del XFB, en la memoria principal, los 1280 bytes de la línea (640 puntos de 2 bytes, Y con Cb o Cr).');
  c.paso(inicio, inicio + activa, `La parte visible: 720 muestras a 13,5 MHz (${(activa * 1e6).toFixed(1).replace('.', ',')} µs). Por el bus de 8 bits va un byte de luminancia y uno de color por muestra: 27 millones de bytes por segundo hacia el AVE y la salida digital.`);
  c.paso(inicio + activa, T_LINEA, 'Fin de la línea: 64 µs en total, 15 625 líneas por segundo en PAL.');
  return {
    id: 'linea', titulo: 'Una línea de vídeo (PAL)', descripcion: '64 µs: sincronismo, borrado y 720 muestras de 13,5 MHz leídas del XFB.',
    duracion: T_LINEA, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: T_LINEA / 12,
    defecto: ['HS', 'ACT', 'VIRD', 'VID'],
    fidelidad: 'Exacto: 64 µs por línea PAL y 720 muestras de 13,5 MHz (Rec. 601), el XFB de 2 bytes por punto (YAGCD 17.1), el vídeo digital de 8 bits en 4:2:2 (ConsoleArtisan). Ilustrativo: el reparto de las lecturas de la VI y la anchura exacta del sincronismo y del borrado.',
  };
}

/** One PAL field: the CPU prepares, the GPU draws into the EFB, the copy to the XFB, the VI shows it. */
function escenarioCuadro(): Escenario {
  const c = new Cronograma();
  const campo = 0.02;
  c.bus('LINEA', 'Línea de la VI').bit('INT', 'Interrupción de la VI', 1).bus('CPU', 'Gekko').bus('GP', 'Procesador gráfico')
    .bit('COPIA', 'Copia EFB → XFB', 0).bus('XFB', 'XFB que se ve');
  const linea = campo / 312.5;
  for (let l = 0; l < 312; l += 26) c.set('LINEA', l * linea, String(l));
  c.set('XFB', 0, 'XFB 1');
  c.set('CPU', 0, 'lee los mandos, mueve el juego');
  c.set('CPU', 0.004, 'escribe órdenes en $CC00_8000');
  c.set('GP', 0, 'esperando');
  c.set('GP', 0.0045, 'dibuja en el EFB');
  c.set('CPU', 0.013, 'espera');
  c.set('GP', 0.0155, 'copia el EFB');
  c.set('COPIA', 0.0155, 1);
  c.set('COPIA', 0.0172, 0);
  c.set('GP', 0.0172, 'terminado');
  c.set('INT', campo - 2 * linea, 0);
  c.set('INT', campo - 1.5 * linea, 1);
  c.set('CPU', campo - 2 * linea, 'cambia el XFB ($CC00_201C)');
  c.set('XFB', campo, 'XFB 2');
  for (const t of [0, 0.004, 0.0045, 0.0155, campo - 2 * linea, campo]) c.marca(t);
  c.paso(0, 0.004, 'Mientras la VI saca el XFB 1, el Gekko prepara el cuadro siguiente: lee los mandos y mueve el juego.');
  c.paso(0.004, 0.0155, 'Escribe las órdenes de dibujo en la tubería; el procesador gráfico las va leyendo de la cola y dibuja en el EFB, dentro de Flipper.');
  c.paso(0.0155, 0.0172, 'Copia del EFB al XFB 2, en la memoria principal, ya en el formato que lee la VI (Y con Cb o Cr).');
  c.paso(0.0172, campo, 'Con una interrupción de línea de la VI, el programa le da la dirección del XFB 2: el siguiente campo ya lo mostrará. 50 campos por segundo en PAL.');
  return {
    id: 'cuadro', titulo: 'Un cuadro (PAL 50 Hz)', descripcion: '20 ms: preparar, dibujar en el EFB, copiar al XFB y cambiar de XFB.',
    duracion: campo, escala: 'ms', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: campo / 14,
    defecto: ['LINEA', 'INT', 'CPU', 'GP', 'COPIA', 'XFB'],
    fidelidad: 'Exacto: 50 campos por segundo en PAL, el EFB dentro de Flipper copiado al XFB de la memoria principal que lee la VI (Copetti; YAGCD 5.3 y 7), la dirección de la tubería y la del XFB en la VI. Ilustrativo: cuánto tarda cada fase, que depende del juego.',
  };
}

/** A controller poll on the SI line: 0x40 0x03 0x02 + stop, then the 64-bit reply + stop; 4 µs bits. */
function escenarioMando(op: Opciones): Escenario {
  const c = new Cronograma();
  const tb = 4e-6;
  c.bit('SI', 'Línea de datos del mando (3,43 V)', 1).bus('QUIEN', 'Quién transmite').bus('BYTE', 'Byte');
  const boton = op.boton === 'a';
  const orden = [0x40, 0x03, 0x02];
  // reply: byte0 0,0,0,Start,Y,X,B,A; byte1 1,L,R,Z,D-pad; sticks centred at 128 (YAGCD 9.2.2; int03)
  const respuesta = [boton ? 0x01 : 0x00, 0x80, 0x80, 0x80, 0x80, 0x80, 0x00, 0x00];
  let t = 2e-6;
  const enviar = (bytes: number[], quien: string) => {
    c.set('QUIEN', t, quien);
    for (const by of bytes) {
      c.set('BYTE', t, `$${by.toString(16).toUpperCase().padStart(2, '0')}`);
      c.marca(t);
      for (let i = 7; i >= 0; i--) {
        const uno = (by >> i) & 1;
        c.set('SI', t, 0);
        c.set('SI', t + (uno ? 1e-6 : 3e-6), 1);
        t += tb;
      }
    }
    // stop bit: a «1»
    c.set('BYTE', t, 'parada');
    c.set('SI', t, 0);
    c.set('SI', t + 1e-6, 1);
    t += tb;
    c.set('BYTE', t, null);
  };
  enviar(orden, 'consola');
  const finOrden = t;
  t += 6e-6;
  enviar(respuesta, 'mando');
  c.set('QUIEN', t, null);
  const fin = t + 4e-6;
  c.paso(0, finOrden, 'La consola manda $40 $03 $02 (sondeo, sin vibración): 24 bits y uno de parada. Cada bit dura unos 4 µs: un 0 son 3 µs abajo y 1 arriba; un 1, 1 µs abajo y 3 arriba.');
  c.paso(finOrden, fin, `El mando contesta con 64 bits: botones (${boton ? 'A pulsado' : 'ninguno pulsado'}), las dos palancas centradas en 128 y los dos gatillos. Toda la consulta ronda los 350 µs.`);
  return {
    id: 'mando', titulo: 'Leer un mando (SI)', descripcion: 'Un sondeo por el hilo de datos: orden de 24 bits y respuesta de 64.',
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 16, ventana: [0, 120e-6],
    defecto: ['SI', 'QUIEN', 'BYTE'],
    fidelidad: 'Exacto: la codificación de los bits (unos 4 µs; 3 + 1 y 1 + 3 µs), la orden $40 $03 $02, el bit de parada y la respuesta de 8 bytes con su orden (int03.co.uk, medido en una consola PAL; YAGCD 9.2). Ilustrativo: la pausa entre la orden y la respuesta y la posición de las palancas.',
  };
}

/** An EXI transfer at 16 MHz: select, a 32-bit command, data in. */
function escenarioEXI(): Escenario {
  const c = new Cronograma();
  const tc = 1 / 16e6;
  c.bit('CS', 'Selección (canal 0, dispositivo 1)', 1).bit('ECLK', 'Reloj EXI · 16 MHz', 0).bus('DO', 'Salida de Flipper').bus('DI', 'Entrada a Flipper');
  const t0 = 2 * tc;
  c.set('CS', t0, 0);
  c.reloj('ECLK', t0 + tc / 2, t0 + 64 * tc, tc);
  for (let i = 0; i < 4; i++) c.set('DO', t0 + i * 8 * tc, `orden, byte ${i + 1}`);
  c.set('DO', t0 + 32 * tc, null);
  for (let i = 0; i < 4; i++) c.set('DI', t0 + (32 + i * 8) * tc, `dato, byte ${i + 1}`);
  c.set('DI', t0 + 64 * tc, null);
  c.set('CS', t0 + 64 * tc + tc, 1);
  const fin = t0 + 68 * tc;
  for (const t of [t0, t0 + 32 * tc, t0 + 64 * tc]) c.marca(t);
  c.paso(0, t0 + 32 * tc, 'Flipper baja la selección del dispositivo 1 del canal 0 (la ROM de arranque) y saca una orden de 4 bytes, un bit por flanco del reloj.');
  c.paso(t0 + 32 * tc, fin, 'El chip contesta por la otra línea con los datos pedidos. A 16 MHz, cada byte tarda 0,5 µs: la ROM de arranque se copia a la memoria sin prisa, al encender.');
  return {
    id: 'exi', titulo: 'Una transferencia EXI', descripcion: 'El bus serie de la ROM de arranque, las tarjetas y los puertos: selección, orden y datos.',
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 10,
    defecto: ['CS', 'ECLK', 'DO', 'DI'],
    fidelidad: 'Exacto: tres canales con selección por dispositivo, la ROM de arranque en el canal 0, dispositivo 1, y los relojes de 1 a 32 MHz (YAGCD 5.9); 16 MHz como reloj nativo (ConsoleArtisan). Ilustrativo: el contenido de la orden y de los datos.',
  };
}

export const GAMECUBE: Maquina = {
  id: 'gamecube',
  diagrama,
  interior: {
    titulo: 'Dentro de Flipper',
    nota: 'Bloques de Flipper según Copetti y YAGCD (no hay esquema ni foto del dado con sus nombres). Se iluminan con las mismas señales.',
    diagrama: interior,
  },
  digitos: 8,
  dirInicial: 'CC008000',
  notaDecodificador: 'Mapa de YAGCD (capítulos 4 y 5). Las direcciones son las que usa el programa; el hardware ve las físicas.',
  decodificar,
  escenarios: [
    { id: 'tuberia', titulo: 'Tubería de escritura', crear: escenarioTuberia },
    { id: 'cuadro', titulo: 'Un cuadro', crear: escenarioCuadro },
    { id: 'linea', titulo: 'Una línea de vídeo', crear: escenarioLinea },
    { id: 'aram', titulo: 'DMA de la ARAM', crear: escenarioARAM },
    { id: 'mando', titulo: 'Leer un mando', crear: escenarioMando },
    { id: 'exi', titulo: 'Transferencia EXI', crear: escenarioEXI },
    { id: 'relojes', titulo: 'Relojes', crear: escenarioRelojes },
  ],
  ejemplos: [
    { dir: 0x80003100, escritura: false, texto: 'programa' },
    { dir: 0xc0400000, escritura: true, texto: 'sin caché' },
    { dir: 0xcc008000, escritura: true, texto: 'GX FIFO' },
    { dir: 0xcc00201c, escritura: true, texto: 'XFB de la VI' },
    { dir: 0xcc005020, escritura: true, texto: 'DMA ARAM' },
    { dir: 0xcc006400, escritura: true, texto: 'mando 1' },
    { dir: 0xc8000000, escritura: false, texto: 'EFB' },
    { dir: 0xfff00100, escritura: false, texto: 'arranque' },
  ],
  opciones: [
    { id: 'sentido', titulo: 'Sentido', escenarios: ['aram'], valores: [{ v: 'escribir', texto: 'Memoria → ARAM' }, { v: 'leer', texto: 'ARAM → memoria' }] },
    { id: 'boton', titulo: 'Botón A', escenarios: ['mando'], valores: [{ v: 'no', texto: 'Suelto' }, { v: 'a', texto: 'Pulsado' }] },
  ],
};
