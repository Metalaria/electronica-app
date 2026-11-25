"""Sega Saturn (2.0, saturn20): the machine entry of «Consolas», its photo hotspots, bus group names, sources and the
comparison with Sega's own PAL schematic.

Schematic and board: RGBeter's KiCad 9 reproduction of the model-1 main board «837-11076-02 IC BD SATURN MAIN VA0.5»
(github.com/RGBeter/Sega_Saturn_VA0.5_Reproduction, commit f20170d, CERN-OHL-S-2.0), converted to KiCad 7 in the research
folder by saturn/herramientas/preparar.py (power symbols named per instance, otherwise unchanged). The netlist was
checked against the pad nets of the reproduction's own .kicad_pcb (3110 pads, 0 on another net) and against Sega's PAL
service manual (013-1, June 1995), whose schematic is consulted only (copyright, not shipped).

The CD subsystem of the HST-3200 sits on a separate «SH-1 board»: it is not in RGBeter's project; its sheet is the hand
transcription of Sega's «Schematic Diagram-7 [SH-1 C.B]» (saturn/sh1/transcripcion.py in the research folder).

Photo boxes are pixels of the photo as the app ships it (consolas/saturn/foto-<id>.jpg, 1600 px wide).
"""

FUENTE_RGBETER = 'https://github.com/RGBeter/Sega_Saturn_VA0.5_Reproduction/tree/f20170d672fabfa4fef355055b71c47ffebdf3b1'

GRUPOS = {
    'saturn': {
        'cbus_address': 'Bus de la CPU: direcciones (CA1–CA24)',
        'cbus_data': 'Bus de la CPU: datos (CD0–CD31)',
        'cbus_control': 'Bus de la CPU: control (CS, RD, R/W, WAIT, DQM, petición y cesión del bus)',
        'wram_low': 'Bus de la memoria lenta: ROM de arranque, RAM de respaldo, SMPC y WORK RAM-L (ECA, ECD, DA, DRAS…)',
        'abus': 'Bus A: cartucho y CD (AA, AD, ACS, ARD, AWR, AIRQ…)',
        'bbus': 'Bus B: VDP1, VDP2 y SCSP (BD0–BD15, BCS, BRDY…)',
        'vdp1_memory': 'Memoria del VDP1: VRAM y dos búferes de imagen (VRA, VRD, F0, F1, FBD)',
        'vdp2_memory': 'VRAM del VDP2 en dos bancos (RAA, RAD, RBA, RBD)',
        'video': 'Vídeo (RGB, sincronismos, reloj de punto, EXBG)',
        'sound_bus': 'Bus del 68EC000 y RAM de sonido (SCA, SCD, MA, MD)',
        'audio': 'Audio digital en serie (SCSP, CD y DAC)',
        'clocks': 'Relojes (MCLK, SCPUCLK, SCSPCLK)',
        'interrupts': 'Interrupciones (IRQ, NMI)',
        'serial': 'Enlace serie entre las dos SH-2',
        'controllers': 'Mandos',
        'reset': 'Reset',
        'power': 'Alimentación (VCC, LVCC 3,3 V, AVCC, +9 V)',
        'cd_block': 'Placa SH-1: bloque de CD (SH-1, YGR019, búfer)',
    },
}

