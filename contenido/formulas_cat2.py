"""Curated formulas, chapters 9–22 (files cap09–cap22). See formulas.py for the format of F()."""
from formulas import F

# ------------------------------------------------------------------ cap09 — digital logic
F('margen-ruido-alto', 'Margen de ruido en nivel alto', 'cap09', '"NM"_("H") = V_("OH" lr(( "min" ))) - V_("IH" lr(( "min" )))',
  'NM_H = V_OH - V_IH',
  {'NM_H': ('Margen de ruido en nivel alto', 'V', '-5 V', '5 V'), 'V_OH': ('Tensión mínima garantizada de salida en alto', 'V', '0 V', '15 V', '4,4 V'),
   'V_IH': ('Tensión mínima de entrada reconocida como alto', 'V', '0 V', '15 V', '3,5 V')},
  ej={'V_OH': '4,4 V', 'V_IH': '3,5 V', 'NM_H': '0,90 V'}, origen='tabla de la sección 9.7 (CMOS HC a 5 V)', claves='margen de ruido lógica ttl cmos')
F('margen-ruido-bajo', 'Margen de ruido en nivel bajo', 'cap09', 'quad "NM"_("L") = V_("IL" lr(( op("max") ))) - V_("OL" lr(( op("max") )))',
  'NM_L = V_IL - V_OL',
  {'NM_L': ('Margen de ruido en nivel bajo', 'V', '-5 V', '5 V'), 'V_IL': ('Tensión máxima de entrada reconocida como bajo', 'V', '0 V', '15 V', '1,5 V'),
   'V_OL': ('Tensión máxima garantizada de salida en bajo', 'V', '0 V', '15 V', '0,33 V')},
  ej={'V_IL': '1,5 V', 'V_OL': '0,33 V', 'NM_L': '1,17 V'}, origen='tabla de la sección 9.7 (CMOS HC a 5 V)', claves='margen de ruido lógica')
F('mtbf-metaestabilidad', 'MTBF por metaestabilidad de un sincronizador', 'cap09', ['"MTBF" = ("e"^(t_("r") \\/ τ))', ('cap29', '"MTBF" = ("e"^(t_("r") \\/ τ))')],
  'MTBF = exp(t_r/tau)/(T_0*f_clk*f_dat)',
  {'MTBF': ('Tiempo medio entre fallos', 's', '1e-9', '1e300'), 't_r': ('Tiempo concedido para resolverse', 's', '10 ps', '1 µs', '5 ns'),
   'tau': ('Constante de resolución del flip-flop', 's', '1 ps', '10 ns', '100 ps'),
   'T_0': ('Constante T₀ del dispositivo', 's', '1e-15', '1e-6', '1e-10'), 'f_clk': ('Frecuencia del reloj de muestreo', 'Hz', '1 kHz', '10 GHz', '100 MHz'),
   'f_dat': ('Frecuencia de cambios de la señal asíncrona', 'Hz', '1 Hz', '1 GHz', '1 MHz')},
  ej={'t_r': '4 ns', 'tau': '0,2 ns', 'T_0': '1 ns', 'f_clk': '200 MHz', 'f_dat': '5 MHz', 'MTBF': '485 s'}, origen='problema @prob-29.B (un biestable)',
  claves='metaestabilidad sincronizador flip-flop mtbf')

# ------------------------------------------------------------------ cap10 — power, protection, thermal
F('temperatura-union', 'Temperatura de la unión (cadena térmica)', 'cap10', ['T_("unión") = T_("ambiente") + P dot.op lr(( R_("jc") + R_("cs") + R_("sa") ))', ('cap47', 'T_("unión") = T_("ambiente") + P times lr(( R_("jc")'), ('cap47', 'T_("unión") = "40" + "10" times "3,5"')],
  'T_J = T_A + P*(R_jc + R_cs + R_sa)',
  {'T_J': 'Temperatura de la unión', 'T_A': 'Temperatura ambiente', 'P': 'Potencia disipada',
   'R_jc': ('Resistencia térmica unión-cápsula', '°C/W', '0,01', '200', '1'), 'R_cs': ('Resistencia térmica cápsula-disipador', '°C/W', '0', '10', '0,5'),
   'R_sa': ('Resistencia térmica disipador-ambiente', '°C/W', '0,05', '200', '2,5')},
  ej={'T_A': '40', 'P': '15 W', 'R_jc': '1', 'R_cs': '0,5', 'R_sa': '2,5', 'T_J': '100'}, claves='disipador térmica temperatura unión')
F('disipador-necesario', 'Resistencia térmica máxima del disipador', 'cap10', ['R_("sa") lt.eq (T_(j lr(( op("max") ))) - T_("amb"))/(P)', ('cap47', 'R_("sa") = (T_("unión" , op("máx")) - T_("amb"))/(P)'), ('cap47', 'R_("sa") = ("120" - "40")/("5")'), ('cap50', 'R_("sa") lt.eq (T_(j lr(( op("max") ))) - T_("amb"))/(P)')],
  'R_sa = (T_J - T_A)/P - (R_jc + R_cs)',
  {'R_sa': ('Resistencia térmica disipador-ambiente máxima', '°C/W', '-100', '1000'), 'T_J': 'Temperatura máxima de la unión',
   'T_A': 'Temperatura ambiente', 'P': 'Potencia disipada', 'R_jc': ('Resistencia térmica unión-cápsula', '°C/W', '0,01', '200', '1'),
   'R_cs': ('Resistencia térmica cápsula-disipador', '°C/W', '0', '10', '0,5')},
  ej={'T_J': '150', 'T_A': '40', 'P': '15 W', 'R_jc': '1', 'R_cs': '0,5', 'R_sa': '5,83'}, claves='disipador elección resistencia térmica')

# ------------------------------------------------------------------ cap13 — soldering
F('energia-soldadura', 'Energía para formar una junta de soldadura', 'cap13', 'E = m_("estaño") dot.op lr(( c_("e") dot.op "Δ" T + L_("f") ))',
  'E = m_s*(c_s*dT + L_f) + m_cu*c_cu*dT',
  {'E': ('Energía necesaria', 'J', '1 mJ', '1 kJ'), 'm_s': ('Masa de estaño', 'g', '1 mg', '100 g', '50 mg'),
   'c_s': ('Calor específico del estaño', 'J/(g·K)', '0,05', '2', '0,167'), 'dT': {'n': 'Salto de temperatura', 'u': 'K', 'r': ('1', '500'), 'd': '195', 'sim': 'ΔT'},
   'L_f': ('Calor latente de fusión del estaño', 'J/g', '1', '500', '40'), 'm_cu': ('Masa de cobre (pad y patilla)', 'g', '0', '100 g', '15 mg'),
   'c_cu': ('Calor específico del cobre', 'J/(g·K)', '0,05', '2', '0,385')},
  ej={'m_s': '50 mg', 'c_s': '0,167', 'dT': '195', 'L_f': '40', 'm_cu': '15 mg', 'c_cu': '0,385', 'E': '4,75 J'}, claves='soldadura energía estaño')
F('r-termica-plano', 'Resistencia térmica radial de un plano de cobre', 'cap13', 'R_("plano") = (ln lr(( r_(2) \\/ r_(1) )))',
  'R_th = ln(r_2/r_1)/(2*pi*k_t*e)',
  {'R_th': ('Resistencia térmica del plano', 'K/W', '0,01', '1e4'), 'r_2': ('Radio exterior', 'm', '0,1 mm', '1 m', '15 mm'),
   'r_1': ('Radio del pad', 'm', '0,01 mm', '1 m', '1 mm'), 'k_t': ('Conductividad térmica', 'W/(m·K)', '0,1', '1000', '400'),
   'e': ('Espesor del cobre', 'm', '1 µm', '1 mm', '35 µm')},
  ej={'r_2': '15 mm', 'r_1': '1 mm', 'k_t': '400', 'e': '35 µm', 'R_th': '31'}, tol=0.02, claves='alivio térmico plano de cobre soldadura')

