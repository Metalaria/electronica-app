"""Super Nintendo (PAL, SNSP-CPU-01) data of «Consolas»: bus groups, photo hotspots, sources and licences, tables.

The schematic and the board are stonedDiscord's nonSNES (GPL-3.0, commit cf2e70b): a 1:1 recreation of the PAL
SNSP-CPU-01 Rev5 (schematic credited to arzi84). Research folder: /home/claude/consolas/snes (see README.md).

Photos are swappable. A photo entry in consolas.MAQUINAS names an alignment file (JSON: points [X mm, Y mm, x px,
y px] that pair board coordinates of nonSNES.kicad_pcb with pixels of the photo, «modelo» «afin» or «homografia»)
and the footprint boxes extracted from the PCB (snes/pcb/SNSP-CPU-01_huellas.json). The hotspots below give no pixel
boxes: each box is the footprint box of its parts carried to the photo by the fitted map (`cajas_de_huellas`), and
every other part gets a marker position (`posiciones`). Another photo of the same board (the owner's, with its
chips) only needs its file and four or more points.
"""

import json
import math

import numpy as np

# Bus groups (contenido/consolas tools/snes_rules.json → snes/netlist/SNSP-CPU-01.buses.json)
GRUPOS = {
    'cpu_address': 'Bus A: direcciones (CA0–CA23)',
    'cpu_data': 'Datos (D0–D7, de los buses A y B)',
    'b_bus': 'Bus B: direcciones (PA0–PA7)',
    'cpu_control': 'Control (/CPURD, /CPUWR, /PARD, /PAWR, /ROMSEL, /RAMSEL, /IRQ, REFRESH)',
    'vram': 'VRAM (VAA0–13, VAB0–13, VA14, VDA0–7, VDB0–7, /VAWR, /VBWR, /VRD)',
    'ppu_link': 'De la PPU1 a la PPU2 (CHR, PRIO, COLOR, OVER, FIELD, HCLD, VCLD, 5MIN)',
    'smp_bus': 'Bus del S-SMP hacia el S-DSP (CPUA0–15, CPUD0–7)',
    'aram': 'ARAM (MA0–MA14, MD0–MD7, /SCE0, /SCE1, /SOE, /SWE)',
    'audio': 'Audio (serie del S-DSP al DAC, mezclador)',
    'clocks': 'Relojes (XIN de 21,28 MHz, SYSCK, S-CLK, 24,576 MHz)',
    'video': 'Vídeo (RGB, sincronismo, S-ENC)',
    'cic': 'CIC (bloqueo)',
    'reset': 'Reset',
    'controllers': 'Mandos ($4016/$4017)',
    'power': 'Alimentación',
}

# ------------------------------------------------------------------ photo hotspots
# 'huellas' (default: 'esquema'): the PCB footprints whose boxes make the hotspot's boxes. 'marca': the reference
# printed on the board is legible in the photo.

