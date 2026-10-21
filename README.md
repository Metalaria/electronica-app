# Electrónica Práctica Avanzada — lector

Aplicación privada y sin conexión para leer «Electrónica Práctica Avanzada» en Windows, macOS y Android.
Es una sola aplicación web (Svelte 5 + TypeScript + Vite) empaquetada con Tauri 2. Todo el contenido se
genera a partir de las fuentes Typst del libro, de modo que una corrección en un capítulo llega a la
aplicación con solo regenerar y volver a compilar.

Incluye la fase 1 (el lector) y la fase 2 (el simulador de circuitos, con las 309 netlists del libro). Las
fases siguientes (ejercicios, modelos 3D, editor de esquemas) están descritas en `ESQUEMA.md`.

## Qué hace

- **Índice** en la barra lateral: tomos → capítulos (con el color de su bloque temático) → secciones. La
  sección que se está leyendo se resalta mientras se avanza.
- **Lectura** con la tipografía del libro (Source Serif 4 para el texto, Source Sans 3 para títulos e
  interfaz, Source Code Pro para el código; las fuentes van dentro de la aplicación). El color del
  capítulo es el acento: apertura, números de sección, ecuaciones, tablas.
- **Todos los bloques del libro**: cajas de nota, importante, precaución, ejemplo y comprobación;
  deducciones; tarjetas de fórmulas; ecuaciones (imágenes SVG de Typst que toman el color del texto, así
  que se leen bien en tema oscuro); figuras con su pie «Figura 5.3 — …» y créditos; tablas (en el móvil
  se desplazan en horizontal); código; ejercicios con «Ver solución».
- **Figuras a pantalla completa**: un toque o clic abre la figura; se amplía con la rueda, los botones,
  doble toque o pellizco, y se desplaza arrastrando. Las figuras vectoriales siguen nítidas a cualquier
  aumento.
- **Referencias cruzadas**: cada «5.3» del texto es un enlace. Lleva a su destino (en el mismo
  capítulo o en otro), lo resalta un instante y muestra un botón «Volver a 5.2». El botón Atrás del
  navegador, del ratón o de Android devuelve al punto exacto donde se estaba leyendo.
- **Glosario**: orden alfabético, salto por letras, filtro instantáneo (sin importar tildes) y, en cada
  término, los enlaces «→ 5.3» a las secciones donde se trata.
- **Búsqueda** en todo el libro (secciones y glosario) con `Ctrl K` / `⌘ K` o `/`: no distingue
  tildes ni mayúsculas, acepta el comienzo de las palabras y tolera pequeñas erratas. Cada resultado
  indica el capítulo y un fragmento con las coincidencias marcadas.
- **Datos personales**, guardados en el propio dispositivo:
  - la última posición de lectura de cada capítulo (la portada ofrece «Continuar leyendo»);
  - marcadores de sección y notas breves por sección (botones junto al título de cada sección);
  - la vista «Marcadores y notas», en el orden del libro;
  - tema claro, sepia, oscuro o el del sistema, y tamaño del texto (botón «Aa»).
- **Diseño adaptable**: en el teléfono, una columna y el índice en un cajón lateral; en tableta y
  ordenador, índice fijo y texto. Rutas con almohadilla (`#/cap05/sec-5.3`), que funcionan sin servidor
  dentro de Tauri.
- **Saltos rápidos entre capítulos**: al seguir una referencia se dibuja primero el tramo de destino y el
  resto del capítulo después, en los ratos libres; mientras se lee, la aplicación prepara en segundo plano
  los capítulos a los que remite la sección en pantalla y el siguiente.
- **Simulador de circuitos** (sección siguiente): botón «Simular» junto a cada figura, sección, problema o
  ejercicio que tiene netlist.
- **Componentes animados**: 39 animaciones interactivas de cómo funciona cada componente por dentro, enlazadas
  con sus secciones y figuras (botón «Ver animación» en el libro; ver más abajo).

### Atajos de teclado

| Tecla | Acción |
|---|---|
| `Ctrl K` / `⌘ K`, `/` | Buscar |
| `↑` `↓` `Intro` | Elegir y abrir un resultado de búsqueda |
| `Esc` | Cerrar la búsqueda, el visor de figuras o el panel «Aa» |
| `+` `-` `0` | Acercar, alejar y ajustar en el visor de figuras |
| `Ctrl Intro` | Guardar la nota que se está escribiendo |

## Simulador de circuitos

«Simulador» en la barra lateral (`#/simulador`) abre el catálogo de las 309 netlists de ngspice que
comprueban los circuitos y los números del libro, por capítulos, con búsqueda (sin tildes) y filtro por tipo
de análisis. Cada figura, sección, problema o ejercicio que tiene netlist muestra en el lector un botón
«Simular»; el botón Atrás vuelve al punto exacto de la lectura.

La página de cada netlist tiene:

- la **descripción** (el comentario de cabecera de la netlist: qué comprueba y qué valores da el libro) y
  enlaces a las figuras y secciones del libro;
- **parámetros** con controles deslizantes para los valores de resistencias, condensadores, bobinas,
  fuentes (continua, amplitud y frecuencia de `SIN`, nivel y periodo de `PULSE`), ganancias de fuentes
  controladas y `.param`: escala logarítmica de ×0,1 a ×10 del valor del libro, con valores E12 opcionales
  para R, C y L, y un campo para escribir el valor exacto (`4,7k`, `100n`, `2,2 MΩ`). Al moverlos se
  reescribe la netlist y se vuelve a simular al soltar (unos 0,3 s de espera); las curvas pasan suavemente al
  nuevo resultado. «Fijar referencia» deja el resultado actual como trazo tenue para comparar;
