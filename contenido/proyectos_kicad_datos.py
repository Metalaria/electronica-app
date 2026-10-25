"""Curated data of the «Proyectos KiCad» views: the four KiCad projects of the book (printed chapters 48-51,
sources cap49-cap52), their seven boards, which book sections explain each block of the schematic, the function
of the main components (Spanish, taken from the project README and the chapter text, with the label of the
section that explains it), and the DC operating points that can be put on the board nets.

Everything here is cited: `ref` labels must exist in refs.json (the build fails otherwise) and every quoted
fragment comes from the README of the project or from the book. Components not listed here get a function
deduced from their connections (marked «deducida» in the app).
"""

KICAD = '/home/claude/v3/complementos/kicad'

# ------------------------------------------------------------------ projects and boards

PROYECTOS = [
    {
        'id': 'estacion_iot', 'titulo': 'Estación de medida ambiental IoT', 'parte': 'cap49', 'figura': 'fig-new-49-placa',
        'carpeta': 'estacion_iot', 'readme': 'estacion_iot/README.md',
        'resumen': 'Placa portadora del ESP32-DevKitC y de los módulos de sensores, con la entrada de 5 V protegida, el shunt de '
                   'medida, el raíl de sensores conmutado, la FRAM y el filtro antialiasing del micrófono.',
        'placas': [
            {'id': 'estacion_iot', 'titulo': 'Placa portadora', 'dir': 'estacion_iot/placa', 'base': 'estacion_iot',
             'libro': {'texto': 'sec-49.12'}},
        ],
    },
    {
        'id': 'fuente_laboratorio', 'titulo': 'Fuente de alimentación de laboratorio', 'parte': 'cap50',
        'figura': 'fig-new-50-placa', 'carpeta': 'fuente_laboratorio', 'readme': 'fuente_laboratorio/README.md',
        'resumen': 'Núcleo de regulación de la fuente 0–30 V / 0–5 A: paso serie Darlington, lazos CV y CC con su OR de diodos, '
                   'shunt Kelvin de cuatro terminales, sensado remoto con amplificador diferencial y bornes.',
        'placas': [
            {'id': 'fuente_laboratorio', 'titulo': 'Núcleo de regulación', 'dir': 'fuente_laboratorio/placa',
             'base': 'fuente_laboratorio',
             # «placa de 100 × 80 mm a dos caras con 69 componentes» (sec-50.16, «La placa enrutada y verificada»)
             'libro': {'texto': 'sec-50.16', 'ancho': 100, 'alto': 80, 'componentes': 69, 'capas': 2}},
        ],
    },
    {
        'id': 'amplificador_hifi', 'titulo': 'Amplificador de audio Hi-Fi', 'parte': 'cap51', 'figura': 'fig-new-51-placa',
        'carpeta': 'amplificador_hifi', 'readme': 'amplificador_hifi/README.md',
        'resumen': 'Amplificador clase AB de 50 W por canal sobre 8 Ω repartido en cuatro placas: etapa de potencia (una por '
                   'canal), preamplificador con tono Baxandall, fuente ±35 V con el punto de estrella y protección de altavoces.',
        'placas': [
            {'id': 'hifi-potencia', 'titulo': 'Etapa de potencia (un canal)', 'dir': 'amplificador_hifi/potencia', 'base': 'potencia',
             'figura': 'fig-new-51-placa',
             # «la etapa de potencia (una por canal, 160 × 100 mm, figura …)» (sec-51.9)
             'libro': {'texto': 'sec-51.9', 'ancho': 160, 'alto': 100}},
            {'id': 'hifi-preamplificador', 'titulo': 'Preamplificador y tono', 'dir': 'amplificador_hifi/preamplificador',
             'base': 'preamplificador', 'libro': {'texto': 'sec-51.9'}},
            {'id': 'hifi-fuente', 'titulo': 'Fuente ±35 V y estrella', 'dir': 'amplificador_hifi/fuente', 'base': 'fuente',
             'libro': {'texto': 'sec-51.9'}},
            {'id': 'hifi-proteccion', 'titulo': 'Protección de altavoces', 'dir': 'amplificador_hifi/proteccion', 'base': 'proteccion',
             'libro': {'texto': 'sec-51.9'}},
        ],
    },
    {
        'id': 'sdr', 'titulo': 'Receptor SDR de 3,5 a 7,5 MHz', 'parte': 'cap52', 'figura': 'fig-new-52-placa', 'carpeta': 'sdr',
        'readme': 'sdr/README.md',
        'resumen': 'Front-end de conversión directa: atenuador, preselector, detector de muestreo en cuadratura con su oscilador '
                   'local sintetizado y banda base de I y Q hacia la tarjeta de sonido.',
        'placas': [
            {'id': 'sdr', 'titulo': 'Receptor', 'dir': 'sdr/placa', 'base': 'sdr',
             # «placa de dos capas de 120 × 88 mm» (sec-new-52-frontend, «De la arquitectura al circuito»)
             'libro': {'texto': 'sec-new-52-frontend', 'ancho': 120, 'alto': 88, 'capas': 2}},
        ],
    },
]

