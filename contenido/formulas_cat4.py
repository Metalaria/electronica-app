"""Curated formulas, chapters 42–53 (files cap43–cap53). See formulas.py for the format of F()."""
from formulas import F


def db(n, lo, hi, d):
    return {'n': n, 'u': 'dB', 'r': (lo, hi), 'd': d, 'lineal': True}


# ------------------------------------------------------------------ cap43 — amplifiers
F('zin-emisor-comun', 'Impedancia de entrada del emisor común', 'cap43', 'Z_("in") = R_("1") "‖" R_("2") "‖" β dot.op r_("e")',
  'Z_in = par(R_1, R_2, beta*r_e)', {'Z_in': ('Impedancia de entrada', 'Ω', '1 Ω', '100 MΩ'), 'R_1': 'Resistencia superior del divisor R₁',
                                     'R_2': 'Resistencia inferior del divisor R₂', 'beta': 'Ganancia de corriente β', 'r_e': 'Resistencia dinámica de emisor'},
  ej={'R_1': '47 kΩ', 'R_2': '10 kΩ', 'beta': '150', 'r_e': '19,5 Ω', 'Z_in': '2,16 kΩ'}, claves='impedancia de entrada emisor común')
F('zout-seguidor', 'Impedancia de salida del seguidor de emisor', 'cap43', 'Z_("out") approx r_("e") + (R_("fuente"))/(β)',
  'Z_out = r_e + R_s/beta', {'Z_out': ('Impedancia de salida', 'Ω', '0,01 Ω', '1 MΩ'), 'r_e': 'Resistencia dinámica de emisor',
                             'R_s': ('Resistencia de la fuente de señal', 'Ω', '0 Ω', '10 MΩ', '1 kΩ'), 'beta': 'Ganancia de corriente β'},
  ej={'r_e': '19,5 Ω', 'R_s': '1 kΩ', 'beta': '150', 'Z_out': '26 Ω'}, claves='seguidor de emisor colector común impedancia de salida')
F('av-gm-rc', 'Ganancia del emisor común (g_m·R_C)', 'cap43', 'A_("v") = - g_(m) dot.op R_("C") $',
  'A_v = -g_m*R_C', {'A_v': 'Ganancia de tensión', 'g_m': 'Transconductancia', 'R_C': 'Resistencia de colector'},
  ej={'g_m': '38,6 mS', 'R_C': '4,7 kΩ', 'A_v': '-181'}, claves='emisor común ganancia gm')
F('av-degenerado', 'Ganancia del emisor común con resistencia de emisor', 'cap43', 'A_("v") = - (R_("C"))/(r_("e") + R_("E")) approx',
  'A_v = -R_C/(r_e + R_E)', {'A_v': 'Ganancia de tensión', 'R_C': 'Resistencia de colector', 'r_e': 'Resistencia dinámica de emisor', 'R_E': 'Resistencia de emisor sin puentear'},
  ej={'R_C': '3,3 kΩ', 'r_e': '19,5 Ω', 'R_E': '1 kΩ', 'A_v': '-3,24'}, claves='degeneración de emisor realimentación local')
F('miller', 'Efecto Miller', 'cap43', 'C_("efectiva") = C dot.op lr(( "1" + bar.v A bar.v ))',
  'C_M = C*(1 + abs(A_v))', {'C_M': ('Capacidad efectiva vista desde la entrada', 'F', '1 fF', '1 F'), 'C': ('Capacidad entre entrada y salida', 'F', '0,01 pF', '1 µF', '2 pF'),
                             'A_v': {'n': 'Ganancia de la etapa', 'u': 'V/V', 'r': ('-1e5', '1e5'), 'd': '-100', 'lineal': True}},
  no='A_v', claves='miller capacidad ancho de banda')
F('vpico-potencia', 'Tensión de pico para una potencia en una carga', 'cap43', 'V_("pico") = sqrt("2" dot.op P dot.op R)',
  'V_p = sqrt(2*P*R_L)', {'V_p': 'Tensión de pico', 'P': 'Potencia media (senoidal)', 'R_L': 'Resistencia de carga'},
  ej={'P': '20 W', 'R_L': '8 Ω', 'V_p': '17,9 V'}, claves='potencia altavoz amplificador tensión de pico')
