"""«Kit FM7303»: the live, interactive version of the FM receiver kit of printed chapter 15 (cap16.typ).

Writes web/public/fm7303/:

  esquema.svg   the complete schematic of the kit, redrawn (fm7303_esquema.py), light plate and dark ink
  kit.json      its topology in the «Datos de figuras» format (for the live overlay), the DC model netlist
                (template with the adjustable parts as placeholders) and its correspondence with the drawing,
                every component with its value, function and book section, the voltage map and the test
                points with the book's values (each one checked against the text of cap16.typ), the signal
                path, the alignment model constants and the faults of the troubleshooting mode.

Every number shown as «del libro» carries the label of the section or figure it comes from and a short quote;
the build fails if the quote is not found in that section of /home/claude/v3/libro/cap16.typ (or in the
original schematic, figure 15.26, for the values that only the schematic gives). The DC model is run with the
native ngspice when present, as a check that it reproduces the book's voltage map.

Run alone (python3 contenido/fm7303.py) or from generar.py (fm7303.main()).
"""

import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
V3 = os.environ.get('V3', '/home/claude/v3')
OUT = os.path.join(APP, 'web/public/fm7303')

sys.path.insert(0, HERE)
import fm7303_dibujo as Dib       # noqa: E402
import fm7303_esquema as Esq      # noqa: E402
import fm7303_datos as Dat        # noqa: E402


# ================================================================== SVG
def svg_esquema(esq, topo, dim):
    W, H = dim['ancho'], dim['alto']
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
           f'font-family="{Dib.FUENTE}">',
           f'<rect x="0" y="0" width="{W}" height="{H}" fill="#ffffff"/>']
    # block areas (faint), drawn first
    out.extend(esq.fondo)
    out.append(f'<g stroke="{Dib.TINTA}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none">')
    for net, pts in esq.cables:
        d = ' '.join(f'{Dib.fmt(x)},{Dib.fmt(y)}' for x, y in pts)
        out.append(f'<polyline points="{d}"/>')
    out.append('</g>')
    out.append(f'<g stroke="{Dib.TINTA}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none">')
    for p in esq.partes:
        out.append(f'<g data-ref="{Dib.esc(p.ref)}">' + ''.join(p.svg) + '</g>')
    out.append('</g>')
    out.append(f'<g fill="{Dib.TINTA}">')
    for x, y in topo.juntas():
        out.append(f'<circle cx="{Dib.fmt(x)}" cy="{Dib.fmt(y)}" r="2.3"/>')
    out.append('</g>')
    out.extend(esq.textos)
    out.append('</svg>')
    return '\n'.join(out)


# ================================================================== topology (Datos de figuras)
ETIQUETAS_RED = {
    '0': 'masa', 'vin': '12 V antes de K4 (CZ1)', 'v12': '12 V', 'v8': '8 V (IC4)', 'v6': '6 V (78L06)',
    'v59': '5,9 V (tras L3)', 'v33': '3,3 V (AMS1117)', 'v31': '3,1 V (display)', 'det': 'TP3 · Det Out',
    'tp1': 'TP1', 'if2': 'TP2 · entrada de FI de IC3', 'tp4': 'TP4 · 38 kHz', 'o1': 'salida 1 del TEA2025',
    'o2': 'salida 2 del TEA2025', 'sm': 'medidor de señal', 'var': 'varicap D1 (AFC)', 'mute': 'mute (IC3, 4)',
    'osc': 'tanque del oscilador', 'rf': 'tanque de RF', 'mixout': 'salida del mezclador (IC1, 6)',
    'bge': 'emisor de BG1 (FM In)', 'bgb': 'base de BG1', 'st': 'IC4, 6 (LED estéreo)', 'mpx': 'IC4, 1 (MPX)',
}


def red_spice(n):
    return n.lower()


