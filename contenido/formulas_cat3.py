"""Curated formulas, chapters 28–40 (files cap28–cap41). See formulas.py for the format of F()."""
from formulas import F

DBV = {'u': 'dB', 'lineal': True}


def db(n, lo, hi, d):
    return dict(DBV, n=n, r=(lo, hi), d=d)


# ------------------------------------------------------------------ cap28 — oscillators
F('wien', 'Frecuencia del oscilador en puente de Wien', 'cap28', 'f_("0") = ("1")/("2" π dot.op R dot.op C)',
  'f_0 = 1/(2*pi*R*C)', {'f_0': ('Frecuencia de oscilación', 'Hz', '1 mHz', '100 MHz'), 'R': 'Resistencia de la red', 'C': 'Capacidad de la red'},
  claves='wien oscilador rc senoidal')
F('multivibrador', 'Semiperiodo de un multivibrador astable', 'cap28', 't = "0,693" dot.op R dot.op C',
  't = 0.693*R*C', {'t': ('Duración de cada semiperiodo', 's', '1 ns', '1e4 s'), 'R': 'Resistencia de base', 'C': 'Capacidad de acoplamiento'},
  claves='multivibrador astable transistores relajación')
F('snr-jitter', 'Límite de SNR por el jitter del reloj de muestreo', 'cap28', ['"SNR"_(op("max")) = - "20" dot.op op("log")_("10")', ('cap34', '"SNR"_("jitter") = - "20" dot.op op("log")_("10")')],
  'SNR = -20*log10(2*pi*f*t_j)',
  {'SNR': db('SNR máxima', '0', '200', '64'), 'f': 'Frecuencia de la señal', 't_j': ('Jitter del reloj (eficaz)', 's', '1 fs', '1 µs', '1 ps')},
  ej={'f': '100 MHz', 't_j': '1 ps', 'SNR': '64'}, tol=0.01, claves='jitter adc muestreo snr')

# ------------------------------------------------------------------ cap29 — digital design
F('frecuencia-maxima-sincrona', 'Frecuencia máxima de un camino síncrono', 'cap29', 'T gt.eq t_("pd") + t_("lógica") + t_("su")',
  'f_max = 1/(t_pd + t_l + t_su)',
  {'f_max': ('Frecuencia máxima de reloj', 'Hz', '1 kHz', '100 GHz'), 't_pd': ('Retardo del flip-flop', 's', '10 ps', '1 µs', '8 ns'),
   't_l': ('Retardo de la lógica combinacional', 's', '0 s', '1 µs', '5 ns'), 't_su': ('Tiempo de establecimiento (setup)', 's', '10 ps', '100 ns', '3 ns')},
  ej={'t_pd': '8 ns', 't_l': '5 ns', 't_su': '3 ns', 'f_max': '62,5 MHz'}, claves='temporización setup frecuencia máxima reloj')
F('frecuencia-maxima-skew', 'Frecuencia máxima con desalineo de reloj', 'cap29', 'T_("reloj") gt.eq t_("ff") + t_("lógica") + t_("su") + t_("skew")',
  'f_max = 1/(t_ff + t_l + t_su + t_sk)',
  {'f_max': ('Frecuencia máxima de reloj', 'Hz', '1 kHz', '100 GHz'), 't_ff': ('Retardo del biestable', 's', '10 ps', '1 µs', '8 ns'),
   't_l': ('Retardo de la lógica', 's', '0 s', '1 µs', '22 ns'), 't_su': ('Tiempo de establecimiento', 's', '10 ps', '100 ns', '3 ns'),
   't_sk': ('Desalineo del reloj (skew)', 's', '0 s', '100 ns', '2 ns')},
  ej={'t_ff': '8 ns', 't_l': '22 ns', 't_su': '3 ns', 't_sk': '2 ns', 'f_max': '28,57 MHz'}, claves='skew temporización reloj')

# ------------------------------------------------------------------ cap30 — signal processing
F('snr-cuantificacion', 'SNR de cuantificación', 'cap30', ['"SNR" = "6,02" dot.op n + "1,76 dB"', 'A lr(( "dB" )) gt.eq "6,02" dot.op N + "1,76"'],
  'SNR = 6.02*n_b + 1.76',
  {'SNR': db('Relación señal-ruido teórica', '0', '300', '98'), 'n_b': {'n': 'Resolución', 'u': 'bit', 'r': ('1', '32'), 'd': '16', 'sim': 'n'}},
  ej={'n_b': '16', 'SNR': '98,1'}, tol=0.002, claves='cuantificación snr bits adc enob')
F('filtro-iir-rc', 'Coeficiente del paso bajo digital equivalente a un RC', 'cap30', 'quad "con" quad a = ("Δ" t)/(R C + "Δ" t)',
  'a = dt/(tau + dt)', {'a': ('Coeficiente a', '', '0', '1'), 'dt': {'n': 'Periodo de muestreo', 'u': 's', 'r': ('1 ns', '100 s'), 'd': '0,1 ms', 'sim': 'Δt'},
                        'tau': ('Constante de tiempo RC', 's', '1 ns', '1e4 s', '1 ms')},
  ej={'dt': '0,1 ms', 'tau': '1 ms', 'a': '0,0909'}, claves='filtro digital iir media exponencial rc')
F('fir-coeficientes', 'Número de coeficientes de un FIR por ventanas', 'cap30', 'N approx (k dot.op f_("s"))/("Δ" f)',
  'N = k_v*f_s/df',
  {'N': ('Número de coeficientes', '', '1', '1e7'), 'k_v': {'n': 'Constante de la ventana (3,3 Hamming, 5,5 Blackman)', 'u': '', 'r': ('1', '10'), 'd': '3,3', 'sim': 'k'},
   'f_s': 'Frecuencia de muestreo', 'df': {'n': 'Anchura de la banda de transición', 'u': 'Hz', 'r': ('1 mHz', '1 GHz'), 'd': '500 Hz', 'sim': 'Δf'}},
  ej={'k_v': '3,3', 'f_s': '8 kHz', 'df': '500 Hz', 'N': '53'}, claves='fir coeficientes ventana hamming')
F('media-movil-equivalente', 'Coeficiente recursivo equivalente a una media móvil', 'cap30', 'a approx ("2")/(N + "1")',
  'a = 2/(N + 1)', {'a': ('Coeficiente del filtro recursivo', '', '0', '1'), 'N': {'n': 'Longitud de la media móvil', 'u': '', 'r': ('1', '1e5'), 'd': '8'}},
  ej={'N': '8', 'a': '0,222'}, claves='media móvil filtro exponencial')

# ------------------------------------------------------------------ cap31 — control
F('ziegler-nichols-kp', 'Ziegler-Nichols en lazo cerrado: K_p', 'cap31', 'K_("p") = "0,6" dot.op K_("u") quad',
  'K_p = 0.6*K_u', {'K_p': ('Ganancia proporcional', '', '1e-6', '1e6'), 'K_u': ('Ganancia crítica', '', '1e-6', '1e6', '10')},
  claves='pid ziegler nichols sintonía')
F('ziegler-nichols-ti', 'Ziegler-Nichols en lazo cerrado: T_i', 'cap31', 'quad T_(i) = (T_("u"))/("2")',
  'T_i = T_u/2', {'T_i': ('Tiempo integral', 's', '1 µs', '1e5 s'), 'T_u': ('Periodo de la oscilación crítica', 's', '1 µs', '1e5 s', '10 s')},
  claves='pid ziegler nichols integral')
