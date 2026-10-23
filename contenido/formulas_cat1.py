"""Curated formulas, chapters 0–8 (files cap00–cap08). See formulas.py for the format of F()."""
from formulas import F

# ------------------------------------------------------------------ cap00 — mathematics
F('db-tension', 'Ganancia de tensión en decibelios', 'cap00', ['"Ganancia" space lr(( "dB" )) = "20"', ('cap25', '"dB" = "20" dot.op op("log")_("10") (V_("2"))/(V_("1"))')],
  'G_dB = 20*log10(V_s/V_e)',
  {'G_dB': 'Ganancia', 'V_s': 'Tensión de salida', 'V_e': 'Tensión de entrada'},
  ej={'V_e': '1 V', 'V_s': '0,5 V', 'G_dB': '-6 dB'}, claves='decibelio dB atenuación')
F('carga-rc', 'Carga de un condensador (RC)', 'cap00', ['V_("final") dot.op lr(( "1" - "e"^', ('cap24', 'v lr(( t )) = V dot.op lr(( "1" - "e"^(- (t)')],
  'v_C = V_f*(1 - exp(-t/tau))',
  {'v_C': ('Tensión en el condensador en el instante t', 'V', '0 V', '1 kV'),
   'V_f': ('Tensión final', 'V', '1 mV', '1 kV', '10 V'), 't': 'Tiempo transcurrido', 'tau': 'Constante de tiempo'},
  ej={'V_f': '10 V', 't': '1 ms', 'tau': '1 ms', 'v_C': '6,32 V'}, origen='tabla de la sección 0.4: 63,2 % en 1τ',
  claves='exponencial transitorio carga condensador')
F('tau-rc', 'Constante de tiempo RC', 'cap00', ['space "con" quad τ = R dot.op C', ('cap24', ') )) quad τ = R dot.op C $'), ('cap22', 'τ = R dot.op C = "10 000" times "100 nF"')],
  'tau = R*C', {'tau': 'Constante de tiempo', 'R': 'Resistencia', 'C': 'Capacidad'},
  ej={'R': '10 kΩ', 'C': '100 nF', 'tau': '1 ms'}, origen='sección @sec-22.2',
  claves='constante de tiempo tau RC')
F('descarga-rc', 'Descarga de un condensador (RC)', 'cap00', 'v lr(( t )) = V_("0") dot.op "e"^(- (t)',
  'v_C = V_0*exp(-t/tau)',
  {'v_C': ('Tensión en el condensador en el instante t', 'V', '0 V', '1 kV'),
   'V_0': ('Tensión inicial', 'V', '1 mV', '1 kV', '10 V'), 't': 'Tiempo transcurrido', 'tau': 'Constante de tiempo'},
  ej={'V_0': '10 V', 't': '0,693 ms', 'tau': '1 ms', 'v_C': '5 V'}, origen='sección 0.4: la mitad en 0,693·τ',
  claves='exponencial descarga condensador')
F('senoide', 'Valor instantáneo de una senoide', 'cap00', 'v lr(( t )) = V_("p") dot.op op("sen") lr(( ω dot.op t + φ ))',
  'v_t = V_p*sin(omega*t + phi*pi/180)',
  {'v_t': {'n': 'Valor instantáneo', 'u': 'V', 'r': ('-1 kV', '1 kV'), 'sim': 'v(t)', 'lineal': True},
   'V_p': 'Amplitud (valor de pico)', 'omega': 'Frecuencia angular', 't': 'Tiempo', 'phi': 'Fase inicial'},
  claves='seno alterna fase')
F('vrms-seno', 'Valor eficaz de una senoide', 'cap01', ['V_("RMS") = (V_("p"))/(sqrt("2")) approx "0,707" dot.op V_("p")', ('cap24', 'V_("ef") = (V_("pico"))/(sqrt("2"))'), ('cap05', '"pico" = "12" times sqrt("2")'), ('cap22', 'V_("pico") = "9" times "1,414"')],
  'V_RMS = V_p/sqrt(2)', {'V_RMS': 'Tensión eficaz (RMS)', 'V_p': 'Tensión de pico'},
  ej={'V_p': '325 V', 'V_RMS': '230 V'}, claves='eficaz rms pico red')
F('ic-cdvdt', 'Corriente en un condensador', 'cap00', ['i_("C") = C dot.op (d v)/(d t)', ('cap32', 'i = C dot.op (d v)/(d t) $')],
  'i_C = C*dvdt',
  {'i_C': ('Corriente en el condensador', 'A', '1 nA', '100 A'), 'C': 'Capacidad',
   'dvdt': {'n': 'Rapidez de cambio de la tensión', 'u': 'V/s', 'r': ('1', '1e10'), 'd': '1e3', 'sim': 'dv/dt'}},
  ej={'C': '1 pF', 'dvdt': '1,65e9', 'i_C': '1,65 mA'}, origen='sección @sec-32.8: flanco de 3,3 V en 2 ns sobre 1 pF',
  claves='derivada condensador corriente diafonía')
F('vl-ldidt', 'Tensión en una bobina', 'cap00', ['v_("L") = L dot.op (d i)/(d t)', ('cap04', 'v = L dot.op (d i)/(d t) $'), ('cap15', 'v = L dot.op (d i)/(d t) $')],
  'v_L = L*didt',
  {'v_L': ('Tensión en la bobina', 'V', '1 µV', '10 kV'), 'L': 'Inductancia',
   'didt': {'n': 'Rapidez de cambio de la corriente', 'u': 'A/s', 'r': ('1e-3', '1e9'), 'd': '1e3', 'sim': 'di/dt'}},
  ej={'L': '10 nH', 'didt': '1e7', 'v_L': '100 mV'}, origen='sección @sec-15.6: 20 mA en 2 ns sobre 10 nH',
  claves='derivada bobina tensión autoinducción')
F('error-peor-caso', 'Propagación del error, peor caso (P = V²/R)', 'cap00', '"peor caso" ": " δ P = "2" dot.op δ V + δ R',
  'dP = 2*dV + dR',
  {'dP': {'n': 'Error relativo de la potencia', 'u': '%', 'r': ('0', '100'), 'sim': 'δP', 'lineal': True},
   'dV': {'n': 'Error relativo de la tensión', 'u': '%', 'r': ('0', '50'), 'sim': 'δV', 'lineal': True},
   'dR': {'n': 'Error relativo de la resistencia', 'u': '%', 'r': ('0', '50'), 'sim': 'δR', 'lineal': True}},
  ej={'dV': '0,9 %', 'dR': '1 %', 'dP': '2,80 %'}, claves='error incertidumbre tolerancia')
F('error-cuadratico', 'Propagación del error, suma cuadrática (P = V²/R)', 'cap00', '"cuadrático" ": " δ P = sqrt(',
  'dP = sqrt((2*dV)^2 + dR^2)',
  {'dP': {'n': 'Error relativo de la potencia', 'u': '%', 'r': ('0', '100'), 'sim': 'δP', 'lineal': True},
   'dV': {'n': 'Error relativo de la tensión', 'u': '%', 'r': ('0', '50'), 'sim': 'δV', 'lineal': True},
   'dR': {'n': 'Error relativo de la resistencia', 'u': '%', 'r': ('0', '50'), 'sim': 'δR', 'lineal': True}},
  ej={'dV': '0,9 %', 'dR': '1 %', 'dP': '2,06 %'}, claves='error incertidumbre cuadratura')
F('bode-polo', 'Módulo de un polo simple en decibelios', 'cap00', 'lr(| H |)_("dB") = - "10" dot.op op("log")_("10")',
  'H_dB = -10*log10(1 + (f/f_c)^2)',
  {'H_dB': {'n': 'Módulo de la respuesta', 'u': 'dB', 'r': ('-200', '0'), 'sim': '|H|<sub>dB</sub>', 'lineal': True},
   'f': 'Frecuencia', 'f_c': 'Frecuencia de corte del polo'},
  ej={'f': '1 kHz', 'f_c': '1 kHz', 'H_dB': '-3 dB'}, tol=0.01, origen='sección 0.4: −3 dB en la frecuencia de corte',
  claves='bode polo filtro')

# ------------------------------------------------------------------ cap01 — fundamental laws
F('ohm', 'Ley de Ohm', 'cap01', ['V = I dot.op R', 'I = (V)/(R) quad R = (V)/(I)'],
  'V = I*R', {'V': 'Tensión', 'I': 'Corriente', 'R': 'Resistencia'},
  ej={'R': '50 Ω', 'I': '180 mA', 'V': '9 V'}, origen='sección 1.10: pila de 9 V con 50 Ω en total',
  claves='ohm tensión corriente resistencia')
F('corriente-carga', 'Corriente como carga por unidad de tiempo', 'cap01', 'I = (Q)/(t)',
  'I = Q/t', {'I': 'Corriente', 'Q': ('Carga transferida', 'C', '1 pC', '1 MC'), 't': 'Tiempo'},
  ej={'Q': '3,6 C', 't': '3600 s', 'I': '1 mA'}, origen='sección 1.8: 1 mAh = 3,6 culombios',
  claves='carga culombio amperio')
F('tension-trabajo', 'Tensión como trabajo por unidad de carga', 'cap01', 'V = (W)/(Q)',
  'V = W/Q', {'V': 'Tensión', 'W': 'Trabajo (energía)', 'Q': ('Carga', 'C', '1 pC', '1 MC', '1 C')},
  claves='voltio julio culombio')
F('potencia-vi', 'Potencia eléctrica', 'cap01', ['P = V dot.op I', ('cap50', 'P_("disipada") = V_("headroom") dot.op I')], 'P = V*I',
  {'P': 'Potencia', 'V': 'Tensión', 'I': 'Corriente'}, claves='potencia vatio')
F('potencia-i2r', 'Potencia en una resistencia (I²R)', 'cap01', 'P = I^("2") dot.op R = (V^("2"))/(R)',
  'P = I^2*R', {'P': 'Potencia disipada', 'I': 'Corriente', 'R': 'Resistencia'},
  ej={'I': '79,1 mA', 'R': '100 Ω', 'P': '0,625 W'}, origen='problema 1.C', claves='potencia disipada joule')
F('potencia-v2r', 'Potencia en una resistencia (V²/R)', 'cap01', ['P = I^("2") dot.op R = (V^("2"))/(R)', ('cap41', 'quad P = (V^("2"))/(R_("t")) = "218 mW"'), ('cap51', 'P = (V_("RMS")^("2"))/(R) = (lr((')],
  'P = V^2/R', {'P': 'Potencia disipada', 'V': 'Tensión', 'R': 'Resistencia'},
  ej={'V': '31,62 V', 'R': '100 Ω', 'P': '10 W'}, origen='problema 1.C', claves='potencia disipada')
F('energia-pt', 'Energía consumida', 'cap01', 'W = P dot.op t', 'W = P*t',
  {'W': 'Energía', 'P': 'Potencia', 't': ('Tiempo', 's', '1 ms', '1e8 s')},
  ej={'P': '1000 W', 't': '3600 s', 'W': '3,6 MJ'}, claves='energía kWh julio')
F('resistencia-geometria', 'Resistencia de un conductor', 'cap01', 'R = (ρ dot.op L)/(A)', 'R = rho*l/A',
  {'R': 'Resistencia del conductor', 'rho': 'Resistividad del material',
   'l': {'n': 'Longitud del conductor', 'u': 'm', 'r': ('1 mm', '100 km'), 'sim': 'L'},
   'A': 'Sección transversal'},
  ej={'rho': '1,72e-8', 'l': '16 m', 'A': '3,82e-6', 'R': '72 mΩ'}, origen='problema 1.B',
  claves='resistividad sección cable longitud')
F('cable-seccion', 'Sección mínima de un cable por caída de tensión', 'cap01', 'A_("min") = (ρ dot.op L_("total") dot.op I)/',
  'A = rho*l*I/(p/100*V_CC)',
  {'A': ('Sección mínima', 'm²', '1e-9', '1e-2'), 'rho': 'Resistividad del conductor',
   'l': {'n': 'Longitud total (ida y vuelta)', 'u': 'm', 'r': ('1 cm', '10 km'), 'sim': 'L<sub>total</sub>'},
   'I': 'Corriente', 'p': {'n': 'Caída admisible', 'u': '%', 'r': ('0,1', '20'), 'd': '3'},
   'V_CC': 'Tensión de alimentación'},
  ej={'rho': '1,72e-8', 'l': '16 m', 'I': '5 A', 'p': '3 %', 'V_CC': '12 V', 'A': '3,82e-6'},
  claves='cable sección caída de tensión')