def topologia_json(esq, topo):
    nets = sorted({p.redes[t] for p in esq.partes for t in p.term} | {n for n, _ in esq.cables})
    nets.remove('0')
    nodo = {'0': 'N0'}
    for k, n in enumerate(nets, 1):
        nodo[n] = f'N{k}'
    usados = set(topo.term_pt.values())
    for _, tr in topo.tramos:
        usados.update(tr)
    puntos = []
    red_de_punto = {}
    for j in sorted(usados):
        ns = topo.net_pt.get(j)
        n = next(iter(ns))
        red_de_punto[j] = n
        x, y = topo.puntos[j]
        puntos.append({'id': f'P{j}', 'xy': [round(x, 2), round(y, 2)], 'nodo': nodo[n]})
    elementos = []
    eid = {}
    for i, p in enumerate(esq.partes, 1):
        e = f'E{i}'
        eid[p.ref] = e
        anclas = {t: [round(x, 2), round(y, 2)] for t, (x, y) in p.term.items()}
        for k, (x, y) in p.anclas.items():
            anclas[k] = [round(x, 2), round(y, 2)]
        el = {'id': e, 'clase': p.clase, 'rol': p.rol, 'designador': p.ref,
              'etiquetas': [f'{p.ref} {p.texto}' if p.texto else p.ref], 'anclas': anclas,
              'caja': [round(c, 2) for c in p.caja] if p.caja else None,
              'terminales': {t: nodo[p.redes[t]] for t in p.term if not p.redes[t].startswith('nc')},
              'puntos_terminal': {t: f'P{topo.term_pt[(p.ref, t)]}' for t in p.term if not p.redes[t].startswith('nc')}}
        if p.valor is not None:
            el['valor'] = p.valor
            el['unidad'] = p.unidad
        if p.texto:
            el['valor_texto'] = p.texto
        if p.polaridad:
            el['polaridad'] = p.polaridad
        elementos.append(el)
    nodos = []
    for n, nid in sorted(nodo.items(), key=lambda kv: int(kv[1][1:])):
        if n.startswith('nc'):
            continue
        pts = [f'P{j}' for j, r in red_de_punto.items() if r == n]
        terms = [f'{eid[p.ref]}.{t}' for p in esq.partes for t in p.term if p.redes[t] == n]
        nodos.append({'id': nid, 'tierra': n == '0', 'puntos': pts, 'terminales': terms,
                      'etiquetas': [ETIQUETAS_RED[n]] if n in ETIQUETAS_RED else [], 'red': n})
    tramos = []
    for k, (n, tr) in enumerate(topo.tramos):
        pts = [[round(topo.puntos[j][0], 2), round(topo.puntos[j][1], 2)] for j in tr]
        largo = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
        tramos.append({'id': f'T{k}', 'elemento': None, 'origen': 'fm7303', 'nodo': nodo[n], 'de': f'P{tr[0]}',
                       'a': f'P{tr[-1]}', 'puntos': pts, 'longitud': round(largo, 2)})
    esquema = {'eje': -1, 'tolerancia': Dib.TOL, 'dibujo_a_svg': {'sx': 1, 'tx': 0, 'sy': 1, 'ty': 0},
               'puntos': puntos, 'elementos': elementos, 'nodos': nodos, 'tramos': tramos}
    return esquema, nodo, eid