F('ziegler-nichols-td', 'Ziegler-Nichols en lazo cerrado: T_d', 'cap31', 'quad T_("d") = (T_("u"))/("8")',
  'T_d = T_u/8', {'T_d': ('Tiempo derivativo', 's', '1 µs', '1e5 s'), 'T_u': ('Periodo de la oscilación crítica', 's', '1 µs', '1e5 s', '10 s')},
  claves='pid ziegler nichols derivativo')
F('rele-ku', 'Ganancia crítica por el método del relé', 'cap31', 'K_("u") = ("4" dot.op d)/(π dot.op a)',
  'K_u = 4*d_r/(pi*a_o)', {'K_u': ('Ganancia crítica', '', '1e-6', '1e6'), 'd_r': {'n': 'Amplitud del relé', 'u': '', 'r': ('1e-6', '1e6'), 'd': '1', 'sim': 'd'},
                           'a_o': {'n': 'Amplitud de la oscilación', 'u': '', 'r': ('1e-6', '1e6'), 'd': '0,1', 'sim': 'a'}},
  claves='relé autosintonía pid')
F('retardo-maximo', 'Retardo máximo tolerable por un lazo', 'cap31', 'T_(op("max")) = ("margen de fase" , "en" space "rad")/(ω_("c"))',
  'T_max = PM*pi/180/omega_c',
  {'T_max': ('Retardo adicional máximo', 's', '1 ns', '1e5 s'), 'PM': {'n': 'Margen de fase', 'u': '°', 'r': ('1', '90'), 'd': '50', 'lineal': True},
   'omega_c': ('Pulsación de cruce', 'rad/s', '1e-3', '1e9', '2')},
  ej={'PM': '50', 'omega_c': '2', 'T_max': '0,44 s'}, claves='retardo margen de fase estabilidad control')

# ------------------------------------------------------------------ cap32 — noise and EMC
F('ruido-integrado', 'Ruido total a partir de su densidad', 'cap32', ['V_("total") = "densidad" times sqrt(B)', 'E_("rms") = e_(n) dot.op sqrt("BW"_("ruido"))'],
  'V_n = e_n*sqrt(B)', {'V_n': ('Ruido eficaz total', 'V', '1 pV', '1 V'), 'e_n': ('Densidad de ruido', 'V/√Hz', '1e-12', '1e-5', '5e-9'),
                        'B': ('Ancho de banda de ruido', 'Hz', '1 mHz', '10 GHz', '10 kHz')},
  ej={'e_n': '5e-9', 'B': '10 kHz', 'V_n': '0,5 µV'}, nota='Para un filtro de un polo, el ancho de banda de ruido es 1,57·f<sub>−3 dB</sub>.',
  claves='densidad de ruido integración ancho de banda')
F('friis', 'Figura de ruido de una cadena (Friis)', 'cap32',
  [('cap36', 'F_("total") = F_("1") + (F_("2") - "1")/(G_("1"))'), 'F = F_("1") + (F_("2") - "1")/(G_("1"))', 'F_("total") = F_("1") + (F_("2") - "1")/(G_("1"))', 'F_("total") = "3,78 dB"'],
  'NF = 10*log10(10^(NF_1/10) + (10^(NF_2/10) - 1)/10^(G_1/10) + (10^(NF_3/10) - 1)/10^((G_1 + G_2)/10) + (10^(NF_4/10) - 1)/10^((G_1 + G_2 + G_3)/10))',
  {'NF': db('Figura de ruido total', '0', '60', '3'), 'NF_1': db('Figura de ruido de la etapa 1', '0', '40', '3'), 'G_1': db('Ganancia de la etapa 1', '-40', '60', '20'),
   'NF_2': db('Figura de ruido de la etapa 2', '0', '40', '6'), 'G_2': db('Ganancia de la etapa 2', '-40', '60', '-6'),
   'NF_3': db('Figura de ruido de la etapa 3', '0', '40', '10'), 'G_3': db('Ganancia de la etapa 3', '-40', '60', '30'),
   'NF_4': db('Figura de ruido de la etapa 4', '0', '40', '20')},
  ej={'NF_1': '3', 'G_1': '20', 'NF_2': '6', 'G_2': '-6', 'NF_3': '10', 'G_3': '30', 'NF_4': '20', 'NF': '3,78'}, tol=0.002, origen='problema @prob-32.A',
  nota='Una etapa pasiva con pérdidas tiene una figura de ruido igual a su pérdida (filtro de 6 dB: NF 6 dB, ganancia −6 dB). Con NF = 0 dB una etapa no añade nada.',
  claves='friis figura de ruido cadena receptor')
F('suelo-ruido-receptor', 'Suelo de ruido de un receptor', 'cap32', 'P_("ruido") = - "174 dBm" + "10" dot.op op("log")_("10") lr(( B )) + "NF"',
  'P_n = -174 + 10*log10(B) + NF',
  {'P_n': {'n': 'Potencia de ruido', 'u': 'dBm', 'r': ('-250', '50'), 'lineal': True}, 'B': ('Ancho de banda', 'Hz', '1 mHz', '10 GHz', '1 MHz'),
   'NF': db('Figura de ruido', '0', '40', '3')},
  ej={'B': '1 MHz', 'NF': '3', 'P_n': '-111'}, claves='sensibilidad suelo de ruido receptor kTB')
F('ruido-disparo-b', 'Ruido de disparo en un ancho de banda', 'cap32', 'I_(n) = sqrt("2" dot.op q dot.op I dot.op B)',
  'I_n = sqrt(2*q_e*I*B)', {'I_n': ('Corriente de ruido eficaz', 'A', '1e-18', '1e-3'), 'I': 'Corriente continua por la unión',
                            'B': ('Ancho de banda', 'Hz', '1 mHz', '10 GHz', '1 Hz')},
  ej={'I': '1 mA', 'B': '1 Hz', 'I_n': '17,9e-12'}, claves='ruido disparo shot')
F('r-optima-ruido', 'Resistencia de fuente óptima para el ruido', 'cap32', 'R_("opt") = (e_(n))/(i_(n))',
  'R_opt = e_n/i_n', {'R_opt': ('Resistencia de fuente óptima', 'Ω', '1 Ω', '1 GΩ'), 'e_n': ('Densidad de ruido de tensión', 'V/√Hz', '1e-10', '1e-6', '10e-9'),
                      'i_n': ('Densidad de ruido de corriente', 'A/√Hz', '1e-16', '1e-9', '0,5e-12')},
  ej={'e_n': '10e-9', 'i_n': '0,5e-12', 'R_opt': '20 kΩ'}, claves='ruido resistencia óptima amplificador')
F('ruido-entrada-total', 'Ruido total a la entrada de un amplificador', 'cap32', 'e_("total") = sqrt(e_(n)^("2") + lr(( i_(n) dot.op R_("s") ))^("2")',
  'e_t = sqrt(e_n^2 + (i_n*R_s)^2 + 4*k_B*T_K*R_s)',
  {'e_t': ('Densidad de ruido total', 'V/√Hz', '1e-12', '1e-5'), 'e_n': ('Densidad de ruido de tensión del amplificador', 'V/√Hz', '1e-10', '1e-6', '4e-9'),
   'i_n': ('Densidad de ruido de corriente del amplificador', 'A/√Hz', '1e-16', '1e-9', '1e-12'), 'R_s': ('Resistencia de la fuente', 'Ω', '1 Ω', '100 MΩ', '1 kΩ'),
   'T_K': 'Temperatura absoluta'}, claves='ruido amplificador fuente en in')
