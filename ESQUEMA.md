# Companion app for «Electrónica Práctica Avanzada» — architecture and content schema

Private, offline app for one reader (the author). One web code base (Svelte 5 + TypeScript + Vite) packaged
with Tauri 2 for Windows (.exe/.msi), macOS (.dmg) and Android (.apk). All content is generated from the
book's Typst sources in `/home/claude/v3` (never edited from here) by a Python pipeline, so a corrected
chapter reaches the app by regenerating.

```
app/
  contenido/            Python pipeline: v3 sources -> web/public/libro/   (run: python3 contenido/generar.py)
  web/                  Svelte + TypeScript + Vite app
    public/libro/       GENERATED content (versioned: CI cannot regenerate it): JSON, SVG, images
    src/
  src-tauri/            Tauri 2 shell (Rust)
  ESQUEMA.md            this file: the contract between pipeline and app
```

Phases: 1 reader (book, figures, equations, references, glossary, search, bookmarks/notes);
2 simulator (ngspice in WebAssembly, the book's 309 netlists with sliders); 3 exercises, quiz, workbook sheets,
calculators; 4 3D component and board models; 5 schematic editor.

## Generated content: `web/public/libro/`

All text is Spanish (Spain) exactly as in the book. HTML fragments are trusted, produced only by the
pipeline, and use only these elements: `strong em sub sup code br a span img`.

### `indice.json` — the whole work
```json
{
  "edicion": "3.0.1",
  "tomos": [ { "id": "I", "titulo": "Fundamentos, Componentes Pasivos y Semiconductores",
               "partes": ["cap00", "cap01", "..."] } ],
  "partes": { "cap05": { "tipo": "capitulo", "num": "5", "label": "cap-5", "titulo": "Diodos — …",
                         "color": "1A3A5C", "tomo": "I",
                         "secciones": [ { "num": "5.1", "label": "sec-5.1", "titulo": "…" } ] },
              "apA": { "tipo": "apendice", "num": "A", "…": "…" },
              "glosario": { "tipo": "glosario", "titulo": "Glosario de Términos Técnicos" },
              "novedades": { "tipo": "anexo", "titulo": "…" }, "creditos": { "tipo": "anexo" } },
  // every entry also has "color", "tomo" and "secciones" (possibly []); "num"/"label" only for cap/ap.
  // "00_preliminares" (start of tomo I) is an "anexo" titled "Prefacio".
  "bloques": [ { "color": "1A3A5C", "nombre": "Fundamentos y componentes" } ]
}
```
`partes` keys are the source file stems; reading order is the order of `tomos[].partes`.
`secciones` lists every `h2` of the part; unnumbered ones (back matter) have `num: null` and a generated label.

### `refs.json` — every labelled object
`{ "sec-5.3": { "num": "5.3", "parte": "cap05", "tipo": "sec" }, "fig-5.3": {…, "tipo": "fig"}, … }`
Types: `cap ap sec subsec fig tab ej prob`. Aliases of the book (old labels) are resolved to their target
entry, so every key that the book cites is present. The app scrolls to the element whose `id` is the label.

### `partes/<stem>.json` — one chapter, appendix or back-matter part
```json
{ "id": "cap05", "tipo": "capitulo", "titulo": "…", "num": "5", "label": "cap-5", "color": "1A3A5C", "tomo": "I",
  "bloques": [ … ] }
```
(`num` and `label` are null for the glossary and the `anexo` parts.)
Block types (`t`), each may carry `"label"` (string, the Typst label; used as DOM id):

| t | fields | source |
|---|---|---|
| `h2` | `num` (null if unnumbered), `html`, always `label` (generated `<stem>-<k>` when unnumbered) | `== Title <sec-N.M>`; `#heading(level: 2, numbering: none)`, a second `#prelim` |
| `h3` | `html`, optional `num` (subnum `5.3.2`) | `=== …` (including `=== #subnum() …` and `=== Problema …`) |
| `h4` | `html` | `==== …` |
| `p` | `html` | paragraph |
| `lista` | `ordenada` (bool), `items`: [html], optional `inicio` (first number of an ordered list), optional `nivel` (1 = nested under the item that precedes it) | `- …` / `+ …` / `6. …` |
| `caja` | `tipo`: `nota importante precaucion ejemplo comprobacion`, `bloques` | `#nota[…]` etc. |
| `deduccion` | `titulo` (html), `bloques` | `#deduccion[title][…]` |
| `tarjeta` | `bloques` | `#tarjeta[…]` formula card |
| `ec` | `svg` (path), `w`, `h` (pt, at the book's 10.5 pt text: scale by font-size/10.5), `fuente` (Typst math; plain text for `#formula-texto` and `#formula([text])`), optional `etiqueta` (html of #eclabel) | `#ec[$…$]`, `#formula($…$)`, `#formula-texto` |
| `figura` | `src` (path: `fig/NAME.svg`, `img/NAME.jpg` or `img/NAME.png`), `num`, `ancho` (0–1), `pie` (html), `credito` (html or null), `tipo_figura` (`grafica` `esquema` `diagrama` `foto`), `svg_vista` ([x, y, w, h], the SVG viewBox in pt; `fig/` only), optional `datos` (`datos/NAME.json`, only for `grafica` and `esquema`): see «Datos de figuras» | `#figura(…)` |
| `tabla` | `num` (or null), `pie` (html or null), `cols` (int), `align` (["left","center","right"]), `cabecera` (bool), `filas`: [[html]] | `#tabla(…)` |
| `codigo` | `lenguaje` (or ""), `texto` | ``#codigo[```lang …```]`` |
| `centrado` | `html` | `#centrado[…]` |
| `ejercicios` | `items`: [{`label`,`num`,`bloques`,`solucion`: bloques or null}] | `#ejercicios[…]` matched with `#soluciones[…]` by label |
| `glosario` | `entradas`: [{`id` (DOM id, also the search id), `termino` (plain text), optional `termino_html` (when the term has markup, e.g. a subscript), `html`, `ver`: [label]}] grouped later by letter in the app | glosario.typ (its letter-range headings are dropped) |

Inline HTML conventions:
- `#strong[x]` → `<strong>x</strong>`, `#emph` → `<em>`, `#sub` → `<sub>`, `#super` → `<sup>`,
  `#raw("x")` → `<code>x</code>`, line break ` \` → `<br>`.
- `#nr("key")` → `<a class="ref" data-ref="key">5.3</a>` (number from refs.json at generation time).
- `#ver(…)` (glossary) → stored in `ver`, not in html. `#caps(1, 24)` (appendix J) → refs to `cap-1`, `cap-24`.
- `#cap-erratas` / `#ap-erratas` (novedades) → `h4`, with `<span class="nota-ed">(capítulo N en la 2.3)</span>`.
- Inline math `$…$` → `<img class="m" src="ec/…svg" alt="typst source" style="height:…em;vertical-align:…em">`
  (em of the surrounding text; vertical-align is minus the depth below the baseline).
- Equations are SVG rendered by Typst with the book's math font; their colour is `currentColor`
  (post-processed) so the app can theme them. Note: inside `<img>` currentColor resolves to black; to theme,
  inline the SVG, or use it as a CSS mask, or invert it in dark mode.

### `glosario.json`
`[ { "termino": "Acoplador direccional", "html": "…", "ver": ["sec-36.4"] } ]` (alphabetical, as in the book).

### `glosario-imagenes.json` (0.8)
Written by `contenido/glosario_imagenes.py` (run alone or at the end of `generar.py`) from `glosario.json`:
```json
{ "version": 1,
  "terminos": { "glos-diodo": { "s": "D", "m": "diodo-do41" },
                "glos-ntc-ptc": { "s": "R", "m": "termistor", "p": { "clase": "ntc" } } },
  "cobertura": { "total": 910, "simbolo": 137, "modelo": 75, "ambos": 54, "alguno": 158, "ninguno": 752 } }
```
Only terms with something to show are listed, by glossary `id`. `s`: symbol key drawn by
`web/src/componentes/glosario/simbolo.ts` from the automatic schematics' symbols (`R POT C CPOL L TRAFO D DZ DS
LED FOTODIODO NPN PNP FOTOTRANSISTOR NMOS PMOS NJF PJF OPAMP AND NAND OR NOR XOR NOT FF REG VDC VSIN VPULSO IDC SW
TL PUENTE TIERRA FUSIBLE XTAL PILA`); `m`: a model type of `tres/modelos/paquetes.ts`; `p`: parameters merged over
the model's defaults. The mapping is a curated table by exact term (`CURADO`, where `None` blocks a term) plus
rules on the term's name (`REGLAS`); nothing is guessed from definitions. Unknown keys fail the script and are
skipped by the app.

### `busqueda.json`
`[ { "id": "sec-5.3", "parte": "cap05", "titulo": "5.3 …", "texto": "plain text of the section" } ]`
One document per `h2` section (plus glossary entries); the app builds the index (MiniSearch). The text before
the first section of a part has `id` = the part label (`cap-5`, `ap-A`) or its stem (back matter): open the part
at the top. Glossary entries have `id` = the entry's `id` (`glos-…`).

### Assets
`fig/NAME.svg` vector figures (from figuras/pdf via pdftocairo or matplotlib SVG), `img/NAME.jpg` photos
(resized to ≤ 1600 px), `ec/HASH.svg` equations, `kicad/…` board images (phase 4),
`datos/NAME.json` data behind plots and schematics (next section).

### `spice.json` and `spice/<stem>/<file>.cir` — the book's netlists (phase 2)
Written by `contenido/spice.py` (run after `generar.py`; `generar.py` calls it at the end). The 309 netlists of
`complementos/spice/<stem>/*.cir` are copied unchanged to `spice/<stem>/`; the index is:
```json
{
  "version": 1,
  "motor": { "id": "xspice", "xspice": true, "ngspice": "45.2", "emscripten": "6.0.3",   // engine that validated
             "alternativo": { "paquete": "eecircuit-engine", "version": "1.8.0" } },       // fallback (no XSPICE)
  "total": 309,
  "capitulos": [ { "parte": "cap42", "tipo": "capitulo", "num": "41", "titulo": "Simulación de Circuitos con SPICE",
                   "color": "…", "tomo": "VI", "netlists": ["cap42/fig-42.3_ac_frente_a_tran", "…"] } ],
  "netlists": {
    "cap42/fig-42.5_filtro_rc": {
      "fichero": "spice/cap42/fig-42.5_filtro_rc.cir",
      "parte": "cap42",                 // source stem; printed chapter via indice.json
      "nombre": "fig-42.5_filtro_rc",
      "titulo": "Filtro RC",            // from the file name ("" when the name is only a label)
      "ref": "fig-42.5",                // main label (first of refs) or null
      "refs": ["fig-42.5", "sec-42.4", "fig-42.6"],   // labels of refs.json it checks: file name first, then header
      "descripcion": "cap42, seccion 42.4 …",          // header comment, «* » removed, «Ejecutar:» line dropped, \n kept
      "analisis": ["ac"],               // op dc ac tran noise tf pz sens four disto sp pss (dot cards and .control commands)
      "control": false,                 // has a .control block
      "parametros": [                   // values the sliders can vary
        { "id": "r1", "elemento": "R1", "subckt": null, "campo": "valor", "tipo": "R", "valor": 1000, "texto": "1k",
          "unidad": "Ω", "min": 100, "max": 10000, "e12": true, "linea": 11 } ],
      "motor": { "estado": "ok", "ms": 52, "medidas": 6, "graficas": 1 }
    }
  },
  "porRef": { "fig-42.5": ["cap42/fig-42.5_filtro_rc"] }   // only labels that are DOM ids in partes/*.json
}
```
`spice-refs.json` is `porRef` alone (≈ 40 kB), what the reader fetches for its «Simular» buttons.
Parameters (same rules in `spice.py` and `web/src/simulador/motor/netlist.ts`; the validator checks they agree):
R, C, L (`campo` `valor`, 4th token), linear E/G gains (`valor`, 6th token), V/I sources (`dc`, `sin.va`,
`sin.freq`, `pulse.v2`, `pulse.per`) and numeric `.param` (`tipo` `param`, `id` `param:<name>`). Values that are
zero, expressions, or elements changed by `alter`/`alterparam` in the `.control` block are left out. Inside
`.subckt X` the id is `x.<name>`. Range: `min = valor/10`, `max = valor·10`, log scale; `e12` for R, C, L.
`motor.estado`: `ok` (ran without ngspice errors), `errores` (ran, ngspice printed errors: some netlists show
errors on purpose), `fallo` (engine crash), `tiempo` (not finished in the validator's limit), `no-disponible`
(uses XSPICE `A` devices and the app's default engine has no XSPICE; `nota` explains), `sin-validar` (validation
skipped). `motor.xspice: true` when the netlist has XSPICE `A` devices (the app checks it against the engine in
use: the fallback engine cannot run them). An XSPICE netlist `<n>` with an analog twin `<n>_analogica` (gates as
behavioural sources, same measurements) has `motor.alternativa: "<id of the twin>"` and the twin has
`motor.original`; with an XSPICE engine the twins are left out of `porRef` (the reader's «Simular» opens the
original, whose page links to the twin).
`ms`: CPU time of the run in the validator's simulation thread (`cpuMs` of validar-spice.mjs; the wall clock
when that is not available), so a busy build machine does not change it. `pesada: true` when it is more than
8 s (the app does not run it automatically).
`errores` lists up to three ngspice error lines.

## Datos de figuras: `datos/NAME.json`

The data behind the figures, for the interactive layer drawn OVER the existing SVG (hover readouts on plots,
animated current flow and node voltages on schematics). Written by the book's figure scripts at save time
(`v3/figuras/exportar_datos.py`, `esquema_datos.py`, `simular_esquema.py`; summary and checks with
`v3/herramientas/informe_datos_figuras.py`), copied by `contenido/datos_figuras.py`, which also annotates the `figura`
blocks and validates the files. Nothing in these files has to be drawn: the SVG already shows everything.

**Figure block.** `tipo_figura`: `grafica` (at least one Axes with real data and numeric ticks), `esquema`
(at least one schemdraw schematic; such a figure may also hold plots), `diagrama` (patches and text, timing
diagrams, qualitative sketches, KiCad renders; no `datos`), `foto` (`img/…`). `svg_vista` is the viewBox of
`fig/NAME.svg`. `datos` is present only for `grafica` and `esquema`.

**Coordinates.** Every `*_svg` value is in the SVG's user units (PDF points, origin top-left, y down), i.e. the
space of `svg_vista`: place the overlay as an `<svg viewBox="…svg_vista…">` stacked on the figure, or scale by
rendered width / `svg_vista[2]`. Figure fraction (`fig`, origin bottom-left, 0–1 of the uncropped matplotlib
figure) maps to SVG by the affine `{sx, tx, sy, ty}`: `X = sx·fx + tx`, `Y = sy·fy + ty` (sy < 0). Data
coordinates of an Axes map through its `pos_svg` box and its axis limits and scales (below). Numbers have 6
significant digits; `null` stands for NaN/±∞ (in a line: a gap in the curve).

```json
{ "version": 1, "nombre": "22.5", "tipo": "esquema", "contiene": ["esquema", "grafica"],
  "lienzo": { "ancho_in": 6.3, "alto_in": 2.7, "recorte": "tight",
              "svg": { "ancho": 446.403, "alto": 181.96, "fig_a_svg": { "sx": 453.6, "tx": -2.376, "sy": -194.4, "ty": 187.426 } } },
  "ejes": [ … ],                // every matplotlib Axes, in drawing order (child insets after their parent)
  "textos": [ … ],              // figure-level texts (fig.text), only for grafica/esquema
  "esquemas": [ … ] }           // only when tipo is "esquema"
```
`lienzo.svg.ancho/alto` equal `svg_vista[2..3]` (the validator checks it); `recorte` is `tight` (cropped to the
drawn area) or `figura`.

### `ejes[]`
```json
{ "id": 1, "clase": "datos", "proyeccion": "rectilinear",
  "pos_fig": [x0, y0, x1, y1], "pos_svg": [x, y, w, h],
  "x": { "lim": [0, 0.7], "escala": "linear", "visible": true, "lado": "bottom",
         "etiqueta": "$V_D$ (V)", "etiqueta_html": "V<sub>D</sub> (V)", "magnitud": "VD",
         "unidad": "V", "factor_si": 1, "unidad_si": "V",
         "ticks": [ { "v": 0.1, "t": "0,1" }, { "v": 1000, "t": "1 k", "menor": true } ],
         "formato": { "clase": "ScalarFormatter", "desplazamiento": "×10⁻³", "unidad": "Hz", "decimales": 1 },
         "categorias": { "A": 0, "B": 1 }, "linthresh": 1 },
  "y": { … }, "titulo": "La caída directa depende de la corriente",
  "series": [ … ], "textos": [ … ], "leyenda": [ { "etiqueta": "…", "html": "…", "serie": 0 } ],
  "gemelo_de": 0, "comparte": "x", "padre": 0,
  "secundarios": [ { "eje": "x", "lado": "top", "etiqueta": "…", "magnitud": "…", "unidad": "…", "factor_si": 1,
                     "ticks": [ { "v": 1, "t": "1", "pos": 1000 } ] } ],
  "polar": { "theta_cero": 0, "sentido": 1, "rlim": [0, 1], "theta_lim": [0, 6.28] } }
```
- `clase`: `datos` (frame on, data artists, numeric tick labels: hover readout), `cualitativa` (curves on a
  frame without numbers: show the shape only, no values), `esquema` (the Axes of a schematic: see `esquemas`),
  `lienzo` (axis off: diagram canvas; only `id`, `clase`, `proyeccion`, `pos_*`). Only `datos` and `cualitativa`
  have `x`, `y`, `titulo`, `series`, `textos`, `leyenda`.
- Data → SVG: with `[X, Y, W, H] = pos_svg`, `T` = identity for `linear`, `log10` for `log` (`symlog`: linear
  inside ±`linthresh`, log outside; rare): `sx = X + W·(T(x) − T(lim0))/(T(lim1) − T(lim0))`,
  `sy = Y + H·(1 − (T(y) − T(ylim0))/(T(ylim1) − T(ylim0)))`. Reversed limits (lim0 > lim1) work unchanged.
  `pos_svg` is the plotting area (inside the spines), already corrected for fixed aspect ratios.
- Units: from the axis label (`«tensión (V)»`, `«f / kHz»`, `«Ganancia [dB]»`, `«amplitud (% del fundamental)»`,
  a bare `«dB»`): `unidad` as written, `factor_si` (mA → 0.001; null for compound units such as V/µs) and
  `unidad_si`; `magnitud` is the label without the unit (plain text). Values in `series` are in the axis
  unit, exactly as plotted (a curve on an axis «corriente (mA)» holds mA). `formato.desplazamiento` (offset
  text, e.g. «1e-3» or «+1,5») is shown next to the axis in the figure: the tick values `v` already include it.
- `ticks`: the tick labels as drawn (decimal comma, Spanish style) with their value `v` in data units; minor
  labelled ticks (log axes) carry `menor`. Use them to format hover values like the axis does.
- `gemelo_de`/`comparte`: a `twinx` (shares `x` with that Axes, its own `y` on the right, same `pos_svg`) or
  `twiny`. `padre`: an inset Axes inside that one. `secundarios`: `secondary_xaxis/yaxis` scales; `pos` is the
  position of each secondary tick in the parent's data coordinates. `polar`: angles in radians, `theta_cero`
  offset, `sentido` 1 (counter-clockwise) or −1; the polar `pos_svg` is the square around the circle.

### `series[]` (data coordinates)
Common optional fields: `etiqueta` (legend label, drawn text), `etiqueta_html`, `color` (#rrggbb), `alfa`,
`estilo` (matplotlib linestyle), `grosor` (pt), `marcador`, `z` (draw order).

| `tipo` | fields | from |
|---|---|---|
| `linea` | `x`, `y` (arrays, same length), `n` (points in the original), optional `submuestreo: "minmax"`, `coordenadas: "mixtas"` | `plot`, `semilogx`… (more than 2000 points: min and max of each of 1000 buckets kept, so no peak is lost; a `null` keeps each gap) |
| `escalon` | as `linea` + `trazado`: `steps-pre` / `steps-mid` / `steps-post` | `step`, `drawstyle` |
| `hline` | `y`, `ejes_x` ([from, to] in axes fraction 0–1) | `axhline` |
| `vline` | `x`, `ejes_y` | `axvline` |
| `dispersion` | `x`, `y`, `n`, optional `tamano` (pt²), `colores` (per point) | `scatter` |
| `relleno` | `poligonos`: [[[x, y], …]], `entre` (true for `fill_between`) | `fill_between`, `fill`, `PolyCollection` |
| `barras` | `orientacion` `v`/`h`, `barras`: [{`x`, `y` (lower-left corner), `ancho`, `alto` (may be negative), `valor`, `color`}] | `bar`, `barh`, `hist` |
| `tallos` | `x`, `y`, `base` | `stem` |
| `errores` | `x`, `y`, optional `y_inf`/`y_sup`, `x_inf`/`x_sup` (absolute ends of the bars), `mostrar_linea`, `marcador` | `errorbar` |
| `segmentos` | `segmentos`: [[[x, y], …]], optional `submuestreo` («1 de cada k»: above 10 000 points only every k-th segment is kept) | `vlines`, `hlines`, `LineCollection` |
| `region` | `vertices`: [[x, y]] | patches drawn in data coordinates (rectangles, polygons) |
| `franja_x` / `franja_y` | `x` or `y`: [from, to] (full height / width of the Axes) | `axvspan`, `axhspan` |
| `imagen` | `extent` | `imshow`, `pcolormesh` (no pixel data) |
| `vector` | `de`, `a`: [x, y] (tail and head) | text-less `annotate('', xy, xytext)` arrows in data coordinates (phasors) |

Lines of 1 or 2 points are usually markers or guides (a highlighted operating point, a dotted projection to
an axis): readouts should prefer the longest `linea`/`escalon` series and treat 1-point series as labelled
points.

### `textos[]` (in `ejes[]` and at the top level)
`{ "texto": "1 mA a 0,57 V", "html": "…", "color": "#a93226", "caja_fig": [x0, y0, x1, y1], "xy": [x, y],
"ancla": [x, y], "apunta_a": [x, y], "flecha": true }`: `texto` as drawn (mathtext `$…$` kept), `html` with
`sub`/`sup`/`br`; `caja_fig` the drawn text box in figure fraction (map with `fig_a_svg`); `xy` its centre and
`ancla` its anchor point, in data coordinates of the Axes (absent at the top level); annotations with an
arrow give the point they mark in `apunta_a`.

### `esquemas[]` — schematics
```json
{ "eje": 0, "tolerancia": 0.02,
  "dibujo_a_svg": { "sx": 36.43, "tx": 45.53, "sy": -36.43, "ty": 144.61 },
  "dibujo_a_fig": { … },
  "puntos": [ { "id": "P0", "xy": [0, 0], "nodo": "N0" } ],
  "elementos": [ … ], "nodos": [ … ], "tramos": [ … ], "simulacion": { … } }
```
All geometry is in schemdraw drawing units (y up); `dibujo_a_svg` maps it: `X = sx·x + tx`, `Y = sy·y + ty`
(checked by drawing the exported points over the rendered PDF). `eje` is the index in `ejes` of the Axes it is
drawn on (`clase: "esquema"`).

`elementos[]`:
```json
{ "id": "E3", "clase": "ResistorIEC", "rol": "R", "designador": "R1",
  "etiquetas": ["$R_1$\n10 kΩ"], "etiquetas_html": ["R<sub>1</sub><br>10 kΩ"],
  "valor": 10000, "unidad": "Ω", "valor_texto": "10 kΩ", "origen_valor": "etiqueta", "valores": { "Ω": 10000 },
  "modificador": "pp", "texto_valor": "12 V", "referencia": "1N4007",
  "anclas": { "start": [0.5, 3.8], "end": [2.9, 3.8], "center": [1.7, 3.8] }, "caja": [x0, y0, x1, y1],
  "terminales": { "start": "N1", "end": "N2" }, "puntos_terminal": { "start": "P1", "end": "P2" },
  "polaridad": { "positivo": "end", "negativo": "start" }, "invertido": false, "discontinuo": false,
  "color": "#1a3a5c", "estado": "abierto", "carga_corriente": 0.1 }
```
- `rol` (what the netlist does with it): `R` `POT` `C` `L` `V` (SourceV) `V?` (generic source) `BAT` `I`
  `VSIN` `VPULSE` `VTRI` `DEP` (controlled source) `D` `DZ` `LED` `PD` `VAR` `QN` `QP` `QPHOTO` `MN` `MP` `JN` `JP`
  `OA` (op-amp) `GND` `RAIL` (Vdd/Vss) `DOT` `WIRE` (Line/Wire) `SW` `SPDT` `LAMP` `SPK` `FUSE` `AM` `VM` (meters)
  `XFMR` `X`/`X2` (unsupported part) `ANOT` (labels, arrows, current labels, brackets: no terminals).
- `valor`/`unidad`: parsed from the element's labels («10 kΩ» → 10000, «4,7 µF» → 4.7e-6, «4k7», «3V3»,
  «+12 V», «R = 1 kΩ»), or, when the element has none, from a free text of the same Axes within 1.2 units of
  it (`origen_valor: "texto_cercano"`, `texto_valor`). `valores` holds every unit found (a sine source:
  `{"V": 10, "Hz": 1000}`); `modificador`: `pp`, `ef`/`rms`, `p`/`pico` after a voltage. Lamps rated «12 V
  5 W» get R = V²/P, loads «carga 50 mA, 2,8 V» get R = V/I (`origen_valor` ends in `+calculado`); a load with
  only its current becomes a current sink (`carga_corriente`, A).
- `anclas`: every schemdraw anchor (terminals and others: `center`, `istart`, `iend`, `tap`, `in1`…), absolute.
  `caja`: the symbol's bounding box without labels (hover target). `terminales`: terminal → node;
  terminal names: two-terminal parts `start`/`end`, potentiometer + `tap`, BJT `base` `collector` `emitter`,
  FET `gate` `drain` `source`, op-amp `in1` (inverting), `in2` (non-inverting), `out`, and `vd`/`vs` (supply
  pins) only when something is connected there; `GND`, `RAIL`, `DOT`: `start`.
- `polaridad` (schemdraw conventions; `invertido` = reverse(), which mirrors the symbol and swaps the roles):
  voltage sources `positivo`/`negativo`, battery (long plate) `positivo` at `start`, current sources `entra`/`sale`
  (the arrow points to `sale`), diodes `anodo`/`catodo`, op-amp `inversora`/`no_inversora`/`salida`.
- `discontinuo`: drawn dashed = optional or alternative part: left out of the netlist. `estado` (switches):
  `abierto`/`cerrado` as drawn.

`nodos[]`: `{ "id": "N1", "tierra": false, "puntos": ["P0", "P3"], "terminales": ["E1.start", "E4.end"],
"etiquetas": ["$V_{out}$"] }` — electrical nodes: points joined by wires. `N0` (when present) is the ground
node; every ground symbol belongs to it. `etiquetas` come from labelled dots, rails and grounds on the node.

`tramos[]`: `{ "id": "T3", "elemento": "E6", "origen": "schemdraw", "nodo": "N0", "de": "P5", "a": "P6",
"puntos": [[3.6, 0], [1.8, 0]], "longitud": 1.8 }` — every wire (schemdraw Line/Wire, or a solid matplotlib
line of the same Axes touching the schematic: `origen: "matplotlib"`, `elemento: null`) split at each point
where something attaches (terminal, other wire end, bend with a junction), so each tramo carries one current.
`puntos` is its polyline from `de` to `a` (current sign convention below). Connection rules: points closer than
`tolerancia` are the same point; a wire or terminal ending on the inside of another wire joins it (T junction);
crossing wires do not connect.

`simulacion`:
```json
{ "simulable": true, "motivos": [], "advertencias": [], "masa": "N0",
  "supuestos": ["E2: 3 V tomado como amplitud de pico"], "modelos": { "E5": "D1N4148" }, "excluidos": ["E9"],
  "netlist": "* esquema generado …\n.options rshunt=1e12\n…",
  "op":   { "nodos": { "N1": 12 }, "tramos": { "T1": 0.002 },
            "elementos": { "E3": { "terminales": { "start": 0.002, "end": -0.002 }, "corriente": 0.002,
                                   "tension": 8, "potencia": 0.016 },
                           "E7": { "corriente": 0.002 } } },
  "tran": { "t": [0, …], "periodo": 0.001, "nodos": { "N1": [ … ] }, "tramos": { "T1": [ … ] },
            "elementos": { "E3": { "terminales": { … }, "corriente": [ … ], "tension": [ … ] } } },
  "tran_error": "…" }
```
- `simulable` = every part has a value and a model, there is a source, ngspice (`-b`) solved `.op` and the
  solution is sane. Otherwise `motivos` says why (`faltan valores: R1 (E4)`, `componentes no soportados: …`,
  `sin fuentes`, `sin masa`, `ngspice no resuelve: …`) and there is no `op`. `supuestos` lists every
  assumption made to simulate (ground placed on the negative terminal of the first source when none is drawn —
  `masa: "supuesta"`; amplitude read as peak; mains voltage as RMS; frequency 1 kHz (50 Hz for ≥ 100 V) when
  not labelled; potentiometer at mid travel; switches as drawn; voltmeter 10 MΩ; op-amp rails ±14 V).
- Signs: node voltages to ground (V). `tramos`: current in A, positive from `puntos[0]` (`de`) to the last
  point (`a`): animate dots along the polyline in that sense, reversed when negative, speed ∝ |I| (log scale
  advised: currents span nA to A). `elementos[id].terminales[t]`: current INTO the element at that terminal;
  `corriente` (two-terminal parts) = current entering at `start` and leaving at `end`; `tension` =
  V(start) − V(end); `potencia` = Σ V·I over its terminals (W, > 0 absorbed, < 0 delivered by sources). Ground
  symbols and rails give `corriente` into the symbol (`nota` on rails: positive towards the rail).
- `tran` (only with sine, square or triangle sources): the last 2 periods of 5 simulated, about 100 samples
  per period, `t` from 0. Arrays are aligned with `t`.
- Models (as in the book's netlists, `v3/complementos/spice`): 1N4148 (default diode), 1N4007 (labels
  «1N400x»), Schottky, red LED (≈ 1,9 V at 20 mA), Zener with the labelled voltage, 2N3904 (NPN), 2N3906
  (PNP), level-1 MOSFETs (VTO ±2 V, KP 0,5), op-amp = VCVS with A0 = 1e5 and a 10 Hz pole, output clamped by
  tanh to its drawn supplies (or ±14 V), Ro = 10 Ω. Every terminal and wire segment carries a 0 V source to
  measure its current (`va_<elem>_<terminal>`, `vt_<tramo>` in `netlist`); wires that form a loop carry
  1 µΩ per unit of length so the current divides as along real wires.

## App behaviour (phase 1)
Sidebar with volumes → chapters → sections, reading pane, top search; chapter colour as accent;
figure zoom (tap to open full screen, pinch on Android); reference links scroll and highlight the target with
a back button; glossary terms list with filter and «ir a la sección»; light/dark theme; remembered position
per chapter, bookmarks and personal notes per section (stored locally via Tauri store/localStorage);
responsive: phone (single column, drawer), tablet/desktop (sidebar + content). Typography: Source Serif 4 for
text, Source Sans 3 for UI and headings (bundled woff2), as in the book.

### Reference previews (0.8, `lib/vistaPrevia.ts`, `componentes/vista-previa/`)
- Every `a.ref[data-ref][href]` whose key is in `refs.json` (reader, exercises, glossary, quizzes; not inside the card
  nor inside `[aria-modal="true"]` overlays) has a floating preview. The controller (`instalarVistaPrevia`, called by
  `main.ts`) is a few delegated listeners on the document and is the only part in the start-up bundle; the card
  (`montar.svelte.ts` mounts `Tarjeta.svelte` on `<body>` once) is a lazy chunk, requested when the pointer rests on
  a reference (with the target part, `cargarParte`, which is cached).
- Mouse: 350 ms on a reference opens it; leaving reference and card for 280 ms closes it; a click jumps as before.
  Touch/pen: a tap opens it instead of jumping (the click is stopped in the capture phase, so the reader's
  `prepararSalto` does not run); «Ir a …» or a second tap on the same reference jumps. Keyboard: Enter on the focused
  reference opens it and focuses «Ir a …» (Enter again jumps); Esc closes and returns the focus. It also closes on a
  press outside, a page scroll of more than 12 px, a route change and (mouse) a resize.
- «Ir a …» (`seguirReferencia`) clicks the original link with the interception off, so the jump, the history entry
  and «Volver a 5.2» are exactly those of a click.
- Content (`destino.ts`): the target block is found by `candidatosDeRef` in a per-part label index (inside boxes,
  derivations, cards and exercise items). `fig` → the image (aspect from `svg_vista`) and caption; `tab` → `Tabla`
  (label removed: no duplicate ids); an `ec` block (any key whose label is on an `ec` block; the book has none yet)
  → the masked SVG and `etiqueta`; `sec`/`subsec`/`prob` → title, the first two paragraphs of its range (faded when
  cut) and its first figure; `cap`/`ap` → title, intro paragraphs, first figure; `ej` → the item's paragraphs.
  References inside the card are plain text.
- Placement: `position: fixed` (the text never moves). ≥ 600 px wide: up to 440 px wide, below the line of the
  reference under the pointer if it fits, else above, else on the larger side with its body scrolling; never over
  the reference, clamped to the window, the top bar and the tab bar. < 600 px: a full-width sheet at the bottom, or
  at the top under the bar when the sheet would cover the reference. `role="dialog"`, `aria-labelledby`, the link
  gets `aria-describedby="vista-previa"` while it is open. Animations only without `prefers-reduced-motion`.
- Tests: `tests/visual.spec.ts` (`playwright.visual.config.ts`, port 4271).

### Start page (0.8, `Inicio.svelte`, `componentes/inicio/`)
`Inicio.svelte` is a lazy chunk (App.svelte `{#await import()}`; prefetched at start-up when the route is `#/`).
Order: cover and shortcuts; `SeguirLeyendo` (the part with the newest `usuario.posiciones` entry, its section `sec`,
the figure of that section the reader passed last (`figura` blocks with top index ≤ `pos.b`), else its first, else the
part's first; without positions, «Empezar a leer» with the first chapter) next to `RepasoHoy` (counted in idle time
by the lazy `repasoHoy.ts`: `cargarBaraja` + `recuento` for `repaso.ajustes.mazo`, same numbers as the «Repaso»
page); «También leyendo» (the other recent parts); `MapaLibro` (every part of `indice.tomos[].partes` as a tile:
block colour, tint rising with `aprendizaje.leidas` fraction, one notch per section, solid colour and ✓ when complete,
dashed for unnumbered parts, ring on the part read last; `data-parte`, `data-leidas` and an `aria-label` with the
counts); `ProgresoInicio`. The page loads one image at most (the «Seguir leyendo» figure).

### Glossary pictures (0.8, `componentes/glosario/`)
`Glosario.svelte` imports `glosario/imagenes.ts` lazily (it reads `glosario-imagenes.json`, draws symbols with
`simbolo.ts` → inline SVG in `currentColor`, and imports `tres/catalogo3d.ts`). A term with a model gets a 4:3 tile
observed by an IntersectionObserver (200 px margin); only then `imagenes.miniaturaDe` imports `tres/miniaturas.ts`
(three.js) and renders the thumbnail with the 3D viewer's studio background of the current theme. Object URLs are
cached per model, parameters and theme for the session (not in the store: a PNG per model and theme would grow the
synced data file). «Ver en 3D» → `hrefModelo`. Without WebGL2 (`window.__epaSinWebGL`) the tile keeps its icon.

### Navigation («carril de iconos»)
- `lib/navegacion.svelte.ts` holds `HERRAMIENTAS`, the one registry of the app's sections
  (`{ id, ruta, icono, etiqueta, corta?, vistas?, pestana?, atajo?, cuenta? }`, ordered by use: Libro, Buscar,
  Simulador, Calculadoras, Ejercicios, Repaso, Componentes, Conceptos, Instrumentos, Kit FM7303, Consolas, Glosario,
  Marcadores). A new section adds one entry (and its `Vista`/route in `ruta.svelte.ts`). `ruta: null` marks the two
  actions: `libro` (phone: opens the index drawer; desktop: toggles the index while reading, else returns to the
  last part read) and `buscar`. The module also has the reading sequence (`pasoVecino`: previous/next section,
  crossing into the next part's opening `#/<parte>/<label>`; `parteVecina`), the index filter (`filtrarIndice`:
  every word, accents and case ignored, in part and section titles; `5.8`/`A.3`/`sec 12.4` section numbers;
  `33`/`cap 33`/`ap B` a chapter or appendix with all its sections; `resaltar` for the marks) and the index
  panel's visibility per view (`indiceOculto`, `alternarIndice`: key `libro` for the reader, else the view; shown
  by default only in the reader and on the start page; stored in `prefs.indiceOculto`).
- Desktop and tablet landscape (≥ 1024 px): `Carril.svelte` (fixed rail, `--ancho-carril` 84 px: logo → Inicio,
  icon + short label, tooltip with the full name, active pill; entries that do not fit the height go, least used
  first, to «Más» = `MenuHerramientas.svelte`), `Lateral.svelte` (the index panel, `--ancho-panel` 300 px), and
  `Barra.svelte` (index toggle, clickable breadcrumb → `MenuCapitulo.svelte` with the chapter's sections and the
  chapters before/after, previous/next section buttons, Alt + ↑/↓). App.svelte sets `--ancho-lateral` (what the
  content leaves on the left) from the panel state.
- Phone and tablet portrait (< 1024 px): `Pestanas.svelte` (tab bar: the entries with `pestana` + «Más» as a sheet
  with the rest and Inicio); «Libro» opens `Lateral.svelte` as a drawer. `--alto-pestanas` (58 px) and
  `--hueco-inferior` (tabs + safe area) keep fixed bottom elements and the page end above the tabs; the tabs hide
  while a text field has the keyboard up. Drawer, «Más» and the breadcrumb menu are history overlays
  (`abrirCapa`), so the Android back button closes them first, and links inside them replace their entry.
- `IndiceLibro.svelte` (panel and drawer): volumes (colour stripe of their chapters, collapsible, read bar),
  chapters (badge, ring), only expanded chapters render sections; the current chapter opens by itself and its row
  stays on top while its sections scroll; the current section is highlighted and kept in view (the list scrolls,
  never the page, and not within 6 s of the reader touching the list); «Ir a la sección actual» appears when it is
  out of view; filter box (Enter opens the first result, ↓ goes to the list, a button passes the words to the
  full-text search through `app.buscarTexto`); keys ↑ ↓ Inicio Fin, → opens, ← closes or goes to the parent.
- Tests: `tests/navegacion.spec.ts`; screenshots: `node tests/navegacion-capturas.mjs --url …` →
  `tests/capturas/navegacion/` (`antes-*` are the previous sidebar).

## Simulator (phase 2)

Routes: `#/simulador` (catalogue by chapter, search, analysis filter), `#/simulador/<parte>/<nombre>` (one netlist)
and `#/simulador/nuevo` (free-form circuit, kept in `localStorage` key `epa:circuito`). The reader shows a
«Simular» button next to every section, figure, problem (h3) and exercise whose label is in `spice.porRef`
(`spice-refs.json` is fetched in idle time after start-up; `spice.json` only by the simulator).

Engine (0.8): two WebAssembly builds of ngspice 45.2 with the same driver, chosen in
`web/src/simulador/motor/motores.ts` (`MOTOR_PREDETERMINADO`; `localStorage` `epa:motor-spice` = `xspice` |
`eecircuit` overrides it on one device; if the chosen one cannot be loaded the client loads the other):
- `xspice` (default): ngspice 45.2 **with XSPICE** and the code-model libraries spice2poly, analog, digital,
  xtradev, xtraevt, table and tlines linked in statically, built by `web/scripts/ngspice-wasm/compilar.sh`
  (Emscripten 6.0.3, LLVM 23.1.4, binaryen 129; pinned versions and checksums in `versiones.sh`, details in its
  README) and **committed** in `web/vendor/ngspice-xspice/` (`ngspice.mjs` 92 kB, `ngspice.wasm` 6.5 MB / 2.1 MB
  gzip, `compilacion.json` with versions, options and SHA-256, `LICENSE.txt`). CI does not build it.
- `eecircuit`: the build of the npm package `eecircuit-engine@1.8.0` (MIT, no XSPICE), the engine up to 0.7,
  kept as a fallback during 0.8. The package's own driver is not used (its raw-file reader takes byte offsets
  from decoded text, so any non-ASCII title, i.e. every book netlist, makes `runSim()` never resolve; it also
  returns only the last plot and ships the binary twice as base64 in a 20 MB module).
`web/scripts/ngspice.mjs` (run by `npm run dev|build|check`) copies the XSPICE build to
`web/src/simulador/motor/ngspice-xspice.js` and `web/public/ngspice/ngspice-xspice.wasm`, and extracts the
eecircuit factory to `web/src/simulador/motor/ngspice.js` (67 kB) and its binary to
`web/public/ngspice/ngspice.wasm` (5.8 MB); all generated and git-ignored. Both builds have the same hooks
(`setGetInput`, `setHandleThings`, `runThings`, Asyncify; `scripts/ngspice-wasm/pre.js` and `parches.py`), so
`nucleo.ts` only picks the factory (`OpcionesEjecucion.motor`); the worker gets the engine id with the module
(`{ t: 'motor', modulo, motor }`).

```
web/src/simulador/
  motor/nucleo.ts     drives ngspice's interactive front end: fresh instance per run (≈ 40 ms), `source`, `run`
                      when there is no .control, then every plot dumped with `write` and read back (UTF-8 safe,
                      binary/ASCII raw reader). No DOM: runs in the worker and in Node.
  motor/netlist.ts    netlist text: analyses, preparation for the engine (quit/exit/plot… commented out, echo
                      lines tagged to split the output in sections, optional `.options klu`), parameters.
  motor/salida.ts     printed output → sections (echo headings, «Measurements for …» banners), measurements
                      («name = value», meas trailers at=/targ=/trig=), errors/warnings with Spanish explanations.
  motor/simular.ts    one simulation: SPARSE solver (matches native ngspice), retried with KLU only when it
                      aborts with «Timestep too small».
  worker.ts           Web Worker hosting the engine; protocolo.ts its messages.
  cliente.svelte.ts   lazy download (progress) and compile of the .wasm, one worker, supersedes running jobs
                      (sliders), 3-minute limit, «Detener».
  graficas.ts         ngspice plots → plot panels (AC: magnitude dB + unwrapped phase; otherwise one panel per unit).
  datos.svelte.ts     spice.json, netlist texts, «Simular» map.
  motor/motores.ts    the two engines (ids, binaries, XSPICE or not), the default and the local override.
web/scripts/validar-spice.mjs   runs every netlist through the same engine in Node (worker_threads, timeout),
                      `--motor xspice|eecircuit` (default: the app's), optionally against native `ngspice -b`
                      (--nativo); used by contenido/spice.py (with the app's default engine).
web/scripts/ngspice-wasm/       build of the XSPICE engine (compilar.sh, versiones.sh, parches.py,
                      cm_estatico.c, pre.js, README.md); output in web/vendor/ngspice-xspice/.
```

## Plot component (`web/src/componentes/grafica/`)

Reusable, dependency-free canvas plot (Svelte 5). Import from `web/src/componentes/grafica` (index.ts).

```ts
interface Series { name: string; unit: string; x: Float64Array; y: Float64Array; color?: string; dashed?: boolean }
interface Axis   { label: string; unit: string; scale: 'linear' | 'log'; min?: number; max?: number }
class PlotLink   { xRange: [number, number] | null; hoverX: number | null; cursorsOn: boolean;
                   cursors: [number, number] | null }          // $state fields, shared by linked plots

<Grafica series={…} xAxis={…} yAxis={…}
         trace={[]}        // faint dashed curves of an earlier result, matched to series by name
         link={plotLink}   // optional: x zoom/pan, crosshair and cursors shared with other plots
         height={260} title="" animate={true} ariaLabel="" help={true} />
```
- `unit` is the SI unit without prefix (`V`, `A`, `Hz`, `s`, `Ω`, `dB`, `°`, `''`); axes and readouts choose the
  prefix and use Spanish number format (decimal comma, «−»). `formatoSI(v, unit, digits)` is exported.
- One y scale per plot (no dual axes): put different units in separate plots sharing a `PlotLink`.
- Interaction: crosshair + readout of every visible series (interpolated; log-x aware) with the trace's value;
  box zoom (drag), pan (Shift + drag, middle button, two fingers), wheel zoom when the plot is focused or with
  Ctrl (Shift + wheel: y), pinch zoom, double click / double tap reset; keyboard ← → (read), + − (zoom), 0/Esc
  (reset), C (cursors). Legend buttons hide/show series. Toolbar: Cursores, X log, Y log, Tabla, Restablecer.
- Cursors A and B (draggable): table with x, y of each series at A and B, B − A and 1/Δx (Hz for a time axis).
- When `series` changes, curves with the same name morph from the previous data (420 ms, off with
  prefers-reduced-motion or above 400 000 points); axis ranges follow.
- Large data: per-pixel min/max decimation for monotonic x; nested sweeps (x going back) lift the pen.
- Colours: validated categorical palette, light and dark steps (`--g-1`…`--g-8`, by series position, never
  cycled); ink from the app's theme variables.

## Component animations (`web/src/componentes/animaciones/`)

Interactive canvas animations of how each component works, independent of the generated content.
- Routes: `#/componentes` (gallery) and `#/componentes/<id>` (one animation); `Vista` includes `'componentes'`.
- `catalogo.ts` lists every animation: `id`, `titulo`, `familia`, `resumen`, search `claves`, `simbolo` and
  `libro`: the `refs.json` labels it illustrates (`sec-5.2`, `fig-5.5`, …). `animacionesDe(label)` drives the
  «Ver animación» button that `Seccion.svelte`, `Figura.svelte` and `Bloques.svelte` show for those labels; the
  page links back to them (with the usual «Volver» jump). Adding a label to `libro` is all it takes to link a
  new section; labels must exist in `refs.json`.
- `cargadores.ts` maps each id to its lazily imported scene in `escenas/`. A scene renders `ui/Marco.svelte`
  with `ui/Escena.svelte` (canvas: `dibujar(v)` in logical units, `paso(dt, t)` with dt in seconds from the
  rAF timestamps, never per frame), controls from `ui/`, an own minimal plot (`ui/Grafica.svelte`) and the
  dynamic text. Shared physics in `nucleo/fisica.ts` (book device parameters), drawing helpers in
  `nucleo/dibujo.ts`, `esquema.ts`, `piezas.ts`, PN-junction particle model in `nucleo/union.ts`.
- Text: `txt()` and `txtRico()` take `max` (widest the text may be, logical units: a longer one is drawn with a
  smaller font that fits), used where a label shares its room with another (panel titles, values between parts);
  a panel's x tick label that would touch the previous one is left out. Test hook: while
  `globalThis.__epaTextos` is a Map, both record every text's box per canvas (device pixels; `ui/Escena.svelte`
  clears a canvas's list before each frame and copies the cached layers' texts into it).
  `tests/escenas-textos.spec.ts` opens every scene of both collections, every option of every selector, at 390,
  800 and 1366 px, with the app's font and with a wider fallback of Arial/Roboto metrics (FreeSans mapped to
  «Source Sans 3»), and fails when two labels overlap by more than 2 CSS px (single «+»/«−» charge signs apart).

## Conceptos animados (`web/src/componentes/animaciones/conceptos/`)

Segunda colección del mismo módulo: 34 escenas de la teoría que una figura fija explica mal (fasores, Fourier,
muestreo, realimentación, conmutadas, metaestabilidad, líneas de transmisión…), con el núcleo, la interfaz y las
reglas de rendimiento de las animaciones de componentes.
- Rutas: `#/conceptos` (galería) y `#/conceptos/<id>`; `Vista` incluye `'conceptos'` (vista `Conceptos.svelte`).
- `coleccion.ts` describe las dos colecciones (`COMPONENTES`, `CONCEPTOS_ANIMADOS`: ruta, grupos, entradas,
  cargadores); `Galeria.svelte` y `Pagina.svelte` reciben la colección (por defecto, componentes), y
  `enlacesDe(label)` reúne las dos para el botón «Ver animación» del lector (`VerAnimacion.svelte`, con menú si
  hay varias). Basta añadir una etiqueta de `refs.json` a `libro` para enlazar una sección o figura.
- `conceptos/catalogo.ts`: `id`, `titulo`, `area` (siete áreas con color), `resumen`, `claves`, `libro`,
  `icono` (glifo de `conceptos/Icono.svelte`); `conceptos/cargadores.ts`: una escena perezosa por id.
- `conceptos/nucleo/`: `grafica.ts` (gráficas dentro del canvas: ejes con prefijos SI y coma decimal, curvas,
  barras, guías; `estatico()` dibuja papel, rejillas y textos fijos en **una sola** capa en caché por escena),
  `complejo.ts`, `senal.ts` (FFT radix-2, ventanas, ruido determinista), `smith.ts` (carta de Smith),
  `simbolos.ts` (fuente de corriente, flechas de corriente, chapas, barras) y `spice.ts` (transitorio con el
  worker de ngspice de `simulador/cliente.svelte.ts`: lo usa la fuente lineal, con la netlist del libro).
- Cálculo real en cada escena: soluciones analíticas (mallas, Thévenin, RLC con sus polos, Bessel en el efecto
  pelicular y en FM, coeficientes de Fourier, Γ y VSWR, red en L de Pozar), integración numérica (oscilador de
  Wien con su no linealidad, PID con retardo, PWM con RC exacto por tramos), FFT (ventanas, cuantificación,
  THD), simulación por eventos (glitches) o ngspice (rectificador). Las gráficas de Bode legibles usan
  `componentes/grafica`.
- Pruebas: `tests/conceptos.spec.ts` (galería, carga de todas las escenas, enlaces con el libro, arrastre en
  Bode, ngspice); `tests/animaciones.mjs` y `tests/animaciones-hz.mjs` recorren las dos colecciones
  (`--coleccion componentes|conceptos`); `tests/conceptos-capturas.mjs` deja capturas y hojas de contacto en
  `tests/capturas/conceptos/`.

## 3D component models (`web/src/componentes/tres/`, phase 4)

Procedural, parametric three.js models of the components of chapters 2–10 and 45 (no model files: every
model is generated in code from standard package dimensions and the book's descriptions), the viewer, and the
«Animación | Pieza 3D» switch (labelled «2D | 3D» up to 0.7.0) of the «Componentes» pages. three.js `0.186.1` (exact), loaded only when a 3D view opens.

```
modelos/            the library (also used by the KiCad board views)
  index.ts          crearModelo(tipo, parametros?, opciones?) → THREE.Group; liberarModelo(g); re-exports
  tipos.ts          Parametros, OpcionesModelo, Huella/Pad, DatosParte (labels, explosion), Corte, DatosModelo
  paquetes.ts       PAQUETES: key, name, family, package, defaults, UI controls, KiCad names (no three.js)
  codigos.ts        E12/E24/E96, IEC 60062 bands, SMD codes (3 and 4 digits, R, EIA-96), «104», value texts
  comun.ts          Recursos (shared cache), PBR finishes, leads, gull-wing leads, lathe bodies, text decals,
                    painted textures, die texture, bond wires (merged), instancing helpers
  resistencias.ts   axial resistor (and colour-coded axial inductor), SMD chip, potentiometer, trimmer
  condensadores.ts  radial disc (ceramic, NTC/PTC/MOV), MLCC, film box, aluminium electrolytic radial and V-chip,
                    supercapacitor, tantalum chip
  inductivos.ts     drum inductor, toroid, shielded SMD inductor, EI transformer, relay
  semiconductores.ts DO-41/DO-15, DO-35, SOD-123, LED 5 mm, SMD LED, bridge, TO-92, TO-220, SOT-23, D-PAK
  integrados.ts     DIP (also bridge and optocoupler), SOIC, LQFP, QFN with lead frame, die and bond wires
  varios.ts         HC-49 crystal, 5 × 20 fuse in clips, resettable PTC, NTC/PTC/varistor, LDR, pin header,
                    screw terminal
  huellas.ts        tipoDeHuella(nombreKiCad, valor?) → { tipo, parametros } | null
motor/              soporte.ts (WebGL2 check without three.js), estudio.ts (lights, environment, contact shadow,
                    background), orbita.ts (Z-up orbit camera), visor.ts (Visor: render on demand, cutaway, caps,
                    explosion, HTML labels), placa.ts (piece of PCB from the footprint)
Vista3D.svelte      light wrapper: WebGL2 check, lazy import of Visor3D.svelte, failure → callback
Visor3D.svelte      canvas, label layer, toolbar (initial view, cut + plane slider + orientation, explosion,
                    labels); window.__epaVisor3d = { visor, datos } for the tests
Conmutador.svelte   «Animación | Pieza 3D»; compartir.svelte.ts: the remembered choice (store key `componentes-vista`) and
                    the context through which a scene shares its parameters (compartir3d)
escenas3d.ts        animation id → model options from the scene's shared parameters
catalogo3d.ts       MODELOS_3D (book labels, related animations, catalogue mounting), modelosDe(label)
Catalogo3D.svelte, Pagina3D.svelte, ControlesModelo.svelte, miniaturas.ts, VerEn3D.svelte
```

**Model contract** (what the board views rely on). Millimetres; origin at the centre of the footprint on the
board surface (z = 0), +Z up; orientation of the KiCad standard footprint with KiCad's y flipped: two-terminal
parts along X with pin 1 at −X; DIP/SOIC rows along Y with pin 1 at the top-left (−X, +Y); SOT-23 pins 1, 2 at −X
and 3 at +X; TO-92/TO-220 pins along X (1 at −X) with the marked face towards −Y; D-PAK leads at −X, tab at +X.
`group.userData` (DatosModelo): `tipo`, `parametros` (defaults merged), `huella` {`pads` [{n, x, y, forma, w, h,
taladro?}], `ancho`, `fondo`, `alto`, `origenKicad` = where KiCad's footprint origin is in model coordinates (pad 1
for most THT footprints): place with `position = P_kicad − R(θ)·origenKicad`}, `cortes` [{nombre, normal, min,
max, inicial}], `explosionable`, `montaje`, `marcado`, `triangulos`. Each part (child Group) carries DatosParte:
`parte`, `etiqueta` {texto, ref (refs.json label), punto (local mm)}, `explosion` [dx, dy, dz] mm at full
explosion, `interior` (label only when the inside is shown), `entero` (never clipped: dies, wires),
`colorCorte`. Every package that prints a part number (diodes, TO-92, TO-220, SOT-23, D-PAK, DIP/SOIC/QFP/QFN,
crystal, optocoupler) takes `parametros.marcado`: free text printed verbatim, fitted to the face («|» or a line
break separates lines; a long single line on a narrow face is split in two); `userData.marcado` returns what was
printed. Options: `recursos` (a shared `Recursos`: equal materials, markings and geometries are reused;
dispose once with `recursos.liberar()`), `detalle: 'bajo'` (fewer segments, no hidden interiors), `montaje:
'placa'` (default: THT leads cut 1 mm under a `grosorPlaca` board) or `'suelto'` (as delivered: LED anode longer,
electrolytic + longer), `marcas: 'alta' | 'baja'` (markings about 1024 px on their long side, ≤ 640 px/mm, crisp
when a 1 mm code fills a tablet; 'baja' = 64 px/mm, the default with `detalle: 'bajo'`, used by boards and
thumbnails). Keys: see `PAQUETES` (39 types).

**No shared faces (0.7).** Depth fighting showed on mobile GPUs and ANGLE-Metal (16/24-bit depth, polygonOffset
that differs between drivers): `crearModelo()` ends with `separarSolidos()` (comun.ts), which pulls every solid in
by a hair — each face moves inward by e = 0,004–0,05 mm with the model's size (≤ 5 % of the solid's thickness) —
and gives solids whose boxes end on the same plane on the same side different steps of e (1, 1,5, 2… × e, greedy
colouring), so touching faces and coplanar faces part; the geometry is untouched (shared through `Recursos`): the
mesh matrix or each instance matrix gets the scale about the geometry's box centre. Decals (`rotulo`) are lifted
by a real distance (max(0,01 mm, 0,4 % of the marking), no polygonOffset); the viewer's piece of board puts its
contact shadow and its pads at 1 and 2 × max(0,004 mm, 0,4 % of the model's radius) over the board (no
polygonOffset either). `node tests/modelos3d-auditoria.mjs [--solo tipo] [--detalle bajo]` builds every model
in Chromium (its own Vite server, no WebGL) and lists coplanar overlapping faces of different solids (closer
than 0,001 mm) and decals closer than 0,008 mm to their face; exit 1 when it finds any (0.6: 99 findings in 33
models; 0.7: none, in both detail levels).

**Viewer rules.** A frame is rendered only when the camera moves (inertia and animated resets included), the
explosion animates, or something changes (model, cut, theme, size); none while the page is hidden or the canvas
off screen. Device pixels ≤ 2× and ≈ 2 Mpx; MSAA only below 1,5× DPR. Lighting: hemisphere + key + fill
directional lights, a prefiltered `RoomEnvironment` (for the PBR metals), `NeutralToneMapping`; ground shadow =
one blurred texture on a plane (no shadow maps); background from the theme (`--fondo-3d`). Mounted parts stand on
a piece of board built from their footprint (`placa.ts`). Cutaway: one local clipping plane on the materials of
non-`entero` meshes; cut faces with the stencil buffer (the renderer is created with `stencil: true`): per
clipped closed solid, its clipped back faces increment and its front faces decrement the stencil (no colour, no
depth), then a quad on the plane in its cut colour is drawn where the count is not zero and resets it; outer
solids first (bounding-box volume, instanced pieces last), so the sections of the inner ones show on the outer
face (0.8.1; until 0.8.0 the back faces themselves were the cap, which showed inner solids in depth through the
cut, as an X-ray: the MLCC's electrodes, the film winding, the trimmer's track); a thin outline marks the plane; switching the cut on turns the camera to face the cut. Labels are HTML
(links to the book through `rutaDeRef`) placed in two columns that never overlap, with SVG leader lines; their
sizes are measured once (no layout per frame); a label keeps its column until its point is past the model's
centre by max(24 px, 6 % of the width) (hysteresis: the LDR's label flickered from side to side while turning).
On a viewer narrower than 560 px they become numbered markers on the model (pushed apart when closer than 24 px)
and the texts go to a numbered list under the canvas. Depth range: `Orbita.escena` (the sphere of everything
that can be drawn: model at full explosion, board, shadow) gives near/far around it on every camera move (far/near
≈ 2–4 instead of 6000: depth precision on 16-bit buffers), and `Orbita.solido` (the model at rest) is a sphere the
camera never enters (zooming in stops at its surface; panning still works). Gestures: `Orbita` listens on the
canvas's container (`zona`), so a drag or a pinch that starts on a label turns or zooms the model; the container
has `touch-action: none` and two-finger `touchstart`/`touchmove` are cancelled there (a pinch never zooms the
page; page zoom elsewhere is untouched); a drag that ends on a label does not follow its link. Cut faces: the
caps are drawn in a flat, unlit cut colour (the 0.7.0 screen-space hatching was dropped in 0.7.1: on small parts
it hid the inside); solids that sit inside others show as sections inside them (the SMD's substrate inside its
terminations). With the cut on, a label whose point lies on the removed side of the plane (most points are on
the front faces) points at the projection of that point on the plane, the part's cut face
(`Visor.anclaEtiqueta`, 0.8.1). Disposal:
model resources (`liberarModelo`), cap materials, board, studio, renderer and `forceContextLoss()` on unmount.

**0.8: adaptive resolution, shaders before the first frame.** (`motor/resolucion.ts`, used by `Visor` and by the
boards' `Escena3D`.) The MacBook Pro 2017 (Iris Plus 640, DPR 2) turned the SDR board at 44–46 fps with 2 ms of
CPU per frame: fill-rate bound. While the camera moves (`Orbita.ultimoCambio` within `REPOSO` = 180 ms, a camera
change since the last frame, inertia, animated resets, the board turn-over or the explosion) the interval between
frames is measured; when its time-weighted median over the last frames (4, or 2 slow ones adding up to 0,5 s)
exceeds 1,1 × 16,7 ms the pixel ratio becomes ratio · √(16,7 / interval) · 0,92 (at most one change per 250 ms,
never below half the full ratio nor 0,5), and it goes back up while moving only below 0,7 × 16,7 ms. The rest is
checked in an animation frame (pointer events come aligned with the frames, so a GPU stall is not taken for a
pause): then the full ratio returns with one final full-quality frame. A device that keeps 60 fps never changes
(the Android phones: 107–143 fps). `EstadoResolucion` {base, actual, minima, cambios, intervalo} is in
`__epa3d.resolucion` and `__epaPlaca3D.resolucion`; localStorage `epa-resolucion` = `fija` turns it off. Cheaper
materials for distant parts were considered and left out: switching materials while moving compiles new programs
at the first move (the stall the next point removes), and the frames are fill-rate bound, not shading bound.
Shaders: `ponerModelo()` compiles the programs of the first frame with `renderer.compileAsync()` (in parallel and
without blocking where KHR_parallel_shader_compile exists: WKWebView, Chromium on a GPU) before drawing it; the view
keeps its previous frame and Visor3D keeps «Preparando el modelo 3D…» (option `alPreparar`); `visor.preparacion`
{compilar, primerCuadro, programas, paralela}. The cut's clipping plane is on the materials only while the cut is on
(so, without it, the programs are those of the catalogue's thumbnails and of the boards — same lights, tone mapping
and output — which the GPU driver may already hold: WebKit's ANGLE/Metal and Chromium keep compiled programs per
source across WebGL contexts); 300 ms after the first frame the cut's variants (clipped materials and caps) are
compiled in the background. The boards' `Escena3D` compiles its own programs (core, faces, barrels, studio) the same
way before its first frame (`stats.compilarPlaca`, `stats.primerCuadroPlaca`), as `cargarPiezas()` already did for
the parts. Tests: `tests/rendimiento.spec.ts` (own config `playwright.rendimiento.config.ts`, port 4261: the drawing
buffer narrows while a synthetic drag turns the board and the LQFP, and is the full one again at rest).

**Pages.** `#/componentes` shows the animation gallery or, when the remembered choice is 3D, the catalogue;
`#/componentes/3d` the catalogue; `#/componentes/3d/<tipo>[?param=valor…]` one model with its controls. On an
animation page (component collection) the switch replaces the canvas scene by the model; the scene's controls
stay and drive it (`compartir3d(() => ({ … }))` in 23 scenes; `escenas3d.ts` maps the values), legend, plot and
playback are hidden. Without WebGL2 the page stays in 2D and says why. The reader's «Ver en 3D» (`VerEn3D.svelte`,
next to «Ver animación» in `Seccion`, `Figura`, `Bloques`) appears for the labels in `catalogo3d.ts`.
Tests: `tests/modelos3d.spec.ts` (`-c playwright.modelos3d.config.ts` serves its own build on :4193),
`tests/visor3d-tactil.spec.ts` (pinch on the model and on a label with CDP touch events: `visualViewport.scale`
stays 1 while the model's distance changes; the camera stays out of the model; far/near < 20; the LDR's label
changes side at most once over 120° in 2° steps; the SMD's cut draws its caps);
screenshots and contact sheets: `node tests/modelos3d-capturas.mjs --hoja --paginas`; frame cost while orbiting:
`node tests/modelos3d-rendimiento.mjs --perfil mac|tableta|movil|todos` (`window.__epa3d`: render and whole-frame
JS cost, triangles, draw calls). Budget: ≤ 17 000 triangles and ≤ 60 draw calls for the heaviest models (LQFP-64,
QFN with every bond wire); the 3D chunk (three.js, engine and models) is ≈ 590 kB, 147 kB gzip, loaded only
when a 3D view opens.

## Live figures (`web/src/componentes/figuras-vivas/`)

The interaction layer over the book's own figures, from «Datos de figuras». The figure SVG is shown unchanged
(as an `<img>`); every layer is stacked over it in its viewBox (`svg_vista`), so it scales with it.
- Integration: `Figura.svelte` asks `datosVivos(bloque)` (index.ts) and, for `grafica`/`esquema` figures with
  `datos`, renders `FiguraViva.svelte` instead of the zoom button. The figure is only an image until it comes
  within ~600 px of the viewport (`carga.svelte.ts`: one shared IntersectionObserver for «near» and one for
  «on screen», an LRU cache of 24 parsed data files); animations run only on screen, with the page visible and
  without reduced motion (then they start paused). A header row inside the plate has the label, «A|B» and
  «Abrir en grande»; a click outside the live regions opens the full-screen view too.
- `Escenario.svelte`: image + layers, optionally a crop of the picture (`imagen`). `CapaGraficas.svelte` (one
  hit region per plotting box, twins together, insets first; `grafica/lectura.ts`: readable series — curves of
  ≥ 3 points, single points, scatter, bars —, interpolation, nearest series, A/B values) and `CapaEsquema.svelte`.
- Plots: crosshair snapped to the nearest series, readout of every series at x (axis units through `factor_si`,
  SI prefixes, decimal comma, U+202F before the unit), click/tap pins it, arrows move it, A/B cursors per box
  with `TablaCursores.svelte`. Axes without numeric ticks give no values (qualitative sketches: no readout).
- Schematics (`esquema/`): `modelo.svelte.ts` (`EstadoEsquema`: SVG geometry of wires, nodes and current paths
  — every `tramo`, two-terminal parts start→end, other parts terminal→centre —, results at the time shown,
  hit testing), `particulas.ts` (one canvas over the drawings only, ≤ 420 particles per drawing, constant
  spacing on screen, speed ∝ log |I| over four decades, still and faint at zero current, conventional current
  amber / electrons blue), `color.ts` (diverging OKLab scale blue–grey–red, the same in every theme because the
  figure plate is light), halos multiplied under the black wires, `Ficha.svelte` (V, I, P, terminal currents,
  links to the component animation and its book section), `PanelEsquema.svelte` (play/pause, current or
  electrons, legend, time scrubber of the transient at 4 s per period with linked `Grafica` plots of the
  selected node/branch, sliders, assumptions, or why it cannot be simulated). The transient time drives the
  particles every frame and the colours and readouts at ~15 Hz.
- Sliders: `esquema/netlist.ts` is a port of `simular_esquema.py` (`netlist()`): with the book's values its text
  is identical to `simulacion.netlist` for all 31 simulable drawings (tested). `resimular.ts` runs it in the
  simulator's worker (`cliente.svelte.ts`) with `op` and the 5-period transient, and `resultado.ts` rebuilds
  `op`/`tran` like `collect()`.
- `Grande.svelte`: full-screen view (moved to `<body>`, an overlay of `ruta.svelte.ts` so «Atrás» closes it):
  zoom/pan of the live figure next to its controls, and a «Datos» tab with the curves in `componentes/grafica`.
- Simulator page: `circuito/CircuitoVivo.svelte` draws the circuit of the netlist above the results. The
  drawing is a `DibujoConNetlist` (tipos.ts): the book figure whose schematic `circuito/netlist.ts`
  `emparejar()` can match to the netlist (parts by designator or kind and value, pins by polarity, nodes one to
  one; 22 of the 65 netlists that cite a schematic figure), or else `generarDibujo(netlist)` from
  `componentes/esquema-auto/index.ts` when that module exists (same topology format plus its own SVG and the
  `Correspondencia` of nodes and pins). After each simulation of the page, `instrumentar()` re-runs the
  circuit without its analyses, with a 0 V source on every drawn pin (`op`, and the netlist's own `tran`, at
  most 20 000 steps, shown over the last two periods of a drawn PULSE/SIN source); wire currents come from
  Kirchhoff's law on the drawn wires (spanning tree rooted at a ground or rail symbol). Choosing a part dispatches the
  window event `epa:elegir-componente` (`detail.nombre`: netlist instance name) that the page uses to bring up
  its slider. The plate zooms (buttons, Ctrl + wheel, pinch) and pans by laying the drawing out larger, and
  passes the visible region to `CapaEsquema` (`visible`), whose canvas never exceeds it.
- Tests: `tests/figuras-vivas.spec.ts`; frame cost: `node tests/figuras-vivas.mjs --perfil mac|tableta|movil`
  (reads `window.__epaFiguras`, kept by `CapaEsquema.svelte`).

## Automatic schematics (`web/src/componentes/esquema-auto/`)

The circuit of any netlist drawn from the netlist itself (the 231 book netlists without a drawn schematic, «Nuevo
circuito», edited netlists), in the book's style (schemdraw look of figure 11.3: IEC resistors, `Inductor2`
loops, circled sources and transistors, three-bar grounds, T-bar supplies, junction dots, Source Sans 3).
Plain TypeScript without DOM (runs in a worker and in Node); the view is Svelte.

```
modelo.ts      netlist → circuit: devices with typed terminals (lineasNetlist() of simulador/motor/netlist.ts,
               additive export), .model kinds (D/Zener/LED/Schottky by name or BV/N/IS, NPN/PNP, NMOS/PMOS,
               NJF/PJF), subcircuits (op-amps recognised by name or ports inp/inn/out[/vp/vn] → triangle; logic
               subcircuits and XSPICE d_* gates → IEC boxes &, ≥1, =1, 1; flip-flops with T/D/C/S/R/Q/nQ),
               E with gain ≥ 1000 and out− on ground → op-amp, other E/G/F/H/B → diamond with the control in
               the label, K → one transformer block (coils stay elements), 4 diodes forming a full-wave bridge
               → diamond block (not when each diode is across a switch: an H bridge's freewheeling diodes stay
               separate), T/O/U lines, S/W switches, A devices (XSPICE NULL ports left out). Values with
               SI prefixes and decimal comma (formatoCorto); a constant expression in braces or quotes
               («{30e-6/0.058737}»: numbers, + − * / ^ **, parentheses; `constanteSpice()`) reads as its value
               («511 µF»), one with parameters or functions stays as written; sources show DC, «∿ amplitude · f»,
               PULSE «v1/v2 · f».
               Supply rails: a DC source from a net to ground named like a supply (vcc, vdd, vee, v5…) or feeding
               ≥ 3 other pins; it is drawn apart (source + rail + ground) and every pin on the rail gets a
               rail symbol (positive up, negative down). Ground is always a local symbol.
simbolos.ts    symbol library: local geometry (y down, pins on the integer grid, two-terminal parts 2 units
               long), leads, body box, label anchor, allowed orientations with their cost.
colocacion.ts  one connected circuit (nets other than ground/rails): units (a part, a port/terminal marker),
               their variants (orientation × mirror, precomputed pins, clearance boxes, label box, ground and
               supply stubs), and the placement by simulated annealing (moves: shift, re-orient, align a pin on
               a pin of its net, swap) with an incremental cost: rectilinear MST per net + bends + pins left
               backwards, crossings of L-shaped estimates, wires through bodies or labels, orientation costs
               (sources upright with + up, grounds down, positive rails up, NPN collector up / PNP emitter up),
               signal flow left → right (BFS rank from the sources), compactness. Hard constraints: no
               overlap of bodies (0,4 clearance), labels or stubs; pins only meet pins of their net. Then empty
               rows/columns are closed (compactar).
rutas.ts       orthogonal router on the unit grid: Steiner tree per net (Dijkstra from the drawn tree to the
               nearest pin; length, bends, crossings, label and next-to-wire costs); no overlaps, no touching
               another net except a straight right-angle crossing, no passing through pins or bodies. A pin that
               cannot be reached sensibly gets a net label (stub + name) instead. Optional: nets labelled at
               every pin, single pins labelled while the rest of their net is wired.
plantillas.ts  topologies recognised by structure → `Reglas` (colocacion.ts): orientation wishes folded into
               the variants' costs (a pass transistor gets horizontal variants), soft constraints between units
               (`orden`: coord(a) + min ≤ coord(b); `alin`: equal coordinate; refs = a pin or the body's centre
               or edges), per-unit flow rank, rows and an anchored start for the layered/low-temperature run,
               nets or pins drawn as labels. Families: H bridge (four switches T–a, T–b, a–B, b–B with a series
               load from a to b; anchored H), buck/boost (an inductor whose switch node has a switch/diode to
               ground, maybe with an ammeter, and a series switch; buck when that switch comes from a voltage
               source/rail or a transformer, boost the other way), Wien (op-amp with R ∥ C to ground on + and a
               series R–C to the output side), series regulators (BJT/MOS between an input — source, rail,
               ammeter, `in` port — and a load, with a Zener or an op-amp with a DC reference; Darlington driver
               and current-limit transistor), adjustable regulators (a DEPV equal to v(adj) + k over a divider),
               logic (six or more gates/flip-flops besides XSPICE bridges: depth columns, rows by chain, clock
               and enable nets from a source or ADC bridge with ≥ 4 inputs and far inputs as labels),
               rectifiers (a diode bridge, or diodes from the AC side — a sine source or transformer, maybe
               through series parts — into a node with a capacitor: source upright on the left with its
               series parts and shunts on the AC wires, bridge with the AC corners top/bottom and + right,
               filter capacitor then load hanging from + on the right; a bridge − that is not ground is joined
               by a net label, since source, bridge and load form a K4 that cannot be drawn without a crossing;
               half-wave diode horizontal, centre-tap diodes on two rows with their cathodes in one column),
               and, only when nothing else is recognised, ladders of parallel cells (two or more R/C/L across
               the same two nets, cells joined in series by nets nothing else touches: a capacitor bank with its
               leakage and balancing resistors, a compensated probe, a Foster thermal network): a chain of one
               or two cells ending at ground is a vertical stack (cells side by side, part j of every cell in
               column j, labels to the right, stacks fed from one net side by side with their tops on one row),
               a longer one a row of horizontal cells (first part on the main row with its label above, the
               last part's label below) with its ground cell hanging upright on the right; the source that feeds
               the chain from ground stands on its left; anchored start for all of it.
               The recognisers run once per circuit structure (cache in generar.ts: the rules, the variants they
               added and every variant's cost).
generar.ts     whole netlist: components → placement (best of several runs by routed score: length, bends,
               crossings, labels) → shelf packing to a target aspect ratio → net-label texts and small net-name
               tags placed where they collide with nothing → topology. With recognised topologies the runs are
               ranked by crossings + fallback labels first, then by score + 2 × rule cost, and the families
               are part of the cache key; every run is also charged 25 per fallback label and 10 per crossing
               on top of its score (a run that trades crossings for labels must gain more than wire). The
               precomputation (effort > 1) makes effort + 1 more runs, and 5 more with a recognised topology. Several components that are all rectifiers are packed in a grid of
               equal cells in netlist order (columns chosen for the target aspect). After routing, a part label
               closer than HOLGURA_ETIQUETA (0,15) to any wire moves to the nearest free place around its symbol
               (beside, above, below, shifted, a little further out, corners; also as two lines «R1» / «10 kΩ»)
               with the largest clearance; `UnidadDibujada.etq` holds it in world coordinates (`etiquetaMundo`).
               Live layout (effort ≤ 1, an edited netlist): annealing runs capped at 12 000 iterations that stop
               after 20 % of them without improvement, the topology's own start (anchored or rows) first, no
               extra runs for recognised topologies and no more runs once one has no crossing, no fallback label
               and no rule left unmet; incremental rule costs. Layouts are kept per circuit structure
               (kinds, pin-net pattern, name lengths; values never matter: label widths reserve «8,88 k»), so a
               slider move redraws the same layout at once; precalculado.json holds the layouts of every book
               netlist computed at high effort (scripts/esquema-auto-precalcular.mjs; a stale entry that no
               longer fits is simply recomputed).
               0.8: the same layouts about twice as fast (Node, the four netlists of the diagnostic: sum of
               medians 685 → 341 ms of CPU; every one of the 313 live layouts identical bit for bit to 0.7.1):
               Colocador keeps its cost terms in flat typed arrays (per net its estimated wires, box and cost,
               current and pending, swapped on accept; hits per net × unit; crossings per net × net), a move
               allocates nothing, box tests are inline, the unit cost is cached per variant; the router keeps its
               search targets in a stamped Int32Array (a Map lookup per neighbour was its hottest line) and pops
               without an array; symbol definitions are shared by a unit's variants, label widths and character
               widths are memoised; the winning run is not routed a second time. Edited circuits (0.8): the last
               six layouts are kept by part (designator, symbol, pin count); a live component sharing ≥ 60 % of
               its parts (and three) with one of them first runs from it (`Colocador.inicialDesde`: old parts in
               their places when still valid, new ones at the nearest free spot by their neighbours, one run of
               40 % of the iterations at T0 = 0,6); a flawless result ends there, otherwise it competes with the
               usual runs (`estadisticas.recolocadas`). Benchmark (one resistor added in parallel to a part of
               each of the 173 book netlists with ≥ 8 units): CPU 4985 → 3068 ms, parts in place up to a common
               shift 49 → 59 %, crossings 28 → 32, net labels 17 → 14, length 5755 → 5829, bends 828 → 843.
svg.ts         SVG: palette «libro» (book colours, for the light figure plate, fonts embedded at /*@fuentes*/)
               or «tema» (CSS variables, inline, data-el/data-disp attributes and hit areas).
trabajador.ts  Web Worker (sequential queue; loads precalculado.json). index.ts: client, LRU of 16 results.
editable.ts    the layout as plain editable data (parts with orientation and variant, wires with their net,
               ground/supply/label symbols) for the schematic editor; reads generar.ts, changes nothing.
EsquemaAuto.svelte  inline themed viewer: pan (drag when zoomed, wheel), zoom (buttons 44 px, Ctrl/⌘ + wheel,
               trackpad/touch pinch, + − 0 keys), click/tap on a part → `alElegir` and window event
               `epa:elegir-componente` {nombre}; subcircuit interiors on request. Interiores.svelte: «Ver el
               interior de X» buttons under the live drawing.
```

Contracts (looked up lazily by the other modules):
- `generarDibujo(netlist): Promise<DibujoConNetlist | null>` (figuras-vivas `tipos.ts`): `origen: 'auto'`, `svg`
  (book palette, fonts embedded), `vista` [0, 0, W, H], `esquemas: [Esquema]`, `correspondencia: [{ nodos: Nk →
  netlist node, elementos: Ek → { nombre, pines: terminal → index on the netlist line } }]`.
- `esquemaDeNetlist(netlist): Promise<Esquema | null>` (instrument bench), `esquemaAutomatico(netlist, { subckt })`
  → `ResultadoEsquema` (both SVGs, topology, mapping, `flujo`, statistics, subcircuits, unreadable lines).

Topology («Datos de figuras» format, drawing units y up, `dibujo_a_svg` = 24 SVG units per unit, `eje: -1`):
every part is an element with the book's `clase`/`rol` (R C L V VSIN VPULSE V? I D DZ LED QN QP MN MP JN JP DEP SW
OA X, plus `K` coupling, `TL` line), `designador` = netlist name, `anclas` = its pins, `terminales` → nodes,
`polaridad`. SPICE pin order maps to terminals as: R C L D S W I G F `start`=n1/n+, `end`=n2/n−; V E H B(V)
`end`=n+ (schemdraw puts «+» at `end`), `start`=n−; Q collector/base/emitter; M drain/gate/source(/bulk when not
on the source); J drain/gate/source; op-amps in1 (−), in2 (+), out, vd, vs; boxes p1…pn; bridge diodes
start = anode, end = cathode at the diamond's corners. Ground symbols are `GND` elements on `N0`, rail symbols
`RAIL` elements on the rail's node, junction dots and net labels `DOT` elements, ports/terminal markers `DOT`
(`clase: 'Terminal'`). Nodes `N1…` in order of first appearance carry the netlist name in `etiquetas`; one node
may be drawn in several pieces (rails, labels). Every wire run between attachment points is a `tramo` (also
the leads of ground/rail symbols and net labels); `flujo[tramo]` lists the terminal currents whose sum is its
current from `de` to `a` (the side without a ground, rail or label symbol).

Checks: `node tests/esquema-auto.mjs [--hojas] [--en-vivo] [--esfuerzo k] [--solo texto]` lays out all 313
netlists, checks every device and node drawn, topology consistency, overlaps and the label–wire clearance
(≥ 0,15 for every part label; prints how many labels were moved), prints crossings, labels,
lengths and times, and with `--hojas` writes contact sheets to `tests/capturas/esquema-auto/`. Totals of the
book (0.7, precomputed): 313 netlists, 0 failures, 21 crossings, 101 net labels (11 of them the cap50 rectifier's,
kept on purpose), wire length 5689, 588 bends (0.6: 21, 101, 5727, 591).
`tests/esquema-auto.spec.ts` covers the page (auto drawing under the live layer, XSPICE drawing, zoom, click →
slider, subcircuit interior, «Nuevo circuito») and the screenshots.

## Schematic editor (`web/src/componentes/editor/`, phase 5)

Draw a circuit with the book's symbols and simulate it without writing a netlist; open any netlist (the
book's, the free one, a `.cir` file) as an editable drawing. A tab of «Simulador» (no rail entry), loaded as
its own chunk only when opened (`Simulador.svelte` imports `editor/EditorEsquemas.svelte` on demand).

Routes (`ruta.svelte.ts`: view `simulador`, `ruta.sim = 'editor…'`): `#/editor` (the working draft),
`#/editor/<id>` (a saved circuit, saved by itself on every change), `#/editor/libro/<parte>/<nombre>` (a book
netlist laid out as a drawing; the address becomes `#/editor`), `#/editor/importar` (a netlist text handed
over by the simulator page in `sessionStorage`). `#/simulador/esquema` is the simulator page of the netlist
generated by the editor («Ver como netlist», with «Volver al esquema»). The simulator page of every netlist
has «Editar el esquema»; `PestanasSimulador.svelte` holds the three tabs (book netlists, free netlist, editor).

```
tipos.ts          DocumentoEsquema: titulo, componentes, cables, analisis (.op/.tran/.ac/.dc settings),
                  directivas (verbatim netlist text: .model, .subckt, .param, .meas, .control…), origen
catalogo.ts       palette kinds (TIPOS): name, group, designator prefix, topology role, fields (value with unit,
                  model, option, net name, PWL points, SPICE text), initial values and orientation; symbols
                  from esquema-auto/simbolos.ts (simboloDe) plus the editor's own in the same style (ground,
                  supply, net label, potentiometer, 4-pin E/G sources, probe, meters); value text of labels
geometria.ts      placed geometry: pins, body, hit box, SVG paths (24 px per unit) cached per shape and
                  orientation (orientation codes of esquema-auto: bit 2 mirrors, then quarter turns)
rotulos.ts        part labels «R₁ 4,7 kΩ» placed by anchor (start/middle/end) on the side the symbol says
conectividad.ts   nets: pins and wire ends meeting at a point, a wire end on another wire (T, junction dot);
                  crossing wires and a pin on the inside of a wire do not connect; labels/supplies of the
                  same name join; every ground is 0. Names: 0, label, the node name kept by imported wires
                  (Cable.red), n1, n2…; loose pins and wire ends are marked
                  Digital group (0.8, XSPICE): AND/OR/NAND/NOR/XOR gates and NOT (IEC boxes of esquema-auto,
                  pins a, b → y; field «retardo»), D and JK flip-flops (boxes with D/J/K, C, S, R, Q, nQ;
                  «retardo» = clk_delay, «ic»), ADC and DAC bridges (in → out; thresholds / levels / edge time),
                  digital clock (d_osc tied to ground, frequency and duty cycle; starts at 0)
netlist.ts        drawing → netlist: one line per part (instance = designator, with the element letter in
                  front when missing), library models used and not defined in the directives, directives,
                  analyses; probes (v(net), ammeter i(v…), differential voltmeter B source) choose the plotted
                  vectors; checks in plain Spanish (missing ground, values, models, names, loose pins).
                  Digital parts: `A<designator>` lines (`[a b] y`, flip-flop pins in XSPICE order with NULL for
                  an unconnected S/R) and one `.model a<designator>_mod d_and(…)` per part; a probe on a digital
                  net is an error (it has no voltage: put a DAC bridge in between)
modelos.ts        the palette's models, as in the book's netlists: 1N4148, 1N4007, Schottky, red/green LED,
                  Zener 5,1/5,6/12 V, 2N3904, 2N3906, power NPN/PNP, level-1 MOSFETs, JFETs, op-amps
                  (opamp: A0 1e5, 10 Hz pole, ±14 V; op741; opa5 with supply pins)
valores.ts        Spanish values «4,7k», «4k7», «100n», «2,2M», «1meg», «{expr}» ↔ SPICE («M» is mega)
importar.ts       netlist → drawing: esquema-auto's layout (precalculado.json for the book) in a worker
                  (trabajador.ts → esquema-auto/editable.ts) turned into parts and wires; R/C/L, sources (DC,
                  SIN, PULSE, PWL, AC; otherwise «Texto SPICE»), diodes, BJTs, MOSFETs (bulk on source),
                  JFETs become palette parts; anything else (subcircuits, op-amps, E/G/F/H/B, switches,
                  transformers with their K lines, diode bridges) stays a GEN part with its SPICE line;
                  every other line goes to the directives. Regenerating gives an equivalent netlist (tested:
                  same measurements as the text)
estado.svelte.ts  Editor: document, selection, tool, undo/redo (snapshots), place, move (attached wires
                  stretch into L shapes), rotate/mirror about the selection's centre, copy/paste, delete
Lienzo.svelte     SVG canvas, pointer events for mouse, pen and touch (see below); window.__epaEditor for tests
Paleta.svelte, Propiedades.svelte, MisCircuitos.svelte, EditorEsquemas.svelte (page, keys, menus, analyses,
                  results, netlist and directives views, import/export)
vivo.ts           the drawing as a figuras-vivas DibujoConNetlist (topology in drawing units y up, mapping to the
                  generated netlist, book-palette SVG from svg.ts), so VistaViva.svelte reuses EstadoEsquema,
                  Escenario/CapaEsquema, PanelEsquema and instrumentar()/resultados() of the simulator page:
                  node colours, currents and particles of the transient, plus tags with every node voltage
                  and every two-terminal current (anchor «valor»: the side opposite to the label)
circuitos.svelte.ts  storage (below), draft, hand-overs
```

Gestures: tap/click a palette part then the canvas (or drag it onto the canvas); drag from a pin draws an L
wire (the first leg follows the pin), the wire tool also draws tap by tap; drag a part or wire to move the
selection; mouse drag on empty space = box selection, finger drag = pan; middle button or Space + drag =
pan; as in the 3D viewer, a plain wheel scrolls the page (never trapped: the page is not full height),
Ctrl/⌘ + wheel and pinch (touch, or trackpad = ctrl+wheel) zoom, Shift + wheel or a sideways trackpad swipe
pans horizontally (hint line at the bottom of the canvas); long press (touch) or right click = context
menu; double tap/click = properties. The canvas has `touch-action: none` and cancels touchstart/touchmove and
Safari gesture events, so a pinch never zooms the page (tested with CDP touch events: visualViewport.scale
stays 1). Keys: R rotate, X/M mirror, Supr/Retroceso delete, Ctrl Z / Ctrl Y (Ctrl Mayús Z), Ctrl C/X/V/D/A,
Ctrl S save, W wire, S/V select, G ground, F/0 fit, + − zoom, Esc cancel.

Storage: `obtenerAlmacen()` key **`editor-circuitos`** = `{ version: 1, circuitos: { [id]: { id, nombre, creado,
actualizado, borrado?, doc } } }` (times in ms; delete keeps a tombstone with `borrado` and an empty drawing,
for syncing). The unsaved draft is `localStorage` `epa:editor-borrador`; an unsaved draft with parts is kept in
«Mis circuitos» before an import replaces it. Export: `.cir` (the generated netlist) and SVG (book palette,
fonts embedded); on phones through the share sheet when available. Import: `.cir/.net/.sp/.txt`.

Tests: `tests/editor.spec.ts` (`playwright.editor.config.ts`, port 4201): mouse and touch drawing, .op and
.tran against hand calculations, undo/redo, pinch, save/reload/rename/delete, two book rectifiers drawn give
the same measurements as their text, .cir round trip, «Ver como netlist», screenshots in
`tests/capturas/editor/`. `node tests/editor-rendimiento.mjs` times pointer moves with ~80 parts (Mac profile,
CPU ×4). `tests/xspice.spec.ts` (`playwright.xspice.config.ts`, port 4251) builds a digital circuit from the
palette's parts (clock → toggling D flip-flop, pulse → ADC → NOT → DAC) through `__epaEditor.pines()` and checks
its simulation; it also runs the book's four XSPICE netlists in the browser against the book's values and the
fallback engine's «no se puede simular».

## Consoles (`web/src/componentes/consolas/`, data in `web/public/consolas/`)

Three linked views of six mainboards: the two photographed in printed chapter 36 (figures 36.16 and 36.22), the NES
NES-CPU-07 and the first Neo Geo AES board (NEO-AES), plus the Master System II (171-5922A), Mega Drive (model 1
VA6), Game Boy (DMG-CPU-05/06 + DMG-LCD-06) and Game Boy Color (CGB-CPU-04). `IDS_MAQUINA` in `datos.ts` lists them.
Route `#/consolas/<nes|neogeo|sms|megadrive|gb|gbc>/<foto|arquitectura|esquema|placa3d|placa2d|fuentes>[/<sel>]`
(`Vista` includes `'consolas'`); `<sel>` is a schematic reference (`U6`), `red:<net>`, `bloque:<id>` or `foto:<id>`,
URI-encoded. Selections made inside a tab only replace the URL; the cross links («Ver en el esquema»…) push it.
The reader shows «Explorar la placa» under both photos (`VerConsola.svelte`, labels `fig-37.16`/`fig-37.22`).

**Pipeline.** `contenido/consolas.py` (called by `generar.py`, or alone) reads the research folder
`/home/claude/consolas` (env `CONSOLAS_FUENTES`): KiCad 7 copies of OpenTendo NES-CPU-11 and Board-Folk
NeoGeoAES-3.5, their kicad-cli netlists (`*.nets.json`), bus groups (`*.buses.json`) and SVG exports. Modules:
`consolas_kicad.py` (s-expression reader; symbols with KiCad's TRANSFORM, pins from `lib_symbols`, wires, junctions,
labels, power symbols, hierarchical labels ↔ sheet pins, bus labels; union-find connectivity mapped to netlist
nets through the pins), `consolas_svg.py` (SVG → compact layers), `consolas_datos.py` (photo hotspots, bus group
names, chip equivalences, sources). The build fails if a geometric group holds pins of two nets, a netlist net has no
geometry, or a `.kicad_sch` wire is not a wire of the SVG (currently 0 / 0 / 0 on both machines).

The four newer machines (entries of `MAQUINAS` in `consolas.py`, hotspots and texts in `consolas_datos2.py`):
- `sms`: `sms/sms2/transcripcion.py` is a hand transcription of Sega's 171-5922A service-manual sheets (components,
  pins with number, name and net; `DUDAS` lists uncertain readings, shown in «Fuentes»).
  `tools/sms2_kicad.py <transcripcion.py> <kicad7 dir>` writes a label-style KiCad 7 project (root + `hoja1..3`,
  checks pin counts and single-pin nets), then kicad-cli exports netlist/SVG/PDF as for the other machines.