# ------------------------------------------------------------------ cap16 — FM receiver (printed chapter 15)
F('frecuencia-intermedia', 'Frecuencia intermedia de un superheterodino', 'cap16', ['f_("FI") = f_("OL") - f_("señal")', 'f_("oscilador") - f_("emisora") = "10,7 MHz"'],
  'f_FI = f_OL - f_s',
  {'f_FI': ('Frecuencia intermedia', 'Hz', '1 kHz', '10 GHz'), 'f_OL': ('Frecuencia del oscilador local', 'Hz', '1 kHz', '10 GHz', '1,455 MHz'),
   'f_s': ('Frecuencia de la emisora', 'Hz', '1 kHz', '10 GHz', '1 MHz')},
  ej={'f_OL': '1,455 MHz', 'f_s': '1 MHz', 'f_FI': '455 kHz'}, origen='sección @sec-16.19 (onda media)', claves='superheterodino frecuencia intermedia mezclador')
F('frecuencia-imagen', 'Frecuencia imagen', 'cap16', ['f_("imagen") = f_("oscilador") + "FI" = f_("emisora") + "2" dot.op "FI"', 'f_("imagen") = f_("OL") + f_("FI")'],
  'f_im = f_s + 2*f_FI',
  {'f_im': ('Frecuencia imagen', 'Hz', '1 kHz', '10 GHz'), 'f_s': ('Frecuencia de la emisora', 'Hz', '1 kHz', '10 GHz', '1 MHz'),
   'f_FI': ('Frecuencia intermedia', 'Hz', '1 kHz', '10 GHz', '455 kHz')},
  ej={'f_s': '1 MHz', 'f_FI': '455 kHz', 'f_im': '1,91 MHz'}, claves='frecuencia imagen superheterodino')

# ------------------------------------------------------------------ cap17 — Arduino
F('lsb-adc', 'Escalón (LSB) de un convertidor', 'cap17', '"LSB" = (V_("ref"))/("1024")',
  'LSB = V_ref/2^n_b',
  {'LSB': ('Valor de un escalón (LSB)', 'V', '1 nV', '10 V'), 'V_ref': 'Tensión de referencia',
   'n_b': {'n': 'Resolución', 'u': 'bit', 'r': ('1', '32'), 'd': '10', 'entero': True, 'sim': 'n'}},
  ej={'V_ref': '5 V', 'n_b': '10', 'LSB': '4,8828 mV'}, tol=0.0001, claves='adc lsb resolución bits')
F('adc-centro', 'Tensión que corresponde a un código del ADC', 'cap17', 'V approx (lr(( k + "0,5" )) dot.op V_("ref"))/("1024")',
  'V = (k + 0.5)*V_ref/2^n_b',
  {'V': 'Tensión estimada (centro del escalón)', 'k': {'n': 'Código leído', 'u': '', 'r': ('0', '1e7'), 'd': '512', 'lineal': True},
   'V_ref': 'Tensión de referencia', 'n_b': {'n': 'Resolución', 'u': 'bit', 'r': ('1', '32'), 'd': '10', 'entero': True, 'sim': 'n'}},
  claves='adc código conversión analogread')
F('adc-arduino', 'Conversión de analogRead() a tensión', 'cap17', 'V_("entrada") = "analogRead" space lr(( "pin" ))',
  'V = N*V_ref/1023',
  {'V': 'Tensión de entrada', 'N': {'n': 'Lectura de analogRead()', 'u': '', 'r': ('0', '1023'), 'd': '512', 'lineal': True},
   'V_ref': 'Tensión de referencia'}, claves='arduino analogread adc')
F('desbordamiento-millis', 'Tiempo hasta el desbordamiento de un contador', 'cap17', '"2"^("32") "ms" = "49,7" space "días"',
  'T_d = 2^n_b*t_tick/86400',
  {'T_d': ('Tiempo hasta dar la vuelta', 'días', '1e-9', '1e12'), 'n_b': {'n': 'Bits del contador', 'u': 'bit', 'r': ('8', '64'), 'd': '32', 'entero': True, 'sim': 'n'},
   't_tick': ('Periodo de cada cuenta', 's', '1 ns', '1 s', '1 ms')},
  ej={'n_b': '32', 't_tick': '1 ms', 'T_d': '49,7'}, claves='millis desbordamiento contador')

# ------------------------------------------------------------------ cap18 — microcontroller projects
F('consumo-medio', 'Consumo medio con ciclo de trabajo', 'cap18', ['I_("media") = I_("activa") times (t_("activo"))/(T)', ('cap49', 'I_("media") = "0,01" times "150 mA"'), ('cap38', 'I_("media") = (I_("activa") dot.op t_("activa") + I_("reposo")')],
  'I_m = I_a*t_a/T + I_s*(1 - t_a/T)',
  {'I_m': ('Consumo medio', 'A', '1 nA', '10 A'), 'I_a': ('Corriente en actividad', 'A', '1 µA', '10 A', '20 mA'),
   't_a': ('Tiempo activo en cada ciclo', 's', '1 µs', '3600 s', '100 ms'), 'T': ('Periodo del ciclo', 's', '1 ms', '1e6 s', '60 s'),
   'I_s': ('Corriente durmiendo', 'A', '1 nA', '100 mA', '5 µA')},
  ej={'I_a': '20 mA', 't_a': '100 ms', 'T': '60 s', 'I_s': '5 µA', 'I_m': '38 µA'}, claves='consumo medio pilas autonomía sleep')
F('autonomia', 'Autonomía de una batería', 'cap18', ['"autonomía" = ("capacidad")/("consumo medio")', ('cap38', '"Autonomía" = (C_("batería"))/(I_("media"))'), ('cap38', '("2000 mAh")/("0,043 mA")')],
  't_h = Q_Ah/I_m',
  {'t_h': ('Autonomía', 'h', '1e-3', '1e7'), 'Q_Ah': {'n': 'Capacidad de la batería', 'u': 'Ah', 'r': ('1 mAh', '1000 Ah'), 'd': '2 Ah', 'sim': 'Q'},
   'I_m': ('Consumo medio', 'A', '1 nA', '100 A', '38 µA')},
  ej={'Q_Ah': '2 Ah', 'I_m': '0,043 mA', 't_h': '46 512'}, origen='tarjeta del capítulo @cap-38', claves='autonomía batería mAh')
F('optoacoplador-if', 'Corriente del LED de un optoacoplador', 'cap18', 'I_("F") = (I_("C"))/("CTR"_("efectiva"))',
  'I_F = I_C/(CTR/100)',
  {'I_F': 'Corriente del LED', 'I_C': ('Corriente de colector necesaria', 'A', '1 µA', '1 A', '5 mA'),
   'CTR': ('Relación de transferencia de corriente efectiva', '%', '1', '1000', '25')},
  ej={'I_C': '5 mA', 'CTR': '25 %', 'I_F': '20 mA'}, claves='optoacoplador ctr')
F('condensador-respaldo', 'Condensador para mantener una potencia un tiempo', 'cap18', 'C = ("2" dot.op P dot.op t)/(V_("1")^("2") - V_("2")^("2"))',
  'C = 2*P*t/(V_1^2 - V_2^2)',
  {'C': ('Capacidad necesaria', 'F', '1 µF', '1000 F'), 'P': 'Potencia de la carga', 't': ('Tiempo que debe mantenerse', 's', '1 µs', '1e4 s', '50 ms'),
   'V_1': ('Tensión inicial', 'V', '0,1 V', '1 kV', '5 V'), 'V_2': ('Tensión mínima admisible', 'V', '0 V', '1 kV', '4,5 V')},
  ej={'P': '2,5 W', 't': '50 ms', 'V_1': '5 V', 'V_2': '4,5 V', 'C': '53 mF'}, claves='supercondensador respaldo apagado energía')

# ------------------------------------------------------------------ cap19 — data acquisition
F('caudal-datos', 'Caudal de datos de una adquisición', 'cap19', '"caudal" approx n times f_("s") times m times "factor"',
  'R_b = n_c*f_s*m*k_p',
  {'R_b': ('Caudal', 'bit/s', '1', '1e12'), 'n_c': {'n': 'Número de canales', 'u': '', 'r': ('1', '1024'), 'd': '8', 'entero': True, 'sim': 'n'},
   'f_s': 'Frecuencia de muestreo por canal', 'm': {'n': 'Bits por muestra', 'u': 'bit', 'r': ('1', '64'), 'd': '16', 'entero': True},
   'k_p': {'n': 'Factor de sobrecarga del protocolo', 'u': '', 'r': ('1', '10'), 'd': '2', 'sim': 'factor'}},
  ej={'n_c': '8', 'f_s': '100 Hz', 'm': '16', 'k_p': '2', 'R_b': '25 600'}, claves='caudal baudios uart adquisición')

