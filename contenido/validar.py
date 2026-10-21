"""Checks of the generated content and the summary printed at the end of generar.py."""
import json
import os
import re
from collections import Counter, defaultdict


def walk_blocks(bloques, cnt, refs_used, assets):
    for b in bloques:
        t = b['t']
        cnt[t] += 1
        if t == 'caja':
            cnt['caja ' + b['tipo']] += 1
        if t == 'ec':
            assets.append(b['svg'])
            if not b.get('w'):
                cnt['ec sin tamaño'] += 1
        if t == 'figura':
            assets.append(b['src'])
        if t == 'ejercicios':
            cnt['ejercicio'] += len(b['items'])
            cnt['solucion'] += sum(1 for it in b['items'] if it['solucion'] is not None)
            for it in b['items']:
                walk_blocks(it['bloques'], cnt, refs_used, assets)
                walk_blocks(it['solucion'] or [], cnt, refs_used, assets)
        if t == 'glosario':
            cnt['entrada de glosario'] += len(b['entradas'])
            for e in b['entradas']:
                refs_used.extend(e['ver'])
        walk_blocks(b.get('bloques', []), cnt, refs_used, assets)


def scan_html(bloques, cnt, refs_used, assets):
    """References and inline equations in every html string of a part."""
    s = json.dumps(bloques, ensure_ascii=False)
    refs_used.extend(re.findall(r'data-ref=\\"([^"\\]+)\\"', s))
    assets.extend(re.findall(r'<img class=\\"m\\" src=\\"([^"\\]+)\\"', s))
    cnt['ec en línea'] += len(re.findall(r'<img class=\\"m\\"', s))


def source_counts(lib, files):
    """Independent counts straight from the sources, to compare with what was generated."""
    text = ''.join(open(os.path.join(lib, f), encoding='utf-8').read() for f in files)
    no_raw = re.sub(r'```.*?```', '', text, flags=re.S)
    c = {k: len(re.findall(p, no_raw)) for k, p in {
        'figura': r'#figura\(', 'tabla': r'#tabla\(', 'ejercicio': r'#ejercicio\[', 'solucion': r'#solucion\(',
        'codigo': r'#codigo\[', 'deduccion': r'#deduccion\[', 'tarjeta': r'#tarjeta\[', 'centrado': r'#centrado\[',
        'caja nota': r'#nota\[', 'caja importante': r'#importante\[', 'caja precaucion': r'#precaucion\[',
        'caja ejemplo': r'#ejemplo\[', 'caja comprobacion': r'#comprobacion\[',
        '#ec': r'#ec\[', '#formula': r'#formula\(', '#formula-texto': r'#formula-texto\[',
    }.items()}
    c['ec'] = c['#ec'] + c['#formula'] + c['#formula-texto']
    # math: every unescaped dollar pair, skipping strings inside the math; inline = not opened by #ec[ / #formula(
    inline = 0
    i = 0
    while True:
        m = re.compile(r'(?<!\\)\$').search(no_raw, i)
        if not m:
            break
        j = m.end()
        while no_raw[j] != '$' or no_raw[j - 1] == '\\':
            if no_raw[j] == '"':
                j = no_raw.index('"', j + 1)
            j += 1
        if not no_raw[:m.start()].endswith(('#ec[', '#formula(')):
            inline += 1
        i = j + 1
    c['ec en línea'] = inline
    return c


def dir_size(path):
    total, n = 0, 0
    for root, _, files in os.walk(path):
        for f in files:
            total += os.path.getsize(os.path.join(root, f))
            n += 1
    return total, n


def mb(b):
    return f'{b / 1e6:.1f} MB'