F('acoplo-inductivo', 'Tensión inducida por acoplamiento inductivo', 'cap32', 'v = M dot.op (d i)/(d t)',
  'v = M*didt', {'v': ('Tensión inducida', 'V', '1 nV', '1 kV'), 'M': ('Inductancia mutua', 'H', '0,01 nH', '1 mH', '10 nH'),
                 'didt': {'n': 'Rapidez de cambio de la corriente', 'u': 'A/s', 'r': ('1', '1e12'), 'd': '1e7', 'sim': 'di/dt'}},
  claves='acoplamiento inductivo diafonía emc')
F('radiacion-bucle', 'Campo radiado por un bucle de corriente', 'cap32', 'E approx "1,3" times "10"^(- "14") dot.op f^("2")',
  'E = 1.3e-14*f^2*A*I/r', {'E': ('Campo eléctrico', 'V/m', '1e-9', '100'), 'f': 'Frecuencia', 'A': ('Área del bucle', 'm²', '1e-8', '1', '1e-4'),
                            'I': ('Corriente del bucle', 'A', '1 µA', '10 A', '40 mA'), 'r': ('Distancia', 'm', '0,1 m', '100 m', '3 m')},
  ej={'f': '100 MHz', 'A': '1e-4', 'I': '40 mA', 'r': '3 m', 'E': '173e-6'}, claves='emc radiación bucle emisiones')
F('bucle-masa', 'Tensión inducida en un bucle de masa', 'cap32', 'V = (d Φ)/(d t) = ω dot.op B dot.op A',
  'V = 2*pi*f*B_m*A', {'V': ('Tensión inducida', 'V', '1 pV', '100 V'), 'f': 'Frecuencia del campo', 'B_m': ('Densidad de flujo magnético', 'T', '1 nT', '1 T', '1 µT'),
                       'A': ('Área del bucle', 'm²', '1e-6', '10', '0,01')},
  ej={'f': '50 Hz', 'B_m': '1 µT', 'A': '0,01', 'V': '3,14 µV'}, claves='bucle de masa zumbido inducción')
F('promediado', 'Mejora de la SNR por promediado', 'cap32', ['"Ganancia de" space "SNR" = sqrt(N)', '"mejora" = sqrt(N) , "o en decibelios"'],
  'G_dB = 10*log10(N)', {'G_dB': db('Mejora de la relación señal-ruido', '0', '100', '20'), 'N': {'n': 'Número de promedios', 'u': '', 'r': ('1', '1e9'), 'd': '100'}},
  ej={'N': '100', 'G_dB': '20'}, claves='promediado osciloscopio snr')
F('lockin-bw', 'Ancho de banda de un amplificador lock-in', 'cap32', '"BW" approx ("1")/("4" dot.op τ)',
  'BW = 1/(4*tau)', {'BW': 'Ancho de banda equivalente', 'tau': ('Constante de tiempo del filtro de salida', 's', '1 µs', '1000 s', '1 s')},
  ej={'tau': '1 s', 'BW': '0,25 Hz'}, claves='lock-in detección síncrona')
F('lockin-mejora', 'Mejora de SNR de un lock-in', 'cap32', '"mejora" = "10" dot.op op("log")_("10") ("BW"_("ancha"))',
  'G_dB = 10*log10(B_a/B_l)', {'G_dB': db('Mejora de la relación señal-ruido', '-50', '200', '46'), 'B_a': ('Ancho de banda de la medida directa', 'Hz', '1 mHz', '10 GHz', '10 kHz'),
                               'B_l': ('Ancho de banda del lock-in', 'Hz', '1 µHz', '1 MHz', '0,25 Hz')},
  ej={'B_a': '10 kHz', 'B_l': '0,25 Hz', 'G_dB': '46'}, claves='lock-in mejora snr')
F('potencia-ruido-ktb', 'Potencia de ruido térmico disponible', 'cap32', ['P = k dot.op T dot.op B $', 'P_(n) = k dot.op T dot.op B'],
  'P_n = k_B*T_K*B', {'P_n': ('Potencia de ruido', 'W', '1e-24', '1e-6'), 'T_K': 'Temperatura absoluta', 'B': ('Ancho de banda', 'Hz', '1 mHz', '10 GHz', '1 Hz')},
  ej={'T_K': '290', 'B': '1 Hz', 'P_n': '4,00e-21'}, claves='ruido kTB potencia temperatura')
F('temperatura-ruido', 'Temperatura equivalente de ruido', 'cap32', ['T_("e") = T_("0") dot.op lr(( F - "1" ))', 'T_("e") = lr(( F - "1" )) dot.op "290 K"'],
  'T_e = 290*(10^(NF/10) - 1)', {'T_e': ('Temperatura equivalente de ruido', 'K', '0', '1e6'), 'NF': db('Figura de ruido', '0', '40', '1')},
  ej={'NF': '1', 'T_e': '75'}, tol=0.01, claves='temperatura de ruido figura de ruido')
F('fuga-condensador-y', 'Corriente de fuga por los condensadores Y', 'cap32', 'I_("fuga") = "2" π dot.op f dot.op C_("Y") dot.op V',
  'I_f = 2*pi*f*C_Y*V', {'I_f': ('Corriente de fuga a tierra', 'A', '1 nA', '1 A'), 'f': ('Frecuencia de la red', 'Hz', '1 Hz', '1 kHz', '50 Hz'),
                         'C_Y': ('Capacidad Y total', 'F', '10 pF', '1 µF', '2,2 nF'), 'V': ('Tensión de red', 'V', '1 V', '1 kV', '230 V')},
  ej={'f': '50 Hz', 'C_Y': '2,2 nF', 'V': '230 V', 'I_f': '159,0 µA'}, claves='condensador y fuga seguridad filtro de red')

# ------------------------------------------------------------------ cap33 — switching supplies, motors
F('buck-vout', 'Tensión de salida de un reductor (buck)', 'cap33', 'arrow.r.double.long V_("out") = D dot.op V_("in") space "con"',
  'V_out = D*V_in', {'V_out': 'Tensión de salida', 'D': 'Ciclo de trabajo', 'V_in': 'Tensión de entrada'},
  ej={'D': '0,4167', 'V_in': '12 V', 'V_out': '5 V'}, origen='problema 4.A', claves='buck reductor ciclo de trabajo conmutada')
F('boost-vout', 'Tensión de salida de un elevador (boost)', 'cap33', 'V_("in") dot.op t_("on") = lr(( V_("out") - V_("in") )) dot.op t_("off")',
  'V_out = V_in/(1 - D)', {'V_out': 'Tensión de salida', 'V_in': 'Tensión de entrada', 'D': {'n': 'Ciclo de trabajo', 'u': '', 'r': ('0', '0,95'), 'd': '0,5', 'lineal': True}},
  claves='boost elevador conmutada')
F('rizado-buck-vout', 'Rizado de corriente de un reductor (en función de V_out)', 'cap33', '"Δ" I = (V_("out") dot.op lr(( "1" - D )))/(L dot.op f_("s"))',
  'dI = V_out*(1 - D)/(L*f_sw)', {'dI': {'n': 'Rizado de corriente pico a pico', 'u': 'A', 'r': ('1 µA', '100 A'), 'sim': 'ΔI'}, 'V_out': 'Tensión de salida',
                                  'D': 'Ciclo de trabajo', 'L': 'Inductancia', 'f_sw': ('Frecuencia de conmutación', 'Hz', '1 kHz', '10 MHz', '300 kHz')},
  ej={'V_out': '5 V', 'D': '0,417', 'L': '47 µH', 'f_sw': '300 kHz', 'dI': '207 mA'}, claves='buck rizado bobina')
