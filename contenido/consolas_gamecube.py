"""«Consolas» 2.0: Nintendo GameCube (DOL-001, PAL mainboard DOL-CPU(P)-01), the REDUCED machine.

There is no schematic of the GameCube at all: ConsoleArtisan's repair reference says «There is no OEM service
manual or schematic for this console, and there is not going to be one», and no recreation exists. So, unlike the
other machines, this one has no sheets, components or nets (`sin_esquema`): no «Esquema» tab and no «Busque la
avería» (that activity needs the board's nets). What it has:

  - three photos of iFixit's teardown 1727 (CC BY-NC-SA 3.0): both faces of a populated DOL-CPU(P)-01 (the
    silkscreen reads «C/DOL-CPU(P)-01», a PAL board) and the DC-DC power card; boxes placed by the markings and the
    silkscreen read on them (`confianza` 'marca') or by the position the sources give (`confianza` 'posicion');
  - the board in 3D and 2D reconstructed from those two photos (construir_placa, called by consolas_pcb.py): the
    faces are the photos rectified, the scale comes from the 1.27 mm pitch of the SOIC-14 chips U9 and U10, the
    bottom face is registered on the top one through four mounting holes; parts are bodies placed from the boxes,
    with no pads and no nets;
  - the voltages and measuring points that the sources give (EXTRA['gamecube']['tensiones']);
  - the sources: ConsoleArtisan's GameCube reference, YAGCD, Copetti's architecture article, libogc, a datasheet.

Research folder (CONSOLAS_FUENTES, default /home/claude/consolas): gamecube/fotos/ifixit/1727-p7-1.jpg (top face),
1727-p7-2.jpg (bottom face), 1727-p8-3.jpg (DC-DC card), downloaded by the owner from the iFixit page
(gamecube/fotos/ifixit/FUENTES.txt); gamecube/notas/fuentes.md, the facts gathered from each source.
To regenerate: python3 contenido/consolas.py gamecube && python3 contenido/consolas_pcb.py gamecube
"""

import os

# The three photos are 3648 × 2736; boxes are measured on a half-size copy (1824 px wide) and written for the
# 1600 px output photo.
_K = 1600 / 1824


def _c(x0, y0, x1, y1):
    return [round(x0 * _K), round(y0 * _K), round(x1 * _K), round(y1 * _K)]


GRUPOS = {
    'gamecube': {
        'norte': 'Bus de la CPU: Gekko ↔ Flipper (64 bits, unos 162 MHz)',
        'sur': 'Bus de la memoria principal: Flipper ↔ 1T-SRAM (64 bits, unos 324 MHz)',
        'este': 'Bus de la ARAM: Flipper ↔ ARAM (8 bits, 81 MHz)',
        'exi': 'EXI: tarjetas de memoria, ROM de arranque y reloj, puertos serie',
        'si': 'SI: los cuatro mandos',
        'di': 'DI: la unidad de discos',
        'video': 'Vídeo (digital YCbCr hacia el codificador y la salida digital)',
        'audio': 'Audio (serie I²S)',
        'power': 'Alimentación (12 V de entrada, la tarjeta CC-CC y sus tensiones)',
    },
}

_FLIPPER_F = ('Gráficos, sonido, memoria y entradas y salidas en un solo chip a 162 MHz: el procesador gráfico (de la '
              'cola de órdenes al búfer de imagen), el DSP de audio a 81 MHz, el controlador de la memoria principal y de '
              'la ARAM y las interfaces de vídeo (VI), audio (AI), disco (DI), mandos (SI) y periféricos (EXI). Lleva '
              'dentro 3 MB de 1T-SRAM: 2 MB del búfer de imagen y 1 MB de caché de texturas.')