- `megadrive`: stonedDiscord's KiCad. The photo field `pcb` {huellas, mm, px, escala} projects every footprint onto
  the photo (`posiciones`), so a component without a hotspot gets a cross marker (`.marcador`). The main PAL VA6.8
  photo is taken at an angle: `pcb.ajuste` names `megadrive/pcb/VA6.8_ajuste.json` (homography H plus a quadratic
  correction C fitted to 18 control points, which it also stores) instead of scale + offset. Hotspot ids are unique
  across a machine's photos (the US VA6 ones carry `u-`).
- `gb`: Gekkio's DMG-CPU-06 plus the DMG-LCD-06 board (`placas_extra`: references prefixed `LCD-`, nets
  `/DMG-LCD-06/...`); pins of type `no_connect` are skipped in connectivity. Gekkio's trace SVG becomes
  `gb/trazas-<foto>.json` {redes: {net: [path d]}} (`consolas_fotos.trazas`), lazy-loaded by `cargarTrazas()`.
- `gbc`: no KiCad source is published, so `tools/pdf2kicadnet.py` rebuilds nets and geometry from Natalie the
  Nerd's KiCad 9 PDF (wire popups «Net =», «Reference =» popups, pin numbers/names by plot colour, hierarchy
  via Dest links) into `gbc/cgb04/CGB_CPU04.{nets,geom}.json`; `consolas_pdf.py` turns the PDF drawing into CSG1
  layers. `comparar_cgb` checks it against opengbc (written into `equivalencias`).

