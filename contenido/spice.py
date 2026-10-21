#!/usr/bin/env python3
"""Netlists of the book for the simulator: copy, index (spice.json) and validation in the app's engine.

    cd /home/claude/app && python3 contenido/spice.py [--sin-validar] [--nativo] [--revalidar]

Reads /home/claude/v3/complementos/spice/<stem>/*.cir (never writes there) and the already generated
web/public/libro/indice.json, refs.json and partes/*.json (run contenido/generar.py first). Writes
web/public/libro/spice/<stem>/*.cir, web/public/libro/spice.json and spice-refs.json (format in ESQUEMA.md).

Validation runs every netlist in the app's own ngspice (WebAssembly) with Node
(web/scripts/validar-spice.mjs); results are cached by content in contenido/.cache/spice-validacion.json, so a
rerun only simulates what changed. --nativo also compares the measurements with the system's `ngspice -b`;
--revalidar ignores the cache; --sin-validar skips it (spice.json then says "sin-validar").
"""
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
WEB = os.path.join(APP, 'web')
V3 = '/home/claude/v3'
SRC = os.path.join(V3, 'complementos', 'spice')
OUT = os.path.join(WEB, 'public', 'libro')
CACHE = os.path.join(HERE, '.cache', 'spice-validacion.json')
# A netlist that takes longer than this in the validator is marked as heavy in the app.
PESADA_MS = 8000


def load_json(path):
    return json.load(open(path, encoding='utf-8'))


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


# ------------------------------------------------------------------ SPICE numbers (as netlist.ts)
NUM_SPICE = re.compile(r'^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([a-zµ]*)$', re.I)
SUFIJOS = {'t': 1e12, 'g': 1e9, 'k': 1e3, 'm': 1e-3, 'u': 1e-6, 'µ': 1e-6, 'n': 1e-9, 'p': 1e-12,
           'f': 1e-15, 'a': 1e-18}


def numero_spice(tok):
    m = NUM_SPICE.match(tok.strip())
    if not m:
        return None
    base = float(m.group(1))
    suf = m.group(2).lower()
    if suf.startswith('meg'):
        mult = 1e6
    elif suf.startswith('mil'):
        mult = 25.4e-6
    elif suf:
        mult = SUFIJOS.get(suf[0], 1)
    else:
        mult = 1
    v = base * mult
    return v if math.isfinite(v) else None


# ------------------------------------------------------------------ structure (as netlist.ts)
TOKEN = re.compile(r'[^\s(),=]+|=')


def estructura(texto):
    """Logical lines outside .control (with their .subckt), the .control lines, and whether there is one."""
    lineas = []
    control = []
    en_control = False
    hay_control = False
    pila = []
    actual = None
    fisicas = texto.split('\n')
    for i in range(1, len(fisicas)):
        limpio = fisicas[i].rstrip('\r')
        rec = limpio.strip()
        if en_control:
            if re.match(r'^\.endc\b', rec, re.I):
                en_control = False
            else:
                control.append(rec)
            continue
        if re.match(r'^\.control\b', rec, re.I):
            en_control = hay_control = True
            actual = None
            continue
        if not rec or rec.startswith('*'):
            continue
        cont = rec.startswith('+')
        cuerpo = limpio
        c1 = cuerpo.find(';')
        if c1 >= 0:
            cuerpo = cuerpo[:c1]
        m2 = re.search(r'\s\$', cuerpo)
        if m2:
            cuerpo = cuerpo[:m2.start()]
        desde = cuerpo.index('+') + 1 if cont else 0
        tokens = [m.group(0) for m in TOKEN.finditer(cuerpo, desde)]
        if cont and actual is not None:
            actual['tokens'] += tokens
            continue
        primero = tokens[0].lower() if tokens else ''
        if primero == '.subckt':
            pila.append((tokens[1] if len(tokens) > 1 else '?').lower())
            actual = None
            continue
        if primero == '.ends':
            if pila:
                pila.pop()
            actual = None
            continue
        actual = {'linea': i, 'tokens': tokens, 'subckt': pila[-1] if pila else None}
        lineas.append(actual)
    return lineas, control, hay_control


ANALISIS = ['op', 'dc', 'ac', 'tran', 'noise', 'tf', 'pz', 'sens', 'four', 'disto', 'sp', 'pss']


