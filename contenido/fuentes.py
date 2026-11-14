"""Where the book's sources are (read only: the content pipeline never writes there).

One setting for the whole pipeline (generar.py, spice.py, repaso.py, ampliaciones.py, fm7303.py, proyectos_kicad*.py,
formulas_enriquecer.py, paratexto/): the environment variable EPA_FUENTES, the book's `Fuentes/` folder — the same
variable the book's own herramientas/construir.py reads. Default: the 4.1 book checked out at
/home/claude/libro-integra (1.2). Both layouts work:

  - the book's repository: <repo>/Fuentes (libro/, figuras/, img/, fonts/, plantilla/, herramientas/, paratexto/,
    tomos.json, tomos_titulos.json) next to <repo>/Complementos (spice/, kicad/, codigo/);
  - the old 3.0.2 working tree /home/claude/v3, where the complements are a folder `complementos` inside it.

    EPA_FUENTES=~/electronica-libro/Fuentes python3 contenido/generar.py
"""
import os

DEFECTO = '/home/claude/libro-integra/Fuentes'

FUENTES = os.path.abspath(os.path.expanduser(os.environ.get('EPA_FUENTES') or DEFECTO))
LIB = os.path.join(FUENTES, 'libro')
FIGURAS = os.path.join(FUENTES, 'figuras')
IMG = os.path.join(FUENTES, 'img')
FONTS = os.path.join(FUENTES, 'fonts')
PLANTILLA = os.path.join(FUENTES, 'plantilla')
HERRAMIENTAS = os.path.join(FUENTES, 'herramientas')
PARATEXTO = os.path.join(FUENTES, 'paratexto')
if os.path.isdir(os.path.join(FUENTES, 'complementos')):
    COMPLEMENTOS = os.path.join(FUENTES, 'complementos')       # /home/claude/v3 layout
else:
    COMPLEMENTOS = os.path.join(os.path.dirname(FUENTES), 'Complementos')
INFORMES = os.path.join(os.path.dirname(FUENTES), 'Informes')


def hay_libro():
    """True when the book's chapter sources are there (the pipeline then regenerates from them)."""
    return os.path.isdir(LIB)