F('perdida-diodo-libre', 'Pérdidas del diodo de rueda libre de un reductor', 'cap33', 'P = V_("F") dot.op I dot.op lr(( "1" - D ))',
  'P = V_F*I*(1 - D)', {'P': 'Potencia perdida en el diodo', 'V_F': 'Caída directa del diodo', 'I': 'Corriente de salida', 'D': 'Ciclo de trabajo'},
  ej={'V_F': '0,4 V', 'I': '10 A', 'D': '0,4', 'P': '2,4 W'}, claves='diodo schottky pérdidas rueda libre síncrono')
F('motor-cc-velocidad', 'Velocidad de un motor de continua', 'cap33', ['V = E + I dot.op R quad E = k dot.op ω quad T = k dot.op I'],
  'omega = (V - I*R)/k_m',
  {'omega': ('Velocidad angular', 'rad/s', '0', '1e5'), 'V': 'Tensión aplicada', 'I': ('Corriente del motor', 'A', '0 A', '1 kA', '2 A'),
   'R': ('Resistencia del bobinado', 'Ω', '1 mΩ', '1 kΩ', '0,5 Ω'), 'k_m': {'n': 'Constante del motor', 'u': 'V·s/rad', 'r': ('1e-4', '100'), 'd': '0,05', 'sim': 'k'}},
  claves='motor cc fuerza contraelectromotriz velocidad')
F('motor-cc-par', 'Par de un motor de continua', 'cap33', 'quad T = k dot.op I $', 'T_m = k_m*I',
  {'T_m': {'n': 'Par', 'u': 'N·m', 'r': ('0', '1e4'), 'sim': 'T'}, 'k_m': {'n': 'Constante del motor', 'u': 'N·m/A', 'r': ('1e-4', '100'), 'd': '0,05', 'sim': 'k'},
   'I': ('Corriente del motor', 'A', '0 A', '1 kA', '2 A')}, claves='motor par corriente')
F('velocidad-sincrona', 'Velocidad síncrona de un motor de alterna', 'cap33', 'n_("s") = ("120" dot.op f)/(p)',
  'n_s = 120*f/p', {'n_s': ('Velocidad síncrona', 'rpm', '1', '1e6'), 'f': ('Frecuencia de alimentación', 'Hz', '1 Hz', '1 kHz', '50 Hz'),
                    'p': {'n': 'Número de polos', 'u': '', 'r': ('2', '100'), 'd': '4', 'entero': True}},
  ej={'f': '50 Hz', 'p': '4', 'n_s': '1500'}, claves='motor de inducción síncrono polos rpm')
F('deslizamiento', 'Deslizamiento de un motor de inducción', 'cap33', 's = (n_("s") - n)/(n_("s"))',
  's = 100*(n_s - n_r)/n_s', {'s': ('Deslizamiento', '%', '-100', '100'), 'n_s': ('Velocidad síncrona', 'rpm', '1', '1e6', '1500'),
                              'n_r': ('Velocidad del rotor', 'rpm', '0', '1e6', '1440')},
  ej={'n_s': '1500', 'n_r': '1440', 's': '4 %'}, claves='deslizamiento motor inducción')
F('ley-v-f', 'Ley V/f de un variador de frecuencia', 'cap33', '(V)/(f) = "constante"',
  'V_2 = V_1*f_2/f_1', {'V_2': ('Tensión a la nueva frecuencia', 'V', '0 V', '10 kV'), 'V_1': ('Tensión nominal', 'V', '1 V', '10 kV', '400 V'),
                        'f_2': ('Nueva frecuencia', 'Hz', '0,1 Hz', '1 kHz', '25 Hz'), 'f_1': ('Frecuencia nominal', 'Hz', '1 Hz', '1 kHz', '50 Hz')},
  ej={'V_1': '400 V', 'f_2': '25 Hz', 'f_1': '50 Hz', 'V_2': '200 V'}, claves='variador frecuencia v/f motor')
F('flujo-nucleo', 'Densidad de flujo en el núcleo de una bobina', 'cap33', ['B = L dot.op (I_("pico"))/(N dot.op A_("e"))', 'N_("p") = L_("p") dot.op (I_("pico"))/(B_(op("max")) dot.op A_("e"))'],
  'B_m = L*I/(N*A_e)', {'B_m': ('Densidad de flujo de pico', 'T', '1 µT', '10 T'), 'L': 'Inductancia', 'I': ('Corriente de pico', 'A', '1 mA', '1 kA', '1,24 A'),
                        'N': 'Número de espiras', 'A_e': ('Área efectiva del núcleo', 'm²', '1e-8', '0,01', '52e-6')},
  ej={'L': '556 µH', 'I': '1,24 A', 'N': '44', 'A_e': '52e-6', 'B_m': '0,3'}, claves='saturación núcleo ferrita flujo espiras')
F('flyback-lp', 'Inductancia del primario de un flyback (modo discontinuo)', 'cap33', ['L_("p") = (lr(( V_("in") , "min" dot.op D_(op("max")) ))^("2"))', 'L_("p") = (lr(( "100" times "0,45" ))^("2"))'],
  'L_p = (V_in*D_max)^2/(2*P_in*f_sw)',
  {'L_p': ('Inductancia del primario', 'H', '1 µH', '1 H'), 'V_in': ('Tensión de entrada mínima', 'V', '1 V', '1 kV', '100 V'),
   'D_max': ('Ciclo de trabajo máximo', '', '0,05', '0,9', '0,45'), 'P_in': ('Potencia de entrada', 'W', '0,1 W', '10 kW', '28 W'),
   'f_sw': ('Frecuencia de conmutación', 'Hz', '1 kHz', '10 MHz', '65 kHz')},
  ej={'V_in': '100 V', 'D_max': '0,45', 'P_in': '28 W', 'f_sw': '65 kHz', 'L_p': '556 µH'}, claves='flyback primario inductancia')
F('flyback-ipico', 'Corriente de pico del primario de un flyback', 'cap33', 'I_("pico") = V_("in") , "min" dot.op (D_(op("max")))/(L_("p") dot.op f)',
  'I_pk = V_in*D_max/(L_p*f_sw)',
  {'I_pk': ('Corriente de pico del primario', 'A', '1 mA', '1 kA'), 'V_in': ('Tensión de entrada mínima', 'V', '1 V', '1 kV', '100 V'),
   'D_max': ('Ciclo de trabajo máximo', '', '0,05', '0,9', '0,45'), 'L_p': ('Inductancia del primario', 'H', '1 µH', '1 H', '556 µH'),
   'f_sw': ('Frecuencia de conmutación', 'Hz', '1 kHz', '10 MHz', '65 kHz')},
  ej={'V_in': '100 V', 'D_max': '0,45', 'L_p': '556 µH', 'f_sw': '65 kHz', 'I_pk': '1,24 A'}, claves='flyback corriente de pico')
F('flyback-relacion', 'Relación de espiras de un flyback', 'cap33', 'n = (V_("reflejada"))/(V_("out") + V_("D"))',
  'n = V_r/(V_out + V_D)', {'n': ('Relación de espiras N_p/N_s', '', '0,01', '1000'), 'V_r': ('Tensión reflejada al primario', 'V', '1 V', '1 kV', '100 V'),
                            'V_out': 'Tensión de salida', 'V_D': ('Caída del diodo de salida', 'V', '0 V', '5 V', '0,7 V')},
  ej={'V_r': '100 V', 'V_out': '12 V', 'V_D': '0,7 V', 'n': '7,9'}, claves='flyback relación de espiras tensión reflejada')