TOP = [
    {'id': 'flipper', 'nombre': 'Flipper', 'pieza': 'FLIPPER A · © 2001 Nintendo · ATi · NEC · D8926F2011', 'esquema': [],
     'bloque': 'flipper', 'cajas': [_c(670, 388, 1150, 868)], 'confianza': 'marca',
     'buses': ['norte', 'sur', 'este', 'video', 'audio', 'exi', 'si', 'di'], 'funcion': _FLIPPER_F,
     'verificacion': 'U1 según YAGCD (2.4.2); marca leída en la foto. Reloj y memoria interna: ConsoleArtisan y Copetti.'},
    {'id': 'gekko', 'nombre': 'CPU Gekko', 'pieza': 'IBM 45L8926ESD · IBM9314PQ · PPCDBK-EFB486X3', 'esquema': [],
     'bloque': 'gekko', 'cajas': [_c(745, 912, 1088, 1238)], 'confianza': 'marca', 'buses': ['norte'],
     'funcion': 'PowerPC de IBM derivado del 750CXe a 486 MHz, con 32 + 32 KB de caché de primer nivel y 256 KB de segundo '
                'nivel. Añade instrucciones de coma flotante por parejas («paired singles») y la tubería de escritura agrupada '
                '(«write gather pipe»), por la que manda las órdenes de dibujo a Flipper en ráfagas de 32 bytes.',
     'verificacion': 'U2 según YAGCD (2.4.2); marca leída en la foto («486» en la tercera línea). 486 MHz: YAGCD 2.1 y Copetti.'},
    {'id': 'splash', 'nombre': 'Memoria principal 1T-SRAM (2 × 12 MB)', 'pieza': 'MoSys MS3M32B-5 B (dos chips, U3 y U4)',
     'esquema': [], 'bloque': 'ram', 'cajas': [_c(618, 150, 856, 318), _c(968, 150, 1208, 318)], 'confianza': 'marca',
     'buses': ['sur'],
     'funcion': '24 MB de 1T-SRAM de MoSys en dos chips de 12 MB, en el bus de 64 bits a unos 324 MHz que solo controla '
                'Flipper. Guardan el programa, los datos, las texturas, las listas de órdenes y el búfer de imagen externo '
                '(XFB) que lee la interfaz de vídeo.',
     'verificacion': 'U3 y U4 se leen en la serigrafía. YAGCD (2.4.2) escribe la marca «MS3M23B-5 A»; en esta placa se lee '
                     '«MS3M32B-5 B».'},
    {'id': 'aram', 'nombre': 'ARAM (16 MB)', 'pieza': 'NEC · «ARAM-…» (la marca está tachada a mano)', 'esquema': [],
     'bloque': 'aram', 'cajas': [_c(430, 128, 580, 394)], 'confianza': 'marca', 'buses': ['este'],
     'funcion': '16 MB de memoria auxiliar en un bus de 8 bits a 81 MHz. Ni el Gekko ni el procesador gráfico la leen '
                'directamente: se copia a la memoria principal y desde ella por DMA. Los juegos guardan ahí sobre todo las '
                'muestras de sonido del DSP.',
     'verificacion': 'U5 según YAGCD (2.4.2); en la foto se leen «NEC», «JAPAN» y «ARAM-», el resto lo tapa un trazo de rotulador.'},
    {'id': 'u13', 'nombre': 'Regulador U13', 'pieza': 'Sharp 070XZ1H (serie PQ070XZ1H)', 'esquema': [], 'bloque': 'alim',
     'cajas': [_c(432, 40, 518, 122)], 'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Regulador de tensión de baja pérdida de Sharp, de cinco patas y salida ajustable con dos resistencias '
                '(1,5 a 7 V, hasta 1,5 A, según su hoja de datos). Qué tensión saca en esta placa no lo dice ninguna fuente.',
     'verificacion': 'Referencia U13 en la serigrafía; marca leída en la foto; función por la hoja de datos de Sharp.'},
    {'id': 'ipl', 'nombre': 'ROM de arranque y reloj (RTC)', 'pieza': 'Macronix (logotipo MX), U10 · cristal X2',
     'esquema': [], 'bloque': 'ipl', 'cajas': [_c(1172, 780, 1243, 880), _c(1252, 925, 1288, 1000)], 'confianza': 'marca',
     'buses': ['exi'],
     'funcion': 'Chip de 14 patas de Macronix en el bus EXI: guarda el programa de arranque (IPL) y las fuentes, lleva el '
                'reloj de tiempo real y la pequeña SRAM de la configuración. X2 es su cristal de 32,768 kHz; la pila del '
                'reloj está en la placa de los mandos.',
     'verificacion': 'U10 según YAGCD (2.4.2, 2.6) y ConsoleArtisan (en PAL, «RTC P-DOL»); en la foto se lee el logotipo MX y '
                     'la referencia U10. Cristal de 32,768 kHz: ConsoleArtisan.'},
    {'id': 'reloj', 'nombre': 'Generador de reloj', 'pieza': 'Macronix (logotipo MX), U9 · oscilador X1 de 54,00 MHz',
     'esquema': [], 'bloque': 'reloj', 'cajas': [_c(575, 982, 663, 1085), _c(482, 997, 548, 1080)], 'confianza': 'marca',
     'buses': ['video'],
     'funcion': 'X1 es un oscilador de 54 MHz (se lee en su cápsula), la frecuencia del reloj de la salida de vídeo digital. '
                'U9, de Macronix, es uno de los dos generadores de reloj que YAGCD lista en la placa; de él salen los relojes '
                'de Flipper y del Gekko. Cómo los deriva no está documentado.',
     'verificacion': 'X1 y U9 se leen en la serigrafía; «54.00 MHz» en el oscilador; U9 como generador de reloj de Macronix: '
                     'YAGCD 2.4.2 (sin número de pieza).'},
    {'id': 'dvd', 'nombre': 'Conector de la unidad de discos', 'pieza': 'P9, 32 vías', 'esquema': [], 'bloque': 'dvd',
     'cajas': [_c(1322, 30, 1505, 432)], 'confianza': 'marca', 'buses': ['di', 'power'],
     'funcion': 'Une la placa con la unidad de minidiscos de 8 cm, que tiene su propio controlador (Matsushita MN102H y '
                'MN103S): lee, comprueba el código de protección del disco y entrega los datos a la interfaz DI de Flipper.',
     'verificacion': 'P9 en la serigrafía (pin 31 marcado); 32 vías y función: YAGCD 2.4.1. Controlador: ConsoleArtisan.'},
    {'id': 'mandos', 'nombre': 'Conector de la placa de los mandos', 'pieza': 'P3, cable plano', 'esquema': [],
     'bloque': 'mandos', 'cajas': [_c(1540, 585, 1625, 750)], 'confianza': 'marca', 'buses': ['si', 'power'],
     'funcion': 'Cable plano a la placa delantera con los cuatro puertos de mando, los botones de encendido y de reset y la '
                'pila del reloj. Los puertos llevan 5 V para la vibración y 3,43 V para la lógica, con un fusible '
                'rearmable común: si fallan los cuatro a la vez, se sospecha de él.',
     'verificacion': 'P3 en la serigrafía; YAGCD 2.4.1. Tensiones y fusible: ConsoleArtisan.'},
    {'id': 'tarjetas', 'nombre': 'Ranuras de tarjeta de memoria', 'pieza': 'P4 y P5 (ranuras A y B)', 'esquema': [],
     'bloque': 'tarjetas', 'cajas': [_c(1510, 95, 1824, 590), _c(1510, 755, 1824, 1265)], 'confianza': 'posicion',
     'buses': ['exi', 'power'],
     'funcion': 'Dos ranuras de 12 contactos en el bus EXI (serie, 3,3 V): patillas 4 y 8 a 3,3 V, patilla 6 a 5 V. '
                'También admiten adaptadores de tarjetas SD o el adaptador de red de algunos montajes.',
     'verificacion': 'P4 (A) arriba y P5 (B) abajo según YAGCD 2.4.1; la serigrafía «SIDE-A» queda junto a la de abajo, así '
                     'que cuál es cuál no se confirma en esta foto. Patillas: ConsoleArtisan.'},
    {'id': 'av-digital', 'nombre': 'Salida de vídeo digital', 'pieza': 'P2 («Digital AV Out», 22 vías)', 'esquema': [],
     'bloque': 'digital', 'cajas': [_c(8, 878, 345, 1185)], 'confianza': 'marca', 'buses': ['video', 'audio', 'power'],
     'funcion': 'Saca el vídeo en digital, YCbCr 4:2:2 en 8 bits con su reloj de 54 MHz, y el audio en serie (I²S). Nintendo '
                'la usó para el cable de componentes; las DOL-101 ya no la llevan. Su patilla 5 lleva +12 V: un '
                'cortocircuito con una línea de datos al soldar un adaptador HDMI mata la consola.',
     'verificacion': 'P2 en la serigrafía; YAGCD 2.4.1. Patillas, 54 MHz y el peligro de los 12 V: ConsoleArtisan.'},
    {'id': 'av-analogico', 'nombre': 'Salida de vídeo analógica', 'pieza': 'P7 («Analog AV Out», 12 vías)', 'esquema': [],
     'bloque': 'ave', 'cajas': [_c(8, 418, 305, 762)], 'confianza': 'posicion', 'buses': ['video', 'audio', 'power'],
     'funcion': 'El conector «multi out» de Nintendo: compuesto en todas las regiones, RGB solo en las PAL como esta (patillas '
                '1, 2 y 4) y S-Video solo en las NTSC; audio izquierdo y derecho en 11 y 12 y +5 V en la 10. En las PAL la '
                'patilla 3 puede llevar +12 V: un cable NTSC con sincronismo en esa patilla no debe usarse.',
     'verificacion': 'P7 a media altura del lado izquierdo según YAGCD 2.4.1 (la serigrafía queda tapada). Patillas: '
                     'ConsoleArtisan (que las toma de ConsoleMods).'},
    {'id': 'p1-arriba', 'nombre': 'Patillas del conector de alimentación', 'pieza': 'P1, 22 vías (el cuerpo está en la otra cara)',
     'esquema': [], 'bloque': 'alim', 'cajas': [_c(300, 1182, 590, 1248)], 'confianza': 'posicion', 'buses': ['power'],
     'funcion': 'Las soldaduras del conector P1, en el que se enchufa la tarjeta CC-CC por la cara de abajo. Por él llegan '
                'todas las tensiones de la placa.',
     'verificacion': 'Las dos filas de 11 taladros coinciden con el P1 de la cara de soldaduras.'},
]

