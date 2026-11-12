// =====================================================================================================
// paratexto.typ: university-textbook apparatus for «Electrónica Práctica Avanzada» (objectives, key
// terms, degree mapping, chapter summary, formula summary, self-assessment and its solutions, standards
// and readings, difficulty marks, alphabetical index).
//
// It reuses the visual language of plantilla.typ (block palette, labels, badges, tinted bars) and only
// adds functions: nothing in plantilla.typ is redefined. Data come from the generated per-chapter
// snippets (cap01.typ…), which call these functions.
// =====================================================================================================
#import "../plantilla/libro.typ": *

// The paratext was generated with the numbers of edition 3.0.2; the printed number of a label is taken
// from NUMS (written by construir.py for the current sources) whenever the label is known, so the
// section, chapter and appendix numbers follow any renumbering.
#let num-de(clave, num) = if type(num) == str { NUMS.at(clave, default: num) } else { num }
#let etiqueta-parte(parte, etq) = {
  let n = PARTES.at(parte, default: none)
  if n == none { etq } else if parte.starts-with("ap") [Apéndice #n] else [Capítulo #n]
}

// ----------------------------------------------------------------------------------------- helpers
// Page number of a label in this document, as a link on screen; none if the label is not compiled
// (e.g. a section of another volume).
#let pagina-de(clave) = {
  let q = query(label(clave))
  if q.len() == 0 { return none }
  let loc = q.first().location()
  (n: counter(page).at(loc).first(), loc: loc)
}

#let enlazar(loc, cuerpo) = if IMPRENTA or loc == none { cuerpo } else { link(loc, cuerpo) }

// Section number of a label, linked to it on screen.
#let ref-sec(clave, num) = context {
  let q = query(label(clave))
  let t = text(fill: GRIS, num)
  if q.len() > 0 { enlazar(q.first().location(), t) } else { t }
}

// A head bar + tinted body in the block colour, the family of plantilla's boxes («medio»: tinted bar
// and accent label; «intenso»: solid bar and white label).
#let panel(etiqueta-texto, icono: none, cuerpo) = context {
  let p = pal()
  let sobre = if INTENSO { BLANCO } else { p.texto }
  block(width: 100%, above: 1.4em, below: 1.4em, breakable: true, radius: 5pt, clip: true,
    fill: p.claro, stroke: if INTENSO { 0.9pt + p.solido } else { 0.7pt + p.filete }, {
      block(width: 100%, fill: if INTENSO { p.solido } else { p.fuerte }, inset: (x: 10pt, y: 5.5pt),
        below: 0pt, sticky: true, {
          if icono != none { icono(sobre, if INTENSO { p.solido } else { p.fuerte }); h(4pt) }
          etiqueta(etiqueta-texto, sobre)
        })
      block(width: 100%, inset: (x: 11pt, top: 8pt, bottom: 9pt), above: 0pt, cuerpo)
    })
}

// Drawn icons, as in plantilla (shapes, never glyphs).
#let ico-diana(c, s) = ico({
  place(circle(radius: 4.75pt, fill: c))
  place(dx: 1.75pt, dy: 1.75pt, circle(radius: 3pt, fill: s))
  place(dx: 3.25pt, dy: 3.25pt, circle(radius: 1.5pt, fill: c))
})
#let ico-etiqueta(c, s) = ico({
  place(dy: 1.2pt, curve(fill: c, curve.move((0pt, 0pt)), curve.line((6.4pt, 0pt)), curve.line((9.5pt, 3.55pt)),
    curve.line((6.4pt, 7.1pt)), curve.line((0pt, 7.1pt)), curve.close()))
  place(dx: 5.7pt, dy: 4pt, circle(radius: 0.8pt, fill: s))
})
#let ico-birrete(c, s) = ico({
  place(dy: 1pt, curve(fill: c, curve.move((4.75pt, 0pt)), curve.line((9.5pt, 2.6pt)), curve.line((4.75pt, 5.2pt)),
    curve.line((0pt, 2.6pt)), curve.close()))
  place(dx: 2.2pt, dy: 4.4pt, rect(width: 5.1pt, height: 3.6pt, radius: (bottom: 1.6pt), fill: c))
})
#let ico-libro(c, s) = ico({
  place(dy: 1pt, rect(width: 4.4pt, height: 7.5pt, radius: 0.8pt, fill: c))
  place(dx: 5.1pt, dy: 1pt, rect(width: 4.4pt, height: 7.5pt, radius: 0.8pt, fill: c))
})