F('disipacion-clase-b-aprox', 'Disipación máxima en clase B (aproximación)', 'cap43', 'P_("disip") approx ("2" dot.op P_(op("max")))/(π^("2"))',
  'P_d = 2*P_max/pi^2', {'P_d': ('Disipación máxima por transistor', 'W', '1 mW', '10 kW'), 'P_max': ('Potencia máxima de salida', 'W', '1 mW', '10 kW', '20 W')},
  ej={'P_max': '20 W', 'P_d': '4 W'}, tol=0.02, claves='clase b disipación push-pull')
F('potencia-clase-b', 'Potencia de salida en clase B', 'cap43', 'P_("salida") = (V_("p")^("2"))/("2" dot.op R_("L")) quad P_("consumida")',
  'P_o = V_p^2/(2*R_L)', {'P_o': ('Potencia de salida', 'W', '1 µW', '10 kW'), 'V_p': 'Amplitud de pico en la carga', 'R_L': 'Resistencia de carga'},
  claves='clase b potencia salida')
F('consumo-clase-b', 'Potencia consumida en clase B', 'cap43', 'quad P_("consumida") = ("2" dot.op V_("CC") dot.op V_("p"))/(π dot.op R_("L"))',
  'P_c = 2*V_CC*V_p/(pi*R_L)', {'P_c': ('Potencia consumida de la alimentación', 'W', '1 µW', '10 kW'), 'V_CC': 'Tensión de alimentación (cada rama)',
                                'V_p': 'Amplitud de pico en la carga', 'R_L': 'Resistencia de carga'}, claves='clase b consumo')
F('rendimiento-clase-b', 'Rendimiento de un amplificador en clase B', 'cap43', 'η = (P_("salida"))/(P_("consumida")) = (π)/("4")',
  'eta = 100*pi/4*V_p/V_CC', {'eta': 'Rendimiento', 'V_p': 'Amplitud de pico en la carga', 'V_CC': 'Tensión de alimentación (cada rama)'},
  ej={'V_p': '15 V', 'V_CC': '15 V', 'eta': '78,54 %'}, tol=0.001, claves='clase b rendimiento 78,5')
F('disipacion-clase-b', 'Disipación máxima por transistor en clase B', 'cap43',
  ['P_("disipada" lr(( op("max") ))) = (V_("CC")^("2"))/(π^("2") dot.op R_("L"))', ('cap51', 'P_(op("max")) approx (V^("2"))/(π^("2") dot.op R)'), ('cap51', 'P_("disipada" , op("max")) = (V^("2"))/(π^("2") dot.op R)')],
  'P_d = V_CC^2/(pi^2*R_L)', {'P_d': ('Disipación máxima por transistor', 'W', '1 mW', '10 kW'), 'V_CC': 'Tensión de alimentación (cada rama)', 'R_L': 'Resistencia de carga'},
  ej={'V_CC': '35 V', 'R_L': '8 Ω', 'P_d': '15,5 W'}, origen='sección @sec-51.1', nota='Ocurre con una amplitud de salida V<sub>p</sub> = 2·V<sub>CC</sub>/π ≈ 0,637·V<sub>CC</sub>.',
  claves='clase b disipación disipador')
F('conduccion-clase-d', 'Pérdidas de conducción de un puente en clase D', 'cap43', 'P_("conducción") = "2" dot.op I^("2") dot.op R_("DS" lr(( "on" )))',
  'P = 2*I^2*R_on', {'P': 'Pérdidas de conducción', 'I': 'Corriente eficaz por el altavoz', 'R_on': ('Resistencia en conducción R_DS(on)', 'Ω', '0,1 mΩ', '10 Ω', '50 mΩ')},
  ej={'I': '2 A', 'R_on': '50 mΩ', 'P': '0,4 W'}, claves='clase d puente pérdidas mosfet')

# ------------------------------------------------------------------ cap44 — buses
F('i2c-subida', 'Tiempo de subida de una línea I²C', 'cap44', 't_("r") = R dot.op C dot.op op("ln") ("0,7")/("0,3")',
  't_r = R*C*ln(0.7/0.3)', {'t_r': ('Tiempo de subida (30–70 %)', 's', '1 ns', '1 ms'), 'R': ('Resistencia de pull-up', 'Ω', '100 Ω', '100 kΩ', '4,7 kΩ'),
                            'C': ('Capacidad del bus', 'F', '10 pF', '10 nF', '200 pF')},
  ej={'R': '5901 Ω', 'C': '200 pF', 't_r': '1000 ns'}, claves='i2c pull-up tiempo de subida')
