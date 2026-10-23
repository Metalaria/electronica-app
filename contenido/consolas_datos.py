"""Hand-made data of the «Consolas» views: photo hotspots, bus group names, chip equivalences, sources.

Photo boxes are pixels of the book's photos as the app ships them (web/public/libro/img, 1600 px wide);
they were placed by looking at the photos (grid crops of the full-resolution v3/img originals) and every
legible marking was read off the photo. `confianza`: 'marca' = the marking on the part is legible in the
photo and identifies it; 'posicion' = identified by its position (silkscreen, board map of the neogeodev wiki)
because the marking is not legible or the part is hidden.
"""

# ------------------------------------------------------------------ bus groups (keys of *.buses.json)

GRUPOS = {
    'nes': {
        'cpu_address': 'Direcciones de la CPU (A0–A15)',
        'cpu_data': 'Datos de la CPU (D0–D7)',
        'ppu_address_data': 'Bus de la PPU (AD0–AD7, PA0–PA13)',
        'clocks': 'Relojes',
        'cpu_control': 'Control de la CPU (R/W, /NMI, /IRQ, /RST)',
        'ppu_control': 'Control de la PPU (ALE, /RD, /WE)',
        'chip_selects': 'Selecciones de chip',
        'controllers': 'Mandos',
        'cic': 'CIC (bloqueo regional)',
        'expansion': 'Puerto de expansión',
        'audio_video': 'Audio y vídeo',
        'power': 'Alimentación',
    },
    'neogeo': {
        'm68k_address': 'Direcciones del 68000 (A1–A23)',
        'm68k_data': 'Datos del 68000 (D0–D15)',
        'm68k_control': 'Control del 68000 (AS, LDS/UDS, R/W, DTACK, IPL)',
        'p_bus_graphics_address': 'Bus P (P0–P23, multiplexado)',
        'sprite_pixel_data': 'Píxeles de sprite (GAD, GBD, DOTA, DOTB)',
        'fix_s_rom': 'Capa fija (ROM S)',
        'vram_buses': 'Buses de VRAM (lenta B/E, rápida C/F)',
        'palette': 'Paleta (PA, PC, PALBNK)',
        'z80_sound': 'Sonido (Z80, YM2610, ROM V)',
        'clocks_timing': 'Relojes y temporización',
        'chip_selects_rom': 'Selecciones de chip y de ROM',
        'controllers_io': 'Mandos y E/S',
        'memory_card_bus': 'Tarjeta de memoria',
        'video_audio_out': 'Salida de audio y vídeo',
        'power': 'Alimentación',
    },
}

# ------------------------------------------------------------------ NES (NES-CPU-07, photo 1600 × 1166)

