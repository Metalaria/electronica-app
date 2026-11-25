"""«Consolas» 2.0: Nintendo 64 (OpeN64, a 1:1 KiCad recreation of the NUS-CPU-03) and PlayStation (pu-18, a KiCad
recreation of the PU-18) — their MAQUINAS entries, bus groups, photo hotspots, sources and extra fields, read by
contenido/consolas.py through MODULOS (dicts keyed by machine id: GRUPOS, FUENTES, EXTRA).

Research folder (CONSOLAS_FUENTES, default /home/claude/consolas), per machine (n64, ps1):
  original/   the project as published (KiCad 10) with its LICENSE and README
  kicad7/     the schematic converted with tools/kicad10to7.py (syntax only)
  netlist/    kicad-cli's XML netlist, its JSON (tools/netxml2json.py) and the bus groups (tools/grupos_n64ps1.py)
  svg/        kicad-cli's SVG of the schematic
  fotos/      the photos (n64: OpeN64's own photo of a retail NUS-CPU-04; ps1: see FUENTES)
To regenerate (from /home/claude/consolas):
  python3 tools/kicad10to7.py n64/original/OpeN64.kicad_sch n64/kicad7/OpeN64.kicad_sch
  (cd n64/kicad7 && kicad-cli sch export netlist --format kicadxml -o ../netlist/OpeN64.xml OpeN64.kicad_sch
                 && kicad-cli sch export svg -o ../svg OpeN64.kicad_sch)
  python3 tools/netxml2json.py n64/netlist/OpeN64.xml n64/netlist/OpeN64.nets.json
  python3 tools/grupos_n64ps1.py n64
  (the same for ps1 with pu-18), then python3 contenido/consolas.py n64 ps1 and python3 contenido/consolas_pcb.py n64 ps1.
"""

GRUPOS = {
    'n64': {
        'sysad': 'SysAD: bus del VR4300 al RCP (SysAD0–31, SysCmd0–4, EVALID, PVALID, EOK, INT0)',
        'rdram': 'Rambus: RDRAM (BUSD0–8, BUSCTRL, BUSENABLE, RXCLK, TXCLK, VREF, VTERM)',
        'cart': 'Bus del cartucho (CAD0–15, ALEH, ALEL, /RD, /WR, INT1)',
        'cic': 'CIC del cartucho (SECCLK, SEC1, SEC2)',
        'pif': 'PIF y reset (PCHCLK, PCHCMD, PCHRSP, CLDRES, NMI, INT2, RSWIN)',
        'controllers': 'Mandos (JOY0–3 y sus búferes)',
        'clocks': 'Relojes (MX8330, MASTER_CLOCK, VCLK, FSC)',
        'video': 'Vídeo (SRGB0–6, TSYNC, VDC-NUS, ENC-NUS, Y/C y compuesto)',
        'audio': 'Audio (AUDCLK, AUDDAT, AUDLRCLK, DAC, amplificador)',
        'power': 'Alimentación (3,3 V, 5 V, 12 V)',
    },
    'ps1': {
        'main_ram': 'RAM principal (CPMA0–9, CPMD0–31, /RAS, /CAS0–3, /W)',
        'sbus': 'Bus de sistema (SA0–23, SD0–15, /RD, /WR, /CS)',
        'gpu_bus': 'Bus de la GPU (GPUD0–31, /GPUCS, DACK2, HBLANK, VBLANK)',
        'vram': 'VRAM (FD0–31, LA0–9, SGRAM)',
        'video': 'Vídeo (RGB digital al DAC, codificador CXA1645, A/V)',
        'spu': 'SPU y su RAM (MA1–9, MD0–15)',
        'audio': 'Audio (serie de la SPU al DAC AK4309, audio del CD)',
        'cd_decoder': 'Descodificador del CD (CXD1815Q, su SRAM, el 68HC05)',
        'cd_servo': 'Servo del CD (CXD2545Q, CXA1791N, BA6392FP, láser y motores)',
        'controllers': 'Mandos y tarjetas de memoria (SIO0)',
        'ports': 'Puerto paralelo (PIO) y puerto serie (SIO1)',
        'clocks': 'Relojes (67,7376 MHz, 53,69 MHz, 33,8688 MHz)',
        'reset': 'Reset',
        'power': 'Alimentación (3,5 V, 3,3 V, 5 V, 8 V)',
    },
}

# ------------------------------------------------------------------ photo hotspots
# N64: iFixit's photo of a NUS-CPU-04 is placed from OpeN64's PCB (alignment file, consolas_snes.cajas_de_huellas):
# hotspots carry no pixel boxes, the footprints of `esquema` (or `huellas`) give them. PS1: the iFixit photo of a
# real PU-18 (shields on) has boxes measured on the photo (1600 × 1200 px); the pu-18 recreation's photo is placed
# from its PCB like the N64's. 'confianza': 'marca' when the chip's marking or the silkscreen reference is legible.