- la **netlist** editable (números de línea; `Ctrl Intro` simula; la línea de un error queda marcada) y
  «Restaurar la del libro»;
- los **resultados**: gráficas de cada análisis (transitorio, alterna con magnitud en dB y fase, barrido de
  continua, ruido en escala logarítmica), con elección de vectores y, si el bloque `.control` repite un
  análisis (bucles con `alter`), la opción de superponerlos; las **medidas** (`.meas` y `print`) agrupadas
  bajo los `echo` de la netlist; el **punto de trabajo** (una columna por cada `op`); los errores de
  ngspice con una explicación en español; y la **salida de ngspice** completa, plegada.

Las gráficas son interactivas: cruz con los valores de todas las curvas (con prefijos SI y coma decimal),
dos cursores A y B como en un osciloscopio (Δx, Δy y 1/Δx), leyenda para ocultar curvas, ejes lineales o
logarítmicos, tabla de datos, y zoom:

| Gesto | Acción |
|---|---|
| Arrastrar (ratón) | Ampliar el recuadro |
| `Mayús` + arrastrar, botón central | Desplazar |
| Rueda (con la gráfica activa, o con `Ctrl`) | Ampliar en horizontal; con `Mayús`, en vertical |
| Deslizar un dedo | Leer valores |
| Pellizcar, dos dedos | Ampliar y desplazar |
| Doble clic, doble toque, `0`, `Esc` | Volver a ver todo |
| `←` `→`, `+` `-`, `C` | Leer valores, ampliar, cursores (con la gráfica activa) |

«Nuevo circuito» (`#/simulador/nuevo`) abre el mismo simulador con una netlist vacía (o un ejemplo); se
guarda en el propio dispositivo (`localStorage`, clave `epa:circuito`).

El motor es ngspice 45.2 compilado a WebAssembly (paquete npm `eecircuit-engine` 1.8.0, licencia MIT; ngspice
tiene licencia BSD), que se ejecuta en un *Web Worker*: la interfaz no se bloquea, se ve el progreso y una
simulación se puede detener. Se descarga solo al abrir el simulador (5,8 MB; el arranque del lector no
cambia). Límites:

- **4 netlists no se pueden simular** en la aplicación (capítulo 28 del libro impreso, carpeta `cap29`): usan
  puertas digitales y puentes ADC/DAC de XSPICE, que ningún ngspice para WebAssembly de npm incluye. La
  página lo explica y muestra la netlist; con ngspice instalado: `ngspice -b fichero.cir`.
- **Unas 20 son pesadas** (más de 8 s en un ordenador; la más lenta, `cap00/derivadas_c_l`, guarda 12
  millones de puntos y tarda más de 3 minutos): no se ejecutan solas al abrirlas, y la página avisa.
- La aplicación usa el resolvedor SPARSE de ngspice, que da los mismos números que ngspice nativo; si un
  transitorio no converge («Timestep too small») repite la simulación con KLU y lo indica.
- `plot`, `quit` y similares del bloque `.control` se ignoran (la aplicación dibuja las gráficas).

## Componentes animados

«Componentes animados» en la barra lateral (`#/componentes`) abre una galería de 39 animaciones agrupadas
por familias (resistencias, condensadores, bobinas y transformadores, diodos, BJT, MOSFET, potencia y
protección, especiales y sensores), con búsqueda sin tildes por nombre, concepto o número de sección. Cada
una (`#/componentes/<id>`) tiene la animación (canvas, nítida a cualquier tamaño y con los colores del tema),
controles con su valor y unidad, reproducción/pausa y velocidad, una gráfica en vivo, dos o tres frases que
explican lo que se ve con los números del momento y las ecuaciones del libro, y los enlaces «En el libro» a
las secciones y figuras que trata. En el libro, esas secciones y figuras llevan el botón «Ver animación».
Convenciones: electrones azules (puntos), huecos rojos (anillos), iones fijos como cuadrados con su signo,
corriente convencional en ámbar y flujo de electrones en azul discontinuo; cada escena lleva su leyenda.

- Física con los números del libro (Shockley, barrera y zona de agotamiento, Ebers-Moll simplificado con
  Early, MOSFET de ley cuadrática con λ, cargas RC/RL, modelos de NTC/PTC/LDR, MLCC con polarización, etc.).
- Las animaciones avanzan con el tiempo real, no por fotograma (igual a 60 o a 144 Hz), solo corren mientras
  se ven (se paran fuera de pantalla, con la ventana oculta y con «reducir movimiento») y cada escena se
  descarga al abrirla.
- Pruebas (con la aplicación servida, p. ej. `npx vite preview`): `node tests/animaciones.mjs` mide el
  intervalo entre fotogramas de todas las escenas con la CPU ×4 (`--perfil movil|mac|tableta|tableta-vertical`);
  `node tests/animaciones-hz.mjs` comprueba que nada avanza por fotograma (144 Hz simulados).

## Dónde se guardan los datos personales

