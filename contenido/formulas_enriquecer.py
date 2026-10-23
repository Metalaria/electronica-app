"""Adds to every built formula of formulas.py what makes the calculators visual and explanatory:

  familia      family id (gallery of the «Calculadoras» page), from formulas_visual.FAMILIAS / VISUAL
  figura       {"esquema": {"p": template, "s": {role: slot}}, "grafico": {"p": kind, "s": {…}}} (formulas_visual)
  explicacion  {"ref", "ref_num", "partes": [{"k": significa|aplica|valores|error, "html"}]} (formulas_texto):
               every «quoted» fragment must appear word for word in the book's section `ref` (as the quiz
               generator checks its quotes: Typst markup removed, spaces and case ignored, «[…]» for gaps)
  ejercicios   exercises and problems of the same chapter whose hints or solution use the formula
  simulador    netlists of the simulator that check that section (spice-refs.json), with their titles

Problems are appended to `problemas` (the generator then fails), like every other check of formulas.py.
"""
import json
import os
import re

import formulas_expr as X
import repaso as Q
from formulas_visual import FAMILIAS, ESQUEMAS, GRAFICOS, VISUAL

LIB = '/home/claude/v3/libro'
TIPOS_TEXTO = ('significa', 'aplica', 'valores', 'error')
HTML_PERMITIDO = {'sub', 'sup', 'em', 'strong', 'br'}


def _slots(fid, que, plantilla, slots, plantillas, ids, problemas):
    if plantilla not in plantillas:
        problemas.append(f'{fid}: {que} «{plantilla}» no existe')
        return None
    roles = plantillas[plantilla].split()
    out = {}
    for rol, valor in slots.items():
        if rol not in roles:
            problemas.append(f'{fid}: {que} «{plantilla}» no tiene el papel «{rol}» ({" ".join(roles)})')
            continue
        if not isinstance(valor, str) or not valor:
            problemas.append(f'{fid}: {que} «{plantilla}», papel «{rol}»: valor vacío')
            continue
        if not valor.startswith('#'):
            try:
                a = X.parse(valor)
            except X.ErrorExpresion as e:
                problemas.append(f'{fid}: {que} «{plantilla}», papel «{rol}»: {e}')
                continue
            sobran = X.variables(a) - set(ids)
            if sobran:
                problemas.append(f'{fid}: {que} «{plantilla}», papel «{rol}» usa {sorted(sobran)}, que no son variables')
                continue
        out[rol] = valor
    return out


def _figura(f, problemas):
    ids = [v['id'] for v in f['vars']]
    vis = VISUAL.get(f['id'])
    if vis is None:
        problemas.append(f'{f["id"]}: falta en formulas_visual.VISUAL (familia e ilustración)')
        return None, None
    fam = vis['fam']
    if fam not in {x[0] for x in FAMILIAS}:
        problemas.append(f'{f["id"]}: familia «{fam}» desconocida')
    figura = {}
    if 'esq' in vis:
        p, s = vis['esq']
        r = _slots(f['id'], 'el esquema', p, s, ESQUEMAS, ids, problemas)
        if r is not None:
            figura['esquema'] = {'p': p, 's': r}
    if 'graf' in vis:
        p, s = vis['graf']
        r = _slots(f['id'], 'el gráfico', p, s, GRAFICOS, ids, problemas)
        if r is not None:
            figura['grafico'] = {'p': p, 's': r}
    if 'grafico' not in figura:
        # every formula has at least the generic response plot (the result against one input)
        figura.setdefault('grafico', {'p': 'respuesta', 's': {}})
    return fam, figura


# ------------------------------------------------------------------ explanations from the book

class Citas:
    """Normalised text of the level-2 section of a label, per part (cached)."""

    def __init__(self, refs, indice):
        self.refs = refs
        self.indice = indice
        self.fuentes = {}
        self.tramos = {}

    def tramo(self, parte, label):
        clave = (parte, label)
        if clave not in self.tramos:
            if parte not in self.fuentes:
                ruta = os.path.join(LIB, parte + '.typ')
                self.fuentes[parte] = open(ruta, encoding='utf-8').read() if os.path.exists(ruta) else ''
            t = Q.tramo_de(self.fuentes[parte], label, self.indice['partes'].get(parte, {}))
            self.tramos[clave] = Q.normalizar_typst(t, self.refs) if t is not None else None
        return self.tramos[clave]


def _citas_de(html):
    return re.findall(r'«([^«»]+)»', html)


def _explicacion(f, texto, citas, problemas):
    fid = f['id']
    ref = texto.get('ref') or f['seccion']['label']
    r = citas.refs.get(ref)
    if r is None:
        problemas.append(f'{fid}: la explicación cita «{ref}», que no está en refs.json')
        return None
    parte = r['parte']
    tramo = citas.tramo(parte, ref)
    if tramo is None:
        problemas.append(f'{fid}: no se encuentra la sección de «{ref}» en {parte}.typ')
        return None
    partes = []
    for k in TIPOS_TEXTO:
        html = texto.get(k)
        if not html:
            continue
        if any(t.lower() not in HTML_PERMITIDO for t in re.findall(r'</?\s*([a-zA-Z0-9]+)[^>]*>', html)):
            problemas.append(f'{fid}: HTML no permitido en «{k}»')
        for c in _citas_de(html):
            if len(Q.normalizar(c)) < 12:
                problemas.append(f'{fid}: cita demasiado corta en «{k}»: «{c}»')
            elif not Q.cita_en(c, tramo):
                problemas.append(f'{fid}: la cita no está en la sección {r["num"]} ({ref}): «{c[:90]}»')
        partes.append({'k': k, 'html': html})
    if not partes:
        problemas.append(f'{fid}: explicación vacía')
        return None
    if not any(_citas_de(p['html']) for p in partes):
        problemas.append(f'{fid}: la explicación no cita el libro (ningún fragmento «…»)')
    otros = set(texto) - set(TIPOS_TEXTO) - {'ref'}
    if otros:
        problemas.append(f'{fid}: campos desconocidos en la explicación: {sorted(otros)}')
    return {'ref': ref, 'ref_num': r['num'], 'partes': partes}