NES_HOTSPOTS = [
    {'id': 'U6', 'nombre': 'CPU RP2A03G', 'pieza': 'RP2A03G · 8A2 B7', 'esquema': ['U6'], 'bloque': 'cpu',
     'cajas': [[112, 445, 482, 545]], 'confianza': 'marca',
     'buses': ['cpu_address', 'cpu_data', 'cpu_control', 'clocks', 'controllers', 'audio_video'],
     'funcion': 'Núcleo 6502 (sin modo decimal) con la APU de sonido, el DMA de sprites y la E/S de los mandos '
                'integrados. Divide el reloj maestro entre 12 (1,789773 MHz) y saca M2 (φ2) con un ciclo de '
                'trabajo de 15/24 en la revisión G.'},
    {'id': 'U5', 'nombre': 'PPU RP2C02G-0', 'pieza': 'RP2C02G-0 · 7M3 52', 'esquema': ['U5'], 'bloque': 'ppu',
     'cajas': [[648, 360, 1020, 462]], 'confianza': 'marca',
     'buses': ['cpu_data', 'cpu_address', 'ppu_address_data', 'ppu_control', 'cpu_control', 'audio_video'],
     'funcion': 'Procesador de imagen: genera el vídeo compuesto NTSC punto a punto (reloj maestro ÷ 4 = '
                '5,369318 MHz), lee tablas de patrones y nametables por su bus multiplexado AD0–AD7 y avisa del '
                'retrazado vertical con /INT → /NMI de la CPU. La CPU la ve como 8 registros en $2000–$2007.'},
    {'id': 'U1', 'nombre': 'SRAM de trabajo (WRAM)', 'pieza': 'Fujitsu MB8416A-15-SK (2 KB)', 'esquema': ['U1'],
     'bloque': 'wram', 'cajas': [[265, 637, 478, 690]], 'confianza': 'marca',
     'buses': ['cpu_address', 'cpu_data', 'chip_selects'],
     'funcion': 'Los 2 KB de RAM de la CPU ($0000–$07FF, espejados hasta $1FFF porque A11 y A12 no se '
                'decodifican). /OE está fijo a masa y /WE es R/W: la selección /CS, que solo baja con M2 alto, '
                'decide cuándo actúa. Serigrafía «SRAM (WRAM)».'},
    {'id': 'U4', 'nombre': 'SRAM de vídeo (CIRAM)', 'pieza': 'Fujitsu MB8416A-15-SK (2 KB)', 'esquema': ['U4'],
     'bloque': 'vram', 'cajas': [[657, 652, 868, 703]], 'confianza': 'marca',
     'buses': ['ppu_address_data', 'ppu_control', 'chip_selects'],
     'funcion': 'Los 2 KB de RAM de la PPU: dos nametables de 1 KB. Su A10 y su /CE no vienen de la PPU sino '
                'del cartucho (CIRAM A10 y CIRAM /CE), que así elige el espejado horizontal o vertical. '
                'Serigrafía «SRAM (VRAM)».'},
    {'id': 'U2', 'nombre': 'Latch de direcciones de la PPU', 'pieza': 'TI SN74LS373N', 'esquema': ['U2'],
     'bloque': 'latch', 'cajas': [[652, 517, 838, 562]], 'confianza': 'marca',
     'buses': ['ppu_address_data', 'ppu_control'],
     'funcion': 'Ocho biestables transparentes: mientras ALE está alto copian AD0–AD7 y al bajar ALE retienen '
                'la parte baja de la dirección (PA0–PA7), de modo que AD0–AD7 queda libre para el dato. En '
                'esta placa es un 74LS373 (el esquema de la -11 dice 74HC373). El cableado está permutado '
                '(D0←AD6, D1←AD4…) para simplificar el trazado.'},
    {'id': 'U3', 'nombre': 'Decodificador de direcciones', 'pieza': 'TI SN74LS139N · 0805XJL', 'esquema': ['U3'],
     'bloque': 'dec', 'cajas': [[122, 320, 262, 368]], 'confianza': 'marca',
     'buses': ['cpu_address', 'clocks', 'chip_selects'],
     'funcion': 'Doble decodificador 2 a 4. La mitad B combina M2 y A15: da /ROMSEL ($8000–$FFFF) y habilita '
                'la mitad A para $0000–$7FFF; la mitad A decodifica A13–A14 en WRAM /CS ($0000–$1FFF) y '
                'PPU /CS ($2000–$3FFF). En esta placa es un 74LS139 (el esquema de la -11 dice 74HC139).'},
    {'id': 'U7', 'nombre': 'Búfer del mando I', 'pieza': 'Matsushita MN74HC368 (serigrafía 40H368 (CI))',
     'esquema': ['U7'], 'bloque': 'mandos', 'cajas': [[892, 140, 1030, 192]], 'confianza': 'marca',
     'buses': ['controllers', 'cpu_data'],
     'funcion': 'Seis búferes inversores tri-estado: cuando la CPU lee $4016, /OE1 baja y el búfer pone en '
                'D0–D4 los datos serie del puerto de mando I (invertidos).'},
    {'id': 'U8', 'nombre': 'Búfer del mando II', 'pieza': 'Matsushita MN74HC368 (serigrafía 40H368 (CII))',
     'esquema': ['U8'], 'bloque': 'mandos', 'cajas': [[892, 228, 1030, 276]], 'confianza': 'marca',
     'buses': ['controllers', 'cpu_data'],
     'funcion': 'Igual que U7, para el puerto II: lo habilita /OE2 al leer $4017.'},
    {'id': 'U9', 'nombre': 'Inversores 74HCU04', 'pieza': 'Toshiba 74HCU04AP · 8807H', 'esquema': ['U9'],
     'bloque': 'u9', 'cajas': [[1052, 425, 1190, 480]], 'confianza': 'marca',
     'buses': ['ppu_control', 'cic', 'audio_video'],
     'funcion': 'Seis inversores sin búfer (U = unbuffered) con tres usos: oscilador de 4 MHz de la CIC '
                '(con X2), inversor de PA13 → /A13 para la CIRAM, y amplificador lineal de audio (realimentado '
                'con R6, 47 kΩ) que mezcla SOUND-1/SOUND-2. El esquema de la -11 dice 74LS04.'},
    {'id': 'U10', 'nombre': 'CIC (chip de bloqueo)', 'pieza': 'Nintendo 3193A · ©1986 · 8744 A', 'esquema': ['U10'],
     'bloque': 'cic', 'cajas': [[917, 545, 1055, 602]], 'confianza': 'marca',
     'buses': ['cic', 'cpu_control'],
     'funcion': 'Microcontrolador de 4 bits (10NES) que dialoga en serie con su gemelo del cartucho; si no '
                'coinciden, reinicia la consola una vez por segundo. Genera el /RST de la CPU y la PPU.'},
    {'id': 'X1', 'nombre': 'Cristal maestro 21,477 MHz', 'pieza': 'KDS 8A · 21.47727', 'esquema': ['X1', 'Q2', 'Q3', 'TC1'],
     'bloque': 'osc', 'cajas': [[418, 122, 514, 200]], 'confianza': 'marca', 'buses': ['clocks'],
     'funcion': 'Seis veces la subportadora NTSC (6 × 3,579545 MHz). Con Q2 forma el oscilador; Q3 lo separa '
                'como seguidor de emisor hacia la CPU (por C44 y R13) y el cartucho (SYSTEM-CLK); la PPU lo '
                'toma por C45. El trimmer TC1 ajusta la frecuencia.'},
    {'id': 'TC1', 'nombre': 'Trimmer del oscilador', 'pieza': 'TC1 · 30 pF', 'esquema': ['TC1'], 'bloque': 'osc',
     'cajas': [[275, 151, 318, 195]], 'confianza': 'marca', 'buses': ['clocks'],
     'funcion': 'Condensador ajustable en serie con el cristal: retoca la frecuencia del oscilador para que '
                'la subportadora de color quede centrada.'},
    {'id': 'Q2', 'nombre': 'Transistores del oscilador', 'pieza': '2SC2021 (Q2, Q3)', 'esquema': ['Q2', 'Q3'],
     'bloque': 'osc', 'cajas': [[162, 150, 214, 172], [162, 217, 214, 239]], 'confianza': 'marca',
     'buses': ['clocks'],
     'funcion': 'Q2 es el oscilador Colpitts del cristal X1; Q3, el seguidor de emisor que reparte el reloj.'},
    {'id': 'X2', 'nombre': 'Cristal de la CIC', 'pieza': 'X2 · 4.000 MHz (serigrafía)', 'esquema': ['X2'],
     'bloque': 'cic', 'cajas': [[1107, 547, 1145, 612]], 'confianza': 'posicion', 'buses': ['cic'],
     'funcion': 'Resonador de 4 MHz del oscilador de la CIC (con un inversor de U9). Su reloj también va al '
                'cartucho (CIC-CLK) para que las dos CIC vayan sincronizadas.'},
    {'id': 'P1', 'nombre': 'Conector de cartucho (72 contactos)', 'pieza': 'P1', 'esquema': ['P1'], 'bloque': 'cart',
     'cajas': [[85, 775, 1095, 950]], 'confianza': 'posicion',
     'buses': ['cpu_address', 'cpu_data', 'ppu_address_data', 'ppu_control', 'chip_selects', 'clocks', 'cic'],
     'funcion': 'Lleva al cartucho los dos buses completos: el de la CPU (A0–A14, D0–D7, /ROMSEL, M2, R/W, '
                '/IRQ) para la PRG-ROM y el de la PPU (PA0–PA13, PD0–PD7, /RD, /WR) para la CHR; y recibe '
                'CIRAM A10 y CIRAM /CE, con los que el cartucho decide el espejado.'},
    {'id': 'P2', 'nombre': 'Puerto de expansión (48 contactos)', 'pieza': 'P2', 'esquema': ['P2'], 'bloque': 'exp',
     'cajas': [[315, 210, 862, 305]], 'confianza': 'posicion',
     'buses': ['expansion', 'cpu_data', 'controllers', 'audio_video'],
     'funcion': 'Conector inferior de la consola, nunca usado comercialmente en Occidente: datos de la CPU, '
                'líneas de mando, /IRQ, audio y vídeo y diez líneas EXP que van al cartucho.'},
    {'id': 'P4', 'nombre': 'Conector del mando I', 'pieza': 'P4 (7 vías)', 'esquema': ['P4'], 'bloque': 'mandos',
     'cajas': [[1128, 0, 1240, 56]], 'confianza': 'posicion', 'buses': ['controllers'],
     'funcion': 'Cable hacia el puerto frontal I: alimentación, reloj (/OE1), strobe (OUT0) y datos D0–D4.'},
    {'id': 'P5', 'nombre': 'Conector del mando II', 'pieza': 'P5 (7 vías)', 'esquema': ['P5'], 'bloque': 'mandos',
     'cajas': [[1327, 152, 1385, 265]], 'confianza': 'posicion', 'buses': ['controllers'],
     'funcion': 'Igual que P4, para el puerto II (/OE2). A su lado, los condensadores de 330 pF C27–C31 '
                'filtran cada línea.'},
    {'id': 'DA1', 'nombre': 'Diodos de protección (mando I)', 'pieza': 'DAN601 / µPA64H (DA1, DA2)',
     'esquema': ['DA1', 'DA2'], 'bloque': 'mandos', 'cajas': [[1082, 172, 1205, 221]], 'confianza': 'marca',
     'buses': ['controllers'],
     'funcion': 'Redes de diodos a VCC y a masa que recortan las descargas electrostáticas en las líneas del '
                'puerto I.'},
    {'id': 'DA3', 'nombre': 'Diodos de protección (mando II)', 'pieza': 'DAN601 / µPA64H (DA3, DA4)',
     'esquema': ['DA3', 'DA4'], 'bloque': 'mandos', 'cajas': [[1082, 262, 1207, 328]], 'confianza': 'marca',
     'buses': ['controllers'],
     'funcion': 'Lo mismo para el puerto II.'},
    {'id': 'Q1', 'nombre': 'Transistor de salida de vídeo', 'pieza': '2SA937 (Q1)', 'esquema': ['Q1'], 'bloque': 'av',
     'cajas': [[1082, 335, 1135, 352]], 'confianza': 'marca', 'buses': ['audio_video'],
     'funcion': 'Seguidor de emisor PNP que separa la salida de vídeo compuesto de la PPU (VIDEO_OUT, U5.21) '
                'hacia el modulador y el puerto de expansión, con R2 = 510 Ω.'},
    {'id': 'RA2', 'nombre': 'Red de resistencias 4 × 6,8 kΩ', 'pieza': 'RA2', 'esquema': ['RA2'], 'bloque': 'mandos',
     'cajas': [[390, 392, 472, 410]], 'confianza': 'posicion', 'buses': ['controllers', 'ppu_address_data'],
     'funcion': 'Resistencias de pull-up de OUT0, /OE1, /OE2 y PPU A13.'},
    {'id': 'R7', 'nombre': 'Mezclador de audio', 'pieza': 'R7, R9 = 20 kΩ; R8 = 12 kΩ', 'esquema': ['R7', 'R8', 'R9'],
     'bloque': 'av', 'cajas': [[400, 335, 480, 385]], 'confianza': 'marca', 'buses': ['audio_video'],
     'funcion': 'Suman las dos salidas de la APU (SOUND-1: pulsos; SOUND-2: triángulo, ruido y DPCM) y el '
                'audio del puerto de expansión antes del amplificador hecho con U9.'},
    {'id': 'P6', 'nombre': 'Conector de alimentación y reset', 'pieza': 'P6 (5 vías, azul)', 'esquema': ['P6', 'P7'],
     'bloque': 'alim', 'cajas': [[1287, 300, 1390, 500]], 'confianza': 'posicion', 'buses': ['power', 'cic'],
     'funcion': 'Entrada de +9 V y +5 V desde la placa de alimentación y la línea del botón de reset (hacia la '
                'CIC) y del LED. C14–C18 desacoplan cada vía.'},
    {'id': 'FC1', 'nombre': 'Bobinas de filtro', 'pieza': 'FC1 (39 µH), FC2', 'esquema': ['FC1', 'FC2'], 'bloque': 'av',
     'cajas': [[1165, 547, 1217, 602]], 'confianza': 'marca', 'buses': ['audio_video'],
     'funcion': 'FC2 es la ferrita de la salida de vídeo; FC1 filtra la alimentación del modulador.'},
    {'id': 'P3', 'nombre': 'Modulador de RF y salidas A/V', 'pieza': 'MOD RF (P3)', 'esquema': ['P3'], 'bloque': 'av',
     'cajas': [[1095, 585, 1590, 1160]], 'confianza': 'posicion', 'buses': ['audio_video', 'power'],
     'funcion': 'Caja blindada que convierte el vídeo compuesto y el audio en señal de antena (canal 3/4) y '
                'los saca también por las dos tomas RCA.'},
]