BOTTOM = [
    {'id': 'ave', 'nombre': 'Codificador de vídeo AVE', 'pieza': 'AVE P-DOL A · RS5C583 · 2HS 74 (U6)', 'esquema': [],
     'bloque': 'ave', 'cajas': [_c(1268, 572, 1432, 692)], 'confianza': 'marca', 'buses': ['video', 'audio'],
     'funcion': 'Convierte el vídeo digital que manda Flipper en las señales analógicas del conector P7: en esta versión PAL, '
                'compuesto y RGB. No se ha encontrado hoja de datos. Si no hay imagen con un cable bueno y adecuado a la '
                'región, la avería está aquí o en Flipper.',
     'verificacion': 'U6 en la cara de soldaduras según YAGCD y ConsoleArtisan («AVE P -DOL A / RS5C583» en PAL); marca leída '
                     'en la foto.'},
    {'id': 'amp', 'nombre': 'Chip AMP-DOL', 'pieza': 'AMP-DOL · 236 H29 (U7)', 'esquema': [], 'bloque': 'ave',
     'cajas': [_c(1322, 885, 1428, 975)], 'confianza': 'marca', 'buses': ['audio'],
     'funcion': 'YAGCD lo lista como un posible amplificador, sin confirmarlo. Ninguna otra fuente lo describe.',
     'verificacion': 'U7 en la serigrafía; marca leída en la foto; YAGCD 2.4.2 («Amplifier?»).'},
    {'id': 'p1', 'nombre': 'Conector de alimentación P1', 'pieza': 'P1, 22 vías (patillas 21 y 22 rotuladas)', 'esquema': [],
     'bloque': 'alim', 'cajas': [_c(1262, 1168, 1662, 1345)], 'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Aquí se enchufa la tarjeta CC-CC. Qué tensión lleva cada patilla no está publicado: ConsoleArtisan aconseja '
                'comprobarlo con el polímetro contra una consola buena antes de fiarse de ningún esquema de patillas.',
     'verificacion': 'P1 en la serigrafía; 22 vías: YAGCD 2.4.1.'},
    {'id': 'p10', 'nombre': 'Puerto de alta velocidad', 'pieza': 'P10, 36 vías («Hi-Speed Port»)', 'esquema': [],
     'bloque': 'serie', 'cajas': [_c(1455, 95, 1665, 435)], 'confianza': 'posicion', 'buses': [],
     'funcion': 'Puerto paralelo de la base de la consola, el del Game Boy Player. Copetti lo describe como un bus de 8 bits '
                'que pasa por la ARAM.',
     'verificacion': 'Posición y vías: YAGCD 2.4.1; la serigrafía se lee a medias.'},
    {'id': 'serie1', 'nombre': 'Puerto serie 1', 'pieza': 'P6, 12 vías', 'esquema': [], 'bloque': 'serie',
     'cajas': [_c(370, 750, 532, 1047)], 'confianza': 'posicion', 'buses': ['exi'],
     'funcion': 'Puerto de la base para el adaptador de módem o de red de banda ancha, en el bus EXI.',
     'verificacion': 'YAGCD 2.4.1 (P6, 12 vías).'},
    {'id': 'serie2', 'nombre': 'Puerto serie 2', 'pieza': 'P8', 'esquema': [], 'bloque': 'serie',
     'cajas': [_c(400, 1145, 600, 1347)], 'confianza': 'marca', 'buses': ['exi'],
     'funcion': 'Segundo puerto serie de la base. Las DOL-101 y algunas DOL-CPU-30 tardías ya no lo montan.',
     'verificacion': 'P8 en la serigrafía; YAGCD 2.4.1 y 2.2; ConsoleArtisan.'},
]