F('i2c-rmin', 'Resistencia de pull-up mínima de I²C', 'cap44', 'R_("min") = (V_("DD") - "0,4")/("3 mA")',
  'R_min = (V_DD - 0.4)/I_OL', {'R_min': ('Resistencia mínima', 'Ω', '1 Ω', '1 MΩ'), 'V_DD': 'Tensión de alimentación del bus', 'I_OL': ('Corriente que debe absorber el dispositivo', 'A', '0,1 mA', '100 mA', '3 mA')},
  ej={'V_DD': '3,3 V', 'I_OL': '3 mA', 'R_min': '967 Ω'}, claves='i2c pull-up mínima')
F('can-longitud', 'Longitud máxima de un bus CAN', 'cap44', '"2" dot.op lr(( L dot.op t_("línea") + t_("lazo" , "transceptor") ))',
  'L_max = (T_bit*f_p/2 - t_tr)/t_l',
  {'L_max': ('Longitud máxima', 'm', '0 m', '100 km'), 'T_bit': ('Duración del bit', 's', '100 ns', '1 ms', '1000 ns'),
   'f_p': ('Fracción del bit para la propagación', '', '0,05', '0,9', '0,4'), 't_tr': ('Retardo del transceptor (ida)', 's', '0 s', '1 µs', '120 ns'),
   't_l': ('Retardo de la línea por metro', 's/m', '1e-9', '1e-8', '5e-9')},
  ej={'T_bit': '1000 ns', 'f_p': '0,4', 't_tr': '120 ns', 't_l': '5e-9', 'L_max': '16 m'}, claves='can bus longitud velocidad')

# ------------------------------------------------------------------ cap45 — optoelectronics
F('energia-foton', 'Energía de un fotón', 'cap45', ['E = h dot.op f = h dot.op (c)/(λ)', 'E lr(( "eV" )) approx ("1240")/(λ lr(( "nm" )))'],
  'E_ph = h_P*c_0/(lambda*q_e)', {'E_ph': ('Energía del fotón', 'eV', '0,01', '100'), 'lambda': ('Longitud de onda', 'm', '100 nm', '100 µm', '620 nm')},
  ej={'lambda': '620 nm', 'E_ph': '2,0'}, claves='fotón led longitud de onda electronvoltio')

# ------------------------------------------------------------------ cap46 — reliability
F('rpn', 'Número de prioridad de riesgo (AMFE)', 'cap46', '"RPN" = G times O times D',
  'RPN = G_s*O_c*D_t', {'RPN': ('Número de prioridad de riesgo', '', '1', '1000'), 'G_s': {'n': 'Gravedad (1–10)', 'u': '', 'r': ('1', '10'), 'd': '8', 'sim': 'G'},
                        'O_c': {'n': 'Ocurrencia (1–10)', 'u': '', 'r': ('1', '10'), 'd': '3', 'sim': 'O'}, 'D_t': {'n': 'Detección (1–10)', 'u': '', 'r': ('1', '10'), 'd': '5', 'sim': 'D'}},
  claves='amfe fmea riesgo rpn')
F('mtbf-fit', 'MTBF de componentes en serie', 'cap46', 'λ_("total") = "Σ" λ_(i) quad "MTBF" = ("1")/(λ_("total"))',
  'MTBF = 1e9/(n_c*FIT)', {'MTBF': ('Tiempo medio entre fallos', 'h', '1', '1e15'), 'n_c': {'n': 'Número de componentes', 'u': '', 'r': ('1', '1e7'), 'd': '200', 'sim': 'n'},
                           'FIT': ('Tasa de fallos de cada componente', 'FIT', '0,001', '1e6', '1')},
  ej={'n_c': '200', 'FIT': '1', 'MTBF': '5,0e6'}, claves='fiabilidad mtbf fit tasa de fallos')