| Plataforma | Ubicación |
|---|---|
| Windows | `%APPDATA%\es.gonzalomejias.electronica\lector.json` |
| macOS | `~/Library/Application Support/es.gonzalomejias.electronica/lector.json` |
| Android | almacenamiento interno de la aplicación (se borra al desinstalarla) |
| Linux | `~/.local/share/es.gonzalomejias.electronica/lector.json` |
| Navegador (desarrollo) | `localStorage`, claves `epa:prefs`, `epa:posiciones`, `epa:marcadores`, `epa:notas` |

El fichero `lector.json` es JSON legible: para llevar marcadores y notas de un equipo a otro basta
copiarlo con la aplicación cerrada.

## Requisitos

- Node.js 20 o posterior (probado con 22) y npm.
- Rust estable (probado con 1.95) con `rustup`.
- Python 3 y Typst, solo para generar el contenido (`contenido/generar.py`).
- Las dependencias de sistema de Tauri en cada plataforma (abajo).

## Generar el contenido

```sh
cd app
python3 contenido/generar.py
```

Lee las fuentes de `/home/claude/v3` (sin modificarlas) y escribe `web/public/libro/`: `indice.json`,
`refs.json`, `glosario.json`, `busqueda.json`, `partes/*.json` y las imágenes (`fig/`, `img/`, `ec/`). El
formato está descrito en `ESQUEMA.md`. Esa carpeta **se versiona** (unos 112 MB): las máquinas de GitHub
Actions no pueden regenerarla, porque hacen falta las fuentes del libro, las tipografías y las fotos, que
están en otra máquina.

Al final, `generar.py` llama a `contenido/spice.py`, que también se puede ejecutar solo (más rápido, si
solo han cambiado las netlists):

```sh
python3 contenido/spice.py
```

Copia las netlists de `complementos/spice/` a `web/public/libro/spice/` y escribe `spice.json` (índice:
capítulo, figura o sección que comprueba cada netlist, descripción, parámetros, estado en el motor) y
`spice-refs.json` (lo que necesita el lector para sus botones «Simular»). Después **ejecuta cada netlist en
el mismo ngspice WebAssembly que usa la aplicación**, con Node (`web/scripts/validar-spice.mjs`), y resume
cuáles fallan y por qué. Los resultados se guardan en `contenido/.cache/spice-validacion.json` por contenido,
así que la siguiente vez solo se simulan las netlists que han cambiado (la primera vez tarda unos 10 minutos
con dos núcleos). Opciones: `--nativo` compara además cada medida con el `ngspice -b` instalado en el
sistema; `--revalidar` ignora la caché; `--sin-validar` no simula nada. Necesita `npm install` hecho en
`web/`.

Si `web/public/libro/` no existe, la aplicación muestra un **contenido de muestra** (un capítulo con todos
los tipos de bloque, un glosario breve, referencias y búsqueda) que está en `web/src/lib/muestra/`.
Añadiendo `?muestra` a la dirección en el navegador (`http://localhost:1420/?muestra#/cap05`) se fuerza la
muestra aunque exista el libro, lo que es útil para probar cambios de presentación.

## Desarrollo

```sh
cd app/web
npm install
npm run dev            # http://localhost:1420 en el navegador
npm run tauri dev      # la misma aplicación en una ventana de Tauri, con recarga en caliente
```

Comprobaciones:

```sh
npm run check          # svelte-check (TypeScript estricto), debe acabar con 0 errores y 0 avisos
npm run build          # compila la web en web/dist
```

`dev`, `build` y `check` extraen antes el motor de simulación de `node_modules/eecircuit-engine`
(`web/scripts/ngspice.mjs`): escriben `web/src/simulador/motor/ngspice.js` y `web/public/ngspice/ngspice.wasm`,
que no se versionan.

Pruebas de extremo a extremo con Playwright (compilan la web, la sirven en el puerto 4173 y abren Chromium;
en esta máquina el navegador ya está instalado en `/opt/pw-browsers`):

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm test
```

Simulan once netlists de todos los tipos de análisis y comparan sus medidas con los valores que da el libro,
prueban los controles deslizantes, la gráfica (lectura, cursores, zoom), los errores, el aviso de XSPICE y el
enlace desde el lector, y dejan capturas de teléfono y de ordenador, en tema claro y oscuro, en
`web/tests/capturas/` (no se versionan). En otro equipo, `npx playwright install chromium` descarga el
navegador.

Medida de un salto entre capítulos en un «teléfono lento» (CPU ×6, pantalla de 412 × 915), con la web ya
servida (`npx vite preview --port 4173`):

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/rendimiento.mjs
```

`npm run tauri …` ejecuta la CLI de Tauri mediante `web/scripts/tauri.mjs`, que le indica dónde está
`src-tauri/` (la CLI solo busca su configuración por debajo de la carpeta actual). Funciona igual en
Windows, macOS y Linux.

## Compilar para cada plataforma

El contenido de `web/public/libro/` se **incrusta en el ejecutable** al compilar: hay que generarlo antes,
subirlo al repositorio y volver a compilar cada vez que cambie. Tauri no compila de forma cruzada para
Windows ni macOS: cada instalador se construye en su propio sistema, ya sea en tus equipos («Compilar en
tus equipos») o en las máquinas de GitHub («Compilar con GitHub Actions»).

Los resultados quedan en `src-tauri/target/release/bundle/<formato>/` (o
`src-tauri/target/<destino>/release/bundle/` cuando se indica `--target`).