# ------------------------------------------------------------------ cap20 — sensors and interfaces
F('capacidad-carga-cristal', 'Condensadores de carga de un cristal', 'cap20', 'C_("L") = (C_(1) dot.op C_(2))/(C_(1) + C_(2)) + C_("parásita")',
  'C_L = C_1*C_2/(C_1 + C_2) + C_p',
  {'C_L': ('Capacidad de carga del cristal', 'F', '1 pF', '1 nF'), 'C_1': ('Condensador C₁', 'F', '1 pF', '1 nF', '28 pF'),
   'C_2': ('Condensador C₂', 'F', '1 pF', '1 nF', '28 pF'), 'C_p': ('Capacidad parásita', 'F', '0 pF', '50 pF', '4 pF')},
  ej={'C_1': '28 pF', 'C_2': '28 pF', 'C_p': '4 pF', 'C_L': '18 pF'}, claves='cristal oscilador capacidad de carga')
F('puente-exacto', 'Salida exacta de un puente con una rama activa', 'cap20', '(V_("out"))/(V_("exc")) = (R + "Δ" R)/("2" R + "Δ" R) - "½"',
  'V_out = V_exc*((R + dR)/(2*R + dR) - 0.5)',
  {'V_out': ('Tensión de salida del puente', 'V', '-10 V', '10 V'), 'V_exc': ('Tensión de excitación', 'V', '0,1 V', '50 V', '5 V'),
   'R': 'Resistencia de las ramas', 'dR': {'n': 'Variación de la resistencia activa', 'u': 'Ω', 'r': ('-1 kΩ', '1 kΩ'), 'sim': 'ΔR', 'lineal': True, 'd': '1 Ω'}},
  ej={'V_exc': '5 V', 'R': '1 kΩ', 'dR': '1 Ω', 'V_out': '1,2494 mV'}, tol=0.001, origen='comprobación de la sección 2.9',
  claves='puente wheatstone no linealidad galga')

# ------------------------------------------------------------------ cap21 — oscilloscope
F('ciclos-pantalla', 'Ciclos en la pantalla del osciloscopio', 'cap21', '"ciclos en pantalla" = "12" space "divisiones"',
  'n = 12*t_div*f', {'n': {'n': 'Ciclos visibles', 'u': '', 'r': ('0', '1e6'), 'lineal': True},
                     't_div': ('Base de tiempos', 's', '1 ns', '100 s', '200 µs'), 'f': 'Frecuencia de la señal'},
  claves='osciloscopio base de tiempos divisiones')
F('resolucion-fft', 'Resolución de una FFT', 'cap21', '"resolución" = ("1")/(T)', 'df = 1/T',
  {'df': {'n': 'Resolución espectral', 'u': 'Hz', 'r': ('1 µHz', '1 GHz'), 'sim': 'Δf'}, 'T': ('Tiempo de captura', 's', '1 ns', '1e4 s', '100 ms')},
  ej={'T': '100 ms', 'df': '10 Hz'}, claves='fft resolución espectro')
F('resolucion-fft-n', 'Resolución de una FFT por número de muestras', 'cap21', ['"Δ" f = (f_("s"))/(N) lr(( "resolución espectral"', ('cap30', '"Δ" f = (f_("s"))/(N) $')],
  'df = f_s/N', {'df': {'n': 'Resolución espectral', 'u': 'Hz', 'r': ('1 µHz', '1 GHz'), 'sim': 'Δf'}, 'f_s': 'Frecuencia de muestreo',
                 'N': {'n': 'Número de muestras', 'u': '', 'r': ('16', '1e9'), 'd': '1024'}},
  ej={'f_s': '48 kHz', 'N': '1024', 'df': '46,9 Hz'}, origen='sección @sec-30.6', claves='fft resolución muestras')
F('muestras-fft', 'Número de puntos de una captura', 'cap21', 'N = f_("muestreo") dot.op T_("captura")',
  'N = f_s*T', {'N': {'n': 'Número de puntos', 'u': '', 'r': ('1', '1e12')}, 'f_s': 'Frecuencia de muestreo', 'T': ('Tiempo de captura', 's', '1 ns', '1e4 s', '100 ms')},
  ej={'f_s': '1 MHz', 'T': '100 ms', 'N': '100 000'}, claves='memoria muestras captura')
F('nyquist-fft', 'Frecuencia máxima de una FFT (Nyquist)', 'cap21', '"frecuencia máxima" = (f_("muestreo"))/("2")',
  'f_max = f_s/2', {'f_max': ('Frecuencia máxima representable', 'Hz', '1 mHz', '100 GHz'), 'f_s': 'Frecuencia de muestreo'},
  ej={'f_s': '83 kHz', 'f_max': '42 kHz'}, tol=0.02, origen='tabla de la sección @sec-21.20', claves='nyquist aliasing muestreo')
F('thd-desde-db', 'THD a partir de los armónicos en dB', 'cap21', '"THD" = sqrt("10"^((A_("2"))\\/("10"))',
  'THD = 100*sqrt(10^(A_2/10) + 10^(A_3/10))',
  {'THD': ('Distorsión armónica total', '%', '0', '100'), 'A_2': {'n': 'Segundo armónico respecto a la fundamental', 'u': 'dB', 'r': ('-150', '0'), 'd': '-60', 'lineal': True},
   'A_3': {'n': 'Tercer armónico respecto a la fundamental', 'u': 'dB', 'r': ('-150', '0'), 'd': '-66', 'lineal': True}},
  ej={'A_2': '-60', 'A_3': '-66', 'THD': '0,11 %'}, tol=0.03, claves='thd fft armónicos distorsión')
F('ruido-por-hz', 'Nivel de ruido referido a 1 Hz', 'cap21', '"nivel por" space "Hz" = "nivel leído" - "10"',
  'L_Hz = L - 10*log10(RBW)',
  {'L_Hz': ('Nivel referido a 1 Hz', 'dBm', '-250', '50'), 'L': {'n': 'Nivel leído', 'u': 'dBm', 'r': ('-200', '50'), 'd': '-90', 'lineal': True},
   'RBW': ('Resolución (ancho de banda por línea)', 'Hz', '1 mHz', '10 MHz', '100 Hz')},
  ej={'L': '-90', 'RBW': '100 Hz', 'L_Hz': '-110'}, claves='suelo de ruido fft dBm/Hz')
F('rizado-porcentaje', 'Rizado en porcentaje', 'cap21', '"Rizado" space lr(( \\% )) = (V_("rizado") lr(( "pp" )))',
  'r = 100*V_r/V_DC', {'r': ('Rizado relativo', '%', '0', '100'), 'V_r': ('Rizado pico a pico', 'V', '1 µV', '100 V', '50 mV'),
                       'V_DC': ('Tensión continua de salida', 'V', '0,1 V', '1 kV', '12 V')}, claves='rizado fuente')
F('tiempo-subida-bw', 'Tiempo de subida y ancho de banda', 'cap21', ['t_("r") = ("0,35")/("BW") = ("0,35")/("50 MHz")', ('cap22', 't_("r") = ("0,35")/("BW") $'), ('cap27', 'quad t_("subida") approx ("0,35")/("BW")')],
  't_r = 0.35/BW', {'t_r': ('Tiempo de subida (10–90 %)', 's', '1 ps', '1 s'), 'BW': 'Ancho de banda (−3 dB)'},
  ej={'BW': '50 MHz', 't_r': '7 ns'}, claves='tiempo de subida ancho de banda osciloscopio')