# Evan-Amos's photos of a VA8 board (Wikimedia Commons, public domain), as shipped at 1600 px wide. Boxes read on the
# 1600 px pictures; markings read on the full-resolution files. «esquema» names the VA0.5 part that does the same job
# (EQUIVALENCIAS), not the same part number.
_CPU = ['cbus_address', 'cbus_data', 'cbus_control']
FOTO_VA8 = [
    {'id': 'sh2m', 'nombre': 'SH-2 maestra', 'pieza': 'Hitachi SH-2 HD6417095 · XY0707 · 6G1 F28 S (IC1)', 'esquema': ['IC1'],
     'bloque': 'sh2m', 'cajas': [[865, 565, 1010, 720]], 'confianza': 'marca', 'buses': _CPU + ['interrupts', 'serial', 'clocks'],
     'funcion': 'CPU principal de 32 bits (RISC, con 4 KB de caché). La hoja técnica de Sega da 28,6 MHz en NTSC (26,8 en el '
                'modo de 320 puntos); el manual PAL, 28,4 MHz. Arranca desde la ROM de arranque y recibe las interrupciones de la SCU.'},
    {'id': 'sh2s', 'nombre': 'SH-2 esclava', 'pieza': 'Hitachi SH-2 HD6417095 · XY0707 · 6G1 F28 S (IC2)', 'esquema': ['IC2'],
     'bloque': 'sh2s', 'cajas': [[865, 880, 1010, 1040]], 'confianza': 'marca', 'buses': _CPU + ['serial'],
     'funcion': 'La misma CPU, conectada como esclava: comparte el bus de la CPU con la maestra y le pide el bus para cada acceso. '
                'La maestra le manda trabajo y las dos se avisan por un enlace serie y por interrupciones.'},
    {'id': 'scu', 'nombre': 'SCU', 'pieza': 'SEGA 315-5966 · FHB007 · 9620 0AVA (IC5)', 'esquema': ['IC5'], 'bloque': 'scu',
     'cajas': [[708, 215, 905, 430]], 'confianza': 'marca', 'buses': _CPU + ['abus', 'bbus', 'interrupts'],
     'funcion': '«Saturn Control Unit»: une el bus de la CPU con el bus A (cartucho y CD) y el bus B (VDP1, VDP2 y SCSP), '
                'lleva tres canales de DMA, un DSP de cálculo y el controlador de interrupciones. En la VA0.5 del esquema es el 315-5688.'},
    {'id': 'wramh', 'nombre': 'WORK RAM-H (1 MB)', 'pieza': 'NEC D489020GF-A15 · 9619KU608 (IC3)', 'esquema': ['IC3', 'IC4'],
     'bloque': 'wramh', 'cajas': [[945, 1135, 1095, 1255]], 'confianza': 'marca', 'buses': _CPU,
     'funcion': 'La RAM rápida de trabajo: 1 MB de SDRAM en el bus de la CPU. La VA0.5 lleva dos SDRAM (IC3 e IC4); esta VA8, '
                'una sola NEC.'},
    {'id': 'dcc', 'nombre': 'Controlador de la DRAM', 'pieza': 'SEGA 315-5977-01 · 024 · 9625WX009 (IC6)', 'esquema': ['IC6'],
     'bloque': 'dcc', 'cajas': [[1115, 880, 1220, 1025]], 'confianza': 'marca', 'buses': _CPU + ['wram_low'],
     'funcion': 'Hace de puente entre el bus de la CPU y el bus lento de la ROM de arranque, la RAM de respaldo, el SMPC y la '
                'WORK RAM-L, a la que da las direcciones de fila y columna. En la VA0.5 es el 315-5778.'},
    {'id': 'wraml', 'nombre': 'WORK RAM-L (1 MB)', 'pieza': 'Mitsubishi M5M44260CJ · 624SJ02-7 (IC31, IC32)', 'esquema': ['IC31', 'IC32'],
     'bloque': 'wraml', 'cajas': [[1265, 715, 1445, 800], [1265, 840, 1445, 920]], 'confianza': 'marca', 'buses': ['wram_low'],
     'funcion': 'La otra mitad de la RAM de trabajo: 1 MB de DRAM normal (dos chips de 256K × 16), más lenta que la SDRAM.'},
    {'id': 'ipl', 'nombre': 'ROM de arranque (512 KB)', 'pieza': 'SEGA MPR-17941-MX · 41473A · B9627 (IC7)', 'esquema': ['IC7'],
     'bloque': 'ipl', 'cajas': [[1230, 1155, 1410, 1250]], 'confianza': 'marca', 'buses': ['wram_low'],
     'funcion': 'El programa inicial (IPL): pantalla de arranque, comprobación del disco, gestor de la memoria de partidas y '
                'biblioteca del CD. La SH-2 maestra empieza a ejecutar en su dirección 0.'},
    {'id': 'bram', 'nombre': 'RAM de respaldo (32 KB)', 'pieza': 'UMC UM62257M-70LL · 9624S · M40152 (IC8)', 'esquema': ['IC8'],
     'bloque': 'bram', 'cajas': [[1290, 955, 1420, 1030]], 'confianza': 'marca', 'buses': ['wram_low'],
     'funcion': 'SRAM de 256 Kbit para las partidas guardadas, alimentada por la pila CR2032 con la consola apagada.'},
    {'id': 'bat', 'nombre': 'Pila CR2032', 'pieza': 'BAT · BR2032 en su portapilas', 'esquema': ['BAT1'], 'bloque': 'smpc',
     'cajas': [[1300, 30, 1475, 210]], 'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Mantiene la RAM de respaldo y el reloj del SMPC con la consola apagada. Si se agota, se pierden las partidas y la '
                'consola pide la fecha y la hora al arrancar.'},
    {'id': 'smpc', 'nombre': 'SMPC', 'pieza': 'SEGA 315-5744 A05 · HD404920FS · 6G1 (IC9)', 'esquema': ['IC9'], 'bloque': 'smpc',
     'cajas': [[555, 1140, 700, 1245]], 'confianza': 'marca', 'buses': ['wram_low', 'controllers', 'reset'],
     'funcion': '«System Manager & Peripheral Control»: un microcontrolador de 4 bits de Hitachi que gobierna el reset de toda '
                'la consola, lee los mandos y lleva el reloj de tiempo real. Las SH-2 le mandan órdenes.'},
    {'id': 'vdp1', 'nombre': 'VDP1', 'pieza': 'SEGA 315-5883 · HD64440SF · 6E4 (IC10)', 'esquema': ['IC10'], 'bloque': 'vdp1',
     'cajas': [[455, 845, 650, 1035]], 'confianza': 'marca', 'buses': ['bbus', 'vdp1_memory'],
     'funcion': 'Dibuja sprites y polígonos de cuatro lados en uno de sus dos búferes de imagen mientras el otro se muestra. '
                'En la VA0.5 es el 315-5689.'},
    {'id': 'vdp2', 'nombre': 'VDP2', 'pieza': 'SEGA 315-5890-02 · FH3006B · 9622 DAHF (IC14)', 'esquema': ['IC14'], 'bloque': 'vdp2',
     'cajas': [[455, 540, 645, 750]], 'confianza': 'marca', 'buses': ['bbus', 'vdp2_memory', 'video'],
     'funcion': 'Genera la imagen al ritmo del barrido: hasta cinco planos de fondo, mezclados con lo que dibujó el VDP1, y '
                'su paleta (CRAM). Saca el RGB y los sincronismos. En la VA0.5 es el 315-5690.'},
    {'id': 'scsp', 'nombre': 'SCSP', 'pieza': 'SEGA 315-5687 · YMF292-F · 9621 LAGF (IC17)', 'esquema': ['IC17'], 'bloque': 'scsp',
     'cajas': [[190, 530, 385, 740]], 'confianza': 'marca', 'buses': ['bbus', 'sound_bus', 'audio'],
     'funcion': 'Procesador de sonido de Yamaha: 32 canales PCM/FM hasta 44,1 kHz con un DSP de efectos; también gobierna la RAM '
                'de sonido y el bus del 68EC000. Mezcla el audio del CD que le llega en serie.'},
    {'id': 'm68k', 'nombre': '68EC000 de sonido', 'pieza': 'Motorola MC68EC000FN12 · 0G74K · CPQDD9619 (IC18)', 'esquema': ['IC18'],
     'bloque': 'm68k', 'cajas': [[235, 850, 410, 1020]], 'confianza': 'marca', 'buses': ['sound_bus'],
     'funcion': 'CPU de 16 bits a 11,3 MHz que ejecuta el programa de sonido desde la RAM de sonido y programa la SCSP.'},
    {'id': 'pll', 'nombre': 'Generador de relojes', 'pieza': 'Cypress CY2292SC-04 · 9618 (IC20)', 'esquema': ['IC20'], 'bloque': 'pll',
     'cajas': [[735, 940, 790, 1060]], 'confianza': 'marca', 'buses': ['clocks'],
     'funcion': 'Multiplica el cristal X1 para dar los relojes de las CPU, los VDP y la SCSP. La VA0.5 lleva el 315-5746 de Sega.'},
    {'id': 'enc', 'nombre': 'Codificador RGB', 'pieza': 'Sony CXA1645M · 620A21V (IC21)', 'esquema': ['IC21'], 'bloque': 'av',
     'cajas': [[395, 295, 445, 415]], 'confianza': 'marca', 'buses': ['video'],
     'funcion': 'Convierte el RGB y el sincronismo del VDP2 en vídeo compuesto y S-vídeo para el conector de A/V.'},
    {'id': 'dac', 'nombre': 'DAC de audio', 'pieza': 'Philips TDA1386T · K5D874 (IC22)', 'esquema': ['IC22'], 'bloque': 'av',
     'cajas': [[190, 315, 245, 420]], 'confianza': 'marca', 'buses': ['audio'],
     'funcion': 'Convierte en analógico el audio digital en serie que sale de la SCSP (izquierdo y derecho).'},
    {'id': 'ygr', 'nombre': 'Bloque de CD: YGR019B', 'pieza': 'Hitachi YGR019B · 6G13 · JAPAN (IC37)', 'esquema': ['SH1-IC103'],
     'bloque': 'ygr', 'cajas': [[1085, 265, 1280, 470]], 'confianza': 'marca', 'buses': ['abus', 'cd_block'],
     'funcion': 'La matriz de puertas del bloque de CD: recibe los datos serie de la unidad, los guarda en el búfer y los entrega '
                'a las SH-2 por el bus A. En el modelo 1 va en la placa SH-1 aparte (YGR019A, SH1-IC103 del esquema).'},
    {'id': 'sh1', 'nombre': 'Bloque de CD: SH-1', 'pieza': 'Hitachi HD6437097F · C58 · CDB106 · 6F1 S (IC36)', 'esquema': ['SH1-IC101'],
     'bloque': 'sh1', 'cajas': [[1310, 320, 1450, 465]], 'confianza': 'marca', 'buses': ['cd_block'],
     'funcion': 'Un SH-1 a 20 MHz con el programa del bloque de CD en su ROM interna: habla con la unidad de CD, comprueba el '
                'disco y atiende las órdenes de las SH-2. En el modelo 1 va en la placa SH-1 (SH1-IC101).'},
    {'id': 'cart', 'nombre': 'Ranura de cartucho', 'pieza': 'CN1 (A1–A66, B1–B67)', 'esquema': ['CN1'], 'bloque': 'cart',
     'cajas': [[440, 80, 1085, 165]], 'confianza': 'marca', 'buses': ['abus'],
     'funcion': 'El bus A para cartuchos de memoria de respaldo o de RAM y otros periféricos.'},
    {'id': 'cdconn', 'nombre': 'Conector de la unidad de CD', 'pieza': 'CN11', 'esquema': ['CN4'], 'bloque': 'cd',
     'cajas': [[1160, 525, 1560, 645]], 'confianza': 'marca', 'buses': ['cd_block'],
     'funcion': 'En esta placa, el cable de la unidad de CD. En el modelo 1 (VA0.5) el conector CN4 lleva el bus A, el audio del '
                'CD y el vídeo MPEG a la placa SH-1.'},
    {'id': 'av', 'nombre': 'Salida de A/V', 'pieza': 'CN5', 'esquema': ['CN5'], 'bloque': 'av', 'cajas': [[90, 35, 195, 130]],
     'confianza': 'marca', 'buses': ['video', 'audio'],
     'funcion': 'Conector de A/V: RGB, vídeo compuesto, S-vídeo y audio estéreo.'},
    {'id': 'serie', 'nombre': 'Puerto de comunicaciones', 'pieza': 'CN6', 'esquema': ['CN6'], 'bloque': 'smpc',
     'cajas': [[245, 40, 380, 135]], 'confianza': 'marca', 'buses': ['serial'],
     'funcion': 'El puerto serie de las SH-2 (y MIDI de la SCSP) en la trasera de la consola.'},
    {'id': 'mandos', 'nombre': 'Puertos de mando', 'pieza': 'Conectores de los mandos 1 y 2', 'esquema': ['CN2A1', 'CN2B1'],
     'bloque': 'pads', 'cajas': [[460, 1340, 1055, 1465]], 'confianza': 'posicion', 'buses': ['controllers'],
     'funcion': 'Los dos puertos de mando, que lee el SMPC (con filtros EM en cada línea).'},
    {'id': 'alim', 'nombre': 'Entrada de alimentación', 'pieza': 'CN3 (conector blanco de 4 vías)', 'esquema': ['CN3'], 'bloque': 'alim',
     'cajas': [[115, 880, 190, 1015]], 'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Llegan las tensiones de la fuente interna: +9 V (unidad de CD y PLL), +5 V (VCC, todos los chips salvo la SDRAM) '
                'y +3,3 V (LVCC, la SDRAM), según el diagrama de bloques del manual de Sega.'},
    {'id': 'reset', 'nombre': 'Reset maestro', 'pieza': 'SW3', 'esquema': ['SW3'], 'bloque': 'smpc', 'cajas': [[1180, 1315, 1240, 1375]],
     'confianza': 'marca', 'buses': ['reset'],
     'funcion': 'El pulsador de reset maestro de la trasera: reinicia el SMPC.'},
]
FOTO_VA8_B = [
    {'id': 'b-vram', 'nombre': 'VRAM y búferes del VDP1', 'pieza': 'Hitachi HM524165CTT17S (IC11) · HM5221605TT17S (IC12, IC13)',
     'esquema': ['IC11', 'IC12', 'IC13'], 'bloque': 'vram1', 'cajas': [[885, 865, 975, 1015], [1010, 865, 1095, 1015], [1120, 865, 1210, 1015]],
     'confianza': 'marca', 'buses': ['vdp1_memory'],
     'funcion': 'SDRAM del VDP1: su VRAM de 512 KB, donde están las órdenes y las texturas, y los dos búferes de imagen de 256 KB.'},
    {'id': 'b-vram2', 'nombre': 'VRAM del VDP2', 'pieza': 'Hitachi HM5221605TT17S (IC15, IC16)', 'esquema': ['IC15', 'IC16'],
     'bloque': 'vram2', 'cajas': [[1000, 570, 1080, 720], [1125, 570, 1210, 720]], 'confianza': 'marca', 'buses': ['vdp2_memory'],
     'funcion': '512 KB de VRAM del VDP2 en dos bancos (A y B) que lee a la vez para componer los planos.'},
    {'id': 'b-snd', 'nombre': 'RAM de sonido (512 KB)', 'pieza': 'Hitachi HM514270CJ7 · 9612 5NN (IC19)', 'esquema': ['IC19'],
     'bloque': 'sram', 'cajas': [[1310, 525, 1410, 715]], 'confianza': 'marca', 'buses': ['sound_bus'],
     'funcion': 'DRAM de 4 Mbit que comparten la SCSP (muestras) y el 68EC000 (programa).'},
    {'id': 'b-cdbuf', 'nombre': 'Búfer del CD (512 KB)', 'pieza': 'Mitsubishi M5M44260CJ · 626SJ0A-7 (IC38)', 'esquema': ['SH1-IC102'],
     'bloque': 'cdbuf', 'cajas': [[155, 205, 255, 385]], 'confianza': 'marca', 'buses': ['cd_block'],
     'funcion': 'DRAM del bloque de CD donde se guardan los sectores leídos. En el modelo 1 es la HM514260 de la placa SH-1 (SH1-IC102).'},
]
FOTO_VA15 = []