F('entrehierro', 'Entrehierro de un núcleo', 'cap33', 'l_("g") approx (µ_("0") dot.op N_("p")^("2") dot.op A_("e"))/(L_("p"))',
  'l_g = mu_0*N^2*A_e/L', {'l_g': ('Longitud del entrehierro', 'm', '1 µm', '1 cm'), 'N': ('Espiras del primario', 'espiras', '1', '1e4', '44'),
                           'A_e': ('Área efectiva del núcleo', 'm²', '1e-8', '0,01', '52e-6'), 'L': ('Inductancia deseada', 'H', '1 µH', '1 H', '556 µH')},
  ej={'N': '44', 'A_e': '52e-6', 'L': '556 µH', 'l_g': '0,23 mm'}, claves='entrehierro flyback núcleo')
F('potencia-por-ciclo', 'Potencia de una energía repetida en cada ciclo', 'cap33', 'P_("snubber") = "7,7e-6" times "65 000"',
  'P = E*f', {'P': 'Potencia', 'E': ('Energía por ciclo', 'J', '1 nJ', '1 kJ', '7,7 µJ'), 'f': 'Frecuencia de repetición'},
  ej={'E': '7,7 µJ', 'f': '65 kHz', 'P': '0,5 W'}, claves='snubber pérdidas energía por ciclo')
F('cero-esr', 'Cero del ESR del condensador de salida', 'cap33', 'f_("ESR") = ("1")/("2" π dot.op "ESR" dot.op C)',
  'f_ESR = 1/(2*pi*ESR*C)', {'f_ESR': ('Frecuencia del cero', 'Hz', '1 Hz', '1 GHz'), 'ESR': ('Resistencia serie equivalente', 'Ω', '1 mΩ', '10 Ω', '30 mΩ'),
                             'C': 'Capacidad de salida'},
  ej={'ESR': '30 mΩ', 'C': '470 µF', 'f_ESR': '11,3 kHz'}, claves='compensación lazo esr cero conmutada')
F('cero-semiplano-derecho', 'Cero en el semiplano derecho de un elevador', 'cap33', 'f_("RHZ") approx (V_("out") dot.op lr(( "1" - D ))^("2"))',
  'f_RHZ = V_out*(1 - D)^2/(2*pi*L*I_out)',
  {'f_RHZ': ('Frecuencia del cero RHP', 'Hz', '1 Hz', '100 MHz'), 'V_out': 'Tensión de salida', 'D': 'Ciclo de trabajo', 'L': 'Inductancia',
   'I_out': ('Corriente de salida', 'A', '1 mA', '1 kA', '1 A')}, claves='boost cero semiplano derecho estabilidad')

# ------------------------------------------------------------------ cap34 — data conversion
F('ruido-cuantificacion', 'Valor eficaz del error de cuantificación', 'cap34', 'q_("ef") = ("LSB")/(sqrt("12"))',
  'q_ef = LSB/sqrt(12)', {'q_ef': ('Ruido de cuantificación eficaz', 'V', '1 pV', '1 V'), 'LSB': ('Valor de un escalón', 'V', '1 nV', '10 V', '1 mV')},
  ej={'LSB': '1 mV', 'q_ef': '0,29 mV'}, claves='cuantificación ruido lsb')
F('error-jitter', 'Error de tensión por incertidumbre del muestreo', 'cap34', '"Δ" V = (d V)/(d t) dot.op "Δ" t',
  'dV = dvdt*dt', {'dV': {'n': 'Error de tensión', 'u': 'V', 'r': ('1 pV', '10 V'), 'sim': 'ΔV'},
                   'dvdt': {'n': 'Pendiente de la señal', 'u': 'V/s', 'r': ('1', '1e12'), 'd': '6,28e6', 'sim': 'dV/dt'},
                   'dt': {'n': 'Incertidumbre del instante de muestreo', 'u': 's', 'r': ('1 fs', '1 µs'), 'd': '1 ps', 'sim': 'Δt'}},
  claves='jitter apertura muestreo error')
F('galga', 'Variación de resistencia de una galga extensométrica', 'cap35', '("Δ" R)/(R) = "GF" dot.op ε',
  'dR = R*GF*eps_u*1e-6', {'dR': {'n': 'Variación de la resistencia', 'u': 'Ω', 'r': ('1 µΩ', '1 kΩ'), 'sim': 'ΔR'}, 'R': ('Resistencia de la galga', 'Ω', '50 Ω', '10 kΩ', '350 Ω'),
                           'GF': ('Factor de galga', '', '0,5', '200', '2'), 'eps_u': {'n': 'Deformación', 'u': 'µε', 'r': ('0,01', '1e5'), 'd': '1000', 'sim': 'ε'}},
  claves='galga extensométrica deformación factor de galga')
F('codigo-ratiometrico', 'Código de un convertidor ratiométrico', 'cap35', '"código" = (V_("señal"))/(V_("referencia")) times "2"^(n)',
  'k = V_s/V_ref*2^n_b', {'k': ('Código', '', '0', '1e10'), 'V_s': ('Tensión de la señal', 'V', '0 V', '100 V', '1 V'), 'V_ref': 'Tensión de referencia',
                          'n_b': {'n': 'Resolución', 'u': 'bit', 'r': ('1', '32'), 'd': '12', 'entero': True, 'sim': 'n'}},
  claves='ratiométrico adc referencia código')

# ------------------------------------------------------------------ cap36 — RF and transmission lines
F('longitud-critica', 'Longitud crítica de una pista (línea de transmisión)', 'cap36', ['"longitud crítica" approx (t_("subida") times "velocidad")/("6")', ('cap41', '"longitud crítica" approx')],
  'l = t_r*v_p/6', {'l': ('Longitud crítica', 'm', '0,1 mm', '1 km'), 't_r': ('Tiempo de subida', 's', '10 ps', '1 µs', '5 ns'),
                    'v_p': ('Velocidad de propagación', 'm/s', '1e7', '3e8', '1,8e8')},
  ej={'t_r': '5 ns', 'v_p': '1,8e8', 'l': '15 cm'}, claves='línea de transmisión integridad de señal pista')
F('z0-linea', 'Impedancia característica de una línea', 'cap36', 'Z_("0") = sqrt((L)/(C)) quad "por unidad de longitud"',
  'Z_0 = sqrt(L_u/C_u)', {'Z_0': ('Impedancia característica', 'Ω', '1 Ω', '1 kΩ'), 'L_u': ('Inductancia por unidad de longitud', 'H/m', '1e-8', '1e-5', '250e-9'),
                          'C_u': ('Capacidad por unidad de longitud', 'F/m', '1e-12', '1e-9', '100e-12')},
  claves='línea de transmisión impedancia característica coaxial')
F('coeficiente-reflexion', 'Coeficiente de reflexión', 'cap36', ['Γ = (Z_("L") - Z_("0"))/(Z_("L") + Z_("0"))', ('cap41', 'Γ = (Z_("carga") - Z_("0"))/(Z_("carga") + Z_("0"))')],
  'Gamma = (Z_L - Z_0)/(Z_L + Z_0)', {'Gamma': {'n': 'Coeficiente de reflexión', 'u': '', 'r': ('-1', '1'), 'lineal': True, 'sim': 'Γ'}, 'Z_L': 'Impedancia de carga',
                                      'Z_0': 'Impedancia característica de la línea'},
  ej={'Z_L': '75 Ω', 'Z_0': '50 Ω', 'Gamma': '0,2'}, claves='reflexión adaptación gamma línea')
F('vswr', 'Razón de onda estacionaria (VSWR)', 'cap36', '"VSWR" = ("1" + bar.v Γ bar.v)/("1" - bar.v Γ bar.v)',
  'VSWR = (1 + G_r)/(1 - G_r)', {'VSWR': ('Razón de onda estacionaria', '', '1', '1e4'), 'G_r': {'n': 'Módulo del coeficiente de reflexión', 'u': '', 'r': ('0', '0,999'), 'd': '0,2', 'lineal': True, 'sim': '|Γ|'}},
  ej={'G_r': '0,2', 'VSWR': '1,5'}, claves='vswr roe onda estacionaria antena')