# ------------------------------------------------------------------ Neo Geo AES (NEO-AES, photo 1600 × 1168)

NEOGEO_HOTSPOTS = [
    {'id': '68k', 'nombre': 'CPU 68000', 'pieza': 'Toshiba TMP68HC000N-12', 'esquema': ['U3'], 'bloque': 'm68k',
     'cajas': [[718, 255, 1008, 338]], 'confianza': 'marca',
     'buses': ['m68k_address', 'm68k_data', 'm68k_control', 'clocks_timing'],
     'funcion': 'CPU principal de 16/32 bits a 12 MHz (24 MHz ÷ 2). Ejecuta el juego desde la ROM P del '
                'cartucho, escribe en la VRAM a través de los registros del LSPC y manda códigos de sonido al Z80.'},
    {'id': 'z80', 'nombre': 'CPU de sonido Z80', 'pieza': 'Zilog Z0840004PSC · 9113', 'esquema': ['U24'],
     'bloque': 'z80', 'cajas': [[800, 558, 1065, 648]], 'confianza': 'marca',
     'buses': ['z80_sound', 'clocks_timing'],
     'funcion': 'Z80 a 4 MHz (reloj 4M del LSPC) dedicado al sonido: lee el programa de la ROM M1 del cartucho, '
                'recibe del 68000 un código de un byte (con NMI) y programa el YM2610.'},
    {'id': 'ym2610', 'nombre': 'Sintetizador YM2610', 'pieza': 'Yamaha YM2610', 'esquema': ['U27', 'U26'],
     'bloque': 'ym', 'cajas': [[1075, 250, 1352, 340]], 'confianza': 'marca',
     'buses': ['z80_sound', 'clocks_timing', 'video_audio_out'],
     'funcion': 'OPNB a 8 MHz: 4 canales FM, 3 SSG, 6 ADPCM-A y 1 ADPCM-B, que lee directamente de las ROM V '
                'del cartucho por sus propios buses multiplexados. Sus temporizadores dan la IRQ del Z80. Su DAC '
                'YM3016 está en la zona 2Q del mapa de la placa, tapado por el cableado en la foto.'},
    {'id': 'lspc', 'nombre': 'LSPC-A0 (vídeo)', 'pieza': 'SNK CORP LSPC-A0 · 89080702', 'esquema': ['U21'],
     'bloque': 'lspc', 'cajas': [[228, 520, 385, 700]], 'confianza': 'marca',
     'buses': ['vram_buses', 'p_bus_graphics_address', 'clocks_timing', 'm68k_data', 'm68k_control'],
     'funcion': 'Controlador de sprites y de vídeo de 1.ª generación: recorre las dos VRAM, forma la lista de '
                'sprites de cada línea, saca las direcciones de las ROM C, S y L0 por el bus P, genera los '
                'relojes de 8 y 4 MHz, el sincronismo y las interrupciones del 68000. En el esquema de la 3-5 '
                'es el LSPC2-A2 (U21).'},
    {'id': 'prob0', 'nombre': 'PRO-B0', 'pieza': 'SNK CORP PRO-B0 · 89081402', 'esquema': ['U13', 'U4'],
     'bloque': 'prob0', 'cajas': [[645, 728, 795, 890]], 'confianza': 'marca',
     'buses': ['sprite_pixel_data', 'palette', 'controllers_io', 'z80_sound'],
     'funcion': 'Chip a medida de 1.ª generación: lectura de los mandos, interfaz con el Z80 (el byte de '
                'comunicación) y la mitad alta de los buffers de línea (número de paleta, 8 bits). En la 2.ª '
                'generación sus funciones se reparten entre NEO-C1 (U4) y NEO-B1 (U13).'},
    {'id': 'proc0', 'nombre': 'PRO-C0', 'pieza': 'SNK CORP PRO-C0 · 89080902', 'esquema': ['U4', 'U13'],
     'bloque': 'proc0', 'cajas': [[928, 725, 1068, 888]], 'confianza': 'marca',
     'buses': ['m68k_address', 'm68k_control', 'chip_selects_rom', 'sprite_pixel_data', 'palette'],
     'funcion': 'Decodificación de direcciones del 68000 (selecciones de ROM, RAM, puertos, paleta, LSPC), '
                'watchdog y la mitad baja de los buffers de línea (número de color, 4 bits). En la 2.ª '
                'generación: NEO-C1 (U4) y parte de NEO-B1 (U13).'},
    {'id': 'bios', 'nombre': 'ROM del sistema (BIOS)', 'pieza': 'Toshiba TC531024P-15 «NEO-EP0» · C575',
     'esquema': ['U36'], 'bloque': 'bios', 'cajas': [[900, 112, 1150, 200]], 'confianza': 'marca',
     'buses': ['m68k_address', 'm68k_data', 'chip_selects_rom'],
     'funcion': 'ROM de máscara de 64K × 16 (128 KB) en $C00000: arranque, pantalla de SNK, pruebas y la tabla '
                'de vectores mientras el sistema no la cede al cartucho.'},
    {'id': 'l0', 'nombre': 'ROM L0', 'pieza': 'Toshiba TC531000CP «000-L0» · C554', 'esquema': ['U16'],
     'bloque': 'l0', 'cajas': [[470, 555, 655, 640]], 'confianza': 'marca', 'buses': ['p_bus_graphics_address'],
     'funcion': 'Tabla de reducción vertical de los sprites: el LSPC la consulta por el bus P para saber qué '
                'línea del tile toca dibujar con el factor de reducción del sprite.'},
    {'id': 'z80ram', 'nombre': 'RAM del Z80', 'pieza': 'ROHM BR6116-100 (2 KB)', 'esquema': ['U23'], 'bloque': 'z80ram',
     'cajas': [[1085, 588, 1212, 650]], 'confianza': 'marca', 'buses': ['z80_sound'],
     'funcion': '2 KB de RAM del Z80 en $F800–$FFFF.'},
    {'id': 'wram', 'nombre': 'RAM de usuario del 68000', 'pieza': 'Sony CXK58257 (32K × 8)', 'esquema': ['U1', 'U2'],
     'bloque': 'wram', 'cajas': [[752, 145, 868, 218]], 'confianza': 'posicion', 'buses': ['m68k_address', 'm68k_data'],
     'funcion': '64 KB de RAM de trabajo en $100000–$10FFFF (dos chips de 8 bits: byte alto y byte bajo). '
                'Zona «1I» del mapa de la placa.'},
    {'id': 'svram', 'nombre': 'VRAM lenta', 'pieza': 'Sony CXK58257 ×2', 'esquema': ['U17', 'U18'], 'bloque': 'svram',
     'cajas': [[148, 750, 248, 885]], 'confianza': 'posicion', 'buses': ['vram_buses'],
     'funcion': '32K × 16: atributos de los sprites (SCB1: número de tile, paleta, volteo) y el mapa de la capa '
                'fija. El LSPC la lee una vez por sprite y por línea. Zona «7B».'},
    {'id': 'fvram', 'nombre': 'VRAM rápida', 'pieza': 'Sony CXK5814P-35L ×2 (2K × 8, 35 ns)', 'esquema': ['U19', 'U20'],
     'bloque': 'fvram', 'cajas': [[372, 825, 532, 950]], 'confianza': 'marca', 'buses': ['vram_buses'],
     'funcion': '2K × 16: reducción, posición Y y altura (SCB2–SCB3), posición X (SCB4) y la lista de sprites '
                'de la línea. Es rápida porque el LSPC la recorre entera para elegir los 96 sprites de cada '
                'línea. Zona «8E».'},
    {'id': 'palram', 'nombre': 'RAM de paleta', 'pieza': '(oculta bajo el conector blanco)', 'esquema': ['U6', 'U7'],
     'bloque': 'palram', 'cajas': [[1290, 345, 1545, 432]], 'confianza': 'posicion', 'buses': ['palette'],
     'funcion': '8K × 16 en dos bancos de 4096 colores (PALBNK): cada píxel del buffer de línea se convierte '
                'aquí en un color de 16 bits (5 bits por canal, un bit menos significativo común y el bit «oscuro»). Zona «4PQ», tapada en la foto.'},
    {'id': 'latch', 'nombre': 'Latches de paleta', 'pieza': '74LS273 (serigrafía «LS273»)', 'esquema': ['U9', 'U10'],
     'bloque': 'dac', 'cajas': [[360, 338, 462, 425]], 'confianza': 'posicion', 'buses': ['palette', 'clocks_timing'],
     'funcion': 'Capturan los 16 bits del color con el reloj de píxel de 6 MHz para que el DAC vea un valor '
                'estable durante todo el píxel. Zona «3EF».'},
    {'id': 'dac', 'nombre': 'DAC de vídeo de resistencias', 'pieza': '3,9 kΩ · 8,2 kΩ · 150 Ω · 2,2 kΩ (serigrafía)',
     'esquema': [], 'bloque': 'dac', 'cajas': [[385, 245, 655, 322]], 'confianza': 'posicion',
     'buses': ['palette', 'video_audio_out'],
     'funcion': 'Resistencias ponderadas que convierten 5 bits por color (más el bit común y el oscuro) en las '
                'tensiones R, G y B. Zona «2EF».'},
    {'id': 'enc', 'nombre': 'Codificador de vídeo', 'pieza': 'CXA1145 y cristal de subportadora (marcas no legibles)',
     'esquema': ['U32', 'X2'], 'bloque': 'enc', 'cajas': [[100, 290, 270, 410]], 'confianza': 'posicion',
     'buses': ['video_audio_out', 'clocks_timing'],
     'funcion': 'Convierte R, G, B y el sincronismo del LSPC en vídeo compuesto y RGB para el conector DIN; su '
                'cristal (3,58 MHz en NTSC) da la subportadora de color. Zona «3B».'},
    {'id': 'reloj', 'nombre': 'Oscilador maestro de 24 MHz', 'pieza': 'X1 (serigrafía) y su inversor 74LS',
     'esquema': ['X1', 'U80'], 'bloque': 'reloj', 'cajas': [[380, 80, 640, 200]], 'confianza': 'posicion',
     'buses': ['clocks_timing'],
     'funcion': 'Cristal de 24 MHz (24,000 MHz NTSC; 24,167829 MHz en la versión PAL del esquema) con un '
                'oscilador de inversores. De él salen 12 MHz para el 68000 y, a través del LSPC, 8 MHz (YM2610), '
                '6 MHz (píxel) y 4 MHz (Z80). Zona «1F».'},
    {'id': 'cart', 'nombre': 'Ranura de cartucho', 'pieza': 'SNK FCG-H100 · CN4', 'esquema': ['CN4', 'CN5'],
     'bloque': 'cart', 'cajas': [[462, 338, 1200, 545]], 'confianza': 'marca',
     'buses': ['m68k_address', 'm68k_data', 'p_bus_graphics_address', 'sprite_pixel_data', 'fix_s_rom',
               'z80_sound', 'clocks_timing'],
     'funcion': 'Doble conector de 2 × 120 contactos: la placa PROG (ROM P del 68000, ROM M1 del Z80, ROM V del '
                'YM2610) y la placa CHA (ROM C de sprites con su serializador NEO-ZMC2 y ROM S de la capa fija).'},
    {'id': 'ls244', 'nombre': 'Búfer 74LS244', 'pieza': '74LS244 (serigrafía «LS244»)', 'esquema': ['U15'],
     'bloque': 'l0', 'cajas': [[478, 650, 612, 698]], 'confianza': 'posicion', 'buses': ['p_bus_graphics_address'],
     'funcion': 'Búfer de 8 bits junto a la ROM L0; en la 3-5, U15 (74LS244) devuelve al bus P el dato de la L0.'},
    {'id': 'cre401', 'nombre': 'Filtros de los mandos', 'pieza': 'CRE401 ×4', 'esquema': ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'],
     'bloque': 'pads', 'cajas': [[395, 950, 530, 990], [535, 950, 668, 990], [968, 915, 1102, 955], [1103, 915, 1218, 955]],
     'confianza': 'marca', 'buses': ['controllers_io'],
     'funcion': 'Redes RC integradas que filtran y protegen las entradas de los dos mandos. Zonas «9EF» y «9LM».'},
    {'id': 'pads', 'nombre': 'Puertos de mando', 'pieza': 'DE-15 (1 y 2)', 'esquema': ['CN1', 'CN2'], 'bloque': 'pads',
     'cajas': [[420, 1088, 602, 1168], [1035, 1088, 1202, 1168]], 'confianza': 'posicion', 'buses': ['controllers_io'],
     'funcion': 'Conectores de 15 contactos de los mandos 1 y 2.'},
    {'id': 'card', 'nombre': 'Ranura de tarjeta de memoria', 'pieza': 'CN6', 'esquema': ['CN6'], 'bloque': 'card',
     'cajas': [[1230, 1058, 1555, 1168]], 'confianza': 'posicion', 'buses': ['memory_card_bus'],
     'funcion': 'Tarjeta de memoria JEIDA de 2 KB para guardar partidas, mapeada en $800000–$BFFFFF.'},
    {'id': 'pl241s', 'nombre': 'Placa auxiliar PL241S', 'pieza': 'PL241S · SN74LS161AN ×3 · cristal · ajuste «ADJ»',
     'esquema': [], 'bloque': 'enc', 'cajas': [[1215, 430, 1552, 1058]], 'confianza': 'marca',
     'buses': ['clocks_timing'],
     'funcion': 'Placa añadida en fábrica con contadores 74LS161, un cristal y un ajuste. Por sus componentes y '
                'lo que dice el wiki de neogeodev de las NEO-AES tardías, probablemente es la placa de '
                'limpieza de vídeo (PLL de la subportadora), sin confirmar. Tapa la zona «8OPQR».'},
    {'id': 'ttl', 'nombre': 'Lógica TTL discreta', 'pieza': 'HD74LS… (marcas no legibles)', 'esquema': ['U22', 'U5', 'U34'],
     'bloque': 'z80', 'cajas': [[1125, 655, 1218, 962]], 'confianza': 'posicion',
     'buses': ['z80_sound', 'chip_selects_rom'],
     'funcion': 'Puertas 74LS que en la 1.ª generación hacen parte de lo que luego integraron NEO-D0, NEO-G0 y '
                'NEO-E0 (selecciones del Z80, búfer de paleta, vectores). La asignación chip a chip no está '
                'documentada.'},
    {'id': 'audio', 'nombre': 'Amplificador de audio', 'pieza': 'JRC (amplificador operacional)', 'esquema': ['U28', 'U29'],
     'bloque': 'ym', 'cajas': [[836, 1008, 952, 1056]], 'confianza': 'posicion', 'buses': ['video_audio_out'],
     'funcion': 'Filtro y amplificador de la salida del YM3016 hacia el conector A/V y los auriculares. '
                'Zona «9HIJK».'},
    {'id': 'reset', 'nombre': 'Botón de reset', 'pieza': 'SW', 'esquema': ['SW1'], 'bloque': 'm68k',
     'cajas': [[112, 555, 288, 792]], 'confianza': 'posicion', 'buses': ['m68k_control'],
     'funcion': 'Pulsador de reset (zona «7C»).'},
    {'id': 'prot', 'nombre': 'Protección de sobretensión', 'pieza': 'Transistor en disipador verde', 'esquema': [],
     'bloque': 'alim', 'cajas': [[190, 890, 250, 1012]], 'confianza': 'posicion', 'buses': ['power'],
     'funcion': 'Circuito que actúa por encima de 5,4 V (zona «9C»). La 3-5 lo sustituye por un regulador '
                'conmutado LM2576 (U37).'},
    {'id': 'din', 'nombre': 'Conector A/V (DIN)', 'pieza': 'DIN de 8 contactos', 'esquema': ['CN3'], 'bloque': 'enc',
     'cajas': [[210, 15, 305, 118]], 'confianza': 'posicion', 'buses': ['video_audio_out'],
     'funcion': 'Salida de vídeo compuesto, RGB, sincronismo y audio (zona «1C»).'},
    {'id': 'power', 'nombre': 'Interruptor de encendido', 'pieza': 'SW', 'esquema': ['SW2'], 'bloque': 'alim',
     'cajas': [[105, 1045, 250, 1150]], 'confianza': 'posicion', 'buses': ['power'],
     'funcion': 'Interruptor deslizante de la alimentación (zona «10B»).'},
]