CARA_A = [
    {'id': 'cpu', 'nombre': 'CPU 5A22 (S-CPU)', 'pieza': 'Ricoh 5A22, núcleo 65C816 · QFP de 100 patas (U1)', 'esquema': ['U1'],
     'bloque': 'cpu', 'confianza': 'marca', 'buses': ['cpu_address', 'cpu_data', 'b_bus', 'cpu_control', 'controllers'],
     'funcion': 'Un 65C816 (registros de 16 bits, datos de 8 bits, direcciones de 24 bits) con DMA y HDMA de 8 canales, '
                'multiplicador y divisor, contadores para las interrupciones H/V y la lectura automática de los mandos. '
                'Gobierna dos buses: el A (CA0–CA23, /ROMSEL, /RAMSEL, /CPURD, /CPUWR) y el B (PA0–PA7, /PARD, /PAWR), '
                'que comparten los datos D0–D7. Cada acceso dura 6, 8 o 12 ciclos del reloj maestro XIN: 3,55, 2,66 o '
                '1,77 MHz en esta placa PAL.'},
    {'id': 'ppu1', 'nombre': 'PPU1 5C77 (S-PPU1)', 'pieza': 'Nintendo S-PPU1 · QFP de 100 patas (U2)', 'esquema': ['U2'],
     'bloque': 'ppu1', 'confianza': 'marca', 'buses': ['vram', 'b_bus', 'cpu_data', 'ppu_link'],
     'funcion': 'Lee los mosaicos de fondos y sprites de la VRAM (las dos memorias a la vez: 16 bits por acceso), guarda '
                'la tabla de sprites y calcula el modo 7 (rotación y escala). Pasa a la PPU2, píxel a píxel, el color, la '
                'paleta y la prioridad (CHR, COLOR, PRIO). Responde en $2100–$213F del bus B. PALMODE está a 5 V.'},
    {'id': 'ppu2', 'nombre': 'PPU2 5C78 (S-PPU2)', 'pieza': 'Nintendo S-PPU2 · QFP de 100 patas (U3)', 'esquema': ['U3'],
     'bloque': 'ppu2', 'confianza': 'marca', 'buses': ['ppu_link', 'b_bus', 'cpu_data', 'video', 'reset'],
     'funcion': 'Decide qué capa se ve en cada píxel, aplica ventanas, mezcla de colores y brillo, y convierte el resultado '
                'a RGB analógico con la paleta (CGRAM). Genera el sincronismo (CSYNC), el impulso de la salva de color '
                '(BURST) y las interrupciones de borrado. También reparte el reset: recibe /RESET del CIC y saca /RESOUT0 '
                '(PPU1) y /RESOUT1 (el resto).'},
    {'id': 'vram', 'nombre': 'VRAM (64 KB)', 'pieza': '2 × SRAM de 32K × 8 (U4, U5; en el esquema, MS62256CL-10FC)',
     'esquema': ['U4', 'U5'], 'bloque': 'vram', 'confianza': 'marca', 'buses': ['vram'],
     'funcion': 'Dos memorias en paralelo, cada una con su bus de 8 bits (VAA/VDA y VAB/VDB) y el bit VA14 común: la PPU1 lee '
                '16 bits en cada acceso. La CPU solo llega a ellas a través de los registros de la PPU ($2116–$2119).'},
    {'id': 'wram', 'nombre': 'WRAM 128 KB (S-WRAM)', 'pieza': 'Nintendo S-WRAM · SOP de 64 patas (U6)', 'esquema': ['U6'],
     'bloque': 'wram', 'confianza': 'marca', 'buses': ['cpu_address', 'cpu_data', 'b_bus', 'cpu_control'],
     'funcion': 'DRAM de 128 KB con dos puertas: en el bus A responde a /RAMSEL ($7E0000–$7FFFFF y el espejo $0000–$1FFF '
                'de los bancos bajos); en el bus B tiene un contador de direcciones propio ($2180–$2183), así que la DMA '
                'puede copiar de la ROM a la WRAM. La CPU la refresca con REFRESH: 40 ciclos maestros en cada línea.'},
    {'id': 'smp', 'nombre': 'CPU de sonido S-SMP', 'pieza': 'Sony S-SMP, núcleo SPC700 · QFP de 64 patas (U13)', 'esquema': ['U13'],
     'bloque': 'smp', 'confianza': 'marca', 'buses': ['smp_bus', 'b_bus', 'cpu_data'],
     'funcion': 'Procesador de 8 bits a 1,024 MHz (24,576 MHz ÷ 24) con una ROM de arranque de 64 bytes, tres temporizadores '
                'y cuatro puertos de comunicación: la CPU escribe y lee $2140–$2143 en el bus B (PA7 = 0, PA6 = 1) y el '
                'SPC700 los ve en $F4–$F7. Sus direcciones y datos van al S-DSP, que es quien habla con la ARAM.'},
    {'id': 'dsp', 'nombre': 'Generador de sonido S-DSP', 'pieza': 'Sony S-DSP · QFP de 80 patas (U14)', 'esquema': ['U14'],
     'bloque': 'dsp', 'confianza': 'marca', 'buses': ['smp_bus', 'aram', 'audio', 'clocks'],
     'funcion': 'Ocho voces de muestras comprimidas (BRR) leídas de la ARAM, con envolventes, ruido, eco y salida estéreo de '
                '16 bits a 32 kHz en serie (BCK, LRCK, DATA) hacia el DAC. Oscila con el resonador X2 de 24,576 MHz y '
                'reparte la ARAM entre él y el SPC700.'},
    {'id': 'aram', 'nombre': 'ARAM (64 KB)', 'pieza': '2 × SRAM de 32K × 8 (U15, U16; en el esquema, MS62256CL-10FC)',
     'esquema': ['U15', 'U16'], 'bloque': 'aram', 'confianza': 'marca', 'buses': ['aram'],
     'funcion': 'La memoria del sonido: programa del SPC700, muestras y búfer de eco. El S-DSP elige una u otra con /SCE0 y /SCE1.'},
    {'id': 'dac', 'nombre': 'DAC estéreo', 'pieza': 'NEC µPD6376 · SOIC de 16 patas (U17)', 'esquema': ['U17'],
     'bloque': 'dac', 'confianza': 'marca', 'buses': ['audio'],
     'funcion': 'Convierte las muestras serie del S-DSP en dos tensiones (izquierda y derecha) que van al mezclador.'},
    {'id': 'amp', 'nombre': 'Mezclador de audio', 'pieza': 'LM324 (U10) y los transistores Q13–Q17 de la otra cara',
     'esquema': ['U10'], 'bloque': 'dac', 'confianza': 'marca', 'buses': ['audio'],
     'funcion': 'Filtra la salida del DAC, le suma el audio del cartucho (SOUND-L/R) y de la expansión, y la entrega al '
                'Multi Out (estéreo) y al modulador (mono). Se alimenta de los +9 V.'},
    {'id': 'enc', 'nombre': 'Codificador de vídeo S-ENC', 'pieza': 'Nintendo S-ENC · SO de 24 patas (U7)', 'esquema': ['U7'],
     'bloque': 'enc', 'confianza': 'marca', 'buses': ['video'],
     'funcion': 'Del RGB de la PPU2 saca la luminancia y la crominancia (S-vídeo) y el vídeo compuesto, con el sincronismo '
                '(CSYNC) y la salva (BURST) de la PPU2. Su patilla NTSC/PAL está a masa: PAL.'},
    {'id': 'cic', 'nombre': 'CIC (bloqueo)', 'pieza': 'chip CIC · SOIC de 18 patas (U8)', 'esquema': ['U8'],
     'bloque': 'cic', 'confianza': 'marca', 'buses': ['cic', 'reset'],
     'funcion': 'Un pequeño microcontrolador que intercambia un flujo de bits con su gemelo del cartucho (CIC0–CIC2, con el '
                'reloj CIC3). Si no se entienden, mantiene /RESET bajo en la PPU2, que a su vez tiene en reset a toda la '
                'consola. El botón de reset entra por su patilla RES. Su reloj, 3,55 MHz, sale del S-CLK.'},
    {'id': 'sclk', 'nombre': 'Generador de reloj S-CLK', 'pieza': 'Nintendo S-CLK · SOIC de 14 patas (U18), solo en las PAL',
     'esquema': ['U18'], 'bloque': 'clk', 'confianza': 'marca', 'buses': ['clocks', 'cic'],
     'funcion': 'Con el cristal X1 de 17,734475 MHz (cuatro veces la subportadora PAL) genera el reloj maestro XIN de '
                '21,28137 MHz (× 6/5), la subportadora de 4,43 MHz y los 3,55 MHz (÷ 5) del CIC de la consola y del '
                'cartucho. Las NTSC no lo llevan: tienen un cristal de 21,477 MHz.'},
    {'id': 'x1', 'nombre': 'Cristal de 17,734 MHz', 'pieza': 'X1 y el condensador ajustable TC1', 'esquema': ['X1', 'TC1'],
     'bloque': 'clk', 'confianza': 'marca', 'buses': ['clocks'],
     'funcion': 'Base de tiempos de la consola. TC1 ajusta la frecuencia para que la subportadora de color sea exacta.'},
    {'id': 'x2', 'nombre': 'Resonador de 24,576 MHz', 'pieza': 'X2', 'esquema': ['X2'], 'bloque': 'dsp', 'confianza': 'marca',
     'buses': ['clocks'],
     'funcion': 'El reloj del sonido, independiente del de vídeo: 24,576 MHz ÷ 24 = 1,024 MHz para el SPC700 y ÷ 768 = '
                '32 kHz para las muestras. Por eso la CPU y el S-SMP solo se comunican por los cuatro puertos.'},
    {'id': 'cart', 'nombre': 'Ranura de cartucho', 'pieza': 'P1 · 62 contactos', 'esquema': ['P1'], 'bloque': 'cart',
     'confianza': 'marca', 'buses': ['cpu_address', 'cpu_data', 'b_bus', 'cpu_control', 'cic', 'clocks', 'audio'],
     'funcion': 'Todo el bus A (CA0–CA23, D0–D7, /ROMSEL, /CPURD, /CPUWR), el bus B (PA0–PA7, /PARD, /PAWR), /IRQ, '
                'WRAMSEL, REFRESH, SYSCK y el reloj maestro (para los chips de apoyo de los cartuchos), el CIC (CIC0–CIC3) '
                'y una entrada de audio estéreo (SOUND-L/R).'},
    {'id': 'exp', 'nombre': 'Puerto de expansión', 'pieza': 'P5 · 28 contactos (debajo de la consola)', 'esquema': ['P5'],
     'bloque': 'exp', 'confianza': 'marca', 'buses': ['b_bus', 'cpu_data', 'cpu_control', 'audio', 'clocks'],
     'funcion': 'Bus B con D0–D7, /PARD, /PAWR, /IRQ y reset, los relojes del punto (DOTCK) y del sonido (SMPCK), una '
                'entrada de audio estéreo y una salida mono. Lo usó el Satellaview japonés.'},
    {'id': 'av', 'nombre': 'Multi Out', 'pieza': 'P4 · 12 contactos', 'esquema': ['P4'], 'bloque': 'enc',
     'confianza': 'marca', 'buses': ['video', 'audio', 'power'],
     'funcion': 'RGB, S-vídeo, compuesto, audio estéreo y 5 V. En las PAL la patilla 3 no lleva el sincronismo, sino 12 V '
                '(D1, R72) que piden al televisor el modo 4:3 por el euroconector.'},
    {'id': 'rf', 'nombre': 'Modulador de RF', 'pieza': 'J2 (con su blindaje)', 'esquema': ['J2'], 'bloque': 'enc',
     'confianza': 'marca', 'buses': ['video', 'audio'],
     'funcion': 'Vídeo compuesto y audio mono modulados para la entrada de antena del televisor.'},
    {'id': 'mandos', 'nombre': 'Conector de los mandos', 'pieza': 'P2 · 11 vías hacia la placa de los puertos', 'esquema': ['P2'],
     'bloque': 'mandos', 'confianza': 'marca', 'buses': ['controllers'],
     'funcion': 'Los dos puertos de mando están en una placa aparte, en el frente de la carcasa. Llegan por aquí el reloj '
                '(JPCLK1/2), el latch (JPSTR), los datos ($4016/$4017 D0–D1) y las líneas de E/S JPIO6/7; cada una pasa '
                'por una resistencia, un condensador y diodos de protección de la otra cara.'},
    {'id': 'alim', 'nombre': 'Alimentación', 'pieza': 'J1, T1, DB1, F1, C67 (2200 µF) y el regulador 7805 (U12)',
     'esquema': ['J1', 'T1', 'DB1', 'F1', 'C67', 'U12'], 'bloque': 'alim', 'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Toma de corriente, filtro (T1), puente rectificador (DB1: acepta continua o alterna), fusible, condensador '
                'de filtrado y regulador lineal de 5 V. Q18, en la otra cara, saca los +9 V del audio.'},
    {'id': 'interruptor', 'nombre': 'Conector del interruptor', 'pieza': 'P3, 2 vías', 'esquema': ['P3'], 'bloque': 'alim',
     'confianza': 'marca', 'buses': ['power'], 'funcion': 'El interruptor de encendido corta la entrada entre el fusible y el regulador.'},
    {'id': 'reset', 'nombre': 'Botón de reset', 'pieza': 'SW2 (en nonSNES, también SW1) y el supervisor U11',
     'esquema': ['SW2', 'SW1', 'U11'], 'bloque': 'cic', 'confianza': 'marca', 'buses': ['reset'],
     'funcion': 'El botón carga C29 y llega a la entrada RES del CIC, que reinicia la consola a través de la PPU2. U11 vigila la '
                'tensión de 5 V: en la placa original es un chip de Mitsumi y nonSNES lo cambia por un LM809.'},
]