DCDC = [
    {'id': 'jp1', 'nombre': 'Conector a la placa base', 'pieza': 'JP1, 22 vías', 'esquema': [], 'bloque': 'alim',
     'cajas': [_c(170, 1012, 1015, 1300)], 'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Se enchufa en el P1 de la placa base: por aquí salen todas las tensiones que la tarjeta fabrica a partir de '
                'los 12 V.',
     'verificacion': 'JP1 en la serigrafía de la tarjeta.'},
    {'id': 'entrada12', 'nombre': 'Entrada de 12 V', 'pieza': 'Conector de dos hilos (rojo y negro)', 'esquema': [],
     'bloque': 'alim', 'cajas': [_c(1295, 1110, 1530, 1345)], 'confianza': 'posicion', 'buses': ['power'],
     'funcion': 'Los 12 V de la fuente externa DOL-002 (una sola salida de 12 V; 3,25 A en la de EE. UU.). Es la única tensión '
                'que entra en la consola.',
     'verificacion': 'ConsoleArtisan (fuente y tensión).'},
    {'id': 'conmutados', 'nombre': 'Controladores de los convertidores', 'pieza': 'Dos chips sin marca legible (uno es U2)',
     'esquema': [], 'bloque': 'alim', 'cajas': [_c(920, 165, 1055, 290), _c(1330, 215, 1452, 325)], 'confianza': 'posicion',
     'buses': ['power'],
     'funcion': 'La tarjeta es un conjunto de convertidores conmutados (CC-CC) que bajan los 12 V a las tensiones de la placa: '
                'unos 1,8 V del núcleo y 3,3 V de las entradas y salidas, entre otras. Hay versiones de Mitsumi, Sharp y TDK.',
     'verificacion': 'Función y tensiones: ConsoleArtisan; la marca de estos dos chips no se lee en la foto.'},
    {'id': 'bobinas', 'nombre': 'Bobinas de los convertidores', 'pieza': 'L4 «100» y otra «100»; dos toroides',
     'esquema': [], 'bloque': 'alim',
     'cajas': [_c(215, 392, 582, 732), _c(652, 352, 1032, 752), _c(1140, 612, 1398, 842), _c(1255, 875, 1592, 1112)],
     'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Las bobinas de los convertidores conmutados y los filtros de la entrada.',
     'verificacion': 'L4 y «100» se leen en la foto.'},
    {'id': 'electroliticos', 'nombre': 'Condensadores de salida', 'pieza': '1000 µF, 390 µF, 390 µF (C63, C29) y 100 µF (C48)',
     'esquema': [], 'bloque': 'alim',
     'cajas': [_c(340, 768, 602, 1002), _c(636, 756, 872, 1002), _c(902, 756, 1150, 1002), _c(1042, 1030, 1232, 1235)],
     'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Condensadores de las salidas, de baja tensión (de 2,5 a 6,3 V en estas tarjetas). Con los años se secan: la '
                'imagen sale con nieve o con ondas y la solución es cambiarlos, junto con los electrolíticos de la placa base.',
     'verificacion': 'Capacidades leídas en las cápsulas; tensiones y avería: ConsoleArtisan.'},
]

MAQUINAS = [
    {
        'id': 'gamecube',
        'titulo': 'GameCube',
        'placa': 'DOL-CPU(P)-01 (PAL)',
        'esquema_titulo': 'Sin esquema',
        'sin_esquema': ('No existe ningún esquema de la GameCube: Nintendo no publicó manual de servicio y nadie ha '
                        'recreado la placa. ConsoleArtisan lo resume así: «no hay manual de servicio ni esquema del fabricante '
                        'para esta consola, y no va a haberlos». Por eso esta consola no tiene «Esquema» ni «Busque la avería» '
                        '(que necesita las redes de la placa): lo que se sabe de ella sale de las fotos, de la documentación '
                        'de quienes la han estudiado y de las marcas de sus chips.'),
        'fotos': [
            {'id': 'componentes', 'titulo': 'Cara de componentes · PAL', 'origen': 'gamecube/fotos/ifixit/1727-p7-1.jpg',
             'ancho': 1600, 'calidad': 78, 'credito': 'Foto: iFixit (desmontaje de la GameCube), CC BY-NC-SA 3.0',
             'revision': 'DOL-CPU(P)-01, PAL', 'hotspots': TOP,
             'nota': 'La placa sin el disipador, desde arriba. Los recuadros de colores los dibujó iFixit; la foto se ha reducido '
                     'sin recortarla. La serigrafía «C/DOL-CPU(P)-01» se lee, del revés, en el borde de abajo.'},
            {'id': 'soldaduras', 'titulo': 'Cara de soldaduras · PAL', 'origen': 'gamecube/fotos/ifixit/1727-p7-2.jpg',
             'ancho': 1600, 'calidad': 78, 'credito': 'Foto: iFixit (desmontaje de la GameCube), CC BY-NC-SA 3.0',
             'revision': 'DOL-CPU(P)-01, PAL (la misma placa)', 'hotspots': BOTTOM,
             'nota': 'La misma placa dada la vuelta de izquierda a derecha: las ranuras de las tarjetas quedan a la izquierda y '
                     'las salidas de vídeo a la derecha. Los recuadros de colores son de iFixit.'},
            {'id': 'cc-cc', 'titulo': 'Tarjeta de alimentación CC-CC', 'origen': 'gamecube/fotos/ifixit/1727-p8-3.jpg',
             'ancho': 1600, 'calidad': 78, 'credito': 'Foto: iFixit (desmontaje de la GameCube), CC BY-NC-SA 3.0',
             'revision': 'Tarjeta CC-CC de la misma consola', 'hotspots': DCDC,
             'nota': 'La tarjeta que fabrica las tensiones, vista dentro de la carcasa metálica de la base.'},
        ],
        'aviso': ('No hay esquema: las piezas se han identificado por las marcas y la serigrafía que se leen en las fotos y por '
                  'lo que dicen YAGCD y ConsoleArtisan. Cada recuadro dice si la pieza se reconoce por su marca o solo por '
                  'su posición. La placa de las fotos es una DOL-CPU(P)-01 PAL, de una DOL-001 con salida digital.'),
    },
]