N64_CPU04 = [
    {'id': 'cpu', 'nombre': 'CPU VR4300 (CPU-NUS)', 'pieza': 'NEC VR4300 · QFP de 120 patas (U10)', 'esquema': ['U10'], 'bloque': 'cpu',
     'confianza': 'marca', 'buses': ['sysad', 'clocks'],
     'funcion': 'La CPU MIPS de 64 bits a 93,75 MHz: multiplica por 1,5 el reloj maestro de 62,5 MHz que le da el RCP. No toca la '
                'memoria: todo lo pide al RCP por el bus SysAD de 32 bits (direcciones y datos por los mismos hilos).'},
    {'id': 'rcp', 'nombre': 'RCP (RCP-NUS)', 'pieza': 'Reality Co-Processor · QFP de 160 patas (U9)', 'esquema': ['U9'], 'bloque': 'rcp',
     'confianza': 'marca', 'buses': ['sysad', 'rdram', 'cart', 'pif', 'video', 'audio', 'clocks'],
     'funcion': 'El corazón de la placa, a 62,5 MHz: el RSP (geometría y sonido por microcódigo) y el RDP (rasterizado), y todas las '
                'interfaces: memoria RDRAM (RI), vídeo (VI), audio (AI), cartucho (PI) y PIF (SI). La CPU solo habla con él.'},
    {'id': 'rdram', 'nombre': 'RDRAM (2 × RDRAM18-NUS)', 'pieza': 'Dos chips Rambus de 18 Mbit (U14 arriba, U11 abajo)', 'esquema': ['U14', 'U11'],
     'bloque': 'rdram', 'confianza': 'marca', 'buses': ['rdram'],
     'funcion': 'La memoria de toda la consola: 4 MB útiles (4,5 MB con el noveno bit) en un bus Rambus de 9 bits a 250 MHz, que '
                'mueve datos en los dos flancos (hasta 500 MB/s). El bus sigue hasta la ranura de expansión (P1).'},
    {'id': 'pif', 'nombre': 'PIF (PIF-NUS)', 'pieza': 'PIF-NUS · SOP de 28 patas (U6)', 'esquema': ['U6'], 'bloque': 'pif', 'confianza': 'marca',
     'buses': ['pif', 'cic', 'controllers'],
     'funcion': 'Guarda el arranque (IPL1, en $1FC00000), comprueba el CIC del cartucho y mantiene la consola en reset si no contesta, '
                'y habla con los cuatro mandos. El RCP le llega por tres hilos serie (PCHCLK, PCHCMD, PCHRSP).'},
    {'id': 'vdc', 'nombre': 'DAC de vídeo (VDC-NUS)', 'pieza': 'VDC-NUS A, BU9801F · SOP de 24 patas (U4)', 'esquema': ['U4'], 'bloque': 'vdc',
     'confianza': 'marca', 'buses': ['video'],
     'funcion': 'Recibe el color del RCP por un bus multiplexado de 7 bits (SRGB0–SRGB6), 21 bits por punto, y saca el RGB analógico '
                'y el sincronismo compuesto hacia el codificador.'},
    {'id': 'enc', 'nombre': 'Codificador de vídeo (ENC-NUS)', 'pieza': 'ENC-NUS · SOP de 14 patas (U5)', 'esquema': ['U5'], 'bloque': 'enc',
     'confianza': 'marca', 'buses': ['video'],
     'funcion': 'Convierte el RGB del VDC-NUS en luminancia (Y), crominancia (C) y vídeo compuesto, con la subportadora del generador de '
                'reloj. Su patilla NT/PAL va a +5 V en esta placa NTSC.'},
    {'id': 'dac', 'nombre': 'DAC de audio (BU9480F)', 'pieza': 'BU9480F · SOP de 8 patas (U1)', 'esquema': ['U1'], 'bloque': 'audio',
     'confianza': 'marca', 'buses': ['audio'],
     'funcion': 'Recibe las muestras estéreo del RCP en serie (AUDCLK, AUDDAT, AUDLRCLK) y las convierte en las tensiones de los canales '
                'izquierdo y derecho.'},
    {'id': 'amp', 'nombre': 'Amplificador de audio (AMP-NUS)', 'pieza': 'AMP-NUS · SIP/SOP de 14 patas (U2)', 'esquema': ['U2'], 'bloque': 'audio',
     'confianza': 'marca', 'buses': ['audio', 'power'],
     'funcion': 'Filtra y amplifica los dos canales del DAC hacia el Multi Out. Es lo único que se alimenta de los 12 V.'},
    {'id': 'clk', 'nombre': 'Generadores de reloj (MX8330)', 'pieza': 'Dos MX8330 · SOP de 8 patas (U7, U15) y sus cristales (X1, X2)',
     'esquema': ['U7', 'U15', 'x1', 'x2'], 'bloque': 'clk', 'confianza': 'marca', 'buses': ['clocks'],
     'funcion': 'U7, con el cristal X1, da el reloj de vídeo al RCP y al VDC-NUS (FSO/5) y la subportadora al ENC-NUS (FSC). U15, con X2, '
                'da el reloj del bus Rambus, que entra por el final del canal (CLKTOEND, en la ranura de expansión). La patilla FSEL elige '
                'la frecuencia.'},
    {'id': 'reset', 'nombre': 'Reset (PST9128 y pulsador)', 'pieza': 'PST9128 (U3) y el pulsador RESET (SW2)', 'esquema': ['U3', 'SW2'],
     'bloque': 'pif', 'confianza': 'marca', 'buses': ['pif'],
     'funcion': 'El PST9128 vigila los 3,3 V y avisa al PIF (RESIC) al encender y apagar; el pulsador de reset también entra en el PIF, '
                'que es quien reinicia a la CPU.'},
    {'id': 'vterm', 'nombre': 'Regulador de Vterm (PQ7VZ5)', 'pieza': 'PQ7VZ5 (U12) y sus resistencias de ajuste (R25–R27)', 'esquema': ['U12'],
     'huellas': ['U12', 'R25', 'R26', 'R27'], 'bloque': 'rdram', 'confianza': 'marca', 'buses': ['rdram', 'power'],
     'funcion': 'Da la tensión de terminación del bus Rambus (Vterm); la serigrafía marca también el punto de Vref. Sin ellas la RDRAM '
                'no funciona.'},
    {'id': 'reg5', 'nombre': 'Regulador de 5 V (78M05)', 'pieza': '78M05 en TO-252 (U13)', 'esquema': ['U13'], 'bloque': 'alim',
     'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Saca de los 12 V los 5 V del codificador de vídeo (ENC-NUS) y del Multi Out. Todo lo demás va a 3,3 V.'},
    {'id': 'cart', 'nombre': 'Ranura del cartucho', 'pieza': 'Conector de 50 contactos (P6 en OpeN64; serigrafía «P5»)', 'esquema': ['P6'],
     'bloque': 'cart', 'confianza': 'marca', 'buses': ['cart', 'cic', 'power'],
     'funcion': 'El bus del cartucho (PI): 16 bits de direcciones y datos multiplexados (CAD0–CAD15) con ALEH y ALEL, /RD y /WR; '
                'además el CIC (SECCLK, SEC1, SEC2), la NMI y el reset, el audio del cartucho y 3,3 V y 12 V.'},
    {'id': 'exp', 'nombre': 'Ranura de expansión (Jumper Pak)', 'pieza': 'Conector de la memoria de expansión (P1)', 'esquema': ['P1'],
     'bloque': 'rdram', 'confianza': 'marca', 'buses': ['rdram'],
     'funcion': 'El bus Rambus sigue hasta aquí: el Jumper Pak lo termina y el Expansion Pak añade otros 4,5 MB. Sin ninguno de los dos, '
                'la consola no arranca.'},
    {'id': 'mandos', 'nombre': 'Mandos', 'pieza': 'Puertos P2 y P3 (dos mandos cada uno) y el búfer 74LV125A (U8)', 'esquema': ['P2', 'P3', 'U8'],
     'bloque': 'pif', 'confianza': 'marca', 'buses': ['controllers'],
     'funcion': 'Cada mando es un solo hilo de datos bidireccional. El PIF lee cada línea (JOYI0–3) y la tira a masa por el 74LV125A '
                '(JOY00–03 en sus OE); cada bit dura 4 µs.'},
    {'id': 'alim', 'nombre': 'Alimentación e interruptor', 'pieza': 'Conector de la fuente (P4) e interruptor POWER (SW1)', 'esquema': ['P4', 'SW1'],
     'bloque': 'alim', 'confianza': 'marca', 'buses': ['power'],
     'funcion': 'La fuente da 3,3 V y 12 V; el interruptor corta las dos antes de que lleguen a la placa.'},
    {'id': 'av', 'nombre': 'Multi Out (A/V)', 'pieza': 'Conector de vídeo y audio (P7)', 'esquema': ['P7'], 'bloque': 'enc', 'confianza': 'marca',
     'buses': ['video', 'audio'],
     'funcion': 'Vídeo compuesto, S-vídeo (Y y C), sincronismo, audio estéreo y 5 V. No lleva RGB.'},
    {'id': 'led', 'nombre': 'Piloto de encendido', 'pieza': 'LED (D3)', 'esquema': ['D3'], 'bloque': 'alim', 'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Un LED rojo con su resistencia (R31) a 3,3 V: se enciende cuando llegan los 3,3 V del interruptor.'},
]