# ================================================================== DC model
# Behavioural macro-models of the ICs: only what the book gives (supply pins, TP3, outputs at mid-supply,
# quiescent currents) plus the supply currents assumed by the companion netlist fig-16.25_alimentacion.cir.
# Every load current is `I0·tanh(V/0.5 V)`, so a missing supply takes the pin to 0 V instead of a negative
# voltage. Pins whose DC level depends on circuitry the book does not describe are left at high impedance
# and listed in SIN_MODELO (the app shows «—» there).
SUBCIRCUITOS = r"""
.model FV1043 D (IS=1e-14 CJO=30p VJ=0.7 M=0.5 BV=30)
.model GE1N60 D (IS=2u N=1.2 RS=5 CJO=1p BV=40)
.model DLED D (IS=1e-18 N=1.9 RS=5)
.model Q9018 NPN (IS=1e-14 BF=100 VAF=100 CJE=1p CJC=0.8p TF=0.3n)
.subckt TA7358 p1 p2 p3 p4 p5 p6 p7 p8 p9
* front-end: 6 mA in all (companion netlist), split between Vcc (9), RF amplifier (3) and mixer (6)
B9 p9 p5 I = 4m*tanh(V(p9,p5)/0.5)
B3 p3 p5 I = 1m*tanh(V(p3,p5)/0.5)
B6 p6 p5 I = 1m*tanh(V(p6,p5)/0.5)
R1 p1 p5 1g
R2 p2 p5 1g
R4 p4 p5 1g
R7 p7 p5 1g
R8 p8 p5 1g
.ends
.subckt TA7061 p1 p2 p3 p4 p5 p6 p7
* IF amplifier: 2 mA through R8 into pin 5, 1.5 mA output stage through R7 into pin 3 (assumed)
B5 p5 p4 I = 2m*tanh(V(p5,p4)/0.5)
B3 p3 p4 I = 1.5m*tanh(V(p3,p4)/0.5)
R1 p1 p4 1g
R2 p2 p4 1g
R6 p6 p4 1g
R7 p7 p4 1g
.ends
.subckt TA7303 p1 p2 p3 p4 p5 p6 p7 p8 p9 params: vdet=4.6 vsm=0
* IF/detector: 6 mA into pin 9 (assumed); pin 8 = detector output (TP3, 4.6 V centred), pin 3 = signal meter
B9 p9 p5 I = 6m*tanh(V(p9,p5)/0.5)
B8 d8 p5 V = {vdet}*tanh(V(p9,p5)/2)
R8 d8 p8 100
B3 d3 p5 V = {vsm}*tanh(V(p9,p5)/2)
R3 d3 p3 100
R1 p1 p5 1g
R2 p2 p5 1g
R4 p4 p5 1g
R6 p6 p5 1g
R7 p7 p5 1g
.ends
.subckt TA7343 p1 p2 p3 p4 p5 p6 p7 p8 p9 params: icore=18m rled=1g
* stereo decoder: 18 mA in all with its LED (the current that drops 4 V in R13); pin 6 sinks the LED
B3 p3 p5 I = {icore}*tanh(V(p3,p5)/0.5)
R6 p6 p5 {rled}
R1 p1 p5 1g
R2 p2 p5 1g
R4 p4 p5 1g
R7 p7 p5 1g
R8 p8 p5 1g
R9 p9 p5 1g
.ends
.subckt TEA2025 p1 p2 p3 p4 p5 p6 p7 p8 p9 p10 p11 p12 p13 p14 p15 p16
* audio amplifier: 35 mA quiescent (book, section 15.5); both outputs at half the supply (figure 15.28)
B16 p16 p4 I = 35m*tanh(V(p16,p4)/0.5)
B2 d2 p4 V = V(p16,p4)/2
R2 d2 p2 1
B15 d15 p4 V = V(p16,p4)/2
R15 d15 p15 1
R1 p1 p4 1g
R3 p3 p4 1g
R6 p6 p4 1g
R7 p7 p4 1g
R8 p8 p4 1g
R10 p10 p4 1g
R11 p11 p4 1g
R14 p14 p4 1g
R5 p5 p4 1m
R9 p9 p4 1m
R12 p12 p4 1m
R13 p13 p4 1m
.ends
.subckt REG in out gnd params: v=6 caida=1.7 iq=3m en=1
* linear regulator: output = min(v, Vin - dropout); input current = output current + Iq
Bq in gnd I = {iq*en}*tanh(V(in,gnd)/0.5)
Breg oi gnd V = {en}*min({v}, max(V(in,gnd)-{caida}, 0))
Vs oi out 0
Fin in gnd Vs 1
.ends
.subckt DISP amfm range amin gnd vcc fmin
* SC3610D module: 3 mA from Vcc+ (companion netlist assumption)
B1 vcc gnd I = 3m*tanh(V(vcc,gnd)/0.5)
R1 fmin gnd 1g
R2 amfm gnd 1g
R3 range gnd 1g
R4 amin gnd 1g
.ends
.subckt POT a b w params: ra=10k rb=10k
R1 a w {ra}
R2 w b {rb}
.ends
.subckt SPDT com a b params: ra=1g rb=0.01
R1 com a {ra}
R2 com b {rb}
.ends
.subckt BOBINA a b params: r=6
L1 a m 100u
R1 m b {r}
.ends
.subckt FI p1 p3 p6 p4
L1 p1 p3 3u
L2 p6 p4 0.1u
.ends
.subckt CERAMICO p1 p3 p2
C1 p1 p2 30p
C2 p3 p2 30p
C3 p1 p3 1p
.ends
.subckt BPF in out gnd
C1 in out 10p
R1 in gnd 1g
R2 out gnd 1g
.ends
.subckt JACK l r g
R1 l g 1g
R2 r g 1g
.ends
"""