// Paratext must not take the «first appearance» glossary mark of a term away from the chapter text:
// the chapter snippets wrap their opening panels in plantilla's public #sin-glosario (terms inside are
// neither marked nor counted, and no margin notes are drawn for them).

// ----------------------------------------------------------------------------------------- opener
// Learning objectives: «Al terminar este capítulo, el lector será capaz de:» + numbered verbs.
#let objetivos(..items) = panel("Objetivos de aprendizaje", icono: ico-diana, {
  set par(justify: false, leading: 0.6em, spacing: 0.6em)
  text(size: 9.4pt, fill: GRIS)[Al terminar este capítulo, el lector será capaz de:]
  v(1mm)
  enum(tight: false, spacing: 0.55em, ..items.pos())
})

// Key terms: glossary terms of the chapter, each with the section where it is defined.
// items: ((termino, clave, num), …)
#let terminos-clave(..items) = panel("Términos clave", icono: ico-etiqueta, context {
  let p = pal()
  set par(justify: false, leading: 0.55em)
  set text(size: 9pt)
  let celdas = items.pos().map(((t, clave, num)) => box(inset: (right: 1pt), {
    t
    if num != none { h(0.25em); ref-sec(clave, text(size: 7.6pt, font: TITULAR, weight: 600, num-de(clave, num))) }
  }))
  // two balanced columns (columns() does not balance inside an auto-height box)
  let mitad = calc.ceil(celdas.len() / 2)
  grid(columns: (1fr, 1fr), column-gutter: 6mm,
    celdas.slice(0, mitad).map(c => block(below: 0.42em, c)).join(),
    celdas.slice(mitad).map(c => block(below: 0.42em, c)).join())
})

// Degree mapping of the chapter: subject families and competence codes (Orden CIN/351/2009).
// materias: (str, …); competencias: ((codigo, texto-corto), …); nota: content or none
#let grado-capitulo(materias: (), competencias: (), nota: none) = panel(
  "Correspondencia con el grado", icono: ico-birrete, context {
    let p = pal()
    set par(justify: false, leading: 0.5em)
    set text(size: 8.8pt)
    grid(columns: (27mm, 1fr), row-gutter: 2.2mm, column-gutter: 3mm,
      text(font: TITULAR, weight: 600, fill: p.texto, size: 8pt)[Materias del grado],
      materias.join[ · ],
      text(font: TITULAR, weight: 600, fill: p.texto, size: 8pt)[Competencias],
      competencias.map(((c, t)) => [#text(font: TITULAR, weight: 700, fill: p.texto, c) #t]).join[ · ],
    )
    if nota != none { v(1.5mm); text(size: 7.8pt, fill: GRIS, nota) }
  })

// ----------------------------------------------------------------------------------------- closing
#let resumen-capitulo(cuerpo) = {
  heading(level: 2, numbering: none)[Resumen del capítulo]
  cuerpo
}