# PS1, main photos: Antoinebercovici's high-resolution scans of a SCPH-5502 board (PU-18 on its silkscreen), both
# faces, placed from pu-18's PCB (affine fits to 16 and 6 chips)
PS1_TOP = [
    {'id': 'cpu', 'nombre': 'CPU (CXD8606AQ)', 'pieza': 'Sony CXD8606AQ · QFP de 208 patas (IC103)', 'esquema': ['IC103'], 'bloque': 'cpu',
     'confianza': 'marca', 'buses': ['main_ram', 'sbus', 'gpu_bus', 'controllers', 'ports'],
     'funcion': 'Un núcleo compatible con el MIPS R3000A a 33,8688 MHz, con el coprocesador de geometría (GTE), la DMA, el controlador '
                'de la RAM y los puertos serie de los mandos. Saca el bus de la RAM, el bus de la GPU y el bus de sistema, y una selección '
                'por chip: ~CS2 para la BIOS, ~CS4 para la SPU, ~CS5 para el CD y ~CS7 para la GPU.'},
    {'id': 'ram', 'nombre': 'RAM principal (2 MB)', 'pieza': 'Cuatro KM48V514BJ (IC106–IC109), 512 KB cada una',
     'esquema': ['IC106', 'IC107', 'IC108', 'IC109'], 'bloque': 'ram', 'confianza': 'marca', 'buses': ['main_ram'],
     'funcion': '2 MB de DRAM EDO en cuatro chips de 8 bits: juntos dan el bus de 32 bits de la CPU, con direcciones multiplexadas '
                '(/RAS, /CAS0–/CAS3).'},
    {'id': 'bios', 'nombre': 'BIOS (512 KB)', 'pieza': 'ROM M534031E-04 · SOP de 32 patas (IC102)', 'esquema': ['IC102'], 'bloque': 'bios',
     'confianza': 'marca', 'buses': ['sbus'],
     'funcion': 'El programa de arranque y el núcleo del sistema, en el bus de sistema con 8 bits de datos. La CPU empieza en $BFC00000.'},
    {'id': 'gpu', 'nombre': 'GPU (CXD8561BQ)', 'pieza': 'Sony CXD8561BQ · QFP de 208 patas (IC203)', 'esquema': ['IC203'], 'bloque': 'gpu',
     'confianza': 'marca', 'buses': ['gpu_bus', 'vram', 'video'],
     'funcion': 'Dibuja triángulos, rectángulos y líneas en la VRAM a partir de las órdenes que le llegan por GP0, casi siempre por DMA, '
                'y saca la imagen en RGB digital hacia el DAC. Su reloj es el cristal X201.'},
    {'id': 'vram', 'nombre': 'VRAM (1 MB)', 'pieza': 'SGRAM · QFP de 100 patas (IC201)', 'esquema': ['IC201'], 'bloque': 'vram',
     'confianza': 'marca', 'buses': ['vram'],
     'funcion': 'El cuadro que se ve, el que se dibuja y las texturas, en 1 MB con un bus de 32 bits solo para la GPU.'},
    {'id': 'rgb', 'nombre': 'DAC de vídeo (MC141685)', 'pieza': 'MC141685FT · QFP de 44 patas (IC202)', 'esquema': ['IC202'], 'bloque': 'dacrgb',
     'confianza': 'marca', 'buses': ['video'],
     'funcion': 'Convierte los tres colores digitales de la GPU (SR0–7, SG0–7, SB0–7) en RGB analógico.'},
    {'id': 'xgpu', 'nombre': 'Cristal de vídeo', 'pieza': 'Cristal X201 (marcado «JC53.20»)', 'esquema': ['X201'], 'bloque': 'clk', 'confianza': 'marca',
     'buses': ['clocks'],
     'funcion': 'El reloj de la GPU y del vídeo. En esta placa PAL se lee «53.20» (el vídeo PAL va a 53,203425 MHz); la recreación pu-18 '
                'lleva el de 53,69 MHz de las NTSC.'},
    {'id': 'spu', 'nombre': 'SPU (CXD2925Q)', 'pieza': 'Sony CXD2925Q · QFP de 100 patas (IC308)', 'esquema': ['IC308'], 'bloque': 'spu',
     'confianza': 'marca', 'buses': ['spu', 'sbus', 'audio'],
     'funcion': '24 voces ADPCM de 16 bits a 44,1 kHz, con envolventes y reverberación; mezcla también el audio del CD. Saca las muestras en '
                'serie hacia el DAC.'},
    {'id': 'spuram', 'nombre': 'RAM del sonido (512 KB)', 'pieza': 'DRAM en SOJ de 40 patas (IC310)', 'esquema': ['IC310'], 'bloque': 'spuram',
     'confianza': 'marca', 'buses': ['spu'],
     'funcion': 'Las muestras, la reverberación y los búferes de la SPU, en una DRAM de 16 bits solo suya.'},
    {'id': 'dac', 'nombre': 'DAC de audio (AK4309A)', 'pieza': 'AK4309A · SSOP de 24 patas (IC402)', 'esquema': ['IC402'], 'bloque': 'dacaudio',
     'confianza': 'marca', 'buses': ['audio'],
     'funcion': 'Convierte la serie de la SPU (BICK, LRCK, SDATA) en el audio estéreo analógico. Va a 5 V, los del 78M05.'},
    {'id': 'cdc', 'nombre': 'Controlador del CD (CXD1815Q)', 'pieza': 'Sony CXD1815Q · QFP de 100 patas (IC305)', 'esquema': ['IC305'],
     'bloque': 'cdc', 'confianza': 'marca', 'buses': ['cd_decoder', 'sbus', 'audio'],
     'funcion': 'Recibe los datos del disco del DSP, corrige los errores por sectores con su SRAM, contesta a la CPU por el bus de sistema '
                'y pasa el audio del CD a la SPU.'},
    {'id': 'sram', 'nombre': 'SRAM del CD (32 KB)', 'pieza': 'SRAM en TSOP de 28 patas (IC303)', 'esquema': ['IC303'], 'bloque': 'cdc',
     'confianza': 'marca', 'buses': ['cd_decoder'], 'funcion': 'El búfer de sectores del controlador del CD.'},
    {'id': 'dsp', 'nombre': 'DSP del CD (CXD2545Q)', 'pieza': 'Sony CXD2545Q · QFP de 100 patas (IC701)', 'esquema': ['IC701'], 'bloque': 'servo',
     'confianza': 'marca', 'buses': ['cd_servo', 'cd_decoder'],
     'funcion': 'Demodula la señal del disco y lleva los servos de foco, seguimiento, carro y giro (en la PU-18, en el mismo chip). Saca los '
                'datos en serie hacia el controlador.'},
    {'id': 'rf', 'nombre': 'Amplificador de RF y ajuste', 'pieza': 'CXA1791N (IC703), NJM2100 (IC708) y el potenciómetro RV703',
     'esquema': ['IC703', 'IC708', 'RV703'], 'bloque': 'servo', 'confianza': 'marca', 'buses': ['cd_servo'],
     'funcion': 'Amplifica los fotodiodos de la cabeza y saca la RF y los errores de foco y de seguimiento hacia el DSP. RV703 es el único '
                'potenciómetro de la placa: el ajuste del servo que no es automático.'},
    {'id': 'alim', 'nombre': 'Entrada de la fuente', 'pieza': 'Conector de 5 contactos (CN602)', 'esquema': ['CN602'], 'bloque': 'alim',
     'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Llegan los 3,3 V y los 8 V de la fuente (redes PWR_3.3v y PWR_8v del esquema); de aquí pasan por fusibles SMD (PS601–PS603 '
                'en los 8 V, PS604 y PS605 en los 3,3 V) hacia cada parte de la placa.'},
    {'id': 'f605', 'nombre': 'Fusible de los 3,3 V de los mandos', 'pieza': 'PS605 (serigrafía CCP2E15)', 'esquema': ['PS605'],
     'bloque': 'alim', 'confianza': 'marca', 'buses': ['power', 'controllers'],
     'funcion': 'Protege los 3,3 V que llegan a los mandos y a las tarjetas de memoria por CN102. La serigrafía de al lado da su tipo, CCP2E15.'},
    {'id': 'f602', 'nombre': 'Fusible de los 8 V de los mandos', 'pieza': 'PS602 (serigrafía CCP2E20)', 'esquema': ['PS602'],
     'bloque': 'alim', 'confianza': 'marca', 'buses': ['power', 'controllers'],
     'funcion': 'Protege los 8 V que llegan a los mandos por CN102 (y al puerto paralelo). La serigrafía de al lado da su tipo, CCP2E20.'},
    {'id': 'reg', 'nombre': 'Regulador de 5 V (78M05)', 'pieza': 'TA78M05F en TO-252 (IC601), con C601 de 47 µF en los 8 V',
     'esquema': ['IC601', 'C601'], 'bloque': 'alim', 'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Saca de los 8 V los 5 V del audio (AUD_5V): el DAC de audio y su entorno.'},
    {'id': 'mandos', 'nombre': 'Cable de los mandos y tarjetas', 'pieza': 'Conector de 10 contactos (CN102)', 'esquema': ['CN102'],
     'bloque': 'mandos', 'confianza': 'marca', 'buses': ['controllers'],
     'funcion': 'Lleva a la placa de los puertos frontales el bus serie de los mandos y las tarjetas de memoria (datos en los dos sentidos, '
                'reloj, una selección por puerto y /ACK) y sus 3,3 V y 8 V.'},
    {'id': 'cd', 'nombre': 'Conectores del lector de CD', 'pieza': 'Motores (CN701, 4 contactos) y cabeza óptica (CN702, 16 contactos)',
     'esquema': ['CN701', 'CN702'], 'bloque': 'lector', 'confianza': 'marca', 'buses': ['cd_servo'],
     'funcion': 'Por CN701 van los motores del disco y del carro; por CN702, el láser, los fotodiodos y las bobinas de foco y de '
                'seguimiento de la cabeza.'},
    {'id': 'tapa', 'nombre': 'Interruptor de la tapa', 'pieza': 'Conector del interruptor de la tapa del CD (S301, serigrafía «DOOR»)',
     'esquema': ['S301'], 'bloque': 'mech', 'confianza': 'marca', 'buses': ['cd_decoder'],
     'funcion': 'Avisa al microcontrolador del CD (el 68HC05, en la otra cara) de que la tapa está abierta.'},
    {'id': 'av', 'nombre': 'Multi Out (A/V)', 'pieza': 'Conector AV MULTI OUT (CN502) y sus condensadores', 'esquema': ['CN502'],
     'bloque': 'enc', 'confianza': 'marca', 'buses': ['video', 'audio'], 'funcion': 'Vídeo compuesto, S-vídeo, RGB y audio estéreo.'},
    {'id': 'serie', 'nombre': 'Puerto serie', 'pieza': 'Conector SERIAL I/O (CN104)', 'esquema': ['CN104'], 'bloque': 'puertos',
     'confianza': 'marca', 'buses': ['ports'],
     'funcion': 'El segundo puerto serie de la CPU (SIO1): datos en los dos sentidos y sus líneas de control (RTS, CTS, DTR, DSR).'},
    {'id': 'pio', 'nombre': 'Puerto paralelo', 'pieza': 'Conector PARALLEL I/O de 68 contactos (CN103)', 'esquema': ['CN103'],
     'bloque': 'puertos', 'confianza': 'marca', 'buses': ['ports'],
     'funcion': 'Saca el bus de sistema de la CPU (direcciones, datos, lectura y escritura) y su selección ~CS0, para periféricos de '
                'expansión.'},
]