F('resistencia-temperatura', 'Variación de la resistencia con la temperatura', 'cap01',
  'R lr(( T )) = R_("0") dot.op lr([ "1" + α', 'R_T = R_0*(1 + alpha_T*(T - T_0))',
  {'R_T': {'n': 'Resistencia a la temperatura T', 'u': 'Ω', 'r': ('1 mΩ', '100 MΩ'), 'sim': 'R(T)'},
   'R_0': ('Resistencia a la temperatura de referencia', 'Ω', '1 mΩ', '100 MΩ'),
   'alpha_T': {'n': 'Coeficiente de temperatura', 'u': '1/°C', 'r': ('-0,1', '0,1'), 'sim': 'α', 'lineal': True},
   'T': {'n': 'Temperatura de trabajo', 'u': '°C', 'r': ('-55', '300'), 'lineal': True},
   'T_0': {'n': 'Temperatura de referencia', 'u': '°C', 'r': ('-55', '300'), 'd': '20', 'lineal': True}},
  ej={'R_0': '100 Ω', 'alpha_T': '0,00393', 'T': '100', 'T_0': '20', 'R_T': '131,44 Ω'},
  origen='deducción de la sección 1.2: cobre de 20 a 100 °C, factor 1,31440', claves='coeficiente de temperatura cobre')
F('serie-3', 'Resistencias en serie', 'cap01', 'R_("serie") = R_("1") + R_("2") + R_("3")',
  'R_serie = R_1 + R_2 + R_3', {'R_serie': ('Resistencia total', 'Ω', '1 Ω', '100 MΩ')},
  ej={'R_1': '100 Ω', 'R_2': '220 Ω', 'R_3': '470 Ω', 'R_serie': '790 Ω'}, claves='serie asociación')
F('divisor', 'Divisor de tensión', 'cap01', ['V_("salida") = V_("entrada") dot.op (R_("2"))/(R_("1") + R_("2"))', ('cap22', 'V_("out") = V_("in") dot.op (R "2")/(R "1" + R "2")')],
  'V_out = V_in*R_2/(R_1 + R_2)',
  {'V_out': 'Tensión de salida (en R₂)', 'V_in': 'Tensión de entrada', 'R_1': 'Resistencia superior R₁',
   'R_2': 'Resistencia inferior R₂'},
  ej={'V_in': '12 V', 'R_1': '10 kΩ', 'R_2': '5 kΩ', 'V_out': '4,00 V'}, claves='divisor tensión')
F('paralelo-2', 'Dos resistencias en paralelo', 'cap01', ['("1")/(R_("paralelo"))', 'R_("Th") = R "1" "∥" R "2"'],
  'R_p = par(R_1, R_2)', {'R_p': ('Resistencia equivalente', 'Ω', '0,1 Ω', '10 MΩ'), 'R_1': 'Resistencia R₁',
                          'R_2': 'Resistencia R₂'},
  ej={'R_1': '4,7 kΩ', 'R_2': '1,8 kΩ', 'R_p': '1,302 kΩ'}, origen='problema 1.A',
  claves='paralelo asociación thevenin')
F('error-carga-divisor', 'Error por carga de un divisor', 'cap01', '"error relativo" = - (R_("Th"))/(R_("L") + R_("Th"))',
  'e = -100*R_Th/(R_L + R_Th)',
  {'e': {'n': 'Error relativo por la carga', 'u': '%', 'r': ('-100', '0'), 'lineal': True},
   'R_Th': 'Resistencia de Thévenin del divisor (R₁‖R₂)', 'R_L': 'Resistencia de carga'},
  ej={'R_Th': '1302 Ω', 'R_L': '47 kΩ', 'e': '-2,69 %'}, claves='divisor carga error thevenin')
F('divisor-cargado', 'Divisor de tensión con carga', 'cap01', 'V = V_("0") dot.op (R_("L"))/(R_("L") + R_("Th"))',
  'V = V_0*R_L/(R_L + R_Th)',
  {'V': 'Tensión en la carga', 'V_0': ('Tensión del divisor en vacío', 'V', '1 mV', '1 kV', '5 V'),
   'R_L': 'Resistencia de carga', 'R_Th': 'Resistencia de Thévenin del divisor'},
  ej={'V_0': '3,3231 V', 'R_L': '47 kΩ', 'R_Th': '1302 Ω', 'V': '3,233 V'}, tol=0.002,
  origen='problema 1.A: la carga «se lleva 90 mV» de 3,3231 V', claves='divisor carga')
F('fuente-real', 'Tensión en bornes de una fuente real', 'cap01', 'V_("bornes") = V_("vacío") - I dot.op R_("int")',
  'V_b = V_0 - I*R_int',
  {'V_b': ('Tensión en bornes', 'V', '0 V', '1 kV'), 'V_0': ('Tensión en vacío (fem)', 'V', '1 mV', '1 kV'),
   'I': 'Corriente entregada', 'R_int': ('Resistencia interna', 'Ω', '1 mΩ', '10 kΩ')},
  ej={'V_0': '9 V', 'I': '180 mA', 'R_int': '5 Ω', 'V_b': '8,1 V'}, claves='resistencia interna pila fem')
F('regulacion-carga', 'Regulación de carga', 'cap01', ['"Regulación" space lr(( \\% )) = "100"', ('cap50', '"reg"_("carga") = (V_("vacío") - V_("carga"))/(V_("carga"))')],
  'Reg = 100*(V_0 - V_c)/V_c',
  {'Reg': {'n': 'Regulación de carga', 'u': '%', 'r': ('0', '100'), 'lineal': True},
   'V_0': ('Tensión en vacío', 'V', '1 mV', '1 kV'), 'V_c': ('Tensión a plena carga', 'V', '1 mV', '1 kV')},
  ej={'V_0': '9 V', 'V_c': '8,1 V', 'Reg': '11,1 %'}, claves='regulación fuente')
F('f0-lc', 'Frecuencia de resonancia LC', 'cap01', ['f_("0") = ("1")/("2" π dot.op sqrt(L dot.op C))', ('cap15', 'f = ("1")/("2" π sqrt(L dot.op C)) = "4,11 MHz"'), ('cap22', 'f_("0") = ("1")/("2" π dot.op sqrt(L C)) = "5 033 Hz"'), ('cap24', 'f_("0") = ("1")/("2" π dot.op sqrt(L dot.op C))'), ('cap33', 'f_("LC") = ("1")/("2" π dot.op sqrt(L dot.op C))'), ('cap41', 'f_("ar") = (1)/(2 π sqrt("2 nH" times "0,99 nF"))')],
  'f_0 = 1/(2*pi*sqrt(L*C))', {'f_0': 'Frecuencia de resonancia', 'L': 'Inductancia', 'C': 'Capacidad'},
  ej={'L': '100 µH', 'C': '100 pF', 'f_0': '1,592 MHz'}, claves='resonancia tanque LC sintonía')
F('profundidad-pelicular', 'Profundidad de penetración (efecto pelicular)', 'cap01', 'δ = sqrt((ρ)/(π dot.op f dot.op µ))',
  'delta = sqrt(rho/(pi*f*mu_r*mu_0))',
  {'delta': ('Profundidad de penetración', 'm', '10 nm', '1 m'), 'rho': 'Resistividad del conductor',
   'f': 'Frecuencia', 'mu_r': {'n': 'Permeabilidad relativa', 'u': '', 'r': ('1', '1e5'), 'd': '1', 'sim': 'µ<sub>r</sub>'}},
  ej={'rho': '1,72e-8', 'f': '50 Hz', 'mu_r': '1', 'delta': '9,33 mm'}, claves='efecto pelicular skin litz')
F('rac-rdc', 'Aumento de la resistencia por efecto pelicular', 'cap01', '(R_("ac"))/(R_("dc")) approx (a)/("2" dot.op δ)',
  'k_ac = a/(2*delta)',
  {'k_ac': {'n': 'Relación R_ac/R_dc', 'u': '', 'r': ('1', '1e4'), 'sim': 'R<sub>ac</sub>/R<sub>dc</sub>'},
   'a': ('Radio del conductor', 'm', '1 µm', '10 cm'), 'delta': ('Profundidad de penetración', 'm', '10 nm', '1 m')},
  ej={'a': '0,5 mm', 'delta': '66,0 µm', 'k_ac': '3,79'}, origen='tabla de la sección 1.14', claves='efecto pelicular')
F('bateria-energia', 'Energía de una batería', 'cap01', 'E = "2 Ah" times "1,5 V"',
  'E = Q_Ah*3600*V',
  {'E': 'Energía almacenada', 'Q_Ah': {'n': 'Capacidad de la batería', 'u': 'Ah', 'r': ('1 mAh', '1000 Ah'), 'd': '2 Ah',
                                       'sim': 'Q'},
   'V': 'Tensión nominal'},
  ej={'Q_Ah': '2 Ah', 'V': '1,5 V', 'E': '10 800 J'}, claves='batería mAh autonomía')
F('carga-matriz', 'Potencia por resistencia en una matriz n × n', 'cap01', 'P_("r") = lr(( (I)/(n) ))^("2") dot.op R',
  'P_r = I^2*R/n^2',
  {'P_r': ('Potencia en cada resistencia', 'W', '1 mW', '1 kW'), 'I': 'Corriente total', 'R': 'Resistencia de cada elemento',
   'n': {'n': 'Resistencias por rama (n × n)', 'u': '', 'r': ('1', '20'), 'entero': True}},
  ej={'I': '316 mA', 'R': '100 Ω', 'n': '4', 'P_r': '0,625 W'}, origen='problema 1.C', claves='carga de potencia')

# ------------------------------------------------------------------ cap02 — resistors
F('ruido-termico', 'Ruido térmico de una resistencia (Johnson-Nyquist)', 'cap02',
  [('cap32', 'V_(n) = sqrt("4" dot.op k dot.op T dot.op R dot.op B)'), ('cap27', 'v_(n) = sqrt("4" dot.op k dot.op T dot.op R_("f") dot.op B)'), 'v_("ruido") = sqrt("4" dot.op k dot.op T dot.op R dot.op B)', 'V_("ruido") = sqrt("4" dot.op k dot.op T dot.op R dot.op B)'],
  'v_n = sqrt(4*k_B*T_K*R*B)',
  {'v_n': ('Tensión de ruido eficaz', 'V', '1 pV', '1 mV'), 'T_K': 'Temperatura absoluta', 'R': 'Resistencia',
   'B': ('Ancho de banda', 'Hz', '1 Hz', '10 GHz', '20 kHz')},
  ej={'T_K': '300', 'R': '1 kΩ', 'B': '20 kHz', 'v_n': '0,58 µV'}, claves='ruido johnson nyquist térmico kTRB')
F('densidad-ruido-termico', 'Densidad de ruido térmico', 'cap02', ['v_(n) = sqrt("4" dot.op k dot.op T dot.op R) quad', ('cap32', 'e_("R") = sqrt("4" dot.op k dot.op T dot.op R)')],
  'e_n = sqrt(4*k_B*T_K*R)',
  {'e_n': ('Densidad espectral de ruido', 'V/√Hz', '1e-12', '1e-6'), 'T_K': 'Temperatura absoluta', 'R': 'Resistencia'},
  ej={'T_K': '300', 'R': '10 kΩ', 'e_n': '12,87 nV/√Hz'}, claves='ruido densidad nV/√Hz')
F('ruido-disparo', 'Densidad de ruido de disparo (shot)', 'cap02', 'i_(n) = sqrt("2" dot.op q dot.op I)',
  'i_n = sqrt(2*q_e*I)',
  {'i_n': ('Densidad de ruido de corriente', 'A/√Hz', '1e-15', '1e-9'), 'I': 'Corriente continua por la unión'},
  ej={'I': '1 mA', 'i_n': '17,90 pA/√Hz'}, claves='ruido disparo shot schottky')
F('ruido-flicker', 'Ruido 1/f con frecuencia de esquina', 'cap02', 'v_(n) lr(( f )) = v_("blanco") dot.op sqrt(',
  'e_n = e_w*sqrt(1 + f_c/f)',
  {'e_n': ('Densidad de ruido total a la frecuencia f', 'V/√Hz', '1e-12', '1e-3'),
   'e_w': ('Densidad del ruido blanco (suelo)', 'V/√Hz', '1e-12', '1e-5', '4e-9'),
   'f_c': ('Frecuencia de esquina 1/f', 'Hz', '0,01 Hz', '1 MHz', '1 kHz'), 'f': 'Frecuencia'},
  ej={'e_w': '4 nV/√Hz', 'f_c': '1 kHz', 'f': '10 Hz', 'e_n': '40,2 nV/√Hz'}, claves='ruido flicker 1/f esquina')