# Nodes whose DC voltage the macro-models do not set (pins biased by circuitry the book does not describe).
SIN_MODELO = ['ant', 'rfin', 'ic1_2', 'mixin', 'osc8', 'ic2_1', 'ic2_2', 'ic2in', 'ic2_7', 'if2', 'ic3_2',
              'b2a', 'b2b', 'mpx', 'lpf', 'lpf2', 'vco', 'w3a', 'outl', 'outr', 'in1', 'in2', 'fb1', 'fb2', 'svr', 'bs1',
              'bs2']
# Nodes that are known only in some switch positions: mute (pin 4 of IC3) without K2, pin 7 of IC4 without K3.
SIN_MODELO_SEGUN = {'mute': 'K2', 'pil': 'K3'}

# Placeholders of the template and their default values (the kit as built, aligned, K1/K2 off, stereo off).
PARAMETROS = {
    'VCC': 12, 'K4': 0.01, 'K1A': '1g', 'K1B': 0.01, 'K2': '1e12', 'K3': '1e12', 'MON': '1e12',
    'W1A': 4660, 'W1B': 15340, 'W2A': 5000, 'W2B': 5000, 'W3A': 2500, 'W3B': 2500,
    'W4LA': 10000, 'W4LB': 10000, 'W4RA': 10000, 'W4RB': 10000,
    'VDET': 4.6, 'VSM': 0, 'ICORE': '18m', 'RLED': '1g', 'RL3': 6, 'R13': 220, 'IC6EN': 1, 'RSPK': 8,
}