PS1_BOTTOM = [
    {'id': 'b-mech', 'nombre': 'Sub-CPU del CD (68HC05)', 'pieza': 'MC68HC05G6 · QFP de 52 patas (IC304)', 'esquema': ['IC304'], 'bloque': 'mech',
     'confianza': 'posicion', 'buses': ['cd_decoder', 'cd_servo'],
     'funcion': 'Gobierna el lector: lee el subcódigo del disco, la tapa (S301) y el final de carrera, enciende el láser (LDON) y habla '
                'con el controlador del CD. Hace también la comprobación de protección del disco.'},
    {'id': 'b-motor', 'nombre': 'Driver de motores (BA6392FP)', 'pieza': 'BA6392FP · 28 patas (IC704)', 'esquema': ['IC704'], 'bloque': 'servo',
     'confianza': 'marca', 'buses': ['cd_servo'],
     'funcion': 'Cuatro canales de potencia para las bobinas de foco y de seguimiento y los motores del carro y del disco, a 8 V.'},
    {'id': 'b-enc', 'nombre': 'Codificador de vídeo (CXA1645)', 'pieza': 'Sony CXA1645M · SOP de 24 patas (IC501)', 'esquema': ['IC501'],
     'bloque': 'enc', 'confianza': 'marca', 'buses': ['video'],
     'funcion': 'Hace el vídeo compuesto y el S-vídeo a partir del RGB analógico del MC141685 y del sincronismo de la GPU.'},
    {'id': 'b-xcpu', 'nombre': 'Cristal de la CPU', 'pieza': 'Cristal X101 (marcado «RO67.73»)', 'esquema': ['X101'], 'bloque': 'clk',
     'confianza': 'marca', 'buses': ['clocks'],
     'funcion': '67,7376 MHz: la CPU va a la mitad, 33,8688 MHz, 768 veces la frecuencia de muestreo de 44,1 kHz.'},
    {'id': 'b-servo', 'nombre': 'Operacionales del servo', 'pieza': 'NJM2904 (IC702) y µPC5023GR (IC706)', 'esquema': ['IC702', 'IC706'],
     'bloque': 'servo', 'confianza': 'posicion', 'buses': ['cd_servo'],
     'funcion': 'Parte del servo del lector, entre el DSP y el driver de los motores.'},
]