F('ruido-suma', 'Suma de ruidos independientes (en cuadratura)', 'cap02', ['v_("total") = sqrt(v_("1")^("2") + v_("2")^("2")', ('cap32', 'V_("total") = sqrt(V_("1")^("2") + V_("2")^("2")')],
  'v_t = sqrt(v_1^2 + v_2^2 + v_3^2)',
  {'v_t': ('Ruido total', 'V', '0 V', '1 V'), 'v_1': ('Ruido de la fuente 1', 'V', '0 V', '1 V', '1 µV'),
   'v_2': ('Ruido de la fuente 2', 'V', '0 V', '1 V', '1 µV'), 'v_3': ('Ruido de la fuente 3', 'V', '0 V', '1 V', '0 V')},
  claves='ruido cuadratura rss suma')
F('rss-errores', 'Combinación estadística (RSS) de dos errores', 'cap02', '"RSS" ": " sqrt("0,79"^("2") + "1,41"^("2"))',
  'e = sqrt(e_1^2 + e_2^2)',
  {'e': ('Error combinado', '%', '0', '100'), 'e_1': ('Primer error', '%', '0', '50'), 'e_2': ('Segundo error', '%', '0', '50')},
  ej={'e_1': '0,79 %', 'e_2': '1,41 %', 'e': '1,62 %'}, claves='rss tolerancia cuadratura')
F('tcr', 'Resistencia con su coeficiente de temperatura (TCR)', 'cap02', '"1" + "TCR" dot.op "Δ" "T" times "10"^(- "6")',
  'R_T = R_0*(1 + TCR*dT*1e-6)',
  {'R_T': {'n': 'Resistencia a la nueva temperatura', 'u': 'Ω', 'r': ('1 mΩ', '100 MΩ'), 'sim': 'R(T)'},
   'R_0': ('Resistencia nominal', 'Ω', '1 mΩ', '100 MΩ'),
   'TCR': ('Coeficiente de temperatura', 'ppm/°C', '-2000', '2000', '100'),
   'dT': {'n': 'Incremento de temperatura', 'u': '°C', 'r': ('-100', '200'), 'sim': 'ΔT', 'lineal': True}},
  ej={'R_0': '10 kΩ', 'TCR': '100', 'dT': '50', 'R_T': '10 050 Ω'}, origen='sección 2.3', claves='tcr ppm deriva térmica')
F('ntc-beta', 'Termistor NTC (ecuación B)', 'cap02', 'R lr(( T )) = R_("25") dot.op op("exp")',
  'R_T = R_25*exp(B_NTC*(1/(T + 273.15) - 1/(T_25 + 273.15)))',
  {'R_T': {'n': 'Resistencia a la temperatura T', 'u': 'Ω', 'r': ('1 Ω', '100 MΩ'), 'sim': 'R(T)'},
   'R_25': ('Resistencia a 25 °C', 'Ω', '10 Ω', '10 MΩ', '10 kΩ'),
   'B_NTC': {'n': 'Constante B del termistor', 'u': 'K', 'r': ('1000', '6000'), 'd': '3950', 'sim': 'B'},
   'T': {'n': 'Temperatura', 'u': '°C', 'r': ('-55', '200'), 'd': '50', 'lineal': True},
   'T_25': {'n': 'Temperatura de referencia', 'u': '°C', 'r': ('0', '100'), 'd': '25', 'lineal': True, 'sim': 'T<sub>25</sub>'}},
  claves='ntc termistor beta temperatura')
F('wheatstone-salida', 'Salida de un puente de Wheatstone ligeramente desequilibrado', 'cap02',
  'V_("out") approx (V_("exc"))/("4") dot.op ("Δ" R)/(R)', 'V_out = V_exc/4*dR/R',
  {'V_out': ('Tensión de desequilibrio', 'V', '1 nV', '10 V'), 'V_exc': ('Tensión de excitación', 'V', '0,1 V', '50 V', '5 V'),
   'dR': {'n': 'Variación de la resistencia', 'u': 'Ω', 'r': ('1 mΩ', '1 MΩ'), 'sim': 'ΔR'}, 'R': 'Resistencia de las ramas'},
  ej={'V_exc': '5 V', 'dR': '1 Ω', 'R': '1 kΩ', 'V_out': '1,2500 mV'}, claves='wheatstone galga puente sensor')
F('parasito-l', 'Frecuencia desde la que domina la inductancia parásita', 'cap02', '"la inductancia importa a partir de" space f',
  'f = R/(2*pi*L)', {'f': 'Frecuencia a partir de la cual domina L', 'R': 'Resistencia', 'L': ('Inductancia parásita', 'H', '0,1 nH', '1 µH', '10 nH')},
  ej={'R': '100 Ω', 'L': '10 nH', 'f': '1,6 GHz'}, tol=0.02, claves='parásito inductancia resistencia alta frecuencia')
F('parasito-c', 'Frecuencia desde la que domina la capacidad parásita', 'cap02', '"la capacidad importa a partir de" space f',
  'f = 1/(2*pi*R*C)', {'f': 'Frecuencia a partir de la cual domina C', 'R': 'Resistencia',
                       'C': ('Capacidad parásita', 'F', '0,01 pF', '100 pF', '0,3 pF')},
  ej={'R': '1 MΩ', 'C': '0,3 pF', 'f': '0,53 MHz'}, claves='parásito capacidad resistencia alta frecuencia')
F('error-divisor-tol', 'Error relativo de un divisor por las tolerancias', 'cap02',
  '("Δ" k)/(k) = S_("1") dot.op δ_("1") + S_("2") dot.op δ_("2")', 'dk = (1 - k)*(d_2 - d_1)',
  {'dk': {'n': 'Error relativo de la relación del divisor', 'u': '%', 'r': ('-50', '50'), 'sim': 'Δk/k', 'lineal': True},
   'k': {'n': 'Relación del divisor R₂/(R₁+R₂)', 'u': '', 'r': ('0', '1'), 'd': '0,5', 'lineal': True},
   'd_1': {'n': 'Desviación relativa de R₁', 'u': '%', 'r': ('-20', '20'), 'd': '-1', 'sim': 'δ<sub>1</sub>', 'lineal': True},
   'd_2': {'n': 'Desviación relativa de R₂', 'u': '%', 'r': ('-20', '20'), 'd': '1', 'sim': 'δ<sub>2</sub>', 'lineal': True}},
  claves='divisor tolerancia sensibilidad')
F('shunt', 'Resistencia de un shunt de medida', 'cap02', ['R_("sh") = (V_("sh"))/(I_(op("max")))', ('cap50', '"Rsense" = ("Vumbral")/("Ilímite")')],
  'R_sh = V_sh/I_max',
  {'R_sh': ('Resistencia del shunt', 'Ω', '0,1 mΩ', '100 Ω'), 'V_sh': ('Tensión en el shunt a fondo de escala', 'V', '1 mV', '1 V', '50 mV'),
   'I_max': ('Corriente máxima', 'A', '1 mA', '1 kA', '10 A')},
  ej={'V_sh': '50 mV', 'I_max': '10 A', 'R_sh': '5 mΩ'}, claves='shunt medida de corriente')
F('shunt-error-termico', 'Error de un shunt por autocalentamiento', 'cap02', '"Δ" T = P dot.op R_("th") arrow.r ("Δ" R)/(R) = "TCR"',
  'e = TCR*1e-6*R_th*I^2*R_sh*100',
  {'e': ('Error relativo de la medida', '%', '0', '100'), 'TCR': ('Coeficiente de temperatura del shunt', 'ppm/°C', '1', '1000', '50'),
   'R_th': 'Resistencia térmica del shunt a la placa', 'I': ('Corriente medida', 'A', '1 mA', '1 kA', '10 A'),
   'R_sh': ('Resistencia del shunt', 'Ω', '0,1 mΩ', '100 Ω', '5 mΩ')},
  claves='shunt error temperatura tcr')
F('db-a-relacion', 'Relación de tensiones a partir de los decibelios', 'cap02', ['G = "10"^(("10")', ('cap45', '("300")/("50") = "6" space "veces" = "15,6 dB"')],
  'G = 10^(G_dB/20)', {'G': ('Ganancia (relación de tensiones)', 'V/V', '1e-6', '1e6'), 'G_dB': 'Ganancia en dB'},
  ej={'G_dB': '10', 'G': '3,1623'}, tol=0.001, claves='decibelio relación ganancia')

# ------------------------------------------------------------------ cap03 — capacitors
F('capacidad-placas', 'Capacidad de un condensador de placas paralelas', 'cap03',
  ['C = ε_("0") dot.op ε_("r") dot.op (A)/(d)', 'C = (ε_("0") dot.op ε_("r") dot.op A)/(d)'],
  'C = eps_0*eps_r*A/d',
  {'C': 'Capacidad', 'eps_r': {'n': 'Permitividad relativa del dieléctrico', 'u': '', 'r': ('1', '20000'), 'd': '1',
                              'sim': 'ε<sub>r</sub>'},
   'A': ('Área de las placas', 'm²', '1e-10', '10'), 'd': ('Separación entre placas', 'm', '1 nm', '1 cm')},
  ej={'eps_r': '1', 'A': '1e-4', 'd': '10 µm', 'C': '88,5 pF'}, claves='capacidad permitividad dieléctrico placas')
F('energia-condensador', 'Energía almacenada en un condensador', 'cap03', ['E = "½" dot.op C dot.op V^("2")', ('cap10', '"energía en la resistencia" = "½" dot.op C'), ('cap10', 'E = "½" times "470e-6" times "325"'), ('cap10', 'E = "½" dot.op C dot.op V^("2") = "½" times "4700 µF"'), ('cap04', 'E = "½" dot.op C dot.op V^("2") $')],
  'E = 0.5*C*V^2', {'E': 'Energía almacenada', 'C': 'Capacidad', 'V': 'Tensión'},
  ej={'C': '470 µF', 'V': '400 V', 'E': '38 J'}, claves='energía condensador')
F('carga-cv', 'Carga de un condensador', 'cap03', 'q = C dot.op V quad i = C dot.op (d V)/(d t)',
  'q = C*V', {'q': 'Carga almacenada', 'C': 'Capacidad', 'V': 'Tensión'}, claves='carga capacidad culombio')
F('carga-rc-vcc', 'Carga de un condensador a través de R', 'cap03', 'v_("C") lr(( t )) = V_("CC") dot.op lr(( "1" - "e"^',
  'v_C = V_CC*(1 - exp(-t/(R*C)))',
  {'v_C': ('Tensión en el condensador en el instante t', 'V', '0 V', '1 kV'), 'V_CC': 'Tensión de la fuente',
   't': 'Tiempo transcurrido', 'R': 'Resistencia de carga', 'C': 'Capacidad'},
  ej={'V_CC': '10 V', 't': '1 ms', 'R': '10 kΩ', 'C': '100 nF', 'v_C': '6,32 V'},
  origen='sección 3.2: el 63,2 % en una constante de tiempo', claves='carga condensador rc exponencial')
F('descarga-rc-rc', 'Descarga de un condensador a través de R', 'cap03', 'v_("C") lr(( t )) = V_("0") dot.op "e"^',
  'v_C = V_0*exp(-t/(R*C))',
  {'v_C': ('Tensión en el condensador en el instante t', 'V', '0 V', '1 kV'), 'V_0': ('Tensión inicial', 'V', '1 mV', '1 kV', '10 V'),
   't': 'Tiempo transcurrido', 'R': 'Resistencia de descarga', 'C': 'Capacidad'},
  ej={'V_0': '10 V', 't': '1 ms', 'R': '10 kΩ', 'C': '100 nF', 'v_C': '3,68 V'},
  origen='sección 3.2: pierde el 63,2 % en una constante de tiempo', claves='descarga condensador rc')
F('reactancia-capacitiva', 'Reactancia capacitiva', 'cap03', ['X_("C") = ("1")/("2" π dot.op f dot.op C)', 'X_("C") = ("1")/("2" π f C)', ('cap24', 'X_("C") = ("1")/("2" π dot.op "1000" dot.op "100" n)')],
  'X_C = 1/(2*pi*f*C)', {'X_C': 'Reactancia capacitiva', 'f': 'Frecuencia', 'C': 'Capacidad'},
  ej={'f': '1 kHz', 'C': '100 nF', 'X_C': '1592 Ω'}, origen='sección @sec-24.4',
  claves='reactancia condensador impedancia')