def analizar(texto):
    lineas, control, hay_control = estructura(texto)
    vistos = set()
    for l in lineas:
        t = l['tokens'][0].lower() if l['tokens'] else ''
        if t.startswith('.'):
            if t[1:] in ANALISIS:
                vistos.add(t[1:])
            if t in ('.meas', '.measure') and len(l['tokens']) > 1 and l['tokens'][1].lower() in ANALISIS:
                vistos.add(l['tokens'][1].lower())
    for c in control:
        t = re.split(r'[\s(]', c)[0].lower()
        if t in ANALISIS:
            vistos.add(t)
    return hay_control, [a for a in ANALISIS if a in vistos]


UNIDAD = {'R': 'Ω', 'C': 'F', 'L': 'H', 'V': 'V', 'I': 'A', 'E': '', 'G': 'S', 'param': ''}


def parametros(texto):
    """Component values that can be varied with a slider (same rules and ids as netlist.ts)."""
    lineas, control, _ = estructura(texto)
    alterados = set()
    for c in control:
        m = re.match(r'^(alter|alterparam)\s+@?([^\s\[=]+)', c, re.I)
        if m:
            alterados.add(m.group(2).lower())
    res = []
    ids = set()

    def agregar(elemento, subckt, campo, tipo, tok, linea):
        if tok is None:
            return
        valor = numero_spice(tok)
        if valor is None or valor == 0:
            return
        base = (subckt + '.' if subckt else '') + elemento.lower()
        pid = f'param:{base}' if tipo == 'param' else (base if campo == 'valor' else f'{base}.{campo}')
        if pid in ids:
            return
        ids.add(pid)
        unidad = 'Hz' if campo == 'sin.freq' else 's' if campo == 'pulse.per' else UNIDAD.get(tipo, '')
        res.append({'id': pid, 'elemento': elemento, 'subckt': subckt, 'campo': campo, 'tipo': tipo,
                    'valor': valor, 'texto': tok, 'unidad': unidad, 'min': valor / 10, 'max': valor * 10,
                    'e12': tipo in ('R', 'C', 'L'), 'linea': linea})

    for l in lineas:
        t = l['tokens']
        nombre = t[0] if t else ''
        k = nombre[:1].upper()
        sub, li = l['subckt'], l['linea']
        if nombre.lower() == '.param':
            i = 1
            while i + 2 < len(t) + 1:
                if i + 1 < len(t) and t[i + 1] == '=' and i + 2 < len(t):
                    if t[i].lower() not in alterados:
                        agregar(t[i], sub, 'param', 'param', t[i + 2], li)
                    i += 2
                i += 1
            continue
        if nombre.startswith('.') or nombre.lower() in alterados:
            continue
        if k in ('R', 'C', 'L'):
            if len(t) >= 4 and not (len(t) > 4 and t[4] == '='):
                agregar(nombre, sub, 'valor', k, t[3], li)
        elif k in ('E', 'G'):
            if len(t) == 6:
                agregar(nombre, sub, 'valor', k, t[5], li)
        elif k in ('V', 'I'):
            i = 3
            while i < len(t):
                w = t[i].lower()
                if w == 'dc':
                    agregar(nombre, sub, 'dc', k, t[i + 1] if i + 1 < len(t) else None, li)
                    i += 2
                elif w == 'ac':
                    i += 2
                    if i < len(t) and numero_spice(t[i]) is not None:
                        i += 1
                elif w in ('sin', 'pulse'):
                    args = []
                    j = i + 1
                    while j < len(t) and numero_spice(t[j]) is not None:
                        args.append(t[j])
                        j += 1
                    arg = lambda n: args[n] if n < len(args) else None  # noqa: E731
                    if w == 'sin':
                        agregar(nombre, sub, 'sin.va', k, arg(1), li)
                        agregar(nombre, sub, 'sin.freq', k, arg(2), li)
                    else:
                        agregar(nombre, sub, 'pulse.v2', k, arg(1), li)
                        agregar(nombre, sub, 'pulse.per', k, arg(6), li)
                    i = j
                elif i == 3 and numero_spice(t[i]) is not None:
                    agregar(nombre, sub, 'dc', k, t[i], li)
                    i += 1
                else:
                    i += 1
    return res