SEGA_PAL = 'https://github.com/luckyseoul/saturn-docs/tree/main/files/service'
FUENTES = {
    'saturn': [
        {'titulo': 'RGBeter/Sega_Saturn_VA0.5_Reproduction — esquema y PCB en KiCad 9 de la placa «IC BD SATURN MAIN VA0.5» '
                   '(commit f20170d, agosto de 2026)',
         'autor': 'RGBeter',
         'url': FUENTE_RGBETER,
         'licencia': 'CERN-OHL-S-2.0 (licencia de hardware abierto «fuertemente recíproca»: permite estudiar, modificar y '
                     'distribuir citando al autor y con la misma licencia; su texto completo viaja con los datos)',
         'texto': 'consolas/saturn/LICENSE-RGBeter.txt',
         'uso': 'Esquema (hojas 1 a 6, pasadas de KiCad 9 a 7 sin cambiar el contenido) y placa en 3D y 2D. El autor avisa de que '
                'no ha fabricado ni probado su placa: la trazó a mano a partir de una placa original, y sus capas internas, que no '
                'pudo escanear, están deducidas de las externas. Comprobado aquí: las redes del esquema coinciden con las de los '
                '3110 pads de su PCB.'},
        {'titulo': 'Sega, «Service Manual Sega Saturn (PAL)», n.º 013-1, junio de 1995 (modelo MK-80200-50, placa VA0 PAL)',
         'autor': 'Sega Enterprises (escaneo archivado en el repositorio luckyseoul/saturn-docs)',
         'url': SEGA_PAL,
         'licencia': 'Copyright de Sega: solo consulta, no se incluye ninguna página',
         'uso': 'Hoja 7 (placa SH-1, el bloque de CD): transcrita a mano patilla a patilla de su «Schematic Diagram-7 [SH-1 C.B]» '
                'y redibujada; las lecturas dudosas están en las notas de abajo. Tablas de patillas de cada chip, con las que se han '
                'comprobado los nombres de las patillas de la reproducción de RGBeter (SH-2, SCU, DCC, SMPC, VDP1, VDP2, SCSP, PLL, '
                'codificador y DAC: 723 patillas comparadas; las 54 que no coinciden letra a letra son errores de OCR del escaneo o sinónimos como DQM/CAS o CLK/CK). '
                'Datos PAL: cristal X1 de 17,7344 MHz, SH-2 a 28,4 MHz, alimentación por CN3 (+9 V, +5 V y +3,3 V).'},
        {'titulo': '«SEGASATURN CIRCUIT SCHEMATIC Rev.10» (VA0.5 + subsistema de CD), 2010',
         'autor': 'BABAX (green.ap.teacup.com/junker), reproducido en ConsoleMods Wiki',
         'url': 'https://consolemods.org/wiki/images/1/1b/Sega_saturn_va0.5_schematics.pdf',
         'licencia': 'Sin licencia: solo consulta, no se incluye',
         'uso': 'Esquema hecho por un aficionado (no es de Sega), con notas en japonés. Solo para contrastar la transcripción de '
                'la placa SH-1: confirma, por ejemplo, cómo se unen las direcciones del bus A con el YGR019.'},
        {'titulo': 'Fotos «Sega-Saturn-Motherboard.jpg» y «Sega-Saturn-Motherboard-Model-VA8-Bottom.jpg» (26-09-2019)',
         'autor': 'Evan-Amos (Vanamo Media), Wikimedia Commons',
         'url': 'https://commons.wikimedia.org/wiki/File:Sega-Saturn-Motherboard.jpg',
         'licencia': 'Dominio público (cedidas por el autor sin condiciones)',
         'uso': 'Las dos caras de una placa VA8 de 1996 («171-7209C PC BD SATURN MAIN VA8 OCU»), reducidas a 1600 px. Las marcas '
                'de los chips se han leído en los originales.'},
        {'titulo': 'Sega, «Saturn Overview Manual» (ST-103-R1, abril de 1994) y «SCU User\'s Manual» (ST-097-R5, julio de 1994)',
         'autor': 'Sega Enterprises (archivo luckyseoul/saturn-docs)',
         'url': 'https://github.com/luckyseoul/saturn-docs/tree/main/files',
         'licencia': 'Copyright de Sega: solo consulta',
         'uso': 'Especificaciones (SH-2 a 28,6 MHz, 68EC000 a 11,3 MHz, SH-1 a 20 MHz, 2 MB de RAM de trabajo, 512 KB de ROM, '
                'VRAM y búferes) y el mapa de memoria de la SCU.'},
        {'titulo': 'Retro Tech Wiki: «Sega Saturn (Model 1)»',
         'autor': 'Colaboradores de Retro Tech Wiki',
         'url': 'https://retrotechwiki.com/Sega_Saturn_(Model_1)',
         'licencia': 'La página no indica licencia: solo los datos citados',
         'uso': 'Que la HST-3200 lleva el CD en una placa aparte y la HST-3210 lo pasa a la placa principal; el «FUSE» de la VA0 PAL '
                'es un puente de hilo; las pérdidas de partidas por la pila.'},
    ],
}