F('reactancia-inductiva', 'Reactancia inductiva', 'cap24', 'Z_("R") = R quad Z_("L") = j ω L quad Z_("C")',
  'X_L = 2*pi*f*L', {'X_L': 'Reactancia inductiva', 'f': 'Frecuencia', 'L': 'Inductancia'},
  ej={'f': '1 kHz', 'L': '10 mH', 'X_L': '62,8 Ω'}, origen='tabla de la sección 4.3', claves='reactancia bobina impedancia')
F('autorresonancia', 'Autorresonancia de un condensador', 'cap03',
  ['f_("SRF") = ("1")/("2" π dot.op sqrt("ESL" dot.op C))', 'f_("res") = ("1")/("2" π dot.op sqrt(L dot.op C))',
   'f_("res") = ("1")/("2" π dot.op sqrt("0,8 nH" times "100 nF"))', 'f_("res") = ("1")/("2" π dot.op sqrt("0,8 nH" times "1 nF"))'],
  'f_SRF = 1/(2*pi*sqrt(ESL*C))',
  {'f_SRF': ('Frecuencia de autorresonancia', 'Hz', '1 kHz', '100 GHz'), 'ESL': ('Inductancia serie equivalente (ESL)', 'H', '0,05 nH', '1 µH', '1 nH'),
   'C': 'Capacidad'},
  ej={'ESL': '0,8 nH', 'C': '100 nF', 'f_SRF': '17,8 MHz'}, origen='problema 3.A', claves='autorresonancia esl desacoplo')
F('rizado-esr', 'Rizado debido a la ESR', 'cap03', '"Δ" V approx "Δ" I dot.op "ESR"',
  'dV = dI*ESR',
  {'dV': ('Rizado de tensión', 'V', '1 µV', '100 V'), 'dI': ('Rizado de corriente', 'A', '1 mA', '100 A', '0,6 A'),
   'ESR': ('Resistencia serie equivalente (ESR)', 'Ω', '1 mΩ', '100 Ω', '0,1 Ω')},
  ej={'dI': '0,6 A', 'ESR': '0,5 Ω', 'dV': '300 mV'}, claves='esr rizado conmutada')
F('fc-rc', 'Frecuencia de corte de un filtro RC', 'cap03', ['f_("c") = ("1")/("2" π dot.op R dot.op C)', ('cap27', 'f_("z") = ("1")/("2" π dot.op R_("f") dot.op C_("in"))'), ('cap27', '"BW" = ("1")/("2" π dot.op R_("f") dot.op C_("f")) = "362 kHz"'), ('cap22', 'f_("c") = ("1")/("2" π dot.op R dot.op C) = ("1")/("2" π times "1600"')],
  'f_c = 1/(2*pi*R*C)', {'f_c': 'Frecuencia de corte (−3 dB)', 'R': 'Resistencia', 'C': 'Capacidad'},
  ej={'R': '10 kΩ', 'C': '100 nF', 'f_c': '159,15 Hz'}, tol=0.001, claves='filtro rc corte paso bajo paso alto')
F('impedancia-condensador-real', 'Impedancia de un condensador real (ESR, ESL)', 'cap03',
  'Z lr(( f )) = sqrt("ESR"^("2") + lr(( ω dot.op L_("esl")',
  'Z = sqrt(ESR^2 + (2*pi*f*ESL - 1/(2*pi*f*C))^2)',
  {'Z': 'Módulo de la impedancia', 'ESR': ('Resistencia serie equivalente (ESR)', 'Ω', '1 mΩ', '100 Ω', '0,1 Ω'),
   'f': 'Frecuencia', 'ESL': ('Inductancia serie equivalente (ESL)', 'H', '0,05 nH', '1 µH', '1 nH'), 'C': 'Capacidad'},
  ej={'ESR': '0,2 Ω', 'f': '10 MHz', 'ESL': '10 nH', 'C': '100 µF', 'Z': '0,66 Ω'},
  origen='sección 3.5: electrolítico de 100 µF, 0,66 Ω a 10 MHz', claves='esr esl impedancia condensador real')
F('vida-electrolitico', 'Vida de un electrolítico (regla de Arrhenius)', 'cap03', '"Vida" = "Vida"_("nominal") times "2"^',
  'L_h = L_nom*2^((T_max - T_real)/10)',
  {'L_h': ('Vida estimada', 'h', '100', '1e7'), 'L_nom': ('Vida nominal', 'h', '100', '1e5', '2000'),
   'T_max': {'n': 'Temperatura máxima nominal', 'u': '°C', 'r': ('70', '150'), 'd': '105', 'lineal': True},
   'T_real': {'n': 'Temperatura de trabajo', 'u': '°C', 'r': ('-40', '150'), 'd': '45', 'lineal': True}},
  ej={'L_nom': '2000', 'T_max': '105', 'T_real': '45', 'L_h': '128 000'}, claves='vida electrolítico arrhenius temperatura')
F('descarga-lineal', 'Caída de tensión de un condensador con corriente constante', 'cap03',
  ['"Δ" V = (I dot.op "Δ" t)/(C)', ('cap50', '"Δ" V = "Δ" I dot.op (t_("respuesta"))/(C_("out"))'), ('cap50', 'C = I dot.op ("Δ" t)/("Δ" V)')], 'dV = I*dt/C',
  {'dV': ('Caída de tensión (rizado)', 'V', '1 µV', '1 kV'), 'I': 'Corriente de carga',
   'dt': {'n': 'Tiempo de descarga', 'u': 's', 'r': ('1 µs', '10 s'), 'sim': 'Δt'}, 'C': 'Capacidad'},
  ej={'I': '0,5 A', 'dt': '10 ms', 'C': '4700 µF', 'dV': '1,064 V'}, origen='problema 3.B', claves='rizado descarga condensador')
F('rizado-tcond', 'Rizado descontando el tiempo de recarga', 'cap03', '"Δ" V = (I dot.op lr(( (T)/("2") - t_("cond") )))/(C)',
  'dV = I*(T/2 - t_cond)/C',
  {'dV': ('Rizado', 'V', '1 µV', '1 kV'), 'I': 'Corriente de carga', 'T': ('Periodo de la red', 's', '1 ms', '100 ms', '20 ms'),
   't_cond': ('Tiempo de conducción de los diodos', 's', '1 µs', '10 ms', '1 ms'), 'C': 'Capacidad'},
  ej={'I': '0,5 A', 'T': '20 ms', 't_cond': '1,115 ms', 'C': '4700 µF', 'dV': '0,945 V'}, claves='rizado rectificador')
F('tiempo-conduccion', 'Tiempo de conducción de un rectificador con condensador', 'cap03', 'op("cos") θ = (V_("min"))/(V_("p"))',
  't_cond = acos(V_min/V_p)/(2*pi*f)',
  {'t_cond': ('Tiempo de conducción', 's', '1 µs', '10 ms'), 'V_min': ('Tensión mínima del condensador', 'V', '0,1 V', '1 kV', '14,63 V'),
   'V_p': ('Tensión de pico rectificada', 'V', '0,1 V', '1 kV', '15,57 V'), 'f': ('Frecuencia de la red', 'Hz', '1 Hz', '1 kHz', '50 Hz')},
  ej={'V_min': '14,63 V', 'V_p': '15,57 V', 'f': '50 Hz', 't_cond': '1,115 ms'}, claves='conducción ángulo rectificador')
F('pico-puente', 'Tensión de pico tras un puente rectificador', 'cap03', 'V_("p") = "12" dot.op sqrt("2") - "1,4"',
  'V_p = V_RMS*sqrt(2) - V_D',
  {'V_p': ('Tensión de pico tras el puente', 'V', '0 V', '1 kV'), 'V_RMS': ('Tensión eficaz del secundario', 'V', '1 V', '1 kV', '12 V'),
   'V_D': ('Caída de los diodos que conducen', 'V', '0 V', '5 V', '1,4 V')},
  ej={'V_RMS': '12 V', 'V_D': '1,4 V', 'V_p': '15,57 V'}, claves='puente rectificador pico')
F('rizado-buck', 'Rizado de salida de un reductor (por capacidad)', 'cap03',
  ['"Δ" V = ("Δ" I_("L"))/("8" dot.op f_("sw") dot.op C)', ('cap33', '"Δ" V = ("Δ" I_("L"))/("8" dot.op f dot.op C)')], 'dV = dI_L/(8*f_sw*C)',
  {'dV': ('Rizado de salida', 'V', '1 µV', '10 V'), 'dI_L': {'n': 'Rizado de corriente de la bobina', 'u': 'A', 'r': ('1 mA', '100 A'), 'sim': 'ΔI<sub>L</sub>'},
   'f_sw': ('Frecuencia de conmutación', 'Hz', '1 kHz', '10 MHz', '500 kHz'), 'C': 'Capacidad de salida'},
  ej={'dI_L': '90 mA', 'f_sw': '500 kHz', 'C': '10 µF', 'dV': '2,25 mV'}, origen='problema 3.C', claves='buck reductor rizado mlcc')

# ------------------------------------------------------------------ cap04 — inductors
F('inductancia-solenoide', 'Inductancia de un solenoide largo', 'cap04', 'L = µ_("0") dot.op µ_("r") dot.op N^("2") dot.op (A)/(l)',
  'L = mu_0*mu_r*N^2*A/l',
  {'L': 'Inductancia', 'mu_r': {'n': 'Permeabilidad relativa del núcleo', 'u': '', 'r': ('1', '1e5'), 'd': '1', 'sim': 'µ<sub>r</sub>'},
   'N': 'Número de espiras', 'A': ('Sección del núcleo', 'm²', '1e-8', '0,1'), 'l': ('Longitud del solenoide', 'm', '1 mm', '10 m')},
  ej={'mu_r': '1', 'N': '100', 'A': '1e-4', 'l': '5 cm', 'L': '25,1 µH'}, claves='solenoide bobina espiras núcleo')
F('energia-bobina', 'Energía almacenada en una bobina', 'cap04', ['E = "½" dot.op L dot.op I^("2")', ('cap33', 'E = "½" dot.op L_("p") dot.op I_("pico")^("2")'), ('cap33', 'E = "½" times "556e-6" times "1,24"^("2")'), ('cap33', 'E_("disp") = "½" dot.op L_("disp")')],
  'E = 0.5*L*I^2', {'E': 'Energía almacenada', 'L': 'Inductancia', 'I': 'Corriente'},
  ej={'L': '10 mH', 'I': '2 A', 'E': '20 mJ'}, claves='energía bobina campo magnético')
F('corriente-rl', 'Establecimiento de la corriente en un RL', 'cap04', 'i lr(( t )) = (V)/(R) dot.op lr(( "1" - "e"^',
  'i_L = V/R*(1 - exp(-t*R/L))',
  {'i_L': ('Corriente en el instante t', 'A', '0 A', '100 A'), 'V': 'Tensión aplicada', 'R': 'Resistencia del circuito',
   't': 'Tiempo transcurrido', 'L': 'Inductancia'},
  ej={'V': '10 V', 'R': '100 Ω', 'L': '10 mH', 't': '100 µs', 'i_L': '63,2 mA'}, origen='sección 4.3: τ = 100 µs con 10 mH y 100 Ω',
  claves='rl transitorio bobina corriente')
F('tau-rl', 'Constante de tiempo RL', 'cap04', '"con" quad τ = (L)/(R)', 'tau = L/R',
  {'tau': 'Constante de tiempo', 'L': 'Inductancia', 'R': 'Resistencia'},
  ej={'L': '10 mH', 'R': '100 Ω', 'tau': '100 µs'}, claves='constante de tiempo rl')
F('sobretension-inductiva', 'Sobretensión al cortar la corriente de una bobina', 'cap04', 'v = L dot.op ("Δ" I)/("Δ" t)',
  'v = L*dI/dt',
  {'v': ('Tensión inducida', 'V', '1 mV', '1 MV'), 'L': 'Inductancia',
   'dI': {'n': 'Variación de corriente', 'u': 'A', 'r': ('1 µA', '100 A'), 'sim': 'ΔI'},
   'dt': {'n': 'Tiempo en que se produce', 'u': 's', 'r': ('1 ns', '1 s'), 'sim': 'Δt'}},
  ej={'L': '100 mH', 'dI': '0,1 A', 'dt': '1 µs', 'v': '10 000 V'}, claves='pico inductivo relé diodo libre circulación')