// Formula summary: one row per formula, grouped by section. filas: ((nombre, ecuacion, clave, num, tarjeta), …)
#let formulas-capitulo(filas) = pagina-ancha([Fórmulas del capítulo], 9.4pt, false, context {
  let p = pal()
  set par(justify: false, leading: 0.5em)
  text(size: 8.6pt, fill: GRIS)[Las relaciones del capítulo en el orden en que aparecen. El punto
    #box(width: 2.2mm, height: 2.2mm, radius: 1.1mm, fill: p.vivo) marca las que recoge su tarjeta de fórmulas.]
  v(3mm)
  let seccion = none
  for (nombre, ec, clave, num, tarjeta) in filas {
    let num = num-de(clave, num)
    if num != seccion {
      seccion = num
      block(above: 3.2mm, below: 1.6mm, sticky: true,
        text(font: TITULAR, size: 8pt, weight: 700, fill: p.texto)[#ref-sec(clave, text(fill: p.texto, num))])
    }
    block(width: 100%, breakable: false, above: 0pt, below: 2.4mm, fill: p.claro, radius: 3pt,
      inset: (x: 7pt, y: 5pt), {
        grid(columns: (1fr, auto), column-gutter: 2mm,
          text(font: TITULAR, size: 8.2pt, weight: 600, nombre),
          if tarjeta { box(width: 2.2mm, height: 2.2mm, radius: 1.1mm, fill: p.vivo) })
        v(0.6mm)
        set math.equation(numbering: none)
        show math.equation.where(block: true): set block(above: 0.4em, below: 0.2em)
        show math.equation.where(block: true): set align(left)
        layout(s => {
          let w = measure(ec).width
          if w > s.width { scale(x: s.width / w * 100%, y: s.width / w * 100%, reflow: true, ec) } else { ec }
        })
      })
  }
})

// Self-assessment at the end of the chapter (from the app's review questions).
// preguntas: ((id, enunciado, opciones or none, unidad or none), …); parte: "cap01" for the labels.
#let LETRAS = ("a", "b", "c", "d", "e", "f")
#let autoevaluacion(parte, preguntas) = pagina-ancha([Autoevaluación], 9.4pt, false, context {
  let p = pal()
  [#metadata(parte)#label("autoev-" + parte)]
  let sol = query(label("autoev-sol-" + parte))
  set par(justify: false, leading: 0.52em)
  text(size: 8.6pt, fill: GRIS)[Preguntas de repaso del capítulo, para comprobar lo esencial antes de los
    ejercicios. Las soluciones, con su explicación y la sección donde se trata cada idea, están al final
    del tomo#if sol.len() > 0 [ (pág. #enlazar(sol.first().location(), str(counter(page).at(sol.first().location()).first())))].]
  v(3mm)
  for (k, (id, enunciado, opciones, unidad)) in preguntas.enumerate() {
    let destino = query(label("autoev-sol-" + id))
    let marca = insignia(p, str(k + 1), tam: 9pt)
    if destino.len() > 0 { marca = enlazar(destino.first().location(), marca) }
    block(above: 0pt, below: 3.2mm, breakable: false, width: 100%, {
      [#metadata(id)#label("autoev-" + id)]
      grid(columns: (8mm, 1fr), marca, {
        enunciado
        v(1.2mm)
        set text(size: 8.8pt)
        if opciones != none {
          for (j, o) in opciones.enumerate() {
            block(above: 0pt, below: 0.9mm, grid(columns: (4.5mm, 1fr),
              text(font: TITULAR, weight: 700, fill: p.texto, LETRAS.at(j) + ")"), o))
          }
        } else {
          [Respuesta: #box(width: 22mm, stroke: (bottom: 0.6pt + GRIS), height: 0.9em) #unidad]
        }
      })
    })
  }
})

// Standards and documents cited in the chapter, and the readings (book's own appendix G or suggestion).
// normas: ((cita, contexto, ((clave, num), …)), …); lecturas: ((referencia, origen), …) origen: "G" | "sugerencia"
// normas: none (a chapter whose standards are not listed in its paratext) prints only the readings.
#let normas-referencias(normas: (), lecturas: ()) = {
  heading(level: 2, numbering: none, if normas == none [Lecturas recomendadas] else [Normas y referencias])
  context {
    let p = pal()
    set par(justify: false, leading: 0.55em, spacing: 0.8em)
    if normas == none { } else if normas.len() > 0 {
      heading(level: 3, numbering: none)[Normas y documentos citados en el capítulo]
      for (cita, ctx, refs) in normas {
        block(below: 2mm, grid(columns: (1fr, auto), column-gutter: 3mm, {
          text(weight: 600, cita)
          linebreak()
          text(size: 8.4pt, fill: GRIS, ctx)
        }, text(size: 8.4pt, refs.map(((c, n)) => ref-sec(c, num-de(c, n))).join[, ])))
      }
    } else {
      text(size: 9pt, fill: GRIS)[El capítulo no cita normas ni documentos por su identificador.]
    }
    if lecturas.len() > 0 {
      if normas != none { heading(level: 3, numbering: none)[Lecturas recomendadas] }
      text(size: 8.4pt, fill: GRIS)[#box(width: 2.2mm, height: 2.2mm, radius: 0.4mm, fill: p.vivo) Obra que ya
        recoge el apéndice G. #h(3mm) #box(width: 2.2mm, height: 2.2mm, radius: 0.4mm, stroke: 0.8pt + p.vivo)
        Sugerencia para esta edición.]
      v(1mm)
      for (r, origen) in lecturas {
        block(below: 1.6mm, grid(columns: (4mm, 1fr),
          pad(top: 2.4pt, if origen == "G" { box(width: 2.2mm, height: 2.2mm, radius: 0.4mm, fill: p.vivo) }
            else { box(width: 2.2mm, height: 2.2mm, radius: 0.4mm, stroke: 0.8pt + p.vivo) }),
          text(size: 9pt, r)))
      }
    }
  }
  // the last text of the chapter before its full-width pages: the figures still floating are placed
  // here (see #ejercicios in the template)
  place.flush()
}

// ----------------------------------------------------------------------------------------- exercises
// Difficulty: 1–3 dots from the app's classification (rule in REVISAR.md). Put #nivel(n) at the start
// of an exercise body, or let the badge read it from a dictionary with #nivel-de(niveles, "ej-1.1").
#let nivel(n) = context {
  let p = pal()
  let punto(lleno) = box(width: 1.9mm, height: 1.9mm, radius: 0.95mm, baseline: -0.15mm,
    fill: if lleno { p.vivo } else { none }, stroke: 0.7pt + p.vivo)
  box(inset: (right: 1.6mm), range(3).map(i => punto(i < n)).join(h(0.7mm)))
}
#let nivel-de(niveles, clave) = { let n = niveles.at(clave, default: none); if n != none { nivel(n) } }
#let leyenda-niveles() = block(below: 3mm, text(size: 8.4pt, fill: GRIS)[Dificultad: #nivel(1) directo
  #h(2.5mm) #nivel(2) varios pasos o razonamiento #h(2.5mm) #nivel(3) problema de diseño o de muchos apartados])

// ----------------------------------------------------------------------------------------- back matter
// A wide back-matter page: like plantilla's pagina-ancha but with its own small label, for the
// solutions of the self-assessment and the alphabetical index at the end of a volume.
#let pagina-final(etiqueta-texto, titulo, tamano, columnas, cuerpo) = {
  // running heads of back matter name the volume, not the last chapter
  parte-sin-apertura(etiqueta-texto, titulo)
  pagina-ancha(titulo, tamano, false, cuerpo, rotulo: etiqueta-texto, columnas: columnas, separacion: 7mm)
}

