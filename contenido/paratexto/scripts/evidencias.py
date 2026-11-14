"""Keyword evidence per topic for the gap analysis: hits per part and the sections that hold them."""
import collections
import json
import os
import re
import sys

from comun import DATOS, fragmentos, partes_del_libro, cargar

REFS = cargar('refs.json')
TEMAS = {
 'matrices/álgebra lineal': r'\bmatri(?:z|ces)\b|determinante|autovalor|valores propios|álgebra lineal',
 'ecuaciones diferenciales': r'ecuaci[oó]n(?:es)? diferencial',
 'derivadas parciales/EDP': r'derivadas? parcial|ecuaci[oó]n de (?:onda|calor|Laplace\b)',
 'métodos numéricos': r'Newton-Raphson|m[eé]todo num[eé]rico|integraci[oó]n num[eé]rica|Euler (?:expl|impl)|trapecio|Runge',
 'estadística/probabilidad': r'desviaci[oó]n t[ií]pica|distribuci[oó]n normal|gaussiana|probabilidad|Monte Carlo|varianza',
 'optimización': r'optimizaci[oó]n|minimizar|m[ií]nimos cuadrados',
 'Laplace': r'transformada de Laplace|\bLaplace\b',
 'Fourier': r'Fourier',
 'transformada Z': r'transformada Z|transformada z\b',
 'electrostática Coulomb/Gauss': r'ley de Coulomb|ley de Gauss|campo el[eé]ctrico',
 'magnetostática Ampère/Biot': r'Biot|ley de Amp[eè]re|campo magn[eé]tico',
 'inducción Faraday/Lenz': r'Faraday|Lenz',
 'Maxwell/ondas EM': r'Maxwell|onda electromagn[eé]tica|ecuaciones de onda',
 'mecánica/termodinámica': r'termodin[aá]mica|segunda ley|entrop[ií]a',
 'programación C/C++/Python': r'\blenguaje C\b|\bC\+\+|Python|MicroPython',
 'sistemas operativos': r'sistema operativo|Linux|RTOS|FreeRTOS',
 'bases de datos': r'base de datos|SQL|InfluxDB',
 'trifásica': r'trif[aá]sic',
 'potencia reactiva/factor de potencia': r'potencia reactiva|factor de potencia|potencia aparente|\bPFC\b',
 'motor de inducción/asíncrono': r'motor(?:es)? (?:de inducci[oó]n|as[ií]ncrono)|jaula de ardilla',
 'máquina síncrona/alternador': r'm[aá]quina s[ií]ncrona|alternador|motor s[ií]ncrono',
 'motor de CC': r'motor(?:es)? de (?:corriente )?continua|motor(?:es)? (?:de )?CC\b|motor DC|escobillas',
 'paso a paso/BLDC/servo': r'paso a paso|BLDC|sin escobillas|servomotor|servo\b',
 'instalaciones/protecciones (REBT, diferencial)': r'magnetot[eé]rmico|interruptor diferencial|\bREBT\b|toma de tierra|puesta a tierra',
 'automatismos/relés/contactores': r'contactor|automatismo|l[oó]gica cableada',
 'PLC/autómata/IEC 61131/ladder/GRAFCET': r'\bPLC\b|aut[oó]mata programable|61131|ladder|escalera|GRAFCET|Grafcet',
 'PID': r'\bPID\b',
 'lugar de las raíces': r'lugar de las ra[ií]ces',
 'Nyquist (criterio)': r'criterio de Nyquist|diagrama de Nyquist',
 'Bode/márgenes': r'margen de fase|margen de ganancia|\bBode\b',
 'espacio de estados': r'espacio de estados|variables? de estado',
 'Routh': r'Routh',
 'control digital/discretización': r'control digital|discretiz|Tustin|bilineal',
 'robótica': r'\brobot|manipulador|cinem[aá]tica|grados de libertad',
 'buses de campo industriales': r'Modbus|Profibus|PROFINET|EtherCAT|bus de campo|Ethernet industrial|OPC',
 'CAN': r'\bCAN\b',
 'SCADA/HMI': r'SCADA|\bHMI\b',
 'tiempo real': r'tiempo real',
 'tiristor/SCR/triac': r'tiristor|\bSCR\b|triac|TRIAC',
 'rectificador controlado': r'rectificador(?:es)? controlad|[aá]ngulo de disparo',
 'convertidores CC-CC': r'\bbuck\b|\bboost\b|reductor|elevador|flyback|forward',
 'inversor/ondulador': r'inversor(?:es)?\b|ondulador',
 'IGBT': r'IGBT',
 'accionamientos/control de motores': r'control de motor|accionamiento|puente en H|variador',
 'amplificador de instrumentación': r'amplificador de instrumentaci[oó]n',
 'incertidumbre/calibración': r'incertidumbre|calibraci[oó]n|trazabilidad',
 'adquisición de datos': r'adquisici[oó]n de datos',
 'SPICE/simulación': r'SPICE|ngspice|simulaci[oó]n',
 'MATLAB/Simulink': r'MATLAB|Simulink|Octave|Scilab',
 'modelado de sistemas dinámicos': r'modelo din[aá]mico|modelado|sistema din[aá]mico|funci[oó]n de transferencia',
 'muestreo/DSP': r'muestreo|Nyquist-Shannon|teorema de muestreo|FIR|IIR',
 'modulación AM/FM/digital': r'modulaci[oó]n',
 'VHDL/Verilog': r'VHDL|Verilog',
 'microcontrolador/microprocesador': r'microcontrolador|microprocesador',
 'ensamblador/arquitectura de CPU': r'ensamblador|arquitectura (?:Harvard|von Neumann)|registro de instrucci|juego de instrucciones|pipeline',
 'interrupciones/DMA': r'interrupci[oó]n|\bDMA\b',
 'sensores industriales (inductivo, encoder, galga)': r'encoder|codificador (?:rotativo|incremental)|galga|sensor inductivo|termopar|RTD|Pt100',
 'neumática/hidráulica': r'neum[aá]tic|hidr[aá]ulic',
}

def main():
    datos = collections.OrderedDict()
    for tema, rx in TEMAS.items():
        r = re.compile(rx)
        por_parte = collections.Counter()
        secs = collections.defaultdict(collections.Counter)
        datos[tema] = (r, por_parte, secs)
    for p, info, t in partes_del_libro():
        d, fr = fragmentos(p)
        for h2, h3, kind, tx in fr:
            for tema, (r, por_parte, secs) in datos.items():
                n = len(r.findall(tx))
                if n:
                    num = info.get('num') or p
                    por_parte[num] += n
                    if h2 in REFS:
                        secs[tema][REFS[h2]['num']] += n
    out = {}
    for tema, (r, por_parte, secs) in datos.items():
        total = sum(por_parte.values())
        top = secs[tema].most_common(8)
        out[tema] = {'total': total, 'capitulos': dict(por_parte.most_common()), 'secciones': dict(top)}
        print(f"{tema}: {total} | caps {dict(por_parte.most_common(8))} | secs {[k for k,_ in top]}")
    json.dump(out, open(os.path.join(DATOS, '_evidencias.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

main()
