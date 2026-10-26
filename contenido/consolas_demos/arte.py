"""Tiles of the «Un fotograma» demo programs, drawn as text and encoded for each console.

Writes the include files of the demos (versioned, like the sources):
  nes/chr.inc     ca65 `.byte` lines, NES planar 2bpp (8 bytes of plane 0, then 8 of plane 1 per tile)
  nes/fondo.inc   nametable 0 and attribute table of the NES demo
  gb/fondo.inc    background map (and CGB palette numbers) of the Game Boy demos
  gb/teselas.inc  rgbasm `db` lines, Game Boy 2bpp (plane 0 and plane 1 interleaved per row); the GBC demo
                  includes the same file.

Run: python3 contenido/consolas_demos/arte.py
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))

# '.' = colour 0, '1'..'3' = colours 1..3. Index = tile number in every console.
TESELAS = [
    ('sky', [
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
    ]),
    ('cloud left', [
        '........',
        '....111.',
        '..11111.',
        '.1111111',
        '11111111',
        '11111111',
        '.1111111',
        '........',
    ]),
    ('cloud right', [
        '........',
        '1.......',
        '111.....',
        '11111...',
        '1111111.',
        '11111111',
        '1111111.',
        '........',
    ]),
    ('grass', [
        '3.3..3.3',
        '33333333',
        '22222222',
        '22122212',
        '22222222',
        '12222122',
        '22222222',
        '22212222',
    ]),
    ('ground', [
        '22222222',
        '21222222',
        '22222122',
        '22222222',
        '22122222',
        '22222212',
        '12222222',
        '22222222',
    ]),
    ('brick', [
        '33333331',
        '22223221',
        '22223221',
        '11111111',
        '32222232',
        '32222232',
        '32222232',
        '11111111',
    ]),
    ('sun', [
        '..3333..',
        '.333333.',
        '33333333',
        '33333333',
        '33333333',
        '33333333',
        '.333333.',
        '..3333..',
    ]),
    ('water', [
        '11111111',
        '11.11111',
        '1.1.1111',
        '11111111',
        '11111111',
        '1111.11.',
        '111.1.11',
        '11111111',
    ]),
    # sprite: a small robot, 16 x 16 in four tiles (top left, top right, bottom left, bottom right)
    ('robot top left', [
        '......33',
        '.....3..',
        '...33333',
        '..322222',
        '..321122',
        '..321122',
        '..322222',
        '...33333',
    ]),
    ('robot top right', [
        '33......',
        '..3.....',
        '33333...',
        '222223..',
        '221123..',
        '221123..',
        '222223..',
        '33333...',
    ]),
    ('robot bottom left', [
        '....3222',
        '.333.322',
        '3.3.3222',
        '...33222',
        '....3222',
        '....3333',
        '....33..',
        '...333..',
    ]),
    ('robot bottom right', [
        '2223....',
        '223.333.',
        '2223.3.3',
        '22233...',
        '2223....',
        '3333....',
        '..33....',
        '..333...',
    ]),
    # second frame of the water, copied over tile $07 by the CGB demo's HBlank DMA every 8 frames
    ('water b', [
        '11111111',
        '1111.111',
        '111.1.11',
        '11111111',
        '11111111',
        '11.11111',
        '1.1.1111',
        '11111111',
    ]),
]


# Backgrounds as text: ' ' sky, '<' '>' cloud, 'o' sun, '#' brick, '=' grass, '%' ground, '~' water.
CLAVE = {' ': 0, '<': 1, '>': 2, '=': 3, '%': 4, '#': 5, 'o': 6, '~': 7}
# palette of each tile kind (NES attribute areas and CGB tile attributes)
PALETA = {' ': 0, '<': 0, '>': 0, 'o': 0, '=': 1, '%': 1, '#': 2, '~': 3}

# NES: 32 x 30 tiles; every 2 x 2 area must use one palette (attribute table granularity)
FONDO_NES = [
    '                                ',
    '                                ',
    '                                ',
    '                          o     ',
    '    <>                          ',
    '                                ',
    '                                ',
    '                  <><>          ',
    '                                ',
    '                                ',
    '                                ',
    '         <>                     ',
    '                                ',
    '                                ',
    '                                ',
    '                                ',
    '                                ',
    '                                ',
    '          ######                ',
    '                                ',
    '================================',
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
]

# Game Boy: the visible 20 x 18 tiles of the 32 x 32 map (the rest is sky)
FONDO_GB = [
    '                    ',
    '                o   ',
    '                    ',
    '   <>               ',
    '                    ',
    '            <><>    ',
    '                    ',
    '                    ',
    '                    ',
    '      ####          ',
    '                    ',
    '                    ',
    '====================',
    '%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%',
    '~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~',
]


def fondo_nes():
    assert len(FONDO_NES) == 30 and all(len(f) == 32 for f in FONDO_NES)
    tiles = [CLAVE[c] for f in FONDO_NES for c in f]
    attrs = []
    for by in range(8):
        for bx in range(8):
            b = 0
            for q, (dy, dx) in enumerate(((0, 0), (0, 2), (2, 0), (2, 2))):
                y, x = by * 4 + dy, bx * 4 + dx
                if y >= 30:
                    continue
                area = {PALETA[FONDO_NES[y + j][x + i]] for j in (0, 1) if y + j < 30 for i in (0, 1)}
                area.discard(0) if len(area) > 1 else None
                assert len(area) == 1, (y, x, area)
                b |= area.pop() << (2 * q)
            attrs.append(b)
    return tiles, attrs


def fondo_gb():
    assert len(FONDO_GB) == 18 and all(len(f) == 20 for f in FONDO_GB)
    tiles, pals = [], []
    for y in range(32):
        for x in range(32):
            c = FONDO_GB[y][x] if y < 18 and x < 20 else ' '
            tiles.append(CLAVE[c])
            pals.append(PALETA[c])
    return tiles, pals


def filas_bytes(datos, ancho, directiva):
    return ['    %s ' % directiva + ', '.join('$%02X' % b for b in datos[i:i + ancho]) for i in range(0, len(datos), ancho)]


def planos(filas):
    p0, p1 = [], []
    for f in filas:
        assert len(f) == 8, f
        b0 = b1 = 0
        for i, ch in enumerate(f):
            c = 0 if ch == '.' else int(ch)
            b0 |= (c & 1) << (7 - i)
            b1 |= (c >> 1) << (7 - i)
        p0.append(b0)
        p1.append(b1)
    return p0, p1


def main():
    nes = ['; Generated by contenido/consolas_demos/arte.py: NES 2bpp tiles (plane 0 then plane 1).']
    gb = ['; Generated by contenido/consolas_demos/arte.py: Game Boy 2bpp tiles (planes interleaved by row).']
    for i, (nombre, filas) in enumerate(TESELAS):
        p0, p1 = planos(filas)
        nes.append('; tile $%02X: %s' % (i, nombre))
        nes.append('    .byte ' + ', '.join('$%02X' % b for b in p0))
        nes.append('    .byte ' + ', '.join('$%02X' % b for b in p1))
        gb.append('; tile $%02X: %s' % (i, nombre))
        gb.append('    db ' + ', '.join('$%02X, $%02X' % (a, b) for a, b in zip(p0, p1)))
    with open(os.path.join(HERE, 'nes/chr.inc'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(nes) + '\n')
    os.makedirs(os.path.join(HERE, 'gb'), exist_ok=True)
    with open(os.path.join(HERE, 'gb/teselas.inc'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(gb) + '\n')
    t, a = fondo_nes()
    with open(os.path.join(HERE, 'nes/fondo.inc'), 'w', encoding='utf-8') as f:
        f.write('; Generated by contenido/consolas_demos/arte.py: nametable 0 (32 x 30 tiles) and its attribute table.\n')
        f.write('nametable_data:\n' + '\n'.join(filas_bytes(t, 32, '.byte')) + '\n')
        f.write('attribute_data:\n' + '\n'.join(filas_bytes(a, 8, '.byte')) + '\n')
    t, p = fondo_gb()
    with open(os.path.join(HERE, 'gb/fondo.inc'), 'w', encoding='utf-8') as f:
        f.write('; Generated by contenido/consolas_demos/arte.py: background map (32 x 32 tiles) and, for the CGB, the\n'
                '; palette number of every tile (VRAM bank 1 attributes).\n')
        f.write('BgMap:\n' + '\n'.join(filas_bytes(t, 32, 'db')) + '\nBgMapEnd:\n')
        f.write('BgAttr:\n' + '\n'.join(filas_bytes(p, 32, 'db')) + '\nBgAttrEnd:\n')
    print('arte: %d teselas, fondos de NES y Game Boy' % len(TESELAS))


if __name__ == '__main__':
    main()
