"""Compact vector geometry of a KiCad 7 schematic SVG (kicad-cli sch export svg).

The SVG that KiCad plots is the reference picture of the sheet (stroke font, symbol graphics, frame). This
module reduces it to a few drawing layers, one per (colour role, stroke width, fill, text), with the strokes
chained into polylines and coded as zigzag varints of 0.01 mm deltas: about a tenth of the SVG size, and the
app can theme the roles (light/dark) and skip the text strokes when they would be smaller than a pixel.

Binary format (little endian), «CSG1»:
  'CSG1' u16 n_layers, u16 reserved, f32 width_mm, f32 height_mm
  per layer: u8 role, u8 flags (1 fill, 2 text), u16 reserved, f32 stroke width (mm),
             u32 n_polylines, u32 n_circles, u32 n_bytes, then n_bytes of varints:
             polylines: n_points, x0, y0 (delta from the previous polyline start), dx, dy … (delta from the
             previous point); then circles: cx, cy (delta from the previous centre), r. Units 0.01 mm.
"""

import math
import re
import struct
import xml.etree.ElementTree as ET

ROLES = {
    '840000': 1,   # symbol bodies, pins, sheet frame, global label shapes
    'FFFFC2': 2,   # symbol body fill
    '009600': 3,   # wires and junctions
    '000084': 4,   # buses and bus entries
    '0F0F0F': 5,   # labels and general text
    '006464': 6,   # reference / value fields and pin names
    'A90000': 7,   # pin numbers
    '840084': 8,   # hierarchical sheet boxes
    '0000C2': 9,   # notes
    '000000': 10,  # no-connect flags and other black items
}
ROLE_NAMES = {1: 'simbolo', 2: 'relleno', 3: 'hilo', 4: 'bus', 5: 'etiqueta', 6: 'campo', 7: 'numero',
              8: 'hoja', 9: 'nota', 10: 'negro', 11: 'otro'}

NUM = re.compile(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')


def _style(s):
    d = {}
    for part in s.split(';'):
        if ':' in part:
            k, v = part.split(':', 1)
            d[k.strip()] = v.strip()
    return d


def _arc_points(x1, y1, rx, ry, phi, large, sweep, x2, y2):
    """SVG elliptical arc (KiCad only plots circular ones) -> points after the start point."""
    if rx == 0 or ry == 0:
        return [(x2, y2)]
    phi = math.radians(phi)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p = cp * dx + sp * dy
    y1p = -sp * dx + cp * dy
    lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if lam > 1:
        s = math.sqrt(lam)
        rx, ry = rx * s, ry * s
    num_ = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    co = math.sqrt(max(0.0, num_ / den)) if den else 0.0
    if large == sweep:
        co = -co
    cxp = co * rx * y1p / ry
    cyp = -co * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x1 + x2) / 2
    cy = sp * cxp + cp * cyp + (y1 + y2) / 2

    def ang(ux, uy, vx, vy):
        a = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a

    t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    n = max(4, int(abs(dt) / (math.pi / 16)) + 1)
    pts = []
    for i in range(1, n + 1):
        t = t1 + dt * i / n
        x = cx + rx * math.cos(t) * cp - ry * math.sin(t) * sp
        y = cy + rx * math.cos(t) * sp + ry * math.sin(t) * cp
        pts.append((x, y))
    pts[-1] = (x2, y2)
    return pts