En los comandos de abajo se llama a la CLI de Tauri con `node scripts/tauri.mjs …` en lugar de
`npm run tauri -- …`: es lo mismo, pero evita que PowerShell se coma el `--` y las comas.

### Linux (para comprobar la parte nativa)

```sh
sudo apt install libwebkit2gtk-4.1-dev librsvg2-dev libayatana-appindicator3-dev build-essential curl wget file libxdo-dev libssl-dev pkg-config
```

```sh
cd app/web
```

```sh
node scripts/tauri.mjs build --bundles deb
```

Genera `bundle/deb/Electrónica Práctica Avanzada_0.1.0_amd64.deb`.

## Compilar en tus equipos

Las instrucciones parten de cero: equipo recién instalado, repositorio privado `electronica-app` ya creado
en GitHub (sección «Compilar con GitHub Actions») y el repositorio clonado en la carpeta personal
(`$HOME\electronica-app` en PowerShell, `~/electronica-app` en macOS). La primera compilación
de Rust tarda entre 5 y 15 minutos; las siguientes, mucho menos.

### Windows 11 (PowerShell)

Todo se hace en «Terminal» (PowerShell) **sin** permisos de administrador; `winget` pedirá confirmación
de administrador cuando la necesite.

1. Instalar Git, GitHub CLI, Node.js LTS, Rust (rustup) y las Build Tools de Visual Studio 2022 con la
   carga de trabajo de C++ (WebView2 ya viene con Windows 11):

```powershell
winget install --id Git.Git -e --source winget
```

```powershell
winget install --id GitHub.cli -e --source winget
```

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

```powershell
winget install --id Rustlang.Rustup -e --source winget
```

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

2. Cerrar la ventana de Terminal y abrir una nueva (para que se carguen las rutas nuevas). Permitir los
   scripts locales de PowerShell (sin esto `npm` falla con «la ejecución de scripts está deshabilitada»)
   y dejar Rust en su versión estable:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

```powershell
rustup default stable-msvc
```

3. Iniciar sesión en GitHub (se abre el navegador; acepta «Authenticate Git with your GitHub
   credentials») y clonar el repositorio:

```powershell
gh auth login --hostname github.com --git-protocol https --web
```

```powershell
cd $HOME
```

```powershell
gh repo clone electronica-app
```

4. Instalar las dependencias y compilar:

```powershell
cd $HOME\electronica-app\web
```

```powershell
npm ci
```

```powershell
node scripts/tauri.mjs build --bundles nsis msi
```

5. Abrir la carpeta con los instaladores:

```powershell
explorer $HOME\electronica-app\src-tauri\target\release\bundle
```

- `nsis\Electrónica Práctica Avanzada_0.1.0_x64-setup.exe`: instalación para el usuario, sin permisos de
  administrador (la recomendada).
- `msi\Electrónica Práctica Avanzada_0.1.0_x64_es-ES.msi`: instalación para todo el equipo.

Sin firma de código, SmartScreen avisa la primera vez: «Más información» → «Ejecutar de todas formas».
Si solo falla el `.msi` (error de `light.exe`), activa VBScript en «Configuración» → «Sistema» →
«Características opcionales» → «Ver características» → «VBSCRIPT», o compila solo el `.exe`:

```powershell
node scripts/tauri.mjs build --bundles nsis
```

Para actualizar más adelante: `cd $HOME\electronica-app`, `git pull` y repetir el paso 4.

### macOS

En un Mac con macOS 12 o posterior, en la aplicación «Terminal». Homebrew es opcional; aquí se usa para
instalar Node.js y GitHub CLI con un solo comando cada uno.

1. Herramientas de línea de comandos de Xcode (se abre una ventana: «Instalar»):

```sh
xcode-select --install
```

2. Rust con rustup y los dos destinos del binario universal (Apple Silicon e Intel):

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

```sh
source "$HOME/.cargo/env"
```

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

3. Homebrew (opcional; si ya lo tienes, salta al paso 4):

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

   Solo en un Mac con Apple Silicon (M1, M2…), añadir Homebrew a la ruta:

```sh
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
```

```sh
eval "$(/opt/homebrew/bin/brew shellenv)"
```

4. Node.js y GitHub CLI:

```sh
brew install node gh
```

   Sin Homebrew: descarga e instala «macOS Installer (.pkg)» de la versión LTS desde nodejs.org y el
   paquete de cli.github.com («Download for Mac»).

5. Iniciar sesión en GitHub y clonar:

```sh
gh auth login --hostname github.com --git-protocol https --web
```

```sh
cd ~
```

```sh
gh repo clone electronica-app
```

6. Instalar las dependencias y compilar el binario universal:

```sh
cd ~/electronica-app/web
```

```sh
npm ci
```

```sh
node scripts/tauri.mjs build --target universal-apple-darwin --bundles app dmg
```

7. Abrir la carpeta con el `.dmg`:

```sh
open ~/electronica-app/src-tauri/target/universal-apple-darwin/release/bundle/dmg
```

El fichero es `Electrónica Práctica Avanzada_0.1.0_universal.dmg`: ábrelo y arrastra la aplicación a
«Aplicaciones». La aplicación lleva una firma *ad hoc* (`signingIdentity: "-"` en `tauri.conf.json`,
sin certificado), que es lo mínimo para que arranque en Apple Silicon; no está notarizada. Una copia
compilada en el propio Mac se abre sin avisos. Una copia **descargada** (de GitHub, por ejemplo) se bloquea
la primera vez; hay tres maneras de abrirla:

- macOS 14 o anterior: clic derecho (o Control + clic) sobre la aplicación en «Aplicaciones» → «Abrir» →
  «Abrir».
- macOS 15 o posterior: intentar abrirla, pulsar «Aceptar» en el aviso, ir a «Ajustes del Sistema» →
  «Privacidad y seguridad», bajar hasta «Seguridad» y pulsar «Abrir igualmente» junto al nombre de la
  aplicación (pide la contraseña).
- En cualquier versión, quitar la marca de cuarentena:

```sh
xattr -dr com.apple.quarantine "/Applications/Electrónica Práctica Avanzada.app"
```

Para actualizar más adelante: `cd ~/electronica-app`, `git pull` y repetir el paso 6.

### Android (.apk)

Se compila desde Windows o desde macOS, con el repositorio ya clonado y Node.js y Rust instalados como en
las secciones anteriores. El proyecto Android (`src-tauri/gen/android/`) se genera en cada equipo y no se
versiona.

1. Instalar Android Studio.

   Windows:

```powershell
winget install --id Google.AndroidStudio -e --source winget
```

   macOS (o descargando el `.dmg` de developer.android.com/studio):

```sh
brew install --cask android-studio
```

2. Abrir Android Studio. En el asistente inicial elegir «Standard» y aceptar todas las licencias; instala el
   SDK en la ubicación predeterminada (`%LOCALAPPDATA%\Android\Sdk` en Windows, `~/Library/Android/sdk` en
   macOS).

3. Abrir el «SDK Manager»: en la pantalla de bienvenida, «More Actions» → «SDK Manager» (con un proyecto
   abierto: «Tools» → «SDK Manager»). Marcar exactamente estas casillas:

   Pestaña «SDK Platforms» (activar «Show Package Details» abajo a la derecha):
   - «Android SDK Platform 37» (el `compileSdk` del proyecto que genera Tauri; si el asistente instaló
     una versión mayor, márcala también; cualquier 34 o posterior sirve para el teléfono).

   Pestaña «SDK Tools» (con «Show Package Details» desactivado):
   - «Android SDK Build-Tools» (la última).
   - «NDK (Side by side)».
   - «Android SDK Command-line Tools (latest)».
   - «Android SDK Platform-Tools».

   Pulsar «Apply», aceptar las licencias y esperar a que termine la descarga. Cerrar Android Studio.

4. Variables de entorno (`JAVA_HOME` apunta al JDK que trae Android Studio, el JBR).

   Windows (PowerShell; después, cerrar y abrir Terminal):

```powershell
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
```

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

```powershell
[Environment]::SetEnvironmentVariable("NDK_HOME", (Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\ndk" | Sort-Object { [version]$_.Name } | Select-Object -Last 1).FullName, "User")
```

   macOS (zsh; las tres líneas se añaden a `~/.zshrc`):

```sh
echo 'export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"' >> ~/.zshrc
```

```sh
echo 'export ANDROID_HOME="$HOME/Library/Android/sdk"' >> ~/.zshrc
```

```sh
echo 'export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 "$ANDROID_HOME/ndk" | sort -V | tail -n 1)"' >> ~/.zshrc
```

```sh
source ~/.zshrc
```

5. Solo en Windows: activar el modo de programador, porque Tauri enlaza las bibliotecas nativas con
   enlaces simbólicos: «Configuración» → «Sistema» → «Para programadores» → «Modo de programador»:
   «Activado».

6. Destinos de Rust para Android (en Windows y en macOS):

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

7. Clave de firma. La clave de la aplicación (`electronica-release.jks`) se entrega aparte, fuera del
   repositorio, con `firma.properties` (alias y contraseñas) y `electronica-release.jks.b64`. Copia los
   ficheros a la carpeta `electronica-firma` de tu carpeta personal. Si los tienes en «Descargas»:

   Windows:

```powershell
New-Item -ItemType Directory -Force "$HOME\electronica-firma"
```

```powershell
Copy-Item "$HOME\Downloads\electronica-release.jks", "$HOME\Downloads\firma.properties", "$HOME\Downloads\electronica-release.jks.b64" "$HOME\electronica-firma\"
```

   macOS:

```sh
mkdir -p ~/electronica-firma
```

```sh
cp ~/Downloads/electronica-release.jks ~/Downloads/firma.properties ~/Downloads/electronica-release.jks.b64 ~/electronica-firma/
```

   Guarda además una copia de seguridad de esa carpeta: sin esa clave no se puede actualizar la
   aplicación instalada (habría que desinstalarla y se perderían marcadores y notas).

8. Generar el proyecto Android (solo la primera vez; desde `web/`):

   Windows:

```powershell
cd $HOME\electronica-app\web
```

   macOS:

```sh
cd ~/electronica-app/web
```

   En ambos:

```sh
npm ci
```

```sh
node scripts/tauri.mjs android init
```

9. Copiar los iconos de la aplicación al proyecto Android y configurar la firma (escribe
   `src-tauri/gen/android/keystore.properties`, que nunca se sube, y añade la firma de la versión
   *release* a `app/build.gradle.kts`, como indica la guía de Tauri). Se puede repetir sin problema:

```sh
npm run android:preparar
```

10. Compilar el APK (64 y 32 bits ARM, que cubren cualquier teléfono):