def modelo_dc(esq, nodo, eid):
    """Netlist template of the whole kit at DC, and its correspondence with the drawing."""
    L = ['* FM7303 V3.0r7: modelo de continua del kit completo (generado por contenido/fm7303.py)',
         '.options rshunt=1e12']
    corr = {}

    def n(p, t):
        r = p.redes[t]
        return '0' if r == '0' else red_spice(r)

    def linea(p, nombre, texto, pines):
        L.append(texto)
        corr[eid[p.ref]] = {'nombre': nombre.lower(), 'pines': pines}

    for p in esq.partes:
        r = p.ref
        s = re.sub(r'[^a-z0-9]', '', r.lower().replace("'", 'p').replace('-', '_'))
        if p.rol in ('GND', 'RAIL') or r == 'ANT':
            continue
        if p.rol == 'R':
            val = '{{R13}}' if r == 'R13' else Dib.fmt(p.valor)
            linea(p, f'r{s}' if not s.startswith('r') else s, f'{s if s.startswith("r") else "r" + s} {n(p, "start")} {n(p, "end")} {val}',
                  {'start': 0, 'end': 1})
        elif p.rol == 'C':
            nm = s if s.startswith('c') else 'c' + s
            linea(p, nm, f'{nm} {n(p, "start")} {n(p, "end")} {p.valor:.6g}', {'start': 0, 'end': 1})
        elif p.rol == 'L' and r == 'L3':
            linea(p, 'xl3', f'xl3 {n(p, "start")} {n(p, "end")} BOBINA params: r={{{{RL3}}}}', {'start': 0, 'end': 1})
        elif p.rol == 'L':
            nm = s if s.startswith('l') else 'l' + s
            linea(p, nm, f'{nm} {n(p, "start")} {n(p, "end")} {p.valor:.6g}', {'start': 0, 'end': 1})
        elif p.rol in ('D', 'VAR', 'LED'):
            mod = {'D1': 'FV1043', 'D2': 'GE1N60', 'D3': 'GE1N60', 'D4': 'DLED', 'D5': 'DLED'}[r]
            linea(p, s, f'{s} {n(p, "start")} {n(p, "end")} {mod}', {'start': 0, 'end': 1})
        elif p.rol == 'QN':
            linea(p, 'qbg1', f'qbg1 {n(p, "collector")} {n(p, "base")} {n(p, "emitter")} Q9018',
                  {'collector': 0, 'base': 1, 'emitter': 2})
        elif p.rol == 'POT':
            k = r.replace('-', '').upper().replace('W41', 'W4L').replace('W42', 'W4R')
            nm = 'x' + s
            linea(p, nm, f'{nm} {n(p, "start")} {n(p, "end")} {n(p, "tap")} POT params: ra={{{{{k}A}}}} rb={{{{{k}B}}}}',
                  {'start': 0, 'end': 1, 'tap': 2})
        elif p.rol == 'SW':
            k = 'MON' if r == 'MON' else r
            nm = 'r' + s
            linea(p, nm, f'{nm} {n(p, "start")} {n(p, "end")} {{{{{k}}}}}', {'start': 0, 'end': 1})
        elif p.rol == 'SPDT':
            linea(p, 'xk1', f'xk1 {n(p, "com")} {n(p, "a")} {n(p, "b")} SPDT params: ra={{{{K1A}}}} rb={{{{K1B}}}}',
                  {'com': 0, 'a': 1, 'b': 2})
        elif p.rol == 'VM':
            linea(p, 'rm1', f'rm1 {n(p, "start")} {n(p, "end")} 10meg', {'start': 0, 'end': 1})
        elif p.rol == 'SPK':
            nm = 'r' + s
            linea(p, nm, f'{nm} {n(p, "start")} {n(p, "end")} {{{{RSPK}}}}', {'start': 0, 'end': 1})
        elif p.rol == 'V':
            linea(p, 'vcz1', f'vcz1 {n(p, "pos")} {n(p, "neg")} dc {{{{VCC}}}}', {'pos': 0, 'neg': 1})
        elif p.rol == 'XFMR':
            linea(p, 'xb1', f'xb1 {n(p, "p1")} {n(p, "p3")} {n(p, "p6")} {n(p, "p4")} FI', {'p1': 0, 'p3': 1, 'p6': 2, 'p4': 3})
        elif r in ('CF1', 'CF2'):
            linea(p, 'x' + s, f'x{s} {n(p, "p1")} {n(p, "p3")} {n(p, "p2")} CERAMICO', {'p1': 0, 'p3': 1, 'p2': 2})
        elif r == 'BPF':
            linea(p, 'xbpf', f'xbpf {n(p, "in")} {n(p, "out")} {n(p, "gnd")} BPF', {'in': 0, 'out': 1, 'gnd': 2})
        elif r == 'CZ3':
            linea(p, 'xcz3', f'xcz3 {n(p, "l")} {n(p, "r")} {n(p, "g")} JACK', {'l': 0, 'r': 1, 'g': 2})
        elif r == 'SC3610D':
            orden = ['amfm', 'range', 'amin', 'gnd', 'vcc', 'fmin']
            linea(p, 'xdisp', 'xdisp ' + ' '.join(n(p, t) for t in orden) + ' DISP', {t: i for i, t in enumerate(orden)})
        elif r in ('IC7', 'IC6'):
            orden = ['in', 'out', 'gnd']
            par = 'v=6 caida=1.7 iq=3m en=1' if r == 'IC7' else 'v=3.3 caida=1.1 iq=5m en={{IC6EN}}'
            linea(p, 'x' + s, f'x{s} ' + ' '.join(n(p, t) for t in orden) + f' REG params: {par}', {t: i for i, t in enumerate(orden)})
        elif r in ('IC1', 'IC2', 'IC3', 'IC4', 'IC5'):
            npin = {'IC1': 9, 'IC2': 7, 'IC3': 9, 'IC4': 9, 'IC5': 16}[r]
            sub = {'IC1': 'TA7358', 'IC2': 'TA7061', 'IC3': 'TA7303', 'IC4': 'TA7343', 'IC5': 'TEA2025'}[r]
            par = {'IC3': ' params: vdet={{VDET}} vsm={{VSM}}', 'IC4': ' params: icore={{ICORE}} rled={{RLED}}'}.get(r, '')
            nodos_ic = []
            pines = {}
            for k in range(1, npin + 1):
                red = p.redes[f'p{k}']
                if red.startswith('nc'):
                    nodos_ic.append(f'{s}_nc{k}')
                else:
                    nodos_ic.append('0' if red == '0' else red_spice(red))
                    pines[f'p{k}'] = k - 1
            linea(p, 'x' + s, f'x{s} ' + ' '.join(nodos_ic) + f' {sub}{par}', pines)
        else:
            raise SystemExit(f'modelo de continua: no sé modelar {r} ({p.rol})')
    L.append(SUBCIRCUITOS.strip())
    L.append('.end')
    nodos = {nid: ('0' if red == '0' else red_spice(red)) for red, nid in nodo.items() if not red.startswith('nc')}
    return '\n'.join(L) + '\n', {'nodos': nodos, 'elementos': corr}