EQUIVALENCIAS = [
    {'foto': 'SCU 315-5966 (IC5)', 'esquema': '315-5688 (IC5)', 'senales': 'Las mismas funciones: puente de los buses de la CPU, A y B, DMA, DSP e interrupciones.',
     'cambios': 'Otra revisión del chip.', 'fuente': 'Retro Tech Wiki (VA13 con 315-5966)'},
    {'foto': 'VDP1 315-5883 (IC10)', 'esquema': '315-5689 (IC10)', 'senales': 'Mismo patillaje.',
     'cambios': 'El manual de Sega da las dos piezas para IC10.', 'fuente': 'manual PAL, especificaciones de IC10'},
    {'foto': 'VDP2 315-5890-02 (IC14)', 'esquema': '315-5690 (IC14)', 'senales': 'Mismo patillaje.',
     'cambios': 'El manual de Sega da 315-5690, 315-5690-02 y 315-5890 para IC14.', 'fuente': 'manual PAL, especificaciones de IC14'},
    {'foto': '315-5977-01 (IC6)', 'esquema': '315-5778 (IC6)', 'senales': 'Puente hacia la ROM de arranque, la RAM de respaldo, el SMPC y la WORK RAM-L.',
     'cambios': 'Otra revisión del controlador.', 'fuente': 'marcas de la foto'},
    {'foto': 'Cypress CY2292SC-04 (IC20)', 'esquema': 'Sega 315-5746 (IC20)', 'senales': 'Relojes a partir del cristal X1.',
     'cambios': 'Un sintetizador de reloj comercial en lugar del de Sega.', 'fuente': 'marcas de la foto'},
    {'foto': 'NEC D489020GF-A15 (IC3)', 'esquema': 'Dos SDRAM de 4 Mbit (IC3, IC4)', 'senales': '1 MB de WORK RAM-H en el bus de la CPU.',
     'cambios': 'Un solo chip.', 'fuente': 'marcas de la foto; ST-103'},
    {'foto': 'Mitsubishi M5M44260CJ (IC31, IC32)', 'esquema': 'HM514260 (IC31, IC32)', 'senales': 'WORK RAM-L, 256K × 16 cada una.',
     'cambios': 'Otro fabricante; el manual lista varios equivalentes.', 'fuente': 'manual PAL, IC31/32'},
    {'foto': 'MPR-17941-MX (IC7)', 'esquema': 'TC574200D (IC7)', 'senales': 'ROM de arranque de 4 Mbit.',
     'cambios': 'El manual PAL da EPR-17933/MPR-17933 para la VA0 PAL; la reproducción lleva una EPROM TC574200D.', 'fuente': 'manual PAL, IC7'},
    {'foto': 'UMC UM62257M-70LL (IC8)', 'esquema': 'NEC µPD43257B-120 (IC8)', 'senales': 'RAM de respaldo de 256 Kbit.',
     'cambios': 'Otro fabricante.', 'fuente': 'marcas de la foto'},
    {'foto': 'YGR019B (IC37), HD6437097F (IC36), M5M44260CJ (IC38) en la placa principal',
     'esquema': 'YGR019A, HD6437097 y HM514260 en la placa SH-1 (SH1-IC103, SH1-IC101, SH1-IC102)',
     'senales': 'El bloque de CD completo: SH-1, matriz de puertas y búfer de 512 KB.',
     'cambios': 'En la VA0.5 va en una placa aparte unida por E101/CN4; en la VA8 («OCU») está en la placa principal.',
     'fuente': 'serigrafía de la foto; manual PAL; Retro Tech Wiki'},
    {'foto': 'HM524165C, HM5221605 (IC11–IC13, IC15, IC16, cara de soldadura)', 'esquema': 'SDRAM-4M y SDRAM-2M (IC11–IC13, IC15, IC16)',
     'senales': 'VRAM y búferes del VDP1; VRAM del VDP2 en dos bancos.', 'cambios': 'En la VA8 están por debajo de la placa.',
     'fuente': 'marcas de la foto'},
]