FUENTES = {
    'gamecube': [
        {'titulo': 'iFixit — «Nintendo GameCube Teardown» (guía 1727), pasos 7 y 8',
         'autor': 'iFixit y colaboradores', 'url': 'https://www.ifixit.com/Teardown/Nintendo+GameCube+Teardown/1727',
         'licencia': 'CC BY-NC-SA 3.0 (uso no comercial, con atribución)',
         'uso': 'Las tres fotos: las dos caras de la placa DOL-CPU(P)-01 y la tarjeta CC-CC. Reducidas y recomprimidas, sin '
                'recortar. Con las dos caras se ha reconstruido la placa en 3D y en 2D.'},
        {'titulo': 'ConsoleArtisan — GameCube (referencia de reparación)', 'autor': 'Carl Myers (ConsoleArtisan)',
         'url': 'https://consoleartisan.com/reference/gamecube/',
         'licencia': '© 2026 ConsoleArtisan, sin licencia de reutilización: solo se citan datos, con la fuente',
         'uso': 'Que no hay esquema; revisiones DOL-001 y DOL-101 y sus placas; la fuente de 12 V y la tarjeta CC-CC; tensiones '
                'de la placa, de los mandos, de las ranuras y de los conectores de vídeo; los 12 V de la patilla 5 de la salida '
                'digital; referencias U6, U10, P4 y P5; averías comunes y su causa. Su autor avisa de que no ha reparado una '
                'GameCube en su banco: reúne fuentes secundarias.'},
        {'titulo': 'YAGCD — Yet Another GameCube Documentation (capítulos 2, 4, 5, 9 y 17)',
         'autor': 'Tmbinc, groepaz y colaboradores', 'url': 'https://www.gc-forever.com/yagcd/',
         'licencia': 'Sin licencia indicada: solo se citan datos',
         'uso': 'Referencias de la placa (U1–U10, P1–P10), buses y relojes, mapa de memoria, registros de hardware, mandos y '
                'formatos de imagen: la arquitectura y «Un fotograma».'},
        {'titulo': 'Rodrigo Copetti — «GameCube Architecture: A Practical Analysis»', 'autor': 'Rodrigo Copetti',
         'url': 'https://www.copetti.org/writings/consoles/gamecube/', 'licencia': 'CC BY 4.0',
         'uso': 'Gekko, Flipper, 1T-SRAM y ARAM; la tubería de escritura agrupada; las etapas del procesador gráfico (TEV, '
                'búfer de imagen y su copia al XFB); el DSP; las salidas de vídeo.'},
        {'titulo': 'devkitPro/libogc — gx.c y video.c', 'autor': 'Michael Wiedenbauer (shagkur), Dave Murphy (WinterMute)',
         'url': 'https://github.com/devkitPro/libogc', 'licencia': 'zlib',
         'uso': 'Comprobación: teselas de 8 × 8 texeles en los formatos de 4 bits (I4, CI4) y los modos de vídeo PAL. No se '
                'copia código.'},
        {'titulo': 'Dolphin — decodificador de texturas (TextureDecoder_Generic.cpp, en Source/Core/VideoCommon)', 'autor': 'Proyecto Dolphin',
         'url': 'https://github.com/dolphin-emu/dolphin', 'licencia': 'GPL-2.0 o posterior',
         'uso': 'Solo consultado: en el formato C4, el texel de la izquierda va en los 4 bits altos de cada byte. No se copia código.'},
        {'titulo': 'Sharp — hoja de datos de la serie PQ070XZ1H', 'autor': 'Sharp',
         'url': 'https://dtsheet.com/doc/1073029/sharp-pq070xz1hzxh', 'licencia': 'Hoja de datos del fabricante (consulta)',
         'uso': 'Qué es U13: regulador de baja pérdida de cinco patas, salida ajustable de 1,5 a 7 V, 1,5 A.'},
    ],
}

# Voltages and measuring points that the sources give (the «Fuentes» tab shows them as a table). Only connectors:
# with no schematic there are no internal test points to give.
TENSIONES = [
    {'punto': 'Entrada de la fuente (DOL-002)', 'tension': '12 V CC', 'donde': 'Clavija de la consola; tarjeta CC-CC',
     'nota': 'La única tensión que entra; las demás las hace la tarjeta CC-CC.', 'fuente': 'ConsoleArtisan'},
    {'punto': 'Núcleo de los chips', 'tension': '≈ 1,8 V', 'donde': 'Salida de la tarjeta CC-CC (P1 no está documentado)',
     'nota': 'Tensión «sana» de la placa según la fuente; no dice en qué patilla medirla.', 'fuente': 'ConsoleArtisan'},
    {'punto': 'Entradas y salidas', 'tension': '3,3 V', 'donde': 'Salida digital P2, patilla 17; ranuras P4/P5, patillas 4 y 8',
     'nota': '', 'fuente': 'ConsoleArtisan'},
    {'punto': 'Salida digital P2, patilla 5', 'tension': '+12 V', 'donde': 'P2 (22 vías)',
     'nota': 'Peligro: tocarla a la vez que una línea de datos mata la consola.', 'fuente': 'ConsoleArtisan'},
    {'punto': 'Salida analógica P7, patilla 10', 'tension': '+5 V', 'donde': 'P7 (12 vías)', 'nota': '', 'fuente': 'ConsoleArtisan'},
    {'punto': 'Salida analógica P7, patilla 3 (PAL)', 'tension': 'hasta +12 V', 'donde': 'P7',
     'nota': 'En las PAL; no use un cable NTSC que lleve el sincronismo en esa patilla.', 'fuente': 'ConsoleArtisan'},
    {'punto': 'Ranuras de tarjeta P4/P5, patilla 6', 'tension': '+5 V', 'donde': 'P4, P5', 'nota': 'Las tarjetas normales no la usan.',
     'fuente': 'ConsoleArtisan'},
    {'punto': 'Puertos de mando, patilla 1', 'tension': '5 V', 'donde': 'Placa de los mandos', 'nota': 'Para el motor de vibración.',
     'fuente': 'ConsoleArtisan'},
    {'punto': 'Puertos de mando, patilla 6', 'tension': '3,43 V', 'donde': 'Placa de los mandos',
     'nota': 'Lógica del mando. Los cuatro puertos comparten un fusible rearmable.', 'fuente': 'ConsoleArtisan'},
]