# First-generation board (photo) -> NEO-AES3-5 schematic (Board-Folk), from INFORME §5.3 and the wiki.
# Abbreviations of the page citations (the documents are NOT bundled; see FUENTES):
#   MV4 h.N   SNK/Alpha Denshi «Multi Video System (MV4)», 19-02-1990, rev. 1.0, sheet N of 13
#             (PDF page N + 1); first-generation chipset (LSPC-A0, PRO-B0, PRO-C0) as on the photographed board.
#   AES h.N   SNK/Alpha Denshi «NEOGEO-2», 04-10-1991 (stamped 03-04-1992), sheet N of 11, PAL; second
#             generation; reference designators U1–U39 equal to those of the Board-Folk recreation.
#   MV4F h.N  SNK «NEO-MVH MV4F», 1992 (stamped 08-03-1993), sheet N of 7: second generation (NEO-B1, NEO-ZMC2).
#   NG Hw-N   SNK «Neo-Geo Hardware Specification» (1989–1991), page «Hardware-N» (PDF page N + 2).
EQUIVALENCIAS = [
    {'foto': 'LSPC-A0', 'esquema': 'LSPC2-A2 (U21)',
     'senales': 'Igual en ambos: A1–A3, D0–D15, LSPOE/LSPWE, 24M (entrada), VRAM lenta B0–B14/E0–E15 con BOE/BWE, '
                'VRAM rápida C0–C10/F0–F15 con CWE, bus P0–P23 con PCK1/PCK2, 8M y 4M (salidas, patillas 109 y 112), '
                'LOAD, H, EVEN, 1H1, 2H1, CA4, SYNC, BNKB, CHBL, IPL0/IPL1, DOTA/DOTB, RESETP.',
     'cambios': 'El LSPC2-A2 añade DIVI/DIVO/REF para el PLL de subportadora (CX23065A), el cambio NTSC/PAL por '
                'hardware y el registro de parada del temporizador ($3C000E). El LSPC-A0 no tiene esas patillas.',
     'fuente': 'MV4 h.4; AES h.4 y h.11; NG Hw-2, Hw-7, Hw-8'},
    {'foto': 'PRO-C0 (decodificación del 68000)', 'esquema': 'NEO-C1 (U4)',
     'senales': 'Entradas A1–A4, A17–A23, /AS, /UDS, /LDS, R/W, 68KCLK. Salidas ROMOEU/L, RAMOEU/L, RAMWEU/L, '
                'PORTADRS, PORTOEU/L, PORTWEU/L, SROMOEU/L, LSPOE, LSPWE, PAL, CARDCS/OE/WE, BITW0/1, IN0–IN2, '
                'SDR/SDW, /DTACK, VPA; esperas ROMWAIT, PWAIT0/1, PDTACK.',
     'cambios': 'Mismas selecciones; el NEO-C1 absorbe además los mandos y el latch del Z80 (antes en el PRO-B0).',
     'fuente': 'MV4 h.1; AES h.1'},
    {'foto': 'PRO-C0 (color y watchdog)', 'esquema': 'NEO-B1 (U13)',
     'senales': 'Píxeles del cartucho GAD0–3/GBD0–3 y de la capa fija FIXD0–7, DOTFIX; control de los buffers de '
                'línea 58WE1–4, 669CK1–4, 669LD1–2, 58BG1–2, 58CHG, 1H1, 6HB; salida PA0–PA3 (número de color). '
                'Watchdog: entrada DOGE con el puente «CUT DOG».',
     'cambios': 'En la 2.ª generación el puente «CUT DOG» (J2) está junto al NEO-B1.',
     'fuente': 'MV4 h.1; AES h.3'},
    {'foto': 'PRO-B0 (número de paleta)', 'esquema': 'NEO-B1 (U13)',
     'senales': 'Bus P0–P23 con PCK1/PCK2 y las mismas señales de control de los buffers de línea; salida PA4–PA11 '
                '(número de paleta).',
     'cambios': 'Las dos mitades del buffer de línea (paleta del PRO-B0 y color del PRO-C0) pasan a un solo chip.',
     'fuente': 'MV4 h.3; AES h.3; MV4F h.2'},
    {'foto': 'PRO-B0 (mandos y Z80)', 'esquema': 'NEO-C1 (U4)',
     'senales': 'Mandos IN00–IN27 hacia D8–D15 con IN0–IN2; latch de sonido: SDR/SDW del lado 68000, '
                'SDZ80R/SDZ80W/SDZ80CLR y SDD0–SDD7 del lado Z80.',
     'cambios': 'Mismo protocolo ($320000 en el 68000; puertos $00 y $0C en el Z80).',
     'fuente': 'MV4 h.3; AES h.1; NG Hw-10'},
    {'foto': 'Reloj discreto: 74LS368 (oscilador), 74LS161, 2 × 74F74, 74AS04', 'esquema': 'NEO-D0 (U22) + 74HC04 (U80)',
     'senales': '24M, 12M, 68KCLK/68KCLKB (12 MHz para el 68000), 6MB (píxel) y 1HB.',
     'cambios': 'El divisor pasa de cinco TTL a una matriz de puertas; 8M y 4M siguen saliendo del LSPC.',
     'fuente': 'MV4 h.2; AES h.5 y h.11'},
    {'foto': 'Lógica del Z80: 74LS139, 74LS32, 74LS11, 74LS08, 74LS74/574', 'esquema': 'NEO-D0 (U22)',
     'senales': 'Puertos $00/$04/$08/$0C (SDZ80R, SDZ80CLR, 2610RD/WR → 2610CS, SDRD0/1, SDZ80W), /CS de la RAM '
                'en $F800–$FFFF (SDA11–SDA15 = 1), lectura de la ROM M1.',
     'cambios': 'Integrado en el NEO-D0 junto con el divisor de reloj.',
     'fuente': 'MV4 h.5; AES h.5; NG Hw-10'},
    {'foto': '2 × 74LS245 (búfer de paleta) y 74LS08 (ROMOE)', 'esquema': 'NEO-G0 (U5)',
     'senales': 'D0–D15 ↔ PC0–PC15 de la RAM de paleta; ROMOE = ROMOEU · ROMOEL.',
     'cambios': 'Un solo chip.', 'fuente': 'MV4 h.1 y h.2; AES h.2'},
    {'foto': '74HC259 (latch del sistema)', 'esquema': '74HC259 (U35)',
     'senales': 'D = A4, S0–S2 = A1–A3, G = BITW1, CLR = RESET; salidas SHADOW, CARDWEN, CARDWENB, REGEN, '
                'SYSTEM, PALBNK. Por eso $3A0001/$3A0011 apagan/encienden la sombra y $3A000F/$3A001F eligen el banco '
                'de paleta.',
     'cambios': 'Igual.', 'fuente': 'MV4 h.9; AES h.9; NG Hw-8, Hw-9'},
    {'foto': '— (no documentado en la 1.ª generación del AES)', 'esquema': "NEO-E0 (U34): A22', A23'",
     'senales': "Conmutación de la tabla de vectores ($000000–$00007F entre BIOS y cartucho).",
     'cambios': "En la MV4 el PRO-C0 ya recibe A22'/A23', generadas fuera de él.",
     'fuente': 'AES h.9; MV4 h.1; NG Hw-8, System Program-1'},
    {'foto': '—', 'esquema': 'CX23065A (U39)',
     'senales': 'PLL que engancha la subportadora (3,579545 MHz NTSC; 4,43361875 MHz PAL) a la temporización del LSPC2.',
     'cambios': 'Solo existe con el LSPC2. En la placa de la foto, la placa auxiliar PL241S podría hacer este papel (sin confirmar).',
     'fuente': 'AES h.11'},
    {'foto': 'TMP68HC000N-12', 'esquema': 'HD68HC000P (U3)', 'senales': '12 MHz.',
     'cambios': 'Otro fabricante (SNK dibuja HD68HC000PS12 en ambos).', 'fuente': 'MV4 h.1; AES h.1; NG Hw-1'},
    {'foto': 'Z0840004PSC', 'esquema': 'Z80 (U24)', 'senales': '4 MHz (4M del LSPC).', 'cambios': '',
     'fuente': 'MV4 h.5; AES h.5; NG Hw-2'},
    {'foto': 'YM2610 (+ YM3016)', 'esquema': 'YM2610 (U27), YM3016 (U26)', 'senales': '8 MHz (8M del LSPC).',
     'cambios': '', 'fuente': 'MV4 h.6; AES h.6'},
    {'foto': 'NEO-EP0 (TC531024P)', 'esquema': '27C1024 (U36)', 'senales': 'BIOS en $C00000–$C1FFFF.',
     'cambios': 'Board-Folk usa una EPROM.', 'fuente': 'AES h.9; NG Hw-8'},
    {'foto': '000-L0 (TC531000CP)', 'esquema': 'TC531000 (U16) + 74LS244 (U15)',
     'senales': 'Dirección desde el bus P; el dato vuelve a P16–P23 por el 74LS244.', 'cambios': '',
     'fuente': 'MV4 h.4; AES h.4'},
    {'foto': 'CXK58257 ×2 (RAM de usuario)', 'esquema': '43256 (U1, U2)', 'senales': '/OE y /WE por byte (RAMOEU/L, RAMWEU/L).',
     'cambios': '', 'fuente': 'MV4 h.1; AES h.1'},
    {'foto': 'CXK58257 ×2 (VRAM lenta)', 'esquema': '43256 (U17, U18)', 'senales': 'B0–B14, E0–E15, BOE, BWE.',
     'cambios': '', 'fuente': 'MV4 h.4; AES h.4'},
    {'foto': 'CXK5814P-35L ×2 (VRAM rápida)', 'esquema': '5814/5863 (U19, U20)', 'senales': 'C0–C10, F0–F15, CWE.',
     'cambios': '', 'fuente': 'MV4 h.4; AES h.4'},
    {'foto': 'BR6116', 'esquema': '6116 (U23)', 'senales': 'RAM del Z80 en $F800–$FFFF.', 'cambios': '',
     'fuente': 'MV4 h.5; AES h.5; NG Hw-10'},
    {'foto': 'RAM de paleta (oculta)', 'esquema': '4364 (U6, U7)', 'senales': 'A0–A11 = PA0–PA11, A12 = PALBNK.',
     'cambios': '', 'fuente': 'MV4 h.2; AES h.2'},
    {'foto': '74LS273 ×2 (latches de paleta)', 'esquema': '74LS273 (U9, U10)',
     'senales': 'Reloj de píxel; CLR = BNKB (negro durante el borrado).', 'cambios': '', 'fuente': 'MV4 h.2; AES h.2'},
    {'foto': 'CRE401 ×4', 'esquema': 'CRE401 (CR1–CR5)', 'senales': 'Entradas de los mandos.', 'cambios': '',
     'fuente': 'MV4 h.3; AES h.3'},
    {'foto': 'Protección de sobretensión (transistor en disipador)', 'esquema': 'LM2576T-5 (U37)',
     'senales': 'Alimentación de 5 V.', 'cambios': 'La NEOGEO-2 de SNK ya usa el regulador conmutado LM2576.',
     'fuente': 'AES h.9'},
    {'foto': 'NJM2066D (auriculares)', 'esquema': 'Q101, Q102 (Board-Folk)',
     'senales': 'Salida de auriculares con control de volumen.',
     'cambios': 'En la hoja de SNK es U25, con «NJM2066D» anotado a mano; Board-Folk lo sustituye por dos transistores.',
     'fuente': 'AES h.6'},
    {'foto': 'Serializador de ROM C: en el cartucho (NEO-ZMC2)', 'esquema': '— (cartucho)',
     'senales': 'CR0–CR31 (32 bits) → GAD0–3/GBD0–3 y DOTA/DOTB con LOAD, 12M, EVEN, H.',
     'cambios': 'La MV4 lleva un serializador en placa, ALPHA-8921, con exactamente esas señales.',
     'fuente': 'MV4 h.13; MV4F h.2'},
]