EXTRA = {
    'saturn': {
        'revisiones': [
            {'vista': 'Esquema (hojas 1–6) y placa', 'revision': '837-11076-02 IC BD SATURN MAIN VA0.5 (171-6874E), modelo 1 japonés',
             'fuente': 'Serigrafía de la reproducción de RGBeter'},
            {'vista': 'Esquema (hoja 7)', 'revision': 'Placa SH-1 (838-10834 IC BD SATURN SH1) de la VA0 PAL',
             'fuente': 'Manual de servicio PAL de Sega, 013-1'},
            {'vista': 'Fotos', 'revision': '171-7209C PC BD SATURN MAIN VA8 OCU (837-12468, 1996)', 'fuente': 'Evan-Amos, Commons'},
        ],
        'equivalencias_cabecera': ['Chip de la foto (VA8)', 'Chip del esquema (VA0.5)', 'Señales', 'Cambios', 'Fuente'],
    },
}

MAQUINAS = [
    {
        'id': 'saturn',
        'titulo': 'Sega Saturn',
        'placa': 'IC BD SATURN MAIN VA0.5 (modelo 1)',
        'esquema_titulo': 'Saturn VA0.5 (RGBeter)',
        'raiz': 'saturn/kicad7/SegaSaturn_VA0_Repro.kicad_sch',
        'netlist': 'saturn/netlist/Saturn.nets.json',
        'buses': 'saturn/netlist/Saturn.buses.json',
        'svg': lambda path: 'saturn/svg/SegaSaturn_VA0_Repro%s.svg' % ('' if path == '/' else '-' + path.strip('/')),
        'nombre_raiz': 'Índice de hojas',
        # readings of Sega's SH-1 sheet that are doubtful or inferred (shown in «Fuentes»), with the board prefix
        'dudas': 'saturn/sh1/dudas_app.py',
        'nombres_hoja': {
            '/Main_1/': 'Hoja 1: las dos SH-2, la SCU y la WORK RAM-H',
            '/Main_2/': 'Hoja 2: VDP1, VDP2 y su memoria',
            '/Main_3/': 'Hoja 3: sonido (SCSP, 68EC000) y relojes',
            '/Main_4/': 'Hoja 4: ROM de arranque, RAM de respaldo, WORK RAM-L',
            '/Main_5/': 'Hoja 5: SMPC, mandos, vídeo y audio',
            '/Main_6/': 'Hoja 6: conectores y alimentación',
            '/SH1/': 'Hoja 7: placa SH-1, el bloque de CD (transcrita del manual de Sega)',
        },
        'licencia_texto': ('saturn/original/LICENCE', 'saturn/LICENSE-RGBeter.txt'),
        'equivalencias': EQUIVALENCIAS,
        'fotos': [
            {'id': 'va8', 'titulo': 'Placa VA8, cara de componentes · otra placa', 'origen': 'saturn/fotos/commons/Sega-Saturn-Motherboard.jpg',
             'ancho': 1600, 'calidad': 78, 'credito': 'Foto: Evan-Amos, Wikimedia Commons (dominio público)',
             'revision': '171-7209C PC BD SATURN MAIN VA8 OCU (1996), no la del esquema', 'hotspots': FOTO_VA8,
             'nota': 'Una placa de modelo 1 posterior, la VA8 de 1996 («OCU»: el bloque de CD va en la propia placa). Reducida y '
                     'recomprimida, sin recortar. Los recuadros llevan al chip del esquema VA0.5 que hace el mismo trabajo, aunque '
                     'su número de pieza sea otro (tabla de equivalencias).'},
            {'id': 'va8-b', 'titulo': 'Placa VA8, cara de soldadura · otra placa',
             'origen': 'saturn/fotos/commons/Sega-Saturn-Motherboard-Model-VA8-Bottom.jpg',
             'ancho': 1600, 'calidad': 78, 'credito': 'Foto: Evan-Amos, Wikimedia Commons (dominio público)',
             'revision': '171-7209C PC BD SATURN MAIN VA8 OCU (1996), no la del esquema', 'hotspots': FOTO_VA8_B,
             'nota': 'La otra cara de la misma placa: aquí están las memorias de vídeo, la de sonido y el búfer del CD.'},
        ],
        'aviso': 'Esquema de la reproducción en KiCad de RGBeter de la placa del primer modelo, «IC BD SATURN MAIN VA0.5», trazada '
                 'a mano a partir de una placa original (su autor no la ha fabricado ni probado). Se ha comprobado contra el '
                 'esquema oficial de Sega del manual de servicio PAL de 1995. El bloque de CD de este modelo va en una placa '
                 'aparte, la «placa SH-1», transcrita a mano del manual de Sega. Las fotos son de una placa VA8 posterior (1996).',
    },
]

