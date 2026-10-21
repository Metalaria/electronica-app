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
  "motor": { "paquete": "eecircuit-engine", "version": "1.8.0" },
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
(uses XSPICE `A` devices, not in this ngspice build; `nota` explains), `sin-validar` (validation skipped).
`pesada: true` when it took more than 8 s in the validator (the app does not run it automatically).
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

## Simulator (phase 2)

Routes: `#/simulador` (catalogue by chapter, search, analysis filter), `#/simulador/<parte>/<nombre>` (one netlist)
and `#/simulador/nuevo` (free-form circuit, kept in `localStorage` key `epa:circuito`). The reader shows a
«Simular» button next to every section, figure, problem (h3) and exercise whose label is in `spice.porRef`
(`spice-refs.json` is fetched in idle time after start-up; `spice.json` only by the simulator).

Engine: ngspice 45.2 compiled to WebAssembly by the npm package `eecircuit-engine@1.8.0` (MIT). The package's
own driver is not used (its raw-file reader takes byte offsets from decoded text, so any non-ASCII title, i.e.
every book netlist, makes `runSim()` never resolve; it also returns only the last plot and ships the binary
twice as base64 in a 20 MB module). `web/scripts/ngspice.mjs` (run by `npm run dev|build|check`) extracts the
Emscripten factory to `web/src/simulador/motor/ngspice.js` (67 kB) and the binary to `web/public/ngspice/ngspice.wasm`
(5.8 MB); both are generated and git-ignored.

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
web/scripts/validar-spice.mjs   runs every netlist through the same engine in Node (worker_threads, timeout),
                      optionally against native `ngspice -b` (--nativo); used by contenido/spice.py.
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