```sh
node scripts/tauri.mjs android build --apk --target aarch64 armv7
```

   El APK firmado queda en
   `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`.

11. Instalarlo en el teléfono, de una de estas dos maneras:

   - **Copiando el fichero**: pásalo al teléfono (cable USB, Google Drive, correo…), ábrelo desde la
     aplicación «Archivos» y, cuando lo pida, activa «Permitir de esta fuente» («Ajustes» → «Aplicaciones»
     → «Acceso especial de aplicaciones» → «Instalar apps desconocidas» → «Archivos» → «Permitir de esta
     fuente»). Vuelve atrás y pulsa «Instalar».
   - **Con `adb`**: en el teléfono, «Ajustes» → «Información del teléfono» → pulsar siete veces «Número de
     compilación»; luego «Ajustes» → «Sistema» → «Opciones para desarrolladores» → «Depuración por USB»:
     activada. Conecta el cable, acepta el aviso de depuración en el teléfono y ejecuta:

   Windows:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "$HOME\electronica-app\src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk"
```

   macOS:

```sh
"$ANDROID_HOME/platform-tools/adb" install -r ~/electronica-app/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

Las actualizaciones se instalan encima conservando los datos siempre que se firmen con la misma clave y la
versión no baje. Para probar en el teléfono conectado con recarga en caliente: `node scripts/tauri.mjs
android dev`. El botón Atrás de Android recorre el historial de la vista web: cierra el visor de figuras,
la búsqueda y el cajón del índice, y deshace los saltos de referencias.

## Compilar con GitHub Actions

El flujo `.github/workflows/compilar.yml` compila los tres instaladores en máquinas de GitHub cada vez que
se sube algo a `main` (salvo cambios solo en ficheros `.md` o en `contenido/`), con cada etiqueta `v…` y
a mano desde la pestaña «Actions». Tiene cuatro trabajos:

| Trabajo | Máquina | Resultado (artefacto) |
|---|---|---|
| Windows (.exe y .msi) | `windows-latest` | `Electronica-Windows`: `Electronica-<versión>-windows-x64-setup.exe` y `…-windows-x64.msi` |
| macOS (.dmg universal) | `macos-latest` | `Electronica-macOS`: `Electronica-<versión>-macos-universal.dmg` (Apple Silicon e Intel) |
| Android (.apk firmado) | `ubuntu-latest` | `Electronica-Android`: `Electronica-<versión>-android.apk` (arm64-v8a y armeabi-v7a) |
| Publicar en Releases | `ubuntu-latest` | solo con etiquetas `v…`: una «Release» con los cuatro instaladores y `SHA256SUMS.txt` |

Cada artefacto incluye un fichero `SHA256SUMS-…txt` con las sumas de comprobación. El trabajo de Android
genera el proyecto con `tauri android init`, copia los iconos y configura la firma con
`npm run android:preparar`, a partir de cuatro secretos del repositorio.

**Coste**: en un repositorio privado, los minutos de Windows y, sobre todo, de macOS consumen la cuota
gratuita de GitHub Actions mucho más deprisa que los de Linux, y los artefactos ocupan cuota de
almacenamiento (por eso se conservan solo 14 días; los ficheros de una «Release» no caducan). Consulta el
consumo en «Settings» → «Billing and plans» de tu cuenta.

### 1. Crear el repositorio privado

En github.com, botón «+» (arriba a la derecha) → «New repository». Rellenar el formulario así:

- «Owner»: tu cuenta personal.
- «Repository name»: `electronica-app`.
- «Description»: `Lector privado de «Electrónica Práctica Avanzada» (Svelte 5 + Tauri 2)`.
- Visibilidad: «Private».
- «Start with a template» (si aparece): «No template».
- «Add a README file» / «Add README»: desactivado.
- «Add .gitignore»: «No .gitignore».
- «Choose a license» / «Add license»: «No license».

Pulsar «Create repository». El repositorio queda vacío; **no** subas nada todavía.

### 2. Añadir los cuatro secretos

En el repositorio: «Settings» → «Secrets and variables» → «Actions» → «New repository secret». Crear
estos cuatro, uno a uno («Name» y «Secret»; pulsar «Add secret» tras cada uno). Los valores están en los
ficheros de la clave que se entregan aparte (`electronica-firma.txt` los resume):

| Name | Secret |
|---|---|
| `ANDROID_KEYSTORE_B64` | Todo el contenido de `electronica-release.jks.b64` (ábrelo con el Bloc de notas o TextEdit, selecciona todo y pega; es una sola línea larga) |
| `ANDROID_KEYSTORE_PASSWORD` | El valor de `storePassword` en `firma.properties` |
| `ANDROID_KEY_ALIAS` | `electronica` |
| `ANDROID_KEY_PASSWORD` | El valor de `keyPassword` en `firma.properties` |

Alternativa desde el Terminal de macOS, con los ficheros ya en `~/electronica-firma` y `gh auth login`
hecho (cada comando crea o sustituye un secreto):

```sh
gh secret set ANDROID_KEYSTORE_B64 --repo "$(gh api user --jq .login)/electronica-app" < ~/electronica-firma/electronica-release.jks.b64
```

```sh
printf '%s' "$(sed -n 's/^storePassword=//p' ~/electronica-firma/firma.properties)" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$(gh api user --jq .login)/electronica-app"
```

```sh
printf '%s' "electronica" | gh secret set ANDROID_KEY_ALIAS --repo "$(gh api user --jq .login)/electronica-app"
```