New optional fields of `<maquina>.json`: `fotos` [{id, titulo, src, ancho, alto, credito, revision, nota, hotspots,
posiciones {ref: [x, y]}, posiciones_nota, trazas (file), trazas_redes [net names]}] (extra photos; the main one stays
in `foto`/`hotspots`, and `foto` accepts the same optional fields), `revisiones` [{vista, revision, fuente}], `equivalencias_cabecera` (column titles), `citas`
(legend of the citation keys), `notas` [{ref, pin?, texto}].

**Files** (≈ 4,9 MB in all for the six machines; each is fetched only when opened):
- `<maquina>.json`: `foto` {src, ancho, alto, figura}; `hotspots` [{id, nombre, pieza (marking read on the photo),
  esquema [refs], bloque (diagram block), cajas [[x0,y0,x1,y1]] in photo pixels, confianza `marca|posicion`, buses
  [group keys], funcion}]; `grupos` {key: Spanish name}; `hojas` [{id, nombre, ruta, archivo, ancho, alto (mm), padre}];
  `componentes` {ref: {v value, l symbol, h [sheets], f hotspot}}; `redes` [{n KiCad name, g group, nodos
  [[ref, pin, function]], h [sheets]}] sorted by name (the index is the net id used by the sheet files);
  `equivalencias` [{foto, esquema, senales, cambios, fuente}] (photo chip → AES3-5 chip, with page citations) and
  `fuentes` (credits, licences). Neo Geo hotspots may carry `verificacion` (what was checked against SNK documents
  and where). Citation keys (in `consolas_datos.py`): `MV4 h.N` = MVS MV4 schematic sheet N (1st-generation chipset,
  as on the photographed NEO-AES), `AES h.N` = SNK «NEOGEO-2» AES sheet N (2nd generation, same U1–U39 as
  Board-Folk), `MV4F h.N` = MVS MV4F (2nd generation), `NG Hw-N` = SNK hardware specification page «Hardware-N».
  The documents themselves are copyrighted and are not in the repo; renders for the owner are kept in
  `/home/claude/consolas/neogeo/referencias/`.
