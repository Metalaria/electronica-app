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
| `figura` | `src` (path: `fig/NAME.svg`, `img/NAME.jpg` or `img/NAME.png`), `num`, `ancho` (0–1), `pie` (html), `credito` (html or null), `tipo_figura` (`grafica` `esquema` `diagrama` `foto`), `svg_vista` ([x, y, w, h], the SVG viewBox in pt; `fig/` only), `img_tam` ([w, h] in pixels; `img/` photos only, 0.11: the `<img>` gets its size before it loads), optional `datos` (`datos/NAME.json`, only for `grafica` and `esquema`): see «Datos de figuras» | `#figura(…)` |
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

### `conceptos.json` and `explorables.json` (0.11)
Written by `web/scripts/conceptos11.mjs`: the sections with something to answer per part, and the live schematics a
lesson makes explorable (see «Mastery, smart practice…»).

### `porque/<parte>.json` and `porque/indice.json` (1.0)
Written by `web/scripts/porque10.mjs`: the book sentence for each wrong option of the choice questions (see «Brilliant
1.0»). `{version: 1, parte, repaso: {<question id>: {<option index>: Porque}}, ejercicios: {"<label>/<question id>":
{<option index>: Porque}}, prediccion: {<item id>: {sube|baja|igual: Porque}}}`, `Porque = {k: 'libro', html, ref,
donde} | {k: 'propio', html} | {k: 'general'}`; the index `{version, partes, libro: {repaso, ejercicios, prediccion},
general: {…}, propio: {…}}` counts them. 1.2: `propio` is the hand review's own short explanation of that option's
misconception (`contenido/porque_curado.json`, a rejected proposal with `"ok": false, "frase", "propio"`: ≤ 320
characters, only `<sub> <sup> <em> <strong>`; still tied to the proposed sentence's fingerprint, so it goes back to
`general` when the book's passage changes); `PorQueNo.svelte` shows it as plain text, without «Del libro». Old readers
of version 1 that do not know `propio` show nothing for it (as for `general`).

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

1.2: a netlist whose header names no label (the 1.1 expansions', now the book's; ten new ones of 4.0/4.1) takes `titulo`,
`refs` and `descripcion` from `contenido/spice_curado.json` (`{netlists: {id: {titulo, refs, descripcion}}}`).
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

**1.2: the published files are the source.** The 3.0.2 and 4.x trees carry no `figuras/datos` (nor
`exportar_datos.py`), so `datos_figuras.py` reads `web/public/libro/datos/` in place, and `contenido/
datos_figuras_recolocar.py` (run by `generar.py` first) keeps each file on the book's current drawing: when a file's
`lienzo.svg` differs from its SVG's viewBox, the figure's own script (`Fuentes/figuras/src`, by its `OUT` line) runs in a
scratch copy of `Fuentes/` (`contenido/.cache/figuras-trabajo`) with a stand-in `exportar_datos` that records the
figure size, the PDF backend's tight box and every Axes (insets too) with position and limits; same size and Axes →
every `*_svg` (`fig_a_svg`, `pos_svg`, `dibujo_a_svg`) moved by the new crop and the canvas set to the SVG's; anything
else → the file is removed (the figure becomes a `diagrama`, reported). 4.1 redrew every scripted figure (Inter,
colours by role): 381 of 522 files moved by 1–4 pt, 140 unchanged, 1 removed (0.11: an inset moved).

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
responsive: phone (single column, drawer), tablet/desktop (sidebar + content). Typography: Source Serif 4 for the
book's running text (bundled woff2); since 1.1 Inter for the UI and Space Grotesk for headings (see «1.1 visual style
across the app» below; Source Sans 3 stays for the drawings: schematics, breadboard, instrument faces, 3D labels).

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

### Start page (0.9, `Inicio.svelte`, `componentes/inicio/`)
`Inicio.svelte` is a lazy chunk (App.svelte `{#await import()}`; prefetched at start-up when the route is `#/`).
Built from the approved mockup `Main.dc.html` (two flex columns of min 330 px, gap 24: side by side on tablet and
desktop, stacked on the phone). Greeting «Hola[, prefs.nombre]» (device-only, set in «Aa»). `inicio/destino.svelte.ts`
decides «where the reader is» for the greeting, «Seguir leyendo» and the path: `ultimaLeccion()` of
`lib/lecciones.svelte.ts` first («Continuar» → `rutaLeccion(parte, seccion, paso)`), else the part with the newest
`usuario.posiciones` entry at its `sec` («Continuar» → `#/<parte>`, which resumes the position), else the first chapter.
Left column: `SeguirLeyendo` (block stripe, segmented bar: lesson steps or the chapter's sections read; the one figure
the page loads, chosen as in 0.8), `Racha` + `Objetivo` (from `progresoDiario`), `RepasoHoy` («Repaso pendiente»,
counted in idle time by the lazy `repasoHoy.ts`, same numbers as the «Repaso» page), «También leyendo». Right column:
`CaminoLibro` — the tome of the current part open as a vertical path (`a.nodo[data-parte][data-leidas][data-estado=
hecho|actual|pendiente]`, `aria-current="step"` on the current one, «Estás aquí · <section num>»), the other tomes as
`button.tomo-fila[aria-expanded]` with their block colours as chips, expanding in place. Below: `ProgresoInicio` and
shortcuts. Block colours per theme come from `tonoBloque(color, tema)` (`lib/color.ts`: light/sepia = the block
colour with white on it; dark = a light tint of its bright variant, ≥ 7:1 on the page, with near-black on it).

### Daily progress and streak (0.9, `lib/progreso-diario.svelte.ts`)
`registrarActividad('paso' | 'pregunta' | 'seccion', n = 1)` (negative n undoes) and the reactive `progresoDiario`
`{ listo, racha, hoy: {pasos, preguntas, secciones}, objetivo: {tipo: 'pasos' | 'preguntas', cantidad 1–10},
cumplidoHoy, ultimosDias: [{fecha, cumplido}] × 7 }`. Callers: lessons (steps, lesson questions),
`repaso/estado.svelte.ts` (`calificar` and `deshacer` of the flashcards, `registrarRespuesta` of quizzes/exams/review),
`aprendizaje.marcarLeida` (sections; they do not count toward the goal). Days are review days (`claveDia`, 04:00).
Almacen keys: `progreso-diario` (day → `{pasos, preguntas, secciones, cumplido, t}`; `cumplido` freezes past days, so a
new goal never rewrites the history; today always follows the current goal) and `progreso-objetivo`
(`{tipo, cantidad, t}`; default 3 steps). Streak = consecutive days with `cumplido`, ending today if met, else
yesterday. Both keys are synchronised (one LWW item per day; the goal as one item). Tests: `tests/inicio09.spec.ts`
(`playwright.inicio09.config.ts`, port 4301); screenshots: `node tests/inicio09-capturas.mjs` →
`tests/capturas/lavado09/inicio/`.

**1.0 (compatibility with 0.10/0.11 clients dropped; what follows is 0.12's design, with these changes).** No device
writes a day on top of a sum it has not seen any more (only 0.9–0.11 did), so the legacy EXCESS is absorbed ONCE by the
schema migration of `progreso-diario` 1 → 2 (`lib/esquemas.ts`, `absorberLegado`: 0.12's own `absorber` for every day,
on the device's storage at start-up, on a synchronisation file of format 1 and on a backup of format 1; pure,
idempotent, 2000 random maps checked against 0.12.0's `totalDia` from git, scenario `t10·10`) and `totalDia` is the sum
of the records minus the undo records (a day with no record at all — not migrated, e.g. after going back to 0.12 and
importing an old backup — counts its summary as it is, and `tocarDia` moves it into «<day>@0» before adding a record).
**Removed**, and why: the excess at every read and its absorption in `tocarDia`/`rehacerDia` (the risk: a stored mirror
paired with a lagging record, random trial 71031 — the `guardado` argument of `rehacerDia(s)`/`absorber` and the
`derivar` third argument are gone); the documented under-count d12d·3 (a 0.11 device's step on top of an undone one —
there is no 0.11 writer; `revision12d.ts` no longer reports it as an expected failure, see «Tests (1.0)»); the
«mirror for 0.10/0.11» role of the day item. **Kept**: the day item «<day>» as the day's SUMMARY — its `cumplido` is
the frozen verdict of a past day (the streak must not change when the goal changes later), its counts are the sum (for
a person reading the file, and for a day with no record); `rehacerDia(s)` keeps it following the records (in the
write, `derivar`; after a synchronisation; and since 1.0 also right after `compactar`, in the same write — before, the
next run sent the remade summaries in a commit of their own); «<day>@0» (now a plain record, written once by the
migration; the larger-per-field rule between two tabs stays as a defence); one record per device/tab, the undo
records, compaction, the per-tab record id. The records keep `cumplido: false` (harmless; no reader needs it).

**Summed across devices (0.12, `lib/progreso-dias.ts`, pure).** The store `progreso-diario` holds two kinds of item:
`"<day>@<record id>"` — ONE device's activity that day, `{pasos, preguntas, secciones, cumplido: false, t}`, changed
only by that device (record id: `sincronizacion/dispositivo.ts idRegistro()`: the device id, almacen key
`dispositivo-local` `{id}`, read at load and stored on first use, never synchronised nor exported; in a browser
`<device>-<tab>`, the tab's id in sessionStorage `epa:pestana`: two tabs never share a record — while the storage
refuses writes each tab's count lives only in its memory and the engine could keep only one of two versions of a
shared record, found by the randomized simulation; «Duplicar pestaña» copies sessionStorage, so each tab holds a Web
Lock `epa-pestana:<id>` (`ifAvailable`) for its whole life and a tab refused it takes a new id — review 0.12c, finding
2: the BroadcastChannel `epa-pestanas` question used before (still the fallback without Web Locks; every tab still
answers it) went unanswered when the original was busy for more than its 150 ms (a 3D board, a simulation) or frozen,
and both tabs kept one id, `12c·5`; Tauri, one window, does none of this —), `"<day>@<record id>~"` — what that writer UNDID that day (same shape; subtracted: an undo
never lowers a record, because an 0.10/0.11 device's mirror may already include the undone step and its excess would
count it again — review 0.12, finding 4; an undo goes up to what the writer itself counted) — and `"<day>"`, the
0.9–0.11 item, now a MIRROR of the day for older versions (sum, verdict, `t` = the newest record's `t`). Plain
last-write-wins per record is exact (one writer), so the merge is commutative, associative and idempotent and
re-synchronising never counts anything twice; the day's activity (`totalDia`) is the sum of its records, minus the undo
records, plus the legacy EXCESS: when the mirror is newer than every record (`t` greater: written before 0.12 or by an
0.10/0.11 device on top of a sum it saw), `max(0, mirror − records)` per field (records without the undos: what such a
mirror may hold) counts too — the upgrade is a lazy migration (nothing is written at load) — and is stored in
`"<day>@0"` (`LEGADO`) the next time this device changes that day (`tocarDia`: absorb, add n to its own record or its
undo record, rewrite the mirror) or a synchronisation or an import changes the days in this tab (`rehacerDia` for every
day with records, on `epa:sincronizado` — only the tab that ran it: every tab rewriting the mirrors on the storage
event made concurrent writes of the key likely, review 0.12, finding 3 —; the mirror follows the merged records, so
0.10/0.11 devices see the sum; deterministic — two devices write equal values, `alinearIguales` sends nothing twice).
Two writers of one device's storage (browser tabs) that change the same item (`unirAportesPestanas`, through the
Guardado's `unir(a, b, base, id)`): this tab's own record (or undo record) keeps base + what each side added and never
less than its own count (another tab's stale copy never lowers it); `"<day>@0"` the larger per field, never a sum (it
is an absorbed value, the same on every device that saw the same mirror — review 0.12, finding 2: two tabs with
different views summed it); anything else the newer. The mirrors of several days are remade with the map grouped once
(`rehacerDias`, review 0.12g, finding 1: remaking every day with `rehacerDia` on the whole map scanned it three times
per day — 2920 items, 2 years × 3 devices: 1,4 s of main thread at CPU ×1, 6,2 s at ×4, on almost every run while
studying on two devices; now one scan, ~10 ms in Node, test «ronda de arreglos 7» in `datos12.spec.ts` counts the
scans). The day's mirror follows the merged records inside the write
itself and on every refresh (`Guardado` option `derivar` → `rehacerDia` of the days the merge touched, review 0.12c,
finding 3: written from one tab's memory it stayed 1–2 steps short after two tabs wrote at once, for 0.10/0.11 too, and
a past day stayed so; deterministic, so both tabs write the same and nothing goes back and forth — scenario `b12·13`,
`12c·3`). Past days are compacted at load (`compactar`, review finding 5:
one record per tab and day grew the file ~100 kB a year): this device's records — and its undo records — of each day
before yesterday become one `"<day>@<device>"` (and one `"<day>@<device>~"`) with their sum, dated after all of them,
the others deleted (marked); the total does not change, 0.10/0.11 ignore records, no tab writes a day two days old, two
tabs compacting at once write the same, an older version of a deleted record loses to its tombstone. When a write or a
refresh merges this tab's memory with another writer's stored version, the legacy excess is also taken from the stored
day alone (`absorber`, `rehacerDias(…, guardado)`): if the merged map shows more excess than the stored day — the
stored mirror paired with a record of memory that lags the stored one —, nothing is absorbed and the day is left as it
is for that pass (random trial 71031, scenario `b12·22`: mirror 3, a record at 1 of 2, «1 legacy step» went to
«<day>@0» and the real record came after: 4 steps for 3); the next merge, with the record, decides — short for a pass
at most, never twice. Invisible to 0.10/0.11 (no new field). Known limits
(accurate, not «never twice»): an older (0.10/0.11) device's change made without having seen the whole sum or the last
undo is counted SHORT, and stays so (only devices all on 0.12 avoid it) — also its step on top of a mirror that already had a step undone (review 0.12d, finding 3,
d12d·3: X 2 steps, 1 undone, Y on 0.11 adds 1, X counts 1, not 2), because the excess is taken against the records
without subtracting the undo records: that mirror is ambiguous (the 0.11 device may have added on top of the day with or
without the undo, and its time, max(now, t + 1), is newer than the undo either way: an offline device acting later),
and the other reading counts the undone step twice when it had not seen the undo. The step so lost is lost for good
(review 0.12e, point 5; an earlier version of this text said «until every device runs 0.12»): the next run of a 0.12
device rewrites the day's mirror from its records (`rehacerDia`, dated with the newest record, after the 0.11 change)
and that mirror wins, so the 0.11 device too sees its step disappear, and the day's goal or streak may be missed. The
check d12d·3 (`tests/motor-real/revision12d.ts`) stays as an expected failure, reported as this known limit; and, as with any item, a device offline for more than 90 days (the
tombstones' pruning) does NOT bring back records compacted since (review 0.12b, finding 6; an earlier version of this
text said it could): its copies of them are unchanged and recorded by a run on the same file, so once older than the
file's prune horizon (`podado`) and absent from it they are dropped (`sincronizar.svelte.ts`), scenario `b12·9` (fails
without that rule). Only a device whose record of the file is gone (the file deleted and created again, a cleared
`sinc-estado`) can bring them back — as with any deleted data. Verdict (`cumplidoDia`): today, the total against the current goal; a past day, the mirror's frozen `cumplido`,
or the total against the current goal if that goal was set before the day ended (a goal reached only by adding up two
devices synchronised after midnight still counts). A goal met through another device's activity emits
`objetivo-cumplido` (XP id `d:<day>`: never twice). `leerDias()` gives the days summed (`diasResumidos`: the XP
reconciliation and the statistics; the records never reach them); `itemsDias()` the stored items (tests). The contract
for the 0.10/0.11 code: the records have exactly their day shape (no normalisation, no back-and-forth) and
`cumplido: false` (their XP reconciliation never credits a record).

### Shared 0.9 look (`componentes/ui09/`)
`ui09.css` (imported by `app.css`) defines global `t09-` classes so existing pages adopt the look without markup or
behaviour changes: `t09-tarjeta` (radius `--radio-tarjeta` 18 px, `t09-media` 14 px, `t09-banda` 6 px block stripe via
`--c09`), `t09-boton` (52 px primary in `--c09`/`--sobre09`, default `--acento`/`--sobre-acento`; `t09-contorno` 44 px
outlined), `t09-segmentos`, `t09-chip` (34 px with a 44 px hit area), `t09-rotulo`. Svelte wrappers: `Tarjeta`,
`BotonPrincipal`, `BarraSegmentos`, `Chip`, `Rotulo`. New tokens in `app.css` for the three themes: `--radio-*`,
`--toque` (44 px), `--barra-nav`, `--ambar`, `--ambar-relleno`, `--sobre-ambar`, `--ambar-tinte`, `--sobre-acento`.
Applied to the index pages of the simulator, exercises, Repaso (`Portada`), calculators, the animation galleries
and the consoles. Text on these pages uses `--tinta-suave`, not `--tinta-tenue` (below 4.5:1).

### 1.1 visual style across the app (`app.css`, `estilos/tokens11.css`, `ui09/ui09.css`, `estilos/lectura.css`)
The approved mock-up's look (`--v11-*` tokens, see «Style 1.1» under the hand-authored lessons) is applied to the whole
app centrally; layout and navigation are unchanged.
- **Tokens.** `app.css` imports `tokens11.css` and its 1.0 tokens now point at the `--v11-*` values (one source per
  colour, resolved per theme): `--fondo` and `--superficie` = `--v11-fondo` (light and sepia: white/cream pages with
  outlined cards; dark: cards `--v11-panel`, a step lighter), `--superficie-2` and `--fondo-lateral` = `--v11-panel`
  (dark: #262d36 and #1b2027), `--fondo-carril` = `--v11-marco`, `--tinta`/`--tinta-suave`/`--titulos` = the ink
  tokens (headings in ink, no longer navy), `--linea` = `--v11-linea`, `--sombra` = `--v11-sombra`, `--sans` =
  Inter, radii = the mock-up's (`--radio-tarjeta` 20, `--radio-tarjeta-p` 16, `--radio-boton` 14, `--toque` 44).
  New: `--titular` (Space Grotesk), `--bien`/`--bien-tinte`/`--bien-texto`, `--mal`/`--mal-tinte`/`--mal-texto`
  (feedback), `--lectura` (the orange of a reading, `--v11-naranja-texto`), `--esquema-trazo` (the schematic
  drawings' strokes keep the 1.0 navy / sepia / dark values). The streak/XP/problem
  accent (`--ambar*`) is the mock-up's orange. `--tinta-tenue` and the book's box inks keep their 1.0 values (≥ 4.5:1 on
  every surface, `regresiones11` checks it). Dropped: `--c-codigo` (code blocks have no stripe now).
- **Accent.** `lib/color.ts`: the book's navy (the default outside the chapters and the first tome's block colour)
  becomes `--v11-azul` and its tint in `acentos()` and `tonoBloque()`; the other chapters keep their colour, now also
  checked against the darkest panel (`PANEL`, ≥ 4.6:1). `FONDO`/`SUPERFICIE` match the new backgrounds.
- **Type.** `h1, h2, h3` use `--titular` globally; page titles that set the serif (49 rules: pages, cards, big numbers,
  the reference card's title, `t09-titulo`) use `--titular`. The book's running text, statements quoted from the book,
  definitions, maths symbols and the font preview in «Aa» keep `--serif`. The reader waits for Inter and Space Grotesk
  as it did for Source Sans 3 (`lib/mapas-lectura.ts` `fuentes`).
- **Shared pieces.** `.boton` (secondary: 44 px, 1.5 px border, radius 14), `.boton.primario` (accent fill,
  `--sobre-acento`), `.boton.fantasma` (text only), `.boton.pequeno` (36 px), disabled primary = `--v11-inactivo` with
  readable text; `t09-boton` 54 px, `t09-segmentos` and the lesson header's `.seg` (`pregunta/CabeceraPasos`) = done
  green / current blue / to do grey (`BarraSegmentos` no longer takes a colour); `pregunta/PieAcciones` disabled =
  grey button; the pages' own `.boton:disabled { opacity }` rules were removed (a disabled secondary `.boton` is at 50 %
  globally). The exercises' feedback lines (`Comprobador`, `PreguntaEjercicio`, `ResolverPasos`) use the feedback
  tints; their hints and worked answers lost the side stripe.
- **Feedback.** `Pregunta` and `Practica` (and the kinds inside) take `--ok*`/`--mal*` from the v11 feedback tokens;
  the verdict is the mock-up's tinted banner (no top stripe), words on the tints in `-texto`, links on it in
  `--v11-azul`; `PorQueNo` is a plain panel inside it; `AvisoGuardado` is the «not yet» banner.
- **Reader** (`lectura.css`): headings in Space Grotesk (h4 no longer italic), boxes, solutions, code, equations, figure
  plates and the personal note as rounded panels without side stripes (the coloured title says the kind), the
  exercises' header and «Ver solución» with soft corners; the chapter opening's number in Space Grotesk and radius 20,
  «En este capítulo» a tinted panel without border.
- **Screens with their own touches:** the tab-lock screen (`lib/pestana-activa.ts` styles), the dialog
  (`Confirmacion`: radius 20, 44 px buttons), error and recovery boxes (`ErrorCarga`, `Recuperable`, `AvisoFallo`),
  the guide's index cards (soft panels: the book's global `.tarjeta` rule had made them yellow), the calculators'
  result (soft panel, 30 px Space Grotesk value in `--lectura`), the live theory's result, the goal card on phones
  (heading under the ring when there is no room), the «Aa» theme swatches, `--dominio-0` (a cool grey).
- **Checks:** `tests/accesibilidad10-rutas.spec.ts` also covers the guided lab, the projects by stages and a lesson
  that does not exist (1.1); a stage page had no `h1` (the stage title was an `h2`: `proyectos11/Etapa.svelte` now
  has `h1` + `h2`). The 3D catalogue's two columns on a phone are `minmax(0, 1fr)` (a long name pushed the page 9 px
  sideways with the new fonts). Screenshots for the restyle were taken in the light theme only; axe runs on every route
  in the three themes, desktop and 360 px.
- **Left as they were, on purpose:** the schematic drawings (editor, automatic schematics, lesson schematics), the
  breadboard and the instruments' faces, 3D scenes and their labels, consoles' boards, the teacher mode's PDFs
  (their own fonts), figure overlays (`practica/Toque`), chapter block colours. Hard-coded radii of 10–18 px in
  components were not rewritten (they already read as soft corners).

### Glossary pictures (0.8, `componentes/glosario/`)
`Glosario.svelte` imports `glosario/imagenes.ts` lazily (it reads `glosario-imagenes.json`, draws symbols with
`simbolo.ts` → inline SVG in `currentColor`, and imports `tres/catalogo3d.ts`). A term with a model gets a 4:3 tile
observed by an IntersectionObserver (200 px margin); only then `imagenes.miniaturaDe` imports `tres/miniaturas.ts`
(three.js) and renders the thumbnail with the 3D viewer's studio background of the current theme. Object URLs are
cached per model, parameters and theme for the session (not in the store: a PNG per model and theme would grow the
synced data file). «Ver en 3D» → `hrefModelo`. Without WebGL2 (`window.__epaSinWebGL`) the tile keeps its icon.

### Navigation («carril de iconos»)
- `lib/navegacion.svelte.ts` holds `HERRAMIENTAS`, the one registry of the app's sections
  (`{ id, ruta, icono, etiqueta, corta?, vistas?, pestana?, atajo?, cuenta? }`, ordered by use: Inicio (0.9), Libro, Buscar,
  Simulador, Calculadoras, Ejercicios, Repaso, Componentes, Conceptos, Instrumentos, Kit FM7303, Consolas, Glosario,
  Marcadores; 1.0: Modo docente, then Guía de uso, last). A new section adds one entry (and its `Vista`/route in `ruta.svelte.ts`)
  and a mention plus an «Abrir en la aplicación» link in the user guide (`lib/guia/contenido.ts`; `tests/guia10-contenido.spec.ts` fails otherwise). `ruta: null` marks the two
  actions: `libro` (phone: opens the index drawer; desktop: toggles the index while reading, else returns to the
  last part read) and `buscar`. The module also has the reading sequence (`pasoVecino`: previous/next section,
  crossing into the next part's opening `#/<parte>/<label>`; `parteVecina`), the index filter (`filtrarIndice`:
  every word, accents and case ignored, in part and section titles; `5.8`/`A.3`/`sec 12.4` section numbers;
  `33`/`cap 33`/`ap B` a chapter or appendix with all its sections; `resaltar` for the marks) and the index
  panel's visibility per view (`indiceOculto`, `alternarIndice`: key `libro` for the reader, else the view; shown
  by default only in the reader and on the start page; stored in `prefs.indiceOculto`).
- Desktop and tablet landscape (≥ 1024 px): `Carril.svelte` (fixed rail, `--ancho-carril` 84 px: logo → Inicio
  (out of the tab order; «Inicio» is the first entry since 0.9), icon + short label (as wide as the rail, not the item:
  «Componentes» was cut, review 11c), tooltip with the full name, active pill; entries that do not fit the height go, least used
  first, to «Más» = `MenuHerramientas.svelte`), `Lateral.svelte` (the index panel, `--ancho-panel` 300 px), and
  `Barra.svelte` (index toggle, clickable breadcrumb → `MenuCapitulo.svelte` with the chapter's sections and the
  chapters before/after, previous/next section buttons, Alt + ↑/↓). App.svelte sets `--ancho-lateral` (what the
  content leaves on the left) from the panel state.
- Phone and tablet portrait (< 1024 px): `Pestanas.svelte` (tab bar: the entries with `pestana` — 0.9: Inicio, Libro,
  Simulador, Ejercicios — + «Más» as a sheet with the rest, Buscar included; pill behind the active icon, background
  `--barra-nav`); «Libro» opens `Lateral.svelte` as a drawer. `--alto-pestanas` (64 px since 0.9) and
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
                    background), entorno.ts (0.12: the environment's PMREM filtered once per device and saved),
                    orbita.ts (Z-up orbit camera), visor.ts (Visor: render on demand, cutaway, caps,
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
directional lights, a prefiltered `RoomEnvironment` (for the PBR metals; 0.12: filtered once per device, see
«Proyectos KiCad», 0.12), `NeutralToneMapping`; ground shadow =
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
  hit testing; 1.2 fix12: every path carries `zonas` = `zonasDeElementos` — a two-terminal part's box between its
  `istart`/`iend`, other parts' whole box, dots and annotations — and `CapaEsquema` calls `ocultar` with each scale, so
  no particle is drawn inside a body), `particulas.ts` (one canvas over the drawings only, ≤ 420 particles per drawing, constant
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
               0.12 QA: `scripts/circuitos-proporciones.mjs` (run it after the precompute, seconds) writes
               `figuras-vivas/circuito/proporciones.json`, the size of the drawing each book netlist shows: «l» the
               matching book figure (CircuitoVivo's choice and crop), «a» the automatic layout at the three sheet
               shapes (`esquema-auto/aspecto.ts` `aspectoPantalla`, shared with the layout). `proporciones.ts`
               `tamanoDibujo(id, 'pagina' | 'banco')` gives the simulator page's CircuitoVivo (`tamano`) and the
               instruments bench (`Banco` `tamano`, the auto layout with Plano's 1.3 × width cap and its hint line)
               the exact place to keep while the drawing is decided (a fixed 16:9 / 5:2 place moved 300 px of
               content; null: nothing reserved; unknown, e.g. an edited netlist: the old generic place).
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
                  (review 11c: `rotuloAc` labels a source kept as SPICE text «[DC x] AC mag phase» as «AC 231 V ∠−120°»)
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
for syncing), written through `guardadoCircuitos` (`lib/sincronizacion/guardado.ts`: read-merge-write; the
synchronisation's circuits reach the open editor's memory). The unsaved draft is `localStorage` `epa:editor-borrador`; an unsaved draft with parts is kept in
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

### Editor additions of 0.10 (part 3)

```
simbolos-extra.ts  symbols of the new kinds in the book's style: SPST switch drawn open/closed, changeover
                   (pins com, c1, c2) drawn in its position, NO/NC push buttons drawn released/pressed, relay
                   (coil b1/b2, changeover com/nc/no, dashed linkage), transformer with centre tap (p.start, p.end,
                   s.start, s.mid, s.end), LDR, NTC/PTC, lamp, buzzer, loudspeaker (both pins on the left), DC
                   motor, crystal, text note (no pins; one text per line). claveForma() includes the state, so the
                   drawing (and the live plate's SVG) shows it.
sensores.ts        resistance of LDR (R10·(E/10 lx)^−γ, capped by the dark resistance), NTC (β equation) and
                   switching PTC (R25·(1+e^(0,2(T−Tref)))/(1+e^(0,2(25−Tref)))): written as plain R lines.
rutas.ts           orthogonal router on the unit grid (Dijkstra over point × direction: length, bends 1,2,
                   crossings 1,5, next to a body 0,35): never inside a body, along another wire, through a pin
                   or a wire end, nor turning on a wire (each would connect); destinations may be a pin or any
                   point of a net (a T on a wire's inside); `puntosDeRed`, `huecoLibre` (a free origin for a part
                   near a point: its box plus one unit touches no wire, pin or body).
ordenar.ts         «Ordenar el esquema»: the generated netlist (lamp, buzzer, motor and crystal lines written as
                   1 Ω resistors with an alias, so they get a two-terminal place) laid out by the editor's worker
                   (`disponerNetlist`), turned into a document by `documentoDeEditable`, and every original part
                   matched to its line(s) through the instances of both netlists («instance#pin index»). Same
                   symbol and pins in the same places → the layout's x, y, o, v; another symbol (POT, relay, E/G,
                   555, digital boxes…) → `huecoLibre` near the layout's place and routed wires from where the
                   layout's pins were (net labels or grounds when there is no way). Grounds, supplies and labels
                   are the layout's; probes go to a free spot near their net and are routed; notes stay. The
                   result must have the same partition of «instance#index» into nets (`mismasConexiones`),
                   otherwise nothing changes. One undoable change (`Editor.reemplazar`).
erc.ts             electrical rule check of the generated netlist text (top-level elements, the directives'
                   lines included): terminal classes conduce / fuerza (driven outputs: op-amp, DAC bridge) /
                   entrada / corriente / digital / desconocido, from the element letter, the library
                   subcircuits (op-amps, 555, relays, epa_*) and XSPICE code models; unknown subcircuits silence
                   the rules on their nodes. Rules: 1 nodes without a DC path to ground (union–find of conducting
                   terminals, driven outputs joined to 0); 2 loops of voltage sources (V, E, H, B V=, L) —
                   short, parallel, loop (with a coil only «aviso»: ngspice warns and goes on when the source is
                   0 V in DC); 3 nodes where only current sources meet (open, in series); 4 op-amp, ADC-bridge
                   and gate inputs with nothing else on their node; 5 a part with every terminal on one node.
                   Rules 1–2 are errors only when an analysis needs a true DC point (.op, .dc, .tran without UIC),
                   otherwise warnings. Over the 313 book netlists it flags 3 (all genuine DC problems, among them
                   fig. 42.6, the book's floating-node example). Also `noConverge(errores, fallo)` and the fixes
                   (`arreglos`, `aplicarArreglo`): .options itl1/gminsteps/srcsteps, UIC, `doc.ajustes.rserie`
                   (netlist.ts writes 1 mΩ in series with every L and V), .options rshunt=1e12, Gear.
barrido.ts         parameter sweep: the values (a list «1k; 2,2k» or a lin/log range, ≤ 8), a copy of the
                   document per value, and `unirBarrido()`: one Simulacion whose plots are renamed with the value
                   («R1 = 2,2 kΩ»), so Resultados.svelte (`barrido`: always overlaid, one tab per analysis class,
                   the input vector left out of the default selection) draws one curve per value and the
                   operating-point table one column per value. ngspice batch has no .step.
Mando.svelte       a knob (range input, linear or log) for a field: `alCambiar(texto, fin)`; Propiedades shows it
                   for fields with `Campo.mando` (pot position, light, temperature) — on the breadboard too.
```

Kinds (catalogo.ts): `SW` (now drawn in its state), `CONM`, `PULNA`, `PULNC` (R lines 1 mΩ / 1 GΩ; `conmutado()`
gives the field a tap toggles, `CONMUTABLES`), `RELE` (X line, library subcircuits `rele5/12/24`: coil L + R with a
0 V sense source, B source |i|·1000 driving two `sw` switches with hysteresis: NO on above 70 % of the rated
current, off below 37 %), `TRAFO` (`modo` relacion: n, Lp, k → Ls = Lp/n² (/4 per half with the tap); inductancias:
Lp, Ls, k; `toma`; hidden field `_nombres` keeps an imported transformer's line names; documents saved before
0.10 without `modo` read as inductances), `PUENTE` (four D lines in `PUENTE_DIODOS` order, `_nombres` likewise),
`XTAL`, `LAMP`, `ZUMB`, `ALTAVOZ`, `MOTOR` (X lines with `params:` on the library subcircuits `epa_cristal`,
`epa_lampara`, `epa_zumbador`, `epa_altavoz`, `epa_motor`), `LDR`, `NTC`, `PTC` (R lines), `NOTA` (in `SIN_LINEA`
and `ES_CONEXION`: no line, not on the breadboard). New groups «Interruptores», «Sensores y cargas»,
«Anotaciones». Designators LDR₁, BZ₁, LS₁, BR₁, RT₁ keep their letters together (rotulos.ts).

Import (importar.ts): a layout transformer becomes the palette's `TRAFO` when it holds the lines exactly (two coils
and one K, or a primary and two equal series halves with three equal K: the centre tap; single-value lines; pins
remapped, a routed wire from each layout pin that moved); a layout bridge with four same-model diodes in the usual
corners becomes `PUENTE`; an `X` instance of a subcircuit that is only a diode bridge (model defined outside it, no
parameters, its internals not referenced as `xb1.` anywhere) becomes `PUENTE` placed in a free spot near the box and
wired to it. The layout's unit runs are joined into straight segments per net (`fusionarTramos`): two nets crossing
at a grid point where both had a run end were joined by the editor's connectivity — six book netlists (among them
fig. 43.10, sec. 43.10, sec. 49.7, fig. 50.5, banda_base, detector_cuadratura) now regenerate with the measurements
of their text, and none got worse (Node check of every non-XSPICE netlist against native ngspice).

Editor page: «Ruta automática» tool (`A`: tap a pin, then a pin or a wire), «Alinear» menu (edges, centres,
spread; ≥ 2 / ≥ 3 parts), «Ordenar el esquema»; analyses card «Barrido de un valor»; the ERC panel (always shown
when there is something; «Simular» stops on errors with «Simular de todos modos»; «Señalar en el esquema»); the
convergence panel with a button per fix (a copy saved in «Mis circuitos», opened and simulated: `simularAlAbrir`).
Results: VistaViva takes `soloOp` (instrumentar without the transient), `alResuelto`, `conmutables` (hit boxes in
the plate's SVG units, `data-conmutar`) and `alConmutar`; a new drawing of the same structure keeps the previous
operating point until the new one arrives (no flicker). A tap toggles, solves the operating point at once
(`vivoAlMomento`, coalesced) and then runs the whole simulation; the «Mandos» panel (pots, sensors, DC value or
sine amplitude of sources, source ranges fixed at the last full run) does the same on input/release.
`Editor.cambiar(fn, fusionar)` / `cambiarCampo(…, fusionar)` (also on the breadboard) merge a knob's movement into
one history step. `DocumentoEsquema` gained `ajustes?` and `barrido?`.

Breadboard (0.10 part 3): packages `pulsador` (6 × 6 mm, legs start · nc · end), `rele` (blue sealed relay, five legs
b1 b2 com nc no), `trafo` (laminated core and winding, 4 or 5 legs), `motor`, `lampara` (glows with its voltage),
`altavoz`, `ldr`, `termistor`, `zumbador` (waves when it sounds), `cristal` (HC-49), `puente` for `PUENTE`;
`conmutador` serves SW and CONM (lever by state); a double tap or the toolbar button toggles every `CONMUTABLES`
kind (`Protoboard.conmutar`). The panel's six tabs are flex 1 1 0 with an icon and, in a panel under 540 px
(container query), the icon over an 11 px label: they fit 412 px without sideways scroll. The «Medir» tutor's step
is a bar above the bench (Mesa.svelte `.mesa-caja`), so it never covers the equipment drawn above the board.
The live schematic of the board (esquema-auto) still draws the `epa_*` and relay subcircuits as boxes and the
switches as resistors (their netlist lines).

Tests: `tests/editor10.spec.ts` (`playwright.editor10.config.ts`, port 4381): every new part against a hand
calculation, the book's transformers (two coils, centre tap) and bridge as palette parts with the measurements of
their text, a switch toggled while simulating (operating point and transient), a pot knob live and on release (one
history step), a sweep with three labelled curves and their −3 dB frequencies, align / spread / automatic wire /
«Ordenar el esquema» (same operating point), notes (move, edit, reload, SVG), each ERC rule and «Simular» stopping,
the convergence help and its copy, the new parts on the breadboard (toggled there), touch at 412 and 800 px (the
breadboard tab bar fits), screenshots in `tests/capturas/editor10/`.

## Virtual breadboard (`web/src/componentes/protoboard/`, 0.10)

Circuits built on breadboards drawn as they look (top view, one pitch = 1 unit, y down, holes on integer
coordinates), editable by touch, with the live schematic and the simulation of what is plugged in.

Entry points:
- «Ver en protoboard» (`lib/protoboard.svelte.ts`: `abrirProtoboard(fuente)`, an overlay of `ruta.svelte.ts`, so
  «Atrás» closes it; App.svelte loads `CapaProtoboard.svelte` as its own chunk). `FuenteProtoboard`: a netlist text
  (`tipo: 'netlist'`, with its origin and book labels), an editor document (`'documento'`) or a figure schematic
  (`'figura'`: `datos/NAME.json`, index into `esquemas[]`). It is a sandbox: nothing of the source is touched;
  «Guardar como montaje propio» copies the board to the store. Buttons: `VerProtoboard.svelte` next to «Simular»
  under figures (labels of `spice.porRef`, menu when several; else the simulable schematics of the figure data,
  fetched when near the viewport; nothing for drawing-only figures and none in the consoles), `Pagina.svelte` of
  the simulator (the netlist as it is), `EditorEsquemas.svelte` (the drawing as it is).
- `#/protoboard[/<id>]`: the simulator tab «Protoboard» (`PaginaProtoboard.svelte`, `ruta.sim = 'protoboard…'`):
  the working board of the device (`localStorage epa:protoboard-borrador`) or a saved one.
  Also an entry of its own in the tools registry (`lib/navegacion.svelte.ts` `HERRAMIENTAS`, id `protoboard`, icon
  `grid-3x3`, after «Instrumentos»): `Herramienta.activa?()` overrides the view test, so on `#/protoboard` the
  entry is marked and «Simulador» is not. The rail's items are 45 px high (were 48) so the 16 entries still fit an
  800 px window.

Geometry (`placa.ts`): N columns (30 = «400 puntos», 63 = «830 puntos»); rails at y = 0 (+), 1 (−), 16 (−),
17 (+), rail holes in groups of five; strips a–e at y = 3…7 and f–j at y = 10…14 (5 holes per column and half);
channel at y = 8–9 (DIP rows e/f are 3 apart). Boards stack every `ALTO_PLACA` = 21; each has its own rails.
Equipment (sources, meters) lives above the first board (y < 0), not in holes. `agujero(cfg, x, y)` gives the
conductor of a hole: `T<board>:<column>:<a|b>` (strip) or `R<board>:<0-3>` (rail).

Document (`tipos.ts`, plain JSON, undo snapshots):
```json
{ "version": 1, "titulo": "…", "placas": 1, "columnas": 30,
  "piezas": [ { "id": "c4", "comp": { …editor Componente… }, "enc": "resistencia",
                "pos": [[3, 4], [7, 4]], "patas": ["start", "end"], "polo": 0 } ],
  "cables": [ { "id": "w1", "a": [3, 6], "b": [3, 1], "color": "#2b2b2b" } ],
  "analisis": { …editor Analisis… }, "directivas": ".model …\n.control …",
  "original": { "c4.start": "vcc", "c4.end": "b" }, "refs": ["fig-42.3"],
  "origen": { "tipo": "libro", "id": "cap42/fig-42.3_op_emisor_comun" } }
```
Each piece is an editor part (`comp`: kind, designator, fields, imported SPICE line), so the editor's netlist
writer, properties panel and palette work on it unchanged; `pos` is where each leg is (or each terminal of a piece
of equipment), `patas` the editor pin of each leg (null = not connected inside: the NC pins of a DIP, the supply
legs of an ideal op-amp), `polo` the + leg of an electrolytic (only physical: its model is a plain C). Wire ends
are coordinates: a hole, or an equipment terminal (they move with the equipment).

Packages (`encapsulados.ts`): `resistencia` (4 or 5 colour bands, `colores.ts`), `bobina`, `diodo`/`zener`
(cathode band), `led` (3 mm, long bent anode leg, flat flange on the cathode), `ceramico` (pF code «104»), `film`,
`electrolitico` (≥ 1 µF; can 2–3,2 pitches by capacitance, − stripe), `to92`/`to220`/`to126` (pinout by model:
2N3904/2N3906/2N2222 E-B-C, BC54x/55x C-B-E, BD13x E-C-B, TIP/power B-C-E, 2N7000 S-G-D, BS170 D-G-S, IRF/power
MOSFET G-D-S, JFET D-S-G; others generic E-B-C / S-G-D / D-S-G, said so in the panel), `dip` (op-amps in DIP-8:
2 −, 3 +, 4 V−, 6 out, 7 V+; the 555; the 74HC chips, DIP-14/16; an imported subcircuit recognised as op-amp or named «…555…» with eight
nodes), `trimmer`, `conmutador` (SPST as a slide switch: common in the middle), `puente` (+ ~ ~ −), `medida` (a 0 V
source: a wire with an «A» badge), `sonda`, `modulo` (everything that is not a real part: E/G/F/H/B sources,
switches with control nodes, XSPICE bridges and clocks and gates with no 74HC part, transformers, lines, other subcircuits; a small board with
its pins on a header). Equipment (`forma: 'externo'`): `alimentacion` (DC voltage source), `generador` (any other
voltage source), `corriente`, `voltimetro`. Every package has a body (oriented rectangle or disc) for collisions;
no leg or wire end may sit under a body. `dibujo.ts` draws all of it as SVG strings (board, parts, wires,
equipment; the board stays light in every theme), shared by the page and the Node tests.

Logic (`logica.ts`): gates and flip-flops as real 74HC chips. `partesXspice(directivas)` takes the top-level XSPICE
«A» lines out of the directives (the editor's importer leaves them there) as `GEN` parts with letter A and the line
as a template (`LineaImportada.plantilla`, «{k}» = k-th node, `NULL` kept; `editor/netlist.ts` writes it back with
the board's nets), pins named by code model (`i0…`/`y` for gates, `d|j|k|t, clk, set, reset, q, nq` for
flip-flops, `in…`/`out…` for bridges). `logicaDe(c)` recognises those, the editor's `DAND…DNOT`, `DFF`, `DJK` and
the book's analog-twin subcircuits by name and pin labels (`AND2`, `NAND2`, `AND3`, `NOR8`, `INV`, `XOR2`, `TFF`).
`empaquetar(comps, nuevoId, conectado)` groups them by kind in order into chips with their pinout (`CHIPS_PUERTAS`:
74HC00/02/04/08/10/11/20/21/27/30/32/86/4078 — 4078: OR out on 1, NOR out on 13; `CHIPS_BIESTABLES`: 74HC74,
74HC112 for JK only). A T flip-flop becomes two slots: half a 74HC74 (it owns the part, so its single d_tff line
stays in the netlist; CLK, Q, nQ are its pins) and an XOR of a 74HC86, packed with the circuit's own XORs (input A
is the T pin; input B is tied `{ pin: 'tffId.q' }` to Q's net; the output and D share `{ interna: 'tffId:d' }`, a
board-only net `int:…` with no pin). D = T ⊕ Q on a rising edge, as XSPICE's d_tff, so the book's ripple counter
also counts up with real chips. A gate with fewer inputs than its chip's has the rest tied to its neutral level; set/reset get legs only when wired
in the circuit (XSPICE's are active high, the chip's PRE/CLR active low; left alone they are tied to Vcc).
A chip is a `Pieza` with `comp` = `{ tipo: 'CHIP', campos: { modelo } }` (not in the netlist) and
`chip: { comps, roles, ataduras }`: the gates (editor parts, written to the netlist unchanged), each leg's role
(vcc, gnd, in, out, nc) and its tie (`'+'`, `'-'`, `{ igual: leg }`, `{ pin }`, `{ interna }`); its `patas` say `"gateId|pin"`, and
`tipos.ts clavePin(p, pin)` / `compsDe(p)` give the pin key («gateId.pin») and the netlist parts of any piece.
The auto-placement gives a tied leg the net it is tied to, so the usual jumper from its strip to the rail (or to
the other leg) is the tie; the leg itself has no pin, so the tie is not in the netlist. Vcc is the net of a DC
source of 2–6 V to ground, or a 5 V bench supply `VCC` added (the only line the board's netlist adds).
`comprobaciones.ts chipSinConectar()` names inputs touching nothing (CMOS «al aire»), Vcc/GND off the supply and
a missing wire of a T flip-flop (XOR output → D, Q → XOR), using `conexiones.ts` `grupo` (what is joined to what,
pinless nets included); `verificar.ts` requires none of them. Chips are numbered CI1… as they sit on the board. The palette's logic parts come in a chip of their own (`edicion.ts nuevoChip`).
Book circuits with chips: the 8 netlists of chapter 29 (4 XSPICE and their 4 analog twins).

Sources (`fuentes.ts`) → `CircuitoFuente` (parts, the net of every pin, directives, analyses, schematic positions):
an editor document through `conectividad()`; a netlist through `importarNetlist()` (the editor's layout worker)
plus `redesDelTexto()`, which takes every pin's node name from the netlist text itself (the drawing only keeps
names that ride on wires, and the `.control` blocks need them all); a figure schematic through its elements with
the rules of `figuras-vivas/esquema/netlist.ts` (peak amplitudes, 1 kHz or 50 Hz, the generator's models, op-amps
with ±14 V or their drawn supplies, Vdd/Vss rails as DC sources, the negative of the first source as ground when
none is drawn; 5 periods of transient when a source oscillates).

Auto-placement (`colocacion.ts`, plain TypeScript, a few ms per part): ground on the blue rails, the most used
positive DC supply (a source from a net to ground) on the top red rail, a negative or second supply on the bottom
one; parts one by one (the leftmost of the schematic first, then the one sharing most signal nets with what is
placed), every position in a window of columns scored: a leg in a strip of its net or in its rail is free, a leg in
a new strip costs the strip plus the jumper to the nearest strip of its net with a free hole; never a strip of
another net, an occupied hole or a hole under a body; bodies 0,3 apart (touching only when nothing else fits) and
over the strips (only a DIP or a two-leg part with legs on both sides crosses the channel; only a part with a leg
in a rail covers the rails; electrolytic cans may overhang). Every net keeps a free hole while legs of it are still
to come, and every new strip keeps one for its jumper. The jumper is laid at once (holes chosen for a short wire,
straight when possible, crossing few bodies and wires). Then the equipment above the board in schematic order,
each terminal with a lead to its rail or a free hole of its net; rails of one net used in several rows are
bridged. Electrolytics get their + leg on the net with the higher estimated DC voltage (sources, then averaging
through resistive parts). Sizes tried: one 400-point board, then one to four 830-point boards; beyond that an
Error with a Spanish message. `verificar.ts` checks a board against its schematic.

Nets and netlist (`conexiones.ts`): union–find over strips, rails, equipment terminals, legs and wire ends. Names:
the original name most of a net's pins had (ground first; without an original, the − terminal of the first bench
supply is ground), then n1, n2…; an original name merged away is rewritten in the directives' `v(…)`. The netlist
is `editor/netlist.ts generarNetlist(doc, con)` with the board's nets (0.10: the optional `con` argument).
`redEn(doc, con, x, y)` and `simulacion.ts tensionEn(…)` are the probe API for instruments of later versions:
the net and the operating-point voltage of any hole or terminal.

Checks (`comprobaciones.ts`, never blocking): short across a source, a part shorted by its strip, an LED, diode,
transistor, trimmer or DIP turned round against the original, LED in reverse and electrolytic with reverse voltage
by the operating point (or the supplies), floating pins (a DIP's: «al aire»), ideal op-amps without supply legs
(info), 74HC chips with an input in the air or without Vcc/GND, leads that reach nothing, legs out of holes, two leads in a hole, and the comparison with the original
schematic («El montaje corresponde al esquema original», or which net is split or which are joined).

State and UI: `estado.svelte.ts` (`Protoboard`: document, selection, history, move/stretch/turn/reverse/wire/add/
delete/change a field — the package follows a value or model change —, derived nets, netlist and checks;
`edicion` is the same object as `editor/estado.svelte.ts` `EdicionPropiedades & EdicionPaleta`, so
`Propiedades.svelte` and `Paleta.svelte` are reused unchanged), `Mesa.svelte` (SVG bench: pointer gestures as the
editor's canvas, `touch-action: none`; tap selects or describes a hole and highlights its net; drag moves, handles
stretch legs and wire ends, the wire tool lays jumpers tap–tap or by dragging; pinch, Ctrl/⌘ + wheel; the wheel
pans in the full-screen view; `window.__epaProtoboard` for the tests), `Protoboard.svelte` (tools; tabs «Esquema»
— `figuras-vivas/circuito/CircuitoVivo.svelte` on the board's netlist, results only while current —,
«Simulación» — the simulator's worker and `Resultados.svelte`; after the first run each change re-solves the
operating point in the background (LEDs lit, voltages under the finger) —, «Avisos», «Pieza», «Añadir»).

Redesign of 0.11 (interaction; the document, nets, netlist and checks are unchanged):
- `Protoboard.svelte`: one action bar (`.herramientas.acciones`, labelled buttons: Deshacer, Rehacer, Original
  when a schematic's board was changed, Nombres, «Monta este circuito», Simular/Detener); the bench; the tray
  (`Bandeja.svelte`) under it on touch screens (`app.movil`) in a dock with the tabs Piezas · Esquema ·
  Resultados · Avisos · Pieza · Medir (`data-pestana`; a panel folds the tray away below 1000 px of height), or
  a column on the left and the panel on the right on wide screens; «Más piezas» opens the editor's palette in a
  sheet. The tools «seleccionar» and «cable» remain (practica/Montar.svelte uses the latter), plus «explorar»
  for the lesson.
- `bandeja.ts` + `Bandeja.svelte`: the cards (`CARTAS`, drawn by `svgCarta` with `svgPieza` on a cropped
  viewBox); cards take every touch (`touch-action: none`): a drag mostly along the tray scrolls it by hand
  (with a flick), anything else drags the card; a tap arms it (`pb.armada`, then a tap on the board puts it).
  The bench draws the ghost (`Mesa.fantasma/soltarFantasma/quitarFantasma`: legs snapped, a DIP kept across the
  channel, 56 px above a finger, a guide's part near its place snapped to it), with its strips green or red;
  `pb.anadirEn(comp | pieza, pos)` checks `motivoInvalida` and `edicion.ts motivoCorto` (two legs of a part in
  one strip or rail — also refused for moves that create it) and `pb.nuevaEn` / `edicion.ts piezaDe` build the
  piece (a gate comes in its chip).
- `BarraPieza.svelte` (Mesa's `flotante` snippet, placed by the selection's screen box): Girar, Voltear, the
  value (`valores.ts`: the field — R/POT/C/L value, a DC supply's voltage, else the model —, common values as
  chips, `pasoE12`, typed with `leerValor`), Pulsar/Conmutar, Más (the «Pieza» tab), Quitar; a wire's colour.
- Wires (`Mesa.svelte`): a free hole starts one in the select tool (tap–tap or drag; `tirasActivas` lights the
  start and end strips); wires are drawn over the parts with a transparent `.golpe` line; a wire end is dragged
  without selecting it first; a 600 ms press removes it (`pb.quitarCable`, a note with «Deshacer»); new wires are
  not selected; `pb.colorAuto` colours them by role (`rolEn`: + of a bench supply or an unused + rail → red, ground
  or − → black, else a cycle). Zoom buttons (`controles`), the empty-board hint (`vacia`), phones start at
  `ajustarDedo` (18 columns), `mostrar(puntos)` brings a guide's step into view; the info line fades after 5 s.
- «Monta este circuito»: `guiados.ts` (five built-in circuits as `CircuitoFuente`s with a hand layout on
  `vacio.ts montajeVacio` — or the auto-placement —, a sentence per part, from the book with its section when it
  has one, and the proof: an LED lit, a net's voltage or a clean run), `guia.ts` (plain: `planGuiado` /
  `planDeMontaje` for the board a schematic opened with; the start keeps the equipment, its leads and rail
  bridges; steps in a hand order or each part followed by the wires its strips allow; `evaluar` checks by
  conductor — rails by what joins them —, symmetric parts either way round, and explains the newest stray piece
  or wire: reversed, a leg off, a wire between other strips), `guia.svelte.ts` (`Guia` on `pb.guia`: state,
  `hacerPaso`, `empezarGuia`), `Guia.svelte` (the step band, the answer at the foot of the bench, the chooser, the
  celebration). While a guide or the lesson runs, the «Protoboard» page does not autosave (a change still waiting
  to be written when it starts is written then: the board before the guide). The guide never writes over the
  montage or draft it replaced: «Otro circuito» restores that board behind the chooser (the next guide's «Salir»
  comes back to it); «Seguir con esta placa» goes on with the guide's board as the draft — from a saved montage
  (`#/protoboard/<id>`, untouched) the page moves to `#/protoboard`; a draft with own work that it replaces is first
  kept in «Mis montajes» as «<title> (antes de la guía)» with a notice —; «Guardar en Mis montajes» saves it as a
  new montage and leaves the draft alone (`Guia.svelte alQuedarse(anterior, guardar)` → `PaginaProtoboard`). An
  unchanged board is never written again (`ultimo`).
- «La protoboard por dentro»: `leccion.ts` (screens, the nearest hole of a tap, joined holes and the answers of
  the questions from `placa.ts agujero`: the same conductor; the 400- and 830-point models have whole rails, so
  nothing is said about split rails), `leccion.svelte.ts` (`Leccion` on `pb.leccion`, `empezarLeccion`,
  `terminarLeccion`), `Leccion.svelte`. Shown before the first guided circuit (`localStorage
  epa:protoboard-leccion`), and as «0» in the chooser.
- `Recorrido.svelte`: three cards the first time on the «Protoboard» page (`epa:protoboard-recorrido`), moving on
  when a part or wire is added; it never blocks the bench.
- The shared engine (0.11 QA): the bar counts only the board's own «Simular» runs (`propias`; `todas` adds the
  live operating point), so a run of the page under «Ver en protoboard» shows no «Detener» there and is never
  cancelled by it (nor by closing the board); «Simulando…»/«Detener» appear after 400 ms.
- `pulsar.ts`: the floating bar's buttons (and the zoom buttons, the guide's fix) act on the release of a tap: right
  after a drag Chrome sometimes drops the click of a quick tap over the bench.

Instruments on the board (0.10): `medida.svelte.ts` (`MedidaProtoboard`: a `Banco` of componentes/instrumentos/ with
`dinamico` and `arranque`; leads at board points, each connected to the net of its hole or terminal via
`redEn`; `sincronizar()` puts the board's netlist — plus `VFNGEN red black DC 0` when both generator leads are
placed, driven by the DDS — and the nodes into the bench), `MedirProtoboard.svelte` (tab «Medir», loaded on first
use and kept mounted; while it exists the board's own live operating point is off, the engine is the bench's;
the oscilloscope's AUTO finds the frequency on the simulated signal, widening the time base, and re-runs until the
time base is stable; `window.__epaMedida` for the tests), `tutor.svelte.ts` (`Tutor`: per task the steps with
`hecho()` read from the instruments and the board — dial position, jack, power, probe nets against the chosen
piece's leg nets, an opened leg alone in its strip or a moved wire end —, the lead «in hand», the holes to light
(`puntos`), the dial/jack/button to light, `hacer` for «Hazlo por mí» (700 ms apart; none for choices that are the
user's); `erroresMedida()`: the explained mistakes with an action). `Mesa.svelte` with the «medir» tool: a tap
places the lead in hand (on a body, at its nearest leg) or chooses the tutor's piece; a probe is dragged with
snapping and its net lit; leg handles still drag (opening the circuit); the step's text is the bench's hint.
`localStorage epa:medir-pista` remembers the dismissed first-use hint.

Storage: almacen key **`protoboard-circuitos`** = `{ version: 1, circuitos: { [id]: { id, nombre, creado,
actualizado, borrado?, doc } } }` (as the editor's, tombstones included, written through `guardadoMontajes`),
registered for synchronisation.

Editor changes for it (0.10): `generarNetlist(doc, con?)`; the panels typed by `EdicionPropiedades`/`EdicionPaleta`;
a «Temporizador 555» palette part (`T555`, DIP-8 pin order, subcircuit `ne555` in `modelos.ts`: comparators at 1/3
and 2/3 of Vcc as tanh, a set–reset latch held by an RC with bistable feedback, output ≈ Vcc − 1,7 V, discharge
switch; astable 1 k/10 k/100 nF at 9 V: 684 Hz against 686 Hz by the formula); `valores.ts` no longer writes
values with the «f» prefix (0,5 pF read back as 500 F: imported sub-pF capacitors were wrong).

KiCad projects: not offered. Their schematics are one flat sheet per board (no hierarchical sheets); the stages
exist only as curated annotation blocks (`b` of each footprint), without ports between them, and most parts have
no SPICE model in the app (ESP32, regulators, relays, NE5532/TL07x from KiCad libraries, SMD RF parts), so a stage
would be neither complete nor simulable. The stages the book simulates (figs. 50.22, 51.4, 51.6, 51.10…) get «Ver en
protoboard» through their netlists.

Tests: `tests/protoboard10.mjs` (Node: every book netlist and simulable figure schematic placed and verified;
`--escribir` + `scripts/validar-spice.mjs` + `tests/protoboard10-medidas.mjs` compare measurements: 296 of 297
netlists identical, the other within numerical noise of a switching transient), `tests/protoboard10.spec.ts`
(`playwright.protoboard10.config.ts`, port 4351; 74HC chips, the tools-menu entry), screenshots in
`tests/capturas/protoboard10/` (`logica-*`: the chapter 29 OR-with-NAND circuit and the 74HC00 pinout;
`contador-*`: the ripple counter with 74HC74 + 74HC86 and the XOR chip's pinout); `tests/proto11.spec.ts` (`playwright.proto11.config.ts`, port 4441: the 0.11 redesign with touch gestures, screenshots in `tests/capturas/proto11/`).

## Consoles (`web/src/componentes/consolas/`, data in `web/public/consolas/`)

Three linked views of seven mainboards: the two photographed in printed chapter 36 (figures 36.16 and 36.22), the NES
NES-CPU-07 and the first Neo Geo AES board (NEO-AES), plus the Master System II (171-5922A), Mega Drive (model 1
VA6), Game Boy (DMG-CPU-05/06 + DMG-LCD-06), Game Boy Color (CGB-CPU-04) and Super Nintendo (SNSP-CPU-01 PAL). `IDS_MAQUINA` in `datos.ts` lists them.
Route `#/consolas/<nes|neogeo|sms|megadrive|gb|gbc|snes>/<foto|arquitectura|fotograma|esquema|placa3d|placa2d|fuentes>[/<sel>]`
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
- `snes` (0.9, data and texts in `contenido/consolas_snes.py`): stonedDiscord's nonSNES (GPL-3.0, commit `cf2e70b`),
  a KiCad 10 single A2 sheet converted by `tools/kicad9to7.py` (0 merged groups, 0 nets without geometry, 0 wires
  off the SVG). Photos are placed from the PCB: a photo entry names `alineacion` (`snes/fotos/<foto>.alineacion.json`:
  `puntos` [[X mm, Y mm, x px, y px]], `modelo` `afin` | `homografia`, `cara` `top` | `bottom`) and the machine names
  `huellas` (`snes/pcb/SNSP-CPU-01_huellas.json`: ref, side, position, box in board mm, from
  `tools/huellas_cajas.py`). Hotspots carry no pixel boxes: `cajas_de_huellas` carries the footprint boxes of their
  parts (`huellas`, default `esquema`) through the least-squares fit and merges neighbours; every footprint of that
  face becomes a `posiciones` marker. The interim photos (nonSNES `photo/front.jpg`, `back.jpg`) were fitted to 792
  and 44 vias. `licencia_texto` copies the GPL into `public/consolas/snes/LICENSE-nonSNES.txt`; `Fuente.texto`
  points at it and «Fuentes» loads it in a `<details>` on demand. `python3 contenido/consolas.py snes` rebuilds only
  that machine (`main(ids)`).

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
`megadrive.ts`, `gb.ts`, `gbc.ts`, `snes.ts`: diagram, address decoder, scenarios with the documented timings, loaded lazily by
`maquinas.ts`; `z80.ts` holds the Z80 machine cycles shared by the SMS and the Mega Drive. A `Maquina` may add
`interior` (second diagram layer, the GB «Dentro del SoC»), `espacios` (address spaces for the decoder: memory/I/O,
68000/Z80), `notaDecodificador` and `variantes` + `diagramaDe` (machine-wide variant passed to every scenario as
`op.norma` and shown as a toggle «Norma de vídeo»: the Mega Drive's and the SNES's PAL default and NTSC clocks;
the SNES decoder has the spaces `a`, the 24-bit CPU address, and `b`, the B bus PA0–PA7); `dibujo.ts` draws the diagram in the shared `Escena`;
`Analizador.svelte` is the logic-analyser view). Tests: `tests/consolas.spec.ts`; the SNES in `tests/consolas-snes.spec.ts` (`playwright.snes.config.ts`, port 4321).

### Console boards in 3D and 2D (`consolas/placa/`, data in `web/public/consolas/placas/`)

Tabs `placa3d` and `placa2d`, only for the machines listed in `placa/datos.ts → PLACAS_DE` (NES, 0.8; Master System II, 0.11,
reconstructed from photos; Mega Drive; Neo Geo, 0.8; Game Boy,
0.8.2: Super DMG-01; Game Boy Color with two boards, the choice kept in `placa/eleccion.svelte.ts`; the selector also shows
alone for a board that is not the original). `PlacaConsola.svelte` mounts the «Proyectos
KiCad» components unchanged (`proyectos/Vista3D.svelte`, `Placa2D.svelte`, `geometria.ts`, `seleccion.ts`,
`opciones3d.svelte.ts`; without WebGL2 the 3D tab shows the 2D view) and translates the selection: a schematic
reference → the footprint with that reference, a schematic net → the board net mapped to it, a board part or pad →
the reference, a board net → its schematic net. Boards with `consola.enlazada: false` take no selection
from the other tabs, unless they carry `consola.parcial {refs, texto}` (0.8.2: OpenGBC, Super DMG-01, chip «enlazada en
parte»): then only those references (`refEnlazada`) and the nets in `consola.redes` are linked. The schematic offers «Ver en la placa» for parts and nets when the machine has a linked board;
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
  mechanical footprints `H<n>`. Pads are grouped by reference into footprints, placed by `consolas_gerber_piezas.py`
  (below; before 0.8.2: mechanical footprints, box around the pads, no 3D body). Inner layers In1/In2 hold only the rings of the drills and are not drawn.
- Board-Folk's Neo Geo NEO-AES3-5 (KiCad 10, public domain per its README; the 53 MB `.kicad_pcb` is not kept: its
  path comes from `CONSOLAS_PCB_NEOGEO`, see `fuente_de(cfg)` → env `CONSOLAS_PCB_<ID>`). KiCad 10 names nets inside
  segments, vias, zones and pads (`(net "name")` instead of a number): `proyectos_kicad_pcb.net_id` maps both forms.
  `fusionar_colineales` merges collinear consecutive track segments of the KiCad boards (Neo Geo 18 210 → 15 212).
  `main(ids)` rebuilds only the boards whose sources are found and keeps the other entries of `indice.json` and
  their files.
- Checks against the console's own `<maquina>.json`: references on both sides, every pad's net against the
  schematic's (board net → schematic net by majority of its pads), and for the Gerber board the two-pin parts whose
  pins 1 and 2 are swapped between the PDF reconstruction and the copper.
- Partial links (`enlace_parcial` in the config, 0.8.2; `enlace_parcial()`): a core of candidates with ≥ 8 pins whose pins
  agree ≥ 95 % under one majority mapping (dropped and recomputed otherwise), then every other candidate whose nets
  are those of the schematic part with the same reference (two-pin parts either way round), anchored on at least one
  core net; its unmapped nets are mapped through it, one board net per schematic net. OpenGBC: candidates U1, U2, P1,
  P2 (the same parts, README), all 228 pads agree. Super DMG-01 (kamicane, KiCad 7, CC BY-SA 4.0, commit bf540dd,
  `CONSOLAS_PCB_GB_SUPERDMG`, not kept): all common references are candidates; 23 linked (162 pads) against Gekkio's
  DMG-CPU schematic.
- nonSNES (SNES, KiCad 10, GPL-3.0, `CONSOLAS_PCB_SNES`, not kept): the schematic's own project, 400/400 references
  and every pad with a net on the schematic's net (1548 counted by (ref, pin): P5 has five pads numbered 23). Config
  `grosor: 1.6` overrides the project's 4.69 mm stackup; `lado_componentes: 'F'` is written to `placa.lado_componentes`
  (optional in `DatosPlaca`) and overrides `Escena3D.ladoComponentes` (339 of 400 footprints are underneath, the
  chips on top). `CUERPOS` gained the SNES_Library packages (PQFP-100/80/64, SOP-64, SOIC-18, the 62256 «RAM»).
- Bodies (`cuerpos: True`, OpenGBC and Super DMG-01; `CUERPOS` in consolas_pcb.py): gull-wing ICs (`ci`: `cuerpo` box,
  `patas` [x, y, w, h] per pad, `alto`; Super DMG's sizes from its README BOM), SMD cans (`electrolitico_smd`),
  SOD-323 (`diodo_smd`), connectors (`conector`, colour, `z0`), thumb wheel (`rueda`), slide switch (`interruptor`,
  `palanca`), daughterboard (`placa_hija`), drawn by `modelos3d.ts → cuerpoSimple` (0.10: the ICs among them by
  `cuerpos3d.ts`, with the marking of `consolas_cuerpos.marcado_de`; see «Bodies of the console parts»).
- Gerber placement (`consolas_gerber_piezas.py`, config `reconstruir`, 0.8.2): per reference, the schematic's footprint
  name looked up in the installed KiCad library (`KICAD_FOOTPRINTS`, default `/usr/share/kicad/footprints`), mirrored for
  the bottom (local y and layers), fitted to the Gerber pads by least squares (rotation snapped to 90° within 1,5°; by
  pad shape when the pin numbers differ, as in Q2, Q4, RA1, RA2); the body from its fab outline. Natalie's own
  footprints (`PROPIAS`): body from the silkscreen strokes inside the pads' box (CPU, SSOPs between their rows, switch,
  wheel) or from the photos (cartridge slot, FFC, link port, jacks, resonator, DC-DC board: approximate); markings
  from the photo hotspots (`ROTULO_EN_FOTO`). Every part gets `rec {pos: 'pads', cuerpo: huella|serigrafia|foto|ninguno,
  nota}`, shown in its sheet (`.reconstruida`) and summed in the board's note; buttons' contacts, battery tabs, speaker
  pads and the jumper stay `t: 'mec'`. A check sums it all up in `comprobaciones`.

- Board reconstructed from photographs (0.11, `tipo: 'foto'`, Master System II 171-5922A, `contenido/consolas_sms_placa.py`):
  no PCB of it is published. Sources: ConsoleMods' 600 dpi scans of the bare board (`sms/fotos/171-5922ATop.jpg`,
  `171-5922ABottom.jpg`, CC BY). The tables `DIPS`, `DOS`, `EMIS` and the named parts give every component hole in px of
  the top scan (read by eye on the silkscreen); `respuesta()` (ring-minus-centre matched filter on the «silver» pixels,
  cached as `.npy` in `contenido/.cache/consolas_sms/`) snaps each to its ring. `ajustar_rejillas` fits one affine map
  px = M · mm + o_part by least squares to all the parts whose pins lie on the 2.54 mm lattice (offsets rounded to half
  pitches; one unknown origin per part; outliers > 6 px dropped): M gives the scale (23.65 × 23.58 px/mm), rotation and
  shear, median residual 1 px. The outline and the inner holes come from the scan against the lid's white
  (`contorno_px`), the board origin is the outline's top-left in that frame. The bottom scan is registered on the top
  one by an affine map G (mirror guess from the outlines' boxes, refined six times on the nearest rings; 697 holes, 2.3 px).
  Faces: both scans warped into the board frame (`placa.fotos {F, B: {src, w, h}}`, `textura_px` {F: 2560, B: 2048},
  JPEG q78 in `placas/sms/`). Pads: round THT pads of typical sizes, NPTH holes and slots as mechanical `H<n>`; nets
  are the schematic's (`consola.redes` identity; RA1 pins 6–9 take RA2's 2–5, `consola.alias {RA2: RA1}`); no tracks,
  vias, zones or silkscreen. Footprints are named for `consolas_cuerpos.TABLA` (`SMS_*`, `DIP-n`, `Oscillator_DIP-14`,
  `DSUB-9_*`, `DcJack`, `SW_*`, `Mod_RF`, `TO-220-3_Vertical`) and classified by `CC.reclasificar`; markings in
  `MARCADOS['sms']`. Every part carries `rec {pos: 'foto', cuerpo: 'foto', nota}` saying what is measured and what is
  assumed (pin order of non-polar two-lead parts, numbers of the unnumbered «CP»/«CE», contacts of jack/switches/RF).
  Viewer: `proyectos/fotos-caras.ts` decodes the photos (fetch + createImageBitmap, also in the faces' worker, which
  gets absolute URLs via `fotosAbsolutas`) into `Geometria.fotos`; `PlacaConsola` loads them before opening the views;
  `pintarLado` (real look, with mask, silkscreen and that side's copper on) draws the photo clipped to the outline instead
  of the drawn copper, mask and silkscreen, then the drills; the PBR map is unchanged (pads metal). Face sizes follow
  the 0.9.2 rules (4096 / 2048 on Android, size guard): the photo is drawn into those maps. A net highlights its pads
  only. `PlacaConsola` shows `.aviso-foto` «Reconstrucción a partir de la foto: las pistas solo se ven en la imagen».
  `python3 contenido/consolas_pcb.py sms` rebuilds it (≈ 2 s with the cache, ≈ 100 s without).

**Files**: `indice.json` `{version, placas: [{id, maquina, titulo, corto, enlazada, tipo kicad|gerber|foto, aviso, fuente
{titulo, autor, url, licencia, uso}, ancho, alto (mm), capas, componentes, redes, bytes}]}` and `<placa>.json`: the
`DatosPlaca` of «Proyectos KiCad» (`esquema` empty, `simulacion: null`, `comprobaciones` = the checks above) plus
`consola {maquina, enlazada, aviso, fuente, redes {board net: schematic net}, refs [references also in the
schematic], capas_cobre ['F', 'In1', 'In2', 'B'], tipo, alias? (0.11)}`; `placa.fotos` (0.11) for photo faces. Sizes: sms 148 kB (plus its faces, 1.2 and 0.7 MB), megadrive 842 kB, neogeo 1094 kB (261 kB gzip;
320 footprints, 2287 pads, 631 nets, 1498 vias, 107 zones; 317/317 references and 2265 pads on the same net as the
schematic), gbc-cgb04 ≈ 355 kB, gbc-opengbc ≈ 250 kB, gb-superdmg ≈ 180 kB. Tests: `tests/consolas-placas.spec.ts`
(`playwright.placas.config.ts`, port 4291); screenshots: `tests/consolas-placas-capturas.mjs`.

**Bodies of the console parts (0.10).** Up to 0.9.2 most footprints of the hobbyist recreations had names of their
own (Board Folk's «Resistor1-5mm», «CAP3-5mm», «BF-2.5mm», «LSPC2»; nonSNES's «TestPoint_Pad», «SC-59», «CASSETTE»;
stonedDiscord's «Resonator-3Pin», «QFP128»…) that `model_for` did not know: typed `caja`, they were light grey boxes
(Neo Geo 295 of 320, SNES 177, Mega Drive 47, NES 16), and no chip outside the library DIPs carried a marking.
`contenido/consolas_cuerpos.py` now gives every footprint its descriptor `m` (`clasificar(h, pads, ctx)`, pads in the
footprint's local axes as `escena3d.padsLocales` computes them, sizes turned by the pad's angle minus the footprint's):
1. `TABLA`: regexes over the boards' footprint names → package and look (resistor DIN size from the pitch, disc
   capacitor, electrolytic diameter, ferrite bead, SIP network, TO-92, axial diodes, lying HC-49/U, trimmer, drum
   choke, wire link, slide switch and pot, push button, key switch, connectors with their opening, metal cans; marks,
   holes, logos, test pads, solder jumpers and card-edge fingers get `sin_cuerpo`);
2. `inferir`: the package from the pads when no name matches (two pads: chip, resistor, disc or electrolytic by the
   value and the reference letter; one row: SIP or connector; two rows at 2,54 or 1,778 mm with a U reference: DIP; two
   SMD rows ≤ 1,3 mm: SOIC/SOP; four sides: QFP with its body inside the pads' inner ends; anything else `generico`, a
   dark box);
3. `marcado_de`: the IC's marking — the board table `MARCADOS` where the value is a role name (SNES `S-CPU|5A22`,
   `S-PPU1|5C77`, `S-PPU2|5C78`, `S-WRAM`, `F413`; Neo Geo `LSPC2-A2`; NES `3193A`; DMG `DMG-CPU`), else the value
   cleaned («5863 / 5814» → 5863), else the schematic's value or symbol name (Mega Drive U13 `~` → CXA1145P). ICs that
   were already typed (`ci`, `soic`, `dip`) only get the marking (`clasif: 'marcado'`); a marking the data already had
   (the CGB-CPU-04's, read from the photo) is kept and flagged `marcado_dado`; SOT/SC-70 parts print codes, not names,
   and get none.
`m.clasif` = `tabla` | `geometria` | `marcado`; re-running is idempotent. Two-lead library models (resistors with
the value's colour bands, disc and electrolytic capacitors, axial inductors, the HC-49 crystal) carry `giro_k` (the
angle of pad 1 → pad 2 in local KiCad degrees) and `escala: false`: `escena3d.colocar` turns the model by
`giroModelo(h)` (−giro_k on the top face, +giro_k underneath, where the local y is not flipped), puts its pad 1 on the
footprint's pad 1 and skips the fit-to-outline scaling; the usual lead check (`patasFuera`, 0,5 mm) still applies. The
other bodies are built from the pads in `web/src/componentes/proyectos/cuerpos3d.ts → cuerpoConsola(h, pads)` (called
first by `cuerpoSimple` for descriptors with `clasif`): `ci` (gull-wing leads from the body side to each pad,
three bars, the pin-1 dimple and the marking), `dip` (any row spacing, notch at pin 1), `sip` (body standing over the
row, marking on the face that reads from pin 1, white pin-1 dot), `axial` (horizontal, vertical «anode up» or SMD with
end caps; cathode band at pad 1), `radial`, `chip`, `to92`, `conector` (an opening `abertura {cara: arriba|frente,
forma: ranura|redonda|dsub|rect}`; `frente`, the local unit vector towards the nearest board edge, computed by the
pipeline), `lata`, `pulsador`, `deslizante`, `trimmer_c`, `bobina_tambor`, `puente_hilo`, `cristal_h`, `generico`,
`sin_cuerpo`. Markings read as on a real chip (`giroRotulo`): two rows — from pin 1 to pin 2, so pin 1 is at the left
end; oblong QFP — along the long side, pin 1 at the left; square QFP — pin 1 top left with the numbering going down,
PLCC — pin 1's side up; the reconstructed CGB-CPU-04 keeps its photo's `giro_rotulo`. Materials are shared by colour
(`cuerpos3d.mat`) and markings by text (one 512 px canvas texture per distinct text, `rotulo`); unit box and cylinder
geometries are shared and scaled; templates of these bodies are keyed by their pads too. `stats.revision` gained
`porTipo` (parts, triangles and library models by `m.tipo`), `genericos` (references drawn as a plain box: none on any
board) and `sinRotulo` (ICs — DIP, SOIC/SOP and QFP with ≥ 8 pins, SIP with > 4 — without a printed marking: none);
`stats.fases.cuadroEn` is when the first frame with the parts was drawn (ms after they were asked for). The sources of
the Neo Geo, SNES and Super DMG-01 are not kept, so `python3 contenido/consolas_pcb.py --reclasificar [ids]` rebuilds
the descriptors from the boards' own JSON (only `huellas[].m` changes; `placa_kicad`/`placa_gerber` call the same
`CC.reclasificar` when a board is regenerated: the NES regenerated from its source is byte-identical to the
reclassified file). Result: Neo Geo 83 resistors with their bands, 62 disc and 28 electrolytic capacitors, 43 marked
ICs (10 QFP/SOP, 24 DIP, 9 SIP), 25 parts without a body (marks, logos, jumpers); SNES 107 test pads without a body
and 15 marked ICs; Mega Drive 13, NES 16 marked ICs; triangles of the parts: Neo Geo 259 k (0.9.2: 23 k), SNES 100 k,
Mega Drive 120 k, NES 80 k; draw calls Neo Geo 146 (30), one per material and marking. Tests: «las placas de las
consolas en 3D: ningún componente queda como caja gris…» and «Neo Geo en 3D con agente de Android…» in
`tests/consolas-placas.spec.ts`.

**Bottom-side parts in 3D (0.8.2).** KiCad stores a bottom footprint's local y mirrored and its angle as seen from
above; `escena3d.colocar` turns the part over about x and rotates it by −a (it used +a: bottom parts at 90°/270° faced
the other way), aligns pad 1 with `oy = m1.y − ly` on the bottom, and `cuerpoSimple` maps local y through `fy` (flipped
on top only). `Escena3D.ladoComponentes`: the face with more than twice the parts of the other is the one the
inclined view shows (`stats.ladoComponentes`). Mask colour `morada` added for Super DMG-01.

**Neo Geo freeze (0.9).** On the Xiaomi Pad 6 (Android 14 WebView, Adreno 650) `#/consolas/neogeo/placa3d` froze
the app with «Colocando los componentes… 236 de 320» on screen (236 is simply where the only yield of the parts loop
fell, after the slow build of U37; the same number shows on desktop). Cause: Chromium on Android rasterises 2D
canvases on the GPU, in the same GPU thread as WebGL and the WebView's compositing, and `pintarLado` / `pintarMapa`
painted the faces' finish with all the copper of a side (≈1700 draws: zones, 536 track paths, 767 pad nets, 407 via
nets) under `clip(aberturas)`, a clip of 2286 mask openings, plus the silkscreen under an even-odd clip of the same
openings; a GPU canvas re-renders such a clip for the draws under it. Reproduced in desktop Chromium with the canvas on
the GPU (`--use-angle=swiftshader --ignore-gpu-blocklist`): the 0.8.2 build never drew the board's first frame in
5 min (GPU process at 200 % CPU); one primitive group under the clip at 512 px did not finish in 300 s, the same
without the clip took 1,3 s; Mega Drive 5,6 s, SDR 4,0 s for a whole 1024 px face. Fix: `Geometria.padsAbiertos[side]`
(the pads with copper and a mask opening on that side; the openings are the pads' outlines) and no clip at all: copper
under the mask, silkscreen, then the exposed pads in one fill on top (the bare-laminate colour of the openings when the
copper is hidden; without mask, laminate then pad copper over the silkscreen); the PBR map fills `padsAbiertos` as
metal. Same picture (the 2D view, Neo Geo zoomed in: 0 pixels differ; at the fit-to-window scale only the anti-aliased
edges of tiny pads, which the clip attenuated twice). With the GPU canvas the Neo Geo now shows its parts 4,5 s after
the tab opens and its full faces at 4,7 s (0.8.2: no frame in 150 s); a 1024 px face costs 5,6 s (Neo Geo), 3,0 s
(Mega Drive), 1,1 s (SDR) there. Default headless Chromium (software 2D canvas, SwiftShader WebGL; 0.8.2 → 0.9, opening
the Neo Geo tab): parts on screen 9,5–10,4 → 9,3–9,8 s (×1 CPU) and 19,1–23,6 → 21,9–23,6 s (×4); first frame with the
parts 95–175 → 4–14 ms (×1), 299–380 → 8–20 ms (×4); the parts' own work (`stats.fases.maxTramo`) 23–28 ms (×1, no
long task) and 62–121 ms (×4: the first library model built, a DIP with its marking, cold); full faces 14–18 → 14,6–15,6 s
and 37–42 → 29–33 s, their longest task 1,8–2,5 → 1,6–2,5 s (×1) and 6,8–8,0 → 2,7–3,1 s (×4). What stays is the
board's own first task (6–7 s ×1, 11–12 s ×4, the same in both): the Neo Geo geometry (1,1 s ×1), the quarter faces
painted on a software canvas and uploaded, and SwiftShader compiling and JIT-ing its draws.

### «Un fotograma» (0.9, `consolas/fotograma/`)

Tab `fotograma` on all seven machines: a guided, step-by-step explanation of how one pixel of one frame comes to exist.
No emulation and no generated data: each machine has a hand-written TypeScript data file
`fotograma/maquinas/<maquina>.ts` (`FotogramaMaquina`, types in `fotograma/tipos.ts`), loaded lazily by
`fotograma/maquinas.ts → cargarFotograma(id)`. Route `#/consolas/<maquina>/fotograma[/<paso>]`, the step 1-based;
`estado.svelte.ts → leerAncla` returns it as `paso` (and no selection) for this tab. Moving between steps replaces the
URL (`history.replaceState`), so Back leaves the tab; a hash change (Back/Forward into it, an edited URL) moves the step.

**Data** (`FotogramaMaquina`): `entrada` (intro sentence), `ejemplo`, `pasos`, `extra` (wires drawn only in this tab,
same shape as the diagram's `Conexion`: the NES PPU `/WE`), `fuentes` [{titulo, url, nota}] (shown in «Fuentes» by
`FotogramaFuentes.svelte`).
- `Ejemplo`: the followed tile — screen size `ancho × alto`, tile size `tesela` (8, or 16 for the Neo Geo sprite),
  position `x, y`, `indices` (colour index of every pixel; `ejemplo.ts` holds the 8 × 8 ball `PELOTA`, its 4-bit
  version `PELOTA_4BPP` with indices 1/6/15 and `doblar()` for 16 × 16), the followed pixel `fila, columna`, CSS
  `colores` per index and `fondo` (backdrop), `bpp`, `formato` `planos` (one byte per plane, leftmost pixel in bit 7)
  | `nibbles` (Mega Drive), `sinHex` (Neo Geo: bits only, its C ROM bit order differs), `ventana` (columns read in one
  fetch: the left half of the Neo Geo sprite line), `numero`, `color` (as the texts write them), `pantalla` (panel name).
  `ejemplo.ts` derives the planes, bytes, nibbles, followed index and screen point; the texts quote the same values.
- `Paso`: `fase` (label), `titulo`, `texto` (1–3 Spanish sentences), `capa` `placa` | `interior` (the Game Boy's «Dentro
  del SoC» diagram), `bloques` (diagram block ids lit), `placa` (board-diagram blocks to mark on the photo when the step
  is drawn inside the chip), `senales` [{id (connection id), sentido 1 | −1 (pulse direction along the connection's
  points), valor, nombre (label when the connection has none, or a more precise one), pos}], `internos` [[name, value]]
  (registers and strobes not drawn), `pantalla` (`Etapa`: `cuadro-anterior`, `vram`, `mapa`, `patron`, `mezcla`,
  `prioridad`, `paleta`, `punto`, `cuadro`, cumulative), `nota` (line under the example screen; otherwise derived).
- Steps: NES 15, Neo Geo 14, Master System 13, Mega Drive 13, Game Boy 14, Game Boy Color 14, Super Nintendo 13. The
  diagram is the machine's «Arquitectura» board diagram (`arquitectura/<maquina>.ts`; Mega Drive and Super Nintendo in
  their default PAL variant, as the boards), so chip and signal names match across tabs.

**Components.** `Fotograma.svelte` (loads the steps and the architecture model, header with the intro and a segmented
bar of buttons — done segments in the block colour of chapter 37, the current one amber, a fill animation while
playing — and «n/N»; the step card with «Lo que viaja»: every lit wire with a value plus `internos`; the cards below;
`pregunta/PieAcciones.svelte` with «Anterior», «Reproducir»/«Pausa» and «Siguiente» / «Desde el principio»; keys ← →;
autoplay pause = 4,5 s + 55 ms per character of title and text, 7–20 s; layout: one column, then from 700 px step /
diagram / screen + board, from 1100 px diagram + step / board + screen). `DiagramaPaso.svelte` draws the `Diagrama` as
SVG in the «Arquitectura» palette (`animaciones/nucleo/paleta.ts`, class colours as `arquitectura/dibujo.ts`): idle wires
and labels, blocks (`data-bloque`, `data-activo`), lit wires (`data-conexion`) as halo + line with an arrow marker +
dashed pulse animated along the points (reversed for `sentido −1`; no animation with reduced motion), and label pills
«name = value» kept inside the drawing. Under 700 px the view frames the lit blocks and labels (tweened 420 ms, at most
1,35 CSS px per unit, aspect 1,2); a step whose parts are further apart than the screen allows at 0,62 px per unit is
drawn wider, in a sideways-scrolling box centred on it; «Ver el diagrama entero» toggles. Label size grows so that it
never falls under about 10,5 CSS px. `Pantalla.svelte`: the example screen (SVG, previous frame dimmed, tile frame,
the new frame up to the followed pixel at stage `punto`, a ring on it), the tile enlarged and the row arithmetic (bits
per plane with their bytes, or bytes of two nibbles, the index row, coloured from stage `paleta`). `PlacaPaso.svelte`:
the photo («Foto» hotspots of the lit blocks: the block's `foto` hotspot, or hotspots of the same block sharing a
schematic reference; the photo of `fotosDe()` that shows most of them), cropped to them (tweened), the rest dimmed
through a mask, the boxes pulsing, and chips linking to `#/consolas/<maquina>/foto/foto:<id>`. Hook for the tests:
`__epaFotograma {maquina, total, paso, capa, bloques, senales, reproduciendo, duracion}`.

Tests: `tests/fotograma09.spec.ts` (`playwright.fotograma09.config.ts`, port 4341, its own build in the system temp
folder): 10–16 steps per machine, next/back/segments/keys/URL/reload/out of range, autoplay and pause with Playwright's
clock, every lit block and wire present and lit in the drawn diagram on every step, and on a 412 px phone no text
outside the screen on any step. Screenshots: `node tests/fotograma09-capturas.mjs` → `tests/capturas/fotograma09/`.

Replaces (0.9) the 0.8 cycle-level trace player: `consolas/fotograma/` (player, trace reader, adapters,
disassemblers), `web/public/consolas/fotograma/` (traces), `contenido/fotograma/` (emulators, generators,
cross-checks), `contenido/consolas_demos/` and `contenido/consolas_juegos/` (demo programs and homebrew ROMs used
only there), `tests/fotograma*.spec.ts`, `tests/fotograma-*.mjs` and their Playwright configs were removed, and the
`alPintar` hook of `esquema/Lienzo.svelte` that only the player used.

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
and `__epaPlaca2D` for the tests), `escena3d.ts` + `Vista3D.svelte` (below; bodies in `modelos3d.ts` and, 0.10,
`cuerpos3d.ts`), `EsquemaPlaca.svelte` (the consoles'
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
lights, room environment, contact shadow) and orbit (`tres/motor/orbita.ts`) are reused. Board: FR-4 core as walls only (the
outline's and every hole's, built directly; its top and bottom, the outline with the holes cut by a texture painted on
first use, are drawn only with the layers apart or in X-ray: 0.8.2, the extrusion with every hole took seconds to
triangulate on a tablet with the Neo Geo's 7500 holes and its caps fought with the faces when zooming in), faces textured from `pintarLado` (≤ 4096 px on the long side, about 21–37 px/mm, uploaded at once
and the canvas freed) plus a half-size metal/roughness map (glossy mask, matt silkscreen, metallic pads), plated barrels
in one InstancedMesh, overlays for the selected net and voltages. Loading (0.7): the faces are first painted at a quarter
of the resolution (a few ms: the board is on screen at once) and repainted at full resolution, one face per task, after
the first frame with the parts (their uploads would otherwise queue in front of the parts' shaders), or 4 s after the
scene is created if no parts are loaded; `cargarPiezas(alProgreso?)` builds each distinct part once (same library model
and parameters — and value, for the parts whose marking comes from the library's table —, or the same simple body:
72 templates for the SDR's 131 parts), flattened into per-material triangle arrays in the part's axes
(`plantilla()`), then writes every copy, transformed by its board matrix, straight into one buffer per material in
slices of about 12 ms (0.9: 6 ms) (`scheduler.yield()` or a macrotask between them: the page stays responsive and the view shows
«Colocando los componentes… n de N» with a bar), compiles the shaders with `renderer.compileAsync()` (in parallel where
KHR_parallel_shader_compile exists; 0.9, without it: `prepararPorPartes()`, one material per task — `compile()` of one
mesh, `properties.get(material).currentProgram.getUniforms()` so three reads the link status in that task instead of
all programs at the first frame, `initTexture` of its maps —, also for the board's own programs) and only then adds
the parts: the same meshes and draw calls as before (40–60 per
board). The depth range follows the board (`Orbita.escena`). `stats.fases` (models, merge, shaders, first frame, total,
distinct models), `stats.cuadros`, `stats.programas` (shader programs after the first frame with the parts) and `stats.carasFinas` (ms
to the full-resolution faces) are in `__epaPlaca3D`.
0.9: `cargarPiezas(avisos)` takes `{alProgreso, alFase}` (or the old progress callback), runs once (`piezasPedidas`),
and `Vista3D` only calls it while «Componentes» is on (at mount or when the toggle is turned on; with it off the view
is ready at the board's first frame, `Escena3D.placaLista`, and `stats.fases`/`stats.revision` stay undefined).
While loading, `stats.revision` (`RevisionPiezas`) checks every template — non-finite positions or normals, a vertex
count not a multiple of 3, more than 400 000 vertices: refused, the part gets `cuerpoSimple` — and every library
model: its distinct pad numbers against the footprint's numbered, plated pads (`pinesDistintos`: SDR T1, a 5-pad
trifilar toroid against the library's 2-lead toroid) and how far each lead lands beyond its pad once placed
(`patasFuera`, refused beyond 0,5 mm: the SDR's vertical toroids and 3296W trimmers, the Mega Drive's vertical ferrite
beads, 2 mm headers and double DIP-28, NES double DIP-24s; `maxDesvio` of the accepted ones ≤ 0,41 mm on all 14
boards); the merged buffers are scanned for non-finite values (`fusionNoFinitos`, 0 everywhere). `claveBiblioteca`:
TO-220 only with 3 pins, DIP only with 7,62 mm rows (the library draws every DIP at 7,62 mm). `cuerpoSimple(h, pads)`
gets the footprint's pads in local mm (`padsLocales`): a vertical TO-220/TO-247 body has its tab at the back of the
fab outline (away from the row of leads) and one lead per pad (bent to the body's plane when the row is not under it:
the Neo Geo's U37, LM2576T-5, TO-220-5); a DIP the library does not draw gets its body between the rows, a lead and
shoulder on each pad (the one nearer the centre of two pads with one number) and its marking; a 3296 trimmer its brass
screw; film capacitors are red. `stats.compilacion` = {programas, paralela, maxPrograma}; `stats.fases.inicio`.
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
unchanged (Chromium on the desktop: WebView2, the same behaviour as 0.7, deliberately not switched by any timing);
**trabajador** (WebKit: WKWebView, WebKitGTK; Android tried it in 0.9.1 and went back to directo in 0.9.2, because
the worker's quick pass closed the app on the Xiaomi Pad 6 at once) — a worker per view rebuilds the geometry from
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

**0.12: the 3D boards under a slow device** (QA 0.11, `fase2-lento`: CPU ×4 + «Fast 3G», the IoT board took 40–47 s
to show its content; tracing showed what the page was waiting for). Causes and changes:
- *The studio's environment* (`tres/motor/entorno.ts`). `crearEstudio` ran `PMREMGenerator.fromScene(RoomEnvironment,
  0.04)` (size 256: a 768 × 1024 RGBA16F cubeUV map) in every new WebGL context: every board, model page, glossary
  picture and thumbnail renderer. With SwiftShader the GGX filtering took 8–9 s of GPU (size 128: 3 s, 64: 1,5 s), and
  every synchronous GL call issued after it waited for it: the link status of the board's first program (three's
  `getUniforms`/`checkShaderErrors`), `texSubImage2D` of a canvas, the drawing-buffer check of a canvas resize (the
  ResizeObserver's `setSize`: `GLES2::GetGLError`), and — a software-compositing artefact of headless Chromium — the
  compositor's read-back of a changed WebGL canvas at the next commit (`Commit → ReadPixels → Finish`): long tasks of
  5–18 s. On a real GPU the filtering is milliseconds, but it costs 3–4 programs (the room's materials, cube-to-cubeUV,
  GGX), compiled synchronously where there is no KHR_parallel_shader_compile (Adreno 650). Now the PMREM is computed
  only when this device has no copy; once the board's first frame has been presented (`crearEntorno(renderer,
  { lecturaTras })`, two animation frames after `placaLista`; at once in the model viewer and the thumbnails; at
  `liberar()` if the view closes before that, while its texture is still there) the map is read as
  RGBA/FLOAT (always allowed with EXT_color_buffer_float) into a pixel-pack buffer, a fence is polled between tasks
  (`getSyncParameter`), the floats are copied out in 256 kB slices and converted to half floats with
  `DataUtils.toHalfFloat` (exact), checked (`sanos`: finite, alpha 0 or 1, at least half the map used), kept in memory
  and stored in IndexedDB `epa-cache-3d` / store `entorno`, key `sala|v1|r<REVISION>|0.04|256` ({clave, w, h, espacio,
  datos: ArrayBuffer}; a database of its own, outside the user's data, backups and sync). Later views
  (`crearEntorno`) build a `DataTexture(Uint16Array, w, h, RGBAFormat, HalfFloatType)` with the render target's
  mapping (`CubeUVReflectionMapping`), name, filters (Linear, no mipmaps), `flipY` false and colour space: the same
  program defines (`envMapCubeUVHeight`) and the same picture — screenshots of five boards (two KiCad, the IoT, two
  consoles) and two 2D views, tablet and desktop, 0.11 against 0.12: 0 pixels differ. `precargarEntorno()` (Vista3D
  awaits it, at most 600 ms, before creating its context) reads the saved copy once per page; `soltarContexto()`
  replaces `forceContextLoss()` in `Escena3D`, `Visor` and the thumbnails: a view closed while its environment is still
  being read back keeps only its context (drawing buffer shrunk to 1 px) until the read ends, at most 60 s
  (`PLAZO_LECTURA`), so a QA run that leaves at the first content still saves it. `window.__epaEntorno` =
  {origen, lectura, guardado, leidoDeBd, leerMs, error}; `stats.entorno` ('pmrem' | 'memoria'); the diagnostic shows
  it as «Entorno del estudio» under the SDR board. Memory: the saved copy is 6,3 MB of JS memory for the session
  (one `Uint16Array` shared by every view) and the same 6,3 MB texture per view as before; the PMREM's own targets
  (pingpong 6,3 MB, cube 3 MB) are no longer created; the first-ever read uses a 12,6 MB pixel-pack buffer until the
  GPU has filled it.
- *Order in the constructor* (`escena3d.ts`): `crearEstudio(renderer, { entornoLuego: true })`, the canvas sized from
  its layout box (`tamano`, which now skips an unchanged size), the quarter faces uploaded, and only then
  `estudio.ponerEntorno()`; `prepararPlaca()` and the parts (before building them) await `estudio.entornoListo()` (a
  fence; immediate with the saved copy), so no link status is read while the GPU filters, and with a CPU-emulated GPU
  the parts' CPU work does not slow the filtering down (`stats.fases.esperaEntorno`, not part of `modelos`). The
  fences are polled every 16 ms with a `gl.flush()` each time: without it, with nothing else sent, Chromium reported a
  fence seconds after the GPU had passed it (13 s against 6,5 s here). The canvas is `visibility: hidden` until its first frame (the
  view's background instead of an opaque black buffer meanwhile). The filtering and the read-back end with three's
  `setRenderTarget(null)`, which floors the canvas viewport in device pixels where `setSize()` rounds it; since both
  now come after the first `tamano`, `reponerVista()` (entorno.ts) sets the viewport and scissor again as `setSize()`
  leaves them (0.12 QA: on the tablet, a 572,4 px high canvas at 2×, the first open drew 1144 rows instead of 1145 and
  1,1 % of the NES board's pixels differed from 0.11 and from the second open; `regresiones12`).
- *Fetching*: `Proyectos.svelte` and `PlacaConsola.svelte` import `Vista3D.svelte` (three.js, ≈ 900 kB, ≈ 240 kB
  compressed) as soon as the route is a 3D view, in parallel with the board's JSON, instead of after its data and
  geometry; `Vista3D` asks `cargarBiblioteca()` at creation (the model library was requested only once the scene
  existed — behind the long tasks above).
- *Geometry* (`geometria.ts`): Chromium's `Path2D.closePath()` costs time proportional to the whole path (153: 16 000
  four-point subpaths take 1,3 s with it, 2 ms without), so closing every pad, slot, zone and silkscreen fill was
  quadratic: the Neo Geo's `construirGeometria` (over 20 000 closes) took about 0,7 s, 3 s with the CPU ×4, before its
  2D or 3D view could open. Those paths are only filled, clipped or hit-tested, where an open subpath is closed
  implicitly (same pixels): `poligono` and the zone and fill loops leave them open; the outline (one subpath) and the
  rule areas (stroked dashed) keep `closePath`. The consoles' schematics (`consolas/esquema/dibujo.ts`) close only the
  polygons of filled layers, spread over 8 × 8 tiles: opening the largest sheets (SNES, Mega Drive, NES, Neo Geo) with
  the CPU ×4 calls it 0–135 times for 0 ms in all, so they are left as they are.
- Unchanged on purpose: the Android face size (`ladoCarasDispositivo`, 0.9.2), the release of every board on unmount
  (0.11 leak fix), the merged meshes (57 draw calls for the IoT, 63 SDR, 72 lab supply, 83 NES, 146 Neo Geo) and the
  parts' slices. What remains of the load under SwiftShader is GPU work the CPU emulates (each frame of a 2.4 Mpx PBR
  view, 1–4 s here with the machine shared) and the canvas read-backs of headless compositing; the CPU side of a warm
  IoT board is ≈ 0,7 s of JavaScript (parts ≈ 120 ms, faces ≈ 180 ms of canvas uploads).
- Measured (scratch script reproducing `fase2-lento`: tablet profile with the Xiaomi's UA, CDP CPU ×4 + Fast 3G;
  cold = empty cache, the app opened on the route; warm = from the start page in the same document, as the QA does;
  0.11 and 0.12 builds interleaved, 5 runs each, medians; SwiftShader on a shared 2-core machine at load 4–6).
  Seconds; «cold 1st frame» is on the page's clock (scene created + its first frame drawn, `stats.primerCuadroPlaca`),
  «cold board seen» is when a poll from the test first saw a frame (a poll cannot run while the page is blocked or
  busy placing the parts, so it lags behind the frame):

  | board | cold content | cold 1st frame | cold board seen | cold with parts | warm content (= parts, calm) | warm 1st frame after the scene | warm full faces | warm longest task |
  |---|---|---|---|---|---|---|---|---|
  | IoT | 22,9 → 10,8 | 21,1 → 20,8 | 22,9 → 25,2 | 26,5 → 25,2 | 14,0 → 4,6 | 9,9 → 0,7 | 18,1 → 10,9 | 8,8 → 2,6 |
  | SDR | 29,8 → 11,0 | 26,1 → 21,3 | 29,8 → 27,2 | 32,7 → 27,2 | 15,9 → 8,1 | 10,8 → 0,7 | 19,9 → 15,7 | 10,0 → 4,1 |
  | lab supply | 23,6 → 10,7 | 22,5 → 21,3 | 23,6 → 25,6 | 27,3 → 25,6 | 14,0 → 6,0 | 9,2 → 0,7 | 17,4 → 9,9 | 8,4 → 2,8 |
  | NES | 27,7 → 12,6 | 24,7 → 22,7 | 27,7 → 27,6 | 30,0 → 27,6 | 14,5 → 7,1 | 10,9 → 0,8 | 22,2 → 12,0 | 10,0 → 2,7 |
  | Neo Geo | 28,7 → 14,0 | 28,2 → 24,3 | 29,0 → 32,4 | 35,7 → 32,4 | 20,2 → 9,0 | 9,3 → 1,3 | 27,7 → 16,2 | 8,1 → 3,3 |

  Unchanged: draw calls (57, 63, 72, 83, 146), GPU memory at rest (estimated from the WebGL allocations: 73, 75, 78,
  84, 131 MB). JS heap with the view open +6 MB (the saved environment); the peak GPU estimate +12 MB once (the first
  read-back's pixel-pack buffer). A first version issued the read-back right behind the filtering, before the board's
  first frame, which drew it 1,8–2,6 s later than 0.11 on a cold start; now it waits for that frame to be on screen
  (test «la primera vista del dispositivo dibuja la placa antes de leer el entorno»), and the cold first frame is at or
  before 0.11's on all five boards. The warm longest task left is the headless compositor reading back a frame of
  SwiftShader.
- Tests: `tests/rendimiento12.spec.ts` (`playwright.rendimiento12.config.ts`, port 4531; tablet with the Xiaomi's UA
  and desktop): the first view on a device draws its board before the environment is read back, the second board
  uses the saved environment and looks the same (≤ 0,1 % pixels, in practice 0), a
  reload reads it from IndexedDB, leaving the board at once still saves it and every WebGL context ends lost, CPU ×4
  with the environment saved (first board frame < 4 s; 0.11: 6,7–19 s, 0.12: 0,45–1,5 s; parts' longest slice < 400 ms), fewer than 200
  `Path2D.closePath` calls opening the Neo Geo in 2D (0.11: 11 641), and the 3D code requested before a delayed board
  JSON arrives. Each failed on the 0.11 build.

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
cap29/prob-29.C-decodificador; 0.9, «Placa de consola en 3D (Neo Geo)» (`placaConsola`: data, geometry, board
visible, board with parts, the page's longest gap over the whole load, full faces, `stats.revision`); ngspice
(`simularTexto` of the simulator's client: fig. 3.1, first run with the
download and compile of the engine, then a second one). The views draw in a visible box of the page (browsers do not
draw hidden canvases) and are disposed after each test. The results go to a table grouped by test with ok / warning /
error marks and to plain text («Copiar resultados»: clipboard, or the text selected in a textarea where the WebView
has no clipboard permission). Breadcrumbs (0.9, `Migas` in localStorage `epa-diagnostico-migas`: {prueba, inicio,
fases [[ms, phase]], fin?}): `migasDe(test)` before each test, `ctx.miga(phase)` as each phase starts («empezando»,
«datos», «geometría», «caras», «pieza 237: R1», «uniendo», «compilando 2/9», «primer cuadro», «caras a resolución
completa»; consecutive phases of one kind replace each other), `terminar()` sets `fin`; a record without `fin` found
when the page opens becomes the row «La última prueba se quedó en: <phase> tras N s» (`filaMigas`), kept on top of
the next run's results and in the copied text. The 1 s pause after each heavy 3D test is kept. Test: `tests/diagnostico.spec.ts` (opened from «Aa», nothing before «Empezar», every
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
0.10 (instruments on the user's own circuits):
```
puntas.ts        leads and probes: names, colours, letters (light: the breadboard imports it without the bench);
                 the earphone «esc» and, on the breadboard, the generator's leads «genRojo»/«genNegro»
guia.ts          GuiaBrymen / GuiaFnirsi: what a tutor lights up (a dial position, a jack, a button); Brymen.svelte
                 and Fnirsi.svelte take `guia` and draw a pulsing ring, nothing else changes
banco/activo.svelte.ts  activarBanco(b, activo?): the simulation request, the 5/s readings and 8/s acquisitions,
                 BeepJack and cleanup, out of Banco.svelte so the breadboard reuses them
banco/Aparatos.svelte   the two instruments with their captions and a «?» each (side by side ≥ 640 px of the
                 surrounding container, tabs below)
banco/Escuchar.svelte   listening to the earphone or a channel (Banco.escucha) with volume and level meter
motor/escucha.ts prepararEscucha(serie, rate): DC removed; a periodic signal (frequency counter) resampled from its
                 last period to ≈ 1 s exactly periodic (pitch right, no click); < 20 Hz: why not, and its clicks
                 (300 Hz high-pass) as an alternative; > 20 kHz: why not, and the peak envelope per carrier period
                 when it varies by > 10 %; not periodic: the stretch once
auricular.ts     Web Audio: buffer source (loop) → gain (volume; 0 dB = 1 V peak at the knee) → tanh wave shaper
                 → output gain → analyser (level, tests: window.__epaAuricular) → speakers; the context is created
                 or resumed only in a gesture, suspended on stop
editor.ts        «Medir» of the schematic editor: netlist + dibujoVivo() drawing as a Plano «auto» source, kept in
                 sessionStorage; VistaBanco handles #/instrumentos/editor («← Editor»)
```
`motor/montaje.ts` gained `escucha` (the node and its reference are saved; a transient of at least 60 ms with a
step ≤ 1/48 000 s) and `arranque` (power-up: plain DC sources become `PWL(0 0 1u V)` when there is a transient, and
with a known source frequency the instruments look after 20 periods, ≤ 0,2 s). `Banco.correr` retries once when
another simulation of the page cancelled its run. `autoVertical` raises V/div until the trace fits the screen with
the ±4-division position (a small signal on a large DC level).

Tests: `tests/instrumentos.spec.ts` (screenshots `tests/capturas/instrumentos-*.png`), `tests/instrumentos10.spec.ts`
(0.10: the breadboard's instruments and tutor, the editor's «Medir»; screenshots `tests/capturas/instrumentos10/`).

### Guided labs «Laboratorio guiado» (1.1, `practicas/laboratorio.ts`, `laboratorios.ts`, `PanelLaboratorio.svelte`)

Route `#/instrumentos/laboratorio/<n>`: `VistaBanco` with `tipo = 'laboratorio'` takes the practice `n` (`PRACTICAS`)
and its lab (`laboratorioDe(n)`), starts the bench with `iniciarLaboratorio` (the variant's circuit, leads off, the
instruments as `lab.inicial` says: Brymen OFF, FNIRSI oscilloscope at 1 V/div ×10, generator off) and shows
`PanelLaboratorio` instead of `PanelPractica`. `Banco.svelte` gained `guiaBm`, `guiaFn` and a bindable `pestana`
(passed to `Aparatos`; defaults keep every other page as it was); the panel drives them through a `ControlLab` object.

**Model** (`laboratorio.ts`, pure): `Laboratorio {n, inicial: Ajustes, pasos: PasoLab[]}`; `PasoLab {id (stable,
stored), titulo, texto (HTML), preparar? (Ajustes the book's set-up applies when the step first shows: a variant, the
supply), requisitos: {ok(b), pista}[], lectura? {que, unidad, medir(b), tol {rel?, abs?}, porqueTol, libro? (id of
the practice's check)}, guia? {bm?, fn?, instrumento?}, hazlo (Ajustes, or a function of the bench when the cursors go
on a crossing of the trace), cursores?, tabla?, errores? {nombre, hacer (Ajustes or a direct change), pista}[]}`.
`evaluarPaso(paso, b, escrito)`: the first unmet requirement → `mal` with its hint (requirements for the typical
mistakes come before the generic ones, so the hint names the mistake); with a reading: `espera` while the bench is
not `vigente` (the panel checks again by itself when it is), the instrument's value `medir(b)`, the typed text read
by `magnitudes.leer`, accepted within `max(abs, rel·|v|)`, else a hint for a missing prefix, a factor of ten, or
«léalo de nuevo (se admite …: porqueTol)». Requirements and readings only read the bench: `ch.sondaX10/menuX10`,
`ac`, `vDiv`, `sDiv`, `disparo`, `mates`, `cursores`/`cur`, `prm`, `xy`, `dds`, `captura.recortado`, `b.sondas`,
`b.bm`/`b.fn` (leads, series), `brymen.posicion/sub/borne/crest/ids`, `fnirsi.modo/fnDmm/borne`, `b.alimentado`,
`b.avisoFusible`, `b.anotaciones`, the netlist's parameters. Cursor requirements compare a cursor with a crossing of
the 8-bit capture (`cruce`: `t0 + i·dt` relative to the trigger, screen division `(t − hpos)/sDiv`) within 0,06 div;
the AM envelope comes from the simulated waveform at the probe (`entradasOsc`). `Ajustes.bm.crest` (new, `aplicar.ts`)
turns CREST on showing the maximum. `idPaso(n, paso)` = `cap22-lab<n>-<paso>`.

**Labs** (`laboratorios.ts`): 12 labs, 50 steps, 41 typed readings — 38 of them tied to the practice's checks (the
summary compares them with `esperado ± tol`) —, 24 typical mistakes. `mapa.ts`: `PRACTICA_DE_SECCION` (book label → n, also used by
`VerPractica`) and `PASOS_LAB` (steps per lab, for progress outside the bench; a unit test keeps it equal).

**Panel**: segmented progress (a button per step: done, current, the next pending), the step card (title focused on
change, text, keyboard sliders for the two cursors when the step uses them, the noted-points table of practice 9, the
reading field — Enter checks —, «Comprobar», «Mostrar dónde», «Hágalo por mí», a polite live verdict, «Continuar»),
«Lo que muestra la pantalla del FNIRSI» (the canvas in words: channels with scale, probe factor, coupling, PRM values;
time base and trigger; cursors; FFT cursor levels as the screen draws them) and the summary (each reading against the
book, the practice's closing remark, the next lab, «Repetir», «Volver al libro»). Styles: the `--v11-*` tokens
(`tokens11.css`), 44 px targets, transitions only without `prefers-reduced-motion`.

**Events and storage**: each «Comprobar» that is not `espera` is a `respuesta` `{id: idPaso, clase: 'practica', origen:
'laboratorio' (new in `OrigenRespuesta`), correcta, intento, pistas (1 after «Mostrar dónde»), final (right, or the
second attempt), parte: 'cap22', seccion: the practice's label, subtipo: 'laboratorio'}` — XP `pr:<id>` once (10 / 5),
mastery of the section; nothing after the round is closed or for a step already done; «Hágalo por mí» closes the round
as not answered (no XP); `registrarActividad('pregunta')` per closed round. A step done →
`lib/laboratorio.svelte.ts anotarPasoLaboratorio` → almacen key `laboratorio` (ESQUEMAS v1, a new key: no migration)
`{version: 1, practicas: {"p<n>": {h: [step ids], l: {<step>: [typed value, ms]}, c: first completion ms | 0, t, a?: [step ids]}}}`,
through a `Guardado` (`claveSinc: 'laboratorio'`: its writes are marked) with `unirRegistrosLab` (`lib/laboratorio.ts`, pure: union of `h`, per step the newer reading —
same time, the larger value —, the earliest `c`, max `t`; commutative, associative, idempotent), synchronised as store
`laboratorio` with the same `unir`. Nothing is ever removed (no deletions to resurrect). On opening, the lab resumes at
`pasoPendiente` with the earlier steps' `preparar` and static `hazlo` applied.
Review 11a: `a` (absent when empty; union in the merge, like the exercises' `_r` keeps the help of a solve) = the steps
«Hágalo por mí» did (`anotarAyudaLaboratorio` → `anotarAyudaLab`): `pasoDaXp(r, paso)` is false for them, so neither a
later visit nor another device closes their round with XP. A lab is completed when `c` is set **or** `h` covers every
step (`labCompletado(r, pasos)`: two devices that did different steps merge to a full `h` with `c` 0; the instruments'
`Portada` reads it, as `PanelLaboratorio` already read `h`). Projects: `etapaDaXp(r)` (`proyectos11/registro.ts`) =
not passed and the book's design never shown (`s`, merged as the earliest). Tests: `tests/revision11a-unidad.spec.ts`
(D1, D2, C3: scenario `r11a·2` of `tests/motor-real/escenarios11a.ts`), `tests/revision11a-navegador.spec.ts`.

**Course path** (`cursos/PaginaCursos.svelte`, `Camino.svelte`): after each cap22 lesson with a practice, a node
`laboratorio/<n>` (`tipo: 'laboratorio'`, flask icon), outside `calcularCamino` (it never blocks nor moves «la
siguiente»): done (`c`), started, or open/locked with its lesson; the list view has a row per lab.

Fixed on the way (regression test): the variant `p3_suelto` named a circuit that did not exist (`CIRCUITOS.p3_suelto`),
so the diode test of practice 3 loaded nothing and the Brymen read OL.

Review 11c (fix 11c): `cruce` is now `cruceS` (seconds from the screen's centre, after `desdeS`) divided by the base on
screen; a `hazlo` that changes the time base converts the seconds with the base it applies (lab 5 «fase»: the cursors
had been computed in 200 µs divisions and applied at 100 µs/div); its Δt comes from the simulated waveforms at the
probes (`retardoP5`, not the 8-bit capture), B is rounded as A plus the rounded difference (`cursoresEn`, every lab),
and the panel applies such a `hazlo` once more on the first acquisition at the new base (`refinar`: a new `captura`
whose `dt` matches the new base, with the bench `vigente`). `Ajustes.fn.activo` (new, `aplicar.ts`) makes a
channel active: lab 11 «índice» converts with CH1's scale and activates it. `evaluarPaso` also names a unit written
without (or with another) prefix and a value with its sign changed (dB of an attenuation), before the factor of ten.
`rAlimentado(false, 'ohm' | 'diodo' | 'cap')`: the capacitance meter's hint says the simulator (an AC small-signal
model) reads the same with the supply on, and why a real one does not. «Repetir el laboratorio» keeps where the
repeat goes in `sessionStorage` `epa:laboratorio-repaso` = `{n, paso}` (a per-tab convenience, nothing of the record
changes; cleared at the summary) and prepares each step again (`preparar`) while repeating. Narrow screens:
`Banco.svelte` gained `lateralArriba` (the panel first in the one-column grid) and `barra` (a snippet rendered last in
the grid, `position: sticky; bottom: var(--hueco-inferior)`); `ControlLab.barra` carries the panel's `barraPaso`
snippet — step, reading (`data-lectura-barra`), «Comprobar» (`data-comprobar-barra`) or «Continuar», the hint —, shown
while the step's own buttons are out of view (IntersectionObserver) and hidden by `@container (min-width: 940px)`. The
reading field's class is `campo-lectura` (`.lectura` is the reading pane's global class, `estilos/lectura.css`, whose
padding and size had pushed it past the card at 360 px), the table's `tabla-lab`.

Tests: `tests/laboratorio11-unidad.spec.ts` (Node; `tests/laboratorio11/banco-node.ts` runs every lab on a real
`Banco` with the loader `tests/laboratorio11/hooks.mjs` — the app's `hooks-svelte.mjs` plus `motor-node.ts` in place
of the simulator's worker client —; `xp-node.ts` the XP rule) and `tests/laboratorio11-navegador.spec.ts`
(`playwright.laboratorio11.config.ts`, port 4684, build in `/tmp/claude-0/epa-practicas11/dist`).

## Projects by stages «Proyectos por etapas» (1.1, `lib/proyectos11/`, `componentes/proyectos11/`)

The four detailed projects (printed 48–51, files cap49–cap52) built stage by stage in the schematic editor, each stage
checked by simulating the reader's drawing against the book's specification. No new engine: the editor (its documents,
`generarNetlist`, `importarNetlist`, «Mis circuitos»), the simulator's worker (`lib/simular-diseno.ts medirDiseno`, the
one the design questions use) and the learning events/XP of the guided labs.

**Data** (`etapas.ts`, types in `tipos.ts`): `PROYECTOS` (order: supply, IoT, Hi-Fi, SDR — the book's «por dónde
empezar»), 13 stages `Etapa {id 'capNN-k' (stable, stored), n, titulo, objetivo (≤ 40 words), especificacion (book
lines with their numbers), secciones (labels; the first is «la teoría»), leccion? ('capNN/sec-…' of the 1.1
Fundamentos), modelo (what is modelled, which values are the app's), netlist (the starting circuit, no analyses: the
book's complement netlists cut to the block, with starting values that do NOT meet the spec), control (.control lines:
analyses, `alter`/`alterparam`+`reset` for the line/load cases, `let`, `meas`, `print`), componentes: ComponenteEtapa
{id = the part's designator or a `.param` name, tipo pieza|param, nombre (HTML), unidad, series (E12/E24/E96, any of
them; [] = free value: a trimmer, a voltage), min, max, papel, referencia (text), delLibro}, medidas {id, nombre,
unidad, informativa?}, derivadas?(m, valores) (values computed in TS: a regulation from two `op` plots — `let` vectors
do not survive a new analysis —, I²R…), condiciones {medida, min?, max?, texto, siBaja?, siAlta?}}`. `indice.ts`: the
light copy (parte, titulo, corto, stages' id/n/titulo/secciones) that the reader's section chips, the chapter card,
the courses and the progress counts import, so the reader does not load the netlists; a unit test keeps it equal.
Thresholds the book states loosely («unos 2 A», «unos 70 dB») became ranges; each one with its source is in the
owner's review list (scratchpad revision11/proyectos11.md). Not staged: printed 47 (file cap48, its designs are these
projects' maps, no values: `PARTE_INTEGRACION`, linked), and what is not a circuit to simulate (energy budget,
firmware, mains side, grounding, the Tayloe detector — minutes of simulation —, the DSP).

**Checker** (`comprobar.ts`, pure; the simulator passed in, `Simulador` of `diseno-ejercicio.ts`):
`valoresEtapa(e, doc)` — each design value found in the drawing (a part by designator, case-insensitive, its `valor`
field; or `.param` in the directives), read with the editor's `leerValor`, in range and series (`esDeSerie`, E96
included), else the first problem as the message (missing/renamed part → «Restaurar la etapa»; expression; missing
param) — nothing simulated; `netlistEtapa(e, doc)` — `generarNetlist(doc)` (its errors stop it: no ground, a value…),
minus every `.control…​.endc`, analysis and output line and the «* análisis elegidos en el editor» comment, plus the
stage's `.control`; `medidasEtapa` (printed names case-folded, derived values), `evaluarEtapa` (per condition: NaN →
«no se pudo medir» with a hint about the net names; below min → `siBaja`, above max → `siAlta`), `comprobarEtapa →
ResultadoEtapa {tipo bien|mal|ilegible, mensaje, condiciones, informativas, valores?, medidas?}` (`ilegible`: not
simulated, not an attempt; a thrown simulation → «La simulación no terminó»). `conValor(doc, c, v)` writes a value as
the editor writes it (`formatoValor`: «4,7k», «10m»; a param as a SPICE number), `textoEnDibujo` reads it back.
The reader's own topology is judged by what it measures (test: the starting 10 kΩ pull-up plus a 4,7 kΩ in parallel
passes).

**Circuits** (`componentes/proyectos11/circuito.ts`): a stage's circuit is an ordinary saved circuit (`editor-circuitos`,
synchronised as always) made with `importarNetlist(e.netlist, {tipo: 'proyecto', id: e.id})` (`DocumentoEsquema.origen`
gained `'proyecto'`) titled «<corto> · Etapa n: <título>»; `asegurarCircuito` (one at a time per stage) reuses the
record's `c`, else a saved circuit with that origin (made on another device before the records met), else makes one;
`restaurarCircuito` redraws the same id from the netlist. The editor shows `BandaEtapa` (stage, «Volver a la etapa y
comprobar») for a document with `origen.tipo === 'proyecto'`, « · circuito de un proyecto por etapas» next to the save
state, and a «Proyectos por etapas» link in its header.

**Storage** (`registro.ts`, pure; `estado.svelte.ts` the Guardado): almacen key `proyectos` (ESQUEMAS v1, new key, no
migration) `{version: 1, etapas: {"<stage id>": {c, tc, h, m: {v, r, t} | null, n, s, t}}}` — circuit id and when it
was assigned, first pass (0 = not yet), values/measurements of the latest pass, simulated checks, first time the
reference design was shown (0 = never), newest change. `anotarCircuito`, `anotarComprobacion` (a pass keeps the first
`h`; a later failure never removes it), `anotarSolucion` (earliest), `ahora` never before the record's `t`. Merge
`unirRegistrosEtapa`: circuit of the larger `tc` (tie: larger id), earliest `h` and `s`, pass with the larger `m.t`
(tie: larger JSON), max `n`, max `t` — commutative, associative, idempotent; nothing is ever removed. Synchronised as
store `proyectos` (`registro.svelte.ts`) with the same merge, `claveSinc` set.

**Events**: each simulated check (`mal`/`bien`, not `ilegible`) of a stage neither passed nor helped (`!h && !s`) emits
`respuesta {id: 'proy-<stage id>', clase: 'practica', origen: 'proyecto' (new in OrigenRespuesta), correcta, intento:
n + 1, pistas: 0, final: correcta, parte, seccion: secciones[0], subtipo: 'proyecto'}` → XP `pr:proy-<id>` once (10 at
the first check, else 5), mastery of the section; a pass also `registrarActividad('pregunta')`. «Usar estos valores»
(the reference, offered after two failed checks or once passed, with `confirmar` when not passed) sets `s`: no XP after.
Review 11c: «Ver el diseño de referencia» sets `s` too (asked with `confirmar` when not passed and `s` not set yet), so
typing the values seen by hand gives no XP either; the SDR attenuator's two hints say what each change does to the
other condition (they no longer contradict each other).

**UI**: route `#/etapas[/<parte>[/<n>]]` (`ruta.vista = 'etapas'`, `ancla`; lazy `PaginaEtapas.svelte`: index with the
four projects and the cap48 note, project page with its stages, or `Etapa.svelte`). The stage page: segmented progress
(links, `aria-current="step"`), «Lo que pide el libro» with the section(s) and the lesson, «Su diseño» (the drawing in
the theme's palette, `svgDocumento`, as `role="img"` with the values in its label; `modelo` as caption; one 48 px field
per value with its role and series as description, Enter checks, a field left writes into the circuit; «Comprobar»
`aria-disabled` while simulating, «Abrir en el editor», «Restaurar la etapa» with `confirmar`), a polite status line,
the result card (✓/✗ per condition with «Cumple:/No cumple:» for screen readers, measured, required, «Qué cambiar»;
informative measurements; «Siguiente etapa»), the reference card. Tokens `--v11-*` only with pairs of
`lib/leccion11/contraste.ts`. Entry points: `ProyectoEnCapitulo.svelte` at the end of cap48–cap52 (Lector, after the new
exercises), `VerEtapa.svelte` chips next to the stage sections (Seccion), a `proyecto/<parte>` node (`tipo: 'proyecto'`,
wrench icon, never blocks, open/locked with the chapter's first lesson) after the last lesson of each project chapter in
every course path that has it, plus a row in the list view, the editor's band and header link. Bar title «Proyectos por
etapas».

Tests: `tests/proyectos11-unidad.spec.ts` (Node, WebAssembly ngspice: every stage's starting circuit opened as the
editor opens it with no editor errors or warnings, fails; the reference passes; 2–5 alternatives/mistakes per stage with
the expected failing conditions and hints; checks before simulating; the stripped netlist; a reader's topology; the
data's links and the light index; record and merge laws) and `tests/proyectos11-navegador.spec.ts`
(`playwright.proyectos11.config.ts`, port 4685, build `/tmp/claude-0/epa-proyectos11/dist`: IoT stages 1–2 by keyboard
with a wrong design, its hint, the right one, events, record, the circuit in the editor with its band; entry points;
axe light/dark with a result and the reference; 360 px with no overflow and 44 px targets).

## Application log (0.9.2, `web/src/lib/registro.ts`)

A ring of the last 400 lines `{t, n: 'info'|'aviso'|'error', o: origin, x: text}` in localStorage `epa-registro`,
each written at once (`registrar()`), so the steps before a crash survive it: the Android WebView closes the whole
app when its renderer or GPU work dies, with nothing for the page to catch. `iniciarRegistro(version)` runs first
in `main.ts`: a start line (version, screen, `deviceMemory`, cores) and the capture of `error`,
`unhandledrejection`, `console.error` and `console.warn` (the console keeps working). Writers: `escena3d.ts`
(view opened: size, footprints, pads, face mode and size; full faces started/ready/failed; `webglcontextlost`;
the size guard lowering), the diagnostic's breadcrumbs (`migasDe`: start, each new phase, end). Shown at the end of
«Diagnóstico» (`Diagnostico.svelte`, card `.registro-app`): copy to the clipboard, download as `.txt` (Blob +
`a[download]`), clear.

Face size guard (`ladoCarasDispositivo`, `escena3d.ts`): full faces are 4096 px, 2048 on Android (4096 closed the
app on the Xiaomi Pad 6 with the Neo Geo and SNES boards). `refinarCaras()` leaves its size in
`epa-caras-intento` while it runs (cleared when it ends, is superseded or the view closes); a value still there
when the next view opens means the app died in it, so the device's size is halved (floor 1024, the quick pass's
size that always worked) and kept in `epa-caras-max`.

## Crash and error report, error boundaries, recovery (1.0, `web/src/lib/informe-fallos.ts`, `web/src/componentes/fallos/`)

**The report** (`informe-fallos.ts`, apart from the application log): one entry per failure `{t, v (version), p
(platform from the UA: «Android · tableta · Tauri · Chromium 129»), r (route, ids only: `rutaSegura`), k (kind), m
(message ≤ 400), s? (stack ≤ 8 lines × 160), z? (zone: «la figura 5.3», «la vista 3D de la placa»), b (the last 12
breadcrumbs), n (repetitions), visto?, i (id)}` in localStorage `epa-informe-fallos` as `{x: [cleared ids], e:
[entries]}` (still read: the bare array of the first 1.0 builds, and `{borrado}` of the 10f ones as the ids it covered) — outside the `epa:` prefix, so never in
the reader's data, the backups or the synchronisation; nothing is ever sent. Bounded: 40 entries and 80 000 characters
(oldest dropped; storage full → the newest quarter, else memory only). Two tabs (review 10f, r10f·6): every read and
write merges this page's copy with what is stored now — entries by id, the newer version of each (more repetitions,
then a later time; seen if either says so) — and `x`, the ids «Borrar» cleared (the union of both, newest 400), drops
those entries, so one tab's write no longer drops the other's entries and a «Borrar» sticks. Review 10h (r10h·8): a
clear by time (`borrado`, the first fix) dropped every later failure while the clock had been ahead at the clear;
ids do not depend on the clock. A repeat of the last entry within 10 minutes
increments `n`; at most 10 new entries a minute (the rest counted as «omitidos»), except what comes from elsewhere
(`sinLimite`: the native file, emptied when read, and crashes found at start — r10c·4). One failed chunk load reaches
the report two or three times (`vite:preloadError`, the rejected import, `ErrorCarga`): within 15 s the same chunk
name (or message) is merged into one entry, keeping the zone (r10c·5). Kinds: `error` (window `error`),
`promesa` (`unhandledrejection`), `componente` (an error boundary), `simulador` (engine download/compile, a worker that
does not start, a failed run — not the circuit's title), `webgl` (lost context), `almacenamiento` (`AvisoGuardado`
read/write failures), `migracion` (`resultadoMigracion().fallidas` of kind `fallo`), `sincronizacion` (`sinc.error`
after a run, not the transient ones; observed from `AvisoFallo.svelte`, the sync engine is not touched), `carga` (Vite's
`vite:preloadError`, a rejected dynamic import, `ErrorCarga` with a chunk error), `nativo` (Tauri panics), `cierre`
(a page that died while visible). Noise ignored: ResizeObserver loop, «Script error.», AbortError, superseded
simulations, resource errors without a message, extension scripts.

**Redaction** (`redactar`, on every message, stack line, zone and breadcrumb): the exact strings registered with
`ocultarEnInforme` (review 10c: `AvisoFallo` registers the sync settings' repository, its owner and the file's path);
the reader's own texts (QA 1.0: `textoDelLector(texto, campo)`, fed by `iniciarInforme`'s capturing `input` listener —
text inputs, textareas, contenteditable — with each field's current value, the 40 fields edited last, ≤ 4000
characters, MEMORY ONLY, never stored; `olvidarTextosDelLector()` for tests): every line of ≥ 4 characters → `[texto]`,
under 8 characters only as a whole word (`\p{L}\p{N}` boundaries), from 8 on also its longest prefix of ≥ 8 characters
found (a parse error that quotes only the beginning);
GitHub tokens (`ghp_…`, `github_pat_…`, `gho_/ghu_/ghs_/ghr_…`) and anything after `token` / `Bearer` /
`Authorization`; every absolute path (`sinRutas`, `INICIO_RUTA`: any drive `X:\` or `X:/`; a share or device path
`\\server\share`, `//server/share`, `\\wsl$\…`, `\\?\C:\…`; `/Users/`, `/home/` and any other root `/<name>/…`
(`/storage`, `/sdcard`, `/data/user/0/<pkg>`, `/Volumes`, `/mnt`, `/root`…); `file:` with 0–3 slashes before any of them
(Java's `file:/storage/…`: r10h·7); the shorthands `~/`, `%USERPROFILE%\`, `$HOME/`, `${HOME}/`; never inside a URL
nor after `#`, the app's routes) taken to the end of the line or a double/angle quote — names carry spaces and apostrophes («Nombre
Apellido», «Juan O'Brien»: r10c·3, r10f·5) — and cut at its last separator: `[ruta]\<file>` and what follows; just
`[ruta]` when the last segment is still a protected one (the user's folder; the server or the share); GitHub URLs →
`[github]`; Android's `content://` URIs (the document's path percent-encoded in one segment) → `[documento]`; a
repository's «owner/name» quoted, or after «repositorio»/«repo», or after «de»/«en» when both sides are
3+ characters starting with a letter («38,5 mA/V», «km/h» stay) → `[repositorio]`; other URLs reduced to their last
segment, decoded first (an encoded `%2F` hid more of the path); e-mails; quoted text of 33+ characters
(«…», "…", “…”, '…' — the reader's text inside a message, e.g. a JSON parse error) → `«[texto]»`; opaque strings of 24+
letters and digits mixed → `[…]`. Objects thrown are never serialised (only their constructor name). Breadcrumbs
(`miga`) are the app's own words only: `ruta #/<ids>` on each hash change (`ruta.svelte.ts`), `inicio <v> en <ruta>`,
`simulación`, `placa 3D: abrir`.

**No loops**: no function of the module throws; `informarFallo` ignores a call made while it is reporting (a listener
that reports again), listeners' exceptions are swallowed, and the rate limit stops anything else.

**Hard crashes** (`epa-informe-sesion`: `{<page id>: {t, e: activa|oculta, v, r, b}}`): written at start, on each
breadcrumb, on `visibilitychange` and `freeze`, and as a heartbeat every `SIN_LATIDO_MS / 6` (20 s) while visible;
removed on `pagehide` and `beforeunload`. At the next start (`revisarCierres`) another page's record still `activa`
counts as dead only when its heartbeat has not moved for `SIN_LATIDO_MS` (120 s; a recent record is looked at again
after waiting — right after a crash the next start comes within seconds) and it does not answer «¿vivo?» on
`BroadcastChannel('epa-informe')` within 3 s; then it becomes a `cierre` entry with its own time, version, route and
breadcrumbs. Review 10c (r10c·2): the first version asked only for an answer within 1,2 s, and a visible tab busy that
long (a PDF, a synchronisation at CPU ×6) was reported as closed. A hidden page is never a crash (the system closes
background pages). The desktop app does not take part (`detectaCierres`: Tauri on Windows/macOS/Linux may close the
window — Cmd+Q, closing it, the restart after an update — without `pagehide`): a false negative rather than a false
positive; Android and the browsers do. Tests shorten the 120 s with `window.__epaInformeSinLatido`.

**Tauri** (`src-tauri/src/lib.rs`, module `fallos`): a panic hook appends «ms<TAB>pánico: message (file:line)» to
`fallos-nativos.log` in the app's log folder (64 kB cap) before the process aborts; the app's own command
`fallos_nativos` (no permission entry needed, no path from the page) returns it and empties the file; `AvisoFallo`
reads it once per start (`informarNativos`: identical messages merged with their count and last time, none dropped).

**Notice** (`componentes/fallos/AvisoFallo.svelte`, mounted in `App.svelte`): after an uncaught error, a crash found at
start, a native panic or a chunk that did not arrive, a non-blocking `role="status"` box with «Ver el informe»
(`#/diagnostico/informe`), «Cerrar» and, for a chunk, «Recargar la página»; at most once a minute, not on
«Diagnóstico», 20 s. Hidden under `navigator.webdriver` unless the page sets `window.__epaInformeAviso` (QA screenshots
unchanged). **Diagnóstico** («Informe de fallos» card, `data-informe-fallos`, after the log): count, the last 10 entries,
«Copiar el informe» (`textoInforme`: plain text, newest first) and «Borrar» (in-app dialog); opening the page marks the
entries as seen.

**Error boundaries** (`componentes/fallos/Recuperable.svelte`: `<svelte:boundary>` + `{#key intento}`): the route
content in `App.svelte` («esta página», `clave` = vista|parte|ancla: another route retries a failed page), every live
figure (`Figura.svelte`), the boards' 3D view (`Proyectos.svelte`, `PlacaConsola.svelte`), the simulator's results.
Fallback: «No se ha podido mostrar <zona>.» with the (redacted) detail, «Reintentar» (rebuilds the content from scratch)
and «Ver el informe». A child declares an unrecoverable failure with `zonaRecuperable()?.fallar(motivo, error, tipo)`.
Tests: `window.__epaFalloPrueba = '<zona>'` makes that zone's next render throw once.

**WebGL**: `proyectos/Vista3D.svelte` on `webglcontextlost` hands it to its zone («Se perdió el contexto WebGL… Pulse
«Reintentar»»; a new canvas and scene), outside a zone the old message; `tres/Vista3D.svelte` (component models) shows
«Reintentar» (`{#key}` around `Visor3D`) when the viewer reports a failure (context lost for 2,5 s, a build error).

**ngspice** (`simulador/cliente.svelte.ts`): a download that receives nothing for 30 s is aborted (`SIN_DATOS_MS`); a
compile error says «WebAssembly»; a worker that does not report «listo» within 60 s (`ARRANQUE_MS`) or reports an error
at start is terminated and **forgotten** — before 1.0 the rejected start stayed in `trabajadorListo` and every later run
failed until a reload (test «un trabajador de ngspice que no arranca…»); a start nobody awaits is not an unhandled
rejection. Runs keep their 3-minute limit and «Detener».

**Stale chunks**: `ErrorCarga` (no `reintentar`) with a dynamic-import error while online says «Falta una parte de la
aplicación; puede que se haya actualizado…» with «Recargar la página» (matches the QA harness's retry pattern).

**Performance review 1.0** (scratch harness: tablet profile with the Xiaomi's UA, CDP CPU ×4 and ×6, long tasks from a
`PerformanceObserver`, medians of 2 runs, 2 shared CPUs; a 0.12 dataset of three years generated through 0.12's own API
and scaled: 1,3 MB, 1095 days × 3 daily records, 486 exercises, 4 900 XP events, 1 200 cards, 120 circuits):
- *First start migration*: `marcas.ts` checked whether a store's marks were empty with `Object.keys(...).length` on
  every mark (quadratic: 2,5 s of 3,1 s); fixed by the data agent (empty stores cleaned once per write).
- *Teacher-mode PDF*: fontkit inflates a WOFF table again on every access (`WOFFFont._getTableStream`, no cache): 80 %
  of the time. `lib/woff.ts` `sfntDeWoff` turns each WOFF 1.0 into an sfnt once (DecompressionStream; unchanged bytes
  without it or for anything else) in `Fuentes.archivo` (`lib/docente/pdf/fuentes.ts`): the same glyphs and metrics and
  byte-identical PDFs (tested), 3× faster. Then `Fuentes.ancho` and `Fuentes.hex` remember each run's width (per
  font, size and text) and its encoded glyph ids (per font and text): fontkit shaped every measured and every drawn run
  again (40 exercises' solutions: 9 375 + 9 375 shapings → 3 075 + 2 672, test by operation count); and `generarPdf`
  hands the thread back every ≈ 30 ms of layout and drawing (`quizaCeder`, a `setTimeout(0)`). Same order of work:
  the PDFs of all 486 exercises and 300 questions (with variants and shuffling, exam and solutions) are byte-identical
  to those made before the change.
- Measured and left: the reader's chapter with questions and the course path (layout of a large new page, ≈ 300–400 ms
  at ×4 in the first `getBoundingClientRect`/`scrollTo`), the first start with a big store (≈ 0,7 s at ×4 spread over
  reading and the first render, no single hot spot), the synchronisation of a big store (hashing and merging in one
  task, 1,2–1,8 s at ×4–×6: chunking it would change the order of reads and writes the engine's tests protect —
  pending, the data agent's decision), the first PDF of a session (≈ 0,3 s at ×4: compiling pdf-lib and fontkit,
  reading the fonts). The live challenge (dragging a knob while it simulates) has no long task: the simulation runs in
  the worker.

  | ×4 / ×6 (longest task, ms) | before | after |
  |---|---|---|
  | first start, migration of 3 years | 1 922 / 7 720 | 700 / 1 007 |
  | PDF of an exam (24 exercises) | 2 368 / 5 398 | 334 / 517 |
  | PDF of its solutions | 5 212 / 8 619 | 97 / 170 |
  | first synchronisation (big store) | 1 596 / 3 432 | 1 294 / 1 772 |
  | second synchronisation | 1 492 / 2 628 | 1 384 / 1 844 |
  | «Ejercicios» page / one exercise | 143 / 330, 146 / 132 | 189–316 / 126, 96 / 116 (noise) |
  | chapter with questions (cap. 9) | 362 / 522 | 288–702 / 392 (noise, layout) |
  | course path | 440 / 376 | 389 / 366 |
  | challenge, dragging (live simulation) | 0 / 214 | 0 / 0 |
  | 3D boards (`rendimiento12`) | — | all 11 pass (unchanged) |
- Tests: `tests/rendimiento10-unidad.spec.ts` (Node), `tests/rendimiento10-navegador.spec.ts`
  (`playwright.rendimiento10.config.ts`, port 4651).

## Ejercicios autocomprobables y progreso (`ejercicios.json`, `web/src/componentes/aprender/`)

**Generación.** `contenido/ejercicios.py` (llamado por `generar.py`, o solo) lee `partes/*.json` y escribe
`ejercicios.json`. Un analizador saca de cada solución el último valor de cada cadena «X = … = 12,5 mA» y unas
pistas automáticas; `contenido/ejercicios_curado.txt` (revisado a mano para los 486) lo sustituye ítem a ítem:
`= nombre | valor unidad [±tol] [(nota)] | alternativa…`, `~ clase: lo que se pide`, `1:`/`2:` pistas,
`nota:`, `errata:`, `dato:` (1.1). Un error de formato o una etiqueta que no existe paran la generación.
`errata` (un valor que el libro imprime y no corresponde a su propio planteamiento; la respuesta aceptada es la
correcta, nunca la impresa) se ve como «Aviso: …» en el panel (`Comprobador.svelte`, `data-errata`, con la solución
oculta o a la vista) y como «Aviso sobre el libro: …» en el PDF de soluciones del modo docente, antes del desarrollo
del libro (también bajo una variante). `nota` se ve en el panel y (1.1) en el PDF de soluciones. `dato` (1.1: un dato
que la solución del libro usa y el enunciado no da) se ve al principio del panel, justo después del párrafo «Se pide»
(`data-dato`), como «Dato que usa la solución del libro: …», y tras el enunciado en el PDF del examen y en el de
soluciones; no entra en `resumen` (el comienzo del enunciado para las listas). Usados en 1.1: `errata` en prob-1.B y
prob-3.B, `nota` en prob-44.B, `dato` en los 34 ejercicios que el recálculo clasificó como «ambigüedad del enunciado»
(prob-5.B y prob-36.B primero; luego los otros 32, entre ellos ej-53.4): el texto sale de la solución del libro y con él
se reproduce su valor. La lista exacta está en `DATOS` de `tests/erratas11-unidad.spec.ts`, que comprueba que solo
esos 34 lo llevan y que salen en el examen y en las soluciones; `tests/erratas11-navegador.spec.ts` los ve en su panel.

```json
{ "version": 2,
  "items": { "ej-5.1": {
      "tipo": "ej",                  // ej | prob
      "parte": "cap05", "num": "5.1", "seccion": "sec-5.11",
      "pos": [312, 0],               // ej: [bloque `ejercicios`, ítem]; prob: [h3, párrafo «Se pide», fin (exclusivo)]
      "modo": "auto",                // auto (campos numéricos y/o preguntas) | comparar (autoevaluación)
      "clase": "numerico",           // numerico eleccion texto deduccion diseno razonamiento sin-solucion
      "respuestas": [ { "id": "r1", "nombre": "Resistencia calculada",   // html (sub, sup)
                        "valor": 440, "unidad": "Ω", "texto": "440 Ω",   // valor en la unidad SI sin prefijo
                        "tol": 0.02,                                     // o "tol_abs" en la unidad
                        "nota": "…", "alternativas": [ { "valor": 470, "tol": 0.005, "texto": "470 Ω", "nota": "E12" } ] } ],
      "preguntas": [ { "id": "p1", "tipo": "eleccion", "enunciado": "¿Bastaría una de 1/4 W?",   // 1.0, ver abajo
                       "opciones": ["Sí", "No"], "correcta": 1,
                       "explicacion": "Una resistencia de 1/4 W (0,25 W) NO sería suficiente…" } ],
      "otras": [ { "clase": "razonamiento", "texto": "por qué…" } ],   // lo que se autoevalúa (lista de lo que se pide)
      "pistas": ["planteamiento (html)", "resultado intermedio (html)"],
      "titulo": "…", "resumen": "inicio del enunciado", "nota": "…", "errata": "…", "dato": "…", "origen": "curado" } },
  "capitulos": [ { "parte": "cap05", "items": ["prob-5.A", "…", "ej-5.1"] } ],   // orden del libro
  "resumen": { "total": 486, "auto": 300, "comparar": 186, "campos": 604, "preguntas": 99, "con_preguntas": 82,
               "autoevaluacion": 311, "…": "…" } }
```
**Preguntas estructuradas (1.0, `preguntas`).** Líneas `?` del curado (formato al principio del fichero): `eleccion`
(`opciones`, `correcta`; las de Sí/No conservan el orden, las demás se barajan de forma fija por etiqueta), `orden`
(`elementos` en el orden correcto, `mezcla` = orden en que se presentan, nunca el correcto), `clasificar`
(`categorias`, `elementos: [{texto, cat}]`; también las tablas de verdad, filas en orden binario), `exacta`
(`aceptadas`; sin espacios, una diferencia solo de mayúsculas es «casi»), `logica` (`expresion`, `variables`, `tabla`,
`complejidad` = literales + negaciones: equivalente por tabla de verdad y no más compleja; más compleja es «casi»),
`combinacion` (`serie` E12, `objetivo` en Ω, `tol`, `texto`: dos valores de la serie en serie o en paralelo); una
`eleccion` puede llevar (1.1) `porque` (`{"<índice mostrado>": html}` por cada opción incorrecta, de las líneas `porque N:`;
ver más abajo «autoevaluados convertidos»). Cada una lleva `explicacion` (html): con `>` es una **cita literal** de la solución del libro, y la generación para si no
aparece tal cual; con `>>` (`"calculo": true`, se rotula «Desarrollo») es un razonamiento propio, solo donde el libro
no lo dice con esas palabras, y cada uno se comprueba por un segundo camino en `tests/ejercicios10-contenido.spec.ts`
(ej-2.9 enumerando las parejas E12, ej-9.1 evaluando la expresión y leyendo la tabla de la solución). Comprobación:
`lib/preguntas-ejercicio.ts` (mismas reglas que `contenido/ejercicios.py`); interfaz: `aprender/PreguntaEjercicio.svelte`.
Un ítem es `auto` si tiene `respuestas` o `preguntas` (`clase` `numerico` si hay algún campo numérico, si no
`eleccion`); `catalogo.ts` (práctica inteligente, dominio), el problema del día y `conceptos11.mjs` cuentan los dos.
El parche de la 1.0 sobre el curado de la 0.12 (qué `~` pasan a `?`) se aplicó a mano en `ejercicios_curado.txt`; ese
fichero es la fuente.
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
tapada, vt, r, t}`; fallado = no resuelto y con algún intento o fallo — revisión 10j, `estadoEjercicio` de
`lib/valores-ejercicio.ts`: tras un reinicio no visto, la unión deja de otro dispositivo un intento sin sus fallos), `leidas` (parte → etiqueta de sección → instante),
`deducciones` (`"<parte>:<índice del bloque>"` → pasos visibles).

Claves de `valores` (1.0; el formato no cambia, `Record<string, string>`): `r1…` lo escrito en cada campo numérico;
`p1…` la respuesta de cada pregunta estructurada (`eleccion`: índice de la opción; `orden`: índices en el orden del
lector, `"3,0,2,4,1"`; `clasificar`: categoría de cada elemento, vacío sin responder, `"0,1,,1"`; `exacta` y `logica`:
el texto; `combinacion`: `"6,8 k|680|serie"`); `texto` la respuesta escrita de lo que se autoevalúa (recortada,
saltos de línea unificados, como mucho 4000 caracteres, `MAX_TEXTO_EJERCICIO`); `c1…` `"1"` si el lector marcó ese
punto de la lista «lo que se pide». `vt` = instante de cada clave al cambiar (solo las que cambian:
`lib/valores-ejercicio.ts` `ponerValores`, también desde «Comprobar»), con el que la sincronización une `valores` clave
a clave (`lib/union-ejercicios.ts`). La respuesta escrita, las marcas y (revisión 10e) lo que se va escribiendo en los
campos `r…` y eligiendo en las preguntas `p…` (`guardarRespuestaEscrita`, recortado: `texto` 4000, `c…` 16, el resto
200 caracteres, `limpiarValorEjercicio`) no son un intento: no cambian `intentos` ni `t`, se guardan con la espera
habitual del almacén y se vuelcan al cerrarse el panel (`volcarEjercicios`, al navegar) y al ocultarse la página.
`_c` (10e) = instante (ms, texto) del último «Comprobar», escrito en la misma llamada que sus valores, y (10g) esa
comprobación sella con ese mismo instante en `vt` todos los valores que comprobó, cambiados o no (`ponerValores(…,
sellarTodas)`): al volver al panel solo se enseña el veredicto de las claves con `vt === _c` (`valorComprobado`); sin
`_c`, solo si hay algún intento (datos de la 0.12; un borrador nunca comprobado o tras «Reiniciar» no). Un borrador —
posterior, o de otro dispositivo antes o después de esa comprobación— vuelve sin veredicto. Un borrador que crea el
ejercicio en un dispositivo lo crea con `t: 0` (`estadoDeBorrador`): la unión toma los campos enteros de la versión de
`t` mayor, y (revisión 10j) `resuelto` va por su clave `_r`, así que nunca deshace lo resuelto en otro dispositivo; sus
claves conservan su `vt`. Claves internas (revisión 10j; el panel solo restaura `r…`/`p…`/`texto`/`c…`): `_r` = `""`
(autoevaluado «No») o `"1|intentos|fallos|pistas|solucion"` (resuelto, con los contadores de ese dispositivo en ese
momento), escrita solo por la comprobación que lo resuelve y por «¿Lo tenía bien? Sí/No» (`marcarResuelto`); `_o` =
`"1"` «Ocultar solución» / `""` «Ver solución» (`marcarTapada`, desde `taparProblema`). Los campos `resuelto` y `tapada`
se siguen escribiendo y la unión los deriva de esas claves; un ítem sin ellas (0.12, o 1.0 antes de la 10j) las tiene
en su `t` si está resuelto / si tiene `tapada`. La XP de la reconciliación, el dominio y «Resuelto a la primera» usan
`ayudaAlResolver`: los contadores del ítem y, como mínimo, los guardados en `_r`. Lo mismo vale
para abrir una pista o la solución (`usarPista`, `verSolucion`: no mueven `t`, se unen por máximo y por «o»; marcan el
cambio con `anotarCambio`): solo un intento (`registrarIntento`, `autoevaluar`) fija `t` (casos `e10·1`–`e10·3` de
`tests/motor-real/escenariosEjercicios10.ts`). Un ejercicio autoevaluado (modo `comparar`) se resume como «Autoevaluado: lo
tenía bien / no lo tenía bien» (ver la solución es su método; la 0.12 decía «después de ver la solución»). «¿Lo tenía bien? Sí / No» sigue siendo la autoevaluación de
siempre (`autoevaluar`): cuenta para el dominio igual que antes, nunca como acierto automático.

**1.1 «razonar»: autoevaluados convertidos.** 181 de los 186 ítems `comparar` de la 1.0 son `auto` (lista en `CONVERTIDOS` de
`tests/razonar11-unidad.spec.ts`; quedan `comparar` ej-12.8, 40.5, 42.2, 46.4 y 48.5, `QUEDAN`): solo con líneas del curado
(`?` eleccion/orden/clasificar con `>` literal o `>>`, `=` en ej-20.8, 52.1 y 14.1) y la clave nueva **`porque N: texto`**
tras una `? eleccion` (N = el sitio de la opción en la línea, desde 1; si alguna opción lo lleva, todas las incorrectas;
nunca la correcta), que `ejercicios.py` escribe como `preguntas[].porque` = `{"<índice mostrado>": html}`, el mismo campo
que los ejercicios nuevos (`PEleccion.porque`; `PreguntaEjercicio` lo pasa a `PorQueNo` como `extra`). `porque10.mjs` no
propone frase del libro para una pregunta cuyas incorrectas lleven todas su `porque` (no salen en `porque/<parte>.json`).
Datos guardados: sin migración (revisión 11a: llevan `"comparar10": true`, y un examen de la 1.0 con su texto escrito se
sigue autoevaluando: «Modo docente», revisión 11a). Las etiquetas y los ids no cambian; los nuevos `p1…`/`r1…` no existían en esos ítems; los
8 que conservan una parte abierta tienen un solo `~`, como en la 1.0 (`c1` sigue siendo su marca). Un ítem resuelto por
autoevaluación sigue resuelto con `solucion: true` (0 XP: `xpEjercicio`); `Comprobador` enseña «Su respuesta» (`texto`)
aunque el ítem ya no tenga `otras` si se guardó un texto (`textoPrevio`, fijado al restaurar), para no esconderlo.
`autoevaluar` pone ahora `e.solucion = true` antes de `marcarResuelto` (también en `_r`): en un problema, «¿Lo tenía
bien?» se ve con la solución a la vista sin `verSolucion` y daba 15 XP (prueba en `razonar11-navegador.spec.ts`; el
espejo de `tests/motor-real/escenarios10.ts` hace lo mismo). Modo docente: `preguntaVista` (examen barajado) lleva cada
`porque` con su opción; `documentoSoluciones` imprime «Por qué no X): …» tras «Del libro» para cada opción incorrecta que
lo tenga (también los ejercicios nuevos). `banco.ts`: 348 del libro enteros `auto` (175 + 173) y 133 `mixto` (125 + 8);
`conceptos.json` gana las secciones de los convertidos (649 conceptos); `practica/indice.json` cuenta 3 descartes más
(los tres con valor, sin fórmula del catálogo: no hay variantes).

### Ejercicios nuevos, «Aún no en el libro» (1.1, `contenido/ejercicios_nuevos11/`, `lib/diseno-ejercicio.ts`)

**Fuente y generación.** `contenido/ejercicios_nuevos11/<parte>.yaml` (cap22, cap25, cap35): `parte`, `items[]` con `n`
(→ etiqueta `ej-<stem>.<n>`, número impreso `<num del capítulo>.<n>`), `seccion` (la que lo enseña: su concepto),
`enunciado`, `solucion` (párrafos separados por una línea en blanco, `- ` lista; en línea `*negrita*`, `$Typst$` —los
decimales entre comillas, `"0,707"`, y la unidad dentro, `"1 kHz"`— y `#nr("etiqueta")`), `respuestas` (`nombre`,
`valor` con la sintaxis del curado: «37 dB ±0,1 dB», «4 MHz ±1%», «54,8 % ±0,5 pp»), `preguntas` (`eleccion` con
`opciones: [{texto, correcta?, porque}]` —cada incorrecta, su `porque`—, `orden`, `clasificar`, `diseno`, todas con
`explicacion`), `pistas` (dos) y `banco` (`practica` 1–12, `texto`). `contenido/ejercicios_nuevos.py` (lo llama
`contenido/ejercicios.py` al final de su `main`, así que también corre con `generar.py`) valida todo (la generación para
ante una marca sin cerrar, un símbolo de fórmula desconocido, una coma decimal sin comillas, una referencia que no está en
`refs.json`, una sección que no es del capítulo, una opción incorrecta sin `porque`, un diseño cuya referencia no cumple su
serie o su margen…), convierte la fórmula Typst a HTML (subconjunto: `_`/`^` → sub/sup, `dot` → ·, `times`, `approx`,
`plus.minus`, `parallel`, `sqrt`, griegas, `log_10`, `arctan`…) y **fusiona**: quita lo que añadió una pasada anterior
(ítems con `nuevo`, documentos de búsqueda con `nuevo`), descarta cada nuevo cuya etiqueta ya trae el libro (el ítem de
`ejercicios.py` gana; se listan en `resumen.nuevos11.descartados`), añade los demás tras los del libro (en `items` y en
`capitulos`, que se crea para la parte si no estaba, en el orden del índice) y un documento por ejercicio en
`busqueda.json` (`{id: etiqueta, parte, titulo: «Ejercicio 24.1 · Aún no en el libro», texto, nuevo: true}`). Idempotente
y estable: repetirlo, o repetirlo tras un `ejercicios.py`, deja los ficheros byte a byte iguales. `EPA_LIBRO=<carpeta>`
trabaja sobre una copia. `--typst F` escribe el texto para el libro (por capítulo: `#ejercicios[#ejercicio[…] <ej-…> …]`
y `#soluciones[#solucion("ej-…")[…] …]`, dónde pegarlo y las líneas para `ejercicios_curado.txt`); `--comprobar` no
escribe nada.

**En `ejercicios.json`** un ítem nuevo es como los del libro (`tipo: "ej"`, `modo: "auto"`, `origen: "curado"`) más:
`"nuevo": true`, `"pos": []`, `"enunciado"` y `"solucion"` (bloques con el formato de `partes/`: `p`, `lista`),
`"banco": {practica, texto}` opcional; sus preguntas llevan `"calculo": true` (se rotulan «Desarrollo», nunca «Del
libro») y las de elección, `"porque": {"<índice mostrado>": html}` para cada opción incorrecta (lo enseña `PorQueNo` como
`extra`). `resumen.nuevos11 = {total, campos, preguntas, disenos, banco, descartados}`; el resto de `resumen` es el del
libro. `lib/ejercicios.svelte.ts`: `bloquesEjercicio(item, parte)` (enunciado y solución, del ítem o de su parte; lo usan
`TarjetaEjercicio` y `docente/fuentes.ts`) y `nuevosDeParte(parte)` (un `BEjercicios` sintético). El lector añade al
final de cada capítulo `aprender/EjerciciosNuevos.svelte` (`Ejercicios.svelte` con `nuevos`: `data-nuevos`, cabecera
«✎ EJERCICIOS NUEVOS» y la insignia), que resuelve las anclas `#/<parte>/ej-…` cuando llegan los datos (los ejercicios
nuevos no están en los bloques de la parte). Insignia: `aprender/InsigniaNuevo.svelte` (`data-nuevo`, «Aún no en el
libro», tokens ámbar de los tres temas), en el bloque, `TarjetaEjercicio` («Abrir en el capítulo»), la página
«Ejercicios» y el banco del modo docente (`EntradaBanco.nuevo`); los PDF dicen «· aún no en el libro» y «Solución 24.9
(aún no en el libro)». `practica10.mjs` y `porque10.mjs` saltan los ítems `nuevo` (ni variantes ni frases que los citen
como del libro); `miniaturas.mjs` lee su `enunciado`; `conceptos11.mjs` los cuenta como cualquier ejercicio.

**Preguntas de diseño** (`preguntas[].tipo = "diseno"`, `PDiseno` en `lib/preguntas-ejercicio.ts`): `componentes:
[{id, nombre, unidad Ω|F|H, serie E12|E24, min, max}]`, `circuito` (netlist con `{id}`), `control` (las líneas del
`.control`: análisis, `let` y un `meas` por medida), `medidas: [{id, nombre, unidad}]`, `condiciones: [{medida, min,
max, texto, siBaja, siAlta}]` (las dos últimas, qué cambiar), `referencia` (un diseño que cumple). Valor guardado
(`valores.p…`, como cualquier pregunta): «texto|texto…» y, una vez simulado, `#` + los valores SI simulados + `#` + las
medidas: `"3,3 k|47 n#3300,4.7e-8#fc=1026.14"` (`nan`: no medible, fuera del barrido). `lib/diseno-ejercicio.ts` (puro):
`valoresDiseno` (lee, unidad, margen, serie; revisión 11c: un valor fuera de su margen o de su serie es `ilegible`
—«Corríjalo antes de simular (no cuenta como intento)»—, como en las etapas de proyecto: no suma un fallo ni acerca la
solución; en un examen sigue valiendo 0), `netlistDiseno`, `simularDiseno(p, valor, simular)` (no vuelve a simular
unos valores ya simulados), `faltaSimular`, `comprobarDiseno` (síncrono: las medidas solo cuentan si son de esos mismos
valores; sin ellas, `ilegible` «Falta simular este diseño», que no es un intento). `lib/simular-diseno.ts` es el
`Simulador` de la aplicación (`simularTexto` del trabajador y `todasLasMedidas`), cargado bajo demanda. `Comprobador`
simula los diseños pendientes antes de comprobar (`simulando`, «Simulando…», el botón `aria-disabled`; una simulación
sustituida dice «vuelva a pulsar «Comprobar»»); `aprender/CamposDiseno.svelte` pinta los campos (44 px, la serie y el
margen como descripción) y lo medido (`data-medido`); `HacerExamen` simula al entregar los que falten (si falla, se
califican como no simulados, nunca como bien; revisión 11a: `ResultadoExamen` ofrece entonces «Simular ahora y corregir»
(`data-simular-ahora`, mientras `faltaSimular`), guarda las medidas en `valores` —con `autoevalT` nuevo para la unión— y
recalifica solo ese ítem con `recalificarGuardado`); el PDF del examen imprime cada componente con su serie y el de soluciones
las condiciones y la referencia. Pruebas: `tests/ejnuevos11-unidad.spec.ts` (Node, ngspice WebAssembly) y
`tests/ejnuevos11-navegador.spec.ts` (`playwright.ejnuevos11.config.ts`, puerto 4683, compilación
`/tmp/claude-0/epa-ejnuevos11/dist`). `tests/ejercicios10-contenido.spec.ts`, `docente10-unidad.spec.ts` y
`brilliant10-contenido.spec.ts` miran solo los ítems del libro (sin `nuevo` ni `ampliacion`; también `razonar11-unidad` y
`ejnuevos11-unidad`).

**Al pegarlos en el libro** (revisión 11a): `ejercicios_nuevos.py --typst F` escribe, para cada capítulo, el apartado «Para
el curado» con todo lo que el curado necesita para que el ítem del libro sea el mismo: `=` respuestas, `? eleccion` con
`>>` y una línea **`porque N:`** por opción incorrecta, `? orden`, `? clasificar` y, para una pregunta de diseño, la línea
nueva del curado **`? diseno: {JSON}`** (la pregunta entera en el formato de `ejercicios_nuevos11/`: `enunciado`,
`componentes`, `circuito`, `control`, `medidas`, `condiciones`, `referencia`, `explicacion`), que `ejercicios.py`
convierte con el mismo código (`ejercicios_nuevos.pregunta`, con `refs.json`): el mismo `p1`, así que una respuesta
guardada se corrige igual (no admite `>` detrás: la explicación va en el JSON). Un ítem `auto` con una pregunta de diseño
es de clase `diseno`, como en `ejercicios_nuevos.py`. `ejercicios.py` acepta `EPA_LIBRO` y `EPA_CURADO` (pruebas, sobre
una copia). Prueba: `tests/revision11a-unidad.spec.ts` B4 (una copia del libro con ej-25.9 y ej-22.4 pegados y su
apartado «Para el curado»: la pregunta de diseño es idéntica y da el mismo veredicto; cada `porque` sobrevive).

### Book expansions, «Aún no en el libro» (1.1, `contenido/ampliaciones.py`, `contenido/ampliaciones11/`)

**1.2: retired.** Book 4.0 took in all ten expansions and 4.1 renamed the two new chapters (`cap55`, `cap56`), so
`generar.py` no longer merges them (`fase_partes`/`fase_derivados` are not called; `web/public/libro/ampliaciones.json`
is removed; no item carries `ampliacion` any more, so no «Aún no en el libro» badge is shown). What the layer added that
the book does not carry moved to the app's own sources: the expansions' review questions → `contenido/repaso/<parte>.json`
(same ids; `cap-new-automatas-N` → `cap55-0N`), their exercises' checked answers and hints → `ejercicios_curado.txt`
(`sin-respuestas` + `clase:` for those compared with the solution), the 1.0 practice items of the retired 32.13 →
`contenido/practica_retirada.json` (read by `practica10.mjs`; `sec-33.13` is now a book alias of `sec-56.3`). Still used:
`renumerar_fuentes` (the printed numbers the curated sources quote, with `ampliaciones11/numeracion.json`), called by
`generar.py` after `refs.json`. The folder and the rest of `ampliaciones.py` stay as history (and for an expansion of a
future edition); the format below is unchanged.

The authors write expansions of the book as Typst (new sections, problems, exercises, a whole new chapter) with their
figures, netlists, review questions and data. The app shows them now, marked «Aún no en el libro», and drops its copy
when the book has them. One folder per expansion, `contenido/ampliaciones11/<ID>/`: `<ID>.typ` (with `// ==== PARTE n`
pieces), `figuras/*.svg` (identity palette, text as text), `spice/*.cir`, `repaso.json` (repaso.py's source format),
`datos/*.json` (the numbers of the text) and `ampliacion.json`:
```json
{ "id": "P01", "titulo": "Sistemas trifásicos", "fuente": "P01.typ",
  "piezas": [
    { "tipo": "bloques",    "parte": "cap24", "trozos": [1], "antes": "sec-24.10" },   // or "#ejercicios"
    { "tipo": "ejercicios", "parte": "cap24", "trozos": [2, 3], "tras": "ej-24.8" },  // #ejercicios + #soluciones
    { "tipo": "tarjeta",    "parte": "cap33", "trozos": [5], "en": "sec-33.13" },     // lines appended to that card
    { "tipo": "capitulo",   "parte": "cap-new-automatas", "tras": "cap31", "tomo": "V" },   // whole file
    { "tipo": "retirar",    "parte": "cap33", "desde": "sec-33.13", "hasta": "#tarjeta",      // a run of the book it absorbs
      "destino": "sec-new-maquinas.3", "destinos": { "cap35": "sec-new-maquinas.5", "P04": "…", "cap33-18": "…" },
      "tarjeta": ["V = E + I dot.op R quad …"] } ],                                            // card lines it takes too
  "respuestas": { "ej-24.10": [["Corriente de línea I_L", "4,62 A", "calculos:ejercicios.e10.I"]], "ej-24.9": [] },
  "spice": { "n7_ej10_estrella": { "titulo": "…", "descripcion": "… (Spanish)", "refs": ["ej-24.10"], "parte": "cap24" } },
  "glosario": [ { "termino": "glos-fasor", "seccion": "sec-new-24-trifasica", "palabra": "fasor" } ],
  "repaso": "repaso.json" }
```
Every new exercise and problem must be in `respuestas`: a list of `[name (ejercicios_curado's _x/^x marks), the value as
the solution writes it (ejercicios_curado's value syntax), "<datos file>:<dot path>"]`, or `[]` for «compare with the
solution». The step refuses a value that is not in the solution text or that is not the datum rounded as written.
`python3 contenido/ampliaciones.py --importar <folder as delivered>` copies a delivery and writes a manifest skeleton
from its PARTE markers; the step then says what is missing.

**The step** (generar.py: phase «partes» right after the book's core files, phase «derivados» after
`glosario_imagenes`; ejercicios.py calls `anotar_ejercicios()` at its end; alone: `python3 contenido/ampliaciones.py`,
which without the book's sources also reruns ejercicios.py, pasos.py and the Node chain, and adjusts formulas.json,
`--comprobar` writes nothing, `--deshacer` restores the book as generated). Each piece is converted with the app's own
`typst_parser.py` + `convertir.py` (unchanged) and inserted where the manifest says; equations are rendered with Typst
(the book's template and fonts when its sources are here, else Fira Math/Inter from `ampliaciones11/fuentes/`, OFL),
cached in `contenido/.cache/ampliaciones/`, with their own hash signature; figures go identity SVG → PDF (Typst) → SVG
(pdftocairo, glyphs as paths) → `compact_svg`, `tipo_figura: "diagrama"`, `svg_vista` from the viewBox. A figure name
that the book already uses is refused.

**Numbering.** New objects are numbered after the existing ones that precede them; the existing ones after them shift
(sections, subsections, figures, numbered tables, exercises), and every chapter after a new chapter takes the next number
(its sections, figures… too). refs.json, every `<a class="ref">` of every part and of the glossary, indice.json
(sections, chapter numbers), busqueda.json (regenerated from the parts exactly as generar.py writes it) and an equation
that prints a reference (re-rendered) follow. Storage keys never change: part stems and labels of existing content are
the book's, the new chapter has its own stem and labels (`cap-new-automatas`, `sec-new-automatas.N`…).

**Marks** (all reversible, so the step is idempotent and `--deshacer` is exact):
- `"ampliacion": "<ID>"` on every top-level block of a merged unit (not on the blocks inside), on a merged exercise item,
  on formula-card lines, on the new chapter's part, its indice.json entry and its spice.json chapter, on refs.json
  entries, search documents, indice.json `secciones` entries of new sections, netlists, review questions (and
  `repaso/indice.json` entries carry how many: `"ampliacion": 6`), ejercicios.json items (`origen: "ampliacion"`,
  `pistas: []`; unlike `nuevo`, the statement and solution are in the part, at `pos`).
- `"num_libro"` on every block, part and refs.json entry whose number shifted (the book's number); `svg_libro`,
  `w_libro`, `h_libro` on a re-rendered equation; `ver_ampliacion` on a glossary entry (both `glosario.json` and the
  glossary part) with the labels added to its `ver`.
- `ampliaciones.json`: `{version, ampliaciones: [{id, titulo, partes, etiquetas, omitidas}], etiquetas: {label: id},
  ficheros: {fig: [...], ec: [...]}}` — what the last run added (the next run removes those files first).

**Pieces «retirar»** (P02 absorbs 32.13). Applied first, on the undone book: the top-level blocks from the label
`desde` up to `hasta` (excluded: a label, or `#tarjeta`, the chapter's card after it) leave the part, and so do the card
lines whose Typst source is listed in `tarjeta`; the objects after the run shift back (`num_libro`). `ampliaciones.json`
`retiradas: [{id, parte, pos, bloques, tarjeta: [[index, line]], etiquetas, destino, destinos}]` keeps them, and
`deshacer()` puts them back (only what the part does not already have: after generar.py it is the book's again). Each
retired label stays in refs.json as an alias: `{num, parte, tipo` of the destination`, label: <destination>,
retirada: <ID>, libro: <the book's entry>}` (the app's `candidatosDeRef` honours `label`; `lib/datos.ts
destinoRetirado()` makes the router open `#/<part>/<retired label>` and `#/leccion/<part>/<retired label>` at the
destination). Every `<a class="ref">` to it goes to the destination its piece gives for where it is (`destinos`, by the
id of the holding dict — a glossary term, a repaso question, a netlist, a practice item —, the expansion of the block,
the section, the part; else `destino`); in the book's own content the holding dict keeps `"refs_libro": {destination:
retired label}`; a glossary `ver` keeps `ver_retirada: [[index, label, destination|null]]` (the destination is the
term's section in the manifest's `glosario`, if any). Derived files: a repaso question of the book about it keeps its id
and gets `ref` = its destination and `ref_libro`; a netlist of the book keeps its id with `refs_libro {ref, refs}` and
spice.json `porRef_libro` (the book's porRef); practica10.mjs adds the 1.0 practice items of the run, as published
(`ampliaciones11/<ID>/practica-retirada.json`), to `practica/<part>.json` with `retirada`, `bloque` = the run's position
and current numbers (its `ref` from `destinos` by item id). Not applied when the book already has `destino` (pasted)
or no longer has `desde`; then, if a merged expansion still cites `desde` and the book lacks it, the label is an alias
all the same (`solo_alias: true` in the registry, `libro: null` in refs.json). Formulas.json keeps its sections by
label: their numbers follow the alias.

**A repaso question about what an expansion adds to a section of the book** (P08 extends 0.12: `ref` is `sec-0.12`) is
merged too (the section is the book's, the part one the expansion touches) and checked against the expansion's text
under that label.

**Hints** of an expansion's exercise (`pistas` in ejercicios.json, `pistas_de_solucion()`): from its solution, «Empiece
por: X = <first substitution>.» and «Resultado intermedio: X = <value>.», from the first clauses written X = expression =
value, never with a number of a checked answer.

**Lessons 1.1 and expansions.** `libro:` keys are block indices; `generarLeccion()` resolves each by its quote (the
written index if its block still has the quote; else the only block — of the section for a plain number — that has it;
if several, the one at the shift the lesson's other uniquely found quotes moved by; a plain index outside the section is
reported as such). `CitaLibro.bloque` is the resolved index; the key stays the written one.

**Book wins.** A unit (a section with what follows it, a problem, an exercise, the chapter, a card line, a netlist by
content, a question by id) whose label the book already has (refs.json without the mark) is not merged: when the author
pastes an expansion, the book's version stays, without duplicates, and the numbering is the book's.

**Printed numbers in the app's sources.** The curated sources quote the book with numbers («sección 31.10»):
`renumerar_fuentes()` rewrites the mentions (sección, apartado, figura, capítulo, ejercicio, problema, tabla, and lists
«figuras 32.12 y 32.19»; not «apartado 4.2 de la norma…») in `ejercicios_curado.txt`, `porque_curado.json`,
`pasos_curado.json`, `teoria_viva_curado.json`, `averias_curado.json`, `repaso/*.json`, `lecciones11/**/*.yaml` and
`ejercicios_nuevos11/*.yaml` by label: `ampliaciones11/numeracion.json` records, for each number mentioned, its label
(`tipos`), so a run never shifts twice and undoes itself when an expansion leaves or is pasted into the book (without a
record, mentions are taken in the book's numbering; with one, a new mention in the current numbering). `derivados` holds
the same record for formulas.json (adjusted here because formulas.py needs the book's sources). The app's own texts use
`numeroImpreso(label)` (lib/datos.ts) instead of a written number; texts written as data (lib/proyectos11/etapas.ts:
`especificacion`, `modelo`) write `{{num:<label>}}`, resolved when shown by `conNumerosImpresos()`. Review 11a: so does the «Marcadores» page for a bookmark or a note
(`numeroImpreso(label, f.num)`: the number stored with it is the one printed when it was made; test
`tests/revision11a-navegador.spec.ts`).

**App.** `InsigniaNuevo` (with a `titulo` saying what it is) under a new section's title (Seccion.svelte), under a new
chapter's title and next to its row in the index, next to new sections in «En este capítulo» and in the index, before
the first block of a run that is not a section (a problem, card lines; Bloques.svelte, which receives the previous
chunk's last block), next to an exercise's number (Ejercicios.svelte) and in the exercise lists, in search results,
review questions (whose quote says «Aún no en el libro · Sección N» instead of «Del libro»), the simulator's list and
page, and teacher mode (`nuevo` in the bank, «aún no en el libro» in the PDFs). Tests (1.1): `tests/ampliaciones11-unidad.spec.ts`
(Node) and `tests/ampliaciones11-navegador.spec.ts` (`playwright.ampliaciones11.config.ts`, port 4688), retired in 1.2
with the layer; the native 4.1 content they covered is checked by `tests/sync41-ampliaciones-unidad.spec.ts`.

### Paso a paso (1.0, `pasos.json`, `aprender/ResolverPasos.svelte`)

`contenido/pasos.py` (llamado por `generar.py` tras `ejercicios.py`) escribe, solo con los ejercicios de
`contenido/pasos_curado.json` que llevan `"aprobado": true`:
```json
{ "version": 1, "total": 45, "pasos": 116,
  "items": { "ej-2.6": { "pasos": [
    { "tipo": "numerico", "pregunta": "html", "nombre": "V<sub>R</sub>", "pista": "html",
      "respuesta": { "valor": 3, "unidad": "V", "texto": "3 V", "tol": 0.02 }, "alternativas": [],
      "explicacion": "cita literal de la solución (html)" },
    { "tipo": "eleccion", "pregunta": "…", "opciones": ["180 Ω", "220 Ω"], "correcta": 1,
      "porque": { "0": "por qué no esa opción (html)" }, "explicacion": "…" } ] } } }
```
En el curado: `respuesta` / `alternativas` como en `ejercicios_curado.txt` («3 V», «41 mW ±3%»), `opciones` con la
correcta marcada «*», `cita` (literal de la solución: la generación para si no está, si el valor de un paso numérico no
está escrito en su cita o si el último paso no es una respuesta del ejercicio). `--proponer FICHERO` escribe la
propuesta automática (una por cadena «X = … = valor») que se revisa a mano; nunca la lee la aplicación.
`lib/pasos-guiados.ts` la carga cuando un panel la necesita; `Comprobador` (prop `pasoAPaso`, por defecto sí) ofrece el
modo tras dos fallos y con un botón discreto; al salir habiéndolo usado llama a `usarPista(label, nº de pistas)` (sin
almacén nuevo). Los exámenes del modo docente no usan `Comprobador` (prueba en `ejercicios10-pasos.spec.ts`).

### Teoría que se mueve (1.0, `teoria-viva.json`, `componentes/teoria/`)

`web/scripts/teoria10.mjs` (llamado por `generar.py` en la cadena de prácticas; reescribe el fichero solo si cambia;
`--revisar` imprime el texto del libro alrededor de cada ecuación) lee `contenido/teoria_viva_curado.json` (piezas con
`"aprobado": true`: `formula` del catálogo de calculadoras, `ec` (cuál de sus ecuaciones de primer nivel en su propia
sección), `entradas` por magnitud: `valores` | `min`/`max` con `serie` E12, `paso` lineal o, sin más, logarítmica de 24
pasos por década; `inicio` (siempre alcanzable), `grafica.x`, `grafica.ylog`) y escribe:
```json
{ "version": 1, "total": 14, "partes": { "cap01": [ {
    "id": "divisor", "bloque": 82, "svg": "ec/….svg", "titulo": "…", "formula": "divisor", "expr": "V_in*R_2/(R_1+R_2)",
    "resultado": { "id": "V_out", "sim": "V<sub>out</sub>", "nombre": "…", "unidad": "V" },
    "entradas": [ { "id": "R_2", "sim": "…", "nombre": "…", "unidad": "Ω", "valores": [1000, 1200, …], "inicio": 9, "log": true } ],
    "grafica": { "x": "R_2", "ylog": false } } ] } }
```
`bloque` es el índice del bloque `ec` de primer nivel de la parte (el mismo `data-b` del lector y de las lecciones):
`Bloques.svelte` monta `teoria/TeoriaViva.svelte` tras ese bloque cuando `lib/teoria-viva-lugares.svelte.ts` (índice
«parte:bloque», cargado al pintar la primera parte) lo tiene. Cálculo y gráfica: `lib/teoria-viva.ts` (puro; el motor
`calculadoras/expresion.ts`). `teoria/MandoValor.svelte`: `role="slider"`, `aria-valuenow` en la unidad de la magnitud,
`aria-valuetext` con prefijo y unidad, flechas ±1 valor, Re Pág / Av Pág ±1/10 del recorrido, Inicio / Fin, arrastre con
captura del puntero y `touch-action: pan-y`. Nada se guarda.

`lib/magnitudes.ts` (1.0): `A/V` admite prefijo («38,5 mA/V»), como ya lo guardaba `contenido/ejercicios.py`. Revisión
10e: las mayúsculas de los símbolos cuentan cuando cambian la unidad (`CONFUNDIBLES`: «mS» no es «ms», «H» no es «h»;
los alias inequívocos siguen: «hz», «v», «kohm»…); una unidad pedida con el prefijo pegado se lee también en la unidad
sin él y se escala (`CON_PREFIJO`: «0,165 m» o «16,5 cm» para mm, «960 g» para kg, «38,5 mS»); dos grafías de la misma
unidad (`EQUIVALENTES`: K/W ≡ °C/W, S ≡ A/V); «R33» (código RKM sin parte entera), un punto final («5 V.») y un signo
separado («- 6 dB»). Revisión 10g: una tira de superíndices es un exponente («10⁴» → 10^4, antes 104; «×10⁻³»), «10^4»
y «10^(−3)» sin mantisa; `GRUPOS` convierte entre s, min y h y entre m², cm² y mm². Revisión 10i: prefijo `f`
(femto); el alias «f» → F desaparece (un «f» suelto tras el número es el prefijo, como «4,7 k»).

`practica/variantes.ts` (10i): `comoSeMuestran` redondea a `CIFRAS` (3) cifras significativas cada dato que el enunciado
escribe (los huecos `{{id}}` de un ejercicio; todos los datos de una fórmula), antes de calcular el resultado y de
comparar con los valores del libro: el resultado esperado es el que sale de los datos tal como se leen, y no hay variantes
gemelas del libro por la coma flotante. `valorTexto` escribe las velocidades ≥ 10⁵ m/s en notación científica.
`enunciadoDe` (fórmulas): «Calcule {símbolo} ({nombre}) con estos datos: {símbolo} = {valor} ({nombre}); …».
`tapada` («Ocultar solución» de un problema; revisión 10j) tiene hora propia, la clave `_o` de `valores`: en la unión
gana el último «Ocultar/Ver solución» pulsado en cualquier dispositivo, aunque no mueva `t` (antes era un campo de ítem
y perdía incluso frente a la copia vieja del mismo dispositivo en el fichero, r10j·1). En el paso a paso, un paso que da una respuesta del ejercicio hereda su tolerancia y sus
alternativas (`contenido/pasos.py`).

**«Practicar con otros valores» (revisión 10e).** `web/scripts/practica10.mjs` `AJUSTES`: tras auditar a mano los 41
ejercicios enlazados a una fórmula, por etiqueta: `fijas` (datos que mantienen el valor del libro: el rizado de 100 Hz de
ej-5.6, los 2 A de prob-4.C, la FI de 10,7 MHz de ej-16.2), `valores` (listas realistas: LED azul de 5 a 20 mA, emisoras
de 88 a 107,5 MHz), `condiciones` (expresiones de los datos que deben ser positivas: transistor de ej-6.2 en zona activa,
salida por debajo de la entrada con margen en ej-1.4, prob-4.A, prob-8.A y ej-33.1, margen del Zener) que se guardan en
el ítem (`ItemNumerico.condiciones`) y comprueba `variantes.ts` `valida`, `intercambiar` (corrientes de carga y del
Zener que el enlace automático cruzó en ej-5.3 y ej-5.8) y `excluir` (prob-6.C, enlazado con la resistencia de Early).
Quedan 40. Revisión 10g: prob-8.A como mucho 20 W en el TO-220 y 1,5 A; ej-8.4 con R₁ ≤ 240 Ω (la corriente mínima del
LM317). El problema del día guardado que ya no existe en los datos y no se ha respondido se elige de nuevo
(`problema-dia.svelte.ts` `problemaExiste`, determinista); respondido, la página enseña su resultado sin el ítem.

**Lo que pide una variante (QA final 1.0).** `ejercicio.pide` lleva huecos `{{id}}` como el enunciado: practica10.mjs
`pideDe` cambia cada valor del libro de un dato que la variante cambia por su hueco (`enlazarEjercicio` devuelve
`textos`, el texto de cada dato en el enunciado; `ajustarEnlace` los intercambia también) y la generación se detiene si
queda alguno. `ejercicio.solo`: el ejercicio del libro pide más de un resultado (respuestas + preguntas + otras > 1).
AJUSTES `normalizado: 'E12'` + `pide` (ej-3.4, ej-5.1: el enunciado pide un valor comercial) → `ItemNumerico
.normalizado`; `variantes.ts` `valida` descarta las variantes en que los dos E12 vecinos quedan casi a la misma distancia
(diferencia ≤ 2·tol del resultado). `variantes.ts`: `pedidoDe(it, v)` → `Pedido` (`Esperado` + `nombre` = el `pide`
relleno, y en un normalizado `valor` = el E12 más cercano por distancia aritmética, tol 0,005, `serie`, `calculado`);
`comprobarPedido` (el E12 exacto «bien»; un prefijo o signo mal del E12, «cerca»; el valor calculado, «cerca» con
«Ese es el valor calculado; …»; cualquier otro, «mal»: no hay «casi E12»); `textoPide` («En esta variante se pide
[solo]:»), `textoCorrecto`, `citaConValores` (la pista «La fórmula del libro» avisa si el párrafo cita valores del
libro). Los usan Numerico.svelte (etiqueta del campo = lo que se pide; un símbolo solo lleva «=»; `data-resultado` =
el valor aceptado), el examen docente (`esperadoVariante` = `pedidoDe`; `VarianteGuardada.esperado` es un `Pedido`,
forma ampliada sin migración: un resultado guardado sin `serie` se corrige igual que antes), ItemExamen,
ResultadoExamen y el PDF (examen: la línea «En esta variante se pide…» y el campo con ese texto; soluciones:
`textoCorrecto`). Cambian las listas de variantes de ej-3.4 y ej-5.1: un examen definido antes puede ver otros valores
en esos dos (los resultados entregados guardan los suyos en `vv`).

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

**1.2.** A chapter may hold 10–32 questions (the 1.1 expansions' questions are in their chapters' sources since the book
took them in). Two optional source fields of `contenido/repaso/<parte>.json`: `"paratexto": true` — `valor_texto` is
checked against the book's own solution of that self-assessment question (`Fuentes/paratexto/<parte>.typ`) instead of
the quote (the chapter computes the answer but does not write it), the quote still in the chapter; `"retirada":
"<label>"` — a question written for a section the book moved out of this part (an alias of the book named after this
part, `sec-33.13`): its `ref` may then be in the part that took it in (`cap33-18` cites `sec-56.6`). Neither reaches the
generated files.

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
(día → `{r, n, b, dr?, dn?, db?}`; desde la 0.12c dos versiones de un día — dos dispositivos o dos pestañas — se unen
con el mayor valor de cada campo, `componentes/repaso/diario.ts unirDiasRepaso`, en el fichero y entre pestañas: antes
ganaba entera la más nueva y se perdían las respuestas y las nuevas de la otra; nunca cuenta dos veces, puede quedarse
corto si los dos repasaron el mismo día. Desde la 0.12d los contadores solo crecen: «Deshacer» sube los de lo
deshecho, `dr`/`dn`/`db` (ausentes mientras valen 0), y las cuentas del día son la diferencia, `efectivo` — con el mayor
por campo, bajar `r` al deshacer hacía volver la respuesta deshecha en todos los dispositivos (revisión 0.12d, hallazgo
2). Una 0.10/0.11 lee `r/n/b`: muestra las respuestas contando las deshechas (su límite de nuevas es entonces más
estricto, nunca más laxo), conserva `dr/dn/db` al cambiar el día (cambia el objeto en su sitio) y toma la versión unida
sin ir y volver; su propio «Deshacer» sigue bajando `r` y frente al mayor de un dispositivo 0.12 se pierde.
«Deshacer» nunca sube lo deshecho por encima de lo respondido (0.12f, hallazgo 3: tras «Reiniciar tarjetas» en otra
pestaña dejaba `dr = r + 1` y la siguiente respuesta del día no contaba), y no devuelve el estado anterior de la
tarjeta si ya no tiene el que dejó esa respuesta (`Deshacer.tras`: tras un reinicio, o respondida en otra pestaña).
«Reiniciar tarjetas» (0.12e, hallazgo 3) borra los días pasados y deja hoy deshecho entero (`dr = r`, `dn = n`,
`db = b`): borrado y vuelto a repasar, hoy se unía por el mayor con la versión ya sincronizada y volvían las cuentas de
antes del reinicio — también las nuevas de hoy, sin nuevas el resto del día; una 0.10/0.11 sigue mostrando las
respuestas de hoy de antes del reinicio (`tests/actualizacion`, pasos 43–55; con el módulo real en el motor,
`b12·18` y `b12·19`, almacenes `AlmacenRepaso` de `tests/motor-real/arnes.ts`). Pruebas:
`tests/actualizacion`, pasos 17–42), `repaso-ajustes` (`{nuevasDia, inversas, mazo}`), `repaso-tests` (parte → `{mejor,
intentos, ultimo}`), `repaso-fallos` (id → `{parte, t, veces}`), `repaso-examenes` (últimos 30). Pruebas:
`tests/repaso.spec.ts` (capturas `tests/capturas/repaso-*.png`).

**Shared question (0.9, `web/src/componentes/pregunta/`).** `Pregunta.svelte` (statement, A–D options or number +
unit, feedback with icons and words, explanation, figure, quote, «Probar otra vez»; the caller keeps the first
answer, `respuesta`/`onresponder`, and gets what is on show through `bind:mostrada`), `CabeceraPasos.svelte` (close,
segmented bar ≤ 30 screens else continuous, «n/N», context line), `PieAcciones.svelte` (sticky footer; children
`.accion`, `.accion.primaria`; `--pie-abajo` clears the tab bar). `figura.ts` → `figuraDeCita(parte, ref, cita)`:
the longest quote fragment (≤ 60 normalised chars) is searched in the top-level blocks of `ref`'s range (section, or
subsection/problem to the next h3); the figure that block cites (`a.ref[data-ref^=fig-]`, same part), else the
nearest `figura` within ±2 blocks without crossing an h2/h3; else null (49 of 1028 questions get one). Used by
`Cuestionario.svelte` (tests, exam, mistakes: scoring and stores unchanged) and the lessons.

## Lessons «Estudiar por pasos» (0.9, `web/src/lib/lecciones.svelte.ts`, `web/src/componentes/leccion/`)

1.0: the lesson's keys (`Leccion.svelte` `teclas`) treat a key whose target is a **disabled** control as free: a numeric
answer's field is disabled as soon as it is answered with Enter but keeps the focus until the browser's focus fixup (the
next rendering update), and the following Enter went to it and was ignored («inside a control») — the intermittent
«16/18 … 15/18» of leccion09.spec.ts under load; its regression test dispatches the Enter on the disabled field. Review
10i: an element focused only to be read (`tabindex="-1"`, the question's verdict that the accessibility pass focuses after
an answer) is free too, so Enter continues from it.

**Route** `#/leccion/<parte>/<label>[/<n>|/pregunta-<n>|/fin]` (Vista `'leccion'`: `ruta.parte`, `ruta.ancla` =
«label[/screen]»; step n is 1-based in the URL). App.svelte hides rail, index, top bar and tab bar for it and takes
the part's accent. Entry: an icon link (`[data-por-pasos]`, «Estudiar por pasos») among the section's tools in
`Seccion.svelte` (owner's decision, 0.11 final pass: no longer at the end of the `h2`). The icon buttons go in
`.iconos`, three to a row (112 px, the width of 0.10.1's three), the lesson icon under the bookmark; the chips
(`.chips`) stay centred on the first row; under 600 px the tools go under the title. Owner's decision (0.12 QA): the
tools never make the title take more lines — the `h2` in `.fila` has `flex: 1 1 auto` (its basis is its one-line
width), so when title and tools do not fit side by side the tools wrap to their own row under it (CSS only, decided
before the first paint); `regresiones12` checks every section at 360, 800 and 1366 px against the title with the
tools hidden. The lesson is one history entry: screens use
`history.replaceState`; close = `history.back()` if the app had a previous route (`ruta.n > 1`), else
`location.replace('#/<parte>/<label>')`; «Siguiente sección» uses `location.replace`.

**Steps** (`lib/leccion-pasos.ts`, pure, no runtime imports): `calcularPasos(bloques, h2) → PasoLeccion[]`
`{titulo, html, num, label, tipo: intro|sub|parte|continua, desde, hasta}` (top-level block range, heading
excluded). One step per h3, plus `intro` for the blocks before the first h3. Without h3: split above a weight of
2600 (text characters; figure 700, equation 160, table 100 + 80/row…) at h4 headings (an h4 opens a step once the
current one weighs ≥ 1000; the h4 becomes its title) or greedily into round(weight / 2000) runs (cut at ≥ 80 % of
the mean, never after a paragraph ending in «:» or a heading, last run ≥ 45 %). An h3 above 7200 is split the same
way into `continua` steps. Steps render with `Bloques` (`raiz`, `desde` = absolute index, so `data-b`, problem
panels and derivation keys match the reader). Questions: Repaso questions of the part whose `ref` is any label
inside the section.

**API** (contract with the start page): `pasosDeSeccion(parte, label)`, `progresoLeccion(parte, label) → {hechos,
total, ultimo, completada} | null`, `ultimaLeccion()` (newest by `t`; if completed, the next section, `pasos` 0 until
computed), `rutaLeccion(parte, label, paso?)`; step indices 0-based. **Data**: almacen key `lecciones`,
`"<parte>/<label>" → {h: steps done, u: last screen, n: steps, c: completed ms | 0, t}`, synchronised (store
`lecciones`). Review 11a (from 1.0): two versions are **merged** (`lib/union-lecciones.ts unirProgresoLeccion`: `h` the
union, `c` the first completion — the smaller non-zero —, `u`/`n` of the newer version — the larger `(t, u, n)` —, `t`
the max; exactly these five fields; commutative, associative, idempotent; nothing in the store is ever removed and a
tombstone never reaches the merge), as the store's `unir` (registro.svelte.ts) and the Guardado's (`lecciones.svelte.ts`;
the load merges too). Before, the newer `t` won: opening on device B a lesson completed on A (`anotarPaso` writes
`{h: [], c: 0, t: now}`) took the completion and the cards done away on both devices. Tests:
`tests/revision11a-unidad.spec.ts` C1–C3 (scenario `r11a·1` of `tests/motor-real/escenarios11a.ts`, two real devices;
the harness loads `lecciones.svelte.ts` with fakes of `datos.ts` and `navegacion.svelte.ts`). Activity: `registrarActividad('paso')` once per step per visit, `('pregunta')` per lesson question
answered (Repaso answers are counted by `registrarRespuesta`); the summary calls `marcarLeida` (which counts
`'seccion'`). Tests: `tests/leccion09.spec.ts` (`playwright.leccion09.config.ts`, port 4311; includes the step
coverage of all 754 sections in Node); screenshots: `node tests/leccion09-capturas.mjs` →
`tests/capturas/lavado09/leccion/`.

1.1: `Leccion.svelte` takes `clasica` (the section also has a hand-authored lesson): its screens then live at
`#/leccion/<parte>/<label>/clasica[/<rest>]` (`hashDe` inserts the segment, `leerPantalla` reads the anchor through
`lib/leccion11/ruta.ts` `anclaClasica`). Next section.

## Hand-authored lessons «lecciones 1.1» (`lib/leccion11/`, `componentes/leccion11/`, data in `libro/lecciones11/`)

**Sources** `contenido/lecciones11/<parte>/<label>.yaml` (one per `h2` section; the authors' format and rules are in
the authors' guide, `contenido/lecciones11/GUIA.md`): `leccion`, `libro` (block index → verbatim
quote; `"parte#n"` for a block outside the section), `modelo` (`valores`: `{sim, nombre, unidad, valor, tipo?:
interruptor, cifras?, recortar?}`; `calculos`: `{expr}` or `{si, entonces, sino}` in the calculators' expression
language, `componentes/calculadoras/expresion.ts`), `tarjetas` (`id`, `tipo`, `titulo`, `texto`, `nota?`, `libro`,
`fijar?`, `inicio?`, `widget?`, `requiere?`, `opciones?` | `estimar?` | `ordenar?` | `emparejar?`, `condiciones?`,
`exito?`, `pistas?`, `ayuda?`, `ec?`, `sustitucion?`, `ideas?`, `comprobar?`). Text markup: `{{id}}` live value,
`_{…}`/`^{…}`, `**…**` — parsed into runs (`Trozo[]`), never HTML.

**Generator** `web/scripts/lecciones11.mjs` (IO only; `--comprobar`, `--solo <parte/label>`; `EPA_LECCIONES11` and
`EPA_LIBRO` relocate sources and book; `contenido/generar.py` runs it after `conceptos11.mjs`). The pure
`lib/leccion11/generar.ts` `generarLeccion(fuente, {bloques(parte)})` normalises and validates: unknown keys, card
types and their required parts, unique ids, summary last; ≤ 40 words per card (title + text + note), ≤ 20 per option /
order item / pair, ≤ 40 per explanation, hint, help, success text or idea; every option with `porque`, exactly one
right; every reference (placeholders, controls, readings, bars, chips, conditions, hints, handles, curves, expressions)
resolved in the model, no cycles (`modelo.orden` is the topological order); every number written in a card found in
the cited blocks' text (`textoDeBloque`: paragraphs, lists, tables, boxes, derivations, exercises and solutions) or
produced by a `comprobar` of that card (rounded to the written decimals, any SI prefix) or a fixed value; each quote
verbatim in its block, bare block numbers inside the section; challenges searched exhaustively over the controls'
positions (≤ 250 000): solvable, not solved at the start, a hint for every failing position; estimates reachable and
not right at the start; curves finite over the axis (log axes sampled geometrically). Circuit widgets carry `mide`
(schematic observable → model calculation) and/or graph curves with `mide`: `lib/leccion11/spice.ts`
`comprobacionesCircuito` builds the schematic's netlist (its definition's `netlist(c, analisis)`, 0 V sources as
ammeters, initial conditions on the C/L lines, `uic`) for the initial state, both ends of each control and each
`comprobar` — `.op` for DC readings, `.ac lin 1 f f` for AC readings at the piece `f`, `.tran` (step = axis/1000,
after `periodos` whole periods for rectifiers) or `.ac dec 40` for curves — and the script runs them on the app's
WebAssembly ngspice (`libro-node.mjs` `motor()`), comparing with `compararSimulacion`: DC/AC 0.1 % (phase 0.1°, 0.01 dB),
transient 1 % of the y axis, never below 1 nA / 1 µV (GMIN leakage). Constant-drop pieces (`NoLineal`: diode vd, LED
vf, Zener vz, BJT vbe/vcesat) are simulated with a real exponential device calibrated to that drop at a reference
current (`esquemas/comun.ts`); a DC reading is corrected by the model's own sensitivity (finite difference of the
author's model) times the simulated drop's difference (`medida`), then compared at 0.1 %, and the difference must stay
within the documented deviation (0.1 V diode/Zener/VBE, 0.2 V LED/VCE(sat)); curves add deviation × |sensitivity|.
Shockley pieces (`is`, `n`, `vt`) simulate exactly that equation at T = VT·q/k. Any error: exit 1, nothing written. Outputs are rewritten only when they change, outputs without a
source are deleted, and the index keeps the book's order (idempotent, order-stable; the unit test compares a fresh run
with the committed output).

**Data** `libro/lecciones11/indice.json` `{version: 1, total, lecciones: {"parte/label": {tarjetas, preguntas: [{id,
tipo}]}}}` (motor fixes 1.1: `preguntas` = the cards «Práctica inteligente» asks on their own, `motor.ts`
`esPracticable`/`entradaIndice`; an older index without it offers nothing to practise) and
`libro/lecciones11/<parte>/<label>.json` = `Leccion11` (`lib/leccion11/tipos.ts`): `{version, id, parte, seccion, num,
titulo, libro: {"parte#n": {parte, bloque, cita}}, modelo: {valores, calculos, orden}, tarjetas: Tarjeta[]}`. A card
keeps its normalised parts: `fase` (label), `fijar`/`inicio`, `widget` (`circuito`: `esquema` (a registered schematic
name), `piezas`, `mandos`, `ocultar`, `lectura`, `barras`, `datos`, `corriente`, and only when used `grafica` {x, y,
curvas, asas, marcas?} and `dibujo: false`; `grafica`: `x` (with the axis variable `id`), `y` (each with `escala: 'log'`
only when logarithmic), `curvas` (`mide` only in a circuit's graph), `asas` {mueve, x, y}, `marcas?` {x, y, rotulo,
guias}, `mandos`, `lectura`, `datos`), `mandos` with their positions resolved (`valores`:
linear, E12/E24 from `eseries.ts` `aSerie`, a list, or [0, 1] for `interruptor`/`conectar`; a list may carry
`nombres`, one per position in the order of `valores`: no digits, unique, ≤ 24 characters), `requiere` {mover, minimo,
conectar}, `condiciones`/`pistas.cuando` as ranges {valor, min?, max?} (`estimacion` = the reader's estimate),
`ordenar.inicio`/`emparejar.inicio` (a fixed derangement), `ec` {libro, svg, fuente, w, h} copied from the book block.

**Route** (`lib/leccion11/ruta.ts`, `componentes/leccion11/ElegirLeccion.svelte`, which App.svelte mounts for the vista
`leccion`): a section in the index opens `Leccion11.svelte` unless the anchor's rest is `clasica[/…]`, `practica-N`,
`pregunta-N` or `fin` (the 1.0 lesson, with `clasica`). Cards replace the URL (`/<n>`, 1-based; one history entry).
A card number arriving with 1.0 progress of another length (the course's «Continuar» of a section half studied in 1.0)
opens the first card.

**Engine** (`lib/leccion11/motor.ts`, pure): `EstadoTarjeta` per card and visit {movidos, eleccion, descartadas,
comprobado, bien, intentos, resuelta, estimacion, orden, puestas, cerrada}; `botonPrincipal` (Continuar gated by
`requiere` on explore/surprise cards — every listed value moved, at least `minimo`, every `conectar` switch closed —
or Comprobar → Volver a intentarlo / Continuar), `comprobar` (feedback: the chosen option's `porque`; or `exito`; or
the first hint whose range holds, plus «n de N en su sitio» on order/match and `ayuda` from the second failure),
`reintentar`, `eventoDeComprobacion` → `{tipo: 'respuesta', id: '<parte>-l11-<label>-<card id>', clase: 'practica',
origen: 'leccion' (or 'inteligente' from a practice session), parte, seccion, subtipo: 'leccion11-<tipo>', intento,
pistas, final}` (final at the right answer or
the second attempt; nothing after that in the visit). The model (`lib/leccion11/modelo.ts`): values carried from card to
card (`propios`), `fijar` as an overlay, `inicio` applied the first time a card is shown in the visit.

**Storage**: nothing new. `lecciones` (same key and shape as 1.0): `anotarPaso(card)`, `completarPaso` on «Continuar»,
`completarLeccion(n = cards)` on the summary (h = all, u = n); `registrarActividad('paso')` per card passed and
`('pregunta')` per card answered; `marcarLeida` and `leccion-completada` at the summary; answers through the learning
events (XP `pr:<id>` once, mastery of «parte/label» — hence the spaced review shown in the summary with
`camino.ts repasoDe`). Leave guard: `registrarGuardaSalida` with the app's dialog while the lesson is started and not
finished (its `hay` must not read the address: the router pushes the page's own address back before asking).

**Style 1.1** (`src/estilos/tokens11.css`, imported once by `app.css` since the app-wide restyle; `fuentes11.css`: Inter 400–700 latin/latin-ext/greek
and Space Grotesk 500–700 latin/latin-ext from `@fontsource`, OFL, bundled): `--v11-*` tokens for `:root` (light),
`[data-tema='sepia']`, `[data-tema='oscuro']` — surfaces (marco, fondo, panel, linea, borde), ink (tinta, tinta-suave),
accents (azul, azul-hover, azul-tinte, sobre-azul, naranja, naranja-texto, verde), feedback (bien*, mal*), progress
(hecho, actual, pendiente), inactive button, focus, radii, fonts. `lib/leccion11/contraste.ts` lists every pair the
components use with its minimum (text 4.5, graphics 3) and checks the three themes. The rest of the app uses the same
tokens through the 1.0 names (see «1.1 visual style across the app»).

**Schematics** (`lib/leccion11/esquemas/`): one folder per schematic, `<nombre>/esquema.ts` (default export
`DefinicionEsquema`, `esquemas/tipos.ts`: pieces {descripcion, obligatoria?, interruptor?, color?, seVeCon?},
observables {medida, analisis op|tran|ac, ac? mag|fase|db, unidad, requiere?}, `validar?`, `noLineal?`, `netlist`,
`tran.periodos?`, `describir`) and `<nombre>/Dibujo.svelte` (props `PropsDibujo`: `ContextoDibujo` with the pieces'
values, symbols as runs, formatted values; drawn with `esquemas/kit/` parts and the global classes of
`componentes/leccion11/esquemas11.css`, scoped to `svg.e11`). `registro.ts` keeps the registry; the app fills it with
`definiciones.ts` / `dibujos.ts` (`import.meta.glob`), Node with `web/scripts/esquemas11.mjs` (reads the folders) —
no shared list to edit. Shared helpers: `comun.ts` (netlist numbers, the book's VT, calibrated diode/Zener/NPN models),
`comun-ca.ts` (sine source, phasor, AC observables), `comun-diodo.ts` (constant drop or Shockley). Registered:
divisor, paralelo, serie, mixto, kirchhoff, wheatstone, thevenin, norton, transformador, carga-rc, carga-rl,
filtro-rc, filtro-rl, rlc-serie, rlc-paralelo, diodo, led, zener, media-onda, puente, bjt-interruptor,
bjt-polarizacion, condensadores-serie (two capacitors in series with their leakages and optional balancing resistors,
sección 3.9; DC readings only), espejo (the simple current mirror of sección 6.11 with an optional V_BE mismatch, a
source in series with Q2's base; DC readings only), recortador (a diode clipper of sección 5.9: sine input, series
R and, from the output node, a positive-peak branch — diode, optional Zener `vz`, optional reference `vref` — and a
negative-peak diode, each behind an optional switch, or two Zeners in antiserie `zz`; transient curves of the output,
the input and the current), fijador (the clamper of sección 5.9, its diode's direction by the `sube` switch, and with
`c2` the Greinacher doubler of sección 5.10; no load, capacitors start at their steady state). The expression language gained `wright(x)` (Wright ω, `calculadoras/expresion.ts`) to solve a
Shockley diode in series with a resistor.

**Components** (`componentes/leccion11/`): `Leccion11.svelte` (screen, keys, guard, summary with
`progreso/CelebracionLeccion.svelte`; scroll-padding = sticky header/footer heights, so keyboard focus is never under
«Continuar»), `CircuitoLeccion.svelte` (looks the schematic up by name and renders its drawing, reading, bars, chips,
moving current — `prefers-reduced-motion` stops it —, the circuit's graph through `GraficaLeccion` without its own
controls, and a polite live region 0.7 s after changes; no empty panel with `dibujo: false`), `GraficaLeccion.svelte`
(curves, linear or log ticks, fixed marks with guides, draggable handles as `role="slider"`, nearest-position search;
margins, scales and tick labels from `lib/leccion11/ejes.ts` `geometriaGrafica`, fix11b: every tick keeps its grid line
but only the labels that fit are drawn — on a log axis every s-th decade, s the smallest stride that fits, then the 2
and 5 if room is left; a decade reads «10¹⁰ cm⁻³», not «1 × 10¹⁰»; the end x labels anchor inwards; the left margin
grows with the widest y label, up to 120 — and `lecciones11-unidad` checks every published graph for overlaps; fix 11c:
the labels' size `tamMarca(width on screen)` renders them at ≥ 11 px on a phone (12 on a desktop; the bottom margin,
the baselines and the widest left margin scale with it, a y label that would still not fit is not drawn), and when a y
label sits at the bottom no x label may reach left of the y axis — the first one anchors at it —, so the origin's
corner never overlaps; the x axis's name is a `TextoSvg` (its subscripts); `etiquetaMarca` writes «1 vez»; tests in
`tests/revision11c-unidad.spec.ts`),
`TextoSvg` (runs inside SVG text: subscripts as shifted tspans), `Mandos.svelte` (sliders are
`teoria/MandoValor.svelte` in the 1.1 tokens — its aria-valuemin/max/now are written without exponent straight in the
markup (`teoria-viva.ts` `ariaNumero`, motor fixes 1.1: the earlier action lost to Svelte's own update on every move
and «2.2e-7» came back; axe rejects it), on every update, also on the graph handles and the estimate; aria-valuetext
in words with `habla-matematicas` `leerUnidades` («220 nanofaradios», «21 nanovoltios por raíz de hercio»); a named
list position reads «rojo (2)»; switches; «conectar»), `Opciones`, `Estimar`, `Ordenar`, `Emparejar` (long items wrap:
the slot column keeps ≥ 50 % of the row),
`TextoVivo` (runs) and `ElegirLeccion`. The formula card renders the book's equation with `Ecuacion.svelte` (spoken by
`habla-matematicas`). Tests: `tests/lecciones11-unidad.spec.ts`, `tests/lecciones11-esquemas.spec.ts` (registry, every
schematic against ngspice through the catalogue lesson `web/tests/lecciones11-catalogo/cap01/sec-1.5.yaml`, model
mutations that must fail, spice.ts, new generator rules), `tests/lecciones11-catalogo.spec.ts` (that lesson served by
route interception in any build: render, keyboard, axe × 3 themes, 360 px), `tests/lecciones11-navegador.spec.ts`
(`playwright.lecciones11.config.ts`, port 4671, build in `/tmp/claude-0/epa-motor11/dist`) and
`tests/lecciones11-recorrido.spec.ts`, a parametric walk of every published lesson from its JSON (`EPA_RECORRER`
regex filter): explore gating, each question wrong then right, challenges solved at a model-found position, estimates,
order, match, axe per card, and a 360 px dark-theme pass. 1.2 steps are walked from the model too: `simular` (the
right estimate, then the app's ngspice result), `banco` (the expected reading compares within tolerance), `ajuste`
(first control position inside the band), `averia` (probes, a wrong suspect, then the fault of round 0 from
`falloDeRonda`), `dibujar` (each point set on the curve through the value slider) and `diseno` (as a challenge).

**Review 11c (fix 11c)** in `Leccion11.svelte`: the cards replace the address through `lib/ruta.svelte.ts`
`reemplazarDireccion(h)`, which also updates the router's `direccionActual`, so a leave question cancelled («Seguir en
la lección», Esc, Back) puts back the card on show (the 1.0 lesson uses it too); an address without a card number opens
the stored `u` of an unfinished lesson whose `n` matches (the book's «Estudiar por pasos», the course path's node, a
project stage's link: before, card 1, which also overwrote `u`); the cards in `h` of an unfinished lesson start as
answered (`motor.ts` `estadoRespondido`: an option, an order or a pairing shows its right answer and explanation under
«La respuesta.»; an estimate or a challenge only opens «Continuar»; `cerrada`, so nothing is reported again); a
prediction's hidden reading (`widget.ocultar`) shows once the card is `resuelta` or skipped in this visit (`saltadas`),
not with a wrong check's explanation (`TarjetaPractica`: `resuelta` or the round `cerrada`); 1–5 / A–E also work while
an option has the focus (→, ← and Intro keep their native meaning there). Schematics (`esquemas/kit/Lienzo.svelte`):
`--k` = the factor that renders the 13 px labels at ≥ 11 px (1 on wide screens, ≤ 1,25), used by `.e11 .et` in
`esquemas11.css`; `espejo` draws the load as symbol and value on two lines (it crossed the V_CC wire) and the values
22 below their symbols in `espejo` and `condensadores-serie` (subscripts hung into them).

**In «Práctica inteligente» and the section's spaced review** (motor fixes 1.1): `catalogo.ts` `itemsLecciones11(parte)`
adds each index `preguntas` entry as an `ItemCatalogo` `{id: '<parte>-l11-<label>-<card>', tipo: 'leccion11', subtipo:
'leccion11-<tipo>', concepto: 'parte/label'}` — the id the lesson's own answers use, so XP (`pr:<id>`) is given once
wherever the card is answered and the mastery rounds are the same item's (a lesson answer right after a practice one
falls inside the round window and is not counted again). `practicar/sesion.ts` loads the lesson and finds the card by
that id (skipped if gone or no longer practicable); `componentes/leccion11/TarjetaPractica.svelte` renders the card
on its own in the state the generator checks it in (`motor.ts` `valoresSueltos`: model values plus the `inicio` of
every card up to it, then its `fijar`), with its own Comprobar / Volver a intentarlo, explanations and hints; it emits
`eventoDeComprobacion(…, 'inteligente')` and reports to the session when the round closes (right, or the second wrong
check). Nothing new is stored. `conceptos11.mjs` also counts the sections whose lesson has `preguntas`
(`lecciones11.mjs` runs it again whenever it rewrites the index). Tests: `tests/lecciones11-practica.spec.ts`.

### Deep links of the printed book (1.1, `lib/enlaces.ts`, `lib/enlaces-app.ts`, `src-tauri/src/lib.rs` `enlaces`)

The book's new layout prints a QR per section: `epa://leccion/<parte>/<label>`. `leerEnlace` (pure) accepts only that:
the whole text, trimmed and compared in lower case, ≤ 120 characters, the scheme `epa://`, the one prefix `leccion`,
two segments of `[a-z0-9.-]{1,40}`, the part `cap\d{2}`, `ap[a-z]` or `cap-new-[a-z0-9]+` (the expansions' new
chapters, review 11c; the Rust side only checks scheme, ASCII and length, and its test now names one), the label `sec-…` or `<parte>-…` ending in a
letter or digit, no `..`, query, fragment, escape or extra segment. `resolverEnlace(e, indice)` gives the book's own
spelling (apA, sec-A.1) or null; `rutaDeEnlace` → `#/leccion/<parte>/<label>` (resolved when the index is there, else
the link's lower case) or `#/leccion` for an invalid link. Never any other route, never an outside URL.
- Lesson page (`ElegirLeccion.svelte`): with the index loaded, a part/section it lacks (or none) shows «No se encuentra
  esa lección» (`[data-leccion-no-encontrada]`, h1, a 44 px «Ir al índice del libro» → `#/`) instead of the lessons'
  loading error; a case-insensitive match is replaced (`location.replace`) by the book's spelling, keeping the rest of
  the anchor.
- Browser: `lib/ruta.svelte.ts leer()` turns a hash `#epa://…` / `#/epa://…` (also percent-encoded, `epa%3A…`) into
  its route with `history.replaceState` (`rutaDeHashEnlace`; «Atrás» does not come back to the link); other hashes are
  untouched.
- Tauri: `tauri-plugin-deep-link` `=2.6.3` (needs tauri 2.12, tauri-plugin 2.7; builds with rust-ini 0.21.3 on Linux,
  which 2.6.2 does not), registered after the single instance. `tauri.conf.json plugins.deep-link`: `desktop.schemes
  ["epa"]` (the bundler registers it: NSIS/MSI registry for the user, macOS Info.plist; Linux `.desktop` MimeType with
  `%u` in `linux/electronica.desktop`) and `mobile [{scheme ["epa"], host "leccion", appLink false}]` (the plugin's
  Kotlin side accepts only links that match it). Module `enlaces`: `instalar` keeps the cold-start link
  (`get_current`: Windows/Linux command line, Android intent) and every later one (`on_open_url`: macOS «open URL»,
  Android new intent; Windows/Linux second launch → single-instance callback → `handle_cli_arguments`), after a light
  check (`aceptable`: `epa://`, printable ASCII, ≤ 120 bytes; Rust test), emits `epa-enlace` and brings the window
  forward; command `enlace_pendiente` gives it once (first call also asks `get_current`, for an Android intent that
  reached the plugin after setup). No new webview permission (an app command; `core:default` has event listening).
  `enlaces-app.ts iniciarEnlaces` (App.svelte, after `iniciarRuta`): listen first, then ask; `abrirEnlace` →
  `location.hash = rutaDeEnlace(url, app.indice)`.
- Android project: `web/scripts/android-enlaces.mjs` (called by `android-preparar.mjs`, step 4) writes the intent filter
  of each `mobile` entry into `gen/android/app/src/main/AndroidManifest.xml` in the block «DEEP LINK PLUGIN» exactly as
  the plugin's build script does at every Android build (`tauri-utils insert_into_xml`: same markers, content and
  place, so the build rewrites the same block — no second filter), and makes the activity `singleTask` (Tauri's
  template already is: a link while the app runs goes to `onNewIntent`). Fails when there is no mobile scheme or not
  exactly one `<activity>`.
- Tests: `tests/enlaces11-unidad.spec.ts` (every section of every chapter and appendix as printed and upper-cased → its
  route; 30-odd malicious or malformed links; the hash forms; the manifest from `tests/enlaces11/AndroidManifest.
  plantilla.xml`, idempotent; the Tauri configuration and wiring), `tests/enlaces11-navegador.spec.ts` (hash → 1.1
  lesson, classic lesson, appendix in another case; «Atrás»; «no encontrada» for five links, axe ×3 themes, 360 px),
  `cargo check`, `cargo test --lib`.

## Lesson shell, living circuit and identity (1.2, agent ui12)

Nothing stored changes: no new key, no schema version, no migration. Lesson data (`libro/lecciones11/…`) is read as in
1.1; the drawings gained attributes only.

- **Rhythm** — `lib/leccion12/ritmo.ts` (pure): `Ritmo { fase: 'normal' | 'vuelta' | 'hecha'; falladas; vuelta; j }`,
  `anotarFallada` (first check wrong, or «Saltar»; normal round only), `siguiente` / `anterior` (entering the summary with
  missed cards starts the return round: lesson order, once, `fresca` = shown with a new `nuevoEstado`), `segmentos` /
  `posicion` (one segment per card plus one per returning card before the summary). Per visit only; the `lecciones`
  record (`u`, `h`, `n`, `c`) keeps meaning card indexes. `Leccion11.svelte` keeps the values of each card's first showing
  (`entradas`) and gives them back to a returning card; `respondidas`/`aCuenta` count only the normal round. Every check
  cues `retro('acierto' | 'fallo')` when `eventoDeComprobacion` returns no event (a closed round); otherwise the event's
  own cue (`retroDe`). Marks: `[data-leccion11][data-vuelta]`, `.seg[data-seg="vuelta"]`, the label «x de y · Repaso».
  The card body is keyed by a visit counter (`{#key visita}`) with `in:fly` (0 ms with reduced motion). Body order: title,
  formula, widget, text, note, conditions, answer chain, then the motor12 slot (`<!-- leccion12: actividad -->`).
- **Mastery state of the map** — `dominadaDe(d, ahora)` in `lib/aprendizaje/camino.ts`: `d.nivel === 'dominado'` and
  `repasoDe(d, ahora).k === 'fecha'`. `NodoVista.dominada?` (set by `PaginaCursos.svelte` for done/passed lessons),
  `li[data-dominada]`, the legend `[data-leyenda-camino]`; the list view adds «· Dominada»; the summary `[data-dominada]`.
- **Living circuit** — `componentes/leccion12/CircuitoVivo.svelte` wraps each drawing in `CircuitoLeccion.svelte` (prop
  `manipular`, default true). Drawing contract (all optional, `lib/leccion11/esquemas/<nombre>/Dibujo.svelte` and the kit):
  `path.flujo[data-medidor="<0 V source>"]` or `[data-i="<A>"]` (kit `Flujo` props `medidor`, `i`; else the widget's
  `corriente`); wires and node dots `[data-red="<netlist node>"]` (kit `Pila`/`FuenteCA`/`FuenteI` prop
  `nodos=[y1 end, y2 end]` splits their leads); parts `[data-pieza="<piece>"]` (kit prop `pieza`, a wrapping `<g>`);
  `FuenteCA` marks `[data-alterna]` (AC: particles swing, no voltages); part bodies `[data-cuerpo="x0 y0 x1 y1"]` (kit
  R, L, C, D, Pila, Interruptor, Conmutador, Trafo; `kit/geometria.ts` `cajaCuerpo`). fix12, particles only on wires:
  `zonasDelDibujo` (cached on a geometry signature) collects the declared bodies, every `text` box, every small closed
  shape (≤ 50 units: dots, terminals, triangles, source circles) and the «ink» of every other shape more than 1,2 units
  off the `.flujo` paths; `particulas.ts` `ocultar(caminos, k)` turns `Camino.zonas` into arc-length `ocultos`
  (Liang–Barsky against each zone grown by radius + 3 px) that `recorrer`/`dibujarCon` skip; still arrows use
  `visibleCerca(c, s, 8)`. Test hook: `[data-vivo].__epaParticulas()` (visible positions, SVG units),
  `__epaParticulasTodas()`. An «averia» card whose fault is hidden (`!(comprobado && bien)`, not skipped) gets the
  healthy board's values (`valoresDeTarjeta(t, propios, null)`) and `oculto` (Leccion11 `averiaOculta`). Voltages: `def.netlist(ctx, 'op')` →
  `resolverCC` (`lib/leccion12/cc.ts`: R, V, I, C open, L short, E, F; 10⁻¹² S gmin; null with any other element) or, for
  non-linear netlists, `nodosConocidos` (ground, sources to ground, propagated through 0 V meters and coils); none with
  SIN/PULSE/PWL/IC=, nor in a prediction (`oculto`). Colours: `colorTension` (`lib/leccion12/identidad.ts`, OKLab between
  `--v11-tension-neg/-cero/-pos`, gamma 0,65 on ±max |V|) as inline `stroke`/`fill` with `[data-tension]`. Particles:
  `avanzarCon`/`dibujarCon` (generic variants of figuras-vivas' `avanzar`/`dibujar`, which now call them), IREF 0,1 A,
  AC period 1,6 s, DPR ≤ 2. Measures on `[data-vivo]`: `data-vivo` (`animado` | `quieto`), `data-vivo-nivel` (0 full,
  1 half particles at 30 fps, 2 still arrows; down a level after two 60-frame windows slower than ~30 fps or over 12 ms
  of drawing), `data-vivo-fps`, `data-vivo-ms`, `data-vivo-tensiones` (`exactas` | `conocidas` | `no`). Labels
  `[data-tension-nodo]`, legend `[data-leyenda-tension]`, toggle `[data-ver-tensiones]` (aria-pressed, session only).
- **Direct manipulation** — `lib/leccion12/manipular.ts` (pure): `mandoDePieza(widget, pieza)`, `piezasManipulables`,
  `pasoMando(m, actual, delta)` (positions of `m.valores`, clamped), `pasosDeArrastre` (max of right / up, 6–22 px per
  position), `pasosDeTecla`. On the drawing: `[data-asa="<piece>"]` — `role="slider"` (aria-valuenow via `ariaNumero`,
  aria-valuetext via `leerUnidades`, as `MandoValor`), ≥ 44 × 44 px, pointer capture; a tap opens `[data-pasos]` (− / +);
  switches and «conectar» are `role="switch"` buttons. Values go through the card's `alMover`.
- **One idea per screen** — `avisosUnaIdea(t): string[]` and `contarFrases` (`lib/leccion12/una-idea.ts`, pure): > 40
  words (title + text + note), > 2 sentences, or no visual (widget, ec, estimar, ordenar, emparejar, actividad); summary
  exempt. For the generator's warnings.
- **Identity tokens** — `estilos/tokens11.css`: `--v11-mono` (JetBrains Mono, `estilos/fuentes12.css`, woff2 400/700 in
  `estilos/fuentes12/` with its OFL), book ink/greys, `--v11-rojo`, `--v11-violeta`, `--v11-bloque` (wires; set per lesson
  on `.l11` from `hiloDeBloque(part colour, theme)`: 45 % towards ink, 62 % towards white in dark), `--v11-tension-*`.
  `app.css` `--mono` → `--v11-mono`. Pairs in `lib/leccion11/contraste.ts` (`PARES`), the scale and the six blocks checked
  by `tests/lecciones11-ui12-unidad.spec.ts`. `.e11 .hilo` / `.nodo` use `--v11-bloque`.

## Learning-by-doing steps of the lessons (1.2, `lib/leccion12/`, `componentes/leccion12/`)

**Schema version.** `Leccion11.version` stays **1**: everything below is optional and additive in the same files
(`libro/lecciones11/<parte>/<label>.json`, written by `scripts/lecciones11.mjs`), and the app and its data ship
together. **No stored state changes** (no new storage key, no migration): the activities' state lives in memory
(`EstadoTarjeta.actividad`, `pistasVistas`), the lesson's progress keeps its `lecciones` record (`u`, `h`, `n`, `c`)
and answers keep their event (`id` `<parte>-l11-<label>-<card id>`, `subtipo` `leccion11-<tipo>`). Lessons written
before 1.2 generate byte for byte the same output.

**Card types.** `TipoTarjeta` adds `simular`, `diseno`, `averia`, `ajuste`, `banco`, `dibujar`, `sql`; each carries
`actividad: Actividad12` (`lib/leccion12/tipos.ts`):
- `simular` {objetivo (expr), unidad, cifras, tol, rotulo, medida? (an observable of the circuit widget, simulated in
  the app), errores: [{expr? | razon? {min?, max?}, tol?, texto}]};
- `diseno` {tolerancias: {valor: fraction}, metodo: esquinas | montecarlo, muestras, semilla (FNV-1a of
  «parte/label/card»), exigir: nominal | todas | fraction, siTolerancias?} + the card's `condiciones` (the spec);
- `averia` {fallos: [{id, pieza, tipo: abierta | corto | alto | bajo | reves | base-abierta | valor, con: {valor:
  number}, texto}], sospechosos: [{id, rotulo}], sondas: [{id, rotulo, valor, curva? {expr, x, y}}], pasos, eleccion:
  fija | azar, preguntarTipo, sano (the healthy values of everything a fault changes, set by the generator)};
- `ajuste` {banda {valor, min, max}, rotulo, escala {min, max}, bajo, alto, dentro};
- `banco` {piezas, medir, esperado (expr), unidad, cifras, tol, consejos: [{cuando? (range on `desviacion` =
  measured/expected − 1, or `medida`), texto}], ficha? {n, titulo}};
- `dibujar` {x (with `id`), y, curva (expr of x.id), puntos, tol, holgura, rotulo};
- `sql` {modo: consulta | rellenar | ordenar, base: 'mediciones', solucion, esperado {columnas, filas} (the reference
  query's result, computed by the generator with sql.js), ordenado, inicial?, plantilla? + huecos? [{opciones?}],
  clausulas? + inicio? (derangement)}.
Every card may also carry `escalera: Texto[]` (1–2 hints) and `solucion: Texto` (the hint ladder).

**Engine** (`lib/leccion12/motor12.ts`, pure; `lib/leccion11/motor.ts` delegates when `t.actividad`):
`nuevoEstadoActividad` (simular {texto, valor}; averia {fallo, ronda, medidas, sospechoso, tipoElegido, descartados};
banco {texto, valor, comparado}; dibujar {ys, punto}; sql {texto, huecos, orden, ejecutado}), `puedeComprobar12`,
`comprobar12` → {bien, textos, resuelta?, estado?} (simular resolves the card whatever the verdict: «Continuar» after
the one commit), `exploracion12` (ajuste: «Continuar» inside the band; banco: always), `reintentar12`, `otraAveria`.
`esComprobable`/`esPracticable`: all but `ajuste` and `banco`. `eventoDeComprobacion.pistas` = max(the 1.1 rule, the
ladder steps opened). `modelo.ts valoresDeTarjeta(t, propios, e?)` lays the hidden fault over the widget's values.
Numeric checks are deterministic: corners, seeded Monte Carlo (mulberry32), `falloDeRonda` (fija: list order; azar:
a seeded draw that never repeats the previous round's; the app seeds it afresh each time the card opens and on
«Otra placa», `azar.ts semillaNueva`, so only the verdicts, not which fault, are fixed), the drawing's metric
(`lib/leccion12/dibujo.ts`: RMS of the difference / y-axis height, minimised over a shift ≤ holgura·x-range and an
offset ≤ holgura·y-height), probe readings quantised to 1/1000 of each probe's largest value (`averia.ts lecturas`).

**SQL sandbox** (`lib/leccion12/sql/`): sql.js **1.14.2** (MIT; SQLite compiled to WebAssembly), its browser build
`sql-wasm-browser.wasm` (658 kB, 326 kB gzip) bundled by Vite as an asset and loaded only by the worker
`sql.worker.ts`, which `cliente.ts` starts when an SQL card runs its first query (dynamic import: no other screen
loads it). The worker builds the sample database once (`muestra.ts`: the book's schema of section 17.10 verbatim plus
`horas`; 21 888 sample rows, 4 sensors every 600 s from 2026-02-25 to 2026-04-04 UTC, seeded) and runs each query on a
fresh copy (writes never carry over); a query over 5 s is stopped by terminating the worker. Results: at most 500 rows
come back (`total` says how many). `ejecutar.ts`: `explicarError` (SQLite messages in Spanish),
`compararResultados` (columns by count, rows, order only when `ordenado`, numbers to 1e-9 relative). `node.ts`: the
same database in Node for the generator and the tests.

**Generator** (`lib/leccion12/generar12.ts`, called by `lib/leccion11/generar.ts`): each type's checks (GUIA §10),
its texts through the numbers rule, each fault's state added to the circuit's ngspice cross-check; warnings for
answered cards without any hint and (ui12) `avisosUnaIdea`. `ContextoLibro.sql` (optional) runs SQL; without it SQL
cards are an error.

## Práctica «Aprender haciendo» (0.10, `web/src/componentes/practica/`, data in `web/public/libro/practica/`)

Interactive items placed in the lessons (and in Repaso's «Aprender haciendo» and under exercises), generated only
from the book's data: no sentence written for the reader beyond fixed frames around book names and values
(«Toque R<sub>2</sub> en el esquema de la figura 1.3.», «Si duplica R<sub>2</sub> (de 5 kΩ a 10 kΩ), ¿la tensión en
V<sub>sal</sub> aumenta, disminuye o se queda igual?», «Calcula … si …»).

**Generation.** `web/scripts/practica10.mjs` (Node 22, imports the app's TypeScript modules; `--solo <parte>`,
`--sin-simular`, `--detalle`; about one minute and ~3800 runs of the app's WebAssembly ngspice) writes
`practica/<parte>.json` and `practica/indice.json`. Deterministic. Sources and rules:
- `numerico` (problems with changing values): every formula of `formulas.json` with a book example, and every
  numeric exercise of `ejercicios.json` that a catalogue formula of the same part reproduces with the quantities of its
  statement (all assignments by unit tried; the answer within the exercise's tolerance; each quantity found exactly
  once in the statement HTML, which is stored with `{{var}}` placeholders; a statement that already contains the
  answer is refused). Inputs vary over fixed lists (`variantes.ts variacionDe`): E12 for Ω/F/H in ×⅓…×3 of the book
  value, usual supplies (3,3…48 V) for voltages ≥ 3 V that are not a device's own (Zener, Early, threshold, logic
  levels, references…), round 1-1,5-2-2,2-3-3,3-4-4,7-5-6-6,8-8 series for A, W, Hz, s, J, C, S…; the rest keeps the
  book value. At least 8 valid variants (finite, same sign as the book's result, inside the result's range).
- `prediccion` and `deslizador`: simulable schematics of figures without AC/pulse sources (`figuras-vivas/esquema/
  netlist.ts`, operating point) and book netlists with an `op` analysis, not XSPICE, ≤ 3 s (reduced to `.op` +
  `.options savecurrents` by `circuito.ts netlistLibroOp`). Changes: designated resistors and sources ×2 and ×½;
  observed: labelled nodes, LED/diode currents, collector currents, resistor currents and voltages (only names that
  read as the book's designators; a part's own current/voltage is never asked). One prediction per section (a figure
  first), scored by teaching value (changes ≥ 5 %, some «se queda igual»). Sliders sweep the E12 values ×0,1…×10 of a
  designated resistor; target = the reading at an E12 value 3–6 steps away, rounded to 2 figures, reached by 1–3
  values (not the book's) within ±5 %.
- `toque`: every figure with schematic data; a part named by its unique designator or as the only one of its kind,
  or a node with its own label.
- `protoboard`: simulable figure schematics laid out by the breadboard (`montaje.ts`: `circuitoDeEsquema` →
  `colocarCircuito`); a two-leg part (LED, diode, resistor) lifted to beside the board or to the central channel, or a
  jumper removed; parts and wires alternate between figures; kept only when the full board verifies and the
  incomplete one does not.
- `ordenar`: top-level numbered lists of 3–8 distinct items of ≤ 260 characters (the book's sentence before the list
  is the context). Id `<parte>-orden-<section>-<n>` (review 11a: never moved by an expansion): first the registry
  `contenido/ids_practica.json` (`{version, orden: {<fingerprint>: id}}`; fingerprint = sha1 of part, section and the
  steps as plain text with each `<a class="ref">` as its label, so a renumbering does not change it; seeded with every id
  of 1.0 and 1.1, only grows: `node scripts/practica10.mjs --registrar-ids`, which the run reminds of when a list is not
  registered); else `n` = the list's index counting only the book's blocks (blocks marked `ampliacion` skipped — the 1.0
  index while an expansion is merged; an expansion's own list, its index in the part). An id already used in the part
  gets `-2`, `-3`…; `bloque` stays the real index. When the author pastes an expansion, its blocks lose their mark and
  the indices after them shift: a registered list keeps its id by its fingerprint; an unregistered one would get the new
  index (register before publishing). `EPA_IDS_PRACTICA` relocates the registry (tests). Tests:
  `tests/revision11a-unidad.spec.ts` B1 (no 1.0 id lost; every published `ordenar` id registered) and B3 (cap31 and cap33
  with the expansions pasted keep their ids; without the registry, cap33's would change). `parejas`: glossary entries whose «ver» point into the section (≥ 3; term ↔ first sentence of the
  definition, which must not contain the term), and terms with a symbol in `glosario-imagenes.json` (symbol ↔ term).
- Explanations (`citas`): the paragraph that introduces the equation, the exercise's own solution (marked «con los
  valores del libro»), the paragraph of the section that cites the figure (nearest one) and its caption, the list, the
  glossary entries. Hints (`pistas`): the book's idea/formula first, then the set-up (the substitution with this
  variant's numbers, the reading with the book's values, the symbol of the part, the holes of the missing piece).
- Key ideas per section: boxes «importante/nota/precaución» (first paragraph ≤ 420 chars), the catalogue's formulas
  of the section (else its formula card), and glossary definitions; at most 6.

```json
{ "version": 1, "parte": "cap01",
  "items": [ { "id": "cap01-pred-sec-1.4", "tipo": "prediccion", "parte": "cap01", "seccion": "sec-1.4",
               "bloque": 52, "ref": "fig-1.4", "verRef": "la figura 1.4", "enunciado": "html",
               "citas": [ { "html": "book html", "ref": "fig-1.4", "donde": "Figura 1.4" } ],
               "pistas": [ { "titulo": "Lo que dice el libro", "html": "…", "ec": { "svg": "ec/….svg", "w": 0, "h": 0 } } ],
               "…": "per kind, see practica/tipos.ts" } ],
  "secciones": { "sec-1.4": { "items": ["cap01-num-ej-1.2", "…"], "ideas": [ { "k": "formula", "…": "…" } ] } } }
```
`indice.json`: `{version, partes, porParte, items (per kind), secciones (sections whose lesson shows each kind, «ideas»,
«alguno»), ejercicios (exercise label → item id), descartes (what could not be derived, by reason)}`.
A lesson shows at most 4 items, one per kind by priority (prediction, slider, breadboard, problem — an exercise one
first —, tap, order, pairs); Repaso's «Practicar» shows all of a part.

**Application.** `datos.ts` (`cargarPractica`, `practicaDeSeccion`, `pantallasLeccion`: each step followed by the
items whose `bloque` it holds, then the Repaso questions and the end; seeds of the variants in `localStorage
epa:practica-semillas`), `Practica.svelte` (shell in the 0.9 question style: statement, «Comprobar», «Ver una pista» /
«Otra pista», a second attempt with the first hint, then the explanation with the book fragments, «Ver …» and «Otro
con otros valores» / «Probar otra vez»; a prediction has one answer), one component per kind (`Numerico` — reading
with `lib/magnitudes.ts`, solution with the calculators' `PasoAPaso` —, `Prediccion` and `Deslizador` — runs in the
simulator's worker through `medir.ts`, one at a time, cached; graded with the app's own run; a figure is shown live
with `figuras-vivas/Escenario.svelte` and an `EstadoEsquema` holding the new operating point, and the changed part's
value label is rewritten with the NEW value (the slider's as it moves): `etiquetas.ts` measures the figure SVG's glyph
`<use>` elements in a hidden copy (getBBox), groups them into runs on one baseline and takes the run near the part
whose number of visible glyphs is that of the label's last line («$R_2$ = 4 Ω» → «=4Ω»; the free text the value was
read from when the part has no label), inside the schematic's crop; `EtiquetaNueva.svelte` draws a white patch and the
new text in the glyphs' colour and size (right-aligned when the label is left of the part); no match, no overlay —, `Toque`, `Ordenar`,
`Parejas` — symbols from `glosario/simbolo.ts` —, `Montar` — the breadboard's `Protoboard` state and `Mesa.svelte`,
checked with `verificarMontaje`), `IdeasClave.svelte`, `PracticaParte.svelte` (`#/repaso/practica/<parte>`),
`OtrosValores.svelte` (in `aprender/Comprobador.svelte`). Lesson URLs gain `/practica-<n>` (1-based among the
lesson's items); the stored `u` stays a step index (a practice screen stores the step it follows). Daily goal: a
practice item's first final answer counts as a lesson question (lessons) or a Repaso answer (Repaso); exercises do
not count, as before. Tests: `tests/preguntas10.spec.ts` (`playwright.preguntas10.config.ts`, port 4391);
screenshots in `tests/capturas/preguntas10/`.

## Learning events, feedback, XP, achievements, courses and reminder (0.11, `web/src/lib/aprendizaje/`)

**Event module** (`eventos.ts`, the contract for everything that reacts to learning; group B hooks in here).
Emitters call `emitir(evento)` with a plain object; `t` (ms) is filled in. Types (`EventoAprendizaje`):
- `respuesta` `{id, clase: practica|pregunta|ejercicio, origen: leccion|repaso|practica|ejercicio|prueba-nivel|
  inteligente|problema-dia (group B),
  correcta, intento (1-based, per round), pistas (on show), final (closes the question), parte?, seccion?, subtipo?}`
  — every checked attempt. Emitted by `practica/Practica.svelte` (each «Comprobar»; `origen` prop, `leccion` from
  the lessons), `pregunta/Pregunta.svelte` (each answer; a retry after «Probar otra vez» is `intento` 2; `origen`
  prop: `leccion`, `repaso` by default, `prueba-nivel` in the placement test) and `lib/aprendizaje.svelte.ts`
  (`registrarIntento`, `autoevaluar`: `clase` `ejercicio`, `intento` = the exercise's lifetime attempts).
- `leccion-completada` `{parte, seccion, primera}` — the lesson's summary reached by finishing it (not by opening
  `/fin`); `ejercicio-resuelto` `{id, parte?, intentos, fallos, pistas, conSolucion}` — the first time it becomes
  solved; `paso-montaje` `{circuito, paso, total}` and `circuito-montado` `{circuito}` — «Monta este circuito»
  (`protoboard/Guia.svelte`; `circuito` is the plan id: led, divisor, pulsador, transistor, 555 or libro);
  `simulacion` `{origen: simulador|editor|protoboard}` — a run without engine failure started from those pages;
  `objetivo-cumplido` `{dia, racha}` — `progreso-diario.svelte.ts` when today's goal flips to met;
  `prueba-nivel` `{curso, aciertos, total, recomendado}`; group B: `problema-dia` `{dia, id, correcta, intentos,
  racha}` — the first final answer of the day's problem. Consumers: XP and achievements, and mastery
  (`dominio.svelte.ts consumirDominio`, every `respuesta`).
Delivery: (1) `retroalimentacion.ts retroDe` synchronously inside `emitir` (still inside the tap: audio needs a
gesture); (2) `escuchar(fn)` synchronous UI listeners (returns the remover); (3) consumers
(`registrarConsumidor`), installed by `consumidores.ts → instalar()`, a lazy chunk loaded on the first event —
events emitted meanwhile are replayed in order. Until delivered, waiting events are also kept in localStorage — one key
per tab, `epa:eventos-pendientes:<tab id>`, written on every event while loading or failed (`cola-eventos.ts`: the
newest `MAX_COLA` = 1000 are kept, in memory and stored alike, with a console warning when older ones are dropped) —
and the next start adopts every such key (also an older tab's), replays the events once each (`unirListas`) and
removes the keys after delivering them (the consumers are idempotent: an event delivered twice counts once). If the
chunk fails to load (state `fallido`), the load is retried after 2, 4, 8… s (≤ 60 s), on the next event and when the
app becomes visible — Chromium remembers a failed module URL, so a retry imports the URL named in the error with
`?reintento=n`. A throwing listener never stops the others. Events are
facts; consumers must be idempotent (an answer can be reported again after a reload). Tests may set
`window.__epaEventos = []` to collect the last 100.

**Feedback** (`retroalimentacion.ts`): `sonar(tipo)`, `vibrar(tipo)`, `retro(tipo)` for `acierto | fallo | leccion |
nivel | logro | paso`. Sounds: 1–6 sine/triangle notes with exponential envelopes through one GainNode at 0.16;
the AudioContext is created on the first cue (`prepararSonido()` primes it at the start of a tap whose cue comes
after an await, e.g. a prediction that simulates) and suspended 1.2 s after the last cue (8 s after priming).
Nothing plays when the page is hidden. Vibration: `tauri-plugin-haptics` on Android (impact light, selection,
notification error/success), `navigator.vibrate(VIBRACIONES[tipo])` elsewhere. `prefs.sonido` / `prefs.vibracion`
(device-only, `undefined` = on), switched in «Aa» (`progreso/AjustesRetro.svelte`).

**XP and levels** (`niveles.ts`, pure). Ledger ids and amounts: `pr:<item>` / `pq:<question>` right answer, 10 at
the first attempt without hints, else 5 (once per id; `prueba-nivel` answers and exercises' `respuesta` give
none); `l:<parte>/<label>` lesson 20; `e:<label>` exercise 15, 8 after a failed check or with hints, 0 after
opening the solution; `c:<circuit>` guided circuit 25; `d:<day>` daily goal 10 + 2 × min(streak − 1, 10);
`s:simulacion` 0 (marks the first simulation). Level n starts at 25(n−1)(n+2) XP (0, 100, 250, 450, 700…; each
level 50 XP longer); 20 names (`NOMBRES_NIVEL`, «Chispa» … «Laboratorio completo»), the last kept past level 20.

**Progress module** (`progreso.svelte.ts`). Almacen key `progreso-xp` `{version: 1, xp: {id: {x, t}}, logros:
{id: ms}}`, read field by field (any object: the 1.0 migrations branch on `version`). `consumirEvento` →
`premioDe(evento)` → `otorgar` (new id only: totals, «+N XP» toast, level-up toast) → `revisarLogros(false)`.
`reconciliar()` (on load and after `epa:sincronizado`) adds, silently and with the same ids and amounts, what older
data already proves: lessons with `c`, solved exercises, days with `cumplido` (streak computed from the stored
days) — so a 0.10 install is credited once and its stores are never written. Ids of events still waiting for
the module are reserved so the reconciliation does not take them silently. Reactive `progresoXp {listo, total,
nivel, hoy, logros, version, estadisticas}`; `xpDesde(t)` (a lesson's XP), `historialXp(n)`, `calcularEstadisticas()`.
Synchronised as stores `progreso-xp` (LWW per award; equal ids on two devices are one item, so the sum never
double-counts) and `progreso-logros`.

**Achievements** (`logros.ts`, pure): 30 `Logro {id, nombre, como, icono, familia, progreso(s) → [n, de]}` over
`Estadisticas` (lessons, right answers, without help, exercises, guided circuits, simulations, longest streak,
days with the goal, sections read, chapters with every practice item and Repaso question right — totals from
`practica/indice.json porParte` + `repaso/indice.json` —, chapters with every lesson, courses started and
finished, placement tests, a lesson before 8:00 / between 23:00 and 4:00, level; group B: days with the problem of
the day solved and their longest run, from the ledger's `pd:` ids). Unlocked once (time stored),
announced only when unlocked by a live event. Badges: `progreso/Medalla.svelte` (inline SVG glyphs, colour by
family; grey, dashed ring and padlock when locked).

**Several browser tabs** (`lib/pestanas.ts`): `progreso-xp`, `dominio`, `problema-dia` and `cursos` keep their data in
memory and write the whole object. Each merges another tab's writes per item with a three-way merge whose base is
what the tab last read or wrote (`fusionarPestanas`): one side changed → that side; both → the store's rule (XP and
achievements: the earliest; mastery: `fusionarRegistros`; problem of the day: `preferirDia`; passed lessons: the
earliest; placement tests: the latest); deleted on one side and unchanged on the other → deleted; new → kept.
Read-merge-write (`EnlacePestanas`): before every write the tab reads the key synchronously and, if its text is not
the one it last read or wrote, merges it first — so nothing depends on receiving every `storage` event (a tab still
loading, a page restored from the back-forward cache); the `storage` event and `pageshow` (persisted) only refresh
what is on screen, writing back when the other tab lacks something. Activated right after the key is read at load.
Not in Tauri (one window, plugin-store). Writes are awaited by `aplicar*` (a storage failure reaches the engine).

**Courses** (`cursos.ts`, pure): `CURSOS` — the owner's table with part ids `capNN` (the file numbering: from cap15
on the printed number is one less), `leccionesDeCurso` (the h2 sections of its chapters, in order),
`verificarCursos(indice)` (`sinCurso`, `inexistentes`, `repetidos`: cap49 and cap50 are in two courses each),
`preguntasPrueba` / `repartoPrueba` (6–10 questions, one or two per chapter, extras to the first chapters).
1.1: the expansions' new chapters are courses' parts too — `cap-new-automatas` in «Digital y programable» after cap29,
`cap-new-maquinas` in «Potencia y energía» after cap33 —; progress is per lesson `parte/label`, so nothing stored
changes. `GrupoCamino.nuevo` / `NodoVista.nuevo` (and the list view) show `InsigniaNuevo` for a part or a section
with `ampliacion`.
`cursos-estado.svelte.ts`: almacen key `cursos` `{version: 1, superadas: {"parte/label": ms}, pruebas: {curso:
{t, aciertos, total, recomendado, marcadas}}}`, synchronised as `cursos-superadas` (deletions dated with
`anotarBorrado`) and `cursos-pruebas`. A passed lesson is not a completed one (no XP, no daily goal).
Pages (`componentes/cursos/`): `PaginaCursos.svelte` (`#/cursos` the ten courses; `#/cursos/<id>` chapters and
lessons with `data-estado` hecha | superada | en-curso | pendiente and «Continuar» → `avance.svelte.ts`: the first
lesson neither completed nor passed, at its last step), `PruebaNivel.svelte` (`#/cursos/<id>/prueba`: the course's
Repaso questions, chapters in course order and choice before numeric inside a chapter, «No lo sé», result per
chapter, recommendation = first chapter with a miss, else the last one; «Marcar como superadas» for the pending
lessons of the chapters before it, «Deshacer», «Repetir la prueba»).

**Pages and celebrations** (`componentes/progreso/`): `PaginaProgreso.svelte` (`#/progreso`), `CelebracionLeccion.svelte`
(the lesson's summary: XP of the visit counting up, streak, accuracy at the first attempt, level bar, ~1 s CSS
confetti only when the lesson was finished in this visit), `Destello.svelte` (pop and 8 sparks around a right
answer's seal, 0.6 s, then removed), `ContadorXp.svelte` (requestAnimationFrame only while counting),
`Celebraciones.svelte` (fixed, `pointer-events: none` toasts; mounted by `ArranqueProgreso.svelte` in App.svelte
once `avisos.svelte.ts` queues something), `inicio/NivelInicio.svelte` (start page: level, XP, the course of the
chapter being studied). Transforms and opacity only; nothing animates while idle; `prefers-reduced-motion` keeps
only fades. No rail entries (the rail must keep fitting 800 px of height, `navegacion.spec.ts`): the start page
links both (level card, «Cursos» and «Progreso y logros» chips), `Barra.svelte` names the two views; icons `cursos`
(route) and `progreso` (trophy).

**Daily reminder** (`recordatorio.ts`, Android only: `enTauri()` and an Android user agent). `prefs.recordatorio
{activo, hora "HH:MM"}` (device-only; default off at 20:00). On: `plugin:notification|is_permission_granted` →
`request_permission` (Android 13+ dialog) → `cancel([20110])` → `plugin:notification|notify {options: {id: 20110,
title, body «Unos minutos con la electrónica: le espera el problema del día.», schedule: Schedule.interval({hour,
minute}, allowWhileIdle true), autoCancel, extra: {ruta: RUTA_RECORDATORIO}}}`; a tap (`onAction`) opens
`RUTA_RECORDATORIO` = `#/problema` (group B: the problem of the day the text announces; a cold start from the
notification opens the start page, whose card leads to it). Off: `cancel`.
At start-up (idle) `comprobarRecordatorio` re-schedules it if it is on but not pending.
0.12: the options also carry `icon: ICONO_RECORDATORIO` = `"ic_stat_epa"`, a 24 dp white vector drawable (the app's
resistor mark) in `src-tauri/recursos-android/drawable/ic_stat_epa.xml`, which `web/scripts/android-preparar.mjs`
copies into `gen/android/app/src/main/res` (and fails if it cannot); the plugin resolves it by name (else Android's
`ic_dialog_info`). Not as `plugins.notification.icon` in `tauri.conf.json`: the plugin's Rust config type is `()`, so an
object there fails its setup. Device-only key `recordatorio-icono` = 1 once the reminder was scheduled with the icon; a
pending reminder without it (scheduled by 0.11) is scheduled again once. Native side: `src-tauri`
`[target.'cfg(any(target_os = "android", target_os = "ios"))'.dependencies]` tauri-plugin-haptics 2 and
tauri-plugin-notification 2 (registered in `lib.rs` under the same cfg), capability `capabilities/movil.json`
(platforms android, iOS: `haptics:allow-*`, `notification:default`). The plugins' Android libraries bring VIBRATE,
POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED and WAKE_LOCK (manifest merge), so `gen/android` needs no change.

Tests: `tests/grupoA11.spec.ts` (`playwright.grupoA.config.ts`, port 4451; screenshots in `tests/capturas/grupoA11/`).

## Mastery, smart practice, problem of the day and explorable figures (0.11 group B, `web/src/lib/aprendizaje/`)

**Concepts.** A concept is an h2 section, key `"<parte>/<label>"`: the unit of the lessons, of the practice items
(`seccion`), of the Repaso questions (`ref` = the section, an h3 inside it «sec-5.3.2», a problem «prob-…» whose
section ejercicios.json gives, or an appendix section «apG-4») and of the exercises (`seccion` in ejercicios.json).
`catalogo.ts` resolves them (`conceptoDeRef`, `conceptoDePregunta`, `conceptoDeEjercicio`, `conceptoDePractica`), lists
a part's answerable items (`itemsDeParte`: practice items, Repaso questions, self-checked exercises with `modo:
'auto'`, and 1.1 lesson cards `tipo: 'leccion11'`), the flashcards due now with the concept of their first «ver» (`tarjetasDebidas`) and the problem
candidates. Glossary terms were rejected as concepts: nothing but «Una las parejas» names them.
Generated by `web/scripts/conceptos11.mjs` (after practica10.mjs in `generar.py`, and again by lecciones11.mjs when the
1.1 lesson index changes; reads only JSON — since the 1.1 motor fixes also `lecciones11/indice.json` `preguntas`):
`libro/conceptos.json` `{version: 1, total, partes: {<parte>: [labels with something to answer, book order]}}` (633 in 1.0,
more with the 1.1 lessons' questions — seven sections of chapters 0–2 had nothing else —, growing with each lesson;
the denominator of the chapter and course bars, `cargarPracticables`/`conceptosPracticables`) and
`libro/explorables.json` `{version: 1, esquemas: {"datos/1.4.json": [0], …}}` (simulable DC schematics with an R, C or
L of known value: 25 drawings in 20 figures).

**Mastery** (`dominio.ts`, pure; `dominio.svelte.ts`, the consumer registered in `consumidores.ts`). Almacen key
`dominio` `{version: 1, items: {<item id>: {s: concept, c: 'p'|'q'|'e', r: [[t, points 0–100, 1?], …]}}, migrado: ms}`.
Every `respuesta` event becomes a round: the first answer to an item after ≥ VENTANA (10 min) without one; points
100 (first attempt, no hints; exercises: no hints, as their `intento` is lifetime), 60 (with help), 0 (wrong). A wrong
non-final attempt is a provisional round (`1` in the third slot) that the round's final answer settles (≤ 60); a
retry inside the window or an event with the same `t` is ignored (idempotent: replays, «Probar otra vez», reloads);
an older event opens its own round only if no round is within the window; ≤ 6 rounds per item. Days (spaced
practice, stability) are review days: `numeroDia` uses `repaso/srs.ts inicioDia`, the 04:00 cut of `claveDia` also on
DST days. Concept formula: item
score q = recency-weighted mean (½ per older round), item weight 1 + ½·min(2, days − 1), accuracy A = (Σwq + 0,45) /
(Σw + 1,5); stability S = 3 d · 2^(m−1) (m = days whose rounds averaged ≥ 60; 1,5 d if none; ≤ 192 d); retention
R = 0,5^(days since last / S); mastery = A·(0,5 + 0,5R). Levels nuevo / intentado < 0,4 ≤ familiarizado < 0,6 ≤
competente < 0,8 ≤ dominado; `repasar` = A ≥ 0,6 and R < 0,7. `agregar(claves)` (chapter, course): mean with untouched
concepts as 0, counts per level. Events are processed one at a time (`cola`; a question's section may need its quiz
file). Migration once per device (`migrado`): XP ledger `pr:`/`pq:` (10 → 100, 5 → 60), `repaso-fallos` (0),
`ejercicios` (solved: 100, 60 with failures or hints, 30 after the solution; failed: 0), each at its stored time;
those stores are only read. Queries (reactive through `estadoDominio.version`): `dominioDe`, `conceptosConDominio`,
`dominioDeClaves`, `ultimasRespuestas`, `instantanea`, `esperarDominio`. Synchronised as store `dominio` (time = last
round): the engine merges two devices' versions of an item in the file itself (`unir` = `fusionarRegistros`: union by
time, settled beats provisional, symmetric — the concept and kind are chosen the same way on both devices —), so the
union is durable as soon as one run writes it; `aplicarDominio` stores the union with what it holds (rounds answered
meanwhile stay) and awaits the write.
UI (`componentes/dominio/`): `MedidorDominio` (four segments, `--dominio-0…4` in app.css, level always in text or
`title`), `BarraDominio` (a chapter's or course's sections per level), `MarcaDominio` (next to every h2 in the reader,
only with evidence, → `#/practicar/<parte>/<label>`), the index's `.pin.dominio`, `PaginaCursos` (course, chapter,
lesson), `PaginaProgreso` (summary card) and `PaginaDominio` (`#/progreso/dominio`: counts, weakest with «Practicar
esto», decaying with «Repasar», per course with its chapters).

**Smart practice** (`seleccion.ts`, pure; `componentes/practicar/`; `#/practicar[/<parte>[/<label>]]`, view
`practicar`). `planificar`: buckets débil (evidence, mastery < 0,6), repasar (`repasar`), nuevo
(`nuevosDisponibles`: the current course's chapters up to the furthest touched — lesson completed/passed, read, or
evidence —, the next one only when all before are touched; studied-but-unanswered sections first, then book order),
dominado; quotas 4/3/2/1 of 10, a bucket short of concepts takes its quota as more items of its own concepts (≤ 3/2/2/1),
then more concepts in priority order. A section focus gives that section's items (topped up to 5 with the chapter's
weakest), a chapter focus the chapter's own buckets (≤ 4 items per concept). `completar`: round robin over the plan,
never an item answered < 20 h ago while the concept has another and never < 1 h; weak concepts retest failed items
first, decaying/mastered ones the right answers answered longest ago, new ones unanswered items; kinds alternate;
at most 2 flashcards, only due ones and never for new concepts; seeded (mulberry32, items sorted by id first).
`ordenar`: a known item first as warm-up, then the concept with most items left that differs from the previous one.
`sesion.ts` (`prepararSesion(alcance, semilla)`, `window.__epaSemillaPractica` fixes the seed) loads only the
course's and the plan's parts; `SesionPractica.svelte` (intro by bucket, one item per screen with `Practica`/`Pregunta`
`origen="inteligente"`, `TarjetaEjercicio` (its checks heard with `escuchar`), `TarjetaSesion` (the SM-2 `calificar` of
Repaso: the card is simply reviewed); Repaso answers also go through `registrarRespuesta` (daily goal, «Repasar
fallos»), practice items count as a question; end: first-attempt hits, `xpDesde`, each concept's mastery before → after).
`contexto.ts`: `cursoActual()` (the course of the start page's chapter, else Fundamentos), `estudiada`, `nivelEnCurso`.

**Problem of the day** (`problema-dia.svelte.ts`; `componentes/problema/PaginaProblema.svelte`, `#/problema[/ayer]`,
view `problema`; `inicio/ProblemaInicio.svelte`). `problemaDelDia(dia, curso, nivel, candidatos, recientes)` (pure):
pools in order — «Calcule» items (`numerico`) of the course's chapters ≤ level, self-checked numeric exercises not
solved ≤ level, the same over the rest of the course, anything given —; the caller loads the whole course's
«Calcule» items and only its exercises (`catalogo.ts candidatosProblema(partes, resueltos, 'partes')`), and the whole
book's exercises only when the course has nothing. Chapter: the pool's chapters ranked from the frontier (the level's
chapter, then backwards; after it, nearest first; outside the course, book order), the k-th gets ½, ¼, ⅛… of the days
(`pesoCapitulo`; the last takes the rest), drawn with FNV(`dia|curso|nivel|capitulo`); the item inside it FNV(`dia|curso|
nivel`), skipping the last 30 days' ids (that chapter first, then the others in rank order); seed FNV(`dia|valores`).
Stored on first use of the day (almacen `problema-dia` `{version: 1, dias: {<day>: {id, k: practica|ejercicio, parte,
semilla, curso, t, r?: {bien, intentos, t}}}}`, synchronised as `problema-dia`, time = max(t, r.t)). Of two versions of a
day every device keeps the same (`seleccion.ts preferirDia`, a total order): answered beats unanswered, right beats
wrong, then the first answer; of two unanswered, the first chosen — applied by the engine in the file itself (`unir`),
so `aplicarProblemas` receives the preferred version (it still keeps ours if that one changed meanwhile). The day follows the 04:00 change: `reloj.hoy` (`seguirDia()`: a
timer at the boundary, ≤ 1 h, and a check on `visibilitychange`/`focus`); the page and the start page card move on to
the new day's problem. The page uses `Practica` with `semilla` (Numerico's `semillaFija`: the stored seed is not
advanced) and `repetir={false}`, `origen="problema-dia"`; the first final answer → `registrarResultado(today, bien,
intentos, the problem on screen)` (if the stored day has another, unanswered problem — replaced meanwhile, or the page
opened before 04:00 — the answered one becomes the day's) → event `problema-dia {dia, id, correcta, intentos, racha}` →
XP `pd:<day>` 15 (`XP.problemaDia`), achievements `problema-dia` and `problemas-7`. Answered: the solution with the
day's values (`Numerico final`); `/ayer`: the stored day or the one it would have been (`problemaDe`, not stored).

**Explorable figures in lessons** (`figuras-vivas/esquema/ExploraEsquema.svelte`). `Leccion.svelte` sets the context
`CONTEXTO_LECCION` `{parte, seccion, explorables}` (`figuras-vivas/contexto.ts`, loaded with the step's maps before the
first screen); `FiguraViva` keeps a 204 px room per listed schematic until the data arrive, then shows the row for
simulable, non-external schematics without a transient. Part and quantity: the section's `deslizador` item on that
drawing (`fuente.datos`/`esquema`), else a part other than the `prediccion`'s with its quantity, else a designated R and
a labelled node that is not a supply (else the part's own current). Value `Valor.svelte` over E12; `est.cambios` +
`resimular(est)` (the simulator worker) 250 ms after the last move, at once on release, only while on screen and the
page visible (`data-pendiente` until seen again; `window.__epaExplora.simulaciones` and `data-simulaciones` count
runs); reading of `est.op` vs the book's `simulacion.op`, ▲/▼ %, a sentence with both values, «Valores del libro»
(`restaurar`). Classes prefixed `ex-` (the reader has a global `.lectura`).

Routes for the QA harness: `progreso:dominio`, `practicar[:…]`, `problema[:ayer]`, `leccion-explora:…` (group
`aprendizaje`). Tests: `tests/grupoB11.spec.ts` (`playwright.grupoB.config.ts`, port 4461, build `/tmp/epa-dist-grupoB`;
screenshots in `tests/capturas/grupoB11/`). The fixes of the independent review of 0.11 (synchronisation of the problem
of the day and of mastery, the engine's record rule simulated for two devices in Node, guides and saved montages,
celebrations, day changes, events, tabs): `tests/revision11.spec.ts` (`playwright.revision.config.ts`, port 4471,
build `/tmp/epa-dist-revision`); the second review's engine scenarios and the randomized simulation of the engine
(three devices, an 0.10 one and a fresh install; offline edits and deletions, failing stores, rejected values, clock
skew, interrupted runs; no loss, no resurrection, convergence, commits stop): `tests/revision11-motor.spec.ts` (pure,
Node) with `tests/motor-simulado.ts` (the engine's steps with fusion.ts) and `tests/motor-azar.ts`.

## Modo docente: own courses and exams, PDF export (1.0, `web/src/lib/docente/`, `web/src/componentes/docente/`)

**Data** (`lib/docente/tipos.ts`; stores in `estado.svelte.ts`, same layer as the other personal data, read-merge-write
through `guardadoDeRegistro`):
- almacen `docente` `{version: 1, propios: {<id>: Propio}}`, synchronised as store `docente-propios`: `Propio = {id ("c…"
  course, "x…" exam), tipo: curso|examen, titulo, notas, creado, actualizado, borrado?, version: 1, curso?: {elementos:
  [{k: seccion, parte, label} | {k: ejercicio, label} | {k: pregunta, id}]}, examen?: {items: [{k: ejercicio|pregunta,
  ref, puntos}], minutos (0 = no limit), variantes, barajar, semilla (uint32), espacio: no|corto|largo, filtros?}}`.
- almacen `docente-resultados` `{version: 1, resultados: {<id>: Resultado}}`, store `docente-resultados`: `{id ("r…"),
  examen, titulo, semilla (of the variant), variante, inicio, t, actualizado, borrado?, puntos, maximo, agotado?, items:
  [{k, ref, puntos, maximo, valores (the exercise panel's keys r1…, p1…, texto; `r` for a test question), estado: bien|
  parcial|mal|blanco|pendiente, variante?, autoeval?, orden?, opciones?}]}` — self-contained: a result is regraded as it
  was shown even if the exam changes later. The self-assessment rewrites it (`actualizarResultado`).
- Both: last write wins per item by `tiempoDocente = max(actualizado, borrado)`; a deletion is a tombstone (body
  removed) dated `max(now, actualizado + 1)`. Schemas `docente: 1`, `docente-resultados: 1` (lib/esquemas.ts); the
  registrations are in `lib/sincronizacion/registro.svelte.ts`. Device-only draft of an exam being taken:
  localStorage `epa:docente-en-curso:<exam id>` `{variante, inicio, respuestas: {n: valores}, actualizado, def?, huella?}`
  (`componentes/docente/borrador.ts`; removed only after the result is stored ON THE DEVICE — `estado.resultadoGuardado`
  reads the storage, never memory). Review 10c: `def` is the graded definition the attempt started with and `huella` =
  `examen.huellaExamen(def)` (FNV of items with points, minutes, variants, shuffling, seed — not title, notes, room or
  filters): the attempt is assembled from `def`, so an edit, a «Guardar» or a synchronised change never drops it; a real
  change shows «sigue con las preguntas con las que lo empezó». A draft without `def` (written before 10c) is matched by
  `actualizado`; if it differs the page waits for «Empezar de nuevo» (nothing removed). `limpiarHuerfanos` removes,
  through the single-tab gate, the drafts of exams whose tombstone is known (when the list opens, and on «Borrar»).
  Writes are atomic (`cambiarAtomico`): a failed write puts memory back and rejects — `crearCurso`, `crearExamen`,
  `actualizarPropio` (returns `guardado | igual | borrado`: «igual» writes nothing and keeps `actualizado`; «borrado»
  lets the editor offer «Guardar como nuevo»), `guardarResultado`, `actualizarResultado`; the editor and the
  self-assessment show the error. `lib/salida.ts` (`registrarGuardaSalida`, `puedeSalir`): the editor's guard for the
  failure notice's «Ver el informe» / «Recargar la página»; the editor also intercepts clicks on in-app links (capture
  phase) while it has changes. Taking: after a failed automatic hand-in the clock keeps running, the items are a
  disabled fieldset once the time is over and the hand-in is retried every 15 s, still `agotado`; the variant is in the
  route `…/hacer/<n>` (A without it), so it holds if the draft cannot be written.

**Pure modules** (also run in Node by the tests):
- `banco.ts`: `bancoDe({indice, ejercicios, preguntas, variables})` → every exercise and problem (ejercicios.json) and
  Repaso question, in book order, with `concepto` (`<parte>/<h2 label>`, `conceptoEn` = catalogo.ts's rule), `tipo`
  ejercicio|problema|pregunta, `auto` (checked by the app entirely: `modo: auto` and no `otras`; final QA 1.0 — 175 of
  the 486, the «solo lo que la aplicación corrige sola» filter), `mixto` (`modo: auto` with `otras`: 125, shown «En parte
  autoevaluado»), `variable` (practica/indice.json `ejercicios`); `filtrar`; `elegirPorFiltros(banco,
  filtros, semilla, excluir)` — each part's candidates shuffled with FNV(`semilla|parte`), round robin over the parts,
  returned in book order with `puntosPorDefecto` (1 question, 2 exercise, 3 problem). The book has no difficulty.
- `examen.ts`: `montarExamen(def, ctx, variante)` with `semillaVariante = FNV("semilla|variante|n")`: item order
  `barajarCon(items, FNV(seed|orden))` if `barajar`; per item seed FNV(`seed|k|ref`): a test question's option order,
  each choice question's option order (not Yes/No), and with `variantes` the variant index into
  `practica/variantes.ts variantes(item)` (mulberry32). `calificarItem(m, ctx, valores, autoeval?)`: parts = each
  numeric field (`magnitudes.comprobar`), each structured question (`comprobarPregunta` on `preguntaVista`, the options
  as shown), the test question (`numero.ts leerNumero/numeroCorrecto`, moved out of repaso/datos.ts so that Node can
  load it), the open part (`modo: comparar` or `otras`; empty text and no self-assessment = blank). bien 1, cerca ½,
  else 0; points = item points × mean, to hundredths; estado `pendiente` while an open part with text awaits the
  self-assessment. A variant has one field: the formula's unknown with the practice item's tolerance, or the nearest
  E12 value when the statement asks for a standard value (`esperadoVariante` = `variantes.ts pedidoDe`, graded by
  `comprobarPedido`; its `nombre` is what the practice field asks, with the variant's values).
- `pdf/svg.ts`: its own small XML reader and an SVG → PDF operator converter (path d with every command incl. arcs,
  g/use/symbol, transforms, clipPath (flattened into the clip's coordinates), rect/line/poly/circle/ellipse, fill/stroke,
  dashes, caps, joins, opacities as ExtGState, data-URI PNG/JPEG images). Unsupported (patterns, masks, filters,
  gradients, text) are listed in `noSoportado`: the app then rasterises that picture through a canvas at 3× (19 figures
  of the book; no equation, and none in an exercise).
- `pdf/fuentes.ts`: fonts per character: Source Serif 4 / Source Sans 3 / Source Code Pro (`@fontsource`, subsets
  latin → latin-ext → greek, 400/700 normal/italic) and DejaVu Sans (`@fontsource/dejavu-sans` latin, OFL) last for the
  symbols they lack (≈ √ → ≤ ∞ ₂ ⁻ ☐ …). The **.woff** files, not .woff2: @pdf-lib/fontkit 1.1.1 crashes subsetting a
  font read from woff2 (an uncatchable RangeError in TTFSubset). A character no font has is drawn as «?» and listed
  in `faltan` (the tests require none). U+202F and the other fixed spaces are drawn as gaps.
- `pdf/maquetar.ts`: document model (`parrafo` with runs of the book's inline HTML — strong em sub sup code br a span
  and inline formulas `img.m` with their em height and vertical-align —, `ecuacion`, `figura`, `tabla` (min/max-content
  column widths), `espacio` (ruled answer lines), `campos` (Nombre / Fecha / Calificación lines), `codigo`, `regla`,
  `salto`) → greedy line breaking (no break inside a word or before a glued formula/subscript), widow/orphan control,
  headings kept with what follows, A4 pages (62/64 pt margins), running header from page 2 and «Página n de N». Written
  with pdf-lib: one content stream per page with its own operators (text as `Tj` of `PDFFont.encodeText` in embedded
  subsets with ToUnicode), fixed metadata dates (`Documento.fecha`: the exam's `actualizado`), seeded font names, no
  object streams — so the bytes depend only on the model. `generarPdf` returns `{bytes, paginas, faltan, graficos:
  {vector, raster, aproximados, fotos, fallidos}, texto}`.
- `pdf/documento.ts`: `documentoExamen`, `documentoSoluciones`, `documentoCurso` (models from `LibroPdf`: the exam
  context plus statement/solution blocks, part labels and sections) and `deBloques` (book blocks p h3 h4 lista tabla ec
  figura codigo centrado caja deduccion tarjeta).

**App side**: `fuentes.ts` loads what the pure modules need (`cargarBanco`: ejercicios.json and every quiz;
`prepararItems`: the parts, quizzes and practice items of some items) and exposes `libro` (synchronous) and `recursos`
(fetch of `libro/…` and of the bundled font files, `import.meta.glob(…?url)`, and the canvas rasteriser).
`exportar.ts generar(propio, {tipo, variante, fecha, espacio})` (lazy `pdf-lib` + fontkit chunks) and `guardarPdf` →
`fichero.ts guardarBinario(nombre, bytes, 'application/pdf', ['Documento PDF', ['pdf']])`: Tauri — the command
`guardar_fichero_elegido {nombre, texto: base64, base64: true, filtro}` (desktop: that filter; Android: the
create-document picker's MIME type from the extension, written in «wt» mode); browser — a Blob download; Android without
the command — an error, never a pretended download. `window.__epaUltimoPdf` = the last report (tests).
Pages (`componentes/docente/`, view `docente`, `#/docente/…`): `PaginaDocente` (list and router), `EditorPropio` +
`Selector`, `CursoPropio` (`#/docente/curso/<id>[/<n>]`: states from `estadoLeccion`, `estadoDe`, `ultimasRespuestas`;
questions answered with `pregunta/Pregunta.svelte` and `registrarRespuesta`), `ExamenPropio`, `HacerExamen`
(`…/examen/<id>/hacer`), `ItemExamen` (answer fields; `aprender/PreguntaEjercicio.svelte` without verdicts), `ResultadoExamen`
(`#/docente/resultado/<id>`), `ExportarPdf`; field style `docente.css` (`.dc-entrada`). Navigation entry `docente` (icon
clipboard-list) last in `HERRAMIENTAS`. Never `window.confirm`: `lib/confirmar.ts`.

PDF text (`maquetar.texto`): line breaks of the reader's own text (notes) become `br`, tabs spaces, other control
characters are dropped (review 10c, r10c·1); a text without them is one run, as before (same bytes). `ExportarPdf` shows
the characters no font has (`data-pdf-sin-glifo`). Rust `fichero::filtro_permitido`: `filtro` must be exactly `["json"]`
or `["pdf"]` (case and a leading dot ignored), with the dialog's name fixed in Rust; anything else is refused before the
dialog (test `pruebas::solo_json_y_pdf`). Review 10f: the proposed name gets the filter's extension
(`fichero::nombre_con_extension`: kept if present in any case, else a short last extension replaced or `.ext` added;
test `pruebas::el_nombre_lleva_la_extension_del_filtro`).

Review 11a. **Answers of 1.0 to the 181 exercises 1.1 converted** (razonar11): `ejercicios.json` marks them
`"comparar10": true` (`ejercicios.py`, from the frozen list `contenido/autoevaluados10.json` of 1.0's `comparar` labels).
`calificarItem` grades such an item as 1.0 did — one open part, self-assessed (`abiertaHeredada`: `comparar10`, a
written `texto` and no answer in any `r…`/`p…` of 1.1) — so a stored result shows «Lo que escribió» and «Bien / A
medias / Mal» again, a stored grade reproduces, and a 1.0 draft handed in after the update keeps its text graded
(`ItemExamen` shows the text field for it). A 1.1 answer to the questions is graded by them. **A stored grade is never
re-graded by later content** (errata changed prob-1.B r3 and prob-3.B r5): `ResultadoExamen` shows the stored
`puntos`/`estado` and, when the current key grades the stored answers differently (`claveCambiada`), a note
(`data-clave-cambiada`: «se mantiene la nota de entonces (con la solución actual serían X puntos)»); a later change of
the item itself — a self-assessment, a design simulated from the result page — goes through `recalificarGuardado`: with
the key unchanged, the usual grading; with a changed key, the stored points move only by what that change moves
(the parts' mean before/after, unrounded), the other parts keep their grade. `actualizarResultado` dates (`autoevalT`)
an item whose `valores` changed too. Tests: `tests/revision11a-unidad.spec.ts` A1–A5, `revision11a-navegador.spec.ts`.

Review 10f. `montarExamen` orders and numbers ALL the definition's items and only then leaves out what the context lacks,
without renumbering (`ExamenMontado.faltan`), so the draft's answers, stored by item number, never move to another
question; `HacerExamen.empezarCon` prepares the ATTEMPT's own items (`b.def.items`) and refuses to open an attempt with
`faltan`. Leaving with unsaved changes: `lib/salida.ts registrarGuardaSalida(preguntar, hay)`, `hayCambiosSinGuardar()`,
`puedeSalir()` (one question at a time); `ruta.svelte.ts` asks it on every `hashchange` (`retenerSalida`: the address
on screen is pushed back — a new entry — and only a «yes» replaces it with the destination and reads it) and in
`navegarDesdeCapa`; the paused tab's «Usar aquí» (`pestana-activa.ts`, the screen hidden while the app's dialog asks)
and `instalador.reiniciarParaTerminar` ask it too. Drafts of exams deleted elsewhere: `limpiarHuerfanos` removes only
those without `def`; `intentosDeBorrados` lists the others, which `PaginaDocente` offers («De exámenes borrados», with
the results of deleted exams) and `HacerExamen` takes (title from the tombstone, «Este examen se ha borrado…»).
`cambiar` says when the draft cannot be written (`data-fallo-borrador`). Tests: `tests/docente10-revision10f.spec.ts`.

Review 10h (the stores are new in 1.0 and unreleased: their v1 shape changed without a migration, ESQUEMAS stay 1).
- Draft `{…, titulo?, abierto?, transcurrido?}`: written only once the attempt's questions are on screen (`HacerExamen.abrir`;
  ExamenPropio writes nothing at «Empezar», the variant goes in the route); a draft without `abierto` and without answers
  (an older build wrote it before loading) starts its clock when it opens; only an opened attempt is handed in by itself.
  Time: `transcurrido` = attempt time counted by `performance.now()` in the page (saved every 15 s and with each answer);
  at opening, `max(transcurrido, now − inicio)` (a wall clock behind `inicio` gives nothing back); the limit is checked
  against it — a system clock jump during the exam does not end it. Load failures (`fuentes.ErrorCarga`, fetch errors)
  show «No se han podido cargar…» with «Reintentar» (`data-fallo-carga`), nothing written; `faltan` after a complete load
  (items no longer in the book) offers «Ver y entregar lo que hay» (`data-no-disponibles`, `data-parcial`): the result
  gets `sinCorregir: [{k, ref, maximo, valores}]` (not in `maximo`). `intentosDeBorrados(existe)` lists every draft with
  `def` whose exam does not exist (deleted or pruned); title from the draft. While answers are unwritten the page holds
  the reader (`registrarGuardaSalida`, «¿Salir del examen?»; a paused tab's skipped writes are not a failure).
- `prepararItems` throws `ErrorCarga` without practica/indice.json; `ContextoExamen.variable(label)`; `montarExamen`
  counts in `faltan` an exercise with changing values whose practice item is not loaded (exam with variants);
  `exportar.generar` refuses an exam with `faltan`.
- Result `{…, minutos (the attempt's limit, used to cap the minutes shown), sinCorregir?}`, items `{…, vv?: {valores,
  resultado, enunciado, esperado}, autoevalT?}`: `vv` is the variant as seen (grading and display use it, never the
  practice content again); `autoevalT` dates each question's self-assessment. `union.ts unirResultados`: per question the
  version with the newest `autoevalT` (ties: canonical JSON), the result's own fields of the later version (ties: its
  fields' canonical JSON), points summed; a tombstone absorbs any live version (an attempt's id is never stored again
  once deleted) — commutative, associative, idempotent (3000 random triples); registered as `unir` of
  `docente-resultados` (registro.svelte.ts) and between tabs (the Guardado). `borrarPropio`/`borrarResultado` are atomic
  and reject (the pages say so).
- Leaving: `salida.puedeSalir` remembers a «yes» (`permiso`, spent by the next route read, ≤ 3 s), so «Ver el informe»
  asks once; `retenerSalida` answers a «yes» with `history.back()` over the entry it pushed (no duplicate entries); the
  guards' dialogs use `confirmar({…, seguirEnRuta: true})` (lib/confirmar.ts: not closed by route changes), and while one
  is open further route changes only put the address back (`preguntandoSalida`). Tests: `tests/docente10-revision10h.spec.ts`.

Tests: `tests/docente10-unidad.spec.ts`, `tests/docente10-navegador.spec.ts`, `tests/docente10-revision10c.spec.ts`
(`playwright.docente10.config.ts`, port 4621); helpers `tests/docente10/libro-node.ts` (the book's data and resources from the files) and `leer-pdf.ts`
(pdfjs-dist 4.10.38, dev dependency: pages, text, fonts embedded, fill operators).

## Brilliant 1.0: challenges, «por qué no», course paths and spaced review (`practica/`, `pregunta/`, `cursos/`, `lib/aprendizaje/camino.ts`)

No new stored data (agreed with the data agent, ACUERDOS_10 10:40): challenges are practice items (events, XP, mastery as
any other), a jump marks `cursos.superadas` with `marcarSuperadas` (the placement test's mark), reviews are computed from
`dominio`. The «Camino | Lista» switch is session-only (`componentes/cursos/vista.svelte.ts`).

**Generators** (Node 22; shared helpers in `web/scripts/libro-node.mjs` — parts, sections, labels, quotes, quantities and
the app's WebAssembly ngspice, copied from practica10.mjs so that script is untouched). `generar.py` runs practica10 →
retos10 → averias10 (below) → porque10 → teoria10 → conceptos11.
**Idempotent chain** (QA 1.0): each step rewrites only its own types and `ordenarPractica(d)` (libro-node) sorts a part
file's items and every lesson list stably by owner — practica10's types, then `reto`/`construye` (retos10's generation
order), then `averia` (`grupoTipo`, `TIPOS_POSTERIORES`); `recontarIndice(dir, ind, tipos)` recomputes the index counts
(`items[t]`, `secciones[t]` in place, `alguno`, `porParte` in `partes` order). practica10 keeps the later steps' items
of an existing part file with their lesson places (`heredadosDe`) and writes `indice.json` compact with the same keys
the chain writes, so rerunning ANY single step leaves the output byte-identical (retos10 alone after averias10 used to
move the faults before the challenges in 8 parts). `EPA_LIBRO=<dir>` relocates the book folder for practica10,
libro-node (and so retos10/averias10/porque10/teoria10) and conceptos11; curated reviews are read from `contenidoDir`
(the repo's contenido/). Test: `tests/brilliant10-cadena.spec.ts` (Node, a copy with links; the chain, then each step
alone, then the chain again, byte comparison; and the tree's own files in canonical order).
**What a challenge or a fault case shows** (QA 1.0, `src/componentes/practica/encuadre.ts`, pure; `encuadreDe(fig, esq)`
in libro-node caches the figure's objects): `objetosDeSvg` reads the figure SVG with the PDF module's XML reader
(`lib/docente/pdf/svg.ts`): glyph `<use>`s → runs (same colour, close, on the run's baseline — counted in `n` — or a
sub/superscript within 0,7 of its height — absorbed, not counted) and drawn paths' boxes (white fills skipped).
`encuadre(vista, esq, objetos) → {recorte, ocultar}`: C = schematic box; the parts' own labels (`rotulos`: per label line
— or the value when the part has none — the nearest run with as many baseline glyphs, in the part's colour or a neutral
one, touching C ± margin) join it as K; the readings the data gives as labels (`lecturas`: a part label with a V/A
quantity that is not its own value) are matched the same way; crop = C ± max(22, 14 %) widened to K; then any foreign
object (not touching C, not a label) that crosses the crop, and any annotation text touching it, pushes the edge on its
side back to just before it (the side removing least area, never into K). `ocultar` = texts the crop still cuts, the
`lecturas`, and annotation texts: any colour but the neutrals `#1a3a5c`/`#000` (grey `#5d6d7e` is the book's notes)
unless a part label or inside a part's box (a meter's «V»). retos10 and averias10 store `fuente.recorte` from it (and
`fuente.ocultar` when not empty); `recorteDe` still decides the naming scope. The app paints `ocultar` with
`fill: var(--placa)` (`practica/Tapas.svelte`: an overlay layer under the new-value labels in `Reto.svelte`, rects inside
the figure SVG under the probe marks in `Averia.svelte`). Test: `tests/brilliant10-encuadre.spec.ts` (every reto/avería:
no text crossing the crop unhidden, no annotation colour visible; fig. 0.2's explanation column outside, fig. 1.3's
readings hidden).
- `retos10.mjs` (≈10 s, ≈1550 runs) removes the previous run's `reto`/`construye` items and adds new ones to
  `practica/<parte>.json` (part items, the section's lesson list) and the counts of `practica/indice.json` (`items`,
  `secciones` incl. `alguno`, `porParte`). Figure challenges: the drawings of `explorables.json`; knobs = R/POT (E96
  ×0,1…×10 plus the book value, `retos.ts posicionesMando`) and V/BAT/I sources (steps of `pasoRedondo(|v|/100)` from ×¼ to
  ×2,5) named uniquely in the drawing (the figure is cropped to it; resistors labelled with a load «2,8 V / 50 mA» and
  `cargaDe` loads excluded); observed = labelled nodes not held by a supply, LED/diode currents, R currents/voltages. A pair
  is kept when |reading| is monotonic over the knob's range (5 samples; gives `efecto`), the start (book ×2, ½, 3, ⅓, first
  ≥ 15 % off) is outside the tolerance (2 %), the book's values are inside, and the reading is not the knob itself
  (source current through its own load). Target: the value written in the section's text within 1,5 % (paragraph citing
  the figure first, else the nearest; caption too) → `origen: 'texto'` and that paragraph is the first quote; else the
  book's stored simulation, 3 figures → `'simulacion'`. Per drawing the best single knob plus a two-knob challenge on the
  same quantity (both moved the same way, ≥ 15 % off) or a second pair, plus (coverage review) up to two more single-knob
  pairs whose target the text writes, never the same physical quantity twice (same unit and value within 1 %): 33
  challenges. No exercise of the book cites a live figure; the four live drawings with AC/pulse sources are left out
  (their point is a time constant or a ripple, which needs a transient measurement). Lessons get ≤ 2 per section, never one repeating
  the section's `deslizador` (same knob and quantity). Building challenges: the table `CONSTRUYE` (ej-1.4, 2.4, 2.5, 2.6, 2.8,
  5.3, 5.8, 6.2, 26.3, 45.1 → section that teaches it or its own, supply, tray cards incl. `QN`, conditions; tolerances
  from the book's own solutions); generation stops if a number of a statement condition is not in the exercise's
  statement or the reference netlist (with the editor's models) does not meet every condition in
  ngspice; its messages are stored as `referencia.lecturas`.
- `porque10.mjs` (≈3 s): words = accent/case-folded tokens, 5-letter stems, numbers `#0.7`, Spanish stop words; an
  option's own words = its words minus the right answer's and the statement's (a «Sí / No» has none → general).
  Candidates: sentences (split at `[.;!?] + capital`, tag-balanced) of the question's h2 section — paragraphs, lists, box
  and derivation paragraphs, captions —; an exercise's solution first. Excluded: what the general explanation already
  quotes. Score: Σ idf (over the chapter's sentences) of the own words found, + 0,35 per statement word, + 0,6 for a
  contrast word, + 0,8 for the solution. Kept when (≥ 2 own words, idf ≥ 4,5, ≥ 1 statement word, ≤ 360 chars) or (≥ 3
  own words, idf ≥ 6); tuned by reading samples (`--muestra N`). Predictions: the section sentence naming the changed
  part with a change verb («aumenta», «mayor», «proporcional»…) that is not already one of the item's quotes.
  **Human review** (coverage follow-up): `contenido/porque_curado.json` `{nota, pares: {"R|<question id>|<option>" |
  "E|<label>/<question id>|<option>" | "P|<item id>|<sube|baja|igual>": {ok, frase (first 80 plain characters)}}}` holds
  the decision on each of the 386 proposals (139 ok). A sentence is emitted only when its pair is there with `ok` and the
  same `frase` (compared as folded letters and digits); otherwise «general», and the script lists the proposals still
  to review. Review 10d: 129 ok; `previa: true` shows the sentence before it in the same paragraph first (its subject
  is there; candidates carry `previa`, `conPrevia`); a test rejects an approved sentence starting with a pronoun or
  «Y ese…» without `previa`.

**Types** (`practica/tipos.ts`): `ItemReto {fuente (figure), mandos: Mando[] {id, nombre, unidad, de, inicio, valores},
observa, objetivo, tol, origen, efecto: {id: sube|baja}, solucion: {valores, lectura}, inicioLectura, desarrollo: html[]}`;
`ItemConstruye {ejercicio: {label, num, html}, alimentacion, cartas, condiciones: Condicion[], referencia: {descripcion,
netlist, lecturas}}`; `Condicion = fuente | nodo {valor, tol, nombre} | led {corriente, tol} | zener {min} | carga
{corriente, tol} | resistencia {valor} | e12 | potencia {max} | resistencias {valor, n} | puente {tol} | transistor {ic,
tol, vce?, divisor?} | divisor {n, arriba?, valor?} | sobrantes`; `puente` takes an optional `valor`, `zener` an optional `max`. `NOMBRE_TIPO`: «Reto con la figura», «Monte el
circuito» (and since review 10d every name in «usted»: «Calcule», «Prediga y compruebe», «Ajuste», «Señale en el
esquema», «Ordene», «Una las parejas», «Complete el montaje»; practica10.mjs statements likewise).

**Checkers** (pure): `retos.ts evaluarReto(lectura, objetivo, tol, unidad, nombre) → {bien, rel, cercania, mensaje}`
(magnitudes compared in absolute value), `consejoMando`; `construye.ts netlistMedida` (analyses and `.control` dropped,
`.options savecurrents` + `.op`), `medidaDeOp(texto, vectores)` (top-level R/D/V/I lines with nodes, values, model family
from `editor/modelos.ts`; currents from `@x[i]`/`i(@x[i])`, `@d[id]`, `v#branch`/`i(v)`), `comprobarConstruccion` (a node
= any node not ground nor a source terminal, nearest to the value; LED = max forward current of family LED; Zener =
reverse current, reversed one detected, `max` too, only one Zener; LED = exactly one LED and one resistor, all the
source's current through it; load (`carga`) = the sum of the currents leaving the Zener's cathode node through anything
but Zeners and sources (the whole load, whatever its parts); E12 within 0,5 %; `divisor {n, arriba?, valor?}` = exactly
n resistors, one free node, one resistor from a + terminal to it and n − 1 from it to the − side (`arriba`: the upper
one's value, `valor`: all of them); `sobrantes` = no part straight across a source (+ to −) or with both legs on one
node, none with a leg on a node nothing else touches, one source only; bridge = the two closest midpoints (free nodes
between 5 % and 95 % of the supply) that are fed through a current-carrying resistor (> 1 µA and > 1 % of the largest)
from a higher node and drain through one to a lower node, and lie on different branches (union-find over
current-carrying resistors between free nodes: never joined except through the supply), within tol·Vsupply; with
`valor`, each midpoint has exactly one resistor to a + terminal and one to the − side, all four of `valor`, and no other
resistor but a detector between the midpoints; transistor = NPN `Q c b e [s] model` lines, collector current `@q[ic]`
and V(C) − V(E) ≥ 0,3 V (active), `vce` within tol when given, and with `divisor` a resistor + → base, base → −,
+ → collector and emitter → −), `textoCondicion`. Reviews 10d/10g: ej-1.4 `divisor {n: 2, arriba: 1 kΩ}`, ej-2.4
`divisor {n: 2}`, ej-2.5 `puente {tol: 0.001, valor: 1 kΩ}` (5 mV: the 1010 Ω sensor gives 12 mV), ej-2.8 `divisor
{n: 3, valor: 10 kΩ}`, ej-6.2 `transistor {vce: 3.98, divisor}`, every one `sobrantes`; the `paralelo`, `resistencia`
and `resistencias` kinds are no longer used by the table (`resistencia`/`resistencias` remain in the checker).

**App.** `Practica.svelte`: `reto` and `construye` have 3 attempts; after a failed one the hint ladder opens one more rung.
`Reto.svelte` (live `Escenario` + `EtiquetaNueva` per knob, range + ‹ › buttons, `medirCon` in `medir.ts` → the simulator
worker, 280 ms after the last move; `data-lectura`, `data-leyendo`, `data-distancia`). `Construye.svelte` (`montajeVacio`
with the exercise's supply, `Mesa` + `BarraPieza` + `Bandeja` with `soloCartas` — new optional prop of the tray —,
`pb.nl` → `netlistMedida` → `simularTexto`; `pb.op` from the same run lights the LEDs; `window.__epaConstruye` = the
board, for tests). `pregunta/porque.ts cargarPorque(parte)` (cached, null on failure) and `PorQueNo.svelte` («Por qué no
«…»»: the book sentence with its link, and/or a sentence from the simulation; nothing for `general`), used by
`Pregunta.svelte` (after a wrong option, above the general explanation), `aprender/PreguntaEjercicio.svelte` (new props
`porque`, `parte`; under the verdict of a wrong choice; `Comprobador.svelte` loads the part's file only when the
exercise has a choice question) and `Prediccion.svelte`.

**Paths** (`lib/aprendizaje/camino.ts`, pure): `calcularCamino(nodos: {clave, leccion, progreso: hecho|superado|empezado|
nada}[]) → {estados: hecho|superado|en-curso|disponible|bloqueado, siguiente}` — a lesson opens when the previous lesson
is done or passed, an exercise/question with its lesson, every node up to the furthest with progress is open;
`saltadas(nodos, k)` (lessons before k not done); `aprobadoSalto` (≤ 1 miss; all right under 4 questions);
`repasoDe(DominioConcepto, ahora?) → ahora (repasar, or the date already reached at `ahora`) | fecha (ultima + 0,515 · S
days: retention 0,5^(d/S) reaches 0,7) | flojo (precision < 0,6) | sin-datos`; `cuandoRepaso` (by local calendar days).
The views read `ahoraMinuto()` (`lib/aprendizaje/minuto.svelte.ts`: one app-wide interval of 60 s plus
`visibilitychange`) so that what falls due shows without reopening them (review 10d). `cursos/Camino.svelte` (props `grupos: {clave, titulo, nodos:
NodoVista[]}[]`, `siguiente`; one `<ol>` per chapter, the zigzag and dashed connectors drawn (SVG per node, offsets
scaled ×0,45 under 520 px), progress ring `conic-gradient`, a locked node is a `<span>` with «Saltar hasta aquí» (first
locked lesson and first lesson of each later chapter; in own courses every locked lesson); `data-nodo`, `data-estado`,
`data-repaso`). `cursos/SaltarHasta.svelte` (`#/cursos/<id>/saltar/<parte>/<label>`, `#/docente/curso/<id>/saltar/<n>`:
4 Repaso questions of the skipped lessons ONLY — `preguntasDelSalto(candidatas, concepto, lecciones)` in `camino.ts`
with `conceptoDeRef` (exercises' index loaded first) —; QA 1.0: it used to top up with the chapters' other lessons; now
fewer questions (all right needed under 4; intro text `data-total-salto` and the failure text say so), and with none
the intro says there is no check (`data-sin-preguntas`) and «Saltar sin prueba» (`data-saltar-sin-prueba`) marks them
the same way (result «Lecciones saltadas», «Deshacer»); each question shows `data-ref-salto="<parte>/<ref>"`;
`origen="prueba-nivel"` (no XP), pass → `marcarSuperadas(not yet marked)`, «Deshacer» → `desmarcarSuperadas`). `PaginaCursos.svelte` and
`docente/CursoPropio.svelte` (new prop `salto`; `PaginaDocente` passes `seg[3]` when `seg[2] === 'saltar'`) build the
nodes; `inicio/RepasoCamino.svelte` (start page, after «Práctica inteligente»: completed or passed lessons due now, the
first with «Repasar» → `#/practicar/<parte>/<label>`, else the next date).

Tests: `tests/brilliant10-contenido.spec.ts` (Node, ngspice WebAssembly loaded with `compilar`) and
`tests/brilliant10-navegador.spec.ts` (`playwright.brilliant10.config.ts`, port 4631, build
`/tmp/claude-0/epa-brilliant10/dist`); stable under `--repeat-each=2 --workers=2`.

### «Encuentre la avería» (`practica/averias.ts`, `Averia.svelte`, `web/scripts/averias10.mjs`)

**Pure** (`averias.ts`, run in Node by the generator and the tests): `TipoAveria = abierta | corto | alto | bajo | reves
| base-abierta`, `NOMBRE_AVERIA`; `averiasDe(rol)` (R: abierta, corto, alto, bajo; D/LED/DZ: abierta, corto, reves;
QN/QP: base-abierta, corto); `netlistAveria(esq, {elemento, tipo}) → {texto, meta}` = `generarNetlist` of the drawing
with the faulty part — value ×10 / ÷10, an open R as 1e12 Ω —, then one edit of the part's line
`<prefix>_<id lowercased>`: an open diode is commented out, a reversed one swaps its two nodes, a short adds `r_averia
n1 n2 1m` (a transistor's C–E), an open base moves the base to `<id>_bo` with `r_averia <id>_bo 0 1e12`; then
`.control op .endc .end`. `tensionEntre(op, roja, negra)`, `corrienteDe(op, elemento)` (0 when the element has no
current), `difiere(sano, averiado, 'V'|'A')` (≥ max(0,3 V | 10 µA, 15 %)), `puntuacion(medidas, piezaBien, tipoBien,
fallos = 0)` (100; 60 with the part only; −5 per measurement beyond 3 and −25 (`PUNTOS_POR_FALLO`) per wrong diagnosis
before the last one, ≥ 20; 0 with the wrong part; Averia.svelte counts `fallos` in `comprobar`).

**Generator** `averias10.mjs` (helpers moved to `libro-node.mjs`: `NOMBRE_ROL`, `PIEZA`, `grupoRol`, `nombrePieza`,
`etiquetaNodo`, `recorteDe`; retos10's output unchanged). Drawings of `explorables.json` that simulate in DC (no AC or
pulse source); points = every node, placed at its longest wire's midpoint or an `esq.puntos` point, named by its label,
«masa», or «el borne − de la fuente» when the drawing has no ground symbol (the reference), else «punto A…»; the book's
stored op must agree with the app's simulation; ≥ 2 nameable parts and ≥ 3 points. Each fault of each part is simulated;
a case is kept when it is diagnosable (`difiere` somewhere) and unambiguous (no other fault of the drawing reads the
same: voltages within 50 mV / 2 %, currents 1 µA / 2 %), and its clearest voltage (the key measurement) is not ground;
≤ 3 per drawing with different parts and kinds (order abierta, corto, reves, base-abierta, alto, bajo). **Human review**:
`contenido/averias_curado.json` `{nota, casos: {<item id>: {ok, resumen, nota?}}}`; only approved ids are emitted (35
proposed, 32 approved; the three of fig. 23.6 rejected: the drawing holds several separate equivalent circuits);
`--revision FILE` writes the readings to review, `--detalle` why drawings were skipped. Item id
`<parte>-averia-<figure label>-<drawing>-<part id>-<tipo>`; lessons show ≤ 1 per section; the counts of
`practica/indice.json` are recomputed. `generar.py`: practica10 → retos10 → averias10 → porque10 → conceptos11.

**Type** `ItemAveria {fuente (figure), averia: {elemento, tipo}, piezas: {id, nombre, tipos}[], puntos: {nodo, nombre,
xy, masa?}[], ramas: {id, nombre}[], clave: {nodo, nombre}}`; `NOMBRE_TIPO.averia` «Encuentre la avería».

**App.** `medir.ts medirAveria(fuente, averia)` = one cached worker run of `netlistAveria` (the faulty netlist is built
in the browser from the figure's schematic; no reading is stored in the item). `Averia.svelte`: the figure cropped with
a `<clipPath>`, point badges (a tap moves the red probe), the meter (radiogroup Tensión/Corriente, `data-punta=roja|
negra`, `data-rama`, `data-medir`, `data-lectura-polimetro`; readings shown as a meter does — 0 under 1 mV / 1 µA,
currents as magnitudes) and its history; radios `data-pieza`, `data-tipo`; the end view (`data-puntuacion`, each
measurement against the healthy one, `data-revela` on those that show the fault, the key measurement). `Practica.svelte`:
«Borrar y volver a empezar» also for `averia`.

### «¿Qué seguridad tiene?» (`lib/aprendizaje/seguridad.ts`, `seguridad.svelte.ts`, `pregunta/Seguridad.svelte`)

Rules, record and merge in the header of `seguridad.ts` (pure). Store `seguridad` (`ESQUEMAS` v1; registered in
`registro.svelte.ts` with `sincronizableGuardado(guardadoSeguridad, {tiempo: t, valido: seguridadValida, unir:
unirSeguridad})`); `guardadoSeguridad = guardadoDeRegistro({claveAlmacen: 'seguridad', claveSinc: 'seguridad', campo: 'items', unir})`
(1.1: `claveSinc` was missing — see «Every Guardado marks under its store's key» in the synchronisation section).
`marcarSeguridad(item, s)` writes a tap at `max(now, t + 1)` and rejects when the write failed (the chip then says
«No se ha podido guardar todavía: se volverá a intentar»; the Guardado retries). `nivelDeRonda(reg, t, siguiente?)`:
the window [t − 1 min, t + 30 min] ends at the item's next round start − 1 min (`ajustarRegistros` passes it), so a tap
counts for one round only (review 10d). Mastery hook: `dominio.svelte.ts establecerAjuste(f)` — a
function applied to the stored records in `calcular()` before computing (nothing is rewritten in `dominio`);
`cargarDominio` imports `seguridad.svelte` and calls `cargarSeguridad`, which installs `ajustarRegistros` (a right
round with a «Dudaba» tap → min(points, 59), «He adivinado» → min(points, 30); the tap in [round − 1 min, round + 30
min], the latest). `Seguridad.svelte` (three chips, `data-seguridad`, `data-nivel-seguridad`, `aria-pressed`) appears in
`Pregunta.svelte` (right and answered now, not in a placement test), `Practica.svelte` (final card, answered now) and
`aprender/Comprobador.svelte` (solved during this visit, not after opening the solution).
Tests: `brilliant10-contenido.spec.ts` «seguridad» (merge properties, round window, the effect on the review) and the
real-engine case `b10·1` (`tests/motor-real/escenariosBrilliant10.ts`, imported by `correr.ts` after escenarios10; run by
`correr.ts casos b10` from that spec, so datos10's count of `t10` cases is unchanged).

## User guide «Guía de uso» (1.0, `web/src/lib/guia/`, `web/src/componentes/guia/`)

The in-app guide for the owner and anyone he lends the app to. No stored data, no new key.

- **Content as data**: `lib/guia/contenido.ts` exports `GUIA: SeccionGuia[]` — `{id, titulo, resumen, apartados:
  [{id, titulo, bloques}], enlaces: [{texto, ruta}], claves?}`; blocks `p`, `lista`, `pasos`, `consejo`, `aviso`,
  `teclas` (rows key → action). Plain text only (the view escapes it); «…» only around what the app shows. It is a TS
  module imported only by `PaginaGuia` (own chunk, ~38 kB), so it ships with the bundle and works offline like the rest
  (no fetch, no service worker needed). `EnlaceGuia.svelte` builds its href itself so the content never lands in the
  chunks of the pages that link to it.
- **Route and view**: `#/guia[/<seccion>[/<apartado>]]` (view `guia`, `ruta.ancla` = «seccion/apartado»),
  `componentes/guia/PaginaGuia.svelte`: index of cards; a section as `<article>` (h1 = section title, h2 per subsection,
  «Abrir en la aplicación» chips, previous/next) with a sticky `<nav aria-label="Secciones de la guía">` on wide screens
  (hidden under 860 px); an unknown id lists all with a status line. Every navigation clears the filter, restores
  `ruta.y` on back/forward or scrolls to the subsection (`scroll-margin-top` under the bar) or the top, and focuses the
  heading shown (`tabindex=-1`, `h-guia-seccion` or `guia-<seccion>-<apartado>`; no focus ring on headings).
- **Filter** (`lib/guia/buscar.ts`, `buscarEnGuia`): synchronous, accent/case-insensitive, every query word must start a
  word of the subsection (title ×4, section title and `claves` ×2, text ×1, summary ×0.5); results are links with a
  plain snippet; the count is an `aria-live` line. The book's search (`Busqueda.svelte`, «Buscar en el libro») is left
  untouched on purpose: its results, keyboard selection and tests are about the book; the guide's `primeros-pasos/buscar`
  points to this filter instead.
- **Entry points**: `HERRAMIENTAS` entry `guia` («Guía de uso», short «Guía», icon `guia` = lucide circle-question-mark),
  the last one, so it is the first to go to «Más» (desktop on a low window; always in «Más» on the phone); «Aa» → group
  «Ayuda» (`Ajustes.svelte`, `data-grupo-guia`); a link in `Diagnostico.svelte`'s header. «¿Cómo funciona?» deep links
  (`<EnlaceGuia seccion="…" apartado?="…" />`, a handful at most): `PaginaSincronizacion` (datos/sincronizacion),
  `PaginaDocente` (docente), `practica/Averia.svelte` (practica/averia), `inicio/RepasoCamino.svelte`
  (repaso/repaso-espaciado), plus the diagnostic (diagnostico).
- **Keeping it current** (whoever changes a feature updates the guide): `tests/guia10-contenido.spec.ts` (no browser)
  fails when a section/subsection id is not route-safe or repeated; a text uses «tú»; an «Abrir en la aplicación» link
  is not a route the router parses (`a === '…'` in `lib/ruta.svelte.ts`) and `App.svelte` renders, or a sub-route no part
  of the app links to; an `EnlaceGuia` or `#/guia/…` literal of the app points to a missing section/subsection (or one of
  the agreed five disappears, or there are more than six places); a «quoted» text of the guide is not in `web/src`
  outside `lib/guia/` (a label renamed in the UI breaks it; true examples go to `NO_ETIQUETAS` in the test); a rail entry
  of `HERRAMIENTAS` is not named in the guide or not linked from it. `tests/guia10-navegador.spec.ts` (port 4721, build
  in `/tmp/claude-0/epa-guia10/dist`, `playwright.guia10.config.ts`): the rail «Más», «Aa» and the diagnostic; every
  section with its focus, headings, landmarks and neighbours; the deep links (sync page, teacher mode, an avería inside a
  lesson, a typed subsection); the filter with the keyboard; 44 px and no horizontal scroll on a phone; axe in the three
  themes at desktop and phone width; offline (after one online pass that lets the browser fetch the app's own font
  subsets, moving through every section and filtering makes no request).

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
`sinc-enviado` (0.12, random trial 71337, scenario `b12·21`) {doc id, items: {store: {id: [t, hash | «-»]}}}: what a
run is about to PUT of this device's own versions, written right before the PUT, put back as it was when GitHub answers
that nothing was written (409), cleared when the run is recorded and by «forget the history». A run cut after its PUT
records nothing and keeps its marks: its next run dated those changes «now» again (fusion.ts `fecharLocal`, a mark newer
than `iniciada`) and they beat a deletion another device made after seeing them in the file. The next run takes these
entries as the record of each item that still holds that version (a later change keeps its mark); a run that fails
before its PUT writes nothing here; 0.10/0.11 never read the key. Review 0.12i: only items with a mark are listed (only
those are dated «now»), entries of an earlier cut run still valid are kept, `en` (when written) makes an item changed
again since — back to the same value — be dated by its mark; the prune rule («deleted elsewhere, tombstone pruned»)
uses the real records only, never what was attempted; a storage that cannot take the key leaves the run without it.
`sinc-estado` {doc id, dispositivo, ultima, items: {store: {id: [t, hash] | [t, hash, n, file hash]}} of the last
synchronised version, borrados: {store: {id: t}} (0.11: the items recorded as deleted, in a field of their own so that
an 0.10 engine — which knows only `items` — never reads «-» as a hash), resumen}, `sinc-marcas` {cambios, borrados:
{store: {id: ms}}} written by the data modules (`marcas.ts`: `anotarCambio`, `anotarBorrado`; a module with a
`Guardado` marks every item its write changes or removes, and stores the marks before the data), `sinc-version` {t,
ultima release, descartada, limite (0.12: GitHub's rate limit, no request before this ms)}. The marks are written at once and read-merge-write (a tab never overwrites another tab's
marks; of a change and a deletion of an item, the later one stays), and a run forgets only the marks it saw, if
unchanged since. `huellas` {store: {id: hash}}: the value a change mark is for, when the module knows it (a
`Guardado`); a mark for another value (another tab's change not stored yet) is not taken for this copy's. `sinc-estado.iniciada`: the local time the last successful run started. `sinc-estado.podado` (0.12): the prune horizon of the
file last merged (copia.ts: an old backup's items older than it and unknown here are left out of «Unir»).
Dating a local item (`fusion.ts fecharLocal`): unchanged hash → its synchronised `t`; changed **and marked** → max(its
own time field, its mark), or — only for a mark newer than `iniciada` (made after the device recorded what it
synchronised) — max(now, synchronised `t` + 1) when that is not newer (a clock behind still outdates what it saw); an
older mark (kept for a store that could not be written, made again for a change still unwritten — possibly by another
tab, for another value) never outdates the record: dated synchronised `t` − 1; changed **without a mark** — not an edit of the reader's (every module marks its edits) but a stale copy
written back by a module's old memory or an old version — → its own time (unless equal to the record's), or
synchronised `t` − 1 (it never outdates
what it was synchronised with); never synchronised, without a mark → its own time, else 1 when it equals the store's
default value (`porDefecto(id)`: a fresh install's settings) and 2 otherwise (a reader's value of unknown age always
beats a default; finding 4 of the third review); a synchronised item missing locally → tombstone at its deletion mark
only when marked (at max(mark, synchronised `t` + 1); for a mark not newer than `iniciada`, at the mark when it is
newer than the record, else at synchronised `t` − 1, which loses; without a mark nothing is sent: a stale copy without
that item does not delete it); recorded as deleted
(`borrados`) and missing → that same tombstone, or one at a newer deletion mark; never recorded, missing, with a
deletion mark (created and sent by a run that did not finish) → a tombstone at its mark. A local value equal to the
file's takes the file's time (`alinearIguales`). Pruning: a local tombstone record absent from the file with `t ≤
podado` is forgotten, so a device whose clock is behind does not send pruned tombstones back (no endless commits).
**Unions in the file**: a store with `unir` (dominio: `fusionarRegistros`; problema-dia: `preferirDia`) has two live,
valid versions of an item merged by the engine before the PUT and against the sha (a 409 merges again): the merge kept
as the file's entry when it equals it, else dated max(t₁, t₂) + 1 (`fusionarColecciones`). `unir` must be commutative,
associative and idempotent (`fusionarRegistros` is: the rounds are united by their exact time, the best of each time
kept, then the newest `MAX_RONDAS`; property-tested on 3000 random triples). So the union is durable at once
(another device's next run cannot replace it) and `aplicar` has nothing to add. XP and achievements are registers
with deterministic ids (no union needed).
**What is recorded after applying** (`registroSincronizado`): the merged time and the hash of the FILE's value, for the
items the store holds; a tombstone of an item it does not hold → [its time, `BORRADO`] (so a re-creation here later
outdates that deletion whatever the clock says). A store that keeps something else than the file (a normalisation)
sees its item as changed and sends it once with a new time; against back-and-forth (two app versions normalising a
value in opposite ways) the 4-slot form counts the runs in a row the store kept something else than the same file
value (`n`, `file hash`; a run that only sent ours keeps counting, a run whose value the store took ends it): past
`REENVIOS_MAXIMOS` (3) the record is [file t − 1, the store's hash, n, file hash] — the local copy loses to the file, is
not sent, and `porAplicar` no longer gives that same value to the store (the count stops at 4). An item edited during
the run keeps its previous record (a deletion made meanwhile becomes a tombstone next time). **A value the store
rejects** (`valido` false: a newer version's shape, a damaged value) is not applied and is recorded as [file t − 1, the
store's hash]: the old local copy is never sent over it; only a later local edit (dated after) replaces it. **A store
whose `aplicar` fails** (or cannot be read back): each item it was given and holds is recorded as [file t − 1, its
hash] (the local copy, which already lost, is not sent again; the next run retries), an item it was given and does not
hold is not recorded (the file's newer version is not deleted again), an item the merge no longer has keeps its
record; and that store's marks are kept (`olvidarMarcas(inicio, fallidos)`), so a deletion keeps its time.
Every `aplicar` is **atomic** (third review, finding 2): the store writes the new value first and changes its memory
only after the write succeeded, so a failed write leaves memory and storage alike (nothing half-applied can be sent
later as the reader's own). If `sinc-estado` itself cannot be written at the end of a run, the run still succeeds, the
marks are kept and the state is held in memory (`estadoSinGuardar`) for the next run of that page.
The token is stored apart (`credenciales.ts`: plugin-store file `credenciales.json`, or `localStorage
epa-credencial:github` in a browser).

**Run** (`sincronizar.svelte.ts`): event `epa:antes-de-sincronizar` → read every store → GET contents (`cache:
no-store`; base64 UTF-8; files over 1 MB through `application/vnd.github.raw`; 404 → check the repository → new
file) → merge (with the stores' unions) → PUT with the `sha` only when the stores changed (409/422 → read and merge
again, up to 5 times) → apply store by store, each store read again right before its `porAplicar` (an edit made in
it while an earlier store was being applied is never overwritten) and item by item (skipping items edited during the
run, awaiting each store's write) → event `epa:sincronizado {claves}`. One run at a time across the tabs of the browser
(`navigator.locks` `epa-sinc`, where it exists), each reading `sinc-estado` and the marks again (`recargarMarcas`: the
stored ones merged with this tab's). Every request to GitHub is aborted after `ESPERA_RED` (45 s; `github.ts`): a hung
request never holds the lock (and every tab's synchronisation) — «GitHub tarda demasiado en responder; se reintentará
más tarde.», transient. Errors are Spanish
(`github.ts → explicar`: 401 token, 403 permission or rate limit, 404 repository or access, 5xx, offline);
automatic runs (start-up, every 5 min while visible, on hide, on return after > 1 min) keep transient errors quiet.

**Syncable stores** (`registro.svelte.ts`): `{clave, nombre, leer(), aplicar(poner, quitar), tiempo?, valido?,
maximo?, unir?, porDefecto?}` (`aplicar` must reject when it could not store what it was given, and change nothing
then); registered: marcadores, notas, posiciones, leidas («parte/label»), ejercicios, deducciones,
repaso-tarjetas, repaso-diario, repaso-ajustes, repaso-tests, repaso-fallos, repaso-examenes (newest 30),
calc-favoritos, editor-circuitos (`{version, circuitos}` of the schematic editor, items with their own `borrado`),
protoboard-circuitos (0.10, the same shape for own breadboards),
lecciones (0.9, «parte/label»), progreso-diario (0.9, one item per day; 0.12: and one record per device and day,
summed), progreso-objetivo (0.9), and (0.11)
progreso-xp (the XP ledger, award id → `{x, t}`), progreso-logros (achievement id → time), cursos-superadas
(«parte/label» → time), cursos-pruebas (course id → last placement test), and (0.11 group B) dominio (item id →
`{s, c, r}`, rounds merged as a union in the file) and problema-dia (day → its problem and result; `preferirDia`
decides which version is kept, in the file), and (1.0 Brilliant) seguridad (item id → `{e: [[time, sabia|dudaba|
adivinado]…], t}`, merged with `unirSeguridad`: union by time, the same time keeps the more cautious level, newest 12).
(1.1) laboratorio (lab «p<n>» → `{h, l, c, t}`, merged with `unirRegistrosLab`: union of the steps, newer reading per
step, earliest completion).
`repaso-ajustes` and `progreso-objetivo` declare their default value
(`porDefecto`).
**Every Guardado marks under its store's key** (1.1, enlaces11): `sincronizableGuardado(g, {clave})` throws when
`g.o.claveSinc !== clave`. `laboratorio` (1.1) and `seguridad` (1.0) were built with `guardadoDeRegistro` without
`claveSinc`: no write of theirs made a mark, so `leerTestigos` returned null and `atestiguado` took any other writer's
version as proven — a stale tab's copy (its cached view of localStorage lagging, the case `propios` exists for) written
over a step or tap the reader had just stored removed it from the storage and from memory, and when no run had sent it
yet it was lost on every device. Between devices nothing was lost (the stores' unions and their own increasing `t`
dated the unmarked changes), and no migration is needed (marks are local, a 1.0 device never read them for these
stores). Scenarios `e11·1` (the lab: a stale tab, then two devices), `e11·2` (seguridad) and `e11·3` (the guard) in
`tests/motor-real/escenarios11.ts`, which runs the REAL modules (`arnes.ts` `AlmacenModulo`, `modulo('laboratorio')`;
`falsos/dominio.ts` stands in for mastery); both fail before the fix.
**Modules and their memory** (`guardado.ts`, third review, finding 1): every module that keeps a store's items in
memory (usuario: marcadores, notas, posiciones; aprendizaje: ejercicios, leidas, deducciones; Repaso: the six keys;
calculators' favourites; lecciones; progreso-diario and its goal; the editor's and the breadboard's circuits) keeps a
`Guardado` per almacen key and registers `sincronizableGuardado(g, …)`: reads are the memory merged with the storage
(three-way, base = what the module last read or wrote); its own writes are read-merge-write and mark what changed;
another tab's writes reach memory (`storage` event); the synchronisation's result is written first and put in memory
after (atomic); a write the storage refused stays pending (its marks are made again at every synchronisation's read,
and the next write retries it). Fourth review: reads, merges and writes of a key are one queue, and the memory is
read INSIDE each step (a write queued behind another never writes a copy made before the first put the other
writer's items in memory); after `aplicar`, memory gets what was STORED for the applied items (another tab's newer
version kept by the merge, not the file's older one); of two changes of an item without a time of its own, the newer
by the marks (a change still pending from a refused write loses to another tab's later one; applying a
synchronisation, the other tab's edit stays). Cost: per item, the JSON text and the hash only when the text changed
(an index reused from write to write); when the stored text is the one this module last read or wrote (`Almacen`
`leerTexto`/`escribirTexto`, localStorage; in Tauri's store nobody else writes) nothing is parsed or merged; big
stores (`guardadoDeRegistro`) read the live memory and assemble the stored text from the items' texts. An editor
autosave with a 2 MB library: 1–1,4 s before, 20–80 ms now (5 MB: 2,4–5,3 s → 40–140 ms); after another tab wrote
the key, a merge: about 0,1–0,3 s. Fifth review (the Tauri path): a step trusts that the storage is what it last read or wrote only
after a successful read of the key (`leido`; in Tauri there is no text to compare) — a write after a failed or
unfinished load reads and merges first, and fails if it cannot read (the saved library is never written over);
`cargar(adoptar)` puts the loaded items in the module's memory within the load's step (every module passes it,
keeping what the reader changed before the load), so a write queued during a load never runs from the memory before
it; `aplicar` marks the reader's edits made while it waited in the queue (not the items it applies), and keeps another
tab's deletion of an applied item; when the marks cannot be stored (storage full) the changes stay pending and are
marked again by the next write. On the Tauri path a big store's write parses the value from the items' texts (no
second serialisation): a 2 MB library 65–75 ms, 5 MB 160–220 ms with a Tauri-like store (75–115 and 180–250 before). So no module overwrites with its older copy what the
synchronisation or another tab stored (before, the editor wrote its whole map from memory loaded once; a second tab
its old bookmarks). `guardadoDeRegistro({claveAlmacen, claveSinc, obtener, campo?, tiempo?, unir?})` is the common case
(0.12: `unir(a, b, base?, id?)` gets the item's base — a three-way merge — and its id, and may return undefined for
the default rule; and in a browser a write is a compare-and-set — `Almacen.escribirTextoSi(key, expected, text)`,
compare and write in one synchronous localStorage call — of the text the step read: if the key changed since, as far as
this page can see, the step runs again (read, merge, write; unconditional after five tries; randomized simulation, trial
642, scenario `r12·1`). It is NOT atomic across real tabs (review 0.12, finding 3, measured with two Chromium tabs):
each tab reads its own cached view of localStorage and the other tabs' changes arrive as later tasks, so two tabs
writing at once both succeed and the second writes the first's items back as it last saw them. What protects the data
is `propios`: in a browser a Guardado remembers the reader's changes it stored (hash, time; and the last values it wrote
per item); when the key, read again, lacks one of them or holds another version of it, that other version (or deletion)
is taken only with evidence (`atestiguado`) — another tab's mark for that very value or deletion, newer than ours and
not one this tab wrote itself, i.e. not with the same hash AND time as one of its own (the marks key can be written
back by a stale tab too; review 0.12b, finding 1: by hash alone, the same value set again later in another tab — a
favourite removed and added back — was never evidence, and the two tabs rewrote it ~10 000 times in 4 s); a
synchronisation or an import that applied it (`sinc-aplicados`, written by `aplicar` before the data: {store: {id:
[hash | «-», ms, hash read, ms written]}}, ~75 characters an item, every entry dated when the run read the store, not when written
(review 0.12e, finding 1: dated when written, an entry was evidence against another tab's change made after that
read), and since 0.12g with the hash the run's merge read for the item («-»: none): another tab whose change the merge
read and merged over takes the entry as evidence by that hash, for a change of its made before the entry was written
(review 0.12h, finding 1: unbounded, a later change of that tab back to the same value or deletion — A-B-A — lost to a
stale copy of what was applied; an entry without that time gives no evidence by hash) (review 0.12g, finding 2: in a store
without a time of its own, a change made just after the run started, read by its merge and then lost to a newer file
version after a 409, was kept by that tab and written back — and the next run sent it over the newer edit). The `*`
entry carries no hashes: with more than 1000 items in one application, that one case remains (a tab's change in the
milliseconds between the run's start and its read of the store, then a 409 and a newer version from the file: the
tab keeps its change; documented, not fixed — a hash of the whole snapshot would not tell the tab which of its items
the merge read), kept 30 minutes, browser only; more than 1000 items in one application —
the first synchronisation of a new device — or no room for them: one entry `*` for the whole store, 45 characters,
dated when the run read the store (review 0.12d: dated when written, it was evidence against another tab's change
made during the run, after that read, scenario `b12·17`); no
room even for that: applied without it, logged — review 0.12c, finding 6: 0.12b made `aplicar` reject then, which
would have blocked that store's synchronisation for as long as the quota stayed full, where 0.11 applied it; without
the entry another open tab holding its own change of an applied item keeps it and writes it back, and the next run
applies the synchronised version again, because that tab's mark is older than the run — scenarios `b12·5`, `b12·14`) or recorded it (`sinc-estado`, dated after ours — and recorded by a run that started after ours: the file's time is
another device's clock, maybe ahead, review 0.12e finding 2); or the item's own time, newer than that of
the value this tab holds —; without evidence it goes through the store's merge (a union keeps both; else the newer by
its own time or the marks: a stale copy is older) and, where this tab's change stays, it is written again. A loop
guard bounds that (`enTregua`): more than 8 such retentions of one item within 5 s and the item gets a 10 s truce in
which a refresh writes it back only once every 3 s (`reescribirLuego`, constants in `tregua.ts`; 0.12d made it 2 s to fit `12b·1`'s quiet window — a test change, undone in 0.12e: that test now opens its window after the repair write), not at once — the change is still kept, never
the other version taken (a first version of the guard took it, as before 0.12, and `datos12-pestanas.spec.ts` lost 4 of
40 steps: a burst of real writes of two tabs counts that many retentions too) —; with a `console.warn` naming the key
and item (`medidas.treguas`; scenario `b12·8` forces evidence never to be found: 30 writes in the last 3 s without the
guard, at most 4 with it, and each tab still holds its own value). A kept change is due again (`retener`, review
0.12c, finding 1): pending with its own time and value, so `volcar` (page hidden or closed) writes it even in a truce —
before, a tab closed during a truce left the stale copy stored (`12c·1`, `12c·2`) — and marked again, because a run in
another tab that saw only the stale copy forgets its mark, and without it the change would then pass for a stale copy
(scenario `b12·12`). What a synchronisation or an import applies becomes this tab's own version too (review 0.12d,
finding 1): `propios` gets the stored hash dated when the applied data were read (`aplicar(poner, quitar, leidoEn)`:
the run's FIRST read, `inicio`, the one its merge used — not the second read that only tells edits made during the run
(review 0.12f, finding 2) —; the import's read, `fotografiaLocal().leido`, taken before it reads) — before, applied items left `propios`, and a stale copy another tab
wrote back right after was taken: a deleted item came back for good (`12d·1`, scenarios `b12·15`, `b12·16`). Against an
applied version the evidence is the item's newest mark being for that very value (not this tab's), whatever its time:
another tab marks a change before writing it, so a real change made during the run can carry a mark older than the
read while its data land after it (random trials 31052, 31240 found that with the time check), and a stale copy has no
such mark (a run forgets the old marks, an import marks what it applies). The item's own time is no evidence against an
applied version («Sustituir todo» and its undo apply older versions on purpose); kept against a stale copy, the applied
version stays as it is (no union with it) and is written again, unmarked — it is not the reader's change, and marked
it would pass for a change made at the read and beat a newer version from another device (trial 31052). The import's read-back marks again only what differs from the
value given AND from the value held before the import (that is a stale copy, not what was imported). On a
refresh the base of each item becomes the storage's version only where the merge took it; where the merge kept or
made something else (this tab's change kept against a stale copy, or merged with it) the previous base stays (review
0.12b, finding 3: the stale copy is no ancestor of what memory holds, and a later up-to-date version merged three-way
from it made `unirAportesPestanas` add this tab's own steps twice, `12b·4`, `b12·7`). With the previous base the next
write merges the storage's version against the same ancestor the refresh used: an idempotent merge (newest, union,
field max) gives the same result, and the sum of a tab's own record adds nothing twice — only this tab writes its own
record (`idRegistro`, a duplicated tab takes another id), so another version of it is a stale copy, never a newer
one. A new mark is always later than the item's current mark (`Math.max(Date.now(), mark + 1)`; review 0.12b, finding 4:
with the clock set back, a newer value's mark was dropped by `poner` — the latest mark wins — and the value passed for
a stale copy; random trial 9138, scenarios `b12·3`, `b12·4`). And a reader's change that the write combines with the
other writer's version (the store's `unir`: a union, a sum) is marked for what is stored, not for the value in memory
(found by random trial 9301 during review 0.12b, present since 0.11: the mark vouched for none of the stored value, the
run dated it as an unmarked copy — `t = 1`, taken for a default — and a union's new element was dropped; scenario
`b12·10`); where the other writer's version won as it is, its own mark vouches for it. `propios` (with `escritos`,
`deAplicar`) keeps at most 5000 items, the oldest pruned down to 4000 (review 0.12e: one entry per applied item, for
the tab's whole life; a stale copy comes within seconds) — never one younger than 10 minutes (review 0.12f, finding 1:
one application of thousands of items gives them one time, and they were pruned in that very write, when a stale copy
is most likely; a soft cap, bounded by the key's ids). Tauri (one window) keeps none of this. `tests/datos12-pestanas.spec.ts`: two real Chromium tabs write at once 20 times; 20 of 40
steps were lost without it, none with it. A Web Lock was tried and rejected: its callback runs in a later task, which
never comes while the page unloads, so the flush on `pagehide` was lost — `inicio09.spec.ts` caught it. The marks key
`sinc-marcas` is read-merge-write too, so a tab whose cached view lagged can write it without another tab's marks
(review 0.12b, finding 2; `12b·1` saw it with two tabs writing at once): in a browser each tab remembers the marks it
stored (`marcas.ts` `mias`, in memory, at most 20 000 — ~150 bytes each; «Reiniciar tarjetas» makes ~2500, a big import
a few thousand, review 0.12c finding 6 —, the last one per item — a change and then a deletion of one item at the
same millisecond keep only the deletion: random trial 557 brought the item back, scenario `b12·11`) and puts back the missing ones (`reponerMias`) in every `volcarMarcas` and
`olvidarMarcas` — after every data write of a Guardado, and on every `storage` event of the key — unless the item's
`sinc-estado` record (or tombstone) is at or after the mark (a run dealt with it), or the last run started more than
2 s after the mark was stored with the mark not newer than its start (it saw the mark and may have forgotten it). So a
mark a run forgot legitimately — say an item changed and changed back, whose record stays older — is put back at most
once per run that forgets it, and only if that run started within 2 s of the store (harmless then: a mark not newer
than the last run's start never outdates what was recorded, `fecharLocal`); scenarios `b12·1`, `b12·2` (each fails
without its rule).) The
0.11 learning modules (progreso-xp/logros, cursos, dominio, problema-dia) mirror their key with `EnlacePestanas`
(above) and apply atomically in the same way. A data module with no memory of its own may register its
`Record<id, item>` almacen key in one line: `registrarSincronizable(mapaDelAlmacen({ clave: 'k', nombre: '…', tiempo:
(v) => v.t }))`.
Sixth review: a failed read of `sinc-marcas` is an error, not an empty set (`marcas.ts`: `volcarMarcas` and
`olvidarMarcas` read, merge and write in one try; on failure the pending marks are restored and the call rejects; only
damaged values inside are dropped), so a run never forgets — nor a flush overwrites — marks it could not read. A write
of the reader's changes that fails (also at its read) leaves a write **due** (`Guardado.sinGuardar`): `volcar` (page
hidden, before a run) writes it, and it is retried after 1 s, 5 s and 30 s; `alEstado(sinGuardar)` tells the module
after every attempt. The editor's and the breadboard's libraries keep `error` ('lectura' | 'escritura' | '') and show
`AvisoGuardado.svelte` (`role="alert"`, non-blocking, «Reintentar»: load again, then `volcar`); the save status says
«Sin guardar en este dispositivo» (never «Guardado») while it is set, a failed «Guardar» keeps the draft, and a circuit
or montage that could not be opened because the library could not be read says so. `aplicar` keeps the reader's edits
made during its write's wait (Tauri's IPC): an applied item the reader changed meanwhile is not touched in memory, and
a write is scheduled (it is marked by that write); with no base for an applied item (after a failed load) the applied
value — or deletion — wins. A retried load adopts the stored items minus the deletions still pending and the ids the
module removed since it last saw memory (no resurrection). Device entries of the file are validated
(`fusion.ts dispositivosValidos`: a string `nombre`, a finite `ultima`; in `leerDoc`, `fusionarDocs` and the summary): a
null or malformed entry is dropped instead of breaking every run. Memoised loads that fail are retried by the next
call (usuario, aprendizaje, Repaso, lecciones, progreso-diario, favourites; background loads never leave an unhandled
rejection); Repaso settings changed before the load are kept over the stored ones. A big store's previous value is
kept without its items (`anteriorLigero`), not as a second parsed copy.
Tests of the engine: `tests/revision11-motor.spec.ts` runs `tests/motor-real/` — the REAL engine in Node (one module
graph per device and tab, fake storage and GitHub with 409s, the 0.10 engine for an 0.10 device): one scenario per
finding of the second and third reviews, and a randomized simulation (devices with tabs, an 0.10 device, a fresh
install, storage failures, non-atomic modules, two edits of a tab in flight at once, clock skew, interrupted runs,
edits during a run, 409s) checking no loss, no resurrection, convergence and that commits stop (0.12, defence in depth — trial 61139, scenario `b12·20` —: when a store's `aplicar` fails, the run
reads it back, and an item it already holds as the file has it — a value with the file's hash, a deletion gone — is
recorded in `sinc-estado` as applied; before, a module that is NOT atomic, failing after taking a value new on this
device into memory, left no record of it, and an edit made on top of it with the clock behind the file's time lost to
it. Every module the app registers applies atomically — `sincronizableGuardado`, and the 0.11 learning modules write a
copy first and put it in memory after —, so for them nothing differs: only the simulation's `crudo` store reached it);
and the cost of a
write (`rendimiento.ts`: 2 MB and 5 MB libraries, budget and fast path). `tests/revision11-actualizacion.spec.ts`
runs `tests/actualizacion/` — the app's modules compiled in Node (`hooks-svelte.mjs`, a fake browser): the upgrade from
0.10.1 store by store, two devices across the update and back to 0.10.1 with a fake GitHub (the 0.10.1 source taken
from git, commit 8ffa4c6, read only), and every stored key damaged in 11 ways (load, read and two runs never throw).
`sinc-estado` records are validated on reading ([t, hash] or [t, hash, n, file hash]; anything else is dropped),
`sinc-ajustes` field by field, the stored summary (`resumen`) to its shape (devices without a name dropped). Both
specifications also run on a Tauri-like storage (fifth review): `tests/motor-real/falsos/almacen.ts` per device
(`nuevoDisp(…, { tauri: true })`: values, no texts, IPC round trips, read failures; B in every other random trial),
and `EPA_TAURI=1` in `tests/actualizacion/navegador.ts` (a fake `__TAURI_INTERNALS__` answering the plugin-store's
IPC: the app's real `almacenTauri`). Sixth review: scenarios r6·1–r6·5 and «r6 · menor» (each failed before its fix);
`tests/motor-real/guardado-azar.ts` — ONE real `Guardado` at random on `falsos/almacen-ipc.ts` (`EPA_ALMACEN=tauri` or
`navegador`): reader edits and deletions at any moment (also inside the IPC waits), `guardar`/`escribir`/`volcar`/
`refrescar`, a load that fails and is retried, reads and writes of the key and of `sinc-marcas` failing at random;
at every write nothing the reader kept is missing and nothing unknown is stored, and at the end (`escribir` or
`volcar`) storage = memory = what the reader did (300 trials before the fixes: 17/19 problems on Tauri, 11/87 in a
browser; now 0; review 0.12b, finding 5: the final check first waits until the Guardado is idle — the edits a write
schedules done, no timer — or an edit made after the final write was compared as if it had been lost); `azar.ts`'s
fresh install stores its defaults as another writer would (the key written, then taken by the tab on a refresh), not
through the tab with the marks key deleted afterwards — since 0.12b the tab puts those marks back (`reponerMias`), so
they were no longer defaults; `datos-rotos.ts` also damages the device list of the GitHub file; `tests/revision11-avisos.spec.ts`
checks the editor's and the breadboard's notices in a browser whose storage refuses to read or write the libraries.

**Backup (0.12, `copia-formato.ts` pure, `copia.ts`, `fichero.ts`, `componentes/sincronizacion/CopiaSeguridad.svelte`).**
File `{formato: 'epa-copia-seguridad', version: 1, app, exportado, dispositivo, almacenes: {<store>: {<id>: {t, v} |
{t, x: 1}}}}` (sorted keys, one level of indentation): every registered store, each item dated as this device's next
run would send it — `sincronizar.svelte.ts fotografiaLocal()` = `leerLocales` + `recargarMarcas` + `docLocal` with the
records of `sinc-estado` —, tombstones included; never the token, `sinc-*`, `prefs` or `dispositivo-local`. Export
and import run inside `enExclusiva(f)` (the runs' own section: one after another in the tab, and the Web Lock
`epa-sinc` across tabs; a run asked for meanwhile waits). `leerCopia(texto, stores)`: JSON (BOM allowed), `formato`
(also the synchronisation's own `epa-sincronizacion` file, any version since 0.7), `version` (> 1: «actualice»; older:
`MIGRACIONES[n]`, none yet), `almacenes` object; per item `entradaValida` and the store's `valido`, a bad item dropped
and counted (`descartados`), unknown stores listed (`desconocidos`); Spanish `ErrorCopia` otherwise (nothing imported).
`planificar(local, copia, stores, modo, ahora)` per store present in the copy: **«unir»** = `limitar(fusionarColecciones(
local, copia, union), maximo)` — the synchronisation's rule: the newer version of each item, a newer local deletion
keeps the copy's item away, a local item the copy lacks stays, unions merged —, each change marked at the MERGED
item's time; the copy's live items older than the prune horizon of the file this device last merged (`sinc-estado
podado`) and unknown here (neither live nor deleted) are LEFT OUT (`antiguos`, shown in the preview with «Incluirlos
también»): they may have been deleted and their tombstones pruned since, and the synchronisation would take them for
new and bring them back to every device (review 0.12, finding 1); a device that has a token but never merged the file
is told to synchronise first; **«sustituir»** = the copy's live items (`maximo` applied), what changes marked at `ahora` (an item already
equal is left to the usual dating); stores the copy lacks are not touched. `importar`: «sustituir» first stores an
automatic backup of the current data (`copia-automatica`: IndexedDB `epa-copias` in a browser; in Tauri its own store
file `copia-automatica.json`, written to disk with `save()` before it counts — not inside `lector.json`, which every
autosave rewrites —; an almacen key, flushed, otherwise; refused → nothing replaced), plans again against the data as
they are now, writes the marks (`anotarCambio` with the value's hash / `anotarBorrado`) and stores them BEFORE the data
(`volcarMarcas`; refused → nothing imported, and those marks are withdrawn from this tab's pending ones —
`marcas.ts retirarMarcas` — so that no later write stores them: unmarked, the import would be taken for a stale copy),
then `aplicar` store by store (atomic; a
failed store is reported, left as it was, its marks harmless: a change mark is for another value's hash, a deletion
mark only dates a missing item), reads each store back and marks again, at the same time, an item stored as something
else (a union, a normalisation), and dispatches `epa:sincronizado {claves, importado: true}`. So the next run sends
exactly the merged data, dated as merged: nothing deleted after the backup comes back, no local item is lost, nothing
older replaces what other devices hold, importing twice changes nothing. Saving (`guardarFichero`): Tauri — the
system's save dialog (`@tauri-apps/plugin-dialog save`) and `@tauri-apps/plugin-fs writeTextFile` on the path or (Android,
Storage Access Framework) the `content://` URI it returns; a failing plugin falls back to the Blob download; browser —
Blob + `<a download>`. Opening: Tauri — the open dialog and `readTextFile` (no filter on Android: a provider may give a
.json another MIME type); browser and fallback — `<input type="file">`. Why not a Blob download everywhere: Android's
WebView ignores `<a download>` (it needs a native DownloadListener and cannot hand a blob: URL to the DownloadManager)
and WKWebView needs a download delegate. UI: the «Copia de seguridad» card of `#/sincronizacion` (`#/sincronizacion/copia`
scrolls to it and focuses its heading): «Exportar copia», «Importar una copia…», the preview (origin, dropped items,
«Cómo importarla» radio group, a table «Nuevos / Cambian / Se borran» per store with changes), «Sustituir todo» behind
a checkbox, the result, «Guardarla en un fichero» and «Deshacer la sustitución» for the last automatic backup (review
0.12c, finding 4: re-importing it with the default «Unir» restored nothing, the replacement's marks being newer;
`copia.ts deshacerSustitucion` imports it with «sustituir» after the app's own confirmation, `lib/confirmar.ts`, and
stores first an automatic backup of the data as they are, so the undo can be undone; the automatic backup carries
`automatica: true`, and importing such a file preselects «Sustituir» and says why); «Aa» → «Copia de seguridad»:
«Exportar copia» and «Importar…» (`GrupoAjustes.svelte`, `exportar.ts`).
Saving everything before the app quits on its own (`almacen.ts guardarTodoAntesDeSalir`, used before installing an
update): every `Guardado`, the 0.11 learning modules and the reader's preferences (`usuario.svelte.ts volcarPrefs`,
review 0.12b, finding 6: written by a timer of their own, not awaited before) register how to write what they have
pending (`registrarVolcado`); those writes are AWAITED (at most 5 s), then the store is written to disk (review 0.12, finding 6:
a fixed 300 ms wait lost a step and a note with a slow store — `tests/actualizacion/salir.ts`, `EPA_IPC_MS=150`).
Review 0.12 (independent, `tests/motor-real/revision12a.ts` a12·1–3, by the reviewer; a12·4–6 in `escenarios12.ts`;
`tests/datos12-pestanas.spec.ts`): each failed before its fix. Review 0.12b (`tests/revision12b-pestanas.spec.ts`
12b·1–4, by the reviewer, two and three real Chromium tabs, `playwright.revision12b.config.ts`; `b12·1–11` in
`escenarios12.ts`): each failed before its fix (`b12·9` without the prune rule it checks; `b12·5` shows the run no
longer applies a store whose `sinc-aplicados` cannot be written; `b12·10` and `b12·11` came from random trials 9301 and 557).
Review 0.12c (`tests/revision12c-pestanas.spec.ts` 12c·1–5, by the reviewer, real Chromium tabs,
`playwright.revision12c.config.ts`; `b12·5`, `b12·8`, `b12·12–14` in `escenarios12.ts`; the review counts of two devices
in `tests/actualizacion/escenario.ts`, steps 17–28, whose `EPA_SRC_NUEVA` runs it on another copy of the sources; the
undo of «Sustituir todo» in `datos12.spec.ts`): each failed before its fix. Review 0.12d
(`tests/revision12d-pestanas.spec.ts` 12d·1/12d·4 and `tests/motor-real/revision12d.ts` d12d·2/d12d·3, by the reviewer —
d12d·2 adapted to the undo counters; d12d·3 is the documented limit of the excess, above —; `b12·15–17`; steps 29–42
of `tests/actualizacion/escenario.ts`): each failed before its fix. Review 0.12e (`tests/motor-real/revision12e.ts`
e12·1–3 with controls, by the reviewer — e12·3 adapted to what «Reiniciar tarjetas» now stores —;
`tests/revision12e-pestanas.spec.ts`, measurements; steps 43–55 of `tests/actualizacion/escenario.ts`; `12b·1` opens
its quiet window after `RETRASO_TREGUA`): each failed before its fix; `datos12.spec.ts` runs revision12d (d12d·3 as an
expected failure: the documented limit) and revision12e. Review 0.12f (`tests/motor-real/revision12f.ts` f12·1–2 with
controls, `tests/revision12f-pestanas.spec.ts` 12f·3, by the reviewer; `b12·18`–`b12·19` on the real repaso module):
each failed before its fix; `datos12.spec.ts` runs revision12f too.
Tests (0.12): `tests/datos12.spec.ts` (`playwright.datos12.config.ts`, port 4521, build `/tmp/claude-0/epa-datos12`):
pure property tests (3000 random record sets: commutative, associative, idempotent, the sum of each device's newest
record; 2000 random imports: the result is the LWW winner of every item, marks at the merged time, a second import
changes nothing), the real engine's `d12·1–5` and `c12·1–7` (`tests/motor-real/escenarios12.ts`, added to the cases by
`correr.ts`; `d12·1–3` and `d12·5` fail with the 0.11.0 module) and 60 random trials, and the browser (export,
import, damaged files, «Sustituir todo», «Aa», the start page's goal with two devices' records and with 0.11 data,
360 px, 44 px targets, axe in three themes). The harness: `AlmacenDiario` (`{diario: true}`) mounts the REAL
`progreso-diario.svelte.ts` per tab (registered as `registro.svelte.ts` does; `falsos/eventos.ts` collects its events;
a `document` stub; a timer of ≥ 10 min never fires there: the change-of-day timer would loop), `Pestana.copia()` the
real `copia.ts`, `nuevoDisp(…, {guardado})` pre-fills a device's storage (older data); `azar.ts` adds the daily
progress on the 0.11 devices (checked at the end: every device and tab counts exactly the steps done, per day) and
backups exported and imported («unir»; what the backup reflected becomes known, like a run). Trials 168 and 215 lost
steps with one record per browser device (two tabs, storage refusing writes) before `idRegistro`; trial 642 (and
`r12·1`) before the Guardado's compare-and-set write (the fakes `falsos/almacen.ts` and `almacen-ipc.ts` implement
`escribirTextoSi` like localStorage). `tests/actualizacion/
escenario.ts [tauri] [0.11.0]`: also from 0.11.0 data (commit 0afc439; a commit missing from the clone is found by its
message «Versión X.Y.Z:»; the 0.11 stores, which `generar.ts` does not fill, may be empty, and XP and achievements
are compared without their times — both versions reconcile them at load with their own clock), then a day studied on
both, X updated and Y old (steps 11–16: X 2 steps, Y receives and adds 3, X counts 5 and sends the legacy record once,
then no commits); `datos-rotos.ts` also damages `dispositivo-local` and `copia-automatica`, exports and imports a
backup («unir» and «sustituir») over the damaged data and checks that a step still adds up.

**Update notice** (`actualizaciones.svelte.ts`): `GET /repos/Metalaria/electronica-app/releases/latest`, at start-up
at most every 12 h, silent on errors, compared with `VERSION_APP` (`version-app.ts`: vite `define` from
`src-tauri/tauri.conf.json`, which `scripts/version-ci.mjs` sets from the tag). 0.12: the repository is public, so
with the synchronisation token the request carries it (a 401 is retried without it) and without one it is anonymous
(`github.ts cabeceras(null)`: no `Authorization` header); the data repository is never asked without a token. Rate
limit (`github.ts`): 429, or 403 with `x-ratelimit-remaining: 0`, `retry-after` or «rate limit» → `ErrorGitHub`
transient with `reintentarEn` (`retry-after` seconds, else `x-ratelimit-reset`, else 60 s), stored as
`sinc-version.limite`; no request before it (the manual check says «se podrá volver a intentar a las HH:MM»). Start-up
without a token only in Tauri (`enTauri()`; tests: `globalThis.__epaComprobarSinToken = true`); the plain browser asks
only with a token or on «Buscar actualizaciones». The notice (`Avisos.svelte`, mounted by `Arranque.svelte` in idle
time; hidden while «Aa» is open, `app.ajustes`) shows the version, the first lines of the release notes, this
device's installer and «Ver la publicación» (Tauri: `plugin:opener|open_url`; browser: new tab). Tests:
`tests/sincronizacion.spec.ts` (GitHub mocked with `route()`) and `tests/actualizador12.spec.ts`; screenshots:
`node tests/sincronizacion-capturas.mjs --url …` → `tests/capturas/sincronizacion/`.

**Signed automatic updates** (0.12, `instalador.svelte.ts`, pure parts in `actualizador.ts`; Windows and macOS only).
`tauri-plugin-updater` 2 + `tauri-plugin-process` 2 (desktop-only Rust dependencies, capability
`capabilities/escritorio.json`: exactly `updater:allow-check`, `updater:allow-download`, `updater:allow-install`,
`process:allow-restart`). `tauri.conf.json plugins.updater`: `endpoints`
[`https://github.com/Metalaria/electronica-app/releases/latest/download/latest.json`], `pubkey` (base64 of the minisign
`.pub`; placeholder `CLAVE-PUBLICA-PENDIENTE…` until the owner pastes his), `requireSignedVersion: true`,
`windows.installMode: "passive"`. Available (`actualizadorDisponible`) when the bridge exists (Tauri, or the tests'
`globalThis.__epaPuenteActualizador {clave?, comprobar(), reiniciar()}`), the user agent is Windows or macOS
(`sistemaActualizable`), and the build-time key (vite `define __CLAVE_ACTUALIZADOR__`) decodes like the plugin does
(`claveActualizadorValida`: second line → 42 bytes, «Ed»). States `instalador.estado`: inactivo → buscando →
disponible | al-dia | error; disponible → descargando (`descargado`/`total` from the `Started`/`Progress` events;
«Cancelar» → disponible, later events of that download ignored by a generation counter) → (macOS: instalando,
`install()` replaces the .app) → listo → «Reiniciar para terminar»: `guardarTodoAntesDeSalir()` (`almacen.ts`:
dispatches `pagehide` and `epa:antes-de-sincronizar`, waits 300 ms, then `store.save()`), then Windows `install()`
(runs the NSIS installer with `/P /R` and ends the process) or macOS `relaunch()`. The download gets
`{timeout: DESCARGA_MAXIMA}` (15 min, the plugin's reqwest timeout, body included) and a watchdog: no `Progress` for
`ESPERA_DESCARGA` (60 s; tests: `globalThis.__epaEsperaDescarga`) → error «La descarga se ha detenido…», the Update
dropped (closed when the abandoned download settles), «Volver a intentarlo» checks again. «Cancelar» also drops the
Update and checks again at once (a new Update for the next «Descargar e instalar»): an Update object is never shared
between an abandoned download and a new one, because `close()` frees its Rust resource and a later `install` would
fail with «The resource id N is invalid» (an abandoned download that settles closes its own Update only if it is not
the current one). Windows, installer that
cannot be started: before `install()` (store alive) the attempt is recorded (`intento` {version, t} in
`actualizador.json` and `localStorage epa-actualizador:intento`; at start-up a mark for a version newer than
`VERSION_APP` means it did not install → a one-time notice; same or older → it worked, cleared silently), and the
reader's store is saved once more right before `install()`. If install() fails, the plugin has already run its
`on_before_exit` hook (`AppHandle::cleanup_before_exit`: window
hidden, resources — the store, the single-instance lock — released), so the app writes the reason
(`localStorage epa-actualizador:fallo` and the small store `actualizador.json` {fallo: {version, error, t}}) and
relaunches; `recuperarFalloDeInstalacion()` (Avisos, at start-up, marks under a day old, once) shows it as an error
that automatic checks do not replace. The hook itself is the plugin's (set in its `updater_builder`, used by its
`install` command); replacing it would mean re-implementing that command, signature check included, so it stays.
The check follows the release check when it finds a newer version (start-up: silent) or when asked (errors explained,
`explicarErrorActualizador`); nothing is downloaded without «Descargar e instalar». UI: `BotonesInstalador.svelte` in
the notice (only for the announced version), «Aa» and `#/sincronizacion`.
The build jobs never see the signing key (third-party code runs there: vite plugins, crates' build.rs, npm scripts);
`npm ci --ignore-scripts` (the lockfile's only install scripts are fsevents'). Windows/macOS: `tauri build --no-bundle`,
a pristine copy of the binary in `$RUNNER_TEMP`, then `tauri bundle` in a retry loop that restores that copy, deletes
`bundle/` and checks `grep -ac __TAURI_BUNDLE_TYPE_VAR_UNK` before each attempt (tauri-bundler 2.10.3 patches the
bundle type into the binary in place and restores it only when that package succeeds: a retry after a failure would
ship an .msi whose binary says nsis). macOS also writes `Electronica-X.Y.Z-macos-universal.app.tar.gz` (Python tarfile,
GNU headers: first component `<app>.app`, symlinks kept, no extended attributes — the layout of tauri-bundler's
`updater_bundle.rs create_tar`; the step fails if the .app has a hard link, which tarfile would store as a link entry
the updater's tar 0.4 cannot unpack). Windows and macOS export the SHA-256 of `…-setup.exe`, `….msi` and `….app.tar.gz`
as job outputs (`sha256_exe`, `sha256_msi`, `sha256_tgz`). Job «firmar» (tags only, `environment: firma`, needs
borrador/windows/macos/android — every job that runs third-party code with a write token has finished — and checks
each downloaded artifact with `sha256sum -c -` against those outputs before signing): sparse
checkout of `actualizador.mjs`, `tauri.conf.json` and `web/package-lock.json`; `npm install --prefix $RUNNER_TEMP/tauri-cli
--ignore-scripts @tauri-apps/cli@<lockfile version>` and `actualizador.mjs cli` (version and integrity of the installed
packages = the lockfile's); downloads the three artifacts from the draft; `actualizador.mjs firmar` signs each with
`tauri signer sign --app-version X.Y.Z` (trusted comment `version:` like createUpdaterArtifacts, required by
`requireSignedVersion`) and verifies it; uploads the `.sig` files and `SHA256SUMS-firmas.txt`. A manual run on a tag
ref behaves like the tag build (key, strict). Actions are still referenced by tag: pinning them by SHA is a TODO
(README).
CI (`web/scripts/actualizador.mjs`, `.github/workflows/compilar.yml`): workflow env `EPA_ESTRICTO` = 1 on tags unless
`vars.EPA_PERMITIR_SIN_ACTUALIZADOR` is 1. `exigir` (job «borrador», `environment: firma`, before the draft: placeholder
public key or `HAY_CLAVE != true` → error), `firmar` (job «firmar»: missing secret, invalid public key, missing
artifact, failed or unverifiable signature → error when strict, warning otherwise), `verificar` (a `.sig` against its
asset: Ed25519 over BLAKE2b-512, the global signature over the trusted comment, `version:` = the tag), `manifiesto`
(publish job: `latest.json` {version, notes, pub_date, platforms: `windows-x86_64-nsis` →
`Electronica-X.Y.Z-windows-x64-setup.exe`, `windows-x86_64-msi` → `.msi`, `windows-x86_64` → the NSIS only when both
Windows signatures exist, `darwin-aarch64`/`darwin-x86_64` → `Electronica-X.Y.Z-macos-universal.app.tar.gz`; each {url,
signature = the .sig text}}, only signatures of this version and key; strict: a missing platform → error, nothing
published; uploaded while the release is a draft; the `.sig` count comes from `gh … --jq` — never `| grep -q` under
`pipefail`). Checkouts with `persist-credentials: false`. Tests: `tests/actualizador-ci.spec.ts` (the «firmar» and
publish steps' scripts run with bash and a fake `gh`, real `tauri signer` keys; the Windows build/bundle steps with a
fake npm that patches the binary like the bundler; the macOS tar snippet on a test .app), `tests/actualizador12.spec.ts`,
`tests/revision12p-descarga.spec.ts`.

**Single instance** (0.12, desktop): `tauri-plugin-single-instance` 2, registered first in `lib.rs` under
`#[cfg(desktop)]`; a second launch exits and the running one un-minimises, shows and focuses window `main`. Its lock
lives in the resources table, which `restart()` clears before relaunching, so the updater's relaunch is not taken for
a second instance.

**Backup file** (0.12, all platforms, for the data agent's export/import, `web/src/lib/sincronizacion/fichero.ts`):
the app's own commands `guardar_fichero_elegido {nombre, texto} → bool` and `abrir_fichero_elegido → {nombre, texto} |
null` (`src-tauri/src/lib.rs`, module `fichero`) show the dialog (`tauri-plugin-dialog` blocking API on a blocking
thread, `.json` filter on desktop only) and write or read the chosen file in Rust through `tauri-plugin-fs`'s
`Fs::open` (a path on desktop; on Android a `content://` URI opened through the content resolver); reading is capped
at 50 MB and must be UTF-8. No capability grants `dialog:*` or `fs:*`: tauri-plugin-fs 2.7.1's `resolve_file`
(commands.rs) opens any URL (`file://`, and on Android `content://`) without checking its scope, so a webview with
`fs:allow-write-text-file` could write anywhere; the path now never comes from the webview. Residual: none from the
webview side; the dialog and fs plugins stay registered for Rust only. `fichero.ts noDisponible` falls back (Blob
download / `<input type=file>`) only on Tauri's own rejection of these two commands (`^Command … not (found|allowed
by ACL)`), never on an error of the file itself; on Android, where the WebView ignores a Blob download, a missing
command is an error, never «descargado». 1.0 (modo docente PDF): `guardar_fichero_elegido` takes two optional arguments,
`base64: bool` (`texto` is base64 of binary content, decoded with the `base64` crate; the 50 MB cap applies to the
decoded bytes, checked on the encoded length first) and `filtro: [name, [extensions]]` (the dialog's filter on desktop,
and on Android the create-document picker's MIME type, which the dialog plugin derives from the extension); without
them it is exactly the 0.12 call. The path still comes only from the dialog. `fichero.ts guardarBinario`/`aBase64`;
test in `tests/actualizador-ci.spec.ts`, Rust unit test `pruebas::texto_tal_cual_y_base64_decodificado`. Desktop dialogs get the main window as parent (`set_parent`: modal). The
returned `nombre` is empty for an Android `content://` URI (its last segment is a document id, and neither plugin
exposes the provider's display name): the import heading then says «Importar la copia elegida». `CopiaSeguridad.svelte
elegir()` is busy while the picker is open (no second picker).

**Confirmations** (0.12, `src/lib/confirmar.ts` + `src/componentes/Confirmacion.svelte`): `await confirmar({titulo,
mensaje?, aceptar, cancelar?})` → true only for the destructive button. Used by the breadboard's «Borrar» and the
editor's «Nuevo» over an unsaved circuit. Not window.confirm: on desktop tauri-plugin-dialog's init script replaces it
with an async function (a Promise, always truthy: the action ran without asking), wry's WKWebView has no confirm
delegate (macOS answered «no»: «Borrar» did nothing in 0.11), and on Android wry's RustWebChromeClient shows a native
box with English «OK»/«Cancel». role=alertdialog, aria-modal, the rest of `body` inert, focus on «Cancelar», Tab
cycles inside, Escape or a click outside cancels (only a press that also began on the backdrop, and not in the first
300 ms: a double click on the trigger does not cancel), focus back to the trigger; while open, a window capture-phase
guard stops every keydown/keyup/keypress (`inert` does not stop keys reaching window listeners: the editor's Supr, «g»,
Ctrl+Z, Ctrl+S…), handling Escape and Tab itself; Enter/Space still activate the focused button; a route change
(`hashchange`/`popstate`, e.g. Android's back button) answers «Cancelar» and closes it, 44 px on coarse pointers, destructive
button in `--c-precaucion` with `--superficie` text. `tests/actualizador-ci.spec.ts` fails if `alert(`, `confirm(`
or `prompt(` appears in `web/src` (ngspice*.js aside). Tests: `tests/confirmacion12.spec.ts`,
`tests/revision12q-confirmar.spec.ts` (with the plugin's real init script injected).

## Data 1.0: stable format, migrations, the transition from 0.12, one active tab

Owner's decisions for 1.0: compatibility with 0.10/0.11 CLIENTS is dropped (their data still upgrade, through 0.12's
rules); a stable data format with tested migrations; one active browser tab at a time.

**Schema versions and the migration registry** (`lib/esquemas.ts`, pure; `lib/migrar.ts`, the runner). `ESQUEMAS`:
the schema version of EVERY key the app stores (1 = the shape 0.12.0 stores and reads; `progreso-diario` 2; the
teacher mode's `docente` and `docente-resultados` 1; `ejercicios` 2 since review 10a); the versions stored are in the key `esquemas` {formato:
'epa-esquemas', app, almacenes: {key: n}, retenida?} (absent: data of 0.12 or older — or a `lector.json` copied from
an older device —, every key at 1; never synchronised nor exported). `MIGRACIONES`: ONE ordered list, each step
{clave, de, formato, descripcion, local(valor), coleccion?(c)} — pure (no clock, no device: every device writes the
same value, nothing is sent twice), idempotent (a start cut after the data but before the versions runs it again on
its own output), total on well-formed data (damaged items are left as they are; the module's reader drops them).
`formato` is the version of the file formats (`FORMATO_DATOS` = 2) that introduced it: a synchronisation file or a
backup of an older format gets every later step's `coleccion` (`migrarColecciones`, items keep their time when their
value is unchanged, new values are dated with their own time). Steps so far: `progreso-diario` 1 → 2, `absorberLegado` (see
«Daily progress», 1.0), and `ejercicios` 1 → 2 (each answer's time in `vt`, from the item's `t` where missing). To add one: bump the key in `ESQUEMAS`, add the step with a test from
real fixtures (`tests/actualizacion`), and bump `FORMATO_DATOS` when the store is synchronised (older apps then refuse
the new file instead of writing their old shape over it). Keys the registry does not list are left alone.
`migrarAlmacen(a)` runs inside `lib/almacen.ts obtenerAlmacen()` (after the active-tab gate, before the storage is
handed to ANY module, so nothing reads a key before it is migrated): for each key with steps due, read and migrate in
memory; a step that throws leaves that key untouched and BLOCKED for the session (`bloqueadas`: lib/almacen.ts refuses
its writes, so no module writes this version's shape over data it could not read as such; its version stays, the next
start retries), the other keys migrate. Before anything is written, the ORIGINAL values of the keys that change are
stored once — the backup of 0.12's «Sustituir todo» reused (`sincronizacion/copia-guardada.ts`, slot
`copia-migracion`: IndexedDB `epa-copias`, Tauri's `copia-automatica.json` key `migracion`, else an almacen key) as
{formato: 'epa-copia-migracion', version: 1, app, t, esquemas (before), hacia, claves: {key: original}}; a backup with
the same `hacia` is never replaced (it holds the first original); no backup stored → nothing migrated (keys blocked).
Then the values, then the versions (`guardarYa`). A key whose stored version is above this app's (data of a newer
version: the reader went back) is left alone and blocked («actualice la aplicación»). `restaurarDatosAnteriores()`
(«Restaurarlos…», after the app's confirmation): every write refused from then on, the backup's values written back,
their old versions stored with `retenida` = this app version (this version does not migrate them again and blocks
them; the older app reads them; a later version migrates afresh), the page reloads. UI
(`componentes/sincronizacion/AvisoDatos.svelte`): mounted by `Arranque.svelte` when the migration left something
undone — `role="alert"`, «Algunos datos no se han actualizado a esta versión», the stores by name, «Guardar los datos
originales» (the backup plus the blocked keys' stored values, as a file: `fichero.ts guardarFichero`) —, and on
`#/sincronizacion` (`pagina`) «Datos anteriores a la actualización» with «Guardarlos en un fichero» and «Restaurarlos…».
Test hook: `globalThis.__epaFallarMigracion = [keys]` makes those steps throw.

**1.2: the ids of book 4.1** (`FORMATO_DATOS` 3, `VERSION_MINIMA_DATOS` '1.2.0'). One step per key that can hold an id of
the two chapters new in 4.0 (`posiciones` 1→2, `marcadores` 1→2, `notas` 1→2, `ejercicios` 2→3, `leidas`, `deducciones`,
`calc-favoritos`, `repaso-tarjetas`, `repaso-tests`, `repaso-fallos`, `repaso-examenes`, `lecciones`, `progreso-diario`
2→3, `progreso-xp`, `cursos`, `dominio`, `problema-dia`, `seguridad`, `editor-circuitos`, `protoboard-circuitos`,
`protoboard-leccion`, `docente`, `docente-resultados`, `sinc-estado`, `sinc-marcas`, `sinc-aplicados`, `sinc-enviado`
1→2), all `renombrarIds41`: every object key and every id-like string (no white space, so never a note's text) through
`renombrar41` — part `cap-new-automatas` → `cap55` (`cap-new-maquinas` → `cap56`, also inside `cap55/…`, `cap55-pred-…`,
`l:cap55/…`), labels `sec|fig|ej|prob|tab-new-automatas.N` → `…-55.N`, review questions `cap-new-automatas-N` →
`cap55-0N`; where a LABEL is stored (keys and `label` of bookmarks and notes, `sec` of a reading position) the chapter's
own label goes to `cap-55`. Two keys meeting (old and new id of one item): the one already new stays unless the other has
a strictly larger `t`. `sinc-marcas` also drops the `huellas` of renamed items (their value changed with the ids; a mark
must still count as a change). Collection-only steps (no version of their own) for the synchronised stores whose name is
not a storage key: `progreso-logros`, `cursos-superadas`, `cursos-pruebas`, `docente-propios`. The same rules in Python,
`contenido/ids41.py` (the app's sources: `ids_practica.json`); checked against the book's `Informes/ids_4.1.json` and
against a profile of 1.1 (`tests/fixtures/perfil-11-capitulos-nuevos.json`) in `tests/sync41-unidad.spec.ts`. A 1.1
device refuses the format-3 file («actualice la aplicación»): update every device, synchronising each right before.

**Format 2 of the synchronisation file and of the backups** (`fusion.ts VERSION_DOC`, `copia-formato.ts VERSION_COPIA`,
both `FORMATO_DATOS`). The same document; its stores in the 1.0 schemas. `leerDoc` reads version 1 by migrating its
collections (a failed step: the run stops, nothing written from a half-migrated file) and refuses versions above 2
(«…tiene la versión N del formato; actualice la aplicación»). A file read from version 1 is written back as 2 even
with nothing new (`migradoDe`, a WeakMap: never a field of the file) — the file changes format at the FIRST 1.0 run.
Every device entry written by 1.0 carries `datos: 2` (`Dispositivo.datos`, kept by `dispositivosValidos`). `leerCopia`
reads backups and synchronisation files of format 1 through the same migrations and refuses newer ones. Contract: any
new field that must survive a round trip through an older 1.x needs a format bump (`leerDoc` keeps known fields only).

**Transition from 0.12** (the owner's devices update one by one: desktop through the updater, Android by hand). Design:
the SAME path and a new format version, because 0.12.0 cannot write over it — checked by running 0.12.0's own engine,
taken from git: its `leerDoc` throws on any version above 1, `ejecutarSolo` turns that into a non-transient error
(«El fichero … no se puede usar: el fichero tiene la versión 2 del formato; actualice la aplicación. No se ha
modificado; …») shown even after automatic runs, BEFORE any PUT; after a 409 it reads the file again and stops the
same way; its backup import refuses format 2 («La copia se hizo con una versión más nueva…»). So a 0.12 device never
writes the 1.0 file (no loss, no corruption, no store dropped — also those it does not know, like the teacher mode's);
what it changes meanwhile waits in its storage, marked, and is sent by its first run once updated (its storage
migrated at start-up). 1.0 reads a file 0.12 wrote (format 1) by migrating it. A new path was considered and rejected:
0.12 devices would keep syncing among themselves and 1.0 would have to bridge two files both ways; the version bump
gives one history and a single rule. The Sincronización page names every device of the file without `datos ≥ 2`
(«Falta por actualizar: «Tableta» (versión 0.12.0)…», `data-pendientes`), says their changes wait on them, and warns
not to delete the file although 0.12's message suggests it (a deleted file is a new history: what was deleted
elsewhere could come back). Going back to 0.12 on a device (`tests/actualizacion`, `t10·3`): 0.12 reads 1.0's local
data as 1.0 does (the migrated daily progress has no excess for 0.12 to add: every summary is dated as its newest
record), and its runs are refused; updated again, `esquemas` says «migrated»: nothing migrated twice.

**What was removed with the 0.10/0.11 compatibility, and what was kept** (task B). Removed: the legacy excess of the
daily progress and its absorption at every change and merge, the d12d·3 under-count and the trial-71031 guard (see
«Daily progress», 1.0); the 0.10 engine from the randomized simulation (`azar.ts`: a device on 0.12.0 updated
half-way instead) and the scenarios `r3·5` (going back to 0.10, rewritten for 0.12) and `d12·4` (a 0.11 device adding
on top, removed). Kept on purpose — no real complexity or risk would go with them, and changing a stored shape needs a
migration of its own: `sinc-estado`'s separate `borrados` field (0.11's way to keep «-» away from an 0.10 engine:
harmless), `sinc-enviado` as its own key, the repaso day's r/n/b counters with the undo counters dr/dn/db and their
larger-per-field merge (a per-device record would be exact but is a new design, not a simplification — the only cost
of 0.11's constraint is counting short when two devices answer the same day), the records' `cumplido: false`. Every
protection of 0.12 between tabs (`propios`, the truce, `reponerMias`, the compare-and-set write, `sinc-aplicados`, the
per-tab record id and its lock), the prune horizon, the marks and the cut-run record stay: with one active tab (below)
two tabs no longer write at once, but they are cheap and remain the defence for a tab that comes back from a freeze,
for the browser automation suites (no gate) and for anything that bypasses the gate.

**Review 10a (round 1).** (1) A newer reset no longer drops the answers another device typed AFTER it without having
seen it (a key whose time is later than the reset's `r` is kept; counters and flags stay the reset's), `r10a·1`;
(2) a key without `vt` (written by 0.12) counts from its item's `t`, never 0, and every merged key gets its time —
plus the schema migration `ejercicios` 1 → 2 that fills the missing `vt` from `t` (local data, files and backups of
format 1), so that once migrated a later change of another key made on 1.0 cannot make an old text pass for new,
`r10a·2`/`r10a·2b`. **Transition limit (review 10b, documented, not fixed):** 0.12 keeps no time per field, so an
exercise changed on a device still on 0.12 AFTER another device changed it on 1.0 gives, at that device's update,
the item's time to EVERY field: a field it did not touch passes for newer — an older «texto» replaces the 1.0 one
(`r10b·1`), and an answer from before a 1.0 reset comes back (`r10b·2`). No rule tells them apart without losing the
0.12 device's real edits (`r10a·2`); `tests/motor-real/revision10b.ts` asserts this behaviour so a change is noticed.
Avoided by synchronising each device right before updating it and not editing exercises on a 0.12 device once
another runs 1.0 (README «Paso a la 1.0»); review 10b also: the union stores every key's time in `vt`, 0 included (a dropped 0 became
the item's `t` in the next merge: not associative), and normalises `bien` in the reset branch too; the pre-migration
backup is never replaced wholesale — per key being migrated, an original of these very data is kept, a missing one
ADDED (a first start cut between two keys lost the first key's original, `r10b·3`), one of other data replaced; the
notice's «Guardar los datos originales» takes, for a key left as it was, what is stored now over an older backup; an
exam whose attempt was already handed in (its draft's removal failed) is not taken up again — the draft goes and the
result, or the exam when the result was deleted, is shown — and `guardarResultado` never replaces a deleted result;
the minutes shown of an exam whose time ran out are capped to its limit. (3) the exam
in a paused tab (teacher mode: `HacerExamen.svelte`, `lib/docente/estado.svelte.ts`, `componentes/docente/borrador.ts`)
is never handed in while `escrituraPermitida()` is false, `guardarResultado` rejects on a failed write (it swallowed
it), the draft is removed only after the result is stored and only by the active tab, `r10a·4` and
`datos10-pestanas.spec.ts` «examen con tiempo…» (handed in from the draft when the tab is used again); (low) blocked
keys are left out of the synchronisation, its application and the backups (`sincronizar.svelte.ts activos`,
`Sincronizable.claveAlmacen`; their records and marks kept), the pre-migration backup is kept only if it is the
backup of the data stored now (else replaced), and the README warns that going back to 0.12 is only possible on
desktop and that deleting the file or changing its path splits the history. Performance (found by the performance agent, a
3-year store's first start at CPU × 4: 2,5 s in `marcas.ts quitarHuella`): the emptiness check of a store's marks at
every mark (`Object.keys(o).length`; a `for…in` is no better on an object in dictionary mode) made thousands of marks
quadratic; empty stores are now dropped once per write (`limpiar`), `t10·12` (16 000 marks: 34 s → linear).

**The exercises' merge** (`lib/union-ejercicios.ts`, 1.0, store `ejercicios` `unir` and its Guardado's): before, one
last-write-wins item per exercise — the answers typed on one device were lost when another device changed the same
exercise before synchronising. Now: `r` (reset epoch: «Reiniciar» writes an empty state with r = now instead of
deleting the item, `aprendizaje.svelte.ts reiniciarEjercicio`) — the larger `r` wins, and of the other side (which
had not seen that reset) only what is after it comes in (`proyectar`): its answers typed after it and — when its `t`
is after it, i.e. a real attempt was made after the reset (since review 10g only «Comprobar» and «¿Lo tenía bien?»
move `t`) — that attempt: its `resuelto`, `bien` and other whole-item fields, and one attempt (review 10i, r10i·1:
solved after a reset on another device, it came back as never tried, with the ✓ of its answer; scenarios `t10·13`,
`t10·14`). Its failures, hints, solution and attempts before the reset stay reset — nothing tells them apart from those
after it, so after the reset that device's failures and hints are not counted (a union with the older life would
bring its attempts back, the lesson of 0.12's «Reiniciar tarjetas»). The projection is a homomorphism of the merge of
one epoch, and projecting twice is projecting onto the later reset, so the merge stays associative also with several
resets (5000 random triples in `datos10.spec.ts`, every order of 4 versions in `revision10b-union.spec.ts`); `valores` key by key by `vt[key]` (the
time each field was typed; ties: the larger text) — answers in different fields both survive, the same field keeps the
newer text; `intentos`/`fallos`/`pistas` the larger, `solucion` either; `resuelto` and `tapada` (review 10j) by their
own keys of `valores`, `_r` and `_o`, merged as above and the fields derived from them: `_r` is written only by the
events that decide it — the check that solves it and the self-assessment «Sí»/«No» — so a later FAILED check on a
device that had not received the solve no longer un-solves it (r10j·2; locally a failed check never undoes it), and a
later «No» still does; `_o` by «Ocultar/Ver solución», which does not move `t` and so lost even to the device's own
older copy in the file (r10j·1). An item without the key (0.12, 1.0 before 10j) has it at its own `t` when `resuelto`
is true / `tapada` is set (`conMarcas`): a function of the item alone and the identity on merged items, so the merge
stays associative. `_r` keeps the solving device's counters (`"1|i|f|p|s"`): after a reset it had not seen, the merge
keeps one attempt of it and none of its hints or solution, and `ayudaAlResolver` (XP reconciliation, mastery, the
summary) judges by at least those — never more generous than the device that solved it (t10·18). `bien` (the answers
right at the last attempt — a union before review 10i, which kept the ✓ of an earlier attempt) and any other field
from the newer version as a whole; `t` the larger. Readers (review 10j, r10j·3): «fallado» = not solved and with an
attempt or a failure (`estadoEjercicio`) — the merge leaves an attempt after an unseen reset as one attempt with no
failures. Known limits: the counters after an unseen reset are those of the reset's side plus one attempt (only the
judgement of a solve carries more); the ✓ of a part checked on one device does not come back after another device's
newer check of another part (no value is lost: «Comprobar» again shows it); clock skew between devices decides what
is «after» a reset or the newer «Ocultar/Ver». Ordered by (t, canonical text of the non-merged fields) so it is associative; commutative, associative and
idempotent on 5000 random triples (`datos10.spec.ts`); `t10·7` (different fields on two devices), `t10·8` (a reset
against a device's older attempts; fails without the `r` rule), `t10·15`–`t10·18` (review 10j: a solve against later
failed partial checks on two stale devices; the self-assessment both ways; «Ocultar/Ver» on two devices and over a
0.12 item; the XP after an unseen reset), `tests/revision10j-union.spec.ts` (20 000 triples and every fold of 4 with
the reviewer's generator) and the models of `datos10.spec.ts` and `revision10b-union.spec.ts` with `_r`/`_o`.

**One active tab** (`lib/pestana-activa.ts`, browser only). `obtenerAlmacen` waits for `esperarPestanaActiva()`: a tab
opened while another is active shows «La aplicación está abierta en otra pestaña» (role=dialog, aria-modal, `#app`
inert, focus on «Usar aquí», 44 px) and reads nothing. «Usar aquí»: BroadcastChannel `epa-activa` `pedir` → the
active tab shows «Esta pestaña está en pausa», lets a synchronisation run in progress finish
(`registrarAntesDeCeder`, sincronizar.svelte.ts), writes everything pending (`almacen.ts volcarTodo` + `guardarYa`),
stops writing (`escrituraPermitida()` false: lib/almacen.ts refuses every write, `sincronizar` starts no run) and only
then releases the Web Lock `epa-activa`, held for its whole life; the asking tab gets the lock and loads. A paused
tab's «Usar aquí» takes it back the same way and reloads (its memory may be older than what the other tab stored; its
unload flushes are refused). A closed or crashed tab: the browser releases its lock, «Usar aquí» is immediate. A frozen
tab (hung script): after `ESPERA_CEDER` (4 s) «La otra pestaña no responde» with «Usar aquí de todos modos»
(`steal`): that tab learns it from the lock's rejection and `robada`, and pauses; what it had not written stays
unwritten. Those are tasks that may run AFTER its own timers due during the hang, and they write — found by
`datos10-pestanas.spec.ts` «se cuelga» (a learning module's write landed right after the thaw; then, once that was
closed, 2 of 16 runs: the old `pedir` handled at the thaw made it hand over and FLUSH while the other tab already held
the lock). So: the active tab keeps a pulse (every 250 ms); a write when the pulse is older than 1,5 s (the event loop
was blocked, or the timers throttled in a background tab) first awaits a lock query — is `epa-activa` still held by
this page's client? (a per-page lock `epa-yo:<id>` gives the client id) — and is refused if not (delayed, never
refused, when it is: a false alarm costs a millisecond); the pulse that finds a gap starts the same check instead of
hiding it; and `ceder` checks it before flushing. During `pagehide` nothing waits. 20 of 20 runs after the fix.
Two tabs asking at once: one ends active (never two); a request still queued when another tab announces `activa` is
withdrawn (else the lock would reach it later on its own, when that tab hands over to a third one). Request and
activation are ordered by their times (`pedir` carries `t`, the time of the request; `activa` carries `t`, the time
the tab became active; `Date.now()`, the same comparison on both sides): a request made before the tab became active
was answered by that tab's win — the asking tab withdraws it — so the active tab does NOT hand over when it handles
it only later (a busy tab handles its messages late); a request made after the activation is a real one — the active
tab hands over and the asking tab keeps waiting even if it hears that `activa` late. Before (full 1.0 suite under load,
`datos10-pestanas.spec.ts` «dos pestañas piden a la vez»: 0 active tabs for 20 s): the winner handed over on the late
`pedir` of a tab that had already withdrawn, and the lock stayed free with every tab paused or waiting; test «la
petición … que llega tarde» holds the channel's messages back to make that order certain. A `pedir` without `t`
(heartbeats, no Web Locks) hands over as before. Reload of the
active tab: the new page may find the old document's lock not yet released; with no tab answering `quien` it waits
up to `ESPERA_PROPIA` (2,5 s). Back/forward cache: on `pageshow` (persisted) the page is still active only if
`epa-activa` is held by its own client (a per-page lock `epa-yo:<id>` tells the client id), else it pauses. Without
Web Locks: `latido` every second on the channel; a new tab that hears none in 1,5 s becomes active; two active tabs
keep the one that became active last (`epoca`), the other cedes (flushing first; the beats go on while it hands
over). Without BroadcastChannel either: no gate. Why the write check is a synchronous flag and not a lock query:
during `pagehide` no later task runs, and the flush of a closing page would be lost (0.12's finding about a Web Lock in
the Guardado). Under automation (`navigator.webdriver`: every Playwright suite, several of which open two pages of
one context on purpose) there is no gate unless the page sets `window.__epaPestanaUnica`; `__epaVariasPestanas` turns
it off anywhere; `__epaEsperasPestana` shortens the waits; `__epaEstadoPestana()` and `__epaActivaDesde` are for the
tests. Tauri (one window) and the Node harnesses (no DOM) have no gate.

**Tests (1.0).** `tests/datos10.spec.ts` (`playwright.datos10.config.ts`, port 4601, build `/tmp/claude-0/epa-datos10/
dist`): the registry, `migrarAlmacen` on a memory storage (backup once, idempotent, a failing step, no room for the
backup, data of a newer version, the restore), `leerDoc`/`leerCopia` of format 1 and 3, the exercises' merge (5000
triples), the real engine's `t10·1–11` (`tests/motor-real/escenarios10.ts`; the 0.12.0 engine and modules from git:
`tests/fuentes-viejas.ts`, `arnes.ts` version '0.12' — '0.11' in the harness means «this tree» —, `cambiarVersion(d,
'0.11')` migrates the device's storage first, `nuevoDisp(…, {guardado})` too), 2 × 40 random trials (`azar.ts`: W on
0.12.0 updated at a random step; checks that it never writes a format-2 file and that its refused runs are counted,
`rechazos012`), and in the browser the notice of a failed migration (original untouched, download), «Datos anteriores
a la actualización» and its restore, the devices still to update. `t10·10`: 2000 random day maps — the migrated
total equals 0.12.0's `totalDia` from git, also in a file's collection. `tests/datos10-pestanas.spec.ts`: two and three
real Chromium pages (writes of `epa:*` logged per page in sessionStorage with the time): the screens and focus, the
hand-over with a pending write, six hand-overs among three tabs with continuous activity (no step lost; every write
inside its tab's turn), a frozen tab, a tab closed without its unload handlers, reloads, back/forward, no Web Locks,
axe and 360 px in three themes. `tests/actualizacion/escenario.ts [tauri] [0.11.0|0.10.1]` (default 0.12.0): see its
header — the upgrade from real 0.12.0 fixtures, from 0.11.0/0.10.1 data (as they are and after a 0.12 session), two
devices across the update, the refused old device, the back-out. Changed tests (0.10/0.11 compatibility encoded,
removed on purpose): `r3·5` (back to 0.10 → back to 0.12), `d12·4` (removed), `d12·3` and the browser's «día de la
0.11» (the migration now writes «<day>@0» at load), `c12·7` (format 2), d12d·3 (no longer an expected failure: the
summary written on top is not read), the pure checks of the excess in `datos12.spec.ts` (run on the migrated map),
`revision11-actualizacion.spec.ts` (0.12.0, 0.11.0 and 0.10.1 → 1.0) and the random simulation's 0.10 device. The
trial numbers of 0.12's findings (9138, 71031…) no longer reproduce their 0.12 sequences (the 0.10 device is gone);
`b12·4` and `b12·22` still run those trials as random trials.

## List thumbnails (0.10, `web/src/componentes/miniaturas/`, data in `web/public/miniaturas/`)

Pre-rendered by `web/scripts/miniaturas.mjs` (called by `contenido/generar.py` with `--esquemas --figuras`):
- `esquemas/<parte>.json` `{ version: 1, esquemas: { <netlist name>: [w, h, wires, strokes, inkFills, bgFills] } }`:
  `esquema-auto/miniatura.ts` (`trazosMiniatura`) reduces the automatic schematic (same layout as the app: precalculado
  seeds, `aspecto` 1.8) to four path strings on an integer grid of 10 units per pin pitch, relative commands, no text,
  no ± signs, bounds of what is drawn (the sheet's bounds include the labels). ≈ 1,4 kB per netlist.
- `indice.json` `{ version: 1, w: 192, h: 144, figuras: { <label>: "fig/<n>" | "img/<n>" } }`: for each `h2` section
  of `busqueda.json` its first figure up to the next `h2` (inside boxes, as the reference preview), and for each item
  of `ejercicios.json` a figure inside its statement (`pos` range) or else the first `data-ref="fig-…"` it links to.
- `fig/<n>.webp`, `img/<n>.webp`: those figures fitted in 192 × 144 (drawn at 2× and halved, WebP 0.8, transparent;
  the page puts them on `--placa` with `--placa-filtro`). Redone when the source is newer.
- `3d/<tipo>.webp`: every model of `MODELOS_3D` at its defaults and catalogue mounting, 384 × 288, transparent
  background (`tres/miniaturas.ts` with `fondo: null`: no scene background, clear alpha 0, shadow opacity 0,4), so
  one image serves every theme over the card's `--fondo-3d`.

Runtime: `visible.ts` (one IntersectionObserver per scroll root and margin, 240 px; the root is the nearest
`[data-miniaturas-raiz]` ancestor, e.g. the search panel, else the viewport; the callback runs once),
`datos.ts` (the index and each chapter file fetched once per session; synchronous lookups so a list redrawn by a
filter does not flash), `MiniaturaEsquema.svelte` (`id` = netlist id, or `dibujo` = the paths themselves),
`MiniaturaFigura.svelte` (`<img loading="lazy" decoding="async">`, src set only when seen), `MiniaturaLibro.svelte`
(label → figure, else `spice.porRef[label][0]`'s schematic, else the glossary symbol of `glosario/simbolo.ts`, else
`Hueco.svelte`), all fixed boxes sized by `--mini-w`/`--mini-h` (`--mini-fondo`, `--mini-radio`), with
`data-miniatura` (`esquema | figura | simbolo | libro | modelo`) and `data-estado` (`espera | lista | hueco`).
Used by `simulador/Indice.svelte`, `BotonSimular.svelte`, `Busqueda.svelte`, `aprender/PaginaEjercicios.svelte`,
`tres/Catalogo3D.svelte` (a card's image is requested when it is about to be seen; a missing file falls back to
`tres/miniaturas.ts`, the shared off-screen renderer, transparent too) and `animaciones/Galeria.svelte` (component
animations listed in a model's `animaciones` show that model with the animation's symbol as a badge).
The reader's own drawings are made on the device, cached per saved item and its `actualizado` (redrawn only after
a save): «Mis circuitos» (`editor/MisCircuitos.svelte`) uses `editor/miniatura.ts` (`miniaturaCircuito`: the
editor's `geometria()` symbols, wires and `conectividad()` junctions through `Trazador`, the builder of
`esquema-auto/miniatura.ts`) with `MiniaturaEsquema dibujo=…`; «Mis montajes» (`protoboard/PaginaProtoboard.svelte`)
uses `protoboard/miniatura.ts` (`miniaturaMontaje`: `svgMontaje` without labels, viewBox cropped to the parts and
hole-to-hole jumpers — not the bench equipment nor rail-to-rail jumpers — at the box's aspect, as an SVG data URL)
with `MiniaturaFigura src=…`. Both 84 × 52.
Tests: `tests/miniaturas10.spec.ts` (`playwright.miniaturas10.config.ts`, port 4401).

## QA harness (0.11, `web/tests/qa/`, `web/playwright.qa.config.ts`)

A systematic sweep of the whole app that collects findings instead of failing (a test fails only when the harness
itself breaks). Own port (4421) and build folder (`<tmp>/epa-dist-qa11`); Chromium only (SwiftShader).

- `perfiles.ts`: the three Playwright projects. `tableta` (the owner's Xiaomi Pad 6: 800×1280 CSS px, DPR 2.5,
  Android WebView UA, touch, light theme, every route), `telefono` (412×915, DPR 2.6, touch, dark theme, a 25 %
  sample), `escritorio` (1366×900, light, a 25 % sample). `QA_MODO=rapido` keeps ≈ 8 % of each (deterministic:
  FNV-1a of `perfil:id`, `azarDe` in `rutas.ts`), plus every route marked `siempre` (the index page of each tool).
- `rutas.ts`: every route from the data (`Ruta { id, hash, grupo, accion?, pesada?, siempre?, completa? }`): parts,
  sections, figures (action `visor`: opens the figure viewer), one glossary entry in ten, the 313 netlists in the
  simulator and in the editor, the breadboard, instruments (12 practices, free bench, a sample of netlists on the
  bench), the FM7303 tabs, consoles × tabs (board tabs only where `PLACAS_DE` has a board), KiCad boards × `VISTAS`,
  animations, 3D models (`MODELOS_3D`), concepts, calculators (`formulas.json`), exercises, Repaso (tests and
  practice per part), diagnostics, synchronisation, and the start page's actions (`ajustes`, `buscar`, `menu`).
  `lecciones()` lists every lesson's screens with the rules of `practica/datos.ts` `pantallasLeccion`
  (steps from `calcularPasos`, practice items after their step, the Repaso questions of the section, `fin`).
- `sonda.ts` (`instalarSonda`, an init script): `window.__qa` with layout shifts (PerformanceObserver
  `layout-shift`, sources as short CSS paths), long tasks, WebGL contexts (a wrapped `getContext`: live ones in the
  document, and «orphans» — detached canvases whose context was never lost, after `gc()`), and flashes: a
  MutationObserver keeps each added element (outside SVG/canvas) with its size, position mode and the siblings that
  were already there; one removed within 1 s that was visible, in flow, and had stable siblings still in place
  (it pushed existing content) is a flash, unless it was swapped for an element of the same height in the same place
  within 50 ms (`Simular` ↔ `Detener`). `ultimaMutacion` drives the «quiet» wait.
- `comprobaciones.ts` (`comprobarPagina`, run in the page): horizontal page scroll; blank screen; text overflowing
  its content box (the text's own boxes measured with a Range over direct text and inline descendants, so
  absolutely placed pseudo-elements and hanging icons do not count; `overflow: auto/scroll`, ellipsis and
  visually-hidden text excluded) or cut at the bottom (`overflow: hidden/clip`); elements past the viewport not
  inside a sideways scroller; interactive targets covered at their centre by something of the same layer (the same
  fixed/sticky ancestor) and pairs overlapping > 25 % among reachable targets; touch targets < 40 px on touch
  profiles (inline links in running text exempt; an absolutely placed `::before/::after` with negative insets
  enlarges the target); images without width/height or aspect-ratio, and broken ones; visible text, attributes
  (`aria-label`, `title`, `placeholder`, `alt`) and field values with `NaN`, `undefined`, `null`, `[object Object]`,
  `Infinity`; English left in the UI (a list of whole UI words and English function words, outside the book's own
  text and code); buttons and links without an accessible name (`textContent` as fallback: `innerText` is empty
  inside chunks skipped by `content-visibility`); fields without a label; WCAG AA contrast of every text node's
  element against its blended ancestor backgrounds (skipped over images, gradients, filters; disabled controls
  exempt; 3:1 for large text). Findings are deduplicated by `tipo|firma` per page.
- `arnes.ts`: `Registro` (one per test: findings as JSON lines in `informe/crudo/<perfil>-<hash>.jsonl`, coverage
  counters, one compressed JPEG per new signature of the error/functional/visual kinds, at most 12 per test),
  `prepararPagina` (probe, listeners: `pageerror`, console errors and warnings minus Chromium/SwiftShader noise and
  what the current action expects, HTTP ≥ 400, failed requests except aborts, renderer crash; dialogs dismissed,
  downloads cancelled, popups closed), `esperarCalma` (no DOM change outside SVG/canvas for 500 ms and no visible
  `.cargando`/`[aria-busy=true]`), `visitar` (full load at the start of a chunk and every 25 routes, hash changes in
  between — like taps on links — then the route's action, CLS > 0.1, flashes, long tasks > 200 ms, > 2 live WebGL
  contexts, and the page checks).
- Specs: `rastreo.spec.ts` (routes in chunks of 30 per group; WebGL orphans after leaving a 3D page; memory: JS
  heap after 60 pages with `gc()`, `--js-flags=--expose-gc`, flagged above +30 MB), `barridos.spec.ts` (tablet:
  every netlist simulates or shows the «no se puede simular» notice and a second «Simular» neither flashes nor
  shifts; every lesson walked with practice items answered wrong then right — `respuestas.ts`, the DOM contract of
  `preguntas10.spec.ts` — and Repaso questions alternately right and wrong; every «Ver en protoboard» opened,
  `verificar()`, simulated from the board, closed; console and KiCad boards in 3D (`__epaPlaca3DListo`) then 2D
  (`__epaPlacaVista`) with WebGL orphans checked; calculators against the result variable's `defecto` with
  `magnitudes.comprobar` at 1 %; self-checked exercises with the book's answer texts; a HEAD request for every
  `fig/`, `img/`, `ec/` and `datos/` file the parts cite), `monos.spec.ts` (seeded mulberry32 monkey on 33
  interactive pages: taps on controls and points, drags and two-finger pinches through CDP `Input.dispatchTouchEvent`,
  typing, sliders/selects by keyboard, wheel, back/forward, rotation by swapping the viewport, Escape; steps and seed
  attached to every finding), `accesibilidad.spec.ts` (desktop: focus visible with Tab — outline, or any change of
  box-shadow, background, border, colour or underline between focused and blurred; contrast in the dark theme).
- `preparar.ts` (global set-up: empties `informe/crudo` and `capturas` unless a later shard or `QA_CONSERVAR=1`) and
  `informe.ts` (global teardown, also `node tests/qa/informe.ts`: groups by severity — `error`, `funcional`,
  `visual`, `rendimiento`, `accesibilidad`, `texto` — and signature, keeps up to 25 routes per group, merges coverage
  per profile, applies `triaje.json` (`{ patron, estado: corregido | informado | falso-positivo | decision, nota }`,
  a regex over `tipo|firma` or `tipo|msg`), and writes `informe/informe.json` and the Spanish `informe/informe.md`).
  `informe/` is git-ignored. The main configuration ignores `tests/qa/`.

`QA_INFORME=<folder>` writes the report elsewhere (a second run against another build without touching the first
one's raw findings); `QA_TRAZA=1` prints one line per route or screen.

Phase 2 (`tests/qa/fase2-*.spec.ts`, one command for all of them):
- `fase2-fugas`: three rounds over every 3D view and heavy page; after each, back on the start page with `gc()`
  (and CDP `HeapProfiler.collectGarbage`), `instalarSondaRecursos` (`sonda.ts`: wrapped `AudioContext`, `Worker`,
  `setInterval`/`clearInterval` and `requestAnimationFrame`) counts what is alive; growth between rounds is a leak.
  A second test does the same over the learning loop: the lessons' explorable rows (slider moved 12 times, each
  move simulates), a smart-practice session skipped to its end, `#/problema` and `#/progreso/dominio`.
- `fase2-lento`: one route of each kind (group × hash depth × action) with CDP CPU throttling ×4 and «Fast 3G»
  (cold with an empty cache and warm from the start page; first content > 3 s flagged); and with every content JSON
  aborted (`page.route`, except `indice.json`/`refs.json`) after a real reload: the page must show a notice with
  «Reintentar» that recovers, else it is `error-sin-reintento`, `carga-sin-fin-sin-red`, `en-blanco-sin-red` or
  `incompleta-sin-red` (under half of the text it has with the network and no notice).
- `fase2-analizadores` (Node: `magnitudes.comprobar` with every unit × prefix × format, SPICE numbers, calculators
  against the book's examples) and `fase2-editor` (the 313 netlists through `editableDeNetlist` → `documentoDeEditable`
  → `generarNetlist`, in Node and through `#/editor/libro/<id>`: same elements, same connections up to renaming, and
  every node named by `v(…)` kept).
- `fase2-estado`: reload at the middle screen of every lesson, during a simulation, in the editor (the draft must
  survive) and on the other tools; 30 seeded random routes back and forward (three seeds per touch profile);
  double/triple taps on primary buttons (a lesson's «Continuar» must advance one screen); leaving during a simulation
  or a 3D load (the engine and WebGL must recover); odd and very long input in every text field. The learning
  pages (`grupo: 'aprendizaje'` in `rutas.ts`) are all taken by `fase2-estado`, `fase2-lento` and `fase2-axe` (not one
  per kind), with a smart-practice session reloaded mid-way and double taps on its «Empezar»/«Saltar».
- `fase2-estado` also fills the storage (writes throw QuotaExceededError: «Guardar» must warn and «Reintentar» save
  once there is room) and blocks it (any use of localStorage throws, as some private modes: every page opens, the
  libraries say nothing is kept after closing), and runs two tabs at once on one chapter (each one bookmarks and
  annotates its own sections in random order, one reloads halfway: neither may undo the other's, on screen or in the
  storage, before and after reloading both; then the bookmarks page and the home page are checked with that content).
- The harness's `page.waitForFunction` calls that run while the probe counts animation frames pass a numeric
  `polling` (by default Playwright polls with `requestAnimationFrame`, and a timed-out wait left its loop running:
  `fase2-fugas` took it for the app's).
- The report warns at the top when groups whose triage says «corregido» show up in the run: on a build that has the
  fixes they are incomplete fixes, regressions or new findings caught by too general a pattern (there is no
  catch-all «corregido» pattern for small touch targets any more: new ones show as untriaged).
- `fase2-maquetacion`: every route under the seven `VARIANTES` of `perfiles.ts` (own projects that run only this
  file; `prefs` are written to `localStorage` «epa:prefs» before the app starts).
- `fase2-contenido` (Node: `data-ref` keys against `refs.json` and the anchors of their part, aliases as in
  `candidatosDeRef`; internal links; asset paths of every content JSON; section/figure/table numbering) and the
  search dialog queried with every glossary term and section title (expected in the first 10 results).
- `fase2-axe`: axe-core (`devDependency`, injected with `addScriptTag`; WCAG 2.0/2.1/2.2 A/AA + best practices) on
  one route of each kind, both touch profiles, light and dark (`emulateMedia`); keyboard-only flows on the desktop.
- `fase2-textos`: UI strings from the Svelte AST (text, `aria-label`/`title`/`placeholder`/`alt`, script literals)
  and the TypeScript AST (string literals that read as prose, minus keys, comparisons and DOM/console arguments),
  checked with `nspell` + `dictionary-es` (devDependencies; the book's own words and a small list of technical terms
  are known), the «usted» register, English words and names spelled two ways.
- `fase2-visual`: ≈ 80 routes captured in the tablet against the 0.10.1 build (`QA_VIEJO`, built apart from the
  commit's `git archive`), compared in a canvas; > 0.5 % changed pixels gives an «antes | ahora | diferencia» image.

Failed loads (0.11): `componentes/ErrorCarga.svelte` (title, the cause in Spanish from `lib/errores.ts`
`textoError`, «Reintentar»; without a callback it reloads the page, since a lazy chunk that failed cannot be imported
again). Caches of content promises must not keep a failure (`sinFallos`, or reset in `catch`): `cargarGlosario`,
`cargarBusqueda`, `cargarBaraja`, `cargarIndiceRepaso` (returns `{ fallo: true }`), `cargarIndiceSpice` (sets
`spice.fallo`), `cargarCatalogo` (sets `calc.falloRed`), `cargarPractica` (rejects when the practice index failed).

Regression tests of the fixes it led to: `tests/regresiones11.spec.ts` (`playwright.regresiones11.config.ts`, port 4422).

**0.12 additions** (`tests/qa/novedades.ts`, `tests/qa/novedades12.spec.ts`). Route actions put every state of the new
interface under the crawler, `fase2-maquetacion` (seven variants) and `fase2-axe`: groups `copia` (`#/sincronizacion/copia`
and the actions `aa-exportar`, `copia-unir`, `copia-sustituir`, `copia-resultado` — import, then the same file again
must announce 0 changes —, `copia-danada`, `copia-ajena`, `copia-nueva`, `copia-deshacer` — replace, then the in-app
«¿Deshacer la sustitución?» left open for the checks), `confirmacion` (`confirmar-borrar`: a montage saved and its
«Borrar» asked, then confirmed so visits do not pile montages up; `confirmar-nuevo`: «Nuevo» over a book circuit in the
editor, then «Cancelar»), `actualizador` (`actualizador-disponible|descargando|listo|error|mac|aviso|pagina`: the
updater's test bridge of `actualizador12.spec.ts` — `instalarPuenteQa`, an init script on every page that does nothing
unless sessionStorage `qa-actualizador` holds its configuration: a Windows or macOS user agent, `__epaPuenteActualizador`
with a key that `claveActualizadorValida` accepts, a download that can pause or fail once — and a fake GitHub release;
undone by removing the flag and `epa:sinc-version` and reloading, else the stored release would show the notice on every
later page) and `actividad` (`dias-sumados`: two other devices' records of today seeded in `epa:progreso-diario`, the
goal must show the sum). Each action checks its own outcome (`novedad-<acción>` findings) and marks the probe when it
ends (its scripted steps are not the app's flashes); `deshacerAccion012` restores the page; `cerrarCapas` also closes
`[role=alertdialog]`. `novedades12.spec.ts` (three profiles): backup end to end (export through the reader's own
buttons and its download read back, «Unir» on a fresh context twice, «Sustituir todo» with the checkbox, the automatic
backup saved as a file, «Deshacer la sustitución» with Escape first, a reload, five unusable files that must change
nothing), the confirmation (Escape, «Cancelar», a press on the backdrop, history.back(), the destructive button; keys
must not reach the editor), the updater (cancel while downloading, an error then «Volver a intentarlo», the notice
hidden while «Aa» is open), the diagnostic's «Entorno del estudio» row (fresh, «Repetir», after a reload), the studio's
environment cache (every 3D board and a model opened twice in a fresh context: `__epaEntorno` «pmrem» + saved, then
«memoria» + read from IndexedDB, same picture once the faces are at full resolution) and the day summed across devices
(plus a step taken here). `fase2-estado` adds the backup with the storage full («Unir» and «Sustituir todo») and blocked
(export works, an import must not claim it is kept) and a backup imported in one tab while the other keeps bookmarking.
`fase2-visual` takes `QA_VIEJO_NOMBRE` (0.12 compares with 0.11.0); `QA_SIN_COMPILAR=1` serves `EPA_DIST` as it is (one
build for a run split into several commands). Regression tests: `tests/regresiones12.spec.ts`
(`playwright.regresiones12.config.ts`, port 4431).

### Layout and accessibility rules that came out of it (0.11)

- Nothing that arrives late may push content the reader is looking at: places are kept for what is still loading
  (`CircuitoVivo` `data-reserva`, the simulator page shown all at once, the instruments bench's drawing, the
  animation scene's placeholder), vector figures carry `width`/`height` from `svg_vista`, and the reader and the
  lessons wait (≤ 1.5 s, once per session) for the small maps that insert panels and buttons
  (`lib/mapas-lectura.ts`). Loading placeholders (`.cargando`) fade in after 0.3 s. Status lines of a run go inside
  an existing row (the simulator's toolbar, the live schematic's panel), never on a line of their own.
- A page's controls show only its own engine runs (`simulador/Pagina.svelte` `propias`): other components share
  the single ngspice worker. A run of the page that another component's run replaced (the drawn circuit re-solves
  itself after each result) is run again unless a newer run of the page or «Detener» replaced it: under load the
  background run could start just after a slider's run and leave the page with the previous values.
- The protoboard's live operating point is proof only for the board version it was solved for (`versionOp`): after
  a change the previous one stays on show until the re-solve, and the guide celebrated a circuit with the previous
  board's «LED lit».
- Touch areas: on `(pointer: coarse)` small controls get a transparent `::after` box of at least 44 × 44 px centred
  on them (the `toque-44` class, or the selectors listed in `app.css`), so they keep their look.
- Table headers (`.tabla thead th`) wrap only when wider than a cell may be (22em), balanced; short ones stay on one
  line (they were `nowrap` and a long one spilled out of its column).
- `--tinta-tenue` is #5b6672 (light), #665a4b (sepia), #8c96a1 (dark): ≥ 4.5:1 over every background token; text in
  a status colour (box titles, readings, badges) is mixed towards `--tinta` with `color-mix`.
- UI text addresses the reader as «usted» («Toque», «Elija», «Su respuesta»), as the book does.
- What a lazy chunk or late data will draw keeps its final size from the start, or what it would push waits hidden
  (`visibility: hidden`, `aria-busy`): a calculator's controls wait for its illustration; a 3D model's details (one
  column) wait for `Visor3D`'s `alListo` (≤ 5 s) and `Vista3D`'s placeholder has the view's size; the glossary
  reserves its pictures' places from `glosario-imagenes.json` and waits for the book's fonts (`fuentesDeLectura`,
  ≤ 1.5 s) as the reader does.
- A lesson's «Continuar» ignores the second click of a double tap or double click (`event.detail > 1`): it landed on
  the next screen's button and skipped that screen. The smart practice does the same for «Empezar», «Saltar» and
  «Continuar», and drops a repeated click (`detail > 1`) that lands on another control than the first one.
- Learning events reach their consumers (XP, mastery) through a lazy chunk loaded on the first event, which replays
  the events emitted meanwhile. Whoever reads the consumers' result right after an answer waits for that delivery:
  `esperarDominio()` awaits `eventosEntregados()` before the queue (a session's end screen computed «what improved»
  without the session's answers on a loaded machine), and the end screen never stays on «Calculando…».
- Touch screens, small inline targets (owner's decision): the calculator's formula is one button that opens a picker
  with a ≥ 44 px button per quantity (`FormulaViva.svelte`, `(pointer: coarse)` via `matchMedia`); the glossary's A–Z
  index becomes a 14 × 2 grid of 44 px letters (as wide as the screen allows); the colour-code swatches are 44 px
  buttons with the colour drawn inside. Mouse layouts keep the inline buttons.
- WebGL views and memory: three.js keeps every WebGL context it used reachable after `renderer.dispose()` (its
  shared empty textures stay uploaded in it), and the context keeps its canvas. Whatever the canvas references
  stays alive: a view removes its own listeners from the canvas (no `on…` attributes on a WebGL canvas: they are
  added and removed by hand, `Vista3D.svelte` `oyentes`), the scene removes its `webglcontextlost` listener and
  empties its groups (`Escena3D.liberar`), and the canvas is taken out of the DOM when the view closes (else it held
  the view's whole subtree). Checked by regresiones11 with `Memory.getDOMCounters` after six visits.
- Sepia redefines the accent and status inks a little darker (`--acento`, `--c-nota`, `--c-ejemplo`,
  `--c-importante`, `--c-tarjeta-texto`): the light theme's values fell under 4.5:1 on its warmer surfaces.
- A late part of a page whose height is unknown waits hidden with the content under it (`visibility: hidden`,
  `aria-busy`, ≤ 2.5 s; the consoles' «Fuentes» tab), or its place is reserved (`CircuitoVivo`: 100 px for the
  controls' panel, 150 px and a two-line header under 600 px; nothing reserved for an empty netlist).
- `<main>` is its own block formatting context (`display: flow-root`): a page's first top margin no longer collapses
  through it, so a page replacing the loading notice does not move the whole of `<main>` (0.11 final QA).
- A live figure opened by its link (`#/capXX/fig-…`): the reader loads its data with the part (≤ 1.5 s,
  `Lector.datosDeFiguraObjetivo`) and `FiguraViva` takes data that have already arrived before painting
  (`figuras-vivas/carga.svelte.ts` `datosYa`), so its panels do not push the caption and the text.
- Storage unavailable (`obtenerAlmacen()` falls back to memory): the editor's and the breadboard's libraries say so
  (`AvisoGuardado` «memoria», «Sin guardar en este dispositivo») instead of «Guardado en este dispositivo».
- A page that loads after it mounts and then rewrites the address (`history.replaceState`: a lesson's screen, the
  editor's «#/editor») stops when it is left before its load ends (`Leccion` `desmontada`, `EditorEsquemas`
  `turnoApertura`): the left page wrote its address over the new one's, or undid the navigation (0.11 final QA).
- `simularTexto(texto, { fondo: true })` marks a background run (the drawn circuit re-solving after a page's
  result); a page whose run was replaced runs again only when a background run replaced it
  (`sustituidaPorFondo()`), never after a run someone asked for (the breadboard over the simulator page).
- A book netlist's page keeps its results' place (480 px under 1340 px wide) during its first run: the results come
  before the netlist there and pushed it out of the screen.
- A live figure reached within its part (a reference, a link): the reader asks for its data before scrolling
  (`Lector` navigation effect → `datosDeFiguraObjetivo`), and `carga.svelte.ts` `llegados` is reactive, so a figure
  already on the page takes them as soon as they arrive.
- Smart practice offline: a bank of the plan's parts that did not come for lack of network makes the session
  `incompleta` (notice with «Reintentar»), and `catalogo.ts` does not keep a part's concept list made without it.
- A component that loads after mounting and then writes state from its props (`Deslizador`, `Prediccion`,
  `Leccion`, `EditorEsquemas`) stops when unmounted: Svelte warns `derived_inert` otherwise, and some wrote the
  address. The harness prints the call stack of every console warning with `QA_PILAS=1`.
- Search (`lib/buscador.ts`): a title typed whole (case, accents and punctuation aside; a section's also without its
  number) goes first, in the book's order — single letters and stop words are not indexed, so «Filtro en T» was one
  more «filtro» (0.11 final QA).
- A popover that is not modal (the «Tema y tamaño de letra» panel) closes when the focus leaves it (`focusout` with
  a `relatedTarget` outside); a scrolling box whose items are out of the tab order (the search results) takes the
  focus while it overflows (`lib/desplazable.ts`, `{ vertical: true }`).
- Schematic editor import (`editor/importar.ts`): every pin of an imported part remembers its netlist node
  (`Componente.redes`), which names its net when no label, ground or wire does (`conectividad.ts`, after the wires'
  names); a node the layout drew as separate pieces (a lone net label on a bridge's pin) is joined with a routed
  wire, or labelled on every piece when no path exists (`unirRedesPartidas`).
  1.1: a terminal left alone whose node a controlled source or an expression reads (`nodosDeControl`: E/G control
  nodes, `POLY(n)` and its 2n nodes, `V(a)`/`V(a,b)` in B or `VALUE=`) gets a net label with that node's name, at the
  free end of the lead the layout drew or at the terminal (`etiquetarControles`): the layout draws E/G/B with their
  output only, so before it was drawn dangling and warned «no está conectado a nada». Same netlist (the 313 of the
  book: 0 changed, 46 false warnings gone in 23); `tests/enlaces11-unidad.spec.ts`.


### Accessibility conventions (1.0 pass, WCAG 2.2 AA)

Tests: `tests/accesibilidad10-rutas.spec.ts` (axe-core, tags wcag2a/2aa/21a/21aa/22aa + best-practice, on ~80 routes of
every kind — the route table of `lib/ruta.svelte.ts`, the overlays, the 1.0 practice types — × light/sepia/dark ×
desktop/360 px phone; plus one `main`, the skip link, a page title, `lang="es"`, an `h1`, no horizontal scroll on the
phone) and `tests/accesibilidad10-teclado.spec.ts` (keyboard-only critical paths), helpers in
`tests/accesibilidad10-comun.ts`, config `playwright.accesibilidad10.config.ts` (port 4741; `ACC_FILTRO`, `ACC_TEMAS`,
`ACC_INFORME=<file>` = audit mode that writes findings instead of failing). axe exceptions, both in the helper:
`[data-decorativo]` is excluded (incidental text, WCAG 1.4.3: the unlit annunciators of the Brymen LCD drawn at 6 %), and
a `target-size` node «partially obscured» is kept only if, scrolled to the middle of the view, the target is under
24 × 24 px or something else covers its centre (axe counts fixed bars and sticky headers over off-screen targets), and
never inside an inert subtree (the page under a modal overlay).

Conventions for new components:
- **Route change** (`lib/foco-ruta.ts`, called from `App.svelte` on every `ruta.n` that changes the route, not on the
  first load): two frames after the change, unless the focus is already inside `main` (the page moved it itself), in
  an open dialog, or in the visible index panel (`aside.lateral`), the focus goes — without scrolling — to the reader's
  anchor element (`parte`/`glosario` with an anchor) or the first visible `h1` of `main` (it gets `tabindex="-1"`),
  waiting up to 4 s for lazy pages (`.cargando`). A page that wants another target focuses it in its own mount effect.
  Such a heading (and `main`) with `tabindex="-1"` draws no focus ring (`app.css`, fix12): browsers match
  `:focus-visible` on a programmatic focus when there was no pointer input yet.
  Every page has one `h1` (`solo-lector` when it has no visible title); below it, `h2`, `h3`… without skipping levels.
- **Skip link** `a[data-saltar-contenido]` is the first element of `<body>` content (`App.svelte`), off screen until
  focused; it prevents the default (the hash is the router's) and calls `enfocarContenido()`.
- **Never let the focus fall to `<body>`**: a control that becomes `disabled` (or disappears) while it has the focus
  drops it. After such an action move the focus to its outcome: the verdict of a question (`Pregunta.svelte`,
  `section.respuesta` `tabindex="-1"`), the preview and the result of a backup import (`CopiaSeguridad.svelte`), the
  button again after an export.
- **Focus ring on text fields** (QA 1.0): never `outline: none` with only a border colour change on focus; a field (or
  its frame with `:focus-within`) gets the app's ring `outline: 2px solid var(--acento); outline-offset: 2px` (−2px
  when it spans a dialog's edge, `Busqueda.svelte`): PaginaGuia, Pregunta, Numerico (problem of the day), Busqueda,
  IndiceLibro, Glosario, CampoValor, Calculadoras, Galeria, Catalogo3D, simulador/Editor. Range sliders keep their
  thumb ring.
- **Busy buttons** (QA 1.0, `practica/Practica.svelte` «Comprobar»): set the busy state, `await tick()` and yield one
  frame (`pintar()`: rAF + timer floor) before synchronous work; mark the button `aria-busy`/`aria-disabled` instead of
  `disabled` so it keeps the focus; an always-present `solo-lector` `role="status"` (`data-estado-comprobar`) says
  «Comprobando…»; the previous attempt's `role="alert"` message is cleared first so a repeated message is announced.
- **Live regions**: a region inserted together with its text is not announced reliably; keep an always-present
  `solo-lector` element with `aria-live="polite"` and change its text (`Comprobador.svelte` `data-resumen-comprobacion`,
  the canvas `data-anuncio-lienzo`, the bench `data-anuncio-mesa`, the chart `data-lectura-hablada`, the exam
  `data-aviso-tiempo`). Do not make a region chatty: values that change continuously (a clock, a meter's reading) are
  readable on demand (plain `solo-lector` text or the `aria-label` of a `role="img"`) and only spoken at thresholds or
  on a key press; `role="alert"` only for errors.
- **Canvas widgets** (`role="application"`, `tabindex="0"`, `aria-describedby` pointing at a `solo-lector` help text):
  the schematic editor's `Lienzo.svelte` and the breadboard's `Mesa.svelte` have a keyboard cursor (`cursorTec`, drawn
  as `[data-cursor-teclado="x,y"]` only while the canvas has the keyboard focus — `:focus-visible` — and the arrows were
  used). Enter replays a pointer down + up at the cursor through the same `abajo`/`arriba` code a tap runs (a fake
  event with `pointerType: 'mouse'`, `pointerId: -1`, the target being the part whose leg is in that hole on the bench),
  so every tool (place, select, wire tap by tap, «Ruta automática», probes) works the same; N / Mayús+N cycle the
  selection, Mayús+arrows move it (`ed.mover`, `pb.moverPiezas`). A palette item or a tray card activated with the
  keyboard (`:focus-visible` when `ed.colocando` / `pb.armada` is set) hands the focus to the canvas. Charts
  (`Grafica.svelte`) read the crosshair's values aloud only while focused.
- **Maths read aloud** (`lib/habla-matematicas.ts`): `leerMatematicas(typst)` turns an equation's Typst source into
  Spanish words (fractions «entre», sub/superscripts «sub», «al cuadrado», «elevado a», calls such as sqrt/overline/lr,
  named symbols, an empty base `zws^2` raising the group before it, «f lr((t))» → «f de t»; unknown tokens pass through)
  and `leerUnidades(texto)` says a unit after a number in full («4,7 kΩ» → «4,7 kiloohmios»). Used for the `alt` of
  inline equations (`prepararHtml`, the source kept in `data-fuente`), display equations (`Ecuacion.svelte`, the source
  in `title`), the reference cards, chart readouts and the Brymen display. `tests/accesibilidad10-unidad.spec.ts` fails if
  any equation of the book leaves Typst syntax in its reading. Overlays that close without a route change give the focus
  back to what had it (`Busqueda.svelte` since 1.0; the figure viewer and `lib/confirmar.ts` already did).
- **Decorative text** that must stay faint (LCD ghost segments) carries `data-decorativo`; the meaningful reading is the
  `aria-label` of the display (`role="img"`, `Brymen.svelte` `lectura`, decimal comma).
- **Colour**: text ≥ 4.5:1 and UI/graphics ≥ 3:1 on every surface token of the three themes (light
  `--c-tarjeta-texto` is #7d630a since 1.0: #8a6d0b was 4.3:1 on tinted exercise boxes); state never by colour alone.
- **Reflow** (320–360 px): a grid/flex child that holds a `<select>`, a `<fieldset>` (min-content wide by default), a
  table or long unbreakable text needs `min-width: 0` (or `grid-template-columns: minmax(0, 1fr)`) and
  `overflow-wrap: anywhere` for paths and net names; a scrollable table box gets `tabindex="0"` and a name
  (`role="group"`, `aria-label`) so it scrolls with the keyboard.
- **Touch targets**: `toque-44` (44 × 44 px on coarse pointers) and, for rows of small targets, at least 24 px each
  (WCAG 2.5.8): the glossary's A–Z index is three rows of 10 on phones (≤ 440 px), two of 14 on tablets.
- Landmarks: one `main`; every `aside`/`nav` with a distinct `aria-label`; floating menus inside a landmark (the «Más»
  menu is wrapped in `nav.nav-mas`, `display: contents`).
