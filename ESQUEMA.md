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
               → diamond block, T/O/U lines, S/W switches, A devices (XSPICE NULL ports left out). Values with
               SI prefixes and decimal comma (formatoCorto); sources show DC, «∿ amplitude · f», PULSE «v1/v2 · f».
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
               cannot be reached sensibly gets a net label (stub + name) instead.
generar.ts     whole netlist: components → placement (best of several runs by routed score: length, bends,
               crossings, labels) → shelf packing to a target aspect ratio → net-label texts and small net-name
               tags placed where they collide with nothing → topology. Layouts are kept per circuit structure
               (kinds, pin-net pattern, name lengths; values never matter: label widths reserve «8,88 k»), so a
               slider move redraws the same layout at once; precalculado.json holds the layouts of every book
               netlist computed at high effort (scripts/esquema-auto-precalcular.mjs; a stale entry that no
               longer fits is simply recomputed).
svg.ts         SVG: palette «libro» (book colours, for the light figure plate, fonts embedded at /*@fuentes*/)
               or «tema» (CSS variables, inline, data-el/data-disp attributes and hit areas).
trabajador.ts  Web Worker (sequential queue; loads precalculado.json). index.ts: client, LRU of 16 results.
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
netlists, checks every device and node drawn, topology consistency and overlaps, prints crossings, labels,
lengths and times, and with `--hojas` writes contact sheets to `tests/capturas/esquema-auto/`.
`tests/esquema-auto.spec.ts` covers the page (auto drawing under the live layer, XSPICE drawing, zoom, click →
slider, subcircuit interior, «Nuevo circuito») and the screenshots.

## Consoles (`web/src/componentes/consolas/`, data in `web/public/consolas/`)

Three linked views of the two mainboards photographed in printed chapter 36 (figures 36.16 and 36.22): the NES
NES-CPU-07 and the first Neo Geo AES board (NEO-AES). Route `#/consolas/<nes|neogeo>/<foto|arquitectura|esquema|fuentes>[/<sel>]`
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

**Files** (≈ 1,24 MB in all):
- `<maquina>.json`: `foto` {src, ancho, alto, figura}; `hotspots` [{id, nombre, pieza (marking read on the photo),
  esquema [refs], bloque (diagram block), cajas [[x0,y0,x1,y1]] in photo pixels, confianza `marca|posicion`, buses
  [group keys], funcion}]; `grupos` {key: Spanish name}; `hojas` [{id, nombre, ruta, archivo, ancho, alto (mm), padre}];
  `componentes` {ref: {v value, l symbol, h [sheets], f hotspot}}; `redes` [{n KiCad name, g group, nodos
  [[ref, pin, function]], h [sheets]}] sorted by name (the index is the net id used by the sheet files);
  `equivalencias` (photo chip → AES3-5 chip) and `fuentes` (credits, licences).
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
as signal transition lists in real seconds, sampled by binary search; `nes.ts`, `neogeo.ts`: diagram, address
decoder, scenarios with the documented timings; `dibujo.ts` draws the diagram in the shared `Escena`;
`Analizador.svelte` is the logic-analyser view). Tests: `tests/consolas.spec.ts`.

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
`CapaEsquema` de figuras-vivas con la misma ventana, y capas propias), `estado.svelte.ts` (mandos, avería, punto
de trabajo, multímetro), `dc.ts` (rellena la plantilla y la ejecuta en el worker del simulador con amperímetros en
cada patilla), `fisica.ts` (modelo de la alineación: tanques LC, FI, discriminador, AFC, VCO, mute, audio),
`ondas.ts` (formas de onda sintetizadas y trazas de la figura 15.16, `datos/16.15.json`), `alineacion.ts` (comprobación de cada paso),
paneles por pestaña. La página expone `window.__epaKit` para las pruebas (`tests/fm7303.spec.ts`).