# ------------------------------------------------------------------ sources and licences

FUENTES = {
    'nes': [
        {'titulo': 'OpenTendo — esquema KiCad de la NES-CPU-11',
         'autor': 'Redherring32 (ingeniería inversa de Krzysiobal; limpieza de =Lockster=)',
         'url': 'https://github.com/Redherring32/OpenTendo',
         'licencia': 'TAPR Open Hardware License 1.0',
         'uso': 'El esquema se dibuja a partir de su .kicad_sch (exportado con kicad-cli 7, sin cambios de '
                'contenido). La NES-CPU-07 de la foto es la -11 sin R17, R18 y R19.'},
        {'titulo': 'NESdev Wiki (patillajes, temporización, PPU, CIC)', 'autor': 'Comunidad NESdev',
         'url': 'https://www.nesdev.org/wiki/', 'licencia': 'Solo consulta',
         'uso': 'Cifras de temporización de la animación (M2 15/24, ALE, 341 × 262 puntos, NMI en la línea 241).'},
        {'titulo': 'Foto de la placa NES-CPU-07', 'autor': 'Evan-Amos (Wikimedia Commons)',
         'url': 'https://commons.wikimedia.org/', 'licencia': 'Dominio público', 'uso': 'Figura 36.16 del libro.'},
    ],
    'neogeo': [
        {'titulo': 'Board-Folk NeoGeoAES-3.5 — recreación KiCad de la NEO-AES3-5',
         'autor': 'Equipo Board Folk (maquetación de Rob Taylor)',
         'url': 'https://github.com/Board-Folk/NeoGeoAES-3.5',
         'licencia': 'Dominio público según su README («solely for the purposes of study and historical preservation»)',
         'uso': 'Esquema de 2.ª generación; la tabla de equivalencias relaciona sus chips con los de la placa fotografiada.'},
        {'titulo': 'NeoGeo Development Wiki (placas, chips, mapas de memoria)', 'autor': 'Comunidad neogeodev',
         'url': 'https://wiki.neogeodev.org/', 'licencia': 'Dominio público salvo indicación',
         'uso': 'Mapa de la placa NEO-AES (zonas «5CD», «7H»…), funciones de PRO-B0/PRO-C0/LSPC, mapas de memoria.'},
        {'titulo': 'SNK, «Neo-Geo Hardware Specification» (versiones de 01-12-1989, 22-08-1990 y 18-06-1991)',
         'autor': 'SNK (documento confidencial escaneado con OCR, 220 páginas)',
         'url': 'https://www.neogeodev.org/NG.pdf', 'licencia': 'Copyright de SNK; solo consulta privada, no se incluye',
         'uso': 'Comprobados con él: mapa del 68000 y registros del LSPC (Hardware-8 a -10), interrupciones de vblank y '
                'temporizador con su reconocimiento en $3C000C (Hardware-5 a -7), píxel de 167 ns, 96 sprites por línea, '
                'capa fija de 40 × 28 tiles de 8 × 8 (Hardware-3, -4, -12), mapa y puertos del Z80 y protocolo de sonido '
                '(Hardware-10).'},
        {'titulo': 'SNK / Alpha Denshi, esquemas «Multi Video System (MV4)» (13 hojas, 19-02-1990, rev. 1.0) y «SLOT4» (11 hojas)',
         'autor': 'Alpha Denshi Co., Ltd. (Eiji Fukatsu) para SNK; escaneo de 2024 aportado por el propietario',
         'url': 'https://drive.google.com/drive/folders/1QpMv94jbslgKyeiTama89Y3W6AnRzMZS',
         'licencia': 'Copyright de SNK; solo consulta privada, no se incluye',
         'uso': 'La placa MVS con el mismo chipset de 1.ª generación que la NEO-AES de la foto (LSPC-A0, PRO-B0, PRO-C0). '
                'De ella salen los patillajes y conexiones de esos tres chips y de la lógica TTL de la tabla de equivalencias '
                '(se cita «MV4 h.N»).'},
        {'titulo': 'SNK / Alpha Denshi, esquemas «NEOGEO-2» de la AES (PAL, 11 hojas, 04-10-1991)',
         'autor': 'Alpha Denshi Co., Ltd. para SNK; escaneos de Wolfsoft y ArcadeTV (wiki de neogeodev)',
         'url': 'https://wiki.neogeodev.org/index.php/MVS_schematics',
         'licencia': 'Copyright de SNK; solo consulta privada, no se incluye',
         'uso': 'AES de 2.ª generación. Sus referencias U1–U39 coinciden con la recreación Board-Folk que se dibuja aquí '
                '(se cita «AES h.N»).'},
        {'titulo': 'SNK, esquemas «NEO-MVH MV4F» (7 hojas, 1992)', 'autor': 'SNK; escaneo aportado por el propietario',
         'url': 'https://drive.google.com/drive/folders/1QpMv94jbslgKyeiTama89Y3W6AnRzMZS',
         'licencia': 'Copyright de SNK; solo consulta privada, no se incluye',
         'uso': 'MVS de 2.ª generación (NEO-B1, NEO-ZMC2), no de la 1.ª. Sirve para comparar el NEO-B1 con el PRO-B0 '
                'y el PRO-C0 (se cita «MV4F h.N»).'},
        {'titulo': 'neogeodev/SVGPinout', 'autor': 'Comunidad neogeodev', 'url': 'https://github.com/neogeodev/SVGPinout',
         'licencia': 'Sin licencia: referencia privada, no se incluye en la aplicación', 'uso': 'Consulta de patillajes.'},
        {'titulo': 'Foto de la placa NEO-AES', 'autor': 'Evan-Amos (Wikimedia Commons)',
         'url': 'https://commons.wikimedia.org/', 'licencia': 'Dominio público', 'uso': 'Figura 36.22 del libro.'},
    ],
}


