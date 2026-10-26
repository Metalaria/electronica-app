#!/usr/bin/env python3
"""Pictures of the glossary terms: web/public/libro/glosario.json -> web/public/libro/glosario-imagenes.json.

    cd /home/claude/app && python3 contenido/glosario_imagenes.py      (generar.py calls main() at the end)

Each glossary term may get the circuit symbol of the automatic schematics (web/src/componentes/esquema-auto/
simbolos.ts, drawn by web/src/componentes/glosario/simbolo.ts) and, when it is a physical part, the procedural
3D model of the components gallery (web/src/componentes/tres/modelos/paquetes.ts) with optional parameters.

The mapping is a curated table by exact term (CURADO; None blocks the rules for a term) plus matching rules on
the term (REGLAS, first match wins). Nothing is guessed from the definitions: a term without an entry or a rule
simply has no picture. Output (only terms with something to show):

  { "version": 1,
    "terminos": { "glos-diodo": { "s": "D", "m": "diodo-do41" },
                  "glos-ntc-ptc": { "s": "R", "m": "termistor", "p": { "clase": "ntc" } } },
    "cobertura": { "total": 910, "simbolo": …, "modelo": …, "ambos": …, "ninguno": … } }

Symbol keys (SIMBOLOS) and model types (MODELOS) are checked here and again in the app (unknown ones are
skipped there).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, 'web', 'public', 'libro')

# Keys understood by web/src/componentes/glosario/simbolo.ts.
SIMBOLOS = {
    'R', 'POT', 'C', 'CPOL', 'L', 'TRAFO', 'D', 'DZ', 'DS', 'LED', 'FOTODIODO', 'NPN', 'PNP', 'FOTOTRANSISTOR',
    'NMOS', 'PMOS', 'NJF', 'PJF', 'OPAMP', 'AND', 'NAND', 'OR', 'NOR', 'XOR', 'NOT', 'FF', 'REG', 'VDC', 'VSIN',
    'VPULSO', 'IDC', 'SW', 'TL', 'PUENTE', 'TIERRA', 'FUSIBLE', 'XTAL', 'PILA',
}

# Model types of web/src/componentes/tres/modelos/paquetes.ts.
MODELOS = {
    'resistencia-axial', 'resistencia-smd', 'potenciometro', 'trimmer', 'termistor', 'ldr', 'condensador-disco',
    'mlcc', 'condensador-pelicula', 'electrolitico', 'electrolitico-smd', 'tantalo', 'supercondensador',
    'bobina-axial', 'bobina-radial', 'toroide', 'bobina-smd', 'transformador', 'rele', 'diodo-do41', 'diodo-do35',
    'diodo-sod123', 'led-5mm', 'led-smd', 'puente', 'to92', 'to220', 'sot23', 'dpak', 'dip', 'soic', 'qfp', 'qfn',
    'optoacoplador', 'cristal', 'fusible', 'ptc', 'tira-pines', 'borna',
}


def e(s=None, m=None, p=None):
    d = {}
    if s:
        d['s'] = s
    if m:
        d['m'] = m
    if p:
        d['p'] = p
    return d


# Exact terms (as written in the glossary). None: no picture, even if a rule would match.
CURADO = {
    # resistors
    'Resistencia': e('R', 'resistencia-axial'),
    'Resistencia shunt': e('R', 'resistencia-smd', {'valor': 0.1, 'tamano': '2512'}),
    'Resistencia de emisor': e('R'),
    'Resistencia interna': e('R'),
    'Resistencia térmica': None,
    'Resistencia de aislamiento': None,
    'Resistividad': None,
    'Ohmio (Ω)': e('R'),
    'Ley de Ohm': e('R'),
    'Pull-up / Pull-down': e('R'),
    'Potenciómetro': e('POT', 'potenciometro'),
    'Trimmer': e('POT', 'trimmer'),
    'Reóstato': e('POT', 'potenciometro'),
    'Termistor': e('R', 'termistor'),
    'NTC / PTC': e('R', 'termistor', {'clase': 'ntc'}),
    'Varistor (MOV)': e(None, 'termistor', {'clase': 'varistor', 'diametro': 14}),
    'LDR': e('R', 'ldr'),
    'TCR': e('R', 'resistencia-axial', {'tecnologia': 'metalica', 'bandas': 5}),
    # capacitors
    'Condensador': e('C', 'condensador-disco'),
    'Capacitancia': e('C'),
    'Faradio (F)': e('C'),
    'Capacidad parásita': e('C'),
    'Condensador de acoplo': e('C', 'condensador-pelicula'),
    'Condensador de desvío (bypass)': e('C', 'mlcc'),
    'Condensador de arranque (bootstrap)': e('C'),
    'Condensador de polímero sólido': e('CPOL', 'electrolitico-smd'),
    'Plaga de condensadores': e('CPOL', 'electrolitico'),
    'Supercondensador': e('CPOL', 'supercondensador'),
    'Desacoplo': e('C', 'mlcc'),
    'ESR (Resistencia Serie Equivalente)': e('CPOL', 'electrolitico'),
    'Dieléctrico': e('C'),
    # inductors and transformers
    'Bobina': e('L', 'bobina-radial'),
    'Inductancia': e('L'),
    'Henrio (H)': e('L'),
    'Inductancia parásita': e('L'),
    'Choque (choke)': e('L', 'bobina-radial'),
    'Bobinado': e('L', 'toroide'),
    'Devanado': e('L', 'toroide'),
    'Solenoide': e('L'),
    'Toroidal': e('L', 'toroide'),
    'Ferrita': e(None, 'bobina-axial'),
    'Núcleo magnético': e(None, 'toroide'),
    'Saturación del núcleo': e('L', 'toroide'),
    'Choque de modo común': e('TRAFO', 'toroide'),
    'Transformador': e('TRAFO', 'transformador'),
    'Transformador de intensidad': e('TRAFO', 'toroide'),
    'Acoplamiento magnético': e('TRAFO'),
    'Coeficiente de acoplamiento (k)': e('TRAFO'),
    'Balun': e('TRAFO'),
    'Relé': e('SW', 'rele'),
    'Lengüeta': e(None, 'to220'),
    'Antirrebote (debounce)': e('SW'),
    # diodes
    'Diodo': e('D', 'diodo-do41'),
    'Diodo ideal': e('D'),
    'Ánodo': e('D', 'diodo-do41'),
    'Cátodo': e('D', 'diodo-do41'),
    'Unión PN': e('D'),
    'Tensión directa (Vf)': e('D'),
    'Recuperación inversa': e('D', 'diodo-do41'),
    'Zener (diodo)': e('DZ', 'diodo-do35'),
    'Schottky (diodo)': e('DS', 'diodo-sod123'),
    'TVS (diodo supresor)': e('DZ', 'diodo-do41'),
    'Flyback (diodo)': e('D', 'diodo-do41'),
    'LED (Diodo Emisor de Luz)': e('LED', 'led-5mm'),
    'LED direccionable': e('LED', 'led-smd'),
    'Diodo láser': e('LED'),
    'Fotodiodo': e('FOTODIODO'),
    'Diodo PIN': e('D'),
    'Puente rectificador': e('PUENTE', 'puente'),
    'Rectificador': e('PUENTE', 'puente'),
    # transistors
    'BJT (Transistor Bipolar de Unión)': e('NPN', 'to92'),
    'NPN': e('NPN', 'to92'),
    'PNP': e('PNP', 'to92'),
    'hFE (β)': e('NPN', 'to92'),
    'Emisor común': e('NPN'),
    'Base común': e('NPN'),
    'Colector común (seguidor de emisor)': e('NPN'),
    'Seguidor de emisor': e('NPN'),
    'Colector abierto': e('NPN'),
    'Efecto Early': e('NPN'),
    'Degeneración de emisor': e('NPN'),
    'Fototransistor': e('FOTOTRANSISTOR'),
    'MOSFET': e('NMOS', 'to220'),
    'Fuente común': e('NMOS'),
    'Drenador común': e('NMOS'),
    'Puerta común': e('NMOS'),
    'Drenador abierto (open-drain)': e('NMOS'),
    'Tensión umbral (Vth)': e('NMOS'),
    'JFET': e('NJF', 'to92'),
    'IGBT': e(None, 'to220'),
    'Tiristor': e(None, 'to220'),
    'SCR (tiristor)': e(None, 'to220'),
    'Triac': e(None, 'to220'),
    'TO-220': e(None, 'to220'),
    'Optoacoplador': e(None, 'optoacoplador'),
    # op-amps and linear circuits
    'Amplificador operacional': e('OPAMP', 'dip'),
    'Amplificador inversor': e('OPAMP'),
    'Amplificador no inversor': e('OPAMP'),
    'Amplificador diferencial': e('OPAMP'),
    'Amplificador de instrumentación': e('OPAMP'),
    'Amplificador de transimpedancia': e('OPAMP'),
    'Transimpedancia': e('OPAMP'),
    'Restador (amplificador diferencial)': e('OPAMP'),
    'Buffer (seguidor de tensión)': e('OPAMP'),
    'Comparador': e('OPAMP', 'soic'),
    'Comparador con histéresis': e('OPAMP'),
    'Integrador': e('OPAMP'),
    'Derivador': e('OPAMP'),
    'Sumador': e('OPAMP'),
    'Masa virtual': e('OPAMP'),
    'Tierra virtual': e('OPAMP'),
    'Sallen-Key': e('OPAMP'),
    'Slew rate': e('OPAMP'),
    'GBW (Producto Ganancia-Ancho de Banda)': e('OPAMP'),
    'Rail-to-rail': e('OPAMP'),
    'CMRR': e('OPAMP'),
    'Offset': e('OPAMP'),
    'Regulador de tensión': e('REG', 'to220'),
    'LDO (regulador de baja caída)': e('REG', 'sot23'),
    # logic
    'Puerta lógica': e('AND'),
    'NAND': e('NAND', 'dip', {'pines': 14}),
    'TTL': e('NAND', 'dip', {'pines': 14}),
    'CMOS': e('NOT'),
    'Lógica combinacional': e('AND'),
    'Tabla de verdad': e('XOR'),
    'Biestable (flip-flop)': e('FF'),
    'Latch (cerrojo)': e('FF'),
    'Lógica secuencial': e('FF'),
    'Metaestabilidad': e('FF'),
    # sources and quantities
    'Corriente continua (CC)': e('VDC'),
    'Corriente alterna (CA)': e('VSIN'),
    'Generador de funciones': e('VSIN'),
    'Voltio (V)': e('VDC'),
    'Fuente de corriente': e('IDC'),
    'Sumidero de corriente': e('IDC'),
    'Batería': e('PILA'),
    'Tierra (GND)': e('TIERRA'),
    'Línea de transmisión': e('TL'),
    'Impedancia característica': e('TL'),
    'Microstrip': e('TL'),
    'Stripline': e('TL'),
    'Cuarto de onda (λ/4)': e('TL'),
    'Stub': e('TL'),
    'Coeficiente de reflexión': e('TL'),
    'VSWR (ROE)': e('TL'),
    'Onda estacionaria': e('TL'),
    # protection, timing, packages, connectors
    'Fusible': e('FUSIBLE', 'fusible'),
    'Fusible rearmable (PPTC)': e('FUSIBLE', 'ptc'),
    'Cristal de cuarzo': e('XTAL', 'cristal'),
    'Resonador cerámico': e('XTAL'),
    'Encapsulado': e(None, 'dip'),
    'THT (Through-Hole)': e(None, 'dip'),
    'SMD/SMT': e(None, 'soic'),
    'QFN': e(None, 'qfn'),
    'Microcontrolador': e(None, 'qfp'),
    'EEPROM': e(None, 'soic'),
    'Flash (memoria)': e(None, 'soic'),
    'Conector': e(None, 'borna'),
    'Jumper (puente)': e(None, 'tira-pines'),
    'Zócalo': e(None, 'dip'),
    'Disipador de calor': e(None, 'to220'),
    # look like parts but are not
    'Pila (stack)': None,
    'Paquete': None,
    'Celda (silicio)': None,
    'Celda estándar (standard cell)': None,
}

# Rules on the term (accents kept), for terms not in CURADO nor PUERTAS. First match wins.
REGLAS = [
    (r'^Condensador\b', e('C')),
    (r'^Diodo\b', e('D')),
    (r'^Amplificador (inversor|no inversor|diferencial|sumador)', e('OPAMP')),
    (r'^Puente (rectificador|de diodos)', e('PUENTE')),
    (r'^Línea de transmisión', e('TL')),
    (r'^Transformador\b', e('TRAFO')),
    (r'^Bobina\b', e('L')),
    (r'^(Fuente|Generador) de corriente', e('IDC')),
]

PUERTAS = {'AND': 'AND', 'OR': 'OR', 'NOR': 'NOR', 'XOR': 'XOR', 'NOT': 'NOT', 'NAND': 'NAND'}


def imagen(termino):
    if termino in CURADO:
        return CURADO[termino]
    if termino in PUERTAS:
        return e(PUERTAS[termino])
    for patron, spec in REGLAS:
        if re.search(patron, termino):
            return spec
    return None


def comprobar(spec, termino):
    s = spec.get('s')
    m = spec.get('m')
    if s and s not in SIMBOLOS:
        raise SystemExit(f'glosario_imagenes: símbolo desconocido {s!r} para {termino!r}')
    if m and m not in MODELOS:
        raise SystemExit(f'glosario_imagenes: modelo desconocido {m!r} para {termino!r}')


def main(argv=None):
    glosario = json.load(open(os.path.join(OUT, 'glosario.json'), encoding='utf-8'))
    terminos_libro = {g['termino'] for g in glosario}
    # a curated term that is no longer in the glossary is reported (the book may rename it)
    perdidos = sorted(t for t in CURADO if t not in terminos_libro)
    terminos = {}
    for g in glosario:
        spec = imagen(g['termino'])
        if not spec:
            continue
        comprobar(spec, g['termino'])
        terminos[g['id']] = spec
    total = len(glosario)
    con_s = sum(1 for v in terminos.values() if 's' in v)
    con_m = sum(1 for v in terminos.values() if 'm' in v)
    ambos = sum(1 for v in terminos.values() if 's' in v and 'm' in v)
    cobertura = {'total': total, 'simbolo': con_s, 'modelo': con_m, 'ambos': ambos,
                 'alguno': len(terminos), 'ninguno': total - len(terminos)}
    datos = {'version': 1, 'terminos': terminos, 'cobertura': cobertura}
    with open(os.path.join(OUT, 'glosario-imagenes.json'), 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(f'glosario-imagenes.json: {total} términos · {con_s} con símbolo · {con_m} con modelo 3D '
          f'({ambos} con ambos) · {total - len(terminos)} sin imagen')
    if perdidos:
        print('  términos curados que ya no están en el glosario: ' + ', '.join(perdidos))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