```sh
printf '%s' "$(sed -n 's/^keyPassword=//p' ~/electronica-firma/firma.properties)" | gh secret set ANDROID_KEY_PASSWORD --repo "$(gh api user --jq .login)/electronica-app"
```

Si falta un secreto, el trabajo de Android se detiene al principio con un mensaje que dice cuál.

### 3. Subir el código

Desde un terminal abierto en la carpeta `app` (la que contiene este `README.md`), con todo ya
confirmado en `main` (incluido `web/public/libro/`, unos 112 MB) y GitHub CLI con la sesión iniciada
(`gh auth login --hostname github.com --git-protocol https --web`). Los comandos valen igual en PowerShell
y en el Terminal de macOS o Linux:

```sh
git remote add origin "https://github.com/$(gh api user --jq .login)/electronica-app.git"
```

```sh
git push -u origin main
```

Si el envío se corta por el tamaño, amplía el búfer de HTTP y repite el `git push`:

```sh
git config http.postBuffer 524288000
```

El envío a `main` lanza la compilación. Para lanzarla a mano: pestaña «Actions» → «Compilar» (a la
izquierda) → «Run workflow» → «Branch: main» → «Run workflow».

### 4. Descargar los instaladores

Pestaña «Actions» → la ejecución (marca verde) → abajo, en «Artifacts», pulsar `Electronica-Windows`,
`Electronica-macOS` o `Electronica-Android`. Cada uno se descarga como `.zip` con el instalador y su suma
SHA-256. Se borran a los 14 días.

### 5. Publicar una versión con etiqueta

La versión de los instaladores se toma de la etiqueta (`v0.2.0` → 0.2.0), sin tocar `tauri.conf.json`;
también fija el `versionCode` de Android, de modo que cada versión nueva se instala encima de la anterior.
La etiqueta debe tener la forma `vX.Y.Z` y ser mayor que la anterior. Desde la carpeta `app`:

```sh
git tag v0.2.0
```

```sh
git push origin v0.2.0
```

Al terminar los tres trabajos, aparece en «Releases» (columna derecha de la portada del repositorio)
«Electrónica Práctica Avanzada v0.2.0» con los cuatro instaladores y `SHA256SUMS.txt`. Desde el teléfono,
con la sesión de GitHub iniciada en el navegador, se puede descargar el APK directamente de ahí.

Si un trabajo falla por algo pasajero (una descarga cortada), en la ejecución: «Re-run jobs» → «Re-run
failed jobs».

### Actualizar el contenido del libro

`web/public/libro/` se versiona porque las máquinas de GitHub no pueden regenerarlo (necesita las fuentes
del libro, las fuentes tipográficas y las fotos). Tras corregir el libro, en la máquina que tiene las
fuentes: `python3 contenido/generar.py`, confirmar los cambios de `web/public/libro/` y subirlos a `main`
(o etiquetar una versión nueva). Ningún fichero del contenido debe pasar de 50 MB (hoy el mayor ocupa
unos 4 MB).

## Estructura del proyecto

```
app/
  .github/workflows/compilar.yml  compilación de los instaladores en GitHub Actions
  ESQUEMA.md                 contrato entre el generador de contenido y la aplicación
  README.md                  este documento
  contenido/                 generador en Python: fuentes Typst → web/public/libro/
  web/                       aplicación (Svelte 5 + TypeScript + Vite)
    index.html
    package.json             scripts: dev, build, check, tauri, android:preparar
    scripts/tauri.mjs        lanza la CLI de Tauri con src-tauri/ como proyecto nativo
    scripts/android-preparar.mjs  iconos y firma del proyecto Android generado (npm run android:preparar)
    scripts/version-ci.mjs   en GitHub Actions, toma la versión de la etiqueta vX.Y.Z
    scripts/ngspice.mjs      extrae ngspice (WebAssembly) de eecircuit-engine (antes de dev, build y check)
    scripts/validar-spice.mjs  ejecuta todas las netlists en el motor con Node (lo llama contenido/spice.py)
    playwright.config.ts, tests/  pruebas de extremo a extremo (npm test) y medida de rendimiento
    public/
      icono.png
      libro/                 CONTENIDO GENERADO (se versiona; ver «Actualizar el contenido del libro»)
    src/
      main.ts                arranque
      App.svelte             estructura general, tema, atajos
      app.css                variables de tema (claro, sepia, oscuro) y estilos base
      estilos/
        fuentes.css          @font-face woff2 de los paquetes @fontsource (sin CDN)
        lectura.css          tipografía y bloques del libro en pantalla
      componentes/
        Lateral.svelte       índice (barra lateral o cajón)
        Barra.svelte         barra superior: dónde estoy, buscar, «Aa», progreso
        Ajustes.svelte       tema y tamaño del texto
        Inicio.svelte        portada: continuar leyendo, índice por tomos
        Lector.svelte        vista de un capítulo: posición, referencias, «Volver»
        Bloques.svelte       dibuja cada tipo de bloque (recursivo)
        Seccion.svelte       título de sección con marcador y nota
        Ecuacion.svelte, Figura.svelte, Tabla.svelte, Ejercicios.svelte
        VisorFigura.svelte   figura a pantalla completa con zoom y desplazamiento
        Glosario.svelte      glosario con letras y filtro
        Busqueda.svelte      búsqueda (MiniSearch)
        Marcadores.svelte    marcadores y notas
        BotonSimular.svelte  «Simular» junto a figuras, secciones, problemas y ejercicios
        animaciones/         componentes animados: catálogo (enlaces al libro), galería, página, escenas/
                             (una por animación, se cargan al abrirla), nucleo/ (física, dibujo), ui/
        grafica/             gráfica interactiva reutilizable (canvas): API en ESQUEMA.md
        simulador/           vistas del simulador: Simulador (rutas), Indice, Pagina, Parametros,
                             Resultados, Editor (se cargan solo al abrir el simulador)
        Insignia.svelte, Icono.svelte
      lib/
        tipos.ts             tipos del contenido (ESQUEMA.md)
        datos.ts             carga del contenido, rutas de recursos, HTML de las referencias
        ruta.svelte.ts       rutas con almohadilla, historial y posición de cada entrada
        usuario.svelte.ts    preferencias, posiciones, marcadores y notas
        almacen.ts           Tauri plugin-store o localStorage
        buscador.ts          índice de búsqueda y fragmentos
        trozos.ts            división de un capítulo en tramos para dibujar solo lo visible
        precarga.ts          preparación en segundo plano de los capítulos a los que se puede saltar
        color.ts             acentos de cada bloque temático en cada tema
        acciones.ts          capas (cajón, búsqueda, visor) ligadas al botón Atrás
        muestra/             contenido de muestra que sigue ESQUEMA.md
      simulador/             motor (ngspice en WebAssembly), worker, cliente, netlists: ver ESQUEMA.md
  src-tauri/                 envoltorio nativo (Tauri 2, Rust)
    tauri.conf.json          nombre, identificador, ventana, CSP, instaladores
    capabilities/default.json  permisos: solo el almacén de datos
    src/lib.rs, src/main.rs
    icons/                   iconos generados con `tauri icon` (fuente: icons/fuente/icono.svg)
```