PS1_PU18 = [
    {'id': 'p-cpu', 'nombre': 'CPU (CXD8606Q)', 'pieza': 'Sony CXD8606Q · QFP de 208 patas (IC103)', 'esquema': ['IC103'], 'bloque': 'cpu',
     'confianza': 'marca', 'buses': ['main_ram', 'sbus', 'gpu_bus', 'controllers', 'ports'],
     'funcion': 'Un núcleo compatible con el MIPS R3000A a 33,8688 MHz, con el coprocesador de geometría (GTE), la DMA, el controlador '
                'de la RAM y los puertos serie de los mandos. Saca el bus de la RAM y el bus de sistema (la BIOS, el CD, la SPU).'},
    {'id': 'p-ram', 'nombre': 'RAM principal (2 MB)', 'pieza': 'Cuatro KM48V514BJ (IC106–IC109), 512 KB cada una',
     'esquema': ['IC106', 'IC107', 'IC108', 'IC109'], 'bloque': 'ram', 'confianza': 'marca', 'buses': ['main_ram'],
     'funcion': '2 MB de DRAM EDO en cuatro chips de 8 bits: juntos dan el bus de 32 bits de la CPU, con direcciones multiplexadas '
                '(/RAS, /CAS0–/CAS3).'},
    {'id': 'p-bios', 'nombre': 'BIOS (512 KB)', 'pieza': 'ROM en SOP de 32 patas (IC102)', 'esquema': ['IC102'], 'bloque': 'bios',
     'confianza': 'marca', 'buses': ['sbus'],
     'funcion': 'El programa de arranque y el núcleo del sistema, en el bus de sistema con 8 bits de datos. La CPU empieza en $BFC00000.'},
    {'id': 'p-gpu', 'nombre': 'GPU (CXD8561BQ)', 'pieza': 'Sony CXD8561BQ · QFP de 208 patas (IC203)', 'esquema': ['IC203'], 'bloque': 'gpu',
     'confianza': 'marca', 'buses': ['gpu_bus', 'vram', 'video'],
     'funcion': 'Dibuja triángulos, rectángulos y líneas en la VRAM a partir de las órdenes que le llegan por GP0, casi siempre por DMA, '
                'y saca la imagen en RGB digital hacia el DAC. Su reloj es el cristal X201.'},
    {'id': 'p-vram', 'nombre': 'VRAM (1 MB)', 'pieza': 'SGRAM µPD481850 · QFP de 100 patas (IC201)', 'esquema': ['IC201'], 'bloque': 'vram',
     'confianza': 'marca', 'buses': ['vram'],
     'funcion': 'El cuadro que se ve, el que se dibuja y las texturas, en 1 MB con un bus de 32 bits solo para la GPU.'},
    {'id': 'p-rgb', 'nombre': 'DAC de vídeo (MC141685)', 'pieza': 'MC141685 · QFP de 44 patas (IC202)', 'esquema': ['IC202'], 'bloque': 'dacrgb',
     'confianza': 'marca', 'buses': ['video'],
     'funcion': 'Convierte los tres colores digitales de la GPU (SR0–7, SG0–7, SB0–7) en RGB analógico.'},
    {'id': 'p-xgpu', 'nombre': 'Cristal de vídeo', 'pieza': 'Cristal de 53,69 MHz (X201)', 'esquema': ['X201'], 'bloque': 'clk', 'confianza': 'marca',
     'buses': ['clocks'],
     'funcion': 'El reloj de la GPU y del vídeo: 53,69 MHz en esta placa (el de las consolas NTSC).'},
    {'id': 'p-spu', 'nombre': 'SPU (CXD2925Q)', 'pieza': 'Sony CXD2925Q · QFP de 100 patas (IC308)', 'esquema': ['IC308'], 'bloque': 'spu',
     'confianza': 'marca', 'buses': ['spu', 'sbus', 'audio'],
     'funcion': '24 voces ADPCM de 16 bits a 44,1 kHz, con envolventes y reverberación; mezcla también el audio del CD. Saca las muestras en '
                'serie hacia el DAC.'},
    {'id': 'p-spuram', 'nombre': 'RAM del sonido (512 KB)', 'pieza': 'MB814260 · SOJ de 40 patas (IC310)', 'esquema': ['IC310'], 'bloque': 'spuram',
     'confianza': 'marca', 'buses': ['spu'],
     'funcion': 'Las muestras, el eco y los búferes de la SPU, en una DRAM de 16 bits solo suya.'},
    {'id': 'p-dac', 'nombre': 'DAC de audio (AK4309A)', 'pieza': 'AK4309A · SSOP de 24 patas (IC402)', 'esquema': ['IC402'], 'bloque': 'dacaudio',
     'confianza': 'marca', 'buses': ['audio'],
     'funcion': 'Convierte la serie de la SPU (BICK, LRCK, SDATA) en el audio estéreo analógico.'},
    {'id': 'p-cdc', 'nombre': 'Controlador del CD (CXD1815Q)', 'pieza': 'Sony CXD1815Q · QFP de 100 patas (IC305)', 'esquema': ['IC305'],
     'bloque': 'cdc', 'confianza': 'marca', 'buses': ['cd_decoder', 'sbus', 'audio'],
     'funcion': 'Recibe los datos del disco del DSP, corrige los errores por sectores con su SRAM, contesta a la CPU por el bus de sistema '
                'y pasa el audio del CD a la SPU.'},
    {'id': 'p-sram', 'nombre': 'SRAM del CD (32 KB)', 'pieza': 'CXK5V8257BTM · TSOP de 28 patas (IC303)', 'esquema': ['IC303'], 'bloque': 'cdc',
     'confianza': 'marca', 'buses': ['cd_decoder'],
     'funcion': 'El búfer de sectores del controlador del CD.'},
    {'id': 'p-dsp', 'nombre': 'DSP del CD (CXD2545Q)', 'pieza': 'Sony CXD2545Q · QFP de 100 patas (IC701)', 'esquema': ['IC701'], 'bloque': 'servo',
     'confianza': 'marca', 'buses': ['cd_servo', 'cd_decoder'],
     'funcion': 'Demodula la señal del disco y lleva los servos de foco, seguimiento, carro y giro (en la PU-18, en el mismo chip). Saca los '
                'datos en serie hacia el controlador.'},
    {'id': 'p-rf', 'nombre': 'Amplificador de RF (CXA1791N)', 'pieza': 'CXA1791N · SSOP de 20 patas (IC703) y RV703', 'esquema': ['IC703', 'RV703'],
     'bloque': 'servo', 'confianza': 'marca', 'buses': ['cd_servo'],
     'funcion': 'Amplifica los fotodiodos de la cabeza y saca la RF y los errores de foco y de seguimiento hacia el DSP. RV703 es el ajuste.'},
    {'id': 'p-alim', 'nombre': 'Alimentación', 'pieza': 'CN602 y el regulador 78M05 (IC601)', 'esquema': ['CN602', 'IC601'], 'bloque': 'alim',
     'confianza': 'marca', 'buses': ['power'],
     'funcion': 'Entrada de 3,3 V y 8 V de la fuente y el 78M05 que hace los 5 V del audio.'},
    {'id': 'p-cd', 'nombre': 'Conectores del lector', 'pieza': 'CN701 (motores) y CN702 (cabeza óptica)', 'esquema': ['CN701', 'CN702'],
     'bloque': 'servo', 'confianza': 'marca', 'buses': ['cd_servo'],
     'funcion': 'Los motores del disco y del carro, y la cabeza óptica.'},
    {'id': 'p-mandos', 'nombre': 'Mandos y tarjetas', 'pieza': 'Conector CN102', 'esquema': ['CN102'], 'bloque': 'mandos', 'confianza': 'marca',
     'buses': ['controllers'], 'funcion': 'El bus serie de los dos mandos y las dos tarjetas de memoria, hacia la placa de los puertos.'},
    {'id': 'p-tapa', 'nombre': 'Interruptor de la tapa', 'pieza': 'S301', 'esquema': ['S301'], 'bloque': 'mech', 'confianza': 'marca',
     'buses': ['cd_decoder'], 'funcion': 'La tapa del CD, leída por el 68HC05 (en la otra cara).'},
]

HOTSPOTS = {'n64': N64_CPU04, 'ps1': PS1_TOP}