EXTRA = {
    'gamecube': {
        'revisiones': [
            {'vista': 'Foto', 'revision': 'DOL-CPU(P)-01, placa PAL de una DOL-001 (con salida digital y puerto serie 2)',
             'fuente': 'iFixit; serigrafía leída en la foto'},
            {'vista': 'Placa en 3D y 2D', 'revision': 'La misma DOL-CPU(P)-01, reconstruida a partir de las dos fotos',
             'fuente': 'iFixit'},
            {'vista': 'Arquitectura y «Un fotograma»', 'revision': 'La GameCube en general (Gekko, Flipper, 1T-SRAM, ARAM); los '
             'tiempos de vídeo, los del modo PAL de 50 Hz', 'fuente': 'YAGCD; Copetti; libogc'},
        ],
        'tensiones': TENSIONES,
        'tensiones_nota': ('Por qué no hay «Busque la avería»: esa actividad pone el polímetro sobre las redes de la placa, y '
                           'aquí no hay redes (no hay esquema) y las patillas donde se mide quedan bajo los conectores, que no se '
                           've en las fotos. Estas son las tensiones que dan las fuentes y dónde medirlas.'),
    },
}

# ------------------------------------------------------------------ the board in 3D and 2D, from the two photos

# Mounting-hole centres measured on the 3648 × 2736 photos (dark hole inside the gold ring): A left of Flipper,
# B right of Flipper, C below-left of the Gekko, D below-right. The bottom photo is the board turned over left-right.
AGUJEROS_F = [(1233.5, 1450.6), (2391.9, 1244.3), (1362.0, 2422.0), (2267.0, 2415.0)]
AGUJEROS_B = [(2504.1, 1457.1), (1336.2, 1275.3), (2391.4, 2445.3), (1467.6, 2452.8)]
# The board's outline on the top photo (px of the 3648 px original): rectangle with chamfered corners; the right edge
# runs under the memory-card slots and is taken from the slots' sub-board.
CONTORNO_F = [(410, 120), (500, 10), (3118, 30), (3228, 130), (3228, 2620), (3130, 2716), (530, 2716), (430, 2610)]
# Scale: the pins of the SOIC-14 chips U9 and U10 (1.27 mm pitch) measure 28.8 px between centres.
PX_MM = 28.8 / 1.27

# Bodies of the parts (on the top photo, px of the half-size copy as the hotspots; height mm; kind)
CUERPOS_F = [
    ('U1', 'FLIPPER A|© 2001 Nintendo|ATi  NEC', (670, 388, 1150, 868), 2.0, 'ci', '#bfc2c6'),
    ('U2', 'IBM|45L8926ESD|PPCDBK-EFB486X3', (745, 912, 1088, 1238), 2.0, 'ci', '#bfc2c6'),
    ('U3', 'MoSys|MS3M32B-5 B', (968, 150, 1208, 318), 1.4, 'ci', '#1b1b1d'),
    ('U4', 'MoSys|MS3M32B-5 B', (618, 150, 856, 318), 1.4, 'ci', '#1b1b1d'),
    ('U5', 'NEC|ARAM', (430, 128, 580, 394), 1.2, 'ci', '#1b1b1d'),
    ('U13', '070XZ1H|SHARP', (432, 40, 518, 122), 1.5, 'ci', '#1b1b1d'),
    ('U9', 'MX', (588, 1000, 650, 1068), 1.5, 'ci', '#1b1b1d'),
    ('U10', 'MX|RTC', (1180, 792, 1236, 870), 1.5, 'ci', '#1b1b1d'),
    ('X1', '54.00 MHz', (482, 997, 548, 1080), 1.6, 'lata', '#c3c7cc'),
    ('X2', '', (1252, 925, 1288, 1000), 2.0, 'lata', '#c3c7cc'),
    ('P2', '', (8, 878, 345, 1185), 12.0, 'conector', '#c3c7cc'),
    ('P7', '', (8, 418, 305, 762), 12.0, 'conector', '#c3c7cc'),
    ('P9', '', (1322, 30, 1505, 432), 8.0, 'conector', '#1c1c1e'),
    ('P3', '', (1540, 585, 1625, 750), 3.0, 'conector', '#1c1c1e'),
    ('P4', '', (1510, 95, 1824, 590), 10.0, 'conector', '#c3c7cc'),
    ('P5', '', (1510, 755, 1824, 1265), 10.0, 'conector', '#c3c7cc'),
]
# Parts of the bottom face (px of the half-size copy of the bottom photo)
CUERPOS_B = [
    ('U6', 'AVE P-DOL A|RS5C583', (1268, 572, 1432, 692), 1.5, 'ci', '#1b1b1d'),
    ('U7', 'AMP-DOL', (1322, 885, 1428, 975), 1.5, 'ci', '#1b1b1d'),
    ('P1', '', (1262, 1168, 1662, 1345), 6.0, 'conector', '#1c1c1e'),
    ('P10', '', (1455, 95, 1665, 435), 6.0, 'conector', '#c3c7cc'),
    ('P6', '', (370, 750, 532, 1047), 6.0, 'conector', '#c3c7cc'),
    ('P8', '', (400, 1145, 600, 1347), 6.0, 'conector', '#c3c7cc'),
]
NOMBRES = {h['id']: h for h in TOP + BOTTOM}
# Reference → the photo hotspot whose text describes it (the board's «f» field)
DE_PIEZA = {'U1': 'flipper', 'U2': 'gekko', 'U3': 'splash', 'U4': 'splash', 'U5': 'aram', 'U13': 'u13', 'U9': 'reloj',
            'U10': 'ipl', 'X1': 'reloj', 'X2': 'ipl', 'P2': 'av-digital', 'P7': 'av-analogico', 'P9': 'dvd', 'P3': 'mandos',
            'P4': 'tarjetas', 'P5': 'tarjetas', 'U6': 'ave', 'U7': 'amp', 'P1': 'p1', 'P10': 'p10', 'P6': 'serie1', 'P8': 'serie2'}