- `<maquina>/hoja-N.bin` «CSG1»: `'CSG1' u16 n_layers u16 0 f32 w_mm f32 h_mm`, then per layer `u8 role, u8 flags
  (1 fill, 2 text strokes), u16 0, f32 stroke mm, u32 n_polylines, u32 n_circles, u32 n_bytes` and zigzag varints
  in 0,01 mm: polylines `n, x0, y0` (delta from the previous start) then point deltas; circles `cx, cy` (delta), `r`.
  Roles come from KiCad's plot colours: 1 symbol, 2 body fill, 3 wire, 4 bus, 5 label text, 6 fields, 7 pin
  numbers, 8 sheet, 9 notes, 10 black, 11 other.
- `<maquina>/hoja-N.json` (0,01 mm): `hilos` [net, x1, y1, x2, y2]…, `uniones` [net, x, y]…, `pines` [[net, ref,
  pin, name, x, y (connection point), x2, y2]], `etiquetas` [[net (−1 bus label), kind local|global|hier|pwr|bus,
  text, x0, y0, x1, y1]] (approximate boxes for hit testing), `simbolos` [[ref, box]], `buses` [x1, y1, x2, y2]…,
  `subhojas` [[sheet, name, x, y, w, h, [[net, pin, x, y]]]].

**Views.** `Foto.svelte` (SVG overlay on the photo; nearest hotspot within 22 px on touch; list of parts),
`esquema/` (`dibujo.ts` decodes CSG1 into one Path2D per layer and 8 × 8 tile, culls tiles, skips text under
~2,6 px; `capa.ts` hit tests and draws the highlighted net; `Lienzo.svelte` pan/zoom on demand without an
animation loop, exposes `__epaEsquema` and `__epaEsquemaVista` for tests), `arquitectura/` (`modelo.ts`: scenarios
as signal transition lists in real seconds, sampled by binary search; `nes.ts`, `neogeo.ts`, `sms.ts`,
`megadrive.ts`, `gb.ts`, `gbc.ts`: diagram, address decoder, scenarios with the documented timings, loaded lazily by
`maquinas.ts`; `z80.ts` holds the Z80 machine cycles shared by the SMS and the Mega Drive. A `Maquina` may add
`interior` (second diagram layer, the GB «Dentro del SoC»), `espacios` (address spaces for the decoder: memory/I/O,
68000/Z80), `notaDecodificador` and `variantes` + `diagramaDe` (machine-wide variant passed to every scenario as
`op.norma` and shown as a toggle «Norma de vídeo»: the Mega Drive's PAL default and NTSC clocks); `dibujo.ts` draws the diagram in the shared `Escena`;
`Analizador.svelte` is the logic-analyser view). Tests: `tests/consolas.spec.ts`.

### Console boards in 3D and 2D (`consolas/placa/`, data in `web/public/consolas/placas/`)

Tabs `placa3d` and `placa2d`, only for the machines listed in `placa/datos.ts → PLACAS_DE` (NES, 0.8; Mega Drive; Neo Geo, 0.8; Game Boy
Color with two boards, the choice kept in `placa/eleccion.svelte.ts`). `PlacaConsola.svelte` mounts the «Proyectos
KiCad» components unchanged (`proyectos/Vista3D.svelte`, `Placa2D.svelte`, `geometria.ts`, `seleccion.ts`,
`opciones3d.svelte.ts`; without WebGL2 the 3D tab shows the 2D view) and translates the selection: a schematic
reference → the footprint with that reference, a schematic net → the board net mapped to it, a board part or pad →
the reference, a board net → its schematic net. Boards with `consola.enlazada: false` (OpenGBC) take no selection
from the other tabs. The schematic offers «Ver en la placa» for parts and nets when the machine has a linked board;
`placa/PlacaFuentes.svelte` adds the boards' credits to «Fuentes».

**Pipeline** (`contenido/consolas_pcb.py`, run by hand; sources read from `CONSOLAS_FUENTES`, never copied):
- KiCad 8 board of the NES (0.8): OpenTendo v1.4 `Board Files/Motherboard.kicad_pcb` (TAPR OHL 1.0, commit 3bd0b0b,
  copied into `CONSOLAS_FUENTES/nes/original/OpenTendo/Board Files/`), the same references and net names as the
  NES-CPU-11 schematic (98 references and 567 pads agree, 2 pads on another net). Its Edge.Cuts arcs miss the lines
  they meet by 1–4 µm: `soldar_bordes` (config `soldar_bordes: 0.005` mm) joins them before `outline`.
  `python3 contenido/consolas_pcb.py nes` rebuilds only that board.
- KiCad 9 boards (stonedDiscord MegaDrive, whatware OpenGBC) through `proyectos_kicad_pcb.read_board` (outline,
  footprints, pads, tracks, vias, zone fills, rule areas) and `model_for` (plus heights for the consoles' own
  packages; logos, fiducials and net ties get no body). kicad-cli 7 cannot open KiCad 9 boards, so every silkscreen
  item (footprint graphics and texts in board coordinates, footprint texts «keep upright» as KiCad draws them,
  board graphics and texts) is copied into a minimal KiCad 7 board that `kicad-cli pcb export svg` plots per side
  (cached in `contenido/.cache/consolas_pcb/`), read with `proyectos_kicad.silk_layer`.
- Gerber-only board (Natalie the Nerd's CGB-CPU-04, 4 layers) through `contenido/consolas_gerber.py`: RS-274X with
  KiCad's X2 attributes (`TO.N` net, `TO.C`/`TO.P` reference, pin and pin function, `TA.AperFunction`), apertures
  C/R/O/P and macros (KiCad's RoundRect and FreePoly), arcs, regions, polarity, and the Excellon drill files (holes
  and routed slots). Flashes with a pin become pads (merged across faces; RoundRect → `rr` with its rotation; a
  custom shape → its exact copper as a zone plus a mask-only pad), via pads and via drills → `vias`, other flashes
  and regions → `zonas`, strokes → `pistas`; mask flashes set the pads' mask flags; unplated holes become
  mechanical footprints `H<n>`. Pads are grouped by reference into mechanical footprints (`t: 'mec'`, box around
  the pads, no 3D body). Inner layers In1/In2 hold only the rings of the drills and are not drawn.
- Board-Folk's Neo Geo NEO-AES3-5 (KiCad 10, public domain per its README; the 53 MB `.kicad_pcb` is not kept: its
  path comes from `CONSOLAS_PCB_NEOGEO`, see `fuente_de(cfg)` → env `CONSOLAS_PCB_<ID>`). KiCad 10 names nets inside
  segments, vias, zones and pads (`(net "name")` instead of a number): `proyectos_kicad_pcb.net_id` maps both forms.
  `fusionar_colineales` merges collinear consecutive track segments of the KiCad boards (Neo Geo 18 210 → 15 212).
  `main(ids)` rebuilds only the boards whose sources are found and keeps the other entries of `indice.json` and
  their files.
- Checks against the console's own `<maquina>.json`: references on both sides, every pad's net against the
  schematic's (board net → schematic net by majority of its pads), and for the Gerber board the two-pin parts whose
  pins 1 and 2 are swapped between the PDF reconstruction and the copper.

**Files**: `indice.json` `{version, placas: [{id, maquina, titulo, corto, enlazada, tipo kicad|gerber, aviso, fuente
{titulo, autor, url, licencia, uso}, ancho, alto (mm), capas, componentes, redes, bytes}]}` and `<placa>.json`: the
`DatosPlaca` of «Proyectos KiCad» (`esquema` empty, `simulacion: null`, `comprobaciones` = the checks above) plus
`consola {maquina, enlazada, aviso, fuente, redes {board net: schematic net}, refs [references also in the
schematic], capas_cobre ['F', 'In1', 'In2', 'B'], tipo}`. Sizes: megadrive 840 kB, neogeo 1064 kB (272 kB gzip;
320 footprints, 2287 pads, 631 nets, 1498 vias, 107 zones; 317/317 references and 2265 pads on the same net as the
schematic), gbc-cgb04 290 kB, gbc-opengbc 240 kB. Tests: `tests/consolas-placas.spec.ts`.

### «Un fotograma» (`consolas/fotograma/`, data in `web/public/consolas/fotograma/`, pipeline in `contenido/fotograma/`)

Tab `fotograma` («Un fotograma», 0.8), for every machine with an adapter file `fotograma/maquinas/<maquina>.ts`
(found with `import.meta.glob`, so each console adds its own; `maquinas.ts → tieneFotograma`). It replays, from a
cycle-level trace recorded offline, how the signals travel from reading the program's code to a finished frame, and
draws that journey on the schematic, on the board (2D) and, for the Game Boy, on the scanned copper. This section
documents the framework and NES / Game Boy / Game Boy Color; the Master System II, Mega Drive and Neo Geo use the same
framework (see their own notes below or in their adapters).

**Programs** (`<maquina>/indice.json {version, programas: [{id, titulo, tipo demo|juego, archivo, bytes, resumen,
juego? {nombre, autor, licencia, url, commit, licenciaTexto}, norma? pal|ntsc}]}`):
- «Paso a paso» (`demo`): a short program written for the app, `contenido/consolas_demos/<maquina>/` — `nes/demo.s`
  (ca65/ld65, `nes.cfg`, NROM-128), `gb/demo.asm` and `gbc/demo.asm` (rgbds; the GBC one copies the tiles with a
  general-purpose HDMA, gives every tile a CGB palette through VRAM bank 1 and animates the water with an HBlank
  HDMA). Same scene everywhere (tiles and backgrounds drawn as text in `consolas_demos/arte.py`, which writes
  `nes/chr.inc`, `nes/fondo.inc`, `gb/teselas.inc`, `gb/fondo.inc`): a background and a 16 × 16 robot of four sprites
  that walks one pixel per frame. Comments in English; the Spanish explanation of every instruction is in
  `explicaciones.es.txt` (`etiqueta+n: texto`, n = instruction index after the label). The built ROMs and their
  symbol files (`demo.nes`, `demo.lbl`, `demo.dbg`, `demo.gb`/`demo.gbc`, `demo.sym`) are versioned, so the traces
  regenerate without the toolchains.
- «Un juego de verdad» (`juego`): a free homebrew game, one entry each in `contenido/fotograma/juegos.json`
  (`juegos.mjs`: `rom` + `sha256` or `descarga {url, sha256}`, `licenciaTexto`, `cuadro` (VBlanks after the picture
  is switched on) or `cuadroDesdeReset`, `entradas` = button script `[[VBlank, 'start+a'], …]`). Chosen by the owner:
  NES robotfindskitten (Damian Yerrick, zlib, built with ca65 from pinobatch/rfk-nes b9764ce), Game Boy Libbet and
  the Magic Floor (Damian Yerrick, zlib, built with rgbds from pinobatch/libbet 1232e71), Game Boy Color Tobu Tobu
  Girl Deluxe (Tangram Games, MIT code + CC BY 4.0 assets, the official ROM from itch.io). ROMs and licence texts in
  `contenido/consolas_juegos/<maquina>/`; next to each trace go `<id>-LICENCIA.txt` and `<id>-FUENTE.txt`.

**Pipeline** (`node contenido/fotograma/generar.mjs [nes] [gb] [gbc]`; `CC65_BIN`, `RGBDS_BIN` = folders of the
toolchains, optional). Own emulator cores in plain Node, no dependencies:
- `cpu6502.mjs`: every 6502 cycle is one bus access in the chip's order (dummy reads and writes included), NMI/IRQ
  polling at the penultimate cycle. Validated (`validar6502.mjs`): SingleStepTests 65x02/nes6502, 151 official
  opcodes, 43 609 tests, 171 762 bus cycles, 0 failures; nestest.log, 5003 instructions, 0 differences.
- `nes.mjs`: NROM, the 74HC139 decoding (WRAM, PPU, /ROMSEL), OAM DMA (1 + parity halt cycle, 256 read/write
  pairs), controller shift registers, and a dot-exact 2C02: the 8-dot fetch pattern (NT, AT, pattern low/high, 2 dots
  each, ALE in the first), loopy v/t/x/w, sprite evaluation at dot 257 and fetches at 257–320 (tile $FF for empty
  slots), shifters, the pixel of every dot, VBlank/NMI at 241/1, odd-frame dot skip, composite sync lines.
  Palette computed from the composite levels (`paletaNes`).
- `sm83.mjs`: every machine cycle a read, a write or an internal cycle; interrupt dispatch in 5 cycles. Validated
  (`validarSm83.mjs`, `validarGb.mjs`): SingleStepTests sm83, 498 opcodes (242 + 256 CB), 149 400 tests, 300 806
  machine cycles, 0 failures; blargg cpu_instrs (11/11), instr_timing, mem_timing 01–03: 15/15.
- `gb.mjs`: DMG and CGB (and a DMG game on a CGB, with the boot ROM's compatibility palettes): MBC1/3/5, timer,
  joypad matrix, serial, OAM DMA (the CPU blocked outside HRAM), CGB HDMA (general and HBlank, 2 bytes per machine
  cycle), VRAM/WRAM banks, palettes, and a dot-level PPU: OAM scan (one entry per 2 dots), the pixel FIFO (first
  fetch thrown away, 12 dots before the first pixel, SCX discard, window, sprite stalls of 6 + up to 5 dots per Pan
  Docs «Mode 3 length»), STAT/LYC. The run starts at $0100 with the registers the boot ROM leaves (Nintendo's boot
  ROMs are not used).
- `registro.mjs` (`Registro`: records buses, instructions, phases, signals, pixels and line starts only inside the
  recorded segments), `traza.mjs` (`escribirTraza` / `leerTraza`), `comun.mjs` (assemblers, explanations),
  `maquina_nes.mjs`, `maquina_gb.mjs` (build, find the window with a first run, record with a second, identical one).
- Segments: `arranque` (from reset: the vector, the stack, waiting for VBlank; no picture) and `fotograma` (from the
  instruction in progress when a VBlank starts to the one when the next starts: the interrupt, the DMA, all lines).
- Cross-checks with independent emulators (scratch only): `contrastar_nes.mjs` (jsnes; it hides an 8-pixel border:
  240 × 224 compared) and `contrastar_gb.py` (PyBoy, its own boot ROM, button script shifted by its length). Demo
  NES, robotfindskitten, demo DMG, Libbet DMG: 0 pixels differ. Demo GBC: 360 (the HBlank-HDMA water, which PyBoy
  2.8 does not run). Tobu Tobu Girl DX: logos, intro, title and main menu 0; the recorded in-game frame 417 (the game
  seeds its random numbers with DIV when START is pressed, title.c, and DIV depends on the boot ROM).

**Trace «EPAF» v1** (`<programa>.bin`, little-endian): `'EPAF'`, u16 version 1, u16 0, u32 n, the manifest JSON (n bytes,
space padded), then the array area — LZ-compressed as a whole when `compresion {tipo: 'lz', bytes}` (byte-oriented
LZ77 sequences: varint literal length, literals, varint match length, varint distance). Every array is
`arrays[name] = {tipo u8|u16|u32|i32, n, cod crudo|vlq|vlqd, offset, bytes}` (`vlqd` = zigzag LEB128 of the
differences). Manifest (`fotograma/tipos.ts → ManifiestoTraza`): `maquina, idPrograma, titulo, tipo, generador,
reloj {hz, nombre}` (one time unit: the PPU dot on NES/GB), `cpus [{id, tipo, hz, unidadesPorCiclo, registros}]`,
`buses [{id, titulo, anchoDir, anchoDato, t, a, d, f, c, k?, chips, tipos?, duracion?, duraciones?}]` (flags `f`: 1
write, 2 opcode fetch, 4 dummy/internal cycle, 8 DMA, 16 vector, 32 inside the chip — no pins move, 64 operand),
`instrucciones [{cpu, t, pc, ciclo (index of its first bus cycle), k? (0 instruction, 1 NMI, 2 interrupt, 3 reset),
r [register arrays]}]`, `video {ancho, alto, puntosPorLinea, lineas, formato indice|rgb555, paleta?, unidadesPorPunto?,
lineasT, lineasN}`, `fases {tipos, t, k, linea}`, `senales {tipos [{id, titulo, activaBaja?}], t, k, v}`, `pixeles {t,
c}` (raster order), `fb` (the emulator's framebuffer of the recorded frame), `segmentos [{id, titulo, descripcion, t0,
t1, pixel0, pixel1}]`, `memoria [{nombre, array, base}]` (PRG/ROM and HRAM images for the disassembler), `programa
{fuente, autor, licencia, url?, etiquetas {hex: label}, explicaciones {hex: Spanish text}, lineas? {hex: [line,
text]}}`. Sizes: NES demo 75 kB, robotfindskitten 87 kB, DMG demo 26 kB, Libbet 42 kB, CGB demo 31 kB, Tobu Tobu
Girl Deluxe 85 kB (each fetched only when its program is opened).

**App** (lazy chunk ≈ 42 kB): `Fotograma.svelte` (programs, segments, speed levels «Cuadro entero» — the segment in
30 s — «Una línea» — 8 s per line — «Unos puntos» — 5 dots/s — «Un ciclo» — one CPU cycle per second; play/pause,
steps by cycle, instruction and line, keyboard ← → Mayús, PAL/NTSC switch for programs with `norma`),
`reproductor.ts` (`Reproductor`: time cursor, steps, `duracion(bus, i)`, live nets with an energy that fades so fast
playback still shows where the signals went; a snapshot `foto()` for the panels at ≤ 9 Hz while playing),
`traza.ts` (reader, binary searches), `Pantalla.svelte` (the pixels output so far, the previous frame dimmed, the beam),
`Linea.svelte` (overview of the segment's phases + zoomed rows per bus, instruction boundaries and pixel output;
the static part cached while the window does not move), `Desensamblado.svelte` (the instructions actually run
around the current one, its Spanish explanation and source line, its bus cycles one by one), `Lecturas.svelte`,
`EsquemaRecorrido.svelte` (`esquema/Lienzo.svelte` + an overlay that follows its view through the new `alPintar`
prop), `PlacaRecorrido.svelte` (the linked board painted once with `proyectos/pintar.ts → pintarLado`, dimmed, the face
with the CPU by default, tracks of the live nets of both faces), `FotoRecorrido.svelte` (photo with `trazas`),
`pulsos.ts` (segments oriented by shortest path from the driving part's pins; dashes whose offset continues that
distance, so pulses flow away from the driver; only lines at 1 carry dashes, lines at 0 stay dim),
`capaRecorrido.ts` (draws the live nets by group and frames the parts that answer), `colores.ts` (group colours:
address blue, data amber, control violet, chip select green, clocks grey, video pink, interrupts red, DMA cyan),
`cpu/6502.ts`, `cpu/sm83.ts` (disassemblers with a generic Spanish explanation), `maquinas/nes.ts`, `gbcomun.ts`
(+ `maquinas/gb.ts`, `maquinas/gbc.ts`): bus access → schematic nets with level and driver (NES: A0–A15/R/W from
U6, D0–D7 from the chip that answers, /ROMSEL, WRAM /CE, PPU /CE from U3 while M2 is high, PPU AD0–AD7 with ALE,
PA0–PA7 from the latch U2, CIRAM /CE and A10 from the cartridge; DMG: the cartridge bus and /CS, the VRAM chip U2 on
MA/MD; CGB: the WRAM U2 on MA/MD, VRAM inside the CPU; LCD pins), `FotogramaFuentes.svelte` (sources in «Fuentes»).
Hooks for tests: `__epaFotograma {rep, traza, ir(t)}`, `__epaFotogramaRedes {redes, dibujadas, chips}`,
`__epaFotogramaMs`, `__epaFotogramaPlacaMs`, `__epaFotogramaLinea`, `__epaFotogramaPantalla`. Tests:
`tests/fotograma.spec.ts` (own config `playwright.fotogramaA.config.ts`, port 4231), screenshots
`node tests/fotograma-capturas.mjs`, frame cost `node tests/fotograma-rendimiento.mjs`.

#### Master System II, Mega Drive and Neo Geo

Adapters `maquinas/sms.ts`, `megadrive.ts`, `neogeo.ts` (nets of every bus access on the schematic and the board,
chips, clocks, phases, address map, fidelity, sources); disassemblers `cpu/z80.ts` (`desZ80`, SMS port names) and
`cpu/m68k.ts` (`crearDesM68k(nombres)`), both with a Spanish explanation of every instruction. Time unit: the master
clock (SMS 53,203424 MHz: Z80 /15, VDP slot 20, dot 10; Mega Drive 53,203424 or 53,693175 MHz: 68000 /7, Z80 /15,
slot 16 in H40, dot 8) or, on the Neo Geo, half a master cycle (48 MHz: 68000 cycle 4, dot 8, line 3072), with
`duracion`/`duraciones` per bus and `video.unidadesPorPunto`.

**Generators** (native tools, run by hand; `node contenido/fotograma/{sms/generar_sms,megadrive/generar_md,
neogeo/generar_ng}.mjs`, tools built in `FOTOGRAMA_TMP`):
- `nucleos_b.mjs` fetches the pinned cores with SHA-256 into `contenido/.cache/fotograma/nucleos` (floooh's z80.h,
  zlib; Moira, MIT; BlastEm's vdp.c/vdp.h, GPL-3, run offline only, never shipped) and builds `sms_traza`,
  `md_traza`, `ng_traza`, `m68k_sst`, `z80_sst`. `vdp/parchear_vdp.py` instruments BlastEm (every VRAM read, one
  hook per slot with its tags, writes, pixel pairs, line changes; fast path off; the PAL V counter of mode 4; mode-4
  sprites wrap around line 256 as on the hardware and in Genesis Plus GX); `vdp/vdp_registro.c` records slots,
  pixels and lines (`vreg.activo`; `vreg.lineas_siempre` keeps counting frames while nothing else is recorded).
  `m68k/parchear_moira.py`: precise timing, the bus order of RTE, JSR and ADD/SUB to memory. Checks:
  `z80/validar_z80.py` (SingleStepTests z80: 50 000 tests, 130 000 accesses, only undocumented flags of LDIR/OTIR
  differ) and `m68k/validar_m68k.py` (SingleStepTests 680x0, 35 files: 282 275 tests, 712 426 accesses, offset
  always −2 cycles; 8511 tests differ: MOVE to SR, MOVEM.l, ADDQ.l to An, BTST; 85 640 address-error tests apart).
- `sms/sms_traza.c`: z80.h + BlastEm's VDP in mode 4 (PAL), Sega mapper, pad 1 on port $DC. `megadrive/md_traza.cpp`:
  Moira + z80.h (`z80_md.c`) + BlastEm (H40, V28): /DTACK waits, 68000 → VRAM DMA with /BR, autovectored IACK, the
  Z80's bus request/reset, a 3-button pad on port 1 (TH protocol); PAL and NTSC files (`norma`).
  `neogeo/ng_traza.cpp`: Moira + our own LSPC model (wiki.neogeodev «Rendering logic»: 16-cycle slots with 4 slow and
  10 fast VRAM accesses, parsing of 381 sprites for line N + 2, two C ROM reads per sprite line, four S ROM reads per
  fix tile); the VRAM read latch as in MAME (writing the address reads that word; a data write refreshes it with the
  next one), CPU accesses queued until their slot. Demo mode starts at USER; `--bios <rom>` starts from the reset with
  the system ROM mapped at $C00000 and over the vectors until REG_SWPROM (the AES has no SFIX: the fix layer always
  comes from the cartridge; REG_CRTFIX/BRDFIX change nothing), controllers idle-high, the Z80's reply read as 0.
- Game mode of the three tools (`--juego` / `--bios`): records the first N CPU cycles after the reset (`arranque`)
  and then nothing until the frame before the chosen one (frames counted from the reset), so a frame seconds into a
  game costs no memory; optional button script `frame:mask,…`. An «instruction» logged just before the 68000 takes
  an interrupt instead is dropped (it runs after RTE).
- `comun_b.mjs`: GNU as listings, symbols, explanations, `ejecutarTraza`, `juegosDe(maquina)`, `copiarLicencias`.

**Games** (`contenido/fotograma/juegos.json` entries with `maquina` `sms`, `megadrive` or `neogeo`; generated by
these generators, not by `generar.mjs`). Extra fields: `rom` may be an object (Neo Geo `{p1, c1, c2, s1, bios}`),
`simbolos` (SDCC `.noi`, or `{programa, bios}` nm listings), `licenciaTexto` a list (`<id>-LICENCIA.txt`,
`<id>-LICENCIA-2.txt`), `arranque` (CPU cycles of the start-up segment), `descripcion` (text of the frame segment),
`nota` (into `<id>-FUENTE.txt`), `cuadroNtsc`; `cuadro` counts frames from the reset. Buttons: SMS `arriba abajo
izquierda derecha 1 2`; Mega Drive `… a b c start`; Neo Geo `… a b c d start select`. The Mega Drive game gives two
programs (`<id>` PAL, `<id>-ntsc`, both with `norma`). Builds in `contenido/consolas_juegos/`: `sms/construir.sh`
(Food Fighter 48fe2ea, SDCC 4.0.0 + devkitSMS 50b0fc4: SDCC 4.2's own library uses the new calling convention and
garbles the game's text), `megadrive/obtener.sh` (Gentris, the ROM SGDK ships at 9a78a44, SHA-256 checked),
`neogeo/construir.sh` (ngdevkit-examples 4e7900b `05-scrolling` and nullbios from ngdevkit 5106cbd, with Ubuntu's
`gcc-14-m68k-linux-gnu -m68000`, two libc header stubs and no newlib; reproducible byte for byte). Trace sizes: SMS
demo 45 kB, Food Fighter 98 kB; Mega Drive demo 61 kB ×2, Gentris 131 kB ×2 (the 128 KB ROM image for the
disassembler); Neo Geo demo 40 kB, 05-scrolling 100 kB.

**Cross-check** (`contenido/fotograma/contraste_b/`): `contrastar.py` fetches Genesis Plus GX and Geolith at pinned
commits into `contenido/.cache/fotograma/contraste`, builds them and `frente.c` (a minimal libretro front end that
writes frames as PPM, with an optional pad script and core options), packs a TerraOnion `.NEO` and an `aes.zip`
with nullbios for Geolith, and compares each frame up to a one-to-one colour mapping (games without buttons).
Results: Mega Drive demo PAL and NTSC and the Gentris menu 0 of 71 680 pixels; Neo Geo 05-scrolling 0 of 71 680;
Master System only column 255 (64 pixels in the demo, 186 in Food Fighter: BlastEm outputs the border colour there).
Tests: `tests/fotogramaB.spec.ts` (`playwright.fotogramaB.config.ts`, port 4241).

## Proyectos KiCad (`web/src/componentes/proyectos/`, data in `web/public/proyectos/`)

The boards of the four KiCad projects of the book (printed chapters 48–51, sources `cap49`–`cap52`): estación IoT,
fuente de laboratorio, the four boards of the Hi-Fi amplifier (potencia, preamplificador, fuente, protección) and the
SDR. Route `#/proyectos[/<placa>/<vista>[/<sel>]]` (`Vista` includes `'proyectos'`), `placa` ∈ `estacion_iot
fuente_laboratorio hifi-potencia hifi-preamplificador hifi-fuente hifi-proteccion sdr`, `vista` ∈ `3d placa esquema
simulacion comprobaciones`, `sel` = a reference (`R17`), `red:<net>` or `pad:<ref>.<pin>` (URI-encoded). Selections made
inside a view replace the URL; «Ver en 3D / 2D / el esquema» push it. The reader shows «Ver la placa»
(`proyectos/VerPlaca.svelte`, static map `PLACA_DE_LABEL` in `estado.ts`) next to the four KiCad figures
(`fig-new-49-placa` … `fig-new-52-placa`), the book schematics the boards implement (figs. 49.8, 49.10, 50.22, 51.4,
51.6, 51.10) and the sections that present them.

**Pipeline.** `contenido/proyectos_kicad.py` (called by `generar.py` after the consoles, or alone; needs `kicad-cli` 7 and
reads `/home/claude/v3/complementos/kicad`, env `PROYECTOS_KICAD`, read only). Modules: `proyectos_kicad_pcb.py` (the
`.kicad_pcb` reader on top of `consolas_kicad`'s s-expression parser: outline, layers, nets, footprints with absolute
pads, tracks, vias, zone fills, rule areas; copper connectivity; 3D model descriptor per footprint), `proyectos_kicad_datos.py`
(curated: projects and boards, README fabrication notes, schematic block → book labels, function of the main parts
from the READMEs with the label of the section that explains them, DC wrappers). kicad-cli runs are cached by content in
`contenido/.cache/proyectos/`: `sch export netlist` (kicadsexpr), `sch export svg` (→ CSG1 with `consolas_svg`) and
`pcb export svg` of F.SilkS / B.SilkS (text already stroked in KiCad's font). The schematic sheet goes through
`consolas_kicad.connectivity`/`map_nets` exactly as the consoles'. Checks (shown in «Comprobaciones», errors make
`main()` return 1): every PCB pad on the schematic net of its (ref, pin), same partition of pads, references schematic ↔
PCB (mounting holes apart), each net one piece of copper (union-find over pads, track ends and T joints, vias and zone
fills), values / footprints / MPN schematic ↔ PCB ↔ BOM, the project's DRC report, board size, layers and part count
against the book text and the README, chapter numbers printed on the silkscreen against the printed book, parts under a
shielding can taller than the can. What does not agree is also collected in `indice.json → erratas`.

**Files** (≈ 1,5 MB for the seven boards; each board fetched only when opened). Units: `u` = 0,01 mm, board frame with
the origin at the top-left corner of the outline, y down; polylines are delta coded (`x0, y0, dx, dy, …`).
- `indice.json`: `{version, proyectos: [{id, titulo, resumen, parte, capitulo (printed), capitulo_titulo, color, figura,
  carpeta, placas: [{id, titulo, ancho, alto (mm), capas, componentes, redes, pads, vias, pistas, bytes, tensiones,
  avisos}], netlists: [{id, titulo, ref, analisis, estado}] (the chapter's entries of spice.json), netlists_proyecto
  [file names in complementos/kicad/<p>/spice]}], erratas: [{placa, texto, detalle?}], bytes}`.
- `<placa>.json`: `placa {ancho, alto (u), origen [mm in KiCad], grosor (mm), capas ['F','B'], cobre_um, mascara (colour
  name), mascara_fuente, serigrafia, acabado, fabricacion (README quote), contorno, apilado}`; `redes [{n, p (pads),
  v? {v (V), origen anotacion|simulacion, texto?}}]` (sorted by name; the index is the net id everywhere, also in the
  sheet file); `huellas [{r, v, l (footprint), lib, x, y (u), a (° CCW), lado F|B, t tht|smd|mec, pads [first, count],
  m (3D descriptor: tipo + parameters in mm, `caja` = fab outline box, footprint-local), fab (outline primitives,
  local u), f (function, Spanish), fo readme|deducida, fr? (book label), b? (schematic block), mpn?, dnp?, desc?}]`;
  `pads [[huella, number, shape c|r|o|rr|t|x, x, y, w, h, rot°, roundrect ratio, drill w, drill h, flags, net, pin
  function]]` (flags: 1 F.Cu, 2 B.Cu, 4 plated hole, 8 unplated hole, 16 F.Mask opening, 32 B.Mask, 64 F.Paste);
  `pistas {F|B: [net, width, x1, y1, x2, y2]…}`; `vias [net, x, y, diameter, drill]…`; `zonas [{l, r (net), p}]`
  (KiCad's fractured fills, collinear points dropped: fill even-odd); `areas [{capas, nombre, reglas, p}]` (rule areas:
  the IoT antenna keep-out, the SDR shield wall); `serigrafia {F|B: {lineas [[width mm, n, x0, y0, dx, dy…, n, …]],
  rellenos [delta polygons], circulos [[cx, cy, r, stroke (0 = filled)]]}}`; `esquema {hoja, ancho, alto, notas
  (annotation texts of the sheet), bloques [{nombre, refs (book labels)}]}`; `simulacion {titulo, fuente} | null`;
  `comprobaciones [{tipo ok|aviso|error, texto, detalle?}]`.
- `<placa>/hoja-0.bin` and `hoja-0.json`: the schematic in the consoles' CSG1 and electrical-layer formats (net = index
  into `redes`).
- DC voltages: `ANOTACIONES` (the IoT schematic's «Tensiones esperadas») and the operating point of the project's own
  SPICE models run with the native ngspice (`hifi-potencia`: `etapa_potencia.inc` at RV1 = 225 Ω, ±35 V, 8 Ω;
  `fuente_laboratorio`: `nucleo.inc` at 30 V / 1 A), which use the board's references and net names: node `x1.<name>`
  ↔ board net `<name>` (exact match only). Other boards have no voltages (their models use other node names).

**App** (lazy chunk; three.js only in the 3D view's chunk). `datos.ts` (types, loaders, decoding), `geometria.ts` (Path2D
per copper side and net — zone fills, tracks by width, pads, vias —, mask openings, drills, silkscreen, fab outlines,
rule areas; `impacto()` hit testing: pads, vias, tracks, part bodies, zones), `pintar.ts` (`pintarLado()`: look «real» —
mask over the laminate, copper under the mask a lighter shade, HASL/ENIG pads, silkscreen clipped by the openings — or
«capas» — KiCad-like colours —; selected/hovered net and voltage colours), `Placa2D.svelte` (pan/zoom; the board painted
into a cached bitmap ≈ 2 screens wide, panning only blits it, a new zoom repaints after 140 ms; `window.__epaPlacaVista`
and `__epaPlaca2D` for the tests), `escena3d.ts` + `Vista3D.svelte` (below), `EsquemaPlaca.svelte` (the consoles'
`esquema/Lienzo.svelte`), `Ficha.svelte` (selection panel; `Simbolo.svelte` crops the sheet around the part),
`Simulacion.svelte`, `Comprobaciones.svelte`, `seleccion.ts`, `estado.ts`, `opciones3d.svelte.ts`.

**3D** (`escena3d.ts`): the model library of `componentes/tres/modelos` (`crearModelo(tipo, parametros, {recursos,
detalle: 'bajo', grosorPlaca})`, found with `import.meta.glob`, so the board view also builds without it) chosen by
`modelos3d.ts → claveBiblioteca()` from the descriptor (resistor value → colour bands, capacitor package and value,
ICs by package with their marking, connectors, transistors…); the model's pad 1 is put on the footprint's pad 1 (else its
`origenKicad`), and a model whose body differs by more than ≈ 35 % from the footprint's fab outline is scaled to it. A
library model is refused when it would misrepresent the part: discrete parts whose marking comes from the library's fixed
table (`userData.marcado` ≠ the board's value: diodes, TO-92, TO-220, SOT-23, relays), packages it draws differently
(female sockets, horizontal panel pots, the hand-wound air coil of the power amplifier). Those and the parts the library
does not cover get a body built in `modelos3d.ts → cuerpoSimple` from the fab outline and the package, with the value
printed on it when the package carries a marking. The library's studio (`tres/motor/estudio.ts`:
lights, room environment, contact shadow) and orbit (`tres/motor/orbita.ts`) are reused. Board: FR-4 core extruded from the
outline with every hole, faces textured from `pintarLado` (≤ 4096 px on the long side, about 21–37 px/mm, uploaded at once
and the canvas freed) plus a half-size metal/roughness map (glossy mask, matt silkscreen, metallic pads), plated barrels
in one InstancedMesh, overlays for the selected net and voltages. Loading (0.7): the faces are first painted at a quarter
of the resolution (a few ms: the board is on screen at once) and repainted at full resolution, one face per task, after
the first frame with the parts (their uploads would otherwise queue in front of the parts' shaders), or 4 s after the
scene is created if no parts are loaded; `cargarPiezas(alProgreso?)` builds each distinct part once (same library model
and parameters — and value, for the parts whose marking comes from the library's table —, or the same simple body:
72 templates for the SDR's 131 parts), flattened into per-material triangle arrays in the part's axes
(`plantilla()`), then writes every copy, transformed by its board matrix, straight into one buffer per material in
slices of about 12 ms (`scheduler.yield()` or a macrotask between them: the page stays responsive and the view shows
«Colocando los componentes… n de N» with a bar), compiles the shaders with `renderer.compileAsync()` (in parallel where
KHR_parallel_shader_compile exists) and only then adds the parts: the same meshes and draw calls as before (40–60 per
board). The depth range follows the board (`Orbita.escena`). `stats.fases` (models, merge, shaders, first frame, total,
distinct models), `stats.cuadros`, `stats.programas` (shader programs after the first frame with the parts) and `stats.carasFinas` (ms
to the full-resolution faces) are in `__epaPlaca3D`.
Shielding cans stay separate and turn translucent when the selected part is under them. «Abajo» turns
the board over; «Separar capas» explodes silkscreen / mask / copper / core / parts; «Rayos X» shows both copper layers
(pours faint) through a translucent core (two-layer boards: there are no inner layers). Render on demand; DPR ≤ 2 and
≤ 2,4 Mpx; everything disposed on unmount; `window.__epaPlaca3D` (frame CPU times, draw calls, triangles, texture time,
parts from the library / own) and `__epaPlaca3DListo`. Without WebGL2 (`tres/motor/soporte.ts`) the 3D tab shows the 2D view.

**Faces, 0.8** (`caras.ts`, `caras.trabajador.ts`, `texturas-caras.ts`; `ModoCaras`). 0.7.0 on the MacBook
(WKWebView): 1,2–1,3 s of the page's thread to paint and upload the two 4096 px faces (Xiaomi and Pixel: 12–13 ms
for the same textures). Chromium only records the canvas drawing and rasterises and uploads it on the GPU
(texImage2D of an accelerated canvas is a GPU copy); WebKit rasterises a large 2D canvas with CoreGraphics on the CPU
and its texImage2D(canvas) copies the pixels out of the canvas and converts them (unpremultiply, flip) on the page's
thread. Three ways, chosen per WebView (`modoCarasPorDefecto()`; localStorage `epa-caras` forces one; the
constructor's 5th argument `{ modoCaras }`, optional, keeps the API of consolas/placa): **directo** — the 0.7 path,
unchanged (Chromium: Android, WebView2: the same behaviour as 0.7, deliberately not switched by any timing);
**trabajador** (WebKit: WKWebView, WebKitGTK) — a worker per view rebuilds the geometry from
the board data (`datosParaCaras`, without footprints or areas) and paints each map on an OffscreenCanvas
(`willReadFrequently`) in bands of 128 rows (in Chromium's workers a 4096 px canvas with the board's clips
rasterised 5–20× slower than bands), reads each band back and writes its rows in GL order (bottom first) into a
buffer that is transferred to the page; the quick quarter pass is also painted there (the faces show 1 × 1 maps of
the board's colours meanwhile, so their program is the final one); **franjas** (WebKit without OffscreenCanvas in
workers) — bands of about half a megapixel painted on a software canvas of the page, one per task. The page uploads
pixels with no conversion at all (`DataTexture`, flipY and premultiplied alpha off: `texSubImage2D` of a plain
buffer): an allocated texture (`texStorage2D` of every level) receives strips of about 2 MB through
`copyTextureToTexture`, a few per slice of at most 6 ms, the mipmaps after the last strip; between slices a fence
(`fenceSync`, polled with `getSyncParameter` between tasks) waits for the GPU process to take the previous strips —
a texSubImage2D issued while it is busy blocks the page until there is room for its data (17 s seen with
SwiftShader) —; the unpack parameters are set once at creation so three's state cache never reads them back with a
synchronous `getParameter`. The previous (quarter) texture stays on the material until the full one is complete; a
layer change shows at once at a quarter and refines again; a newer pass stops an older one (`generacion`,
`versionCaras`). Overlays and exploded layers in the new modes use software canvases read back the same way.
`stats.fasesCaras` = {modo, cuarto {pintar, leer, subir}, completa {modo, motivo, geometria, pintar, leer, voltear,
espera, subir, gpu, franjas, maxTarea, total}}; `stats.textura` = page-thread ms of the full faces. At rest the
picture is the same: screenshots of the SDR and IoT boards and of two models, 0.7.1 against 0.8 in Chromium, differ
by at most 2/255 on any pixel in the default mode (directo); painted by the worker (software raster instead of
the GPU's), 0,07–0,1 % of the pixels differ, all on anti-aliased edges of pads, holes and silkscreen. Not done: caching the painted
faces (IndexedDB / Tauri), left for when the diagnostic shows the worker is not enough on the Mac.

Measured 0.7.1 → 0.8 (the diagnostic, both builds interleaved, Chromium headless with SwiftShader on a shared
2-core machine at load ≈ 2–3, median of 3; WebKit could not be measured here): SDR board turning 0,2 → 1,9 fps
(the drawing buffer at ×1 instead of ×2 while turning, ×2 again at rest; ×4 CPU throttling: 0,5 → 0,8), board
visible 1,4 → 1,0 s, board with parts 2,5 → 1,8 s; full faces in the default mode (directo) 5,7 ms of the page's
thread, longest task 3,7 ms (unchanged path); forced to the worker / bands: longest page task 17 / 21 ms (the GPU
process, SwiftShader, takes seconds to swallow 48 MB textures: the fences wait for it between tasks). LQFP viewer:
first view 1174 → 631 ms, a second view 313 ms, turning 2,2 → 2,8 fps; a model page opened cold from the
catalogue 418 → 405 ms (no KHR_parallel_shader_compile in SwiftShader: the gain of compileAsync is for GPUs that
have it, as the Iris Plus 640).

Measured (`tests/proyectos-rendimiento.mjs --veces 3`, median of three loads, Chromium headless with SwiftShader,
i.e. WebGL rasterised on the CPU of a 2-core machine, so far slower than any real GPU and noisy): 53–85 draw calls and
41 000–99 000 triangles per board (unchanged in 0.7), 2–5 ms of CPU per `render()`, both face textures painted in
25–80 ms; the 2D view blits its cache in 0,1–0,4 ms per frame while panning and repaints it in 1–15 ms. Board with its
parts on screen, 0.6 → 0.7, «mac» profile: estación IoT 11,2 → 11,6 s, fuente de laboratorio 25,8 → 22,3, etapa de
potencia 24,3 → 21,2, preamplificador 30,9 → 23,9, fuente hi-fi 24,4 → 14,5, protección 24,1 → 16,7, SDR 34,9 → 22,0;
«tableta» profile: 7,4 → 12,2, 25,5 → 17,8, 27,2 → 18,6, 15,9 → 17,0, 22,7 → 13,1, 28,4 → 14,9, 33,2 → 19,4. The
board itself (first frame) shows earlier (SDR, tablet: 32,4 → 6,3 s). What 0.7 removed is the app's own work: building
the parts takes 150–350 ms (SDR: 72 templates for 131 parts), merging them 30–90 ms, in slices, so the page answers
and the progress bar moves while they are built (0.6 built them in one blocking task). What is left under SwiftShader
is the GPU process compiling the 9 shader programs (`stats.programas`) and JIT-compiling its draw routines at the first
draw: 4–12 s, the same in both versions and on the order of 100–300 ms on a real GPU (a CPU profile of a cold load of
the preamplifier: 0.6 spends 6,8 s waiting in `getProgramInfoLog`, 0.7 waits as long in the GPU process). Frame
intervals while orbiting under SwiftShader (16,7 ms to 2 s) depend on the software rasteriser, not on the app.

Tests: `tests/proyectos-kicad.spec.ts` (own config `playwright.proyectos.config.ts`, port 4189); screenshots of every board
`node tests/proyectos-capturas.mjs --url http://localhost:4189/` → `tests/capturas/proyectos/`; frame cost while
orbiting `node tests/proyectos-rendimiento.mjs --perfil mac|tableta|movil`.

## Performance diagnostic (`web/src/componentes/diagnostico/`, 0.7; new rows in 0.8)

`#/diagnostico` (`Vista` includes `'diagnostico'`), reached from «Ajustes» (`EntradaAjustes.svelte`, a link in the
settings popover; not a rail entry). `Diagnostico.svelte` lists the tests with checkboxes and the seconds each 3D
view turns (default 5); nothing is built or downloaded until «Empezar». `pruebas.ts`: device (user agent, screen,
DPR, cores, memory, theme); WebGL 2 (unmasked renderer, version, max texture and renderbuffer size, MSAA samples,
depth bits, high-precision floats, anisotropy, KHR_parallel_shader_compile); the component viewer (`Visor` of
tres/motor with the 64-pin LQFP: module load, model build, first frame, then frames per second, p95 interval and
render CPU while a synthetic mouse drag turns it; 0.8: the first frame measured until it is drawn, with the
shader time of `visor.preparacion` and whether compilation is parallel, a «Segunda vista» of the same model in a new
WebGL context — what the driver already had compiled —, and «Resolución al girar»: base → lowest pixel ratio,
changes, and the ratio back at rest); the SDR board (`Escena3D` of proyectos: data and geometry, board visible
(0.8: until its first frame, with `compilarPlaca` and the quarter pass phases), board with its parts and the load
phases, «Caras a resolución completa» (0.8: `fasesCaras.completa`: mode, page-thread ms, longest task, paint, read,
flip, upload in strips, GPU wait), then turning as above, draw calls and triangles, and the resolution while
turning); «Caras de la placa SDR» (0.8, `carasSdr`): one new view per `ModoCaras` (directo, trabajador, franjas)
without its parts, `refinarCaras()` at once, the time to both full faces and the page's longest gap meanwhile (a
4 ms timer chain), marking the mode this WebView uses by default; the live layout
(`generarEsquema`, effort 1, nothing remembered) of cap50/rectificador, cap06/fig-6.13, cap08/fig-8.3 and
cap29/prob-29.C-decodificador; ngspice (`simularTexto` of the simulator's client: fig. 3.1, first run with the
download and compile of the engine, then a second one). The views draw in a visible box of the page (browsers do not
draw hidden canvases) and are disposed after each test. The results go to a table grouped by test with ok / warning /
error marks and to plain text («Copiar resultados»: clipboard, or the text selected in a textarea where the WebView
has no clipboard permission). Test: `tests/diagnostico.spec.ts` (opened from «Aa», nothing before «Empezar», every
group in the table — 0.8: also «Caras de la placa SDR», «Segunda vista», «Caras a resolución completa», «Resolución
al girar» and the three modes —, the copied text).

## Instruments and test bench (`web/src/componentes/instrumentos/`)

Virtual Brymen BM869s and FNIRSI 2C53T measuring circuits simulated by the same ngspice worker
(`simulador/cliente.svelte.ts`, unchanged). Routes: `#/instrumentos` (practices and free bench),
`#/instrumentos/practica/<n>` (guided practice 1–12 of cap22.typ), `#/instrumentos/circuito/<parte>/<nombre>`
(a catalogue netlist), `#/instrumentos/libre`. `Vista` includes `'instrumentos'` (`ruta.ancla` holds the rest).
The reader shows «Practicar» (`VerPractica.svelte`, static label → practice map) next to sec-22.1 … sec-22.13.

```
motor/      plain TypeScript (runs in Node too)
  circuito.ts     netlist → bench circuit: analyses/.control removed, top-level elements with the node of each
                  terminal (token offsets, to cut a terminal for a series ammeter), voltage sources, sources that
                  vary with time and their frequencies, the original .tran (UIC, span)
  montaje.ts      bench → netlist + plan: every instrument is a part of the circuit (multimeter on VΩ: 10 MΩ ‖ 60 pF,
                  mV ranges with the input protection conducting above 3 V; Ω/diode: Thévenin test source;
                  capacitance: 1 A AC current source and a one-frequency .ac; current jacks: their shunt, whatever
                  the selector says; 0 V sense source in series with every meter), probes (10 MΩ ‖ 20 pF ×10,
                  1 MΩ ‖ 100 pF ×1, then E buffer, AC coupling 1 MΩ/15,9 nF, bandwidth RC 50 MHz or 6 MHz), the two
                  ground clips joined (1 mΩ), the DDS replacing a V source with 50 Ω; .op always, .tran when a source
                  varies, the generator is on, the original netlist had a .tran or the bench asks (oscillators):
                  start = settling time, span = max(2,4 windows of the screen, 20 periods for the meters), step ≤
                  window/2000 and ≤ 1/(40·f_max), at most 4·10⁵ points; .save of the read vectors only
  generador.ts    the 13 DDS waveforms as PULSE/SIN/B sources (0 … A, 1 Hz … 50 kHz, 0,1 … 3 V)
  senal.ts        interpolation, windows, radix-2 FFT, band-weighted RMS (Parseval), frequency counter, fixed
                  pseudo-random calibration error
  dmm.ts          functions, ranges (full scale, resolution, display unit), accuracy ± (% + d) by frequency band,
                  electrical model per range, auto-ranging, displayed value (exact + fixed error ≤ ⅓ of the spec +
                  last-digit noise, quantised; OL), for the BM869s (11 selector positions, SELECT sub-functions) and
                  the 2C53T's multimeter
  osciloscopio.ts acquisition: edge trigger (Auto/Normal/Single) on the analog data, 1 000 samples over 12 div
                  (real rate 1000/(12·s/div) ≤ 250 MS/s: aliasing appears), noise, 8-bit quantisation over the
                  8 div with clipping, PRM measurements, FFT (Hann, 1 024), AUTO
brymen/     logica.svelte.ts (state machine: selector, buttons with long press, jacks, fuses, REL/REC/CREST/HOLD/
            500 000 counts, LCD content), Brymen.svelte (SVG body, 7-segment LCD siete.ts, draggable selector)
fnirsi/     logica.svelte.ts (oscilloscope/multimeter/generator modes, menus, cursors, math, X-Y), dibujo.ts
            (320×240 canvas screen, redrawn by a Svelte effect only when what it reads changes), Fnirsi.svelte
banco.svelte.ts  bench state: circuit text, leads, instruments, plan ($derived) → debounced run in the worker;
            readings of each meter over whole periods of the last stretch; `vigente` (result matches the plan)
banco/      Banco.svelte (layout, read loop 5/s and acquisition 8/s only while visible), Conexiones.svelte
esquema/    Plano.svelte draws the circuit and the node tap targets: a book figure (fig/NAME.svg + the node
            points of datos/NAME.json, figure node → net map per practice), a drawing in the `esquemas[]`
            format built by the app (dibujoPropio.ts), or the automatic schematic of esquema-auto/
            (`esquemaAutomatico()`, looked up with import.meta.glob; node map from its `correspondencia`);
            without any, the node list
practicas/  circuitos.ts (bench netlists derived from complementos/spice/cap22), dibujos.ts, practicas.ts (12
            practices: variants, initial settings, steps from the book with «apply», checks with the expected
            value, tolerance and how to read it, tables with a plot against theory), aplicar.ts, PanelPractica
```
Tests: `tests/instrumentos.spec.ts` (screenshots `tests/capturas/instrumentos-*.png`).

## Ejercicios autocomprobables y progreso (`ejercicios.json`, `web/src/componentes/aprender/`)

**Generación.** `contenido/ejercicios.py` (llamado por `generar.py`, o solo) lee `partes/*.json` y escribe
`ejercicios.json`. Un analizador saca de cada solución el último valor de cada cadena «X = … = 12,5 mA» y unas
pistas automáticas; `contenido/ejercicios_curado.txt` (revisado a mano para los 486) lo sustituye ítem a ítem:
`= nombre | valor unidad [±tol] [(nota)] | alternativa…`, `~ clase: lo que se pide`, `1:`/`2:` pistas,
`nota:`, `errata:`. Un error de formato o una etiqueta que no existe paran la generación.

```json
{ "version": 1,
  "items": { "ej-5.1": {
      "tipo": "ej",                  // ej | prob
      "parte": "cap05", "num": "5.1", "seccion": "sec-5.11",
      "pos": [312, 0],               // ej: [bloque `ejercicios`, ítem]; prob: [h3, párrafo «Se pide», fin (exclusivo)]
      "modo": "auto",                // auto (campos numéricos) | comparar (con la solución)
      "clase": "numerico",           // numerico eleccion texto deduccion diseno razonamiento sin-solucion
      "respuestas": [ { "id": "r1", "nombre": "Resistencia calculada",   // html (sub, sup)
                        "valor": 440, "unidad": "Ω", "texto": "440 Ω",   // valor en la unidad SI sin prefijo
                        "tol": 0.02,                                     // o "tol_abs" en la unidad
                        "nota": "…", "alternativas": [ { "valor": 470, "tol": 0.005, "texto": "470 Ω", "nota": "E12" } ] } ],
      "otras": [ { "clase": "eleccion", "texto": "¿bastaría una de 1/4 W?" } ],   // lo no numérico que también se pide
      "pistas": ["planteamiento (html)", "resultado intermedio (html)"],
      "titulo": "…", "resumen": "inicio del enunciado", "nota": "…", "errata": "…", "origen": "curado" } },
  "capitulos": [ { "parte": "cap05", "items": ["prob-5.A", "…", "ej-5.1"] } ],   // orden del libro
  "resumen": { "total": 486, "auto": 249, "comparar": 237, "campos": 601, "…": "…" } }
```
Unidades: `Ω V A W F H Hz s J C S VA VAr Wh Ah m bit/s rad/s…` admiten prefijo; `dB dBm % ° °C ppm ppm/°C °C/W
mm² V/µs h LSB…` se escriben enteras; `''` sin unidad. El lector (`lib/magnitudes.ts`) acepta coma o punto decimal,
miles con espacio, exponentes (`e-3`, `×10^-3`, `·10⁻³`), código RKM (`4k7`, `2R2`, `4µ7`), prefijo solo (`4,7 k`),
`u` por `µ` y alias (`ohm`, `grados`…). Veredictos: `bien` (principal o alternativa dentro de su tolerancia), `cerca`
(potencia de 10 equivocada, signo cambiado, o a ≤ 10 %), `mal`, `unidad` (de otra magnitud; no cuenta), `ilegible`.

**Aplicación.** `lib/ejercicios.svelte.ts` carga `ejercicios.json` la primera vez que hace falta (un bloque de
ejercicios, un problema, la página o la portada). `Ejercicios.svelte` pone `aprender/Comprobador.svelte` bajo cada
ejercicio; `Bloques.svelte` pone `aprender/PanelProblema.svelte` tras cada párrafo que empieza por «Se pide» de
nivel superior (busca el problema por `pos[1]`); «Ocultar solución» esconde los bloques `pos[1]+1 … pos[2]−1` con
una hoja de estilo compartida (`lib/tapar.ts`). `aprender/Deduccion.svelte` sustituye al bloque `deduccion` (cada
hijo es un paso; las de un solo bloque se ven enteras). `lib/lectura.ts` sigue la lectura con un
IntersectionObserver sobre los `.trozo` del lector (y `nav.contiguos` como final): una sección es leída cuando se ha
visto el final de su último trozo y sus trozos han estado a la vista `clamp(alto/pantalla × 5 s, 4 s, 75 s)`; un
único `setTimeout` al instante en que podría completarse, nada en los eventos de desplazamiento. Rutas
`#/ejercicios` y `#/ejercicios/repaso` (`Vista` `'ejercicios'`, `aprender/PaginaEjercicios.svelte`).

**Datos del lector** (`lib/aprendizaje.svelte.ts`, misma capa que marcadores y notas: `lector.json` de Tauri o
`localStorage` `epa:*`): `ejercicios` (etiqueta → `{intentos, fallos, resuelto, pistas, solucion, valores, bien,
tapada, t}`; fallado = `fallos > 0` y no resuelto), `leidas` (parte → etiqueta de sección → instante),
`deducciones` (`"<parte>:<índice del bloque>"` → pasos visibles).

## Kit FM7303 (`web/src/componentes/fm7303/`, datos en `web/public/fm7303/`)

Vista `fm7303`, ruta `#/fm7303[/<pestaña>[/<selección>]]`: pestaña `esquema | senal | alineacion | averias`;
selección = designador (`R13`), bloque (`b4`), etapa de la señal (`mpx`) o punto de prueba (`TP3`). El lector
muestra «Kit FM7303» (`VerKit.svelte`, mapa estático de etiquetas) junto a figuras y secciones del capítulo 15 impreso (`cap16`).

**Generación** (`contenido/fm7303.py`, llamado por `generar.py`; módulos `fm7303_dibujo.py` = motor de dibujo y
topología, `fm7303_esquema.py` = el esquema completo colocado a mano, `fm7303_datos.py` = datos del libro):
- `esquema.svg`: el dibujo (placa clara, tinta oscura), 1800 × 820 unidades.
- `kit.json`: `esquema` (topología en el formato «Datos de figuras» de `esquemas[]`, `dibujo_a_svg` identidad,
  `eje: -1`; cada nodo lleva además `red`), `modelo` (`plantilla`: netlist de continua del kit entero con
  marcadores `{{NOMBRE}}` para mandos, interruptores, TP3, medidor y averías; `parametros` por defecto;
  `correspondencia` con el dibujo para `instrumentar()`/`resultados()` de `figuras-vivas/circuito/netlist.ts`;
  `sin_modelo`: redes sin tensión modelada), `citas` (id → `{ref, num, tipo, texto}`), `componentes` (ref →
  función, sección, animación, bloque), `bloques` (8, con color y caja), `mapa` (puntos del mapa de tensiones con
  valor del libro, tolerancia y cita), `tps`, `etapas` (trazos del camino de la señal sobre los cables), `pasos`
  (alineación de la sección 15.11, `sec-16.11`), `averias` (síntoma, cambios del modelo de continua y del de señal, respuesta
  aceptada), `emisoras` (ficticias), `constantes` (con su origen: libro o modelo).
- Comprobaciones que paran la generación: cables que unen redes distintas, terminales sueltos, trozos de una red
  sin símbolo de alimentación/masa, citas que no aparecen en su sección de `cap16.typ`, componentes sin ficha y,
  si hay `ngspice`, un punto del mapa de tensiones fuera de la tolerancia del libro.

**Aplicación.** `Visor.svelte` (SVG en línea cuyo `viewBox` sigue a la vista, sin rasterizar; encima
`CapaEsquema` de figuras-vivas con la misma ventana, y capas propias; recuerda qué muestra —vista inicial, todo,
una región pedida por la página o una vista libre del usuario— y la rehace en cada cambio de tamaño del recuadro;
`reinicio` = pestaña: al cambiar vuelve a la vista inicial; los límites centran el dibujo en cada eje en que cabe
y, si no cabe, dejan desplazarlo hasta 40 px más allá de su borde; una región pedida en un recuadro estrecho no se
muestra más pequeña que la vista inicial), `estado.svelte.ts` (mandos, avería, punto
de trabajo, multímetro), `dc.ts` (rellena la plantilla y la ejecuta en el worker del simulador con amperímetros en
cada patilla), `fisica.ts` (modelo de la alineación: tanques LC, FI, discriminador, AFC, VCO, mute, audio),
`ondas.ts` (formas de onda sintetizadas y trazas de la figura 15.16, `datos/16.15.json`), `alineacion.ts` (comprobación de cada paso),
paneles por pestaña. La página expone `window.__epaKit` para las pruebas (`tests/fm7303.spec.ts`).

## Calculadoras (`web/src/componentes/calculadoras/`, datos en `web/public/libro/formulas*.json`)

**Generación.** `contenido/formulas.py` (llamado al final de `generar.py`, o solo) lee `partes/*.json`, `refs.json` e
`indice.json` y las fórmulas curadas a mano en `formulas_cat1.py` … `formulas_cat4.py` (`F(id, nombre, parte, ec,
ecuación, vars, ej=…, tol=…, origen=…, nota=…, no=…)`; las variables comunes, en `formulas_vars.py`). `ec` son
subcadenas de la fuente Typst de las ecuaciones de esa parte (o `(parte, subcadena)`; terminada en `$`, final de la
fuente); la ecuación principal es la primera fuera de tarjetas y deducciones. `origen` puede citar etiquetas
(`@sec-30.6`), que se sustituyen por el número impreso. Lenguaje de expresiones (`formulas_expr.py`, el mismo en
`expresion.ts`, sin `eval`): números con punto, `+ - * / ^`, paréntesis, variables, constantes `pi k_B q_e c_0 mu_0
eps_0 h_P` y funciones `sqrt exp ln log10 log2 sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh abs floor
ceil round atan2 min max par` (`par`: resistencias en paralelo). No se publica (el generador sale con error) si una
ecuación no aparece en el libro, si el ejemplo del libro no se reproduce, si un valor por defecto cae fuera de su
intervalo o si un despeje no vuelve al valor de partida (despeje simbólico cuando la variable aparece una sola vez;
si no, numérico acotado, el mismo algoritmo que la aplicación).

`formulas.json`:
```json
{ "version": 1, "total": 351, "con_ejemplo": 276,
  "tarjetas": [ { "parte": "cap03", "indice": 0, "seccion": "sec-3.6", "formulas": ["…"] } ],
  "formulas": [ {                       // en orden de lectura
    "id": "fc-rc", "nombre": "Frecuencia de corte de un filtro RC", "parte": "cap03", "cap": "3",
    "seccion": { "label": "sec-3.6", "num": "3.6", "titulo": "…" }, "sub": "sec-3.6.1",   // sub: etiqueta del h3, opcional
    "fuente": "f_(\"c\") = …", "svg": "ec/….svg", "w": 98.1, "h": 25.2,              // la ecuación principal del libro
    "ecuacion": "f_c = 1/(2*pi*R*C)", "resultado": "f_c", "expr": "1/(2*pi*R*C)",
    "vars": [ { "id": "R", "nombre": "Resistencia", "sim": "R", "unidad": "Ω", "min": 0.001, "max": 1e8,
                "defecto": 10000, "escala": "log", "entero": false } ],
    "despejes": { "R": "1/f_c/(2*pi*C)", "C": null },   // null: numérico (acotado); ausente: no se despeja
    "ejemplo": { "valores": { "R": 10000, "C": 1e-7 }, "resultado": 159.15, "libro": 159.15, "origen": "…" },
    "nota": "html", "claves": "palabras de búsqueda" } ] }
```
Los valores van en la `unidad` de cada variable (SI sin prefijo; `%`, `dB`, `°C`, `h`… tal cual; `sim` es HTML).

**Dibujo, familias y «Qué significa»** (`formulas_enriquecer.py`, llamado por `formulas.py` tras ordenar). Cada fórmula
recibe además:
```json
"familia": "filtros",                                  // una de las 18 de formulas_visual.FAMILIAS
"figura": { "esquema": { "p": "filtro-rc", "s": { "R": "R", "C": "C", "fc": "f_c" } },   // plantilla y huecos
            "grafico": { "p": "bode", "s": { "fc": "f_c" } } },  // siempre hay gráfico: «respuesta» si no hay propio
"explicacion": { "ref": "sec-3.6", "ref_num": "3.6",
                 "partes": [ { "k": "significa|aplica|valores|error", "html": "… «cita literal» …" } ] },
"ejercicios": ["ej-3.4"],                                // de la misma parte que usan los símbolos (máx. 4)
"simulador": [ { "k": "cap03/fig-3.9_filtros_rc", "t": "Filtros RC" } ]   // netlists de la sección (máx. 3)
```
y el documento, `"familias": [ { "id", "nombre", "resumen", "miniatura": { "tipo": "esq|graf", "p" }, "total" } ]` y
`"cobertura": { "esquema", "grafico", "explicacion", "ejercicios", "simulador" }` (número de fórmulas). Fuentes:
`formulas_visual.py` (`FAMILIAS`; los roles de cada plantilla de esquema, `ESQUEMAS`, y de cada tipo de gráfico,
`GRAFICOS`; `VISUAL[id] = V(familia, esq=(plantilla, {rol: variable o expresión o «#texto»}), graf=(tipo, {…}))`) y
`formulas_texto.py` (`X(id, ref=None, significa=…, aplica=…, valores=…, error=…)`: 2–4 frases por fórmula con el
texto del libro; `ref` cuando la explicación está en otra sección que la ecuación, p. ej. un resumen). El generador
falla si una plantilla o un rol no existen, si una variable de un hueco no es de la fórmula, si el HTML usa algo más
que `sub sup em strong br`, si una parte no cita el libro o si una cita «…» (de 12 caracteres o más; «[…]» une
trozos) no está, normalizada como en `repaso.py`, en el texto de la sección `ref`.
`formulas-ec.json` es `{ "<svg de una ecuación>": ["id", …] }` para cada ecuación con «Calcular» (la misma fuente da
el mismo SVG, así que una fórmula repetida en otro capítulo también lleva el botón).

**Aplicación.** `BotonCalcular.svelte` (dentro de `Ecuacion.svelte`; el primero que se monta pide `formulas-ec.json`
en un rato libre) → `Emergente.svelte` (carga diferida: panel bajo la ecuación, u hoja inferior movida a `<body>` por
debajo de 640 px, con su capa en `ruta.svelte.ts` para que «Atrás» la cierre) → `Calculadora.svelte` (variable que se
calcula, campos `CampoValor.svelte`, resultado, ejemplo del libro, gráfica de sensibilidad con `componentes/grafica`).
`TarjetaViva.svelte` (en `Bloques.svelte`, bloques `tarjeta`) → `TarjetaPanel.svelte`: variables compartidas por id y
unidad; una variable que calcula otra fórmula de la tarjeta puede enlazarse a ella (por defecto, cuando esa fórmula
solo combina variables que usa el resto de la tarjeta). `Calculadoras.svelte`: ruta `#/calculadoras[/<id>]` (`Vista`
incluye `'calculadoras'`). `expresion.ts` (analizador, cierres, `resolverNumerico` = el del generador), `motor.ts`
(cálculo de cualquier variable, barridos, tarjetas), `unidades.ts` (lectura de «4k7», «2,2 µ»; formato con prefijo SI
y U+202F), `datos.svelte.ts` (JSON diferido, favoritas en la clave `calc-favoritos` del almacén).

`Calculadora.svelte` reparte en dos columnas (consulta de contenedor ≥ 660 px; una en el teléfono) el dibujo y los
controles: `FormulaViva.svelte` (la ecuación con cada variable pulsable: `button[data-var]`, toca para despejarla),
la incógnita, el resultado, «Continuo/E12/E24» (`eseries.ts`) y los campos `CampoValor.svelte` (deslizador
logarítmico o lineal con la marca del valor del libro, campo de texto y selector de prefijo: un número sin prefijo
toma el del selector; aviso «Fuera de lo habitual en el libro» explicado). Los valores que leen el dibujo y las
explicaciones se agrupan por fotograma (`requestAnimationFrame`). En el panel emergente, botones de alternancia; en
la página, todo apilado: `PasoAPaso.svelte` (`mates.ts`: árbol de presentación de la expresión, sustitución con
prefijos, reducciones intermedias con la unidad simplificada por `dimensiones.ts` —base V, A, s, m, K— y resultado),
`QuePasa.svelte` (`quepasa.ts`: elasticidad d ln y/d ln x en ×1,01, ×2 y ×4; si coincide con ±¼…±4 se escribe la ley
«y ∝ 1/x» y «doblar x divide y entre 2»; si no, el cambio en % o en unidades lineales; «Probar» aplica el cambio),
`Significa.svelte` (partes de `explicacion`, enlaces a la sección, animaciones de `enlacesDe`, simulador y
ejercicios) y la gráfica de sensibilidad. `mates.css`: estilo matemático común. `ilustraciones/` se carga aparte
(`import()` diferido): `geometria.ts` (lenguaje de esquemas en rejilla de 10 unidades: hilos, bipolos, operacional,
transistores, cajas, cotas, barras horizontales, etiquetas por rol; `compilar` → primitivas), `esquemas.ts` (54
plantillas), `huecos.ts` (rol → valor; símbolos HTML → `tspan`), `Esquema.svelte` (cuerpos y etiquetas pulsables
con `role="button"` «Calcular …», resultado resaltado), `graficos.ts` (26 tipos de escena en coordenadas de datos:
carga, Bode, resonancia, decibelios, diodo, 555, histéresis, espectro…; `ROLES_G`), `contexto.ts`, `Grafico.svelte`
(SVG 320 × 188 con marcas y anclas que no se salen), `Ilustracion.svelte` (esquema + gráfico; sin gráfico propio,
«respuesta»: el resultado frente a la última entrada movida, ×30 alrededor del valor) y `Miniatura.svelte` (la
galería de familias de `Calculadoras.svelte`). Pruebas: `tests/calculadoras.spec.ts`; capturas de todas las
plantillas: `tests/calculadoras-capturas.mjs`.

## Repaso: tarjetas del glosario y tests (`web/src/componentes/repaso/`, datos en `web/public/libro/repaso/`)

**Generación.** `contenido/repaso.py` (llamado por `generar.py`, o solo) lee las preguntas escritas a mano en
`contenido/repaso/<stem>.json` (una por capítulo o apéndice) y escribe `web/public/libro/repaso/<stem>.json` e
`indice.json`. Fuente:
```json
{ "parte": "cap05", "preguntas": [
  { "id": "cap05-01", "tipo": "opcion", "enunciado": "html", "respuesta": "html", "distractores": ["html", "…"],
    "explicacion": "html", "ref": "sec-5.3", "cita": "texto literal del libro" },
  { "id": "cap05-02", "tipo": "numero", "enunciado": "…", "valor": 59.5, "unidad": "mV", "tolerancia": 0.02,
    "valor_texto": "59,5", "explicacion": "…", "ref": "sec-5.3", "cita": "…" } ] }
```
Comprobaciones que paran la generación (no se escribe nada): esquema e ids (`<stem>-NN`, únicos), 10–20
preguntas por capítulo y 5–20 por apéndice, 2–4 distractores distintos de la respuesta, `ref` que exista en
`refs.json` (o una sección generada `apG-N`) y pertenezca a esa parte, y **la cita**: normalizada (marcas Typst
`#strong[…]`, `#sub[…]`, `#nr(…)`, celdas de tabla unidas por «, », comillas, espacios) debe aparecer en la fuente
`v3/libro/<stem>.typ` dentro del tramo de la sección de `ref` (de su `==` al siguiente); «[…]» separa trozos que
deben aparecer en orden; mínimo 20 caracteres normalizados. En las numéricas, `valor_texto` debe leerse como `valor`
y aparecer en la cita. `<` y `&` sueltos se escapan. Las opciones se barajan de forma determinista (sha1 del id).
Salida por parte: `{parte, preguntas: [{id, tipo, enunciado, opciones, correcta | valor, unidad, tolerancia,
valor_texto, explicacion, ref, ref_num, ref_tipo, ref_titulo?, cita}]}`; `indice.json`: `{version, total, partes:
[{parte, tipo, num, titulo, tomo, color, preguntas, numericas}]}`.

**Tarjetas.** Se construyen en el cliente desde `glosario.json` (910 términos; anverso término, reverso definición
y enlaces «ver»; inversas opcionales, id `<id>~i`). Mazos: todo, por tomo y por capítulo o apéndice (por las
partes de sus «ver») y por tema (color de bloque). Planificador SM-2 de Anki (`srs.ts`, funciones puras): pasos de
aprendizaje 1 y 10 min, reaprendizaje 10 min, graduación 1 d, «Fácil» 4 d, facilidad inicial 2,5 (mínimo 1,3;
«Difícil» −0,15 e ×1,2; «Fácil» +0,15 y bono 1,3; fallo −0,2), dispersión determinista ±5 % desde 3 d, máximo
3650 d, el día empieza a las 04:00, adelanto de 20 min para las de aprendizaje. Cola diaria (`cola.ts`):
aprendizaje vencido, después repaso y nuevas intercaladas (una nueva cada cuatro), con un cupo de nuevas al día.

**Aplicación.** Vista `'repaso'`, rutas `#/repaso` (portada), `#/repaso/tarjetas`, `#/repaso/test/<stem>`,
`#/repaso/examen`, `#/repaso/repasar[/<stem>]`; `BotonTest.svelte` al final de cada capítulo en el lector. Datos
del lector (misma capa que marcadores y notas: `lector.json` de Tauri o `localStorage` `epa:*`, escritura diferida
y volcado al ocultar la página): `repaso-tarjetas` (id → `{e: a|r|ra, p, f, i, v, n, l, u}`), `repaso-diario`
(día → `{r, n, b}`), `repaso-ajustes` (`{nuevasDia, inversas, mazo}`), `repaso-tests` (parte → `{mejor,
intentos, ultimo}`), `repaso-fallos` (id → `{parte, t, veces}`), `repaso-examenes` (últimos 30). Pruebas:
`tests/repaso.spec.ts` (capturas `tests/capturas/repaso-*.png`).

## Sincronización y aviso de versión (`web/src/lib/sincronizacion/`, `web/src/componentes/sincronizacion/`)

**Document** in the owner's private repository (default `Metalaria/electronica-datos`, path
`sincronizacion/datos.json`; written with one level of indentation and sorted keys):
```json
{ "formato": "epa-sincronizacion", "version": 1, "id": "random id of this file", "actualizado": 1761400000000,
  "podado": 0,
  "dispositivos": { "<device id>": { "nombre": "Mac", "ultima": 1761400000000, "version": "0.7.0" } },
  "almacenes": { "marcadores": { "sec-5.3": { "t": 1761400000000, "v": { "parte": "cap05", "…": "…" } },
                                 "sec-5.2": { "t": 1761400100000, "x": 1 } } } }
```
Every item is a last-write-wins register: larger `t` wins; on equal `t`, the entry whose canonical JSON (sorted
keys) sorts last (a tombstone `{t, x: 1}` beats a live entry). Total order ⇒ the merge (`fusion.ts`) is
commutative, associative and idempotent. Tombstones older than 90 days are pruned and `podado` records the horizon;
a device holding an unchanged copy (same `t` as last synchronised) of an item absent from the file, when `podado ≥
t`, drops it. A file with another `id` (new file, other repository) is another history: everything local is
merged in as new.