def rellenar(plantilla, valores):
    return re.sub(r'\{\{(\w+)\}\}', lambda m: str(valores[m.group(1)]), plantilla)


def simular_nativo(texto, nodos):
    """Operating point with the native ngspice (check of the model at build time), or None."""
    if not shutil.which('ngspice'):
        return None
    with tempfile.TemporaryDirectory() as d:
        cir = os.path.join(d, 'kit.cir')
        lineas = texto.replace('.end\n', '')
        lineas += '.control\nop\nprint all\n.endc\n.end\n'
        with open(cir, 'w') as f:
            f.write(lineas)
        r = subprocess.run(['ngspice', '-b', cir], capture_output=True, text=True, timeout=60)
        v = {}
        for l in r.stdout.splitlines():
            m = re.match(r'^\s*(\S+)\s*=\s*([-+0-9.eE]+)\s*$', l)
            if m:
                v[m.group(1).lower()] = float(m.group(2))
        if not v:
            raise SystemExit('fm7303: ngspice no resolvió el modelo de continua:\n' + r.stdout[-2000:] + r.stderr[-2000:])
        return v


# ================================================================== signal path
def trazo_cadena(esq, topo, cadena):
    """Polyline of a chain of parts [(ref, in, out)], following the drawn wires between them."""
    from collections import deque
    adj = {}
    for net, tr in topo.tramos:
        for a, b in zip(tr, tr[1:]):
            adj.setdefault(a, set()).add(b)
            adj.setdefault(b, set()).add(a)

    def camino(ja, jb):
        if ja == jb:
            return [ja]
        prev = {ja: None}
        q = deque([ja])
        while q:
            u = q.popleft()
            if u == jb:
                break
            for v in adj.get(u, ()):
                if v not in prev:
                    prev[v] = u
                    q.append(v)
        if jb not in prev:
            raise SystemExit(f'trayecto de señal: no hay cable entre {topo.puntos[ja]} y {topo.puntos[jb]}')
        res = []
        u = jb
        while u is not None:
            res.append(u)
            u = prev[u]
        return res[::-1]

    pts = []

    def mas(xy):
        xy = [round(xy[0], 2), round(xy[1], 2)]
        if not pts or pts[-1] != xy:
            pts.append(xy)

    previo = None
    for ref, tin, tout in cadena:
        p = esq[ref]
        ja = topo.term_pt[(ref, tin)]
        if previo is not None:
            for j in camino(previo, ja):
                mas(topo.puntos[j])
        mas(p.term[tin])
        if tin != tout:
            if set(p.term) == {'start', 'end'} or (tin in ('start', 'end') and tout in ('start', 'end') and 'istart' in p.anclas):
                orden = ['start', 'istart', 'iend', 'end'] if tin == 'start' else ['end', 'iend', 'istart', 'start']
                for k in orden[1:]:
                    mas(p.anclas[k] if k in p.anclas else p.term[k])
            else:
                mas(p.anclas['center'])
                mas(p.term[tout])
        previo = topo.term_pt[(ref, tout)]
    return pts


def fondo_bloques(esq, cajas):
    out = []
    for b, (x0, y0, x1, y1) in cajas.items():
        c = Esq.BLOQUES[b]['color']
        out.append(f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" rx="8" fill="{c}" fill-opacity="0.05" '
                   f'stroke="{c}" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="5 4"/>')
        out.append(f'<circle cx="{x0 + 11}" cy="{y0 + 11}" r="8" fill="{c}"/>')
        out.append(f'<text x="{x0 + 11}" y="{y0 + 14.5}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff">{b}</text>')
    esq.fondo = out


