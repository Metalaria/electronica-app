"""Cross-check of the «Un fotograma» frames of the Master System, Mega Drive and Neo Geo against independent emulators.

Genesis Plus GX (libretro, non-commercial licence: only fetched and run here, never shipped) for the Master System and
the Mega Drive, Geolith (libretro, BSD-3) for the Neo Geo with ngdevkit's free nullbios. Both are fetched at pinned
commits into contenido/.cache/fotograma/contraste and driven by frente.c, a minimal libretro front end.

Two pictures match when they are the same up to a one-to-one mapping of colours (each emulator turns the console's
colour words into RGB its own way). Games are compared without pressed buttons: their state depends on input timing,
and SGDK's random() mixes in the HV counter, so with a button script the game itself diverges, not the picture.

  python3 contenido/fotograma/contraste_b/contrastar.py      (needs git, make, a C compiler and the tracers built by
                                                              ../nucleos_b.mjs in FOTOGRAMA_TMP)
"""
import io
import json
import os
import subprocess
import sys
import zipfile
from collections import Counter, defaultdict

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, '../../..'))
CACHE = os.path.join(RAIZ, 'contenido/.cache/fotograma/contraste')
HERR = os.environ.get('FOTOGRAMA_TMP', os.path.join(RAIZ, 'contenido/.cache/fotograma/bin'))
NUCLEOS = {
    'gpgx': ('https://github.com/libretro/Genesis-Plus-GX.git', '60bee4c724859710ce05672239e5b601ad01382e',
             ['make', '-f', 'Makefile.libretro'], 'genesis_plus_gx_libretro.so'),
    'geolith': ('https://github.com/libretro/geolith-libretro.git', '2dc88e3fa72ff404213a65d6eb5bb33baa687f73',
                ['make', '-C', 'libretro'], 'libretro/geolith_libretro.so'),
}
PUB = os.path.join(RAIZ, 'web/public/consolas/fotograma')
JUEGOS = os.path.join(RAIZ, 'contenido/consolas_juegos')


def nucleo(nombre):
    url, commit, orden, so = NUCLEOS[nombre]
    d = os.path.join(CACHE, nombre)
    if not os.path.exists(os.path.join(d, so)):
        if not os.path.isdir(d):
            subprocess.run(['git', 'init', '-q', d], check=True)
            subprocess.run(['git', '-C', d, 'fetch', '-q', '--depth', '1', url, commit], check=True)
            subprocess.run(['git', '-C', d, 'checkout', '-q', 'FETCH_HEAD'], check=True)
        subprocess.run(['nice', *orden, '-j2'], cwd=d, check=True, stdout=subprocess.DEVNULL)
    return os.path.join(d, so)


def frente():
    exe = os.path.join(CACHE, 'frente')
    src = os.path.join(AQUI, 'frente.c')
    if not os.path.exists(exe) or os.path.getmtime(exe) < os.path.getmtime(src):
        subprocess.run(['cc', '-O2', '-I', os.path.join(CACHE, 'geolith/libretro'), '-o', exe, src, '-ldl'], check=True)
    return exe


def ppm(ruta):
    d = open(ruta, 'rb').read()
    toks, i = [], 0
    while len(toks) < 4:
        while d[i:i + 1].isspace():
            i += 1
        j = i
        while not d[j:j + 1].isspace():
            j += 1
        toks.append(d[i:j])
        i = j
    w, h = int(toks[1]), int(toks[2])
    datos = d[i + 1:]
    return w, h, [datos[k * 3:k * 3 + 3] for k in range(w * h)]


def recortar(img, x0, y0, w, h):
    W, _, p = img
    return w, h, [p[(y0 + y) * W + x0 + x] for y in range(h) for x in range(w)]


def diferencia(a, b):
    """Pixels that differ once each colour of «a» is mapped to the colour of «b» it most often meets; one-to-one?"""
    m = defaultdict(Counter)
    for x, y in zip(a[2], b[2]):
        m[x][y] += 1
    mapa = {x: c.most_common(1)[0][0] for x, c in m.items()}
    dif = [k for k, (x, y) in enumerate(zip(a[2], b[2])) if mapa[x] != y]
    return len(dif), len(set(mapa.values())) == len(mapa), sorted({k % a[0] for k in dif})