# ------------------------------------------------------------------ exercises that use the formula

def _plano(html):
    t = re.sub(r'<sub>(.*?)</sub>', r'\1', html or '')
    t = re.sub(r'<[^>]+>', '', t)
    return re.sub(r'\s+', ' ', t)


def _simbolo(sim):
    return _plano(sim).replace(' ', '')


def _ejercicios(f, items):
    """Labels of exercises and problems of the formula's chapter whose hints show «result = …» with another
    of its variables, or that ask for the result with the hints naming two of its inputs."""
    res = next(v for v in f['vars'] if v['id'] == f['resultado'])
    s_res = _simbolo(res['sim'])
    otros = [_simbolo(v['sim']) for v in f['vars'] if v['id'] != f['resultado']]
    otros = [s for s in otros if s]
    out = []
    for lab, it in items:
        if it['parte'] != f['parte']:
            continue
        pistas = ' '.join(_plano(p) for p in it.get('pistas', [])).replace(' ', '')
        if not pistas:
            continue

        def tiene(s):
            return re.search(r'(?<!\w)' + re.escape(s) + r'(?!\w)', pistas) is not None
        usa = False
        if s_res and re.search(r'(?<!\w)' + re.escape(s_res) + r'=', pistas):
            usa = sum(1 for s in otros if tiene(s)) >= min(1, len(otros))
        if not usa and len(otros) >= 2:
            pide = any(r.get('unidad') == res['unidad'] for r in it.get('respuestas', []))
            usa = pide and tiene(s_res) and sum(1 for s in otros if tiene(s)) >= 2
        if usa:
            out.append(lab)
    return out[:4]


# ------------------------------------------------------------------ entry point

def _titulo_netlist(k, titulo):
    """A readable name for a netlist: its title, or «Figura 24.8» for the circuits of the figures."""
    if titulo:
        return titulo
    nombre = k.split('/')[-1]
    m = re.match(r'(fig|ej|prob|tab)-([\w.]+)$', nombre)
    if m:
        return {'fig': 'Figura', 'ej': 'Ejercicio', 'prob': 'Problema', 'tab': 'Tabla'}[m.group(1)] + ' ' + m.group(2)
    return nombre.replace('_', ' ')


def enriquecer(formulas, refs, indice, out_dir, problemas):
    """Adds familia, figura, explicacion, ejercicios and simulador; returns the families with their counts."""
    try:
        from formulas_texto import TEXTOS
    except ImportError:
        TEXTOS = {}
    citas = Citas(refs, indice)
    ruta_ej = os.path.join(out_dir, 'ejercicios.json')
    items = []
    if os.path.exists(ruta_ej):
        ej = json.load(open(ruta_ej, encoding='utf-8'))
        items = [(lab, it) for lab, it in ej['items'].items() if it.get('pistas')]
    ruta_spice = os.path.join(out_dir, 'spice-refs.json')
    spice = json.load(open(ruta_spice, encoding='utf-8')) if os.path.exists(ruta_spice) else {}
    ruta_titulos = os.path.join(out_dir, 'spice.json')
    titulos = {k: v.get('titulo', k) for k, v in json.load(open(ruta_titulos, encoding='utf-8')).get('netlists', {}).items()} \
        if os.path.exists(ruta_titulos) else {}

    ids = {f['id'] for f in formulas}
    for k in VISUAL:
        if k not in ids:
            problemas.append(f'formulas_visual.VISUAL describe «{k}», que no es una fórmula del catálogo')
    for k in TEXTOS:
        if k not in ids:
            problemas.append(f'formulas_texto.TEXTOS explica «{k}», que no es una fórmula del catálogo')

    cuenta = {x[0]: 0 for x in FAMILIAS}
    for f in formulas:
        fam, figura = _figura(f, problemas)
        if fam:
            f['familia'] = fam
            cuenta[fam] = cuenta.get(fam, 0) + 1
        if figura:
            f['figura'] = figura
        if f['id'] in TEXTOS:
            e = _explicacion(f, TEXTOS[f['id']], citas, problemas)
            if e:
                f['explicacion'] = e
        ej = _ejercicios(f, items)
        if ej:
            f['ejercicios'] = ej
        sim = []
        for lab in (f.get('sub'), f['seccion']['label']):
            for n in spice.get(lab or '', []):
                if n not in sim:
                    sim.append(n)
        if sim:
            f['simulador'] = [{'k': n, 't': _titulo_netlist(n, titulos.get(n, ''))} for n in sim[:3]]
    return [{'id': i, 'nombre': n, 'resumen': r, 'miniatura': {'tipo': m[0], 'p': m[1]}, 'total': cuenta.get(i, 0)}
            for i, n, r, m in FAMILIAS]