FUENTES = {
    'n64': [
        {'titulo': 'cy-888/OpeN64 — recreación KiCad de la placa NUS-CPU-03 (OpeN64.kicad_sch, OpeN64.kicad_pcb; KiCad 10, commit 4c40512)',
         'autor': 'cy-888 (Cyframe); escaneos de CrazyGadget y Bryce; huellas ajustadas por Xenii',
         'url': 'https://github.com/cy-888/OpeN64', 'licencia': 'CERN-OHL-P v2 (permisiva: permite estudiar, modificar y distribuir)',
         'uso': 'Esquema (una hoja A0, convertida de KiCad 10 a 7 sin cambiar el contenido: solo la sintaxis) y placa en 3D y en 2D. '
                'Sus huellas sitúan los recuadros y las marcas de la foto.'},
        {'titulo': 'iFixit, «Nintendo 64 Teardown» (guía 74923), paso 8: la placa NUS-CPU-04 sin disipadores',
         'autor': 'iFixit y colaboradores de la guía', 'url': 'https://www.ifixit.com/Teardown/Nintendo+64+Teardown/74923',
         'licencia': 'CC BY-NC-SA 3.0 (uso no comercial, con atribución)',
         'uso': 'La foto de la placa: recortada a la placa y reducida, sin retocar (los recuadros de colores son de iFixit).'},
        {'titulo': 'Rodrigo Copetti, «Nintendo 64 Architecture»', 'autor': 'Rodrigo Copetti',
         'url': 'https://www.copetti.org/writings/consoles/nintendo-64/', 'licencia': 'CC BY 4.0',
         'uso': 'Cifras de la CPU (93,75 MHz), el RCP (62,5 MHz), la RDRAM (4,5 MB, bus de 9 bits, 250 MHz, hasta 500 MB/s; Jumper Pak y '
                'Expansion Pak), el vídeo y el audio, el PIF y el CIC (arranque en $BFC00000, IPL1–IPL3) y el bloqueo por la forma del cartucho.'},
        {'titulo': 'N64brew Wiki — «Memory map», «SysAD Interface», «Peripheral Interface», «Joybus Protocol», «Video Interface», «Motherboard»',
         'autor': 'Colaboradores de N64brew', 'url': 'https://n64brew.dev/wiki/Memory_map', 'licencia': 'Sin licencia indicada: solo consulta',
         'uso': 'Mapa de memoria; los ciclos de lectura y escritura del bus SysAD (EOK, PVALID, EVALID); el bus del cartucho (ALEH, ALEL, '
                'LAT, PWD, RLS: 1040, 304 y 64 ns en los cartuchos oficiales); los bits de 4 µs de los mandos; los relojes de vídeo medidos '
                '(48,62 MHz NTSC, 49,56 MHz PAL) y las líneas (H_SYNC 3093 y 3177, V_SYNC 525 y 625); U3 = PST9128 en la -03 y la -04.'},
        {'titulo': 'Nintendo 64 Programming Manual, «3.7 Clock Speeds and Bus Bandwidth» (copia de ultra64.ca)',
         'autor': 'Nintendo', 'url': 'https://ultra64.ca/files/documentation/online-manuals/man-v5-1/pro-man/pro03/03-07.htm',
         'licencia': 'Copyright de Nintendo: solo consulta', 'uso': 'CPU 93,75 MHz, RCP 62,5 MHz, RDRAM 250 MHz, AI 44,1 kHz, PI 20 MB/s de pico y 5 MB/s con ROM lentas.'},
        {'titulo': 'BitBuilt, «Ultimate N64 NTSC/PAL region switch guide»', 'autor': 'Foro BitBuilt',
         'url': 'https://bitbuilt.net/forums/threads/ultimate-n64-ntsc-pal-region-switch-guide.1620/', 'licencia': 'Sin licencia: solo consulta',
         'uso': 'Diferencias de las placas PAL: el PIF-NUS («el chip de la región»), la velocidad del bus de la RAM (la patilla de frecuencia '
                'del MX8330) y el vídeo (DENC-NUS en un solo chip, sin RGB, en lugar de VDC-NUS más ENC-NUS).'},
        {'titulo': 'ConsoleArtisan, «Nintendo 64 Repair Reference»', 'autor': 'ConsoleArtisan',
         'url': 'https://consoleartisan.com/reference/n64/', 'licencia': 'Sin licencia indicada: solo consulta',
         'uso': 'Los años de la placa del selector: la familia «NUS-CPU-01 to -04 (1996 to 1997)», con las -01 a -03 de «1996-97 '
                'NTSC-J and early NTSC-U»; de ahí «NUS-CPU-03 NTSC · 1996-97».'},
    ],
    'ps1': [
        {'titulo': 'xyzz/pu-18 — recreación KiCad de la placa PU-18 (pu-18.kicad_sch, pu-18.kicad_pcb; KiCad 10, commit 9694a7e)',
         'autor': 'xyzz', 'url': 'https://github.com/xyzz/pu-18', 'licencia': 'CC0 1.0 (dominio público)',
         'uso': 'Esquema (una hoja A0, convertida de KiCad 10 a 7 sin cambiar el contenido: solo la sintaxis), placa en 3D y en 2D, la foto de '
                'la placa recreada y montada (img/front.jpeg) y la lista de chips de su README.'},
        # (two entries, one per file page: a bare URL in the text has no break point and widened «Fuentes» on a phone)
        {'titulo': 'Antoinebercovici, «Sony Playstation 1 SCPH-5502 motherboard top» (Wikimedia Commons, 5-10-2014)',
         'autor': 'Antoinebercovici (obra propia)', 'url': 'https://commons.wikimedia.org/wiki/File:Sony_Playstation_1_SCPH-5502_motherboard_top.jpg',
         'licencia': 'CC BY-SA 4.0',
         'uso': 'La foto de la cara de componentes: escaneo en alta resolución de la placa de una SCPH-5502 PAL (PU-18), reducido y '
                'recomprimido, sin recortar ni retocar.'},
        {'titulo': 'Antoinebercovici, «Sony Playstation 1 SCPH-5502 motherboard bottom» (Wikimedia Commons, 5-10-2014)',
         'autor': 'Antoinebercovici (obra propia)', 'url': 'https://commons.wikimedia.org/wiki/File:Sony_Playstation_1_SCPH-5502_motherboard_bottom.jpg',
         'licencia': 'CC BY-SA 4.0',
         'uso': 'La foto de la cara de soldadura de la misma placa, reducida y recomprimida, sin recortar ni retocar.'},
        {'titulo': 'ConsoleMods Wiki, «PS1:Controller Fuses»', 'autor': 'Colaboradores de ConsoleMods',
         'url': 'https://consolemods.org/wiki/PS1:Controller_Fuses', 'licencia': 'Sin licencia en la página: solo consulta',
         'uso': 'Los fusibles de los mandos de los modelos grises (PS602, CCP2E20, en los 8 V; PS605, CCP2E15, en los 3,3 V) y qué falla cuando se funden.'},
        {'titulo': 'PS1 Developer Wiki — «Motherboards»', 'autor': 'Colaboradores de psdevwiki',
         'url': 'https://psdevwiki.com/ps1/Motherboards', 'licencia': 'Sin licencia indicada: solo consulta',
         'uso': 'Modelos con placa PU-18 (SCPH-550X, SCPH-5552, primeras SCPH-700X y SCPH-750X) y diferencias con PU-16, PU-20 y PU-22.'},
        {'titulo': 'Rodrigo Copetti, «PlayStation Architecture»', 'autor': 'Rodrigo Copetti',
         'url': 'https://www.copetti.org/writings/consoles/playstation/', 'licencia': 'CC BY 4.0',
         'uso': 'La CPU (R3000A, 33,87 MHz, caché de instrucciones de 4 KB y 1 KB de scratchpad, GTE, MDEC), la RAM (2 MB en cuatro chips), '
                'la GPU (1 MB, tabla de orden), la SPU (24 voces, 44,1 kHz, 512 KB), el CD (68HC05, 32 KB de SRAM), la BIOS (512 KB, bus de '
                '8 bits) y la protección (surco ondulado con SCEA, SCEE o SCEI).'},
        {'titulo': 'Martin Korth (nocash), «PlayStation Specifications» (psx-spx): Memory Map, I/O Map, GPU', 'autor': 'Martin Korth y colaboradores',
         'url': 'https://psx-spx.consoledev.net/', 'licencia': 'Sin licencia indicada: solo consulta',
         'uso': 'Mapa de memoria y de E/S; relojes (CPU 33,8688 MHz = 44 100 Hz × 768; vídeo 53,693175 MHz NTSC y 53,203425 MHz PAL), '
                '263 y 314 líneas, 3413 y 3406 ciclos por línea, puertos GP0 y GP1 y la DMA en lista enlazada.'},
    ],
}

# ------------------------------------------------------------------ extra fields: revisions, chip table, notes