# Manufacturing notes of each README («Parámetros de fabricación»): mask colour and finish when stated.
FABRICACION = {
    'estacion_iot': {'mascara': 'verde', 'serigrafia': 'blanca', 'acabado': None,
                     'cita': '2 capas, FR-4 de 1,6 mm, cobre de 1 oz (35 µm), máscara verde y serigrafía blanca en la cara superior.'},
    'fuente_laboratorio': {'mascara': None, 'serigrafia': None, 'acabado': 'HASL sin plomo o ENIG',
                           'cita': 'Máscara: ambas caras. Serigrafía: cara superior. Acabado: HASL sin plomo o ENIG.'},
    'amplificador_hifi': {'mascara': None, 'serigrafia': None, 'acabado': None,
                          'cita': '2 capas, FR-4 de 1,6 mm, cobre de 1 oz (35 µm), máscara y serigrafía en la cara superior.'},
    'sdr': {'mascara': 'verde', 'serigrafia': 'blanca', 'acabado': 'HASL o ENIG',
            'cita': 'Acabado: HASL o ENIG; máscara verde, serigrafía blanca. 1,6 mm FR-4 / 1 oz (35 µm).'},
}

# ------------------------------------------------------------------ blocks of each schematic -> book sections
# (block names are the column headings of the .kicad_sch; sections from the README correspondence tables)

BLOQUES = {
    'estacion_iot': {
        'Alimentación': ['sec-49.8', 'sec-49.9'],
        'ESP32 DevKitC': ['sec-49.4', 'fig-49.8'],
        'Raíl de sensores': ['sec-49.3'],
        'Bus I²C y memoria': ['sec-49.6', 'fig-49.10'],
        'Sensores': ['sec-49.3', 'sec-49.6'],
        'Micrófono y PIR': ['sec-49.7', 'fig-49.13'],
        'Puntos de prueba': ['sec-49.5', 'sec-49.12'],
    },
    'fuente_laboratorio': {
        'Conexiones': ['sec-50.14'],
        'Paso serie': ['sec-50.14', 'fig-50.22'],
        'Alimentación control': ['sec-50.14'],
        'Excitación y OR': ['sec-50.14', 'fig-50.22'],
        'Lazos CV y CC': ['sec-50.14', 'fig-50.22'],
        'Sensado y medida': ['sec-50.14', 'sec-50.15'],
        'Lectura': ['sec-50.15'],
    },
    'hifi-potencia': {
        'Conectores': ['sec-51.9'],
        'Entrada y par diferencial': ['sec-51.4', 'sec-51.6'],
        'Espejo y VAS': ['sec-51.4', 'sec-51.6'],
        'Polarización (VBE)': ['sec-51.5', 'fig-51.10'],
        'Etapa de salida': ['sec-51.4', 'fig-51.6'],
        'Protecciones': ['sec-51.4'],
        'Salida y realimentación': ['sec-51.6'],
        'Desacoplo': ['sec-51.8'],
    },
    'hifi-preamplificador': {
        'Conectores y alimentación': ['sec-51.3', 'sec-51.12'],
        'Selección de entrada': ['sec-51.3'],
        'Protección de entrada L': ['sec-51.3'],
        'Preamplificador L': ['sec-51.3', 'fig-51.4'],
        'Tono Baxandall L': ['sec-51.3', 'fig-51.5'],
        'Protección de entrada R': ['sec-51.3'],
        'Preamplificador R': ['sec-51.3', 'fig-51.4'],
        'Tono Baxandall R': ['sec-51.3', 'fig-51.5'],
        'Amplificadores': ['sec-51.3'],
        'Potenciómetros': ['sec-51.3'],
    },
    'hifi-fuente': {
        'Rectificador principal': ['sec-51.7', 'sec-51.8'],
        'Filtro y fusibles': ['sec-51.7', 'sec-51.8'],
        'Salidas y estrella': ['sec-51.8', 'sec-51.9'],
        'Alimentación auxiliar': ['sec-51.12'],
    },
    'hifi-proteccion': {
        'Conectores': ['sec-51.12'],
        'Comparadores': ['sec-51.12'],
        'Retardo': ['sec-51.12'],
        'Relés': ['sec-51.4', 'sec-51.12'],
        'Temperatura y red': ['sec-51.12'],
        'Detección de continua': ['sec-51.4', 'sec-51.12'],
    },
    'sdr': {
        'Alimentación': ['sec-new-52-frontend'],
        'Reguladores': ['sec-new-52-frontend'],
        'Entrada y atenuador': ['sec-new-52-frontend', 'sec-52.8'],
        'Preselector': ['sec-new-52-frontend', 'sec-52.1'],
        'Mezclador en cuadratura': ['sec-new-52-frontend', 'sec-52.4'],
        'Oscilador local': ['sec-new-52-frontend'],
        'Divisor 0/90°': ['sec-new-52-frontend', 'sec-52.4'],
        'Bus I2C': ['sec-new-52-frontend'],
        'Control': ['sec-new-52-frontend'],
        'Referencias': ['sec-new-52-frontend'],
        'Banda base I': ['sec-new-52-frontend', 'sec-52.4'],
        'Banda base Q': ['sec-new-52-frontend', 'sec-52.4'],
        'Filtros antialiasing': ['sec-new-52-frontend', 'sec-52.3'],
        'Salida a la tarjeta': ['sec-new-52-frontend'],
    },
}