def run(out, lib, files, indice, refs, libro, nums, ec_stats, fig_stats, busqueda, glosario, elapsed):
    errors = []
    cnt = Counter()
    refs_used, assets = [], []
    for stem in [p for t in indice['tomos'] for p in t['partes']]:
        path = os.path.join(out, 'partes', stem + '.json')
        if not os.path.exists(path):
            errors.append(f'falta partes/{stem}.json')
            continue
        part = json.load(open(path, encoding='utf-8'))
        walk_blocks(part['bloques'], cnt, refs_used, assets)
        scan_html(part['bloques'], cnt, refs_used, assets)
    if set(indice['partes']) != {p for t in indice['tomos'] for p in t['partes']}:
        errors.append('indice.partes no coincide con las partes de los tomos')

    missing_refs = sorted({k for k in refs_used if k not in refs})
    if missing_refs:
        errors.append(f'{len(missing_refs)} claves citadas sin entrada en refs.json: {missing_refs[:10]}')
    missing_assets = sorted({a for a in assets if not os.path.exists(os.path.join(out, a))})
    if missing_assets:
        errors.append(f'{len(missing_assets)} ficheros referidos que no existen: {missing_assets[:10]}')
    if cnt['ec sin tamaño']:
        errors.append(f'{cnt["ec sin tamaño"]} ecuaciones sin tamaño')

    # numbering cross-check with herramientas/construir.py
    diff = [(k, v, refs.get(k, {}).get('num')) for k, v in nums.items() if refs.get(k, {}).get('num') != v]
    if diff:
        errors.append(f'{len(diff)} números distintos de construir.numbering(): {diff[:8]}')

    # counts against the sources
    src = source_counts(lib, files)
    rows = [('figura', 'figura'), ('ec (#ec + #formula + #formula-texto)', 'ec'), ('ec en línea', 'ec en línea'),
            ('tabla', 'tabla'), ('ejercicio', 'ejercicio'), ('solucion', 'solucion'), ('codigo', 'codigo'),
            ('deduccion', 'deduccion'), ('tarjeta', 'tarjeta'), ('centrado', 'centrado'),
            ('caja nota', 'caja nota'), ('caja importante', 'caja importante'),
            ('caja precaucion', 'caja precaucion'), ('caja ejemplo', 'caja ejemplo'),
            ('caja comprobacion', 'caja comprobacion')]
    print('\n== Recuento: fuentes / generado')
    for name, key in rows:
        gen = cnt[key]
        mark = '' if gen == src[key] else '   <-- DIFERENTE'
        if mark:
            errors.append(f'recuento distinto en {name}: fuentes {src[key]}, generado {gen}')
        print(f'  {name:42s} {src[key]:6d} {gen:6d}{mark}')
    print(f'  {"(ec: #ec / #formula / #formula-texto)":42s} {src["#ec"]} / {src["#formula"]} / {src["#formula-texto"]}')
    other = {k: v for k, v in cnt.items() if k in ('p', 'h2', 'h3', 'h4', 'lista', 'caja', 'glosario',
                                                    'entrada de glosario', 'ejercicios')}
    print('  otros bloques: ' + ', '.join(f'{k} {v}' for k, v in sorted(other.items())))
    tipos = Counter(r['tipo'] for r in refs.values())
    print(f'  refs.json: {len(refs)} claves (' + ', '.join(f'{k} {v}' for k, v in sorted(tipos.items())) + ')')
    print(f'  busqueda.json: {len(busqueda)} documentos; glosario.json: {len(glosario)} términos')
    print(f'  ecuaciones: {ec_stats}')
    print(f'  figuras: {fig_stats}')

    # sizes
    print('\n== Tamaño de web/public/libro')
    total = 0
    for sub in ('partes', 'ec', 'fig', 'img'):
        s, n = dir_size(os.path.join(out, sub))
        total += s
        print(f'  {sub + "/":8s} {n:5d} ficheros  {mb(s)}')
    for f in ('indice.json', 'refs.json', 'glosario.json', 'busqueda.json'):
        s = os.path.getsize(os.path.join(out, f))
        total += s
        print(f'  {f:16s} {mb(s)}')
    print(f'  total    {mb(total)}')

    # what could not be converted
    print('\n== Construcciones no convertidas o dudosas')
    by_msg = defaultdict(list)
    for parte, line, msg, sample in libro.problems:
        key = re.sub(r'<[^>]*>|\d+(\.\d+)*', '…', msg) if 'sin destino' not in msg else 'referencia sin destino'
        by_msg[key].append((parte, line, msg, sample))
    if not by_msg:
        print('  ninguna')
    for key, items in sorted(by_msg.items(), key=lambda kv: -len(kv[1])):
        print(f'  {len(items):4d} × {key}')
        for parte, line, msg, sample in items[:3]:
            print(f'         {parte}:{line} {msg}' + (f' — «{sample}»' if sample else ''))
    if libro.ignored:
        print('  omitidas a propósito: ' + ', '.join(f'{k} ×{v}' for k, v in sorted(libro.ignored.items())))

    print('\n== Validación')
    for e in errors:
        print('  ERROR: ' + e)
    if not errors:
        print('  correcta: referencias, ficheros, partes, recuentos y numeración')
    print(f'\n{len(libro.problems)} avisos de conversión, {len(errors)} errores, {elapsed:.1f} s')
    return not errors


def check_figures(figs, out):
    """Optional visual check: each SVG rendered by Chromium and compared with the PDF rendered by poppler."""
    import figuras
    items = [(rel, src) for rel, src in figs.wanted.items() if rel.endswith('.svg')]
    res = figuras.compare_all(items, out)
    vals = sorted((d, r) for r, d in res.items() if not isinstance(d, str))
    # anti-aliasing alone gives a few units; a broken conversion (missing layer, black mask) gives far more
    limit = max(25.0, 3 * vals[len(vals) // 2][0]) if vals else 25.0
    bad = [(r, d) for r, d in res.items() if isinstance(d, str) or d > limit]
    print(f'\n== Comprobación visual de {len(res)} figuras SVG (Chromium frente a pdftoppm, diferencia media 0-255)')
    if vals:
        print(f'  mediana {vals[len(vals) // 2][0]:.2f}; peores: ' + ', '.join(f'{r} {d:.2f}' for d, r in vals[-5:]))
    for r, d in bad:
        print(f'  REVISAR {r}: {d}')
    if not bad:
        print(f'  ninguna por encima del límite ({limit:.1f})')
