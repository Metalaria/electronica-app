"""Common variables of the formula catalogue: id -> name (Spanish), SI unit, typical range, default.

A formula may override any field (formulas_cat*.py). Ids are the names used in the expressions; their symbol
is derived from the id ('V_CC' -> V<sub>CC</sub>, 'tau' -> τ) unless `sim` gives it. Ranges and defaults are
written as in the book («4,7 kΩ», «100 nF»). Variables that share an id on a formula card share their value.
"""

GRIEGAS = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'Delta': 'Δ', 'eps': 'ε', 'epsr': 'ε<sub>r</sub>',
    'zeta': 'ζ', 'eta': 'η', 'theta': 'θ', 'lambda': 'λ', 'mu': 'µ', 'nu': 'ν', 'pi': 'π', 'rho': 'ρ',
    'sigma': 'σ', 'tau': 'τ', 'phi': 'φ', 'omega': 'ω', 'Omega': 'Ω', 'Phi': 'Φ', 'Theta': 'Θ', 'psi': 'ψ',
    'Sigma': 'Σ', 'chi': 'χ',
}

# Units that never take an SI prefix (the value is shown as a plain number).
SIN_PREFIJO = {'', '%', 'dB', 'dBm', 'dBc', 'dBi', 'dBV', 'dBµV', 'dB/déc', '°', '°C', 'K', 'ppm', 'ppm/°C',
               'bit', 'V/V', 'A/A', 'ciclos', 'vueltas', '°C/W', 'K/W', 'rad', 'dB/m', 'dB/100 m', 'h', 'años',
               'espiras', 'LSB', 'Ω/sq', 'veces', 'm²', 'Ω·m', 'V/µs', 'mm²', 'cm', 'mm', '1/°C', 'cm⁻³', 'ppm/°C', 'rpm', 'palabras', 'µε', '€'}


def unidad_con_prefijo(u):
    return u not in SIN_PREFIJO


def V(n, u, lo, hi, d=None, **k):
    out = {'n': n, 'u': u, 'r': (lo, hi)}
    if d is not None:
        out['d'] = d
    out.update(k)
    return out