def usa_xspice(texto):
    """XSPICE code-model devices (A elements): the WebAssembly ngspice is built without XSPICE."""
    lineas, _, _ = estructura(texto)
    return any(l['tokens'] and l['tokens'][0][:1].upper() == 'A' and not l['tokens'][0].startswith('.')
               for l in lineas)


# ------------------------------------------------------------------ header, references, title
def cabecera(texto):
    """The leading comment block, without «* » and without the «Ejecutar: ngspice -b …» line."""
    out = []
    for linea in texto.split('\n'):
        if not linea.startswith('*'):
            break
        t = linea[1:]
        if t.startswith(' '):
            t = t[1:]
        if re.match(r'\s*Ejecutar\s*:', t, re.I):
            continue
        out.append(t.rstrip())
    while out and not out[-1].strip():
        out.pop()
    return '\n'.join(out)


# Labels in names and headers. «_» is a word character, so \b would not split «fig-5.13_prob-5.A»: explicit
# look-arounds instead.
ETIQUETA = re.compile(r'(?<![A-Za-z0-9])(fig|sec|prob|ej|tab)[-_ ]?(\d+)\.(\d+|[A-Z])(?![0-9A-Za-z])')
MENCION = [
    ('fig', re.compile(r'\b[Ff]ig(?:ura)?s?\.?\s+((?:\d+\.\d+)(?:(?:\s*(?:,|y|e|/)\s*)\d+\.\d+)*)')),
    ('sec', re.compile(r'\b[Ss]ecci[oó]n(?:es)?\s+((?:\d+\.\d+)(?:(?:\s*(?:,|y|e|/)\s*)\d+\.\d+)*)')),
    ('prob', re.compile(r'\b[Pp]roblemas?\s+((?:\d+\.[A-Z])(?:(?:\s*(?:,|y|e|/)\s*)\d+\.[A-Z])*)')),
    ('ej', re.compile(r'\b[Ee]jercicios?\s+((?:\d+\.\d+)(?:(?:\s*(?:,|y|e|a|/)\s*)\d+\.\d+)*)')),
    ('tab', re.compile(r'\b[Tt]ablas?\s+((?:\d+\.\d+)(?:(?:\s*(?:,|y|e|/)\s*)\d+\.\d+)*)')),
]


def referencias(nombre, descripcion, refs):
    """Labels the netlist checks: from the file name first (in order), then from the header."""
    out = []

    def add(label):
        if label in refs and label not in out:
            out.append(label)

    # «prob31B» (no separators) and «prob_1.A» are also used in file names
    n = re.sub(r'(?<![A-Za-z])prob(\d+)([A-Z])(?![A-Za-z0-9])', r'prob-\1.\2', nombre)
    for m in ETIQUETA.finditer(n):
        add(f'{m.group(1)}-{m.group(2)}.{m.group(3)}')
    # a bare «_23.4» in a file name is a section
    for m in re.finditer(r'(?:^|_)(\d+)\.(\d+)(?=$|_)', n):
        if not re.search(r'(fig|sec|prob|ej|tab)[-_ ]?$', n[:m.start() + 1]):
            add(f'sec-{m.group(1)}.{m.group(2)}')
    for tipo, rx in MENCION:
        for m in rx.finditer(descripcion):
            nums = re.findall(r'\d+\.(?:\d+|[A-Z])', m.group(1))
            # «ejercicios 1.1 a 1.9»: expand the range within the chapter
            if tipo == 'ej' and re.search(r'\d+\.\d+\s+a\s+\d+\.\d+', m.group(1)):
                a, b = re.findall(r'(\d+)\.(\d+)', m.group(1))[:2]
                if a[0] == b[0] and int(b[1]) - int(a[1]) < 30:
                    nums = [f'{a[0]}.{k}' for k in range(int(a[1]), int(b[1]) + 1)]
            for x in nums:
                add(f'{tipo}-{x}')
    for m in ETIQUETA.finditer(descripcion):
        add(f'{m.group(1)}-{m.group(2)}.{m.group(3)}')
    return out


SIGLAS = {'rc', 'rl', 'rlc', 'lc', 'led', 'bjt', 'fet', 'mosfet', 'pwm', 'ac', 'dc', 'adc', 'dac', 'fft', 'pll',
          'cmrr', 'srf', 'lcr', 'iv', 'esr', 'mlcc', 'ldo', 'cc', 'i2c', 'spi', 'can', 'rs485', 'tdr', 'sdr', 'am',
          'fm', 'fi', 'afc', 'rtd', 'iot', 'h', 'ntc', 'ptc', 'lm386', 'lm3914', 'usbc', 'vbe', 'hfe', 'ab', 'b',
          'd', 'cs', 'rf', 'emc', 'esd', 'p', 'c', 'l', 'nand', 'nor', 'xor'}