// Solutions of the self-assessment, grouped by chapter at the end of the volume.
// capitulos: ((parte, etiqueta, titulo, ((id, respuesta, explicacion, clave, num), …)), …)
#let soluciones-autoevaluacion(tomo, capitulos) = pagina-final("Tomo " + tomo,
  [Soluciones de la autoevaluación], 8.8pt, 2, {
    let p = PAL-DEFECTO
    set par(justify: false, leading: 0.5em)
    for (parte, etq, titulo, sols) in capitulos {
      block(above: 4mm, below: 2mm, sticky: true, {
        [#metadata(parte)#label("autoev-sol-" + parte)]
        context {
          let q = query(label("autoev-" + parte))
          enlazar(if q.len() > 0 { q.first().location() }, text(font: TITULAR, size: 9pt, weight: 700,
            fill: p.texto)[#etiqueta-parte(parte, etq) #h(1mm) #text(fill: TINTA, weight: 600, titulo)])
        }
      })
      for (k, (id, resp, expl, clave, num)) in sols.enumerate() {
        block(above: 0pt, below: 1.8mm, breakable: false, {
          [#metadata(id)#label("autoev-sol-" + id)]
          context {
            let q = query(label("autoev-" + id))
            grid(columns: (6mm, 1fr),
              enlazar(if q.len() > 0 { q.first().location() }, text(font: TITULAR, weight: 700, fill: p.texto,
                str(k + 1))),
              [#text(weight: 600, resp). #expl #text(size: 0.92em, fill: GRIS)[(→ #ref-sec(clave, num-de(clave, num)))]])
          }
        })
      }
    }
  })

// Letter heading inside the index (emitted by the generated data before the first entry of a letter).
#let letra-indice(l) = block(above: 2.6mm, below: 1.4mm, sticky: true,
  box(fill: if INTENSO { PAL-DEFECTO.solido } else { PAL-DEFECTO.fuerte }, radius: 2pt, inset: (x: 4pt, y: 2pt),
    text(font: TITULAR, size: 9pt, weight: 700, fill: if INTENSO { BLANCO } else { PAL-DEFECTO.texto }, l)))

// Alphabetical index of a volume. entradas: ((letra, texto, (claves principales), (otras claves)), …)
// Page numbers are read from the labels at compile time; main references in semibold. A locator whose
// label is not in this document is left out, and an entry with no locator left is not printed.
#let indice-alfabetico(tomo, entradas) = pagina-final("Tomo " + tomo, [Índice alfabético], 8.2pt, 3, {
  let p = PAL-DEFECTO
  set par(justify: false, leading: 0.42em, hanging-indent: 3mm)
  text(size: 7.6pt, fill: GRIS)[Términos del glosario y títulos de sección del tomo. En seminegrita, la página
    donde se trata cada término.]
  v(2mm)
  let letra = none
  for (l, texto, principales, otras) in entradas {
    if l != letra { letra = l; letra-indice(l) }
    context {
      let ps = principales.map(pagina-de).filter(x => x != none)
      let os = otras.map(pagina-de).filter(x => x != none)
      if ps.len() + os.len() == 0 { return }
      let vistos = ()
      let piezas = ()
      for (x, fuerte) in ps.map(x => (x, true)) + os.map(x => (x, false)) {
        if x.n in vistos { continue }
        vistos.push(x.n)
        piezas.push((x.n, enlazar(x.loc, text(weight: if fuerte { 600 } else { 400 }, str(x.n)))))
      }
      piezas = piezas.sorted(key: x => x.at(0))
      block(above: 0pt, below: 0.95mm, [#texto#h(0.5em)#text(fill: GRIS, piezas.map(x => x.at(1)).join[, ])])
    }
  }
})

// Front-matter page: correspondence of the book with the reference degree.
// modulos: ((nombre, ects, ((codigo, texto, capitulos, cobertura), …)), …)
// materias: ((materia, capitulos), …)
#let correspondencia-grado(supuesto, fuente, modulos, materias, fuera) = {
  pagina-final("Preliminares", [Correspondencia con el grado], 8.6pt, 1, {
    let p = PAL-DEFECTO
    set par(justify: true, leading: 0.55em, spacing: 0.9em)
    supuesto
    v(1mm)
    text(size: 7.8pt, fill: GRIS, fuente)
    let cab(x) = text(font: TITULAR, weight: 600, fill: if INTENSO { BLANCO } else { TINTA }, size: 8pt, hyphenate: false, x)
    let tabla-propia(cols, cabecera, filas) = table(columns: cols, inset: (x: 5pt, y: 4pt),
      stroke: (x, y) => (bottom: if y == 0 { 1pt + p.vivo } else { 0.4pt + FILETE }),
      fill: (x, y) => if y == 0 { if INTENSO { p.solido } else { p.fuerte } } else if calc.even(y) { p.claro },
      align: left, table.header(..cabecera.map(cab)), ..filas)
    for (nombre, ects, comps) in modulos {
      heading(level: 3, numbering: none)[#nombre #text(weight: 400, fill: GRIS, size: 0.85em)[(#ects ECTS)]]
      set text(size: 8.2pt)
      set par(justify: false, leading: 0.45em)
      tabla-propia((12mm, 1fr, 40mm, 21mm), ([Código], [Competencia (texto del BOE)], [Capítulos del libro],
        [Cobertura]), comps.map(((c, t, caps, cob)) => (text(font: TITULAR, weight: 700, fill: p.texto, c),
          t, caps, cob)).flatten())
    }
    heading(level: 3, numbering: none)[Materias típicas del grado y capítulos del libro]
    {
      set text(size: 8.2pt)
      set par(justify: false, leading: 0.45em)
      tabla-propia((52mm, 1fr), ([Materia], [Capítulos]), materias.flatten())
    }
    if fuera != none {
      heading(level: 3, numbering: none)[Fuera del alcance del libro]
      text(size: 8.2pt, fuera)
    }
  })
}