# ------------------------------------------------------------------ function of the main components
# ref -> (text, label of the book section that explains it or None). Texts from the README of each project.

FUNCIONES = {
    'estacion_iot': {
        'J1': ('Borna de entrada de 5 V: alimenta la estación desde un cargador y hace que toda la corriente pase por el shunt.', 'sec-49.9'),
        'F1': ('Fusible rearmable PTC de 1 A: protege el cargador y el cableado de un cortocircuito en un cable.', 'sec-49.9'),
        'D1': ('Supresor TVS unidireccional: sujeta las sobretensiones del cable y, con la polaridad invertida, conduce y dispara la PTC.', 'sec-49.9'),
        'D2': ('Schottky en serie: bloquea la polaridad invertida y evita que el USB del DevKit alimente al cargador.', 'sec-49.9'),
        'R10': ('Shunt de 0,1 Ω en el retorno: 10 mV por cada 100 mA entre TP10 y TP4, para capturar el perfil de corriente de un ciclo.', 'sec-49.12'),
        'C2': ('Condensador de reserva de 470 µF en la entrada del AMS1117 del DevKit: aguanta los picos de la WiFi.', 'sec-49.4'),
        'C3': ('Condensador de reserva de 220 µF en 3V3: mantiene el margen sobre los 3,0 V del módulo en las ráfagas.', 'sec-49.9'),
        'J2': ('Zócalo 1×19 de una fila del ESP32-DevKitC V4 (filas a 25,4 mm).', 'sec-49.4'),
        'J3': ('Zócalo 1×19 de la otra fila del ESP32-DevKitC V4: GPIO21 = SDA, GPIO22 = SCL, GPIO34 = micrófono, GPIO13 = PIR, GPIO25 = activa sensores.', 'sec-49.4'),
        'Q1': ('MOSFET P AO3401A que conmuta el raíl de sensores 3V3_S desde GPIO25 (0 = encendido).', 'sec-49.3'),
        'R3': ('Con C5, arranque suave del raíl de sensores (unos 0,3 ms): limita la corriente de conexión de los módulos.', 'sec-49.3'),
        'R4': ('Mantiene el raíl de sensores apagado mientras el ESP32 arranca o duerme.', 'sec-49.3'),
        'C5': ('Con R3, arranque suave del raíl de sensores: la corriente de conexión baja de 3,5 A a 0,23 A.', 'sec-49.3'),
        'R1': ('Pull-up de 4,7 kΩ de SDA al raíl conmutado (la R1 de la figura del bus I²C): 0,7 mA por línea en bajo.', 'sec-49.6'),
        'R2': ('Pull-up de 4,7 kΩ de SCL al raíl conmutado (la R2 de la figura del bus I²C).', 'sec-49.6'),
        'U1': ('FRAM MB85RC256V de 32 KiB en 0x50: guarda las 24 h de datos de la especificación sin límite práctico de escrituras.', 'sec-49.9'),
        'J4': ('Zócalo del BME280 interior (0x76).', 'sec-49.3'),
        'J5': ('Zócalo del BH1750 (0x23).', 'sec-49.3'),
        'J6': ('Zócalo de la pantalla OLED SSD1306 (0x3C).', 'sec-49.3'),
        'J7': ('Zócalo del módulo de micrófono MAX9814 con electret.', 'sec-49.7'),
        'J8': ('Conector JST-XH del PIR HC-SR501, por cable.', 'sec-49.8'),
        'J9': ('Conector JST-XH del BME280 exterior (0x77) en su abrigo meteorológico.', 'sec-49.3'),
        'R8': ('100 Ω en serie con SDA del sensor exterior: limita la corriente de un pico inducido en el cable.', 'sec-49.3'),
        'R9': ('100 Ω en serie con SCL del sensor exterior: limita la corriente de un pico inducido en el cable.', 'sec-49.3'),
        'R7': ('Con C12, filtro antialiasing de 1 kΩ y 22 nF (f−3 dB ≈ 7 kHz) delante del GPIO34.', 'sec-49.7'),
        'C12': ('Con R7, filtro antialiasing; además, depósito para el condensador de muestreo del ADC.', 'sec-49.7'),
        'JP1': ('Puente de ganancia del MAX9814: 40, 50 o 60 dB.', 'sec-49.7'),
        'R5': ('Resistencia en serie de la línea del PIR.', 'sec-49.8'),
        'R6': ('Pull-down del GPIO13: es la fuente de despertar y no puede quedar al aire con el PIR desconectado.', 'sec-49.8'),
        'TP10': ('Retorno del shunt: V(TP10 respecto a TP4) = −I × 0,1 Ω.', 'sec-49.12'),
    },
    'fuente_laboratorio': {
        'Q1': ('TIP35C, transistor de paso en el disipador, en el borde superior con la lengüeta hacia fuera.', 'sec-50.14'),
        'Q2': ('BD139, excitador de Q1 en Darlington, también en el borde para compartir disipador.', 'sec-50.14'),
        'Q3': ('BD140, fuente de corriente de unos 7 mA desde la continua bruta: sustituye a la R_drv de 470 Ω del libro.', 'sec-50.14'),
        'U1': ('ADA4522-2: A1 (lazo CV) y A2 (lazo CC), con su compensación R10 + C3 y R13 + C4.', 'sec-50.14'),
        'U2': ('ADA4522-2: amplificador diferencial del sensado remoto (S+ − S−) y lectura de corriente.', 'sec-50.14'),
        'D1': ('Diodo del OR de los dos lazos (1N4148).', 'sec-50.14'),
        'D2': ('Diodo del OR de los dos lazos (1N4148).', 'sec-50.14'),
        'LED1': ('LED verde del modo CV, en serie con el OR.', 'sec-50.3'),
        'LED2': ('LED rojo del modo CC, en serie con el OR.', 'sec-50.8'),
        'R1': ('120 kΩ al 0,1 % del amplificador diferencial del sensado remoto.', 'sec-50.14'),
        'R3': ('120 kΩ al 0,1 % del amplificador diferencial del sensado remoto.', 'sec-50.14'),
        'R2': ('10 kΩ al 0,1 % del amplificador diferencial del sensado remoto.', 'sec-50.14'),
        'R4': ('10 kΩ al 0,1 % del amplificador diferencial del sensado remoto.', 'sec-50.14'),
        'RS1': ('Shunt de 0,01 Ω de cuatro terminales (conexión Kelvin): el pin 2 es la estrella GND/PGND.', 'sec-50.14'),
        'C1': ('Condensador de salida de 470 µF / 63 V.', 'sec-50.14'),
        'C2': ('Condensador de película de 100 nF en los bornes.', 'sec-50.14'),
        'D3': ('Schottky MBR1060 en antiparalelo con la salida: polaridad inversa.', 'sec-50.14'),
        'D4': ('1N5408 de +OUT a VPRE: tensión aplicada desde fuera.', 'sec-50.4'),
        'J4': ('Conector de la NTC pegada al disipador, junto a Q1; la lee la MCU por J3-9.', 'sec-50.14'),
        'J2': ('Bornes de salida: +OUT, −OUT, S+, S− (el par S+/S− contiguo para trenzarlo).', 'sec-50.14'),
        'R21': ('100 Ω de seguridad del sensado remoto.', 'sec-50.14'),
        'R22': ('100 Ω de seguridad del sensado remoto.', 'sec-50.14'),
        'JP1': ('Puente para el sensado local de S+.', 'sec-50.14'),
        'JP2': ('Puente para el sensado local de S−.', 'sec-50.14'),
        'J1': ('Entrada VPRE, PGND y VRAW desde el prerregulador.', 'sec-50.16'),
        'J3': ('Conector IDC 2×5 de control: VSET, ISET, VMON, IMON, NTC y −5 V.', 'sec-50.16'),
        'Q4': ('BD139, sumidero de 8 mA de descarga de la salida: baja de 20 a 5 V en menos de 1 s sin carga.', 'sec-50.3'),
        'R7': ('Divisor de ISET entre 49,9 (con R8): 0–2,5 V pasan a 0–50 mV.', 'sec-50.14'),
        'R8': ('Divisor de ISET entre 49,9 (con R7).', 'sec-50.14'),
    },
    'hifi-potencia': {
        'Q1': ('2N5401 del par diferencial de entrada, apareado con Q2, con degeneración de 100 Ω.', 'sec-51.4'),
        'Q2': ('2N5401 del par diferencial (entrada de realimentación), apareado con Q1.', 'sec-51.4'),
        'Q3': ('2N5401, fuente de corriente de cola del par diferencial (2 mA).', 'sec-51.4'),
        'Q4': ('2N5551 del espejo de corriente del par diferencial.', 'sec-51.4'),
        'Q5': ('2N5551 del espejo de corriente del par diferencial.', 'sec-51.4'),
        'Q6': ('MJE340, etapa amplificadora de tensión (VAS, el «driver» del libro).', 'sec-51.4'),
        'Q7': ('2N5551 que limita la corriente del VAS a unos 14 mA.', 'sec-51.4'),
        'Q8': ('MJE350, carga de corriente constante del VAS (7,7 mA).', 'sec-51.4'),
        'Q9': ('BD139, multiplicador de VBE atornillado al disipador: sigue la temperatura de los de salida.', 'sec-51.5'),
        'RV1': ('Ajuste del bias: 11 mV en R17 = 50 mA. Con el cursor unido a un extremo, si pierde contacto el bias baja.', 'sec-51.5'),
        'Q10': ('MJE15032, driver NPN de la etapa de salida (Darlington complementario).', 'sec-51.4'),
        'Q11': ('MJE15033, driver PNP de la etapa de salida.', 'sec-51.4'),
        'Q12': ('NJW0281G, transistor de salida NPN (TO-3P, 150 W).', 'sec-51.4'),
        'Q13': ('NJW0302G, transistor de salida PNP (TO-3P, 150 W).', 'sec-51.4'),
        'R17': ('Resistencia de emisor de 0,22 Ω / 5 W de Q12: el bias se mide en ella (TP1–TP2, 11 mV).', 'sec-51.5'),
        'R18': ('Resistencia de emisor de 0,22 Ω / 5 W de Q13.', 'sec-51.4'),
        'Q14': ('Limitador de corriente (≈ 5,4 A) del lado positivo.', 'sec-51.4'),
        'Q15': ('Limitador de corriente (≈ 5,4 A) del lado negativo.', 'sec-51.4'),
        'D4': ('Diodo de recuperación UF5404 (protección frente a la carga inductiva del altavoz).', 'sec-51.4'),
        'D5': ('Diodo de recuperación UF5404.', 'sec-51.4'),
        'R23': ('Red de Zobel: 10 Ω / 2 W con C7.', 'sec-51.4'),
        'C7': ('Red de Zobel: 100 nF / 250 V con R23.', 'sec-51.4'),
        'L1': ('Bobina de salida de 2,2 µH al aire (18 espiras de hilo de 1 mm) en paralelo con R24.', 'sec-51.6'),
        'R24': ('4,7 Ω / 2 W en paralelo con L1.', 'sec-51.6'),
        'R25': ('Realimentación global: 23,2 kΩ (con R26, ganancia 14,4).', 'sec-51.6'),
        'R26': ('Realimentación global: 1,65 kΩ a C8.', 'sec-51.6'),
        'C8': ('100 µF bipolar: deja la ganancia en continua en 1 (offset simulado de 2 mV).', 'sec-51.6'),
        'C4': ('Compensación Miller de 150 pF del VAS.', 'sec-51.6'),
        'W1': ('Puente de la toma de realimentación en Kelvin (red OUTS), unido a la salida en la unión de R17/R18.', 'sec-51.6'),
        'R27': ('«Ground lift» de 10 Ω: la masa de señal SGND solo se une a la de potencia a través de ella.', 'sec-51.9'),
        'D1': ('LED rojo: referencia de 1,8 V compartida por las dos fuentes de corriente.', 'sec-51.4'),
        'C1': ('Bloqueo de continua de entrada (2,2 µF de poliéster).', 'sec-51.4'),
        'R1': ('Con C2, filtro de RF de entrada a 340 kHz.', 'sec-51.4'),
        'C2': ('Con R1, filtro de RF de entrada a 340 kHz.', 'sec-51.4'),
        'R2': ('22 kΩ a la masa de señal: impedancia de entrada ≈ 23 kΩ.', 'sec-51.4'),
        'J2': ('Alimentación +35 V, GND y −35 V desde la fuente, con los tres cables trenzados.', 'sec-51.8'),
        'J3': ('Salida al altavoz, a través de la placa de protección.', 'sec-51.9'),
        'J1': ('Entrada de señal (IN, SGND) desde el preamplificador, por cable apantallado.', 'sec-51.9'),
    },
    'hifi-preamplificador': {
        'K1': ('Relé Omron G5V-2 de selección de entrada, junto a los conectores.', 'sec-51.3'),
        'Q1': ('Transistor que acciona el relé de selección desde el conmutador del panel.', 'sec-51.3'),
        'RV1': ('Volumen: potenciómetro doble de 10 kΩ logarítmico, antes de la amplificación.', 'sec-51.3'),
        'RV2': ('Graves: potenciómetro doble de 100 kΩ lineal del Baxandall.', 'sec-51.3'),
        'RV3': ('Agudos: potenciómetro doble de 100 kΩ lineal del Baxandall.', 'sec-51.3'),
        'U1': ('NE5532 con A1 de cada canal (Rf = Rg = 10 kΩ, ganancia 2).', 'sec-51.3'),
        'U2': ('NE5532 con A2 de cada canal: el control de tono Baxandall.', 'sec-51.3'),
        'J1': ('Entrada 1 (RCA del panel trasero, por cable apantallado).', 'sec-51.10'),
        'J2': ('Entrada 2 (RCA del panel trasero, por cable apantallado).', 'sec-51.10'),
        'J3': ('Salida L, GND, R hacia las dos placas de potencia.', 'sec-51.9'),
        'J4': ('Alimentación ±15 V regulada desde la fuente.', 'sec-51.12'),
        'J5': ('Conmutador de entrada del panel (2 hilos).', 'sec-51.3'),
    },
    'hifi-fuente': {
        'D1': ('Puente rectificador principal GBU8J (8 A, 600 V).', 'sec-51.7'),
        'C5': ('Condensador de filtro de 10 000 µF / 50 V; la unión de los cuatro es la masa en estrella.', 'sec-51.8'),
        'C6': ('Condensador de filtro de 10 000 µF / 50 V.', 'sec-51.8'),
        'C7': ('Condensador de filtro de 10 000 µF / 50 V.', 'sec-51.8'),
        'C8': ('Condensador de filtro de 10 000 µF / 50 V.', 'sec-51.8'),
        'F1': ('Fusible T3,15 A de un raíl y un canal.', 'sec-51.8'),
        'F2': ('Fusible T3,15 A de un raíl y un canal.', 'sec-51.8'),
        'F3': ('Fusible T3,15 A de un raíl y un canal.', 'sec-51.8'),
        'F4': ('Fusible T3,15 A de un raíl y un canal.', 'sec-51.8'),
        'D2': ('LED de presencia de +35 V, que además descarga los condensadores.', 'sec-51.9'),
        'D3': ('LED de presencia de −35 V, que además descarga los condensadores.', 'sec-51.9'),
        'U1': ('Regulador L7815: +15 V para el preamplificador desde el devanado auxiliar.', 'sec-51.12'),
        'U2': ('Regulador L7915: −15 V para el preamplificador.', 'sec-51.12'),
        'R3': ('«Loop breaker» del chasis: 10 Ω / 5 W con C11 y D4/D5 en antiparalelo.', 'sec-51.9'),
        'D4': ('Diodo de 6 A del «loop breaker» del chasis.', 'sec-51.9'),
        'D5': ('Diodo de 6 A del «loop breaker» del chasis.', 'sec-51.9'),
        'J1': ('Entrada del transformador toroidal 25-0-25 V.', 'sec-51.7'),
        'J2': ('Salida +35 V, GND, −35 V al canal izquierdo.', 'sec-51.8'),
        'J3': ('Salida +35 V, GND, −35 V al canal derecho.', 'sec-51.8'),
        'J4': ('Retorno de los altavoces a la estrella.', 'sec-51.9'),
        'J5': ('Chasis (tierra de seguridad) a través del «loop breaker».', 'sec-51.9'),
        'J6': ('Entrada del devanado auxiliar 18-0-18 V.', 'sec-51.12'),
        'J7': ('Salida ±15 V al preamplificador.', 'sec-51.12'),
        'J8': ('+24 V y la alterna para la placa de protección.', 'sec-51.12'),
    },
    'hifi-proteccion': {
        'U1': ('LM339: comparadores de continua en la salida, temperatura y caída de red.', 'sec-51.12'),
        'K1': ('Relé Omron G2RL-1-E de 16 A del altavoz izquierdo; su contacto NC cortocircuita el altavoz.', 'sec-51.4'),
        'K2': ('Relé Omron G2RL-1-E de 16 A del altavoz derecho.', 'sec-51.4'),
        'D4': ('LED verde «CONECTADO»: se enciende a los ≈ 5 s del encendido.', 'sec-51.12'),
        'J5': ('NTC de 100 kΩ pegada al disipador izquierdo: disparo a ≈ 75 °C.', 'sec-51.12'),
        'J6': ('NTC de 100 kΩ pegada al disipador derecho.', 'sec-51.12'),
        'J2': ('Entrada desde las salidas de los amplificadores L y R.', 'sec-51.12'),
        'J3': ('Bornes de los altavoces L+, L−, R+, R−.', 'sec-51.12'),
        'J4': ('Retorno de los altavoces a la estrella de la fuente.', 'sec-51.9'),
        'J1': ('+24 V, GND y la alterna AC1/AC2 desde la fuente.', 'sec-51.12'),
    },
    'sdr': {
        'J1': ('Entrada de antena BNC.', 'sec-new-52-frontend'),
        'R2': ('Resistencia de descarga estática de la entrada (10 kΩ).', 'sec-new-52-frontend'),
        'SW1': ('Conmutador del atenuador en pi de 10 dB (97,6/71,5/97,6 Ω).', 'sec-new-52-frontend'),
        'SW2': ('Conmutador del atenuador en pi de 20 dB (61,9/249/61,9 Ω).', 'sec-new-52-frontend'),
        'D3': ('1N4148W de protección de la antena, sin montar por defecto: con señales fuertes generan intermodulación.', 'sec-new-52-frontend'),
        'D4': ('1N4148W de protección de la antena, sin montar por defecto.', 'sec-new-52-frontend'),
        'L1': ('Toroide T37-2 de 1,02 µH del paso bajo elíptico del preselector.', 'sec-new-52-frontend'),
        'L2': ('Toroide T37-2 de 0,78 µH del paso bajo elíptico del preselector.', 'sec-new-52-frontend'),
        'L3': ('Toroide T37-2 de 2,30 µH del paso alto elíptico: deja fuera la onda media.', 'sec-new-52-frontend'),
        'L4': ('Toroide T37-2 de 2,30 µH del paso alto elíptico.', 'sec-new-52-frontend'),
        'T1': ('Transformador trifilar sobre FT37-43: dos fases opuestas con la toma central a 2,5 V (VBIAS).', 'sec-52.4'),
        'C20': ('Condensador de muestreo C0G al 1 % (22 nF) del detector en cuadratura.', 'sec-52.4'),
        'C21': ('Condensador de muestreo C0G al 1 % (22 nF) del detector en cuadratura.', 'sec-52.4'),
        'C22': ('Condensador de muestreo C0G al 1 % (22 nF) del detector en cuadratura.', 'sec-52.4'),
        'C23': ('Condensador de muestreo C0G al 1 % (22 nF) del detector en cuadratura.', 'sec-52.4'),
        'A1': ('Arduino Nano sobre tiras hembra, fuera del blindaje: programa el Si5351A por I²C y lee el codificador.', 'sec-new-52-frontend'),
        'SW3': ('Codificador EC11 de sintonía, con pulsador.', 'sec-new-52-frontend'),
        'Q1': ('BSS138, adaptador de niveles I²C 3,3 V ↔ 5 V (SDA).', 'sec-new-52-frontend'),
        'Q2': ('BSS138, adaptador de niveles I²C 3,3 V ↔ 5 V (SCL).', 'sec-new-52-frontend'),
        'Y1': ('Cristal de 25 MHz (CL = 8 pF) del Si5351A.', 'sec-new-52-frontend'),
        'RV1': ('Trimmer de 100 Ω que iguala la ganancia de Q con la de I (±6 %).', 'sec-52.4'),
        'J3': ('Jack estéreo de 3,5 mm a la tarjeta de sonido: I = izquierdo (punta), Q = derecho (anillo).', 'sec-new-52-frontend'),
        'J2': ('Jack de alimentación de 9–12 V CC (centro +), de una fuente lineal separada del ordenador.', 'sec-new-52-frontend'),
        'D1': ('1N5819 contra la inversión de polaridad.', 'sec-new-52-frontend'),
        'SH1': ('Cabina de blindaje Würth WE-SHC de 51 × 51 mm sobre el preselector, el mezclador y el oscilador local.', 'sec-new-52-frontend'),
        'TP9': ('Punto de prueba de I, para ver el círculo I/Q en modo XY.', 'sec-new-52-frontend'),
        'TP10': ('Punto de prueba de Q, para ver el círculo I/Q en modo XY.', 'sec-new-52-frontend'),
        'TP5': ('Punto «CAL»: CLK1 del Si5351A para calibrar el cristal con un frecuencímetro.', 'sec-new-52-frontend'),
    },
}