def de_traza(ruta):
    """Frame buffer of a published trace (via the generators' reader)."""
    js = ("import {readFileSync} from 'node:fs'; import {leerTraza} from '%s';"
          "const {manifiesto:m, arrays:a}=leerTraza(readFileSync(process.argv[1]));"
          "process.stdout.write(JSON.stringify({w:m.video.ancho,h:m.video.alto,p:m.video.paleta,fb:Array.from(a[m.fb])}));"
          % os.path.join(RAIZ, 'contenido/fotograma/traza.mjs'))
    x = json.loads(subprocess.run(['node', '--input-type=module', '-e', js, ruta], check=True, capture_output=True).stdout)
    return x['w'], x['h'], [bytes(((x['p'][c] >> 16) & 255, (x['p'][c] >> 8) & 255, x['p'][c] & 255)) for c in x['fb']]


def de_json(salida, x0, y0, w, h):
    x = json.loads(salida)
    fb = x['fb']
    W = len(fb) // 300
    return w, h, [bytes(((c >> 16) & 255, (c >> 8) & 255, c & 255)) for y in range(y0, y0 + h) for c in fb[y * W + x0:y * W + x0 + w]]


def referencia(so, rom, desde, hasta, opciones, sysdir):
    out = os.path.join(CACHE, 'cuadros')
    os.makedirs(out, exist_ok=True)
    pref = os.path.join(out, os.path.basename(rom) + '_')
    subprocess.run([frente(), so, rom, sysdir, str(desde), str(hasta), pref, '', *opciones], check=True)
    return {n: ppm('%s%05d.ppm' % (pref, n)) for n in range(desde, hasta + 1)}


def mejor(nuestro, refs, recorte=None):
    res = []
    for n, img in refs.items():
        if recorte:
            img = recortar(img, *recorte)
        if (img[0], img[1]) != (nuestro[0], nuestro[1]):
            continue
        d, inj, cols = diferencia(nuestro, img)
        res.append((d, n, inj, cols))
    return min(res)


def neo_y_bios():
    """Cartridge in TerraOnion's .NEO format and an aes.zip with nullbios for Geolith."""
    J = os.path.join(JUEGOS, 'neogeo')
    sw = lambda b: bytes(b[i ^ 1] for i in range(len(b)))
    p = open(os.path.join(J, 'scrolling.p1'), 'rb').read()
    p += b'\xff' * (-len(p) % 0x100000)
    s = open(os.path.join(J, 'scrolling.s1'), 'rb').read().ljust(0x20000, b'\0')
    c1, c2 = (open(os.path.join(J, 'scrolling.c%d' % i), 'rb').read() for i in (1, 2))
    n = 1 << (max(len(c1), len(c2)) - 1).bit_length()
    c = bytearray(2 * n)
    c[0::2], c[1::2] = c1.ljust(n, b'\0'), c2.ljust(n, b'\0')
    m = bytes([0xF3, 0x76]).ljust(0x20000, b'\0')   # Z80: DI, HALT (the trace does not emulate the Z80 either)
    v = bytes(0x80000)
    import struct
    cab = bytearray(4096)
    cab[0:4] = b'NEO\x01'
    struct.pack_into('<6I', cab, 4, len(p), len(s), len(m), len(v), 0, len(c))
    struct.pack_into('<4I', cab, 28, 2026, 0, 0, 0x539)
    neo = os.path.join(CACHE, 'scrolling.neo')
    open(neo, 'wb').write(bytes(cab) + sw(p) + s + m + v + bytes(c))
    sysdir = os.path.join(CACHE, 'sys')
    os.makedirs(sysdir, exist_ok=True)
    bios = sw(open(os.path.join(J, 'nullbios-aes.bin'), 'rb').read())
    # the zoom table ROM (L0) as ngdevkit generates it: byte n of row r = smallest step of the shrink table
    lo = subprocess.run([sys.executable, os.path.join(CACHE, 'ngdevkit-zoom-rom.py'), '-o', '/dev/stdout'],
                        check=True, capture_output=True).stdout if os.path.exists(os.path.join(CACHE, 'ngdevkit-zoom-rom.py')) else None
    with zipfile.ZipFile(os.path.join(sysdir, 'aes.zip'), 'w') as z:
        z.writestr('neo-epo.bin', bios)
        z.writestr('neo-po.bin', bios)
        if lo:
            z.writestr('000-lo.lo', lo)
    return neo, sysdir


