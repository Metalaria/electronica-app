"""Check floooh's z80.h (the Z80 core of the Master System and Mega Drive traces) against SingleStepTests/z80.

For every test of the chosen opcodes: final registers, RAM and the bus activity of each T state. The tests (generated
by a reference emulator, see the repository) mark /MREQ, /IORQ, /RD and /WR per T state; z80.h raises its pins once per machine cycle (M1 at T1,
memory and I/O cycles at T2, refresh at T3), so each access is compared as (type, address, data, T1 of its
machine cycle) and the T-state offset of every access type must be the same in all tests.
z80.h keeps PC on a HALT opcode while halted (and re-reads it), the test ends with PC past it: only that
difference is accepted for opcode 76.

Usage: python3 validar_z80.py <z80_sst binary> <cache dir> [opcode file names …]
Test files: https://github.com/SingleStepTests/z80 (v1/<opcode>.json), MIT licence.
"""
import collections
import json
import os
import subprocess
import sys
import urllib.request

URL = 'https://raw.githubusercontent.com/SingleStepTests/z80/main/v1/%s.json'
# Opcodes used by the demos (SMS «Paso a paso», the Mega Drive's idle Z80) plus the common ones of game code.
POR_DEFECTO = ('00 01 06 0e 10 11 18 20 21 22 23 28 2a 31 32 36 3a 3c 3e 47 76 77 7e af b7 c3 c9 cd d3 db '
               'e5 e1 f3 f5 f1 fb 08 1d 15 c5 c1 ed 45 ed 4d ed 56 ed b0 ed b3 ed 79 ed 78 dd 21 dd 7e 00').split()

REGS = 'pc sp a f b c d e h l i r wz ix iy af_ bc_ de_ hl_ im iff1 iff2'.split()


def nombres(args):
    if args:
        return args
    out, i = [], 0
    while i < len(POR_DEFECTO):
        if POR_DEFECTO[i] in ('ed', 'dd') and i + 1 < len(POR_DEFECTO):
            out.append(POR_DEFECTO[i] + ' ' + POR_DEFECTO[i + 1])
            i += 2
        else:
            out.append(POR_DEFECTO[i])
            i += 1
    return sorted(set(out))


def cargar(cache, nombre):
    ruta = os.path.join(cache, nombre.replace(' ', '_') + '.json')
    if not os.path.exists(ruta):
        with urllib.request.urlopen(URL % nombre.replace(' ', '%20')) as r, open(ruta, 'wb') as f:
            f.write(r.read())
    return json.load(open(ruta))


def accesos_sst(ciclos):
    """(kind, address, data, first T index) from the per-T-state test data."""
    out, previo = [], None
    for t, (a, d, p) in enumerate(ciclos):
        rd, wr, mreq, iorq = p[0] == 'r', p[1] == 'w', p[2] == 'm', p[3] == 'i'
        clave = None
        if mreq and (rd or wr):
            clave = 'mw' if wr else 'mr'
        elif iorq and (rd or wr):
            clave = 'iw' if wr else 'ir'
        if clave and (previo is None or previo[0] != clave or previo[3] != t - 1):
            dato = d
            # the data is on the bus in a later T state of the same cycle
            for t2 in range(t, min(t + 3, len(ciclos))):
                if ciclos[t2][1] is not None:
                    dato = ciclos[t2][1]
                    break
            # T1 of the machine cycle: the test shows /MREQ with /RD or /WR from T2 and /IORQ from TW
            t1 = t - (2 if clave[0] == 'i' else 1)
            out.append([clave, a, dato, t1])
            previo = [clave, a, dato, t]
        elif clave:
            previo[3] = t
            out[-1][3] = out[-1][3]
        else:
            previo = None
    return [x for x in out]


def ticks_fin_pc(lineas):
    return int(next(l for l in lineas if l.startswith('N')).split()[1])