ESPECIALES = {'usbc': 'USB-C', 'i2c': 'I²C', 'rs485': 'RS-485', 'hfe': 'hFE', 'vbe': 'VBE', 'claseb': 'clase B',
              'clased': 'clase D', 'e24': 'E24', '4-20ma': '4-20 mA'}


def titulo_de(nombre):
    """Readable title from the file name: «fig-42.5_filtro_rc» → «Filtro RC»."""
    t = re.sub(r'(?<![A-Za-z0-9])(fig|sec|prob|ej|tab)[-_]?\d+\.(\d+|[A-Z])(?![0-9A-Za-z])', ' ', nombre)
    t = re.sub(r'(?<![A-Za-z])prob\d+[A-Z](?![A-Za-z0-9])', ' ', t)
    t = re.sub(r'(?:^|_)\d+\.\d+(?:\.\d+)?(?=$|_)', ' ', t)
    palabras = [w for w in re.split(r'[_\s]+|(?<=[a-z])-(?=[a-z])', t) if w and w != '-']
    out = []
    for w in palabras:
        lw = w.lower()
        if lw in ESPECIALES:
            out.append(ESPECIALES[lw])
        elif lw in SIGLAS:
            out.append(lw.upper())
        elif re.fullmatch(r'\d+(?:[a-z]+\d*)+', lw):    # 470u, 320v, 150ohm, 12a5
            out.append(lw.replace('ohm', ' Ω').replace('v', ' V') if re.fullmatch(r'\d+(ohm|v)', lw) else lw)
        else:
            out.append(lw)
    s = ' '.join(out).strip(' -')
    return s[:1].upper() + s[1:] if s else ''