# Parts whose value names an IC: shown with this description (README «Lista de materiales»).
CHIPS_SDR = {
    'SN74CBT3253': ('Conmutador doble 4:1 del detector de muestreo en cuadratura (Tayloe).', 'sec-52.4'),
    'Si5351A': ('Sintetizador Si5351A: CLK0 a 4·f_OL (14–30 MHz) hacia el contador Johnson.', 'sec-new-52-frontend'),
    '74LVC74': ('Contador Johnson: dos ondas a f_OL desfasadas 90°, sin ajuste.', 'sec-new-52-frontend'),
    'OPA1678': ('OPA1678, amplificadores de banda base (instrumentación de dos AO, ×31) y Sallen-Key.', 'sec-52.4'),
    'L78L05': ('Regulador de +5VD (conmutador).', 'sec-new-52-frontend'),
    'LP2950-3.3': ('Regulador de +3V3 (Si5351A y divisor), desde +5VD.', 'sec-new-52-frontend'),
    'LP2950-5.0': ('Regulador de +5VA, solo para los amplificadores operacionales.', 'sec-new-52-frontend'),
}

# ------------------------------------------------------------------ DC operating points on the board nets
# Board nets whose voltage is known: annotated in the schematic (estacion_iot), or the DC operating point of the
# project's own SPICE models, which use the same reference designators and net names as the board.