## Notas técnicas

- **Ecuaciones**: el generador produce SVG cuyo color es `currentColor`; como un `<img>` no hereda el
  color del texto, la aplicación pinta cada ecuación con el color del texto usando el propio SVG como
  máscara CSS. Las medidas en puntos (`w`, `h`) se convierten a `em`, así que las ecuaciones crecen con el
  tamaño de letra elegido.
- **Capítulos largos**: cada capítulo se carga por separado cuando se abre. El texto se divide en tramos
  (una sección, o 30 bloques como mucho) con `content-visibility: auto`, de modo que el navegador solo
  compone y pinta lo que está cerca de la pantalla. Todo el texto sigue en la página (la búsqueda del
  navegador y las referencias funcionan); no es virtualización. En los motores sin anclaje de
  desplazamiento nativo (WebKit, en macOS) la aplicación compensa ella misma los cambios de altura.
- **Guiones**: el texto se justifica y se divide con guiones (`hyphens: auto`) a partir de 700 px de
  ancho, como en el libro; en el teléfono va en bandera, que se lee mejor en columnas estrechas y evita
  el coste de la división silábica en dispositivos lentos.
- **Historial**: cada entrada del historial guarda su posición (como bloque más desplazamiento, no solo
  en píxeles, para que sea exacta aunque cambie el tamaño de letra o carguen imágenes). El cajón, la
  búsqueda y el visor de figuras añaden su propia entrada, de modo que Atrás los cierra.
- **Seguridad**: la CSP de Tauri solo permite recursos propios; el único permiso nativo es el del
  almacén de datos.
- **Icono**: original, una resistencia estilizada con bandas de los colores de los bloques sobre el azul
  marino del libro (`1A3A5C`). Para cambiarlo, editar `src-tauri/icons/fuente/icono.svg`, exportarlo a
  PNG de 1024 px y ejecutar `npm run tauri -- icon ../src-tauri/icons/fuente/icono.png` desde `web/`.
- **Saltos entre capítulos**: un capítulo largo tardaba segundos en un teléfono porque se creaba entero de
  golpe (y cada ecuación en línea que se cargaba obligaba a recalcular estilos). Ahora el lector dibuja
  primero el tramo de destino y rellena los demás en los ratos libres, empezando por los más cercanos; un
  tramo aún vacío conserva su altura estimada, así que la página no se mueve. Mientras se lee, se cargan y
  preparan (JSON, tramos y HTML de la sección de destino) los capítulos a los que remite la sección en
  pantalla y el siguiente. Medido con `tests/rendimiento.mjs` (CPU ×6, 412 × 915, mediana del momento en que
  el destino queda colocado): de 3,7 / 5,6 / 7,2 s a 0,43 / 0,53 / 0,85 s en los tres saltos de prueba.
- **Simulador**: cada simulación usa una instancia nueva de ngspice (unos 40 ms desde el módulo ya
  compilado), sin estado heredado de la anterior; una simulación nueva sustituye a la que esté en curso
  (útil con los controles deslizantes). La CSP de Tauri permite compilar WebAssembly (`'wasm-unsafe-eval'`).
- **Tamaño**: el simulador añade el motor (5,8 MB, unos 2 MB comprimido), las netlists y su índice (1,5 MB)
  y unos 130 kB de código, que solo se cargan al abrir el simulador. Medido en Linux: el `.deb` pasa de
  43,4 a 45,4 MB y el ejecutable de 45,7 a 47,8 MB (Tauri guarda los recursos comprimidos con Brotli).