F('s11', 'Parámetro S11 en decibelios', 'cap36', 'S_("11") lr(( "dB" )) = "20" dot.op op("log")_("10") bar.v Γ bar.v',
  'S_11 = 20*log10(G_r)', {'S_11': db('S11 (coeficiente de reflexión)', '-80', '0', '-14'), 'G_r': {'n': 'Módulo del coeficiente de reflexión', 'u': '', 'r': ('0,0001', '1'), 'd': '0,2', 'sim': '|Γ|'}},
  claves='s11 parámetros s reflexión')
F('perdida-retorno', 'Pérdida de retorno', 'cap36', '"RL" lr(( "dB" )) = - "20" dot.op op("log")_("10") bar.v Γ bar.v',
  'RL = -20*log10(G_r)', {'RL': db('Pérdida de retorno', '0', '80', '14'), 'G_r': {'n': 'Módulo del coeficiente de reflexión', 'u': '', 'r': ('0,0001', '1'), 'd': '0,2', 'sim': '|Γ|'}},
  claves='pérdida de retorno return loss')
F('perdida-desadaptacion', 'Pérdida por desadaptación', 'cap36', '"ML" lr(( "dB" )) = - "10" dot.op op("log")_("10") lr(( "1" - bar.v Γ bar.v^("2") ))',
  'ML = -10*log10(1 - G_r^2)', {'ML': db('Pérdida por desadaptación', '0', '40', '0,18'), 'G_r': {'n': 'Módulo del coeficiente de reflexión', 'u': '', 'r': ('0', '0,999'), 'd': '0,2', 'lineal': True, 'sim': '|Γ|'}},
  claves='desadaptación mismatch loss')
F('q-red-l', 'Factor de calidad de una red de adaptación en L', 'cap36', ['Q = sqrt((R_("mayor"))/(R_("menor")) - "1")', 'Q = sqrt((R_("alta"))/(R_("baja")) - "1")'],
  'Q = sqrt(R_h/R_l - 1)', {'Q': 'Factor de calidad de la red', 'R_h': ('Resistencia mayor', 'Ω', '1 Ω', '1 MΩ', '50 Ω'), 'R_l': ('Resistencia menor', 'Ω', '0,1 Ω', '1 MΩ', '10 Ω')},
  ej={'R_h': '50 Ω', 'R_l': '10 Ω', 'Q': '2,000'}, claves='red en l adaptación de impedancias')
F('red-l-serie', 'Reactancia serie de una red en L', 'cap36', 'X_("serie") = Q dot.op R_("baja") = "20,0 Ω"',
  'X_s = Q*R_l', {'X_s': ('Reactancia serie', 'Ω', '1 mΩ', '1 MΩ'), 'Q': 'Factor de calidad de la red', 'R_l': ('Resistencia menor', 'Ω', '0,1 Ω', '1 MΩ', '10 Ω')},
  ej={'Q': '2', 'R_l': '10 Ω', 'X_s': '20,0 Ω'}, claves='red en l reactancia serie')
F('red-l-paralelo', 'Reactancia paralelo de una red en L', 'cap36', 'X_("paralelo") = (R_("alta"))/(Q) = "25,0 Ω"',
  'X_p = R_h/Q', {'X_p': ('Reactancia paralelo', 'Ω', '1 mΩ', '1 MΩ'), 'R_h': ('Resistencia mayor', 'Ω', '1 Ω', '1 MΩ', '50 Ω'), 'Q': 'Factor de calidad de la red'},
  ej={'R_h': '50 Ω', 'Q': '2', 'X_p': '25,0 Ω'}, claves='red en l reactancia paralelo')
F('stub-corto', 'Reactancia de un tramo de línea en cortocircuito', 'cap36', 'Z_("in") = j dot.op Z_("0") dot.op op("tan") lr(( β l ))',
  'X_in = Z_0*tan(2*pi*l/lambda)', {'X_in': {'n': 'Reactancia de entrada', 'u': 'Ω', 'r': ('-1e6', '1e6'), 'lineal': True}, 'Z_0': 'Impedancia característica de la línea',
                                    'l': ('Longitud del tramo', 'm', '0,1 mm', '100 m', '8,6 mm'), 'lambda': ('Longitud de onda en la línea', 'm', '1 mm', '1 km', '68,7 mm')},
  claves='stub línea cortocircuito reactancia')
F('longitud-onda-sustrato', 'Longitud de onda en un sustrato', 'cap36', 'λ = (c)/(f dot.op sqrt(ε_("eff")))',
  'lambda = c_0/(f*sqrt(eps_eff))', {'lambda': ('Longitud de onda guiada', 'm', '1 µm', '100 km'), 'f': 'Frecuencia',
                                     'eps_eff': {'n': 'Permitividad efectiva', 'u': '', 'r': ('1', '20'), 'd': '3,3', 'sim': 'ε<sub>eff</sub>'}},
  ej={'f': '2,4 GHz', 'eps_eff': '3,3', 'lambda': '68,7 mm'}, claves='longitud de onda microstrip fr4')
F('longitud-onda', 'Longitud de onda', 'cap36', ['λ = (c)/(f) $'], 'lambda = c_0/f',
  {'lambda': ('Longitud de onda', 'm', '1 µm', '1e5 km'), 'f': 'Frecuencia'}, claves='longitud de onda frecuencia')
F('intermodulacion-3', 'Nivel de los productos de intermodulación de tercer orden', 'cap36', '"nivel del producto" = "3" dot.op P_("entrada") - "2" dot.op "IP" "3"',
  'P_IM3 = 3*P_in - 2*IP3', {'P_IM3': {'n': 'Nivel del producto de intermodulación', 'u': 'dBm', 'r': ('-300', '100'), 'lineal': True},
                             'P_in': {'n': 'Nivel de cada tono de entrada', 'u': 'dBm', 'r': ('-150', '50'), 'd': '-30', 'lineal': True},
                             'IP3': {'n': 'Punto de intercepción de tercer orden', 'u': 'dBm', 'r': ('-50', '80'), 'd': '10', 'lineal': True}},
  ej={'P_in': '-30', 'IP3': '10', 'P_IM3': '-110'}, claves='ip3 intermodulación receptor')
F('perdida-espacio-libre', 'Pérdida en espacio libre', 'cap36', '"PEL" lr(( "dB" )) = "20" dot.op op("log")_("10") ("4" π dot.op d)/(λ)',
  'PEL = 20*log10(4*pi*d*f/c_0)', {'PEL': db('Pérdida en espacio libre', '0', '400', '80'), 'd': ('Distancia', 'm', '1 cm', '1e9 m', '1 km'), 'f': 'Frecuencia'},
  ej={'d': '1 km', 'f': '100 MHz', 'PEL': '72,44'}, tol=0.001, claves='espacio libre propagación friis enlace')
F('perdida-espacio-libre-km', 'Pérdida en espacio libre (forma práctica)', 'cap36', 'L_("fs") lr(( "dB" )) = "32,44"',
  'L_fs = 32.44 + 20*log10(d/1000) + 20*log10(f/1e6)', {'L_fs': db('Pérdida en espacio libre', '0', '400', '91'), 'd': ('Distancia', 'm', '1 m', '1e9 m', '1 km'), 'f': 'Frecuencia'},
  ej={'d': '1 km', 'f': '868 MHz', 'L_fs': '91,2'}, tol=0.001, claves='espacio libre lora enlace')