def main():
    os.makedirs(CACHE, exist_ok=True)
    gpgx, geolith = nucleo('gpgx'), nucleo('geolith')
    if not os.path.exists(os.path.join(CACHE, 'ngdevkit-zoom-rom.py')):
        subprocess.run(['curl', '-sSfL', '-o', os.path.join(CACHE, 'ngdevkit-zoom-rom.py'),
                        'https://raw.githubusercontent.com/dciabrin/ngdevkit/5106cbd1414a86ba02810ee93ac977be3360de4f/nullbios/zoom-rom.py'], check=True)
    sysdir = os.path.join(CACHE, 'sys')
    os.makedirs(sysdir, exist_ok=True)
    sms = ['genesis_plus_gx_region_detect=pal', 'genesis_plus_gx_system_hw=master system II']
    md = lambda r: ['genesis_plus_gx_region_detect=' + r, 'genesis_plus_gx_system_hw=mega drive / genesis']
    filas = []

    def apuntar(nombre, nuestro, refs, recorte=None):
        d, n, inj, cols = mejor(nuestro, refs, recorte)
        total = nuestro[0] * nuestro[1]
        filas.append((nombre, n, d, total, inj, cols))
        print('%-34s cuadro de referencia %4d: %6d de %6d píxeles distintos%s%s' % (
            nombre, n, d, total, '' if inj else ' (colores no biyectivos)', ' en las columnas %s' % cols if d else ''))

    demos = os.path.join(RAIZ, 'contenido/consolas_demos')
    apuntar('sms/demo', de_traza(os.path.join(PUB, 'sms/demo.bin')), referencia(gpgx, os.path.join(demos, 'sms/demo.sms'), 1, 12, sms, sysdir))
    apuntar('megadrive/demo', de_traza(os.path.join(PUB, 'megadrive/demo.bin')), referencia(gpgx, os.path.join(demos, 'megadrive/demo.md'), 1, 12, md('pal'), sysdir))
    apuntar('megadrive/demo-ntsc', de_traza(os.path.join(PUB, 'megadrive/demo-ntsc.bin')), referencia(gpgx, os.path.join(demos, 'megadrive/demo.md'), 1, 12, md('ntsc-u'), sysdir))
    # games, without buttons
    rom = os.path.join(JUEGOS, 'sms/food_fighter.sms')
    x = subprocess.run([os.path.join(HERR, 'sms_traza'), rom, '300', '--juego', '3000'], check=True, capture_output=True).stdout
    apuntar('sms/foodfighter (sin botones, 300)', de_json(x, 13, 54, 256, 192), referencia(gpgx, rom, 295, 305, sms, sysdir))
    rom = os.path.join(JUEGOS, 'megadrive/gentris.bin')
    x = subprocess.run([os.path.join(HERR, 'md_traza'), rom, '120', '1', '--juego', '4000'], check=True, capture_output=True).stdout
    apuntar('megadrive/gentris (menú, 120)', de_json(x, 13, 38, 320, 224), referencia(gpgx, rom, 116, 124, md('pal'), sysdir))
    neo, sysdir = neo_y_bios()
    apuntar('neogeo/scrolling (120)', de_traza(os.path.join(PUB, 'neogeo/scrolling.bin')),
            referencia(geolith, neo, 116, 124, ['geolith_system_type=aes', 'geolith_region=eu', 'geolith_palette=raw',
                                                'geolith_overscan_t=0', 'geolith_overscan_b=0', 'geolith_overscan_l=0',
                                                'geolith_overscan_r=0', 'geolith_sprlimit=96'], sysdir), (0, 8, 320, 224))
    return filas


if __name__ == '__main__':
    main()
