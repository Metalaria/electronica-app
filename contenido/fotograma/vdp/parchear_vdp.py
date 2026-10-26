"""Instrument BlastEm's VDP core (vdp.c, GPL-3) for the «Un fotograma» traces.

The pinned vdp.c is fetched by nucleos.py into contenido/.cache/fotograma/ and never copied into the repository.
This script writes vdp_traza.c next to it: the same VDP, plus calls to the hooks declared in vdp_ganchos.h:
  - every byte the VDP reads from its VRAM goes through VDP_RD() (address, value),
  - each slot ends with vdp_gancho_ranura() just before the cycle counter moves on,
  - the fetch functions tag the slot with what they are doing (name table, pattern, sprite…),
  - VRAM writes from the FIFO / DMA call vdp_gancho_escritura(),
  - each pair of pixels sent to the output line calls vdp_gancho_pixel(),
  - the «whole line at once» fast path is disabled, so every slot is visited,
  - mode 4 (Master System) gets the PAL V counter sequence, which BlastEm leaves as a TODO,
  - mode 4 sprites wrap around line 256 (BlastEm does not wrap them).
"""
import re
import sys


def patch(text):
    out = text
    out = out.replace('#include "vdp.h"', '#include "vdp.h"\n#include "vdp_ganchos.h"', 1)

    # 1. VRAM reads: context->vdpmem[EXPR] not followed by an assignment -> VDP_RD(context, EXPR)
    res, i, n_rd = [], 0, 0
    key = 'context->vdpmem['
    while True:
        j = out.find(key, i)
        if j < 0:
            res.append(out[i:])
            break
        k, depth = j + len(key), 1
        while depth:
            c = out[k]
            depth += (c == '[') - (c == ']')
            k += 1
        expr = out[j + len(key):k - 1]
        after = out[k:k + 4]
        prev = out[max(0, j - 2):j]
        is_store = re.match(r'\s*=[^=]', after) is not None
        is_addr = prev.endswith('&') or prev.endswith('&(')
        res.append(out[i:j])
        if is_store or is_addr:
            res.append(out[j:k])
        else:
            res.append('VDP_RD(context, %s)' % expr)
            n_rd += 1
        i = k
    out = ''.join(res)
    # the pattern fetch of mode 5 reads 32 bits through a pointer cast
    out, n_cast = re.subn(r'\*\(\(uint32_t \*\)\(&context->vdpmem\[address\]\)\)', 'VDP_RD32(context, address)', out)

    # render_border_garbage only models what the border shows from the serial bus: not a fetch of its own
    a = out.index('static void render_border_garbage(')
    b = out.index('\n}\n', a)
    out = out[:a] + re.sub(r'VDP_RD\(context, (.*?)\);', r'context->vdpmem[\1];', out[a:b]) + out[b:]

    # 2. end of every slot: before the cycle counter advances
    out, n_slot = re.subn(r'(\bcontext->cycles \+= )', r'vdp_gancho_ranura(context); \1', out)

    # 3. tags at the start of the fetch functions
    tags = {
        'read_map_scroll_a': 'VG_MAPA', 'read_map_scroll_b': 'VG_MAPA_B', 'read_map_mode4': 'VG_MAPA',
        'render_map_1': 'VG_PATRON', 'render_map_2': 'VG_PATRON', 'render_map_3': 'VG_PATRON_B',
        'render_map_output': 'VG_PATRON_B', 'fetch_map_mode4': 'VG_PATRON', 'render_map_mode4': 'VG_PATRON',
        'render_sprite_cells': 'VG_SPR_PATRON', 'fetch_sprite_cells_mode4': 'VG_SPR_PATRON',
        'render_sprite_cells_mode4': 'VG_SPR_PATRON',
        'scan_sprite_table': 'VG_SPR_TABLA', 'scan_sprite_table_mode4': 'VG_SPR_TABLA',
        'read_sprite_x': 'VG_SPR_X', 'read_sprite_x_mode4': 'VG_SPR_X',
        'external_slot': 'VG_EXTERNO',
    }
    n_tag = 0
    for fn, tag in tags.items():
        pat = re.compile(r'(static void %s\([^)]*\)\s*\{)' % fn)
        out, c = pat.subn(r'\1\n\tvdp_gancho_etiqueta(context, %s);' % tag, out)
        n_tag += c

    # 4. VRAM writes (FIFO, DMA fill / copy)
    for fn in ('write_vram_byte', 'write_vram_word'):
        pat = re.compile(r'(static void %s\(vdp_context \*context, uint32_t address, uint(8|16)_t value\)\s*\{)' % fn)
        out, c = pat.subn(r'\1\n\tvdp_gancho_escritura(context, address, value, %d);' % (1 if fn.endswith('byte') else 2), out)
        n_tag += c

    # 5. pixel output macros: report the slot after the two pixels are written
    n_px = 0
    for mac in ('OUTPUT_PIXEL', 'OUTPUT_PIXEL_H40', 'OUTPUT_PIXEL_H32', 'OUTPUT_PIXEL_MODE4'):
        pat = re.compile(r'#define %s\(slot\) if (.*?)\n\t}\n' % mac, re.S)
        m = pat.search(out)
        if not m:
            raise SystemExit('macro %s not found' % mac)
        body = m.group(0)
        new = body[:-3] + '\t} vdp_gancho_pixel(context, (slot));\n'
        out = out.replace(body, new, 1)
        n_px += 1

    # pixels written while the VDP is already in its inactive (border) mode: the tail of the last visible line
    old = '\t\tif (dst) {\n\t\t\tuint8_t bg_index;'
    n_px += out.count(old)
    out = out.replace(old, '\t\tif (dst) {\n\t\t\tvdp_gancho_pixel_x(context, (int)(dst - context->output));\n\t\t\tuint8_t bg_index;')

    # 6. no whole-line fast path
    out, n_fast = re.subn(r'while \(target_cycles - context->cycles >= MCLKS_LINE', 'while (0 && target_cycles - context->cycles >= MCLKS_LINE', out)

    # 7. PAL in mode 4 (BlastEm only knows the NTSC V counter of the Master System, «TODO: PAL support»): the
    #    192-line PAL frame counts $00-$F2 then $BA-$FF, 313 lines (Charles MacDonald, «msvdp.txt»)
    old = '''	} else {
		jump_start = 0xDB;
		jump_end = 0x1D5;
	}'''
    new = '''	} else if (context->flags2 & FLAG2_REGION_PAL) {
		jump_start = 0xF3;
		jump_end = 0x1BA;
	} else {
		jump_start = 0xDB;
		jump_end = 0x1D5;
	}'''
    n_pal = out.count(old)
    out = out.replace(old, new)

    # 8. line changes
    out, n_line = re.subn(r'(static void vdp_advance_line\(vdp_context \*context\)\s*\{)', r'\1\n\tvdp_gancho_linea(context);', out)

    # mode 4 sprites wrap around line 256: the VDP compares (line - Y) & $FF with the sprite height, so a sprite with
    # Y near $FF shows its lower part at the top of the picture (msvdp.txt; Genesis Plus GX does the same). BlastEm
    # compares without the wrap, and fetches the pattern row with the same difference.
    a = out.index('static void scan_sprite_table_mode4(')
    b = out.index('\n}\n', a)
    trozo, n_envuelta = re.subn(r'if \(y <= line && line < \(y \+ size\)\)', 'if (((line - y) & 0xFF) < size)', out[a:b])
    out = out[:a] + trozo + out[b:]
    a = out.index('static void read_sprite_x_mode4(')
    b = out.index('\n}\n', a)
    trozo, n_fila = re.subn(r'\(context->vcounter - context->sprite_info_list\[context->cur_slot\]\.y\)\* 4',
                            '((context->vcounter - context->sprite_info_list[context->cur_slot].y) & 0xFF) * 4', out[a:b])
    out = out[:a] + trozo + out[b:]

    stats = dict(pal=n_pal, lecturas=n_rd, cast=n_cast, ranuras=n_slot, etiquetas=n_tag, pixeles=n_px, rapido=n_fast, linea=n_line, envuelta=n_envuelta, fila=n_fila)
    if n_rd < 30 or n_cast != 1 or n_slot < 15 or n_tag != 19 or n_px != 5 or n_fast != 1 or n_line != 1 or n_pal != 1 or n_envuelta != 2 or n_fila != 1:
        raise SystemExit('vdp.c does not look like the pinned version: %r' % stats)
    return out, stats


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    text, stats = patch(open(src, encoding='utf-8').read())
    open(dst, 'w', encoding='utf-8').write(text)
    print('parchear_vdp:', stats)