def _main():
    esq, dim = Esq.construir()
    topo = Dib.Topologia(esq).construir()
    fondo_bloques(esq, Esq.CAJAS)
    os.makedirs(OUT, exist_ok=True)
    svg = svg_esquema(esq, topo, dim)
    with open(os.path.join(OUT, 'esquema.svg'), 'w', encoding='utf-8') as f:
        f.write(svg)
    esquema, nodo, eid = topologia_json(esq, topo)
    plantilla, corr = modelo_dc(esq, nodo, eid)
    v = simular_nativo(rellenar(plantilla, PARAMETROS), corr['nodos'])
    if v:
        for k in ('vin', 'v12', 'v8', 'v6', 'v59', 'v33', 'v31', 'tp1', 'det', 'o1', 'o2', 'bge', 'var', 'st', 'd5a'):
            print(f'   {k:6s} {v.get(k, float("nan")):8.3f} V')
        print('   I(CZ1) =', v.get('vcz1#branch'))
    # book data, with every citation checked against cap16.typ
    errores, citas, refs = Dat.exportar(os.path.join(V3, 'libro/cap16.typ'), os.path.join(APP, 'web/public/libro/refs.json'))
    sin_ficha = [p.ref for p in esq.partes if p.rol not in ('GND', 'RAIL') and p.ref not in Dat.COMPONENTES]
    if sin_ficha:
        errores.append('componentes sin ficha: ' + ', '.join(sin_ficha))
    if v:
        for m in Dat.MAPA:
            got = v.get(m['red'])
            if got is None or abs(got - m['esperado']) > m['esperado'] * m['tol']:
                errores.append(f"mapa de tensiones: {m['nombre']}: el modelo da {got} V frente a {m['esperado']} V del libro")
    if errores:
        raise SystemExit('fm7303: ' + '\n  '.join(errores))
    componentes = {}
    for p in esq.partes:
        if p.ref not in Dat.COMPONENTES:
            continue
        f, sec, anim = Dat.COMPONENTES[p.ref]
        componentes[p.ref] = {'id': eid[p.ref], 'funcion': f, 'seccion': sec, 'num': refs[sec]['num'], 'animacion': anim,
                              'bloque': p.bloque, 'valor': p.texto}
    etapas = []
    for et in Dat.ETAPAS:
        d = {k: et[k] for k in ('id', 'nombre', 'bloque', 'senal', 'cita')}
        d['trazos'] = [trazo_cadena(esq, topo, et['cadena'])]
        if 'cadena2' in et:
            d['trazos'].append(trazo_cadena(esq, topo, et['cadena2']))
        d['piezas'] = sorted({r for c in ('cadena', 'cadena2') for r, _, _ in et.get(c, [])})
        etapas.append(d)
    tps = []
    for t in Dat.TPS:
        xy = next(xy for i, n, xy, e in esq.puntos_prueba if i == t['id'])
        tps.append({**t, 'xy': list(xy), 'nodo': nodo[t['red']]})
    mapa = [{**m, 'nodo': nodo[m['red']]} for m in Dat.MAPA]
    bloques = {b: {**d, 'caja': Esq.CAJAS[b], 'num': refs[d['seccion']]['num']} for b, d in Esq.BLOQUES.items()}
    kit = {'version': 1, 'vista': [0, 0, dim['ancho'], dim['alto']], 'esquema': esquema,
           'modelo': {'plantilla': plantilla, 'parametros': PARAMETROS, 'correspondencia': corr,
                      'sin_modelo': SIN_MODELO, 'sin_modelo_segun': SIN_MODELO_SEGUN},
           'citas': citas, 'componentes': componentes, 'bloques': bloques, 'mapa': mapa, 'tps': tps,
           'etapas': etapas, 'pasos': Dat.PASOS, 'averias': Dat.AVERIAS, 'emisoras': Dat.EMISORAS,
           'constantes': Dat.CONSTANTES}
    with open(os.path.join(OUT, 'kit.json'), 'w', encoding='utf-8') as f:
        json.dump(kit, f, ensure_ascii=False, separators=(',', ':'))
    print(f'fm7303: {len(esq.partes)} partes, {len(esq.cables)} cables, {len(topo.tramos)} tramos')
    return 0


def main():
    """Builds web/public/fm7303/; returns 0, or 1 (with the reason printed) when a check fails."""
    try:
        return _main()
    except SystemExit as e:
        if e.code in (0, None):
            return 0
        print(e.code if isinstance(e.code, str) else f'fm7303: error {e.code}')
        return 1


if __name__ == '__main__':
    sys.exit(main())