F('muestreo-real', 'Velocidad de muestreo real con memoria limitada', 'cap21', 'f_("muestreo") = ("puntos de memoria")/("divisiones"',
  'f_s = N_m/(n_div*t_div)',
  {'f_s': 'Frecuencia de muestreo real', 'N_m': {'n': 'Puntos de memoria', 'u': '', 'r': ('100', '1e9'), 'd': '1000'},
   'n_div': {'n': 'Divisiones horizontales', 'u': '', 'r': ('8', '20'), 'd': '12', 'entero': True},
   't_div': ('Base de tiempos', 's', '1 ns', '100 s', '1 ms')},
  ej={'N_m': '1000', 'n_div': '12', 't_div': '1 ms', 'f_s': '83 kHz'}, tol=0.01, claves='muestreo memoria osciloscopio aliasing')
F('tiempo-subida-combinado', 'Tiempo de subida medido (combinación en cuadratura)', 'cap22', ['t_("medido") = sqrt(t_("señal")^("2") + t_("instrumento")^("2"))', ('cap47', 't_("medido") = sqrt(t_("señal")^("2") + t_("instrumento")^("2"))')],
  't_m = sqrt(t_s^2 + t_i^2)',
  {'t_m': ('Tiempo de subida medido', 's', '1 ps', '1 s'), 't_s': ('Tiempo de subida de la señal', 's', '1 ps', '1 s', '5 ns'),
   't_i': ('Tiempo de subida del instrumento', 's', '1 ps', '1 s', '7 ns')},
  ej={'t_s': '5 ns', 't_i': '7 ns', 't_m': '8,6 ns'}, origen='sección @sec-21.20', claves='tiempo de subida osciloscopio')

# ------------------------------------------------------------------ cap22 — practices
F('ne555-t-alto', 'Tiempo en alto del 555 astable', 'cap22', 't_("alto") = "0,693" dot.op lr(( R_("A") + R_("B") )) dot.op C',
  't_H = 0.693*(R_A + R_B)*C',
  {'t_H': ('Tiempo en alto', 's', '1 µs', '1e4 s'), 'R_A': ('Resistencia R_A', 'Ω', '100 Ω', '10 MΩ', '10 kΩ'),
   'R_B': ('Resistencia R_B', 'Ω', '100 Ω', '10 MΩ', '47 kΩ'), 'C': 'Capacidad de temporización'},
  ej={'R_A': '10 kΩ', 'R_B': '47 kΩ', 'C': '1 µF', 't_H': '39,5 ms'}, claves='555 astable tiempo alto')
F('ne555-t-bajo', 'Tiempo en bajo del 555 astable', 'cap22', 't_("bajo") = "0,693" dot.op R_("B") dot.op C',
  't_L = 0.693*R_B*C',
  {'t_L': ('Tiempo en bajo', 's', '1 µs', '1e4 s'), 'R_B': ('Resistencia R_B', 'Ω', '100 Ω', '10 MΩ', '47 kΩ'), 'C': 'Capacidad de temporización'},
  ej={'R_B': '47 kΩ', 'C': '1 µF', 't_L': '32,6 ms'}, claves='555 astable tiempo bajo')
F('z0-lc', 'Impedancia característica de un circuito LC', 'cap22', 'Z_("0") = sqrt((L)/(C)) = "316 Ω"',
  'Z_0 = sqrt(L/C)', {'Z_0': ('Impedancia característica', 'Ω', '0,01 Ω', '1 MΩ'), 'L': 'Inductancia', 'C': 'Capacidad'},
  ej={'L': '10 mH', 'C': '100 nF', 'Z_0': '316 Ω'}, claves='impedancia característica resonante tanque')
F('q-serie', 'Factor de calidad a partir de Z₀ y R', 'cap22', 'Q = (Z_("0"))/(R) = "3,16"',
  'Q = Z_0/R', {'Q': 'Factor de calidad', 'Z_0': ('Impedancia característica √(L/C)', 'Ω', '0,01 Ω', '1 MΩ', '316 Ω'), 'R': 'Resistencia serie total'},
  ej={'Z_0': '316 Ω', 'R': '100 Ω', 'Q': '3,16'}, claves='factor de calidad q resonancia serie')
F('bw-q', 'Ancho de banda de un circuito resonante', 'cap22', ['"BW" = (f_("0"))/(Q) = "1 592 Hz"', ('cap36', 'Q = ("100 MHz")/("200 kHz") = "500"'), ('cap36', 'Q = ("10,7 MHz")/("200 kHz") approx "53"')],
  'BW = f_0/Q', {'BW': 'Ancho de banda a −3 dB', 'f_0': 'Frecuencia de resonancia', 'Q': 'Factor de calidad'},
  ej={'f_0': '5033 Hz', 'Q': '3,16', 'BW': '1592 Hz'}, claves='ancho de banda q resonancia selectividad')
F('indice-am', 'Índice de modulación AM medido en pantalla', 'cap22', 'm = (A_(op("max")) - A_("min"))/(A_(op("max")) + A_("min"))',
  'm = (A_max - A_min)/(A_max + A_min)',
  {'m': ('Índice de modulación', '', '0', '1'), 'A_max': ('Amplitud máxima de la envolvente', 'V', '1 mV', '1 kV', '3 V'),
   'A_min': ('Amplitud mínima de la envolvente', 'V', '0 V', '1 kV', '1 V')},
  ej={'A_max': '3 V', 'A_min': '1 V', 'm': '0,5'}, claves='am modulación índice envolvente')
F('carson', 'Ancho de banda de FM (regla de Carson)', 'cap22', ['B approx "2" dot.op lr(( "Δ" f + f_(m) ))', ('cap31', '"BW" approx "2" dot.op lr(( "Δ" f + f_(op("max")) ))')],
  'B = 2*(df + f_m)', {'B': ('Ancho de banda ocupado', 'Hz', '1 Hz', '10 GHz'), 'df': {'n': 'Desviación de frecuencia', 'u': 'Hz', 'r': ('1 Hz', '1 GHz'), 'd': '5 kHz', 'sim': 'Δf'},
                       'f_m': ('Frecuencia moduladora', 'Hz', '1 Hz', '1 GHz', '1 kHz')},
  ej={'df': '5 kHz', 'f_m': '1 kHz', 'B': '12 kHz'}, claves='fm carson ancho de banda')

# ------------------------------------------------------------------ cap23 — circuit analysis
F('thevenin-medida', 'Resistencia de Thévenin medida con una carga', 'cap23', 'R_("Th") = R_("L") dot.op lr(( (V_("vacío"))/(V_("carga")) - "1" ))',
  'R_Th = R_L*(V_0/V_c - 1)',
  {'R_Th': ('Resistencia de Thévenin (interna)', 'Ω', '0', '10 MΩ'), 'R_L': 'Resistencia de carga conocida',
   'V_0': ('Tensión en vacío', 'V', '1 mV', '1 kV', '5 V'), 'V_c': ('Tensión con la carga', 'V', '1 mV', '1 kV', '4,85 V')},
  ej={'R_L': '100 Ω', 'V_0': '5,00 V', 'V_c': '4,85 V', 'R_Th': '3,1 Ω'}, claves='thevenin medida resistencia interna')
F('norton', 'Corriente de Norton', 'cap23', 'I_("N") = (V_("Th"))/(R_("Th")) quad R_("N") = R_("Th")',
  'I_N = V_Th/R_Th', {'I_N': ('Corriente de Norton (cortocircuito)', 'A', '1 nA', '1 kA'), 'V_Th': 'Tensión de Thévenin', 'R_Th': 'Resistencia de Thévenin'},
  ej={'V_Th': '9 V', 'R_Th': '3 Ω', 'I_N': '3 A'}, claves='norton thevenin cortocircuito')
F('potencia-maxima', 'Máxima transferencia de potencia', 'cap23', 'R_("L") = R_("Th") quad P_(op("max")) = (V_("Th")^("2"))/("4" dot.op R_("Th"))',
  'P_max = V_Th^2/(4*R_Th)', {'P_max': ('Potencia máxima en la carga (R_L = R_Th)', 'W', '1 µW', '1 MW'), 'V_Th': 'Tensión de Thévenin', 'R_Th': 'Resistencia de Thévenin'},
  ej={'V_Th': '10 V', 'R_Th': '50 Ω', 'P_max': '0,50000 W'}, tol=0.0001, claves='máxima transferencia de potencia adaptación')