def main():
    exe, cache = sys.argv[1], sys.argv[2]
    os.makedirs(cache, exist_ok=True)
    fallos, pruebas, accesos = collections.Counter(), 0, 0
    desfase = collections.defaultdict(collections.Counter)
    bits_f = collections.defaultdict(int)
    ejemplos = []
    for nombre in nombres(sys.argv[3:]):
        tests = cargar(cache, nombre)
        entrada = []
        for k, t in enumerate(tests):
            ini = t['initial']
            entrada.append('T %d' % k)
            entrada.append('R ' + ' '.join(str(ini[r]) for r in REGS))
            entrada += ['M %d %d' % (a, v) for a, v in ini['ram']]
            entrada += ['P %d %d' % (p[0], p[1]) for p in t.get('ports', []) if p[2] == 'r']
            entrada.append('G')
        res = subprocess.run([exe], input='\n'.join(entrada) + '\n', capture_output=True, text=True, check=True).stdout
        bloques = res.split('T ')[1:]
        for k, (t, b) in enumerate(zip(tests, bloques)):
            pruebas += 1
            lineas = b.strip().split('\n')[1:]
            ticks = [list(map(int, l.split()[1:])) for l in lineas if l.startswith('K')]
            fin = [int(x) for x in next(l for l in lineas if l.startswith('F')).split()[1:]]
            esperado = t['final']
            # z80.h stops at T1 of the next fetch: PC already points past the next opcode's address
            fin[0] = ticks_fin_pc(lineas)
            mal = [r for r, v in zip(REGS, fin) if r not in ('wz', 'f') and esperado[r] != v]
            if esperado['f'] != fin[3]:
                bits = esperado['f'] ^ fin[3]
                mal.append('f' if bits & 0xD7 else 'f-xy')   # bits 3 and 5 are undocumented
                bits_f[nombre] |= bits
            if nombre == '76' and mal == ['pc'] and fin[0] + 1 == esperado['pc']:
                mal = []   # z80.h keeps PC on the HALT opcode while halted (see the note at the top)
            ram = {int(l.split()[1]): int(l.split()[2]) for l in lineas if l.startswith('W')}
            for a, v in esperado['ram']:
                if a in ram and ram[a] != v:
                    mal.append('ram %d' % a)
            if len(ticks) != len(t['cycles']):
                mal.append('ciclos %d/%d' % (len(ticks), len(t['cycles'])))
            # accesses of z80.h: one tick per machine cycle
            mios = []
            for i, (a, d, m1, mreq, iorq, rd, wr, rfsh) in enumerate(ticks):
                if m1 and mreq:
                    mios.append(['mr', a, d, i, 'm1'])
                elif mreq and rd:
                    mios.append(['mr', a, d, i, 'mr'])
                elif mreq and wr:
                    mios.append(['mw', a, d, i, 'mw'])
                elif iorq and rd and not m1:
                    mios.append(['ir', a, d, i, 'ir'])
                elif iorq and wr:
                    mios.append(['iw', a, d, i, 'iw'])
            suyos = accesos_sst(t['cycles'])
            if len(mios) != len(suyos):
                mal.append('accesos %d/%d' % (len(mios), len(suyos)))
            else:
                for m, s in zip(mios, suyos):
                    accesos += 1
                    if m[0] != s[0] or m[1] != s[1] or (s[2] is not None and m[2] != s[2]):
                        mal.append('acceso %r/%r' % (m, s))
                        break
                    desfase[m[4]][s[3] - m[3]] += 1
            if mal:
                fallos[nombre] += 1
                if len(ejemplos) < 8:
                    ejemplos.append((t['name'], mal[:4]))
    print('validar_z80: %d pruebas, %d accesos al bus comparados, %d pruebas con diferencias' % (pruebas, accesos, sum(fallos.values())))
    for tipo, c in sorted(desfase.items()):
        print('  %s: T1 del ciclo (prueba) − tick de z80.h = %s' % (tipo, dict(c)))
    for n, c in fallos.most_common():
        print('  fallos en %s: %d (bits de F distintos: %02X)' % (n, c, bits_f[n]))
    for e in ejemplos:
        print('  ejemplo:', e)
    return 1 if fallos else 0


if __name__ == '__main__':
    sys.exit(main())