F('fresnel', 'Radio de la primera zona de Fresnel', 'cap36', 'r approx "8,66" dot.op sqrt((d_("km"))/(f_("GHz")))',
  'r = 8.66*sqrt(d/1000/(f/1e9))', {'r': ('Radio en el punto medio', 'm', '1 mm', '10 km'), 'd': ('Longitud del enlace', 'm', '1 m', '1e6 m', '1 km'), 'f': 'Frecuencia'},
  ej={'d': '1 km', 'f': '868 MHz', 'r': '9,3 m'}, claves='fresnel enlace visión directa')
F('sensibilidad-receptor', 'Sensibilidad de un receptor', 'cap36', 'P_("min") = - ("174 dBm")/("Hz") + "10" dot.op op("log")_("10") lr(( "BW" ))',
  'P_min = -174 + 10*log10(BW) + NF + SNR', {'P_min': {'n': 'Sensibilidad (potencia mínima)', 'u': 'dBm', 'r': ('-250', '50'), 'lineal': True},
                                             'BW': ('Ancho de banda', 'Hz', '1 Hz', '1 GHz', '100 kHz'), 'NF': db('Figura de ruido', '0', '40', '6'),
                                             'SNR': db('Relación señal-ruido necesaria', '-30', '60', '10')},
  ej={'BW': '100 kHz', 'NF': '6', 'SNR': '10', 'P_min': '-108'}, claves='sensibilidad receptor ruido enlace')
F('presupuesto-enlace', 'Presupuesto de un enlace radio', 'cap36', '"presupuesto" = P_("tx") + G_("tx") + G_("rx") - "sensibilidad"',
  'B_L = P_tx + G_tx + G_rx - S_rx', {'B_L': db('Pérdida admisible (presupuesto)', '0', '300', '114'),
                                      'P_tx': {'n': 'Potencia transmitida', 'u': 'dBm', 'r': ('-30', '70'), 'd': '20', 'lineal': True},
                                      'G_tx': {'n': 'Ganancia de la antena transmisora', 'u': 'dBi', 'r': ('-10', '50'), 'd': '2', 'lineal': True},
                                      'G_rx': {'n': 'Ganancia de la antena receptora', 'u': 'dBi', 'r': ('-10', '50'), 'd': '2', 'lineal': True},
                                      'S_rx': {'n': 'Sensibilidad del receptor', 'u': 'dBm', 'r': ('-150', '0'), 'd': '-90', 'lineal': True}},
  ej={'P_tx': '20', 'G_tx': '2', 'G_rx': '2', 'S_rx': '-90', 'B_L': '114'}, claves='presupuesto enlace balance')

# ------------------------------------------------------------------ cap37 — programmable logic, consoles
F('divisor-frecuencia', 'Reloj obtenido por división entera', 'cap37', ['"CPU" = ("21,477272 MHz")/("12")', '"68000" = ("24")/("2") = "12 MHz"', 'Z "80" = ("24")/("6")', '"píxel" = ("24")/("4")'],
  'f_out = f_clk/N_d', {'f_out': ('Frecuencia obtenida', 'Hz', '1 mHz', '10 GHz'), 'f_clk': ('Frecuencia del oscilador', 'Hz', '1 Hz', '10 GHz', '21,477272 MHz'),
                        'N_d': {'n': 'Divisor', 'u': '', 'r': ('1', '1e9'), 'd': '12', 'sim': 'N'}},
  ej={'f_clk': '21,477272 MHz', 'N_d': '12', 'f_out': '1,789773 MHz'}, tol=1e-6, claves='divisor de reloj nes neo geo cristal')
F('divisor-biestable', 'Frecuencia de salida de un divisor por contador', 'cap37', 'f_("salida") = (f_("reloj"))/("2" times N)',
  'f_out = f_clk/(2*N_d)', {'f_out': ('Frecuencia de salida', 'Hz', '1 mHz', '10 GHz'), 'f_clk': ('Frecuencia del reloj', 'Hz', '1 Hz', '10 GHz', '50 MHz'),
                            'N_d': {'n': 'Cuenta del contador', 'u': '', 'r': ('1', '1e9'), 'd': '25000', 'sim': 'N'}},
  claves='divisor contador fpga frecuencia')
F('frecuencia-cuadro', 'Frecuencia de cuadro de vídeo', 'cap37', ['("5 369 318")/("89 342") = "60,0985"', '("6 000 000")/("101 376") = "59,19 Hz"'],
  'f_v = f_pix/(n_h*n_l)', {'f_v': ('Frecuencia de cuadro', 'Hz', '1 Hz', '1 kHz'), 'f_pix': ('Reloj de píxel', 'Hz', '1 kHz', '10 GHz', '5,369318 MHz'),
                            'n_h': {'n': 'Puntos por línea (total)', 'u': '', 'r': ('1', '1e5'), 'd': '341'}, 'n_l': {'n': 'Líneas por cuadro (total)', 'u': '', 'r': ('1', '1e5'), 'd': '262'}},
  ej={'f_pix': '5 369 318', 'n_h': '341', 'n_l': '262', 'f_v': '60,0985'}, tol=1e-5, claves='vídeo cuadro vga nes reloj de píxel')
F('equilibrio-asic', 'Volumen de equilibrio entre FPGA y ASIC', 'cap37', 'N times "30" = "500 000" + N times "2"',
  'N = NRE/(p_F - c_A)', {'N': ('Unidades de equilibrio', '', '1', '1e12'), 'NRE': ('Coste fijo del ASIC (NRE)', '€', '1', '1e9', '500 000'),
                          'p_F': ('Precio de la FPGA equivalente', '€', '0,01', '1e5', '30'), 'c_A': ('Coste unitario del ASIC', '€', '0', '1e5', '2')},
  ej={'NRE': '500 000', 'p_F': '30', 'c_A': '2', 'N': '17 900'}, claves='asic fpga coste volumen')
F('profundidad-fifo', 'Profundidad mínima de una FIFO', 'cap37', '"profundidad" gt.eq "ráfaga" dot.op lr(( "1" - (f_("lectura"))/(f_("escritura")) ))',
  'D_f = B_w*(1 - f_r/f_w)', {'D_f': ('Profundidad mínima', 'palabras', '0', '1e9'), 'B_w': ('Palabras de la ráfaga', 'palabras', '1', '1e9', '64'),
                              'f_r': ('Frecuencia de lectura', 'Hz', '1 Hz', '10 GHz', '40 MHz'), 'f_w': ('Frecuencia de escritura', 'Hz', '1 Hz', '10 GHz', '100 MHz')},
  ej={'B_w': '64', 'f_r': '40 MHz', 'f_w': '100 MHz', 'D_f': '38,4'}, claves='fifo ráfaga dominios de reloj')

# ------------------------------------------------------------------ cap38 — embedded systems
F('bits-pwm', 'Resolución de un PWM', 'cap38', '"bits" = op("log")_("2") (f_("reloj"))/(f_("PWM"))',
  'n_b = log2(f_clk/f_pwm)', {'n_b': ('Resolución', 'bit', '0', '64'), 'f_clk': ('Frecuencia del reloj del temporizador', 'Hz', '1 kHz', '10 GHz', '16 MHz'),
                              'f_pwm': ('Frecuencia del PWM', 'Hz', '1 Hz', '100 MHz', '20 kHz')}, claves='pwm resolución bits temporizador')