ANOTACIONES = {
    # «Tensiones esperadas» of the schematic annotation (estacion_iot.kicad_sch, «ANOTACIONES (sección 49.5)»)
    'estacion_iot': [
        ('+5V', 4.7, '4,6–4,8 V (5,0 V menos PTC y Schottky)'),
        ('3V3', 3.30, '3,30 V'),
        ('3V3_S', 3.30, '3,30 V con GPIO25 = 0; 0 V con GPIO25 = 1'),
        ('MIC_ADC', 1.25, '1,25 V de reposo (MAX9814)'),
        ('PIR_IN', 0.0, '0 V / 3,3 V'),
        ('GND', 0.0, 'referencia'),
    ],
}

# DC wrappers: ngspice decks built around the project's own subcircuits (run with the native ngspice).
SIMULACIONES = {
    'hifi-potencia': {
        'titulo': 'Reposo con RV1 = 225 Ω (50 mA de bias), ±35 V, entrada a masa y 8 Ω de carga',
        'fuente': 'amplificador_hifi/spice/etapa_potencia.inc (potencia_polarizacion.cir)',
        'dir': 'amplificador_hifi/spice',
        'deck': """* DC operating point of one power amplifier channel (board «potencia»), as potencia_polarizacion.cir
.include modelos.lib
.include etapa_potencia.inc
VP VP 0 35
VN VN 0 -35
VIN IN 0 0
X1 IN 0 VP VN 0 SPK FB FB POTENCIA RVB=225 CDOM=150p
RL SPK 0 8
.op
.end
""",
        # top-level node -> board net
        'puertos': {'IN': 'IN', 'VP': 'VP', 'VN': 'VN', 'SPK': 'SPK', 'FB': 'FB'},
        'subckt': 'x1', 'tierras': ['GND', 'SGND'],
    },
    'fuente_laboratorio': {
        'titulo': 'Salida a 30 V (VSET = 2,5 V) con 1 A de carga, VPRE = 33 V, VRAW = 40 V, −5 V',
        'fuente': 'fuente_laboratorio/spice/nucleo.inc (01_regulacion_dc.cir)',
        'dir': 'fuente_laboratorio/spice',
        'deck': """* DC operating point of the regulation core at 30 V / 1 A, as 01_regulacion_dc.cir
.include modelos.lib
.include nucleo.inc
.param CC1=4.7n RZ1=680k CC2=2.2n RZ2=10k COUT=470u RESR=0.05
VPRE VPRE 0 33
VRAW VRAW 0 40
VNEG VNEG 0 -5
VSET VSET 0 2.5
VISET ISET 0 2.75
X1 VPRE VRAW VNEG 0 OUTP OUTN SP SN VSET ISET VMON IMON NUCLEO
RCP OUTP LP 0.034
RCN LN OUTN 0.034
RS1 LP SP 1m
RS2 LN SN 1m
ILOAD LP LN 1
.op
.end
""",
        'puertos': {'VPRE': 'VPRE', 'VRAW': 'VRAW', 'VNEG': 'VNEG', 'OUTP': 'OUT_P', 'OUTN': 'OUT_N', 'SP': 'SNS_P',
                    'SN': 'SNS_N', 'VSET': 'VSET', 'ISET': 'ISET', 'VMON': 'VMON_OUT', 'IMON': 'IMON_OUT'},
        'subckt': 'x1', 'tierras': ['GND', 'PGND'],
    },
}

