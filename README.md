# Electrónica Práctica Avanzada — lector

Aplicación privada y sin conexión para leer «Electrónica Práctica Avanzada» en Windows, macOS y Android.
Es una sola aplicación web (Svelte 5 + TypeScript + Vite) empaquetada con Tauri 2. Todo el contenido se
genera a partir de las fuentes Typst del libro, de modo que una corrección en un capítulo llega a la
aplicación con solo regenerar y volver a compilar.

Esta es la fase 1 (el lector). Las fases siguientes (simulador, ejercicios, modelos 3D, editor de
esquemas) están descritas en `ESQUEMA.md`.

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

### Atajos de teclado

| Tecla | Acción |
|---|---|
| `Ctrl K` / `⌘ K`, `/` | Buscar |
| `↑` `↓` `Intro` | Elegir y abrir un resultado de búsqueda |
| `Esc` | Cerrar la búsqueda, el visor de figuras o el panel «Aa» |
| `+` `-` `0` | Acercar, alejar y ajustar en el visor de figuras |
| `Ctrl Intro` | Guardar la nota que se está escribiendo |

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
formato está descrito en `ESQUEMA.md`. Esa carpeta no se versiona.

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

`npm run tauri …` ejecuta la CLI de Tauri mediante `web/scripts/tauri.mjs`, que le indica dónde está
`src-tauri/` (la CLI solo busca su configuración por debajo de la carpeta actual). Funciona igual en
Windows, macOS y Linux.

## Compilar para cada plataforma

El contenido de `web/public/libro/` se **incrusta en el ejecutable** al compilar: hay que generarlo antes
y volver a compilar cada vez que cambie. Tauri no compila de forma cruzada para Windows ni macOS: cada
instalador se construye en su propio sistema (o en un servicio de integración continua con máquinas de
ese sistema).

Los resultados quedan en `src-tauri/target/release/bundle/<formato>/` (o
`src-tauri/target/<destino>/release/bundle/` cuando se indica `--target`).

### Linux (para comprobar la parte nativa)

```sh
sudo apt install libwebkit2gtk-4.1-dev librsvg2-dev libayatana-appindicator3-dev \
  build-essential curl wget file libxdo-dev libssl-dev pkg-config
cd app/web
npm run tauri build -- --bundles deb        # o --bundles appimage
```

Genera `bundle/deb/Electrónica Práctica Avanzada_0.1.0_amd64.deb`.

### Windows (.exe con NSIS y .msi)

En un PC con Windows 10 u 11:

1. Instalar las «Build Tools for Visual Studio» con la carga de trabajo «Desarrollo para el escritorio
   con C++».
2. Instalar Rust con `rustup` (destino MSVC, el predeterminado) y Node.js.
3. WebView2 ya viene con Windows 10 y 11; el instalador lo descarga si faltara.
4. Generar el contenido (o copiar `web/public/libro/` desde la máquina donde se generó) y compilar:

```powershell
cd app\web
npm install
npm run tauri build                        # NSIS y MSI
npm run tauri build -- --bundles nsis      # solo el instalador .exe
```

Resultados: `bundle\nsis\Electrónica Práctica Avanzada_0.1.0_x64-setup.exe` (instalación para el
usuario, sin permisos de administrador) y `bundle\msi\Electrónica Práctica Avanzada_0.1.0_x64_es-ES.msi`.
Sin firma de código, SmartScreen avisará la primera vez («Más información» → «Ejecutar de todas formas»).

### macOS (.app y .dmg)

En un Mac con macOS 12 o posterior:

```sh
xcode-select --install
rustup target add aarch64-apple-darwin x86_64-apple-darwin
cd app/web
npm install
npm run tauri build -- --bundles app,dmg                                   # para el propio Mac
npm run tauri build -- --bundles app,dmg --target universal-apple-darwin   # Intel y Apple Silicon
```

Resultado: `bundle/dmg/Electrónica Práctica Avanzada_0.1.0_aarch64.dmg` (o `_universal.dmg`). Al no estar
firmada ni notarizada, la primera vez hay que abrirla con clic derecho → «Abrir», o quitar la cuarentena:

```sh
xattr -dr com.apple.quarantine "/Applications/Electrónica Práctica Avanzada.app"
```

### Android (.apk)