F('transformador-tension', 'Relación de tensiones de un transformador', 'cap04',
  ['(V_("1"))/(V_("2")) = (N_("1"))/(N_("2"))'],
  'V_2 = V_1*N_2/N_1',
  {'V_2': ('Tensión del secundario', 'V', '1 mV', '100 kV'), 'V_1': ('Tensión del primario', 'V', '1 mV', '100 kV', '230 V'),
   'N_1': ('Espiras del primario', 'espiras', '1', '1e5', '1000'), 'N_2': ('Espiras del secundario', 'espiras', '1', '1e5', '110')},
  ej={'V_1': '230 V', 'N_1': '1000', 'N_2': '110', 'V_2': '25,30 V'}, origen='problema 4.B', claves='transformador relación de espiras')
F('transformador-corriente', 'Relación de corrientes de un transformador ideal', 'cap04', '(I_("1"))/(I_("2")) = (N_("2"))/(N_("1"))',
  'I_1 = I_2*N_2/N_1',
  {'I_1': ('Corriente del primario', 'A', '1 µA', '1 kA'), 'I_2': ('Corriente del secundario', 'A', '1 µA', '1 kA', '1 A'),
   'N_1': ('Espiras del primario', 'espiras', '1', '1e5', '1000'), 'N_2': ('Espiras del secundario', 'espiras', '1', '1e5', '110')},
  claves='transformador corriente')
F('rizado-bobina-buck', 'Rizado de corriente en la bobina de un reductor', 'cap04',
  ['"Δ" I_("L") = (lr(( V_("in") - V_("out") )) dot.op D)/(L dot.op f)', ('cap33', '"Δ" I_("L") = (lr(( V_("in") - V_("out") )) dot.op D)/(L dot.op f)'), ('cap33', 'L = lr(( V_("in") - V_("out") )) dot.op (D)/(f dot.op "Δ" I)'), ('cap33', 'L = (lr(( "24" - "12" )) dot.op "0,5")')], 'dI_L = (V_in - V_out)*(V_out/V_in)/(L*f_sw)',
  {'dI_L': {'n': 'Rizado de corriente pico a pico', 'u': 'A', 'r': ('1 mA', '100 A'), 'sim': 'ΔI<sub>L</sub>'},
   'V_in': ('Tensión de entrada', 'V', '1 V', '1 kV', '12 V'), 'V_out': ('Tensión de salida', 'V', '0,5 V', '1 kV', '5 V'),
   'L': 'Inductancia', 'f_sw': ('Frecuencia de conmutación', 'Hz', '1 kHz', '10 MHz', '100 kHz')},
  ej={'V_in': '12 V', 'V_out': '5 V', 'L': '100 µH', 'f_sw': '100 kHz', 'dI_L': '292 mA'}, origen='problema 4.A',
  claves='buck reductor rizado bobina')
F('corriente-pico-bobina', 'Corriente de pico en la bobina', 'cap04', 'I_("pico") = I_("carga") + ("Δ" I_("L"))/("2")',
  'I_pk = I_o + dI_L/2',
  {'I_pk': ('Corriente de pico', 'A', '1 mA', '1 kA'), 'I_o': ('Corriente de carga (media)', 'A', '1 mA', '1 kA', '1,5 A'),
   'dI_L': {'n': 'Rizado de corriente pico a pico', 'u': 'A', 'r': ('0 A', '100 A'), 'sim': 'ΔI<sub>L</sub>', 'd': '0,3 A'}},
  ej={'I_o': '1,5 A', 'dI_L': '292 mA', 'I_pk': '1,646 A'}, claves='saturación bobina pico')
F('rendimiento-max-trafo', 'Carga de máximo rendimiento de un transformador', 'cap04',
  '"fracción" = sqrt((P_("hierro"))/(P_("cobre"))', 'x = 100*sqrt(P_Fe/P_Cu)',
  {'x': ('Fracción de la carga nominal', '%', '1', '200'), 'P_Fe': ('Pérdidas en el hierro', 'W', '1 mW', '10 kW', '1,2 W'),
   'P_Cu': ('Pérdidas en el cobre a plena carga', 'W', '1 mW', '10 kW', '4,1 W')},
  ej={'P_Fe': '1,2 W', 'P_Cu': '4,1 W', 'x': '54 %'}, claves='transformador rendimiento pérdidas')
F('extincion-bobina', 'Tiempo de extinción de la corriente de una bobina', 'cap04', 't = (L)/(R) dot.op ln lr(( "1" + (I dot.op R)',
  't = L/R*ln(1 + I*R/V_x)',
  {'t': 'Tiempo hasta corriente nula', 'L': 'Inductancia', 'R': ('Resistencia del devanado', 'Ω', '1 mΩ', '10 kΩ', '6 Ω'),
   'I': ('Corriente inicial', 'A', '1 mA', '100 A', '2 A'), 'V_x': ('Tensión de extinción (diodo, Zener)', 'V', '0,1 V', '1 kV', '0,7 V')},
  ej={'L': '10 mH', 'R': '6 Ω', 'I': '2 A', 'V_x': '0,7 V', 't': '4,8 ms'}, origen='problema 4.C', claves='relé diodo zener extinción')

# ------------------------------------------------------------------ cap05 — diodes
F('accion-masas', 'Ley de acción de masas', 'cap05', 'n dot.op p = n_(i)^("2")',
  'p = n_i^2/n',
  {'p': ('Concentración de huecos', 'cm⁻³', '1', '1e21'), 'n_i': ('Concentración intrínseca', 'cm⁻³', '1e5', '1e14', '1e10'),
   'n': ('Concentración de electrones', 'cm⁻³', '1e10', '1e21', '1e16')},
  ej={'n_i': '1e10', 'n': '1e16', 'p': '1e4'}, claves='semiconductor dopaje portadores minoritarios')
F('potencial-contacto', 'Potencial de contacto de una unión PN', 'cap05', 'V_("0") = V_("T") dot.op op("ln") lr(( N_("A")',
  'V_0 = V_T*ln(N_A*N_D/n_i^2)',
  {'V_0': ('Potencial de contacto', 'V', '0,1 V', '1,5 V'), 'V_T': 'Tensión térmica kT/q',
   'N_A': ('Dopaje aceptador (lado P)', 'cm⁻³', '1e13', '1e20', '1e17'), 'N_D': ('Dopaje donador (lado N)', 'cm⁻³', '1e13', '1e20', '1e16'),
   'n_i': ('Concentración intrínseca', 'cm⁻³', '1e5', '1e14', '1e10')},
  ej={'V_T': '25,85 mV', 'N_A': '1e17', 'N_D': '1e16', 'n_i': '1e10', 'V_0': '0,774 V'}, claves='unión pn barrera potencial de contacto')
F('anchura-agotamiento', 'Anchura de la zona de agotamiento', 'cap05', 'W = sqrt(("2" dot.op ε_("s"))/(q)',
  'W = sqrt(2*11.7*eps_0/q_e*(1/(N_A*1e6) + 1/(N_D*1e6))*(V_0 + V_R))',
  {'W': ('Anchura de la zona de agotamiento', 'm', '1 nm', '1 mm'),
   'N_A': ('Dopaje aceptador (lado P)', 'cm⁻³', '1e13', '1e20', '1e17'), 'N_D': ('Dopaje donador (lado N)', 'cm⁻³', '1e13', '1e20', '1e16'),
   'V_0': ('Potencial de contacto', 'V', '0,1 V', '1,5 V', '0,774 V'), 'V_R': ('Tensión inversa aplicada', 'V', '0 V', '1 kV', '0 V')},
  ej={'N_A': '1e17', 'N_D': '1e16', 'V_0': '0,774 V', 'V_R': '0 V', 'W': '332 nm'}, nota='Silicio: ε<sub>s</sub> = 11,7·ε<sub>0</sub>.',
  claves='zona de agotamiento unión pn varicap')
F('shockley', 'Ecuación de Shockley del diodo', 'cap05', [('cap26', 'I = I_("S") dot.op lr(( "e"^((V)\\/(n dot.op V_("T"))) - "1" )) quad'), 'I = I_("S") dot.op lr(( "e"^((V)\\/(n dot.op V_("T")))', 'V = n dot.op V_("T") dot.op op("ln") (I)/(I_("S"))'],
  'I = I_S*(exp(V/(n*V_T)) - 1)',
  {'I': ('Corriente del diodo', 'A', '1 pA', '100 A'), 'I_S': 'Corriente de saturación', 'V': ('Tensión del diodo', 'V', '0 V', '1,2 V', '0,6 V'),
   'n': {'n': 'Factor de idealidad', 'u': '', 'r': ('1', '2'), 'd': '1', 'lineal': True}, 'V_T': 'Tensión térmica kT/q'},
  ej={'I_S': '1e-12 A', 'V': '0,536 V', 'n': '1', 'V_T': '25,85 mV', 'I': '1 mA'}, origen='tabla de la sección 5.3',
  claves='shockley diodo exponencial curva característica')
F('mv-por-decada', 'Tensión del diodo por década de corriente', 'cap05', '"Δ" V space "para" times "10" space "de corriente"',
  'dV = n*V_T*ln(10)',
  {'dV': ('Aumento de tensión por cada ×10 de corriente', 'V', '1 mV', '1 V'),
   'n': {'n': 'Factor de idealidad', 'u': '', 'r': ('1', '2'), 'd': '1', 'lineal': True}, 'V_T': 'Tensión térmica kT/q'},
  ej={'n': '1', 'V_T': '25,85 mV', 'dV': '59,5 mV'}, claves='diodo década logaritmo')
F('rd-diodo', 'Resistencia dinámica del diodo', 'cap05', ['r_("d") = (d V)/(d I) = (n dot.op V_("T"))/(I)', ('cap26', 'r_("d") = (n dot.op V_("T"))/(I) quad')],
  'r_d = n*V_T/I',
  {'r_d': ('Resistencia dinámica', 'Ω', '1 mΩ', '1 GΩ'), 'n': {'n': 'Factor de idealidad', 'u': '', 'r': ('1', '2'), 'd': '1', 'lineal': True},
   'V_T': 'Tensión térmica kT/q', 'I': 'Corriente de polarización'},
  ej={'n': '1', 'V_T': '25,85 mV', 'I': '1 mA', 'r_d': '25,9 Ω'}, claves='resistencia dinámica pequeña señal diodo')
F('deriva-termica-diodo', 'Coeficiente térmico de la tensión del diodo', 'cap05',
  '(d V)/(d T) approx (V - V_("g" "0") - "3" dot.op V_("T"))/(T)', 'dVdT = (V - V_g0 - 3*V_T)/T_K',
  {'dVdT': {'n': 'Coeficiente térmico a corriente constante', 'u': 'V/K', 'r': ('-0,01', '0'), 'sim': 'dV/dT', 'lineal': True},
   'V': ('Tensión de trabajo del diodo', 'V', '0,2 V', '1 V', '0,7 V'), 'V_g0': ('Ancho de banda prohibida extrapolado a 0 K', 'V', '0,5 V', '3 V', '1,206 V'),
   'V_T': 'Tensión térmica kT/q', 'T_K': 'Temperatura absoluta'},
  ej={'V': '0,7 V', 'V_g0': '1,206 V', 'V_T': '25,85 mV', 'T_K': '300', 'dVdT': '-1,95e-3'}, claves='deriva térmica -2 mV/°C diodo')
F('resistencia-led', 'Resistencia limitadora de un LED', 'cap05', ['R = ("5" - "2,0")/("0,020")', ('cap18', 'R = ("3,3" - "1,2")/("20 mA")'), ('cap45', 'R = (V_("alim") - V_("f"))/(I)'), ('cap45', 'R = ("12" - "3,2")/("0,7") = "12,6 Ω"')],
  'R = (V_CC - V_F)/I_F', {'R': 'Resistencia limitadora', 'V_CC': 'Tensión de alimentación', 'V_F': 'Tensión directa del LED',
                            'I_F': 'Corriente del LED'},
  ej={'V_CC': '5 V', 'V_F': '2,0 V', 'I_F': '20 mA', 'R': '150 Ω'}, claves='led resistencia limitadora')
F('condensador-filtro', 'Condensador de filtro de un rectificador', 'cap05', ['C = (I)/(f_("rizado") dot.op "Δ" V)', ('cap50', 'C = (I)/(f times "Δ" V)'), ('cap15', '"Δ" V = (I)/(f_("rizado") dot.op C)'), ('cap22', '"Δ" V = (I)/(f dot.op C)')],
  'C = I/(f_r*dV)',
  {'C': 'Capacidad de filtro', 'I': 'Corriente de carga', 'f_r': ('Frecuencia del rizado (100 Hz en onda completa a 50 Hz)', 'Hz', '1 Hz', '1 MHz', '100 Hz'),
   'dV': {'n': 'Rizado pico a pico admisible', 'u': 'V', 'r': ('1 mV', '100 V'), 'sim': 'ΔV'}},
  ej={'I': '0,5 A', 'f_r': '100 Hz', 'dV': '1 V', 'C': '5000 µF'}, claves='filtro rectificador condensador rizado')