def _path_polylines(d):
    """Path data -> list of (points, closed)."""
    out = []
    cur = []
    toks = re.findall(r'[MLAZmlaz]|' + NUM.pattern, d)
    i = 0
    cmd = None
    last = (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if t in 'MLAZmlaz':
            cmd = t.upper()
            i += 1
            if cmd == 'Z':
                if cur:
                    out.append((cur, True))
                    cur = []
                continue
        if cmd == 'M':
            if cur:
                out.append((cur, False))
            last = (float(toks[i]), float(toks[i + 1]))
            cur = [last]
            i += 2
            cmd = 'L'
        elif cmd == 'L':
            last = (float(toks[i]), float(toks[i + 1]))
            cur.append(last)
            i += 2
        elif cmd == 'A':
            rx, ry, phi, la, sw, x, y = [float(v) for v in toks[i:i + 7]]
            cur += _arc_points(last[0], last[1], rx, ry, phi, int(la), int(sw), x, y)
            last = (x, y)
            i += 7
        else:
            i += 1
    if cur:
        out.append((cur, False))
    return out


class Layer:
    def __init__(self, role, flags, width):
        self.role, self.flags, self.width = role, flags, width
        self.polys = []     # list of point lists (ints, 0.01 mm)
        self.circles = []   # (cx, cy, r) ints


def _q(v):
    return int(round(v * 100))


def extract(svg_file):
    """Layers of an SVG plotted by KiCad. Returns (width_mm, height_mm, layers)."""
    tree = ET.parse(svg_file)
    root = tree.getroot()
    ns = '{http://www.w3.org/2000/svg}'
    vb = [float(v) for v in root.get('viewBox').split()]
    layers = {}

    def layer(role, flags, width):
        k = (role, flags, round(width, 4))
        if k not in layers:
            layers[k] = Layer(role, flags, width)
        return layers[k]

    def walk(g, style, in_text):
        st = dict(style)
        if g.get('style'):
            st.update(_style(g.get('style')))
        text = in_text or g.get('class') == 'stroked-text'
        fill_col = st.get('fill', '#000000').lstrip('#').upper()
        stroke_col = st.get('stroke', '#000000').lstrip('#').upper()
        filled = float(st.get('fill-opacity', '1') or 1) > 0.5
        width = float(st.get('stroke-width', '0') or 0)
        for el in g:
            tag = el.tag.replace(ns, '')
            if tag == 'g':
                walk(el, st, text)
                continue
            if tag in ('text', 'desc', 'title'):
                continue
            col = fill_col if filled else stroke_col
            if col == 'F5F4EF':
                continue  # page background
            role = ROLES.get(col, 11)
            flags = (1 if filled else 0) | (2 if text else 0)
            if tag == 'path':
                lay = layer(role, flags, 0 if filled else width)
                for pts, closed in _path_polylines(el.get('d', '')):
                    q = [(_q(x), _q(y)) for x, y in pts]
                    if closed and q[0] != q[-1]:
                        q.append(q[0])
                    if len(q) >= 2:
                        lay.polys.append(q)
            elif tag == 'circle':
                lay = layer(role, flags, 0 if filled else width)
                lay.circles.append((_q(float(el.get('cx'))), _q(float(el.get('cy'))), _q(float(el.get('r')))))
            elif tag == 'rect':
                x, y = float(el.get('x')), float(el.get('y'))
                w, h = float(el.get('width')), float(el.get('height'))
                lay = layer(role, flags, 0 if filled else width)
                q = [(_q(x), _q(y)), (_q(x + w), _q(y)), (_q(x + w), _q(y + h)), (_q(x), _q(y + h)), (_q(x), _q(y))]
                lay.polys.append(q)

    walk(root, {}, False)
    out = []
    for lay in layers.values():
        lay.polys = _chain(lay.polys) if not (lay.flags & 1) else _dedupe(lay.polys)
        lay.circles = sorted(set(lay.circles))
        if lay.polys or lay.circles:
            out.append(lay)
    out.sort(key=lambda l: (0 if l.flags & 1 else 1, l.role, l.flags, l.width))
    return vb[2], vb[3], out


def _dedupe(polys):
    seen = set()
    out = []
    for p in polys:
        k = tuple(p)
        if k in seen:
            continue
        seen.add(k)
        out.append(p)
    return out


def _chain(polys):
    """Joins consecutive strokes that continue each other and drops exact duplicates (KiCad plots some
    graphics twice, e.g. a symbol body outline and its filled background)."""
    polys = _dedupe(polys)
    out = []
    for p in polys:
        if out and out[-1][-1] == p[0]:
            out[-1].extend(p[1:])
        elif out and len(p) == 2 and out[-1][-1] == p[1]:
            out[-1].append(p[0])
        else:
            out.append(list(p))
    return out


def _zz(v):
    return (v << 1) ^ (v >> 63)


def _varint(buf, v):
    v = _zz(v)
    while True:
        b = v & 0x7F
        v >>= 7
        if v:
            buf.append(b | 0x80)
        else:
            buf.append(b)
            return


def encode(width, height, layers):
    out = bytearray(b'CSG1')
    out += struct.pack('<HHff', len(layers), 0, width, height)
    for lay in layers:
        buf = bytearray()
        px = py = 0
        for p in lay.polys:
            _varint(buf, len(p))
            _varint(buf, p[0][0] - px)
            _varint(buf, p[0][1] - py)
            px, py = p[0]
            lx, ly = p[0]
            for x, y in p[1:]:
                _varint(buf, x - lx)
                _varint(buf, y - ly)
                lx, ly = x, y
        cx0 = cy0 = 0
        for cx, cy, r in lay.circles:
            _varint(buf, cx - cx0)
            _varint(buf, cy - cy0)
            _varint(buf, r)
            cx0, cy0 = cx, cy
        out += struct.pack('<BBHfIII', lay.role, lay.flags, 0, lay.width, len(lay.polys), len(lay.circles), len(buf))
        out += buf
    return bytes(out)


def wire_segments(layers):
    """Every straight segment of the wire layers (for the alignment check with the .kicad_sch)."""
    segs = set()
    for lay in layers:
        if lay.role == 3 and not (lay.flags & 3):
            for p in lay.polys:
                for a, b in zip(p, p[1:]):
                    segs.add((a, b) if a <= b else (b, a))
    return segs