F('arrhenius', 'Factor de aceleración de Arrhenius', 'cap46', '"AF" = op("exp") lr([ lr(( E_("a") \\/ k ))',
  'AF = exp(E_a*q_e/k_B*(1/(T_u + 273.15) - 1/(T_e + 273.15)))',
  {'AF': ('Factor de aceleración', '', '1e-6', '1e12'), 'E_a': ('Energía de activación', 'eV', '0,1', '2', '0,7'),
   'T_u': {'n': 'Temperatura de uso', 'u': '°C', 'r': ('-55', '200'), 'd': '55', 'lineal': True},
   'T_e': {'n': 'Temperatura de ensayo', 'u': '°C', 'r': ('-55', '250'), 'd': '125', 'lineal': True}},
  ej={'E_a': '0,7', 'T_u': '55', 'T_e': '125', 'AF': '77,7'}, claves='arrhenius envejecimiento acelerado fiabilidad')

# ------------------------------------------------------------------ cap47 — measurement and thermal practice
F('incertidumbre-combinada', 'Incertidumbre combinada (tres contribuciones)', 'cap47', ['u = sqrt(u_("1")^("2") + u_("2")^("2") + dots.h)', 'u_("total") = sqrt(u_("1")^("2") + u_("2")^("2")'],
  'u = sqrt(u_1^2 + u_2^2 + u_3^2)', {'u': ('Incertidumbre combinada', '%', '0', '100'), 'u_1': ('Contribución 1', '%', '0', '100', '0,5'),
                                      'u_2': ('Contribución 2', '%', '0', '100', '0,2'), 'u_3': ('Contribución 3', '%', '0', '100', '0,1')},
  ej={'u_1': '0,5 %', 'u_2': '0,2 %', 'u_3': '0,1 %', 'u': '0,548 %'}, tol=0.002, claves='incertidumbre cuadratura metrología')
F('tur', 'Relación de incertidumbre de ensayo (TUR)', 'cap47', '"TUR" = ("tolerancia del instrumento")/("incertidumbre del patrón")',
  'TUR = tol_i/u_p', {'TUR': ('Relación TUR', '', '0,01', '1e4'), 'tol_i': ('Tolerancia del instrumento', '%', '1e-5', '100', '0,1'),
                      'u_p': ('Incertidumbre del patrón', '%', '1e-6', '100', '0,025')}, claves='calibración tur patrón')
F('rsa-medida', 'Resistencia térmica medida de un disipador', 'cap47', 'R_("sa") = (T_("disipador") - T_("ambiente"))/(P)',
  'R_sa = (T_d - T_A)/P', {'R_sa': ('Resistencia térmica disipador-ambiente', '°C/W', '0', '1000'), 'T_d': {'n': 'Temperatura del disipador', 'u': '°C', 'r': ('-40', '200'), 'd': '60', 'lineal': True},
                           'T_A': 'Temperatura ambiente', 'P': 'Potencia aplicada'}, claves='disipador medida resistencia térmica')
F('incertidumbre-multimetro', 'Incertidumbre de un multímetro (% de lectura + cuentas)', 'cap47', 'u = "0,0002" times "5 V" + "5" times "10 µV"',
  'u = p/100*V + n_d*res', {'u': ('Incertidumbre', 'V', '1 nV', '100 V'), 'p': ('Porcentaje de la lectura', '%', '0,001', '10', '0,02'), 'V': 'Valor leído',
                            'n_d': {'n': 'Cuentas (dígitos) del término fijo', 'u': '', 'r': ('0', '1000'), 'd': '5', 'lineal': True}, 'res': ('Resolución del rango', 'V', '1 nV', '1 V', '10 µV')},
  ej={'p': '0,02', 'V': '5 V', 'n_d': '5', 'res': '10 µV', 'u': '1,05 mV'}, claves='multímetro exactitud incertidumbre cuentas')

# ------------------------------------------------------------------ cap50 — laboratory power supply
F('vcc-fuente-lineal', 'Tensión continua tras rectificar y filtrar', 'cap50', 'V_("cc") = V_(op("sec")) times "1,414" - "2" times V_("diodo")',
  'V_cc = V_sec*sqrt(2) - 2*V_D - dV/2', {'V_cc': ('Tensión continua media', 'V', '0 V', '1 kV'), 'V_sec': ('Tensión eficaz del secundario', 'V', '1 V', '1 kV', '18 V'),
                                          'V_D': ('Caída de cada diodo del puente', 'V', '0 V', '2 V', '0,7 V'), 'dV': {'n': 'Rizado pico a pico', 'u': 'V', 'r': ('0 V', '100 V'), 'd': '2 V', 'sim': 'ΔV'}},
  ej={'V_sec': '18 V', 'V_D': '0,7 V', 'dV': '2 V', 'V_cc': '23,1 V'}, claves='fuente lineal rectificador puente')
