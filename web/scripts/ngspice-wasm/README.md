# ngspice con XSPICE para WebAssembly

Compila **ngspice 45.2 con XSPICE** (puertas y biestables digitales, puentes ADC/DAC y los modelos de código
analógicos) a WebAssembly, con el mismo controlador que el motor anterior (`eecircuit-engine`), y deja el
resultado en `web/vendor/ngspice-xspice/`, que **se versiona**: ni `npm run dev|build|check` ni GitHub Actions
compilan ngspice; `web/scripts/ngspice.mjs` copia esa carpeta a `src/simulador/motor/ngspice-xspice.js` y
`public/ngspice/ngspice-xspice.wasm` (generados, no versionados). Solo hay que volver a compilar para cambiar
de versión de ngspice o de Emscripten, o para tocar los parches.

| Fichero | Qué es |
|---|---|
| `compilar.sh` | La compilación completa, por fases (ver abajo). |
| `versiones.sh` | Versiones fijadas y sumas SHA-256 de todo lo que se descarga. |
| `parches.py` | Cambios en las fuentes de ngspice, cada uno anclado en el texto exacto de la 45.2 (falla si no lo encuentra). |
| `cm_estatico.c` | Registro estático de los modelos de código XSPICE (sustituye a `dlopen()`). |
| `pre.js` | Ganchos del controlador (`setGetInput`, `setHandleThings`, `runThings`), los mismos que `eecircuit-engine`. |

## Cómo se compila

```bash
web/scripts/ngspice-wasm/compilar.sh
```

Necesita Linux x86-64 con `bash`, `git`, `curl`, `tar` con xz, `python3`, `node` (≥ 18), `gcc`, `make`,
`autoconf`, `automake`, `libtool`, `bison`, `flex`, `sha256sum` y `gzip`; en Ubuntu:

```bash
sudo apt-get install -y build-essential autoconf automake libtool bison flex curl git xz-utils python3
```

Variables: `TRABAJO` (carpeta de trabajo, por omisión `${TMPDIR:-/tmp}/ngspice-wasm`, ≈ 1 GB), `SALIDA`
(por omisión `web/vendor/ngspice-xspice`), `JOBS` (por omisión 2), `TOOLCHAIN`, `CFLAGS_OPT`, `LINK_OPT`,
`WASM_OPT`. Se pueden repetir fases sueltas: `compilar.sh enlazar copiar` vuelve a enlazar con otras opciones
sin recompilar nada.

Fases:

1. **herramientas** — Emscripten. Con `TOOLCHAIN=github` (por omisión) se monta solo con descargas de GitHub:
   las fuentes de emscripten 6.0.3 (y sus dependencias de npm), clang/wasm-ld de la versión oficial
   **LLVM 23.1.4** (la versión mayor que espera esa emscripten; se descarga en flujo y solo se extraen clang,
   lld y las utilidades de LLVM, ≈ 485 MB) y **binaryen 129** (`wasm-opt`). Es la cadena que produjo el binario
   versionado. Con `TOOLCHAIN=emsdk` usa emsdk 6.0.3 (descarga sus binarios de `storage.googleapis.com`,
   que no siempre es accesible): mismo comportamiento, binario no idéntico byte a byte. `TOOLCHAIN=sistema`
   usa el `emcc` que haya en el `PATH`.
2. **fuentes** — ngspice 45.2 del espejo de GitHub del repositorio de SourceForge
   (`danchitnis/ngspice-sf-mirror`, la misma fuente que usa `eecircuit-engine`), comprobando el commit de la
   etiqueta `ngspice-45.2`, y los parches de `parches.py`.
3. **cmpp** — el preprocesador de modelos de código de XSPICE, compilado con el `gcc` de la máquina (se
   ejecuta durante la compilación, así que no puede ser WebAssembly).
4. **configurar** — `emconfigure ./configure --enable-xspice --disable-osdi --disable-openmp --without-x
   --with-readline=no` (KLU incluido) y la línea de enlace de `ngspice` con las mismas opciones que
   `eecircuit-engine` (Asyncify, `MODULARIZE`, `EXPORT_ES6`, `ENVIRONMENT=web,worker`, `FS`, `Asyncify` y
   `callMain` exportados, `pre.js`) más la biblioteca de modelos de código.
5. **modelos** — `cmpp` genera `cfunc.c`/`ifspec.c` de cada modelo de las bibliotecas `spice2poly analog
   digital xtradev xtraevt table tlines` (las mismas que carga el `spinit` de ngspice), se compilan con `emcc`
   y se juntan en `libcodemodels.a` con `cm_estatico.c` y las tres funciones auxiliares del final de
   `src/xspice/icm/dlmain.c` (`fopen_with_path`, `cm_message_printf`, `cm_is_inertial`).
6. **compilar** — `emmake make -j$JOBS` (unos 20 minutos con dos núcleos).
7. **copiar** — `ngspice.mjs`, `ngspice.wasm`, `LICENSE.txt` (licencias de ngspice y de Emscripten) y
   `compilacion.json` (versiones, opciones, tamaños y SHA-256 del resultado).

## Por qué hacen falta parches

- **XSPICE sin `dlopen()`.** ngspice nativo carga cada biblioteca de modelos (`analog.cm`, `digital.cm`…) con
  `dlopen()` desde las líneas `codemodel` de `spinit`, y cada biblioteca recibe del núcleo una tabla de
  punteros a sus funciones (`dlmain.c`). WebAssembly no puede cargar bibliotecas así, de modo que los modelos se
  enlazan dentro del binario y llaman directamente a las funciones del núcleo. `cm_estatico.c` define las
  tablas de dispositivos y de tipos de nodo de cada biblioteca y las registra al arrancar (`main()`, justo
  después de `SIMinit`), en el orden de `spinit`, con `add_device` y `add_udn` como haría `load_opus()`; la
  orden `codemodel x.cm` sigue funcionando (no hace nada si ya está registrada).
- **Asyncify** (de `eecircuit-engine`): antes de leer cada orden, ngspice llama a `Module.handleThings()`, donde
  el controlador puede suspender la pila de WebAssembly hasta tener más trabajo.
- **Sin HICUM2** (como `eecircuit-engine`): es C++ y el motor anterior tampoco lo tenía.
- La fecha de compilación que ngspice imprime es la del commit de ngspice (`SOURCE_DATE_EPOCH`).

La compilación es reproducible: repetida desde las fuentes (fases `fuentes` a `copiar`) con la misma cadena da
`ngspice.wasm` y `ngspice.mjs` idénticos byte a byte (las sumas SHA-256 están en `compilacion.json`).

## Comprobar un binario nuevo

```bash
cd web
node scripts/ngspice.mjs --force
node scripts/validar-spice.mjs --motor xspice --salida /tmp/xspice.json
node scripts/validar-spice.mjs --motor eecircuit --salida /tmp/eecircuit.json
npm run check && npm run build
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test --config playwright.xspice.config.ts
```

Las medidas de las netlists sin XSPICE deben coincidir con las del motor anterior y las de las que usan
XSPICE (capítulo 28 del libro impreso, carpeta `cap29`) con sus gemelas `_analogica` y con el texto del libro.