VAR = {
    # resistances
    'R': V('Resistencia', 'Ω', '1 mΩ', '100 MΩ', '1 kΩ'),
    'R_1': V('Resistencia R₁', 'Ω', '10 Ω', '10 MΩ', '10 kΩ'),
    'R_2': V('Resistencia R₂', 'Ω', '10 Ω', '10 MΩ', '10 kΩ'),
    'R_3': V('Resistencia R₃', 'Ω', '10 Ω', '10 MΩ', '10 kΩ'),
    'R_L': V('Resistencia de carga', 'Ω', '1 Ω', '10 MΩ', '1 kΩ'),
    'R_C': V('Resistencia de colector', 'Ω', '10 Ω', '1 MΩ', '4,7 kΩ'),
    'R_E': V('Resistencia de emisor', 'Ω', '1 Ω', '100 kΩ', '1 kΩ'),
    'R_B': V('Resistencia de base', 'Ω', '100 Ω', '10 MΩ', '100 kΩ'),
    'R_D': V('Resistencia de drenador', 'Ω', '10 Ω', '1 MΩ', '4,7 kΩ'),
    'R_S': V('Resistencia de surtidor', 'Ω', '1 Ω', '100 kΩ', '1 kΩ'),
    'R_f': V('Resistencia de realimentación', 'Ω', '100 Ω', '10 MΩ', '100 kΩ'),
    'R_in': V('Resistencia de entrada', 'Ω', '10 Ω', '10 MΩ', '10 kΩ'),
    'R_g': V('Resistencia interna del generador', 'Ω', '0,1 Ω', '1 MΩ', '50 Ω'),
    'R_s': V('Resistencia de la fuente', 'Ω', '0,01 Ω', '1 MΩ', '50 Ω'),
    'R_Th': V('Resistencia de Thévenin', 'Ω', '1 Ω', '10 MΩ', '1 kΩ'),
    'R_eq': V('Resistencia equivalente', 'Ω', '1 Ω', '10 MΩ', '1 kΩ'),
    'R_th': V('Resistencia térmica', '°C/W', '0,1', '500', '50'),
    'Z_0': V('Impedancia característica', 'Ω', '10 Ω', '600 Ω', '50 Ω'),
    'Z_L': V('Impedancia de carga', 'Ω', '1 Ω', '10 kΩ', '75 Ω'),
    'X_C': V('Reactancia capacitiva', 'Ω', '1 mΩ', '100 MΩ', '1 kΩ'),
    'X_L': V('Reactancia inductiva', 'Ω', '1 mΩ', '100 MΩ', '1 kΩ'),
    'Z': V('Módulo de la impedancia', 'Ω', '1 mΩ', '100 MΩ', '1 kΩ'),
    'G': V('Conductancia', 'S', '1 nS', '1 kS', '1 mS'),
    'rho': V('Resistividad', 'Ω·m', '1e-8', '1e3', '1,72e-8', sim='ρ'),
    # capacitance, inductance
    'C': V('Capacidad', 'F', '1 pF', '10 mF', '100 nF'),
    'C_1': V('Capacidad C₁', 'F', '1 pF', '10 mF', '100 nF'),
    'C_2': V('Capacidad C₂', 'F', '1 pF', '10 mF', '100 nF'),
    'L': V('Inductancia', 'H', '1 nH', '10 H', '1 mH'),
    'L_1': V('Inductancia L₁', 'H', '1 nH', '10 H', '1 mH'),
    'L_2': V('Inductancia L₂', 'H', '1 nH', '10 H', '1 mH'),
    'M': V('Inductancia mutua', 'H', '1 nH', '10 H', '1 mH'),
    'k': V('Coeficiente de acoplamiento', '', '0,01', '1', '0,9', lineal=True),
    'Q': V('Factor de calidad', '', '0,1', '1000', '10'),
    'q': V('Carga eléctrica', 'C', '1 pC', '10 C', '1 µC'),
    # voltages and currents
    'V': V('Tensión', 'V', '1 mV', '1 kV', '12 V'),
    'I': V('Corriente', 'A', '1 µA', '100 A', '10 mA'),
    'P': V('Potencia', 'W', '1 µW', '10 kW', '1 W'),
    'E': V('Energía', 'J', '1 nJ', '1 GJ', '1 J'),
    'W': V('Energía', 'J', '1 nJ', '1 GJ', '1 J'),
    'V_CC': V('Tensión de alimentación', 'V', '1 V', '100 V', '12 V'),
    'V_DD': V('Tensión de alimentación', 'V', '1 V', '100 V', '12 V'),
    'V_in': V('Tensión de entrada', 'V', '1 µV', '1 kV', '1 V'),
    'V_out': V('Tensión de salida', 'V', '1 µV', '1 kV', '1 V'),
    'V_s': V('Tensión de salida', 'V', '1 µV', '1 kV', '1 V'),
    'V_e': V('Tensión de entrada', 'V', '1 µV', '1 kV', '1 V'),
    'V_p': V('Tensión de pico', 'V', '1 mV', '1 kV', '10 V'),
    'V_pp': V('Tensión pico a pico', 'V', '1 mV', '1 kV', '10 V'),
    'V_RMS': V('Tensión eficaz', 'V', '1 mV', '1 kV', '230 V'),
    'I_p': V('Corriente de pico', 'A', '1 µA', '100 A', '1 A'),
    'I_RMS': V('Corriente eficaz', 'A', '1 µA', '100 A', '1 A'),
    'V_Th': V('Tensión de Thévenin', 'V', '1 mV', '1 kV', '5 V'),
    'V_BE': V('Tensión base-emisor', 'V', '0,4 V', '1 V', '0,7 V'),
    'V_CE': V('Tensión colector-emisor', 'V', '0 V', '100 V', '6 V'),
    'V_E': V('Tensión de emisor', 'V', '0 V', '50 V', '1 V'),
    'V_B': V('Tensión de base', 'V', '0 V', '50 V', '2 V'),
    'V_C': V('Tensión de colector', 'V', '0 V', '100 V', '6 V'),
    'V_T': V('Tensión térmica', 'V', '20 mV', '35 mV', '25,85 mV'),
    'V_A': V('Tensión de Early', 'V', '10 V', '500 V', '100 V'),
    'V_F': V('Tensión directa', 'V', '0,1 V', '5 V', '0,7 V'),
    'V_Z': V('Tensión Zener', 'V', '1 V', '200 V', '5,1 V'),
    'V_GS': V('Tensión puerta-surtidor', 'V', '-20 V', '20 V', '3 V', lineal=True),
    'V_th': V('Tensión umbral', 'V', '-10 V', '10 V', '2 V', lineal=True),
    'V_DS': V('Tensión drenador-surtidor', 'V', '0 V', '100 V', '5 V', lineal=True),
    'V_ref': V('Tensión de referencia', 'V', '0,5 V', '20 V', '2,5 V'),
    'V_r': V('Rizado pico a pico', 'V', '1 mV', '100 V', '1 V'),
    'I_C': V('Corriente de colector', 'A', '1 µA', '10 A', '1 mA'),
    'I_B': V('Corriente de base', 'A', '1 nA', '1 A', '10 µA'),
    'I_E': V('Corriente de emisor', 'A', '1 µA', '10 A', '1 mA'),
    'I_D': V('Corriente de drenador', 'A', '1 µA', '100 A', '1 mA'),
    'I_S': V('Corriente de saturación', 'A', '1e-18 A', '1e-6 A', '1e-14 A'),
    'I_L': V('Corriente de carga', 'A', '1 µA', '100 A', '100 mA'),
    'I_F': V('Corriente directa', 'A', '1 µA', '100 A', '20 mA'),
    'I_Z': V('Corriente del Zener', 'A', '1 µA', '10 A', '10 mA'),
    'beta': V('Ganancia de corriente β', '', '10', '1000', '100'),
    'alpha': V('Ganancia α', '', '0,9', '0,9999', '0,99', lineal=True),
    'g_m': V('Transconductancia', 'S', '1 µS', '10 S', '40 mS'),
    'r_e': V('Resistencia dinámica de emisor', 'Ω', '0,1 Ω', '10 kΩ', '25 Ω'),
    'r_pi': V('Resistencia de entrada r_π', 'Ω', '10 Ω', '10 MΩ', '2,5 kΩ'),
    'r_o': V('Resistencia de salida', 'Ω', '1 Ω', '100 MΩ', '100 kΩ'),
    'A_v': V('Ganancia de tensión', 'V/V', '-1e6', '1e6', '10', lineal=True),
    'A_0': V('Ganancia en lazo abierto', 'V/V', '100', '1e7', '1e5'),
    'G_dB': V('Ganancia', 'dB', '-200', '200', '20', lineal=True),
    'A_dB': V('Ganancia', 'dB', '-200', '200', '20', lineal=True),
    # time and frequency
    't': V('Tiempo', 's', '1 ns', '1e6 s', '1 ms'),
    'T': V('Periodo', 's', '1 ns', '100 s', '1 ms'),
    'tau': V('Constante de tiempo', 's', '1 ns', '1000 s', '1 ms'),
    'f': V('Frecuencia', 'Hz', '1 mHz', '100 GHz', '1 kHz'),
    'f_c': V('Frecuencia de corte', 'Hz', '1 mHz', '10 GHz', '1 kHz'),
    'f_0': V('Frecuencia de resonancia', 'Hz', '1 Hz', '10 GHz', '1 kHz'),
    'f_s': V('Frecuencia de muestreo', 'Hz', '1 Hz', '10 GHz', '48 kHz'),
    'omega': V('Pulsación (frecuencia angular)', 'rad/s', '1 mrad/s', '1e12 rad/s', '6,283 krad/s'),
    'BW': V('Ancho de banda', 'Hz', '1 mHz', '10 GHz', '1 kHz'),
    'GBW': V('Producto ganancia-ancho de banda', 'Hz', '1 kHz', '10 GHz', '1 MHz'),
    'D': V('Ciclo de trabajo', '', '0', '1', '0,5', lineal=True),
    'phi': V('Fase', '°', '-180', '180', '0', lineal=True),
    'theta': V('Ángulo', '°', '-180', '180', '45', lineal=True),
    'lambda': V('Longitud de onda', 'm', '1 µm', '100 km', '1 m'),
    'v_p': V('Velocidad de propagación', 'm/s', '1e6', '3e8', '2e8'),
    'SR': V('Slew rate', 'V/s', '1e3', '1e10', '1e6'),
    # temperature and misc
    'T_K': V('Temperatura absoluta', 'K', '1', '1000', '300'),
    'T_C': V('Temperatura', '°C', '-55', '200', '25', lineal=True),
    'T_A': V('Temperatura ambiente', '°C', '-40', '85', '25', lineal=True),
    'T_J': V('Temperatura de la unión', '°C', '-55', '200', '125', lineal=True),
    'n': V('Número', '', '1', '1000', '2'),
    'N': V('Número de espiras', 'espiras', '1', '1e5', '100'),
    'eta': V('Rendimiento', '%', '1', '100', '80'),
    'l': V('Longitud', 'm', '1 µm', '10 km', '1 m'),
    'd': V('Distancia', 'm', '1 µm', '1000 km', '1 m'),
    'A': V('Área', 'm²', '1e-12', '10', '1e-4'),
}