F('cota-rms', 'Cota de utilización de la planificación monótona en tasa', 'cap38', 'U = "Σ" (C_(i))/(T_(i)) lt.eq n dot.op lr(( "2"^(("1")',
  'U_max = 100*n_t*(2^(1/n_t) - 1)', {'U_max': ('Utilización máxima garantizada', '%', '0', '100'), 'n_t': {'n': 'Número de tareas', 'u': '', 'r': ('1', '1000'), 'd': '3', 'sim': 'n'}},
  ej={'n_t': '3', 'U_max': '78,0 %'}, claves='tiempo real rms planificación utilización')
F('utilizacion-3', 'Utilización de la CPU por tres tareas periódicas', 'cap38', 'U = ("0,5")/("10") + ("2")/("20") + ("8")/("100")',
  'U = 100*(C_1/T_1 + C_2/T_2 + C_3/T_3)',
  {'U': ('Utilización', '%', '0', '1000'), 'C_1': ('Tiempo de cálculo de la tarea 1', 's', '1 µs', '100 s', '0,5 ms'), 'T_1': ('Periodo de la tarea 1', 's', '1 µs', '1000 s', '10 ms'),
   'C_2': ('Tiempo de cálculo de la tarea 2', 's', '1 µs', '100 s', '2 ms'), 'T_2': ('Periodo de la tarea 2', 's', '1 µs', '1000 s', '20 ms'),
   'C_3': ('Tiempo de cálculo de la tarea 3', 's', '1 µs', '100 s', '8 ms'), 'T_3': ('Periodo de la tarea 3', 's', '1 µs', '1000 s', '100 ms')},
  ej={'C_1': '0,5 ms', 'T_1': '10 ms', 'C_2': '2 ms', 'T_2': '20 ms', 'C_3': '8 ms', 'T_3': '100 ms', 'U': '23,0 %'}, claves='tiempo real utilización tareas')

# ------------------------------------------------------------------ cap40 — PCB design
F('corriente-pista-ipc', 'Corriente admisible de una pista (IPC-2221)', 'cap40', 'I = k dot.op "Δ" T^("0,44") dot.op A^("0,725")',
  'I = k_ipc*dT^0.44*(w*t_cu/6.4516e-10)^0.725',
  {'I': ('Corriente admisible', 'A', '1 mA', '1 kA'), 'k_ipc': {'n': 'Coeficiente (0,048 exterior, 0,024 interior)', 'u': '', 'r': ('0,01', '0,1'), 'd': '0,048', 'sim': 'k'},
   'dT': {'n': 'Calentamiento admitido', 'u': '°C', 'r': ('1', '100'), 'd': '10', 'sim': 'ΔT'}, 'w': ('Anchura de la pista', 'm', '0,05 mm', '100 mm', '0,5 mm'),
   't_cu': ('Espesor del cobre', 'm', '5 µm', '500 µm', '35 µm')},
  ej={'k_ipc': '0,048', 'dT': '10', 'w': '0,5 mm', 't_cu': '35 µm', 'I': '1,45 A'}, nota='La norma usa la sección en mils cuadrados; aquí se calcula a partir de la anchura y el espesor.',
  claves='ipc pista corriente anchura')
F('resistencia-pista', 'Resistencia de una pista (por cuadros)', 'cap40', '"número de cuadros" = ("longitud")/("anchura")',
  'R = R_sq*l/w', {'R': 'Resistencia de la pista', 'R_sq': ('Resistencia por cuadro', 'Ω/sq', '1e-5', '1', '0,000491'),
                   'l': ('Longitud de la pista', 'm', '0,1 mm', '10 m', '50 mm'), 'w': ('Anchura de la pista', 'm', '0,05 mm', '100 mm', '0,5 mm')},
  ej={'R_sq': '0,000491', 'l': '50 mm', 'w': '0,5 mm', 'R': '49 mΩ'}, claves='pista resistencia cuadros caída')
F('inductancia-via', 'Inductancia de una vía', 'cap40', 'L approx 0","2 dot.op h dot.op lr([ ln((4 h)/d) + 1 ])',
  'L = 2e-7*h*(ln(4*h/d) + 1)', {'L': ('Inductancia de la vía', 'H', '1 pH', '100 nH'), 'h': ('Espesor de la placa (longitud de la vía)', 'm', '0,1 mm', '10 mm', '1,6 mm'),
                                 'd': ('Diámetro del taladro', 'm', '0,05 mm', '5 mm', '0,3 mm')},
  ej={'h': '1,6 mm', 'd': '0,3 mm', 'L': '1,3 nH'}, claves='vía inductancia pcb')
F('seccion-via', 'Sección conductora de una vía', 'cap40', '"sección" = π dot.op d dot.op "espesor"',
  'A = pi*d*t_m', {'A': ('Sección de cobre', 'm²', '1e-12', '1e-4'), 'd': ('Diámetro del taladro', 'm', '0,05 mm', '5 mm', '0,3 mm'),
                   't_m': ('Espesor del metalizado', 'm', '1 µm', '200 µm', '25 µm')},
  ej={'d': '0,3 mm', 't_m': '25 µm', 'A': '0,0236e-6'}, claves='vía corriente metalizado')

# ------------------------------------------------------------------ cap41 — signal and power integrity
F('impedancia-objetivo', 'Impedancia objetivo de la red de alimentación', 'cap41', ['Z_("objetivo") = ("Δ" V_("admisible"))/("Δ" I_("máxima"))', 'Z = ("0,06")/("5") = "12 mΩ"'],
  'Z_t = V*tol/100/dI', {'Z_t': ('Impedancia objetivo', 'Ω', '1 µΩ', '100 Ω'), 'V': 'Tensión de alimentación', 'tol': ('Tolerancia admisible', '%', '0,1', '50', '5'),
                         'dI': {'n': 'Variación máxima de corriente', 'u': 'A', 'r': ('1 mA', '1 kA'), 'd': '5 A', 'sim': 'ΔI'}},
  ej={'V': '1,2 V', 'tol': '5 %', 'dI': '5 A', 'Z_t': '12 mΩ'}, claves='pdn impedancia objetivo desacoplo')
F('rebote-masa', 'Rebote de masa por conmutación simultánea', 'cap41', ['v = N dot.op L dot.op (d i)/(d t)', 'v = "8" times "5 nH" times ("0,02")/("2 ns")'],
  'v = N_s*L*dI/dt', {'v': ('Tensión de rebote', 'V', '1 µV', '100 V'), 'N_s': {'n': 'Salidas que conmutan a la vez', 'u': '', 'r': ('1', '1000'), 'd': '8', 'sim': 'N'},
                      'L': ('Inductancia del retorno', 'H', '0,1 nH', '1 µH', '5 nH'), 'dI': {'n': 'Corriente conmutada por salida', 'u': 'A', 'r': ('1 µA', '10 A'), 'd': '20 mA', 'sim': 'Δi'},
                      'dt': {'n': 'Tiempo de conmutación', 'u': 's', 'r': ('10 ps', '1 µs'), 'd': '2 ns', 'sim': 'Δt'}},
  ej={'N_s': '8', 'L': '5 nH', 'dI': '20 mA', 'dt': '2 ns', 'v': '400 mV'}, claves='ground bounce rebote de masa ssn')
F('terminacion-serie', 'Resistencia de terminación serie', 'cap41', 'R_("s") = Z_("0") - R_("salida") = "50" - "20"',
  'R_s = Z_0 - R_o', {'R_s': ('Resistencia de terminación serie', 'Ω', '0 Ω', '1 kΩ'), 'Z_0': 'Impedancia característica de la línea',
                      'R_o': ('Resistencia de salida del driver', 'Ω', '0 Ω', '1 kΩ', '20 Ω')},
  ej={'Z_0': '50 Ω', 'R_o': '20 Ω', 'R_s': '30 Ω'}, claves='terminación serie línea reflexión')