F('zener-rs', 'Resistencia serie de un regulador Zener', 'cap05',
  ['R_("s") = (V_("in") - V_("Z"))/(I_("Z") + I_("L"))', 'R_("s") lt.eq (V_("in" lr(( "min" ))) - V_("Z"))'],
  'R_s = (V_in - V_Z)/(I_Z + I_L)',
  {'R_s': ('Resistencia serie', 'Ω', '1 Ω', '1 MΩ'), 'V_in': ('Tensión de entrada (mínima)', 'V', '1 V', '1 kV', '9 V'),
   'V_Z': 'Tensión Zener', 'I_Z': ('Corriente mínima del Zener', 'A', '10 µA', '10 A', '5 mA'), 'I_L': ('Corriente de carga (máxima)', 'A', '0 A', '10 A', '20 mA')},
  ej={'V_in': '9 V', 'V_Z': '5,6 V', 'I_Z': '5 mA', 'I_L': '20 mA', 'R_s': '136 Ω'}, origen='problema 5.A', claves='zener regulador resistencia serie')
F('zener-rs-min', 'Resistencia serie mínima de un regulador Zener', 'cap05', 'R_("s") gt.eq (V_("in" lr(( op("max") ))) - V_("Z"))',
  'R_s = (V_in - V_Z)/I_Zmax',
  {'R_s': ('Resistencia serie mínima', 'Ω', '1 Ω', '1 MΩ'), 'V_in': ('Tensión de entrada máxima', 'V', '1 V', '1 kV', '15 V'),
   'V_Z': 'Tensión Zener', 'I_Zmax': ('Corriente máxima del Zener (P/V_Z)', 'A', '1 mA', '10 A', '45 mA')},
  ej={'V_in': '15 V', 'V_Z': '5,6 V', 'I_Zmax': '44,64 mA', 'R_s': '211 Ω'}, origen='problema 5.A (0,25 W / 5,6 V)', claves='zener disipación')
F('zener-variacion', 'Variación de la salida de un Zener por su resistencia dinámica', 'cap05', '"Δ" V = "70 mA" times "10 Ω"',
  'dV = dI*r_z',
  {'dV': ('Variación de la tensión de salida', 'V', '1 µV', '100 V'), 'dI': {'n': 'Variación de la corriente del Zener', 'u': 'A', 'r': ('1 µA', '10 A'), 'sim': 'ΔI'},
   'r_z': ('Resistencia dinámica del Zener', 'Ω', '0,1 Ω', '1 kΩ', '10 Ω')},
  ej={'dI': '70 mA', 'r_z': '10 Ω', 'dV': '0,7 V'}, claves='zener resistencia dinámica regulación')
F('doblador', 'Doblador de tensión (Greinacher)', 'cap05', 'V_("out") = "2" dot.op V_("p") - "2" dot.op V_("f")',
  'V_out = 2*V_p - 2*V_F',
  {'V_out': 'Tensión de salida en vacío', 'V_p': 'Tensión de pico de entrada', 'V_F': 'Caída directa de cada diodo'},
  ej={'V_p': '16,97 V', 'V_F': '0,7 V', 'V_out': '32,5 V'}, claves='doblador multiplicador greinacher villard')
F('recorte-zener', 'Umbral de recorte con dos Zener en oposición', 'cap05', 'V_("recorte") = V_("Z") + V_("F")',
  'V_rec = V_Z + V_F', {'V_rec': ('Tensión de recorte', 'V', '0,5 V', '1 kV'), 'V_Z': 'Tensión Zener', 'V_F': 'Caída directa del otro Zener'},
  ej={'V_Z': '5,6 V', 'V_F': '0,7 V', 'V_rec': '6,3 V'}, claves='recortador zener limitador')

# ------------------------------------------------------------------ cap06 — bipolar transistor
F('bjt-exponencial', 'Corriente de colector del BJT', 'cap06', ['I_("C") = I_("S") dot.op "e"^((V_("BE"))\\/(V_("T"))) $', ('cap26', 'I_("C") = I_("S") dot.op lr(( "e"^((V_("BE"))')],
  'I_C = I_S*exp(V_BE/V_T)', {'I_C': 'Corriente de colector', 'I_S': 'Corriente de saturación', 'V_BE': 'Tensión base-emisor',
                              'V_T': 'Tensión térmica kT/q'},
  claves='bjt transistor ebers moll exponencial')
F('gm-bjt', 'Transconductancia del BJT', 'cap06', ['g_(m) = (d I_("C"))/(d V_("BE")) = (I_("C"))/(V_("T"))', 'g_(m) = (I_("C"))/(V_("T"))', ('cap26', '= (I_("C"))/(V_("T")) $'), ('cap26', 'g_(m) = (I_("C"))/(V_("T")) quad r_("π")')],
  'g_m = I_C/V_T', {'g_m': 'Transconductancia', 'I_C': 'Corriente de colector en reposo', 'V_T': 'Tensión térmica kT/q'},
  ej={'I_C': '1,324 mA', 'V_T': '25,85 mV', 'g_m': '51,2 mS'}, claves='transconductancia gm pequeña señal')
F('av-emisor-comun', 'Ganancia del emisor común', 'cap06', 'A_("v") = - g_(m) dot.op R_("C") = - (R_("C"))/(r_("e"))',
  'A_v = -R_C/r_e', {'A_v': 'Ganancia de tensión', 'R_C': 'Resistencia de colector', 'r_e': 'Resistencia dinámica de emisor (V_T/I_C)'},
  ej={'R_C': '3,3 kΩ', 'r_e': '19,5 Ω', 'A_v': '-169'}, claves='emisor común ganancia')
F('ib-resistencia-base', 'Corriente de base con resistencia de base', 'cap06', 'I_("B") = ("5" - "0,7")/("100 kΩ")',
  'I_B = (V_in - V_BE)/R_B', {'I_B': 'Corriente de base', 'V_in': ('Tensión de mando', 'V', '0,5 V', '100 V', '5 V'),
                              'V_BE': 'Tensión base-emisor', 'R_B': 'Resistencia de base'},
  ej={'V_in': '5 V', 'V_BE': '0,7 V', 'R_B': '100 kΩ', 'I_B': '43 µA'}, claves='corriente de base interruptor')
F('recta-carga', 'Recta de carga en continua', 'cap06', 'V_("CE") = V_("CC") - I_("C") dot.op lr(( R_("C") + R_("E") ))',
  'V_CE = V_CC - I_C*(R_C + R_E)',
  {'V_CE': ('Tensión colector-emisor', 'V', '-100 V', '100 V'), 'V_CC': 'Tensión de alimentación', 'I_C': 'Corriente de colector',
   'R_C': 'Resistencia de colector', 'R_E': 'Resistencia de emisor'},
  ej={'V_CC': '12 V', 'I_C': '1,324 mA', 'R_C': '3,3 kΩ', 'R_E': '1 kΩ', 'V_CE': '6,31 V'}, origen='tabla de la sección 6.5 (β = 150)',
  claves='recta de carga punto de trabajo polarización')
F('alfa-beta', 'Relación entre α y β', 'cap06', ['β = (α)/("1" - α) quad α = (β)/(β + "1")', 'α = (I_("C"))/(I_("E")) = (β dot.op I_("B"))'],
  'alpha = beta/(beta + 1)', {'alpha': 'Ganancia de corriente en base común α', 'beta': 'Ganancia de corriente β'},
  claves='alfa beta ganancia de corriente')
F('ie-beta', 'Corriente de emisor', 'cap06', ['I_("E") = I_("C") + I_("B") = lr(( β + "1" )) dot.op I_("B")', 'I_("E") = I_("C") + I_("B") $'],
  'I_E = (beta + 1)*I_B', {'I_E': 'Corriente de emisor', 'beta': 'Ganancia de corriente β', 'I_B': 'Corriente de base'},
  claves='corriente de emisor kirchhoff')
F('vth-divisor-base', 'Tensión de Thévenin del divisor de base', 'cap06',
  ['V_("Th") = V_("CC") dot.op (R_("2"))/(R_("1") + R_("2")) quad R_("Th")', 'V_("B") = V_("CC") dot.op (R_("2"))/(R_("1") + R_("2"))'],
  'V_Th = V_CC*R_2/(R_1 + R_2)',
  {'V_Th': 'Tensión de Thévenin (tensión de base en vacío)', 'V_CC': 'Tensión de alimentación', 'R_1': 'Resistencia superior del divisor R₁',
   'R_2': 'Resistencia inferior del divisor R₂'},
  ej={'V_CC': '12 V', 'R_1': '47 kΩ', 'R_2': '10 kΩ', 'V_Th': '2,105 V'}, claves='divisor polarización thevenin')
F('rth-divisor-base', 'Resistencia de Thévenin del divisor de base', 'cap06', 'quad R_("Th") = R_("1") "‖" R_("2")',
  'R_Th = par(R_1, R_2)', {'R_Th': 'Resistencia de Thévenin', 'R_1': 'Resistencia superior del divisor R₁', 'R_2': 'Resistencia inferior del divisor R₂'},
  ej={'R_1': '47 kΩ', 'R_2': '10 kΩ', 'R_Th': '8,246 kΩ'}, claves='thevenin paralelo polarización')
F('ve-vb', 'Tensión de emisor', 'cap06', 'quad V_("E") = V_("B") - "0,7 V"', 'V_E = V_B - V_BE',
  {'V_E': 'Tensión de emisor', 'V_B': 'Tensión de base', 'V_BE': 'Tensión base-emisor'}, claves='tensión de emisor polarización')
F('ic-ve-re', 'Corriente de colector fijada por el emisor', 'cap06', 'I_("C") approx I_("E") = (V_("E"))/(R_("E"))',
  'I_C = V_E/R_E', {'I_C': 'Corriente de colector (≈ I_E)', 'V_E': 'Tensión de emisor', 'R_E': 'Resistencia de emisor'},
  claves='polarización emisor')
F('ib-divisor', 'Corriente de base con divisor y resistencia de emisor', 'cap06',
  ['I_("B") = (V_("Th") - V_("BE"))/(R_("Th") + lr(( β + "1" )) dot.op R_("E"))', 'I_("B") = (V_("Th") - V_("BE"))/(lr([ R_("Th") + lr(( β + "1" ))'],
  'I_B = (V_Th - V_BE)/(R_Th + (beta + 1)*R_E)',
  {'I_B': 'Corriente de base', 'V_Th': 'Tensión de Thévenin del divisor', 'V_BE': 'Tensión base-emisor', 'R_Th': 'Resistencia de Thévenin del divisor',
   'beta': 'Ganancia de corriente β', 'R_E': 'Resistencia de emisor'},
  ej={'V_Th': '2,105 V', 'V_BE': '0,7 V', 'R_Th': '8,246 kΩ', 'beta': '150', 'R_E': '1 kΩ', 'I_B': '8,8 µA'}, tol=0.01,
  claves='polarización divisor estabilidad beta')
F('ib-saturacion-forzada', 'Corriente de base para saturar', 'cap06', 'I_("B") = k dot.op (I_("C"))/(β_(op("mín")))',
  'I_B = k_s*I_C/beta_min',
  {'I_B': 'Corriente de base necesaria', 'k_s': {'n': 'Factor de saturación forzada', 'u': '', 'r': ('1', '20'), 'd': '5', 'sim': 'k'},
   'I_C': 'Corriente de carga', 'beta_min': {'n': 'β mínima de la hoja de datos', 'u': '', 'r': ('5', '1000'), 'd': '100', 'sim': 'β<sub>mín</sub>'}},
  ej={'k_s': '5', 'I_C': '500 mA', 'beta_min': '100', 'I_B': '25 mA'}, origen='tabla de la sección 6.7', claves='saturación interruptor')
F('p-conmutacion-bjt', 'Pérdidas de conmutación (aproximación)', 'cap06', 'P_("conm") approx V dot.op I dot.op t_("conm") dot.op f',
  'P = V*I*t_sw*f',
  {'P': 'Potencia de conmutación', 'V': 'Tensión conmutada', 'I': 'Corriente conmutada',
   't_sw': ('Tiempo de conmutación', 's', '1 ns', '100 µs', '1 µs'), 'f': 'Frecuencia de conmutación'},
  ej={'V': '12 V', 'I': '0,5 A', 't_sw': '1 µs', 'f': '20 kHz', 'P': '120 mW'}, claves='pérdidas conmutación interruptor')