F('potencia-carga', 'Potencia en la carga de una fuente real', 'cap23', 'P lr(( R_("L") )) = lr([ "V"_("Th") \\/ lr(( R_("Th") + R_("L") )) ])^("2") dot.op R_("L")',
  'P = (V_Th/(R_Th + R_L))^2*R_L', {'P': 'Potencia en la carga', 'V_Th': ('Tensión de Thévenin', 'V', '1 mV', '1 kV', '10 V'),
                                    'R_Th': ('Resistencia de Thévenin', 'Ω', '1 mΩ', '10 MΩ', '50 Ω'), 'R_L': ('Resistencia de carga', 'Ω', '1 mΩ', '100 MΩ', '100 Ω')},
  nota='Para una potencia dada hay dos cargas posibles, R<sub>L</sub> y R<sub>Th</sub>²/R<sub>L</sub>; al despejar se elige la más cercana al valor anterior.', claves='potencia carga thevenin')
F('millman-3', 'Teorema de Millman (tres ramas)', 'cap23', 'V = ((V_("1"))/(R_("1")) + (V_("2"))/(R_("2"))',
  'V = (V_1/R_1 + V_2/R_2 + V_3/R_3)/(1/R_1 + 1/R_2 + 1/R_3)',
  {'V': ('Tensión del nodo común', 'V', '-1 kV', '1 kV'), 'V_1': ('Fuente de la rama 1', 'V', '-1 kV', '1 kV', '12 V'), 'R_1': 'Resistencia de la rama 1',
   'V_2': ('Fuente de la rama 2', 'V', '-1 kV', '1 kV', '5 V'), 'R_2': 'Resistencia de la rama 2', 'V_3': ('Fuente de la rama 3', 'V', '-1 kV', '1 kV', '0 V'),
   'R_3': 'Resistencia de la rama 3'},
  ej={'V_1': '12 V', 'R_1': '1 kΩ', 'V_2': '5 V', 'R_2': '2 kΩ', 'V_3': '0 V', 'R_3': '4,7 kΩ', 'V': '8,47 V'}, claves='millman nodo media ponderada')

# ------------------------------------------------------------------ cap24 — alternating current
F('fase-retardo', 'Desfase a partir del retardo', 'cap24', 'φ = "360°" dot.op ("Δ" t)/(T)', 'phi = 360*dt/T',
  {'phi': {'n': 'Desfase', 'u': '°', 'r': ('-360', '360'), 'lineal': True}, 'dt': {'n': 'Retardo entre las dos señales', 'u': 's', 'r': ('-1 s', '1 s'), 'sim': 'Δt', 'lineal': True, 'd': '125 µs'},
   'T': 'Periodo'}, claves='fase desfase osciloscopio retardo')
F('z-rc-serie', 'Impedancia de un RC serie', 'cap24', 'bar.v Z bar.v = "1 880 Ω"', 'Z = sqrt(R^2 + (1/(2*pi*f*C))^2)',
  {'Z': 'Módulo de la impedancia', 'R': 'Resistencia', 'f': 'Frecuencia', 'C': 'Capacidad'},
  ej={'R': '1000 Ω', 'f': '1 kHz', 'C': '100 nF', 'Z': '1880 Ω'}, claves='impedancia rc serie fasor')
F('z-rlc-serie', 'Impedancia de un RLC serie', 'cap24', 'Z = R + j lr(( ω dot.op L - ("1")/(ω dot.op C) )) quad I = (V)/(Z)',
  'Z = sqrt(R^2 + (2*pi*f*L - 1/(2*pi*f*C))^2)', {'Z': 'Módulo de la impedancia', 'R': 'Resistencia', 'f': 'Frecuencia', 'L': 'Inductancia', 'C': 'Capacidad'},
  claves='impedancia rlc serie resonancia')
F('potencia-aparente', 'Potencia aparente', 'cap24', ['S = V dot.op I $', 'S = "230" times "10" = "2 300 VA"'],
  'S = V*I', {'S': ('Potencia aparente', 'VA', '1 mVA', '10 MVA'), 'V': 'Tensión eficaz', 'I': 'Corriente eficaz'},
  ej={'V': '230 V', 'I': '10 A', 'S': '2300'}, claves='potencia aparente va')
F('potencia-activa', 'Potencia activa', 'cap24', ['P = V dot.op I dot.op op("cos") φ', 'P = "2 300" times "0,8" = "1 840 W"'],
  'P = V*I*FP', {'P': 'Potencia activa', 'V': 'Tensión eficaz', 'I': 'Corriente eficaz', 'FP': ('Factor de potencia (cos φ)', '', '0', '1', '0,8')},
  ej={'V': '230 V', 'I': '10 A', 'FP': '0,8', 'P': '1840 W'}, claves='potencia activa factor de potencia')
F('potencia-reactiva', 'Potencia reactiva', 'cap24', ['Q = V dot.op I dot.op op("sen") φ', 'Q = "2 300" times "0,6" = "1 380 VAr"'],
  'Q_r = V*I*sqrt(1 - FP^2)', {'Q_r': {'n': 'Potencia reactiva', 'u': 'VAr', 'r': ('0', '10 MVAr'), 'sim': 'Q'}, 'V': 'Tensión eficaz', 'I': 'Corriente eficaz',
                               'FP': ('Factor de potencia (cos φ)', '', '0', '1', '0,8')},
  ej={'V': '230 V', 'I': '10 A', 'FP': '0,8', 'Q_r': '1380'}, claves='potencia reactiva var')
F('triangulo-potencias', 'Triángulo de potencias', 'cap24', 'S^("2") = P^("2") + Q^("2") quad "FP" = op("cos") φ = (P)/(S)',
  'S = sqrt(P^2 + Q_r^2)', {'S': ('Potencia aparente', 'VA', '1 mVA', '10 MVA'), 'P': 'Potencia activa',
                            'Q_r': {'n': 'Potencia reactiva', 'u': 'VAr', 'r': ('0', '10 MVAr'), 'd': '1380', 'sim': 'Q'}},
  ej={'P': '1840 W', 'Q_r': '1380', 'S': '2300'}, claves='triángulo de potencias')
F('factor-potencia', 'Factor de potencia', 'cap24', '"FP" = (P)/(S) = op("cos") φ', 'FP = P/S',
  {'FP': ('Factor de potencia', '', '0', '1'), 'P': 'Potencia activa', 'S': ('Potencia aparente', 'VA', '1 mVA', '10 MVA', '2300')},
  ej={'P': '1840 W', 'S': '2300', 'FP': '0,8'}, claves='factor de potencia cos phi')
F('compensacion-total', 'Condensador para compensar toda la reactiva', 'cap24', 'C = (Q)/("2" π dot.op f dot.op V^("2"))',
  'C = Q_r/(2*pi*f*V^2)', {'C': 'Capacidad de compensación', 'Q_r': {'n': 'Potencia reactiva a compensar', 'u': 'VAr', 'r': ('1 mVAr', '10 MVAr'), 'd': '1380', 'sim': 'Q'},
                           'f': ('Frecuencia de la red', 'Hz', '1 Hz', '1 kHz', '50 Hz'), 'V': 'Tensión eficaz'},
  ej={'Q_r': '1380', 'f': '50 Hz', 'V': '230 V', 'C': '83 µF'}, claves='compensación factor de potencia condensador')
F('compensacion-fp', 'Condensador de corrección del factor de potencia', 'cap24', 'C = (P dot.op lr(( op("tan") φ_("1") - op("tan") φ_("2") )))/(ω dot.op V^("2"))',
  'C = P*(tan(acos(FP_1)) - tan(acos(FP_2)))/(2*pi*f*V^2)',
  {'C': 'Capacidad de corrección', 'P': 'Potencia activa', 'FP_1': ('Factor de potencia inicial', '', '0,05', '1', '0,8'),
   'FP_2': ('Factor de potencia objetivo', '', '0,05', '1', '0,95'), 'f': ('Frecuencia de la red', 'Hz', '1 Hz', '1 kHz', '50 Hz'), 'V': 'Tensión eficaz'},
  ej={'P': '1840 W', 'FP_1': '0,8', 'FP_2': '1', 'f': '50 Hz', 'V': '230 V', 'C': '83 µF'}, origen='sección @sec-24.8', claves='corrección factor de potencia')
