"""Writes REVISAR.md: what is generated and what is drafted, the rules and assumptions, and per chapter
the drafted texts (objectives, summary, degree mapping, readings) for a quick review by the author."""
import collections
import json
import os
import re

from comun import AQUI, DATOS, partes_del_libro

COMP = json.load(open(os.path.join(DATOS, 'competencias.json'), encoding='utf-8'))
F = COMP['fuente']


def main():
    partes = partes_del_libro()
    d = {p: json.load(open(os.path.join(DATOS, f'{p}.json'), encoding='utf-8')) for p, _, _ in partes}
    niv = collections.Counter(e['nivel'] for x in d.values() for e in x['dificultad'])
    nuevos = sum(1 for x in d.values() for e in x['dificultad'] if not e['en_libro'])
    preg = sum(len(x['autoevaluacion']) for x in d.values())
    form = sum(len(x['formulas']) for x in d.values())
    sin_form = [x['num'] for x in d.values() if not x['formulas']]
    nor = sum(len(x['normas']) for x in d.values())
    con_resumen = []
    for x in d.values():
        for s in x['secciones']:
            if re.search(r'resumen', s['titulo'], re.I):
                con_resumen.append(f"{x['num']} ({s['num'] or s['label']} «{s['titulo']}»)")
    huecos = json.load(open(os.path.join(AQUI, 'huecos.json'), encoding='utf-8'))
    cob = collections.Counter(c['cobertura'] for c in huecos['competencias'])

    L = []
    L += ['# Paratexto universitario — para revisar', '',
          'Aparato de libro de texto de grado para «Electrónica Práctica Avanzada»: objetivos, términos clave, '
          'correspondencia con el grado, resumen, fórmulas, autoevaluación, normas y lecturas, marcas de '
          'dificultad e índice alfabético por tomo. Todo se genera con scripts deterministas a partir de los datos '
          'convertidos del libro (`web/public/libro/`, solo lectura) y de los textos redactados en `redaccion/`.', '',
          '## Qué es generado y qué es redactado', '',
          '| Pieza | Origen | Dónde |', '|---|---|---|',
          '| Índice alfabético por tomo | Generado: términos del glosario + títulos de sección | `datos/indice-tomo<N>.json`, `tomo<N>.typ` (`indice`) |',
          '| Términos clave | Generado: glosario | `datos/<parte>.json` → `terminos_clave`; `<parte>.typ` (`terminos`) |',
          '| Autoevaluación y soluciones | Generado: `repaso/<parte>.json` de la app | `autoevaluacion`; `<parte>.typ` (`autoev`), `tomo<N>.typ` (`soluciones`) |',
          '| Marcas de dificultad | Generado: clasificación de `ejercicios.json` | `dificultad`; `<parte>.typ` (`niveles`) |',
          '| Fórmulas del capítulo | Generado: `formulas.json` (fórmulas de las tarjetas y del texto) | `formulas`; `<parte>.typ` (`formulas`) |',
          '| Normas y documentos citados | Generado: extraído del texto del capítulo | `normas`; `<parte>.typ` (`normas`) |',
          '| Objetivos de aprendizaje | **Redactado** | `redaccion/tomo<N>.yaml`; `datos/<parte>.json` → `redactado` |',
          '| Resumen del capítulo | **Redactado** (caps. 0-6 a partir de las tarjetas de resumen de las lecciones 1.1) | ídem |',
          '| Correspondencia con el grado | **Redactado** (asignación de materias y competencias) | ídem; `grado.typ` |',
          '| Lecturas recomendadas | **Redactado**: obras del apéndice G y sugerencias marcadas | `redaccion/lecturas.yaml` |',
          '| Análisis de huecos | **Redactado** sobre evidencia del texto | `HUECOS.md`, `huecos.json`, `redaccion/huecos.yaml` |', '',
          '## Supuestos', '',
          '- **Grado de referencia**: Grado en Ingeniería Electrónica Industrial y Automática (el que habilita para la '
          'especialidad de electrónica industrial de la profesión de ingeniero técnico industrial). Es una elección '
          'nuestra: el libro no sigue el plan de ninguna universidad.',
          f'- **Competencias**: {F["norma"]}. {F["boe"]} ({F["id"]}), {F["apartado"]}: <{F["url"]}>. '
          'El texto de cada competencia está copiado literalmente (`datos/competencias.json`); se ha leído en la '
          'reproducción íntegra del BOE de <https://masteringenieriaindustrial.uca.es/boe-a-2009-2893> y el '
          'agrupamiento en filas se ha contrastado con la tabla de competencias del grado de la Universidad de La Laguna '
          '(<https://www.ull.es/grados/ingenieria-electronica-industrial-automatica/plan-de-estudios/competencias/>). '
          'Conviene cotejarlo una vez con el PDF del BOE.',
          f'- **Códigos**: {F["nota_codigos"]}',
          '- **Créditos**: solo los de la orden por módulo (formación básica 60, común a la rama industrial 60, tecnología '
          'específica 48, trabajo fin de grado 12). No se dan créditos por asignatura: varían entre universidades y no '
          'hemos encontrado una fuente única que dé un intervalo típico.',
          '- **Materias**: las familias de asignaturas habituales del grado (Teoría de Circuitos, Electrónica Analógica, '
          'Electrónica Digital, Electrónica de Potencia, Instrumentación Electrónica, Sistemas Electrónicos Digitales y '
          'Microprocesadores, Regulación Automática, Informática Industrial, Comunicaciones…); son nombres genéricos, no '
          'los de un plan concreto.',
          f'- **Cobertura**: de 17 competencias en el alcance, {cob["completa"]} completas, {cob["parcial"]} parciales y '
          f'{cob["ninguna"]} sin cobertura (detalle y propuestas en `HUECOS.md`).', '',
          '## Reglas de lo generado', '',
          '- **Términos clave**: las entradas del glosario cuyo «ver» apunta a una sección del capítulo (las que el propio '
          'glosario sitúa allí). Si son menos de 24, se completan con los términos del glosario que más aparecen en el '
          'texto del capítulo (al menos 3 veces); si son más, se quedan las 24 más usadas. Cada término lleva la '
          'sección donde se define.',
          '- **Búsqueda de términos**: el término sin su paréntesis, sin distinguir mayúsculas y con plural en -s/-es; '
          'las siglas entre paréntesis («Descarga electrostática (ESD)» → ESD) y los nombres en inglés de varias palabras '
          'también, las siglas respetando mayúsculas. Gana la coincidencia más larga.',
          '- **Índice alfabético**: por tomo, con los términos del glosario que aparecen en el tomo y los títulos de sección '
          'y de apartado numerado (sin «Resumen», «Problemas de diseño», «Ejercicios»). Localizadores: en seminegrita '
          'las secciones del «ver» del glosario; además, hasta completar cuatro, las secciones donde el término aparece '
          'más veces. La página se calcula al compilar con la etiqueta de la sección (`sec-1.2`) o del apartado numerado '
          '(`sec-1.2.3`), así que el índice remite al comienzo de la sección, no a la línea exacta. Para afinar, la '
          'plantilla podría poner una etiqueta en la primera aparición marcada de cada término (ya la detecta para el '
          'glosario al margen).',
          '- **Autoevaluación**: las preguntas de repaso de la app (`repaso/<parte>.json`), en su orden y con sus cuatro '
          f'opciones en el orden de la app (la correcta ya está repartida entre a, b, c y d; {preg} preguntas en total). Las '
          'soluciones van al final del tomo con la explicación de la app y la sección donde se trata la idea; en '
          'pantalla, número de pregunta y solución se enlazan en los dos sentidos.',
          '- **Dificultad (1-3 puntos)**, de la clasificación de `ejercicios.json`: «apartados» = respuestas numéricas + '
          'preguntas extra + partes autoevaluadas («otras»). **3**: problema de diseño (`tipo: prob`, de las secciones '
          '«Problemas de diseño»), o con un apartado de diseño (`clase` u `otras` = diseno), o con 4 o más apartados. '
          '**2**: de razonamiento (`clase` u `otras` = razonamiento) o con 2-3 apartados. **1**: el resto (un resultado, '
          f'una elección o una respuesta breve). Reparto: {niv[1]} de nivel 1, {niv[2]} de nivel 2 y {niv[3]} de nivel 3 '
          f'({sum(niv.values())} ejercicios; {nuevos} son los nuevos de los caps. 21, 24 y 34 que aún no están en el '
          'libro). Cada ejercicio lleva en su JSON los motivos de su nivel.',
          f'- **Fórmulas del capítulo**: las {form} entradas de `formulas.json` (sin duplicados por fuente), por sección; '
          'un punto marca las que recoge la tarjeta de fórmulas del capítulo. Sin fórmulas (no se imprime la página): '
          f'{", ".join(sin_form)}.',
          f'- **Normas y referencias**: identificadores literales del texto ({nor} citas): normas IEC/EN/UNE/ISO/IEEE/IPC/'
          'ANSI/ASME/EIA/JEDEC/NEMA/MIL, RS-232/485, legislación (RoHS, REACH, RAEE, marcado CE, Directiva (UE)…) y '
          'documentos nombrados («manual del…», «hoja de datos del…»), cada uno con su frase de contexto y su sección. '
          'Nada se añade que no esté en el texto; los capítulos sin citas lo dicen. Las **lecturas** son las obras '
          'del apéndice G (marca sólida) y sugerencias para esta edición (marca hueca): todas existen; las ediciones y '
          'años son un añadido nuestro para las del apéndice G, que no los da. Conviene comprobarlos.', '',
          '## Cómo se usa en el libro', '',
          '- Cada capítulo tiene `paratexto/<parte>.typ` (nombre del fichero de la app: `cap15.typ` es el capítulo 14). '
          'Uso: `#import "paratexto/cap01.typ" as p01`; `#p01.inicio` justo después de `#capitulo(...)` y **antes** del '
          'texto del capítulo; `#p01.cierre` antes de `#ejercicios` (o sus piezas: `p01.resumen`, `p01.normas`, '
          '`p01.formulas`, `p01.autoev`). Las marcas de dificultad: `#nivel-de(p01.niveles, "ej-1.1")` al principio '
          'de cada ejercicio (mejor: que la plantilla las dibuje junto a la insignia del número leyendo `niveles`), y '
          '`#leyenda-niveles()` al comienzo de los ejercicios.',
          '- Al final del tomo: `#import "paratexto/tomoI.typ" as t` y `#t.soluciones`, `#t.indice`. En los preliminares: '
          '`#import "paratexto/grado.typ": correspondencia` y `#correspondencia`.',
          '- `paratexto.typ` importa `../plantilla/plantilla.typ` y usa su paleta, etiquetas, insignias y la página ancha. '
          'No usa detalles internos de la plantilla: `#sin-glosario[…]` (para que los objetivos y los términos clave no '
          'le quiten a la primera aparición real de un término su marca de glosario al margen), `parte-sin-apertura` '
          '(cabeceras «Tomo I» en las páginas finales) y los argumentos `rotulo:`, `columnas:` y `separacion:` de '
          '`pagina-ancha` son funciones públicas de la plantilla.',
          '- **Resúmenes duplicados**: estos capítulos ya tienen una sección de resumen propia: ' + '; '.join(con_resumen)
          + '. El resumen redactado no la sustituye: hay que decidir si se mantienen los dos (por ejemplo, el nuevo con '
          'otro título, «En síntesis») o si se fusionan.',
          '- Regenerar (desde `paratexto/scripts/`): `python3 generar.py`, `python3 lecciones.py`, '
          '`python3 validar_redaccion.py`, `python3 generar_typ.py`, `python3 generar_muestra.py`, '
          '`python3 generar_revisar.py`; compilar la muestra con `python3 compilar.py` (variantes: '
          '`python3 compilar.py muestra-paratexto.typ imprenta-intenso pantalla-medio`) y comprobar que compila cada '
          'fragmento con `python3 compilar.py todo`. Usa el paquete `typst` de pip y las fuentes de `plantilla/fuentes`.', '',
          '## Textos redactados, capítulo a capítulo', '',
          'Objetivos (O), resumen (R), materias y competencias del grado (G) y lecturas (L; [G] = apéndice G, [S] = '
          'sugerencia). Se corrigen en `redaccion/tomo<N>.yaml` y se regenera.', '']
    tomo = None
    for p, info, t in partes:
        x = d[p]
        r = x['redactado']
        if t != tomo:
            tomo = t
            L += [f'### Tomo {t}', '']
        etq = ('Cap.' if x['tipo'] == 'capitulo' else 'Ap.') + f" {x['num']}"
        L.append(f"**{etq} — {x['titulo']}** (`{p}`)  ")
        L += [f'O{i + 1}. {o}  ' for i, o in enumerate(r['objetivos'])]
        L.append(f"R ({len(r['resumen'].split())} palabras). {r['resumen']}  ")
        L.append('G. ' + ' · '.join(r['grado']['materias']) + ' — ' +
                 ', '.join(c['codigo'] for c in r['grado']['competencias']) + '  ')
        if r['lecturas']:
            L.append('L. ' + ' '.join(('[G] ' if l['origen'] == 'G' else '[S] ') + l['referencia'] for l in r['lecturas']) + '  ')
        if x['normas']:
            L.append('Normas extraídas: ' + '; '.join(f"{n['cita']} ({', '.join(n['refs_num'])})" for n in x['normas']) + '  ')
        L.append('')
    open(os.path.join(AQUI, 'REVISAR.md'), 'w', encoding='utf-8').write('\n'.join(L))
    print('REVISAR.md', sum(len(l.split()) for l in L), 'palabras')


if __name__ == '__main__':
    main()