# ------------------------------------------------------------------ captions checked against the board
# A figure caption that places a part: the build measures where the part really is (fraction of the board width).
POSICIONES_PIE = [
    {'placa': 'estacion_iot', 'figura': 'fig-new-49-placa', 'refs': ['J2', 'J3'], 'texto': 'el ESP32-DevKitC en el centro',
     'esperado': (0.3, 0.7)},
]

# Inconsistencies of the companion documentation found by reading it against the book (cited, not computed).
ERRATAS_MANUALES = [
    {'placa': 'fuente_laboratorio',
     'texto': 'El README del proyecto (fuente_laboratorio/README.md, «Correcciones al libro») presenta como pendientes las '
              'correcciones 4 a 7 (MJ15003 en TO-3, el cuarto de vatio con 0,01 Ω, R_jc del TIP35C, los 211 mJ del crowbar), que el '
              'capítulo ya recoge (tabla de la lista de materiales de la sección 49.15 y sección 49.14); conviene marcarlas como '
              'aplicadas, como hace el README de la estación IoT.'},
    {'placa': 'amplificador_hifi',
     'texto': 'El README del proyecto (amplificador_hifi/README.md, «Correcciones al libro») presenta como pendientes las correcciones '
              '2 y 3 (bias con drivers, «≈ 29 veces, unos 29 dB»), que el capítulo ya recoge (secciones 50.5 y 50.2); conviene marcarlas '
              'como aplicadas.'},
]