# ------------------------------------------------------------------ Neo Geo: check against SNK documents
# Second pass (23-10-2026) with the MV4 and NEOGEO-2 schematics and the SNK hardware specification (citation
# abbreviations above EQUIVALENCIAS). Each entry overrides fields of NEOGEO_HOTSPOTS; `verificacion` says what
# was checked and where. Markings were read again on the full-resolution photo (v3/img/foto_neogeo.jpg).

REVISION_NEOGEO = {
    '68k': {'verificacion': 'Conexiones: MV4 h.1 (HD68HC000PS12, CLK = 68KCLK, IPL0/IPL1 del LSPC). 12 MHz: NG Hw-1.'},
    'z80': {'verificacion': 'MV4 h.5 (Z80A, CLK = 4M del LSPC-A0, /INT = IRQ del YM2610). 4 MHz: NG Hw-2. '
                            'Puertos y NMI: NG Hw-10.'},
    'ym2610': {'verificacion': 'MV4 h.6 (CLK = 8M, /IRQ → Z80INT). Temporizador → IRQ del Z80: NG Hw-10.'},
    'lspc': {
        'funcion': 'Controlador de sprites y de vídeo de 1.ª generación. Recorre las dos VRAM (lenta: B0–B14/E0–E15; '
                   'rápida: C0–C10/F0–F15), elige los sprites de cada línea (hasta 96) y saca por el bus P0–P23 las '
                   'direcciones de las ROM C, S y L0, marcadas con PCK1 y PCK2. Además controla el serializador del '
                   'cartucho (LOAD, H, EVEN, CA4, 1H1, 2H1), genera los relojes de 8 MHz (patilla 109, YM2610) y '
                   '4 MHz (patilla 112, Z80), el sincronismo y el borrado (SYNC, BNKB, CHBL) y las interrupciones del '
                   '68000 (IPL0, IPL1). En el esquema de la 3-5 es el LSPC2-A2 (U21), que añade el PLL de subportadora '
                   'y el modo NTSC/PAL por hardware.',
        'verificacion': 'Patillaje: MV4 h.4. Diferencias con el LSPC2: AES h.4 y h.11; NG Hw-2 y Hw-7.'},
    'prob0': {
        'funcion': 'Chip a medida de 1.ª generación con tres funciones:\n'
                   '- Toma del bus P el número de paleta (P0–P23, con PCK1) y da la mitad alta de la dirección de paleta, '
                   'PA4–PA11.\n'
                   '- Lee los 28 bits de los mandos (IN00–IN27) y los pone en D8–D15 cuando el PRO-C0 activa IN0–IN2.\n'
                   '- Contiene el latch de sonido entre las dos CPU: SDR/SDW del lado del 68000; SDZ80R, SDZ80W, '
                   'SDZ80CLR y SDD0–7 del lado del Z80.\n'
                   'En la 2.ª generación la paleta pasa al NEO-B1 (U13) y los mandos y el latch al NEO-C1 (U4).',
        'verificacion': 'Patillaje completo: MV4 h.3. 2.ª generación: AES h.1 (NEO-C1) y h.3 (NEO-B1).'},
    'proc0': {
        'funcion': 'Chip a medida de 1.ª generación con dos funciones:\n'
                   '- Decodifica las direcciones del 68000 (A1–A4, A17–A23, /AS, /UDS, /LDS, R/W) y genera:\n'
                   '  - las selecciones (ROMOEU/L, RAMOEU/L, RAMWEU/L, PORTADRS, SROMOEU/L, LSPOE/LSPWE, PAL, CARDCS, '
                   'IN0–IN2, SDR/SDW);\n'
                   '  - /DTACK, VPA (interrupciones autovectorizadas) y las esperas (ROMWAIT, PWAIT0/1);\n'
                   '  - el watchdog (DOGE, con el puente «CUT DOG»).\n'
                   '- Lleva la parte de color de los buffers de línea: recibe los píxeles del cartucho (GAD/GBD) y de la '
                   'capa fija (FIXD0–7) y da PA0–PA3.\n'
                   'En la 2.ª generación la decodificación pasa al NEO-C1 (U4) y el color y el watchdog al NEO-B1 (U13).',
        'verificacion': 'Patillaje: MV4 h.1. 2.ª generación: AES h.1 (NEO-C1) y h.3 (NEO-B1, puente J2 «CUT DOG»).'},
    'bios': {'verificacion': 'Dirección $C00000–$C1FFFF y conmutación de vectores: NG Hw-8 y System Program-1. '
                             'Chip: AES h.9 (TC531024P-15).'},
    'l0': {'verificacion': 'MV4 h.4: TC531000AP direccionada por el bus P; su dato vuelve a P16–P23 por un 74LS244.'},
    'ls244': {'confianza': 'marca', 'pieza': '74LS244 (serigrafía «LS244» legible)',
              'verificacion': 'MV4 h.4 (10N) y AES h.4 (U15): devuelve al bus P (P16–P23) el dato de la ROM L0.'},
    'z80ram': {'verificacion': 'MV4 h.5: 6116 seleccionada cuando SDA11–SDA15 = 1 ($F800–$FFFF). NG Hw-10.'},
    'wram': {'confianza': 'marca', 'pieza': 'Sony CXK58257M-12L (serigrafía «43256»)',
             'funcion': '64 KB de RAM de trabajo en $100000–$10FFFF, en dos chips de 32K × 8 (byte alto y byte bajo) con '
                        '/OE y /WE separados por byte (RAMOEU/L, RAMWEU/L). Solo se decodifica hasta A15, así que el '
                        'resto de la zona son espejos.',
             'verificacion': 'MV4 h.1 (dos µPD43256). Dirección: NG Hw-8. Marca leída en la foto.'},
    'svram': {'confianza': 'marca', 'pieza': 'Sony CXK58257M-12L ×2',
              'verificacion': 'MV4 h.4: dos 43256 en B0–B14/E0–E15 con BOE/BWE del LSPC. 64 KB + 4 KB de VRAM: NG Hw-1.'},
    'fvram': {'verificacion': 'MV4 h.4: CXK5814P-35 ×2 en C0–C10/F0–F15, /WE = CWE.'},
    'palram': {'pieza': '8K × 8 ×2 (µPD4364 en los esquemas de SNK); oculta en la foto',
               'verificacion': 'MV4 h.2:\n'
                               '- A0–A11 = PA0–PA11 y A12 = PALBNK;\n'
                               '- /WE se genera a partir de PAL y R/W;\n'
                               '- el dato llega al 68000 por dos 74LS245.\n'
                               'Paleta en $400000–$401FFF, con 2 bancos y acceso por palabras (NG Hw-8 y Hw-19).'},
    'latch': {'confianza': 'marca', 'pieza': '74LS273 (serigrafía «LS273» legible)',
              'funcion': 'Capturan los 16 bits del color con el reloj de píxel para que el DAC vea un valor estable durante '
                         'todo el píxel. Su /CLR es BNKB: durante el borrado la salida es negro. Zona «3EF».',
              'verificacion': 'MV4 h.2 (4E, 5E). Igual en AES h.2 (U9, U10).'},
    'dac': {'confianza': 'marca',
            'verificacion': 'MV4 h.2: por cada color, 3,9 kΩ, 2,2 kΩ, 1 kΩ, 470 Ω y 220 Ω, más 8,2 kΩ por un 74LS05 (bit '
                            'oscuro) y 150 Ω de salida. Los valores coinciden con la serigrafía de la foto.'},
    'enc': {'confianza': 'marca', 'pieza': 'Cristal «…79545» (3,579545 MHz, legible); el CXA1145 queda tapado',
            'verificacion': 'AES h.7 (CXA1145P) y h.11 (X2: 3,579545 MHz en NTSC, 4,43361875 MHz en PAL).'},
    'reloj': {
        'pieza': 'Serigrafía X1; el cristal queda bajo los cables',
        'esquema': ['X1', 'U80', 'U22'],
        'funcion': 'Cristal de 24 MHz con su oscilador. En la 1.ª generación el divisor es lógica TTL: un 74LS161 y dos '
                   '74F74 dan 68KCLK (12 MHz, el 68000), 6MB (píxel, 6 MHz) y 1HB. Los 8 y 4 MHz del YM2610 y del Z80 '
                   'salen del LSPC-A0. En la 2.ª generación el divisor es el NEO-D0 (U22). Zona «1F».',
        'verificacion': 'MV4 h.2 (oscilador 74LS368, 74LS161 5B, 74F74 4CA/4CB) y h.4 (8M y 4M del LSPC). 2.ª generación: '
                        'AES h.5 y h.11.'},
    'cart': {'verificacion': 'AES h.8: CN4/CN5 (AXC90020). La ROM C se serializa en el cartucho: señales en MV4 h.13.'},
    'cre401': {'verificacion': 'MV4 h.3 y AES h.3 (CRE401 + ferritas ZBF253D).'},
    'pl241s': {
        'funcion': 'Placa añadida en fábrica, con contadores 74LS161, un cristal y un ajuste. Tapa la zona «8OPQR». Es '
                   'probable que sea la placa de limpieza de vídeo (PLL de subportadora), pero sigue sin confirmar:\n'
                   '- lo dice el wiki de neogeodev para las NEO-AES tardías;\n'
                   '- el LSPC-A0 no tiene las patillas DIVI/DIVO/REF con las que el LSPC2 engancha la subportadora '
                   '(MV4 h.4 frente a AES h.11), así que ese PLL tendría que ir fuera.',
        'verificacion': 'Sin esquema. MV4 h.4 y AES h.11 solo apoyan la hipótesis.'},
    'ttl': {
        'nombre': 'Lógica del Z80 (74LS)', 'confianza': 'marca', 'esquema': ['U22'],
        'pieza': 'HD74LS32P, HD74LS139P, HD74LS74AP y otro HD74LS (marcas parcialmente legibles)',
        'funcion': 'Está junto a la RAM del Z80 (serigrafía «6116»). Hace lo mismo que en la MV4:\n'
                   '- el 74LS139 decodifica los puertos $00, $04, $08 y $0C (SDZ80R, 2610RD/WR, SDRD0/1, SDZ80CLR, '
                   'SDZ80W);\n'
                   '- el 74LS32 combina /MREQ, /IORQ, /RD y /WR;\n'
                   '- un 74LS11 selecciona la RAM en $F800;\n'
                   '- los 74LS74/574 son registros.\n'
                   'En la 2.ª generación todo eso está en el NEO-D0 (U22).',
        'verificacion': 'MV4 h.5. NEO-D0: AES h.5. Puertos: NG Hw-10.'},
    'audio': {
        'nombre': 'Amplificador de auriculares', 'confianza': 'marca', 'pieza': 'JRC NJM2066D', 'esquema': ['Q101'],
        'funcion': 'Amplificador estéreo para los auriculares, tras el control de volumen. En la hoja de SNK de la AES es '
                   'U25, con «NJM2066D» anotado a mano; la recreación Board-Folk lo sustituye por dos transistores '
                   '(Q101, Q102). Zona «9HIJK».',
        'verificacion': 'AES h.6. Marca leída en la foto.'},
    'din': {'verificacion': 'AES h.7: CN3, DIN-8 (vídeo compuesto, RGB, sincronismo, audio).'},
    'card': {'verificacion': 'Dirección $800000–$BFFFFF, 8 bits (NG Hw-10). Conector: AES h.10.'},
    'prot': {'verificacion': 'Sin esquema de esta etapa. La NEOGEO-2 ya usa el regulador LM2576 (AES h.9).'},
}

for _h in NEOGEO_HOTSPOTS:
    _h.update(REVISION_NEOGEO.get(_h['id'], {}))