F('q-rlc', 'Factor de calidad de un RLC serie (L, C, R)', 'cap24', ['Q = (ω_("0") dot.op L)/(R) = ("1")/(R) dot.op sqrt((L)/(C))', 'Q = (ω_("0") L)/(R) = ("1")/(R) dot.op sqrt((L)/(C))', 'Q = (X_("L") lr(( f_("0") )))/(R)'],
  'Q = sqrt(L/C)/R', {'Q': 'Factor de calidad', 'L': 'Inductancia', 'C': 'Capacidad', 'R': 'Resistencia serie total'},
  ej={'R': '50 Ω', 'L': '10 mH', 'C': '100 nF', 'Q': '6,3246'}, tol=0.001, claves='factor de calidad q rlc')
F('bw-rl', 'Ancho de banda de un RLC serie', 'cap24', '"BW" = (R)/("2" π L) = (f_("0"))/(Q)', 'BW = R/(2*pi*L)',
  {'BW': 'Ancho de banda a −3 dB', 'R': 'Resistencia serie total', 'L': 'Inductancia'},
  ej={'R': '50 Ω', 'L': '10 mH', 'BW': '795,77 Hz'}, tol=0.001, claves='ancho de banda rlc serie')
F('amortiguamiento', 'Coeficiente de amortiguamiento de un RLC serie', 'cap24', 'quad ζ = (R)/("2") dot.op sqrt((C)/(L))',
  'zeta = R/2*sqrt(C/L)', {'zeta': ('Coeficiente de amortiguamiento', '', '0', '100'), 'R': 'Resistencia', 'C': 'Capacidad', 'L': 'Inductancia'},
  claves='amortiguamiento zeta segundo orden')
F('q-zeta', 'Factor de calidad y amortiguamiento', 'cap24', 'quad Q = ("1")/("2" ζ)', 'Q = 1/(2*zeta)',
  {'Q': 'Factor de calidad', 'zeta': ('Coeficiente de amortiguamiento', '', '0,001', '100', '0,079')}, claves='q zeta amortiguamiento')
F('omega0', 'Pulsación de resonancia', 'cap24', 'ω_("0") = ("1")/(sqrt(L dot.op C)) quad ζ', 'omega_0 = 1/sqrt(L*C)',
  {'omega_0': ('Pulsación de resonancia', 'rad/s', '1', '1e12'), 'L': 'Inductancia', 'C': 'Capacidad'}, claves='pulsación resonancia omega')
F('admitancia-g', 'Conductancia de una impedancia R + jX', 'cap24', 'Y = ("1")/(R + j X) = (R)/(R^("2") + X^("2"))',
  'G = R/(R^2 + X^2)', {'G': 'Conductancia', 'R': 'Resistencia', 'X': {'n': 'Reactancia', 'u': 'Ω', 'r': ('-1 MΩ', '1 MΩ'), 'd': '140 Ω', 'lineal': True}},
  ej={'R': '100 Ω', 'X': '140 Ω', 'G': '3,38 mS'}, claves='admitancia conductancia')
F('admitancia-b', 'Susceptancia de una impedancia R + jX', 'cap24', '- j (X)/(R^("2") + X^("2"))',
  'B = -X/(R^2 + X^2)', {'B': {'n': 'Susceptancia', 'u': 'S', 'r': ('-1 kS', '1 kS'), 'lineal': True}, 'R': 'Resistencia',
                         'X': {'n': 'Reactancia', 'u': 'Ω', 'r': ('-1 MΩ', '1 MΩ'), 'd': '140 Ω', 'lineal': True}},
  ej={'R': '100 Ω', 'X': '140 Ω', 'B': '-4,73 mS'}, claves='admitancia susceptancia')
F('inductancia-mutua', 'Inductancia mutua', 'cap24', 'M = k dot.op sqrt(L_("1") dot.op L_("2"))', 'M = k*sqrt(L_1*L_2)',
  {'M': 'Inductancia mutua', 'k': 'Coeficiente de acoplamiento', 'L_1': 'Inductancia de la primera bobina', 'L_2': 'Inductancia de la segunda bobina'},
  claves='inductancia mutua acoplamiento transformador')
F('impedancia-reflejada', 'Impedancia reflejada por un transformador', 'cap24', 'Z_("reflejada") = (Z_("carga"))/(n^("2"))',
  'Z_p = Z_L/n^2', {'Z_p': ('Impedancia vista desde el primario', 'Ω', '1 mΩ', '100 MΩ'), 'Z_L': ('Impedancia de la carga', 'Ω', '0,1 Ω', '1 MΩ', '8 Ω'),
                    'n': {'n': 'Relación de espiras N₂/N₁', 'u': '', 'r': ('0,001', '1000'), 'd': '0,1'}},
  ej={'Z_L': '8 Ω', 'n': '0,1', 'Z_p': '800 Ω'}, claves='transformador adaptación impedancia reflejada altavoz')

# ------------------------------------------------------------------ cap25 — filters
F('db-potencia', 'Decibelios de una relación de potencias', 'cap25', '"dB" = "10" dot.op op("log")_("10") (P_("2"))/(P_("1"))',
  'G_dB = 10*log10(P_2/P_1)', {'G_dB': 'Relación en decibelios', 'P_2': ('Potencia 2', 'W', '1 fW', '1 MW', '2 W'), 'P_1': ('Potencia 1 (referencia)', 'W', '1 fW', '1 MW', '1 W')},
  ej={'P_2': '2 W', 'P_1': '1 W', 'G_dB': '3'}, tol=0.01, origen='sección 0.4: doblar la potencia son 3 dB', claves='decibelio potencia')
F('orden-filtro', 'Orden mínimo de un filtro', 'cap25', ['"orden" gt.eq (A lr(( "dB" )))/("20" dot.op op("log")_("10") (f)/(f_("c")))', ('cap30', '"y con un filtro de orden" space n ": " A approx "20"')],
  'n = A_dB/(20*log10(f/f_c))', {'n': ('Orden mínimo', '', '0', '1000'), 'A_dB': ('Atenuación requerida', 'dB', '1', '300', '60'),
                                 'f': ('Frecuencia donde se exige la atenuación', 'Hz', '1 mHz', '100 GHz', '10 kHz'), 'f_c': 'Frecuencia de corte'},
  ej={'A_dB': '60', 'f': '2 kHz', 'f_c': '1 kHz', 'n': '10'}, tol=0.01, claves='orden filtro atenuación pendiente')
F('orden-filtro-decadas', 'Orden mínimo por décadas de separación', 'cap25', '"orden" gt.eq ("atenuación requerida (dB)")',
  'n = A_dB/(20*dec)', {'n': ('Orden mínimo', '', '0', '1000'), 'A_dB': ('Atenuación requerida', 'dB', '1', '300', '60'),
                        'dec': ('Décadas de separación respecto al corte', '', '0,01', '10', '1')},
  ej={'A_dB': '60', 'dec': '0,5', 'n': '6'}, claves='orden filtro décadas')
F('condensador-conmutado', 'Resistencia equivalente de un condensador conmutado', 'cap25', 'R_("equivalente") = ("1")/(C dot.op f)',
  'R_eq = 1/(C*f)', {'R_eq': 'Resistencia equivalente', 'C': 'Capacidad conmutada', 'f': 'Frecuencia de conmutación'},
  ej={'C': '1 pF', 'f': '100 kHz', 'R_eq': '10 MΩ'}, claves='condensador conmutado switched capacitor')
F('frecuencia-central', 'Frecuencia central de un paso banda', 'cap25', 'f_("0") = sqrt(f_("1") dot.op f_("2"))',
  'f_0 = sqrt(f_1*f_2)', {'f_0': 'Frecuencia central', 'f_1': ('Frecuencia de corte inferior', 'Hz', '1 mHz', '10 GHz', '300 Hz'),
                          'f_2': ('Frecuencia de corte superior', 'Hz', '1 mHz', '10 GHz', '3,4 kHz')}, claves='paso banda frecuencia central media geométrica')