EQUIVALENCIAS = {
    'n64': [
        {'foto': 'VR4300 (U10)', 'esquema': 'U10 · N64_U10_CPU', 'senales': 'SysAD0–31, SysCmd0–4, EVALID, PVALID, EOK, MASTER_CLOCK, INT0–2, NMI, ColdReset', 'cambios': '', 'fuente': 'esquema; Copetti'},
        {'foto': 'RCP-NUS (U9)', 'esquema': 'U9 · N64_U9_RCP', 'senales': 'SysAD, bus Rambus, CAD0–15, SRGB0–6, AUDCLK/AUDDAT/AUDLRCLK, PCHCLK/PCHCMD/PCHRSP', 'cambios': '', 'fuente': 'esquema'},
        {'foto': 'RDRAM18-NUS (U14, U11)', 'esquema': 'U14, U11 · N64_U14_RAM_Top, N64_U11_RAM_Bottom', 'senales': 'BUSDATA0–8, BUSCTRL, BUSENABLE, RXCLK, TXCLK, VREF, SIN/SOUT', 'cambios': '', 'fuente': 'esquema; Copetti'},
        {'foto': 'PIF-NUS (U6)', 'esquema': 'U6 · N64_U6_PIF', 'senales': 'PCHCLK, PCHCMD, PCHRSP, JOY00–03, JOYI0–4, SECCLK, SECTRD, SECRTC, NMI, CLDRES, RSWIN', 'cambios': 'En las PAL, otro PIF.', 'fuente': 'esquema; BitBuilt'},
        {'foto': 'VDC-NUS A, BU9801F (U4)', 'esquema': 'U4 · N64_U4', 'senales': 'SRGB0–6, TSYNC, TCLK → ROUT, GOUT, BOUT, CSYNC', 'cambios': 'Según BitBuilt, la placa PAL normal lleva un solo chip, DENC-NUS, que no saca RGB.', 'fuente': 'foto; BitBuilt'},
        {'foto': 'ENC-NUS (U5)', 'esquema': 'U5 · N64_U5', 'senales': 'RIN, GIN, BIN, SYNCIN, SCIN → YOUT, COUT, VOUT; NT/PAL a +5 V', 'cambios': '', 'fuente': 'foto; esquema'},
        {'foto': 'BU9480F (U1)', 'esquema': 'U1 · N64_U1 (huella 9480F)', 'senales': 'DCK, SI, LRCK → LOUT, ROUT', 'cambios': '', 'fuente': 'foto; esquema'},
        {'foto': 'AMP-NUS (U2)', 'esquema': 'U2 · N64_U2 (huella AMP_NUS)', 'senales': 'CH1IN/CH2IN → CH1OUT/CH2OUT, 12 V', 'cambios': '', 'fuente': 'foto; esquema'},
        {'foto': 'MX8330 (U7, U15)', 'esquema': 'U7, U15 · N64_U7, N64_U15', 'senales': 'U7: FSO/5 (VCLK, TCLK), FSC; U15: FSO (CLKTOEND); FSEL', 'cambios': 'En las PAL, otra frecuencia (FSEL, el cristal).', 'fuente': 'esquema; BitBuilt'},
        {'foto': 'PST9128 (U3)', 'esquema': 'U3 · N64_U3 (huella PST9128)', 'senales': 'VOUT → RESIC del PIF', 'cambios': '', 'fuente': 'N64brew'},
        {'foto': 'PQ7VZ5 (U12)', 'esquema': 'U12 · N64_U12 (huella PQ7VZ5)', 'senales': 'VOUT → VTERM, VADJ', 'cambios': '', 'fuente': 'esquema'},
        {'foto': '78M05 (U13)', 'esquema': 'U13 · 78M05', 'senales': 'En la PCB: entrada +12V, salida +5V', 'cambios': 'El esquema de OpeN64 pone las dos patas en +3.3V (ver las notas).', 'fuente': 'PCB de OpeN64'},
        {'foto': 'Ranura «P5»', 'esquema': 'P6 (valor «P5») · N64_P5_Cart_Slot', 'senales': 'CAD0–15, ALEH, ALEL, READ, WRITE, SEC1, SEC2, SECCLK, RESET, RESTART, CSYNC, SOUND_L/R', 'cambios': 'OpeN64 la numera P6; la serigrafía de Nintendo dice P5.', 'fuente': 'foto; esquema'},
    ],
    'ps1': [
        {'foto': 'CPU (IC103)', 'esquema': 'IC103 · CXD8606Q', 'senales': 'DA0–9/DD0–31 (RAM), SA/SD (bus de sistema), VD0–31 (GPU), puertos serie', 'cambios': '', 'fuente': 'README de pu-18; esquema'},
        {'foto': 'GPU (IC203)', 'esquema': 'IC203 · CXD8561BQ', 'senales': 'D0–31, /CS, /RD, /WR, DACK; FD0–31 y LA0–9 (VRAM); SR/SG/SB0–7', 'cambios': '', 'fuente': 'README; esquema'},
        {'foto': 'VRAM (IC201)', 'esquema': 'IC201 · D481850DF (SGRAM)', 'senales': 'DQ0–31, A0–9, /RAS, /CAS, /WE, /CS, DSF, CLK', 'cambios': '', 'fuente': 'README; esquema'},
        {'foto': 'RAM (IC106–IC109)', 'esquema': 'IC106–IC109 · KM48V514BJ', 'senales': 'CPMA0–9, CPMD0–31, /RAS, /CAS0–3, /W', 'cambios': 'Otras subrevisiones de la PU-18 usan un solo chip (psdevwiki).', 'fuente': 'README; psdevwiki'},
        {'foto': 'SPU (IC308)', 'esquema': 'IC308 · CXD2925Q', 'senales': 'SA/SD, /SPU, DREQ/DACK4, MA/MD (RAM del sonido), BCKO/LRCO/DATO', 'cambios': '', 'fuente': 'README; esquema'},
        {'foto': 'Controlador del CD (IC305)', 'esquema': 'IC305 · CXD1815Q', 'senales': 'HA0–1, HD0–7, /HCS, HINT; MA/MDB (SRAM IC303); BCLK/DATA/LRCK del DSP', 'cambios': '', 'fuente': 'README; esquema'},
        {'foto': 'Microcontrolador del CD (IC304, cara de abajo)', 'esquema': 'IC304 · MC68HC05G6', 'senales': 'DECCS/DECRD/DECWR, DECA0–1, DECD0–7; SCOR, SUBQ, SQCK, SENSE, DOOR, LDON', 'cambios': '', 'fuente': 'README; esquema'},
        {'foto': 'DSP del CD (IC701)', 'esquema': 'IC701 · CXD2545Q', 'senales': 'RFDC, FE, TE; FFDR/FRDR, TFDR/TRDR, SFDR/SRDR, MDP; DA15, DA16, LRCK', 'cambios': 'La PU-20 junta DSP, controlador y su RAM en un CXD1817R; la PU-22, también la SPU (psdevwiki).', 'fuente': 'psdevwiki; esquema'},
        {'foto': 'Amplificador de RF (IC703)', 'esquema': 'IC703 · CXA1791N', 'senales': 'PD1/PD2, E, F → RFO, FE, TE; LD/APCON', 'cambios': '', 'fuente': 'README; esquema'},
        {'foto': 'Driver de motores (IC704, cara de abajo)', 'esquema': 'IC704 · BA6392FP', 'senales': 'CH1–CH4: seguimiento, foco, carro y giro', 'cambios': '', 'fuente': 'README; esquema'},
        {'foto': 'DAC de audio (IC402)', 'esquema': 'IC402 · AK4309A', 'senales': 'BICK, LRCK, SDATA, MCLK → AOUTL, AOUTR', 'cambios': 'La PU-22 no lleva DAC de audio aparte (psdevwiki).', 'fuente': 'psdevwiki; esquema'},
        {'foto': 'DAC RGB (IC202) y codificador (IC501)', 'esquema': 'IC202 · MC141685; IC501 · CXA1645M', 'senales': 'R0–7/G0–7/B0–7 → QPR/QPG/QPB → RIN/GIN/BIN → Y, C, compuesto', 'cambios': '', 'fuente': 'README; esquema'},
    ],
}

NOTAS = {
    'n64': [
        {'ref': 'U13', 'pin': '1', 'texto': 'El esquema de OpeN64 pone la entrada del 78M05 en +3.3V; en su PCB va a +12V (con C129, C150–C152, C162–C164 y C174, '
                                            'también en +3.3V en el esquema), como corresponde a un regulador de 5 V.'},
        {'ref': 'U13', 'pin': '3', 'texto': 'La salida del 78M05 está en +3.3V en el esquema y en +5V en la PCB (con C109, C110 y C130).'},
        {'ref': 'SW1', 'pin': '7', 'texto': 'En el esquema, +3.3V; en la PCB, la salida de 12 V del interruptor (+12V).'},
        {'ref': 'P6', 'texto': 'La ranura del cartucho es P5 en la serigrafía de Nintendo; OpeN64 la llama P6 (con el valor «P5»).'},
        {'ref': 'L5', 'texto': 'L5 y L6 (filtros de VSSP y VDDP de la CPU), y los tornillos P8 y P9, solo están en la PCB, no en el esquema.'},
    ],
    'ps1': [],
}