F('regulacion-lazo', 'Mejora de la regulación por la ganancia de lazo', 'cap50', '"variación real" = ("variación en lazo abierto")/("1" + A dot.op β)',
  'dV_c = dV_a/(1 + T_l)', {'dV_c': ('Variación con el lazo cerrado', 'V', '1 nV', '1 kV'), 'dV_a': ('Variación en lazo abierto', 'V', '1 µV', '1 kV', '1 V'),
                            'T_l': ('Ganancia de lazo A·β', '', '0', '1e8', '1000')},
  ej={'dV_a': '1 V', 'T_l': '1000', 'dV_c': '1 mV'}, claves='regulación realimentación ganancia de lazo')
F('regulacion-linea', 'Regulación de línea', 'cap50', '"reg"_("línea") = (V_(op("max")) - V_("min"))/(V_("nominal"))',
  'Reg = 100*(V_max - V_min)/V_nom', {'Reg': ('Regulación de línea', '%', '0', '100'), 'V_max': ('Salida máxima medida', 'V', '0 V', '1 kV', '5,001 V'),
                                      'V_min': ('Salida mínima medida', 'V', '0 V', '1 kV', '4,999 V'), 'V_nom': ('Salida nominal', 'V', '0,1 V', '1 kV', '5 V')},
  claves='regulación de línea fuente')
F('divisor-realimentacion', 'Divisor de realimentación de una fuente regulada', 'cap50', 'R_("1") = R_("2") dot.op lr(( (V_(op("max")))/(V_("ref")) - "1" ))',
  'R_1 = R_2*(V_max/V_ref - 1)', {'R_1': 'Resistencia superior R₁', 'R_2': 'Resistencia inferior R₂', 'V_max': ('Tensión de salida máxima', 'V', '0,5 V', '1 kV', '30 V'),
                                  'V_ref': 'Tensión de referencia'},
  ej={'R_2': '10 kΩ', 'V_max': '30 V', 'V_ref': '2,5 V', 'R_1': '110 kΩ'}, claves='divisor realimentación fuente referencia')
F('divisor-diferencial', 'Ganancia del amplificador diferencial de sensado', 'cap50', 'R_("1") = R_("2") dot.op (V_(op("max")))/(V_("ref"))',
  'R_1 = R_2*V_max/V_ref', {'R_1': 'Resistencia R₁', 'R_2': 'Resistencia R₂', 'V_max': ('Tensión de salida máxima', 'V', '0,5 V', '1 kV', '30 V'), 'V_ref': 'Tensión de referencia'},
  ej={'R_2': '10 kΩ', 'V_max': '30 V', 'V_ref': '2,5 V', 'R_1': '120 kΩ'}, claves='sensado remoto diferencial')

# ------------------------------------------------------------------ cap51 — audio amplifier
F('potencia-maxima-amplificador', 'Potencia máxima de un amplificador antes del recorte', 'cap51', 'P = (lr(( V - V_("saturación") ))^("2"))/("2" dot.op R)',
  'P = (V_CC - V_sat)^2/(2*R_L)', {'P': 'Potencia máxima (senoidal)', 'V_CC': 'Tensión de alimentación (cada rama)', 'V_sat': ('Pérdida de la etapa de salida', 'V', '0 V', '20 V', '3 V'),
                                   'R_L': 'Resistencia de carga'},
  ej={'V_CC': '35 V', 'V_sat': '3 V', 'R_L': '8 Ω', 'P': '64 W'}, claves='potencia amplificador altavoz recorte')