# ------------------------------------------------------------------ cap26 — semiconductor models
F('tension-termica', 'Tensión térmica', 'cap26', 'quad V_("T") = (k dot.op T)/(q)', 'V_T = k_B*T_K/q_e',
  {'V_T': 'Tensión térmica kT/q', 'T_K': 'Temperatura absoluta'}, ej={'T_K': '300', 'V_T': '25,85 mV'}, tol=0.001, claves='tensión térmica kT/q')
F('r-pi-gm', 'Resistencia r_π desde g_m', 'cap26', ['r_("π") = (v_("be"))/(i_("b")) = (β)/(g_(m))', 'quad r_("π") = (β)/(g_(m)) quad'],
  'r_pi = beta/g_m', {'r_pi': 'Resistencia de entrada r_π', 'beta': 'Ganancia de corriente β', 'g_m': 'Transconductancia'},
  ej={'beta': '100', 'g_m': '38,7 mS', 'r_pi': '2585 Ω'}, claves='pequeña señal r pi')
F('av-ic-rc', 'Ganancia del emisor común en función de la caída en R_C', 'cap26', 'A_(v) = - g_(m) dot.op R_("C") = - (I_("C") dot.op R_("C"))/(V_("T"))',
  'A_v = -I_C*R_C/V_T', {'A_v': 'Ganancia de tensión', 'I_C': 'Corriente de colector', 'R_C': 'Resistencia de colector', 'V_T': 'Tensión térmica kT/q'},
  ej={'I_C': '1 mA', 'R_C': '2,5 kΩ', 'V_T': '25,85 mV', 'A_v': '-97'}, origen='sección @sec-26.4: 2,5 V de caída en R_C', tol=0.01, claves='emisor común ganancia')
F('capacidad-union', 'Capacidad de la zona de agotamiento', 'cap26', 'C_(j) = (C_(j "0"))/(lr(( "1" + (V_("R"))/(V_("0")) ))^(m))',
  'C_j = C_j0/(1 + V_R/V_0)^m_j',
  {'C_j': ('Capacidad de la unión', 'F', '1 fF', '10 µF'), 'C_j0': ('Capacidad sin polarización', 'F', '1 fF', '10 µF', '10 pF'),
   'V_R': ('Tensión inversa', 'V', '0 V', '1 kV', '5 V'), 'V_0': ('Potencial de contacto', 'V', '0,1 V', '1,5 V', '0,7 V'),
   'm_j': {'n': 'Exponente de gradualidad', 'u': '', 'r': ('0,2', '0,6'), 'd': '0,5', 'lineal': True, 'sim': 'm'}},
  claves='capacidad de unión varicap agotamiento')
F('capacidad-difusion', 'Capacidad de difusión', 'cap26', 'quad C_("d") = τ dot.op (I)/(V_("T"))', 'C_d = tau_t*I/V_T',
  {'C_d': ('Capacidad de difusión', 'F', '1 fF', '1 mF'), 'tau_t': ('Tiempo de tránsito', 's', '1 ps', '100 µs', '1 ns'), 'I': 'Corriente directa',
   'V_T': 'Tensión térmica kT/q'}, claves='capacidad de difusión diodo')
F('tiempo-transito-base', 'Tiempo de tránsito por la base', 'cap26', 'τ_("B") = (W^("2"))/("2" dot.op D)', 'tau_B = W^2/(2*D_n)',
  {'tau_B': ('Tiempo de tránsito por la base', 's', '1 fs', '1 µs'), 'W': ('Espesor de la base', 'm', '10 nm', '100 µm', '1 µm'),
   'D_n': ('Coeficiente de difusión', 'm²/s', '1e-5', '1e-2', '0,0025')}, claves='tiempo de tránsito base difusión')
F('rdson-temperatura', 'R_DS(on) con la temperatura', 'cap26', 'R_("DS" lr(( "on" ))) lr(( T )) approx R_("DS" lr(( "on" ))) lr(( "25 °C" ))',
  'R_T = R_25*(1 + 0.007*dT)',
  {'R_T': ('R_DS(on) a la temperatura de trabajo', 'Ω', '0,1 mΩ', '100 Ω'), 'R_25': ('R_DS(on) a 25 °C', 'Ω', '0,1 mΩ', '100 Ω', '20 mΩ'),
   'dT': {'n': 'Incremento sobre 25 °C', 'u': '°C', 'r': ('-50', '150'), 'd': '75', 'sim': 'ΔT', 'lineal': True}},
  ej={'R_25': '100 mΩ', 'dT': '75', 'R_T': '150 mΩ'}, tol=0.02, claves='mosfet rdson temperatura')

# ------------------------------------------------------------------ cap27 — operational amplifiers
F('realimentacion', 'Ganancia con realimentación negativa', 'cap27', ['A_("f") = (A)/("1" + A dot.op β)', 'G = (V_("out"))/(V_("in")) = (A)/("1" + A dot.op β)'],
  'A_f = A/(1 + A*beta_f)', {'A_f': ('Ganancia en lazo cerrado', 'V/V', '0', '1e7'), 'A': ('Ganancia en lazo abierto', 'V/V', '1', '1e8', '1e5'),
                             'beta_f': {'n': 'Fracción realimentada β', 'u': '', 'r': ('1e-6', '1'), 'd': '0,0909', 'sim': 'β'}},
  ej={'A': '1e5', 'beta_f': '0,090909', 'A_f': '10,9988'}, tol=1e-5, claves='realimentación ganancia de lazo')
F('ao-inversor-rf', 'Ganancia del inversor (R_f, R_in)', 'cap27', 'A_("v") = - (R_("f"))/(R_("in"))', 'A_v = -R_f/R_in',
  {'A_v': 'Ganancia de tensión', 'R_f': 'Resistencia de realimentación', 'R_in': 'Resistencia de entrada'}, claves='inversor operacional')
F('ao-no-inversor-rf', 'Ganancia del no inversor (R_f, R_g)', 'cap27', ['A_("v") = "1" + (R_("f"))/(R_("g"))', ('cap51', 'G = "1" + (R_("f"))/(R_("g"))')], 'A_v = 1 + R_f/R_g',
  {'A_v': 'Ganancia de tensión', 'R_f': 'Resistencia de realimentación', 'R_g': ('Resistencia a masa', 'Ω', '10 Ω', '10 MΩ', '10 kΩ')}, claves='no inversor operacional')
F('transimpedancia', 'Amplificador de transimpedancia', 'cap27', ['V_("out") = - I_("in") dot.op R_("f")', 'R_("f") = (V_("out"))/(I_("pd"))'],
  'V_out = I_in*R_f', {'V_out': 'Tensión de salida (en valor absoluto)', 'I_in': ('Corriente de entrada (fotocorriente)', 'A', '1 pA', '1 A', '10 µA'),
                       'R_f': 'Resistencia de realimentación'},
  ej={'I_in': '10 µA', 'R_f': '200 kΩ', 'V_out': '2 V'}, nota='El montaje invierte el signo: V<sub>out</sub> = −I<sub>in</sub>·R<sub>f</sub>.',
  claves='transimpedancia fotodiodo')
F('sumador', 'Sumador inversor (dos entradas)', 'cap27', 'V_("out") = - R_("f") dot.op lr(( (V_("1"))/(R_("1"))',
  'V_out = -R_f*(V_1/R_1 + V_2/R_2)',
  {'V_out': ('Tensión de salida', 'V', '-100 V', '100 V'), 'R_f': 'Resistencia de realimentación', 'V_1': ('Entrada 1', 'V', '-100 V', '100 V', '1 V'),
   'R_1': 'Resistencia de la entrada 1', 'V_2': ('Entrada 2', 'V', '-100 V', '100 V', '1 V'), 'R_2': 'Resistencia de la entrada 2'},
  claves='sumador mezclador operacional')
F('integrador', 'Rampa del integrador con entrada constante', 'cap27', 'V_("out") = - ("1")/(R C) dot.op integral V_("in") d t',
  'V_out = -V_in*t/(R*C)', {'V_out': ('Variación de la salida', 'V', '-1 kV', '1 kV'), 'V_in': ('Tensión de entrada constante', 'V', '-100 V', '100 V', '1 V'),
                            't': 'Tiempo de integración', 'R': 'Resistencia de entrada', 'C': 'Capacidad de realimentación'},
  claves='integrador rampa operacional')