def _homografia(src, dst):
    import numpy as np
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(A, float))
    H = vt[-1].reshape(3, 3)
    return H / H[2, 2]


def _llevar(H, p):
    x, y = p
    d = H[2][0] * x + H[2][1] * y + H[2][2]
    return ((H[0][0] * x + H[0][1] * y + H[0][2]) / d, (H[1][0] * x + H[1][1] * y + H[1][2]) / d)


def construir_placa(cfg, d, fuentes, out_dir, problemas):
    """The board data for consolas_pcb.escribir (tipo 'foto'): outline, bodies of the identified parts (no pads, no
    nets), the two photos rectified as the faces' textures."""
    import cv2
    import numpy as np
    top = cv2.imread(os.path.join(fuentes, cfg['ruta']))
    bot = cv2.imread(os.path.join(fuentes, cfg['ruta_inferior']))
    if top is None or bot is None:
        raise SystemExit('consolas_gamecube: faltan las fotos de %s' % cfg['ruta'])
    # board frame (mm): origin at the outline's top-left, x right, y down, one scale (the top photo is taken from
    # straight above: its perspective is left uncorrected and goes into the error figure below)
    xs = [p[0] for p in CONTORNO_F]
    ys = [p[1] for p in CONTORNO_F]
    X0, Y0 = min(xs), min(ys)

    def a_mm(p):
        return ((p[0] - X0) / PX_MM, (p[1] - Y0) / PX_MM)
    ancho, alto = (max(xs) - X0) / PX_MM, (max(ys) - Y0) / PX_MM
    contorno_mm = [a_mm(p) for p in CONTORNO_F]
    # bottom photo -> top photo: homography through the four mounting holes (exact with four points); the error
    # is that of the three-point affine fits, measured when the holes were picked (about 15 px, 0.7 mm)
    H_bt = _homografia(AGUJEROS_B, AGUJEROS_F)
    os.makedirs(os.path.join(out_dir, cfg['id']), exist_ok=True)
    fotos = {}
    for lado, img in (('F', top), ('B', bot)):
        lado_tex = cfg.get('textura_px', {}).get(lado, 2048)
        k = lado_tex / max(ancho, alto)
        Wt, Ht = int(round(ancho * k)), int(round(alto * k))
        # texture px -> top photo px: (x / k * PX_MM + X0, …); the bottom face is warped into the same board frame (as
        # seen from above, like the Master System's bottom scan), through the hole registration
        S = np.array([[PX_MM / k, 0, X0], [0, PX_MM / k, Y0], [0, 0, 1]])
        if lado == 'F':
            M = S
        else:
            M = np.linalg.inv(H_bt) @ S
        tex = cv2.warpPerspective(img, M, (Wt, Ht), flags=cv2.WARP_INVERSE_MAP | cv2.INTER_AREA,
                                  borderMode=cv2.BORDER_CONSTANT, borderValue=(235, 235, 235))
        nombre = 'cara-%s.jpg' % lado
        cv2.imwrite(os.path.join(out_dir, cfg['id'], nombre), tex, [cv2.IMWRITE_JPEG_QUALITY, cfg.get('calidad', 78),
                                                                    cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
        fotos[lado] = {'src': 'consolas/placas/%s/%s' % (cfg['id'], nombre), 'w': Wt, 'h': Ht,
                       'bytes': os.path.getsize(os.path.join(out_dir, cfg['id'], nombre))}

    H_bt_inv = H_bt

    def q(v):
        return int(round(v * 100))

    huellas = []
    for lado, lista in (('F', CUERPOS_F), ('B', CUERPOS_B)):
        for ref, marca, caja, alto_mm, tipo, color in lista:
            esquinas = [(caja[0] * 2, caja[1] * 2), (caja[2] * 2, caja[1] * 2), (caja[2] * 2, caja[3] * 2), (caja[0] * 2, caja[3] * 2)]
            if lado == 'B':
                esquinas = [_llevar(H_bt_inv, p) for p in esquinas]
            mm = [a_mm(p) for p in esquinas]
            x0, x1 = min(p[0] for p in mm), max(p[0] for p in mm)
            y0, y1 = min(p[1] for p in mm), max(p[1] for p in mm)
            # parts overhanging the board edge (the A/V sockets, the card slots) are clipped to the outline
            x0c, x1c = max(0.0, x0), min(ancho, x1)
            cx, cy = (x0c + x1c) / 2, (y0 + y1) / 2
            w2, h2 = (x1c - x0c) / 2, (y1 - y0) / 2
            # bodies are drawn in the footprint's local frame; a bottom-side footprint is mirrored in x by the viewer
            cuerpo = [round(-w2, 3), round(-h2, 3), round(w2, 3), round(h2, 3)]
            if tipo == 'ci':
                m = {'tipo': 'ci', 'cuerpo': cuerpo, 'alto': alto_mm, 'color': color, 'patas_pads': False,
                     'marcado': marca, 'clasif': 'tabla'}
            elif tipo == 'lata':
                m = {'tipo': 'lata', 'cuerpo': cuerpo, 'alto': alto_mm, 'marcado': marca, 'color': color, 'clasif': 'tabla'}
            else:
                m = {'tipo': 'conector', 'cuerpo': cuerpo, 'alto': alto_mm, 'color': color, 'z0': 0.0, 'clasif': 'tabla'}
            # the viewer's selection, hit testing and 2D bodies read the fabrication box `caja` of every descriptor
            m['caja'] = cuerpo
            h = NOMBRES.get(DE_PIEZA.get(ref, ''), {})
            texto = h.get('funcion', '')
            huellas.append({
                'r': ref, 'v': h.get('pieza', ''), 'l': 'GC_' + tipo, 'lib': 'DOL-CPU(P)-01', 'x': q(cx), 'y': q(cy), 'a': 0,
                'lado': lado, 't': 'smd' if tipo == 'ci' else 'tht', 'pads': [0, 0], 'm': m, 'fab': [], 'f': texto,
                'fo': 'deducida', 'foto': DE_PIEZA.get(ref, ''),
                'rec': {'pos': 'foto', 'cuerpo': 'foto',
                        'nota': ('Recuadro de la pieza en la foto de la cara %s, llevado a la placa con la escala de las patillas '
                                 'de U9 y U10 (1,27 mm). Altura típica del encapsulado; sin pads ni redes: no hay esquema.'
                                 % ('de componentes' if lado == 'F' else 'de soldaduras'))}})
    err_px = 15.0
    comprobaciones = [
        {'tipo': 'aviso', 'texto': 'Reconstrucción a partir de dos fotos, sin esquema ni fichero de la placa: solo el contorno y '
                                   'el cuerpo de %d piezas identificadas; ni pads, ni pistas, ni redes.' % len(huellas)},
        {'tipo': 'aviso', 'texto': ('Escala: %s px/mm, del paso de 1,27 mm de las patillas de U9 y U10 (SOIC-14); la foto se '
                                    'toma como vista desde arriba, sin corregir su perspectiva: las medidas pueden errar un '
                                    '5 %%. Placa de unos %s × %s mm.') % (('%.1f' % PX_MM).replace('.', ','),
                                                                         ('%.0f' % ancho), ('%.0f' % alto))},
        {'tipo': 'ok', 'texto': ('Cara de soldaduras registrada sobre la de componentes por los cuatro taladros de fijación '
                                 'que se ven en las dos (error de unos %.0f px, %s mm).') % (err_px, ('%.1f' % (err_px / PX_MM)).replace('.', ','))},
    ]
    contorno = []
    lx = ly = None
    for x, y in contorno_mm:
        X, Y = q(x), q(y)
        contorno += [X, Y] if lx is None else [X - lx, Y - ly]
        lx, ly = X, Y
    info = {'escala': PX_MM, 'fotos': fotos, 'piezas': len(huellas)}
    return {
        'X0': 0.0, 'Y0': 0.0, 'ancho': ancho, 'alto': alto, 'ox': 0, 'oy': 0, 'capas': ['F', 'B'], 'grosor': 1.6,
        'redes': [], 'huellas': huellas, 'pads': [], 'pistas': {}, 'vias': [], 'zonas': [], 'areas': [], 'serigrafia': {},
        'contorno': contorno, 'mapa': {}, 'refs': [], 'comprobaciones': comprobaciones, 'fotos': fotos, 'info': info,
    }


def resumen(info):
    return ('escala %.2f px/mm, %d piezas; caras %s' % (info['escala'], info['piezas'],
            ', '.join('%s %d×%d %.0f kB' % (k, v['w'], v['h'], v['bytes'] / 1024) for k, v in info['fotos'].items())))


PLACAS = [
    {
        'id': 'gamecube', 'maquina': 'gamecube', 'tipo': 'foto', 'construir': construir_placa, 'resumen': resumen,
        'ruta': 'gamecube/fotos/ifixit/1727-p7-1.jpg', 'ruta_inferior': 'gamecube/fotos/ifixit/1727-p7-2.jpg',
        'textura_px': {'F': 2048, 'B': 1600}, 'calidad': 76,
        'titulo': 'DOL-CPU(P)-01 (PAL), reconstruida a partir de dos fotos de iFixit',
        'corto': 'DOL-CPU(P)-01 · reconstrucción',
        'enlazada': False, 'sin_esquema': True,
        'mascara': 'verde', 'serigrafia': 'amarilla', 'acabado': None,
        'aviso': ('Reconstrucción a partir de las fotos de las dos caras de una placa montada (iFixit): no hay esquema ni '
                  'fichero de la placa. Las caras son esas fotos enderezadas; el contorno y la posición de las piezas '
                  'identificadas se han medido en ellas, con la escala que dan las patillas de dos chips (1,27 mm). No hay '
                  'pads, pistas ni redes: lo que se ve del cobre está solo en la imagen. Los cuerpos y alturas son los típicos '
                  'de cada encapsulado.'),
        'fuente': {'titulo': 'iFixit — «Nintendo GameCube Teardown» (guía 1727), fotos de las dos caras de la placa',
                   'autor': 'iFixit y colaboradores', 'url': 'https://www.ifixit.com/Teardown/Nintendo+GameCube+Teardown/1727',
                   'licencia': 'CC BY-NC-SA 3.0',
                   'uso': 'Placa en 3D y en 2D reconstruida: las dos fotos, enderezadas, son las caras, y en ellas se han '
                          'medido el contorno y la posición de cada pieza identificada.'},
    },
]