F('r-pi', 'Resistencia de entrada r_π', 'cap06', 'r_("π") = (β)/(g_(m)) = β dot.op (V_("T"))/(I_("C"))',
  'r_pi = beta*V_T/I_C', {'r_pi': 'Resistencia de entrada r_π', 'beta': 'Ganancia de corriente β', 'V_T': 'Tensión térmica kT/q',
                          'I_C': 'Corriente de colector en reposo'},
  ej={'beta': '150', 'V_T': '25,85 mV', 'I_C': '1,324 mA', 'r_pi': '2,93 kΩ'}, claves='pequeña señal resistencia de entrada')
F('ro-early', 'Resistencia de salida (efecto Early)', 'cap06', ['r_("o") = (V_("A"))/(I_("C"))', ('cap26', 'quad r_("o") = (V_("A"))/(I_("C")) $')],
  'r_o = V_A/I_C', {'r_o': 'Resistencia de salida', 'V_A': 'Tensión de Early', 'I_C': 'Corriente de colector en reposo'},
  ej={'V_A': '100 V', 'I_C': '1,324 mA', 'r_o': '75,5 kΩ'}, claves='early resistencia de salida')
F('av-ec-ro', 'Ganancia del emisor común con r_o', 'cap06', 'A_("v") = - g_(m) dot.op lr(( R_("C") "‖" r_("o") ))',
  'A_v = -g_m*par(R_C, r_o)', {'A_v': 'Ganancia de tensión', 'g_m': 'Transconductancia', 'R_C': 'Resistencia de colector', 'r_o': 'Resistencia de salida'},
  ej={'g_m': '51,2 mS', 'R_C': '3,3 kΩ', 'r_o': '75,5 kΩ', 'A_v': '-162'}, claves='emisor común ganancia early')
F('ganancia-intrinseca', 'Ganancia intrínseca del BJT', 'cap06', 'A_("v" lr(( op("máx") ))) = g_(m) dot.op r_("o") = (V_("A"))/(V_("T"))',
  'A_max = V_A/V_T', {'A_max': ('Ganancia intrínseca máxima', 'V/V', '1', '1e5'), 'V_A': 'Tensión de Early', 'V_T': 'Tensión térmica kT/q'},
  ej={'V_A': '100 V', 'V_T': '25,85 mV', 'A_max': '3868'}, claves='ganancia intrínseca carga activa')
F('ft-bjt', 'Frecuencia de transición f_T', 'cap06', ['f_("T") = (g_(m))/("2" π dot.op lr(( C_("π") + C_("µ") )))', ('cap26', 'f_("T") = (g_(m))/("2" π dot.op lr(( C_("π") + C_("µ") )))')],
  'f_T = g_m/(2*pi*(C_pi + C_mu))',
  {'f_T': ('Frecuencia de transición', 'Hz', '1 MHz', '1 THz'), 'g_m': 'Transconductancia',
   'C_pi': ('Capacidad base-emisor C_π', 'F', '0,01 pF', '10 nF', '10 pF'), 'C_mu': ('Capacidad base-colector C_µ', 'F', '0,01 pF', '1 nF', '2 pF')},
  claves='frecuencia de transición ft ancho de banda')
F('bjt-early', 'Corriente de colector con efecto Early', 'cap06', 'dot.op lr(( "1" + (V_("CE"))/(V_("A")) ))',
  'I_C = I_S*exp(V_BE/V_T)*(1 + V_CE/V_A)',
  {'I_C': 'Corriente de colector', 'I_S': 'Corriente de saturación', 'V_BE': 'Tensión base-emisor', 'V_T': 'Tensión térmica kT/q',
   'V_CE': 'Tensión colector-emisor', 'V_A': 'Tensión de Early'}, claves='early modulación de base')
F('espejo-error-beta', 'Error de un espejo de corriente por la corriente de base', 'cap06',
  ['"error" = ("2")/(β + "2")', '(I_("out"))/(I_("ref")) = ("1")/("1" + ("2")/(β))'],
  'e = 100*2/(beta + 2)', {'e': ('Error de la corriente copiada', '%', '0', '100'), 'beta': 'Ganancia de corriente β'},
  ej={'beta': '150', 'e': '1,32 %'}, claves='espejo de corriente error beta')
F('espejo-desapareamiento', 'Error de un espejo por desapareamiento de V_BE', 'cap06',
  ['"error" = "e"^(("5 mV")', '(I_("2"))/(I_("1")) = "e"^(("Δ" V_("BE"))'],
  'e = 100*(exp(dV_BE/V_T) - 1)',
  {'e': ('Error de la corriente copiada', '%', '-100', '1000'), 'dV_BE': {'n': 'Desapareamiento de V_BE', 'u': 'V', 'r': ('-50 mV', '50 mV'), 'sim': 'ΔV<sub>BE</sub>', 'lineal': True, 'd': '1 mV'},
   'V_T': 'Tensión térmica kT/q'},
  ej={'dV_BE': '5 mV', 'V_T': '25,9 mV', 'e': '21,3 %'}, claves='espejo de corriente apareamiento')
F('av-carga-activa', 'Ganancia con carga activa', 'cap06', 'A_("v") = g_(m) dot.op lr(( r_("o" "1") "‖" r_("o" "2") ))',
  'A_v = g_m*par(r_o1, r_o2)',
  {'A_v': ('Ganancia de tensión', 'V/V', '1', '1e5'), 'g_m': 'Transconductancia', 'r_o1': ('Resistencia de salida del transistor', 'Ω', '1 kΩ', '100 MΩ', '75,5 kΩ'),
   'r_o2': ('Resistencia de salida del espejo', 'Ω', '1 kΩ', '100 MΩ', '75,5 kΩ')},
  ej={'g_m': '51,2 mS', 'r_o1': '75,5 kΩ', 'r_o2': '75,5 kΩ', 'A_v': '1930'}, tol=0.02, claves='carga activa espejo ganancia')
F('hd2', 'Distorsión de segundo armónico', 'cap06', '"HD"_("2") = bar.v (a_("2") dot.op A)/("2" dot.op a_("1")) bar.v',
  'HD_2 = 100*abs(a_2*A/(2*a_1))',
  {'HD_2': ('Distorsión de segundo armónico', '%', '0', '100'), 'a_1': ('Coeficiente lineal a₁', '', '0,001', '1e6', '1'),
   'a_2': {'n': 'Coeficiente cuadrático a₂', 'u': '', 'r': ('-10', '10'), 'd': '0,05', 'lineal': True},
   'A': {'n': 'Amplitud de la entrada', 'u': '', 'r': ('0', '100'), 'd': '1', 'lineal': True}},
  ej={'a_1': '1', 'a_2': '0,05', 'A': '1', 'HD_2': '2,50 %'}, no='a_2', claves='distorsión armónica hd2')
F('hd3', 'Distorsión de tercer armónico', 'cap06', 'bar.v "HD"_("3") = bar.v (a_("3") dot.op A^("2"))/("4" dot.op a_("1")) bar.v',
  'HD_3 = 100*abs(a_3*A^2/(4*a_1))',
  {'HD_3': ('Distorsión de tercer armónico', '%', '0', '100'), 'a_1': ('Coeficiente lineal a₁', '', '0,001', '1e6', '1'),
   'a_3': {'n': 'Coeficiente cúbico a₃', 'u': '', 'r': ('-10', '10'), 'd': '-0,02', 'lineal': True},
   'A': {'n': 'Amplitud de la entrada', 'u': '', 'r': ('0', '100'), 'd': '1', 'lineal': True}},
  ej={'a_1': '1', 'a_3': '-0,02', 'A': '1', 'HD_3': '0,50 %'}, no='a_3', claves='distorsión armónica hd3')
F('thd-2-3', 'Distorsión armónica total (HD₂ y HD₃)', 'cap06', '"THD" = sqrt("HD"_("2")^("2") + "HD"_("3")^("2")',
  'THD = sqrt(HD_2^2 + HD_3^2)',
  {'THD': ('Distorsión armónica total', '%', '0', '100'), 'HD_2': ('Distorsión de segundo armónico', '%', '0', '100', '2,5'),
   'HD_3': ('Distorsión de tercer armónico', '%', '0', '100', '0,5')},
  ej={'HD_2': '2,50 %', 'HD_3': '0,50 %', 'THD': '2,55 %'}, claves='thd distorsión total')
F('compresion-1db', 'Punto de compresión de 1 dB', 'cap06', 'A_("1") "dB" = sqrt("0,1449" dot.op a_("1")',
  'A_1dB = sqrt(0.1449*a_1/abs(a_3))',
  {'A_1dB': ('Amplitud de compresión de 1 dB', '', '0,001', '1e6'), 'a_1': ('Coeficiente lineal a₁', '', '0,001', '1e6', '1'),
   'a_3': {'n': 'Coeficiente cúbico a₃ (de signo contrario a a₁)', 'u': '', 'r': ('-10', '-1e-6'), 'd': '-0,02', 'lineal': True}},
  ej={'a_1': '1', 'a_3': '-0,02', 'A_1dB': '2,692'}, no='a_3', claves='compresión 1 dB lineal rf')
F('ip3', 'Punto de intercepción de tercer orden (IP3)', 'cap06', 'A_("IP" "3") = sqrt(("4" dot.op a_("1"))',
  'A_IP3 = sqrt(4*a_1/(3*abs(a_3)))',
  {'A_IP3': ('Amplitud de intercepción IP3', '', '0,001', '1e6'), 'a_1': ('Coeficiente lineal a₁', '', '0,001', '1e6', '1'),
   'a_3': {'n': 'Coeficiente cúbico a₃', 'u': '', 'r': ('-10', '-1e-6'), 'd': '-0,02', 'lineal': True}},
  ej={'a_1': '1', 'a_3': '-0,02', 'A_IP3': '8,165'}, no='a_3', claves='ip3 intermodulación rf')
F('ganancia-multietapa', 'Ganancia de dos etapas con efecto de carga', 'cap06', 'A_("total") = A_("1") dot.op lr([ R_("in" "2")',
  'A_t = A_1*R_in2/(R_out1 + R_in2)*A_2',
  {'A_t': ('Ganancia total', 'V/V', '-1e7', '1e7'), 'A_1': ('Ganancia en vacío de la primera etapa', 'V/V', '-1e4', '1e4', '10'),
   'R_in2': ('Resistencia de entrada de la segunda etapa', 'Ω', '1 Ω', '100 MΩ', '10 kΩ'),
   'R_out1': ('Resistencia de salida de la primera etapa', 'Ω', '0,01 Ω', '10 MΩ', '1 kΩ'), 'A_2': ('Ganancia de la segunda etapa', 'V/V', '-1e4', '1e4', '10')},
  claves='multietapa carga ganancia total')
F('p-saturacion', 'Potencia de conducción de un BJT saturado', 'cap06', 'P_("conducción") = V_("CE" lr(( "sat" ))) dot.op I_("C")',
  'P = V_CEsat*I_C', {'P': 'Potencia disipada en conducción', 'V_CEsat': ('Tensión colector-emisor de saturación', 'V', '0,01 V', '2 V', '0,2 V'),
                      'I_C': 'Corriente de colector'},
  ej={'V_CEsat': '0,2 V', 'I_C': '0,5 A', 'P': '100 mW'}, claves='saturación disipación')

# ------------------------------------------------------------------ cap07 — MOSFET
F('mosfet-saturacion', 'Corriente de drenador en saturación (ley cuadrática)', 'cap07',
  ['I_("D") = ("1")/("2") dot.op k dot.op lr(( V_("GS") - V_("th") ))', 'I_("D") = "½" dot.op k dot.op lr(( V_("GS") - V_("th") ))^("2")', ('cap26', 'I_("D") = ("1")/("2") dot.op k dot.op lr(( V_("GS") - V_("th") ))^("2") quad')],
  'I_D = 0.5*k_n*(V_GS - V_th)^2',
  {'I_D': 'Corriente de drenador', 'k_n': {'n': 'Parámetro de transconductancia k', 'u': 'A/V²', 'r': ('1e-5', '100'), 'd': '0,5', 'sim': 'k'},
   'V_GS': {'n': 'Tensión puerta-surtidor', 'u': 'V', 'r': ('0 V', '20 V'), 'd': '4 V', 'lineal': True},
   'V_th': {'n': 'Tensión umbral', 'u': 'V', 'r': ('0 V', '10 V'), 'd': '2 V', 'lineal': True}},
  claves='mosfet saturación cuadrática')