F('derivador', 'Salida del derivador', 'cap27', 'V_("out") = - R C dot.op (d V_("in"))/(d t)', 'V_out = -R*C*dvdt',
  {'V_out': ('Tensión de salida', 'V', '-1 kV', '1 kV'), 'R': 'Resistencia de realimentación', 'C': 'Capacidad de entrada',
   'dvdt': {'n': 'Pendiente de la entrada', 'u': 'V/s', 'r': ('-1e9', '1e9'), 'd': '1000', 'sim': 'dV<sub>in</sub>/dt', 'lineal': True}},
  claves='derivador operacional')
F('error-cmrr', 'Error por el modo común (CMRR)', 'cap27', 'V_("error") = (V_("cm"))/("10"^(("CMRR"_("dB"))',
  'V_err = V_cm/10^(CMRR/20)', {'V_err': ('Error equivalente a la entrada', 'V', '1 pV', '10 V'), 'V_cm': ('Tensión de modo común', 'V', '1 mV', '1 kV', '5 V'),
                               'CMRR': ('Rechazo del modo común', 'dB', '20', '160', '80')},
  ej={'V_cm': '5 V', 'CMRR': '80', 'V_err': '500 µV'}, claves='cmrr modo común error')
F('ganancia-instrumentacion', 'Ganancia del amplificador de instrumentación', 'cap27', ['A = "1" + ("2" dot.op R)/(R_("G"))', 'G = "1" + ("50 kΩ")/("110 Ω")'],
  'A_v = 1 + 2*R/R_G', {'A_v': 'Ganancia', 'R': ('Resistencia interna R', 'Ω', '1 kΩ', '1 MΩ', '25 kΩ'), 'R_G': ('Resistencia de ganancia R_G', 'Ω', '1 Ω', '10 MΩ', '110 Ω')},
  ej={'R': '25 kΩ', 'R_G': '110 Ω', 'A_v': '455,5'}, tol=0.001, claves='amplificador de instrumentación ina rg')
F('polo-carga-capacitiva', 'Polo de la salida con carga capacitiva', 'cap27', 'f_("p") = ("1")/("2" π dot.op R_("o") dot.op C_("L"))',
  'f_p = 1/(2*pi*R_o*C_L)', {'f_p': ('Frecuencia del polo', 'Hz', '1 Hz', '100 GHz'), 'R_o': ('Resistencia de salida en lazo abierto', 'Ω', '1 Ω', '1 kΩ', '50 Ω'),
                             'C_L': ('Capacidad de carga', 'F', '1 pF', '100 µF', '1 nF')},
  ej={'R_o': '50 Ω', 'C_L': '1 nF', 'f_p': '3,2 MHz'}, claves='carga capacitiva estabilidad polo')
F('fondo-escala-puente', 'Fondo de escala de un puente de galgas', 'cap27', 'V_("FS") = S dot.op V_("exc")', 'V_FS = S*V_exc',
  {'V_FS': ('Fondo de escala', 'V', '1 µV', '10 V'), 'S': ('Sensibilidad', 'V/V', '1e-5', '0,1', '0,002'), 'V_exc': ('Tensión de excitación', 'V', '0,1 V', '50 V', '5 V')},
  ej={'S': '0,002', 'V_exc': '5 V', 'V_FS': '10 mV'}, claves='galga puente célula de carga')
F('error-ganancia-finita', 'Error de ganancia por ganancia de lazo finita', 'cap27', 'T = A dot.op β = ("10"^("5"))/("455,5")',
  'e = 100/(1 + A/G)', {'e': ('Error relativo de ganancia', '%', '0', '100'), 'A': ('Ganancia en lazo abierto', 'V/V', '1', '1e8', '1e5'),
                        'G': ('Ganancia ideal en lazo cerrado', 'V/V', '1', '1e6', '455,5')},
  ej={'A': '1e5', 'G': '455,5', 'e': '0,453 %'}, claves='ganancia de lazo error operacional')
F('offset-salida', 'Offset llevado a la salida', 'cap27', 'V_("os") lr(( "salida" )) = "50 µV" times "455,5"', 'V_o = V_os*G',
  {'V_o': ('Offset a la salida', 'V', '1 nV', '10 V'), 'V_os': ('Offset de entrada', 'V', '1 nV', '100 mV', '50 µV'), 'G': ('Ganancia', 'V/V', '1', '1e6', '455,5')},
  ej={'V_os': '50 µV', 'G': '455,5', 'V_o': '22,8 mV'}, claves='offset error de cero')
F('cruce-ruido', 'Frecuencia de cruce de la ganancia de ruido', 'cap27', 'f_(i) = sqrt("GBW" dot.op f_("z"))', 'f_i = sqrt(GBW*f_z)',
  {'f_i': ('Frecuencia de cruce', 'Hz', '1 Hz', '10 GHz'), 'GBW': 'Producto ganancia-ancho de banda', 'f_z': ('Frecuencia del cero de la ganancia de ruido', 'Hz', '1 Hz', '1 GHz', '14,5 kHz')},
  ej={'GBW': '10 MHz', 'f_z': '14,5 kHz', 'f_i': '380 kHz'}, claves='transimpedancia estabilidad ganancia de ruido')
F('cf-transimpedancia', 'Condensador de compensación de un transimpedancia', 'cap27', ['C_("f") = sqrt((C_("in"))/("2" π dot.op R_("f") dot.op "GBW"))', 'C_("f") = sqrt(("55 pF")'],
  'C_f = sqrt(C_in/(2*pi*R_f*GBW))', {'C_f': ('Condensador de realimentación (45° de margen)', 'F', '1 fF', '1 µF'), 'C_in': ('Capacidad total en la entrada', 'F', '1 pF', '10 nF', '55 pF'),
                                      'R_f': 'Resistencia de realimentación', 'GBW': 'Producto ganancia-ancho de banda'},
  ej={'C_in': '55 pF', 'R_f': '200 kΩ', 'GBW': '10 MHz', 'C_f': '2,09 pF'}, claves='transimpedancia fotodiodo compensación')
F('histeresis-vth', 'Umbral superior de un comparador con histéresis', 'cap27', ['"subida" space lr(( V_("out") = "0" ))', 'V_("TH") = V_("ref") dot.op lr(( "1" + k )) quad V_("TL")'],
  'V_TH = V_ref*(1 + R_1/R_2)', {'V_TH': ('Umbral de subida', 'V', '0 V', '100 V'), 'V_ref': 'Tensión de referencia', 'R_1': 'Resistencia de entrada R₁',
                                 'R_2': 'Resistencia de realimentación R₂'},
  ej={'V_ref': '2,5 V', 'R_1': '3,9 kΩ', 'R_2': '100 kΩ', 'V_TH': '2,598 V'}, tol=0.001, claves='histéresis schmitt comparador umbral')
F('histeresis-vtl', 'Umbral inferior de un comparador con histéresis', 'cap27', 'quad V_("TL") = V_("ref") dot.op lr(( "1" - k ))',
  'V_TL = V_ref*(1 - R_1/R_2)', {'V_TL': ('Umbral de bajada', 'V', '-100 V', '100 V'), 'V_ref': 'Tensión de referencia', 'R_1': 'Resistencia de entrada R₁',
                                 'R_2': 'Resistencia de realimentación R₂'},
  ej={'V_ref': '2,5 V', 'R_1': '3,9 kΩ', 'R_2': '100 kΩ', 'V_TL': '2,403 V'}, tol=0.001, claves='histéresis schmitt comparador umbral')
F('histeresis-ventana', 'Ventana de histéresis', 'cap27', ['Δ V = "2" dot.op k dot.op V_("ref")', 'k = ("Δ" V)/("2" dot.op V_("ref"))'],
  'dV = 2*V_ref*R_1/R_2', {'dV': {'n': 'Anchura de la ventana', 'u': 'V', 'r': ('0 V', '100 V'), 'sim': 'ΔV'}, 'V_ref': 'Tensión de referencia',
                           'R_1': 'Resistencia de entrada R₁', 'R_2': 'Resistencia de realimentación R₂'},
  ej={'V_ref': '2,5 V', 'R_1': '3,9 kΩ', 'R_2': '100 kΩ', 'dV': '195 mV'}, claves='histéresis ventana')