# ------------------------------------------------------------------ cap52 — SDR receiver
F('amplitud-iq', 'Amplitud a partir de I y Q', 'cap52', ['"amplitud" = sqrt(I^("2") + Q^("2"))', ('cap32', '"amplitud" = sqrt(X^("2") + Y^("2"))')],
  'A = sqrt(I_c^2 + Q_c^2)', {'A': ('Amplitud', 'V', '0 V', '1 kV'), 'I_c': {'n': 'Componente en fase I', 'u': 'V', 'r': ('-100 V', '100 V'), 'd': '0,3 V', 'lineal': True, 'sim': 'I'},
                              'Q_c': {'n': 'Componente en cuadratura Q', 'u': 'V', 'r': ('-100 V', '100 V'), 'd': '0,4 V', 'lineal': True, 'sim': 'Q'}},
  claves='iq cuadratura lock-in amplitud')
F('ina-dos-operacionales', 'Ganancia del amplificador de instrumentación de dos operacionales', 'cap52', 'G = 1 + (R_("a"))/(R_("b")) + (2 R_("a"))/(R_("G"))',
  'G = 1 + R_a/R_b + 2*R_a/R_G', {'G': ('Ganancia', 'V/V', '1', '1e5'), 'R_a': ('Resistencia R_a', 'Ω', '10 Ω', '10 MΩ', '4,99 kΩ'),
                                  'R_b': ('Resistencia R_b', 'Ω', '10 Ω', '10 MΩ', '499 Ω'), 'R_G': ('Resistencia de ganancia R_G', 'Ω', '1 Ω', '10 MΩ', '499 Ω')},
  ej={'R_a': '4,99 kΩ', 'R_b': '499 Ω', 'R_G': '499 Ω', 'G': '31'}, claves='amplificador de instrumentación dos operacionales')
F('sallen-key-f0', 'Frecuencia de un Sallen-Key de ganancia unidad', 'cap52', 'f_(0) = (1)/(2 π R sqrt(C_(1) C_(2)))',
  'f_0 = 1/(2*pi*R*sqrt(C_1*C_2))', {'f_0': ('Frecuencia característica', 'Hz', '1 mHz', '1 GHz'), 'R': 'Resistencia (las dos iguales)', 'C_1': 'Capacidad C₁', 'C_2': 'Capacidad C₂'},
  ej={'R': '3,92 kΩ', 'C_1': '2,2 nF', 'C_2': '1 nF', 'f_0': '27,4 kHz'}, claves='sallen key filtro activo segundo orden')
F('sallen-key-q', 'Factor de calidad de un Sallen-Key de ganancia unidad', 'cap52', 'quad quad Q = (sqrt(C_(1) C_(2)))/(2 C_(2))',
  'Q = sqrt(C_1*C_2)/(2*C_2)', {'Q': 'Factor de calidad', 'C_1': 'Capacidad C₁', 'C_2': 'Capacidad C₂'},
  ej={'C_1': '2,2 nF', 'C_2': '1 nF', 'Q': '0,74'}, claves='sallen key q butterworth')
F('rechazo-imagen', 'Rechazo de imagen por desequilibrio I/Q', 'cap52', '"IRR" approx (4)/(ε^(2) + φ^(2))',
  'IRR = 10*log10(4/((e_g/100)^2 + (phi*pi/180)^2))',
  {'IRR': db('Rechazo de imagen', '0', '120', '40'), 'e_g': {'n': 'Error relativo de ganancia entre I y Q', 'u': '%', 'r': ('0', '50'), 'd': '2', 'lineal': True, 'sim': 'ε'},
   'phi': {'n': 'Error de fase entre I y Q', 'u': '°', 'r': ('0', '45'), 'd': '0', 'lineal': True}},
  ej={'e_g': '2 %', 'phi': '0', 'IRR': '40'}, claves='sdr rechazo de imagen iq desequilibrio')

# ------------------------------------------------------------------ cap53 — repair
F('resistencia-cuadro', 'Resistencia por cuadro de una lámina de cobre', 'cap53', 'R_("□") = (ρ)/(t) = ("1,72" times "10"^(- "8"))',
  'R_sq = rho/t_cu', {'R_sq': ('Resistencia por cuadro', 'Ω/sq', '1e-6', '1e6'), 'rho': 'Resistividad', 't_cu': ('Espesor de la lámina', 'm', '1 µm', '1 mm', '35 µm')},
  ej={'rho': '1,72e-8', 't_cu': '35 µm', 'R_sq': '0,000491'}, claves='resistencia por cuadro pista cobre')