EXTRA = {
    'n64': {
        'revisiones': [
            {'vista': 'Foto', 'revision': 'NUS-CPU-04 NTSC (iFixit), la revisión siguiente a la del esquema', 'fuente': 'iFixit'},
            {'vista': 'Esquema y placa', 'revision': 'NUS-CPU-03 NTSC, recreación OpeN64', 'fuente': 'cy-888'},
            {'vista': 'Arquitectura', 'revision': 'NTSC (los relojes PAL se indican aparte)', 'fuente': 'Copetti; N64brew; manual de programación'},
        ],
        'equivalencias_cabecera': ['Chip (marca de la foto)', 'Esquema de OpeN64', 'Señales', 'Qué cambia', 'Fuente'],
        'citas': 'Esquema: el de OpeN64 (redes y nombres de patilla). Copetti, N64brew y BitBuilt: las páginas de «Fuentes».',
        'notas': NOTAS['n64'],
    },
    'ps1': {
        'revisiones': [
            {'vista': 'Foto', 'revision': 'PU-18 de una SCPH-5502 PAL, las dos caras (Antoinebercovici); la recreación pu-18 montada', 'fuente': 'Wikimedia Commons; xyzz'},
            {'vista': 'Esquema y placa', 'revision': 'PU-18, recreación pu-18 (cristales X101 de 67,73 MHz y X201 de 53,69 MHz)', 'fuente': 'xyzz'},
            {'vista': 'Arquitectura', 'revision': 'PU-18; los relojes de vídeo NTSC y PAL a elegir', 'fuente': 'Copetti; psx-spx'},
        ],
        'equivalencias_cabecera': ['Pieza', 'Esquema de pu-18', 'Señales', 'En otras placas', 'Fuente'],
        'citas': 'README: la lista de chips de pu-18. psdevwiki: «Motherboards». Esquema: el de pu-18 (redes y nombres de patilla).',
    },
}

MAQUINAS = [
    {
        'id': 'n64',
        'titulo': 'Nintendo 64',
        'placa': 'NUS-CPU-03 (NTSC)',
        'esquema_titulo': 'NUS-CPU-03 (OpeN64)',
        'raiz': 'n64/kicad7/OpeN64.kicad_sch',
        'netlist': 'n64/netlist/OpeN64.nets.json',
        'buses': 'n64/netlist/OpeN64.buses.json',
        'svg': lambda path: 'n64/svg/OpeN64.svg',
        'huellas': 'n64/pcb/OpeN64_huellas.json',
        'pcb_nombre': 'OpeN64 (NUS-CPU-03)',
        'equivalencias': EQUIVALENCIAS['n64'],
        'fotos': [
            # iFixit's teardown photo (CC BY-NC-SA 3.0) of a populated NUS-CPU-04 with its heatsinks off, cropped to the board;
            # boxes and markers from OpeN64's footprints through an affine fit to 8 chips (consolas_snes)
            {'id': 'cpu04', 'titulo': 'NUS-CPU-04 sin disipadores (NTSC)', 'origen': 'n64/fotos/ifixit/nus-cpu-04_p8-2_recorte.jpg',
             'alineacion': 'n64/fotos/ifixit/nus-cpu-04_p8-2.alineacion.json', 'ancho': 1600, 'calidad': 78,
             'credito': 'Foto: iFixit, «Nintendo 64 Teardown», CC BY-NC-SA 3.0',
             'revision': 'NUS-CPU-04 (NTSC), la revisión siguiente a la del esquema', 'hotspots': HOTSPOTS['n64'],
             'nota': 'Placa NUS-CPU-04 de una consola NTSC, sin la chapa ni los disipadores (paso 8 de la guía de iFixit), recortada a la placa '
                     'y reducida, sin retocar: los recuadros rojo, verde y azul los dibujó iFixit sobre la CPU, el RCP y la RDRAM. Cada '
                     'recuadro de esta vista es la huella de su pieza en la PCB de OpeN64 (NUS-CPU-03) llevada a la foto.'},
        ],
        'aviso': ('Esquema y placa de OpeN64, una recreación «1:1» en KiCad de la NUS-CPU-03 NTSC (cy-888, CERN-OHL-P v2), hecha a partir de '
                  'escaneos de la placa original para montarla con los chips de una consola. La foto es de una NUS-CPU-04 NTSC (iFixit): la '
                  'disposición es la misma, y las huellas de la -03 caen sobre sus piezas. Las placas PAL cambian el PIF, el reloj y el '
                  'vídeo (ver «Fuentes»). El esquema de OpeN64 no da los valores ni las marcas de los chips (la tabla de abajo los relaciona '
                  'con la foto) y pone en +3,3 V la entrada y la salida del 78M05 (U13) y algunos condensadores que la PCB lleva a +12 V y +5 V.'),
    },
    {
        'id': 'ps1',
        'titulo': 'PlayStation',
        'placa': 'PU-18 (SCPH-5502 PAL y otras)',
        'esquema_titulo': 'PU-18 (pu-18 de xyzz)',
        'raiz': 'ps1/kicad7/pu-18.kicad_sch',
        'netlist': 'ps1/netlist/pu-18.nets.json',
        'buses': 'ps1/netlist/pu-18.buses.json',
        'svg': lambda path: 'ps1/svg/pu-18.svg',
        'huellas': 'ps1/pcb/pu-18_huellas.json',
        'pcb_nombre': 'pu-18',
        'equivalencias': EQUIVALENCIAS['ps1'],
        'fotos': [
            # Antoinebercovici's scans of a SCPH-5502 board (Wikimedia Commons, CC BY-SA 4.0), both faces, placed from pu-18's PCB
            {'id': 'cara-a', 'titulo': 'SCPH-5502 (PU-18), cara de componentes',
             'origen': 'ps1/fotos/commons/Sony_Playstation_1_SCPH-5502_motherboard_top.jpg',
             'alineacion': 'ps1/fotos/commons/SCPH-5502_top.alineacion.json', 'ancho': 1600, 'calidad': 72,
             'credito': 'Foto: Antoinebercovici, Wikimedia Commons, CC BY-SA 4.0', 'revision': 'PU-18 (1-664-537-62) de una SCPH-5502 PAL',
             'hotspots': PS1_TOP,
             'nota': 'Escaneo en alta resolución de la placa de una SCPH-5502 PAL, sin blindajes: la serigrafía dice PU-18 y 1-664-537-62. '
                     'Reducido y recomprimido, sin recortar ni retocar. Cada recuadro es la huella de su pieza en la PCB de pu-18 llevada '
                     'al escaneo.'},
            {'id': 'cara-b', 'titulo': 'SCPH-5502 (PU-18), cara de soldadura',
             'origen': 'ps1/fotos/commons/Sony_Playstation_1_SCPH-5502_motherboard_bottom.jpg',
             'alineacion': 'ps1/fotos/commons/SCPH-5502_bottom.alineacion.json', 'ancho': 1600, 'calidad': 70,
             'credito': 'Foto: Antoinebercovici, Wikimedia Commons, CC BY-SA 4.0', 'revision': 'PU-18 (1-664-537-62) de una SCPH-5502 PAL',
             'hotspots': PS1_BOTTOM,
             'nota': 'La otra cara de la misma placa, vista desde abajo: sale como en un espejo (el puerto paralelo queda arriba a la '
                     'izquierda). Reducida y recomprimida, sin retocar.'},
            # the pu-18 recreation (CC0) assembled with a donor's chips: the same layout, chips in view; placed from its PCB
            {'id': 'pu18', 'titulo': 'Recreación pu-18 con los chips de una consola', 'origen': 'ps1/fotos/pu-18_front_recorte.jpg',
             'alineacion': 'ps1/fotos/pu-18_front.alineacion.json', 'ancho': 1600, 'calidad': 78,
             'credito': 'Foto: xyzz (proyecto pu-18), CC0', 'revision': 'Recreación pu-18 (la del esquema), con los chips de una PU-18',
             'hotspots': PS1_PU18,
             'nota': 'La placa recreada de pu-18 (máscara negra) montada con los chips Sony de una consola, que sus autores dicen que están en los '
                     'mismos sitios que en la PU-18. Recortada y reducida; fotografiada en ángulo. Los recuadros son las huellas de su PCB '
                     'llevadas a la foto con una homografía.'},
        ],
        'aviso': ('Esquema y placa de pu-18 (xyzz, CC0), una recreación en KiCad de la PU-18 de la PlayStation, probada funcionando con los '
                  'chips de una consola. La PU-18 es la placa de las SCPH-550X, la SCPH-5552 y las primeras SCPH-700X y SCPH-750X (psdevwiki). '
                  'Las fotos son de la placa de una SCPH-5502 PAL, la PU-18 por sus dos caras; la tercera, de la recreación montada.'),
    },
]