**Local state** (almacen keys in `lector.json` / `localStorage epa:*`): `sinc-ajustes` {repositorio, ruta, auto},
`sinc-estado` {doc id, dispositivo, ultima, items: {store: {id: [t, hash]}} of the last synchronised version,
resumen}, `sinc-marcas` {cambios, borrados: {store: {id: ms}}} written by the data modules (`marcas.ts`:
`anotarCambio`, `anotarBorrado`), `sinc-version` {t, ultima release, descartada}. Dating a local item: unchanged hash
→ its synchronised `t`; changed → max(its own time field, its mark), or now when that is not newer; a synchronised
item missing locally → tombstone at its deletion mark (or now). The token is stored apart (`credenciales.ts`:
plugin-store file `credenciales.json`, or `localStorage epa-credencial:github` in a browser).

**Run** (`sincronizar.svelte.ts`): event `epa:antes-de-sincronizar` → read every store → GET contents (`cache:
no-store`; base64 UTF-8; files over 1 MB through `application/vnd.github.raw`; 404 → check the repository → new
file) → merge → PUT with the `sha` only when the stores changed (409/422 → read and merge again, up to 5 times) →
apply item by item (skipping items edited during the run) → event `epa:sincronizado {claves}`. Errors are Spanish
(`github.ts → explicar`: 401 token, 403 permission or rate limit, 404 repository or access, 5xx, offline);
automatic runs (start-up, every 5 min while visible, on hide, on return after > 1 min) keep transient errors quiet.

