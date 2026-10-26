"""Graphics ROMs of the Neo Geo demo, drawn as text: C1/C2 (16 × 16 sprite tiles) and S1 (8 × 8 fix tiles).

Formats (wiki.neogeodev.org «Sprite graphics format» / «Fix graphics format», as also written by ngdevkit's
tiletool): a sprite tile is four 8 × 8 blocks in the order top right, bottom right, top left, bottom left; each
row is 4 bit planes, planes 0 and 1 in C1 and planes 2 and 3 in C2, bit 0 = leftmost pixel. A fix tile is 32
bytes: columns 4-5, 6-7, 0-1, 2-3, each 8 bytes (one per row), low nibble = left pixel of the pair.
Usage: python3 graficos.py <output folder>   → c1.bin, c2.bin, s1.bin. Licence: CC0 1.0.
"""
import os
import sys

# one character per pixel: '.' = 0 (transparent), '1'-'9', 'a'-'f' = colour index
SPRITES = {
    0: ['.' * 16] * 16,
    # the ball: 32 × 32 made of two columns (sprites 1 and 2) of two tiles each
    1: ['............2222', '..........222111', '........22111111', '.......211111111', '......2111111111',
        '.....21111133311', '....211111333331', '....211113333311', '...2111111333111', '...2111111111111',
        '..21111111111111', '..21111111111111', '.211111111111111', '.211111111111111', '.211111111111111',
        '2111111111111111'],
    2: ['2111111111111111', '2111111111111111', '2111111111111111', '.211111111111111', '.211111111111111',
        '.211111111111111', '..21111111111111', '..21111111111111', '...2111111111111', '...2211111111111',
        '....221111111111', '.....22111111111', '......2221111111', '........22211111', '..........222222',
        '..............22'],
    3: ['2222............', '111222..........', '11111122........', '111111112.......', '1111111112......',
        '11111111112.....', '111111111112....', '111111111112....', '1111111111112...', '1111111111112...',
        '11111111111112..', '11111111111112..', '111111111111112.', '111111111111112.', '111111111111112.',
        '1111111111111112'],
    4: ['1111111111111112', '1111111111111112', '1111111111111112', '111111111111112.', '111111111111112.',
        '111111111111112.', '11111111111112..', '11111111111112..', '1111111111112...', '1111111111122...',
        '111111111122....', '11111111122.....', '1111111222......', '11111222........', '222222..........',
        '22..............'],
    # ground: grass on top of bricks (palette 2)
    5: ['5555555555555555', '5655565556555655', '6666666666666666', '7777777777777777', '8888888.88888888',
        '8888888.88888888', '8888888.88888888', '7777777777777777', '888.8888888.8888', '888.8888888.8888',
        '888.8888888.8888', '7777777777777777', '8888888.88888888', '8888888.88888888', '8888888.88888888',
        '7777777777777777'],
}

FUENTE = {   # 8 × 8 letters for the fix layer (colour 1 with a shadow in colour 2)
    ' ': ['........'] * 8,
    'N': ['11....1.', '111...12', '1121..12', '12.1..12', '12..1.12', '12...112', '12....12', '.2.....2'],
    'E': ['1111111.', '12222222', '12......', '111111..', '1222222.', '12......', '1111111.', '.2222222'],
    'O': ['.11111..', '1122211.', '12...12.', '12...12.', '12...12.', '12...12.', '.11111..', '..22222.'],
    'G': ['.11111..', '1122222.', '12......', '12.1111.', '12..212.', '12...12.', '.11111..', '..22222.'],
}
TEXTO_FUENTE = ' NEOG'


def pixeles(filas, ancho=16):
    assert len(filas) == ancho and all(len(f) == ancho for f in filas), filas
    return [int(c, 16) if c != '.' else 0 for f in filas for c in f]


def tile_c(p):
    c1, c2 = bytearray(), bytearray()
    for x0, y0 in ((8, 0), (8, 8), (0, 0), (0, 8)):
        for y in range(8):
            planos = [0, 0, 0, 0]
            for x in range(8):
                v = p[(y0 + y) * 16 + x0 + x]
                for b in range(4):
                    planos[b] |= ((v >> b) & 1) << x
            c1 += bytes((planos[0], planos[1]))
            c2 += bytes((planos[2], planos[3]))
    return c1, c2


def tile_s(p):
    out = bytearray()
    for xa in (4, 6, 0, 2):
        for y in range(8):
            out.append(p[y * 8 + xa] | p[y * 8 + xa + 1] << 4)
    return out


def main(dest):
    os.makedirs(dest, exist_ok=True)
    c1, c2 = bytearray(), bytearray()
    for n in range(max(SPRITES) + 1):
        a, b = tile_c(pixeles(SPRITES[n]))
        c1 += a
        c2 += b
    s = bytearray()
    for ch in TEXTO_FUENTE:
        s += tile_s(pixeles(FUENTE[ch], 8))
    open(os.path.join(dest, 'c1.bin'), 'wb').write(c1)
    open(os.path.join(dest, 'c2.bin'), 'wb').write(c2)
    open(os.path.join(dest, 's1.bin'), 'wb').write(s)
    print('graficos: %d patrones de sprite, %d de la capa fija' % (len(c1) // 64, len(s) // 32))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