F('gm-mosfet', 'Transconductancia del MOSFET', 'cap07', ['= sqrt("2" dot.op k dot.op I_("D"))', ('cap26', '= sqrt("2" dot.op k dot.op I_("D")) $')],
  'g_m = sqrt(2*k_n*I_D)', {'g_m': 'Transconductancia', 'k_n': {'n': 'Parámetro de transconductancia k', 'u': 'A/V²', 'r': ('1e-5', '100'), 'd': '0,5', 'sim': 'k'},
                            'I_D': 'Corriente de drenador'},
  claves='mosfet transconductancia')
F('pwm-media', 'Tensión media de una señal PWM', 'cap07', ['V_("promedio") = D dot.op V_("alimentación")', '= D dot.op V $'],
  'V_avg = D*V', {'V_avg': ('Tensión media', 'V', '0 V', '1 kV'), 'D': 'Ciclo de trabajo', 'V': 'Tensión de alimentación'},
  claves='pwm ciclo de trabajo media')
F('p-conduccion-mosfet', 'Pérdidas de conducción de un MOSFET', 'cap07', 'P_("conducción") = I^("2") dot.op R_("DS" lr(( "on" ))) dot.op D',
  'P = I^2*R_on*D', {'P': 'Potencia de conducción', 'I': 'Corriente de drenador', 'R_on': ('Resistencia en conducción R_DS(on)', 'Ω', '0,1 mΩ', '100 Ω', '20 mΩ'),
                     'D': 'Ciclo de trabajo'},
  ej={'I': '5 A', 'R_on': '20 mΩ', 'D': '0,5', 'P': '0,250 W'}, claves='mosfet pérdidas conducción rdson')
F('p-conmutacion-mosfet', 'Pérdidas de conmutación de un MOSFET', 'cap07', 'P_("conmutación") = "½" dot.op V dot.op I dot.op lr(( t_("r") + t_("f") ))',
  'P = 0.5*V*I*t_rf*f',
  {'P': 'Potencia de conmutación', 'V': 'Tensión conmutada', 'I': 'Corriente conmutada',
   't_rf': ('Tiempos de subida más bajada (t_r + t_f)', 's', '1 ns', '10 µs', '50 ns'), 'f': 'Frecuencia de conmutación'},
  ej={'V': '24 V', 'I': '5 A', 't_rf': '50 ns', 'f': '100 kHz', 'P': '0,300 W'}, claves='mosfet pérdidas conmutación')
F('f-cruce-mosfet', 'Frecuencia de cruce de pérdidas', 'cap07', 'f_("cruce") = ("2" dot.op I dot.op R_("DS" lr(( "on" ))) dot.op D)',
  'f_x = 2*I*R_on*D/(V*t_rf)',
  {'f_x': ('Frecuencia de cruce', 'Hz', '1 Hz', '100 MHz'), 'I': 'Corriente de drenador', 'R_on': ('Resistencia en conducción R_DS(on)', 'Ω', '0,1 mΩ', '100 Ω', '20 mΩ'),
   'D': 'Ciclo de trabajo', 'V': 'Tensión conmutada', 't_rf': ('Tiempos de subida más bajada (t_r + t_f)', 's', '1 ns', '10 µs', '50 ns')},
  ej={'I': '5 A', 'R_on': '20 mΩ', 'D': '0,5', 'V': '24 V', 't_rf': '50 ns', 'f_x': '83,3 kHz'}, claves='mosfet cruce pérdidas frecuencia')
F('t-conmutacion-qg', 'Tiempo de conmutación por la carga de puerta', 'cap07',
  ['t_("conmutación") = (Q_("g"))/(I_("driver"))', 't_("conmutación") approx (Q_("g"))/(I_("pico"))', ('cap26', 't_("conmutación") approx (Q_("g"))/(I_("driver"))')],
  't_sw = Q_g/I_drv', {'t_sw': ('Tiempo de conmutación', 's', '100 ps', '100 µs'), 'Q_g': ('Carga de puerta', 'C', '0,1 nC', '10 µC', '30 nC'),
                       'I_drv': ('Corriente del driver', 'A', '1 mA', '100 A', '100 mA')},
  ej={'Q_g': '30 nC', 'I_drv': '100 mA', 't_sw': '300 ns'}, claves='carga de puerta driver qg')
F('i-pico-driver', 'Corriente de pico del driver de puerta', 'cap07', 'I_("pico") = (V_("g"))/(R_("g") + R_("driver"))',
  'I_pk = V_g/(R_g + R_drv)',
  {'I_pk': ('Corriente de pico de puerta', 'A', '1 mA', '100 A'), 'V_g': ('Tensión del driver', 'V', '1 V', '30 V', '10 V'),
   'R_g': ('Resistencia de puerta', 'Ω', '0 Ω', '1 kΩ', '4,7 Ω'), 'R_drv': ('Resistencia de salida del driver', 'Ω', '0,1 Ω', '1 kΩ', '2 Ω')},
  ej={'V_g': '10 V', 'R_g': '4,7 Ω', 'R_drv': '2 Ω', 'I_pk': '1,49 A'}, origen='problema 7.B', claves='driver resistencia de puerta')
F('p-driver', 'Potencia del driver de puerta', 'cap07', 'P_("driver") = Q_("g") dot.op V_("g") dot.op f',
  'P = Q_g*V_g*f', {'P': 'Potencia del driver', 'Q_g': ('Carga de puerta', 'C', '0,1 nC', '10 µC', '30 nC'),
                    'V_g': ('Tensión del driver', 'V', '1 V', '30 V', '12 V'), 'f': 'Frecuencia de conmutación'},
  ej={'Q_g': '60 nC', 'V_g': '10 V', 'f': '100 kHz', 'P': '60 mW'}, claves='driver potencia carga de puerta')
F('p-recuperacion', 'Pérdidas por recuperación inversa del diodo de cuerpo', 'cap07', 'P approx "½" dot.op V dot.op Q_("rr") dot.op f',
  'P = 0.5*V*Q_rr*f', {'P': 'Potencia perdida', 'V': 'Tensión del bus', 'Q_rr': ('Carga de recuperación inversa', 'C', '1 nC', '100 µC', '200 nC'),
                       'f': 'Frecuencia de conmutación'},
  ej={'V': '400 V', 'Q_rr': '200 nC', 'f': '100 kHz', 'P': '4 W'}, claves='recuperación inversa qrr diodo de cuerpo')

# ------------------------------------------------------------------ cap08 — integrated circuits
F('ao-inversor', 'Ganancia del amplificador inversor', 'cap08', ['A_("v") = - (R_("2"))/(R_("1"))'],
  'A_v = -R_2/R_1', {'A_v': 'Ganancia de tensión', 'R_2': 'Resistencia de realimentación R₂', 'R_1': 'Resistencia de entrada R₁'},
  claves='operacional inversor ganancia')
F('ao-no-inversor', 'Ganancia del amplificador no inversor', 'cap08', ['A_("v") = "1" + (R_("2"))/(R_("1"))'],
  'A_v = 1 + R_2/R_1', {'A_v': 'Ganancia de tensión', 'R_2': 'Resistencia de realimentación R₂', 'R_1': 'Resistencia a masa R₁'},
  claves='operacional no inversor ganancia')
F('p-regulador-lineal', 'Potencia disipada por un regulador lineal', 'cap08',
  ['P_("disipada") = lr(( V_("in") - V_("out") )) dot.op I', 'P = lr(( V_("in") - V_("out") )) dot.op I', ('cap17', 'P = lr(( V_("entrada") - "5" )) dot.op I'), ('cap50', 'P = lr(( V_("entrada") - V_("salida") )) times I'), ('cap50', 'P = lr(( "26" - "5" )) times "2"'), ('cap50', 'P = lr(( "30" - "3" )) times "3"'), ('cap50', 'P = lr(( "48" - "0" )) times "3"'), ('cap50', 'P = lr(( "48" - "5" )) times "3"')],
  'P = (V_in - V_out)*I', {'P': 'Potencia disipada', 'V_in': 'Tensión de entrada', 'V_out': 'Tensión de salida', 'I': 'Corriente de carga'},
  ej={'V_in': '12 V', 'V_out': '5 V', 'I': '1 A', 'P': '7 W'}, claves='regulador lineal disipación 7805')
F('rendimiento-lineal', 'Rendimiento de un regulador lineal', 'cap08', '"rendimiento" = (V_("out"))/(V_("in"))',
  'eta = 100*V_out/V_in', {'eta': 'Rendimiento', 'V_out': 'Tensión de salida', 'V_in': 'Tensión de entrada'},
  ej={'V_out': '5 V', 'V_in': '12 V', 'eta': '41,7 %'}, claves='rendimiento regulador lineal')
F('ne555-astable', 'Frecuencia del 555 astable', 'cap08', ['f = ("1,44")/(lr(( R_("a") + "2" dot.op R_("b") )) dot.op C)', 'f = ("1,44")/(lr([ lr(( R_("a") + "2" dot.op R_("b") )) dot.op "C" ]))', ('cap22', 'f = ("1,44")/(lr(( R_("A") + "2" dot.op R_("B") )) dot.op C)')],
  'f = 1.44/((R_a + 2*R_b)*C)', {'f': 'Frecuencia de oscilación', 'R_a': ('Resistencia R_a', 'Ω', '100 Ω', '10 MΩ', '1 kΩ'),
                                  'R_b': ('Resistencia R_b', 'Ω', '100 Ω', '10 MΩ', '10 kΩ'), 'C': 'Capacidad de temporización'},
  ej={'R_a': '1 kΩ', 'R_b': '10 kΩ', 'C': '100 nF', 'f': '687 Hz'}, claves='555 astable oscilador temporizador')
F('ne555-monoestable', 'Duración del pulso del 555 monoestable', 'cap08', ['T = "1,1" dot.op R dot.op C'],
  'T = 1.1*R*C', {'T': ('Duración del pulso', 's', '1 µs', '1e4 s'), 'R': 'Resistencia de temporización', 'C': 'Capacidad de temporización'},
  claves='555 monoestable temporizador pulso')
F('lm317', 'Tensión de salida del LM317', 'cap08', ['V_("out") = "1,25" dot.op lr(( "1" + (R_("2"))/(R_("1")) )) $', 'V_("out") = "1,25" + I_("1") dot.op R_("2")'],
  'V_out = 1.25*(1 + R_2/R_1)', {'V_out': 'Tensión de salida', 'R_2': 'Resistencia de ajuste a masa R₂', 'R_1': 'Resistencia entre salida y ajuste R₁'},
  ej={'R_1': '240 Ω', 'R_2': '1500 Ω', 'V_out': '9,06 V'}, origen='solución del ejercicio 8.4', claves='lm317 regulador ajustable')
F('lm317-iadj', 'Tensión de salida del LM317 con la corriente de ajuste', 'cap08', '+ I_("adj") dot.op R_("2")',
  'V_out = 1.25*(1 + R_2/R_1) + I_adj*R_2',
  {'V_out': 'Tensión de salida', 'R_2': 'Resistencia de ajuste a masa R₂', 'R_1': 'Resistencia entre salida y ajuste R₁',
   'I_adj': ('Corriente del terminal de ajuste', 'A', '1 µA', '200 µA', '50 µA')}, claves='lm317 iadj error')
F('slew-rate-fmax', 'Frecuencia máxima a plena excursión (slew rate)', 'cap08', ['f_(op("max")) = ("SR")/("2" π dot.op V_("pico"))', ('cap27', 'f_(op("max")) = ("SR")/("2" π dot.op V_("p"))')],
  'f_max = SR*1e6/(2*pi*V_p)', {'f_max': ('Frecuencia máxima sin distorsión', 'Hz', '1 Hz', '1 GHz'), 'SR': ('Slew rate', 'V/µs', '0,01', '10000', '0,5'),
                                'V_p': 'Tensión de pico de salida'},
  ej={'SR': '0,5', 'V_p': '10 V', 'f_max': '8 kHz'}, claves='slew rate operacional')
F('error-ron-mux', 'Error estático de un multiplexor por R_on', 'cap08', '"error" = ("100")/("100" + "1 MΩ")',
  'e = 100*R_on/(R_on + R_in)', {'e': ('Error relativo', '%', '0', '100'), 'R_on': ('Resistencia en conducción del interruptor', 'Ω', '0,1 Ω', '10 kΩ', '100 Ω'),
                                 'R_in': ('Impedancia de entrada del ADC', 'Ω', '1 kΩ', '10 GΩ', '1 MΩ')},
  ej={'R_on': '100 Ω', 'R_in': '1 MΩ', 'e': '0,01 %'}, claves='multiplexor ron error adc')