def natural(s):
    return [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', s)]


# ------------------------------------------------------------------ labels rendered in the reader
def etiquetas_en_partes():
    """Labels that exist as DOM ids in the generated parts (where the reader can show «Simular»)."""
    out = set()

    def visitar(o):
        if isinstance(o, dict):
            if isinstance(o.get('label'), str):
                out.add(o['label'])
            for v in o.values():
                visitar(v)
        elif isinstance(o, list):
            for v in o:
                visitar(v)

    d = os.path.join(OUT, 'partes')
    for f in os.listdir(d):
        if f.endswith('.json'):
            visitar(load_json(os.path.join(d, f)))
    return out


# ------------------------------------------------------------------ validation in the engine
def validar(ids_textos, nativo, revalidar):
    """{id: result} from web/scripts/validar-spice.mjs, reusing cached results of unchanged netlists."""
    script = os.path.join(WEB, 'scripts', 'validar-spice.mjs')
    motor = os.path.join(WEB, 'scripts', 'ngspice.mjs')
    if not shutil.which('node'):
        print('spice: no hay Node.js; no se validan las netlists', file=sys.stderr)
        return None
    r = subprocess.run(['node', motor], cwd=WEB)
    if r.returncode != 0:
        print('spice: no se pudo preparar el motor (¿falta «npm install» en web/?)', file=sys.stderr)
        return None
    wasm = os.path.join(WEB, 'public', 'ngspice', 'ngspice.wasm')
    huella_motor = hashlib.sha256(open(wasm, 'rb').read()).hexdigest()[:16]
    for f in ('nucleo.ts', 'netlist.ts', 'salida.ts'):
        huella_motor += hashlib.sha256(open(os.path.join(WEB, 'src', 'simulador', 'motor', f), 'rb').read()).hexdigest()[:8]
    cache = {}
    if os.path.exists(CACHE) and not revalidar:
        c = load_json(CACHE)
        if c.get('motor') == huella_motor:
            cache = c.get('netlists', {})
    res = {}
    pendientes = []
    for nid, texto in ids_textos.items():
        h = hashlib.sha256(texto.encode('utf-8')).hexdigest()[:16]
        e = cache.get(nid)
        if e and e.get('huella') == h and (not nativo or 'nativo' in e):
            res[nid] = e
        else:
            pendientes.append((nid, h))
    if pendientes:
        print(f'spice: validando {len(pendientes)} netlists en el motor (WebAssembly)…', file=sys.stderr)
        tmp = os.path.join(HERE, '.cache', 'spice-informe.json')
        args = ['node', '--no-warnings', script, '--dir', os.path.join(OUT, 'spice'), '--salida', tmp]
        if nativo:
            args.append('--nativo')
        if len(pendientes) < len(ids_textos):
            # only the changed ones: one call per netlist keeps the script simple
            informe = {}
            for nid, _ in pendientes:
                subprocess.run(args + ['--solo', nid], cwd=WEB, check=True)
                informe.update(load_json(tmp)['netlists'])
        else:
            subprocess.run(args, cwd=WEB, check=True)
            informe = load_json(tmp)['netlists']
        os.remove(tmp)
        for nid, h in pendientes:
            e = informe.get(nid)
            if e:
                e.pop('salida', None)
                e['huella'] = h
                res[nid] = e
    write_json(CACHE, {'motor': huella_motor, 'netlists': res})
    return res


def resumen_motor(v, xspice):
    """The «motor» field of spice.json from a validation result."""
    if xspice:
        return {'estado': 'no-disponible', 'nota': 'Usa dispositivos XSPICE (puertas digitales y puentes '
                'ADC/DAC), que el ngspice de la aplicación no incluye. Se puede leer la netlist, pero no '
                'simularla aquí; con ngspice instalado en el ordenador: ngspice -b fichero.cir.'}
    if v is None:
        return {'estado': 'sin-validar'}
    out = {'estado': v['estado'], 'ms': v.get('ms'), 'medidas': len(v.get('medidas') or []),
           'graficas': len(v.get('graficas') or [])}
    if v.get('errores'):
        out['errores'] = v['errores'][:3]
    if (v.get('ms') or 0) > PESADA_MS or v['estado'] == 'tiempo':
        out['pesada'] = True
    return out


# ------------------------------------------------------------------ main
def main():
    args = sys.argv[1:]
    for p in ('indice.json', 'refs.json'):
        if not os.path.exists(os.path.join(OUT, p)):
            sys.exit(f'spice: falta web/public/libro/{p}; ejecute antes contenido/generar.py')
    indice = load_json(os.path.join(OUT, 'indice.json'))
    refs = load_json(os.path.join(OUT, 'refs.json'))
    en_partes = etiquetas_en_partes()
    orden = [p for t in indice['tomos'] for p in t['partes']]

    carpetas = sorted((d for d in os.listdir(SRC) if os.path.isdir(os.path.join(SRC, d))),
                      key=lambda d: (orden.index(d) if d in orden else len(orden), d))
    destino = os.path.join(OUT, 'spice')
    if os.path.isdir(destino):
        shutil.rmtree(destino)

    netlists = {}
    textos = {}
    capitulos = []
    problemas = []
    for stem in carpetas:
        info = indice['partes'].get(stem)
        if info is None:
            problemas.append(f'{stem}: la carpeta no corresponde a ninguna parte del índice')
        ficheros = sorted((f for f in os.listdir(os.path.join(SRC, stem)) if f.endswith('.cir')), key=natural)
        ids = []
        for f in ficheros:
            raw = open(os.path.join(SRC, stem, f), 'rb').read()
            texto = raw.decode('utf-8')
            os.makedirs(os.path.join(destino, stem), exist_ok=True)
            open(os.path.join(destino, stem, f), 'wb').write(raw)
            nombre = f[:-4]
            nid = f'{stem}/{nombre}'
            desc = cabecera(texto)
            control, analisis = analizar(texto)
            rs = referencias(nombre, desc, refs)
            netlists[nid] = {
                'fichero': f'spice/{stem}/{f}',
                'parte': stem,
                'nombre': nombre,
                'titulo': titulo_de(nombre),
                'ref': rs[0] if rs else None,
                'refs': rs,
                'descripcion': desc,
                'analisis': analisis,
                'control': control,
                'parametros': parametros(texto),
                'xspice': usa_xspice(texto),
            }
            textos[nid] = texto
            ids.append(nid)
            if not desc:
                problemas.append(f'{nid}: sin comentario de cabecera')
        def clave_orden(nid):
            r = refs.get(netlists[nid]['ref'] or '')
            if not r:
                return (1, [], natural(nid))
            num = [int(x) if x.isdigit() else ord(x) for x in re.split(r'[.]', r['num'])]
            return (0, num, natural(nid))
        ids.sort(key=clave_orden)
        if ids:
            capitulos.append({'parte': stem, 'tipo': (info or {}).get('tipo', 'capitulo'),
                              'num': (info or {}).get('num'), 'titulo': (info or {}).get('titulo', stem),
                              'color': (info or {}).get('color'), 'tomo': (info or {}).get('tomo'),
                              'netlists': ids})

    # validation in the engine, and agreement of the slider parameters with netlist.ts
    val = None if '--sin-validar' in args else validar(textos, '--nativo' in args, '--revalidar' in args)
    for nid, n in netlists.items():
        v = (val or {}).get(nid)
        n['motor'] = resumen_motor(v if val is not None else None, n.pop('xspice'))
        # XSPICE netlists have an analog equivalent (<name>_analogica.cir) that the app's engine can run
        alt = nid + '_analogica'
        if n['motor']['estado'] == 'no-disponible' and alt in netlists:
            n['motor']['alternativa'] = alt
            n['motor']['nota'] = ('Usa dispositivos XSPICE (puertas digitales y puentes ADC/DAC), que el ngspice '
                                  'de la aplicación no incluye. Hay una versión analógica equivalente, con las '
                                  'mismas medidas, que sí se simula aquí.')
        if v is not None and 'parametros' in v:
            py = [(p['id'], p['valor']) for p in n['parametros']]
            ts = [(p['id'], p['valor']) for p in v['parametros']]
            if len(py) != len(ts) or any(a[0] != b[0] or abs(a[1] - b[1]) > 1e-12 * max(1, abs(a[1]))
                                         for a, b in zip(py, ts)):
                problemas.append(f'{nid}: los parámetros de spice.py y netlist.ts no coinciden: {py} / {ts}')

    por_ref = {}
    for nid, n in netlists.items():
        for r in n['refs']:
            if r in en_partes:
                por_ref.setdefault(r, []).append(nid)

    motor = {'paquete': 'eecircuit-engine'}
    try:
        pk = load_json(os.path.join(WEB, 'node_modules', 'eecircuit-engine', 'package.json'))
        motor['version'] = pk['version']
    except OSError:
        pass
    write_json(os.path.join(OUT, 'spice.json'), {
        'version': 1, 'motor': motor, 'total': len(netlists), 'capitulos': capitulos,
        'netlists': netlists, 'porRef': por_ref})
    # The reader only needs the «Simular» map: a small file it can fetch at start-up.
    write_json(os.path.join(OUT, 'spice-refs.json'), por_ref)

    # summary
    estados = {}
    for n in netlists.values():
        estados[n['motor']['estado']] = estados.get(n['motor']['estado'], 0) + 1
    sin_ref = [nid for nid, n in netlists.items() if not n['refs']]
    print(f'spice: {len(netlists)} netlists en {len(capitulos)} capítulos; '
          f'{sum(len(v) for v in por_ref.values())} enlaces «Simular» en {len(por_ref)} figuras/secciones; '
          f'{sum(len(n["parametros"]) for n in netlists.values())} parámetros')
    print('spice: motor: ' + ', '.join(f'{k} {v}' for k, v in sorted(estados.items())))
    if sin_ref:
        print(f'spice: {len(sin_ref)} sin figura ni sección identificada: {", ".join(sin_ref)}')
    for nid, n in netlists.items():
        m = n['motor']
        if m['estado'] not in ('ok', 'sin-validar'):
            print(f'  {m["estado"]:>13}  {nid}: {(m.get("errores") or [m.get("nota", "")])[0][:110]}')
        elif m.get('pesada'):
            print(f'  {"pesada":>13}  {nid}: {m.get("ms")} ms')
    if val:
        dif = [(nid, v['nativo']) for nid, v in val.items() if v.get('nativo', {}).get('estado') == 'difiere']
        if dif:
            print(f'spice: {len(dif)} netlists con medidas distintas de ngspice nativo:')
            for nid, d in dif:
                print(f'  {nid}: {d["totalDiferencias"]} de {d["medidas"]}; p. ej. {d["diferencias"][:2]}')
    for p in problemas:
        print('  PROBLEMA ' + p)
    return 0 if not problemas else 1


if __name__ == '__main__':
    sys.exit(main())