La configuración está preparada (`identifier`, iconos de Android en `src-tauri/icons/android/`,
`bundle.android.minSdkVersion` = 24), pero el proyecto Android (`src-tauri/gen/android/`) se genera en
la máquina que tenga el SDK. En Linux, macOS o Windows:

1. Instalar Android Studio y, desde su «SDK Manager»: Android SDK Platform (API 34 o posterior),
   Platform-Tools, Build-Tools, Command-line Tools y NDK (Side by side).
2. Definir las variables de entorno (ejemplo en macOS/Linux; en Windows, las mismas en «Variables de
   entorno»):

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"   # el JDK que trae Android Studio
export ANDROID_HOME="$HOME/Library/Android/sdk"                                  # Linux: $HOME/Android/Sdk
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk | tail -1)"
```

3. Añadir los destinos de Rust y crear el proyecto Android (solo la primera vez):

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
cd app/web
npm run tauri android init
```

4. Probar en el teléfono conectado por USB (con la depuración USB activada) o compilar el APK:

```sh
npm run tauri android dev
npm run tauri android build -- --apk --target aarch64
```

El APK queda en `src-tauri/gen/android/app/build/outputs/apk/universal/release/` sin firmar. Para
instalarlo hay que firmarlo una vez con una clave propia:

```sh
keytool -genkey -v -keystore ~/epa.jks -keyalg RSA -keysize 2048 -validity 10000 -alias epa
"$ANDROID_HOME"/build-tools/<versión>/apksigner sign --ks ~/epa.jks --out epa.apk \
  src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk
adb install -r epa.apk
```

(o copiar `epa.apk` al teléfono y abrirlo, permitiendo «instalar aplicaciones de origen desconocido»).
Hay que conservar la misma clave para las actualizaciones. El botón Atrás de Android recorre el
historial de la vista web: cierra el visor de figuras, la búsqueda y el cajón del índice, y deshace los
saltos de referencias.

### Integración continua (opcional)

Si el proyecto se sube a GitHub, un flujo de GitHub Actions puede compilar Windows y macOS con
`tauri-apps/tauri-action` en máquinas `windows-latest` y `macos-latest`, y Android en `ubuntu-latest` con
`actions/setup-java` (JDK 17), `android-actions/setup-android` y el NDK. Como `web/public/libro/` no se
versiona y su generación necesita las fuentes del libro, lo más sencillo es generar el contenido en local y
subirlo como artefacto (o versionarlo en una rama privada) antes de compilar. Esquema mínimo:

```yaml
jobs:
  escritorio:
    strategy:
      matrix:
        os: [windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: dtolnay/rust-toolchain@stable
      # (aquí: descargar web/public/libro/ generado en local)
      - run: npm ci
        working-directory: web
      - run: npm run tauri build
        working-directory: web
      - uses: actions/upload-artifact@v4
        with:
          name: instaladores-${{ matrix.os }}
          path: src-tauri/target/release/bundle/
```

## Estructura del proyecto

```
app/
  ESQUEMA.md                 contrato entre el generador de contenido y la aplicación
  README.md                  este documento
  contenido/                 generador en Python: fuentes Typst → web/public/libro/
  web/                       aplicación (Svelte 5 + TypeScript + Vite)
    index.html
    package.json             scripts: dev, build, check, tauri
    scripts/tauri.mjs        lanza la CLI de Tauri con src-tauri/ como proyecto nativo
    public/
      icono.png
      libro/                 CONTENIDO GENERADO (no se versiona)
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
        Insignia.svelte, Icono.svelte
      lib/
        tipos.ts             tipos del contenido (ESQUEMA.md)
        datos.ts             carga del contenido, rutas de recursos, HTML de las referencias
        ruta.svelte.ts       rutas con almohadilla, historial y posición de cada entrada
        usuario.svelte.ts    preferencias, posiciones, marcadores y notas
        almacen.ts           Tauri plugin-store o localStorage
        buscador.ts          índice de búsqueda y fragmentos
        trozos.ts            división de un capítulo en tramos para dibujar solo lo visible
        color.ts             acentos de cada bloque temático en cada tema
        acciones.ts          capas (cajón, búsqueda, visor) ligadas al botón Atrás
        muestra/             contenido de muestra que sigue ESQUEMA.md
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