**Syncable stores** (`registro.svelte.ts`): `{clave, nombre, leer(), aplicar(poner, quitar), tiempo?, valido?,
maximo?}`; registered: marcadores, notas, posiciones, leidas («parte/label»), ejercicios, deducciones,
repaso-tarjetas, repaso-diario, repaso-ajustes, repaso-tests, repaso-fallos, repaso-examenes (newest 30),
calc-favoritos, editor-circuitos (`{version, circuitos}` of the schematic editor, items with their own `borrado`). A
new module registers its `Record<id, item>` almacen key in one line:
`registrarSincronizable(mapaDelAlmacen({ clave: 'k', nombre: '…', tiempo: (v) => v.t }))`.

**Update notice** (`actualizaciones.svelte.ts`): `GET /repos/Metalaria/electronica-app/releases/latest` with the same
token, at start-up at most every 12 h, silent on errors, compared with `VERSION_APP` (`version-app.ts`: vite
`define` from `src-tauri/tauri.conf.json`, which `scripts/version-ci.mjs` sets from the tag). The notice
(`Avisos.svelte`, mounted by `Arranque.svelte` in idle time) shows the version, the first lines of the release
notes, this device's installer and «Ver la publicación» (Tauri: `plugin:opener|open_url`; browser: new tab).
Without a token nothing is requested. Tests: `tests/sincronizacion.spec.ts` (GitHub mocked with `route()`);
screenshots: `node tests/sincronizacion-capturas.mjs --url …` → `tests/capturas/sincronizacion/`.