# board in 3D and 2D (consolas_pcb.py): RGBeter's own PCB, the same project as the schematic's sheets 1-6
PLACAS = [
    {
        'id': 'saturn', 'maquina': 'saturn', 'tipo': 'kicad', 'cuerpos': True,
        # the Edge.Cuts arcs and lines of the project miss each other by a few µm
        'soldar_bordes': 0.05,
        # join the nearly collinear pieces of its traces (within 0.03 mm): the drawing is the same, with fewer segments
        'fusion_tolerancia': 3,
        'ruta': 'saturn/original/SegaSaturn_VA0_Repro.kicad_pcb',
        'titulo': 'IC BD SATURN MAIN VA0.5, reproducción KiCad de RGBeter (KiCad 9, commit f20170d)',
        'corto': 'VA0.5 · reproducción RGBeter',
        'enlazada': True,
        'mascara': 'verde', 'serigrafia': 'blanca', 'acabado': None,
        'aviso': 'Reproducción en KiCad de la placa principal VA0.5 del primer modelo de Saturn hecha por RGBeter trazando una placa '
                 'original: sigue su trazado, pero es un dibujo nuevo, no una foto, y su autor no la ha fabricado ni probado. La '
                 'original tiene cuatro capas; aquí se dibujan las dos de fuera (las internas, que RGBeter dedujo, llevan sobre todo '
                 'VCC y masa). Es el mismo proyecto que las hojas 1 a 6 del esquema, así que referencias y redes coinciden; la placa '
                 'SH-1 del CD (hoja 7) no está reproducida.',
        'fuente': {'titulo': 'RGBeter/Sega_Saturn_VA0.5_Reproduction — SegaSaturn_VA0_Repro.kicad_pcb (KiCad 9, commit f20170d)',
                   'autor': 'RGBeter', 'url': FUENTE_RGBETER,
                   'licencia': 'CERN-OHL-S-2.0 (hardware abierto, fuertemente recíproca; texto en las fuentes de la Saturn)',
                   'uso': 'Placa en 3D y en 2D: contorno, cobre de las dos caras exteriores, planos, vías, taladros, serigrafía y '
                          'componentes con sus huellas.'},
    },
]