CARA_B = [
    {'id': 'b-rgb', 'nombre': 'Amplificadores RGB', 'pieza': 'Q3–Q8 (C2412K) con R4–R20', 'esquema': ['Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'],
     'huellas': ['Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'R8', 'R9', 'R10', 'R13', 'R14', 'R15', 'R18', 'R19', 'R20'],
     'bloque': 'enc', 'confianza': 'marca', 'buses': ['video'],
     'funcion': 'Dos transistores por color: la salida R, G o B de la PPU2 entra por la base del primero y sale, con más '
                'corriente, hacia el Multi Out.'},
    {'id': 'b-yc', 'nombre': 'Salidas de vídeo', 'pieza': 'Q9–Q12 (C2412K)', 'esquema': ['Q9', 'Q10', 'Q11', 'Q12'],
     'bloque': 'enc', 'confianza': 'marca', 'buses': ['video'],
     'funcion': 'Seguidores de emisor para la luminancia, la crominancia y el compuesto que salen del S-ENC.'},
    {'id': 'b-audio', 'nombre': 'Etapa de salida del audio', 'pieza': 'Q13–Q17 (C2412K)', 'esquema': ['Q13', 'Q14', 'Q15', 'Q16', 'Q17'],
     'bloque': 'dac', 'confianza': 'marca', 'buses': ['audio'],
     'funcion': 'Con dos amplificadores del LM324 (U10), dan la salida estéreo de baja impedancia y la mezcla mono del modulador.'},
    {'id': 'b-mandos', 'nombre': 'Protección de los mandos', 'pieza': 'DA1–DA10 (DAP202/DAN202) y R77–R91',
     'esquema': ['DA1', 'DA2', 'DA3', 'DA4', 'DA5', 'DA6', 'DA7', 'DA8', 'DA9', 'DA10'],
     'huellas': ['DA1', 'DA2', 'DA3', 'DA4', 'DA5', 'DA6', 'DA7', 'DA8', 'DA9', 'DA10', 'R77', 'R78', 'R79', 'R80', 'R81', 'R82',
                 'R83', 'R84', 'R85', 'R86', 'R87', 'R88', 'R89', 'R90', 'R91'],
     'bloque': 'mandos', 'confianza': 'marca', 'buses': ['controllers'],
     'funcion': 'Parejas de diodos que recortan a masa y a 5 V cualquier chispazo de los puertos de mando antes de llegar a la CPU.'},
    {'id': 'b-av', 'nombre': 'Protección del Multi Out', 'pieza': 'DA12–DA20 (DAN202)',
     'esquema': ['DA12', 'DA13', 'DA14', 'DA15', 'DA16', 'DA17', 'DA18', 'DA19', 'DA20'], 'bloque': 'enc', 'confianza': 'marca',
     'buses': ['video'], 'funcion': 'Diodos en cada salida de vídeo del Multi Out.'},
    {'id': 'b-9v', 'nombre': '+9 V del audio', 'pieza': 'Q18 (2SC5658), R76, C64 y DA11', 'esquema': ['Q18', 'DA11'],
     'huellas': ['Q18', 'R76', 'DA11'], 'bloque': 'alim', 'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Según el esquema, un transistor con la base filtrada (R76, C64) que saca de la entrada sin regular unos +9 V '
                'limpios para el LM324 y los transistores del audio.'},
    {'id': 'b-12v', 'nombre': '+12 V del Multi Out', 'pieza': 'D1 y R72', 'esquema': ['D1', 'R72'], 'bloque': 'enc',
     'confianza': 'marca', 'buses': ['power'],
     'funcion': 'La tensión de la patilla 3 del Multi Out en las PAL, que pide al televisor el modo 4:3.'},
]

# ------------------------------------------------------------------ sources and tables

LICENCIA_GPL = 'GPL-3.0 (GNU General Public License, versión 3)'
NONSNES = 'https://github.com/stonedDiscord/nonSNES/tree/cf2e70b35b141b551b1683b0fac1c4b29f9ed0d6'

FUENTES = [
    {'titulo': 'stonedDiscord/nonSNES — recreación KiCad de la placa PAL SNSP-CPU-01 Rev5 (commit cf2e70b, 7-4-2026)',
     'autor': 'stonedDiscord; esquema de arzi84; escaneos de placas desnudas de ArcadeTV (según el README)',
     'url': NONSNES, 'licencia': LICENCIA_GPL, 'texto': 'consolas/snes/LICENSE-nonSNES.txt',
     'uso': 'Esquema (una hoja A2 de KiCad 10, pasada a KiCad 7 sin cambiar el contenido), placa en 3D y en 2D, y las '
            'huellas con las que se colocan los puntos de las fotos. Lo que se dibuja aquí es una obra derivada de nonSNES '
            'y se distribuye con la misma licencia; el código fuente es el del enlace (commit fijado).'},
    {'titulo': 'Fotos de una placa SNSP-CPU-01 PAL por las dos caras (photo/front.jpg y photo/back.jpg de nonSNES)',
     'autor': 'Repositorio nonSNES (no indica el autor de estas dos fotos)',
     'url': NONSNES + '/photo', 'licencia': LICENCIA_GPL + ', la del repositorio',
     'uso': 'Cara de componentes (escaneo a 300 ppp con los chips quitados: se ven los pads y la serigrafía) y cara de '
            'soldadura con sus componentes de montaje superficial. Se han alineado con la PCB de nonSNES por las vías.'},
    {'titulo': 'Rodrigo Copetti, «Super Nintendo Architecture. A practical analysis»',
     'autor': 'Rodrigo Copetti', 'url': 'https://www.copetti.org/writings/consoles/super-nintendo/',
     'licencia': 'Solo consulta: no se copia texto',
     'uso': 'Para entender y comprobar la arquitectura: buses A y B, PPU1 y PPU2, VRAM de dos chips, S-SMP y S-DSP, y la '
            'patilla 3 del Multi Out en las PAL.'},
    {'titulo': 'anomie, «SNES memory mapping» (memmap.txt)', 'autor': 'anomie',
     'url': 'https://www.romhacking.net/documents/193/', 'licencia': 'Solo consulta',
     'uso': 'Mapa de memoria del decodificador: qué zonas van por el bus A o el B, cuáles bajan /ROMSEL o /RAMSEL y la '
            'velocidad de cada una (6, 8 o 12 ciclos maestros).'},
    {'titulo': '«Timing» (wiki de SNESdev) y «Timing» (wiki de superfamicom.org)', 'autor': 'Comunidad SNESdev',
     'url': 'https://snes.nesdev.org/wiki/Timing', 'licencia': 'Solo consulta',
     'uso': 'Cifras de la animación: 21,28137 MHz en PAL, 1364 ciclos maestros por línea, 312 líneas, refresco de 40 '
            'ciclos hacia el ciclo 536, DMA de 8 ciclos por byte, HDMA desde el punto 278, NMI al empezar el borrado '
            '(línea 225 o 240), lectura automática de los mandos de 4224 ciclos, APU a 24,576 MHz.'},
]

EXTRA = {
    'revisiones': [
        {'vista': 'Foto', 'revision': 'SNSP-CPU-01 PAL (© 1992 Nintendo): cara de componentes con los chips quitados y cara de '
                                      'soldadura con sus componentes', 'fuente': 'nonSNES (photo/)'},
        {'vista': 'Esquema y placa', 'revision': 'Recreación «1:1» de la SNSP-CPU-01 Rev5 con algunos cambios de nonSNES '
                                                 '(tabla de abajo)', 'fuente': 'nonSNES; esquema de arzi84'},
        {'vista': 'Arquitectura', 'revision': 'PAL (21,28137 MHz, 312 líneas, 50 Hz) como la placa; NTSC a elegir',
         'fuente': 'memmap.txt; Timing (SNESdev)'},
    ],
    'equivalencias_cabecera': ['SNSP-CPU-01 original (fotos)', 'nonSNES (esquema y placa)', 'Señales', 'Qué cambia', 'Fuente'],
    'citas': 'README: el README de nonSNES (commit cf2e70b), su lista de cambios. NTSC: diferencias con las consolas NTSC '
             '(SHVC-CPU-01), comprobadas en el esquema PAL y en Copetti.',
    'notas': [
        {'ref': 'TP1–TP107', 'texto': 'Puntos de prueba de la cara de soldadura: uno por cada línea de los buses (CA, D, PA, '
                                      'VRAM) y de algunas señales. Están en la placa y en el esquema.'},
        {'ref': 'P6, J3, P7, J4, J5', 'texto': 'Piezas que nonSNES añade para fabricar la placa hoy (placa de salida A/V y placa '
                                                'de mandos separables con «mousebites»). No existen en la SNSP-CPU-01 original ni '
                                                'en sus fotos.'},
        {'ref': 'U1', 'texto': 'NMI (patilla 45) está a 5 V en el esquema: en el 5A22 la interrupción de borrado se genera '
                               'dentro del chip, a partir de VBLANK de la PPU2.'},
    ],
}

EQUIVALENCIAS = [
    {'foto': 'Botón de reset (SW2)', 'esquema': 'SW2 «Old» y SW1, un pulsador de teclado Cherry MX', 'senales': 'Entrada RES del CIC',
     'cambios': 'nonSNES deja elegir un interruptor de teclado actual.', 'fuente': 'README'},
    {'foto': 'Supervisor de reset de Mitsumi (U11)', 'esquema': 'LM809 (U11)', 'senales': '/RESOUT1',
     'cambios': 'El de Mitsumi tiene un patillaje que no es el estándar de los supervisores; nonSNES pone uno que se fabrica.',
     'fuente': 'README'},
    {'foto': 'Condensador ajustable de X1 (TC1)', 'esquema': 'Trimmer actual (SurftrimGKG)', 'senales': 'Oscilador del S-CLK',
     'cambios': 'El original ya no se fabrica.', 'fuente': 'README'},
    {'foto': 'Multi Out (P4)', 'esquema': 'P4 y una placa A/V separable (P6, J3)', 'senales': 'RGB, Y/C, compuesto, audio',
     'cambios': 'Placa añadida para montar una salida A/V aparte.', 'fuente': 'README'},
    {'foto': 'Conector de mandos (P2) hacia la placa del frente', 'esquema': 'P2 y una placa de mandos separable (P7, J4, J5, D2–D7, O4, LED1)',
     'senales': 'JPCLK, JPSTR, $4016/$4017, JPIO6/7', 'cambios': 'La placa de los puertos de mando (con el piloto) va en la misma PCB.',
     'fuente': 'README'},
    {'foto': 'S-CLK (U18) + cristal de 17,734475 MHz', 'esquema': 'En NTSC: sin S-CLK, cristal de 21,477 MHz', 'senales': 'XIN',
     'cambios': 'El reloj maestro PAL es 6/5 de cuatro veces la subportadora PAL; el NTSC, seis veces la NTSC (3,579545 MHz).',
     'fuente': 'NTSC'},
    {'foto': 'PALMODE de la PPU1 y la PPU2 a 5 V; S-ENC con NTSC/PAL a masa', 'esquema': 'En NTSC, al revés',
     'senales': '312 líneas (50 Hz) frente a 262 (60 Hz)', 'cambios': 'Más líneas por cuadro y otra codificación del color.',
     'fuente': 'NTSC'},
    {'foto': 'Multi Out, patilla 3: +12 V', 'esquema': 'En NTSC: sincronismo compuesto (CSYNC)', 'senales': 'P4.3',
     'cambios': 'En las PAL, los 12 V piden 4:3 al televisor por el euroconector.', 'fuente': 'NTSC; Copetti'},
]


# ------------------------------------------------------------------ photo alignment

def ajuste(puntos, modelo='afin'):
    """Map board mm -> photo px fitted by least squares to [[X, Y, x, y], ...]: an affine map (3+ points) or a
    homography (4+ points, for a photo taken at an angle). Returns (function, median residual in px)."""
    P = np.array(puntos, dtype=float)
    X, Y, x, y = P[:, 0], P[:, 1], P[:, 2], P[:, 3]
    if modelo == 'homografia':
        filas = []
        for Xi, Yi, xi, yi in P:
            filas.append([Xi, Yi, 1, 0, 0, 0, -xi * Xi, -xi * Yi, -xi])
            filas.append([0, 0, 0, Xi, Yi, 1, -yi * Xi, -yi * Yi, -yi])
        _, _, vt = np.linalg.svd(np.array(filas))
        H = vt[-1].reshape(3, 3)
        H = H / H[2, 2]

        def llevar(a, b):
            d = H[2, 0] * a + H[2, 1] * b + H[2, 2]
            return ((H[0, 0] * a + H[0, 1] * b + H[0, 2]) / d, (H[1, 0] * a + H[1, 1] * b + H[1, 2]) / d)
    else:
        M = np.stack([X, Y, np.ones_like(X)], axis=1)
        A, *_ = np.linalg.lstsq(M, np.stack([x, y], axis=1), rcond=None)

        def llevar(a, b):
            return (A[0, 0] * a + A[1, 0] * b + A[2, 0], A[0, 1] * a + A[1, 1] * b + A[2, 1])
    res = [math.hypot(*(np.subtract(llevar(Xi, Yi), (xi, yi)))) for Xi, Yi, xi, yi in P]
    return llevar, float(np.median(res))


def cargar_alineacion(ruta, ancho_salida):
    """The alignment file of a photo, as a function board mm -> pixels of the photo as shipped (resized)."""
    with open(ruta, encoding='utf-8') as f:
        a = json.load(f)
    k = ancho_salida / a['ancho']
    llevar, med = ajuste(a['puntos'], a.get('modelo', 'afin'))
    return (lambda X, Y: tuple(v * k for v in llevar(X, Y))), a, med * k


def cajas_de_huellas(refs, huellas, llevar, w, h, margen=0.6, unir=2.5):
    """Photo boxes of some parts: each footprint box (mm, grown by `margen`) carried to the photo; boxes closer than
    `unir` mm are merged, so a group of neighbouring parts gets one box and far-apart parts get one each."""
    cajas = []
    for r in refs:
        f = huellas.get(r)
        if not f or not f['caja']:
            continue
        x0, y0, x1, y1 = f['caja']
        cajas.append([x0 - margen, y0 - margen, x1 + margen, y1 + margen])
    cambio = True
    while cambio:
        cambio = False
        for i in range(len(cajas)):
            for j in range(i + 1, len(cajas)):
                a, b = cajas[i], cajas[j]
                if a[0] - unir <= b[2] and b[0] - unir <= a[2] and a[1] - unir <= b[3] and b[1] - unir <= a[3]:
                    cajas[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del cajas[j]
                    cambio = True
                    break
            if cambio:
                break
    out = []
    for x0, y0, x1, y1 in cajas:
        pts = [llevar(x0, y0), llevar(x1, y0), llevar(x0, y1), llevar(x1, y1)]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        c = [max(0, round(min(xs))), max(0, round(min(ys))), min(w, round(max(xs))), min(h, round(max(ys)))]
        if c[2] > c[0] and c[3] > c[1]:
            out.append(c)
    return out
